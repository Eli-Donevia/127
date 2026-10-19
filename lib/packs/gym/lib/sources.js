// Where gym lists come from.
//   Free, real: OpenStreetMap. Nominatim turns the city into a point, Overpass lists gyms around it.
//     Coverage is thinner than Google (roughly half the gyms in a US metro, often without a website).
//     Data (c) OpenStreetMap contributors, ODbL: show the credit wherever the list is shown, linked
//     to openstreetmap.org/copyright, and in the spreadsheet.
//     Servers (Legal L55): 127's own OSM servers from the 'osm' setting ({ overpass, nominatim } URLs)
//     once Eli picks them. Without them, the one public Overpass server at a gentle pace, which is for
//     testing and low volume only: never a rotation of public mirrors to get past a busy one. A live
//     run (NODE_ENV=production) never uses the public servers: without both of 127's own, gym search
//     is held and find_gyms shows sample gyms (the site's First 25 has the same rule, Funnels F39).
//     Nominatim at most once a second, and city lookups are cached for 30 days (48 hours at most
//     through LocationIQ's free plan, Legal L57).
//   Google Places: removed (G58). Its terms let 127 keep only a place ID (Legal L53, contract
//     section 6), and this pack saved names, phones, ratings and Maps links in outputs, approvals and the
//     spreadsheet. It comes back only as a new, place-ID-only design.

const { getText, cached, kmBetween, kmToMiles, round, normalizeUrl, sleep, titleCase, scrubKeys } = require('./util');

// OSM city tags are sometimes typed in lower case ("des moines").
const cityName = (c) => (c && c === c.toLowerCase() ? titleCase(c) : c || '');
const { classifyOwner } = require('./chains');

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const OSM_CREDIT = 'Gym data from OpenStreetMap contributors (ODbL)';
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

// 127's own OpenStreetMap servers, when the 'osm' setting holds them: { overpass, nominatim } URLs
// (a bare URL is Overpass alone). A tool that didn't declare the setting, or an engine without it,
// gets the public servers, except on a live run, which is held unless both are 127's own.
function osmServer(ctx) {
  let v = null;
  try {
    v = ctx && typeof ctx.secret === 'function' ? ctx.secret('osm') : null;
  } catch {
    v = null;
  }
  if (typeof v === 'string') v = { overpass: v };
  if (!v || typeof v !== 'object') v = {};
  const ok = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null);
  const own = !!(ok(v.overpass) && ok(v.nominatim));
  return { overpass: ok(v.overpass) || OVERPASS, nominatim: ok(v.nominatim) || NOMINATIM, own, held: !own && process.env.NODE_ENV === 'production' };
}
const HELD_NOTE = "Real gym search isn't switched on yet, so these are sample gyms, made up for practice.";
const heldError = () => new Error("Real gym search isn't switched on yet.");
// 127's own server turning down its key (a 401 or 403: the wrong plan, Overpass not allowed on the key,
// a key locked to a website, or a mistyped setting). Waiting won't fix that, so it never says "busy".
const REFUSED = new Set([401, 403]);
const refusedError = () => new Error("The map service turned down 127's key, so gym search can't run right now. 127 has to fix its map settings.");

// City lookups go at most one a second, whatever the server: Nominatim's rule (Legal L55), and
// LocationIQ's free plan allows 2 a second and 60 a minute. One queue per server process; slots are
// booked in order, so lookups that arrive together wait their turn.
const NOMINATIM_GAP_MS = 1100;
// LocationIQ's free plan allows commercial use only with this link shown wherever its search is
// used (Funnels F42; the site shows it on First 25).
const LOCATIONIQ_CREDIT = { label: 'Search by LocationIQ.com', href: 'https://locationiq.com' };
const isLocationIq = (u) => {
  try {
    return /(^|\.)locationiq\.com$/i.test(new URL(u).hostname);
  } catch {
    return false;
  }
};
let nominatimNext = 0;
async function nominatimTurn(signal) {
  const now = Date.now();
  const at = Math.max(now, nominatimNext);
  nominatimNext = at + NOMINATIM_GAP_MS;
  if (at > now) await sleep(at - now, signal);
}

const CATEGORIES = ['gym', 'crossfit', 'yoga', 'pilates', 'boxing', 'martial_arts', 'climbing', 'cycling', 'dance'];

// ---------- geocoding ----------

async function geocode(ctx, place) {
  const q = String(place || '').trim();
  if (!q) throw new Error('Type a city, like "Des Moines, IA".');
  if (osmServer(ctx).held) throw heldError();
  const key = `gym:geo:${q.toLowerCase()}`;
  // LocationIQ's free plan lets 127 reuse an answer for 48 hours at most (Legal L57). Keeping it in a
  // saved list is fine; skipping a new lookup with it after that isn't. Other servers: 30 days.
  const hours = isLocationIq(osmServer(ctx).nominatim) ? 48 : 24 * 30;
  return cached(ctx, key, hours, async () => {
    const server = osmServer(ctx);
    // A paid server can carry its key in the URL (LocationIQ's Nominatim-style search takes ?key=), and
    // format=json is the one both answer the same way.
    const url = `${server.nominatim}${server.nominatim.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
    let res;
    // A 429 (too many lookups at once) gets one pause and one more try.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(2000, ctx.signal);
      try {
        await nominatimTurn(ctx.signal);
        res = await getText(ctx, url, { timeoutMs: 15000, headers: { Accept: 'application/json' } });
      } catch {
        throw new Error("The map service didn't answer. Try again in a minute.");
      }
      if (res.status !== 429 || /rate limited day/i.test(res.text)) break;
    }
    // LocationIQ answers a place it can't find with a 404 ("Unable to geocode"), not an empty list.
    if (res.status === 404 && /unable to geocode/i.test(res.text)) throw new Error(`Couldn't find "${q}" on the map. Try "City, State".`);
    if (server.own && REFUSED.has(res.status)) throw refusedError();
    if (res.status === 429 && /rate limited day/i.test(res.text)) throw new Error("Gym search has used up today's city lookups. Try again tomorrow.");
    if (!res.ok) throw new Error("The map service didn't answer. Try again in a minute.");
    let rows;
    try {
      rows = JSON.parse(res.text);
    } catch {
      throw new Error("The map service sent something we couldn't read. Try again in a minute.");
    }
    if (!Array.isArray(rows) || !rows.length) throw new Error(`Couldn't find "${q}" on the map. Try "City, State".`);
    const r = rows[0];
    const a = r.address || {};
    return {
      lat: Number(r.lat),
      lon: Number(r.lon),
      label: r.display_name,
      city: a.city || a.town || a.village || a.hamlet || a.county || q.split(',')[0].trim(),
      state: a.state || '',
      country: (a.country_code || '').toUpperCase(),
      ...(isLocationIq(server.nominatim) ? { searchCredit: LOCATIONIQ_CREDIT } : {}),
    };
  });
}

// ---------- OpenStreetMap ----------

function overpassQuery({ lat, lon, radiusM, categories }) {
  const want = new Set(categories && categories.length ? categories : CATEGORIES);
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const sports = [];
  if (want.has('gym')) sports.push('fitness', 'weightlifting', 'powerlifting', 'strongman', 'bodybuilding');
  if (want.has('crossfit')) sports.push('crossfit');
  if (want.has('yoga')) sports.push('yoga');
  if (want.has('pilates')) sports.push('pilates', 'barre');
  if (want.has('boxing')) sports.push('boxing', 'kickboxing');
  if (want.has('martial_arts')) sports.push('martial_arts', 'mma', 'karate', 'taekwondo', 'judo', 'jiu-jitsu', 'brazilian_jiu-jitsu', 'bjj', 'muay_thai', 'kung_fu', 'aikido');
  if (want.has('climbing')) sports.push('climbing', 'bouldering');
  if (want.has('cycling')) sports.push('cycling', 'spinning', 'indoor_cycling');
  if (want.has('dance')) sports.push('dance', 'zumba');
  const sportRx = sports.join('|');
  const parts = [];
  if (want.has('gym') || want.has('crossfit')) parts.push(`nwr${around}["leisure"="fitness_centre"];`, `nwr${around}["amenity"="gym"];`);
  if (sportRx) parts.push(`nwr${around}["leisure"="sports_centre"]["sport"~"${sportRx}"];`);
  // Named places with a sport tag but no leisure tag (a boxing gym tagged only sport=boxing). Not a
  // cliff, crag or boulder, which carry sport=climbing outdoors.
  if (sportRx) parts.push(`nwr${around}["sport"~"^(${sportRx})"]["name"]["leisure"!="pitch"]["leisure"!="park"]["leisure"!="track"][!"natural"][!"climbing"];`);
  if (want.has('martial_arts') || want.has('boxing')) parts.push(`nwr${around}["amenity"="dojo"];`);
  if (want.has('dance')) parts.push(`nwr${around}["leisure"="dance"]["name"];`);
  return `[out:json][timeout:60];(${parts.join('')});out center tags;`;
}

// One Overpass server: 127's own when the setting has one, else the public one. A busy or failing
// answer (429, 500, 502, 503, 504) or a dropped connection gets one pause and one more try on the
// same server, then a friendly "busy". Never a hop to another public mirror (Legal L55).
const BUSY = new Set([429, 500, 502, 503, 504]);
async function overpass(ctx, query, { tries = 2, pauseMs = 5000, timeoutMs = 75000 } = {}) {
  const server = osmServer(ctx);
  if (server.held) throw heldError();
  const base = server.overpass;
  let lastErr;
  let refused = false;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt > 0) await sleep(pauseMs, ctx.signal);
    try {
      const res = await getText(ctx, base, {
        method: 'POST',
        timeoutMs,
        maxBytes: 8e6,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status}`);
        if (server.own && REFUSED.has(res.status)) {
          refused = true;
          break;
        }
        if (BUSY.has(res.status)) continue;
        break;
      }
      const json = JSON.parse(res.text);
      if (!json || !Array.isArray(json.elements)) {
        lastErr = new Error('Overpass sent no elements');
        break;
      }
      return json.elements;
    } catch (e) {
      if (ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
      lastErr = e;
    }
  }
  if (refused) throw refusedError();
  const err = new Error("OpenStreetMap's servers are busy. Try again in a few minutes.");
  // The cause can hold the server's own words or the request URL, and 127's key can sit in its path.
  if (lastErr) err.cause = new Error(scrubKeys(lastErr.message));
  throw err;
}

const SPORT_TO_CAT = [
  ['crossfit', /crossfit/],
  ['climbing', /climb|boulder/],
  ['pilates', /pilates|barre|reformer/],
  ['yoga', /yoga/],
  ['cycling', /cycl|spin|indoor_cycling/],
  ['boxing', /boxing|kickbox/],
  ['martial_arts', /martial|mma|karate|taekwondo|judo|jiu|bjj|muay|kung_fu|aikido|krav/],
  ['dance', /dance|zumba/],
  ['gym', /fitness|weightlifting|powerlifting|strongman|bodybuilding/],
];
function categoryOf(tags = {}) {
  // OSM lists the main sport first ("climbing;yoga" is a climbing gym that also runs yoga).
  const first = String(tags.sport || '').toLowerCase().split(/[;,]/)[0].trim();
  const name = String(tags.name || '').toLowerCase();
  if (/crossfit|\bcf\b/.test(name)) return 'crossfit';
  if (tags.amenity === 'dojo') return 'martial_arts';
  if (tags.leisure === 'dance') return 'dance';
  for (const [cat, re] of SPORT_TO_CAT) if (re.test(first)) return cat;
  for (const [cat, re] of SPORT_TO_CAT) if (cat !== 'gym' && re.test(name.replace(/ /g, '_'))) return cat;
  return 'gym';
}

function osmAddress(t) {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const unit = t['addr:unit'] ? ` ${/^\d/.test(t['addr:unit']) ? '#' : ''}${t['addr:unit']}` : '';
  const city = cityName(t['addr:city']);
  const tail = [city, [t['addr:state'], t['addr:postcode']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street + unit, tail].filter((s) => s && s.trim()).join(', ');
}

function handleFrom(url, host) {
  const s = String(url || '').trim();
  if (!s) return null;
  if (!/[/.]/.test(s)) return s.replace(/^@/, '');
  const m = s.match(new RegExp(`${host.replace('.', '\\.')}\\/(?:@)?([A-Za-z0-9._-]+)`, 'i'));
  return m ? m[1] : null;
}

// A listing's website is sometimes its Facebook or Instagram page, a booking page, a link list or a map
// link. None is a site of its own: reading it would report what Facebook's page lacks, and every gym
// on facebook.com would share one "website". So it counts as no website, and a Facebook or Instagram
// page stays as a way to reach them (the site's First 25 does the same, Funnels 0010).
const NOT_A_SITE = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|linktr\.ee|linkin\.bio|beacons\.ai|business\.site|yelp\.com|nextdoor\.com|g\.page|goo\.gl|google\.com|mindbodyonline\.com|vagaro\.com|booksy\.com|schedulicity\.com|classpass\.com|groupon\.com)$/i;
const NOT_A_HANDLE = /^(pages|pg|people|groups|profile\.php|p|reel|reels|stories|share|explore|events|watch|maps|search|biz)$/i;
// -> { website } for a site of its own, else { website: null, page: 'Facebook page', facebook?, instagram? }
function ownSite(url) {
  const u = normalizeUrl(url);
  if (!u) return { website: null };
  const { hostname: host, pathname } = new URL(u);
  if (host === 'sites.google.com' || !NOT_A_SITE.test(host)) return { website: u };
  const first = pathname.split('/').filter(Boolean)[0] || '';
  const handle = /^@?[\w.-]{2,60}$/.test(first) && !NOT_A_HANDLE.test(first) ? first.replace(/^@/, '') : null;
  const fb = /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(host);
  const ig = /(^|\.)instagram\.com$/i.test(host);
  const page = fb ? 'Facebook page' : ig ? 'Instagram' : /tiktok|twitter|x\.com|youtube/i.test(host) ? 'social page' : /linktr|linkin|beacons/i.test(host) ? 'link list' : /mindbody|vagaro|booksy|schedulicity|classpass|groupon/i.test(host) ? 'booking page' : 'map listing';
  return { website: null, page, ...(fb && handle ? { facebook: `https://www.facebook.com/${handle}` } : {}), ...(ig && handle ? { instagram: handle } : {}) };
}

function fromOsm(el, center) {
  const t = el.tags || {};
  const lat = el.lat != null ? el.lat : el.center && el.center.lat;
  const lon = el.lon != null ? el.lon : el.center && el.center.lon;
  if (!t.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const owner = classifyOwner({ name: t.name, brand: t.brand, operator: t.operator, access: t.access });
  const km = kmBetween(center.lat, center.lon, lat, lon);
  const site = ownSite(t.website || t['contact:website'] || t.url);
  return {
    key: `osm:${el.type}/${el.id}`,
    name: t.name.trim(),
    category: categoryOf(t),
    owner: owner.kind,
    brand: owner.brand || null,
    ownerNote: owner.reason || null,
    address: osmAddress(t),
    city: cityName(t['addr:city']) || center.city || '',
    lat,
    lon,
    km: round(km, 1),
    miles: round(kmToMiles(km), 1),
    website: site.website,
    ...(site.page ? { webPage: site.page } : {}),
    phone: t.phone || t['contact:phone'] || null,
    email: t.email || t['contact:email'] || null,
    instagram: handleFrom(t['contact:instagram'] || t.instagram, 'instagram.com') || site.instagram || null,
    facebook: t['contact:facebook'] || t.facebook || site.facebook || null,
    tiktok: handleFrom(t['contact:tiktok'] || t.tiktok, 'tiktok.com'),
    youtube: t['contact:youtube'] || t.youtube || null,
    hours: t.opening_hours || null,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.name} ${t['addr:city'] || center.city || ''}`.trim())}`,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    source: 'openstreetmap',
  };
}

async function fromOpenStreetMap(ctx, center, { radiusKm, categories, tries, timeoutMs }) {
  const q = overpassQuery({ lat: center.lat, lon: center.lon, radiusM: radiusKm * 1000, categories });
  const key = `gym:osm:v2:${center.lat.toFixed(3)},${center.lon.toFixed(3)}:${radiusKm}:${(categories || []).slice().sort().join(',')}`;
  const elements = await cached(ctx, key, 24, () => overpass(ctx, q, { tries, timeoutMs }));
  return elements.map((el) => fromOsm(el, center)).filter(Boolean);
}

// ---------- merge ----------

const normName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(the|gym|fitness|studio|llc|inc|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

// Same gym twice (an OSM node and its building): same name within 150 m, or same website within 1 km.
function dedupe(list) {
  const out = [];
  for (const g of list) {
    const dup = out.find((o) => {
      const d = kmBetween(o.lat, o.lon, g.lat, g.lon);
      if (normName(o.name) && normName(o.name) === normName(g.name) && d < 0.15) return true;
      if (o.website && g.website && o.website.replace(/\/$/, '') === g.website.replace(/\/$/, '') && d < 1 && !o.brand) return true;
      return false;
    });
    if (!dup) {
      out.push({ ...g });
      continue;
    }
    for (const k of Object.keys(g)) if (dup[k] == null && g[k] != null) dup[k] = g[k];
  }
  return out;
}

module.exports = {
  CATEGORIES,
  geocode,
  overpassQuery,
  overpass,
  osmServer,
  HELD_NOTE,
  LOCATIONIQ_CREDIT,
  OSM_CREDIT,
  OSM_COPYRIGHT,
  fromOsm,
  ownSite,
  fromOpenStreetMap,
  categoryOf,
  dedupe,
};
