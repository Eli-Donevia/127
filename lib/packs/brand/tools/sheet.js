// One printable brand sheet: logo on light and dark, the square mark, colors with hex codes, the
// contrast check, CSS variables, type, voice, bios and three things not to do yet. HTML, no scripts.

const { views, save } = require('../../_kit');
const { specFrom, conceptFrom, NOT_YET } = require('../lib/kit');
const { sheetHtml } = require('../lib/sheet');

module.exports = {
  name: 'brand.sheet',
  title: 'Brand sheet',
  description: 'Builds one printable brand sheet with the chosen logo, colors and contrast check, CSS variables, type, voice and bios.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      color: { type: 'string', title: 'A color or a mood (optional)', maxLength: 20 },
      concept: { title: 'Logo concept' },
      palette: { title: 'Colors from the palette step' },
      voice: { title: 'Voice from the voice step' },
    },
    required: ['name'],
  },
  output: { type: 'object', properties: { sheet: { type: 'object' }, concept: { type: 'string' } }, required: ['sheet'] },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    if (!spec.name) throw new Error('Add your business name first.');
    const conceptId = conceptFrom(input.concept, 'monogram');
    const voice = input.voice && input.voice.voice ? input.voice.voice : null;
    const sheet = await save.saveFile(ctx, save.fileName(spec.name, 'brand-sheet', '.html'), sheetHtml({ spec, conceptId, voice, notYet: NOT_YET }));
    ctx.log('Built the brand sheet');
    return { sheet, concept: conceptId, name: spec.name, notYet: NOT_YET };
  },
  view(out) {
    return views.blocks(
      views.file(out.sheet, `${out.name} brand sheet (print it or save as PDF)`),
      views.cards(out.notYet.map((t, i) => ({ title: `Not yet ${i + 1}`, body: t })))
    );
  },
};
