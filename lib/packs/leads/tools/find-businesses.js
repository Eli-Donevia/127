// Local businesses of one kind near a city: Google Places when the key is set, else OpenStreetMap,
// else clearly marked sample businesses. Drops chains, closed listings, duplicates and businesses
// already anywhere in this member's Pipeline, from any workflow (so "25 a day" never repeats one).

const { text, views, places, web, leads } = require('../../_kit');
const { cityOf } = require('../lib/services');

module.exports = {
  name: 'leads.find_businesses',
  title: 'Local business search',
  description: 'Searches the map for independent local businesses of one kind near a city (Google Places with a key, else OpenStreetMap, else sample), without chains, closed listings, duplicates or businesses already in your Pipeline.',
  kind: 'api',
  risk: 'read',
  needs: [],
  wants: ['places', 'osm'],
  credits: 8,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      category: { type: 'string', title: 'Kind of business', description: 'For example "dentists", "gyms", "plumbers" or any words' },
      city: { type: 'string', title: 'City', description: 'For example "Des Moines, IA". Empty: the member\'s city' },
      limit: { type: 'integer', minimum: 1, maximum: 60, default: 30 },
      radius_km: { type: 'integer', minimum: 1, maximum: 40, default: 15 },
      skip_known: { type: 'boolean', default: true, title: 'Skip businesses already in your Pipeline' },
    },
    required: ['category'],
  },
  output: { type: 'object', properties: { places: { type: 'array' }, category: { type: 'object' }, city: { type: 'string' }, source: { type: 'string' } }, required: ['places', 'category', 'city', 'source'] },
  async run(input, ctx) {
    const cat = places.categoryOf(input.category);
    const city = cityOf(ctx, input);
    const want = input.limit;
    const r = await places.findPlaces(ctx, { category: cat, city, limit: Math.min(60, want + 10), radiusKm: input.radius_km });
    // Keys and website domains of every lead the member has, whichever pack found them.
    const k = input.skip_known ? await leads.known(ctx) : null;
    const known = k ? [...k.keys, ...k.sites].filter(Boolean) : [];
    const { kept, dropped } = places.filterPlaces(r.places, { category: cat, known });
    const list = kept.slice(0, want).map((p) => ({ ...p, km: Number.isFinite(p.km) ? Math.round(p.km * 10) / 10 : null }));
    ctx.log(`Found ${list.length} ${cat.many} near ${places.cityShort(city) || 'you'} (${r.source === 'google' ? 'Google Maps' : r.source === 'osm' ? 'OpenStreetMap' : 'sample'})`);
    return {
      places: list,
      category: { id: cat.id, label: cat.label, one: cat.one, many: cat.many, what: cat.what, thing: cat.thing, film: cat.film },
      city,
      source: r.source,
      sample: !!r.sample,
      attribution: r.attribution,
      note: text.plain(r.note || ''),
      dropped,
    };
  },
  view(out) {
    const d = out.dropped || {};
    const skipped = [d.chains && `${d.chains} chains`, d.closed && `${d.closed} closed`, d.dupes && `${d.dupes} duplicates`, d.known && `${d.known} already in your Pipeline`].filter(Boolean);
    return views.blocks(
      views.metric('Businesses found', out.places.length, `${out.category.many} near ${places.cityShort(out.city)}`),
      out.note ? views.text(out.note) : null,
      skipped.length ? views.text(`Left out: ${text.list(skipped)}.`) : null,
      views.table([{ key: 'name', label: 'Business' }, { key: 'site', label: 'Website' }, { key: 'km', label: 'km away', format: 'number' }], out.places.map((p) => ({ name: p.name, site: p.website ? web.shortSite(p.website) : 'None listed', km: p.km })), 10),
      out.source === 'osm' ? places.creditBlocks(out.places) : views.text(`Source: ${out.attribution}`)
    );
  },
};
