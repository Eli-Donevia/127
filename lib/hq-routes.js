// 127 HQ pages and connections (lib/hq.js, product/hub/v1-spec.md). Two mounts in server.js:
//
//   app.all('/hq/in/:token', hqRoutes.inbound);
//     Before express.urlencoded and the session: Shopify signs the raw body, and the 127 link
//     never reads or sets a cookie.
//   app.use(hqRoutes({ requireAuth, flash, track, reserveAi, refundAi, ageFromAi, aiRunsLeft }));
//
// HQ_LIVE off: every route here falls through to the app's 404.

const express = require('express');
const hq = require('./hq');
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
    res.render('app/hq', { title: 'HQ', css: CSS, HI, p, strip, bySlug, aiLeft: aiRunsLeft(user) });
  });

  // The week's numbers, call and note.
  r.post('/app/hq/week', ...B, wrap(async (req, res) => {
    const user = req.user;
    const key = String(req.body.w || '');
    if (!hq.okWeek(key)) return res.redirect('/app/hq');
    const first = !Object.keys((user.hq && user.hq.weeks) || {}).length;
    const { bad } = hq.saveWeek(user, key, req.body);
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
    res.render('app/hq-connect', { title: 'HQ connections', css: CSS, HI, c: hq.connections(req.user, res.locals.baseUrl) });
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
    const names = { stripe: 'Stripe', shopify: 'Shopify', link: 'Your 127 link' };
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

hqRoutes.progressStrip = progressStrip;
module.exports = hqRoutes;
