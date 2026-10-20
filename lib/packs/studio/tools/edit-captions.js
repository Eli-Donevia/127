// Burned-in captions, word by word, in six looks: bold, box, clean, karaoke, pop and minimal. The
// words come from the video pack's transcription (video.transcribe), or from a cut earlier in the run.

const { media, views, files, save, text } = require('../../_kit');
const E = require('../lib/edit');
const C = require('../lib/edit-captions');
const T = require('../lib/edit-tools');

const HELD = 'Captions need the words of the video, which come from transcription. Transcription is held for review on 127 right now, so this video has no captions yet. Everything else in the run still works.';

// Simple caption cues (for the SRT file): pages of up to 7 words, at most 42 characters a line.
function cues(words) {
  const pages = media.captionPages(words, { style: 'clean', width: 1080, height: 1920, maxWords: 7, maxLines: 2 });
  return pages.map((p) => ({ start: p.start, end: p.end, text: p.lines.map((l) => l.map((w) => w.w).join(' ')).join('\n') }));
}

module.exports = {
  name: 'studio.edit_captions',
  title: 'Burn in captions',
  description: 'Burns word-by-word captions into the video in one of six looks (bold, box, clean, karaoke, pop, minimal) in your colors, placed clear of the app buttons, plus an SRT caption file. Needs the words of the video from transcription.',
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
      words: T.WORDS,
      retimed: { type: ['array', 'null'], title: 'Words retimed by a cut earlier in the run' },
      style: { type: 'string', title: 'Caption look', enum: C.STYLES, default: 'bold', description: 'bold: big words, the spoken one lights up. box: the spoken word on a box in your color. clean: sentence case. karaoke: the color sweeps through the line. pop: one big word at a time. minimal: small and calm.' },
      color: T.COLOR,
      labels: T.LABELS,
    },
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, style: { type: 'string' }, words: { type: 'integer' }, srt: { type: 'object' }, held: { type: 'boolean' } } },
  async run(input, ctx) {
    if (!media.canRender(ctx)) return T.offOutput();
    const src = await T.sourceVideo(ctx, input);
    const words = T.wordsFor(input, src);
    // Nothing to caption: say why, charge nothing.
    if (!words.length) return { note: HELD, held: true, sample: true };
    const brand = T.brandOf(ctx, input);
    const style = C.STYLES.includes(input.style) ? input.style : 'bold';
    const r = await E.captions(ctx, src.path, words, { style, look: brand.look, sample: src.sample, labels: T.labelsOf(input) });
    const base = T.baseName(ctx, input, `captions-${style}`, src.sample);
    const saved = await T.saveVideo(ctx, r, { base, sample: src.sample, ai: src.ai || T.anyLabel(T.labelsOf(input)) });
    let srt = null;
    try {
      srt = await save.saveFile(ctx, `${base}.srt`, files.srt(cues(words)));
    } catch {
      srt = null;
    }
    ctx.log(`${words.length} words captioned in the ${style} look`);
    return { ...saved, style, words: words.length, labels: r.labels, ...(srt ? { srt } : {}) };
  },
  view(out) {
    if (!out.video) return [views.text(out.note || 'Nothing was rendered.')];
    return T.videoView(out, { caption: `Captions, ${out.style} look (${text.plural(out.words, 'word')})`, files: out.srt ? [views.file(out.srt, 'Caption file (SRT) for YouTube and other uploads')] : [] });
  },
};
