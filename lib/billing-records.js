// Billing and consent records Legal needs kept (legal/03-membership-billing-terms.md,
// Appendix D): for every paid start, upgrade, pause, cancellation and refund, who,
// when, the Stripe ids, and the consent that was shown. Kept for the life of the
// membership plus 5 years, so they live outside `events` (trimmed in memory and
// purged on account deletion) and outside `stripeEvents` (a 5000-id dedupe list).
//
// Collections: billingRecords (one doc per billing action, user id and Stripe ids
// only, no email) and retainedRecords (the minimum kept when a paying member
// deletes their account).

const crypto = require('crypto');

const RETAIN_YEARS = 5;
const deps = { db: require('./db'), now: () => Date.now() };

function _setDeps(over) {
  Object.assign(deps, over);
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function emailHash(email) {
  return crypto.createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
}

// Consent the checkout stored on the member (Appendix A2: session id, terms and
// disclosure versions, time, box state, hashed IP). Copied as-is when present.
function consentOf(user) {
  return user.checkoutConsent || null;
}

// kind: start | upgrade | pause | cancel_scheduled | ended | refund
async function record(user, kind, sub, extra = {}) {
  const item = sub && sub.items && sub.items.data && sub.items.data[0];
  const price = item && item.price;
  return deps.db.save('billingRecords', {
    userId: user.id,
    kind,
    at: iso(deps.now()),
    stripeCustomerId: (sub && sub.customer) || user.stripeCustomerId || null,
    subscriptionId: (sub && sub.id) || null,
    priceId: (price && price.id) || null,
    plan: extra.plan || user.tier || null,
    consent: kind === 'start' || kind === 'upgrade' ? consentOf(user) : null,
    ...extra,
  });
}

// Account deletion: everything personal goes, except the minimum needed to show
// what a paying member agreed to and was charged (email hash, Stripe ids, consent
// records, dates). Free members who never had billing leave nothing behind.
async function retainOnDelete(user) {
  const records = deps.db.filter('billingRecords', (r) => r.userId === user.id);
  if (!user.stripeCustomerId && !records.length && !consentOf(user)) return null;
  const now = deps.now();
  const until = new Date(now);
  until.setUTCFullYear(until.getUTCFullYear() + RETAIN_YEARS);
  const subs = new Set(records.map((r) => r.subscriptionId).filter(Boolean));
  if (user.stripeSubscriptionId) subs.add(user.stripeSubscriptionId);
  return deps.db.save('retainedRecords', {
    id: `user-${user.id}`,
    reason: 'account_deleted',
    userId: user.id,
    emailHash: emailHash(user.email),
    stripeCustomerId: user.stripeCustomerId || null,
    subscriptionIds: [...subs],
    tierAtDeletion: user.tier || 'free',
    foundingPrice: !!user.foundingPrice,
    accountCreatedAt: user.createdAt || null,
    subscriptionStartedAt: user.subscriptionStartedAt || null,
    consent: consentOf(user),
    marketingOptIn: !!user.marketingOptIn,
    // Deleting the account ends the membership immediately (Section 15).
    membershipEndedAt: iso(now),
    deletedAt: iso(now),
    retainUntil: until.toISOString(),
  });
}

module.exports = { record, retainOnDelete, emailHash, RETAIN_YEARS, _setDeps };
