// Brand palettes: three options from a mood, a niche or the member's own color, every text pair
// checked for contrast (WCAG), named in plain words, with CSS variables and a swatch board SVG.
// Built on the kit color module; buildPalette() is the local version of color.palette() that also
// takes an accent (the kit one derives it), so "your color, quiet" can use the member's color as
// the accent.

const { color, text } = require('../../_kit');
const svg = require('../../_kit/svg');

const { hexToRgb, rgbToHsl, hslToHex, contrast, readableOn, ensureContrast, isHex, mix } = color;

// Plain color names by hue, with darker and lighter words.
const HUES = [
  [10, 'Red', 'Brick', 'Rose'],
  [25, 'Coral', 'Rust', 'Salmon'],
  [40, 'Orange', 'Copper', 'Peach'],
  [55, 'Amber', 'Bronze', 'Sand'],
  [70, 'Gold', 'Olive', 'Butter'],
  [95, 'Lime', 'Moss', 'Pistachio'],
  [150, 'Green', 'Forest', 'Mint'],
  [175, 'Jade', 'Pine', 'Seafoam'],
  [195, 'Teal', 'Deep Teal', 'Aqua'],
  [215, 'Sky', 'Ocean', 'Ice'],
  [240, 'Blue', 'Navy', 'Cornflower'],
  [260, 'Indigo', 'Midnight', 'Periwinkle'],
  [285, 'Violet', 'Plum', 'Lavender'],
  [320, 'Magenta', 'Berry', 'Orchid'],
  [345, 'Pink', 'Raspberry', 'Blush'],
  [361, 'Red', 'Brick', 'Rose'],
];

function colorName(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'Color';
  const [h, s, l] = rgbToHsl(rgb);
  if (s < 0.12 || (l < 0.16 && s < 0.35)) {
    if (l < 0.2) return 'Ink';
    if (l < 0.4) return 'Charcoal';
    if (l < 0.62) return 'Stone';
    if (l < 0.86) return 'Mist';
    return 'Paper';
  }
  if (s < 0.5 && l < 0.45 && h >= 10 && h < 50) return l < 0.26 ? 'Espresso' : 'Brown';
  if (s < 0.45 && l < 0.45 && h >= 50 && h < 75) return 'Olive';
  const row = HUES.find(([max]) => h < max) || HUES[0];
  if (l <= 0.32) return row[2];
  if (l > 0.72) return row[3];
  return row[1];
}

// The pair a text color needs on a background, nudged until it passes.
function readablePair(bg, ratio = 4.5) {
  const fg = readableOn(bg);
  return contrast(fg, bg) >= ratio ? fg : ensureContrast(fg, bg, ratio);
}

// Mid-tone colors where neither white nor near-black text reaches 4.5:1 get nudged darker or
// lighter (whichever is the smaller change) so a label on them is readable.
function labelSafe(hex) {
  if (Math.max(contrast('#ffffff', hex), contrast('#111111', hex)) >= 4.5) return hex;
  let dark = hex;
  let light = hex;
  for (let i = 1; i <= 12; i++) {
    dark = color.darken(dark, 0.04);
    if (contrast('#ffffff', dark) >= 4.5) return dark;
    light = color.lighten(light, 0.04);
    if (contrast('#111111', light) >= 4.5) return light;
  }
  return dark;
}

// A full palette from a main color and an accent color. Mirrors kit color.palette().
function buildPalette(primaryHex, accentHex) {
  const p = isHex(primaryHex) ? primaryHex.toLowerCase() : '#2f5bd3';
  const [h, s] = rgbToHsl(hexToRgb(p));
  const paper = hslToHex(h, Math.min(0.25, s * 0.3), 0.975);
  const ink = hslToHex(h, Math.min(0.3, s * 0.4), 0.12);
  const surface = hslToHex(h, Math.min(0.3, s * 0.35), 0.93);
  const muted = ensureContrast(hslToHex(h, Math.min(0.15, s * 0.2), 0.42), paper, 4.5);
  const line = hslToHex(h, Math.min(0.2, s * 0.25), 0.85);
  const primary = ensureContrast(p, paper, 3);
  let accent = isHex(accentHex) ? accentHex.toLowerCase() : hslToHex(h + 30, Math.min(0.85, s + 0.1), 0.55);
  // An accent that disappears on the background is no accent.
  if (contrast(accent, paper) < 1.6) accent = mix(accent, ink, 0.25);
  accent = labelSafe(accent);
  return { primary, onPrimary: readablePair(primary), accent, onAccent: readablePair(accent), ink, paper, surface, muted, line };
}

function level(ratio, large = false) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return large ? 'AA' : 'Large text only';
  return 'Fails';
}

// The pairs a member actually uses, with the ratio and whether it passes.
function checks(c) {
  const rows = [
    ['Body text', c.ink, c.paper, false],
    ['Button text', c.onPrimary, c.primary, false],
    ['Accent label', c.onAccent, c.accent, false],
    ['Small print', c.muted, c.paper, false],
    ['Logo and headlines', c.primary, c.paper, true],
  ];
  return rows.map(([use, fg, bg, large]) => {
    const ratio = Math.round(contrast(fg, bg) * 10) / 10;
    const lv = level(ratio, large);
    return { use, fg, bg, ratio, level: lv, pass: lv !== 'Fails' && lv !== 'Large text only' };
  });
}

const ROLES = [
  ['primary', 'Main', 'Logo, buttons, headlines'],
  ['accent', 'Accent', 'Small highlights, tags, one word'],
  ['ink', 'Text', 'Body text and icons'],
  ['muted', 'Muted', 'Captions and small print'],
  ['surface', 'Soft', 'Cards and sections'],
  ['paper', 'Page', 'Page background'],
];

function cssVars(c, prefix = 'brand') {
  const keys = ['primary', 'onPrimary', 'accent', 'onAccent', 'ink', 'paper', 'surface', 'muted', 'line'];
  return `:root {\n${keys.map((k) => `  --${prefix}-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${c[k]};`).join('\n')}\n}\n`;
}

function describe(c) {
  return `${colorName(c.primary)} and ${colorName(c.accent)}`;
}

// Accent colors that sit well next to most brand colors. accentsFor() ranks them for a main color:
// best is about 150 degrees around the color wheel (clear contrast without the harshness of an
// exact opposite).
const ACCENTS = [
  [42, 0.85, 0.55],
  [12, 0.78, 0.6],
  [172, 0.55, 0.4],
  [205, 0.75, 0.55],
  [82, 0.5, 0.45],
  [330, 0.55, 0.62],
];

// Quieter moods get quieter accents.
const ACCENT_SAT = { premium: 0.55, earthy: 0.6, calm: 0.8 };

function accentsFor(hex, mood) {
  const [h] = rgbToHsl(hexToRgb(hex));
  const k = ACCENT_SAT[mood] || 1;
  return ACCENTS.map(([ah, as, al]) => {
    const d = Math.abs(((ah - h + 540) % 360) - 180);
    return { hex: hslToHex(ah, as * k, al), score: Math.abs(d - 150) };
  })
    .sort((a, b) => a.score - b.score)
    .map((a) => a.hex);
}

// Mid-tone main colors get darkened a little until white text reads on them (4.5:1), which is how
// most brands use a strong color. Light pastels keep dark text instead.
function strongPrimary(hex) {
  const [, , l] = rgbToHsl(hexToRgb(hex));
  if (l > 0.66 || contrast('#ffffff', hex) >= 4.5) return hex;
  let c = hex;
  for (let i = 0; i < 8 && contrast('#ffffff', c) < 4.5; i++) c = color.darken(c, 0.06);
  return c;
}

// Three options. seed: a hex color, a mood name (bold, calm, warm, fresh, premium, playful, earthy,
// clean) or nothing (then the niche mood).
function threePalettes(seed, { mood = 'clean' } = {}) {
  const list = [];
  if (isHex(seed)) {
    const hex = color.rgbToHex(hexToRgb(seed));
    const [h, sat] = rgbToHsl(hexToRgb(hex));
    const main = strongPrimary(hex);
    const acc = accentsFor(main);
    const deep = sat < 0.12 ? hslToHex(h, sat, 0.2) : hslToHex(h, Math.min(0.75, Math.max(0.25, sat * 0.85)), 0.24);
    list.push({ id: 'yours', label: 'Your color', colors: buildPalette(main, acc[0]) });
    list.push({ id: 'yours-2', label: 'Your color, second accent', colors: buildPalette(main, acc[1]) });
    list.push({ id: 'quiet', label: 'Your color as the accent', colors: buildPalette(deep, hex) });
  } else {
    const m = color.MOODS[seed] ? seed : color.MOODS[mood] ? mood : 'clean';
    const md = color.MOODS[m];
    const used = new Set();
    for (let v = 0; v < 3; v++) {
      const main = strongPrimary(hslToHex(md.hues[v % md.hues.length], md.s, md.l));
      const ranked = accentsFor(main, m);
      const acc = ranked.find((a) => !used.has(a)) || ranked[0];
      used.add(acc);
      list.push({ id: `${m}-${v + 1}`, label: `${text.sentenceCase(m)} ${v + 1}`, colors: buildPalette(main, acc) });
    }
  }
  return dress(list);
}

function dress(list) {
  return list.map((p, i) => ({
    ...p,
    n: i + 1,
    name: describe(p.colors),
    checks: checks(p.colors),
    css: cssVars(p.colors),
    swatches: ROLES.map(([key, role, use]) => ({ key, role, use, hex: p.colors[key], name: colorName(p.colors[key]) })),
  }));
}

// A saved palette first (the colors from a brand refresh), then the others, three in all.
function withFirst(first, list) {
  const same = (a, b) => a.primary === b.primary && a.accent === b.accent;
  return dress([first, ...list.filter((p) => !same(p.colors, first.colors))].slice(0, 3));
}

// ---------- swatch board (1080 x 1350, portrait so it reads on a phone) ----------

function board(palettes, { business = '', width = 1080 } = {}) {
  const W = width;
  const M = 72;
  const rowH = 330;
  const gap = 34;
  const top = 250;
  const H = top + palettes.length * rowH + (palettes.length - 1) * gap + 80;
  const ink = '#15161a';
  const muted = '#5d6069';
  let body = '';
  body += svg.text({ x: M, y: 108, lines: ['BRAND COLORS'], size: 22, weight: 700, fill: muted, letterSpacing: 4 });
  const title = svg.fit(business || 'Your palettes', { width: W - M * 2, maxSize: 64, minSize: 36, maxLines: 1, weight: 800 });
  body += svg.text({ x: M, y: 178, lines: title.lines, size: title.size, weight: 800, fill: ink, font: svg.FONTS.display });
  body += svg.text({ x: M, y: 218, lines: ['Three options. Every text pair checked for contrast.'], size: 24, weight: 500, fill: muted });

  palettes.forEach((p, i) => {
    const y = top + i * (rowH + gap);
    const c = p.colors;
    const allPass = p.checks.every((x) => x.pass);
    body += svg.text({ x: M, y: y + 34, lines: [`${p.n}  ${p.name}`], size: 30, weight: 700, fill: ink });
    body += svg.text({ x: W - M, y: y + 34, lines: [allPass ? 'All pairs pass' : 'Use the main color for large text only'], size: 20, weight: 600, fill: allPass ? '#1d7a46' : '#9a5a00', anchor: 'end' });
    // Strip: proportional blocks, rounded at the ends.
    const sy = y + 58;
    const sh = 196;
    const shares = [0.34, 0.16, 0.14, 0.12, 0.12, 0.12];
    const keys = ['primary', 'accent', 'ink', 'muted', 'surface', 'paper'];
    const labels = ['Main', 'Accent', 'Text', 'Muted', 'Soft', 'Page'];
    const sw = W - M * 2;
    const clipId = `strip${i}`;
    let x = M;
    let blocks = '';
    keys.forEach((k, j) => {
      const w = j === keys.length - 1 ? M + sw - x : Math.round(sw * shares[j]);
      const fill = c[k];
      const on = readableOn(fill, ink, '#ffffff');
      blocks += svg.rect({ x, y: sy, w, h: sh, fill });
      blocks += svg.text({ x: x + 18, y: sy + 36, lines: [labels[j]], size: j === 0 ? 24 : 19, weight: 700, fill: on });
      blocks += svg.text({ x: x + 18, y: sy + sh - 22, lines: [fill.toUpperCase()], size: j === 0 ? 24 : 17, weight: 600, fill: on, font: svg.FONTS.sans, letterSpacing: 0.5 });
      x += w;
    });
    body += `<clipPath id="${clipId}"><rect x="${M}" y="${sy}" width="${sw}" height="${sh}" rx="22"/></clipPath><g clip-path="url(#${clipId})">${blocks}</g>`;
    body += svg.rect({ x: M + 0.5, y: sy + 0.5, w: sw - 1, h: sh - 1, r: 22, fill: 'none', stroke: '#000000', strokeWidth: 1, opacity: 0.1 });
    // Usage preview: a button, a text sample, a tag.
    const py = sy + sh + 26;
    const btn = svg.pill({ x: M, y: py - 4, label: 'Book now', size: 22, weight: 700, fill: c.primary, color: c.onPrimary, padX: 1.1, padY: 0.55 });
    body += btn.svg;
    const tag = svg.pill({ x: M + btn.width + 16, y: py - 4, label: 'New', size: 20, weight: 700, fill: c.accent, color: c.onAccent, padX: 0.9, padY: 0.6 });
    body += tag.svg;
    const textX = M + btn.width + tag.width + 44;
    body += svg.text({ x: textX, y: py + 30, lines: [`Body text ${p.checks[0].ratio}:1, button ${p.checks[1].ratio}:1`], size: 20, weight: 500, fill: muted });
  });
  return svg.doc({ width: W, height: H, background: '#ffffff', body, title: `Brand colors ${business}`.trim() });
}

module.exports = { threePalettes, withFirst, buildPalette, checks, cssVars, colorName, board, ROLES, readablePair, accentsFor, strongPrimary };
