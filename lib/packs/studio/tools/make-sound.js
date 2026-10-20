// Music or a sound effect from a description (ElevenLabs, fal or Google, whichever is on). Until one
// is, a quiet labeled tone bed so the rest of a run still has sound to mix.

const fs = require('fs');
const { views, text, save, brain } = require('../../_kit');
const gen = require('../lib/gen');
const { usageBlocks } = require('../lib/clip-tool');
const samples = require('../lib/samples');
const P = require('../lib/provenance');
const safety = require('../lib/safety');
const providers = require('../lib/providers');

const CREDITS = 12;

module.exports = {
  name: 'studio.make_sound',
  title: 'Make music or a sound',
  description: 'Makes a short music bed or a sound effect from a description, like "warm lo-fi beat, no vocals" or "soft whoosh".',
  kind: 'api',
  risk: 'draft',
  needs: [],
  wants: [...providers.keysFor(['voice', 'fal', 'gemini']), 'render'],
  credits: CREDITS,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', title: 'Music or a sound effect', enum: ['music', 'sfx'], default: 'music' },
      prompt: { type: 'string', title: 'Describe it', maxLength: 400, default: 'Warm, upbeat background music, no vocals, steady beat' },
      seconds: { type: 'integer', title: 'Seconds', minimum: 1, maximum: 60, default: 20 },
    },
  },
  output: {
    type: 'object',
    properties: { audio: { type: ['object', 'null'] }, ownAccount: { type: 'boolean' }, usage: { type: ['object', 'null'] }, prompt: { type: 'string' }, seconds: { type: 'number' }, made: { type: 'string' }, sample: { type: 'boolean' } },
    required: ['prompt', 'made', 'sample'],
  },
  async run(input, ctx) {
    const kind = input.what === 'sfx' ? 'sfx' : 'music';
    const prompt = text.oneLine(input.prompt || 'Warm, upbeat background music, no vocals');
    const seconds = input.seconds || 20;
    const name = text.slug(brain.brainOf(ctx, input).name || 'studio', 30);
    await safety.guard(ctx, prompt);
    if (typeof gen.ready === 'function') await gen.ready(ctx);
    const res = await gen.generate(ctx, kind, { kind, prompt, seconds }, { credits: CREDITS, label: kind });
    if (res) {
      const f = res.files[0];
      const ext = /wav/.test(f.type) ? '.wav' : '.mp3';
      return { audio: await save.saveFile(ctx, `${name}-${kind}${ext}`, fs.readFileSync(f.path)), prompt, seconds, made: `${res.service}: ${res.label}`, ...(res.account === 'member' ? { ownAccount: true } : {}), usage: res.usage || providers.usage(res.provider) || null, sample: false };
    }
    const s = await samples.sound(ctx, { seconds });
    return { audio: s ? await save.saveFile(ctx, `${name}-${kind}-sample.wav`, fs.readFileSync(s.path)) : null, prompt, seconds, made: 'Sample', sample: true };
  },
  view(out) {
    return views.blocks(views.file(out.audio, out.sample ? 'Sample sound' : 'Your sound'), ...(out.sample ? [views.text('Sample: music and sound models are not switched on yet, so this is a quiet stand-in.')] : [...usageBlocks(out), views.text(P.AI_LINE)]));
  },
};
