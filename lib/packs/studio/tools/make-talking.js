// A talking clip: a photo (or a short video) of the presenter speaking the voiceover, lips in sync,
// on the first lip-sync model that is switched on. The presenter is the member, or someone who agreed
// to it in writing (the description says so). Until a model is on, the sample is the photo with a
// slow push-in and the voiceover playing, labeled.

const fs = require('fs');
const path = require('path');
const { media, views, text, save, brain } = require('../../_kit');
const gen = require('../lib/gen');
const samples = require('../lib/samples');
const { readAsset, keepVideo, usageBlocks, CONSENT_TEXT, ASPECTS, MEDIA_KEYS, PROVIDER } = require('../lib/clip-tool');
const providers = require('../lib/providers');

const CREDITS = 260;

module.exports = {
  name: 'studio.make_talking',
  title: 'Make a talking clip',
  description: 'Makes a clip of the person in your photo or video saying your voiceover, lips in sync. Use your own face, or someone who agreed in writing.',
  kind: 'api',
  risk: 'draft',
  needs: [],
  wants: [...MEDIA_KEYS, 'render'],
  credits: CREDITS,
  lane: 'render',
  timeoutSec: 900,
  input: {
    type: 'object',
    properties: {
      face: { type: 'string', format: 'asset', accept: 'image/*,video/*', title: 'A photo or short video of the person speaking' },
      consent: { type: 'boolean', title: CONSENT_TEXT, default: false },
      voice: { type: ['object', 'string', 'null'], title: 'The voiceover', description: 'The file from Make the voiceover, or an MP3 in your Library' },
      aspect: { type: 'string', title: 'Shape', enum: ASPECTS, default: '9:16' },
      maxSeconds: { type: 'integer', title: 'Longest it may be (seconds)', minimum: 5, maximum: 30, default: 20 },
      provider: PROVIDER,
    },
    required: ['face'],
  },
  output: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      kind: { type: 'string' },
      video: { type: ['object', 'null'] },
      poster: { type: ['object', 'null'] },
      seconds: { type: 'number' },
      aspect: { type: 'string' },
      made: { type: 'string' },
      account: { type: 'string' },
      ownAccount: { type: 'boolean' },
      usage: { type: ['object', 'null'] },
      note: { type: 'string' },
      sample: { type: 'boolean' },
    },
    required: ['title', 'kind', 'aspect', 'made', 'sample'],
  },
  async run(input, ctx) {
    const face = await readAsset(ctx, input.face);
    if (!face) throw new Error('Add a photo or a short video of the person speaking.');
    // Legal L76 V1: a real person's face goes nowhere without the box ticked.
    if (!input.consent) throw new Error(`Tick the box "${CONSENT_TEXT}" to make a talking clip from this photo.`);
    if (typeof gen.ready === 'function') await gen.ready(ctx);
    const voice = await readAsset(ctx, input.voice);
    const aspect = input.aspect || '9:16';
    const maxS = input.maxSeconds || 20;
    let seconds = 0;
    if (voice && media.canRender(ctx)) {
      try {
        seconds = (await media.probe(voice.path)).duration || 0;
      } catch {
        throw new Error("That voiceover file doesn't open. Make it again with Make the voiceover, or add an MP3.");
      }
    }
    if (seconds > maxS + 0.5) throw new Error(`The voiceover is ${Math.round(seconds)} seconds. Keep it under ${maxS}, or raise the limit.`);
    const isVid = /^video\//.test(face.type || '');
    const b = brain.brainOf(ctx, input);
    const base = `${text.slug(b.name || 'studio', 30)}-talking`;
    const out = { title: 'Talking clip', kind: 'video', video: null, poster: null, seconds: Math.round(seconds * 10) / 10, aspect, made: '', note: '', sample: false };
    const prefer = input.provider && input.provider !== 'auto' ? [input.provider] : [];
    if (voice) {
      const req = { kind: 'lipsync', aspect, seconds: Math.ceil(seconds) || 10, audio: { data: fs.readFileSync(voice.path), type: voice.type || 'audio/mpeg', name: voice.name } };
      req[isVid ? 'video' : 'image'] = { data: fs.readFileSync(face.path), type: face.type, name: face.name };
      const res = await gen.generate(ctx, 'lipsync', req, { credits: CREDITS, prefer, label: 'talking clip' });
      if (res) {
        out.made = `${res.service}: ${res.label}`;
        out.account = res.account || '127';
        if (res.account === 'member') out.ownAccount = true;
        out.usage = res.usage || providers.usage(res.provider) || null;
        Object.assign(out, await keepVideo(ctx, res.files[0].path, base, { source: 'ai' }));
        return out;
      }
    }
    out.sample = true;
    out.made = 'Sample';
    out.note = voice
      ? 'Sample: lip-sync models are not switched on yet, so this is your photo with the voiceover playing. When one is, the person in it speaks the words.'
      : 'Sample: add the voiceover to make the talking clip.';
    if (!media.canRender(ctx)) return out;
    const still = isVid ? path.join(media.scratch(ctx, 'face'), 'face.jpg') : face.path;
    if (isVid) fs.writeFileSync(still, await media.frame(ctx, face.path, { at: 0.5, format: 'jpg' }));
    const s = await samples.clip(ctx, { image: still, title: 'Talking clip', seconds: Math.max(3, Math.min(maxS, seconds || 5)), aspect });
    let file = s.path;
    if (voice) {
      file = path.join(media.scratch(ctx, 'talk'), 'talk.mp4');
      await media.ffmpeg(['-i', s.path, '-i', voice.path, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-shortest', '-movflags', '+faststart', file], { timeoutSec: 120, signal: ctx.signal });
    }
    // The stand-in is the photo with the voiceover; the voiceover is taken as AI-made (Make the
    // voiceover), so the file is tagged a composite with AI media. Without a voice, a plain composite.
    Object.assign(out, await keepVideo(ctx, file, `${base}-sample`, { source: voice ? 'mixed' : 'composite' }));
    return out;
  },
  view(out) {
    return views.blocks(
      views.video(out.video, out.title),
      out.sample ? views.text(out.note) : usageBlocks(out),
      views.text('AI-made person. Label it "AI-generated" where people could take it for real, and turn on the platform\'s AI label when you post.'),
    );
  },
};
