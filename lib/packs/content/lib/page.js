// Printable HTML pages in the member's own colors: a bold header band, clean cards and tables, letter
// size when printed. No scripts (the harness shows HTML with scripts off).

const { files, color } = require('../../_kit');

const esc = files.esc;

function css(p) {
  const tint = color.mix(p.primary, '#ffffff', 0.9);
  const deep = color.darken ? color.darken(p.primary, 0.78) : p.ink;
  return `:root{--p:${p.primary};--onp:${p.onPrimary};--ink:${p.ink};--paper:#ffffff;--surface:${p.surface};--muted:${p.muted};--line:${p.line};--tint:${tint};--deep:${deep}}
*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--ink);font:16px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:980px;margin:0 auto;padding:40px 22px 64px}
.hero{background:var(--deep);color:#fff;border-radius:28px;padding:44px 42px 40px;position:relative;overflow:hidden}
.hero:after{content:"";position:absolute;right:-90px;top:-90px;width:300px;height:300px;border-radius:50%;background:var(--p);opacity:.9}
.hero>*{position:relative;z-index:1}
.kicker{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:7px 13px;border-radius:999px;background:var(--p);color:var(--onp)}
h1{font-size:clamp(32px,5vw,54px);line-height:1.03;letter-spacing:-.03em;margin:18px 0 10px;font-weight:800;max-width:15em}
.sub{color:rgba(255,255,255,.78);font-size:18px;margin:0;max-width:40em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:26px}
.stat{background:rgba(255,255,255,.1);border-radius:16px;padding:14px 16px}.stat b{display:block;font-size:26px;letter-spacing:-.02em}.stat span{font-size:13px;color:rgba(255,255,255,.75)}
section{margin-top:38px}h2{font-size:26px;letter-spacing:-.02em;margin:0 0 4px;font-weight:800}.lead{color:var(--muted);margin:0 0 16px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:22px 24px;margin-bottom:14px;break-inside:avoid}
.card h3{font-size:20px;letter-spacing:-.01em;margin:6px 0 8px;line-height:1.25}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}
.tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:var(--tint);color:var(--ink)}
.tag.ask{background:var(--p);color:var(--onp)}
table{width:100%;border-collapse:separate;border-spacing:0;background:var(--paper);border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px}
th{background:var(--tint);text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);padding:10px 12px}
td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:top}
.say{font-size:17px}.muted{color:var(--muted)}.big{font-size:22px;font-weight:800;letter-spacing:-.01em;line-height:1.25}
pre{white-space:pre-wrap;font:inherit;background:var(--surface);border-radius:12px;padding:14px 16px;margin:10px 0 0}
ul.checks{list-style:none;padding:0;margin:8px 0 0}ul.checks li{padding:6px 0 6px 30px;position:relative;border-top:1px solid var(--line)}ul.checks li:before{content:"";position:absolute;left:0;top:9px;width:16px;height:16px;border:2px solid var(--p);border-radius:5px}
.foot{margin-top:40px;color:var(--muted);font-size:13px}
@media (max-width:640px){table{display:block;overflow-x:auto;font-size:13px}th,td{padding:8px 9px}}
@media print{body{background:#fff}.wrap{padding:0}.hero,.tag,.kicker,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.pb{break-before:page}}
@page{size:letter;margin:.5in}`;
}

// stats: [{ value, label }]
// css: extra rules for one page (still no scripts).
function page(f, { title, kicker, sub, stats = [], body, foot, css: more = '' }) {
  const statHtml = stats.length ? `<div class="stats">${stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>` : '';
  const footer = foot || [f.name, f.where, f.handle ? `@${f.handle}` : ''].filter(Boolean).join('  |  ');
  return files.htmlDoc({
    title,
    css: css(f.palette) + more,
    body: `<div class="wrap"><header class="hero"><span class="kicker">${esc(kicker)}</span><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${statHtml}</header>${body}<p class="foot">${esc(footer)}</p></div>`,
  });
}

function table(cols, rows) {
  return `<table><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c.key] == null ? '' : r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

module.exports = { page, table, esc, css };
