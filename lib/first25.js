// First 25: the free lead magnet that leads the ads and the bio link (Eli, 2026-10-19).
// Name what you sell and your city. It finds local businesses, drops chains and closed ones,
// checks every website for the gap you fix (lib/site-audit.js), ranks them and writes the
// message to send each one. Scoring and copy: public/funnels/first25-engine.js and first25-data.js,
// shared with the page so the screen, the CSV and the email match.
//
// Mounted by lib/funnels.js, which serves the page itself (/first-25) with the shared trackers,
// consent wording and launch state, and handles the email gate through /api/lead (source "first-25").
//
//   POST /api/first-25/run       { pack, buyer, place, me, service }  streams NDJSON progress, then the run
//   POST /api/first-25/r/:id/status  { k, rank, stage }  the tracker (Sent, Replied, Call booked, Won, Not now)
//   POST /api/first-25/r/:id/details { k }  a saved Google list's names and details, fetched again by place ID (Legal L53)
//   GET  /first-25/r/:id?k=      the saved list from the email (page, served by lib/funnels.js)
//   GET  /first-25/r/:id.csv?k=  the list for Sheets, Notion or Airtable
//
// Env (all optional):
//   FIRST25_SOURCE      sample (default) | google | osm. Sample is made-up businesses, labeled on the page.
//   PLACES_API_KEY      needed for google (GOOGLE_PLACES_API_KEY or GOOGLE_PLACES_KEY also work, the names HQ and older notes use). Places API (New) Text Search, up to FIRST25_GOOGLE_PAGES pages of 20 (default 2).
//   OSM_NOMINATIM_URL, OSM_OVERPASS_URL   OpenStreetMap servers, as https URLs (defaults: the public ones, for testing only;
//                       on the live site osm needs both set to our own or a paid server, or it uses sample). The values the gym
//                       pack reads too: Nominatim's search URL (or just the server) and Overpass's interpreter URL. A key can
//                       sit in the path (Tracestrack) or the query (LocationIQ's ?key=). With LocationIQ, its link shows on the page.
//   FIRST25_DAILY_CAP (150), FIRST25_PER_IP (6)   live searches per day, overall and per visitor
//   FIRST25_KEEP_DAYS (30)   saved lists older than this are deleted
//   FIRST25_SAMPLE_PACE (1)  how slowly a sample scan plays out on the page; 0 skips the pauses
//   FIRST25_GOOGLE_USD (0.035)  what one Places request costs us, for the cost logged on each run
//   FIRST25_DETAILS_USD (0.02)  what one Place Details request costs us (a saved Google list opening)
//   FIRST25_DETAILS_PER_IP (40), FIRST25_DETAILS_PER_LIST (20), FIRST25_DETAILS_CAP (1000)  saved Google lists opened per day
// At the daily cap, live searches fall back to labeled sample data instead of an error.

const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const audit = require('./site-audit');
const E = require('../public/funnels/first25-engine.js');

const D = E.D;
const BASE = () => (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const UA = '127-First25/1.0 (hello@127group.io; https://127group.io/first-25)';
// One Places key for the whole site, under any of the names it has been given (HQ reads the first two).
const placesKey = () => process.env.PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_KEY || '';
// Our own or a paid OpenStreetMap server, from its setting: an https URL, or nothing. The URL can carry the server's key,
// so it's never logged or sent to the page.
function osmServer(k) {
  try { const u = new URL(String(process.env[k] || '').trim()); return u.protocol === 'https:' ? u : null; } catch { return null; }
}
// LocationIQ's free plan asks for its link wherever its search is used (Search by LocationIQ.com).
const searchBy = () => { const u = osmServer('OSM_NOMINATIM_URL'); return u && /(^|\.)locationiq\.com$/i.test(u.hostname) ? 'locationiq' : ''; };

// Legal L53 (legal/handoffs/first-25.md): Google lets 127 keep place IDs, not listings. Saved lists, the list cache,
// the email, the CSV, the follow-up email fields and the HQ import keep only place IDs and 127's own work; names,
// websites, phones and ratings are fetched again by place ID when a list opens (refresh, the details route) and
// never stored. placeIdsOnly says that storage is in place; with it off, Google mode falls back to sample.
// Turning Google on is still Eli's spend call and a Legal check (legal/handoffs/first-25.md part 5).
const L53 = { placeIdsOnly: true };
let warnedL53 = false, warnedOsm = false;
function sourceName() {
  const s = env('FIRST25_SOURCE', 'sample');
  if (s === 'google' && placesKey()) {
    if (L53.placeIdsOnly) return 'google';
    if (!warnedL53) { warnedL53 = true; console.warn('[first25] FIRST25_SOURCE=google is on hold until saved lists keep place IDs only (Legal L53). Using sample.'); }
    return 'sample';
  }
  if (s === 'osm') {
    // The public OpenStreetMap servers are for testing (Legal L53 part 2.4, L55). On the live site every search is real
    // use, so osm needs our own or a paid server in both settings, or it falls back to sample, like Google's hold.
    if (osmServer('OSM_OVERPASS_URL') && osmServer('OSM_NOMINATIM_URL')) return 'osm';
    const live = process.env.NODE_ENV === 'production';
    if (!warnedOsm) { warnedOsm = true; console.warn(`[first25] FIRST25_SOURCE=osm on the public OpenStreetMap servers is for testing only. Set OSM_OVERPASS_URL and OSM_NOMINATIM_URL to the https URLs of a self-hosted or paid server (Legal L53 part 2.4).${live ? ' Using sample on the live site.' : ''}`); }
    return live ? 'sample' : 'osm';
  }
  return 'sample';
}

// ---------- signing (links in the email) ----------
function sign(id) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(`first25:${id}`).digest('hex').slice(0, 32);
}
function signed(id, k) {
  const a = Buffer.from(String(k || '')), b = Buffer.from(sign(id));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const runUrl = (run) => `${BASE()}/first-25/r/${run.id}?k=${sign(run.id)}`;

// ---------- sources ----------
async function getJson(url, init = {}, ms = 9000) {
  const r = await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(ms) });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch {}
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${(j && j.error && j.error.message) || text.slice(0, 160)}`), { status: r.status });
  return j;
}

// Google Places API (New), Text Search. Enterprise fields (website, phone, rating) bill as Text Search Enterprise.
// attributions (an IDs Only field) are the other data providers Google asks us to show with a result.
const G_FIELDS = ['id', 'displayName', 'formattedAddress', 'shortFormattedAddress', 'websiteUri', 'nationalPhoneNumber', 'rating', 'userRatingCount', 'businessStatus', 'attributions'];
// Legal L53: the map link is built from the place ID, the one Google field a saved list keeps. near is our own words
// ("gyms in Ames, IA"), only used if Maps can't find the place ID.
const mapsLink = (id, near) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(near || 'business')}&query_place_id=${encodeURIComponent(String(id).replace(/^g-/, ''))}`;
function gListing(p, near) {
  return {
    id: 'g-' + p.id,
    name: (p.displayName && p.displayName.text) || '',
    address: p.shortFormattedAddress || p.formattedAddress || '',
    phone: p.nationalPhoneNumber || null,
    website: p.websiteUri || null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviews: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    closed: !!p.businessStatus && p.businessStatus !== 'OPERATIONAL',
    mapsUrl: mapsLink(p.id, near),
    attributions: (p.attributions || []).filter((a) => a && a.provider).map((a) => ({ provider: String(a.provider).slice(0, 80), uri: /^https?:\/\//.test(a.providerUri || '') ? a.providerUri : null })),
  };
}
async function fromGoogle(B, place) {
  const fields = G_FIELDS.map((f) => 'places.' + f).concat('nextPageToken').join(',');
  const near = `${B.many} in ${place}`;
  const pages = Math.max(1, Math.min(3, parseInt(env('FIRST25_GOOGLE_PAGES', '2'), 10) || 2));
  const out = [];
  let token = null, type = B.type || undefined, requests = 0;
  for (let i = 0; i < pages; i++) {
    const body = { textQuery: `${B.q} in ${place}`, pageSize: 20, languageCode: 'en', ...(type ? { includedType: type } : {}), ...(token ? { pageToken: token } : {}) };
    let j;
    requests++;
    try {
      j = await getJson('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': placesKey(), 'x-goog-fieldmask': fields }, body: JSON.stringify(body) });
    } catch (e) {
      // An includedType Google doesn't know is a 400: search again on the words alone.
      if (e.status === 400 && type && !token) { type = undefined; i--; continue; }
      throw e;
    }
    for (const p of (j && j.places) || []) out.push(gListing(p, near));
    token = j && j.nextPageToken;
    if (!token) break;
  }
  return Object.assign(out.filter((b) => b.name), { requests });
}

// Place Details (New) for one place ID, with the same fields as the search.
async function placeDetails(id, near) {
  const pid = String(id).replace(/^g-/, '');
  const p = await getJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(pid)}?languageCode=en`, { headers: { 'x-goog-api-key': placesKey(), 'x-goog-fieldmask': G_FIELDS.join(',') } });
  return p && p.id ? gListing(p, near) : null;
}

// A saved Google list opening: its names, websites, phones and ratings fetched again, used for this response
// and never stored (Legal L53 part 1.1). The same search first (one request per page of 20, up to 40 places),
// then Place Details for any business the search no longer returns. Returns Map(id -> listing).
async function refresh(doc) {
  const B = E.buyer(doc.buyer), near = `${B.many} in ${doc.place}`;
  const ids = doc.prospects.map((b) => b.id).filter((id) => /^g-/.test(id || ''));
  const live = new Map();
  const found = await fromGoogle(B, doc.place);
  for (const b of found) if (ids.includes(b.id)) live.set(b.id, b);
  const missing = ids.filter((id) => !live.has(id));
  for (let i = 0; i < missing.length; i += 5) {
    const got = await Promise.all(missing.slice(i, i + 5).map((id) => placeDetails(id, near).catch(() => null)));
    for (const b of got) if (b) live.set(b.id, b);
  }
  const usd = Math.round(((found.requests || 0) * (Number(env('FIRST25_GOOGLE_USD', '0.035')) || 0) + missing.length * (Number(env('FIRST25_DETAILS_USD', '0.02')) || 0)) * 1000) / 1000;
  return { live, requests: (found.requests || 0) + missing.length, usd };
}

// OpenStreetMap: Nominatim for the area, Overpass for the businesses. No ratings, so fit leans on the website.
function overpassFilter(tag) {
  return tag.split('][').map((kv) => { const [k, v] = kv.split('='); return `["${k}"="${v}"]`; }).join('');
}
// Nominatim allows one lookup a second across the whole site (Legal L53 part 2.3): lookups queue for a turn, the same
// place in flight is looked up once, and each place's answer is kept for a week.
const geoCache = ttlCache(7 * 864e5, 2000), geoPending = new Map();
let geoNext = 0;
// The setting can be the server or its search URL, and a paid one keeps its key in the query (LocationIQ's ?key=), so our
// params join the URL's own. format=json is the one Nominatim and LocationIQ both answer (LocationIQ has no jsonv2).
function nominatimUrl(place) {
  const u = osmServer('OSM_NOMINATIM_URL') || new URL('https://nominatim.openstreetmap.org/search');
  const path = u.pathname.replace(/\/+$/, '');
  if (!/\/search(\.php)?$/.test(path)) u.pathname = path + '/search';
  u.searchParams.set('format', 'json');
  u.searchParams.set('limit', '1');
  u.searchParams.set('q', place);
  return u.href;
}
function geocode(place) {
  const key = place.toLowerCase().replace(/\s+/g, ' ').trim();
  const hit = geoCache.get(key);
  if (hit) return Promise.resolve(hit);
  if (geoPending.has(key)) return geoPending.get(key);
  const wait = Math.max(0, geoNext - Date.now());
  geoNext = Date.now() + wait + 1100;
  const job = new Promise((r) => setTimeout(r, wait))
    .then(() => getJson(nominatimUrl(place), { headers: { 'accept-language': 'en' } }, 8000))
    .then((geo) => { if (geo && geo[0]) geoCache.set(key, geo); return geo; })
    .finally(() => geoPending.delete(key));
  geoPending.set(key, job);
  return job;
}
async function fromOsm(B, place) {
  const geo = await geocode(place);
  if (!geo || !geo[0]) throw Object.assign(new Error('place not found'), { status: 404 });
  let [s, n, w, e] = geo[0].boundingbox.map(Number);
  // A state or a big county is too wide for a walkable list: keep about 15 km around the center.
  const lat = Number(geo[0].lat), lon = Number(geo[0].lon), dLat = 0.14, dLon = 0.14 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  if (n - s > 2 * dLat) { s = lat - dLat; n = lat + dLat; }
  if (e - w > 2 * dLon) { w = lon - dLon; e = lon + dLon; }
  const bbox = [s, w, n, e].map((x) => x.toFixed(5)).join(',');
  const q = `[out:json][timeout:20];(${B.osm.map((t) => `nwr${overpassFilter(t)}(${bbox});`).join('')});out center tags 160;`;
  // Posted, so a key in the path (Tracestrack) or the query stays where the server put it.
  const over = (osmServer('OSM_OVERPASS_URL') || new URL('https://overpass-api.de/api/interpreter')).href;
  const j = await getJson(over, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, 22000);
  return ((j && j.elements) || []).map((el) => {
    const t = el.tags || {};
    const web = t.website || t['contact:website'] || t.url || null;
    const addr = [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:city']].filter(Boolean).join(', ');
    const ig = t['contact:instagram'] || null;
    return {
      id: `osm-${el.type}-${el.id}`,
      name: t.name || '',
      address: addr,
      phone: t.phone || t['contact:phone'] || null,
      website: web && !/^https?:\/\//i.test(web) ? 'http://' + web : web,
      instagram: ig ? String(ig).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '').replace(/^@/, '') || null : null,
      rating: null, reviews: null,
      closed: !!(t['disused:shop'] || t['disused:amenity']),
      mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    };
  }).filter((b) => b.name);
}

// ---------- caches (in memory, one instance) ----------
// Listings + website checks for the same search, so a second search of "gyms in Des Moines" is instant and costs nothing.
// Google results never go in either (Legal L53 part 1.2): a Google search runs again, and its website checks are
// kept by place ID only (checkSites).
function ttlCache(ms, max) {
  const m = new Map();
  return {
    get(k) { const v = m.get(k); if (!v) return null; if (Date.now() - v.at > ms) { m.delete(k); return null; } return v.value; },
    set(k, value) { m.set(k, { at: Date.now(), value }); if (m.size > max) m.delete(m.keys().next().value); },
  };
}
const listCache = ttlCache(6 * 3600e3, 300);
const siteCache = ttlCache(24 * 3600e3, 5000);

// ---------- one run ----------
// Calls progress({step, ...}) as it goes, so the page can show the real work.
async function run(input, progress = () => {}) {
  const pack = D.packs[input.pack] ? input.pack : 'video';
  const P = E.pack(pack);
  const buyer = D.buyers[input.buyer] ? input.buyer : P.buyers[0];
  const B = E.buyer(buyer);
  const place = String(input.place || '').trim().slice(0, 80);
  const city = E.cityOf(place);
  const source = input.source || sourceName();
  const now = new Date();
  const pace = Number(env('FIRST25_SAMPLE_PACE', '1')) || 0;
  const pause = (ms) => (source === 'sample' && pace > 0 ? new Promise((r) => setTimeout(r, ms * pace)) : Promise.resolve());

  progress({ step: 'search', text: `Searching ${city} for ${B.many}` });
  const key = `${source}|${buyer}|${place.toLowerCase()}`;
  let list = source === 'google' ? null : listCache.get(key), requests = 0;
  if (!list) {
    if (source === 'google') { list = await fromGoogle(B, place); requests = list.requests || 0; }
    else if (source === 'osm') list = await fromOsm(B, place);
    else list = E.sample(buyer, place, now);
    await pause(700);
    // Website checks, inside the time budget. Sample businesses come with made-up checks already.
    if (source !== 'sample') {
      const withSite = list.filter((b) => b.website && !E.isChain(b.name, buyer) && !b.closed).length;
      progress({ step: 'found', n: list.length, sites: withSite });
      await checkSites(list.filter((b) => !E.isChain(b.name, buyer) && !b.closed), source, now, progress);
    }
    if (source !== 'google') listCache.set(key, list);
  }
  if (source === 'sample') {
    progress({ step: 'found', n: list.length, sites: list.filter((b) => b.website).length });
    await pause(500);
    const sites = list.filter((b) => b.website).length;
    for (const f of [0.35, 0.7, 1]) { progress({ step: 'audit', checked: Math.round(sites * f), of: sites }); await pause(380); }
  }
  progress({ step: 'rank', text: 'Ranking them by the gaps you fix' });
  const built = E.build(list, { pack, buyer, place, city, me: input.me, service: input.service, now });
  // This search's Google listings, for the result it sends back now. Never saved (Legal L53).
  const live = source === 'google' ? new Map(built.prospects.map((b) => [b.id, b])) : null;
  await pause(450);
  progress({ step: 'write', text: 'Writing your messages' });

  const doc = {
    kind: 'first25',
    pack, buyer, place, city, source, sample: source === 'sample',
    me: String(input.me || '').slice(0, 40), service: String(input.service || '').slice(0, 60),
    checkedAt: now.toISOString(),
    stats: built.stats,
    headline: built.headline.map((h) => ({ ...h, line: E.headlineLine(h) })),
    // Keep what the page shows; messages are rebuilt from these, so a name added at the gate fills in everywhere.
    prospects: built.prospects.map((b) => slim(b, source)),
    utm: input.utm || {},
    ...(input.capped ? { capped: true } : {}),
    // What this run cost us (playbook: cost per free run under $0.50). Website checks are free.
    cost: { requests, usd: Math.round(requests * (Number(env('FIRST25_GOOGLE_USD', '0.035')) || 0) * 1000) / 1000 },
  };
  const saved = await db.save('prospectRuns', doc);
  if (requests) console.log(`[first25] run ${saved.id} ${source} ${buyer} "${city}": ${requests} Places requests, about $${saved.cost.usd}`);
  await pause(250);
  // A copy, so the Google listings ride along to view() without ever reaching the saved list.
  return live ? { ...saved, live } : saved;
}

// Website checks. Google ones are kept by place ID, never by the website Google gave us, and without the URL (Legal L53).
async function checkSites(list, source, now, progress) {
  const byPlace = source === 'google';
  let reused = 0;
  if (byPlace) for (const b of list) { const hit = b.website && siteCache.get('g:' + b.id); if (hit) { b.site = { ...hit }; reused++; } }
  const todo = byPlace ? list.filter((b) => !b.site) : list;
  if (reused) progress({ step: 'audit', checked: reused, of: reused + todo.filter((b) => b.website).length });
  await audit.auditAll(todo, {
    budgetMs: 14000, perMs: 6000, concurrency: 10, now, cache: byPlace ? null : siteCache,
    onProgress: (p) => { if (p.checked % 4 === 0 || p.checked === p.of) progress({ step: 'audit', checked: p.checked + reused, of: p.of + reused }); },
  });
  if (byPlace) for (const b of todo) if (b.site && b.site.checked) { const { url, title, ...own } = b.site; siteCache.set('g:' + b.id, own); }
}

// What a saved list keeps for each business. Gaps and fits keep their ids and points; view() writes their words.
// Google: only the place ID (in id) and 127's own work, the website check and what we found on the business's
// own site (its Instagram, Facebook and email). Names, websites, phones, addresses and ratings are fetched
// again when the list opens (Legal L53 part 1.1).
function slim(b, source) {
  const s = b.site || {};
  const own = {
    id: b.id || null, rank: b.rank, score: b.score, unchecked: b.unchecked,
    gaps: (b.gaps || []).map((g) => ({ id: g.id, points: g.points })), fits: (b.fits || []).map((f) => ({ id: f.id, points: f.points })),
    instagram: (s.socials && s.socials.instagram) || null, email: s.email || null,
    site: { checked: !!s.checked, ok: !!s.ok, footerYear: s.footerYear || null, booking: s.booking || null, platform: s.platform || null, socials: s.socials || null },
  };
  if (source === 'google') return own;
  return { ...own, name: b.name, website: b.website || null, instagram: b.instagram || own.instagram, phone: b.phone || null, address: b.address || null, mapsUrl: b.mapsUrl || null, rating: b.rating, reviews: b.reviews };
}
const LISTING = ['name', 'website', 'phone', 'address', 'rating', 'reviews'];

// The run as the page, CSV and email use it: messages and samples written for this sender.
// live: Google listings by id, from this search or a refresh. A Google list without them has a map link for each
// business and "[business name]" in its messages, and details: true tells the page to fetch the rest.
function view(doc, me, live = doc.live) {
  const google = doc.source === 'google';
  const ctx = { me: me || doc.me, city: doc.city, service: doc.service };
  const near = `${E.buyer(doc.buyer).many} in ${doc.place}`;
  const credits = new Map();
  const prospects = doc.prospects.map((s, i) => {
    let b = s;
    if (google) {
      const L = live && live.get(s.id);
      // Without the listing, lines that quote Google's numbers drop out; ids keeps them so the page can write them once the details load.
      const own = Object.fromEntries(Object.entries(s).filter(([k]) => !LISTING.includes(k) && k !== 'mapsUrl'));
      b = { ...own, ...(L ? Object.fromEntries(LISTING.map((k) => [k, L[k]])) : { name: D.copy.noName, ids: { gaps: s.gaps, fits: s.fits } }), mapsUrl: mapsLink(s.id, near) };
      for (const a of (L && L.attributions) || []) credits.set(a.provider, a);
    }
    b = { ...b, ...E.words(b, doc.buyer) };
    return { ...b, msg: E.messages(b, doc.pack, doc.buyer, ctx), spec: i < 3 ? E.spec(b, doc.pack, doc.buyer, ctx) : undefined };
  });
  return {
    id: doc.id, k: sign(doc.id), pack: doc.pack, buyer: doc.buyer, place: doc.place, city: doc.city, source: doc.source, sample: doc.sample,
    service: doc.service, me: ctx.me || '', checkedAt: doc.checkedAt, stats: doc.stats, headline: doc.headline,
    attribution: D.copy.attribution[doc.source] || '', ...(doc.source === 'osm' && searchBy() ? { searchBy: searchBy() } : {}), status: doc.status || {}, prospects,
    keepUntil: keepUntil(doc), ...(doc.capped ? { capped: true } : {}),
    ...(google && !live ? { details: true } : {}), ...(credits.size ? { attributions: [...credits.values()] } : {}),
  };
}
const keepDays = () => parseInt(env('FIRST25_KEEP_DAYS', '30'), 10) || 30;
const keepUntil = (doc) => new Date(new Date(doc.createdAt || doc.checkedAt || Date.now()).getTime() + keepDays() * 864e5).toISOString();
const longDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });

// ---------- the result email (source first-25 in lib/funnels.js deliveryEmail) ----------
function emailText(lead, stateBlock) {
  const d = lead.data || {};
  const doc = d.run_id && signed(d.run_id, d.k) ? db.get('prospectRuns', d.run_id) : null;
  const hi = `Hi ${lead.name || 'there'},`;
  if (!doc) {
    return {
      subject: 'Your First 25',
      text: `${hi}\n\nYour list didn't save on our side, sorry about that. Run it again here: ${BASE()}/first-25\n\n${stateBlock('C')}`,
    };
  }
  const v = view(doc, lead.name);
  const B = E.buyer(v.buyer);
  const top = v.prospects.slice(0, 10).map((b) => {
    const where = b.website || b.mapsUrl || '';
    return `${b.rank}. ${b.name} (score ${b.score})${where ? ` ${where}` : ''}\n   Why: ${(b.gaps[0] || b.fits[0] || {}).why || ''}\n   Send: "${b.msg.dm}"`;
  }).join('\n\n');
  const sample = v.prospects[0] && v.prospects[0].spec;
  const board = sample && sample.board ? `\n${sample.board.map((r) => `${r[0]}: ${r[1]}`).join('\n')}` : '';
  const plan = D.plan.map((p, i) => `Day ${i + 1}: ${p}`).join('\n');
  const replies = E.replies(v.prospects[0] || { name: 'them' }, v.pack, v.buyer, { me: v.me, city: v.city, service: v.service })
    .filter((r) => ['yes', 'price', 'who'].includes(r.id)).map((r) => `${r.label}\n${r.text}`).join('\n\n');
  const sampleNote = v.sample ? `\n\n${v.capped ? D.copy.capped : D.copy.sampleNote}` : '';
  const m = v.prospects[0] && E.mock(v.prospects[0], v.pack, v.buyer, { me: v.me, city: v.city, source: v.source });
  const made = m ? `${E.fill(D.copy.emailSample, { biz: v.prospects[0].name, title: m.title.toLowerCase(), note: m.note })}\n\n` : '';
  const next = `${E.fill(D.copy.next, { n: v.prospects.length })} ${D.copy.nextSub}\n\n${D.copy.compare.email}`;
  const keep = E.fill(D.copy.keep, { date: longDate(keepUntil(doc)) });
  const checked = E.fill(D.copy.checked, { date: new Date(doc.checkedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) });
  if (v.source === 'google') {
    // Legal L53 part 1.3: no business names, websites or messages with names in them. 127's own findings and the link.
    const found = (v.headline || []).map((h) => h.line).join('\n');
    const why = ((v.prospects[0] || {}).gaps || []).slice(0, 2).map((g) => g.why).join(' ');
    return {
      subject: `Your First 25: ${B.many} in ${v.city}`,
      text: `${hi}\n\nHere are ${v.prospects.length} ${B.many} in ${v.city}, ranked by the gaps you fix, with the message to send each one.\n\nOpen all ${v.prospects.length}, with every message and follow-up: ${runUrl(doc)}\n${E.fill(D.copy.csvLineGoogle, { url: `${BASE()}/first-25/r/${doc.id}.csv?k=${sign(doc.id)}` })}\n\n${D.copy.problem}\n\n${found ? `${D.copy.emailFound}\n${found}\n\n` : ''}${why ? `${E.fill(D.copy.emailTop1, { why })}\n\n` : ''}${m ? `${E.fill(D.copy.emailSampleGoogle, { title: m.title.toLowerCase() })}\n\n` : ''}Your first 7 days:\n${plan}\n\n${D.copy.emailRestGoogle} ${keep}\n\n${next}\n\n${checked} ${D.copy.checksBy}\n\n${stateBlock()}`,
    };
  }
  return {
    subject: `Your First 25: ${B.many} in ${v.city}`,
    text: `${hi}\n\nHere are ${v.prospects.length} ${B.many} in ${v.city}, ranked by the gaps you fix, with the message to send each one.${sampleNote}\n\nOpen all ${v.prospects.length}, with every message and follow-up: ${runUrl(doc)}\nDownload the list for Sheets or Notion: ${BASE()}/first-25/r/${doc.id}.csv?k=${sign(doc.id)}\n\n${D.copy.problem}\n\nYour top 10:\n\n${top}\n\n${made}${sample ? `Before you message #1, make this:\n${sample.title}\n${sample.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${board}\n\n` : ''}Your first 7 days:\n${plan}\n\nWhen they reply:\n\n${replies}\n\nThe rest of the replies, send mode and your tracker are on your list page. ${keep}\n\n${next}\n\n${checked} ${v.attribution}\n\n${stateBlock()}`,
  };
}

// ---------- routes ----------
function router({ json, limited }) {
  const r = express.Router();

  r.post('/api/first-25/run', json, async (req, res) => {
    const b = req.body || {};
    const place = String(b.place || '').trim();
    if (place.length < 2 || place.length > 80) return res.status(400).json({ error: 'Enter a city and state, or a ZIP code.' });
    if (b.website) return res.status(400).json({ error: 'Something went wrong.' }); // honeypot
    const live = sourceName() !== 'sample';
    if (limited('f25:' + req.ip, parseInt(env('FIRST25_PER_IP', live ? '6' : '40'), 10))) {
      return res.status(429).json({ error: "You've run a few searches today. Come back tomorrow, or open the list we emailed you." });
    }
    // Past the daily cap the search still works, on labeled sample businesses, so an ad click never hits an error.
    const capped = live && limited('f25:all', parseInt(env('FIRST25_DAILY_CAP', '150'), 10));
    // Streamed so the page shows each step as it happens. no-transform keeps compression from buffering it.
    res.status(200).set({ 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
    if (res.flushHeaders) res.flushHeaders();
    const send = (o) => { res.write(JSON.stringify(o) + '\n'); if (res.flush) res.flush(); };
    try {
      const doc = await run({
        pack: String(b.pack || ''), buyer: String(b.buyer || ''), place,
        me: String(b.me || '').trim().slice(0, 40), service: String(b.service || '').trim().slice(0, 60),
        utm: b.utm && typeof b.utm === 'object' ? Object.fromEntries(Object.entries(b.utm).slice(0, 12).map(([k, v]) => [String(k).slice(0, 30), String(v).slice(0, 120)])) : {},
        ...(capped ? { source: 'sample', capped: true } : {}),
      }, (p) => send({ type: 'progress', ...p }));
      require('./integrations').emit('first25.run', { id: doc.id, pack: doc.pack, buyer: doc.buyer, source: doc.source, found: doc.stats.found, kept: doc.prospects.length, capped: !!doc.capped, cost_usd: doc.cost.usd });
      send({ type: 'result', run: view(doc) });
    } catch (e) {
      console.warn('[first25] run failed', e.status || '', e.message);
      send({ type: 'error', error: e.status === 404 ? "We couldn't find that place. Try a city and state, like Des Moines, IA." : 'The search is busy right now. Try again in a minute.' });
    }
    res.end();
  });

  // The tracker: one stage per business, saved with the list so it follows them to any device.
  const STAGES = D.stages.map((s) => s.id);
  r.post('/api/first-25/r/:id/status', json, async (req, res) => {
    const b = req.body || {};
    const doc = signed(req.params.id, b.k) ? db.get('prospectRuns', req.params.id) : null;
    if (!doc) return res.status(404).json({ error: 'This list has expired.' });
    const rank = parseInt(b.rank, 10);
    if (!STAGES.includes(b.stage) || !doc.prospects.some((p) => p.rank === rank)) return res.status(400).json({ error: 'Something went wrong.' });
    if (limited('f25s:' + req.ip, 500)) return res.status(429).json({ error: 'Too many changes today. Try again tomorrow.' });
    doc.status = { ...(doc.status || {}), [rank]: { s: b.stage, at: new Date().toISOString() } };
    await db.save('prospectRuns', doc);
    res.json({ ok: true });
  });

  // A saved Google list opening: names, websites, phones and ratings fetched again by place ID for this response only
  // (Legal L53 part 1.1). Each open costs Places requests, so opens are limited per visitor, per list and per day.
  // The page only asks from a browser that runs it, so link checkers in email apps cost nothing.
  r.post('/api/first-25/r/:id/details', json, async (req, res) => {
    const doc = signed(req.params.id, (req.body || {}).k) ? db.get('prospectRuns', req.params.id) : null;
    res.set('cache-control', 'no-store');
    if (!doc) return res.status(404).json({ error: 'This list has expired.' });
    if (doc.source !== 'google') return res.json({ prospects: [] });
    const n = (k, d) => parseInt(env(k, d), 10);
    if (!placesKey() || limited('f25d:' + req.ip, n('FIRST25_DETAILS_PER_IP', '40')) || limited('f25d:' + doc.id, n('FIRST25_DETAILS_PER_LIST', '20')) || limited('f25d:all', n('FIRST25_DETAILS_CAP', '1000'))) {
      return res.status(429).json({ error: D.copy.details.fail });
    }
    try {
      const { live, requests, usd } = await refresh(doc);
      console.log(`[first25] list ${doc.id} opened: ${requests} Places requests, about $${usd}, ${live.size} of ${doc.prospects.length} found`);
      require('./integrations').emit('first25.details', { id: doc.id, requests, cost_usd: usd, found: live.size, of: doc.prospects.length });
      // What opening it cost us, kept with the list (our numbers, not Google's).
      const o = doc.opens || { n: 0, requests: 0, usd: 0 };
      doc.opens = { n: o.n + 1, requests: o.requests + requests, usd: Math.round((o.usd + usd) * 1000) / 1000 };
      await db.save('prospectRuns', doc);
      const v = view(doc, null, live);
      res.json({
        prospects: v.prospects.filter((b) => live.has(b.id)).map((b) => ({ rank: b.rank, ...Object.fromEntries(LISTING.map((k) => [k, b[k]])) })),
        attributions: v.attributions || [],
      });
    } catch (e) {
      console.warn('[first25] list details failed', e.status || '', e.message);
      res.status(503).json({ error: D.copy.details.fail });
    }
  });

  r.get('/first-25/r/:id.csv', (req, res) => {
    const doc = signed(req.params.id, req.query.k) ? db.get('prospectRuns', req.params.id) : null;
    if (!doc) return res.status(404).type('text').send('This list has expired. Run a new one at 127group.io/first-25');
    const v = view(doc);
    const name = `first-25-${v.buyer}-${String(v.city).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    res.set('content-type', 'text/csv; charset=utf-8').set('content-disposition', `attachment; filename="${name}"`).send('﻿' + E.csv(v));
  });

  return r;
}

// GET /first-25/r/:id: the page script that opens the saved list unlocked (lib/funnels.js page()).
function injectRun(req) {
  const doc = signed(req.params.id, req.query.k) ? db.get('prospectRuns', req.params.id) : null;
  const j = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return `<script>window.F25_RUN=${doc ? j({ ...view(doc), unlocked: true }) : 'null'};</script>\n`;
}

// ---------- for the follow-up emails (Klaviyo event properties, lib/funnels.js) ----------
// Rebuilt from the saved list (signed id), never from what the page sent. No business names, websites or messages
// with names in them, from any source (Legal L53 part 1.3): 127's own findings, counts and links only, so one set
// of emails works for every list.
function nurtureProps(lead) {
  try { return nurture(lead); } catch (e) { console.warn('[first25] email props', e.message); return {}; }
}
function nurture(lead) {
  const d = (lead && lead.data) || {};
  const doc = d.run_id && signed(d.run_id, d.k) ? db.get('prospectRuns', d.run_id) : null;
  if (!doc) return {};
  const v = view(doc, lead.name);
  const p = v.prospects, first = p[0] || {};
  const m = first.name ? E.mock(first, v.pack, v.buyer, { me: v.me, city: v.city, source: v.source }) : null;
  return {
    first25_list_url: runUrl(doc),
    first25_csv_url: `${BASE()}/first-25/r/${doc.id}.csv?k=${sign(doc.id)}`,
    first25_count: p.length, first25_city: v.city, first25_many: E.buyer(v.buyer).many, first25_sell: E.pack(v.pack).sell,
    // What we found on #1's website. Listing lines ("23 Google reviews") never come along.
    first25_top1_why: ((first.gaps || []).find((g) => g.id !== 'few_reviews') || {}).why || '',
    first25_sample: m ? m.title : '', first25_keep_until: longDate(keepUntil(doc)), first25_is_sample: !!v.sample, first25_source: v.source,
  };
}

// ---------- into the HQ Pipeline (v2/harness/WORKFLOW-CONTRACT.md §7, ctx.leads.upsert) ----------
// One row per business, ready for upsert. Google rows carry the place ID and 127's own work, never the listing
// (Legal L53 part 1.1): company is empty, the messages say "[business name]", and HQ fetches the name and details by
// place ID when it shows a row (placeDetails), without storing them.
function pipeline(doc, me) {
  const v = view(doc, me);
  const google = v.source === 'google';
  return v.prospects.map((b) => ({
    key: b.id ? `first25:${b.id}` : `first25:${doc.id}:${b.rank}`,
    name: '', company: google ? '' : b.name, source: 'first-25',
    stage: ((v.status || {})[b.rank] || {}).s || 'found',
    links: Object.fromEntries(Object.entries({ website: google ? null : b.website, instagram: b.instagram ? `https://instagram.com/${b.instagram}` : null, map: b.mapsUrl, phone: google ? null : b.phone }).filter(([, x]) => x)),
    note: ((b.gaps || [])[0] || (b.fits || [])[0] || {}).why || '',
    data: {
      list: doc.id, rank: b.rank, score: b.score, city: v.city, pack: v.pack, buyer: v.buyer, sample: !!v.sample,
      gaps: (b.gaps || []).map((g) => g.id), address: google ? null : b.address, ...(google ? { place_id: String(b.id).replace(/^g-/, '') } : {}),
      messages: { dm: b.msg.dm, subject: b.msg.subject, email: b.msg.email, walkin: b.msg.walkin, day3: b.msg.follow1, day7: b.msg.follow2 },
    },
  }));
}
// The newest saved list for an email (the lead record keeps the last one), for HQ to import at signup.
function leadsFor(email) {
  let lead = null;
  try { lead = db.find('leads', (l) => l.email === String(email || '').trim().toLowerCase() && l.source === 'first-25'); } catch { return []; }
  const d = (lead && lead.data) || {};
  const doc = d.run_id && signed(d.run_id, d.k) ? db.get('prospectRuns', d.run_id) : null;
  return doc ? pipeline(doc, lead.name) : [];
}

// ---------- niche doors (/first-25/gyms) ----------
const niche = (id) => E.niche(String(id || ''));
function injectNiche(req) {
  const id = req.params && req.params.niche;
  return niche(id) ? `<script>window.F25_NICHE=${JSON.stringify(id)};</script>\n` : '';
}
// The search pages: which source a search uses, so the line under the button can name it (Legal L53 parts 1.6 and 2.5).
function injectPage(req) {
  const s = sourceName();
  return (s === 'sample' ? '' : `<script>window.F25_SOURCE=${JSON.stringify(s)};</script>\n`) +
    (s === 'osm' && searchBy() ? `<script>window.F25_SEARCH_BY=${JSON.stringify(searchBy())};</script>\n` : '') + injectNiche(req);
}

// Lists are deleted after FIRST25_KEEP_DAYS (30): they hold business listings, not member data.
async function prune() {
  const keep = parseInt(env('FIRST25_KEEP_DAYS', '30'), 10) * 864e5;
  let all = [];
  try { all = db.all('prospectRuns'); } catch { return 0; }
  const old = all.filter((d) => Date.now() - new Date(d.createdAt).getTime() > keep);
  for (const d of old) await db.remove('prospectRuns', d.id);
  return old.length;
}
setTimeout(() => prune().catch(() => {}), 60e3).unref();
setInterval(() => prune().catch(() => {}), 12 * 3600e3).unref();

module.exports = { router, run, view, emailText, injectRun, injectNiche, injectPage, niche, nurtureProps, pipeline, leadsFor, placeDetails, refresh, sign, signed, prune, sourceName, _test: { L53, fromGoogle, fromOsm, overpassFilter, nominatimUrl, listCache, siteCache, mapsLink } };
