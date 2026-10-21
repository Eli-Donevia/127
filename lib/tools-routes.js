// Native HQ tools (lib/tools), behind HQ_TOOLS. Mounted in server.js next to the Store:
//
//   app.use(toolsRoutes({ requireAuth, flash, track }));
//
//   GET  /app/hq/tools                 the shelf: every tool, with the member's own headline number once they've used it
//   GET  /app/hq/tools/:id             a tool: its page script reads and saves the member's document
//   POST /app/hq/tools/:id/data        saves the document (JSON, the page saves as the member types)
//   POST /app/hq/tools/:id/clear       starts the tool over (deletes the document)
//   GET  /app/hq/tools/:id/export.csv  the member's own numbers as CSV
//   POST /app/hq/tools/quote/share     turns a quote's share link on (a new random token) or off
//   GET  /q/:token                     the shared quote, for the member's client: no login, noindex, no outside scripts
//
// Off for the member (HQ_TOOLS off for them, or HQ v2 off for them), every route falls through to the 404. A tool
// above the member's plan opens read-only and doesn't save.

const express = require('express');
const tools = require('./tools');
const security = require('./security');
const { canAccess } = require('./plans');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-tools.css'];
const TOO_FAST = 'Too many saves in a short time. Wait a minute and try again.';

function toolsRoutes({ requireAuth, flash = () => {}, track = () => {} }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const harness = () => require('./harness');
  const enabledFor = (user) => !!user && harness().flags.on('HQ_TOOLS', user) && harness().enabledFor(user);
  const on = (req, res, next) => {
    if (harness().flags.value('HQ_TOOLS') === 'off') return next('router');
    if (!req.user) return requireAuth(req, res, next);
    return enabledFor(req.user) ? next() : next('router');
  };
  const tierOf = (user) => require('./store').tierOf(user);
  const canUse = (user, t) => canAccess({ tier: tierOf(user) }, t.tier);
  const page = (req, res, view, title, locals) => {
    const h = harness(), nav = require('./harness/nav');
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const inboxCount = h.inbox.count(req.user.id), flags = h.flags.forUser(req.user);
    const ws = nav.on() ? nav.workspace(req.user, { tab: view === 'tool' ? 'tools' : view, inboxCount, flags }) : null;
    const css = ws ? CSS.concat('/css/hq2-ws.css', ws.premium ? ['/css/hq-premium.css'] : []) : CSS;
    res.render(`app/hq2/${view}`, { title, css, tab: view, inboxCount, usage: h.ledger.usage(req.user), flags, ws, ...locals });
  };
  // Tools Legal hasn't cleared yet (lib/tools CLEARED) show to admins only.
  const all = (user) => ({ all: harness().flags.admin(user) });
  const toolOf = (req) => tools.get(String(req.params.id || ''), all(req.user));

  r.get('/app/hq/tools', on, (req, res) => {
    const shelf = tools.list(all(req.user)).map((t) => ({ id: t.id, title: t.title, line: t.line, tier: t.tier, held: t.held, open: canUse(req.user, t), used: !!tools.load(req.user.id, t.id), data: tools.load(req.user.id, t.id) }));
    page(req, res, 'tools', 'Tools', { shelf });
  });

  r.get('/app/hq/tools/:id', on, (req, res, next) => {
    const t = toolOf(req);
    if (!t) return next();
    const open = canUse(req.user, t);
    // A device-only tool (Week builder, Legal L92 HT8) keeps its entries in the member's browser under their id; a
    // quiet tool (Week builder, Money overview: L92 MO3) loads no outside scripts, so no analytics or ad tags.
    const quiet = t.device || t.quiet ? { plausible: null, trackEvents: [], adConsentScript: '' } : {};
    page(req, res, 'tool', t.title, {
      ...quiet,
      tool: { id: t.id, title: t.title, line: t.line, tier: t.tier, device: !!t.device },
      open,
      state: { member: t.device || t.deviceKeys ? req.user.id : undefined, data: open && !t.device ? tools.load(req.user.id, t.id) : null, linked: open ? tools.linked(req.user.id) : {}, canSave: open, content: t.content ? t.content() : null, prompts: !!harness().flags.on('HQ_PROMPTS', req.user) },
      others: tools.list(all(req.user)).filter((o) => o.id !== t.id).map((o) => ({ id: o.id, title: o.title })),
    });
  });

  r.post('/app/hq/tools/:id/data', on, express.json({ limit: '64kb' }), wrap(async (req, res, next) => {
    const t = toolOf(req);
    if (!t || t.device) return next();
    if (!canUse(req.user, t)) return res.status(403).json({ error: 'This tool comes with Builder.' });
    if (!security.allow(`tool-save:${req.user.id}`, 240, 60 * 1000)) return res.status(429).json({ error: TOO_FAST });
    try {
      const data = await tools.save(req.user.id, t.id, req.body);
      res.json({ ok: true, data });
    } catch (e) {
      if (e.status === 413) return res.status(413).json({ error: 'That is more than one tool can hold. Remove a few rows and try again.' });
      throw e;
    }
  }));

  r.post('/app/hq/tools/:id/clear', on, wrap(async (req, res, next) => {
    const t = toolOf(req);
    if (!t || t.device) return next();
    await tools.clear(req.user.id, t.id);
    track(req, 'tool_clear', { tool: t.id });
    flash(req, 'info', `${t.title} is empty again.`);
    res.redirect(`/app/hq/tools/${t.id}`);
  }));

  // Legal L92 QL1-QL4. Sending the link is the member's own: 127 doesn't email it (that waits on ACT_CLEARED).
  r.post('/app/hq/tools/quote/share', on, express.json({ limit: '4kb' }), wrap(async (req, res, next) => {
    const t = tools.get('quote', all(req.user));
    if (!t) return next();
    if (!canUse(req.user, t)) return res.status(403).json({ error: 'This tool comes with Builder.' });
    if (!security.allow(`quote-share:${req.user.id}`, 30, 60 * 60 * 1000)) return res.status(429).json({ error: TOO_FAST });
    const out = await tools.share(req.user.id, String((req.body && req.body.id) || ''), !!(req.body && req.body.on));
    if (!out) return res.status(409).json({ error: 'That quote is still saving. Try again in a second.' });
    track(req, out.token ? 'quote_share_on' : 'quote_share_off', {});
    res.json({ ok: true, ...out });
  }));

  // The client's page. It renders on its own (no app layout), so nothing from outside loads on it.
  r.get('/q/:token', (req, res, next) => {
    if (harness().flags.value('HQ_TOOLS') === 'off' || !tools.get('quote')) return next();
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (!security.allow(`quote-view:${security.ip(req)}`, 120, 60 * 1000)) return res.status(429).type('text/plain').send('Too many tries. Wait a minute and try again.');
    const found = tools.shared(String(req.params.token || ''));
    res.status(found.quote ? 200 : found.expired ? 410 : 404).render('quote-share', { found, totals: found.totals || null });
  });

  r.get('/app/hq/tools/:id/export.csv', on, (req, res, next) => {
    const t = toolOf(req);
    if (!t || t.device || !canUse(req.user, t)) return next();
    res.set('Cache-Control', 'no-store');
    res.type('text/csv').attachment(`127-${t.id}.csv`).send(tools.csv(t.id, tools.load(req.user.id, t.id)));
  });

  return r;
}

module.exports = toolsRoutes;
