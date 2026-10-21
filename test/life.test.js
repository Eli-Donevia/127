// Life in HQ (lib/life, lib/life-routes.js, views/app/hq2/life*.ejs) behind HQ_LIFE: off means 404 and no rail item;
// nothing can be POSTed (127 stores none of it); held modules (food, body, faith) wait for LIFE_CLEARED for members and
// open as a preview for admins; a module above the plan opens with its example and keeps nothing; the bundled data
// (starter foods, exercises, Bible chapters) holds together. No AI.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-life-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-life-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'ADMIN_EMAILS', 'HQ_LIFE', 'LIFE_CLEARED', 'HQ_WORKSPACE', 'HQ_PREMIUM']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const harness = require('../lib/harness');
const life = require('../lib/life');
const lifeRoutes = require('../lib/life-routes');
const nav = require('../lib/harness/nav');
const { plan } = require('../lib/plans');

let seq = 0;
async function member(tier = 'builder', email) {
  seq += 1;
  return db.save('users', { id: `lf${seq}`, email: email || `lf${seq}@127.test`, name: `Maya Lane${seq}`, tier, emailVerified: true, answers: { model: 'service' } });
}

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    Object.assign(res.locals, {
      user: req.user, userPlan: req.user ? plan(req.user.tier) : null, isAdmin: false, path: req.path, flash: null,
      builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
      launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
      fmtDate: () => null, plausible: null, trackEvents: [], canonical: 'https://127.test', baseUrl: 'https://127.test', adConsentScript: '', description: null, hqLive: true,
    });
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  app.use(lifeRoutes({ requireAuth }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, post } = {}) => fetch(url + p, { method: post ? 'POST' : 'GET', headers: as ? { 'x-user': as.id } : {}, redirect: 'manual' });
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

let s;
test.before(async () => { await db.init(); s = await server(); });
test.after(async () => { await s.close(); });
test.beforeEach(() => {
  process.env.HARNESS_V2 = 'on';
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
  process.env.HQ_LIFE = 'on';
  delete process.env.LIFE_CLEARED;
  delete process.env.ADMIN_EMAILS;
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

test('off: every Life route 404s and the rail has no Life', async () => {
  delete process.env.HQ_LIFE;
  const m = await member();
  for (const p of ['/app/hq/life', '/app/hq/life/budget', '/app/hq/life/faith']) assert.equal((await s.go(p, { as: m })).status, 404, p);
  process.env.HQ_WORKSPACE = 'on';
  assert.ok(!nav.workspace(m, { flags: harness.flags.forUser(m) }).groups.some((g) => g.items.some((i) => i.id === 'life')));
  process.env.HQ_LIFE = 'on';
  assert.ok(nav.workspace(m, { flags: harness.flags.forUser(m) }).groups.some((g) => g.items.some((i) => i.id === 'life')));
  delete process.env.HQ_WORKSPACE;
});

test('admins: only an admin with a confirmed email gets in', async () => {
  process.env.HQ_LIFE = 'admins';
  process.env.ADMIN_EMAILS = 'boss@127.test';
  const m = await member();
  const a = await member('builder', 'boss@127.test');
  assert.equal((await s.go('/app/hq/life', { as: m })).status, 404);
  assert.equal((await s.go('/app/hq/life', { as: a })).status, 200);
});

test('nothing can be saved to 127: there is no POST route', async () => {
  const m = await member();
  for (const id of ['budget', 'train', 'food', 'body', 'faith']) {
    assert.equal((await s.go(`/app/hq/life/${id}`, { as: m, post: true })).status, 404, id);
    assert.equal((await s.go(`/app/hq/life/${id}/data`, { as: m, post: true })).status, 404, id);
  }
});

test('open modules draw from the device; held ones wait for Legal by id', async () => {
  const m = await member();
  const shelf = await (await s.go('/app/hq/life', { as: m })).text();
  assert.ok(shelf.includes('href="/app/hq/life/budget"'));
  assert.ok(shelf.includes('href="/app/hq/life/train"'));
  assert.ok(!shelf.includes('href="/app/hq/life/food"'), 'a held module is not a link for members');
  assert.equal((shelf.match(/On the way/g) || []).length, 3);

  const budget = await (await s.go('/app/hq/life/budget', { as: m })).text();
  assert.ok(budget.includes('/js/life/budget.js'));
  assert.ok(budget.includes('"keep":true'));
  assert.ok(budget.includes(`"scope":"${life.scope(m.id)}"`));
  assert.ok(!budget.includes(m.id + '"'), 'the member id itself is not written to the page state');
  assert.ok(budget.includes('Actual Budget'));

  for (const id of ['food', 'body', 'faith']) {
    const page = await (await s.go(`/app/hq/life/${id}`, { as: m })).text();
    assert.ok(page.includes('On the way'), id);
    assert.ok(!page.includes(`/js/life/${id}.js`), `${id}: the module's script is not sent`);
    assert.ok(!page.includes('id="life-state"'), id);
  }
  process.env.LIFE_CLEARED = 'faith, food';
  const faith = await (await s.go('/app/hq/life/faith', { as: m })).text();
  assert.ok(faith.includes('/js/life/faith.js'));
  assert.ok(faith.includes('"plans"'), 'the reading plans ride along');
  assert.ok(!faith.includes('Preview for admins'));
  assert.ok((await (await s.go('/app/hq/life/food', { as: m })).text()).includes('"foods"'));
  assert.ok(!(await (await s.go('/app/hq/life/body', { as: m })).text()).includes('/js/life/body.js'));
  assert.equal((await s.go('/app/hq/life/nope', { as: m })).status, 404);
});

test('an admin previews a held module, marked as a preview', async () => {
  process.env.ADMIN_EMAILS = 'boss@127.test';
  const a = await member('builder', 'boss@127.test');
  const page = await (await s.go('/app/hq/life/body', { as: a })).text();
  assert.ok(page.includes('/js/life/body.js'));
  assert.ok(page.includes('Preview for admins'));
  assert.ok(page.includes('LIFE_CLEARED=body'));
});

test('above the plan: the example only, nothing kept', async () => {
  const m = await member('free');
  const page = await (await s.go('/app/hq/life/train', { as: m })).text();
  assert.ok(page.includes('comes with Builder'));
  assert.ok(page.includes('"keep":false'));
  assert.ok(!page.includes('data-life="export"'));
});

test('the bundled data holds together', () => {
  const foods = life.starterFoods().foods;
  assert.ok(foods.length >= 50);
  assert.equal(new Set(foods.map((f) => f.id)).size, foods.length);
  // Calories agree with protein, carbs and fat (4/4/9) within 15%, except drinks with alcohol.
  for (const f of foods.filter((x) => !['beer', 'wine'].includes(x.id))) {
    const est = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
    assert.ok(Math.abs(est - f.kcal) <= Math.max(15, f.kcal * 0.15), `${f.id}: ${f.kcal} vs ${est}`);
  }
  const b = life.bible();
  assert.equal(b.books.length, 66);
  assert.equal(b.books.filter((x) => x.testament === 'old').reduce((n, x) => n + x.chapters, 0), 929);
  assert.equal(b.books.reduce((n, x) => n + x.chapters, 0), 1189);
  const names = new Set(b.books.map((x) => x.name));
  for (const p of b.plans) for (const [from, to] of p.tracks) assert.ok(names.has(from) && names.has(to), p.id);
  assert.ok(b.translations.every((t) => ['KJV', 'WEB', 'ESV', 'NIV', 'NLT'].includes(t[0])));
  const ex = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'life', 'exercises.json'), 'utf8'));
  assert.match(ex.source, /public domain/);
  assert.ok(ex.exercises.length > 700);
  assert.ok(ex.exercises.every((x) => x.id && x.name && Array.isArray(x.primary) && x.primary.length));
  assert.ok(!JSON.stringify(ex).includes('.jpg'), 'no image paths: nothing loads from another server');
});

test('every module links only to the apps it names, and copy stays clear of outcome claims', () => {
  for (const m of life.list()) {
    for (const b of life.BRING[m.id] || []) assert.match(b.url, /^https:\/\//);
    assert.ok(!/lose \d|guarantee|cure|diagnos/i.test(m.line + (life.PROMPTS[m.id] || '')), m.id);
  }
});
