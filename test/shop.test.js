// Packs (lib/shop.js, content/shop/packs.json): the catalog resolves, the built kits are current, who owns what,
// one-time Checkout against a fake Stripe client, the webhook and success page recording a purchase once, refunds,
// and which files a buyer can reach. No network or Stripe account needed.

const path = require('path');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-shop-${process.pid}.json`);
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.BASE_URL = 'https://127.test';
process.env.SITE_MOTION = 'on';
for (const k of ['SHOP_PACKS', 'ADMIN_EMAILS', 'STRIPE_AUTOMATIC_TAX', 'DEMO_BILLING']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');

const db = require('../lib/db');
const billing = require('../lib/billing');
const shop = require('../lib/shop');
const { check } = require('../lib/copy-check');

const calls = [];
let session = null;
const fake = {
  webhooks: new Stripe('sk_test_fake').webhooks,
  prices: { list: async (a) => (calls.push(['prices.list', a]), { data: [{ id: `price_${a.lookup_keys[0]}` }] }) },
  checkout: {
    sessions: {
      create: async (a) => (calls.push(['checkout.create', a]), { id: 'cs_test_pack', url: 'https://checkout.stripe.test/p' }),
      retrieve: async () => session,
    },
  },
  subscriptions: { retrieve: async () => { throw new Error('a pack session never reads a subscription'); } },
};

function paidSession(over = {}) {
  return {
    id: 'cs_test_pack', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 4900, currency: 'usd',
    customer_details: { email: 'Buyer@Example.com' }, client_reference_id: null, payment_intent: 'pi_pack_1',
    metadata: { kind: 'pack', pack: 'motion', userId: '' }, ...over,
  };
}
async function hook(type, object) {
  const event = { id: `evt_${type}_${object.id}_${Math.random()}`, type, data: { object } };
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const res = { code: 200, status(c) { this.code = c; return this; }, send() { return this; }, json() { return this; } };
  await billing.webhook({ body: Buffer.from(payload), headers: { 'stripe-signature': header } }, res);
  return res.code;
}
let n = 0;
const member = (tier = 'free', extra = {}) => db.save('users', { id: `shop${++n}`, email: `s${n}@127.test`, tier, emailVerified: true, ...extra });

test.before(async () => {
  await db.init();
  billing._setClient(fake);
  shop._reset();
});
test.after(() => {
  for (const f of [process.env.DB_FILE]) if (fs.existsSync(f)) fs.rmSync(f);
});

test('catalog: every pack resolves, paid packs have a lookup key and a one-time price', () => {
  const c = shop.catalog();
  assert.deepEqual(c.problems, []);
  const paid = shop.paid();
  assert.ok(paid.length >= 6);
  for (const p of [...paid, c.bundle]) {
    assert.match(p.lookupKey, /^pack_[a-z]+$/);
    assert.ok(p.price >= 19 && p.price <= 199, `${p.slug} price`);
  }
  assert.equal(shop.list().filter((p) => p.free).length, 1, 'one free pack: the Starter');
  assert.equal(shop.get('build-with-ai'), null, 'planned packs are not for sale');
});

test('the built kits are current', () => {
  assert.deepEqual(require('../scripts/build-motion-pack').build({ check: true }).stale, []);
  assert.deepEqual(require('../scripts/build-ai-pack').build({ check: true }).stale, []);
});

test('pack copy passes the copy check as paid-plan copy', () => {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'content', 'shop', 'packs.json'), 'utf8');
  const blocks = check(raw, { file: 'packs.json', paid: true }).filter((f) => f.severity === 'block');
  assert.deepEqual(blocks, []);
  assert.doesNotMatch(raw, /First 25|next 25|lead lists?/i, 'no lead lists in a paid pack (L62)');
});

test('switch: off hides packs, admins shows them to admins only, on shows everyone', () => {
  assert.equal(shop.visibleTo(null), false);
  process.env.SHOP_PACKS = 'admins';
  process.env.ADMIN_EMAILS = 'eli@127.test';
  assert.equal(shop.visibleTo(null), false);
  assert.equal(shop.visibleTo({ email: 'eli@127.test', emailVerified: true }), true);
  process.env.SHOP_PACKS = 'on';
  assert.equal(shop.visibleTo(null), true);
  delete process.env.SHOP_PACKS;
  delete process.env.ADMIN_EMAILS;
});

test('ownership: Starter needs an account, Builder owns every pack, Free owns none of the paid ones', async () => {
  const free = await member('free');
  const builder = await member('builder');
  assert.equal(shop.owns(null, 'starter'), false);
  assert.equal(shop.owns(free, 'starter'), true);
  assert.equal(shop.owns(free, 'motion'), false);
  for (const p of shop.paid()) assert.equal(shop.owns(builder, p.slug), true, p.slug);
  assert.equal(shop.owns(builder, 'all'), true);
});

test('checkout: one-time payment, guest allowed, tagged as a pack, never a subscription', async () => {
  calls.length = 0;
  const url = await shop.checkoutUrl({}, null, 'motion', { from: '/#packs' });
  assert.equal(url, 'https://checkout.stripe.test/p');
  const a = calls.find((c) => c[0] === 'checkout.create')[1];
  assert.equal(a.mode, 'payment');
  assert.deepEqual(a.line_items, [{ price: 'price_pack_motion', quantity: 1 }]);
  assert.equal(a.customer_creation, 'always');
  assert.equal(a.metadata.kind, 'pack');
  assert.equal(a.metadata.pack, 'motion');
  assert.equal(a.allow_promotion_codes, false);
  assert.equal(a.subscription_data, undefined);
  assert.match(a.success_url, /^https:\/\/127\.test\/packs\/motion\/thanks\?session_id=\{CHECKOUT_SESSION_ID\}$/);
  assert.equal(a.cancel_url, 'https://127.test/#packs?checkout=cancelled'.replace('/#packs?', '/#packs?'));
  const signedIn = await member('free');
  calls.length = 0;
  await shop.checkoutUrl({}, signedIn, 'numbers');
  const b = calls.find((c) => c[0] === 'checkout.create')[1];
  assert.equal(b.customer_email, signedIn.email);
  assert.equal(b.client_reference_id, signedIn.id);
  // The free pack and an owned pack never reach Stripe.
  await assert.rejects(shop.checkoutUrl({}, null, 'starter'), shop.ShopUnavailable);
  const builder = await member('builder');
  assert.equal(await shop.checkoutUrl({}, builder, 'motion'), '/packs/motion/get');
});

test('webhook: a paid pack session records one purchase, leaves the plan alone, and the guest gets in with the key', async () => {
  session = paidSession();
  assert.equal(await hook('checkout.session.completed', session), 200);
  assert.equal(await hook('checkout.session.completed', session), 200);
  const all = db.filter(shop.COLLECTION, () => true);
  assert.equal(all.length, 1);
  assert.equal(all[0].email, 'buyer@example.com');
  assert.equal(all[0].amount, 49);
  // The success page confirms the same session and hands this browser its own key.
  const r = await shop.confirm('cs_test_pack');
  assert.ok(r && /^[a-f0-9]{64}$/.test(r.key));
  assert.equal(shop.owns(null, 'motion', { keys: [r.key] }), true);
  assert.equal(shop.owns(null, 'numbers', { keys: [r.key] }), false);
  assert.equal(shop.owns(null, 'motion', { keys: ['f'.repeat(64)] }), false);
  // An account with the same verified email owns it too; an unverified one doesn't.
  const same = await member('free', { email: 'buyer@example.com' });
  assert.equal(shop.owns(same, 'motion'), true);
  const unverified = await member('free', { email: 'buyer@example.com', emailVerified: false });
  assert.equal(shop.owns(unverified, 'motion'), false);
  assert.equal(same.tier, 'free');
});

test('webhook: an unpaid pack session records nothing until it is paid', async () => {
  const s = paidSession({ id: 'cs_test_slow', payment_status: 'unpaid', payment_intent: 'pi_slow' });
  await hook('checkout.session.completed', s);
  assert.equal(db.get(shop.COLLECTION, 'cs_test_slow'), null);
  await hook('checkout.session.async_payment_succeeded', { ...s, payment_status: 'paid' });
  assert.ok(db.get(shop.COLLECTION, 'cs_test_slow'));
});

test('refund: a fully refunded pack charge ends that purchase', async () => {
  const buyer = await member('free', { email: 'refund@example.com' });
  await hook('checkout.session.completed', paidSession({ id: 'cs_test_ref', customer_details: { email: 'refund@example.com' }, payment_intent: 'pi_ref', metadata: { kind: 'pack', pack: 'sales', userId: buyer.id }, client_reference_id: buyer.id }));
  assert.equal(shop.owns(buyer, 'sales'), true);
  await hook('charge.refunded', { id: 'ch_ref', object: 'charge', refunded: true, amount_refunded: 3900, payment_intent: 'pi_ref', customer: 'cus_guest' });
  assert.ok(db.get(shop.COLLECTION, 'cs_test_ref').refundedAt);
  assert.equal(shop.owns(buyer, 'sales'), false);
});

test('files: only the pack\'s own files, never a template source or another pack\'s file', () => {
  assert.ok(shop.resolveFile('motion', 'kit-motion', 'intro-stamp.html'));
  assert.ok(shop.resolveFile('motion', 'kit-motion', 'README.md'));
  assert.equal(shop.resolveFile('motion', 'kit-motion', 'manifest.json'), null);
  assert.equal(shop.resolveFile('motion', 'kit-motion', '../packs.json'), null);
  assert.equal(shop.resolveFile('motion', 'kit-ai', '01-start.md'), null);
  assert.equal(shop.resolveFile('motion', 'pricing-lab', '127-pricing-lab.xlsx'), null);
  const num = shop.get('numbers').items.find((i) => i.id === 'pricing-lab');
  const f = num.formats[0].name;
  assert.ok(shop.resolveFile('numbers', 'pricing-lab', f));
  assert.ok(shop.resolveFile('all', 'pricing-lab', f), 'the bundle reaches every paid pack');
  assert.ok(shop.resolveFile('all', 'kit-ai', '01-start.md'));
  assert.equal(shop.resolveFile('numbers', 'pricing-lab', `${f}.tpl`), null);
  assert.equal(shop.resolveFile('starter', 'kit-motion', 'fx-liquid-chrome.html'), null, 'the Starter only reaches its three moves');
});
