// Good, better and best prices from the member's own costs and time, with opening prices for the
// first customers and a calculator sheet with working formulas. Per job, never income totals.

const { views, save, brain } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const pricing = require('../lib/pricing');
const docs = require('../lib/docs');

module.exports = {
  name: 'offer.price_tiers',
  title: 'Price my offer',
  description: 'Sets good, better and best prices from the member supplies, time and card fees, with opening prices, scripts and a calculator sheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', maxLength: 200 },
      price: { type: 'number', title: 'Your price now (optional)', minimum: 0 },
      cost: { type: 'number', title: 'Supplies per job', minimum: 0 },
      hours: { type: 'number', title: 'Hours per job', minimum: 0 },
      perHour: { type: 'number', title: 'What your hour is worth', minimum: 0 },
      competitors: { type: 'string', title: 'Prices you have seen nearby (optional)', maxLength: 200 },
      payWith: { type: 'string', enum: ['square_in_person', 'square_online', 'stripe_online', 'paypal_checkout', 'venmo_business', 'cash'] },
    },
  },
  output: { type: 'object', properties: { tiers: { type: 'array' }, floor: { type: 'number' }, ladder: { type: 'array' }, scripts: { type: 'array' }, warnings: { type: 'array' }, files: { type: 'array' } }, required: ['tiers'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const saved = brain.packMemory(ctx, 'offer').offer || {};
    const pr = pricing.build(f, { payWith: input.payWith, perHour: input.perHour, competitors: input.competitors, parts: [] });
    const name = f.business || f.whatShort;
    const files = [
      await save.saveFile(ctx, save.fileName(name, 'price menu', '.html'), docs.priceMenuHtml(pr, f, saved.name)),
      await save.saveFile(ctx, save.fileName(name, 'price calculator', '.csv'), pricing.csv(pr, f)),
    ];
    ctx.log(`Better price ${pr.better}, floor ${pr.floorNice}`);
    return { tiers: pr.tiers.map((t) => ({ key: t.key, name: t.name, price: t.price, kept: t.kept, keptPerHour: t.keptPerHour, includes: t.includes })), floor: pr.floorNice, basis: pr.basis, ladder: pr.ladder.map((l) => ({ who: l.who, price: l.price, ask: l.ask })), scripts: pr.scripts, warnings: pr.warnings, files };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'name', label: 'Option' }, { key: 'price', label: 'Price' }, { key: 'kept', label: 'You keep per job' }, { key: 'keptPerHour', label: 'Per hour' }], out.tiers),
      views.metric('Lowest price that still pays you', docs.usd(out.floor), out.basis || ''),
      views.table([{ key: 'who', label: 'Who' }, { key: 'price', label: 'Price' }, { key: 'ask', label: 'Note' }], out.ladder),
      (out.warnings || []).slice(0, 3).map((w) => views.text(w)),
      out.scripts.slice(0, 4).map((s) => views.copy(s.label, s.text)),
      out.files.map((x) => views.file(x)),
    );
  },
};
