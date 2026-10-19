// gym.find_gyms: every gym and studio around a city, with website, phone and socials where known.
// OpenStreetMap (free, real). Google Places is built but held off: see GOOGLE_STORAGE_OK.

const src = require('../lib/sources');
const { log, domainOf } = require('../lib/util');
const sample = require('../sample/gyms.json');

const DEFAULT_KINDS = ['gym', 'crossfit', 'yoga', 'pilates', 'boxing', 'martial_arts'];
const KEEP = { independent: true, franchise: true };

// Google's terms (Legal L53): keep only the place ID, fetch Google's fields again when shown and never
// store them. The pack keeps names, phones and websites in the Pipeline, so Google stays off, even
// with a key set, until the pack stores place IDs only and HQ re-fetches details for display.
const GOOGLE_STORAGE_OK = false;

// Two OSM pins for one business (same independent site): one lead with several locations.
function groupLocations(list) {
  const out = [];
  const byKey = new Map();
  for (const g of list) {
    const d = g.website && domainOf(g.website);
    const k = g.owner === 'independent' && d ? `ind:${d}` : g.website ? `url:${g.website.replace(/\/$/, '')}` : null;
    if (k && byKey.has(k)) {
      const first = byKey.get(k);
      first.locations = (first.locations || 1) + 1;
      first.otherLocations = (first.otherLocations || []).concat({ name: g.name, address: g.address, miles: g.miles });
      continue;
    }
    const copy = { ...g, locations: 1 };
    if (k) byKey.set(k, copy);
    out.push(copy);
  }
  return out;
}

function sampleGyms(center) {
  return sample.gyms.map((g, i) => ({
    ...g,
    key: `sample:${i + 1}`,
    city: center.city,
    lat: center.lat + g.dLat,
    lon: center.lon + g.dLon,
    source: 'sample',
    sample: true,
  }));
}

module.exports = {
  name: 'gym.find_gyms',
  title: 'Find gyms near you',
  description:
    'Lists gyms, CrossFit boxes and studios around a city from OpenStreetMap, with their website, phone and Instagram where known. Skips big corporate chains, schools, hotels and apartment gyms unless asked.',
  kind: 'api',
  risk: 'read',
  needs: [],
  wants: GOOGLE_STORAGE_OK ? ['places'] : [],
  credits: 20,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      city: { type: 'string', title: 'City', description: 'Like "Des Moines, IA"', maxLength: 120 },
      radiusMiles: { type: 'integer', title: 'Miles around it', minimum: 1, maximum: 30, default: 10 },
      kinds: { type: 'array', title: 'Kinds of gym', items: { type: 'string', enum: src.CATEGORIES }, default: DEFAULT_KINDS },
      includeChains: { type: 'boolean', title: 'Include corporate chains and nonprofits', default: false },
      limit: { type: 'integer', title: 'Most to list', minimum: 5, maximum: 150, default: 60 },
    },
    required: ['city'],
  },
  output: {
    type: 'object',
    properties: { gyms: { type: 'array' }, center: { type: 'object' }, counts: { type: 'object' }, source: { type: 'string' }, credit: { type: 'string' } },
    required: ['gyms'],
  },

  async run(input, ctx) {
    const radiusKm = (input.radiusMiles || 10) * 1.609;
    const kinds = input.kinds && input.kinds.length ? input.kinds : DEFAULT_KINDS;
    // A live run without 127's own map servers gets sample gyms, never the public servers (Legal L55, G53).
    const held = !ctx.sample && src.osmServer(ctx).held;
    const sampleOnly = !!ctx.sample || held;
    if (held) log(ctx, src.HELD_NOTE);
    let center;
    try {
      center = await src.geocode(ctx, input.city);
    } catch (e) {
      // Sample gyms are made up, so a map hiccup shouldn't stop a demo: place them around a stand-in center.
      if (!sampleOnly) throw e;
      center = { lat: 41.5868, lon: -93.625, label: input.city, city: String(input.city || 'your city').split(',')[0].trim() };
    }
    log(ctx, `Looking for gyms within ${input.radiusMiles || 10} miles of ${center.city}`);
    let raw;
    let source;
    if (sampleOnly) {
      raw = sampleGyms(center);
      source = 'sample';
    } else {
      const key = GOOGLE_STORAGE_OK && ctx.secret && ctx.secret('places');
      raw = [];
      if (key) {
        try {
          raw = await src.fromGooglePlaces(ctx, key, center, { radiusKm, categories: kinds, maxPages: 1 });
          source = 'google_places';
        } catch (e) {
          log(ctx, e.message);
        }
      }
      // OpenStreetMap always runs: it's free, and it often has the Instagram handle Google lacks.
      try {
        const osm = await src.fromOpenStreetMap(ctx, center, { radiusKm, categories: kinds });
        raw = raw.concat(osm);
        source = source ? 'google_places+openstreetmap' : 'openstreetmap';
      } catch (e) {
        if (!raw.length) throw e;
        log(ctx, 'OpenStreetMap was busy, so this list is Google only.');
      }
    }
    const all = groupLocations(src.dedupe(raw));
    const counts = { found: all.length, independent: 0, franchise: 0, corporate: 0, nonprofit: 0, public: 0 };
    for (const g of all) counts[g.owner] = (counts[g.owner] || 0) + 1;
    const keep = all
      .filter((g) => KEEP[g.owner] || (input.includeChains && (g.owner === 'corporate' || g.owner === 'nonprofit')))
      .sort((a, b) => (a.km || 0) - (b.km || 0))
      .slice(0, input.limit || 60);
    counts.kept = keep.length;
    counts.withWebsite = keep.filter((g) => g.website).length;
    const ind = keep.filter((g) => g.owner === 'independent').length;
    log(ctx, `Found ${counts.found} places, kept ${keep.length} gyms you could pitch (${ind} independent, ${keep.length - ind} franchise or chain)`);
    const credit = /openstreetmap/.test(source) ? src.OSM_CREDIT : '';
    return {
      gyms: keep,
      center,
      counts,
      source,
      credit: [credit, /google/.test(source) ? 'Ratings and details from Google Maps' : ''].filter(Boolean).join('. '),
      osm: /openstreetmap/.test(source),
      sample: sampleOnly,
      ...(held ? { held: true, note: src.HELD_NOTE } : {}),
    };
  },

  view(out) {
    const label = { independent: 'Independent', franchise: 'Franchise', corporate: 'Corporate', nonprofit: 'Nonprofit' };
    return [
      ...(out.held ? [{ type: 'text', text: out.note }] : []),
      { type: 'metric', label: 'Gyms you could pitch', value: out.gyms.length, note: `${out.counts.withWebsite} with a website, within reach of ${out.center.city}` },
      {
        type: 'table',
        columns: [
          { key: 'name', label: 'Gym' },
          { key: 'kind', label: 'Owner' },
          { key: 'miles', label: 'Miles', format: 'number' },
          { key: 'website', label: 'Website', format: 'link' },
        ],
        rows: out.gyms.map((g) => ({ name: g.locations > 1 ? `${g.name} (${g.locations} locations)` : g.name, kind: label[g.owner] || g.owner, miles: g.miles, website: g.website })),
        limit: 15,
      },
      ...(out.osm ? [{ type: 'link', label: src.OSM_CREDIT, href: src.OSM_COPYRIGHT }] : []),
      ...(out.center && out.center.searchCredit ? [{ type: 'link', label: out.center.searchCredit.label, href: out.center.searchCredit.href }] : []),
      ...(/google/i.test(out.credit || '') ? [{ type: 'text', text: 'Ratings and details from Google Maps' }] : []),
    ];
  },
};
