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
// - Pause start and end: members who paused are flipped to Free when the paid month ends and
//   back when the plan restarts (billing.pauseTick), so the restart reminder below has a date.
// - Failed-payment reminders (research R10): days 2, 5 and 9 after a renewal first fails, while
//   Stripe retries (day 0 is the decline email sent from the webhook).
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
const DUNNING_DAYS = [2, 5, 9];
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

// Offer, 11:53 Oct 16: a member who paused during a free month gets no "your card will be charged" note for that
// date, because the pause voids that invoice; the pause restart reminder covers the real first charge.
function pauseCovers(user, chargeAt) {
  const p = user && user.pause;
  return !!(p && !p.endedAt && Date.parse(p.resumesAt) > chargeAt);
}

async function remindUser(user, now) {
  const sent = [];
  const subId = user.stripeSubscriptionId;
  if (user.cancelAt) return sent; // cancelled: no more charges to warn about

  if (user.freeMonthEndsAt && user.freeMonthSubscriptionId === subId) {
    const ends = Date.parse(user.freeMonthEndsAt);
    if (ends > now && ends - now <= FREE_MONTH_LEAD && !pauseCovers(user, ends)) {
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

  const issue = user.paymentIssue;
  const firstFail = issue && Date.parse(issue.firstAt || issue.at);
  if (firstFail && user.tier !== 'free') {
    const day = DUNNING_DAYS.filter((d) => now - firstFail >= d * DAY).pop();
    if (day) {
      const m = await billingEmails.paymentReminder(user, { invoice: issue.invoice, day });
      if (m) sent.push({ userId: user.id, kind: `dunning_day${day}` });
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
  // Members with a pause stay in the pass while they're on Free (lazy: billing.js requires this file).
  const paused = (u) => !!(u.pause && !u.pause.endedAt);
  const members = deps.db.filter('users', (u) => ((u.tier && u.tier !== 'free') || paused(u)) && (u.stripeSubscriptionId || paused(u)) && u.email);
  for (const user of members) {
    try {
      if (paused(user)) {
        const flip = await require('./billing').pauseTick(user, now);
        if (flip) sent.push({ userId: user.id, kind: `pause_${flip}` });
      }
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
  if (!user || pauseCovers(user, sub.trial_end * 1000)) return null;
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

module.exports = {
  pauseCovers, runOnce, trialWillEnd, start, stop, lastAnniversary, FREE_MONTH_LEAD, PAUSE_LEAD, DUNNING_DAYS, EVERY };
