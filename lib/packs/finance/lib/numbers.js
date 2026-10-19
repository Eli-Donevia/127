// Unit math from the member's own numbers: card fees (verified, data/fees.json), what's left per
// job, jobs to cover fixed costs, runway, payback, and the price that hits a chosen margin.
// Never a forecast of what anyone will earn: every result is per job, or a count of jobs.

const { money } = require('../../_kit');
const FEES = require('../data/fees.json');

// Cents, rounded half away from zero the way spreadsheets do (so the CSVs and this math agree).
const round2 = (n) => {
  const v = Number(n) || 0;
  return (Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7)) / 100;
};

// Form label, key or loose words ("square", "venmo", "cash") -> fee profile key.
function methodKey(input) {
  if (!input) return FEES.default;
  const s = String(input).toLowerCase().trim();
  if (FEES.methods[s]) return s;
  for (const [k, m] of Object.entries(FEES.methods)) if (m.label.toLowerCase() === s || m.short.toLowerCase() === s) return k;
  if (/cash|check|zelle/.test(s)) return 'cash';
  if (/venmo/.test(s)) return 'venmo_business';
  if (/paypal/.test(s)) return /person/.test(s) ? 'paypal_in_person' : /card/.test(s) ? 'paypal_cards' : 'paypal_checkout';
  if (/stripe/.test(s)) return /invoice/.test(s) ? 'stripe_invoice' : /person|terminal/.test(s) ? 'stripe_in_person' : 'stripe_online';
  if (/square/.test(s)) return /online|invoice|link/.test(s) ? 'square_online' : /key|typed|manual|file/.test(s) ? 'square_keyed' : 'square_in_person';
  if (/online|invoice|link/.test(s)) return 'stripe_online';
  return FEES.default;
}

function method(input) {
  const key = methodKey(input);
  return { key, ...FEES.methods[key] };
}

// The fee on one payment, in dollars. share: the part of payments made by card (0 to 1).
function feeOn(price, m, share = 1) {
  const p = money.num(price, 0);
  if (!(p > 0) || !m) return 0;
  return round2((p * (m.rate || 0) + (m.fixed || 0)) * share);
}

// The fee on one payment under every common way to get paid, cheapest first.
function compare(price) {
  return FEES.compare
    .map((key) => {
      const m = FEES.methods[key];
      const fee = feeOn(price, m);
      return { key, label: m.short, rate: m.rate, fixed: m.fixed, fee, keep: round2(price - fee) };
    })
    .sort((a, b) => a.fee - b.fee);
}

// Method labels for a form's enum.
const METHOD_LABELS = [...new Set(Object.values(FEES.methods).map((m) => m.label))];

// One job: price minus card fee, supplies, your time (when you set a pay rate) and driving (when
// you give miles). `share` is the part of jobs paid by card (0 to 1).
function jobMath({ price, cost = 0, minutes = 0, hourly = 0, miles = 0, mileRate = 0, m, share = 1 }) {
  const p = money.num(price, 0);
  const fee = feeOn(p, m, share);
  const supplies = round2(money.num(cost, 0));
  const timeCost = hourly > 0 && minutes > 0 ? round2((hourly * minutes) / 60) : 0;
  const driveCost = miles > 0 && mileRate > 0 ? round2(miles * mileRate) : 0;
  const left = round2(p - fee - supplies - timeCost - driveCost);
  const margin = p > 0 ? left / p : 0;
  // Before paying yourself: what each hour of work leaves once supplies, fees and driving are paid.
  const perHour = minutes > 0 ? round2(((p - fee - supplies - driveCost) * 60) / minutes) : null;
  return { price: round2(p), fee, cost: supplies, timeCost, driveCost, left, margin, perHour };
}

// Jobs a month that cover fixed monthly costs. 0 when there are none; null when a job loses money.
function jobsToCover(fixed, perJob) {
  const f = money.num(fixed, 0);
  if (!(f > 0)) return 0;
  if (!(perJob > 0)) return null;
  return Math.ceil(f / perJob - 1e-9);
}

// The smallest price people are used to seeing that is at or above n: 43.2 -> 45, 101 -> 105.
function niceUp(n) {
  const v = Number(n);
  if (!(v > 0)) return 0;
  const step = v < 20 ? 1 : v < 200 ? 5 : v < 1000 ? 25 : v < 5000 ? 50 : 100;
  return Math.ceil(v / step - 1e-9) * step;
}

// The price where what's left after fees, supplies, time and driving is `margin` of the price.
// p - (rate p + fixed) - costs = margin p, so p = (costs + fixed) / (1 - rate - margin): the kit's
// priceForMargin with the card fee folded in.
function priceForMargin({ cost = 0, timeCost = 0, driveCost = 0, m, share = 1, margin = 0.3 }) {
  const rate = (m ? m.rate : 0) * share;
  const fixed = (m ? m.fixed : 0) * share;
  const base = money.num(cost, 0) + timeCost + driveCost + fixed;
  if (!(base > 0)) return 0;
  return round2(money.priceForMargin(base, Math.min(0.9, margin + rate)));
}

// Cash after startup costs, and how many months of fixed costs it covers with no sales at all.
function runway({ cash, startup = 0, fixed = 0 }) {
  const c = money.num(cash, null);
  if (c == null) return { known: false };
  const after = round2(c - money.num(startup, 0));
  const f = money.num(fixed, 0);
  return {
    known: true,
    cash: c,
    afterStartup: after,
    short: after < 0 ? round2(-after) : 0,
    months: f > 0 ? (after > 0 ? Math.floor(after / f + 1e-9) : 0) : null,
  };
}

// Jobs it takes to earn back startup costs, from what's left per job.
function paybackJobs(startup, perJob) {
  const s = money.num(startup, 0);
  if (!(s > 0)) return 0;
  if (!(perJob > 0)) return null;
  return Math.ceil(s / perJob - 1e-9);
}

const WEEKS_PER_MONTH = 52 / 12;

module.exports = { FEES, METHOD_LABELS, methodKey, method, feeOn, compare, jobMath, jobsToCover, niceUp, priceForMargin, runway, paybackJobs, WEEKS_PER_MONTH, round2 };
