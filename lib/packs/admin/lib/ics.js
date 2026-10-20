// A small .ics (iCalendar) reader with no packages: unfolds lines, reads VEVENTs, and expands the
// common repeats (RRULE FREQ=DAILY or WEEKLY with INTERVAL, COUNT, UNTIL and BYDAY; MONTHLY on the
// same day of the month), EXDATE skips and RECURRENCE-ID changes. Times are read in the time zone
// the file gives (TZID, a UTC "Z", or the member's zone for floating times), and Outlook's Windows
// zone names are mapped to IANA ones. All-day events keep their dates.
//
//   parseIcs(text) -> { events: [...], warnings: [...] }
//   expand(parsed, { from, to, tz }) -> [{ uid, title, start, end, allDay, date, endDate, busy, location }]
//   from/to are ms; date is YYYY-MM-DD in tz.

const { zonedToUtc, wallParts } = require('../../_kit/time-zone');

const DAY = 86400000;
const WINDOWS_TZ = {
  'eastern standard time': 'America/New_York',
  'central standard time': 'America/Chicago',
  'mountain standard time': 'America/Denver',
  'us mountain standard time': 'America/Phoenix',
  'pacific standard time': 'America/Los_Angeles',
  'alaskan standard time': 'America/Anchorage',
  'hawaiian standard time': 'Pacific/Honolulu',
  'atlantic standard time': 'America/Halifax',
  'gmt standard time': 'Europe/London',
  'greenwich standard time': 'Etc/GMT',
  'w. europe standard time': 'Europe/Berlin',
  'romance standard time': 'Europe/Paris',
  'central europe standard time': 'Europe/Budapest',
  'e. europe standard time': 'Europe/Bucharest',
  'india standard time': 'Asia/Kolkata',
  'china standard time': 'Asia/Shanghai',
  'tokyo standard time': 'Asia/Tokyo',
  'aus eastern standard time': 'Australia/Sydney',
  'new zealand standard time': 'Pacific/Auckland',
  'sa pacific standard time': 'America/Bogota',
  'central standard time (mexico)': 'America/Mexico_City',
  utc: 'UTC',
  'coordinated universal time': 'UTC',
};

function validZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zoneOf(tzid, fallback) {
  if (!tzid) return null;
  const raw = String(tzid).replace(/^"|"$/g, '').replace(/^\/[^/]+\/[^/]+\//, '').trim();
  if (validZone(raw)) return raw;
  const mapped = WINDOWS_TZ[raw.toLowerCase()];
  if (mapped) return mapped;
  // "(UTC-05:00) Eastern Time (US & Canada)" and similar labels
  if (/eastern/i.test(raw)) return 'America/New_York';
  if (/central/i.test(raw) && !/europe/i.test(raw)) return 'America/Chicago';
  if (/arizona/i.test(raw)) return 'America/Phoenix';
  if (/mountain/i.test(raw)) return 'America/Denver';
  if (/pacific/i.test(raw)) return 'America/Los_Angeles';
  return fallback;
}

function unfold(text) {
  return String(text || '').replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescape(v) {
  return String(v).replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

// "DTSTART;TZID=America/New_York:20261020T090000" -> { name, params: { TZID }, value }
function prop(line) {
  let q = false;
  let i = 0;
  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === ':' && !q) break;
  }
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts = head.split(';');
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: parts[0].toUpperCase(), params, value };
}

// A date or date-time value -> { allDay, date: 'YYYY-MM-DD', time: 'HH:MM:SS' | null, utc: bool, tz }
function readTime(p) {
  if (!p) return null;
  const v = String(p.value).trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || (p.params.VALUE || '').toUpperCase() === 'DATE') return { allDay: true, date, time: null, utc: false, tzid: null };
  return { allDay: false, date, time: `${m[4]}:${m[5]}:${m[6] || '00'}`, utc: !!m[7], tzid: p.params.TZID || null };
}

function toMs(t, tz) {
  if (t.utc) {
    const [y, mo, d] = t.date.split('-').map(Number);
    const [h, mi, s] = t.time.split(':').map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, s);
  }
  return zonedToUtc(t.date, t.time.slice(0, 5), tz) + Number(t.time.slice(6, 8) || 0) * 1000;
}

// ISO 8601 duration: P1D, PT1H30M, P1W, -PT15M
function durationMs(v) {
  const m = String(v || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const n = (x) => Number(x || 0);
  const ms = ((n(m[2]) * 7 + n(m[3])) * 24 * 3600 + n(m[4]) * 3600 + n(m[5]) * 60 + n(m[6])) * 1000;
  return m[1] === '-' ? -ms : ms;
}

function parseRule(v) {
  const r = {};
  for (const part of String(v || '').split(';')) {
    const [k, val] = part.split('=');
    if (k && val != null) r[k.toUpperCase()] = val;
  }
  return r;
}

function parseIcs(text, { tz = 'America/Chicago' } = {}) {
  const lines = unfold(text);
  const events = [];
  const warnings = [];
  let cur = null;
  let depth = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/^BEGIN:VEVENT$/i.test(line.trim())) {
      cur = { props: {}, exdates: [] };
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (/^BEGIN:/i.test(line)) depth++;
    if (/^END:/i.test(line) && !/^END:VEVENT$/i.test(line.trim())) {
      depth--;
      continue;
    }
    if (depth > 0) continue; // VALARM and friends
    if (/^END:VEVENT$/i.test(line.trim())) {
      events.push(cur);
      cur = null;
      continue;
    }
    const p = prop(line);
    if (p.name === 'EXDATE') cur.exdates.push(p);
    else if (!cur.props[p.name]) cur.props[p.name] = p;
  }
  const out = [];
  for (const e of events) {
    const P = e.props;
    const start = readTime(P.DTSTART);
    if (!start) {
      warnings.push(`Skipped an event with no start time${P.SUMMARY ? ` (${unescape(P.SUMMARY.value)})` : ''}.`);
      continue;
    }
    const zone = start.utc ? 'UTC' : zoneOf(start.tzid, tz) || tz;
    if (start.tzid && zoneOf(start.tzid, null) == null) warnings.push(`Didn't know the time zone "${start.tzid}", so its times are read as ${tz}.`);
    const end = readTime(P.DTEND);
    const dur = P.DURATION ? durationMs(P.DURATION.value) : null;
    const status = P.STATUS ? P.STATUS.value.trim().toUpperCase() : '';
    const ev = {
      uid: P.UID ? P.UID.value.trim() : `e${out.length + 1}`,
      title: P.SUMMARY ? unescape(P.SUMMARY.value).trim() || 'Busy' : 'Busy',
      location: P.LOCATION ? unescape(P.LOCATION.value).trim() : '',
      allDay: start.allDay,
      start,
      end,
      durationMs: dur,
      tz: zone,
      busy: !(P.TRANSP && /TRANSPARENT/i.test(P.TRANSP.value)),
      cancelled: status === 'CANCELLED',
      rule: P.RRULE ? parseRule(P.RRULE.value) : null,
      recurrenceId: P['RECURRENCE-ID'] ? readTime(P['RECURRENCE-ID']) : null,
      exdates: e.exdates.flatMap((x) => String(x.value).split(',').map((v) => readTime({ value: v, params: x.params })).filter(Boolean)),
    };
    if (ev.rule && !['DAILY', 'WEEKLY', 'MONTHLY'].includes(String(ev.rule.FREQ || '').toUpperCase())) warnings.push(`"${ev.title}" repeats ${String(ev.rule.FREQ || 'in a way').toLowerCase()}; only its first date is used.`);
    out.push(ev);
  }
  return { events: out, warnings };
}

const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
const weekday = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const dayIndex = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function dateIn(ms, tz) {
  const p = wallParts(ms, tz);
  return ymd(p.y, p.m, p.d);
}

// One occurrence's start and end in ms (all-day: midnight to midnight in the member's zone).
function occurrence(ev, date, tz) {
  if (ev.allDay) {
    const endDate = ev.end && ev.end.allDay ? addDays(date, Math.max(1, dayIndex(ev.end.date) - dayIndex(ev.start.date))) : addDays(date, Math.max(1, Math.round((ev.durationMs || DAY) / DAY)));
    return { start: zonedToUtc(date, '00:00', tz), end: zonedToUtc(endDate, '00:00', tz), date, endDate };
  }
  const start = toMs({ ...ev.start, date }, ev.tz);
  let len = 30 * 60000;
  if (ev.end && !ev.end.allDay) len = toMs(ev.end, ev.end.utc ? 'UTC' : zoneOf(ev.end.tzid, ev.tz) || ev.tz) - toMs(ev.start, ev.tz);
  else if (ev.durationMs != null) len = ev.durationMs;
  return { start, end: start + Math.max(0, len), date: dateIn(start, tz) };
}

// Local dates (in the event's own zone) on which a repeating event happens, from its start up to `toDate`.
function ruleDates(ev, toDate, limit = 1000) {
  const r = ev.rule;
  const freq = String(r.FREQ || '').toUpperCase();
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  let until = null;
  if (r.UNTIL) {
    const u = readTime({ value: r.UNTIL, params: {} });
    if (u) until = u.allDay ? u.date : ev.allDay ? u.date : u.utc ? dateIn(toMs(u, 'UTC'), ev.tz) : u.date;
  }
  const first = ev.start.date;
  const days = r.BYDAY ? r.BYDAY.split(',').map((x) => BYDAY[x.trim().slice(-2).toUpperCase()]).filter((x) => x != null) : null;
  const out = [];
  let n = 0;
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(freq)) return [first];
  const firstMonday = addDays(first, -((weekday(first) + 6) % 7));
  for (let d = first, i = 0; i < 4000 && n < count && out.length < limit; d = addDays(d, 1), i++) {
    if (d > toDate || (until && d > until)) break;
    let hit = false;
    if (freq === 'DAILY') hit = (dayIndex(d) - dayIndex(first)) % interval === 0 && (!days || days.includes(weekday(d)));
    if (freq === 'WEEKLY') {
      const week = Math.floor((dayIndex(d) - dayIndex(firstMonday)) / 7);
      hit = week % interval === 0 && (days ? days.includes(weekday(d)) : weekday(d) === weekday(first));
    }
    if (freq === 'MONTHLY') {
      const [y1, m1, d1] = first.split('-').map(Number);
      const [y2, m2, d2] = d.split('-').map(Number);
      const months = (y2 - y1) * 12 + (m2 - m1);
      hit = d2 === (Number(r.BYMONTHDAY) || d1) && months % interval === 0;
    }
    if (hit) {
      n++;
      out.push(d);
    }
  }
  return out;
}

function expand(parsed, { from, to, tz = 'America/Chicago' } = {}) {
  const events = parsed.events || [];
  const out = [];
  const overrides = events.filter((e) => e.recurrenceId);
  const fromDate = addDays(dateIn(from, tz), -1);
  const toDate = addDays(dateIn(to, tz), 1);
  for (const ev of events) {
    if (ev.recurrenceId) continue;
    const dates = ev.rule ? ruleDates(ev, toDate) : [ev.start.date];
    const mine = overrides.filter((o) => o.uid === ev.uid);
    for (const date of dates) {
      if (date < addDays(fromDate, -60) && ev.rule) continue;
      const occ = occurrence(ev, date, tz);
      const skip = ev.exdates.some((x) => (x.allDay || ev.allDay ? x.date === date : toMs(x, x.utc ? 'UTC' : zoneOf(x.tzid, ev.tz) || ev.tz) === occ.start));
      if (skip) continue;
      const changed = mine.find((o) => (o.recurrenceId.allDay ? o.recurrenceId.date === date : toMs(o.recurrenceId, o.recurrenceId.utc ? 'UTC' : zoneOf(o.recurrenceId.tzid, ev.tz) || ev.tz) === occ.start));
      if (changed) continue; // the changed copy is added below
      if (ev.cancelled) continue;
      if (occ.end > from && occ.start < to) out.push({ uid: ev.uid, title: ev.title, location: ev.location, allDay: ev.allDay, start: occ.start, end: occ.end, date: occ.date, endDate: occ.endDate || occ.date, busy: ev.busy });
    }
  }
  for (const o of overrides) {
    if (o.cancelled) continue;
    const occ = occurrence(o, o.start.date, tz);
    if (occ.end > from && occ.start < to) out.push({ uid: o.uid, title: o.title, location: o.location, allDay: o.allDay, start: occ.start, end: occ.end, date: occ.date, endDate: occ.endDate || occ.date, busy: o.busy });
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

module.exports = { parseIcs, expand, durationMs, unfold, prop, readTime, zoneOf, ruleDates, addDays, weekday, dateIn, WINDOWS_TZ };
