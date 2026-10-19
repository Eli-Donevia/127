// Where gym lists come from.
//   Free, real: OpenStreetMap. Nominatim turns the city into a point, Overpass lists gyms around it.
//     Coverage is thinner than Google (roughly half the gyms in a US metro, often without a website).
//     Data (c) OpenStreetMap contributors, ODbL: show the credit wherever the list is shown.
//   Paid, fuller: Google Places API (New) Text Search with 127's key (ctx.secret('places')).
//     Enterprise fields (rating, review count, website, phone): $35 per 1,000 calls after
//     1,000 free calls a month (Google's price list, checked 2026-10-19). One city run is up to 18 calls.

const { getText, cached, kmBetween, kmToMiles, round, normalizeUrl, sleep, log, titleCase } = require('./util');

// OSM city tags are sometimes typed in lower case ("des moines").
const cityName = (c) => (c && c === c.toLowerCase() ? titleCase(c) : c || '');
const { classifyOwner } = require('./chains');

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const CATEGORIES = ['gym', 'crossfit', 'yoga', 'pilates', 'boxing', 'martial_arts', 'climbing', 'cycling', 'dance'];

// ---------- geocoding ----------

async function geocode(ctx, place) {
  const q = String(place || '').trim();
  if (!q) throw new Error('Type a city, like "Des Moines, IA".');
  const key = `gym:geo:${q.toLowerCase()}`;
  return cached(ctx, key, 24 * 30, async () => {
    const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&addressdetails=1`;
    let res;
    try {
      res = await getText(ctx, url, { timeoutMs: 15000, headers: { Accept: 'application/json' } });
    } catch {
      throw new Error("The map service didn't answer. Try again in a minute.");
    }
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
  if (want.has('gym') || want.has('crossfit')) parts.push(`nwr${around}["leisure"="fitness_centre"];`);
  if (sportRx) parts.push(`nwr${around}["leisure"="sports_centre"]["sport"~"${sportRx}"];`);
  if (sportRx) parts.push(`nwr${around}["sport"~"^(${sportRx})"]["name"]["leisure"!="pitch"]["leisure"!="park"]["leisure"!="track"];`);
  if (want.has('martial_arts') || want.has('boxing')) parts.push(`nwr${around}["amenity"="dojo"];`);
  if (want.has('dance')) parts.push(`nwr${around}["leisure"="dance"]["name"];`);
  return `[out:json][timeout:60];(${parts.join('')});out center tags;`;
}

// Public Overpass servers are free and fair-use: busy ones answer 429 or 504 at random.
// Two passes over the mirrors, a short pause between, before giving up.
async function overpass(ctx, query, { passes = 2 } = {}) {
  let lastErr;
  for (let pass = 0; pass < passes; pass++) {
    for (const base of OVERPASS) {
      try {
        const res = await getText(ctx, base, {
          method: 'POST',
          timeoutMs: 75000,
          maxBytes: 8e6,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!res.ok) {
          lastErr = new Error(`Overpass ${res.status} from ${base}`);
          continue;
        }
        const json = JSON.parse(res.text);
        if (!json || !Array.isArray(json.elements)) {
          lastErr = new Error(`Overpass sent no elements (${base})`);
          continue;
        }
        return json.elements;
      } catch (e) {
        if (ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
        lastErr = e;
      }
    }
    if (pass < passes - 1) await sleep(2500, ctx.signal);
  }
  const err = new Error("OpenStreetMap's servers are busy. Try again in a few minutes.");
  err.cause = lastErr;
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

function fromOsm(el, center) {
  const t = el.tags || {};
  const lat = el.lat != null ? el.lat : el.center && el.center.lat;
  const lon = el.lon != null ? el.lon : el.center && el.center.lon;
  if (!t.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const owner = classifyOwner({ name: t.name, brand: t.brand, operator: t.operator, access: t.access });
  const km = kmBetween(center.lat, center.lon, lat, lon);
  const website = normalizeUrl(t.website || t['contact:website'] || t.url);
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
    website,
    phone: t.phone || t['contact:phone'] || null,
    email: t.email || t['contact:email'] || null,
    instagram: handleFrom(t['contact:instagram'] || t.instagram, 'instagram.com'),
    facebook: t['contact:facebook'] || t.facebook || null,
    tiktok: handleFrom(t['contact:tiktok'] || t.tiktok, 'tiktok.com'),
    youtube: t['contact:youtube'] || t.youtube || null,
    hours: t.opening_hours || null,
    rating: null,
    reviews: null,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.name} ${t['addr:city'] || center.city || ''}`.trim())}`,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    source: 'openstreetmap',
  };
}

async function fromOpenStreetMap(ctx, center, { radiusKm, categories }) {
  const q = overpassQuery({ lat: center.lat, lon: center.lon, radiusM: radiusKm * 1000, categories });
  const key = `gym:osm:${center.lat.toFixed(3)},${center.lon.toFixed(3)}:${radiusKm}:${(categories || []).slice().sort().join(',')}`;
  const elements = await cached(ctx, key, 24, () => overpass(ctx, q));
  return elements.map((el) => fromOsm(el, center)).filter(Boolean);
}

// ---------- Google Places (New) ----------

const PLACES_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryType',
  'places.types',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

const PLACES_QUERIES = {
  gym: 'gym',
  crossfit: 'crossfit gym',
  yoga: 'yoga studio',
  pilates: 'pilates studio',
  boxing: 'boxing gym',
  martial_arts: 'martial arts gym',
  climbing: 'climbing gym',
  cycling: 'indoor cycling studio',
  dance: 'dance fitness studio',
};
const PLACES_USD_PER_CALL = 0.035;

async function fromGooglePlaces(ctx, key, center, { radiusKm, categories, maxPages = 3 }) {
  const cats = categories && categories.length ? categories : ['gym', 'crossfit', 'yoga', 'pilates', 'boxing', 'martial_arts'];
  const out = [];
  let calls = 0;
  for (const cat of cats) {
    let pageToken;
    for (let page = 0; page < maxPages; page++) {
      const body = {
        textQuery: `${PLACES_QUERIES[cat] || cat} in ${center.city}${center.state ? `, ${center.state}` : ''}`,
        pageSize: 20,
        locationBias: { circle: { center: { latitude: center.lat, longitude: center.lon }, radius: Math.min(50000, radiusKm * 1000) } },
      };
      if (pageToken) body.pageToken = pageToken;
      const res = await getText(ctx, 'https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        timeoutMs: 20000,
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACES_FIELDS },
        body: JSON.stringify(body),
      });
      calls++;
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) throw new Error("127's Google key was refused. The list will use OpenStreetMap instead.");
        break;
      }
      const json = JSON.parse(res.text || '{}');
      for (const p of json.places || []) {
        if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
        const lat = p.location && p.location.latitude;
        const lon = p.location && p.location.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const km = kmBetween(center.lat, center.lon, lat, lon);
        if (km > radiusKm * 1.15) continue;
        const name = (p.displayName && p.displayName.text) || '';
        const owner = classifyOwner({ name });
        out.push({
          key: `gplaces:${p.id}`,
          name,
          category: cat === 'gym' ? categoryOf({ name }) : cat,
          owner: owner.kind,
          brand: owner.brand || null,
          ownerNote: owner.reason || null,
          address: p.formattedAddress || '',
          city: center.city,
          lat,
          lon,
          km: round(km, 1),
          miles: round(kmToMiles(km), 1),
          website: normalizeUrl(p.websiteUri),
          phone: p.nationalPhoneNumber || null,
          email: null,
          instagram: null,
          facebook: null,
          tiktok: null,
          youtube: null,
          hours: null,
          rating: Number.isFinite(p.rating) ? p.rating : null,
          reviews: Number.isFinite(p.userRatingCount) ? p.userRatingCount : null,
          mapsUrl: p.googleMapsUri || null,
          sourceUrl: p.googleMapsUri || null,
          source: 'google_places',
        });
      }
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    }
  }
  if (typeof ctx.spend === 'function' && calls) await ctx.spend(calls * PLACES_USD_PER_CALL, `Google Places: ${calls} searches`);
  log(ctx, `Asked Google ${calls} times`);
  return out;
}

// ---------- merge ----------

const normName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(the|gym|fitness|studio|llc|inc|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

// Same gym twice (OSM node + building, or Google + OSM): same name within 150 m, or same website within 1 km.
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
    if (g.source === 'google_places') {
      dup.rating = g.rating;
      dup.reviews = g.reviews;
      dup.mapsUrl = g.mapsUrl || dup.mapsUrl;
    }
  }
  return out;
}

module.exports = {
  CATEGORIES,
  geocode,
  overpassQuery,
  overpass,
  fromOsm,
  fromOpenStreetMap,
  fromGooglePlaces,
  categoryOf,
  dedupe,
  PLACES_USD_PER_CALL,
};
