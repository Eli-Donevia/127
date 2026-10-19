// sales.call_script: a sales call script for the member's own offer and prices, six plain steps with
// branches, plus the ten things buyers say and the answer to each. AI tailors the opening and the
// questions to one prospect's notes when it's on; the template uses the member's real facts.

const { text, views, save, ai } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const options = require('../lib/options');
const script = require('../lib/script');
const { ASSET } = require('../lib/money-run');

module.exports = {
  name: 'sales.call_script',
  title: 'Write a call script',
  description: 'Writes your sales call script in six plain steps (what to say, what to ask, what to do if they answer one way or another) around your real offer and prices, with the ten things buyers say and your answer to each.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 80, title: 'Who the call is with (optional)' },
      company: { type: 'string', maxLength: 80, title: 'Their business (optional)' },
      notes: { type: 'string', maxLength: 3000, title: 'What you know about them (optional)' },
      optionsText: { type: 'string', maxLength: 3000, title: 'Your options, one per line (optional)', description: 'Like "Complete, 360, full detail; clay and wax". Empty builds three from your price.' },
      price: { type: 'number', title: 'Your usual price (optional)' },
      deposit: { type: ['number', 'string'], title: 'Deposit to book (optional)' },
      promise: { type: 'string', maxLength: 300, title: 'Your promise (optional)', description: 'What you promise every client, in your words. Left empty, your saved promise' },
      prospect: { type: 'object', title: 'Facts from sales.read_prospect' },
    },
  },
  output: {
    type: 'object',
    required: ['steps', 'objections', 'files'],
    properties: {
      steps: { type: 'array', items: { type: 'object', properties: { n: { type: 'number' }, name: { type: 'string' }, goal: { type: 'string' }, say: { type: 'array', items: { type: 'string' } }, ask: { type: 'array', items: { type: 'string' } }, listen: { type: 'string' }, branches: { type: 'array', items: { type: 'object', properties: { if: { type: 'string' }, then: { type: 'string' } } } }, avoid: { type: 'string' } } } },
      objections: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' }, says: { type: 'string' }, means: { type: 'string' }, answer: { type: 'string' }, ask: { type: 'string' }, avoid: { type: 'string' } } } },
      options: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, price: { type: 'number' }, per: { type: 'string' }, priceText: { type: 'string' } } } },
      files: { type: 'object', properties: { html: ASSET, text: ASSET } },
      warnings: { type: 'array', items: { type: 'string' } },
      ai: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const p = input.prospect && typeof input.prospect === 'object' ? input.prospect : {};
    const notes = [input.notes, ...(Array.isArray(p.notes) ? p.notes : []), ...(Array.isArray(p.relevant) ? p.relevant.map((g) => g.label) : [])].filter(Boolean).join('\n');
    const { options: opts, built } = options.threeOptions({ typed: input.optionsText, price: f.price, profile: f.profile, currency: f.currency });
    const prospect = { name: input.name || p.name || '', company: input.company || '' };
    const s = script.build({ f, opts, prospect, notes });
    const warnings = [];
    if (!opts.length) warnings.push('Add your price (or your options) so the script can say your real numbers.');
    else if (built) warnings.push(`Options built from your price of ${f.priceText}: ${opts.map((o) => `${o.name} ${o.priceText}`).join(', ')}. Change them if they don't fit.`);
    if (!f.promise && f.promiseIdea) warnings.push(`The script makes no promise, because you haven't made one. One that could fit your kind of work: "${f.promiseIdea}" Type it in "Your promise" only if you'll keep it.`);
    let usedAi = false;
    if (notes) {
      const res = await ai.aiJson(ctx, {
        task: 'write',
        system: 'You tailor a sales call script for a small business owner. Use only the facts given. Plain spoken sentences, no hype, no promises of results.',
        prompt: `The member sells: ${f.what || f.offer || 'their service'}.\nWhat they know about the prospect:\n${notes}\n\nWrite "opening" (one or two sentences to open the call, warm, mentions one fact from the notes) and "questions" (three short questions about this prospect's problem, using the notes).`,
        schema: { type: 'object', required: ['opening', 'questions'], properties: { opening: { type: 'string', maxLength: 300 }, questions: { type: 'array', items: { type: 'string', maxLength: 160 }, minItems: 3, maxItems: 3 } } },
        maxTokens: 500,
        accept: ai.cleanCopy,
        fallback: () => null,
      }).catch(() => ({ data: null }));
      if (res && res.data) {
        s.steps[0].say = [res.data.opening];
        s.steps[1].ask = res.data.questions;
        usedAi = !!res.ai;
      }
    }
    const who = prospect.company || prospect.name || f.name || 'sales';
    const files = {
      html: await save.saveFile(ctx, save.fileName('call script', who, '.html'), script.html({ f, s, opts, prospect }), 'text/html'),
      text: await save.saveFile(ctx, save.fileName('call script', who, '.txt'), script.plainText({ f, s, opts, prospect }), 'text/plain'),
    };
    return { steps: s.steps, objections: s.objections, options: opts.map((o) => ({ name: o.name, price: o.price, per: o.per, priceText: o.priceText })), files, warnings, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.text(`Your call script: ${out.steps.map((s) => s.name).join(', then ')}.`),
      (out.warnings || []).map((w) => views.text(w)),
      views.file(out.files.html, 'Call sheet to keep open on the call (prints on paper too)'),
      views.cards(out.steps.map((s) => ({ title: `${s.n}. ${s.name}`, subtitle: s.goal, body: `${s.say[0]}\nAsk: ${s.ask[0]}` }))),
      views.table(
        [
          { key: 'says', label: 'They say' },
          { key: 'answer', label: 'You say' },
        ],
        out.objections
      ),
      views.copy('The whole script as text', out.steps.map((s) => `${s.n}. ${s.name}\n${s.say.join('\n')}\nAsk: ${s.ask.join(' ')}`).join('\n\n')),
      views.file(out.files.text, 'Script as plain text')
    );
  },
};
