// Your offer: the product line around one template, priced from what matching products charge on
// Gumroad (never from what anyone earns). Four rungs, each with one job: a free page that starts
// your customer list, the template, a printable-only version, and a bundle of three. Every price
// shows what one sale leaves you on Etsy and Gumroad. Files: a one-page offer sheet to print and a
// fee calculator spreadsheet with formulas.

const { views, save, ai, money, text, files, color, brain, time } = require('../../_kit');
const T = require('../lib/tpl');

function paletteFor(ctx) {
  const mem = brain.packMemory(ctx, 'brand');
  const saved = [mem.palette && mem.palette.primary, mem.primary, mem.color].find((c) => color.isHex(String(c || '')));
  return color.palette(saved || 'calm');
}

function rungsFor(kind, title, L) {
  const theme = T.THEMES[L.theme];
  const freeKind = theme.kinds.find((k) => !L.bundleKinds.includes(k)) || L.bundleKinds[L.bundleKinds.length - 1];
  const freeTitle = T.specOf(freeKind).title;
  const others = L.bundleKinds.filter((k) => k !== kind).map((k) => T.specOf(k).title);
  return [
    {
      id: 'free',
      name: `${freeTitle} printable page`,
      price: 0,
      priceText: 'Free',
      what: `One printable page, the ${freeTitle}. Make it with Make a template and share only the printable file.`,
      where: 'Gumroad at $0+ (people can pay what they want). Etsy listings need a price, so the free page lives on Gumroad.',
      job: 'Starts your email list: everyone who downloads it is someone you can write to later.',
    },
    {
      id: 'core',
      name: title,
      price: L.core,
      priceText: money.usd(L.core),
      what: 'The full template: spreadsheet with formulas, Notion page and printable page, in one zip.',
      where: 'Etsy and Gumroad.',
      job: 'What most buyers get. Price it like the matching products buyers already rate.',
    },
    {
      id: 'printable',
      name: `${title}, printable only`,
      price: L.printable,
      priceText: money.usd(L.printable),
      what: 'Only the printable page, for people who plan on paper.',
      where: 'Its own Etsy listing, so its buyers get only the printable file.',
      job: 'A lower price for people who would not pay for the spreadsheet.',
    },
    {
      id: 'bundle',
      name: theme.title,
      price: L.bundle,
      priceText: money.usd(L.bundle),
      what: `${L.bundleKinds.length} templates: ${title}, ${text.list(others)}. ${money.usd(L.singles)} if bought one by one.`,
      where: 'Its own Etsy listing, and a Gumroad Bundle offered as an upsell at checkout.',
      job: 'The upsell: what you offer someone who is buying one template.',
    },
  ];
}

function sheetHtml({ shop, title, rungs, fees, how, pal, checked, launch }) {
  const esc = files.esc;
  const css = [
    '@page{size:letter portrait;margin:0.4in}',
    '*{box-sizing:border-box}',
    `body{margin:0;background:#fff;color:${pal.ink};font:13px/1.45 Inter,Arial,sans-serif}`,
    '.page{max-width:7.7in;margin:0 auto;padding:18px 0}',
    `header{background:${pal.primary};color:${pal.onPrimary};border-radius:14px;padding:20px 24px;margin-bottom:16px}`,
    'header .shop{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;margin:0 0 4px}',
    'header h1{margin:0;font-size:26px;line-height:1.15}',
    'header p{margin:6px 0 0;font-size:13px;opacity:.92}',
    '.rungs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}',
    `.rung{border:1px solid ${pal.line};border-radius:12px;padding:12px 14px;background:${pal.paper};break-inside:avoid}`,
    '.rung .top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
    '.rung h2{margin:0;font-size:14px;line-height:1.25}',
    `.rung .price{font-size:20px;font-weight:700;color:${pal.primary};white-space:nowrap}`,
    '.rung p{margin:6px 0 0;font-size:12px}',
    `.rung .job{color:${pal.muted}}`,
    `.rung .step{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${pal.muted};margin-bottom:4px}`,
    'h3{font-size:14px;margin:0 0 6px}',
    'table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:12px}',
    `th{background:${pal.surface};text-align:left;padding:6px 8px;font-size:11px}`,
    `td{border-bottom:1px solid ${pal.line};padding:6px 8px}`,
    'td.n,th.n{text-align:right;white-space:nowrap}',
    `.small{font-size:11px;color:${pal.muted};margin:0 0 14px}`,
    '.two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px}',
    `.box{border:1px solid ${pal.line};border-radius:12px;padding:12px 14px}`,
    '.box p,.box li{font-size:12px;margin:0 0 6px}',
    '.box ul,.box ol{margin:0;padding-left:18px}',
    '@media (max-width:640px){.rungs,.two{grid-template-columns:1fr}.page{padding:12px}}',
    '@media print{body{font-size:11px}.page{padding:0;max-width:none}header{padding:12px 16px;margin-bottom:10px}header h1{font-size:20px}header p{font-size:11px}.rungs{gap:8px;margin-bottom:10px}.rung{padding:8px 10px}.rung h2{font-size:12.5px}.rung .price{font-size:16px}.rung p{font-size:10.5px;margin-top:4px}h3{font-size:12px;margin-bottom:4px}table{font-size:10.5px}th{font-size:10px;padding:4px 6px}td{padding:4px 6px}.small{font-size:9px;margin-bottom:8px}.two{gap:8px;margin-bottom:8px}.box{padding:8px 10px}.box p,.box li{font-size:10.5px;margin-bottom:3px}}',
  ].join('');
  const rungHtml = rungs
    .map((r, i) => `<div class="rung"><span class="step">${i + 1}. ${esc(r.id === 'free' ? 'Free page' : r.id === 'core' ? 'The template' : r.id === 'printable' ? 'Printable only' : 'Bundle')}</span><div class="top"><h2>${esc(r.name)}</h2><span class="price">${esc(r.priceText)}</span></div><p>${esc(r.what)}</p><p><b>Where:</b> ${esc(r.where)}</p><p class="job">${esc(r.job)}</p></div>`)
    .join('');
  const head = '<tr><th>One sale of</th><th class="n">Price</th><th class="n">Etsy</th><th class="n">Etsy, from an Offsite Ad</th><th class="n">Gumroad, your link</th><th class="n">Gumroad Discover</th></tr>';
  const rows = fees.map((f) => `<tr><td>${esc(f.name)}</td><td class="n">${esc(money.usd(f.price, { cents: true }))}</td>${f.keep.map((k) => `<td class="n">${esc(money.usd(k, { cents: true }))}</td>`).join('')}</tr>`).join('');
  const body = `<div class="page">
<header><p class="shop">${esc(shop || 'Your shop')}</p><h1>Your product line</h1><p>Built around the ${esc(title)}. Prices come from what matching products charge on Gumroad, read ${esc(time.longDate(checked))}.</p></header>
<div class="rungs">${rungHtml}</div>
<h3>What one sale leaves you, after fees</h3>
<table>${head}${rows}</table>
<p class="small">${T.FEE_NOTES.map(esc).join(' ')}</p>
<div class="two"><div class="box"><h3>How the line works</h3><p>${esc(how)}</p></div><div class="box"><h3>Rules to keep</h3><ul><li>A launch sale (optional, ${esc(money.usd(launch))} for a week) goes in Etsy's Sales and discounts or a Gumroad discount code, with an end date. Never raise a price first to make a sale look bigger.</li><li>Nothing in exchange for a review: no free copy, discount or refund tied to one.</li><li>Your own designs and words only. Trademarked names and copied layouts can get a listing taken down.</li></ul></div></div>
<div class="box"><h3>Your next three steps</h3><ol><li>List the template at ${esc(money.usd(rungs[1].price))} with the listing from Write the listing.</li><li>Make the free page and put it on Gumroad at $0+.</li><li>When the first template sells, make the bundle with Make a bundle.</li></ol></div>
</div>`;
  return files.htmlDoc({ title: `${shop ? `${shop}: ` : ''}product line`, css, body });
}

module.exports = {
  name: 'templates.plan_offer',
  title: 'Price your product line',
  description: 'Plans the line around one template: a free page that starts your customer list, the template, a printable-only version and a bundle of three, priced from what matching Gumroad products charge, with what each sale leaves you after Etsy and Gumroad fees.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      kind: { type: 'string', title: 'Your main template (name or id)' },
      title: { type: 'string', title: 'Its name (optional)', maxLength: 60 },
      price: { type: 'number', title: 'Your price for it (optional)', minimum: 1, maximum: 200 },
      theme: { type: 'string', title: 'Bundle theme (optional)' },
    },
  },
  output: {
    type: 'object',
    properties: { product: { type: 'object' }, rungs: { type: 'array' }, fees: { type: 'array' }, how: { type: 'string' }, sheet: { type: ['object', 'null'] }, calc: { type: ['object', 'null'] }, ai: { type: 'boolean' } },
    required: ['product', 'rungs', 'fees'],
  },
  async run(input, ctx) {
    const last = brain.packMemory(ctx, 'templates').last || {};
    const kind = T.kindOf(input.kind) || (T.SPECS[last.kind] ? last.kind : 'budget');
    const spec = T.specOf(kind);
    const title = text.clip(text.oneLine(input.title || (last.kind === kind && last.title) || spec.title), 60);
    const L = T.ladder(kind, { price: input.price || (last.kind === kind && last.price) || undefined, theme: T.themeIdOf(input.theme) });
    const rungs = rungsFor(kind, title, L);
    const fees = rungs
      .filter((r) => r.price > 0)
      .map((r) => {
        const f = T.feesAt(r.price);
        return { id: r.id, name: r.name, price: r.price, fee: f.map((x) => x.fee), keep: f.map((x) => x.keep) };
      });
    const b = brain.brainOf(ctx);
    const fallbackHow = `Each product has one job. The free ${T.specOf(T.THEMES[L.theme].kinds.find((k) => !L.bundleKinds.includes(k)) || kind).title.toLowerCase()} page starts your email list, the ${title} at ${money.usd(L.core)} is what most buyers get, the printable version at ${money.usd(L.printable)} is for people who only print, and the ${T.THEMES[L.theme].title} at ${money.usd(L.bundle)} is offered to anyone buying one template. Start with the template alone, and add the others once it sells.`;
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You explain a small digital template product line to a first-time seller in 3 short sentences: what each product is for and the order to make them in. Use only the prices given. No income claims, no sales predictions, no hype.',
      prompt: `Shop: ${b.name || 'a new template shop'}. Products: ${rungs.map((r) => `${r.name} (${r.priceText}): ${r.job}`).join(' | ')}.`,
      schema: { type: 'object', properties: { how: { type: 'string', maxLength: 600 } }, required: ['how'] },
      maxTokens: 300,
      accept: (d) => ai.cleanCopy(d) && d.how.length > 80 && !/\b(sales will|you will sell|you'll sell|profit|earn)\b/i.test(d.how),
      fallback: () => ({ how: fallbackHow }),
    });
    const pal = paletteFor(ctx);
    const checked = T.DEMAND.checked;
    const base = text.slug(title, 40);
    const sheet = await save.saveFile(ctx, `${base}-product-line.html`, sheetHtml({ shop: b.name, title, rungs, fees, how: data.how, pal, checked, launch: L.launch }));
    const calc = await save.saveFile(ctx, `${base}-fee-calculator.csv`, T.feeCalculatorCsv(rungs.filter((r) => r.price > 0).map((r) => ({ product: r.name, price: r.price }))));
    await brain.remember(ctx, 'offer', { kind, title, core: L.core, printable: L.printable, bundle: L.bundle, theme: L.theme, kinds: L.bundleKinds, at: time.today(ctx) });
    ctx.log(`Product line: free page, ${title} at ${money.usd(L.core)}, printable at ${money.usd(L.printable)}, bundle at ${money.usd(L.bundle)}`);
    return { product: { kind, title, price: L.core, theme: L.theme, bundleKinds: L.bundleKinds, singles: L.singles, launch: L.launch }, rungs, fees, how: data.how, sheet, calc, ai: usedAi };
  },
  view(out) {
    const where = ['Etsy', 'Etsy, Offsite Ad', 'Gumroad link', 'Gumroad Discover'];
    return views.blocks(
      views.metric('The template', money.usd(out.product.price), out.product.title),
      views.metric('The bundle', money.usd(out.rungs[3].price), `${out.product.bundleKinds.length} templates, ${money.usd(out.product.singles)} one by one`),
      views.table(
        [
          { key: 'name', label: 'Product' },
          { key: 'price', label: 'Price' },
          { key: 'job', label: 'Its job' },
        ],
        out.rungs.map((r) => ({ name: r.name, price: r.priceText, job: r.job })),
      ),
      views.table(
        [{ key: 'name', label: 'One sale of' }, ...where.map((w, i) => ({ key: `k${i}`, label: `You keep: ${w}` }))],
        out.fees.map((f) => ({ name: `${f.name} (${money.usd(f.price, { cents: true })})`, ...Object.fromEntries(f.keep.map((k, i) => [`k${i}`, money.usd(k, { cents: true })])) })),
      ),
      views.text(out.how),
      views.file(out.sheet, 'Your product line, one page to print (.html)'),
      views.file(out.calc, 'Fee calculator: change a price and every fee updates (.csv)'),
    );
  },
};
