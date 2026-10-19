// A light read of one store's public product feed (/products.json, first 250 products) and /meta.json:
// the store summary other packs need (UGC briefs, brand lists, price comparisons) in two requests,
// robots respected, cached 12 hours. Field names match the ugc pack's brand reader (domain, name,
// country, products, price_low, price_high, newest, avg_images, picks[], read, checked).
// For the full audit (homepage, product pages, alt text) use lib/store.js readStore.

const { web, text, time } = require('../../_kit');
const { parseStoreInput, isSampleHost, offline, normalizeProduct } = require('./store');

const PAGE = 250;

function median(a) {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100;
}

// Raw feed products -> the summary. origin: the store's https origin.
function summarize(raw, origin, { meta = null, picks = 4 } = {}) {
  const products = raw.map((p) => normalizeProduct(p, origin));
  const prices = products.map((p) => p.price).filter((n) => Number.isFinite(n) && n > 0);
  let newest = '';
  let imgs = 0;
  for (const p of products) {
    const d = String(p.publishedAt || p.createdAt || '');
    if (d > newest) newest = d;
    imgs += p.images || 0;
  }
  const types = {};
  for (const p of products) if (p.type) types[p.type] = (types[p.type] || 0) + 1;
  const byNew = products
    .filter((p) => p.title && p.handle && p.price > 0)
    .sort((a, b) => String(b.publishedAt || b.createdAt || '').localeCompare(String(a.publishedAt || a.createdAt || '')));
  return {
    products: (meta && Number(meta.published_products_count)) || products.length,
    read_count: products.length,
    capped: raw.length >= PAGE,
    price_low: prices.length ? Math.min(...prices) : null,
    price_high: prices.length ? Math.max(...prices) : null,
    price_median: median(prices),
    newest: newest.slice(0, 10),
    avg_images: products.length ? Math.round((imgs / products.length) * 10) / 10 : 0,
    sold_out: products.filter((p) => p.soldOut).length,
    types: Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type: text.clip(type, 40), count })),
    picks: byNew.slice(0, picks).map((p) => ({
      title: text.clip(p.title, 90),
      handle: p.handle,
      url: p.url,
      price: p.price,
      compare_at: p.compareAt,
      images: p.images,
      listed: String(p.publishedAt || p.createdAt || '').slice(0, 10),
      image: /^https:\/\//.test(String(p.image || '')) ? p.image : null,
      sold_out: !!p.soldOut,
    })),
  };
}

function sampleRead(parsed, { picks, offline: off = false } = {}) {
  const sample = require('./sample');
  const real = !isSampleHost(parsed.host);
  const host = real ? sample.STORES.default : parsed.host;
  const spec = sample.specFor(host);
  const base = { domain: host, name: spec.name, url: `https://${host}/`, read: 'sample', checked: sample.SAMPLE_DATE.slice(0, 10), sample: true };
  const note = real ? `Sample data: this run didn't read ${parsed.domain}${off ? ' (no network)' : ''}. Run it live to read the real store.` : '';
  if (spec.status === 'password') return { ok: false, status: 'password', reason: `${host} is a Shopify store behind a password page, so it isn't open to shoppers yet.`, ...base, note };
  if (spec.status === 'not_shopify') return { ok: false, status: 'no_feed', reason: `${host} has no public Shopify product feed${spec.platform ? ` (it runs on ${spec.platform})` : ''}.`, ...base, note };
  const raw = sample.rawProducts(host, spec);
  const sum = summarize(raw, `https://${host}`, { picks });
  // Sample product art isn't a real address: never hand it to another pack as an image.
  sum.picks = sum.picks.map((p) => ({ ...p, image: null }));
  return { ok: true, status: 'open', reason: '', ...base, country: 'US', currency: 'USD', ...sum, note };
}

async function readLive(ctx, parsed, { picks }) {
  const { origin, domain } = parsed;
  const base = { domain, name: domain, url: `${origin}/`, read: 'live', checked: time.today(ctx), sample: false };
  if (!(await web.allowed(ctx, `${origin}/products.json`))) return { ok: false, status: 'blocked', reason: `${domain} asks bots not to read its product feed, so we left it alone.`, ...base };
  const data = (r) => (r && r.ok && r.data && typeof r.data === 'object' ? r.data : null);
  const [meta, pj] = await Promise.all([
    web.getJson(ctx, `${origin}/meta.json`, { timeoutMs: 10000, maxBytes: 400000 }).then(data).catch((e) => {
      if (offline(e)) throw e;
      return null;
    }),
    web.getJson(ctx, `${origin}/products.json?limit=${PAGE}`, { timeoutMs: 20000, maxBytes: 12e6 }).then(data).catch((e) => {
      if (offline(e)) throw e;
      return null;
    }),
  ]);
  if (!pj || !Array.isArray(pj.products)) return { ok: false, status: 'no_feed', reason: `${domain} has no public Shopify product feed. It may not be a Shopify store, or the feed is turned off.`, ...base };
  if (!pj.products.length) return { ok: false, status: 'empty', reason: `${domain} is on Shopify but shows no products yet.`, ...base };
  const name = text.clip(text.oneLine((meta && meta.name) || ''), 60) || domain;
  return { ok: true, status: 'open', reason: '', ...base, name, country: (meta && meta.country) || '', currency: (meta && meta.currency) || 'USD', ...summarize(pj.products, origin, { meta, picks }) };
}

// storeInput: "shop.com" or any URL on it. -> { ok, status, reason, domain, name, url, country, currency,
// products, read_count, capped, price_low, price_high, price_median, newest, avg_images, sold_out,
// types[], picks[], read: 'live'|'sample', checked, sample, note? }
async function readFeed(ctx, storeInput, { picks = 4 } = {}) {
  const parsed = parseStoreInput(storeInput);
  if (!parsed) return { ok: false, status: 'bad_url', reason: "That doesn't look like a web address. Try something like yourstore.com.", domain: '', name: '', url: '', read: 'none', sample: false };
  const n = Math.max(1, Math.min(12, Number(picks) || 4));
  if (isSampleHost(parsed.host) || (ctx && ctx.sample)) return sampleRead(parsed, { picks: n });
  try {
    return await web.cached(ctx, `shop:feed:v1:${parsed.host}:${n}`, 12, () => readLive(ctx, parsed, { picks: n }));
  } catch (e) {
    if (offline(e)) return sampleRead(parsed, { picks: n, offline: true });
    if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
    return { ok: false, status: 'unreachable', reason: `We couldn't reach ${parsed.domain} just now. Check the address, or try again in a minute.`, domain: parsed.domain, name: parsed.domain, url: `${parsed.origin}/`, read: 'live', sample: false };
  }
}

module.exports = { readFeed, summarize, median };
