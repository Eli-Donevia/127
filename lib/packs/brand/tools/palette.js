// Three brand palettes from a mood, the member's own color or their kind of business, with every
// text pair contrast-checked, CSS variables and a swatch board (PNG when this run can render; the
// SVG and CSS always go in the zip).

const { views, save, files, text } = require('../../_kit');
const P = require('../lib/palettes');
const { specFrom, savedColors, png } = require('../lib/kit');

module.exports = {
  name: 'brand.palette',
  title: 'Brand colors',
  description: 'Three color palettes from a mood (bold, calm, warm, fresh, premium, playful, earthy, clean) or a hex color, each with every text pair contrast-checked, CSS variables and a swatch board.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      color: { type: 'string', title: 'A color or a mood (optional)', description: 'A hex like #1f6feb, or bold, calm, warm, fresh, premium, playful, earthy, clean', maxLength: 20 },
    },
  },
  output: {
    type: 'object',
    properties: { palettes: { type: 'array' }, seed: { type: 'string' }, board: { type: ['object', 'null'] }, zip: { type: 'object' } },
    required: ['palettes'],
  },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    const saved = spec.saved ? savedColors(ctx) : null;
    const made = P.threePalettes(spec.seed, { mood: spec.mood });
    // After a brand refresh, the refreshed colors come first, so the next workflow uses them.
    const palettes = saved ? P.withFirst({ id: 'refreshed', label: 'Your refreshed colors', colors: saved }, made) : made;
    const name = spec.name || 'Your business';
    const boardSvg = P.board(palettes, { business: name });
    const boardPng = await png(ctx, boardSvg, { width: 1080 });
    const board = boardPng ? await save.saveFile(ctx, save.fileName(name, 'colors', '.png'), boardPng) : null;
    const css = palettes.map((p) => `/* ${p.n}. ${p.name} */\n${P.cssVars(p.colors)}`).join('\n');
    const entries = [
      { name: 'colors.svg', data: boardSvg },
      { name: 'colors.css', data: css },
      { name: 'colors.json', data: JSON.stringify(palettes.map((p) => ({ name: p.name, colors: p.colors, checks: p.checks })), null, 2) },
    ];
    if (boardPng) entries.push({ name: 'colors.png', data: boardPng });
    const zip = await save.saveFile(ctx, save.fileName(name, 'color-files', '.zip'), files.zip(entries));
    ctx.log(`Built ${palettes.length} palettes from ${spec.seed}`);
    return { palettes: palettes.map((p) => ({ n: p.n, id: p.id, name: p.name, label: p.label, colors: p.colors, checks: p.checks, css: p.css })), seed: spec.seed, mood: spec.mood, board, zip };
  },
  view(out) {
    return views.blocks(
      out.board ? views.image(out.board, 'Three palettes. Every text pair checked for contrast.') : views.text('Three palettes, every text pair checked for contrast. The swatch board is in the zip.'),
      views.cards(out.palettes.map((p) => ({
        title: `${p.n}. ${p.name}`,
        badge: p.checks.every((c) => c.pass) ? 'All pairs pass' : 'Check pairs',
        body: `Main ${p.colors.primary}, accent ${p.colors.accent}, text ${p.colors.ink}, page ${p.colors.paper}. Body text ${p.checks[0].ratio}:1, buttons ${p.checks[1].ratio}:1.`,
      }))),
      views.copy('CSS variables for palette 1', out.palettes[0].css),
      views.file(out.zip, 'Color files: swatch SVG, CSS and JSON')
    );
  },
};
