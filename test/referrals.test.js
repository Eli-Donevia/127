// Member referrals (lib/referrals.js, views/market/invite.ejs): one code per person (the founding list's when there is
// one), the REFERRALS switch, a friend's first paid invoice starting the 14-day wait, refunds, ambassadors and
// self-referrals not counting, the sweep crediting a paying member (capped at the friend's price) or banking a month for
// a free one, the 12-a-year cap, and a banked month taking the referral coupon at a Builder checkout. Fake Stripe only.

const path = require('path');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-referrals-${process.pid}.json`);
process.env.BASE_URL = 'https://127.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.FOUNDING_PRICE = '19';
for (const k of ['REFERRALS', 'REFERRALS_PAID_FROM', 'LAUNCH_AT', 'FOUNDING_CLOSES_AT', 'ADMIN_EMAILS', 'DEMO_BILLING', 'MARKETPLACE']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');

const db = require('../lib/db');
const billing = require('../lib/billing');
const referrals = require('../lib/referrals');

const DAY = 864e5;
const calls = [];
const fake = {
  webhooks: new Stripe('sk_test_fake').webhooks,
  prices: { list: async (a) => ({ data: a.lookup_keys.map((k) => ({ id: `price_${k}`, lookup_key: k })) }) },
  customers: {
    create: async () => ({ id: 'cus_new' }),
    retrieve: async (id) => ({ id }),
    createBalanceTransaction: async (id, a, o) => (calls.push(['balance', id, a, o]), { id: `cbtxn_${calls.length}` }),
  },
  subscriptions: { list: async () => ({ data: [] }), retrieve: async () => null },
  checkout: { sessions: { create: async (a) => (calls.push(['checkout', a]), { id: 'cs_ref', url: 'https://checkout.stripe.test/r' }) } },
};

let n = 0;
const user = (extra = {}) => db.save('users', { id: `rf${++n}`, email: `rf${n}@127.test`, name: `Friend${n} Last`, tier: 'free', emailVerified: true, createdAt: new Date().toISOString(), ...extra });

test.before(async () => {
  await db.init();
  billing._setClient(fake);
});
test.after(() => {
  if (fs.existsSync(process.env.DB_FILE)) fs.rmSync(process.env.DB_FILE);
});
test.beforeEach(() => {
  process.env.REFERRALS = 'on';
  calls.length = 0;
});

test('one code per person: the founding list code if there is one, else a new one from the same alphabet', async () => {
  const listed = await user();
  await db.save('waitlist', { id: 'wl1', email: listed.email, referralCode: 'ABCDEF', referralCount: 0 });
  assert.equal(await referrals.codeFor(listed), 'ABCDEF');
  const fresh = await user();
  const code = await referrals.codeFor(fresh);
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.equal(await referrals.codeFor(db.get('users', fresh.id)), code, 'kept once made');
  assert.equal(referrals.owner(code).email, fresh.email);
  assert.equal(referrals.owner('abcdef').email, listed.email);
  assert.equal(referrals.owner('NOPE00'), null);
  assert.equal(referrals.link(code), `https://127.test/f/${code}`);
  assert.equal(referrals.badgeHref(code), `https://127.test/f/${code}?via=site`);
});

test('switch off: a paid friend starts nothing', async () => {
  process.env.REFERRALS = 'off';
  const own = await user({ tier: 'builder' });
  const code = await referrals.codeFor(own);
  const friend = await user({ tier: 'builder', referredBy: code });
  assert.equal(await referrals.onPaid(friend, { id: 'in_1', amount_paid: 2900 }), null);
  process.env.REFERRALS = 'admins';
  assert.equal(await referrals.onPaid(friend, { id: 'in_1', amount_paid: 2900 }), null, 'admins: neither side is an admin');
});

test('a paying member gets a month of credit, capped at the friend’s price, after the 14 days', async () => {
  const own = await user({ tier: 'circle', stripeCustomerId: 'cus_owner' });
  const code = await referrals.codeFor(own);
  const friend = await user({ tier: 'builder', referredBy: code });
  const rec = await referrals.onPaid(friend, { id: 'in_2', amount_paid: 2900 });
  assert.equal(rec.status, 'waiting');
  assert.equal(rec.friendFirst, `Friend${n}`);
  assert.equal(await referrals.onPaid(friend, { id: 'in_3', amount_paid: 2900 }), null, 'one reward per friend, ever');
  assert.equal(await referrals.sweep(Date.now()), 0, 'not yet');
  assert.equal(await referrals.sweep(Date.now() + 15 * DAY), 1);
  const done = db.get('referrals', friend.id);
  assert.equal(done.status, 'earned');
  assert.equal(done.amount, 29, 'a Builder friend earns a Circle member $29, not $299');
  const [, cus, a, o] = calls.find((c) => c[0] === 'balance');
  assert.equal(cus, 'cus_owner');
  assert.equal(a.amount, -2900);
  assert.equal(o.idempotencyKey, `referral-month-${friend.id}`);
  const sum = referrals.summary(own, code);
  assert.equal(sum.earned, 1);
  assert.equal(sum.friends[0].state, 'earned');
});

test('a founding-price Builder gets $19; a free member banks the month; refunds, ambassadors and self do not count', async () => {
  const founding = await user({ tier: 'builder', foundingPrice: true, stripeCustomerId: 'cus_f' });
  const fcode = await referrals.codeFor(founding);
  const f1 = await user({ tier: 'circle', referredBy: fcode });
  await referrals.onPaid(f1, { id: 'in_4', amount_paid: 29900 });
  await referrals.sweep(Date.now() + 15 * DAY);
  assert.equal(db.get('referrals', f1.id).amount, 19);

  const free = await user();
  const code = await referrals.codeFor(free);
  const f2 = await user({ tier: 'builder', referredBy: code });
  await referrals.onPaid(f2, { id: 'in_5', amount_paid: 2900 });
  const f3 = await user({ tier: 'builder', referredBy: code });
  await referrals.onPaid(f3, { id: 'in_6', amount_paid: 2900 });
  await referrals.onRefund(f3);
  const f4 = await user({ tier: 'builder', referredBy: code, utm: { utm_source: 'ambassador', utm_campaign: 'ambassadors' } });
  assert.equal((await referrals.onPaid(f4, { id: 'in_7', amount_paid: 2900 })).reason, 'ambassador');
  await referrals.sweep(Date.now() + 15 * DAY);
  assert.equal(db.get('referrals', f2.id).status, 'banked');
  assert.equal(db.get('referrals', f3.id).reason, 'refunded');
  assert.equal(referrals.banked(free).id, f2.id);
  assert.ok(!calls.some((c) => c[0] === 'balance' && c[1] !== 'cus_f'), 'no credit for a free member');
  const sum = referrals.summary(free, code);
  assert.deepEqual(sum.friends.map((f) => f.state).sort(), ['banked', 'not-counted', 'refunded']);

  // The banked month takes the referral coupon at a Builder checkout and is marked used when it completes.
  const url = await billing.checkoutUrl({ headers: { host: '127.test' }, protocol: 'https', get: () => '127.test' }, db.get('users', free.id), 'builder');
  assert.equal(url, 'https://checkout.stripe.test/r');
  const a = calls.find((c) => c[0] === 'checkout')[1];
  assert.deepEqual(a.discounts, [{ coupon: 'founding-referral' }]);
  assert.equal(a.metadata.referral_month, f2.id);
  await referrals.markUsed(f2.id, free.id);
  assert.equal(db.get('referrals', f2.id).status, 'used');
  assert.equal(referrals.banked(free), null);
});

test('12 free months a year at most', async () => {
  const own = await user({ tier: 'builder', stripeCustomerId: 'cus_cap' });
  const code = await referrals.codeFor(own);
  const friends = [];
  for (let i = 0; i < 13; i++) {
    const f = await user({ tier: 'builder', referredBy: code });
    await referrals.onPaid(f, { id: `in_cap_${i}`, amount_paid: 2900 });
    friends.push(f);
  }
  await referrals.sweep(Date.now() + 15 * DAY);
  const recs = friends.map((f) => db.get('referrals', f.id));
  assert.equal(recs.filter((r) => r.status === 'earned').length, 12);
  assert.equal(recs.filter((r) => r.reason === 'cap').length, 1);
  assert.equal(referrals.summary(own, code).capLeft, 0);
});

test('the invoice.paid webhook starts the wait for a referred friend', async () => {
  const own = await user({ tier: 'builder', stripeCustomerId: 'cus_o2' });
  const code = await referrals.codeFor(own);
  const friend = await user({ tier: 'builder', referredBy: code, stripeCustomerId: 'cus_friend' });
  const payload = JSON.stringify({ id: 'evt_inv_ref', type: 'invoice.paid', data: { object: { id: 'in_w', object: 'invoice', customer: 'cus_friend', amount_paid: 2900, currency: 'usd' } } });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const res = { code: 200, status(c) { this.code = c; return this; }, send() { return this; }, json() { return this; } };
  await billing.webhook({ body: Buffer.from(payload), headers: { 'stripe-signature': header } }, res);
  assert.equal(res.code, 200);
  assert.equal(db.get('referrals', friend.id).status, 'waiting');
});
