// What each customer can buy, in order: get them in, the main offer, add more, if they say no, keep
// them. Prices from the member's own price and costs, with the words to say at each step.

const { text, ai, views, save } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const ladder = require('../lib/ladder');
const docs = require('../lib/docs');

module.exports = {
  name: 'offer.plan_money',
  title: 'Plan what customers buy',
  description: 'Plans 5 offers in the order a customer meets them, priced from the member costs, with when to offer each and the words to say.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      price: { type: 'number', title: 'Your main price', minimum: 0 },
      cost: { type: 'number', title: 'Supplies per job (optional)', minimum: 0 },
      hours: { type: 'number', title: 'Hours per job (optional)', minimum: 0 },
      payWith: { type: 'string', title: 'How people pay you', enum: ['square_in_person', 'square_online', 'stripe_online', 'paypal_checkout', 'venmo_business', 'cash'] },
    },
  },
  output: { type: 'object', properties: { steps: { type: 'array' }, thirty: { type: 'object' }, files: { type: 'array' }, ai: { type: 'boolean' } }, required: ['steps'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const ld = ladder.build(f, { payWith: input.payWith });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short, friendly sales lines a small business owner says out loud. Keep every price exactly. No pressure, no fake urgency.',
      prompt: `Make each line sound natural, same prices:\n${ld.steps.map((s) => `${s.key}: ${s.script}`).join('\n')}`,
      schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, script: { type: 'string', maxLength: 400 } }, required: ['key', 'script'] } } }, required: ['items'] },
      fallback: () => ({ items: ld.steps.map((s) => ({ key: s.key, script: s.script })) }),
      accept: ai.cleanCopy,
    });
    const said = Object.fromEntries((data.items || []).map((x) => [x.key, x.script]));
    ld.steps = ld.steps.map((s) => ({ ...s, script: text.plain(said[s.key] || s.script) }));
    const name = f.business || f.whatShort;
    const files = [
      await save.saveFile(ctx, save.fileName(name, 'money model', '.html'), docs.ladderHtml(ld, f)),
      await save.saveFile(ctx, save.fileName(name, 'money model math', '.csv'), docs.ladderCsv(ld)),
    ];
    ctx.log(`Planned ${ld.steps.length} steps`);
    return { steps: ld.steps.map((s) => ({ key: s.key, step: s.step, title: s.title, priceText: s.priceText, when: s.when, script: s.script })), thirty: ld.thirty, files, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'step', label: 'Step' }, { key: 'title', label: 'Offer' }, { key: 'priceText', label: 'Price' }], out.steps),
      views.metric('You keep from one customer in 30 days', docs.usd(out.thirty.kept), 'Main offer, the add-on and one month of the plan, after supplies and card fees'),
      out.steps.map((s) => views.copy(`${s.step}: what to say`, s.script)),
      out.files.map((x) => views.file(x)),
    );
  },
};
