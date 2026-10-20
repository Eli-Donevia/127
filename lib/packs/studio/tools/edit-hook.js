// A hook title over the first seconds: the line that makes someone stop scrolling, in a box in your
// color (or a white card, or big outlined words), near the top inside the app's safe zone.

const { media, text } = require('../../_kit');
const E = require('../lib/edit');
const C = require('../lib/edit-captions');
const T = require('../lib/edit-tools');

module.exports = {
  name: 'studio.edit_hook',
  title: 'Add a hook title',
  description: 'Puts your hook line on the first seconds of the video, near the top and clear of the app buttons, in a box in your brand color, a white card or big outlined words. It rises in and fades out.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  lane: 'render',
  credits: 4,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      video: T.VIDEO,
      chain: T.CHAIN,
      text: { type: 'string', title: 'Hook title', maxLength: 90 },
      style: { type: 'string', title: 'Look', enum: C.HOOK_STYLES, default: 'box' },
      seconds: { type: 'number', title: 'Seconds on screen', minimum: 1, maximum: 8, default: 3 },
      color: T.COLOR,
      labels: T.LABELS,
    },
    required: ['text'],
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, title: { type: 'string' } } },
  async run(input, ctx) {
    const title = text.clip(text.oneLine(input.text || ''), 90);
    if (!title) throw new Error('Write the hook title first, like "3 mistakes that make a video feel slow".');
    if (!media.canRender(ctx)) return T.offOutput({ title });
    const src = await T.sourceVideo(ctx, input);
    const brand = T.brandOf(ctx, input);
    const r = await E.hookTitle(ctx, src.path, { text: title, seconds: input.seconds || 3, style: input.style, look: brand.look, sample: src.sample, labels: T.labelsOf(input) });
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, 'hook', src.sample), sample: src.sample, at: 1.2, ai: src.ai || T.anyLabel(T.labelsOf(input)) });
    ctx.log(`Hook title on the first ${r.until} s`);
    return { ...saved, title, labels: r.labels };
  },
  view(out) {
    return T.videoView(out, { caption: `Hook: ${out.title}` });
  },
};
