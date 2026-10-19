// Tax set-aside math and dates from data/tax.json (IRS pages, checked 2026-10-19). General
// information, not tax advice: every output tells the member to check with a tax pro.
//
// Due dates: the IRS publishes each year's four dates in that year's Form 1040-ES. Dates we read
// there are marked `published`; later years follow the IRS rule (the 15th of April, June, September
// and the next January, moved to the next business day after a weekend or legal holiday) and are
// marked `computed` so the member knows to check irs.gov when the new form comes out.

const TAX = require('../data/tax.json');

const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const parts = (s) => String(s).split('-').map(Number);
const dow = (s) => {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const addDays = (s, n) => {
  const [y, m, d] = parts(s);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 864e5);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

// nth weekday (0 = Sunday) of a month; n = -1 for the last one.
function nthWeekday(y, m, weekday, n) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return ymd(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return ymd(y, m, lastDay - ((last - weekday + 7) % 7));
}

// A fixed-date holiday moves to Friday when it falls on Saturday and to Monday on Sunday.
function observed(s) {
  const w = dow(s);
  return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s;
}

// Legal holidays in Washington, DC for a year (federal holidays plus DC Emancipation Day, April 16,
// which has moved the April deadline before, and Inauguration Day every fourth January 20).
function holidays(y) {
  const list = [
    observed(ymd(y, 1, 1)),
    nthWeekday(y, 1, 1, 3), // Martin Luther King Jr. Day
    nthWeekday(y, 2, 1, 3), // Washington's Birthday
    observed(ymd(y, 4, 16)), // DC Emancipation Day
    nthWeekday(y, 5, 1, -1), // Memorial Day
    observed(ymd(y, 6, 19)),
    observed(ymd(y, 7, 4)),
    nthWeekday(y, 9, 1, 1), // Labor Day
    nthWeekday(y, 10, 1, 2),
    observed(ymd(y, 11, 11)),
    nthWeekday(y, 11, 4, 4), // Thanksgiving
    observed(ymd(y, 12, 25)),
    observed(ymd(y + 1, 1, 1)), // New Year's Day can be observed on December 31
  ];
  if ((y - 2029) % 4 === 0) list.push(dow(ymd(y, 1, 20)) === 0 ? ymd(y, 1, 21) : ymd(y, 1, 20));
  return new Set(list);
}

function isBusinessDay(s) {
  const w = dow(s);
  return w !== 0 && w !== 6 && !holidays(parts(s)[0]).has(s);
}

function nextBusinessDay(s) {
  let d = s;
  for (let i = 0; i < 10 && !isBusinessDay(d); i++) d = addDays(d, 1);
  return d;
}

// The four estimated tax due dates for a tax year, from the IRS rule.
function ruleDates(year) {
  return TAX.estimated.periods.map((p) => nextBusinessDay(ymd(p.due.nextYear ? year + 1 : year, p.due.month, p.due.day)));
}

// The four due dates for a tax year: published when the IRS has printed them, else by the rule.
function datesFor(year) {
  const published = TAX.estimated.published[String(year)];
  const dates = published || ruleDates(year);
  return dates.map((date, i) => ({
    date,
    taxYear: year,
    payment: i + 1,
    covers: `${TAX.estimated.periods[i].label}, ${year}`,
    published: !!published,
  }));
}

// The next `count` due dates on or after `from` ("YYYY-MM-DD").
function upcoming(from, count = 4) {
  const y = parts(from)[0];
  const all = [...datesFor(y - 1), ...datesFor(y), ...datesFor(y + 1), ...datesFor(y + 2)];
  return all.filter((d) => d.date >= from).slice(0, count);
}

// Which due date a payment received on `date` counts toward (IRS payment periods).
function periodOf(date) {
  const [y, m] = parts(date);
  const i = TAX.estimated.periods.findIndex((p) => p.months.includes(m));
  return datesFor(y)[i];
}

// The IRS business mileage rate for a date, or null when it isn't out yet.
function mileRateOn(date) {
  const r = TAX.mileage.rates.find((x) => date >= x.from && date <= x.to);
  return r ? r.rate : null;
}

// The latest rate we know, for "what does driving cost" math.
function latestMileRate() {
  return TAX.mileage.rates[TAX.mileage.rates.length - 1];
}

const SE_SHARE = TAX.selfEmployment.netEarningsShare * TAX.selfEmployment.rate; // 0.1413 of profit

const BRACKETS = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const FILING = { single: 'single', 'married filing jointly': 'marriedJoint', married: 'marriedJoint', joint: 'marriedJoint', 'head of household': 'headOfHousehold', head: 'headOfHousehold' };

function filingKey(s) {
  const t = String(s || 'single').toLowerCase();
  for (const [k, v] of Object.entries(FILING)) if (t.includes(k)) return v;
  return 'single';
}

// "12%", 12, 0.12, "Not sure" -> a bracket rate. Unknown means 12% and `assumed: true`.
function bracketOf(input) {
  const n = typeof input === 'number' ? input : Number(String(input || '').replace(/[^0-9.]/g, ''));
  if (Number.isFinite(n) && n > 0) {
    const r = n > 1 ? n / 100 : n;
    const hit = BRACKETS.find((b) => Math.abs(b - r) < 0.0001);
    if (hit) return { rate: hit, assumed: false };
  }
  return { rate: 0.12, assumed: true };
}

// The 2026 bracket rows for a filing status, as { from, to, rate } (taxable income).
function bracketRows(filing) {
  const rows = TAX.brackets[filingKey(filing)];
  return rows.map(([from, rate], i) => ({ from, to: rows[i + 1] ? rows[i + 1][0] : null, rate }));
}

// How much of profit to set aside: self-employment tax (15.3% of 92.35%), the member's federal
// bracket and their state rate, rounded up to a whole percent so the cushion errs high.
function setAside({ bracket, stateRate = 0 } = {}) {
  const b = bracketOf(bracket);
  const state = Math.max(0, Math.min(0.15, Number(stateRate) || 0));
  const exact = SE_SHARE + b.rate + state;
  return { se: SE_SHARE, federal: b.rate, federalAssumed: b.assumed, state, exact, rate: Math.ceil(exact * 100 - 1e-9) / 100 };
}

module.exports = { TAX, SE_SHARE, BRACKETS, holidays, isBusinessDay, nextBusinessDay, ruleDates, datesFor, upcoming, periodOf, mileRateOn, latestMileRate, bracketOf, bracketRows, filingKey, setAside, addDays, ymd };
