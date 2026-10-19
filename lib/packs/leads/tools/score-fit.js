// Ranks checked businesses for what the member sells: points for each gap this service fixes plus
// signs of a good fit, facts only, with the reasons in plain words.

const { views, leads, text, web, places } = require('../../_kit');
const { serviceOf } = require('../lib/services');

// What a ranked lead carries forward (keeps step outputs small).
function slim(l) {
  const { key, rank, score, name, siteName, placeId, mapsUrl, website, address, phone, rating, reviews, lat, lng, instagram, category, city, siteStatus, siteNote, brokenLink, site, checked, gaps, fits, reasons, source, sample, attribution } = l;
  return { key, rank, score, name, siteName, placeId, mapsUrl, website, address, phone, rating, reviews, lat, lng, instagram, category, city, siteStatus, siteNote, brokenLink, site, checked, gaps, fits: (fits || []).map((f) => ({ id: f.id, why: f.why, points: f.points })), reasons: (reasons || []).slice(0, 6), source, sample, attribution };
}

module.exports = {
  name: 'leads.score_fit',
  title: 'Rank by fit',
  description: 'Ranks checked businesses for your service: points for each gap you fix plus signs of a good fit, with the reasons.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      leads: { type: 'array', title: 'Checked businesses', description: 'Outputs of leads.scan_business' },
      service: { type: 'string', title: 'What you sell', description: 'For example "websites", "short videos", "bookkeeping"' },
      top: { type: 'integer', minimum: 1, maximum: 60, default: 25 },
    },
    required: ['leads', 'service'],
  },
  output: { type: 'object', properties: { leads: { type: 'array' }, stats: { type: 'object' }, headline: { type: 'array' }, service: { type: 'object' } }, required: ['leads', 'stats', 'headline', 'service'] },
  async run(input, ctx) {
    const service = serviceOf(input.service);
    const list = (input.leads || []).filter((l) => l && l.key && !l.error);
    if (!list.length) throw new Error('No businesses to rank. Try another kind of business or a bigger area.');
    const { leads: ranked, stats } = leads.rankLeads(list, service, { top: input.top });
    const headline = leads.headline(stats, service).map((h) => h.line);
    const google = list.some((l) => l.source === 'google');
    ctx.log(`Ranked ${ranked.length} for ${service.label.toLowerCase()}${headline[0] ? `: ${headline[0]}` : ''}`);
    return {
      service: { id: service.id, label: service.label, sell: service.sell },
      leads: ranked.map(slim),
      stats,
      headline,
      sample: list.some((l) => l.sample),
      attribution: google ? 'Business names and ratings from Google Maps (shown here only, never saved).' : list[0].attribution || '',
    };
  },
  view(out) {
    const rows = out.leads.map((l) => ({ rank: l.rank, name: l.name || l.siteName || 'Map listing', score: l.score, missing: text.clip(leads.shareableGaps(l).map((g) => g.chip).join(', '), 80) || 'Nothing obvious', why: text.clip((l.reasons || [])[0] || '', 90), site: l.website && l.siteStatus !== 'none' ? l.website : l.mapsUrl || '' }));
    return views.blocks(
      views.metric('Ranked for you', out.leads.length, `best fit for ${out.service.label.toLowerCase()} first`),
      out.headline.length ? views.text(out.headline.join('. ') + '.') : null,
      views.table([{ key: 'rank', label: '#', format: 'number' }, { key: 'name', label: 'Business' }, { key: 'score', label: 'Fit', format: 'number' }, { key: 'missing', label: 'What is missing' }, { key: 'why', label: 'Why them' }, { key: 'site', label: 'Link', format: 'link' }], rows, 10),
      out.leads.some((l) => l.source === 'osm') ? places.creditBlocks(out.leads) : out.attribution ? views.text(out.attribution) : null,
      // Once: a sample list's own attribution already says the businesses are made up.
      out.sample && !(out.attribution && /sample/i.test(out.attribution) && !out.leads.some((l) => l.source === 'osm')) ? views.text('Sample businesses: made up so you can see how it works.') : null
    );
  },

};
