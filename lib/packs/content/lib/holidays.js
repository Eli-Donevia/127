// US holidays and big shopping days in a date range, each with a practical post idea that stays on
// what the member controls (their hours, a real offer, their story). Federal holidays follow their
// rule (2026 and 2027 checked against OPM's list, see data/platforms.json); observances like Mother's
// Day and Small Business Saturday follow theirs.

const { addDays, weekdayOf, ymd } = require('../../_kit').time;

// nth weekday (0 = Sunday) of a month; n = -1 for the last one.
function nthWeekday(y, m, weekday, n) {
  if (n > 0) {
    let d = ymd(y, m, 1);
    while (weekdayOf(d) !== weekday) d = addDays(d, 1);
    return addDays(d, 7 * (n - 1));
  }
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let d = ymd(y, m, days);
  while (weekdayOf(d) !== weekday) d = addDays(d, -1);
  return d;
}

function forYear(y) {
  const thanksgiving = nthWeekday(y, 11, 4, 4);
  return [
    { date: ymd(y, 1, 1), name: "New Year's Day", idea: "Post what's new this year and how to book you." },
    { date: nthWeekday(y, 1, 1, 3), name: 'Martin Luther King Jr. Day', idea: 'Post your hours if they change.' },
    { date: ymd(y, 2, 14), name: "Valentine's Day", idea: 'If you sell gift cards or gift bookings, post one clear way to buy one.' },
    { date: nthWeekday(y, 2, 1, 3), name: "Presidents' Day", idea: 'Post your hours for the long weekend.' },
    { date: nthWeekday(y, 5, 0, 2), name: "Mother's Day", idea: 'Gift post: how to book you as a gift, if you offer it.' },
    { date: nthWeekday(y, 5, 1, -1), name: 'Memorial Day', idea: 'Post your hours for the long weekend.' },
    { date: nthWeekday(y, 6, 0, 3), name: "Father's Day", idea: 'Gift post: how to book you as a gift, if you offer it.' },
    { date: ymd(y, 6, 19), name: 'Juneteenth', idea: 'Post your hours if they change.' },
    { date: ymd(y, 7, 4), name: 'Independence Day', idea: 'Post your hours for the holiday.' },
    { date: nthWeekday(y, 9, 1, 1), name: 'Labor Day', idea: 'Post your hours for the long weekend.' },
    { date: ymd(y, 10, 31), name: 'Halloween', idea: 'A light behind-the-scenes post. Have fun with it.' },
    { date: ymd(y, 11, 11), name: 'Veterans Day', idea: 'Post your hours if they change.' },
    { date: thanksgiving, name: 'Thanksgiving', idea: 'Thank-you post: thank your first customers (by first name only with their OK).' },
    { date: addDays(thanksgiving, 1), name: 'Black Friday', idea: 'If you run a deal, one clear offer with a real end date. No fake countdowns.' },
    { date: addDays(thanksgiving, 2), name: 'Small Business Saturday', idea: 'Tell the story of why you started.' },
    { date: ymd(y, 12, 25), name: 'Christmas Day', idea: 'Post your holiday hours a few days before.' },
    { date: ymd(y, 12, 31), name: "New Year's Eve", idea: 'Your favorite job of the year, with photos you have permission to share.' },
  ];
}

// Holidays from start to end (inclusive), sorted.
function inRange(start, end) {
  const y0 = Number(String(start).slice(0, 4));
  const y1 = Number(String(end).slice(0, 4));
  const out = [];
  for (let y = y0; y <= y1; y++) for (const h of forYear(y)) if (h.date >= start && h.date <= end) out.push(h);
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

module.exports = { forYear, inRange, nthWeekday };
