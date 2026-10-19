// What buyers see on paper and phones: the offer card (SVG, saved as PNG), printable door hangers
// (two per Letter sheet) and the one-page offer sheet. Member colors from kit color.palette (their hex,
// else the niche's mood), never 127's. No scripts. Shared household spine.

const { svg, qr, color, files, money, text } = require('..');

const esc = files.esc;
const usd = (n) => (n == null ? '' : money.usd(n).replace(/\.00$/, ''));

function paletteFor(cfg, hex) {
  return color.palette(color.isHex(hex || '') ? hex : cfg.niche.mood || 'fresh');
}

// QR target: their booking link, else a text to their phone.
function qrTarget({ link, phone }) {
  if (link && /^https?:\/\//i.test(link)) return link;
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `sms:+1${d}`;
  if (d.length === 11 && d[0] === '1') return `sms:+${d}`;
  return '';
}

function qrInner(target, { x, y, size, dark }) {
  if (!target) return '';
  return qr.qrSvg(target, { x, y, size, dark: dark || '#111111', light: '#ffffff', margin: 2 });
}

// Offer card, 1080 x 1350 (phones and posts). o: { business, headline, price, founding, ref, who,
// includes: [3], plan, promise, phone, link }
function offerCard(cfg, o, pal) {
  const W = 1080;
  const H = 1350;
  const pad = 80;
  const body = [];
  body.push(svg.rect({ x: 0, y: 0, w: W, h: 210, fill: pal.primary }));
  body.push(svg.icon(cfg.niche.icon || 'sparkle', { x: pad, y: 62, size: 86, color: pal.onPrimary, weight: 1.8 }));
  const biz = svg.fit(o.business, { width: W - pad * 2 - 120, height: 90, maxSize: 54, minSize: 30, maxLines: 1, weight: 800 });
  body.push(svg.text({ x: pad + 120, y: 122, lines: biz.lines, size: biz.size, weight: 800, fill: pal.onPrimary }));
  if (o.area) body.push(svg.text({ x: pad + 120, y: 168, lines: [o.area], size: 30, weight: 500, fill: pal.onPrimary, opacity: 0.85 }));
  // o.eyebrow: a short line over the headline ("A free sample for Keystone Realty"); o.big and o.side
  // replace the price box ("Free", ["one room", "about 30 minutes"]) for a demo offer.
  let top = 300;
  if (o.eyebrow) {
    const eb = svg.fit(o.eyebrow, { width: W - pad * 2, height: 50, maxSize: 34, minSize: 24, maxLines: 1, weight: 700 });
    body.push(svg.text({ x: pad, y: 282, lines: eb.lines, size: eb.size, weight: 700, fill: pal.primary }));
    top = 330;
  }
  const head = svg.fit(o.headline, { width: W - pad * 2, height: o.eyebrow ? 230 : 250, maxSize: o.eyebrow ? 80 : 92, minSize: 44, maxLines: 3, weight: 800 });
  let y = top + head.size * 0.8;
  body.push(svg.text({ x: pad, y, lines: head.lines, size: head.size, weight: 800, fill: pal.ink, lineHeight: 1.05 }));
  y += head.size * 1.05 * (head.lines.length - 1) + 60;
  body.push(svg.rect({ x: pad, y, w: W - pad * 2, h: 220, r: 28, fill: pal.surface }));
  const big = o.big || usd(o.founding || o.price);
  body.push(svg.text({ x: pad + 44, y: y + 128, lines: [big], size: 118, weight: 800, fill: pal.primary }));
  const bw = svg.textWidth(big, 118, 800);
  const side = (o.side || [o.founding && o.price && o.founding < o.price ? `instead of ${usd(o.price)}` : 'per visit', o.who || 'First 3 clients', o.ref ? `for a ${o.ref}` : '']).filter(Boolean).slice(0, 3);
  const sideW = W - pad * 2 - 44 - bw - 36 - 30;
  const sideSize = Math.min(32, ...side.map((l) => (svg.textWidth(l, 32, 600) > sideW ? Math.max(22, Math.floor((32 * sideW) / svg.textWidth(l, 32, 600))) : 32)));
  body.push(svg.text({ x: pad + 44 + bw + 36, y: y + 80, lines: side, size: sideSize, weight: 600, fill: pal.ink, lineHeight: 1.3 }));
  y += 290;
  for (const inc of (o.includes || []).slice(0, 3)) {
    body.push(svg.icon('check', { x: pad, y: y - 34, size: 44, color: pal.primary, weight: 2.2 }));
    const l = svg.fit(inc, { width: W - pad * 2 - 70, height: 50, maxSize: 38, minSize: 26, maxLines: 1, weight: 500 });
    body.push(svg.text({ x: pad + 66, y, lines: l.lines, size: l.size, weight: 500, fill: pal.ink }));
    y += 66;
  }
  y += 14;
  // The plan and the promise only when the whole sentence fits above the footer band: never a cut line.
  const floor = H - 200 - 26;
  for (const line of [o.plan, o.promise].filter(Boolean)) {
    const l = svg.fit(line, { width: W - pad * 2 - 60, height: 90, maxSize: 32, minSize: 24, maxLines: 2, weight: 500 });
    const whole = svg.wrap(line, { width: W - pad * 2 - 60, size: l.size, weight: 500 }).length <= l.lines.length;
    if (!whole || y + l.size * 1.25 * (l.lines.length - 1) + l.size * 0.3 > floor) continue;
    body.push(svg.text({ x: pad, y, lines: l.lines, size: l.size, weight: 500, fill: pal.muted, lineHeight: 1.25 }));
    y += l.size * 1.25 * l.lines.length + 22;
  }
  body.push(svg.rect({ x: 0, y: H - 200, w: W, h: 200, fill: pal.ink }));
  const target = qrTarget(o);
  const cta = o.phone ? `Text ${o.phone}` : o.link ? 'Book online' : 'Ask me for a spot';
  body.push(svg.text({ x: pad, y: H - 112, lines: [cta], size: 56, weight: 800, fill: '#ffffff' }));
  body.push(svg.text({ x: pad, y: H - 60, lines: [o.link && o.phone ? o.link.replace(/^https?:\/\//, '') : 'Scan or text to book'], size: 28, weight: 500, fill: '#ffffff', opacity: 0.8 }));
  if (target) {
    body.push(svg.rect({ x: W - pad - 170, y: H - 185, w: 170, h: 170, r: 12, fill: '#ffffff' }));
    body.push(qrInner(target, { x: W - pad - 160, y: H - 175, size: 150 }));
  }
  return svg.doc({ width: W, height: H, background: pal.paper, body: body.join(''), title: `${o.business}: ${o.headline}` });
}

function baseCss(pal) {
  return `*{box-sizing:border-box}body{margin:0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:${pal.ink};background:#fff}
h1,h2,h3{margin:0 0 .3em;line-height:1.1}p{margin:.3em 0}ul{margin:.3em 0;padding-left:1.1em}
.muted{color:${pal.muted}}.price{color:${pal.primary};font-weight:800}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid ${pal.line};font-size:13px;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:${pal.muted}}`;
}

// Two door hangers per Letter sheet, cut along the dashed lines; punch or cut the circle.
function doorHangers(cfg, o, pal) {
  const target = qrTarget(o);
  const qrCode = target ? qr.qrSvg(target, { size: '1.15in', margin: 2 }) : '';
  const one = `<section class="dh">
<div class="hole"></div><div class="slit"></div>
<p class="hi">${esc(o.hello || 'Hi neighbor!')}</p>
<h1>${esc(o.headline)}</h1>
${o.big ? `<div class="deal"><span class="big">${esc(o.big)}</span><span class="was">${(o.side || []).map(esc).join('<br>')}</span></div>` : `<div class="deal"><span class="big">${esc(usd(o.founding || o.price))}</span><span class="was">${o.founding && o.price && o.founding < o.price ? `instead of ${esc(usd(o.price))}` : ''}<br>${esc(o.who || '')}${o.ref ? `, ${esc(o.ref)}` : ''}</span></div>`}
<ul>${(o.includes || []).slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${o.plan ? `<p class="plan">${esc(o.plan)}</p>` : ''}
${(o.sizes || []).length ? `<table class="sizes"><tr>${o.sizes.map((x) => `<th>${esc(x.label)}</th>`).join('')}</tr><tr>${o.sizes.map((x) => `<td>${esc(usd(x.price))}</td>`).join('')}</tr></table><p class="small muted">${esc(o.sizesNote || 'Regular price by size. Founding price for the first 3 clients.')}</p>` : ''}
<ol class="how">${(o.how || ['Text or scan the code', 'Pick a day that works', o.step3 || 'I do the work and send photos']).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
${o.promise ? `<p class="promise">${esc(o.promise)}</p>` : ''}
<div class="foot"><div><p class="biz">${esc(o.business)}</p><p class="call">${o.phone ? `Call or text ${esc(o.phone)}` : 'Call or text: ______________'}</p>${o.link ? `<p class="link">${esc(o.link.replace(/^https?:\/\//, ''))}</p>` : ''}</div>${qrCode ? `<div class="qr">${qrCode}<p>Scan to text me</p></div>` : ''}</div>
</section>`;
  const css = `${baseCss(pal)}
@page{size:letter;margin:0}
.sheet{display:grid;grid-template-columns:4.25in 4.25in;width:8.5in;height:11in}
.dh{position:relative;height:11in;padding:2.2in .38in .4in;border-right:1px dashed #999;overflow:hidden}
.dh:last-child{border-right:0}
.hole{position:absolute;top:.45in;left:50%;width:1.3in;height:1.3in;margin-left:-.65in;border:1.5px dashed #999;border-radius:50%}
.slit{position:absolute;top:1.75in;left:50%;width:1px;height:.4in;border-left:1.5px dashed #999}
.hi{font-size:15pt;font-weight:700;color:${pal.primary};margin:0 0 .1in}
h1{font-size:28pt;letter-spacing:-.01em}
.deal{display:flex;align-items:center;gap:.14in;background:${pal.surface};border-radius:.14in;padding:.12in .16in;margin:.18in 0}
.big{font-size:36pt;font-weight:800;color:${pal.primary}}.was{font-size:10.5pt;line-height:1.3}
li{font-size:12pt;margin:.05in 0}.plan{font-size:11pt;font-weight:600;margin-top:.14in}.promise{font-size:10.5pt;color:${pal.muted}}
.foot{position:absolute;left:.38in;right:.38in;bottom:.45in;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid ${pal.primary};padding-top:.12in}
.biz{font-weight:800;font-size:13pt;margin:0}.call{font-size:12pt;font-weight:600;margin:.04in 0}.link{font-size:10pt;margin:0}
.qr svg{display:block}.qr p{font-size:8pt;text-align:center;margin:.03in 0 0}
.sizes{margin:.14in 0 .02in}.sizes th,.sizes td{font-size:10pt;padding:3px 4px;text-align:center}.sizes td{font-weight:700;color:${pal.primary}}.small{font-size:8.5pt}
.how{margin:.14in 0;padding-left:1.2em}.how li{font-size:11pt;margin:.03in 0}
@media screen{body{background:#eee}.sheet{background:#fff;margin:20px auto;box-shadow:0 2px 12px rgba(0,0,0,.15)}}`;
  return files.htmlDoc({ title: o.title || `${o.business} door hangers`, css, body: `<div class="sheet">${one}${one}</div>` });
}

// One-page offer sheet: o adds { name, who_for, outcome, rows: [{label, price, unit, includes}], ladder, plans }.
function offerSheet(cfg, o, pal) {
  const target = qrTarget(o);
  const qrCode = target ? qr.qrSvg(target, { size: '1.1in', margin: 2 }) : '';
  const rows = (o.rows || []).map((r) => `<tr><td><strong>${esc(r.label)}</strong>${r.includes ? `<br><span class="muted">${esc(r.includes)}</span>` : ''}</td><td class="price">${esc(usd(r.price))}</td><td>${esc(r.unit || '')}</td></tr>`).join('');
  const sizes = (o.sizes || []).length ? `<h3>Price by home size</h3><table><tr>${o.sizes.map((s) => `<th>${esc(s.label)}</th>`).join('')}</tr><tr>${o.sizes.map((s) => `<td class="price">${esc(usd(s.price))}</td>`).join('')}</tr></table>` : '';
  const ladder = (o.ladder || []).length ? `<h3>First clients</h3><ul>${o.ladder.map((l) => `<li><strong>${esc(l.who)}:</strong> ${esc(usd(l.price))} ${esc(l.label.toLowerCase())}</li>`).join('')}</ul>` : '';
  const css = `${baseCss(pal)}
@page{size:letter;margin:.55in}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid ${pal.primary};padding-bottom:.12in;margin-bottom:.15in}
.biz{font-size:12pt;font-weight:700;color:${pal.primary};text-transform:uppercase;letter-spacing:.06em}
h1{font-size:26pt}h3{font-size:12pt;margin-top:.2in;color:${pal.primary}}
.box{background:${pal.surface};border-radius:10px;padding:.12in .16in;margin:.15in 0}
.foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:.25in;border-top:1px solid ${pal.line};padding-top:.12in}
@media screen{body{max-width:8.5in;margin:24px auto;padding:0 24px}}`;
  const body = `<div class="top"><div><p class="biz">${esc(o.business)}</p><h1>${esc(o.name || o.headline)}</h1><p>${esc(o.outcome || '')}</p></div></div>
<p><strong>For:</strong> ${esc(o.who_for || '')}</p>
<table><tr><th>Service</th><th>Price</th><th>Per</th></tr>${rows}</table>
${sizes}
${o.plansLine ? `<div class="box"><strong>Regular plan:</strong> ${esc(o.plansLine)}</div>` : ''}
${o.promise ? `<div class="box"><strong>My promise:</strong> ${esc(o.promise)}</div>` : ''}
${ladder}
<div class="foot"><div><p><strong>${esc(o.business)}</strong></p><p>${o.phone ? `Call or text ${esc(o.phone)}` : ''}</p>${o.link ? `<p>${esc(o.link)}</p>` : ''}<p class="muted">${esc(o.area || '')}</p></div>${qrCode}</div>`;
  return files.htmlDoc({ title: `${o.business} offer`, css, body });
}

// Leave-behind review cards, 4 to a Letter sheet: a thank-you and a QR code to the member's review page.
// The words ask for an honest review and offer nothing in return.
function reviewCards(cfg, o, pal) {
  const code = qr.qrSvg(o.review, { size: '1.6in', margin: 2 });
  const one = `<div class="card"><p class="biz">${esc(o.business)}</p><h2>${esc(o.thanks || 'Thank you for having me!')}</h2><p>${esc(o.ask || 'How did it go? Scan to leave an honest review.')}</p>${code}${o.phone ? `<p class="small">Questions? Call or text ${esc(o.phone)}</p>` : ''}</div>`;
  const css = `@page { size: letter; margin: 0.25in; }
body { margin: 0; font-family: Inter, Arial, sans-serif; color: ${pal.ink || '#111'}; background: #fff; }
.sheet { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 5.2in 5.2in; width: 8in; margin: 0 auto; }
.card { border: 1px dashed #999; padding: 0.35in; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.08in; }
.biz { font-weight: 700; color: ${pal.primary || '#1F5FA8'}; margin: 0; font-size: 15pt; }
h2 { margin: 0.05in 0; font-size: 17pt; }
p { margin: 0; font-size: 11.5pt; }
.small { font-size: 9.5pt; color: #555; }
svg { margin-top: 0.08in; }`;
  return files.htmlDoc({ title: `${o.business} review cards`, css, body: `<div class="sheet">${one}${one}${one}${one}</div>` });
}

module.exports = { paletteFor, offerCard, doorHangers, offerSheet, reviewCards, qrTarget, usd, text };
