// Side by side: the member's store and up to three others, from one quick public read of each
// (lib/store.js) and the same audit checks (lib/audit.js). Where you lead, where they lead, price
// position and a table of the numbers. Only what a shopper can see; "not seen" never means "they
// don't have it".

const { text, money, time } = require('../../_kit');
const A = require('./audit');

const RANK = { pass: 2, warn: 1, fail: 0 };
const IMPACT = { high: 0, medium: 1, low: 2 };
const LABEL = {
  descriptions: 'Product descriptions',
  photos: 'Photos per product',
  resolution: 'Photo size',
  ratios: 'Photo shapes',
  variant_photos: 'Photos for each option',
  alt_text: 'Alt text on photos',
  reviews: 'Product reviews',
  email: 'Email signup',
  shipping_promise: 'Shipping terms up top',
  returns_page: 'Returns policy',
  shipping_page: 'Shipping policy',
  faq: 'Answers to common questions',
  about: 'The story behind the shop',
  contact: 'Ways to reach you',
  sold_out: 'Sold-out products',
  collections: 'Collections',
  types: 'Product types',
  stale: 'New products lately',
  home_meta: 'Homepage search listing',
  long_titles: 'Product title length',
  add_ons: 'Add-ons on product pages',
  tracking: 'Ad tracking',
  social: 'Social links',
};

// One store's read, cut down to what the comparison uses.
function summary(r, { label } = {}) {
  if (!r || !r.ok) return { ok: false, status: (r && r.status) || 'unreachable', reason: (r && r.reason) || "Couldn't read it.", name: (r && r.name) || label || (r && r.domain) || 'This store', domain: (r && r.domain) || '', sample: !!(r && r.sample) };
  const a = A.audit(r);
  const s = r.stats;
  const apps = r.apps || {};
  return {
    ok: true,
    name: r.name || r.domain,
    domain: r.domain,
    url: r.url,
    sample: !!r.sample,
    score: a.score,
    grade: a.grade,
    checks: Object.fromEntries(a.checks.filter((c) => RANK[c.status] != null).map((c) => [c.id, { status: c.status, title: c.title, pass: c.pass || '', evidence: c.evidence || '', how: c.how || '', impact: c.impact, minutes: c.minutes || null, fixedBy: c.fixedBy || null }])),
    products: r.productsTotal || s.products,
    read: r.productsRead || s.products,
    priceMin: s.priceMin,
    priceMedian: s.priceMedian,
    priceMax: s.priceMax,
    photos: s.imagesPerProduct,
    onePhoto: (s.oneImage || 0) + (s.noImage || 0),
    words: s.wordsMedian,
    newest: s.newest ? String(s.newest).slice(0, 10) : null,
    soldOut: s.soldOut,
    freeShipping: r.home && r.home.freeShipping ? r.home.freeShipping.text : '',
    reviews: apps.reviews || [],
    emailApps: apps.email || [],
    emailForm: !!(r.home && r.home.emailForm),
    pages: { shipping: !!(r.pages && r.pages.shipping), returns: !!(r.pages && r.pages.returns), faq: !!(r.pages && r.pages.faq), about: !!(r.pages && r.pages.about) },
  };
}

const usd = (v) => (v == null ? 'None listed' : money.usd(v));
const shortDay = (iso) => (iso ? time.shortDate(iso).replace(/^\w+, /, '') : 'Not shown');

// The table rows: { label, values: [...], best: index set, note }.
function rows(stores) {
  const pick = (fn) => stores.map(fn);
  const bestOf = (vals, dir) => {
    const nums = vals.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
    const ok = nums.filter((v) => v != null);
    if (ok.length < 2) return [];
    const target = dir === 'high' ? Math.max(...ok) : Math.min(...ok);
    if (ok.every((v) => v === target)) return [];
    return nums.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0);
  };
  const out = [];
  const add = (label, show, raw, dir, note) => out.push({ label, values: pick(show), best: dir ? bestOf(pick(raw), dir) : [], ...(note ? { note } : {}) });
  add('Store score', (s) => `${s.score} of 100`, (s) => s.score, 'high', 'Our audit of what a shopper sees: photos, descriptions, reviews, policies and more.');
  add('Products listed', (s) => money.int(s.products), (s) => s.products, null);
  add('Price range', (s) => (s.priceMin == null ? 'None listed' : s.priceMin === s.priceMax ? usd(s.priceMin) : `${usd(s.priceMin)} to ${usd(s.priceMax)}`), () => null, null);
  add('Middle price', (s) => usd(s.priceMedian), () => null, null, 'Half their products cost less than this, half more.');
  add('Photos per product', (s) => String(s.photos), (s) => s.photos, 'high');
  add('Products with one photo or none', (s) => `${money.int(s.onePhoto)} of ${money.int(s.read)}`, (s) => (s.read ? s.onePhoto / s.read : null), 'low');
  add('Words in the middle description', (s) => money.int(s.words || 0), (s) => s.words, 'high');
  add('Newest product listed', (s) => shortDay(s.newest), (s) => (s.newest ? Date.parse(s.newest) : null), 'high');
  add('Sold out right now', (s) => money.int(s.soldOut || 0), () => null, null);
  add('Shipping terms on the homepage', (s) => s.freeShipping || 'Not seen', () => null, null);
  add('Reviews shown', (s) => (s.reviews.length ? text.list(s.reviews) : 'Not seen'), () => null, null);
  add('Email signup', (s) => (s.emailApps.length ? text.list(s.emailApps) : s.emailForm ? "Shopify's form" : 'Not seen'), () => null, null);
  add('Shipping policy', (s) => (s.pages.shipping ? 'Linked' : 'Not seen'), () => null, null);
  add('Returns policy', (s) => (s.pages.returns ? 'Linked' : 'Not seen'), () => null, null);
  add('FAQ page', (s) => (s.pages.faq ? 'Linked' : 'Not seen'), () => null, null);
  add('About or story page', (s) => (s.pages.about ? 'Linked' : 'Not seen'), () => null, null);
  return out;
}

// Where the member's store is ahead (of all the others, or some), and where any of them is ahead.
function leads(mine, others) {
  const ahead = [];
  const behind = [];
  for (const [id, c] of Object.entries(mine.checks)) {
    const theirs = others.map((o) => ({ o, c: o.checks[id] })).filter((x) => x.c);
    if (!theirs.length) continue;
    const myRank = RANK[c.status];
    const better = theirs.filter((x) => RANK[x.c.status] > myRank);
    if (better.length) {
      const best = better.slice().sort((a, b) => RANK[b.c.status] - RANK[a.c.status])[0];
      behind.push({ id, label: LABEL[id] || c.title, impact: c.impact, stores: better.map((x) => x.o.name), theirs: best.c.pass || '', mine: c.evidence || '', fix: c.title, how: c.how, minutes: c.minutes, fixedBy: c.fixedBy });
    } else if (c.status === 'pass') {
      const worse = theirs.filter((x) => RANK[x.c.status] < myRank);
      if (worse.length) ahead.push({ id, label: LABEL[id] || c.title, impact: c.impact, mine: c.pass || '', stores: worse.map((x) => x.o.name), all: worse.length === theirs.length });
    }
  }
  const byImpact = (a, b) => IMPACT[a.impact] - IMPACT[b.impact] || b.stores.length - a.stores.length;
  return { ahead: ahead.sort((a, b) => Number(b.all) - Number(a.all) || byImpact(a, b)), behind: behind.sort(byImpact) };
}

// Where the member's middle price sits against the others.
function pricePosition(mine, others) {
  const m = mine.priceMedian;
  const theirs = others.filter((o) => o.priceMedian != null);
  if (m == null || !theirs.length) return { position: 'unknown', text: 'Not enough prices to compare.' };
  const near = (v) => Math.abs(v - m) <= Math.max(1, m * 0.03);
  const lower = theirs.filter((o) => !near(o.priceMedian) && o.priceMedian < m);
  const higher = theirs.filter((o) => !near(o.priceMedian) && o.priceMedian > m);
  const same = theirs.filter((o) => near(o.priceMedian));
  const list = text.list(theirs.map((o) => `${o.name} ${usd(o.priceMedian)}`));
  let position = 'middle';
  let line = 'Your middle price sits inside the group.';
  if (!higher.length && !same.length) {
    position = 'highest';
    line = 'Your middle price is the highest of the group, so your pages have to show why: photos, materials and reviews.';
  } else if (!lower.length && !same.length) {
    position = 'lowest';
    line = 'Your middle price is the lowest of the group. Check it still covers your costs and fees (Check your prices does that).';
  } else if (!lower.length && !higher.length) {
    position = 'same';
    line = 'Your middle price matches theirs, so shoppers choose on photos, words and trust.';
  }
  return { position, text: `Your middle price is ${usd(m)}. Theirs: ${list}. ${line}` };
}

module.exports = { summary, rows, leads, pricePosition, LABEL, RANK };
