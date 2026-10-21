// Member referrals, behind REFERRALS (default off). Eli, Oct 21: "referals yes" to "members get a free month for each
// friend who joins, tracked in HQ".
//
// One code per person. Someone on the founding list already has one (lib/waitlist.js, 127group.io/f/CODE); a member
// who never joined the list gets one from the same alphabet the first time their Invite page opens. The founding
// status page, the Day One Challenge share card, the "Made with 127" badge on free sites (badgeHref) and the Invite
// page all carry that same code, and the ref cookie (server.js) takes either kind.
//
// The paid-friend rule: a friend who signed up with the code starts Builder or the Circle; once their first payment
// is past the 14-day refund window, the code's owner earns one free month. A paying owner gets a Stripe balance
// credit worth one month of their own plan, capped at what the friend pays (a Circle member who brings a Builder
// friend gets $29). An owner on the free plan banks the month: their next Builder checkout takes the referral coupon.
// At most 12 months a year. A friend refunded inside the window earns nothing. A friend who arrived on an
// ambassador's tagged link (utm_source=ambassador, ops/growth/ambassadors) never also earns a month: ambassadors are
// paid under their own agreement. The founding list's own reward (3 confirmed friends, lib/waitlist.js and
// lib/billing.js) runs as before, whatever this switch says.
//
// REFERRALS: "on" shows the Invite page to every member and runs the rule; "admins" only for ADMIN_EMAILS (both as
// owner and as friend, to try it on the live site before Legal clears it); off or unset: nothing here runs.
// REFERRALS_PAID_FROM (ISO date, default LAUNCH_AT): friends' payments before it don't count.
//
// Records: the referrals collection, doc id = the friend's user id (one reward per friend, ever).
// status: waiting (paid, inside the window) | earned (credited) | banked (owner on the free plan) | used (banked month
// spent at checkout) | held (would take the member's rewards for the year to $2,000, RF8) | void (refunded, capped,
// ambassador or self) with `reason`.
//
// Legal L101 (Membership Terms 5A): 12 a calendar year; each record keeps its dollar value (the credit, or a Builder
// month for a saved one) so a member's year can be added up, and a reward that would take a member to $2,000 in a
// calendar year waits for Legal (127 would need their W-9 first). A friend can count toward both this and the founding
// reward (RF4, Eli can change it).

const db = require('./db');
const launch = require('./launch');
const waitlist = require('./waitlist');
const flags = require('./harness/flags');
const { plan } = require('./plans');
const { emit } = require('./integrations');

const COLLECTION = 'referrals';
const DAY = 24 * 60 * 60 * 1000;
const WAIT_DAYS = 14;
const YEAR_CAP = 12;
const YEAR_VALUE_LIMIT = 2000;

function setting() {
  const v = String(process.env.REFERRALS || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}
function visibleTo(user) {
  const v = setting();
  return v === 'on' || (v === 'admins' && flags.admin(user));
}

// ---- codes --------------------------------------------------------------------------------------------------------

const clean = (code) => String(code || '').trim().toUpperCase();

// Who a code belongs to: { code, email, user, entry }, or null.
function owner(code) {
  const c = clean(code);
  if (!/^[A-Z0-9]{6}$/.test(c)) return null;
  const entry = waitlist.byCode(c);
  if (entry) return { code: c, email: entry.email, entry, user: db.find('users', (u) => u.email === entry.email) || null };
  const user = db.find('users', (u) => u.referralCode === c);
  return user ? { code: c, email: user.email, entry: null, user } : null;
}
const valid = (code) => !!owner(code);

// The member's one code: their founding list code if they have one, else their own (made once, then kept).
async function codeFor(user) {
  if (!user) return null;
  const entry = launch.onWaitlist(user.email);
  if (entry && entry.referralCode) return entry.referralCode;
  if (user.referralCode) return user.referralCode;
  user.referralCode = waitlist.newCode();
  await db.save('users', user);
  return user.referralCode;
}
function base() {
  return (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
}
const link = (code) => `${base()}/f/${code}`;
// For the "Made with 127" badge on a member's free site (Funnels v2): the owner's code, tagged so the Invite page
// can say which friends came from the site.
const badgeHref = (code) => `${link(code)}?via=site`;

// ---- the rule -----------------------------------------------------------------------------------------------------

function paidFrom() {
  const t = Date.parse(process.env.REFERRALS_PAID_FROM || process.env.LAUNCH_AT || '');
  return Number.isFinite(t) ? t : 0;
}
// The rule runs for this pair: switch on, or admins with an admin on either side.
function runsFor(friend, own) {
  const v = setting();
  if (v === 'on') return true;
  return v === 'admins' && (flags.admin(friend) || flags.admin(own && own.user));
}

// What one month of a member's plan costs them.
function monthPrice(user) {
  if (!user) return 0;
  if (user.tier === 'circle') return plan('circle').price;
  if (user.tier === 'builder') return user.foundingPrice ? launch.view().foundingPrice || plan('builder').price : plan('builder').price;
  return 0;
}
const isPaying = (user) => !!user && ['builder', 'circle'].includes(user.tier) && !user.pausedTier;

// From the invoice.paid webhook (lib/billing.js), once the friend's plan is synced. Starts the 14-day wait.
async function onPaid(friend, invoice = {}) {
  if (!friend || !friend.referredBy || db.get(COLLECTION, friend.id)) return null;
  if (!isPaying(friend) || !(invoice.amount_paid > 0)) return null;
  const own = owner(friend.referredBy);
  if (!own || !runsFor(friend, own)) return null;
  const now = Date.now();
  if (now < paidFrom()) return null;
  const rec = {
    id: friend.id,
    code: own.code,
    ownerEmail: own.email,
    friendFirst: waitlist.friendName(friend.name),
    friendPlan: friend.tier,
    friendPrice: monthPrice(friend),
    invoice: invoice.id || null,
    via: friend.signupVia || null,
    paidAt: new Date(now).toISOString(),
    eligibleAt: new Date(now + WAIT_DAYS * DAY).toISOString(),
    status: 'waiting',
  };
  if (own.email === friend.email) Object.assign(rec, { status: 'void', reason: 'self' });
  else if (friend.utm && friend.utm.utm_source === 'ambassador') Object.assign(rec, { status: 'void', reason: 'ambassador' });
  await db.save(COLLECTION, rec);
  emit('referral.friend_paid', { email: own.email, friend_first_name: rec.friendFirst, plan: rec.friendPlan, status: rec.status });
  return rec;
}

// From the charge.refunded webhook: a friend refunded inside the window earns nothing.
async function onRefund(friend) {
  const rec = friend && db.get(COLLECTION, friend.id);
  if (!rec || rec.status !== 'waiting') return null;
  Object.assign(rec, { status: 'void', reason: 'refunded', voidAt: new Date().toISOString() });
  await db.save(COLLECTION, rec);
  return rec;
}

const GIVEN = ['earned', 'banked', 'used'];
const yearOf = (t) => new Date(t).getUTCFullYear();
const givenThisYear = (email, now) => db.filter(COLLECTION, (r) => r.ownerEmail === email && GIVEN.includes(r.status) && yearOf(Date.parse(r.grantedAt)) === yearOf(now));
function grantedThisYear(email, now = Date.now()) {
  return givenThisYear(email, now).length;
}
// RF8: the dollar value of a member's rewards this calendar year.
function valueThisYear(email, now = Date.now()) {
  return givenThisYear(email, now).reduce((n, r) => n + (r.value || r.amount || 0), 0);
}
async function hold(rec, value) {
  const { sendEmail } = require('./integrations');
  Object.assign(rec, { status: 'held', reason: 'tax-2000', value });
  await db.save(COLLECTION, rec);
  const admin = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim()).filter(Boolean)[0];
  if (admin) sendEmail({ to: admin, subject: 'Referrals: a reward is on hold', text: `A free month for ${rec.ownerEmail} would take their referral rewards this year to $${YEAR_VALUE_LIMIT} or more, so it's on hold. Ask Legal before releasing it: 127 would need their W-9 first (L101 RF8).` });
  return rec;
}

// Pays one record whose wait is over. Paying owner: Stripe credit; free owner (or no account yet): banked.
async function grant(rec, now = Date.now()) {
  const billing = require('./billing');
  const friend = db.get('users', rec.id);
  if (!friend || friend.refundedFirstPayment) {
    Object.assign(rec, { status: 'void', reason: 'refunded' });
    return db.save(COLLECTION, rec);
  }
  if (grantedThisYear(rec.ownerEmail, now) >= YEAR_CAP) {
    Object.assign(rec, { status: 'void', reason: 'cap' });
    return db.save(COLLECTION, rec);
  }
  const own = db.find('users', (u) => u.email === rec.ownerEmail);
  rec.grantedAt = new Date(now).toISOString();
  const value = isPaying(own) ? Math.min(monthPrice(own), rec.friendPrice || monthPrice(own)) : plan('builder').price;
  if (valueThisYear(rec.ownerEmail, now) + value >= YEAR_VALUE_LIMIT) return hold(rec, value);
  rec.value = value;
  if (isPaying(own)) {
    const amount = value;
    const s = billing.stripeClient();
    let txn = null;
    if (s && own.stripeCustomerId) {
      txn = await s.customers.createBalanceTransaction(
        own.stripeCustomerId,
        { amount: -Math.round(amount * 100), currency: 'usd', description: `Referral: a free month (${rec.friendFirst})`, metadata: { userId: own.id, reward: 'referral-month', friend: rec.id } },
        { idempotencyKey: `referral-month-${rec.id}` }
      );
    } else if (!own.demoBilling) {
      // A paying member with no Stripe customer can't take a credit: bank it instead.
      rec.status = 'banked';
      await db.save(COLLECTION, rec);
      return rec;
    }
    Object.assign(rec, { status: 'earned', amount, transaction: txn ? txn.id : null });
    await db.save(COLLECTION, rec);
    emit('referral.month_credited', { userId: own.id, amount, friend_first_name: rec.friendFirst });
    return rec;
  }
  rec.status = 'banked';
  await db.save(COLLECTION, rec);
  emit('referral.month_banked', { email: rec.ownerEmail, friend_first_name: rec.friendFirst });
  return rec;
}

// Every few minutes from server.js: pays what's due. Safe to run more than once.
async function sweep(now = Date.now()) {
  if (setting() === 'off') return 0;
  const due = db.filter(COLLECTION, (r) => r.status === 'waiting' && Date.parse(r.eligibleAt) <= now);
  for (const rec of due) await grant(rec, now).catch((e) => console.error('[referrals] grant', rec.id, e.message));
  return due.length;
}

// A banked month the member can spend on their next Builder checkout (oldest first), or null.
function banked(user) {
  if (!user || setting() === 'off') return null;
  return db.filter(COLLECTION, (r) => r.ownerEmail === user.email && r.status === 'banked').sort((a, b) => String(a.grantedAt).localeCompare(String(b.grantedAt)))[0] || null;
}
// From checkout completion (lib/billing.js completionExtra): the session's metadata names the record it spent.
async function markUsed(recordId, userId) {
  const rec = db.get(COLLECTION, recordId);
  if (!rec || rec.status !== 'banked') return null;
  Object.assign(rec, { status: 'used', usedAt: new Date().toISOString(), usedBy: userId || null });
  await db.save(COLLECTION, rec);
  return rec;
}

// ---- the Invite page ----------------------------------------------------------------------------------------------

// Friends by first name only (Membership Terms section 5): everyone who signed up with the code, and where each is.
function summary(user, code) {
  const recs = db.filter(COLLECTION, (r) => r.code === code);
  const byFriend = new Map(recs.map((r) => [r.id, r]));
  const joined = db.filter('users', (u) => u.referredBy === code && u.id !== user.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const friends = joined.map((u) => {
    const r = byFriend.get(u.id);
    const state = !r ? 'joined' : r.status === 'void' ? 'not-counted' : r.status;
    return { first: waitlist.friendName(u.name), state, eligibleAt: r && r.status === 'waiting' ? r.eligibleAt : null, amount: r && r.amount ? r.amount : null, via: u.signupVia || null };
  });
  const count = (s) => recs.filter((r) => r.status === s).length;
  return {
    code,
    link: link(code),
    friends,
    joined: friends.length,
    waiting: count('waiting'),
    earned: count('earned') + count('banked') + count('used'),
    banked: count('banked'),
    credited: recs.filter((r) => r.status === 'earned').reduce((n, r) => n + (r.amount || 0), 0),
    capLeft: Math.max(0, YEAR_CAP - grantedThisYear(user.email)),
    yearValue: valueThisYear(user.email),
    monthPrice: monthPrice(user),
    paying: isPaying(user),
  };
}

// RF3: the first name a friend sees on the sign-up page when they arrived through a member's link, or null.
function invitedBy(code, viewer) {
  if (!code || (viewer && viewer.id)) return null;
  const own = owner(code);
  if (!own || !runsFor(null, own)) return null;
  const name = own.user ? own.user.name : own.entry && own.entry.firstName;
  return waitlist.friendName(name) || null;
}

function stats() {
  const all = db.all(COLLECTION);
  const by = (s) => all.filter((r) => r.status === s).length;
  return { total: all.length, waiting: by('waiting'), earned: by('earned'), banked: by('banked'), used: by('used'), held: by('held'), void: by('void'), credited: all.reduce((n, r) => n + (r.status === 'earned' ? r.amount || 0 : 0), 0) };
}

module.exports = {
  setting, visibleTo, owner, valid, codeFor, link, badgeHref, monthPrice, onPaid, onRefund, grant, sweep, banked, markUsed, summary, stats,
  valueThisYear, invitedBy, COLLECTION, WAIT_DAYS, YEAR_CAP, YEAR_VALUE_LIMIT,
};
