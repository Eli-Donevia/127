// The Roofline plan's math, apart from the tool so the tests can check it without a run: typed runs
// in ("Front gutter 48", "Garage peaks 2 x 18", "2nd story gutter 52 steep", "Maple tree 60"), then
// bulbs, clips, stakes, wire, plugs and cords, runs packed onto circuits under the 80% rule, the
// price from the member's per-foot rates, and the install, takedown and storage dates.
// Every fact and its sources: data/roofline.json. Prices: data/prices.json through the member's menu.

const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'roofline.json'), 'utf8'));

const MODELS = [
  { id: 'lease', label: 'My lights, leased for the season', short: 'with my lights' },
  { id: 'own', label: 'Their own lights', short: 'with their lights' },
  { id: 'buy', label: 'Lights they buy and keep', short: 'with lights they keep' },
];
const BULBS = [
  { id: 'led', label: 'LED C9' },
  { id: 'incandescent', label: 'Incandescent C9' },
];
const SPACINGS = DATA.spacing.options.map((n) => `${n} inches`);
const BREAKERS = DATA.circuit.breakers.map((n) => `${n} amp`);
const MAX_RUNS = 40;
const MAX_FEET = 2000;

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const cents = (n) => Math.round(n * 100) / 100;
const KIND_LABEL = { roofline: 'Roofline and trim', ground: 'Walkway or drive', tree: 'Tree wrap' };

const TREE = /\b(trees?|trunks?|wraps?|wrapped|shrubs?|bush(?:es)?|hedges?|palms?|evergreens?|spruces?|pines?|maples?|oaks?|birch(?:es)?|elms?|magnolias?|junipers?|arborvitaes?)\b/i;
const GROUND = /\b(walks?|walkways?|paths?|pathways?|sidewalks?|drives?|driveways?|borders?|beds?|gardens?|lawns?|landscape|stakes?|edging)\b/i;
const STORY3 = /\b(?:3rd|third)\b|\b(?:3|three)[\s-]*stor(?:y|ies|ey)\b/i;
const STORY2 = /\b(?:2nd|second|upper|upstairs)\b|\b(?:2|two)[\s-]*stor(?:y|ies|ey)\b/i;
const STEEP = /\b(?:steep|high|hard[\s-]to[\s-]reach|hard to get to|pitched)\b/i;
const SIDES = /\b(?:both|two|2)\s+sides\b/i;
const SMALL = /\b(?:small|little|short|shrubs?|bush(?:es)?|hedges?)\b/i;
const LARGE = /\b(?:tall|large|big|huge|giant)\b/i;
// Story numbers ("2nd story", "2-story") and "2 sides" are never feet of lights; a tree's height
// ("12 ft tall") isn't either. They are blanked out before the feet are read, and stay in the name.
const STORY_DIGITS = /\b\d+(?:st|nd|rd|th)\b(?:[\s-]*(?:stor(?:y|ies|ey)|floor|level))?|\b\d+[\s-]*stor(?:y|ies|ey)\b/gi;
const SIDES_G = /\b(?:both|two|2)\s+sides\b/gi;
const HEIGHT = /(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')?\s*(?:tall|high)\b/i;
const TIMES = /(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)/i;
const WITH_UNIT = /(\d+(?:\.\d+)?)\s*(?:ft\b|feet\b|foot\b|')/i;
const NUMBER = /\d+(?:\.\d+)?/g;

const upper = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
// "box of 25" -> "1 box of 25", "10 boxes of 25".
const packText = (n, label) => (n === 1 ? `1 ${label}` : `${n} ${label.replace(/^\w+/, (w) => (/(x|s|ch|sh)$/.test(w) ? `${w}es` : `${w}s`))}`);
const blank = (s, re) => s.replace(re, (m) => ' '.repeat(m.length));
const cut = (s, at, len) => `${s.slice(0, at)}${' '.repeat(len)}${s.slice(at + len)}`;

// One typed line: { name, kind, story, steep, size, feet } or { skip: why }.
function parseLine(raw) {
  const line = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!line) return null;
  const flat = line.replace(/(\d),(\d{3})\b/g, '$1$2');
  const kind = TREE.test(flat) ? 'tree' : GROUND.test(flat) ? 'ground' : 'roofline';
  const story = kind === 'roofline' ? (STORY3.test(flat) ? 3 : STORY2.test(flat) ? 2 : 1) : 1;
  const steep = kind === 'roofline' && STEEP.test(flat);
  const sides = SIDES.test(flat) ? 2 : 1;
  let masked = blank(blank(flat, STORY_DIGITS), SIDES_G);
  let height = null;
  if (kind === 'tree') {
    const h = HEIGHT.exec(masked);
    if (h) {
      height = Number(h[1]);
      masked = cut(masked, h.index, h[0].length);
    }
  }
  let feet = null;
  let span = null;
  const times = TIMES.exec(masked);
  const unit = times ? null : WITH_UNIT.exec(masked);
  if (times) {
    feet = Number(times[1]) * Number(times[2]);
    span = [times.index, times[0].length];
  } else if (unit) {
    feet = Number(unit[1]);
    span = [unit.index, unit[0].length];
  } else {
    const nums = [...masked.matchAll(NUMBER)];
    const last = nums[nums.length - 1];
    if (last) {
      feet = Number(last[0]);
      span = [last.index, last[0].length];
    }
  }
  const name = upper(
    (span ? cut(flat, span[0], span[1]) : flat)
      .replace(/\s+/g, ' ')
      .replace(/^[\s:;,=*-]+|[\s:;,=*-]+$/g, '')
      .replace(/\s+([:;,])/g, '$1')
      .slice(0, 60)
      .trim(),
  );
  if (feet == null || !Number.isFinite(feet)) {
    return { skip: kind === 'tree' ? `"${line}": type the feet of lights for this tree, like "Maple tree 60".` : `"${line}": no length. Type where it goes, then its feet, like "Front gutter 48".` };
  }
  feet = round(feet * sides, 1);
  if (feet < 1) return { skip: `"${line}": under 1 foot.` };
  if (feet > MAX_FEET) return { skip: `"${line}": over ${MAX_FEET.toLocaleString('en-US')} ft on one line. Split it into runs.` };
  let size = null;
  if (kind === 'tree') {
    if (height != null) size = height <= 8 ? 'small' : height <= 18 ? 'medium' : 'large';
    else size = LARGE.test(flat) ? 'large' : SMALL.test(flat) ? 'small' : 'medium';
  }
  return { name, kind, story, steep, size, feet, sides: sides > 1, line };
}

// All typed lines: { runs, skipped }. Runs are numbered in the order typed.
function parseRuns(textIn) {
  const lines = String(textIn || '')
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  const runs = [];
  const skipped = [];
  for (const l of lines) {
    const r = parseLine(l);
    if (!r) continue;
    if (r.skip) {
      skipped.push(r.skip);
      continue;
    }
    if (runs.length >= MAX_RUNS) {
      skipped.push(`"${l}": over ${MAX_RUNS} runs. Make a second plan for the rest.`);
      continue;
    }
    const n = runs.length + 1;
    runs.push({ n, ...r, name: r.name || `Run ${n}` });
  }
  return { runs, skipped };
}

// Watts a circuit may carry under the 80% rule: 15 A -> 1,440 W, 20 A -> 1,920 W at 120 V.
function circuitWatts(breaker) {
  return Math.round(Number(breaker) * DATA.circuit.volts * DATA.circuit.share);
}
// Watts one run of spool wire may carry end to end: 7 A x 120 V = 840 W.
const runWatts = () => DATA.run.amps * DATA.circuit.volts;
const cordWatts = () => DATA.cord.amps * DATA.circuit.volts;

// Bulbs, mounts, feeds and circuits for parsed runs.
// opts: { spacing (inches), watts (per bulb), breaker (amps), circuits (how many the house has, optional) }
function power(runs, { spacing = DATA.spacing.default, watts = DATA.bulbs.led.watts, breaker = 15, circuits = null } = {}) {
  const perRun = runWatts();
  const cap = circuitWatts(breaker);
  const list = runs.map((r) => {
    const sockets = Math.ceil((r.feet * 12) / spacing - 1e-9);
    const w = round(sockets * watts, 1);
    const parts = Math.max(1, Math.ceil(w / perRun - 1e-9));
    return { ...r, sockets, watts: w, parts, clips: r.kind === 'roofline' ? sockets : 0, stakes: r.kind === 'ground' ? sockets : 0 };
  });
  // A feed is one plug-in: a run, or one part of a run too long for its wire.
  const feeds = [];
  for (const r of list) {
    let left = r.sockets;
    for (let i = 0; i < r.parts; i++) {
      const s = Math.ceil(left / (r.parts - i));
      left -= s;
      feeds.push({ run: r.n, part: i + 1, of: r.parts, sockets: s, watts: round(s * watts, 1) });
    }
  }
  // Circuits: the biggest feeds first, each onto the first circuit with room under the 80% line.
  const bins = [];
  for (const f of [...feeds].sort((a, b) => b.watts - a.watts || a.run - b.run || a.part - b.part)) {
    let bin = bins.find((b) => b.watts + f.watts <= cap + 1e-9);
    if (!bin) {
      bin = { n: bins.length + 1, watts: 0, feeds: [] };
      bins.push(bin);
    }
    bin.watts = round(bin.watts + f.watts, 1);
    bin.feeds.push(f);
    f.circuit = bin.n;
  }
  for (const r of list) r.circuits = [...new Set(feeds.filter((f) => f.run === r.n).map((f) => f.circuit))].sort((a, b) => a - b);
  const total = round(list.reduce((s, r) => s + r.watts, 0), 1);
  const have = Number.isInteger(circuits) && circuits > 0 ? circuits : null;
  return {
    runs: list,
    feeds,
    circuits: bins.map((b) => ({ n: b.n, watts: b.watts, cap, share: round(b.watts / cap, 3), runs: [...new Set(b.feeds.map((f) => f.run))].sort((x, y) => x - y) })),
    watts: total,
    amps: round(total / DATA.circuit.volts, 2),
    cap,
    perRun,
    perCord: cordWatts(),
    breaker: Number(breaker),
    have,
    short: have != null && bins.length > have ? bins.length - have : 0,
  };
}

// What to buy and what it costs you. model: lease | own | buy. bulbType: led | incandescent.
function materials(pw, { model = 'lease', spacing = DATA.spacing.default, bulbType = 'led' } = {}) {
  const M = DATA.materials;
  const R = DATA.rules;
  const feet = round(pw.runs.reduce((s, r) => s + r.feet, 0), 1);
  const feeds = pw.feeds.length;
  const sockets = pw.runs.reduce((s, r) => s + r.sockets, 0);
  const clips = pw.runs.reduce((s, r) => s + r.clips, 0);
  const stakes = pw.runs.reduce((s, r) => s + r.stakes, 0);
  const spare = Math.ceil(sockets * R.spares.share - 1e-9);
  const wireFeet = Math.ceil(feet + R.lead.feet * feeds);
  const theirs = model === 'own';
  const each = (m) => (m.range ? [m.range[0] / m.pack, m.range[1] / m.pack] : null);
  const cost = (m, qty) => (m.range ? [cents(each(m)[0] * qty), cents(each(m)[1] * qty)] : null);
  const rows = [];
  const add = (key, m, need, unitWord, opts = {}) => {
    if (!need) return;
    const packs = Math.ceil(need / m.pack - 1e-9);
    const priced = opts.unpriced ? null : cost(m, need);
    rows.push({
      key,
      item: opts.label || m.label,
      need,
      unit: unitWord,
      buy: m.pack > 1 ? packText(packs, m.pack_label) : `${need}`,
      ...(priced ? { low: priced[0], high: priced[1] } : {}),
      who: opts.who,
      ...(opts.note || (!priced && !opts.theirs) ? { note: opts.note || 'check current rates' } : {}),
      counted: !opts.theirs && !!priced,
    });
  };
  const keep = model === 'buy' ? 'Sold to them' : 'Yours, used again each season';
  if (theirs) {
    rows.push({ key: 'lights', item: 'Their lights', need: sockets, unit: 'bulbs', buy: 'Theirs: test every strand first', who: 'Theirs', counted: false });
  } else {
    add('wire', M.wire, wireFeet, 'ft', { who: keep, unpriced: spacing !== DATA.spacing.spool, note: spacing !== DATA.spacing.spool ? `check current rates for ${spacing} inch wire` : `${R.lead.feet} ft of lead per plug-in included` });
    if (bulbType === 'led') add('bulbs', M.bulbs, sockets + spare, 'bulbs', { who: keep, note: `${spare} spares included` });
    else add('bulbs', { ...M.bulbs, label: 'Incandescent C9 bulbs', range: null }, sockets + spare, 'bulbs', { who: keep, note: `${spare} spares included; check current rates` });
    add('plugs', M.plugs, R.plugs.per_run * feeds, 'plugs', { who: 'Yours', note: 'check current rates' });
  }
  add('clips', M.clips, clips, 'clips', { who: 'Yours' });
  add('stakes', M.stakes, stakes, 'stakes', { who: 'Yours' });
  add('cords', M.cords, feeds, 'cords', { who: 'Yours, used again each season' });
  add('timers', M.timers, pw.circuits.length, 'timers', { who: model === 'lease' ? 'Yours, used again each season' : 'Sold to them' });
  const counted = rows.filter((r) => r.counted);
  const low = cents(counted.reduce((s, r) => s + r.low, 0));
  const high = cents(counted.reduce((s, r) => s + r.high, 0));
  const lights = rows.filter((r) => r.counted && (r.key === 'wire' || r.key === 'bulbs'));
  return {
    rows,
    feet,
    wireFeet,
    sockets,
    spare,
    clips,
    stakes,
    cords: feeds,
    timers: pw.circuits.length,
    plugs: theirs ? 0 : R.plugs.per_run * feeds,
    cost: { low, high },
    lights: lights.length ? { low: cents(lights.reduce((s, r) => s + r.low, 0)), high: cents(lights.reduce((s, r) => s + r.high, 0)) } : null,
    unpriced: rows.filter((r) => !r.counted && r.who !== 'Theirs').map((r) => r.item),
  };
}

// Line items for sales.quote from the member's rates.
// prices: { rates: { lease, install, takedown, lights }: { label, price, mpu }, trees: { small, medium }: { label, price, minutes },
//   timer: { label, price }, minimum, plan: { label, discount } }
function priceRuns(pw, { model = 'lease', prices, circuits }) {
  const R = prices.rates;
  const items = [];
  const runs = pw.runs;
  const priced = runs.filter((r) => !(r.kind === 'tree' && r.size === 'large'));
  const flat = priced.filter((r) => r.kind !== 'tree');
  const trees = priced.filter((r) => r.kind === 'tree');
  const sum = (list) => round(list.reduce((s, r) => s + r.feet, 0), 1);
  const flatFeet = sum(flat);
  const treeFeet = sum(trees);
  const allFeet = round(flatFeet + treeFeet, 1);
  const upperRuns = flat.filter((r) => r.kind === 'roofline' && r.story >= 2);
  const upperFeet = sum(upperRuns);
  const base = model === 'lease' ? R.lease : R.install;
  const line = (label, detail, qty, unit, price) => ({ label: String(label).slice(0, 120), ...(detail ? { detail: String(detail).slice(0, 300) } : {}), qty, unit, price: cents(price) });
  const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
  const what = (list) => [...new Set(list.map((r) => KIND_LABEL[r.kind].toLowerCase()))].join(' and ');

  if (model === 'buy' && allFeet) items.push(line(R.lights.label, 'Commercial C9 wire and bulbs, theirs to keep', allFeet, 'ft', R.lights.price));
  if (flatFeet) {
    const detail = model === 'lease' ? `${fmt(flatFeet)} ft of ${what(flat)}: lights, install, fixes during the season, takedown and storage` : `${fmt(flatFeet)} ft of ${what(flat)}, clipped or staked and hung straight`;
    items.push(line(base.label, detail, flatFeet, 'ft', base.price));
  }
  if (upperFeet) items.push(line('Upper story labor', `${fmt(upperFeet)} ft above the first story: ${upperRuns.map((r) => r.name).join(', ')}`, upperFeet, 'ft', R.install.price));
  const steep = flat.filter((r) => r.kind === 'roofline' && r.steep);
  if (steep.length) {
    const extra = steep.reduce((s, r) => s + r.feet * base.price + (r.story >= 2 ? r.feet * R.install.price : 0), 0) * (DATA.rules.steep.mult - 1);
    items.push(line('Hard to reach, 20% more', steep.map((r) => r.name).join(', '), 1, 'job', extra));
  }
  for (const t of trees) {
    const wrap = prices.trees[t.size] || prices.trees.medium;
    items.push(line(wrap.label, `${t.name}, ${fmt(t.feet)} ft of lights`, 1, 'tree', wrap.price));
  }
  // Leased tree lights: the lights by the foot plus their takedown by the foot (the wrap price is labor).
  if (treeFeet && model === 'lease') items.push(line('Lights for the trees, by the foot', 'My lights for the season, taken down and stored with the rest', treeFeet, 'ft', R.lights.price + R.takedown.price));
  if (model !== 'lease' && allFeet) items.push(line(R.takedown.label, `All ${fmt(allFeet)} ft taken down, tested, labeled and boxed in January`, allFeet, 'ft', R.takedown.price));
  if (model !== 'lease' && circuits) items.push(line(prices.timer.label, `One for each circuit, set for the evening hours`, circuits, 'each', prices.timer.price));
  let subtotal = cents(items.reduce((s, i) => s + cents(i.qty * i.price), 0));
  if (items.length && prices.minimum && subtotal < prices.minimum) {
    items.push(line('Trip minimum', 'Your minimum for one visit', 1, 'job', prices.minimum - subtotal));
    subtotal = cents(items.reduce((s, i) => s + cents(i.qty * i.price), 0));
  }
  const perFoot = allFeet ? cents(subtotal / allFeet) : 0;
  const plan = prices.plan && model !== 'buy' && subtotal ? { label: prices.plan.label, discount: prices.plan.discount, price: nice(subtotal * (1 - prices.plan.discount)) } : null;
  // Minutes from the menu's minutes per foot, plus each tree wrap's minutes.
  const treeMinutes = trees.reduce((s, t) => s + ((prices.trees[t.size] || prices.trees.medium).minutes || 0), 0);
  const installMinutes = roundUp(flatFeet * (R.install.mpu || 1) + upperFeet * (R.install.mpu || 1) + treeMinutes);
  const takedownMinutes = roundUp(allFeet * (R.takedown.mpu || 0.4));
  return { items, subtotal, perFoot, feet: allFeet, flatFeet, treeFeet, upperFeet, plan, minutes: { install: installMinutes, takedown: takedownMinutes }, large: runs.filter((r) => r.kind === 'tree' && r.size === 'large').map((r) => r.name) };
}

const roundUp = (m) => Math.max(30, Math.ceil(m / 15) * 15);

// The same rounding the menu uses for a price people are used to seeing.
function nice(v) {
  if (!(v > 0)) return 0;
  if (v < 20) return Math.max(1, Math.round(v));
  if (v < 200) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 25) * 25;
  if (v < 5000) return Math.round(v / 50) * 50;
  return Math.round(v / 100) * 100;
}

const isDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = String(s).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
function addDays(dateStr, n) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

// Install, mid-season check, takedown, storage and next season. today: 'YYYY-MM-DD'.
function datesFor(today, { install, takedown } = {}) {
  const D = DATA.dates;
  const notes = [];
  const [y, m] = today.split('-').map(Number);
  const typedInstall = String(install || '').trim();
  let inst = isDate(typedInstall) ? typedInstall : null;
  if (typedInstall && !inst) notes.push(`"${typedInstall}" isn't a date like 2026-11-07, so the plan uses the next install window.`);
  if (!inst) {
    const soon = addDays(today, 7);
    if (m <= 9) inst = `${y}-${D.install_from}` > soon ? `${y}-${D.install_from}` : soon;
    else inst = soon <= `${y}-12-20` ? soon : `${y + 1}-${D.install_from}`;
  } else if (inst < today) notes.push('The install date is in the past: check it.');
  const iy = Number(inst.slice(0, 4));
  let down = `${iy}-${D.takedown_from}`;
  if (down <= addDays(inst, 7)) down = `${iy + 1}-${D.takedown_from}`;
  const typedDown = String(takedown || '').trim();
  if (typedDown) {
    if (isDate(typedDown) && typedDown > inst) down = typedDown;
    else notes.push(`The takedown date has to be a date after the install, so the plan uses ${down}.`);
  }
  const ty = Number(down.slice(0, 4));
  const check = addDays(inst, D.check_days);
  return {
    install: inst,
    check: check < down ? check : null,
    takedown: down,
    takedownBy: down.slice(5, 7) === '01' ? `${ty}-${D.takedown_to}` : null,
    rebook: `${ty}-${D.rebook}`,
    back: `${ty}-${D.install_from}`,
    notes,
  };
}

module.exports = { DATA, MODELS, BULBS, SPACINGS, BREAKERS, KIND_LABEL, MAX_RUNS, MAX_FEET, parseLine, parseRuns, power, materials, priceRuns, datesFor, circuitWatts, runWatts, cordWatts, nice, isDate, addDays };
