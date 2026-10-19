// Day One Challenge routes. Mount in server.js right after the middleware that sets
// req.user and res.locals (so /app and /start see the challenge first):
//
//   const challenge = require('./lib/challenge');
//   require('./lib/challenge-routes')(app, { requireAuth, requireAdmin });
//
// Personal pages use a capability token (?t=) from emails. On the first visit the token
// moves into the signed session cookie and the page redirects to a clean URL, so tokens
// never reach analytics, browser history or referrers.

const express = require('express');
const ch = require('./challenge');
const db = require('./db');
const security = require('./security');
const launch = require('./launch');
const waitlist = require('./waitlist');
const kl = require('./klaviyo');

const PROD = process.env.NODE_ENV === 'production';
const TOO_FAST = 'Too many tries in a short time. Wait a few minutes and try again.';

module.exports = function mount(app, { requireAuth, requireAdmin }) {
  // ---------- helpers ----------
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  function on(req, res, next) {
    if (!ch.enabled()) return res.status(404).render('404', { title: 'Not found' });
    next();
  }
  function allow(req, res, key, max, windowMs, json) {
    if (security.allow(key, max, windowMs)) return true;
    res.status(429);
    if (json) res.json({ error: TOO_FAST });
    else res.render('404', { title: 'Slow down', error: true, message: TOO_FAST });
    return false;
  }
  // Same caps as the founding waitlist: loose per IP (pop-ups, campus Wi-Fi), tight per email.
  function joinLimit(req, res, email, json) {
    if (!allow(req, res, `challenge:${security.ip(req)}`, 100, 60 * 60 * 1000, json)) return false;
    const e = String(email || '').trim().toLowerCase().slice(0, 200);
    return !e || allow(req, res, `challenge-email:${e}`, 5, 60 * 60 * 1000, json);
  }
  function track(req, name, props) {
    req.session.track = (req.session.track || []).concat({ name, props: props || null }).slice(-5);
  }
  function cookie(req, name) {
    const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function utmFrom(req, body = {}) {
    const out = { ...(req.session.utm || {}) };
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) if (body[k]) out[k] = String(body[k]).slice(0, 100);
    return out;
  }
  function privatePage(res) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cache-Control', 'no-store');
  }
  function current(req) {
    return req.session && req.session.ct ? ch.byToken(req.session.ct) : null;
  }
  // ?t=<token>: remember it in the session, then reload the same page without it.
  function takeToken(req, res) {
    if (!req.query.t) return false;
    const entry = ch.byToken(req.query.t);
    if (!entry) {
      res.redirect('/challenge/me?lost=1');
      return true;
    }
    req.session.ct = entry.token;
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) if (k !== 't' && typeof v === 'string') q.set(k, v);
    const qs = q.toString();
    res.redirect(req.path + (qs ? `?${qs}` : ''));
    return true;
  }
  // Markdown-lite used in content/challenge.json: **bold**, *italic*, [text](url).
  function md(s) {
    const e = String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return e
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
        const safe = url.startsWith('/') || /^https:\/\//.test(url) || /^mailto:/.test(url);
        if (!safe) return text;
        const ext = /^https:/.test(url) && !/^https:\/\/(www\.)?127group\.io/.test(url);
        return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
      })
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:!?)]|$)/g, '$1<i>$2</i>');
  }
  function firstNameOf(entry) {
    return (entry && entry.firstName) || '';
  }
  function referral(entry) {
    const w = launch.onWaitlist(entry.email);
    if (!w) return null;
    return { code: w.referralCode, link: waitlist.link(w), count: w.referralCount || 0, confirmed: !!w.confirmedAt };
  }
  function dayRows(entry, t) {
    return [1, 2, 3, 4, 5].map((n) => {
      const at = ch.unlockAt(n);
      return { n, move: ch.MOVES[n - 1], date: ch.etDay(at), weekday: ch.etWeekday(at), unlockAt: at, unlocked: t >= at, done: ch.done(entry, n) };
    });
  }
  function view(req, res, extra = {}) {
    const t = ch.now();
    const T = ch.times();
    const entry = extra.entry !== undefined ? extra.entry : current(req);
    waitlist.useHost(res.locals.baseUrl);
    return {
      ogImage: '/img/og/challenge.png',
      css: ['/challenge-assets/challenge.css'],
      md,
      chx: {
        ...T,
        now: t,
        phase: ch.phase(t),
        dayLive: ch.liveDay(t),
        lives: ch.lives(t),
        moves: ch.MOVES,
        etClock: ch.etClock,
        etDay: ch.etDay,
        etLong: ch.etLong,
        etWeekday: ch.etWeekday,
        foundingPrice: launch.view().foundingPrice,
        referralsForReward: launch.referralsForReward(),
      },
      me: entry
        ? {
            entry,
            firstName: firstNameOf(entry),
            daysDone: ch.daysDone(entry),
            finished: !!entry.finishedAt,
            pageUrl: ch.pageUrl(entry, res.locals.baseUrl),
            days: dayRows(entry, t),
            referral: referral(entry),
          }
        : null,
      ...extra,
    };
  }
  function landingLocals(req, form = {}, error = null) {
    const t = ch.now();
    const T = ch.times();
    // The founding page links with ?ref=founding and the status page with ?ref=<code>&first_name=…
    const rawRef = String(req.query.ref || form.ref || '').slice(0, 30);
    const from = String(req.query.from || form.from || (ch.SOURCES.includes(rawRef.toLowerCase()) ? rawRef : '') || '').toLowerCase().slice(0, 30);
    const ref = String((rawRef && !ch.SOURCES.includes(rawRef.toLowerCase()) ? rawRef : '') || cookie(req, 'ref') || '').toUpperCase().slice(0, 12);
    const entry = current(req);
    return {
      title: 'The Day One Challenge',
      description: 'A free 5-day challenge with Eli Christiansen. One move a day, about 20 minutes. By Friday: one idea, real conversations and an offer. November 9 to 13.',
      ogImage: '/img/og/challenge.png',
      css: ['/challenge-assets/landing.css'],
      ch: {
        ...T,
        now: t,
        phase: ch.phase(t),
        dayLive: ch.liveDay(t) || null,
        consent: { flag: ch.launchConsentFlag(), ...ch.consentCopy() },
        form: { first_name: String(form.first_name || req.query.first_name || '').replace(/[<>]/g, '').slice(0, 60), email: form.email || '', optin: form.optin === 'on' || form.optin === true, error },
        ref: /^[A-Z0-9]{6}$/.test(ref) ? ref : '',
        from: /^[a-z-]+$/.test(from) ? from : '',
        foundingPrice: launch.view().foundingPrice,
        me: entry ? { firstName: firstNameOf(entry) } : null,
      },
    };
  }

  // ---------- locals for cross-promo partials (founding pages, homepage) ----------
  app.use((req, res, next) => {
    res.locals.chPromo = null;
    if (ch.promoVisible()) {
      const t = ch.now();
      const T = ch.times();
      res.locals.chPromo = { phase: ch.phase(t), dayLive: ch.liveDay(t), startAt: T.startAt, startLabel: `${ch.etLong(T.startAt)} at ${ch.etClock(T.startAt)} ET` };
    }
    next();
  });

  // ---------- carry-over into the member app ----------
  app.get('/app', wrap(async (req, res, next) => {
    if (!req.user || !ch.enabled()) return next();
    try {
      await ch.syncUser(req.user);
    } catch (err) {
      console.warn('[challenge] carry-over', err.message);
    }
    // server.js picks the founding bar before this sync, so a finisher's first visit would miss the finisher bar.
    const o = res.locals.builderOffer;
    if (o && o.founding && o.variant !== 'last_day' && req.user.challenge && req.user.challenge.finished_at) o.variant = 'finisher';
    next();
  }));
  // The assessment's first question (stage) defaults to "Validating" once Day 1 is done.
  app.get('/start', (req, res, next) => {
    if (req.user || req.query.stage || req.query.retake || !ch.enabled()) return next();
    const entry = current(req);
    if (!entry || !ch.done(entry, 1)) return next();
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) if (typeof v === 'string') q.set(k, v);
    q.set('stage', 'validating');
    res.redirect(`/start?${q}`);
  });

  // ---------- landing and join ----------
  app.get('/dayone', on, (req, res) => {
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(301, `/challenge${qs}`);
  });

  app.get('/challenge', on, (req, res) => {
    const p = ch.phase();
    const L = landingLocals(req, req.session.chForm || {}, req.session.chError || null);
    req.session.chForm = null;
    req.session.chError = null;
    res.render(p === 'open' || p === 'live' ? 'challenge/landing' : 'challenge/closed', L);
  });

  // Shared by the form post and the JSON endpoint.
  async function joinRequest(req, body, page) {
    return ch.join({
      email: body.email,
      firstName: body.first_name || body.name,
      optIn: body.optin === 'on' || body.optin === true || body.optin === 'true',
      ref: body.ref || cookie(req, 'ref'),
      utm: utmFrom(req, body),
      from: body.from || body.source,
      ip: security.ip(req),
      page,
    });
  }
  // After a join: who gets their page now, and who gets their link by email.
  async function afterJoin(req, r) {
    const entry = r.entry;
    if (!r.existing) {
      req.session.ct = entry.token;
      req.session.chj = { kind: 'new', onList: r.onList };
      track(req, 'Challenge Join', { source: entry.source });
      const eventId = `chl_${entry.id}`;
      if (ch.adConsent(req)) {
        req.session.chLead = eventId;
        ch.metaLead(req, entry, eventId);
      }
      return '/challenge/joined';
    }
    if (req.session.ct === entry.token) {
      req.session.chj = { kind: 'back' };
      return '/challenge/joined';
    }
    // Someone typed an email that's already in: never open that person's page here.
    if (security.allow(`chlink:${entry.email}`, 3, 60 * 60 * 1000)) ch.sendLink(entry);
    req.session.chj = { kind: 'sent' };
    return '/challenge/joined';
  }

  app.post('/challenge', on, wrap(async (req, res) => {
    const body = req.body || {};
    if (body.website) return res.redirect('/challenge');
    if (!joinLimit(req, res, body.email)) return;
    const r = await joinRequest(req, body, '/challenge');
    if (r.closed) return res.redirect('/challenge');
    if (r.error) {
      res.status(400);
      return res.render('challenge/landing', landingLocals(req, body, r.error));
    }
    res.redirect(await afterJoin(req, r));
  }));

  // JSON join for cards on other pages: the quiz-results challenge card (Lead magnets) and the optional
  // public/challenge-assets/funnel-block.js. Body: { email, first_name, source, optin }.
  app.post('/challenge/api/join', on, express.json({ limit: '10kb' }), wrap(async (req, res) => {
    const body = req.body || {};
    if (body.website) return res.json({ ok: true, url: '/challenge' });
    if (!joinLimit(req, res, body.email, true)) return;
    const r = await joinRequest(req, body, `/${['founder-score', 'day-one-stack', 'idea-test'].includes(body.source) ? body.source : 'funnel'}`);
    if (r.closed) return res.status(410).json({ closed: true, url: '/challenge' });
    if (r.error) return res.status(400).json({ error: r.error });
    // existing: they were already in. Their page link goes to their inbox; nothing opens here.
    res.json({ ok: true, existing: !!r.existing, url: await afterJoin(req, r) });
  }));

  // Funnel result pages ask whether to show the challenge block.
  app.get('/challenge/status.json', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!ch.promoVisible()) return res.json({ show: false });
    const t = ch.now();
    const p = ch.phase(t);
    const copy = ch.consentCopy();
    res.json({
      show: p === 'open' || p === 'live',
      phase: p,
      day_live: p === 'live' ? ch.liveDay(t) : null,
      starts_at: new Date(ch.times().startAt).toISOString(),
      consent: { box: copy.box, line: copy.line, version: copy.version },
      join_url: '/challenge',
      api: '/challenge/api/join',
    });
  });

  app.get('/challenge/joined', on, (req, res) => {
    privatePage(res);
    const j = req.session.chj || {};
    const entry = current(req);
    if (!entry && j.kind !== 'sent') return res.redirect('/challenge');
    const w = entry && launch.onWaitlist(entry.email);
    // CH0 carries the Confirm button only while their waitlist spot is unconfirmed.
    const L = view(req, res, { title: "You're in", kind: entry && j.kind !== 'sent' ? j.kind || 'back' : 'sent', onList: !!j.onList, needsConfirm: !(w && w.confirmedAt), lead: null });
    if (req.session.chLead && entry) {
      L.lead = { eventId: req.session.chLead, pixel: require('./ad-consent').metaPixelId() || null };
      req.session.chLead = null;
    }
    res.render('challenge/joined', L);
  });

  // One-tap join links in waitlist emails: /challenge/join?e=<email>&s=<signature>.
  // The click shows a confirm button instead of joining on GET, so email link scanners can't sign anyone up.
  app.get('/challenge/join', on, (req, res) => {
    privatePage(res);
    if (req.query.e) {
      const e = String(req.query.e).trim().toLowerCase();
      if (ch.verify(e, req.query.s)) req.session.chOneTap = { e, s: String(req.query.s) };
      return res.redirect('/challenge/join');
    }
    const o = req.session.chOneTap;
    if (!o || !ch.verify(o.e, o.s)) return res.redirect('/challenge');
    const p = ch.phase();
    if (p === 'closed' || p === 'after') return res.redirect('/challenge');
    const existing = ch.byEmail(o.e);
    if (existing) {
      // The signed link proves the email is theirs, so their page opens here.
      req.session.ct = existing.token;
      req.session.chOneTap = null;
      req.session.chj = { kind: 'back' };
      return res.redirect('/challenge/joined');
    }
    const w = launch.onWaitlist(o.e);
    res.render('challenge/join-confirm', view(req, res, { title: 'Join the Day One Challenge', entry: null, firstName: (w && w.firstName) || '', email: o.e }));
  });
  app.post('/challenge/join', on, wrap(async (req, res) => {
    const o = req.session.chOneTap;
    if (!o || !ch.verify(o.e, o.s)) return res.redirect('/challenge');
    if (!joinLimit(req, res, o.e)) return;
    const w = launch.onWaitlist(o.e);
    const r = await ch.join({ email: o.e, firstName: (w && w.firstName) || '', optIn: false, ip: security.ip(req), utm: utmFrom(req), oneTap: true, page: '/challenge/join' });
    if (r.closed || r.error) return res.redirect('/challenge');
    req.session.chOneTap = null;
    req.session.ct = r.entry.token;
    req.session.chj = { kind: r.existing ? 'back' : 'new', onList: true, oneTap: true };
    if (!r.existing) track(req, 'Challenge Join', { source: r.entry.source });
    res.redirect('/challenge/joined');
  }));

  // ---------- day pages ----------
  function dayState(entry, n, t, edit) {
    if (t < ch.unlockAt(n)) return 'locked';
    if (t > ch.times().closesAt) return 'closed';
    if (ch.done(entry, n) && !edit) return 'done';
    return 'open';
  }
  function renderDay(req, res, n, entry, extra = {}) {
    const t = ch.now();
    const d = ch.day(n);
    const preview = !!extra.preview;
    const state = preview ? 'open' : dayState(entry, n, t, req.query.edit === '1' || !!extra.errors);
    const saved = entry && entry.days && entry.days[n] ? entry.days[n].answers || {} : {};
    let values = extra.values || saved;
    // The feature boxes are one choice across Days 3 to 5: always show where it stands now,
    // so a later check-in never quietly withdraws an earlier yes.
    if (d.checkin.feature && entry && !extra.values) {
      values = { ...values, feature_ok: !!entry.featureOk, feature_idea: !!entry.featureIdea, feature_offer: !!entry.featureOffer, guest_ok: !!entry.guestOk };
    }
    const count = ch.dayCount(n);
    const nextAt = n < 5 ? ch.unlockAt(n + 1) : null;
    const L = view(req, res, {
      title: `Day ${n}: ${d.move}`,
      entry,
      n,
      d,
      state,
      preview,
      values,
      errors: extra.errors || {},
      justDone: req.query.done === '1',
      count: count >= 25 ? count : null,
      next: n < 5 ? { n: n + 1, move: ch.MOVES[n], at: nextAt, unlocked: t >= nextAt, teaser: d.next } : null,
      video: ch.video(n),
      feature: ch.content().feature,
      card: entry ? cardData(entry, n) : null,
      cardLabels: cardLabels(),
      // Day 2's First 25 tip shows only on real business data (google or osm); the samples are made up.
      first25Real: require('./first25').sourceName() !== 'sample',
    });
    res.render('challenge/day', L);
  }
  // Card labels come from content/challenge.json, so Eli edits them with the rest of the copy.
  function cardLabels() {
    const out = {};
    for (const x of ch.content().days) if (x.card && x.card.label) out[x.n === 5 ? 'finisher' : x.n] = x.card.label;
    return out;
  }
  // The idea or offer line is a toggle on the card itself, off by default and never saved (daily-moves.md).
  function cardData(entry, n) {
    const finisher = !!entry.finishedAt && n === 5;
    const lineOption = n === 1 ? ch.answer(entry, 1, 'idea') : n === 4 || finisher ? ch.answer(entry, 4, 'offer') : '';
    const doneDays = [1, 2, 3, 4, 5].filter((x) => ch.done(entry, x));
    return { day: finisher ? 'finisher' : String(n), firstName: firstNameOf(entry), lineOption: lineOption || '', done: doneDays.join(','), today: n };
  }

  app.get('/challenge/day/:n', on, (req, res) => {
    privatePage(res);
    const n = parseInt(req.params.n, 10);
    if (!(n >= 1 && n <= 5) || String(n) !== req.params.n) return res.status(404).render('404', { title: 'Not found' });
    if (takeToken(req, res)) return;
    // Admins can read any day before it unlocks: /challenge/day/3?preview=1
    if (req.query.preview === '1' && res.locals.isAdmin) return renderDay(req, res, n, current(req), { preview: true });
    const entry = current(req);
    if (!entry) return res.redirect('/challenge/me');
    renderDay(req, res, n, entry);
  });

  app.post('/challenge/day/:n', on, wrap(async (req, res) => {
    privatePage(res);
    const n = parseInt(req.params.n, 10);
    if (!(n >= 1 && n <= 5)) return res.status(404).render('404', { title: 'Not found' });
    const entry = current(req);
    if (!entry) return res.redirect('/challenge/me');
    if (!allow(req, res, `chday:${entry.id}`, 60, 60 * 60 * 1000)) return;
    const r = await ch.checkIn(entry, n, req.body || {});
    // Locked, closed or unknown day: show the page in its real state, nothing saved.
    if (r.locked || r.closed || r.notFound) return res.redirect(`/challenge/day/${n}`);
    if (r.errors) {
      res.status(400);
      return renderDay(req, res, n, entry, { errors: r.errors, values: { ...r.answers, ...pickFields(n, req.body) } });
    }
    if (r.first) track(req, 'Challenge Check-in', { day: String(n) });
    if (r.finishedNow) track(req, 'Challenge Finish');
    res.redirect(`/challenge/day/${n}?done=1`);
  }));
  function pickFields(n, body) {
    const out = {};
    for (const f of ch.day(n).checkin.fields) if (body && body[f.id] != null) out[f.id] = body[f.id];
    for (const k of ['feature_ok', 'feature_idea', 'feature_offer', 'guest_ok']) if (body && body[k] != null) out[k] = true;
    return out;
  }

  // ---------- progress page and lost link ----------
  app.get('/challenge/me', on, (req, res) => {
    privatePage(res);
    if (takeToken(req, res)) return;
    const entry = current(req);
    if (!entry) return res.render('challenge/me', view(req, res, { title: 'Your Day One Challenge link', entry: null, lost: req.query.lost === '1', sent: false }));
    res.render('challenge/me', view(req, res, { title: `${firstNameOf(entry) ? firstNameOf(entry) + "'s" : 'Your'} Day One`, entry, lost: false, sent: false }));
  });
  app.post('/challenge/me', on, wrap(async (req, res) => {
    privatePage(res);
    if (!allow(req, res, `chlost:${security.ip(req)}`, 5, 60 * 60 * 1000)) return;
    const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
    const entry = ch.byEmail(email);
    if (entry && security.allow(`chlink:${email}`, 3, 60 * 60 * 1000)) ch.sendLink(entry);
    // Same answer whether or not the email is in the challenge.
    res.render('challenge/me', view(req, res, { title: 'Your Day One Challenge link', entry: null, lost: false, sent: true }));
  }));
  // "Not you?" on a shared device.
  app.post('/challenge/forget', on, (req, res) => {
    req.session.ct = null;
    res.redirect('/challenge');
  });

  // ---------- calendar files ----------
  app.get('/challenge/cal/:which.ics', on, (req, res) => {
    const which = req.params.which === 'debrief' ? 'debrief' : req.params.which === 'kickoff' ? 'kickoff' : null;
    if (!which) return res.status(404).render('404', { title: 'Not found' });
    res.set('content-type', 'text/calendar; charset=utf-8');
    res.set('content-disposition', `attachment; filename="day-one-${which}.ics"`);
    res.send(ch.ics(which));
  });

  // ---------- early access for finishers (Tue Nov 17, 9am to 10am ET) ----------
  app.get('/early', on, (req, res) => {
    privatePage(res);
    if (takeToken(req, res)) return;
    if (req.user) return res.redirect('/app');
    const entry = current(req);
    const state = ch.earlyState(entry);
    if (state === 'open') return res.redirect('/start?ref=challenge');
    if (state === 'early') {
      ch.grantEarly(req);
      return res.redirect(`/start?ref=challenge${ch.done(entry, 1) ? '&stage=validating' : ''}`);
    }
    res.render('challenge/early', view(req, res, { title: 'Early access', entry, state }));
  });

  // ---------- admin ----------
  // A small Challenge card on /admin (views/challenge/partials/admin-summary.ejs).
  app.get('/admin', (req, res, next) => {
    if (req.user && ch.enabled()) {
      try {
        const st = ch.stats();
        res.locals.chAdmin = { total: st.total, late: st.late, started: st.started, finishers: st.finishers, hot: st.hot.length, phase: ch.phase(), checkins: st.checkins };
      } catch (err) { console.warn('[challenge] admin summary', err.message); }
    }
    next();
  });
  app.get('/admin/challenge', requireAuth, requireAdmin, (req, res) => {
    res.render('challenge/admin', {
      title: 'Challenge admin',
      s: ch.stats(),
      settings: ch.settings(),
      T: ch.times(),
      phase: ch.phase(),
      enabled: ch.enabled(),
      flag: ch.launchConsentFlag(),
      md,
      etDay: ch.etDay,
      etClock: ch.etClock,
      msg: req.session.chAdminMsg || null,
      listSet: !!process.env.KLAVIYO_CHALLENGE_LIST_ID,
      klaviyoOn: kl.on(),
      hot: ch.hotSeatCandidates(),
      hotSummary: ch.lastHotSeatSummary(),
      aiOn: !!process.env.ANTHROPIC_API_KEY,
    });
    req.session.chAdminMsg = null;
  });
  app.post('/admin/challenge/hotseat', requireAuth, requireAdmin, wrap(async (req, res) => {
    await ch.hotSeatSummary();
    res.redirect('/admin/challenge#hotseats');
  }));
  app.post('/admin/challenge/unfeature/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
    const ok = await ch.unfeature(req.params.id);
    req.session.chAdminMsg = ok ? 'Removed from features. Their check-ins stay; they just won\'t show up for hot seats.' : 'Not found.';
    res.redirect('/admin/challenge#hotseats');
  }));
  app.post('/admin/challenge/settings', requireAuth, requireAdmin, wrap(async (req, res) => {
    const bad = await ch.saveSettings(req.body || {});
    req.session.chAdminMsg = bad.length ? `Saved, except ${bad.join(', ')}: use a full https:// link or a /path on this site.` : 'Saved.';
    res.redirect('/admin/challenge#settings');
  }));
  app.post('/admin/challenge/backfill', requireAuth, requireAdmin, (req, res) => {
    ch.backfillJoinLinks().then((n) => console.log(`[challenge] join links sent for ${n} waitlist profiles`)).catch((err) => console.warn('[challenge] backfill', err.message));
    req.session.chAdminMsg = 'Sending one-tap join links to Klaviyo for everyone on the waitlist who is not in the challenge yet. This runs in the background.';
    res.redirect('/admin/challenge');
  });
  app.get('/admin/challenge.csv', requireAuth, requireAdmin, (req, res) => {
    res.set('content-type', 'text/csv').set('content-disposition', 'attachment; filename="127-day-one-challenge.csv"').send(ch.csv());
  });
};
