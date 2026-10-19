// The Founding Five (lib/founding-five.js, lib/founding-five-routes.js): the application window, the
// 18-or-older question, the four boxes, chunked hello videos with byte ranges, Eli's pick sheet and its
// confirm, staging the Nov 25 messages in /admin/ops (with the calendar file for the picked only), the
// sessions calendar, the five's weeks and pieces, the ops feed (Members' site spec part 8), group drafts,
// and deleting what Legal and Offer promised to delete. No network: email is stubbed.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-ff-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-ff-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ADMIN_EMAILS', 'FOUNDING_FIVE_JOIN_URL', 'FOUNDING_FIVE_OPENS_AT', 'FOUNDING_FIVE_CLOSES_AT', 'LAUNCH_AT', 'FOUNDING_CLOSES_AT', 'FOUNDING_FIVE_VIDEO_MAX_MB', 'OPS_FEED_TOKEN']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const ejs = require('ejs');

const db = require('../lib/db');
const ff = require('../lib/founding-five');
const ffRoutes = require('../lib/founding-five-routes');
const memberOps = require('../lib/member-ops');
const ageCheck = require('../lib/age-check');
const { plan } = require('../lib/plans');

const OPEN = Date.parse('2026-11-18T17:00:00Z'); // Wed Nov 18, noon ET: applications open
const PICKS = Date.parse('2026-11-25T16:00:00Z'); // Wed Nov 25, 11am ET (10am Central)
const JOIN = 'https://zoom.example/j/127';
let now = OPEN;
let flashes = [];
let sent = [];
let told = [];

let seq = 0;
async function member(extra = {}) {
  seq += 1;
  return db.save('users', { id: `ffu${seq}`, email: `ff${seq}@127.test`, name: `Ava Stone${seq}`, tier: 'builder', foundingNumber: seq, foundingPrice: 19, emailVerified: true, ...extra });
}
const ADMIN = 'eli@127.test';

function locals(user, req) {
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: !!user && user.email === ADMIN, path: req.path, flash: null,
    builderOffer: { founding: false, price: 19, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
    launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
    fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null, hqLive: false,
  };
}

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    req.session = {};
    Object.assign(res.locals, locals(req.user, req));
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const isAdmin = (u) => !!u && u.email === ADMIN;
  const requireAdmin = (req, res, next) => (isAdmin(req.user) ? next() : res.status(404).send('404'));
  const flash = (req, type, text) => flashes.push({ type, text });
  const limit = () => true;
  app.use(ffRoutes({ requireAuth, requireAdmin, isAdmin, flash, limit, TOO_FAST: 'slow down', stageDraft: memberOps.stageDraft, tell: (m) => told.push(m) }));
  app.use(memberOps.routes({ requireAuth, requireAdmin, flash, limit, TOO_FAST: 'slow down', circle: { lastCall: () => null } }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, raw, headers = {}, method } = {}) => {
    const h = { ...headers };
    if (as) h['x-user'] = as.id;
    let body = raw;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    return fetch(url + p, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

const BOXES = { box_document: 'on', box_share: 'on', box_stayBuilder: 'on', box_private: 'on' };
const FORM = { what: 'Dog walking in my neighborhood. Busy owners pay per walk.', where: 'Des Moines, IA', adult: 'yes', hours: '6', done: 'Walked two dogs for neighbors.', ...BOXES };

// Uploads a hello (or another slot) in 4 MB parts, like public/js/founding-five.js.
async function upload(as, bytes, { slot = 'hello', type = 'video/mp4', name = 'hello.mp4' } = {}) {
  const parts = Math.ceil(bytes.length / ff.CHUNK);
  let id = '';
  let last = null;
  for (let i = 0; i < parts; i++) {
    const q = `?part=${i}&parts=${parts}&size=${bytes.length}${id ? `&upload=${id}` : ''}`;
    const r = await s.go(`/app/founding-five/video/${slot}${q}`, { as, raw: bytes.subarray(i * ff.CHUNK, (i + 1) * ff.CHUNK), headers: { 'content-type': type, 'x-file-name': encodeURIComponent(name), accept: 'application/json' } });
    last = { status: r.status, body: await r.json() };
    if (r.status !== 200) return last;
    id = last.body.upload;
  }
  return last;
}
const video = (n) => Buffer.from(Array.from({ length: n }, (_, i) => i % 251));

async function applyAs(u, extra = {}, bytes = video(1000)) {
  if (bytes) assert.equal((await upload(u, bytes)).status, 200);
  const r = await s.go('/app/founding-five', { as: u, form: { ...FORM, ...extra } });
  assert.equal(r.status, 302, await r.text());
  return ff.mine(u.id);
}

let s;
test.before(async () => {
  await db.init();
  ff._setDeps({ now: () => now });
  memberOps._setDeps({ now: () => now, send: (m) => sent.push(m), emit: () => {} });
  ageCheck._setDeps({ now: () => now, send: () => {} });
  s = await server();
});
test.after(async () => {
  await s.close();
});
test.beforeEach(async () => {
  now = OPEN;
  flashes = [];
  sent = [];
  told = [];
  delete process.env.FOUNDING_FIVE_JOIN_URL;
  for (const a of db.all('foundingFive')) await db.remove('foundingFive', a.id);
  for (const d of db.all('drafts')) await db.remove('drafts', d.id);
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});
const html = (r) => r.text();

test('the window: founding members on Builder apply from Nov 17 10am ET to Nov 24 11:59pm ET', async () => {
  const u = await member();
  now = Date.parse('2026-11-17T14:59:00Z');
  assert.equal(ff.blocked(u), 'early');
  assert.equal(ff.card(u), null);
  assert.match(await html(await s.go('/app/founding-five', { as: u })), /Applications open Tuesday, November 17 at 10am ET/);
  now = Date.parse('2026-11-17T15:00:00Z');
  assert.equal(ff.blocked(u), null);
  assert.equal(ff.card(u).state, 'apply');
  assert.match(ff.card(u).body, /Wednesdays at 8pm ET: December 2, 9 and 16, and January 6/);
  now = Date.parse('2026-11-25T04:58:59Z');
  assert.equal(ff.blocked(u), null);
  now = Date.parse('2026-11-25T04:59:00Z');
  assert.equal(ff.blocked(u), 'closed');
  now = OPEN;
  assert.equal(ff.blocked(await member({ foundingNumber: null, foundingPrice: null })), 'founding');
  assert.equal(ff.blocked(await member({ tier: 'free' })), 'plan');
  assert.equal(ff.blocked(await member({ pause: { startedAt: '2026-11-10T00:00:00Z' } })), 'plan');
  assert.equal(ff.blocked(await member({ tier: 'circle' })), null);
  const page = await html(await s.go('/app/founding-five', { as: await member({ tier: 'free' }) }));
  assert.match(page, /for founding members on Builder or the Circle/);
});

test('the form: every answer, a hello video or link, and all four boxes, each tick kept with its time and version', async () => {
  const u = await member();
  const page = await html(await s.go('/app/founding-five', { as: u }));
  assert.match(page, /Are you 18 or older\?/);
  assert.doesNotMatch(page, /How old are you|your age|gender|woman|women/i);
  for (const b of ff.BOXES) assert.match(page, new RegExp(`name="box_${b.key}"(?! checked)`));
  assert.doesNotMatch(page, /name="box_\w+" checked/);
  assert.match(page, /keep what the other four share in the sessions private/);

  const r = await s.go('/app/founding-five', { as: u, form: { what: '', where: 'X', adult: 'yes', hours: 'lots', done: '' } });
  assert.equal(r.status, 400);
  const bad = await r.text();
  for (const msg of ['Tell Eli what you are starting', 'A number of hours a week', 'Add your 30-second hello', 'Tick this box to apply']) assert.match(bad, new RegExp(msg));
  assert.equal(ff.mine(u.id), null);

  const missing = await s.go('/app/founding-five', { as: u, form: { ...FORM, box_private: '' , videoLink: 'https://drive.example/hello' } });
  assert.equal(missing.status, 400);
  assert.match(await missing.text(), /Tick this box to apply/);

  const a = await applyAs(u, { videoLink: '' });
  assert.equal(a.adult, true);
  assert.equal(a.answers.hours, 6);
  assert.equal(a.scores.hours, 3);
  assert.equal(a.wordsVersion, ff.WORDS_VERSION);
  assert.deepEqual(Object.keys(a.boxes).sort(), ['document', 'private', 'share', 'stayBuilder']);
  for (const v of Object.values(a.boxes)) assert.equal(v, new Date(OPEN).toISOString());
  assert.equal(JSON.stringify(a).match(/"age"/), null);
  assert.equal(ff.card(u).state, 'applied');
  assert.match(await html(await s.go('/app/founding-five', { as: u })), /Your application is in\. Eli picks on Wednesday, November 25/);

  // A change keeps the first tick times.
  now += 3600e3;
  await s.go('/app/founding-five', { as: u, form: { ...FORM, hours: '2' } });
  assert.equal(ff.mine(u.id).answers.hours, 2);
  assert.equal(ff.mine(u.id).boxes.share, new Date(OPEN).toISOString());
});

test('a "No" to 18 or older ends the application, deletes what was there and opens the age review', async () => {
  const u = await member();
  await upload(u, video(500));
  const blob = ff.mine(u.id).video;
  assert.ok(blob);
  const r = await s.go('/app/founding-five', { as: u, form: { ...FORM, adult: 'no' } });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/app');
  assert.equal(ff.mine(u.id), null);
  assert.equal(await db.getBlob(`ff_${blob.id}_0`), null);
  const after = db.get('users', u.id);
  assert.equal(after.ageReview.status, 'open');
  assert.equal(after.ageReview.source, 'founding_five');
  assert.match(flashes.pop().text, /18 or older/);
});

test('hello videos go up in 4 MB parts and play back with byte ranges', async () => {
  const u = await member();
  const bytes = video(ff.CHUNK + 1234);
  const up = await upload(u, bytes, { type: 'video/quicktime', name: 'IMG_0001.MOV' });
  assert.equal(up.status, 200);
  assert.equal(up.body.done, true);
  const v = ff.mine(u.id).video;
  assert.equal(v.size, bytes.length);
  assert.equal(v.parts, 2);
  assert.equal(v.type, 'video/quicktime');

  const full = await s.go('/app/founding-five/video/hello', { as: u });
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.ok(Buffer.from(await full.arrayBuffer()).equals(bytes));
  const part = await s.go('/app/founding-five/video/hello', { as: u, headers: { range: `bytes=${ff.CHUNK - 10}-${ff.CHUNK + 9}` } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes ${ff.CHUNK - 10}-${ff.CHUNK + 9}/${bytes.length}`);
  assert.ok(Buffer.from(await part.arrayBuffer()).equals(bytes.subarray(ff.CHUNK - 10, ff.CHUNK + 10)));
  const tail = await s.go('/app/founding-five/video/hello', { as: u, headers: { range: 'bytes=-100' } });
  assert.ok(Buffer.from(await tail.arrayBuffer()).equals(bytes.subarray(bytes.length - 100)));
  assert.equal((await s.go('/app/founding-five/video/hello', { as: u, headers: { range: `bytes=${bytes.length}-` } })).status, 416);

  // Someone else can't see it; Eli can, on the pick sheet.
  assert.equal((await s.go('/app/founding-five/video/hello', { as: await member() })).status, 404);

  // Wrong type, wrong sizes, a stale upload id.
  assert.equal((await upload(u, video(10), { type: 'image/png', name: 'x.png' })).status, 415);
  const wrong = await s.go(`/app/founding-five/video/hello?part=0&parts=1&size=999`, { as: u, raw: video(10), headers: { 'content-type': 'video/mp4' } });
  assert.equal(wrong.status, 400);
  process.env.FOUNDING_FIVE_VIDEO_MAX_MB = '10';
  assert.equal((await upload(u, video(11 * 1024 * 1024))).status, 413);
  delete process.env.FOUNDING_FIVE_VIDEO_MAX_MB;
  const stale = await s.go(`/app/founding-five/video/hello?part=1&parts=2&size=${ff.CHUNK + 5}&upload=nope`, { as: u, raw: video(5), headers: { 'content-type': 'video/mp4' } });
  assert.equal(stale.status, 409);
  // The five's slots are closed to applicants.
  assert.equal((await upload(u, video(10), { slot: 'start' })).status, 403);
  assert.equal((await upload(u, video(10), { slot: 'w2026-1-1' })).status, 403);

  // A replacement drops the old parts.
  await upload(u, video(300));
  assert.equal(await db.getBlob(`ff_${v.id}_0`), null);
  assert.equal(await db.getBlob(`ff_${v.id}_1`), null);
});

test('withdrawing deletes the application and the video at once', async () => {
  const u = await member();
  const a = await applyAs(u);
  const id = a.video.id;
  const r = await s.go('/app/founding-five/withdraw', { as: u, method: 'POST' });
  assert.equal(r.status, 302);
  assert.equal(ff.mine(u.id), null);
  assert.equal(await db.getBlob(`ff_${id}_0`), null);
});

// Seven applicants: five picks (3 local, 2 online) and two alternates, scored by Eli.
async function sevenApplied() {
  const people = [];
  for (let i = 0; i < 7; i++) {
    const u = await member();
    const a = await applyAs(u, { hours: String(3 + i) });
    people.push({ u, a });
  }
  return people;
}
async function pickAll(people) {
  const admin = await member({ email: ADMIN, name: 'Eli Christiansen' });
  for (const [i, p] of people.entries()) {
    const sc = await s.go(`/admin/founding-five/${p.a.id}/score`, { as: admin, form: { pays: '3', camera: String(3 - (i % 2)), done: '2', kind: i < 3 ? 'local' : 'online' } });
    assert.equal(sc.status, 302);
  }
  const marks = ['picked', 'picked', 'picked', 'picked', 'picked', 'alt1', 'alt2'];
  for (const [i, p] of people.entries()) await s.go(`/admin/founding-five/${p.a.id}/mark`, { as: admin, form: { mark: marks[i] } });
  return admin;
}

test("Eli's pick sheet: scores, marks, the mix, a confirm that locks it and every card's answer", async () => {
  now = OPEN;
  const people = await sevenApplied();
  const extra = await member();
  await applyAs(extra, { hours: '1' });
  now = PICKS;
  const admin = await member({ email: ADMIN, name: 'Eli Christiansen' });
  assert.equal((await s.go('/admin/founding-five', { as: people[0].u })).status, 404);
  assert.equal(ff.board().videoBytes, 8000);
  assert.match(await html(await s.go('/admin/founding-five', { as: admin })), /Videos: 0 MB/);

  // Confirm needs five picks and both alternates.
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  assert.match(flashes.pop().text, /Mark 5 as Picked first/);
  await pickAll(people);
  const b = ff.board();
  assert.equal(b.picked, 5);
  assert.equal(b.alternates, 2);
  assert.deepEqual(b.mix, { local: 3, online: 2 });
  assert.equal(b.suggested.five.length, 5);
  // A sixth pick is refused, and Alternate 1 moves.
  await s.go(`/admin/founding-five/${ff.mine(extra.id).id}/mark`, { as: admin, form: { mark: 'picked' } });
  assert.match(flashes.pop().text, /Five are picked already/);
  await s.go(`/admin/founding-five/${ff.mine(extra.id).id}/mark`, { as: admin, form: { mark: 'alt1' } });
  assert.equal(ff.mine(people[5].u.id).mark, '');
  await s.go(`/admin/founding-five/${people[5].a.id}/mark`, { as: admin, form: { mark: 'alt1' } });

  const sheet = await html(await s.go('/admin/founding-five', { as: admin }));
  assert.match(sheet, /Picked 5 of 5/);
  assert.match(sheet, /Mix: 3 local, 2 online/);
  assert.match(sheet, /Confirm picks/);
  assert.match(sheet, new RegExp(`/admin/founding-five/${people[0].a.id}/video`));
  assert.doesNotMatch(sheet, /\bage\b(?! and sex)/i);

  // Stage is refused before the confirm.
  await s.go('/admin/founding-five/stage', { as: admin, method: 'POST' });
  assert.match(flashes.pop().text, /Confirm the picks first/);
  assert.equal(db.all('drafts').length, 0);

  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  assert.match(flashes.pop().text, /Picks confirmed/);
  assert.equal(ff.mine(extra.id).mark, 'not_picked');
  await s.go(`/admin/founding-five/${people[0].a.id}/mark`, { as: admin, form: { mark: '' } });
  assert.match(flashes.pop().text, /The picks are confirmed/);

  assert.equal(ff.card(people[0].u).result, 'picked');
  assert.equal(ff.card(people[5].u).result, 'alternate');
  assert.equal(ff.card(extra).result, 'not_picked');
  assert.match(ff.card(extra).text, /I picked the five today/);
  now = PICKS + 864e5;
  assert.match(ff.card(extra).text, /I picked the five on Wednesday, November 25, and you weren't one of them/);
  assert.match(await html(await s.go('/app/founding-five', { as: people[0].u })), /Session 1 of 4: Wednesday, December 2/);
  assert.match(await html(await s.go('/app/founding-five', { as: people[6].u })), /You(?:'|&#39;)re an alternate/);
});

test('staging the picks: one draft each, picked first with the calendar file, placeholders filled, Approve all per kind', async () => {
  now = OPEN;
  const people = await sevenApplied();
  const others = [await member(), await member()];
  for (const o of others) await applyAs(o, { hours: '1' });
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  process.env.FOUNDING_FIVE_JOIN_URL = JOIN;
  await s.go('/admin/founding-five/stage', { as: admin, method: 'POST' });
  assert.match(flashes.pop().text, /Staged 9 messages/);
  const drafts = db.all('drafts');
  const by = (k) => drafts.filter((d) => d.kind === k);
  assert.equal(by('ff_picked').length, 5);
  assert.equal(by('ff_alternate').length, 2);
  assert.equal(by('ff_not_picked').length, 2);
  for (const d of drafts) {
    const a = db.find('foundingFive', (x) => x.userId === d.userId);
    assert.equal(d.key, `ff:${a.id}`);
    assert.equal(d.commercial, false);
    assert.doesNotMatch(d.body, /\[\[first name\]\]|\[\[join link\]\]/);
    assert.match(d.body, /^Hi Ava,/);
  }
  for (const d of by('ff_picked')) {
    assert.deepEqual(d.data, { attach: 'ff_sessions' });
    assert.match(d.body, new RegExp(`Join on Zoom: ${JOIN.replace(/[/.]/g, '\\$&')}`));
    assert.match(d.body, /Recordings and notes stay with 127 and are deleted 90 days after each session/);
    assert.ok(d.priority > by('ff_alternate')[0].priority);
  }
  for (const d of [...by('ff_alternate'), ...by('ff_not_picked')]) assert.equal(d.data, null);
  // Staging again adds nothing.
  await s.go('/admin/founding-five/stage', { as: admin, method: 'POST' });
  assert.match(flashes.pop().text, /Every message was staged already/);

  // Approve one picked: the calendar file rides along. Not picked: never.
  const p = by('ff_picked')[0];
  const out = await memberOps.approveDraft(p.id, { by: ADMIN });
  assert.equal(out.status, 'sent');
  const mail = sent.pop();
  assert.equal(mail.attachments.length, 1);
  assert.equal(mail.attachments[0].filename, '127-founding-five-sessions.ics');
  const cal = Buffer.from(mail.attachments[0].content, 'base64').toString();
  assert.equal((cal.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.match(cal, new RegExp(`URL:${JOIN.replace(/[/.]/g, '\\$&')}`));

  // Approve all for one kind.
  const r = await s.go('/admin/ops/kinds/ff_not_picked/approve-all', { as: admin, method: 'POST' });
  assert.equal(r.status, 302);
  assert.match(flashes.pop().text, /Approved\. 2 sent/);
  assert.equal(sent.length, 2);
  for (const m of sent) assert.equal(m.attachments, undefined);
  assert.equal((await s.go('/admin/ops/kinds/ff_not_picked/approve-all', { as: people[0].u, method: 'POST' })).status, 404);
});

test('a picked message staged before the Zoom link is set waits for it, then fills it at Approve', async () => {
  now = OPEN;
  const people = await sevenApplied();
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  await s.go('/admin/founding-five/stage', { as: admin, method: 'POST' });
  const d = db.find('drafts', (x) => x.kind === 'ff_picked');
  assert.match(d.body, /\[\[join link\]\]/);
  assert.match((await memberOps.approveDraft(d.id, { by: ADMIN })).error, /Fill in every \[\[placeholder\]\]/);
  process.env.FOUNDING_FIVE_JOIN_URL = JOIN;
  const out = await memberOps.approveDraft(d.id, { by: ADMIN });
  assert.equal(out.status, 'sent');
  assert.match(sent.pop().text, /Join on Zoom: https:\/\/zoom\.example\/j\/127/);
  assert.equal(db.get('drafts', d.id).edited, false);
});

test('sessions.ics: the five only, four sessions at 01:00 UTC', async () => {
  now = OPEN;
  const people = await sevenApplied();
  now = PICKS;
  const admin = await pickAll(people);
  assert.equal((await s.go('/app/founding-five/sessions.ics', { as: people[0].u })).status, 404);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  for (const p of [people[5], people[6]]) assert.equal((await s.go('/app/founding-five/sessions.ics', { as: p.u })).status, 404);
  assert.equal((await s.go('/app/founding-five/sessions.ics', { as: await member() })).status, 404);
  process.env.FOUNDING_FIVE_JOIN_URL = JOIN;
  const r = await s.go('/app/founding-five/sessions.ics', { as: people[0].u });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/calendar/);
  const cal = await r.text();
  assert.deepEqual(cal.match(/DTSTART:\S+/g), ['DTSTART:20261203T010000Z', 'DTSTART:20261210T010000Z', 'DTSTART:20261217T010000Z', 'DTSTART:20270107T010000Z']);
  assert.deepEqual(cal.match(/DTEND:\S+/g), ['DTEND:20261203T012000Z', 'DTEND:20261210T012000Z', 'DTEND:20261217T012000Z', 'DTEND:20270107T012000Z']);
  assert.match(cal, /UID:founding-five-session-1@127group\.io/);
  for (const line of cal.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
});

test("the five's page: this week's numbers from HQ, the weekly video and pieces to OK with a version and a Stopped mark", async () => {
  now = OPEN;
  const people = await sevenApplied();
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  const u = people[0].u;
  const a = ff.mine(u.id);

  // Week 1 runs to the Dec 2 session; sends come from Do my day, replies, calls and yeses from the Pipeline.
  now = Date.parse('2026-12-01T18:00:00Z');
  await db.save('actions', { id: `${u.id}:2026-11-30`, memberId: u.id, day: '2026-11-30', counts: { warm: 4, cold: 10, content: 0, ads: 0 }, total: 14 });
  await db.save('pipeline', { id: `pl-${u.id}`, memberId: u.id, stage: 'call', history: [{ at: '2026-11-30T15:00:00Z', stage: 'replied' }, { at: '2026-12-01T15:00:00Z', stage: 'call' }] });
  const w = ff.currentWeek();
  assert.equal(w.n, 1);
  assert.equal(w.weekOf, '2026-11-30');
  const page = await html(await s.go('/app/founding-five', { as: u }));
  assert.match(page, /name="sends"[^>]*value="14"/);
  assert.match(page, /name="replies"[^>]*value="1"/);
  assert.match(page, /name="calls"[^>]*value="1"/);
  await s.go('/app/founding-five/week', { as: u, form: { sends: '15', replies: '1', calls: '1', yeses: '0' } });
  assert.equal(ff.mine(u.id).weeks['2026-11-30'].sends, 15);
  assert.equal((await s.go('/app/founding-five/week', { as: people[5].u, form: { sends: '1', replies: '0', calls: '0', yeses: '0' } })).status, 302);
  assert.match(flashes.pop().text, /Numbers go in during the sessions/);

  // Videos: the start video and this week's.
  assert.equal((await upload(u, video(700), { slot: 'start' })).status, 200);
  assert.equal((await upload(u, video(700), { slot: 'w2026-11-30' })).status, 200);
  assert.equal((await upload(u, video(700), { slot: 'w2026-12-07' })).status, 403);
  assert.equal((await upload(people[6].u, video(700), { slot: 'start' })).status, 403);

  // Pieces: Eli adds one, the member says yes (kept with its version), then stops it.
  await s.go(`/admin/founding-five/${a.id}/pieces`, { as: admin, form: { kind: 'clip', title: 'Session 1 clip', link: 'https://drive.example/clip' } });
  const piece = ff.mine(u.id).pieces[0];
  assert.equal(piece.status, 'waiting');
  const five = await html(await s.go('/app/founding-five', { as: u }));
  assert.match(five, /Can 127 use this clip in its posts, emails and website, with your first name\?/);
  assert.match(five, /Ava is one of the Founding Five: 127 gave them four group sessions with Eli for sharing their build\./);
  await s.go(`/app/founding-five/pieces/${piece.id}/yes`, { as: u, method: 'POST' });
  let p = ff.mine(u.id).pieces[0];
  assert.equal(p.status, 'yes');
  assert.equal(p.answers[0].version, ff.PIECE_OK.version);
  assert.equal(p.answers[0].title, 'Session 1 clip');
  assert.equal(p.answers[0].at, new Date(now).toISOString());
  await s.go(`/app/founding-five/pieces/${piece.id}/no`, { as: u, method: 'POST' });
  p = ff.mine(u.id).pieces[0];
  assert.equal(p.status, 'stopped');
  assert.ok(p.stoppedAt);
  assert.equal(told.length, 1);
  assert.doesNotMatch(told[0].text, /@/);
  // A stopped piece can't go back to yes.
  await s.go(`/app/founding-five/pieces/${piece.id}/yes`, { as: u, method: 'POST' });
  assert.equal(ff.mine(u.id).pieces[0].status, 'stopped');
  // Eli's Stopped mark, for a request by email.
  await s.go(`/admin/founding-five/${a.id}/pieces`, { as: admin, form: { kind: 'story', title: 'First call story' } });
  const story = ff.mine(u.id).pieces[1];
  await s.go(`/admin/founding-five/${a.id}/pieces/${story.id}/stop`, { as: admin, method: 'POST' });
  assert.equal(ff.mine(u.id).pieces[1].status, 'stopped');

  const fp = memberOps.buildFeed().foundingFive.members.find((m) => m.userId === u.id).pieces;
  assert.equal(fp[0].status, 'stopped');
  assert.equal(fp[0].textVersion, ff.PIECE_OK.version);
  assert.ok(fp[0].stoppedAt);
  assert.equal(fp[1].textVersion, null);
});

test("the ops feed's foundingFive: no emails, ages, video files or links", async () => {
  now = OPEN;
  const people = await sevenApplied();
  const linked = await member();
  await applyAs(linked, { videoLink: 'https://drive.example/hello-video' }, null);
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  await upload(people[0].u, video(400), { slot: 'start' });
  const f = memberOps.buildFeed().foundingFive;
  const text = JSON.stringify(f);
  assert.doesNotMatch(text, /@127\.test|drive\.example|https?:|\/video|"age"|"video"|"parts"/);
  assert.equal(f.applications.length, 8);
  const app = f.applications.find((x) => x.userId === people[0].u.id);
  assert.deepEqual(app.answers, { what: FORM.what, where: FORM.where, adult: true, hours: 3, doneSoFar: FORM.done });
  assert.deepEqual(app.consents, { document: true, share: true, stayBuilder: true, private: true });
  assert.equal(app.helloVideo, true);
  assert.equal(app.status, 'picked');
  assert.equal(f.applications.find((x) => x.userId === people[5].u.id).altRank, 1);
  assert.equal(f.applications.find((x) => x.userId === linked.id).status, 'not_picked');
  assert.equal(f.members.length, 5);
  assert.ok(f.members[0].startVideoAt);
  assert.deepEqual(f.alternates.map((x) => x.rank), [1, 2]);

  // A place passes: the next alternate steps in, and the feed says who left.
  await s.go(`/admin/founding-five/${people[1].a.id}/step-in`, { as: admin, method: 'POST' });
  const g = memberOps.buildFeed().foundingFive;
  assert.equal(g.members.find((m) => m.userId === people[1].u.id).status, 'left');
  assert.equal(g.members.find((m) => m.userId === people[5].u.id).status, 'picked');
  assert.deepEqual(g.alternates.map((x) => x.rank), [2]);
});

test('deleting what was promised: not-picked videos by Dec 25 and applications in 30 days, alternates after Jan 6 unless they step in', async () => {
  now = OPEN;
  const people = await sevenApplied();
  const no = await member();
  await applyAs(no, { hours: '1' });
  const linkOnly = await member();
  await applyAs(linkOnly, { hours: '1', videoLink: 'https://drive.example/v' }, null);
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  const noVideo = ff.mine(no.id).video.id;

  now = PICKS + 6 * 864e5;
  await ff.purge();
  assert.ok(ff.mine(no.id).video);
  now = PICKS + 8 * 864e5;
  await ff.purge();
  assert.equal(ff.mine(no.id).video, null);
  assert.ok(ff.mine(no.id).helloVideoDeletedAt);
  assert.equal(ff.mine(linkOnly.id).videoLink, '');
  assert.equal(await db.getBlob(`ff_${noVideo}_0`), null);
  assert.ok(Date.parse(ff.mine(no.id).helloVideoDeletedAt) < Date.parse('2026-12-25T05:00:00Z'));
  const feedRow = memberOps.buildFeed().foundingFive.applications.find((x) => x.userId === no.id);
  assert.equal(feedRow.helloVideo, false);
  assert.ok(feedRow.helloVideoDeletedAt);

  now = PICKS + 26 * 864e5;
  await ff.purge();
  assert.equal(ff.mine(no.id), null);
  assert.ok(ff.mine(people[5].u.id), 'alternates wait for Jan 6');

  // Alternate 2 steps in before Jan 6 and stays; alternate 1 doesn't and goes.
  await s.go(`/admin/founding-five/${people[0].a.id}/step-in`, { as: admin, method: 'POST' });
  await s.go(`/admin/founding-five/${people[1].a.id}/step-in`, { as: admin, method: 'POST' });
  assert.equal(ff.mine(people[6].u.id).mark, 'picked');
  now = Date.parse('2027-01-07T05:00:01Z');
  await ff.purge();
  assert.ok(ff.mine(people[6].u.id));
  assert.ok(ff.mine(people[5].u.id));
  // The picked hello videos go 30 days after the pick.
  assert.equal(ff.mine(people[2].u.id).video, null);
  assert.ok(ff.mine(people[2].u.id).helloVideoDeletedAt);
});

test("someone paused or off Builder can't take a place, and the sheet says why", async () => {
  now = OPEN;
  const people = await sevenApplied();
  now = PICKS;
  const admin = await member({ email: ADMIN, name: 'Eli Christiansen' });
  for (const p of people) await s.go(`/admin/founding-five/${p.a.id}/score`, { as: admin, form: { pays: '3', camera: '3', done: '3', kind: 'local' } });
  await db.save('users', { ...people[0].u, pause: { startedAt: new Date(now).toISOString() } });
  await db.save('users', { ...people[1].u, cancelAtPeriodEnd: true, cancelAt: '2026-12-20T15:00:00.000Z' });
  await db.save('users', { ...people[2].u, tier: 'free' });
  for (const [i, mark] of [[0, 'picked'], [2, 'alt1']]) {
    await s.go(`/admin/founding-five/${people[i].a.id}/mark`, { as: admin, form: { mark } });
    assert.match(flashes.at(-1).text, /not on Builder or the Circle right now/);
    assert.ok(!ff.mine(people[i].u.id).mark);
  }
  const sheet = await html(await s.go('/admin/founding-five', { as: admin }));
  assert.match(sheet, />Paused</);
  assert.match(sheet, />Cancels Dec 20</);
  assert.match(sheet, />Not on Builder now</);
  const sug = ff.board().suggested;
  for (const i of [0, 2]) assert.ok(![...sug.five, ...sug.alternates].includes(people[i].a.id));
  // A scheduled cancel is a fact for Eli, not a rule: they can still be picked until it ends.
  await s.go(`/admin/founding-five/${people[1].a.id}/mark`, { as: admin, form: { mark: 'picked' } });
  assert.equal(ff.mine(people[1].u.id).mark, 'picked');
});

test('a place passes: the sheet shows why, Eli names the alternate who said yes, and only the five get the calendar', async () => {
  now = OPEN;
  const people = await sevenApplied();
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  now = PICKS + 3 * 864e5;
  await db.save('users', { ...people[0].u, pause: { startedAt: new Date(now).toISOString() } });
  const sheet = await html(await s.go('/admin/founding-five', { as: admin }));
  assert.match(sheet, /color:var\(--danger\)">paused</);
  assert.match(sheet, new RegExp(`<option value="${people[5].a.id}">Alternate 1: Ava</option><option value="${people[6].a.id}">Alternate 2: Ava</option>`));
  // Someone off Builder can't step in.
  await db.save('users', { ...people[5].u, pause: { startedAt: new Date(now).toISOString() } });
  await s.go(`/admin/founding-five/${people[0].a.id}/step-in`, { as: admin, form: { next: people[5].a.id } });
  assert.match(flashes.at(-1).text, /isn't on Builder or the Circle right now/);
  assert.ok(!ff.mine(people[0].u.id).leftAt);
  // Alternate 1 said no, so Eli names Alternate 2.
  const r = await s.go(`/admin/founding-five/${people[0].a.id}/step-in`, { as: admin, form: { next: people[6].a.id } });
  assert.equal(r.status, 302);
  assert.match(flashes.at(-1).text, /one of the five now/);
  assert.equal(ff.mine(people[6].u.id).mark, 'picked');
  assert.ok(ff.mine(people[6].u.id).steppedInAt);
  assert.equal(ff.mine(people[5].u.id).mark, 'alt1');
  assert.ok(ff.mine(people[0].u.id).leftAt);
  assert.equal(ff.card(people[0].u), null);
  assert.equal(ff.card(people[6].u).state, 'five');
  process.env.FOUNDING_FIVE_JOIN_URL = JOIN;
  assert.equal((await s.go('/app/founding-five/sessions.ics', { as: people[6].u })).status, 200);
  assert.equal((await s.go('/app/founding-five/sessions.ics', { as: people[0].u })).status, 404);
  // Someone who isn't waiting can't be named, and nobody leaves.
  await s.go(`/admin/founding-five/${people[1].a.id}/step-in`, { as: admin, form: { next: people[6].a.id } });
  assert.match(flashes.at(-1).text, /not waiting/);
  assert.ok(!ff.mine(people[1].u.id).leftAt);
  // The sheet links the five's start and weekly videos.
  now = Date.parse('2026-11-30T15:00:00Z');
  assert.equal((await upload(people[1].u, video(800), { slot: 'start' })).status, 200);
  const sheet2 = await html(await s.go('/admin/founding-five', { as: admin }));
  assert.match(sheet2, new RegExp(`href="/admin/founding-five/${people[1].a.id}/video/start"`));
  const v = await s.go(`/admin/founding-five/${people[1].a.id}/video/start`, { as: admin, headers: { range: 'bytes=0-9' } });
  assert.equal(v.status, 206);
  assert.equal((await s.go(`/admin/founding-five/${people[1].a.id}/video/start`, { as: people[1].u })).status, 404);
});

test('an alternate who never stepped in is deleted after Jan 6', async () => {
  now = OPEN;
  const people = await sevenApplied();
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  now = Date.parse('2027-01-07T04:59:00Z');
  await ff.purge();
  assert.ok(ff.mine(people[6].u.id));
  now = Date.parse('2027-01-07T05:00:01Z');
  await ff.purge();
  assert.equal(ff.mine(people[5].u.id), null);
  assert.equal(ff.mine(people[6].u.id), null);
  assert.ok(ff.mine(people[0].u.id));
});

test('group drafts: one email per listed member of the five, their own first line, never Discord; recap bodies go Apr 6, 2027', async () => {
  now = OPEN;
  const people = await sevenApplied();
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  process.env.FOUNDING_FIVE_JOIN_URL = JOIN;

  const outsider = await memberOps.stageDraft({ kind: 'ff_group', key: 'ff_recap:2026-12-03', subject: 'Founding Five recap: session 1 of 4', body: 'Shared part.', perMember: [{ userId: people[5].u.id, firstLine: 'Hi' }] });
  assert.equal(outsider.status, 400);
  const st = await memberOps.stageDraft({
    kind: 'ff_group', key: 'ff_recap:2026-12-03', subject: 'Founding Five recap: session 1 of 4', commercial: true, job: 'members.founding-five',
    body: 'Hi [[first name]], here is the shared part. Same Zoom link: [[join link]]',
    perMember: people.slice(0, 2).map((p, i) => ({ userId: p.u.id, firstLine: `Your commitment: ${20 + i} sends by Wednesday, December 9.` })),
  });
  assert.equal(st.status, 201);
  assert.equal(st.draft.commercial, false);
  assert.equal(st.draft.recipient, 'founding_five');
  assert.doesNotMatch(st.draft.body, /\[\[join link\]\]/);
  let recapCalled = false;
  // One of the two left the five before Eli approved.
  await s.go(`/admin/founding-five/${people[1].a.id}/step-in`, { as: admin, method: 'POST' });
  const out = await memberOps.approveDraft(st.draft.id, { by: ADMIN }, { recap: () => { recapCalled = true; return {}; } });
  assert.equal(out.status, 'sent');
  assert.equal(recapCalled, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, people[0].u.email);
  assert.match(sent[0].text, /^Your commitment: 20 sends by Wednesday, December 9\.\n\nHi Ava, here is the shared part\. Same Zoom link: https:\/\/zoom\.example\/j\/127/);
  assert.deepEqual(db.get('drafts', st.draft.id).recipients, [people[0].u.id]);

  now = Date.parse('2027-04-06T03:59:00Z');
  assert.equal(await memberOps.forgetFfRecaps(), 0);
  now = Date.parse('2027-04-06T04:00:00Z');
  assert.equal(await memberOps.forgetFfRecaps(), 1);
  const gone = db.get('drafts', st.draft.id);
  assert.equal(gone.body, '');
  assert.equal(gone.originalBody, '');
  assert.ok(gone.perMember.every((m) => m.firstLine === ''));
  assert.ok(gone.bodyDeletedAt);
});

test("Eli's preview outside the window is saved as a test and never counts", async () => {
  now = Date.parse('2026-10-20T15:00:00Z');
  const admin = await member({ email: ADMIN, name: 'Eli Christiansen', foundingNumber: null, foundingPrice: null });
  const page = await html(await s.go('/app/founding-five', { as: admin }));
  assert.match(page, /Preview: applications aren't open/);
  const a = await applyAs(admin);
  assert.equal(a.test, true);
  assert.equal(ff.board().count, 0);
  assert.equal(ff.card(admin), null);
  assert.equal(memberOps.buildFeed().foundingFive.applications.length, 0);
});

test('account deletion removes the application and its videos', async () => {
  const u = await member();
  const a = await applyAs(u);
  await ff.forget(u.id);
  assert.equal(ff.mine(u.id), null);
  assert.equal(await db.getBlob(`ff_${a.video.id}_0`), null);
});

test('the card on the dashboard and HQ Today reads right in each state', async () => {
  const file = path.join(__dirname, '..', 'views', 'partials', 'founding-five-card.ejs');
  const u = await member();
  const apply = await ejs.renderFile(file, { c: ff.card(u), hq: false });
  assert.match(apply, /Build alongside Eli for four weeks\./);
  assert.match(apply, /<img src="\/img\/founding-five\/card\.webp" alt=""/, "Graphics' webp, the only copy in public/img/founding-five");
  assert.match(await ejs.renderFile(file, { c: { ...ff.card(u), image: '/img/founding-five/card.jpg' }, hq: true }), /<img src="\/img\/founding-five\/card\.jpg" alt=""/);
  assert.match(apply, /href="\/app\/founding-five"/);
  await applyAs(u);
  assert.match(await ejs.renderFile(file, { c: ff.card(u), hq: true }), /Your application is in\./);
  const res = await ejs.renderFile(file, { c: { state: 'result', result: 'not_picked', text: ff.RESULTS.not_picked, five: false }, hq: true });
  assert.match(res, /<h2[^>]*>Thanks for applying to the Founding Five\.<\/h2>/);
  assert.match(res, /From Eli/);

  // One of the five: the result on picks day, then this week's session and what waits on them.
  const people = await sevenApplied();
  now = PICKS;
  const admin = await pickAll(people);
  await s.go('/admin/founding-five/confirm', { as: admin, method: 'POST' });
  const one = people[0].u;
  const day = await ejs.renderFile(file, { c: ff.card(one), hq: false });
  assert.match(day, /Open your Founding Five page/);
  assert.match(day, /From Eli/);
  now = PICKS + 864e5;
  const five = await ejs.renderFile(file, { c: ff.card(one), hq: true });
  assert.match(five, /<h2[^>]*>Session 1 of 4: Wednesday, December 2 at 8pm ET<\/h2>/);
  assert.match(five, /Film your 60-second/);
  assert.match(five, /Open your Founding Five page/);
  await ff.addPiece(people[0].a.id, { kind: 'clip', title: 'Week 1 clip', link: 'https://drive.example/c1' });
  now = Date.parse('2027-01-08T15:00:00Z');
  const after = ff.card(one);
  assert.equal(after.title, 'The four sessions are done.');
  assert.match(after.lines.join(' '), /A piece of your build waits for your OK\./);
  assert.match(await ejs.renderFile(file, { c: after, hq: false }), /The four sessions are done\./);
  const p = ff.mine(one.id).pieces[0];
  await ff.answerPiece(one, p.id, 'no');
  assert.equal(ff.card(one), null);
  // Alternates see their note until Jan 6, and the not picked for 14 days.
  now = PICKS + 864e5;
  assert.equal(ff.card(people[5].u).state, 'result');
  now = Date.parse('2027-01-07T05:00:01Z');
  assert.equal(ff.card(people[5].u), null);
});

test('the words: Offer\'s card, Legal\'s boxes and note, and nothing the copy check blocks', () => {
  const { check } = require('../lib/copy-check');
  const words = [ff.CARD.title, ff.CARD.body, ff.NOTE, ...ff.BOXES.map((b) => `${b.lead} ${b.rest}`), ...Object.values(ff.RESULTS), ...Object.values(ff.MESSAGES).map((m) => m.body), ff.PIECE_OK.text('Ava')].join('\n');
  // Builder members only, so every sentence counts as paid-plan copy (Legal L62).
  assert.deepEqual(check(words, { paid: true }).filter((f) => f.severity === 'block'), []);
  for (const f of ['app/founding-five.ejs', 'partials/founding-five-card.ejs', 'partials/founding-five-upload.ejs', 'admin/founding-five.ejs']) {
    const file = path.join(__dirname, '..', 'views', f);
    assert.deepEqual(check(fs.readFileSync(file, 'utf8'), { file, paid: true }).filter((x) => x.severity === 'block'), [], f);
  }
  assert.doesNotMatch(words.replace("It isn't a contest and there's no prize", ''), /\b(win|winner|prize|contest|chosen)\b/i);
  assert.doesNotMatch(words, /\$\d/);
  assert.match(ff.NOTE, /It isn't a contest and there's no prize/);
});
