// Print artwork for local kits, drawn as SVG at 96 px per inch so the same drawing goes inline into a
// print-ready HTML page (exact inch sizes) and through librsvg into a PNG preview. Type is Inter,
// measured with the real font metrics (kit media.textWidth); colors come from the member's palette.
// QR codes are always dark on a white tile with a 4-module quiet zone, so phone cameras read them.

const kit = require('../../_kit');
const { svg: S, qr } = kit;

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const CAP = 0.7275; // Inter cap height as a share of the font size
const IN = 96;

const esc = (s) => S.esc(s == null ? '' : String(s));
const r2 = (n) => Math.round(n * 100) / 100;

function width(s, size, weight = 700, ls = 0) {
  try {
    return kit.media.textWidth(String(s), size, { weight, letterSpacing: ls });
  } catch {
    return S.textWidth(String(s), size, weight) + ls * String(s).length;
  }
}

function wrap(s, w, size, weight, ls = 0) {
  const words = String(s || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || width(next, size, weight, ls) <= w) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Biggest size that fits the box, then the narrowest width with the same line count (balanced lines).
function fit(s, { w, h = Infinity, max = 96, min = 10, weight = 800, lh = 1.05, lines: maxLines = 4, ls = 0 }) {
  let best = null;
  for (let size = max; size >= min; size -= 1) {
    const lines = wrap(s, w, size, weight, ls * size);
    const tall = size * CAP + (lines.length - 1) * size * lh;
    if (lines.length <= maxLines && tall <= h && lines.every((l) => width(l, size, weight, ls * size) <= w)) {
      best = { size, lines };
      break;
    }
  }
  if (!best) best = { size: min, lines: wrap(s, w, min, weight, ls * min).slice(0, maxLines) };
  if (best.lines.length > 1) {
    let lo = w * 0.55;
    let hi = w;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const l = wrap(s, mid, best.size, weight, ls * best.size);
      if (l.length <= best.lines.length) hi = mid;
      else lo = mid;
    }
    const l = wrap(s, hi, best.size, weight, ls * best.size);
    if (l.length === best.lines.length) best.lines = l;
  }
  best.height = best.size * CAP + (best.lines.length - 1) * best.size * lh;
  return best;
}

// Text whose first line's capital letters start at `top`.
function T({ x, top, lines, size, weight = 700, fill = '#111', lh = 1.1, anchor = 'start', ls = 0, opacity, italic }) {
  const list = [].concat(lines || []).filter((l) => l !== '');
  if (!list.length) return '';
  const spans = list.map((l, i) => `<tspan x="${r2(x)}" y="${r2(top + size * CAP + i * size * lh)}">${esc(l)}</tspan>`).join('');
  return `<text font-family="${FONT}" font-size="${r2(size)}" font-weight="${weight}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${r2(ls * size)}"` : ''}${opacity != null ? ` opacity="${opacity}"` : ''}${italic ? ' font-style="italic"' : ''}>${spans}</text>`;
}

const textHeight = (n, size, lh) => size * CAP + (n - 1) * size * lh;

// A QR code on a white rounded tile. size includes the 4-module quiet zone.
function qrTile(data, { x, y, size, r = 14, dark = '#111111' }) {
  const m = qr.qrMatrix(data, { ecc: 'M' });
  const { dark: d } = qr.safeColors(dark, '#ffffff');
  const n = m.size + 8;
  const k = size / n;
  return {
    svg: `<g transform="translate(${r2(x)} ${r2(y)})"><rect width="${r2(size)}" height="${r2(size)}" rx="${r}" fill="#ffffff"/><g transform="scale(${r2(k * 1000) / 1000})"><path fill="${d}" shape-rendering="crispEdges" d="${qr.pathData(m.modules, 4)}"/></g></g>`,
    module: k,
    version: m.version,
  };
}

function iconBadge(name, { cx, cy, r, bg, fg, weight = 1.8 }) {
  const size = r * 1.1;
  return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${bg}"/>${S.icon(name, { x: cx - size / 2, y: cy - size / 2, size, color: fg, weight })}`;
}

function check({ x, y, size, bg, fg }) {
  const r = size / 2;
  return `<circle cx="${r2(x + r)}" cy="${r2(y + r)}" r="${r2(r)}" fill="${bg}"/><path d="M${r2(x + size * 0.28)} ${r2(y + size * 0.52)}l${r2(size * 0.15)} ${r2(size * 0.15)}l${r2(size * 0.3)} ${r2(-size * 0.32)}" fill="none" stroke="${fg}" stroke-width="${r2(size * 0.12)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function doc(w, h, body, { bg = '#ffffff', defs = '' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}<rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`;
}

// Soft circles in the corner of a color panel, clipped to it.
function decor(id, { x, y, w, h, r, p }) {
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath><g clip-path="url(#${id})"><circle cx="${r2(x + w * 0.96)}" cy="${r2(y + h * 0.06)}" r="${r2(Math.min(w, h) * 0.52)}" fill="${p.accent}" opacity="0.22"/><circle cx="${r2(x + w * 0.96)}" cy="${r2(y + h * 0.06)}" r="${r2(Math.min(w, h) * 0.34)}" fill="none" stroke="${p.onPrimary}" stroke-opacity="0.16" stroke-width="2"/><circle cx="${r2(x + w * 0.04)}" cy="${r2(y + h * 1.02)}" r="${r2(Math.min(w, h) * 0.22)}" fill="${p.onPrimary}" opacity="0.06"/></g>`;
}

function upper(s) {
  return String(s || '').toUpperCase();
}

// ---------- review card (3.5 x 2 in) ----------

function reviewCard(f, link, { ox = 0, oy = 0, id = 'c' } = {}) {
  const p = f.palette;
  const W = 336;
  const H = 192;
  const tile = qrTile(link, { x: ox + 196, y: oy + 30, size: 124, r: 10 });
  const name = fit(upper(f.name), { w: 170, max: 9.5, min: 7, weight: 700, lines: 2, ls: 0.12, lh: 1.25 });
  const head = fit('How did we do?', { w: 168, h: 64, max: 30, min: 18, weight: 800, lines: 2, lh: 1.02, ls: -0.02 });
  const body = 'Scan to leave a Google review. It takes a minute and helps neighbors find us.';
  const bodyFit = fit(body, { w: 164, max: 10.5, min: 8, weight: 500, lines: 4, lh: 1.35 });
  const headTop = oy + 26 + textHeight(name.lines.length, name.size, 1.25) + 12;
  const bodyTop = headTop + textHeight(head.lines.length, head.size, 1.02) + 10;
  const thanks = f.firstName ? `Thank you from ${f.firstName}` : 'Thank you!';
  return {
    w: W,
    h: H,
    svg:
      `<g><rect x="${ox}" y="${oy}" width="${W}" height="${H}" fill="${p.primary}"/>` +
      `<clipPath id="${id}"><rect x="${ox}" y="${oy}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#${id})"><circle cx="${ox + W - 10}" cy="${oy + H + 30}" r="92" fill="${p.accent}" opacity="0.28"/></g>` +
      T({ x: ox + 20, top: oy + 26, lines: name.lines, size: name.size, weight: 700, fill: p.onPrimary, ls: 0.12, lh: 1.25, opacity: 0.85 }) +
      T({ x: ox + 20, top: headTop, lines: head.lines, size: head.size, weight: 800, fill: p.onPrimary, lh: 1.02, ls: -0.02 }) +
      T({ x: ox + 20, top: bodyTop, lines: bodyFit.lines, size: bodyFit.size, weight: 500, fill: p.onPrimary, lh: 1.35, opacity: 0.92 }) +
      T({ x: ox + 20, top: oy + H - 26, lines: [thanks], size: 9.5, weight: 700, fill: p.onPrimary, opacity: 0.85 }) +
      tile.svg +
      T({ x: ox + 258, top: oy + 164, lines: ['Point your camera here'], size: 7.5, weight: 600, fill: p.onPrimary, anchor: 'middle', opacity: 0.85 }) +
      '</g>',
    module: tile.module,
  };
}

// 10 cards on letter paper (2 across, 5 down, 0.75 in side and 0.5 in top margins) with crop marks.
function cardSheet(cards) {
  const W = 816;
  const H = 1056;
  const left = 72;
  const top = 48;
  let body = '';
  cards.slice(0, 10).forEach((c, i) => {
    body += c(left + (i % 2) * 336, top + Math.floor(i / 2) * 192, i);
  });
  let marks = '';
  const xs = [left, left + 336, left + 672];
  const ys = [0, 1, 2, 3, 4, 5].map((k) => top + k * 192);
  for (const x of xs) marks += `<line x1="${x}" y1="${top - 30}" x2="${x}" y2="${top - 8}"/><line x1="${x}" y1="${top + 960 + 8}" x2="${x}" y2="${top + 960 + 30}"/>`;
  for (const y of ys) marks += `<line x1="${left - 40}" y1="${y}" x2="${left - 10}" y2="${y}"/><line x1="${left + 672 + 10}" y1="${y}" x2="${left + 672 + 40}" y2="${y}"/>`;
  return doc(W, H, `${body}<g stroke="#9aa0a6" stroke-width="0.75">${marks}</g>`);
}

// ---------- counter sign (letter) ----------

function counterSign(f, link) {
  const p = f.palette;
  const W = 816;
  const H = 1056;
  const M = 36;
  const panelH = 560;
  const name = upper(f.name);
  const head = fit('How did we do?', { w: 640, h: 200, max: 100, min: 60, weight: 800, lines: 2, lh: 0.98, ls: -0.025 });
  const sub = fit('Your Google review helps neighbors find a small local business. It takes about a minute.', { w: 560, max: 26, min: 18, weight: 500, lines: 3, lh: 1.3 });
  const headTop = M + 116;
  const subTop = headTop + textHeight(head.lines.length, head.size, 0.98) + 26;
  const tileSize = 336;
  const subBottom = subTop + textHeight(sub.lines.length, sub.size, 1.3);
  const tileY = Math.min(480, Math.max(M + panelH - 150, subBottom + 34));
  const tile = qrTile(link, { x: (W - tileSize) / 2, y: tileY, size: tileSize, r: 22 });
  const steps = ['Open your phone camera', 'Point it at the code', 'Tap the link to write your review'];
  const stepY = tileY + tileSize + 46;
  let stepSvg = '';
  steps.forEach((s, i) => {
    const cx = M + 120 + i * 252;
    const lines = wrap(s, 190, 17, 600);
    stepSvg += `<circle cx="${cx}" cy="${stepY + 18}" r="18" fill="${p.primary}"/>` + T({ x: cx, top: stepY + 18 - 15 * CAP / 2 - 1, lines: [String(i + 1)], size: 15, weight: 800, fill: p.onPrimary, anchor: 'middle' }) + T({ x: cx, top: stepY + 50, lines, size: 17, weight: 600, fill: p.ink, anchor: 'middle', lh: 1.3 });
  });
  const shadow = `<rect x="${(W - tileSize) / 2 - 10}" y="${tileY - 10}" width="${tileSize + 20}" height="${tileSize + 20}" rx="30" fill="#ffffff" stroke="${p.line}" stroke-width="2"/>`;
  const body =
    `<rect x="${M}" y="${M}" width="${W - 2 * M}" height="${panelH}" rx="28" fill="${p.primary}"/>` +
    decor('cs', { x: M, y: M, w: W - 2 * M, h: panelH, r: 28, p }) +
    iconBadge(f.group.icon, { cx: M + 74, cy: M + 70, r: 26, bg: p.accent, fg: p.onAccent }) +
    T({ x: M + 116, top: M + 63, lines: [name.length > 40 ? name.slice(0, 40) : name], size: 15, weight: 700, fill: p.onPrimary, ls: 0.14 }) +
    T({ x: M + 56, top: headTop, lines: head.lines, size: head.size, weight: 800, fill: p.onPrimary, lh: 0.98, ls: -0.025 }) +
    T({ x: M + 56, top: subTop, lines: sub.lines, size: sub.size, weight: 500, fill: p.onPrimary, lh: 1.3, opacity: 0.9 }) +
    shadow +
    tile.svg +
    stepSvg +
    `<line x1="${M + 56}" y1="${H - M - 70}" x2="${W - M - 56}" y2="${H - M - 70}" stroke="${p.line}" stroke-width="2"/>` +
    T({ x: W / 2, top: H - M - 46, lines: [`Thank you for choosing ${f.name}.`], size: 18, weight: 700, fill: p.ink, anchor: 'middle' });
  return { svg: doc(W, H, body), w: W, h: H, module: tile.module };
}

// ---------- flyer (letter) ----------

function stickerSvg(p, { cx, cy, r, top, big, bottom }) {
  const bigFit = fit(big, { w: r * 1.55, max: r * 0.62, min: r * 0.28, weight: 800, lines: 1, ls: -0.02 });
  const topFit = top ? fit(upper(top), { w: r * 1.45, max: r * 0.13, min: r * 0.09, weight: 700, lines: 2, ls: 0.1, lh: 1.2 }) : null;
  const botFit = bottom ? fit(bottom, { w: r * 1.4, max: r * 0.15, min: r * 0.1, weight: 600, lines: 2, lh: 1.15 }) : null;
  const parts = [];
  const tH = topFit ? textHeight(topFit.lines.length, topFit.size, 1.2) + r * 0.08 : 0;
  const bH = botFit ? r * 0.08 + textHeight(botFit.lines.length, botFit.size, 1.15) : 0;
  const total = tH + bigFit.size * CAP + bH;
  let yy = cy - total / 2;
  if (topFit) {
    parts.push(T({ x: cx, top: yy, lines: topFit.lines, size: topFit.size, weight: 700, fill: p.onAccent, anchor: 'middle', ls: 0.1, lh: 1.2 }));
    yy += tH;
  }
  parts.push(T({ x: cx, top: yy, lines: bigFit.lines, size: bigFit.size, weight: 800, fill: p.onAccent, anchor: 'middle', ls: -0.02 }));
  yy += bigFit.size * CAP + r * 0.08;
  if (botFit) parts.push(T({ x: cx, top: yy, lines: botFit.lines, size: botFit.size, weight: 600, fill: p.onAccent, anchor: 'middle', lh: 1.15 }));
  return `<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="#ffffff"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.accent}"/>${parts.join('')}`;
}

// copy: { eyebrow, headline, sub, bullets: [], offer: { top, big, bottom } | null, cta, area }
function flyer(f, copy, action) {
  const p = f.palette;
  const W = 816;
  const H = 1056;
  const M = 34;
  const PW = W - 2 * M;
  const heroH = 600;
  const hasOffer = !!(copy.offer && copy.offer.big);
  const headW = hasOffer ? PW - 120 : PW - 110;
  const head = fit(copy.headline, { w: headW, h: 300, max: 98, min: 46, weight: 800, lines: 4, lh: 1.0, ls: -0.025 });
  const headTop = M + 128;
  const subTop = headTop + textHeight(head.lines.length, head.size, 1.0) + 34;
  let sub = copy.sub ? fit(copy.sub, { w: hasOffer ? 430 : 560, h: heroH - (subTop - M) - 40, max: 25, min: 16, weight: 500, lines: 3, lh: 1.32 }) : null;
  if (sub && subTop + textHeight(sub.lines.length, sub.size, 1.32) > M + heroH - 30) sub = null;
  let hero =
    `<rect x="${M}" y="${M}" width="${PW}" height="${heroH}" rx="28" fill="${p.primary}"/>` +
    decor('fh', { x: M, y: M, w: PW, h: heroH, r: 28, p }) +
    iconBadge(f.group.icon, { cx: M + 74, cy: M + 72, r: 26, bg: p.accent, fg: p.onAccent }) +
    T({ x: M + 116, top: M + 66, lines: [upper(copy.eyebrow || f.name).slice(0, 52)], size: 14, weight: 700, fill: p.onPrimary, ls: 0.14, opacity: 0.9 }) +
    T({ x: M + 50, top: headTop, lines: head.lines, size: head.size, weight: 800, fill: p.onPrimary, lh: 1.0, ls: -0.025 });
  if (sub) hero += T({ x: M + 50, top: subTop, lines: sub.lines, size: sub.size, weight: 500, fill: p.onPrimary, lh: 1.32, opacity: 0.92 });
  // Drawn last so it sits over both panels.
  const sticker = hasOffer ? stickerSvg(p, { cx: W - M - 128, cy: M + heroH - 40, r: 104, top: copy.offer.top, big: copy.offer.big, bottom: copy.offer.bottom }) : '';

  // Lower card: what you get, the call to action and the QR code.
  const cardY = M + heroH + 22;
  const cardH = H - M - cardY;
  let card = `<rect x="${M}" y="${cardY}" width="${PW}" height="${cardH}" rx="28" fill="${p.surface}"/>`;
  const tileSize = 196;
  const tileX = W - M - 36 - tileSize;
  const tileY = cardY + (hasOffer ? 92 : 40);
  let lx = M + 44;
  let ly = cardY + (hasOffer ? 56 : 46);
  const colW = tileX - lx - 36;
  const bullets = (copy.bullets || []).filter(Boolean).slice(0, 3);
  if (bullets.length) {
    card += T({ x: lx, top: ly, lines: ['WHAT YOU GET'], size: 13, weight: 800, fill: p.primary, ls: 0.14 });
    ly += 34;
    for (const b of bullets) {
      const bf = fit(b, { w: colW - 44, max: 21, min: 15, weight: 600, lines: 2, lh: 1.25 });
      card += check({ x: lx, y: ly - 2, size: 26, bg: p.primary, fg: p.onPrimary }) + T({ x: lx + 40, top: ly + 4, lines: bf.lines, size: bf.size, weight: 600, fill: p.ink, lh: 1.25 });
      ly += Math.max(38, textHeight(bf.lines.length, bf.size, 1.25) + 22);
    }
    ly += 6;
  }
  if (f.phone) {
    const label = action && action.kind === 'text' ? 'Call or text' : 'Call or text';
    card += T({ x: lx, top: ly + 4, lines: [upper(label)], size: 12, weight: 800, fill: p.muted, ls: 0.14 });
    const pf = fit(f.phone.display, { w: colW, max: 40, min: 24, weight: 800, lines: 1, ls: -0.01 });
    card += T({ x: lx, top: ly + 28, lines: pf.lines, size: pf.size, weight: 800, fill: p.ink, ls: -0.01 });
    ly += 28 + pf.size;
  }
  let module = null;
  if (action) {
    const tile = qrTile(action.url, { x: tileX, y: tileY, size: tileSize, r: 18 });
    module = tile.module;
    card += `<rect x="${tileX - 8}" y="${tileY - 8}" width="${tileSize + 16}" height="${tileSize + 16}" rx="24" fill="#ffffff" stroke="${p.line}" stroke-width="2"/>` + tile.svg;
    const cta = copy.cta || action.label;
    card += T({ x: tileX + tileSize / 2, top: tileY + tileSize + 22, lines: [cta], size: 17, weight: 800, fill: p.ink, anchor: 'middle' });
    if (action.short) card += T({ x: tileX + tileSize / 2, top: tileY + tileSize + 46, lines: [action.short.slice(0, 34)], size: 12.5, weight: 600, fill: p.muted, anchor: 'middle' });
  }
  const foot = copy.area ? `Serving ${copy.area}` : f.name;
  const ff = fit(foot, { w: PW - 88, max: 14, min: 10, weight: 600, lines: 1 });
  card += T({ x: M + 44, top: H - M - 38, lines: ff.lines, size: ff.size, weight: 600, fill: p.muted });
  return { svg: doc(W, H, hero + card + sticker), w: W, h: H, module };
}

// ---------- door hanger (4.25 x 11 in) ----------

function doorHanger(f, copy, action, { ox = 0, id = 'dh' } = {}) {
  const p = f.palette;
  const W = 408;
  const H = 1056;
  const holeY = 116;
  const panelH = 640;
  const hasOffer = !!(copy.offer && copy.offer.big);
  const head = fit(copy.headline, { w: W - 76, h: hasOffer ? 200 : 250, max: hasOffer ? 54 : 60, min: 30, weight: 800, lines: 5, lh: 1.0, ls: -0.025 });
  const headTop = 268;
  const subTop = headTop + textHeight(head.lines.length, head.size, 1.0) + 24;
  // Keep the line clear of the offer sticker that sits on the panel edge.
  const subAvail = (hasOffer ? panelH - 6 - 83 - 14 : panelH - 30) - subTop;
  let sub = copy.sub && subAvail > 20 ? fit(copy.sub, { w: W - 84, h: subAvail, max: 18, min: 12, weight: 500, lines: 3, lh: 1.32 }) : null;
  if (sub && textHeight(sub.lines.length, sub.size, 1.32) > subAvail) sub = null;
  let s = `<rect x="${ox}" y="0" width="${W}" height="${panelH}" fill="${p.primary}"/>`;
  s += `<clipPath id="${id}"><rect x="${ox}" y="0" width="${W}" height="${panelH}"/></clipPath><g clip-path="url(#${id})"><circle cx="${ox + W - 10}" cy="${panelH - 40}" r="170" fill="${p.accent}" opacity="0.22"/><circle cx="${ox + 20}" cy="40" r="120" fill="${p.onPrimary}" opacity="0.06"/></g>`;
  // Hole (cut along the dashed line) with a slit up to the top edge.
  s += `<circle cx="${ox + W / 2}" cy="${holeY}" r="60" fill="#ffffff" stroke="${p.onPrimary}" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  s += `<line x1="${ox + W / 2 - 42}" y1="${holeY - 42}" x2="${ox + W / 2 - 110}" y2="0" stroke="${p.onPrimary}" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  s += T({ x: ox + 38, top: 212, lines: [upper(copy.eyebrow || 'Hi neighbor')], size: 13, weight: 800, fill: p.onPrimary, ls: 0.16, opacity: 0.9 });
  s += T({ x: ox + 38, top: headTop, lines: head.lines, size: head.size, weight: 800, fill: p.onPrimary, lh: 1.0, ls: -0.025 });
  if (sub) s += T({ x: ox + 38, top: subTop, lines: sub.lines, size: sub.size, weight: 500, fill: p.onPrimary, lh: 1.32, opacity: 0.92 });
  if (hasOffer) s += stickerSvg(p, { cx: ox + W - 104, cy: panelH - 6, r: 76, top: copy.offer.top, big: copy.offer.big, bottom: copy.offer.bottom });
  let y = panelH + (hasOffer ? 84 : 44);
  const bullets = (copy.bullets || []).filter(Boolean).slice(0, 3);
  for (const b of bullets) {
    const bf = fit(b, { w: W - 112, max: 16, min: 12, weight: 600, lines: 2, lh: 1.25 });
    s += check({ x: ox + 38, y: y - 3, size: 22, bg: p.primary, fg: p.onPrimary }) + T({ x: ox + 72, top: y + 2, lines: bf.lines, size: bf.size, weight: 600, fill: p.ink, lh: 1.25 });
    y += Math.max(32, textHeight(bf.lines.length, bf.size, 1.25) + 18);
  }
  let module = null;
  const tileSize = 132;
  const tileY = H - 36 - tileSize - 34;
  if (action) {
    const tile = qrTile(action.url, { x: ox + 38, y: tileY, size: tileSize, r: 14 });
    module = tile.module;
    s += `<rect x="${ox + 32}" y="${tileY - 6}" width="${tileSize + 12}" height="${tileSize + 12}" rx="18" fill="#ffffff" stroke="${p.line}" stroke-width="2"/>` + tile.svg;
  }
  const rx = action ? ox + 38 + tileSize + 22 : ox + 38;
  const rw = W - (rx - ox) - 30;
  let ry = tileY + 6;
  if (action) {
    s += T({ x: rx, top: ry, lines: wrap(copy.cta || action.label, rw, 16, 800), size: 16, weight: 800, fill: p.ink, lh: 1.2 });
    ry += 44;
  }
  if (f.phone) {
    const pf = fit(f.phone.display, { w: rw, max: 24, min: 14, weight: 800, lines: 1 });
    s += T({ x: rx, top: ry, lines: ['CALL OR TEXT'], size: 10, weight: 800, fill: p.muted, ls: 0.14 });
    s += T({ x: rx, top: ry + 18, lines: pf.lines, size: pf.size, weight: 800, fill: p.ink });
    ry += 18 + pf.size + 14;
  }
  const nf = fit(f.name, { w: rw, max: 13, min: 9, weight: 700, lines: 2, lh: 1.2 });
  s += T({ x: rx, top: ry, lines: nf.lines, size: nf.size, weight: 700, fill: p.muted, lh: 1.2 });
  const foot = copy.area ? `Serving ${copy.area}` : '';
  if (foot) s += T({ x: ox + 38, top: H - 30, lines: [fit(foot, { w: W - 76, max: 11, min: 8, weight: 600, lines: 1 }).lines[0]], size: fit(foot, { w: W - 76, max: 11, min: 8, weight: 600, lines: 1 }).size, weight: 600, fill: p.muted });
  return { svg: s, w: W, h: H, module };
}

function doorHangerSingle(f, copy, action) {
  const d = doorHanger(f, copy, action);
  return { svg: doc(d.w, d.h, d.svg), w: d.w, h: d.h, module: d.module };
}

// Two door hangers side by side on letter paper; cut down the middle and around the holes.
function doorHangerSheet(f, copy, action) {
  const a = doorHanger(f, copy, action, { ox: 0, id: 'dha' });
  const b = doorHanger(f, copy, action, { ox: 408, id: 'dhb' });
  const cut = `<line x1="408" y1="0" x2="408" y2="1056" stroke="#9aa0a6" stroke-width="1" stroke-dasharray="7 6"/>`;
  return { svg: doc(816, 1056, a.svg + b.svg + cut), w: 816, h: 1056, module: a.module };
}

// ---------- EDDM postcard (9 x 6.25 in) ----------

function postcardFront(f, copy) {
  const p = f.palette;
  const W = 864;
  const H = 600;
  const hasOffer = !!(copy.offer && copy.offer.big);
  const head = fit(copy.headline, { w: hasOffer ? 540 : 700, h: 300, max: 92, min: 44, weight: 800, lines: 4, lh: 1.0, ls: -0.025 });
  const headTop = 132;
  const subTop = headTop + textHeight(head.lines.length, head.size, 1.0) + 28;
  const sub = copy.sub ? fit(copy.sub, { w: 520, h: H - subTop - 50, max: 24, min: 15, weight: 500, lines: 2, lh: 1.3 }) : null;
  let s = decor('pf', { x: 0, y: 0, w: W, h: H, r: 0, p });
  s += iconBadge(f.group.icon, { cx: 76, cy: 72, r: 26, bg: p.accent, fg: p.onAccent });
  s += T({ x: 118, top: 66, lines: [upper(copy.eyebrow || f.name).slice(0, 56)], size: 14, weight: 700, fill: p.onPrimary, ls: 0.14, opacity: 0.9 });
  s += T({ x: 52, top: headTop, lines: head.lines, size: head.size, weight: 800, fill: p.onPrimary, lh: 1.0, ls: -0.025 });
  if (sub) s += T({ x: 52, top: subTop, lines: sub.lines, size: sub.size, weight: 500, fill: p.onPrimary, lh: 1.3, opacity: 0.92 });
  if (hasOffer) s += stickerSvg(p, { cx: W - 150, cy: H - 170, r: 112, top: copy.offer.top, big: copy.offer.big, bottom: copy.offer.bottom });
  return { svg: doc(W, H, s, { bg: p.primary }), w: W, h: H };
}

function postcardBack(f, copy, action, { eddm = true } = {}) {
  const p = f.palette;
  const W = 864;
  const H = 600;
  const LW = 470;
  let s = `<rect x="0" y="0" width="${LW}" height="${H}" fill="${p.surface}"/>`;
  s += T({ x: 40, top: 46, lines: [upper(f.name).slice(0, 40)], size: 13, weight: 800, fill: p.primary, ls: 0.14 });
  const head = fit(copy.backline || copy.headline, { w: LW - 80, max: 34, min: 20, weight: 800, lines: 3, lh: 1.05, ls: -0.02 });
  s += T({ x: 40, top: 80, lines: head.lines, size: head.size, weight: 800, fill: p.ink, lh: 1.05, ls: -0.02 });
  let y = 80 + textHeight(head.lines.length, head.size, 1.05) + 28;
  for (const b of (copy.bullets || []).filter(Boolean).slice(0, 3)) {
    const bf = fit(b, { w: LW - 120, max: 16, min: 12, weight: 600, lines: 2, lh: 1.25 });
    s += check({ x: 40, y: y - 3, size: 22, bg: p.primary, fg: p.onPrimary }) + T({ x: 74, top: y + 2, lines: bf.lines, size: bf.size, weight: 600, fill: p.ink, lh: 1.25 });
    y += Math.max(32, textHeight(bf.lines.length, bf.size, 1.25) + 16);
  }
  let module = null;
  const tileSize = 140;
  const tileY = H - 40 - tileSize;
  if (action) {
    const tile = qrTile(action.url, { x: 40, y: tileY, size: tileSize, r: 14 });
    module = tile.module;
    s += `<rect x="34" y="${tileY - 6}" width="${tileSize + 12}" height="${tileSize + 12}" rx="18" fill="#ffffff" stroke="${p.line}" stroke-width="2"/>` + tile.svg;
    s += T({ x: 40 + tileSize + 24, top: tileY + 10, lines: [copy.cta || action.label], size: 17, weight: 800, fill: p.ink });
    if (action.short) s += T({ x: 40 + tileSize + 24, top: tileY + 36, lines: [action.short.slice(0, 30)], size: 12, weight: 600, fill: p.muted });
  }
  if (f.phone) {
    const px = action ? 40 + tileSize + 24 : 40;
    s += T({ x: px, top: tileY + 72, lines: ['CALL OR TEXT'], size: 10, weight: 800, fill: p.muted, ls: 0.14 });
    s += T({ x: px, top: tileY + 90, lines: [f.phone.display], size: 26, weight: 800, fill: p.ink });
  }
  if (eddm) {
    // EDDM Retail indicia: top right, inside 1.625 in from the right edge and 1.375 in from the top.
    const bx = W - 12 - 132;
    s += `<rect x="${bx}" y="14" width="132" height="100" fill="none" stroke="#111111" stroke-width="1.5"/>`;
    s += T({ x: bx + 66, top: 26, lines: ['PRSRT STD', 'ECRWSS', 'U.S. POSTAGE', 'PAID', 'EDDM RETAIL'], size: 11, weight: 700, fill: '#111111', anchor: 'middle', lh: 1.45 });
    s += T({ x: W - 300, top: 250, lines: ['POSTAL CUSTOMER'], size: 16, weight: 700, fill: '#111111', ls: 0.06 });
  }
  return { svg: doc(W, H, s), w: W, h: H, module };
}

module.exports = { FONT, IN, CAP, width, wrap, fit, T, qrTile, reviewCard, cardSheet, counterSign, flyer, doorHangerSingle, doorHangerSheet, postcardFront, postcardBack, doc };
