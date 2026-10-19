// The Founding Five's pages (lib/founding-five.js): the application and the five's own page at
// /app/founding-five, its video parts and playback, the sessions calendar, and Eli's pick sheet at
// /admin/founding-five.

const express = require('express');
const ff = require('./founding-five');
const security = require('./security');

const HOUR = 60 * 60 * 1000;
const CSS = ['/css/founding-five.css'];
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const privatePage = (res) => res.set('Cache-Control', 'private, no-store');

// Plays a stored video in 4 MB parts, with byte ranges (Safari won't play a video without them).
async function stream(req, res, v) {
  const size = v.size;
  let from = 0;
  let to = size - 1;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.get('range') || '').trim());
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') from = Math.max(0, size - Number(m[2]));
    else {
      from = Number(m[1]);
      if (m[2] !== '') to = Math.min(Number(m[2]), size - 1);
    }
    if (from > to || from >= size) return res.status(416).set('Content-Range', `bytes */${size}`).end();
    res.status(206).set('Content-Range', `bytes ${from}-${to}/${size}`);
  }
  privatePage(res);
  res.set({ 'Content-Type': v.type, 'Accept-Ranges': 'bytes', 'Content-Length': String(to - from + 1), 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') return res.end();
  for await (const buf of ff.readRange(v, from, to)) {
    if (!res.write(buf)) await new Promise((r) => res.once('drain', r));
  }
  res.end();
}

// tell({ subject, text }): an email to Eli (the first ADMIN_EMAILS address).
function foundingFiveRoutes({ requireAuth, requireAdmin, isAdmin, flash, limit, TOO_FAST, stageDraft, track = () => {}, tell = null }) {
  const r = express.Router();
  const back = (res, hash) => res.redirect(`/app/founding-five${hash ? '#' + hash : ''}`);
  const render = (req, res, extra = {}, status = 200) => {
    privatePage(res);
    const v = ff.page(req.user, { admin: isAdmin(req.user) });
    res.status(status).render('app/founding-five', { title: 'The Founding Five', css: CSS, ff, v, joinUrl: v.mode === 'five' ? ff.joinUrl() : '', values: {}, errors: {}, ...extra });
  };

  r.get('/app/founding-five', requireAuth, (req, res) => render(req, res));

  r.post('/app/founding-five', requireAuth, wrap(async (req, res) => {
    if (!limit(req, res, `ff:${req.user.id}`, 20, HOUR, TOO_FAST)) return;
    const first = !(ff.mine(req.user.id) || {}).submittedAt;
    const out = await ff.apply(req.user, req.body, { admin: isAdmin(req.user) });
    if (out.under18) {
      flash(req, 'info', "The Founding Five is for founding members 18 or older, so your application ends here. 127 is for people 18 and older, so we'll take a look at your account and email you within 2 business days.");
      return res.redirect('/app');
    }
    if (out.errors) return render(req, res, { values: out.values || {}, errors: out.errors }, 400);
    if (first) track(req, 'Founding Five Applied', {});
    flash(req, 'win', first ? "Your application is in. Eli picks on Wednesday, November 25, and you'll hear that day." : 'Saved. Your application is up to date.');
    back(res);
  }));

  r.post('/app/founding-five/withdraw', requireAuth, wrap(async (req, res) => {
    if (await ff.withdraw(req.user)) flash(req, 'info', 'Your application and hello video are deleted. You can apply again until the close.');
    back(res);
  }));

  // One 4 MB part of a video (the page's script sends them in order; part 0 returns the upload id).
  r.post(
    '/app/founding-five/video/:slot',
    requireAuth,
    (req, res, next) => (security.allow(`ffv:${req.user.id}`, 300, HOUR) ? next() : res.status(429).json({ error: TOO_FAST })),
    (req, res, next) => express.raw({ type: () => true, limit: ff.CHUNK + 1024 })(req, res, next),
    wrap(async (req, res) => {
      let name = 'hello';
      try {
        name = decodeURIComponent(String(req.get('x-file-name') || 'hello'));
      } catch {
        /* keep 'hello' */
      }
      const out = await ff.putPart(req.user, { ...req.query, slot: req.params.slot }, req.body, { name, type: req.get('content-type'), admin: isAdmin(req.user) });
      if (out.error) return res.status(out.status || 400).json({ error: out.error });
      res.json({ upload: out.upload, done: out.done, video: out.video ? { size: out.video.size, type: out.video.type, name: out.video.name } : null });
    }),
    // eslint-disable-next-line no-unused-vars
    (err, req, res, next) => {
      if (err.status === 413 || err.type === 'entity.too.large') return res.status(413).json({ error: 'That part was too big. Reload the page and try again.' });
      console.error('[founding-five] upload failed:', err && err.message);
      res.status(500).json({ error: 'Something went wrong saving your video. Try again.' });
    }
  );

  r.get('/app/founding-five/video/:slot', requireAuth, wrap(async (req, res, next) => {
    const v = ff.videoAt(ff.mine(req.user.id), String(req.params.slot));
    if (!v) return next();
    await stream(req, res, v);
  }));

  r.post('/app/founding-five/video/:slot/delete', requireAuth, wrap(async (req, res) => {
    if (await ff.removeVideo(req.user, String(req.params.slot), { admin: isAdmin(req.user) })) flash(req, 'info', 'Video deleted.');
    back(res, req.params.slot === 'hello' ? 'video' : 'week');
  }));

  // The five: this week's numbers, and a yes or no on a piece 127 would like to share.
  r.post('/app/founding-five/week', requireAuth, wrap(async (req, res) => {
    const out = await ff.saveWeek(req.user, req.body);
    flash(req, out.error ? 'error' : 'win', out.error || `Saved. Eli starts session ${out.week.n} with them.`);
    back(res, 'week');
  }));
  r.post('/app/founding-five/pieces/:id/:answer', requireAuth, wrap(async (req, res) => {
    const yes = req.params.answer === 'yes';
    const out = await ff.answerPiece(req.user, req.params.id, yes);
    if (out) flash(req, 'win', yes ? 'Thanks. 127 may use it, always with the Founding Five line.' : out.wasYes ? "Got it. 127 stops using it in anything new and takes it down from its own accounts, website and emails within 7 days." : "Got it. It won't be used.");
    // Taking back a yes starts the 7-day takedown (Legal L63): Eli hears at once, without the member's email.
    if (out && out.wasYes && tell) tell({ subject: 'Founding Five: a member took back their OK on a piece', text: `${out.firstName || 'One of the five'} said no to "${out.piece.title}" after saying yes. Stop using it in anything new and take it down from 127's own accounts, website and emails within 7 days.\n\n${process.env.BASE_URL || 'https://127group.io'}/admin/founding-five#five` });
    back(res, 'pieces');
  }));

  r.get('/app/founding-five/sessions.ics', requireAuth, (req, res, next) => {
    if (!ff.isFive(ff.mine(req.user.id))) return next();
    privatePage(res);
    res.type('text/calendar').set('Content-Disposition', 'attachment; filename="127-founding-five-sessions.ics"').send(ff.ics());
  });

  // ---------- Eli's pick sheet ----------
  const toSheet = (res, hash) => res.redirect(`/admin/founding-five${hash ? '#' + hash : ''}`);

  r.get('/admin/founding-five', requireAuth, requireAdmin, (req, res) => {
    privatePage(res);
    res.render('admin/founding-five', { title: 'Founding Five', css: CSS, ff, b: ff.board(), across: ff.acrossFounding(), joinSet: !!ff.joinUrl(), now: Date.now() });
  });
  // Eli watches a hello video to score "on camera", and the five's start and weekly videos for his prep.
  r.get('/admin/founding-five/:id/video/:slot?', requireAuth, requireAdmin, wrap(async (req, res, next) => {
    const v = ff.videoAt(ff.byId(req.params.id), String(req.params.slot || 'hello'));
    if (!v) return next();
    await stream(req, res, v);
  }));
  r.post('/admin/founding-five/:id/score', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await ff.score(req.params.id, req.body);
    if (out.error) flash(req, 'error', out.error);
    toSheet(res, `app-${req.params.id}`);
  }));
  r.post('/admin/founding-five/:id/mark', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await ff.mark(req.params.id, String(req.body.mark || ''));
    if (out.error) flash(req, 'error', out.error);
    else if (out.moved) flash(req, 'info', `${ff.MARKS[out.app.mark]} moved here, so the one before is unmarked.`);
    toSheet(res, `app-${req.params.id}`);
  }));
  r.post('/admin/founding-five/confirm', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await ff.confirm(req.user.email);
    flash(req, out.error ? 'error' : 'win', out.error || `Picks confirmed. Every applicant's card shows their answer now, and the ${out.count} messages are ready to stage.`);
    toSheet(res, 'picks');
  }));
  r.post('/admin/founding-five/stage', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await ff.stagePicks(stageDraft);
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'win', out.staged ? `Staged ${out.staged} messages in Ops: picked first, then alternates, then not picked.${out.already ? ` ${out.already} were already there.` : ''}` : 'Every message was staged already.');
    toSheet(res, 'picks');
  }));
  r.post('/admin/founding-five/:id/step-in', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await ff.stepIn(req.params.id, req.user.email, { nextId: String(req.body.next || '') });
    flash(req, out.error ? 'error' : 'win', out.error || (out.next ? "Done. They're one of the five now, and their Founding Five page and calendar file are in HQ." : 'Done. No alternate is waiting, so the place stays empty.'));
    toSheet(res, 'five');
  }));
  r.post('/admin/founding-five/:id/circle-fit', requireAuth, requireAdmin, wrap(async (req, res) => {
    await ff.setFlag(req.params.id, 'circleFit', req.body.on === '1');
    toSheet(res, 'five');
  }));
  r.post('/admin/founding-five/:id/pieces/:piece/stop', requireAuth, requireAdmin, wrap(async (req, res) => {
    const p = await ff.stopPiece(req.params.id, req.params.piece, req.user.email);
    flash(req, p ? 'win' : 'error', p ? "Marked stopped. Nothing new uses it. Take it down from 127's own accounts, website and emails within 7 days." : 'That piece is already stopped.');
    toSheet(res, 'five');
  }));
  r.post('/admin/founding-five/:id/pieces', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await ff.addPiece(req.params.id, req.body);
    flash(req, out.error ? 'error' : 'win', out.error || 'Added. It waits for their yes in HQ.');
    toSheet(res, 'five');
  }));

  return r;
}

module.exports = foundingFiveRoutes;
module.exports.stream = stream;
