// Native HQ tools (lib/tools, lib/tools-routes.js, views/app/hq2/tool*.ejs) behind HQ_TOOLS: off means 404 and no
// rail item; each tool's clean() keeps only its own fields; saving, loading, Start over, the CSV export (no formula
// cells) and account deletion; a tool above the member's plan opens with no saved data and refuses saves. No AI.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-tools-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-tools-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'ADMIN_EMAILS', 'HQ_TOOLS', 'HQ_WORKSPACE', 'HQ_PREMIUM']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const harness = require('../lib/harness');
const tools = require('../lib/tools');
const toolsRoutes = require('../lib/tools-routes');
const nav = require('../lib/harness/nav');
const { plan } = require('../lib/plans');

let seq = 0;
async function member(tier = 'builder') {
  seq += 1;
  return db.save('users', { id: `tl${seq}`, email: `tl${seq}@127.test`, name: `Maya Lane${seq}`, tier, emailVerified: true, answers: { model: 'service' } });
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
  app.use(toolsRoutes({ requireAuth }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, json, post } = {}) => {
    const h = {};
    if (as) h['x-user'] = as.id;
    let body;
    if (json !== undefined) { body = JSON.stringify(json); h['content-type'] = 'application/json'; }
    return fetch(url + p, { method: body !== undefined || post ? 'POST' : 'GET', headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

let s;
test.before(async () => { await db.init(); s = await server(); });
test.after(async () => { await s.close(); });
test.beforeEach(() => {
  process.env.HARNESS_V2 = 'on';
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
  process.env.HQ_TOOLS = 'on';
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

test('off: every tools route 404s and the rail has no Tools', async () => {
  delete process.env.HQ_TOOLS;
  const m = await member();
  for (const p of ['/app/hq/tools', '/app/hq/tools/profit', '/app/hq/tools/profit/export.csv']) assert.equal((await s.go(p, { as: m })).status, 404, p);
  assert.equal((await s.go('/app/hq/tools/profit/data', { as: m, json: { price: 1 } })).status, 404);
  process.env.HQ_WORKSPACE = 'on';
  const ws = nav.workspace(m, { flags: harness.flags.forUser(m) });
  assert.ok(!ws.groups.some((g) => g.items.some((i) => i.id === 'tools')));
  process.env.HQ_TOOLS = 'on';
  const on = nav.workspace(m, { flags: harness.flags.forUser(m) });
  assert.ok(on.groups.some((g) => g.items.some((i) => i.id === 'tools')));
  delete process.env.HQ_WORKSPACE;
});

test('clean keeps only each tool\'s own fields, clipped and clamped', () => {
  const c = tools._clean;
  const p = c.cleanProfit({ price: '$1,200', feePct: 900, repeats: 0, evil: 'x', name: 'A'.repeat(200) });
  assert.equal(p.price, 1200);
  assert.equal(p.feePct, 50);
  assert.equal(p.repeats, 1);
  assert.equal(p.name.length, 60);
  assert.ok(!('evil' in p));
  const v = c.cleanConversion({
    steps: [{ id: 'a', name: 'Visitors' }, { id: 'b<x>', name: 'Orders' }, { id: '', name: 'no id' }],
    weeks: [{ start: '2026-10-12', counts: { a: 10, b: 2, z: 9 } }, { start: '2026-10-19', counts: { a: '20' } }, { start: '2026-10-19', counts: { a: 1 } }, { start: 'nope' }],
  });
  assert.deepEqual(v.steps.map((x) => x.id), ['a', 'bx']);
  assert.deepEqual(v.weeks.map((w) => w.start), ['2026-10-19', '2026-10-12']);
  assert.deepEqual(v.weeks[0].counts, { a: 20, bx: 0 });
  const k = c.cleanCash({ cash: -50, ins: [{ name: 'Retainer', amount: 100, every: 'daily' }, {}], once: [{ name: 'Tax', amount: -900, week: 40 }] });
  assert.equal(k.cash, -50);
  assert.deepEqual(k.ins, [{ name: 'Retainer', amount: 100, every: 'month' }]);
  assert.equal(k.once[0].week, 13);
});

test('save, open, export and start over', async () => {
  const m = await member();
  const shelf = await (await s.go('/app/hq/tools', { as: m })).text();
  for (const t of tools.list()) assert.ok(shelf.includes(`/app/hq/tools/${t.id}`), t.id);
  const r = await s.go('/app/hq/tools/conversion/data', { as: m, json: { steps: [{ id: 'a', name: '=HYPERLINK("x")' }, { id: 'b', name: 'Sales' }], weeks: [{ start: '2026-10-19', counts: { a: 100, b: 3 }, revenue: 90 }] } });
  assert.equal(r.status, 200);
  assert.equal(tools.load(m.id, 'conversion').weeks[0].counts.b, 3);
  const page = await (await s.go('/app/hq/tools/conversion', { as: m })).text();
  assert.ok(page.includes('"canSave":true'));
  assert.ok(page.includes('/js/tools/conversion.js'));
  const csv = await (await s.go('/app/hq/tools/conversion/export.csv', { as: m })).text();
  assert.ok(csv.startsWith('Week of,"\'=HYPERLINK(""x"")",Sales,Revenue'), csv);
  assert.ok(csv.includes('2026-10-19,100,3,90'));
  assert.equal((await s.go('/app/hq/tools/conversion/clear', { as: m, post: true })).status, 302);
  assert.equal(tools.load(m.id, 'conversion'), null);
  assert.equal((await s.go('/app/hq/tools/nope', { as: m })).status, 404);
});

test('a tool above the plan opens with the example only and refuses saves', async () => {
  const m = await member('free');
  const page = await (await s.go('/app/hq/tools/cash', { as: m })).text();
  assert.ok(page.includes('comes with Builder'));
  assert.ok(page.includes('"canSave":false'));
  assert.equal((await s.go('/app/hq/tools/cash/data', { as: m, json: { cash: 5 } })).status, 403);
  assert.equal(tools.load(m.id, 'cash'), null);
  assert.equal((await s.go('/app/hq/tools/cash/export.csv', { as: m })).status, 404);
  // Profit and break-even is on every plan.
  assert.equal((await s.go('/app/hq/tools/profit/data', { as: m, json: { price: 40 } })).status, 200);
});

test('the largest cash plan fits, and account deletion removes every tool document', async () => {
  const m = await member();
  const big = { ins: Array.from({ length: 30 }, () => ({ name: 'x'.repeat(50), amount: 1 })), outs: Array.from({ length: 40 }, () => ({ name: 'y'.repeat(50), amount: 1 })), once: Array.from({ length: 60 }, () => ({ name: 'z'.repeat(50), amount: 1, week: 2 })) };
  assert.equal((await s.go('/app/hq/tools/cash/data', { as: m, json: big })).status, 200); // the most a cash plan can hold fits
  await tools.save(m.id, 'profit', { price: 10 });
  assert.ok(db.filter('tools', (d) => d.memberId === m.id).length === 2);
  await harness.forget(m.id);
  assert.equal(db.filter('tools', (d) => d.memberId === m.id).length, 0);
});
