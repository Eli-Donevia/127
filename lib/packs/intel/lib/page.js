// The one-page reports behind "What reviews say" and "Find the gap": one self-contained HTML file
// each, inline CSS, no scripts, one column on a phone, clean when printed. Everything from a business,
// a review or the member goes through esc().

const { files, color } = require('../../_kit');

const esc = files.esc;
const P = color.palette('clean');
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif";

const CSS = `@page{size:Letter;margin:12mm}*{box-sizing:border-box}
body{margin:0;background:${P.paper};color:${P.ink};font:15.5px/1.5 ${FONT};overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:920px;margin:0 auto;padding:26px 18px 40px}
.band{background:${P.ink};color:#fff;border-radius:20px;padding:26px 26px 22px;position:relative;overflow:hidden}
.band:after{content:"";position:absolute;right:-70px;top:-90px;width:260px;height:260px;border-radius:50%;background:${P.primary};opacity:.55}
.band>*{position:relative;z-index:1}
@media (min-width:640px){.band h1,.band .sub{max-width:calc(100% - 150px)}}
.stars{display:grid;grid-template-columns:70px 1fr 40px;gap:4px 10px;align-items:center;max-width:520px}.stars .bar{margin:0}
.eyebrow{font-size:12px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;opacity:.8;margin:0 0 6px}
h1{font-size:clamp(28px,5vw,40px);line-height:1.1;letter-spacing:-.02em;margin:0 0 8px}
h2{font-size:21px;letter-spacing:-.01em;margin:30px 0 12px;padding-bottom:6px;border-bottom:2px solid ${P.ink}}
h3{font-size:17px;line-height:1.25;margin:0 0 4px}
p{margin:0}
.sub{opacity:.9;max-width:64ch}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pill{display:inline-block;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:650;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28)}
.muted{color:${P.muted}}.small{font-size:13.5px}.tiny{font-size:12px}
.card{background:#fff;border:1px solid ${P.line};border-radius:16px;padding:14px 16px;margin:0 0 12px;break-inside:avoid}
.top{display:flex;gap:12px;align-items:flex-start}
.n{flex:none;width:32px;height:32px;border-radius:50%;background:${P.primary};color:${P.onPrimary};display:flex;align-items:center;justify-content:center;font-weight:800}
.grow{flex:1;min-width:0}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.grid.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.col h3{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.col h3 span{font-size:13px;color:${P.muted};font-weight:600;white-space:nowrap}
.love{border-top:5px solid #2e8b57}.gripe{border-top:5px solid #c2410c}.ask{border-top:5px solid ${P.primary}}
.theme{margin:10px 0 0;padding-top:8px;border-top:1px dashed ${P.line}}
.theme:first-of-type{border-top:0;padding-top:0}
.theme b{font-size:14.5px}
.bar{height:7px;border-radius:99px;background:${P.surface};overflow:hidden;margin:4px 0 6px}.bar i{display:block;height:100%;background:${P.primary}}
.love .bar i{background:#2e8b57}.gripe .bar i{background:#c2410c}
.q{margin:6px 0 0;padding:6px 10px;border-left:3px solid ${P.line};background:${P.paper};border-radius:0 8px 8px 0;font-size:14px;font-style:italic}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-block;border-radius:999px;padding:5px 12px;font-size:14px;font-weight:650;background:#fff;border:1px solid ${P.line}}
.chip b{color:${P.primary}}
.say{margin:8px 0 0;padding:9px 12px;border-left:4px solid ${P.primary};background:${P.paper};border-radius:0 10px 10px 0}
.say b{display:block;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:${P.muted};margin-bottom:2px}
.tag{display:inline-block;font-size:11.5px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;padding:2px 7px;margin:0 6px 4px 0;background:${P.surface};color:${P.ink}}
.tag.zero{background:#e4f4ea;color:#1d5c34}.tag.few{background:#fff1d6;color:#7a4b00}.tag.you{background:#e8eefc;color:#1f3c88}
table.t{width:100%;overflow-wrap:break-word;border-collapse:collapse;background:#fff;border:1px solid ${P.line};border-radius:12px;overflow:hidden;font-size:14px}
table.t th{background:${P.ink};color:#fff;text-align:left;font-size:12px;letter-spacing:.05em;text-transform:uppercase;padding:9px 10px}
table.t td{padding:8px 10px;border-top:1px solid ${P.line};vertical-align:top}
table.t td.num{white-space:nowrap;font-weight:700}
.dots{display:inline-flex;gap:3px;vertical-align:middle;margin-right:6px}.dots i{width:9px;height:9px;border-radius:50%;background:${P.line};display:inline-block}.dots i.on{background:${P.primary}}
ul.plain{margin:0;padding-left:18px}ul.plain li{margin:4px 0}
footer{margin-top:28px;font-size:12px;color:${P.muted}}footer a{color:${P.muted}}footer p{margin:0 0 6px}
.osm-credit{margin:6px 0 0}
@media (max-width:720px){.grid,.grid.g2{grid-template-columns:1fr}.wrap{padding:16px 12px 30px}.band{padding:20px 18px}.dots{display:none}table.t{font-size:13.5px}table.t td,table.t th{padding:7px 8px}}
@media print{body{background:#fff;font-size:12.5px}.wrap{padding:0;max-width:none}.band{border-radius:12px;padding:16px 18px}.band:after{display:none}.card{padding:10px 12px;margin-bottom:8px}a{color:${P.ink}}h2{margin-top:18px}}`;

function page({ title, eyebrow, h1, sub, pills = [], body, footer = '' }) {
  const head = `<div class="band"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(h1)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${pills.length ? `<div class="pills">${pills.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>` : ''}</div>`;
  return files.htmlDoc({ title, css: CSS, body: `<div class="wrap">${head}${body}<footer>${footer}</footer></div>` });
}

const bar = (n, of) => `<div class="bar"><i style="width:${of && n ? Math.max(4, Math.round((n / of) * 100)) : 0}%"></i></div>`;
// Up to 10 dots, one per competitor read, filled for those who say it.
const dots = (n, of) => `<span class="dots" aria-hidden="true">${Array.from({ length: Math.min(of, 10) }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;

module.exports = { page, bar, dots, esc, CSS };
