// Due dates in the words people write them: "today", "tomorrow", "EOD", "by Friday", "next Tue",
// "end of week", "next week", "in 3 days", "Oct 22", "22 October", "10/22", "2026-10-22".
// Every date is a "YYYY-MM-DD" string worked out from `today` (also a "YYYY-MM-DD"), so there is no
// time zone drift. findDate(text, today) returns { date, match } or null.

const { time } = require('../../_kit');

const DAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const DAY_RE = Object.keys(DAYS).sort((a, b) => b.length - a.length).join('|');

const pad = (n) => String(n).padStart(2, '0');
function validDate(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
// A month and day with no year: this year, or next year when that date is well past.
function nearYear(today, m, d) {
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-${pad(m)}-${pad(d)}`;
  return thisYear < time.addDays(today, -60) ? `${y + 1}-${pad(m)}-${pad(d)}` : thisYear;
}

const RULES = [
  [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => (validDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null)],
  [/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/, (m) => {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return validDate(y, +m[1], +m[2]) ? `${y}-${pad(m[1])}-${pad(m[2])}` : null;
  }],
  [/\b(\d{1,2})\/(\d{1,2})\b/, (m, today) => (validDate(2024, +m[1], +m[2]) ? nearYear(today, +m[1], +m[2]) : null)],
  [new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i'), (m, today) => {
    const mo = MONTHS[m[1].toLowerCase()];
    const d = Number(m[2]);
    if (m[3]) return validDate(+m[3], mo, d) ? `${m[3]}-${pad(mo)}-${pad(d)}` : null;
    return validDate(2024, mo, d) ? nearYear(today, mo, d) : null;
  }],
  [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b`, 'i'), (m, today) => {
    const mo = MONTHS[m[2].toLowerCase()];
    return validDate(2024, mo, +m[1]) ? nearYear(today, mo, +m[1]) : null;
  }],
  [/\b(today|tonight|eod|end of (the )?day|this (afternoon|morning|evening)|asap)\b/i, (m, today) => today],
  [/\b(tomorrow|tmrw|tmw)\b/i, (m, today) => time.addDays(today, 1)],
  [/\byesterday\b/i, (m, today) => time.addDays(today, -1)],
  [/\b(\d{1,2}) days? ago\b/i, (m, today) => time.addDays(today, -Number(m[1]))],
  [/\bin (\d{1,2}) days?\b/i, (m, today) => time.addDays(today, Number(m[1]))],
  [/\bin (\d{1,2}) weeks?\b/i, (m, today) => time.addDays(today, 7 * Number(m[1]))],
  [/\b(end of (the )?week|eow|this week)\b/i, (m, today) => time.nextWeekday(today, 5)],
  [/\bnext week\b/i, (m, today) => time.nextWeekday(today, 1, { after: true })],
  [/\b(end of (the )?month|eom|this month)\b/i, (m, today) => {
    const [y, mo] = today.split('-').map(Number);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return `${y}-${pad(mo)}-${pad(last)}`;
  }],
  [new RegExp(`\\bnext\\s+(${DAY_RE})\\b`, 'i'), (m, today) => {
    const wd = DAYS[m[1].toLowerCase()];
    // "next Tuesday" is the Tuesday of next week.
    const monday = time.nextWeekday(today, 1, { after: true });
    return time.addDays(monday, (wd + 6) % 7);
  }],
  [new RegExp(`\\b(?:by|on|before|due|this|until|for)?\\s*(${DAY_RE})\\b\\.?`, 'i'), (m, today) => {
    // "sat", "sun" and "wed" are words too: a short lower-case name needs "by", "on" or "due" before it.
    const word = m[1];
    if (word.length <= 4 && word[0] === word[0].toLowerCase() && !/^(by|on|before|due|this|until|for)\b/i.test(m[0].trim())) return null;
    return time.nextWeekday(today, DAYS[word.toLowerCase()]);
  }],
];

const DUE_WORDS = /\b(by|due|before|deadline|until|no later than)\s*:?\s*$/i;

function findDate(textIn, today) {
  const s = String(textIn || '');
  const found = [];
  RULES.forEach(([re, fn], order) => {
    const m = s.match(re);
    if (!m) return;
    const date = fn(m, today);
    if (!date) return;
    const before = s.slice(Math.max(0, m.index - 20), m.index);
    found.push({ date, match: m[0].trim(), index: m.index, order, due: DUE_WORDS.test(before) || /^(by|due|before|until)\b/i.test(m[0].trim()) });
  });
  if (!found.length) return null;
  const due = found.filter((f) => f.due).sort((a, b) => a.index - b.index);
  const best = due[0] || found.sort((a, b) => a.order - b.order)[0];
  return { date: best.date, match: best.match };
}

// Days from a to b ("YYYY-MM-DD"), negative when b is earlier.
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// A date a person typed into a CSV cell: any of the forms above, or "Oct 22, 2026", "22/10/2026"
// when the first number is over 12.
function parseDateCell(v, today) {
  const s = String(v || '').trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy && Number(dmy[1]) > 12) {
    const y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return validDate(y, +dmy[2], +dmy[1]) ? `${y}-${pad(dmy[2])}-${pad(dmy[1])}` : null;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (iso) return validDate(+iso[1], +iso[2], +iso[3]) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  const f = findDate(s, today);
  return f ? f.date : null;
}

module.exports = { findDate, daysBetween, parseDateCell, DAYS, MONTHS };
