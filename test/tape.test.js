// Tape (lib/tape, lib/tape-routes.js, views/app/hq2/tape.ejs) behind HQ_TAPE, Legal L88: off means 404 and no rail item;
// every sentence passes TK1's word check and the TK5 words sit on the page; without a key it runs on the invented
// sample tickers only; the member's key is encrypted, never sent back, and only used against the provider's host;
// one member's prices are never served to another; only the watchlist, levels and flags are stored.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-tape-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-tape-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'ADMIN_EMAILS', 'HQ_TAPE', 'HQ_WORKSPACE', 'HQ_PREMIUM', 'HQ_SECRET']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const harness = require('../lib/harness');
const tape = require('../lib/tape');
const tapeRoutes = require('../lib/tape-routes');
const nav = require('../lib/harness/nav');
const { plan } = require('../lib/plans');

const KEY = 'pk_test_ABCDEFGHIJKLMNOP1234';
let seq = 0;
async function member(tier = 'builder', email) {
  seq += 1;
  return db.save('users', { id: `tp${seq}`, email: email || `tp${seq}@127.test`, name: `Ray Cole${seq}`, tier, emailVerified: true, answers: { model: 'service' } });
}

// A stand-in for the provider: records every URL, answers with a short history and today's 5-minute bars.
const calls = [];
function fakeFetch(url) {
  calls.push(url);
  const u = new URL(url);
  const day = 86400000, now = Date.now();
  const series = u.pathname.includes('/range/1/day/')
    ? Array.from({ length: 40 }, (_, i) => ({ t: now - (40 - i) * day, o: 100 + i, h: 102 + i, l: 99 + i, c: 101 + i, v: 1e6 }))
    : [];
  if (u.searchParams.get('apiKey') === 'pk_bad_ABCDEFGHIJKLMNOP1234') return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
  return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'OK', results: series }) });
}

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
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
  app.use(tapeRoutes({ requireAuth }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, json } = {}) => fetch(url + p, {
    method: form || json ? 'POST' : 'GET',
    headers: { ...(as ? { 'x-user': as.id } : {}), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...(json ? { 'content-type': 'application/json' } : {}) },
    body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
    redirect: 'manual',
  });
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

let s;
test.before(async () => { await db.init(); tape.setDeps({ fetch: fakeFetch }); s = await server(); });
test.after(async () => { await s.close(); tape.setDeps(null); });
test.beforeEach(() => {
  process.env.HARNESS_V2 = 'on';
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
  process.env.HQ_TAPE = 'on';
  process.env.HQ_SECRET = 'x'.repeat(40);
  delete process.env.ADMIN_EMAILS;
  calls.length = 0;
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

test('off: every Tape route 404s and the rail has no Tape', async () => {
  delete process.env.HQ_TAPE;
  const m = await member();
  for (const p of ['/app/hq/tape', '/app/hq/tape/data?sym=KSTR']) assert.equal((await s.go(p, { as: m })).status, 404, p);
  assert.equal((await s.go('/app/hq/tape/save', { as: m, json: { list: ['AAPL'] } })).status, 404);
  process.env.HQ_WORKSPACE = 'on';
  assert.ok(!nav.workspace(m, { flags: harness.flags.forUser(m) }).groups.some((g) => g.items.some((i) => i.id === 'tape')));
  process.env.HQ_TAPE = 'on';
  assert.ok(nav.workspace(m, { flags: harness.flags.forUser(m) }).groups.some((g) => g.items.some((i) => i.id === 'tape')));
  delete process.env.HQ_WORKSPACE;
});

test('admins: only an admin with a confirmed email gets in', async () => {
  process.env.HQ_TAPE = 'admins';
  process.env.ADMIN_EMAILS = 'boss@127.test';
  const m = await member();
  const a = await member('builder', 'boss@127.test');
  assert.equal((await s.go('/app/hq/tape', { as: m })).status, 404);
  assert.equal((await s.go('/app/hq/tape', { as: a })).status, 200);
});

test('TK1: the word check drops every banned word, and no sample sentence carries one', () => {
  for (const w of tape.BANNED) assert.deepEqual(tape.guard([`It ${w} go.`, 'Volume is 2.0x normal.']), ['Volume is 2.0x normal.'], w);
  assert.deepEqual(tape.guard(['A threshold was crossed.', 'The household index.']), ['A threshold was crossed.', 'The household index.'], 'whole words only');
  const rec = { levels: { KSTR: [201], MRDN: [11.15] }, rules: tape.DEFAULT_RULES };
  for (const smp of tape.SAMPLE) for (const tf of ['1D', '5D', '1M', '3M', 'list']) {
    const out = tape.finish(tape.sample(smp.sym, tf), rec);
    const words = out.read.concat(out.notices.flatMap((n) => [n.title, n.line]));
    assert.ok(words.length > 2, `${smp.sym} ${tf}`);
    for (const line of words) assert.ok(tape.clean(line), `${smp.sym} ${tf}: ${line}`);
    assert.ok(!/forecast|predict|signal|pick|rating|score/i.test(words.join(' ')), `${smp.sym} ${tf}`);
  }
});

test('TK5 words on the page; sample data labeled; no key field below Builder', async () => {
  const m = await member('free');
  const page = await (await s.go('/app/hq/tape', { as: m })).text();
  assert.ok(page.includes("For information only, not investment advice. 127 isn&#39;t an investment adviser or broker-dealer"));
  assert.ok(page.includes('Trading can lose money.'));
  assert.ok(page.includes('Alerts can arrive late or not at all.'));
  assert.ok(page.includes('Sample data'));
  assert.ok(!page.includes('name="key"'));
  assert.ok(page.includes('comes with Builder'));
  assert.equal((await s.go('/app/hq/tape/save', { as: m, json: { list: ['AAPL'] } })).status, 403);
});

test('without a key: sample tickers only, and real symbols get nothing', async () => {
  const m = await member();
  const d = await (await s.go('/app/hq/tape/data?sym=KSTR&tf=1D&lv=201&off=vol', { as: m })).json();
  assert.equal(d.sample, true);
  assert.ok(d.bars.length > 10);
  assert.ok(d.notices.some((n) => n.title.includes('$201.00')));
  assert.ok(!d.notices.some((n) => /Volume is/.test(n.title)), 'a flag turned off on the page stays off');
  assert.equal((await s.go('/app/hq/tape/data?sym=AAPL', { as: m })).status, 404);
  assert.equal((await s.go('/app/hq/tape/data?sym=%3Cx%3E', { as: m })).status, 400);
  assert.equal(calls.length, 0, 'no provider call without a key');
});

test('TK3: the key is checked, encrypted, never shown again, and used only against the provider host', async () => {
  const m = await member();
  let r = await s.go('/app/hq/tape/key', { as: m, form: { provider: 'polygon', key: KEY } });
  assert.match(r.headers.get('location'), /m=bad/, 'the plan box must be ticked');
  r = await s.go('/app/hq/tape/key', { as: m, form: { provider: 'polygon', key: 'short', agree: 'yes' } });
  assert.match(r.headers.get('location'), /m=bad/);
  r = await s.go('/app/hq/tape/key', { as: m, form: { provider: 'polygon', key: KEY, agree: 'yes' } });
  assert.match(r.headers.get('location'), /m=on/);
  const raw = JSON.stringify(db.get('tape', m.id));
  assert.ok(!raw.includes(KEY), 'stored encrypted');
  assert.ok(raw.includes('"tail":"1234"'));
  const page = await (await s.go('/app/hq/tape', { as: m })).text();
  assert.ok(!page.includes(KEY));
  assert.ok(page.includes('Market data from Polygon.io'));
  assert.ok(page.includes('Data may be delayed'));

  const d = await (await s.go('/app/hq/tape/data?sym=AAPL&tf=1M', { as: m })).json();
  assert.equal(d.sample, false);
  assert.ok(d.bars.length > 5);
  assert.ok(d.read.every(tape.clean));
  assert.ok(calls.length >= 1 && calls.every((u) => new URL(u).host === 'api.polygon.io'));
  assert.ok(!JSON.stringify(d).includes(KEY), 'the key never comes back');

  r = await s.go('/app/hq/tape/key/remove', { as: m, form: {} });
  assert.match(r.headers.get('location'), /m=off/);
  assert.ok(!db.get('tape', m.id).key);
});

test('TK3: no key without HQ_SECRET; a refused key says so without echoing the provider', async () => {
  const m = await member();
  delete process.env.HQ_SECRET;
  let r = await s.go('/app/hq/tape/key', { as: m, form: { provider: 'polygon', key: KEY, agree: 'yes' } });
  assert.match(r.headers.get('location'), /m=bad/);
  assert.ok(!(await (await s.go('/app/hq/tape', { as: m })).text()).includes('name="key"'));
  process.env.HQ_SECRET = 'x'.repeat(40);
  await s.go('/app/hq/tape/key', { as: m, form: { provider: 'polygon', key: 'pk_bad_ABCDEFGHIJKLMNOP1234', agree: 'yes' } });
  r = await s.go('/app/hq/tape/data?sym=AAPL&tf=1M', { as: m });
  assert.equal(r.status, 401);
  const body = await r.text();
  assert.ok(!body.includes('pk_bad') && !body.includes('polygon.io/v2'));
});

test('TK3: one member\'s prices never serve another, and outside hosts are refused', async () => {
  const a = await member(), b = await member();
  for (const m of [a, b]) await s.go('/app/hq/tape/key', { as: m, form: { provider: 'polygon', key: KEY, agree: 'yes' } });
  await s.go('/app/hq/tape/data?sym=MSFT&tf=1M', { as: a });
  const n = calls.length;
  await s.go('/app/hq/tape/data?sym=MSFT&tf=1M', { as: a });
  assert.equal(calls.length, n, 'the same member reads their own minute cache');
  await s.go('/app/hq/tape/data?sym=MSFT&tf=1M', { as: b });
  assert.ok(calls.length > n, 'another member makes their own call');
  assert.ok([...tape._cache.keys()].every((k) => k.startsWith(`${a.id}|`) || k.startsWith(`${b.id}|`) || !k.includes('MSFT')));
  assert.ok(!tape.ALLOW.has('example.com') && tape.ALLOW.size === Object.keys(tape.PROVIDERS).length);
});

test('only the watchlist, levels and flags are stored, cleaned', async () => {
  const m = await member();
  const r = await s.go('/app/hq/tape/save', { as: m, json: { list: ['aapl', 'AAPL', '<script>', 'brk.b', ...Array.from({ length: 40 }, (_, i) => `T${i}`)], levels: { AAPL: [190, '200', -5, 'x'], 'B@D': [1] }, rules: { gap: false }, note: 'drop me' } });
  assert.equal(r.status, 200);
  const doc = db.get('tape', m.id);
  assert.equal(doc.list[0], 'AAPL');
  assert.equal(doc.list[1], 'BRK.B');
  assert.equal(doc.list.length, 30);
  assert.deepEqual(doc.levels, { AAPL: [190, 200] });
  assert.equal(doc.rules.gap, false);
  assert.equal(doc.rules.vol, true);
  assert.ok(!('note' in doc));
  const form = await s.go('/app/hq/tape/save', { as: m, form: { list: 'AAPL' } });
  assert.equal(form.status, 415, 'JSON only, so another site cannot post it from a form');
});

test('facts are worked out from the bars', () => {
  const day = 86400000;
  const hist = Array.from({ length: 30 }, (_, i) => ({ t: i * day, o: 10 + i, h: 10.5 + i, l: 9.5 + i, c: 10 + i, v: 1000 }));
  const f = tape.facts({ hist, today: null, day: null });
  assert.equal(f.prev, 39);
  assert.equal(f.streak, 29, 'every close higher than the one before');
  assert.equal(Math.round(f.rsi), 100);
  assert.equal(f.sma20, 29.5);
  const lines = tape.read('TEST', { ...f, last: 39 });
  assert.ok(lines.some((l) => l.includes('29 higher closes in a row')));
  assert.ok(lines.every(tape.clean));
});
