// Verticals (lib/verticals.js, content/verticals): every vertical file passes its checks and the copy rules, its pack
// joins the shop unlisted, the built kits and samples are current, first-touch tagging, the board's counts and
// verdicts, the weekly readout, and the routes behind VERTICALS (off, admins, on). No network.

const path = require('path');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-verticals-${process.pid}.json`);
process.env.BASE_URL = 'https://127.test';
process.env.SITE_MOTION = 'on';
for (const k of ['VERTICALS', 'SHOP_PACKS', 'ADMIN_EMAILS', 'DEMO_BILLING', 'FRONT_DOORS']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieSession = require('cookie-session');

const db = require('../lib/db');
const V = require('../lib/verticals');
const shop = require('../lib/shop');
const { plan } = require('../lib/plans');

const R = V.rules();

test.before(async () => {
  await db.init();
  V._reset();
  shop._reset();
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
});

test('every vertical passes its checks: designs, Store items, HQ packs, copy rules', () => {
  const a = V.all();
  assert.ok(a.list.length >= 20, `only ${a.list.length} verticals`);
  assert.deepEqual(a.problems, []);
  const keys = new Set(a.list.map((v) => v.keyword));
  assert.equal(keys.size, a.list.length, 'every ManyChat keyword is its own');
});

test('every built vertical has its kit, its sample site and its poster, and they match the file', () => {
  for (const v of V.all().list.filter((x) => x.status !== 'draft')) {
    for (const p of v.pack.prompts) {
      const f = path.join(V.KITS_DIR, v.kit, `${p.id}.md`);
      assert.ok(fs.existsSync(f), `${v.slug}: run node scripts/build-verticals.js (${p.id}.md missing)`);
      assert.equal(fs.readFileSync(f, 'utf8'), V.promptFile(v, p), `${v.slug}/${p.id}.md is stale: run node scripts/build-verticals.js ${v.slug}`);
    }
    assert.ok(V.sampleFile(v), `${v.slug}: no sample site`);
    assert.ok(V.posterPath(v), `${v.slug}: no poster (node scripts/build-verticals.js ${v.slug} --shots)`);
    const html = fs.readFileSync(V.sampleFile(v), 'utf8');
    assert.match(html, /is a made-up business/, `${v.slug}: the sample says it's made up`);
    assert.match(html, /noindex/, `${v.slug}: the sample stays out of search`);
  }
});

test('vertical packs join the shop unlisted: sold on their page, not on /packs or the bundle page', () => {
  const c = shop.catalog();
  assert.deepEqual(c.problems, []);
  const v = V.get('dog-breeders');
  const p = shop.get(v.packSlug);
  assert.ok(p, 'the breeder pack is in the catalog');
  assert.equal(p.price, v.pack.price);
  assert.equal(p.count, v.pack.items.length + v.pack.prompts.length);
  assert.ok(!shop.list().some((x) => x.slug.startsWith('v-')), '/packs lists no vertical pack');
  assert.ok(!shop.bundleContents().some((x) => x.slug.startsWith('v-')));
  // Builder owns every pack, vertical ones too.
  assert.equal(shop.owns({ id: 'b1', tier: 'builder', email: 'b@127.test' }, v.packSlug), true);
});

test('first touch: a v-<slug> campaign or the first page wins, later ones do not', () => {
  assert.equal(V.fromCampaign('v-dog-breeders'), 'dog-breeders');
  assert.equal(V.fromCampaign('V-Dog-Breeders'), 'dog-breeders');
  assert.equal(V.fromCampaign('v-nope'), null);
  assert.equal(V.fromCampaign('fall-sale'), null);
  const req = { session: {}, query: { utm_campaign: 'v-gym-owners' } };
  V.middleware(req, {}, () => {});
  assert.equal(req.session.vertical, 'gym-owners');
  V.tag(req, 'dog-breeders');
  assert.equal(V.current(req), 'gym-owners');
});

test('the free start goes to the door with the tag, or to the free plan (founding list before launch)', () => {
  const v = V.get('dog-breeders');
  assert.match(V.entryUrl(v, { doorsLive: true }), /^\/site-tonight\?.*utm_campaign=v-dog-breeders/);
  assert.match(V.entryUrl(v, { doorsLive: false, prelaunch: false }), /^\/start\?from=v-dog-breeders/);
  assert.match(V.entryUrl(v, { doorsLive: false, prelaunch: true }), /^\/founding\?/);
  assert.match(V.entryUrl(V.get('eyewear-brands'), { doorsLive: true }), /^\/store-audit\?/);
});

// ---- the board ----

const L = (slug, status = 'test') => ({ slug, name: slug, group: 'g', status, pack: { price: 39 } });
function fixture() {
  const list = [L('a'), L('b'), L('c'), L('d'), L('e', 'ready')];
  const counters = [{ id: 'verticals:2026-11-02', day: '2026-11-02', counts: { 'a|visit|meta': 300, 'a|go|meta': 90, 'b|visit|instagram': 400, 'c|visit|direct': 200, 'd|visit|meta': 40, 'b|visit|meta': 100 } }];
  const at = '2026-11-02T15:00:00Z';
  const users = [];
  const waitlist = [];
  for (let i = 0; i < 30; i++) users.push({ id: `ua${i}`, email: `a${i}@x.test`, createdAt: at, vertical: 'a' });
  for (let i = 0; i < 5; i++) waitlist.push({ email: `b${i}@x.test`, createdAt: at, vertical: 'b' });
  for (let i = 0; i < 12; i++) users.push({ id: `uc${i}`, email: `c${i}@x.test`, createdAt: at, utm: { utm_campaign: 'v-c' } });
  // The same person on the list and with an account counts once.
  waitlist.push({ email: 'a0@x.test', createdAt: '2026-11-01T15:00:00Z', vertical: 'a' });
  // A demo account never counts.
  users.push({ id: 'demo', email: 'demo@x.test', createdAt: at, vertical: 'a', demoAccount: true });
  const purchases = [
    { pack: 'v-a', amount: 39, paidAt: at },
    { pack: 'motion', amount: 49, paidAt: at, vertical: 'a' },
    { pack: 'v-a', amount: 39, paidAt: at, refundedAt: at },
    { pack: 'v-b', amount: 39, paidAt: at, demo: true },
  ];
  const billingRecords = [{ userId: 'ua1', kind: 'start', plan: 'builder', at }, { userId: 'ua1', kind: 'upgrade', plan: 'builder', at: '2026-11-03T15:00:00Z' }, { userId: 'demo', kind: 'start', plan: 'builder', at }];
  const spend = [{ slug: 'b', week: '2026-11-02', usd: 160 }];
  return { list, counters, users, waitlist, purchases, billingRecords, spend };
}

test('the board counts each step once, by vertical', () => {
  const rows = V.board(fixture(), {}, R);
  const a = rows.find((r) => r.slug === 'a');
  assert.equal(a.visits, 300);
  assert.equal(a.starts, 90);
  assert.equal(a.signups, 30, 'one person on the list and with an account counts once; the demo account never');
  assert.equal(a.packs, 2, 'its own pack and another pack bought by someone it brought; refunds never');
  assert.equal(a.packRevenue, 88);
  assert.equal(a.builders, 1, 'a member counts once as a Builder start; demo accounts never');
  const b = rows.find((r) => r.slug === 'b');
  assert.equal(b.visits, 500);
  assert.deepEqual(b.sources, { instagram: 400, meta: 100 });
  assert.equal(b.packs, 0, 'demo purchases never count');
  assert.equal(rows.find((r) => r.slug === 'c').signups, 12, 'a v-<slug> campaign on the account counts');
});

test('verdicts: double down, kill, keep testing and too early, from the rules file', () => {
  const rows = V.board(fixture(), {}, R);
  const by = Object.fromEntries(rows.map((r) => [r.slug, r]));
  assert.equal(by.a.verdict, 'double', by.a.why);
  assert.equal(by.b.verdict, 'kill', 'spend with nobody paying');
  assert.match(by.b.why, /\$160 spent/);
  assert.equal(by.c.verdict, 'keep', by.c.why);
  assert.equal(by.d.verdict, 'early');
  assert.equal(by.e.verdict, 'off');
  assert.equal(rows[0].slug, 'a', 'double downs first');
  // A low signup rate kills once there are enough visits.
  const low = V.board({ list: [L('x')], counters: [{ day: '2026-11-02', counts: { 'x|visit|meta': 400 } }], users: [{ id: 'u', email: 'u@x', createdAt: '2026-11-02T15:00:00Z', vertical: 'x' }] }, {}, R);
  assert.equal(low[0].verdict, 'kill');
});

test('the readout covers last Monday to Sunday in Chicago and names what to do', () => {
  assert.deepEqual(V.lastWeek(Date.parse('2026-11-04T18:00:00Z')), { from: '2026-10-26', to: '2026-11-01' });
  assert.deepEqual(V.lastWeek(Date.parse('2026-11-02T03:00:00Z')), { from: '2026-10-19', to: '2026-10-25' }, 'Sunday night in Chicago is still the old week');
  const rows = V.board(fixture(), {}, R);
  const r = V.readout(rows, rows, { from: '2026-11-02', to: '2026-11-08' });
  assert.match(r.markdown, /## Double down[\s\S]*\*\*a\*\*/);
  assert.match(r.markdown, /## Kill[\s\S]*\*\*b\*\*/);
  assert.match(r.markdown, /Eli's call/);
});

// ---- routes ----

function locals(user, req) {
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: false, path: req.path, flash: null,
    launch: { prelaunch: true, foundingPrice: 19, launchDate: 'Nov 17', closesShort: 'Nov 24' }, pauseInfo: null, ageReview: false, stripeLive: false, demoBilling: false, checkoutCancelled: false,
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null, hqLive: false,
  };
}
async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieSession({ name: 's', keys: ['k'] }));
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    Object.assign(res.locals, locals(req.user, req));
    V.middleware(req, res, next);
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const requireAdmin = (req, res, next) => (require('../lib/harness/flags').admin(req.user) ? next() : res.status(404).send('404'));
  app.use(require('../lib/verticals-routes')({ requireAuth, requireAdmin, doorsLive: () => false, builderPrice: () => 29, track: () => {} }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  let cookie = '';
  const go = async (p, { as, form, ua = 'Mozilla/5.0 (iPhone)' } = {}) => {
    const h = { 'user-agent': ua };
    if (as) h['x-user'] = as.id;
    if (cookie) h.cookie = cookie;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    const res = await fetch(url + p, { method: body !== undefined ? 'POST' : 'GET', headers: h, body, redirect: 'manual' });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return res;
  };
  return { go, reset: () => { cookie = ''; }, close: () => new Promise((r) => srv.close(r)) };
}

test('routes: off 404s, admins see every built vertical, on shows only the testing ones', async () => {
  const s = await server();
  const admin = await db.save('users', { id: 'vadmin', email: 'admin@127.test', tier: 'free', emailVerified: true });
  try {
    assert.equal((await s.go('/for/dog-breeders')).status, 404);
    assert.equal((await s.go('/for')).status, 404);
    process.env.VERTICALS = 'admins';
    process.env.ADMIN_EMAILS = 'admin@127.test';
    assert.equal((await s.go('/for/dog-breeders')).status, 404, 'a visitor sees nothing while it is admins');
    const ready = await s.go('/for/pet-groomers', { as: admin });
    assert.equal(ready.status, 200, 'an admin sees a ready vertical');
    assert.match(await ready.text(), /noindex/);
    process.env.VERTICALS = 'on';
    const page = await s.go('/for/dog-breeders');
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /The <span class="vt-mark">waitlist/);
    assert.match(html, /Breeder Pack/);
    assert.match(html, /locked as long as you stay/);
    assert.doesNotMatch(html, /noindex/);
    assert.equal((await s.go('/for/pet-groomers')).status, 404, 'a ready vertical stays off for visitors');
    assert.equal((await s.go('/for')).status, 200);
    const sample = await s.go('/for/dog-breeders/sample');
    assert.equal(sample.status, 200);
    assert.equal(sample.headers.get('x-robots-tag'), 'noindex');
  } finally {
    delete process.env.VERTICALS;
    delete process.env.ADMIN_EMAILS;
    await s.close();
  }
});

test('routes: a visit and a free start count once per visitor per day, and the start carries the tag', async () => {
  const s = await server();
  process.env.VERTICALS = 'on';
  try {
    const before = JSON.stringify(db.filter('counters', (c) => String(c.id).startsWith('verticals:')));
    await s.go('/for/gym-owners?utm_source=instagram');
    await s.go('/for/gym-owners');
    await s.go('/for/gym-owners', { ua: 'facebookexternalhit/1.1' });
    const go = await s.go('/for/gym-owners/go');
    assert.equal(go.status, 303);
    assert.match(go.headers.get('location'), /^\/founding\?.*utm_campaign=v-gym-owners/);
    await s.go('/for/gym-owners/go');
    const docs = db.filter('counters', (c) => String(c.id).startsWith('verticals:'));
    assert.notEqual(JSON.stringify(docs), before);
    const counts = docs.reduce((a, d) => ({ ...a, ...d.counts }), {});
    assert.equal(counts['gym-owners|visit|instagram'], 1);
    assert.equal(counts['gym-owners|go|instagram'], 1);
    // First touch: a later vertical page doesn't take the visitor.
    const was = V.fromStore({}).find((r) => r.slug === 'dog-breeders').visits;
    await s.go('/for/dog-breeders');
    assert.equal(V.fromStore({}).find((r) => r.slug === 'dog-breeders').visits, was + 1, 'the second vertical still counts its own visit');
  } finally {
    delete process.env.VERTICALS;
    await s.close();
  }
});

test('routes: the board, the kit and the readout are admins only; status and spend save', async () => {
  const s = await server();
  const admin = await db.save('users', { id: 'vadmin2', email: 'boss@127.test', tier: 'free', emailVerified: true });
  const guest = await db.save('users', { id: 'vguest', email: 'guest@127.test', tier: 'free', emailVerified: true });
  process.env.ADMIN_EMAILS = 'boss@127.test';
  try {
    assert.equal((await s.go('/admin/verticals', { as: guest })).status, 404);
    const board = await s.go('/admin/verticals', { as: admin });
    assert.equal(board.status, 200);
    assert.match(await board.text(), /Dog breeders/);
    assert.equal((await s.go('/admin/verticals/week', { as: admin })).status, 200);
    const md = await s.go('/admin/verticals/week.md', { as: admin });
    assert.match(md.headers.get('content-type'), /markdown/);
    const kit = await s.go('/admin/verticals/dog-breeders', { as: admin });
    assert.match(await kit.text(), /utm_campaign=v-dog-breeders/);
    const st = await s.go('/admin/verticals/dog-breeders/status', { as: admin, form: { status: 'killed' } });
    assert.equal(st.status, 303);
    assert.equal(V.statusOf(V.get('dog-breeders')), 'killed');
    process.env.VERTICALS = 'on';
    s.reset();
    assert.equal((await s.go('/for/dog-breeders')).status, 404, 'a killed vertical stops showing');
    await s.go('/admin/verticals/dog-breeders/status', { as: admin, form: { status: 'test' } });
    await s.go('/admin/verticals/dog-breeders/spend', { as: admin, form: { week: '2026-11-02', usd: '42.5', note: 'Meta' } });
    assert.equal(db.get('verticalSpend', 'dog-breeders:2026-11-02').usd, 42.5);
    const bad = await s.go('/admin/verticals/dog-breeders/spend', { as: admin, form: { week: 'monday', usd: '10' } });
    assert.match(bad.headers.get('location'), /spend-error/);
  } finally {
    delete process.env.VERTICALS;
    delete process.env.ADMIN_EMAILS;
    await s.close();
  }
});
