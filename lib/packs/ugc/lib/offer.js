// The member's UGC prices in one place: the per-video price at their level (or their own), the three
// packages a brand can say yes to, the add-ons, the founding terms for their first 3 brands, the use
// in plain words and the disclosure lines. Every tool that says a price reads it here, so a reply,
// the call card, the brief and the month-end report quote the same numbers. Prices are what a brand
// pays the member for one job, never a total of what anyone will earn.

const kit = require('../../_kit');
const { money, brain, text } = kit;
const U = require('./ugc');
const NICHE = require('../data/niche.json');

const RATES = U.RATES;
const RULES = U.RULES;
const LEVELS = Object.keys(RATES.levels);
const usd = (n) => money.usd(n);

// What the member saved from "Your offer" (brain.packs.ugc.offer), when there is one.
function remembered(ctx) {
  const m = brain.packMemory(ctx, 'ugc');
  return m && m.offer && typeof m.offer === 'object' ? m.offer : {};
}

// input: { level, price }. A typed price wins, then the saved offer (unless useSaved is false, as in
// "Your offer" itself), then the level's price in data/rates.json.
function offerNumbers(input = {}, ctx, { useSaved = true } = {}) {
  const saved = useSaved ? remembered(ctx) : {};
  const level = LEVELS.includes(input.level) ? input.level : LEVELS.includes(saved.level) ? saved.level : 'new';
  const typed = money.num(input.price, null);
  const video = typed != null && typed >= 30 ? Math.round(typed) : Number(saved.video) >= 30 ? Math.round(Number(saved.video)) : RATES.levels[level].video;
  const card = U.rateCard(level, { base: video });
  const add = Object.fromEntries(card.addons.map((a) => [a.id, a]));
  const price = (id) => (add[id] ? add[id].price : 0);
  const each = card.bundle.each;
  const starter = 3 * (video + price('hook') + price('ads30'));
  const founding = Math.max(30, Math.min(video, money.nicePrice(video * NICHE.first_clients.founding_share)));
  const packages = [
    {
      id: 'test',
      name: 'Test video',
      price: video,
      unit: 'one time',
      per: '',
      videos: 1,
      goodFor: 'Trying a creator for the first time',
      includes: ['One video, 15 to 60 seconds, for one product', 'Captions and a clean version without text', 'Organic use on your own accounts, site and emails', 'One round of edits'],
    },
    {
      id: 'starter',
      name: 'Ad starter',
      price: starter,
      unit: 'one time',
      per: '',
      videos: 3,
      goodFor: 'Testing ads on one product',
      includes: ['3 videos, 15 to 60 seconds', 'An extra hook on each: a new first 3 seconds to test', '30 days of paid ad use on all 3', 'Captions and clean versions, one round of edits'],
    },
    {
      id: 'monthly',
      name: 'Monthly',
      price: each * card.bundle.videos,
      unit: 'month',
      per: 'a month',
      videos: card.bundle.videos,
      each,
      goodFor: 'A steady stream of new videos',
      includes: [`${card.bundle.videos} new videos every month, ${usd(each)} each`, 'Organic use, with ad use added per video', 'A short report at the end of each month', "Stop any month, before the next month's bill"],
    },
  ];
  return {
    level,
    levelLabel: RATES.levels[level].label,
    video,
    each,
    starter,
    monthly: each * card.bundle.videos,
    founding,
    hook: price('hook'),
    raw: price('raw'),
    ads30: price('ads30'),
    ads90: price('ads90'),
    whitelist: price('whitelist'),
    rush: price('rush'),
    card,
    packages,
    turnaround: RATES.defaults.turnaround_days,
    saved: !!Object.keys(saved).length,
    savedOn: saved.saved || '',
  };
}

const pkgOf = (n, id) => n.packages.find((p) => p.id === id) || n.packages[0];
const priceText = (p) => `${usd(p.price)}${p.per ? ` ${p.per}` : ''}`;

// The price, said once. founding: true while the member has fewer than 3 paying brands.
function priceSay(n, { founding = false } = {}) {
  const base = `One video is ${usd(n.video)}: 15 to 60 seconds, with captions, a clean version and organic use on your own accounts, site and emails. Three videos with an extra hook each and 30 days of ad use are ${usd(n.starter)}, and ${n.card.bundle.videos} new videos a month are ${usd(n.monthly)} a month.`;
  const found = founding ? `You'd be one of my first ${NICHE.first_clients.founding_count} brands, so the first video is ${usd(n.founding)} instead of ${usd(n.video)}. All I ask is ${NICHE.first_clients.ask}.` : '';
  const addons = `Extra hooks are ${usd(n.hook)} each, raw footage ${usd(n.raw)} a video, and 30 days of ad use ${usd(n.ads30)} a video.`;
  const short = `One video is ${usd(n.video)}, with captions, a clean version and organic use.`;
  return { base, founding: found, addons, short };
}

// Three options with the package picked in the middle, where sales.proposal and sales.call_script
// put their recommendation: a bigger version of it above and a smaller step below. Every option is
// built from the member's own packages and add-ons. founding: the test video at the founding price.
function ladder(n, pick = 'starter', { founding = false } = {}) {
  const test = pkgOf(n, 'test');
  const starter = pkgOf(n, 'starter');
  const monthly = pkgOf(n, 'monthly');
  const T = { id: 'test', name: test.name, price: founding ? n.founding : n.video, unit: 'one time', summary: founding ? `${test.goodFor}. Founding price for my first ${NICHE.first_clients.founding_count} brands (normally ${usd(n.video)}).` : `${test.goodFor}.`, includes: test.includes };
  const S = { id: 'starter', name: starter.name, price: starter.price, unit: 'one time', summary: `${starter.goodFor}.`, includes: starter.includes };
  const M = { id: 'monthly', name: monthly.name, price: monthly.price, unit: 'month', summary: `${monthly.goodFor}. Stop any month.`, includes: monthly.includes };
  if (pick === 'monthly') {
    const v = monthly.videos * 2;
    return [{ id: 'monthly2', name: `Monthly, ${v} videos`, price: n.each * v, unit: 'month', summary: 'Twice the videos, for more products or more ads to test. Stop any month.', includes: [`${v} new videos every month, ${usd(n.each)} each`, ...monthly.includes.slice(1)] }, M, T];
  }
  if (pick === 'test') {
    return [S, T, { id: 'hook', name: 'New hooks', price: n.hook, unit: 'one time', summary: 'Already have videos? A new first 3 seconds on one of them, to test in ads.', includes: [`A new first 3 seconds on a video you already have, ${usd(n.hook)} each`, 'Captions and a clean version', 'The same use as the video'] }];
  }
  return [{ id: 'starter90', name: `${starter.name}, 90 days`, price: 3 * (n.video + n.hook + n.ads90), unit: 'one time', summary: 'The ad starter with 90 days of ad use instead of 30.', includes: ['3 videos, 15 to 60 seconds', 'An extra hook on each: a new first 3 seconds to test', '90 days of paid ad use on all 3', 'Captions and clean versions, one round of edits'] }, S, T];
}

// For sales.proposal.
function proposalOptions(n, pick = 'starter', opts = {}) {
  return ladder(n, pick, opts).map((o) => ({ name: o.name, price: o.price, unit: o.unit, summary: o.summary, includes: o.includes }));
}

// For sales.call_script (typed lines: "Name | price/unit | include; include").
function optionsText(n, pick = 'starter', opts = {}) {
  return ladder(n, pick, opts)
    .map((o) => `${o.name} | $${o.price}${o.unit === 'month' ? '/month' : ''} | ${o.includes.join('; ')}`)
    .join('\n');
}

// For sales.quote: the package the brand picked, as line items.
function quoteItems(n, id = 'starter', { founding = false } = {}) {
  const p = pkgOf(n, id);
  if (p.id === 'test') return [{ label: 'UGC video, 15 to 60 seconds', detail: founding ? `Founding price for my first ${NICHE.first_clients.founding_count} brands (normally ${usd(n.video)}). Captions, clean version, organic use, one round of edits.` : 'Captions, clean version, organic use, one round of edits', qty: 1, unit: 'video', price: founding ? n.founding : n.video, taxable: false }];
  if (p.id === 'starter')
    return [
      { label: 'UGC video, 15 to 60 seconds', detail: 'Captions, clean version, organic use, one round of edits', qty: 3, unit: 'video', price: n.video, taxable: false },
      { label: 'Extra hook (new first 3 seconds)', detail: 'One on each video', qty: 3, unit: 'hook', price: n.hook, taxable: false },
      { label: 'Paid ad use, 30 days', detail: 'From the first day you spend on the ad', qty: 3, unit: 'video', price: n.ads30, taxable: false },
    ];
  return [{ label: `Monthly: ${p.videos} new videos`, detail: `${usd(n.each)} a video. Organic use, captions and clean versions, a short report at month end. Stop any month.`, qty: 1, unit: 'month', price: p.price, taxable: false }];
}

// The use in plain words for one brand. Paid ad use is always explained (it says ads need it bought);
// whitelisting and raw footage only when they are part of the job.
function usageFor(brand = 'the brand', { whitelist = false, raw = false } = {}) {
  return U.terms(brand).filter((t) => (t.id !== 'whitelist' || whitelist) && (t.id !== 'raw' || raw));
}

// The FTC lines, filled for one brand.
function disclosureFor(brand = 'Brand name') {
  const d = RULES.disclosure;
  return {
    caption: text.fill(d.caption, { brand }),
    spoken: text.fill(d.spoken, { brand }),
    gifted: d.gifted,
    brandPosts: text.fill(d.brand_posts, { brand }),
    setting: d.setting,
    why: d.why,
    sources: d.sources || [],
  };
}

module.exports = { LEVELS, remembered, offerNumbers, pkgOf, priceText, priceSay, ladder, proposalOptions, optionsText, quoteItems, usageFor, disclosureFor };
