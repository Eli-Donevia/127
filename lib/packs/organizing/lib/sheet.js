// The printable room plan the organizer brings and the client can keep: time per zone, the next visit,
// typical times with their sources, the supply list with the listings behind each price, the donation
// and recycling checklist and the photo plan with a shot list. Plain HTML and CSS, no scripts, laid
// out for a phone and for paper.

const { files, money, text } = require('../../_kit');

const esc = files.esc;
const { usd } = money;

const css = (accent) => `body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#f6f7f9}
main{max-width:760px;margin:24px auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:26px 0 8px;color:${accent}}h3{font-size:15px;margin:18px 0 6px}
p{line-height:1.5}.muted{color:#5b6475;font-size:14px}a{color:${accent};word-break:break-word}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}
td,th{border-bottom:1px solid #e3e6eb;padding:7px 6px;text-align:left;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#5b6475}.num{text-align:right;white-space:nowrap}
.box{background:#eef6f5;border-radius:10px;padding:12px 14px;margin:10px 0}.warn{background:#fff8e6}
ul{padding-left:20px;line-height:1.55}ul.check{list-style:none;padding-left:0;margin:6px 0}
ul.check li{position:relative;padding:7px 0 7px 32px;border-bottom:1px solid #eef0f3}
ul.check li:before,.tick{content:"";display:inline-block;width:14px;height:14px;border:2px solid #5b6475;border-radius:4px}
ul.check li:before{position:absolute;left:4px;top:9px}ul.src{font-size:13px}
footer{margin-top:26px;font-size:12px;color:#5b6475;line-height:1.5}
@media (max-width:600px){main{margin:0;border-radius:0;padding:18px 16px;box-shadow:none}h1{font-size:22px}table{font-size:13px}td,th{padding:6px 4px}}
@media print{body{background:#fff}main{box-shadow:none;margin:0;max-width:none;padding:0}h2{break-after:avoid}tr,li{break-inside:avoid}}
@page{size:letter;margin:14mm}`;

const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');
const range = (lo, hi) => (lo === hi ? usd(lo) : `${usd(lo)} to ${usd(hi)}`);
const hoursText = (h) => String(Math.round(Number(h) * 100) / 100);
const link = (s, label) => `<a href="${esc(s.url)}">${esc(label)}</a>`;

function sheetHtml(o) {
  const t = o.time;
  const zoneRows = [
    [t.walk.time, t.walk.name, t.walk.minutes, 'Ask about photos first'],
    ...t.zones.map((z) => [z.time, z.name, z.clock, z.focus.length ? z.focus.join('; ') : 'Room basics']),
    [t.wrap.time, t.wrap.name, t.wrap.minutes, 'Donations go where you chose'],
  ]
    .map(([clock, name, min, words]) => `<tr><td class="num">${esc(clock)}</td><td>${esc(name)}</td><td class="num">${esc(min)}</td><td>${esc(words)}</td></tr>`)
    .join('');
  const team = t.people > 1 ? `<p class="muted">${t.people} organizers work together, so each zone gets about ${t.people} organizer minutes for every minute on the clock.</p>` : '';
  const later = t.later.length
    ? `<div class="box warn"><strong>Next visit</strong> (about ${esc(hoursText(t.later_hours))} more ${t.later_hours === 1 ? 'hour' : 'hours'} on the clock): ${esc(t.later.map((z) => (z.from_list ? `${z.name} (on your list)` : z.name)).join('; '))}.</div>`
    : '';
  const unmatched = t.unmatched.length ? `<p><strong>Also on your list:</strong> ${esc(t.unmatched.join('; '))}. We'll find these a home on the walk-through.</p>` : '';
  const typical = o.typical.map((x) => `<li>${esc(x.says)} ${link(x, 'Source')}</li>`).join('');
  const S = o.supplies;
  const supplyRows = S.items
    .map((it) => `<tr><td>${esc(it.item)}${it.unit !== 'each' ? ` <span class="muted">(${esc(it.unit)})</span>` : ''}</td><td class="num">${esc(it.qty)}</td><td>${esc(range(it.each_low, it.each_high))}</td><td>${esc(range(it.low, it.high))}</td></tr>`)
    .join('');
  const listings = S.items.reduce((n, it) => n + it.listings, 0);
  const where = [...new Set(S.items.flatMap((it) => it.where))];
  const unpriced = S.unpriced.length ? `<p>Also: ${esc(S.unpriced.join(', '))} (check current rates).</p>` : '';
  const kit = [
    ...S.kit.map((k) => `<li>${esc(k.item)}: ${esc(range(k.each_low, k.each_high))}${k.unit !== 'each' ? ` per ${esc(k.unit)}` : ''}</li>`),
    `<li>${esc(S.kit_unpriced.map((x, i) => (i ? lowerFirst(x) : x)).join(', '))}: check current rates</li>`,
  ].join('');
  const donation = o.donation.map((d) => `<li><strong>${esc(d.title)}.</strong> ${esc(d.line)}</li>`).join('');
  const P = o.photo_plan;
  const shots = P.shots.map((s) => `<tr><td>${esc(s)}</td><td><span class="tick"></span></td><td><span class="tick"></span></td></tr>`).join('');
  const priced = S.items
    .map((it) => `<li>${esc(it.item)}: low ${link(it.cheapest, `${it.cheapest.says}, ${it.cheapest.publisher}, ${usd(it.cheapest.price)}`)}; high ${link(it.priciest, `${it.priciest.says}, ${it.priciest.publisher}, ${usd(it.priciest.price)}`)}</li>`)
    .join('');
  const roomFrom = [...new Set(o.typical.map((x) => x.publisher))];
  const ruleFrom = [...new Set(o.donation.flatMap((d) => d.sources.map((s) => s.publisher)))];
  const facts = [o.client ? `For ${o.client}.` : '', o.when ? `Visit: ${o.when}.` : '', `${hoursText(t.hours)} ${t.hours === 1 ? 'hour' : 'hours'} booked${t.people > 1 ? ` with ${t.people} organizers` : ''}.`, `Made ${o.date}.`].filter(Boolean).join(' ');
  const body = `<main>
<p class="muted">${esc(o.business)}</p>
<h1>Room plan: ${esc(o.room)}</h1>
<p class="muted">${esc(facts)}</p>
<div class="box"><strong>Sort piles:</strong> ${esc(o.sort.join(', '))}. Nothing leaves without your yes.</div>
<h2>Time per zone</h2>
<div class="wrap"><table><thead><tr><th>Clock</th><th>Zone</th><th class="num">Minutes</th><th>In your words</th></tr></thead><tbody>${zoneRows}</tbody></table></div>
${team}${later}${unmatched}
<h2>Typical time for this room</h2>
<ul>${typical}</ul>
<p class="muted">A check, not a promise: sorting takes as long as the decisions do.</p>
<h2>Supply list</h2>
<p>Bought after the sort and the measuring, and only what fits. Billed at cost, with receipts.</p>
<div class="wrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th>Each</th><th>Total</th></tr></thead><tbody>${supplyRows}</tbody></table></div>
<p class="box"><strong>Estimate: ${esc(range(S.low, S.high))} before tax.</strong> From ${esc(listings)} listings at ${esc(text.list(where))}, checked ${esc(S.checked)}. Prices change, so check them before you buy.</p>
${unpriced}
<h3>The organizer's own kit (not billed)</h3>
<ul>${kit}</ul>
<h2>Donation and recycling checklist</h2>
<ul class="check">${donation}</ul>
<h2>Before-and-after photo plan</h2>
<div class="box">${esc(P.permission)}</div>
<ul class="check">${P.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<div class="wrap"><table><thead><tr><th>Shot</th><th>Before</th><th>After</th></tr></thead><tbody>${shots}</tbody></table></div>
<h2>Where the prices come from</h2>
<ul class="src">${priced}</ul>
<footer>Room times from ${esc(text.list(roomFrom))}. Disposal and donation rules from ${esc(text.list(ruleFrom) || 'local rules')}. Recycling rules vary: check your city. Sources checked ${esc(S.checked)}. Zone minutes and supply counts are a plan to adjust on the walk-through.</footer>
</main>`;
  return files.htmlDoc({ title: `Room plan: ${o.room}${o.client ? ` for ${o.client}` : ''}`, css: css(/^#[0-9a-f]{6}$/i.test(String(o.color || '')) ? o.color : '#0f766e'), body, description: `Room plan and supply list for the ${o.room.toLowerCase()}` });
}

module.exports = { sheetHtml };
