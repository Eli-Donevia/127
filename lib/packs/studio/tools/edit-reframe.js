// One video to several shapes at once: 9:16 for Reels, TikTok and Shorts, 1:1 and 4:5 for feeds,
// 16:9 for YouTube. Crop to fill (slide the window with focus) or show the whole picture over a
// blurred copy of itself.

const { media, views } = require('../../_kit');
const E = require('../lib/edit');
const M = require('../lib/edit-media');
const T = require('../lib/edit-tools');

const NAMES = { '9:16': 'Reels, TikTok, Shorts', '1:1': 'square feed', '4:5': 'portrait feed', '16:9': 'YouTube and wide' };

module.exports = {
  name: 'studio.edit_reframe',
  title: 'Reframe to every shape',
  description: 'Turns one video into 9:16, 1:1, 4:5 and 16:9 versions in one go, cropped to fill (you pick where the frame sits) or fitted over a soft blurred copy of itself.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  lane: 'render',
  credits: 6,
  timeoutSec: 900,
  input: {
    type: 'object',
    properties: {
      video: T.VIDEO,
      chain: T.CHAIN,
      aspects: { type: 'array', title: 'Shapes', items: { type: 'string', enum: M.ASPECTS }, minItems: 1, maxItems: 4, default: ['9:16', '1:1', '4:5', '16:9'] },
      fill: { type: 'string', title: 'Fill', enum: ['crop', 'blur'], default: 'crop', description: 'crop fills the frame and cuts the sides; blur shows the whole picture over a blurred copy.' },
      focus: { type: 'number', title: 'Where to frame, 0 left to 1 right', minimum: 0, maximum: 1, default: 0.5 },
      labels: T.LABELS,
    },
  },
  output: {
    type: 'object',
    properties: { ...T.VIDEO_OUT, videos: { type: 'array' }, fill: { type: 'string' } },
  },
  async run(input, ctx) {
    if (!media.canRender(ctx)) return T.offOutput({ videos: [] });
    const src = await T.sourceVideo(ctx, input);
    const aspects = [...new Set((input.aspects && input.aspects.length ? input.aspects : ['9:16']).filter((a) => M.ASPECTS.includes(a)))].slice(0, 4);
    const fill = input.fill === 'blur' ? 'blur' : 'crop';
    const videos = [];
    for (const aspect of aspects) {
      const r = await E.reframe(ctx, src.path, { aspect, fill, focus: input.focus != null ? input.focus : 0.5, labels: T.labelsOf(input) });
      const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, aspect.replace(':', 'x'), src.sample), sample: src.sample, ai: src.ai || T.anyLabel(T.labelsOf(input)) });
      videos.push({ aspect, use: NAMES[aspect], ...saved, labels: r.labels });
      ctx.log(`${aspect} ready (${saved.width}x${saved.height}, ${saved.mb} MB)`);
    }
    const first = videos[0];
    return { video: first.video, ...(first.poster ? { poster: first.poster } : {}), seconds: first.seconds, width: first.width, height: first.height, mb: first.mb, ...(first.aiMade ? { aiMade: true } : {}), videos, fill, sample: src.sample, labels: first.labels || [] };
  },
  view(out) {
    if (!out.videos || !out.videos.length) return [views.text(out.note || 'Nothing was rendered.')];
    return views.blocks(
      views.metric('Shapes ready', out.videos.length, out.videos.map((v) => v.aspect).join(', ')),
      out.videos.map((v) => views.video(v.video, `${v.aspect} for ${v.use} (${v.width}x${v.height}, ${Math.round(v.seconds)} s)`)),
      out.videos.map((v) => views.file(v.video, `${v.aspect} MP4 (${v.mb} MB)`)),
      T.aiLines(out).map((l) => views.text(l)),
      out.sample ? views.text('This is the sample clip. Add your own video to reframe yours.') : null,
    );
  },
};
