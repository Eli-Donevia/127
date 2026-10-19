// Reads a product's public page: JSON-LD Product data and Open Graph tags first (one request), then
// Shopify's public product JSON (/products/<handle>.json) when the page leaves the price out.
// Only facts the page states; nothing is guessed except a readable name from the link itself,
// which is marked as such.

const { web, text, money } = require('../../_kit');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: '...', ndash: '-', mdash: '-' };
function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => (ENT[n.toLowerCase()] != null ? ENT[n.toLowerCase()] : m));
}

function stripTags(html) {
  return decode(String(html || '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '. ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .trim();
}

function metaContent(html, key) {
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const name = (tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (name && name.toLowerCase() === key) {
      const c = tag.match(/\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (c) return decode(c[2] != null ? c[2] : c[3]);
    }
  }
  return null;
}

// Every JSON-LD object on the page, flattened (@graph and arrays).
function jsonLd(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      const walk = (x) => {
        if (Array.isArray(x)) x.forEach(walk);
        else if (x && typeof x === 'object') {
          out.push(x);
          if (x['@graph']) walk(x['@graph']);
        }
      };
      walk(data);
    } catch {
      /* broken JSON-LD: skip */
    }
  }
  return out;
}

function isType(o, t) {
  const v = o && o['@type'];
  return Array.isArray(v) ? v.includes(t) : v === t;
}

function priceOfOffers(offers) {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  let best = null;
  let currency = null;
  for (const o of list) {
    const p = money.num(o.price != null ? o.price : o.lowPrice, null);
    if (p != null && (best == null || p < best)) {
      best = p;
      currency = o.priceCurrency || currency;
    }
  }
  return { price: best, currency };
}

function imageOf(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return imageOf(v[0]);
  return v.url || v.contentUrl || '';
}

function priceText(price, currency) {
  if (price == null) return '';
  if (!currency || /^usd$/i.test(currency)) return money.usd(price);
  return `${money.round(price, 2)} ${String(currency).toUpperCase()}`;
}

// From the page's HTML. Returns null when the page has no product facts at all.
function fromHtml(html, url) {
  const product = jsonLd(html).find((o) => isType(o, 'Product') || isType(o, 'ProductGroup'));
  let name = '';
  let description = '';
  let image = '';
  let price = null;
  let currency = null;
  if (product) {
    name = text.oneLine(decode(product.name || ''));
    description = stripTags(product.description || '');
    image = imageOf(product.image);
    const p = priceOfOffers(product.offers || (product.hasVariant && product.hasVariant.map((v) => v.offers).flat()));
    price = p.price;
    currency = p.currency;
  }
  name = name || text.oneLine(metaContent(html, 'og:title') || '');
  description = description || stripTags(metaContent(html, 'og:description') || metaContent(html, 'description') || '');
  image = image || metaContent(html, 'og:image') || '';
  if (price == null) {
    price = money.num(metaContent(html, 'product:price:amount') || metaContent(html, 'og:price:amount'), null);
    currency = currency || metaContent(html, 'product:price:currency') || metaContent(html, 'og:price:currency');
  }
  if (!name && price == null) return null;
  const shopify = /cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(html);
  return { name, description: text.clip(description, 300), image: /^https?:\/\//.test(image) ? image : image ? new URL(image, url).toString() : '', price, currency: currency || null, shopify };
}

// Shopify's public product JSON: /products/<handle>.json
function fromShopifyJson(data) {
  const p = data && data.product;
  if (!p || !p.title) return null;
  const prices = (p.variants || []).map((v) => money.num(v.price, null)).filter((n) => n != null);
  return {
    name: text.oneLine(p.title),
    description: text.clip(stripTags(p.body_html || ''), 300),
    image: (p.image && p.image.src) || (p.images && p.images[0] && p.images[0].src) || '',
    price: prices.length ? Math.min(...prices) : null,
    currency: null,
  };
}

// "https://shop.example/products/linen-apron-sage?variant=1" -> "Linen Apron Sage"
function nameFromUrl(url) {
  try {
    const u = new URL(web.normalizeUrl(url));
    const seg = u.pathname.split('/').filter(Boolean).pop() || '';
    const words = decodeURIComponent(seg).replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_]+/g, ' ').replace(/\b\d{5,}\b/g, '').trim();
    return words ? text.titleCase(words) : '';
  } catch {
    return '';
  }
}

function shopifyJsonUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^(.*\/products\/[^/]+?)(\.json|\.js)?\/?$/i);
    return m ? `${u.origin}${m[1]}.json` : null;
  } catch {
    return null;
  }
}

async function readProduct(ctx, link) {
  const url = web.normalizeUrl(link);
  if (!url) return { status: 'missing', url: '', name: '', price: null, priceText: '', description: '', image: '' };
  const guess = { status: 'unknown', url, name: nameFromUrl(url), nameFrom: 'link', price: null, priceText: '', description: '', image: '' };
  let page = null;
  const res = await web.fetchPage(ctx, url, { timeoutMs: 12000, maxBytes: 1.5e6 });
  if (res.blocked) return { ...guess, status: 'blocked', note: 'That site asks bots not to read its pages, so add the price yourself.' };
  if (res.html) page = fromHtml(res.html, res.url || url);
  let shop = null;
  const jsonUrl = shopifyJsonUrl(res.url || url);
  if (jsonUrl && (!page || page.price == null) && (await web.allowed(ctx, jsonUrl))) {
    try {
      const r = await web.getJson(ctx, jsonUrl, { timeoutMs: 10000, maxBytes: 1.5e6 });
      if (r.ok) shop = fromShopifyJson(r.data);
    } catch {
      shop = null;
    }
  }
  const got = page || shop ? { ...(shop || {}), ...Object.fromEntries(Object.entries(page || {}).filter(([, v]) => v != null && v !== '')) } : null;
  if (!got) return { ...guess, note: res.error || res.status ? "We couldn't read that page. The name below comes from the link: check it and add the price." : guess.note };
  const price = got.price != null ? got.price : shop && shop.price != null ? shop.price : null;
  return {
    status: 'read',
    url: res.url || url,
    name: got.name || guess.name,
    nameFrom: got.name ? 'page' : 'link',
    price,
    currency: got.currency || null,
    priceText: priceText(price, got.currency),
    description: got.description || '',
    image: got.image || '',
    source: page ? (shop ? 'page and Shopify product data' : 'product page') : 'Shopify product data',
  };
}

module.exports = { readProduct, fromHtml, fromShopifyJson, nameFromUrl, shopifyJsonUrl, priceText, jsonLd, metaContent };
