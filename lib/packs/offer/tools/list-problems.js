// Every problem a buyer has before, during and after buying, each turned into a fix the member
// can deliver. Starts from a library written per business type; AI adds up to 3 for this buyer.

const { text, ai, views } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const { problemsFor } = require('../lib/library');
const value = require('../lib/value');

module.exports = {
  name: 'offer.list_problems',
  title: 'List buyer problems',
  description: 'Lists what stops a buyer saying yes, before, during and after they buy, each with a fix the member can deliver.',
  kind: 'ai',
  risk: 'read',
  needs: [],
  tasks: ['plan'],
  credits: 4,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      who: { type: 'string', title: 'Who buys it (optional)', maxLength: 200 },
      outcome: { type: 'string', title: 'The result they want (optional)', maxLength: 200 },
      price: { type: 'number', title: 'Your price (optional)', minimum: 0 },
    },
  },
  output: { type: 'object', properties: { problems: { type: 'array' }, drivers: { type: 'object' }, ai: { type: 'boolean' } }, required: ['problems'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const base = problemsFor(f);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'plan',
      system: 'You list what stops a buyer from saying yes to a small business, and a fix the seller controls. No results the seller cannot control.',
      prompt: `Business: ${f.what}. Buyer: ${f.who}. They want: ${f.outcome}. Already listed: ${base.map((p) => p.problem).join(' | ')}. Add up to 3 new ones in the buyer's words, each with a fix the seller delivers and a 2 to 3 word part name.`,
      schema: { type: 'object', properties: { extra: { type: 'array', items: { type: 'object', properties: { problem: { type: 'string', maxLength: 120 }, fix: { type: 'string', maxLength: 160 }, part: { type: 'string', maxLength: 40 } }, required: ['problem', 'fix', 'part'] } } }, required: ['extra'] },
      fallback: () => ({ extra: [] }),
      accept: ai.cleanCopy,
    });
    const extra = (data.extra || []).slice(0, 3).map((x, i) => ({ id: `ai_${i}`, stage: 'during', stageLabel: 'While they decide', driver: 'likelihood', problem: text.plain(x.problem), fix: text.plain(x.fix), vehicle: text.plain(x.part), part: text.plain(x.part), value: 3, cost: 2 }));
    const problems = [...base, ...extra];
    const drivers = value.rubric([f.what, f.city].join('. ')).drivers;
    ctx.log(`Listed ${problems.length} buyer problems`);
    return { problems, drivers, ai: usedAi };
  },
  view(out) {
    return [views.table([{ key: 'stageLabel', label: 'When' }, { key: 'problem', label: 'What they worry about' }, { key: 'fix', label: 'What you do about it' }], out.problems, 20)];
  },
};
