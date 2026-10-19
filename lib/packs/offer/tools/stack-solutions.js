// Keeps the fixes worth a lot to the buyer and cheap for the member, cuts the rest, and ranks them.

const { views } = require('../../_kit');
const { trimAndStack } = require('../lib/stack');

module.exports = {
  name: 'offer.stack_solutions',
  title: 'Keep the best parts',
  description: 'Ranks each fix by how much it is worth to the buyer against what it costs the member, and says keep or cut with the reason.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { problems: { type: 'array' }, drivers: { type: 'object' } }, required: ['problems'] },
  output: { type: 'object', properties: { items: { type: 'array' }, kept: { type: 'number' } }, required: ['items'] },
  async run(input, ctx) {
    const all = trimAndStack(input.problems || [], input.drivers || {});
    const items = [...all.filter((x) => x.keep), ...all.filter((x) => !x.keep)].slice(0, 200);
    ctx.log(`Kept ${all.filter((x) => x.keep).length} of ${all.length}`);
    return { items, kept: all.filter((x) => x.keep).length };
  },
  view(out) {
    return [views.table([{ key: 'rank', label: '#' }, { key: 'label', label: 'Part' }, { key: 'verdict', label: 'Keep?' }, { key: 'reason', label: 'Why' }], out.items, 20)];
  },
};
