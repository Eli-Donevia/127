// The look of every page this pack makes: one self-contained HTML file, inline CSS, no scripts, the
// member's own colors, big confident type, a clean grid that folds to one column on a phone, and
// print styles so it comes out of a printer looking like a designed one-pager.
// Components return HTML strings; everything a member typed goes through esc().

const { files, color } = require('../../_kit');

const esc = files.esc;
const FONT = '"Inter", "Helvetica Neue", Helvetica, Arial, system-ui, -apple-system, "Segoe UI", sans-serif';

function vars(p) {
  const soft = color.mix(p.primary, p.paper, 0.88);
  const deep = color.darken(p.primary, 0.35);
  return `--primary:${p.primary};--on-primary:${p.onPrimary};--accent:${p.accent};--on-accent:${p.onAccent};--ink:${p.ink};--paper:${p.paper};--surface:${p.surface};--muted:${p.muted};--line:${p.line};--soft:${soft};--deep:${deep};--on-deep:${color.readableOn(deep)};`;
}

function css(p, { size = 'Letter', orientation = 'portrait', margin = '0.45in' } = {}) {
  return `
:root{${vars(p)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 ${FONT};-webkit-font-smoothing:antialiased;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.wrap{max-width:880px;margin:0 auto;padding:28px 20px 40px}
h1,h2,h3,h4{margin:0;line-height:1.08;letter-spacing:-0.02em}
h1{font-size:clamp(34px,6.4vw,58px);font-weight:850}
h2{font-size:clamp(22px,3.4vw,30px);font-weight:800}
h3{font-size:19px;font-weight:750;letter-spacing:-0.01em}
p{margin:0}
a{color:inherit}
.eyebrow{font-size:12.5px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lede{font-size:clamp(18px,2.4vw,22px);line-height:1.4;color:var(--ink);opacity:.86;max-width:40ch}
.muted{color:var(--muted)}
.small{font-size:13.5px}
.tiny{font-size:12px}
.hero{background:var(--deep);color:var(--on-deep);border-radius:26px;padding:34px 34px 30px;position:relative;overflow:hidden}
.hero .eyebrow{color:var(--on-deep);opacity:.8}
.hero .lede{color:var(--on-deep);opacity:.92}
.hero:after{content:"";position:absolute;right:-80px;top:-110px;width:320px;height:320px;border-radius:50%;background:var(--primary);opacity:.55}
.hero:before{content:"";position:absolute;right:120px;bottom:-140px;width:220px;height:220px;border-radius:50%;border:28px solid var(--accent);opacity:.18}
.hero>*{position:relative;z-index:1}
.hero h1{margin:10px 0 14px;max-width:16ch}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.pill{display:inline-block;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:650;background:var(--soft);color:var(--ink);border:1px solid var(--line)}
.hero .pill{background:rgba(255,255,255,.14);color:var(--on-deep);border-color:rgba(255,255,255,.26)}
.pill.solid{background:var(--accent);color:var(--on-accent);border-color:transparent}
.section{margin-top:30px}
.section>.head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px;border-bottom:2px solid var(--ink);padding-bottom:8px}
.section>.head .eyebrow{color:var(--muted)}
.grid{display:grid;gap:14px}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px 18px 16px;break-inside:avoid}
.card h3{margin-bottom:6px}
.card .tag{display:inline-block;font-size:11.5px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--primary);margin-bottom:8px}
.card.soft{background:var(--soft)}
.card.ink{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.card.ink .muted{color:var(--paper);opacity:.75}
.card.brand{background:var(--deep);color:var(--on-deep);border-color:var(--deep)}
.card.brand .tag{color:var(--on-deep);opacity:.75}
.num{font-size:clamp(30px,5vw,44px);font-weight:850;letter-spacing:-0.03em;line-height:1}
.stat .label{font-size:13px;color:var(--muted);margin-top:6px}
.card.ink .stat .label,.card.brand .stat .label{color:inherit;opacity:.78}
.promise{display:flex;gap:16px;align-items:flex-start;border:2px solid var(--primary);border-radius:20px;padding:20px 22px;background:#fff;break-inside:avoid}
.promise .seal{flex:0 0 auto;width:58px;height:58px;border-radius:50%;background:var(--deep);color:var(--on-deep);display:flex;align-items:center;justify-content:center;font-weight:850;font-size:12px;letter-spacing:.06em;text-align:center;line-height:1.1}
.promise p{font-size:18px;font-weight:650;line-height:1.35}
.list{margin:0;padding:0;list-style:none}
.list li{padding:9px 0 9px 28px;position:relative;border-bottom:1px dashed var(--line)}
.list li:last-child{border-bottom:0}
.list li:before{content:"";position:absolute;left:2px;top:15px;width:12px;height:12px;border-radius:4px;background:var(--primary)}
.list.plain li:before{background:var(--line)}
table.t{width:100%;border-collapse:collapse;font-size:14.5px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid var(--line)}
table.t th{background:var(--ink);color:var(--paper);text-align:left;font-weight:700;padding:10px 12px;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase}
table.t td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:top}
table.t td.r,table.t th.r{text-align:right;white-space:nowrap}
table.t tr.total td{font-weight:800;background:var(--soft)}
.quote{font-size:17px;line-height:1.45;background:var(--soft);border-left:5px solid var(--primary);border-radius:0 14px 14px 0;padding:14px 16px}
.cta{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;background:var(--ink);color:var(--paper);border-radius:22px;padding:22px 24px;margin-top:30px;break-inside:avoid}
.cta .big{font-size:clamp(20px,3vw,26px);font-weight:800;letter-spacing:-0.01em}
.cta .btn{background:var(--accent);color:var(--on-accent);border-radius:999px;padding:12px 20px;font-weight:800;text-decoration:none;white-space:nowrap}
.foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:28px;padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
.check{display:block;position:relative;padding:10px 12px 10px 44px;border-bottom:1px solid var(--line);cursor:pointer}
.check:last-child{border-bottom:0}
.check input{position:absolute;opacity:0;width:1px;height:1px}
.check .box{position:absolute;left:12px;top:11px;width:20px;height:20px;border:2px solid var(--ink);border-radius:6px;background:#fff}
.check input:checked+.box{background:var(--primary);border-color:var(--primary)}
.check input:checked+.box:after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid var(--on-primary);border-width:0 3px 3px 0;transform:rotate(45deg)}
.check input:checked~.txt{color:var(--muted);text-decoration:line-through}
.check .txt b{font-weight:700}
.check .why{display:block;font-size:13px;color:var(--muted);margin-top:2px}
details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin-bottom:10px;break-inside:avoid}
details summary{font-weight:700;cursor:pointer;list-style:none}
details summary::-webkit-details-marker{display:none}
details summary:after{content:"+";float:right;font-weight:800;color:var(--primary)}
details[open] summary:after{content:"-"}
details p{margin-top:8px;color:var(--ink);opacity:.9}
.bar{height:12px;border-radius:999px;background:var(--line);overflow:hidden}
.bar>i{display:block;height:100%;background:var(--primary);border-radius:999px}
.fill{border-bottom:1.5px solid var(--ink);min-height:30px}
.hide-print{}
@media (max-width:640px){
  .wrap{padding:16px 14px 30px}
  .hero{padding:26px 22px 24px;border-radius:20px}
  .g2,.g3,.g4{grid-template-columns:1fr}
  .promise{flex-direction:column}
  table.t{font-size:13.5px}
  table.t th,table.t td{padding:8px 9px}
}
@page{size:${size} ${orientation};margin:${margin}}
@media print{
  body{background:#fff;font-size:13.5px}
  .wrap{max-width:none;padding:0}
  .hero{border-radius:16px;padding:24px 26px}
  .card,.promise,.cta,details{break-inside:avoid}
  .section{margin-top:18px}
  .hide-print{display:none!important}
  details{border:0;padding:0}
  a{text-decoration:none}
}
`;
}

// A complete page. body is HTML; extra is page-specific CSS.
function doc({ title, description = '', pal, body, extra = '', size, orientation, margin }) {
  return files.htmlDoc({ title, description, css: css(pal, { size, orientation, margin }) + extra, body: `<div class="wrap">${body}</div>` });
}

function hero({ eyebrow, title, lede, pills = [] }) {
  return `<header class="hero">${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1>${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}${pills.length ? `<div class="meta">${pills.filter(Boolean).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>` : ''}</header>`;
}

function section(title, inner, { eyebrow = '', id = '' } = {}) {
  return `<section class="section"${id ? ` id="${esc(id)}"` : ''}><div class="head"><h2>${esc(title)}</h2>${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}</div>${inner}</section>`;
}

function card({ tag = '', title = '', body = '', extra = '', cls = '' }) {
  return `<div class="card ${cls}">${tag ? `<div class="tag">${esc(tag)}</div>` : ''}${title ? `<h3>${esc(title)}</h3>` : ''}${body ? `<p class="small">${esc(body)}</p>` : ''}${extra}</div>`;
}

function grid(items, cols = 2) {
  return `<div class="grid g${cols}">${items.filter(Boolean).join('')}</div>`;
}

function stat(value, label, cls = '') {
  return `<div class="card ${cls}"><div class="stat"><div class="num">${esc(value)}</div><div class="label">${esc(label)}</div></div></div>`;
}

function promise(textLine, seal = 'MY PROMISE') {
  return `<div class="promise"><div class="seal">${esc(seal).replace(' ', '<br>')}</div><div><div class="eyebrow">What I promise</div><p>${esc(textLine)}</p></div></div>`;
}

function list(items, cls = '') {
  return `<ul class="list ${cls}">${items.filter(Boolean).map((t) => `<li>${t.html || esc(t)}</li>`).join('')}</ul>`;
}

// cols: [{ key, label, right }], rows: objects; a row with total: true is bold.
function table(cols, rows) {
  const head = cols.map((c) => `<th${c.right ? ' class="r"' : ''}>${esc(c.label)}</th>`).join('');
  const body = rows.map((r) => `<tr${r.total ? ' class="total"' : ''}>${cols.map((c) => `<td${c.right ? ' class="r"' : ''}>${esc(r[c.key] == null ? '' : r[c.key])}</td>`).join('')}</tr>`).join('');
  return `<table class="t"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function cta(big, small, button) {
  return `<div class="cta"><div><div class="big">${esc(big)}</div>${small ? `<div class="small" style="opacity:.8;margin-top:4px">${esc(small)}</div>` : ''}</div>${button ? `<span class="btn">${esc(button)}</span>` : ''}</div>`;
}

function foot(left, right) {
  return `<footer class="foot"><span>${esc(left)}</span><span>${esc(right || '')}</span></footer>`;
}

function faq(items) {
  return items.map((q) => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('');
}

module.exports = { esc, css, doc, hero, section, card, grid, stat, promise, list, table, cta, foot, faq, FONT };
