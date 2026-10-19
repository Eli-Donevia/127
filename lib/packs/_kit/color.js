// Color math for sites, flyers, logos and email templates: parse, mix, WCAG contrast, and a
// palette builder that always returns readable text pairs (AA, 4.5:1 for body text).

function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function isHex(s) {
  return !!hexToRgb(s);
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio, 1 to 21.
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Near-black or white, whichever reads better on bg.
function readableOn(bg, dark = '#111111', light = '#ffffff') {
  return contrast(bg, dark) >= contrast(bg, light) ? dark : light;
}

function mix(a, b, t = 0.5) {
  const x = hexToRgb(a) || [0, 0, 0];
  const y = hexToRgb(b) || [255, 255, 255];
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
}

const lighten = (hex, t) => mix(hex, '#ffffff', t);
const darken = (hex, t) => mix(hex, '#000000', t);

function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

// Darken (or lighten) fg until it reaches `ratio` against bg.
function ensureContrast(fg, bg, ratio = 4.5) {
  let c = fg;
  const towardDark = luminance(bg) > 0.4;
  for (let i = 0; i < 20 && contrast(c, bg) < ratio; i++) c = towardDark ? darken(c, 0.12) : lighten(c, 0.12);
  return c;
}

// Moods map to a hue range and saturation so "warm" or "calm" gives a believable brand color.
const MOODS = {
  bold: { hues: [350, 15, 220, 265], s: 0.78, l: 0.5 },
  calm: { hues: [190, 205, 160, 230], s: 0.42, l: 0.42 },
  warm: { hues: [18, 28, 38, 8], s: 0.7, l: 0.5 },
  fresh: { hues: [140, 160, 95, 175], s: 0.55, l: 0.42 },
  premium: { hues: [40, 220, 0, 160], s: 0.3, l: 0.3 },
  playful: { hues: [320, 280, 45, 190], s: 0.75, l: 0.58 },
  earthy: { hues: [30, 85, 20, 60], s: 0.35, l: 0.38 },
  clean: { hues: [210, 220, 200, 230], s: 0.6, l: 0.48 },
};

// A small, safe palette: { primary, onPrimary, accent, ink, paper, surface, muted, line }.
// seed: a hex color (their logo color) or a mood name; variant picks between options.
function palette(seed = 'clean', variant = 0) {
  let primary;
  if (isHex(seed)) primary = rgbToHex(hexToRgb(seed));
  else {
    const m = MOODS[seed] || MOODS.clean;
    primary = hslToHex(m.hues[variant % m.hues.length], m.s, m.l);
  }
  const [h, s] = rgbToHsl(hexToRgb(primary));
  const accent = hslToHex(h + (variant % 2 ? 150 : 30), Math.min(0.85, s + 0.1), 0.55);
  const paper = hslToHex(h, Math.min(0.25, s * 0.3), 0.975);
  const ink = hslToHex(h, Math.min(0.3, s * 0.4), 0.12);
  const surface = hslToHex(h, Math.min(0.3, s * 0.35), 0.93);
  const muted = ensureContrast(hslToHex(h, Math.min(0.15, s * 0.2), 0.42), paper, 4.5);
  const line = hslToHex(h, Math.min(0.2, s * 0.25), 0.85);
  const safePrimary = ensureContrast(primary, paper, 3);
  return {
    primary: safePrimary,
    onPrimary: readableOn(safePrimary),
    accent,
    onAccent: readableOn(accent),
    ink,
    paper,
    surface,
    muted,
    line,
  };
}

module.exports = { hexToRgb, rgbToHex, isHex, luminance, contrast, readableOn, mix, lighten, darken, rgbToHsl, hslToHex, ensureContrast, palette, MOODS };
