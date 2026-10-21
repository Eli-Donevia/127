// HQ in Microsoft Teams (teams.js, HQ_TEAMS). Two routers, both from server.js:
//
//   app.use(teamsRoutes.hooks());                       next to Slack's, before the body parsers
//     POST /teams/messages    every activity from Teams (Bot Framework): link <code> | oks | pulse, a tap on an
//                             OK card, @mentions in a channel, install and uninstall. Token checked first.
//   app.use(teamsRoutes.pages({ requireAuth, flash }));
//     GET  /app/hq/teams                 open the app in Teams, link with a one-time code, cards on or off, remove
//     POST /app/hq/teams/code | /cards | /disconnect

const express = require('express');
const teams = require('./teams');
const hq = require('../hq');
const security = require('../security');
const { scrubKeys } = require('./text');

// hq-slack.css's numbered steps fit Teams as they are.
const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-apps.css', '/css/hq-posts.css', '/css/hq-slack.css'];
const json = express.json({ type: () => true, limit: '200kb' });

function hooks() {
  const r = express.Router();
  // No token, no work: not even the body is read without a Bearer header.
  const bearer = (req, res, next) => (teams.flag() === 'off' || !/^Bearer\s/.test(String(req.headers.authorization || '')) ? res.status(401).send('') : next());
  const parsed = (err, req, res, next) => (err ? res.status(400).send('') : next());
  r.post('/teams/messages', bearer, json, parsed, async (req, res) => {
    if (!(await teams.verify(req.headers.authorization, req.body))) return res.status(401).send('');
    let out;
    try {
      out = await teams.handle(req.body);
    } catch (err) {
      console.warn('[teams] activity', scrubKeys(String(err.message)));
      out = { status: 200 };
    }
    if (out.body) return res.status(out.status || 200).json(out.body);
    res.status(out.status || 200).send('');
  });
  return r;
}

function pages({ requireAuth, flash }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const on = (req, res, next) => (hq.liveFor(req.user) && teams.on(req.user) ? next() : next('router'));
  const B = [requireAuth, on];
  const { wsFor } = require('./connectors/routes');
  const show = (req, res, code = null) => {
    res.set('Cache-Control', 'no-store');
    res.render('app/hq-teams', { title: 'Teams', css: CSS, s: teams.status(req.user), code, ...wsFor(req.user, 'connections', CSS) });
  };

  r.get('/app/hq/teams', ...B, (req, res) => show(req, res));
  r.post('/app/hq/teams/code', ...B, wrap(async (req, res) => {
    if (!security.allow(`teams-code:${req.user.id}`, 10, 60 * 60 * 1000)) {
      flash(req, 'info', 'Too many codes in a short time. Wait a few minutes.');
      return res.redirect('/app/hq/teams');
    }
    show(req, res, await teams.newCode(req.user));
  }));
  r.post('/app/hq/teams/cards', ...B, wrap(async (req, res) => {
    await teams.setCards(req.user, req.body.cards === 'on');
    res.redirect('/app/hq/teams');
  }));
  r.post('/app/hq/teams/disconnect', ...B, wrap(async (req, res) => {
    if (await teams.disconnect(req.user)) flash(req, 'win', 'Removed. HQ deleted what it kept for your Teams. To take HQ out of Teams too, uninstall it there.');
    res.redirect('/app/hq/teams');
  }));
  return r;
}

module.exports = { hooks, pages };
