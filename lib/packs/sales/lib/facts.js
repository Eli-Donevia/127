// The member's own facts for every sales tool, in one flat object: business name and contact line,
// what they sell and for how much, their payment link and terms, colors, currency and paper size,
// plus the niche profile (data/niches.json) that fills the gaps in drafts.
// Order: the tool's input wins, then what the sales desk remembered, then the business brain, then
// other packs' memory (offer, brand), then the niche. Nothing here is invented about anyone.

const { text, money, time, brain, color, web } = require('../../_kit');
const { profileFor, fillDeep } = require('./niche');
const memory = require('./memory');
const items = require('./items');

const s = (v) => (v == null ? '' : text.oneLine(String(v)));

const CURRENCY = { US: 'USD', CA: 'CAD', GB: 'GBP', UK: 'GBP', AU: 'AUD', NZ: 'NZD', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', PT: 'EUR', AT: 'EUR', FI: 'EUR' };
const LETTER = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'CR', 'PA', 'DO', 'PR']);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const SITE_RE = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,]*)?/i;

// "maria@sparkle.example, (512) 555-0142, sparkleclean.example" -> { email, phone, website }
function contactFrom(line) {
  const t = s(line);
  const out = { email: '', phone: '', website: '' };
  if (!t) return out;
  const e = t.match(EMAIL_RE);
  if (e) out.email = e[0];
  const rest = e ? t.replace(e[0], ' ') : t;
  const p = rest.match(PHONE_RE);
  if (p && p[0].replace(/\D/g, '').length >= 7) out.phone = p[0].trim();
  const rest2 = p ? rest.replace(p[0], ' ') : rest;
  const w = rest2.match(SITE_RE);
  if (w && !/^\d/.test(w[0])) out.website = w[0].replace(/[.,;]+$/, '');
  return out;
}

// A payment link the member pasted: https only (bare domains get https://), or '' if it isn't a link.
function cleanLink(v) {
  const t = s(v);
  if (!t || /\s/.test(t)) return '';
  const u = web.normalizeUrl(t.replace(/^http:\/\//i, 'https://'));
  return u && /^https:\/\//.test(u) ? u : '';
}

function hexFrom(v) {
  if (typeof v === 'string' && color.isHex(v.trim())) return v.trim();
  return null;
}

// A brand color another pack saved (brand.palette.primary, brand.primary, ...), if it's a hex.
function brandColor(ctx) {
  const m = brain.packMemory(ctx, 'brand');
  const cands = [m.palette && m.palette.primary, m.palette && m.palette.brand, m.primary, m.color, m.brandColor, Array.isArray(m.colors) ? m.colors[0] : null, m.colors && m.colors.primary];
  for (const c of cands) if (hexFrom(c)) return hexFrom(c);
  return null;
}

// The member's offer as the offer pack saved it, if it did: { what, who, outcome, price, ... }.
function offerMemory(ctx) {
  const m = brain.packMemory(ctx, 'offer');
  return m.offer && typeof m.offer === 'object' ? m.offer : {};
}

function factsOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const set = memory.settings(ctx);
  const from = input.from && typeof input.from === 'object' ? input.from : {};
  const typed = contactFrom(input.contact || from.contact || '');
  const offerMem = offerMemory(ctx);
  const what = s(b.what || offerMem.what || b.niche || b.offer);
  const profile = profileFor({ niche: b.niche, what, offer: b.offer || offerMem.outcome });
  const country = String(b.country || 'US').toUpperCase();
  const currency = String(input.currency || set.currency || CURRENCY[country] || 'USD').toUpperCase().slice(0, 3);
  const firstName = s(b.firstName || (ctx && ctx.member && ctx.member.firstName));
  const name = s(from.name || b.name || set.name);
  const email = s(from.email || typed.email || set.email);
  const phone = s(from.phone || typed.phone || set.phone);
  const website = s(from.website || typed.website || set.website || b.website);
  const address = s(from.address || input.address || set.address);
  const seedHex = hexFrom(input.color) || hexFrom(set.color) || brandColor(ctx);
  const seed = seedHex || profile.mood || 'clean';
  const pal = color.palette(seed, seedHex ? 0 : text.hash(name || what) % 2);
  const price = money.num(input.price != null && input.price !== '' ? input.price : b.price != null ? b.price : offerMem.price, null);
  const taxIn = input.taxRate != null && input.taxRate !== '' ? input.taxRate : set.taxRate;
  const dep = items.parseDeposit(input.deposit != null && input.deposit !== '' ? input.deposit : set.deposit, input.depositAmount);
  // Only a promise the member made goes in front of a client. The one for their kind of work is a
  // suggestion the run shows them (a free redo or a refund is theirs to offer).
  const promise = s(input.promise || set.promise || offerMem.promise || offerMem.guarantee);
  const vars = { effort: profile.effort, job: profile.job, buyer: profile.buyer };
  const prof = fillDeep(profile, vars);
  const missing = [];
  if (!name) missing.push('business name');
  if (!email && !phone) missing.push('contact line');
  const today = time.today(ctx);
  return {
    name,
    displayName: name || (firstName ? `${firstName}` : 'Your business'),
    hasName: !!name,
    firstName,
    signOff: [firstName, name].filter(Boolean).join('\n'),
    what,
    offer: s(b.offer || offerMem.outcome),
    audience: s(b.audience || offerMem.who),
    price,
    priceText: price != null ? items.money(Math.round(price * 100), currency, { short: true }) : '',
    place: b.place,
    city: b.city,
    country,
    timezone: b.timezone,
    tone: b.tone,
    instagram: b.instagram,
    email,
    phone,
    website: website ? web.shortSite(website) || website : '',
    websiteUrl: website ? web.normalizeUrl(website) || '' : '',
    address,
    payLink: cleanLink(input.payLink || set.payLink),
    payNote: s(input.payNote || set.payNote),
    // With no deposit: paid when the work is done, in full when they book (coaching, lessons,
    // packages), or each month in advance (a monthly service).
    payWhen: /book/i.test(String(input.payWhen || '')) ? 'booking' : /month/i.test(String(input.payWhen || '')) ? 'monthly' : 'done',
    taxRate: items.parseTax(taxIn),
    taxTyped: taxIn != null && taxIn !== '',
    deposit: dep.rate,
    depositCents: dep.amountCents,
    terms: s(input.terms || set.terms),
    promise,
    promiseIdea: promise ? '' : s(profile.promiseIdea),
    currency,
    paper: LETTER.has(country) ? 'letter' : 'A4',
    palette: pal,
    colorFrom: hexFrom(input.color) ? 'the color you picked' : hexFrom(set.color) ? 'your saved color' : brandColor(ctx) ? 'your brand kit' : 'a color picked for your kind of business',
    profile: prof,
    arch: prof.arch,
    job: prof.job,
    buyer: prof.buyer,
    b2b: prof.b2b,
    today,
    year: Number(today.slice(0, 4)),
    missing,
    settings: set,
  };
}

// The settings a run was given that are worth remembering for next time.
function settingsPatch(input = {}, f = {}) {
  const typed = contactFrom(input.contact || '');
  const from = input.from && typeof input.from === 'object' ? input.from : {};
  return {
    payLink: cleanLink(input.payLink) || undefined,
    payNote: s(input.payNote) || undefined,
    taxRate: input.taxRate != null && input.taxRate !== '' && f.taxRate != null ? f.taxRate : undefined,
    deposit: input.deposit != null && input.deposit !== '' && f.deposit != null ? f.deposit : undefined,
    terms: s(input.terms) || undefined,
    email: s(from.email || typed.email) || undefined,
    phone: s(from.phone || typed.phone) || undefined,
    website: s(from.website || typed.website) || undefined,
    address: s(from.address || input.address) || undefined,
    color: hexFrom(input.color) || undefined,
    currency: input.currency ? String(input.currency).toUpperCase().slice(0, 3) : undefined,
    promise: s(input.promise) || undefined,
    name: s(from.name) || undefined,
  };
}

module.exports = { factsOf, settingsPatch, contactFrom, cleanLink, brandColor, offerMemory, CURRENCY };
