// Site chat's pages (lib/harness/site-chat.js, HQ_SITE_AGENT). Mounted by lib/harness/routes.js.
//
// The member's page in HQ: /app/hq/site-chat (details visitors get answers from, on and off, the code, chats).
// /site-chat (S8: what 127 does for the business, linked from "Run by 127"). publicRouter(), for visitors:
// /site-chat/c/:key (the chat itself, framed only by the member's site) and its two posts.

const express = require('express');
const siteChat = require('./site-chat');
const flags = require('./flags');
const security = require('../security');

function mount(r, { A, wrap, flash, page }) {
  const SC = [...A, (req, res, next) => (flags.on('HQ_SITE_AGENT', req.user) ? next() : next('router'))];
  const base = (req) => String(process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const back = (req, res, err, to = '/app/hq/site-chat') => {
    if (!err || !err.status) throw err;
    flash(req, 'error', err.message);
    res.redirect(to);
  };

  // ---------- the member's page ----------
  r.get('/app/hq/site-chat', ...SC, (req, res) => {
    const s = siteChat.settingsOf(req.user.id);
    const snippet = s.key ? `<script src="${base(req)}/js/site-chat-embed.js" data-chat="${s.key}" async></script>` : '';
    page(res, 'site-chat', 'Site chat', { s, d: s.details || {}, need: siteChat.missing(s), snippet, chats: siteChat.list(req.user), counts: siteChat.counts(req.user), lines: siteChat.LINES, cost: siteChat.cost(), brainOn: flags.on('BRAIN_DOCS', req.user) });
  });

  r.post('/app/hq/site-chat/details', ...SC, wrap(async (req, res) => {
    const b = req.body || {};
    try {
      const s = await siteChat.saveDetails(req.user, { name: b.name, hours: b.hours, area: b.area, services: b.services, prices: b.prices, site: b.site, privacy: b.privacy });
      flash(req, 'win', s.on || !siteChat.missing(s).length ? 'Saved. Your chat answers from these now.' : 'Saved.');
    } catch (err) {
      return back(req, res, err, '/app/hq/site-chat#details');
    }
    res.redirect('/app/hq/site-chat#details');
  }));

  r.post('/app/hq/site-chat/on', ...SC, wrap(async (req, res) => {
    const b = req.body || {};
    try {
      await siteChat.turnOn(req.user, { covered: b.covered === 'on', notForKids: b.kids === 'on' });
      flash(req, 'win', 'Site chat is on. Add the code below to your site.');
    } catch (err) {
      return back(req, res, err, '/app/hq/site-chat#on');
    }
    res.redirect('/app/hq/site-chat#on');
  }));

  r.post('/app/hq/site-chat/off', ...SC, wrap(async (req, res) => {
    await siteChat.turnOff(req.user);
    flash(req, 'win', 'Site chat is off. Visitors see nothing until you turn it back on.');
    res.redirect('/app/hq/site-chat#on');
  }));

  r.post('/app/hq/site-chat/key', ...SC, wrap(async (req, res) => {
    await siteChat.newKey(req.user);
    flash(req, 'win', 'New code made. The old one stops working, so put this one on your site.');
    res.redirect('/app/hq/site-chat#on');
  }));

  r.get('/app/hq/site-chat/chats/:id', ...SC, (req, res, next) => {
    const c = siteChat.get(req.user, req.params.id);
    if (!c) return next();
    page(res, 'site-chat-one', 'Site chat', { c, keepDays: siteChat.KEEP_DAYS });
  });

  r.post('/app/hq/site-chat/chats/:id/delete', ...SC, wrap(async (req, res) => {
    const ok = await siteChat.remove(req.user, req.params.id);
    flash(req, ok ? 'win' : 'info', ok ? 'Chat deleted.' : 'That chat was already gone.');
    res.redirect('/app/hq/site-chat#chats');
  }));

  // ---------- public: what 127 does for the business (S8) ----------
  r.get('/site-chat', (req, res, next) => {
    if (flags.value('HQ_SITE_AGENT') === 'off') return next();
    res.render('site-chat-about', { title: 'Site chat, run by 127' });
  });
}

// The chat itself and its two posts, for visitors. server.js mounts this before the session, so a visitor
// never gets a 127 cookie (Legal W7: nothing of 127's follows visitors to members' sites).
function publicRouter() {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const publicHeaders = (res, origins) => {
    res.removeHeader('X-Frame-Options');
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors ${origins.join(' ')}`);
  };
  // Posts come from the chat's own page (same origin); anything else is refused.
  const sameOrigin = (req) => {
    const o = req.get('origin');
    if (!o) return req.get('sec-fetch-site') ? req.get('sec-fetch-site') === 'same-origin' : true;
    try {
      return new URL(o).host === req.get('host');
    } catch {
      return false;
    }
  };
  // S9: a public box on the internet. Per visitor address, and per member across all their visitors.
  const limited = (req, res, found) => {
    const ip = security.ip(req);
    if (security.allow(`sitechat-ip:${ip}`, 20, 10 * 60 * 1000) && security.allow(`sitechat-member:${found.owner.id}`, 600, 60 * 60 * 1000)) return false;
    res.status(429).json({ error: 'Too many messages in a short time. Wait a few minutes and try again.' });
    return true;
  };

  r.get('/site-chat/c/:key', (req, res, next) => {
    const found = siteChat.byKey(req.params.key);
    if (!found) return next();
    const d = found.settings.details;
    publicHeaders(res, siteChat.frameOrigins(found.settings));
    res.render('site-chat-frame', { key: found.settings.key, business: d.name, privacy: d.privacy, page: siteChat.pageOf(req.query.page), lines: siteChat.LINES });
  });

  r.post('/site-chat/c/:key/say', wrap(async (req, res) => {
    const found = siteChat.byKey(req.params.key);
    if (!found || !sameOrigin(req)) return res.status(404).json({ error: "This chat isn't available right now." });
    if (limited(req, res, found)) return;
    const b = req.body || {};
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await siteChat.say(req.params.key, { chatId: b.chat, text: b.text, page: b.page }));
    } catch (err) {
      if (!err.status) throw err;
      res.status(err.status).json({ error: err.message });
    }
  }));

  r.post('/site-chat/c/:key/contact', wrap(async (req, res) => {
    const found = siteChat.byKey(req.params.key);
    if (!found || !sameOrigin(req)) return res.status(404).json({ error: "This chat isn't available right now." });
    if (limited(req, res, found)) return;
    const b = req.body || {};
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await siteChat.leaveContact(req.params.key, { chatId: b.chat, name: b.name, email: b.email, phone: b.phone, note: b.note }));
    } catch (err) {
      if (!err.status) throw err;
      res.status(err.status).json({ error: err.message });
    }
  }));
  return r;
}

module.exports = { mount, publicRouter };
