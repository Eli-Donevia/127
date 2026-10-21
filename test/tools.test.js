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
      fmtDate: () => null, plausible: '127.test', trackEvents: [], canonical: 'https://127.test', baseUrl: 'https://127.test', adConsentScript: '<script src="https://ads.example/tag.js"></script>', description: null, hqLive: true,
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

test('the newer tools clean to their own fields too', () => {
  const c = tools._clean;
  const a = c.cleanAdtest({ platform: 'myspace', goal: 'x', days: 0, log: [{ day: '2026-10-20', spend: 12 }, { day: '2026-10-19', spend: 9 }, { day: '2026-10-20', spend: 99 }, { day: 'no' }] });
  assert.equal(a.platform, 'meta');
  assert.equal(a.goal, 'sales');
  assert.equal(a.days, 1);
  assert.deepEqual(a.log.map((r) => [r.day, r.spend]), [['2026-10-19', 9], ['2026-10-20', 12]]);
  const hk = c.cleanHooks({ stars: ['1', '1', 'nope'], mine: { 1: 'My take', nope: 'x' }, wins: { 1: '300' } });
  assert.deepEqual(hk, { stars: ['1'], mine: { 1: 'My take' }, wins: { 1: 300 } });
  const id = c.cleanIdeas({ ideas: [{ id: 'a', name: 'Tutoring', scores: { pain: 14, edge: -3 } }, { id: 'b' }, ...Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, name: 'x' }))] });
  assert.equal(id.ideas.length, 7); // eight kept, the empty one dropped
  assert.deepEqual(id.ideas[0].scores, { pain: 10, economics: 0, edge: 0, future: 0, inside: 0 });
  const ck = c.cleanChecklists({ done: { 'not-an-item': '2026-10-20' }, launch: '2026-11-17' });
  assert.deepEqual(ck.done, {});
  assert.equal(ck.launch, '2026-11-17');
  const sk = c.cleanStock({ items: [{ id: 'a', name: 'Candle', onHand: -4, leadWeeks: 99, extra: 1 }, { id: 'b' }] });
  assert.deepEqual(sk.items, [{ id: 'a', name: 'Candle', onHand: 0, perWeek: 0, leadWeeks: 52, order: 0, cost: 0 }]);
  const hr = c.cleanHours({ tasks: [{ id: 'a', name: 'Invoices', hours: 400, tag: 'boss' }], tools: [{ id: 't', name: 'Canva', cost: 15, used: 1 }] });
  assert.deepEqual(hr.tasks, [{ id: 'a', name: 'Invoices', hours: 168, tag: 'me' }]);
  assert.equal(hr.tools[0].used, true);
  const ct = c.cleanContent({ pillars: ['Tips'], days: [9, 2, 2, 0], start: '2026-10-19', posts: { '2026-10-19': { pillar: 7, state: 'viral', hook: 'Hi' }, nope: {} } });
  assert.deepEqual(ct.pillars, ['Tips', '', '']);
  assert.deepEqual(ct.days, [0, 2, 6]);
  assert.deepEqual(Object.keys(ct.posts), ['2026-10-19']);
  assert.equal(ct.posts['2026-10-19'].pillar, 2);
  assert.equal(ct.posts['2026-10-19'].state, 'idea');
});

test('a tool Legal has not cleared shows to admins only', async () => {
  const m = await member();
  tools.CLEARED.delete('stock');
  try {
    const shelf = await (await s.go('/app/hq/tools', { as: m })).text();
    assert.ok(!shelf.includes('/app/hq/tools/stock"'));
    assert.ok(shelf.includes('/app/hq/tools/profit"'));
    assert.ok(!tools.list().some((t) => t.id === 'stock'));
    assert.equal((await s.go('/app/hq/tools/stock', { as: m })).status, 404);
    assert.equal((await s.go('/app/hq/tools/stock/data', { as: m, json: { items: [] } })).status, 404);
    process.env.ADMIN_EMAILS = m.email;
    assert.equal((await s.go('/app/hq/tools/stock', { as: m })).status, 200);
    assert.ok((await (await s.go('/app/hq/tools', { as: m })).text()).includes('Admins only until Legal clears it'));
  } finally {
    tools.CLEARED.add('stock');
    delete process.env.ADMIN_EMAILS;
  }
  // Legal L82 and L92 cleared every tool built so far.
  assert.deepEqual(tools.list().map((t) => t.id), tools.list({ all: true }).map((t) => t.id));
});

test('every newer tool saves, opens and exports; free plans keep ideas and content', async () => {
  const m = await member();
  const lists = require('../content/tools/checklists.json').lists;
  const item = lists[0].groups[0].items[0];
  const docs = {
    adtest: [{ name: 'Reels test', line: 20, log: [{ day: '2026-10-20', spend: 15, clicks: 40, results: 1 }] }, '2026-10-20,15,40,1'],
    hooks: [{ stars: ['1'], mine: { 1: '+my version' } }, "'+my version"],
    ideas: [{ ideas: [{ id: 'a', name: 'Tutoring', scores: { pain: 8, economics: 7, edge: 6, future: 6, inside: 8 } }] }, 'Tutoring,8,7,6,6,8,35'],
    checklists: [{ done: { [item.id]: '2026-10-20' } }, '2026-10-20'],
    stock: [{ items: [{ id: 'a', name: 'Candle', onHand: 46, perWeek: 9, leadWeeks: 2, order: 60, cost: 4.2 }] }, 'Candle,46,9,2,60,4.2'],
    hours: [{ tasks: [{ id: 'a', name: 'Invoices', hours: 2, tag: 'repeat' }], tools: [{ id: 't', name: 'Canva', cost: 15, job: 'Posts', used: true }] }, 'tool,Canva,15,Posts,yes'],
    content: [{ pillars: ['Tips', 'Story', 'Proof'], days: [0], start: '2026-10-19', posts: { '2026-10-19': { pillar: 1, hook: 'Day one', state: 'posted', views: 620 } } }, '2026-10-19,Story,Day one,posted,620'],
  };
  process.env.ADMIN_EMAILS = m.email;
  for (const [id, [doc, line]] of Object.entries(docs)) {
    assert.equal((await s.go(`/app/hq/tools/${id}/data`, { as: m, json: doc })).status, 200, id);
    const page = await (await s.go(`/app/hq/tools/${id}`, { as: m })).text();
    assert.ok(page.includes(`/js/tools/${id}.js`), id);
    const csv = await (await s.go(`/app/hq/tools/${id}/export.csv`, { as: m })).text();
    assert.ok(csv.includes(line), `${id}: ${csv}`);
  }
  // The ad test reads Profit's numbers for its default line.
  await tools.save(m.id, 'profit', { price: 80, unitCost: 20 });
  assert.ok((await (await s.go('/app/hq/tools/adtest', { as: m })).text()).includes('"price":80'));
  const f = await member('free');
  process.env.ADMIN_EMAILS = f.email;
  for (const id of ['ideas', 'content']) assert.equal((await s.go(`/app/hq/tools/${id}/data`, { as: f, json: docs[id][0] })).status, 200, id);
  for (const id of ['adtest', 'hooks', 'checklists', 'stock', 'hours']) assert.equal((await s.go(`/app/hq/tools/${id}/data`, { as: f, json: docs[id][0] })).status, 403, id);
  delete process.env.ADMIN_EMAILS;
});

test('the fullest content, stock, hours and hooks documents fit', async () => {
  const m = await member();
  process.env.ADMIN_EMAILS = m.email;
  const posts = {};
  for (let i = 0; i < 120; i += 1) posts[new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)] = { pillar: 1, hook: 'h'.repeat(200), state: 'posted', views: 123456789 };
  const hookIds = require('../content/tools/hooks.json').hooks.map((h) => String(h.id));
  const full = {
    content: { pillars: ['p'.repeat(40), 'p'.repeat(40), 'p'.repeat(40)], platform: 'x'.repeat(30), days: [0, 1, 2, 3, 4, 5, 6], start: '2026-10-19', posts },
    stock: { items: Array.from({ length: 80 }, (_, i) => ({ id: `i${i}`, name: 'n'.repeat(60), onHand: 1e7, perWeek: 1e6, leadWeeks: 52, order: 1e7, cost: 999999.99 })) },
    hours: { tasks: Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, name: 'n'.repeat(60), hours: 168, tag: 'repeat' })), tools: Array.from({ length: 40 }, (_, i) => ({ id: `u${i}`, name: 'n'.repeat(50), cost: 99999, job: 'j'.repeat(60), used: true })) },
    hooks: { stars: hookIds, mine: Object.fromEntries(hookIds.map((k) => [k, 'm'.repeat(300)])), wins: Object.fromEntries(hookIds.map((k) => [k, 999999999])) },
  };
  for (const [id, doc] of Object.entries(full)) assert.equal((await s.go(`/app/hq/tools/${id}/data`, { as: m, json: doc })).status, 200, id);
  delete process.env.ADMIN_EMAILS;
});

test('Week builder lives on the device only: no save, clear or export route, no outside scripts (Legal L92 HT8)', async () => {
  const m = await member();
  const page = await (await s.go('/app/hq/tools/week', { as: m })).text();
  assert.ok(page.includes('/js/tools/week.js'));
  assert.ok(page.includes(`"member":"${m.id}"`));
  assert.ok(page.includes('Clear from this device'));
  assert.ok(!page.includes('plausible.io') && !page.includes('ads.example'));
  for (const p of ['/app/hq/tools/week/export.csv', '/app/hq/tools/week/export.ics']) assert.equal((await s.go(p, { as: m })).status, 404, p);
  assert.equal((await s.go('/app/hq/tools/week/data', { as: m, json: { blocks: [{ id: 'a', kind: 'faith', day: 0, from: 480, len: 30 }] } })).status, 404);
  assert.equal((await s.go('/app/hq/tools/week/clear', { as: m, post: true })).status, 404);
  assert.equal(db.filter('tools', (d) => d.memberId === m.id).length, 0);
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tools', 'week.js'), 'utf8');
  assert.doesNotMatch(js, /T\.save\(|fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(js, /T\.device\.set\('week'/);
  assert.match(js, /T\.download\('my-week\.ics', 'text\/calendar'/);
  // Other tools still load the site's scripts as usual.
  assert.ok((await (await s.go('/app/hq/tools/profit', { as: m })).text()).includes('plausible.io'));
});

test('Money overview keeps month totals only: category rules stay on the device, bank rows never leave the page', async () => {
  const c = tools._clean.cleanMoney({
    cats: ['Rent', 'Ads', ''],
    months: [{ month: '2026-09', revenue: '8,830', costs: [1350, '575', 99], cash: -40, rows: [{ desc: 'GUSTO' }] }, { month: '2026-09', revenue: 1 }, { month: '2026-13', revenue: 5 }, { month: '2026-10', revenue: 10, cash: '' }],
    bills: [{ id: 'b', name: 'Insurance', amount: 340, due: '2026-10-30' }, { id: 'x' }],
    invoices: [{ id: 'i', name: 'Invoice 104', amount: 1800, due: 'soon', paid: 1 }],
    rules: [{ match: 'HOME DEPOT', cat: 0 }, { match: 'transfer', cat: -1 }, { match: 'nope', cat: 7 }],
    transactions: [{ desc: 'x' }],
  });
  assert.deepEqual(c.months.map((m) => m.month), ['2026-10', '2026-09']);
  assert.deepEqual(c.months[1], { month: '2026-09', revenue: 8830, costs: [1350, 575], cash: -40 });
  assert.equal(c.months[0].cash, null);
  assert.deepEqual(c.bills.map((b) => b.id), ['b']);
  assert.equal(c.invoices[0].due, null);
  assert.equal(c.invoices[0].paid, true);
  assert.ok(!('rules' in c)); // L92 MO2: kept in the browser
  assert.ok(!('transactions' in c));
  const m = await member();
  process.env.ADMIN_EMAILS = m.email;
  assert.equal((await s.go('/app/hq/tools/money/data', { as: m, json: c })).status, 200);
  const csv = await (await s.go('/app/hq/tools/money/export.csv', { as: m })).text();
  assert.ok(csv.includes('Month,Revenue,Rent,Ads,Cash at month end') && csv.includes('2026-09,8830,1350,575,-40') && csv.includes('invoice,Invoice 104,1800,,yes'), csv);
  const f = await member('free');
  process.env.ADMIN_EMAILS = f.email;
  assert.equal((await s.go('/app/hq/tools/money/data', { as: f, json: c })).status, 403);
  delete process.env.ADMIN_EMAILS;
  // L92 MO3: no outside scripts on the page, and the page only ever posts category names, month totals, bills and
  // invoices: a bank file is read and added up in the browser.
  process.env.ADMIN_EMAILS = m.email;
  const page = await (await s.go('/app/hq/tools/money', { as: m })).text();
  assert.ok(!page.includes('plausible.io') && !page.includes('ads.example'));
  delete process.env.ADMIN_EMAILS;
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tools', 'money.js'), 'utf8');
  assert.match(js, /function saved\(d\) \{ return \{ cats: d\.cats, months: d\.months, bills: d\.bills, invoices: d\.invoices \}; \}/);
  assert.deepEqual(js.match(/T\.save\([^)]*\)/g), ['T.save(saved(data)']);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|FormData/);
  assert.match(js, /T\.device\.set\('money-rules', data\.rules\)/);
  // No example money in the page script (Legal L82 T2).
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tools', 'money.js'), 'utf8'), /function example|EXAMPLE/);
});

test('Clients, Interview board and Quote builder clean, save, export and fit at their fullest (Legal L92)', async () => {
  const m = await member();
  const docs = {
    clients: [{ clients: [{ id: 'c1', name: 'Maya', reach: 'maya@example.com', pkg: 'Ten sessions', bought: 10, status: 'active', note: 'Goals', sessions: [{ id: 's1', day: '2026-10-20', len: 60, state: 'done' }], extra: 'x' }] }, 'Maya,maya@example.com,Ten sessions,10,active,Goals,2026-10-20,60,done'],
    interviews: [{ idea: 'Meal plans', people: [{ id: 'p1', who: 'Night nurse', day: '2026-10-20', done: true, pain: 3, last: 'Vending machine', tried: 'Kits', stop: 'Another subscription', pay: 'maybe 20 a month' }] }, 'Night nurse,2026-10-20,yes,3,Vending machine,Kits,Another subscription,maybe 20 a month'],
    quote: [{ from: 'Lane Studio', quotes: [{ id: 'q1', number: 'Q-0001', client: 'Dana', title: 'Refresh', items: [{ name: 'Pages', qty: 4, price: 350 }], tax: 8.25, made: '2026-10-21', until: '2026-11-20', terms: 'Half up front.\nRest on delivery.', state: 'sent' }] }, 'Q-0001,Dana,Refresh,sent,2026-10-21,2026-11-20,Pages,4,350,1400,8.25'],
  };
  for (const [id, [doc, line]] of Object.entries(docs)) {
    assert.equal((await s.go(`/app/hq/tools/${id}/data`, { as: m, json: doc })).status, 200, id);
    assert.ok((await (await s.go(`/app/hq/tools/${id}`, { as: m })).text()).includes(`/js/tools/${id}.js`), id);
    const csv = await (await s.go(`/app/hq/tools/${id}/export.csv`, { as: m })).text();
    assert.ok(csv.includes(line), `${id}: ${csv}`);
  }
  assert.equal(tools.load(m.id, 'clients').clients[0].extra, undefined);
  assert.equal(tools.load(m.id, 'quote').quotes[0].terms, 'Half up front.\nRest on delivery.');
  const c = tools._clean;
  assert.equal(c.cleanClients({ clients: [{ id: 'a', name: 'A', bought: 9999, status: 'vip', sessions: [{ id: 's', day: 'nope' }] }] }).clients[0].bought, 500);
  assert.equal(c.cleanClients({ clients: [{ id: 'a', name: 'A', status: 'vip' }] }).clients[0].status, 'active');
  assert.equal(c.cleanInterviews({ people: [{ id: 'a', who: 'A', pain: 9 }] }).people[0].pain, 3);
  assert.equal(c.cleanQuote({ quotes: [{ id: 'a', tax: 99, items: [{ name: 'x', qty: 1, price: 1 }] }] }).quotes[0].tax, 30);

  const sessions = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, day: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), len: 480, state: 'noshow' }));
  const full = {
    clients: { clients: Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, name: 'n'.repeat(40), reach: 'r'.repeat(80), pkg: 'p'.repeat(40), bought: 500, status: 'paused', note: 'o'.repeat(280), sessions: sessions(i < 10 ? 25 : 0) })) },
    interviews: { idea: 'i'.repeat(80), people: Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, who: 'w'.repeat(40), day: '2026-10-20', done: true, pain: 3, last: 'l'.repeat(240), tried: 't'.repeat(240), stop: 's'.repeat(240), pay: 'p'.repeat(40) })) },
    quote: { from: 'f'.repeat(60), quotes: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, number: 'n'.repeat(20), client: 'c'.repeat(60), title: 't'.repeat(80), items: Array.from({ length: 20 }, () => ({ name: 'i'.repeat(80), qty: 99999, price: 9999999 })), tax: 30, made: '2026-10-21', until: '2026-11-20', terms: 't'.repeat(600), state: 'declined' })) },
  };
  for (const [id, doc] of Object.entries(full)) assert.equal((await s.go(`/app/hq/tools/${id}/data`, { as: m, json: doc })).status, 200, id);
  assert.equal(tools.load(m.id, 'clients').clients.reduce((n, x) => n + x.sessions.length, 0), 250);
  assert.equal(c.cleanClients({ clients: [{ id: 'a', name: 'A', sessions: sessions(120) }, { id: 'b', name: 'B', sessions: sessions(120) }, { id: 'c', name: 'C', sessions: sessions(120) }] }).clients[2].sessions.length, 10);
  // Free plans keep the Interview board; Clients and Quote come with Builder.
  const f = await member('free');
  assert.equal((await s.go('/app/hq/tools/interviews/data', { as: f, json: docs.interviews[0] })).status, 200);
  for (const id of ['clients', 'quote']) assert.equal((await s.go(`/app/hq/tools/${id}/data`, { as: f, json: docs[id][0] })).status, 403, id);
  assert.equal((await s.go('/app/hq/tools/quote/share', { as: f, json: { id: 'q1', on: true } })).status, 403);

  // The pages: nothing sends, looks up or adds up (L92); the wording Legal set.
  const js = (id) => fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tools', `${id}.js`), 'utf8');
  assert.doesNotMatch(js('clients'), /fetch\(|XMLHttpRequest|sendBeacon|pipeline/i);
  assert.match(js('clients'), /How you reach them, optional/);
  assert.doesNotMatch(js('interviews'), /fetch\(|XMLHttpRequest|sendBeacon|T\.num\(p\.pay|parseFloat/);
  assert.match(js('interviews'), /From your notes, not a prediction\./);
  assert.match(js('interviews'), /Their words, not a promise to buy/);
  assert.match(js('quote'), /Your rate\. 127 doesn’t work out sales tax for you\./);
  assert.match(js('quote'), /Template, not legal advice\. Laws differ by state, so have a lawyer check anything you’ll sign\./);
  assert.doesNotMatch(js('quote'), /mailto:|\/send|EXAMPLE/);
});

test('a quote\'s private link: random, server-made, turns off, expires, and the page is quiet (Legal L92 QL1-QL4)', async () => {
  const m = await member();
  const doc = { from: 'Lane Studio', quotes: [{ id: 'q1', number: 'Q-0007', client: 'Dana', title: 'Refresh', items: [{ name: 'Pages', qty: 2, price: 100 }], tax: 10, made: '2026-10-21', until: '2099-01-01', terms: '', state: 'sent' }] };
  // The page can't set its own token.
  await s.go('/app/hq/tools/quote/data', { as: m, json: { ...doc, quotes: [{ ...doc.quotes[0], share: { token: 'A'.repeat(24), at: new Date().toISOString() } }] } });
  assert.equal(tools.load(m.id, 'quote').quotes[0].share, undefined);
  assert.equal((await s.go(`/q/${'A'.repeat(24)}`)).status, 404);
  assert.equal((await s.go('/app/hq/tools/quote/share', { as: m, json: { id: 'nope', on: true } })).status, 409);

  const on = await (await s.go('/app/hq/tools/quote/share', { as: m, json: { id: 'q1', on: true } })).json();
  assert.match(on.token, /^[A-Za-z0-9_-]{24}$/);
  assert.ok(!on.token.includes(m.id) && !on.token.includes('q1'));
  // Saving again keeps the link.
  await s.go('/app/hq/tools/quote/data', { as: m, json: doc });
  assert.equal(tools.load(m.id, 'quote').quotes[0].share.token, on.token);

  const res = await s.go(`/q/${on.token}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
  const html = await res.text();
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.match(html, /Made with 127/);
  assert.match(html, /Q-0007/);
  assert.match(html, /\$220\.00/);
  assert.doesNotMatch(html, /<script|plausible|ads\.example|@127\.test/);

  // Expires 90 days after it was made, or at the end of its valid-until day.
  const was = tools._deps.now;
  tools._deps.now = () => Date.now() + 91 * 864e5;
  assert.equal((await s.go(`/q/${on.token}`)).status, 410);
  tools._deps.now = was;
  await s.go('/app/hq/tools/quote/data', { as: m, json: { ...doc, quotes: [{ ...doc.quotes[0], until: '2026-01-01' }] } });
  assert.equal((await s.go(`/q/${on.token}`)).status, 410);

  // Off kills the link for good; on again makes a new one.
  await s.go('/app/hq/tools/quote/share', { as: m, json: { id: 'q1', on: false } });
  assert.equal((await s.go(`/q/${on.token}`)).status, 404);
  await s.go('/app/hq/tools/quote/data', { as: m, json: doc });
  const again = await (await s.go('/app/hq/tools/quote/share', { as: m, json: { id: 'q1', on: true } })).json();
  assert.notEqual(again.token, on.token);
  assert.equal((await s.go(`/q/${again.token}`)).status, 200);
  // Tools off: the link is off too. Deleting the quote kills it.
  process.env.HQ_TOOLS = 'off';
  assert.equal((await s.go(`/q/${again.token}`)).status, 404);
  process.env.HQ_TOOLS = 'on';
  await s.go('/app/hq/tools/quote/data', { as: m, json: { from: 'Lane Studio', quotes: [] } });
  assert.equal((await s.go(`/q/${again.token}`)).status, 404);
});
