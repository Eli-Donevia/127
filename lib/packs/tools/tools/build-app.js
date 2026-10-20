// Builds the app the member described. The AI writes one HTML file; the safety check reads every
// line of it (no outside files, nothing sent, no code from strings, size cap). If it doesn't pass,
// or AI is off, the member gets the closest ready-made app filled with their facts instead.

const { ai, text } = require('../../_kit');
const S = require('../lib/starters');
const { factsOf } = require('../lib/facts');
const { starterOptions } = require('../lib/options');
const { validate, harden, summary } = require('../lib/validate');
const { RULES, businessBlock, SCHEMA } = require('../lib/prompt');
const { deliver, appView, FACT_FIELDS, APP_OUTPUT } = require('../lib/deliver');

const AI_MAX = 200 * 1024;

module.exports = {
  name: 'tools.build_app',
  title: 'Build your app',
  description: 'Writes the app you described as one HTML file that works offline, checks it line by line for safety, and saves it zipped with a preview. If the check fails it gives you the closest ready-made app with your details instead.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 50,
  timeoutSec: 300,
  input: {
    type: 'object',
    properties: {
      description: { type: 'string', title: 'What should the app do?', maxLength: 3000 },
      plan: { type: ['object', 'null'], title: 'The plan step' },
      ...FACT_FIELDS,
    },
    required: ['description'],
  },
  output: APP_OUTPUT,
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const plan = input.plan && typeof input.plan === 'object' ? input.plan : { starter: S.nearest(input.description), title: '', questions: [] };
    const starter = S.byId(plan.starter) ? plan.starter : S.nearest(input.description);
    let raw = null;
    let check = null;
    const { ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: `You build small single-file web apps for small business owners. Rules:\n${RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
      prompt: [
        `Build this app:\n${text.clip(input.description, 3000)}`,
        plan.title ? `Name: ${plan.title}` : '',
        plan.questions && plan.questions.length ? `Fields, steps or items the owner listed:\n${plan.questions.map((q) => `- ${q}`).join('\n')}` : '',
        businessBlock(f),
        'Return JSON: title (2 to 5 words) and html (the whole file).',
      ].filter(Boolean).join('\n\n'),
      schema: SCHEMA,
      maxTokens: 16000,
      // The check runs on the model's own text, before anything reformats it.
      accept: (d) => {
        check = validate(harden(d.html), { maxBytes: AI_MAX });
        if (check.ok) raw = d;
        return check.ok;
      },
      fallback: () => ({ title: '', html: '' }),
    });
    if (usedAi && raw) {
      const title = text.clip(raw.title || plan.title || 'Your app', 60);
      return deliver(ctx, raw.html, { business: f.business, title, starter: 'custom', notes: [`Built from your description. ${summary(check)}`], ai: true, maxBytes: AI_MAX });
    }
    const why = check && !check.ok ? `The AI version didn't pass the safety check (it ${check.problems.slice(0, 3).map((p) => p.text).join('; ')}), so this is the closest ready-made app with your details.` : `This is the closest ready-made app (${(S.byId(starter) || {}).title}) filled with your details. With AI on, the app is written from your description.`;
    ctx.log(why);
    const opts = starterOptions(starter, { title: plan.title, questions: (plan.questions || []).join('\n') });
    const r = S.render(starter, f, opts);
    return deliver(ctx, r.html, { business: f.business, title: r.title, starter, notes: [why, r.note], ai: false, sample: true });
  },
  view: (out) => appView(out),
};
