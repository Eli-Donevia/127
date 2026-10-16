// Pause for a month (offer.md section 8, Membership Terms section 8, legal/handoffs/website.md item 13),
// the R10 dunning reminders, and the under-18 review (Legal L42), against a fake Stripe client.
// No network: email and events are captured in memory.

const path = require('path');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-pause-age-${process.pid}.json`);
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.BASE_URL = 'https://127.test';
process.env.ADMIN_EMAILS = 'eli@127.test';
process.env.FOUNDING_PRICE = '19';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../lib/db');
const billing = require('../lib/billing');
const billingEmails = require('../lib/billing-emails');
const reminders = require('../lib/reminders');
const integrations = require('../lib/integrations');
const ageCheck = require('../lib/age-check');
const ai = require('../lib/ai');

const DAY = 864e5;
const S = 86400;
const PRICES = {
  builder_monthly: { id: 'price_b', lookup_key: 'builder_monthly' },
  builder_founding_monthly: { id: 'price_f', lookup_key: 'builder_founding_monthly' },
  circle_monthly: { id: 'price_c', lookup_key: 'circle_monthly' },
};
const byId = Object.fromEntries(Object.values(PRICES).map((p) => [p.id, p]));

function fakeStripe() {
  const calls = [];
  const subs = {};
  const chargeList = [];
  const log = (name, args) => calls.push({ name, args });
  return {
    calls, subs, chargeList,
    sub(id, priceId, endSec, extra = {}) {
      subs[id] = {
        id, object: 'subscription', status: 'active', customer: 'cus_1', metadata: {}, created: Math.floor(Date.now() / 1000) - 40 * S,
        billing_cycle_anchor: endSec - 30 * S, cancel_at_period_end: false, cancel_at: null, pause_collection: null,
        items: { data: [{ id: 'si_' + id, price: byId[priceId], current_period_start: endSec - 30 * S, current_period_end: endSec }] },
        ...extra,
      };
      return subs[id];
    },
    prices: { list: async (a) => ({ data: a.lookup_keys.map((k) => PRICES[k]).filter(Boolean) }) },
    customers: { retrieve: async (id) => ({ id }) },
    subscriptions: {
      retrieve: async (id) => (log('subs.retrieve', id), subs[id]),
      update: async (id, a) => {
        log('subs.update', { id, a });
        const s = subs[id];
        if ('cancel_at_period_end' in a) s.cancel_at_period_end = a.cancel_at_period_end;
        if ('pause_collection' in a) s.pause_collection = a.pause_collection || null;
        if (a.metadata) s.metadata = { ...s.metadata, ...a.metadata };
        return s;
      },
      cancel: async (id) => (log('subs.cancel', id), subs[id] ? Object.assign(subs[id], { status: 'canceled' }) : { id, status: 'canceled' }),
    },
    charges: { list: async (a) => (log('charges.list', a), { data: chargeList, has_more: false }) },
    refunds: { create: async (a, o) => (log('refunds.create', { a, o }), { id: `re_${a.charge}`, amount: a.amount }) },
  };
}

let s, mails, user;
const events = (type, id) => db.filter('events', (e) => e.type === type && e.payload.userId === id);

test.before(async () => {
  await db.init();
});
// The store writes the file 100ms after the last save, so clean up when the process exits.
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
});
test.beforeEach(async () => {
  s = fakeStripe();
  billing._setClient(s);
  mails = [];
  billingEmails._setDeps({ sendEmail: async (m) => mails.push(m) });
  ageCheck._setDeps({ send: (m) => mails.push(m) });
});

// An active Builder whose paid month ends in `days` days.
async function builder(days = 10, extra = {}) {
  const end = Math.floor(Date.now() / 1000) + days * S;
  const id = `sub_${Math.random().toString(36).slice(2)}`;
  const sub = s.sub(id, extra.founding ? 'price_f' : 'price_b', end);
  user = await db.save('users', { email: `p${Date.now()}${Math.random()}@x.test`, name: 'Sam Lee', tier: 'free', createdAt: new Date(Date.now() - 40 * DAY).toISOString(), stripeCustomerId: 'cus_1', stripeSubscriptionId: id });
  await billing.refreshSubscription(user);
  return { sub, end };
}
// Stripe rolled into the paused month: the pause began a day ago and the paused month ends in 29 days.
function intoPausedMonth(sub) {
  const nowSec = Math.floor(Date.now() / 1000);
  user.pause.scheduledFor = new Date((nowSec - S) * 1000).toISOString();
  sub.items.data[0].current_period_start = nowSec - S;
  sub.items.data[0].current_period_end = nowSec + 29 * S;
}

test('pause: Stripe pause_collection is void, resumes_at = period end + 1 day, and the paid month is kept', async () => {
  const { sub, end } = await builder(10);
  assert.equal(billing.pauseEligible(user).ok, true);
  const preview = billing.pausePreview(user);
  assert.equal(preview.pausesAt, end * 1000);
  await billing.pauseAtPeriodEnd(user);
  const upd = s.calls.find((c) => c.name === 'subs.update').args;
  assert.equal(upd.id, sub.id);
  assert.deepEqual(upd.a.pause_collection, { behavior: 'void', resumes_at: end + S });
  assert.equal(user.tier, 'builder', 'Builder stays until the paid month ends');
  assert.equal(user.pause.scheduledFor, new Date(end * 1000).toISOString());
  assert.equal(Date.parse(user.pause.resumesAt), preview.restartAt);
  assert.ok(Date.parse(user.pause.resumesAt) - end * 1000 >= 28 * DAY, 'restarts one billing month later');
  assert.equal(events('subscription.pause_scheduled', user.id).length, 1);
  await new Promise((r) => setImmediate(r));
  assert.ok(mails.some((m) => m.subject.startsWith('Paused until ')), 'pause confirmation email');
});

test('pause: Builder only, once every 6 months, not with a payment problem or a cancellation', async () => {
  await builder(10);
  user.paymentIssue = { at: new Date().toISOString() };
  assert.equal(billing.pauseEligible(user).reason, 'payment');
  user.paymentIssue = null;
  user.cancelAt = new Date().toISOString();
  assert.equal(billing.pauseEligible(user).reason, 'cancelled');
  user.cancelAt = null;
  user.pauses = [{ requestedAt: new Date(Date.now() - 100 * DAY).toISOString() }];
  const r = billing.pauseEligible(user);
  assert.equal(r.reason, 'recent');
  assert.ok(r.nextAt);
  assert.equal(billing.PAUSE_REFUSALS.recent, 'You can pause once every 6 months.');
  user.pauses = [{ requestedAt: new Date(Date.now() - 190 * DAY).toISOString() }];
  assert.equal(billing.pauseEligible(user).ok, true);
  assert.equal(billing.pauseEligible({ tier: 'circle' }).reason, 'circle');
  assert.equal(billing.pauseEligible({ tier: 'free' }).reason, 'not_builder');
});

test('pause: Free while paused (price kept, no Upgraded/Downgraded), then back on Builder as "Resumed Subscription"', async () => {
  const { sub } = await builder(10, { founding: true });
  assert.equal(user.foundingPrice, true);
  await billing.pauseAtPeriodEnd(user);
  intoPausedMonth(sub);
  const historyBefore = (user.planHistory || []).length;
  assert.equal(await billing.pauseTick(user), 'started');
  assert.equal(user.tier, 'free');
  assert.equal(user.pausedTier, 'builder');
  assert.equal(user.foundingPrice, true, 'the founding price is kept');
  assert.equal(user.stripeSubscriptionId, sub.id);
  assert.ok(user.pause.startedAt);
  assert.equal(user.pause.resumesAt, new Date(sub.items.data[0].current_period_end * 1000).toISOString());
  assert.equal(billing.pauseEligible(user).reason, 'already');
  const paused = events('plan.changed', user.id).at(-1).payload;
  assert.equal(integrations.metricFor('plan.changed', paused)[0], 'Paused Subscription');
  assert.equal(user.planHistory.length, historyBefore, 'a pause is not a plan change');
  // The paused month ends: Stripe starts the next period and charges it.
  const pe = sub.items.data[0].current_period_end;
  sub.pause_collection = null;
  sub.items.data[0].current_period_start = pe;
  sub.items.data[0].current_period_end = pe + 31 * S;
  assert.equal(await billing.pauseTick(user), 'restarted');
  assert.equal(user.tier, 'builder');
  assert.equal(user.pausedTier, null);
  assert.equal(user.pause.endedReason, 'restarted');
  const back = events('plan.changed', user.id).at(-1).payload;
  assert.equal(integrations.metricFor('plan.changed', back)[0], 'Resumed Subscription');
  assert.equal(user.planHistory.length, historyBefore);
});

test('pause: "Resume now" during the paused month clears pause_collection and unlocks Builder', async () => {
  const { sub } = await builder(10);
  await billing.pauseAtPeriodEnd(user);
  intoPausedMonth(sub);
  await billing.pauseTick(user);
  assert.equal(user.tier, 'free');
  assert.equal(await billing.resumePause(user), true);
  assert.deepEqual(s.calls.filter((c) => c.name === 'subs.update').at(-1).args.a, { pause_collection: '' });
  assert.equal(user.tier, 'builder');
  assert.equal(user.pause.endedReason, 'resumed');
  assert.equal(events('subscription.pause_ended', user.id).length, 1);
});

test('pause: cancelling before the pause starts drops it and frees the once-in-6-months', async () => {
  await builder(10);
  await billing.pauseAtPeriodEnd(user);
  await billing.cancelAtPeriodEnd(user);
  assert.deepEqual(s.calls.filter((c) => c.name === 'subs.update').at(-1).args.a, { cancel_at_period_end: true, pause_collection: '' });
  assert.equal(user.pause.endedReason, 'cancelled');
  assert.equal((user.pauses || []).length, 0);
  assert.ok(user.cancelAt);
});

test('pause: the restart reminder goes out 5 days before, once', async () => {
  const { sub } = await builder(10);
  await billing.pauseAtPeriodEnd(user);
  intoPausedMonth(sub);
  await billing.pauseTick(user);
  assert.equal(user.pauseResumesAt, user.pause.resumesAt);
  const restart = Date.parse(user.pauseResumesAt);
  mails = [];
  assert.ok(!(await reminders.runOnce(restart - 6 * DAY)).some((x) => x.userId === user.id && x.kind === 'pause_restart'));
  const sent = await reminders.runOnce(restart - 4 * DAY);
  assert.ok(sent.some((x) => x.userId === user.id && x.kind === 'pause_restart'));
  assert.ok(!(await reminders.runOnce(restart - 3 * DAY)).some((x) => x.userId === user.id && x.kind === 'pause_restart'), 'sent once');
  await new Promise((r) => setImmediate(r));
  assert.ok(mails.some((m) => /^Builder restarts on /.test(m.subject)));
});

test('R10 dunning: reminders on days 2, 5 and 9 after a failed payment, each once', async () => {
  await builder(10);
  const first = Date.now();
  user.paymentIssue = { at: new Date(first).toISOString(), firstAt: new Date(first).toISOString(), invoice: `in_${user.id}`, attempt: 1 };
  await db.save('users', user);
  const kinds = async (t) => (await reminders.runOnce(t)).filter((x) => x.userId === user.id).map((x) => x.kind);
  assert.deepEqual(await kinds(first + 1 * DAY), []);
  assert.deepEqual(await kinds(first + 2.1 * DAY), ['dunning_day2']);
  assert.deepEqual(await kinds(first + 2.5 * DAY), []);
  assert.deepEqual(await kinds(first + 5.5 * DAY), ['dunning_day5']);
  assert.deepEqual(await kinds(first + 9.5 * DAY), ['dunning_day9']);
  await new Promise((r) => setImmediate(r));
  const dunning = mails.filter((m) => /payment didn’t go through/.test(m.subject));
  assert.equal(dunning.length, 3);
  assert.match(dunning.at(-1).subject, /^Last reminder/);
  assert.match(dunning.at(-1).text, /We don't charge late fees\./);
  assert.ok(!dunning[0].text.includes('late fees'));
});

test('age: the Playbook marker is read from flags (under18, and under_18), never from demo answers', () => {
  assert.deepEqual(ai.underAgeFlag({ text: ai.UNDER18_REPLY, flags: ['under18'] }), { statedAge: null });
  assert.ok(ai.underAgeFlag({ text: 'x', flags: ['under_18'] }));
  assert.equal(ai.underAgeFlag({ text: 'x', demo: true }), null);
  assert.equal(ai.underAgeFlag({ error: true, text: 'x', flags: ['under18'] }), null);
  assert.equal(ageCheck.statedAge("im 15 lol and want to sell art"), 15);
  assert.equal(ageCheck.statedAge('I started at 15, now I am 22'), null);
  assert.ok(ageCheck.detect("I'm 16 and just made my first sale", null), 'a post in the member\'s own words');
});

test('age: a flag pauses AI chats and posting at once, tells Eli without quoting, and "No action" unpauses', async () => {
  await builder(10);
  const ok = await ageCheck.flag(user, { source: 'playbook', excerpt: [{ from: 'member', text: 'one' }, { from: 'playbook', text: 'two' }, { from: 'member', text: "I'm 15 SECRET-WORDS" }, { from: 'member', text: 'extra' }].slice(0, 3), statedAge: 15 });
  assert.equal(ok, true);
  assert.equal(ageCheck.underReview(user), true);
  assert.equal(user.ageReview.excerpt.length, 3);
  assert.equal(await ageCheck.flag(user, { source: 'post', excerpt: [] }), false, 'one review at a time');
  const ev = events('safety.age_flagged', user.id);
  assert.equal(ev.length, 1);
  assert.ok(!JSON.stringify(ev).includes('SECRET-WORDS'));
  const admin = mails.find((m) => m.to === 'eli@127.test');
  assert.ok(admin && !admin.text.includes('SECRET-WORDS'));
  assert.equal(ageCheck.PAUSE_MESSAGE, "127 is for people 18 and older. You mentioned you're under 18, so we've paused AI chats and posting while we take a look. We'll email you within 2 business days.");
  await ageCheck.noAction(user, 'eli@127.test');
  assert.equal(ageCheck.underReview(user), false);
  assert.equal(user.ageReview, null, 'the excerpt is gone once Eli decides');
  assert.equal(user.ageReviewLog.at(-1).decision, 'no_action');
});

test('age: "Ask to confirm" sends one email, is refused under 13, and a yes unpauses', async () => {
  await builder(10);
  await ageCheck.flag(user, { source: 'playbook', excerpt: [], statedAge: 12 });
  assert.match((await ageCheck.askConfirm(user, 'eli')).error, /under 13/);
  user.ageReview.statedAge = 16;
  assert.ok((await ageCheck.askConfirm(user, 'eli')).ok);
  const m = mails.find((x) => x.to === user.email);
  assert.equal(m.subject, 'Your 127 account');
  assert.ok(m.text.includes("127 is for people 18 and older. Can you confirm you're 18 or older? Just reply yes."));
  assert.ok((await ageCheck.askConfirm(user, 'eli')).error, 'asked once');
  assert.equal(ageCheck.confirmExpired(user, Date.now() + 8 * DAY), true);
  await ageCheck.confirmed(user, 'eli');
  assert.equal(ageCheck.underReview(user), false);
});

test('age: "Ask to confirm" is skipped when the member said they\'re in middle school', async () => {
  await builder(10);
  await ageCheck.flag(user, { source: 'playbook', excerpt: [{ from: 'member', text: 'hi' }, { from: 'playbook', text: 'hello' }, { from: 'member', text: "im in middle school but i want to start a business" }], statedAge: null });
  assert.equal(user.ageReview.middleSchool, true);
  assert.equal(ageCheck.askAllowed(user.ageReview), false);
  assert.match((await ageCheck.askConfirm(user, 'eli')).error, /middle school/);
  assert.equal(mails.filter((m) => m.to === user.email).length, 0);
  assert.equal(ageCheck.saidMiddleSchool('I teach middle school art'), false, 'only about themselves');
  assert.equal(ageCheck.askAllowed({ statedAge: 16, middleSchool: false }), true);
});

test('age: "Close for age" cancels, refunds every payment in full, deletes, emails once and blocks the email for signup', async () => {
  const { sub } = await builder(10);
  const email = user.email;
  const id = user.id;
  s.chargeList.push(
    { id: 'ch_1', amount: 1900, amount_refunded: 0, status: 'succeeded', paid: true },
    { id: 'ch_2', amount: 1900, amount_refunded: 900, status: 'succeeded', paid: true },
    { id: 'ch_3', amount: 1900, amount_refunded: 0, status: 'failed', paid: false }
  );
  await ageCheck.flag(user, { source: 'playbook', excerpt: [{ from: 'member', text: "I'm 16" }], statedAge: 16 });
  let deleted = false;
  const out = await ageCheck.close(user, 'eli@127.test', { refundAll: (u) => billing.refundAllAndCancel(u), deleteAccount: async (u) => { deleted = true; await db.remove('users', u.id); } });
  assert.deepEqual(out.refunds, ['re_ch_1', 're_ch_2']);
  assert.equal(out.total, 29);
  assert.ok(s.calls.some((c) => c.name === 'subs.cancel' && c.args === sub.id), 'subscription cancelled now');
  const refunds = s.calls.filter((c) => c.name === 'refunds.create').map((c) => c.args.a);
  assert.deepEqual(refunds.map((r) => [r.charge, r.amount]), [['ch_1', 1900], ['ch_2', 1000]]);
  assert.ok(deleted);
  assert.ok(!db.get('users', id));
  const close = mails.filter((m) => m.to === email);
  assert.equal(close.length, 1);
  assert.equal(close[0].subject, 'Your 127 account');
  assert.ok(close[0].text.includes("We've refunded every payment, $29, to the card that paid. It can take 5 to 10 business days to show."));
  assert.ok(close[0].text.endsWith("Eli's team"));
  const rec = db.find('ageClosures', (c) => c.emailHash === ageCheck.emailHash(email));
  assert.deepEqual(rec.refundIds, ['re_ch_1', 're_ch_2']);
  assert.ok(!JSON.stringify(rec).includes(email), 'only a one-way hash of the email is kept');
  assert.ok(!JSON.stringify(rec).includes("I'm 16"), 'never the conversation');
  assert.equal(ageCheck.blocked(email), true);
  assert.equal(ageCheck.blocked(email.toUpperCase()), true);
  assert.equal(ageCheck.blocked(email, Date.now() + 3 * 366 * DAY), false, 'kept for 3 years');
  assert.equal(await ageCheck.purgeOld(Date.now() + 3 * 366 * DAY), 1);
});
