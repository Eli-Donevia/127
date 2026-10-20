// Pricing check from the member's own landed cost: for one product at their price, the fee on each
// channel (Shopify Payments on their plan, Etsy, PayPal; rates from data/fees.json with sources), what
// they keep, profit per sale, margin, the break-even price and the price that hits their target
// margin, plus a wholesale check at half the retail price. All code; nothing is estimated for them.

const { views, save, files, money, text } = require('../../_kit');
const S = require('../lib/store');

const { usd, num, pct } = money;
const { plain } = text;

const PLANS = { basic: 'shopify_basic', grow: 'shopify_grow', advanced: 'shopify_advanced' };

function priceRows({ cost, price, ship, shipCost, margin, plan }) {
  const ids = [PLANS[plan] || PLANS.basic, 'etsy', 'paypal_checkout', 'paypal_cards'];
  return S.channels(ids).map((ch) => {
    const fee = S.feeFor(ch, { price, ship });
    const keep = S.r2(price + ship - fee);
    const profit = S.r2(keep - cost - shipCost);
    return {
      id: ch.id,
      channel: ch.short,
      fee,
      keep,
      profit,
      margin: price > 0 ? Math.round((profit / price) * 1000) / 1000 : 0,
      break_even: S.priceForMargin(ch, { cost, ship, shipCost, margin: 0 }),
      target_price: S.priceForMargin(ch, { cost, ship, shipCost, margin }),
      how: ch.transaction ? `${pct(ch.transaction, 1)} + ${pct(ch.rate, 0)} + ${usd(ch.fixed)} on ${ch.on}, plus ${usd(ch.listing)} a listing` : `${pct(ch.rate, ch.rate * 1000 % 10 ? 1 : 0)} + ${usd(ch.fixed)} on ${ch.on}`,
      source: ch.source,
    };
  });
}

module.exports = {
  name: 'ecom.price_check',
  title: 'Check your price',
  description: 'From your landed cost and your price: the fee on Shopify Payments, Etsy and PayPal, what you keep, profit and margin per sale, your break-even price, the price for your target margin and a wholesale check.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['unit_cost', 'price'],
    properties: {
      product: { type: 'string', maxLength: 80, title: 'Product', default: 'Your product' },
      unit_cost: { type: 'number', minimum: 0, title: 'What one unit costs you to make or buy, in dollars' },
      inbound: { type: 'number', minimum: 0, default: 0, title: 'Shipping and duty to get it to you, per unit (optional)' },
      packaging: { type: 'number', minimum: 0, default: 0, title: 'Packaging, labels and inserts, per order (optional)' },
      price: { type: 'number', minimum: 0.5, title: 'Your price, in dollars' },
      ship_charge: { type: 'number', minimum: 0, default: 0, title: 'Shipping the buyer pays you (optional)' },
      ship_cost: { type: 'number', minimum: 0, default: 0, title: 'What the shipping label costs you (optional)' },
      margin: { type: 'number', minimum: 0, maximum: 80, default: 40, title: 'Margin you want, in percent', description: 'What is left of the price after every cost and fee' },
      plan: { type: 'string', enum: ['basic', 'grow', 'advanced'], default: 'basic', title: 'Your Shopify plan' },
    },
  },
  output: { type: 'object', required: ['rows', 'landed'], properties: { product: { type: 'string' }, landed: { type: 'number' }, price: { type: 'number' }, rows: { type: 'array' }, wholesale: { type: 'object' }, verdict: { type: 'string' }, notes: { type: 'array' }, file: { type: 'object' }, checked: { type: 'string' } } },
  async run(input, ctx) {
    const product = plain(input.product || 'Your product');
    const landed = S.r2(num(input.unit_cost, 0) + num(input.inbound, 0) + num(input.packaging, 0));
    const price = num(input.price, 0);
    const ship = num(input.ship_charge, 0);
    const shipCost = num(input.ship_cost, 0);
    const margin = Math.min(0.8, Math.max(0, num(input.margin, 40) / 100));
    const rows = priceRows({ cost: landed, price, ship, shipCost, margin, plan: input.plan });
    const wPrice = S.r2(price / 2);
    const wholesale = { price: wPrice, profit: S.r2(wPrice - landed), margin: wPrice > 0 ? Math.round(((wPrice - landed) / wPrice) * 1000) / 1000 : 0 };
    const low = rows.filter((r) => r.margin < margin);
    const verdict = !low.length
      ? `At ${usd(price)} every channel keeps at least ${pct(margin)} after your costs and fees.`
      : low.length === rows.length
        ? `At ${usd(price)} no channel reaches ${pct(margin)}. The price for ${pct(margin)} is ${usd(Math.min(...rows.map((r) => r.target_price || Infinity)))} or more, or the cost has to come down.`
        : `At ${usd(price)}, ${low.map((r) => r.channel).join(' and ')} ${low.length === 1 ? 'falls' : 'fall'} under ${pct(margin)}. See the price for your margin on ${low.length === 1 ? 'that row' : 'those rows'}.`;
    const notes = [
      wholesale.profit > 0 ? `Wholesale at half your price (${usd(wPrice)}) leaves ${usd(wholesale.profit)} a unit before you ship the box to the shop.` : `Wholesale at half your price (${usd(wPrice)}) is under your landed cost of ${usd(landed)}. Shops usually ask for about half of retail, so this price can't go wholesale yet.`,
      ...S.FEES.notes,
    ];
    const csv = files.csv(
      rows.map((r) => ({ ...r, margin: pct(r.margin, 1), break_even: r.break_even == null ? '' : r.break_even, target_price: r.target_price == null ? '' : r.target_price })),
      [
        { key: 'channel', label: 'Channel' },
        { key: 'fee', label: `Fee at ${usd(price)}` },
        { key: 'keep', label: 'You keep' },
        { key: 'profit', label: 'Profit per sale' },
        { key: 'margin', label: 'Margin' },
        { key: 'break_even', label: 'Break-even price' },
        { key: 'target_price', label: `Price for ${pct(margin)}` },
        { key: 'how', label: 'How the fee works' },
        { key: 'source', label: `Source (checked ${S.FEES.checked})` },
      ],
    );
    const file = await save.saveFile(ctx, save.fileName(product, 'price check', '.csv'), csv);
    return { product, landed, price, rows, wholesale, verdict, notes, file, checked: S.FEES.checked };
  },
  view(out) {
    return views.blocks(
      views.metric(`${out.product}: landed cost`, usd(out.landed), `Price ${usd(out.price)}`),
      views.text(out.verdict),
      views.table(
        [
          { key: 'channel', label: 'Channel' },
          { key: 'fee', label: 'Fee', format: 'money' },
          { key: 'keep', label: 'You keep', format: 'money' },
          { key: 'profit', label: 'Profit', format: 'money' },
          { key: 'margin', label: 'Margin', format: 'percent' },
          { key: 'break_even', label: 'Break-even', format: 'money' },
          { key: 'target_price', label: 'Price for your margin', format: 'money' },
        ],
        out.rows,
      ),
      views.text(out.notes.join(' ')),
      views.text(`Fees from each platform's own page, checked ${out.checked}. Rates change: open the source column before you set prices.`),
      views.file(out.file, 'Price check (CSV)'),
    );
  },
};
