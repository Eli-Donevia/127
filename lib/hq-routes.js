// 127 HQ pages and connections (lib/hq.js, product/hub/v1-spec.md). Two mounts in server.js:
//
//   app.all('/hq/in/:token', hqRoutes.inbound);
//   app.all('/hq/ai/:token', hqRoutes.ai);
//     Before express.urlencoded and the session: Shopify signs the raw body, and the 127 link and
//     the AI link (lib/hq-harness.js) never read or set a cookie.
//   app.use(hqRoutes({ requireAuth, flash, track, reserveAi, refundAi, ageFromAi, aiRunsLeft }));
//
// HQ_LIVE off: every route here falls through to the app's 404. HQ_HARNESS off: so do the harness
// routes (screenshots, the Monday check-in and the AI link).

const express = require('express');
const hq = require('./hq');
const harness = require('./hq-harness');
const db = require('./db');
const ai = require('./ai');
const ageCheck = require('./age-check');
const security = require('./security');
const integrations = require('./integrations');
const { MILESTONES } = require('./milestones');
const { resources } = require('../content/resources.json');

const bySlug = Object.fromEntries(resources.map((r) => [r.slug, r]));
const KPI = 'kpi-dashboard';
const CSS = '/css/hq.css';
const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';
// Icons for the HQ views: Lucide-style, 1.5 stroke (brand/ design system).
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const HI = {
  target: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  drop: svg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>'),
  book: svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  up: svg('<path d="M7 17L17 7"/><path d="M7 7h10v10"/>'),
  down: svg('<path d="M7 7l10 10"/><path d="M17 7v10H7"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  bag: svg('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
  card: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  ai: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
};

function privatePage(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
}
function emit(type, payload) {
  Promise.resolve(integrations.emit(type, payload)).catch(() => {});
}
// The progress map as one strip: 10 milestones, the next one named.
function progressStrip(user) {
  const on = (m) => (m.auto ? !!user.roadmap : !!(user.milestones || {})[m.id]);
  const next = MILESTONES.find((m) => !on(m));
  return { done: MILESTONES.filter(on).length, total: MILESTONES.length, segs: MILESTONES.map(on), next: next ? next.label : null };
}
function listOf(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function hqRoutes({ requireAuth, flash, track, reserveAi, refundAi, ageFromAi, aiRunsLeft }) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const on = (req, res, next) => (hq.live() ? next() : next('router'));
  const hon = (req, res, next) => (harness.on() ? next() : next('router'));
  // Builders, Circle and paused members. Free members get the preview; their posts go back to it.
  const full = (req, res, next) => (hq.canUse(req.user) ? next() : res.redirect('/app/hq'));
  // Connections need an adult account holder (H14): paused while an age review is open.
  const adult = (req, res, next) => {
    if (!ageCheck.underReview(req.user)) return next();
    flash(req, 'info', ageCheck.PAUSE_MESSAGE);
    res.redirect('/app/hq/connect');
  };
  const B = [on, requireAuth, full];
  const weekOf = (v) => (hq.okWeek(String(v || '')) ? String(v) : hq.defaultWeek());
  const allow = (req, key, max, windowMs) => {
    if (security.allow(key, max, windowMs)) return true;
    flash(req, 'info', TOO_FAST);
    return false;
  };

  r.get('/app/hq', on, requireAuth, (req, res) => {
    privatePage(res);
    const user = req.user;
    const strip = progressStrip(user);
    if (!hq.canUse(user)) return res.render('app/hq-free', { title: 'HQ', css: CSS, HI, strip, sample: hq.sample() });
    const p = hq.page(user, weekOf(req.query.w), res.locals.baseUrl);
    const hz = harness.on() ? { snap: harness.snapFor(user, p.key), checkin: !!(user.hq && user.hq.checkin), max: harness.SNAP_MAX } : null;
    res.render('app/hq', { title: 'HQ', css: CSS, HI, p, hz, strip, bySlug, aiLeft: aiRunsLeft(user) });
  });

  // The week's numbers, call and note.
  r.post('/app/hq/week', ...B, wrap(async (req, res) => {
    const user = req.user;
    const key = String(req.body.w || '');
    if (!hq.okWeek(key)) return res.redirect('/app/hq');
    const first = !Object.keys((user.hq && user.hq.weeks) || {}).length;
    const { bad } = hq.saveWeek(user, key, req.body);
    harness.clearSnap(user, key);
    await db.save('users', user);
    emit('hq.week_saved', { userId: user.id, week: key });
    if (first) track(req, 'HQ First Week');
    if (bad.length) flash(req, 'error', `Saved, except ${listOf(bad)}. Use a number, like 12 or 49.50.`);
    else flash(req, 'win', 'Week saved.');
    res.redirect(`/app/hq?w=${key}#leak`);
  }));

  r.post('/app/hq/settings', ...B, wrap(async (req, res) => {
    hq.saveSettings(req.user, req.body);
    await db.save('users', req.user);
    flash(req, 'win', 'Saved.');
    res.redirect(`/app/hq?w=${weekOf(req.body.w)}#setup`);
  }));

  r.post('/app/hq/numbers', ...B, wrap(async (req, res) => {
    const out = hq.addCustom(req.user, req.body);
    if (out.error) flash(req, 'error', out.error);
    else {
      await db.save('users', req.user);
      flash(req, 'win', `${out.custom.label} added. Log it with the week, or send it to your 127 link.`);
    }
    res.redirect(`/app/hq?w=${weekOf(req.body.w)}#numbers`);
  }));

  r.post('/app/hq/numbers/:id/delete', ...B, wrap(async (req, res) => {
    if (hq.removeCustom(req.user, String(req.params.id))) {
      await db.save('users', req.user);
      flash(req, 'win', 'Removed, with its history.');
    }
    res.redirect(`/app/hq?w=${weekOf(req.body.w)}#numbers`);
  }));

  r.get('/app/hq/connect', on, requireAuth, (req, res) => {
    if (!hq.canUse(req.user)) return res.redirect('/app/hq');
    privatePage(res);
    res.render('app/hq-connect', { title: 'HQ connections', css: CSS, HI, c: hq.connections(req.user, res.locals.baseUrl), harness: harness.on() ? { steps: harness.aiSteps() } : null });
  });

  r.post('/app/hq/connect/stripe', ...B, adult, wrap(async (req, res) => {
    const user = req.user;
    if (!allow(req, `hq-stripe:${user.id}`, 8, 60 * 60 * 1000)) return res.redirect('/app/hq/connect#stripe');
    const out = await hq.connectStripe(user, req.body.key);
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'win', `Stripe connected. ${out.sales === 1 ? '1 sale' : `${out.sales} sales`} in the last 12 weeks.`);
    res.redirect('/app/hq/connect#stripe');
  }));

  r.post('/app/hq/connect/shopify', ...B, adult, wrap(async (req, res) => {
    const out = await hq.connectShopify(req.user, req.body.secret);
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'win', 'Shopify is set. New orders count from the first one Shopify sends.');
    res.redirect('/app/hq/connect#shopify');
  }));

  // Makes the 127 link, or a new one in place of the old.
  r.post('/app/hq/link', ...B, adult, wrap(async (req, res) => {
    const user = req.user;
    if (!allow(req, `hq-link-new:${user.id}`, 10, 60 * 60 * 1000)) return res.redirect('/app/hq/connect#link');
    const had = hq.connections(user, '').link;
    await hq.makeLink(user);
    flash(req, 'win', had ? 'New link made. The old one stopped working, so paste the new one into Zapier, Make or Shopify.' : 'Your 127 link is ready. Copy it below.');
    res.redirect(`/app/hq/connect#${req.body.back === 'shopify' ? 'shopify' : 'link'}`);
  }));

  r.post('/app/hq/disconnect/:provider', ...B, wrap(async (req, res) => {
    const p = String(req.params.provider);
    const names = { stripe: 'Stripe', shopify: 'Shopify', link: 'Your 127 link', ai: 'Your AI link' };
    if (await hq.disconnect(req.user, p)) flash(req, 'win', `${names[p]} disconnected. The numbers already counted stay in HQ.`);
    res.redirect(`/app/hq/connect#${names[p] ? p : ''}`);
  }));

  r.post('/app/hq/sync', ...B, adult, wrap(async (req, res) => {
    const user = req.user;
    if (!security.allow(`hq-sync:${user.id}`, 1, 10 * 60 * 1000)) {
      flash(req, 'info', 'Stripe refreshed a few minutes ago. Try again in 10 minutes.');
      return res.redirect('/app/hq/connect#stripe');
    }
    const out = await hq.syncStripe(user);
    flash(req, out.error ? 'error' : 'win', out.error || 'Stripe refreshed.');
    res.redirect('/app/hq/connect#stripe');
  }));

  // Read my week (H10): Eli's Playbook on the KPI Dashboard worksheet, filled from HQ. 1 message.
  r.post('/app/hq/read', ...B, wrap(async (req, res) => {
    const user = req.user;
    const key = weekOf(req.body.w);
    const back = `/app/hq?w=${key}#read`;
    if (!reserveAi(req, res, user, back)) return;
    const result = await ai.review(bySlug[KPI], hq.readValues(user, key), user);
    const at = new Date().toISOString();
    if (result.error) refundAi(user);
    else hq.ensure(user).read = { text: result.text, demo: !!result.demo, at, week: key };
    await db.save('users', user);
    if (result.error) flash(req, 'error', result.text);
    else {
      emit('hq.read', { userId: user.id, week: key });
      const note = ((user.hq.weeks || {})[key] || {}).note;
      await ageFromAi(req, user, result, note ? [{ from: 'member', text: note, at }] : []);
    }
    res.redirect(back);
  }));

  // ---------- the harness (lib/hq-harness.js) ----------

  // Screenshot drop-in. public/js/hq.js posts JSON { w, images: [data URLs] } and goes where `go` says.
  // 1 AI message. The images live only for this request.
  r.post('/app/hq/snap', on, hon, requireAuth, full, express.json({ limit: '30mb' }), wrap(async (req, res) => {
    const user = req.user;
    const key = weekOf(req.body && req.body.w);
    const back = `/app/hq?w=${key}#log`;
    const parsed = harness.parseImages(req.body && req.body.images);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    // reserveAi answers with a flash and a redirect; here the page reloads to show it.
    let stopped = false;
    if (!reserveAi(req, { redirect: () => { stopped = true; } }, user, back) || stopped) {
      await db.save('users', user);
      return res.json({ go: back });
    }
    const out = await harness.snap(user, parsed.images, key);
    if (out.error) {
      refundAi(user);
      await db.save('users', user);
      return res.status(502).json({ error: out.error });
    }
    await db.save('users', user);
    if (!out.found) flash(req, 'info', 'No numbers found in that. Try a screenshot that shows totals, like a dashboard or a report.');
    res.json({ go: `/app/hq?w=${out.week}#log` });
  }), (err, req, res, next) => { // eslint-disable-line no-unused-vars
    // Its own error handler, so a bad upload never reaches the app's handler, which logs the error
    // object (body-parser puts part of the body, a screenshot, on err.body). Logs err.type only (Legal L50).
    console.error('[hq] snap', (err && err.type) || 'error');
    const status = err && err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status === 413 ? 'Those are too big. Try fewer or smaller screenshots.' : status < 500 ? "Couldn't read that upload. Try again." : 'Something went wrong. Try again.' });
  });

  r.post('/app/hq/snap/clear', on, hon, requireAuth, full, wrap(async (req, res) => {
    if (harness.clearSnap(req.user)) await db.save('users', req.user);
    res.redirect(`/app/hq?w=${weekOf(req.body.w)}#log`);
  }));

  r.post('/app/hq/checkin', on, hon, requireAuth, full, wrap(async (req, res) => {
    const want = req.body.on === '1';
    harness.setCheckin(req.user, want);
    await db.save('users', req.user);
    flash(req, 'win', want ? "Monday check-in is on. You'll get the first one next Monday morning." : 'Monday check-in is off.');
    res.redirect(`/app/hq?w=${weekOf(req.body.w)}#fill`);
  }));

  // Makes the AI link, or a new one in place of the old.
  r.post('/app/hq/ai', on, hon, requireAuth, full, adult, wrap(async (req, res) => {
    const user = req.user;
    if (!allow(req, `hq-ai-new:${user.id}`, 10, 60 * 60 * 1000)) return res.redirect('/app/hq/connect#ai');
    const had = hq.connections(user, '').ai;
    await harness.makeAiLink(user);
    flash(req, 'win', had ? 'New AI link made. The old one stopped working, so add the new one in Claude or ChatGPT.' : 'Your AI link is ready. Copy it below.');
    res.redirect('/app/hq/connect#ai');
  }));

  // The Monday check-in: logs one week with no login. The link in the email is the key.
  const checkinPage = (req, res, extra = {}) => {
    privatePage(res);
    res.set('X-Robots-Tag', 'noindex');
    const found = harness.fromCheckin(String(req.params.token || ''));
    if (!found || found.expired) return res.status(found ? 410 : 404).render('hq-checkin', { title: 'Check in', css: CSS, p: null, expired: !!found, done: false, stopped: false, ...extra });
    const p = hq.page(found.user, found.week, res.locals.baseUrl);
    return res.render('hq-checkin', { title: 'Check in', css: CSS, p, name: String(found.user.name || '').split(' ')[0], on: !!(found.user.hq || {}).checkin, token: req.params.token, expired: false, done: false, stopped: false, ...extra });
  };
  r.get('/hq/week/:token', on, hon, checkinPage);
  r.post('/hq/week/:token', on, hon, wrap(async (req, res) => {
    if (!security.allow(`hq-checkin:${security.ip(req)}`, 30, 60 * 60 * 1000)) return res.status(429).type('text/plain').send('Too many tries. Wait a few minutes and try again.');
    const found = harness.fromCheckin(String(req.params.token || ''));
    if (!found || found.expired) return checkinPage(req, res);
    const { user, week } = found;
    if (req.body.stop === '1') {
      harness.setCheckin(user, false);
      await db.save('users', user);
      return checkinPage(req, res, { stopped: true });
    }
    const { bad } = hq.saveWeek(user, week, req.body);
    harness.clearSnap(user, week);
    await db.save('users', user);
    emit('hq.week_saved', { userId: user.id, week, via: 'checkin' });
    return checkinPage(req, res, { done: true, bad });
  }));

  return r;
}

// POST /hq/in/:token: the 127 link and Shopify webhooks. Plain answers, no cookies, no pages.
const raw = express.raw({ type: () => true, limit: '256kb' });
hqRoutes.inbound = [
  (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!hq.live()) return res.status(404).type('text/plain').send('Not found');
    if (req.method !== 'POST') return res.status(405).set('Allow', 'POST').type('text/plain').send('This is a private 127 link. Tools like Zapier, Make and Shopify send numbers to it with a POST. Set it up in HQ, Connections.');
    // A wrong link is refused before its body is read, and one IP gets 100 wrong tries an hour. Working
    // links aren't limited by IP (Shopify and Zapier send for many members from shared addresses);
    // lib/hq.js limits each link instead.
    if (!hq.byToken(String(req.params.token || ''))) {
      const ok = security.allow(`hq-in-miss:${security.ip(req)}`, 100, 60 * 60 * 1000);
      return res.status(ok ? 404 : 429).type('text/plain').send(ok ? 'Not found' : 'Too many requests');
    }
    next();
  },
  raw,
  (req, res, next) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    hq.inbound(String(req.params.token || ''), req.headers, body)
      .then(([status, out]) => (typeof out === 'string' ? res.status(status).type('text/plain').send(out) : res.status(status).json(out)))
      .catch(next);
  },
  // A body over 256kb, or one that can't be read.
  // eslint-disable-next-line no-unused-vars
  (err, req, res, next) => {
    // The error only, never the request body: it can hold a member's customer data (Legal L48).
    if (!err.status || err.status >= 500) console.error('[hq] inbound', err && err.stack ? err.stack : String(err));
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).type('text/plain').send(status === 413 ? 'Too large' : status < 500 ? 'Bad request' : 'Something went wrong');
  },
];

// POST /hq/ai/:token: 127 inside Claude and ChatGPT (MCP, Streamable HTTP, JSON answers only).
hqRoutes.ai = [
  (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!harness.on()) return res.status(404).type('text/plain').send('Not found');
    if (req.method !== 'POST') return res.status(405).set('Allow', 'POST').type('text/plain').send('This is a private 127 AI link. Add it in Claude or ChatGPT as a custom connector. Set it up in 127 HQ, Connections.');
    if (!harness.aiByToken(String(req.params.token || ''))) {
      const ok = security.allow(`hq-in-miss:${security.ip(req)}`, 100, 60 * 60 * 1000);
      return res.status(ok ? 404 : 429).type('text/plain').send(ok ? 'Not found' : 'Too many requests');
    }
    next();
  },
  express.json({ limit: '256kb', type: () => true }),
  (req, res, next) => {
    harness.mcp(String(req.params.token || ''), req.body)
      .then(([status, out]) => (out === null ? res.status(status).end() : res.status(status).json(out)))
      .catch(next);
  },
  // eslint-disable-next-line no-unused-vars
  (err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    if (!err.status || err.status >= 500) console.error('[hq] ai', err && err.stack ? err.stack : String(err));
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: status === 413 ? 'Too large' : 'Something went wrong' } });
  },
];

hqRoutes.progressStrip = progressStrip;
module.exports = hqRoutes;
