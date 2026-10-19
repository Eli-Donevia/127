// Businesses found through Google Places (Legal L53: legal/handoffs/first-25.md part 1 and
// gym-video.md part 3). The Pipeline keeps a Google business's place ID and 127's own work (scores,
// gaps, website checks, the handles and email found on the business's own site, the member's
// tracker), never Google's fields: name, address, phone, website, rating, review count or Maps link.
// A Google lead's name is fetched again by place ID when it's on screen, used for that page and not
// kept, and its Maps link is built from the place ID. Tools see "[business name]" in its place, so
// the messages they write keep that placeholder, which holds Copy off until the name is filled in.
// OpenStreetMap results and everything else are stored as before.

const env = (key, fallback) => (process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key]);
const deps = { fetch: (...a) => fetch(...a), needs: () => require('./needs'), ctx: () => require('./ctx') };

const NAME = '[business name]';
// Google's fields as packs and First 25 name them; dropped from a Google lead's data before it's saved.
const GOOGLE_KEYS = new Set([
  'name', 'company', 'displayName', 'address', 'formattedAddress', 'shortFormattedAddress', 'phone', 'nationalPhoneNumber',
  'internationalPhoneNumber', 'website', 'websiteUri', 'rating', 'reviews', 'reviewCount', 'userRatingCount', 'mapsUrl', 'maps',
  'googleMapsUri', 'googleMapsLinks', 'hours', 'openingHours', 'regularOpeningHours', 'currentOpeningHours', 'priceLevel',
  'priceRange', 'businessStatus', 'location', 'lat', 'lng', 'lon', 'photos', 'attributions', 'googleMapsUrl', 'sourceUrl',
]);
// What 127 found on the business's own site, and the member's own tracker, inside a pack's data:
// a person's name from the About page is 127's work, not Google's, so names there stay.
const OWN_DATA = new Set(['site', 'contact', 'owner', 'people', 'insta', 'touches', 'followUps']);
// Links a Google lead keeps: the ones 127 found on the business's own site, and its email.
const OWN_LINKS = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'email'];
// A fact that quotes Google's numbers ("Only 23 Google reviews") is rebuilt when shown, never kept.
const QUOTES_GOOGLE = /\bgoogle\b|\b\d[\d,.]*\s*(?:stars?|reviews?|ratings?)\b|\brat(?:ed|ing)\b/i;

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
function idOf(lead) {
  if (!lead || typeof lead !== 'object') return '';
  const d = lead.data && typeof lead.data === 'object' ? lead.data : {};
  const key = String(lead.key || '');
  const raw = String(lead.placeId || d.place_id || d.placeId || (key.startsWith('gplaces:') ? key.slice(8) : '')).replace(/^g-/, '');
  return PLACE_ID.test(raw) ? raw : '';
}

const mapsLink = (id, near) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(near || 'business')}&query_place_id=${encodeURIComponent(id)}`;

const swap = (text, name) => (name && typeof text === 'string' ? text.split(name).join(NAME) : text);

// A pack's data for a Google lead, at any depth (its row for the business, the competitors it
// listed): Google's keys come out, Google's name is swapped for the placeholder, and a line that
// quotes Google's numbers ("Rated 4.8 from 120 reviews") goes, except in the member's own tracker
// and what 127 found on the site.
function clean(v, names, own = false, depth = 0) {
  if (typeof v === 'string') {
    const t = names.reduce((x, n) => swap(x, n), v);
    return !own && QUOTES_GOOGLE.test(t) && /\d/.test(t) ? undefined : t;
  }
  if (!v || typeof v !== 'object' || depth > 12) return v;
  if (Array.isArray(v)) return v.map((x) => clean(x, names, own, depth + 1)).filter((x) => x !== undefined);
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (GOOGLE_KEYS.has(k) && !(own && (k === 'name' || k === 'company'))) continue;
    const kept = clean(x, names, own || OWN_DATA.has(k), depth + 1);
    if (kept !== undefined) out[k] = kept;
  }
  return out;
}

// Called on every Pipeline write. `lead` is what the tool or import passed; `doc` is about to be
// saved. A Google lead keeps its place ID and 127's own work; any Google name that came in is
// swapped for the placeholder in its messages, facts, note and data.
function scrub(doc, lead = {}) {
  const id = idOf(doc) || idOf(lead);
  if (!id) return doc;
  doc.placeId = id;
  const names = [lead.name, lead.company, doc.name, doc.company].filter((n) => typeof n === 'string' && n.trim().length > 1 && n !== NAME);
  doc.name = '';
  doc.company = '';
  if (doc.links) doc.links = Object.fromEntries(Object.entries(doc.links).filter(([k]) => OWN_LINKS.includes(k)));
  if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) {
    doc.data = clean(doc.data, names);
    doc.data.place_id = id;
  }
  for (const n of names) {
    if (doc.msg) for (const k of Object.keys(doc.msg)) doc.msg[k] = swap(doc.msg[k], n);
    if (Array.isArray(doc.facts)) doc.facts = doc.facts.map((f) => swap(f, n));
    if (doc.note) doc.note = swap(doc.note, n);
    if (doc.reply) doc.reply = swap(doc.reply, n);
  }
  if (Array.isArray(doc.facts)) doc.facts = doc.facts.filter((f) => !QUOTES_GOOGLE.test(f));
  return doc;
}

// ---------- shown ----------

const perView = () => Math.max(0, Math.min(25, parseInt(env('HARNESS_PLACES_PER_VIEW', '10'), 10) || 0));
const callUsd = () => Number(env('HARNESS_PLACES_USD', '0.02')) || 0;

async function details(id, key) {
  const res = await deps.fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=en`, {
    headers: { 'x-goog-api-key': key, 'x-goog-fieldmask': 'id,displayName,attributions' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Places ${res.status}`);
  const p = await res.json();
  const name = p && p.displayName && typeof p.displayName.text === 'string' ? p.displayName.text.slice(0, 120) : '';
  const credits = ((p && p.attributions) || []).filter((a) => a && a.provider).map((a) => String(a.provider).slice(0, 80));
  return name ? { name, credits } : null;
}

// Names for these place IDs, fetched now: Map(id -> { name, credits }). Nothing comes back without
// the places key, past the day's spending cap, or for IDs past the first `limit`. Never stored.
async function names(ids, { limit = perView() } = {}) {
  const out = new Map();
  const key = deps.needs().read('places');
  const todo = [...new Set(ids.filter(Boolean))].slice(0, limit);
  if (!key || !todo.length) return out;
  const ctx = deps.ctx();
  const cap = Number(env('HARNESS_MAX_DAY_USD', '100'));
  for (let i = 0; i < todo.length; i += 5) {
    if (cap > 0 && ctx.daySpent() + callUsd() * Math.min(5, todo.length - i) > cap) break;
    const batch = todo.slice(i, i + 5);
    ctx.addDay(callUsd() * batch.length);
    const got = await Promise.all(batch.map((id) => details(id, key).catch((err) => (console.warn('[harness] Places details failed:', err.message), null))));
    batch.forEach((id, j) => got[j] && out.set(id, got[j]));
  }
  return out;
}

const fill = (text, name) => (typeof text === 'string' && name ? text.split(NAME).join(name) : text);
const fillHref = (href, name) => (typeof href === 'string' && name ? href.split(encodeURIComponent(NAME)).join(encodeURIComponent(name)) : href);

// Ready Google leads (Pipeline views or Today's queue items) for a page: each gets its Maps link and
// `google: { credits }` for the "Google Maps" credit, and the first `limit` get their name, put into
// their messages too. A name that doesn't come back reads "A business on Google Maps".
async function show(list, { limit, near } = {}) {
  const items = (list || []).map((x) => ({ ...x }));
  const google = items.filter((x) => x.placeId);
  if (!google.length) return items;
  const live = await names(google.map((x) => x.placeId), limit === undefined ? {} : { limit });
  for (const x of google) {
    const got = live.get(x.placeId);
    const name = got ? got.name : '';
    x.google = { maps: mapsLink(x.placeId, near), credits: got ? got.credits : [], live: !!got };
    x.name = name || 'A business on Google Maps';
    x.company = '';
    if (!name) continue;
    if (x.msg) x.msg = Object.fromEntries(Object.entries(x.msg).map(([k, v]) => [k, fill(v, name)]));
    if (typeof x.text === 'string') x.text = fill(x.text, name);
    if (Array.isArray(x.ways)) x.ways = x.ways.map((w) => ({ ...w, text: fill(w.text, name), subject: fill(w.subject, name), href: fillHref(w.href, name) }));
    if (typeof x.hole === 'string' && x.hole === NAME) x.hole = ((x.text || '').match(/\[[^\]\n]{2,60}\]/) || [])[0] || '';
  }
  return items;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { NAME, idOf, mapsLink, scrub, names, show, _setDeps };
