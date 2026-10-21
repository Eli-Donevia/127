// The Invite page (lib/referrals.js, REFERRALS) and the member marketplace (lib/market.js, MARKETPLACE). Mounted in
// server.js before the 404:
//
//   app.use(marketRoutes({ requireAuth, requireAdmin, flash, track }));
//
//   GET  /app/invite                       the member's link, share buttons, friends by first name, months earned
//
//   GET  /market                           every live listing (?kind= ?niche=)
//   GET  /market/:slug                     a listing's page
//   GET  /market/:slug/cover               its cover picture (public)
//   POST /market/:slug/buy                 Stripe Checkout (no account needed), or the files when owned
//   GET  /market/:slug/thanks              Checkout's success page
//   GET  /market/:slug/get                 the buyer's files (signed in and owning it, or ?k= from the receipt)
//   GET  /market/:slug/files/:fid          one download
//   GET  /market/:slug/report, POST        report a listing (copied, misleading, broken, not allowed)
//   GET  /makers/:handle                   a creator's page
//
//   GET  /app/sell                         the seller's page: set up, payouts, listings, sales
//   POST /app/sell/profile                 creator page words
//   GET  /app/sell/payouts                 Stripe Connect onboarding (and its refresh link)
//   GET  /app/sell/payouts/done            back from Stripe
//   GET  /app/sell/payouts/dashboard       the creator's Stripe Express dashboard
//   GET  /app/sell/new, /app/sell/:id      the listing form; POST saves
//   POST /app/sell/:id/files               add a file (the page's script sends it as the body; X-File-Name)
//   POST /app/sell/:id/files/:fid/delete
//   POST /app/sell/:id/cover               the cover picture (body = the image)
//   POST /app/sell/:id/submit              the rights box, the checks, then review
//
//   GET  /admin/market, POST /admin/market/:id/:action    the review queue and reports
//
// With a switch off for the visitor, its routes fall through to the 404.

const express = require('express');
const market = require('./market');
const referrals = require('./referrals');
const security = require('./security');
const { plan } = require('./plans');

const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';
const privatePage = (res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
};
const keysOf = (req) => {
  const k = typeof req.query.k === 'string' ? [req.query.k] : [];
  return k.concat(Array.isArray(req.session.marketKeys) ? req.session.marketKeys : []);
};
const remember = (req, key) => {
  if (key) req.session.marketKeys = [key].concat((req.session.marketKeys || []).filter((x) => x !== key)).slice(0, 12);
};
const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0)}`;
const kb = (bytes) => (bytes < 1024 * 100 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function marketRoutes({ requireAuth, requireAdmin, flash = () => {}, track = () => {} } = {}) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const marketOn = (req, res, next) => (market.visibleTo(req.user) ? next() : next('router'));
  const invitesOn = (req, res, next) => (referrals.visibleTo(req.user) ? next() : next('router'));
  const common = { money, kb, KINDS: market.KINDS, STATUS: market.STATUS };

  // ---- the Invite page ----
  r.get('/app/invite', requireAuth, invitesOn, wrap(async (req, res) => {
    const code = await referrals.codeFor(req.user);
    res.render('market/invite', {
      title: 'Invite',
      css: ['/css/market.css'],
      ref: referrals.summary(req.user, code),
      WAIT_DAYS: referrals.WAIT_DAYS,
      YEAR_CAP: referrals.YEAR_CAP,
      builder: plan('builder'),
      ...common,
    });
  }));

  // ---- public shelves ----
  r.get('/market', marketOn, (req, res) => {
    const kind = market.KINDS[req.query.kind] ? req.query.kind : null;
    const niche = typeof req.query.niche === 'string' ? req.query.niche.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) : null;
    const all = market.shelf();
    const listings = market.shelf({ kind, niche }).map(market.card);
    const niches = [...new Set(all.flatMap((l) => l.tags || []))].sort();
    res.render('market/index', {
      title: 'Marketplace',
      description: 'Site designs, templates, prompt packs and workflows made by people building their own businesses on 127. Checked by 127 before they go up.',
      css: ['/css/market.css'],
      listings,
      kind,
      niche,
      niches,
      counts: Object.fromEntries(Object.keys(market.KINDS).map((k) => [k, all.filter((l) => l.kind === k).length])),
      total: all.length,
      canSell: market.canSell(req.user),
      ...common,
    });
  });

  r.get('/market/:slug', marketOn, (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    if (!l) return next();
    const preview = !market.onShelf(l) && req.user && (req.user.id === l.sellerId || res.locals.isAdmin);
    if (!market.onShelf(l) && !preview) return next();
    const seller = market.sellerFor({ id: l.sellerId });
    const more = market.listingsOf(l.sellerId).filter((x) => x.id !== l.id && market.onShelf(x)).slice(0, 3).map(market.card);
    res.render('market/listing', {
      title: l.title,
      description: l.line,
      css: ['/css/market.css'],
      ogImage: null,
      l,
      c: market.card(l),
      seller,
      more,
      preview: !!preview,
      owned: market.owns(req.user, l, keysOf(req)),
      split: market.split(l.price, req.user && req.user.id === l.sellerId ? req.user : null),
      cancelled: req.query.checkout === 'cancelled',
      unavailable: req.query.checkout === 'unavailable',
      reported: req.query.reported === '1',
      ...common,
    });
  });

  r.get('/market/:slug/cover', marketOn, wrap(async (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    const visible = l && (market.onShelf(l) || (req.user && (req.user.id === l.sellerId || res.locals.isAdmin)));
    if (!visible || !l.cover) return next();
    const buf = await market.coverBlob(l);
    if (!buf) return next();
    res.set('Content-Type', l.cover.type);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', market.onShelf(l) ? 'public, max-age=86400' : 'private, no-store');
    res.send(buf);
  }));

  r.post('/market/:slug/buy', marketOn, wrap(async (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    if (!l) return next();
    if (!security.allow(`mktbuy:${security.ip(req)}`, 12, 10 * 60 * 1000)) return res.status(429).send(TOO_FAST);
    try {
      const url = await market.checkoutUrl(req.user, l.slug, { keys: keysOf(req) });
      const k = /[?&]k=([a-f0-9]{64})/.exec(url);
      if (k) remember(req, k[1]);
      track(req, 'Market Checkout', { listing: l.slug, kind: l.kind });
      res.redirect(303, url);
    } catch (err) {
      if (!(err instanceof market.MarketUnavailable)) console.error('[market] checkout failed', err.message);
      res.redirect(303, `/market/${l.slug}?checkout=unavailable`);
    }
  }));

  r.get('/market/:slug/thanks', marketOn, wrap(async (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    if (!l) return next();
    privatePage(res);
    const done = await market.confirm(req.query.session_id).catch((e) => {
      console.error('[market] confirm failed', e.message);
      return null;
    });
    if (done && done.order.listingId === l.id) {
      remember(req, done.key);
      track(req, 'Market Purchased', { listing: l.slug, kind: l.kind });
      return res.redirect(303, `/market/${l.slug}/get?k=${done.key}&bought=1`);
    }
    res.status(202).render('market/pending', { title: 'Almost there', css: ['/css/market.css'], l, noindex: true });
  }));

  r.get('/market/:slug/get', marketOn, (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    if (!l) return next();
    const keys = keysOf(req);
    if (!market.owns(req.user, l, keys)) return res.redirect(`/market/${l.slug}`);
    privatePage(res);
    const key = keys.find((k) => {
      const o = market.byKey(k);
      return o && o.listingId === l.id;
    }) || null;
    remember(req, key);
    res.render('market/files', {
      title: l.title,
      css: ['/css/market.css'],
      noindex: true,
      l,
      seller: market.sellerFor({ id: l.sellerId }),
      key,
      bought: req.query.bought === '1',
      link: key ? `${(process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '')}/market/${l.slug}/get?k=${key}` : null,
      emailed: !!(process.env.RESEND_API_KEY && key && (market.byKey(key) || {}).email),
      ...common,
    });
  });

  r.get('/market/:slug/files/:fid', marketOn, wrap(async (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    if (!l || !(market.owns(req.user, l, keysOf(req)) || res.locals.isAdmin)) return next();
    const f = (l.files || []).find((x) => x.id === req.params.fid);
    if (!f) return next();
    const buf = await market.fileBlob(l, f);
    if (!buf) return next();
    privatePage(res);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
    res.set('Content-Type', `${f.type}; charset=utf-8`);
    res.set('Content-Disposition', `attachment; filename="${f.name.replace(/["\\\r\n]/g, '')}"`);
    res.send(buf);
    track(req, 'Market Download', { listing: l.slug });
  }));

  r.get('/market/:slug/report', marketOn, (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    if (!l || !market.onShelf(l)) return next();
    res.render('market/report', { title: `Report ${l.title}`, css: ['/css/market.css'], l, noindex: true, error: null });
  });
  r.post('/market/:slug/report', marketOn, wrap(async (req, res, next) => {
    const l = market.bySlug(req.params.slug);
    if (!l || !market.onShelf(l)) return next();
    if (!security.allow(`mktreport:${security.ip(req)}`, 5, 60 * 60 * 1000)) return res.status(429).send(TOO_FAST);
    if (String(req.body.text || '').trim().length < 10) return res.status(400).render('market/report', { title: `Report ${l.title}`, css: ['/css/market.css'], l, noindex: true, error: 'Tell us what is wrong in a sentence or two.' });
    await market.report(l.slug, req.body || {}, security.ip(req));
    res.redirect(303, `/market/${l.slug}?reported=1`);
  }));

  r.get('/makers/:handle', marketOn, (req, res, next) => {
    const seller = market.byHandle(req.params.handle);
    if (!seller) return next();
    const listings = market.listingsOf(seller.id).filter(market.onShelf).map(market.card);
    if (!listings.length && !(req.user && req.user.id === seller.id)) return next();
    const sales = market.listingsOf(seller.id).reduce((n, l) => n + (l.sales || 0), 0);
    res.render('market/maker', { title: seller.name, description: seller.line, css: ['/css/market.css'], seller, listings, sales, ...common });
  });

  // ---- the Sell page ----
  const sellOn = [requireAuth, marketOn];
  r.get('/app/sell', ...sellOn, wrap(async (req, res) => {
    const user = req.user;
    let seller = market.sellerFor(user);
    if (seller && seller.stripeAccountId && !seller.payoutsReady) seller = await market.refreshPayouts(user).catch(() => seller);
    const listings = seller ? market.listingsOf(user.id) : [];
    res.render('market/sell', {
      title: 'Sell',
      css: ['/css/market.css'],
      canSell: market.canSell(user),
      seller,
      listings,
      earn: seller ? market.earnings(user.id) : null,
      fee: market.feePct(user),
      delay: market.payoutDelay(),
      builder: plan('builder'),
      payoutsJustReady: req.query.payouts === 'ready',
      ...common,
    });
  }));

  r.post('/app/sell/profile', ...sellOn, wrap(async (req, res) => {
    const out = await market.saveSeller(req.user, req.body || {});
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'info', 'Saved.');
    res.redirect(303, '/app/sell');
  }));

  r.get('/app/sell/payouts', ...sellOn, wrap(async (req, res) => {
    try {
      res.redirect(303, await market.payoutsLink(req.user));
    } catch (err) {
      if (!(err instanceof market.MarketUnavailable)) console.error('[market] payouts link', err.message);
      flash(req, 'error', err instanceof market.MarketUnavailable ? err.message : "Stripe didn't answer. Try again in a minute.");
      res.redirect(303, '/app/sell');
    }
  }));
  r.get('/app/sell/payouts/done', ...sellOn, wrap(async (req, res) => {
    const s = await market.refreshPayouts(req.user).catch(() => null);
    flash(req, 'info', s && s.payoutsReady ? 'Payouts are set up.' : 'Stripe needs a few more details before it can pay you. Pick up where you left off any time.');
    res.redirect(303, '/app/sell');
  }));
  r.get('/app/sell/payouts/dashboard', ...sellOn, wrap(async (req, res) => {
    const url = await market.dashboardLink(req.user).catch(() => null);
    if (!url) {
      flash(req, 'error', "Your Stripe dashboard opens once payouts are set up.");
      return res.redirect(303, '/app/sell');
    }
    res.redirect(303, url);
  }));

  const formPage = (res, user, l, error) => {
    const seller = market.sellerFor(user);
    res.status(error ? 400 : 200).render('market/edit', {
      title: l && l.id ? `Edit ${l.title}` : 'New listing',
      css: ['/css/market.css'],
      l: l || { files: [], tags: [], inside: [] },
      seller,
      error,
      checks: l && l.id ? market.check(l, seller) : null,
      NICHES: market.NICHES,
      LIMITS: market.LIMITS,
      split: market.split((l && l.price) || 29, user),
      ...common,
    });
  };
  const needSeller = (req, res, next) => (market.sellerFor(req.user) && market.canSell(req.user) ? next() : res.redirect(303, '/app/sell'));

  r.get('/app/sell/new', ...sellOn, needSeller, (req, res) => formPage(res, req.user, null, null));
  r.post('/app/sell/new', ...sellOn, needSeller, wrap(async (req, res) => {
    const out = await market.saveListing(req.user, null, req.body || {});
    if (out.error) return formPage(res, req.user, { ...req.body, files: [], tags: [], inside: String(req.body.inside || '').split('\n') }, out.error);
    res.redirect(303, `/app/sell/${out.listing.id}?saved=1`);
  }));
  r.get('/app/sell/:id', ...sellOn, needSeller, (req, res, next) => {
    const l = market.mine(req.user, req.params.id);
    if (!l) return next();
    formPage(res, req.user, l, null);
  });
  r.post('/app/sell/:id', ...sellOn, needSeller, wrap(async (req, res, next) => {
    const l = market.mine(req.user, req.params.id);
    if (!l) return next();
    const out = await market.saveListing(req.user, l.id, req.body || {});
    if (out.error) return formPage(res, req.user, { ...l, ...req.body, inside: String(req.body.inside || '').split('\n'), tags: String(req.body.tags || '').split(',') }, out.error);
    flash(req, 'info', out.listing.wasLive ? 'Saved. It goes back to 127 for a look before the change shows.' : 'Saved.');
    res.redirect(303, `/app/sell/${l.id}`);
  }));

  const raw = (max) => (req, res, next) => express.raw({ type: () => true, limit: max })(req, res, next);
  const uploadErr = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.status === 413 || err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is over 2 MB.' });
    res.status(400).json({ error: "Couldn't read that upload. Try again." });
  };
  const nameOf = (req) => {
    try {
      return decodeURIComponent(String(req.get('x-file-name') || 'file')).slice(0, 200);
    } catch {
      return 'file';
    }
  };
  r.post('/app/sell/:id/files', ...sellOn, needSeller, (req, res, next) => (security.allow(`mktup:${req.user.id}`, 60, 60 * 60 * 1000) ? next() : res.status(429).json({ error: TOO_FAST })), raw(market.LIMITS.fileBytes + 1024), wrap(async (req, res) => {
    const out = await market.addFile(req.user, req.params.id, nameOf(req), req.body);
    if (out.error) return res.status(400).json({ error: out.error });
    res.json({ file: { ...out.file, size: kb(out.file.size) } });
  }), uploadErr);
  r.post('/app/sell/:id/files/:fid/delete', ...sellOn, needSeller, wrap(async (req, res) => {
    await market.removeFile(req.user, req.params.id, req.params.fid);
    res.redirect(303, `/app/sell/${req.params.id}#files`);
  }));
  r.post('/app/sell/:id/cover', ...sellOn, needSeller, raw(market.LIMITS.coverBytes + 1024), wrap(async (req, res) => {
    const type = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const out = await market.setCover(req.user, req.params.id, type, req.body);
    if (out.error) return res.status(400).json({ error: out.error });
    res.json({ ok: true });
  }), uploadErr);
  r.post('/app/sell/:id/submit', ...sellOn, needSeller, wrap(async (req, res, next) => {
    const l = market.mine(req.user, req.params.id);
    if (!l) return next();
    const out = await market.submit(req.user, l.id, req.body || {});
    if (out.error) {
      flash(req, 'error', out.error);
      return res.redirect(303, `/app/sell/${l.id}#checks`);
    }
    track(req, 'Market Submitted', { kind: l.kind });
    flash(req, 'info', `Sent. 127 looks at every listing by hand, usually within 2 business days, and emails you either way.`);
    res.redirect(303, '/app/sell');
  }));

  // ---- review ----
  r.get('/admin/market', requireAuth, requireAdmin, (req, res) => {
    res.render('market/admin', { title: 'Marketplace review', css: ['/css/market.css'], q: market.queue(), setting: market.setting(), refs: referrals.stats(), refSetting: referrals.setting(), fee: market.feePct(null), ...common });
  });
  r.post('/admin/market/:id/:action', requireAuth, requireAdmin, wrap(async (req, res) => {
    const l = await market.review(req.user, req.params.id, req.params.action, req.body && req.body.note);
    flash(req, l ? 'info' : 'error', l ? `${l.title}: ${market.STATUS[l.status]}.` : "Couldn't do that.");
    res.redirect(303, '/admin/market');
  }));

  return r;
}

module.exports = marketRoutes;
