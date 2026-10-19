// Turns your photography menu into the options a proposal shows, plus the chosen package as line items
// {label, detail, qty, unit, price} for sales.quote and sales.invoice. For a local business: a half
// day, a business shoot and the monthly session. For a real estate agent: listing photos (with aerials
// only when you say you hold the FAA certificate) and an agent headshot.

const { views, money, text, brain } = require('../../_kit');
const offer = require('../lib/offer');
const prices = require('../data/prices.json');
const niche = require('../data/niche.json');

const IDS = ['business_shoot', 'half_day', 'hour_shoot', 'monthly_session', 'headshots', 'listing'];
const USE = 'You get written permission to use the photos on your website, Google profile, social posts, menus and ads; I keep the copyright and may show them in my portfolio.';
const TERMS = {
  shoot: `The deposit holds your date; the rest is due when your gallery is ready. ${USE} If weather or a closure moves the shoot, the new date is free. Anyone shown up close agrees first.`,
  monthly: `Each month is paid at its start, month to month: stop any time before the next month. ${USE} Anyone shown up close agrees first.`,
  listing: 'The deposit holds your shoot date; the rest is due when your gallery is delivered. You and your brokerage may use the photos to market this listing; I keep the copyright and may show them in my portfolio. Aerial photos only by an FAA Part 107 certified pilot, where flying is allowed.',
};

module.exports = {
  name: 'photo.proposal_options',
  title: 'Turn your menu into options',
  description: 'Builds the proposal options from your photography prices (a half day, a business shoot and the monthly session; or listing photos and a headshot for an agent) and line items for a quote or invoice.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 15,
  input: {
    type: 'object',
    properties: {
      package: { type: 'string', enum: IDS, default: 'business_shoot', title: 'What they want' },
      people: { type: 'integer', minimum: 1, maximum: 60, default: 1, title: 'How many people for headshots' },
      addons: { type: 'array', items: { type: 'string', enum: ['extra_hour', 'drone'] }, title: 'Add-ons' },
      drone: { type: 'boolean', default: false, title: 'Aerial photos for listings', description: 'Only with your own FAA Part 107 certificate' },
      position: { type: 'string', enum: ['budget', 'standard', 'premium'], title: 'Where you price in the market', description: 'Leave empty to use the position you saved with Your offer' },
      founding: { type: 'boolean', default: false, title: 'Founding client price' },
    },
  },
  output: { type: 'object', properties: { title: { type: 'string' }, options: { type: 'array' }, items: { type: 'array' }, subtotal: { type: 'number' }, terms: { type: 'string' }, goals: { type: 'string' }, promise: { type: 'string' }, deposit: { type: 'string' } }, required: ['title', 'options', 'items', 'terms'] },
  async run(input, ctx) {
    const saved = brain.packMemory(ctx, 'photo').offer || {};
    const o = offer.build({ position: input.position || saved.position || 'standard' });
    const L = niche.ladder;
    const founding = (id) => !!input.founding && (L.applies_to || []).includes(id);
    const price = (id, p) => (founding(id) ? money.nicePrice(p * (1 - L.off)) : p);
    const pk = Object.fromEntries(o.menu.packages.map((p) => [p.id, p]));
    const ad = Object.fromEntries(o.menu.addons.map((a) => [a.id, a]));
    const [monthly] = o.care;
    const id = IDS.includes(input.package) ? input.package : 'business_shoot';
    const asked = [...(input.addons || []), ...(input.drone ? ['drone'] : [])];
    const addons = [...new Set(asked)].filter((a) => ad[a] && (a !== 'drone' || id === 'listing'));
    const agent = id === 'listing';
    const foundNote = (x) => (founding(x) ? ` Founding client price; the full price is ${money.usd(pk[x].price)}.` : '');
    const options = agent
      ? [
          addons.includes('drone') ? { name: 'Listing photos with aerials', price: pk.listing.price + ad.drone.price, unit: 'property', summary: '25 to 30 edited photos inside and out, plus aerial photos, in your gallery within 24 hours.', includes: [...pk.listing.includes, 'Aerial photos by an FAA Part 107 certified pilot, where flying is allowed'] } : null,
          { name: pk.listing.label, price: pk.listing.price, unit: 'property', summary: '25 to 30 edited photos inside and out, in your gallery within 24 hours.', includes: pk.listing.includes },
          { name: 'Agent headshot', price: pk.headshots.price, unit: 'person', summary: 'A headshot for your listings, cards and profile, 2 edited photos.', includes: pk.headshots.includes.slice(1) },
        ].filter(Boolean)
      : [
          { name: pk.half_day.label, price: price('half_day', pk.half_day.price), unit: 'project', summary: `Up to 4 hours: your work, your space, the outside and headshots for up to 6 people, 50 edited photos.${foundNote('half_day')}`, includes: pk.half_day.includes },
          { name: pk.business_shoot.label, price: price('business_shoot', pk.business_shoot.price), unit: 'project', summary: `Up to 2 hours at your place, 25 edited photos in your gallery within 3 days.${foundNote('business_shoot')}`, includes: pk.business_shoot.includes },
          { name: monthly.label, price: monthly.price, unit: 'month', summary: `${monthly.summary.charAt(0).toUpperCase()}${monthly.summary.slice(1)}. Month to month.`, includes: monthly.includes },
        ];
    // The chosen package as line items, the founding price as its own line.
    const items = [];
    const people = id === 'headshots' ? Math.max(1, Math.round(Number(input.people) || 1)) : 1;
    if (id === 'monthly_session') items.push({ label: `${monthly.label}, first month`, detail: text.clip(monthly.includes.join(', '), 300), qty: 1, unit: 'month', price: monthly.price });
    else items.push({ label: pk[id].label, detail: text.clip(pk[id].includes.join(', '), 300), qty: people, unit: pk[id].unit === 'shoot' ? 'project' : pk[id].unit, price: pk[id].price });
    for (const a of addons) items.push({ label: ad[a].label, qty: 1, unit: 'each', price: ad[a].price });
    if (founding(id)) items.push({ label: 'Founding client price', detail: text.clip(`${Math.round(L.off * 100)}% off, in exchange for ${L.ask}`, 300), qty: 1, unit: 'each', price: -(pk[id].price - price(id, pk[id].price)) });
    const subtotal = items.reduce((n, it) => n + it.price * (it.qty || 1), 0);
    const goals = (agent
      ? ['Photos that show the whole home in good light', 'In your gallery within 24 hours', 'Sized for the MLS and listing sites']
      : ['Photos of your own place, work and team, taken this month', 'Ready for your website, Google profile, posts and menus', 'In your gallery within 3 days', 'Written permission to use them where you sell']
    ).join('\n');
    const terms = agent ? TERMS.listing : id === 'monthly_session' ? TERMS.monthly : TERMS.shoot;
    const title = agent ? 'Listing photos that show the whole home' : 'Photos of your own place, work and team';
    // The member's own promise (Your offer), worded for a listing's 24 hours when it's for an agent.
    const promise = agent ? 'Your listing photos are in your online gallery within 24 hours of the shoot. If a photo isn\'t right, I edit it again free, and if weather moves the shoot, the new date costs nothing.' : o.promise;
    return { title, options, items, subtotal, terms, goals, promise, deposit: id === 'monthly_session' ? '100%' : '50%', founding: !!input.founding && founding(id), sources: prices.sources.slice(0, 3) };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'name', label: 'Option' }, { key: 'price', label: 'Price', format: 'money' }, { key: 'summary', label: 'What it is' }], out.options),
      views.text(`Terms on the proposal: ${out.terms}`)
    );
  },
};
