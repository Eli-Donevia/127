// "Plan what each customer buys": one offer for each step, in order. Get them in (attraction), the
// main offer (core), add more (upsell), if they say no (downsell), keep them (continuity). Prices
// come from the member's own price and costs; the math is per sale and per customer, never a
// monthly income total. Each step has when to offer it and the words to say.

const { text, money } = require('../../_kit');
const { cap, a } = require('./facts');
const FEES = require('../data/fees.json');

const STEPS = [
  { key: 'attraction', step: 'Get them in', when: 'In your bio, your posts and your first message. It gives strangers an easy first yes.' },
  { key: 'core', step: 'The main offer', when: 'When they\'re interested. Say the price once, then stop talking.' },
  { key: 'upsell', step: 'Add more', when: 'Right after they say yes, before you leave or hang up. They\'re already deciding.' },
  { key: 'downsell', step: 'If they say no', when: 'Only after a no on price. Offer less, never the same thing for less.' },
  { key: 'continuity', step: 'Keep them', when: 'At the end of the first job, when they\'re happiest with it.' },
];

const TYPE_WORDS = {
  decoy: 'A cheaper, smaller option shown next to the main one',
  buy_get: 'Buy some, get one free',
  sample: 'A free sample made for them',
  free_goods: 'A free extra with the first order',
  win_back: 'Money back if they do the work',
  classic: 'The next thing they\'ll want',
  menu: 'A bigger version of what they picked',
  anchor: 'A premium option shown first',
  feature: 'Less included, lower price',
  payment_plan: 'Same thing, split payments',
  discount: 'A member price for coming back',
  bonus: 'A monthly plan with something extra',
  waived_fee: 'Monthly, with the setup fee waived',
};

function feeFor(key, arch) {
  const k = FEES.processors[key] ? key : FEES.default_by_arch[arch] || 'stripe_online';
  return { key: k, ...FEES.processors[k] };
}

function cardFee(price, fee) {
  return price > 0 ? price * fee.rate + fee.fixed : 0;
}

function fillUnit(s, f) {
  return text.plain(String(s || '').replace(/\{unit\}/g, f.unit).replace(/\{units\}/g, f.units));
}

// One step of the ladder, with per-sale math from the member's numbers.
function step(key, spec, f, ctx) {
  const P = f.price;
  const cost = f.cost || 0;
  const hours = f.hours || 0;
  const s = spec || {};
  let price = 0;
  let priceText = '';
  let timeF = s.time != null ? s.time : 1;
  let costF = s.cost != null ? s.cost : 1;
  let priceF = s.price != null ? s.price : 1;
  let note = '';
  if (key === 'core') {
    price = P;
    priceF = 1;
    timeF = 1;
    costF = 1;
    priceText = `${money.usd(P)} per ${f.unit}`;
  } else if (key === 'continuity') {
    const per = s.perMonth || 1;
    const each = money.nicePrice(P * (1 - (s.discount || 0)));
    price = each * per;
    priceF = (each * per) / P;
    timeF = per * (f.unit === 'month' ? 1 : 1);
    costF = per;
    priceText = f.unit === 'month' ? `${money.usd(price)} a month` : per === 1 ? `${money.usd(each)} per ${f.unit}, one a month` : `${money.usd(each)} per ${f.unit}, ${per} a month`;
    if (s.type === 'waived_fee') {
      const setup = money.nicePrice(P * 0.5);
      note = `Setup fee of ${money.usd(setup)} waived when they start on the plan.`;
    }
    if (s.discount) note = `${note} Saves them ${money.usd(P - each)} per ${f.unit} against your regular price.`.trim();
  } else if (s.type === 'buy_get') {
    price = P * (s.price || 3);
    priceText = `${money.usd(price)} for ${s.time || 4} ${f.units}`;
    note = `That's ${money.usd(price / (s.time || 4))} per ${f.unit}.`;
  } else if (s.type === 'payment_plan') {
    price = P * (s.price || 1);
    priceText = `2 payments of ${money.usd(money.round(price / 2, 2))}`;
  } else if (s.type === 'win_back') {
    price = P * 4;
    priceF = 4;
    timeF = 4;
    costF = 4;
    priceText = `${money.usd(price)} for the first month (4 ${f.units})`;
    note = 'Refund it if they came to every session, did the work and still aren\'t happy.';
  } else if (priceF === 0) {
    price = 0;
    priceText = 'Free';
  } else {
    price = money.nicePrice(P * priceF);
    priceText = `${money.usd(price)}${key === 'upsell' && s.type === 'classic' ? ' extra' : ''}`;
  }
  const supplies = money.round(cost * costF, 2);
  const fee = money.round(cardFee(price, ctx.fee), 2);
  const kept = money.round(price - supplies - fee, 2);
  const hrs = money.round(hours * timeF, 2);
  return {
    key,
    step: STEPS.find((x) => x.key === key).step,
    when: STEPS.find((x) => x.key === key).when,
    type: s.type || 'core',
    typeLabel: key === 'core' ? 'What you sell' : TYPE_WORDS[s.type] || '',
    title: key === 'core' ? cap(f.what) : fillUnit(s.title, f),
    what: key === 'core' ? `${cap(f.outcome)}.` : `${fillUnit(s.what, f)}.`,
    price: money.round(price, 2),
    priceText,
    priceFactor: money.round(priceF, 3),
    suppliesFactor: money.round(costF, 3),
    timeFactor: money.round(timeF, 3),
    supplies,
    fee,
    kept,
    hours: hrs,
    keptPerHour: hrs > 0 ? money.round(kept / hrs, 2) : null,
    note: text.plain(note),
  };
}

// The words to say at each step. Short, honest, easy to read off a phone. No "most people":
// a new business can't know that yet.
function scriptFor(st, f, all) {
  const core = all.find((x) => x.key === 'core');
  const P = money.usd(core.price);
  const promise = f.profile.promise.text;
  const t = st.type;
  const lc = (s) => String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1);
  const service = ['home_service', 'personal_service', 'teach'].includes(f.arch);
  const ask = {
    home_service: 'Want me to save you a spot this week?',
    personal_service: 'Want me to save you a spot this week?',
    teach: 'Want me to save you a spot?',
    b2b_service: 'Want me to start with a free sample?',
    product: 'Want one?',
    digital: 'Want the link?',
    food: 'Want me to put you down for this weekend?',
  }[f.arch] || 'Want me to save you a spot?';
  // Niche wording describes the buyer in the third person; scripts talk to them.
  const you = (x) => String(x || '').replace(/\btheir\b/g, 'your').replace(/\bthey're\b/g, 'you\'re').replace(/\bthey\b/g, 'you').replace(/\bthem\b/g, 'you');
  st = { ...st, what: you(st.what) };
  const addName = lc(st.title).replace(/^add (a |an |the )?/, (m, art) => art || 'the ');
  const S = {
    core: /^If /.test(promise) ? `${cap(f.outcome)}. ${f.profile.firstLine}. It's ${P}, and ${lc(promise)} ${ask}` : `${cap(f.outcome)}. ${f.profile.firstLine}. It's ${P}. ${promise} ${ask}`,
    decoy: `The full ${lc(core.title)} is ${P}. If you only want ${lc(st.title)}, that's ${st.priceText}. Which sounds better for you?`,
    buy_get: `If you book 3 ${f.units} now, the 4th is free. It works out to ${money.usd(st.price / 4)} each, and you're on my calendar.`,
    sample: f.arch === 'b2b_service'
      ? `Can I make you a ${lc(st.title)} for your business? No cost, no catch. If you like it, we can talk about doing it every month.`
      : `Want to try ${a(lc(st.title))}? No cost, no catch. If you like it, we keep going.`,
    free_goods: `Your first order comes with ${a(lc(st.title.replace(/ with the first order$/i, '')))}, on me.`,
    win_back: 'Here\'s how I work: you pay for the first month up front. Come to every session and do the work, and if you\'re still not happy, I\'ll give you your money back.',
    classic: service || f.arch === 'home_service'
      ? `While I'm here, want me to add ${addName}? It's ${st.priceText}. ${st.what}`
      : `Want to add ${addName}? It's ${st.priceText}. ${st.what}`,
    menu: `Do you want the regular one or the ${lc(st.title)}? The ${lc(st.title)} is ${st.priceText}: ${lc(st.what)}`,
    anchor: `There's also the ${lc(st.title)} at ${st.priceText}: ${lc(st.what)} I'd suggest starting with the regular one.`,
    feature: `No problem. If ${P} is more than you want to spend right now, I can do ${lc(st.title)} for ${st.priceText}: ${lc(st.what)}`,
    payment_plan: `No problem. You can split it into ${st.priceText}, so it's easier on your budget this month.`,
    discount: `Want me to put you on the ${lc(st.title)}? ${st.what} It's ${st.priceText}, and you can stop any time.`,
    bonus: `Want me to put you on the ${lc(st.title)}? ${st.what} It's ${st.priceText}, and you can stop any time.`,
    waived_fee: `If you want this every month, I'll waive the setup fee when you start on the ${lc(st.title)}. It's ${st.priceText}, and you can stop any time.`,
  };
  if (!service && t === 'classic' && f.arch === 'b2b_service') S.classic = `Once this is running, want me to add ${addName} too? It's ${st.priceText}. ${st.what}`;
  return text.plain((st.key === 'core' ? S.core : S[t] || S.classic).replace(/\.\./g, '.').replace(/\?\./g, '?').replace(/:\s*$/, '.'));
}

// Per customer, first 30 days: they take the main offer, the add-on and the first month of the plan.
function firstThirty(steps, f) {
  // A monthly service's first month is the main offer itself: don't count the plan twice.
  const keys = f && f.unit === 'month' ? ['core', 'upsell'] : ['core', 'upsell', 'continuity'];
  const take = keys.map((k) => steps.find((x) => x.key === k)).filter((x) => x && x.price > 0 && !/payment/.test(x.type));
  const cash = take.reduce((n, x) => n + x.price, 0);
  const costs = take.reduce((n, x) => n + x.supplies + x.fee, 0);
  const kept = cash - costs;
  const hours = take.reduce((n, x) => n + x.hours, 0);
  return {
    includes: take.map((x) => x.title),
    cash: money.round(cash, 2),
    costs: money.round(costs, 2),
    kept: money.round(kept, 2),
    hours: money.round(hours, 2),
    maxToGetOne: money.round(Math.max(0, kept), 2),
    growOnOwnMoney: money.round(Math.max(0, kept) / 2, 2),
  };
}

function build(f, { payWith, perHour } = {}) {
  const p = f.profile;
  const ctx = { fee: feeFor(payWith, f.arch) };
  const steps = [
    step('attraction', p.attraction, f, ctx),
    step('core', null, f, ctx),
    step('upsell', p.upsell, f, ctx),
    step('downsell', p.downsell, f, ctx),
    step('continuity', p.continuity, f, ctx),
  ];
  for (const st of steps) st.script = scriptFor(st, f, steps);
  const rate = perHour || f.perHour || 20;
  for (const st of steps) {
    st.timeCost = money.round(st.hours * rate, 2);
    st.leftAfterTime = money.round(st.kept - st.timeCost, 2);
  }
  return { steps, thirty: firstThirty(steps, f), fee: ctx.fee, perHour: rate, perHourAssumed: !(perHour || f.perHour) };
}

module.exports = { STEPS, TYPE_WORDS, feeFor, cardFee, step, scriptFor, firstThirty, build, FEES };
