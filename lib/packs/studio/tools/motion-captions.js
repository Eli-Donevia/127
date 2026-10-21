// Kinetic captions: each word rises in as it's said and the spoken one lights up in your color, a
// few words at a time, over your video with its own sound. Rendered with HyperFrames when the server
// has it (lib/motion.js); otherwise the pop captions burned in with ffmpeg, and the result says so.

const path = require('path');
const { media, views, text } = require('../../_kit');
const E = require('../lib/edit');
const C = require('../lib/edit-captions');
const M = require('../lib/edit-media');
const T = require('../lib/edit-tools');
const motion = require('../lib/motion');

const HELD = 'Captions need the words of the video, which come from transcription. Transcription is held for review on 127 right now, so this video has no captions yet.';
const OFF_LINE = 'Animation is switched off on this server, so these are the pop captions burned in the usual way.';

module.exports = {
  name: 'studio.motion_captions',
  title: 'Add animated captions',
  description: 'Animated word-by-word captions over your video: a few words at a time, each one rising in as it is said, the spoken word lit up in your color, placed clear of the app buttons. Keeps your sound. Needs the words of the video from transcription.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  wants: ['motion'],
  lane: 'render',
  credits: 6,
  timeoutSec: 900,
  input: {
    type: 'object',
    properties: {
      video: T.VIDEO,
      chain: T.CHAIN,
      words: T.WORDS,
      retimed: { type: ['array', 'null'], title: 'Words retimed by a cut earlier in the run' },
      color: T.COLOR,
      labels: T.LABELS,
    },
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, words: { type: 'integer' }, pages: { type: 'integer' }, motion: { type: 'boolean' }, labels: { type: 'array' }, held: { type: 'boolean' } } },
  async run(input, ctx) {
    if (!media.canRender(ctx)) return T.offOutput();
    const src = await T.sourceVideo(ctx, input);
    const words = M.flatWords(T.wordsFor(input, src));
    if (!words.length) return { note: HELD, held: true, sample: true };
    const brand = T.brandOf(ctx, input);
    const labels = T.labelsOf(input);
    const ai = src.ai || T.anyLabel(labels);
    const base = T.baseName(ctx, input, 'animated-captions', src.sample);
    const m = motion.engine(ctx);
    if (!m) {
      const r = await E.captions(ctx, src.path, words, { style: 'pop', look: brand.look, sample: src.sample, labels });
      const saved = await T.saveVideo(ctx, r, { base, sample: src.sample, ai });
      return { ...saved, words: words.length, pages: 0, motion: false, labels: r.labels, note: OFF_LINE };
    }
    // The video at its own shape (up to 1080 x 1920), 30 fps with a key frame every second, so every
    // frame HyperFrames asks for is quick to find.
    const i = await E.videoInfo(ctx, src.path);
    const [W, H] = E.capSize(i);
    const dur = Math.min(i.duration, 180);
    const prepped = path.join(M.scratch(ctx, 'motion-in'), 'in.mp4');
    const audioIn = i.hasAudio ? ['-map', '0:a:0'] : ['-map', '1:a:0', '-shortest'];
    await M.run(ctx, ['-i', src.path, ...(i.hasAudio ? [] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']), '-map', '0:v:0', ...audioIn, '-t', dur.toFixed(3), '-vf', `scale=${W}:${H},setsar=1,fps=${M.FPS}`, '-g', String(M.FPS), '-keyint_min', String(M.FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', prepped], { what: 'Getting the video ready' });
    const pages = motion.captionPages(words.filter((w) => w.s < dur));
    const lines = C.labelLines(labels);
    // No SAMPLE tag of our own: the sample clip carries its own.
    const r = await motion.render(ctx, m, 'captions', { W, H, seconds: dur, data: { pages, look: { pop: brand.look.pop }, labels: lines, sample: false }, files: [{ from: prepped, as: 'in.mp4' }], timeoutSec: 840, what: 'The animated captions' });
    const saved = await T.saveVideo(ctx, r, { base, sample: src.sample, ai });
    ctx.log(`${words.length} words in ${pages.length} animated caption pages`);
    return { ...saved, words: words.length, pages: pages.length, motion: true, labels: lines };
  },
  view(out) {
    if (!out.video) return [views.text(out.note || 'Nothing was rendered.')];
    return T.videoView(out, { caption: `Animated captions (${text.plural(out.words, 'word')})` });
  },
};
