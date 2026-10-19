// The printable pages behind the call sheet, the walk-in route and pick a niche: one self-contained
// HTML file each, inline CSS, no scripts, tick boxes that print, and one column on a phone.
// Everything from a business or the member goes through esc().

const { files, color } = require('../../_kit');

const esc = files.esc;
const P = color.palette('clean');
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif";

const CSS = `@page{size:Letter;margin:12mm}*{box-sizing:border-box}
body{margin:0;background:${P.paper};color:${P.ink};font:15.5px/1.45 ${FONT};overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:900px;margin:0 auto;padding:26px 18px 40px}
.band{background:${P.ink};color:#fff;border-radius:20px;padding:26px 26px 22px;position:relative;overflow:hidden}
.band:after{content:"";position:absolute;right:-70px;top:-90px;width:260px;height:260px;border-radius:50%;background:${P.primary};opacity:.55}
.band>*{position:relative;z-index:1}
.eyebrow{font-size:12px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;opacity:.8;margin:0 0 6px}
h1{font-size:clamp(28px,5vw,42px);line-height:1.08;letter-spacing:-.02em;margin:0 0 8px}
h2{font-size:21px;letter-spacing:-.01em;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid ${P.ink}}
h3{font-size:18px;line-height:1.2;margin:0}
p{margin:0}
.sub{opacity:.88;max-width:62ch}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pill{display:inline-block;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:650;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28)}
.muted{color:${P.muted}}.small{font-size:13px}.tiny{font-size:12px}
.card{background:#fff;border:1px solid ${P.line};border-radius:16px;padding:14px 16px;margin:0 0 12px;break-inside:avoid}
.top{display:flex;gap:12px;align-items:flex-start}
.n{flex:none;width:34px;height:34px;border-radius:50%;background:${P.primary};color:${P.onPrimary};display:flex;align-items:center;justify-content:center;font-weight:800}
.grow{flex:1;min-width:0}
.phone{font-size:20px;font-weight:800;letter-spacing:.01em;text-decoration:none;color:${P.ink};white-space:nowrap}
.tag{display:inline-block;font-size:11.5px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;padding:2px 7px;margin:4px 6px 0 0;background:${P.surface};color:${P.ink}}
.tag.due{background:#fff1d6;color:#7a4b00}
.tag.new{background:#e4f4ea;color:#1d5c34}
.say{margin:10px 0 0;padding:9px 12px;border-left:4px solid ${P.primary};background:${P.paper};border-radius:0 10px 10px 0}
.say b{display:block;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:${P.muted};margin-bottom:2px}
.vm{border-left-color:${P.line};font-size:13.5px}
.fact{margin-top:6px;font-size:14px}.fact b{font-weight:700}
.links{margin-top:8px;font-size:13px}.links a{color:${P.primary}}
.ticks{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;padding-top:9px;border-top:1px dashed ${P.line};font-size:13.5px}
.ticks span{white-space:nowrap}
.box{display:inline-block;width:14px;height:14px;border:1.6px solid ${P.ink};border-radius:3px;vertical-align:-2px;margin-right:5px;background:#fff}
.line{display:inline-block;min-width:90px;border-bottom:1px solid ${P.ink};height:14px;vertical-align:-3px}
.notes{margin-top:8px;font-size:13px;color:${P.muted}}.notes .line{min-width:70%}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.steps{counter-reset:s;list-style:none;margin:0;padding:0}
.steps li{counter-increment:s;position:relative;padding:6px 0 6px 34px}
.steps li:before{content:counter(s);position:absolute;left:0;top:5px;width:24px;height:24px;border-radius:50%;background:${P.ink};color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center}
ul.plain{margin:0;padding-left:18px}ul.plain li{margin:4px 0}
.leg{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;background:${P.surface};border-radius:12px;padding:10px 14px;margin:0 0 10px}
.btn{display:inline-block;background:${P.primary};color:${P.onPrimary};text-decoration:none;font-weight:750;border-radius:999px;padding:7px 14px;font-size:14px}
table.t{width:100%;border-collapse:collapse;background:#fff;border:1px solid ${P.line};border-radius:12px;overflow:hidden;font-size:14px}
table.t th{background:${P.ink};color:#fff;text-align:left;font-size:12px;letter-spacing:.05em;text-transform:uppercase;padding:9px 10px}
table.t td{padding:9px 10px;border-top:1px solid ${P.line};vertical-align:top}
table.t tr.win td{background:#eef6ff}
.bar{height:8px;border-radius:99px;background:${P.surface};overflow:hidden;margin-top:4px}.bar i{display:block;height:100%;background:${P.primary}}
.score{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px}
.score div{font-size:12.5px;color:${P.muted}}.score b{color:${P.ink};font-size:15px}
.win{border:2px solid ${P.primary}}
.ribbon{display:inline-block;background:${P.primary};color:${P.onPrimary};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:6px;padding:3px 8px;margin-bottom:8px}
footer{margin-top:26px;font-size:12px;color:${P.muted}}footer a{color:${P.muted}}
.osm-credit{margin:6px 0 0}
@media (max-width:600px){.grid,.score{grid-template-columns:1fr 1fr}.wrap{padding:16px 12px 30px}.band{padding:20px 18px}.phone{font-size:18px}}
@media print{body{background:#fff;font-size:12.5px}.wrap{padding:0;max-width:none}.band{border-radius:12px;padding:16px 18px}.band:after{display:none}.card{padding:10px 12px;margin-bottom:8px}a{color:${P.ink}}h2{margin-top:18px}.btn{border:1px solid ${P.ink};background:#fff;color:${P.ink}}}`;

const tick = (label) => `<span><i class="box"></i>${esc(label)}</span>`;
const tickLine = (label) => `<span><i class="box"></i>${esc(label)} <i class="line"></i></span>`;

function page({ title, eyebrow, h1, sub, pills = [], body, footer = '' }) {
  const head = `<div class="band"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(h1)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${pills.length ? `<div class="pills">${pills.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>` : ''}</div>`;
  return files.htmlDoc({ title, css: CSS, body: `<div class="wrap">${head}${body}<footer>${footer}</footer></div>` });
}

module.exports = { page, tick, tickLine, esc, CSS };
