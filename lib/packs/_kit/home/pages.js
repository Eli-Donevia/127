// Printable one-page HTML for the household workflows: the sample offer for a partner business, the
// job sheet for a booked job, the case study, the street route sheet, the season plan, and the rate
// sheets for fleets and storefronts. One Letter page each, member colors, no scripts. Shared
// household spine.

const { files, qr } = require('..');
const print = require('./print');

const esc = files.esc;
const usd = print.usd;

function css(pal) {
  return `*{box-sizing:border-box}
body{margin:0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:${pal.ink};background:#fff;font-size:11pt;line-height:1.4}
h1,h2,h3{margin:0 0 .25em;line-height:1.15}p{margin:.25em 0}ul,ol{margin:.25em 0;padding-left:1.15em}li{margin:.12em 0}
@page{size:letter;margin:.5in}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:.2in;border-bottom:4px solid ${pal.primary};padding-bottom:.1in;margin-bottom:.14in}
.eyebrow{font-size:10pt;font-weight:700;color:${pal.primary};text-transform:uppercase;letter-spacing:.06em;margin:0}
h1{font-size:22pt;letter-spacing:-.01em}.sub{font-size:11.5pt;color:${pal.muted}}
h2{font-size:12.5pt;color:${pal.primary};margin-top:.16in}
.box{background:${pal.surface};border-radius:10px;padding:.1in .14in;margin:.1in 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:.04in .25in}.grid p{margin:.04in 0}
.k{font-size:8.5pt;text-transform:uppercase;letter-spacing:.05em;color:${pal.muted};display:block}
table{border-collapse:collapse;width:100%;margin:.06in 0}td,th{text-align:left;padding:4px 6px;border-bottom:1px solid ${pal.line};font-size:10pt;vertical-align:top}
th{font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em;color:${pal.muted}}
.price{color:${pal.primary};font-weight:800}.now td{background:${pal.surface};font-weight:600}
.checks{list-style:none;padding-left:0}.checks li{padding-left:1.6em;position:relative;margin:.07in 0}
.checks li:before{content:'';position:absolute;left:0;top:.1em;width:.85em;height:.85em;border:1.5px solid ${pal.ink};border-radius:2px}
.box-cell{width:.22in;height:.22in;border:1.5px solid ${pal.ink};border-radius:2px;display:inline-block}
.muted{color:${pal.muted}}.small{font-size:8.5pt}.quote{font-size:13pt;font-style:italic;border-left:4px solid ${pal.primary};padding-left:.14in;margin:.1in 0}
.photo{width:100%;border-radius:8px;display:block;margin:.08in 0}
.foot{display:flex;justify-content:space-between;align-items:flex-end;gap:.2in;margin-top:.18in;border-top:1px solid ${pal.line};padding-top:.1in}
.foot p{margin:.02in 0}.qr svg{display:block}.qr p{font-size:7.5pt;text-align:center;margin:.02in 0 0}
.osm-credit{font-size:8pt;color:${pal.muted};margin-top:.1in}.osm-credit a{color:${pal.muted}}
.cut{border:1.5px dashed #999;border-radius:12px;padding:.14in .18in;margin:.12in 0}
@media screen{body{max-width:8.5in;margin:24px auto;padding:0 24px}}
@media print{h2{break-after:avoid}tr,li{break-inside:avoid}}`;
}

// The parts every page shares.
function qrBlock(o, label = 'Scan to text me') {
  const target = print.qrTarget(o);
  return target ? `<div class="qr">${qr.qrSvg(target, { size: '1in', margin: 2 })}<p>${esc(o.link && /^https?:/i.test(o.link) ? 'Scan to book' : label)}</p></div>` : '';
}
function foot(o) {
  const lines = [`<p><strong>${esc(o.business)}</strong>${o.first ? `, ${esc(o.first)}` : ''}</p>`, o.phone ? `<p>Call or text ${esc(o.phone)}</p>` : '', o.link ? `<p>${esc(String(o.link).replace(/^https?:\/\//, ''))}</p>` : '', o.area ? `<p class="muted">${esc(o.area)}</p>` : ''];
  return `<div class="foot"><div>${lines.join('')}</div>${qrBlock(o)}</div>`;
}
const list = (items, cls = '') => (items && items.length ? `<ul${cls ? ` class="${cls}"` : ''}>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const olist = (items) => (items && items.length ? `<ol>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '');
const para = (s, cls) => (s ? `<p${cls ? ` class="${cls}"` : ''}>${esc(s)}</p>` : '');
const top = (eyebrow, h1, sub) => `<div class="top"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(h1)}</h1>${para(sub, 'sub')}</div></div>`;
const doc = (title, pal, body) => files.htmlDoc({ title, css: css(pal), body });

// A sample offer for a partner business: what the free sample is, why their customers, the card for
// their customers, how it works and what is asked in return.
function sampleLetter(cfg, o, pal) {
  const c = o.card || {};
  const offerBox = `<div class="cut"><p class="eyebrow">${esc(c.eyebrow || '')}</p><h3>${esc(c.headline || '')}</h3>
<p><span class="price">${esc(usd(c.founding || c.price))}</span>${c.founding && c.price && c.founding < c.price ? ` instead of ${esc(usd(c.price))}` : ''}, ${esc(String(c.who || 'first 3 clients').toLowerCase())}${c.ref ? ` (${esc(c.ref)})` : ''}</p>
${list(c.includes)}${para(c.plan, 'small')}</div>`;
  const body = `${top(`A free sample for ${o.partner}`, `${o.demo.charAt(0).toUpperCase()}${o.demo.slice(1)}`, `From ${o.first ? `${o.first} at ` : ''}${o.business}, ${cfg.niche.what}${o.town && o.town !== 'town' ? ` in ${o.town}` : ''}`)}
<p>Hi ${esc(o.partner)} team,</p>
<p>${esc(o.first ? `I'm ${o.first} and I run ${o.business}.` : `I run ${o.business}.`)} ${esc(o.why)} Before I ask you for anything, I'd like to show you my work.</p>
<h2>The free sample</h2>
<div class="box"><p><strong>${esc(o.demo.charAt(0).toUpperCase() + o.demo.slice(1))}.</strong> No cost and no catch.${o.day ? ` I can do it ${esc(o.day)}, or any day that suits you.` : ' You pick the day.'}</p></div>
${o.how && o.how.length ? `<h2>How it works</h2>${olist(o.how)}` : ''}
<h2>If you like the work</h2>
<p>I'd ask you to ${esc(o.ask)}. In return I'd be glad to ${esc(o.give)}.</p>
<h2>The offer for your customers</h2>
${offerBox}
${o.promise ? `<p class="small"><strong>My promise:</strong> ${esc(o.promise)}</p>` : ''}
${foot(o)}`;
  return doc(`${o.business}: a free sample for ${o.partner}`, pal, body);
}

// The job sheet for a booked job: the customer and job, what to bring, the checklist with boxes,
// the photos to take and what to send after.
function jobSheet(cfg, o, pal) {
  const J = cfg.niche.job_checklist || {};
  const facts = [
    ['Customer', o.customer],
    ['When', o.when || 'Agree a day and time'],
    ['Where', o.address || 'Ask for the address'],
    ['Contact', o.contact || ''],
    ['Job', o.job],
    ['Price', o.priceLine],
  ].filter(([, v]) => v);
  const sources = (J.sources || []).map((s) => s.publisher).filter(Boolean);
  const body = `${top(`Job sheet, ${o.business}`, o.title, o.sub)}
<div class="box grid">${facts.map(([k, v]) => `<p><span class="k">${esc(k)}</span>${esc(v)}</p>`).join('')}</div>
${o.notes ? `<p><strong>Notes:</strong> ${esc(o.notes)}</p>` : ''}
${o.bring && o.bring.length ? `<h2>Before you leave home</h2><ul class="checks">${o.bring.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
<h2>On the job</h2>
<ul class="checks">${(J.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${o.photos && o.photos.length ? `<h2>Photos to take (before and after, same spot)</h2><ul class="checks">${o.photos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
<h2>After the job</h2>
<ul class="checks">${(o.after || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${o.promise ? `<p class="small"><strong>Your promise to them:</strong> ${esc(o.promise)}</p>` : ''}
${sources.length ? `<p class="small muted">Checklist built from ${esc(sources.join(', '))}.${J.note ? ` ${esc(String(J.note).replace(/\.*$/, ''))}.` : ''}</p>` : ''}`;
  return doc(`${o.business}: job sheet for ${o.customer}`, pal, body);
}

// A case study from one job, only with the customer's written yes. Only what the member typed; a
// founding or free deal says so.
function caseStudy(cfg, o, pal) {
  const img = o.collage ? `<img class="photo" alt="${esc(o.alt || 'Before and after')}" src="data:image/jpeg;base64,${o.collage.toString('base64')}">` : '';
  const body = `${top(`${o.business}, ${cfg.niche.what}`, o.title, o.sub)}
${img}
${o.job ? `<h2>The job</h2>${para(o.job)}` : ''}
${o.wanted ? `<p><strong>What they wanted:</strong> ${esc(o.wanted)}</p>` : ''}
${o.did && o.did.length ? `<h2>What I did</h2>${list(o.did)}` : ''}
${o.result ? `<h2>The result</h2>${para(o.result)}` : ''}
${o.quote ? `<h2>What ${esc(o.who)} said</h2><p class="quote">"${esc(o.quote)}"</p><p class="small muted">${esc(o.who)}${o.place ? `, ${esc(o.place)}` : ''}. Shared with their written permission.</p>` : ''}
${o.disclosure ? `<p class="small"><strong>Good to know:</strong> ${esc(o.disclosure)}</p>` : ''}
<h2>Want the same?</h2>
<p>${esc(o.cta)}</p>
${foot(o)}`;
  return doc(`${o.business}: ${o.title}`, pal, body);
}

// Doors to knock or hang on one street, with boxes to tick, plus the neighbor price.
function routeSheet(cfg, o, pal) {
  const rows = (o.homes || []).map((h) => `<tr${h.customer ? ' class="now"' : ''}><td>${esc(h.label)}</td><td>${esc(h.side || '')}</td><td>${h.customer ? 'Your customer' : '<span class="box-cell"></span>'}</td><td>${h.customer ? '' : '<span class="box-cell"></span>'}</td><td>${h.customer ? '' : '<span class="box-cell"></span>'}</td><td></td></tr>`).join('');
  const body = `${top(`Route sheet, ${o.business}`, o.title, o.sub)}
<div class="box">${para(o.offer)}${para(o.rule, 'small')}</div>
<table><tr><th>Home</th><th>Side</th><th>Hung</th><th>Talked</th><th>Booked</th><th>Notes</th></tr>${rows}</table>
${o.steps && o.steps.length ? `<h2>How to run the street</h2>${olist(o.steps)}` : ''}
${para(o.note, 'small muted')}
${foot(o)}`;
  return doc(`${o.business}: ${o.title}`, pal, body);
}

// Twelve months on one page: the busy and slow months, the offer to lead with, who to reach and
// the one thing to do at the start of each month.
function seasonPlan(cfg, o, pal) {
  const rows = (o.months || []).map((m) => `<tr${m.now ? ' class="now"' : ''}><td><strong>${esc(m.label)}</strong>${m.now ? '<br><span class="small">This month</span>' : ''}</td><td>${esc(m.season)}</td><td>${esc(m.offer)}</td><td>${esc(m.who)}</td><td>${esc(m.do)}</td></tr>`).join('');
  const body = `${top(`Season plan, ${o.business}`, o.title, o.sub)}
<table><tr><th>Month</th><th>Season</th><th>Lead with</th><th>Who to reach</th><th>Do this first</th></tr>${rows}</table>
${o.slow ? `<h2>The slow months</h2>${para(o.slow)}` : ''}
${o.plans && o.plans.length ? `<h2>Plans that carry you through</h2>${list(o.plans)}` : ''}
${para(o.sources, 'small muted')}
${foot(o)}`;
  return doc(`${o.business}: ${o.title}`, pal, body);
}

// A rate sheet for business buyers (fleets and dealers, or storefronts): prices, what's included,
// what you need from them, the free demo and how to start. Stops, when given, list the route.
function rateSheet(cfg, o, pal) {
  const rows = (o.rows || []).map((r) => `<tr><td><strong>${esc(r.label)}</strong>${r.detail ? `<br><span class="muted">${esc(r.detail)}</span>` : ''}</td><td class="price">${esc(r.priceText || usd(r.price))}</td><td>${esc(r.unit || '')}</td></tr>`).join('');
  const body = `${top(o.eyebrow, o.title, o.sub)}
<table><tr><th>Service</th><th>Price</th><th>Per</th></tr>${rows}</table>
${o.volume && o.volume.length ? `<h2>More vehicles, lower price</h2>${list(o.volume)}` : ''}
${o.includes && o.includes.length ? `<h2>Every visit</h2>${list(o.includes)}` : ''}
${o.demo ? `<div class="box"><strong>Free first one:</strong> ${esc(o.demo)}</div>` : ''}
${o.need && o.need.length ? `<h2>What I need from you</h2>${list(o.need)}` : ''}
${o.terms ? para(o.terms, 'small') : ''}
${o.promise ? `<p class="small"><strong>My promise:</strong> ${esc(o.promise)}</p>` : ''}
${foot(o)}`;
  return doc(`${o.business}: ${o.title}`, pal, body);
}

// A list of stops to walk or drive, in order, with a directions link per leg.
function stopSheet(cfg, o, pal) {
  const rows = (o.stops || []).map((s, i) => `<tr><td>${i + 1}</td><td><strong>${esc(s.name)}</strong><br><span class="muted">${esc(s.address || '')}</span></td><td>${esc(s.kind || '')}</td><td>${esc(s.phone || '')}</td><td><span class="box-cell"></span></td><td></td></tr>`).join('');
  const legs = (o.legs || []).map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('');
  const body = `${top(o.eyebrow, o.title, o.sub)}
${o.say ? `<div class="box"><strong>At the counter:</strong> ${esc(o.say)}</div>` : ''}
<table><tr><th>#</th><th>Stop</th><th>Kind</th><th>Phone</th><th>Visited</th><th>Notes</th></tr>${rows}</table>
${legs ? `<h2>Directions</h2><ul>${legs}</ul>` : ''}
${o.credit || ''}
${foot(o)}`;
  return doc(`${o.business}: ${o.title}`, pal, body);
}

module.exports = { sampleLetter, jobSheet, caseStudy, routeSheet, seasonPlan, rateSheet, stopSheet, css };
