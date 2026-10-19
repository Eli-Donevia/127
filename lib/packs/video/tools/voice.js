// Make the voiceover: reads a script out loud and says when each line is spoken, so the video can cut
// on the words. Natural voice with the `voice` key; otherwise the free computer voice (robotic, and
// labelled so, and marked sample so it costs nothing); with neither, timing only. One MP3 file.

const fs = require('fs');
const { views, save, text } = require('../../_kit');
const { linesToSay, makeVoice } = require('../lib/voice');

const ENGINE_LABEL = { elevenlabs: 'Natural voice', flite: 'Computer voice', none: 'No voice' };

module.exports = {
  name: 'video.voice',
  title: 'Make the voiceover',
  description: 'Reads your script out loud as an MP3 and times every line, so scenes and captions land on the words. Uses a natural voice when it is switched on, otherwise the free computer voice (it sounds robotic), and says which one you got.',
  kind: 'api',
  risk: 'draft',
  needs: [],
  wants: ['voice', 'render'],
  credits: 6,
  timeoutSec: 300,
  input: {
    type: 'object',
    properties: {
      script: { type: ['object', 'string'], title: 'Script', description: 'A script with labelled lines (HOOK:, LINE:, CTA:) from Write the video script' },
      text: { type: 'string', format: 'textarea', title: 'Or the words to read, one line each', maxLength: 3000 },
      gender: { type: 'string', title: 'Voice', enum: ['female', 'male'], default: 'female' },
      robot: { type: 'boolean', title: 'Use the computer voice when the natural voice is off', default: true },
      name: { type: 'string', title: 'File name (optional)', maxLength: 60 },
    },
  },
  output: {
    type: 'object',
    properties: {
      audio: { type: ['object', 'null'] },
      seconds: { type: 'number' },
      lines: { type: 'array' },
      words: { type: 'array' },
      engine: { type: 'string', enum: ['elevenlabs', 'flite', 'none'] },
      voice: { type: 'string' },
      note: { type: 'string' },
      sample: { type: 'boolean' },
    },
    required: ['lines', 'engine', 'seconds'],
  },
  async run(input, ctx) {
    const lines = linesToSay({ script: input.script, text: input.text });
    if (!lines.length) throw new Error('Add the words to read: a script, or one line per sentence.');
    if (lines.length > 40) throw new Error('That is more than 40 lines. Keep a short video to about 10 lines.');
    const title = text.oneLine((input.script && input.script.title) || input.name || 'voiceover');
    const v = await makeVoice(ctx, lines, { gender: input.gender || 'female', seed: title, robot: input.robot !== false });
    let audio = null;
    if (v.file) audio = await save.saveFile(ctx, `${text.slug(input.name || title, 50) || 'voiceover'}-voiceover.mp3`, fs.readFileSync(v.file));
    ctx.log(`${ENGINE_LABEL[v.engine]}: ${lines.length} lines, ${Math.round(v.seconds)} seconds${v.usd ? ` (${v.chars} characters)` : ''}`);
    return { audio, seconds: v.seconds, lines: v.lines, words: v.words, engine: v.engine, voice: v.voice, note: v.note, sample: v.engine !== 'elevenlabs' };
  },
  view(out) {
    const label = ENGINE_LABEL[out.engine] || 'Voice';
    return views.blocks(
      views.metric('Voiceover', `${Math.round(out.seconds)} seconds`, out.voice ? `${label}: ${out.voice}` : label),
      out.audio ? views.file(out.audio, 'Voiceover (.mp3)') : null,
      out.note ? views.text(out.note) : null,
      views.table(
        [
          { key: 'at', label: 'Starts' },
          { key: 'say', label: 'Line' },
        ],
        out.lines.map((l) => ({ at: `${Number(l.start).toFixed(1)} s`, say: l.say })),
        12,
      ),
    );
  },
};
