// Shared plumbing for the brand tools: who the business is (from the tool input, then the brain),
// which colors to use (a palette step's output, a palette, or a seed), and PNG rendering that
// quietly returns null when this run can't render.

const { brain, text, color, media } = require('../../_kit');
const { nicheFor } = require('./lexicon');
const { craftsFrom } = require('./names');
const P = require('./palettes');

const NOT_YET = [
  "Don't spend days on a logo before your first yes. Pick one of these, use it, and change it later if customers ask.",
  "Don't pay for a trademark filing, a logo designer or printed merch until people are paying you.",
  "Don't buy ten domains or build a full website yet. One domain and a simple page are enough to start.",
];

// A palette step's output, one palette, a colors object, or an approved pick (array) -> colors.
function colorsFrom(p) {
  if (!p || typeof p !== 'object') return null;
  if (Array.isArray(p)) return colorsFrom(p[0]);
  if (Array.isArray(p.palettes)) return colorsFrom(p.palettes[0]);
  if (p.colors) return colorsFrom(p.colors);
  if (color.isHex(p.primary) && color.isHex(p.paper) && color.isHex(p.ink)) return p;
  return null;
}

const KEYS = ['primary', 'onPrimary', 'accent', 'onAccent', 'ink', 'paper', 'surface', 'muted', 'line'];

// The colors a brand refresh saved (brain.packs.brand.colors), as a palette. A sample run saves none.
function savedColors(ctx) {
  const s = brain.packMemory(ctx, 'brand').colors;
  if (!s || typeof s !== 'object' || !KEYS.every((k) => color.isHex(s[k]))) return null;
  return Object.fromEntries(KEYS.map((k) => [k, s[k]]));
}

// A concept id from a string, a concept object or an approve step's chosen list.
function conceptFrom(c, fallback = 'monogram') {
  if (!c) return fallback;
  if (Array.isArray(c)) return conceptFrom(c[0], fallback);
  if (typeof c === 'string') return c;
  if (typeof c === 'object' && c.id) return c.id;
  return fallback;
}

// HQ fills an empty niche with the member's onboarding answer ("Local business"), which names no
// business, so it never becomes what the brand says the business does (the kit's brainOf keeps it
// as b.category, and ownWords drops it from what the member typed).
const own = brain.ownWords;

function specFrom(input, ctx) {
  const b = brain.brainOf(ctx, input);
  const name = text.oneLine(input.name || b.name || '');
  const what = text.oneLine(input.what || own(b.what) || own(b.niche) || own(b.offer) || '');
  const niche = nicheFor(input.what ? what : `${what} ${own(b.niche)}`);
  const city = text.oneLine(input.city || b.place || '');
  const seed = String(input.color || '').trim().toLowerCase();
  const mood = color.MOODS[seed] ? seed : color.MOODS[input.mood] ? input.mood : niche.mood;
  const saved = !seed && !input.palette ? savedColors(ctx) : null;
  const palette = colorsFrom(input.palette) || saved;
  const colors = palette || P.threePalettes(color.isHex(seed) ? seed : mood, { mood })[0].colors;
  const craft = craftsFrom(what)[0];
  // Nothing says what they sell: the onboarding category ("Local service") or "small business" labels it.
  const category = text.oneLine(b.category || '');
  const descriptor = craft || text.titleCase(niche.id === 'generic' ? (what || category || niche.label).split(/\s+/).slice(0, 3).join(' ') : niche.label);
  // The saved price belongs to the saved business: drop it when the member typed a different one.
  const same = !input.what || !b.what || nicheFor(b.what).id === niche.id;
  const price = same ? b.price : null;
  const offer = same ? b.offer || null : null;
  // known: the member's own words or a niche we know say what they sell (not a category or "small business").
  return { name, what, city, niche, mood, icon: niche.icon, descriptor, known: niche.id !== 'generic' || !!what, colors, firstName: b.firstName, price, offer, brain: b, seed: seed || (saved ? saved.primary : mood), saved: !!saved };
}

async function png(ctx, svgString, opts = {}) {
  if (!media.canRender(ctx)) return null;
  try {
    return await media.svgToPng(ctx, svgString, opts);
  } catch (e) {
    if (ctx && typeof ctx.log === 'function') ctx.log(`Couldn't draw a PNG (${String(e.message || e).slice(0, 80)}), the SVG is in the zip`);
    return null;
  }
}

module.exports = { specFrom, colorsFrom, conceptFrom, savedColors, png, own, NOT_YET };
