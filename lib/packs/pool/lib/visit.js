// The visit log's checks: readings typed after a pool visit, compared only with the CDC ranges in
// data/chemistry.json (free chlorine and pH, with the stabilizer and hot tub rules). Everything else
// is logged as typed. Nothing here works out a dose: a reading outside a range says what CDC says and
// points to the product label. Also the text to the owner and the visit history kept per pool.

const C = require('../data/chemistry.json');

const RANGES = C.sources.find((s) => s.id === 'ranges');

// "2.5", "2.5 ppm", "7,4" -> 2.5 / 7.4; blank or no digits -> null.
function num(v) {
  if (v == null || v === '') return null;
  const m = String(v).replace(/(\d),(\d)/, '$1.$2').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

// 2 -> "2", 2.50 -> "2.5", 7.4 -> "7.4"
const show = (n) => String(Math.round(n * 100) / 100);

const KINDS = ['Pool', 'Hot tub or spa'];
const STABILIZER = ['Not sure', 'Yes', 'No'];
const TESTS = ['DPD kit', 'Test strips', 'Other test'];

const kindOf = (v) => (/hot|spa|tub/i.test(String(v || '')) ? 'spa' : 'pool');
const stabOf = (v) => (/^y/i.test(String(v || '')) ? 'yes' : /^n(o\b|$)/i.test(String(v || '').trim()) ? 'no' : 'unsure');
const testOf = (v) => (/strip/i.test(String(v || '')) ? 'strips' : /dpd/i.test(String(v || '')) ? 'dpd' : String(v || '').trim() ? 'other' : '');

// The readings as numbers, plus any that were typed but don't read as one.
function readingsOf(input = {}) {
  const r = { fc: num(input.fc), ph: num(input.ph), cya: num(input.cya), alk: num(input.alk), hardness: num(input.hardness), salt: num(input.salt), temp: num(input.temp) };
  const bad = [];
  if (r.ph != null && (r.ph < 0 || r.ph > 14)) {
    bad.push(`"${String(input.ph).trim()}" doesn't look like a pH reading (0 to 14), so it isn't checked.`);
    r.ph = null;
  }
  for (const k of ['fc', 'cya', 'alk', 'hardness', 'salt']) {
    if (r[k] != null && r[k] < 0) {
      bad.push(`A reading below 0 isn't checked ("${String(input[k]).trim()}").`);
      r[k] = null;
    }
  }
  return { r, bad };
}

// Readings against the CDC ranges. Returns { rows, flags, notes, usesCya, inRange }.
//   rows: [{ key, reading, value, range, status, flag }] for the table and the page.
//   flags: [{ key, text, short }] readings outside a CDC range. notes: what else CDC says that applies.
function check(input = {}) {
  const kind = kindOf(input.kind);
  const spa = kind === 'spa';
  const stab = stabOf(input.stabilizer);
  const test = testOf(input.test);
  const { r, bad } = readingsOf(input);
  const usesCya = (r.cya != null && r.cya > 0) || stab === 'yes';
  const rows = [];
  const flags = [];
  const notes = [...bad];
  const P = C.pool;
  const H = C.hot_tub;
  const PH = C.ph;

  if (r.fc != null) {
    const min = spa ? H.free_chlorine_min : usesCya ? P.free_chlorine_min_cya : P.free_chlorine_min;
    const range = spa ? `At least ${H.free_chlorine_min} ppm (hot tubs)` : usesCya ? `At least ${P.free_chlorine_min_cya} ppm (with stabilizer)` : stab === 'unsure' ? `At least ${P.free_chlorine_min} ppm, ${P.free_chlorine_min_cya} ppm with stabilizer` : `At least ${P.free_chlorine_min} ppm`;
    let status = 'In CDC range';
    let flag = false;
    if (r.fc < min) {
      status = 'Below CDC minimum';
      flag = true;
      const who = spa ? 'hot tubs' : usesCya ? 'pools that use stabilizer (cyanuric acid)' : 'pools';
      flags.push({ key: 'fc', text: `Free chlorine ${show(r.fc)} ppm is below CDC's minimum of ${min} ppm for ${who}.`, short: `free chlorine ${show(r.fc)} ppm (CDC: at least ${min} ppm)` });
    } else if (!spa && stab === 'unsure' && r.fc < P.free_chlorine_min_cya) {
      status = 'Check stabilizer';
      notes.push(`Free chlorine ${show(r.fc)} ppm meets CDC's ${P.free_chlorine_min} ppm for pools. If this pool uses stabilizer (cyanuric acid) or chlorine tabs that contain it, CDC's minimum is ${P.free_chlorine_min_cya} ppm, and this reading is below it.`);
    }
    rows.push({ key: 'fc', reading: 'Free chlorine', value: `${show(r.fc)} ppm`, range, status, flag });
    if (r.fc === 0 && test !== 'strips') notes.push(`A DPD test can bleach out and read falsely low or 0 when chlorine is over ${C.dpd_bleach_above} ppm (CDC). Follow the test kit maker's directions.`);
  }

  if (r.ph != null) {
    let status = 'In CDC range';
    let flag = false;
    if (r.ph < PH.low) {
      status = 'Below CDC range';
      flag = true;
      flags.push({ key: 'ph', text: `pH ${show(r.ph)} is below CDC's range of ${PH.low.toFixed(1)} to ${PH.high.toFixed(1)}. CDC: as pH goes down, especially below ${PH.low.toFixed(1)}, pool and hot tub pipes are more likely to corrode or break down.`, short: `pH ${show(r.ph)} (CDC: ${PH.low.toFixed(1)} to ${PH.high.toFixed(1)})` });
    } else if (r.ph > PH.high) {
      status = 'Above CDC range';
      flag = true;
      flags.push({ key: 'ph', text: `pH ${show(r.ph)} is above CDC's range of ${PH.low.toFixed(1)} to ${PH.high.toFixed(1)}. CDC: as pH goes up, chlorine kills germs less well, especially above ${PH.weak_above.toFixed(1)}.`, short: `pH ${show(r.ph)} (CDC: ${PH.low.toFixed(1)} to ${PH.high.toFixed(1)})` });
    }
    rows.push({ key: 'ph', reading: 'pH', value: show(r.ph), range: `${PH.low.toFixed(1)} to ${PH.high.toFixed(1)}`, status, flag });
  }

  if (r.cya != null || (spa && stab === 'yes')) {
    if (spa && usesCya) {
      flags.push({ key: 'cya', text: 'CDC recommends not using stabilizer (cyanuric acid) or chlorine products with it in hot tubs.', short: 'stabilizer in a hot tub (CDC: none in hot tubs)' });
      rows.push({ key: 'cya', reading: 'Stabilizer (cyanuric acid)', value: r.cya != null ? `${show(r.cya)} ppm` : 'In use', range: 'None in hot tubs', status: 'Not for hot tubs', flag: true });
    } else if (r.cya != null) {
      rows.push({ key: 'cya', reading: 'Stabilizer (cyanuric acid)', value: `${show(r.cya)} ppm`, range: r.cya > 0 ? `No CDC range; chlorine needs at least ${P.free_chlorine_min_cya} ppm with it` : 'No CDC range', status: 'Logged', flag: false });
    }
  }

  const logged = [
    ['alk', 'Total alkalinity', 'ppm'],
    ['hardness', 'Calcium hardness', 'ppm'],
    ['salt', 'Salt', 'ppm'],
    ['temp', 'Water temperature', 'F'],
  ];
  for (const [k, label, unit] of logged) if (r[k] != null) rows.push({ key: k, reading: label, value: `${show(r[k])} ${unit}`, range: 'No CDC range on file', status: 'Logged', flag: false });
  const other = String(input.other || '').trim();
  if (other) rows.push({ key: 'other', reading: 'Other readings', value: other.slice(0, 200), range: 'No CDC range on file', status: 'Logged', flag: false });

  if (test === 'strips') notes.push('CDC says test strips are less accurate than a DPD test kit.');
  if (r.fc == null && r.ph == null) notes.push('Type free chlorine and pH to check them against the CDC ranges.');
  const inRange = (r.fc != null || r.ph != null) && !flags.some((f) => f.key === 'fc' || f.key === 'ph');
  return { kind, stab, test, readings: r, rows, flags, notes, usesCya, inRange };
}

const DEFAULT_DONE = ['Skimmed the surface', 'Brushed walls and steps', 'Emptied the skimmer and pump baskets'];

// "skimmed, brushed, vacuumed" -> ["Skimmed", "Brushed", "Vacuumed"]
function doneList(v) {
  const list = String(v || '')
    .split(/[,\n;]+/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return list.length ? list : DEFAULT_DONE;
}

const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// The text the member sends the owner after the visit. A reading outside a CDC range with nothing
// added leaves "[what you did about it]" for the member to fill in: the log never says what to add.
function ownerText(o) {
  const name = String(o.customer || '').trim().split(/\s+/)[0] || 'there';
  const who = o.first ? `${o.first} from ${o.business}` : o.business;
  const thing = o.check.kind === 'spa' ? 'hot tub' : 'pool';
  const parts = [`Hi ${name}, it's ${who}. Your ${thing} is done for today, ${o.dateText}.`];
  parts.push(`Done: ${o.done.map(lower).join(', ')}.`);
  const said = o.check.rows.filter((x) => ['fc', 'ph', 'cya'].includes(x.key)).map((x) => `${x.key === 'fc' ? 'free chlorine' : x.key === 'ph' ? 'pH' : 'stabilizer'} ${x.value}`);
  if (said.length) parts.push(`Readings: ${said.join(', ')}.`);
  if (o.added) parts.push(`Added: ${o.added.replace(/\.$/, '')}.`);
  let fill = false;
  if (o.check.flags.length) {
    parts.push(`Outside the CDC range today: ${o.check.flags.map((f) => f.short).join('; ')}.`);
    if (!o.added) {
      parts.push('[What you did about it.]');
      fill = true;
    }
  } else if (o.check.inRange) {
    const both = o.check.readings.fc != null && o.check.readings.ph != null;
    parts.push(both ? 'Free chlorine and pH were inside the CDC ranges when I tested.' : `${o.check.readings.fc != null ? 'Free chlorine was' : 'pH was'} inside the CDC range when I tested.`);
  }
  if (o.notes) parts.push(o.notes.replace(/\s+/g, ' ').trim().replace(/([^.!?])$/, '$1.'));
  if (o.next) parts.push(`Next visit: ${o.next.replace(/\.$/, '')}.`);
  return { text: parts.join(' '), fill };
}

// The visit history kept for each pool in this pack's memory (one remembered key, 4 KB at most):
// { [pool]: { n: name, v: [[date, free chlorine, pH, readings outside a CDC range], ...] } }, the last
// 6 visits each, oldest first. A second log on the same day replaces the first, so a re-run never
// doubles a visit, and the pools visited longest ago drop off when the book gets too big.
const KEEP_VISITS = 6;
const MAX_CHARS = 3800;
const keyOf = (customer) => String(customer || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
const isRow = (r) => Array.isArray(r) && /^\d{4}-\d{2}-\d{2}$/.test(String(r[0] || ''));
const numOrNull = (n) => (Number.isFinite(n) ? n : null);

function withVisit(all, customer, date, c) {
  const book = all && typeof all === 'object' && !Array.isArray(all) ? { ...all } : {};
  const row = [date, numOrNull(c.readings.fc), numOrNull(c.readings.ph), c.flags.length];
  const key = keyOf(customer);
  let rows = [row];
  if (key) {
    const prev = book[key] && Array.isArray(book[key].v) ? book[key].v.filter((r) => isRow(r) && r[0] !== date) : [];
    rows = [...prev, row].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).slice(-KEEP_VISITS);
    book[key] = { n: String(customer).slice(0, 40), v: rows };
    const last = (k) => {
      const v = (book[k] && Array.isArray(book[k].v) && book[k].v) || [];
      return String((v[v.length - 1] || [])[0] || '');
    };
    while (JSON.stringify(book).length > MAX_CHARS) {
      const older = Object.keys(book).filter((k) => k !== key).sort((a, b) => last(a).localeCompare(last(b)));
      if (!older.length) {
        book[key].v = book[key].v.slice(-2);
        rows = book[key].v;
        break;
      }
      delete book[older[0]];
    }
  }
  const list = rows.map((r) => ({ date: r[0], fc: numOrNull(r[1]), ph: numOrNull(r[2]), flags: Number.isInteger(r[3]) ? r[3] : 0 }));
  return { book, list };
}

module.exports = { C, RANGES, KINDS, STABILIZER, TESTS, DEFAULT_DONE, KEEP_VISITS, MAX_CHARS, num, show, check, doneList, ownerText, withVisit, keyOf, kindOf, stabOf, testOf };
