// The member's values for each Store token (STORE-SCHEMA.md, Tokens), read from ctx.brain, the
// member and the Make it mine form. A token with nothing to say is left out, so it falls back.

const HEX = /^#[0-9A-Fa-f]{6}$/;
const BUSINESS = ['name', 'what', 'offer', 'price', 'audience', 'city', 'region', 'address'];
const LINKS = ['website', 'booking', 'instagram', 'tiktok', 'youtube'];
const COLOR_KEY = /^(primary|color|colour|brand|brandColor|brand_color|accent)$/i;

const clean = (v) =>
  v == null || typeof v === 'object'
    ? ''
    : String(v)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 400);
const hex = (v) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : null);

// A hex color some pack saved: the brand pack first (its palette, as the site and finance packs read
// it), then the sales desk's settings, then any other pack's saved color, then the site pack's.
function brandColor(brain) {
  const packs = (brain && brain.packs && typeof brain.packs === 'object' && brain.packs) || {};
  const m = packs.brand && typeof packs.brand === 'object' ? packs.brand : {};
  const sales = (packs.sales && packs.sales.settings) || {};
  const first = [m.palette && m.palette.primary, m.palette && m.palette.brand, m.primary, m.color, m.brandColor, Array.isArray(m.colors) ? m.colors[0] : null, m.colors && m.colors.primary, sales.color];
  for (const c of first) if (hex(c)) return hex(c);
  // Any other pack's memory, two levels deep: { color: '#...' } or { palette: { primary: '#...' } }.
  const look = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 2) return null;
    for (const [k, v] of Object.entries(o)) if (COLOR_KEY.test(k) && hex(v)) return hex(v);
    for (const v of Object.values(o)) {
      const got = v && typeof v === 'object' && !Array.isArray(v) ? look(v, depth + 1) : null;
      if (got) return got;
    }
    return null;
  };
  for (const [id, mem] of Object.entries(packs)) {
    if (id === 'brand' || id === 'sales' || id === 'site') continue;
    const got = look(mem, 0);
    if (got) return got;
  }
  return look(packs.site, 0);
}

function zoneOf(brain) {
  const tz = brain && brain.business && brain.business.timezone;
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {
    /* not a real zone */
  }
  return 'America/Chicago';
}

// "October 20, 2026" and "2026" in the member's time zone (Your business, else Chicago).
function dateIn(ms, tz) {
  const d = new Date(ms);
  return {
    today: new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' }).format(d),
    year: new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(d),
  };
}

const looksLikeEmail = (s) => /^[^\s@<>"]{1,64}@[^\s@<>"]{1,180}\.[a-z]{2,}$/i.test(s);
const handle = (s) => (s && !/^https?:\/\//i.test(s) && !s.startsWith('@') && /^[\w.]{1,40}$/.test(s) ? `@${s}` : s);

// { 'business.name': 'Northside Lawn Care', ... } for the tokens the member has a value for.
function valuesFor({ brain = {}, member = {}, inputs = {}, now = Date.now() } = {}) {
  const out = {};
  const biz = brain.business || {};
  for (const k of BUSINESS) {
    let v = clean(biz[k]);
    if (k === 'price' && /^\d+(\.\d{1,2})?$/.test(v)) v = `$${v}`;
    if (v) out[`business.${k}`] = v;
  }
  const links = brain.links || {};
  for (const k of LINKS) {
    let v = clean(links[k]);
    if (k === 'instagram' || k === 'tiktok') v = handle(v);
    if (v) out[`links.${k}`] = v;
  }
  const first = clean(member.firstName);
  if (first) out['owner.first'] = first;
  const color = brandColor(brain);
  if (color) out['brand.color'] = color;
  const email = clean(inputs.email);
  if (email && looksLikeEmail(email)) out['contact.email'] = email;
  const phone = clean(inputs.phone).slice(0, 40);
  if (phone && /\d/.test(phone)) out['contact.phone'] = phone;
  Object.assign(out, dateIn(now, zoneOf(brain)));
  return out;
}

module.exports = { valuesFor, brandColor, zoneOf, dateIn };
