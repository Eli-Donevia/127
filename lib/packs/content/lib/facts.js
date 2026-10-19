// The member's facts in one flat object for every content tool: the business, what it sells, where,
// who buys, the price, the call to action (keyword plus what they get) and the colors. Input wins
// over the brain, the brain wins over the niche defaults. Nothing here is invented: when a fact is
// missing the copy leaves it out instead of guessing.

const { brain, text, color, time } = require('../../_kit');
const { matchNiche, lowerFirst, cleanService, own } = require('./niches');

// "Busy parents and commuters in North Austin" -> "North Austin"
function areaOf(audience) {
  const m = String(audience || '').match(/\b(?:in|around|near|across|throughout)\s+((?:the\s+)?(?:[A-Z][\w'.]*\s*){1,4})/);
  return m ? m[1].trim().replace(/[.,;:]+$/, '') : '';
}

// "Busy parents and commuters in North Austin" -> { buyers: 'busy parents and commuters', noun: 'parents' }
function buyersOf(audience) {
  let a = String(audience || '').replace(/\b(?:in|around|near|across|throughout|who|that|with)\b.*$/i, '').trim();
  a = a.replace(/[.,;:]+$/, '');
  if (!a) return { buyers: '', noun: '' };
  const first = a.split(/\s+(?:and|or|&)\s+|,\s*/i)[0].trim();
  const words = first.split(/\s+/);
  return { buyers: lowerFirst(a), noun: lowerFirst(words[words.length - 1] || '') };
}

// "quote" -> "QUOTE"; letters and digits only, short enough to type in a comment.
function cleanKeyword(k) {
  return String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

// What the member promises to send. "my price list" -> "I'll send you my price list".
function promiseOf(magnet, fallback) {
  const m = text.oneLine(magnet || '').replace(/[.!]+$/, '');
  if (!m) return fallback;
  if (/^(i'll|i will|i'll|get|grab)\b/i.test(m)) return text.sentenceCase(m);
  return `I'll send you ${lowerFirst(m)}`;
}

function hexOrEmpty(v) {
  return color.isHex(v) ? color.rgbToHex(color.hexToRgb(v)) : '';
}

function factsOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const mem = brain.packMemory(ctx, 'content');
  const dm = brain.packMemory(ctx, 'dm');
  const brand = brain.packMemory(ctx, 'brand');
  // An onboarding answer ("Local business") names no business, so it never picks the niche or the
  // service: brainOf leaves it out of b.niche and keeps it as b.category.
  const niche = matchNiche({ niche: b.niche, what: own(b.what), offer: own(b.offer), name: b.name, category: b.category });
  const audience = b.audience;
  const { buyers, noun } = buyersOf(audience);
  const area = text.oneLine(input.area || '') || areaOf(audience) || b.city;
  const keyword = cleanKeyword(input.keyword) || cleanKeyword(mem.keyword) || cleanKeyword(dm.keyword) || niche.cta.keyword;
  const promise = promiseOf(input.magnet || mem.magnet || dm.magnet || dm.freebie, niche.cta.promise);
  const said = own(b.niche) || own(b.what) || own(b.offer);
  const service = niche.key === 'generic' ? cleanService(said || 'your service') : niche.service;
  const what = text.oneLine(b.what || '');
  const mobile = /\bmobile\b|we come to you|come to you|at your (home|house|office|door)|on[- ]site|in your driveway/i.test(`${b.what} ${b.offer}`);
  const month = time.partsIn(time.nowMs(ctx), b.timezone || time.tzOf(ctx)).m;
  const seed = hexOrEmpty(input.color) || hexOrEmpty(brand.primary) || hexOrEmpty(brand.colors && brand.colors.primary) || hexOrEmpty(brand.palette && brand.palette.primary) || niche.mood || 'clean';
  const f = {
    name: b.name,
    first: b.firstName,
    what,
    offer: text.oneLine(b.offer || ''),
    service,
    // Nothing says what they sell yet: no live searches, and the copy leans on "your" instead.
    vague: niche.key === 'generic' && !said,
    short: niche.short,
    thing: niche.thing,
    pro: niche.pro,
    buyers: buyers || niche.buyers,
    buyerNoun: noun || niche.buyers.split(' ').pop(),
    audience,
    city: b.city,
    region: b.region,
    place: b.place,
    area,
    where: area || b.city,
    local: !!(niche.local && (area || b.city)),
    mobile,
    price: b.price,
    priceText: b.price != null ? b.priceText : '',
    keyword,
    promise,
    handle: b.instagram || b.tiktok || '',
    website: b.website,
    tone: b.tone,
    month,
    seed,
    niche,
    brain: b,
  };
  // Files start with the business name, or what they sell; never "your-service".
  f.fileBase = f.name || (f.vague ? '' : f.service);
  f.ctaLine = `Comment ${f.keyword} and ${lowerFirst(f.promise)}.`;
  f.dmLine = `DM me ${f.keyword} and ${lowerFirst(f.promise)}.`;
  f.replyLine = `Reply ${f.keyword} and ${lowerFirst(f.promise)}.`;
  f.intro = introOf(f);
  f.palette = color.palette(seed, text.hash(b.name || service) % 2);
  return f;
}

// "Assume nothing: say who you are every time." One short line the scripts open with.
function introOf(f) {
  const where = f.where ? ` in ${f.where}` : '';
  if (f.first && f.name) return `I'm ${f.first} from ${f.name}${where}.`;
  if (f.name) return `This is ${f.name}${where}.`;
  if (f.first) return f.vague ? `I'm ${f.first}${f.where ? `, here in ${f.where}` : ''}.` : `I'm ${f.first}, and I do ${f.service}${where}.`;
  return '';
}

// "@reyesdetails" or the business name, for slide footers.
function signature(f) {
  if (f.handle) return `@${f.handle}`;
  return f.name || '';
}

module.exports = { factsOf, areaOf, buyersOf, cleanKeyword, promiseOf, introOf, signature };
