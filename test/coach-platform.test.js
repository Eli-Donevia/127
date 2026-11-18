// The coach platform prototype (lib/coach, lib/coach/challenge.js, lib/coach-platform-routes.js, views/coach): the
// COACH_PLATFORM switch, coach set-up and the public site, client sign-up under a coach (invite, consent), who can
// open whose app, the program builder and assignment, today's session and logging, check-ins with photos and the
// review queue, the dashboard, and the challenge engine: daily rules with proof, restart-on-miss vs points, streaks,
// the calendar, the cohort layer (apply, capped approval, demo payment), the leaderboard, share card and journal.
// No network, Stripe or email.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-coach-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-coach-${process.pid}`);
process.env.COACH_TZ = 'UTC';
delete process.env.COACH_FEE_PCT;

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const coach = require('../lib/coach');
const chl = require('../lib/coach/challenge');
const coachRoutes = require('../lib/coach-platform-routes');

let seq = 0;
const member = (extra = {}) => db.save('users', { id: `co${++seq}`, email: `co${seq}@127.test`, name: `Alex Reed${seq}`, tier: 'free', emailVerified: true, ...extra });
// Fixed clock: Monday Nov 16, 2026, noon UTC.
let today = '2026-11-16';
const at = (key) => { today = key; coach._setNow(() => Date.parse(`${key}T12:00:00Z`)); };

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    req.session = {};
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    Object.assign(res.locals, { user: req.user, path: req.path, flash: null, baseUrl: 'https://127.test' });
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const createMember = async (req, { email, name }) => {
    const u = await db.save('users', { email, name, tier: 'free', emailVerified: false });
    req.user = u;
    return u;
  };
  app.use(coachRoutes({ requireAuth, flash: () => {}, createMember }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, raw, type } = {}) => {
    const h = {};
    if (as) h['x-user'] = as.id;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    if (raw) { body = raw; h['content-type'] = type; }
    return fetch(url + p, { method: body !== undefined ? 'POST' : 'GET', headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex');
const BRAND = { brandName: 'Forge Hybrid', coachName: 'Dana Cole', slug: 'forge-hybrid', accent: '#ff5a36', niche: 'hybrid', headline: 'Strong and lean, coached from your phone.', offerPrice: '199', habits: 'Protein\nSteps' };
const PROGRAM = {
  name: 'Hybrid 2-Day', goal: 'Strength',
  'weeks[0][days][0][title]': 'Lower', 'weeks[0][days][0][exercises][0][name]': 'Barbell Squat', 'weeks[0][days][0][exercises][0][sets]': '3', 'weeks[0][days][0][exercises][0][reps]': '5',
  'weeks[0][days][0][exercises][1][name]': 'Romanian Deadlift', 'weeks[0][days][0][exercises][1][sets]': '2', 'weeks[0][days][0][exercises][1][reps]': '8',
  'weeks[0][days][1][title]': 'Upper', 'weeks[0][days][1][exercises][0][name]': 'Bench Press', 'weeks[0][days][1][exercises][0][sets]': '3', 'weeks[0][days][1][exercises][0][reps]': '6',
  'weeks[0][days][2][title]': 'Empty day is dropped',
};

let s;
test.before(async () => {
  await db.init();
  s = await server();
});
test.after(async () => {
  await s.close();
  coach._setNow(null);
  if (fs.existsSync(process.env.DB_FILE)) fs.rmSync(process.env.DB_FILE);
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});
test.beforeEach(() => {
  process.env.COACH_PLATFORM = 'on';
  at('2026-11-16');
});

// shared fixtures, built by the tests in order
let cu, theCoach, cl, other;

test('COACH_PLATFORM: off is a 404 for every coach and client page', async () => {
  process.env.COACH_PLATFORM = 'off';
  for (const p of ['/coach', '/coach/dashboard', '/c/anyone', '/c/anyone/app']) assert.equal((await s.go(p)).status, 404, p);
  assert.equal(coach.visibleTo(null), false);
});

test('coach set-up: a signed-in member becomes a coach and gets a branded public site', async () => {
  cu = await member({ name: 'Dana Cole' });
  const r = await s.go('/coach/start', { as: cu, form: BRAND });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/coach/dashboard');
  theCoach = coach.coachFor(db.get('users', cu.id));
  assert.equal(theCoach.slug, 'forge-hybrid');
  assert.equal(theCoach.brand.initials, 'FH');
  assert.deepEqual(theCoach.habits, ['Protein', 'Steps']);
  assert.equal(db.get('users', cu.id).role, 'coach');
  const site = await s.go('/c/forge-hybrid');
  assert.equal(site.status, 200);
  const html = await site.text();
  assert.match(html, /Forge Hybrid/);
  assert.match(html, /--accent: #ff5a36/);
  assert.match(site.headers.get('content-security-policy'), /default-src 'self'/);
  const mf = await (await s.go('/c/forge-hybrid/manifest.webmanifest')).json();
  assert.equal(mf.theme_color, '#ff5a36');
  assert.equal(mf.start_url, '/c/forge-hybrid/app');
  // the web address is one per coach
  const two = await member();
  const taken = await s.go('/coach/start', { as: two, form: BRAND });
  assert.equal(taken.status, 400);
  assert.match(await taken.text(), /That web address is taken/);
  // signed out: makes the account too
  const fresh = await s.go('/coach/start', { form: { ...BRAND, slug: 'iron-and-oak', brandName: 'Iron and Oak', email: 'new-coach@127.test', password: 'longenough' } });
  assert.equal(fresh.status, 302);
  assert.ok(coach.bySlug('iron-and-oak'));
});

test('brand: the look and the coach photo carry into their app and site; a bad file is refused', async () => {
  const saved = await s.go('/coach/brand', { as: cu, form: { ...BRAND, look: 'editorial' } });
  assert.equal(saved.status, 302);
  assert.equal(coach.coachFor(db.get('users', cu.id)).brand.look, 'editorial');
  const odd = await s.go('/coach/brand', { as: cu, form: { ...BRAND, look: 'neon' } });
  assert.equal(odd.status, 302);
  assert.equal(coach.coachFor(db.get('users', cu.id)).brand.look, 'editorial', 'an unknown look keeps the old one');
  assert.match(await (await s.go('/c/forge-hybrid')).text(), /data-look="editorial"/);
  assert.equal((await s.go('/c/forge-hybrid/brand-photo')).status, 404);
  const bad = await s.go('/coach/brand/photo', { as: cu, raw: Buffer.from('not a png'), type: 'image/png' });
  assert.equal(bad.status, 400);
  const other = await member();
  assert.equal((await s.go('/coach/brand/photo', { as: other, raw: PNG, type: 'image/png' })).status, 302, 'not a coach');
  const up = await s.go('/coach/brand/photo', { as: cu, raw: PNG, type: 'image/png' });
  assert.equal(up.status, 200);
  const first = (await up.json()).id;
  const img = await s.go('/c/forge-hybrid/brand-photo');
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  await s.go('/coach/brand/photo', { as: cu, raw: PNG, type: 'image/png' });
  assert.equal(await db.getBlob(first), null, 'the old photo is removed');
  // saving the brand form keeps the photo
  await s.go('/coach/brand', { as: cu, form: { ...BRAND, look: 'athletic' } });
  assert.ok(coach.coachFor(db.get('users', cu.id)).brand.photo);
});

test('client sign-up: invite link and consent required; the client is tied to the coach', async () => {
  const form = { name: 'Maya Rodriguez', email: 'maya@127.test', password: 'longenough', consent: 'on' };
  assert.equal((await s.go('/c/forge-hybrid/join', { form: { ...form, i: 'wrong' } })).status, 403);
  const noConsent = await s.go('/c/forge-hybrid/join', { form: { ...form, consent: '', i: theCoach.inviteToken } });
  assert.equal(noConsent.status, 400);
  const ok = await s.go('/c/forge-hybrid/join', { form: { ...form, i: theCoach.inviteToken } });
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get('location'), '/c/forge-hybrid/app');
  cl = db.find('users', (u) => u.email === 'maya@127.test');
  assert.equal(cl.role, 'client');
  assert.equal(cl.coachId, theCoach.id);
  assert.ok(cl.healthConsent && cl.healthConsent.at);
  // a new invite link retires the old one
  const old = theCoach.inviteToken;
  await s.go('/coach/invite/rotate', { as: cu, form: {} });
  assert.notEqual(coach.coachFor(cu).inviteToken, old);
  assert.equal(coach.inviteOk(coach.coachFor(cu), old), false);
});

test('who opens what: the client app is for this coach\'s clients; coach pages for the coach', async () => {
  other = await member();
  assert.equal((await s.go('/c/forge-hybrid/app', { as: cl })).status, 200);
  assert.equal((await s.go('/c/forge-hybrid/app', { as: other })).status, 403);
  assert.equal((await s.go('/c/forge-hybrid/app', { as: cu })).status, 403, 'the coach sees a pointer to the dashboard, not a client app');
  assert.equal((await s.go('/c/forge-hybrid/app')).status, 302);
  assert.equal((await s.go('/coach/dashboard', { as: other })).headers.get('location'), '/coach');
  assert.equal((await s.go('/coach/dashboard', { as: cu })).status, 200);
  // another coach can't open this coach's client
  const oak = db.find('users', (u) => u.email === 'new-coach@127.test');
  assert.equal((await s.go(`/coach/clients/${cl.id}`, { as: oak })).status, 404);
  assert.equal((await s.go(`/coach/clients/${cl.id}`, { as: cu })).status, 200);
});

test('program builder: nested weeks/days/exercises save, assign, and show as today\'s session', async () => {
  assert.equal((await s.go('/coach/programs/new', { as: cu })).status, 200);
  const r = await s.go('/coach/programs', { as: cu, form: PROGRAM });
  assert.equal(r.status, 302);
  const p = coach.programsOf(theCoach)[0];
  assert.equal(p.name, 'Hybrid 2-Day');
  assert.equal(p.weeks.length, 1);
  assert.equal(p.weeks[0].days.length, 2, 'a day with no exercises is dropped');
  assert.deepEqual(p.weeks[0].days[0].exercises.map((e) => [e.name, e.sets, e.reps]), [['Barbell Squat', 3, '5'], ['Romanian Deadlift', 2, '8']]);
  assert.equal((await s.go('/coach/programs', { as: cu, form: { name: 'Empty' } })).status, 400);
  const oak = db.find('users', (u) => u.email === 'new-coach@127.test');
  assert.equal((await s.go(`/coach/programs/${p.id}`, { as: oak })).status, 404);
  // assign from Monday: 2 days a week land Mon and Thu
  const a = await s.go(`/coach/programs/${p.id}/assign`, { as: cu, form: { clientId: cl.id, start: '2026-11-16' } });
  assert.equal(a.status, 302);
  assert.deepEqual(coach.assignmentOf(cl).trainingDays, [1, 4]);
  assert.equal(coach.sessionOn(cl, '2026-11-16').day.title, 'Lower');
  assert.equal(coach.sessionOn(cl, '2026-11-17').rest, true);
  assert.equal(coach.sessionOn(cl, '2026-11-19').day.title, 'Upper');
  const app = await (await s.go('/c/forge-hybrid/app', { as: cl })).text();
  assert.match(app, /Lower/);
  assert.match(app, /Barbell Squat/);
  // log the session and tick a habit
  const log = await s.go('/c/forge-hybrid/app/workout', { as: cl, form: { 'sets[0][0][weight]': '135', 'sets[0][0][reps]': '5', 'sets[0][0][done]': 'on', complete: 'on' } });
  assert.equal(log.status, 302);
  const w = coach.workoutLog(cl, '2026-11-16');
  assert.equal(w.complete, true);
  assert.deepEqual(w.exercises[0].sets[0], { weight: 135, reps: 5, done: true });
  await s.go('/c/forge-hybrid/app/habits', { as: cl, form: { h0: 'on' } });
  assert.deepEqual(coach.habitLog(cl, '2026-11-16').done, ['Protein']);
  const ad = coach.adherence(cl, theCoach, '2026-11-16');
  assert.equal(ad.scheduled, 1);
  assert.equal(ad.done, 1);
  assert.ok(ad.pct > 0 && ad.pct <= 100);
  // nothing to log on a rest day
  at('2026-11-17');
  assert.match((await coach.logWorkout(cl, {})).error, /No session/);
});

let photoId;
test('check-ins: photos stored as blobs (type checked), the review queue, the coach\'s reply', async () => {
  const bad = await s.go('/c/forge-hybrid/app/photo', { as: cl, raw: Buffer.from('not an image'), type: 'image/png' });
  assert.equal(bad.status, 400);
  const up = await s.go('/c/forge-hybrid/app/photo', { as: cl, raw: PNG, type: 'image/png' });
  assert.equal(up.status, 200);
  photoId = (await up.json()).id;
  assert.ok(await db.getBlob(photoId));
  // only the client and their coach can see it
  assert.equal((await s.go(`/c/forge-hybrid/photo/${photoId}`, { as: cl })).status, 200);
  assert.equal((await s.go(`/c/forge-hybrid/photo/${photoId}`, { as: cu })).status, 200);
  assert.equal((await s.go(`/c/forge-hybrid/photo/${photoId}`, { as: other })).status, 404);
  assert.equal((await s.go(`/c/forge-hybrid/photo/${photoId}`)).status, 404);
  assert.equal((await s.go('/c/forge-hybrid/app/checkin', { as: cl, form: { weight: '' } })).status, 400);
  const sent = await s.go('/c/forge-hybrid/app/checkin', { as: cl, form: { weight: '165.2', energy: '7', adherence: '80', wins: 'Every session', photos: photoId } });
  assert.equal(sent.status, 302);
  // a photo id the client doesn't own is dropped
  await coach.submitCheckin(cl, { weight: '165', photos: 'coachphoto_someone_else' });
  const q = coach.queue(theCoach);
  assert.equal(q.length, 2);
  assert.deepEqual(q.find((c) => c.weight === 165.2).photos, [photoId]);
  assert.deepEqual(q.find((c) => c.weight === 165).photos, []);
  const page = await (await s.go('/coach/review', { as: cu })).text();
  assert.match(page, /Every session/);
  assert.match(page, new RegExp(photoId));
  const r = await s.go(`/coach/review/${q[0].id}`, { as: cu, form: { reply: 'Add 5 lb to squats.' } });
  assert.equal(r.status, 302);
  assert.equal(coach.queue(theCoach).length, 1);
  assert.equal(coach.checkin(q[0].id).reply, 'Add 5 lb to squats.');
  const oak = db.find('users', (u) => u.email === 'new-coach@127.test');
  assert.match((await coach.review(coach.coachFor(oak), q[1].id, 'x')).error, /not found/);
  // the dashboard shows the client, the queue and revenue placeholders
  const dash = await (await s.go('/coach/dashboard', { as: cu })).text();
  assert.match(dash, /Maya Rodriguez/);
  assert.match(dash, /Check-ins to review/);
  assert.equal(coach.dashboard(theCoach).rows.length, 1);
  assert.equal(coach.revenue(theCoach).mrrPlaceholder, 199);
});

// ---- the challenge engine ----
const RULES = [{ label: 'Wake before 8am', proof: 'none' }, { label: '1 hour of exercise', proof: 'photo' }, { label: 'Read 10 pages', proof: 'note' }];
const tickAll = (c, extra = {}) => Object.fromEntries(c.rules.flatMap((r) => [[`r_${r.id}`, 'on']]).concat(Object.entries(extra)));

test('challenge set-up: rules, mode and the optional cohort are validated', async () => {
  assert.match((await chl.save(theCoach, null, { name: 'X' })).error, /Name/);
  assert.match((await chl.save(theCoach, null, { name: 'Coach 50', days: '50', rules: [] })).error, /rule/);
  assert.match((await chl.save(theCoach, null, { name: 'Coach 50', days: '50', rules: RULES, cohortOn: 'on' })).error, /start date/);
  const r = await s.go('/coach/challenges', { as: cu, form: { name: 'Forge 50', days: '50', mode: 'restart', 'rules[0][label]': 'Wake before 8am', 'rules[0][proof]': 'none', 'rules[1][label]': 'Train 1 hour', 'rules[1][proof]': 'photo' } });
  assert.equal(r.status, 302);
  const c = chl.challengesOf(theCoach).find((x) => x.name === 'Forge 50');
  assert.equal(c.rules.length, 2);
  assert.equal(c.rules[1].proof, 'photo');
  assert.equal(c.cohort.on, false);
  // editing keeps rule ids, so days already logged still count
  const keep = c.rules[0].id;
  await chl.save(theCoach, c.id, { name: 'Forge 50', days: '50', rules: [{ id: keep, label: 'Up before 8', proof: 'none' }] });
  assert.equal(chl.get(c.id).rules[0].id, keep);
  assert.equal((await s.go(`/coach/challenges/${c.id}`, { as: cu })).status, 200);
});

test('restart mode: day X of N, proof needed to count, a miss sends you back to day 1, streak and calendar', async () => {
  const { challenge: c } = await chl.save(theCoach, null, { name: 'Hard 5', days: '5', mode: 'restart', rules: RULES });
  at('2026-11-02');
  const { entry: e } = await chl.start(c, cl);
  assert.equal(e.startedOn, '2026-11-02');
  let st = chl.state(c, e);
  assert.equal(st.dayNumber, 1);
  assert.equal(st.of, 5);
  // ticking without the photo and the note doesn't complete the day
  await chl.checkIn(c, e, cl, tickAll(c));
  assert.equal(chl.dayDone(c, e.days['2026-11-02']), false);
  assert.equal(chl.state(c, e).todayDone, 1);
  const full = () => tickAll(c, { [`photo_${c.rules[1].id}`]: photoId, [`note_${c.rules[2].id}`]: 'Atomic Habits ch 2', journal: 'Good day' });
  await chl.checkIn(c, e, cl, full());
  st = chl.state(c, e);
  assert.equal(st.todayComplete, true);
  assert.equal(st.streak, 1);
  at('2026-11-03'); await chl.checkIn(c, e, cl, full());
  at('2026-11-04'); await chl.checkIn(c, e, cl, tickAll(c)); // partial: no proof
  at('2026-11-05');
  st = chl.state(c, e);
  assert.equal(st.dayNumber, 1, 'missed Nov 4: back to day 1');
  assert.equal(st.restarts, 1);
  assert.equal(st.attempts[0].reached, 2);
  assert.equal(st.streak, 0);
  assert.equal(st.best, 2);
  assert.equal(st.calendar.find((d) => d.date === '2026-11-04').state, 'missed');
  assert.equal(st.calendar.find((d) => d.date === '2026-11-02').earlier, true);
  for (const k of ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']) { at(k); await chl.checkIn(c, e, cl, full()); }
  st = chl.state(c, e);
  assert.equal(st.finished, true);
  assert.equal(st.finishedOn, '2026-11-09');
  assert.equal(st.dayNumber, 5);
  assert.equal(st.streak, 5);
  at('2026-11-12');
  assert.equal(chl.state(c, e).finished, true, 'finished stays finished');
  assert.match((await chl.checkIn(c, e, cl, full())).error, /finished/);
  // points: 3 rules x 10 + 20 bonus per full day (7 full days) + Nov 4's one rule that counted
  assert.equal(chl.state(c, e).points, 7 * 50 + 10);
});

test('points mode: nothing resets; rules score, full days get a bonus', async () => {
  const { challenge: c } = await chl.save(theCoach, null, { name: 'Points 3', days: '3', mode: 'points', pointsPerRule: '5', fullDayBonus: '10', rules: [{ label: 'Walk', proof: 'none' }, { label: 'Water', proof: 'none' }] });
  at('2026-11-10');
  const { entry: e } = await chl.start(c, cl);
  await chl.checkIn(c, e, cl, { [`r_${c.rules[0].id}`]: 'on' });
  at('2026-11-11');
  await chl.checkIn(c, e, cl, tickAll(c));
  at('2026-11-12');
  const st = chl.state(c, e);
  assert.equal(st.dayNumber, 3, 'a partial day does not restart');
  assert.equal(st.restarts, 0);
  assert.equal(st.points, 5 + 20);
  at('2026-11-13');
  assert.equal(chl.state(c, e).finished, true);
});

test('cohort layer: apply with answers, coach approves up to the cap, confirm records a demo payment, leaderboard', async () => {
  at('2026-11-16');
  const { challenge: c } = await chl.save(theCoach, null, { name: 'Forge 50 Cohort', days: '50', mode: 'restart', rules: [{ label: 'Train', proof: 'none' }], cohortOn: 'on', cohortStart: '2026-11-10', capacity: '1', cohortPrice: '149', questions: 'Why now?' });
  const pub = await s.go(`/c/forge-hybrid/challenge/${c.slug}`);
  assert.equal(pub.status, 200);
  assert.match(await pub.text(), /Application only/);
  // not a client yet: sent to join first
  const anon = await s.go(`/c/forge-hybrid/challenge/${c.slug}/apply`, { form: { q0: 'Ready' } });
  assert.match(anon.headers.get('location'), /\/c\/forge-hybrid\/join\?next=/);
  assert.equal((await s.go(`/c/forge-hybrid/challenge/${c.slug}/apply`, { as: cl, form: { q0: '' } })).status, 302);
  assert.equal(chl.entryFor(c, cl), null, 'an empty answer is refused');
  await s.go(`/c/forge-hybrid/challenge/${c.slug}/apply`, { as: cl, form: { q0: 'My wedding is in June.' } });
  const e = chl.entryFor(c, cl);
  assert.equal(e.status, 'applied');
  assert.equal(e.answers[0].a, 'My wedding is in June.');
  // a second client applies; capacity 1
  const sam = await member({ role: 'client', coachId: theCoach.id, name: 'Sam Okafor' });
  await chl.apply(c, sam, { q0: 'Get fit' });
  assert.equal(chl.applications(c).length, 2);
  const page = await (await s.go(`/coach/challenges/${c.id}`, { as: cu })).text();
  assert.match(page, /My wedding is in June/);
  await s.go(`/coach/challenges/${c.id}/decide/${e.id}`, { as: cu, form: { action: 'approve' } });
  assert.equal(chl.entry(e.id).status, 'approved');
  assert.match((await chl.decide(theCoach, chl.entryFor(c, sam).id, 'approve')).error, /full/);
  // the client confirms: a demo payment with 127's fee (10%), started on the cohort date
  const conf = await s.go(`/c/forge-hybrid/challenge/${c.slug}/confirm`, { as: cl, form: {} });
  assert.equal(conf.status, 302);
  const live = chl.entry(e.id);
  assert.equal(live.status, 'active');
  assert.deepEqual({ cents: live.payment.cents, fee: live.payment.fee, net: live.payment.net, demo: live.payment.demo }, { cents: 14900, fee: 1490, net: 13410, demo: true });
  assert.equal(live.startedOn, '2026-11-16', 'cohort already started: day 1 is today');
  // daily view, leaderboard, share card, journal
  await s.go(`/c/forge-hybrid/app/challenge/${c.slug}/day`, { as: cl, form: { [`r_${c.rules[0].id}`]: 'on', journal: 'Day one done' } });
  const view = await (await s.go(`/c/forge-hybrid/app/challenge/${c.slug}`, { as: cl })).text();
  assert.match(view, /Day 1/);
  assert.match(view, /of 50/);
  const board = chl.leaderboard(c);
  assert.equal(board.length, 1);
  assert.equal(board[0].name, 'Maya R.', 'first name and last initial only');
  assert.equal((await s.go(`/c/forge-hybrid/app/challenge/${c.slug}/leaderboard`, { as: cl })).status, 200);
  const card = await s.go(`/c/forge-hybrid/app/challenge/${c.slug}/card.svg`, { as: cl });
  assert.equal(card.headers.get('content-type').split(';')[0], 'image/svg+xml');
  assert.match(await card.text(), /DAY 1 OF 50/);
  const j = await s.go(`/c/forge-hybrid/app/challenge/${c.slug}/journal.md`, { as: cl });
  assert.match(j.headers.get('content-disposition'), /attachment/);
  const md = await j.text();
  assert.match(md, /# Forge 50 Cohort journal/);
  assert.match(md, /Day one done/);
  // revenue on the dashboard counts it
  assert.equal(coach.revenue(theCoach).challenge.net, 13410);
  // someone else's client can't use this coach's challenge pages
  assert.equal((await s.go(`/c/forge-hybrid/app/challenge/${c.slug}`, { as: other })).status, 403);
});

test('leaderboard order: restart mode ranks by current run, then points; finishers first', async () => {
  const { challenge: c } = await chl.save(theCoach, null, { name: 'Board 10', days: '10', mode: 'restart', rules: [{ label: 'Train', proof: 'none' }] });
  const mk = async (name, start, missOn) => {
    const u = await member({ role: 'client', coachId: theCoach.id, name });
    const days = {};
    for (let k = start; k <= '2026-11-16'; k = coach.addDays(k, 1)) if (k !== missOn) days[k] = { done: { [c.rules[0].id]: true }, proof: {} };
    return db.save(chl.ENTRIES, { challengeId: c.id, coachId: theCoach.id, userId: u.id, name, track: 'open', status: 'active', startedOn: start, days });
  };
  at('2026-11-16');
  await mk('Ana Lima', '2026-11-12'); // day 5
  await mk('Ben Ford', '2026-11-10', '2026-11-13'); // restarted: day 3
  await mk('Cat Diaz', '2026-11-05'); // 10 days done on Nov 14: finished
  const b = chl.leaderboard(c);
  assert.deepEqual(b.map((x) => x.name), ['Cat D.', 'Ana L.', 'Ben F.']);
  assert.equal(b[0].finished, true);
  assert.equal(b[2].restarts, 1);
});
