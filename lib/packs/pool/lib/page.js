// The printable visit log: one Letter page for the owner's file, in the member's colors, no scripts.
// The readings against CDC's ranges, what was done and added, the last visits, CDC's twice-a-day
// testing line and the chemical safety lines, with the sources. It never says what or how much to add.

const { files, qr } = require('../../_kit');
const pages = require('../../_kit/home/pages');
const print = require('../../_kit/home/print');
const visit = require('./visit');

const esc = files.esc;
const C = visit.C;

// Phone width: 16px sides, tables scroll inside their box instead of the page.
const PHONE = `.wrap{overflow-x:auto}.flag td{background:#fdecea}.flag td.st{color:#a12a1f;font-weight:700}
.ok td.st{color:#1f6b3a;font-weight:600}.say{font-size:12pt}
@media screen and (max-width:600px){body{padding:0 16px;margin:16px auto;font-size:10.5pt}h1{font-size:17pt}.top{display:block}
.foot{display:block}.foot .qr{margin-top:.1in;width:max-content}td,th{padding:4px;font-size:9.5pt}}`;

const para = (s, cls) => (s ? `<p${cls ? ` class="${cls}"` : ''}>${esc(s)}</p>` : '');
const list = (items) => (items && items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const shown = (n) => (Number.isFinite(n) ? visit.show(n) : '');

function readingsTable(rows) {
  if (!rows.length) return para('No readings typed for this visit.', 'muted');
  const body = rows
    .map((r) => `<tr class="${r.flag ? 'flag' : r.status === 'In CDC range' ? 'ok' : ''}"><td>${esc(r.reading)}</td><td>${esc(r.value)}</td><td>${esc(r.range)}</td><td class="st">${esc(r.status)}</td></tr>`)
    .join('');
  return `<div class="wrap"><table><thead><tr><th>Reading</th><th>Today</th><th>CDC range</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function historyTable(history) {
  if (!history || history.length < 2) return '';
  const body = history
    .map((h) => `<tr><td>${esc(h.date)}</td><td>${esc(h.fc == null ? '' : `${shown(h.fc)} ppm`)}</td><td>${esc(shown(h.ph))}</td><td>${h.flags ? esc(String(h.flags)) : 'None'}</td></tr>`)
    .join('');
  return `<h2>Last visits</h2><div class="wrap"><table><thead><tr><th>Date</th><th>Free chlorine</th><th>pH</th><th>Outside a CDC range</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function foot(o) {
  const target = print.qrTarget({ link: o.link, phone: o.phone });
  const code = target ? `<div class="qr">${qr.qrSvg(target, { size: '0.9in', margin: 2 })}<p>${o.link && /^https?:/i.test(o.link) ? 'Scan to book' : 'Scan to text me'}</p></div>` : '';
  const lines = [`<p><strong>${esc(o.business)}</strong>${o.first ? `, ${esc(o.first)}` : ''}</p>`, o.phone ? `<p>Call or text ${esc(o.phone)}</p>` : '', o.link ? `<p>${esc(String(o.link).replace(/^https?:\/\//, ''))}</p>` : ''];
  return `<div class="foot"><div>${lines.join('')}</div>${code}</div>`;
}

// o: { customer, business, first, phone, link, dateText, check, done, added, notes, next, history }
function visitLog(cfg, o, pal) {
  const c = o.check;
  const thing = c.kind === 'spa' ? 'hot tub' : 'pool';
  const summary = c.flags.length
    ? `Outside the CDC range today: ${c.flags.map((f) => f.short).join('; ')}.`
    : c.inRange
      ? `${c.readings.fc != null && c.readings.ph != null ? 'Free chlorine and pH were' : c.readings.fc != null ? 'Free chlorine was' : 'pH was'} inside the CDC ranges when tested.`
      : 'Readings logged as typed.';
  const ranges = C.sources.find((s) => s.id === 'ranges');
  const body = `<div class="top"><div><p class="eyebrow">${esc(thing === 'pool' ? 'Pool visit log' : 'Hot tub visit log')}</p><h1>${esc(o.customer)}</h1>${para(`${o.dateText}. ${o.business}${o.first ? `, ${o.first}` : ''}.`, 'sub')}</div></div>
<div class="box"><p class="say"><strong>${esc(summary)}</strong></p></div>
<h2>Readings</h2>
${readingsTable(c.rows)}
${c.flags.length ? `<h2>What CDC says about today's readings</h2>${list(c.flags.map((f) => f.text))}${para("What to add and how much comes from each product's label. This log never works that out.", 'small')}` : ''}
${c.notes.length ? `<h2>Notes on the readings</h2>${list(c.notes)}` : ''}
<h2>Done today</h2>
${list(o.done)}
${o.added ? `<p><strong>Added:</strong> ${esc(o.added)}</p>` : ''}
${o.notes ? `<p><strong>Notes:</strong> ${esc(o.notes)}</p>` : ''}
${o.next ? `<p><strong>Next visit:</strong> ${esc(o.next)}</p>` : ''}
${historyTable(o.history)}
<h2>Between visits</h2>
<div class="box">${para(C.between_visits)}</div>
<h2>Chemical safety</h2>
${list(C.safety)}
<p class="small muted">Ranges from ${esc(ranges.publisher)}, "${esc(ranges.title)}" (${esc(ranges.url)}), checked ${esc(C.checked)}. Safety lines from CDC's pool chemical safety pages and the EPA chemical safety alert on pool chemicals. Pools at apartments, condos, HOAs and hotels can fall under state and county health rules: check your city and state.</p>
${foot(o)}`;
  return files.htmlDoc({ title: `${o.business}: ${thing} visit log for ${o.customer}, ${o.dateText}`, css: pages.css(pal) + PHONE, body });
}

// The same visit as CSV rows: one row a reading, then what was done and added.
function visitCsv(o) {
  const rows = o.check.rows.map((r) => ({ date: o.date, customer: o.customer, item: r.reading, value: r.value, range: r.range, status: r.status }));
  rows.push({ date: o.date, customer: o.customer, item: 'Done', value: o.done.join('; '), range: '', status: '' });
  if (o.added) rows.push({ date: o.date, customer: o.customer, item: 'Added', value: o.added, range: '', status: '' });
  return files.csv(rows, [
    { key: 'date', label: 'Date' },
    { key: 'customer', label: 'Pool' },
    { key: 'item', label: 'Reading' },
    { key: 'value', label: 'Value' },
    { key: 'range', label: 'CDC range' },
    { key: 'status', label: 'Status' },
  ]);
}

module.exports = { visitLog, visitCsv, PHONE };
