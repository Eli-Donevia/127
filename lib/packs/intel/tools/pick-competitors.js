// The 5 to 10 competitors "Find the gap" reads: the websites the member pastes, topped up with
// businesses of the same kind near their city that have a website (OpenStreetMap through kit places,
// chains and duplicates dropped, the member's own site left out). Without a city or OpenStreetMap,
// sample businesses, said plainly.

const { views, web, places, text } = require('../../_kit');
const { parseSites } = require('../lib/compete');
const { refusedHost } = require('../lib/reviews');

module.exports = {
  name: 'intel.pick_competitors',
  title: 'Pick competitors to read',
  description: 'Takes the competitor websites you paste and tops them up with businesses of the same kind near you that have a website, 5 to 10 in all.',
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['osm'],
  credits: 3,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      category: { type: 'string', title: 'Kind of business', description: 'Like "dog groomers", "yoga studios" or "plumbers"' },
      city: { type: 'string', title: 'City' },
      sites: { type: 'string', title: 'Competitor websites (optional)', description: 'One per line' },
      mine: { type: 'string', title: 'Your website (optional)', description: 'Left out of the list' },
      count: { type: 'integer', minimum: 5, maximum: 10, default: 8 },
    },
    required: ['category'],
  },
  output: {
    type: 'object',
    properties: { sites: { type: 'array' }, category: { type: 'object' }, city: { type: 'string' }, notes: { type: 'array' }, sample: { type: 'boolean' } },
    required: ['sites', 'category', 'notes'],
  },
  async run(input, ctx) {
    const cat = places.categoryOf(input.category);
    const city = text.clip(text.plain(input.city || ''), 80);
    const want = Math.max(5, Math.min(10, Number(input.count) || 8));
    const mineDom = input.mine ? web.domainOf(input.mine) : null;
    const notes = [];
    const list = [];
    const seen = new Set(mineDom ? [mineDom] : []);
    for (const s of parseSites(input.sites || '', 10)) {
      const dom = web.domainOf(s.website);
      const host = refusedHost(s.website);
      if (host) {
        notes.push(`Skipped ${host}: we read each business's own website, not listing or review sites.`);
        continue;
      }
      if (!dom || seen.has(dom)) continue;
      seen.add(dom);
      list.push({ website: s.website, name: s.name || '', source: 'pasted' });
    }
    let found = null;
    if (list.length < want && city) {
      found = await places.findPlaces(ctx, { category: cat, city, limit: 40, google: false });
      const { kept } = places.filterPlaces(found.places, { category: cat, known: [...seen] });
      for (const p of kept) {
        if (list.length >= want) break;
        const dom = p.website ? web.domainOf(p.website) : null;
        if (!dom || seen.has(dom) || refusedHost(p.website)) continue;
        seen.add(dom);
        list.push({ website: p.website, name: p.name, source: p.source, ...(p.address ? { address: p.address } : {}), ...(p.searchBy ? { searchBy: p.searchBy } : {}), ...(p.sample ? { sample: true } : {}) });
      }
      if (found.note) notes.push(found.note);
    }
    if (!list.length) {
      throw new Error(city ? `We couldn't find ${cat.many} with a website near ${places.cityShort(city)}. Paste 5 to 10 competitor websites instead.` : 'Add your city, or paste 5 to 10 competitor websites.');
    }
    if (list.length < 5) notes.push(`Only ${list.length} ${list.length === 1 ? 'competitor has' : 'competitors have'} a website we can read. Paste more to make the gaps clearer.`);
    const sample = list.every((x) => x.sample);
    ctx.log(`Picked ${list.length} competitors${found ? ` (${found.source === 'osm' ? 'OpenStreetMap' : found.source})` : ''}`);
    return { sites: list.slice(0, want), category: { id: cat.id, label: cat.label, one: cat.one, many: cat.many, family: cat.family || 'other' }, city, notes, sample };
  },
  view(out) {
    return views.blocks(
      views.metric('Competitors to read', out.sites.length, out.city ? `${out.category.many} near ${places.cityShort(out.city)}` : out.category.many),
      views.table([{ key: 'name', label: 'Business' }, { key: 'site', label: 'Website' }, { key: 'from', label: 'From' }], out.sites.map((s) => ({ name: s.name || web.shortSite(s.website), site: web.shortSite(s.website), from: s.source === 'pasted' ? 'You pasted it' : s.source === 'osm' ? 'OpenStreetMap' : 'Sample' })), 10),
      ...places.creditBlocks(out.sites),
      out.notes.map((n) => views.text(n))
    );
  },
};
