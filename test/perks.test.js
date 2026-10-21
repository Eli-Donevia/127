// Perks and grants (lib/perks, lib/perks-routes.js, views/app/hq2/perks.ejs) behind HQ_PERKS: off means 404 and no rail
// item; nothing can be POSTed (a member's list stays in their browser); every row is sourced from an official https page
// with a read date, says "Up to" or states a plain figure, and carries no affiliate link; deadlines roll forward; the
// page passes the copy check. No AI.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-perks-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-perks-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'ADMIN_EMAILS', 'HQ_PERKS', 'HQ_WORKSPACE', 'HQ_PREMIUM']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const harness = require('../lib/harness');
const perks = require('../lib/perks');
const perksRoutes = require('../lib/perks-routes');
const copy = require('../lib/copy-check');
const nav = require('../lib/harness/nav');
const { plan } = require('../lib/plans');

let seq = 0;
async function member(tier = 'builder', email) {
  seq += 1;
  return db.save('users', { id: `pk${seq}`, email: email || `pk${seq}@127.test`, name: `Maya Lane${seq}`, tier, emailVerified: true, answers: { model: 'service' } });
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
  app.use(perksRoutes({ requireAuth }));
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
  process.env.HQ_PERKS = 'on';
  delete process.env.ADMIN_EMAILS;
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

test('off: the page 404s and the rail has no Perks', async () => {
  delete process.env.HQ_PERKS;
  const m = await member();
  assert.equal((await s.go('/app/hq/perks', { as: m })).status, 404);
  process.env.HQ_WORKSPACE = 'on';
  const has = () => nav.workspace(m, { flags: harness.flags.forUser(m) }).groups.some((g) => g.items.some((i) => i.id === 'perks'));
  assert.ok(!has());
  process.env.HQ_PERKS = 'on';
  assert.ok(has());
  delete process.env.HQ_WORKSPACE;
});

test('admins: only an admin with a confirmed email gets in', async () => {
  process.env.HQ_PERKS = 'admins';
  process.env.ADMIN_EMAILS = 'boss@127.test';
  const m = await member();
  const a = await member('builder', 'boss@127.test');
  assert.equal((await s.go('/app/hq/perks', { as: m })).status, 404);
  assert.equal((await s.go('/app/hq/perks', { as: a })).status, 200);
});

test('every plan sees the page, and nothing can be POSTed', async () => {
  for (const tier of ['free', 'builder', 'circle']) {
    const m = await member(tier);
    assert.equal((await s.go('/app/hq/perks', { as: m })).status, 200, tier);
    assert.equal((await s.go('/app/hq/perks', { as: m, post: true })).status, 404, tier);
  }
});

test('every program is sourced, dated and plain', () => {
  const ids = new Set();
  const shelves = new Set(perks.SHELVES.map((x) => x[0]));
  const fits = new Set(perks.FITS.map((x) => x[0]).concat('any'));
  for (const p of perks.PROGRAMS) {
    assert.ok(!ids.has(p.id), `${p.id} twice`); ids.add(p.id);
    assert.ok(shelves.has(p.shelf), p.id);
    assert.match(p.url, /^https:\/\/[^/?#]+\.[a-z]+\//, `${p.id}: official https page`);
    if (p.source) assert.match(p.source, /^https:\/\//, p.id);
    assert.doesNotMatch(p.url, /[?&](ref|via|aff|affiliate|utm_[a-z]+|partner|referral)=/i, `${p.id}: no affiliate or tracking link`);
    assert.match(p.checked, /^\d{4}-\d{2}-\d{2}$/, p.id);
    assert.ok(p.fits.length && p.fits.every((f) => fits.has(f)), p.id);
    assert.ok(Array.isArray(p.who) && p.who.length, p.id);
    if (p.amount) assert.match(p.amount, /^(Up to |Free|\$|\d)/, `${p.id}: an amount is a ceiling or a stated figure`);
    else assert.ok(p.amountNote, `${p.id}: no figure, so the row says why`);
    assert.ok(['rolling', 'date', 'monthly', 'quarterly', 'closed'].includes(p.deadline.kind), p.id);
  }
});

test('deadlines roll forward and stale rows drop off Closing soon', () => {
  const amber = perks.PROGRAMS.find((p) => p.id === 'amber');
  assert.equal(perks.nextDeadline(amber, new Date('2026-10-21T15:00:00Z')), '2026-10-31');
  assert.equal(perks.nextDeadline(amber, new Date('2026-11-02T15:00:00Z')), '2026-11-30');
  const nase = perks.PROGRAMS.find((p) => p.id === 'nase');
  assert.equal(perks.nextDeadline(nase, new Date('2026-10-21T15:00:00Z')), '2026-12-31');
  const tb = perks.PROGRAMS.find((p) => p.id === 'tory-burch');
  assert.equal(perks.nextDeadline(tb, new Date('2026-11-18T00:00:00Z')), null, 'a past date is gone, not shown as open');
  const soonNow = perks.soon(new Date('2026-10-21T15:00:00Z')).map((p) => p.id);
  assert.deepEqual(soonNow.slice(0, 2), ['amber', 'tory-burch']);
  assert.deepEqual(perks.soon(new Date('2027-03-01T15:00:00Z')), [], `rows read more than ${perks.STALE_DAYS} days ago are not shown as dates`);
});

test('the page: honest lines, official links only, the member list scoped, copy check clean', async () => {
  const m = await member();
  const page = await (await s.go('/app/hq/perks', { as: m })).text();
  assert.ok(page.includes('Amounts are the most a program offers'));
  assert.ok(page.includes('No link on this page is an affiliate link'));
  assert.ok(page.includes('SBA does not provide grants for starting and expanding a business.'));
  assert.ok(page.includes(`data-scope="${perks.scope(m.id)}"`));
  assert.ok(!page.includes(`"${m.id}"`), 'the member id itself is not on the page');
  assert.equal((page.match(/class="pk-row"/g) || []).length, perks.PROGRAMS.length);
  for (const [, href] of page.matchAll(/class="pk-go" href="([^"]+)"/g)) assert.ok(perks.PROGRAMS.some((p) => p.url === href), href);
  assert.equal((page.match(/rel="noopener noreferrer" target="_blank"/g) || []).length, perks.PROGRAMS.length + 1);
  const text = page.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  const found = copy.check(text, { file: 'perks.ejs' }).filter((f) => f.severity === 'block');
  assert.deepEqual(found, []);
  const data = copy.check(JSON.stringify(perks.PROGRAMS), { file: 'lib/perks' }).filter((f) => f.severity === 'block');
  assert.deepEqual(data, []);
});
