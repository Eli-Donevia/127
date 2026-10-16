// Billing reminders Legal requires on a schedule (legal/03-membership-billing-terms.md
// Sections 2, 8, 9 and Appendix B). Runs every 6 hours from server.js and only reads
// what lib/billing-emails.js stores on the member at each subscription sync, so it
// never calls Stripe. Each notice is sent once (keys in the `billingReminders`
// collection), so a restart or an extra run sends nothing twice.
//
// - Free-month reminder: 5 days before the first charge after a free month (the
//   referral month, a come-back month or a Stripe trial). Legal's window is 3 to 7
//   days; if the server was down at the 5-day mark, it still goes out late rather than never.
// - Pause restart reminder: 5 days before a pause ends (Legal: at least 3 days;
//   conversion/offer.md section 8: 5 days).
// - Yearly reminder: on each anniversary of the membership start, for every paid
//   member (Section 2: monthly plans too, not only annual ones), sent within 7 days.
//
// trialWillEnd(sub) handles Stripe's customer.subscription.trial_will_end webhook
// (3 days before a trial ends) with the same key as the job, so only one goes out.

const billingEmails = require('./billing-emails');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const FREE_MONTH_LEAD = 5 * DAY;
const PAUSE_LEAD = 5 * DAY;
const YEARLY_WINDOW = 7 * DAY;
const EVERY = 6 * HOUR;

const deps = billingEmails.deps;

// The most recent anniversary of `startMs` at or before `now`, and which year it is.
function lastAnniversary(startMs, now) {
  const start = new Date(startMs);
  let years = new Date(now).getUTCFullYear() - start.getUTCFullYear();
  const at = (y) => {
    const d = new Date(startMs);
    d.setUTCFullYear(start.getUTCFullYear() + y);
    // Feb 29 joiners get Feb 28 in other years.
    if (d.getUTCMonth() !== start.getUTCMonth()) d.setUTCDate(0);
    return d.getTime();
  };
  if (at(years) > now) years -= 1;
  return years >= 1 ? { year: years, at: at(years) } : null;
}

async function remindUser(user, now) {
  const sent = [];
  const subId = user.stripeSubscriptionId;
  if (user.cancelAt) return sent; // cancelled: no more charges to warn about

  if (user.freeMonthEndsAt && user.freeMonthSubscriptionId === subId) {
    const ends = Date.parse(user.freeMonthEndsAt);
    if (ends > now && ends - now <= FREE_MONTH_LEAD) {
      const m = await billingEmails.freeMonthReminder(user, { chargeAt: ends, subscriptionId: subId });
      if (m) sent.push({ userId: user.id, kind: 'free_month' });
    }
  }

  if (user.pauseResumesAt) {
    const restart = Date.parse(user.pauseResumesAt);
    if (restart > now && restart - now <= PAUSE_LEAD) {
      const m = await billingEmails.pauseRestartReminder(user, { restartAt: restart, subscriptionId: subId });
      if (m) sent.push({ userId: user.id, kind: 'pause_restart' });
    }
  }

  if (user.subscriptionStartedAt && user.billingSubscriptionId === subId) {
    const joined = Date.parse(user.subscriptionStartedAt);
    const ann = Number.isFinite(joined) ? lastAnniversary(joined, now) : null;
    if (ann && now - ann.at < YEARLY_WINDOW) {
      const m = await billingEmails.yearlyReminder(user, { joinedAt: joined, year: ann.year, subscriptionId: subId });
      if (m) sent.push({ userId: user.id, kind: 'yearly' });
    }
  }
  return sent;
}

// One pass over paying members. Returns what was sent (for logs and tests).
async function runOnce(now = deps.now()) {
  const sent = [];
  const members = deps.db.filter('users', (u) => u.tier && u.tier !== 'free' && u.stripeSubscriptionId && u.email);
  for (const user of members) {
    try {
      sent.push(...(await remindUser(user, now)));
    } catch (err) {
      console.error('[reminders] failed for a member', user.id, err.message);
    }
  }
  if (sent.length) console.log(`[reminders] sent ${sent.length}: ${sent.map((s) => s.kind).join(', ')}`);
  return sent;
}

// Stripe customer.subscription.trial_will_end: the webhook calls this with the event's subscription.
async function trialWillEnd(sub) {
  if (!sub || sub.status !== 'trialing' || !sub.trial_end || sub.cancel_at || sub.cancel_at_period_end) return null;
  const user = deps.db.find('users', (u) => u.stripeCustomerId === sub.customer) || (sub.metadata && sub.metadata.userId ? deps.db.get('users', sub.metadata.userId) : null);
  if (!user) return null;
  const item = sub.items && sub.items.data && sub.items.data[0];
  const amount = item && item.price && Number.isFinite(item.price.unit_amount) ? item.price.unit_amount / 100 : undefined;
  return billingEmails.freeMonthReminder(user, { chargeAt: sub.trial_end * 1000, subscriptionId: sub.id, amount });
}

let timer = null;
function start() {
  if (timer) return timer;
  const tick = () => runOnce().catch((err) => console.error('[reminders] run failed', err.message));
  timer = setInterval(tick, EVERY);
  timer.unref();
  setTimeout(tick, 60 * 1000).unref(); // first pass a minute after boot
  return timer;
}
function stop() {
  clearInterval(timer);
  timer = null;
}

module.exports = { runOnce, trialWillEnd, start, stop, lastAnniversary, FREE_MONTH_LEAD, PAUSE_LEAD, EVERY };
