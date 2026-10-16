// Billing emails (lib/billing-emails.js), the reminder job (lib/reminders.js), the
// records kept on account deletion (lib/billing-records.js) and the membership terms
// page build. Runs against an in-memory store, a fake clock and a fake sender: no
// network, no Resend, no Stripe, and data/db.json is never touched.

process.env.BASE_URL = 'https://127.test';
delete process.env.STRIPE_PRICE_BUILDER_FOUNDING;
delete process.env.STRIPE_PRICE_CIRCLE;

const test = require('node:test');
const assert = require('node:assert');
const billingEmails = require('../lib/billing-emails');
const reminders = require('../lib/reminders');
const billingRecords = require('../lib/billing-records');
const { build, publicPart } = require('../scripts/build-membership-terms');

const DAY = 864e5;
const T0 = Date.UTC(2026, 10, 22, 15); // Sunday, November 22, 2026, 10:00 ET
const sec = (ms) => Math.floor(ms / 1000);

let store, sent, clock;
function fakeDb() {
  const col = (c) => (store[c] = store[c] || {});
  let n = 0;
  return {
    get: (c, id) => col(c)[id] || null,
    save: async (c, doc) => {
      if (!doc.id) doc.id = `doc${++n}`;
      col(c)[doc.id] = doc;
      return doc;
    },
    all: (c) => Object.values(col(c)),
    find: (c, p) => Object.values(col(c)).find(p) || null,
    filter: (c, p) => Object.values(col(c)).filter(p),
  };
}

test.beforeEach(() => {
  store = {};
  sent = [];
  clock = T0;
  billingEmails._setDeps({ db: fakeDb(), now: () => clock, sendEmail: (m) => sent.push(m) });
});

// Let fire-and-forget sends land.
const settle = () => new Promise((r) => setImmediate(r));

const PRICES = {
  founding: { id: 'price_f', lookup_key: 'builder_founding_monthly', unit_amount: 2300 },
  builder: { id: 'price_b', lookup_key: 'builder_monthly', unit_amount: 3100 },
  circle: { id: 'price_c', lookup_key: 'circle_monthly', unit_amount: 31900 },
};
function sub(over = {}) {
  const start = over.start || T0;
  const { start: _s, price = PRICES.founding, ...rest } = over;
  return {
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_1',
    created: sec(start),
    start_date: sec(start),
    billing_cycle_anchor: sec(start),
    metadata: {},
    discounts: [],
    cancel_at: null,
    cancel_at_period_end: false,
    pause_collection: null,
    items: { data: [{ id: 'si_1', price, current_period_start: sec(start), current_period_end: sec(start + 30 * DAY) }] },
    ...rest,
  };
}
async function member(over = {}) {
  const u = { id: 'u1', email: 'ana@x.test', name: 'Ana Lopez', tier: 'builder', foundingPrice: true, stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', createdAt: new Date(T0 - 10 * DAY).toISOString(), ...over };
  await billingEmails.deps.db.save('users', u);
  return u;
}

// ---------- acknowledgment ----------

test('acknowledgment: plan, price from Stripe, billing day, renewal, cancel steps, refund rules', async () => {
  const u = await member();
  await billingEmails.subscriptionSynced(u, sub());
  await settle();
  assert.strictEqual(sent.length, 1);
  const m = sent[0];
  assert.strictEqual(m.to, 'ana@x.test');
  assert.strictEqual(m.subject, 'Your 127 Builder membership is confirmed');
  assert.match(m.text, /^Hi Ana,/);
  assert.match(m.text, /Plan: Builder, founding price \(locked for as long as your membership stays active\)/);
  assert.match(m.text, /Price: \$23 a month, plus any applicable tax/); // from the Stripe price, not a constant
  assert.match(m.text, /Billing date: the 22nd of each month/);
  assert.match(m.text, /renews automatically every month until you cancel/);
  assert.match(m.text, /https:\/\/127\.test\/app\/billing/);
  assert.match(m.text, /within 14 days of your first paid Builder charge/);
  assert.match(m.text, /don't refund partial months/);
  assert.match(m.text, /https:\/\/127\.test\/membership-terms/);
  assert.ok(!/First charge/.test(m.text));
  assert.ok(!/\$19|\$29|November 24/.test(m.text));
  const rec = billingEmails.deps.db.filter('billingRecords', () => true);
  assert.deepStrictEqual(rec.map((r) => [r.kind, r.subscriptionId, r.priceId]), [['start', 'sub_1', 'price_f']]);
});

test('acknowledgment: sent once per subscription, again on upgrade, never for a downgrade', async () => {
  const u = await member();
  await billingEmails.subscriptionSynced(u, sub());
  await billingEmails.subscriptionSynced(u, sub()); // webhook after the success page
  await billingEmails.purchaseAcknowledgment(u, sub()); // a retry
  await settle();
  assert.strictEqual(sent.length, 1);
  clock += 3 * DAY;
  u.tier = 'circle';
  await billingEmails.subscriptionSynced(u, sub({ price: PRICES.circle }));
  await settle();
  assert.strictEqual(sent.length, 2);
  assert.strictEqual(sent[1].subject, "Your 127 Founder's Circle membership is confirmed");
  assert.match(sent[1].text, /Price: \$319 a month/);
  assert.ok(!/14 days/.test(sent[1].text)); // the 14-day refund is Builder only
  u.tier = 'builder';
  await billingEmails.subscriptionSynced(u, sub());
  await settle();
  assert.strictEqual(sent.length, 2);
  const kinds = billingEmails.deps.db.filter('billingRecords', () => true).map((r) => r.kind);
  assert.deepStrictEqual(kinds, ['start', 'upgrade']);
});

test('acknowledgment: a subscription that predates these emails is not emailed out of the blue', async () => {
  const u = await member();
  await billingEmails.subscriptionSynced(u, sub({ start: T0 - 40 * DAY }));
  await settle();
  assert.strictEqual(sent.length, 0);
});

test('acknowledgment with the referral free month: first-charge date, amount, cancel before it to pay nothing', async () => {
  const u = await member({ referralRewardUsed: true });
  await billingEmails.subscriptionSynced(u, sub());
  await settle();
  const charge = billingEmails.longDate(T0 + 30 * DAY);
  assert.strictEqual(charge, 'Tuesday, December 22');
  assert.match(sent[0].text, new RegExp(`First charge: \\$23 on ${charge}\\. Your first month is free\\. Cancel before ${charge} to pay nothing\\.`));
  assert.strictEqual(u.freeMonthSubscriptionId, 'sub_1');
  assert.strictEqual(u.freeMonthEndsAt, new Date(T0 + 30 * DAY).toISOString());
});

test('free month: a 100%-off come-back coupon or a trial counts; a later month does not', () => {
  const u = { id: 'u2' };
  const coupon = sub({ discounts: [{ source: { coupon: { id: 'winback', percent_off: 100 } } }] });
  assert.strictEqual(billingEmails.freeMonthOf(u, coupon), T0 + 30 * DAY);
  assert.strictEqual(billingEmails.freeMonthOf(u, sub({ status: 'trialing', trial_end: sec(T0 + 14 * DAY) })), sec(T0 + 14 * DAY) * 1000);
  assert.strictEqual(billingEmails.freeMonthOf(u, sub()), null);
  const later = sub({ discounts: coupon.discounts });
  later.items.data[0].current_period_start = sec(T0 + 30 * DAY);
  assert.strictEqual(billingEmails.freeMonthOf(u, later), null);
});

// ---------- the other emails ----------

test('free-month reminder: launch/email-flows.md K copy with the values passed in', async () => {
  const u = await member();
  const chargeAt = T0 + 30 * DAY;
  await billingEmails.freeMonthReminder(u, { chargeAt, subscriptionId: 'sub_1', amount: 23 });
  await billingEmails.freeMonthReminder(u, { chargeAt, subscriptionId: 'sub_1', amount: 23 });
  await settle();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].subject, 'Your free month ends on Tuesday, December 22');
  assert.match(sent[0].text, /^Ana,/);
  assert.match(sent[0].text, /Your free month of Builder ends on Tuesday, December 22\. On that day you'll be charged \$23\/month, your founding price, locked as long as you stay/);
  assert.match(sent[0].text, /renews monthly until you cancel/);
  assert.match(sent[0].text, /cancel before Tuesday, December 22 and you won't be charged/);
  assert.match(sent[0].text, /Manage billing: https:\/\/127\.test\/app\/billing/);
  const withCard = billingEmails.templates.freeMonthReminder({ name: '', planKey: 'builder', founding: false, amount: 31, chargeAt, cardLast4: '4242' });
  assert.match(withCard.text, /^Hey,/);
  assert.match(withCard.text, /your card ending 4242 will be charged \$31\/month, plus/);
  assert.ok(!/founding/.test(withCard.text));
});

test('cancellation scheduled (J1): access end date, what they keep, one-tap undo; no second email when it ends', async () => {
  const u = await member();
  const end = T0 + 30 * DAY;
  await billingEmails.subscriptionSynced(u, sub({ start: T0 - 40 * DAY, cancel_at_period_end: true, cancel_at: sec(end) }));
  await settle();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].subject, "You're cancelled");
  assert.match(sent[0].text, /Your Builder access runs until Tuesday, December 22, and you won't be charged again/);
  assert.match(sent[0].text, /roadmap, progress, saved work and wins stay/);
  assert.match(sent[0].text, /founding price ends when the cancellation takes effect/);
  assert.match(sent[0].text, /Until Tuesday, December 22, keep Builder with one tap from Billing, with no new charge, and your founding price stays/);
  assert.strictEqual(u.cancelAt, new Date(end).toISOString());
  clock = end;
  u.tier = 'free';
  await billingEmails.subscriptionSynced(u, sub({ status: 'canceled', start: T0 - 40 * DAY }));
  await settle();
  assert.strictEqual(sent.length, 1);
  const kinds = billingEmails.deps.db.filter('billingRecords', () => true).map((r) => r.kind);
  assert.deepStrictEqual(kinds, ['cancel_scheduled', 'ended']);
});

test('plan ended without a scheduled cancel: J1 "Your plan has ended", payment-failure wording when Stripe gave up', async () => {
  const u = await member({ tier: 'free' });
  await billingEmails.cancellationConfirmed(u, sub({ status: 'canceled', price: PRICES.builder }));
  await billingEmails.cancellationConfirmed(u, sub({ status: 'canceled', price: PRICES.builder }));
  await settle();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].subject, 'Your plan has ended');
  assert.match(sent[0].text, /Your Builder plan has ended/);
  assert.ok(!/founding/.test(sent[0].text));
  const failed = billingEmails.templates.planEnded({ name: 'Ana', planKey: 'circle', founding: false, paymentFailed: true });
  assert.match(failed.text, /couldn't collect your payment.*Founder's Circle plan has ended/);
});

test('pause emails: confirmation (from the subscription or from the pause code) and restart reminder', async () => {
  const u = await member();
  const restart = T0 + 45 * DAY;
  await billingEmails.subscriptionSynced(u, sub({ start: T0 - 40 * DAY, pause_collection: { behavior: 'void', resumes_at: sec(restart) } }));
  await billingEmails.pauseConfirmation(u, { subscriptionId: 'sub_1', restartAt: restart }); // same pause, called by the pause code
  await settle();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].subject, 'Paused until Wednesday, January 6');
  assert.match(sent[0].text, /roadmap and price are saved, including your founding price\. Nothing will be charged until Wednesday, January 6/);
  assert.match(sent[0].text, /restarts automatically at \$23 a month/);
  assert.match(sent[0].text, /Resume now: https:\/\/127\.test\/app\/billing/);
  assert.match(sent[0].text, /cancel instead/);
  assert.strictEqual(u.pauseResumesAt, new Date(restart).toISOString());

  await billingEmails.pauseConfirmation(u, { subscriptionId: 'sub_1', restartAt: restart + 31 * DAY, pausesAt: restart, amount: 23 });
  await settle();
  assert.match(sent[1].text, /You keep Builder until your paid month ends on Wednesday, January 6/);

  const r = billingEmails.templates.pauseRestartReminder({ name: 'Ana', planKey: 'builder', founding: false, amount: 31, restartAt: restart });
  assert.strictEqual(r.subject, 'Builder restarts on Wednesday, January 6');
  assert.match(r.text, /Your plan restarts on Wednesday, January 6 at \$31 a month/);
  assert.match(r.text, /cancel online from Billing, no call or email needed/);
});

test('price change, yearly reminder and refund confirmation carry the values passed in', async () => {
  const u = await member({ foundingPrice: false });
  await billingEmails.priceChangeNotice(u, { subscriptionId: 'sub_1', oldAmount: 31, newAmount: 37, effectiveAt: T0 + 20 * DAY });
  await billingEmails.yearlyReminder(u, { subscriptionId: 'sub_1', joinedAt: T0 - 365 * DAY, year: 1, amount: 31 });
  await billingEmails.refundConfirmation(u, { refundId: 're_1', amount: 31, cardLast4: '4242', membershipEnded: true });
  await billingEmails.refundConfirmation(u, { refundId: 're_1', amount: 31 });
  await settle();
  assert.strictEqual(sent.length, 3);
  assert.strictEqual(sent[0].subject, 'Your Builder price is changing on December 12, 2026');
  assert.match(sent[0].text, /from \$31 to \$37 a month/);
  assert.match(sent[0].text, /cancel within 14 days of that first charge, we'll refund that charge in full/);
  assert.match(sent[1].text, /You joined on November 22, 2025/);
  assert.match(sent[1].text, /Price: \$31 a month/);
  assert.match(sent[1].text, /Billing: monthly, on the 22nd, renewing automatically until you cancel/);
  assert.match(sent[1].text, /How to cancel/);
  assert.strictEqual(sent[2].subject, 'Your refund is on its way');
  assert.match(sent[2].text, /We've refunded \$31 to your card ending 4242/);
  assert.match(sent[2].text, /Builder membership has ended/);
});

// ---------- reminder job ----------

test('reminder job: free-month reminder 5 days ahead, once, and not after a cancel', async () => {
  const ends = T0 + 30 * DAY;
  const u = await member({ freeMonthSubscriptionId: 'sub_1', freeMonthEndsAt: new Date(ends).toISOString(), subscriptionAmount: 23 });
  await member({ id: 'u3', email: 'bo@x.test', stripeSubscriptionId: 'sub_3', freeMonthSubscriptionId: 'sub_3', freeMonthEndsAt: new Date(ends).toISOString(), cancelAt: new Date(ends).toISOString() });
  await member({ id: 'u4', email: 'cy@x.test', tier: 'free', stripeSubscriptionId: null });

  clock = ends - 6 * DAY;
  assert.deepStrictEqual(await reminders.runOnce(clock), []);
  clock = ends - 5 * DAY + 60 * 1000;
  assert.deepStrictEqual(await reminders.runOnce(clock), [{ userId: 'u1', kind: 'free_month' }]);
  clock += 6 * 3600 * 1000;
  assert.deepStrictEqual(await reminders.runOnce(clock), []); // the next 6-hourly run
  // Stripe's trial_will_end for the same charge date is the same notice.
  await reminders.trialWillEnd(sub({ status: 'trialing', trial_end: sec(ends) }));
  await settle();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, u.email);
  assert.match(sent[0].text, /\$23\/month/);
  assert.ok(billingEmails.deps.db.get('billingReminders', `free-month:sub_1:${sec(ends)}`));
});

test('reminder job: trial_will_end alone sends the reminder with the Stripe price', async () => {
  await member({ foundingPrice: false });
  const ends = T0 + 3 * DAY;
  await reminders.trialWillEnd(sub({ status: 'trialing', trial_end: sec(ends), price: PRICES.builder }));
  await reminders.trialWillEnd(sub({ status: 'trialing', trial_end: sec(ends), price: PRICES.builder }));
  await reminders.trialWillEnd(sub({ id: 'sub_9', customer: 'cus_unknown', status: 'trialing', trial_end: sec(ends) }));
  await settle();
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].subject, 'Your free month ends on Wednesday, November 25');
  assert.match(sent[0].text, /\$31\/month, plus/);
});

test('reminder job: pause restart 5 days ahead and the yearly reminder, each once', async () => {
  const joined = Date.UTC(2025, 10, 20, 15);
  await member({ foundingPrice: false, subscriptionAmount: 31, billingSubscriptionId: 'sub_1', subscriptionStartedAt: new Date(joined).toISOString(), pauseResumesAt: new Date(T0 + 4 * DAY).toISOString() });
  const first = await reminders.runOnce(T0);
  assert.deepStrictEqual(first.map((s) => s.kind).sort(), ['pause_restart', 'yearly']);
  assert.deepStrictEqual(await reminders.runOnce(T0 + 6 * 3600 * 1000), []);
  assert.deepStrictEqual(await reminders.runOnce(T0 + 3 * DAY), []);
  await settle();
  assert.deepStrictEqual(sent.map((m) => m.subject).sort(), ['Builder restarts on Thursday, November 26', 'Your 127 membership: your yearly reminder']);
  // Outside the 7-day window after an anniversary nothing goes out.
  store.billingReminders = {};
  store.users.u1.pauseResumesAt = null;
  assert.deepStrictEqual(await reminders.runOnce(joined + 365 * DAY + 8 * DAY), []);
});

test('lastAnniversary handles the first year and Feb 29', () => {
  const start = Date.UTC(2024, 1, 29);
  assert.strictEqual(reminders.lastAnniversary(start, Date.UTC(2025, 1, 27)), null);
  assert.deepStrictEqual(reminders.lastAnniversary(start, Date.UTC(2025, 2, 1)), { year: 1, at: Date.UTC(2025, 1, 28) });
  assert.deepStrictEqual(reminders.lastAnniversary(start, Date.UTC(2028, 1, 29, 1)), { year: 4, at: Date.UTC(2028, 1, 29) });
});

// ---------- records kept on account deletion ----------

test('account deletion keeps a minimal billing record for 5 years, nothing for free members', async () => {
  assert.strictEqual(await billingRecords.retainOnDelete({ id: 'u5', email: 'free@x.test', tier: 'free' }), null);
  const u = await member({ checkoutConsent: { at: new Date(T0).toISOString(), termsVersion: 't1', box: true, ipHash: 'abc' } });
  await billingEmails.subscriptionSynced(u, sub());
  const kept = await billingRecords.retainOnDelete(u);
  assert.strictEqual(kept.emailHash, billingRecords.emailHash('ANA@x.test '));
  assert.strictEqual(kept.stripeCustomerId, 'cus_1');
  assert.deepStrictEqual(kept.subscriptionIds, ['sub_1']);
  assert.deepStrictEqual(kept.consent, u.checkoutConsent);
  assert.strictEqual(kept.retainUntil, new Date(Date.UTC(2031, 10, 22, 15)).toISOString());
  const json = JSON.stringify(kept);
  assert.ok(!json.includes('ana@x.test') && !json.includes('Ana'));
  const startRec = billingEmails.deps.db.find('billingRecords', (r) => r.kind === 'start');
  assert.deepStrictEqual(startRec.consent, u.checkoutConsent);
});

// ---------- the /membership-terms page build ----------

test('membership terms build: title to Section 18 only, escaped, links kept', () => {
  const md = [
    '> **DRAFT v0.1.** Internal note.',
    '',
    '# Membership & Terms',
    '',
    'Part of our [Terms](/terms). <script>x</script>',
    '',
    '## 18. Contact',
    '',
    '| Plan | Price |',
    '|---|---|',
    '| Builder | **$29** |',
    '',
    '- one [bad](javascript:void)',
    '1. first',
    '',
    '---',
    '',
    '# Appendix A. Checkout',
    'secret spec',
    '## Drafting notes (remove before publishing)',
    'notes',
  ].join('\n');
  assert.strictEqual(publicPart(md)[0], '# Membership & Terms');
  const html = build(md);
  assert.match(html, /<h1 id="membership-terms">Membership &amp; Terms<\/h1>/);
  assert.match(html, /<a href="\/terms">Terms<\/a>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<h2 id="section-18">18\. Contact<\/h2>/);
  assert.match(html, /<td><strong>\$29<\/strong><\/td>/);
  assert.match(html, /<li>one bad<\/li>/);
  assert.match(html, /<ol>\n<li>first<\/li>/);
  assert.ok(!/DRAFT|Appendix|secret|Drafting|notes/.test(html));
});
