// Where the member works: city and state from what they typed, a latitude for the season check
// (kit crowd.season counts latitude 37 and up as cold winters), and a real map point when the
// network is on (kit places.geocode on 127's own servers, Legal L55 and L57). Offline, a city or
// state table gives an approximate latitude; that is all the season check needs.
// Shared household spine (cleaning, detailing, lawn, washing).

const { places } = require('..');

// Approximate latitude of each state's middle, and of large cities where the state's middle
// would mislead the cold-winter check (Los Angeles is not cold; California's middle is 37.2).
const STATES = {
  AL: ['Alabama', 32.8], AK: ['Alaska', 61.4], AZ: ['Arizona', 34.2], AR: ['Arkansas', 34.8], CA: ['California', 37.2],
  CO: ['Colorado', 39.0], CT: ['Connecticut', 41.6], DE: ['Delaware', 39.0], DC: ['District of Columbia', 38.9],
  FL: ['Florida', 28.6], GA: ['Georgia', 32.7], HI: ['Hawaii', 20.8], ID: ['Idaho', 44.4], IL: ['Illinois', 40.0],
  IN: ['Indiana', 39.9], IA: ['Iowa', 42.0], KS: ['Kansas', 38.5], KY: ['Kentucky', 37.5], LA: ['Louisiana', 31.0],
  ME: ['Maine', 45.4], MD: ['Maryland', 39.0], MA: ['Massachusetts', 42.3], MI: ['Michigan', 44.3], MN: ['Minnesota', 46.3],
  MS: ['Mississippi', 32.7], MO: ['Missouri', 38.4], MT: ['Montana', 47.0], NE: ['Nebraska', 41.5], NV: ['Nevada', 39.3],
  NH: ['New Hampshire', 43.7], NJ: ['New Jersey', 40.2], NM: ['New Mexico', 34.4], NY: ['New York', 42.9],
  NC: ['North Carolina', 35.5], ND: ['North Dakota', 47.5], OH: ['Ohio', 40.3], OK: ['Oklahoma', 35.6], OR: ['Oregon', 44.0],
  PA: ['Pennsylvania', 40.9], RI: ['Rhode Island', 41.7], SC: ['South Carolina', 33.9], SD: ['South Dakota', 44.4],
  TN: ['Tennessee', 35.9], TX: ['Texas', 31.5], UT: ['Utah', 39.3], VT: ['Vermont', 44.0], VA: ['Virginia', 37.5],
  WA: ['Washington', 47.4], WV: ['West Virginia', 38.6], WI: ['Wisconsin', 44.6], WY: ['Wyoming', 43.0],
};

const CITIES = {
  'los angeles': 34.05, 'san diego': 32.7, 'long beach': 33.8, 'anaheim': 33.8, 'irvine': 33.7, 'riverside': 33.95,
  'santa ana': 33.7, 'bakersfield': 35.4, 'fresno': 36.7, 'san jose': 37.3, 'san francisco': 37.8, 'oakland': 37.8,
  'sacramento': 38.6, 'las vegas': 36.2, 'henderson': 36.0, 'reno': 39.5, 'phoenix': 33.4, 'tucson': 32.2, 'mesa': 33.4,
  'albuquerque': 35.1, 'el paso': 31.8, 'denver': 39.7, 'salt lake city': 40.8, 'oklahoma city': 35.5, 'tulsa': 36.15,
  'nashville': 36.2, 'memphis': 35.1, 'knoxville': 35.96, 'chattanooga': 35.05, 'louisville': 38.25, 'lexington': 38.0,
  'richmond': 37.5, 'virginia beach': 36.85, 'norfolk': 36.85, 'charlotte': 35.2, 'raleigh': 35.8, 'durham': 36.0,
  'atlanta': 33.75, 'dallas': 32.8, 'fort worth': 32.75, 'houston': 29.8, 'austin': 30.3, 'san antonio': 29.4,
  'miami': 25.8, 'tampa': 27.95, 'orlando': 28.5, 'jacksonville': 30.3, 'new orleans': 29.95, 'birmingham': 33.5,
  'little rock': 34.75, 'charleston': 32.8, 'columbia': 34.0, 'chicago': 41.9, 'detroit': 42.3, 'minneapolis': 44.98,
  'st. paul': 44.95, 'saint paul': 44.95, 'des moines': 41.6, 'omaha': 41.25, 'kansas city': 39.1, 'st. louis': 38.6,
  'saint louis': 38.6, 'wichita': 37.7, 'columbus': 39.96, 'cleveland': 41.5, 'cincinnati': 39.1, 'pittsburgh': 40.44,
  'philadelphia': 39.95, 'new york': 40.7, 'brooklyn': 40.65, 'boston': 42.36, 'seattle': 47.6, 'portland': 45.5,
  'spokane': 47.66, 'boise': 43.6, 'milwaukee': 43.0, 'madison': 43.07, 'indianapolis': 39.77, 'baltimore': 39.3,
  'washington': 38.9, 'buffalo': 42.9, 'albany': 42.65, 'hartford': 41.76, 'providence': 41.8, 'newark': 40.7,
  'anchorage': 61.2, 'honolulu': 21.3, 'fargo': 46.9, 'sioux falls': 43.55, 'billings': 45.8, 'cheyenne': 41.1,
};

const NAME_TO_CODE = Object.fromEntries(Object.entries(STATES).map(([code, [name]]) => [name.toLowerCase(), code]));

// "Des Moines, IA" -> { city: 'Des Moines', state: 'IA' }; "Austin Texas" -> { city: 'Austin', state: 'TX' }
function parsePlace(place) {
  const raw = String(place || '').replace(/\b(USA|United States|US)\b\.?/gi, '').replace(/\s+/g, ' ').trim().replace(/[,\s]+$/, '');
  if (!raw) return { city: '', state: '' };
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  let state = '';
  let city = parts[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const code = (s) => {
    const t = String(s || '').replace(/\d{5}(-\d{4})?/, '').trim();
    if (/^[A-Za-z]{2}$/.test(t) && STATES[t.toUpperCase()]) return t.toUpperCase();
    return NAME_TO_CODE[t.toLowerCase()] || '';
  };
  if (last && code(last)) state = code(last);
  else {
    // "Austin Texas" or "Austin TX"
    const words = city.split(' ');
    for (const n of [2, 1]) {
      if (words.length > n && code(words.slice(-n).join(' '))) {
        state = code(words.slice(-n).join(' '));
        city = words.slice(0, -n).join(' ');
        break;
      }
    }
  }
  return { city: city.trim(), state };
}

// Latitude for the season check, offline. { lat, how: 'city' | 'state' | null }
function latOf(place) {
  const { city, state } = parsePlace(place);
  const c = city.toLowerCase();
  if (c && CITIES[c] != null) return { lat: CITIES[c], how: 'city' };
  if (state && STATES[state]) return { lat: STATES[state][1], how: 'state' };
  return { lat: null, how: null };
}

function kmBetween(aLat, aLon, bLat, bLon) {
  const r = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

// A real map point from the kit's geocode (one shared queue, cached as the server's terms allow).
// Returns { lat, lon, label, source, searchBy? } or null. searchBy: 'locationiq' rides along, so any
// list it feeds shows LocationIQ's link (Legal L57).
async function geocode(ctx, place) {
  const q = String(place || '').trim();
  if (!q) return null;
  try {
    const g = await places.geocode(ctx, q);
    if (g && Number.isFinite(g.lat) && Number.isFinite(g.lng)) return { lat: g.lat, lon: g.lng, label: g.label || q, source: 'openstreetmap', ...(g.searchBy ? { searchBy: g.searchBy } : {}) };
  } catch {
    /* fall through to the table */
  }
  return null;
}

// Where the member is, as well as we can tell: the map point when the network answers, else the
// table. Never throws.
async function locate(ctx, place, { network = true } = {}) {
  const parsed = parsePlace(place);
  const guess = latOf(place);
  if (network && !ctx.sample) {
    const g = await geocode(ctx, place);
    if (g && Number.isFinite(g.lat)) return { ...parsed, lat: g.lat, lon: g.lon, how: 'map', label: g.label, ...(g.searchBy ? { searchBy: g.searchBy } : {}) };
  }
  return { ...parsed, lat: guess.lat, lon: null, how: guess.how };
}

module.exports = { STATES, CITIES, parsePlace, latOf, kmBetween, geocode, locate };
