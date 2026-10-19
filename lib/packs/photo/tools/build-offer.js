// Your offer: the offer builder for photography. The shoots, the monthly photo session, headshots and
// listing photos, priced at your position from sourced ranges, the first-clients ladder, the money
// model with job math from your own numbers, and a printable one-page offer sheet in your colors.

const { views, save, brain, money, text, time } = require('../../_kit');
const offer = require('../lib/offer');
const { offerSheet, paletteOf, foundingText } = require('../../_kit/b2b');

module.exports = {
  name: 'photo.build_offer',
  title: 'Build your photography offer',
  description: 'Prices your business shoot, half day, one-hour shoot, monthly session, headshots and listing photos at your position from sourced market ranges, sets your first-clients ladder and money model, does the job math from your own numbers, and makes a one-page offer sheet.',
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
      monthly_costs: { type: 'number', minimum: 0, maximum: 10000, default: 0, title: 'Your gear, editing software and insurance a month' },
      spots: { type: 'integer', minimum: 1, maximum: 10, default: 3, title: 'Founding client spots' },
    },
  },
  output: { type: 'object', properties: { name: { type: 'string' }, menu: { type: 'object' }, care: { type: 'array' }, ladder: { type: 'object' }, model: { type: 'array' }, math: { type: 'array' }, sheet: { type: 'object' }, pitch: { type: 'string' } }, required: ['name', 'menu', 'care', 'ladder', 'model', 'math', 'sheet', 'pitch'] },
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const o = offer.build({ position: input.position, hourly: input.hourly, monthlyCosts: input.monthly_costs, spots: input.spots, town: br.city });
    const pk = Object.fromEntries(o.menu.packages.map((p) => [p.id, p]));
    const item = (p) => ({ label: p.label, price: p.price, per: offer.per(p.unit), includes: p.includes });
    const html = offerSheet({
      o,
      br,
      p: paletteOf(ctx),
      groups: [
        { h: 'Pick a shoot', items: [pk.business_shoot, pk.half_day, pk.hour_shoot].map(item) },
        { h: 'Fresh photos every month', items: o.care.map((c) => ({ label: c.label, price: c.price, per: 'a month', includes: c.includes })) },
        { h: 'Headshots and listings', items: [pk.headshots, pk.listing].map(item) },
      ],
      how: 'Before the shoot we agree a short shot list from what your website and Google profile show today. I shoot at your place in good light, and your edited photos are in an online gallery within 3 days, with written permission to use them where you sell.',
      asOf: time.today(ctx),
    });
    const sheet = await save.saveFile(ctx, save.fileName(br.name || 'my', 'photography-offer', '.html'), html);
    const [monthly] = o.care;
    const pitch = text.plain(`I take photos for local businesses${br.city ? ` in ${br.city}` : ''}. A business shoot is ${money.usd(pk.business_shoot.price)}: up to 2 hours at your place and 25 edited photos, sized for your website, Google profile, posts and menus. After that, a monthly photo session is ${money.usd(monthly.price)} a month for 10 new photos. ${o.promise} I'm taking ${o.ladder.spots} founding clients: ${foundingText(o)}, for an honest testimonial I can quote as a founding client.`);
    // Replies, call sheets and kickoffs read the member's prices from here.
    await brain.remember(ctx, 'offer', { position: o.position, spots: input.spots, saved: time.today(ctx), packages: o.menu.packages.map((x) => ({ id: x.id, label: x.label, price: x.price, unit: x.unit })), care: o.care.map((c) => ({ id: c.id, label: c.label, price: c.price })), founding: o.ladder.prices });
    return { ...o, sheet, pitch };
  },
  view(out) {
    return views.blocks(
      views.text(`${out.name}. Priced at the ${out.position} point of the sourced ranges. Change any price; it's your business.`),
      views.table([{ key: 'label', label: 'Shoot or plan' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'hours', label: 'Hours' }, { key: 'left', label: 'Left after your pay', format: 'money' }], out.math),
      views.table([{ key: 'step', label: 'Money model' }, { key: 'what', label: 'What' }, { key: 'price', label: 'Price' }], out.model),
      views.text(`First clients: ${foundingText(out, { all: true })}, for ${out.ladder.spots} clients, in exchange for ${out.ladder.ask}. ${out.ladder.step_up} ${out.ladder.reviews_rule}`),
      views.text(`Your promise: ${out.promise}`),
      views.file(out.sheet, 'Your one-page offer sheet (print or send)'),
      views.copy('Your offer in one paragraph', out.pitch)
    );
  },
};
