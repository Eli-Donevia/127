// Calendar files with a reminder alarm (the kit's ics has no VALARM yet). Times are the member's
// local time converted to UTC so every calendar app shows the right hour.

const { zonedToUtc } = require('../../_kit/time-zone');

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fold = (l) => {
  const out = [];
  let s = l;
  while (Buffer.byteLength(s) > 74) {
    let n = 74;
    while (Buffer.byteLength(s.slice(0, n)) > 74) n--;
    out.push(s.slice(0, n));
    s = ` ${s.slice(n)}`;
  }
  out.push(s);
  return out.join('\r\n');
};

// events: [{ date: 'YYYY-MM-DD', time: 'HH:MM', minutes, title, description, alarm: minutes before }]
function icsWithAlarms(events, { name = '127 plan', tz = 'America/Chicago', now = Date.now() } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Warm outreach//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`];
  events.forEach((e, i) => {
    const start = zonedToUtc(e.date, e.time || '09:00', e.tz || tz);
    L.push('BEGIN:VEVENT', `UID:warm-${i}-${e.date}@127group.io`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(start + (e.minutes || 30) * 60000)}`, `SUMMARY:${esc(e.title)}`);
    if (e.description) L.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.alarm != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${Math.max(0, Math.round(e.alarm))}M`, 'END:VALARM');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return `${L.map(fold).join('\r\n')}\r\n`;
}

module.exports = { icsWithAlarms };
