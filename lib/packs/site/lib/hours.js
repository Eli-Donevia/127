// Opening hours the way members type them ("Mon to Sat 8am to 6pm, Sun closed", "Tue-Sun 11-9",
// "Weekdays 9am-5pm; Sat 10am-2pm") into rows a page can show and schema.org
// OpeningHoursSpecification for Google. Anything we can't read stays as the member's own words.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\\.?';
const RANGE_WORD = '(?:-|to|through|thru|until|till)';
const DAY_EXPR = `(?:daily|every\\s+day|7\\s+days(?:\\s+a\\s+week)?|weekdays|weekends|${DAY}(?:\\s*${RANGE_WORD}\\s*${DAY})?(?:\\s*(?:,|&|and|/)\\s*${DAY}(?:\\s*${RANGE_WORD}\\s*${DAY})?)*)`;
const TIME = '(?:noon|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?)';
const SEGMENT = new RegExp(`(${DAY_EXPR})\\s*:?\\s*(?:(closed)|(${TIME})\\s*${RANGE_WORD}\\s*(${TIME})|(open\\s+24\\s+hours|24\\s*hours|24/7))`, 'gi');

function dayIndex(tok) {
  const t = String(tok || '').toLowerCase();
  if (t.startsWith('mo')) return 0;
  if (t.startsWith('tu')) return 1;
  if (t.startsWith('we')) return 2;
  if (t.startsWith('th')) return 3;
  if (t.startsWith('fr')) return 4;
  if (t.startsWith('sa')) return 5;
  if (t.startsWith('su')) return 6;
  return -1;
}

function daysOf(expr) {
  const e = String(expr || '').toLowerCase().trim();
  if (/^(daily|every\s+day|7\s+days)/.test(e)) return [0, 1, 2, 3, 4, 5, 6];
  if (/^weekdays/.test(e)) return [0, 1, 2, 3, 4];
  if (/^weekends/.test(e)) return [5, 6];
  const out = [];
  for (const part of e.split(/\s*(?:,|&|\band\b|\/)\s*/)) {
    const m = part.match(new RegExp(`^(${DAY})\\s*(?:${RANGE_WORD})\\s*(${DAY})$`, 'i'));
    if (m) {
      let a = dayIndex(m[1]);
      const b = dayIndex(m[2]);
      if (a < 0 || b < 0) continue;
      for (let i = 0; i < 7; i++) {
        if (!out.includes(a)) out.push(a);
        if (a === b) break;
        a = (a + 1) % 7;
      }
    } else {
      const d = dayIndex(part);
      if (d >= 0 && !out.includes(d)) out.push(d);
    }
  }
  return out;
}

// "8am" -> { h: 8, m: 0, mer: 'am' } ; "18:30" -> { h: 18, m: 30 }
function readTime(s) {
  const t = String(s || '').toLowerCase().replace(/\./g, '').trim();
  if (t === 'noon') return { h: 12, m: 0, mer: 'pm' };
  if (t === 'midnight') return { h: 0, m: 0, mer: 'am' };
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2] || 0), mer: m[3] || null };
}

function to24(t, fallbackMer) {
  let h = t.h;
  const mer = t.mer || fallbackMer;
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return { h: h % 24, m: t.m };
}

// Guess am/pm for "9-5", "11-9" or "8-11pm": a bare opening hour from 5 to 11 is morning, 12 is noon,
// and it shares the closing time's am/pm when it comes earlier on the clock ("8-11pm" is 8pm).
// A bare closing hour is afternoon or evening. Hours over 12 are a 24-hour clock.
function resolveRange(a, b) {
  let openMer = a.h > 12 ? null : a.mer;
  let closeMer = b.h > 12 ? null : b.mer;
  if (!openMer && a.h <= 12) {
    if (a.h === 12) openMer = 'pm';
    else if (closeMer) openMer = a.h < b.h ? closeMer : 'am';
    else openMer = a.h >= 5 ? 'am' : 'pm';
  }
  if (!closeMer && b.h <= 12) closeMer = 'pm';
  const open = a.h > 12 ? { h: a.h % 24, m: a.m } : to24(a, openMer);
  let close = b.h > 12 ? { h: b.h % 24, m: b.m } : to24(b, closeMer);
  if (close.h === 0 && close.m === 0) close = { h: 24, m: 0 };
  return { open, close };
}

function hhmm({ h, m }) {
  return `${String(h === 24 ? 0 : h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 13:30 -> "1:30pm"; 0:00 or 24:00 -> "midnight"; 12:00 -> "noon"
function pretty({ h, m }) {
  if ((h === 0 || h === 24) && m === 0) return 'midnight';
  if (h === 12 && m === 0) return 'noon';
  const mer = h >= 12 && h < 24 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${mer}`;
}

// [0,1,2,3,4,5] -> "Mon to Sat"; [0,2,4] -> "Mon, Wed and Fri"; all -> "Every day"
function dayLabel(days) {
  const d = [...days].sort((a, b) => a - b);
  if (d.length === 7) return 'Every day';
  if (d.length === 5 && d.join() === '0,1,2,3,4') return 'Mon to Fri';
  if (d.length === 2 && d.join() === '5,6') return 'Sat and Sun';
  const runs = [];
  for (const x of d) {
    const last = runs[runs.length - 1];
    if (last && x === last[last.length - 1] + 1) last.push(x);
    else runs.push([x]);
  }
  const parts = runs.map((r) => (r.length >= 3 ? `${SHORT[r[0]]} to ${SHORT[r[r.length - 1]]}` : r.map((x) => SHORT[x]).join(', ')));
  const flat = parts.join(', ');
  const i = flat.lastIndexOf(', ');
  return i > 0 && !/ to /.test(flat.slice(i)) ? `${flat.slice(0, i)} and ${flat.slice(i + 2)}` : flat;
}

// Returns { rows: [{ days, time, closed }], spec: [{ dayOfWeek, opens, closes }], text, parsed }.
function parseHours(input) {
  const text = String(input || '')
    .replace(/[\u2012-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return { rows: [], spec: [], text: '', parsed: false };
  const rows = [];
  const spec = [];
  const seen = new Set();
  let m;
  SEGMENT.lastIndex = 0;
  while ((m = SEGMENT.exec(text))) {
    const days = daysOf(m[1]).filter((d) => !seen.has(d));
    if (!days.length) continue;
    days.forEach((d) => seen.add(d));
    if (m[2]) {
      rows.push({ days: dayLabel(days), time: 'Closed', closed: true, dayIdx: days });
      continue;
    }
    if (m[5]) {
      rows.push({ days: dayLabel(days), time: 'Open 24 hours', closed: false, dayIdx: days });
      spec.push({ dayOfWeek: days.map((d) => DAYS[d]), opens: '00:00', closes: '23:59' });
      continue;
    }
    const a = readTime(m[3]);
    const b = readTime(m[4]);
    if (!a || !b) continue;
    const { open, close } = resolveRange(a, b);
    rows.push({ days: dayLabel(days), time: `${pretty(open)} to ${pretty(close)}`, closed: false, dayIdx: days });
    spec.push({ dayOfWeek: days.map((d) => DAYS[d]), opens: hhmm(open), closes: close.h === 24 ? '23:59' : hhmm(close) });
  }
  rows.sort((x, y) => Math.min(...x.dayIdx) - Math.min(...y.dayIdx));
  const clean = rows.map(({ days, time, closed }) => ({ days, time, closed }));
  return { rows: clean, spec, text, parsed: clean.length > 0 };
}

// One line for a hero or footer: "Mon to Sat, 8am to 6pm" or the member's own words.
function hoursLine(h) {
  if (!h) return '';
  if (h.rows && h.rows.length) {
    const open = h.rows.filter((r) => !r.closed);
    return open.map((r) => `${r.days}, ${r.time}`).join('. ');
  }
  return h.text || '';
}

module.exports = { parseHours, hoursLine, dayLabel, DAYS, SHORT };
