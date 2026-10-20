// Printable HTML reports in the member's own colors: a header band, stat tiles, cards and tables,
// letter size when printed, readable on a phone. No scripts (HQ shows HTML with scripts off).
// Shape copied from content/lib/page.js.

const { files, color } = require('../../_kit');

const esc = files.esc;

// A brand color another pack saved (brand pack, shop pack), else a calm default.
function paletteFor(ctx) {
  const packs = (ctx && ctx.brain && ctx.brain.packs) || {};
  const hex = (v) => (typeof v === 'string' && color.isHex(v) ? v : '');
  const b = packs.brand || {};
  const seed = hex(b.primary) || hex(b.colors && b.colors.primary) || hex(b.palette && b.palette.primary) || hex(Array.isArray(b.colors) ? b.colors[0] : '') || hex(packs.shop && packs.shop.color) || 'clean';
  return color.palette(seed);
}

function css(p) {
  const tint = color.mix(p.primary, '#ffffff', 0.9);
  const deep = color.darken(p.primary, 0.78);
  return `:root{--p:${p.primary};--onp:${p.onPrimary};--ink:${p.ink};--paper:#ffffff;--surface:${p.surface};--muted:${p.muted};--line:${p.line};--tint:${tint};--deep:${deep};--good:#1d7a46;--bad:#b3261e}
*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--ink);font:16px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:980px;margin:0 auto;padding:32px 16px 56px}
.hero{background:var(--deep);color:#fff;border-radius:26px;padding:36px 30px 32px;position:relative;overflow:hidden}
.hero:after{content:"";position:absolute;right:-90px;top:-90px;width:280px;height:280px;border-radius:50%;background:var(--p);opacity:.85}
.hero>*{position:relative;z-index:1}
.kicker{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:7px 13px;border-radius:999px;background:var(--p);color:var(--onp)}
h1{font-size:clamp(28px,5vw,46px);line-height:1.05;letter-spacing:-.03em;margin:16px 0 8px;font-weight:800;max-width:16em}
.sub{color:rgba(255,255,255,.8);font-size:17px;margin:0;max-width:42em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:22px}
.stat{background:rgba(255,255,255,.1);border-radius:16px;padding:12px 14px}.stat b{display:block;font-size:24px;letter-spacing:-.02em}.stat span{font-size:13px;color:rgba(255,255,255,.78)}
section{margin-top:32px}h2{font-size:24px;letter-spacing:-.02em;margin:0 0 4px;font-weight:800}.lead{color:var(--muted);margin:0 0 14px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:18px 20px;margin-bottom:12px;break-inside:avoid}
.card h3{font-size:18px;margin:4px 0 6px;line-height:1.3}
.big{font-size:20px;font-weight:800;letter-spacing:-.01em;line-height:1.3;margin:0}
.tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:var(--tint);color:var(--ink)}
.tag.p{background:var(--p);color:var(--onp)}
table{width:100%;border-collapse:separate;border-spacing:0;background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px}
th{background:var(--tint);text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:9px 11px}
td{padding:9px 11px;border-top:1px solid var(--line);vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}
.good{color:var(--good);font-weight:700}.bad{color:var(--bad);font-weight:700}.muted{color:var(--muted)}.small{font-size:13px}
ul.plain{margin:0;padding-left:20px}ul.plain li{padding:3px 0}
.foot{margin-top:36px;color:var(--muted);font-size:13px}
@media (max-width:640px){.hero{padding:28px 20px}table{display:block;overflow-x:auto;font-size:13px}th,td{padding:7px 8px}}
@media print{body{background:#fff}.wrap{padding:0}.hero,.tag,.kicker,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@page{size:letter;margin:.5in}`;
}

// stats: [{ value, label }]
function page(ctx, { title, kicker, sub, stats = [], body, foot }) {
  const statHtml = stats.length ? `<div class="stats">${stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>` : '';
  return files.htmlDoc({
    title,
    css: css(paletteFor(ctx)),
    body: `<div class="wrap"><header class="hero"><span class="kicker">${esc(kicker)}</span><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${statHtml}</header>${body}<p class="foot">${esc(foot || '')}</p></div>`,
  });
}

// cols: [{ key, label, n (right-aligned), cls: (row) => 'good' | 'bad' | '' }]
function table(cols, rows) {
  const th = cols.map((c) => `<th${c.n ? ' class="n"' : ''}>${esc(c.label)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${cols.map((c) => {
    const cls = [c.n ? 'n' : '', c.cls ? c.cls(r) : ''].filter(Boolean).join(' ');
    return `<td${cls ? ` class="${cls}"` : ''}>${esc(r[c.key] == null ? '' : r[c.key])}</td>`;
  }).join('')}</tr>`).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

const list = (items) => (items.length ? `<ul class="plain">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

module.exports = { page, table, list, esc, css, paletteFor };
