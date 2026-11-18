// Coach platform routes (prototype), behind COACH_PLATFORM (lib/coach). Mounted in server.js:
//
//   app.use(coachRoutes({ requireAuth, flash, createMember, limit, TOO_FAST }));
//
// The coach's side (127's look):
//   GET  /coach                         what it is, and the set-up form (makes an account too when signed out)
//   POST /coach/start                   create or upgrade to a coach: brand, web address, niche, offer
//   GET  /coach/dashboard               clients with adherence and last check-in, review queue, revenue (demo)
//   GET|POST /coach/brand               edit the brand; POST /coach/invite/rotate makes a new invite link
//   GET  /coach/clients/:id             one client: program, logs, check-ins; POST .../assign gives a program
//   GET  /coach/programs, /new, /:id    the program builder (weeks -> days -> exercises); POST saves
//   GET  /coach/review                  check-ins waiting; POST /coach/review/:id replies and marks reviewed
//   GET  /coach/challenges, /new, /:id  build a challenge (rules, mode, optional cohort layer), applications, board
//
// The coach's own brand (their colors, their name, no 127 nav):
//   GET  /c/:slug                       the coach's public site, offer and challenge call to action
//   GET  /c/:slug/manifest.webmanifest  the client app as an installable PWA in the coach's colors
//   GET|POST /c/:slug/join              client sign-up, tied to the coach (invite link, or open sign-up)
//   GET  /c/:slug/challenge/:c          a challenge's public page; POST .../start, .../apply, .../confirm
//   GET  /c/:slug/app                   the client app: today's workout and habits (POST /workout, /habits)
//   GET|POST /c/:slug/app/checkin       weekly check-in; POST /c/:slug/app/photo stores a photo (raw body)
//   GET  /c/:slug/app/progress          weight trend, sessions, check-in replies
//   GET  /c/:slug/app/challenge/:c      the daily checklist (POST .../day), /leaderboard, /card.svg, /journal.md
//   GET  /c/:slug/photo/:id             a photo, for the client who took it and their coach only
//
// Pages a client sees send a CSP with only 127's own files (as Life does, lib/life-routes.js): no pixels or analytics.

const express = require('express');
const coach = require('./coach');
const ch = require('./coach/challenge');
const imp = require('./coach/import');
const security = require('./security');

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'";
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function coachRoutes({ requireAuth, flash, createMember, limit = () => true, TOO_FAST = 'Too many tries.' }) {
  const r = express.Router();
  const say = (req, type, msg) => flash && flash(req, type, msg);

  // Off: every path falls through to the site's 404.
  r.use(['/coach', '/c'], (req, res, next) => (coach.visibleTo(req.user) ? next() : next('router')));

  const branded = (res, c) => {
    res.set('Content-Security-Policy', CSP);
    res.set('Cache-Control', 'no-store');
    Object.assign(res.locals, { plausible: null, trackEvents: [], adConsentScript: '', brand: c.brand, coachSite: c });
  };
  const needCoach = (req, res, next) => {
    if (!req.user) return requireAuth(req, res, next);
    const c = coach.coachFor(req.user);
    if (!c) return res.redirect('/coach');
    req.coach = c;
    res.locals.coach = c;
    res.locals.queueCount = coach.queue(c).length;
    res.locals.importOn = imp.visibleTo(req.user);
    res.set('Cache-Control', 'no-store');
    next();
  };
  const site = (req, res, next) => {
    const c = coach.bySlug(req.params.slug);
    if (!c) return next('router');
    req.site = c;
    branded(res, c);
    next();
  };
  // A client of this coach, signed in. Anyone else goes to this coach's join page (or sign-in).
  const client = (req, res, next) => {
    if (!req.user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    if (req.user.role !== 'client' || req.user.coachId !== req.site.id) {
      return res.status(403).render('coach/app/not-client', { title: 'Not your app', site: req.site, isOwner: req.user.id === req.site.id });
    }
    res.locals.tab = null;
    next();
  };
  const challengeOf = (req, res, next) => {
    const c = ch.forSlug(req.site, req.params.c);
    if (!c) return next('router');
    req.challenge = c;
    next();
  };

  // ================= coach side =================
  r.get('/coach', (req, res) => {
    const existing = coach.coachFor(req.user);
    if (existing) return res.redirect('/coach/dashboard');
    res.render('coach/start', { title: 'Coach on 127', error: null, form: {}, niches: coach.NICHE_IDS, nicheNames: coach.NICHE_NAMES, habits: coach.DEFAULT_HABITS });
  });

  r.post('/coach/start', wrap(async (req, res) => {
    const form = req.body;
    const again = (error) => res.status(400).render('coach/start', { title: 'Coach on 127', error, form, niches: coach.NICHE_IDS, nicheNames: coach.NICHE_NAMES, habits: coach.DEFAULT_HABITS });
    let user = req.user;
    if (user && user.role === 'client') return again('This account is a client account. Sign out and make a coach account.');
    if (!user) {
      if (!limit(req, res, `coach-signup:${security.ip(req)}`, 5, 60 * 60 * 1000, TOO_FAST)) return;
      const email = String(form.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return again('Please enter a valid email.');
      if (String(form.password || '').length < 8) return again('Use a password with at least 8 characters.');
      if (require('./db').find('users', (u) => u.email === email)) return again('That email already has an account. Sign in first, then come back here.');
      // Validate the brand before the account exists, so a bad web address doesn't leave a half-made coach.
      const slug = coach.slugify(form.slug || form.brandName);
      if (coach.bySlug(slug)) return again('That web address is taken.');
      user = await createMember(req, { email, name: coach.text(form.coachName, 80), password: String(form.password), optIn: form.optin === 'on', source: 'coach' });
    }
    const out = await coach.saveCoach(user, form);
    if (out.error) return again(out.error);
    say(req, 'win', 'Your coach space is ready. Share your invite link with your first client.');
    res.redirect('/coach/dashboard');
  }));

  r.get('/coach/dashboard', needCoach, (req, res) => {
    const d = coach.dashboard(req.coach);
    const challenges = ch.challengesOf(req.coach).map((c) => ({ c, entries: ch.entriesOf(c).filter((e) => e.status === 'active').length, apps: ch.applications(c).length }));
    res.render('coach/dashboard', { title: 'Dashboard', d, challenges, inviteUrl: `${res.locals.baseUrl || ''}/c/${req.coach.slug}/join?i=${req.coach.inviteToken}`, programs: coach.programsOf(req.coach) });
  });

  r.get('/coach/brand', needCoach, (req, res) => res.render('coach/brand', { title: 'Brand', error: null, form: null, niches: coach.NICHE_IDS, nicheNames: coach.NICHE_NAMES }));
  r.post('/coach/brand', needCoach, wrap(async (req, res) => {
    const out = await coach.saveCoach(req.user, req.body);
    if (out.error) return res.status(400).render('coach/brand', { title: 'Brand', error: out.error, form: req.body, niches: coach.NICHE_IDS, nicheNames: coach.NICHE_NAMES });
    say(req, 'win', 'Saved.');
    res.redirect('/coach/brand');
  }));
  r.post('/coach/brand/photo', needCoach, express.raw({ type: Object.keys(coach.PHOTO_TYPES), limit: coach.MAX_PHOTO }), wrap(async (req, res) => {
    const out = await coach.saveBrandPhoto(req.coach, String(req.get('content-type') || '').split(';')[0], Buffer.isBuffer(req.body) ? req.body : null);
    if (out.error) return res.status(400).json({ error: out.error });
    res.json({ id: out.id, url: `/c/${req.coach.slug}/brand-photo?v=${out.id.slice(-6)}` });
  }));
  r.post('/coach/invite/rotate', needCoach, wrap(async (req, res) => {
    await coach.rotateInvite(req.coach);
    say(req, 'info', 'New invite link made. The old one no longer works.');
    res.redirect('/coach/dashboard');
  }));

  const myClient = (req) => {
    const u = require('./db').get('users', String(req.params.id || ''));
    return u && u.role === 'client' && u.coachId === req.coach.id ? u : null;
  };
  r.get('/coach/clients/:id', needCoach, (req, res, next) => {
    const u = myClient(req);
    if (!u) return next();
    const key = coach.dateKey();
    const days = Array.from({ length: 14 }, (_, i) => coach.addDays(key, i - 13)).map((k) => ({ k, label: coach.shortDate(k), s: coach.sessionOn(u, k), w: coach.workoutLog(u, k), h: coach.habitLog(u, k) }));
    res.render('coach/client', {
      title: u.name || 'Client', cl: u, row: coach.clientRow(u, req.coach), days, checkins: coach.checkinsOf(u),
      programs: coach.programsOf(req.coach), assignment: coach.assignmentOf(u), today: key,
      spark: coach.sparkSvg(coach.weightSeries(u), { color: req.coach.brand.accent }),
    });
  });
  r.post('/coach/clients/:id/assign', needCoach, wrap(async (req, res, next) => {
    const u = myClient(req);
    if (!u) return next();
    const out = await coach.assign(req.coach, u, req.body.programId, req.body.start);
    say(req, out.error ? 'error' : 'win', out.error || 'Program assigned. It shows in their app from the start date.');
    res.redirect(`/coach/clients/${u.id}`);
  }));

  r.get('/coach/programs', needCoach, (req, res) => {
    const assigned = (p) => require('./db').filter(coach.ASSIGN, (a) => a.programId === p.id).length;
    res.render('coach/programs', { title: 'Programs', programs: coach.programsOf(req.coach).map((p) => ({ p, assigned: assigned(p) })) });
  });
  const blankProgram = () => ({ name: '', goal: '', weeks: [{ days: [{ title: 'Day 1', exercises: [{ name: '', sets: 3, reps: '8-10', rest: '90s', note: '' }] }] }] });
  r.get('/coach/programs/new', needCoach, (req, res) => res.render('coach/program-edit', { title: 'New program', program: blankProgram(), error: null, exercises: coach.exerciseNames(), clients: [] }));
  r.get('/coach/programs/:id', needCoach, (req, res, next) => {
    const p = coach.program(req.coach, req.params.id);
    if (!p) return next();
    res.render('coach/program-edit', { title: p.name, program: p, error: null, exercises: coach.exerciseNames(), clients: coach.clientsOf(req.coach) });
  });
  const saveProgram = (id) => wrap(async (req, res, next) => {
    if (id && !coach.program(req.coach, req.params.id)) return next();
    const out = await coach.saveProgram(req.coach, id ? req.params.id : null, req.body);
    if (out.error) return res.status(400).render('coach/program-edit', { title: 'Program', program: { ...blankProgram(), ...req.body, weeks: coach.cleanWeeks(req.body.weeks).length ? coach.cleanWeeks(req.body.weeks) : blankProgram().weeks, id: id ? req.params.id : null }, error: out.error, exercises: coach.exerciseNames(), clients: [] });
    say(req, 'win', 'Program saved.');
    res.redirect(`/coach/programs/${out.program.id}`);
  });
  r.post('/coach/programs', needCoach, saveProgram(false));
  r.post('/coach/programs/:id', needCoach, saveProgram(true));
  r.post('/coach/programs/:id/assign', needCoach, wrap(async (req, res, next) => {
    const p = coach.program(req.coach, req.params.id);
    if (!p) return next();
    req.params.id = String(req.body.clientId || '');
    const u = myClient(req);
    const out = u ? await coach.assign(req.coach, u, p.id, req.body.start) : { error: 'Pick one of your clients.' };
    say(req, out.error ? 'error' : 'win', out.error || `Assigned to ${u.name}.`);
    res.redirect(`/coach/programs/${p.id}`);
  }));

  // Import (COACH_IMPORT): reviews and programs from a CSV, previewed before anything is saved.
  const importOn = (req, res, next) => (imp.visibleTo(req.user) ? next() : next('router'));
  const TEMPLATES = {
    reviews: 'Name,Review,Rating,Result\nJordan K.,"Down 18 lb in 12 weeks and I finally like training. The weekly check-ins kept me honest.",5,Lost 18 lb\nPriya S.,"Best coaching I have paid for. The app makes it easy to log every session.",5,First pull-up\n',
    programs: 'Program,Week,Day,Exercise,Sets,Reps,Rest,Notes\nStrength 4-Day,1,Lower A,Back Squat,4,5,3m,RPE 8\nStrength 4-Day,1,Lower A,Romanian Deadlift,3,8,2m,\nStrength 4-Day,1,Upper A,Bench Press,4,6,2m,\nStrength 4-Day,1,Upper A,Barbell Row,4,8,90,\n',
  };
  r.get('/coach/import', needCoach, importOn, (req, res) => res.render('coach/import', { title: 'Import', step: 'pick', kind: req.query.kind === 'programs' ? 'programs' : 'reviews', error: null, out: null, csv: '', filename: '' }));
  r.get('/coach/import/template/:kind.csv', needCoach, importOn, (req, res, next) => {
    const t = TEMPLATES[req.params.kind];
    if (!t) return next();
    res.attachment(`127-${req.params.kind}-template.csv`).type('text/csv').send(t);
  });
  r.post('/coach/import/preview', needCoach, importOn, (req, res) => {
    const csv = String(req.body.csv || ''), filename = coach.text(req.body.filename, 120), kind = req.body.kind;
    const out = imp.read(csv, { kind, filename });
    if (out.error) return res.status(400).render('coach/import', { title: 'Import', step: 'pick', kind: kind === 'programs' ? 'programs' : 'reviews', error: out.error, out: null, csv, filename });
    res.render('coach/import', { title: 'Check your import', step: 'preview', kind: out.kind, error: null, out, csv, filename });
  });
  r.post('/coach/import/save', needCoach, importOn, wrap(async (req, res) => {
    const csv = String(req.body.csv || ''), filename = coach.text(req.body.filename, 120);
    const out = imp.read(csv, { kind: req.body.kind, filename });
    if (out.error) return res.status(400).render('coach/import', { title: 'Import', step: 'pick', kind: 'reviews', error: out.error, out: null, csv, filename });
    if (out.kind === 'reviews') {
      if (req.body.consent !== 'on') return res.status(400).render('coach/import', { title: 'Check your import', step: 'preview', kind: out.kind, error: 'Tick the box to confirm these are real reviews you may share.', out, csv, filename });
      const done = await imp.saveReviews(req.coach, out.items);
      say(req, 'win', `${done.count} ${done.count === 1 ? 'review is' : 'reviews are'} on your site now.`);
      return res.redirect('/coach/import?done=reviews');
    }
    const done = await imp.savePrograms(req.coach, out.items);
    say(req, 'win', `${done.count} ${done.count === 1 ? 'program' : 'programs'} imported. Check them, then assign to clients.`);
    res.redirect(done.programs.length === 1 ? `/coach/programs/${done.programs[0].id}` : '/coach/programs');
  }));

  r.get('/coach/review', needCoach, (req, res) => {
    const db = require('./db');
    const items = coach.queue(req.coach).map((c) => {
      const u = db.get('users', c.clientId);
      const prev = coach.checkinsOf(u).find((x) => x.date < c.date) || null;
      return { c, client: u, prev, row: coach.clientRow(u, req.coach) };
    });
    const done = db.filter(coach.CHECKINS, (c) => c.coachId === req.coach.id && c.reviewedAt).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).slice(0, 8).map((c) => ({ c, client: db.get('users', c.clientId) }));
    res.render('coach/review', { title: 'Check-ins', items, done });
  });
  r.post('/coach/review/:id', needCoach, wrap(async (req, res) => {
    const out = await coach.review(req.coach, req.params.id, req.body.reply);
    say(req, out.error ? 'error' : 'win', out.error || 'Reply sent to their app.');
    res.redirect('/coach/review');
  }));

  // ---- challenges (coach side) ----
  r.get('/coach/challenges', needCoach, (req, res) => {
    res.render('coach/challenges', { title: 'Challenges', list: ch.challengesOf(req.coach).map((c) => ({ c, active: ch.entriesOf(c).filter((e) => e.status === 'active').length, apps: ch.applications(c).length, seats: ch.seatsTaken(c) })) });
  });
  const blankChallenge = () => ({ name: '', tagline: '', days: 50, mode: 'restart', rules: ch.TEMPLATE_RULES, pointsPerRule: 10, fullDayBonus: 20, price: 0, cohort: { on: false, name: 'The Founding Cohort', startDate: coach.addDays(coach.dateKey(), 7), capacity: 25, price: 0, questions: ['Why do you want in?', 'What will you have changed by day 50?'], perks: [] } });
  // Turns a posted form back into the shape the editor draws (after an error).
  const fromForm = (b) => ({ ...blankChallenge(), ...b, rules: coach.list(b.rules), cohort: { on: b.cohortOn === 'on', name: b.cohortName, startDate: b.cohortStart, capacity: b.capacity, price: b.cohortPrice, questions: String(b.questions || '').split('\n'), perks: String(b.perks || '').split('\n') } });
  r.get('/coach/challenges/new', needCoach, (req, res) => res.render('coach/challenge-edit', { title: 'New challenge', c: blankChallenge(), error: null, isNew: true }));
  r.post('/coach/challenges', needCoach, wrap(async (req, res) => {
    const out = await ch.save(req.coach, null, req.body);
    if (out.error) return res.status(400).render('coach/challenge-edit', { title: 'New challenge', c: fromForm(req.body), error: out.error, isNew: true });
    say(req, 'win', 'Challenge is live. Share its page.');
    res.redirect(`/coach/challenges/${out.challenge.id}`);
  }));
  r.get('/coach/challenges/:id', needCoach, (req, res, next) => {
    const c = ch.mine(req.coach, req.params.id);
    if (!c) return next();
    const db = require('./db');
    const apps = ch.applications(c).map((e) => ({ e, user: db.get('users', e.userId) }));
    res.render('coach/challenge', {
      title: c.name, c, apps, board: ch.leaderboard(c), openBoard: c.cohort.on ? ch.leaderboard(c, undefined, { track: 'open' }) : null,
      seatsTaken: ch.seatsTaken(c), seatsLeft: ch.seatsLeft(c), approved: ch.entriesOf(c).filter((e) => e.track === 'cohort' && e.status === 'approved').map((e) => ({ e, user: db.get('users', e.userId) })),
      revenue: ch.entriesOf(c).filter((e) => e.payment).reduce((a, e) => a + e.payment.net, 0),
      publicUrl: `/c/${req.coach.slug}/challenge/${c.slug}`,
    });
  });
  r.get('/coach/challenges/:id/edit', needCoach, (req, res, next) => {
    const c = ch.mine(req.coach, req.params.id);
    if (!c) return next();
    res.render('coach/challenge-edit', { title: `Edit ${c.name}`, c, error: null, isNew: false });
  });
  r.post('/coach/challenges/:id', needCoach, wrap(async (req, res, next) => {
    if (!ch.mine(req.coach, req.params.id)) return next();
    if (req.body.status) {
      await ch.setStatus(req.coach, req.params.id, req.body.status);
      return res.redirect(`/coach/challenges/${req.params.id}`);
    }
    const out = await ch.save(req.coach, req.params.id, req.body);
    if (out.error) return res.status(400).render('coach/challenge-edit', { title: 'Edit challenge', c: { ...fromForm(req.body), id: req.params.id }, error: out.error, isNew: false });
    say(req, 'win', 'Saved.');
    res.redirect(`/coach/challenges/${req.params.id}`);
  }));
  r.post('/coach/challenges/:id/decide/:entry', needCoach, wrap(async (req, res) => {
    const out = await ch.decide(req.coach, req.params.entry, req.body.action === 'approve' ? 'approve' : 'decline');
    say(req, out.error ? 'error' : 'win', out.error || (req.body.action === 'approve' ? 'Approved. They can confirm their seat from their app.' : 'Declined.'));
    res.redirect(`/coach/challenges/${req.params.id}`);
  }));

  // ================= the coach's brand =================
  r.get('/c/:slug', site, (req, res) => {
    const c = req.site;
    res.render('coach/site', { title: c.brand.name, c, reviews: (c.reviews || []).slice(0, 12), copy: coach.nicheCopy(), nicheName: coach.NICHE_NAMES[c.niche], challenges: ch.live(c), programs: coach.programsOf(c).length, clientCount: coach.clientsOf(c).length });
  });

  r.get('/c/:slug/manifest.webmanifest', site, (req, res) => {
    const c = req.site;
    res.type('application/manifest+json').send(JSON.stringify({
      name: c.brand.name, short_name: c.brand.name.slice(0, 12), start_url: `/c/${c.slug}/app`, scope: `/c/${c.slug}/`, display: 'standalone',
      background_color: '#0b0b0e', theme_color: c.brand.accent,
      icons: [{ src: `/c/${c.slug}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    }));
  });
  r.get('/c/:slug/icon.svg', site, (req, res) => {
    const c = req.site;
    res.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${c.brand.accent}"/><text x="256" y="320" font-family="Helvetica, Arial, sans-serif" font-size="200" font-weight="800" text-anchor="middle" fill="#0b0b0e">${c.brand.initials.replace(/[^A-Z0-9]/g, '')}</text></svg>`);
  });

  r.get('/c/:slug/join', site, (req, res) => {
    const c = req.site;
    const ok = coach.inviteOk(c, req.query.i);
    if (req.user && req.user.role === 'client' && req.user.coachId === c.id) return res.redirect(security.safeNext(req.query.next, `/c/${c.slug}/app`));
    res.render('coach/app/join', { title: `Join ${c.brand.name}`, c, ok, invite: String(req.query.i || ''), next: security.safeNext(req.query.next, `/c/${c.slug}/app`), error: null, form: {} });
  });
  r.post('/c/:slug/join', site, wrap(async (req, res) => {
    const c = req.site;
    const form = req.body;
    const next = security.safeNext(form.next, `/c/${c.slug}/app`);
    const again = (error, code = 400) => res.status(code).render('coach/app/join', { title: `Join ${c.brand.name}`, c, ok: coach.inviteOk(c, form.i), invite: String(form.i || ''), next, error, form });
    if (!coach.inviteOk(c, form.i)) return again('Ask your coach for a new invite link.', 403);
    if (!limit(req, res, `coach-join:${security.ip(req)}`, 10, 60 * 60 * 1000, TOO_FAST)) return;
    const email = String(form.email || '').trim().toLowerCase();
    const name = coach.text(form.name, 80);
    if (name.length < 2) return again('Add your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return again('Please enter a valid email.');
    if (String(form.password || '').length < 8) return again('Use a password with at least 8 characters.');
    // Health data (Legal): the prototype asks for an explicit OK before anything is stored. Wording is a placeholder.
    if (form.consent !== 'on') return again('Tick the box so your coach can see what you log.');
    if (require('./db').find('users', (u) => u.email === email)) return again('That email already has an account. Sign in instead.');
    const user = await createMember(req, { email, name, password: String(form.password), optIn: false, source: `coach:${c.slug}` });
    user.role = 'client';
    user.coachId = c.id;
    user.healthConsent = { at: new Date().toISOString(), version: 'prototype-placeholder', coachId: c.id };
    await require('./db').save('users', user);
    res.redirect(next);
  }));

  r.get('/c/:slug/challenge/:c', site, challengeOf, (req, res) => {
    const c = req.challenge;
    const e = ch.entryFor(c, req.user);
    res.render('coach/challenge-public', { title: c.name, site: req.site, c, e, seatsLeft: ch.seatsLeft(c), isClient: !!(req.user && req.user.role === 'client' && req.user.coachId === req.site.id), board: c.cohort.on ? ch.leaderboard(c).slice(0, 5) : [] });
  });
  const joinFirst = (req, res) => res.redirect(`/c/${req.site.slug}/join?next=${encodeURIComponent(`/c/${req.site.slug}/challenge/${req.challenge.slug}`)}${req.site.openSignup ? '' : ''}`);
  r.post('/c/:slug/challenge/:c/start', site, challengeOf, wrap(async (req, res) => {
    if (!req.user || req.user.role !== 'client' || req.user.coachId !== req.site.id) return joinFirst(req, res);
    const out = await ch.start(req.challenge, req.user);
    if (out.error) say(req, 'error', out.error);
    res.redirect(`/c/${req.site.slug}/app/challenge/${req.challenge.slug}`);
  }));
  r.post('/c/:slug/challenge/:c/apply', site, challengeOf, wrap(async (req, res) => {
    if (!req.user || req.user.role !== 'client' || req.user.coachId !== req.site.id) return joinFirst(req, res);
    const out = await ch.apply(req.challenge, req.user, req.body);
    if (out.error) say(req, 'error', out.error);
    else say(req, 'win', 'Application in. Your coach reviews every one.');
    res.redirect(`/c/${req.site.slug}/challenge/${req.challenge.slug}`);
  }));
  r.post('/c/:slug/challenge/:c/confirm', site, challengeOf, client, wrap(async (req, res) => {
    const out = await ch.confirmSeat(req.challenge, req.user);
    if (out.error) say(req, 'error', out.error);
    res.redirect(`/c/${req.site.slug}/app/challenge/${req.challenge.slug}`);
  }));

  // ---- the client app ----
  const appLocals = (req, extra) => {
    const c = req.site;
    const mine = ch.challengesOf(c).map((x) => ({ x, e: ch.entryFor(x, req.user) })).filter((y) => y.e && y.e.status === 'active');
    return { c, me: req.user, myChallenges: mine, ...extra };
  };
  r.get('/c/:slug/app', site, client, (req, res) => {
    const key = coach.dateKey();
    const s = coach.sessionOn(req.user, key);
    const loc = appLocals(req, { tab: 'today', today: key, s, log: coach.workoutLog(req.user, key), habits: coach.habitLog(req.user, key) });
    loc.challengeCards = loc.myChallenges.map(({ x, e }) => ({ x, st: ch.state(x, e, key) }));
    loc.lastReply = coach.checkinsOf(req.user).find((x) => x.reply) || null;
    loc.dueCheckin = !coach.checkinsOf(req.user).some((x) => coach.daysBetween(x.date, key) < 7);
    res.render('coach/app/today', { title: 'Today', ...loc });
  });
  r.post('/c/:slug/app/workout', site, client, wrap(async (req, res) => {
    const out = await coach.logWorkout(req.user, req.body);
    say(req, out.error ? 'error' : 'win', out.error || 'Session logged. Your coach can see it.');
    res.redirect(`/c/${req.site.slug}/app#workout`);
  }));
  r.post('/c/:slug/app/habits', site, client, wrap(async (req, res) => {
    await coach.logHabits(req.user, req.site, req.body);
    res.redirect(`/c/${req.site.slug}/app#habits`);
  }));
  r.get('/c/:slug/app/checkin', site, client, (req, res) => {
    res.render('coach/app/checkin', { title: 'Check-in', ...appLocals(req, { tab: 'checkin', error: null, last: coach.checkinsOf(req.user)[0] || null }) });
  });
  r.post('/c/:slug/app/checkin', site, client, wrap(async (req, res) => {
    const out = await coach.submitCheckin(req.user, req.body);
    if (out.error) return res.status(400).render('coach/app/checkin', { title: 'Check-in', ...appLocals(req, { tab: 'checkin', error: out.error, last: coach.checkinsOf(req.user)[0] || null }) });
    say(req, 'win', 'Check-in sent. Your coach replies here.');
    res.redirect(`/c/${req.site.slug}/app/progress`);
  }));
  r.post('/c/:slug/app/photo', site, client, express.raw({ type: Object.keys(coach.PHOTO_TYPES), limit: coach.MAX_PHOTO }), wrap(async (req, res) => {
    if (!limit(req, res, `coach-photo:${req.user.id}`, 40, 60 * 60 * 1000, TOO_FAST)) return;
    const out = await coach.savePhoto(req.user, String(req.get('content-type') || '').split(';')[0], Buffer.isBuffer(req.body) ? req.body : null);
    if (out.error) return res.status(400).json({ error: out.error });
    res.json({ id: out.id, url: `/c/${req.site.slug}/photo/${out.id}` });
  }));
  r.get('/c/:slug/app/progress', site, client, (req, res) => {
    const db = require('./db');
    const logs = db.filter(coach.WLOGS, (l) => l.clientId === req.user.id && l.complete).sort((a, b) => b.date.localeCompare(a.date));
    res.render('coach/app/progress', { title: 'Progress', ...appLocals(req, { tab: 'progress', checkins: coach.checkinsOf(req.user), logs, spark: coach.sparkSvg(coach.weightSeries(req.user), { color: req.site.brand.accent }), ad: coach.adherence(req.user, req.site) }) });
  });

  r.get('/c/:slug/app/challenge/:c', site, challengeOf, client, (req, res) => {
    const e = ch.entryFor(req.challenge, req.user);
    if (!e || !['active', 'finished'].includes(e.status)) return res.redirect(`/c/${req.site.slug}/challenge/${req.challenge.slug}`);
    const st = ch.state(req.challenge, e);
    res.render('coach/app/challenge', { title: req.challenge.name, ...appLocals(req, { tab: 'challenge', x: req.challenge, e, st, day: e.days[st.todayKey] || { done: {}, proof: {} } }) });
  });
  r.post('/c/:slug/app/challenge/:c/day', site, challengeOf, client, wrap(async (req, res) => {
    const e = ch.entryFor(req.challenge, req.user);
    const out = e ? await ch.checkIn(req.challenge, e, req.user, req.body) : { error: 'Start the challenge first.' };
    if (out.error) say(req, 'error', out.error);
    else if (ch.dayDone(req.challenge, out.day)) say(req, 'win', 'Every rule done today. Day banked.');
    res.redirect(`/c/${req.site.slug}/app/challenge/${req.challenge.slug}`);
  }));
  r.get('/c/:slug/app/challenge/:c/leaderboard', site, challengeOf, client, (req, res) => {
    const board = ch.leaderboard(req.challenge);
    res.render('coach/app/leaderboard', { title: 'Leaderboard', ...appLocals(req, { tab: 'challenge', x: req.challenge, board, myId: req.user.id }) });
  });
  r.get('/c/:slug/app/challenge/:c/card.svg', site, challengeOf, client, (req, res, next) => {
    const e = ch.entryFor(req.challenge, req.user);
    if (!e) return next();
    res.type('image/svg+xml').set('Content-Disposition', `inline; filename="${req.challenge.slug}-day.svg"`).send(ch.shareCard(req.challenge, req.site, ch.state(req.challenge, e), { name: req.query.name === '1' ? req.user.name : null }));
  });
  r.get('/c/:slug/app/challenge/:c/journal.md', site, challengeOf, client, (req, res, next) => {
    const e = ch.entryFor(req.challenge, req.user);
    if (!e) return next();
    res.type('text/markdown').set('Content-Disposition', `attachment; filename="${req.challenge.slug}-journal.md"`).send(ch.journal(req.challenge, req.site, e, req.user.name));
  });

  // Photos: the client who uploaded it, or their coach. Never public.
  // The coach's portrait or logo: public, it is on their site and app.
  r.get('/c/:slug/brand-photo', site, wrap(async (req, res, next) => {
    const b = req.site.brand;
    const buf = b.photo ? await require('./db').getBlob(b.photo) : null;
    if (!buf) return next();
    res.set('Cache-Control', 'public, max-age=86400').type(b.photoType || 'image/jpeg').send(buf);
  }));
  r.get('/c/:slug/photo/:id', site, wrap(async (req, res, next) => {
    const owner = coach.photoOwner(req.params.id);
    if (!owner || !req.user || owner.coachId !== req.site.id || (req.user.id !== owner.id && req.user.id !== req.site.id)) return next();
    const buf = await require('./db').getBlob(req.params.id);
    if (!buf) return next();
    res.set('Cache-Control', 'private, max-age=3600').type(owner.coachPhotos[req.params.id]).send(buf);
  }));

  return r;
}

module.exports = coachRoutes;
