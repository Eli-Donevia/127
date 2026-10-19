// Transcribes one minute of the video with word timings (Deepgram nova-3, $0.0043 a minute), so a
// workflow runs it once per minute and the credits follow the video's length. Without the key it
// returns the sample talk's words for the sample video, and nothing (marked sample) for a real one.

const fs = require('fs');
const path = require('path');
const { media, views, text } = require('../../_kit');
const { localPath } = require('../lib/source');
const { talkWords } = require('../lib/sample');
const { compact, stamp } = require('../lib/words');
const { deepgram, PROVIDERS } = require('../lib/providers');

const PAD = 1.5;

async function audioPart(ctx, file, from, to) {
  const dir = media.scratch(ctx, 'stt');
  const mp3 = path.join(dir, 'part.mp3');
  try {
    await media.ffmpeg(['-ss', String(from), '-t', String(to - from), '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '48k', mp3], { timeoutSec: 120, signal: ctx.signal });
    return { data: fs.readFileSync(mp3), type: 'audio/mpeg' };
  } catch {
    const wav = path.join(dir, 'part.wav');
    await media.ffmpeg(['-ss', String(from), '-t', String(to - from), '-i', file, '-vn', '-ac', '1', '-ar', '16000', wav], { timeoutSec: 120, signal: ctx.signal });
    return { data: fs.readFileSync(wav), type: 'audio/wav' };
  }
}

module.exports = {
  name: 'video.transcribe',
  title: 'Transcribe one minute',
  description: 'Writes down every word said in one minute of the video, with the exact time of each word, for captions and for finding the best moments.',
  kind: 'api',
  risk: 'read',
  needs: ['transcribe'],
  wants: ['render'],
  credits: 2,
  timeoutSec: 300,
  input: {
    type: 'object',
    properties: {
      source: { type: 'object', title: 'The video (from Load your video)' },
      block: { type: 'object', title: 'Which minute' },
      language: { type: 'string', title: 'Language', description: 'en for English, or auto to detect it', maxLength: 10, default: 'en' },
    },
    required: ['source', 'block'],
  },
  output: {
    type: 'object',
    properties: { index: { type: 'integer' }, start: { type: 'number' }, end: { type: 'number' }, words: { type: 'array' }, language: { type: 'string' }, missing: { type: 'boolean' }, sample: { type: 'boolean' } },
    required: ['words'],
  },
  async run(input, ctx) {
    const src = input.source || {};
    const b = input.block || {};
    const index = Number.isInteger(b.index) ? b.index : 0;
    const start = Number(b.start) || 0;
    const end = Number(b.end) || start + 60;
    if (src.kind === 'sample') {
      return { index, start, end, words: compact(talkWords(start, end)), language: 'en', sample: true };
    }
    if (ctx.sample) {
      // A real video, but transcription isn't connected: say so instead of inventing words.
      ctx.log('Transcription is not connected, so this minute has no words yet.');
      return { index, start, end, words: [], language: input.language || 'en', missing: true, sample: true };
    }
    const key = ctx.secret('transcribe');
    let words = [];
    let language = input.language || 'en';
    let minutes;
    if (b.whole || !media.canRender(ctx)) {
      if (src.kind !== 'url') throw new Error("This server can't open uploaded video right now. Paste a public link to the file instead.");
      const res = await deepgram(ctx, key, { url: src.url }, { language });
      words = res.words;
      language = res.language;
      minutes = Math.max(1, res.seconds / 60);
    } else {
      const file = await localPath(ctx, src);
      const from = Math.max(0, start - PAD);
      const to = end + PAD;
      const audio = await audioPart(ctx, file, from, to);
      const res = await deepgram(ctx, key, audio, { language });
      language = res.language;
      words = res.words.map((x) => ({ w: x.w, s: x.s + from, e: x.e + from })).filter((x) => x.s >= start - 0.001 && x.s < end);
      minutes = (to - from) / 60;
    }
    await ctx.spend(minutes * PROVIDERS.transcribe.usdPerMinute, 'Deepgram transcription');
    ctx.log(`Minute ${index + 1}: ${words.length} words`);
    return { index, start, end, words: compact(words), language, sample: false };
  },
  view(out) {
    const first = (out.words || []).slice(0, 18).map((x) => x[0]).join(' ');
    return [views.text(`${stamp(out.start)} to ${stamp(out.end)}: ${out.words.length} words${first ? `. "${text.clip(first, 120)}"` : ''}`)];
  },
  viewMany(outs) {
    const ok = outs.filter((o) => o && Array.isArray(o.words));
    const total = ok.reduce((n, o) => n + o.words.length, 0);
    const missing = ok.some((o) => o.missing);
    const rows = ok.map((o) => ({ at: `${stamp(o.start)} to ${stamp(o.end)}`, words: o.words.length, start: text.clip(o.words.slice(0, 14).map((x) => x[0]).join(' '), 90) }));
    return views.blocks(
      views.metric('Words transcribed', total, `${text.plural(ok.length, 'minute')}${ok.some((o) => o.sample) ? ', sample' : ''}`),
      missing ? views.text('Transcription is not connected yet, so your own video has no words to caption. The rest of the run still works.') : null,
      views.table([{ key: 'at', label: 'Minute' }, { key: 'words', label: 'Words', format: 'number' }, { key: 'start', label: 'Starts with' }], rows, 12),
    );
  },
};
