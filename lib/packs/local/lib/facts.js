// The member's business facts for local kits, in one clean object. The form's answers win, then what
// this pack saved earlier (brain.packs.local.settings), then what other packs saved (the sales desk's
// settings, the brand pack's color), then the business brain. Nothing is invented: a fact the member
// didn't give stays empty and the kits leave that part out.

const { text, brain, color, web } = require('../../_kit');
const NICHES = require('../data/niches.json');

const PACK = 'local';
const MAX_BYTES = 3800;

// Groups are tried in this order, so "gutter cleaning" lands in exterior washing, not house cleaning.
const ORDER = ['auto', 'washing', 'cleaning', 'yard', 'tech', 'home', 'pets', 'beauty', 'fitness', 'chef', 'food', 'music', 'lessons', 'bizphoto', 'events', 'pro', 'retail', 'general'];
const GROUPS = ORDER.map((id) => NICHES.groups.find((g) => g.id === id)).filter(Boolean);

function str(v) {
  return v == null ? '' : text.oneLine(String(v));
}

function pick(...vals) {
  for (const v of vals) if (v != null && String(v).trim() !== '') return str(v);
  return '';
}

function groupFor(blob, id) {
  if (id) {
    const g = GROUPS.find((x) => x.id === id);
    if (g) return g;
  }
  const s = String(blob || '').toLowerCase();
  // The earliest match wins ("lawn mowing and yard cleanup" is yard work, not cleaning); ties keep ORDER.
  let best = null;
  let at = Infinity;
  for (const g of GROUPS) {
    if (!g.match || g.id === 'general') continue;
    const m = new RegExp(`(${g.match})`, 'i').exec(s);
    if (m && m.index < at) {
      best = g;
      at = m.index;
    }
  }
  return best || GROUPS.find((g) => g.id === 'general');
}

// "Weekly mow, from $45" for flyers and posts.
function serviceLine(sv) {
  if (!sv || !sv.name) return '';
  if (sv.price == null) return sv.name;
  return `${sv.name}, ${sv.from ? 'from ' : ''}$${sv.price}${sv.unit ? ` ${sv.unit}` : ''}`;
}

function primaryCategory(group, blob) {
  const s = String(blob || '').toLowerCase();
  const hit = (group.categories || []).find((c) => c.match && new RegExp(`(${c.match})`, 'i').test(s));
  const fallback = (group.categories || []).find((c) => !c.match);
  return (hit || fallback || {}).name || '';
}

function schemaType(group, blob) {
  const s = String(blob || '').toLowerCase();
  const hit = (group.schema_match || []).find((m) => new RegExp(`(${m.match})`, 'i').test(s));
  return (hit && hit.type) || group.schema || 'LocalBusiness';
}

// "512.555.0142" -> { display: "(512) 555-0142", e164: "+15125550142", digits: "5125550142" }.
// Non-US numbers keep what the member typed, with a + form when they wrote one.
function parsePhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 || (digits.length === 11 && digits[0] === '1')) {
    const d = digits.slice(-10);
    return { display: `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`, e164: `+1${d}`, digits: d, dashed: `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` };
  }
  if (digits.length >= 7 && digits.length <= 15) return { display: s.replace(/[^\d+()\s.-]/g, '').trim(), e164: s.startsWith('+') ? `+${digits}` : digits, digits, dashed: s };
  return null;
}

function parseEmail(raw) {
  const m = String(raw || '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
  return m ? m[0].toLowerCase() : '';
}

// "Full detail, $180" / "Interior detail - $120" / "Weekly mowing" -> { name, price }
function parseServices(raw) {
  const lines = Array.isArray(raw) ? raw : String(raw || '').split(/\r?\n|;/);
  const out = [];
  for (const line of lines) {
    const item = typeof line === 'object' && line ? `${line.name || ''}${line.price != null ? `, $${line.price}` : ''}` : String(line || '');
    // A bullet or a list number goes ("1. ", "2) ", "- "); a number that is part of the name stays ("30-minute lesson").
    const clean = item.replace(/^\s*(?:[*•·–—-]+\s*|\(?\d{1,2}[.)]\s+)/, '').trim();
    if (!clean) continue;
    // "Full detail, 180", "Weekly mow, from 45", "Wash and fold, 1.75 per lb", "Deep clean $220+"
    const m = clean.match(/^(.*?)(?:\s*[,:]\s*|\s+-\s+|\s+(?=\$)|\s+(?=(?:from|starting at)\s))(?:(from|starting at)\s+)?\$?\s?(\d[\d,]*(?:\.\d{1,2})?)\s*(\+|and up|(?:per|\/)\s?[a-z][a-z ]{0,20})?\s*$/i);
    const name = text.clip((m && m[1]) || clean, 60).replace(/[,:\s]+$/, '');
    const price = m && m[3] ? Number(m[3].replace(/,/g, '')) : null;
    const tail = (m && m[4]) || '';
    if (name) out.push({ name, price, from: !!(m && (m[2] || /\+|and up/i.test(tail))), unit: /^(per|\/)/i.test(tail) ? tail.replace(/^\//, 'per ').trim() : '' });
    if (out.length >= 12) break;
  }
  return out;
}

function hexOf(v) {
  const s = String(v || '').trim();
  const m = s.match(/#?([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  return m ? `#${m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]}`.toLowerCase() : '';
}

function settingsOf(ctx, packId) {
  const m = brain.packMemory(ctx, packId);
  return m && m.settings && typeof m.settings === 'object' ? m.settings : {};
}

function brandColor(ctx) {
  const m = brain.packMemory(ctx, 'brand');
  const cands = [m.primary, m.color, m.brandColor, m.palette && m.palette.primary, Array.isArray(m.colors) ? m.colors[0] : null, m.colors && m.colors.primary];
  return cands.map(hexOf).find(Boolean) || '';
}

// Everything a local kit needs to know, from the tool input and the member's brain.
function factsOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const mine = settingsOf(ctx, PACK);
  const sales = settingsOf(ctx, 'sales');
  const name = pick(input.business, input.name, b.name, mine.name, sales.name);
  const what = pick(input.what, b.what, b.niche);
  const offer = pick(input.offer, b.offer);
  const blob = [what, b.niche, offer, name, input.services].filter(Boolean).join(' ');
  // What the member typed for this run wins over older brain facts.
  const own = [input.what, input.business, input.name, input.services].filter(Boolean).join(' ');
  const typedGroup = own ? groupFor(own, input.group) : null;
  const group = typedGroup && typedGroup.id !== 'general' ? typedGroup : groupFor(blob, input.group);
  const mobileWords = /\b(mobile|we come to you|come to you|at your (home|house|office|door|place)|in your (driveway|home|yard)|on-?site|house calls?|door to door)\b/i.test(blob);
  const fixedWords = /\b(shop|studio|salon|store|storefront|suite|office at)\b/i.test(blob);
  const mobile = mobileWords || (group.mobile && !fixedWords);
  const phone = parsePhone(pick(input.phone, mine.phone, sales.phone));
  const email = parseEmail(pick(input.email, mine.email, sales.email));
  const website = web.normalizeUrl(pick(input.website, b.website, mine.website, sales.website)) || '';
  const booking = web.normalizeUrl(pick(input.booking, input.bookingUrl, mine.booking)) || '';
  const city = pick(input.city, b.city);
  const region = pick(input.region, input.state, b.region);
  const place = [city, region].filter(Boolean).join(', ');
  const area = pick(input.area, mine.area, city);
  const colorSeed = hexOf(input.color) || hexOf(mine.color) || brandColor(ctx) || hexOf(sales.color) || '';
  const variant = text.hash(name || what || 'local') % 4;
  const pal = color.palette(colorSeed || group.mood, colorSeed ? 0 : variant);
  let services = parseServices(input.services);
  const priceNum = b.price != null && Number.isFinite(Number(b.price)) ? Number(b.price) : null;
  if (!services.length && offer) services = [{ name: text.clip(offer, 60), price: priceNum, from: false }];
  return {
    name: name || 'Your business',
    hasName: !!name,
    firstName: pick(input.firstName, b.firstName),
    what,
    niche: b.niche,
    offer,
    price: priceNum,
    priceText: pick(b.priceText, priceNum != null ? `$${priceNum}` : ''),
    audience: b.audience,
    city,
    region,
    place,
    area,
    country: b.country || 'US',
    timezone: b.timezone,
    phone,
    email,
    website,
    booking,
    instagram: b.instagram,
    founding: pick(input.founding),
    promise: pick(input.promise),
    services,
    group,
    groupId: group.id,
    mobile,
    category: primaryCategory(group, blob),
    schemaType: schemaType(group, blob),
    colorSeed,
    palette: pal,
    blob,
  };
}

// Saves what the member typed so the next local workflow doesn't ask again (one small key).
async function saveSettings(ctx, patch = {}) {
  const cur = settingsOf(ctx, PACK);
  const next = { ...cur };
  let changed = false;
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') continue;
    const val = typeof v === 'string' ? text.clip(v, 300) : v;
    if (JSON.stringify(cur[k]) !== JSON.stringify(val)) {
      next[k] = val;
      changed = true;
    }
  }
  if (!changed) return false;
  while (JSON.stringify(next).length > MAX_BYTES) {
    const longest = Object.keys(next).sort((a, c) => JSON.stringify(next[c]).length - JSON.stringify(next[a]).length)[0];
    delete next[longest];
  }
  await brain.remember(ctx, 'settings', next);
  return true;
}

// The best link for "scan to book": the booking page, else the website, else a text message.
function actionLink(f, { campaign, source = 'print', medium = 'qr' } = {}) {
  const tag = (url) => {
    if (!campaign) return url;
    try {
      const u = new URL(url);
      if (/g\.page|google\.|goo\.gl|facebook\.com|instagram\.com/i.test(u.hostname)) return url;
      if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', source);
      if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', medium);
      if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', text.slug(campaign, 30));
      return u.toString();
    } catch {
      return url;
    }
  };
  if (f.booking) return { kind: 'booking', url: tag(f.booking), label: 'Scan to book', short: web.shortSite(f.booking) };
  if (f.website) return { kind: 'website', url: tag(f.website), label: 'Scan for prices', short: web.shortSite(f.website) };
  if (f.phone) return { kind: 'text', url: `SMSTO:${f.phone.e164}:Hi! I saw your ${source === 'print' ? 'flyer' : 'post'}. Could I get a price?`, label: 'Scan to text us', short: f.phone.display };
  return null;
}

module.exports = { factsOf, settingsOf, saveSettings, serviceLine, groupFor, primaryCategory, schemaType, parsePhone, parseEmail, parseServices, hexOf, actionLink, GROUPS, NICHES, PACK };
