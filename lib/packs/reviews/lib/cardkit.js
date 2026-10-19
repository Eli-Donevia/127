// The review card kit: the link a QR code opens, the printable kit page (counter card, 8 handout
// cards, the ask, reply templates, a starting-point box) and a 1080 x 1350 picture of the counter
// card for the follow-up message. No scripts in the page. No Google ratings or counts in any file:
// the starting-point box is filled in by hand from the listing, with the date.

const kit = require('../../_kit');
const { svg, qr, files, color } = kit;
const NICHE = require('../data/niche.json');
const { longDate } = require('../../_kit/talk');

const esc = files.esc;

function colorsFor(seed, hex) {
  return color.palette(hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : seed || 'five star');
}

// The link the code opens. Best: the shop's own link from its Business Profile ("Get more reviews").
// Before they sign: their map listing by place ID, where "Write a review" is one tap away.
function reviewLink({ own, placeId, mapsUrl, name, city }) {
  const o = String(own || '').trim();
  if (/^https:\/\/\S+$/i.test(o)) return { url: o, kind: 'own', note: 'Their own review link from the Business Profile.' };
  const q = encodeURIComponent([name, city].filter(Boolean).join(' ') || 'business');
  if (placeId) return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || 'business')}&query_place_id=${encodeURIComponent(placeId)}`, kind: 'place', note: 'Opens their map listing, where Write a review is one tap away. Swap in their own review link once they say yes.' };
  if (/^https:\/\/(www\.)?google\.[a-z.]+\/maps\S*$/i.test(String(mapsUrl || ''))) return { url: mapsUrl, kind: 'place', note: 'Opens their map listing. Swap in their own review link once they say yes.' };
  return { url: `https://www.google.com/maps/search/?api=1&query=${q}`, kind: 'search', note: 'Opens a map search for the shop. Check it lands on the right listing before you print, and swap in their own review link once they say yes.' };
}

function cardCopy({ name, visit }) {
  return {
    kicker: 'REVIEW US ON GOOGLE',
    head: `How was your ${visit || 'visit'}?`,
    body: 'Scan the code to leave a Google review. We read every one, good or bad.',
    small: `Thank you for choosing ${name}.`,
  };
}

function css(p) {
  return `@page{size:Letter;margin:0.4in}
*{box-sizing:border-box}
body{margin:0;background:${p.paper};color:${p.ink};font:15px/1.45 Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 16px 40px}
header{border-bottom:4px solid ${p.primary};padding-bottom:10px;margin-bottom:16px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${p.muted};margin:0 0 4px}
h1{font-size:26px;line-height:1.15;margin:0 0 6px}
h2{font-size:19px;margin:26px 0 8px;color:${p.primary}}
.counter{width:5in;max-width:100%;min-height:7in;margin:0 auto;border:2px solid ${p.primary};border-radius:18px;padding:.35in;text-align:center;background:#fff;color:#111;display:flex;flex-direction:column;justify-content:space-evenly;align-items:center}
.counter .k{font-size:13px;letter-spacing:.12em;font-weight:700;color:${p.primary}}
.counter h3{font-size:38px;line-height:1.1;margin:8px 0}
.counter p{font-size:18px;margin:8px 0}
.counter .name{font-size:20px;font-weight:700;color:${p.primary}}
.counter svg{display:block;margin:10px auto}
.grid{display:grid;grid-template-columns:repeat(2,3.5in);gap:.12in;justify-content:center}
.small{width:3.5in;height:2in;border:1px dashed #999;border-radius:6px;padding:.14in;display:flex;gap:.12in;align-items:center;background:#fff;color:#111}
.small svg{flex:none}
.small b{display:block;font-size:15px;line-height:1.15;margin-bottom:4px}
.small span{font-size:11.5px;line-height:1.3}
.copy{background:${p.surface};border-left:4px solid ${p.primary};padding:10px 12px;margin:8px 0;white-space:pre-wrap}
.box{border:1px solid ${p.line};border-radius:10px;padding:12px 14px;margin:8px 0}
.fill{display:inline-block;min-width:1.4in;border-bottom:1px solid ${p.ink};margin:0 6px}
ul{padding-left:20px}
.muted,.src,.osm-credit{color:${p.muted};font-size:12.5px}
a{color:${p.primary}}
.pb{break-before:page}
@media (max-width:560px){.grid{grid-template-columns:1fr}.small,.counter{width:100%}}
@media print{main{padding:0}.noprint{display:none}}`;
}

function kitHtml({ name, link, shop, copy, ask, replies, website, member, checked, sample, credit = '' }) {
  const p = colorsFor(name, website && website.hex);
  const big = qr.qrSvg(link.url, { size: '2.6in', dark: '#111111', light: '#ffffff', title: `Review ${name} on Google` });
  const tiny = qr.qrSvg(link.url, { size: '1.15in', dark: '#111111', light: '#ffffff' });
  const smalls = Array.from({ length: 8 }, () => `<div class="small">${tiny}<div><b>${esc(copy.head)}</b><span>${esc(copy.body)}</span></div></div>`).join('');
  const rules = NICHE.rules.map((r) => `<li>${esc(r.line)} <span class="src">(${esc(r.label)}: <a href="${esc(r.url)}">${esc(r.url)}</a>)</span></li>`).join('');
  const facts = NICHE.facts.map((f) => `<li>${esc(f.line)} <span class="src">(${esc(f.label)}: <a href="${esc(f.url)}">source</a>)</span></li>`).join('');
  const siteLine = website && website.checked
    ? website.reachable
      ? website.shown
        ? `Your website shows reviews or testimonials (checked ${esc(website.url)} on ${esc(checked)}). Link to your Google reviews from that section too.`
        : `We couldn't find any reviews or testimonials on ${esc(website.url)} (checked ${esc(checked)}). A short reviews section with a link to Google helps.`
      : `We couldn't open ${esc(website.url || 'the website')} on ${esc(checked)}.`
    : 'No website listed: the card and the receipt line do all the work.';
  const body = `<main>
<header><p class="kicker">Review card kit${sample ? ' (sample)' : ''} · made ${esc(checked)}</p><h1>${esc(name)}: more Google reviews, the honest way</h1>
<p>A counter card, 8 handout cards, the words for your team and replies for good and bad reviews. The code opens ${link.kind === 'own' ? 'your own Google review link' : link.kind === 'place' ? 'your Google listing, where Write a review is one tap away' : 'a map search for your shop; swap in your own review link before printing many'}.</p></header>
<h2>1. Counter card (5 x 7 in.)</h2>
<div class="counter"><div class="k">${esc(copy.kicker)}</div><h3>${esc(copy.head)}</h3>${big}<p>${esc(copy.body)}</p><p class="name">${esc(copy.small)}</p></div>
<p class="muted">Print at 100% on card stock. Test it first: scan from 1 foot and 3 feet with two different phones. The code is ${link.kind === 'own' ? 'your review link' : 'a map link'}: ${esc(link.url)}</p>
<h2 class="pb">2. Handout cards (8 per page, cut on the dashed lines)</h2>
<div class="grid">${smalls}</div>
<p class="muted">Codes print at least 1.15 in. wide with a white margin, above the 0.8 in. minimum (Bitly; Denso Wave asks for a 4-module margin). Printed cards cost little: ${NICHE.print.map((x) => `${esc(x.item.replace(/^(\d+) .*$/, '$1'))} for ${esc(x.price)} at ${esc(x.vendor)}`).join(', ')} (prices checked ${esc(longDate(NICHE.checked))}).</p>
<h2 class="pb">3. The ask: every customer, every time</h2>
<p><b>Your team says:</b></p><div class="copy">${esc(ask.staff)}</div>
<p><b>On the receipt or invoice:</b></p><div class="copy">${esc(ask.receipt)}</div>
<p><b>In the thank-you email:</b></p><div class="copy">${esc(ask.email)}</div>
<p><b>Text, only to customers who agreed to get texts:</b></p><div class="copy">${esc(ask.text)}</div>
<h2>4. Replies to every review</h2>
<p><b>A good review:</b></p><div class="copy">${esc(replies.good)}</div>
<p><b>A bad review:</b></p><div class="copy">${esc(replies.bad)}</div>
<p class="muted">Reply within a day or two, use their first name, and never share private details about the visit.</p>
<h2>5. Your starting point</h2>
<div class="box"><p>Reviews today<span class="fill"></span> Stars today<span class="fill"></span></p><p>Newest review dated<span class="fill"></span> Checked on<span class="fill"></span></p><p class="muted">Copy these from your Google listing today, then check again on the same day next month.</p><p>${siteLine}</p></div>
<h2>6. The rules we follow</h2><ul>${rules}</ul>
<h2>7. Why it matters</h2><ul>${facts}</ul>
<h2>8. Swap in your own review link</h2>
<p>${esc(NICHE.own_link.steps)} <span class="src">(<a href="${esc(NICHE.own_link.url)}">Google Business Profile Help</a>)</span></p>
${member.name || member.business ? `<p class="muted">Made for ${esc(name)} by ${esc([member.name, member.business].filter(Boolean).join(', '))}${member.contact ? ` · ${esc(member.contact)}` : ''}.</p>` : ''}
${credit}
</main>`;
  return files.htmlDoc({ title: `${name} review card kit`, description: 'Counter card, handout cards, the ask and reply templates', css: css(p), body });
}

// The 1080 x 1350 picture of the counter card.
function cardPicture({ name, link, copy, checked, hex }) {
  const W = 1080;
  const H = 1350;
  const p = colorsFor(name, hex);
  const parts = [];
  parts.push(svg.rect({ x: 0, y: 0, w: W, h: H, fill: p.primary }));
  parts.push(svg.rect({ x: 60, y: 60, w: W - 120, h: H - 120, r: 36, fill: '#ffffff' }));
  parts.push(svg.text({ x: W / 2, y: 170, lines: [copy.kicker], size: 30, weight: 700, fill: p.primary, anchor: 'middle', letterSpacing: 4 }));
  const head = svg.fit(copy.head, { width: W - 260, height: 200, maxSize: 84, minSize: 44, maxLines: 2, weight: 800 });
  parts.push(svg.text({ x: W / 2, y: 190 + head.size, lines: head.lines, size: head.size, weight: 800, fill: '#111111', anchor: 'middle', lineHeight: 1.08 }));
  const top = 190 + head.size + head.lines.length * Math.round(head.size * 1.08) + 20;
  const size = 520;
  parts.push(qr.qrSvg(link.url, { size, x: (W - size) / 2, y: top, dark: '#111111', light: '#ffffff' }));
  const body = svg.fit(copy.body, { width: W - 260, height: 140, maxSize: 40, minSize: 26, maxLines: 3, weight: 500 });
  const by = top + size + 30 + body.size;
  parts.push(svg.text({ x: W / 2, y: by, lines: body.lines, size: body.size, weight: 500, fill: '#111111', anchor: 'middle', lineHeight: 1.2 }));
  const small = svg.fit(copy.small, { width: W - 260, height: 60, maxSize: 30, minSize: 22, maxLines: 1, weight: 400 });
  parts.push(svg.text({ x: W / 2, y: H - 110, lines: small.lines, size: small.size, weight: 400, fill: '#555555', anchor: 'middle' }));
  parts.push(svg.text({ x: W / 2, y: H - 22, lines: [`Review card kit for ${name}, made ${checked}`], size: 22, weight: 500, fill: p.onPrimary, anchor: 'middle' }));
  return svg.doc({ width: W, height: H, background: p.primary, body: parts.join(''), title: `Review card for ${name}` });
}

module.exports = { reviewLink, cardCopy, kitHtml, cardPicture, colorsFor };
