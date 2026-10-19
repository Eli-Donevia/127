// Reads a Shopify store the way a sharp freelancer would in 20 minutes, in a few seconds and a dozen
// polite requests: the public product feed (/products.json, paged, 250 at a time), /collections.json,
// /meta.json, the homepage and one product page (apps, pixels, theme, policy links), and a handful of
// single-product files for image alt text. robots.txt is respected (Shopify's default robots.txt blocks
// /policies/, so we only look for links to those pages, we never open them). Public data only.
// Non-Shopify sites are named plainly. Sample hosts (.example) and sample runs read sample/stores.json.

const { web, text, scan } = require('../../_kit');
const { detectApps, hasEmailForm, themeOf } = require('./apps');

const PAGE = 250;
const DEPTH = {
  full: { maxPages: 4, altSample: 6, keepProducts: 60 },
  quick: { maxPages: 1, altSample: 2, keepProducts: 24 },
};

// "allbirds.com", "https://www.allbirds.com/products/x?y" -> { origin: "https://www.allbirds.com", host, handle }
function parseStoreInput(input) {
  const raw = String(input || '').trim();
  const url = web.normalizeUrl(raw);
  if (!url) return null;
  const u = new URL(url);
  const m = u.pathname.match(/\/products\/([a-z0-9][a-z0-9_-]*)/i);
  return { origin: `${u.protocol}//${u.host}`, host: u.host.toLowerCase(), domain: u.host.replace(/^www\./, '').toLowerCase(), handle: m ? m[1].toLowerCase() : null };
}

function isSampleHost(host) {
  return /(^|\.)example(\.com)?$|\.example\.|\.test$|\.invalid$/i.test(String(host || ''));
}

// The kit's offline test ctx says "Network is off in this run." Treat that like sample mode so dev
// runs and tests without --live still show something; anywhere else a failed fetch is reported as is.
function offline(err) {
  return /network is off/i.test(String((err && err.message) || err || ''));
}

function median(a) {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function quantile(a, q) {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

function plainText(html) {
  return scan.textOf(String(html || '')).replace(/\s+/g, ' ').trim();
}

// Shopify CDN images resize with a width parameter.
function sized(src, width = 900) {
  if (!src || /^data:|^sample-art:/.test(src)) return src;
  if (!/cdn\.shopify\.com|\/cdn\/shop\//.test(src)) return src;
  return `${src}${src.includes('?') ? '&' : '?'}width=${width}`;
}

// One product from products.json (or a single product file) to the compact shape the pack uses.
// withBody keeps the description HTML (only for the one product a mock page is built from).
function normalizeProduct(p, origin, { withBody = false } = {}) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const images = Array.isArray(p.images) ? p.images : [];
  const prices = variants.map((v) => Number(v.price)).filter(Number.isFinite);
  const compares = variants.map((v) => Number(v.compare_at_price)).filter((n) => Number.isFinite(n) && n > 0);
  const price = prices.length ? Math.min(...prices) : null;
  const compareAt = compares.length ? Math.max(...compares) : null;
  const desc = plainText(p.body_html);
  const widths = images.map((i) => Number(i.width)).filter((n) => n > 0);
  const first = images[0] || null;
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const optionNames = (p.options || []).map((o) => (typeof o === 'string' ? o : o.name)).filter((n) => n && n !== 'Title');
  const out = {
    id: p.id || null,
    title: text.oneLine(p.title || ''),
    handle: p.handle || '',
    url: `${origin}/products/${p.handle}`,
    type: p.product_type || p.type || '',
    vendor: p.vendor || '',
    tags: tags.length,
    tagList: tags.slice(0, 12).map((t) => text.clip(t, 40)),
    words: desc ? desc.split(/\s+/).length : 0,
    text: text.clip(desc, withBody ? 1200 : 240),
    images: images.length,
    image: first ? first.src : null,
    // The product feed leaves alt out (null here = not checked); single-product files include it ('' = missing).
    imageList: images.slice(0, withBody ? 8 : 3).map((i) => ({ src: i.src, w: Number(i.width) || null, h: Number(i.height) || null, alt: Object.prototype.hasOwnProperty.call(i, 'alt') ? String(i.alt || '') : null })),
    minWidth: widths.length ? Math.min(...widths) : null,
    ratio: first && first.width && first.height ? round2(first.width / first.height) : null,
    variants: variants.length,
    options: optionNames,
    optionValues: (p.options || []).filter((o) => o && o.name && o.name !== 'Title').map((o) => ({ name: o.name, values: (o.values || []).slice(0, 12) })),
    variantImages: variants.filter((v) => v.featured_image || v.image_id).length,
    price,
    priceMax: prices.length ? Math.max(...prices) : null,
    compareAt: compareAt && price != null && compareAt > price ? compareAt : null,
    available: variants.some((v) => v.available !== false),
    soldOut: variants.length > 0 && variants.every((v) => v.available === false),
    requiresShipping: variants.some((v) => v.requires_shipping !== false),
    grams: variants.length ? Number(variants[0].grams) || 0 : 0,
    createdAt: p.created_at || null,
    updatedAt: p.updated_at || null,
    publishedAt: p.published_at || null,
  };
  if (withBody) out.bodyHtml = String(p.body_html || '').slice(0, 8000);
  return out;
}

// Numbers over every product read.
function catalogStats(products) {
  const n = products.length;
  const prices = products.map((p) => p.price).filter((x) => x != null);
  const imgs = products.map((p) => p.images);
  const words = products.map((p) => p.words);
  const ratios = new Set(products.map((p) => p.ratio).filter(Boolean).map((r) => (r > 1.05 ? 'wide' : r < 0.95 ? 'tall' : 'square')));
  const dates = (k) => products.map((p) => p[k]).filter(Boolean).sort();
  const created = dates('createdAt');
  const updated = dates('updatedAt');
  return {
    products: n,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceP25: round2(quantile(prices, 0.25)),
    priceMedian: round2(median(prices)),
    priceP75: round2(quantile(prices, 0.75)),
    priceMax: prices.length ? Math.max(...prices) : null,
    images: imgs.reduce((a, b) => a + b, 0),
    imagesPerProduct: n ? Math.round((imgs.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
    noImage: products.filter((p) => p.images === 0).length,
    oneImage: products.filter((p) => p.images === 1).length,
    lowRes: products.filter((p) => p.minWidth != null && p.minWidth < 1000).length,
    ratioKinds: [...ratios],
    thin: products.filter((p) => p.words < 50).length,
    empty: products.filter((p) => p.words === 0).length,
    wordsMedian: median(words),
    variantsAvg: n ? round2(products.reduce((a, p) => a + p.variants, 0) / n) : 0,
    variantsMax: n ? Math.max(...products.map((p) => p.variants)) : 0,
    withVariants: products.filter((p) => p.variants > 1).length,
    variantsNoImages: products.filter((p) => p.variants > 1 && p.images <= 1).length,
    soldOut: products.filter((p) => p.soldOut).length,
    onSale: products.filter((p) => p.compareAt).length,
    untyped: products.filter((p) => !p.type).length,
    untagged: products.filter((p) => !p.tags).length,
    longTitles: products.filter((p) => p.title.length > 70).length,
    types: [...new Set(products.map((p) => p.type).filter(Boolean))].length,
    vendors: [...new Set(products.map((p) => p.vendor).filter(Boolean))].length,
    newest: created.length ? created[created.length - 1] : null,
    oldest: created.length ? created[0] : null,
    lastUpdated: updated.length ? updated[updated.length - 1] : null,
  };
}

// Links to the pages a buyer checks before paying. Hrefs only: /policies/ is blocked to bots.
const PAGE_RULES = [
  ['shipping', /\/policies\/shipping-policy|\/pages\/[^"'?#]*shipping|\bshipping\b/i],
  ['returns', /\/policies\/refund-policy|\/pages\/[^"'?#]*(return|refund|exchange)|\b(returns?|refunds?|exchanges?)\b/i],
  ['faq', /\/pages\/[^"'?#]*(faq|questions)|\b(faqs?|questions)\b/i],
  ['contact', /\/pages\/contact|\bcontact\b/i],
  ['about', /\/pages\/[^"'?#]*(about|story|mission)|\b(about|our story)\b/i],
  ['privacy', /\/policies\/privacy-policy|\bprivacy\b/i],
  ['terms', /\/policies\/terms-of-service|\bterms\b/i],
  ['sizeGuide', /\/pages\/[^"'?#]*size|\bsize (guide|chart)\b/i],
  ['reviewsPage', /\/pages\/[^"'?#]*reviews|\b(reviews|testimonials)\b/i],
  ['blog', /\/blogs\//i],
];

function pagesFrom(html, origin) {
  const out = Object.fromEntries(PAGE_RULES.map(([k]) => [k, null]));
  const host = new URL(origin).host.replace(/^www\./, '');
  for (const a of String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []) {
    const href = (a.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!href || /^(mailto|tel|javascript):|^#/i.test(href)) continue;
    let abs;
    try {
      abs = new URL(href, origin);
    } catch {
      continue;
    }
    if (abs.host.replace(/^www\./, '') !== host) continue;
    if (!/^\/(pages|policies|blogs)\//.test(abs.pathname)) continue;
    const label = `${plainText(a).toLowerCase()} ${abs.pathname.toLowerCase()}`;
    for (const [k, re] of PAGE_RULES) {
      if (!out[k] && re.test(label)) {
        out[k] = abs.toString();
        break;
      }
    }
  }
  return out;
}

// "Free shipping on orders over $50" -> { text, amount: 50 }; "Free US shipping" -> { amount: null }.
function freeShippingFrom(pageText) {
  const t = String(pageText || '');
  const m = t.match(/free\s+(?:standard\s+|ground\s+|domestic\s+|us\s+|u\.s\.\s+|2-day\s+)?shipping(?:[^.$\n]{0,40}?\$\s?(\d{1,4}(?:\.\d{2})?))?/i);
  if (!m) return null;
  return { text: text.clip(m[0].replace(/\s+/g, ' '), 90), amount: m[1] ? Number(m[1]) : null };
}

// Not Shopify? Name what it is.
const ECOM = [
  ['WooCommerce', /woocommerce|wc-ajax|wp-content\/plugins\/woocommerce/i],
  ['BigCommerce', /cdn\d*\.bigcommerce\.com|bigcommerce\.com\/s-/i],
  ['Squarespace', /static1\.squarespace\.com|squarespace-cdn|Static\.SQUARESPACE_CONTEXT/i],
  ['Wix', /static\.wixstatic\.com|wix-warmup-data|_wixCIDX/i],
  ['Ecwid', /app\.ecwid\.com|ecwid/i],
  ['Big Cartel', /bigcartel/i],
  ['Square Online', /square\.site|squareup\.com\/online-store|editmysite\.com/i],
  ['Magento', /mage\/cookies|Magento_|static\/version\d+\/frontend/i],
  ['PrestaShop', /prestashop/i],
  ['Salesforce Commerce', /demandware/i],
  ['Webflow', /data-wf-site|website-files\.com/i],
];

function platformOf(html) {
  const s = String(html || '');
  if (/cdn\.shopify\.com|Shopify\.theme|myshopify\.com|shopify-section|\/cdn\/shop\//i.test(s)) return 'Shopify';
  const hit = ECOM.find(([, re]) => re.test(s));
  if (hit) return hit[0];
  try {
    return scan.parsePage(s, 'https://example.com/').platform || null;
  } catch {
    return null;
  }
}

function isPasswordPage(url, html) {
  return /\/password\b/.test(String(url || '')) || /<form[^>]+action=["'][^"']*\/password["']/i.test(String(html || ''));
}

// Online Store 2.0 themes render JSON templates, so product page sections get ids like
// "shopify-section-template--1234__main". Older themes use "shopify-section-product-template".
function os2Of(html) {
  const s = String(html || '');
  if (/shopify-section-template--/.test(s)) return true;
  if (/shopify-section-(product-template|collection-template|index-)/.test(s)) return false;
  return null;
}

// Homepage facts beyond apps: title, description, email form, socials, colors, logo, free shipping.
function homeFacts(html, url) {
  const page = scan.parsePage(html, url);
  const words = plainText(html);
  return {
    title: page.title,
    description: page.description,
    h1: page.h1,
    socials: page.socials,
    colors: page.colors,
    logo: page.images && page.images.logo,
    ogImage: page.images && page.images.ogImage,
    emails: (page.contacts && page.contacts.emails) || [],
    phones: (page.contacts && page.contacts.phones) || [],
    emailForm: hasEmailForm(html),
    freeShipping: freeShippingFrom(words),
    mobileReady: page.mobileReady,
    words: page.words,
  };
}

function pick(arr, n) {
  if (arr.length <= n) return arr.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * (arr.length - 1)) / Math.max(1, n - 1))]);
  return [...new Set(out)];
}

// "Allbirds | Sustainable Shoes" -> "Allbirds"
function storeName(meta, home, domain) {
  if (meta && meta.name) return text.oneLine(meta.name);
  const t = (home && home.title) || '';
  const first = t.split(/\s+[|–—-]\s+|\s*\|\s*|:\s+/)[0].trim();
  return first || domain;
}

const statusReason = (home, domain) =>
  home.blocked
    ? `${domain} asks bots not to read its homepage, so we stopped there.`
    : home.status
      ? `${domain} answered with an error (${home.status}).`
      : home.error === 'timeout'
        ? `${domain} took too long to answer.`
        : `We couldn't reach ${domain}. Check the address and try again.`;

// Requests to one store go one at a time with a short pause, and a 429 (too many requests) waits and
// tries once more. Big stores rate-limit fast readers; we would rather be slow than rude.
function politeGetter(ctx) {
  let last = 0;
  const pace = async () => {
    const wait = Math.max(0, last + 400 - Date.now());
    if (wait) await web.sleep(wait, ctx && ctx.signal);
  };
  const retryAfter = (r) => {
    const v = Number(r && r.headers && typeof r.headers.get === 'function' ? r.headers.get('retry-after') : NaN);
    return Math.min(6000, Number.isFinite(v) && v > 0 ? v * 1000 : 2500);
  };
  return {
    async json(url, opts) {
      await pace();
      let r = await web.getJson(ctx, url, opts);
      last = Date.now();
      if (r.status === 429) {
        await web.sleep(retryAfter(r), ctx && ctx.signal);
        r = await web.getJson(ctx, url, opts);
        last = Date.now();
      }
      return r;
    },
    async page(url, opts) {
      await pace();
      const r = await web.fetchPage(ctx, url, opts);
      last = Date.now();
      return r;
    },
  };
}

// The whole read. Returns a plain object; never throws for a store that's down or not Shopify.
// depth: 'full' (up to 1,000 products, 6 alt samples) or 'quick' (first 250 products, 2 samples).
async function readStore(ctx, storeInput, { depth = 'full' } = {}) {
  const opts = DEPTH[depth] || DEPTH.full;
  const parsed = parseStoreInput(storeInput);
  if (!parsed) return { ok: false, status: 'bad_url', reason: "That doesn't look like a web address. Try something like yourstore.com.", input: String(storeInput || '') };
  const sample = require('./sample');
  if (isSampleHost(parsed.host) || (ctx && ctx.sample)) return sample.sampleStore(parsed, { depth, asked: parsed.host });
  try {
    return await web.cached(ctx, `shop:read:v2:${parsed.host}:${parsed.handle || ''}:${depth}`, 12, () => readLive(ctx, parsed, opts, depth));
  } catch (e) {
    if (offline(e)) return sample.sampleStore(parsed, { depth, asked: parsed.host, offline: true });
    throw e;
  }
}

async function readLive(ctx, parsed, opts, depth) {
  const { origin, domain } = parsed;
  const get = politeGetter(ctx);
  const base = { ok: false, sample: false, depth, url: `${origin}/`, domain, origin, handle: parsed.handle, fetchedAt: new Date(ctx && ctx.now ? ctx.now() : Date.now()).toISOString() };
  const home = await web.fetchPage(ctx, `${origin}/`);
  if (!home.html) {
    if (home.error && ctx && ctx.fetch) {
      // Find out whether the network itself is off (tests) before blaming the store.
      try {
        await ctx.fetch(`${origin}/robots.txt`, { method: 'HEAD' });
      } catch (e) {
        if (offline(e)) throw e;
      }
    }
    return { ...base, status: home.blocked ? 'blocked' : 'unreachable', reason: statusReason(home, domain) };
  }
  if (isPasswordPage(home.url, home.html)) {
    return { ...base, status: 'password', platform: 'Shopify', shopify: true, reason: `${domain} is a Shopify store behind a password page, so it isn't open to shoppers yet.` };
  }
  const finalOrigin = new URL(home.url).origin;
  const platform = platformOf(home.html);
  const feedUrl = `${finalOrigin}/products.json`;
  const feedAllowed = await web.allowed(ctx, feedUrl);
  let raw = [];
  let feed = false;
  if (feedAllowed) {
    for (let page = 1; page <= opts.maxPages; page++) {
      let r;
      try {
        r = await get.json(`${feedUrl}?limit=${PAGE}&page=${page}`, { timeoutMs: 20000, maxBytes: 12e6 });
      } catch {
        break;
      }
      if (!r.ok || !r.data || !Array.isArray(r.data.products)) break;
      feed = true;
      raw = raw.concat(r.data.products);
      if (r.data.products.length < PAGE) break;
    }
  }
  const homeInfo = homeFacts(home.html, home.url);
  if (!feed) {
    if (platform === 'Shopify') {
      return {
        ...base,
        status: 'feed_off',
        platform,
        shopify: true,
        name: storeName(null, homeInfo, domain),
        reason: `${domain} runs on Shopify, but its public product feed is turned off (often a custom storefront). We can only check what the homepage shows.`,
        home: homeInfo,
        ...detectApps([home.html]),
        theme: themeOf(home.html),
        pages: pagesFrom(home.html, finalOrigin),
      };
    }
    return {
      ...base,
      status: 'not_shopify',
      platform: platform || null,
      shopify: false,
      name: storeName(null, homeInfo, domain),
      home: homeInfo,
      reason: platform ? `${domain} isn't a Shopify store. It runs on ${platform}.` : `${domain} isn't a Shopify store (it has no Shopify product feed).`,
    };
  }
  const meta = await (async () => {
    try {
      const r = await get.json(`${finalOrigin}/meta.json`, { timeoutMs: 10000 });
      return r.ok && r.data && typeof r.data === 'object' ? r.data : null;
    } catch {
      return null;
    }
  })();
  const collections = await (async () => {
    try {
      const r = await get.json(`${finalOrigin}/collections.json?limit=${PAGE}`, { timeoutMs: 15000, maxBytes: 4e6 });
      return r.ok && r.data && Array.isArray(r.data.collections) ? r.data.collections : null;
    } catch {
      return null;
    }
  })();
  const products = raw.map((p) => normalizeProduct(p, finalOrigin));
  const live = products.filter((p) => p.images > 0 && p.price != null && !p.soldOut);
  // The product a mock page is built from: the one asked for, else the newest product with photos.
  const byNew = live.slice().sort((a, b) => String(b.publishedAt || b.createdAt || '').localeCompare(String(a.publishedAt || a.createdAt || '')));
  const asked = parsed.handle && raw.find((p) => p.handle === parsed.handle);
  const targetRaw = asked || raw.find((p) => byNew[0] && p.handle === byNew[0].handle) || raw[0];
  // One product page for apps that only load there (reviews widgets usually do).
  let pdpHtml = '';
  if (targetRaw) {
    const r = await get.page(`${finalOrigin}/products/${targetRaw.handle}`);
    if (r.html) pdpHtml = r.html;
  }
  // Alt text lives only in single-product files: read a few, spread across the catalog.
  const sampleSet = pick(live.length ? live : products, opts.altSample);
  if (targetRaw && !sampleSet.some((p) => p.handle === targetRaw.handle)) sampleSet.unshift(products.find((p) => p.handle === targetRaw.handle));
  const full = {};
  let altImages = 0;
  let altMissing = 0;
  let altProducts = 0;
  for (const p of sampleSet.filter(Boolean).slice(0, opts.altSample + 1)) {
    if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
    try {
      const r = await get.json(`${finalOrigin}/products/${p.handle}.json`, { timeoutMs: 12000 });
      const prod = r.ok && r.data && r.data.product;
      if (!prod) continue;
      altProducts++;
      for (const im of prod.images || []) {
        altImages++;
        if (!String(im.alt || '').trim()) altMissing++;
      }
      full[p.handle] = prod;
    } catch {
      /* skip this one */
    }
  }
  const { apps, pixels } = detectApps([home.html, pdpHtml]);
  if (meta && meta.offers_shop_pay_installments && !apps.bnpl.includes('Shop Pay Installments')) apps.bnpl.push('Shop Pay Installments');
  // Some stores show reviews with their own code: star ratings in the product's structured data count too.
  if (!apps.reviews.length && /"aggregateRating"\s*:/.test(pdpHtml)) apps.reviews.push('Star ratings in page data');
  const stats = catalogStats(products);
  const keep = products
    .slice()
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, opts.keepProducts)
    .map((p) => (full[p.handle] ? { ...p, imageList: normalizeProduct(full[p.handle], finalOrigin).imageList } : p));
  const target = targetRaw ? normalizeProduct(full[targetRaw.handle] || targetRaw, finalOrigin, { withBody: true }) : null;
  // One short row per product for the issues sheet (the tool keeps it out of its output).
  const rows = products.map(rowOf);
  return {
    ...base,
    ok: true,
    status: 'open',
    platform: 'Shopify',
    shopify: true,
    url: `${finalOrigin}/`,
    origin: finalOrigin,
    name: storeName(meta, homeInfo, domain),
    meta: meta
      ? {
          name: meta.name || null,
          description: meta.description ? text.clip(meta.description, 300) : null,
          currency: meta.currency || null,
          country: meta.country || null,
          city: meta.city || null,
          province: meta.province || null,
          shipsTo: Array.isArray(meta.ships_to_countries) ? meta.ships_to_countries.slice(0, 40) : [],
          productCount: Number.isFinite(meta.published_products_count) ? meta.published_products_count : null,
          collectionCount: Number.isFinite(meta.published_collections_count) ? meta.published_collections_count : null,
          shopPayInstallments: !!meta.offers_shop_pay_installments,
        }
      : null,
    productsRead: products.length,
    productsTotal: meta && Number.isFinite(meta.published_products_count) ? Math.max(meta.published_products_count, products.length) : products.length,
    capped: raw.length >= opts.maxPages * PAGE,
    stats,
    products: keep,
    target,
    collections: (collections || []).slice(0, 40).map((c) => ({ title: text.clip(c.title, 60), handle: c.handle, count: Number.isFinite(c.products_count) ? c.products_count : null, image: !!c.image, description: !!plainText(c.description) })),
    collectionsCount: collections ? collections.length : meta && Number.isFinite(meta.published_collections_count) ? meta.published_collections_count : null,
    home: homeInfo,
    pages: pagesFrom(home.html + pdpHtml, finalOrigin),
    apps,
    pixels,
    theme: themeOf(home.html),
    os2: os2Of(pdpHtml || home.html),
    alt: { products: altProducts, images: altImages, missing: altMissing },
    pdpChecked: !!pdpHtml,
    rows,
  };
}

function rowOf(p) {
  return { handle: p.handle, title: p.title, url: p.url, type: p.type, price: p.price, images: p.images, words: p.words, minWidth: p.minWidth, variants: p.variants, soldOut: p.soldOut, updatedAt: p.updatedAt };
}

// One product with its description, for a mock page: /products/<handle>.json (one request).
async function readProduct(ctx, storeUrl, handle) {
  const parsed = parseStoreInput(storeUrl);
  if (!parsed || !handle) return null;
  const sample = require('./sample');
  if (isSampleHost(parsed.host) || (ctx && ctx.sample)) return sample.sampleProduct(parsed, handle);
  try {
    return await web.cached(ctx, `shop:product:v1:${parsed.host}:${handle}`, 12, async () => {
      const r = await web.getJson(ctx, `${parsed.origin}/products/${handle}.json`, { timeoutMs: 12000 });
      const prod = r.ok && r.data && r.data.product;
      return prod ? normalizeProduct(prod, parsed.origin, { withBody: true }) : null;
    });
  } catch (e) {
    if (offline(e)) return sample.sampleProduct(parsed, handle);
    return null;
  }
}

// A light look at any site (shops on a map, stockist candidates): homepage only, plus the first page
// of the product feed when it's Shopify and `catalog` is asked for. fitRx counts products that match.
async function probeSite(ctx, url, { catalog = false, fitRx = null } = {}) {
  const parsed = parseStoreInput(url);
  if (!parsed) return { ok: false, status: 'bad_url', url: String(url || '') };
  const sample = require('./sample');
  if (isSampleHost(parsed.host) || (ctx && ctx.sample)) return sample.sampleProbe(parsed, { catalog, fitRx });
  const key = `shop:probe:v1:${parsed.host}:${catalog ? 1 : 0}:${fitRx ? fitRx.source.slice(0, 60) : ''}`;
  try {
    return await web.cached(ctx, key, 24, () => probeLive(ctx, parsed, { catalog, fitRx }));
  } catch (e) {
    if (offline(e)) return sample.sampleProbe(parsed, { catalog, fitRx, offline: true });
    return { ok: false, status: 'unreachable', url: parsed.origin, domain: parsed.domain };
  }
}

const LOCAL_WORDS = /\b(local(ly)? (made|makers?|artists?|artisans?|goods|brands?)|handmade|hand-made|hand made|handcrafted|small[- ]batch|makers?\b|artisans?|independent (makers?|brands?|designers?)|made in [A-Z][a-z]+)\b/gi;

async function probeLive(ctx, parsed, { catalog, fitRx }) {
  const { origin, domain } = parsed;
  const home = await web.fetchPage(ctx, `${origin}/`);
  if (!home.html) {
    if (home.error && ctx && ctx.fetch) {
      try {
        await ctx.fetch(`${origin}/robots.txt`, { method: 'HEAD' });
      } catch (e) {
        if (offline(e)) throw e;
      }
    }
    return { ok: false, status: home.blocked ? 'blocked' : 'unreachable', url: `${origin}/`, domain, reason: statusReason(home, domain) };
  }
  const finalUrl = home.url || `${origin}/`;
  const platform = platformOf(home.html);
  const page = scan.parsePage(home.html, finalUrl);
  const words = plainText(home.html);
  const local = [...new Set((words.match(LOCAL_WORDS) || []).map((w) => w.toLowerCase()))].slice(0, 4);
  const fitHits = fitRx ? (words.match(new RegExp(fitRx.source, 'gi')) || []).length : 0;
  const out = {
    ok: true,
    status: isPasswordPage(finalUrl, home.html) ? 'password' : 'open',
    url: finalUrl,
    domain,
    platform: platform || null,
    shopify: platform === 'Shopify',
    title: page.title ? text.clip(page.title, 90) : null,
    description: page.description ? text.clip(page.description, 200) : null,
    emails: (page.contacts && page.contacts.emails) || [],
    phones: (page.contacts && page.contacts.phones) || [],
    socials: page.socials || {},
    emailForm: hasEmailForm(home.html),
    freeShipping: freeShippingFrom(words),
    local,
    fitHits,
    words: page.words,
    catalog: null,
  };
  if (catalog && out.shopify && out.status === 'open') {
    const feedUrl = `${new URL(finalUrl).origin}/products.json`;
    if (await web.allowed(ctx, feedUrl)) {
      try {
        const r = await web.getJson(ctx, `${feedUrl}?limit=${PAGE}`, { timeoutMs: 20000, maxBytes: 12e6 });
        if (r.ok && r.data && Array.isArray(r.data.products)) {
          const prods = r.data.products.map((p) => normalizeProduct(p, new URL(finalUrl).origin));
          const match = fitRx ? prods.filter((p) => fitRx.test(`${p.title} ${p.type} ${(p.tagList || []).join(' ')}`)) : [];
          const prices = match.map((p) => p.price).filter((x) => x != null);
          out.catalog = {
            count: prods.length,
            capped: prods.length >= PAGE,
            matches: match.length,
            matchTitles: match.slice(0, 3).map((p) => p.title),
            priceMin: prices.length ? Math.min(...prices) : null,
            priceMax: prices.length ? Math.max(...prices) : null,
            vendors: [...new Set(prods.map((p) => p.vendor).filter(Boolean))].length,
          };
        }
      } catch {
        /* homepage facts are enough */
      }
    }
  }
  return out;
}

module.exports = {
  readStore,
  rowOf,
  readProduct,
  probeSite,
  parseStoreInput,
  isSampleHost,
  offline,
  normalizeProduct,
  catalogStats,
  pagesFrom,
  freeShippingFrom,
  platformOf,
  isPasswordPage,
  os2Of,
  homeFacts,
  storeName,
  plainText,
  sized,
  median,
  quantile,
  pick,
  LOCAL_WORDS,
  DEPTH,
};
