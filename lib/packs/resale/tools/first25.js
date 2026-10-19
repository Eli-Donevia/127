// "Your first 25" for resale: 25 items to look for this week from the member's category (then the
// next closest categories), each with a sold-listings link to check real prices, a sourcing route,
// the shipping weight, fee math on every platform at the price you check, and the most to pay.
// The items are ideas to check, not proof they sell: the sold listings are the proof.

const { files, views, save, time, money, text } = require('../../_kit');
const C = require('../../_kit/common');
const F = require('../lib/fees');

const { usd } = money;
const { plain } = text;

function query(name) {
  const m = String(name).match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return name.replace(/^(Name-brand|Complete)\s+/i, '');
  const first = m[2].split(',')[0].trim();
  const noun = m[1].trim().split(/\s+/).pop();
  return `${first} ${noun}`;
}

const soldLink = (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`;

function first25Tool(N) {
  const ids = Object.keys(N.categories);
  return {
    name: 'resale.list_first25',
    title: 'Your first 25 items',
    description: '25 items to look for this week from your category, each with a sold-listings link to check real prices, where to find it, its shipping weight, the fee on every platform and the most to pay for your profit.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ids, default: ids[0], title: 'Your category' },
        platform: { type: 'string', enum: N.platforms.map((p) => p.id), default: 'ebay', title: 'The one site you start on' },
        price: { type: 'string', maxLength: 8, title: 'Price to check the math at', default: '25', description: 'Use a sold price you found; we show the math at $25 until you do' },
        profit: { type: 'string', maxLength: 8, title: 'Profit you want per item', default: '10' },
        exclude: { type: 'string', maxLength: 4000, title: 'Items already checked (optional)', description: 'One per line, skipped next time' },
      },
    },
    output: { type: 'object', required: ['items'], properties: { items: { type: 'array' }, file: { type: 'object' } } },
    async run(input, ctx) {
      const cat = ids.includes(input.category) ? input.category : ids[0];
      const platform = N.platforms.find((p) => p.id === input.platform) || N.platforms[0];
      const price = Math.max(1, money.num(input.price, 25) || 25);
      const profit = Math.max(0, money.num(input.profit, 10) || 0);
      const skip = new Set(C.linesOf(input.exclude, 300).map((s) => s.toLowerCase()));
      const pool = [cat, ...ids.filter((i) => i !== cat)].flatMap((id) => N.categories[id].items.map((it) => ({ ...it, category: N.categories[id].label, mine: id === cat })));
      const items = pool
        .filter((it) => !skip.has(it.name.toLowerCase()))
        .slice(0, 25)
        .map((it, i) => {
          const fees = F.feeTable(N, { price, weight: it.weight });
          const on = fees.find((f) => f.id === platform.id);
          const route = N.routes[it.where] || N.routes.thrift;
          const q = query(it.name);
          return {
            n: i + 1,
            item: it.name,
            category: it.category,
            where: route.label,
            when: route.when,
            weight: N.shipping.classes[it.weight].label,
            check: soldLink(q),
            search: q,
            fees,
            keep: on.keep,
            pay_at_most: Math.max(0, Math.floor(on.keep - profit)),
            max_text: usd(Math.max(0, Math.floor(on.keep - profit))),
            watch: it.watch,
            line: `${it.name}: on ${platform.name} at ${usd(price)} you keep ${usd(on.keep)}; pay at most ${usd(Math.max(0, Math.floor(on.keep - profit)))}.`,
          };
        });
      const today = time.today(ctx);
      const day = (n) => `${time.shortDate(time.addDays(today, n))}`;
      const routes = [...new Set(items.map((i) => i.where))];
      const plan = [
        `Tonight: pick 10 things you already own and list 3 on ${platform.name}. No money at risk while you learn.`,
        `${day(1)}: open the sold-listings link for each item below and write down 3 recent sold prices.`,
        `This week: ${routes.map((r) => `${r} (${Object.values(N.routes).find((x) => x.label === r).when.toLowerCase()})`).join(', ')}. Buy only items with recent sales, under the "pay at most" price.`,
        `${day(7)}: list everything you bought within 2 days, and re-run this with the items you checked in "Items already checked".`,
      ];
      const rows = items.map((i) => ({ n: i.n, item: i.item, category: i.category, where: i.where, when: i.when, weight: i.weight, check: i.check, keep: i.keep, max: i.pay_at_most, watch: i.watch }));
      const csv = files.csv(rows, [
        { key: 'n', label: '#' },
        { key: 'item', label: 'Item to look for' },
        { key: 'category', label: 'Category' },
        { key: 'where', label: 'Where' },
        { key: 'when', label: 'When' },
        { key: 'weight', label: 'Ships as' },
        { key: 'check', label: 'Check sold prices' },
        { key: 'keep', label: `You keep at ${usd(price)} on ${platform.name}` },
        { key: 'max', label: 'Pay at most' },
        { key: 'watch', label: 'Watch for' },
      ]);
      const file = await save.saveFile(ctx, save.fileName('resale', 'first 25 items', today, '.csv'), csv);
      const compare = F.feeTable(N, { price, weight: '1lb' }).map((r) => ({ platform: r.platform, fee: usd(r.fee), keep: usd(r.keep), how: r.fee_text }));
      return { card: C.crowdCard(ctx, N), rules: N.rules, platform: platform.name, price, profit, items, compare, plan, file, shipping_basis: N.shipping.basis, tax_note: N.tax_note };
    },
    view(out) {
      const kit = require('../../_kit');
      return views.blocks(
        views.metric('Your first 25 items', `${out.items.length} to look for`, `Math at ${usd(out.price)} on ${out.platform}, ${usd(out.profit)} profit each`),
        views.text(`Rules first: ${out.rules.join(' ')}`),
        kit.crowd.blocks(out.card),
        views.table(
          [
            { key: 'n', label: '#' },
            { key: 'item', label: 'Item' },
            { key: 'where', label: 'Where' },
            { key: 'weight', label: 'Ships as' },
            { key: 'max_text', label: 'Pay at most' },
            { key: 'check', label: 'Check sold prices', format: 'link' },
            { key: 'watch', label: 'Watch for' },
          ],
          out.items,
        ),
        views.table(
          [
            { key: 'platform', label: `A ${usd(out.price)} item, 1 lb` },
            { key: 'fee', label: 'Fee' },
            { key: 'keep', label: 'You keep' },
            { key: 'how', label: 'How the fee works' },
          ],
          out.compare,
        ),
        views.text(`Plan: ${out.plan.join(' ')}`),
        views.text(`${out.shipping_basis} ${out.tax_note}`),
        views.file(out.file, 'Your first 25 items (CSV)'),
      );
    },
  };
}

module.exports = { first25Tool, query, soldLink };
