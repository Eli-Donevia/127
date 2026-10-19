// Public product data from any Shopify store, for other packs (UGC briefs, ads, content): titles,
// prices, photos, plain-text descriptions and links. Reads the store's public product feed only.

const { text, views } = require('../../_kit');
const { readStore, plainText } = require('../lib/store');
const art = require('../lib/art');

module.exports = {
  name: 'shop.read_products',
  title: 'Read store products',
  description: "Reads a Shopify store's public product feed and returns its newest products with title, price, photos, a plain-text description and the product link.",
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      store: { type: 'string', title: 'Store address', maxLength: 300, description: 'Like yourstore.com, or one product page address.' },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 12 },
    },
    required: ['store'],
  },
  output: { type: 'object', properties: { ok: { type: 'boolean' }, status: { type: 'string' }, reason: { type: 'string' }, store: { type: 'object' }, products: { type: 'array' }, sample: { type: 'boolean' } }, required: ['ok', 'products'] },

  async run(input, ctx) {
    const r = await readStore(ctx, input.store, { depth: 'quick' });
    const store = { name: r.name || r.domain || null, url: r.url || null, domain: r.domain || null, currency: (r.meta && r.meta.currency) || 'USD', products: r.productsTotal || 0 };
    if (!r.ok) return { ok: false, status: r.status, reason: r.reason || '', store, products: [], sample: !!r.sample };
    const limit = Math.min(50, input.limit || 12);
    const list = (r.products || []).slice();
    if (r.target) {
      const i = list.findIndex((p) => p.handle === r.target.handle);
      if (i > 0) list.unshift(list.splice(i, 1)[0]);
    }
    const products = list.slice(0, limit).map((p) => ({
      title: p.title,
      handle: p.handle,
      url: p.url,
      type: p.type || '',
      vendor: p.vendor || '',
      price: p.price,
      priceMax: p.priceMax,
      compareAt: p.compareAt || null,
      soldOut: !!p.soldOut,
      images: (p.imageList || []).map((i) => (art.isSampleArt(i.src) ? null : i.src)).filter(Boolean),
      image: art.isSampleArt(p.image) ? null : p.image || null,
      options: p.optionValues || [],
      tags: p.tagList || [],
      description: text.clip(p.text || (p.bodyHtml ? plainText(p.bodyHtml) : ''), 600),
      words: p.words || 0,
      photos: (p.imageList || []).length || Number(p.images) || 0,
    }));
    return { ok: true, status: 'open', reason: '', store, products, sample: !!r.sample };
  },

  view(out) {
    if (!out.ok) return views.blocks(views.text(out.reason || "Couldn't read this store."));
    return views.blocks(
      views.sampleNote(out, 'This list'),
      views.table(
        [
          { key: 'title', label: 'Product' },
          { key: 'price', label: 'Price', format: 'money' },
          { key: 'photos', label: 'Photos', format: 'number' },
          { key: 'url', label: 'Link', format: 'link' },
        ],
        out.products.map((p) => ({ title: p.title, price: p.price, photos: p.photos, url: p.url })),
        12
      )
    );
  },
};
