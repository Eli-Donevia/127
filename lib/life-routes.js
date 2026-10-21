// Life in HQ (lib/life), behind HQ_LIFE. Mounted in server.js next to the Store:
//
//   app.use(lifeRoutes({ requireAuth }));
//
//   GET /app/hq/life   every Life tool on one page; the address's #fragment picks the one to show in the browser
//
// One address (Legal L87 LV2): the server, its logs and any analytics never learn which tool a member opened, so
// there is no /app/hq/life/:id. Every tool the member can open ships on the page, hidden until picked. There is
// nothing to POST: 127 stores none of what a member types here. No outside scripts (LV3): the page drops analytics and
// ad pixels and sends a Content-Security-Policy that only allows 127's own scripts and connections.
//
// Off for the member (HQ_LIFE off for them, or HQ v2 off for them), the route falls through to the 404. A held module
// (lib/life `held`) opens for members only once its id is in LIFE_CLEARED; admins get it as a preview. The food log and
// daily check-in stay closed for an account the age check flags (LV4). A module above the member's plan opens with
// its example, or empty, and keeps nothing.

const express = require('express');
const life = require('./life');
const { canAccess } = require('./plans');
const ageCheck = require('./age-check');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-life.css'];
// Only 127's own files: no pixel, analytics, replay or chat widget can load or send from a Life page.
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'";

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
  const ageHeld = (user, m) => life.AGE_HELD.includes(m.id) && ageCheck.underReview(user);
  // Open: cleared for members, or a preview for an admin; never a food log or check-in on an account under age review.
  const opens = (user, m) => !ageHeld(user, m) && (life.isClear(m) || admin(user));
  const page = (req, res, view, title, locals) => {
    const h = harness(), nav = require('./harness/nav');
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Content-Security-Policy', CSP);
    Object.assign(res.locals, { plausible: null, trackEvents: [], adConsentScript: '' });
    const inboxCount = h.inbox.count(req.user.id), flags = h.flags.forUser(req.user);
    const ws = nav.on() ? nav.workspace(req.user, { tab: 'life', inboxCount, flags }) : null;
    const css = ws ? CSS.concat('/css/hq2-ws.css', ws.premium ? ['/css/hq-premium.css'] : []) : CSS;
    res.render(`app/hq2/${view}`, { title, css, tab: view, inboxCount, usage: h.ledger.usage(req.user), flags, ws, ...locals });
  };

  r.get('/app/hq/life', on, (req, res) => {
    const user = req.user, scope = life.scope(user.id);
    const shelf = life.list().map((m) => ({ id: m.id, title: m.title, line: m.line, art: m.art, open: opens(user, m), paused: ageHeld(user, m), preview: m.held && !life.isClear(m), plan: canUse(user, m) }));
    const views = life.list().filter((m) => opens(user, m)).map((m) => {
      const plan = canUse(user, m);
      return {
        id: m.id, title: m.title, line: m.line, plan,
        preview: m.held && !life.isClear(m),
        bring: life.BRING[m.id] || [],
        prompt: life.PROMPTS[m.id] || '',
        // What the tool's script needs. `keep` false: draw the example (or nothing) and write nothing to the device.
        state: { scope, keep: plan, foods: m.id === 'food' ? life.starterFoods() : undefined, bible: m.id === 'faith' ? life.bible() : undefined },
      };
    });
    page(req, res, 'life', 'Life', { shelf, views, scope, lines: life.LINES });
  });

  return r;
}

module.exports = lifeRoutes;
