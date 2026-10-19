// Caption files for the whole video (and each clip): SRT and VTT for YouTube, Facebook, LinkedIn and
// editing apps, plus a readable transcript. Two lines of 42 characters at most per caption.

const { files, save, views, text } = require('../../_kit');
const { flatten, cues, transcriptText, stamp } = require('../lib/words');
const { bizOf } = require('../lib/sample');

module.exports = {
  name: 'video.captions',
  title: 'Make caption files',
  description: 'Turns the transcript into caption files (SRT and VTT) for the whole video and for each clip, plus a clean transcript with time stamps, in one zip.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      words: { type: 'array', title: 'Transcript (from Transcribe)' },
      clips: { type: 'array', title: 'Clips (optional)' },
      title: { type: 'string', title: 'Video title', maxLength: 120 },
    },
    required: ['words'],
  },
  output: {
    type: 'object',
    properties: { zip: { type: 'object' }, transcript: { type: 'object' }, cues: { type: 'integer' }, words: { type: 'integer' }, sample: { type: 'boolean' } },
    required: ['cues'],
  },
  async run(input, ctx) {
    const blocks = Array.isArray(input.words) ? input.words : [];
    const sample = blocks.some((b) => b && b.sample);
    const all = flatten(blocks);
    if (!all.length) return { cues: 0, words: 0, note: 'No words yet, so no caption files.', sample: true };
    const b = bizOf(ctx, input);
    const name = save.fileName(sample ? 'sample' : b.name || 'video', 'captions');
    const list = cues(all);
    const entries = [
      { name: `${name}.srt`, data: files.srt(list) },
      { name: `${name}.vtt`, data: files.vtt(list) },
    ];
    for (const c of (input.clips || []).filter((x) => x && Number.isFinite(Number(x.start)) && Number.isFinite(Number(x.end)))) {
      const inClip = all.filter((x) => x.s >= c.start && x.s < c.end);
      const cc = cues(inClip, { offset: Number(c.start) });
      const n = c.n || entries.length;
      entries.push({ name: `clip-${n}.srt`, data: files.srt(cc) }, { name: `clip-${n}.vtt`, data: files.vtt(cc) });
    }
    const transcript = transcriptText(all, { title: input.title });
    entries.push({ name: `${name}-transcript.txt`, data: transcript });
    const zip = await save.saveFile(ctx, `${name}.zip`, files.zip(entries));
    const txt = await save.saveFile(ctx, `${name}-transcript.txt`, transcript);
    ctx.log(`${list.length} captions, ${all.length} words`);
    return { zip, transcript: txt, cues: list.length, words: all.length, minutes: Math.round((all[all.length - 1].e / 60) * 10) / 10, preview: text.clip(transcript, 600), sample };
  },
  view(out) {
    if (!out.zip) return [views.text(out.note || 'No caption files.')];
    return views.blocks(
      views.metric('Captions', out.cues, `${out.words} words, ${stamp((out.minutes || 0) * 60)} long`),
      views.file(out.zip, 'Caption files (SRT, VTT, transcript)'),
      views.file(out.transcript, 'Transcript'),
    );
  },
};
