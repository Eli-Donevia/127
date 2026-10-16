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
const gamify = require('./gamify');

const PROD = process.env.NODE_ENV === 'production';

// Shared with scripts/stripe-setup.js.
const LOOKUP = { builder: 'builder_monthly', founding: 'builder_founding_monthly', circle: 'circle_monthly' };
const PRICE_ENV = { builder: 'STRIPE_PRICE_BUILDER', founding: 'STRIPE_PRICE_BUILDER_FOUNDING', circle: 'STRIPE_PRICE_CIRCLE' };
const REFERRAL_COUPON = 'founding-referral';
const WINBACK_COUPON = 'winback-first-month';
// Tags Checkout Sessions so this flow can be compared in the Dashboard.
const INTEGRATION_ID = 'membership-checkout-qhzrmvta';
const ACTIVE = ['active', 'trialing', 'past_due'];
// Legal pages linked from Checkout. The Circle agreement has no page of its own yet.
const MEMBERSHIP_TERMS_PATH = '/membership-terms';
const CIRCLE_AGREEMENT_PATH = '/circle-agreement'; // Legal: the Founder's Circle Member Agreement page (not built yet)
// Recorded with every paid start and upgrade (Membership Terms, Appendix D).
const TERMS_VERSION = process.env.MEMBERSHIP_TERMS_VERSION || 'draft-2026-10-16';
const DISCLOSURE_VERSION = 'checkout-a2-2026-10-16';

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
const iso = (secs) => (secs ? new Date(secs * 1000).toISOString() : null);

// Consent to Stripe's Terms checkbox needs a Terms URL in Stripe's public details first,
// so it stays off until STRIPE_TERMS_CONSENT=true.
function termsConsentOn() {
  return process.env.STRIPE_TERMS_CONSENT === 'true';
}

// Date of the first charge after a free first month ("December 18, 2026").
function firstChargeDate(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
}

// Founding members whose 3 friends confirmed get their first founding month free, once.
function referralRewardDue(user) {
  const w = launch.onWaitlist(user.email);
  return !!(w && w.referralCount >= launch.referralsForReward() && !user.referralRewardUsed);
}

// A founding price survives plan switches (Legal L5) and ends only when the membership does.
function foundingKept(user) {
  return !!user.foundingNumber && !user.foundingEnded && user.tier !== 'free';
}
// Legal L31: once a founding membership has ended, the founding price isn't offered again,
// even inside the window. Undoing a cancellation before the paid month ends keeps it.
function foundingWindowFor(user) {
  return launch.isFoundingMember(user) && launch.foundingOpen() && !user.foundingEnded;
}

// A founding price restarts the lock; the founding badge comes with the founding number.
function applyFounding(user, extra) {
  if (extra.foundingPrice) extra.foundingEnded = false;
}
function awardFoundingBadge(user, extra) {
  return !!extra.foundingNumber && gamify.award(user, 'founding');
}

// Checkout wording: Legal's Appendix A, with Offer's founding line.
function checkoutCopy(base, tier, founding, dollars, freeUntil) {
  const p = dollars != null ? `$${dollars}` : 'the founding price';
  const docs = tier === 'circle'
    ? `the [Terms of Service](${base}/terms), [Membership Terms](${base}${MEMBERSHIP_TERMS_PATH}) and [Founder's Circle Member Agreement](${base}${CIRCLE_AGREEMENT_PATH})`
    : `the [Terms of Service](${base}/terms) and [Membership Terms](${base}${MEMBERSHIP_TERMS_PATH})`;
  const terms = `I agree to ${docs}. I understand **my membership renews automatically every month at ${p} plus tax until I cancel**, and I can cancel online anytime from Billing.`;
  const submit = freeUntil
    ? `$0 today. Then ${p} a month + tax starting ${freeUntil}, renewing monthly until you cancel. Cancel online in Billing before ${freeUntil} and you won't be charged.`
    : `${founding ? 'Founding price, locked while you stay. ' : ''}Renews monthly at ${p} + tax until you cancel. Cancel online anytime in Billing; you keep access to the end of the month you paid for.${tier === 'circle' ? '' : ' 14 days to change your mind on your first payment.'}`;
  return { terms, submit };
}

// ---------- win-back month (offer.md section 8 J2; Membership Terms section 9) ----------
// A personal signed link, once per person; not after the 14-day refund, an earlier free month,
// or leaving the Circle. No founding price comes back with it.
function winbackSig(userId) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-not-for-production').update(`winback:${userId}`).digest('base64url');
}
function verifyWinback(userId, sig) {
  const a = Buffer.from(winbackSig(String(userId || '')));
  const b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function winbackEligible(user) {
  if (!user || user.tier !== 'free') return false;
  const last = (user.cancellations || []).slice(-1)[0];
  const paidBefore = !!(user.firstPaidAt || last);
  return paidBefore && !(last && last.plan === 'circle') && !user.refundedFirstPayment && !user.referralRewardUsed && !user.winbackUsed;
}
// Klaviyo profile properties for the win-back email (J2).
function winbackProfile(user) {
  const eligible = winbackEligible(user);
  return {
    winback_eligible: eligible,
    winback_url: eligible ? `${process.env.BASE_URL || 'https://127group.io'}/winback?u=${encodeURIComponent(user.id)}&t=${winbackSig(user.id)}` : null,
  };
}

// ---------- founding grace link (checkout.md section 1, research R14, billing terms §4, Legal L41) ----------
// For a founding checkout that started while spots were open and before the close and then broke on
// our side (never for a card decline), support sends one signed link per person. It works once and
// expires 3 days after it's issued, since support answers within 2 business days of the close.
const GRACE_DAYS = 3;
function hmac(text) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-not-for-production').update(text).digest('base64url');
}
function graceUntil(from = Date.now()) {
  return from + GRACE_DAYS * 24 * 60 * 60 * 1000;
}
function graceToken(email) {
  const until = graceUntil();
  const body = Buffer.from(JSON.stringify({ e: String(email).trim().toLowerCase(), x: until })).toString('base64url');
  return `${body}.${hmac(`grace:${body}`)}`;
}
// Returns { email, until } for a valid, unexpired, unspent token, otherwise null.
function verifyGrace(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(hmac(`grace:${body}`));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || !data.e || !(data.x > Date.now())) return null;
  const owner = db.find('users', (u) => u.email === data.e);
  if (owner && owner.graceUsedAt) return null;
  return { email: data.e, until: data.x };
}
function graceFor(user, token) {
  const g = verifyGrace(token);
  return g && user && g.email === user.email ? g : null;
}

// ---------- referral reward for a referrer who already pays (research R13) ----------
// Called when a paying member's referrals reach the reward: a flat founding-price credit ($19,
// Legal L32, Circle members included) goes onto their Stripe customer balance instead of the
// free-month coupon. Safe to call more than once.
// Support's check before issuing a grace link: one per person; the founding checkout record, if any.
function graceCheck(email) {
  const e = String(email || '').trim().toLowerCase();
  const user = db.find('users', (u) => u.email === e);
  const issued = db.get('counters', `grace:${crypto.createHash('sha256').update(e).digest('hex').slice(0, 32)}`);
  return { user: user || null, issuedAt: issued ? issued.createdAt : null, startedAt: (user && user.foundingCheckoutStartedAt) || null, usedAt: (user && user.graceUsedAt) || null };
}
async function issueGrace(email) {
  const e = String(email || '').trim().toLowerCase();
  const check = graceCheck(e);
  if (check.issuedAt || check.usedAt) return { ...check, token: null, reason: 'already_issued' };
  const token = graceToken(e);
  await db.save('counters', { id: `grace:${crypto.createHash('sha256').update(e).digest('hex').slice(0, 32)}`, count: 1 });
  return { ...check, token, until: verifyGrace(token).until };
}

async function rewardPayingReferrer(email) {
  const user = db.find('users', (u) => u.email === String(email || '').trim().toLowerCase());
  if (!user || user.tier === 'free') return { credited: false, reason: 'not_paying' };
  if (user.referralRewardUsed || user.referralCredit) return { credited: false, reason: 'already_rewarded' };
  const w = launch.onWaitlist(user.email);
  if (!w || (w.referralCount || 0) < launch.referralsForReward()) return { credited: false, reason: 'not_earned' };
  const dollars = launch.view().foundingPrice || 19;
  const s = stripe();
  let txn = null;
  if (s && user.stripeCustomerId) {
    txn = await s.customers.createBalanceTransaction(
      user.stripeCustomerId,
      { amount: -Math.round(dollars * 100), currency: 'usd', description: 'Founding referral reward', metadata: { userId: user.id, reward: 'founding-referral' } },
      { idempotencyKey: `referral-credit-${user.id}` }
    );
  } else if (!user.demoBilling) {
    return { credited: false, reason: 'no_customer' };
  }
  user.referralCredit = { at: new Date().toISOString(), amount: dollars, transaction: txn ? txn.id : null };
  user.referralRewardUsed = true;
  await db.save('users', user);
  emit('referral.credit_applied', { userId: user.id, amount: dollars, plan: user.tier });
  return { credited: true, amount: dollars };
}

// Fields saved when a Checkout Session completes.
function completionExtra(user, cs) {
  const extra = { consents: consentRecord(user, cs) };
  const shown = user.lastCheckout && user.lastCheckout.session === cs.id ? user.lastCheckout : null;
  // lib/billing-records.js keeps this field.
  extra.checkoutConsent = {
    at: new Date().toISOString(),
    version: (cs.metadata && cs.metadata.terms_version) || TERMS_VERSION,
    disclosure_version: (cs.metadata && cs.metadata.disclosure_version) || DISCLOSURE_VERSION,
    plan: (cs.metadata && cs.metadata.tier) || (shown && shown.plan) || null,
    text: shown ? shown.text : null,
    terms_of_service: (cs.consent && cs.consent.terms_of_service) || null,
    session: cs.id || null,
  };
  if (cs.metadata && cs.metadata.referral_reward) extra.referralRewardUsed = true;
  if (cs.metadata && cs.metadata.winback) extra.winbackUsed = true;
  if (cs.metadata && cs.metadata.grace) extra.graceUsedAt = new Date().toISOString();
  return extra;
}

function consentRecord(user, cs) {
  const entry = {
    kind: 'checkout', at: new Date().toISOString(), session: cs.id || null,
    terms_of_service: (cs.consent && cs.consent.terms_of_service) || null,
    terms_version: (cs.metadata && cs.metadata.terms_version) || TERMS_VERSION,
    disclosure_version: (cs.metadata && cs.metadata.disclosure_version) || DISCLOSURE_VERSION,
    ip_hash: (user.lastCheckout && user.lastCheckout.session === cs.id && user.lastCheckout.ipHash) || null,
  };
  return [...(user.consents || []).filter((c) => !cs.id || c.session !== cs.id), entry].slice(-50);
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
function periodEnd(sub) {
  const item = sub && sub.items && sub.items.data[0];
  return (item && item.current_period_end) || (sub && sub.current_period_end) || null;
}
// When a scheduled cancellation takes effect, or null.
function cancelAtOf(sub) {
  if (sub.cancel_at) return iso(sub.cancel_at);
  return sub.cancel_at_period_end ? iso(periodEnd(sub)) : null;
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
  if (tier === 'free' && user.foundingNumber) extra.foundingEnded = true;
  applyFounding(user, extra);
  extra.periodEnd = tier === 'free' ? null : iso(periodEnd(sub));
  extra.cancelAt = tier === 'free' ? null : cancelAtOf(sub);
  if (sub.status === 'active' || sub.status === 'trialing') extra.paymentIssue = null;
  // Founding numbers are handed out once, when a founding membership first starts.
  if (extra.foundingPrice && !user.foundingNumber && ['active', 'trialing'].includes(sub.status)) extra.foundingNumber = await launch.claimFoundingNumber(user);
  const newBadge = awardFoundingBadge(user, extra);
  Object.assign(extra, opts.extra || {});
  await setTier(user, tier, extra, { cancelled: deleted, priceId: price && price.id });
  if (newBadge) emit('badge.earned', { userId: user.id, badge: 'founding', level: gamify.level(user.xp || 0).name });
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
// opts.from: the app path the member started from; cancelling Stripe returns there.
async function checkoutUrl(req, user, tier, opts = {}) {
  const s = stripe();
  // opts.grace: a founding grace token (R14) that lets this member's email in after the close.
  const window = tier === 'builder' && (foundingWindowFor(user) || (!user.foundingEnded && !!graceFor(user, opts.grace)));
  const kept = tier === 'builder' && foundingKept(user);
  if (!s) {
    if (!isDemo()) throw new BillingUnavailable('Payments are not switched on yet.');
    const extra = { demoBilling: true, foundingPrice: !!((window && launch.view().foundingPrice) || kept) };
    if (extra.foundingPrice && !kept && !foundingWindowFor(user)) extra.graceUsedAt = new Date().toISOString();
    applyFounding(user, extra);
    if (extra.foundingPrice && !user.foundingNumber) extra.foundingNumber = await launch.claimFoundingNumber(user);
    awardFoundingBadge(user, extra);
    await setTier(user, tier, extra);
    return extra.foundingPrice && !kept ? '/app/welcome?founding=1&demo=1' : `/app?upgraded=${tier}&demo=1`;
  }
  // Founding members get the founding Builder price while the window is open (and keep it
  // through plan switches), plus the referral coupon once enough friends confirmed.
  const winback = tier === 'builder' && !!opts.winback && winbackEligible(user);
  let founding = !winback && (window || kept);
  let price = founding ? await priceId(s, 'founding') : null;
  if (!price) {
    founding = false;
    price = await priceId(s, tier);
  }
  if (!price) throw new BillingUnavailable(`No Stripe price for ${tier}. Run npm run stripe:setup.`);

  const existing = await currentSubscription(s, user);
  if (existing) return switchPlan(s, req, user, existing, tier, price);

  const earned = founding && referralRewardDue(user);
  const coupon = winback ? process.env.STRIPE_COUPON_WINBACK || WINBACK_COUPON : earned ? process.env.STRIPE_COUPON_FOUNDING_REFERRAL || REFERRAL_COUPON : null;
  const customer = await ensureCustomer(s, user);
  const base = baseUrl(req);
  const dollars = founding ? launch.view().foundingPrice : plan(tier).price;
  const copy = checkoutCopy(base, tier, founding, dollars, coupon ? firstChargeDate() : null);
  const from = opts.from || '/app/billing';

  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    // No payment_method_types: Stripe shows the methods switched on in the Dashboard.
    line_items: [{ price, quantity: 1 }],
    customer,
    client_reference_id: user.id,
    metadata: { userId: user.id, tier, founding: founding ? '1' : '', referral_reward: earned && coupon ? '1' : '', winback: winback ? '1' : '', grace: founding && !foundingWindowFor(user) && !kept ? '1' : '', terms_version: TERMS_VERSION, disclosure_version: DISCLOSURE_VERSION },
    // Flexible billing mode is Stripe's recommended default for new subscriptions.
    subscription_data: { metadata: { userId: user.id, tier }, billing_mode: { type: 'flexible' } },
    // No public promo codes (decision O11): discounts only come from signed links.
    ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: false }),
    ...(termsConsentOn() ? { consent_collection: { terms_of_service: 'required' } } : {}),
    custom_text: {
      submit: { message: copy.submit },
      ...(termsConsentOn() ? { terms_of_service_acceptance: { message: copy.terms } } : {}),
    },
    ...(taxOn() ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto', name: 'auto' }, billing_address_collection: 'required' } : {}),
    integration_identifier: INTEGRATION_ID,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: founding
      ? `${base}/app/welcome?founding=1&session_id={CHECKOUT_SESSION_ID}`
      : `${base}/app?upgraded=${tier}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${from}${from.includes('?') ? '&' : '?'}checkout=cancelled`,
  });
  // What the member saw at the pay button, kept for the consent record (Appendix A2 and D).
  user.lastCheckout = { session: session.id || null, at: new Date().toISOString(), ipHash: opts.ipHash || null, plan: tier, founding: !!founding, text: termsConsentOn() ? `${copy.terms}\n${copy.submit}` : copy.submit };
  // A founding checkout started while spots were open and before the close is honored even past 100 (billing terms §4).
  if (founding && foundingWindowFor(user)) user.foundingCheckoutStartedAt = user.lastCheckout.at;
  await db.save('users', user);
  // Klaviyo "Started Checkout": the abandoned-checkout email goes about an hour later, after the
  // 30-minute Stripe session has expired, so checkout_url is a link back into the app that opens a fresh one.
  emit('checkout.started', {
    userId: user.id, plan: tier, founding, price: dollars, free_month: !!coupon,
    checkout_url: `${base}${founding ? '/founding/lock' : tier === 'circle' ? '/app/circle' : '/app/billing'}`,
    stripe_checkout_url: session.url,
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
  await syncFromSubscription(user, sub, { extra: completionExtra(user, cs) });
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

// Re-reads the member's subscription (after the portal, or to show the period end).
async function refreshSubscription(user) {
  const s = stripe();
  if (!s || !user.stripeSubscriptionId) return;
  const sub = await currentSubscription(s, user);
  if (sub) await syncFromSubscription(user, sub);
}

// In-app cancel (Membership Terms section 10, Appendix C): one tap, takes effect at the
// end of the paid month. Returns when access ends (ISO), or null in demo mode.
async function cancelAtPeriodEnd(user) {
  const s = stripe();
  if (!s) {
    if (!isDemo()) throw new BillingUnavailable('Payments are not switched on yet.');
    await setTier(user, 'free', {}, { cancelled: true });
    return null;
  }
  const sub = await currentSubscription(s, user);
  if (!sub) throw new BillingUnavailable('No active subscription to cancel.');
  const updated = await s.subscriptions.update(sub.id, { cancel_at_period_end: true });
  await syncFromSubscription(user, updated);
  emit('subscription.cancel_scheduled', { userId: user.id, plan: user.tier, access_ends: user.cancelAt, founding_price: !!user.foundingPrice });
  // Hook: cancellation confirmation email (lib/billing-emails.js).
  return user.cancelAt;
}

// "Keep Builder": undoes a scheduled cancellation, with no new charge.
async function resumeSubscription(user) {
  const s = stripe();
  if (!s) return false;
  const sub = await currentSubscription(s, user);
  if (!sub) return false;
  const params = sub.cancel_at_period_end ? { cancel_at_period_end: false } : sub.cancel_at ? { cancel_at: '' } : null;
  const updated = params ? await s.subscriptions.update(sub.id, params) : sub;
  await syncFromSubscription(user, updated);
  return true;
}

// Amount charged today for moving up (shown before the Circle upgrade, Appendix A3).
async function previewUpgrade(user, tier) {
  const s = stripe();
  if (!s) return null;
  const sub = await currentSubscription(s, user);
  const price = sub && (await priceId(s, tier));
  if (!sub || !price) return null;
  const inv = await s.invoices.createPreview({
    customer: sub.customer,
    subscription: sub.id,
    subscription_details: { items: [{ id: sub.items.data[0].id, price }], proration_behavior: 'always_invoice' },
  });
  return { dueToday: inv.amount_due / 100, currency: inv.currency };
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
  'customer.source.expiring',
  'charge.refunded',
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
    await syncFromSubscription(user, sub, { extra: completionExtra(user, obj) });
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
    const recovered = !!user.paymentIssue;
    if (user.paymentIssue) {
      user.paymentIssue = null;
      await db.save('users', user);
    }
    // Unlocks a pending upgrade whose payment needed 3-D Secure or a new card.
    const subId = invoiceSubscriptionId(obj);
    if (subId && (!user.stripeSubscriptionId || user.stripeSubscriptionId === subId)) {
      await syncFromSubscription(user, await s.subscriptions.retrieve(subId));
    }
    // Starts the 14-day window on the first paid Builder charge.
    if (obj.amount_paid > 0 && user.tier === 'builder' && !user.firstPaidAt) {
      user.firstPaidAt = new Date().toISOString();
      await db.save('users', user);
    }
    emit('invoice.paid', { userId: user.id, amount: obj.amount_paid / 100, currency: obj.currency, invoice: obj.id, billing_reason: obj.billing_reason });
    if (recovered) emit('payment.recovered', { userId: user.id, amount: obj.amount_paid / 100, currency: obj.currency, invoice: obj.id, plan: user.tier });
    return;
  }

  if (event.type === 'invoice.payment_failed') {
    const user = userForCustomer(obj.customer);
    if (!user) return;
    // Stripe retries the card on its own schedule (Dashboard > Billing > Revenue recovery).
    // Access stays on while the subscription is past_due and ends if Stripe cancels it.
    user.paymentIssue = { at: new Date().toISOString(), invoiceUrl: obj.hosted_invoice_url || null, attempt: obj.attempt_count || 1, retryAt: iso(obj.next_payment_attempt) };
    await db.save('users', user);
    emit('invoice.payment_failed', {
      userId: user.id, amount: obj.amount_due / 100, currency: obj.currency, invoice: obj.id, attempt: obj.attempt_count || 1,
      attempt_count: obj.attempt_count || 1, hosted_invoice_url: obj.hosted_invoice_url || null, next_payment_attempt: iso(obj.next_payment_attempt),
      plan: user.tier, founding_price: !!user.foundingPrice,
    });
    if ((obj.attempt_count || 1) === 1) {
      sendEmail({
        to: user.email,
        subject: 'Your 127 payment didn’t go through',
        text: `Your card was declined for your ${plan(user.tier).name} membership. Nothing is lost: update your card here and you're set: ${process.env.BASE_URL || 'https://127group.io'}/app/billing`,
      });
    }
    return;
  }

  // Refunds are issued from the Stripe Dashboard for now. A full refund blocks the win-back month.
  if (event.type === 'charge.refunded') {
    const user = userForCustomer(obj.customer);
    if (!user) return;
    if (obj.refunded && !user.refundedFirstPayment) {
      user.refundedFirstPayment = true;
      await db.save('users', user);
    }
    const refund = obj.refunds && obj.refunds.data && obj.refunds.data[0];
    const card = obj.payment_method_details && obj.payment_method_details.card;
    await billingEmails.refundConfirmation(user, {
      refundId: (refund && refund.id) || obj.id, amount: obj.amount_refunded / 100, cardLast4: card ? card.last4 : null,
      founding: !!user.foundingPrice, membershipEnded: user.tier === 'free' || !!user.cancelAt,
    });
    return;
  }

  // Sent for cards that expire at the end of the month (Klaviyo "Card Expiring").
  if (event.type === 'customer.source.expiring') {
    const card = obj.object === 'payment_method' ? obj.card || {} : obj;
    const user = userForCustomer(obj.customer);
    if (!user || user.tier === 'free') return;
    emit('card.expiring', {
      userId: user.id, plan: user.tier, brand: card.brand || null, last4: card.last4 || null,
      exp_month: card.exp_month || null, exp_year: card.exp_year || null,
      billing_url: `${process.env.BASE_URL || 'https://127group.io'}/app/billing`,
    });
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
  refreshSubscription, cancelAtPeriodEnd, resumeSubscription, previewUpgrade,
  firstChargeDate, referralRewardDue, foundingKept, termsConsentOn, winbackProfile, winbackEligible, verifyWinback,
  graceToken, verifyGrace, graceFor, graceUntil, graceCheck, issueGrace, rewardPayingReferrer,
  LOOKUP, REFERRAL_COUPON, WINBACK_COUPON, HANDLED, MEMBERSHIP_TERMS_PATH, CIRCLE_AGREEMENT_PATH, TERMS_VERSION, tierForSubscription, _setClient,
};
