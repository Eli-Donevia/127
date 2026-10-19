// Quote a job from the niche's real variables (data/niche.json "quote.fields": bedrooms and
// bathrooms, vehicle size, lot size, square feet of driveway, window count...) priced from the
// member's menu. Line items match the sales pack's quote and invoice: { label, detail, qty, unit, price }.
//
// A field's "use" says what it drives:
//   "package"          which package (its "map" turns the member's words into package ids)
//   "qty"              how many of the package (cars at one address)
//   "factor:<id>"      a factor option (its "map": label -> option id)
//   "plan"             a recurring plan (its "map": label -> plan id, null for one time)
//   "addons"           add-ons (an array; "map": label -> add-on id)
//   "qty:<addon>"      how many of an add-on (laundry loads, screens)
//   "measure:<rate>"   a measured line priced per unit (square feet of driveway, windows)
// "derive" picks factor options from numbers (bedrooms, bathrooms and square feet to a home size;
// a lot in square feet to a lot size): the first option whose "max" fits every number given.
// Shared household spine.

const { money, text } = require('..');
const { planPrice } = require('./offer');

const ALLOWED = ['type', 'title', 'description', 'enum', 'default', 'minimum', 'maximum', 'maxLength', 'items'];

// The tool input schema for the niche's quote fields (only contract keywords).
function inputSchema(cfg) {
  const props = {};
  for (const [k, f] of Object.entries(cfg.niche.quote.fields || {})) {
    const s = {};
    for (const key of ALLOWED) if (f[key] !== undefined) s[key] = JSON.parse(JSON.stringify(f[key]));
    if (f.map && !s.enum && f.type === 'string' && f.use !== 'addons') s.enum = Object.keys(f.map);
    if (f.map && f.type === 'array') s.items = { type: 'string', enum: Object.keys(f.map) };
    props[k] = s;
  }
  return props;
}

// "Deep clean" or "deep" -> "deep"
function mapped(field, value) {
  if (value == null || value === '') return undefined;
  const map = field.map || {};
  if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
  const v = String(value).toLowerCase().trim();
  for (const [label, id] of Object.entries(map)) if (label.toLowerCase() === v || String(id).toLowerCase() === v) return id;
  return value;
}

function factorOption(factor, id) {
  return (factor.options || []).find((o) => o.id === id) || null;
}

function deriveOption(factor, nums) {
  const opts = factor.options || [];
  const given = Object.entries(nums).filter(([, v]) => Number.isFinite(v) && v > 0);
  if (!given.length) return null;
  for (const o of opts) {
    const max = o.max || {};
    if (given.every(([k, v]) => max[k] == null || v <= max[k])) return o;
  }
  return opts[opts.length - 1] || null;
}

const applies = (def, pkgId) => !def.packages || def.packages.includes(pkgId);
const cents = (n) => Math.round(n * 100) / 100;

// input: the quote tool's input. menu: from offer.menuFor. Returns
// { items, subtotal, minutes, picks, notes, advice, package, plan }.
function build(cfg, menu, input = {}) {
  const q = cfg.niche.quote || {};
  const fields = q.fields || {};
  const choice = { package: null, qty: 1, factors: {}, plan: null, addons: [], addonQty: {}, measures: [] };
  for (const [k, f] of Object.entries(fields)) {
    const v = input[k];
    const use = f.use || '';
    if (use === 'package') choice.package = mapped(f, v != null ? v : f.default);
    else if (use === 'qty') choice.qty = Math.max(1, Math.round(Number(v != null ? v : f.default) || 1));
    else if (use.startsWith('factor:')) {
      const id = mapped(f, v != null ? v : f.default);
      if (id != null) choice.factors[use.slice(7)] = id;
    } else if (use === 'plan') choice.plan = mapped(f, v != null ? v : f.default) || null;
    else if (use === 'addons') choice.addons = (Array.isArray(v) ? v : v ? String(v).split(',') : []).map((x) => mapped(f, String(x).trim())).filter(Boolean);
    else if (use.startsWith('qty:')) {
      const n = Math.round(Number(v) || 0);
      if (n > 0) choice.addonQty[use.slice(4)] = n;
    } else if (use.startsWith('measure:')) {
      const n = Number(v) || 0;
      if (n > 0) choice.measures.push({ field: k, rate: use.slice(8), qty: n, title: f.title || k });
    }
  }
  // An add-on with a count typed in counts as chosen.
  for (const id of Object.keys(choice.addonQty)) if (!choice.addons.includes(id)) choice.addons.push(id);

  const pkg = menu.packages.find((p) => p.id === choice.package) || (choice.measures.length ? null : menu.packages.find((p) => !p.rate)) || null;
  const pkgId = pkg ? pkg.id : null;
  const factors = (cfg.prices.factors || []).filter((f) => applies(f, pkgId || (choice.measures[0] && choice.measures[0].rate)));

  // Derived factors from numbers.
  for (const d of q.derive || []) {
    const f = factors.find((x) => x.id === d.factor);
    if (!f || choice.factors[f.id]) continue;
    const nums = Object.fromEntries((d.from || []).map((k) => [k, Number(input[k])]));
    const o = deriveOption(f, nums);
    if (o) choice.factors[f.id] = o.id;
  }

  const items = [];
  const notes = [];
  const picks = [];
  const short = [];
  let minutes = 0;
  let mult = 1;
  const multFor = (ids) => {
    let m = 1;
    const labels = [];
    const shorts = [];
    let add = 0;
    for (const f of factors) {
      if (ids && !ids.includes(f.id)) continue;
      const o = factorOption(f, choice.factors[f.id]) || factorOption(f, f.default) || (f.options || [])[0];
      if (!o) continue;
      m *= o.mult || 1;
      add += o.minutes || 0;
      labels.push(`${f.label}: ${o.label}`);
      shorts.push(o.short || o.label);
    }
    return { m, labels, add, shorts };
  };

  if (pkg && !pkg.rate) {
    const f = multFor(null);
    mult = f.m;
    minutes += (pkg.minutes || 0) + f.add;
    picks.push(...f.labels);
    short.push(...f.shorts);
    const price = money.nicePrice(pkg.price * mult);
    const detail = [...f.labels, pkg.includes && pkg.includes.length ? `Includes ${text.list(pkg.includes.map((s) => s.toLowerCase()))}` : ''].filter(Boolean).join('. ');
    items.push({ label: pkg.label, detail: detail ? text.clip(detail, 290) : undefined, qty: choice.qty, unit: pkg.unit, price });
    if (choice.qty > 1 && q.multi && q.multi.off) {
      const off = -cents(price * q.multi.off * (choice.qty - 1));
      items.push({ label: q.multi.label || 'Multi discount', detail: `${Math.round(q.multi.off * 100)}% off each one after the first`, qty: 1, unit: 'each', price: off });
    }
    minutes *= choice.qty;
  }

  // Measured lines: square feet, windows, linear feet.
  for (const m of choice.measures) {
    const rate = menu.packages.find((p) => p.id === m.rate) || menu.addons.find((a) => a.id === m.rate);
    if (!rate) continue;
    const src = [...(cfg.prices.packages || []), ...(cfg.prices.addons || [])].find((x) => x.id === m.rate) || {};
    const f = multFor(src.factors || []);
    const unitPrice = cents((rate.price || 0) * f.m);
    items.push({ label: rate.label, detail: [m.title && !/^how many/i.test(m.title) ? `${money.int(m.qty)} ${rate.unit}` : '', ...f.labels].filter(Boolean).join('. ') || undefined, qty: m.qty, unit: rate.unit, price: unitPrice });
    minutes += (src.minutes_per_unit || 0) * m.qty + f.add;
    picks.push(...f.labels.filter((l) => !picks.includes(l)));
  }

  // Add-ons.
  for (const id of choice.addons) {
    const a = menu.addons.find((x) => x.id === id);
    const src = (cfg.prices.addons || []).find((x) => x.id === id) || {};
    if (!a || (src.packages && pkgId && !src.packages.includes(pkgId))) continue;
    const qty = choice.addonQty[id] || 1;
    items.push({ label: a.label, qty, unit: a.unit, price: a.price });
    minutes += (a.minutes || 0) * qty;
  }

  // Recurring plan: the package line at the plan's per-visit price.
  let planOut = null;
  const pl = (cfg.prices.plans || []).find((p) => p.id === choice.plan);
  if (pl && pkg && !pkg.rate && applies(pl, pkgId)) {
    const line = items[0];
    const per = planPrice(line.price, pl);
    if (per < line.price) {
      items.push({ label: `${pl.label} price`, detail: `${money.usd(per)} per ${pkg.unit} instead of ${money.usd(line.price)}, every ${pl.every}`, qty: choice.qty, unit: 'each', price: -cents(line.price - per) });
    }
    planOut = { id: pl.id, label: pl.label, every: pl.every, perVisit: per };
    notes.push(`Repeats every ${pl.every}. ${cfg.niche.texts.plan_terms || 'Skip or cancel any time before the next visit.'}`);
  } else if (pl && pl.packages && pl.packages.length) {
    // A one-time job now (a deep clean, a cleanup), then the regular plan on its own package.
    const next = menu.packages.find((p) => p.id === pl.packages[0]);
    if (next) {
      const sized = money.nicePrice(next.price * multFor(factors.filter((f) => f.id === cfg.niche.quote.size_factor).map((f) => f.id)).m);
      const per = planPrice(sized, pl);
      planOut = { id: pl.id, label: pl.label, every: pl.every, perVisit: per, package: next.label };
      notes.push(`After this one: ${next.label.toLowerCase()} every ${pl.every} for ${money.usd(per)} a ${next.unit}. ${cfg.niche.texts.plan_terms || ''}`.trim());
    }
  }

  let subtotal = cents(items.reduce((n, it) => n + it.price * it.qty, 0));
  const min = cfg.prices.minimum;
  if (min && subtotal > 0 && subtotal < min) {
    items.push({ label: 'Trip minimum', detail: `Jobs start at ${money.usd(min)}`, qty: 1, unit: 'each', price: cents(min - subtotal) });
    subtotal = min;
  }

  // Advice from data: "when" matches the member's words or the derived factor ids.
  const advice = [];
  for (const a of q.advice || []) {
    const ok = Object.entries(a.when || {}).every(([k, want]) => {
      const have = [input[k], mapped(fields[k] || {}, input[k]), choice.factors[k], k === 'package' ? pkgId : undefined].filter((x) => x != null).map((x) => String(x).toLowerCase());
      return [].concat(want).some((w) => have.includes(String(w).toLowerCase()));
    });
    if (ok) advice.push(a.say);
  }

  return { items, subtotal, minutes: Math.round(minutes), picks, short, notes, advice, package: pkg ? { id: pkg.id, label: pkg.label, unit: pkg.unit } : null, plan: planOut, qty: choice.qty };
}

// "Standard clean (Home size: 3 bed, 2 bath): $175" lines for a text message.
function itemLines(items) {
  return items.map((it) => {
    // "2 cars", "18 windows", but "200 sq ft".
    const unit = it.unit === 'each' ? '' : `${it.unit}${/s$|\s|^ft$/.test(it.unit) ? '' : 's'} `;
    const each = it.qty > 1 ? `${money.int(it.qty)} ${unit}at ${money.usd(it.price)}`.replace(/\s+/g, ' ') : '';
    const total = money.usd(cents(it.price * it.qty));
    return `${it.label}${each ? ` (${each.trim()})` : ''}: ${total}`;
  });
}

module.exports = { inputSchema, build, itemLines, mapped, deriveOption };
