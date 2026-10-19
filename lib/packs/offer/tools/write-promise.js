// A promise the member can keep: a redo, on time, or a refund of their own fee. Never a result
// they don't control. With the terms in plain words, what it could cost, and what to say.

const { text, ai, views, save } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const promise = require('../lib/promise');
const docs = require('../lib/docs');

module.exports = {
  name: 'offer.write_promise',
  title: 'Write my promise',
  description: 'Writes a promise about what the member controls (redo, refund, on time, keep working), with plain terms, what keeping it could cost and what to say when someone claims it.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 4,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', maxLength: 200 },
      type: { type: 'string', title: 'Kind of promise', enum: ['redo', 'refund', 'keep_working', 'first_free', 'on_time', 'remake'] },
      window: { type: 'number', title: 'How long it lasts (hours or days)', minimum: 1, maximum: 365 },
      price: { type: 'number', minimum: 0 },
      cost: { type: 'number', minimum: 0 },
      hours: { type: 'number', minimum: 0 },
    },
  },
  output: { type: 'object', properties: { promise: { type: 'object' }, file: { type: 'object' }, ai: { type: 'boolean' } }, required: ['promise'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const p = promise.build(f, { type: input.type, window: input.window });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write one short line a small business says to explain its promise. Only what the seller controls. Same terms.',
      prompt: `Say this in one friendly sentence, same terms: ${p.long}`,
      schema: { type: 'object', properties: { sayIt: { type: 'string', maxLength: 240 } }, required: ['sayIt'] },
      fallback: () => ({ sayIt: p.sayIt }),
      accept: (d) => ai.cleanCopy(d) && !promise.problems(d.sayIt).length,
    });
    p.sayIt = text.plain(data.sayIt || p.sayIt);
    const file = await save.saveFile(ctx, save.fileName(f.business || f.whatShort, 'promise', '.html'), docs.promiseCardHtml(p, f));
    ctx.log(`Wrote ${p.name}`);
    return { promise: p, file, ai: usedAi };
  },
  view(out) {
    const p = out.promise;
    return views.blocks(
      views.metric('Your promise', p.name, p.short),
      views.copy('Say it like this', p.sayIt),
      views.copy('For your bio', p.bio),
      views.table([{ key: 'k', label: '' }, { key: 'v', label: '' }], [{ k: 'Covers', v: p.terms.covers }, { k: 'How to claim', v: p.terms.claim }, { k: 'What you do', v: p.terms.you }, { k: 'Not covered', v: p.terms.notCovered.join('. ') }]),
      p.cost.known ? views.table([{ key: 'rate', label: 'If this many jobs claim it' }, { key: 'cost', label: 'It costs you per job' }], p.cost.rows.map((r) => ({ rate: r.rate, cost: docs.usd(r.perJob) }))) : null,
      views.copy('When someone claims it', p.claimScript),
      views.file(out.file, 'Promise card (print or share)'),
    );
  },
};
