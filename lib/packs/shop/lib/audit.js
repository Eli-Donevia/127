// The store audit: about 25 checks over one store read (lib/store.js), each with the real numbers
// behind it, a plain fix, honest minutes and what in this pack already does the work. Scores and fix
// order are the same for a store owner and for a freelancer pitching that store. We only judge what a
// shopper can see; "we didn't see" never becomes "they don't have".

const { text, money } = require('../../_kit');
const { labelOf } = require('./apps');
const LAUNCH = require('../data/launch.json');
const THEME = require('../data/theme-rules.json');
const CSV = require('../data/shopify-csv.json');

const WEIGHT = { high: { fail: 14, warn: 7 }, medium: { fail: 8, warn: 4 }, low: { fail: 4, warn: 2 } };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const plural = (n, one, many) => `${money.int(n)} ${n === 1 ? one : many || `${one}s`}`;

// What does the fix in this pack: shown as a tag on each fix.
const FIXED_BY = {
  copy: 'Fix my store writes these',
  shots: 'Shot list in the sample page',
  sections: 'Theme sections in this pack',
  alt: 'Alt text in the copy sheet',
  checklist: 'Fix plan checklist',
  emails: 'Review request email in the fix plan',
};

function check(c) {
  return { minutes: null, how: '', fixedBy: null, ...c };
}

function checksFor(r) {
  const s = r.stats;
  const n = s.products;
  const out = [];
  const home = r.home || {};
  const pages = r.pages || {};
  const apps = r.apps || {};
  const sampleNote = r.capped ? ` (first ${money.int(r.productsRead)} of ${money.int(r.productsTotal)} products read)` : '';

  // ---------- product pages ----------
  if (!n) return trustChecks(r, out, { n, s, home, pages, apps });
  const thinShare = n ? s.thin / n : 0;
  out.push(
    check({
      id: 'descriptions',
      area: 'Product pages',
      impact: 'high',
      status: thinShare >= 0.4 ? 'fail' : thinShare >= 0.15 ? 'warn' : 'pass',
      title: 'Write fuller product descriptions',
      evidence: `${s.thin} of ${plural(n, 'product')} have under 50 words${s.empty ? `, and ${s.empty} have none at all` : ''}. The middle product has ${money.int(s.wordsMedian || 0)} words${sampleNote}.`,
      pass: `Descriptions are full: the middle product has ${money.int(s.wordsMedian || 0)} words.`,
      why: "Shoppers can't pick the product up. The description has to answer what it is, what it's made of, how it fits, smells or works, and why it's worth the price.",
      how: 'Lead with the one reason to buy, then three short benefit lines, then details (size, materials, care) and shipping. Aim for 120 to 250 words. Start with your five best sellers.',
      minutes: 50,
      fixedBy: 'copy',
    })
  );
  const oneShare = n ? (s.oneImage + s.noImage) / n : 0;
  out.push(
    check({
      id: 'photos',
      area: 'Product pages',
      impact: 'high',
      status: oneShare >= 0.4 ? 'fail' : oneShare >= 0.15 ? 'warn' : 'pass',
      title: 'Add more photos to each product',
      evidence: `${s.oneImage} of ${plural(n, 'product')} have a single photo${s.noImage ? ` and ${s.noImage} have none` : ''}. That's ${s.imagesPerProduct} photos per product on average.`,
      pass: `Photos are covered: ${s.imagesPerProduct} per product on average.`,
      why: 'One photo leaves buyers guessing about size, texture and what arrives in the box.',
      how: 'For each product shoot four more: on a plain background, in use, next to something for scale, a close-up of the detail, and the packaging. Phone photos by a window work.',
      minutes: 90,
      fixedBy: 'shots',
    })
  );
  const lowShare = n ? s.lowRes / n : 0;
  out.push(
    check({
      id: 'resolution',
      area: 'Product pages',
      impact: 'medium',
      status: lowShare >= 0.3 ? 'fail' : lowShare >= 0.1 ? 'warn' : 'pass',
      title: 'Upload sharper photos',
      evidence: `${s.lowRes} of ${plural(n, 'product')} have at least one photo under 1,000 pixels wide, so zoom looks soft.`,
      pass: 'Photos are big enough to zoom.',
      why: `Shopify suggests ${LAUNCH.imageGuide.bestSquarePx} x ${LAUNCH.imageGuide.bestSquarePx} pixels for square product photos.`,
      how: `Export at ${LAUNCH.imageGuide.bestSquarePx} pixels square, under ${LAUNCH.imageGuide.maxMB} MB, and replace the small ones.`,
      minutes: 30,
    })
  );
  if (s.ratioKinds.length > 1) {
    out.push(
      check({
        id: 'ratios',
        area: 'Product pages',
        impact: 'low',
        status: 'warn',
        title: 'Crop product photos to one shape',
        evidence: `Featured photos come in ${s.ratioKinds.length} shapes (${text.list(s.ratioKinds)}), so collection grids look uneven.`,
        why: 'Shopify recommends one aspect ratio for featured images so collection pages line up.',
        how: 'Crop every featured photo to the same shape, square is easiest.',
        minutes: 30,
      })
    );
  }
  if (s.variantsNoImages >= 3) {
    out.push(
      check({
        id: 'variant_photos',
        area: 'Product pages',
        impact: 'low',
        status: 'warn',
        title: 'Show a photo for each option',
        evidence: `${s.variantsNoImages} products have options (like color) but one photo or none.`,
        why: 'When someone picks Moss instead of Oat, the photo should change too.',
        how: 'Add one photo per option, then attach it to that variant in the product page.',
        minutes: 30,
      })
    );
  }
  const alt = r.alt || {};
  if (alt.images) {
    const share = alt.missing / alt.images;
    out.push(
      check({
        id: 'alt_text',
        area: 'Search and access',
        impact: 'medium',
        status: share >= 0.5 ? 'fail' : share >= 0.2 ? 'warn' : 'pass',
        title: 'Add alt text to product photos',
        evidence: `${alt.missing} of ${plural(alt.images, 'photo')} we checked (on ${plural(alt.products, 'product')}) have no alt text.`,
        pass: `Every photo we checked has alt text (${plural(alt.images, 'photo')}).`,
        why: "Alt text is what screen readers say out loud and what search engines read for an image.",
        how: `${LAUNCH.paths.altText}`,
        minutes: 25,
        fixedBy: 'alt',
      })
    );
  }

  return trustChecks(r, out, { n, s, home, pages, apps });
}

// Checks that work from the homepage alone (a store whose product feed is off still gets these).
function trustChecks(r, out, { n, s, home, pages, apps }) {
  // ---------- trust ----------
  const reviews = apps.reviews || [];
  out.push(
    check({
      id: 'reviews',
      area: 'Trust',
      impact: 'high',
      status: reviews.length ? 'pass' : r.pdpChecked ? 'fail' : 'warn',
      title: 'Show product reviews',
      evidence: reviews.length ? '' : `We didn't see a reviews app on the homepage${r.pdpChecked ? ' or a product page' : ''}.`,
      pass: `Reviews app: ${text.list(reviews)}.`,
      why: 'New buyers look for other buyers. Reviews also answer questions you never thought to put on the page.',
      how: "Install a reviews app from the Shopify App Store (check each app's current pricing), then email past buyers and ask for an honest review. Never write or buy reviews.",
      minutes: 40,
      fixedBy: 'emails',
    })
  );
  const emailApps = apps.email || [];
  out.push(
    check({
      id: 'email',
      area: 'Email',
      impact: 'high',
      status: emailApps.length || home.emailForm ? 'pass' : 'fail',
      title: 'Add an email signup',
      evidence: emailApps.length || home.emailForm ? '' : "We didn't see an email signup form or email app on the homepage.",
      pass: emailApps.length ? `Email signup: ${text.list(emailApps)}.` : "Email signup: Shopify's own newsletter form.",
      why: 'Many visitors leave without buying. A signup is how you reach them again with a new product or a restock.',
      how: 'Most themes have an email signup option in the footer (Online Store > Edit theme > Footer), or add a signup app. Offer something real for joining, like first look at new products.',
      minutes: 20,
    })
  );
  const fs = home.freeShipping;
  out.push(
    check({
      id: 'shipping_promise',
      area: 'Trust',
      impact: 'medium',
      status: fs ? 'pass' : 'warn',
      title: 'Say your shipping terms up top',
      evidence: fs ? '' : "We didn't see a shipping promise on the homepage (a free shipping threshold or how fast orders ship).",
      pass: `Homepage says: "${fs ? fs.text : ''}".`,
      why: 'Surprise shipping costs at checkout are a common reason carts get left behind. Saying it early removes the surprise.',
      how: `Put your real terms in a bar at the top of every page. To set free shipping over an amount: ${LAUNCH.paths.freeShipping}`,
      minutes: 15,
      fixedBy: 'sections',
    })
  );
  out.push(
    check({
      id: 'returns_page',
      area: 'Trust',
      impact: 'medium',
      status: pages.returns ? 'pass' : 'fail',
      title: 'Publish a returns policy',
      evidence: pages.returns ? '' : "We didn't see a link to a returns or refund policy.",
      pass: 'Returns policy linked.',
      why: 'Buyers check the return policy before a first order from a store they don\'t know.',
      how: `${LAUNCH.paths.policies} ${LAUNCH.paths.policiesShow}`,
      minutes: 20,
    })
  );
  out.push(
    check({
      id: 'shipping_page',
      area: 'Trust',
      impact: 'medium',
      status: pages.shipping ? 'pass' : 'warn',
      title: 'Publish a shipping policy',
      evidence: pages.shipping ? '' : "We didn't see a link to a shipping policy.",
      pass: 'Shipping policy linked.',
      why: 'How much and how fast are the first two questions a new buyer has.',
      how: `${LAUNCH.paths.policies}`,
      minutes: 15,
    })
  );
  out.push(
    check({
      id: 'faq',
      area: 'Trust',
      impact: 'low',
      status: pages.faq ? 'pass' : 'warn',
      title: 'Answer common questions on the page',
      evidence: pages.faq ? '' : "We didn't see an FAQ page.",
      pass: 'FAQ page linked.',
      why: 'Every question answered on the page is one less reason to leave and think about it.',
      how: 'Add an FAQ section to your product pages with your real answers on shipping, returns, care and sizing.',
      minutes: 20,
      fixedBy: 'sections',
    })
  );
  out.push(
    check({
      id: 'about',
      area: 'Trust',
      impact: 'low',
      status: pages.about ? 'pass' : 'warn',
      title: 'Tell your story',
      evidence: pages.about ? '' : "We didn't see an About or Our story page.",
      pass: 'About page linked.',
      why: 'People buy from people. A short story with a real photo of you makes a small shop feel safe to order from.',
      how: 'Write five sentences: who you are, why you started, how you make it, where, and what you care about. Add one photo of you at work.',
      minutes: 30,
      fixedBy: 'sections',
    })
  );
  const contactable = !!(pages.contact || (home.emails && home.emails.length) || (home.phones && home.phones.length));
  out.push(
    check({
      id: 'contact',
      area: 'Trust',
      impact: 'medium',
      status: contactable ? 'pass' : 'warn',
      title: 'Make it easy to reach you',
      evidence: contactable ? '' : "We didn't see a contact page, email or phone number.",
      pass: pages.contact ? 'Contact page linked.' : `${home.emails && home.emails.length ? 'An email address' : 'A phone number'} on the homepage.`,
      why: 'A real way to reach you is the fastest trust signal there is.',
      how: 'Add a Contact page with an email you answer, and link it in the footer.',
      minutes: 10,
    })
  );
  if (n && s.onSale / n >= 0.6) {
    out.push(
      check({
        id: 'compare_at',
        area: 'Trust',
        impact: 'low',
        status: 'info',
        title: 'Check your crossed-out prices',
        evidence: `${s.onSale} of ${plural(n, 'product')} show a compare-at (crossed-out) price.`,
        why: LAUNCH.rules.formerPrice,
        how: 'Keep a compare-at price only where it was your real regular price for a fair stretch of time.',
        minutes: 10,
      })
    );
  }

  // ---------- catalog ----------
  if (n) {
    const so = s.soldOut / n;
    out.push(
      check({
        id: 'sold_out',
        area: 'Catalog',
        impact: 'medium',
        status: so >= 0.4 ? 'fail' : so >= 0.25 ? 'warn' : 'pass',
        title: 'Deal with sold-out products',
        evidence: `${s.soldOut} of ${plural(n, 'product')} are sold out.`,
        pass: s.soldOut ? `Only ${plural(s.soldOut, 'product')} sold out.` : 'Nothing sold out.',
        why: 'A page full of Sold out buttons makes the shop look closed.',
        how: 'Hide products you will not restock. For ones coming back, say when, and collect emails for a restock note.',
        minutes: 20,
      })
    );
  }
  if (n >= 12 && r.collectionsCount != null && r.collectionsCount <= 1) {
    out.push(
      check({
        id: 'collections',
        area: 'Catalog',
        impact: 'low',
        status: 'warn',
        title: 'Group products into collections',
        evidence: `${plural(n, 'product')} and ${r.collectionsCount || 0} collection${r.collectionsCount === 1 ? '' : 's'}.`,
        why: 'Collections are the aisles of the shop: by type, by occasion, by price.',
        how: 'Make 3 to 6 collections (best sellers, gifts under a set price, one per product type) and put them in the main menu.',
        minutes: 30,
      })
    );
  }
  if (n && s.untyped / n >= 0.5) {
    out.push(
      check({
        id: 'types',
        area: 'Catalog',
        impact: 'low',
        status: 'warn',
        title: 'Give every product a type',
        evidence: `${s.untyped} of ${plural(n, 'product')} have no product type.`,
        why: 'Types power automatic collections and the filters shoppers use to narrow down.',
        how: 'Open each product and fill in Type (Candle, Mug, Print). The import CSV in this pack can fill it for many at once.',
        minutes: 20,
      })
    );
  }
  if (s.lastUpdated) {
    const days = Math.round((Date.parse(r.fetchedAt || new Date().toISOString()) - Date.parse(s.lastUpdated)) / 86400000);
    if (days > 120) {
      out.push(
        check({
          id: 'stale',
          area: 'Catalog',
          impact: 'low',
          status: 'warn',
          title: 'Show the shop is active',
          evidence: `No product has changed in ${money.int(days)} days.`,
          why: 'A new product or a fresh photo now and then tells buyers someone is home.',
          how: 'Add one new product or refresh one product page every couple of weeks.',
          minutes: 30,
        })
      );
    }
  }

  // ---------- search ----------
  out.push(
    check({
      id: 'home_meta',
      area: 'Search and access',
      impact: 'medium',
      status: home.description ? (String(home.title || '').length > 70 ? 'warn' : 'pass') : 'fail',
      title: 'Write the homepage search listing',
      evidence: !home.description ? 'The homepage has no meta description, so search engines make one up.' : String(home.title || '').length > 70 ? `The homepage title is ${String(home.title).length} characters; search results cut it off after about 70.` : '',
      pass: 'Homepage title and description are set.',
      why: 'The title and description are your ad in search results.',
      how: `${LAUNCH.paths.homeSeo} Keep the title short, and say what you sell and where in the description.`,
      minutes: 10,
      fixedBy: 'copy',
    })
  );
  if (s.longTitles) {
    out.push(
      check({
        id: 'long_titles',
        area: 'Search and access',
        impact: 'low',
        status: 'warn',
        title: 'Shorten long product titles',
        evidence: `${s.longTitles} product titles are over ${CSV.limits.seoTitle} characters.`,
        why: `Shopify says titles over ${CSV.limits.seoTitle} characters might get cut off in search results.`,
        how: LAUNCH.paths.productSeo,
        minutes: 15,
        fixedBy: 'copy',
      })
    );
  }

  // ---------- selling more to each buyer ----------
  if (n >= 10) {
    const up = apps.upsell || [];
    out.push(
      check({
        id: 'add_ons',
        area: 'Order size',
        impact: 'low',
        status: up.length ? 'pass' : 'warn',
        title: 'Suggest an add-on on product pages',
        evidence: up.length ? '' : "We didn't see an add-on, bundle or 'pairs well with' offer.",
        pass: `Add-ons: ${text.list(up)}.`,
        why: 'A matching add-on (matches with a candle, a card with a gift) helps buyers finish the job in one order.',
        how: LAUNCH.paths.complementary,
        minutes: 20,
      })
    );
  }
  const px = r.pixels || {};
  const anyPixel = px.meta || px.tiktok || px.google || px.pinterest;
  out.push(
    check({
      id: 'tracking',
      area: 'Order size',
      impact: 'low',
      status: anyPixel ? 'pass' : 'warn',
      title: 'Set up ad tracking before you run ads',
      evidence: anyPixel ? '' : "We didn't see Meta, Google, TikTok or Pinterest tracking tags.",
      pass: `Tracking tags seen: ${text.list(['meta', 'google', 'tiktok', 'pinterest'].filter((k) => px[k]).map((k) => ({ meta: 'Meta', google: 'Google', tiktok: 'TikTok', pinterest: 'Pinterest' })[k]))}.`,
      why: 'Without them you can\'t tell which ads led to sales.',
      how: 'Install the sales channel app for the ad platform you plan to use (Facebook & Instagram, Google & YouTube, TikTok) from the Shopify App Store and connect your account.',
      minutes: 20,
    })
  );
  const socials = home.socials || {};
  if (!socials.instagram && !socials.tiktok && !socials.facebook && !socials.youtube && !socials.x) {
    out.push(
      check({
        id: 'social',
        area: 'Order size',
        impact: 'low',
        status: 'warn',
        title: 'Link your social accounts',
        evidence: "We didn't see links to Instagram, TikTok, Facebook or YouTube.",
        why: 'Buyers check a shop\'s social accounts to see it\'s real and active.',
        how: 'Most themes take your social links in Online Store > Edit theme > Theme settings > Social media.',
        minutes: 5,
      })
    );
  }
  if (r.os2 === false) {
    out.push(check({ id: 'theme', area: 'Theme', impact: 'low', status: 'info', title: 'Older theme', evidence: `${r.theme && r.theme.name ? `${r.theme.name}: ` : ''}an older theme.`, why: THEME.themeNeed, how: 'Before adding sections to product pages, try a free Online Store 2.0 theme on a copy of your store.' }));
  }
  if (home.mobileReady === false) {
    out.push(check({ id: 'mobile', area: 'Theme', impact: 'high', status: 'fail', title: 'Make the store work on phones', evidence: 'The homepage has no mobile viewport tag.', why: 'Most shoppers browse on phones.', how: 'Switch to a current theme from the Shopify Theme Store.', minutes: 60 }));
  }
  return out;
}

function scoreOf(checks) {
  let score = 100;
  for (const c of checks) if (c.status === 'fail' || c.status === 'warn') score -= WEIGHT[c.impact][c.status];
  return Math.max(8, Math.min(99, Math.round(score)));
}

function gradeOf(score) {
  return score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 55 ? 'Needs work' : 'Big gaps';
}

const RANK = { high: 3, medium: 2, low: 1 };

// Fixes in the order to do them: impact, then failures before warnings, then the quick ones.
function fixesOf(checks) {
  return checks
    .filter((c) => c.status === 'fail' || c.status === 'warn')
    .sort((a, b) => RANK[b.impact] - RANK[a.impact] || (a.status === 'fail' ? -1 : 0) - (b.status === 'fail' ? -1 : 0) || (a.minutes || 99) - (b.minutes || 99))
    .map((c) => ({ id: c.id, area: c.area, title: c.title, evidence: c.evidence, why: c.why, how: c.how, impact: c.impact, status: c.status, minutes: c.minutes, fixedBy: c.fixedBy ? FIXED_BY[c.fixedBy] : null, fixedKey: c.fixedBy || null }));
}

function strengthsOf(checks) {
  return checks.filter((c) => c.status === 'pass' && c.pass).map((c) => c.pass);
}

// Per-product problems, worst first (for the issues CSV and the "needs the most help" table).
function productIssues(r) {
  const withPhotos = Object.fromEntries((r.products || []).map((p) => [p.handle, p.imageList]));
  return (r.rows || r.products || [])
    .map((p0) => {
      const p = { ...p0, imageList: p0.imageList || withPhotos[p0.handle] || [] };
      const issues = [];
      if (!p.words) issues.push('no description');
      else if (p.words < 50) issues.push(`${p.words} words`);
      if (!p.images) issues.push('no photo');
      else if (p.images === 1) issues.push('1 photo');
      if (p.minWidth && p.minWidth < 1000) issues.push(`photos ${p.minWidth}px wide`);
      const missingAlt = (p.imageList || []).filter((i) => i.alt != null && !String(i.alt).trim()).length;
      if (missingAlt) issues.push(`${missingAlt} photo${missingAlt === 1 ? '' : 's'} without alt text`);
      if (!p.type) issues.push('no type');
      if (p.title.length > 70) issues.push('title over 70 characters');
      if (p.soldOut) issues.push('sold out');
      if (p.variants > 1 && p.images <= 1) issues.push('options without photos');
      return { handle: p.handle, title: p.title, url: p.url, price: p.price, photos: p.images, words: p.words, soldOut: p.soldOut, issues, weight: issues.length + (p.soldOut ? -2 : 0) };
    })
    .sort((a, b) => b.weight - a.weight || a.words - b.words);
}

function audit(r) {
  const checks = checksFor(r);
  const score = scoreOf(checks);
  const fixes = fixesOf(checks);
  return { score, grade: gradeOf(score), checks, fixes, strengths: strengthsOf(checks), products: productIssues(r) };
}

// The lean facts the sample page, the video and the pitch need (kept small for step outputs).
function pitchData(r, a) {
  const t = r.target || {};
  const others = (r.products || []).filter((p) => p.handle !== t.handle && p.images && p.price != null && !p.soldOut).slice(0, 3);
  return {
    store: { name: r.name, url: r.url, domain: r.domain, origin: r.origin, currency: (r.meta && r.meta.currency) || 'USD', city: (r.meta && r.meta.city) || null, colors: (r.home && r.home.colors) || null, emails: (r.home && r.home.emails) || [], instagram: (r.home && r.home.socials && r.home.socials.instagram) || null, theme: r.theme ? r.theme.name : null, os2: r.os2 },
    target: t.handle
      ? { title: t.title, handle: t.handle, url: t.url, type: t.type, vendor: t.vendor, price: t.price, priceMax: t.priceMax, compareAt: t.compareAt, words: t.words, images: t.images, image: t.image, imageList: (t.imageList || []).slice(0, 5), options: t.optionValues || [], minWidth: t.minWidth, text: text.clip(t.text || '', 400) }
      : null,
    related: others.map((p) => ({ title: p.title, handle: p.handle, url: p.url, price: p.price, image: p.image })),
    facts: {
      freeShipping: r.home && r.home.freeShipping ? r.home.freeShipping.text : null,
      pages: Object.fromEntries(Object.entries(r.pages || {}).filter(([, v]) => v)),
      reviewsApp: ((r.apps && r.apps.reviews) || [])[0] || null,
      emailApp: ((r.apps && r.apps.email) || [])[0] || null,
      emailForm: !!(r.home && r.home.emailForm),
      products: r.productsTotal,
      photosPerProduct: r.stats ? r.stats.imagesPerProduct : null,
      wordsMedian: r.stats ? r.stats.wordsMedian : null,
      thin: r.stats ? r.stats.thin : null,
      oneImage: r.stats ? r.stats.oneImage : null,
      altMissing: r.alt ? r.alt.missing : null,
      altImages: r.alt ? r.alt.images : null,
    },
    score: a.score,
    grade: a.grade,
    fixes: a.fixes.slice(0, 5).map((f) => ({ id: f.id, title: f.title, evidence: f.evidence, impact: f.impact })),
    sample: !!r.sample,
  };
}

module.exports = { audit, checksFor, scoreOf, gradeOf, fixesOf, strengthsOf, productIssues, pitchData, FIXED_BY, labelOf };
