// Turns a typed product list into a Shopify product CSV that imports as drafts (exact template
// headers, UTF-8, LF), with SEO titles and descriptions inside Shopify's limits, plus a launch
// checklist page with the admin paths. Uses only what the member typed: nothing is invented.

const { text, money, save, views, brain } = require('../../_kit');
const C = require('../lib/csv');
const H = require('../lib/html');
const LAUNCH = require('../data/launch.json');

const OPT = /\b(sizes?|colou?rs?|scents?|styles?|options?|flavou?rs?)\s*:\s*([^|;]+)/i;

// "Lavender Soy Candle | 32 | Hand-poured 8 oz candle | Sizes: 8 oz / 12 oz"
// or "Lavender Soy Candle - $32 - Hand-poured 8 oz candle"
function parseLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;
  if (raw.includes('|')) {
    const parts = raw.split('|').map((x) => x.trim());
    const om = parts.slice(1).join(' | ').match(OPT);
    const word = om ? om[1].toLowerCase().replace(/s$/, '').replace('colour', 'color').replace('flavour', 'flavor') : '';
    const pm = (parts[1] || '').match(/\d{1,6}(?:\.\d{1,2})?/);
    return {
      name: parts[0],
      price: pm ? Number(pm[0]) : null,
      desc: parts.slice(2).filter((x) => x && !OPT.test(x)).join(' '),
      option: om ? { name: text.titleCase(word), values: om[2].split(/\s*\/\s*|\s*,\s*/).map((v) => v.trim()).filter(Boolean).slice(0, 20) } : null,
    };
  }
  const m = raw.match(/(?:^|[\s|,\-:])\$?\s?(\d{1,6}(?:\.\d{1,2})?)(?=\s*(?:$|[|,\-]|\s))/);
  if (!m) return { name: raw.replace(/[|,\-\s]+$/, ''), price: null, desc: '', option: null };
  const name = raw.slice(0, m.index).replace(/[\s|,\-:]+$/, '').trim();
  let rest = raw.slice(m.index + m[0].length).replace(/^[\s|,\-:]+/, '');
  let option = null;
  const om = rest.match(OPT);
  if (om) {
    const word = om[1].toLowerCase().replace(/s$/, '').replace('colour', 'color').replace('flavour', 'flavor');
    option = { name: text.titleCase(word), values: om[2].split(/\s*\/\s*|\s*,\s*/).map((v) => v.trim()).filter(Boolean).slice(0, 20) };
    rest = rest.replace(OPT, '').replace(/[\s|,;\-]+$/, '').trim();
  }
  return { name: name || raw, price: Number(m[1]), desc: rest.replace(/^[|]\s*/, '').trim(), option };
}

function seoTitle(name, vendor) {
  const t = vendor ? `${name} | ${vendor}` : name;
  return t.length <= C.SPEC.limits.seoTitle ? t : text.clip(name, C.SPEC.limits.seoTitle);
}

function seoDesc(p, vendor) {
  const base = p.desc ? `${p.name}. ${p.desc}` : `${p.name}${vendor ? ` from ${vendor}` : ''}.`;
  return text.clip(base.replace(/\s+/g, ' '), 155);
}

const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = {
  name: 'shop.build_csv',
  title: 'Build a product CSV',
  description: "Turns your product list (one per line: name, price, description, options) into a Shopify product CSV that imports as drafts, with SEO titles and descriptions inside Shopify's limits, and a launch checklist.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      products: { type: 'string', maxLength: 20000, description: 'One per line, like "Lavender Soy Candle | 32 | Hand-poured 8 oz soy candle | Sizes: 8 oz / 12 oz".' },
      vendor: { type: 'string', maxLength: 120 },
      type: { type: 'string', maxLength: 80, description: 'Product type, like Candles.' },
      collection: { type: 'string', maxLength: 120, description: 'A collection to put them all in (created on import).' },
    },
    required: ['products'],
  },
  output: { type: 'object', properties: { products: { type: 'array' }, csv: { type: 'object' }, checklist: { type: 'object' }, problems: { type: 'array' }, rows: { type: 'integer' } }, required: ['products'] },

  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const vendor = input.vendor || br.name || '';
    const list = String(input.products || '')
      .split(/\n+/)
      .map(parseLine)
      .filter((p) => p && p.name)
      .slice(0, 200);
    const taken = new Set();
    const rows = [];
    const products = [];
    for (const p of list) {
      const handle = C.handleOf(p.name, taken);
      const price = p.price != null ? p.price.toFixed(2) : '';
      const base = {
        'URL handle': handle,
        Status: 'draft',
        'Charge tax': 'true',
        'Continue selling when out of stock': 'deny',
        'Requires shipping': 'true',
        'Fulfillment service': 'manual',
        Price: price,
      };
      const values = p.option && p.option.values.length ? p.option.values : null;
      const first = {
        ...base,
        Title: p.name,
        Description: p.desc ? `<p>${escHtml(p.desc)}</p>` : '',
        Vendor: vendor,
        Type: input.type || '',
        Tags: [...new Map([input.type, br.niche].filter(Boolean).map((x) => [x.toLowerCase(), x])).values()].join(', '),
        'Published on online store': 'true',
        'Option1 name': values ? p.option.name : 'Title',
        'Option1 value': values ? values[0] : 'Default Title',
        'Gift card': 'false',
        'SEO title': seoTitle(p.name, vendor),
        'SEO description': seoDesc(p, vendor),
        Collection: input.collection || '',
      };
      rows.push(first);
      for (const v of (values || []).slice(1)) rows.push({ ...base, 'Option1 value': v });
      products.push({ title: p.name, handle, price: p.price, options: values ? `${p.option.name}: ${values.join(', ')}` : '', seoTitle: first['SEO title'], seoDescription: first['SEO description'], missing: [p.price == null ? 'price' : null, p.desc ? null : 'description'].filter(Boolean).join(', ') });
    }
    const csvText = C.write(rows);
    const problems = C.validate(csvText);
    const name = vendor || 'my store';
    const csv = rows.length ? await save.saveFile(ctx, save.fileName(name, 'shopify products', '.csv'), csvText, 'text/csv') : null;
    const t = H.theme(br.name || 'shop');
    const steps = [
      { title: 'Import the products as drafts', how: `${LAUNCH.paths.import} Leave Overwrite products with matching handles off.` },
      { title: 'Add photos to each product', how: `Square photos at ${LAUNCH.imageGuide.bestSquarePx} pixels look sharp. ${LAUNCH.paths.altText}` },
      { title: 'Check each title and description', how: LAUNCH.paths.productSeo },
      { title: 'Write your policies', how: LAUNCH.paths.policies },
      { title: 'Set shipping', how: LAUNCH.paths.freeShipping },
      { title: 'Place a test order', how: LAUNCH.paths.testMode },
      { title: 'Set your homepage title and description', how: LAUNCH.paths.homeSeo },
      { title: 'Connect your domain', how: LAUNCH.paths.domains },
      { title: 'Set products to Active, then open the store', how: `Change each product's status from Draft to Active on its product page. Then: ${LAUNCH.paths.openStore}` },
    ];
    const body = [
      H.hero({ eyebrow: 'Launch checklist', heading: `${name}: ${text.plural(products.length, 'product')} ready to import`, lead: 'Import the CSV as drafts, add photos, then work down this list. Nothing goes live until you set products to Active and open the store.' }),
      H.block({ kicker: 'Products', title: 'What the CSV holds', body: H.table([{ key: 'title', label: 'Product' }, { key: 'price', label: 'Price', num: true }, { key: 'options', label: 'Options' }, { key: 'missing', label: 'Still to add' }], products.map((p) => ({ ...p, price: p.price != null ? money.usd(p.price) : '' }))) }),
      H.block({ kicker: 'Steps', title: 'From import to open', body: H.checklist(steps) }),
    ].join('\n');
    const checklist = products.length ? await save.saveFile(ctx, save.fileName(name, 'launch checklist', '.html'), H.page({ title: `${name}: launch checklist`, description: 'Shopify launch checklist', theme: t, body, footer: `Admin paths checked against Shopify Help Center on ${LAUNCH.checked}.` }), 'text/html') : null;
    ctx.log(`Built ${text.plural(products.length, 'product')} in ${text.plural(rows.length, 'row')}${problems.length ? `, ${problems.length} problems` : ''}.`);
    return { products, csv, checklist, problems, rows: rows.length };
  },

  view(out) {
    return views.blocks(
      views.metric('Products in the CSV', out.products.length, `${text.plural(out.rows, 'row')}, imports as drafts`),
      out.problems.length ? views.text(`Check before importing: ${out.problems.slice(0, 3).join('; ')}`) : null,
      views.table(
        [
          { key: 'title', label: 'Product' },
          { key: 'price', label: 'Price', format: 'money' },
          { key: 'options', label: 'Options' },
          { key: 'missing', label: 'Still to add' },
        ],
        out.products,
        10
      ),
      views.file(out.csv, 'Shopify product CSV (Products > Import)'),
      views.file(out.checklist, 'Launch checklist'),
      views.copy('Import steps', C.SPEC.importSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
    );
  },
};
