// One brand from the member's Pipeline (any tool's lead: name, store link or key), or the name and
// store link they typed when it isn't there yet. The next steps read its store address (for
// shop.read_store), category, product, facts, stage and whether a concept was already sent.

const kit = require('../../_kit');
const { text, views, time } = kit;
const U = require('../lib/ugc');
const talk = require('../../_kit/talk');

function findByName(name) {
  const want = talk.norm(name);
  if (want.length < 3) return '';
  for (const list of Object.values(U.brandsData().stores || {})) {
    for (const b of list || []) if (b && talk.norm(U.brandName(b.name)) === want) return b.domain;
  }
  return '';
}

module.exports = {
  name: 'ugc.pick',
  title: 'Find the brand',
  description: "Finds one brand in your Pipeline by name or store link, or uses the name and store link you typed when it isn't there yet.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    required: ['brand'],
    properties: {
      brand: { type: 'string', maxLength: 120 },
      store: { type: 'string', maxLength: 300 },
      category: { type: 'string', enum: U.CAT_IDS },
    },
  },
  output: { type: 'object', required: ['lead', 'name', 'store'], properties: { lead: { type: 'object' }, brand: { type: 'object' }, name: { type: 'string' }, store: { type: 'string' }, hasStore: { type: 'boolean' }, inPipeline: { type: 'boolean' }, stage: { type: 'string' } } },
  timeoutSec: 20,
  async run(input, ctx) {
    const typed = { name: input.brand, website: input.store };
    const { lead, rows } = await talk.findLead(ctx, typed);
    // A brand typed by name only: its store from your brand list, when the name matches one exactly.
    const byName = !lead.inPipeline && !talk.domainOf(input.store) && !talk.domainOf(input.brand) ? findByName(input.brand) : '';
    const domain = talk.domainOf(input.store) || talk.domainOf(lead.website) || talk.domainOf(input.brand) || byName;
    const snap = domain ? U.findSnapshot(domain) : null;
    const typedName = talk.domainOf(input.brand) ? '' : text.oneLine(String(input.brand || '')).slice(0, 120);
    const name = lead.inPipeline && lead.name && !/^\[.*\]$/.test(lead.name) ? lead.name : typedName || (snap && U.brandName(snap.name)) || domain || 'This brand';
    const data = lead.data || {};
    const category = U.CATS[input.category] && (input.category !== 'skincare' || !U.CATS[data.category]) ? input.category : U.CATS[data.category] ? data.category : snap && U.CATS[snap.category] ? snap.category : input.category || 'skincare';
    const row = lead.inPipeline ? rows.find((r) => r && r.id === lead.id) : null;
    const out = {
      ...lead,
      name,
      website: domain ? `https://${domain}` : lead.website || '',
      domain,
      category,
      touches: row && Number.isFinite(row.touches) ? row.touches : 0,
      concept: !!data.conceptMade,
    };
    const brand = U.brandFor({ lead: out, category, today: time.today(ctx) });
    const hint = lead.inPipeline ? '' : domain ? '' : 'Add their store link (like brand.com) so the next step can read their products.';
    return { lead: out, brand, name, store: domain || '', hasStore: !!domain, category, inPipeline: lead.inPipeline, stage: lead.stage || '', hint, fromList: !!byName };
  },
  view(out) {
    return views.blocks(
      views.text(out.inPipeline ? `${out.name} is in your Pipeline (${talk.stageLabel(out.stage)}).` : out.fromList ? `${out.name} isn't in your Pipeline yet. Using its store from your brand list, ${out.store}.` : out.store ? `${out.name} isn't in your Pipeline yet. Using the store you typed, ${out.store}.` : `${out.name} isn't in your Pipeline yet.`),
      out.hint ? views.text(out.hint) : null,
    );
  },
};
