// Opens the member's video (a file from their Library or a public link), checks it, and splits it
// into one-minute parts so transcription is charged by length. With no video it loads the sample talk.

const { media, views, text } = require('../../_kit');
const { sourceOf, localPath } = require('../lib/source');
const { TALK } = require('../lib/sample');
const { stamp } = require('../lib/words');

const r2 = (n) => Math.round(n * 100) / 100;

function blocksFor(duration, maxMinutes) {
  const end = Math.min(duration, maxMinutes * 60);
  const out = [];
  for (let i = 0, t = 0; t < end - 0.5; i++, t += 60) out.push({ index: i, start: t, end: r2(Math.min(end, t + 60)) });
  return out.length ? out : [{ index: 0, start: 0, end: r2(Math.max(1, end)) }];
}

module.exports = {
  name: 'video.load_video',
  title: 'Load your video',
  description: 'Opens the video or audio you uploaded or linked, checks its length, picture and sound, and splits it into one-minute parts for transcription. With nothing given it loads a sample talk so you can see the whole flow.',
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['render'],
  credits: 1,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      file: { type: ['string', 'object'], title: 'Your video', description: 'A video or audio file from your Library (its id)' },
      url: { type: 'string', title: 'Or a public link to the file', description: 'A link that opens the video file itself (Dropbox and Google Drive share links work)', maxLength: 2000 },
      maxMinutes: { type: 'integer', title: 'Use at most this many minutes', minimum: 1, maximum: 90, default: 90 },
    },
  },
  output: {
    type: 'object',
    properties: {
      source: { type: 'object' },
      blocks: { type: 'array' },
      minutes: { type: 'number' },
      seconds: { type: 'number' },
      note: { type: 'string' },
      sample: { type: 'boolean' },
    },
    required: ['source', 'blocks'],
  },
  async run(input, ctx) {
    const src = sourceOf(input);
    const max = input.maxMinutes || 90;
    if (src.kind === 'sample') {
      const blocks = blocksFor(TALK.duration, max);
      ctx.log(`No video given, so this run uses the sample talk (${stamp(TALK.duration)}).`);
      return {
        source: { ...src, duration: TALK.duration, width: 1080, height: 1920, hasVideo: false, hasAudio: true, title: TALK.title, speaker: TALK.speaker, business: TALK.business },
        blocks,
        minutes: blocks.length,
        seconds: TALK.duration,
        note: `Sample talk: ${TALK.speaker} from ${TALK.business}, ${stamp(TALK.duration)} long. Add your own video to cut yours.`,
        sample: true,
      };
    }
    if (!media.canRender(ctx)) {
      // No ffmpeg here: we can't open the file, but the transcription service can read a link itself.
      if (src.kind !== 'url') throw new Error("This server can't open uploaded video right now. Paste a public link to the file instead.");
      ctx.log('Video tools are off on this server, so the whole link goes to transcription in one part.');
      return { source: { ...src, duration: null, hasVideo: true, hasAudio: true }, blocks: [{ index: 0, start: 0, end: max * 60, whole: true }], minutes: max, seconds: 0, note: 'Opened by link only.', sample: false };
    }
    const file = await localPath(ctx, src);
    let info;
    try {
      info = await media.probe(file, { signal: ctx.signal });
    } catch {
      throw new Error("That file doesn't open as video or audio. Export it as MP4 (or MP3 for audio) and try again.");
    }
    if (!info.hasAudio) throw new Error("That video has no sound, so there's nothing to transcribe or caption. Check the file has audio.");
    if (!(info.duration > 0.5)) throw new Error('That file is empty or too short.');
    const blocks = blocksFor(info.duration, max);
    const used = Math.min(info.duration, max * 60);
    const note = info.duration > max * 60 + 1 ? `It's ${stamp(info.duration)} long; we'll use the first ${max} minutes.` : `${stamp(info.duration)} long${info.hasVideo ? `, ${info.width}x${info.height}` : ', audio only'}.`;
    ctx.log(`Opened ${src.name}: ${note}`);
    return {
      source: { ...src, duration: r2(info.duration), width: info.width, height: info.height, fps: info.fps, hasVideo: info.hasVideo, hasAudio: info.hasAudio, rotation: info.rotation, bytes: info.bytes },
      blocks,
      minutes: blocks.length,
      seconds: r2(used),
      note,
      sample: false,
    };
  },
  view(out) {
    const s = out.source || {};
    return views.blocks(
      views.metric('Length', stamp(s.duration || out.seconds || 0), text.plural(out.minutes || out.blocks.length, 'minute') + ' to transcribe'),
      out.note ? views.text(out.note) : null,
      out.sample ? views.text('This run uses a sample talk. Upload your own video, or paste a link to it, to cut your own clips.') : null,
    );
  },
};
