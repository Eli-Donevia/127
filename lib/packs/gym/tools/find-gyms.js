// gym.find_gyms: every gym and studio around a city, with website, phone and socials where known.
// OpenStreetMap only. Google Places was taken out (G58): its terms allow keeping a place ID and nothing
// else, and a run's output, its approvals and the spreadsheet are all saved.

const src = require('../lib/sources');
const { log, domainOf } = require('../lib/util');
const sample = require('../sample/gyms.json');

const DEFAULT_KINDS = ['gym', 'crossfit', 'yoga', 'pilates', 'boxing', 'martial_arts', 'climbing'];
const KEEP = { independent: true, franchise: true };
// Fewer gyms to pitch than a first 25 needs gets one more search, twice as far out (30 miles at most).
const THIN = 25;
const TIMEOUT_SEC = 180;

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
    "Lists gyms, CrossFit boxes, studios and climbing gyms around a city from OpenStreetMap, with their website, phone and Instagram where known. A Facebook, Instagram or booking page doesn't count as a website. Skips school, hotel, apartment and city-run gyms, and big corporate chains unless asked. A town with fewer than 25 gyms to pitch gets one search twice as far.",
  kind: 'api',
  risk: 'read',
  needs: [],
  wants: ['osm'],
  credits: 20,
  timeoutSec: TIMEOUT_SEC,
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
    const started = Date.now();
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
      raw = await src.fromOpenStreetMap(ctx, center, { radiusKm, categories: kinds });
      source = 'openstreetmap';
    }
    const pitchable = (list) => list.filter((g) => KEEP[g.owner] || (input.includeChains && (g.owner === 'corporate' || g.owner === 'nonprofit')));
    let all = groupLocations(src.dedupe(raw));
    let miles = input.radiusMiles || 10;
    let widened = null;
    // A smaller city can have too few gyms within reach for a first 25. One more search, twice as far;
    // if it fails or is slow, the first list stands. It only gets the time the step has left, so a slow
    // first search can't push the step past its limit and lose the list it already has.
    const leftMs = TIMEOUT_SEC * 1000 - (Date.now() - started) - 5000;
    if (source === 'openstreetmap' && pitchable(all).length < THIN && miles < 30 && leftMs >= 10000) {
      const wider = Math.min(30, miles * 2);
      try {
        const more = groupLocations(src.dedupe(await src.fromOpenStreetMap(ctx, center, { radiusKm: wider * 1.609, categories: kinds, tries: 1, timeoutMs: Math.min(30000, leftMs) })));
        if (pitchable(more).length > pitchable(all).length) {
          widened = { from: miles, to: wider, before: pitchable(all).length };
          log(ctx, `Only ${widened.before} gyms within ${miles} miles, so the list reaches ${wider} miles`);
          all = more;
          miles = wider;
        }
      } catch (e) {
        if (ctx.signal && ctx.signal.aborted) throw e;
        log(ctx, `The wider search didn't answer, so the list stays within ${miles} miles`);
      }
    }
    const counts = { found: all.length, independent: 0, franchise: 0, corporate: 0, nonprofit: 0, public: 0 };
    for (const g of all) counts[g.owner] = (counts[g.owner] || 0) + 1;
    const keep = pitchable(all)
      .sort((a, b) => (a.km || 0) - (b.km || 0))
      .slice(0, input.limit || 60);
    counts.kept = keep.length;
    counts.withWebsite = keep.filter((g) => g.website).length;
    const ind = keep.filter((g) => g.owner === 'independent').length;
    log(ctx, `Found ${counts.found} places, kept ${keep.length} gyms you could pitch (${ind} independent, ${keep.length - ind} franchise or chain)`);
    return {
      gyms: keep,
      center,
      counts,
      source,
      credit: source === 'openstreetmap' ? src.OSM_CREDIT : '',
      osm: source === 'openstreetmap',
      radiusMiles: miles,
      ...(widened ? { widened } : {}),
      sample: sampleOnly,
      ...(held ? { held: true, note: src.HELD_NOTE } : {}),
    };
  },

  view(out) {
    const label = { independent: 'Independent', franchise: 'Franchise', corporate: 'Corporate', nonprofit: 'Nonprofit' };
    return [
      ...(out.held ? [{ type: 'text', text: out.note }] : []),
      ...(out.widened ? [{ type: 'text', text: `Only ${out.widened.before} gyms within ${out.widened.from} miles of ${out.center.city}, so the list reaches ${out.widened.to} miles.` }] : []),
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
    ];
  },
};
