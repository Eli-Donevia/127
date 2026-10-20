// The window count estimate: window counts by type and floor (standard, picture, French or divided
// panes), inside and out or one side, plus skylights, screens, tracks and hard water spots, give the
// minutes per pane and time on site, a price from the member's per-window and per-pane rates (kit
// menu over data/prices.json, every range sourced), the gear each floor needs, the checks to make
// before the job (each with its source) and a one-page estimate sheet for the customer.
// The math and the page live here; the tool is tools/count-estimate.js. Windows pack.

const { text, money, files, qr } = require('../../_kit');
const pages = require('../../_kit/home/pages');
const print = require('../../_kit/home/print');
const words = require('../../_kit/home/words');

const esc = files.esc;
const cents = (n) => Math.round(n * 100) / 100;
const usd = (n) => (n == null || n === '' ? '' : money.usd(n).replace(/\.00$/, ''));

// The member's words for each choice, and the ids they map to.
const SIDES = { 'Inside and out': 'both', 'Outside only': 'out', 'Inside only': 'in' };
const FREQUENCY = { 'One time': null, 'Every 6 months': 'twice', 'Every 3 months': 'quarterly' };
const FLOOR_WORDS = { 2: 'two floors', 3: 'three floors' };
const TITLE_WORDS = { window: ['standard window', 'standard windows'], picture: ['picture window', 'picture windows'], small_pane: ['French pane', 'French panes'] };

// The count fields: one per window type and floor the type is found on (standard_1 is standard
// windows on the first floor), from data/prices.json "estimate".
function countFields(cfg) {
  const E = cfg.prices.estimate;
  const out = [];
  for (const t of E.types) {
    if (t.addon) continue;
    for (const n of t.floors || [1]) {
      const floor = E.floors.find((x) => x.floor === n);
      if (floor) out.push({ key: `${t.id}_${n}`, type: t, floor, title: `${t.label}, ${floor.label.toLowerCase()}` });
    }
  }
  return out;
}

// The extras counted on their own: skylights, then the add-ons charged per screen or per window.
function extraFields(cfg) {
  const E = cfg.prices.estimate;
  const sky = E.types.find((t) => t.addon) || { addon: 'skylight', pane_minutes: 20 };
  return [
    { key: 'skylights', addon: sky.addon, minutes: sky.pane_minutes, pane: true, title: 'Skylights' },
    { key: 'screens', addon: 'screens', minutes: E.screen_minutes, title: 'Screens to wash' },
    { key: 'tracks', addon: 'tracks', minutes: E.track_minutes, title: 'Windows with track detailing' },
    { key: 'hard_water', addon: 'hard_water', minutes: E.hard_water_minutes, title: 'Windows with hard water spots' },
  ];
}

const sideOf = (v) => SIDES[v] || (Object.values(SIDES).includes(v) ? v : 'both');
const planOf = (cfg, v) => {
  const id = Object.prototype.hasOwnProperty.call(FREQUENCY, v) ? FREQUENCY[v] : v;
  return id ? (cfg.prices.plans || []).find((p) => p.id === id && (p.packages || []).includes('window')) || null : null;
};
const countOf = (v) => {
  const n = Math.round(Number(String(v == null ? '' : v).replace(/[^\d.]/g, '')));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 0;
};

// input: the counts, sides and frequency. menu: from kit offer.menuFor (the member's own prices).
// Returns the rows (minutes per pane), line items for the Sales desk, the total, time on site, the
// gear and the checks.
function compute(cfg, menu, input = {}) {
  const E = cfg.prices.estimate;
  const X = cfg.niche.estimate || {};
  const sideId = sideOf(input.sides);
  const sidesF = (cfg.prices.factors || []).find((f) => f.id === 'sides') || { options: [{ id: 'both', label: 'Inside and out', mult: 1 }] };
  const side = sidesF.options.find((o) => o.id === sideId) || sidesF.options[0];
  const sideTime = E.sides_time && E.sides_time[side.id] != null ? E.sides_time[side.id] : 1;
  // Upper floors cost more and take longer only when the outside is cleaned (ladder or pole work).
  // Inside only, every floor is cleaned from inside at the first-floor price and time.
  const outside = side.id !== 'in';
  const rows = [];
  const items = [];
  const floors = new Set();
  let minutes = 0;
  let windows = 0;
  let panes = 0;
  const title = [];

  for (const c of countFields(cfg)) {
    const count = countOf(input[c.key]);
    const rate = count && menu.packages.find((p) => p.id === c.type.rate);
    if (!rate) continue;
    const each = cents(rate.price * (side.mult || 1) * (outside ? c.floor.price || 1 : 1));
    const paneCount = count * (c.type.panes || 1);
    const perPane = Math.round(c.type.pane_minutes * (outside ? c.floor.time || 1 : 1) * sideTime * 10) / 10;
    const mins = paneCount * perPane;
    minutes += mins;
    panes += paneCount;
    if (c.type.unit === 'window') windows += count;
    floors.add(c.floor.floor);
    rows.push({ key: c.key, item: c.title, rate: c.type.rate, floor: c.floor.floor, count, unit: c.type.unit, panes: paneCount, perPane, minutes: Math.round(mins), each, total: cents(each * count) });
    items.push({ label: c.title, detail: `${text.plural(count, c.type.unit)}${c.type.panes > 1 ? `, ${c.type.panes} panes each` : ''}, ${side.label.toLowerCase()}`, qty: count, unit: c.type.unit, price: each });
  }
  // Counts for the title: "20 standard windows, 2 picture windows and 15 French panes".
  for (const rateId of Object.keys(TITLE_WORDS)) {
    const n = rows.filter((r) => r.rate === rateId).reduce((a, r) => a + r.count, 0);
    if (n) title.push(text.plural(n, ...TITLE_WORDS[rateId]));
  }

  for (const x of extraFields(cfg)) {
    const count = countOf(input[x.key]);
    const a = count && menu.addons.find((y) => y.id === x.addon);
    if (!a) continue;
    const mins = count * (x.minutes || 0);
    minutes += mins;
    if (x.pane) {
      panes += count;
      title.push(text.plural(count, 'skylight'));
    }
    rows.push({ key: x.key, item: a.label, floor: null, count, unit: a.unit, panes: x.pane ? count : null, perPane: x.pane ? x.minutes : null, minutes: Math.round(mins), each: a.price, total: cents(a.price * count) });
    items.push({ label: a.label, qty: count, unit: a.unit, price: a.price });
  }
  if (rows.length) minutes += E.setup_minutes || 0;

  const base = cents(items.reduce((n, it) => n + it.price * it.qty, 0));
  let subtotal = base;
  let plan = null;
  let off = 0;
  const pl = planOf(cfg, input.frequency);
  if (pl && pl.discount && base > 0) {
    off = cents(base * pl.discount);
    items.push({ label: `${pl.label} price`, detail: `${Math.round(pl.discount * 100)}% off each visit, every ${pl.every}`, qty: 1, unit: 'each', price: -off });
    subtotal = cents(base - off);
  }
  let minimum = 0;
  const min = cfg.prices.minimum;
  if (min && subtotal > 0 && subtotal < min) {
    minimum = cents(min - subtotal);
    items.push({ label: 'Trip minimum', detail: `Jobs start at ${usd(min)}`, qty: 1, unit: 'each', price: minimum });
    subtotal = min;
  }
  if (pl) plan = { id: pl.id, label: pl.label, every: pl.every, discount: pl.discount, perVisit: subtotal };

  minutes = Math.round(minutes);
  const hours = Math.round((minutes / 60) * 10) / 10;
  const perHour = minutes > 0 ? Math.round(subtotal / (minutes / 60)) : null;
  const top = Math.max(0, ...floors);
  const gear = outside ? E.floors.filter((fl) => floors.has(fl.floor)).map((fl) => ({ floor: fl.label, gear: fl.gear })) : floors.size ? [{ floor: 'Every floor, from inside', gear: E.floors[0].gear }] : [];

  // The checks before the job, from data, each with its sources.
  const F = X.flags || {};
  const flags = [];
  const flag = (key, vars) => {
    const d = F[key];
    if (d) flags.push({ key, say: words.fill(d.say, vars || {}), sources: (d.sources || []).map((s) => ({ publisher: s.publisher, url: s.url })), ...(d.note ? { note: d.note } : {}) });
  };
  if (outside && (floors.has(2) || floors.has(3))) flag('floor2');
  if (outside && floors.has(3)) flag('floor3');
  if (countOf(input.skylights)) flag('skylight');
  if (countOf(input.hard_water)) flag('hard_water');
  if (side.id === 'in') flag('inside_only');
  const [low, high] = E.hourly_reference || [];
  if (perHour != null && low && perHour < low) flag('per_hour', { per_hour: usd(perHour), low: usd(low), high: usd(high) });

  // The words for the sheet and the text ("20 standard windows, 2 picture windows and 15 French panes
  // on two floors, inside and out"), and a shorter name for the quote and invoice ("Window cleaning,
  // 22 windows and 15 French panes on two floors").
  const where = FLOOR_WORDS[top] ? ` on ${FLOOR_WORDS[top]}` : '';
  const extras = rows.filter((r) => r.floor == null && !r.perPane).map((r) => r.item.toLowerCase());
  const desc = text.clip(title.length ? `${text.list(title)}${where}, ${side.label.toLowerCase()}` : text.list(extras), 160);
  const french = rows.filter((r) => r.rate === 'small_pane').reduce((a, r) => a + r.count, 0);
  const sky = (rows.find((r) => r.key === 'skylights') || {}).count || 0;
  const short = [windows && text.plural(windows, 'window'), french && text.plural(french, 'French pane'), sky && text.plural(sky, 'skylight')].filter(Boolean);
  const name = `Window cleaning, ${text.list(short.length ? short : extras)}${where}${side.id !== 'both' ? `, ${side.label.toLowerCase()}` : ''}`;
  return { rows, items, base, off, minimum, subtotal, plan, minutes, hours, perHour, windows, panes, floors: [...floors].sort(), top, side, gear, flags, desc, title: text.clip(name, 110) };
}

// The text to send with the sheet.
function message(cfg, e, { customer, first, business }) {
  const N = cfg.niche;
  const planLine = e.plan ? ` It repeats every ${e.plan.every} at ${usd(e.plan.perVisit)} a visit. ${N.texts.plan_terms || ''}` : '';
  return words.fill(N.texts.estimate, { customer, first, business, title: e.desc, total: usd(e.subtotal), hours: e.hours, plan: planLine, promise: N.offer.promise, days: cfg.prices.estimate.valid_days });
}

// Scan to book or text, the same footer as the kit's printed pages.
function foot(o) {
  const target = print.qrTarget(o);
  const code = target ? `<div class="qr">${qr.qrSvg(target, { size: '1in', margin: 2 })}<p>${esc(o.link && /^https?:/i.test(o.link) ? 'Scan to book' : 'Scan to text me')}</p></div>` : '';
  const lines = [`<p><strong>${esc(o.business)}</strong>${o.first ? `, ${esc(o.first)}` : ''}</p>`, o.phone ? `<p>Call or text ${esc(o.phone)}</p>` : '', o.link ? `<p>${esc(String(o.link).replace(/^https?:\/\//, ''))}</p>` : '', o.area ? `<p class="muted">${esc(o.area)}</p>` : ''];
  return `<div class="foot"><div>${lines.join('')}</div>${code}</div>`;
}

// The one-page estimate for the customer: what was counted on each floor, each price, the total,
// the time on site, what's included and the promise. Letter page, phone friendly, no scripts.
// o: compute()'s result plus customer, address, date, valid, frequency, business, first, phone, link, area.
function sheet(cfg, o, pal) {
  const X = cfg.niche.estimate || {};
  const css = `${pages.css(pal)}
.wrap{overflow-x:auto}.num{text-align:right;white-space:nowrap}
.sum td{border-bottom:none}.sum .total td{border-top:2px solid ${pal.ink};font-weight:800}
.big{font-size:18pt;font-weight:800;color:${pal.primary}}
@media screen and (max-width:640px){body{margin:12px auto;padding:0 16px;font-size:10.5pt}.top{display:block}.grid{grid-template-columns:1fr}.foot{flex-direction:column;align-items:flex-start}h1{font-size:18pt}td,th{padding:4px 3px}}`;
  const facts = [
    ['For', o.customer],
    ['Address', o.address || 'To confirm'],
    ['Date', o.date],
    ['Price holds until', o.valid],
    ['Sides', o.side.label],
    ['How often', o.frequency || 'One time'],
  ];
  const rows = o.rows
    .map((r) => `<tr><td>${esc(r.item)}</td><td class="num">${esc(money.int(r.count))}</td><td class="num">${esc(usd(r.each))}</td><td class="num">${esc(usd(r.total))}</td></tr>`)
    .join('');
  const sum = [
    `<tr><td>Windows and extras</td><td class="num">${esc(usd(o.base))}</td></tr>`,
    o.off ? `<tr><td>${esc(`${o.plan.label} price, ${Math.round(o.plan.discount * 100)}% off each visit`)}</td><td class="num">-${esc(usd(o.off))}</td></tr>` : '',
    o.minimum ? `<tr><td>${esc(`Trip minimum, jobs start at ${usd(cfg.prices.minimum)}`)}</td><td class="num">${esc(usd(o.minimum))}</td></tr>` : '',
    `<tr class="total"><td>Total${o.plan ? ' per visit' : ''}</td><td class="num big">${esc(usd(o.subtotal))}</td></tr>`,
  ].join('');
  const includes = (X.includes || {})[o.side.id] || [];
  const body = `<div class="top"><div><p class="eyebrow">${esc(`Window estimate, ${o.business}`)}</p><h1>${esc(`Windows for ${o.customer}`)}</h1><p class="sub">${esc(o.desc.charAt(0).toUpperCase() + o.desc.slice(1))}</p></div></div>
<div class="box grid">${facts.map(([k, v]) => `<p><span class="k">${esc(k)}</span>${esc(v)}</p>`).join('')}</div>
<h2>What I counted</h2>
<div class="wrap"><table><tr><th>Item</th><th class="num">Count</th><th class="num">Each</th><th class="num">Total</th></tr>${rows}</table></div>
<div class="wrap"><table class="sum">${sum}</table></div>
<p>${esc(`About ${o.hours} hours on site.${o.plan ? ` It repeats every ${o.plan.every} at this price. ${cfg.niche.texts.plan_terms || ''}` : ''}`)}</p>
${includes.length ? `<h2>Included</h2><ul>${includes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
<p class="small"><strong>My promise:</strong> ${esc(cfg.niche.offer.promise)}</p>
${X.sheet_note ? `<p class="small muted">${esc(X.sheet_note)}</p>` : ''}
${foot(o)}`;
  return files.htmlDoc({ title: `${o.business}: window estimate for ${o.customer}`, css, body });
}

module.exports = { SIDES, FREQUENCY, countFields, extraFields, compute, message, sheet, countOf, usd };
