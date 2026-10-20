// Roofline plan, the holiday lights pack's own tool. Typed runs in (roofline, trees, walkways, each
// with its feet); out come the bulbs, clips, stakes, wire, cords and timers, the runs packed onto
// circuits under the 80% rule, the material cost from sourced pack prices, the price from the
// member's per-foot rates, a design sheet for the homeowner, an install sheet for the member (it has
// their costs, so it never goes to the homeowner) and the install, check, takedown and storage dates
// as a calendar file. Math: lib/roofline.js. Facts and sources: data/roofline.json.

const { text, money, time, files, views, save, qr } = require('../../_kit');
const offer = require('../../_kit/home/offer');
const print = require('../../_kit/home/print');
const pages = require('../../_kit/home/pages');
const T = require('../../_kit/home/tools');
const R = require('../lib/roofline');

const D = R.DATA;
const esc = files.esc;
const usd = print.usd;
const cents = (n) => Math.round(n * 100) / 100;
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
// One color per circuit on the design sheet, easy to tell apart on paper.
const COLORS = ['#C2410C', '#15803D', '#1D4ED8', '#A21CAF', '#B45309', '#0E7490', '#4D7C0F', '#BE123C'];
const colorOf = (n) => COLORS[(n - 1) % COLORS.length];
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many || `${one}s`}`;
const hoursText = (min) => {
  const h = Math.round((min / 60) * 2) / 2;
  return h < 1 ? `${min} minutes` : `about ${fmt(h)} ${h === 1 ? 'hour' : 'hours'}`;
};
const longDate = (d) => (d ? time.longDate(d) : '');
const shortDate = (d) => (d ? time.shortDate(d) : '');

// The member's per-foot rates, tree wraps, timer, minimum and plan, from their menu.
function pricesFrom(cfg, menu) {
  const src = (id) => [...(cfg.prices.packages || []), ...(cfg.prices.addons || [])].find((x) => x.id === id) || {};
  const item = (id) => menu.packages.find((p) => p.id === id) || menu.addons.find((a) => a.id === id) || { label: src(id).label || id, price: 0 };
  const rate = (id) => ({ label: item(id).label, price: Number(item(id).price) || 0, mpu: src(id).minutes_per_unit || 0, range: src(id).range || null });
  const tree = (id) => ({ label: item(id).label, price: Number(item(id).price) || 0, minutes: src(id).minutes || 0 });
  const planDef = (cfg.prices.plans || []).find((p) => p.id === 'season');
  return {
    rates: { lease: rate('foot_lease'), install: rate('foot_install'), takedown: rate('foot_takedown'), lights: rate('foot_lights') },
    trees: { small: tree('tree_small'), medium: tree('tree_medium') },
    timer: { label: item('timer').label, price: Number(item('timer').price) || 0 },
    minimum: menu.minimum || cfg.prices.minimum || 0,
    plan: planDef ? { label: planDef.label, discount: planDef.discount } : null,
  };
}

// The sourced per-foot range for what this model includes, to set the member's price against.
function rangeFor(cfg, model, prices) {
  const R0 = prices.rates;
  const parts = model === 'lease' ? [R0.lease] : model === 'own' ? [R0.install, R0.takedown] : [R0.lights, R0.install, R0.takedown];
  if (parts.some((p) => !p.range)) return null;
  const ids = model === 'lease' ? ['foot_lease'] : model === 'own' ? ['foot_install', 'foot_takedown'] : ['foot_lights', 'foot_install', 'foot_takedown'];
  const pubs = [...new Set(ids.flatMap((id) => ((cfg.prices.packages || []).find((p) => p.id === id) || {}).sources || []).map((s) => s.publisher))];
  return { low: cents(parts.reduce((s, p) => s + p.range[0], 0)), high: cents(parts.reduce((s, p) => s + p.range[1], 0)), from: pubs };
}

// What the homeowner gets, in their words.
function includedFor(model, promise, bulbLabel) {
  const fix = promise || 'Fixes during the season when a bulb or strand goes out';
  const lease = [`Commercial ${bulbLabel} lights, mine, for the season`, 'Measured, clipped and hung straight: clips, never nails or tape', fix, 'Taken down in January and stored by me until next season'];
  const own = ['Your lights tested before they go up', 'Measured, clipped and hung straight: clips, never nails or tape', 'If something goes out during the season, text me and I come check it within 2 days', 'Taken down in January, labeled and boxed by run for you to store'];
  const buy = [`Commercial ${bulbLabel} lights that are yours to keep`, 'Measured, clipped and hung straight: clips, never nails or tape', fix, 'Taken down in January, labeled and boxed by run for you to keep'];
  return model === 'lease' ? lease : model === 'own' ? own : buy;
}

function storageLine(model) {
  if (model === 'lease') return 'I take everything down in January and store the lights until next season.';
  if (model === 'own') return 'Your lights come down in January, tested, labeled and boxed by run for you to store.';
  return 'Your lights come down in January, tested, labeled and boxed by run for you to keep.';
}

// Every source in data/roofline.json, once each.
function allSources() {
  const out = new Map();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (v.publisher && v.url) {
        if (!out.has(v.url)) out.set(v.url, v);
        return;
      }
      Object.values(v).forEach(walk);
    }
  };
  walk(D);
  return [...out.values()];
}

// One run drawn as a line of bulbs, colored by the circuit each part plugs into.
function runSvg(run, feeds, maxFeet, pal) {
  const pct = Math.max(16, Math.round((run.feet / maxFeet) * 100));
  const dots = Math.max(2, Math.min(run.sockets, Math.round((48 * pct) / 100)));
  const mine = feeds.filter((f) => f.run === run.n);
  const colorAt = (i) => {
    const socket = ((i + 0.5) / dots) * run.sockets;
    let sum = 0;
    for (const f of mine) {
      sum += f.sockets;
      if (socket <= sum) return colorOf(f.circuit);
    }
    return colorOf(mine.length ? mine[mine.length - 1].circuit : 1);
  };
  const circles = Array.from({ length: dots }, (_, i) => `<circle cx="${(((i + 0.5) / dots) * 100).toFixed(2)}%" cy="8" r="4.5" fill="${colorAt(i)}"/>`).join('');
  return `<svg class="rb" width="${pct}%" height="16" role="img" aria-label="${esc(run.name)}: ${run.sockets} bulbs"><line x1="0" y1="8" x2="100%" y2="8" stroke="${pal.muted}" stroke-width="1.5"/>${circles}</svg>`;
}

const legendDot = (n) => `<svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="${colorOf(n)}"/></svg>`;

const EXTRA_CSS = `.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.run{margin:.05in 0 .1in}.rl{display:flex;justify-content:space-between;gap:.15in;font-size:10pt}.rl span{white-space:nowrap}
.rb{display:block;margin-top:2px;overflow:visible}
.legend{display:flex;flex-wrap:wrap;gap:.04in .22in;font-size:9.5pt;margin:.04in 0 .1in}.legend svg{vertical-align:-1px;margin-right:4px}
.num{text-align:right;white-space:nowrap}.total td{font-weight:800;border-top:2px solid currentColor;border-bottom:0}
.sources li{font-size:8.5pt;word-break:break-word}
@media screen and (max-width:600px){body{margin:16px auto;padding:0 16px}h1{font-size:18pt}.grid{grid-template-columns:1fr}.top{display:block}.foot{flex-wrap:wrap}.wide{min-width:620px}}`;

function qrBlock(f) {
  const target = print.qrTarget(f);
  return target ? `<div class="qr">${qr.qrSvg(target, { size: '1in', margin: 2 })}<p>${/^https?:/i.test(f.link || '') ? 'Scan to book' : 'Scan to text me'}</p></div>` : '';
}

function footer(f) {
  const lines = [`<p><strong>${esc(f.business)}</strong>${f.first ? `, ${esc(f.first)}` : ''}</p>`, f.phone ? `<p>Call or text ${esc(f.phone)}</p>` : '', f.link ? `<p>${esc(String(f.link).replace(/^https?:\/\//, ''))}</p>` : '', f.area && f.area !== 'town' ? `<p class="muted">${esc(f.area)}</p>` : ''];
  return `<div class="foot"><div>${lines.join('')}</div>${qrBlock(f)}</div>`;
}

const doc = (title, pal, body, description) => files.htmlDoc({ title, css: `${pages.css(pal)}\n${EXTRA_CSS}`, body, description });

// The design sheet the homeowner sees: the runs drawn, the price, the dates and what's included.
function designSheet(o, pal) {
  const maxFeet = Math.max(...o.pw.runs.map((r) => r.feet));
  const legend = o.pw.circuits.length > 1 ? `<div class="legend">${o.pw.circuits.map((c) => `<span>${legendDot(c.n)}Circuit ${c.n}</span>`).join('')}</div>` : '';
  const runs = o.pw.runs.map((r) => `<div class="run"><div class="rl"><strong>${r.n}. ${esc(r.name)}</strong><span>${esc(fmt(r.feet))} ft, ${esc(R.KIND_LABEL[r.kind].toLowerCase())}</span></div>${runSvg(r, o.pw.feeds, maxFeet, pal)}</div>`).join('');
  const rows = o.q.items.map((it) => `<tr><td><strong>${esc(it.label)}</strong>${it.detail ? `<br><span class="muted">${esc(it.detail)}</span>` : ''}</td><td class="num">${esc(fmt(it.qty))} ${esc(it.unit)}</td><td class="num">${esc(money.usd(it.price))}</td><td class="num">${esc(money.usd(cents(it.qty * it.price)))}</td></tr>`).join('');
  const facts = [
    ['Lights', `${fmt(o.mat.feet)} ft, ${plural(o.mat.sockets, 'bulb')} (${o.bulb.label}), ${o.spacing} inches apart`],
    ['Power', `About ${fmt(o.pw.watts)} W on ${plural(o.pw.circuits.length, 'outdoor circuit')}, ${o.pw.circuits.length > 1 ? 'each ' : ''}under 80% of its breaker`],
    ['Install', longDate(o.dates.install)],
    ['Takedown', `From ${longDate(o.dates.takedown)}${o.dates.takedownBy ? `, done by ${longDate(o.dates.takedownBy)}` : ''}`],
  ];
  const plan = o.q.plan ? `<div class="box"><strong>${esc(o.q.plan.label)}:</strong> ${esc(usd(o.q.plan.price))} a season instead of ${esc(usd(o.q.subtotal))}. ${esc(o.planTerms)}</div>` : '';
  const body = `<div class="top"><div><p class="eyebrow">${esc(o.f.business)}</p><h1>Holiday lighting plan${o.customer ? ` for ${esc(o.customer)}` : ''}</h1>${o.address ? `<p class="sub">${esc(o.address)}</p>` : ''}</div></div>
<div class="box grid">${facts.map(([k, v]) => `<p><span class="k">${esc(k)}</span>${esc(v)}</p>`).join('')}</div>
<h2>The design</h2>
${o.pw.circuits.length > 1 ? '<p class="small muted">Each color is one circuit: runs of one color plug in on the same breaker.</p>' : ''}
${legend}${runs}
<h2>Your price</h2>
<div class="scroll"><table><tr><th>What</th><th class="num">How much</th><th class="num">Price</th><th class="num">Total</th></tr>${rows}<tr class="total"><td colspan="3">Total</td><td class="num">${esc(money.usd(o.q.subtotal))}</td></tr></table></div>
<p>About ${esc(money.usd(o.q.perFoot))} a foot for ${fmt(o.q.feet)} ft.${o.q.large.length ? ` ${esc(text.list(o.q.large))}: priced on site.` : ''}</p>
${plan}
<h2>The dates</h2>
<ul>
<li><strong>Install:</strong> ${esc(longDate(o.dates.install))}</li>
${o.dates.check ? `<li><strong>Mid-season check:</strong> around ${esc(longDate(o.dates.check))}</li>` : ''}
<li><strong>Takedown:</strong> from ${esc(longDate(o.dates.takedown))}${o.dates.takedownBy ? ` to ${esc(longDate(o.dates.takedownBy))}` : ''}</li>
<li><strong>Storage:</strong> ${esc(storageLine(o.model.id))}</li>
<li><strong>Next season:</strong> I check in by ${esc(longDate(o.dates.rebook))} to keep your spot.</li>
</ul>
<h2>What's included</h2>
<ul>${includedFor(o.model.id, o.promise, o.bulb.label).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<p class="small muted">The lights plug into your existing outdoor outlets. A new outlet or circuit is a job for a licensed electrician.</p>
${footer(o.f)}`;
  return doc(`${o.f.business}: holiday lighting plan${o.customer ? ` for ${o.customer}` : ''}`, pal, body, 'Holiday lighting plan');
}

// The install sheet for the member: runs, circuits, the power math, materials and cost, safety,
// measuring and how every number was reached, with sources.
function installSheet(o, pal) {
  const C = D.circuit;
  const runRows = o.pw.runs.map((r) => `<tr><td>${r.n}</td><td><strong>${esc(r.name)}</strong>${r.story > 1 ? `<br><span class="muted">Story ${r.story}${r.steep ? ', steep' : ''}</span>` : r.steep ? '<br><span class="muted">Steep</span>' : ''}</td><td>${esc(R.KIND_LABEL[r.kind])}${r.size ? `, ${esc(r.size)}` : ''}</td><td class="num">${fmt(r.feet)}</td><td class="num">${fmt(r.sockets)}</td><td class="num">${fmt(r.watts)}</td><td class="num">${r.parts}</td><td class="num">${r.circuits.join(', ')}</td><td class="num">${r.clips ? `${fmt(r.clips)} clips` : r.stakes ? `${fmt(r.stakes)} stakes` : ''}</td></tr>`).join('');
  const circuitRows = o.pw.circuits.map((c) => `<tr><td>${legendDot(c.n)} ${c.n}</td><td>${esc(c.runs.join(', '))}</td><td class="num">${fmt(c.watts)} W</td><td class="num">${fmt(c.cap)} W</td><td class="num">${Math.round(c.share * 100)}%</td></tr>`).join('');
  const matRows = o.mat.rows.map((m) => `<tr><td><strong>${esc(m.item)}</strong>${m.note ? `<br><span class="muted">${esc(m.note)}</span>` : ''}</td><td class="num">${fmt(m.need)} ${esc(m.need === 1 && m.unit !== 'ft' ? m.unit.replace(/s$/, '') : m.unit)}</td><td>${esc(m.buy)}</td><td class="num">${m.low != null ? `${esc(money.usd(m.low))} to ${esc(money.usd(m.high))}` : 'check current rates'}</td><td>${esc(m.who)}</td></tr>`).join('');
  const rules = Object.values(D.rules).map((r) => `<li>${esc(r.say)}${r.note ? ` <span class="muted">(${esc(r.note)})</span>` : ''}${(r.sources || []).length ? ` <span class="muted">${esc(text.list([...new Set(r.sources.map((s) => s.publisher))]))}</span>` : ''}</li>`).join('');
  const range = o.range ? `<p>The sourced range for this kind of job is ${esc(money.usd(o.range.low))} to ${esc(money.usd(o.range.high))} a foot (${esc(text.list(o.range.from))}). Your price works out to ${esc(money.usd(o.q.perFoot))} a foot.</p>` : '';
  const facts = [
    ['Customer', o.customer || ''],
    ['Address', o.address || ''],
    ['Install', `${longDate(o.dates.install)}, ${hoursText(o.q.minutes.install)}`],
    ['Takedown', `${longDate(o.dates.takedown)}, ${hoursText(o.q.minutes.takedown)}`],
    ['Lights', `${o.bulb.label}, ${fmt(o.watts)} W a bulb, ${o.spacing} inches apart`],
    ['Model', o.model.label],
  ].filter(([, v]) => v);
  const sources = allSources().map((s) => `<li>${esc(s.publisher)}: <a href="${esc(s.url)}">${esc(s.url)}</a></li>`).join('');
  const body = `<div class="top"><div><p class="eyebrow">Install sheet, for you</p><h1>${esc(o.customer || 'Roofline plan')}: install sheet</h1><p class="sub">It has your costs: keep it, and give the homeowner the design sheet.</p></div></div>
<div class="box grid">${facts.map(([k, v]) => `<p><span class="k">${esc(k)}</span>${esc(v)}</p>`).join('')}</div>
${o.warnings.length ? `<h2>Check first</h2><ul>${o.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
<h2>Runs</h2>
<div class="scroll"><table class="wide"><tr><th>#</th><th>Run</th><th>Kind</th><th class="num">Feet</th><th class="num">Bulbs</th><th class="num">Watts</th><th class="num">Plug-ins</th><th class="num">Circuit</th><th class="num">Mounts</th></tr>${runRows}</table></div>
<h2>Circuits and the 80% rule</h2>
<div class="scroll"><table><tr><th>Circuit</th><th>Runs</th><th class="num">Lights</th><th class="num">80% line</th><th class="num">Used</th></tr>${circuitRows}</table></div>
<p>${fmt(o.mat.sockets)} bulbs at ${fmt(o.watts)} W is ${fmt(o.pw.watts)} W, about ${fmt(o.pw.amps)} amps. A ${o.pw.breaker} amp circuit carries ${fmt(o.pw.cap)} W of lights under the 80% rule (${o.pw.breaker} A x ${C.volts} V x ${C.share}). One run of spool wire carries up to ${fmt(o.pw.perRun)} W end to end (${D.run.amps} A), so a longer run is split into plug-ins. A 16-gauge outdoor cord is labeled ${fmt(o.pw.perCord)} W (${D.cord.amps} A). Count anything else plugged into the same circuit.</p>
<p class="small muted">${esc(C.basis)}</p>
<h2>Materials</h2>
<div class="scroll"><table class="wide"><tr><th>Item</th><th class="num">Need</th><th>Buy</th><th class="num">Cost for this job</th><th>Who keeps it</th></tr>${matRows}</table></div>
<p><strong>Materials for this job:</strong> ${esc(money.usd(o.mat.cost.low))} to ${esc(money.usd(o.mat.cost.high))}, the share of each spool and pack this job uses.${o.mat.unpriced.length ? ` Not counted: ${esc(text.list(o.mat.unpriced))} (check current rates).` : ''}${o.model.id === 'lease' ? ' Your lights, cords and timers go up again next season.' : ''}</p>
<h2>Price</h2>
<p>${esc(money.usd(o.q.subtotal))} for ${fmt(o.q.feet)} ft, about ${esc(money.usd(o.q.perFoot))} a foot.${o.q.plan ? ` ${esc(o.q.plan.label)}: ${esc(usd(o.q.plan.price))} a season.` : ''}</p>
${range}
<h2>Safety</h2>
<ul class="checks">${D.safety.map((s) => `<li>${esc(s.say)}</li>`).join('')}</ul>
<h2>Measuring</h2>
<ul>${D.measure.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<h2>How the plan counts</h2>
<ul>${rules}</ul>
<p class="small muted">${esc(D.spacing.note)} ${esc(D.bulbs[o.bulb.id].basis)} ${esc(D.dates.basis)}</p>
<h2>Sources</h2>
<ul class="sources">${sources}</ul>
<p class="small muted">Checked ${esc(D.checked)}. Codes and rules vary: check your city and state.</p>`;
  return doc(`${o.f.business}: install sheet${o.customer ? ` for ${o.customer}` : ''}`, pal, body, 'Install sheet');
}

function rooflineTool(cfg) {
  const N = cfg.niche;
  return {
    name: `${cfg.id}.plan_roofline`,
    title: 'Plan the roofline',
    description: 'Typed runs in (roofline, trees and walkways, each with its feet): bulbs, clips, stakes, wire, cords and timers, the runs packed onto circuits under the 80% rule, the material cost, the price from your per-foot rates, a design sheet for the homeowner, an install sheet for you and the install, takedown and storage dates as a calendar file.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 2,
    timeoutSec: 60,
    input: {
      type: 'object',
      required: ['runs'],
      properties: {
        runs: { type: 'string', maxLength: 4000, format: 'textarea', title: 'Runs, one per line', description: 'Where it goes, then its feet: "Front gutter 48", "Garage peaks 2 x 18", "2nd story gutter 52 steep", "Front walkway 30 both sides", "Maple tree 60".' },
        model: { type: 'string', enum: R.MODELS.map((m) => m.label), default: R.MODELS[0].label, title: 'Whose lights' },
        bulbs: { type: 'string', enum: R.BULBS.map((b) => b.label), default: R.BULBS[0].label, title: 'Bulbs' },
        watts: { type: ['number', 'string'], title: 'Watts per bulb (optional)', description: 'From the bulb box. Empty uses 0.8 W for LED C9 and 7 W for incandescent.' },
        spacing: { type: 'string', enum: R.SPACINGS, default: R.SPACINGS[0], title: 'Bulb spacing' },
        breaker: { type: 'string', enum: R.BREAKERS, default: R.BREAKERS[0], title: 'Breaker size', description: 'Most home circuits are 15 or 20 amp. Plan on 15 when you do not know.' },
        circuits: { type: ['integer', 'string'], title: 'Outdoor circuits at the house (optional)', description: 'How many separate breakers the outdoor outlets are on, if you know' },
        install: { type: 'string', maxLength: 10, format: 'date', title: 'Install date (optional)' },
        takedown: { type: 'string', maxLength: 10, format: 'date', title: 'Takedown date (optional)' },
        customer: { type: 'string', maxLength: 80, title: 'Customer (optional)' },
        address: { type: 'string', maxLength: 200, title: 'Address (optional)' },
        city: { type: 'string', maxLength: 80 },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['runs', 'circuits', 'materials', 'items', 'subtotal', 'dates', 'text', 'files'],
      properties: {
        title: { type: 'string' },
        notes: { type: 'string' },
        customer: { type: 'string' },
        model: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' } } },
        bulbs: { type: 'object' },
        runs: { type: 'array' },
        skipped: { type: 'array' },
        circuits: { type: 'array' },
        power: { type: 'object' },
        materials: { type: 'array' },
        cost: { type: 'object' },
        items: { type: 'array' },
        subtotal: { type: 'number' },
        perFoot: { type: 'number' },
        feet: { type: 'number' },
        range: { type: 'object' },
        plan: { type: 'object' },
        minutes: { type: 'object' },
        dates: { type: 'object' },
        text: { type: 'string' },
        warnings: { type: 'array' },
        files: { type: 'object', properties: { html: ASSET, sheet: ASSET, ics: ASSET } },
      },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const warnings = [];
      const parsed = R.parseRuns(input.runs);
      if (!parsed.runs.length) throw new Error(parsed.skipped.length ? `No runs to plan. ${parsed.skipped[0]}` : 'Type one run per line: where it goes, then its feet, like "Front gutter 48".');
      const model = R.MODELS.find((m) => m.label === input.model || m.id === input.model) || R.MODELS[0];
      const bulb = R.BULBS.find((b) => b.label === input.bulbs || b.id === input.bulbs) || R.BULBS[0];
      const spacing = parseInt(String(input.spacing || ''), 10) === 6 ? 6 : D.spacing.default;
      const breaker = parseInt(String(input.breaker || ''), 10) === 20 ? 20 : 15;
      let watts = D.bulbs[bulb.id].watts;
      const typedWatts = String(input.watts == null ? '' : input.watts).trim();
      if (typedWatts) {
        const w = Number(typedWatts.replace(/[^\d.]/g, ''));
        if (w >= 0.1 && w <= 25) watts = w;
        else warnings.push(`"${typedWatts}" isn't watts per bulb, so the plan uses ${fmt(watts)} W for ${bulb.label}.`);
      }
      const have = parseInt(String(input.circuits == null ? '' : input.circuits), 10);
      const houseCircuits = have >= 1 && have <= 20 ? have : undefined;
      const pw = R.power(parsed.runs, { spacing, watts, breaker, circuits: houseCircuits });
      const mat = R.materials(pw, { model: model.id, spacing, bulbType: bulb.id });
      const menu = offer.menuFor(ctx, cfg, {});
      const prices = pricesFrom(cfg, menu);
      const q = R.priceRuns(pw, { model: model.id, prices, circuits: pw.circuits.length });
      const range = rangeFor(cfg, model.id, prices);
      const dates = R.datesFor(time.today(ctx), { install: input.install, takedown: input.takedown });
      const customer = text.clip(text.plain(input.customer || ''), 80);
      const address = text.clip(text.plain(input.address || ''), 200);

      if (pw.short) warnings.push(`This plan needs ${plural(pw.circuits.length, 'circuit')} and the house has ${fmt(pw.have)}. Take out a run or use LED bulbs, or the owner has a licensed electrician add a circuit. Never add an outlet or circuit yourself.`);
      if (pw.circuits.length > 1) warnings.push(`${plural(pw.circuits.length, 'circuit')}: outlets on the same breaker count as one circuit, so find which outdoor outlets are on separate breakers before the install day.`);
      if (bulb.id === 'incandescent') warnings.push(`Incandescent C9 bulbs draw about ${fmt(D.bulbs.incandescent.watts)} W each against ${fmt(D.bulbs.led.watts)} W for LED, so this plan needs more power. Their bulb price isn't in the materials: check current rates.`);
      if (spacing !== D.spacing.default) warnings.push(`${spacing} inch spacing takes twice the bulbs and clips of ${D.spacing.default} inch. The spool price is for ${D.spacing.default} inch wire: check current rates for yours.`);
      const upperRuns = pw.runs.filter((r) => r.story >= 2);
      if (upperRuns.length) warnings.push(`Upper story (${text.list(upperRuns.map((r) => r.name))}): a helper steadies the ladder, the base goes 1 foot out for every 4 feet of ladder, and you stay 10 feet from power lines.`);
      const third = pw.runs.filter((r) => r.story >= 3);
      if (third.length) warnings.push(`${text.list(third.map((r) => r.name))}: a third story may need a lift or scaffolding. Price the extra on site.`);
      if (q.large.length) warnings.push(`${text.list(q.large)}: a large tree isn't in the price. Fixr and Bob Vila put a 28 ft tree at $300 to $1,500, and it may need a lift: price it on site.`);
      if (range && q.perFoot && (q.perFoot < range.low || q.perFoot > range.high)) warnings.push(`Your price works out to ${money.usd(q.perFoot)} a foot, outside the sourced ${money.usd(range.low)} to ${money.usd(range.high)} for this kind of job. Check your rates in Your offer.`);
      if (mat.unpriced.length) warnings.push(`Not in the material cost: ${text.list(mat.unpriced)}. Check current rates.`);
      for (const s of parsed.skipped) warnings.push(`Skipped ${s}`);
      warnings.push(...dates.notes);

      const pal = print.paletteFor(cfg, input.color);
      const promise = (N.offer && N.offer.promise) || '';
      const planTerms = (N.texts && N.texts.plan_terms) || '';
      const o = { f, customer, address, model, bulb, spacing, watts, pw, mat, q, range, dates, promise, planTerms, warnings };
      const stamp = customer || f.business;
      const html = await save.saveFile(ctx, save.fileName(stamp, 'lighting plan', '.html'), designSheet(o, pal));
      const sheet = await save.saveFile(ctx, save.fileName(stamp, 'install sheet', '.html'), installSheet(o, pal));

      const who = customer || 'the homeowner';
      const tz = time.tzOf(ctx);
      const runList = pw.runs.map((r) => `${r.name} ${fmt(r.feet)} ft`).join(', ');
      const events = [
        { uid: `lights-roofline-${dates.install}-install-${save.fileName(stamp)}@127group.io`, title: `Light install: ${who}`, description: `${address ? `${address}\n` : ''}${fmt(mat.feet)} ft on ${plural(pw.circuits.length, 'circuit')}: ${runList}`, date: dates.install, time: '09:00', minutes: q.minutes.install, tz },
        ...(dates.check ? [{ uid: `lights-roofline-${dates.check}-check-${save.fileName(stamp)}@127group.io`, title: `Lights check: ${who}`, description: 'Drive by after dark: every run lit, no bulb out, cords and timers dry and plugged in.', date: dates.check }] : []),
        { uid: `lights-roofline-${dates.takedown}-takedown-${save.fileName(stamp)}@127group.io`, title: `Takedown: ${who}`, description: `${address ? `${address}\n` : ''}Take down, test, label and box by run. ${storageLine(model.id)}`, date: dates.takedown, time: '09:00', minutes: q.minutes.takedown, tz },
        { uid: `lights-roofline-${dates.rebook}-rebook-${save.fileName(stamp)}@127group.io`, title: `Next season: ${who}`, description: `Same lights, same spots. ${q.plan ? `${q.plan.label}: ${usd(q.plan.price)} a season.` : ''}`.trim(), date: dates.rebook },
      ];
      const ics = await save.saveFile(ctx, save.fileName(stamp, 'lights dates', '.ics'), files.ics(events, { name: `Lights: ${who}`, now: time.nowMs(ctx) }));

      const first = customer.split(/\s+/)[0] || '';
      const names = pw.runs.map((r) => r.name.toLowerCase());
      const where = names.length > 4 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : text.list(names);
      const what = model.id === 'lease' ? 'with my lights, the install, fixes during the season, the takedown and storage' : model.id === 'own' ? 'to hang your lights and take them down' : 'with lights you keep, the install and the takedown';
      const sign = f.first ? `${f.first}, ${f.business}` : f.business;
      const msg = [
        `Hi${first ? ` ${first}` : ''}! Here's your holiday lighting plan: ${fmt(mat.feet)} ft of ${bulb.label} lights on ${where}.`,
        `${money.usd(q.subtotal)} in all, about ${money.usd(q.perFoot)} a foot, ${what}.`,
        `I can install ${shortDate(dates.install)} and take them down from ${shortDate(dates.takedown)}.`,
        q.plan ? `On the ${q.plan.label.toLowerCase()} it's ${usd(q.plan.price)} a season, same lights and spots.` : '',
        `Want me to hold ${shortDate(dates.install)} for you?`,
        sign ? `${sign}` : '',
      ].filter(Boolean).join(' ');

      const notes = [
        `${fmt(mat.feet)} ft of ${bulb.label} lights, ${spacing} inches apart, on ${plural(pw.circuits.length, 'outdoor circuit')}.`,
        `Install ${longDate(dates.install)}. Takedown from ${longDate(dates.takedown)}${dates.takedownBy ? ` to ${longDate(dates.takedownBy)}` : ''}.`,
        storageLine(model.id),
        q.plan ? `${q.plan.label}: ${usd(q.plan.price)} a season. ${planTerms}` : '',
        model.id === 'own' ? '' : promise,
        'The lights plug into your existing outdoor outlets.',
      ].filter(Boolean).join(' ');

      const strip = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
      const runsOut = pw.runs.map((r) => strip({ n: r.n, name: r.name, kind: r.kind, kindLabel: R.KIND_LABEL[r.kind], feet: r.feet, story: r.story, steep: r.steep, size: r.size, sockets: r.sockets, watts: r.watts, plugins: r.parts, circuit: r.circuits.join(', '), clips: r.clips, stakes: r.stakes }));
      return {
        title: `Holiday lights, ${fmt(q.feet)} ft`,
        notes: text.clip(notes, 1000),
        ...(customer ? { customer } : {}),
        model: { id: model.id, label: model.label },
        bulbs: { label: bulb.label, watts, spacing },
        runs: runsOut,
        ...(parsed.skipped.length ? { skipped: parsed.skipped } : {}),
        circuits: pw.circuits.map((c) => ({ n: c.n, runs: c.runs.join(', '), watts: c.watts, cap: c.cap, used: Math.round(c.share * 100) })),
        power: strip({ watts: pw.watts, amps: pw.amps, breaker: pw.breaker, cap: pw.cap, perRun: pw.perRun, perCord: pw.perCord, plugins: pw.feeds.length, have: pw.have, short: pw.short }),
        materials: mat.rows.map((m) => strip({ item: m.item, need: m.need, unit: m.unit, buy: m.buy, low: m.low, high: m.high, cost: m.low != null ? `${money.usd(m.low)} to ${money.usd(m.high)}` : 'check current rates', who: m.who, note: m.note })),
        cost: strip({ low: mat.cost.low, high: mat.cost.high, lightsLow: mat.lights && mat.lights.low, lightsHigh: mat.lights && mat.lights.high, unpriced: mat.unpriced }),
        items: q.items,
        subtotal: q.subtotal,
        perFoot: q.perFoot,
        feet: q.feet,
        ...(range ? { range } : {}),
        ...(q.plan ? { plan: q.plan } : {}),
        minutes: q.minutes,
        dates: strip({ install: dates.install, check: dates.check, takedown: dates.takedown, takedownBy: dates.takedownBy, rebook: dates.rebook, back: dates.back }),
        text: msg,
        warnings,
        files: { html, sheet, ics },
      };
    },
    view(out) {
      const d = out.dates;
      const dateRows = [
        { what: 'Install', when: longDate(d.install) },
        ...(d.check ? [{ what: 'Mid-season check', when: longDate(d.check) }] : []),
        { what: 'Takedown', when: `${longDate(d.takedown)}${d.takedownBy ? ` to ${longDate(d.takedownBy)}` : ''}` },
        { what: out.model.id === 'lease' ? 'Storage' : 'Boxed for them', when: out.model.id === 'lease' ? 'Your lights, until next season' : 'At the takedown' },
        { what: 'Next season', when: `Check in by ${longDate(d.rebook)}` },
      ];
      const p = out.power;
      return views.blocks(
        views.metric('Price', usd(out.subtotal), `${fmt(out.feet)} ft, about ${money.usd(out.perFoot)} a foot${out.plan ? `. ${out.plan.label}: ${usd(out.plan.price)} a season` : ''}`),
        out.warnings.map((w) => views.text(w)),
        views.table([{ key: 'n', label: '#' }, { key: 'name', label: 'Run' }, { key: 'kindLabel', label: 'Kind' }, { key: 'feet', label: 'Feet', format: 'number' }, { key: 'sockets', label: 'Bulbs', format: 'number' }, { key: 'circuit', label: 'Circuit' }], out.runs),
        views.text(`${fmt(p.watts)} W on ${plural(out.circuits.length, 'circuit')} (${plural(p.plugins, 'plug-in')}), ${out.circuits.length > 1 ? 'each ' : ''}under the 80% line of ${fmt(p.cap)} W for a ${p.breaker} amp breaker.`),
        views.table([{ key: 'item', label: 'Material' }, { key: 'need', label: 'Need', format: 'number' }, { key: 'buy', label: 'Buy' }, { key: 'cost', label: 'Cost for this job' }, { key: 'who', label: 'Who keeps it' }], out.materials),
        views.metric('Materials for this job', `${money.usd(out.cost.low)} to ${money.usd(out.cost.high)}`, 'The share of each spool and pack this job uses'),
        views.table([{ key: 'label', label: 'Line' }, { key: 'qty', label: 'Qty', format: 'number' }, { key: 'price', label: 'Price', format: 'money' }], out.items),
        views.table([{ key: 'what', label: 'Date' }, { key: 'when', label: 'When' }], dateRows),
        views.file(out.files.html, 'Design sheet for the homeowner: print it or text it'),
        views.file(out.files.sheet, 'Install sheet for you: materials, circuits, cost and safety'),
        views.file(out.files.ics, 'Calendar file: install, check, takedown and next season'),
        views.copy('Text to the homeowner', out.text),
      );
    },
  };
}

module.exports = { rooflineTool, pricesFrom, rangeFor };
