// Printable HTML pages for the ad desk, in the member's colors. No scripts.
const { files, color, brain } = require('../../_kit');

const esc = files.esc;

function page(ctx, { title, kicker, sub, stats = [], body }) {
  const b = brain.brainOf(ctx, {});
  const p = color.palette(color.isHex((brain.packMemory(ctx, 'brand') || {}).primary || '') ? brain.packMemory(ctx, 'brand').primary : 'bold', 0);
  const deep = color.darken(p.primary, 0.8);
  const tint = color.mix(p.primary, '#ffffff', 0.9);
  const css = `:root{--p:${p.primary};--onp:${p.onPrimary};--ink:${p.ink};--muted:${p.muted};--line:${p.line};--surface:${p.surface};--tint:${tint};--deep:${deep}}
*{box-sizing:border-box}body{margin:0;background:var(--surface);color:var(--ink);font:16px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:40px 22px 64px}.hero{background:var(--deep);color:#fff;border-radius:28px;padding:42px 40px;position:relative;overflow:hidden}
.hero:after{content:"";position:absolute;right:-80px;top:-80px;width:280px;height:280px;border-radius:50%;background:var(--p)}.hero>*{position:relative;z-index:1}
.kicker{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:7px 13px;border-radius:999px;background:var(--p);color:var(--onp)}
h1{font-size:clamp(30px,5vw,52px);line-height:1.04;letter-spacing:-.03em;margin:18px 0 10px;font-weight:800;max-width:16em}.sub{color:rgba(255,255,255,.8);font-size:18px;margin:0;max-width:40em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:24px}.stat{background:rgba(255,255,255,.1);border-radius:16px;padding:14px 16px}.stat b{display:block;font-size:26px}.stat span{font-size:13px;color:rgba(255,255,255,.75)}
section{margin-top:36px}h2{font-size:26px;letter-spacing:-.02em;margin:0 0 6px}.lead{color:var(--muted);margin:0 0 14px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px 24px;margin-bottom:14px;break-inside:avoid}.card h3{margin:4px 0 8px;font-size:20px}
.tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:var(--tint)}.tag.ok{background:var(--p);color:var(--onp)}
table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px}th{background:var(--tint);text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:10px 12px}td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:top}
ol,ul{padding-left:20px}li{margin:6px 0}.muted{color:var(--muted)}.foot{margin-top:36px;color:var(--muted);font-size:13px}
@media (max-width:640px){table{display:block;overflow-x:auto;font-size:13px}th,td{padding:8px 9px}}@media print{body{background:#fff}.hero,.tag,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@page{size:letter;margin:.5in}`;
  const st = stats.length ? `<div class="stats">${stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>` : '';
  return files.htmlDoc({ title, css, body: `<div class="wrap"><header class="hero"><span class="kicker">${esc(kicker)}</span><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${st}</header>${body}<p class="foot">${esc([b.name, b.city].filter(Boolean).join(', '))}. Limits checked on the platforms' help pages on Oct 19, 2026.</p></div>` });
}

function table(cols, rows) {
  return `<table><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c.key] == null ? '' : r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

module.exports = { page, table, esc };
