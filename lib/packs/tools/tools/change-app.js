// Changes an app the member already has. They upload the app (the .html file or the ZIP it came
// in) and say what to change. The AI rewrites the file and the safety check reads it; if it
// doesn't pass, simple changes (prices, title, color, tax, contact) are made without AI, and
// otherwise their app comes back unchanged with the reason.

const { ai, text } = require('../../_kit');
const { readApp, titleOf, configOf } = require('../lib/app-file');
const { validate, harden, summary } = require('../lib/validate');
const { applyEdits } = require('../lib/edit');
const { RULES, SCHEMA } = require('../lib/prompt');
const { deliver, appView, APP_OUTPUT } = require('../lib/deliver');

const AI_MAX = 200 * 1024;
const SEND_MAX = 120 * 1024;

module.exports = {
  name: 'tools.change_app',
  title: 'Change your app',
  description: 'Takes an app you already have (the .html file or its ZIP) and the change you want, rewrites it, runs the safety check, and saves the new version. Simple changes like prices, the title, the color or tax work even with AI off.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 50,
  timeoutSec: 300,
  input: {
    type: 'object',
    properties: {
      app: { type: 'string', format: 'asset', title: 'Your app (.html or .zip)' },
      change: { type: 'string', title: 'What to change', maxLength: 2000 },
    },
    required: ['app', 'change'],
  },
  output: APP_OUTPUT,
  async run(input, ctx) {
    const file = await readApp(ctx, input.app);
    const before = validate(harden(file.html), { maxBytes: 2 * 1024 * 1024 });
    const cfg = configOf(file.html);
    const business = (cfg && cfg.business) || '';
    const title = titleOf(file.html);
    const notes = [];
    if (!before.ok) notes.push(`Your file had problems before the change: it ${before.problems.slice(0, 3).map((p) => p.text).join('; ')}. The new version has to pass every check.`);
    let raw = null;
    let check = null;
    let usedAi = false;
    if (Buffer.byteLength(file.html) <= SEND_MAX) {
      const res = await ai.aiJson(ctx, {
        task: 'write',
        system: `You change small single-file web apps for small business owners. Keep everything the owner didn't ask to change, including saved-data keys, so their saved data still loads. Rules for the result:\n${RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
        prompt: `The change:\n${text.clip(input.change, 2000)}\n\nThe current file:\n${file.html}\n\nReturn JSON: title, html (the whole new file) and changes (one or two plain sentences on what you changed).`,
        schema: SCHEMA,
        maxTokens: 16000,
        accept: (d) => {
          check = validate(harden(d.html), { maxBytes: AI_MAX });
          if (check.ok) raw = d;
          return check.ok;
        },
        fallback: () => ({ title: '', html: '' }),
      });
      usedAi = res.ai && !!raw;
    } else notes.push('The file is too big to send to AI, so only simple changes can be made here.');
    if (usedAi) {
      notes.unshift(text.clip(raw.changes || 'Made the change you asked for.', 300), summary(check));
      return deliver(ctx, raw.html, { business, title: text.clip(raw.title || title, 60), starter: (cfg && cfg.starter) || 'custom', notes, ai: true, maxBytes: AI_MAX });
    }
    if (check && !check.ok) notes.unshift(`The AI version didn't pass the safety check (it ${check.problems.slice(0, 3).map((p) => p.text).join('; ')}).`);
    const edited = applyEdits(file.html, input.change);
    if (edited && edited.changed.length) {
      notes.unshift(`Changed: ${edited.changed.join('. ')}.`);
      return deliver(ctx, edited.html, { business: edited.business, title: edited.title, starter: edited.starter, notes });
    }
    notes.unshift(edited ? 'That change needs AI. Without it, this app can change prices, the title, the business name, the color, tax, deposit, phone and email. Here is your app as it was.' : "That change needs AI, and this app wasn't made here, so it can't be rebuilt without it. Here is your app as it was, checked.");
    if (!before.ok) throw new Error(`Your app didn't pass the safety check, and the change couldn't be made. ${summary(before)}`);
    return deliver(ctx, file.html, { business, title, starter: (cfg && cfg.starter) || 'custom', notes, sample: true, maxBytes: 2 * 1024 * 1024 });
  },
  view: (out) => appView(out, 'Your changed app'),
};
