// The member marketplace (lib/market.js, lib/market-routes.js, views/market): the MARKETPLACE switch, who can sell,
// the creator page, demo payouts, a listing from words to files to cover, the quality checks (income claims, banned
// kinds, AI-tell words, rights box), review, the shelf, a demo sale and the buyer's files, and a real-shape Checkout
// against a fake Stripe client: the destination charge, 127's fee, the webhook recording the order once, refunds.
// No network or Stripe account needed.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-market-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-market-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
for (const k of ['MARKETPLACE', 'ADMIN_EMAILS', 'STRIPE_SECRET_KEY', 'STRIPE_AUTOMATIC_TAX', 'MARKET_FEE_PCT', 'MARKET_FEE_PCT_CIRCLE', 'REFERRALS']) delete process.env[k];
process.env.DEMO_BILLING = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Stripe = require('stripe');

const db = require('../lib/db');
const billing = require('../lib/billing');
const market = require('../lib/market');
const marketRoutes = require('../lib/market-routes');
const { plan } = require('../lib/plans');
const { check } = require('../lib/copy-check');

let seq = 0;
const member = (tier = 'builder', extra = {}) => db.save('users', { id: `mk${++seq}`, email: `mk${seq}@127.test`, name: `Rae Cole${seq}`, tier, emailVerified: true, ...extra });

function locals(user, req) {
  const admins = String(process.env.ADMIN_EMAILS || '').split(',');
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: !!(user && admins.includes(user.email)), path: req.path, flash: null,
    builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
    launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: true, checkoutCancelled: false,
    fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null,
    hqLive: false, marketOn: market.visibleTo(user), referralsOn: false, first25Live: false, legalEffectiveDate: '', consentCopy: {},
  };
}

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    req.session = req.session || {};
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    Object.assign(res.locals, locals(req.user, req));
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const requireAdmin = (req, res, next) => (res.locals.isAdmin ? next() : res.status(404).send('app 404'));
  app.use(marketRoutes({ requireAuth, requireAdmin, flash: () => {}, track: () => {} }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, raw, type, name } = {}) => {
    const h = {};
    if (as) h['x-user'] = as.id;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    if (raw) { body = raw; h['content-type'] = type || 'application/octet-stream'; if (name) h['x-file-name'] = encodeURIComponent(name); }
    return fetch(url + p, { method: body !== undefined ? 'POST' : 'GET', headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex');
const GOOD = {
  title: 'Gym intro-offer emails',
  kind: 'template',
  price: '29',
  line: 'Five emails that follow up after a free class.',
  about: 'I wrote these for my own gym in Tulsa. Each one is short, sent a day apart, and asks one question. Swap in your class times and your name, then paste them into whatever you send email with.',
  inside: '5 emails in Markdown\nA sending schedule',
  tags: 'gyms, coaches',
};

let s;
test.before(async () => {
  await db.init();
  s = await server();
});
test.after(async () => {
  await s.close();
  for (const f of [process.env.DB_FILE]) if (fs.existsSync(f)) fs.rmSync(f);
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});
test.beforeEach(() => {
  process.env.MARKETPLACE = 'on';
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.ADMIN_EMAILS;
});

test('MARKETPLACE: off is a 404 everywhere; admins shows it to admins only', async () => {
  const u = await member();
  process.env.MARKETPLACE = 'off';
  for (const p of ['/market', '/app/sell', '/makers/anyone']) assert.equal((await s.go(p, { as: u })).status, 404, p);
  process.env.MARKETPLACE = 'admins';
  assert.equal((await s.go('/market', { as: u })).status, 404);
  process.env.ADMIN_EMAILS = u.email;
  assert.equal((await s.go('/market', { as: u })).status, 200);
});

test('fees: 20% by default, 10% for a Circle seller, both settable', () => {
  assert.deepEqual(market.split(29, { tier: 'builder' }), { cents: 2900, fee: 580, net: 2320, pct: 20 });
  assert.equal(market.split(29, { tier: 'circle' }).net, 2610);
  process.env.MARKET_FEE_PCT = '15';
  assert.equal(market.split(100, { tier: 'builder' }).fee, 1500);
  delete process.env.MARKET_FEE_PCT;
});

test('a free member sees what selling is and the Builder upgrade, and cannot set up a page', async () => {
  const u = await member('free');
  const r = await s.go('/app/sell', { as: u });
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Selling comes with Builder/);
  assert.match(html, /\/app\/billing\/checkout\/builder/);
  const out = await market.saveSeller(u, { handle: 'freebie', name: 'Free Person', agree: 'on' });
  assert.ok(out.error);
});

test('creator page: handle rules, the seller terms box, no claims in the words', async () => {
  const u = await member();
  assert.match((await market.saveSeller(u, { handle: 'ab', name: 'Rae' , agree: 'on' })).error, /handle/);
  assert.match((await market.saveSeller(u, { handle: 'admin', name: 'Rae', agree: 'on' })).error, /handle/);
  assert.match((await market.saveSeller(u, { handle: 'rae-cole', name: 'Rae' })).error, /seller terms/);
  assert.match((await market.saveSeller(u, { handle: 'rae-cole', name: 'Rae', line: 'Six figures from templates.', agree: 'on' })).error, /Six figures/i);
  const ok = await market.saveSeller(u, { handle: '@Rae-Cole', name: 'Rae Cole', line: 'I run a gym in Tulsa.', agree: 'on' });
  assert.equal(ok.seller.handle, 'rae-cole');
  assert.ok(ok.seller.agreedAt);
  const other = await member();
  assert.match((await market.saveSeller(other, { handle: 'rae-cole', name: 'X Y', agree: 'on' })).error, /taken/);
});

test('the whole path: listing, files, cover, checks, review, shelf, a demo sale, the buyer files', async () => {
  const u = await member();
  const admin = await member('builder');
  await market.saveSeller(u, { handle: 'tulsa-gym', name: 'Rae Cole', line: 'I run a gym in Tulsa.', agree: 'on' });

  // Payouts in demo mode: ready straight away.
  let r = await s.go('/app/sell/payouts', { as: u });
  assert.equal(r.status, 303);
  assert.ok(market.sellerFor(u).payoutsReady);

  r = await s.go('/app/sell/new', { as: u, form: GOOD });
  assert.equal(r.status, 303);
  const id = r.headers.get('location').match(/\/app\/sell\/([0-9a-f-]+)/)[1];
  let l = market.mine(u, id);
  assert.equal(l.slug, 'gym-intro-offer-emails');
  assert.deepEqual(l.tags, ['gyms', 'coaches']);
  assert.equal(l.status, 'draft');

  // Files: text only, 2 MB each.
  r = await s.go(`/app/sell/${id}/files`, { as: u, raw: Buffer.from('# Email 1\n\nHey, thanks for coming in.'), name: 'email-1.md' });
  assert.equal(r.status, 200, await r.clone().text());
  r = await s.go(`/app/sell/${id}/files`, { as: u, raw: Buffer.from('MZ'), name: 'tool.exe' });
  assert.equal(r.status, 400);
  r = await s.go(`/app/sell/${id}/files`, { as: u, raw: Buffer.alloc(3 * 1024 * 1024, 65), name: 'big.md' });
  assert.equal(r.status, 413);

  // Not sendable without a cover; the form page lists what's missing.
  r = await s.go(`/app/sell/${id}`, { as: u });
  assert.match(await r.text(), /A cover picture/);
  assert.match((await market.submit(u, id, { rights: 'on' })).error, /cover/);
  r = await s.go(`/app/sell/${id}/cover`, { as: u, raw: PNG, type: 'image/png' });
  assert.equal(r.status, 200);
  assert.match((await market.submit(u, id, {})).error, /right to sell/);

  // The preview shows to the seller only.
  assert.equal((await s.go(`/market/${l.slug}`, { as: u })).status, 200);
  assert.equal((await s.go(`/market/${l.slug}`)).status, 404);

  const sent = await market.submit(u, id, { rights: 'on' });
  assert.equal(sent.listing.status, 'review', sent.error);
  assert.ok(sent.listing.rights.at);
  assert.equal((await s.go('/market')).status, 200);
  assert.doesNotMatch(await (await s.go('/market')).text(), /Gym intro-offer emails/);

  // Review: admins only.
  assert.equal((await s.go('/admin/market', { as: u })).status, 404);
  process.env.ADMIN_EMAILS = admin.email;
  r = await s.go('/admin/market', { as: admin });
  assert.match(await r.text(), /Gym intro-offer emails/);
  r = await s.go(`/admin/market/${id}/approve`, { as: admin, form: { note: '' } });
  assert.equal(r.status, 303);
  l = market.mine(u, id);
  assert.equal(l.status, 'live');
  assert.ok(market.onShelf(l));

  // The shelf, the listing, the maker page.
  let html = await (await s.go('/market')).text();
  assert.match(html, /Gym intro-offer emails/);
  html = await (await s.go('/market?niche=gyms')).text();
  assert.match(html, /Gym intro-offer emails/);
  html = await (await s.go('/market?kind=prompts')).text();
  assert.doesNotMatch(html, /mk-row-t">Gym/);
  html = await (await s.go(`/market/${l.slug}`)).text();
  assert.match(html, /Buy once/);
  assert.match(html, /email-1\.md/);
  assert.match(html, /\/makers\/tulsa-gym/);
  assert.match(await (await s.go('/makers/tulsa-gym')).text(), /Rae Cole/);
  assert.equal(market.forNiche('gyms')[0].slug, l.slug);
  process.env.MARKETPLACE = 'admins';
  assert.deepEqual(market.forNiche('gyms'), [], 'niche pages are public, so nothing until fully on');
  process.env.MARKETPLACE = 'on';

  // A guest buys in demo mode: the private link opens the files and the download.
  r = await s.go(`/market/${l.slug}/buy`, { form: {} });
  assert.equal(r.status, 303);
  const loc = r.headers.get('location');
  const key = loc.match(/k=([a-f0-9]{64})/)[1];
  assert.equal((await s.go(`/market/${l.slug}/get`)).status, 302, 'no key, no files');
  html = await (await s.go(`/market/${l.slug}/get?k=${key}`)).text();
  assert.match(html, /email-1\.md/);
  const fid = market.mine(u, id).files[0].id;
  r = await s.go(`/market/${l.slug}/files/${fid}?k=${key}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  assert.match(await r.text(), /thanks for coming in/);
  assert.equal(market.mine(u, id).sales, 1);
  const e = market.earnings(u.id);
  assert.equal(e.sales, 1);
  assert.equal(e.net, 23.2);

  // Editing a live listing sends it back for a look.
  await market.saveListing(u, id, { ...GOOD, price: '35' });
  assert.equal(market.mine(u, id).status, 'draft');
  assert.ok(!market.onShelf(market.mine(u, id)));
  // Buyers keep what they paid for.
  assert.equal((await s.go(`/market/${l.slug}/files/${fid}?k=${key}`)).status, 200);

  // A seller whose plan ends comes off the shelf.
  await market.review(admin, id, 'approve');
  assert.ok(market.onShelf(market.mine(u, id)));
  await db.save('users', { ...db.get('users', u.id), tier: 'free' });
  assert.ok(!market.onShelf(market.bySlug(l.slug)));
  await db.save('users', { ...db.get('users', u.id), tier: 'builder' });

  // A report puts it in front of an admin.
  r = await s.go(`/market/${l.slug}/report`, { form: { reason: 'copied', text: 'This is my own email sequence from 2024.' } });
  assert.equal(r.status, 303);
  assert.equal(market.queue().reported.length, 1);
  await market.review(admin, id, 'dismiss');
  assert.equal(market.queue().reported.length, 0);
});

test('checks: income claims block in the words and in the files; banned kinds block; AI-tell words warn', async () => {
  const u = await member();
  await market.saveSeller(u, { handle: `seller-${seq}`, name: 'Sam Ortiz', agree: 'on' });
  await market.payoutsLink(u);
  const mk = async (over) => {
    const { listing } = await market.saveListing(u, null, { ...GOOD, ...over });
    await market.addFile(u, listing.id, 'one.md', Buffer.from(over.file || '# One\n\nA plain file.'));
    await market.setCover(u, listing.id, 'image/png', PNG);
    return listing.id;
  };
  let id = await mk({ about: `${GOOD.about} Members make $5,000 a month with it.` });
  assert.match((await market.submit(u, id, { rights: 'on' })).error, /Income|promise/i);
  id = await mk({ file: '# Plan\n\nYou could make $10,000 a month by summer.' });
  assert.match((await market.submit(u, id, { rights: 'on' })).error, /one\.md/);
  id = await mk({ title: 'Verified leads list for roofers' });
  assert.match((await market.submit(u, id, { rights: 'on' })).error, /Lists of people/);
  id = await mk({ about: `${GOOD.about} It will supercharge your bookings and unlock a seamless week.` });
  const l = market.mine(u, id);
  const c = market.check(l, market.sellerFor(u));
  const voice = c.find((x) => x.id === 'voice');
  assert.equal(voice.ok, false);
  assert.equal(voice.level, 'warn');
  assert.match(voice.detail, /supercharge/);
  assert.equal((await market.submit(u, id, { rights: 'on' })).listing.status, 'review', 'a warning never blocks');
  // Prices stay inside $5 to $199.
  assert.match((await market.saveListing(u, null, { ...GOOD, price: '2' })).error, /\$5/);
  assert.match((await market.saveListing(u, null, { ...GOOD, price: '500' })).error, /\$199/);
});

test('Stripe: a destination charge with 127 fee, the webhook records the order once, a refund ends access', async () => {
  const u = await member('circle');
  await db.save('marketSellers', { id: u.id, handle: 'circle-maker', name: 'Jo Park', line: '', bio: '', status: 'active', stripeAccountId: 'acct_maker1', payoutsReady: true, agreedAt: new Date().toISOString() });
  const { listing } = await market.saveListing(u, null, { ...GOOD, title: 'Coffee cart menu boards', price: '40' });
  await market.addFile(u, listing.id, 'menu.html', Buffer.from('<h1>Menu</h1>'));
  await market.setCover(u, listing.id, 'image/png', PNG);
  await market.submit(u, listing.id, { rights: 'on' });
  await market.review({ email: 'a@127.test' }, listing.id, 'approve');

  const calls = [];
  billing._setClient({
    webhooks: new Stripe('sk_test_fake').webhooks,
    checkout: { sessions: { create: async (a) => (calls.push(a), { id: 'cs_test_mk', url: 'https://checkout.stripe.test/m' }) } },
    subscriptions: { retrieve: async () => { throw new Error('a market session never reads a subscription'); } },
  });
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  const url = await market.checkoutUrl(null, listing.slug);
  assert.equal(url, 'https://checkout.stripe.test/m');
  const a = calls[0];
  assert.equal(a.mode, 'payment');
  assert.equal(a.line_items[0].price_data.unit_amount, 4000);
  assert.equal(a.payment_intent_data.application_fee_amount, 400, 'Circle seller: 10%');
  assert.equal(a.payment_intent_data.transfer_data.destination, 'acct_maker1');
  assert.equal(a.metadata.kind, 'market');
  assert.equal(a.allow_promotion_codes, false);

  const cs = { id: 'cs_test_mk', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 4000, currency: 'usd', customer_details: { email: 'Guest@Example.com' }, payment_intent: 'pi_mk_1', metadata: { kind: 'market', listing: listing.id, fee_cents: '400' } };
  const hook = async (type, object) => {
    const payload = JSON.stringify({ id: `evt_${Math.random()}`, type, data: { object } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
    const res = { code: 200, status(c) { this.code = c; return this; }, send() { return this; }, json() { return this; } };
    await billing.webhook({ body: Buffer.from(payload), headers: { 'stripe-signature': header } }, res);
    return res.code;
  };
  assert.equal(await hook('checkout.session.completed', cs), 200);
  assert.equal(await hook('checkout.session.completed', cs), 200);
  const orders = db.filter('marketOrders', (o) => o.listingId === listing.id);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].fee, 4);
  assert.equal(orders[0].net, 36);
  assert.equal(orders[0].email, 'guest@example.com');
  const buyer = await member('free', { email: 'guest@example.com' });
  assert.ok(market.owns(buyer, market.bySlug(listing.slug)));
  assert.equal(await hook('charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: 'pi_mk_1', refunded: true, amount_refunded: 4000 }), 200);
  assert.ok(!market.owns(buyer, market.bySlug(listing.slug)));
  delete process.env.STRIPE_SECRET_KEY;
  billing._setClient(null);
});

test('every marketplace page passes the copy check', () => {
  const dir = path.join(__dirname, '..', 'views', 'market');
  for (const f of fs.readdirSync(dir)) {
    const found = check(fs.readFileSync(path.join(dir, f), 'utf8'), { file: f }).filter((x) => x.severity === 'block');
    assert.deepEqual(found, [], f);
  }
});
