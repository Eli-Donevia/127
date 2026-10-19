// The member's offer for a household niche: the price menu at their position (kit quote over
// data/prices.json), the offer that fits this month where they live (data/niche.json "lead_offers":
// snow in a cold January, a holiday deep clean in November), the first-clients ladder, the money
// model (attraction, core, recurring, upsell, downsell) and job math from their own costs.
// Prices are per job or per visit. Never a monthly total, never what anyone will earn.
// Shared household spine.

const { quote, money, crowd, time, brain } = require('..');
const { pkg, addon, plan } = require('./config');

const POSITIONS = ['budget', 'standard', 'premium'];

// What the member saved in the offer workflow (brain.packs.<id>.menu): { position, overrides }.
function saved(ctx, cfg) {
  const mem = brain.packMemory(ctx, cfg.id);
  return mem && mem.menu && typeof mem.menu === 'object' ? mem.menu : {};
}

// Position from the input, else what they saved, else standard.
function positionOf(ctx, cfg, input = {}) {
  const p = input.position || saved(ctx, cfg).position;
  return POSITIONS.includes(p) ? p : 'standard';
}

// The priced menu. overrides: { standard: 140, oven: 30 } (the member's own prices win).
function menuFor(ctx, cfg, { position, overrides } = {}) {
  const s = saved(ctx, cfg);
  const pos = POSITIONS.includes(position) ? position : POSITIONS.includes(s.position) ? s.position : 'standard';
  const ov = { ...(s.overrides || {}), ...(overrides || {}) };
  const m = quote.menu(cfg.prices, { position: pos, overrides: ov });
  // Per-unit rates under $20 (a square foot, a window) keep their cents instead of nicePrice's whole dollars.
  for (const list of [m.packages, m.addons]) {
    for (const item of list) {
      const src = [...(cfg.prices.packages || []), ...(cfg.prices.addons || [])].find((x) => x.id === item.id) || {};
      if (src.rate && ov[item.id] == null) item.price = rateAt(src.range, pos);
      item.rate = !!src.rate;
      item.unit = src.unit || item.unit;
    }
  }
  return m;
}

// A per-unit rate at a position, to the cent ($0.18 a square foot).
function rateAt(range, position = 'standard') {
  if (typeof range === 'number') return range;
  const [lo, hi = lo] = (range || []).map(Number);
  if (!Number.isFinite(lo)) return null;
  const t = quote.POSITION[position] != null ? quote.POSITION[position] : 0.5;
  const v = lo + (hi - lo) * t;
  return v >= 5 ? Math.round(v * 4) / 4 : Math.round(v * 100) / 100;
}

const priceOf = (m, id) => {
  const p = m.packages.find((x) => x.id === id) || m.addons.find((x) => x.id === id);
  return p ? p.price : null;
};

// A plan's price per visit, rounded the same way everywhere (offer, quote, door hanger).
function planPrice(price, planDef) {
  if (!price || !planDef || !planDef.discount) return price || null;
  return money.nicePrice(price * (1 - planDef.discount));
}

// Month (1 to 12) in the member's timezone.
function monthNow(ctx) {
  return time.partsIn(time.nowMs(ctx), time.tzOf(ctx)).m;
}

// Is it the slow season where they live? crowd.season with our best latitude.
function seasonNow(ctx, cfg, lat) {
  return crowd.season(cfg.niche.crowd, { month: monthNow(ctx), lat });
}

// The offer to lead with this month: the first entry in data "lead_offers" whose rules match.
// Entry rules: months (this month is listed), slow: true (only in the slow season where they live),
// slow: false (only outside it).
function leadOffer(cfg, { month, slow }) {
  const list = cfg.niche.lead_offers || [];
  const hit = list.find((o) => {
    if (o.slow === true && !slow) return false;
    if (o.slow === false && slow) return false;
    if (Array.isArray(o.months) && o.months.length && !o.months.includes(month)) return false;
    return true;
  });
  return hit || list[list.length - 1];
}

// The ladder: the first customers at a founding price (for photos they can share and honest
// feedback, never for a review), the next few at an early price, then the full price.
function ladderFor(cfg, price) {
  let from = 1;
  return (cfg.niche.ladder || []).map((step) => {
    const count = step.count || null;
    const who = count ? `Customers ${from} to ${from + count - 1}` : `Customer ${from} on`;
    if (count) from += count;
    const p = step.off ? money.nicePrice(price * (1 - step.off)) : price;
    return { who, label: step.label, price: p, off: step.off || 0, ask: step.ask || '', count };
  });
}

// The lead offer priced: { offer, pkg, price, founding, plan, planPrice, follow }.
function pricedLead(ctx, cfg, menu, lead, { price } = {}) {
  const p = menu.packages.find((x) => x.id === lead.package) || menu.packages[0];
  const full = price && Number(price) > 0 ? Number(price) : p.price;
  const steps = ladderFor(cfg, full);
  const founding = steps[0] ? steps[0].price : full;
  let follow = null;
  if (lead.follow_on) {
    const fp = menu.packages.find((x) => x.id === lead.follow_on.package) || p;
    const pl = plan(cfg, lead.follow_on.plan);
    follow = { label: fp.label, plan: pl ? pl.label : '', every: pl ? pl.every : '', price: planPrice(fp.price, pl), unit: fp.unit };
  }
  return { id: lead.id, label: lead.label, pkg: p, unit: p.unit, price: full, founding, ladder: steps, follow, door: lead.door || null, pitch: lead.pitch || lead.label };
}

// Money model rows from data "money_model", each priced from the menu.
function moneyModel(cfg, menu) {
  const mm = cfg.niche.money_model || {};
  const rows = [];
  const pk = (id) => menu.packages.find((x) => x.id === id);
  const ad = (id) => menu.addons.find((x) => x.id === id);
  const unitText = (u) => (u ? `per ${u}` : '');
  if (mm.attraction) {
    const p = pk(mm.attraction.package);
    const first = ladderFor(cfg, p ? p.price : 0)[0];
    rows.push({ step: 'Attraction offer', what: mm.attraction.label || (p && p.label), price: first ? first.price : p && p.price, unit: unitText(p && p.unit), note: mm.attraction.note || '' });
  }
  if (mm.core) {
    const p = pk(mm.core.package);
    if (p) rows.push({ step: 'Core offer', what: p.label, price: p.price, unit: unitText(p.unit), note: mm.core.note || '' });
  }
  if (mm.recurring) {
    const p = pk(mm.recurring.package);
    const pl = plan(cfg, mm.recurring.plan);
    if (p && pl) rows.push({ step: 'Recurring plan', what: `${p.label}, ${pl.label.toLowerCase()}`, price: planPrice(p.price, pl), unit: unitText(p.unit), note: mm.recurring.note || `Repeats every ${pl.every}. Skip or cancel any time before the next visit.` });
  }
  if (mm.upsell) {
    const a = ad(mm.upsell.addon) || pk(mm.upsell.package);
    if (a) rows.push({ step: 'Upsell', what: a.label, price: a.price, unit: unitText(a.unit), note: mm.upsell.note || '' });
  }
  if (mm.downsell) {
    const p = pk(mm.downsell.package) || ad(mm.downsell.addon);
    const pl = plan(cfg, mm.downsell.plan);
    if (p) rows.push({ step: 'Downsell', what: pl ? `${p.label}, ${pl.label.toLowerCase()}` : p.label, price: pl ? planPrice(p.price, pl) : p.price, unit: unitText(p.unit), note: mm.downsell.note || '' });
  }
  return rows;
}

// Job math for each package from the member's own costs (kit quote.jobMath): what's left per job
// after supplies and their own pay, and how many jobs cover the month's fixed costs.
function jobRows(cfg, menu, costs = {}) {
  return menu.packages
    .filter((p) => !p.rate && p.price && p.unit !== 'season')
    .map((p) => {
      const jm = quote.jobMath(p.price, p.minutes || 60, costs);
      return {
        id: p.id,
        job: p.label,
        price: p.price,
        unit: p.unit,
        hours: Math.round(((p.minutes || 60) / 60) * 10) / 10,
        supplies: jm.supplies,
        labor: jm.labor,
        left: jm.left,
        margin: jm.margin,
        jobsToCoverFixed: jm.jobsToCoverFixed,
      };
    });
}

module.exports = { POSITIONS, saved, positionOf, menuFor, rateAt, priceOf, planPrice, monthNow, seasonNow, leadOffer, ladderFor, pricedLead, moneyModel, jobRows, pkg, addon };
