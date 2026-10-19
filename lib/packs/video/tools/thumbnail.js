// Make thumbnails: three designs for one video (full photo, split, color block), wide for YouTube
// (1920 x 1080 JPG, under 2 MB so it uploads from a phone too) and tall for Shorts, Reels and TikTok
// covers (1080 x 1920). Big words with one in the pop color, your photo or a frame of your video,
// and a sheet that shows each design at phone size so you can pick the one that still reads.
// With `items` (a set of videos), one design for all of them, so the channel looks like one channel,
// and a sheet of the covers side by side.

const fs = require('fs');
const path = require('path');
const { media, views, save, text, files } = require('../../_kit');
const { bizOf } = require('../lib/sample');
const { lookFor } = require('../lib/look');
const { assetFile, isImage, isVideo } = require('../lib/assets');
const TH = require('../lib/thumbs');

const MAX_JPG = 2 * 1024 * 1024;
// From YouTube Help, "Add video thumbnails" (support.google.com/youtube/answer/72431), read 2026-10-19.
const HOW = {
  wide: 'YouTube: add it under Thumbnail when you upload, or later in YouTube Studio. Custom thumbnails need a verified YouTube account. The bottom right is left clear for the video length.',
  tall: 'YouTube Shorts: custom Shorts thumbnails can only be added in YouTube Studio on a computer, with a verified account. On other apps, use it where the app lets you add a cover image.',
};

// The photo, as a JPEG no wider than 2400 px (a video gives the frame a third of the way in).
async function photoOf(ctx, input, dir) {
  if (!input.image) return null;
  const a = await assetFile(ctx, input.image).catch(() => null);
  if (!a) throw new Error("That picture isn't in your Library anymore. Add it again, or leave it out.");
  if (!(isImage(a) || isVideo(a))) throw new Error('The picture should be a photo (JPG, PNG or WebP) or a video.');
  // ffmpeg's own words about a file it can't read mean nothing to a member, so say it plainly, as Load the video does.
  // A stop and a timeout keep their own messages.
  const plain = (e) =>
    /^Stopped\.?$/.test(String(e && e.message)) || (e && e.code === 'ETIMEDOUT')
      ? e
      : new Error(isVideo(a) ? "That video doesn't open. Export it as MP4 and try again, or use a photo." : "That picture doesn't open. Save it as a JPG or PNG and try again, or leave it out.");
  let src = a.path;
  if (isVideo(a)) {
    const info = await media.probe(a.path, { signal: ctx.signal }).catch((e) => {
      throw plain(e);
    });
    if (!info.hasVideo) throw new Error('That video has no picture to take a frame from.');
    const jpg = await media.frame(ctx, a.path, { at: Math.max(0, (info.duration || 0) * 0.33), format: 'jpg', quality: 2 }).catch((e) => {
      throw plain(e);
    });
    src = path.join(dir, 'frame.jpg');
    fs.writeFileSync(src, jpg);
  }
  const out = path.join(dir, 'photo.jpg');
  await media.ffmpeg(['-i', src, '-frames:v', '1', '-vf', "scale='min(2400,iw)':-2", '-q:v', '3', out], { timeoutSec: 60, signal: ctx.signal }).catch((e) => {
    throw plain(e);
  });
  return fs.readFileSync(out);
}

// A file name from a title, cut at a word: "saturn-in-60-seconds-the-planet".
function baseName(s) {
  const full = text.slug(s, 120) || 'thumbnail';
  if (full.length <= 44) return full;
  const cut = full.slice(0, 45);
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : 44);
}

// PNG to JPEG under 2 MB.
async function toJpg(ctx, png, dir, name) {
  const src = path.join(dir, `${name}.png`);
  fs.writeFileSync(src, png);
  for (const q of [2, 4, 7, 10]) {
    const out = path.join(dir, `${name}.jpg`);
    await media.ffmpeg(['-i', src, '-q:v', String(q), out], { timeoutSec: 60, signal: ctx.signal });
    const buf = fs.readFileSync(out);
    if (buf.length <= MAX_JPG) return buf;
  }
  throw new Error('That thumbnail came out over 2 MB. Try a simpler photo.');
}

async function scaled(ctx, png, w, h, dir, name) {
  const src = path.join(dir, `${name}-in.png`);
  const out = path.join(dir, `${name}-${w}.png`);
  fs.writeFileSync(src, png);
  await media.ffmpeg(['-i', src, '-vf', `scale=${w}:${h}:flags=lanczos`, out], { timeoutSec: 60, signal: ctx.signal });
  return fs.readFileSync(out);
}

module.exports = {
  name: 'video.thumbnail',
  title: 'Make thumbnails',
  description: 'Makes three thumbnail designs for one video with big words, one in your pop color, on your photo or a frame of your video: wide for YouTube (1920 x 1080 JPG under 2 MB) and tall for Shorts, Reels and TikTok covers, plus a sheet showing each at phone size.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  credits: 4,
  timeoutSec: 240,
  input: {
    type: 'object',
    properties: {
      text: { type: 'string', title: 'Words on the thumbnail (2 to 5 is best)', maxLength: 60 },
      title: { type: 'string', title: 'Video title (optional)', maxLength: 100 },
      sub: { type: 'string', title: 'Small label on top (optional)', maxLength: 24 },
      image: { type: ['string', 'object', 'null'], title: 'Your photo or video (optional)', description: 'A Library file' },
      color: { type: 'string', title: 'Brand color (optional hex)', maxLength: 9 },
      shape: { type: 'string', title: 'Shape', enum: ['wide', 'tall', 'both'], default: 'wide' },
      name: { type: 'string', title: 'File name (optional)', maxLength: 60 },
      items: { type: 'array', title: 'A set of videos (optional)', description: 'Up to 12, each { text, title } or just the words: one cover each, in one design', items: { type: ['object', 'string'] }, maxItems: 12 },
      design: { type: 'string', title: 'Design for a set', enum: ['split', 'block', 'photo'], default: 'split' },
    },
  },
  output: {
    type: 'object',
    properties: {
      pick: { type: ['object', 'null'] },
      sheet: { type: ['object', 'null'] },
      zip: { type: ['object', 'null'] },
      designs: { type: 'array' },
      words: { type: 'string' },
      shape: { type: 'string' },
      photo: { type: 'boolean' },
      notes: { type: 'array' },
      count: { type: 'integer' },
      sample: { type: 'boolean' },
    },
    required: ['designs', 'words'],
  },
  async run(input, ctx) {
    if (Array.isArray(input.items) && input.items.some(Boolean)) return runSet(input, ctx);
    const said = text.oneLine(input.text || input.title || '');
    if (!said) throw new Error('Add the words for the thumbnail, like "Saturn could float".');
    const { words, key } = TH.wordsOf(said);
    const notes = [];
    if (words.length > 6) notes.push(`That is ${words.length} words. Thumbnails read best with 2 to 5: the title can say the rest.`);
    if (input.title && text.oneLine(input.title).toLowerCase() === said.toLowerCase() && words.length > 4) notes.push('The words repeat the title. Shorter words that add something to the title usually work better.');
    const b = bizOf(ctx, input);
    const look = lookFor(ctx, input, b);
    const shape = ['wide', 'tall', 'both'].includes(input.shape) ? input.shape : 'wide';
    const shapes = shape === 'both' ? ['wide', 'tall'] : [shape];
    if (!media.canRender(ctx)) return { pick: null, sheet: null, zip: null, designs: TH.DESIGNS.map((d) => d.label), words: words.join(' '), shape, photo: false, notes: ['Image tools are off on this server, so no thumbnail was made.'], sample: true };
    const dir = media.scratch(ctx, 'thumb');
    const img = await photoOf(ctx, input, dir);
    // With a photo, the full-photo design leads; without one, the split and color block read better.
    const order = img ? ['photo', 'split', 'block'] : ['split', 'block', 'photo'];
    const designs = order.map((id) => ({ ...TH.DESIGNS.find((d) => d.id === id) })).map((d) => (d.id === 'photo' && !img ? { ...d, label: 'Dark' } : d));
    const base = baseName(input.name || input.title || said);
    const zipEntries = [];
    const tiles = [];
    let pick = null;
    for (const [n, d] of designs.entries()) {
      const tile = { label: d.label };
      for (const sh of shapes) {
        const [W, H] = TH.SIZES[sh];
        const png = await media.svgToPng(ctx, TH.design(d.id, sh, { words, key, sub: text.oneLine(input.sub || ''), img, look }), { width: W, height: H });
        const jpg = await toJpg(ctx, png, dir, `${d.id}-${sh}`);
        zipEntries.push({ name: `${base}-${n + 1}-${d.id}-${sh === 'wide' ? '1920x1080' : '1080x1920'}.jpg`, data: jpg });
        if (n === 0 && !pick) pick = { jpg, sh };
        const S = TH.SHEET[shape];
        if (sh === 'wide') {
          tile.wideBig = await scaled(ctx, png, S.big[0], S.big[1], dir, `${d.id}-wb`);
          tile.wideSmall = await scaled(ctx, png, S.small[0], S.small[1], dir, `${d.id}-ws`);
        } else {
          const big = shape === 'tall' ? S.big : S.tall;
          tile.tallBig = await scaled(ctx, png, big[0], big[1], dir, `${d.id}-tb`);
          if (shape === 'tall') tile.tallSmall = await scaled(ctx, png, S.small[0], S.small[1], dir, `${d.id}-ts`);
        }
      }
      tiles.push(tile);
    }
    const sheetDoc = TH.sheetSvg({ title: input.title || said, tiles, look, shape });
    const sheetPng = await media.svgToPng(ctx, sheetDoc.svg, { width: sheetDoc.W, height: sheetDoc.H });
    const sizeName = pick.sh === 'wide' ? '1920x1080' : '1080x1920';
    const pickAsset = await save.saveFile(ctx, `${base}-thumbnail-${sizeName}.jpg`, pick.jpg);
    const sheet = await save.saveFile(ctx, `${base}-thumbnails-sheet.png`, sheetPng);
    zipEntries.push({ name: 'read-me.txt', data: Buffer.from(readMe({ words: words.join(' '), designs, shapes, sub: input.sub })) });
    const zip = await save.saveFile(ctx, `${base}-thumbnails.zip`, files.zip(zipEntries));
    ctx.log(`${designs.length} designs in ${shapes.join(' and ')}${img ? ', on your picture' : ''}; top pick ${designs[0].label.toLowerCase()} (${(pick.jpg.length / 1024).toFixed(0)} KB)`);
    return { pick: pickAsset, sheet, zip, designs: designs.map((d) => d.label), words: words.join(' '), shape, photo: !!img, notes, sample: !!ctx.sample };
  },
  view(out) {
    if (!out.pick) return [views.text((out.notes && out.notes[0]) || 'No thumbnail was made.')];
    if (out.count) {
      return views.blocks(
        views.image(out.pick, `Cover 1: ${out.words}`),
        views.image(out.sheet, `All ${out.count} covers side by side, as on your profile`),
        views.file(out.zip, `All ${out.count} covers, full size (.zip)`),
        (out.notes || []).map((n) => views.text(n)),
        views.text(out.shape === 'wide' ? HOW.wide : HOW.tall),
      );
    }
    return views.blocks(
      views.image(out.pick, `Top pick: ${out.designs[0]}`),
      views.image(out.sheet, 'All three designs, and how they look at phone size'),
      views.file(out.zip, `All ${out.designs.length} designs, full size (.zip)`),
      (out.notes || []).map((n) => views.text(n)),
      views.text(out.shape === 'tall' ? HOW.tall : out.shape === 'both' ? `${HOW.wide} ${HOW.tall}` : HOW.wide),
    );
  },
};

// A set: one cover per video in one design. Files: the first cover, a sheet of all of them, a zip.
async function runSet(input, ctx) {
  const items = input.items
    .filter(Boolean)
    .slice(0, 12)
    .map((it) => (typeof it === 'string' ? { text: it } : it))
    .map((it) => ({ text: text.oneLine(it.text || it.words || it.title || ''), title: text.oneLine(it.title || '') }))
    .filter((it) => it.text);
  if (!items.length) throw new Error('Add the words for each cover.');
  const b = bizOf(ctx, input);
  const look = lookFor(ctx, input, b);
  const shape = input.shape === 'wide' ? 'wide' : 'tall';
  const designId = ['split', 'block', 'photo'].includes(input.design) ? input.design : 'split';
  const label = TH.DESIGNS.find((d) => d.id === designId).label;
  if (!media.canRender(ctx)) return { pick: null, sheet: null, zip: null, designs: [label], words: items[0].text, shape, photo: false, notes: ['Image tools are off on this server, so no cover was made.'], count: 0, sample: true };
  const dir = media.scratch(ctx, 'covers');
  const img = await photoOf(ctx, input, dir);
  const [W, H] = TH.SIZES[shape];
  const sizeName = shape === 'wide' ? '1920x1080' : '1080x1920';
  const tile = TH.gridTile(shape);
  const base = baseName(input.name || 'covers');
  const zipEntries = [];
  const tiles = [];
  const long = [];
  let pick = null;
  for (const [i, it] of items.entries()) {
    const { words, key } = TH.wordsOf(it.text);
    if (words.length > 6) long.push(i + 1);
    const png = await media.svgToPng(ctx, TH.design(designId, shape, { words, key, sub: text.oneLine(input.sub || ''), img, look }), { width: W, height: H });
    const jpg = await toJpg(ctx, png, dir, `c${i}`);
    if (!pick) pick = jpg;
    zipEntries.push({ name: `${String(i + 1).padStart(2, '0')}-${baseName(it.title || it.text)}-${sizeName}.jpg`, data: jpg });
    tiles.push({ png: await scaled(ctx, png, tile.w, tile.h, dir, `t${i}`), label: words.join(' ') });
  }
  const grid = TH.gridSvg({ title: input.title || input.name || `${items.length} videos`, tiles, shape });
  const sheetPng = await media.svgToPng(ctx, grid.svg, { width: grid.W, height: grid.H });
  const notes = [];
  if (long.length) notes.push(`Cover${long.length > 1 ? 's' : ''} ${long.join(', ')} ${long.length > 1 ? 'have' : 'has'} more than 6 words. Covers read best with 2 to 5: the title can say the rest.`);
  zipEntries.push({ name: 'read-me.txt', data: Buffer.from([`${items.length} covers, ${label.toLowerCase()} design, ${shape === 'wide' ? '1920 x 1080' : '1080 x 1920'} JPG, each under 2 MB.`, '', ...items.map((it, i) => `${i + 1}. ${it.text}${it.title ? ` (${it.title})` : ''}`), '', shape === 'wide' ? HOW.wide : HOW.tall].join('\n')) });
  const pickAsset = await save.saveFile(ctx, `${base}-cover-1-${sizeName}.jpg`, pick);
  const sheet = await save.saveFile(ctx, `${base}-covers-sheet.png`, sheetPng);
  const zip = await save.saveFile(ctx, `${base}-covers.zip`, files.zip(zipEntries));
  ctx.log(`${items.length} covers in the ${label.toLowerCase()} design, ${sizeName}`);
  return { pick: pickAsset, sheet, zip, designs: [label], words: items[0].text, shape, photo: !!img, notes, count: items.length, sample: !!ctx.sample };
}

function readMe({ words, designs, shapes, sub }) {
  return [
    `Thumbnails for: ${words}`,
    '',
    ...designs.map((d, i) => `${i + 1}. ${d.label}${i === 0 ? ' (top pick)' : ''}`),
    '',
    shapes.includes('wide') ? `Wide (1920 x 1080 JPG, under 2 MB, so it uploads from a phone too): YouTube videos. ${HOW.wide}` : '',
    shapes.includes('tall') ? `Tall (1080 x 1920 JPG): covers for Shorts, Reels and TikTok. ${HOW.tall} Profile grids crop the top and bottom, so the words sit in the middle.` : '',
    sub ? `The small label says "${sub}".` : '',
    '',
    'Pick the one you can still read when it is the size of a stamp on your phone.',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
}
