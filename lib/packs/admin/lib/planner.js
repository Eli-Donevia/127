// The week plan: free blocks inside the member's work hours (after what is on their calendar),
// tasks placed into those blocks by due date and priority, and the days that are overbooked.
// Pure functions on ms timestamps and "YYYY-MM-DD" dates; the tool reads the .ics and the tasks.

const { zonedToUtc, wallParts } = require('../../_kit/time-zone');
const { addDays, weekday } = require('./ics');

const MIN = 60000;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// All-day events that take the whole day (others, like birthdays and holidays elsewhere, are notes).
const AWAY = /\b(out of (the )?office|ooo|vacation|holiday|day off|off work|away|travel(ling|ing)?|trade show|conference|expo|sick|closed|leave|pto|jury duty|move day|moving)\b/i;

function clock(ms, tz) {
  const p = wallParts(ms, tz);
  const h = p.h % 12 || 12;
  return `${h}${p.mi ? `:${String(p.mi).padStart(2, '0')}` : ''}${p.h < 12 ? 'am' : 'pm'}`;
}
const span = (a, b, tz) => `${clock(a, tz)} to ${clock(b, tz)}`;
function label(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}

function merge(intervals) {
  const s = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ start: i.start, end: i.end });
  }
  return out;
}

function hhmm(s, fallback) {
  const m = String(s || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return fallback;
  let h = Number(m[1]);
  if (m[3] && /pm/i.test(m[3]) && h < 12) h += 12;
  if (m[3] && /am/i.test(m[3]) && h === 12) h = 0;
  return h > 23 || Number(m[2] || 0) > 59 ? fallback : `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
}

// "Mon-Fri", "Mon to Sat", "weekdays", "Tue, Thu, Sat" -> [1,2,3,4,5]
function workDaysOf(s) {
  const t = String(s || '').toLowerCase();
  if (!t.trim() || /weekdays|mon\w*\s*(-|to|through|thru)\s*fri/.test(t)) return [1, 2, 3, 4, 5];
  if (/every ?day|all week|7 days|mon\w*\s*(-|to|through|thru)\s*sun/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  if (/mon\w*\s*(-|to|through|thru)\s*sat/.test(t)) return [1, 2, 3, 4, 5, 6];
  const keys = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const days = [...new Set((t.match(/\b(sun|mon|tue|wed|thu|fri|sat)/g) || []).map((d) => keys[d]))];
  return days.length ? days.sort() : [1, 2, 3, 4, 5];
}

// Sort order for placing tasks: due first (earliest), then priority, then work that others wait on
// or that brings money in, then the longer task (it needs the bigger block).
function order(a, b) {
  const da = a.due || '9999-12-31';
  const db = b.due || '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  const wa = (a.others ? 1 : 0) + (a.money ? 1 : 0);
  const wb = (b.others ? 1 : 0) + (b.money ? 1 : 0);
  if (wa !== wb) return wb - wa;
  return b.minutes - a.minutes;
}

function planWeek({ events = [], tasks = [], start, now, tz = 'America/Chicago', hours = {}, workDays = [1, 2, 3, 4, 5], days = 7, fill = 0.75 }) {
  const from = hhmm(hours.start, '09:00');
  const to = hhmm(hours.end, '17:00');
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const wd = weekday(date);
    const dayStart = zonedToUtc(date, '00:00', tz);
    const dayEnd = zonedToUtc(addDays(date, 1), '00:00', tz);
    const mine = events.filter((e) => e.start < dayEnd && e.end > dayStart);
    const allDay = mine.filter((e) => e.allDay);
    const timed = mine.filter((e) => !e.allDay);
    const away = allDay.find((e) => e.busy && AWAY.test(e.title)) || allDay.find((e) => AWAY.test(e.title));
    const work = workDays.includes(wd) && !away;
    let winStart = zonedToUtc(date, from, tz);
    const winEnd = zonedToUtc(date, to, tz);
    const past = now != null && winEnd <= now;
    if (now != null && now > winStart && now < winEnd) winStart = Math.ceil(now / (15 * MIN)) * 15 * MIN;
    const busy = merge(timed.filter((e) => e.busy).map((e) => ({ start: Math.max(e.start, winStart), end: Math.min(e.end, winEnd) })));
    const free = [];
    if (work && !past) {
      let cur = winStart;
      for (const b of busy) {
        if (b.start - cur >= 15 * MIN) free.push({ start: cur, end: b.start });
        cur = Math.max(cur, b.end);
      }
      if (winEnd - cur >= 15 * MIN) free.push({ start: cur, end: winEnd });
    }
    const windowMin = Math.max(0, (zonedToUtc(date, to, tz) - zonedToUtc(date, from, tz)) / MIN);
    const bookedMin = merge(timed.filter((e) => e.busy).map((e) => ({ start: Math.max(e.start, zonedToUtc(date, from, tz)), end: Math.min(e.end, winEnd) }))).reduce((a, b) => a + (b.end - b.start) / MIN, 0);
    const flags = [];
    if (workDays.includes(wd) && away) flags.push(`${away.title} takes the day.`);
    if (work) {
      const clash = [];
      const busyTimed = timed.filter((e) => e.busy).sort((a, b) => a.start - b.start);
      for (let a = 0; a < busyTimed.length; a++) for (let b = a + 1; b < busyTimed.length; b++) if (busyTimed[b].start < busyTimed[a].end) clash.push(`${busyTimed[a].title} and ${busyTimed[b].title}`);
      if (clash.length) flags.push(`Double-booked: ${clash.slice(0, 2).join('; ')}.`);
      if (windowMin && bookedMin / windowMin >= 0.8) flags.push(`${Math.round((bookedMin / windowMin) * 100)}% of your hours are booked.`);
      const late = timed.filter((e) => e.busy && e.end > winEnd + 15 * MIN && e.start < winEnd + 4 * 3600000);
      if (late.length) flags.push(`${late[0].title} runs past ${clock(winEnd, tz)}.`);
      const early = timed.filter((e) => e.busy && e.start < zonedToUtc(date, from, tz) - 15 * MIN && e.end > zonedToUtc(date, from, tz) - 4 * 3600000);
      if (early.length) flags.push(`${early[0].title} starts before ${clock(zonedToUtc(date, from, tz), tz)}.`);
      if (!past && !free.some((f) => f.end - f.start >= 60 * MIN) && windowMin >= 120) flags.push('No free hour for focused work.');
    }
    out.push({
      date,
      label: label(date),
      day: DAY_NAMES[wd],
      work,
      past,
      events: mine.map((e) => ({ title: e.title, allDay: e.allDay, start: e.start, end: e.end, when: e.allDay ? 'All day' : span(e.start, e.end, tz), busy: e.busy })),
      free: free.map((f) => ({ ...f, minutes: Math.round((f.end - f.start) / MIN), when: span(f.start, f.end, tz) })),
      placed: [],
      bookedMinutes: Math.round(bookedMin),
      freeMinutes: Math.round(free.reduce((a, f) => a + (f.end - f.start) / MIN, 0)),
      flags,
      overbooked: flags.some((f) => /Double-booked|% of your hours|runs past|starts before|No free hour/.test(f)),
    });
  }

  // Place tasks into a copy of the free blocks. A day takes at most `fill` of its free time in
  // tasks (room for the unplanned), except for a task due that day.
  const blocks = out.map((d) => d.free.map((f) => ({ start: f.start, end: f.end })));
  const used = out.map(() => 0);
  const unplaced = [];
  const sorted = [...tasks].sort(order);
  for (const t of sorted) {
    let left = t.minutes;
    const parts = [];
    const lastDay = t.due ? out.findIndex((d) => d.date === t.due) : -1;
    const tryDays = (lo, hi) => {
      for (let di = lo; di <= hi && left > 0; di++) {
        const d = out[di];
        if (!d.work || d.past) continue;
        const cap = (d.date === t.due ? 1 : fill) * d.freeMinutes - used[di];
        for (const b of blocks[di]) {
          if (left <= 0) break;
          const room = Math.min((b.end - b.start) / MIN, cap - parts.filter((p) => p.di === di).reduce((a, p) => a + p.minutes, 0));
          // Whole task in one block when it fits; long tasks (over 90 minutes) may split into 30+ minute parts.
          const need = t.minutes > 90 ? Math.min(left, room) : left;
          if (room >= need && need >= Math.min(30, left)) {
            parts.push({ di, start: b.start, end: b.start + need * MIN, minutes: need });
            b.start += need * MIN;
            left -= need;
          }
        }
      }
    };
    const end = lastDay >= 0 ? lastDay : out.length - 1;
    if (!(t.due && t.due < out[0].date)) tryDays(0, end);
    let late = false;
    if (left > 0 && lastDay >= 0 && lastDay < out.length - 1) {
      late = true;
      tryDays(lastDay + 1, out.length - 1);
    }
    if (left > 0) {
      // Undo a partial placement: a task that does not fit is listed, not half-planned.
      for (const p of parts) {
        const b = blocks[p.di].find((x) => x.start === p.end) || null;
        if (b) b.start = p.start;
      }
      unplaced.push({ ...t, reason: t.due && t.due < out[0].date ? 'It was due before this week.' : 'No free block big enough before it is due.' });
      continue;
    }
    for (const p of parts) {
      used[p.di] += p.minutes;
      out[p.di].placed.push({ id: t.id, title: t.title, start: p.start, end: p.end, minutes: p.minutes, when: span(p.start, p.end, tz), due: t.due, late, part: parts.length > 1 ? `${parts.indexOf(p) + 1} of ${parts.length}` : '' });
    }
  }
  for (const d of out) d.placed.sort((a, b) => a.start - b.start);
  return { days: out, unplaced, hours: { start: from, end: to }, workDays };
}

module.exports = { planWeek, merge, clock, span, hhmm, workDaysOf, label, order, AWAY };
