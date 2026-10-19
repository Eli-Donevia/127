// Ranks the designs by fit for this business (from its niche, services, menu, area and links),
// with a plain reason for each. Code only.

const { views } = require('../../_kit');
const { factsFrom } = require('../lib/facts');
const { rankTemplates } = require('../lib/pick');

module.exports = {
  name: 'site.pick_template',
  title: 'Pick a design',
  description: 'Ranks the one-page website designs by how well each fits your business, with a plain reason for each.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      facts: { type: 'object', title: 'Your business facts' },
      prefer: { type: 'string', title: 'Design you want (optional)', description: 'local-service, studio, restaurant or coach' },
    },
  },
  output: {
    type: 'object',
    properties: { business: { type: 'string' }, designs: { type: 'array' }, best: { type: 'object' } },
    required: ['designs', 'best'],
  },
  async run(input, ctx) {
    const facts = input.facts || {};
    const f = factsFrom(ctx, facts);
    const designs = rankTemplates(f, { prefer: input.prefer || facts.design || facts.template }).map((d) => ({ id: d.id, name: d.name, why: d.why, bestFor: d.bestFor }));
    ctx.log(`Best fit for ${f.name}: ${designs[0].name}`);
    return { business: f.name, designs, best: designs[0] };
  },
  view(out) {
    return views.blocks(
      views.metric('Best fit', out.best.name, out.best.why),
      views.cards(out.designs.map((d, i) => ({ title: d.name, subtitle: d.bestFor, body: d.why, badge: i === 0 ? 'Best fit' : '' })))
    );
  },
};
