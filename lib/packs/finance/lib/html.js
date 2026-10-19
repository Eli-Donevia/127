// One design system for every page the money desk hands a member: your numbers, startup budget,
// 12-month cash plan, tax kit, price check and the monthly check-in. Static HTML and CSS only (the
// Library previews with scripts off), the member's own colors (kit color.palette), phone-first,
// and print-clean on US Letter (@page set, colors kept when printed).

const { files, color, money } = require('../../_kit');

const esc = files.esc;
const FONT = "Inter, 'Inter Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function theme(seed) {
  const p = color.palette(color.isHex(seed) ? seed : seed || 'clean');
  const soft = color.mix(p.primary, '#ffffff', 0.9);
  const [h, sat] = color.rgbToHsl(color.hexToRgb(p.primary));
  // A red brand color would read as a loss on a cash chart: positive bars use the ink color then.
  const redish = sat > 0.25 && (h >= 335 || h <= 22);
  return {
    ...p,
    posBar: redish ? p.ink : p.primary,
    soft,
    softText: color.ensureContrast(p.primary, soft, 4.5),
    deep: color.mix(p.primary, '#000000', 0.25),
    good: '#1d7a4c',
    goodSoft: '#e7f4ec',
    bad: '#b42318',
    badSoft: '#fdecea',
    warn: '#8a5300',
    warnSoft: '#fdf3e2',
  };
}

function css(t) {
  return `
:root{--p:${t.primary};--on-p:${t.onPrimary};--deep:${t.deep};--a:${t.accent};--ink:${t.ink};--paper:${t.paper};--surface:${t.surface};--muted:${t.muted};--line:${t.line};--soft:${t.soft};--soft-t:${t.softText};--good:${t.good};--good-s:${t.goodSoft};--bad:${t.bad};--bad-s:${t.badSoft};--warn:${t.warn};--warn-s:${t.warnSoft}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 16px/1.55 ${FONT};-webkit-font-smoothing:antialiased}
.sheet{max-width:920px;margin:0 auto;padding:28px 28px 8px}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:13px;color:var(--muted);margin-bottom:16px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink);letter-spacing:-.01em;font-size:15px}
.dot{width:14px;height:14px;border-radius:5px;background:var(--p);display:inline-block}
.hero{position:relative;overflow:hidden;background:var(--p);color:var(--on-p);border-radius:26px;padding:40px 40px 36px;margin-bottom:18px}
.hero:after{content:"";position:absolute;right:-90px;top:-90px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),rgba(255,255,255,0) 70%)}
.hero .kicker{color:inherit;opacity:.85}
.hero h1{font-size:clamp(30px,5vw,48px);line-height:1.05;letter-spacing:-.035em;font-weight:800;margin:0 0 14px;max-width:20ch;position:relative}
.hero .lead{font-size:17px;line-height:1.5;margin:0;max-width:58ch;opacity:.92;position:relative}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;position:relative}
.chip{font-size:12.5px;font-weight:600;padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28)}
.kicker{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--p);margin:0 0 8px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:0 0 8px}
@media (max-width:680px){.stats{grid-template-columns:1fr 1fr}.stat{padding:14px}}
.stat{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px 18px 16px;border-top:4px solid var(--p)}
.stat .v{font-size:clamp(26px,3.4vw,34px);font-weight:800;letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums}
.stat .l{font-size:13.5px;font-weight:650;margin-top:8px;line-height:1.35}
.stat .n{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.45}
.stat.good{border-top-color:var(--good)}.stat.good .v{color:var(--good)}
.stat.bad{border-top-color:var(--bad)}.stat.bad .v{color:var(--bad)}
.stat.warn{border-top-color:var(--warn)}.stat.warn .v{color:var(--warn)}
.block{padding:30px 0 6px}
.block h2{font-size:clamp(22px,2.8vw,28px);line-height:1.15;letter-spacing:-.025em;font-weight:800;margin:0 0 6px}
.block .sub{color:var(--muted);margin:0 0 16px;max-width:66ch;font-size:15px}
h3{font-size:16px;margin:0 0 6px;letter-spacing:-.01em}
p{margin:0 0 10px}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:16px;background:#fff}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:11px 14px;border-bottom:1px solid var(--line);background:var(--surface);white-space:nowrap}
td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tfoot td{font-weight:700;background:var(--surface);border-top:1px solid var(--line)}
td .small,.small{font-size:12.5px;color:var(--muted)}
tr.neg td.num.cash{color:var(--bad);font-weight:700}
.pill{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.04em;padding:3px 9px;border-radius:999px;white-space:nowrap}
.pill.good{background:var(--good-s);color:var(--good)}.pill.bad{background:var(--bad-s);color:var(--bad)}.pill.warn{background:var(--warn-s);color:var(--warn)}.pill.muted{background:var(--surface);color:var(--muted)}
.note{background:var(--soft);color:var(--soft-t);border-radius:14px;padding:14px 16px;font-size:14.5px;margin:12px 0}
.note.bad{background:var(--bad-s);color:var(--bad)}.note.good{background:var(--good-s);color:var(--good)}.note.warn{background:var(--warn-s);color:var(--warn)}
.note b{font-weight:700}
.bar{display:flex;height:34px;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#fff}
.bar span{display:block;height:100%}
.bar .s0{background:var(--muted)}.bar .s1{background:var(--warn)}.bar .s2{background:var(--a)}.bar .s3{background:var(--good)}.bar .s4{background:var(--bad)}
.legend{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:10px;font-size:13.5px}
.legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.legend .s0{background:var(--muted)}.legend .s1{background:var(--warn)}.legend .s2{background:var(--a)}.legend .s3{background:var(--good)}.legend .s4{background:var(--bad)}
.legend b{font-variant-numeric:tabular-nums}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px}
.card p:last-child{margin-bottom:0}
.check{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.check li{display:grid;grid-template-columns:22px 1fr;gap:12px;align-items:start;padding:12px 14px;background:#fff;border:1px solid var(--line);border-radius:12px;font-size:14.5px}
.check li:before{content:"";width:18px;height:18px;border:2px solid var(--p);border-radius:5px;margin-top:2px}
.check .small{display:block;margin-top:2px}
.steps{counter-reset:s;list-style:none;margin:0;padding:0;display:grid;gap:10px}
.steps li{counter-increment:s;position:relative;padding:14px 16px 14px 58px;background:#fff;border:1px solid var(--line);border-radius:14px;font-size:14.5px}
.steps li:before{content:counter(s);position:absolute;left:14px;top:12px;width:30px;height:30px;border-radius:9px;background:var(--p);color:var(--on-p);display:grid;place-items:center;font-weight:800;font-size:14px}
.steps b{display:block;font-size:15px;margin-bottom:2px}
.dates{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.date{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.date .d{font-size:20px;font-weight:800;letter-spacing:-.02em}
.date .w{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.4}
.date.next{background:var(--p);color:var(--on-p);border-color:var(--p)}
.date.next .w{color:inherit;opacity:.85}
.chart{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 14px 6px}
.chart svg{display:block;width:100%;height:auto}
.foot{margin-top:30px;padding:18px 0 34px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;line-height:1.55}
.foot p{margin:0 0 6px}
.foot a{color:var(--muted);word-break:break-all}
a{color:var(--p)}
@media (max-width:680px){
  .sheet{padding:16px 14px 4px}
  .hero{padding:28px 22px 24px;border-radius:20px}
  .two{grid-template-columns:1fr}
  td,th{padding:9px 10px}
  .top .date-made{display:none}
}
@page{size:Letter;margin:12mm}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{background:#fff;font-size:12px}
  .sheet{max-width:none;padding:0}
  .hero{padding:24px 26px 22px;border-radius:16px}
  .hero h1{font-size:30px}
  .block{padding:16px 0 4px;break-inside:auto}
  .stat,.card,.check li,.steps li,.date,tr,.note,.chart{break-inside:avoid}
  .block h2{break-after:avoid}
  .tablewrap{overflow:visible}
}
`;
}

const usd = (v, opts) => money.usd(v, opts);

function page({ t, title, business, kicker, heading, lead, chips = [], body, foot = [], made }) {
  const html = `
<main class="sheet">
  <div class="top"><div class="brand"><span class="dot"></span>${esc(business || 'Your business')}</div><div class="date-made">${esc(made || '')}</div></div>
  <section class="hero">
    ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}
    <h1>${esc(heading)}</h1>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
    ${chips.length ? `<div class="chips">${chips.filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
  </section>
  ${body}
  <footer class="foot">${foot.filter(Boolean).map((f) => `<p>${f}</p>`).join('')}</footer>
</main>`;
  return files.htmlDoc({ title, css: css(t), body: html, description: lead || heading });
}

function stats(items) {
  const list = items.filter(Boolean);
  if (!list.length) return '';
  return `<section class="stats">${list
    .map((s) => `<div class="stat ${s.tone || ''}"><div class="v">${esc(s.value)}</div><div class="l">${esc(s.label)}</div>${s.note ? `<div class="n">${esc(s.note)}</div>` : ''}</div>`)
    .join('')}</section>`;
}

function section({ kicker, title, sub, body }) {
  return `<section class="block">${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}${title ? `<h2>${esc(title)}</h2>` : ''}${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${body || ''}</section>`;
}

// cols: [{ label, num }]; rows: [[cell, ...]] where a cell is text or { html, cls }; rowCls: fn(row, i)
function table({ cols, rows, foot, rowCls }) {
  const cell = (c, col, tag = 'td') => {
    const v = c && typeof c === 'object' && 'html' in c ? c : { html: esc(c == null ? '' : c) };
    const cls = [col && col.num ? 'num' : '', v.cls || ''].filter(Boolean).join(' ');
    return `<${tag}${cls ? ` class="${cls}"` : ''}>${v.html}</${tag}>`;
  };
  return `<div class="tablewrap"><table><thead><tr>${cols.map((c) => `<th${c.num ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r, i) => `<tr${rowCls ? ` class="${rowCls(r, i) || ''}"` : ''}>${r.map((c, j) => cell(c, cols[j])).join('')}</tr>`)
    .join('')}</tbody>${foot ? `<tfoot><tr>${foot.map((c, j) => cell(c, cols[j])).join('')}</tr></tfoot>` : ''}</table></div>`;
}

const note = (html, tone = '') => `<div class="note ${tone}">${html}</div>`;
const pill = (textIn, tone = 'muted') => `<span class="pill ${tone}">${esc(textIn)}</span>`;
const small = (textIn) => `<span class="small">${esc(textIn)}</span>`;

function checklist(items) {
  return `<ul class="check">${items.map((i) => (typeof i === 'string' ? `<li><span>${esc(i)}</span></li>` : `<li><span>${esc(i.text)}${i.small ? `<span class="small">${esc(i.small)}</span>` : ''}</span></li>`)).join('')}</ul>`;
}

function steps(items) {
  return `<ol class="steps">${items.map((i) => (typeof i === 'string' ? `<li>${esc(i)}</li>` : `<li><b>${esc(i.title)}</b>${esc(i.text || '')}</li>`)).join('')}</ol>`;
}

// Where one payment goes: parts [{ label, value, tone: 0..4 }] that add up to the price.
function moneyBar(parts) {
  const shown = parts.filter((x) => x.value > 0);
  const total = shown.reduce((n, x) => n + x.value, 0) || 1;
  return `<div class="bar" role="img" aria-label="${esc(shown.map((x) => `${x.label} ${usd(x.value, { cents: true })}`).join(', '))}">${shown
    .map((x) => `<span class="s${x.tone}" style="width:${((x.value / total) * 100).toFixed(2)}%"></span>`)
    .join('')}</div><div class="legend">${shown.map((x) => `<span><i class="s${x.tone}"></i>${esc(x.label)} <b>${esc(usd(x.value, { cents: true }))}</b></span>`).join('')}</div>`;
}

function shortMoney(v) {
  const a = Math.abs(v);
  const s = a >= 10000 ? `$${Math.round(a / 1000)}k` : a >= 1000 ? `$${(a / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${Math.round(a)}`;
  return v < 0 ? `-${s}` : s;
}

// A static bar chart as inline SVG: one bar per label, negatives in red, a zero line.
function barChart({ labels, values, t, title = 'Chart', mark = [] }) {
  const W = 860;
  const H = 260;
  const padL = 56;
  const padR = 12;
  const padT = 22;
  const padB = 34;
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const y = (v) => padT + ((max - v) / span) * (H - padT - padB);
  const n = values.length || 1;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(46, slot * 0.62);
  const zero = y(0);
  const ticks = [max, (max + min) / 2, min].filter((v, i, a) => a.indexOf(v) === i);
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">`);
  for (const tv of ticks) parts.push(`<line x1="${padL}" x2="${W - padR}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}" stroke="${t.line}" stroke-width="1"/><text x="${padL - 8}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="${t.muted}" font-family="${esc(FONT)}">${esc(shortMoney(tv))}</text>`);
  values.forEach((v, i) => {
    const x = padL + slot * i + (slot - bw) / 2;
    const top = Math.min(y(v), zero);
    const h = Math.max(1.5, Math.abs(y(v) - zero));
    parts.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="${v < 0 ? t.bad : t.posBar || t.primary}"/>`);
    if (mark.includes(i)) parts.push(`<text x="${(x + bw / 2).toFixed(1)}" y="${(v < 0 ? top + h + 14 : top - 6).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="${v < 0 ? t.bad : t.ink}" font-family="${esc(FONT)}">${esc(shortMoney(v))}</text>`);
    parts.push(`<text x="${(x + bw / 2).toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="${t.muted}" font-family="${esc(FONT)}">${esc(labels[i])}</text>`);
  });
  parts.push(`<line x1="${padL}" x2="${W - padR}" y1="${zero.toFixed(1)}" y2="${zero.toFixed(1)}" stroke="${t.ink}" stroke-width="1.5"/>`);
  parts.push('</svg>');
  return `<div class="chart">${parts.join('')}</div>`;
}

function sourceLinks(urls) {
  const list = [...new Set((urls || []).filter((u) => /^https:\/\//.test(String(u))))];
  return list.map((u) => `<a href="${esc(u)}">${esc(u.replace(/^https:\/\/(www\.)?/, ''))}</a>`).join(' &middot; ');
}

// "2026-10-19" -> "Oct 19, 2026"
function dateText(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return String(ymd || '');
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

const cap = (s) => (s ? `${String(s)[0].toUpperCase()}${String(s).slice(1)}` : '');

module.exports = { dateText, cap, theme, css, page, stats, section, table, note, pill, small, checklist, steps, moneyBar, barChart, sourceLinks, esc, usd, FONT };
