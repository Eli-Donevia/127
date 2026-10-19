// The listing: an Etsy title inside 140 characters, 13 tags of 20 characters or fewer, a description,
// a Gumroad blurb, what each platform keeps per sale at your price, and a note asking 5 people you
// know to try it and say what was confusing (feedback, never a review).

const { views, save, ai, money, text, brain, time } = require('../../_kit');
const T = require('../lib/tpl');

const FORMATS = 'Google Sheets, Excel, Notion and print';
const NO_REVIEW = 'Ask what was confusing, not for a review, and keep the free copy separate from any review. Etsy treats rewarded reviews as shilling, and the FTC bans rewards for positive reviews.';

function descriptionOf(p, spec, intro) {
  return [
    text.oneLine(intro),
    '',
    'What you get',
    `- A spreadsheet for Google Sheets, Excel or Numbers${spec.sheet && p.formulas ? ` with ${p.formulas} formulas already in it` : ''}`,
    '- A Notion page you can import',
    '- A printable page (US letter) to print or save as a PDF',
    '- Steps to open each file',
    '',
    'How it works',
    spec.use,
    '',
    'Good to know',
    '- This is a digital download. Nothing is shipped.',
    '- The files come as one zip you can download right after you buy.',
    '- Colors can look a little different on paper than on screen.',
    '- For personal use. Please do not resell or share the files.',
    '- Questions? Send me a message and I will help you open the files.',
  ].join('\n');
}

// The product to list: from the step before, or a kind and name typed in, or the last template made.
function productOf(input, ctx) {
  if (input.product && T.SPECS[input.product.kind]) return input.product;
  const last = brain.packMemory(ctx, 'templates').last || {};
  const kind = T.kindOf(input.kind) || (T.SPECS[last.kind] ? last.kind : 'budget');
  const spec = T.specOf(kind);
  const same = last.kind === kind;
  return {
    kind,
    title: text.clip(text.oneLine(input.title || (same && last.title) || spec.title), 60),
    search: (same && last.search) || spec.title.toLowerCase(),
    price: (same && last.price) || T.priceFor(kind),
    formulas: T.formulaCount(spec),
    columns: spec.columns,
  };
}

function noteOf(p, spec, first) {
  return [
    `Hi! I just made ${text.withA(p.title || spec.title)} that works in ${FORMATS}.`,
    'Could I send you a copy to try, on the house? I would love to know what is confusing or missing. It takes about 5 minutes.',
    'Just your honest take, nothing else.',
    first ? `Thanks, ${first}` : 'Thank you!',
  ].join('\n\n');
}

module.exports = {
  name: 'templates.write_listing',
  title: 'Write the listing',
  description: 'Writes the Etsy title (140 characters max), 13 tags (20 characters each max) and description, a Gumroad blurb, the fees each platform takes at your price, and a note asking 5 people you know to try it.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      product: { type: 'object' },
      kind: { type: 'string', title: 'Template (name or id)' },
      title: { type: 'string', title: 'Its name (optional)', maxLength: 60 },
      price: { type: 'number', minimum: 1, maximum: 200 },
      save: { type: 'boolean', default: true },
      dated: { type: 'boolean', title: 'Put the date in the file name', default: false },
    },
  },
  output: { type: 'object', properties: { product: { type: 'object' }, listing: { type: 'object' }, fees: { type: 'array' }, note: { type: 'string' }, file: { type: ['object', 'null'] }, ai: { type: 'boolean' } }, required: ['product', 'listing', 'fees'] },
  async run(input, ctx) {
    const p = productOf(input, ctx);
    const spec = T.specOf(p.kind);
    const name = p.title || spec.title;
    const price = money.round(Number(input.price) || Number(p.price) || T.priceFor(p.kind), 2);
    const search = p.search || spec.title.toLowerCase();
    const title = T.titleFor(search, spec);
    const tags = T.tagsFor(search, spec);
    const b = brain.brainOf(ctx);
    const hook = `${spec.hook.charAt(0).toLowerCase()}${spec.hook.slice(1)}`;
    const fallbackIntro = `${name}: ${hook}, in ${FORMATS}. Fill it in on your phone or computer, or print it and use a pen.`;
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write the first two sentences of an Etsy listing description for a digital template. Say what it is and who it helps, plainly. No hype words, no promises about results, no emoji, no questions.',
      prompt: `Template: ${name}. Buyers search for: ${search}. Columns: ${(p.columns || spec.columns).slice(0, 8).join(', ')}. How it works: ${spec.use} Formats: ${FORMATS}.`,
      schema: { type: 'object', properties: { intro: { type: 'string', maxLength: 300 } }, required: ['intro'] },
      maxTokens: 250,
      accept: (d) => ai.cleanCopy(d) && d.intro.length >= 40 && !/\b(transform|life-changing|guarantee|best|ultimate|perfect)\b/i.test(d.intro),
      fallback: () => ({ intro: fallbackIntro }),
    });
    const description = descriptionOf(p, spec, data.intro);
    const gumroad = [`${name}: ${hook}.`, '', spec.use, '', `You get a spreadsheet${spec.sheet && p.formulas ? ` with ${p.formulas} formulas` : ''}, a Notion page and a printable page, with steps to open each. Digital download, for personal use.`].join('\n');
    const fees = T.feesAt(price);
    const note = noteOf(p, spec, b.firstName);
    const listing = { title, titleChars: title.length, tags, description, gumroad, price, search };
    let file = null;
    if (input.save !== false) {
      file = await save.saveFile(
        ctx,
        input.dated ? save.fileName(name, 'listing', time.today(ctx), '.txt') : `${text.slug(name, 40)}-listing.txt`,
        [
          `${name}: your listing`,
          '',
          `ETSY TITLE (${title.length} of ${T.PLATFORMS.etsy.title_max} characters)`,
          title,
          '',
          `TAGS (${tags.length} of ${T.PLATFORMS.etsy.tags_max}, each ${T.PLATFORMS.etsy.tag_chars} characters or fewer)`,
          tags.join(', '),
          '',
          'DESCRIPTION',
          description,
          '',
          'GUMROAD DESCRIPTION',
          gumroad,
          '',
          `PRICE ${money.usd(price, { cents: true })}: what one sale leaves you`,
          ...fees.map((f) => `- ${f.platform}: fees ${money.usd(f.fee, { cents: true })}, you keep ${money.usd(f.keep, { cents: true })}`),
          ...T.FEE_NOTES.map((n) => `  ${n}`),
          '',
          'BEFORE YOU LIST',
          `- Etsy: pick Digital files as the type, upload the zip (up to ${T.PLATFORMS.etsy.files_max} files, ${T.PLATFORMS.etsy.file_mb}MB each) and use the mockup as the first photo.`,
          '- Gumroad: add the zip as the product file and paste the Gumroad description.',
          '',
          'SEND TO 5 PEOPLE YOU KNOW WHO WOULD USE IT',
          note,
          '',
          NO_REVIEW,
          '',
        ].join('\n'),
      );
    }
    ctx.log(`Listing written: ${title.length}-character title, ${tags.length} tags, price ${money.usd(price, { cents: true })}`);
    return { product: { ...p, price }, listing, fees, note, file, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.copy(`Etsy title (${out.listing.titleChars} of 140 characters)`, out.listing.title),
      views.copy(`Tags (${out.listing.tags.length} of 13, 20 characters max each)`, out.listing.tags.join(', ')),
      views.copy('Description', out.listing.description),
      views.table(
        [
          { key: 'platform', label: `One sale at ${money.usd(out.listing.price, { cents: true })}` },
          { key: 'fee', label: 'Fees' },
          { key: 'keep', label: 'You keep' },
        ],
        out.fees.map((f) => ({ platform: f.platform, fee: money.usd(f.fee, { cents: true }), keep: money.usd(f.keep, { cents: true }) })),
      ),
      views.copy('Send to 5 people you know who would use it', out.note),
      views.text(NO_REVIEW),
      views.file(out.file, 'Listing, fees and the note (.txt)'),
    );
  },
  FORMATS,
  NO_REVIEW,
};
