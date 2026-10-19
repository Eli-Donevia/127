// "Write a promise you can keep": a promise about what the member controls (a redo, on time, a
// refund of their own fee, changes until it's right), never about results like sales, leads or
// views. It comes with plain terms (what's covered, what isn't, how to claim, what you do), the
// words to say when someone uses it, and what keeping it could cost, from the member's numbers.

const { text, money } = require('../../_kit');
const { cap } = require('./facts');
const { promiseName, promiseShort } = require('./library');

const TYPES = {
  redo: { label: 'Redo it free', fits: ['home_service', 'personal_service'], unit: 'hours', window: 48, share: 0.5 },
  refund: { label: 'Full refund', fits: ['product', 'digital'], unit: 'days', window: 30, share: 1 },
  keep_working: { label: 'Changes until it\'s right', fits: ['b2b_service'], unit: 'days', window: 14, share: 0.25 },
  first_free: { label: 'First session free if it isn\'t a fit', fits: ['teach'], unit: 'days', window: 1, share: 1 },
  on_time: { label: 'On time, or it\'s free', fits: [], unit: 'minutes', window: 15, share: 1 },
  remake: { label: 'Remake it or refund it', fits: ['food'], unit: 'hours', window: 24, share: 1 },
};

// A result promise ("more sales", "10 new clients") is not something the member controls.
const RESULT_PROMISE = /\b(more|new|extra|\d+)\s+(sales|leads|clients|customers|followers|views|likes|bookings|calls|members|subscribers|revenue)\b|\b(rank|ranking|first page|go viral|double|triple|grow your)\b/i;

function windowText(n, unit) {
  const one = { hours: 'hour', days: 'day', minutes: 'minute' }[unit];
  return `${n} ${n === 1 ? one : unit}`;
}

function rebuild(type, f, win) {
  const t = TYPES[type];
  const w = windowText(win, t.unit);
  const thing = f.unit;
  const texts = {
    redo: `If anything isn't right, tell me within ${w} and I'll come back and fix it free.`,
    refund: `If it isn't right for you, tell me within ${w} for a full refund.`,
    keep_working: `I keep making changes until you're happy with it, at no extra cost, for ${w} after I deliver.`,
    first_free: 'If you\'re not happy after the first session, you don\'t pay for it.',
    on_time: `If I'm ever more than ${w} late, that ${thing} is free.`,
    remake: `If anything's wrong with your order, tell me within ${w} and I'll remake it or refund it.`,
  };
  return texts[type];
}

function windowOf(textIn, type) {
  const m = String(textIn || '').match(/within (\d+) (hour|day|minute)s?|more than (\d+) minutes/i);
  if (m && m[1]) return { n: Number(m[1]), unit: `${m[2].toLowerCase()}s` };
  if (m && m[3]) return { n: Number(m[3]), unit: 'minutes' };
  return { n: TYPES[type].window, unit: TYPES[type].unit };
}

function terms(type, f, win, said = '') {
  const w = windowText(win.n, win.unit);
  const monthly = type === 'on_time' && (f.unit === 'month' || /\b(month|deliver|posts?)\b/i.test(said));
  const replace = type === 'refund' && /\breplace/i.test(said);
  if (monthly || replace) {
    return monthly
      ? {
        covers: 'Any month where the work isn\'t delivered by the date we agreed.',
        notCovered: ['Delays while I wait on something only you can send me', 'Dates you move after we agree them'],
        claim: 'You won\'t need to. I\'ll take it off your bill myself.',
        you: 'That month is free, and I tell you before you ask.',
      }
      : {
        covers: `Any item that isn't right, if you tell me within ${w}.`,
        notCovered: ['Items that were used up or damaged after delivery', 'Shipping costs, unless the item arrived damaged'],
        claim: `Send me a photo within ${w}.`,
        you: 'I send a replacement free, or refund it if you\'d rather.',
      };
  }
  const covers = {
    redo: `Any part of the job I did that isn't right, if you tell me within ${w}.`,
    refund: `The full price you paid, if you tell me within ${w}.`,
    keep_working: `Changes to the work I delivered, for ${w} after I deliver it.`,
    first_free: 'The full price of the first session.',
    on_time: `Any ${f.unit} where I arrive more than ${w} after the time we agreed.`,
    remake: `Anything wrong with the order itself, if you tell me within ${w}.`,
  }[type];
  const notCovered = {
    redo: ['Damage or wear that was there before I started', 'New jobs or areas that weren\'t part of the booking'],
    refund: ['Shipping costs, unless the item arrived damaged', 'Items that have been used up or damaged after delivery'],
    keep_working: ['New work that wasn\'t in the plan we agreed', 'Changes after the window ends (those are quoted separately)'],
    first_free: ['Sessions after the first one', 'Missed sessions without 24 hours\' notice'],
    on_time: ['Delays you ask for, or weather that isn\'t safe to drive in', 'Times you change on the day'],
    remake: ['Orders changed after I start making them', 'Food stored or reheated in a way I didn\'t suggest'],
  }[type];
  const claim = {
    redo: `Text me a photo of what isn't right within ${w}.`,
    refund: `Message me within ${w}. You don't need a reason.`,
    keep_working: 'Send me the changes in one message.',
    first_free: 'Tell me at the end of the session, or by message that day.',
    on_time: 'You won\'t need to. I\'ll take it off your bill myself.',
    remake: `Send me a photo within ${w}.`,
  }[type];
  const you = {
    redo: 'I come back within 3 days and fix it, free.',
    refund: 'I refund you the same day.',
    keep_working: 'I make the changes and send them back within 3 days.',
    first_free: 'I refund the session the same day. No hard feelings.',
    on_time: 'That one is free, and I tell you before you ask.',
    remake: 'I remake it for your next pickup, or refund it the same day. Your choice.',
  }[type];
  return { covers, notCovered, claim, you };
}

// What keeping the promise could cost, using the member's own numbers.
function costMath(type, f, perHour) {
  const t = TYPES[type];
  const each = type === 'refund' || type === 'first_free' || type === 'on_time' || type === 'remake'
    ? (f.price || 0) + (type === 'remake' ? (f.cost || 0) : 0)
    : (f.hours || 0) * t.share * perHour + (f.cost || 0) * t.share;
  const rows = [50, 20, 10].map((n) => ({ rate: `1 in ${n}`, perJob: money.round(each / n, 2) }));
  return { each: money.round(each, 2), rows, known: each > 0 };
}

function build(f, { type, window: win, perHour } = {}) {
  const niche = f.profile.promise || { type: 'redo', text: '' };
  const chosen = type && TYPES[type] ? type : TYPES[niche.type] ? niche.type : niche.type === 'conditional' ? 'first_free' : 'redo';
  const w0 = windowOf(niche.text, chosen);
  const w = { n: win && win > 0 ? Math.round(win) : w0.n, unit: w0.unit };
  // Use the niche's own wording when the member keeps its type and window; it reads more natural.
  const useNiche = chosen === niche.type && w.n === w0.n && niche.text;
  const long = text.plain(useNiche ? niche.text : rebuild(chosen, f, w.n));
  const p = { type: chosen, text: long };
  const name = promiseName(p);
  const short = promiseShort(useNiche ? niche : p);
  const tm = terms(chosen, f, w, long);
  const rate = perHour || f.perHour || 20;
  const cost = costMath(chosen, f, rate);
  const claimScript = {
    redo: 'Thanks for telling me, and I\'m sorry it wasn\'t right. When can I come back this week? It\'s on me.',
    refund: 'Thanks for telling me. I\'ve sent your refund, and it should show up soon. If you\'re up for it, what would have made it right?',
    keep_working: 'Thanks, this helps. I\'ll make these changes and send it back by [day]. Anything else while I\'m in there?',
    first_free: 'Thanks for being honest. This one is on me, and I\'ve sent the refund. If you know anyone it might suit better, I\'d love an intro.',
    on_time: 'I\'m sorry I was late today. This one is free, and I\'ve taken it off your bill.',
    remake: 'I\'m sorry about that. Do you want me to remake it for Saturday, or would you rather have the refund today?',
  }[chosen];
  return {
    type: chosen,
    label: TYPES[chosen].label,
    name,
    long,
    short,
    bio: text.clip(short, 60),
    terms: tm,
    claimScript: text.plain(/^Any month/.test(tm.covers) ? 'I\'m sorry this month\'s work was late. This month is free, and I\'ve taken it off your bill.' : /replacement/.test(tm.you) ? 'Thanks for telling me, and I\'m sorry it wasn\'t right. I\'ll send a replacement this week, or refund it today if you\'d rather. Which do you want?' : claimScript),
    cost,
    perHour: rate,
    sayIt: text.plain(`And my promise: ${long.charAt(0).toLowerCase()}${long.slice(1)}`),
  };
}

function problems(s) {
  return RESULT_PROMISE.test(String(s || '')) ? ['promises a result you don\'t control'] : [];
}

module.exports = { TYPES, build, terms, costMath, windowOf, rebuild, problems, RESULT_PROMISE };
