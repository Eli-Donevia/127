// The pack pages (lib/shop.js), behind SHOP_PACKS. Mounted in server.js before the 404:
//
//   app.use(shopRoutes({ track }));
//
//   GET  /packs                          every pack, with one-tap buy buttons
//   GET  /packs/:slug                    a pack's own landing page (slug "all" is the every-pack bundle)
//   POST /packs/:slug/buy                starts Stripe Checkout (no account needed), or opens the files if owned
//   GET  /packs/:slug/thanks             Checkout's success page: confirms the session, then opens the files
//   GET  /packs/:slug/get                the buyer's files (signed in and owning it, or with the private link ?k=)
//   GET  /packs/:slug/files/:ref/:file   one download (ref is a Store item id, or kit-<kit> for a pack's own files)
//   GET  /packs/:slug/peek/:ref          an item's preview picture for the landing page (public)
//   GET  /packs/starter/claim            the free Starter Pack: sign up, or straight to the files
//
// With SHOP_PACKS off for the visitor every route falls through to the 404. A buyer's private keys are also kept in
// their session, so the browser that bought a pack keeps access without the link.

const express = require('express');
const shop = require('./shop');
const security = require('./security');
const { plan } = require('./plans');

const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';

function privatePage(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
}
const keysOf = (req) => {
  const k = typeof req.query.k === 'string' ? [req.query.k] : [];
  return k.concat(Array.isArray(req.session.packKeys) ? req.session.packKeys : []);
};
const remember = (req, key) => {
  if (key) req.session.packKeys = [key].concat((req.session.packKeys || []).filter((x) => x !== key)).slice(0, 8);
};

// A download row for the files page: each item's files, or each Motion move.
function downloadsFor(pack, slug, key) {
  const q = key ? `?k=${encodeURIComponent(key)}` : '';
  const rows = pack.items.map((i) => ({
    title: i.title,
    summary: i.summary,
    kind: i.kind,
    files: i.formats.map((f) => ({ label: f.label, href: `/packs/${slug}/files/${i.id}/${encodeURIComponent(f.name)}${q}` })),
    links: (i.links || []).filter((l) => !l.internal).map((l) => ({ label: l.label, href: l.url })),
  }));
  if (pack.moves.length) {
    const ref = `kit-${pack.kit}`;
    const label = (f) => (/\.html$/.test(f) ? 'Open and save (.html)' : 'Download (.md)');
    rows.unshift({ title: 'Start here', summary: 'What is in these files and how to use them.', kind: 'guide', files: [{ label: 'README', href: `/packs/${slug}/files/${ref}/README.md${q}` }], links: [] });
    for (const m of pack.moves) rows.push({ title: m.title, summary: m.summary || null, kind: pack.kit, files: [{ label: label(m.file), href: `/packs/${slug}/files/${ref}/${m.file}${q}` }], links: [] });
  }
  return rows;
}

function shopRoutes({ track = () => {} } = {}) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const on = (req, res, next) => (shop.visibleTo(req.user) ? next() : next('router'));
  const builder = () => plan('builder');

  r.get('/packs', on, (req, res) => {
    const packs = shop.list();
    res.render('packs/index', {
      title: 'Packs',
      description: 'Site designs, motion, content, sales, numbers and ops files for a new business. Buy one pack once, or get every pack with Builder.',
      css: ['/css/packs.css'],
      packs,
      bundle: shop.catalog().bundle,
      owned: shop.ownedSlugs(req.user, { keys: keysOf(req) }),
      builder: builder(),
      cancelled: req.query.checkout === 'cancelled',
      unavailable: req.query.checkout === 'unavailable',
    });
  });

  r.get('/packs/starter/claim', on, (req, res) => {
    if (req.user) return res.redirect('/packs/starter/get');
    track(req, 'Pack Claim', { pack: 'starter' });
    res.redirect('/start?from=starter-pack');
  });

  r.get('/packs/:slug', on, (req, res, next) => {
    const pack = shop.get(req.params.slug);
    if (!pack) return next();
    const c = shop.catalog();
    const isBundle = !!pack.bundle;
    const contents = isBundle ? shop.bundleContents() : null;
    const sum = isBundle ? contents.reduce((n, p) => n + p.price, 0) : 0;
    res.render('packs/pack', {
      title: pack.name,
      description: pack.line,
      css: ['/css/packs.css'],
      js: ['/js/packs.js'],
      pack,
      contents,
      sum,
      others: c.packs.filter((p) => p.slug !== pack.slug && !p.free).map((p) => shop.get(p.slug)),
      owned: shop.owns(req.user, pack.slug, { keys: keysOf(req) }),
      builderGetsAll: c.builderGets === 'all',
      builder: builder(),
      cancelled: req.query.checkout === 'cancelled',
      unavailable: req.query.checkout === 'unavailable',
    });
  });

  r.post('/packs/:slug/buy', on, wrap(async (req, res, next) => {
    const pack = shop.get(req.params.slug);
    if (!pack) return next();
    const back = security.safeNext(req.body && req.body.from, `/packs/${pack.slug}`);
    if (!security.allow(`packbuy:${security.ip(req)}`, 12, 10 * 60 * 1000)) return res.status(429).send(TOO_FAST);
    try {
      const url = await shop.checkoutUrl(req, req.user, pack.slug, { from: back, ipHash: security.hash(security.ip(req)) });
      const k = /[?&]k=([a-f0-9]{64})/.exec(url);
      if (k) remember(req, k[1]);
      track(req, 'Pack Checkout', { pack: pack.slug, from: back.split('?')[0] });
      res.redirect(303, url);
    } catch (err) {
      if (!(err instanceof shop.ShopUnavailable) && !(err instanceof require('./billing').BillingUnavailable)) console.error('[shop] checkout failed', err.message);
      res.redirect(303, `${back}${back.includes('?') ? '&' : '?'}checkout=unavailable`);
    }
  }));

  r.get('/packs/:slug/thanks', on, wrap(async (req, res, next) => {
    const pack = shop.get(req.params.slug);
    if (!pack) return next();
    privatePage(res);
    const done = await shop.confirm(req.query.session_id).catch((e) => {
      console.error('[shop] confirm failed', e.message);
      return null;
    });
    if (done && done.purchase.pack === pack.slug) {
      remember(req, done.key);
      track(req, 'Pack Purchased', { pack: pack.slug });
      return res.redirect(303, `/packs/${pack.slug}/get?k=${done.key}&bought=1`);
    }
    // Not confirmed yet (a slow bank method) or not this pack: say what happens next.
    res.status(202).render('packs/pending', { title: 'Almost there', css: ['/css/packs.css'], pack, noindex: true });
  }));

  r.get('/packs/:slug/get', on, (req, res, next) => {
    const pack = shop.get(req.params.slug);
    if (!pack) return next();
    const keys = keysOf(req);
    if (!shop.owns(req.user, pack.slug, { keys })) {
      if (pack.free) return res.redirect('/packs/starter/claim');
      return res.redirect(`/packs/${pack.slug}`);
    }
    privatePage(res);
    // The key that opened it travels on each download link, so a link copied to another device still works.
    const key = keys.find((k) => {
      const p = shop.byKey(k);
      return p && (p.pack === pack.slug || p.pack === 'all');
    }) || null;
    remember(req, key);
    const parts = pack.bundle ? shop.bundleContents() : [pack];
    res.render('packs/library', {
      title: pack.name,
      css: ['/css/packs.css'],
      noindex: true,
      pack,
      sections: parts.map((p) => ({ name: p.name, rows: downloadsFor(p, pack.slug, key) })),
      bought: req.query.bought === '1',
      link: key ? `${(process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '')}/packs/${pack.slug}/get?k=${key}` : null,
      // Only say the link was emailed when email is on (Resend) and the purchase had an address.
      emailed: !!(process.env.RESEND_API_KEY && key && (shop.byKey(key) || {}).email),
      builder: builder(),
    });
  });

  r.get('/packs/:slug/files/:ref/:file', on, (req, res, next) => {
    const slug = req.params.slug;
    if (!shop.get(slug) || !shop.owns(req.user, slug, { keys: keysOf(req) })) return next();
    const hit = shop.resolveFile(slug, req.params.ref, req.params.file);
    if (!hit) return next();
    privatePage(res);
    res.set('X-Content-Type-Options', 'nosniff');
    // An HTML file downloads; if a browser opens it here anyway, it runs sandboxed with no access to the site.
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
    res.sendFile(hit.name, {
      root: hit.root,
      dotfiles: 'deny',
      headers: { 'Content-Type': hit.contentType, 'Content-Disposition': `attachment; filename="${hit.name}"` },
    }, (err) => {
      if (err && !res.headersSent) next(err.status === 404 ? undefined : err);
    });
    track(req, 'Pack Download', { pack: slug, file: hit.name });
  });

  r.get('/packs/:slug/peek/:ref', on, (req, res, next) => {
    const hit = shop.resolvePeek(req.params.slug, req.params.ref);
    if (!hit) return next();
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(hit.name, { root: hit.root, dotfiles: 'deny', headers: { 'Content-Type': hit.contentType, 'Cache-Control': 'public, max-age=86400' } }, (err) => {
      if (err && !res.headersSent) next(err.status === 404 ? undefined : err);
    });
  });

  return r;
}

module.exports = shopRoutes;
module.exports.downloadsFor = downloadsFor;
