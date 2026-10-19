// Renders the 15-second concept preview for brand #1: the product's real name, price and photo from
// its store, the script's captions burned in, stock B-roll when a Pexels key is connected.

const { views, save, media, color } = require('../../_kit');
const U = require('../lib/ugc');
const { renderConcept } = require('../lib/clip');

module.exports = {
  name: 'ugc.render_sample',
  title: 'Render the sample clip',
  description: 'Renders a 15-second vertical concept preview for one product with captions, its real name and price, and stock B-roll when a Pexels key is connected. For the brand to see privately, never to post.',
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  wants: ['pexels'],
  credits: 8,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: { brand: { type: 'object' }, script: { type: 'object' }, category: { type: 'string', enum: U.CAT_IDS }, color: { type: 'string', title: 'Your brand color (optional)' } },
    required: ['brand', 'script'],
  },
  output: { type: 'object', properties: { video: { type: 'object' }, poster: { type: 'object' }, stock: { type: 'array' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const brand = input.brand || {};
    if (!brand.name || !input.script) throw new Error('Write the script first.');
    if (!media.canRender(ctx)) {
      ctx.log('Video rendering is off here, so the clip is described, not rendered');
      return { sample: true, stock: [], brand: brand.name };
    }
    const cat = U.catOf(input.category || brand.category);
    const key = typeof ctx.secret === 'function' ? ctx.secret('pexels') : null;
    const pal = color.palette(color.isHex(input.color || '') ? input.color : 'bold');
    const r = await renderConcept(ctx, { brand, script: input.script, cat, palette: pal, pexelsKey: key });
    const fs = require('fs');
    const video = await save.saveFile(ctx, save.fileName(brand.name, 'concept-preview', '.mp4'), fs.readFileSync(r.file));
    const poster = await save.saveFile(ctx, save.fileName(brand.name, 'concept-preview', '.png'), r.poster);
    ctx.log(`Rendered the 15-second concept preview${r.stock.length ? ` with ${r.stock.length} stock clips from Pexels` : ' with shot cards'}`);
    return { sample: false, video, poster, stock: r.stock, photo: r.photo, brand: brand.name };
  },
  view(out) {
    if (!out.video) return views.blocks(views.text(`The concept preview for ${out.brand} renders where video is turned on. The script above is everything it shows.`));
    return views.blocks(
      views.video(out.video, `Concept preview for ${out.brand}. Send it privately. Never post it.`),
      views.text(out.stock && out.stock.length ? `Stock clips: ${out.stock.map((s) => `${s.by} on Pexels`).join(', ')}.` : 'Scenes 1 and 3 are shot cards. Connect Pexels to fill them with stock B-roll, or film them yourself.'),
      views.file(out.poster, 'Cover image (.png)'),
    );
  },
};
