// Search and sharing: the title and description Google shows, Open Graph tags for link previews,
// schema.org JSON-LD (the most specific type that fits, data/schema-types.json), sitemap.xml and
// robots.txt. Only the member's real facts go in; nothing is invented to fill a field.

const { files, text, money } = require('../../_kit');

const esc = files.esc;

function fit(s, n) {
  return text.clip(s, n);
}

// Title for search results, 60 characters or less: what, where and who.
function titleFor(c) {
  const what = text.sentenceCase(c.whatShort || c.what || '');
  const opts = [];
  if (c.template === 'creator') opts.push(`${c.name} | Links`, c.name);
  if (what && c.city && !c.online) opts.push(`${what} in ${c.city} | ${c.name}`, `${c.name} | ${what} in ${c.city}`, `${what} in ${c.city}`);
  if (what) opts.push(`${c.name} | ${what}`);
  opts.push(c.name);
  const hit = opts.find((o) => o.length <= 60 && o.length >= 18) || opts.find((o) => o.length <= 60);
  return hit || fit(opts[opts.length - 1], 60);
}

// Description for search results, 155 characters or less, from facts only.
function descriptionFor(c) {
  const bits = [];
  const what = c.whatShort || c.what;
  if (c.template === 'creator') bits.push(c.tagline || `${c.name}: everything in one place.`);
  else if (what && c.area && !c.online) bits.push(`${c.name}: ${what.toLowerCase()} in ${c.areaLine || c.area}.`);
  else if (what) bits.push(`${c.name}: ${what.toLowerCase()}.`);
  else bits.push(`${c.name}.`);
  const priced = (c.services || []).filter((s) => s.priceText).slice(0, 2);
  if (priced.length) bits.push(`${priced.map((s) => `${s.name} ${s.priceText}`).join(', ')}.`);
  if (c.primary && c.primary.label && c.template !== 'creator') bits.push(`${c.primary.label} online.`);
  if (c.phone && !c.online) bits.push(`Call ${c.phone.display}.`);
  let out = '';
  for (const b of bits) {
    const next = out ? `${out} ${b}` : b;
    if (next.length <= 155) out = next;
  }
  return out || fit(bits[0], 155);
}

function absolute(c, file) {
  return `${c.siteUrl}${file}`;
}

// <head> tags for search, sharing and icons. assets: which image files exist in the site folder.
function headTags(c, { hasPng, hasIco, hasTouch, themeColor, noindex = false } = {}) {
  const t = [];
  t.push(`<meta name="description" content="${esc(c.seo.description)}">`);
  if (noindex) t.push('<meta name="robots" content="noindex">');
  if (c.canonical && !noindex) t.push(`<link rel="canonical" href="${esc(c.siteUrl)}">`);
  if (themeColor) t.push(`<meta name="theme-color" content="${esc(themeColor)}">`);
  if (!noindex) {
    t.push('<meta property="og:type" content="website">');
    t.push(`<meta property="og:site_name" content="${esc(c.name)}">`);
    t.push(`<meta property="og:title" content="${esc(c.seo.title)}">`);
    t.push(`<meta property="og:description" content="${esc(c.seo.description)}">`);
    t.push(`<meta property="og:url" content="${esc(c.siteUrl)}">`);
    t.push('<meta property="og:locale" content="en_US">');
    if (hasPng) {
      t.push(`<meta property="og:image" content="${esc(absolute(c, 'og-image.png'))}">`);
      t.push('<meta property="og:image:width" content="1200">');
      t.push('<meta property="og:image:height" content="630">');
      t.push(`<meta property="og:image:alt" content="${esc(c.name)}">`);
    }
    t.push(`<meta name="twitter:card" content="${hasPng ? 'summary_large_image' : 'summary'}">`);
  }
  if (hasIco) t.push('<link rel="icon" href="favicon.ico" sizes="32x32">');
  t.push('<link rel="icon" href="favicon.svg" type="image/svg+xml">');
  if (hasTouch) t.push('<link rel="apple-touch-icon" href="apple-touch-icon.png">');
  return t.join('\n');
}

// ---------- JSON-LD ----------

const LOCAL_TYPES = new Set(['LocalBusiness', 'AutoWash', 'HomeAndConstructionBusiness', 'HousePainter', 'Plumber', 'Electrician', 'HVACBusiness', 'RoofingContractor', 'MovingCompany', 'HairSalon', 'NailSalon', 'BeautySalon', 'DaySpa', 'TattooParlor', 'ExerciseGym', 'CafeOrCoffeeShop', 'Bakery', 'BarOrPub', 'FoodEstablishment', 'Restaurant']);

// The schema.org type for this business: the niche's subtype when it serves a place, Organization
// when it works online.
function schemaType(c) {
  const s = (c.profile && c.profile.schema) || 'LocalBusiness';
  if (s === 'Product') return 'Product';
  if (LOCAL_TYPES.has(s)) return c.online && !c.address ? (s === 'LocalBusiness' ? 'Organization' : s) : s;
  if (!c.online && (c.address || c.city)) return 'LocalBusiness';
  return s === 'Person' ? 'Person' : 'Organization';
}

function priceRange(services) {
  const prices = (services || []).map((s) => s.price).filter((p) => typeof p === 'number' && p > 0);
  if (!prices.length) return null;
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? money.usd(lo) : `${money.usd(lo)}-${money.usd(hi)}`;
}

function offerFor(s) {
  const o = { '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, ...(s.description ? { description: s.description } : {}) } };
  if (typeof s.price === 'number') {
    if (s.from || s.plus) o.priceSpecification = { '@type': 'PriceSpecification', minPrice: s.price, priceCurrency: 'USD' };
    else {
      o.price = s.price;
      o.priceCurrency = 'USD';
    }
  }
  return o;
}

function addressOf(c) {
  if (!c.address && !c.city) return null;
  const a = { '@type': 'PostalAddress' };
  if (c.address) {
    // "1200 E 6th St, Austin, TX 78702": street first, then the rest if it reads like city, state zip.
    const parts = c.address.split(/\s*,\s*/);
    a.streetAddress = parts[0];
    const zip = c.address.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zip) a.postalCode = zip[1];
  }
  if (c.city) a.addressLocality = c.city;
  if (c.region) a.addressRegion = c.region;
  a.addressCountry = 'US';
  return a;
}

function sameAs(c) {
  const out = Object.values(c.socials || {});
  if (c.website && !out.includes(c.website) && c.website !== c.siteUrl) out.push(c.website);
  return out;
}

function jsonLd(c, { hasPng } = {}) {
  const type = schemaType(c);
  const image = hasPng ? absolute(c, 'og-image.png') : undefined;
  const out = [];
  if (c.template === 'creator' || (c.template === 'portfolio' && type === 'Person')) {
    const personal = type === 'Person' || c.template === 'creator';
    const entity = {
      '@type': personal ? 'Person' : 'Organization',
      name: c.name,
      ...(c.handle ? { alternateName: c.handle } : {}),
      ...(c.seo.description ? { description: c.seo.description } : {}),
      ...(c.whatShort && personal ? { jobTitle: text.sentenceCase(c.whatShort) } : {}),
      url: c.siteUrl,
    };
    const links = [...sameAs(c), ...(c.links || []).filter((l) => /^https:/.test(l.href)).map((l) => l.href)];
    if (links.length) entity.sameAs = [...new Set(links)].slice(0, 12);
    out.push({ '@context': 'https://schema.org', '@type': 'ProfilePage', name: c.seo.title, url: c.siteUrl, dateModified: c.today, mainEntity: entity });
  } else if (type === 'Product') {
    const p = { '@context': 'https://schema.org', '@type': 'Product', name: c.productName || c.name, description: c.seo.description, url: c.siteUrl };
    if (image) p.image = [image];
    if (c.productName && c.productName !== c.name) p.brand = { '@type': 'Brand', name: c.name };
    const price = (c.services || []).find((s) => typeof s.price === 'number');
    if (price && c.buy) p.offers = { '@type': 'Offer', price: price.price, priceCurrency: 'USD', url: c.buy.href, availability: 'https://schema.org/InStock' };
    out.push(p);
  } else {
    const b = { '@context': 'https://schema.org', '@type': type, name: c.name, url: c.siteUrl };
    if (c.seo.description) b.description = c.seo.description;
    if (image) b.image = image;
    if (c.phone) b.telephone = c.phone.e164;
    if (c.email) b.email = c.email;
    const addr = type === 'Organization' || type === 'Person' ? null : addressOf(c);
    if (addr) b.address = addr;
    if (c.area && !c.online) b.areaServed = c.area;
    if (c.hours && c.hours.spec && c.hours.spec.length && type !== 'Organization' && type !== 'Person') {
      b.openingHoursSpecification = c.hours.spec.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.dayOfWeek, opens: h.opens, closes: h.closes }));
    }
    const pr = priceRange(c.services);
    if (pr && type !== 'Person') b.priceRange = pr;
    const sa = sameAs(c);
    if (sa.length) b.sameAs = sa;
    const priced = (c.services || []).filter((s) => s.name).slice(0, 12);
    if (priced.length && type !== 'Person') b.hasOfferCatalog = { '@type': 'OfferCatalog', name: c.servicesTitle || 'Services', itemListElement: priced.map(offerFor) };
    if (c.menu && c.menu.length) b.hasMenu = `${c.siteUrl}#menu`;
    if (c.reserve) b.acceptsReservations = true;
    if (c.owner && type !== 'Person') b.founder = { '@type': 'Person', name: c.owner };
    out.push(b);
  }
  if (c.faq && c.faq.length) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })),
    });
  }
  return out;
}

function jsonLdTags(objs) {
  return objs.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
}

function sitemap(c) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${esc(c.siteUrl)}</loc>
    <lastmod>${c.today}</lastmod>
  </url>
</urlset>
`;
}

// A sample made for a prospect stays out of search until it's their real site.
function robots(c, { block = false } = {}) {
  if (block) return `User-agent: *
Disallow: /
`;
  return `User-agent: *
Allow: /

Sitemap: ${c.siteUrl}sitemap.xml
`;
}

// Netlify and Cloudflare Pages both read _headers: safe defaults and a week of caching for images.
function headersFile() {
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/images/*
  Cache-Control: public, max-age=604800
`;
}

module.exports = { titleFor, descriptionFor, headTags, jsonLd, jsonLdTags, schemaType, priceRange, sitemap, robots, headersFile };
