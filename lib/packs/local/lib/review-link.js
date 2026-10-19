// The member's Google review link: a pasted link, a Place ID, a Places lookup (IDs only, the free
// field set) when the run has a places key, or else a Maps search link that opens their listing.
// Only the place ID is stored (Google Places terms).

const kit = require('../../_kit');
const { text } = kit;
const REV = require('../data/reviews.json');

const PLACE_ID = /^[A-Za-z0-9_-]{20,250}$/;
const GOOGLE_HOST = /(^|\.)(g\.page|search\.google\.com|maps\.app\.goo\.gl|goo\.gl|google\.[a-z]{2,3}(\.[a-z]{2})?)$/i;

const writeReview = (id) => `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`;
const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q).replace(/%20/g, '+')}`;

function fromPasted(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (!/[./]/.test(s) && PLACE_ID.test(s)) return { url: writeReview(s), kind: 'place_id', placeId: s };
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return { error: "That doesn't look like a link. Paste the review link from your Google Business Profile, or your Place ID." };
  }
  if (!GOOGLE_HOST.test(u.hostname)) return { error: 'That link is not on Google. Paste the review link from your Google Business Profile (Ask for reviews), or your Place ID.' };
  u.protocol = 'https:';
  const pid = u.searchParams.get('placeid') || u.searchParams.get('place_id');
  return { url: u.toString(), kind: 'pasted', placeId: pid && PLACE_ID.test(pid) ? pid : null };
}

async function placesLookup(ctx, key, query) {
  const doFetch = ctx && typeof ctx.fetch === 'function' ? ctx.fetch.bind(ctx) : fetch;
  const res = await doFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({ textQuery: query, pageSize: 1 }),
  });
  if (!res.ok) throw new Error(`Places answered ${res.status}`);
  const data = await res.json();
  const id = data && data.places && data.places[0] && data.places[0].id;
  return id && PLACE_ID.test(id) ? id : null;
}

function secret(ctx, name) {
  try {
    return ctx && typeof ctx.secret === 'function' ? ctx.secret(name) : null;
  } catch {
    return null;
  }
}

// f: facts from lib/facts. Returns { url, kind, placeId, how, note, sample }.
async function reviewLink(ctx, input, f, saved = {}) {
  const pasted = fromPasted(input.link) || fromPasted(input.placeId);
  if (pasted && pasted.error) throw new Error(pasted.error);
  const how = REV.link.find_place_id ? `Find your Place ID at ${REV.link.find_place_id}, or copy the review link in your Business Profile under Ask for reviews.` : '';
  if (pasted) return { ...pasted, how, note: pasted.kind === 'place_id' ? 'Opens the Google review box for your business directly.' : 'Your own review link from Google.', sample: false };
  if (saved.placeId && PLACE_ID.test(saved.placeId)) return { url: writeReview(saved.placeId), kind: 'place_id', placeId: saved.placeId, how, note: 'Using the Place ID saved from your last run.', sample: false };
  const query = [f.name, f.place || f.city].filter(Boolean).join(' ');
  const key = secret(ctx, 'places');
  if (key && !(ctx && ctx.sample) && f.hasName && (f.place || f.city)) {
    try {
      const id = await placesLookup(ctx, key, query);
      if (id) return { url: writeReview(id), kind: 'places_lookup', placeId: id, how, note: `Found on Google as "${text.clip(query, 60)}". Scan it once yourself to make sure it opens your business.`, sample: false };
    } catch {
      // Fall through to the Maps search link.
    }
  }
  return {
    url: mapsSearch(query || 'my business'),
    kind: 'maps_search',
    placeId: null,
    how,
    note: 'This opens your business on Google Maps, where customers tap Reviews. For a link that opens the review box directly, paste your review link or Place ID and run this again.',
    sample: !f.hasName,
  };
}

module.exports = { reviewLink, fromPasted, writeReview, mapsSearch, PLACE_ID };
