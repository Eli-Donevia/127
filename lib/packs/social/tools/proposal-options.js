// Turns your social media menu into the three options a proposal shows (monthly posts with a shoot,
// monthly posts, a trial week) for sales.proposal, plus the chosen package as line items
// {label, detail, qty, unit, price} for sales.quote and sales.invoice.

const { views, money, text, brain } = require('../../_kit');
const offer = require('../lib/offer');
const prices = require('../data/prices.json');
const niche = require('../data/niche.json');

const TERMS = 'The deposit is the first month, paid before we start; after that each month is paid at its start. Month to month: stop any time before the next month. Nothing is posted without your yes. You own the posts and photos for your own accounts, website and menus; I may show them in my portfolio. Access is through partner access in Meta Business Suite and manager access on your Google profile, never a password.';
const IDS = ['trial_week', 'month', 'month_shoot', 'reels_pack', 'shoot_day'];

module.exports = {
  name: 'social.proposal_options',
  title: 'Turn your menu into options',
  description: 'Builds three proposal options from your social media prices (monthly posts with a shoot, monthly posts, a trial week) and line items for a quote or invoice.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 15,
  input: {
    type: 'object',
    properties: {
      package: { type: 'string', enum: IDS, default: 'month', title: 'What they want' },
      addons: { type: 'array', items: { type: 'string', enum: ['extra_post', 'ads'] }, title: 'Add-ons' },
      position: { type: 'string', enum: ['budget', 'standard', 'premium'], title: 'Where you price in the market', description: 'Leave empty to use the position you saved with Your offer' },
      founding: { type: 'boolean', default: false, title: 'Founding client price' },
    },
  },
  output: { type: 'object', properties: { options: { type: 'array' }, items: { type: 'array' }, subtotal: { type: 'number' }, terms: { type: 'string' }, goals: { type: 'string' }, promise: { type: 'string' } }, required: ['options', 'items', 'terms'] },
  async run(input, ctx) {
    const saved = brain.packMemory(ctx, 'social').offer || {};
    const o = offer.build({ position: input.position || saved.position || 'standard' });
    const L = niche.ladder;
    const founding = (id) => !!input.founding && (L.applies_to || []).includes(id);
    const price = (id, p) => (founding(id) ? money.nicePrice(p * (1 - L.off)) : p);
    const pk = Object.fromEntries(o.menu.packages.map((p) => [p.id, p]));
    const [month, plus] = o.care;
    const foundNote = (id) => (founding(id) ? ` Founding price for the first ${L.months} months, then ${money.usd(id === 'month' ? month.price : plus.price)} a month.` : '');
    const options = [
      { name: plus.label, price: price('month_shoot', plus.price), unit: 'month', summary: `A shoot at your place each month, 12 posts and 2 Reels, all approved by you first.${foundNote('month_shoot')}`, includes: plus.includes },
      { name: month.label, price: price('month', month.price), unit: 'month', summary: `3 posts a week on Instagram and Facebook, each one approved by you first.${foundNote('month')}`, includes: month.includes },
      { name: pk.trial_week.label, price: pk.trial_week.price, unit: 'project', summary: 'See the style for one week before any monthly plan.', includes: pk.trial_week.includes },
    ];
    const id = IDS.includes(input.package) ? input.package : 'month';
    const plan = o.care.find((c) => c.id === id);
    const items = [];
    if (plan) items.push({ label: `${plan.label}, first month`, detail: text.clip(plan.includes.join(', '), 300), qty: 1, unit: 'month', price: plan.price });
    else items.push({ label: pk[id].label, detail: text.clip(pk[id].includes.join(', '), 300), qty: 1, unit: 'project', price: pk[id].price });
    for (const a of input.addons || []) {
      const ad = o.menu.addons.find((x) => x.id === a);
      if (ad) items.push({ label: ad.label, qty: 1, unit: ad.unit === 'month' ? 'month' : 'each', price: ad.price });
    }
    if (plan && founding(id)) items.push({ label: 'Founding client price', detail: `${Math.round(L.off * 100)}% off for the first ${L.months} months, for ${L.ask}`, qty: 1, unit: 'each', price: -(plan.price - price(id, plan.price)) });
    const subtotal = items.reduce((n, it) => n + it.price * (it.qty || 1), 0);
    const goals = ['Posts of your own food every week', 'Nothing goes out without your yes', 'One goal a month we both count, like a slow night', 'Your Google profile and Instagram show what a visit is like today'].join('\n');
    // The member's own promise from Your offer, so the proposal says what the offer sheet says.
    return { options, items, subtotal, terms: TERMS, goals, promise: o.promise, founding: !!input.founding, sources: prices.sources.slice(0, 3) };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'name', label: 'Option' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'summary', label: 'What it is' }], out.options),
      views.text(`Terms on the proposal: ${out.terms}`)
    );
  },
};
