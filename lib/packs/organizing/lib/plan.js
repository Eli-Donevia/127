// The room plan's working parts, apart from the tool so the tests can check the math: the client's
// problem lines matched to zones, time per zone, the supply list priced from dated retailer listings,
// the donation and recycling checklist and the before-and-after photo plan. All of it comes from
// data/room-plan.json: zones, keywords, weights, minimum minutes and supply quantities are our
// judgment (the file says so); room times, prices and disposal rules carry their sources.

const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'room-plan.json'), 'utf8'));
const ROOMS = DATA.rooms.map((r) => r.label);

const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "mug" matches "mug" and "mugs", "dish" matches "dishes"; "pan" never matches "pantry".
const wordRe = (w) => new RegExp(`\\b${escRe(w)}(?:s|es)?\\b`, 'i');
const round5 = (n) => Math.round(n / 5) * 5;
const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

for (const r of DATA.rooms) for (const z of r.zones) z.res = z.words.map(wordRe);
for (const d of DATA.donation) d.res = (d.words || []).map(wordRe);

// "Kitchen", "kitchen" or "reachin" -> the room; anything else -> null.
function roomOf(v) {
  const k = String(v || '').trim().toLowerCase();
  if (!k) return null;
  return DATA.rooms.find((r) => r.label.toLowerCase() === k || r.id === k) || DATA.rooms.find((r) => r.label.toLowerCase().startsWith(k)) || null;
}

// One problem per line, in the client's words.
function linesOf(v) {
  const raw = Array.isArray(v) ? v : String(v || '').split(/\r?\n|;/);
  return raw.map((s) => String(s || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30);
}

// Each line goes to the zone whose words it uses most (the earlier zone on a tie); a line no zone
// knows stays on its own list for the walk-through.
function matchLines(room, lines) {
  const byZone = new Map(room.zones.map((z) => [z.id, []]));
  const unmatched = [];
  for (const line of lines) {
    let best = null;
    let bestN = 0;
    for (const z of room.zones) {
      const n = z.res.filter((re) => re.test(line)).length;
      if (n > bestN) {
        best = z;
        bestN = n;
      }
    }
    if (best) byZone.get(best.id).push(line);
    else unmatched.push(line);
  }
  return { byZone, unmatched };
}

function fixDrift(list, key, target) {
  if (!list.length) return;
  const drift = target - list.reduce((s, z) => s + z[key], 0);
  if (!drift) return;
  const big = list.reduce((a, b) => (b[key] > a[key] ? b : a));
  big[key] = Math.max(5, big[key] + drift);
}

const clockText = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

// Time per zone. The visit opens with the walk-through and before photos and ends with the wrap-up
// (donations out, after photos, a walk through the finished zones). Zones from the client's list go
// first and get more time: each needs its minimum plus half again per problem line (up to 4). Room
// basics fill what's left only when their minimum fits; the rest goes to the next visit. Minutes are
// organizer minutes; with a helper, each zone takes about half as long on the clock.
function planTime(room, lines, { hours = 3, people = 1 } = {}) {
  const B = DATA.blocks;
  // To the quarter hour, so the walk-through, the zones and the wrap-up fill the visit exactly.
  const h = clamp(Math.round((Number(hours) || 3) * 4) / 4, 1, 12);
  const team = clamp(Math.round(Number(people) || 1), 1, 3);
  const total = Math.round(h * 60);
  const walk = B.walkthrough;
  const wrap = h > B.long_after_hours ? B.wrap_long : B.wrap;
  const work = Math.max(5, Math.floor((total - walk - wrap) / 5) * 5);
  const teamWork = work * team;
  const { byZone, unmatched } = matchLines(room, lines);
  const zones = room.zones.map((z, index) => {
    const focus = byZone.get(z.id);
    const n = focus.length;
    return {
      id: z.id,
      name: z.name,
      index,
      matched: n,
      focus,
      min: z.min,
      need: n ? round5(z.min * (1 + 0.5 * Math.min(n, 4))) : z.min,
      weight: z.weight + 2 * n,
      supplies: z.supplies || [],
      unpriced: z.unpriced || [],
    };
  });
  const listed = zones.filter((z) => z.matched).sort((a, b) => b.matched - a.matched || a.index - b.index);
  const basics = zones.filter((z) => !z.matched);
  const today = [];
  let used = 0;
  for (const z of listed) {
    if (used + z.need <= teamWork) {
      today.push({ ...z, give: z.need });
      used += z.need;
    } else if (used + z.min <= teamWork) {
      today.push({ ...z, give: z.min });
      used += z.min;
    }
  }
  // The client's list comes first: when none of it fits, the visit starts on the first item and
  // finishes it next time, rather than on a zone they never mentioned.
  if (!listed.length || today.length) {
    for (const z of basics) {
      if (used + z.min <= teamWork) {
        today.push({ ...z, give: z.min });
        used += z.min;
      }
    }
  }
  // Too short for any zone's minimum: start on the first one and finish it next time.
  const partial = !today.length;
  if (partial) {
    today.push({ ...(listed[0] || basics[0]), give: teamWork });
    used = teamWork;
  }
  const spare = teamWork - used;
  const wsum = today.reduce((s, z) => s + z.weight, 0) || 1;
  for (const z of today) z.minutes = round5(z.give + (spare * z.weight) / wsum);
  fixDrift(today, 'minutes', teamWork);
  for (const z of today) z.clock = round5(z.minutes / team);
  fixDrift(today, 'clock', work);
  let at = walk;
  for (const z of today) {
    z.start = at;
    z.end = at + z.clock;
    at = z.end;
  }
  const out = today.map((z) => ({
    id: z.id,
    name: z.name,
    minutes: z.minutes,
    clock: z.clock,
    time: `${clockText(z.start)} to ${clockText(z.end)}`,
    focus: z.focus,
    focus_text: z.focus.length ? z.focus.join('; ') : 'Room basics',
    from_list: z.matched > 0,
    matched: z.matched,
    supplies: z.supplies,
    unpriced: z.unpriced,
  }));
  const later = zones
    .filter((z) => !today.some((t) => t.id === z.id))
    .map((z) => ({ id: z.id, name: z.name, minutes: z.need, focus: z.focus, from_list: z.matched > 0 }));
  if (partial) later.unshift({ id: out[0].id, name: `${out[0].name} (the rest)`, minutes: Math.max(5, today[0].need - teamWork), focus: [], from_list: out[0].from_list });
  const laterWork = later.reduce((s, z) => s + z.minutes, 0);
  // Hours on the clock for the next visit, with a wrap-up, rounded up to the half hour.
  const laterHours = later.length ? Math.ceil((laterWork / team + B.wrap) / 30) / 2 : 0;
  return {
    hours: h,
    people: team,
    total,
    walk: { name: 'Walk-through and before photos', minutes: walk, time: `${clockText(0)} to ${clockText(walk)}` },
    wrap: { name: 'Wrap-up: donations out, after photos, a walk through the finished zones', minutes: wrap, time: `${clockText(total - wrap)} to ${clockText(total)}` },
    work,
    team_minutes: teamWork,
    zones: out,
    later,
    later_hours: laterHours,
    unmatched,
    partial,
  };
}

// Today's zones' supplies, plus boxes for donations: a zone whose main item is a bin or a drawer
// organizer gets one more for each problem line in it (up to 2). Priced low to high from the
// listings, before tax; the organizer's own label maker and tape are listed apart, never billed.
const MORE_PER_LINE = new Set(['bin', 'drawer']);
function supplyList(plan) {
  const qty = new Map();
  const add = (id, n) => qty.set(id, (qty.get(id) || 0) + n);
  for (const z of plan.zones) z.supplies.forEach(([id, n], i) => add(id, n + (i === 0 && MORE_PER_LINE.has(id) ? Math.min(2, z.matched) : 0)));
  add('box', plan.hours > DATA.blocks.long_after_hours ? DATA.donation_boxes.long : DATA.donation_boxes.short);
  const items = Object.keys(DATA.supplies)
    .filter((id) => qty.has(id))
    .map((id) => {
      const s = DATA.supplies[id];
      const n = qty.get(id);
      const prices = s.sources.map((x) => x.price);
      return {
        id,
        item: s.label,
        unit: s.unit,
        qty: n,
        each_low: s.low,
        each_high: s.high,
        low: round2(n * s.low),
        high: round2(n * s.high),
        where: [...new Set(s.sources.map((x) => x.publisher))],
        listings: s.sources.length,
        cheapest: s.sources[prices.indexOf(Math.min(...prices))],
        priciest: s.sources[prices.indexOf(Math.max(...prices))],
      };
    });
  const low = Math.floor(items.reduce((sum, it) => sum + it.low, 0));
  const high = Math.ceil(items.reduce((sum, it) => sum + it.high, 0));
  const kit = Object.entries(DATA.supplies)
    .filter(([, s]) => s.kit)
    .map(([id, s]) => ({ id, item: s.label, unit: s.unit, each_low: s.low, each_high: s.high, listings: s.sources.length }));
  return {
    items,
    low,
    high,
    unpriced: [...new Set(plan.zones.flatMap((z) => z.unpriced || []))],
    kit,
    kit_unpriced: DATA.kit_unpriced,
    checked: DATA.checked,
  };
}

const sourceOf = (k) => {
  const s = DATA.sources[k];
  return { publisher: s.publisher, url: s.url, says: s.says };
};

// The checklist lines that apply: three every time (donations, recycling, the receipt), the rest by
// room or by a word in the client's list ("paint", "old phones", "pills").
function donationList(room, lines) {
  const all = lines.join('\n');
  return DATA.donation
    .filter((d) => d.always || (d.rooms || []).includes(room.id) || d.res.some((re) => re.test(all)))
    .map((d) => ({ id: d.id, title: d.title, line: d.line, judgment: !!d.judgment, sources: (d.src || []).map(sourceOf) }));
}

function photoPlan(plan) {
  const P = DATA.photo;
  return {
    permission: P.permission,
    steps: P.steps,
    shots: ['Wide, from the doorway', ...plan.zones.map((z) => z.name)],
    sources: P.src.map(sourceOf),
  };
}

function typicalFor(room) {
  return [...room.typical, ...DATA.general_typical].map((t) => ({ ...sourceOf(t.src), says: t.says }));
}

module.exports = { DATA, ROOMS, roomOf, linesOf, wordRe, matchLines, planTime, supplyList, donationList, photoPlan, typicalFor, clockText };
