// Local businesses that serve the same customers as the member (the 10 businesses in "Your first 25",
// "Your next 25" and the buyer lists in the niche specials), through the kit's places search:
//   OpenStreetMap (Overpass) by the type's map tags, free, on 127's own servers (Legal L55): live runs
//     without them are held and show sample businesses with places.HELD_NOTE. Every list that shows
//     OSM businesses carries the credit (places.creditBlocks in views, creditLine as the last CSV
//     row, creditHtml in pages), plus "Search by LocationIQ.com" when LocationIQ found the town (L57).
//   Google Places is opt-in per call (Legal L53) and these lists save names and phones, so they never
//     ask for it.
//   Sample businesses from sample/partners.json in sample runs, or when the search can't answer.
// Partner types, their search words and map tags live in data/niche.json "partners" (and the
// specials' own buyer types). Shared household spine.

const { places } = require('..');
const { kmBetween } = require('./geo');

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

// A kit places category for one partner type: a kit category when the data names one, with the
// type's own words, map tags and chain names on top.
function categoryFor(type) {
  const s = type.search || {};
  const base = s.category ? places.categoryOf(s.category) : null;
  const kit = base && !base.custom ? base : null;
  return {
    id: kit ? kit.id : `home-${type.id}`,
    label: type.label,
    one: type.one || (kit && kit.one) || String(type.label).toLowerCase(),
    many: (kit && kit.many) || String(type.label).toLowerCase(),
    q: s.words || (kit && kit.q) || String(type.label).toLowerCase(),
    type: s.google_type !== undefined ? s.google_type : kit ? kit.type : null,
    osm: s.osm || (kit && kit.osm) || [],
    chains: [...((kit && kit.chains) || []), ...(s.chains || [])],
    family: (kit && kit.family) || 'home',
    aliases: [],
    what: 'work',
    film: '',
    thing: 'job',
  };
}

function samplePartners(cfg, place) {
  const list = (cfg.sample && cfg.sample.partners && cfg.sample.partners.partners) || [];
  const city = String(place || '').split(',')[0].trim();
  return list.map((p, i) => ({
    key: `sample:${p.type}:${i + 1}`,
    name: p.name,
    type: p.type,
    address: city ? `${p.street}, ${city}` : p.street,
    phone: p.phone || '',
    website: p.website || '',
    km: p.km != null ? p.km : null,
    source: 'sample',
    sample: true,
  }));
}

// Practice businesses for each type from the kit (names end in "(sample)"), around the town's center.
function kitSamplesFor(types, place, center, per) {
  const c = center && Number.isFinite(center.lat) && Number.isFinite(center.lon) ? center : (({ lat, lng }) => ({ lat, lon: lng }))(places.sampleCenter(place || 'Your town'));
  return types.flatMap((type) => {
    const cat = categoryFor(type);
    const { kept } = places.filterPlaces(places.samplePlaces({ category: cat, city: place || 'Your town', limit: Math.max(4, per) }), { category: cat });
    return kept.map((p) => ({ ...fromKit(p, type, c), source: 'sample', sample: true }));
  });
}

function fromKit(p, type, center) {
  const lat = Number.isFinite(p.lat) ? p.lat : null;
  const lon = Number.isFinite(p.lng) ? p.lng : null;
  let km = Number.isFinite(p.km) ? p.km : null;
  if (km == null && lat != null && center && Number.isFinite(center.lat) && Number.isFinite(center.lon)) km = kmBetween(center.lat, center.lon, lat, lon);
  return {
    key: p.key,
    place_id: p.placeId || undefined,
    name: p.name,
    type: type.id,
    address: p.address || '',
    phone: p.phone || '',
    website: p.website || '',
    rating: p.source === 'google' && Number.isFinite(p.rating) ? p.rating : null,
    reviews: p.source === 'google' && Number.isFinite(p.reviews) ? p.reviews : null,
    km: km == null ? null : Math.round(km * 10) / 10,
    instagram: p.source === 'google' ? null : p.instagram || null,
    lat: p.source === 'google' ? null : lat,
    lon: p.source === 'google' ? null : lon,
    source: p.source,
    sourceUrl: p.mapsUrl || '',
    ...(p.searchBy ? { searchBy: p.searchBy } : {}),
  };
}

function excluded(b, ex) {
  if (!ex.size) return false;
  return ex.has(norm(b.name)) || ex.has(norm(b.key)) || (b.place_id && ex.has(norm(b.place_id)));
}

// Spread the list across partner types (weighted types first), nearest first inside each type.
function interleave(list, types) {
  const byType = types.map((t) => list.filter((b) => b.type === t.id).sort((a, b) => (a.km == null ? 999 : a.km) - (b.km == null ? 999 : b.km)));
  const weights = types.map((t) => Math.max(1, Number(t.weight) || 1));
  const order = [];
  for (let round = 0; order.length < list.length && round < 200; round++) {
    let added = false;
    byType.forEach((l, i) => {
      for (let k = 0; k < weights[i]; k++) {
        const b = l.shift();
        if (b) {
          order.push(b);
          added = true;
        }
      }
    });
    if (!added) break;
  }
  return order;
}

// Returns { partners, source, sample, notes, credit, found }.
// opts: { place: "Des Moines, IA", center: { lat, lon }, types, limit, exclude: [names, keys or
// place ids already worked], skip (a test for one business, like a known website), batch (2 = the
// next 10), per (how many to ask for per type), network, kitSamples (practice businesses from the kit,
// one set per type, instead of the pack's sample/partners.json: for the specials' own buyer types) }
async function findPartners(ctx, cfg, { place, center, types, limit = 10, exclude = [], skip = null, batch = 1, per: perType = 0, network = true, kitSamples = false } = {}) {
  const ex = new Set((exclude || []).map(norm).filter(Boolean));
  const notes = [];
  const b = Math.max(1, Math.round(Number(batch) || 1));
  let raw = [];
  let sources = new Set();
  let held = false;
  const per = perType > 0 ? Math.min(60, perType) : Math.min(20, Math.ceil((limit * b) / Math.max(1, types.length)) + 4);
  if (!ctx.sample && network && place) {
    for (const type of types) {
      const cat = categoryFor(type);
      try {
        const r = await places.findPlaces(ctx, { category: cat, city: place, limit: per, radiusKm: (type.search && type.search.radius_km) || 15 });
        if (r && r.held) held = true;
        if (!r || r.sample) continue;
        const { kept } = places.filterPlaces(r.places, { category: cat });
        for (const p of kept) raw.push(fromKit(p, type, center));
        sources.add(r.source);
      } catch (e) {
        if (ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
        if (/limit|budget|paused/i.test(String(e && e.message))) throw e;
      }
    }
  }
  let sample = false;
  if (!raw.length) {
    if (held) notes.push(places.HELD_NOTE);
    else if (!ctx.sample && network && place) notes.push(`We couldn't list real businesses near ${place} right now, so these are sample businesses. Run it again later, or check the spelling ("City, ST").`);
    raw = kitSamples ? kitSamplesFor(types, place, center, per) : samplePartners(cfg, place);
    sources = new Set(['sample']);
    sample = true;
  }
  // The same business twice (two map points, or two partner types): keep the first.
  const seen = new Set();
  const unique = raw.filter((x) => {
    const k = norm(x.name) || norm(x.key);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const fresh = interleave(unique.filter((x) => !excluded(x, ex) && !(typeof skip === 'function' && skip(x))), types);
  const start = (b - 1) * limit;
  let partners = fresh.slice(start, start + limit);
  if (!partners.length && fresh.length) {
    notes.push(`Batch ${b} ran past the end of the list, so these are the first ones you haven't worked yet.`);
    partners = fresh.slice(0, limit);
  }
  if (!partners.length) notes.push('Every business we found is already on your worked list. Try a nearby town.');
  const source = sources.has('google') ? 'google' : sources.has('osm') ? 'osm' : 'sample';
  const credit = source === 'osm' ? places.creditLine(partners) : '';
  return { partners, source, sample, held, notes, credit, found: unique.length };
}

// What may be kept in files and the Pipeline: a Google place keeps its place_id and Maps link only.
function keepable(p) {
  if (p.source !== 'google') return p;
  return { key: p.key, place_id: p.place_id, type: p.type, source: 'google', sourceUrl: p.sourceUrl || places.mapsLink({ placeId: p.place_id }), name: '', address: '', phone: '', website: '' };
}

module.exports = { findPartners, categoryFor, samplePartners, interleave, keepable };
