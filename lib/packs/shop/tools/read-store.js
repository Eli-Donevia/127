// shop.read_store: a quick summary of any Shopify store from its public product feed, for other packs
// (the ugc pack's brand lists, compare and price workflows). Two public requests, robots respected.
// Sample product art never leaves as an image address.

const { text, money, views } = require('../../_kit');
const { readFeed } = require('../lib/feed');

module.exports = {
  name: 'shop.read_store',
  title: 'Read a store summary',
  description: "Reads a Shopify store's public product feed and returns a short summary: product count, price range and median, newest listing date, photos per product, top product types and the newest products with prices and links.",
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      store: { type: 'string', title: 'Store address', maxLength: 300, description: 'Like yourstore.com. Any Shopify store.' },
      picks: { type: 'integer', minimum: 1, maximum: 12, default: 4, description: 'How many of the newest products to list.' },
    },
    required: ['store'],
  },
  output: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      status: { type: 'string' },
      reason: { type: 'string' },
      domain: { type: 'string' },
      name: { type: 'string' },
      url: { type: 'string' },
      country: { type: 'string' },
      currency: { type: 'string' },
      products: { type: 'integer' },
      price_low: { type: 'number' },
      price_high: { type: 'number' },
      price_median: { type: 'number' },
      newest: { type: 'string' },
      avg_images: { type: 'number' },
      types: { type: 'array' },
      picks: { type: 'array' },
      read: { type: 'string' },
      checked: { type: 'string' },
      sample: { type: 'boolean' },
    },
    required: ['ok', 'status'],
  },

  async run(input, ctx) {
    const out = await readFeed(ctx, input.store, { picks: input.picks || 4 });
    ctx.log(out.ok ? `Read ${out.name}: ${text.plural(out.products, 'product')}.` : out.reason);
    return out;
  },

  view(out) {
    if (!out.ok) return views.blocks(views.text(out.reason || "Couldn't read this store."));
    const range = out.price_low != null ? (out.price_low === out.price_high ? money.usd(out.price_low) : `${money.usd(out.price_low)} to ${money.usd(out.price_high)}`) : 'No prices';
    return views.blocks(
      views.sampleNote(out, 'This summary'),
      out.note ? views.text(out.note) : null,
      views.metric(out.name, out.products, `products, ${range}${out.newest ? `, newest listed ${out.newest}` : ''}`),
      out.types && out.types.length ? views.text(`Top product types: ${out.types.map((t) => `${t.type} (${t.count})`).join(', ')}.`) : null,
      views.table(
        [
          { key: 'title', label: 'Newest products' },
          { key: 'price', label: 'Price', format: 'money' },
          { key: 'images', label: 'Photos', format: 'number' },
          { key: 'url', label: 'Link', format: 'link' },
        ],
        out.picks || [],
        12
      )
    );
  },
};
