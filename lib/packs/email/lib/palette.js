// The member's colors for guides, story frames and previews. Order: a color typed into the form,
// then what the brand pack remembered (brain.packs.brand), then a mood picked from what they sell.
// Never 127's colors. Local helper (a copy of the dm pack's, so each pack stands alone).

const { color, brain, text } = require('../../_kit');

const MOODS = [
  [/(bak|cake|cater|food|board|charcut|cafe|coffee|restaurant|chef|meal|cook|grill|bbq|pizza|taco|donut|cookie)/, 'warm'],
  [/(gym|fitness|train|coach|box|crossfit|sport|athlet|run|martial)/, 'bold'],
  [/(candle|spa|skin|beauty|salon|nail|lash|wellness|yoga|pilates|massage|esthetic)/, 'calm'],
  [/(lawn|garden|landscap|plant|flower|florist|farm|eco|clean|wash)/, 'fresh'],
  [/(tutor|school|teach|math|lesson|account|bookkeep|law|insur|consult|agency|software|web|design|video|edit)/, 'clean'],
  [/(kid|toy|party|pet|dog|cat|craft|art|gift)/, 'playful'],
  [/(wood|leather|vintage|coffee roast|farm|pottery|ceramic)/, 'earthy'],
  [/(jewel|luxury|bridal|wedding|photo|studio)/, 'premium'],
];

function hexFrom(v) {
  if (!v) return null;
  if (typeof v === 'string' && color.isHex(v)) return v.startsWith('#') ? v : `#${v}`;
  if (typeof v === 'object') {
    for (const k of ['primary', 'brand', 'main', 'color', 'hex']) if (typeof v[k] === 'string' && color.isHex(v[k])) return hexFrom(v[k]);
  }
  return null;
}

// Where the seed came from, so a view can say "your brand color" vs "picked from what you sell".
function seedFor(ctx, input = {}) {
  const typed = hexFrom(input.color);
  if (typed) return { seed: typed, from: 'your color' };
  const mem = brain.packMemory(ctx, 'brand');
  for (const k of ['primary', 'color', 'brandColor', 'palette', 'colors']) {
    const v = Array.isArray(mem[k]) ? mem[k][0] : mem[k];
    const h = hexFrom(v);
    if (h) return { seed: h, from: 'your brand kit' };
  }
  if (Array.isArray(mem.palettes) && mem.palettes.length) {
    const h = hexFrom(mem.palettes[0]);
    if (h) return { seed: h, from: 'your brand kit' };
  }
  const b = brain.brainOf(ctx, input);
  const hay = `${b.niche} ${b.what} ${b.offer} ${b.name}`.toLowerCase();
  const hit = MOODS.find(([re]) => re.test(hay));
  return { seed: hit ? hit[1] : 'clean', from: 'what you sell' };
}

function paletteFor(ctx, input = {}) {
  const { seed, from } = seedFor(ctx, input);
  const b = brain.brainOf(ctx, input);
  const variant = color.isHex(seed) ? 0 : text.hash(b.name || b.what || 'member') % 4;
  const p = color.palette(seed, variant);
  // A deep background for dark frames: the ink color, kept readable against white text.
  const deep = color.contrast(p.ink, '#ffffff') >= 7 ? p.ink : color.darken(p.ink, 0.3);
  return { ...p, deep, onDeep: '#ffffff', seed, from };
}

module.exports = { paletteFor, seedFor, hexFrom };
