// One hook variant of a video: the same video with a different opening (a hook title on the first
// seconds and a first caption line under it), so the member can post a few and keep the one that holds.

const { media, text, views } = require('../../_kit');
const E = require('../lib/edit');
const C = require('../lib/edit-captions');
const T = require('../lib/edit-tools');

module.exports = {
  name: 'studio.hook_variant',
  title: 'Make a hook variant',
  description: 'Makes one version of your video with a different opening: the hook title on the first seconds and a first caption line under it. Run it for each hook you want to test.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  lane: 'render',
  credits: 5,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      video: T.VIDEO,
      chain: T.CHAIN,
      hook: { type: ['object', 'string'], title: 'The hook', description: 'One hook from Write hook lines ({ text, line }), or just the title.' },
      style: { type: 'string', title: 'Look', enum: C.HOOK_STYLES, default: 'box' },
      seconds: { type: 'number', title: 'Seconds on screen', minimum: 1, maximum: 8, default: 3 },
      color: T.COLOR,
      labels: T.LABELS,
    },
    required: ['hook'],
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, n: { type: 'integer' }, hook: { type: 'string' }, line: { type: 'string' } } },
  async run(input, ctx) {
    const h = typeof input.hook === 'string' ? { text: input.hook } : input.hook || {};
    const title = text.clip(text.oneLine(h.text || h.title || ''), 90);
    const line = text.clip(text.oneLine(h.line || ''), 100);
    if (!title) throw new Error('This hook has no words. Pick a hook with a title.');
    const n = Number(h.n) || (ctx.index != null ? ctx.index + 1 : 1);
    if (!media.canRender(ctx)) return T.offOutput({ n, hook: title, line });
    const src = await T.sourceVideo(ctx, input);
    const brand = T.brandOf(ctx, input);
    const r = await E.hookTitle(ctx, src.path, { text: title, line, seconds: input.seconds || 3, style: input.style, look: brand.look, sample: src.sample, labels: T.labelsOf(input) });
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, `hook-${n}-${text.clip(title, 30)}`, src.sample), sample: src.sample, at: 1.2, ai: src.ai || T.anyLabel(T.labelsOf(input)) });
    ctx.log(`Hook ${n}: ${title}`);
    return { ...saved, n, hook: title, line, labels: r.labels };
  },
  view(out) {
    return T.videoView(out, { caption: `Hook ${out.n}: ${out.hook}` });
  },
  viewMany(outs) {
    const ok = outs.filter((o) => o && o.video);
    if (!ok.length) return [views.text((outs.find((o) => o && o.note) || {}).note || 'Nothing was rendered.')];
    return views.blocks(
      views.metric('Hook variants', ok.length, 'Post one a day and keep the one people watch longest'),
      views.table([{ key: 'n', label: '#', format: 'number' }, { key: 'hook', label: 'Hook title' }, { key: 'line', label: 'First line' }], ok.map((o) => ({ n: o.n, hook: o.hook, line: o.line }))),
      ok.map((o) => views.video(o.video, `Hook ${o.n}: ${o.hook}`)),
      T.aiLines(ok[0]).map((l) => views.text(l)),
      ok.some((o) => o.sample) ? views.text('These use the sample clip. Add your own video to test your hooks.') : null,
    );
  },
};
