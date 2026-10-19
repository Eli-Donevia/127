// Dates in the member's own timezone. Always take "now" from ctx.now() (tests set the clock).

const DAY = 24 * 3600 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function nowMs(ctx) {
  return ctx && typeof ctx.now === 'function' ? ctx.now() : Date.now();
}

function tzOf(ctx) {
  return (ctx && ctx.member && ctx.member.timezone) || (ctx && ctx.brain && ctx.brain.business && ctx.brain.business.timezone) || 'America/Chicago';
}

// { y, m, d, weekday } for a moment in a timezone.
function partsIn(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), weekday: WEEKDAYS.indexOf(p.weekday) };
}

// "2026-10-19" in the member's timezone.
function today(ctx) {
  const { y, m, d } = partsIn(nowMs(ctx), tzOf(ctx));
  return ymd(y, m, d);
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Calendar math on "YYYY-MM-DD" strings (no timezone drift).
function addDays(dateStr, n) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function weekdayOf(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Next given weekday (0 = Sunday) on or after a date; strictly after when `after` is true.
function nextWeekday(dateStr, weekday, { after = false } = {}) {
  let d = after ? addDays(dateStr, 1) : dateStr;
  for (let i = 0; i < 7 && weekdayOf(d) !== weekday; i++) d = addDays(d, 1);
  return d;
}

// "Mon, Oct 19"
function shortDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}

// "October 19, 2026"
function longDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
}

function year(ctx) {
  return partsIn(nowMs(ctx), tzOf(ctx)).y;
}

module.exports = { DAY, WEEKDAYS, nowMs, tzOf, partsIn, today, ymd, addDays, weekdayOf, nextWeekday, shortDate, longDate, year };
