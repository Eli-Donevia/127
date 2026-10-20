// The HQ Store pages (W7, lib/store.js), behind STORE_V2. Mounted in server.js next to HQ v2:
//
//   app.use(storeRoutes({ requireAuth, flash, track }));
//
//   GET  /app/hq/store                  the gallery: kind and business type chips, search
//   GET  /app/hq/store/:id              an item: preview, how to use it, downloads, outside links,
//                                       prompts, and "Make it mine"
//   GET  /app/hq/store/:id/files/:file  a download (gated by plan; previews open to every member)
//   POST /app/hq/store/:id/make         starts store.make_it_mine and opens its run
//
// While the Store is off for the member (STORE_V2 off for them in lib/harness/flags.js, which keeps
// "on" to ADMIN_EMAILS until TERMS_LIVE and PRIVACY_LIVE are true, or HQ v2 off for them), every
// route here falls through to the 404, and the HQ tabs and the workspace rail show no Store
// (flags.STORE_V2 from flags.forUser).

const fs = require('fs');
const express = require('express');
const store = require('./store');
const security = require('./security');
const { canAccess } = require('./plans');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/store.css'];
const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';
const KIND_ICON = { site: 'Site', shopify: 'Shopify', notion: 'Notion', sheet: 'Sheet', doc: 'Doc', email: 'Email', social: 'Social', deck: 'Deck', checklist: 'Checklist', recipe: 'Recipe', 'video-prompts': 'Video', prompts: 'Prompts' };

function privatePage(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
}

// What a member sees on a card or an item page: plan lock, coming soon, preview link.
function cardOf(item, user, lib) {
  const open = store.canOpen(user, item);
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    kind: item.kind,
    kindLabel: lib.kinds[item.kind] || item.kind,
    kindShort: KIND_ICON[item.kind] || 'File',
    tier: item.tier,
    locked: !open,
    coming: item.status !== 'ready',
    preview: item.previewFile ? `/app/hq/store/${item.id}/files/${item.previewFile}` : null,
    mine: !!item.makeItMine && item.status === 'ready',
    disclaimer: item.disclaimer,
    types: item.businessTypes.filter((t) => t !== 'any').map((t) => lib.types[t] || t),
  };
}

const planName = (tier) => (tier === 'circle' ? "Founder's Circle" : 'Builder');

function storeRoutes({ requireAuth, flash = () => {}, track = () => {} }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  // Off: a plain 404, as if the Store weren't there. Signed out with the Store on: sign in first.
  const on = (req, res, next) => {
    if (store.setting() === 'off') return next('router');
    if (!req.user) return requireAuth(req, res, next);
    return store.enabledFor(req.user) ? next() : next('router');
  };
  // As lib/harness/routes.js does it: the flags drive the HQ tabs, and with HQ_WORKSPACE on the
  // workspace rail (lib/harness/nav.js) takes their place.
  const page = (req, res, view, title, locals) => {
    const harness = require('./harness');
    const nav = require('./harness/nav');
    privatePage(res);
    const inboxCount = harness.inbox.count(req.user.id), flags = harness.flags.forUser(req.user);
    const ws = nav.on() ? nav.workspace(req.user, { tab: 'store', inboxCount, flags }) : null;
    res.render(`app/hq2/${view}`, { title, css: ws ? CSS.concat('/css/hq2-ws.css') : CSS, tab: 'store', inboxCount, usage: harness.ledger.usage(req.user), flags, ws, ...locals });
  };

  r.get('/app/hq/store', on, (req, res) => {
    const lib = store.current();
    const kind = Object.prototype.hasOwnProperty.call(lib.kinds, req.query.kind) ? String(req.query.kind) : '';
    const type = Object.prototype.hasOwnProperty.call(lib.types, req.query.type) ? String(req.query.type) : '';
    const q = String(req.query.q || '').slice(0, 80);
    const items = store.list({ kind, type, q }, lib).map((i) => cardOf(i, req.user, lib));
    const facets = store.facets(lib);
    // A chip keeps the other filters: /app/hq/store?kind=sheet&type=local&q=cash
    const href = (over) => {
      const p = new URLSearchParams();
      const v = { kind, type, q, ...over };
      for (const k of ['kind', 'type', 'q']) if (v[k]) p.set(k, v[k]);
      const s = p.toString();
      return `/app/hq/store${s ? `?${s}` : ''}`;
    };
    page(req, res, 'store', 'Store', { items, facets, kind, type, q, href, empty: lib.missing || !lib.items.length });
  });

  r.get('/app/hq/store/:id', on, (req, res, next) => {
    const lib = store.current();
    const item = store.get(req.params.id, lib);
    if (!item) return next();
    const card = cardOf(item, req.user, lib);
    const downloads = card.coming ? [] : item.formats.map((f) => ({ name: f.name, label: f.label, size: store.fmtBytes(f.bytes), href: `/app/hq/store/${item.id}/files/${f.name}` }));
    const prompts = store.promptsFor(item, req.user, lib);
    // What "Make it mine" fills from Your business, and what it will ask or leave for the member.
    let mine = null;
    if (card.mine && !card.locked) {
      const harness = require('./harness');
      const { valuesFor } = require('./packs/store/lib/values');
      const brain = harness.brain.snapshot(req.user);
      const have = valuesFor({ brain, member: { firstName: harness.brain.firstName(req.user) }, inputs: {}, now: Date.now() });
      const tokens = [...new Set([...item.makeItMine.tokens, ...item.makeItMine.cells.flatMap((c) => [...c.value.matchAll(/\{\{([a-z]+\.[a-z]+|today|year)/g)].map((m) => m[1]))])];
      const asked = ['contact.email', 'contact.phone'];
      const tool = harness.packs.tool('store.make_it_mine');
      mine = {
        credits: tool ? tool.credits : 1,
        email: tokens.includes('contact.email') || item.makeItMine.asks.includes('contact.email'),
        phone: tokens.includes('contact.phone') || item.makeItMine.asks.includes('contact.phone'),
        fills: tokens.filter((t) => !asked.includes(t)).map((t) => ({ token: t, label: (lib.tokens[t] || {}).label || t, have: !!have[t] })),
      };
    }
    page(req, res, 'store-item', item.title, { item, card, downloads, prompts, mine, planName: planName(item.tier), types: card.types });
  });

  // Downloads. A preview opens for every member (the gallery shows Builder cards to free members);
  // any other file needs the item's plan. A .tpl source never resolves.
  r.get('/app/hq/store/:id/files/:file', on, (req, res, next) => {
    const hit = store.resolveFile(req.params.id, req.params.file);
    if (!hit) return next();
    if (!hit.isPreview && !store.canOpen(req.user, hit.item)) return res.redirect(302, `/app/hq/store/${hit.item.id}?locked=1#unlock`);
    if (!fs.existsSync(hit.abs)) return next();
    res.set('X-Content-Type-Options', 'nosniff');
    // An HTML or SVG download never runs here: it downloads, sandboxed if a browser opens it anyway.
    if (!hit.isPreview) res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
    const headers = {
      'Content-Type': hit.contentType,
      'Cache-Control': hit.isPreview ? 'private, max-age=86400' : 'private, no-cache',
      'Content-Disposition': `${hit.isPreview ? 'inline' : 'attachment'}; filename="${hit.name}"`,
    };
    res.sendFile(hit.name, { root: hit.root, headers, dotfiles: 'deny', lastModified: true }, (err) => {
      if (err && !res.headersSent) next(err.status === 404 ? undefined : err);
    });
    if (!hit.isPreview) track(req, 'Store Download', { item: hit.item.id, file: hit.name });
  });

  r.post('/app/hq/store/:id/make', on, wrap(async (req, res, next) => {
    const item = store.get(req.params.id);
    if (!item) return next();
    const back = `/app/hq/store/${item.id}`;
    if (!item.makeItMine || item.status !== 'ready') return res.redirect(back);
    if (!canAccess({ tier: store.tierOf(req.user) }, item.tier)) return res.redirect(302, `${back}?locked=1#unlock`);
    if (!security.allow(`store-make:${req.user.id}`, 20, 60 * 60 * 1000)) {
      flash(req, 'info', TOO_FAST);
      return res.redirect(back);
    }
    const { engine } = require('./harness');
    const inputs = { item: item.id };
    const email = String((req.body && req.body.email) || '').trim();
    const phone = String((req.body && req.body.phone) || '').trim();
    if (email) inputs.email = email;
    if (phone) inputs.phone = phone;
    try {
      const run = await engine.start(req.user, 'store.make_it_mine', inputs, { source: 'hq' });
      track(req, 'Store Make It Mine', { item: item.id });
      res.redirect(`/app/hq/runs/${run.id}`);
    } catch (err) {
      if (!err || !err.status) throw err;
      flash(req, 'error', err.message);
      res.redirect(back);
    }
  }));

  return r;
}

module.exports = storeRoutes;
module.exports.cardOf = cardOf;
