// Checks any single-file app (one this pack made, or one from somewhere else) against the same
// safety rules: no outside files, nothing sent anywhere, no code built from strings, a size cap.
// When it passes, saves a copy with the policy that blocks outside requests added.

const { views, text } = require('../../_kit');
const { readApp, titleOf, configOf } = require('../lib/app-file');
const { validate, harden, summary } = require('../lib/validate');
const { deliver } = require('../lib/deliver');

module.exports = {
  name: 'tools.check_app',
  title: 'Check an app',
  description: 'Reads a single-file HTML app line by line and says whether it loads outside files, sends data anywhere, runs code built from text or is too big. When it passes, saves a locked-down copy ready to use or put online.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { app: { type: 'string', format: 'asset', title: 'The app (.html or .zip)' } }, required: ['app'] },
  output: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      title: { type: 'string' },
      kb: { type: 'number' },
      problems: { type: 'array', items: { type: 'object' } },
      summary: { type: 'string' },
      app: { type: ['object', 'null'] },
      zip: { type: ['object', 'null'] },
      preview: { type: ['object', 'null'] },
    },
    required: ['ok', 'title', 'kb', 'problems', 'summary'],
  },
  async run(input, ctx) {
    const file = await readApp(ctx, input.app);
    const v = validate(harden(file.html));
    const title = titleOf(file.html);
    const out = { ok: v.ok, title, kb: Math.max(1, Math.round(v.bytes / 1024)), problems: v.problems.map((p) => ({ check: p.code, problem: text.clip(`It ${p.text}.`, 200) })), summary: summary(v) };
    ctx.log(`${title}: ${v.ok ? 'passed' : `${v.problems.length} problems`}`);
    if (v.ok) {
      const cfg = configOf(file.html);
      const d = await deliver(ctx, file.html, { business: (cfg && cfg.business) || '', title, starter: (cfg && cfg.starter) || 'custom' });
      Object.assign(out, { app: d.app, zip: d.zip, preview: d.preview });
    }
    return out;
  },
  view(out) {
    return views.blocks(
      views.metric('Safety check', out.ok ? 'Passed' : `${out.problems.length} to fix`, `${out.title}, ${out.kb} KB`),
      views.text(out.summary),
      out.problems.length ? views.table([{ key: 'check', label: 'Check' }, { key: 'problem', label: 'What it does' }], out.problems) : null,
      out.ok ? views.file(out.zip, 'Locked-down copy (ZIP with index.html, ready for Netlify Drop)') : views.text('Fix these in the file, or describe the app in "Build a tool" and get a version that passes.'),
      out.ok ? views.file(out.preview, 'Preview') : null
    );
  },
};
