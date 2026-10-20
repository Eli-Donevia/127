// The printable move-day plan: one page for the crew (and a copy for the customer), in the member's
// colors, no scripts. The crew, the hours and the price from lib/crew.js, the day step by step, who
// does what, the heavy pieces, what movers can't carry and what the customer keeps, how to protect
// the home, load the truck and lift safely, the labor-only rule, a sign-off list and the sources.

const { files, qr } = require('../../_kit');
const pages = require('../../_kit/home/pages');
const print = require('../../_kit/home/print');
const crew = require('./crew');

const esc = files.esc;
const C = crew.C;

// Phone width: 16px sides, one column, tables scroll inside their box instead of the page.
const PHONE = `.wrap{overflow-x:auto}.hit{font-weight:700}.step td:first-child{white-space:nowrap}
.lab{border-left:4px solid currentColor}.blank{display:inline-block;width:1.1in;border-bottom:1.5px solid currentColor;margin:0 .08in}
@media screen and (max-width:600px){body{padding:0 16px;margin:16px auto;font-size:10.5pt}h1{font-size:17pt}.top{display:block}
.grid{grid-template-columns:1fr}.foot{display:block}.foot .qr{margin-top:.1in}td,th{padding:4px;font-size:9.5pt}}`;

const para = (s, cls) => (s ? `<p${cls ? ` class="${cls}"` : ''}>${esc(s)}</p>` : '');
const list = (items, cls) => (items && items.length ? `<ul${cls ? ` class="${cls}"` : ''}>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const fact = (k, v) => (v ? `<p><span class="k">${esc(k)}</span>${esc(v)}</p>` : '');

function foot(o) {
  const target = print.qrTarget({ link: o.link, phone: o.phone });
  const code = target ? `<div class="qr">${qr.qrSvg(target, { size: '0.9in', margin: 2 })}<p>${o.link && /^https?:/i.test(o.link) ? 'Scan to book' : 'Scan to text me'}</p></div>` : '';
  const lines = [`<p><strong>${esc(o.business)}</strong>${o.first ? `, ${esc(o.first)}` : ''}</p>`, o.phone ? `<p>Call or text ${esc(o.phone)}</p>` : '', o.link ? `<p>${esc(String(o.link).replace(/^https?:\/\//, ''))}</p>` : ''];
  return `<div class="foot"><div>${lines.join('')}</div>${code}</div>`;
}

// The day in order, with the hours for each end. e: an estimate from crew.estimate().
function steps(e) {
  const at = (end) => (e.phases.find((p) => p.end === end) || {}).hours;
  const out = [{ step: 'Before you lift anything', do: ['Walk through with the customer: what goes, what stays, what is fragile.', 'Photos of floors, door frames and anything already scratched or dented.', 'Protect the path: runners on floors, jamb protectors, pads on banisters.'] }];
  if (e.ends.includes('load')) {
    out.push({ step: 'Load the truck', hours: at('load'), do: ['Pad and wrap furniture; take beds and tables apart and bag the hardware.', 'Heaviest and strongest pieces first, in tiers, strapped every 4 feet or so.', 'Light boxes over the cab.'] });
    out.push({ step: 'Before the truck leaves', do: ['Walk every room and closet with the customer.', 'The customer drives the truck. You follow in your own car.'] });
  }
  if (e.ends.includes('unload')) {
    out.push({ step: 'Unload', hours: at('unload'), do: ['Protect the path at the new place first.', 'Room by room, where the customer wants each piece.', 'Beds and tables back together, hardware used up.'] });
  }
  out.push({ step: 'Finish', do: ['Final walk-through with the customer, photos of floors and door frames.', 'Write down the finish time, then send the invoice the same day.'] });
  return out;
}

// o: { customer, business, first, phone, link, date, start, from, to, truck, notes, est (crew.estimate), menu }
function movePlan(cfg, o, pal) {
  const e = o.est;
  const usd = crew.money;
  const hoursText = `About ${crew.hrs(e.hours.est)} hours${crew.span(e.hours.low, e.hours.high)}`;
  const priceText = e.rate ? `${usd(e.price.est)}${e.price.low !== e.price.high ? ` (${usd(e.price.low)} to ${usd(e.price.high)})` : ''}` : '';
  const flights = e.ends.map((end) => `${e.flights[end]} at the ${end === 'load' ? 'pickup' : 'drop-off'}`).join(', ');
  const carry = e.ends.filter((end) => e.carry[end]).map((end) => `${e.carry[end]} feet at the ${end === 'load' ? 'pickup' : 'drop-off'}`).join(', ');
  const roles = C.roles.slice(0, Math.min(e.crew, C.roles.length));
  const day = steps(e);
  const found = new Set(e.hazards.map((h) => h.group));
  const heavyLines = [
    ...e.heavy.map((h) => `${h.qty > 1 ? `${h.qty} x ` : ''}${h.label}: at least ${C.heavy_min_crew} movers and the appliance dolly; ask the weight and walk the path before you lift.`),
    ...e.specialist.map((s) => `${s.label}: ${s.say}`),
    ...e.appliances.map((a) => `${a.label}: ${a.say}`),
  ];
  const body = `<div class="top"><div><p class="eyebrow">Move-day plan</p><h1>${esc(o.customer || 'Your move')}</h1>${para([o.date, o.start ? `start ${o.start}` : '', o.business].filter(Boolean).join(', '), 'sub')}</div></div>
<div class="grid">
${fact('Home', e.home.label)}${fact('Job', e.job.label)}${fact('Crew', `${e.crew} movers${e.crew !== e.chartCrew ? ` (the chart uses ${e.chartCrew})` : ''}`)}${fact('Hours on the clock', hoursText)}
${fact('Rate', e.rate ? `${usd(e.rate)} per mover per hour, billed by the actual time, ${C.min_hours} hour minimum` : '')}${fact('Estimate', priceText)}
${fact('From', o.from)}${fact('To', e.ends.includes('unload') ? o.to : '')}${fact('Truck or container', o.truck)}${fact('Stairs (flights)', flights)}${fact('Long carry', carry)}
</div>
<div class="box lab"><p><strong>Labor only.</strong> ${esc(C.labor_only[0].replace(/^Labor only: (\w)/, (m, c) => c.toUpperCase()))}</p></div>
${o.notes ? `<p><strong>Notes:</strong> ${esc(o.notes)}</p>` : ''}
${e.warnings.length ? `<div class="box">${e.warnings.map((w) => para(w)).join('')}</div>` : ''}
<h2>The day, step by step</h2>
<div class="wrap"><table><tbody>${day.map((s) => `<tr class="step"><td><strong>${esc(s.step)}</strong>${s.hours ? `<br><span class="muted">about ${esc(crew.hrs(s.hours))} hours</span>` : ''}</td><td>${list(s.do)}</td></tr>`).join('')}</tbody></table></div>
${para(e.ends.length > 1 ? 'The hours count loading and unloading. The drive between is not in them: agree before the day whether you bill it (a judgment call).' : '', 'small muted')}
<h2>Who does what</h2>
${list(roles)}
${heavyLines.length ? `<h2>Heavy and special pieces</h2>${list(heavyLines)}` : ''}
<h2>Movers can't carry these</h2>
${e.hazards.length ? para(`On the customer's list: ${e.hazards.map((h) => h.found).join(', ')}. They set these aside before you arrive.`, 'hit') : ''}
<div class="wrap"><table><tbody>${C.no_carry.map((g) => `<tr${found.has(g.group) ? ' class="now"' : ''}><td><strong>${esc(g.group)}</strong></td><td>${esc(g.items.join(', '))}</td></tr>`).join('')}</tbody></table></div>
${para(C.no_carry_basis, 'small muted')}
<h2>The customer keeps these with them</h2>
${list(C.keep_with_you)}
<h2>Food and plants</h2>
${e.perishables.length ? para(`On the customer's list: ${e.perishables.join(', ')}.`, 'hit') : ''}
${list([...C.perishable, C.fridge_tip])}
<h2>Protect the home</h2>
${list(C.doors_floors)}
<h2>Loading the truck</h2>
${list(C.loading)}
<h2>Lift safely</h2>
${list(C.lifting.map((l) => l.rule))}
<h2>Before anyone leaves</h2>
<ul class="checks"><li>Every room and closet checked with the customer</li><li>Floors and door frames checked, after photos taken</li><li>Any damage written down and told to the customer before you leave</li><li>Hardware bags handed over or used up</li><li>Start time <span class="blank"></span> Finish time <span class="blank"></span></li></ul>
<h2>The labor-only rule</h2>
${list(C.labor_only)}
<p class="small muted">Hours: HireAHelper's estimating chart and its loading and unloading times. Stairs and heavy items: HireAHelper. Won't-carry list and what to keep: Atlas Van Lines and Allied Van Lines. Lifting: NIOSH and OSHA. Labor-only rule: 49 CFR 390 and 375, Florida Statutes 507, California BHGS, U-Haul's Moving Help. Checked ${esc(C.checked)}. Crew scaling, the long carry share and rounding are judgment calls. Rules differ by state: check your city and state.</p>
${foot(o)}`;
  return files.htmlDoc({ title: `${o.business}: move-day plan${o.customer ? ` for ${o.customer}` : ''}${o.date ? `, ${o.date}` : ''}`, css: pages.css(pal) + PHONE, body });
}

module.exports = { movePlan, steps, PHONE };
