// The gallery of ready-made apps, each described with the member's own business in it, to pick from.

const { views, text } = require('../../_kit');
const { GALLERY } = require('../lib/starters');
const { factsOf } = require('../lib/facts');
const { FACT_FIELDS } = require('../lib/deliver');

module.exports = {
  name: 'tools.list_starters',
  title: 'Ready-made apps',
  description: 'Lists the ready-made apps (job price calculator, quote calculator, booking request page, intake checklist, stock counter, tip splitter, client portal page, mileage log, simple form), each described for your business.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { ...FACT_FIELDS } },
  output: {
    type: 'object',
    properties: { starters: { type: 'array', items: { type: 'object' } }, business: { type: 'string' }, prices: { type: 'string' } },
    required: ['starters', 'business', 'prices'],
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const names = f.items.slice(0, 3).map((x) => x.name);
    const starters = GALLERY.map((s) => ({
      id: s.id,
      name: s.title,
      blurb: s.blurb,
      filled: ['job-price', 'quote', 'booking'].includes(s.id) && names.length ? `With ${text.list(names)}${f.items.length > 3 ? ' and more' : ''}${f.sampleItems ? ' (example prices)' : ''}.` : `For ${f.business}.`,
    }));
    ctx.log(`${starters.length} ready-made apps for ${f.business}`);
    return { starters, business: f.business, prices: f.sampleItems ? 'examples' : 'yours' };
  },
  view(out) {
    return views.blocks(
      views.text(`${out.starters.length} ready-made apps for ${out.business}. Each is one file that works offline on any phone.`),
      views.cards(out.starters.map((s) => ({ title: s.name, subtitle: s.filled, body: s.blurb })))
    );
  },
};
