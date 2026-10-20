// Image ads in every size from one picture and its words: 1080x1080 and 1080x1350 for feeds,
// 1080x1920 for Stories and Reels (words kept inside the safe zone), 1200x628 for link ads and
// 1920x1080 wide. The picture is darkened under the words until white text reads at 4.5:1 or better.
// Feed it the ads desk's angles (ads.find_angles) and one picture per angle for a set per angle.

const fs = require('fs');
const { media, views, text, save, files, money, brain } = require('../../_kit');
const E = require('../lib/edit');
const T = require('../lib/edit-tools');
const A = require('../lib/edit-ads');
const P = require('../lib/provenance');

const imageOf = (x) => (x && typeof x === 'object' ? [x.image, x.file, x.poster].find((v) => T.assetId(v)) || (x.id && x.name ? x : null) : T.assetId(x) ? x : null);

module.exports = {
  name: 'studio.ad_sizes',
  title: 'Ad images in every size',
  description: 'Turns a picture and its words (headline, a short line, a button) into PNG ads in 1080x1080, 1080x1350, 1080x1920 (Stories safe zone kept clear), 1200x628 and 1920x1080, with the picture darkened just enough for the words to read. Give it ad angles and one picture each for a set per angle, all in one zip.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  credits: 4,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      image: { type: ['string', 'object'], format: 'asset', accept: 'image/*', title: 'Your picture (optional)' },
      headline: { type: 'string', title: 'Headline', maxLength: 90 },
      sub: { type: 'string', title: 'A short line under it (optional)', maxLength: 120 },
      button: { type: 'string', title: 'Button text', maxLength: 24, default: 'Learn more' },
      scenes: { type: 'array', title: 'Pictures from Make a picture (one per angle)', items: { type: ['object', 'string'] }, maxItems: 6 },
      angles: { type: 'array', title: 'Ad angles (from Find ad angles)', items: { type: 'object' }, maxItems: 6 },
      product: { type: 'string', title: 'What it is', maxLength: 120 },
      price: { type: 'number', title: 'Price (optional)', minimum: 0 },
      color: T.COLOR,
      sizes: { type: 'array', title: 'Sizes', items: { type: 'string', enum: A.SIZES.map((s) => `${s.w}x${s.h}`) }, maxItems: 5 },
    },
  },
  output: {
    type: 'object',
    properties: { sets: { type: 'array' }, files: { type: 'array' }, zip: { type: 'object' }, sheet: { type: 'object' }, aiMade: { type: 'boolean' }, note: { type: 'string' }, sample: { type: 'boolean' } },
    required: ['sets'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const angles = (Array.isArray(input.angles) ? input.angles : []).filter((a) => a && typeof a === 'object' && !a.error);
    const scenes = (Array.isArray(input.scenes) ? input.scenes : []).filter((s) => s && !s.error);
    const product = text.oneLine(input.product || b.offer || b.what || '');
    const priceLine = input.price != null && input.price > 0 ? money.usd(input.price).replace(/\.00$/, '') : '';
    const sub = text.clip(text.oneLine(input.sub || [text.clip(product, 70), priceLine].filter(Boolean).join(', ')), 120);
    // One set per scene (or per angle), else one set from the picture and headline given.
    const n = Math.max(scenes.length, angles.length, 1);
    const plan = [];
    for (let k = 0; k < Math.min(6, n); k++) {
      const sc = scenes[k] || null;
      const ang = angles[k] || null;
      const headline = text.clip(text.oneLine(input.headline && n === 1 ? input.headline : (ang && ang.hook) || (sc && (sc.hook || sc.title)) || input.headline || product || b.name || ''), 90);
      plan.push({ n: k + 1, headline, angle: ang ? text.oneLine(ang.name || ang.key || '') : '', image: imageOf(sc) || (k === 0 || !scenes.length ? input.image : null), sample: !!(sc && sc.sample) });
    }
    if (!plan.some((p) => p.headline)) throw new Error('Write the headline for the ad first.');
    if (!media.canRender(ctx)) return { sets: plan.map((p) => ({ n: p.n, headline: p.headline, angle: p.angle })), note: 'Image tools are off on this server, so nothing was rendered.', sample: true };
    const brand = T.brandOf(ctx, input);
    const button = text.clip(text.oneLine(input.button || 'Learn more'), 24);
    const base = T.baseName(ctx, input, 'ad', plan.every((p) => p.sample) && plan.length > 0 && plan[0].sample);
    const zipItems = [];
    const thumbs = [];
    const sets = [];
    const saved = [];
    let unreadable = 0;
    let anyAi = false;
    for (const p of plan) {
      if (!p.headline) continue;
      let pic = null;
      if (p.image) {
        try {
          pic = await T.readAsset(ctx, p.image, 'That picture');
        } catch {
          pic = null;
          unreadable++;
        }
      }
      const r = await E.adSizes(ctx, { image: pic ? pic.path : null, headline: p.headline, sub, button, sizes: input.sizes, name: brand.name, look: brand.look, sample: p.sample });
      const prefix = plan.length > 1 ? `${base}-${p.n}` : base;
      // Tagged with where the picture came from (lib/provenance): an AI-made picture makes the ad a
      // composite with AI media, the member's own photo (or brand colors) a plain composite.
      const ai = !!(pic && P.isAi(pic.path));
      if (ai) anyAi = true;
      const source = P.editSource(ai);
      for (const f of r.files) {
        const name = `${prefix}-${f.width}x${f.height}.png`;
        const data = P.tag(fs.readFileSync(f.path), { source });
        zipItems.push({ name, data });
        if (plan.length === 1 || (f.width === 1080 && f.height === 1080)) saved.push({ set: p.n, label: f.label, size: `${f.width}x${f.height}`, file: await save.saveFile(ctx, name, data) });
        thumbs.push({ set: p.n, f });
      }
      sets.push({ n: p.n, headline: p.headline, angle: p.angle, picture: pic ? 'yours' : 'brand colors', contrast: Math.min(...r.files.map((f) => f.contrast)), darken: Math.max(...r.files.map((f) => f.darken)), sample: p.sample });
    }
    zipItems.push({ name: 'read-me.txt', data: Buffer.from(readMe(sets)) });
    const zip = await save.saveFile(ctx, `${base}-sizes.zip`, files.zip(zipItems));
    const sheet = await P.saveMedia(ctx, `${base}-sheet.png`, await sheetPng(ctx, thumbs, sets.length), { source: P.editSource(anyAi) });
    ctx.log(`${sets.length} ${sets.length === 1 ? 'set' : 'sets'} of ad images, ${zipItems.length - 1} PNGs`);
    const notes = [];
    if (unreadable) notes.push(`${unreadable === 1 ? 'One picture' : `${unreadable} pictures`} didn't open, so those ads use your brand colors behind the words.`);
    return { sets, files: saved, zip, sheet, ...(anyAi ? { aiMade: true } : {}), ...(notes.length ? { note: notes.join(' ') } : {}), sample: sets.length > 0 && sets.every((s) => s.sample) };
  },
  view(out) {
    if (!out.zip) return [views.text(out.note || 'Nothing was rendered.')];
    return views.blocks(
      views.metric('Ad images', out.sets.length * 5, `${out.sets.length === 1 ? 'one set' : `${out.sets.length} sets`} in 5 sizes, words at ${Math.min(...out.sets.map((s) => s.contrast))}:1 contrast or better`),
      views.image(out.sheet, 'Every size at a glance'),
      views.table([{ key: 'n', label: '#', format: 'number' }, { key: 'angle', label: 'Angle' }, { key: 'headline', label: 'Headline' }, { key: 'contrast', label: 'Contrast', format: 'number' }], out.sets),
      views.file(out.zip, 'All sizes (zip of PNGs)'),
      (out.files || []).slice(0, 6).map((f) => views.file(f.file, `${f.label} ${f.size}${out.sets.length > 1 ? `, set ${f.set}` : ''}`)),
      out.aiMade ? views.text(T.AI_LINE) : null,
      out.note ? views.text(out.note) : null,
      out.sample ? views.text('Made on sample pictures. Add your own photo for real ads.') : null,
    );
  },
};

function readMe(sets) {
  return [
    'Your ad images',
    '',
    ...A.SIZES.map((s) => `${s.w}x${s.h}: ${s.label}`),
    '',
    'The 1080x1920 version keeps the words out of the top 14%, the bottom 35% and 6% on each side, where Instagram and Facebook Stories put their buttons (Meta Stories ad guide).',
    'The picture is darkened under the words until white text has at least a 4.5 to 1 contrast with it.',
    '',
    ...sets.map((s) => `Set ${s.n}${s.angle ? ` (${s.angle})` : ''}: ${s.headline}`),
    '',
  ].join('\n');
}

// Every ad small on one sheet: one row per set, the five sizes side by side.
async function sheetPng(ctx, thumbs, rows) {
  const rowH = 300;
  const gap = 24;
  const tiles = [];
  for (const t of thumbs) {
    const h = rowH;
    const w = Math.round((t.f.width / t.f.height) * h);
    const { stdout } = await media.ffmpeg(['-i', t.f.path, '-vf', `scale=${w}:${h}`, '-q:v', '4', '-frames:v', '1', '-f', 'mjpeg', '-'], { timeoutSec: 60, signal: ctx.signal });
    tiles.push({ ...t, w, h, jpg: stdout });
  }
  const rowsOf = [...new Set(tiles.map((t) => t.set))];
  const width = Math.max(...rowsOf.map((r) => tiles.filter((t) => t.set === r).reduce((s, t) => s + t.w + gap, gap)));
  const height = rowsOf.length * (rowH + gap) + gap;
  const body = [];
  rowsOf.forEach((r, i) => {
    let x = gap;
    for (const t of tiles.filter((y) => y.set === r)) {
      body.push(`<image x="${x}" y="${gap + i * (rowH + gap)}" width="${t.w}" height="${t.h}" href="data:image/jpeg;base64,${t.jpg.toString('base64')}"/>`);
      x += t.w + gap;
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f4f4f5"/>${body.join('')}</svg>`;
  return media.svgToPng(ctx, svg, { width, height });
}
