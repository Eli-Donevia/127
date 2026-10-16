// Transactional billing emails Legal requires (legal/03-membership-billing-terms.md,
// Appendix B, and Section 13). They go through Resend (integrations.sendEmail) to
// every member whatever their marketing consent, because they're about the account.
//
// Copy: Appendix B, launch/email-flows.md section K (free month ending) and Flow J1
// (cancellation). Prices, dates and plan names always come from the subscription,
// the caller, lib/plans.js or lib/launch.js, never from this file.
//
// Every send is idempotent: a key per notice is recorded in the `billingReminders`
// collection before the email goes out, so webhook retries, the success-page
// confirmation and the reminder job never send the same notice twice.
//
// Receipts (Appendix B row 2) are Stripe's: turn on customer receipts in the
// Dashboard and set the receipt footer to RECEIPT_FOOTER below.

const integrations = require('./integrations');
const { plan } = require('./plans');
const launch = require('./launch');
const billingRecords = require('./billing-records');

const COLLECTION = 'billingReminders';
const DAY = 24 * 60 * 60 * 1000;
const TZ = 'America/New_York';
const PAID_STATUSES = ['active', 'trialing', 'past_due'];

const deps = {
  db: require('./db'),
  now: () => Date.now(),
  sendEmail: (mail) => integrations.sendEmail(mail),
};

// Tests swap the store, clock and sender.
function _setDeps(over) {
  Object.assign(deps, over);
  billingRecords._setDeps({ ...(over.db ? { db: over.db } : {}), ...(over.now ? { now: over.now } : {}) });
}

// ---------- formatting ----------

function base() {
  return process.env.BASE_URL || 'https://127group.io';
}
const billingUrl = () => `${base()}/app/billing`;
const termsUrl = () => `${base()}/membership-terms`;

const RECEIPT_FOOTER = `Your membership renews monthly until you cancel. Cancel online anytime: ${billingUrl().replace(/^https?:\/\//, '')}`;
const SIGNOFF = '127 Group LLC · hello@127group.io';

function money(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const n = Number(amount);
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

// "Tuesday, December 22" (launch/email-flows.md K), in Eastern time like every date on the site.
function longDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
}
function longDateYear(ms) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ });
}
function ordinalDay(ms) {
  const d = Number(new Date(ms).toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ }));
  const s = d % 100 >= 11 && d % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[d % 10] || 'th';
  return `${d}${s}`;
}

function firstName(user) {
  return String((user && user.name) || '').trim().split(/\s+/)[0] || '';
}

function lines(...parts) {
  return parts.filter((p) => p !== null && p !== undefined && p !== false).join('\n\n');
}

// ---------- subscription facts ----------

function item(sub) {
  return (sub && sub.items && sub.items.data && sub.items.data[0]) || null;
}
const sec = (s) => (s ? s * 1000 : null);

// Lazy: billing.js requires this module.
function lookup() {
  return require('./billing').LOOKUP;
}

function isFoundingSub(sub) {
  const price = item(sub) && item(sub).price;
  if (!price) return false;
  return price.lookup_key === lookup().founding || (!!process.env.STRIPE_PRICE_BUILDER_FOUNDING && price.id === process.env.STRIPE_PRICE_BUILDER_FOUNDING);
}

// The plan a subscription is for, even once it has ended (the member is on Free by then).
function planKeyOf(sub, user) {
  const price = item(sub) && item(sub).price;
  if (price && (price.lookup_key === lookup().circle || (process.env.STRIPE_PRICE_CIRCLE && price.id === process.env.STRIPE_PRICE_CIRCLE))) return 'circle';
  if (price && (price.lookup_key === lookup().builder || isFoundingSub(sub))) return 'builder';
  if (sub && sub.metadata && plan(sub.metadata.tier).rank > 0) return sub.metadata.tier;
  return user && plan(user.tier).rank > 0 ? user.tier : 'builder';
}

// Monthly price in dollars: what Stripe charges if we have it, else the site's prices.
function priceFor(planKey, founding, sub) {
  const price = item(sub) && item(sub).price;
  if (price && Number.isFinite(price.unit_amount)) return price.unit_amount / 100;
  if (founding && planKey === 'builder') return launch.view().foundingPrice;
  return plan(planKey).price;
}

function planLabel(planKey, founding) {
  return founding && planKey === 'builder' ? `${plan(planKey).name}, founding price` : plan(planKey).name;
}

// ---------- idempotency ----------

// Claims `key` and then sends. The claim is written before the email so two
// callers racing on the same notice can't both send it.
async function once(key, meta, fn) {
  if (deps.db.get(COLLECTION, key)) return null;
  await deps.db.save(COLLECTION, { id: key, ...meta, sentAt: new Date(deps.now()).toISOString() });
  return fn();
}

function send(user, mail) {
  Promise.resolve()
    .then(() => deps.sendEmail({ to: user.email, subject: mail.subject, text: mail.text }))
    .catch((err) => console.warn('[billing-emails] send failed', err.message));
  return mail;
}

// ---------- templates (pure: data in, { subject, text } out) ----------

const templates = {
  // Appendix B row 1, Section 3: the acknowledgment.
  acknowledgment({ name, planKey, founding, amount, billingDay, freeMonth }) {
    const price = money(amount) || 'your plan price';
    const builder = planKey === 'builder';
    const charge = freeMonth && longDate(freeMonth.chargeAt);
    return {
      subject: `Your 127 ${plan(planKey).name} membership is confirmed`,
      text: lines(
        `Hi ${name || 'there'},`,
        "You're in. Here's what you signed up for. Keep this email for your records.",
        [
          `Plan: ${planLabel(planKey, founding)}${founding && builder ? ' (locked for as long as your membership stays active)' : ''}`,
          `Price: ${price} a month, plus any applicable tax`,
          billingDay ? `Billing date: the ${billingDay} of each month (or the last day of the month in shorter months)` : null,
          freeMonth ? `First charge: ${money(freeMonth.amount) || price} on ${charge}. Your first month is free. Cancel before ${charge} to pay nothing.` : null,
        ].filter(Boolean).join('\n'),
        'Your membership renews automatically every month until you cancel.',
        `How to cancel: open Billing in your account and choose Cancel. One more tap confirms it. No call or email needed, and you don't need to give a reason. You keep access until the end of the month you've paid for and won't be charged again. You can also email "Cancel" to hello@127group.io from this address.\n${billingUrl()}`,
        builder
          ? `Refunds: if Builder isn't for you, email hello@127group.io with the subject "Refund" within 14 days of your first paid Builder charge and we'll refund it in full. Otherwise we don't refund partial months. The full rules are in our Membership Terms:\n${termsUrl()}`
          : `Refunds: we don't refund partial months, except as set out in our Membership Terms:\n${termsUrl()}`,
        `Your roadmap: ${base()}/app`,
        SIGNOFF
      ),
    };
  },

  // launch/email-flows.md K, plus "renews monthly until you cancel" from Appendix B.
  freeMonthReminder({ name, planKey, founding, amount, chargeAt, cardLast4 }) {
    const date = longDate(chargeAt);
    const price = money(amount) || 'your plan price';
    const who = cardLast4 ? `your card ending ${cardLast4} will be charged` : "you'll be charged";
    return {
      subject: `Your free month ends on ${date}`,
      text: lines(
        `${name || 'Hey'},`,
        `Your free month of ${plan(planKey).name} ends on ${date}. On that day ${who} ${price}/month${founding && planKey === 'builder' ? ', your founding price, locked as long as you stay' : ''}, plus any applicable tax. After that, your membership renews monthly until you cancel.`,
        "If you're staying, there's nothing to do.",
        `If you'd rather not continue, cancel before ${date} and you won't be charged. Cancel online anytime from Billing. No call or email needed.`,
        `Manage billing: ${billingUrl()}`,
        'Eli',
        SIGNOFF
      ),
    };
  },

  // Appendix B row 4, Section 8; subjects and lines from conversion/offer.md section 8.
  // pausesAt (optional): when the paid month ends and the pause begins.
  pauseConfirmation({ name, planKey, founding, amount, restartAt, pausesAt }) {
    const date = longDate(restartAt);
    const planName = plan(planKey).name;
    return {
      subject: `Paused until ${date}`,
      text: lines(
        `Hi ${name || 'there'},`,
        `Your ${planName} membership is paused. Your roadmap and price are saved${founding ? ', including your founding price' : ''}. Nothing will be charged until ${date}.`,
        pausesAt ? `You keep ${planName} until your paid month ends on ${longDate(pausesAt)}. After that, ${planName} tools are locked and your account works like the free plan until the pause ends.` : `While it's paused, ${planName} tools are locked and your account works like the free plan.`,
        `On ${date} it restarts automatically at ${money(amount) || 'your plan price'} a month, plus any applicable tax, and renews monthly until you cancel. We'll email you before it restarts.`,
        `Want back sooner? Resume now: ${billingUrl()}`,
        `Or cancel instead and you won't be charged again${founding ? ' (cancelling ends your founding price)' : ''}: ${billingUrl()}`,
        SIGNOFF
      ),
    };
  },

  pauseRestartReminder({ name, planKey, founding, amount, restartAt }) {
    const date = longDate(restartAt);
    return {
      subject: `${plan(planKey).name} restarts on ${date}`,
      text: lines(
        `Hi ${name || 'there'},`,
        `Your plan restarts on ${date} at ${money(amount) || 'your plan price'} a month${founding ? ', your founding price' : ''}, plus any applicable tax, and then renews monthly until you cancel.`,
        `Want it back sooner? Resume now: ${billingUrl()}`,
        `Need longer? Cancel before ${date} and you won't be charged. You can cancel online from Billing, no call or email needed: ${billingUrl()}`,
        SIGNOFF
      ),
    };
  },

  // Appendix B row 5, Section 6.
  priceChangeNotice({ name, planKey, oldAmount, newAmount, effectiveAt }) {
    const date = longDateYear(effectiveAt);
    return {
      subject: `Your ${plan(planKey).name} price is changing on ${date}`,
      text: lines(
        `Hi ${name || 'there'},`,
        `On ${date}, the price of your ${plan(planKey).name} membership changes from ${money(oldAmount)} to ${money(newAmount)} a month, plus any applicable tax. Your membership keeps renewing monthly at the new price until you cancel.`,
        `If you don't want to pay the new price, cancel before ${date} from Billing and you won't be charged it: ${billingUrl()}`,
        `If you're charged the new price and cancel within 14 days of that first charge, we'll refund that charge in full. Email hello@127group.io with the subject "Refund".`,
        `Membership Terms: ${termsUrl()}`,
        SIGNOFF
      ),
    };
  },

  // Appendix B row 6, Section 2.
  yearlyReminder({ name, planKey, founding, amount, joinedAt, billingDay }) {
    return {
      subject: 'Your 127 membership: your yearly reminder',
      text: lines(
        `Hi ${name || 'there'},`,
        `Once a year we remind you how your membership works. You joined on ${longDateYear(joinedAt)}.`,
        [
          `Plan: ${planLabel(planKey, founding)}`,
          `Price: ${money(amount) || 'your plan price'} a month, plus any applicable tax`,
          `Billing: monthly${billingDay ? `, on the ${billingDay}` : ''}, renewing automatically until you cancel`,
        ].join('\n'),
        `How to cancel: open Billing in your account and choose Cancel. No call or email needed. You keep access until the end of the month you've paid for.\n${billingUrl()}`,
        `Membership Terms: ${termsUrl()}`,
        SIGNOFF
      ),
    };
  },

  // Appendix B row 7 (Flow J1): the cancellation takes effect at the end of the paid
  // month. Subject and lines from conversion/offer.md section 8 J1, plus the undo Legal requires.
  cancellationScheduled({ name, planKey, founding, accessEndsAt }) {
    const date = longDate(accessEndsAt);
    const planName = plan(planKey).name;
    return {
      subject: "You're cancelled",
      text: lines(
        `Hi ${name || 'there'},`,
        `Your ${planName} access runs until ${date}, and you won't be charged again.`,
        `After that you're on the free plan: your roadmap, progress, saved work and wins stay on your account. Paid tools are locked until you rejoin.`,
        founding ? "Heads up: your founding price ends when the cancellation takes effect, and it doesn't come back if you rejoin later." : null,
        `Changed your mind? Until ${date}, keep ${planName} with one tap from Billing, with no new charge${founding ? ', and your founding price stays' : ''}:\n${billingUrl()}`,
        'Thanks for building with us.',
        'Eli',
        SIGNOFF
      ),
    };
  },

  // Flow J1 when the plan has already ended (cancelled immediately, or failed payments).
  planEnded({ name, planKey, founding, paymentFailed }) {
    return {
      subject: 'Your plan has ended',
      text: lines(
        `Hi ${name || 'there'},`,
        paymentFailed
          ? `We couldn't collect your payment after several tries, so your ${plan(planKey).name} plan has ended and you won't be charged again. Your roadmap and progress stay saved on the free plan, so you can pick up where you left off any time.`
          : `Your ${plan(planKey).name} plan has ended and you won't be charged again. Your roadmap and progress stay saved on the free plan, so you can pick up where you left off any time.`,
        founding ? "Heads up: if you come back later, the founding price doesn't come back with you." : null,
        paymentFailed ? `Rejoin anytime from Billing: ${billingUrl()}` : 'One question, and you can answer in one word: what made you cancel? Hit reply.',
        'Eli',
        SIGNOFF
      ),
    };
  },

  // Appendix B row 8, Section 7.
  refundConfirmation({ name, planKey, founding, amount, cardLast4, membershipEnded }) {
    return {
      subject: 'Your refund is on its way',
      text: lines(
        `Hi ${name || 'there'},`,
        `We've refunded ${money(amount)} to ${cardLast4 ? `your card ending ${cardLast4}` : 'your original payment method'}. Your bank may take 5 to 10 business days to show it.`,
        membershipEnded ? `Your ${plan(planKey).name} membership has ended and your account is on the free plan${founding ? '. Your founding price ended with it' : ''}. Your roadmap and progress stay saved.` : null,
        `Questions about your bill? Email hello@127group.io with the subject "Billing".`,
        SIGNOFF
      ),
    };
  },
};

// ---------- sends (one per Appendix B email) ----------

const meta = (user, kind, extra) => ({ kind, userId: user.id, ...extra });

// Right after the first successful checkout, and again after each upgrade.
async function purchaseAcknowledgment(user, sub) {
  if (!sub || !['active', 'trialing'].includes(sub.status)) return null;
  const planKey = planKeyOf(sub, user);
  const rank = plan(planKey).rank;
  if (!rank) return null;
  const prior = deps.db.filter(COLLECTION, (r) => r.kind === 'acknowledgment' && r.subscriptionId === sub.id);
  if (prior.some((r) => (r.rank || 0) >= rank)) return null;
  const key = `ack:${sub.id}:${planKey}`;
  // A subscription that predates these emails is noted without emailing its owner out of the blue.
  if (!prior.length && sub.created && deps.now() - sub.created * 1000 > 3 * DAY) {
    if (!deps.db.get(COLLECTION, key)) await deps.db.save(COLLECTION, { id: key, ...meta(user, 'acknowledgment', { subscriptionId: sub.id, rank, baseline: true }), sentAt: null });
    return null;
  }
  const founding = isFoundingSub(sub);
  const anchor = sec(sub.billing_cycle_anchor) || sec(item(sub) && item(sub).current_period_end);
  const amount = priceFor(planKey, founding, sub);
  const free = freeMonthOf(user, sub);
  return once(key, meta(user, 'acknowledgment', { subscriptionId: sub.id, rank }), async () => {
    await billingRecords.record(user, prior.length ? 'upgrade' : 'start', sub, { plan: planKey });
    return send(user, templates.acknowledgment({
      name: firstName(user), planKey, founding, amount,
      billingDay: anchor ? ordinalDay(anchor) : null,
      freeMonth: free ? { chargeAt: free, amount } : null,
    }));
  });
}

// opts: { chargeAt (ms), subscriptionId, amount?, planKey?, founding?, cardLast4? }
async function freeMonthReminder(user, opts) {
  const planKey = opts.planKey || (plan(user.tier).rank ? user.tier : 'builder');
  const founding = opts.founding != null ? opts.founding : !!user.foundingPrice;
  const amount = opts.amount != null ? opts.amount : user.subscriptionAmount != null ? user.subscriptionAmount : priceFor(planKey, founding);
  const key = `free-month:${opts.subscriptionId}:${Math.floor(opts.chargeAt / 1000)}`;
  return once(key, meta(user, 'free_month', { subscriptionId: opts.subscriptionId, chargeAt: new Date(opts.chargeAt).toISOString() }), () =>
    send(user, templates.freeMonthReminder({ name: firstName(user), planKey, founding, amount, chargeAt: opts.chargeAt, cardLast4: opts.cardLast4 }))
  );
}

// Call with the paused Stripe subscription (reads pause_collection.resumes_at), or,
// from the pause code, with { subscriptionId, restartAt (ms), pausesAt?, amount? }.
async function pauseConfirmation(user, subOrOpts) {
  const o = subOrOpts || {};
  const isSub = o.object === 'subscription' || !!o.items;
  const restartAt = isSub ? o.pause_collection && sec(o.pause_collection.resumes_at) : o.restartAt;
  const subscriptionId = isSub ? o.id : o.subscriptionId || user.stripeSubscriptionId;
  if (!restartAt || !subscriptionId) return null;
  const planKey = isSub ? planKeyOf(o, user) : plan(user.tier).rank ? user.tier : 'builder';
  const founding = isSub ? isFoundingSub(o) : !!user.foundingPrice;
  const amount = isSub ? priceFor(planKey, founding, o) : o.amount != null ? o.amount : user.subscriptionAmount != null ? user.subscriptionAmount : priceFor(planKey, founding);
  return once(`pause:${subscriptionId}:${Math.floor(restartAt / 1000)}`, meta(user, 'pause', { subscriptionId }), async () => {
    await billingRecords.record(user, 'pause', isSub ? o : null, { plan: planKey, subscriptionId, resumesAt: new Date(restartAt).toISOString() });
    return send(user, templates.pauseConfirmation({ name: firstName(user), planKey, founding, amount, restartAt, pausesAt: isSub ? null : o.pausesAt }));
  });
}

// At least 3 days before a pause ends (the reminder job sends it 5 days ahead).
// opts: { restartAt (ms), subscriptionId?, amount? }
async function pauseRestartReminder(user, opts) {
  opts = { ...opts, subscriptionId: opts.subscriptionId || user.stripeSubscriptionId };
  const planKey = plan(user.tier).rank ? user.tier : 'builder';
  const founding = !!user.foundingPrice;
  const amount = opts.amount != null ? opts.amount : user.subscriptionAmount != null ? user.subscriptionAmount : priceFor(planKey, founding);
  return once(`pause-restart:${opts.subscriptionId}:${Math.floor(opts.restartAt / 1000)}`, meta(user, 'pause_restart', { subscriptionId: opts.subscriptionId }), () =>
    send(user, templates.pauseRestartReminder({ name: firstName(user), planKey, founding, amount, restartAt: opts.restartAt }))
  );
}

// opts: { oldAmount, newAmount, effectiveAt (ms), subscriptionId, planKey? }. Send 7 to 30 days ahead.
async function priceChangeNotice(user, opts) {
  const planKey = opts.planKey || (plan(user.tier).rank ? user.tier : 'builder');
  return once(`price-change:${opts.subscriptionId}:${Math.floor(opts.effectiveAt / 1000)}`, meta(user, 'price_change', { subscriptionId: opts.subscriptionId }), () =>
    send(user, templates.priceChangeNotice({ name: firstName(user), planKey, oldAmount: opts.oldAmount, newAmount: opts.newAmount, effectiveAt: opts.effectiveAt }))
  );
}

// opts: { joinedAt (ms), year (1, 2, ...), subscriptionId, amount? }
async function yearlyReminder(user, opts) {
  const planKey = plan(user.tier).rank ? user.tier : 'builder';
  const founding = !!user.foundingPrice;
  const amount = opts.amount != null ? opts.amount : user.subscriptionAmount != null ? user.subscriptionAmount : priceFor(planKey, founding);
  return once(`yearly:${opts.subscriptionId}:${opts.year}`, meta(user, 'yearly', { subscriptionId: opts.subscriptionId, year: opts.year }), () =>
    send(user, templates.yearlyReminder({ name: firstName(user), planKey, founding, amount, joinedAt: opts.joinedAt, billingDay: ordinalDay(opts.joinedAt) }))
  );
}

// A cancellation scheduled for the end of the paid month, or a plan that has ended.
// Members who already got the scheduled confirmation don't get a second email when it ends.
async function cancellationConfirmed(user, sub) {
  if (!sub) return null;
  const planKey = planKeyOf(sub, user);
  const founding = isFoundingSub(sub);
  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  if (!ended) {
    const endsAt = sec(sub.cancel_at) || (sub.cancel_at_period_end ? sec(item(sub) && item(sub).current_period_end) : null);
    if (!endsAt || !PAID_STATUSES.includes(sub.status)) return null;
    return once(`cancel:${sub.id}:${Math.floor(endsAt / 1000)}`, meta(user, 'cancel_scheduled', { subscriptionId: sub.id }), async () => {
      await billingRecords.record(user, 'cancel_scheduled', sub, { plan: planKey, accessEndsAt: new Date(endsAt).toISOString() });
      return send(user, templates.cancellationScheduled({ name: firstName(user), planKey, founding, accessEndsAt: endsAt }));
    });
  }
  if (sub.status === 'incomplete_expired') return null; // never started, nothing to confirm
  const scheduled = deps.db.find(COLLECTION, (r) => r.kind === 'cancel_scheduled' && r.subscriptionId === sub.id);
  const paymentFailed = !!(sub.cancellation_details && sub.cancellation_details.reason === 'payment_failed');
  return once(`ended:${sub.id}`, meta(user, 'ended', { subscriptionId: sub.id, silent: !!scheduled }), async () => {
    await billingRecords.record(user, 'ended', sub, { plan: planKey, reason: (sub.cancellation_details && sub.cancellation_details.reason) || null });
    if (scheduled) return null;
    return send(user, templates.planEnded({ name: firstName(user), planKey, founding, paymentFailed }));
  });
}

// opts: { refundId, amount, cardLast4?, membershipEnded?, planKey?, founding? }
async function refundConfirmation(user, opts) {
  const planKey = opts.planKey || (plan(user.tier).rank ? user.tier : 'builder');
  return once(`refund:${opts.refundId}`, meta(user, 'refund', { refundId: opts.refundId }), async () => {
    await billingRecords.record(user, 'refund', null, { plan: planKey, refundId: opts.refundId, amount: opts.amount });
    return send(user, templates.refundConfirmation({ name: firstName(user), planKey, founding: !!opts.founding, amount: opts.amount, cardLast4: opts.cardLast4, membershipEnded: !!opts.membershipEnded }));
  });
}

// ---------- free months ----------

const couponId = (d) => {
  const c = d && typeof d === 'object' && d.source ? d.source.coupon : null;
  return c && typeof c === 'object' ? c : c ? { id: c } : null;
};

// When the free first month of this subscription ends (ms), or null. A free month is
// a Stripe trial, or a 100%-off first invoice (the founding referral coupon or a
// come-back coupon). `once` coupons drop off the subscription after the first
// invoice, so the referral reward is also read from the flag billing.js sets.
function freeMonthOf(user, sub) {
  if (!sub) return null;
  if (sub.status === 'trialing' && sub.trial_end) return sec(sub.trial_end);
  const it = item(sub);
  const periodEnd = sec(it && it.current_period_end);
  const periodStart = sec(it && it.current_period_start);
  const started = sec(sub.start_date || sub.created);
  if (!periodEnd || !periodStart || !started || Math.abs(periodStart - started) > DAY) return null; // past the first month
  const free = new Set([process.env.STRIPE_COUPON_FOUNDING_REFERRAL || 'founding-referral', process.env.STRIPE_COUPON_WINBACK].filter(Boolean));
  const couponFree = (sub.discounts || []).some((d) => {
    const c = couponId(d);
    return c && (free.has(c.id) || c.percent_off === 100);
  });
  const rewardFlag = user.referralRewardUsed && (!user.freeMonthSubscriptionId || user.freeMonthSubscriptionId === sub.id);
  const metaFlag = sub.metadata && sub.metadata.free_month === '1';
  return couponFree || rewardFlag || metaFlag ? periodEnd : null;
}

// ---------- the one hook billing.js calls after every subscription sync ----------

// Keeps the few dates the reminder job needs on the member, then sends whichever
// acknowledgment, pause or cancellation notice the subscription now calls for.
// Never throws: a billing email problem must not fail a Stripe webhook.
async function subscriptionSynced(user, sub) {
  try {
    if (!user || !sub) return;
    const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';
    if (!ended) {
      const founding = isFoundingSub(sub);
      if (user.billingSubscriptionId !== sub.id) {
        user.billingSubscriptionId = sub.id;
        user.subscriptionStartedAt = new Date(sec(sub.start_date || sub.created) || deps.now()).toISOString();
      }
      const free = freeMonthOf(user, sub);
      if (free && !user.freeMonthSubscriptionId) {
        user.freeMonthSubscriptionId = sub.id;
        user.freeMonthEndsAt = new Date(free).toISOString();
      } else if (free && user.freeMonthSubscriptionId === sub.id) {
        user.freeMonthEndsAt = new Date(free).toISOString();
      }
      user.subscriptionAmount = priceFor(planKeyOf(sub, user), founding, sub);
      const resumes = sub.pause_collection && sec(sub.pause_collection.resumes_at);
      user.pauseResumesAt = resumes ? new Date(resumes).toISOString() : null;
      const cancelAt = sec(sub.cancel_at) || (sub.cancel_at_period_end ? sec(item(sub) && item(sub).current_period_end) : null);
      user.cancelAt = cancelAt ? new Date(cancelAt).toISOString() : null;
    } else if (user.billingSubscriptionId === sub.id) {
      user.pauseResumesAt = null;
      user.cancelAt = null;
    }
    await deps.db.save('users', user);
    await purchaseAcknowledgment(user, sub);
    await pauseConfirmation(user, sub);
    await cancellationConfirmed(user, sub);
  } catch (err) {
    console.error('[billing-emails] subscriptionSynced failed', err.message);
  }
}

module.exports = {
  templates,
  purchaseAcknowledgment,
  freeMonthReminder,
  pauseConfirmation,
  pauseRestartReminder,
  priceChangeNotice,
  yearlyReminder,
  cancellationConfirmed,
  refundConfirmation,
  subscriptionSynced,
  freeMonthOf,
  longDate,
  RECEIPT_FOOTER,
  COLLECTION,
  deps,
  _setDeps,
};
