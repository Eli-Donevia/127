// Three Pinterest pins for one template, each a different reason to click: the hook, what's inside,
// how it works. 1000 x 1500 (2:3, Pinterest's recommended size), with a title inside 100 characters
// (keyword first: feeds may show only the first 40), a description well inside 800, alt text and a
// board to pin to. Files: the pins and their text in one zip, and a preview of all three.

const { views, save, files, media, color, text, brain } = require('../../_kit');
const T = require('../lib/tpl');
const A = require('../lib/art');

const P = T.PLATFORMS.pinterest;

// Whole words only, inside n characters.
function fitWords(s, n) {
  const words = text.oneLine(s).split(' ');
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > n) break;
    out = next;
  }
  return out.replace(/[,:;]+$/, '');
}

function paletteFor(ctx, product) {
  if (color.isHex(String((product && product.color) || ''))) return color.palette(product.color);
  const mem = brain.packMemory(ctx, 'brand');
  const saved = [mem.palette && mem.palette.primary, mem.primary, mem.color].find((c) => color.isHex(String(c || '')));
  return color.palette(saved || 'calm');
}

function pinTexts(p, spec, shop, link) {
  const name = p.title || spec.title;
  const search = text.titleCase(p.search || spec.title);
  const lead = search.toLowerCase() === name.toLowerCase() ? name : search;
  const formulas = spec.sheet && p.formulas ? `a spreadsheet with ${p.formulas} formulas` : 'a spreadsheet';
  const from = shop ? ` Instant download from ${shop}.` : ' Instant download.';
  const first = String(spec.use).split(/(?<=\.)\s/)[0];
  const theme = T.THEMES[T.themeOf(p.kind)];
  const boards = [`${theme.label} templates`, text.titleCase(T.ALSO[p.kind] || fitWords(p.search || spec.title, 50))];
  return [
    {
      title: fitWords(`${lead}: ${spec.hook}`, P.title_max),
      description: text.clip(`${spec.hook}. ${spec.use} Works in Google Sheets, Excel, Notion or on paper.${from}`, 500),
      alt: text.clip(`Pin that reads "${spec.hook}" above a preview of the ${name} with the columns ${text.list(spec.columns.slice(0, 4))}.`, 500),
      board: boards[0],
    },
    {
      title: fitWords(`${name} for Google Sheets, Notion and Print`, P.title_max),
      description: text.clip(`What is inside the ${name}: ${formulas}, a Notion page you can import, a printable page and steps to open each file. ${first}${from}`, 500),
      alt: text.clip(`Pin listing what is inside the ${name}: ${formulas}, a Notion page, a printable page and steps to open each file.`, 500),
      board: boards[1],
    },
    {
      title: fitWords(`${name}: How It Works in 3 Steps`, P.title_max),
      description: text.clip(`How the ${name} works: download the files, open them in Google Sheets or Notion or print the page, then fill it in. ${first}${from}`, 500),
      alt: text.clip(`Pin showing three numbered steps to use the ${name}: download the files, open them in Google Sheets or Notion or print, and ${first.charAt(0).toLowerCase()}${first.slice(1).replace(/\.$/, '')}.`, 500),
      board: boards[0],
    },
  ].map((x) => ({ ...x, link: link || '[your listing link]', titleChars: x.title.length, descriptionChars: x.description.length }));
}

module.exports = {
  name: 'templates.make_pins',
  title: 'Make Pinterest pins',
  description: 'Draws three 1000 x 1500 Pinterest pins for a template (the hook, what is inside, how it works), each with a title inside 100 characters, a description, alt text and a board, plus a preview of all three.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 3,
  input: {
    type: 'object',
    properties: {
      product: { type: 'object' },
      link: { type: 'string', title: 'Your listing link (optional)', format: 'uri' },
    },
    required: ['product'],
  },
  output: { type: 'object', properties: { pins: { type: 'array' }, zip: { type: ['object', 'null'] }, preview: { type: ['object', 'null'] }, rendered: { type: 'boolean' } }, required: ['pins'] },
  async run(input, ctx) {
    const p = input.product || {};
    const spec = T.specOf(p.kind);
    const name = p.title || spec.title;
    const b = brain.brainOf(ctx);
    const link = /^https:\/\//.test(String(input.link || '')) ? input.link : '';
    const pins = pinTexts({ ...p, title: name }, spec, b.name, link);
    const pal = paletteFor(ctx, p);
    const base = text.slug(name, 40);
    const sheet = [
      `${name}: 3 Pinterest pins`,
      '',
      `Each image is ${P.image}. Titles stay inside ${P.title_max} characters with the search words first (feeds may show only the first ${P.title_shown}); descriptions stay well inside ${P.description_max}.`,
      '',
      ...pins.flatMap((x, i) => [`PIN ${i + 1} (${base}-pin-${i + 1}.png)`, `Title (${x.titleChars} of ${P.title_max}): ${x.title}`, `Description (${x.descriptionChars} of ${P.description_max}): ${x.description}`, `Alt text: ${x.alt}`, `Board: ${x.board}`, `Link: ${x.link}`, '']),
      'Post one pin every two days, each linking to your listing. Checked on Pinterest help pages 2026-10-19.',
      '',
    ].join('\n');
    let zip = null;
    let preview = null;
    let rendered = false;
    if (media.canRender(ctx)) {
      const pngs = [];
      for (const v of [0, 1, 2]) pngs.push(await media.svgToPng(ctx, A.pin(spec, { title: name, pal, variant: v, shop: b.name, formulas: T.formulaCount(spec) }), { width: A.PIN_W, height: A.PIN_H }));
      zip = await save.saveFile(ctx, `${base}-pins.zip`, files.zip([...pngs.map((png, i) => ({ name: `${base}-pin-${i + 1}.png`, data: png })), { name: `${base}-pins.txt`, data: Buffer.from(sheet) }]));
      const cs = A.contactSheet(pngs);
      preview = await save.saveFile(ctx, `${base}-pins-preview.png`, await media.svgToPng(ctx, cs.svg, { width: cs.width, height: cs.height }));
      rendered = true;
    } else {
      zip = await save.saveFile(ctx, `${base}-pins.txt`, sheet);
    }
    ctx.log(rendered ? 'Drew 3 pins and their preview' : 'Pin text written; images need the render service');
    return { pins, zip, preview, rendered };
  },
  view(out) {
    return views.blocks(
      views.image(out.preview, 'Your 3 pins, 1000 x 1500 each'),
      ...out.pins.map((x, i) => views.copy(`Pin ${i + 1}: title (${x.titleChars} of 100), then description`, `${x.title}\n\n${x.description}`)),
      views.text(`Alt text and the board for each pin are in the file. ${out.rendered ? '' : 'The images need the render service: the text is ready.'}`),
      views.file(out.zip, out.rendered ? 'The 3 pins and their text (.zip)' : 'Pin text (.txt)'),
    );
  },
  pinTexts,
  fitWords,
};
