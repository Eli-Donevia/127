// The member's offer to gyms. Built on the value equation: what the owner wants (people walking in
// for a first class, not "content"), how likely it feels (a sample made for their gym, a promise),
// how fast (first Reels within 7 days) and how little effort (one short shoot a month). Then extras
// that each answer one objection, a promise the member chooses, three packages named by the job they
// do (the biggest shown first), and a first-clients ladder: a few case studies, then a price that
// steps up after every few wins until full price.
// Scarcity and urgency are real or absent: exclusivity is enforced against the member's own clients
// (pipeline.conflictFor) and each ladder price ends by itself once its spots are won.

const { plain, money } = require('./util');
const { DEFAULT_PRICE } = require('./pricing');

const BONUSES = {
  homepage: { title: 'A homepage class video, in month one', does: 'Shows a first-timer what a class looks like before they book.', gaps: ['site-video'] },
  offer_ads: { title: '3 ad cuts of your intro offer, in month one', does: 'Ready for Meta ads the day you want to run them.', gaps: ['ads', 'offer'] },
  tracking: { title: 'A tracked link and QR code for your intro offer', does: 'So we both see how many sign-ups the videos bring in.', gaps: [] },
  coach_intros: { title: 'Coach intro videos', does: 'Puts faces to the names on your team page.', gaps: ['coaches'] },
  member_story: { title: 'A member story each month, with their OK', does: 'Real people, for the first-timer who is nervous to walk in.', gaps: ['stories'] },
  calendar: { title: 'Captions and a posting calendar', does: 'Posting takes you two minutes a day.', gaps: ['quiet', 'reels'] },
  google: { title: 'Videos for your Google Business Profile', does: 'Shows the gym to people looking you up on Google Maps.', gaps: [] },
};
const DEFAULT_BONUSES = ['homepage', 'offer_ads', 'tracking'];

// The member's promise to the gym (the field is still called "guarantee" in the saved offer). Only what the
// member controls: the work and its dates. Never views, members or sign-ups.
const GUARANTEES = {
  love_it: (o) => `If you don't love the first 3 Reels, you don't pay for the month.`,
  on_time: (o) => `${o.reels} Reels every month, delivered on time, or that month is free.`,
  both: (o) => `If you don't love the first 3 Reels, you don't pay for the month. After that, ${o.reels} Reels every month, on time, or that month is free.`,
  none: () => null,
};
// The words a member picks from on HQ's form, which shows a pick-one's values as they are. The tool takes
// either the words or the keys, and the saved offer keeps the keys.
const PROMISE_CHOICES = { love_it: "Love the first 3 Reels or don't pay", on_time: 'On time every month or that month is free', both: 'Both of those', none: 'No promise' };
const LADDER_CHOICES = { case_study: 'Free case studies first', founding: 'A founding price first', none: 'Full price from the start' };
const choiceKey = (choices, v) => (Object.prototype.hasOwnProperty.call(choices, v) ? v : Object.keys(choices).find((k) => choices[k] === v));

// What it takes to keep each promise. Shown to the member, never to the gym.
const PROMISE_KEEP = {
  love_it: 'Easy to keep: the worst case is one unpaid month if the work misses.',
  on_time: 'Only offer this if you can deliver every batch on schedule, sick days included.',
  both: 'Only offer this if you can deliver every batch on schedule.',
  none: 'No promise is fine. A sample made for their gym already lowers the risk for them.',
};

// Packages, named by the job they do for the gym. Shown biggest first.
const PACKAGES = {
  premium: { name: 'Fill your next intro offer', short: 'Everything in "Show what a class feels like", plus new ads for your intro offer and a member story every month' },
  core: { name: 'Show what a class feels like', short: 'One shoot a month and a steady stream of Reels' },
  clips: { name: 'Your clips, made into Reels', short: 'You film on your phone with my shot list, I edit' },
};
const UPSELLS = {
  challenge_ads: { name: 'Ads for your next challenge or intro offer', what: '3 short ad cuts, each with a different first line' },
  site_video: { name: 'A new homepage class video', what: '30 to 60 seconds of a real class, for the top of your website' },
  member_story: { name: 'Turn members into your ads', what: 'A short video of one member, with their OK' },
};

// First-clients ladder: price for each rung as a share of full price, never below the member's floor.
const LADDERS = {
  case_study: ['case_study', 'founding', 'early', 'full'],
  founding: ['founding', 'early', 'full'],
  none: ['full'],
};
const RUNG = {
  case_study: { label: 'Case study', pct: 0.5, freeMonth: true },
  founding: { label: 'Founding', pct: 0.5 },
  early: { label: 'Early', pct: 0.75 },
  full: { label: 'Full price', pct: 1 },
};

const roundTo = (n, step) => Math.round(n / step) * step;
const ceilTo = (n, step) => Math.ceil(n / step) * step;

function median(nums) {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// What one new member is worth to the gyms the member will pitch: from their own website prices
// when we have them, else the placeholder by kind of gym. Used for the pitch math, labeled as "if".
function memberValueFor(rows, stayMonths) {
  const prices = (rows || []).map((r) => (r.site && Number.isFinite(r.site.monthlyPrice) ? r.site.monthlyPrice : DEFAULT_PRICE[(r.gym && r.gym.category) || 'other'] || DEFAULT_PRICE.other));
  const p = median(prices) || 120;
  return { memberPrice: Math.round(p), memberValue: Math.round(p * stayMonths), fromSites: (rows || []).filter((r) => r.site && Number.isFinite(r.site.monthlyPrice)).length };
}

function clampInt(v, lo, hi, dflt) {
  if (v == null || v === '') return dflt;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}

// Hours, floors and full prices for the three packages.
function packagePrices({ reels, shootMinutes, rate, perReel, memberValue }) {
  const shootH = shootMinutes / 60 + 1.5; // the shoot, travel and setup
  const coreHours = reels * perReel + shootH + 1; // plus an hour of admin
  const premHours = coreHours + 3 * perReel + 2 + 1; // ad cuts, a member story, a quarterly homepage video
  const clipsHours = 8 * perReel + 0.5 + 1; // shot list and admin, no shoot
  const coreFull = Math.max(roundTo(Math.max(coreHours * rate * 1.6, memberValue * 0.5), 50), roundTo(coreHours * rate, 50) + 50);
  const premFull = Math.max(roundTo(coreFull * 1.5, 50), roundTo(premHours * rate * 1.6, 50), coreFull + 200);
  const clipsFull = Math.max(100, Math.min(Math.max(roundTo(clipsHours * rate * 1.4, 50), roundTo(coreFull * 0.5, 50)), coreFull - 100));
  return {
    premium: { hours: premHours, floor: premHours * rate, full: premFull, reels: reels + 3 },
    core: { hours: coreHours, floor: coreHours * rate, full: coreFull, reels },
    clips: { hours: clipsHours, floor: clipsHours * rate, full: clipsFull, reels: 8 },
  };
}

function ladderFor(kind, size, pk) {
  const at = (p, pct) => (pct >= 1 ? p.full : Math.min(p.full, Math.max(ceilTo(p.floor, 50), roundTo(p.full * pct, 50))));
  const rungs = [];
  for (const id of LADDERS[kind] || LADDERS.case_study) {
    const r = RUNG[id];
    const prices = { premium: at(pk.premium, r.pct), core: at(pk.core, r.pct), clips: at(pk.clips, r.pct) };
    const prev = rungs[rungs.length - 1];
    // When the floor pulls two steps to the same price, they become one step with more spots.
    if (prev && !prev.freeMonth && !r.freeMonth && prev.prices.core === prices.core) {
      if (id === 'full') {
        prev.id = 'full';
        prev.label = RUNG.full.label;
        prev.slots = null;
        prev.prices = prices;
      } else prev.slots += size;
      continue;
    }
    rungs.push({ id, label: r.label, slots: id === 'full' ? null : size, freeMonth: !!r.freeMonth, prices });
  }
  return rungs;
}

// Where the member is on the ladder after `won` clients.
function rungFor(ladder, won) {
  let n = Math.max(0, Number(won) || 0);
  for (let i = 0; i < ladder.length; i++) {
    const r = ladder[i];
    if (r.slots == null || n < r.slots) return { ...r, index: i, left: r.slots == null ? null : r.slots - n, next: ladder[i + 1] || null };
    n -= r.slots;
  }
  const last = ladder[ladder.length - 1];
  return { ...last, index: ladder.length - 1, left: null, next: null };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

// The price, urgency and case-study terms for the rung the member is on now. Used when the offer is
// built and again every time it's read, so a logged win moves the next gym's price by itself.
function atRung(offer, won) {
  const ladder = offer.ladder && offer.ladder.length ? offer.ladder : [{ id: 'full', label: 'Full price', slots: null, prices: { core: offer.price.monthly } }];
  const r = rungFor(ladder, won);
  const core = r.prices.core;
  const full = offer.price.monthly;
  const setup = r.id === 'full' ? offer.price.setupFull || 0 : 0;
  const after = r.next ? r.next.prices.core : null;
  let label;
  let urgency = null;
  let caseStudy = null;
  if (r.freeMonth) {
    label = `First month free as one of my ${plural(r.slots, 'case-study gym')} (${r.left} left), then ${money(core)} a month if you keep going. No setup fee.`;
    urgency = { text: `I'm taking on ${r.slots} gyms this month for free, as case studies, because that's all I can do well.`, slots: r.slots, left: r.left };
    caseStudy = {
      script: plain(
        `I'm taking on ${r.slots} gyms this month for free, as case studies, because that's all I can do well. In return, you post the Reels and tell me honestly what works and what doesn't. If you like them, I'd ask to share the results as a case study, only with your OK.`
      ),
      terms: [
        `First month free: one shoot and ${offer.reels || 12} Reels.`,
        `After that, ${money(core)} a month if you want to keep going. No contract.`,
        'You post the Reels and tell me honestly what works.',
        'I share results or your name only with your OK.',
      ],
    };
  } else if (r.id !== 'full') {
    const nextGyms = r.left === 1 ? 'my next gym' : `my next ${r.left} gyms`;
    label = `${money(core)} a month, locked in for as long as you stay. That price is for ${nextGyms} only, then it's ${money(after || full)}. No setup fee.`;
    urgency = { text: `This price is for ${nextGyms} only, then it goes to ${money(after || full)}.`, slots: r.slots, left: r.left };
  } else {
    label = `${money(core)} a month${setup ? `, plus ${money(setup)} to set up` : ''}`;
  }
  return {
    ...offer,
    urgency,
    caseStudy,
    price: {
      ...offer.price,
      current: core,
      firstMonthFree: !!r.freeMonth,
      setup,
      rung: { id: r.id, label: r.label, slots: r.slots, left: r.left, index: r.index },
      next: r.next ? { id: r.next.id, label: r.next.label, monthly: r.next.prices.core } : null,
      packages: r.prices,
      founding: offer.price.founding,
      label: plain(label),
    },
  };
}

// input: { city, firstName, business, reels=12, shootMinutes=45, hourlyRate=35, editHoursPerReel=0.75,
//          guarantee='love_it', ladder='case_study', ladderSize=3, setupFee (number, or empty for auto),
//          exclusivityMiles=3, bonuses, name, rows (ranked gyms), won=0 }
// foundingSlots (older input): 0 means no ladder, any other number is the ladder size, starting at founding.
function buildOffer(input = {}) {
  const reels = clampInt(input.reels, 4, 30, 12);
  const shootMinutes = clampInt(input.shootMinutes, 30, 180, 45);
  const rate = Number(input.hourlyRate) > 0 ? Number(input.hourlyRate) : 35;
  const perReel = Number(input.editHoursPerReel) > 0 ? Number(input.editHoursPerReel) : 0.75;
  const stayMonths = Number(input.stayMonths) > 0 ? Number(input.stayMonths) : 8;
  const city = input.city ? String(input.city).split(',')[0].trim() : '';
  const won = Math.max(0, Number(input.won) || 0);
  const miles = Math.max(0, Math.min(25, Number(input.exclusivityMiles == null ? 3 : input.exclusivityMiles)));
  const ladderIn = choiceKey(LADDER_CHOICES, input.ladder);
  let ladderKind = LADDERS[ladderIn] ? ladderIn : 'case_study';
  let size = clampInt(input.ladderSize, 1, 10, 3);
  if (input.ladder == null && input.foundingSlots != null && input.foundingSlots !== '') {
    const fs = clampInt(input.foundingSlots, 0, 10, 3);
    ladderKind = fs === 0 ? 'none' : 'founding';
    size = Math.max(1, fs);
  }

  const value = memberValueFor(input.rows, stayMonths);
  const pk = packagePrices({ reels, shootMinutes, rate, perReel, memberValue: value.memberValue });
  const ladder = ladderFor(ladderKind, size, pk);
  const setupAuto = Math.max(100, roundTo((shootMinutes / 60 + 1.5 + 1) * rate * 2, 50));
  const setupFull = input.setupFee === 0 || input.setupFee === '0' ? 0 : Number(input.setupFee) > 0 ? Math.round(Number(input.setupFee)) : setupAuto;
  const upsellPrice = (hours) => Math.max(100, roundTo(hours * rate * 1.6, 50));

  const picked = (Array.isArray(input.bonuses) && input.bonuses.length ? input.bonuses : DEFAULT_BONUSES).filter((id) => BONUSES[id]).slice(0, 4);
  const bonuses = picked.map((id) => ({ id, title: BONUSES[id].title, does: BONUSES[id].does }));
  const gIn = choiceKey(PROMISE_CHOICES, input.guarantee);
  const gKind = GUARANTEES[gIn] ? gIn : 'love_it';
  const gText = GUARANTEES[gKind]({ reels });

  const names = [PACKAGES.core.name, city ? `The ${city} gym video plan` : 'The gym video plan', 'The never-quiet Instagram plan'];
  const name = input.name ? plain(String(input.name)) : names[0];
  const firstLadder = ladder.find((r) => r.id !== 'case_study');
  const base = {
    name,
    oneLiner: plain(`${reels} Reels from one ${shootMinutes}-minute shoot a month, the first ones ready within 7 days, so a first-timer can see what a class at your gym feels like before they walk in.`),
    forWho: city ? `gyms and studios in ${city}` : 'local gyms and studios',
    reels,
    shootMinutes,
    core: [`One ${shootMinutes}-minute shoot at your gym each month`, `${reels} edited Reels a month, captions and cover images included`, 'A 30-day posting calendar, so you always know what goes up next'],
    bonuses,
    guarantee: { kind: gKind, text: gText },
    scarcity: miles > 0 ? { text: `I work with one gym of each kind within ${miles} miles, so the gym down the street can't hire me for the same thing.`, radiusMiles: miles } : null,
    packages: ['premium', 'core', 'clips'].map((id) => ({ id, name: PACKAGES[id].name, reels: pk[id].reels, full: pk[id].full, hours: Math.round(pk[id].hours * 10) / 10 })),
    upsells: [
      { id: 'challenge_ads', name: UPSELLS.challenge_ads.name, price: upsellPrice(3 * perReel + 1) },
      { id: 'site_video', name: UPSELLS.site_video.name, price: upsellPrice(3) },
      { id: 'member_story', name: UPSELLS.member_story.name, price: upsellPrice(2.5) },
    ],
    ladder,
    price: { monthly: pk.core.full, founding: firstLadder && firstLadder.id !== 'full' ? firstLadder.prices.core : null, setupFull },
    terms: ['Month to month', 'Cancel any time with 30 days notice', 'You own every video'],
    member: { firstName: input.firstName || null, business: input.business || null, city: city || null },
  };
  const offer = atRung(base, won);
  const caseHours = ladder.some((r) => r.freeMonth) ? Math.round(pk.core.hours * size) : 0;
  return {
    offer,
    names,
    math: {
      hours: Math.round(pk.core.hours * 10) / 10,
      floor: Math.round(pk.core.floor),
      hourlyAtStandard: Math.round(pk.core.full / pk.core.hours),
      hourlyAtFounding: offer.price.founding ? Math.round(offer.price.founding / pk.core.hours) : null,
      caseStudyHours: caseHours,
      memberPrice: value.memberPrice,
      memberValue: value.memberValue,
      stayMonths,
      priceSource: value.fromSites ? `the prices on ${value.fromSites} of their websites` : 'placeholder prices by kind of gym (ask owners for real ones)',
    },
    promiseNote: PROMISE_KEEP[gKind],
    why: whyItWorks(offer, value, reels, shootMinutes),
    pitch: pitchLines(offer, value, reels, shootMinutes),
    moneyModel: moneyModel(offer),
    page: offerPage(offer, value, stayMonths),
  };
}

// The value equation, in the member's words: why a gym owner says yes to this.
function whyItWorks(offer, value, reels, shootMinutes) {
  return [
    { part: 'What they want', text: 'More people walking in for a first class. Not "content". Every line of your offer points at that.' },
    { part: 'Why they believe it', text: `They've already watched a video you made for their gym, and ${offer.guarantee.text ? 'your promise means they risk little' : 'they can see your work before paying'}.` },
    { part: 'How fast', text: 'The first Reels are ready within 7 days of the shoot. Owners buy speed.' },
    { part: 'How little effort', text: `${shootMinutes} minutes of their time a month. You plan, film, edit and write the captions.` },
    {
      part: 'The math',
      text: `One new member pays about ${money(value.memberValue)} to a gym that charges ${money(value.memberPrice)} a month, if they stay ${Math.round(value.memberValue / value.memberPrice)} months. ${offer.price.monthly <= value.memberValue ? 'Your full price is less than one member pays them, which makes it easy to say yes.' : 'Your full price is more than one member pays them, so lead with the gyms that charge more, or start them on the clips package.'} That is math, not a promise.`,
    },
  ];
}

function pitchLines(offer, value, reels, shootMinutes) {
  return {
    elevator: plain(`I help ${offer.forWho} get more people in for a first class with short videos. One ${shootMinutes}-minute shoot a month, ${reels} Reels, and you never have to think about what to post again.`),
    priceLine: plain(`${offer.price.label}${/\.$/.test(offer.price.label) ? '' : '.'} ${offer.guarantee.text && !offer.price.firstMonthFree ? offer.guarantee.text : ''}`.trim()),
    valueLine: plain(`If it brings in one new member who stays like your members usually do, that's about ${money(value.memberValue)} for you. That's math, not a promise.`),
    scarcityLine: offer.scarcity ? plain(offer.scarcity.text) : null,
    urgencyLine: offer.urgency ? plain(offer.urgency.text) : null,
    caseStudyLine: offer.caseStudy ? offer.caseStudy.script : null,
  };
}

// The three packages at the member's current rung, biggest first, with what each includes.
function packagesAt(offer) {
  const now = (offer.price && offer.price.packages) || {};
  const reels = offer.reels || 12;
  const shoot = offer.shootMinutes || 45;
  const includes = {
    premium: [`Everything in "${PACKAGES.core.name}"`, '3 new ad cuts of your intro offer or challenge every month', 'A member story video every month, with their OK', 'A fresh homepage class video every quarter'],
    core: [`One ${shoot}-minute shoot a month`, `${reels} Reels a month, captions and covers included`, 'A 30-day posting calendar', ...(offer.bonuses || []).map((b) => b.title)],
    clips: ['You film on your phone with my shot list', '8 Reels a month from your clips, captions included', 'No shoot day'],
  };
  // An offer saved before packages existed: its one plan is the core package.
  if (!(offer.packages || []).length) return [{ id: 'core', name: offer.name, monthly: offer.price.current || offer.price.monthly, full: offer.price.monthly, reels, hours: null, includes: includes.core }];
  return offer.packages.map((p) => ({ id: p.id, name: p.name, monthly: now[p.id] || p.full, full: p.full, reels: p.reels, hours: p.hours, includes: includes[p.id] || [] }));
}

// The member's own money model: setup, monthly, add-ons and the smaller plan to offer before a no.
function moneyModel(offer) {
  return {
    setup: { price: offer.price.setupFull || 0, what: 'Planning, the shot list and the first shoot day', when: 'Charged to full-price clients. Waived for case studies and early clients.' },
    packages: packagesAt(offer),
    upsells: (offer.upsells || []).map((u) => ({ ...u, what: (UPSELLS[u.id] || {}).what || '' })),
    downsell: (offer.packages || []).find((p) => p.id === 'clips') || null,
  };
}

// A one-page offer the member can paste into an email or a doc after a call.
function offerPage(offer, value, stayMonths) {
  const pk = packagesAt(offer);
  const lines = [
    offer.name,
    offer.oneLiner,
    '',
    'Every month',
    ...offer.core.map((c) => `- ${c}`),
    '',
    ...(offer.bonuses.length ? ['Also included', ...offer.bonuses.map((b) => `- ${b.title}: ${b.does}`), ''] : []),
    offer.guarantee.text ? `My promise: ${offer.guarantee.text}` : '',
    offer.scarcity ? offer.scarcity.text : '',
    `Price: ${offer.price.label}${/\.$/.test(offer.price.label) ? '' : '.'}`,
    '',
    'Other ways to work together',
    ...pk.filter((p) => p.id !== 'core').map((p) => `- ${p.name}: ${money(p.monthly)} a month. ${PACKAGES[p.id].short}.`),
    '',
    offer.terms.join('. ') + '.',
    '',
    `For context: one new member who stays about ${stayMonths} months at about ${money(value.memberPrice)} a month pays a gym about ${money(value.memberValue)} in all. That is math, not a promise.`,
  ];
  return plain(lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim());
}

// The proposal for one gym after a good call: their own gaps and ideas, then three options with the
// biggest first, the member's promise, the ladder price and the member-value math from that gym's own
// price (or a labeled placeholder).
function proposalFromOffer({ gym, member = {}, business = {}, offer, priced, report = {}, suggest, proof = [] }) {
  const pk = packagesAt(offer);
  const core = pk.find((p) => p.id === 'core') || pk[0];
  const pick = suggest && pk.some((p) => p.id === suggest) ? suggest : 'core';
  const cur = core ? core.monthly : offer.price.current;
  const perMember = priced && priced.memberValue ? priced.memberValue / cur : null;
  const cover = perMember == null ? null : perMember >= 1 ? `One new member ${Math.floor(perMember) >= 2 ? `every ${Math.floor(perMember)} months` : 'a month'} covers "${core.name}".` : `${Math.ceil(1 / perMember)} new members a month cover "${core.name}".`;
  const free = offer.price.firstMonthFree;
  const optionLine = (p, i) => {
    const price = free && p.id === 'core' ? `first month free, then ${money(p.monthly)} a month` : `${money(p.monthly)} a month`;
    return `${i + 1}. ${p.name}: ${price}${p.id === pick ? ' (my suggestion to start)' : ''}\n   ${p.includes.join('. ')}.`;
  };
  const lines = [
    `Video for ${gym.name}`,
    `From ${member.firstName || 'me'}${business.name ? `, ${business.name}` : ''}`,
    '',
    'What I noticed',
    ...(report.gaps || []).slice(0, 3).map((g) => `- ${g.title}. ${g.fix}`),
    '',
    "What I'd make first",
    ...(report.ideas || []).slice(0, 3).map((i) => `- ${i.title}: "${i.hook}"`),
    '',
    ...(proof.length ? ['What my Reels have done for other gyms', ...proof.slice(0, 2).map((p) => `- ${p}`), ''] : []),
    'Three ways to work together',
    ...pk.map(optionLine),
    '',
    ...(offer.caseStudy ? ['How the free month works', ...offer.caseStudy.terms.map((t) => `- ${t}`), ''] : []),
    offer.guarantee && offer.guarantee.text ? `My promise${free ? ' once you pay' : ''}: ${offer.guarantee.text}` : '',
    offer.scarcity ? offer.scarcity.text : '',
    !free && offer.urgency ? offer.urgency.text : '',
    offer.price.setup ? `Setup: ${money(offer.price.setup)} once, for planning, the shot list and the first shoot day.` : 'No setup fee.',
    `${(offer.terms || []).join('. ')}.`,
    '',
    priced
      ? `For ${gym.name}: if the videos bring in one new member who stays about ${priced.stayMonths} months at about ${money(priced.memberPrice)} a month (${priced.memberPriceSource === 'their website' ? 'from your website' : 'my guess, tell me the real number'}), that member pays you about ${money(priced.memberValue)} in all. ${cover || ''} That is math, not a promise of sign-ups.`
      : '',
    '',
    `Next step: pick a shoot day.${free && offer.urgency ? ` ${offer.urgency.text}` : ''}`,
  ];
  return plain(lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim());
}

// The saved offer, small enough for the pack's memory (4 KB a key).
function forMemory(offer) {
  const o = { ...offer };
  delete o.caseStudy;
  delete o.urgency;
  if (JSON.stringify(o).length > 3800) o.bonuses = (o.bonuses || []).map((b) => ({ id: b.id, title: b.title }));
  if (JSON.stringify(o).length > 3800) delete o.upsells;
  return o;
}

module.exports = { buildOffer, atRung, rungFor, ladderFor, packagesAt, moneyModel, memberValueFor, proposalFromOffer, forMemory, BONUSES, DEFAULT_BONUSES, GUARANTEES, PROMISE_KEEP, PROMISE_CHOICES, LADDER_CHOICES, choiceKey, PACKAGES, UPSELLS, LADDERS };
