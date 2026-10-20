// Clean cut: takes out the pauses (and the filler words when the words are known), with optional
// punch-in jump cuts on every cut, in one render. Hands the words on, retimed, so captions later in
// the run still land on the right frames.

const { media, text } = require('../../_kit');
const E = require('../lib/edit');
const M = require('../lib/edit-media');
const T = require('../lib/edit-tools');

module.exports = {
  name: 'studio.edit_clean',
  title: 'Cut pauses and fillers',
  description: 'Cuts the pauses out of a talking video, and the filler words (um, uh, and "like" or "you know" when they are set off by a pause) when the transcript is there. Optional jump cuts punch in on every cut. One clean MP4 back, with the words retimed for captions.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  lane: 'render',
  credits: 6,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      video: T.VIDEO,
      chain: T.CHAIN,
      words: T.WORDS,
      fillers: { type: 'boolean', title: 'Cut filler words too (needs the transcript)', default: true },
      fillerWords: { type: 'array', title: 'Your own filler words (optional)', description: 'Words or two-word phrases that always go, like "basically" or "you know".', items: { type: 'string', maxLength: 30 }, maxItems: 20 },
      jumpCuts: { type: 'boolean', title: 'Punch in on the cuts (jump cuts)', default: false },
      pace: { type: 'string', title: 'How tight', enum: ['gentle', 'tight'], default: 'gentle', description: 'gentle cuts pauses over half a second; tight cuts anything over a third of a second.' },
    },
  },
  output: {
    type: 'object',
    properties: {
      ...T.VIDEO_OUT,
      before: { type: 'number' },
      removed: { type: 'number' },
      pauses: { type: 'integer' },
      fillers: { type: 'array' },
      words: { type: 'array' },
    },
  },
  async run(input, ctx) {
    if (!media.canRender(ctx)) return T.offOutput();
    const src = await T.sourceVideo(ctx, input);
    const i = await E.videoInfo(ctx, src.path);
    const tight = input.pace === 'tight';
    const pauses = await E.silenceCuts(ctx, src.path, i, { minSilence: tight ? 0.32 : 0.45, pad: tight ? 0.09 : 0.12 });
    // The sample clip has its own words; words passed in belong to the member's video.
    const words = src.sample ? src.words || [] : M.flatWords(input.words || []);
    const custom = (input.fillerWords || []).map((w) => text.oneLine(w)).filter(Boolean);
    const fill = input.fillers !== false && words.length ? E.fillerCuts(words, { fillers: custom.length ? custom : undefined }) : [];
    const r = await E.cutRanges(ctx, src.path, [...pauses, ...fill], { info: i, jump: input.jumpCuts === true, what: 'The clean cut' });
    const retimed = words.length ? M.remapWords(words, r.keep) : [];
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, 'clean-cut', src.sample), sample: src.sample, ai: src.ai });
    const notes = [];
    if (input.fillers !== false && !words.length) notes.push('Filler words need the transcript, so only the pauses were cut this time.');
    if (r.removed < 0.2) notes.push('There were almost no pauses to cut. The video is already tight.');
    ctx.log(`Cut ${r.removed} s: ${pauses.length} pauses${fill.length ? ` and ${fill.length} filler words` : ''}${r.punches ? `, ${r.punches} punch-ins` : ''}`);
    return {
      ...saved,
      before: M.r2(i.duration),
      removed: M.r2(i.duration - r.seconds),
      pauses: pauses.length,
      fillers: fill.slice(0, 60).map((f) => f.word),
      words: retimed.slice(0, 4000),
      ...(notes.length ? { note: notes.join(' ') } : {}),
    };
  },
  view(out) {
    return T.videoView(out, {
      metric: ['Cut out', `${out.removed} s`, `${out.before} s down to ${out.seconds} s: ${text.plural(out.pauses || 0, 'pause')}${out.fillers && out.fillers.length ? `, ${text.plural(out.fillers.length, 'filler word')}` : ''}`],
      caption: 'Clean cut',
    });
  },
};
