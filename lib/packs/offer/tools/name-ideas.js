// Names for the offer (not the business): the result, who it is for, how often, and what it comes
// in, plus a reason to buy now when one is real (a season, a founding round).

const { text, ai, views } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const { templateNames, nameProblems } = require('../lib/names');

module.exports = {
  name: 'offer.name_ideas',
  title: 'Offer name ideas',
  description: 'Writes 8 names for the offer from the result, who it is for, how often and what it comes in, each with why it works.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      who: { type: 'string', title: 'Who it is for (optional)', maxLength: 200 },
      outcome: { type: 'string', title: 'The result they want (optional)', maxLength: 200 },
      keywords: { type: 'string', title: 'Words you like (optional)', maxLength: 120 },
      count: { type: 'integer', minimum: 3, maximum: 12, default: 8 },
    },
  },
  output: { type: 'object', properties: { names: { type: 'array' }, ai: { type: 'boolean' } }, required: ['names'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const count = input.count || 8;
    const base = templateNames(f, { today: f.today, count, keywords: input.keywords || '' });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You name small business offers. Plain words, 2 to 6 words, no results the seller cannot control, no hype.',
      prompt: `Offer: ${f.what} for ${f.who}. Result: ${f.outcome}. Write ${count} names that say the result, who it is for, how often or what it comes in. For each: name and why (one sentence).`,
      schema: { type: 'object', properties: { names: { type: 'array', items: { type: 'object', properties: { name: { type: 'string', maxLength: 60 }, why: { type: 'string', maxLength: 140 } }, required: ['name', 'why'] } } }, required: ['names'] },
      fallback: () => ({ names: base }),
      accept: (d) => ai.cleanCopy(d) && (d.names || []).every((n) => !nameProblems(n.name).length),
    });
    const names = (data.names || base).slice(0, count).map((n) => ({ name: text.oneLine(n.name), why: text.oneLine(n.why), label: text.oneLine(n.name), detail: text.oneLine(n.why) }));
    ctx.log(`Wrote ${names.length} offer names`);
    return { names, ai: usedAi };
  },
  view(out) {
    return [views.table([{ key: 'name', label: 'Name' }, { key: 'why', label: 'Why it works' }], out.names, 12)];
  },
};
