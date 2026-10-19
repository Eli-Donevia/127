// Your offer: the offer builder for social media. The monthly plans and the smaller ways to start,
// priced at your position from sourced ranges, the first-clients ladder, the money model with job
// math from your own numbers, and a printable one-page offer sheet in your colors.

const { views, save, brain, money, text, time } = require('../../_kit');
const offer = require('../lib/offer');
const { offerSheet, paletteOf, foundingText } = require('../../_kit/b2b');

module.exports = {
  name: 'social.build_offer',
  title: 'Build your social media offer',
  description: 'Prices your monthly plans, trial week, Reels and shoot at your position from sourced market ranges, sets your first-clients ladder and money model, does the job math from your own numbers, and makes a one-page offer sheet.',
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
    const html = offerSheet({
      o,
      br,
      p: paletteOf(ctx),
      groups: [
        { h: 'Pick a plan', items: o.care.map((c) => ({ label: c.label, price: c.price, per: 'a month', includes: c.includes })) },
        { h: 'Or start smaller', items: o.menu.packages.map((x) => ({ label: x.label, price: x.price, per: 'one time', includes: x.includes })) },
      ],
      how: 'Week 1: we pick one goal for the month (a slow night, a new dish) and I take photos at your place before service. Every post comes to you for a yes before it goes out. At month end you get one page with what we both counted.',
      asOf: time.today(ctx),
    });
    const sheet = await save.saveFile(ctx, save.fileName(br.name || 'my', 'social-media-offer', '.html'), html);
    const [month] = o.care;
    const trial = o.menu.packages.find((x) => x.id === 'trial_week');
    const pitch = text.plain(`I make social media posts for restaurants and cafes${br.city ? ` in ${br.city}` : ''}. Monthly posts are ${money.usd(month.price)} a month: 3 posts a week of your own food on Instagram and Facebook, month to month. Or start with a trial week of 3 posts for ${money.usd(trial.price)}. ${o.promise} I'm taking ${o.ladder.spots} founding clients: ${foundingText(o)}, for an honest testimonial I can quote as a founding client.`);
    // Replies, call sheets and kickoffs read the member's prices from here.
    await brain.remember(ctx, 'offer', { position: o.position, spots: input.spots, saved: time.today(ctx), packages: o.menu.packages.map((x) => ({ id: x.id, label: x.label, price: x.price })), care: o.care.map((c) => ({ id: c.id, label: c.label, price: c.price })), founding: o.ladder.prices });
    return { ...o, sheet, pitch };
  },
  view(out) {
    return views.blocks(
      views.text(`${out.name}. Priced at the ${out.position} point of the sourced ranges. Change any price; it's your business.`),
      views.table([{ key: 'label', label: 'Plan or package' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'hours', label: 'Hours' }, { key: 'left', label: 'Left after your pay', format: 'money' }], out.math),
      views.table([{ key: 'step', label: 'Money model' }, { key: 'what', label: 'What' }, { key: 'price', label: 'Price' }], out.model),
      views.text(`First clients: ${foundingText(out, { all: true })}, for ${out.ladder.spots} clients, in exchange for ${out.ladder.ask}. ${out.ladder.step_up} ${out.ladder.reviews_rule}`),
      views.text(`Your promise: ${out.promise}`),
      views.file(out.sheet, 'Your one-page offer sheet (print or send)'),
      views.copy('Your offer in one paragraph', out.pitch)
    );
  },
};
