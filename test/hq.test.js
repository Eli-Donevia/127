// 127 HQ (lib/hq.js, lib/hq-routes.js, product/hub/v1-spec.md): the calculator port matches the
// browser one, weeks follow Eastern time, Stripe and Shopify count sales without keeping keys in the
// clear, the 127 link takes numbers, and Free members, HQ_LIVE and connections are gated.
// No network: Stripe is a fake client and events are captured in memory.

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-hq-${process.pid}.json`);
process.env.BASE_URL = 'https://127.test';
// No network: Read my week runs in demo mode, and nothing goes to Klaviyo or a webhook.
for (const k of ['ANTHROPIC_API_KEY', 'KLAVIYO_PRIVATE_KEY', 'WEBHOOK_URL']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const hq = require('../lib/hq');
const hqRoutes = require('../lib/hq-routes');
const ai = require('../lib/ai');
const { plan } = require('../lib/plans');

const SECRET = 'hq-test-secret-'.padEnd(48, 'x');
const at = (s) => Date.parse(s);
const NOW = at('2026-12-16T15:00:00Z'); // Wednesday, week of Mon Dec 14 (ET)
let now = NOW;
let events = [];
let stripeFake = null;
let flashes = [];
let reserved = 0;
let refunded = 0;

test.before(async () => {
  await db.init();
});
// The store writes the file 100ms after the last save, so clean up when the process exits.
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
});
test.beforeEach(() => {
  now = NOW;
  events = [];
  flashes = [];
  reserved = 0;
  refunded = 0;
  stripeFake = fakeStripe([]);
  process.env.HQ_LIVE = 'true';
  process.env.HQ_SECRET = SECRET;
  hq._setDeps({ now: () => now, emit: (type, payload) => events.push({ type, payload }), stripe: (key) => stripeFake.client(key) });
});

let n = 0;
async function member(extra = {}) {
  n += 1;
  return db.save('users', { email: `hq${n}-${Date.now()}@x.test`, name: `Sam${n} Lee`, tier: 'builder', emailVerified: true, roadmap: { weeks: [] }, ...extra });
}

// ---------- a fake Stripe client: charges.list is awaitable and async-iterable ----------
function fakeStripe(charges, { fail } = {}) {
  const calls = [];
  const list = (args) => {
    calls.push(args);
    return {
      then(ok, no) {
        return (fail ? Promise.reject(fail) : Promise.resolve({ data: charges.slice(0, 1), has_more: charges.length > 1 })).then(ok, no);
      },
      [Symbol.asyncIterator]: async function* () {
        if (fail) throw fail;
        for (const c of charges) yield c;
      },
    };
  };
  const keys = [];
  return { calls, keys, charges, client: (key) => (keys.push(key), { charges: { list } }) };
}
const authError = () => Object.assign(new Error('Invalid API Key provided'), { type: 'StripeAuthenticationError', statusCode: 401 });
let chargeN = 0;
function charge(isoTime, amount, extra = {}) {
  chargeN += 1;
  return { id: `ch_${chargeN}`, status: 'succeeded', amount_captured: amount, amount_refunded: 0, currency: 'usd', created: Math.floor(at(isoTime) / 1000), ...extra };
}
const RK = 'rk_test_' + 'A1b2C3d4E5f6G7h8I9j0K1l2';

// ---------- the browser calculator, run in a fake DOM ----------
const WORKSHEET = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'worksheet.js'), 'utf8');
function browserKpi(inputs) {
  const hidden = { value: '' };
  const els = {};
  const filled = () => Object.keys(inputs).filter((k) => inputs[k] !== null && inputs[k] !== undefined && inputs[k] !== '');
  const root = {
    getAttribute: () => 'kpi',
    closest: () => ({ querySelector: () => hidden }),
    innerHTML: '',
    querySelector(sel) {
      const m = sel.match(/^\[data-k="(.+)"\]$/);
      if (m) return (els[m[1]] = els[m[1]] || { value: inputs[m[1]] === null || inputs[m[1]] === undefined ? '' : String(inputs[m[1]]) });
      return { textContent: '', className: '', innerHTML: '' };
    },
    querySelectorAll: () => filled().map((k) => ({ value: String(inputs[k]), getAttribute: () => k })),
    addEventListener() {},
  };
  const document = { addEventListener() {}, querySelector: (sel) => (sel === '[data-calc]' ? root : null) };
  vm.runInNewContext(WORKSHEET, { document, navigator: {}, setTimeout });
  return JSON.parse(hidden.value);
}
const IDS = ['posts', 'outreach', 'reach', 'visits', 'leads', 'replies', 'sales', 'revenue'];
function both(t, l = {}, g = {}) {
  const inputs = {};
  for (const k of IDS) {
    if (t[k] !== undefined && t[k] !== null) inputs['t_' + k] = t[k];
    if (l[k] !== undefined && l[k] !== null) inputs['l_' + k] = l[k];
  }
  if (g.posts) inputs.g_posts = g.posts;
  if (g.outreach) inputs.g_outreach = g.outreach;
  const fill = (w) => Object.fromEntries(IDS.map((k) => [k, w[k] === undefined ? null : w[k]]));
  return { browser: browserKpi(inputs).summary, server: hq.analyze(fill(t), fill(l), g) };
}

test('the server calculator says exactly what the KPI Dashboard calculator says', () => {
  const maya = { posts: 4, outreach: 22, reach: 12400, visits: 420, leads: 15, replies: 6, sales: 7, revenue: 212 };
  const mayaLast = { posts: 4, outreach: 18, reach: 9800, visits: 350, leads: 11, replies: 4, sales: 5, revenue: 150 };
  const cases = [
    [maya, mayaLast, { posts: 4, outreach: 20 }],
    [maya, mayaLast, {}],
    // A big drop in reach to visits beats a step below its floor.
    [{ posts: 3, outreach: 10, reach: 20000, visits: 150, leads: 12, sales: 2, revenue: 98 }, { posts: 3, outreach: 10, reach: 15000, visits: 300, leads: 9, sales: 2, revenue: 120 }, {}],
    // Selling straight from a store: no leads, so visits to sales replaces visits to leads.
    [{ posts: 5, reach: 8000, visits: 600, sales: 9, revenue: 431.5 }, { posts: 5, reach: 7000, visits: 500, sales: 6, revenue: 300 }, {}],
    // Replies blank, replies 0, replies more than leads.
    [{ outreach: 30, leads: 12, replies: 0, sales: 1, revenue: 40 }, {}, {}],
    [{ outreach: 30, leads: 4, replies: 9, sales: 1, revenue: 9.5 }, { outreach: 25, leads: 6, replies: 3, sales: 2, revenue: 19 }, { outreach: 40 }],
    // Inputs down and results down; results up on less effort; steady.
    [{ posts: 1, outreach: 5, reach: 900, visits: 120, leads: 3, sales: 0, revenue: 0 }, { posts: 4, outreach: 20, reach: 3000, visits: 200, leads: 8, sales: 2, revenue: 80 }, {}],
    [{ posts: 2, outreach: 5, reach: 900, visits: 120, leads: 12, sales: 3, revenue: 120 }, { posts: 4, outreach: 20, reach: 3000, visits: 200, leads: 8, sales: 2, revenue: 80 }, {}],
    [{ posts: 4, outreach: 20, leads: 8, sales: 2, revenue: 80 }, { posts: 4, outreach: 20, leads: 8, sales: 2, revenue: 80 }, {}],
    // More sales than leads; average sale down by a fifth.
    [{ leads: 2, sales: 5, revenue: 100, visits: 50 }, { leads: 2, sales: 2, revenue: 100, visits: 40 }, {}],
    // No last week: no verdict.
    [{ posts: 3, reach: 2000, visits: 150, leads: 4 }, {}, { posts: 5 }],
    // Big numbers and cents.
    [{ reach: 1250000, visits: 30000, leads: 450, sales: 61, revenue: 18432.75 }, { reach: 990000, visits: 26000, leads: 400, sales: 50, revenue: 15000 }, {}],
  ];
  for (const [t, l, g] of cases) {
    const { browser, server } = both(t, l, g);
    assert.equal(server.summary, browser, JSON.stringify({ t, l, g }));
  }
  const empty = both({}, mayaLast, {});
  assert.equal(empty.browser, '');
  assert.equal(empty.server.empty, true);
  const m = hq.analyze(maya, mayaLast, { posts: 4, outreach: 20 });
  assert.equal(m.weakest.key, 'r2');
  assert.equal(m.weakest.slug, 'offer-builder');
  assert.equal(m.verdict, 'Inputs on target and results up. Double down: same format, same channel, same message.');
});

test('weeks run Monday to Sunday in Eastern time, through both DST changes', () => {
  assert.equal(hq.weekKey(at('2026-12-14T04:30:00Z')), '2026-12-07', 'Sunday 11:30pm ET is still last week');
  assert.equal(hq.weekKey(at('2026-12-14T05:00:00Z')), '2026-12-14', 'midnight ET Monday starts the week');
  assert.equal(hq.weekKey(at('2026-03-09T03:00:00Z')), '2026-03-02', 'Sunday 11pm EDT, the night clocks went forward');
  assert.equal(hq.weekKey(at('2026-03-09T04:30:00Z')), '2026-03-09');
  assert.equal(hq.weekKey(at('2026-11-02T04:30:00Z')), '2026-10-26', 'Sunday 11:30pm EST, the night clocks went back');
  assert.equal(hq.weekKey(at('2026-11-02T05:10:00Z')), '2026-11-02');
  assert.equal(hq.addWeeks('2026-03-02', 1), '2026-03-09');
  assert.equal(hq.weekRange('2026-03-30'), 'Mar 30 to Apr 5');
  assert.equal(hq.weekRange('2026-12-14'), 'Dec 14 to 20');
  assert.equal(hq.defaultWeek(at('2026-12-14T15:00:00Z')), '2026-12-07', 'Monday opens last week');
  assert.equal(hq.defaultWeek(at('2026-12-15T15:00:00Z')), '2026-12-07', 'so does Tuesday');
  assert.equal(hq.defaultWeek(at('2026-12-16T15:00:00Z')), '2026-12-14', 'Wednesday opens this week');
  assert.equal(hq.okWeek('2026-12-14'), true);
  assert.equal(hq.okWeek('2026-12-21'), false, 'no future weeks');
  assert.equal(hq.okWeek('2026-12-15'), false, 'only Mondays');
  assert.equal(hq.okWeek(hq.addWeeks('2026-12-14', -104)), false, 'two years back at most');
  assert.equal(hq.okWeek('2026-12-14<script>'), false);
});

test('a week saves typed numbers, the call and the note; blanks clear and bad values are named', async () => {
  const u = await member();
  hq.saveWeek(u, '2026-12-14', { v_posts: '4', v_outreach: '22', v_revenue: '$1,212.50', v_leads: '6', call: 'double', note: 'x'.repeat(300) });
  const w = u.hq.weeks['2026-12-14'];
  assert.deepEqual(w.v, { posts: 4, outreach: 22, revenue: 1212.5, leads: 6 });
  assert.equal(w.call, 'double');
  assert.equal(w.note.length, 200);
  const r = hq.saveWeek(u, '2026-12-14', { v_posts: '', v_outreach: 'lots', v_revenue: '-5', v_leads: '7', call: 'constructor' });
  assert.deepEqual(r.bad, ['Outreach', 'Revenue']);
  assert.deepEqual(u.hq.weeks['2026-12-14'].v, { outreach: 22, revenue: 1212.5, leads: 7 }, 'blank posts cleared; bad values keep what was there');
  assert.equal(u.hq.weeks['2026-12-14'].call, '', 'an unknown call is no call');
  // Hidden numbers keep their values when the form doesn't show them.
  hq.saveWeek(u, '2026-12-07', { v_reach: '900', v_posts: '2' });
  hq.saveSettings(u, { tiles: '1', show: ['posts', 'leads', 'revenue'], north: 'leads' });
  assert.deepEqual(u.hq.hidden.sort(), ['outreach', 'reach', 'replies', 'sales', 'visits']);
  hq.saveWeek(u, '2026-12-07', { v_posts: '3', v_leads: '1', v_revenue: '10' });
  assert.equal(u.hq.weeks['2026-12-07'].v.reach, 900);
  // The North Number can't be hidden.
  hq.saveSettings(u, { tiles: '1', show: [], north: 'revenue' });
  assert.ok(!u.hq.hidden.includes('revenue'));
  hq.saveSettings(u, { target_posts: '4', target_outreach: '' });
  assert.deepEqual(u.hq.targets, { posts: 4 });
});

test('a shown number is typed plus what every connection counted; running totals carry over', async () => {
  const u = await member();
  const h = hq.ensure(u);
  hq.saveWeek(u, '2026-12-14', { v_sales: '1', v_revenue: '20' });
  h.auto.shopify = { '2026-12-14': { sales: 7, revenue: 212 } };
  h.auto.stripe = { '2026-12-14': { sales: 2, revenue: 98.5 } };
  h.auto.link = { '2026-12-14': { leads: 9 } };
  assert.equal(hq.valueOf(u, '2026-12-14', 'sales'), 10);
  assert.equal(hq.valueOf(u, '2026-12-14', 'revenue'), 330.5);
  assert.equal(hq.valueOf(u, '2026-12-14', 'leads'), 9);
  assert.equal(hq.valueOf(u, '2026-12-14', 'visits'), null, 'nothing logged stays blank, not zero');
  const list = hq.addCustom(u, { label: 'Email list', kind: 'count', mode: 'total' }).custom;
  assert.equal(hq.addCustom(u, { label: 'email LIST' }).error, 'You already have a number called email LIST.');
  assert.ok(hq.addCustom(u, { label: 'Leads' }).error, 'the 8 names are taken');
  hq.saveWeek(u, '2026-11-30', { ['v_' + list.id]: '150' });
  h.auto.link['2026-12-07'] = { [list.id]: 163 };
  hq.saveWeek(u, '2026-12-07', { ['v_' + list.id]: '170' });
  assert.equal(hq.valueOf(u, '2026-12-07', list.id), 163, 'for a running total the 127 link wins over a typed number');
  const s = hq.series(u, list.id, '2026-12-14', 4);
  assert.deepEqual(s.map((x) => x.v), [null, 150, 163, 163], 'a quiet week carries the total forward');
  for (let i = 0; i < 5; i++) hq.addCustom(u, { label: `Extra ${i}` });
  assert.equal(u.hq.custom.length, 6);
  assert.match(hq.addCustom(u, { label: 'Seventh' }).error, /up to 6/);
  assert.equal(hq.removeCustom(u, list.id), true);
  assert.equal(u.hq.weeks['2026-11-30'].v[list.id], undefined, 'removing a number removes its history');
  // Weeks older than two years are dropped.
  u.hq.weeks['2024-12-02'] = { v: { posts: 1 } };
  h.auto.shopify['2024-12-02'] = { sales: 1 };
  hq.saveWeek(u, '2026-12-14', { v_posts: '3' });
  assert.equal(u.hq.weeks['2024-12-02'], undefined);
  assert.equal(h.auto.shopify['2024-12-02'], undefined);
});

test('the page: tiles, the leak with its 4-week average, the custom numbers and the dashboard card', async () => {
  const u = await member();
  hq.saveSettings(u, { target_posts: '4', target_outreach: '20' });
  const weeks = ['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'];
  const data = [
    { posts: 4, outreach: 20, reach: 6000, visits: 200, leads: 4, sales: 1, revenue: 30 },
    { posts: 4, outreach: 20, reach: 7000, visits: 300, leads: 5, sales: 2, revenue: 60 },
    { posts: 4, outreach: 18, reach: 9800, visits: 350, leads: 11, replies: 4, sales: 5, revenue: 150 },
    { posts: 4, outreach: 22, reach: 12400, visits: 420, leads: 15, replies: 6, sales: 7, revenue: 212 },
  ];
  weeks.forEach((k, i) => hq.saveWeek(u, k, Object.fromEntries(Object.entries(data[i]).map(([id, v]) => ['v_' + id, String(v)]))));
  u.hq.weeks['2026-12-14'].call = 'double';
  const p = hq.page(u, '2026-12-14', 'https://127.test');
  assert.equal(p.north.label, 'Revenue');
  assert.equal(p.north.value, '$212');
  assert.deepEqual(p.north.change, { text: '+41%', dir: 'up' });
  const tile = (id) => p.tiles.find((t) => t.id === id);
  assert.equal(tile('posts').sub, '4 of 4 · on target');
  assert.equal(tile('outreach').sub, '22 of 20 · on target');
  assert.equal(tile('leads').sub, '+36%');
  assert.equal(tile('reach').value, '12,400');
  assert.equal(p.leak.title, 'Visits to leads');
  assert.equal(p.leak.rate, '2.1%');
  // Visits to leads, summed over the weeks that pass the 100-visit minimum: (4+5+7+9) / (200+300+350+420).
  assert.equal(p.leak.avg, '2%');
  assert.equal(p.leak.floor, '3%');
  assert.equal(p.leak.hint, 'People look but don’t raise a hand. Make the offer and the next step obvious.');
  assert.equal(p.leak.slug, 'offer-builder');
  assert.equal(p.analysis.verdict, 'Inputs on target and results up. Double down: same format, same channel, same message.');
  assert.equal(p.isCurrent, true);
  assert.equal(p.next, null);
  assert.equal(p.prev, '2026-12-07');
  const card = hq.dashCard(u);
  assert.deepEqual(card, { label: 'Revenue', value: '$150', change: { text: '+150%', dir: 'up' }, logged: true, week: '2026-12-07', weekLabel: 'Dec 7' });
  const fresh = await member();
  assert.equal(hq.dashCard(fresh).logged, false);
  const empty = hq.page(fresh, '2026-12-14', '');
  assert.equal(empty.analysis.empty, true);
  assert.equal(empty.north.value, '–');
  assert.equal(empty.hasData, false);
});

test('Read my week hands Eli\'s Playbook the KPI worksheet, filled from HQ, within the 1,200-character summary', async () => {
  const u = await member();
  hq.saveSettings(u, { target_posts: '4', target_outreach: '20' });
  for (let i = 0; i < 12; i++) {
    const k = hq.addWeeks('2026-12-14', -i);
    hq.saveWeek(u, k, { v_posts: '4', v_outreach: String(20 + i), v_reach: String(12000 - i * 700), v_visits: String(420 - i * 25), v_leads: String(15 - i), v_replies: '3', v_sales: String(Math.max(0, 7 - i)), v_revenue: String(Math.max(0, 212 - i * 20)), call: ['double', 'pause', 'kill'][i % 3], note: 'Same 4 reels.' });
  }
  for (let i = 0; i < 6; i++) hq.addCustom(u, { label: `My own number ${i}`, mode: i % 2 ? 'total' : 'weekly' });
  const v = hq.readValues(u, '2026-12-14');
  assert.match(v.omtm, /^Revenue: \$212 this week \(\+10% vs last week\)\.$/);
  assert.equal(v.lead_measures, 'Posts: target 4 a week, did 4. Outreach: target 20 a week, did 20.');
  assert.match(v.biggest_leak, /^Weakest step: /);
  assert.equal(v.weekly_decision, 'Double down: Same 4 reels.');
  const calc = JSON.parse(v.__calc);
  assert.ok(calc.summary.length <= 1200, `summary is ${calc.summary.length} characters`);
  assert.match(calc.summary, /^This week: posts 4\/4, outreach 20\/20/);
  assert.match(calc.summary, /Last 12 weeks, oldest first/);
  assert.match(calc.summary, /revenue 0,12,32,52,72,92,112,132,152,172,192,212; sales 0,0,0,0,0,1,2,3,4,5,6,7;/);
  assert.equal(calc.inputs.t_revenue, '212');
  assert.equal(calc.inputs.l_revenue, '192');
  assert.equal(calc.inputs.g_posts, '4');
  // Same worksheet shape as the library's, so lib/ai.js reads it like any KPI Dashboard worksheet.
  const kpi = require('../content/resources.json').resources.find((r) => r.slug === 'kpi-dashboard');
  for (const f of kpi.worksheet) assert.ok(f.id in v, f.id);
});

test('Stripe: restricted keys only, encrypted at rest, 12 weeks of paid charges by Eastern week', async () => {
  const u = await member();
  assert.match((await hq.connectStripe(u, 'sk_live_' + 'x'.repeat(24))).error, /secret key/);
  assert.match((await hq.connectStripe(u, 'pk_live_' + 'x'.repeat(24))).error, /publishable key/);
  assert.match((await hq.connectStripe(u, 'hello')).error, /starts with rk_live_ or rk_test_/);
  delete process.env.HQ_SECRET;
  assert.match((await hq.connectStripe(u, RK)).error, /can't be connected yet/);
  process.env.HQ_SECRET = SECRET;
  stripeFake = fakeStripe([], { fail: authError() });
  assert.match((await hq.connectStripe(u, RK)).error, /didn't work/);
  assert.equal(db.get('hqConnections', u.id), null, 'a key that fails is never saved');
  stripeFake = fakeStripe([
    charge('2026-12-14T17:00:00Z', 5000),
    charge('2026-12-08T17:00:00Z', 2000, { amount_refunded: 500 }),
    charge('2026-12-14T04:30:00Z', 1000), // Sunday Dec 13, 11:30pm ET
    charge('2026-12-09T17:00:00Z', 3000, { amount_refunded: 3000 }),
    charge('2026-12-10T17:00:00Z', 4000, { status: 'failed' }),
    charge('2026-12-10T17:00:00Z', 900, { currency: 'eur' }),
    charge('2026-09-01T17:00:00Z', 7000), // older than 12 weeks
  ]);
  const out = await hq.connectStripe(u, RK);
  assert.deepEqual(out, { ok: true, sales: 3 });
  assert.equal(stripeFake.calls[0].limit, 1, 'the key is checked with one read first');
  assert.equal(stripeFake.calls[1].created.gte, Math.floor((at('2026-09-28T00:00:00Z') - 864e5) / 1000), 'from a day before the first of the 12 weeks');
  assert.deepEqual(u.hq.auto.stripe, { '2026-12-14': { sales: 1, revenue: 50 }, '2026-12-07': { sales: 2, revenue: 25 } });
  assert.equal(u.hq.currency, 'usd');
  const c = db.get('hqConnections', u.id);
  assert.equal(c.stripe.otherCurrency, 1);
  assert.equal(c.stripe.last4, RK.slice(-4));
  assert.ok(!JSON.stringify(c).includes(RK), 'the key is never stored in the clear');
  assert.ok(!JSON.stringify(db.get('users', u.id)).includes(RK), 'nor on the member');
  assert.equal(hq.dec(c.stripe.key), RK);
  assert.ok(!JSON.stringify(hq.connections(u, 'https://127.test')).includes(c.stripe.key), 'the page never gets the key');
  assert.deepEqual(events.map((e) => e.type), ['hq.connected']);
  assert.ok(!JSON.stringify(events).includes('rk_'), 'events carry no key');
  // A refund on a later sync takes the sale out of its week.
  stripeFake.charges[0].amount_refunded = 5000;
  await hq.syncStripe(u);
  assert.equal(u.hq.auto.stripe['2026-12-14'], undefined);
  // A key revoked in Stripe: the connection says so and the daily refresh stops.
  stripeFake = fakeStripe([], { fail: authError() });
  assert.equal((await hq.syncStripe(u)).error, 'Reconnect Stripe.');
  assert.equal(db.get('hqConnections', u.id).stripe.status, 'broken');
  // Without HQ_SECRET (or with another one) a saved key can't be read.
  process.env.HQ_SECRET = 'another-secret-'.padEnd(48, 'y');
  assert.equal(hq.dec(c.stripe.key), null);
});

test('Stripe: zero-decimal currencies, the daily refresh, and keys of former Builders', async () => {
  const yen = await member();
  stripeFake = fakeStripe([charge('2026-12-15T03:00:00Z', 1500, { currency: 'jpy' })]);
  await hq.connectStripe(yen, RK);
  assert.deepEqual(yen.hq.auto.stripe['2026-12-14'], { sales: 1, revenue: 1500 });
  assert.equal(yen.hq.currency, 'jpy');
  assert.equal(hq.page(yen, '2026-12-14', '').tiles.find((t) => t.id === 'revenue').value, '¥1,500');

  const a = await member();
  stripeFake = fakeStripe([charge('2026-12-15T17:00:00Z', 1000)]);
  await hq.connectStripe(a, RK);
  stripeFake = fakeStripe([charge('2026-12-15T17:00:00Z', 1000), charge('2026-12-16T12:00:00Z', 2500)]);
  now = NOW + 2 * 864e5;
  const ran = await hq.tick();
  assert.ok(ran >= 1);
  assert.deepEqual(a.hq.auto.stripe['2026-12-14'], { sales: 2, revenue: 35 });
  assert.equal(await hq.tick(), 0, 'once a day');

  // Cancelled more than 30 days ago: the saved keys go, the numbers stay. A pause keeps them.
  const gone = await member();
  stripeFake = fakeStripe([charge('2026-12-15T17:00:00Z', 1000)]);
  await hq.connectStripe(gone, RK);
  const paused = await member();
  await hq.connectStripe(paused, RK);
  Object.assign(gone, { tier: 'free', canceledAt: new Date(now - 31 * 864e5).toISOString() });
  Object.assign(paused, { tier: 'free', pausedTier: 'builder', canceledAt: new Date(now - 31 * 864e5).toISOString() });
  await hq.tick();
  assert.equal(db.get('hqConnections', gone.id).stripe, undefined);
  assert.ok(gone.hq.auto.stripe['2026-12-14']);
  assert.ok(db.get('hqConnections', paused.id).stripe, 'a paused member keeps HQ and its connections');
});

// ---------- HTTP: the routes with real views ----------
function locals(user, req) {
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: false, path: req.path, flash: null,
    builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
    launch: {}, pauseInfo: user && user.pausedTier ? { paused: true, resumesAt: '2027-01-10T00:00:00Z' } : null,
    ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
    fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null,
    hqLive: hq.live(),
  };
}
async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.all('/hq/in/:token', hqRoutes.inbound);
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    req.session = {};
    Object.assign(res.locals, locals(req.user, req));
    next();
  });
  const user = (u) => u;
  app.use(hqRoutes({
    requireAuth: (req, res, next) => (req.user ? next() : res.redirect('/login')),
    flash: (req, type, text) => flashes.push({ type, text }),
    track: () => {},
    reserveAi: (req, res, u) => {
      reserved += 1;
      user(u).aiUsage = { month: 'x', count: ((u.aiUsage && u.aiUsage.count) || 0) + 1 };
      return true;
    },
    refundAi: (u) => {
      refunded += 1;
      u.aiUsage.count -= 1;
    },
    ageFromAi: async () => false,
    aiRunsLeft: () => 10,
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
    if (json) { body = JSON.stringify(json); h['content-type'] = 'application/json'; }
    if (raw !== undefined) body = raw;
    return fetch(url + p, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

test('HQ_LIVE off: no pages, no inbound, nothing in the nav', async () => {
  const s = await server();
  try {
    delete process.env.HQ_LIVE;
    const u = await member();
    const r = await s.go('/app/hq', { as: u });
    assert.equal(r.status, 404);
    assert.equal(await r.text(), 'app 404');
    assert.equal((await s.go('/app/hq/connect', { as: u })).status, 404);
    assert.equal((await s.go('/app/hq/week', { as: u, form: { w: '2026-12-14', v_posts: '3' } })).status, 404);
    assert.equal(u.hq, undefined);
    assert.equal((await s.go('/hq/in/' + 'a'.repeat(43), { json: { leads: 1 } })).status, 404);
    assert.equal(hq.page(u, '2026-12-14', '').key, '2026-12-14', 'the logic still works for tests');
    assert.equal(await hq.tick(), 0);
  } finally {
    await s.close();
  }
});

test('Free members get the preview; Builders, Circle and paused members get HQ', async () => {
  const s = await server();
  try {
    assert.equal((await s.go('/app/hq')).headers.get('location'), '/login');
    const free = await member({ tier: 'free', milestones: { idea_test: true, conversations: true } });
    const r = await s.go('/app/hq', { as: free });
    const html = await r.text();
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(html, /See what's working, every week\./);
    assert.match(html, /data-upgrade="hq"/);
    assert.match(html, /\$29 a month plus tax\. Renews monthly until you cancel\. Cancel online anytime from Billing\./);
    assert.match(html, /3 of 10 milestones/);
    assert.match(html, /Next: Offer written/);
    assert.match(html, /Sample numbers, not a real member's results\./);
    const sample = (html.split('What Builders see')[1] || '').split('Sample numbers')[0];
    assert.ok(sample.length > 100, 'the sample is on the page');
    assert.doesNotMatch(sample, /\$\d/, 'the sample shows no money');
    assert.match(html, /href="\/app\/hq" class="on">.*HQ<span class="lock"[^>]*>Builder<\/span>/s);
    const post = await s.go('/app/hq/week', { as: free, form: { w: '2026-12-14', v_posts: '3' } });
    assert.equal(post.status, 302);
    assert.equal(post.headers.get('location'), '/app/hq');
    assert.equal(db.get('users', free.id).hq, undefined);
    assert.equal((await s.go('/app/hq/connect', { as: free })).headers.get('location'), '/app/hq');
    for (const extra of [{ tier: 'builder' }, { tier: 'circle' }, { tier: 'free', pausedTier: 'builder' }]) {
      const m = await member(extra);
      const page = await s.go('/app/hq', { as: m });
      const body = await page.text();
      assert.equal(page.status, 200, JSON.stringify(extra));
      assert.match(body, /Where it leaks/);
      assert.match(body, /Save week/);
      assert.doesNotMatch(body, /data-upgrade="hq"/);
    }
  } finally {
    await s.close();
  }
});

test('saving the week, settings, own numbers and Read my week through the pages', async () => {
  const s = await server();
  try {
    const u = await member();
    let r = await s.go('/app/hq/week', { as: u, form: { w: '2026-12-07', v_posts: '4', v_leads: '6', v_visits: '300', v_reach: '9000', call: 'pause', note: 'Testing a new hook' } });
    assert.equal(r.headers.get('location'), '/app/hq?w=2026-12-07#leak');
    assert.deepEqual(db.get('users', u.id).hq.weeks['2026-12-07'].v, { posts: 4, reach: 9000, visits: 300, leads: 6 });
    assert.equal(db.filter('events', (e) => e.type === 'hq.week_saved' && e.payload.userId === u.id).length, 1);
    r = await s.go('/app/hq/week', { as: u, form: { w: '2026-12-21', v_posts: '4' } });
    assert.equal(r.headers.get('location'), '/app/hq', 'a future week is refused');
    r = await s.go('/app/hq/numbers', { as: u, form: { label: 'Email list', kind: 'count', mode: 'total', w: '2026-12-07' } });
    assert.equal(r.headers.get('location'), '/app/hq?w=2026-12-07#numbers');
    const id = db.get('users', u.id).hq.custom[0].id;
    r = await s.go('/app/hq/settings', { as: u, form: { north: id, target_posts: '5', tiles: '1', show: 'posts' } });
    assert.equal(db.get('users', u.id).hq.north, id);
    const page = await (await s.go('/app/hq?w=2026-12-07', { as: u })).text();
    assert.match(page, /North Number · Email list/);
    assert.match(page, /Testing a new hook/);
    assert.match(page, /value="pause" checked/);
    assert.match(page, /Week of Dec 7/);
    assert.match(page, /Go to this week/);
    assert.match(page, /Open The One-Page Offer|No clear leak|Log the week to find it/);
    r = await s.go(`/app/hq/numbers/${id}/delete`, { as: u, form: { w: '2026-12-07' } });
    assert.equal(db.get('users', u.id).hq.custom.length, 0);
    assert.notEqual(db.get('users', u.id).hq.north, id);

    // Read my week: one message reserved, kept on success (demo mode without an API key).
    r = await s.go('/app/hq/read', { as: u, form: { w: '2026-12-07' } });
    assert.equal(r.headers.get('location'), '/app/hq?w=2026-12-07#read');
    assert.equal(reserved, 1);
    assert.equal(refunded, 0);
    const read = db.get('users', u.id).hq.read;
    assert.equal(read.week, '2026-12-07');
    assert.match(read.text, /Founder KPI Dashboard/);
    assert.match(await (await s.go('/app/hq?w=2026-12-07', { as: u })).text(), /Demo feedback\./);
    // An AI error hands the message back.
    const review = ai.review;
    ai.review = async () => ({ error: true, text: 'The Playbook is busy. Try again in a minute.' });
    try {
      await s.go('/app/hq/read', { as: u, form: { w: '2026-12-07' } });
    } finally {
      ai.review = review;
    }
    assert.equal(reserved, 2);
    assert.equal(refunded, 1);
    assert.deepEqual(flashes.slice(-1), [{ type: 'error', text: 'The Playbook is busy. Try again in a minute.' }]);
  } finally {
    await s.close();
  }
});

test('connections page: Stripe through the form, the 127 link, Shopify, and disconnecting', async () => {
  const s = await server();
  try {
    const u = await member();
    let html = await (await s.go('/app/hq/connect', { as: u })).text();
    assert.match(html, /Numbers that/);
    assert.match(html, /Make my 127 link/);
    // Legal L48: the page's promises and the agreement lines.
    assert.match(html, /127 only reads, and keeps weekly totals\. It never moves money, sends messages or changes anything in your tools\./);
    assert.doesNotMatch(html, /reads totals only/);
    assert.equal(html.split('href="/terms#13a-connected-accounts-and-hq"').length - 1, 3, 'Connect Stripe and both Make my 127 link buttons (Shopify waits for the link)');
    assert.match(html, /never your customers' names, emails or addresses\. [^<]*<a href="\/privacy#7a-hq-and-connected-accounts">How we handle it<\/a>/);
    stripeFake = fakeStripe([charge('2026-12-15T17:00:00Z', 4900)]);
    let r = await s.go('/app/hq/connect/stripe', { as: u, form: { key: RK } });
    assert.equal(r.headers.get('location'), '/app/hq/connect#stripe');
    assert.deepEqual(flashes.slice(-1), [{ type: 'win', text: 'Stripe connected. 1 sale in the last 12 weeks.' }]);
    html = await (await s.go('/app/hq/connect', { as: u })).text();
    assert.match(html, new RegExp(`rk_test_••••${RK.slice(-4)}`));
    assert.match(html, /127 deletes its copy of your key, and sales already counted stay in HQ\. Delete the key in Stripe too\./);
    assert.ok(!html.includes(RK), 'the page never shows the key');
    // Shopify needs the 127 link first.
    r = await s.go('/app/hq/connect/shopify', { as: u, form: { secret: 'f'.repeat(64) } });
    assert.match(flashes.slice(-1)[0].text, /Make your 127 link first/);
    r = await s.go('/app/hq/link', { as: u, form: { back: 'shopify' } });
    assert.equal(r.headers.get('location'), '/app/hq/connect#shopify');
    const c = db.get('hqConnections', u.id);
    html = await (await s.go('/app/hq/connect', { as: u })).text();
    assert.ok(html.includes(`data-copy-value="https://127.test/hq/in/${c.link.token}"`));
    assert.match(html, /Send numbers only, never names or emails\./);
    assert.match(html, /Connect Shopify<\/button>\s*<p class="hq-small">By connecting, you agree to the <a href="\/terms#13a-connected-accounts-and-hq">connected accounts terms<\/a> and confirm you're allowed to share this account's sales data with 127\.<\/p>/);
    assert.ok(html.includes(`127.test/hq/in/••••${c.link.token.slice(-4)}`));
    assert.equal((await s.go('/app/hq/connect/shopify', { as: u, form: { secret: 'short' } })).status, 302);
    assert.match(flashes.slice(-1)[0].text, /doesn't look like Shopify's signing key/);
    await s.go('/app/hq/connect/shopify', { as: u, form: { secret: 'f'.repeat(64) } });
    assert.equal(db.get('hqConnections', u.id).shopify.status, 'waiting');
    assert.ok(!JSON.stringify(db.get('hqConnections', u.id)).includes('f'.repeat(64)), 'the signing key is encrypted too');
    // Under an age review, connections are paused.
    const kid = await member({ ageReview: { status: 'open' } });
    r = await s.go('/app/hq/link', { as: kid, form: {} });
    assert.equal(r.headers.get('location'), '/app/hq/connect');
    assert.equal(db.get('hqConnections', kid.id), null);
    // Turning off the link turns off Shopify, which sends to it.
    await s.go('/app/hq/disconnect/link', { as: u, form: {} });
    const after = db.get('hqConnections', u.id);
    assert.equal(after.link, undefined);
    assert.equal(after.shopify, undefined);
    assert.ok(after.stripe);
    await s.go('/app/hq/disconnect/stripe', { as: u, form: {} });
    assert.equal(db.get('hqConnections', u.id).stripe, undefined, 'disconnecting deletes the key');
    assert.ok(db.get('users', u.id).hq.auto.stripe['2026-12-14'], 'counted sales stay');
  } finally {
    await s.close();
  }
});

test('Shopify orders: signed, counted once, test orders and other currencies skipped, refunds subtracted', async () => {
  const s = await server();
  try {
    const u = await member();
    const token = await hq.makeLink(u);
    const secret = 'shpss_' + 'a1'.repeat(30);
    assert.deepEqual(await hq.connectShopify(u, secret), { ok: true });
    const send = (topic, body, { sign = secret, extra = {} } = {}) => {
      const raw = JSON.stringify(body);
      return s.go('/hq/in/' + token, { raw, headers: { 'content-type': 'application/json', 'x-shopify-topic': topic, 'x-shopify-shop-domain': 'maya-candles.myshopify.com', 'x-shopify-hmac-sha256': crypto.createHmac('sha256', sign).update(raw).digest('base64'), ...extra } });
    };
    const order = { id: 820982911946154500, created_at: '2026-12-15T10:00:00-05:00', currency: 'USD', total_price: '49.00', customer: { email: 'buyer@example.com', first_name: 'Ana' }, test: false };
    let r = await send('orders/create', order);
    assert.equal(r.status, 200);
    assert.equal(await r.text(), 'OK');
    r = await send('orders/create', order);
    assert.equal(await r.text(), 'Already counted');
    r = await send('orders/create', { ...order, id: 2 }, { sign: 'wrong-secret' });
    assert.equal(r.status, 401);
    r = await send('orders/create', { ...order, id: 3, test: true });
    assert.equal(await r.text(), 'Test order skipped');
    r = await send('orders/create', { ...order, id: 4, currency: 'EUR', total_price: '10.00' });
    r = await send('orders/create', { ...order, id: 5, created_at: '2026-12-13T23:30:00-05:00', total_price: '20.50' });
    r = await send('refunds/create', { id: 77, order_id: order.id, created_at: '2026-12-16T09:00:00-05:00', transactions: [{ kind: 'refund', status: 'success', amount: '9.00' }, { kind: 'refund', status: 'failure', amount: '40.00' }] });
    r = await send('refunds/create', { id: 77, order_id: order.id, created_at: '2026-12-16T09:00:00-05:00', transactions: [{ kind: 'refund', status: 'success', amount: '9.00' }] });
    assert.equal(await r.text(), 'Already counted');
    r = await send('customers/create', { id: 9 });
    assert.equal(await r.text(), 'Ignored');
    const saved = db.get('users', u.id);
    assert.deepEqual(saved.hq.auto.shopify, { '2026-12-14': { sales: 1, revenue: 40 }, '2026-12-07': { sales: 1, revenue: 20.5 } });
    const c = db.get('hqConnections', u.id);
    assert.equal(c.shopify.shop, 'maya-candles.myshopify.com');
    assert.equal(c.shopify.status, 'ok');
    assert.equal(c.shopify.otherCurrency, 1);
    assert.ok(!JSON.stringify(saved).includes('buyer@example.com') && !JSON.stringify(c).includes('buyer@example.com'), 'totals, not customers');
    const p = hq.page(saved, '2026-12-14', '');
    assert.deepEqual(p.fields.find((f) => f.id === 'sales').auto, [{ source: 'Shopify', text: '+1' }]);
    assert.deepEqual(p.tiles.find((t) => t.id === 'revenue').sources, ['Shopify']);
  } finally {
    await s.close();
  }
});

test('the 127 link: shapes, set, dates, names, errors, limits and who it works for', async () => {
  const s = await server();
  try {
    const u = await member();
    const list = hq.addCustom(u, { label: 'Email list', mode: 'total' }).custom;
    hq.saveWeek(u, '2026-12-07', { ['v_' + list.id]: '180' });
    await db.save('users', u);
    const token = await hq.makeLink(u);
    const post = (json, headers) => s.go('/hq/in/' + token, { json, headers });
    let r = await post({ metric: 'leads', value: 1 }, { 'user-agent': 'Zapier' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, week: '2026-12-14', counted: [{ metric: 'Leads', value: 1 }] });
    await post({ leads: 1, sales: '1', revenue: '49.50' });
    await post({ metric: 'Replies to outreach', value: 2 });
    await post({ metric: 'email list', value: 6 });
    let w = db.get('users', u.id).hq.auto.link['2026-12-14'];
    assert.deepEqual(w, { leads: 2, sales: 1, revenue: 49.5, replies: 2, [list.id]: 186 }, 'adding to a running total starts from the last known value');
    await post({ metric: 'Email list', value: 412, mode: 'set' });
    assert.equal(db.get('users', u.id).hq.auto.link['2026-12-14'][list.id], 412);
    r = await post({ metric: 'leads', value: 1, date: '2026-12-01' });
    assert.equal((await r.json()).week, '2026-11-30');
    assert.equal((await post({ metric: 'leads', value: 1, date: '2026-12-25' })).status, 400);
    assert.match((await (await post({ metric: 'leads', value: 1, date: '2026-09-01' })).json()).error, /12 weeks back/);
    assert.equal((await (await post({ metric: 'leads', value: 1, date: 'soon' })).json()).error, 'date must look like 2026-12-09.', 'last week\'s Wednesday');
    r = await post({ metric: 'followers', value: 1 });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, 'Unknown metric "followers". Use one of: posts, outreach, reach, visits, leads, replies, sales, revenue, Email list.');
    assert.equal((await post({ metric: 'leads', value: -1 })).status, 400);
    assert.equal((await post({ metric: 'leads', value: 'two' })).status, 400);
    assert.equal((await post([1, 2])).status, 400);
    assert.equal((await post({})).status, 400);
    // Form posts work too (a Google Sheets script, ManyChat).
    r = await s.go('/hq/in/' + token, { raw: 'metric=visits&value=30', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(r.status, 200);
    assert.equal(db.get('users', u.id).hq.auto.link['2026-12-14'].visits, 30);
    const c = db.get('hqConnections', u.id);
    assert.equal(c.link.sources[0], 'Zapier');
    assert.equal(c.link.calls, 7, 'calls that counted something');
    // Wrong token, a browser visit, a Free member's link.
    assert.equal((await s.go('/hq/in/' + 'b'.repeat(43), { json: { leads: 1 } })).status, 404);
    assert.equal((await s.go('/hq/in/' + 'c'.repeat(43), { raw: 'x'.repeat(300 * 1024), headers: { 'content-type': 'application/json' } })).status, 404, 'a wrong link is refused before its body is read');
    assert.equal((await s.go('/hq/in/short', { json: { leads: 1 } })).status, 404);
    const get = await s.go('/hq/in/' + token);
    assert.equal(get.status, 405);
    assert.match(await get.text(), /private 127 link/);
    assert.equal(get.headers.get('set-cookie'), null);
    const free = await member({ tier: 'free' });
    const freeToken = await hq.makeLink(free);
    assert.equal((await s.go('/hq/in/' + freeToken, { json: { leads: 1 } })).status, 404);
    // A new link stops the old one at once.
    const fresh = await hq.makeLink(u);
    assert.equal((await post({ leads: 1 })).status, 404);
    assert.equal((await s.go('/hq/in/' + fresh, { json: { leads: 1 } })).status, 200);
    // 120 calls an hour per link.
    let last;
    for (let i = 0; i < 121; i++) last = await s.go('/hq/in/' + fresh, { json: { posts: 1 } });
    assert.equal(last.status, 429);
    // Too big.
    assert.equal((await s.go('/hq/in/' + fresh, { raw: JSON.stringify({ x: 'y'.repeat(300 * 1024) }), headers: { 'content-type': 'application/json' } })).status, 413);
    // Guessing links: 100 wrong ones an hour from one IP, then 429.
    let miss;
    for (let i = 0; i < 100; i++) miss = await s.go('/hq/in/' + crypto.randomBytes(32).toString('base64url'), { json: { leads: 1 } });
    assert.equal(miss.status, 429);
    const other = await hq.makeLink(await member());
    assert.equal((await s.go('/hq/in/' + other, { json: { leads: 1 } })).status, 200, 'a working link still works from that IP');
  } finally {
    await s.close();
  }
});

test('admin numbers: who can use HQ, who logged 3 weeks in a row, and connections', async () => {
  for (const u of db.all('users')) await db.remove('users', u.id);
  for (const c of db.all('hqConnections')) await db.remove('hqConnections', c.id);
  const a = await member();
  const b = await member();
  await member({ tier: 'free' });
  for (const k of ['2026-11-23', '2026-11-30', '2026-12-07']) hq.saveWeek(a, k, { v_posts: '3' });
  hq.saveWeek(b, '2026-12-07', { v_posts: '3' });
  await hq.makeLink(b);
  const st = hq.stats();
  assert.deepEqual(st, { members: 2, saved14: 2, streak3: 1, stripe: 0, shopify: 0, link: 1, ai: 0, checkin: 0 });
});

test('account deletion removes HQ connections (server.js deleteAccount)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function deleteAccount'), src.indexOf('// ---------- admin ----------'));
  assert.match(fn, /await db\.remove\('hqConnections', user\.id\);/);
  assert.match(src, /app\.all\('\/hq\/in\/:token', hqRoutes\.inbound\);\n[\s\S]*app\.use\(express\.urlencoded/, 'inbound is mounted before the body parser and the session');
});
