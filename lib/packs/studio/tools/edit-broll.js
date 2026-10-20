// B-roll over a talking video: Library clips or photos (or the clips Make an AI clip made) laid over
// the picture at set times, or spread evenly, while the voice keeps playing. Photos pan slowly.

const { media, text, views } = require('../../_kit');
const E = require('../lib/edit');
const T = require('../lib/edit-tools');
const P = require('../lib/provenance');

// One b-roll item to { ref, at, seconds, title }: a Library id, a saved file, a make_clip or
// make_image output ({ video, image, at, seconds, title }) or { file, at, seconds }.
function itemOf(x) {
  if (!x || (typeof x === 'object' && x.error)) return null;
  if (typeof x === 'string') return T.assetId(x) ? { ref: x, at: null, seconds: null, title: '' } : null;
  if (typeof x !== 'object') return null;
  const ref = [x.video, x.image, x.file, x.clip].find((v) => T.assetId(v)) || (x.id && x.name ? x : null);
  if (!ref) return null;
  const at = x.at === null || x.at === '' || x.at === undefined || !Number.isFinite(Number(x.at)) ? null : Number(x.at);
  return { ref, at, seconds: Number(x.seconds) || null, title: text.oneLine(x.title || ''), sample: !!x.sample };
}

module.exports = {
  name: 'studio.edit_broll',
  title: 'Add b-roll clips',
  description: 'Lays your clips or photos over a talking video at the times you pick (or spread evenly), each filling the frame for a few seconds while your voice keeps playing. Photos pan slowly so nothing sits still.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  lane: 'render',
  credits: 6,
  timeoutSec: 900,
  input: {
    type: 'object',
    properties: {
      video: T.VIDEO,
      chain: T.CHAIN,
      clips: { type: 'array', title: 'Clips or photos to put over it', description: 'Library files, or the clips from Make an AI clip (each with at and seconds). Without times they are spread evenly.', items: { type: ['string', 'object'] }, maxItems: 12 },
      at: { type: 'array', title: 'Times in seconds (optional, one per clip)', items: { type: 'number', minimum: 0 }, maxItems: 12 },
      seconds: { type: 'number', title: 'Seconds each clip shows', minimum: 1, maximum: 8, default: 2.5 },
      keepAudio: { type: 'boolean', title: 'Keep your voice over the clips', default: true },
    },
    required: ['clips'],
  },
  output: { type: 'object', properties: { ...T.VIDEO_OUT, inserted: { type: 'array' }, skipped: { type: 'integer' } } },
  async run(input, ctx) {
    const raw = Array.isArray(input.clips) ? input.clips : [];
    const items = raw.map(itemOf).filter(Boolean);
    if (!media.canRender(ctx)) return T.offOutput({ inserted: [] });
    if (!items.length) {
      if (raw.length) return { note: 'None of the b-roll clips were made (the AI video models are off here), so the video is unchanged. Add your own clips from your Library to use them.', sample: true, inserted: [], skipped: raw.length };
      throw new Error('Add at least one clip or photo to put over your video.');
    }
    const src = await T.sourceVideo(ctx, input);
    const clips = [];
    let unreadable = 0;
    let anyAi = src.ai;
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      let a = null;
      try {
        a = await T.readAsset(ctx, it.ref, 'One of the b-roll files');
      } catch {
        a = null;
      }
      if (!a) {
        unreadable++;
        continue;
      }
      const at = Array.isArray(input.at) && Number.isFinite(Number(input.at[k])) ? Number(input.at[k]) : it.at;
      if (P.isAi(a.path)) anyAi = true;
      clips.push({ path: a.path, at, seconds: Math.min(input.seconds || 2.5, it.seconds || 99), title: it.title });
    }
    if (!clips.length) throw new Error("The b-roll files couldn't be opened. Add them to your Library again and rerun.");
    const r = await E.insertBroll(ctx, src.path, clips, { keepAudio: input.keepAudio !== false });
    const saved = await T.saveVideo(ctx, r, { base: T.baseName(ctx, input, 'with-broll', src.sample), sample: src.sample || items.every((x) => x.sample), ai: anyAi });
    ctx.log(`${r.inserted.length} b-roll ${r.inserted.length === 1 ? 'clip' : 'clips'} added`);
    const notes = [];
    if (unreadable) notes.push(`${unreadable === 1 ? 'One clip' : `${unreadable} clips`} couldn't be opened, so the video uses the rest.`);
    if (r.inserted.length < clips.length) notes.push('Clips that would overlap or run past the end were left out.');
    return { ...saved, inserted: r.inserted, skipped: raw.length - r.inserted.length, ...(notes.length ? { note: notes.join(' ') } : {}) };
  },
  view(out) {
    if (!out.video) return [views.text(out.note || 'Nothing was rendered.')];
    return T.videoView(out, {
      metric: ['B-roll clips', (out.inserted || []).length, (out.inserted || []).map((c) => `${Math.round(c.at * 10) / 10} s`).join(', ')],
      caption: 'With b-roll',
    });
  },
};
