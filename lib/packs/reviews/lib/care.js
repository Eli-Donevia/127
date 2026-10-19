// The care plan page a reviews client keeps: their plan and price, the report day, what the member
// does every week and month, the promises, what the member needs from them, the next 90 days and one
// add-on for when they're ready. No scripts; inline CSS; prints on Letter paper and reads on a phone.

const kit = require('../../_kit');
const { esc, htmlDoc } = kit.files;
const { colorsFor } = require('./cardkit');

function css(p) {
  return `@page{size:Letter;margin:0.5in}
*{box-sizing:border-box}
body{margin:0;background:${p.paper};color:${p.ink};font:15px/1.45 Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
main{max-width:820px;margin:0 auto;padding:28px 20px 40px}
header{border-bottom:4px solid ${p.primary};padding-bottom:12px;margin-bottom:18px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${p.muted};margin:0 0 4px}
h1{font-size:28px;line-height:1.15;margin:0 0 6px}
h2{font-size:18px;margin:22px 0 8px;color:${p.primary}}
h3{font-size:15px;margin:4px 0}
p{margin:6px 0}
.sub{color:${p.muted};font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}
th,td{text-align:left;vertical-align:top;padding:7px 8px;border-bottom:1px solid ${p.line}}
th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:${p.muted}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{border:1px solid ${p.line};border-radius:10px;padding:12px 14px;background:${p.surface};break-inside:avoid}
.label{font-size:12px;color:${p.muted}}
.price{font-size:22px;font-weight:700}
ul{padding-left:20px;margin:6px 0}
li{margin:3px 0}
.rule{border-left:4px solid ${p.primary};padding:8px 12px;background:${p.surface};margin:8px 0}
footer{margin-top:22px;padding-top:10px;border-top:1px solid ${p.line};font-size:11px;color:${p.muted}}
@media (max-width:640px){.grid{grid-template-columns:1fr}h1{font-size:23px}}
@media print{main{padding:0}.box,.rule{background:#fff}}`;
}

const li = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

function carePlanHtml({ client, plan, weekly, monthly, needs, promises, rule, dates, addon, member = {}, start, checked }) {
  const p = colorsFor(client.name || 'client', client.color);
  const report = (dates.find((d) => d.report) || {}).label || 'Monthly';
  const body = `<main>
<header><p class="kicker">Reviews care plan</p><h1>${esc(client.name)}: your Google reviews, looked after</h1>
<p class="sub">From ${esc(member.name || '[your name]')}${member.business ? `, ${esc(member.business)}` : ''}. Starts ${esc(start)}. The cards, the review link and the templates are yours.</p></header>
<div class="grid">
<div class="box"><div class="label">Your plan</div><div class="price">${esc(plan.label)}</div><p>${esc(plan.priceText)}</p>${plan.note ? `<p class="sub">${esc(plan.note)}</p>` : ''}</div>
<div class="box"><div class="label">Your monthly report</div><div class="price">${esc(report)}</div><p class="sub">Then the first weekday of every month: new reviews, replies, stars and cards handed out, read from your own Business Profile.</p></div>
</div>
<h2>Every week</h2>${li(weekly)}
<h2>Every month</h2>${li(monthly)}
<h2>My promises</h2>${li(promises)}
<h2>What I need from you</h2>${li(needs)}
${rule ? `<div class="rule"><b>The one rule:</b> ${esc(rule)}</div>` : ''}
<h2>The next 90 days</h2>
<table><thead><tr><th>When</th><th>What happens</th></tr></thead><tbody>
${dates.map((d) => `<tr><td>${esc(d.label)}</td><td>${esc(d.what)}</td></tr>`).join('\n')}
</tbody></table>
${addon ? `<h2>When you're ready</h2><div class="box"><h3>${esc(addon.label)}</h3><p>${esc(addon.pitch)}</p><p class="price">${esc(addon.priceText)}</p></div>` : ''}
<footer>${esc(member.name || '[your name]')}${member.contact ? ` | ${esc(member.contact)}` : ''}. Plan made ${esc(checked)}. Cancel any month: the cards, the review link and the reply templates stay yours.</footer>
</main>`;
  return htmlDoc({ title: `Care plan for ${client.name}`, css: css(p), body, description: `How ${member.name || 'your reviews partner'} looks after ${client.name}'s Google reviews every week and month.` });
}

module.exports = { carePlanHtml };
