// The pages a UGC creator hands to brands: the offer sheet (packages, add-ons, use in plain words,
// the disclosure line), the creative brief for one brand and the month-end report for a retainer.
// Plain HTML with inline CSS and no scripts; each prints on Letter paper and reads on a phone.

const kit = require('../../_kit');
const { esc, htmlDoc } = kit.files;
const { money, color } = kit;

const usd = (n) => money.usd(n);

function paletteOf(hex) {
  return color.palette(color.isHex(hex || '') ? hex : '#c2410c');
}

function css(p) {
  return `@page{size:Letter;margin:0.5in}
*{box-sizing:border-box}
body{margin:0;background:${p.paper};color:${p.ink};font:15px/1.5 Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
main{max-width:820px;margin:0 auto;padding:28px 20px 40px}
header{border-bottom:4px solid ${p.primary};padding-bottom:12px;margin-bottom:18px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${p.muted};margin:0 0 4px}
h1{font-size:28px;line-height:1.15;margin:0 0 6px}
h2{font-size:18px;margin:24px 0 8px;color:${p.primary}}
h3{font-size:16px;margin:0 0 4px}
p{margin:6px 0}
a{color:${p.primary}}
.sub{color:${p.muted};font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}
th,td{text-align:left;vertical-align:top;padding:7px 8px;border-bottom:1px solid ${p.line}}
th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:${p.muted}}
td.r,th.r{text-align:right;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{border:1px solid ${p.line};border-radius:10px;padding:12px 14px;background:${p.surface};break-inside:avoid}
.pick{border:2px solid ${p.primary}}
.label{font-size:12px;color:${p.muted}}
.price{font-size:26px;font-weight:700;line-height:1.1;margin:4px 0}
.per{font-size:13px;font-weight:500;color:${p.muted}}
.big{font-size:30px;font-weight:700}
ul,ol{padding-left:20px;margin:6px 0}
li{margin:3px 0}
.note{border-left:4px solid ${p.primary};padding:8px 12px;background:${p.surface};margin:10px 0}
.concept{border:1px solid ${p.line};border-radius:10px;padding:14px 16px;margin:12px 0;break-inside:avoid;background:#fff}
.tag{display:inline-block;font-size:12px;border:1px solid ${p.line};border-radius:999px;padding:1px 8px;margin-right:6px;color:${p.muted}}
dl{margin:6px 0}dt{font-weight:700;margin-top:8px}dd{margin:2px 0 0}
footer{margin-top:24px;padding-top:10px;border-top:1px solid ${p.line};font-size:11px;color:${p.muted}}
@media (max-width:680px){.grid,.grid2{grid-template-columns:1fr}h1{font-size:23px}}
@media print{main{padding:0}.box,.note{background:#fff}}`;
}

const li = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const link = (url, label) => (/^https:\/\//.test(String(url || '')) ? `<a href="${esc(url)}">${esc(label || url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : esc(label || ''));

// ---------- the offer sheet ----------

// o: { name, contact, site, n (lib/offer numbers), founding: { open, count, price, ask }, usage: [{ title, text }],
// disclosure (lib/offer disclosureFor), validUntil, color }
function offerSheetHtml(o) {
  const p = paletteOf(o.color);
  const n = o.n;
  const cards = n.packages
    .map(
      (k) => `<div class="box${k.id === 'starter' ? ' pick' : ''}"><div class="label">${esc(k.goodFor)}</div><h3>${esc(k.name)}</h3><div class="price">${esc(usd(k.price))}${k.per ? ` <span class="per">${esc(k.per)}</span>` : ''}</div>${li(k.includes)}</div>`,
    )
    .join('\n');
  const addons = [
    ['Extra hook (a new first 3 seconds)', `+${usd(n.hook)}`, 'per hook'],
    ['Raw footage (every unedited take)', `+${usd(n.raw)}`, 'per video'],
    ['Paid ad use, 30 days', `+${usd(n.ads30)}`, 'per video'],
    ['Paid ad use, 90 days', `+${usd(n.ads90)}`, 'per video'],
    ['Whitelisting or Spark Ads, 30 days', `+${usd(n.whitelist)}`, 'per platform'],
    ['Rush, 48 hours', `+${usd(n.rush)}`, 'per video'],
  ];
  const d = o.disclosure;
  const contact = [o.contact ? esc(o.contact) : '', o.site ? link(o.site) : ''].filter(Boolean).join(' | ');
  const body = `<main>
<header><p class="kicker">Short product videos for brands</p><h1>${esc(o.name)}</h1>
<p class="sub">Vertical videos, 15 to 60 seconds, for your product pages, your posts and your ads. Prices in US dollars, good through ${esc(o.validUntil)}.${contact ? ` ${contact}` : ''}</p></header>
<div class="grid">
${cards}
</div>
${o.founding && o.founding.open ? `<div class="note"><b>Founding brands:</b> my first ${esc(o.founding.count)} brands get the test video at ${esc(usd(o.founding.price))} (normally ${esc(usd(n.video))}), for ${esc(o.founding.ask)}.</div>` : ''}
<h2>Add-ons</h2>
<table><thead><tr><th>Add-on</th><th class="r">Price</th><th>Per</th></tr></thead><tbody>
${addons.map((a) => `<tr><td>${esc(a[0])}</td><td class="r">${esc(a[1])}</td><td>${esc(a[2])}</td></tr>`).join('\n')}
</tbody></table>
<h2>How it works</h2>
<ol>
<li>You pick the product and tell me where the video will run: your product page, your posts or your ads.</li>
<li>I send a one-page brief with the hooks, the shots and the dates, for your yes.</li>
<li>You ship the product. The videos arrive ${esc(n.turnaround)} days after it does, each with captions and a clean version without text.</li>
<li>One round of edits if you ask within 5 days. Half up front books the date, the rest is due on delivery.</li>
</ol>
<h2>What you can do with the videos</h2>
<dl>${o.usage.map((t) => `<dt>${esc(t.title)}</dt><dd>${esc(t.text)}</dd>`).join('')}</dl>
<h2>If a video also goes on my account</h2>
<p>It is labeled as an ad, in plain words: ${d.spokenLead ? `I say "${esc(d.spokenLead)}" and your brand's name in the video, the caption starts with "${esc(d.captionLead)}" and your brand's name` : `I say "${esc(d.spoken)}" in the video, the caption starts with "${esc(d.caption)}"`}, and the platform's branded content setting is on. ${esc(d.gifted)}</p>
<footer>${esc(o.name)}${contact ? ` | ${contact}` : ''}. Prices good through ${esc(o.validUntil)}. I promise what I control: the video on time, one round of edits and a redo if it misses the brief we agreed on. No one can promise views or sales.</footer>
</main>`;
  return htmlDoc({ title: `${o.name}: UGC rates`, css: css(p), body, description: `Short product video packages, add-ons and the use in plain words from ${o.name}.` });
}

// ---------- the creative brief ----------

// b: { brand, to, member: { name, contact, site }, date, pkg (lib/offer package), priceText, concepts:
// [{ n, product: { title, price, url }, angle, hooks: [], beats: [{ at, say, shot, caption }], shots: [] }],
// deliverables: [], names: [], timeline: [{ when, what }], needs: [], usage: [{ title, text }], rules: [],
// checked, color }
function briefHtml(b) {
  const p = paletteOf(b.color);
  const concepts = b.concepts
    .map(
      (c) => `<div class="concept"><p class="kicker">Video ${esc(c.n)}${c.length ? ` | ${esc(c.length)} seconds | 9:16` : ''}</p><h3>${esc(c.product.title)}${c.product.price ? ` <span class="per">${esc(usd(c.product.price))}</span>` : ''}</h3>
${c.product.url ? `<p class="sub">${link(c.product.url, 'Product page')}</p>` : ''}
<p><b>Angle:</b> ${esc(c.angle)}</p>
<p><b>Hooks to try</b> (the first 3 seconds):</p>${li(c.hooks)}
<table><thead><tr><th>Time</th><th>What happens</th><th>Shot</th><th>On screen</th></tr></thead><tbody>
${c.beats.map((x) => `<tr><td>${esc(x.at)}</td><td>${esc(x.say)}</td><td>${esc(x.shot)}</td><td>${esc(x.caption)}</td></tr>`).join('\n')}
</tbody></table></div>`,
    )
    .join('\n');
  const body = `<main>
<header><p class="kicker">Creative brief</p><h1>${esc(b.brand)}: ${esc(b.title)}</h1>
<p class="sub">Prepared by ${esc(b.member.name || '[your name]')}${b.to ? ` for ${esc(b.to)}` : ''} on ${esc(b.date)}. Product facts are from your store, read ${esc(b.checked)}.</p></header>
<div class="grid2">
<div class="box"><div class="label">The package</div><h3>${esc(b.pkg.name)}</h3><div class="price">${esc(b.priceText)}</div>${li(b.pkg.includes)}</div>
<div class="box"><div class="label">Dates</div><table><tbody>${b.timeline.map((t) => `<tr><td>${esc(t.when)}</td><td>${esc(t.what)}</td></tr>`).join('')}</tbody></table></div>
</div>
<h2>The videos</h2>
${concepts}
<h2>What you get</h2>
${li(b.deliverables)}
${b.names && b.names.length ? `<p class="sub">File names: ${esc(b.names.join(', '))}</p>` : ''}
<h2>What I need from you</h2>
${li(b.needs)}
<h2>What you can do with the videos</h2>
<dl>${b.usage.map((t) => `<dt>${esc(t.title)}</dt><dd>${esc(t.text)}</dd>`).join('')}</dl>
<h2>Honest by design</h2>
${li(b.rules)}
<footer>${esc(b.member.name || '[your name]')}${b.member.contact ? ` | ${esc(b.member.contact)}` : ''}${b.member.site ? ` | ${link(b.member.site)}` : ''}. Nothing is filmed until you say yes to this brief.</footer>
</main>`;
  return htmlDoc({ title: `Creative brief for ${b.brand}`, css: css(p), body, description: `${b.title} for ${b.brand}: hooks, shots, dates and the use in plain words.` });
}

// ---------- the month-end report ----------

// r: { brand, to, month, member: { name, contact }, counts: [{ label, value }], delivered: [{ title, date, link, from }],
// shared: [{ label, value }], learned: [], next: [], dates: [{ when, what }], upsell: { label, pitch, priceText },
// made, color }
function reportHtml(r) {
  const p = paletteOf(r.color);
  const body = `<main>
<header><p class="kicker">Monthly report</p><h1>${esc(r.brand)}: ${esc(r.month)}</h1>
<p class="sub">From ${esc(r.member.name || '[your name]')}${r.to ? ` for ${esc(r.to)}` : ''}. Made ${esc(r.made)}.</p></header>
<div class="grid">
${r.counts.map((c) => `<div class="box"><div class="label">${esc(c.label)}</div><div class="big">${esc(c.value)}</div></div>`).join('\n')}
</div>
<h2>What we made</h2>
${r.delivered.length ? `<table><thead><tr><th>#</th><th>Video</th>${r.delivered.some((d) => d.date) ? '<th>Delivered</th>' : ''}${r.delivered.some((d) => d.link) ? '<th>Link</th>' : ''}</tr></thead><tbody>
${r.delivered.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.title)}</td>${r.delivered.some((x) => x.date) ? `<td>${esc(d.date || '')}</td>` : ''}${r.delivered.some((x) => x.link) ? `<td>${d.link ? link(d.link, 'Open') : ''}</td>` : ''}</tr>`).join('\n')}
</tbody></table>` : '<p>No videos listed for this month.</p>'}
${r.shared.length ? `<h2>Numbers you shared</h2><table><tbody>${r.shared.map((s) => `<tr><td>${esc(s.label)}</td><td class="r">${esc(s.value)}</td></tr>`).join('')}</tbody></table><p class="sub">As your team shared them. I don't see your ad account, so these are yours, not mine.</p>` : ''}
${r.learned.length ? `<h2>What I noticed</h2>${li(r.learned)}` : ''}
<h2>Next month</h2>
${li(r.next)}
${r.dates.length ? `<table><tbody>${r.dates.map((d) => `<tr><td>${esc(d.when)}</td><td>${esc(d.what)}</td></tr>`).join('')}</tbody></table>` : ''}
${r.upsell ? `<h2>One idea for next month</h2><div class="box"><h3>${esc(r.upsell.label)}</h3><p>${esc(r.upsell.pitch)}</p><p class="price">${esc(r.upsell.priceText)}</p></div>` : ''}
<footer>${esc(r.member.name || '[your name]')}${r.member.contact ? ` | ${esc(r.member.contact)}` : ''}. Every number here is one you shared or a count of what I delivered.</footer>
</main>`;
  return htmlDoc({ title: `${r.brand} report, ${r.month}`, css: css(p), body, description: `What was made for ${r.brand} in ${r.month}, the numbers they shared and next month's plan.` });
}

module.exports = { offerSheetHtml, briefHtml, reportHtml, paletteOf };
