// The member's look for video: colors from their brand (the brand pack's saved palette, a color
// they typed, or their website's colors), else a palette that fits their kind of business. Video
// wants a deep background, a bright "pop" for the spoken word and a box color for titles.

const { color, brain } = require('../../_kit');

const MOOD_BY_NICHE = [
  [/tutor|school|teach|learn|coach|consult|therap|counsel|account|bookkeep|law|finance/i, 'calm'],
  [/detail|car|auto|wash|clean|pressure|plumb|electric|hvac|roof|repair|handy|moving|junk/i, 'bold'],
  [/lawn|garden|landscap|plant|farm|tree|organic|outdoor/i, 'fresh'],
  [/bak|cafe|coffee|food|restaurant|candle|cook|chef|cater|soap/i, 'warm'],
  [/salon|beauty|spa|nail|lash|brow|wedding|jewel|photo|interior|design|real estate/i, 'premium'],
  [/kid|pet|dog|cat|groom|party|toy|craft|art/i, 'playful'],
];

function hexFrom(v) {
  return typeof v === 'string' && color.isHex(v.trim()) ? v.trim() : null;
}

// Where the color comes from, in order: the input, what the brand pack saved, a site scan's colors,
// then a mood that fits the business.
function seedFor(ctx, input = {}, b = {}, extra = {}) {
  const typed = hexFrom(input.color);
  if (typed) return { seed: typed, from: 'your color' };
  const mem = brain.packMemory(ctx, 'brand');
  const pal = mem.palette || mem.colors || {};
  const saved = [pal.primary, mem.primary, mem.color, Array.isArray(mem.colors) ? mem.colors[0] : null].map(hexFrom).find(Boolean);
  if (saved) return { seed: saved, from: 'your brand kit' };
  const site = extra.siteColors && hexFrom(extra.siteColors.primary);
  if (site) return { seed: site, from: 'their website' };
  const hay = [b.niche, b.what, b.name].join(' ');
  const mood = (MOOD_BY_NICHE.find(([re]) => re.test(hay)) || [null, 'bold'])[1];
  return { seed: mood, from: `a ${mood} palette for your kind of business` };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// Video colors from a seed (hex or mood). All hex strings.
function videoLook(seed = 'bold', variant = 0) {
  const p = color.palette(seed, variant);
  const [h, s0] = color.rgbToHsl(color.hexToRgb(p.primary));
  const s = clamp(s0, 0.42, 0.9);
  const deep = color.hslToHex(h, clamp(s * 0.85, 0.35, 0.75), 0.1);
  const mid = color.hslToHex(h + 14, clamp(s, 0.4, 0.85), 0.27);
  const glow = color.hslToHex(h - 18, clamp(s + 0.1, 0.5, 0.95), 0.48);
  // The spoken-word color: the brand accent when it stands apart from the background, else the
  // brand's complement (yellow for reds and oranges), always bright enough to read on footage.
  const [ah] = color.rgbToHsl(color.hexToRgb(p.accent));
  const dist = (a, b) => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));
  let popHue = dist(ah, h) >= 45 ? ah : (h + 180) % 360;
  if ((h >= 330 || h <= 40) && dist(popHue, 52) > 30 && dist(ah, h) < 45) popHue = 52;
  const blueish = popHue >= 200 && popHue <= 290;
  let pop = color.hslToHex(popHue, 0.92, blueish ? 0.7 : 0.6);
  if (color.contrast(pop, '#0b0b10') < 7) pop = color.hslToHex(popHue, 1, 0.72);
  // Title and highlight boxes: the brand color itself, lifted if it's too dark to see on deep.
  let box = p.primary;
  if (color.contrast(box, deep) < 2.2) box = color.hslToHex(h, clamp(s, 0.5, 0.9), 0.55);
  return {
    seed,
    primary: p.primary,
    accent: p.accent,
    ink: p.ink,
    paper: p.paper,
    surface: p.surface,
    deep,
    mid,
    glow,
    pop,
    onPop: color.readableOn(pop, '#0b0b10', '#ffffff'),
    box,
    onBox: color.readableOn(box, '#0b0b10', '#ffffff'),
    text: '#ffffff',
    outline: '#0b0b10',
  };
}

function lookFor(ctx, input, b, extra) {
  const { seed, from } = seedFor(ctx, input, b, extra);
  return { ...videoLook(seed, Number(input && input.variant) || 0), from };
}

module.exports = { lookFor, videoLook, seedFor, MOOD_BY_NICHE };
