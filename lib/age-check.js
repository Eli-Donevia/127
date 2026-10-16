// Under-18 flow (Legal L42; Terms section 2, Privacy Policy section 11;
// legal/handoffs/website.md item 8d). 127 is for people 18 and older.
//
// When the Playbook's under-18 marker fires (an AI result with flags: ['under18'], read by
// ai.underAgeFlag, at every AI call site in server.js), when a wins post or reply says the member is
// under 18 (lib/moderation.js "under_18"), or when Eli flags an account from an email or a parent
// (/admin/ops), the account's AI chats and wins posting pause at once; Billing, Cancel and Delete stay open. /admin/ops shows Eli only the flagged message and
// the 2 before it, with three buttons: No action, Ask to confirm (hidden when the stated age is
// under 13), Close for age.
//
// Data rules: the excerpt is kept for Eli only while the review is open and is deleted when he
// decides (with the account on a close). It is never written to logs or events. A close keeps only
// the dates, the reason, the Stripe refund ids and a one-way hash of the email, for 3 years, so
// signup can refuse that email (`ageClosures` collection).

const crypto = require('crypto');
const moderation = require('./moderation');

const DAY = 24 * 60 * 60 * 1000;
const KEEP_CLOSURES_DAYS = 3 * 365 + 1;
const CONFIRM_DAYS = 7;

const PAUSE_MESSAGE = "127 is for people 18 and older. You mentioned you're under 18, so we've paused AI chats and posting while we take a look. We'll email you within 2 business days.";
const CONFIRM_TEXT = "127 is for people 18 and older. Can you confirm you're 18 or older? Just reply yes.";
const SIGNUP_REFUSED = "This email can't be used to sign up. If you think that's a mistake, email hello@127group.io.";

const deps = {
  db: require('./db'),
  now: () => Date.now(),
  send: (m) => require('./integrations').sendEmail(m),
  emit: (type, payload) => require('./integrations').emit(type, payload),
};
function _setDeps(over) {
  Object.assign(deps, over);
}

function iso(t) {
  return new Date(t).toISOString();
}
function firstName(user) {
  return String((user && user.name) || '').trim().split(/\s+/)[0] || 'there';
}
function emailHash(email) {
  return crypto.createHash('sha256').update(`127-age:${String(email || '').trim().toLowerCase()}`).digest('hex');
}
function emit(type, payload) {
  try {
    const r = deps.emit(type, payload);
    if (r && r.catch) r.catch(() => {});
  } catch {
    /* analytics only */
  }
}

// A stated age under 18 in the member's own words ("I'm 16", "as a 15 year old"), or null.
function statedAge(text) {
  const t = String(text || '');
  const m = t.match(/\b(?:i'?m|i\s+am|im)\s+(?:only\s+|just\s+)?(\d{1,2})\b/i) || t.match(/\bas\s+an?\s+(\d{1,2})[\s-]*(?:yo|y\/o|years?[\s-]+old)\b/i);
  const n = m ? parseInt(m[1], 10) : null;
  return n != null && n >= 5 && n < 18 ? n : null;
}

// Does this member message, or the Playbook's reply to it, flag the member as under 18?
// Returns { statedAge } or null. aiFlag: the result of ai.underAgeFlag(reply).
function detect(memberText, aiFlag) {
  if (aiFlag) return { statedAge: aiFlag.statedAge != null ? aiFlag.statedAge : statedAge(memberText) };
  const r = moderation.screen(String(memberText || ''), { accountAgeDays: 999 });
  if (r.reasons.some((x) => x.code === 'under_18')) return { statedAge: statedAge(memberText) };
  return null;
}

function underReview(user) {
  return !!(user && user.ageReview && ['open', 'asked'].includes(user.ageReview.status));
}

// Pauses AI chats and posting at once. excerpt: up to 3 messages [{ from, text, at }], the flagged one last.
async function flag(user, { source, excerpt, statedAge: age }) {
  if (!user || underReview(user)) return false;
  const now = deps.now();
  user.ageReview = {
    status: 'open', source, flaggedAt: iso(now), statedAge: age != null ? age : null,
    excerpt: (excerpt || []).slice(-3).map((m) => ({ from: m.from, text: String(m.text || '').slice(0, 2000), at: m.at || null })),
  };
  await deps.db.save('users', user);
  // No message text in events or emails: only that a review is waiting.
  emit('safety.age_flagged', { userId: user.id, source });
  const admin = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)[0];
  if (admin) {
    deps.send({ to: admin, subject: 'Age check: an account needs a look', text: `A member may be under 18. AI chats and posting are paused on the account.\n\nReview it within 2 business days: ${process.env.BASE_URL || 'https://127group.io'}/admin/ops#age` });
  }
  return true;
}

function logDecision(user, decision, by) {
  const r = user.ageReview || {};
  user.ageReviewLog = [...(user.ageReviewLog || []), { flaggedAt: r.flaggedAt || null, source: r.source || null, decidedAt: iso(deps.now()), decision, by: by || null }].slice(-10);
}

// "No action": a joke, a hypothetical or someone else's age. Unpause and log it.
async function noAction(user, by) {
  if (!underReview(user)) return { error: 'Nothing to review.' };
  logDecision(user, 'no_action', by);
  user.ageReview = null;
  await deps.db.save('users', user);
  emit('ops.age_no_action', { userId: user.id });
  return { ok: true };
}

// "Ask to confirm": one email. Not offered when the stated age is under 13.
async function askConfirm(user, by) {
  if (!underReview(user) || user.ageReview.status !== 'open') return { error: 'Already asked.' };
  if (user.ageReview.statedAge != null && user.ageReview.statedAge < 13) return { error: 'The stated age is under 13: close for age.' };
  user.ageReview.status = 'asked';
  user.ageReview.askedAt = iso(deps.now());
  user.ageReview.askedBy = by || null;
  await deps.db.save('users', user);
  deps.send({ to: user.email, subject: 'Your 127 account', text: `Hi ${firstName(user)},\n\n${CONFIRM_TEXT}\n\nEli's team\n127 Group LLC · hello@127group.io`, replyTo: process.env.EMAIL_REPLY_TO || 'hello@127group.io' });
  emit('ops.age_asked', { userId: user.id });
  return { ok: true };
}

// They replied yes: unpause.
async function confirmed(user, by) {
  if (!underReview(user) || user.ageReview.status !== 'asked') return { error: 'Nothing to confirm.' };
  logDecision(user, 'confirmed_18', by);
  user.ageReview = null;
  await deps.db.save('users', user);
  emit('ops.age_confirmed', { userId: user.id });
  return { ok: true };
}

// A "no" reply, or 7 days without one: Eli closes (the admin card says when the 7 days are up).
function confirmExpired(user, now = deps.now()) {
  const r = user && user.ageReview;
  return !!(r && r.status === 'asked' && now - Date.parse(r.askedAt) >= CONFIRM_DAYS * DAY);
}

function closeEmail(user, total) {
  const refund = total > 0 ? ` We've refunded every payment, $${Number.isInteger(total) ? total : total.toFixed(2)}, to the card that paid. It can take 5 to 10 business days to show.` : '';
  return {
    subject: 'Your 127 account',
    text: `Hi ${firstName(user)},\n\n127 is only for people 18 and older, and you told us you're under 18, so we've closed your account and deleted what you saved here.${refund}\n\nWe'd love to have you back once you're 18. If we got this wrong and you're 18 or older, reply to this email and we'll help you sign up again.\n\nEli's team`,
  };
}

// "Close for age". h: { refundAll(user) -> { refunds, total }, deleteAccount(user) }.
async function close(user, by, h) {
  if (!user) return { error: 'No such member.' };
  const r = user.ageReview || {};
  const { refunds, total } = await h.refundAll(user);
  const mail = closeEmail(user, total);
  const to = user.email;
  const record = await deps.db.save('ageClosures', {
    emailHash: emailHash(to), reason: 'under_18', flaggedAt: r.flaggedAt || null, closedAt: iso(deps.now()), refundIds: refunds, by: by || null,
  });
  await h.deleteAccount(user);
  deps.send({ to, subject: mail.subject, text: mail.text, replyTo: process.env.EMAIL_REPLY_TO || 'hello@127group.io' });
  emit('ops.age_closed', { closure_id: record.id, refunds: refunds.length });
  return { ok: true, refunds, total };
}

// Signup refuses an email closed for age in the last 3 years.
function blocked(email, now = deps.now()) {
  const h = emailHash(email);
  return deps.db.all('ageClosures').some((c) => c.emailHash === h && now - Date.parse(c.closedAt) < KEEP_CLOSURES_DAYS * DAY);
}

// Drops closure records older than 3 years (runs with the reminders job).
async function purgeOld(now = deps.now()) {
  let n = 0;
  for (const c of deps.db.all('ageClosures')) {
    if (now - Date.parse(c.closedAt) >= KEEP_CLOSURES_DAYS * DAY) {
      await deps.db.remove('ageClosures', c.id);
      n += 1;
    }
  }
  return n;
}

function pending() {
  return deps.db.filter('users', (u) => underReview(u)).sort((a, b) => String(a.ageReview.flaggedAt).localeCompare(String(b.ageReview.flaggedAt)));
}

module.exports = {
  PAUSE_MESSAGE, CONFIRM_TEXT, SIGNUP_REFUSED, CONFIRM_DAYS,
  statedAge, detect, underReview, flag, noAction, askConfirm, confirmed, confirmExpired, close, closeEmail, blocked, purgeOld, pending, emailHash,
  deps, _setDeps,
};
