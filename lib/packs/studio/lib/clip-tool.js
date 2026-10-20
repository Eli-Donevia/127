// The generation tools share one shape: take a shot (words for the model, maybe a start photo),
// make it with the first model that is switched on and fits the tool's price, save it to the
// member's Library, and say which model made it. With no model on (production until Legal clears
// the services), make the labeled sample from lib/samples.js instead: sample: true, no credits.

const fs = require('fs');
const path = require('path');
const { media, views, text, brain, ai } = require('../../_kit');
const safety = require('./safety');
const providers = require('./providers');

// Legal L76 part 5, word for word (V1).
const CONSENT_TEXT = "This is me, or I have this person's written OK to use their face or voice this way. They're 18 or older.";
const gen = require('./gen');
const samples = require('./samples');
const P = require('./provenance');

const ASPECTS = ['9:16', '1:1', '16:9', '4:5'];
// The member's own accounts and 127's cleared keys for the video and image providers.
const MEDIA_KEYS = providers.keysFor(['fal', 'higgsfield', 'runway', 'luma', 'gemini']);
const PROVIDER = { type: 'string', title: 'Which AI model service', enum: ['auto', 'fal', 'higgsfield', 'runway', 'luma', 'gemini'], default: 'auto', description: 'auto picks the first one that is switched on and fits the price.' };
const SHOT = {
  type: ['object', 'string'],
  title: 'The shot',
  description: 'What the model should make: a shot from Plan the shots, or your own words.',
};

// Which prompt style a model reads best (lib/prompts.js), from its id.
function familyOf(modelId = '') {
  const m = String(modelId).toLowerCase();
  if (/kling/.test(m)) return 'kling';
  if (/veo|omni/.test(m)) return 'veo';
  if (/gen4|gen-4|runway|aleph/.test(m)) return 'runway';
  if (/ray|luma|dream/.test(m)) return 'luma';
  if (/higgs|dop|soul/.test(m)) return 'higgsfield';
  if (/sora/.test(m)) return 'sora';
  if (/flux/.test(m)) return 'flux';
  if (/imagen|gemini|nano/.test(m)) return 'imagen';
  return 'kling';
}

// A shot can be a string, or { title, text (the prompt, editable in HQ), negative, seconds, hook,
// shot: { subject, action, camera, ... } } from Plan the shots.
function shotOf(input) {
  const s = input.shot;
  if (s && typeof s === 'object') return { title: text.oneLine(s.title || ''), prompt: text.oneLine(s.text || s.prompt || ''), negative: text.oneLine(s.negative || ''), seconds: Number(s.seconds) || null, hook: text.oneLine(s.hook || ''), parts: s.shot && typeof s.shot === 'object' ? s.shot : null, n: s.n, at: Number.isFinite(Number(s.at)) && s.at !== null && s.at !== '' ? Number(s.at) : null };
  return { title: '', prompt: text.oneLine(s || input.prompt || ''), negative: '', seconds: null, hook: '', parts: null };
}

// The words for the model: the member's edited text wins; otherwise rebuild the structured shot in
// the style of the model that will make it.
function promptFor(shot, family, { aspect, seconds }) {
  if (shot.prompt) return { prompt: shot.prompt, negative: shot.negative };
  if (shot.parts) {
    try {
      const prompts = require('./prompts');
      const b = prompts.build({ model: family, shot: shot.parts, aspect, seconds });
      return { prompt: b.prompt, negative: b.negative || shot.negative };
    } catch {
      /* prompts lib not there: fall through */
    }
    return { prompt: Object.values(shot.parts).filter(Boolean).join(', '), negative: shot.negative };
  }
  return { prompt: '', negative: '' };
}

async function readAsset(ctx, v) {
  if (!v) return null;
  const id = typeof v === 'object' ? v.id : v;
  if (!id) return null;
  try {
    const a = await ctx.asset(id);
    return a && a.path ? a : null;
  } catch {
    throw new Error("That file isn't in your Library any more. Add it again and run this once more.");
  }
}

// A start photo the services take: under 2 MB (Runway refuses over 5 MB), long side 1920 at most.
async function startImage(ctx, photo) {
  const data = fs.readFileSync(photo.path);
  if (data.length <= 2e6 || !media.canRender(ctx)) return { data, type: photo.type || 'image/jpeg', name: photo.name };
  const out = path.join(media.scratch(ctx, 'start'), 'start.jpg');
  try {
    await media.ffmpeg(['-i', photo.path, '-vf', "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease", '-q:v', '3', '-frames:v', '1', out], { timeoutSec: 60, signal: ctx.signal });
  } catch {
    throw new Error("That photo doesn't open. Save it as a JPG or PNG and try again.");
  }
  return { data: fs.readFileSync(out), type: 'image/jpeg', name: 'start.jpg' };
}

// Each studio clip or image ends up in the Library with a cover frame, tagged with where it came
// from (lib/provenance): source 'ai' for a model's output, 'composite' for a sample stand-in, and
// 'mixed' for a stand-in that carries an AI voice.
async function keepVideo(ctx, file, base, { source = 'ai' } = {}) {
  const video = await P.saveMedia(ctx, `${base}.mp4`, fs.readFileSync(file), { source });
  let poster = null;
  if (media.canRender(ctx)) {
    try {
      const jpg = await media.frame(ctx, file, { at: 0.8, format: 'jpg', width: 540 });
      poster = await P.saveMedia(ctx, `${base}-cover.jpg`, jpg, { source });
    } catch {
      poster = null;
    }
  }
  return { video, poster };
}

// Legal L76 part 5: "Made with {provider} · Usage rules", plus attribution a provider asks for
// ("Powered by Runway"), and whose account it ran on.
function usageBlocks(out) {
  const u = out.usage || {};
  const service = u.service || String(out.made || '').split(':')[0];
  return [
    views.text(`Made with ${out.made}${out.ownAccount ? ', on your own account' : ''}.`),
    u.policy ? views.link(`Made with ${service} · Usage rules`, u.policy) : null,
    u.attribution && u.attribution.url ? views.link(u.attribution.text, u.attribution.url) : u.attribution ? views.text(u.attribution.text) : null,
  ];
}

function usageOnce(outs) {
  const seen = new Set();
  const out = [];
  for (const o of outs) {
    if (o.sample || !o.usage || seen.has(o.usage.service)) continue;
    seen.add(o.usage.service);
    out.push(...usageBlocks(o).slice(1));
  }
  return out;
}

// V1: a start photo goes to a model only when it shows no person, or the member ticked the box.
// AI looks at the photo when it's on; without AI the box on the form is the check.
async function noPersonUnlessOk(ctx, image) {
  if (!image || !image.data || image.data.length > 4.5e6) return;
  const { data, ai: used } = await ai.aiJson(ctx, {
    task: 'classify',
    system: 'You look at one photo and say whether a real person (a face, or a recognizable body) is in it. Hands alone holding a product do not count.',
    prompt: 'Is there a person in this photo?',
    images: [{ type: /png/.test(image.type) ? 'image/png' : 'image/jpeg', data: image.data.toString('base64') }],
    schema: { type: 'object', properties: { person: { type: 'boolean' } }, required: ['person'] },
    maxTokens: 30,
    fallback: () => ({ person: false }),
  });
  if (used && data.person) throw new Error(`Your photo shows a person. Tick the box "${CONSENT_TEXT}" if that's true, or use a photo of only the product.`);
}

function baseName(ctx, input, shot, kind, n) {
  const b = brain.brainOf(ctx, input);
  const who = b.name || input.product || 'studio';
  return [text.slug(who, 30), text.slug(shot.title || kind, 30), n ? String(n) : ''].filter(Boolean).join('-');
}

// opts: { name, title, description, kind: 'video' | 'image', credits, prefer, seconds: [allowed], audio }
function makeTool(opts) {
  const isVideo = opts.kind === 'video';
  return {
    name: opts.name,
    title: opts.title,
    description: opts.description,
    kind: 'api',
    risk: 'draft',
    needs: [],
    wants: [...MEDIA_KEYS, 'render'],
    tasks: [],
    credits: opts.credits,
    timeoutSec: 900,
    input: {
      type: 'object',
      properties: {
        shot: SHOT,
        prompt: { type: 'string', format: 'textarea', title: 'Or describe it', maxLength: 1500 },
        photo: { type: 'string', format: 'asset', accept: 'image/*', title: isVideo ? 'Start from this photo (optional)' : 'Your photo to build on (optional)' },
        product: { type: 'string', title: 'What it is (optional)', maxLength: 120 },
        aspect: { type: 'string', title: 'Shape', enum: ASPECTS, default: isVideo ? '9:16' : '1:1' },
        ...(isVideo ? { seconds: { type: 'integer', title: 'Seconds', minimum: 3, maximum: 10, default: 5 } } : {}),
        people: { type: 'boolean', title: CONSENT_TEXT, default: false, description: 'Tick it if your photo shows a person.' },
        provider: PROVIDER,
      },
    },
    output: {
      type: 'object',
      properties: {
        n: { type: 'integer' },
        account: { type: 'string' },
        ownAccount: { type: 'boolean' },
        usage: { type: ['object', 'null'] },
        at: { type: 'number' },
        title: { type: 'string' },
        hook: { type: 'string' },
        prompt: { type: 'string' },
        kind: { type: 'string' },
        video: { type: ['object', 'null'] },
        image: { type: ['object', 'null'] },
        poster: { type: ['object', 'null'] },
        seconds: { type: 'number' },
        aspect: { type: 'string' },
        made: { type: 'string' },
        note: { type: 'string' },
        sample: { type: 'boolean' },
      },
      required: ['title', 'prompt', 'kind', 'aspect', 'made', 'sample'],
    },
    async run(input, ctx) {
      const shot = shotOf(input);
      const aspect = input.aspect || (isVideo ? '9:16' : '1:1');
      const want = Math.max(3, Math.min(10, Number(shot.seconds || input.seconds) || 5));
      const photo = await readAsset(ctx, input.photo);
      const prefer = input.provider && input.provider !== 'auto' ? [input.provider] : opts.prefer || [];
      const req = { kind: opts.kind, aspect, seconds: isVideo ? want : undefined, count: 1, audio: !!opts.audio };
      if (photo) req.image = await startImage(ctx, photo);
      if (typeof gen.ready === 'function') await gen.ready(ctx);
      const pick = gen.choices(ctx, opts.kind, req, { maxUsd: gen.maxUsdFor(opts.credits), prefer })[0];
      const family = pick ? familyOf(pick.model.id) : opts.kind === 'image' ? 'flux' : 'kling';
      const words = promptFor(shot, family, { aspect, seconds: want });
      const prompt = words.prompt || (input.product ? `${input.product}, clean studio light, slow camera push in` : '');
      if (!prompt) throw new Error('Say what to make: pick a shot from Plan the shots, or describe it in a sentence.');
      const title = shot.title || text.clip(prompt, 60);
      const base = baseName(ctx, input, shot, opts.kind, shot.n);
      const out = { title, hook: shot.hook || '', prompt, kind: opts.kind, video: null, image: null, poster: null, aspect, made: '', note: '', sample: false };
      if (shot.n) out.n = shot.n;
      if (shot.at != null) out.at = shot.at;

      // Legal L76 V5 and V1: blocked words never reach a model, and a photo of a person goes only with the box ticked.
      await safety.guard(ctx, `${prompt} ${words.negative || ''} ${input.product || ''}`);
      if (pick && photo && !input.people) await noPersonUnlessOk(ctx, req.image);
      const res = pick ? await gen.generate(ctx, opts.kind, { ...req, prompt, negative: words.negative }, { credits: opts.credits, prefer, label: title }) : null;
      if (res) {
        const f = res.files[0];
        out.made = `${res.service}: ${res.label}`;
        out.account = res.account || '127';
        if (res.account === 'member') out.ownAccount = true;
        out.usage = (res.usage || providers.usage(res.provider)) || null;
        if (isVideo) {
          Object.assign(out, await keepVideo(ctx, f.path, base, { source: 'ai' }));
          out.seconds = res.seconds || want;
        } else {
          const ext = /png/.test(f.type) ? '.png' : /webp/.test(f.type) ? '.webp' : '.jpg';
          out.image = await P.saveMedia(ctx, `${base}${ext}`, fs.readFileSync(f.path), { source: 'ai' });
        }
        ctx.log(`${out.made} made "${title}"`);
        return out;
      }

      // Sample: the member's photo (or a card with the shot on it), labeled.
      out.sample = true;
      out.made = 'Sample';
      out.note = `Sample: AI ${isVideo ? 'video' : 'image'} models aren't switched on yet, so this is a stand-in. When one is, this step makes the real ${isVideo ? 'clip' : 'image'} from the words above.`;
      const seed = brain.brainOf(ctx, input).name || input.product || title;
      if (isVideo) {
        const s = await samples.clip(ctx, { image: photo && photo.path, title, shot: prompt, seconds: want, aspect, seed });
        if (s) Object.assign(out, await keepVideo(ctx, s.path, `${base}-sample`, { source: 'composite' }));
        out.seconds = want;
      } else {
        const s = await samples.image(ctx, { photo: photo && photo.path, title, shot: prompt, aspect, seed });
        if (s) out.image = await P.saveMedia(ctx, `${base}-sample.png`, fs.readFileSync(s.path), { source: 'composite' });
      }
      ctx.log(`Made a sample for "${title}"`);
      return out;
    },
    view(out) {
      return views.blocks(
        out.video ? views.video(out.video, out.title) : out.image ? views.image(out.image, out.title) : null,
        views.copy('Prompt', out.prompt),
        out.sample ? views.text(out.note) : usageBlocks(out),
      );
    },
    viewMany(outs) {
      const ok = outs.filter((o) => o && !o.error);
      const sample = ok.some((o) => o.sample);
      return views.blocks(
        views.cards(ok.map((o, i) => ({ title: o.title || `Shot ${i + 1}`, subtitle: o.sample ? 'Sample' : o.made, body: o.prompt, image: o.poster || o.image || undefined }))),
        ...ok.map((o) => (o.video ? views.video(o.video, o.title) : null)),
        sample ? views.text('Samples: AI models aren\'t switched on yet. Each card shows the words the model gets.') : null,
        ...usageOnce(ok),
      );
    },
  };
}

module.exports = { makeTool, familyOf, shotOf, promptFor, readAsset, keepVideo, usageBlocks, noPersonUnlessOk, CONSENT_TEXT, ASPECTS, MEDIA_KEYS, PROVIDER };
