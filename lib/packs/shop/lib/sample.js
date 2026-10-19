// Sample stores and shops for sample runs, tests and the engine's sample mode. Hand-written stores in
// sample/stores.json; shops on the sample map in sample/places.json; everything else is filled in from
// the word banks, the same way on every run (seeded by the site name). All of it is fictional and
// marked sample: true. Sample product photos are "sample-art:" illustrations (lib/art.js).

const { text, places: kitPlaces } = require('../../_kit');
const STORES = require('../sample/stores.json');
const PLACES = require('../sample/places.json');
const ST = require('../data/stockists.json');
const store = require('./store');

const SAMPLE_DATE = '2026-10-19T14:00:00.000Z';
const THEMES = ['Dawn', 'Sense', 'Craft', 'Refresh', 'Studio', 'Origin', 'Taste', 'Crave', 'Colorblock', 'Ride', 'Spotlight', 'Publisher'];
const PALETTES = [
  ['#2f4a3a', '#c98b4a'],
  ['#7a3b4f', '#e2b8a3'],
  ['#3c5a6b', '#d9c7a3'],
  ['#4b4a2f', '#b5764a'],
  ['#1f3d5c', '#e0a458'],
  ['#5b3a29', '#9cc5a1'],
  ['#2d2a4a', '#f2a07b'],
  ['#36544f', '#e6c36a'],
];

const h = (s) => text.hash(String(s));
const between = (seed, lo, hi) => lo + (h(seed) % (hi - lo + 1));
const handleOf = (t) => text.slug(t, 70);

function placeByHost(host) {
  return PLACES.places.find((p) => p.site === host) || null;
}

// What we know about a sample host: a hand-written store, a shop on the sample map, or a generic one.
function specFor(host) {
  if (STORES.stores[host]) return { host, ...STORES.stores[host] };
  const place = placeByHost(host);
  if (place) {
    const pal = PALETTES[h(host) % PALETTES.length];
    const status = place.platform === 'Shopify' ? 'open' : 'not_shopify';
    const counts = { low: [18, 40], medium: [30, 64], high: [60, 110] }[place.quality || 'low'];
    return {
      host,
      name: place.name,
      status,
      platform: place.platform || null,
      place,
      colors: { primary: pal[0], accent: pal[1] },
      generate: { count: between(`${host}:count`, counts[0], counts[1]), bank: place.bank || 'gift', quality: place.quality || 'low', carries: place.carries || 0, priceMin: place.priceMin, priceMax: place.priceMax },
    };
  }
  const base = host.replace(/\.example.*$|\.(test|invalid)$/i, '').replace(/[-_.]+/g, ' ');
  const pal = PALETTES[h(host) % PALETTES.length];
  return { host, name: text.titleCase(base) || 'Sample Store', status: 'open', colors: { primary: pal[0], accent: pal[1] }, generate: { count: between(`${host}:count`, 16, 40), bank: 'gift', quality: ['low', 'medium', 'high'][h(host) % 3] } };
}

const QUALITY = {
  low: { img: [1, 2], single: 0.7, alt: 0.08, width: [720, 1200], thin: 0.75 },
  medium: { img: [2, 4], single: 0.2, alt: 0.5, width: [1080, 2048], thin: 0.25 },
  high: { img: [4, 6], single: 0, alt: 1, width: [2048, 2048], thin: 0 },
};

function paragraphs(s) {
  return String(s || '')
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${x.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
    .join('');
}

function dateBetween(seed, from, to) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  return new Date(a + ((h(seed) % 10000) / 10000) * Math.max(0, b - a)).toISOString();
}

function imagesFor(seed, art, n, { altShare, width, ratio = 1, title }) {
  return Array.from({ length: n }, (_, j) => {
    const withAlt = altShare >= 1 || (h(`${seed}:alt:${j}`) % 100) / 100 < altShare;
    const w = width;
    return { id: h(`${seed}:img:${j}`), position: j + 1, src: `sample-art:${art}:${seed}-${j}`, width: w, height: Math.round(w / ratio), alt: withAlt ? `${title}${j ? `, view ${j + 1}` : ''}` : null };
  });
}

function rawProduct({ host, title, type, vendor, art, price, compareAt, variants, option, images, body, tags, created, updated, soldOut, i }) {
  const vs = (variants && variants.length ? variants : [{ t: 'Default Title', p: price }]).map((v, j) => ({
    id: h(`${host}:${title}:v${j}`),
    title: v.t,
    option1: v.t,
    price: Number(v.p != null ? v.p : price).toFixed(2),
    compare_at_price: compareAt ? Number(compareAt).toFixed(2) : null,
    available: !soldOut,
    grams: 0,
    requires_shipping: true,
    featured_image: null,
  }));
  return {
    id: h(`${host}:${title}`) % 1e9,
    title,
    handle: handleOf(title),
    body_html: body,
    vendor: vendor || '',
    product_type: type || '',
    created_at: created,
    updated_at: updated,
    published_at: created,
    tags: tags || [],
    variants: vs,
    images,
    options: variants && variants.length ? [{ name: option || 'Size', values: variants.map((v) => v.t) }] : [{ name: 'Title', values: ['Default Title'] }],
    _i: i,
  };
}

function heroProduct(host, spec, p, i) {
  const created = `${p.created || '2026-03-01'}T15:00:00Z`;
  const updated = `${p.updated || p.created || '2026-09-01'}T15:00:00Z`;
  const w = p.w || 1200;
  const imgs = Array.from({ length: p.img == null ? 1 : p.img }, (_, j) => ({
    id: h(`${host}:${p.t}:img:${j}`),
    position: j + 1,
    src: `sample-art:${p.art || 'box'}:${handleOf(p.t)}-${j}`,
    width: w,
    height: Math.round(w / (p.r || 1)),
    alt: j < (p.alt || 0) ? `${p.t}${j ? `, view ${j + 1}` : ''}` : null,
  }));
  return rawProduct({ host, title: p.t, type: p.ty, vendor: p.vendor || spec.name, art: p.art, price: p.p, compareAt: p.c, variants: p.v, option: p.o, images: imgs, body: paragraphs(p.d), tags: p.tags, created, updated, soldOut: !!p.so, i });
}

function generated(host, spec, n0) {
  const g = spec.generate;
  if (!g) return [];
  const bank = STORES.banks[g.bank] || STORES.banks.gift;
  const q = QUALITY[g.quality] || QUALITY.low;
  const fitRx = /candle|wax|diffuser|room spray/i;
  // Shops on the sample map carry exactly as many candles as sample/places.json says.
  const items = bank.items.filter(([t]) => (g.carries != null && g.bank !== 'candle' ? !fitRx.test(t) : true));
  const out = [];
  const vendors = g.vendors || [spec.name];
  // Shops that carry the maker's category get that many matching products, spread through the list.
  const carries = g.carries && g.bank !== 'candle' ? g.carries : 0;
  const candleBank = STORES.banks.candle.items.filter(([t]) => / Soy Candle$/.test(t));
  const every = carries ? Math.max(1, Math.floor(g.count / carries)) : 0;
  let k = 0;
  for (let i = 0; i < g.count; i++) {
    const seed = `${host}:${i}`;
    let [title, type, art, price] = items[(i + h(host)) % items.length];
    if (carries && i % every === 0 && k < carries) {
      const c = candleBank[(k + h(host)) % candleBank.length];
      title = c[0].replace(/ Soy Candle$/, ' Soy Candle, Local Maker');
      type = 'Candle';
      art = 'candle';
      const lo = g.priceMin || 24;
      const hi = g.priceMax || lo;
      price = carries > 1 ? Math.round(lo + ((hi - lo) * k) / (carries - 1)) : lo;
      k++;
    } else if (i >= items.length) {
      title = `${title} No. ${Math.floor(i / items.length) + 1}`;
    }
    if (g.priceMin && g.priceMax && type !== 'Candle' && g.bank === 'candle') price = Math.min(g.priceMax, Math.max(g.priceMin, price));
    const thin = (h(`${seed}:thin`) % 100) / 100 < q.thin;
    const vendor = vendors[h(`${seed}:v`) % vendors.length];
    const detail = (bank.details && bank.details[type]) || '';
    let body = thin ? bank.thin[h(`${seed}:t`) % bank.thin.length] : text.fill(bank.full[h(`${seed}:f`) % bank.full.length], { title, vendor, detail });
    if (g.quality === 'high' && !thin) body = `${body}\n${text.fill(bank.full[(h(`${seed}:f`) + 1) % bank.full.length], { title, vendor, detail })}`;
    const nImg = (h(`${seed}:single`) % 100) / 100 < q.single ? 1 : between(`${seed}:n`, q.img[0], q.img[1]);
    const width = between(`${seed}:w`, q.width[0], q.width[1]);
    const ratio = g.quality === 'low' && h(`${seed}:r`) % 4 === 0 ? 0.8 : 1;
    const created = dateBetween(`${seed}:c`, '2024-11-01', '2026-10-01');
    const updated = dateBetween(`${seed}:u`, created, '2026-10-18');
    const soldOut = h(`${seed}:so`) % (g.quality === 'low' ? 6 : 14) === 0;
    const compareAt = g.quality === 'high' && h(`${seed}:sale`) % 5 === 0 ? Math.round(price * 1.25) : null;
    out.push(
      rawProduct({
        host,
        title,
        type,
        vendor,
        art,
        price,
        compareAt,
        images: imagesFor(`${text.slug(title, 30)}-${i}`, art, nImg, { altShare: q.alt, width, ratio, title }),
        body: paragraphs(body),
        tags: g.quality === 'low' && h(`${seed}:tg`) % 2 ? [] : [type.toLowerCase(), g.bank],
        created,
        updated,
        soldOut,
        i: n0 + i,
      })
    );
  }
  return out;
}

function rawProducts(host, spec) {
  const hero = (spec.products || []).map((p, i) => heroProduct(host, spec, p, i));
  const seen = new Set(hero.map((p) => p.handle));
  const gen = generated(host, spec, hero.length).filter((p) => !seen.has(p.handle) && seen.add(p.handle));
  return hero.concat(gen);
}

function appsFor(spec) {
  const empty = { reviews: [], email: [], sms: [], upsell: [], subscriptions: [], loyalty: [], chat: [], bnpl: [], returns: [], protection: [], pagebuilder: [], search: [] };
  if (STORES.stores[spec.host]) return { apps: { ...empty, ...(spec.apps || {}) }, pixels: { meta: false, tiktok: false, google: false, pinterest: false, ...(spec.pixels || {}) } };
  const q = (spec.generate && spec.generate.quality) || 'low';
  const r = h(`${spec.host}:apps`);
  const apps = { ...empty };
  if (q === 'high') Object.assign(apps, { reviews: [['Judge.me', 'Okendo'][r % 2]], email: ['Klaviyo'], upsell: r % 3 === 0 ? ['Rebuy'] : [] });
  if (q === 'medium') Object.assign(apps, { reviews: r % 2 ? [['Loox', 'Judge.me'][r % 4 > 1 ? 1 : 0]] : [], email: r % 3 ? [['Klaviyo', 'Omnisend', 'Mailchimp'][r % 3]] : [] });
  return { apps, pixels: { meta: q !== 'low' || r % 3 === 0, tiktok: q === 'high', google: q !== 'low', pinterest: q === 'high' && r % 2 === 0 } };
}

function pagesFor(spec, origin) {
  const abs = (p) => (p ? `${origin}${p}` : null);
  const keys = ['shipping', 'returns', 'faq', 'contact', 'about', 'privacy', 'terms', 'sizeGuide', 'reviewsPage', 'blog'];
  if (spec.pages) return Object.fromEntries(keys.map((k) => [k, abs(spec.pages[k])]));
  const q = (spec.generate && spec.generate.quality) || 'low';
  const r = h(`${spec.host}:pages`);
  const has = {
    shipping: q !== 'low' || r % 2 === 0 ? '/policies/shipping-policy' : null,
    returns: '/policies/refund-policy',
    faq: q === 'high' || (q === 'medium' && r % 2) ? '/pages/faq' : null,
    contact: '/pages/contact',
    about: q !== 'low' || r % 3 === 0 ? '/pages/about' : null,
    privacy: '/policies/privacy-policy',
    terms: q === 'high' ? '/policies/terms-of-service' : null,
    sizeGuide: spec.generate && spec.generate.bank === 'apparel' && q !== 'low' ? '/pages/size-guide' : null,
    reviewsPage: null,
    blog: q === 'high' ? '/blogs/news' : null,
  };
  return Object.fromEntries(keys.map((k) => [k, abs(has[k])]));
}

function homeFor(spec, host) {
  if (spec.home && STORES.stores[host]) {
    const hm = spec.home;
    return {
      title: hm.title || spec.name,
      description: hm.description || null,
      h1: hm.h1 || null,
      socials: { instagram: null, facebook: null, tiktok: null, youtube: null, x: null, linkedin: null, ...(hm.socials || {}) },
      colors: { primary: (spec.colors && spec.colors.primary) || null, accent: (spec.colors && spec.colors.accent) || null, source: 'site css' },
      logo: null,
      ogImage: null,
      emails: hm.emails || [],
      phones: hm.phones || [],
      emailForm: !!hm.emailForm,
      freeShipping: hm.freeShipping || null,
      mobileReady: true,
      words: 420,
    };
  }
  const q = (spec.generate && spec.generate.quality) || 'low';
  const r = h(`${host}:home`);
  const kindLabel = spec.place ? (ST.labels[spec.place.kind] || 'Shop').toLowerCase() : 'shop';
  const amount = [50, 60, 75, 100][r % 4];
  return {
    title: `${spec.name} | Independent ${kindLabel}`,
    description: `${spec.name} is an independent ${kindLabel}. Shop online or visit us in person.`,
    h1: spec.name,
    socials: { instagram: r % 3 === 0 ? null : text.slug(spec.name, 30).replace(/-/g, ''), facebook: null, tiktok: null, youtube: null, x: null, linkedin: null },
    colors: { primary: spec.colors.primary, accent: spec.colors.accent, source: 'site css' },
    logo: null,
    ogImage: null,
    emails: [`hello@${host}`],
    phones: [],
    emailForm: q !== 'low' || r % 2 === 0,
    freeShipping: q === 'high' || (q === 'medium' && r % 2) ? { text: `Free shipping on orders over $${amount}`, amount } : null,
    mobileReady: true,
    words: 300 + (r % 500),
  };
}

function collectionsFor(spec, products) {
  if (spec.collections) return spec.collections;
  const types = {};
  for (const p of products) if (p.type) types[p.type] = (types[p.type] || 0) + 1;
  const q = (spec.generate && spec.generate.quality) || 'low';
  return Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .slice(0, q === 'low' ? 2 : 6)
    .map(([t, n], i) => ({ title: t, handle: text.slug(t, 40), count: n, image: q !== 'low' || i === 0, description: q === 'high' }));
}

function sampleStore(parsed, { depth = 'full', asked, offline } = {}) {
  const real = !store.isSampleHost(parsed.host);
  const host = real ? STORES.default : parsed.host;
  const spec = specFor(host);
  const origin = `https://${host}`;
  const note = real ? `Sample data: this run didn't read ${parsed.domain}${offline ? ' (no network)' : ''}. Run it live to read the real store.` : null;
  const base = { ok: false, sample: true, depth, url: `${origin}/`, domain: host, origin, handle: parsed.handle, fetchedAt: SAMPLE_DATE, ...(note ? { note } : {}) };
  if (spec.status === 'password') return { ...base, status: 'password', platform: 'Shopify', shopify: true, name: spec.name, reason: `${host} is a Shopify store behind a password page, so it isn't open to shoppers yet.` };
  if (spec.status === 'not_shopify') {
    const platform = spec.platform || null;
    return {
      ...base,
      status: 'not_shopify',
      platform,
      shopify: false,
      name: spec.name,
      home: { title: (spec.home && spec.home.title) || spec.name, description: (spec.home && spec.home.description) || null, emails: (spec.home && spec.home.emails) || [] },
      reason: platform ? `${host} isn't a Shopify store. It runs on ${platform}.` : `${host} isn't a Shopify store (it has no Shopify product feed).`,
    };
  }
  const opts = store.DEPTH[depth] || store.DEPTH.full;
  const raw = rawProducts(host, spec);
  const products = raw.map((p) => store.normalizeProduct(p, origin));
  const live = products.filter((p) => p.images > 0 && p.price != null && !p.soldOut);
  const byNew = live.slice().sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  const askedRaw = parsed.handle && raw.find((p) => p.handle === parsed.handle);
  const targetRaw = askedRaw || raw.find((p) => byNew[0] && p.handle === byNew[0].handle) || raw[0];
  const sampled = store.pick(live.length ? live : products, opts.altSample).map((p) => raw.find((r) => r.handle === p.handle));
  if (targetRaw && !sampled.includes(targetRaw)) sampled.unshift(targetRaw);
  let images = 0;
  let missing = 0;
  for (const p of sampled.filter(Boolean)) {
    for (const im of p.images) {
      images++;
      if (!String(im.alt || '').trim()) missing++;
    }
  }
  const { apps, pixels } = appsFor(spec);
  const home = homeFor(spec, host);
  const theme = spec.theme || (() => {
    const r = h(`${host}:theme`);
    const older = (spec.generate && spec.generate.quality) === 'low' && r % 10 < 3;
    return older ? { name: 'Older theme', version: null, os2: false } : { name: THEMES[r % THEMES.length], version: `${14 + (r % 2)}.${r % 4}.0`, os2: true };
  })();
  const keep = products
    .slice()
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, opts.keepProducts);
  const truncated = depth === 'quick' && products.length > 250;
  return {
    ...base,
    ok: true,
    status: 'open',
    platform: 'Shopify',
    shopify: true,
    name: spec.name,
    meta: { name: spec.name, description: home.description, currency: 'USD', country: 'US', city: (spec.meta && spec.meta.city) || null, province: (spec.meta && spec.meta.province) || null, shipsTo: ['US'], productCount: products.length, collectionCount: collectionsFor(spec, products).length, shopPayInstallments: false },
    productsRead: products.length,
    productsTotal: products.length,
    capped: truncated,
    stats: store.catalogStats(products),
    products: keep,
    target: targetRaw ? store.normalizeProduct(targetRaw, origin, { withBody: true }) : null,
    collections: collectionsFor(spec, products),
    collectionsCount: collectionsFor(spec, products).length,
    home,
    pages: pagesFor(spec, origin),
    apps,
    pixels,
    theme: { name: theme.name, version: theme.version || null, storeId: null, custom: false },
    os2: theme.os2 !== false,
    alt: { products: sampled.filter(Boolean).length, images, missing },
    pdpChecked: true,
    rows: products.map(store.rowOf),
  };
}

function sampleProduct(parsed, handle) {
  const real = !store.isSampleHost(parsed.host);
  const host = real ? STORES.default : parsed.host;
  const spec = specFor(host);
  if (spec.status !== 'open') return null;
  const raw = rawProducts(host, spec).find((p) => p.handle === handle);
  return raw ? { ...store.normalizeProduct(raw, `https://${host}`, { withBody: true }), sample: true } : null;
}

// A homepage look at a sample site, like store.probeSite.
function sampleProbe(parsed, { catalog = false, fitRx = null } = {}) {
  const real = !store.isSampleHost(parsed.host);
  const host = real ? STORES.default : parsed.host;
  const spec = specFor(host);
  const place = spec.place || null;
  const home = spec.status === 'open' ? homeFor(spec, host) : { title: spec.name, description: null, emails: (spec.home && spec.home.emails) || [`hello@${host}`] };
  const out = {
    ok: true,
    sample: true,
    status: spec.status === 'password' ? 'password' : 'open',
    url: `https://${host}/`,
    domain: host,
    platform: spec.status === 'not_shopify' ? spec.platform || null : 'Shopify',
    shopify: spec.status !== 'not_shopify',
    title: home.title,
    description: home.description || null,
    emails: home.emails || [],
    phones: [],
    socials: home.socials || {},
    emailForm: !!home.emailForm,
    freeShipping: home.freeShipping || null,
    local: place && place.local ? ['local makers', 'handmade'] : [],
    fitHits: 0,
    words: home.words || 300,
    catalog: null,
  };
  if (spec.status === 'open') {
    const prods = rawProducts(host, spec).map((p) => store.normalizeProduct(p, `https://${host}`));
    const match = fitRx ? prods.filter((p) => fitRx.test(`${p.title} ${p.type} ${(p.tagList || []).join(' ')}`)) : [];
    out.fitHits = match.length ? Math.min(6, match.length) : 0;
    if (catalog) {
      const prices = match.map((p) => p.price).filter((x) => x != null);
      out.catalog = { count: prods.length, capped: false, matches: match.length, matchTitles: match.slice(0, 3).map((p) => p.title), priceMin: prices.length ? Math.min(...prices) : null, priceMax: prices.length ? Math.max(...prices) : null, vendors: new Set(prods.map((p) => p.vendor)).size };
    }
  } else if (place && place.carries && fitRx) out.fitHits = place.carries;
  return out;
}

// Shops on the sample map, shaped like lib/osm.js places. kinds filters by shop type when given.
function samplePlaces({ city, kinds, withWebsite = false } = {}) {
  const center = kitPlaces.sampleCenter(city || 'Sample town');
  const want = kinds && kinds.length ? new Set(kinds) : null;
  const town = kitPlaces.cityShort(city || 'Sample town');
  const latPerMile = 1 / 69;
  const lngPerMile = 1 / (69 * Math.cos((center.lat * Math.PI) / 180));
  return PLACES.places
    .filter((p) => (!want || want.has(p.kind)) && (!withWebsite || p.site))
    .map((p, i) => {
      const miles = Math.round(Math.sqrt(p.dx * p.dx + p.dy * p.dy) * 10) / 10;
      const street = PLACES.streets[i % PLACES.streets.length];
      return {
        key: `sample:${text.slug(p.name, 40)}`,
        osmId: null,
        source: 'sample',
        sample: true,
        name: p.name,
        kind: p.kind,
        kindLabel: ST.labels[p.kind] || 'Shop',
        address: `${100 + (h(p.name) % 800)} ${street}, ${town}`,
        lat: Math.round((center.lat + p.dy * latPerMile) * 1e5) / 1e5,
        lng: Math.round((center.lng + p.dx * lngPerMile) * 1e5) / 1e5,
        km: Math.round(miles * 1.609 * 10) / 10,
        miles,
        website: p.site ? `https://${p.site}/` : null,
        etsy: null,
        email: p.email || null,
        phone: p.phone || !p.site || h(p.name) % 2 ? kitPlaces.samplePhone(p.name) : null,
        instagram: null,
        facebook: null,
        hours: null,
        chain: !!p.chain,
        closed: false,
        osmUrl: null,
        maker: !!p.maker,
      };
    })
    .sort((a, b) => a.miles - b.miles);
}

module.exports = { sampleStore, sampleProduct, sampleProbe, samplePlaces, specFor, rawProducts, SAMPLE_DATE, STORES };
