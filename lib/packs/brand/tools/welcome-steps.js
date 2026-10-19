// The first half of a welcome kit: how a first job runs (from the member's own lines, or starting
// points for their kind of business) and how customers get ready. The member keeps the steps that
// match how they work in the next step.

const { views, text } = require('../../_kit');
const { specFrom } = require('../lib/kit');
const W = require('../lib/welcome');

module.exports = {
  name: 'brand.welcome_steps',
  title: 'Draft your welcome steps',
  description: 'Lays out how a first job with you runs, from your own steps or starting points for your kind of business, plus how customers get ready, so you can keep the ones that match how you work.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      steps: { type: 'string', format: 'textarea', title: 'How it works (optional)', description: 'One step per line, like "Walkthrough: we look at the car with you first"', maxLength: 2000 },
      prepare: { type: 'string', format: 'textarea', title: 'How customers get ready (optional)', description: 'One tip per line', maxLength: 1200 },
    },
  },
  output: {
    type: 'object',
    properties: {
      steps: { type: 'array' },
      prep: { type: 'array' },
      group: { type: 'string' },
      stepsFrom: { type: 'string' },
      prepFrom: { type: 'string' },
      label: { type: 'string' },
    },
    required: ['steps', 'prep'],
  },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    const d = W.draft(spec.niche.id, input);
    const label = spec.known ? spec.descriptor.toLowerCase() : '';
    ctx.log(`${text.plural(d.steps.length, 'step')} (${d.stepsFrom === 'yours' ? 'yours' : `starting points${label ? ` for ${label}` : ''}`}), ${text.plural(d.prep.length, 'tip')}.`);
    return { ...d, label };
  },
  view(out) {
    return views.blocks(
      views.text(out.stepsFrom === 'yours' ? 'Your steps, ready to check.' : `Starting points for a typical ${out.label ? `${out.label} ` : ''}job. Keep the ones that match how you work, or type your own steps and run it again.`),
      views.cards(out.steps.map((s) => ({ title: `${s.n}. ${s.title}`, body: s.detail }))),
      views.cards([{ title: 'How customers get ready', body: out.prep.join(' ') }])
    );
  },
};
