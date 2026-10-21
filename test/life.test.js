// Life in HQ (lib/life, lib/life-routes.js, views/app/hq2/life.ejs) behind HQ_LIFE: off means 404 and no rail item;
// every tool lives at one address (Legal L87 LV2); nothing can be POSTed (127 stores none of it); no outside script
// reaches a Life page (LV3); held modules (food, body, faith) wait for LIFE_CLEARED for members and open as a preview
// for admins; the food log and check-in stay closed under age review (LV4); a module above the plan keeps nothing;
// Legal's lines appear word for word; the bundled data (starter foods, exercises, Bible chapters) holds together. No AI.

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
      fmtDate: () => null, plausible: '127group.io', trackEvents: [{ name: 'Signup' }], canonical: 'https://127.test', baseUrl: 'https://127.test', adConsentScript: '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>', description: null, hqLive: true,
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

test('nothing can be saved to 127, and every tool shares one address', async () => {
  const m = await member();
  assert.equal((await s.go('/app/hq/life', { as: m, post: true })).status, 404);
  for (const id of ['budget', 'train', 'food', 'body', 'faith']) {
    assert.equal((await s.go(`/app/hq/life/${id}`, { as: m })).status, 404, `${id}: no address names a tool`);
    assert.equal((await s.go(`/app/hq/life/${id}`, { as: m, post: true })).status, 404, id);
  }
});

test('no outside script on a Life page: analytics and pixels dropped, a CSP that allows only 127', async () => {
  const m = await member();
  const res = await s.go('/app/hq/life', { as: m });
  const html = await res.text();
  assert.ok(!/plausible|fbevents|connect\.facebook/.test(html), 'analytics and pixels are not on the page');
  for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) assert.match(src, /^\/(?!\/)/, src);
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /img-src 'self' data:/);
  assert.ok(!/https?:|\*/.test(csp), csp);
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
});

test('open modules draw from the device; held ones wait for Legal by id', async () => {
  const m = await member();
  const page = await (await s.go('/app/hq/life', { as: m })).text();
  assert.ok(page.includes('href="#budget"'));
  assert.ok(page.includes('href="#train"'));
  assert.ok(!page.includes('href="#food"'), 'a held module is not a link for members');
  assert.equal((page.match(/On the way/g) || []).length, 3);
  assert.ok(page.includes('data-life="clear-all"') && page.includes('Clear Life data'));
  assert.ok(page.includes('/js/life/budget.js') && page.includes('/js/life/train.js'));
  assert.ok(page.includes('"keep":true'));
  assert.ok(page.includes(`"scope":"${life.scope(m.id)}"`));
  assert.ok(!page.includes(m.id + '"'), 'the member id itself is not written to the page state');
  assert.ok(page.includes('Actual Budget'));
  // Charts, rings and toasts load before the tools, each a port with its licence beside it.
  for (const f of ['vendor/rings.js', 'vendor/toast.js', 'chart.js', 'kit.js']) assert.ok(page.indexOf(`/js/life/${f}`) < page.indexOf('/js/life/budget.js'), f);
  for (const lic of ['LICENSE-bklit', 'LICENSE-kokonutui', 'LICENSE-sonner']) assert.match(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'life', 'vendor', lic), 'utf8'), /MIT License/, lic);
  for (const id of ['food', 'body', 'faith']) {
    assert.ok(!page.includes(`/js/life/${id}.js`), `${id}: the module's script is not sent`);
    assert.ok(!page.includes(`data-view="${id}"`), id);
  }

  process.env.LIFE_CLEARED = 'faith, food';
  const cleared = await (await s.go('/app/hq/life', { as: m })).text();
  assert.ok(cleared.includes('/js/life/faith.js') && cleared.includes('/js/life/food.js'));
  assert.ok(cleared.includes('"plans"'), 'the reading plans ride along');
  assert.ok(cleared.includes('"foods"'));
  assert.ok(!cleared.includes('Preview for admins'));
  assert.ok(!cleared.includes('/js/life/body.js'));
});

test('an admin previews a held module, marked as a preview', async () => {
  process.env.ADMIN_EMAILS = 'boss@127.test';
  const a = await member('builder', 'boss@127.test');
  const page = await (await s.go('/app/hq/life', { as: a })).text();
  assert.ok(page.includes('/js/life/body.js'));
  assert.ok(page.includes('Preview for admins'));
  assert.ok(page.includes('LIFE_CLEARED=body'));
});

test('under age review the food log and check-in stay closed, even cleared or for an admin', async () => {
  process.env.LIFE_CLEARED = 'food,body,faith';
  process.env.ADMIN_EMAILS = 'young@127.test';
  const m = await member('builder', 'young@127.test');
  m.ageReview = { status: 'open', source: 'chat' };
  await db.save('users', m);
  const page = await (await s.go('/app/hq/life', { as: m })).text();
  for (const id of ['food', 'body']) assert.ok(!page.includes(`/js/life/${id}.js`), id);
  assert.ok(page.includes('/js/life/faith.js') && page.includes('/js/life/budget.js'));
  assert.equal((page.match(/Not open on this account/g) || []).length, 2);
});

test('above the plan: nothing kept', async () => {
  const m = await member('free');
  const page = await (await s.go('/app/hq/life', { as: m })).text();
  assert.ok(page.includes('comes with Builder'));
  assert.ok(page.includes('"keep":false'));
  assert.ok(!page.includes('data-life="export"'));
});

test("Legal's lines, word for word (L87 LV4 to LV6, PC3)", async () => {
  process.env.LIFE_CLEARED = 'food,body,faith';
  const m = await member();
  const page = await (await s.go('/app/hq/life', { as: m })).text();
  const wellness = 'General wellness ideas, not medical advice. Check with a doctor before you change how you eat or train.';
  assert.equal(page.split(wellness).length - 1, 3, 'on the workout planner, food log and check-in');
  assert.ok(page.includes('Planning help, not financial advice.'));
  assert.ok(page.includes('Actual Budget and SimpleFIN Bridge are separate services under their own terms. Your bank login goes to them, never to 127.'));
  assert.ok(page.includes('Claude reads what your AI link allows, under your own terms with Anthropic and your settings there. <a class="link" href="/privacy#7a-hq-and-connected-accounts">What&#39;s shared</a>'));
  const js = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'life', f), 'utf8');
  assert.ok(js('faith.js').includes('Your reading plan and prayer times stay in this browser on this device. 127 never receives them.'));
  const readings = [...js('faith.js').matchAll(/el\('a', \{([^}]*href: link\([^}]*)\}/g)];
  assert.ok(readings.length >= 2);
  for (const [, attrs] of readings) assert.match(attrs, /rel: 'noopener noreferrer'/);
  // Budget starts empty: no example amounts in its script. The food example carries no target.
  assert.ok(!/EXAMPLE|example\(/.test(js('budget.js')));
  assert.match(js('food.js'), /target: 0, protein: 0/);
  // Forecasts and cautions run in the browser: no tool script calls the network except the bundled exercise list.
  for (const f of ['budget.js', 'train.js', 'food.js', 'body.js', 'faith.js', 'kit.js', 'chart.js']) {
    const src = js(f);
    assert.ok(!/XMLHttpRequest|sendBeacon|WebSocket|navigator\.sendBeacon/.test(src), f);
    for (const [, url] of src.matchAll(/fetch\('([^']+)'/g)) assert.equal(url, '/life/exercises.json', f);
  }
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
