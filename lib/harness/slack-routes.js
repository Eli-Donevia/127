// HQ in Slack (slack.js, HQ_SLACK). Two routers, both from server.js:
//
//   app.use(slackRoutes.hooks());                       before the body parsers (Slack signs the raw body)
//     POST /slack/commands    /127 link <code> | oks | pulse
//     POST /slack/actions     a tap on an OK card
//     POST /slack/events      the URL check, and app_uninstalled / tokens_revoked
//   app.use(slackRoutes.pages({ requireAuth, flash }));
//     GET  /app/hq/slack                 add the app, link with a one-time code, cards on or off, remove
//     POST /app/hq/slack/install         off to Slack;  GET /app/hq/slack/callback  back
//     POST /app/hq/slack/code | /cards | /disconnect

const express = require('express');
const slack = require('./slack');
const hq = require('../hq');
const security = require('../security');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-apps.css', '/css/hq-posts.css', '/css/hq-slack.css'];
const raw = express.raw({ type: () => true, limit: '200kb' });
const deps = { fetch: (...a) => fetch(...a) };

// Slack answers a tap through the response_url it sent; only Slack's own host is called.
async function respond(url, body) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' || u.hostname !== 'hooks.slack.com') return;
    await deps.fetch(u.toString(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), redirect: 'error' });
  } catch {
    /* the tap is recorded in HQ either way */
  }
}

function hooks() {
  const r = express.Router();
  const signed = (req, res, next) => {
    if (slack.flag() === 'off' || !slack.verify(req.body, req.headers)) return res.status(401).send('');
    next();
  };
  const form = (req) => Object.fromEntries(new URLSearchParams(req.body.toString('utf8')));
  r.post('/slack/commands', raw, signed, async (req, res) => {
    try {
      res.json({ response_type: 'ephemeral', text: await slack.command(form(req)) });
    } catch (err) {
      res.json({ response_type: 'ephemeral', text: `HQ couldn't do that: ${err.message}` });
    }
  });
  r.post('/slack/actions', raw, signed, async (req, res) => {
    let payload;
    try {
      payload = JSON.parse(form(req).payload || '{}');
    } catch {
      return res.status(400).send('');
    }
    res.status(200).send('');
    const out = await slack.action(payload).catch((err) => ({ ephemeral: `HQ couldn't take that: ${err.message}` }));
    if (!out) return;
    if (out.ephemeral) await respond(payload.response_url, { response_type: 'ephemeral', replace_original: false, text: out.ephemeral });
    else await respond(payload.response_url, { replace_original: true, text: 'Answered', blocks: out.replace });
  });
  r.post('/slack/events', raw, signed, async (req, res) => {
    let body;
    try {
      body = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).send('');
    }
    res.json(await slack.events(body));
  });
  return r;
}

function pages({ requireAuth, flash }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const on = (req, res, next) => (hq.liveFor(req.user) && slack.on(req.user) ? next() : next('router'));
  const B = [requireAuth, on];
  const { wsFor } = require('./connectors/routes');
  const show = (req, res, code = null) => {
    res.set('Cache-Control', 'no-store');
    res.render('app/hq-slack', { title: 'Slack', css: CSS, s: slack.status(req.user), code, ...wsFor(req.user, 'connections', CSS) });
  };

  r.get('/app/hq/slack', ...B, (req, res) => show(req, res));
  r.post('/app/hq/slack/install', ...B, (req, res) => {
    const go = slack.installUrl(req.user, res.locals.baseUrl);
    if (!go) {
      flash(req, 'info', "HQ's Slack app isn't set up on this server yet.");
      return res.redirect('/app/hq/slack');
    }
    req.session.slackPending = go.pending;
    res.redirect(go.url);
  });
  r.get('/app/hq/slack/callback', ...B, wrap(async (req, res) => {
    const pending = req.session.slackPending;
    delete req.session.slackPending;
    const out = await slack.finishInstall(req.user, pending, req.query, res.locals.baseUrl);
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'win', 'Added to Slack. Now link your Slack account below.');
    res.redirect('/app/hq/slack');
  }));
  r.post('/app/hq/slack/code', ...B, wrap(async (req, res) => {
    if (!security.allow(`slack-code:${req.user.id}`, 10, 60 * 60 * 1000)) {
      flash(req, 'info', 'Too many codes in a short time. Wait a few minutes.');
      return res.redirect('/app/hq/slack');
    }
    show(req, res, await slack.newCode(req.user));
  }));
  r.post('/app/hq/slack/cards', ...B, wrap(async (req, res) => {
    await slack.setCards(req.user, req.body.cards === 'on');
    res.redirect('/app/hq/slack');
  }));
  r.post('/app/hq/slack/disconnect', ...B, wrap(async (req, res) => {
    if (await slack.disconnect(req.user)) flash(req, 'win', 'Removed. HQ deleted what it kept for your Slack.');
    res.redirect('/app/hq/slack');
  }));
  return r;
}

module.exports = { hooks, pages, respond, _setDeps: (o) => Object.assign(deps, o) };
