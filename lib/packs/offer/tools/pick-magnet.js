// Freebie ideas that are real things a buyer can use today: a checklist, a calculator, a template,
// or a claim card. Each one shows a problem the member solves.

const { views, brain } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const magnets = require('../lib/magnets');

module.exports = {
  name: 'offer.pick_magnet',
  title: 'Freebie ideas',
  description: 'Suggests 4 freebies built for this business (checklist, calculator, template, claim card), ranked, each with what it is and why it fits your buyers.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { what: { type: 'string', maxLength: 200 }, who: { type: 'string', maxLength: 200 } } },
  output: { type: 'object', properties: { ideas: { type: 'array' } }, required: ['ideas'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const ideas = magnets.ideas(f);
    ctx.log(`${ideas.length} freebie ideas`);
    return { ideas };
  },
  view(out) {
    return [views.table([{ key: 'title', label: 'Freebie' }, { key: 'type', label: 'What it does' }, { key: 'files', label: 'You get' }], out.ideas)];
  },
};
