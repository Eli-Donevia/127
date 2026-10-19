// One contractor from the member's Pipeline (any tool's lead: name, website or key), or the name and
// website they typed when it isn't there yet. The next steps read its website, trade, city, facts
// and stage from here, and the OpenStreetMap credit follows a business found there (D27).

const kit = require('../../_kit');
const { text, views } = kit;
const NICHE = require('../data/niche.json');
const talk = require('../../_kit/talk');

const TRADES = Object.keys(NICHE.trades);

module.exports = {
  name: 'frontdesk.pick',
  title: 'Find the business',
  description: 'Finds one business in your Pipeline by name or website, or uses the name and website you typed when it isn\'t there yet.',
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
      trade: { type: 'string', enum: TRADES },
      city: { type: 'string', maxLength: 120 },
    },
  },
  output: { type: 'object', required: ['lead', 'name'], properties: { lead: { type: 'object' }, name: { type: 'string' }, inPipeline: { type: 'boolean' }, stage: { type: 'string' } } },
  timeoutSec: 20,
  async run(input, ctx) {
    const typed = { name: input.name, website: input.website };
    const { lead, rows } = await talk.findLead(ctx, typed);
    // A Google Maps business reaches tools without its name; the name the member typed stands in.
    const blank = !lead.name || /^\[.*\]$/.test(lead.name);
    const typedName = talk.domainOf(input.name) ? '' : text.oneLine(String(input.name || '')).slice(0, 120);
    const name = blank ? typedName || talk.domainOf(lead.website) || 'This business' : lead.name;
    const website = talk.siteUrl(input.website) || lead.website || '';
    const data = lead.data || {};
    const trade = input.trade && input.trade !== 'contractors' ? input.trade : TRADES.includes(data.trade) ? data.trade : input.trade || 'contractors';
    const out = {
      name,
      website,
      trade,
      city: text.plain(input.city || lead.city || ''),
      key: lead.key,
      id: lead.id,
      pack: lead.pack,
      inPipeline: lead.inPipeline,
      stage: lead.stage,
      touches: 0,
      mapsUrl: lead.maps || '',
      phone: lead.phone || '',
      email: lead.email || '',
      facts: lead.facts,
      score: lead.score,
      channel: lead.channel,
      msg: lead.msg,
      data,
      // Where the business itself came from (osm, google or sample), for the map credit on pages.
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
