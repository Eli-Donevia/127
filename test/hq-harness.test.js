// 127 HQ, the harness (lib/hq-harness.js, product/hub/harness-spec.md): screenshots fill the week for the
// member to check, the Monday check-in logs a week with no login, and the AI link speaks MCP to Claude
// and ChatGPT. No network: the screenshot reader is a fake, and emails and events are captured.

const path = require('path');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-harness-${process.pid}.json`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'KLAVIYO_PRIVATE_KEY', 'WEBHOOK_URL', 'RESEND_API_KEY']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const hq = require('../lib/hq');
const harness = require('../lib/hq-harness');
const hqRoutes = require('../lib/hq-routes');
const { plan } = require('../lib/plans');

const SECRET = 'hq-test-secret-'.padEnd(48, 'x');
const at = (s) => Date.parse(s);
const NOW = at('2026-12-16T15:00:00Z'); // Wednesday, week of Mon Dec 14 (ET)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let now = NOW;
let mails = [];
let flashes = [];
let reserved = 0;
let refunded = 0;
let reads = [];
let readAnswer = null;

test.before(async () => {
  await db.init();
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
});
test.beforeEach(() => {
  now = NOW;
  mails = [];
  flashes = [];
  reserved = 0;
  refunded = 0;
  reads = [];
  readAnswer = { source: 'Stripe dashboard', from: '2026-12-07', to: '2026-12-13', currency: 'usd', numbers: [{ metric: 'sales', value: 3, seen: 'Payments' }, { metric: 'revenue', value: 147.5, seen: 'Gross volume' }, { metric: 'leads', value: 9 }] };
  process.env.HQ_LIVE = 'true';
  process.env.HQ_HARNESS = 'true';
  process.env.HQ_SECRET = SECRET;
  hq._setDeps({ now: () => now, emit: () => {} });
  harness._setDeps({
    now: () => now,
    emit: () => {},
    sendEmail: async (m) => { mails.push(m); },
    read: async (images, metrics) => { reads.push({ images, metrics }); return readAnswer; },
    profile: (u) => `Member profile\n- First name: ${String(u.name).split(' ')[0]}`,
  });
});

let n = 0;
async function member(extra = {}) {
  n += 1;
  return db.save('users', { email: `hz${n}-${Date.now()}@x.test`, name: `Ana${n} Ruiz`, tier: 'builder', emailVerified: true, roadmap: { weeks: [] }, ...extra });
}

function locals(user, req) {
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: false, path: req.path, flash: null,
    builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
    launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
    fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null,
    hqLive: hq.live(),
  };
}
async function server({ aiLeft = 10 } = {}) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.all('/hq/in/:token', hqRoutes.inbound);
  app.all('/hq/ai/:token', hqRoutes.ai);
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    req.session = {};
    Object.assign(res.locals, locals(req.user, req));
    next();
  });
  app.use(hqRoutes({
    requireAuth: (req, res, next) => (req.user ? next() : res.redirect('/login')),
    flash: (req, type, text) => flashes.push({ type, text }),
    track: () => {},
    reserveAi: (req, res, u, back) => {
      if (aiLeft <= 0) { res.redirect(back); return false; }
      reserved += 1;
      return true;
    },
    refundAi: () => { refunded += 1; },
    ageFromAi: async () => false,
    aiRunsLeft: () => aiLeft,
  }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, json, raw, headers = {}, method } = {}) => {
    const h = { ...headers };
    if (as) h['x-user'] = as.id;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    if (json !== undefined) { body = JSON.stringify(json); h['content-type'] = 'application/json'; }
    if (raw !== undefined) body = raw;
    return fetch(url + p, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

test('HQ_HARNESS off: HQ is v1, and the harness routes 404', async () => {
  const s = await server();
  try {
    delete process.env.HQ_HARNESS;
    const u = await member();
    const page = await (await s.go('/app/hq', { as: u })).text();
    assert.match(page, /Save week/);
    assert.doesNotMatch(page, /Fill it in for me/);
    assert.doesNotMatch(await (await s.go('/app/hq/connect', { as: u })).text(), /127 in Claude and ChatGPT/);
    assert.equal(await (await s.go('/app/hq/snap', { as: u, json: { w: '2026-12-14', images: [PNG] } })).text(), 'app 404');
    assert.equal(await (await s.go('/app/hq/ai', { as: u, form: {} })).text(), 'app 404');
    assert.equal((await s.go('/hq/ai/' + 'a'.repeat(43), { json: { jsonrpc: '2.0', id: 1, method: 'ping' } })).status, 404);
    assert.equal((await s.go('/hq/week/' + harness.checkinToken(u, '2026-12-07'))).status, 404);
    assert.equal(await harness.mondayTick(at('2026-12-14T15:00:00Z')), 0);
    assert.equal(reads.length, 0);
  } finally {
    await s.close();
  }
});

test('screenshots: images are checked before any AI call', () => {
  assert.match(harness.parseImages([]).error, /Add a screenshot/);
  assert.match(harness.parseImages(Array(5).fill(PNG)).error, /Up to 4/);
  assert.match(harness.parseImages(['data:text/html;base64,PGI+']).error, /screenshot or photo/);
  assert.match(harness.parseImages(['data:image/svg+xml;base64,PHN2Zz4=']).error, /screenshot or photo/);
  const big = 'data:image/jpeg;base64,' + Buffer.alloc(5 * 1024 * 1024 + 10).toString('base64');
  assert.match(harness.parseImages([big]).error, /too big/);
  const ok = harness.parseImages([PNG, PNG]);
  assert.equal(ok.images.length, 2);
  assert.equal(ok.images[0].type, 'image/png');
});

test('screenshots fill the week for the member to check, and count only once saved', async () => {
  const s = await server();
  try {
    const u = await member();
    let r = await s.go('/app/hq/snap', { as: u, json: { w: '2026-12-14', images: [PNG] } });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { go: '/app/hq?w=2026-12-07#log' }, 'the dates on screen pick the week');
    assert.equal(reserved, 1);
    assert.equal(reads[0].images[0].type, 'image/png');
    assert.deepEqual(reads[0].metrics.map((m) => m.id), ['posts', 'outreach', 'reach', 'visits', 'leads', 'replies', 'sales', 'revenue']);
    let saved = db.get('users', u.id);
    assert.deepEqual(saved.hq.snap.values, { sales: 3, revenue: 147.5, leads: 9 });
    assert.equal(saved.hq.weeks['2026-12-07'], undefined, 'nothing counts until Save week');
    assert.equal(JSON.stringify(saved).includes('iVBOR'), false, 'the image is never stored');
    assert.equal(hq.valueOf(saved, '2026-12-07', 'sales'), null);

    const page = await (await s.go('/app/hq?w=2026-12-07', { as: u })).text();
    assert.match(page, /Check these, then press Save week\./);
    assert.match(page, /Read from your screenshot of Stripe dashboard/);
    assert.match(page, /name="v_sales" inputmode="decimal" autocomplete="off" value="3"/);
    assert.match(page, /name="v_revenue" inputmode="decimal" autocomplete="off" value="147.5"/);
    assert.match(page, /From your screenshot/);
    assert.doesNotMatch(await (await s.go('/app/hq?w=2026-12-14', { as: u })).text(), /Check these/, 'only on its own week');

    r = await s.go('/app/hq/week', { as: u, form: { w: '2026-12-07', v_sales: '3', v_revenue: '147.5', v_leads: '9' } });
    saved = db.get('users', u.id);
    assert.equal(saved.hq.snap, undefined, 'saving the week clears it');
    assert.equal(hq.valueOf(saved, '2026-12-07', 'revenue'), 147.5);
  } finally {
    await s.close();
  }
});

test('screenshots never double-count a connection, flag a long range, and refund a failed read', async () => {
  const s = await server();
  try {
    const u = await member({ hq: { weeks: {}, auto: { stripe: { '2026-12-07': { sales: 2, revenue: 98 } } }, targets: {}, custom: [], hidden: [], currency: 'usd' } });
    readAnswer = { source: 'Stripe', from: '2026-11-14', to: '2026-12-13', currency: 'eur', numbers: [{ metric: 'sales', value: 2 }, { metric: 'revenue', value: 98 }, { metric: 'reach', value: 1200 }, { metric: 'reach', value: 800 }, { metric: 'posts', value: -3 }, { metric: 'nope', value: 1 }] };
    await s.go('/app/hq/snap', { as: u, json: { w: '2026-12-07', images: [PNG] } });
    const snap = db.get('users', u.id).hq.snap;
    assert.deepEqual(snap.values, { reach: 2000 }, 'Stripe already counts sales and revenue; two reach numbers add up; junk is dropped');
    assert.match(snap.notes.join(' '), /cover Nov 14 to Dec 13, not one week/);
    assert.match(snap.notes.join(' '), /Reach showed up more than once/);
    assert.match(snap.notes.join(' '), /Left out so nothing counts twice: Sales \(Stripe counts it\), Revenue \(Stripe counts it\)/);

    readAnswer = { error: true, text: "Eli's Playbook is unavailable right now. Please try again in a minute." };
    const r = await s.go('/app/hq/snap', { as: u, json: { w: '2026-12-07', images: [PNG] } });
    assert.equal(r.status, 502);
    assert.match((await r.json()).error, /unavailable/);
    assert.equal(refunded, 1);

    const bad = await s.go('/app/hq/snap', { as: u, json: { w: '2026-12-07', images: ['nope'] } });
    assert.equal(bad.status, 400);
    assert.equal(reads.length, 2, 'a bad image never reaches the AI');
  } finally {
    await s.close();
  }
  const out = await server({ aiLeft: 0 });
  try {
    const u = await member();
    const before = reads.length;
    const r = await out.go('/app/hq/snap', { as: u, json: { w: '2026-12-14', images: [PNG] } });
    assert.deepEqual(await r.json(), { go: '/app/hq?w=2026-12-14#log' }, 'out of messages: the page reloads to show why');
    assert.equal(reads.length, before);
    const page = await (await out.go('/app/hq', { as: u })).text();
    assert.match(page, /data-snap[^>]*data-off/);
  } finally {
    await out.close();
  }
});

test('Monday check-in: one email a week to members who turned it on, and a link that logs with no login', async () => {
  const s = await server();
  try {
    const on = await member({ name: 'Maya Chen' });
    const off = await member();
    const free = await member({ tier: 'free', hq: { checkin: true } });
    let r = await s.go('/app/hq/checkin', { as: on, form: { on: '1', w: '2026-12-14' } });
    assert.equal(r.headers.get('location'), '/app/hq?w=2026-12-14#fill');
    assert.equal(db.get('users', on.id).hq.checkin, true);
    hq.saveWeek(db.get('users', on.id), '2026-12-07', { v_revenue: '120', v_sales: '2', v_leads: '10', v_visits: '400', v_reach: '5000' });

    assert.equal(await harness.mondayTick(at('2026-12-13T15:00:00Z')), 0, 'not on Sunday');
    assert.equal(await harness.mondayTick(at('2026-12-14T13:30:00Z')), 0, 'not before 9am Eastern');
    assert.equal(await harness.mondayTick(at('2026-12-14T15:00:00Z')), 1);
    assert.equal(await harness.mondayTick(at('2026-12-14T16:00:00Z')), 0, 'once a week');
    assert.equal(mails.length, 1);
    const m = mails[0];
    assert.equal(m.to, on.email);
    assert.equal(m.subject, 'Your week of Dec 7 in 127');
    assert.match(m.text, /^Hi Maya,/);
    assert.match(m.text, /Revenue: \$120/);
    assert.match(m.text, /Weakest step|No clear leak/);
    const link = m.text.match(/https:\/\/127\.test(\/hq\/week\/\S+)/)[1];
    assert.match(m.text, /Turn them off: https:\/\/127\.test\/hq\/week\/\S+#stop/);
    assert.ok(!mails.some((x) => x.to === off.email || x.to === free.email));

    now = at('2026-12-15T15:00:00Z');
    const page = await s.go(link);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const html = await page.text();
    assert.match(html, /Maya, how did the week go\?/);
    assert.match(html, /name="robots" content="noindex"/);
    assert.match(html, /name="v_revenue" inputmode="decimal" autocomplete="off" value="120"/);

    r = await s.go(link, { form: { v_revenue: '120', v_sales: '3', v_leads: '10', v_visits: '400', v_reach: '5000', call: 'double', note: 'Reels work' } });
    assert.match(await r.text(), /Saved\. Nice work, Maya\./);
    const u = db.get('users', on.id);
    assert.equal(hq.valueOf(u, '2026-12-07', 'sales'), 3);
    assert.equal(u.hq.weeks['2026-12-07'].call, 'double');

    const forged = link.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    assert.equal((await s.go(forged)).status, 404);
    const otherWeek = link.replace('2026-12-07', '2026-11-30');
    assert.equal((await s.go(otherWeek)).status, 404, 'one week per link');
    now = at('2026-12-23T15:00:00Z');
    assert.equal((await s.go(link)).status, 410, 'expires 15 days after the week began');
    now = at('2026-12-15T15:00:00Z');

    r = await s.go(link, { form: { stop: '1' } });
    assert.match(await r.text(), /Monday check-ins are off\./);
    assert.equal(db.get('users', on.id).hq.checkin, false);
  } finally {
    await s.close();
  }
});

async function rpc(s, token, msg, headers = {}) {
  const r = await s.go('/hq/ai/' + token, { json: msg, headers: { accept: 'application/json, text/event-stream', ...headers } });
  const text = await r.text();
  return { status: r.status, body: text && /json/.test(r.headers.get('content-type') || '') ? JSON.parse(text) : text || null, headers: r.headers };
}

test('the AI link: MCP for Claude and ChatGPT, read and log, nothing else', async () => {
  const s = await server();
  try {
    const u = await member({ name: 'Leo Park', answers: { stage: 'validating' } });
    let r = await s.go('/app/hq/ai', { as: u, form: {} });
    assert.equal(r.headers.get('location'), '/app/hq/connect#ai');
    const c = db.get('hqConnections', u.id);
    const token = c.ai.token;
    assert.equal(token.length, 43);
    const connect = await (await s.go('/app/hq/connect', { as: u })).text();
    assert.match(connect, /127 in Claude and ChatGPT/);
    assert.match(connect, /Add custom connector/);
    assert.match(connect, new RegExp(`data-copy-value="https://127.test/hq/ai/${token}"`));
    assert.doesNotMatch(connect.replace(/data-copy-value="[^"]+"/g, ''), new RegExp(token), 'the link shows masked');

    let x = await rpc(s, token, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-ai', version: '1' } } });
    assert.equal(x.status, 200);
    assert.equal(x.body.result.protocolVersion, '2025-06-18');
    assert.deepEqual(x.body.result.capabilities, { tools: { listChanged: false } });
    assert.equal(x.body.result.serverInfo.name, '127');
    assert.match(x.body.result.instructions, /never sends, posts or moves money/);
    assert.equal((await rpc(s, token, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).body.result.protocolVersion, '2025-06-18');
    x = await rpc(s, token, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(x.status, 202);
    assert.equal(x.body, null);
    x = await rpc(s, token, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.deepEqual(x.body.result.tools.map((t) => t.name), ['get_my_business', 'get_numbers', 'find_playbook', 'log_numbers']);
    assert.equal(x.body.result.tools.find((t) => t.name === 'log_numbers').annotations.destructiveHint, false);

    const call = async (name, args = {}) => (await rpc(s, token, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } })).body;
    x = await call('log_numbers', { numbers: { sales: 2, revenue: 98 }, date: '2026-12-09' });
    assert.match(x.result.content[0].text, /Logged in 127 HQ for the week of Dec 7.*Sales 2, Revenue \$98/);
    x = await call('log_numbers', { numbers: { sales: 1 }, date: '2026-12-10' });
    assert.match(x.result.content[0].text, /Sales 3/, 'adds by default');
    x = await call('log_numbers', { numbers: { sales: 5 }, date: '2026-12-10', mode: 'set' });
    assert.match(x.result.content[0].text, /Sales 5/);
    assert.equal(hq.valueOf(db.get('users', u.id), '2026-12-07', 'sales'), 5);
    x = await call('log_numbers', { numbers: { vibes: 3 } });
    assert.equal(x.result.isError, true);
    assert.match(x.result.content[0].text, /Unknown number "vibes"/);
    assert.equal((await call('log_numbers', { numbers: { sales: 1 }, date: '2027-01-30' })).result.isError, true);

    x = await call('get_numbers', { weeks: 2 });
    assert.match(x.result.content[0].text, /Week of Dec 7 .*Sales 5, Revenue \$98/);
    assert.match(x.result.content[0].text, /this week, in progress\): nothing logged/);
    x = await call('get_my_business');
    assert.match(x.result.content[0].text, /First name: Leo/);
    assert.match(x.result.content[0].text, /North Number: Revenue/);
    assert.doesNotMatch(x.result.content[0].text, new RegExp(u.email.replace(/[.]/g, '\\.')), 'never the email');
    x = await call('find_playbook', { topic: 'how should I price my offer' });
    assert.match(x.result.content[0].text, /Pric/);
    assert.match(x.result.content[0].text, /https:\/\/127\.test\/app\/library\//);
    x = await call('find_playbook');
    assert.match(x.result.content[0].text, /127's playbooks/);
    x = await rpc(s, token, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'send_email', arguments: {} } });
    assert.equal(x.body.error.code, -32602);
    x = await rpc(s, token, { jsonrpc: '2.0', id: 9, method: 'resources/list' });
    assert.equal(x.body.error.code, -32601);

    x = await rpc(s, token, [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'ping' }]);
    assert.deepEqual(x.body.map((m) => m.id), [1, 2]);
    const parse = await s.go('/hq/ai/' + token, { raw: '{oops', headers: { 'content-type': 'application/json' } });
    assert.equal(parse.status, 400);
    assert.equal((await parse.json()).error.code, -32700);
    assert.equal((await s.go('/hq/ai/' + token)).status, 405);
    assert.equal((await rpc(s, 'b'.repeat(43), { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 404);

    const saved = db.get('hqConnections', u.id).ai;
    assert.equal(saved.client, 'claude-ai');
    assert.ok(saved.calls >= 8);
    assert.match(await (await s.go('/app/hq/connect', { as: u })).text(), /from claude-ai/);

    // A member who leaves Builder: the link stops answering.
    const left = db.get('users', u.id);
    left.tier = 'free';
    await db.save('users', left);
    assert.equal((await rpc(s, token, { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 404);
    left.tier = 'builder';
    await db.save('users', left);

    // A member under age review: tools answer with the pause message.
    const review = db.get('users', u.id);
    review.ageReview = { status: 'open', openedAt: new Date(NOW).toISOString() };
    await db.save('users', review);
    x = await call('get_numbers');
    assert.equal(x.result.isError, true);
    assert.match(x.result.content[0].text, /18 and older/);
    delete review.ageReview;
    await db.save('users', review);

    r = await s.go('/app/hq/disconnect/ai', { as: u, form: {} });
    assert.equal(r.headers.get('location'), '/app/hq/connect#ai');
    assert.equal(db.get('hqConnections', u.id).ai, undefined);
    assert.equal((await rpc(s, token, { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 404);
  } finally {
    await s.close();
  }
});

test('the HQ page leads with the three ways to fill it', async () => {
  const s = await server();
  try {
    const u = await member();
    const html = await (await s.go('/app/hq', { as: u })).text();
    assert.match(html, /Fill it in for me/);
    assert.match(html, /Drop screenshots here/);
    assert.match(html, /Monday check-in/);
    assert.match(html, /Ask your AI/);
    assert.ok(html.indexOf('Fill it in for me') < html.indexOf('Log this week'));
    assert.equal(hq.stats().ai >= 0, true);
  } finally {
    await s.close();
  }
});

test('Legal L50: a bad upload never logs the image, old screenshot numbers are deleted, and the copy is in', async () => {
  const s = await server();
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.map(String).join(' '));
  try {
    const u = await member();
    const secret = 'SECRETPIXELS'.repeat(20);
    const r = await s.go('/app/hq/snap', { as: u, raw: `{"w":"2026-12-14","images":["data:image/png;base64,${secret}"`, headers: { 'content-type': 'application/json' } });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /Couldn't read that upload/);
    assert.ok(logged.some((l) => /\[hq\] snap entity\.parse\.failed/.test(l)));
    assert.ok(!logged.some((l) => l.includes('SECRETPIXELS')), 'no part of the upload is logged');

    await s.go('/app/hq/snap', { as: u, json: { w: '2026-12-14', images: [PNG] } });
    assert.ok(db.get('users', u.id).hq.snap);
    await harness.purgeSnaps(NOW + 23 * 36e5);
    assert.ok(db.get('users', u.id).hq.snap, 'kept for 24 hours');
    assert.ok((await harness.purgeSnaps(NOW + 25 * 36e5)) >= 1);
    assert.equal(db.get('users', u.id).hq.snap, undefined, 'deleted, not just hidden');

    const page = await (await s.go('/app/hq', { as: u })).text();
    assert.match(page, /127 doesn't keep your screenshots\. If you can, crop out customer names and emails first\./);
    await s.go('/app/hq/ai', { as: u, form: {} });
    const connect = await (await s.go('/app/hq/connect', { as: u })).text();
    assert.match(connect, /Anyone with it can read your 127 profile and numbers and log numbers\./);
    assert.match(connect, /What they already read stays in those chats\./);
    const fresh = await member();
    assert.match(await (await s.go('/app/hq/connect', { as: fresh })).text(), /including whether it trains on your chats\. It never gets your email or payment details\./);

    hq.saveWeek(u, '2026-12-07', { v_revenue: '50' });
    const mail = harness.checkinEmail(u, '2026-12-07');
    assert.match(mail.text, /so don't forward this email\./);
    assert.doesNotMatch(mail.text, /upgrade|Circle|challenge|refer|\$29|\$19/i, 'a service email, never offers');
    const init = await (await s.go('/hq/ai/' + db.get('hqConnections', u.id).ai.token, { json: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} } })).json();
    assert.match(init.result.instructions, /don't speak as Eli/);
  } finally {
    console.error = orig;
    await s.close();
  }
});
