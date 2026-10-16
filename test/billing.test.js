// Billing logic against a fake Stripe client: checkout parameters, plan switches,
// webhooks (signatures, de-duplication, out-of-order events, failed payments).
// Run with: npm test   (no network or Stripe account needed)

process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.FOUNDING_CLOSES_AT = new Date(Date.now() + 7 * 864e5).toISOString();
process.env.BASE_URL = 'https://127.test';
process.env.FOUNDING_PRICE = '19';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const dataFile = path.join(__dirname, '..', 'data', 'db.json');
const backup = fs.existsSync(dataFile) ? fs.readFileSync(dataFile) : null;

const db = require('../lib/db');
const billing = require('../lib/billing');
const integrations = require('../lib/integrations');
const { PLANS } = require('../lib/plans');

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
      createBalanceTransaction: async (id, a, o) => (log('customers.balance', { id, a, o }), { id: 'cbtxn_1' }),
    },
    invoices: { createPreview: async (a) => (log('invoices.preview', a), { amount_due: 25000, currency: 'usd' }) },
    checkout: {
      sessions: {
        create: async (a) => (log('checkout.create', a), { id: 'cs_test_new', url: 'https://checkout.stripe.test/s' }),
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
        if (a.items) subs[id].items.data[0].price = byId[a.items[0].price];
        if ('cancel_at_period_end' in a) subs[id].cancel_at_period_end = a.cancel_at_period_end;
        if ('cancel_at' in a) subs[id].cancel_at = a.cancel_at || null;
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
  assert.strictEqual(a.allow_promotion_codes, false);
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

test('founding numbers: one per member, never reused after a cancel', async () => {
  const launch = require('../lib/launch');
  const before = launch.foundingSubscribers();
  s.sub('sub_n1', 'price_f', 'active', { customer: 'cus_n1' + user.id });
  user.foundingNumber = undefined;
  await deliver({ id: 'evt_n1' + user.id, type: 'checkout.session.completed', data: { object: { client_reference_id: user.id, payment_status: 'paid', subscription: 'sub_n1', customer: 'cus_n1' + user.id, metadata: {} } } });
  await deliver({ id: 'evt_n2' + user.id, type: 'customer.subscription.updated', data: { object: s.subs.sub_n1 } });
  const n = user.foundingNumber;
  assert.ok(n >= 1);
  assert.strictEqual(launch.foundingSubscribers(), before + 1);
  await deliver({ id: 'evt_n3' + user.id, type: 'customer.subscription.deleted', data: { object: { ...s.subs.sub_n1, status: 'canceled' } } });
  assert.strictEqual(user.tier, 'free');
  assert.strictEqual(user.foundingNumber, n);
  assert.strictEqual(launch.foundingSubscribers(), before + 1);
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

// ---------- founding offer, checkout copy, Klaviyo billing events ----------

const events = (type, id) => db.filter('events', (e) => e.type === type && e.payload.userId === id);

test('checkout: renewal wording at the pay button, no Terms box until STRIPE_TERMS_CONSENT=true', async () => {
  await billing.checkoutUrl(req, user, 'builder');
  let a = s.calls.find((c) => c.name === 'checkout.create').args;
  assert.ok(!('consent_collection' in a));
  assert.ok(!a.custom_text.terms_of_service_acceptance);
  assert.match(a.custom_text.submit.message, /^Founding price, locked while you stay\. Renews monthly at \$19 \+ tax until you cancel\./);
  assert.match(a.custom_text.submit.message, /14 days to change your mind/);
  assert.strictEqual(a.success_url, 'https://127.test/app/welcome?founding=1&session_id={CHECKOUT_SESSION_ID}');
  assert.strictEqual(a.cancel_url, 'https://127.test/app/billing?checkout=cancelled');
  assert.strictEqual(a.metadata.terms_version, billing.TERMS_VERSION);

  process.env.STRIPE_TERMS_CONSENT = 'true';
  s.calls.length = 0;
  await billing.checkoutUrl(req, user, 'builder', { from: '/founding/lock' });
  a = s.calls.find((c) => c.name === 'checkout.create').args;
  assert.deepStrictEqual(a.consent_collection, { terms_of_service: 'required' });
  assert.match(a.custom_text.terms_of_service_acceptance.message, /\[Membership Terms\]\(https:\/\/127\.test\/membership-terms\)/);
  assert.match(a.custom_text.terms_of_service_acceptance.message, /renews automatically every month at \$19 plus tax/);
  assert.strictEqual(a.cancel_url, 'https://127.test/founding/lock?checkout=cancelled');

  s.calls.length = 0;
  await billing.checkoutUrl(req, user, 'circle');
  a = s.calls.find((c) => c.name === 'checkout.create').args;
  delete process.env.STRIPE_TERMS_CONSENT;
  assert.match(a.custom_text.terms_of_service_acceptance.message, /Founder's Circle Member Agreement/);
  assert.match(a.custom_text.terms_of_service_acceptance.message, new RegExp(`\\$${PLANS.circle.price} plus tax`));
  assert.ok(!/14 days/.test(a.custom_text.submit.message));
  assert.strictEqual(a.allow_promotion_codes, false);
  assert.ok(a.success_url.startsWith('https://127.test/app?upgraded=circle'));
});

test('checkout: a free referral month shows $0 today and the first charge date', async () => {
  await db.save('waitlist', { email: user.email, referralCount: 3 });
  await billing.checkoutUrl(req, user, 'builder');
  const a = s.calls.find((c) => c.name === 'checkout.create').args;
  assert.match(a.custom_text.submit.message, /^\$0 today\. Then \$19 a month \+ tax starting \w+ \d+, \d{4}/);
});

test('Klaviyo "Started Checkout" when a Checkout Session is created', async () => {
  await billing.checkoutUrl(req, user, 'builder');
  const [e] = events('checkout.started', user.id);
  assert.ok(e, 'event emitted');
  assert.strictEqual(e.payload.plan, 'builder');
  assert.strictEqual(e.payload.founding, true);
  assert.strictEqual(e.payload.price, 19);
  // The abandoned-checkout email lands after the 30-minute session expired, so the link reopens checkout in the app.
  assert.strictEqual(e.payload.checkout_url, 'https://127.test/founding/lock');
  assert.strictEqual(e.payload.stripe_checkout_url, 'https://checkout.stripe.test/s');
  const [metric, props] = integrations.metricFor('checkout.started', e.payload);
  assert.strictEqual(metric, 'Started Checkout');
  assert.deepStrictEqual([props.plan, props.founding, props.price, props.checkout_url], ['builder', true, 19, 'https://127.test/founding/lock']);
});

test('Started Checkout: plan is "builder" or "circle" only; a founding Builder stays "builder" with founding true', async () => {
  await billing.checkoutUrl(req, user, 'circle');
  const e = events('checkout.started', user.id).find((x) => x.payload.plan === 'circle');
  assert.ok(e, 'circle event emitted');
  assert.strictEqual(e.payload.founding, false);
  assert.strictEqual(e.payload.checkout_url, 'https://127.test/app/circle');
  for (const x of events('checkout.started', user.id)) assert.ok(['builder', 'circle'].includes(x.payload.plan));
});

test('Klaviyo "Payment Failed" on every attempt, "Payment Recovered" only after a failure', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_pf' + user.id, stripeSubscriptionId: 'sub_pf', foundingPrice: true });
  await db.save('users', user);
  s.sub('sub_pf', 'price_f', 'past_due', { customer: user.stripeCustomerId });
  const inv = (n) => ({ id: 'in_pf', customer: user.stripeCustomerId, amount_due: 1900, currency: 'usd', attempt_count: n, hosted_invoice_url: 'https://invoice.stripe.test/pf', next_payment_attempt: 1795000000 });
  await deliver({ id: 'evt_pf1' + user.id, type: 'invoice.payment_failed', data: { object: inv(1) } });
  await deliver({ id: 'evt_pf2' + user.id, type: 'invoice.payment_failed', data: { object: inv(2) } });
  const failed = events('invoice.payment_failed', user.id);
  assert.deepStrictEqual(failed.map((e) => e.payload.attempt_count), [1, 2]);
  assert.strictEqual(failed[1].payload.hosted_invoice_url, 'https://invoice.stripe.test/pf');
  const [metric, props] = integrations.metricFor('invoice.payment_failed', failed[1].payload);
  assert.strictEqual(metric, 'Payment Failed');
  assert.strictEqual(props.attempt_count, 2);
  assert.strictEqual(props.hosted_invoice_url, 'https://invoice.stripe.test/pf');
  assert.ok(user.paymentIssue.retryAt);

  s.subs.sub_pf.status = 'active';
  const paid = { id: 'in_pf', customer: user.stripeCustomerId, amount_paid: 1900, currency: 'usd', parent: { subscription_details: { subscription: 'sub_pf' } } };
  await deliver({ id: 'evt_pf3' + user.id, type: 'invoice.paid', data: { object: paid } });
  assert.strictEqual(events('payment.recovered', user.id).length, 1);
  assert.strictEqual(integrations.metricFor('payment.recovered', events('payment.recovered', user.id)[0].payload)[0], 'Payment Recovered');
  // A normal renewal (no failure before it) is not a recovery.
  await deliver({ id: 'evt_pf4' + user.id, type: 'invoice.paid', data: { object: { ...paid, id: 'in_pf2' } } });
  assert.strictEqual(events('payment.recovered', user.id).length, 1);
});

test('Klaviyo "Card Expiring" from customer.source.expiring; HANDLED matches stripe-setup EVENTS', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_ce' + user.id, stripeSubscriptionId: 'sub_ce' });
  await db.save('users', user);
  const card = { id: 'card_1', object: 'card', customer: user.stripeCustomerId, brand: 'Visa', last4: '4242', exp_month: 10, exp_year: 2026 };
  const r = await deliver({ id: 'evt_ce' + user.id, type: 'customer.source.expiring', data: { object: card } });
  assert.strictEqual(r.code, 200);
  const [e] = events('card.expiring', user.id);
  assert.ok(e, 'event emitted');
  assert.deepStrictEqual([e.payload.last4, e.payload.exp_month, e.payload.exp_year], ['4242', 10, 2026]);
  assert.strictEqual(integrations.metricFor('card.expiring', e.payload)[0], 'Card Expiring');

  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'stripe-setup.js'), 'utf8');
  const list = src.match(/const EVENTS = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
  assert.deepStrictEqual([...list].sort(), [...billing.HANDLED].sort());
});

test('founding payment assigns the founding number and badge; consent is recorded', async () => {
  s.sub('sub_fn', 'price_f', 'active', { customer: 'cus_fn' + user.id });
  const cs = { id: 'cs_fn', client_reference_id: user.id, payment_status: 'paid', subscription: 'sub_fn', customer: 'cus_fn' + user.id, consent: { terms_of_service: 'accepted' }, metadata: { terms_version: 'v-test' } };
  await deliver({ id: 'evt_fn' + user.id, type: 'checkout.session.completed', data: { object: cs } });
  const n = user.foundingNumber;
  assert.ok(n >= 1);
  assert.ok(user.badges.includes('founding'));
  assert.deepStrictEqual([user.checkoutConsent.version, user.checkoutConsent.terms_of_service], ['v-test', 'accepted']);
  const c = user.consents.slice(-1)[0];
  assert.deepStrictEqual([c.session, c.terms_of_service, c.terms_version], ['cs_fn', 'accepted', 'v-test']);
  // A second founding subscription later keeps the same number.
  await deliver({ id: 'evt_fn2' + user.id, type: 'customer.subscription.updated', data: { object: s.subs.sub_fn } });
  assert.strictEqual(user.foundingNumber, n);
});

test('founding price survives a plan switch, and ends when the membership does', async () => {
  Object.assign(user, { tier: 'circle', stripeCustomerId: 'cus_sw' + user.id, stripeSubscriptionId: 'sub_sw', foundingNumber: 999, foundingPrice: false });
  await db.save('users', user);
  s.sub('sub_sw', 'price_c', 'active', { customer: user.stripeCustomerId });
  const saved = process.env.FOUNDING_CLOSES_AT;
  process.env.FOUNDING_CLOSES_AT = new Date(Date.now() - 864e5).toISOString(); // window closed
  try {
    await billing.checkoutUrl(req, user, 'builder');
    assert.strictEqual(s.calls.find((c) => c.name === 'subs.update').args.a.items[0].price, 'price_f');
    assert.strictEqual(user.foundingPrice, true);
    await deliver({ id: 'evt_sw' + user.id, type: 'customer.subscription.deleted', data: { object: { ...s.subs.sub_sw, status: 'canceled' } } });
    assert.strictEqual(user.foundingEnded, true);
    assert.strictEqual(billing.foundingKept(user), false);
  } finally {
    process.env.FOUNDING_CLOSES_AT = saved;
  }
});

test('cancel: one call sets cancel at period end; Keep undoes it', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_cx' });
  await db.save('users', user);
  s.sub('sub_cx', 'price_b', 'active', { items: { data: [{ id: 'si_cx', price: byId.price_b, current_period_end: 1795000000 }] } });
  const ends = await billing.cancelAtPeriodEnd(user);
  assert.deepStrictEqual(s.calls.find((c) => c.name === 'subs.update').args.a, { cancel_at_period_end: true });
  assert.strictEqual(ends, new Date(1795000000 * 1000).toISOString());
  assert.strictEqual(user.tier, 'builder');
  assert.ok(await billing.resumeSubscription(user));
  assert.deepStrictEqual(s.calls.filter((c) => c.name === 'subs.update')[1].args.a, { cancel_at_period_end: false });
  assert.strictEqual(user.cancelAt, null);
});

test('Circle upgrade preview shows the amount due today', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_pv' });
  await db.save('users', user);
  s.sub('sub_pv', 'price_b');
  assert.deepStrictEqual(await billing.previewUpgrade(user, 'circle'), { dueToday: 250, currency: 'usd' });
  const a = s.calls.find((c) => c.name === 'invoices.preview').args;
  assert.strictEqual(a.subscription_details.items[0].price, 'price_c');
});

test('win-back: signed link, once per person, coupon at the regular price', async () => {
  Object.assign(user, { tier: 'free', firstPaidAt: new Date().toISOString(), cancellations: [{ plan: 'builder' }] });
  await db.save('users', user);
  const p = billing.winbackProfile(user);
  assert.strictEqual(p.winback_eligible, true);
  const t = new URL(p.winback_url).searchParams.get('t');
  assert.ok(billing.verifyWinback(user.id, t));
  assert.ok(!billing.verifyWinback('someone-else', t));
  await billing.checkoutUrl(req, user, 'builder', { winback: true });
  const a = s.calls.find((c) => c.name === 'checkout.create').args;
  assert.deepStrictEqual(a.discounts, [{ coupon: 'winback-first-month' }]);
  assert.deepStrictEqual(a.line_items, [{ price: 'price_b', quantity: 1 }]);
  assert.strictEqual(a.metadata.winback, '1');
  user.refundedFirstPayment = true;
  assert.strictEqual(billing.winbackProfile(user).winback_eligible, false);
});

test('grace link: founding price after the close for that one email, spent once paid', async () => {
  const saved = process.env.FOUNDING_CLOSES_AT;
  process.env.FOUNDING_CLOSES_AT = new Date(Date.now() - 3600e3).toISOString(); // closed an hour ago
  try {
    const token = billing.graceToken(user.email);
    assert.ok(billing.verifyGrace(token));
    assert.strictEqual(billing.verifyGrace(token.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), null);
    await billing.checkoutUrl(req, user, 'builder', { grace: token });
    const a = s.calls.find((c) => c.name === 'checkout.create').args;
    assert.deepStrictEqual(a.line_items, [{ price: 'price_f', quantity: 1 }]);
    assert.strictEqual(a.metadata.grace, '1');
    s.sub('sub_gr', 'price_f');
    await deliver({ id: 'evt_gr' + user.id, type: 'checkout.session.completed', data: { object: { id: 'cs_gr', client_reference_id: user.id, payment_status: 'paid', subscription: 'sub_gr', customer: 'cus_1', metadata: a.metadata } } });
    assert.ok(user.graceUsedAt);
    assert.strictEqual(billing.verifyGrace(token), null);
  } finally {
    process.env.FOUNDING_CLOSES_AT = saved;
  }
});

test('referral reward for a referrer who already pays: one month as account credit, once', async () => {
  Object.assign(user, { tier: 'builder', stripeCustomerId: 'cus_rf', foundingPrice: true });
  await db.save('users', user);
  await db.save('waitlist', { email: user.email, referralCount: 3 });
  assert.deepStrictEqual(await billing.rewardPayingReferrer(user.email), { credited: true, amount: 19 });
  const c = s.calls.find((x) => x.name === 'customers.balance').args;
  assert.deepStrictEqual([c.id, c.a.amount, c.a.currency], ['cus_rf', -1900, 'usd']);
  assert.strictEqual(c.o.idempotencyKey, `referral-credit-${user.id}`);
  assert.strictEqual((await billing.rewardPayingReferrer(user.email)).credited, false);
  assert.strictEqual(s.calls.filter((x) => x.name === 'customers.balance').length, 1);
});

test('charge.refunded: a full refund blocks the win-back month', async () => {
  Object.assign(user, { tier: 'free', stripeCustomerId: 'cus_rd' + user.id, firstPaidAt: new Date().toISOString(), cancellations: [{ plan: 'builder' }] });
  await db.save('users', user);
  assert.strictEqual(billing.winbackProfile(user).winback_eligible, true);
  const r = await deliver({ id: 'evt_rd' + user.id, type: 'charge.refunded', data: { object: { id: 'ch_rd', object: 'charge', customer: user.stripeCustomerId, refunded: true, amount_refunded: 1900, refunds: { data: [{ id: 're_rd' }] } } } });
  assert.strictEqual(r.code, 200);
  assert.strictEqual(user.refundedFirstPayment, true);
  assert.strictEqual(billing.winbackProfile(user).winback_eligible, false);
});

test('referral reward is a flat $19 credit, Circle members included (Legal L32)', async () => {
  Object.assign(user, { tier: 'circle', stripeCustomerId: 'cus_rc' });
  await db.save('users', user);
  await db.save('waitlist', { email: user.email, referralCount: 3 });
  assert.deepStrictEqual(await billing.rewardPayingReferrer(user.email), { credited: true, amount: 19 });
  assert.strictEqual(s.calls.find((x) => x.name === 'customers.balance').args.a.amount, -1900);
});

test('no founding price for someone whose founding membership ended, even inside the window (Legal L31)', async () => {
  Object.assign(user, { foundingNumber: 7, foundingEnded: true });
  await db.save('users', user);
  await billing.checkoutUrl(req, user, 'builder');
  assert.deepStrictEqual(s.calls.find((c) => c.name === 'checkout.create').args.line_items, [{ price: 'price_b', quantity: 1 }]);
});
