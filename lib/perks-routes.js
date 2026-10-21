// Perks and grants in HQ (lib/perks), behind HQ_PERKS. Mounted in server.js next to Life:
//
//   app.use(perksRoutes({ requireAuth }));
//
//   GET /app/hq/perks   every program by shelf, the deadlines in the next 60 days, the member's own list
//
// There is nothing to POST: a member's saved list and statuses stay in their own browser (public/js/perks.js). Off for
// the member (HQ_PERKS off for them, or HQ v2 off for them), the route falls through to the 404. Every plan sees the
// whole page: it's the same public information, read for them.

const express = require('express');
const perks = require('./perks');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-perks.css'];

function perksRoutes({ requireAuth }) {
  const r = express.Router();
  const harness = () => require('./harness');
  const enabledFor = (user) => !!user && harness().flags.on('HQ_PERKS', user) && harness().enabledFor(user);
  const on = (req, res, next) => {
    if (harness().flags.value('HQ_PERKS') === 'off') return next('router');
    if (!req.user) return requireAuth(req, res, next);
    return enabledFor(req.user) ? next() : next('router');
  };

  r.get('/app/hq/perks', on, (req, res) => {
    const h = harness(), nav = require('./harness/nav');
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const inboxCount = h.inbox.count(req.user.id), flags = h.flags.forUser(req.user);
    const ws = nav.on() ? nav.workspace(req.user, { tab: 'perks', inboxCount, flags }) : null;
    const css = ws ? CSS.concat('/css/hq2-ws.css', ws.premium ? ['/css/hq-premium.css'] : []) : CSS;
    const now = new Date();
    res.render('app/hq2/perks', {
      title: 'Perks and grants', css, tab: 'perks', inboxCount, usage: h.ledger.usage(req.user), flags, ws,
      shelves: perks.shelves(now), soon: perks.soon(now), fits: perks.FITS, sba: perks.SBA_LINE,
      count: perks.PROGRAMS.length, checked: perks.CHECKED, admin: h.flags.admin(req.user), scope: perks.scope(req.user.id),
      today: now.toISOString().slice(0, 10),
    });
  });

  return r;
}

module.exports = perksRoutes;
