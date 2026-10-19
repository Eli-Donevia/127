// The member's facts for every offer tool, in one flat object: what they sell, who for, the result,
// their own numbers (price, cost, hours, capacity) and the niche profile that fills the gaps.
// Input wins over the brain; the brain wins over the niche defaults. Every default a draft leans on
// is listed in `assumed`, so the member sees what to check before using it.

const { text, money, time, brain, color } = require('../../_kit');
const { profileFor } = require('./niches');

const MOOD_BY_ARCH = { home_service: 'fresh', personal_service: 'warm', teach: 'calm', b2b_service: 'bold', product: 'warm', digital: 'clean', food: 'warm' };

const s = (v) => text.oneLine(v == null ? '' : String(v));
const lower1 = (v) => {
  const t = s(v);
  return t && /^[A-Z][a-z]/.test(t) && !/^(I|I'm|I'll)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
};
const posNum = (v) => {
  const n = money.num(v, null);
  return n != null && n > 0 ? n : null;
};

function validDate(v) {
  const t = s(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(t)) ? t : '';
}

// Northern hemisphere seasons by month unless the business is south of the equator.
const SOUTH = new Set(['AU', 'NZ', 'ZA', 'AR', 'CL', 'UY', 'BR']);
function seasonOf(dateStr, country = 'US') {
  const m = Number(String(dateStr).slice(5, 7));
  const names = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'];
  let season = names[(m || 1) - 1];
  if (SOUTH.has(String(country || '').toUpperCase())) season = { winter: 'summer', summer: 'winter', spring: 'fall', fall: 'spring' }[season];
  return season;
}

// The brand color: an input hex, then the brand pack's saved palette, then a mood for the niche.
function paletteFor(ctx, input, arch) {
  const brandMem = brain.packMemory(ctx, 'brand');
  const saved = brandMem.palette && (brandMem.palette.primary || brandMem.palette.brand);
  const seed = [input.brandColor, input.color, saved].find((c) => color.isHex(c)) || MOOD_BY_ARCH[arch] || 'clean';
  const p = color.palette(seed, text.hash(input.what || '') % 2);
  return { ...p, seed };
}

function factsOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const mem = brain.packMemory(ctx, 'offer');
  const savedOffer = mem.offer && typeof mem.offer === 'object' ? mem.offer : {};
  const what = s(input.what || b.what || b.niche || savedOffer.what || b.offer);
  // A "what" typed for this run wins over the saved business, so its buyer and result come along.
  const typed = !!input.what && !profileFor(input.what).generic && profileFor(input.what).nicheId !== profileFor(b.niche || b.what || '').nicheId;
  const profile = typed ? profileFor(input.what, input.who) : profileFor(what, b.niche, input.who, b.offer);
  const assumed = [];
  const who = lower1(input.who || (typed ? '' : b.audience || savedOffer.who)) || (assumed.push('who it is for'), profile.who);
  const outcome = lower1(input.outcome || (typed ? '' : savedOffer.outcome)) || (assumed.push('the result buyers want'), profile.outcome);
  const price = posNum(input.price != null ? input.price : b.price != null ? b.price : savedOffer.price);
  const cost = posNum(input.cost);
  const hours = posNum(input.hours);
  const perHour = posNum(input.perHour);
  const capacity = posNum(input.capacity) ? Math.round(posNum(input.capacity)) : null;
  const capacityPer = ['day', 'week', 'month'].includes(input.capacityPer) ? input.capacityPer : 'week';
  const today = time.today(ctx);
  const mobile = /\b(mobile|come to you|comes to you|at your (home|house|door|office|place)|on[- ]?site|in[- ]home|house ?calls?)\b/i.test(`${what} ${b.offer} ${input.offer || ''}`) || ['petcare', 'lawn', 'snow', 'washing', 'cleaning', 'handyman'].includes(profile.nicheId);
  const facts = {
    business: s(b.name),
    firstName: s(b.firstName),
    what: what || profile.archLabel,
    whatShort: text.clip(what || profile.archLabel, 60),
    who,
    outcome,
    price,
    cost,
    hours,
    perHour,
    capacity,
    capacityPer,
    startDate: validDate(input.startDate),
    city: s(b.city),
    place: s(b.place),
    country: b.country || 'US',
    instagram: b.instagram,
    website: b.website,
    phone: s(input.phone),
    tone: b.tone,
    mobile,
    today,
    year: Number(today.slice(0, 4)),
    season: seasonOf(today, b.country),
    profile,
    arch: profile.arch,
    unit: profile.unit,
    units: profile.units,
    customer: profile.customer,
    customers: profile.customers,
    assumed,
    palette: paletteFor(ctx, input, profile.arch),
  };
  if (price == null) assumed.push('your price');
  return facts;
}

// "a session" / "an order"
function a(word) {
  return text.withA(word);
}

function cap(t) {
  return text.sentenceCase(t);
}

// When the first result shows up, as buyer-facing sentences. Hours only mean "how long the job
// takes" for services done in one visit or session.
function whenLine(f) {
  const p = f.profile;
  const job = (f.arch === 'home_service' || f.arch === 'personal_service') && f.hours && f.hours <= 12;
  const h = job ? `Done in about ${f.hours} ${f.hours === 1 ? 'hour' : 'hours'}. ` : '';
  return `${h}${p.firstLine}.`;
}

// How the member is reached, from what they gave us: Instagram, website, phone, or "text me".
function ctaOf(f, keyword) {
  const kw = keyword ? String(keyword).toUpperCase() : '';
  if (f.instagram) return kw ? `DM @${f.instagram} the word ${kw}` : `DM @${f.instagram} to book`;
  if (f.phone) return kw ? `Text ${kw} to ${f.phone}` : `Text ${f.phone} to book`;
  if (f.website) return `Book at ${f.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return kw ? `Message me the word ${kw}` : 'Message me to book';
}

module.exports = { factsOf, seasonOf, paletteFor, a, cap, ctaOf, whenLine, lower1, MOOD_BY_ARCH };
