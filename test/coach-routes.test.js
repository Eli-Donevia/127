// Coach accounts (lib/coach-routes.js): save a kit, the switch hides client pages, a client joins, checks in with the
// token from the link, and the coach's dashboard shows them.
const path = require('path');
const os = require('os');
process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-coach-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-coach-${process.pid}`);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../lib/db');

let server, base, me = null;
const ADMIN = { id: 'admin1', email: 'admin@example.com' };

test.before(async () => {
  await db.init();
  const app = express();
  app.use((req, res, next) => { req.user = me; next(); });
  app.response.render = function (view) { this.status(this.statusCode || 404).send(view); };
  const requireAuth = (req, res, next) => (req.user ? next() : res.status(302).end());
  require('../lib/coach-routes')(app, { requireAuth, isAdmin: (u) => !!u && u.id === ADMIN.id });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server && server.close());

const post = (p, body, type = 'json') => fetch(base + p, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': type === 'json' ? 'application/json' : 'application/x-www-form-urlencoded' },
  body: type === 'json' ? JSON.stringify(body) : new URLSearchParams(body).toString(),
});

test('a signed-out coach is sent to sign up; a claim is refused; a kit saves with a slug', async () => {
  me = null;
  assert.equal((await post('/coaches/kit', {})).status, 401);
  me = { id: 'coach1', email: 'coach@example.com' };
  const bad = await post('/coaches/kit', { story: 'Clients lose 20 lbs, guaranteed.' });
  assert.equal(bad.status, 422);
  const r = await post('/coaches/kit', { business: 'Reyes Strength', start: '2026-11-10', days: 21 });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.slug, 'reyes-strength');
  assert.equal(j.live, false);
});

test('client pages stay closed while COACH_CLIENTS is off, and open to admins on admins', async () => {
  delete process.env.COACH_CLIENTS;
  me = null;
  assert.equal((await fetch(`${base}/c/reyes-strength`)).status, 404);
  process.env.COACH_CLIENTS = 'admins';
  assert.equal((await fetch(`${base}/c/reyes-strength`)).status, 404);
  me = ADMIN;
  assert.equal((await fetch(`${base}/c/reyes-strength`)).status, 200);
});

test('a client joins, checks in with the link token, and shows on the dashboard', async () => {
  process.env.COACH_CLIENTS = 'on';
  me = null;
  const page = await (await fetch(`${base}/c/reyes-strength`)).text();
  assert.match(page, /Join Jordan Reyes/);
  assert.equal((await post('/c/reyes-strength/join', { name: 'Ana', email: 'ana@example.com' }, 'form')).status, 400);
  const j = await post('/c/reyes-strength/join', { name: 'Ana', email: 'ana@example.com', ok: '1' }, 'form');
  assert.equal(j.status, 303);
  const t = j.headers.get('location').split('#t=')[1];
  assert.match(t, /^[a-f0-9]{64}$/);
  const app = await (await fetch(`${base}/c/reyes-strength/app`)).text();
  assert.match(app, /window\.COACH_APP = \{"coach":"Reyes Strength"/);
  assert.equal((await post('/c/reyes-strength/checkin', { t: 'f'.repeat(64), date: '2026-11-12' })).status, 403);
  assert.equal((await post('/c/reyes-strength/checkin', { t, date: '2027-03-01' })).status, 400);
  const ok = await post('/c/reyes-strength/checkin', { t, date: '2026-11-12' });
  assert.equal((await ok.json()).count, 1);
  const c = db.find('coachClients', (x) => x.email === 'ana@example.com');
  assert.ok(!('token' in c) && c.tokenHash.length === 64);
  me = { id: 'coach1', email: 'coach@example.com' };
  const dash = await (await fetch(`${base}/coaches/dashboard`)).text();
  assert.match(dash, /window\.COACH_DASH = .*"name":"Ana"/);
  const { summary } = require('../lib/coach-routes');
  const s = summary(db.get('coachKits', 'coach1'), '2026-11-13');
  assert.equal(s.day, 4);
  assert.equal(s.clients[0].p, '0010');
  assert.equal(s.clients[0].miss, 1);
});
