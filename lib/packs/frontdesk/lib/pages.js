// Printable one-page HTML for the front desk pack: the missed-call audit (spec asset), the offer
// sheet, the setup sheet and the monthly report. No scripts; inline CSS; prints on Letter paper and
// reads on a phone. Colors come from the business the page is for.

const kit = require('../../_kit');
const { esc, htmlDoc } = kit.files;
const { palette } = kit.color;

function colorsFor(seed, hex) {
  const p = palette(hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : seed || 'steady');
  return p;
}

function css(p) {
  return `@page{size:Letter;margin:0.5in}
*{box-sizing:border-box}
body{margin:0;background:${p.paper};color:${p.ink};font:15px/1.45 Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
main{max-width:820px;margin:0 auto;padding:28px 20px 40px}
header{border-bottom:4px solid ${p.primary};padding-bottom:12px;margin-bottom:18px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${p.muted};margin:0 0 4px}
h1{font-size:28px;line-height:1.15;margin:0 0 6px}
h2{font-size:18px;margin:22px 0 8px;color:${p.primary}}
h3{font-size:15px;margin:12px 0 4px}
p{margin:6px 0}
.sub{color:${p.muted};font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}
th,td{text-align:left;vertical-align:top;padding:7px 8px;border-bottom:1px solid ${p.line}}
th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:${p.muted}}
.ok{color:#14632f;font-weight:600}.no{color:#a12a1a;font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{border:1px solid ${p.line};border-radius:10px;padding:12px 14px;background:${p.surface};break-inside:avoid}
.text{background:${p.primary};color:${p.onPrimary};border-radius:14px 14px 14px 4px;padding:10px 12px;margin:6px 0;max-width:92%}
.them{background:${p.surface};color:${p.ink};border:1px solid ${p.line};border-radius:14px 14px 4px 14px;margin-left:auto}
.convo{display:flex;flex-direction:column}
.label{font-size:12px;color:${p.muted};margin-top:8px}
.chars{font-size:11px;color:${p.muted}}
ol,ul{padding-left:20px;margin:6px 0}
li{margin:3px 0}
.fact{font-size:13px}
.fact a,.src a{color:${p.muted}}
.src{font-size:11px;color:${p.muted};word-break:break-all}
.big{font-size:30px;font-weight:700;color:${p.primary}}
.price{font-size:22px;font-weight:700}
.pill{display:inline-block;background:${p.accent};color:${p.onAccent};border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}
footer{margin-top:22px;padding-top:10px;border-top:1px solid ${p.line};font-size:11px;color:${p.muted}}
@media (max-width:640px){.grid{grid-template-columns:1fr}h1{font-size:23px}}
@media print{main{padding:0}.box{background:#fff}}`;
}

const li = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

// The missed-call audit: one page for one contractor, from their own website.
function auditHtml({ site, facts, rows, texts, faq, flow, convo, stats = [], member = {}, checked, credit = '' }) {
  const biz = facts.name || site.domain || 'Your business';
  const p = colorsFor(biz, facts.colors && facts.colors.primary);
  const okCount = rows.filter((r) => r.ok).length;
  const body = `<main>
<header><p class="kicker">Missed-call plan</p><h1>What happens when ${esc(biz)} misses a call</h1>
<p class="sub">Written from ${esc(site.domain || site.url || 'your website')} on ${esc(checked)}. Everything below quotes your own pages. Lines marked "Suggested" are not on your website yet.</p></header>
<h2>What a caller can do today</h2>
<p>${okCount} of ${rows.length} things a caller looks for are on your website.</p>
<table><thead><tr><th>What callers look for</th><th>What we found</th><th></th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.found)}</td><td class="${r.ok ? 'ok' : 'no'}">${r.ok ? 'Yes' : 'Fix'}</td></tr>`).join('\n')}
</tbody></table>
<h2>The text your number sends when you miss a call</h2>
<div class="grid">${texts.slice(0, 2).map((t) => `<div class="box"><div class="label">${esc(t.label)}</div><div class="text">${esc(t.text)}</div><div class="chars">${t.chars} characters</div></div>`).join('')}</div>
<div class="grid">${texts.slice(2, 4).map((t) => `<div class="box"><div class="label">${esc(t.label)}</div><div class="text">${esc(t.text)}</div></div>`).join('')}</div>
<h2>How a missed call turns into a booked job</h2>
<ol>${flow.map((f) => `<li><strong>${esc(f.step)}.</strong> ${esc(f.what)}</li>`).join('')}</ol>
<h2>Answers to the questions callers ask</h2>
${faq.map((f) => `<div class="box" style="margin:8px 0"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p><p class="sub">${esc(f.from)}</p></div>`).join('\n')}
<h2>A sample conversation</h2>
<p class="sub">A made-up caller, to show how it reads. Your real texts go out from your own number.</p>
<div class="convo">${convo.map((m) => `<div class="text ${m.from === 'caller' ? 'them' : ''}">${esc(m.text)}</div>`).join('')}</div>
${stats.length ? `<h2>Why this matters</h2>${stats.map((s) => `<p class="fact">${esc(s.line)} <span class="src">(${esc(s.label)}: <a href="${esc(s.url)}">${esc(s.url)}</a>)</span></p>`).join('')}` : ''}
<h2>Rules every text follows</h2>
${li(['Every first text says who it is from and how to stop (STOP, QUIT, END, CANCEL or UNSUBSCRIBE all work).', 'Replies stay about the call. No promotions to people who only called.', 'Your number is registered for business texting before it goes live.', 'You keep your phone number. Only the calls you miss get the text.'])}
<footer>Prepared by ${esc(member.name || '[your name]')}${member.business ? `, ${esc(member.business)}` : ''}${member.contact ? ` | ${esc(member.contact)}` : ''}. Pages read: ${esc((site.pages || []).join(', ') || site.url || '')}. Checked ${esc(checked)}. Things change; tell me if anything here is out of date.${credit}</footer>
</main>`;
  return htmlDoc({ title: `Missed-call plan for ${biz}`, css: css(p), body, description: `What happens when ${biz} misses a call, written from their website.` });
}

// The member's offer sheet: what's included, prices, founding terms, promises.
function offerHtml({ offer, member = {}, checked }) {
  const p = colorsFor(member.business || member.name || 'front desk', member.color);
  const pkgRows = offer.menu.map((m) => `<div class="box"><h3>${esc(m.label)}</h3><p class="price">${esc(m.priceText)}</p>${li(m.includes || [])}</div>`).join('');
  const body = `<main>
<header><p class="kicker">${esc(member.business || 'Front desk setup')}</p><h1>${esc(offer.name)}</h1><p class="sub">${esc(offer.promise)}</p></header>
<h2>Who it's for</h2><p>${esc(offer.who)}</p>
<h2>What you get</h2><div class="grid">${pkgRows}</div>
<h2>Founding clients</h2><div class="box"><p><span class="pill">${esc(offer.ladder.badge)}</span></p><p>${esc(offer.ladder.terms)}</p><p class="sub">${esc(offer.ladder.stepUp)}</p></div>
<h2>My promises</h2>${li(offer.promises)}
<h2>What you pay for tools</h2><p>${esc(offer.toolsLine)}</p>
<h2>How we start</h2><ol>${offer.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<footer>${esc(member.name || '[your name]')}${member.contact ? ` | ${esc(member.contact)}` : ''}. Prices checked ${esc(checked)}.</footer>
</main>`;
  return htmlDoc({ title: `${offer.name} offer sheet`, css: css(p), body, description: offer.promise });
}

// The setup sheet for a signed client.
function setupHtml({ client, stack, steps, texts, faq, tests, costs, member = {}, checked, recording, forwarding }) {
  const p = colorsFor(client.name || 'client', client.color);
  const body = `<main>
<header><p class="kicker">Front desk setup sheet</p><h1>${esc(client.name)}: never miss a call</h1><p class="sub">Prepared ${esc(checked)} by ${esc(member.name || '[your name]')}. Every account is in ${esc(client.name)}'s name. Prices from each vendor's page on ${esc(checked)}; recheck before you buy.</p></header>
<h2>The setup</h2>
<table><thead><tr><th>Piece</th><th>Tool</th><th>Price (paid by ${esc(client.name)})</th></tr></thead><tbody>
${stack.map((s) => `<tr><td>${esc(s.role)}</td><td>${esc(s.name)}<div class="src"><a href="${esc(s.url)}">${esc(s.url)}</a></div></td><td>${esc(s.price)}${s.extra ? `<div class="sub">${esc(s.extra)}</div>` : ''}</td></tr>`).join('\n')}
</tbody></table>
<p class="sub">${esc(costs)}</p>
<h2>Step by step</h2><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<h2>Call forwarding (${esc(forwarding.label)})</h2><p>Turn on: <strong>${esc(forwarding.on)}</strong>. Turn off: <strong>${esc(forwarding.off)}</strong>. Test with a call right after.</p>
${recording ? `<h2>Recording notice</h2><p>${esc(recording)}</p>` : ''}
<h2>Texts to paste</h2>${texts.map((t) => `<div class="box" style="margin:8px 0"><div class="label">${esc(t.label)}</div><div class="text">${esc(t.text)}</div></div>`).join('')}
<h2>Answers to load</h2>${faq.map((f) => `<p><strong>${esc(f.q)}</strong> ${esc(f.a)}</p>`).join('')}
<h2>Test before go-live</h2>${li(tests)}
<footer>Logins stay with ${esc(client.name)}. ${esc(member.name || '[your name]')} is added as a user and can be removed any time.</footer>
</main>`;
  return htmlDoc({ title: `Setup sheet for ${client.name}`, css: css(p), body, description: `Front desk setup for ${client.name}.` });
}

// One-page monthly report from the numbers the member typed in.
function reportHtml({ client, month, metrics, wins, fixes, next, member = {}, checked }) {
  const p = colorsFor(client.name || 'client', client.color);
  const body = `<main>
<header><p class="kicker">Front desk report, ${esc(month)}</p><h1>${esc(client.name)}</h1><p class="sub">Numbers from your phone and booking tools, entered by ${esc(member.name || '[your name]')} on ${esc(checked)}.</p></header>
<div class="grid">${metrics.map((m) => `<div class="box"><div class="label">${esc(m.label)}</div><div class="big">${esc(m.value)}</div>${m.note ? `<div class="sub">${esc(m.note)}</div>` : ''}</div>`).join('')}</div>
${wins.length ? `<h2>What went right</h2>${li(wins)}` : ''}
${fixes.length ? `<h2>What I fixed this month</h2>${li(fixes)}` : ''}
<h2>Next month</h2>${li(next)}
<footer>Questions? ${esc(member.name || '[your name]')}${member.contact ? ` | ${esc(member.contact)}` : ''}.</footer>
</main>`;
  return htmlDoc({ title: `${client.name} front desk report ${month}`, css: css(p), body, description: `Front desk report for ${client.name}, ${month}.` });
}

// The client's care plan: what the member does every week and month, the report, the fix promise,
// what the member needs from them, the next 90 days and one add-on for later.
function carePlanHtml({ client, plan, weekly, monthly, needs, promises, dates, addon, member = {}, start, checked }) {
  const p = colorsFor(client.name || 'client', client.color);
  const body = `<main>
<header><p class="kicker">Front desk care plan</p><h1>${esc(client.name)}: your front desk, looked after</h1>
<p class="sub">From ${esc(member.name || '[your name]')}${member.business ? `, ${esc(member.business)}` : ''}. Starts ${esc(start)}. Every account stays in ${esc(client.name)}'s name.</p></header>
<div class="grid">
<div class="box"><div class="label">Your plan</div><div class="price">${esc(plan.label)}</div><p>${esc(plan.priceText)}</p>${plan.note ? `<p class="sub">${esc(plan.note)}</p>` : ''}</div>
<div class="box"><div class="label">Your monthly report</div><div class="price">${esc((dates.find((d) => d.report) || {}).label || 'Monthly')}</div><p class="sub">Then the first weekday of every month: calls missed, texts sent, replies and jobs booked, from your own tools.</p></div>
</div>
<h2>Every week</h2>${li(weekly)}
<h2>Every month</h2>${li(monthly)}
<h2>My promises</h2>${li(promises)}
<h2>What I need from you</h2>${li(needs)}
<h2>The next 90 days</h2>
<table><thead><tr><th>When</th><th>What happens</th></tr></thead><tbody>
${dates.map((d) => `<tr><td>${esc(d.label)}</td><td>${esc(d.what)}</td></tr>`).join('\n')}
</tbody></table>
${addon ? `<h2>When you're ready</h2><div class="box"><h3>${esc(addon.label)}</h3><p>${esc(addon.pitch)}</p><p class="price">${esc(addon.priceText)}</p></div>` : ''}
<footer>${esc(member.name || '[your name]')}${member.contact ? ` | ${esc(member.contact)}` : ''}. Plan made ${esc(checked)}. Cancel any month: I hand back every login and turn off call forwarding with you.</footer>
</main>`;
  return htmlDoc({ title: `Care plan for ${client.name}`, css: css(p), body, description: `How ${member.name || 'your front desk partner'} looks after ${client.name}'s front desk every week and month.` });
}

module.exports = { auditHtml, offerHtml, setupHtml, reportHtml, carePlanHtml, colorsFor };
