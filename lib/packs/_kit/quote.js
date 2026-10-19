// Price menus and instant quotes from a niche's price model (data, with sources), for every service
// business pack: detailing, cleaning, lawn, washing, tutoring, pet care, photography...
// Owner: library thread. The output line items match sales.quote and sales.invoice input:
//   { label, detail, qty, unit, price }
//
// A price model (packs/<id>/data/prices.json):
// {
//   "checked": "2026-10-19", "sources": ["https://..."],
//   "unit": "job",                                  default unit for packages
//   "minimum": 80,                                  smallest job worth driving to (optional)
//   "packages": [ { "id": "basic", "label": "Express detail", "range": [80, 150], "minutes": 90,
//                   "includes": ["Hand wash", "Vacuum"], "unit": "job" } ],
//   "factors": [ { "id": "size", "label": "Vehicle size", "options": [
//                   { "id": "car", "label": "Car", "mult": 1 }, { "id": "suv", "label": "SUV or truck", "mult": 1.2, "minutes": 20 } ] } ],
//   "addons": [ { "id": "pet_hair", "label": "Pet hair removal", "range": [25, 60], "minutes": 20 } ],
//   "plans": [ { "id": "monthly", "label": "Monthly maintenance", "every": "month", "discount": 0.15 } ]
// }
// Prices come from the model's sourced ranges and the member's position in them; the member can
// always override with their own prices. Never a claim about what anyone will earn.

const { nicePrice, round } = require('./money');

const POSITION = { budget: 0.2, standard: 0.5, premium: 0.85 };

function priceAt(range, position = 'standard') {
  if (typeof range === 'number') return range;
  if (!Array.isArray(range) || !range.length) return null;
  const [lo, hi = lo] = range.map(Number);
  const t = typeof position === 'number' ? Math.max(0, Math.min(1, position)) : POSITION[position] ?? 0.5;
  return nicePrice(lo + (hi - lo) * t);
}

// The member's price menu: every package, add-on and plan with one price each.
// overrides: { basic: 120, pet_hair: 40 } wins over the model.
function menu(model, { position = 'standard', overrides = {} } = {}) {
  const m = model || {};
  const packages = (m.packages || []).map((p) => ({
    id: p.id,
    label: p.label,
    price: overrides[p.id] != null ? Number(overrides[p.id]) : priceAt(p.range, position),
    unit: p.unit || m.unit || 'job',
    minutes: p.minutes || null,
    includes: p.includes || [],
    range: p.range || null,
  }));
  const addons = (m.addons || []).map((a) => ({
    id: a.id,
    label: a.label,
    price: overrides[a.id] != null ? Number(overrides[a.id]) : priceAt(a.range, position),
    unit: a.unit || 'each',
    minutes: a.minutes || null,
    range: a.range || null,
  }));
  const plans = (m.plans || []).map((p) => ({ id: p.id, label: p.label, every: p.every || 'month', discount: p.discount || 0, note: p.note || null }));
  return { position, unit: m.unit || 'job', minimum: m.minimum || null, packages, addons, plans, factors: m.factors || [], checked: m.checked || null, sources: m.sources || [] };
}

// One customer's quote as line items, from a priced menu (or a model, priced at `position`).
// choice: { package: 'basic', factors: { size: 'suv' }, addons: ['pet_hair'], qty: 1, plan: 'monthly' }
function quote(menuOrModel, choice = {}, { position } = {}) {
  const mnu = menuOrModel && menuOrModel.packages && menuOrModel.packages[0] && 'price' in menuOrModel.packages[0] ? menuOrModel : menu(menuOrModel, { position });
  const pkg = mnu.packages.find((p) => p.id === choice.package) || mnu.packages[0];
  if (!pkg) return { items: [], subtotal: 0, minutes: 0, notes: [] };
  let mult = 1;
  let minutes = pkg.minutes || 0;
  const picked = [];
  for (const f of mnu.factors || []) {
    const opt = (f.options || []).find((o) => o.id === (choice.factors || {})[f.id]) || (f.options || [])[0];
    if (!opt) continue;
    mult *= opt.mult || 1;
    minutes += opt.minutes || 0;
    picked.push(`${f.label}: ${opt.label}`);
  }
  const qty = Math.max(1, Number(choice.qty) || 1);
  const items = [{ label: pkg.label, detail: [...picked, ...(pkg.includes.length ? [pkg.includes.join(', ')] : [])].join('. ') || undefined, qty, unit: pkg.unit, price: nicePrice(pkg.price * mult) }];
  for (const id of choice.addons || []) {
    const a = mnu.addons.find((x) => x.id === id);
    if (!a) continue;
    items.push({ label: a.label, qty: 1, unit: a.unit, price: a.price });
    minutes += a.minutes || 0;
  }
  const notes = [];
  const plan = mnu.plans.find((p) => p.id === choice.plan);
  if (plan && plan.discount) {
    const base = items.reduce((n, it) => n + it.price * it.qty, 0);
    items.push({ label: `${plan.label} discount`, detail: `${Math.round(plan.discount * 100)}% off each visit on the ${plan.label.toLowerCase()}`, qty: 1, unit: 'each', price: -round(base * plan.discount, 2) });
    notes.push(`Repeats every ${plan.every}. Cancel any time before the next visit.`);
  }
  let subtotal = round(items.reduce((n, it) => n + it.price * it.qty, 0), 2);
  if (mnu.minimum && subtotal < mnu.minimum) {
    items.push({ label: 'Trip minimum', detail: `Jobs start at ${mnu.minimum}`, qty: 1, unit: 'each', price: round(mnu.minimum - subtotal, 2) });
    subtotal = mnu.minimum;
  }
  return { items, subtotal, minutes: minutes * qty, notes };
}

// Unit math from the member's own numbers: what's left per job and how many jobs cover fixed costs.
// costs: { perJob (supplies, gas), hourly (what the member pays themself or a helper), monthlyFixed }
function jobMath(price, minutes, costs = {}) {
  const supplies = Number(costs.perJob) || 0;
  const labor = costs.hourly ? (Number(costs.hourly) * (minutes || 60)) / 60 : 0;
  const left = round(price - supplies - labor, 2);
  const margin = price > 0 ? round(left / price, 3) : 0;
  const fixed = Number(costs.monthlyFixed) || 0;
  return { price, supplies, labor: round(labor, 2), left, margin, jobsToCoverFixed: fixed && left > 0 ? Math.ceil(fixed / left) : null };
}

module.exports = { POSITION, priceAt, menu, quote, jobMath };
