// Stripe billing. Membership access is decided only by `user.tier`, which changes
// here from Stripe (verified webhooks, or the API response when a member switches
// plans). Demo billing (instant upgrades, no payment) only runs when
// DEMO_BILLING=true and never in production. AI never changes billing.
//
// Prices are found by lookup key (created by `npm run stripe:setup`), so the only
// required secrets are STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Explicit price
// IDs in env (STRIPE_PRICE_*) still win if set.

const crypto = require('crypto');
const Stripe = require('stripe');
const db = require('./db');
const { emit, sendEmail } = require('./integrations');
const { plan } = require('./plans');
const launch = require('./launch');
const billingEmails = require('./billing-emails');
const reminders = require('./reminders');

const PROD = process.env.NODE_ENV === 'production';

// Shared with scripts/stripe-setup.js.
const LOOKUP = { builder: 'builder_monthly', founding: 'builder_founding_monthly', circle: 'circle_monthly' };
const PRICE_ENV = { builder: 'STRIPE_PRICE_BUILDER', founding: 'STRIPE_PRICE_BUILDER_FOUNDING', circle: 'STRIPE_PRICE_CIRCLE' };
const REFERRAL_COUPON = 'founding-referral';
// Tags Checkout Sessions so this flow can be compared in the Dashboard.
const INTEGRATION_ID = 'membership-checkout-qhzrmvta';
const ACTIVE = ['active', 'trialing', 'past_due'];

let client = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 2,
      appInfo: { name: '127', url: 'https://127group.io' },
    });
  }
  return client;
}
function isLive() {
  return !!process.env.STRIPE_SECRET_KEY;
}
function isDemo() {
  return !isLive() && !PROD && process.env.DEMO_BILLING === 'true';
}
// Stripe Tax only collects where the account has an active registration, so this
// stays off until Eli has added one (see README > Payments).
function taxOn() {
  return process.env.STRIPE_AUTOMATIC_TAX === 'true';
}

class BillingUnavailable extends Error {}

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// ---------- prices ----------

const priceCache = new Map();
async function priceId(s, key) {
  if (process.env[PRICE_ENV[key]]) return process.env[PRICE_ENV[key]];
  const hit = priceCache.get(key);
  if (hit && hit.until > Date.now()) return hit.id;
  const { data } = await s.prices.list({ lookup_keys: [LOOKUP[key]], active: true, limit: 1 });
  const id = data[0] ? data[0].id : null;
  if (id) priceCache.set(key, { id, until: Date.now() + 10 * 60 * 1000 });
  return id;
}

function itemPrice(sub) {
  const item = sub && sub.items && sub.items.data[0];
  return item ? item.price : null;
}
function isFoundingPrice(price) {
  if (!price) return false;
  return price.lookup_key === LOOKUP.founding || (!!process.env[PRICE_ENV.founding] && price.id === process.env[PRICE_ENV.founding]);
}
function tierForSubscription(sub) {
  if (!sub || !ACTIVE.includes(sub.status)) return 'free';
  const price = itemPrice(sub);
  if (price) {
    if (price.lookup_key === LOOKUP.circle || price.id === process.env[PRICE_ENV.circle]) return 'circle';
    if (price.lookup_key === LOOKUP.builder || price.id === process.env[PRICE_ENV.builder] || isFoundingPrice(price)) return 'builder';
  }
  return (sub.metadata && sub.metadata.tier) || 'builder';
}

// ---------- tier changes ----------

async function setTier(user, tier, extra = {}, meta = {}) {
  const before = user.tier;
  Object.assign(user, extra, { tier });
  if (tier === 'circle') user.circleHoldUntil = null;
  if (tier === 'free') user.paymentIssue = null;
  await db.save('users', user);
  if (before !== tier) {
    emit('plan.changed', {
      userId: user.id,
      email: user.email,
      from: before,
      to: tier,
      up: plan(tier).rank > plan(before).rank,
      cancelled: !!meta.cancelled,
      price_id: meta.priceId || null,
      founding_price: !!user.foundingPrice,
      founding_member: launch.isFoundingMember(user),
      demo: !!user.demoBilling,
    });
    // The purchase acknowledgment (lib/billing-emails.js) is the welcome email now.
  }
}

async function syncFromSubscription(user, sub, opts = {}) {
  const deleted = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  const tier = deleted ? 'free' : tierForSubscription(sub);
  const price = itemPrice(sub);
  const extra = { stripeCustomerId: sub.customer, stripeSubscriptionId: tier === 'free' ? null : sub.id, demoBilling: false, subscriptionStatus: sub.status };
  // Cancelling ends the founding price; a later resubscribe pays the current price.
  extra.foundingPrice = tier === 'free' ? false : isFoundingPrice(price);
  if (sub.status === 'active' || sub.status === 'trialing') extra.paymentIssue = null;
  // Founding numbers are handed out once, when a founding membership first starts.
  if (extra.foundingPrice && !user.foundingNumber && ['active', 'trialing'].includes(sub.status)) extra.foundingNumber = await launch.claimFoundingNumber(user);
  Object.assign(extra, opts.extra || {});
  await setTier(user, tier, extra, { cancelled: deleted, priceId: price && price.id });
  await billingEmails.subscriptionSynced(user, sub);
}

async function currentSubscription(s, user) {
  if (!user.stripeSubscriptionId) return null;
  try {
    const sub = await s.subscriptions.retrieve(user.stripeSubscriptionId);
    return ACTIVE.includes(sub.status) ? sub : null;
  } catch {
    return null;
  }
}

// One Stripe customer per member, created up front so every webhook can find them.
// A saved id from the other mode (test vs live) or a deleted customer is replaced.
async function ensureCustomer(s, user) {
  if (user.stripeCustomerId) {
    const existing = await s.customers.retrieve(user.stripeCustomerId).catch((e) => (e.code === 'resource_missing' ? null : Promise.reject(e)));
    if (existing && !existing.deleted) return existing.id;
  }
  const mode = String(process.env.STRIPE_SECRET_KEY).includes('_live_') ? 'live' : 'test';
  const customer = await s.customers.create(
    { email: user.email, name: user.name || undefined, metadata: { userId: user.id } },
    { idempotencyKey: `customer-${mode}-${user.id}-${user.stripeCustomerId || 'new'}` }
  );
  user.stripeCustomerId = customer.id;
  await db.save('users', user);
  return customer.id;
}

// Returns a URL to redirect to. Members who already pay switch plans on their
// existing subscription instead of getting a second one.
async function checkoutUrl(req, user, tier) {
  const s = stripe();
  if (!s) {
    if (!isDemo()) throw new BillingUnavailable('Payments are not switched on yet.');
    await setTier(user, tier, { demoBilling: true });
    return `/app?upgraded=${tier}&demo=1`;
  }
  // Founding members get the founding Builder price while the window is open, plus the
  // referral coupon once enough friends confirmed.
  let founding = tier === 'builder' && launch.isFoundingMember(user) && launch.foundingOpen();
  let price = founding ? await priceId(s, 'founding') : null;
  if (!price) {
    founding = false;
    price = await priceId(s, tier);
  }
  if (!price) throw new BillingUnavailable(`No Stripe price for ${tier}. Run npm run stripe:setup.`);

  const existing = await currentSubscription(s, user);
  if (existing) return switchPlan(s, req, user, existing, tier, price);

  const w = launch.onWaitlist(user.email);
  const earned = founding && w && w.referralCount >= launch.referralsForReward() && !user.referralRewardUsed;
  const coupon = earned ? process.env.STRIPE_COUPON_FOUNDING_REFERRAL || REFERRAL_COUPON : null;
  const customer = await ensureCustomer(s, user);

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    // No payment_method_types: Stripe shows the methods switched on in the Dashboard.
    line_items: [{ price, quantity: 1 }],
    customer,
    client_reference_id: user.id,
    metadata: { userId: user.id, tier, founding: founding ? '1' : '', referral_reward: coupon ? '1' : '' },
    // Flexible billing mode is Stripe's recommended default for new subscriptions.
    subscription_data: { metadata: { userId: user.id, tier }, billing_mode: { type: 'flexible' } },
    // Stripe allows either a fixed discount or the promo-code box, not both.
    ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
    ...(taxOn() ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto', name: 'auto' }, billing_address_collection: 'required' } : {}),
    integration_identifier: INTEGRATION_ID,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${baseUrl(req)}/app?upgraded=${tier}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl(req)}/app/billing`,
  });
  return session.url;
}

// Upgrades are charged now (prorated) and only unlock once that payment succeeds,
// so nobody gets Circle on a card that fails. Downgrades take effect now and the
// unused time is credited to the next invoice.
async function switchPlan(s, req, user, existing, tier, price) {
  const up = plan(tier).rank > plan(user.tier).rank;
  const updated = await s.subscriptions.update(existing.id, {
    items: [{ id: existing.items.data[0].id, price }],
    proration_behavior: up ? 'always_invoice' : 'create_prorations',
    payment_behavior: up ? 'pending_if_incomplete' : 'allow_incomplete',
    metadata: { userId: user.id, tier },
    expand: ['latest_invoice'],
  });
  if (updated.pending_update) {
    // Payment needs the member (3-D Secure or a declined card). Stripe's hosted
    // invoice page handles both; the webhook unlocks the plan once it's paid.
    const inv = updated.latest_invoice;
    if (inv && inv.hosted_invoice_url) return inv.hosted_invoice_url;
    throw new BillingUnavailable('Upgrade payment needs attention.');
  }
  await syncFromSubscription(user, updated);
  return `/app?upgraded=${tier}`;
}

// The success page confirms the session straight away so the member lands unlocked
// even if the webhook is a few seconds behind. The webhook remains the backstop.
async function confirmCheckout(user, sessionId) {
  const s = stripe();
  if (!s || !/^cs_[A-Za-z0-9_]+$/.test(String(sessionId))) return;
  const cs = await s.checkout.sessions.retrieve(sessionId);
  if (cs.client_reference_id !== user.id || !cs.subscription) return;
  if (!['paid', 'no_payment_required'].includes(cs.payment_status)) return;
  const sub = await s.subscriptions.retrieve(cs.subscription);
  if (user.stripeSubscriptionId === sub.id && user.tier === tierForSubscription(sub)) return;
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) {
    await s.subscriptions.cancel(user.stripeSubscriptionId).catch((e) => console.warn('[stripe] old sub cancel', e.message));
  }
  await syncFromSubscription(user, sub, { extra: cs.metadata && cs.metadata.referral_reward ? { referralRewardUsed: true } : {} });
}

async function portalUrl(req, user) {
  const s = stripe();
  if (!s || !user.stripeCustomerId) return null;
  const session = await s.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl(req)}/app/billing`,
    ...(process.env.STRIPE_PORTAL_CONFIGURATION ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION } : {}),
  });
  return session.url;
}

// Used when a member deletes their account.
async function cancelFor(user) {
  const s = stripe();
  if (!s || !user.stripeSubscriptionId) return;
  try {
    await s.subscriptions.cancel(user.stripeSubscriptionId);
  } catch (err) {
    console.error('[stripe] cancel on delete failed', err.message);
    throw err;
  }
}

// ---------- webhooks ----------

const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
]);

function userForCustomer(customerId, fallbackUserId) {
  return db.find('users', (u) => u.stripeCustomerId === customerId) || (fallbackUserId ? db.get('users', fallbackUserId) : null);
}
function invoiceSubscriptionId(inv) {
  const d = inv.parent && inv.parent.subscription_details;
  return (d && d.subscription) || inv.subscription || null;
}

async function handleEvent(s, event) {
  const obj = event.data.object;
  if (event.type === 'customer.subscription.trial_will_end') return reminders.trialWillEnd(obj);

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (!['paid', 'no_payment_required'].includes(obj.payment_status) || !obj.subscription) return;
    const user = db.get('users', obj.client_reference_id || (obj.metadata && obj.metadata.userId));
    if (!user) return;
    const sub = await s.subscriptions.retrieve(obj.subscription);
    // Never leave a member paying for two plans.
    if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) {
      await s.subscriptions.cancel(user.stripeSubscriptionId).catch((e) => console.warn('[stripe] old sub cancel', e.message));
    }
    const extra = {};
    if (obj.metadata && obj.metadata.referral_reward) extra.referralRewardUsed = true;
    await syncFromSubscription(user, sub, { extra });
    return;
  }

  if (event.type.startsWith('customer.subscription.')) {
    const user = userForCustomer(obj.customer, obj.metadata && obj.metadata.userId);
    if (!user) return;
    // Ignore events for subscriptions the member has already replaced.
    if (user.stripeSubscriptionId && user.stripeSubscriptionId !== obj.id) return;
    // Events can arrive out of order, so act on the subscription as it is now.
    const sub = event.type.endsWith('deleted') ? obj : await s.subscriptions.retrieve(obj.id);
    // A new subscription only counts once its first payment went through.
    if (sub.status === 'incomplete') return;
    await syncFromSubscription(user, sub);
    return;
  }

  if (event.type === 'invoice.paid') {
    const user = userForCustomer(obj.customer);
    if (!user) return;
    if (user.paymentIssue) {
      user.paymentIssue = null;
      await db.save('users', user);
    }
    // Unlocks a pending upgrade whose payment needed 3-D Secure or a new card.
    const subId = invoiceSubscriptionId(obj);
    if (subId && (!user.stripeSubscriptionId || user.stripeSubscriptionId === subId)) {
      await syncFromSubscription(user, await s.subscriptions.retrieve(subId));
    }
    emit('invoice.paid', { userId: user.id, amount: obj.amount_paid / 100, currency: obj.currency, invoice: obj.id, billing_reason: obj.billing_reason });
    return;
  }

  if (event.type === 'invoice.payment_failed') {
    const user = userForCustomer(obj.customer);
    if (!user) return;
    // Stripe retries the card on its own schedule (Dashboard > Billing > Revenue recovery).
    // Access stays on while the subscription is past_due and ends if Stripe cancels it.
    user.paymentIssue = { at: new Date().toISOString(), invoiceUrl: obj.hosted_invoice_url || null, attempt: obj.attempt_count || 1 };
    await db.save('users', user);
    emit('invoice.payment_failed', { userId: user.id, amount: obj.amount_due / 100, currency: obj.currency, invoice: obj.id, attempt: obj.attempt_count || 1 });
    if ((obj.attempt_count || 1) === 1) {
      sendEmail({
        to: user.email,
        subject: 'Your 127 payment didn’t go through',
        text: `Your card was declined for your ${plan(user.tier).name} membership. Nothing is lost: update your card here and you're set: ${process.env.BASE_URL || 'https://127group.io'}/app/billing`,
      });
    }
  }
}

// Express handler; must receive the raw body.
async function webhook(req, res) {
  const s = stripe();
  if (!s || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Stripe not configured');
  let event;
  try {
    event = s.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook signature error');
  }
  if (!HANDLED.has(event.type)) return res.json({ received: true, ignored: true });
  // Stripe can deliver an event more than once.
  if (db.get('stripeEvents', event.id)) return res.json({ received: true, duplicate: true });

  try {
    await handleEvent(s, event);
    await db.save('stripeEvents', { id: event.id, type: event.type });
  } catch (err) {
    console.error('[stripe] webhook handling failed', event.type, event.id, err.message);
    return res.status(500).send('error');
  }
  res.json({ received: true });
}

function _setClient(c) {
  client = c;
  priceCache.clear();
}

module.exports = {
  checkoutUrl, confirmCheckout, portalUrl, webhook, setTier, cancelFor, isLive, isDemo, taxOn, BillingUnavailable,
  LOOKUP, REFERRAL_COUPON, tierForSubscription, _setClient,
};
