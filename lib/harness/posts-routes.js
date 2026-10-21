// The composer's pages (posts.js, HQ_POSTS). Mounted in server.js next to the Connections pages:
//
//   app.use(postRoutes({ requireAuth, flash }));
//
//   GET  /app/hq/post                     the week: what went out and what's waiting, and New post
//   POST /app/hq/post                     a new draft
//   GET  /app/hq/post/:id                 write it, pick places and a time, check each preview, OK
//   POST /app/hq/post/:id                 save what was written (any change takes back an OK)
//   POST /app/hq/post/:id/photo/:place    a JPEG cropped in the browser (raw body); /delete removes it
//   GET  /app/hq/post/:id/photo/:place    the member's own photo, for the preview
//   POST /app/hq/post/:id/captions        a version per place from the content helper
//   POST /app/hq/post/:id/ok | /cancel | /delete
//   GET  /p/m/:id/:place/:token           the photo link Instagram and Facebook fetch (no sign-in; the token is the key)

const express = require('express');
const posts = require('./posts');
const hq = require('../hq');
const ageCheck = require('../age-check');
const security = require('../security');
const { wsFor } = require('./connectors/routes');

const CSS = ['/css/hq.css', '/css/hq2.css', '/css/hq-apps.css', '/css/hq-posts.css'];
const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';

function privatePage(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
}

// The form's fields as posts.save takes them.
function bodyOf(b = {}) {
  const out = { text: b.text, ai: b.ai === 'on' ? true : b.ai_set ? false : undefined, paid: b.paid === 'on' ? true : b.ai_set ? false : undefined, places: {} };
  if (b.when_iso !== undefined) out.when = String(b.when_iso || '');
  for (const id of Object.keys(posts.PLACES)) {
    if (b[`${id}_set`] === undefined) continue;
    const [tid, ...name] = String(b[`${id}_target`] || '').split('|');
    out.places[id] = { on: b[`${id}_on`] === 'on', target: tid ? { id: tid, name: name.join('|') } : null, caption: b[`${id}_caption`] };
  }
  return out;
}

function postRoutes({ requireAuth, flash }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const on = (req, res, next) => (hq.liveFor(req.user) && posts.on(req.user) ? next() : next('router'));
  const adult = (req, res, next) => {
    if (!ageCheck.underReview(req.user)) return next();
    flash(req, 'info', ageCheck.PAUSE_MESSAGE);
    res.redirect('/app/hq/post');
  };
  const B = [requireAuth, on];
  const own = (req, res, next) => {
    req.post = posts.get(req.user, req.params.id);
    if (!req.post) return next('router');
    next();
  };
  const place = (req) => (posts.PLACES[req.params.place] ? req.params.place : null);
  const back = (p, hash = '') => `/app/hq/post/${p.id}${hash}`;
  const json = (req) => req.accepts(['html', 'json']) === 'json';
  const fail = (req, res, err, to) => {
    if (!(err instanceof posts.PostError) && !(err && err.status)) throw err;
    if (json(req)) return res.status(err.status || 400).json({ error: err.message });
    flash(req, 'error', err.message);
    res.redirect(to);
  };

  r.get('/app/hq/post', ...B, (req, res) => {
    privatePage(res);
    const all = posts.list(req.user).map((p) => posts.view(req.user, p));
    res.render('app/hq-posts', { title: 'Post', css: CSS, all, counts: posts.counts(req.user), ...wsFor(req.user, 'post', CSS) });
  });

  r.post('/app/hq/post', ...B, adult, wrap(async (req, res) => {
    try {
      const p = await posts.save(req.user, null, { text: req.body.text || '' });
      res.redirect(back(p));
    } catch (err) {
      fail(req, res, err, '/app/hq/post');
    }
  }));

  r.get('/app/hq/post/:id', ...B, own, wrap(async (req, res) => {
    privatePage(res);
    res.render('app/hq-post', { title: 'New post · Post', css: CSS, p: posts.view(req.user, req.post), places: await posts.places(req.user), ...wsFor(req.user, 'post', CSS) });
  }));

  r.post('/app/hq/post/:id', ...B, own, adult, wrap(async (req, res) => {
    try {
      await posts.save(req.user, req.post, bodyOf(req.body));
      res.redirect(back(req.post, req.body.next === 'review' ? '#review' : ''));
    } catch (err) {
      fail(req, res, err, back(req.post));
    }
  }));

  const jpeg = (req, res, next) => express.raw({ type: () => true, limit: 9 * 1024 * 1024 })(req, res, next);
  r.post('/app/hq/post/:id/photo/:place', ...B, own, adult, (req, res, next) => (security.allow(`post-photo:${req.user.id}`, 120, 60 * 60 * 1000) ? next() : res.status(429).json({ error: TOO_FAST })), jpeg, wrap(async (req, res) => {
    if (!place(req)) return res.status(404).json({ error: 'Pick where it goes.' });
    try {
      const m = await posts.setPhoto(req.user, req.post, place(req), req.body);
      res.json({ ok: true, media: m });
    } catch (err) {
      fail(req, res, err, back(req.post));
    }
  }));
  r.post('/app/hq/post/:id/photo/:place/delete', ...B, own, wrap(async (req, res) => {
    if (place(req)) await posts.dropPhoto(req.user, req.post, place(req));
    res.redirect(back(req.post));
  }));
  r.get('/app/hq/post/:id/photo/:place', ...B, own, wrap(async (req, res, next) => {
    const buf = place(req) && req.post.media[place(req)] ? await require('../db').getBlob(`post_${req.post.id}_${place(req)}`) : null;
    if (!buf) return next('router');
    privatePage(res);
    res.type('image/jpeg').send(buf);
  }));

  r.post('/app/hq/post/:id/captions', ...B, own, adult, wrap(async (req, res) => {
    if (!security.allow(`post-captions:${req.user.id}`, 30, 60 * 60 * 1000)) {
      flash(req, 'info', TOO_FAST);
      return res.redirect(back(req.post));
    }
    try {
      if (req.body.text !== undefined) await posts.save(req.user, req.post, bodyOf(req.body));
      const out = await posts.captions(req.user, req.post);
      flash(req, 'win', out.sample ? 'Sample captions (no AI key on this server).' : 'A version for each place. Change anything you like.');
      res.redirect(back(req.post, '#review'));
    } catch (err) {
      if (err instanceof posts.PostError) return fail(req, res, err, back(req.post));
      flash(req, 'error', err.message);
      res.redirect(back(req.post));
    }
  }));

  r.post('/app/hq/post/:id/ok', ...B, own, adult, wrap(async (req, res) => {
    try {
      const p = await posts.approve(req.user, req.post);
      flash(req, 'win', Date.parse(p.when) <= Date.now() + 60 * 1000 ? 'OK. It goes out in the next minute.' : 'OK. It goes out at its time. You can cancel it until then.');
      res.redirect('/app/hq/post');
    } catch (err) {
      fail(req, res, err, back(req.post, '#review'));
    }
  }));
  r.post('/app/hq/post/:id/cancel', ...B, own, wrap(async (req, res) => {
    try {
      await posts.cancel(req.user, req.post);
      flash(req, 'win', "Cancelled. It's a draft again.");
      res.redirect(back(req.post));
    } catch (err) {
      fail(req, res, err, back(req.post));
    }
  }));
  r.post('/app/hq/post/:id/delete', ...B, own, wrap(async (req, res) => {
    try {
      await posts.remove(req.user, req.post);
      flash(req, 'win', 'Deleted.');
      res.redirect('/app/hq/post');
    } catch (err) {
      fail(req, res, err, back(req.post));
    }
  }));

  // Instagram and Facebook fetch the photo from here. Nothing about the member is in the link or the reply.
  r.get('/p/m/:id/:place/:token', wrap(async (req, res, next) => {
    if (posts.flag() === 'off') return next('router');
    const buf = await posts.media(req.params.id, req.params.place, req.params.token);
    if (!buf) return next('router');
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.type('image/jpeg').send(buf);
  }));

  return r;
}

module.exports = postRoutes;
module.exports.bodyOf = bodyOf;
