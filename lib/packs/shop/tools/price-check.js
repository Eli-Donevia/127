// Prices per product from the member's own numbers: landed cost, Shopify Payments card fees for
// their plan (data/shopify-plans.json, checked against shopify.com/pricing), ad cost per sale,
// profit and margin per sale, break-even ROAS, a price for their target margin and a keystone
// wholesale price. Optional: public prices of similar products at up to 3 competitor stores.

const { text, money, files, save, views } = require('../../_kit');
const H = require('../lib/html');
const { readStore, median } = require('../lib/store');
const PLANS = require('../data/shopify-plans.json');
const WHOLESALE = require('../data/wholesale.json');

const STOP = new Set(['with', 'from', 'that', 'this', 'your', 'pack', 'set', 'size', 'large', 'small', 'gift', 'the', 'and']);
const words = (t) => String(t || '').toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !STOP.has(w)) || [];

function parseLine(line) {
  const parts = String(line || '').split(/\s*[|,]\s*/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  const nums = parts.slice(1).map((p) => Number(String(p).replace(/[^0-9.]/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  return { name: parts[0], cost: nums[0] != null ? nums[0] : null, price: nums[1] != null ? nums[1] : null };
}

function math(p, o) {
  const plan = PLANS.plans[o.plan] || PLANS.plans.basic;
  const rate = plan.card.rate + (o.intl ? plan.internationalExtra : 0);
  const landed = (p.cost || 0) + o.packaging + o.shipping;
  const out = { name: p.name, cost: p.cost, landed: money.round(landed) };
  const target = (landed + plan.card.fixed) / (1 - rate - o.margin) - o.charged;
  out.suggested = target > 0 ? Math.ceil(target) : null;
  const price = p.price != null ? p.price : out.suggested;
  out.price = price;
  out.priceSource = p.price != null ? 'yours' : 'suggested';
  const revenue = price + o.charged;
  out.fee = money.round(revenue * rate + plan.card.fixed);
  out.profit = money.round(revenue - landed - out.fee);
  out.margin = revenue ? out.profit / revenue : 0;
  out.afterAds = o.ad ? money.round(out.profit - o.ad) : null;
  out.roas = out.profit > 0 ? Math.round((revenue / out.profit) * 100) / 100 : null;
  out.wholesale = money.round(price * WHOLESALE.defaultWholesaleShare);
  out.wholesaleMargin = out.wholesale ? ((out.wholesale - (p.cost || 0) - o.packaging) / out.wholesale) : 0;
  return out;
}

module.exports = {
  name: 'shop.price_check',
  title: 'Check your prices',
  description: 'Works out landed cost, Shopify card fees for your plan, profit and margin per sale, break-even ad return, a price for your target margin and a wholesale price, and compares public prices of similar products at up to 3 stores.',
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      products: { type: 'string', maxLength: 8000, description: 'One per line: name, your cost, your price (optional). Like "Lavender candle, 9.50, 32".' },
      plan: { type: 'string', enum: ['basic', 'grow', 'advanced', 'plus'], default: 'basic' },
      packaging: { type: 'number', minimum: 0, default: 0 },
      shipping: { type: 'number', minimum: 0, default: 0, description: 'What you pay to ship one order.' },
      charged: { type: 'number', minimum: 0, default: 0, description: 'What the buyer pays for shipping.' },
      ad: { type: 'number', minimum: 0, description: 'Ad spend per sale (optional).' },
      margin: { type: 'number', minimum: 0.05, maximum: 0.9, default: 0.6, description: 'Target margin for the suggested price, like 0.6.' },
      competitors: { type: 'string', maxLength: 1000, description: 'Up to 3 store addresses, one per line.' },
    },
    required: ['products'],
  },
  output: { type: 'object', properties: { rows: { type: 'array' }, competitors: { type: 'array' }, plan: { type: 'object' }, sheet: { type: ['object', 'null'] }, csv: { type: ['object', 'null'] }, sample: { type: 'boolean' } }, required: ['rows'] },

  async run(input, ctx) {
    const o = { plan: input.plan || 'basic', packaging: input.packaging || 0, shipping: input.shipping || 0, charged: input.charged || 0, ad: input.ad || 0, margin: input.margin || 0.6 };
    const plan = PLANS.plans[o.plan] || PLANS.plans.basic;
    const items = String(input.products || '').split(/\n+/).map(parseLine).filter((p) => p && p.name && p.cost != null).slice(0, 50);
    const rows = items.map((p) => math(p, o));
    const competitors = [];
    for (const addr of String(input.competitors || '').split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 3)) {
      const r = await readStore(ctx, addr, { depth: 'quick' });
      if (!r.ok) {
        competitors.push({ store: addr, ok: false, reason: r.reason || r.status });
        continue;
      }
      const prods = (r.products || []).filter((x) => x.price != null);
      competitors.push({ store: r.name || r.domain, url: r.url, ok: true, median: r.stats.priceMedian, min: r.stats.priceMin, max: r.stats.priceMax, sample: !!r.sample, products: prods.map((x) => ({ title: x.title, price: x.price })).slice(0, 60) });
    }
    for (const row of rows) {
      const w = new Set(words(row.name));
      const similar = [];
      for (const c of competitors.filter((x) => x.ok)) for (const x of c.products) if (words(x.title).some((t) => w.has(t))) similar.push(x.price);
      row.similar = similar.length ? `${money.usd(Math.min(...similar))} to ${money.usd(Math.max(...similar))} (${similar.length})` : '';
      row.similarMedian = similar.length ? median(similar) : null;
    }
    for (const c of competitors) delete c.products;
    const csvRows = rows.map((r) => ({ product: r.name, cost: r.cost, landed: r.landed, price: r.price, price_source: r.priceSource, card_fee: r.fee, profit_per_sale: r.profit, margin: `${Math.round(r.margin * 100)}%`, after_ads: r.afterAds, break_even_roas: r.roas, suggested_price: r.suggested, wholesale_price: r.wholesale, similar_prices: r.similar }));
    const csv = rows.length ? await save.saveFile(ctx, save.fileName('price check', '.csv'), files.csv(csvRows), 'text/csv') : null;
    const t = H.theme('pricing');
    const fmt = rows.map((r) => ({ ...r, landed: money.usd(r.landed, { cents: true }), price: `${money.usd(r.price, { cents: true })}${r.priceSource === 'suggested' ? ' (suggested)' : ''}`, fee: money.usd(r.fee, { cents: true }), profit: money.usd(r.profit, { cents: true }), margin: `${Math.round(r.margin * 100)}%`, roas: r.roas != null ? `${r.roas}x` : 'n/a', suggested: r.suggested != null ? money.usd(r.suggested) : '', wholesale: money.usd(r.wholesale, { cents: true }) }));
    const rateText = `${(plan.card.rate * 100).toFixed(1)}% + ${Math.round(plan.card.fixed * 100)} cents`;
    const body = [
      H.hero({ eyebrow: 'Price check', heading: `${text.plural(rows.length, 'product')}, priced per sale`, lead: `Shopify ${plan.name} plan, online card rate ${rateText} with Shopify Payments (checked ${PLANS.checked}). Every number is per sale, from your costs.` }),
      H.block({
        kicker: 'Per sale',
        title: 'Cost, fees and what you keep',
        body: H.table(
          [{ key: 'name', label: 'Product' }, { key: 'landed', label: 'Landed cost', num: true }, { key: 'price', label: 'Price', num: true }, { key: 'fee', label: 'Card fee', num: true }, { key: 'profit', label: 'Profit per sale', num: true }, { key: 'margin', label: 'Margin', num: true }],
          fmt
        ),
      }),
      H.block({
        kicker: 'Targets',
        title: 'Ads, target price and wholesale',
        body: H.table([{ key: 'name', label: 'Product' }, { key: 'roas', label: 'Break-even ROAS', num: true }, { key: 'suggested', label: `Price for ${Math.round(o.margin * 100)}% margin`, num: true }, { key: 'wholesale', label: 'Wholesale (half)', num: true }, { key: 'similar', label: 'Similar prices seen' }], fmt),
      }),
      H.block({ kicker: 'How to read it', title: 'Notes', body: H.cards([{ title: 'Break-even ROAS', body: 'Sales divided by ad spend at which an ad pays for itself and nothing more. Below it, each ad sale loses money.' }, { title: 'Wholesale at half', body: WHOLESALE.keystoneNote }, { title: 'Other payment providers', body: `Shopify adds a ${(plan.thirdPartyFee * 100).toFixed(1)}% fee on the ${plan.name} plan on top of that provider's own rate. International cards add ${(plan.internationalExtra * 100).toFixed(0)}%.` }]) }),
      competitors.length ? H.block({ kicker: 'Public prices', title: 'What similar stores charge', sub: competitors.some((c) => c.sample) ? 'Sample stores (made up) so you can see the layout. Real store addresses read the real prices.' : "From each store's public product feed today.", body: H.table([{ key: 'store', label: 'Store' }, { key: 'range', label: 'Price range' }, { key: 'mid', label: 'Middle price', num: true }], competitors.map((c) => ({ store: c.store, range: c.ok ? `${money.usd(c.min)} to ${money.usd(c.max)}` : c.reason, mid: c.ok && c.median != null ? money.usd(c.median) : '' }))) }) : '',
    ].join('\n');
    const sheet = rows.length ? await save.saveFile(ctx, save.fileName('price sheet', '.html'), H.page({ title: 'Price sheet', description: 'Per sale price check', theme: t, body, footer: `Fees from ${PLANS.source}, checked ${PLANS.checked}. ${PLANS.region}` }), 'text/html') : null;
    return { rows, competitors, plan: { id: o.plan, name: plan.name, rate: plan.card.rate, fixed: plan.card.fixed, checked: PLANS.checked, source: PLANS.source }, sheet, csv, sample: competitors.some((c) => c.sample) };
  },

  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This price check'),
      views.table(
        [
          { key: 'name', label: 'Product' },
          { key: 'price', label: 'Price', format: 'money' },
          { key: 'profit', label: 'Profit per sale', format: 'money' },
          { key: 'margin', label: 'Margin' },
          { key: 'roas', label: 'Break-even ROAS', format: 'number' },
          { key: 'similar', label: 'Similar prices' },
        ],
        out.rows.map((r) => ({ name: r.name, price: r.price, profit: r.profit, margin: `${Math.round(r.margin * 100)}%`, roas: r.roas, similar: r.similar })),
        10
      ),
      views.text(`Card fees: Shopify Payments on the ${out.plan.name} plan, ${(out.plan.rate * 100).toFixed(1)}% + ${Math.round(out.plan.fixed * 100)} cents per online sale (checked ${out.plan.checked}).`),
      views.file(out.sheet, 'Price sheet'),
      views.file(out.csv, 'Price check sheet (CSV)')
    );
  },
};
