// Six logo concepts drawn as real paths: monogram badge, symbol and name, wordmark, icon and name,
// round seal and stacked name. Each comes as an SVG, a 1080 PNG and a 64px favicon (PNGs when
// this run can render), plus one board to compare them.

const { views, save, files, text } = require('../../_kit');
const L = require('../lib/logos');
const { specFrom, png, NOT_YET } = require('../lib/kit');

module.exports = {
  name: 'brand.logo_concepts',
  title: 'Logo concepts',
  description: 'Draws 6 distinct logo concepts in the member colors (monogram badge, symbol and name, wordmark, icon and name, round seal, stacked name) as SVG files, 1080 PNGs and 64px favicons.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  lane: 'render',
  credits: 4,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      color: { type: 'string', title: 'A color or a mood (optional)', maxLength: 20 },
      palette: { title: 'Colors from the palette step' },
    },
    required: ['name'],
  },
  output: {
    type: 'object',
    properties: { concepts: { type: 'array' }, overview: { type: ['object', 'null'] }, zip: { type: 'object' }, preview: { type: ['object', 'null'] } },
    required: ['concepts'],
  },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    if (!spec.name) throw new Error('Add your business name first, or run "Name your business".');
    const list = L.concepts(spec);
    const base = text.slug(spec.name, 30) || 'logo';
    const entries = [];
    let rendered = 0;
    for (const [i, d] of list.entries()) {
      const tag = `${i + 1}-${d.id}`;
      entries.push({ name: `${base}-${tag}.svg`, data: L.logoSvg(d, { title: `${spec.name} ${d.title}` }) });
      entries.push({ name: `${base}-${tag}-mark.svg`, data: L.markSvg(d, { size: 512 }) });
      const big = await png(ctx, L.presentSvg(d, { background: spec.colors.paper }), { width: 1080 });
      if (big) {
        rendered++;
        entries.push({ name: `${base}-${tag}.png`, data: big });
        const fav = await png(ctx, L.markSvg(d, { size: 64 }), { width: 64 });
        if (fav) entries.push({ name: `${base}-${tag}-favicon-64.png`, data: fav });
      }
    }
    const boardSvg = L.overviewSvg(list, { business: spec.name, colors: spec.colors });
    const boardPng = await png(ctx, boardSvg, { width: 1080 });
    entries.push({ name: `${base}-logo-concepts.svg`, data: boardSvg });
    entries.push({ name: 'how-to-use.txt', data: `${spec.name} logo concepts\n\nEach concept has an SVG (sharp at any size, for print shops and website builders), a 1080 PNG (for posts and messages) and a 64 pixel favicon (for your website tab).\nThe -mark files are the square version for profile pictures.\n\nPick one and use it this week. ${NOT_YET[0]}\n` });
    const overview = boardPng ? await save.saveFile(ctx, save.fileName(spec.name, 'logo-concepts', '.png'), boardPng) : null;
    // Without PNGs, a page that shows the SVGs side by side (HTML, no scripts).
    const preview = boardPng ? null : await save.saveFile(ctx, save.fileName(spec.name, 'logo-concepts', '.html'), files.htmlDoc({ title: `${spec.name} logo concepts`, css: 'body{margin:0;background:#fff;font:16px/1.4 Inter,Arial,sans-serif}main{max-width:1080px;margin:0 auto;padding:24px}svg{width:100%;height:auto}', body: `<main>${boardSvg}</main>` }));
    const zip = await save.saveFile(ctx, save.fileName(spec.name, 'logo-files', '.zip'), files.zip(entries));
    ctx.log(`Drew ${list.length} logo concepts${rendered ? `, ${rendered} rendered to PNG` : ' (SVG only, rendering is off in this run)'}`);
    return {
      concepts: list.map((d, i) => ({ id: d.id, n: i + 1, title: d.title, note: d.note })),
      name: spec.name,
      overview,
      preview,
      zip,
    };
  },
  view(out) {
    return views.blocks(
      out.overview ? views.image(out.overview, `Six logo concepts for ${out.name}`) : views.file(out.preview, 'Logo concepts (open to compare)'),
      views.table([{ key: 'title', label: 'Concept' }, { key: 'note', label: 'Best for' }], out.concepts.map((c) => ({ title: `${c.n}. ${c.title}`, note: c.note }))),
      views.file(out.zip, 'All logo files: SVG, 1080 PNG and 64px favicon for each'),
      views.text(NOT_YET[0])
    );
  },
};
