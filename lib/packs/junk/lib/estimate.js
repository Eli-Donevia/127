// The load estimate for junk removal. The parsed list (lib/parse.js) against the volume table
// (data/items.json) gives the space in the truck, counted in eighths the way the sources price it;
// the member's menu (data/prices.json at their position) gives the price; data/disposal.json gives
// the lines that need special disposal, with the state's own note where a source says something
// different; and the rate per ton the member types gives the dump fee. Nothing here is a law or a
// fee we did not read: where rules vary, the text says to check the county.

const { money, text } = require('../../_kit');
const TABLE = require('../data/items.json');
const D = require('../data/disposal.json');
const { parse, UNIT_FEET, UNIT_POUNDS } = require('./parse');

const EPS = 1e-9;
const AUTO = 'Work it out from the list';
const EIGHTH_PACKAGE = { 1: 'min', 2: 'quarter', 4: 'half', 6: 'three_quarter', 8: 'full' };
const FRACTION = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];

const cents = (n) => Math.round(n * 100) / 100;
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const unique = (xs) => [...new Set(xs)];
const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// Pounds per cubic yard of a table entry: its own density, or its EPA weight over its volume.
function densityOf(e) {
  if (!e) return null;
  if (e.lb_per_cubic_yard) return e.lb_per_cubic_yard;
  if (e.density) return e.density;
  if (e.pounds && e.cubic_feet) return (e.pounds / e.cubic_feet) * 27;
  return null;
}

// Space and weight of one part of the list.
function measure(p) {
  const e = p.entry;
  const perFoot = TABLE.weight.per_cubic_foot;
  const d = densityOf(e);
  const weigh = (feet) => (d ? (feet * d) / 27 : feet * perFoot);
  if (p.kind === 'item') {
    const cubicFeet = p.qty * e.cubic_feet;
    return { cubicFeet, pounds: e.pounds ? p.qty * e.pounds : weigh(cubicFeet), counted: true, check: '' };
  }
  if (p.kind === 'material' || p.kind === 'amount') {
    if (p.unit && UNIT_POUNDS[p.unit]) {
      const pounds = p.qty * UNIT_POUNDS[p.unit];
      return { cubicFeet: d ? (pounds / d) * 27 : pounds / perFoot, pounds, counted: true, check: '' };
    }
    if (p.unit) {
      const cubicFeet = p.qty * UNIT_FEET[p.unit];
      return { cubicFeet, pounds: weigh(cubicFeet), counted: true, check: '' };
    }
    if (p.container) {
      const cubicFeet = p.qty * p.container.cubic_feet;
      return { cubicFeet, pounds: weigh(cubicFeet), counted: true, check: '' };
    }
    const cubicFeet = TABLE.material_without_amount.cubic_feet;
    return { cubicFeet, pounds: weigh(cubicFeet), counted: true, check: 'amount' };
  }
  if (p.kind === 'unknown') {
    const cubicFeet = p.qty * TABLE.unknown.cubic_feet;
    return { cubicFeet, pounds: cubicFeet * perFoot, counted: true, check: 'unknown' };
  }
  return { cubicFeet: 0, pounds: 0, counted: false, check: '' };
}

// "about 7/8 of my truck", "about 1 full truckload and 3/8 of another"
function loadText(eighths) {
  if (!eighths) return '';
  const full = Math.floor(eighths / 8);
  const rest = eighths % 8;
  if (!full) return `about ${FRACTION[rest]} of my truck`;
  const loads = full === 1 ? '1 full truckload' : `${full} full truckloads`;
  return rest ? `about ${loads} and ${FRACTION[rest]} of another` : `about ${loads}`;
}

// "7/8 of a truck", "1 full truck and 3/8 of another", "2 full trucks"
function fractionText(eighths) {
  if (!eighths) return 'none';
  const full = Math.floor(eighths / 8);
  const rest = eighths % 8;
  if (!full) return `${FRACTION[rest]} of a truck`;
  const loads = full === 1 ? '1 full truck' : `${full} full trucks`;
  return rest ? `${loads} and ${FRACTION[rest]} of another` : loads;
}

// The menu price of a share of the truck. 3/8, 5/8 and 7/8 sit halfway between their neighbors,
// rounded the way the menu rounds (judgment call, data/items.json "eighths").
function eighthPrice(menu, n) {
  const at = (id) => (menu.packages.find((x) => x.id === id) || {}).price || 0;
  if (EIGHTH_PACKAGE[n]) return at(EIGHTH_PACKAGE[n]);
  return money.nicePrice((at(EIGHTH_PACKAGE[n - 1]) + at(EIGHTH_PACKAGE[n + 1])) / 2);
}

// The factor option the member picked, by its label or id, else the default.
function optionOf(factor, value) {
  const opts = factor.options || [];
  const v = String(value || '').toLowerCase().trim();
  return opts.find((o) => o.label.toLowerCase() === v || o.id === v || String(o.short || '').toLowerCase() === v) || opts.find((o) => o.id === factor.default) || opts[0];
}

// Special disposal for the parts of the list, from data/disposal.json, with the state's note.
function disposalFor(parts, state) {
  const flags = [];
  for (const r of D.rules) {
    const hits = parts.filter((p) => p.entry && (r.keep_out ? p.entry.keep_out === r.id : (p.entry.flags || []).includes(r.id)));
    if (!hits.length) continue;
    const note = state && r.states && r.states[state] ? r.states[state] : '';
    const said = r.replace && note ? note : [r.member, note].filter(Boolean).join(' ');
    if (!said) continue;
    flags.push({ id: r.id, label: r.label, items: unique(hits.map((p) => p.text)), text: said, state: note ? state : '', keepOut: !!r.keep_out, customer: r.customer || '' });
  }
  return flags;
}

// The member's dump numbers, as typed: rate per ton, minimum per trip, fee per appliance and per
// tire, their truck in cubic yards and its payload in pounds.
function dumpInputs(input = {}) {
  const n = (v) => {
    const x = money.num(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  return { rate: n(input.dump_rate), minimum: n(input.dump_min), applianceFee: n(input.appliance_fee), tireFee: n(input.tire_fee), truckYards: n(input.truck), payload: n(input.payload) };
}

// Trips to the dump: what fits in the truck by space and by weight. The fee: each trip's tons at the
// rate, at least the minimum, plus the fees per appliance and per tire.
function dumpFee(load, typed) {
  const truckFeet = typed.truckYards ? typed.truckYards * 27 : TABLE.truck.cubic_feet;
  const payload = typed.payload || TABLE.truck.pounds;
  const trips = Math.max(1, Math.ceil(load.cubicFeet / truckFeet - EPS), Math.ceil(load.pounds / payload - EPS));
  const truck = typed.truckYards ? `your ${round(typed.truckYards, 1)} cubic yard truck${typed.payload ? ` with a ${money.int(payload)} pound payload` : ''}` : `a ${round(TABLE.truck.cubic_feet / 27, 1)} cubic yard truck (${TABLE.truck.size}) carrying up to ${money.int(payload)} pounds`;
  if (!typed.rate) return { typed: false, trips, truck };
  const tons = load.pounds / 2000;
  const perTrip = Math.max(typed.minimum, (tons / trips) * typed.rate);
  const fee = cents(trips * perTrip);
  const itemFees = cents(typed.applianceFee * load.fridges + typed.tireFee * load.tires);
  return { typed: true, rate: typed.rate, minimum: typed.minimum, trips, truck, fee, itemFees, total: cents(fee + itemFees) };
}

// cfg: the pack config. menu: offer.menuFor. input: { items, access, material, ... }. state: a
// two-letter state code or ''. Returns everything the tool shows, or { error }.
function estimate(cfg, menu, input = {}, state = '') {
  const parts = parse(input.items);
  if (!parts.length) return { error: 'Type or paste what goes, one item per line, like "sofa" or "10 bags of trash".' };

  const lines = parts.map((p) => ({ ...p, ...measure(p) }));
  const counted = lines.filter((l) => l.counted);
  const cubicFeet = counted.reduce((n, l) => n + l.cubicFeet, 0);
  const pounds = counted.reduce((n, l) => n + l.pounds, 0);
  const heavyFeet = counted.filter((l) => l.entry && l.entry.heavy).reduce((n, l) => n + l.cubicFeet, 0);
  const heavyShare = cubicFeet > 0 ? heavyFeet / cubicFeet : 0;
  const eighths = cubicFeet > 0 ? Math.max(1, Math.ceil(cubicFeet / TABLE.truck.eighth - EPS)) : 0;
  const fullLoads = Math.floor(eighths / 8);
  const rest = eighths % 8;

  // Factors: where the items are, and what it is (worked out from the list unless they pick).
  const factors = cfg.prices.factors || [];
  const accessF = factors.find((f) => f.id === 'access');
  const materialF = factors.find((f) => f.id === 'material');
  const access = optionOf(accessF, input.access);
  const auto = !input.material || input.material === AUTO;
  const material = auto ? optionOf(materialF, heavyShare >= TABLE.heavy_share.share - EPS ? 'heavy' : 'household') : optionOf(materialF, input.material);
  const loadMult = (access.mult || 1) * (material.mult || 1);
  const loadDetail = [`${accessF.label}: ${access.label}`, `${materialF.label}: ${material.label}`].join('. ');

  const items = [];
  const pkgOf = (id) => menu.packages.find((x) => x.id === id);
  if (fullLoads) {
    const full = pkgOf('full');
    items.push({ label: full.label, detail: loadDetail, qty: fullLoads, unit: full.unit || 'load', price: money.nicePrice(full.price * loadMult) });
  }
  if (rest) {
    const id = EIGHTH_PACKAGE[rest];
    const label = id ? pkgOf(id).label : `${FRACTION[rest]} truck load`;
    items.push({ label, detail: loadDetail, qty: 1, unit: 'load', price: money.nicePrice(eighthPrice(menu, rest) * loadMult) });
  }

  // A piano or hot tub is its own job on the menu; where it sits still counts.
  const pkgs = {};
  for (const l of lines.filter((x) => x.kind === 'package')) pkgs[l.entry.package] = (pkgs[l.entry.package] || 0) + Math.max(1, Math.round(l.qty));
  const packageLines = [];
  for (const [id, qty] of Object.entries(pkgs)) {
    const p = pkgOf(id);
    if (!p) continue;
    // Each factor counts where data/prices.json says it applies (stairs do, heavy debris does not).
    const picked = [[accessF, access], [materialF, material]].filter(([f]) => !f.packages || f.packages.includes(id));
    const mult = picked.reduce((m, [, o]) => m * (o.mult || 1), 1);
    items.push({ label: p.label, detail: picked.map(([f, o]) => `${f.label}: ${o.label}`).join('. '), qty, unit: p.unit || 'job', price: money.nicePrice(p.price * mult) });
    packageLines.push(p.label);
  }

  // Add-ons: appliances with refrigerant and tires, counted from the list.
  const countOf = (addon) => lines.filter((l) => l.kind === 'item' && l.entry.addon === addon).reduce((n, l) => n + Math.ceil(l.qty - EPS), 0);
  const fridges = countOf('refrigerant');
  const tires = countOf('tire');
  for (const [id, qty] of [['refrigerant', fridges], ['tire', tires]]) {
    const a = menu.addons.find((x) => x.id === id);
    if (a && qty > 0) items.push({ label: a.label, qty, unit: a.unit || 'each', price: a.price });
  }

  let subtotal = cents(items.reduce((n, it) => n + it.price * it.qty, 0));
  const min = cfg.prices.minimum;
  if (min && subtotal > 0 && subtotal < min) {
    items.push({ label: 'Trip minimum', detail: `Jobs start at ${money.usd(min)}`, qty: 1, unit: 'each', price: cents(min - subtotal) });
    subtotal = min;
  }

  const flags = disposalFor(lines, state);
  const keepOut = flags.filter((f) => f.keepOut);
  const onsite = lines.filter((l) => l.kind === 'onsite');
  if (!items.length) {
    const why = keepOut.length ? `Everything on this list stays out of the truck (${text.list(keepOut.map((f) => f.label.toLowerCase()))}).` : onsite.length ? D.pool_table.member : 'Nothing on this list goes in the truck.';
    return { error: `${why} Add what does go, like "sofa" or "10 bags of trash".` };
  }

  const unknown = [];
  for (const l of lines) {
    if (l.check === 'unknown') unknown.push(`"${l.text}": not in the volume table, counted as ${money.int(l.cubicFeet)} cubic feet. Check it by eye.`);
    if (l.check === 'amount') unknown.push(`"${l.text}": no amount typed, counted as ${money.int(l.cubicFeet)} cubic feet. Type it like "1 cubic yard of ${l.word || 'drywall'}" or "2 pickup loads of ${l.word || 'brush'}".`);
    if (l.kind === 'amount' && l.entry && l.entry.addon) unknown.push(`"${l.text}": counted by the amount typed. Count the ${l.entry.label.toLowerCase()}s on site and add their fees to the quote.`);
  }
  if (onsite.length) flags.push({ id: 'onsite', label: 'Priced on site', items: unique(onsite.map((l) => l.text)), text: D.pool_table.member, state: '', keepOut: false, customer: '' });

  const load = {
    cubicFeet: round(cubicFeet, 1),
    cubicYards: round(cubicFeet / 27, 1),
    eighths,
    fullLoads,
    fraction: fractionText(eighths),
    material: material.label,
    heavyShare: round(heavyShare, 2),
    text: [loadText(eighths), ...packageLines.map((l) => `${text.aOrAn(l)} ${lower(l)}`)].filter(Boolean).join(' plus '),
  };

  return { parts: lines, items, subtotal, load, access: access.label, auto, flags, keepOut, onsite, unknown, pounds, fridges, tires, packages: packageLines };
}

module.exports = { estimate, measure, loadText, fractionText, eighthPrice, disposalFor, dumpInputs, dumpFee, densityOf, AUTO, FRACTION, EIGHTH_PACKAGE };
