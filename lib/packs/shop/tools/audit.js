// shop.audit_store's tool, and the audit step inside the pitch and compare workflows.

const { text, money, files, save, views, brain } = require('../../_kit');
const { readStore, catalogStats } = require('../lib/store');
const A = require('../lib/audit');
const report = require('../lib/report');

const STATUS_TITLE = {
  bad_url: "That isn't a store address",
  not_shopify: "This store isn't on Shopify",
  password: 'This store is behind a password',
  feed_off: 'The product feed is turned off',
  unreachable: "We couldn't reach this store",
  blocked: 'This store asks bots not to read it',
};

module.exports = {
  name: 'shop.audit',
  title: 'Audit a Shopify store',
  description: "Reads a Shopify store's public product feed, collections, homepage and one product page, scores it on photos, descriptions, alt text, reviews, email signup, shipping and returns pages and apps, and ranks the fixes. Saves a report page and a product-by-product issues sheet.",
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      store: { type: 'string', title: 'Store address', description: 'Like yourstore.com, or a product page address to audit that product.', maxLength: 300 },
      depth: { type: 'string', enum: ['full', 'quick'], default: 'full', description: 'quick reads the first 250 products.' },
      files: { type: 'boolean', default: true, description: 'Save the report page and issues sheet.' },
      name: { type: 'string', title: 'Store name (optional)', maxLength: 120 },
    },
    required: ['store'],
  },
  output: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      status: { type: 'string' },
      reason: { type: 'string' },
      store: { type: 'object' },
      score: { type: 'integer' },
      grade: { type: 'string' },
      fixes: { type: 'array' },
      strengths: { type: 'array' },
      numbers: { type: 'object' },
      pitch: { type: 'object' },
      report: { type: 'object' },
      issues: { type: 'object' },
      sample: { type: 'boolean' },
    },
    required: ['ok', 'status', 'store'],
  },

  async run(input, ctx) {
    const asked = String(input.store || '').trim();
    ctx.log(`Reading ${asked}`);
    const r = await readStore(ctx, asked, { depth: input.depth || 'full' });
    const storeInfo = {
      name: input.name || r.name || r.domain || asked,
      url: r.url || null,
      domain: r.domain || null,
      platform: r.platform || null,
      products: r.productsTotal || null,
      productsRead: r.productsRead || null,
      capped: !!r.capped,
      theme: r.theme ? r.theme.name : null,
      note: r.note || null,
    };
    if (!r.ok && r.status !== 'feed_off') {
      ctx.log(r.reason || 'Not a store we can read.');
      return { ok: false, status: r.status, reason: r.reason || 'Not a store we can read.', store: storeInfo, sample: !!r.sample };
    }
    const read = r.stats ? r : { ...r, stats: catalogStats([]), products: [], rows: [], productsTotal: 0, productsRead: 0 };
    const a = A.audit(read);
    if (r.ok) ctx.log(`Read ${money.int(r.productsRead)} of ${money.int(r.productsTotal)} products. Score ${a.score}: ${text.plural(a.fixes.length, 'fix', 'fixes')}.`);
    const out = {
      ok: !!r.ok,
      status: r.status,
      reason: r.reason || '',
      store: storeInfo,
      score: a.score,
      grade: a.grade,
      fixes: a.fixes.slice(0, 12),
      strengths: a.strengths.slice(0, 10),
      numbers: {
        products: read.productsTotal,
        priceMin: read.stats.priceMin,
        priceMax: read.stats.priceMax,
        priceMedian: read.stats.priceMedian,
        photosPerProduct: read.stats.imagesPerProduct,
        oneImage: read.stats.oneImage,
        wordsMedian: read.stats.wordsMedian,
        thin: read.stats.thin,
        soldOut: read.stats.soldOut,
        altMissing: read.alt ? read.alt.missing : null,
        altChecked: read.alt ? read.alt.images : null,
        apps: Object.fromEntries(Object.entries(read.apps || {}).filter(([, v]) => v.length)),
        pixels: read.pixels || {},
        pages: Object.fromEntries(Object.entries(read.pages || {}).filter(([, v]) => v)),
        collections: read.collectionsCount,
      },
      pitch: r.ok ? A.pitchData(read, a) : null,
      sample: !!r.sample,
    };
    if (input.files !== false) {
      const by = brain.brainOf(ctx, {}).name || '';
      const html = report.auditHtml(read, a, { by, now: ctx.now() });
      const base = text.slug(storeInfo.name || storeInfo.domain || 'store', 40);
      out.report = await save.saveFile(ctx, save.fileName(base, 'store audit', '.html'), html, 'text/html');
      const rows = report.issuesRows(read, a);
      if (rows.length) {
        out.issues = await save.saveFile(
          ctx,
          save.fileName(base, 'product issues', '.csv'),
          files.csv(rows, [
            { key: 'title', label: 'Product' },
            { key: 'url', label: 'Link' },
            { key: 'price', label: 'Price' },
            { key: 'photos', label: 'Photos' },
            { key: 'words', label: 'Words in description' },
            { key: 'sold_out', label: 'Sold out' },
            { key: 'issues', label: 'What to fix' },
          ]),
          'text/csv'
        );
      }
    }
    return out;
  },

  view(out) {
    if (!out.ok && out.status !== 'feed_off') {
      return views.blocks(views.text(`${STATUS_TITLE[out.status] || 'Nothing to audit'}. ${out.reason}`), out.status === 'not_shopify' ? views.text('This audit reads Shopify stores only, because it uses the product feed every Shopify store publishes.') : null);
    }
    return views.blocks(
      views.sampleNote(out, 'This audit'),
      out.store.note ? views.text(out.store.note) : null,
      out.status === 'feed_off' ? views.text(out.reason) : null,
      views.metric('Store score', out.score, `${out.grade}. ${out.store.name}, ${money.int(out.numbers.products || 0)} products`),
      out.fixes.length
        ? views.table(
            [
              { key: 'n', label: '#', format: 'number' },
              { key: 'title', label: 'Fix' },
              { key: 'evidence', label: 'What we saw' },
              { key: 'impact', label: 'Impact' },
            ],
            out.fixes.map((f, i) => ({ n: i + 1, title: f.title, evidence: f.evidence, impact: f.impact })),
            6
          )
        : views.text('Nothing big to fix. The report lists what is already working.'),
      views.file(out.report, 'Audit report (open in a browser, print or send as a PDF)'),
      views.file(out.issues, 'Product by product issues sheet')
    );
  },

  // Many stores at once (the pitch and compare workflows): one ranked table.
  viewMany(outs) {
    const ok = outs.filter((o) => o && o.ok);
    const skipped = outs.length - ok.length;
    return views.blocks(
      views.table(
        [
          { key: 'name', label: 'Store' },
          { key: 'score', label: 'Score', format: 'number' },
          { key: 'top', label: 'Biggest gap' },
          { key: 'products', label: 'Products', format: 'number' },
          { key: 'url', label: 'Site', format: 'link' },
        ],
        ok
          .slice()
          .sort((a, b) => a.score - b.score)
          .map((o) => ({ name: o.store.name, score: o.score, top: o.fixes[0] ? o.fixes[0].title : 'Nothing big', products: o.numbers.products || 0, url: o.store.url })),
        10
      ),
      skipped ? views.text(`${text.plural(skipped, 'site')} couldn't be audited (not Shopify, password page or unreachable).`) : null
    );
  },
};
