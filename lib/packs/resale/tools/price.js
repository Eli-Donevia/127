// Price and offers for one item: the list price from sold prices you found, the lowest price that
// still leaves your profit, the offer to send people who watch or like it, the bundle rule and the
// markdown dates (30 and 45 days, then move it at 60). Fee math on every platform at the list price.

const { views, time, money, text } = require('../../_kit');
const C = require('../../_kit/common');
const F = require('../lib/fees');

const { usd, num } = money;
const { plain } = text;

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function priceTool(N) {
  const classes = Object.keys(N.shipping.classes);
  return {
    name: 'resale.price_item',
    title: 'Price and offers',
    description: 'For one item: a list price from recent sold prices, your lowest price after fees and cost, the offer message for watchers, a bundle rule and markdown dates, with the fee on every platform.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      required: ['item', 'sold'],
      properties: {
        item: { type: 'string', maxLength: 100, title: 'Item' },
        sold: { type: 'string', maxLength: 200, title: 'Recent sold prices you found', description: 'Like "38, 42, 45" from sold listings, not asking prices' },
        cost: { type: 'string', maxLength: 10, title: 'What you paid', default: '0' },
        weight: { type: 'string', enum: classes, default: '1lb', title: 'Ships as' },
        platform: { type: 'string', enum: N.platforms.map((p) => p.id), default: 'ebay', title: 'Where you list it' },
        profit: { type: 'string', maxLength: 8, title: 'Lowest profit you accept', default: String(N.pricing.min_profit) },
      },
    },
    output: { type: 'object', required: ['list', 'floor'], properties: { list: { type: 'number' }, floor: { type: 'number' } } },
    async run(input, ctx) {
      const sold = String(input.sold || '').split(/[,;\s]+/).map((x) => num(x, null)).filter((x) => x && x > 0).slice(0, 20);
      if (!sold.length) throw new Error('Add at least one recent sold price, like "38, 42, 45".');
      const item = plain(input.item || 'item');
      const cost = Math.max(0, num(input.cost, 0) || 0);
      const weight = classes.includes(input.weight) ? input.weight : '1lb';
      const platform = N.platforms.find((p) => p.id === input.platform) || N.platforms[0];
      const profit = Math.max(0, num(input.profit, N.pricing.min_profit) || 0);
      const list = Math.max(1, Math.round(median(sold)));
      const floor = F.floorPrice(N, platform.id, { cost, profit, weight }) || list;
      const pr = N.pricing;
      const atLeast = (x) => Math.max(floor, Math.round(x));
      const watcher = atLeast(list * (1 - pr.watcher_off));
      const today = time.today(ctx);
      const marks = [
        ...pr.markdowns.map((m) => ({ on: time.shortDate(time.addDays(today, m.day)), day: m.day, price: usd(atLeast(list * (1 - m.off))), what: `Lower to this price${atLeast(list * (1 - m.off)) === floor ? ' (your floor)' : ''}.` })),
        { on: time.shortDate(time.addDays(today, pr.move_day)), day: pr.move_day, price: '', what: C.fill(N.texts.move, { day: pr.move_day }) },
      ];
      const fees = F.feeTable(N, { price: list, weight, cost }).map((r) => ({ ...r, fee_t: usd(r.fee), keep_t: usd(r.keep), profit_t: usd(r.profit) }));
      const messages = {
        watchers: C.fill(N.texts.watchers, { item, price: usd(watcher) }),
        bundle: C.fill(N.texts.bundle, { off: Math.round(pr.bundle_off * 100) }),
      };
      const warn = list < floor ? `Sold prices are below your floor of ${usd(floor)}: at ${usd(list)} this item doesn't leave your profit. Skip it or pay less next time.` : null;
      return { item, platform: platform.name, sold, list, floor, watcher, marks, fees, messages, warn, cost, profit };
    },
    view(out) {
      return views.blocks(
        views.metric(`List ${out.item}`, usd(out.list), `From ${out.sold.length} sold prices. Lowest you accept on ${out.platform}: ${usd(out.floor)}`),
        out.warn ? views.text(out.warn) : null,
        views.copy('Offer for people watching or liking it', out.messages.watchers),
        views.copy('Bundle rule for your listing', out.messages.bundle),
        views.table([{ key: 'on', label: 'Date' }, { key: 'price', label: 'Price' }, { key: 'what', label: 'What to do' }], out.marks),
        views.table([{ key: 'platform', label: 'Platform' }, { key: 'fee_t', label: 'Fee' }, { key: 'keep_t', label: 'You keep' }, { key: 'profit_t', label: 'Profit after cost' }, { key: 'shipping', label: 'Shipping' }], out.fees),
      );
    },
  };
}

module.exports = { priceTool, median };
