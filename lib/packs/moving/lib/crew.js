// The numbers behind "Crew and hours estimate": crew size and hours for one move from HireAHelper's
// estimating chart by home size (data/crew.json), plus the time stairs, a long carry and heavy items
// add, at the crew the member picks, priced at their hourly rate per mover. It also reads the items
// typed for pieces that need a third mover, a specialist or an appliance dolly, and for things movers
// can't carry. Pure functions: tools/crew-plan.js and the tests call them. Judgment calls (crew
// scaling, carry share, rounding) are marked in data/crew.json and said on screen.

const C = require('../data/crew.json');

const JOBS = [
  { id: 'both', label: 'Load and unload (both ends)', say: 'loading and unloading' },
  { id: 'load', label: 'Loading only', say: 'loading' },
  { id: 'unload', label: 'Unloading only', say: 'unloading' },
];
const CREWS = ['Pick for me', '2 movers', '3 movers', '4 movers'];
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const END = { load: 'pickup', unload: 'drop-off' };

const cents = (n) => Math.round(n * 100) / 100;
const toHalf = (n) => Math.round(n * 2) / 2;
const downHalf = (n) => Math.floor(n * 2 + 1e-9) / 2;
const upHalf = (n) => Math.ceil(n * 2 - 1e-9) / 2;
// "4", "4.5": hours as people say them.
const hrs = (n) => String(Math.round(n * 10) / 10);
// "(3 to 5)", or nothing when the range is one number.
const span = (lo, hi) => (lo === hi ? '' : ` (${hrs(lo)} to ${hrs(hi)})`);

// A small count from what was typed: "2", "2 flights", "two". Empty or unreadable is 0.
function count(v, max = 9) {
  const s = String(v == null ? '' : v).toLowerCase().trim();
  const m = s.match(/\d+/);
  const n = m ? parseInt(m[0], 10) : WORDS[s.split(/\s+/)[0]] || 0;
  return Math.max(0, Math.min(max, n));
}

// Feet from the truck to the door: "200", "200 ft", "about 250 feet". Capped at 1,000.
function feet(v) {
  const m = String(v == null ? '' : v).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? Math.max(0, Math.min(1000, Math.round(Number(m[0])))) : 0;
}

const homeFor = (v) => {
  const s = String(v || '').toLowerCase().trim();
  return C.homes.find((h) => h.id === s || h.label.toLowerCase() === s) || C.homes[0];
};
const jobFor = (v) => {
  const s = String(v || '').toLowerCase().trim();
  return JOBS.find((j) => j.id === s || j.label.toLowerCase() === s) || (/^unload/.test(s) ? JOBS[2] : /^load(ing)?( only)?$/.test(s) ? JOBS[1] : JOBS[0]);
};
// "3 movers" is 3; "Pick for me" or empty is null (the chart's crew).
const crewFor = (v) => {
  const m = String(v == null ? '' : v).match(/\d+/);
  return m ? Math.max(2, Math.min(6, parseInt(m[0], 10))) : null;
};

// ---------------------------------------------------------------- the items typed

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A whole word or phrase, plural allowed: "safe" finds "2 safes" but not "keep it safest".
const wordRe = (w) => new RegExp(`(^|[^a-z])${esc(w)}(s|es)?(?![a-z])`, 'i');
const found = (words, piece) => (words || []).find((w) => wordRe(w).test(piece));

// "upright piano, 2 safes and a treadmill" is three pieces.
const pieces = (typed) =>
  String(typed || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[\n,;/+&]+|\band\b|\bplus\b/)
    .map((s) => s.trim())
    .filter(Boolean);

const qtyOf = (piece) => {
  const m = piece.match(/^(\d{1,2}|one|two|three|four|five|six)\b/) || piece.match(/\bx\s?(\d{1,2})\b/);
  const n = m ? (/\d/.test(m[1]) ? parseInt(m[1], 10) : WORDS[m[1]]) : 1;
  return Math.max(1, Math.min(9, n || 1));
};

function readItems(typed) {
  const out = { heavy: [], specialist: [], appliances: [], hazards: [], perishables: [] };
  const add = (list, def, qty, extra = {}) => {
    const had = list.find((x) => x.id === def.id);
    if (had) had.qty += qty;
    else list.push({ id: def.id, label: def.label, qty, ...extra });
  };
  for (const p of pieces(typed)) {
    const q = qtyOf(p);
    // A grand piano is a specialist's job, not a heavy item: checked first, and it ends this piece.
    const spec = C.specialist.find((s) => found(s.words, p));
    if (spec) {
      add(out.specialist, spec, q, { say: spec.say });
      continue;
    }
    const heavy = C.heavy.find((h) => found(h.words, p));
    if (heavy) add(out.heavy, heavy, q);
    const app = C.appliances.find((a) => found(a.words, p));
    if (app) add(out.appliances, app, q, { say: app.say });
    for (const g of C.no_carry) {
      const w = found(g.words, p);
      if (w && !out.hazards.some((h) => h.group === g.group && h.found === w)) out.hazards.push({ group: g.group, found: w });
    }
    const per = found(C.perishable_words, p);
    if (per && !out.perishables.includes(per)) out.perishables.push(per);
  }
  for (const list of [out.heavy, out.specialist, out.appliances]) list.forEach((x) => (x.qty = Math.min(9, x.qty)));
  return out;
}

// ---------------------------------------------------------------- the estimate

// input: { home, job, stairsFrom, stairsTo, carryFrom, carryTo, items, crew, rate, heavyFee }
// rate: dollars per mover per hour. heavyFee: dollars per heavy item, on top of the time.
function estimate(input = {}) {
  const home = homeFor(input.home);
  const job = jobFor(input.job);
  const ends = job.id === 'both' ? ['load', 'unload'] : [job.id];
  const typed = readItems(input.items);
  const heavyCount = typed.heavy.reduce((s, x) => s + x.qty, 0);
  const chartCrew = home.crew;
  const picked = crewFor(input.crew);
  const warnings = [];
  let crew = picked || chartCrew;
  if (heavyCount && crew < C.heavy_min_crew) {
    if (picked) warnings.push(`Heavy items like ${typed.heavy[0].label.toLowerCase()} need at least ${C.heavy_min_crew} movers and an appliance dolly (a judgment call). Think about adding a mover.`);
    else crew = C.heavy_min_crew;
  }
  if (picked && picked < chartCrew) warnings.push(`The chart uses ${chartCrew} movers for a ${home.label.toLowerCase()}. With ${picked}, the same work takes longer on the clock.`);

  // Hours at the chart's crew, then each end's extra time: stairs, a long carry, heavy items.
  const base = { low: home.range[job.id][0], est: home.est[job.id], high: home.range[job.id][1] };
  const extra = { low: 0, est: 0, high: 0 };
  const byEnd = Object.fromEntries(ends.map((e) => [e, home.est[e]]));
  const why = [`${home.label}, ${job.say}: ${chartCrew} movers for about ${hrs(base.est)} hours${span(base.low, base.high)}, from HireAHelper's estimating chart.`];
  const [sLo, sHi] = C.stairs_hours;
  const sMid = (sLo + sHi) / 2;
  const flights = { load: count(input.stairsFrom), unload: count(input.stairsTo) };
  const carry = { load: feet(input.carryFrom), unload: feet(input.carryTo) };
  for (const e of ends) {
    const f = flights[e];
    if (f) {
      extra.low += f * sLo;
      extra.est += f * sMid;
      extra.high += f * sHi;
      byEnd[e] += f * sMid;
      why.push(`${f} ${f === 1 ? 'flight' : 'flights'} of stairs at the ${END[e]}: ${sLo * 60} to ${sHi * 60} minutes each (HireAHelper).`);
    }
    const steps = Math.max(0, Math.ceil((carry[e] - C.carry.free_feet) / C.carry.step_feet));
    if (steps) {
      const share = steps * C.carry.share;
      extra.low += share * home.range[e][0];
      extra.est += share * home.est[e];
      extra.high += share * home.range[e][1];
      byEnd[e] += share * home.est[e];
      why.push(`A ${carry[e]} foot carry at the ${END[e]}: ${steps} extra ${C.carry.step_feet} foot ${steps === 1 ? 'stretch' : 'stretches'} past ${C.carry.free_feet} feet, ${Math.round(C.carry.share * 100)}% more time each (a judgment call).`);
    }
  }
  if (heavyCount) {
    const h = heavyCount * C.heavy_hours;
    extra.low += h;
    extra.est += h;
    extra.high += h;
    ends.forEach((e) => (byEnd[e] += h / ends.length));
    why.push(`${heavyCount} heavy ${heavyCount === 1 ? 'item' : 'items'}: ${C.heavy_hours * 60} minutes each (HireAHelper).`);
  }

  // A bigger crew keeps the same mover hours, so the clock runs shorter (a judgment call), and nothing
  // goes under the 2 hour minimum.
  const k = chartCrew / crew;
  const forHeavy = !picked && heavyCount && crew > chartCrew ? `, for the heavy ${heavyCount === 1 ? 'item' : 'items'}` : '';
  if (crew !== chartCrew) why.push(`${crew} movers instead of ${chartCrew}${forHeavy}: the same mover hours, so ${crew > chartCrew ? 'fewer' : 'more'} hours on the clock (a judgment call).`);
  const raw = { low: (base.low + extra.low) * k, est: (base.est + extra.est) * k, high: (base.high + extra.high) * k };
  const hours = {
    low: Math.max(C.min_hours, downHalf(raw.low)),
    est: Math.max(C.min_hours, toHalf(raw.est)),
    high: Math.max(C.min_hours, upHalf(raw.high)),
  };
  hours.low = Math.min(hours.low, hours.est);
  hours.high = Math.max(hours.high, hours.est);
  if (raw.est < C.min_hours) why.push(`Raised to the ${C.min_hours} hour minimum (HireAHelper, Moving Help).`);

  // Each end's share of the hours, for the move-day plan.
  const total = ends.reduce((s, e) => s + byEnd[e], 0) || 1;
  const phases = ends.map((e) => ({ end: e, hours: Math.max(0.5, toHalf((hours.est * byEnd[e]) / total)) }));

  const rate = Number(input.rate) > 0 ? cents(Number(input.rate)) : 0;
  const fee = Number(input.heavyFee) > 0 ? cents(Number(input.heavyFee)) : 0;
  const fees = cents(heavyCount * fee);
  const at = (h) => cents(crew * h * rate + fees);
  const price = { low: at(hours.low), est: at(hours.est), high: at(hours.high) };
  const items = rate
    ? [
        {
          label: `Moving labor, ${crew} movers`,
          detail: `${home.label}, ${job.say}. About ${hrs(hours.est)} hours on the clock${span(hours.low, hours.high)}, billed by the actual time at ${money(rate)} per mover per hour, ${C.min_hours} hour minimum.`,
          qty: cents(crew * hours.est),
          unit: 'mover hour',
          price: rate,
        },
        ...(fee ? typed.heavy.map((h) => ({ label: `Heavy item: ${h.label.toLowerCase()}`, detail: 'Moved with a third mover and an appliance dolly', qty: h.qty, unit: 'item', price: fee })) : []),
      ]
    : [];

  return {
    home,
    job,
    ends,
    chartCrew,
    crew,
    picked: !!picked,
    flights,
    carry,
    hours,
    moverHours: cents(crew * hours.est),
    phases,
    rate,
    fee,
    heavyCount,
    price,
    items,
    why,
    warnings,
    ...typed,
  };
}

function money(n) {
  const v = Math.round(n * 100) / 100;
  return `$${Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = { C, JOBS, CREWS, estimate, readItems, homeFor, jobFor, crewFor, count, feet, hrs, span, money };
