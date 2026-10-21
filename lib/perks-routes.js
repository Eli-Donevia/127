// Perks and grants (lib/perks), behind HQ_PERKS in HQ and PERKS_PUBLIC on the open site. Mounted in server.js:
//
//   app.use(perksRoutes({ requireAuth }));
//
//   GET  /app/hq/perks                      every program by shelf, the next 60 days of deadlines, Might fit, the
//                                           member's own list (kept in their browser)
//   GET  /app/hq/perks/:id/draft            the application drafter for a program with a written application
//   POST /app/hq/perks/:id/draft            write one draft (credits shown first, Legal L100 PD5)
//   POST /app/hq/perks/drafts/:did/delete   delete one draft
//   GET  /perks                             the open page: the same rows and lines, no saving, matching or drafter
//
// Off for the member (HQ_PERKS off for them, or HQ v2 off for them), the HQ routes fall through to the 404; with
// PERKS_PUBLIC off (or "admins" and not an admin), /perks does too. Every plan sees the HQ page.

const express = require('express');
const perks = require('./perks');
const draft = require('./perks/draft');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-perks.css'];
const fmt = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function perksRoutes({ requireAuth }) {
  const r = express.Router();
  const harness = () => require('./harness');
  const enabledFor = (user) => !!user && harness().flags.on('HQ_PERKS', user) && harness().enabledFor(user);
  const on = (req, res, next) => {
    if (harness().flags.value('HQ_PERKS') === 'off') return next('router');
    if (!req.user) return requireAuth(req, res, next);
    return enabledFor(req.user) ? next() : next('router');
  };
  const admin = (user) => harness().flags.admin(user);
  const page = (req, res, view, title, locals) => {
    const h = harness(), nav = require('./harness/nav');
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const inboxCount = h.inbox.count(req.user.id), flags = h.flags.forUser(req.user);
    const ws = nav.on() ? nav.workspace(req.user, { tab: 'perks', inboxCount, flags }) : null;
    const css = ws ? CSS.concat('/css/hq2-ws.css', ws.premium ? ['/css/hq-premium.css'] : []) : CSS;
    res.render(`app/hq2/${view}`, { title, css, tab: 'perks', inboxCount, usage: h.ledger.usage(req.user), flags, ws, fmt, readLine: (p) => perks.readLine(p, fmt), ...locals });
  };

  r.get('/app/hq/perks', on, (req, res) => {
    const now = new Date(), isAdmin = admin(req.user);
    const shelves = perks.shelves(now, { admin: isAdmin });
    const rows = shelves.flatMap((s) => s.items);
    page(req, res, 'perks', 'Perks and grants', {
      shelves, soon: perks.soon(now), fits: perks.FITS, sba: perks.SBA_LINE, count: rows.length, sameDay: perks.readDates(rows),
      admin: isAdmin, scope: perks.scope(req.user.id), today: now.toISOString().slice(0, 10),
      might: perks.mightFit(require('./harness/brain').snapshot(req.user), rows), open: false,
    });
  });

  const program = (req, res, next) => {
    const p = perks.get(String(req.params.id || ''), new Date(), { admin: admin(req.user) });
    if (!p || !p.draft) return next('router');
    req.program = p;
    return next();
  };
  const draftPage = (req, res, { error = '', question = '', notes = '' } = {}) => {
    const p = req.program;
    const drafts = draft.mine(req.user.id, p.id).map((d) => ({ ...d, parts: draft.parts(d.text, d.source) }));
    if (error) res.status(400);
    page(req, res, 'perks-draft', `Draft for ${p.name}`, {
      p, drafts, cost: draft.credits(), left: harness().ledger.left(req.user), review: draft.REVIEW_LINE, error, question, notes,
      live: require('./harness/llm').live(),
    });
  };

  r.get('/app/hq/perks/:id/draft', on, program, (req, res) => draftPage(req, res));

  r.post('/app/hq/perks/:id/draft', on, program, async (req, res, next) => {
    // The member taps once per draft (PD5). Nothing is sent to the program (PD6).
    try {
      const d = await draft.write(req.user, req.program, { question: req.body.question, notes: req.body.notes });
      res.redirect(303, `/app/hq/perks/${req.program.id}/draft#d-${d.id}`);
    } catch (err) {
      if (err instanceof draft.DraftError) return draftPage(req, res, { error: err.message, question: String(req.body.question || ''), notes: String(req.body.notes || '') });
      return next(err);
    }
  });

  r.post('/app/hq/perks/drafts/:did/delete', on, async (req, res) => {
    const d = require('./db').get(draft.COL, String(req.params.did || ''));
    await draft.remove(req.user, req.params.did);
    res.redirect(303, d && d.memberId === req.user.id ? `/app/hq/perks/${d.program}/draft` : '/app/hq/perks');
  });

  // The open page (Legal L100 PP1-PP5): the same rows and lines and the official links for everyone. Signing up adds
  // saving, matching and the drafter, never the links. No countdowns and no totals.
  r.get('/perks', (req, res, next) => {
    const v = String(process.env.PERKS_PUBLIC || '').trim().toLowerCase();
    if (!(v === 'on' || (v === 'admins' && req.user && admin(req.user)))) return next('router');
    const now = new Date();
    const shelves = perks.shelves(now);
    const rows = shelves.flatMap((s) => s.items);
    res.render('perks', {
      title: 'Perks and grants for small businesses',
      description: 'Startup credits, software discounts, grants and free advisers, each read on an official page with who it is for and what it costs.',
      css: ['/css/hq-perks.css'], shelves, soon: perks.soon(now), sba: perks.SBA_LINE, count: rows.length, sameDay: perks.readDates(rows), fmt,
      readLine: (p) => perks.readLine(p, fmt), preview: v === 'admins',
    });
  });

  return r;
}

module.exports = perksRoutes;
