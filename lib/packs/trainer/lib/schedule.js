// Dates for the 4-week plan, as plain "YYYY-MM-DD" strings (kit time.js does the calendar math).
// parseDate reads what a member types ("Oct 27", "10/27", "2026-10-27"), parseDays reads a schedule
// ("Tue 7am, Fri 7am", "Mon and Thu at 6:30pm") and sessionDates lays the sessions on the calendar.
// Pure functions: no ctx, no network.

const time = require('../../_kit/time');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_WORDS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const valid = (y, m, d) => y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);

// A typed date, or '' when it can't be read. Without a year: the next one on or after today, or with
// { past: true } the last one on or before today (a form filled in last week).
function parseDate(input, today, { past = false } = {}) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return '';
  const [ty] = String(today).split('-').map(Number);
  let y = null;
  let m = null;
  let d = null;
  let hit = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  if (!hit && (hit = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    m = Number(hit[1]);
    d = Number(hit[2]);
    if (hit[3]) y = hit[3].length === 2 ? 2000 + Number(hit[3]) : Number(hit[3]);
  }
  if (!hit && (hit = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/))) {
    m = MONTHS.indexOf(hit[1]) + 1;
    d = Number(hit[2]);
    if (hit[3]) y = Number(hit[3]);
  }
  if (!hit) return '';
  if (y == null) {
    y = ty;
    const guess = valid(y, m, d) ? time.ymd(y, m, d) : '';
    if (guess && !past && guess < today) y += 1;
    if (guess && past && guess > today) y -= 1;
  }
  return valid(y, m, d) ? time.ymd(y, m, d) : '';
}

// The same day n months later (Jan 31 + 1 month is Feb 28 or 29).
function addMonths(dateStr, n) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return time.ymd(ny, nm, Math.min(d, daysIn(ny, nm)));
}

const TIME = /^\s*(?:at\s+|@\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)|\d{1,2}:\d{2}|noon|lunch(?:time)?|mornings?|evenings?|afternoons?)/i;
function tidyTime(t) {
  const s = String(t || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  if (!s) return '';
  if (/^lunch/.test(s)) return 'lunchtime';
  return s.replace(/s$/, '');
}

// "Tue 7am, Fri 7am" -> [{ day: 2, time: '7am' }, { day: 5, time: '7am' }]. One time typed once
// ("Tue and Fri at 7am") goes on every day that has none.
function parseDays(input) {
  const s = String(input || '');
  const re = /\b(mon|tue|wed|thu|fri|sat|sun)(?:day|sday|nesday|rsday|rs|r|s|urday)?s?\b\.?/gi;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(s))) {
    const day = DAY_WORDS[m[1].toLowerCase()];
    const after = s.slice(re.lastIndex, re.lastIndex + 24);
    const t = after.match(TIME);
    if (seen.has(day)) continue;
    seen.add(day);
    out.push({ day, time: t ? tidyTime(t[1]) : '' });
  }
  const times = [...new Set(out.map((x) => x.time).filter(Boolean))];
  if (times.length === 1) for (const x of out) if (!x.time) x.time = times[0];
  return out;
}

const dayLabel = (x) => `${DAY_NAMES[x.day]}${x.time ? ` ${x.time}` : ''}`;

// `count` session dates from the first one on the schedule after today, or from a typed start date
// (kept even when it isn't one of the days). [{ date, time }] or [] without days.
function sessionDates({ days = [], start = '', today, count = 8 } = {}) {
  if (!days.length) return [];
  const byDay = new Map(days.map((x) => [x.day, x.time]));
  const out = [];
  let d = start || time.addDays(today, 1);
  if (start) {
    out.push({ date: start, time: byDay.get(time.weekdayOf(start)) || '' });
    d = time.addDays(start, 1);
  }
  for (let i = 0; out.length < count && i < 400; i++, d = time.addDays(d, 1)) {
    if (byDay.has(time.weekdayOf(d))) out.push({ date: d, time: byDay.get(time.weekdayOf(d)) || '' });
  }
  return out;
}

// "Tue, Oct 20 at 7am" / "Fri, Oct 23 (morning)"
function dateLabel(x) {
  if (!x || !x.date) return '';
  const t = x.time ? (/\d/.test(x.time) ? ` at ${x.time}` : ` (${x.time})`) : '';
  return `${time.shortDate(x.date)}${t}`;
}

module.exports = { parseDate, addMonths, parseDays, sessionDates, dayLabel, dateLabel, DAY_NAMES };
