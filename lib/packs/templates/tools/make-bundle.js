// The upsell: three templates from one theme in one zip (each one three ways, in its own folder),
// a bundle mockup, and its listing: the Etsy title, tags and description, how to set it up as a
// Gumroad Bundle offered at checkout, the line to add to each single listing, and the fees at the
// bundle price. Prices come from what matching products charge, never from what anyone earns.

const { views, save, ai, money, text, files, media, color, brain, time } = require('../../_kit');
const T = require('../lib/tpl');
const A = require('../lib/art');

function paletteFor(ctx, input) {
  if (color.isHex(String(input.color || '').trim())) return color.palette(String(input.color).trim());
  const mem = brain.packMemory(ctx, 'brand');
  const saved = [mem.palette && mem.palette.primary, mem.primary, mem.color].find((c) => color.isHex(String(c || '')));
  return color.palette(saved || 'calm');
}

// "Money Planner Bundle: Monthly Budget, Bill Tracker, ...", inside Etsy's 140 characters.
function bundleTitle(title, specs) {
  const max = T.PLATFORMS.etsy.title_max;
  let t = text.clip(title, max);
  let first = true;
  for (const p of [...specs.map((s) => s.title), 'Printable, Google Sheets and Notion', 'Instant Download']) {
    const next = `${t}${first ? ': ' : ', '}${p}`;
    if (next.length <= max) {
      t = next;
      first = false;
    }
  }
  return t;
}

function bundleTags(title, specs, theme) {
  const max = T.PLATFORMS.etsy.tag_chars;
  const words = [title, `${theme.label} bundle`, ...specs.map((s) => s.title), 'planner bundle', 'template bundle', 'printable planner', 'google sheets', 'notion template', 'digital download', 'instant download', 'spreadsheet template', 'editable template', 'planner pages'];
  const out = [];
  for (const w of words) {
    const ws = text.oneLine(String(w).toLowerCase()).replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean);
    while (ws.length > 1 && (ws.join(' ').length > max || ['and', 'or', 'the', 'of', 'for', 'a', 'with', 'to'].includes(ws[ws.length - 1]))) ws.pop();
    const t = ws.join(' ');
    if (t && t.length <= max && !out.includes(t)) out.push(t);
    if (out.length >= T.PLATFORMS.etsy.tags_max) break;
  }
  return out;
}

function kindsFor(input, ctx, themeId) {
  const valid = (Array.isArray(input.kinds) ? input.kinds : []).map((k) => T.kindOf(k)).filter(Boolean);
  const uniq = [...new Set(valid)];
  if (uniq.length >= 2) return uniq.slice(0, 4);
  const mem = brain.packMemory(ctx, 'templates');
  const made = (Array.isArray(mem.made) ? mem.made : []).filter((k) => T.THEMES[themeId].kinds.includes(k));
  return [...new Set([...uniq, ...made.reverse(), ...T.THEMES[themeId].kinds])].slice(0, 3);
}

module.exports = {
  name: 'templates.make_bundle',
  title: 'Make the bundle',
  description: 'Builds a bundle of three templates from one theme (each as a spreadsheet with formulas, a Notion page and a printable page), a bundle mockup, and its listing with the Gumroad upsell setup and the fees at the bundle price.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  wants: ['render'],
  credits: 8,
  input: {
    type: 'object',
    properties: {
      theme: { type: 'string', title: 'Theme (name or id)' },
      kinds: { type: 'array', title: 'Templates in it (optional)', items: { type: 'string' }, maxItems: 4 },
      title: { type: 'string', title: 'Bundle name (optional)', maxLength: 60 },
      price: { type: 'number', title: 'Bundle price (optional)', minimum: 2, maximum: 300 },
      color: { type: 'string', title: 'Color (optional)', maxLength: 9 },
    },
  },
  output: {
    type: 'object',
    properties: { bundle: { type: 'object' }, listing: { type: 'object' }, fees: { type: 'array' }, zip: { type: 'object' }, mockup: { type: ['object', 'null'] }, file: { type: 'object' }, ai: { type: 'boolean' } },
    required: ['bundle', 'listing', 'fees'],
  },
  async run(input, ctx) {
    const mem = brain.packMemory(ctx, 'templates');
    const last = mem.last || {};
    const offer = mem.offer || {};
    const typed = [...new Set((Array.isArray(input.kinds) ? input.kinds : []).map((k) => T.kindOf(k)).filter(Boolean))];
    const themeId = T.themeIdOf(input.theme) || (typed.length >= 2 ? T.themeOf(typed[0]) : T.THEMES[offer.theme] ? offer.theme : T.SPECS[last.kind] ? T.themeOf(last.kind) : 'money');
    const theme = T.THEMES[themeId];
    const kinds = kindsFor(input, ctx, themeId);
    const specs = kinds.map((k) => T.specOf(k));
    const title = text.clip(text.oneLine(input.title || theme.title), 60);
    const singles = kinds.reduce((s, k) => s + (k === last.kind && last.price ? Number(last.price) : T.priceFor(k)), 0);
    const top = Math.max(...kinds.map((k) => (k === last.kind && last.price ? Number(last.price) : T.priceFor(k))));
    const sameOffer = offer.theme === themeId && Array.isArray(offer.kinds) && offer.kinds.join() === kinds.join();
    const price = money.round(Number(input.price) || (sameOffer && offer.bundle) || Math.max(top + 2, money.nicePrice(singles * 0.65)), 2);
    const pal = paletteFor(ctx, input);
    const base = text.slug(title, 40);
    const formulas = specs.reduce((s, sp) => s + T.formulaCount(sp), 0);

    // The zip: one folder per template, and a start-here file.
    const start = [
      `${title}: start here`,
      '',
      `${kinds.length} templates, each in its own folder, each three ways: a spreadsheet (.csv${formulas ? ', formulas included' : ''}), a Notion page (.md) and a printable page (.html).`,
      '',
      ...specs.map((s, i) => `${i + 1}. ${s.title}: ${s.hook}.`),
      '',
      'Each folder has a how-to-open file with the steps for Google Sheets, Excel, Notion and printing.',
      '',
      'For personal use. Please do not resell or share the files.',
      '',
    ].join('\n');
    const entries = [{ name: 'start-here.txt', data: Buffer.from(start) }];
    for (const s of specs) for (const part of T.partsOf(s, s.title, pal, { folder: text.slug(s.title, 40) })) entries.push({ name: part.name, data: Buffer.from(part.data) });
    const zip = await save.saveFile(ctx, `${base}-files.zip`, files.zip(entries));
    let mockup = null;
    if (media.canRender(ctx)) mockup = await save.saveFile(ctx, `${base}-mockup.png`, await media.svgToPng(ctx, A.bundleMockup(specs, title, pal, { subtitle: `${kinds.length} templates for Google Sheets, Notion and print` }), { width: 2000, height: 1600 }));

    const b = brain.brainOf(ctx);
    const fallbackIntro = `${kinds.length} ${theme.label.toLowerCase()} templates in one download: ${text.list(specs.map((s) => `the ${s.title}`))}. Each one comes as a spreadsheet, a Notion page and a printable page.`;
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write the first two sentences of an Etsy listing for a bundle of digital templates: what is in it and who it helps. Plain, specific, no hype, no promises about results, no prices, no emoji.',
      prompt: `Bundle: ${title}. Templates: ${specs.map((s) => `${s.title} (${s.hook})`).join('; ')}. Formats: Google Sheets, Excel, Notion and print.`,
      schema: { type: 'object', properties: { intro: { type: 'string', maxLength: 320 } }, required: ['intro'] },
      maxTokens: 250,
      accept: (d) => ai.cleanCopy(d) && d.intro.length >= 40 && !/\$|\b(transform|guarantee|best|ultimate|perfect|value)\b/i.test(d.intro),
      fallback: () => ({ intro: fallbackIntro }),
    });
    const etsyTitle = bundleTitle(title, specs);
    const tags = bundleTags(title, specs, theme);
    const description = [
      text.oneLine(data.intro),
      '',
      "What's inside",
      ...specs.map((s) => `- ${s.title}: ${s.hook.charAt(0).toLowerCase()}${s.hook.slice(1)}`),
      '',
      'Each template comes three ways',
      `- A spreadsheet for Google Sheets, Excel or Numbers${formulas ? ` (${formulas} formulas across the bundle)` : ''}`,
      '- A Notion page you can import',
      '- A printable page (US letter) to print or save as a PDF',
      '',
      'Good to know',
      '- This is a digital download. Nothing is shipped.',
      '- One zip with a folder for each template and a start-here file.',
      '- For personal use. Please do not resell or share the files.',
    ].join('\n');
    const singleLine = `Also in the ${title}: ${kinds.length} templates for ${money.usd(price, { cents: price % 1 !== 0 })} (${money.usd(singles)} if bought one by one).`;
    const gumroad = [
      `1. Make sure each template is its own Gumroad product.`,
      `2. New product, type Bundle: add the ${kinds.length} products, name it ${title} and set the price to ${money.usd(price, { cents: price % 1 !== 0 })}.`,
      '3. Checkout, Upsells: on each single, add an upsell that replaces the cart with the bundle. Buyers see it after they press Pay, and only take it if they want it.',
    ].join('\n');
    const fees = T.feesAt(price);
    const listing = { title: etsyTitle, titleChars: etsyTitle.length, tags, description, singleLine, gumroad, price };
    const file = await save.saveFile(
      ctx,
      `${base}-listing.txt`,
      [
        `${title}: the bundle listing`,
        '',
        `ETSY TITLE (${etsyTitle.length} of ${T.PLATFORMS.etsy.title_max} characters)`,
        etsyTitle,
        '',
        `TAGS (${tags.length} of ${T.PLATFORMS.etsy.tags_max}, each ${T.PLATFORMS.etsy.tag_chars} characters or fewer)`,
        tags.join(', '),
        '',
        'DESCRIPTION',
        description,
        '',
        'ADD THIS LINE TO EACH SINGLE LISTING',
        singleLine,
        '',
        'GUMROAD: THE BUNDLE AS AN UPSELL',
        gumroad,
        '',
        `PRICE ${money.usd(price, { cents: true })}: what one sale leaves you`,
        ...fees.map((f) => `- ${f.platform}: fees ${money.usd(f.fee, { cents: true })}, you keep ${money.usd(f.keep, { cents: true })}`),
        ...T.FEE_NOTES.map((n) => `  ${n}`),
        '',
        'Etsy: list the bundle as its own listing, upload the zip and use the mockup as the first photo.',
        '',
      ].join('\n'),
    );
    await brain.remember(ctx, 'bundle', { theme: themeId, kinds, title, price, at: time.today(ctx) });
    ctx.log(`Bundle made: ${title}, ${kinds.length} templates at ${money.usd(price)}${mockup ? ', with mockup' : ''}`);
    return { bundle: { theme: themeId, kinds, titles: specs.map((s) => s.title), title, price, singles, formulas, shop: b.name || '' }, listing, fees, zip, mockup, file, ai: usedAi };
  },
  view(out) {
    const x = out.bundle;
    return views.blocks(
      views.metric('Bundle price', money.usd(x.price), `${x.kinds.length} templates, ${money.usd(x.singles)} one by one`),
      views.image(out.mockup, 'Bundle mockup, 2000 x 1600. Use it as the first photo.'),
      views.copy(`Etsy title (${out.listing.titleChars} of 140 characters)`, out.listing.title),
      views.copy(`Tags (${out.listing.tags.length} of 13)`, out.listing.tags.join(', ')),
      views.copy('Description', out.listing.description),
      views.copy('Add to each single listing', out.listing.singleLine),
      views.copy('Gumroad: offer the bundle at checkout', out.listing.gumroad),
      views.table(
        [
          { key: 'platform', label: `One sale at ${money.usd(x.price, { cents: true })}` },
          { key: 'fee', label: 'Fees' },
          { key: 'keep', label: 'You keep' },
        ],
        out.fees.map((f) => ({ platform: f.platform, fee: money.usd(f.fee, { cents: true }), keep: money.usd(f.keep, { cents: true }) })),
      ),
      views.file(out.zip, `${x.title}: all files (.zip)`),
      views.file(out.file, 'Bundle listing and setup (.txt)'),
    );
  },
  bundleTitle,
  bundleTags,
};
