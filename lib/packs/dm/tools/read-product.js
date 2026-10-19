// Reads the product the DM links to, from its own public page (JSON-LD, Open Graph, or Shopify's
// public product JSON), so the DM names the product and price exactly as the store shows them.
// A price typed by the member wins over the page.

const { views, text, money } = require('../../_kit');
const { readProduct, priceText } = require('../lib/product');

module.exports = {
  name: 'dm.read_product',
  title: 'Read your product page',
  description: "Reads a product's public page and pulls its name, price, photo and short description for your DMs. Works with Shopify and most stores.",
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      url: { type: 'string', title: 'Product link', maxLength: 500 },
      name: { type: 'string', title: 'Product name (optional)', maxLength: 120 },
      price: { type: 'string', title: 'Price (optional)', maxLength: 40 },
    },
    required: ['url'],
  },
  output: {
    type: 'object',
    properties: { status: { type: 'string' }, name: { type: 'string' }, url: { type: 'string' }, priceText: { type: 'string' } },
    required: ['status', 'name', 'url'],
  },
  async run(input, ctx) {
    ctx.log('Reading your product page');
    const p = await readProduct(ctx, input.url);
    const typedPrice = money.num(input.price, null);
    const out = { ...p };
    if (input.name) {
      out.name = text.oneLine(input.name);
      out.nameFrom = 'you';
    }
    if (typedPrice != null) {
      out.price = typedPrice;
      out.priceText = priceText(typedPrice, p.currency);
      out.priceFrom = 'you';
    } else if (p.price != null) out.priceFrom = 'page';
    if (!out.name) out.name = 'this product';
    return out;
  },
  view(out) {
    const where = out.status === 'read' ? `From ${out.source}.` : out.note || "We couldn't read the page, so check these before you go live.";
    return views.blocks(
      views.cards([{ title: out.name, subtitle: out.priceText || 'Price not found: add it in the form', body: text.clip(out.description || where, 400), image: out.image || undefined, href: /^https:\/\//.test(out.url) ? out.url : undefined }]),
      views.text(where)
    );
  },
};
