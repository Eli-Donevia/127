// The schedule a workflow can suggest (`suggestSchedule.cron`, contract v1.4): minute, hour, day of
// the month, month and day of the week. Each field is `*`, a number, a range (1-5) or a list of
// those (1,3,5); the minute and hour are set numbers, since a repeat runs at a time of day, at most
// once a day. No steps (*/15).

const FIELDS = [
  ['minute', 0, 59],
  ['hour', 0, 23],
  ['dom', 1, 31],
  ['month', 1, 12],
  ['dow', 0, 7],
];
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DEFAULT_TZ = 'America/Chicago';

// { minute, hour, dom, month, dow }: the allowed values of each as a Set, null for `*`. Null when
// it can't be read.
function parse(expr) {
  const parts = String(expr || '').trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const out = {};
  for (let i = 0; i < FIELDS.length; i++) {
    const [name, lo, hi] = FIELDS[i];
    if (parts[i] === '*') {
      out[name] = null;
      continue;
    }
    const set = new Set();
    for (const piece of parts[i].split(',')) {
      const m = /^(\d{1,2})(?:-(\d{1,2}))?$/.exec(piece);
      if (!m) return null;
      const a = Number(m[1]);
      const b = m[2] === undefined ? a : Number(m[2]);
      if (a < lo || b > hi || a > b) return null;
      for (let v = a; v <= b; v++) set.add(name === 'dow' && v === 7 ? 0 : v);
    }
    out[name] = set;
  }
  return out.minute && out.hour ? out : null;
}

// The member's local date and time: { date: '2026-11-02', dow: 1, dom: 2, month: 11, minutes: 420 }.
function local(ms, tz = DEFAULT_TZ) {
  const opts = { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
  let f;
  try {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz });
  } catch {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: DEFAULT_TZ });
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, dow: DOW[p.weekday], dom: Number(p.day), month: Number(p.month), minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// Whether today is one of the schedule's days and its time of day has come. When both day fields
// are set, either one counts (cron's own rule).
function dueToday(c, t) {
  const day = c.dom && c.dow ? c.dom.has(t.dom) || c.dow.has(t.dow) : (!c.dom || c.dom.has(t.dom)) && (!c.dow || c.dow.has(t.dow));
  if (!day || (c.month && !c.month.has(t.month))) return false;
  return t.minutes >= Math.min(...c.hour) * 60 + Math.min(...c.minute);
}

module.exports = { parse, local, dueToday, DEFAULT_TZ };
