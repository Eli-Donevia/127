// Turns your web design menu into the three options a proposal shows (fix list, one-page site with a
// care plan, small site with care plan plus) for sales.proposal, plus the chosen package as line items
// {label, detail, qty, unit, price} for sales.quote and sales.invoice.

const { views, quote, money, text, brain } = require('../../_kit');
const offer = require('../lib/offer');
const prices = require('../data/prices.json');
const niche = require('../data/niche.json');

const TERMS = 'The second half is due the day the site is live. You own your domain, hosting account and the finished site once it is paid in full; I keep the right to show it in my portfolio. Care plans are month to month: cancel any time before the next month. Small edits mean changes of about 30 minutes or less.';

module.exports = {
  name: 'webdesign.proposal_options',
  title: 'Turn your menu into options',
  description: 'Builds three proposal options from your web design prices (fix list, one-page site with a care plan, small site with care plan plus) and line items for a quote or invoice.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 15,
  input: {
    type: 'object',
    properties: {
      package: { type: 'string', enum: ['one_page', 'small_site', 'fix_list'], default: 'one_page', title: 'Package they want' },
      addons: { type: 'array', items: { type: 'string', enum: ['booking', 'gbp', 'email', 'extra_page'] }, title: 'Add-ons' },
      words: { type: 'string', enum: ['client', 'me'], default: 'client', title: 'Who writes the words' },
      position: { type: 'string', enum: ['budget', 'standard', 'premium'], title: 'Where you price in the market', description: 'Leave empty to use the position you saved with Your offer' },
      founding: { type: 'boolean', default: false, title: 'Founding client price' },
    },
  },
  output: { type: 'object', properties: { options: { type: 'array' }, items: { type: 'array' }, subtotal: { type: 'number' }, terms: { type: 'string' }, goals: { type: 'string' }, promise: { type: 'string' } }, required: ['options', 'items', 'terms'] },
  async run(input, ctx) {
    const saved = brain.packMemory(ctx, 'webdesign').offer || {};
    const o = offer.build({ position: input.position || saved.position || 'standard' });
    const off = input.founding ? niche.ladder.off : 0;
    const price = (p) => money.nicePrice(p * (1 - off));
    const pk = Object.fromEntries(o.menu.packages.map((p) => [p.id, p]));
    const [care, plus] = o.care;
    const options = [
      { name: `Small site, then ${money.usd(plus.price)} a month care`, price: price(pk.small_site.price), unit: 'project', summary: `Up to 5 pages, booking set up, then ${money.usd(plus.price)} a month for up to 5 small edits and a weekly Google post.`, includes: [...pk.small_site.includes, `${plus.label}: ${money.usd(plus.price)} a month, cancel any time`] },
      { name: `One-page site, then ${money.usd(care.price)} a month care`, price: price(pk.one_page.price), unit: 'project', summary: `Live in 14 days, then ${money.usd(care.price)} a month to keep it updated.`, includes: [...pk.one_page.includes, `${care.label}: ${money.usd(care.price)} a month, cancel any time`] },
      { name: 'Fix list on your current site', price: price(pk.fix_list.price), unit: 'project', summary: 'The top 5 fixes on the site you have now.', includes: pk.fix_list.includes },
    ];
    const q = quote.quote(o.menu, { package: input.package, factors: { words: input.words }, addons: input.addons || [] });
    const items = q.items.map((it) => ({ ...it, price: it.price > 0 ? price(it.price) : it.price, detail: it.detail ? text.clip(text.plain(it.detail), 300) : undefined }));
    if (input.founding) items.push({ label: 'Founding client price', detail: `${Math.round(off * 100)}% off for ${niche.ladder.ask}`, qty: 1, unit: 'each', price: 0 });
    const subtotal = items.reduce((n, it) => n + it.price * (it.qty || 1), 0);
    const goals = ['A website that works on a phone', 'A tap-to-call button and your hours where people look first', 'A way to book or ask for a quote online', 'Google can show your site under your name'].join('\n');
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
