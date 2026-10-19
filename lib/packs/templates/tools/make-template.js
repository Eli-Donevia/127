// Makes one template in three formats from one spec: a spreadsheet with working formulas, a
// Notion-ready page and a printable page, plus the steps to open each, all in one zip ready for
// Etsy (up to 5 files of 20MB) or Gumroad, and a 2000 x 1600 listing mockup. Two files, not six.

const { views, save, files, media, color, text, brain, time } = require('../../_kit');
const T = require('../lib/tpl');
const A = require('../lib/art');

function paletteFor(ctx, input) {
  if (color.isHex(String(input.color || '').trim())) return color.palette(String(input.color).trim());
  const mem = brain.packMemory(ctx, 'brand');
  const saved = [mem.palette && mem.palette.primary, mem.primary, mem.color].find((c) => color.isHex(String(c || '')));
  return color.palette(saved || 'calm');
}

module.exports = {
  name: 'templates.make_template',
  title: 'Make the template',
  description: 'Builds one template three ways (a spreadsheet with working formulas, a Notion-ready page and a printable page) with steps to open each, in one zip to upload to Etsy or Gumroad, plus a listing mockup image.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      pick: { type: 'array', title: 'Picked search', items: { type: 'object' } },
      best: { type: 'object', title: 'Best search' },
      kind: { type: 'string', title: 'Template (name or id)' },
      title: { type: 'string', title: 'Name on the template (optional)', maxLength: 60 },
      color: { type: 'string', title: 'Color (optional)', maxLength: 9 },
      dated: { type: 'boolean', title: 'Put the date in the file names', default: false },
    },
  },
  output: { type: 'object', properties: { product: { type: 'object' }, zip: { type: 'object' }, mockup: { type: ['object', 'null'] }, files: { type: 'array' } }, required: ['product'] },
  async run(input, ctx) {
    const chosen = (Array.isArray(input.pick) && input.pick[0]) || input.best || null;
    const last = brain.packMemory(ctx, 'templates').last || {};
    const kind = T.kindOf(input.kind) || (chosen && T.kindOf(chosen.kind)) || (T.SPECS[last.kind] ? last.kind : 'budget');
    const spec = T.specOf(kind);
    const title = text.clip(text.oneLine(input.title || spec.title), 60);
    const search = (chosen && chosen.kind === kind && chosen.search) || spec.title.toLowerCase();
    const pal = paletteFor(ctx, input);
    // A run on a schedule dates its files, so a repeat never sits next to a file with the same name.
    const base = input.dated ? save.fileName(title, time.today(ctx)) : text.slug(title, 40);
    const parts = T.partsOf(spec, title, pal);
    const zip = await save.saveFile(ctx, `${base}-files.zip`, files.zip(parts.map((p) => ({ name: p.name, data: Buffer.from(p.data) }))));
    let mockup = null;
    if (media.canRender(ctx)) mockup = await save.saveFile(ctx, `${base}-mockup.png`, await media.svgToPng(ctx, A.mockup(spec, title, pal), { width: 2000, height: 1600 }));
    const price = (chosen && chosen.kind === kind && chosen.price) || T.priceFor(kind);
    const product = { kind, title, search, price, formulas: T.formulaCount(spec), columns: spec.columns, rows: spec.rows.length, color: pal.primary, files: parts.map((p) => p.name) };
    // What this member has made, so Your next product and Your offer can build on it.
    const mem = brain.packMemory(ctx, 'templates');
    const made = [...new Set([...(Array.isArray(mem.made) ? mem.made : []), kind])].slice(-30);
    await brain.remember(ctx, 'made', made);
    await brain.remember(ctx, 'last', { kind, title, price, search });
    ctx.log(`Made ${title}: spreadsheet, Notion page and printable page in one zip${mockup ? ', plus the mockup' : ''}`);
    return { product, zip, mockup, files: parts.map((p) => p.name) };
  },
  view(out) {
    const p = out.product;
    return views.blocks(
      views.metric('Template', p.title, p.formulas ? `${p.formulas} formulas in the spreadsheet` : 'Printable, Notion and spreadsheet'),
      views.image(out.mockup, 'Listing mockup, 2000 x 1600. Use it as the first photo.'),
      views.file(out.zip, `${p.title}: all files (.zip)`),
      views.text(`Inside the zip: ${out.files.map((f) => f.replace(/^.*-(spreadsheet|notion|printable|how-to-open)\./, (m, k) => ({ spreadsheet: 'spreadsheet .', notion: 'Notion page .', printable: 'printable page .', 'how-to-open': 'how to open each file .' })[k])).join(', ').replace(/ \./g, ' (.').replace(/\.(csv|md|html|txt)/g, '$1)')}. Upload the zip as is to Etsy or Gumroad.`),
    );
  },
};
