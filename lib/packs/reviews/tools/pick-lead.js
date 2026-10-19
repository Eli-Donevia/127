// One shop from the member's Pipeline (any tool's lead: name, website or key), or the name and website
// they typed when it isn't there yet. The next steps read its website, kind of shop, city, map
// listing (place ID or map link, for the card's code), facts and stage from here, and the
// OpenStreetMap credit follows a shop found there (D27).

const kit = require('../../_kit');
const { text, views } = kit;
const NICHE = require('../data/niche.json');
const talk = require('../../_kit/talk');

const SHOPS = Object.keys(NICHE.shops);

module.exports = {
  name: 'reviews.pick',
  title: 'Find the shop',
  description: 'Finds one shop in your Pipeline by name or website, or uses the name and website you typed when it isn\'t there yet.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', maxLength: 120 },
      website: { type: 'string', maxLength: 300 },
      shop: { type: 'string', enum: SHOPS },
      city: { type: 'string', maxLength: 120 },
    },
  },
  output: { type: 'object', required: ['lead', 'name'], properties: { lead: { type: 'object' }, name: { type: 'string' }, inPipeline: { type: 'boolean' }, stage: { type: 'string' } } },
  timeoutSec: 20,
  async run(input, ctx) {
    const typed = { name: input.name, website: input.website };
    const { lead, rows } = await talk.findLead(ctx, typed);
    // A Google Maps shop reaches tools without its name; the name the member typed stands in.
    const blank = !lead.name || /^\[.*\]$/.test(lead.name) || lead.name === 'Google Maps listing';
    const typedName = talk.domainOf(input.name) ? '' : text.oneLine(String(input.name || '')).slice(0, 120);
    const name = blank ? typedName || talk.domainOf(lead.website) || 'This shop' : lead.name;
    const website = talk.siteUrl(input.website) || lead.website || '';
    const data = lead.data || {};
    const shop = SHOPS.includes(input.shop) && (input.shop !== 'salons' || !SHOPS.includes(data.shop)) ? input.shop : SHOPS.includes(data.shop) ? data.shop : 'salons';
    const out = {
      name,
      website,
      shop,
      city: text.plain(input.city || lead.city || ''),
      key: lead.key,
      id: lead.id,
      pack: lead.pack,
      inPipeline: lead.inPipeline,
      stage: lead.stage,
      touches: 0,
      mapsUrl: lead.maps || '',
      placeId: lead.placeId || '',
      phone: lead.phone || '',
      email: lead.email || '',
      facts: lead.facts,
      score: lead.score,
      channel: lead.channel,
      msg: lead.msg,
      reply: lead.reply || '',
      data,
      // Where the shop itself came from (osm, google or sample), for the map credit on pages.
      source: data.placeSource || (lead.placeId ? 'google' : ''),
      ...(data.searchBy ? { searchBy: data.searchBy } : {}),
      sample: lead.sample,
    };
    const row = lead.inPipeline ? rows.find((r) => r && r.id === lead.id) : null;
    if (row && Number.isFinite(row.touches)) out.touches = row.touches;
    const hint = lead.inPipeline ? '' : talk.missHint(rows, typed);
    return { lead: out, name, inPipeline: lead.inPipeline, stage: lead.stage || '', hint };
  },
  view(out) {
    return views.blocks(
      views.text(out.inPipeline ? `${out.name} is in your Pipeline (${talk.stageLabel(out.stage)}).` : `${out.name} isn't in your Pipeline yet. Using the name and website you typed.`),
      out.hint ? views.text(out.hint) : null,
    );
  },
};
