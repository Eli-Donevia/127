// A music bed under the video: your own track, or a soft one made in code (no license needed). With
// someone talking, the music dips under the voice by itself (sidechain ducking) and fades out at the end.

const { media } = require('../../_kit');
const E = require('../lib/edit');
const T = require('../lib/edit-tools');

module.exports = {
  name: 'studio.edit_music',
  title: 'Add a music bed',
  description: 'Adds music under the video: your own track (MP3, WAV or M4A) or a soft bed made in code that needs no license. The music dips under the voice by itself, fades in and out, and the whole mix is leveled for phones.',
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
      music: { type: ['string', 'object'], format: 'asset', accept: 'audio/*', title: 'Your music (optional)', description: 'A track you have the rights to. Leave it out for a bed made in code.' },
      level: { type: 'number', title: 'Music level under the voice', minimum: 0.05, maximum: 0.6, default: 0.18 },
      duck: { type: 'boolean', title: 'Dip the music when someone talks', default: true },
    },
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, music: { type: 'string' }, ducked: { type: 'boolean' } } },
  async run(input, ctx) {
    if (!media.canRender(ctx)) return T.offOutput();
    const src = await T.sourceVideo(ctx, input);
    const own = T.assetId(input.music) ? await T.readAsset(ctx, input.music, 'Your music file') : null;
    const r = await E.musicBed(ctx, src.path, { music: own ? own.path : null, level: input.level || 0.18, duck: input.duck !== false });
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, 'with-music', src.sample), sample: src.sample, ai: src.ai });
    ctx.log(`Music added (${r.music}${r.ducked ? ', ducked under the voice' : ''})`);
    return { ...saved, music: r.music, ducked: r.ducked };
  },
  view(out) {
    return T.videoView(out, { caption: `With music (${out.music}${out.ducked ? ', dips under the voice' : ''})` });
  },
};
