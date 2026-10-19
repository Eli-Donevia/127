// Small SVG builders for images packs make: carousel slides, social images, flyers, favicons, logos.
// Owner: brand agent (extends this with logo shapes and a stroke alphabet). Everything returns a
// string. Text is escaped here, so callers pass plain member text. Turn an SVG into a PNG with
// media.svgToPng (ffmpeg's librsvg renders real fonts: Inter is on our servers, Arial-like fallbacks).

const FONTS = {
  sans: "Inter, 'Helvetica Neue', Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif",
  display: "'Inter Display', Inter, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'DejaVu Serif', 'Liberation Serif', serif",
  mono: "'DejaVu Sans Mono', 'Liberation Mono', monospace",
};

// Width of an average lowercase letter as a share of font size, measured with Inter through librsvg.
const CHAR_EM = { 300: 0.48, 400: 0.5, 500: 0.515, 600: 0.53, 700: 0.55, 800: 0.57, 900: 0.59 };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attrs(o) {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
    .map(([k, v]) => ` ${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${esc(v)}"`)
    .join('');
}

function doc({ width, height, background, body = '', defs = '', title }) {
  const bg = background ? `<rect width="${width}" height="${height}" fill="${esc(background)}"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    (title ? `<title>${esc(title)}</title>` : '') +
    (defs ? `<defs>${defs}</defs>` : '') +
    bg +
    body +
    '</svg>'
  );
}

function textWidth(text, size, weight = 400) {
  const em = CHAR_EM[weight] || CHAR_EM[400];
  let units = 0;
  for (const ch of String(text)) units += /[mwMW@%]/.test(ch) ? 1.5 : /[il.,:;'|!I1 ]/.test(ch) ? 0.5 : /[A-Z0-9$&]/.test(ch) ? 1.25 : 1;
  return units * em * size;
}

// Word wrap to a pixel width at a font size. Never breaks inside a word unless the word alone is too long.
function wrap(text, { width, size, weight = 400 }) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (!line || textWidth(next, size, weight) <= width) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Biggest font size (step 2px) at which the text fits the box in maxLines.
function fit(text, { width, height = Infinity, maxSize = 96, minSize = 20, maxLines = 4, weight = 700, lineHeight = 1.12 }) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = wrap(text, { width, size, weight });
    if (lines.length <= maxLines && lines.length * size * lineHeight <= height && lines.every((l) => textWidth(l, size, weight) <= width)) {
      return { size, lines };
    }
  }
  const lines = wrap(text, { width, size: minSize, weight }).slice(0, maxLines);
  return { size: minSize, lines };
}

// Lines of text. y is the baseline of the first line.
function text({ x, y, lines, size = 32, weight = 400, fill = '#111', font = FONTS.sans, lineHeight = 1.15, anchor = 'start', letterSpacing, opacity }) {
  const ls = [].concat(lines || []);
  const spans = ls
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : Math.round(size * lineHeight)}">${esc(l)}</tspan>`)
    .join('');
  return `<text${attrs({ x, y, fontFamily: font, fontSize: size, fontWeight: weight, fill, textAnchor: anchor, letterSpacing, opacity })}>${spans}</text>`;
}

function rect({ x = 0, y = 0, w, h, r = 0, fill = 'none', stroke, strokeWidth, opacity }) {
  return `<rect${attrs({ x, y, width: w, height: h, rx: r || undefined, fill, stroke, strokeWidth, opacity })}/>`;
}

function circle({ cx, cy, r, fill = 'none', stroke, strokeWidth, opacity }) {
  return `<circle${attrs({ cx, cy, r, fill, stroke, strokeWidth, opacity })}/>`;
}

function line({ x1, y1, x2, y2, stroke = '#000', strokeWidth = 2, opacity, linecap = 'round' }) {
  return `<line${attrs({ x1, y1, x2, y2, stroke, strokeWidth, opacity, strokeLinecap: linecap })}/>`;
}

function path({ d, fill = 'none', stroke, strokeWidth, opacity, linecap, linejoin }) {
  return `<path${attrs({ d, fill, stroke, strokeWidth, opacity, strokeLinecap: linecap, strokeLinejoin: linejoin })}/>`;
}

function group(body, { transform, opacity } = {}) {
  return `<g${attrs({ transform, opacity })}>${body}</g>`;
}

// A pill or tag: rounded rect sized to its label.
function pill({ x, y, label, size = 24, weight = 600, fill = '#111', color = '#fff', padX = 0.8, padY = 0.45, font = FONTS.sans }) {
  const w = Math.round(textWidth(label, size, weight) + size * padX * 2);
  const h = Math.round(size * (1 + padY * 2));
  return {
    width: w,
    height: h,
    svg:
      rect({ x, y, w, h, r: h / 2, fill }) +
      text({ x: x + w / 2, y: y + h / 2 + size * 0.35, lines: [label], size, weight, fill: color, font, anchor: 'middle' }),
  };
}

function linearGradient(id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
  const s = stops.map((c, i) => `<stop offset="${Math.round((i / Math.max(1, stops.length - 1)) * 100)}%" stop-color="${esc(c)}"/>`).join('');
  return `<linearGradient id="${esc(id)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`;
}

// An embedded raster or SVG image (data URI from a Buffer).
function image({ x = 0, y = 0, w, h, data, type = 'image/png', fit: how = 'xMidYMid slice' }) {
  const href = `data:${type};base64,${Buffer.from(data).toString('base64')}`;
  return `<image${attrs({ x, y, width: w, height: h, preserveAspectRatio: how })} href="${href}"/>`;
}


// ---------------------------------------------------------------------------------------------
// Drawn lettering, icons and shapes (brand agent, Oct 19). Logos and marks must look the same in
// every browser, phone and print shop, so nothing below depends on a font: letters are monoline
// strokes on a 100-unit grid (cap height 100, x-height 64, descender 28), icons are strokes on a
// 24-unit grid. Everything returns SVG strings (or { svg, width } when the caller needs the size).
// ---------------------------------------------------------------------------------------------

const r2 = (n) => Math.round(n * 100) / 100;

function hash32(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// Parses absolute path commands (M L H V C Q A Z, the only ones the glyph and shape tables use)
// and returns them with every point mapped by fn(x, y) -> [x, y]. Arc radii scale by k.
function mapPath(d, fn, k = 1) {
  const tokens = String(d).match(/[MLHVCQAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [];
  const out = [];
  let i = 0;
  let cmd = null;
  let cx = 0;
  let cy = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'Z') {
      out.push('Z');
      cmd = null;
      continue;
    }
    if (cmd === 'M' || cmd === 'L') {
      cx = num();
      cy = num();
      const [x, y] = fn(cx, cy);
      out.push(`${cmd}${r2(x)} ${r2(y)}`);
      if (cmd === 'M') cmd = 'L';
    } else if (cmd === 'H' || cmd === 'V') {
      if (cmd === 'H') cx = num();
      else cy = num();
      const [x, y] = fn(cx, cy);
      out.push(`L${r2(x)} ${r2(y)}`);
    } else if (cmd === 'C') {
      const pts = [num(), num(), num(), num(), num(), num()];
      const a = fn(pts[0], pts[1]);
      const b = fn(pts[2], pts[3]);
      const c = fn(pts[4], pts[5]);
      cx = pts[4];
      cy = pts[5];
      out.push(`C${r2(a[0])} ${r2(a[1])} ${r2(b[0])} ${r2(b[1])} ${r2(c[0])} ${r2(c[1])}`);
    } else if (cmd === 'Q') {
      const pts = [num(), num(), num(), num()];
      const a = fn(pts[0], pts[1]);
      const b = fn(pts[2], pts[3]);
      cx = pts[2];
      cy = pts[3];
      out.push(`Q${r2(a[0])} ${r2(a[1])} ${r2(b[0])} ${r2(b[1])}`);
    } else if (cmd === 'A') {
      const rx = num();
      const ry = num();
      const rot = num();
      const large = num();
      const sweep = num();
      cx = num();
      cy = num();
      const [x, y] = fn(cx, cy);
      out.push(`A${r2(rx * k)} ${r2(ry * k)} ${rot} ${large} ${sweep} ${r2(x)} ${r2(y)}`);
    } else {
      i++; // unknown token: skip
    }
  }
  return out.join('');
}

// ---------- the stroke alphabet ----------
// w: skeleton width in grid units. l/r: side bearings (straight sides get more room than round or
// open ones, which is what makes monoline lettering look evenly spaced).
const S = 7; // straight side
const R = 4; // round side
const O = 1; // open or diagonal side
const GLYPHS = {
  A: { w: 84, l: O, r: O, d: 'M0 100L42 0L84 100M19.3 66H64.7' },
  B: { w: 61, l: S, r: R, d: 'M0 100V0H30A23 23 0 0 1 30 46H0M30 46H34A27 27 0 0 1 34 100H0' },
  C: { w: 88.3, l: R, r: O, d: 'M88.3 17.86A50 50 0 1 0 88.3 82.14' },
  D: { w: 80, l: S, r: R, d: 'M0 0H30A50 50 0 0 1 30 100H0Z' },
  E: { w: 56, l: S, r: O, d: 'M56 0H0V100H56M0 50H48' },
  F: { w: 56, l: S, r: O, d: 'M56 0H0V100M0 50H48' },
  G: { w: 100, l: R, r: S, d: 'M88.3 17.86A50 50 0 1 0 100 50H58' },
  H: { w: 72, l: S, r: S, d: 'M0 0V100M72 0V100M0 50H72' },
  I: { w: 0, l: S, r: S, d: 'M0 0V100' },
  J: { w: 48, l: O, r: S, d: 'M48 0V76A24 24 0 0 1 0 76' },
  K: { w: 64, l: S, r: O, d: 'M0 0V100M62 0L5 55.2M23.7 41.2L64 100' },
  L: { w: 54, l: S, r: O, d: 'M0 0V100H54' },
  M: { w: 88, l: S, r: S, d: 'M0 100V0L44 72L88 0V100' },
  N: { w: 74, l: S, r: S, d: 'M0 100V0L74 100V0' },
  O: { w: 100, l: R, r: R, d: 'M100 50A50 50 0 1 1 0 50A50 50 0 1 1 100 50Z' },
  P: { w: 58, l: S, r: R, d: 'M0 100V0H32A26 26 0 0 1 32 52H0' },
  Q: { w: 100, l: R, r: R, d: 'M100 50A50 50 0 1 1 0 50A50 50 0 1 1 100 50ZM62 62L100 100' },
  R: { w: 62, l: S, r: O, d: 'M0 100V0H32A26 26 0 0 1 32 52H0M32.8 56.2L62 100' },
  S: { w: 56, l: R, r: R, d: 'M49.65 12A25 24 0 1 0 28 48A28 26 0 1 1 3.75 87' },
  T: { w: 64, l: O, r: O, d: 'M0 0H64M32 0V100' },
  U: { w: 72, l: S, r: S, d: 'M0 0V64A36 36 0 0 0 72 64V0' },
  V: { w: 76, l: O, r: O, d: 'M0 0L38 100L76 0' },
  W: { w: 112, l: O, r: O, d: 'M0 0L28 100L56 0L84 100L112 0' },
  X: { w: 70, l: O, r: O, d: 'M0 0L70 100M70 0L0 100' },
  Y: { w: 72, l: O, r: O, d: 'M0 0L36 52L72 0M36 52V100' },
  Z: { w: 64, l: R, r: R, d: 'M0 0H64L0 100H64' },
  a: { w: 64, l: R, r: S, d: 'M64 68A32 32 0 1 1 0 68A32 32 0 1 1 64 68ZM64 36V100' },
  b: { w: 64, l: S, r: R, d: 'M0 0V100M64 68A32 32 0 1 1 0 68A32 32 0 1 1 64 68Z' },
  c: { w: 54.6, l: R, r: O, d: 'M54.6 45.4A32 32 0 1 0 54.6 90.6' },
  d: { w: 64, l: R, r: S, d: 'M64 68A32 32 0 1 1 0 68A32 32 0 1 1 64 68ZM64 0V100' },
  e: { w: 64, l: R, r: R, d: 'M0 68H64A32 32 0 1 0 54.6 90.6' },
  f: { w: 38, l: O, r: O, d: 'M16 100V24A22 22 0 0 1 38 2M0 38H36' },
  g: { w: 64, l: R, r: S, d: 'M64 68A32 32 0 1 1 0 68A32 32 0 1 1 64 68ZM64 36V98C64 116 51 128 34 128C21 128 11 122 5 113' },
  h: { w: 60, l: S, r: S, d: 'M0 0V100M0 66A30 30 0 0 1 60 66V100' },
  i: { w: 0, l: S, r: S, d: 'M0 36V100M0 12L0.01 12' },
  j: { w: 18, l: O, r: S, d: 'M18 36V112C18 122 12 128 2 128M18 12L18.01 12' },
  k: { w: 56, l: S, r: O, d: 'M0 0V100M54 36L0 80M20 63.7L56 100' },
  l: { w: 0, l: S, r: S, d: 'M0 0V100' },
  m: { w: 96, l: S, r: S, d: 'M0 36V100M0 64A24 28 0 0 1 48 64V100M48 64A24 28 0 0 1 96 64V100' },
  n: { w: 60, l: S, r: S, d: 'M0 36V100M0 66A30 30 0 0 1 60 66V100' },
  o: { w: 64, l: R, r: R, d: 'M64 68A32 32 0 1 1 0 68A32 32 0 1 1 64 68Z' },
  p: { w: 64, l: S, r: R, d: 'M0 36V128M64 68A32 32 0 1 1 0 68A32 32 0 1 1 64 68Z' },
  q: { w: 64, l: R, r: S, d: 'M64 36V128M64 68A32 32 0 1 1 0 68A32 32 0 1 1 64 68Z' },
  r: { w: 36, l: S, r: O, d: 'M0 36V100M0 70C0 50 14 36 36 36' },
  s: { w: 40, l: R, r: R, d: 'M35.6 43.5A18 15 0 1 0 20 66A20 17 0 1 1 2.7 91.5' },
  t: { w: 32, l: O, r: O, d: 'M14 8V84C14 94 20 100 32 100M0 38H32' },
  u: { w: 60, l: S, r: S, d: 'M0 36V70A30 30 0 0 0 60 70M60 36V100' },
  v: { w: 60, l: O, r: O, d: 'M0 36L30 100L60 36' },
  w: { w: 88, l: O, r: O, d: 'M0 36L22 100L44 36L66 100L88 36' },
  x: { w: 56, l: O, r: O, d: 'M0 36L56 100M56 36L0 100' },
  y: { w: 62, l: O, r: O, d: 'M0 36L31.4 100M62 36L18 128' },
  z: { w: 54, l: R, r: R, d: 'M0 36H54L0 100H54' },
  0: { w: 64, l: R, r: R, d: 'M64 50A32 50 0 1 1 0 50A32 50 0 1 1 64 50Z' },
  1: { w: 28, l: O, r: S, d: 'M0 20L28 0V100' },
  2: { w: 62, l: R, r: O, d: 'M2 24A29 24 0 0 1 60 24C60 44 40 58 0 100H62' },
  3: { w: 62, l: O, r: R, d: 'M4 0H56L26 40C46 38 62 50 62 69C62 87 48 100 31 100C17 100 6 93 0 82' },
  4: { w: 64, l: O, r: O, d: 'M46 100V0L0 68H64' },
  5: { w: 62, l: O, r: R, d: 'M56 0H8L3 42C10 37 20 35 31 35C48 35 62 48 62 67C62 86 48 100 31 100C17 100 6 93 0 82' },
  6: { w: 62, l: R, r: R, d: 'M44 0L4.5 57M62 70A31 30 0 1 1 0 70A31 30 0 1 1 62 70Z' },
  7: { w: 60, l: O, r: O, d: 'M0 0H60L18 100' },
  8: { w: 54, l: R, r: R, d: 'M50 23A23 23 0 1 1 4 23A23 23 0 1 1 50 23ZM54 73A27 27 0 1 1 0 73A27 27 0 1 1 54 73Z' },
  9: { w: 62, l: R, r: R, d: 'M62 30A31 30 0 1 1 0 30A31 30 0 1 1 62 30ZM57.5 43L18 100' },
  '.': { w: 0, l: R, r: R, d: 'M0 100L0.01 100' },
  ',': { w: 4, l: O, r: R, d: 'M4 96L0 110' },
  "'": { w: 0, l: R, r: R, d: 'M0 0V24' },
  '-': { w: 34, l: R, r: R, d: 'M0 60H34' },
  '&': { w: 72, l: R, r: O, d: 'M72 100L20 40C12 30 13 8 33 6C50 4 56 24 44 35L16 56C2 68 6 100 34 98C50 97 62 86 70 66' },
  '!': { w: 0, l: S, r: S, d: 'M0 0V68M0 100L0.01 100' },
  '?': { w: 52, l: R, r: R, d: 'M0 24A26 24 0 0 1 52 24C52 42 28 44 28 66M28 100L28.01 100' },
  '/': { w: 44, l: O, r: O, d: 'M0 100L44 0' },
  '+': { w: 56, l: R, r: R, d: 'M0 54H56M28 26V82' },
  ':': { w: 0, l: R, r: R, d: 'M0 44L0.01 44M0 100L0.01 100' },
};
const SPACE = 34;
const KERN = { AV: -10, VA: -10, AW: -8, WA: -8, AY: -10, YA: -10, AT: -10, TA: -10, LT: -14, LV: -12, LY: -14, LW: -10, PA: -8, FA: -8, TO: -4, OT: -4, AO: -2, OA: -2, Ty: -6, Te: -6, To: -6, Ta: -6, Yo: -6, Ya: -6, Ve: -4, Vo: -4 };

// "Café & Co." -> characters the alphabet can draw (accents dropped, curly quotes straightened).
function drawable(str) {
  return String(str == null ? '' : str)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐-―]/g, '-')
    .split('')
    .filter((ch) => ch === ' ' || GLYPHS[ch])
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lays out a string: [{ ch, g, x }] in grid units plus the total advance. weight is the stroke
// width as a share of the cap height (0.06 hairline, 0.1 regular, 0.15 bold, 0.2 heavy).
function layout(str, { weight = 0.12, tracking = 0.06, kern = true } = {}) {
  const sw = weight * 100;
  const s = 1 - weight;
  const items = [];
  let x = 0;
  let prev = null;
  for (const ch of drawable(str)) {
    if (ch === ' ') {
      x += SPACE * s + tracking * 100;
      prev = null;
      continue;
    }
    const g = GLYPHS[ch];
    if (prev && kern && KERN[prev + ch]) x += KERN[prev + ch] * s;
    if (items.length) x += g.l * s;
    items.push({ ch, g, x });
    x += g.w * s + sw + g.r * s + tracking * 100;
    prev = ch;
  }
  const last = items[items.length - 1];
  const width = last ? last.x + last.g.w * s + sw : 0;
  return { items, width, sw, s };
}

// Width in px of a string drawn at cap height `size`.
function strokeTextWidth(str, { size = 100, weight = 0.12, tracking = 0.06 } = {}) {
  return (layout(str, { weight, tracking }).width * size) / 100;
}

// One path that draws the string. x, y: top-left of the cap height (so y + size is the baseline).
// anchor: start, middle or end. cap: round (friendly) or square (crisp, beveled points).
// Returns { svg, d, width, size, strokeWidth }.
function strokeText(str, { x = 0, y = 0, size = 100, weight = 0.12, tracking = 0.06, color = '#111', cap = 'round', anchor = 'start', opacity, kern = true } = {}) {
  const lay = layout(str, { weight, tracking, kern });
  const k = size / 100;
  const width = lay.width * k;
  const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const half = lay.sw / 2;
  const d = lay.items
    .map(({ g, x: gx }) => mapPath(g.d, (px, py) => [x0 + (gx + px * lay.s + half) * k, y + (py * lay.s + half) * k], lay.s * k))
    .join('');
  const strokeWidth = r2(lay.sw * k);
  const joins = cap === 'square' ? { strokeLinecap: 'square', strokeLinejoin: 'miter', strokeMiterlimit: 1.5 } : { strokeLinecap: 'round', strokeLinejoin: 'round' };
  let svg = d ? `<path${attrs({ d, fill: 'none', stroke: color, strokeWidth, opacity, ...joins })}/>` : '';
  if (svg && cap === 'square') {
    // Crisp style: cut every stroke flat at the cap line and the baseline (or the descender line),
    // the way geometric typefaces end their diagonals.
    const deep = /[gjpqy,]/.test(drawable(str)) ? 1.28 : 1;
    const id = `st${hash32(`${d}|${x}|${y}|${size}`)}`;
    const pad = lay.sw * k;
    svg = `<clipPath id="${id}"><rect x="${r2(x0 - pad)}" y="${r2(y)}" width="${r2(width + pad * 2)}" height="${r2(size * deep)}"/></clipPath><g clip-path="url(#${id})">${svg}</g>`;
  }
  return { svg, d, width, size, strokeWidth };
}

// Biggest cap height (step 1px) at which the string fits a width. Returns { size, width }.
function fitStrokeText(str, { width, maxSize = 200, minSize = 8, weight = 0.12, tracking = 0.06 } = {}) {
  const unit = layout(str, { weight, tracking }).width / 100;
  if (!unit) return { size: maxSize, width: 0 };
  const size = Math.max(minSize, Math.min(maxSize, Math.floor(width / unit)));
  return { size, width: unit * size };
}

// Letters around a circle, for seals and badges. side 'top' reads clockwise over the top with the
// baseline on radius r; side 'bottom' reads left to right under the center with the cap tops on
// radius r. Returns an SVG string (one path per letter, each placed with a transform).
function strokeTextArc(str, { cx, cy, r, size = 40, weight = 0.12, tracking = 0.12, color = '#111', cap = 'round', side = 'top', opacity } = {}) {
  const lay = layout(str, { weight, tracking });
  const k = size / 100;
  const mid = side === 'top' ? r + size / 2 : r + size / 2;
  const total = (lay.width * k) / mid;
  const half = lay.sw / 2;
  const joins = cap === 'square' ? { strokeLinecap: 'square', strokeLinejoin: 'miter', strokeMiterlimit: 1.5 } : { strokeLinecap: 'round', strokeLinejoin: 'round' };
  const parts = [];
  for (const { g, x: gx } of lay.items) {
    const gw = (g.w * lay.s + lay.sw) * k;
    const center = (gx * k + gw / 2) / mid;
    const local = mapPath(g.d, (px, py) => [(gx + px * lay.s + half) * k - (gx * k + gw / 2), (py * lay.s + half) * k - size], lay.s * k);
    let a;
    let rot;
    let rad;
    if (side === 'top') {
      a = -Math.PI / 2 - total / 2 + center;
      rot = (a * 180) / Math.PI + 90;
      rad = r;
    } else {
      a = Math.PI / 2 + total / 2 - center;
      rot = (a * 180) / Math.PI - 90;
      rad = r + size;
    }
    const px = cx + rad * Math.cos(a);
    const py = cy + rad * Math.sin(a);
    parts.push(`<path transform="translate(${r2(px)} ${r2(py)}) rotate(${r2(rot)})" d="${local}"/>`);
  }
  return `<g${attrs({ fill: 'none', stroke: color, strokeWidth: r2(lay.sw * k), opacity, ...joins })}>${parts.join('')}</g>`;
}

// ---------- icons ----------
// Simple line icons on a 24-unit grid, stroke 2, drawn for 127 (no outside icon set). icon() scales
// them to any size; the stroke scales with them unless strokeWidth is given in px.
const ICONS = {
  car: 'M5 11l1.5-4A2 2 0 0 1 8.4 5.6h7.2a2 2 0 0 1 1.9 1.4L19 11M3.5 11h17a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1zM6 17.5V20M18 17.5V20M6.5 14.2h1.6M15.9 14.2h1.6',
  drop: 'M12 3.2C9 7.2 6 10.6 6 14.2a6 6 0 0 0 12 0c0-3.6-3-7-6-11z',
  sparkle: 'M12 3.5l1.8 5.4a2 2 0 0 0 1.3 1.3l5.4 1.8-5.4 1.8a2 2 0 0 0-1.3 1.3L12 20.5l-1.8-5.4a2 2 0 0 0-1.3-1.3L3.5 12l5.4-1.8a2 2 0 0 0 1.3-1.3z',
  leaf: 'M5 19.5C5.6 11.6 10.4 6 19.5 4.5 19 13.5 13.8 18.8 6.6 19.3M5 19.5l7.5-7.5',
  home: 'M3.5 11L12 4.2l8.5 6.8M5.8 9.5V20h12.4V9.5M10 20v-5.2h4V20',
  paw: 'M12 12.2c-2.9 0-5.3 3-5.3 5.2 0 1.6 1.3 2.5 2.8 2.5.9 0 1.7-.5 2.5-.5s1.6.5 2.5.5c1.5 0 2.8-.9 2.8-2.5 0-2.2-2.4-5.2-5.3-5.2zM6.4 11.6a2 2 0 1 0 0-.01zM9.8 7.6a2 2 0 1 0 0-.01zM14.2 7.6a2 2 0 1 0 0-.01zM17.6 11.6a2 2 0 1 0 0-.01z',
  camera: 'M3.5 8.6A1.6 1.6 0 0 1 5.1 7h2.4l1.6-2.2h5.8L16.5 7h2.4a1.6 1.6 0 0 1 1.6 1.6v8.8a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6zM15.5 12.8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0z',
  book: 'M12 6.6C10 5 7 4.4 3.5 4.8v13.1c3.5-.4 6.5.2 8.5 1.7 2-1.5 5-2.1 8.5-1.7V4.8C17 4.4 14 5 12 6.6zM12 6.6v13',
  scissors: 'M8.6 7a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 1 1 5.2 0zM8.6 17a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 1 1 5.2 0zM8.1 8.6L20 18M8.1 15.4L20 6',
  cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.4a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12.5 3.5v2.5',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  wrench: 'M14.5 4.2a5 5 0 0 0-4.2 6.9l-6 6a1.9 1.9 0 0 0 2.7 2.7l6-6a5 5 0 0 0 6.9-4.2l-3 1.6-2.2-.8-.8-2.2z',
  brush: 'M20 4L11 13M10.2 13.2a3 3 0 0 0-4.2 0c-1.2 1.2-.9 3-1.6 4.3-.4.8-1.2 1.4-2 1.6 3 1.6 6.4 1 7.8-.6a3 3 0 0 0 0-4.3z',
  play: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zM10.2 8.6v6.8L15.6 12z',
  bolt: 'M13.2 2.8L5.5 13.5h6.2l-1 7.7 7.8-10.8h-6.3z',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0zM12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6',
  mountain: 'M2.5 19.5L9.2 8l4.1 6.4 2.4-3.2 5.8 8.3z',
  wave: 'M2.5 9.5c2.4 0 2.4-2.5 4.75-2.5S9.6 9.5 12 9.5s2.4-2.5 4.75-2.5 2.35 2.5 4.75 2.5M2.5 15.5c2.4 0 2.4-2.5 4.75-2.5s2.35 2.5 4.75 2.5 2.4-2.5 4.75-2.5 2.35 2.5 4.75 2.5',
  flame: 'M12 3c.8 3.4 5.2 5.4 5.2 10.3a5.2 5.2 0 0 1-10.4 0c0-2.2 1-3.7 2.2-4.8.3 1.5 1 2.6 2.1 3.2-.1-3 0-5.6.9-8.7z',
  bag: 'M5 8.5h14l-1.1 11.5H6.1zM9 8.5V7a3 3 0 0 1 6 0v1.5',
  box: 'M3.5 7.6L12 3.4l8.5 4.2v8.8L12 20.6l-8.5-4.2zM3.5 7.6L12 11.8l8.5-4.2M12 11.8v8.8',
  heart: 'M12 20s-7.8-4.7-7.8-10.3A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.8 2.5C19.8 15.3 12 20 12 20z',
  chat: 'M4 5.5h16v10.2H9.3L4 19.5z',
  star: 'M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  pen: 'M4 20l1.1-4.3L15.8 5a2.1 2.1 0 0 1 3 3L8.3 18.9zM14.2 6.6l3.2 3.2',
  snowflake: 'M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.6 4.2L12 6.4l2.4-2.2M9.6 19.8L12 17.6l2.4 2.2',
  key: 'M11.5 15a4 4 0 1 1-8 0 4 4 0 1 1 8 0zM10.4 12.2L19.5 3.5M16.5 6.5l2.4 2.4M14.2 8.8l2.2 2.2',
  pin: 'M12 21s-6.6-6.1-6.6-11a6.6 6.6 0 0 1 13.2 0c0 4.9-6.6 11-6.6 11zM14.3 10a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 1 1 4.6 0z',
  chart: 'M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6',
  music: 'M9 17.5V5.5l11-2v12M9 17.5a3 3 0 1 1-6 0 3 3 0 1 1 6 0zM20 15.5a3 3 0 1 1-6 0 3 3 0 1 1 6 0z',
  flower: 'M12 13.5c-3.3 0-5.5-2.5-5.5-6.3 1.9 0 3.3.7 4.1 1.9.4-1.5.8-2.5 1.4-3.6.6 1.1 1 2.1 1.4 3.6.8-1.2 2.2-1.9 4.1-1.9 0 3.8-2.2 6.3-5.5 6.3zM12 13.5v7M12 18.4c-1.3-1.5-3-2.2-5-2.2 0 2.3 1.9 3.6 5 3.6',
  tag: 'M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.8 8.8a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0zM9.2 8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 1 1 2.4 0z',
  calendar: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 1 1 8 0zM4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5',
  image: 'M3.5 5h17v14h-17zM3.5 15.5l4.8-4.8 3.7 3.7 2.8-2.8 5.7 5.7M17.6 8.9a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0z',
  check: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zM8 12.3l2.8 2.7L16.2 9.5',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zM12 7v5.2l3.4 2',
  shirt: 'M8.5 3.5L3.5 6.4l1.8 3.8 2.2-1V20.5h9V9.2l2.2 1 1.8-3.8-5-2.9c-.4 1.4-1.8 2.4-3.5 2.4S8.9 4.9 8.5 3.5z',
  gem: 'M6.5 4h11l3.5 5.2L12 20.5 3 9.2zM3 9.2h18M12 20.5L8.6 9.2 10.4 4M12 20.5l3.4-11.3L13.6 4',
  cake: 'M4.5 20.5h15v-8h-15zM4.5 15.8c1.9 1.2 3.8 1.2 5 0s3.1-1.2 5 0 3.8 1.2 5 0M12 12.5V9M12 5.2c.8.9 1.2 1.6 1.2 2.2a1.2 1.2 0 0 1-2.4 0c0-.6.4-1.3 1.2-2.2z',
  candle: 'M8.5 10.5h7v10h-7zM12 10.5V8M12 3c.9 1.1 1.4 1.9 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.7.5-1.5 1.4-2.6z',
  code: 'M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.6 4.5l-3.2 15',
  bulb: 'M9.2 17.5h5.6M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.6.5.9 1.2.9 2v1.2h5.4v-1.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3.5z',
  sprout: 'M12 20.5v-8.5M12 12c0-3.6-2.6-6-6.5-6 0 3.6 2.6 6 6.5 6zM12 12c0-3.1 2.2-5.3 5.8-5.3 0 3.1-2.2 5.3-5.8 5.3z',
  spray: 'M8 9.5h6v11H8zM9.5 9.5V6.5h3v3M12.5 5h3M17.5 4.5l1.5-1M17.5 6.5h2M17.5 8.5l1.5 1',
  broom: 'M14.5 3.5l-3.4 8.3M8.2 11.2l6.1 2.5-1.8 6.8H4.6l1.2-4.4z',
  truck: 'M2.5 6h11v10h-11zM13.5 9.5h4.2l3 3.4V16h-7.2M8 17.5a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 1 1 3.6 0zM19 17.5a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 1 1 3.6 0z',
  mic: 'M15 11a3 3 0 1 1-6 0V6a3 3 0 1 1 6 0zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3',
  cart: 'M3 4h2.4l2.2 10.5h10.2L20 7.5H6.4M10.5 19a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 1 1 2.6 0zM18 19a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 1 1 2.6 0z',
  arrow: 'M4 12h15M13.5 6.5L19 12l-5.5 5.5',
};

// An icon as a group of strokes at (x, y), size px square. Unknown names draw a sparkle.
function icon(name, { x = 0, y = 0, size = 24, color = '#111', weight = 2, cap = 'round', opacity } = {}) {
  const d = ICONS[name] || ICONS.sparkle;
  const k = size / 24;
  return `<g${attrs({ transform: `translate(${r2(x)} ${r2(y)}) scale(${r2(k * 1000) / 1000})`, opacity })}><path${attrs({ d, fill: 'none', stroke: color, strokeWidth: weight, strokeLinecap: cap, strokeLinejoin: 'round' })}/></g>`;
}

// ---------- shapes ----------

// Corners of a regular polygon (rotate in degrees; 0 puts a point at the top).
function polygonPoints({ cx, cy, r, sides = 6, rotate = 0 }) {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((rotate - 90 + (360 / sides) * i) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

// A closed path through points with rounded corners (radius in px, clamped to half of each side).
function roundedPolygonPath(points, radius = 0) {
  if (!radius) return `M${points.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    const t = Math.min(radius, l1 / 2, l2 / 2);
    const a = [p1[0] + (v1[0] / l1) * t, p1[1] + (v1[1] / l1) * t];
    const b = [p1[0] + (v2[0] / l2) * t, p1[1] + (v2[1] / l2) * t];
    d += `${i === 0 ? 'M' : 'L'}${r2(a[0])} ${r2(a[1])}Q${r2(p1[0])} ${r2(p1[1])} ${r2(b[0])} ${r2(b[1])}`;
  }
  return `${d}Z`;
}

function polygon({ points, fill = 'none', stroke, strokeWidth, opacity, radius = 0, linejoin }) {
  return path({ d: roundedPolygonPath(points, radius), fill, stroke, strokeWidth, opacity, linejoin });
}

function regularPolygon({ cx, cy, r, sides = 6, rotate = 0, radius = 0, fill = 'none', stroke, strokeWidth, opacity }) {
  return polygon({ points: polygonPoints({ cx, cy, r, sides, rotate }), radius, fill, stroke, strokeWidth, opacity });
}

// Point on a circle; angle in degrees, 0 at the top, clockwise.
function onCircle(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

// An open arc from angle a0 to a1 (degrees, 0 at the top, clockwise), as a path d string.
function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = onCircle(cx, cy, r, a0);
  const [x1, y1] = onCircle(cx, cy, r, a1);
  const span = (((a1 - a0) % 360) + 360) % 360;
  return `M${r2(x0)} ${r2(y0)}A${r2(r)} ${r2(r)} 0 ${span > 180 ? 1 : 0} 1 ${r2(x1)} ${r2(y1)}`;
}

// A filled wedge (pie slice) from a0 to a1, for geometric marks.
function wedgePath(cx, cy, r, a0, a1) {
  return `M${r2(cx)} ${r2(cy)}L${arcPath(cx, cy, r, a0, a1).slice(1)}Z`;
}

// An SVG string as a data URI (for <img src> in HTML pages and CSS backgrounds).
function dataUri(svgString) {
  return `data:image/svg+xml;base64,${Buffer.from(String(svgString), 'utf8').toString('base64')}`;
}

// Wraps body markup in a standalone SVG with a viewBox, for logos saved as their own files.
function standalone(body, { width, height, title, background } = {}) {
  return doc({ width: r2(width), height: r2(height), body, title, background });
}

module.exports = {
  // original API (stable)
  FONTS, esc, attrs, doc, textWidth, wrap, fit, text, rect, circle, line, path, group, pill, linearGradient, image,
  // drawn lettering, icons and shapes
  GLYPHS, ICONS, mapPath, drawable, glyphLayout: layout, strokeText, strokeTextWidth, fitStrokeText, strokeTextArc, icon,
  polygonPoints, roundedPolygonPath, polygon, regularPolygon, onCircle, arcPath, wedgePath, dataUri, standalone,
};
