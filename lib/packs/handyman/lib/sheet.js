// The printable punch list estimate for the customer: one Letter page in the member's colors, no
// scripts. The jobs in the order they'll be done with the time and price of each, the total, the
// hours and visits, what goes to a licensed pro and is not in the price, what gets priced on site,
// how parts and extra work are handled, and the member's promise and contact with a QR code.
// The member's hourly rate, the guides' typical prices and the state rules stay in the member's view.

const { files, qr } = require('../../_kit');
const pages = require('../../_kit/home/pages');
const print = require('../../_kit/home/print');

const esc = files.esc;
const usd = print.usd;

// Phone width: 16px sides, tables scroll inside their box instead of the page.
const EXTRA = (pal) => `.wrap{overflow-x:auto}.num{text-align:right;white-space:nowrap}.total td{font-weight:800;border-top:2px solid ${pal.ink}}
.step td{background:${pal.surface};font-weight:700;font-size:9.5pt}
.big{font-size:15pt;font-weight:800;margin:.04in 0}
@media screen and (max-width:600px){body{padding:0 16px;margin:16px auto;font-size:10.5pt}h1{font-size:17pt}.top{display:block}
.foot{display:block}.foot .qr{margin-top:.1in;width:max-content}td,th{padding:4px;font-size:9.5pt}.big{font-size:13pt}}`;

const para = (s, cls) => (s ? `<p${cls ? ` class="${cls}"` : ''}>${esc(s)}</p>` : '');
const list = (items) => (items && items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');

function foot(o) {
  const target = print.qrTarget({ link: o.link, phone: o.phone });
  const code = target ? `<div class="qr">${qr.qrSvg(target, { size: '0.9in', margin: 2 })}<p>${o.link && /^https?:/i.test(o.link) ? 'Scan to book' : 'Scan to text me'}</p></div>` : '';
  const lines = [`<p><strong>${esc(o.business)}</strong>${o.first ? `, ${esc(o.first)}` : ''}</p>`, o.phone ? `<p>Call or text ${esc(o.phone)}</p>` : '', o.link ? `<p>${esc(String(o.link).replace(/^https?:\/\//, ''))}</p>` : '', o.area && o.area !== 'town' ? `<p class="muted">${esc(o.area)}</p>` : ''];
  return `<div class="foot"><div>${lines.join('')}</div>${code}</div>`;
}

// o: { customer, business, first, phone, link, area, dateText, groups: [{ label, rows: [{ label, detail, time, price }] }],
//      extra: [{ label, detail, price }], subtotal, hoursText, visitsText, refer, unknown, parts, scope, promise }
function punchSheet(cfg, o, pal) {
  const rows = o.groups
    .map((g) => `<tr class="step"><td colspan="3">${esc(g.label)}</td></tr>${g.rows.map((r) => `<tr><td>${esc(r.label)}${r.detail ? `<br><span class="small muted">${esc(r.detail)}</span>` : ''}</td><td class="num">${esc(r.time)}</td><td class="num">${r.price == null ? 'Included' : esc(usd(r.price))}</td></tr>`).join('')}`)
    .join('');
  const extra = (o.extra || []).map((r) => `<tr><td>${esc(r.label)}${r.detail ? `<br><span class="small muted">${esc(r.detail)}</span>` : ''}</td><td class="num"></td><td class="num">${esc(usd(r.price))}</td></tr>`).join('');
  const table = `<div class="wrap"><table><thead><tr><th>Job</th><th class="num">Time</th><th class="num">Price</th></tr></thead><tbody>${rows}${extra}<tr class="total"><td colspan="2">Estimated total, parts extra</td><td class="num">${esc(usd(o.subtotal))}</td></tr></tbody></table></div>`;
  const body = `<div class="top"><div><p class="eyebrow">Punch list estimate</p><h1>${esc(o.customer)}</h1>${para(`${o.dateText}. From ${o.first ? `${o.first} at ` : ''}${o.business}, ${cfg.niche.what}.`, 'sub')}</div></div>
<div class="box"><p class="big">${esc(o.hoursText)}: ${esc(usd(o.subtotal))}</p><p class="small">${esc(o.visitsText)} An estimate from your list: I confirm each job and the price when I see it, before I start.</p></div>
<h2>The jobs, in the order I'll do them</h2>
${table}
${o.refer.length ? `<h2>Not in this estimate: for a licensed pro</h2>${list(o.refer)}` : ''}
${o.unknown.length ? `<h2>I'll price these when I see them</h2>${list(o.unknown)}` : ''}
<h2>Parts and changes</h2>
${para(o.parts)}
${para(o.scope)}
${o.promise ? `<p><strong>My promise:</strong> ${esc(o.promise)}</p>` : ''}
${foot(o)}`;
  return files.htmlDoc({ title: `${o.business}: punch list estimate for ${o.customer}`, css: pages.css(pal) + EXTRA(pal), body });
}

module.exports = { punchSheet };
