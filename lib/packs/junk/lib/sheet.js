// The printable load estimate for the customer: one Letter page in the member's colors, no scripts.
// The share of the truck as a bar of eighths, what was counted, the price lines and total, what stays
// out of the truck, what to do before the visit and the promise. The dump fee is the member's own
// number and never shows here.

const { files, qr } = require('../../_kit');
const pages = require('../../_kit/home/pages');
const print = require('../../_kit/home/print');

const esc = files.esc;
const usd = print.usd;

// Phone width: 16px sides, tables scroll inside their box instead of the page.
const EXTRA = (pal) => `.wrap{overflow-x:auto}.num{text-align:right;white-space:nowrap}.total td{font-weight:800;border-top:2px solid ${pal.ink}}
.truck{margin:.08in 0}.truck p{margin:.02in 0;font-size:9pt;color:${pal.muted}}
.bar{display:flex;gap:4px}.bar span{flex:1;height:.24in;border:1.5px solid ${pal.primary};border-radius:3px;background:#fff}.bar span.on{background:${pal.primary}}
.big{font-size:15pt;font-weight:800;margin:.04in 0}
@media screen and (max-width:600px){body{padding:0 16px;margin:16px auto;font-size:10.5pt}h1{font-size:17pt}.top{display:block}
.foot{display:block}.foot .qr{margin-top:.1in;width:max-content}td,th{padding:4px;font-size:9.5pt}.big{font-size:13pt}}`;

const para = (s, cls) => (s ? `<p${cls ? ` class="${cls}"` : ''}>${esc(s)}</p>` : '');
const list = (items) => (items && items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const num = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

// One bar of eighths for each truck the load fills.
function bars(eighths) {
  if (!eighths) return '';
  const trucks = Math.ceil(eighths / 8);
  const out = [];
  for (let t = 0; t < trucks; t += 1) {
    const on = Math.min(8, eighths - t * 8);
    const cells = Array.from({ length: 8 }, (_, i) => `<span class="${i < on ? 'on' : ''}"></span>`).join('');
    out.push(`<div class="truck"><div class="bar" aria-label="${on} of 8 eighths">${cells}</div><p>${trucks > 1 ? `Truck ${t + 1}: ` : ''}${on === 8 ? 'full' : `${on}/8`}</p></div>`);
  }
  return out.join('');
}

function foot(o) {
  const target = print.qrTarget({ link: o.link, phone: o.phone });
  const code = target ? `<div class="qr">${qr.qrSvg(target, { size: '0.9in', margin: 2 })}<p>${o.link && /^https?:/i.test(o.link) ? 'Scan to book' : 'Scan to text me'}</p></div>` : '';
  const lines = [`<p><strong>${esc(o.business)}</strong>${o.first ? `, ${esc(o.first)}` : ''}</p>`, o.phone ? `<p>Call or text ${esc(o.phone)}</p>` : '', o.link ? `<p>${esc(String(o.link).replace(/^https?:\/\//, ''))}</p>` : '', o.area && o.area !== 'town' ? `<p class="muted">${esc(o.area)}</p>` : ''];
  return `<div class="foot"><div>${lines.join('')}</div>${code}</div>`;
}

// o: { customer, business, first, phone, link, area, dateText, load, counted, items, subtotal,
//      keepOut, before, onsite, unsure, promise }
function loadSheet(cfg, o, pal) {
  const counted = o.counted.length
    ? `<div class="wrap"><table><thead><tr><th>Item</th><th class="num">How many</th><th class="num">Cubic feet</th></tr></thead><tbody>${o.counted
        .map((c) => `<tr><td>${esc(c.label)}</td><td class="num">${esc(c.qty)}</td><td class="num">${esc(num(c.cubicFeet))}</td></tr>`)
        .join('')}</tbody></table></div>`
    : '';
  const priced = `<div class="wrap"><table><thead><tr><th>Line</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>${o.items
    .map((it) => `<tr><td>${esc(it.label)}${it.detail ? `<br><span class="small muted">${esc(it.detail)}</span>` : ''}</td><td class="num">${esc(num(it.qty))}</td><td class="num">${esc(usd(it.price))}</td><td class="num">${esc(usd(Math.round(it.price * it.qty * 100) / 100))}</td></tr>`)
    .join('')}<tr class="total"><td colspan="3">Estimated total</td><td class="num">${esc(usd(o.subtotal))}</td></tr></tbody></table></div>`;
  const sizeLine = o.load.eighths ? `About ${o.load.fraction} (${num(o.load.cubicYards)} cubic yards)` : 'Priced as its own job';
  const body = `<div class="top"><div><p class="eyebrow">Load estimate</p><h1>${esc(o.customer)}</h1>${para(`${o.dateText}. From ${o.first ? `${o.first} at ` : ''}${o.business}, ${cfg.niche.what}.`, 'sub')}</div></div>
<div class="box"><p class="big">${esc(sizeLine)}: ${esc(usd(o.subtotal))}</p>${bars(o.load.eighths)}<p class="small">Each box is 1/8 of my truck. An estimate from your list: I confirm the price when I see everything, before I load anything.</p></div>
${counted ? `<h2>What I counted</h2>${counted}` : ''}
<h2>Price</h2>
${priced}
${o.onsite.length || o.unsure.length ? `<h2>I'll look at these on site</h2>${list([...o.onsite, ...o.unsure])}` : ''}
${o.keepOut.length ? `<h2>Stays out of the truck</h2>${list(o.keepOut)}` : ''}
${o.before.length ? `<h2>Before I come</h2>${list(o.before)}` : ''}
${o.promise ? `<p><strong>My promise:</strong> ${esc(o.promise)}</p>` : ''}
${foot(o)}`;
  return files.htmlDoc({ title: `${o.business}: load estimate for ${o.customer}`, css: pages.css(pal) + EXTRA(pal), body });
}

module.exports = { loadSheet, bars };
