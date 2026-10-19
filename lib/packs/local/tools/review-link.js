// local.review_link: the member's Google review link, from a pasted link or Place ID, a Places
// lookup (IDs only) when a places key is connected, or a Maps link that opens their listing.

const { views } = require('../../_kit');
const F = require('../lib/facts');
const { BIZ, typed } = require('../lib/common');
const { reviewLink } = require('../lib/review-link');

module.exports = {
  name: 'local.review_link',
  title: 'Find your review link',
  description: 'Finds the link that opens your Google review box: from the link or Place ID you paste, a Google lookup when connected, or a Maps link to your listing. Saves the Place ID for next time.',
  kind: 'api',
  risk: 'read',
  needs: [],
  wants: ['places'],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      business: BIZ.business,
      city: BIZ.city,
      region: BIZ.region,
      link: { type: 'string', title: 'Your Google review link or Place ID (optional)', maxLength: 400, description: 'In your Business Profile, tap Ask for reviews and copy the link. Or paste a Place ID that starts with ChIJ.' },
    },
  },
  output: {
    type: 'object',
    required: ['url', 'kind'],
    properties: {
      url: { type: 'string' },
      kind: { type: 'string', enum: ['pasted', 'place_id', 'places_lookup', 'maps_search'] },
      placeId: { type: 'string' },
      how: { type: 'string' },
      note: { type: 'string' },
      sample: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, input);
    const saved = F.settingsOf(ctx, F.PACK);
    const out = await reviewLink(ctx, input, f, input.link ? {} : saved);
    await F.saveSettings(ctx, { ...typed(input, ['business']), placeId: out.placeId, reviewLink: out.kind === 'maps_search' ? null : out.url });
    return { ...out, placeId: out.placeId || '' };
  },
  view(out) {
    const label = { pasted: 'Your review link', place_id: 'Review link from your Place ID', places_lookup: 'Review link found on Google', maps_search: 'Link to your Google listing' }[out.kind] || 'Review link';
    return views.blocks(views.copy(label, out.url), views.text(out.note), out.kind === 'maps_search' && out.how ? views.text(out.how) : null);
  },
};
