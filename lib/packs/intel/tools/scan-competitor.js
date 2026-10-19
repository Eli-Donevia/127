// Reads one competitor's own public pages (kit scan, robots respected) and, for Shopify stores, the
// public products.json: their offer, prices, booking, proof, channels, video, ads and email capture.

const { views, web, leads, text, places } = require('../../_kit');
const { shopifyCatalog, factsOf } = require('../lib/compete');
const { readClaims } = require('../lib/claims');

module.exports = {
  name: 'intel.scan_competitor',
  title: 'Read a competitor',
  description: "Reads a competitor's own website (and a Shopify store's public product list) for their offer, prices, booking, reviews, channels, video and ads.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      site: { type: 'object', title: 'Competitor', description: '{ website, name } from intel.read_sites, or a place from leads.find_businesses' },
      website: { type: 'string', title: 'Website', description: 'Used when site is not given' },
      claims: { type: 'boolean', title: 'Also read what they say they offer', description: 'Free quotes, weekend hours, a promise, text us... (Find the gap). Reads at most 2 more of their pages.' },
    },
  },
  output: { type: 'object', properties: { key: { type: 'string' }, name: { type: 'string' }, prices: { type: 'array' }, siteStatus: { type: 'string' }, claims: { type: ['object', 'null'] } }, required: ['key', 'name', 'prices', 'siteStatus'] },
  async run(input, ctx) {
    const place = input.site && typeof input.site === 'object' ? { ...input.site } : {};
    if (!place.website && input.website) place.website = web.normalizeUrl(input.website);
    if (!place.website) {
      if (place.name) return factsOf(place, null, null);
      throw new Error('Add a website to read.');
    }
    const scan = await leads.scanFor(ctx, place.website);
    let shop = null;
    const real = !leads.isSampleUrl(place.website);
    if (real && scan && scan.reachable && scan.platform === 'Shopify') shop = await shopifyCatalog(ctx, scan.url || place.website);
    // A bot wall on the homepage: a Shopify store's public product list may still answer.
    if (real && scan && !scan.reachable && /bot wall|asks bots|answered 40[36]/i.test(String(scan.reason || '') + String(leads.siteStatus(scan, place.website).reason))) {
      const s = await shopifyCatalog(ctx, place.website);
      if (s && s.products) shop = s;
    }
    const f = factsOf(place, scan, shop);
    if (shop && shop.products && !f.platform) f.platform = 'Shopify';
    if (input.claims && f.siteStatus === 'ok') f.claims = await readClaims(ctx, (scan && scan.url) || place.website);
    ctx.log(`Read ${text.clip(f.name, 40)}${f.prices.length ? `: ${f.prices.length} prices` : ''}`);
    return f;
  },
  view(c) {
    return [views.metric(c.name, c.offer || 'No offer on the homepage', c.prices.length ? `${c.prices.length} prices found` : 'No prices shown')];
  },
  viewMany(list) {
    const yes = (b) => (b ? 'Yes' : 'No');
    return views.blocks(
      views.metric('Competitors read', list.filter((c) => c.siteStatus === 'ok').length, `of ${list.length}`),
      views.table(
        [{ key: 'name', label: 'Competitor' }, { key: 'offer', label: 'Offer' }, { key: 'price', label: 'Prices seen' }, { key: 'book', label: 'Books online' }, { key: 'proof', label: 'Reviews shown' }, { key: 'video', label: 'Video' }],
        list.map((c) => ({ name: c.name, offer: text.clip(c.offer || 'None found', 60), price: c.shop && c.shop.median ? `Store median $${c.shop.median}` : c.prices.length ? c.prices.slice(0, 2).map((p) => `$${p.amount}${p.per ? ` / ${p.per}` : ''}`).join(', ') : 'None shown', book: yes(c.booking.length || c.shop), proof: yes(c.proof), video: yes(c.video) })),
        10
      ),
      ...places.creditBlocks(list)
    );
  },
};
