// Reads what members type into the form (services with prices, links, reviews, phone, email) into
// clean data. Forgiving on purpose: "Full detail, $180, inside and out", "Full detail - $180" and
// "Full detail $180" all work, one per line or separated by semicolons.

const { text, money, web } = require('../../_kit');

// Lines from a textarea, a semicolon list or an array.
function lines(v) {
  if (Array.isArray(v)) return v.flatMap(lines);
  return String(v == null ? '' : v)
    .split(/\r?\n|;\s*/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
}

const UNITS = {
  hour: ['hour', 'hr', '/hr'],
  day: ['day', 'day', '/day'],
  week: ['week', 'wk', '/wk'],
  month: ['month', 'mo', '/mo'],
  year: ['year', 'yr', '/yr'],
  visit: ['visit', 'visit', 'a visit'],
  session: ['session', 'session', 'a session'],
  class: ['class', 'class', 'a class'],
  lesson: ['lesson', 'lesson', 'a lesson'],
  person: ['person', 'person', 'a person'],
  car: ['car', 'car', 'a car'],
  room: ['room', 'room', 'a room'],
  walk: ['walk', 'walk', 'a walk'],
  night: ['night', 'night', 'a night'],
  pet: ['pet', 'pet', 'a pet'],
  item: ['item', 'item', 'each'],
  dozen: ['dozen', 'dozen', 'a dozen'],
  property: ['property', 'property', 'a property'],
};
const UNIT_RE = '(hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|visits?|sessions?|class(?:es)?|lessons?|persons?|people|cars?|rooms?|walks?|nights?|pets?|items?|each|dozen|propert(?:y|ies))';
const PRICE_RE = new RegExp(`(?:\\b(from|starting at|starts at|starting from)\\s+)?\\$\\s?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{2}))?(\\+)?(?:\\s*(?:\\/|per|an?|each)\\s*${UNIT_RE}\\b|\\s+(each)\\b)?`, 'i');

function unitKey(raw) {
  const u = String(raw || '').toLowerCase();
  if (!u) return null;
  if (/^h/.test(u)) return 'hour';
  if (/^d(?!o)/.test(u)) return 'day';
  if (/^w(?!a)/.test(u)) return 'week';
  if (/^mo/.test(u)) return 'month';
  if (/^y/.test(u)) return 'year';
  if (/^vi/.test(u)) return 'visit';
  if (/^se/.test(u)) return 'session';
  if (/^cl/.test(u)) return 'class';
  if (/^le/.test(u)) return 'lesson';
  if (/^pe(r|o)/.test(u)) return 'person';
  if (/^ca/.test(u)) return 'car';
  if (/^ro/.test(u)) return 'room';
  if (/^wa/.test(u)) return 'walk';
  if (/^ni/.test(u)) return 'night';
  if (/^pet/.test(u)) return 'pet';
  if (/^(it|ea)/.test(u)) return 'item';
  if (/^do/.test(u)) return 'dozen';
  if (/^pr/.test(u)) return 'property';
  return null;
}

const SEP_END = /[\s,:;|(\-\u2013\u2014]+$/;
const SEP_START = /^[\s,:;|)\-\u2013\u2014]+/;

// "$180", "From $95", "$40/hr", "$150/mo", "$12 each"
function priceText({ amount, from, plus, unit }) {
  if (amount == null) return '';
  const u = unit && UNITS[unit];
  const tail = u ? (u[2].startsWith('/') ? u[2] : ` ${u[2]}`) : '';
  return `${from ? 'From ' : ''}${money.usd(amount)}${plus && !from ? '+' : ''}${tail}`;
}

// One service line -> { name, price, priceText, unit, from, description, category }
function parseService(line, category) {
  const raw = text.oneLine(line);
  const m = raw.match(PRICE_RE);
  if (!m) {
    const parts = raw.split(/\s*(?:[:|]|\s-\s|,\s)\s*/);
    const base = { name: clean(parts[0]), price: null, priceText: '', unit: null, from: false, description: clean(parts.slice(1).join(', ')), category };
    return { ...base, ...durationOf(base.name, base.description), name: durationOf(base.name, base.description).name || base.name };
  }
  const amount = Number(m[2].replace(/,/g, '')) + (m[3] ? Number(m[3]) / 100 : 0);
  const unit = unitKey(m[5] || m[6]);
  const before = raw.slice(0, m.index).replace(SEP_END, '');
  const after = raw.slice(m.index + m[0].length).replace(SEP_START, '');
  let name = clean(before);
  let description = clean(after);
  if (!name && description) {
    const parts = description.split(/\s*(?:[:|]|\s-\s|,\s)\s*/);
    name = clean(parts[0]);
    description = clean(parts.slice(1).join(', '));
  }
  const s = { name, price: amount, unit, from: !!m[1], plus: !!m[4], category, description, ...durationOf(name, description) };
  s.name = s.name || name;
  s.priceText = priceText({ amount, from: s.from, plus: s.plus, unit });
  return s;
}

// "Dog walk, 30 min" -> name "Dog walk", duration "30 min" (salon and studio menus show it).
// Only a duration that stands on its own: at the start, at the end, or as its own part ("Dog walk, 30 min",
// "Cut (45 min)", "2 hours on site"), never inside a phrase ("up to 2 hours at your place").
const DURATION = /(?:^|[\s,(])(\d{1,3}(?:\.\d)?)\s*(min|mins|minutes|hr|hrs|hours?)\b\)?/gi;
function durationMatch(val) {
  const s = String(val || '');
  for (const m of s.matchAll(DURATION)) {
    const before = s.slice(0, m.index).trim();
    const after = s.slice(m.index + m[0].length);
    const ownPart = /^[,(]/.test(m[0]) || /[,(;]$/.test(before);
    if (!before || (ownPart && /^\s*(?:$|[,;)])/.test(after))) return m;
  }
  return null;
}
function durationOf(name, description) {
  for (const [key, val] of [['name', name], ['description', description]]) {
    const m = durationMatch(val);
    if (m) {
      const n = m[1];
      const unit = /^h/i.test(m[2]) ? (Number(n) === 1 ? 'hour' : 'hours') : 'min';
      const rest = clean(String(val).replace(m[0], ' ').replace(/\s{2,}/g, ' '));
      return { duration: `${n} ${unit}`, [key]: rest };
    }
  }
  return {};
}

function clean(s) {
  return text.sentenceCase(text.oneLine(String(s || '').replace(SEP_END, '').replace(SEP_START, '')));
}

// Lines like "Cuts:" or "# Color" start a category (menus, salon lists).
function parseServices(input, { max = 24 } = {}) {
  const out = [];
  let category = null;
  for (const l of lines(input)) {
    if (/^#\s*\S/.test(l) || (/:\s*$/.test(l) && !PRICE_RE.test(l))) {
      category = clean(l.replace(/^#\s*/, '').replace(/:\s*$/, ''));
      continue;
    }
    const s = parseService(l, category);
    if (s.name) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// Menus are services with categories; dietary tags like (V) or (GF) are kept as tags.
function parseMenu(input) {
  const items = parseServices(input, { max: 60 }).map((s) => {
    const tags = [];
    const name = s.name.replace(/\s*\((v|vg|gf|df|vegan|veg|spicy)\)\s*/gi, (_, t) => {
      tags.push(t.toUpperCase().replace('VEGAN', 'VG').replace('VEG', 'V'));
      return ' ';
    });
    return { ...s, name: name.trim(), tags };
  });
  const sections = [];
  for (const it of items) {
    const title = it.category || 'Menu';
    let sec = sections.find((x) => x.title === title);
    if (!sec) sections.push((sec = { title, items: [] }));
    sec.items.push(it);
  }
  return sections;
}

// ---------- contact ----------

function parsePhone(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, '');
  const d = digits.replace(/\D/g, '');
  if (d.length < 7) return null;
  if (d.length === 10 || (d.length === 11 && d.startsWith('1'))) {
    const n = d.slice(-10);
    return { display: `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`, href: `tel:+1${n}`, e164: `+1${n}` };
  }
  const plus = digits.startsWith('+') ? digits : `+${d}`;
  return { display: text.oneLine(s), href: `tel:${plus}`, e164: plus };
}

function parseEmail(v) {
  const s = String(v || '').trim().replace(/^mailto:/i, '');
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s) ? s.toLowerCase() : null;
}

// ---------- links ----------

const PLATFORMS = [
  [/calendly\.com|cal\.com|acuityscheduling|squarespacescheduling|setmore|simplybook|meetings\.hubspot|calendar\.app\.google|tidycal/i, 'Book a time', 'booking'],
  [/vagaro|booksy|fresha|glossgenius|styleseat|schedulicity|boulevard|joinblvd|squareup\.com\/appointments|book\.squareup|mindbody|janeapp/i, 'Book an appointment', 'booking'],
  [/opentable|resy\.com|exploretock|sevenrooms/i, 'Reserve a table', 'reserve'],
  [/doordash/i, 'Order on DoorDash', 'order'],
  [/ubereats/i, 'Order on Uber Eats', 'order'],
  [/grubhub/i, 'Order on Grubhub', 'order'],
  [/toasttab|chownow|olo\.com|square\.site|clover\.com|order\.online|popmenu|getbento/i, 'Order online', 'order'],
  [/buy\.stripe\.com|checkout\.stripe|paypal\.me|venmo|cash\.app|gumroad|lemonsqueezy|stan\.store|payhip|ko-fi/i, 'Buy now', 'buy'],
  [/myshopify\.com|shopify|etsy\.com|amazon\.|bigcartel|square\.link/i, 'Shop now', 'buy'],
  [/youtube\.com|youtu\.be/i, 'Watch on YouTube', 'social'],
  [/instagram\.com/i, 'Instagram', 'social'],
  [/tiktok\.com/i, 'TikTok', 'social'],
  [/facebook\.com|fb\.com/i, 'Facebook', 'social'],
  [/linkedin\.com/i, 'LinkedIn', 'social'],
  [/(^|\.)x\.com|twitter\.com/i, 'X', 'social'],
  [/spotify\.com|podcasts\.apple|anchor\.fm/i, 'Listen to the podcast', 'listen'],
  [/substack\.com|beehiiv\.com|kit\.com|convertkit|buttondown/i, 'Read the newsletter', 'newsletter'],
  [/vimeo\.com/i, 'Watch the reel', 'work'],
  [/behance\.net|dribbble\.com/i, 'See my work', 'work'],
  [/github\.com/i, 'GitHub', 'work'],
  [/docs\.google\.com\/forms|forms\.gle|typeform|tally\.so|jotform/i, 'Fill out the form', 'form'],
  [/wa\.me|whatsapp/i, 'Message on WhatsApp', 'message'],
  [/maps\.app\.goo\.gl|google\.com\/maps|g\.page/i, 'Find us on Google Maps', 'maps'],
];

function platformOf(url) {
  const hit = PLATFORMS.find(([re]) => re.test(String(url || '')));
  return hit ? { label: hit[1], kind: hit[2] } : { label: '', kind: 'link' };
}

function cleanUrl(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^mailto:/i.test(s)) return parseEmail(s) ? `mailto:${parseEmail(s)}` : null;
  if (/^tel:/i.test(s)) return s;
  return web.normalizeUrl(s);
}

// "Label | https://..." or "Label: url" or a bare url. Returns [{ label, href, kind }].
function parseLinks(input, { max = 12 } = {}) {
  const out = [];
  for (const l of lines(input)) {
    const m = l.match(/(https?:\/\/\S+|mailto:\S+|tel:\S+|(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?)/i);
    if (!m) continue;
    const href = cleanUrl(m[1].replace(/[),.]+$/, ''));
    if (!href) continue;
    let label = clean(l.replace(m[0], ' ').replace(/\s*[|>]\s*$/, '').replace(/^\s*[|>]\s*/, ''));
    const p = platformOf(href);
    if (!label) label = p.label || text.titleCase(web.domainOf(href) || 'Link');
    out.push({ label: text.clip(label, 48), href, kind: p.kind });
    if (out.length >= max) break;
  }
  return out;
}

// Real reviews the member pastes: "Ana R. | Best detail I've had" or "Best detail I've had - Ana R."
function parseReviews(input, { max = 6 } = {}) {
  const out = [];
  for (const l of lines(input)) {
    let name = '';
    let quote = l;
    const pipe = l.split(/\s*\|\s*/);
    if (pipe.length >= 2) {
      const [a, b] = pipe;
      if (a.split(/\s+/).length <= 4 && b.length > a.length) {
        name = a;
        quote = pipe.slice(1).join(' ');
      } else {
        quote = a;
        name = pipe.slice(1).join(' ');
      }
    } else {
      const m = l.match(/^(.*\S)\s+(?:-|\u2013|\u2014)\s+([A-Z][\w.' ]{1,30})$/);
      if (m) {
        quote = m[1];
        name = m[2];
      }
    }
    quote = text.oneLine(quote).replace(/^["“]+|["”]+$/g, '');
    if (quote.length >= 8) out.push({ name: text.oneLine(name), quote: text.clip(quote, 280) });
    if (out.length >= max) break;
  }
  return out;
}

// Portfolio pieces: "Spring menu shoot | A Des Moines bistro | https://..." (detail and link optional).
// Returns [{ title, detail, href, linkLabel }]. Only https links are kept.
const WATCH = [
  [/tiktok\.com/i, 'Watch on TikTok'],
  [/instagram\.com/i, 'See it on Instagram'],
  [/youtube\.com|youtu\.be/i, 'Watch on YouTube'],
  [/vimeo\.com/i, 'Watch on Vimeo'],
];
function parseWork(input, { max = 9 } = {}) {
  const out = [];
  for (const l of lines(input)) {
    const m = l.match(/https?:\/\/\S+/i);
    const url = m ? cleanUrl(m[0].replace(/[),.]+$/, '')) : null;
    const href = url && /^https:\/\//.test(url) ? url : null;
    const parts = (m ? l.replace(m[0], ' ') : l).split(/\s*\|\s*|\s+-\s+/).map((x) => clean(x)).filter(Boolean);
    if (!parts.length) continue;
    const watch = href ? WATCH.find(([re]) => re.test(href)) : null;
    out.push({ title: text.clip(parts[0], 60), detail: text.clip(parts.slice(1).join(', '), 120), href, linkLabel: href ? (watch ? watch[1] : 'See it') : '' });
    if (out.length >= max) break;
  }
  return out;
}

// Clients or brands the member may name (they said yes), one per line.
function parseClients(input, { max = 12 } = {}) {
  return lines(input).map((l) => text.clip(text.oneLine(l), 40)).filter(Boolean).slice(0, max);
}

// Instagram/TikTok/YouTube handles or URLs to full profile URLs.
function socialUrl(kind, v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || /\.(com|be)\//i.test(s)) return web.normalizeUrl(s);
  const h = s.replace(/^@/, '').replace(/[^\w.-]/g, '');
  if (!h) return null;
  if (kind === 'instagram') return `https://www.instagram.com/${h}/`;
  if (kind === 'tiktok') return `https://www.tiktok.com/@${h}`;
  if (kind === 'youtube') return `https://www.youtube.com/@${h}`;
  if (kind === 'facebook') return `https://www.facebook.com/${h}`;
  if (kind === 'x') return `https://x.com/${h}`;
  if (kind === 'linkedin') return `https://www.linkedin.com/in/${h}`;
  return null;
}

function handleOf(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean);
    const last = seg[seg.length - 1] || '';
    return last ? `@${last.replace(/^@/, '')}` : '';
  } catch {
    return '';
  }
}

module.exports = { lines, parseService, parseServices, parseMenu, priceText, parsePhone, parseEmail, parseLinks, parseReviews, parseWork, parseClients, platformOf, cleanUrl, socialUrl, handleOf, PRICE_RE };
