// Connections pages (BUILD-PLAN W1). Mounted in server.js before HQ v1's routes:
//
//   app.use(connectorRoutes({ requireAuth, flash }));
//
// The gallery itself is on HQ v1's /app/hq/connect (hq-routes.js passes it to the view). Here:
//   GET  /app/hq/apps/:id               one connector: what it reads and writes, how to connect, its log
//   POST /app/hq/apps/:id/connect       a pasted key or token
//   POST /app/hq/apps/:id/start         "Sign in with": off to the provider
//   GET  /app/hq/connect/:provider/callback   back from the provider
//   POST /app/hq/apps/:id/disconnect
// With CONNECTORS off for the member every route falls through to the 404.
//
// Dashboards (dashboards.js, DASHBOARDS):
//   GET  /app/hq/boards[/:id]   a board (the first, or a picker of templates when there are none)
//   POST /app/hq/boards         a new board from a template
//   POST /app/hq/boards/:id/tiles, /tiles/:tid/delete, /tiles/:tid/size, /order (JSON from the drag), /rename, /delete

const express = require('express');
const connectors = require('./index');
const dashboards = require('./dashboards');
const hq = require('../../hq');
const ageCheck = require('../../age-check');
const security = require('../../security');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-apps.css'];

// With HQ_WORKSPACE on (lib/harness/nav.js), Connections, connector pages and Dashboards sit in the workspace
// like every HQ v2 page: its rail and phone bar, and the Talk bar. Off, or without HQ v2, the old layout.
// Returns the locals those views need ({ ws, tab, inboxCount, usage, flags, css }) or {}.
function wsFor(user, tab, css = CSS) {
  try {
    const nav = require('../nav');
    const harness = require('../index');
    if (!nav.on() || !user || !harness.enabledFor(user)) return {};
    const inboxCount = harness.inbox.count(user.id), flags = harness.flags.forUser(user);
    return { ws: nav.workspace(user, { tab, inboxCount, flags }), tab, inboxCount, usage: harness.ledger.usage(user), flags, css: [].concat(css, '/css/hq2-ws.css') };
  } catch {
    return {};
  }
}
const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';

function privatePage(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
}

function connectorRoutes({ requireAuth, flash }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const on = (req, res, next) => (hq.liveFor(req.user) && connectors.on(req.user) ? next() : next('router'));
  const adult = (req, res, next) => {
    if (!ageCheck.underReview(req.user)) return next();
    flash(req, 'info', ageCheck.PAUSE_MESSAGE);
    res.redirect('/app/hq/connect');
  };
  const B = [requireAuth, on];
  const allow = (req, key, max, windowMs) => {
    if (security.allow(key, max, windowMs)) return true;
    flash(req, 'info', TOO_FAST);
    return false;
  };
  const id = (req) => String(req.params.id || '').replace(/[^a-z0-9_]/g, '').slice(0, 40);

  r.get('/app/hq/apps/:id', ...B, (req, res, next) => {
    const d = connectors.detail(req.user, id(req));
    if (!d) return next('router');
    privatePage(res);
    res.render('app/hq-app', { title: `${d.name} · Connections`, css: CSS, d, ...wsFor(req.user, 'apps') });
  });

  r.post('/app/hq/apps/:id/connect', ...B, adult, wrap(async (req, res) => {
    const app = id(req);
    if (!allow(req, `hq-app:${req.user.id}`, 20, 60 * 60 * 1000)) return res.redirect(`/app/hq/apps/${app}`);
    const out = await connectors.connectKey(req.user, app, req.body || {});
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'win', `Connected${out.label ? ` to ${out.label}` : ''}.`);
    res.redirect(`/app/hq/apps/${app}`);
  }));

  r.post('/app/hq/apps/:id/start', ...B, adult, (req, res) => {
    const app = id(req);
    if (!allow(req, `hq-oauth:${req.user.id}`, 20, 60 * 60 * 1000)) return res.redirect(`/app/hq/apps/${app}`);
    const go = connectors.startOauth(req.user, app, res.locals.baseUrl);
    if (!go) {
      flash(req, 'error', "That sign-in isn't open yet.");
      return res.redirect(`/app/hq/apps/${app}`);
    }
    req.session.hqOauth = go.pending;
    res.redirect(303, go.url);
  });

  r.get('/app/hq/connect/:provider/callback', ...B, wrap(async (req, res) => {
    privatePage(res);
    const provider = String(req.params.provider || '').replace(/[^a-z0-9_]/g, '');
    const pending = req.session && req.session.hqOauth;
    if (req.session) delete req.session.hqOauth;
    if (!connectors.oauth.known(provider)) return res.redirect('/app/hq/connect');
    const out = await connectors.finishOauth(req.user, pending, provider, { code: req.query.code, state: req.query.state, error: req.query.error }, res.locals.baseUrl);
    if (out.error) {
      flash(req, 'error', out.error);
      return res.redirect(pending && pending.app ? `/app/hq/apps/${pending.app}` : '/app/hq/connect');
    }
    flash(req, 'win', `${out.name} connected.`);
    res.redirect(`/app/hq/apps/${out.app}`);
  }));

  r.post('/app/hq/apps/:id/disconnect', ...B, wrap(async (req, res) => {
    const app = id(req);
    const out = await connectors.disconnect(req.user, app);
    if (out) flash(req, 'win', out.revoked ? 'Disconnected. 127 removed its access there and deleted its copy.' : 'Disconnected. 127 deleted its copy. Remove 127 in that app too.');
    res.redirect(`/app/hq/apps/${app}`);
  }));

  // ---------- dashboards ----------

  const dOn = (req, res, next) => (hq.liveFor(req.user) && dashboards.on(req.user) ? next() : next('router'));
  const D = [requireAuth, dOn];
  const own = (req, res, next) => {
    req.board = dashboards.board(req.user, req.params.id);
    if (!req.board) return next('router');
    next();
  };
  const back = (b) => `/app/hq/boards/${b.id}`;

  const showBoard = wrap(async (req, res) => {
    privatePage(res);
    const list = dashboards.boards(req.user);
    const b = req.params.id ? dashboards.board(req.user, req.params.id) : list[0];
    if (req.params.id && !b) return res.redirect('/app/hq/boards');
    res.render('app/hq-boards', {
      title: b ? `${b.name} · Dashboards` : 'Dashboards', css: CSS,
      boards: list.map((x) => ({ id: x.id, name: x.name })), board: b ? await dashboards.view(req.user, b) : null,
      choices: dashboards.choices(req.user), templates: Object.entries(dashboards.TEMPLATES).map(([id, t]) => ({ id, name: t.name })),
      RANGES: dashboards.RANGES, max: dashboards.MAX_BOARDS, ...wsFor(req.user, 'boards'),
    });
  });
  r.get('/app/hq/boards', ...D, showBoard);
  r.get('/app/hq/boards/:id', ...D, showBoard);

  r.post('/app/hq/boards', ...D, wrap(async (req, res) => {
    const out = await dashboards.create(req.user, { name: req.body.name, template: String(req.body.template || '') });
    if (out.error) {
      flash(req, 'error', out.error);
      return res.redirect('/app/hq/boards');
    }
    res.redirect(back(out.board));
  }));
  r.post('/app/hq/boards/:id/tiles', ...D, own, wrap(async (req, res) => {
    const out = await dashboards.addTile(req.user, req.board, req.body || {});
    if (out.error) flash(req, 'error', out.error);
    res.redirect(back(req.board));
  }));
  r.post('/app/hq/boards/:id/tiles/:tid/delete', ...D, own, wrap(async (req, res) => {
    await dashboards.removeTile(req.board, String(req.params.tid));
    if (req.accepts(['html', 'json']) === 'json') return res.json({ ok: true });
    res.redirect(back(req.board));
  }));
  r.post('/app/hq/boards/:id/tiles/:tid/size', ...D, own, express.json({ limit: '2kb' }), wrap(async (req, res) => {
    const ok = await dashboards.resize(req.board, String(req.params.tid), req.body.size);
    if (req.accepts(['html', 'json']) === 'json') return res.status(ok ? 200 : 400).json({ ok });
    res.redirect(back(req.board));
  }));
  r.post('/app/hq/boards/:id/order', ...D, own, express.json({ limit: '8kb' }), wrap(async (req, res) => {
    const ok = await dashboards.reorder(req.board, req.body && req.body.order);
    res.status(ok ? 200 : 400).json({ ok });
  }));
  r.post('/app/hq/boards/:id/rename', ...D, own, wrap(async (req, res) => {
    await dashboards.rename(req.board, req.body.name);
    res.redirect(back(req.board));
  }));
  r.post('/app/hq/boards/:id/delete', ...D, own, wrap(async (req, res) => {
    await dashboards.remove(req.user, req.board);
    flash(req, 'win', 'Dashboard deleted.');
    res.redirect('/app/hq/boards');
  }));

  return r;
}

module.exports = connectorRoutes;
module.exports.wsFor = wsFor;
