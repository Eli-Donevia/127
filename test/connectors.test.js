// Connections (lib/harness/connectors, BUILD-PLAN W1, W11, W14): the gallery and its honest statuses,
// switches and Legal's hold, pasted keys checked and encrypted, sign-in-with (state, PKCE, refresh),
// clients for packs (reads logged, writes only with an OK), the ad accounts (paused drafts only), the
// pages, and custom dashboards. No network: every provider is a fake fetch.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-conn-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-conn-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'ADMIN_EMAILS', 'CONNECTORS', 'DASHBOARDS', 'GOOGLE_ADS_DEV_TOKEN']) delete process.env[k];
for (const k of Object.keys(process.env)) if (/^(CONNECTOR_|OAUTH_)/.test(k)) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const hq = require('../lib/hq');
const hqRoutes = require('../lib/hq-routes');
const connectors = require('../lib/harness/connectors');
const connectorRoutes = require('../lib/harness/connectors/routes');
const dashboards = require('../lib/harness/connectors/dashboards');
const needs = require('../lib/harness/needs');
const ctxLib = require('../lib/harness/ctx');
const { plan } = require('../lib/plans');

const { oauth, log, apps } = connectors;
const SECRET = 'conn-test-secret-'.padEnd(48, 'x');
const NOTION = 'ntn_' + 'a'.repeat(40);
const SHPAT = 'shpat_' + 'b'.repeat(32);

// ---------- a fake internet ----------
let calls = [];
let routes = [];
function on(method, re, reply) {
  routes.unshift({ method, re, reply });
}
async function fakeFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  calls.push({ url, method, headers: opts.headers || {}, body: opts.body });
  const r = routes.find((x) => x.method === method && x.re.test(url));
  if (!r) return new Response('{}', { status: 404 });
  const out = typeof r.reply === 'function' ? r.reply(url, opts) : r.reply;
  const status = out && out.$status ? out.$status : 200;
  return new Response(JSON.stringify(out && out.$status ? out.body || {} : out), { status, headers: { 'content-type': 'application/json' } });
}

let stripeCalls = [];
const fakeStripe = (key) => {
  const list = (items) => ({
    async *[Symbol.asyncIterator]() {
      for (const x of items) yield x;
    },
  });
  if (key === 'rk_test_' + 'z'.repeat(24)) {
    const e = new Error('nope');
    e.statusCode = 401;
    return { charges: { list: () => { throw e; } } };
  }
  return {
    charges: { list: (p) => (stripeCalls.push(['charges', p]), list([{ id: 'ch_1', created: Math.floor(Date.now() / 1000) - 3600, amount: 4900, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, description: 'Lesson', customer: 'cus_SECRET', billing_details: { email: 'buyer@x.test' } }])) },
    invoices: {
      list: () => list([{ id: 'in_1', number: 'A-1', status: 'open', total: 20000, amount_remaining: 20000, currency: 'usd', due_date: Math.floor(Date.now() / 1000) - 86400 * 3, created: 1, customer_name: 'Pat', customer_email: 'pat@x.test' }]),
      create: async (p) => (stripeCalls.push(['invoices.create', p]), { id: 'in_2' }),
      retrieve: async () => ({ id: 'in_2', status: 'draft', total: 5000, amount_remaining: 5000, currency: 'usd' }),
    },
    invoiceItems: { create: async (p) => (stripeCalls.push(['invoiceItems.create', p]), {}) },
    balanceTransactions: { list: () => list([]) },
    payouts: { list: () => list([]) },
    products: { list: () => list([]), create: async (p) => (stripeCalls.push(['products.create', p]), { id: 'prod_1', name: p.name }) },
    prices: { list: () => list([]) },
  };
};

// ---------- members and a server ----------
let seq = 0;
async function member(tier = 'builder', extra = {}) {
  seq += 1;
  return db.save('users', { id: `cu${seq}`, email: `c${seq}@127.test`, name: `Jo Rivera${seq}`, tier, emailVerified: true, ...extra });
}
let flashes = [];
function locals(user, req) {
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: false, path: req.path, flash: null,
    builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
    launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
    fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null, hqLive: true,
  };
}
async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  const sessions = new Map();
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    const sid = req.get('x-user') || 'anon';
    if (!sessions.has(sid)) sessions.set(sid, {});
    req.session = sessions.get(sid);
    Object.assign(res.locals, locals(req.user, req));
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const flash = (req, type, text) => flashes.push({ type, text });
  app.use(connectorRoutes({ requireAuth, flash }));
  app.use(hqRoutes({ requireAuth, flash, track: () => {}, reserveAi: () => true, refundAi: () => {}, ageFromAi: async () => false, aiRunsLeft: () => 10 }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, json, method } = {}) => {
    const h = {};
    if (as) h['x-user'] = as.id;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    if (json !== undefined) { body = JSON.stringify(json); h['content-type'] = 'application/json'; h.accept = 'application/json'; }
    return fetch(url + p, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

let s;
test.before(async () => {
  await db.init();
  connectors._setDeps({ fetch: fakeFetch, stripe: fakeStripe });
  hq._setDeps({ stripe: fakeStripe, emit: () => {} });
  s = await server();
});
test.after(async () => {
  await s.close();
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
});
test.beforeEach(() => {
  calls = [];
  routes = [];
  flashes = [];
  stripeCalls = [];
  log._reset();
  dashboards._clearCache();
  process.env.HQ_LIVE = 'true';
  process.env.HQ_SECRET = SECRET;
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
  process.env.ADMIN_EMAILS = 'boss@127.test';
  for (const k of Object.keys(process.env)) if (/^(CONNECTOR_|OAUTH_)/.test(k) || k === 'CONNECTORS' || k === 'DASHBOARDS') delete process.env[k];
});

const notionOk = () => on('GET', /api\.notion\.com\/v1\/users\/me/, { bot: { workspace_name: 'Rivera Studio' } });

// ---------- switches and statuses ----------

test('switches: everything is off by default; admins first; Legal\'s hold keeps a connector to admins', async () => {
  const boss = await member('builder', { email: 'boss@127.test' });
  const jo = await member();
  assert.equal(connectors.on(boss), false);
  process.env.CONNECTORS = 'admins';
  assert.equal(connectors.on(boss), true);
  assert.equal(connectors.on(jo), false);
  process.env.CONNECTORS = 'on';
  assert.equal(connectors.on(jo), true);
  // "on" before the Terms and Privacy pages are live acts as admins.
  delete process.env.PRIVACY_LIVE;
  assert.equal(connectors.on(jo), false);
  process.env.PRIVACY_LIVE = 'true';
  // Free members never see it: Connections is part of HQ.
  assert.equal(connectors.on(await member('free')), false);

  process.env.CONNECTOR_NOTION = 'on';
  assert.equal(connectors.held('notion'), true);
  assert.equal(connectors.allowed(boss, 'notion'), true);
  assert.equal(connectors.allowed(jo, 'notion'), false, 'held: admins only, whatever the switch says');
  connectors.CLEARED.add('notion');
  try {
    assert.equal(connectors.allowed(jo, 'notion'), true);
    process.env.CONNECTOR_NOTION = 'admins';
    assert.equal(connectors.allowed(jo, 'notion'), false);
  } finally {
    connectors.CLEARED.delete('notion');
  }
});

test('the gallery: every category, one honest status each, never a key', async () => {
  process.env.CONNECTORS = 'on';
  process.env.CONNECTOR_NOTION = 'on';
  process.env.CONNECTOR_META_ADS = 'on';
  const boss = await member('builder', { email: 'boss@127.test' });
  const jo = await member();
  const status = (g, id) => g.categories.flatMap((c) => c.apps).find((a) => a.id === id);

  let g = connectors.gallery(jo);
  assert.deepEqual(g.categories.map((c) => c.id), ['money', 'store', 'email', 'calendar', 'social', 'ads', 'knowledge', 'team', 'media', 'design', 'automation', 'ai']);
  assert.equal(status(g, 'notion').status, 'legal');
  assert.equal(status(g, 'zapier').status, 'connect');
  assert.equal(status(g, 'higgsfield').status, 'legal');
  assert.equal(status(g, 'stripe').status, 'legal');

  g = connectors.gallery(boss);
  assert.equal(status(g, 'notion').status, 'connect');
  assert.equal(status(g, 'notion').href, '/app/hq/apps/notion');
  assert.equal(status(g, 'meta_ads').status, 'coming', 'no 127 Meta app yet');
  assert.equal(status(g, 'airtable').status, 'legal', 'its switch is off');
  process.env.OAUTH_META_ID = 'meta-app';
  process.env.OAUTH_META_SECRET = 'meta-secret';
  assert.equal(status(connectors.gallery(boss), 'meta_ads').status, 'connect');

  // HQ v1's Stripe key counts as connected.
  const c = hq.connOf(jo.id);
  c.stripe = { key: hq.enc('rk_test_' + 'a'.repeat(24)), status: 'ok', last4: 'aaaa', mode: 'test' };
  await hq.saveConn(c);
  assert.equal(status(connectors.gallery(jo), 'stripe').status, 'connected');

  const res = await s.go('/app/hq/connect', { as: jo });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Your accounts, in one place/);
  assert.match(html, /Waiting on Legal/);
  assert.match(html, /hq-apps\.css/);
  assert.doesNotMatch(html, /rk_test_a{24}/);
  delete process.env.CONNECTORS;
  assert.doesNotMatch(await (await s.go('/app/hq/connect', { as: jo })).text(), /Your accounts, in one place/);
});

// ---------- pasted keys ----------

test('a pasted key: shape checked, tested with the provider, encrypted, logged; disconnect deletes it', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_NOTION = 'on';
  const boss = await member('builder', { email: 'boss@127.test' });

  assert.match((await connectors.connectKey(boss, 'notion', { token: 'sk_nope' })).error, /starts with ntn_/);
  on('GET', /api\.notion\.com\/v1\/users\/me/, { $status: 401 });
  assert.match((await connectors.connectKey(boss, 'notion', { token: NOTION })).error, /didn't accept that key/);
  assert.equal(connectors.credsOf(boss.id, 'notion'), null);

  notionOk();
  const out = await connectors.connectKey(boss, 'notion', { token: NOTION });
  assert.deepEqual(out, { ok: true, label: 'Rivera Studio' });
  const call = calls.find((x) => /users\/me/.test(x.url));
  assert.equal(call.headers.authorization, `Bearer ${NOTION}`);
  assert.equal(call.headers['notion-version'], '2022-06-28');
  // Encrypted at rest: the token is nowhere in the stored doc.
  assert.doesNotMatch(JSON.stringify(db.get('hqConnections', boss.id)), new RegExp(NOTION));
  assert.equal(connectors.credsOf(boss.id, 'notion').token, NOTION);
  assert.equal(connectors.detail(boss, 'notion').status, 'connected');
  assert.match(log.list(boss.id)[0].what, /Connected Notion \(Rivera Studio\)/);
  assert.equal(log.list(boss.id)[0].kind, 'connector');
  assert.equal(log.list(boss.id)[0].action, 'connect');

  assert.equal(await connectors.disconnect(boss, 'notion'), true);
  assert.equal(connectors.credsOf(boss.id, 'notion'), null);
  assert.match(log.list(boss.id)[0].what, /Disconnected Notion/);

  // Not allowed for members while held.
  const jo = await member();
  assert.match((await connectors.connectKey(jo, 'notion', { token: NOTION })).error, /isn't open yet/);
});

test('Shopify: a store address and a token, or client credentials; orders come without customers', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_SHOPIFY = 'on';
  const boss = await member('builder', { email: 'boss@127.test' });
  assert.equal(apps.shopHost('https://Rivera-Goods.myshopify.com/admin'), 'rivera-goods.myshopify.com');
  assert.equal(apps.shopHost('rivera-goods'), 'rivera-goods.myshopify.com');
  assert.equal(apps.shopHost('evil.com'), null);
  assert.match((await connectors.connectKey(boss, 'shopify', { shop: 'rivera-goods' })).error, /Admin API access token/);

  on('POST', /rivera-goods\.myshopify\.com\/admin\/oauth\/access_token/, { access_token: 'shpat_fresh' + 'c'.repeat(24) });
  on('GET', /\/admin\/api\/2025-10\/shop\.json/, { shop: { name: 'Rivera Goods', currency: 'USD' } });
  assert.equal((await connectors.connectKey(boss, 'shopify', { shop: 'rivera-goods', clientId: 'cid', clientSecret: 'csecret' })).label, 'Rivera Goods');
  const tokenCall = calls.find((x) => /access_token/.test(x.url));
  assert.match(tokenCall.body, /grant_type=client_credentials/);

  on('GET', /\/orders\.json/, (url) => {
    assert.doesNotMatch(url, /customer|email|address/);
    return { orders: [{ id: 1, created_at: new Date().toISOString(), total_price: '58.00', subtotal_price: '58.00', total_discounts: '0', currency: 'USD', financial_status: 'paid', line_items: [{ title: 'Mug', quantity: 2, price: '29.00' }], customer: { email: 'leak@x.test' } }] };
  });
  const c = connectors.clientFor(boss, 'shopify');
  const orders = await c.orders({ sinceDays: 30 });
  assert.equal(orders[0].total, 58);
  assert.deepEqual(orders[0].items, [{ title: 'Mug', quantity: 2, price: 29 }]);
  assert.doesNotMatch(JSON.stringify(orders), /leak@x\.test/);
});

// ---------- clients for packs ----------

test('clients: reads are logged once an hour, writes need the OK, a refused key marks it to reconnect', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_NOTION = 'on';
  const boss = await member('builder', { email: 'boss@127.test' });
  notionOk();
  await connectors.connectKey(boss, 'notion', { token: NOTION });
  on('POST', /api\.notion\.com\/v1\/search/, { results: [{ id: 'p1', url: 'https://notion.so/p1', properties: { Name: { type: 'title', title: [{ plain_text: 'Offer notes' }] } } }] });

  const c = connectors.clientFor(boss, 'notion', { runId: 'run1', tool: 'x.read' });
  assert.equal((await c.pages())[0].title, 'Offer notes');
  await c.pages();
  const reads = log.list(boss.id).filter((a) => a.action === 'read');
  assert.equal(reads.length, 1, 'the second read within the hour is not logged again');
  assert.equal(reads[0].ref, 'run1');
  assert.ok(stored(boss, 'notion').usedAt);

  await assert.rejects(() => c.writes.createPage({ parentId: 'p1', title: 'Week', text: 'Hi' }), /need your OK first/);
  on('POST', /api\.notion\.com\/v1\/pages$/, { id: 'new', url: 'https://notion.so/new' });
  const ok = connectors.clientFor(boss, 'notion', { write: true, approvedBy: 'check', runId: 'run2' });
  assert.equal((await ok.writes.createPage({ parentId: 'p1', title: 'Week', text: 'Line one\n\nLine two' })).id, 'new');
  const w = log.list(boss.id).find((a) => a.action === 'write');
  assert.equal(w.write, true);
  assert.match(w.what, /create page, approved by you/);

  on('POST', /api\.notion\.com\/v1\/search/, { $status: 401 });
  await assert.rejects(() => c.pages(), /didn't accept that key/);
  assert.equal(stored(boss, 'notion').status, 'broken');
  assert.equal(connectors.ready(boss, 'notion'), false);
});

function stored(user, id) {
  return db.get('hqConnections', user.id).apps[id];
}

test('needs: a tool that needs a member account runs as a sample until it is connected, then gets a client', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_STRIPE = 'on';
  const boss = await member('builder', { email: 'boss@127.test' });
  const jo = await member();
  assert.equal(needs.known('stripe'), true);
  assert.equal(needs.member('stripe'), true);
  assert.equal(needs.available('stripe', boss), false);
  const tool = { name: 't.money', needs: ['stripe'], risk: 'read' };
  const mk = (user, t = tool) => ctxLib.make({ user, run: { id: 'r1', inputs: {} }, step: { id: 's1' }, tool: t, pack: 't', index: 0 });
  assert.equal(mk(boss).sample, true);

  // HQ v1's Charges-read key is enough for reads.
  const c = hq.connOf(boss.id);
  c.stripe = { key: hq.enc('rk_test_' + 'a'.repeat(24)), status: 'ok' };
  await hq.saveConn(c);
  assert.equal(needs.available('stripe', boss), true);
  const ctx = mk(boss);
  assert.equal(ctx.sample, false);
  const charges = await ctx.secret('stripe').charges({ sinceDays: 7 });
  assert.equal(charges[0].amount, 49);
  assert.doesNotMatch(JSON.stringify(charges), /cus_SECRET|buyer@x\.test/);
  await assert.rejects(() => ctx.secret('stripe').writes.createProduct({ name: 'Mug' }), /need your OK first/);

  // An approved act step can write, and the write is logged first.
  const act = mk(boss, { name: 't.invoice', needs: ['stripe'], risk: 'act' });
  const inv = await act.secret('stripe').writes.createInvoice({ customer: 'cus_1', items: [{ description: 'Lesson', amount: 50 }] });
  assert.equal(inv.status, 'draft');
  assert.deepEqual(stripeCalls.find((x) => x[0] === 'invoiceItems.create')[1].amount, 5000);
  assert.equal(stripeCalls.find((x) => x[0] === 'invoices.create')[1].auto_advance, false);

  // Overdue invoices name the customer (chasing needs it).
  const overdue = await ctx.secret('stripe').invoices({ overdue: true });
  assert.equal(overdue[0].overdue, true);
  assert.equal(overdue[0].due, 200);

  // Members wait for Legal.
  const jc = hq.connOf(jo.id);
  jc.stripe = { key: hq.enc('rk_test_' + 'a'.repeat(24)), status: 'ok' };
  await hq.saveConn(jc);
  assert.equal(needs.available('stripe', jo), false);
  // Server keys still work as before.
  assert.equal(needs.available('render', null), !!needs.ffmpeg());
});

// ---------- sign-in-with ----------

test('OAuth: state and PKCE out, the same state back within 15 minutes, tokens stored and refreshed', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_GMAIL = 'on';
  const boss = await member('builder', { email: 'boss@127.test' });
  assert.equal(connectors.startOauth(boss, 'gmail', 'https://127.test'), null, 'no Google app yet');
  process.env.OAUTH_GOOGLE_ID = 'g-id';
  process.env.OAUTH_GOOGLE_SECRET = 'g-secret';
  const go = connectors.startOauth(boss, 'gmail', 'https://127.test');
  const u = new URL(go.url);
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://127.test/app/hq/connect/google/callback');
  assert.equal(u.searchParams.get('state'), go.pending.state);
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.match(u.searchParams.get('scope'), /gmail\.readonly/);
  assert.equal(u.searchParams.get('access_type'), 'offline');

  assert.match((await connectors.finishOauth(boss, go.pending, 'google', { code: 'c', state: 'wrong' }, 'https://127.test')).error, /didn't match/);
  assert.match((await connectors.finishOauth(boss, { ...go.pending, at: Date.now() - 16 * 60 * 1000 }, 'google', { code: 'c', state: go.pending.state }, 'https://127.test')).error, /didn't match/);

  on('POST', /oauth2\.googleapis\.com\/token/, (url, opts) => {
    const b = new URLSearchParams(opts.body);
    if (b.get('grant_type') === 'refresh_token') return { access_token: 'acc-2', expires_in: 3600 };
    assert.equal(b.get('code_verifier'), go.pending.verifier);
    assert.equal(b.get('client_secret'), 'g-secret');
    return { access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 30, scope: 'gmail' };
  });
  const out = await connectors.finishOauth(boss, go.pending, 'google', { code: 'the-code', state: go.pending.state }, 'https://127.test');
  assert.deepEqual(out, { ok: true, app: 'gmail', name: 'Gmail' });
  assert.doesNotMatch(JSON.stringify(db.get('hqConnections', boss.id)), /acc-1|ref-1/);
  // 30 seconds left: the client refreshes before use and keeps the refresh token.
  const c = connectors.clientFor(boss, 'gmail');
  assert.equal(await c.token(), 'acc-2');
  assert.equal(connectors.credsOf(boss.id, 'gmail').refresh, 'ref-1');
});

test('the pages: a connector page, a key through the form, sign-in redirect and callback, 404 when off', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_NOTION = 'on';
  process.env.CONNECTOR_SLACK = 'on';
  process.env.OAUTH_SLACK_ID = 's-id';
  process.env.OAUTH_SLACK_SECRET = 's-secret';
  const boss = await member('builder', { email: 'boss@127.test' });
  const jo = await member();

  assert.equal((await s.go('/app/hq/apps/notion', { as: jo })).status, 404);
  const page = await s.go('/app/hq/apps/notion', { as: boss });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Internal integration secret/);
  assert.match(html, /connected accounts terms/);

  notionOk();
  const r = await s.go('/app/hq/apps/notion/connect', { as: boss, form: { token: NOTION } });
  assert.equal(r.headers.get('location'), '/app/hq/apps/notion');
  assert.deepEqual(flashes.pop(), { type: 'win', text: 'Connected to Rivera Studio.' });
  assert.match(await (await s.go('/app/hq/apps/notion', { as: boss })).text(), /Connected Notion/);

  const start = await s.go('/app/hq/apps/slack/start', { as: boss, form: {} });
  assert.equal(start.status, 303);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  on('POST', /slack\.com\/api\/oauth\.v2\.access/, { ok: true, access_token: 'xoxb-1', team: { name: 'Rivera Team' } });
  const back = await s.go(`/app/hq/connect/slack/callback?code=abc&state=${state}`, { as: boss });
  assert.equal(back.headers.get('location'), '/app/hq/apps/slack');
  assert.deepEqual(flashes.pop(), { type: 'win', text: 'Slack connected.' });
  assert.equal(stored(boss, 'slack').label, 'Rivera Team');
  // The state is single use.
  await s.go(`/app/hq/connect/slack/callback?code=abc&state=${state}`, { as: boss });
  assert.match(flashes.pop().text, /didn't match/);

  const off = await s.go('/app/hq/apps/notion/disconnect', { as: boss, form: {} });
  assert.equal(off.status, 302);
  assert.equal(connectors.credsOf(boss.id, 'notion'), null);
});

// ---------- ads ----------

test('ads: insights as numbers, campaigns only as paused drafts, Google waits for its developer token', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_META_ADS = 'on';
  process.env.CONNECTOR_GOOGLE_ADS = 'on';
  process.env.OAUTH_META_ID = 'm';
  process.env.OAUTH_META_SECRET = 'ms';
  const boss = await member('builder', { email: 'boss@127.test' });
  const c = hq.connOf(boss.id);
  c.apps = { meta_ads: { secret: hq.enc(JSON.stringify({ access: 'meta-tok', expiresAt: null })), status: 'ok', kind: 'oauth' }, google_ads: { secret: hq.enc(JSON.stringify({ access: 'g-tok' })), status: 'ok', kind: 'oauth' } };
  await hq.saveConn(c);

  on('GET', /graph\.facebook\.com\/v23\.0\/me\/adaccounts/, { data: [{ id: 'act_42', name: 'Rivera', currency: 'USD', account_status: 1 }] });
  on('GET', /act_42\/insights/, { data: [{ ad_id: 'a1', ad_name: 'Hook A', campaign_name: 'Spring', spend: '50', impressions: '10000', clicks: '200', frequency: '1.8', actions: [{ action_type: 'lead', value: '5' }] }] });
  const meta = connectors.clientFor(boss, 'meta_ads');
  const rows = await meta.insights('42', { days: 7 });
  assert.deepEqual(rows[0], { id: 'a1', name: 'Hook A', campaign: 'Spring', spend: 50, impressions: 10000, clicks: 200, results: 5, frequency: 1.8, ctr: 2, cpc: 0.25, costPerResult: 10 });

  await assert.rejects(() => meta.writes.draftCampaign({ accountId: '42', name: 'Test' }), /need your OK first/);
  on('POST', /act_42\/campaigns/, (url, opts) => {
    const b = new URLSearchParams(opts.body);
    assert.equal(b.get('status'), 'PAUSED');
    assert.equal(b.get('objective'), 'OUTCOME_LEADS');
    return { id: 'cmp1' };
  });
  const ok = connectors.clientFor(boss, 'meta_ads', { write: true, approvedBy: 'check' });
  assert.equal((await ok.writes.draftCampaign({ accountId: '42', name: 'Test', objective: 'leads' })).status, 'PAUSED');

  await assert.rejects(() => connectors.clientFor(boss, 'google_ads').accounts(), /developer access/);
  process.env.GOOGLE_ADS_DEV_TOKEN = 'dev';
  on('POST', /googleads\.googleapis\.com\/v21\/customers\/123\/googleAds:mutate/, (url, opts) => {
    const b = JSON.parse(opts.body);
    assert.equal(b.mutateOperations[1].campaignOperation.create.status, 'PAUSED');
    assert.equal(opts.headers['developer-token'], 'dev');
    return { mutateOperationResponses: [{ campaignBudgetResult: {} }, { campaignResult: { resourceName: 'customers/123/campaigns/9' } }] };
  });
  const g = connectors.clientFor(boss, 'google_ads', { write: true, approvedBy: 'check' });
  assert.equal((await g.writes.draftCampaign({ accountId: '123-', name: 'Search test' })).id, '9');
  delete process.env.GOOGLE_ADS_DEV_TOKEN;
});

// ---------- dashboards ----------

test('dashboards: templates, tiles from HQ, the Pipeline and Stripe, goals and alerts, drag order, the pages', async () => {
  process.env.CONNECTORS = 'on';
  process.env.DASHBOARDS = 'on';
  const jo = await member('builder', { hq: { weeks: { [hq.weekKey()]: { v: { leads: 6, sales: 2, revenue: 300 } }, [hq.addWeeks(hq.weekKey(), -1)]: { v: { leads: 3 } } } } });
  assert.equal((await s.go('/app/hq/boards', { as: jo })).status, 200);

  const { board } = await dashboards.create(jo, { template: 'service' });
  assert.equal(board.name, 'Local service');
  assert.ok(board.tiles.length >= 6);
  await db.save('pipeline', { id: 'pl1', memberId: jo.id, stage: 'won', name: 'A' });
  await db.save('pipeline', { id: 'pl2', memberId: jo.id, stage: 'found', name: 'B' });

  const leadsTile = board.tiles.find((t) => t.metric === 'hq:leads');
  leadsTile.goal = 12;
  leadsTile.below = 10;
  await db.save('boards', board);
  const v = await dashboards.view(jo, board);
  const leads = v.tiles.find((t) => t.metric === 'hq:leads');
  assert.equal(leads.value, 6);
  assert.deepEqual(leads.change, { pct: 100, up: true });
  assert.equal(leads.goal.pct, 50);
  assert.equal(leads.alert, 'Below 10');
  assert.equal(v.tiles.find((t) => t.metric === 'pipeline:won').value, 1);
  // Not connected: the tile says what to connect.
  const overdue = v.tiles.find((t) => t.metric === 'stripe:overdue');
  assert.match(overdue.empty, /Connect Stripe/);

  const snap = await dashboards.snapshot(jo, board.id);
  assert.match(snap.lines[0], /Leads \(this week\): 6 · Below 10 · 50% of 12/);

  // Drag order, from the page's JSON.
  const ids = board.tiles.map((t) => t.id).reverse();
  const r = await s.go(`/app/hq/boards/${board.id}/order`, { as: jo, json: { order: ids } });
  assert.equal(r.status, 200);
  assert.deepEqual(db.get('boards', board.id).tiles.map((t) => t.id), ids);
  // Another member can't touch it.
  const other = await member();
  assert.equal((await s.go(`/app/hq/boards/${board.id}/order`, { as: other, json: { order: [] } })).status, 404);

  const add = await s.go(`/app/hq/boards/${board.id}/tiles`, { as: jo, form: { metric: 'hq:revenue', view: 'line', days: '30', goal: '1000' } });
  assert.equal(add.status, 302);
  const html = await (await s.go(`/app/hq/boards/${board.id}`, { as: jo })).text();
  assert.match(html, /\$300/);
  assert.match(html, /draggable="true"/);
  assert.match(html, /Connect Stripe to fill this in/);

  await s.go(`/app/hq/boards/${board.id}/delete`, { as: jo, form: {} });
  assert.equal(db.get('boards', board.id), null);
  delete process.env.DASHBOARDS;
  assert.equal((await s.go('/app/hq/boards', { as: jo })).status, 404);
});

test('account deletion forgets saved keys, the Activity log and dashboards', async () => {
  process.env.CONNECTORS = 'admins';
  process.env.CONNECTOR_NOTION = 'on';
  process.env.DASHBOARDS = 'admins';
  const boss = await member('builder', { email: 'boss@127.test' });
  notionOk();
  await connectors.connectKey(boss, 'notion', { token: NOTION });
  await dashboards.create(boss, { template: 'creator' });
  assert.ok(log.list(boss.id).length);
  await connectors.forget(boss.id);
  assert.equal(connectors.credsOf(boss.id, 'notion'), null);
  assert.equal(log.list(boss.id).length, 0);
  assert.equal(dashboards.boards(boss).length, 0);
});
