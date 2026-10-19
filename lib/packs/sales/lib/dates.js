// Human dates from pasted lists: "Oct 12", "10/12", "2026-10-12", "3 days ago", "last Tuesday",
// "yesterday", "in 2 weeks". Returns "YYYY-MM-DD" or ''. `mode` picks the year and the side of today
// when the text doesn't say: 'past' (when you last talked), 'future' (a due date, may be a little
// late) or 'near' (closest to today).

const { time } = require('../../_kit');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const WD = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, few: 3 };
const NUM_RE = '(\\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|couple|few)';
const MON_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?';

function valid(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

// a - b in whole days.
function diffDays(a, b) {
  const [y1, m1, d1] = String(a).split('-').map(Number);
  const [y2, m2, d2] = String(b).split('-').map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 864e5);
}

function pickYear(m, d, today, mode) {
  const y = Number(String(today).slice(0, 4));
  const cands = [y - 1, y, y + 1].filter((yy) => valid(yy, m, d)).map((yy) => time.ymd(yy, m, d));
  if (!cands.length) return '';
  const score = (c) => {
    const k = diffDays(c, today);
    if (mode === 'past') return k <= 3 ? Math.abs(k) : 1000 + k;
    if (mode === 'future') return k >= -60 ? Math.abs(k) : 1000 - k;
    return Math.abs(k);
  };
  return cands.sort((a, b) => score(a) - score(b))[0];
}

function amount(word) {
  return /^\d+$/.test(word) ? Number(word) : NUM[word] || 1;
}

function span(n, unit) {
  return unit === 'week' ? n * 7 : unit === 'month' ? n * 30 : n;
}

function parseDate(raw, today, { mode = 'near', dayFirst = false } = {}) {
  let s = String(raw || '')
    .toLowerCase()
    .replace(/\$\s?[\d,]+(?:\.\d+)?/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .trim();
  if (!s || !today) return '';
  let m;
  if ((m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return valid(y, mo, d) ? time.ymd(y, mo, d) : '';
  }
  if (/\b(today|this morning|this afternoon|tonight)\b/.test(s)) return today;
  if (/\byesterday\b/.test(s)) return time.addDays(today, -1);
  if (/\btomorrow\b/.test(s)) return time.addDays(today, 1);
  if ((m = s.match(new RegExp(`\\b${NUM_RE}\\s*(?:of\\s*)?(day|week|month)s?\\s+ago\\b`)))) return time.addDays(today, -span(amount(m[1]), m[2]));
  if ((m = s.match(new RegExp(`\\bin\\s+${NUM_RE}\\s*(?:of\\s*)?(day|week|month)s?\\b`)))) return time.addDays(today, span(amount(m[1]), m[2]));
  if (/\blast week\b/.test(s)) return time.addDays(today, -7);
  if (/\bnext week\b/.test(s)) return time.addDays(today, 7);
  if (/\blast month\b/.test(s)) return time.addDays(today, -30);
  if ((m = s.match(new RegExp(`\\b${MON_RE}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`)))) {
    const mo = MONTHS[m[1]];
    const d = Number(m[2]);
    if (m[3]) return valid(Number(m[3]), mo, d) ? time.ymd(Number(m[3]), mo, d) : '';
    return pickYear(mo, d, today, mode);
  }
  if ((m = s.match(new RegExp(`\\b(\\d{1,2})\\s+${MON_RE}(?:,?\\s+(\\d{4}))?`)))) {
    const mo = MONTHS[m[2]];
    const d = Number(m[1]);
    if (m[3]) return valid(Number(m[3]), mo, d) ? time.ymd(Number(m[3]), mo, d) : '';
    return pickYear(mo, d, today, mode);
  }
  if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let mo = dayFirst ? b : a;
    let d = dayFirst ? a : b;
    if (mo > 12 && d <= 12) [mo, d] = [d, mo];
    if (m[3]) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return valid(y, mo, d) ? time.ymd(y, mo, d) : '';
    }
    return valid(2024, mo, d) ? pickYear(mo, d, today, mode) : '';
  }
  if ((m = s.match(/\b(?:(last|next|this|on)\s+)?(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)(?:day|nesday|urday|rsday|sday)?\b/))) {
    const wd = WD[m[2]];
    if (wd == null) return '';
    const forward = m[1] === 'next' || (mode === 'future' && m[1] !== 'last');
    if (forward) return time.nextWeekday(today, wd, { after: true });
    let d = time.addDays(today, -1);
    for (let i = 0; i < 7 && time.weekdayOf(d) !== wd; i++) d = time.addDays(d, -1);
    return d;
  }
  return '';
}

// Saturday and Sunday move to Monday: reminders land on a working day.
function weekday(dateStr) {
  const w = time.weekdayOf(dateStr);
  return w === 6 ? time.addDays(dateStr, 2) : w === 0 ? time.addDays(dateStr, 1) : dateStr;
}

module.exports = { parseDate, diffDays, weekday, valid };
