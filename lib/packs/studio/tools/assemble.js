// Puts a finished video together from the scenes earlier steps made (AI clips, pictures, a talking
// clip, or Library files): clips fill the frame, pictures move gently, a voiceover with word-by-word
// captions, a music bed that dips under the voice, the hook title up top and a brand end card.
// Used by the studio's generation workflows (product ad, UGC ad, faceless video, video ads).

const { media, views, text } = require('../../_kit');
const E = require('../lib/edit');
const M = require('../lib/edit-media');
const C = require('../lib/edit-captions');
const T = require('../lib/edit-tools');
const P = require('../lib/provenance');

// One scene to { ref, kind, seconds, hook, sample }, from a make_clip / make_image / make_talking
// output, a saved file, a Library id or { file, seconds, kind }. Skips { error } items and items
// with no file (a sample on a server without ffmpeg).
function sceneOf(x) {
  if (!x || (typeof x === 'object' && x.error)) return null;
  if (typeof x === 'string') return T.assetId(x) ? { ref: x, kind: null, seconds: null, hook: '', sample: false } : null;
  if (typeof x !== 'object') return null;
  const vid = T.assetId(x.video) ? x.video : null;
  const img = T.assetId(x.image) ? x.image : null;
  const file = T.assetId(x.file) ? x.file : null;
  const ref = vid || img || file || (x.id && x.name ? x : null);
  if (!ref) return null;
  const type = String((ref && ref.type) || x.type || '');
  const kind = vid ? 'video' : img ? 'image' : x.kind === 'image' || /^image\//.test(type) ? 'image' : x.kind === 'video' || /^video\//.test(type) ? 'video' : null;
  return { ref, kind, seconds: Number(x.seconds) || null, hook: text.oneLine(x.hook || ''), title: text.oneLine(x.title || ''), sample: !!x.sample };
}

module.exports = {
  name: 'studio.assemble',
  title: 'Put the video together',
  description: 'Joins clips and pictures into one finished video in the shape you pick: pictures move gently, a voiceover with word-by-word captions, a music bed that dips under the voice, the hook title on the first seconds and a brand end card.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  lane: 'render',
  credits: 6,
  timeoutSec: 900,
  input: {
    type: 'object',
    properties: {
      scenes: { type: ['array', 'object', 'string'], title: 'Scenes (clips or pictures, in order)', description: 'The outputs of Make an AI clip or Make a picture, or Library files.' },
      voice: { type: ['string', 'object', 'null'], format: 'asset', accept: 'audio/*', title: 'Voiceover (optional)' },
      words: { type: ['array', 'null'], title: 'Word times of the voiceover', description: '[{ w, s, e }] from video.voice, or from video.transcribe.' },
      keepAudio: { type: 'boolean', title: "Use the clips' own sound as the voice (a talking clip)", default: false },
      hook: { type: ['string', 'boolean', 'null'], title: 'Hook title (optional)', description: 'Leave it out to use the first scene\'s hook, if it has one; false for none.' },
      captions: { type: 'string', title: 'Captions', enum: ['none', ...C.STYLES], default: 'bold' },
      music: { type: 'boolean', title: 'Music bed', default: true },
      musicFile: { type: ['string', 'object', 'null'], format: 'asset', accept: 'audio/*', title: 'Your own music (optional)' },
      outro: { type: 'boolean', title: 'Brand end card', default: true },
      aspect: { type: 'string', title: 'Shape', enum: M.ASPECTS, default: '9:16' },
      product: { type: 'string', title: 'What it is (for the end card)', maxLength: 120 },
      name: { type: 'string', title: 'Business name (optional, we use your profile)', maxLength: 60 },
      handle: { type: 'string', title: 'Your @handle (optional)', maxLength: 40 },
      color: T.COLOR,
      maxSeconds: { type: 'integer', title: 'Longest video', minimum: 5, maximum: 120, default: 60 },
      labels: T.LABELS,
      ugc: { type: 'boolean', title: 'A UGC-style ad (an AI actor talking like a customer)', default: false },
    },
    required: ['scenes'],
  },
  output: {
    type: 'object',
    properties: { ...T.VIDEO_OUT, aspect: { type: 'string' }, scenes: { type: 'integer' }, hook: { type: 'string' }, captions: { type: ['string', 'null'] }, ugc: { type: 'boolean' } },
  },
  async run(input, ctx) {
    const raw = Array.isArray(input.scenes) ? input.scenes : input.scenes ? [input.scenes] : [];
    const items = raw.map(sceneOf).filter(Boolean).slice(0, 12);
    const aspect = M.ASPECTS.includes(input.aspect) ? input.aspect : '9:16';
    const firstHook = items.find((s) => s.hook);
    const hook = input.hook === false ? '' : typeof input.hook === 'string' && input.hook.trim() ? text.clip(text.oneLine(input.hook), 90) : firstHook ? text.clip(firstHook.hook, 90) : '';
    if (!media.canRender(ctx)) return T.offOutput({ aspect, hook });
    if (!items.length) return { note: 'No clips or pictures were made in the steps before (the AI models are off here), so there is nothing to put together yet.', aspect, hook, sample: true };
    const scenes = [];
    const labels = T.labelsOf(input);
    // Any AI-made part (a scene tagged as AI-made, or an AI person or voice) makes the video a
    // composite with AI media (lib/provenance).
    let anyAi = T.anyLabel(labels);
    let unreadable = 0;
    for (const it of items) {
      let a = null;
      try {
        a = await T.readAsset(ctx, it.ref, 'One of the scenes');
      } catch {
        a = null;
      }
      if (!a) {
        unreadable++;
        continue;
      }
      const kind = it.kind || (/^image\//.test(a.type || '') || M.isStill(a.path) ? 'image' : 'video');
      if (P.isAi(a.path)) anyAi = true;
      scenes.push({ path: a.path, kind, seconds: it.seconds });
    }
    if (!scenes.length) throw new Error("The clips couldn't be opened. Make them again and rerun.");
    const voice = T.assetId(input.voice) ? await T.readAsset(ctx, input.voice, 'The voiceover').catch(() => null) : null;
    const music = input.music === false ? false : T.assetId(input.musicFile) ? (await T.readAsset(ctx, input.musicFile, 'Your music file')).path : true;
    const brand = T.brandOf(ctx, input);
    const sample = items.some((s) => s.sample);
    const outro = input.outro === false ? null : { name: brand.name || text.clip(text.oneLine(input.product || ''), 60) || 'Thanks for watching', line: text.clip(text.oneLine(input.product || '') || brand.line, 70), handle: brand.handle };
    const style = input.captions && input.captions !== 'none' ? input.captions : null;
    const r = await E.assemble(ctx, {
      scenes,
      voice: voice ? voice.path : null,
      words: Array.isArray(input.words) ? input.words : [],
      keepAudio: input.keepAudio === true,
      music,
      hook: hook || null,
      captions: style,
      outro,
      aspect,
      maxSeconds: input.maxSeconds || 60,
      look: brand.look,
      sample,
      labels,
    });
    const what = text.clip(text.oneLine(input.product || hook || 'video'), 40);
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, `${what}-${aspect.replace(':', 'x')}`, sample), sample, at: Math.min(1.2, r.seconds / 3), ai: anyAi });
    const notes = [];
    if (unreadable) notes.push(`${unreadable === 1 ? 'One scene' : `${unreadable} scenes`} couldn't be opened, so the video uses the rest.`);
    if (style && !r.captions) notes.push('No captions: there was no voiceover with word times to caption.');
    if (input.voice && !voice) notes.push("The voiceover couldn't be opened, so this video has music only.");
    ctx.log(`Put together ${r.scenes} scenes into a ${Math.round(r.seconds)} s ${aspect} video`);
    return { ...saved, aspect, scenes: r.scenes, hook, captions: r.captions, labels: r.labels, ...(input.ugc === true ? { ugc: true } : {}), ...(notes.length ? { note: notes.join(' ') } : {}) };
  },
  view(out) {
    if (!out.video) return [views.text(out.note || 'Nothing was rendered.')];
    return T.videoView(out, { caption: `${out.hook ? `${out.hook} ` : ''}(${out.aspect}, ${Math.round(out.seconds)} s)`, sampleLine: T.SAMPLE_MADE });
  },
  viewMany(outs) {
    const ok = outs.filter((o) => o && o.video);
    if (!ok.length) return [views.text((outs.find((o) => o && o.note) || {}).note || 'Nothing was rendered.')];
    return views.blocks(
      views.metric('Videos ready', ok.length, ok[0].aspect),
      ok.map((o) => views.video(o.video, `${o.hook || 'Video'} (${Math.round(o.seconds)} s)`)),
      ok.map((o) => views.file(o.video, `${o.hook || 'Video'} MP4 (${o.mb} MB)`)),
      T.aiLines(ok.find((o) => (o.labels && o.labels.length) || o.ugc) || ok.find((o) => o.aiMade) || {}).map((l) => views.text(l)),
      ok.some((o) => o.sample) ? views.text(T.SAMPLE_MADE) : null,
    );
  },
};
