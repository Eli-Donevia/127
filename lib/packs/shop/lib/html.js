// One design system for every HTML file the shop pack hands a member: audit reports, launch kits,
// price sheets, drop plans, pitch notes. Big confident type, generous spacing, a clean grid, strong
// contrast, the member's own palette (kit color.palette), self-contained (no external requests),
// phone-first and print-clean (@page set, colors kept in print).

const { files, color } = require('../../_kit');

const esc = files.esc;
const FONT = "Inter, 'Inter Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// A palette plus the few derived colors the pages need. seed: a hex color or a mood name.
function theme(seed) {
  const p = color.palette(color.isHex(seed) ? seed : seed || 'clean');
  const heroAccent = color.ensureContrast(p.primary, p.ink, 4.5);
  return {
    ...p,
    heroBg: p.ink,
    heroText: p.paper,
    heroMuted: color.mix(p.paper, p.ink, 0.32),
    heroAccent,
    soft: color.mix(p.primary, '#ffffff', 0.9),
    softText: color.ensureContrast(p.primary, color.mix(p.primary, '#ffffff', 0.9), 4.5),
    good: '#1f7a4d',
    warn: '#9a5b00',
    bad: '#b42318',
  };
}

function baseCss(t, { size = 'Letter' } = {}) {
  return `
:root{--p:${t.primary};--on-p:${t.onPrimary};--a:${t.accent};--ink:${t.ink};--paper:${t.paper};--surface:${t.surface};--muted:${t.muted};--line:${t.line};--soft:${t.soft};--soft-t:${t.softText};--hero:${t.heroBg};--hero-t:${t.heroText};--hero-m:${t.heroMuted};--hero-a:${t.heroAccent};--good:${t.good};--warn:${t.warn};--bad:${t.bad}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 ${FONT};-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:0 28px}
.hero{background:var(--hero);color:var(--hero-t);padding:72px 0 64px}
.hero .grid{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:end}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--hero-a);margin:0 0 18px}
.hero h1{font-size:clamp(40px,6.2vw,76px);line-height:1.02;letter-spacing:-.035em;font-weight:800;margin:0 0 20px;max-width:15ch}
.hero .lead{font-size:clamp(18px,2.1vw,22px);line-height:1.5;color:var(--hero-m);margin:0;max-width:44ch}
.hero .meta{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:28px;font-size:14px;color:var(--hero-m)}
.hero .meta b{color:var(--hero-t);font-weight:600}
section.block{padding:64px 0;border-bottom:1px solid var(--line)}
section.block:last-of-type{border-bottom:0}
.kicker{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--p);margin:0 0 10px}
h2{font-size:clamp(28px,3.6vw,40px);line-height:1.1;letter-spacing:-.025em;font-weight:800;margin:0 0 14px}
h3{font-size:20px;line-height:1.3;letter-spacing:-.01em;font-weight:700;margin:0 0 6px}
p{margin:0 0 14px}
.sub{color:var(--muted);font-size:18px;max-width:60ch;margin:0 0 32px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.stat{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px 24px 20px}
.stat .v{font-size:clamp(30px,3.6vw,42px);font-weight:800;letter-spacing:-.03em;line-height:1.05}
.stat .l{font-size:14px;font-weight:600;margin-top:8px}
.stat .n{font-size:13px;color:var(--muted);margin-top:4px;line-height:1.45}
.stat.bad .v{color:var(--bad)}.stat.warn .v{color:var(--warn)}.stat.good .v{color:var(--good)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:26px}
.card p:last-child{margin-bottom:0}
.fixes{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.fix{display:grid;grid-template-columns:56px 1fr auto;gap:20px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px}
.fix .num{width:56px;height:56px;border-radius:16px;background:var(--soft);color:var(--soft-t);display:grid;place-items:center;font-weight:800;font-size:22px}
.fix h3{margin-bottom:6px}
.fix .why{color:var(--ink);margin:0 0 8px}
.fix .how{color:var(--muted);font-size:15px;margin:0}
.fix .side{text-align:right;white-space:nowrap}
.pill{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:6px 11px;border-radius:999px;border:1px solid currentColor}
.pill.high{color:var(--bad)}.pill.medium{color:var(--warn)}.pill.low{color:var(--muted)}.pill.good{color:var(--good)}
.mins{display:block;font-size:13px;color:var(--muted);margin-top:8px}
.tag{display:inline-block;font-size:13px;font-weight:600;background:var(--soft);color:var(--soft-t);padding:4px 10px;border-radius:8px;margin:8px 6px 0 0}
table{width:100%;border-collapse:collapse;font-size:15px;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden}
th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--surface)}
td{padding:13px 16px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.tablewrap{overflow-x:auto;border-radius:16px}
.steps{counter-reset:s;list-style:none;margin:0;padding:0;display:grid;gap:12px}
.steps li{counter-increment:s;position:relative;padding:18px 20px 18px 68px;background:#fff;border:1px solid var(--line);border-radius:16px}
.steps li:before{content:counter(s);position:absolute;left:18px;top:16px;width:34px;height:34px;border-radius:10px;background:var(--p);color:var(--on-p);display:grid;place-items:center;font-weight:800;font-size:15px}
.check{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.check li{display:grid;grid-template-columns:26px 1fr;gap:12px;align-items:start;padding:14px 16px;background:#fff;border:1px solid var(--line);border-radius:14px}
.check li:before{content:"";width:20px;height:20px;border:2px solid var(--p);border-radius:6px;margin-top:3px}
.check .when{font-size:13px;color:var(--muted)}
.check.done li:before{content:"\\2713";background:var(--good);border-color:var(--good);color:#fff;font-size:13px;font-weight:800;line-height:20px;text-align:center}
.copy{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 24px;white-space:pre-wrap;font-size:15.5px;line-height:1.6}
.copy .subject{font-weight:700;margin-bottom:10px;white-space:normal}
.note{background:var(--soft);color:var(--soft-t);border-radius:16px;padding:18px 20px;font-size:15px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.muted{color:var(--muted)}
.foot{padding:40px 0 56px;color:var(--muted);font-size:13px}
a{color:var(--p)}
.ring{display:block}
@media (max-width:760px){
  body{font-size:16px}
  .wrap{padding:0 18px}
  .hero{padding:48px 0 44px}
  .hero .grid{grid-template-columns:1fr}
  section.block{padding:44px 0}
  .fix{grid-template-columns:44px 1fr;gap:14px;padding:18px}
  .fix .num{width:44px;height:44px;font-size:18px;border-radius:12px}
  .fix .side{grid-column:2;text-align:left}
  .two{grid-template-columns:1fr}
}
@page{size:${size};margin:14mm}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-size:12.5px;background:#fff}
  .hero{padding:32px 0 28px}
  .hero h1{font-size:40px}
  section.block{padding:26px 0;break-inside:auto}
  .fix,.card,.stat,.steps li,.check li,.copy,tr{break-inside:avoid}
  .wrap{max-width:none;padding:0}
}
`;
}

// A score ring as inline SVG. score 0 to 100.
function ring(score, { size = 168, stroke = 14, fg = 'currentColor', track = 'rgba(255,255,255,.14)', label = 'out of 100', text = '#fff', sub = 'rgba(255,255,255,.7)' } = {}) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * s) / 100;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Score ${s} out of 100">
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${fg}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
<text x="50%" y="50%" text-anchor="middle" dy="0.1em" font-family="${esc(FONT)}" font-size="${Math.round(size * 0.34)}" font-weight="800" fill="${text}" letter-spacing="-2">${s}</text>
<text x="50%" y="50%" text-anchor="middle" dy="2.3em" font-family="${esc(FONT)}" font-size="${Math.round(size * 0.085)}" font-weight="600" fill="${sub}">${esc(label)}</text>
</svg>`;
}

function hero({ eyebrow, heading, lead, meta = [], aside = '' }) {
  return `<header class="hero"><div class="wrap"><div class="grid"><div>
${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h1>${esc(heading)}</h1>
${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
${meta.length ? `<div class="meta">${meta.filter(Boolean).map((m) => `<span>${typeof m === 'string' ? esc(m) : `<b>${esc(m.value)}</b> ${esc(m.label)}`}</span>`).join('')}</div>` : ''}
</div>${aside ? `<div>${aside}</div>` : ''}</div></div></header>`;
}

function block({ kicker, title, sub, body, id }) {
  return `<section class="block"${id ? ` id="${esc(id)}"` : ''}><div class="wrap">
${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}${title ? `<h2>${esc(title)}</h2>` : ''}${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
${body || ''}
</div></section>`;
}

function stats(items) {
  return `<div class="stats">${items
    .filter(Boolean)
    .map((s) => `<div class="stat${s.tone ? ` ${s.tone}` : ''}"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div>${s.note ? `<div class="n">${esc(s.note)}</div>` : ''}</div>`)
    .join('')}</div>`;
}

function fixList(fixes) {
  return `<ol class="fixes">${fixes
    .map(
      (f, i) => `<li class="fix"><div class="num">${i + 1}</div><div><h3>${esc(f.title)}</h3><p class="why">${esc(f.why)}</p>${f.how ? `<p class="how">${esc(f.how)}</p>` : ''}${(f.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div><div class="side"><span class="pill ${esc(f.impact || 'low')}">${esc(f.impact || 'low')} impact</span>${f.minutes ? `<span class="mins">About ${esc(f.minutes)} min</span>` : ''}</div></li>`
    )
    .join('')}</ol>`;
}

// cols: [{ key, label, num }]
function table(cols, rows) {
  return `<div class="tablewrap"><table><thead><tr>${cols.map((c) => `<th${c.num ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td${c.num ? ' class="num"' : ''}>${c.html ? r[c.key] || '' : esc(r[c.key] == null ? '' : r[c.key])}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

function steps(items) {
  return `<ol class="steps">${items.map((s) => `<li>${typeof s === 'string' ? esc(s) : `<b>${esc(s.title)}</b><br>${esc(s.body)}`}</li>`).join('')}</ol>`;
}

function checklist(items, { done = false } = {}) {
  return `<ul class="check${done ? ' done' : ''}">${items
    .map((c) => `<li><div><b>${esc(c.title)}</b>${c.how ? `<br><span class="muted">${esc(c.how)}</span>` : ''}${c.when ? `<br><span class="when">${esc(c.when)}</span>` : ''}</div></li>`)
    .join('')}</ul>`;
}

function cards(items) {
  return `<div class="cards">${items.map((c) => `<div class="card">${c.kicker ? `<p class="kicker">${esc(c.kicker)}</p>` : ''}<h3>${esc(c.title)}</h3>${c.body ? `<p>${esc(c.body)}</p>` : ''}${c.html || ''}</div>`).join('')}</div>`;
}

function copyBox({ label, subject, text }) {
  return `<div class="copy">${label ? `<p class="kicker">${esc(label)}</p>` : ''}${subject ? `<div class="subject">Subject: ${esc(subject)}</div>` : ''}${esc(text)}</div>`;
}

function page({ title, description, theme: t, body, footer, size }) {
  return files.htmlDoc({
    title,
    description,
    css: baseCss(t, { size }),
    body: `${body}\n<footer class="foot"><div class="wrap">${esc(footer || '')}</div></footer>`,
  });
}

module.exports = { theme, baseCss, ring, hero, block, stats, fixList, table, steps, checklist, cards, copyBox, page, esc, FONT };
