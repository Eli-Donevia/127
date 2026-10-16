// Outbound integrations. Every one is optional: with no key set, the app logs
// what it would have done and keeps working.
//
// - KLAVIYO_PRIVATE_KEY: product events become Klaviyo metrics (names below are exact,
//   flows depend on them) and member profile properties stay in sync. See lib/klaviyo.js.
// - WEBHOOK_URL: every event is also POSTed as JSON (Zapier, Make, n8n, a CRM, Slack...).
// - RESEND_API_KEY + EMAIL_FROM: transactional email via Resend, sent to everyone
//   regardless of marketing consent.

const db = require('./db');
const klaviyo = require('./klaviyo');
const consent = require('./consent');
const launch = require('./launch');
const { level } = require('./gamify');

function baseUrl() {
  return process.env.BASE_URL || 'https://127group.io';
}

// Profile properties kept in sync on every member event.
function memberProfile(user) {
  const w = launch.onWaitlist(user.email);
  return {
    first_name: (user.name || '').split(' ')[0] || undefined,
    tier: user.tier,
    track: user.roadmap ? user.roadmap.trackName : undefined,
    level: level(user.xp || 0).name,
    founding_member: launch.isFoundingMember(user),
    referral_code: w ? w.referralCode : undefined,
    referral_link: w ? `${baseUrl()}/f/${w.referralCode}` : undefined,
    referral_count: w ? w.referralCount || 0 : undefined,
    referred_by: user.referredBy || (w && w.referredBy) || undefined,
    signup_source: user.signupSource || undefined,
    onboarded_at: user.onboardedAt || undefined,
    // Klaviyo gates launch emails on launch_optin and ongoing email on ongoing_optin (lib/consent.js).
    ...consent.optins(user.marketingOptIn || (w && w.marketingOptIn)),
    // True only while the founding price can still be bought, so emails never promise it after the close.
    founding_price_available: launch.foundingOpen(),
    founding_number: user.foundingNumber || undefined,
    founding_call_url: user.foundingNumber && process.env.FOUNDING_CALL_URL ? process.env.FOUNDING_CALL_URL : undefined,
    founding_call_calendar_url: user.foundingNumber && process.env.FOUNDING_CALL_AT ? `${baseUrl()}/founding/call.ics` : undefined,
    ...currentStep(user),
    // Members R09: set when Eli's approved day-3 note is sent from /admin/ops, so Flow G's Day 3 skips them.
    eli_note_day3_at: user.eliNoteDay3At || undefined,
    // Dunning (R10): lets flows filter on an open payment problem.
    payment_issue: !!user.paymentIssue,
    // null (not undefined) so Klaviyo clears the date when a card recovers or a pause ends.
    payment_retry_at: (user.paymentIssue && user.paymentIssue.retryAt) || null,
    // Pause (offer.md section 8): when a paused membership restarts.
    pause_resumes_at: (user.pause && !user.pause.endedAt && user.pause.resumesAt) || null,
    // Required here, not at the top: billing and circle both load this file.
    ...safeProfile(() => require('./billing').winbackProfile(user)),
    ...safeProfile(() => require('./circle').circleProfile(user)),
  };
}

function safeProfile(fn) {
  try {
    return fn() || {};
  } catch (err) {
    console.warn('[profile]', err.message);
    return {};
  }
}

// The first roadmap step not done yet, for emails that nudge the next move.
function currentStep(user) {
  for (const w of (user.roadmap && user.roadmap.weeks) || []) {
    for (const t of w.tasks) if (!(user.completed && user.completed[t.id])) return { current_step: t.title, current_step_week: w.week };
  }
  return user.roadmap ? { current_step: null, current_step_week: null } : {};
}

// Internal event -> Klaviyo metric name and properties.
const METRICS = {
  'user.signed_up': (p) => ['Signed Up', { source: p.source, founding_member: p.founding_member, from_waitlist: p.from_waitlist }],
  'onboarding.completed': (p) => ['Completed Onboarding', { track: p.trackName }],
  'roadmap.step_completed': (p) => ['Completed Step', { step_id: p.step_id, week: p.week, steps_done: p.steps_done, steps_total: p.steps_total }],
  'badge.earned': (p) => ['Earned Badge', { badge: p.badge, level: p.level }],
  'ai.limit_hit': (p) => ['Hit Free Limit', { limit_type: p.limit_type, resets_on: p.resets_on }],
  // A pause and its restart are not plan changes for the flows: "Upgraded" would restart Flow G.
  'plan.changed': (p) => {
    if (p.paused) return ['Paused Subscription', { plan: p.from, resumes_at: p.resumes_at || null }];
    if (p.resumed) return ['Resumed Subscription', { plan: p.to }];
    if (p.cancelled) return ['Cancelled Subscription', { plan: p.from, founding_member: p.founding_member }];
    return p.up
      ? ['Upgraded', { plan: p.to, from: p.from, price_id: p.price_id, founding_price: !!p.founding_price }]
      : ['Downgraded', { plan: p.to, from: p.from }];
  },
  'circle.applied': () => ['Applied to Circle', {}],
  'circle.approved': () => ['Approved for Circle', {}],
  'win.posted': (p) => ['Posted Win', { win_id: p.win_id }],
  'waitlist.joined': (p) => ['Joined Waitlist', { source: p.source, referred_by: p.referred_by || null, utm_source: p.utm_source, utm_campaign: p.utm_campaign }],
  'waitlist.confirmed': (p) => ['Confirmed Waitlist', { referred_by: p.referred_by || null }],
  'referral.counted': (p) => ['Referral Counted', { referral_count: p.referral_count, friend_first_name: p.friend_first_name }],
  // Billing (lib/billing.js). Klaviyo flow: abandoned checkout (~1h after Started Checkout). The site sends the payment-failed,
  // pause and resume emails itself; Stripe's own customer email covers expiring cards. These metrics are for reporting only.
  'checkout.started': (p) => ['Started Checkout', { plan: p.plan, founding: !!p.founding, price: p.price, checkout_url: p.checkout_url, stripe_checkout_url: p.stripe_checkout_url, free_month: !!p.free_month }],
  'invoice.payment_failed': (p) => ['Payment Failed', { attempt_count: p.attempt_count, hosted_invoice_url: p.hosted_invoice_url, next_payment_attempt: p.next_payment_attempt, amount: p.amount, currency: p.currency, plan: p.plan, founding_price: !!p.founding_price }],
  'payment.recovered': (p) => ['Payment Recovered', { amount: p.amount, currency: p.currency, plan: p.plan }],
  'card.expiring': (p) => ['Card Expiring', { brand: p.brand, last4: p.last4, exp_month: p.exp_month, exp_year: p.exp_year, plan: p.plan, billing_url: p.billing_url }],
};

// Klaviyo metric name and properties for an internal event, or null (exported for tests).
function metricFor(type, payload) {
  return METRICS[type] ? METRICS[type](payload) : null;
}

function sendToKlaviyo(type, payload, user) {
  if (!klaviyo.on()) return;
  const email = payload.email || (user && user.email);
  if (!email) return;
  const profile = { ...(user ? memberProfile(user) : {}), ...(payload.profile || {}) };
  const map = METRICS[type];
  if (map) {
    const [metric, props] = map(payload);
    klaviyo.track(metric, email, props, profile);
  } else if (user || payload.profile) {
    klaviyo.upsertProfile(email, profile);
  }
}

async function emit(type, payload = {}) {
  const user = payload.userId ? db.get('users', payload.userId) : null;
  const full = { ...payload };
  if (user && !full.email) full.email = user.email;
  const { profile, ...stored } = full;
  const event = { type, payload: stored, at: new Date().toISOString() };
  db.save('events', { ...event }).catch(() => {});
  sendToKlaviyo(type, full, user);
  const url = process.env.WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(6000),
    });
  } catch (err) {
    console.warn('[webhook] failed', type, err.message);
  }
}

// Marketing consent changed (signup box or settings).
function syncConsent(email, optedIn, listEnv = 'KLAVIYO_MEMBERS_LIST_ID') {
  if (!klaviyo.on()) return;
  if (optedIn) klaviyo.subscribe(process.env[listEnv], email);
  else klaviyo.unsubscribe(process.env[listEnv], email);
}

// The address part of EMAIL_FROM ("127 <hello@127group.io>" -> hello@127group.io).
function fromAddress() {
  const raw = process.env.EMAIL_FROM || '127 <hello@127group.io>';
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}

// fromName: a display name for this message only ("Eli from 127"); replyTo: where replies go.
async function sendEmail({ to, subject, text, html, replyTo, fromName }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:stub] to=${to} subject="${subject}"${fromName ? ` from="${fromName}"` : ''}${replyTo ? ` reply_to=${replyTo}` : ''}`);
    return;
  }
  const from = fromName ? `${String(fromName).replace(/[<>"]/g, '')} <${fromAddress()}>` : process.env.EMAIL_FROM || '127 <hello@127group.io>';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
  } catch (err) {
    console.warn('[email] failed', err.message);
  }
}

function status() {
  return [
    {
      key: 'stripe',
      name: 'Stripe',
      what: 'Subscriptions, checkout and the billing portal',
      on: !!process.env.STRIPE_SECRET_KEY,
      env: 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_BUILDER, STRIPE_PRICE_CIRCLE',
    },
    {
      key: 'claude',
      name: 'Claude (Anthropic)',
      what: 'Powers the AI tools, grounded in the 127 library',
      on: !!process.env.ANTHROPIC_API_KEY,
      env: 'ANTHROPIC_API_KEY',
    },
    {
      key: 'postgres',
      name: 'Postgres',
      what: 'Durable database for members and progress',
      on: !!process.env.DATABASE_URL,
      env: 'DATABASE_URL (Replit adds this when you create a database)',
    },
    {
      key: 'email',
      name: 'Resend email',
      what: 'Welcome, upgrade and Circle emails',
      on: !!process.env.RESEND_API_KEY,
      env: 'RESEND_API_KEY, EMAIL_FROM',
    },
    {
      key: 'webhook',
      name: 'Automation webhook',
      what: 'Send every event to Zapier, Make, n8n or a CRM',
      on: !!process.env.WEBHOOK_URL,
      env: 'WEBHOOK_URL',
    },
    {
      key: 'klaviyo',
      name: 'Klaviyo',
      what: 'Waitlist, signup, step, badge, limit and plan events for email flows; lists only for people who ticked the box',
      on: !!process.env.KLAVIYO_PRIVATE_KEY,
      env: 'KLAVIYO_PRIVATE_KEY, KLAVIYO_WAITLIST_LIST_ID, KLAVIYO_MEMBERS_LIST_ID',
    },
    {
      key: 'calendar',
      name: 'Circle call link',
      what: "Calendar or meeting link shown to Founder's Circle members",
      on: !!process.env.CIRCLE_CALL_URL,
      env: 'CIRCLE_CALL_URL',
    },
    {
      key: 'community',
      name: 'Private community link',
      what: 'Invite link for the Circle group (WhatsApp, Discord, Slack, Circle.so...)',
      on: !!process.env.CIRCLE_COMMUNITY_URL,
      env: 'CIRCLE_COMMUNITY_URL',
    },
    {
      key: 'analytics',
      name: 'Analytics',
      what: 'Plausible page views plus goals: Waitlist Join, Signup, Onboarding Complete, Activation, Checkout Start, Upgrade',
      on: !!process.env.PLAUSIBLE_DOMAIN,
      env: 'PLAUSIBLE_DOMAIN',
    },
  ];
}

// Account deletion: ask Klaviyo to delete the profile too.
function forget(email) {
  return klaviyo.forget(email);
}

module.exports = { emit, sendEmail, status, forget, syncConsent, memberProfile, metricFor };
