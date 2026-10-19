// Reads ctx.brain (harness contract 6b) into one flat, safe object. Every field can be missing,
// so tools call brainOf(ctx, input) and get strings (never undefined) plus a list of what's missing.
// A tool's own input wins over the brain: { business: 'Glow Candle Co', city: 'Austin, TX' }.

const { plain } = require('./text');
const { num } = require('./money');

const FIELDS = ['name', 'what', 'niche', 'offer', 'price', 'audience', 'city', 'region', 'country', 'timezone', 'stage'];

function str(v) {
  return v == null ? '' : plain(String(v));
}

// HQ fills an empty niche with the member's onboarding answer ("Local business", "Service, freelance
// or agency", "Not sure yet"), which names no business. A label made only of words like these is a
// category: brainOf keeps it as `category` and leaves `niche` for the member's own words, so a label
// never becomes what a pack says they sell. ownWords(s) is '' for a category.
const GENERIC = new Set(['a', 'an', 'and', 'or', 'my', 'own', 'local', 'online', 'home', 'small', 'physical', 'digital', 'creative', 'personal', 'product', 'products', 'service', 'services', 'business', 'businesses', 'biz', 'company', 'shop', 'store', 'goods', 'brand', 'agency', 'creator', 'creators', 'content', 'freelance', 'freelancer', 'freelancing', 'e-commerce', 'ecommerce', 'commerce', 'course', 'courses', 'community', 'software', 'app', 'apps', 'other', 'something', 'else', 'not', 'sure', 'yet']);
function isCategory(s) {
  const words = String(s || '').toLowerCase().split(/[^a-z-]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => GENERIC.has(w));
}
const ownWords = (s) => (s && !isCategory(s) ? String(s) : '');

function brainOf(ctx, input = {}) {
  const b = (ctx && ctx.brain) || {};
  const biz = b.business || {};
  const voice = b.voice || {};
  const links = b.links || {};
  const goal = b.goal || {};
  const member = (ctx && ctx.member) || {};
  const pick = (...vals) => {
    for (const v of vals) if (v != null && String(v).trim() !== '') return str(v);
    return '';
  };
  const out = {
    name: pick(input.business, input.businessName, input.business_name, biz.name),
    what: pick(input.what, biz.what),
    niche: ownWords(pick(input.niche, biz.niche)),
    category: isCategory(pick(input.niche, biz.niche)) ? pick(input.niche, biz.niche) : '',
    offer: pick(input.offer, biz.offer),
    price: num(input.price != null ? input.price : biz.price, null),
    priceText: pick(input.priceText, typeof biz.price === 'string' ? biz.price : ''),
    audience: pick(input.audience, biz.audience),
    city: pick(input.city, biz.city),
    region: pick(input.region, input.state, biz.region),
    country: pick(input.country, biz.country) || 'US',
    timezone: pick(biz.timezone, member.timezone) || 'America/Chicago',
    stage: pick(input.stage, biz.stage),
    tone: pick(input.tone, voice.tone),
    avoid: pick(voice.avoid),
    website: pick(input.website, links.website),
    instagram: pick(input.instagram, links.instagram).replace(/^@/, ''),
    tiktok: pick(input.tiktok, links.tiktok).replace(/^@/, ''),
    youtube: pick(input.youtube, links.youtube),
    northNumber: pick(goal.northNumber),
    buildTarget: pick(goal.buildTarget),
    // The member's mailing address (contract 6b, v1.2): the line every marketing email needs.
    address: pick(input.myAddress, biz.address),
    firstName: pick(member.firstName),
    numbers: Array.isArray(b.numbers) ? b.numbers : [],
  };
  if (!out.priceText && out.price != null) out.priceText = `$${out.price}`;
  out.place = [out.city, out.region].filter(Boolean).join(', ');
  out.missing = FIELDS.filter((f) => f !== 'timezone' && f !== 'country' && !out[f] && out[f] !== 0);
  return out;
}

// What a pack saved earlier with ctx.remember (stored under brain.packs.<packId>).
function packMemory(ctx, packId) {
  const p = ctx && ctx.brain && ctx.brain.packs && ctx.brain.packs[packId];
  return p && typeof p === 'object' ? p : {};
}

async function remember(ctx, key, value) {
  if (ctx && typeof ctx.remember === 'function') {
    try {
      await ctx.remember(key, value);
    } catch {
      /* best effort: the run still succeeds */
    }
  }
}

// One short paragraph about the business for AI prompts ("Name: ... What: ..."), only known fields.
function describe(br) {
  const rows = [
    ['Business', br.name],
    ['What it does', br.what],
    ['Niche', br.niche],
    ['Kind of business', br.category],
    ['Offer', br.offer],
    ['Price', br.priceText],
    ['Who it serves', br.audience],
    ['Where', br.place],
    ['Stage', br.stage],
    ['Tone', br.tone],
    ['Avoid', br.avoid],
    ['Website', br.website],
    ['Instagram', br.instagram && `@${br.instagram}`],
  ].filter(([, v]) => v);
  return rows.map(([k, v]) => `${k}: ${v}`).join('\n') || 'No business details yet.';
}

module.exports = { brainOf, packMemory, remember, describe, isCategory, ownWords, FIELDS };
