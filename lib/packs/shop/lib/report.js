// The audit report: one HTML page a store owner can read in five minutes, or a freelancer can hand
// to the owner. Static HTML and CSS (no scripts), the store's own colors when we found them.

const { text, money, color } = require('../../_kit');
const H = require('./html');
const { labelOf } = require('./apps');
const art = require('./art');
const { sized } = require('./store');

const esc = H.esc;
const PAGE_LABELS = { shipping: 'Shipping policy', returns: 'Returns policy', faq: 'FAQ', contact: 'Contact', about: 'About or Our story', privacy: 'Privacy policy', terms: 'Terms of service', sizeGuide: 'Size guide', reviewsPage: 'Reviews page', blog: 'Blog' };

function seedColor(r) {
  const c = r.home && r.home.colors && r.home.colors.primary;
  return c && color.isHex(c) && color.contrast(c, '#ffffff') >= 2.2 ? c : '#2f4a3a';
}

function dateLabel(iso) {
  const d = new Date(iso || Date.now());
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function imgTag(src, alt, t) {
  const s = art.isSampleArt(src) ? art.resolveImage(src, { palette: t, size: 160 }) : sized(src, 160);
  return s ? `<img src="${esc(s)}" alt="${esc(alt || '')}" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:12px;border:1px solid var(--line);display:block">` : '';
}

const EXTRA_CSS = `
.prod{display:grid;grid-template-columns:56px 1fr;gap:14px;align-items:center}
.prod a{font-weight:600;text-decoration:none;color:var(--ink)}
.prod a:hover{text-decoration:underline}
.issues{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.issues span{font-size:12px;font-weight:600;padding:3px 8px;border-radius:7px;background:#fdf1ee;color:#9f2c1b}
.yes{color:var(--good);font-weight:700}.no{color:var(--muted)}
.evidence{font-weight:600;margin:0 0 6px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.sample{background:#fff6dd;color:#6b4e00;border-radius:14px;padding:14px 18px;margin:24px 0 0;font-size:15px}
`;

// r: the store read; a: lib/audit.audit(r); opts: { by, now }
function auditHtml(r, a, { by, now } = {}) {
  const t = H.theme(seedColor(r));
  const s = r.stats || {};
  const fixes = a.fixes.slice(0, 10).map((f) => ({
    title: f.title,
    why: f.evidence || f.why,
    how: f.evidence ? `${f.why} ${f.how}` : f.how,
    impact: f.impact,
    minutes: f.minutes,
    tags: [f.area, f.fixedBy].filter(Boolean),
  }));
  const appRows = Object.keys(r.apps || {}).map((k) => ({ cat: labelOf(k), seen: (r.apps[k] || []).length ? r.apps[k].join(', ') : 'None seen' }));
  const pixels = r.pixels || {};
  appRows.push({ cat: 'Ad tracking tags', seen: ['meta', 'google', 'tiktok', 'pinterest'].filter((k) => pixels[k]).map((k) => ({ meta: 'Meta', google: 'Google', tiktok: 'TikTok', pinterest: 'Pinterest' })[k]).join(', ') || 'None seen' });
  const pageRows = Object.entries(PAGE_LABELS).map(([k, label]) => ({ page: label, found: r.pages && r.pages[k] ? `<a class="yes" href="${esc(r.pages[k])}">Found</a>` : '<span class="no">Not seen</span>' }));
  const worst = (a.products || []).filter((p) => p.issues.length).slice(0, 12);
  const imgOf = Object.fromEntries((r.products || []).map((p) => [p.handle, p.image]));
  const prodRows = worst.map((p) => ({
    product: `<div class="prod">${imgTag(imgOf[p.handle], p.title, t) || '<span></span>'}<div><a href="${esc(p.url)}">${esc(p.title)}</a><div class="issues">${p.issues.map((x) => `<span>${esc(x)}</span>`).join('')}</div></div></div>`,
    price: p.price != null ? money.usd(p.price) : '',
    photos: p.photos,
    words: p.words,
  }));
  const altLine = r.alt && r.alt.images ? `${r.alt.missing} of ${r.alt.images}` : 'Not checked';
  const appsSeen = Object.values(r.apps || {}).reduce((n, v) => n + v.length, 0);
  const body = [
    H.hero({
      eyebrow: `Store audit${r.sample ? ' (sample data)' : ''}`,
      heading: r.name || r.domain,
      lead: `${a.grade}. ${a.fixes.length ? `${text.plural(a.fixes.length, 'fix')} to make, in the order buyers notice them.` : 'Nothing big to fix. Keep doing what you do.'}`,
      meta: [{ value: r.domain, label: '' }, { value: dateLabel(r.fetchedAt || now), label: 'read on' }, { value: money.int(r.productsTotal || s.products || 0), label: 'products' }, r.theme && r.theme.name ? { value: r.theme.name, label: 'theme' } : null].filter(Boolean),
      aside: H.ring(a.score, { fg: t.heroAccent, label: 'store score' }),
    }),
    r.sample ? `<div class="wrap"><p class="sample">Sample data: a made-up store so you can see what the audit looks like. Run it on a real store address to read the real thing.</p></div>` : '',
    H.block({
      kicker: 'At a glance',
      title: 'The numbers',
      sub: r.capped ? `From the first ${money.int(r.productsRead)} of ${money.int(r.productsTotal)} products.` : 'From every product in the public catalog.',
      body: H.stats([
        { value: money.int(r.productsTotal || s.products || 0), label: 'Products', note: s.soldOut ? `${s.soldOut} sold out` : 'None sold out' },
        { value: s.priceMin != null ? `${money.usd(s.priceMin)} to ${money.usd(s.priceMax)}` : 'n/a', label: 'Price range', note: s.priceMedian != null ? `Middle price ${money.usd(s.priceMedian)}` : '' },
        { value: String(s.imagesPerProduct != null ? s.imagesPerProduct : 'n/a'), label: 'Photos per product', note: `${s.oneImage || 0} with one photo`, tone: s.products && (s.oneImage + s.noImage) / s.products >= 0.4 ? 'bad' : '' },
        { value: String(s.wordsMedian != null ? Math.round(s.wordsMedian) : 'n/a'), label: 'Words in a typical description', note: `${s.thin || 0} under 50 words`, tone: s.products && s.thin / s.products >= 0.4 ? 'bad' : '' },
        { value: altLine, label: 'Photos without alt text', note: r.alt && r.alt.products ? `Checked on ${r.alt.products} products` : '', tone: r.alt && r.alt.images && r.alt.missing / r.alt.images >= 0.5 ? 'bad' : '' },
        { value: String(appsSeen), label: 'Apps we saw', note: (r.apps && r.apps.reviews && r.apps.reviews.length) ? `Reviews: ${r.apps.reviews[0]}` : 'No reviews app seen', tone: appsSeen ? '' : 'warn' },
      ]),
    }),
    a.fixes.length
      ? H.block({ kicker: 'Fix these first', title: `${Math.min(10, a.fixes.length)} fixes, in order`, sub: 'Highest impact first, then the quickest. Minutes are for a first pass on your top products.', body: H.fixList(fixes) })
      : '',
    a.strengths.length ? H.block({ kicker: "What's working", title: 'Keep these', body: H.checklist(a.strengths.map((x) => ({ title: x })), { done: true }) }) : '',
    prodRows.length
      ? H.block({ kicker: 'Product by product', title: 'The products that need the most help', sub: 'Start here. The full list is in the issues sheet.', body: H.table([{ key: 'product', label: 'Product', html: true }, { key: 'price', label: 'Price', num: true }, { key: 'photos', label: 'Photos', num: true }, { key: 'words', label: 'Words', num: true }], prodRows) })
      : '',
    H.block({
      kicker: 'Behind the scenes',
      title: 'Apps and pages we saw',
      sub: 'Read from the homepage and one product page. An app that loads late may not show up here.',
      body: `<div class="grid2">${H.table([{ key: 'cat', label: 'App type' }, { key: 'seen', label: 'What we saw' }], appRows)}${H.table([{ key: 'page', label: 'Page buyers look for' }, { key: 'found', label: 'Linked?', html: true }], pageRows)}</div>`,
    }),
  ].join('\n');
  const footer = `Read from public pages only (the public product feed, the homepage and one product page), on ${dateLabel(r.fetchedAt || now)}${by ? ` for ${by}` : ''}. We follow each site's robots.txt and never log in. Numbers are what any shopper could see that day.`;
  return H.page({ title: `${r.name || r.domain}: store audit`, description: `Store audit for ${r.domain}`, theme: t, body: `<style>${EXTRA_CSS}</style>${body}`, footer });
}

// The issues sheet: every product read, one row each, with what to fix.
function issuesRows(r, a) {
  return (a.products || []).map((p) => ({ title: p.title, url: p.url, price: p.price != null ? p.price.toFixed(2) : '', photos: p.photos, words: p.words, sold_out: p.soldOut ? 'yes' : '', issues: p.issues.join('; ') || 'none' }));
}

module.exports = { auditHtml, issuesRows, dateLabel, seedColor, PAGE_LABELS, EXTRA_CSS };
