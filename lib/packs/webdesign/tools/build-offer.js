// Your offer: the offer builder for web design. Price menu at your position, care plans, the
// first-clients ladder, the money model with job math from your own numbers, and a printable
// one-page offer sheet in your colors.

const { views, save, brain, money, text, time } = require('../../_kit');
const offer = require('../lib/offer');
const { offerSheet, paletteOf } = require('../../_kit/b2b');

module.exports = {
  name: 'webdesign.build_offer',
  title: 'Build your web design offer',
  description: 'Prices your packages and care plans at your position from sourced market ranges, sets your first-clients ladder and money model, does the job math from your own numbers, and makes a one-page offer sheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 20,
  input: {
    type: 'object',
    properties: {
      position: { type: 'string', enum: ['budget', 'standard', 'premium'], default: 'standard', title: 'Where you price in the market' },
      hourly: { type: 'number', minimum: 0, maximum: 500, default: 25, title: 'What you pay yourself an hour' },
      monthly_costs: { type: 'number', minimum: 0, maximum: 10000, default: 0, title: 'Your tools and insurance a month' },
      spots: { type: 'integer', minimum: 1, maximum: 10, default: 3, title: 'Founding client spots' },
    },
  },
  output: { type: 'object', properties: { name: { type: 'string' }, menu: { type: 'object' }, care: { type: 'array' }, ladder: { type: 'object' }, model: { type: 'array' }, math: { type: 'array' }, sheet: { type: 'object' }, pitch: { type: 'string' } }, required: ['name', 'menu', 'care', 'ladder', 'model', 'math', 'sheet', 'pitch'] },
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const o = offer.build({ position: input.position, hourly: input.hourly, monthlyCosts: input.monthly_costs, spots: input.spots, town: br.city });
    const item = (x, per) => ({ label: x.label, price: x.price, per, includes: x.includes });
    const html = offerSheet({
      o,
      br,
      p: paletteOf(ctx),
      groups: [
        { h: 'Pick one', items: o.menu.packages.map((x) => item(x, '')) },
        { h: 'Keep it running', items: o.care.map((c) => item(c, 'a month')) },
      ],
      how: 'Day 1: you send your logo, photos and the words you have. Day 7: you see the first draft on your phone. Day 14: it is live on your own domain, in your own account.',
      asOf: time.today(ctx),
    });
    const sheetAsset = await save.saveFile(ctx, save.fileName(br.name || 'my', 'web-design-offer', '.html'), html);
    const one = o.menu.packages[0];
    const pitch = text.plain(`I build phone-ready websites for local businesses${br.city ? ` in ${br.city}` : ''}. A one-page site is ${money.usd(one.price)}, live in 14 days on your own domain, with a care plan at ${money.usd(o.care[0].price)} a month if you want me to keep it up to date. ${o.promise} I'm taking ${o.ladder.spots} founding clients at ${money.usd(o.ladder.prices[0].founding)} for an honest testimonial I can quote as a founding client.`);
    // Replies, call sheets and kickoffs read the member's prices from here.
    await brain.remember(ctx, 'offer', { position: o.position, spots: input.spots, saved: time.today(ctx), packages: o.menu.packages.map((x) => ({ id: x.id, label: x.label, price: x.price })), care: o.care.map((c) => ({ id: c.id, label: c.label, price: c.price })), founding: o.ladder.prices });
    return { ...o, sheet: sheetAsset, pitch };
  },
  view(out) {
    return views.blocks(
      views.text(`${out.name}. Priced at the ${out.position} point of the sourced ranges. Change any price; it's your business.`),
      views.table([{ key: 'label', label: 'Package' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'hours', label: 'Hours' }, { key: 'left', label: 'Left after your pay', format: 'money' }], out.math),
      views.table([{ key: 'step', label: 'Money model' }, { key: 'what', label: 'What' }, { key: 'price', label: 'Price' }], out.model),
      views.text(`First clients: ${out.ladder.prices.map((x) => `${x.label} ${money.usd(x.founding)} instead of ${money.usd(x.full)}`).join('; ')}, for ${out.ladder.spots} clients, in exchange for ${out.ladder.ask}. ${out.ladder.step_up} ${out.ladder.reviews_rule}`),
      views.text(`Your promise: ${out.promise}`),
      views.file(out.sheet, 'Your one-page offer sheet (print or send)'),
      views.copy('Your offer in one paragraph', out.pitch)
    );
  },
};
