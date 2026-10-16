// Billing logic against a fake Stripe client: checkout parameters, plan switches,
// webhooks (signatures, de-duplication, out-of-order events, failed payments).
// Run with: npm test   (no network or Stripe account needed)

process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.FOUNDING_CLOSES_AT = new Date(Date.now() + 7 * 864e5).toISOString();
process.env.BASE_URL = 'https://127.test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const dataFile = path.join(__dirname, '..', 'data', 'db.json');
const backup = fs.existsSync(dataFile) ? fs.readFileSync(dataFile) : null;

const db = require('../lib/db');
const billing = require('../lib/billing');

const PRICES = {
  builder_monthly: { id: 'price_b', lookup_key: 'builder_monthly' },
  builder_founding_monthly: { id: 'price_f', lookup_key: 'builder_founding_monthly' },
  circle_monthly: { id: 'price_c', lookup_key: 'circle_monthly' },
};
const byId = Object.fromEntries(Object.values(PRICES).map((p) => [p.id, p]));

function fakeStripe() {
  const real = new Stripe('sk_test_fake');
  const calls = [];
  const subs = {};
  const log = (name, args) => calls.push({ name, args });
  const sub = (id, priceId, status = 'active', extra = {}) =>
    (subs[id] = { id, object: 'subscription', status, customer: 'cus_1', metadata: {}, items: { data: [{ id: 'si_' + id, price: byId[priceId] }] }, ...extra });
  return {
    calls, subs, sub,
    webhooks: real.webhooks,
    prices: { list: async (a) => (log('prices.list', a), { data: a.lookup_keys.map((k) => PRICES[k]).filter(Boolean) }) },
    customers: {
      retrieve: async (id) => (log('customers.retrieve', id), { id }),
      create: async (a, o) => (log('customers.create', { a, o }), { id: 'cus_1' }),
    },
    checkout: {
      sessions: {
        create: async (a) => (log('checkout.create', a), { url: 'https://checkout.stripe.test/s' }),
        retrieve: async (id) => (log('checkout.retrieve', id), fakeStripe.session),
      },
    },
    subscriptions: {
      retrieve: async (id) => (log('subs.retrieve', id), subs[id]),
      update: async (id, a) => {
        log('subs.update', { id, a });
        if (fakeStripe.declineUpgrade && a.payment_behavior === 'pending_if_incomplete') {
          return { ...subs[id], pending_update: { expires_at: 1 }, latest_invoice: { hosted_invoice_url: 'https://invoice.stripe.test/i' } };
        }
        subs[id].items.data[0].price = byId[a.items[0].price];
        return subs[id];
      },
      cancel: async (id) => (log('subs.cancel', id), { id, status: 'canceled' }),
    },
  };
}

function signed(event) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return { body: Buffer.from(payload), headers: { 'stripe-signature': header } };
}
function res() {
  const r = { code: 200, body: null };
  r.status = (c) => ((r.code = c), r);
  r.send = (b) => ((r.body = b), r);
  r.json = (b) => ((r.body = b), r);
  return r;
}
async function deliver(event) {
  const r = res();
  await billing.webhook(signed(event), r);
  return r;
}
const req = { protocol: 'https', get: () => '127.test' };

let user, s;
test.before(async () => {
  await db.init();
});
test.after(() => {
  if (backup) fs.writeFileSync(dataFile, backup);
  else fs.rmSync(dataFile, { force: true });
});
test.beforeEach(async () => {
  s = fakeStripe();
  fakeStripe.declineUpgrade = false;
  billing._setClient(s);
  user = await db.save('users', { email: `m${Date.now()}${Math.random()}@x.test`, tier: 'free', createdAt: new Date().toISOString() });
});

test('checkout: founding member gets the founding price, a customer, tax-ready params', async () => {
  process.env.STRIPE_AUTOMATIC_TAX = 'true';
  const url = await billing.checkoutUrl(req, user, 'builder');
  delete process.env.STRIPE_AUTOMATIC_TAX;
  assert.strictEqual(url, 'https://checkout.stripe.test/s');
  const a = s.calls.find((c) => c.name === 'checkout.create').args;
  assert.deepStrictEqual(a.line_items, [{ price: 'price_f', quantity: 1 }]);
  assert.strictEqual(a.customer, 'cus_1');
  assert.strictEqual(a.mode, 'subscription');
  assert.ok(!('payment_method_types' in a));
  assert.deepStrictEqual(a.automatic_tax, { enabled: true });
  assert.ok(a.integration_identifier);
  assert.ok(a.success_url.includes('{CHECKOUT_SESSION_ID}'));
  assert.strictEqual(a.allow_promotion_codes, true);
});

test('checkout: no tax params unless STRIPE_AUTOMATIC_TAX=true', async () => {
  await billing.checkoutUrl(req, user, 'circle');
  const a = s.calls.find((c) => c.name === 'checkout.create').args;
  assert.ok(!('automatic_tax' in a));
  assert.deepStrictEqual(a.line_items, [{ price: 'price_c', quantity: 1 }]);
});

test('checkout: referral reward applies the coupon instead of the promo box', async () => {
  await db.save('waitlist', { email: user.email, referralCount: 3 });
  await billing.checkoutUrl(req, user, 'builder');
  const a = s.calls.find((c) => c.name === 'checkout.create').args;
  assert.deepStrictEqual(a.discounts, [{ coupon: 'founding-referral' }]);
  assert.ok(!a.allow_promotion_codes);
});

test('webhook: rejects a bad signature', async () => {
  const r = res();
  await billing.webhook({ body: Buffer.from('{}'), headers: { 'stripe-signature': 't=1,v1=bad' } }, r);
  assert.strictEqual(r.code, 400);
});

test('webhook: paid checkout unlocks Builder once, duplicates are ignored', async () => {
  s.sub('sub_1', 'price_f');
  const ev = { id: 'evt_' + user.id, type: 'checkout.session.completed', data: { object: { client_reference_id: user.id, payment_status: 'paid', subscription: 'sub_1', customer: 'cus_1', metadata: {} } } };
  assert.strictEqual((await deliver(ev)).code, 200);
  assert.strictEqual(user.tier, 'builder');
  assert.strictEqual(user.foundingPrice, true);
  assert.strictEqual(user.stripeSubscriptionId, 'sub_1');
  const again = await deliver(ev);
  assert.strictEqual(again.body.duplicate, true);
});

test('webhook: unpaid (async) checkout does not unlock until async_payment_succeeded', async () => {
  s.sub('sub_2', 'price_b');
  const obj = { client_reference_id: user.id, payment_status: 'unpaid', subscription: 'sub_2', customer: 'cus_1', metadata: {} };
  await deliver({ id: 'evt_a' + user.id, type: 'checkout.session.completed', data: { object: obj } });
  assert.strictEqual(user.tier, 'free');
  await deliver({ id: 'evt_b' + user.id, type: 'checkout.session.async_payment_succeeded', data: { object: { ...obj, payment_status: 'paid' } } });
  assert.strictEqual(user.tier, 'builder');
  assert.strictEqual(user.foundingPrice, false);
});

test('webhook: stale subscription.updated payload is re-read from Stripe', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_3' + user.id, stripeSubscriptionId: 'sub_3' });
  await db.save('users', user);
  s.sub('sub_3', 'price_c', 'active', { customer: user.stripeCustomerId });
  const stale = { id: 'sub_3', customer: user.stripeCustomerId, status: 'active', metadata: {}, items: { data: [{ price: byId.price_b }] } };
  await deliver({ id: 'evt_c' + user.id, type: 'customer.subscription.updated', data: { object: stale } });
  assert.strictEqual(user.tier, 'circle');
});

test('webhook: payment failure flags the member, invoice.paid clears it, deletion drops to Free', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_9' + user.id, stripeSubscriptionId: 'sub_4', foundingPrice: true });
  await db.save('users', user);
  s.sub('sub_4', 'price_f', 'past_due', { customer: user.stripeCustomerId });
  await deliver({ id: 'evt_d' + user.id, type: 'invoice.payment_failed', data: { object: { id: 'in_1', customer: user.stripeCustomerId, amount_due: 1900, currency: 'usd', attempt_count: 1, hosted_invoice_url: 'https://i' } } });
  assert.ok(user.paymentIssue);
  assert.strictEqual(user.tier, 'builder');
  s.subs.sub_4.status = 'active';
  await deliver({ id: 'evt_e' + user.id, type: 'invoice.paid', data: { object: { id: 'in_1', customer: user.stripeCustomerId, amount_paid: 1900, currency: 'usd', parent: { subscription_details: { subscription: 'sub_4' } } } } });
  assert.strictEqual(user.paymentIssue, null);
  await deliver({ id: 'evt_f' + user.id, type: 'customer.subscription.deleted', data: { object: { ...s.subs.sub_4, status: 'canceled' } } });
  assert.strictEqual(user.tier, 'free');
  assert.strictEqual(user.foundingPrice, false);
  assert.strictEqual(user.stripeSubscriptionId, null);
});

test('upgrade: charged now and only unlocked when paid; a declined card goes to the invoice page', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_5' });
  await db.save('users', user);
  s.sub('sub_5', 'price_b');
  fakeStripe.declineUpgrade = true;
  const url = await billing.checkoutUrl(req, user, 'circle');
  assert.strictEqual(url, 'https://invoice.stripe.test/i');
  assert.strictEqual(user.tier, 'builder');
  const u = s.calls.find((c) => c.name === 'subs.update').args.a;
  assert.strictEqual(u.proration_behavior, 'always_invoice');
  assert.strictEqual(u.payment_behavior, 'pending_if_incomplete');
  fakeStripe.declineUpgrade = false;
  assert.strictEqual(await billing.checkoutUrl(req, user, 'circle'), '/app?upgraded=circle');
  assert.strictEqual(user.tier, 'circle');
});

test('success page confirms the session for the right member only', async () => {
  s.sub('sub_6', 'price_b');
  fakeStripe.session = { client_reference_id: 'someone-else', payment_status: 'paid', subscription: 'sub_6', metadata: {} };
  await billing.confirmCheckout(user, 'cs_test_1');
  assert.strictEqual(user.tier, 'free');
  fakeStripe.session = { ...fakeStripe.session, client_reference_id: user.id };
  await billing.confirmCheckout(user, 'cs_test_1');
  assert.strictEqual(user.tier, 'builder');
});
