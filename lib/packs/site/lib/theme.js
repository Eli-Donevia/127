// Colors and type for a site. The member's color (a hex, a color name like "navy" or "sage", or a
// mood like "warm") seeds a palette from kit color; every text pair is checked for contrast (4.5:1
// for body text, 3:1 for large text and buttons). Fonts are a Google Fonts pair per design with a
// system stack behind it, so the page still looks right with fonts off.

const { color, text } = require('../../_kit');

const NAMED = {
  black: '#141414', charcoal: '#2f3437', gray: '#4b5563', grey: '#4b5563', slate: '#475569', silver: '#8a9099',
  navy: '#1f3a5f', blue: '#2563eb', cobalt: '#0047ab', sky: '#0284c7', 'baby blue': '#7fb3e0', indigo: '#4338ca',
  teal: '#0f766e', turquoise: '#0e9f8f', aqua: '#0891b2', mint: '#2f9e7a', green: '#15803d', emerald: '#047857',
  forest: '#1f5135', 'forest green': '#1f5135', 'hunter green': '#2d5a3d', olive: '#6b7a3a', sage: '#6f8f72', lime: '#5e9c12',
  yellow: '#d4a106', gold: '#b8872b', mustard: '#c9971c', orange: '#ea580c', peach: '#f08a5d', coral: '#f05d4f',
  red: '#d62828', crimson: '#b0122b', burgundy: '#7a1f2b', maroon: '#7b1e2e', wine: '#722f37', terracotta: '#c0573e',
  rust: '#b7410e', brown: '#7c4a2d', chocolate: '#5b3a29', tan: '#b88a5a', beige: '#b9a27f', sand: '#c2a878', cream: '#c9b48a',
  pink: '#db2777', 'hot pink': '#e11d74', blush: '#d98a94', rose: '#e11d48', 'dusty rose': '#b5727b', mauve: '#9c6b8a',
  purple: '#7c3aed', violet: '#6d28d9', lavender: '#8b7bc4', lilac: '#a38bd0', plum: '#6b2d5c',
};

const MOOD_WORDS = [
  [/\b(bold|loud|strong|energetic|vibrant|bright)\b/i, 'bold'],
  [/\b(calm|soft|peaceful|serene|gentle|quiet)\b/i, 'calm'],
  [/\b(warm|cozy|friendly|inviting|sunny)\b/i, 'warm'],
  [/\b(fresh|natural|eco|green|organic|clean living)\b/i, 'fresh'],
  [/\b(premium|luxury|luxe|elegant|classy|upscale|high.?end|dark)\b/i, 'premium'],
  [/\b(playful|fun|bubbly|cute|quirky|colorful|colourful)\b/i, 'playful'],
  [/\b(earthy|rustic|boho|organic|neutral|muted)\b/i, 'earthy'],
  [/\b(clean|modern|minimal|simple|professional|corporate|techy|tech)\b/i, 'clean'],
];

const DEFAULT_MOODS = {
  'local-service': ['clean', 'bold', 'fresh', 'clean'],
  studio: ['earthy', 'warm', 'premium', 'calm'],
  restaurant: ['warm', 'bold', 'earthy', 'warm'],
  coach: ['calm', 'earthy', 'warm', 'fresh'],
  product: ['playful', 'bold', 'fresh', 'clean'],
  creator: ['playful', 'bold', 'warm', 'calm'],
  agency: ['bold', 'clean', 'premium', 'playful'],
  portfolio: ['premium', 'clean', 'calm', 'bold'],
};

// "navy and gold" -> { primary: '#1f3a5f', accent: '#b8872b' }; "#7a1f2b" -> { primary }; "warm" -> { mood }
function readColor(input) {
  const s = String(input || '').toLowerCase();
  const hexes = (s.match(/#?\b[0-9a-f]{6}\b|#[0-9a-f]{3}\b/g) || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).filter((h) => color.isHex(h));
  const names = Object.keys(NAMED)
    .sort((a, b) => b.length - a.length)
    .reduce((acc, n) => {
      const i = s.search(new RegExp(`\\b${n}\\b`));
      if (i >= 0 && !acc.some((x) => x.n.includes(n))) acc.push({ n, i });
      return acc;
    }, [])
    .sort((a, b) => a.i - b.i)
    .map((x) => NAMED[x.n]);
  const found = [...hexes.map((h) => color.rgbToHex(color.hexToRgb(h))), ...names];
  const moodHit = MOOD_WORDS.find(([re]) => re.test(s));
  return { primary: found[0] || null, accent: found[1] || null, mood: moodHit ? moodHit[1] : null };
}

// Near-white or near-black primaries can't carry buttons; fold them into a mood instead.
function usablePrimary(hex) {
  if (!hex) return null;
  const [, s, l] = color.rgbToHsl(color.hexToRgb(hex));
  if (l > 0.9) return null;
  if (l < 0.08 && s < 0.2) return '#1c1c1e';
  return hex;
}

function paletteFor(templateId, colorText, seedName) {
  const r = readColor(colorText);
  const variant = text.hash(seedName || 'site') % 4;
  const primary = usablePrimary(r.primary);
  const mood = r.mood || DEFAULT_MOODS[templateId][variant];
  // Calm designs keep the accent next to the brand color on the color wheel; bolder ones may contrast.
  const analogous = ['studio', 'coach', 'restaurant', 'portfolio'].includes(templateId);
  const p = color.palette(primary || mood, primary ? (analogous ? 0 : variant % 2) : analogous ? variant - (variant % 2) : variant);
  if (r.accent && color.contrast(r.accent, p.paper) >= 1.6) {
    p.accent = r.accent;
    p.onAccent = color.readableOn(r.accent);
  }
  return { ...p, source: primary ? 'your color' : r.mood ? `a ${mood} mood` : `a ${mood} palette picked for this design` };
}

// Every token a template uses. bg can be overridden (a cream studio, a white product page).
function tokens(p, { bg, dark } = {}) {
  const paper = bg || p.paper;
  const ink = color.contrast(p.ink, paper) >= 12 ? p.ink : color.ensureContrast(p.ink, paper, 12);
  const deep = dark || color.mix(p.ink, '#000000', 0.25);
  const primary = p.primary;
  const t = {
    bg: paper,
    surface: color.mix(p.surface, paper, 0.35),
    surface2: p.surface,
    ink,
    muted: color.ensureContrast(p.muted, paper, 4.6),
    line: color.mix(p.line, paper, 0.25),
    primary,
    onPrimary: color.readableOn(primary),
    primaryText: color.ensureContrast(primary, paper, 4.6),
    primarySoft: color.mix(primary, paper, 0.88),
    primaryTint: color.mix(primary, paper, 0.72),
    primaryDeep: color.ensureContrast(color.darken(primary, 0.35), paper, 7),
    accent: p.accent,
    onAccent: color.readableOn(p.accent),
    accentSoft: color.mix(p.accent, paper, 0.82),
    dark: deep,
    onDark: color.contrast(paper, deep) >= 7 ? paper : '#ffffff',
    mutedOnDark: color.ensureContrast(color.mix(paper, deep, 0.38), deep, 4.6),
    primaryOnDark: color.ensureContrast(color.lighten(primary, 0.08), deep, 4.6),
    lineOnDark: color.mix(paper, deep, 0.84),
    focus: color.ensureContrast(primary, paper, 3.2),
  };
  // A button's own text must clear 4.5:1; nudge the button color, not the text.
  if (color.contrast(t.onPrimary, primary) < 4.5) {
    const toward = t.onPrimary === '#ffffff' ? color.darken : color.lighten;
    let c = primary;
    for (let i = 0; i < 12 && color.contrast(t.onPrimary, c) < 4.5; i++) c = toward(c, 0.08);
    t.button = c;
  } else t.button = primary;
  t.onButton = t.onPrimary;
  t.buttonHover = color.contrast('#ffffff', t.button) > color.contrast('#111111', t.button) ? color.darken(t.button, 0.12) : color.lighten(t.button, 0.12);
  return t;
}

function cssVars(t, extra = {}) {
  const map = {
    bg: t.bg, surface: t.surface, 'surface-2': t.surface2, ink: t.ink, muted: t.muted, line: t.line,
    primary: t.primary, 'on-primary': t.onPrimary, 'primary-text': t.primaryText, 'primary-soft': t.primarySoft, 'primary-tint': t.primaryTint, 'primary-deep': t.primaryDeep,
    accent: t.accent, 'on-accent': t.onAccent, 'accent-soft': t.accentSoft,
    dark: t.dark, 'on-dark': t.onDark, 'muted-on-dark': t.mutedOnDark, 'primary-on-dark': t.primaryOnDark, 'line-on-dark': t.lineOnDark,
    button: t.button, 'on-button': t.onButton, 'button-hover': t.buttonHover, focus: t.focus,
    ...extra,
  };
  return `:root{${Object.entries(map).map(([k, v]) => `--${k}:${v}`).join(';')}}`;
}

const STACK = {
  sans: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  serif: '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif',
  grotesk: '"Avenir Next","Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif',
};

const FONTS = {
  'local-service': { q: 'family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600', display: ['Archivo', 'grotesk'], body: ['Inter', 'sans'] },
  studio: { q: 'family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600', display: ['Fraunces', 'serif'], body: ['DM Sans', 'sans'] },
  restaurant: { q: 'family=DM+Serif+Display:ital@0;1&family=Work+Sans:wght@400;500;600', display: ['DM Serif Display', 'serif'], body: ['Work Sans', 'sans'] },
  coach: { q: 'family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600', display: ['Instrument Serif', 'serif'], body: ['Inter', 'sans'] },
  product: { q: 'family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600', display: ['Inter Tight', 'sans'], body: ['Inter', 'sans'] },
  creator: { q: 'family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600', display: ['Bricolage Grotesque', 'grotesk'], body: ['Inter', 'sans'] },
  agency: { q: 'family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500', display: ['Space Grotesk', 'grotesk'], body: ['Inter', 'sans'] },
  portfolio: { q: 'family=Syne:wght@600;700;800&family=Inter:wght@400;500;600', display: ['Syne', 'grotesk'], body: ['Inter', 'sans'] },
};

// { head: '<link ...>' or '', display: css font-family, body: css font-family, names }
function fontsFor(templateId, mode = 'google') {
  const f = FONTS[templateId] || FONTS['local-service'];
  const fam = ([name, stack]) => `"${name}",${STACK[stack]}`;
  const head =
    mode === 'system'
      ? ''
      : `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${f.q}&amp;display=swap">`;
  return { head, display: fam(f.display), body: fam(f.body), names: [f.display[0], f.body[0]], url: `https://fonts.googleapis.com/css2?${f.q}&display=swap` };
}

module.exports = { readColor, paletteFor, tokens, cssVars, fontsFor, NAMED, DEFAULT_MOODS, STACK, FONTS };
