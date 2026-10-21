// Life in HQ (lib/life), behind HQ_LIFE. Mounted in server.js next to the Store:
//
//   app.use(lifeRoutes({ requireAuth }));
//
//   GET /app/hq/life       the shelf: every module, held ones marked "on the way" for members
//   GET /app/hq/life/:id   a module: its page script keeps the member's entries in their own browser
//
// There is nothing to POST: 127 stores none of what a member types here. Off for the member (HQ_LIFE off for them,
// or HQ v2 off for them), every route falls through to the 404. A held module (lib/life `held`) opens for members only
// once its id is in LIFE_CLEARED; admins get it as a preview. A module above the member's plan opens with its example
// filled in and keeps nothing.

const express = require('express');
const life = require('./life');
const { canAccess } = require('./plans');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-life.css'];

function lifeRoutes({ requireAuth }) {
  const r = express.Router();
  const harness = () => require('./harness');
  const enabledFor = (user) => !!user && harness().flags.on('HQ_LIFE', user) && harness().enabledFor(user);
  const on = (req, res, next) => {
    if (harness().flags.value('HQ_LIFE') === 'off') return next('router');
    if (!req.user) return requireAuth(req, res, next);
    return enabledFor(req.user) ? next() : next('router');
  };
  const admin = (user) => harness().flags.admin(user);
  const canUse = (user, m) => canAccess({ tier: require('./store').tierOf(user) }, m.tier);
  // Open: cleared for members, or a preview for an admin.
  const opens = (user, m) => life.isClear(m) || admin(user);
  const page = (req, res, view, title, locals) => {
    const h = harness(), nav = require('./harness/nav');
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const inboxCount = h.inbox.count(req.user.id), flags = h.flags.forUser(req.user);
    const ws = nav.on() ? nav.workspace(req.user, { tab: 'life', inboxCount, flags }) : null;
    const css = ws ? CSS.concat('/css/hq2-ws.css', ws.premium ? ['/css/hq-premium.css'] : []) : CSS;
    res.render(`app/hq2/${view}`, { title, css, tab: view, inboxCount, usage: h.ledger.usage(req.user), flags, ws, ...locals });
  };

  r.get('/app/hq/life', on, (req, res) => {
    const shelf = life.list().map((m) => ({ id: m.id, title: m.title, line: m.line, art: m.art, open: opens(req.user, m), preview: m.held && !life.isClear(m), plan: canUse(req.user, m) }));
    page(req, res, 'life', 'Life', { shelf, scope: life.scope(req.user.id) });
  });

  r.get('/app/hq/life/:id', on, (req, res, next) => {
    const m = life.get(String(req.params.id || ''));
    if (!m) return next();
    const open = opens(req.user, m);
    const plan = canUse(req.user, m);
    page(req, res, 'life-module', m.title, {
      mod: { id: m.id, title: m.title, line: m.line },
      open,
      preview: open && m.held && !life.isClear(m),
      plan,
      bring: life.BRING[m.id] || [],
      prompt: life.PROMPTS[m.id] || '',
      // What the page script needs. `keep` false: draw the example and write nothing to the device.
      state: open ? { scope: life.scope(req.user.id), keep: plan, foods: m.id === 'food' ? life.starterFoods() : undefined, bible: m.id === 'faith' ? life.bible() : undefined } : null,
      others: life.list().filter((o) => o.id !== m.id && opens(req.user, o)).map((o) => ({ id: o.id, title: o.title })),
    });
  });

  return r;
}

module.exports = lifeRoutes;
