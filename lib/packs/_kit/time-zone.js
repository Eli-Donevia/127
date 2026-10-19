// Wall-clock time in a timezone to a UTC timestamp: "2026-11-02" "09:00" "America/Chicago" -> ms.
// Two passes handle daylight saving changes. No dependencies.

function wallParts(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute) };
}

function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr || '09:00').split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm || 0);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = wallParts(guess, tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    guess = target - (asUtc - guess);
  }
  return guess;
}

module.exports = { zonedToUtc, wallParts };
