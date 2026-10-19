// Six logo concepts drawn as real paths (the kit's stroke alphabet and line icons), so they look the
// same in every browser, phone and print shop and never depend on an installed font.
//
//   concepts(spec)            -> [{ id, title, note, logo: { body, w, h }, mark: { body, size } }]
//   draw(id, spec, variant)   -> one concept in 'color' (on a light page), 'reverse' (on the main
//                                color) or 'mono' (one ink color)
//   logoSvg / markSvg / presentSvg / overviewSvg: standalone SVG files for saving and rendering
//
// spec: { name, descriptor, city, icon, colors (palette from palettes.js), mood }
// Everything is in local units with the origin top-left; files scale them.

const svg = require('../../_kit/svg');
const { text, color } = require('../../_kit');

const r2 = (n) => Math.round(n * 100) / 100;

// Words that describe the trade rather than name the business ("Reyes Mobile Detailing" ->
// main "Reyes", sub "Mobile Detailing").
const TRADE = new Set(('detailing detail mobile car auto spa care cleaning clean co company studio lawn yard landscaping pet pets dog sitting walking ' +
  'photography photo portraits media design web digital sites exteriors exterior wash washing pressure power window windows home house ' +
  'housekeeping tutoring learning lessons training fitness strength coaching consulting advisory partners florals flowers botanicals events ' +
  'rentals sound party goods supply apparel clothing jewelry vintage finds kitchen eats provisions roasters coffee cafe bakehouse bakery bake ' +
  'sweets salon beauty bar handyman repair repairs builders services templates paper social creative automation tech candle candles scents ' +
  'and the of').split(' '));

// The line under the name: what they sell, never a stand-in like "Small Business" (spec.known false).
const subOf = (spec) => (spec && spec.known === false ? '' : (spec && spec.descriptor) || '');

function splitName(name, descriptor) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  let cut = words.length;
  while (cut > 1 && TRADE.has(words[cut - 1].toLowerCase().replace(/[^a-z]/g, ''))) cut--;
  if (cut === words.length || cut === 0) return { main: words.join(' '), sub: String(descriptor || '').trim() };
  // Never leave a dangling "and" or "the" at the end of the main part.
  while (cut > 1 && /^(and|the|of|&)$/i.test(words[cut - 1])) cut--;
  return { main: words.slice(0, cut).join(' '), sub: words.slice(cut).join(' ') };
}

function initialsOf(main) {
  const words = String(main || '').split(/\s+/).filter((w) => w && !/^(the|and|of|by|co|&)$/i.test(w));
  const letters = words.map((w) => svg.drawable(w).replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase()).filter(Boolean);
  return (letters.length ? letters : ['A']).slice(0, 2).join('');
}

// ---------- type metrics ----------

const ASC = new Set('bdfhkl'.split(''));
function extents(str) {
  const s = svg.drawable(str);
  let top = 36;
  let bottom = 100;
  for (const ch of s) {
    if (ch === ' ') continue;
    if (/[A-Z0-9'!?&/:+]/.test(ch) || ASC.has(ch)) top = 0;
    else if (ch === 't') top = Math.min(top, 8);
    else if (ch === 'i' || ch === 'j') top = Math.min(top, 12);
    if (/[gjpqy]/.test(ch)) bottom = 128;
    else if (ch === ',') bottom = Math.max(bottom, 112);
  }
  return { top: top / 100, bottom: bottom / 100 };
}

// Stroke text placed so its visible ink starts at (x, y) top-left. Returns { svg, w, h }.
function word(str, { x = 0, y = 0, size, weight, tracking, color: fill, cap = 'round', anchor = 'start' }) {
  const e = extents(str);
  const t = svg.strokeText(str, { x, y: y - e.top * size, size, weight, tracking, color: fill, cap, anchor });
  return { svg: t.svg, w: t.width, h: (e.bottom - e.top) * size, top: e.top, size };
}

function widthOf(str, size, weight, tracking) {
  return svg.strokeTextWidth(str, { size, weight, tracking });
}

// ---------- style per mood ----------

const STYLE = {
  bold: { cap: 'square', weight: 0.16, badge: 'square', wordCase: 'upper', tracking: 0.04 },
  clean: { cap: 'square', weight: 0.11, badge: 'square', wordCase: 'lower', tracking: 0.02 },
  premium: { cap: 'square', weight: 0.075, badge: 'ring', wordCase: 'upper', tracking: 0.26 },
  playful: { cap: 'round', weight: 0.16, badge: 'circle', wordCase: 'lower', tracking: 0.02 },
  fresh: { cap: 'round', weight: 0.13, badge: 'circle', wordCase: 'lower', tracking: 0.03 },
  warm: { cap: 'round', weight: 0.13, badge: 'arch', wordCase: 'title', tracking: 0.04 },
  calm: { cap: 'round', weight: 0.1, badge: 'circle', wordCase: 'title', tracking: 0.06 },
  earthy: { cap: 'round', weight: 0.12, badge: 'arch', wordCase: 'title', tracking: 0.05 },
};

function cased(str, how) {
  if (how === 'upper') return str.toUpperCase();
  if (how === 'lower') return str.toLowerCase();
  return str;
}

// Colors for a variant: what draws the mark, the name, the small line, the accent, and a filled
// shape with what goes on it.
function paint(colors, variant) {
  const c = colors;
  if (variant === 'reverse') {
    const accentOk = color.contrast(c.accent, c.primary) >= 2;
    return { mark: c.onPrimary, text: c.onPrimary, sub: c.onPrimary, subOpacity: 0.82, accent: accentOk ? c.accent : c.onPrimary, fill: c.onPrimary, onFill: c.primary, bg: c.primary };
  }
  if (variant === 'mono') return { mark: c.ink, text: c.ink, sub: c.ink, subOpacity: 0.75, accent: c.ink, fill: c.ink, onFill: c.paper, bg: c.paper };
  return { mark: c.primary, text: c.ink, sub: c.muted, subOpacity: 1, accent: c.accent, fill: c.primary, onFill: c.onPrimary, bg: c.paper };
}

// ---------- shapes ----------

function badgeShape(kind, S, fill) {
  if (kind === 'square') return svg.rect({ x: 0, y: 0, w: S, h: S, r: S * 0.24, fill });
  if (kind === 'arch') {
    const r = S / 2;
    const k = S * 0.08;
    return svg.path({ d: `M0 ${r}A${r} ${r} 0 0 1 ${S} ${r}V${S - k}Q${S} ${S} ${S - k} ${S}H${k}Q0 ${S} 0 ${S - k}Z`, fill });
  }
  return svg.circle({ cx: S / 2, cy: S / 2, r: S / 2, fill });
}

// Letters centered in a box of size S (optical center a touch above the middle).
function centeredLetters(str, S, { maxW, maxH, weight, cap, fill, tracking = 0.04 }) {
  const fit = svg.fitStrokeText(str, { width: maxW, maxSize: maxH, minSize: 8, weight, tracking });
  const size = fit.size;
  const e = extents(str);
  const h = (e.bottom - e.top) * size;
  const y = (S - h) / 2 - S * 0.01;
  return word(str, { x: S / 2, y, size, weight, tracking, color: fill, cap, anchor: 'middle' }).svg;
}

// ---------- the six concepts ----------

function monogram(spec, p, st) {
  const { main, sub } = splitName(spec.name, subOf(spec));
  const ini = initialsOf(main);
  const S = 240;
  const kind = st.badge;
  let badge = '';
  if (kind === 'ring') {
    badge += svg.circle({ cx: S / 2, cy: S / 2, r: S / 2 - 2, fill: 'none', stroke: p.mark, strokeWidth: 4 });
    badge += svg.circle({ cx: S / 2, cy: S / 2, r: S / 2 - 16, fill: 'none', stroke: p.mark, strokeWidth: 1.6 });
    badge += centeredLetters(ini, S, { maxW: S * (ini.length > 1 ? 0.5 : 0.36), maxH: S * (ini.length > 1 ? 0.3 : 0.38), weight: 0.07, cap: 'square', fill: p.mark, tracking: 0.12 });
  } else {
    badge += badgeShape(kind, S, p.fill);
    const ty = kind === 'arch' ? S * 0.06 : 0;
    badge += svg.group(centeredLetters(ini, S, { maxW: S * (ini.length > 1 ? 0.6 : 0.44), maxH: S * (ini.length > 1 ? 0.38 : 0.46), weight: Math.max(0.13, st.weight), cap: st.cap, fill: p.onFill, tracking: 0.06 }), { transform: `translate(0 ${r2(ty)})` });
  }
  // Name under the badge, tracked caps.
  const nameStr = main.toUpperCase();
  const nameSize = Math.min(34, (S * 1.5) / Math.max(1, widthOf(nameStr, 1, 0.1, 0.18)));
  const nw = widthOf(nameStr, nameSize, 0.1, 0.18);
  const subStr = (sub || '').toUpperCase();
  const subSize = 15;
  const sw = subStr ? widthOf(subStr, subSize, 0.1, 0.34) : 0;
  const W = Math.max(S, nw, sw);
  const cx = W / 2;
  let body = svg.group(badge, { transform: `translate(${r2(cx - S / 2)} 0)` });
  const ny = S + 30;
  body += word(nameStr, { x: cx, y: ny, size: nameSize, weight: 0.1, tracking: 0.18, color: p.text, cap: st.cap, anchor: 'middle' }).svg;
  let H = ny + nameSize;
  if (subStr) {
    const sy = H + 14;
    body += `<g opacity="${p.subOpacity}">${word(subStr, { x: cx, y: sy, size: subSize, weight: 0.1, tracking: 0.34, color: p.sub, cap: st.cap, anchor: 'middle' }).svg}</g>`;
    H = sy + subSize;
  }
  return { logo: { body, w: W, h: H }, mark: { body: badge, size: S } };
}

// Geometric symbols on a 200 grid.
function geometry(kind, p, ini, st) {
  const S = 200;
  const a = p.mark;
  const b = p.accent;
  if (kind === 'tiles') {
    // Four cells: three quarter discs and a square, like a small pinwheel.
    const g = 12;
    const h = (S - g) / 2;
    return (
      svg.path({ d: svg.wedgePath(h, h, h, 270, 360), fill: a }) +
      svg.rect({ x: h + g, y: 0, w: h, h, fill: a }) +
      svg.path({ d: svg.wedgePath(h, h + g, h, 180, 270), fill: b }) +
      svg.path({ d: svg.wedgePath(h + g, h + g, h, 90, 180), fill: a })
    );
  }
  if (kind === 'split') {
    // A circle cut in two with a clean gap, turned a little.
    const g = 14;
    const r = S / 2 - g / 2;
    const c = S / 2;
    return svg.group(
      svg.path({ d: `M${r2(c - g / 2)} ${r2(c - r)}A${r2(r)} ${r2(r)} 0 0 0 ${r2(c - g / 2)} ${r2(c + r)}Z`, fill: a }) +
        svg.path({ d: `M${r2(c + g / 2)} ${r2(c - r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(c + g / 2)} ${r2(c + r)}Z`, fill: b }),
      { transform: `rotate(-35 ${c} ${c})` }
    );
  }
  if (kind === 'rise') {
    // A rising sun: two arcs, a half disc and a horizon line, centered in the square.
    const w = S * 0.085;
    const ro = S / 2;
    const gapBar = S * 0.07;
    const total = ro + w / 2 + gapBar + w;
    const base = (S - total) / 2 + ro;
    const cx = S / 2;
    let out = '';
    out += svg.path({ d: svg.arcPath(cx, base, ro - w / 2, 270, 90), fill: 'none', stroke: a, strokeWidth: w, linecap: 'round' });
    out += svg.path({ d: svg.arcPath(cx, base, (ro - w / 2) * 0.64, 270, 90), fill: 'none', stroke: a, strokeWidth: w, linecap: 'round' });
    const sun = (ro - w / 2) * 0.3;
    out += svg.path({ d: `M${r2(cx - sun)} ${r2(base)}A${r2(sun)} ${r2(sun)} 0 0 1 ${r2(cx + sun)} ${r2(base)}Z`, fill: b });
    out += svg.rect({ x: 0, y: base + w / 2 + gapBar, w: S, h: w, r: w / 2, fill: a });
    return out;
  }
  if (kind === 'petal') {
    // A leaf: a square with two opposite corners fully rounded, and a vein cut through it.
    const r = S * 0.5;
    const vein = S * 0.06;
    return (
      svg.path({ d: `M0 ${S}V${r}A${r} ${r} 0 0 1 ${r} 0H${S}V${r}A${r} ${r} 0 0 1 ${r} ${S}Z`, fill: a }) +
      svg.path({ d: `M${r2(S * 0.2)} ${r2(S * 0.8)}L${r2(S * 0.72)} ${r2(S * 0.28)}`, fill: 'none', stroke: p.bg, strokeWidth: vein, linecap: 'round' })
    );
  }
  if (kind === 'stack') {
    const h = S * 0.22;
    const g = (S - h * 3) / 2;
    return (
      svg.rect({ x: 0, y: 0, w: S, h, r: h / 2, fill: a }) +
      svg.rect({ x: S * 0.18, y: h + g, w: S * 0.82, h, r: h / 2, fill: a }) +
      svg.rect({ x: S * 0.36, y: (h + g) * 2, w: S * 0.64, h, r: h / 2, fill: b })
    );
  }
  // orbit: a ring with the initial inside and a dot riding the ring.
  const w = S * 0.075;
  const [dx, dy] = svg.onCircle(S / 2, S / 2, S / 2 - w / 2, 45);
  return (
    svg.circle({ cx: S / 2, cy: S / 2, r: S / 2 - w / 2, fill: 'none', stroke: a, strokeWidth: w }) +
    centeredLetters(ini.charAt(0), S, { maxW: S * 0.4, maxH: S * 0.44, weight: Math.max(0.13, st.weight), cap: st.cap, fill: a }) +
    svg.circle({ cx: dx, cy: dy, r: w * 1.25, fill: b })
  );
}

const GEOMS = ['tiles', 'split', 'rise', 'petal', 'stack', 'orbit'];
const GEOM_FOR_MOOD = { bold: ['tiles', 'stack', 'split'], clean: ['split', 'tiles', 'orbit'], premium: ['orbit', 'rise', 'split'], playful: ['petal', 'tiles', 'orbit'], fresh: ['petal', 'rise', 'split'], warm: ['rise', 'petal', 'orbit'], calm: ['rise', 'orbit', 'petal'], earthy: ['petal', 'rise', 'stack'] };

// Mark on the left, name and line on the right.
function sideLockup(markBody, S, spec, p, st, { nameCase = 'title', nameWeight, trackingName = 0.03 } = {}) {
  const { main, sub } = splitName(spec.name, subOf(spec));
  const nameStr = nameCase === 'upper' ? main.toUpperCase() : main;
  const e = extents(nameStr);
  const size = S * 0.34;
  const nameH = (e.bottom - e.top) * size;
  const subStr = (sub || '').toUpperCase();
  const subSize = S * 0.1;
  const gap = subStr ? S * 0.12 : 0;
  const blockH = nameH + (subStr ? gap + subSize : 0);
  const x = S * 1.2;
  const y0 = (S - blockH) / 2;
  let body = markBody;
  const n = word(nameStr, { x, y: y0, size, weight: nameWeight || st.weight, tracking: trackingName, color: p.text, cap: st.cap });
  body += n.svg;
  let w = x + n.w;
  if (subStr) {
    const s = word(subStr, { x: x + 2, y: y0 + nameH + gap, size: subSize, weight: 0.12, tracking: 0.34, color: p.sub, cap: st.cap });
    body += `<g opacity="${p.subOpacity}">${s.svg}</g>`;
    w = Math.max(w, x + 2 + s.w);
  }
  return { body, w, h: S };
}

function geometric(spec, p, st, seedIndex = 0) {
  const { main } = splitName(spec.name, subOf(spec));
  const ini = initialsOf(main);
  const choices = GEOM_FOR_MOOD[spec.mood] || GEOMS;
  const kind = choices[(text.hash(spec.name) + seedIndex) % choices.length];
  const S = 200;
  const mark = geometry(kind, p, ini, st);
  return { logo: sideLockup(mark, S, spec, p, st), mark: { body: mark, size: S }, kind };
}

function wordmark(spec, p, st) {
  const { main, sub } = splitName(spec.name, subOf(spec));
  const oneWord = !/\s/.test(main);
  const how = st.wordCase === 'lower' && !oneWord ? 'title' : st.wordCase;
  const str = cased(main, how);
  const size = 120;
  const tracking = st.tracking;
  const e = extents(str);
  const n = word(str, { x: 0, y: 0, size, weight: st.weight, tracking, color: p.text, cap: st.cap });
  let body = n.svg;
  let W = n.w;
  let H = n.h;
  const detail = ['dot', 'bar', 'first'][text.hash(`${spec.name}w`) % 3];
  const sw = st.weight * size;
  const premiumLayout = spec.mood === 'premium';
  if (premiumLayout) {
    // Thin, widely spaced capitals need no extra detail; the rule under them carries the accent.
  } else if (detail === 'dot' || st.wordCase === 'upper') {
    // A dot in the accent color sitting on the baseline, like a full stop.
    const r = Math.max(sw * 0.75, 7);
    const cx = W + r + sw * 0.6;
    const cy = (1 - e.top) * size - r;
    body += svg.circle({ cx, cy, r, fill: p.accent });
    W = cx + r;
  } else if (detail === 'bar') {
    const first = str.split(' ')[0];
    const fw = widthOf(first, size, st.weight, tracking);
    const by = H + size * 0.12;
    body += svg.rect({ x: 0, y: by, w: fw, h: Math.max(sw * 0.7, 8), r: Math.max(sw * 0.35, 4), fill: p.accent });
    H = by + Math.max(sw * 0.7, 8);
  } else {
    // First letter in the main color, the rest in the text color, spacing kept from one layout.
    const d = svg.drawable(str);
    const lay = svg.glyphLayout(d, { weight: st.weight, tracking });
    const restX = lay.items[1] ? (lay.items[1].x * size) / 100 : 0;
    body = word(d.charAt(0), { x: 0, y: 0, size, weight: st.weight, tracking, color: p.mark, cap: st.cap }).svg;
    if (d.length > 1) body += svg.strokeText(d.slice(1), { x: restX, y: -e.top * size, size, weight: st.weight, tracking, color: p.text, cap: st.cap }).svg;
  }
  if (sub) {
    const subSize = Math.max(size * 0.15, Math.min(size * 0.3, W * 0.034));
    const subStr = sub.toUpperCase();
    if (premiumLayout) {
      // Centered: name, a short rule in the accent color, then the line.
      const ruleW = Math.max(W * 0.12, 40);
      const ry = H + size * 0.24;
      body += svg.rect({ x: (W - ruleW) / 2, y: ry, w: ruleW, h: Math.max(sw * 0.6, 3), fill: p.accent });
      const s = word(subStr, { x: W / 2, y: ry + size * 0.26, size: subSize, weight: 0.1, tracking: 0.42, color: p.sub, cap: st.cap, anchor: 'middle' });
      body += `<g opacity="${p.subOpacity}">${s.svg}</g>`;
      H = ry + size * 0.26 + subSize;
    } else {
      const s = word(subStr, { x: 2, y: H + size * 0.22, size: subSize, weight: 0.12, tracking: 0.36, color: p.sub, cap: st.cap });
      body += `<g opacity="${p.subOpacity}">${s.svg}</g>`;
      W = Math.max(W, 2 + s.w);
      H = H + size * 0.22 + subSize;
    }
  }
  // Mark: the first letter in a rounded tile.
  const S = 200;
  const letter = cased(svg.drawable(main).charAt(0), how === 'lower' ? 'lower' : 'upper');
  const mark = badgeShape(st.badge === 'circle' ? 'circle' : 'square', S, p.fill) + centeredLetters(letter, S, { maxW: S * 0.5, maxH: S * 0.5, weight: Math.max(0.14, st.weight), cap: st.cap, fill: p.onFill });
  return { logo: { body, w: W, h: H }, mark: { body: mark, size: S } };
}

function iconName(spec, p, st) {
  const S = 200;
  const tile = svg.rect({ x: 0, y: 0, w: S, h: S, r: S * 0.26, fill: p.fill }) + svg.icon(spec.icon || 'sparkle', { x: S * 0.2, y: S * 0.2, size: S * 0.6, color: p.onFill, weight: 1.9 });
  return { logo: sideLockup(tile, S, spec, p, st, { nameWeight: Math.max(0.12, st.weight) }), mark: { body: tile, size: S } };
}

function seal(spec, p, st) {
  const { main, sub } = splitName(spec.name, subOf(spec));
  const D = 400;
  const R = D / 2;
  const ring = 12;
  let body = '';
  body += svg.circle({ cx: R, cy: R, r: R - ring / 2, fill: 'none', stroke: p.mark, strokeWidth: ring });
  const inner = R - 88;
  body += svg.circle({ cx: R, cy: R, r: inner, fill: 'none', stroke: p.mark, strokeWidth: 3.2 });
  const band = R - ring - inner;
  const mid = inner + band / 2;
  const topStr = main.toUpperCase();
  const bottomStr = String(spec.city ? String(spec.city).split(',')[0] : sub || '').toUpperCase();
  const tw = Math.max(0.1, Math.min(0.13, st.weight));
  // The letters' angle is their width over the band's middle radius, so the biggest size that
  // keeps a line inside `span` degrees is span * mid / width-per-px, capped by the band.
  const fitArc = (str, span, tracking) => {
    const unit = widthOf(str, 1, tw, tracking);
    return Math.max(12, Math.min(band * 0.5, ((span * Math.PI) / 180) * mid / Math.max(unit, 0.01)));
  };
  const ts = fitArc(topStr, 128, 0.14);
  body += svg.strokeTextArc(topStr, { cx: R, cy: R, r: inner + (band - ts) / 2, size: ts, weight: tw, tracking: 0.14, color: p.text, cap: st.cap, side: 'top' });
  if (bottomStr) {
    const bs = Math.min(ts * 0.8, fitArc(bottomStr, 100, 0.2));
    body += svg.strokeTextArc(bottomStr, { cx: R, cy: R, r: inner + (band - bs) / 2, size: bs, weight: tw, tracking: 0.2, color: p.text, cap: st.cap, side: 'bottom' });
  }
  // Two dots where the top and bottom lines meet.
  for (const deg of [-90, 90]) {
    const [x, y] = svg.onCircle(R, R, mid, deg);
    body += svg.circle({ cx: x, cy: y, r: 8, fill: p.accent });
  }
  if (spec.icon) {
    const iconSize = inner * 1.2;
    body += svg.icon(spec.icon, { x: R - iconSize / 2, y: R - iconSize / 2, size: iconSize, color: p.mark, weight: 1.7 });
  } else {
    body += svg.group(centeredLetters(initialsOf(main), inner * 2, { maxW: inner, maxH: inner * 0.6, weight: 0.12, cap: st.cap, fill: p.mark }), { transform: `translate(${R - inner} ${R - inner})` });
  }
  const S = 200;
  const mark = svg.circle({ cx: S / 2, cy: S / 2, r: S / 2, fill: p.fill }) + svg.icon(spec.icon || 'sparkle', { x: S * 0.2, y: S * 0.2, size: S * 0.6, color: p.onFill, weight: 2.1 });
  return { logo: { body, w: D, h: D }, mark: { body: mark, size: S } };
}

function stacked(spec, p, st) {
  const { main, sub } = splitName(spec.name, subOf(spec));
  const words = main.toUpperCase().split(/\s+/).filter(Boolean);
  let lines;
  if (words.length >= 2) {
    // Two lines, as even as possible.
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const diff = Math.abs(a.length - b.length);
      if (!best || diff < best.diff) best = { a, b, diff };
    }
    lines = [best.a, best.b];
  } else {
    lines = [words[0] || main.toUpperCase(), String(sub || subOf(spec) || '').toUpperCase()].filter(Boolean);
  }
  const weight = Math.max(0.15, st.weight + 0.03);
  const size = 110;
  const gap = size * 0.3;
  const bar = size * 0.2;
  const x = bar + size * 0.32;
  let body = '';
  let y = 0;
  let W = 0;
  lines.forEach((ln, i) => {
    const small = words.length < 2 && i === 1;
    const sz = small ? size * 0.36 : size;
    const t = word(ln, { x, y, size: sz, weight: small ? 0.12 : weight, tracking: small ? 0.3 : 0.05, color: i === 0 ? p.text : p.mark, cap: 'square' });
    body += t.svg;
    W = Math.max(W, x + t.w);
    y += sz + (small ? 0 : gap);
  });
  if (words.length >= 2) y -= gap;
  const H = y;
  body = svg.rect({ x: 0, y: 0, w: bar, h: H, r: st.cap === 'round' ? bar / 2 : 0, fill: p.accent }) + body;
  if (sub && words.length >= 2) {
    const s = word(sub.toUpperCase(), { x, y: H + size * 0.3, size: size * 0.15, weight: 0.12, tracking: 0.34, color: p.sub, cap: 'square' });
    body += `<g opacity="${p.subOpacity}">${s.svg}</g>`;
    W = Math.max(W, x + s.w);
    return { logo: { body, w: W, h: H + size * 0.3 + size * 0.15 }, mark: stackMark(lines, p, st) };
  }
  return { logo: { body, w: W, h: H }, mark: stackMark(lines, p, st) };
}

function stackMark(lines, p, st) {
  const S = 200;
  const letters = lines.map((l) => svg.drawable(l).replace(/[^A-Za-z0-9]/g, '').charAt(0)).filter(Boolean).slice(0, 2).join('');
  const body = svg.rect({ x: 0, y: 0, w: S, h: S, r: S * 0.12, fill: p.fill }) +
    svg.rect({ x: S * 0.16, y: S * 0.24, w: S * 0.07, h: S * 0.52, r: 0, fill: p.accent === p.fill ? p.onFill : p.accent }) +
    svg.group(centeredLetters(letters, S, { maxW: S * 0.5, maxH: S * 0.42, weight: 0.17, cap: 'square', fill: p.onFill }), { transform: `translate(${S * 0.06} 0)` });
  return { body, size: S };
}

const CONCEPTS = [
  { id: 'monogram', title: 'Monogram badge', note: 'Your initials in a solid badge. Strong as a profile picture and on a truck door, a cup or a sticker.', make: monogram },
  { id: 'mark', title: 'Symbol and name', note: 'A simple shape you can own, beside your name. Works as a favicon and an app icon.', make: (s, p, st) => geometric(s, p, st, 0) },
  { id: 'wordmark', title: 'Wordmark', note: 'Just your name, drawn with care. The easiest to read on signs, invoices and your website header.', make: wordmark },
  { id: 'icon', title: 'Icon and name', note: 'Says what you do at a glance. Good for local services people search for.', make: iconName },
  { id: 'seal', title: 'Round seal', note: 'A classic stamp for stickers, packaging, uniforms and receipts.', make: seal },
  { id: 'stacked', title: 'Stacked name', note: 'Big, tight letters in two lines with an accent bar. Bold on social posts and flyers.', make: stacked },
];

function draw(id, spec, variant = 'color') {
  const c = CONCEPTS.find((x) => x.id === id) || CONCEPTS[0];
  const st = STYLE[spec.mood] || STYLE.clean;
  const p = paint(spec.colors, variant);
  const out = c.make(spec, p, st);
  return { id: c.id, title: c.title, note: c.note, ...out };
}

function concepts(spec) {
  return CONCEPTS.map((c) => draw(c.id, spec, 'color'));
}

// ---------- files ----------

// The logo alone, trimmed to its shape with a little breathing room. Transparent background.
function logoSvg(d, { pad = 0.08, background, title } = {}) {
  const pw = Math.max(d.logo.w, d.logo.h) * pad;
  const W = d.logo.w + pw * 2;
  const H = d.logo.h + pw * 2;
  return svg.standalone(svg.group(d.logo.body, { transform: `translate(${r2(pw)} ${r2(pw)})` }), { width: W, height: H, title, background });
}

// The square mark at a pixel size (for favicons and profile pictures). inset: share of the size
// left around the mark.
function markSvg(d, { size = 512, inset = 0, background, title } = {}) {
  const k = (size * (1 - inset * 2)) / d.mark.size;
  const off = size * inset;
  return svg.standalone(svg.group(d.mark.body, { transform: `translate(${r2(off)} ${r2(off)}) scale(${r2(k * 10000) / 10000})` }), { width: size, height: size, title, background });
}

// The logo centered on a square page (1080 by default), for a PNG the member can post or send.
function presentSvg(d, { size = 1080, background, maxW = 0.72, maxH = 0.5, title } = {}) {
  const k = Math.min((size * maxW) / d.logo.w, (size * maxH) / d.logo.h);
  const x = (size - d.logo.w * k) / 2;
  const y = (size - d.logo.h * k) / 2;
  return svg.standalone(svg.group(d.logo.body, { transform: `translate(${r2(x)} ${r2(y)}) scale(${r2(k * 10000) / 10000})` }), { width: size, height: size, title, background });
}

// All six on one board (1080 x 1350) to compare side by side.
function overviewSvg(list, { business = '', colors }) {
  const W = 1080;
  const H = 1350;
  const M = 64;
  const ink = '#15161a';
  const muted = '#5d6069';
  let body = '';
  body += svg.text({ x: M, y: 96, lines: ['LOGO CONCEPTS'], size: 22, weight: 700, fill: muted, letterSpacing: 4 });
  const title = svg.fit(business || 'Your logo', { width: W - M * 2, maxSize: 58, minSize: 32, maxLines: 1, weight: 800 });
  body += svg.text({ x: M, y: 160, lines: title.lines, size: title.size, weight: 800, fill: ink, font: svg.FONTS.display });
  const cols = 2;
  const gap = 24;
  const top = 200;
  const cw = (W - M * 2 - gap) / cols;
  const ch = (H - top - M - gap * 2) / 3;
  list.forEach((d, i) => {
    const cx = M + (i % cols) * (cw + gap);
    const cy = top + Math.floor(i / cols) * (ch + gap);
    body += svg.rect({ x: cx, y: cy, w: cw, h: ch, r: 26, fill: colors.paper, stroke: '#000000', strokeWidth: 0 });
    body += svg.rect({ x: cx + 0.5, y: cy + 0.5, w: cw - 1, h: ch - 1, r: 26, fill: 'none', stroke: '#000000', strokeWidth: 1, opacity: 0.08 });
    const boxW = cw * 0.76;
    const boxH = ch * 0.56;
    const k = Math.min(boxW / d.logo.w, boxH / d.logo.h);
    const lx = cx + (cw - d.logo.w * k) / 2;
    const ly = cy + (ch - 54 - d.logo.h * k) / 2 + 8;
    body += svg.group(d.logo.body, { transform: `translate(${r2(lx)} ${r2(ly)}) scale(${r2(k * 10000) / 10000})` });
    body += svg.text({ x: cx + 28, y: cy + ch - 26, lines: [`${i + 1}  ${d.title}`], size: 21, weight: 700, fill: muted });
  });
  return svg.doc({ width: W, height: H, background: '#ffffff', body, title: `Logo concepts ${business}`.trim() });
}

module.exports = { concepts, draw, logoSvg, markSvg, presentSvg, overviewSvg, splitName, initialsOf, CONCEPTS, STYLE, paint };
