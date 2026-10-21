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
  return !!user.foundingNumber && !user.foundingEnded && (user.tier !== 'free' || !!user.pausedTier);
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
  if (!user || user.tier !== 'free' || (user.pause && !user.pause.endedAt)) return false;
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

// meta.paused / meta.resumed: the move to Free at the start of a pause and back at its end. They
// aren't plan changes, so they stay out of planHistory and don't count as a cancellation.
async function setTier(user, tier, extra = {}, meta = {}) {
  const before = user.tier;
  Object.assign(user, extra, { tier });
  if (tier === 'circle') user.circleHoldUntil = null;
  if (tier === 'free' && !meta.paused) user.paymentIssue = null;
  // Member-ops billing facts (ops/members/site-changes/SPEC.md section 4).
  if (before !== tier && !meta.paused && !meta.resumed) {
    const at = new Date().toISOString();
    const from = before || 'free';
    user.planHistory = [...(user.planHistory || []), { at, tier, from, to: tier }].slice(-20);
    user.tierSince = at;
    if (from === 'free' && tier !== 'free') user.paidSince = at;
    if (tier === 'free') user.canceledAt = at;
  }
  await db.save('users', user);
  if (before !== tier) {
    emit('plan.changed', {
      paused: !!meta.paused,
      resumed: !!meta.resumed,
      resumes_at: meta.paused && user.pause ? user.pause.resumesAt : null,
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
  const now = Date.now();
  const deleted = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  const planTier = deleted ? 'free' : tierForSubscription(sub);
  const lapsed = planTier === 'free';
  settlePause(user, sub, planTier, now);
  // While a pause is in effect the member is treated as Free, but keeps the subscription and price.
  const paused = !lapsed && pauseInEffect(user, now);
  const tier = paused ? 'free' : planTier;
  const wasPausedTier = user.pausedTier || null;
  const wasScheduled = !!user.cancelAtPeriodEnd;
  const price = itemPrice(sub);
  const extra = { stripeCustomerId: sub.customer, stripeSubscriptionId: lapsed ? null : sub.id, demoBilling: false, subscriptionStatus: sub.status };
  // Cancelling ends the founding price; a later resubscribe pays the current price.
  extra.foundingPrice = lapsed ? false : isFoundingPrice(price);
  if (lapsed && user.foundingNumber) extra.foundingEnded = true;
  applyFounding(user, extra);
  extra.periodEnd = lapsed ? null : iso(periodEnd(sub));
  extra.cancelAt = lapsed ? null : cancelAtOf(sub);
  extra.cancelAtPeriodEnd = !lapsed && !!(sub.cancel_at_period_end || sub.cancel_at);
  extra.currentPeriodEnd = extra.periodEnd;
  if (sub.billing_cycle_anchor) extra.billingAnchor = iso(sub.billing_cycle_anchor);
  extra.pausedTier = paused ? planTier : null;
  if (sub.status === 'active' || sub.status === 'trialing') extra.paymentIssue = null;
  // Founding numbers are handed out once, when a founding membership first starts.
  if (extra.foundingPrice && !user.foundingNumber && ['active', 'trialing'].includes(sub.status)) extra.foundingNumber = await launch.claimFoundingNumber(user);
  const newBadge = awardFoundingBadge(user, extra);
  Object.assign(extra, opts.extra || {});
  const before = user.tier;
  await setTier(user, tier, extra, {
    cancelled: deleted,
    priceId: price && price.id,
    paused: paused && before !== 'free',
    resumed: !!wasPausedTier && !paused && tier !== 'free',
  });
  if (extra.cancelAtPeriodEnd && !wasScheduled) emit('subscription.cancel_scheduled', { userId: user.id, plan: planTier, access_ends: extra.cancelAt, founding_price: !!extra.foundingPrice });
  if (!extra.cancelAtPeriodEnd && wasScheduled && !lapsed) emit('subscription.cancel_reverted', { userId: user.id, plan: planTier, founding_price: !!extra.foundingPrice });
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
  const paidTier = user.pausedTier || user.tier;
  const up = plan(tier).rank > plan(paidTier).rank;
  // Changing plans ends a pause (scheduled or running), so a prorated charge is never voided.
  const pausing = !!existing.pause_collection || !!(user.pause && !user.pause.endedAt);
  const updated = await s.subscriptions.update(existing.id, {
    ...(existing.pause_collection ? { pause_collection: '' } : {}),
    items: [{ id: existing.items.data[0].id, price }],
    proration_behavior: up ? 'always_invoice' : 'create_prorations',
    payment_behavior: up ? 'pending_if_incomplete' : 'allow_incomplete',
    metadata: { userId: user.id, tier },
    expand: ['latest_invoice'],
  });
  if (pausing) endPause(user, 'plan_change', Date.now(), true);
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
  // A pause that hasn't started yet is dropped (and its voided renewal with it); during a pause the
  // plan simply ends when the paused month does, with no charge.
  const p = user.pause && !user.pause.endedAt ? user.pause : null;
  const dropPause = !!p && Date.now() < ms(p.scheduledFor);
  const updated = await s.subscriptions.update(sub.id, dropPause ? { cancel_at_period_end: true, pause_collection: '' } : { cancel_at_period_end: true });
  if (dropPause) endPause(user, 'cancelled', Date.now(), true);
  // syncFromSubscription emits subscription.cancel_scheduled; billing-emails sends the confirmation.
  await syncFromSubscription(user, updated);
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

// ---------- pause (conversion/offer.md section 8, Membership Terms section 8) ----------
// Builder only, once every 6 months, one billing month. The member keeps every day they paid
// for: the pause starts when the paid month ends (`scheduledFor`) and the plan restarts on the
// next renewal date (`resumesAt`), at the same price (a founding price included).
//
// Stripe: pause_collection { behavior: 'void', resumes_at: period end + 1 day } is set when the
// member asks. Pausing collection never changes access, so setting it early is safe, and it
// means the one renewal invoice created at the period end is voided even if this server is down
// that day. resumes_at is period end + 1 day (not + 30 days, which would void two invoices when
// the paused month is February); the next renewal, a month after the period end, is charged.
// While the pause is in effect the app treats the member as Free (syncFromSubscription), and the
// 6-hourly reminders job flips them at the start and the end (pauseTick) and sends the restart
// reminder 5 days before resumesAt (lib/reminders.js).
const DAY_MS = 24 * 60 * 60 * 1000;
const PAUSE_EVERY_MONTHS = 6;
const PAUSE_REFUSALS = {
  not_builder: 'Only Builder can be paused.',
  circle: "The Founder's Circle can't be paused. You can switch to Builder instead.",
  already: 'Your plan is already paused.',
  cancelled: 'Your plan is already cancelled.',
  payment: 'Update your card first, then you can pause.',
  recent: 'You can pause once every 6 months.',
};

function ms(v) {
  if (v == null || v === '') return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
function addMonthsMs(t, n) {
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.getTime();
}
// The renewal after `endSec` (seconds) for a monthly plan, following Stripe's anchor day
// (an anchor on the 31st renews on the last day of shorter months).
function nextPeriodEnd(endSec, anchorSec) {
  const e = new Date(endSec * 1000);
  const anchorDay = anchorSec ? new Date(anchorSec * 1000).getUTCDate() : e.getUTCDate();
  const y = e.getUTCFullYear();
  const m = e.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Math.floor(Date.UTC(y, m, Math.min(anchorDay, daysInMonth), e.getUTCHours(), e.getUTCMinutes(), e.getUTCSeconds()) / 1000);
}

function activePause(user) {
  return user && user.pause && !user.pause.endedAt ? user.pause : null;
}
// Paused right now: the paid month has ended and the plan hasn't restarted.
function pauseInEffect(user, now = Date.now()) {
  const p = activePause(user);
  return !!p && now >= ms(p.scheduledFor) && now < ms(p.resumesAt);
}
function endPause(user, reason, now = Date.now(), unrecordIfUnstarted = false) {
  const p = activePause(user);
  if (!p) return;
  const started = now >= ms(p.scheduledFor);
  p.endedAt = new Date(now).toISOString();
  p.endedReason = reason;
  // A pause dropped before it began never happened, so it doesn't use up the once-in-6-months.
  if (!started && unrecordIfUnstarted) user.pauses = (user.pauses || []).filter((x) => x.requestedAt !== p.requestedAt);
}

// Keeps user.pause in step with the subscription (called on every sync).
function settlePause(user, sub, planTier, now) {
  const p = activePause(user);
  if (!p) return;
  if (p.subscriptionId && sub.id && p.subscriptionId !== sub.id) return endPause(user, 'replaced', now);
  if (planTier === 'free') return endPause(user, 'ended', now);
  if (planTier !== (p.tier || 'builder')) return endPause(user, 'plan_change', now);
  const sched = ms(p.scheduledFor);
  // Removed in the Stripe Dashboard before it began: Stripe is the source of truth for billing.
  if (!p.demo && now < sched && !sub.pause_collection) return endPause(user, 'removed_in_stripe', now, true);
  const pe = (periodEnd(sub) || 0) * 1000;
  const restarted = now >= ms(p.resumesAt) || pe > sched + 32 * DAY_MS;
  if (restarted) {
    if (!p.startedAt) p.startedAt = new Date(sched).toISOString();
    return endPause(user, 'restarted', now);
  }
  // Inside the paused month Stripe knows the real restart date: this period's end.
  if (pe > sched + DAY_MS) p.resumesAt = new Date(pe).toISOString();
  if (!p.startedAt && now >= sched) p.startedAt = new Date(now).toISOString();
}

// Whether this member can pause now, and if not, why (a PAUSE_REFUSALS key).
function pauseEligible(user, now = Date.now()) {
  if (activePause(user)) return { ok: false, reason: 'already' };
  if (!user || user.tier !== 'builder') return { ok: false, reason: user && user.tier === 'circle' ? 'circle' : 'not_builder' };
  if (user.cancelAt) return { ok: false, reason: 'cancelled' };
  if (user.paymentIssue || (user.subscriptionStatus && user.subscriptionStatus !== 'active')) return { ok: false, reason: 'payment' };
  const last = (user.pauses || []).map((x) => ms(x.requestedAt)).filter(Boolean).sort((a, b) => a - b).pop();
  if (last && now < addMonthsMs(last, PAUSE_EVERY_MONTHS)) return { ok: false, reason: 'recent', nextAt: new Date(addMonthsMs(last, PAUSE_EVERY_MONTHS)).toISOString() };
  return { ok: true };
}

// The two dates the cancel screen shows before the member taps Pause (ms), or null.
function pausePreview(user) {
  const end = ms(user && user.periodEnd);
  if (!end) return null;
  const anchor = ms(user.billingAnchor);
  return { pausesAt: end, restartAt: nextPeriodEnd(Math.floor(end / 1000), anchor ? Math.floor(anchor / 1000) : null) * 1000 };
}

// "Pause for a month" on the cancel screen. Returns user.pause.
async function pauseAtPeriodEnd(user) {
  const ok = pauseEligible(user);
  if (!ok.ok) throw new BillingUnavailable(PAUSE_REFUSALS[ok.reason]);
  const s = stripe();
  const now = Date.now();
  const at = new Date(now).toISOString();
  if (!s) {
    if (!isDemo()) throw new BillingUnavailable('Payments are not switched on yet.');
    // Demo billing has no paid month to finish, so the pause starts now.
    const restart = nextPeriodEnd(Math.floor(now / 1000)) * 1000;
    user.pause = { requestedAt: at, scheduledFor: at, startedAt: at, resumesAt: new Date(restart).toISOString(), subscriptionId: null, tier: 'builder', endedAt: null, endedReason: null, demo: true };
    user.pauses = [...(user.pauses || []), { requestedAt: at, scheduledFor: at, resumesAt: user.pause.resumesAt }].slice(-10);
    await setTier(user, 'free', { pausedTier: 'builder' }, { paused: true });
    return user.pause;
  }
  const sub = await currentSubscription(s, user);
  if (!sub || sub.status !== 'active') throw new BillingUnavailable('No active subscription to pause.');
  if (sub.cancel_at_period_end || sub.cancel_at) throw new BillingUnavailable(PAUSE_REFUSALS.cancelled);
  if (tierForSubscription(sub) !== 'builder') throw new BillingUnavailable(PAUSE_REFUSALS.circle);
  const end = periodEnd(sub);
  if (!end || end * 1000 <= now) throw new BillingUnavailable('No active subscription to pause.');
  const restart = nextPeriodEnd(end, sub.billing_cycle_anchor);
  const updated = await s.subscriptions.update(sub.id, {
    pause_collection: { behavior: 'void', resumes_at: end + 24 * 60 * 60 },
    metadata: { pause_starts_at: String(end), pause_restart_at: String(restart) },
  });
  user.pause = {
    requestedAt: at, scheduledFor: iso(end), startedAt: null, resumesAt: iso(restart), stripeResumesAt: iso(end + 24 * 60 * 60),
    subscriptionId: sub.id, tier: 'builder', endedAt: null, endedReason: null,
  };
  user.pauses = [...(user.pauses || []), { requestedAt: at, scheduledFor: user.pause.scheduledFor, resumesAt: user.pause.resumesAt }].slice(-10);
  await syncFromSubscription(user, updated);
  await billingEmails.pauseConfirmation(user, { subscriptionId: sub.id, restartAt: restart * 1000, pausesAt: end * 1000 });
  emit('subscription.pause_scheduled', { userId: user.id, plan: 'builder', pauses_at: user.pause.scheduledFor, resumes_at: user.pause.resumesAt, founding_price: !!user.foundingPrice });
  return user.pause;
}

// "Resume now": ends a scheduled or running pause. Builder unlocks right away; the next charge
// is the current period's end (shown before the member confirms). Returns false if not paused.
async function resumePause(user) {
  const p = activePause(user);
  if (!p) return false;
  const s = stripe();
  const now = Date.now();
  const reason = now >= ms(p.scheduledFor) ? 'resumed' : 'unscheduled';
  if (!s || p.demo) {
    endPause(user, reason, now, true);
    await setTier(user, p.tier || 'builder', { pausedTier: null }, { resumed: user.tier === 'free' });
    return true;
  }
  const sub = await s.subscriptions.retrieve(p.subscriptionId || user.stripeSubscriptionId);
  const updated = sub && sub.pause_collection ? await s.subscriptions.update(sub.id, { pause_collection: '' }) : sub;
  endPause(user, reason, now, true);
  if (updated) await syncFromSubscription(user, updated);
  else await db.save('users', user);
  emit('subscription.pause_ended', { userId: user.id, plan: p.tier || 'builder', reason, next_charge_at: user.periodEnd || null });
  return true;
}

// Called by the 6-hourly reminders job for every member with a pause: flips them to Free when
// the paid month ends and back when the plan restarts. Returns 'started', 'restarted' or null.
async function pauseTick(user, now = Date.now()) {
  const p = activePause(user);
  if (!p) return null;
  const before = user.tier;
  const s = stripe();
  if (!s || p.demo) {
    if (now >= ms(p.resumesAt)) {
      endPause(user, 'restarted', now);
      await setTier(user, p.tier || 'builder', { pausedTier: null }, { resumed: true });
    } else if (now >= ms(p.scheduledFor) && before !== 'free') {
      if (!p.startedAt) p.startedAt = new Date(now).toISOString();
      await setTier(user, 'free', { pausedTier: p.tier || 'builder' }, { paused: true });
    } else return null;
  } else {
    const sub = await s.subscriptions.retrieve(p.subscriptionId || user.stripeSubscriptionId).catch(() => null);
    if (!sub) return null;
    await syncFromSubscription(user, sub);
  }
  if (before !== user.tier) return user.tier === 'free' ? 'started' : 'restarted';
  return null;
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

// Close for age (Legal L42): cancel the subscription now and refund every payment the account
// ever made, in full, to the original card. Returns { refunds: [ids], total (dollars) }.
async function refundAllAndCancel(user) {
  const s = stripe();
  const refunds = [];
  let cents = 0;
  if (!s) return { refunds, total: 0 };
  if (user.stripeSubscriptionId) {
    await s.subscriptions.cancel(user.stripeSubscriptionId).catch((e) => {
      if (e.code !== 'resource_missing') throw e;
    });
  }
  if (!user.stripeCustomerId) return { refunds, total: 0 };
  let startingAfter = null;
  for (let page = 0; page < 20; page++) {
    const list = await s.charges.list({ customer: user.stripeCustomerId, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
    for (const ch of list.data || []) {
      const left = (ch.amount || 0) - (ch.amount_refunded || 0);
      if (ch.status !== 'succeeded' || !ch.paid || left <= 0) continue;
      const r = await s.refunds.create(
        { charge: ch.id, amount: left, reason: 'requested_by_customer', metadata: { kind: 'other', reason: 'under_18' } },
        { idempotencyKey: `age-refund-${ch.id}-${left}` }
      );
      refunds.push(r.id);
      cents += left;
    }
    if (!list.has_more || !list.data.length) break;
    startingAfter = list.data[list.data.length - 1].id;
  }
  return { refunds, total: cents / 100 };
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
  'charge.dispute.created',
  'charge.dispute.closed',
]);
const REFUND_KINDS = ['first_payment', 'forgot_to_cancel', 'billing_error', 'other'];

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
    // A one-time pack purchase (lib/shop.js) has no subscription and never touches the member's plan.
    if (await require('./shop').handleSession(obj)) return;
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
    // firstAt is when this invoice first failed: the dunning reminders (lib/reminders.js) count from it.
    const prior = user.paymentIssue && user.paymentIssue.invoice === obj.id ? user.paymentIssue : null;
    const failedAt = new Date().toISOString();
    user.paymentIssue = { at: failedAt, firstAt: (prior && prior.firstAt) || failedAt, invoice: obj.id || null, invoiceUrl: obj.hosted_invoice_url || null, attempt: obj.attempt_count || 1, retryAt: iso(obj.next_payment_attempt) };
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
    // A refunded pack ends that purchase (lib/shop.js); it isn't a membership refund.
    if (await require('./shop').handleRefund(obj)) return;
    const user = userForCustomer(obj.customer);
    if (!user) return;
    const refund = obj.refunds && obj.refunds.data && obj.refunds.data[0];
    if (obj.refunded && !user.refundedFirstPayment) user.refundedFirstPayment = true;
    // For the members feed: when, and which kind (set metadata kind on the refund in Stripe, or
    // inferred: inside 14 days of the first paid charge is the first-payment refund).
    const kind = refund && refund.metadata && refund.metadata.kind;
    const firstPaid = ms(user.firstPaidAt);
    user.refundedAt = new Date().toISOString();
    user.refundKind = REFUND_KINDS.includes(kind) ? kind : firstPaid && Date.now() - firstPaid <= 15 * DAY_MS ? 'first_payment' : 'other';
    await db.save('users', user);
    const card = obj.payment_method_details && obj.payment_method_details.card;
    await billingEmails.refundConfirmation(user, {
      refundId: (refund && refund.id) || obj.id, amount: obj.amount_refunded / 100, cardLast4: card ? card.last4 : null,
      founding: !!user.foundingPrice, membershipEnded: user.tier === 'free' || !!user.cancelAt,
    });
    return;
  }

  // Disputes (chargebacks): flagged on the member for the members feed, and Eli hears at once.
  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
    const charge = obj.charge && typeof obj.charge === 'object' ? obj.charge : await s.charges.retrieve(obj.charge);
    const user = charge && userForCustomer(charge.customer);
    if (!user) return;
    if (event.type === 'charge.dispute.created') {
      user.openDispute = { id: obj.id, at: new Date().toISOString(), amount: obj.amount / 100, currency: obj.currency, reason: obj.reason || null };
      await db.save('users', user);
      emit('dispute.opened', { userId: user.id, amount: obj.amount / 100, reason: obj.reason || null });
      const admin = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim()).filter(Boolean)[0];
      if (admin) sendEmail({ to: admin, subject: `Stripe dispute opened: ${user.email}`, text: `${user.email} opened a dispute for $${obj.amount / 100} (${obj.reason || 'no reason given'}). Respond in the Stripe Dashboard: Payments > Disputes.` });
    } else {
      if (user.openDispute && user.openDispute.id === obj.id) user.openDispute = null;
      await db.save('users', user);
      emit('dispute.closed', { userId: user.id, status: obj.status || null });
    }
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
  refundAllAndCancel,
  pauseAtPeriodEnd, resumePause, pauseTick, pauseEligible, pauseInEffect, pausePreview, nextPeriodEnd, PAUSE_REFUSALS, REFUND_KINDS,
  firstChargeDate, referralRewardDue, foundingKept, termsConsentOn, winbackProfile, winbackEligible, verifyWinback,
  graceToken, verifyGrace, graceFor, graceUntil, graceCheck, issueGrace, rewardPayingReferrer,
  stripeClient: stripe,
  LOOKUP, REFERRAL_COUPON, WINBACK_COUPON, HANDLED, MEMBERSHIP_TERMS_PATH, CIRCLE_AGREEMENT_PATH, TERMS_VERSION, tierForSubscription, _setClient,
};
