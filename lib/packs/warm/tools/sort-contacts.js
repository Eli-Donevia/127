// Sorts each person into could buy, could refer or could advise, using only what the member wrote
// about them, and ranks who to message first.

const { views } = require('../../_kit');
const C = require('../lib/contacts');
const { offerFacts } = require('../lib/facts');

module.exports = {
  name: 'warm.sort_contacts',
  title: 'Sort my people',
  description: 'Sorts people into could buy, could refer or could advise from the notes the member wrote, with the reason, and ranks who to message first.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { people: { type: 'array' }, what: { type: 'string', maxLength: 200 } }, required: ['people'] },
  output: { type: 'object', properties: { people: { type: 'array' }, counts: { type: 'object' }, total: { type: 'number' } }, required: ['people'] },
  async run(input, ctx) {
    const o = offerFacts(ctx, input);
    const sorted = (input.people || []).map((p) => ({ ...p, phones: p.phones || [], emails: p.emails || [], notes: p.notes || [], labels: p.labels || [], ...C.sortPerson({ notes: [], labels: [], phones: [], emails: [], ...p }, o.words) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const counts = { buy: 0, refer: 0, advise: 0 };
    sorted.forEach((p) => { counts[p.group] += 1; });
    const people = sorted.slice(0, 200).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      first: p.first,
      phone: p.phones[0] || '',
      email: p.emails[0] || '',
      group: p.group,
      groupLabel: C.GROUPS[p.group],
      why: p.why,
      note: p.note,
      label: `${p.name} (${C.GROUPS[p.group]})`,
      detail: p.why,
    }));
    ctx.log(`Sorted ${sorted.length}: ${counts.buy} could buy, ${counts.refer} could refer, ${counts.advise} could advise`);
    return { people, counts, total: sorted.length };
  },
  view(out) {
    return views.blocks(
      views.metric('Could buy', out.counts.buy),
      views.metric('Could refer', out.counts.refer),
      views.metric('Could advise', out.counts.advise),
      views.table([{ key: 'rank', label: '#' }, { key: 'name', label: 'Name' }, { key: 'groupLabel', label: 'Group' }, { key: 'why', label: 'Why' }], out.people, 25),
    );
  },
};
