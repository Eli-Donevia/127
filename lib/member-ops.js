// Member operations (ops/members/site-changes/SPEC.md): the token-protected ops API the members
// heartbeat reads and writes (GET /ops/feed, POST /ops/drafts, POST /ops/notes), the /admin/ops
// approval outbox, and the member hooks (Help form, post screening, reports, win replies, Circle
// questions, the Circle call calendar, the dashboard nudge, /guidelines, unsubscribe).
//
// Rules this file keeps
// - Nothing reaches a member until Eli taps Approve. POST /ops/drafts only stages.
// - Commercial notes need marketing opt-in, an unsubscribe link and 127's postal address.
// - Quiet hours: approved items wait until 8am Central; nothing member-facing sends 10pm-8am Central.
// - AI never changes billing or access: notes are shown next to an item and never change it.
// - Everything members write is data. The feed never carries password hashes, reset tokens, chat or
//   worksheet contents, AI prompts, Stripe ids or card data.

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const moderation = require('./moderation');
const signals = require('./member-signals');
const security = require('./security');
const markdown = require('./markdown');
const ageCheck = require('./age-check');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CENTRAL = 'America/Chicago';
const EASTERN = 'America/New_York';

const deps = {
  db: require('./db'),
  now: () => Date.now(),
  send: (m) => require('./integrations').sendEmail(m),
  emit: (type, payload) => require('./integrations').emit(type, payload),
  syncConsent: (email, on) => require('./integrations').syncConsent(email, on),
  // The Founding Five (lib/founding-five.js): who the five are, filling its drafts, its feed section.
  foundingFive: () => require('./founding-five'),
  // A file a draft carries (data.attach). Only the Founding Five's calendar for now.
  attachment: (name) => (name === 'ff_sessions' ? { filename: '127-founding-five-sessions.ics', content: Buffer.from(require('./founding-five').ics()).toString('base64') } : null),
};
function _setDeps(over) {
  Object.assign(deps, over);
}
const env = () => process.env;

// ---------- small helpers ----------

function iso(t) {
  return t == null ? null : new Date(t).toISOString();
}
function ms(v) {
  if (v == null || v === '') return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
function str(v, max) {
  return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
}
function firstName(user, fallback = 'there') {
  return String((user && user.name) || '').trim().split(/\s+/)[0] || fallback;
}
function base() {
  return env().BASE_URL || 'https://127group.io';
}
function adminEmail() {
  return (env().ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)[0] || null;
}
function replyTo() {
  return env().EMAIL_REPLY_TO || 'hello@127group.io';
}
function emit(type, payload) {
  try {
    const r = deps.emit(type, payload);
    if (r && r.catch) r.catch(() => {});
  } catch {
    /* analytics only */
  }
}
function mail(m) {
  try {
    const r = deps.send(m);
    if (r && r.catch) r.catch((e) => console.warn('[member-ops] email failed', e.message));
    return r;
  } catch (err) {
    console.warn('[member-ops] email failed', err.message);
    return null;
  }
}
function save(collection, doc) {
  return deps.db.save(collection, doc);
}
function hmac(text) {
  return crypto.createHmac('sha256', env().SESSION_SECRET || 'dev-only-not-for-production').update(text).digest('base64url');
}

// ---------- quiet hours (Central time) ----------

const centralFmt = new Intl.DateTimeFormat('en-US', { timeZone: CENTRAL, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function centralHour(t) {
  const p = Object.fromEntries(centralFmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { h: +p.hour % 24, m: +p.minute };
}
function isQuiet(t) {
  const { h } = centralHour(t);
  return h >= 22 || h < 8;
}
// The next moment member-facing email may go out: now, or 8:00am Central.
function nextSendTime(t) {
  if (!isQuiet(t)) return t;
  let x = Math.floor(t / 60000) * 60000;
  for (let i = 0; i < 24 * 60 && isQuiet(x); i++) x += 60000;
  return x;
}

// ---------- footers ----------

const RELATIONSHIP_FOOTER = "You're getting this because you're a 127 member. Just reply, it comes to me.";
function unsubscribeUrl(user) {
  return `${base()}/unsubscribe?u=${encodeURIComponent(user.id)}&t=${hmac(`unsub:${user.id}`)}`;
}
function verifyUnsubscribe(userId, t) {
  const a = Buffer.from(hmac(`unsub:${String(userId || '')}`));
  const b = Buffer.from(String(t || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function commercialFooter(user) {
  return `Unsubscribe: ${unsubscribeUrl(user)}\n127 Group LLC · ${env().POSTAL_ADDRESS} · hello@127group.io`;
}
function canSendCommercial(user) {
  if (!user || user.marketingOptIn !== true || user.unsubscribed === true) return { ok: false, error: `This note sells something, and ${firstName(user, 'this member')} hasn't said yes to marketing email, so it can't be sent.` };
  if (!str(env().POSTAL_ADDRESS, 300)) return { ok: false, error: "Set POSTAL_ADDRESS (127 Group LLC's postal address) before sending commercial notes." };
  return { ok: true };
}

// ---------- Help form and tickets ----------

const HELP_CATEGORIES = [
  ['account', 'Account and login'],
  ['billing', 'Billing'],
  ['refund', 'Refund'],
  ['cancel', 'Cancel or pause'],
  ['roadmap', 'Roadmap and library'],
  ['ai', 'AI tools'],
  ['broken', "Something's broken"],
  ['circle', "Founder's Circle"],
  ['privacy', 'Privacy and my data'],
  ['other', 'Something else'],
];
const CATEGORY_KEYS = HELP_CATEGORIES.map((c) => c[0]);
const DEFAULT_RECEIPT = "Got it. You'll hear back within one business day.";
// The receipt shown and emailed after a Help request (SPEC section 7).
function receiptFor(category) {
  if (category === 'cancel') return `You can cancel any time in Billing with one tap: ${base()}/app/billing. If you asked us to do it for you, you'll get a confirmation within one business day.`;
  if (category === 'refund') return "Got it. Eli reads every refund request himself, and you'll hear back within one business day.";
  if (category === 'privacy') return "We've received your privacy request. We'll confirm it within 10 business days and complete it within 45 days.";
  return DEFAULT_RECEIPT;
}

// Returns { ticket, receipt, crisis } or { errors, values }.
async function createTicket(user, body) {
  const values = { category: str(body && body.category, 20), subject: str(body && body.subject, 140), message: str(body && body.message, 2000) };
  const errors = [];
  if (!CATEGORY_KEYS.includes(values.category)) errors.push('Pick what it is about.');
  if (!values.subject) errors.push('Add a subject.');
  if (values.message.length < 2) errors.push('Write your message.');
  if (errors.length) return { errors, values };
  const screen = moderation.screen(`${values.subject}\n${values.message}`, {});
  const crisis = !!screen.crisis;
  const now = deps.now();
  const category = crisis ? 'safety' : values.category;
  const ticket = await save('tickets', {
    userId: user.id, email: user.email, firstName: firstName(user, ''), tier: user.pausedTier || user.tier,
    category, askedCategory: values.category, subject: values.subject, body: values.message,
    status: 'new', urgent: !!screen.urgent, flags: screen.reasons.map((r) => r.code),
    thread: [{ from: 'member', body: values.message, at: iso(now) }],
  });
  emit('ticket.created', { userId: user.id, ticket_id: ticket.id, category });
  const receipt = receiptFor(values.category);
  // Transactional receipt: it goes to every member, marketing consent or not.
  mail({ to: user.email, subject: `We got your message: ${values.subject}`, text: `Hi ${firstName(user)},\n\n${receipt}${crisis ? `\n\n${moderation.CRISIS_MESSAGE}` : ''}\n\n127 Group LLC · hello@127group.io`, replyTo: replyTo() });
  if (screen.urgent) flagSafety({ kind: 'ticket', id: ticket.id, user, text: `${values.subject}\n\n${values.message}`, reasons: screen.reasons });
  return { ticket, receipt, crisis };
}

// Crisis, threat or child-safety signals: Eli hears at once.
function flagSafety({ kind, id, user, text, reasons }) {
  emit('safety.flagged', { userId: user && user.id, kind, item_id: id, reasons: (reasons || []).map((r) => r.code) });
  const to = adminEmail();
  if (!to) return;
  mail({
    to,
    subject: `Urgent: a ${kind === 'ticket' ? 'Help request' : 'post'} needs you now`,
    text: `${(user && (user.name || user.email)) || 'A member'} <${(user && user.email) || ''}>\n\n${text}\n\nFlags: ${(reasons || []).map((r) => r.label).join('; ')}\n\nOpen ${base()}/admin/ops#urgent`,
  });
}

// ---------- wins: screening, reports, replies, posting pause ----------

function liveStatus(w) {
  return !w.status || w.status === 'live';
}
function postingPaused(user, now = deps.now()) {
  const until = ms(user && user.postingPausedUntil);
  return until && until > now ? until : null;
}
function screenPost(user, text, now = deps.now()) {
  const mine = deps.db.filter('wins', (w) => w.userId === user.id);
  const replies = deps.db.all('wins').flatMap((w) => (w.replies || []).filter((r) => r.userId === user.id));
  const recent = [...mine, ...replies].sort((a, b) => String(a.createdAt || a.at).localeCompare(String(b.createdAt || b.at)));
  return moderation.screen(text, {
    accountAgeDays: Math.floor((now - (ms(user.createdAt) || now)) / DAY),
    postsToday: recent.filter((w) => now - (ms(w.createdAt || w.at) || 0) < DAY).length,
    recentTexts: recent.slice(-10).map((w) => w.text),
    tier: user.tier,
  });
}
// What a status a new post gets from its screening result.
function statusFor(result) {
  return result.action === 'hold' ? 'held' : 'live';
}
const HOLD_MESSAGE = 'Thanks. Your post goes up after a quick check.';
function blockMessage(result) {
  const codes = result.reasons.map((r) => r.code);
  if (codes.includes('duplicate')) return 'You already posted that one.';
  if (codes.includes('empty')) return 'Write something first.';
  return "That post can't go up here. Keep it kind and real: see the community guidelines.";
}
// Called after a screened post is saved.
function afterScreen(user, win, result) {
  if (result.urgent) flagSafety({ kind: 'post', id: win.id, user, text: win.text, reasons: result.reasons });
}

// Wins a viewer can see: live posts, plus their own held ones (marked "waiting for a check").
function visibleWins(viewer, list) {
  return (list || deps.db.all('wins')).filter((w) => liveStatus(w) || (viewer && w.userId === viewer.id && (w.status === 'held' || w.status === 'reported')));
}
function visibleReplies(viewer, w) {
  return (w.replies || []).filter((r) => (r.status !== 'held' && r.status !== 'hidden') || (viewer && r.userId === viewer.id && r.status === 'held'));
}

const REPORT_REASONS = [
  ['spam', 'Spam or selling'],
  ['harmful', 'Harmful or misleading'],
  ['inappropriate', 'Inappropriate'],
  ['safety', 'Someone may be in danger'],
  ['other', 'Something else'],
];
async function reportWin(user, winId, reason) {
  const win = deps.db.get('wins', winId);
  if (!win || win.userId === user.id) return { error: 'Nothing to report.' };
  const r = REPORT_REASONS.some((x) => x[0] === reason) ? reason : 'other';
  const now = iso(deps.now());
  win.reports = win.reports || [];
  if (win.reports.some((x) => x.by === user.id)) return { ok: true, already: true };
  win.reports.push({ by: user.id, reason: r, at: now });
  await save('reports', { winId: win.id, userId: user.id, reason: r, at: now });
  const decision = moderation.afterReports(win.reports);
  if (decision.hide && liveStatus(win)) {
    win.status = 'reported';
    win.heldAt = now;
    win.decidedAt = null;
    win.decision = null;
  }
  await save('wins', win);
  emit('win.reported', { userId: user.id, win_id: win.id, reason: r, hidden: win.status === 'reported' });
  if (decision.urgent) flagSafety({ kind: 'post', id: win.id, user: deps.db.get('users', win.userId), text: win.text, reasons: [{ code: 'safety_report', label: 'A member reported a safety concern' }] });
  return { ok: true, hidden: win.status === 'reported' };
}

function winRepliesOn() {
  return env().WIN_REPLIES === '1' || env().WIN_REPLIES === 'true';
}
async function replyToWin(user, winId, text, opts = {}) {
  const win = deps.db.get('wins', winId);
  if (!win || (!liveStatus(win) && !opts.asEli)) return { error: 'That post is not up right now.' };
  const t = str(text, 500);
  if (t.length < 2) return { error: 'Write a reply first.' };
  const now = iso(deps.now());
  let status = 'live';
  let result = null;
  if (!opts.asEli) {
    if (ageCheck.underReview(user)) return { error: ageCheck.PAUSE_MESSAGE };
    if (postingPaused(user)) return { error: pausedMessage(user) };
    result = screenPost(user, t);
    if (result.action === 'block') return { error: blockMessage(result) };
    status = statusFor(result);
  }
  const reply = { id: deps.db.id(), userId: opts.asEli ? null : user.id, name: opts.asEli ? 'Eli' : firstName(user, 'A member'), byEli: !!opts.asEli, text: t, at: now, status, flags: result ? result.reasons.map((r) => r.code) : [], heldAt: status === 'held' ? now : null };
  win.replies = [...(win.replies || []), reply].slice(-100);
  await save('wins', win);
  emit(opts.asEli ? 'ops.win_replied' : 'win.replied', { userId: opts.asEli ? undefined : user.id, win_id: win.id, held: status === 'held' });
  if (result) afterScreen(user, { id: win.id, text: t }, result);
  // Under 18 (Legal L42): a reply that says so pauses AI chats and posting too.
  let underAge = false;
  if (result && result.reasons.some((x) => x.code === 'under_18')) {
    underAge = await ageCheck.flag(user, { source: 'post', excerpt: [{ from: 'member', text: t, at: now }], statedAge: ageCheck.statedAge(t) });
  }
  return { ok: true, reply, held: status === 'held', crisis: !!(result && result.crisis), underAge };
}
async function cheerWin(user, winId) {
  const win = deps.db.get('wins', winId);
  if (!win || !liveStatus(win) || win.userId === user.id) return { error: 'Nothing to cheer.' };
  const cheers = new Set(win.cheers || []);
  if (cheers.has(user.id)) cheers.delete(user.id);
  else cheers.add(user.id);
  win.cheers = [...cheers];
  await save('wins', win);
  return { ok: true, cheered: cheers.has(user.id) };
}
function pausedMessage(user) {
  const until = postingPaused(user);
  return `Posting is paused on your account until ${new Date(until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: EASTERN })}. Questions? Use Help.`;
}

// Admin decisions on held posts and replies. decision: 'approve' | 'hide'.
async function decideWin(winId, decision, by, replyId) {
  const win = deps.db.get('wins', winId);
  if (!win) return { error: 'Post not found.' };
  const now = iso(deps.now());
  const target = replyId ? (win.replies || []).find((r) => r.id === replyId) : win;
  if (!target) return { error: 'Reply not found.' };
  target.status = decision === 'approve' ? 'live' : 'hidden';
  target.decision = decision === 'approve' ? 'approved' : 'hidden';
  target.decidedAt = now;
  target.decidedBy = by || null;
  await save('wins', win);
  emit(decision === 'approve' ? 'ops.win_approved' : 'ops.win_hidden', { win_id: win.id, reply_id: replyId || null });
  return { ok: true };
}

// ---------- Circle questions ----------

async function saveCircleQuestion(user, text, circle, env_ = env()) {
  const t = str(text, 1000);
  if (t.length < 3) return { error: 'Write your question first.' };
  const now = deps.now();
  const next = circle.nextCall(now, env_);
  const q = await save('circleQuestions', { userId: user.id, firstName: firstName(user, ''), text: t, at: iso(now), callKey: next ? next.key : null });
  emit('circle.question', { userId: user.id, question_id: q.id, call_at: q.callKey });
  return { ok: true, question: q };
}

// ---------- Circle call calendar (SPEC section 7) ----------
// One VEVENT per call from lib/circle.js's schedule, which matches
// ops/members/site-changes/circle-calls.json (holiday moves, Founder Days skips, the 60-minute kickoff).

function icsText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}
// RFC 5545: lines longer than 75 octets continue on the next line after a space.
function icsFold(line) {
  const parts = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = '';
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
function icsTime(t) {
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function callsIcs(circle, { from, to, env: e = env(), url, now = deps.now() }) {
  const calls = circle.callsBetween(from, to, e);
  const where = url || e.CIRCLE_CALL_URL || `${base()}/app/circle`;
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Founders Circle//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', "X-WR-CALNAME:127 Founder's Circle", `X-WR-TIMEZONE:${EASTERN}`];
  for (const c of calls) {
    out.push(
      'BEGIN:VEVENT',
      `UID:circle-call-${circle.etKey(c.at)}@127group.io`,
      `DTSTAMP:${icsTime(now)}`,
      `DTSTART:${icsTime(c.at)}`,
      `DTEND:${icsTime(c.at + c.minutes * 60000)}`,
      `SUMMARY:${icsText(c.kickoff ? "127 Founder's Circle kickoff" : "127 Founder's Circle call")}`,
      `DESCRIPTION:${icsText(`Join in The Room: ${where}\nScorecard: ${base()}/app/circle/scorecard`)}`,
      `LOCATION:${icsText(where)}`,
      `URL:${where}`,
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText("Founder's Circle call in 30 minutes")}`, 'END:VALARM',
      'END:VEVENT'
    );
  }
  out.push('END:VCALENDAR');
  return { text: out.map(icsFold).join('\r\n') + '\r\n', count: calls.length };
}

// ---------- drafts (POST /ops/drafts and the outbox) ----------

const DRAFT_KIND = /^[a-z0-9_:-]{1,40}$/;
const RECAP_KINDS = new Set(['circle_recap']);
// One draft, one email per listed member of the Founding Five: their own first line, then the shared
// body (Members' site spec part 4). Never Discord.
const GROUP_KINDS = new Set(['ff_group']);
// Founding Five drafts: the app fills [[first name]] and [[join link]] (the heartbeat never sees the link).
const isFf = (kind) => String(kind || '').startsWith('ff_');
const ffFill = (text, user) => deps.foundingFive().fill(text, user);
// [[...]] left in a draft, ignoring a group draft's [[first name]] (filled per member as it sends).
const placeholders = (text, group) => (group ? String(text).replace(/\[\[first name\]\]/gi, '') : String(text)).includes('[[');

function userFor(body) {
  if (body.userId) return deps.db.get('users', String(body.userId));
  if (body.email) return deps.db.find('users', (u) => u.email === String(body.email).trim().toLowerCase());
  return null;
}

// Returns { status, draft } or { status, error }.
async function stageDraft(body) {
  body = body || {};
  const kind = str(body.kind, 40);
  const key = str(body.key, 160);
  const subject = str(body.subject, 1000);
  const text = String(body.body == null ? '' : body.body).replace(/\r/g, '').trim();
  if (!DRAFT_KIND.test(kind)) return { status: 400, error: 'kind is required (a-z, 0-9, _ : -).' };
  if (!key) return { status: 400, error: 'key is required.' };
  if (!subject || subject.length > 140) return { status: 400, error: 'subject is required, 140 characters at most.' };
  if (!text || text.length > 5000) return { status: 400, error: 'body is required, 5,000 characters at most.' };
  const recap = RECAP_KINDS.has(kind);
  const group = GROUP_KINDS.has(kind);
  const user = recap || group ? null : userFor(body);
  const email = user ? user.email : str(body.email, 200).toLowerCase();
  if (!recap && !group && !user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, error: 'userId or email must name a member.' };
  let perMember = null;
  if (group) {
    const ff = deps.foundingFive();
    const list = Array.isArray(body.perMember) ? body.perMember.slice(0, 10) : [];
    perMember = list.map((m) => ({ userId: str(m && m.userId, 80), firstLine: str(m && m.firstLine, 300) }));
    if (!perMember.length) return { status: 400, error: 'perMember must list the members of the five.' };
    for (const m of perMember) {
      const u = deps.db.get('users', m.userId);
      if (!u || !ff.isFive(ff.mine(u.id))) return { status: 400, error: 'perMember may only list members of the Founding Five.' };
      m.firstLine = ffFill(m.firstLine, u);
    }
  }
  const recipient = recap ? 'circle' : group ? 'founding_five' : user ? `u:${user.id}` : `e:${email}`;
  const dup = deps.db.find('drafts', (d) => d.recipient === recipient && d.key === key);
  if (dup) return { status: 409, error: 'A draft with this key already exists for this member.', id: dup.id, draftStatus: dup.status };
  const priority = Number(body.priority);
  const data = body.data && typeof body.data === 'object' && JSON.stringify(body.data).length <= 4000 ? body.data : null;
  const subj = isFf(kind) ? ffFill(subject, user) : subject;
  const words = isFf(kind) ? ffFill(text, user) : text;
  const draft = await save('drafts', {
    kind, key, recipient, userId: user ? user.id : null, email: recap || group ? null : email,
    firstName: user ? firstName(user, '') : null, tier: user ? user.pausedTier || user.tier : null,
    subject: subj, body: words, originalSubject: subj, originalBody: words, ...(perMember ? { perMember } : {}),
    reason: str(body.reason, 500), job: str(body.job, 60), priority: Number.isFinite(priority) ? priority : null,
    commercial: group ? false : body.commercial === true, needsAction: str(body.needsAction, 300) || null, data,
    status: 'pending', approvedAt: null, sentAt: null, edited: false,
  });
  return { status: 201, draft };
}

function pendingDrafts() {
  return deps.db.filter('drafts', (d) => d.status === 'pending').sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

// Eli's Approve. edits: { subject, body, doneInStripe, by }. Returns { ok, status, error }.
// recap: async ({ callKey, post, by }) => circle.sendRecap result (server.js passes it).
async function approveDraft(id, edits = {}, opts = {}) {
  const d = deps.db.get('drafts', id);
  if (!d) return { error: 'Draft not found.' };
  if (d.status !== 'pending') return { error: `That draft is already ${d.status}.` };
  const user = d.userId ? deps.db.get('users', d.userId) : null;
  const group = GROUP_KINDS.has(d.kind);
  let subject = edits.subject != null ? str(edits.subject, 140) : d.subject;
  let body = edits.body != null ? String(edits.body).replace(/\r/g, '').trim().slice(0, 5000) : d.body;
  // A Founding Five draft staged before Eli set the Zoom link picks it up here.
  if (isFf(d.kind)) {
    subject = ffFill(subject, user);
    body = ffFill(body, user);
  }
  if (!subject || !body) return { error: 'Subject and message are needed.' };
  if (placeholders(body, group) || placeholders(subject, group) || (group && (d.perMember || []).some((m) => placeholders(m.firstLine, true)))) return { error: 'Fill in every [[placeholder]] before approving.' };
  if (d.needsAction && !edits.doneInStripe) return { error: `First: ${d.needsAction}. Then tick "Done in Stripe" and approve.` };
  if (d.userId && !user) return { error: 'That member no longer has an account.' };
  if (d.commercial) {
    const c = canSendCommercial(user);
    if (!c.ok) return { error: c.error };
  }
  const now = deps.now();
  // Filling the Zoom link at approval isn't Eli's edit.
  const fill = (t) => (isFf(d.kind) ? ffFill(t, user) : t);
  d.edited = d.edited || subject !== fill(d.originalSubject) || body !== fill(d.originalBody);
  d.subject = subject;
  d.body = body;
  d.approvedAt = iso(now);
  d.approvedBy = edits.by || null;
  if (d.needsAction) d.actionDoneAt = iso(now);
  d.error = null;
  if (isQuiet(now)) {
    d.status = 'queued';
    d.sendAfter = iso(nextSendTime(now));
    await save('drafts', d);
    emit('ops.draft_queued', { draft_id: d.id, kind: d.kind, send_after: d.sendAfter });
    return { ok: true, status: 'queued', sendAfter: d.sendAfter };
  }
  d.status = 'approved';
  await save('drafts', d);
  return sendDraft(d, opts);
}

async function sendDraft(d, opts = {}) {
  const now = deps.now();
  if (isQuiet(now)) {
    d.status = 'queued';
    d.sendAfter = iso(nextSendTime(now));
    await save('drafts', d);
    return { ok: true, status: 'queued', sendAfter: d.sendAfter };
  }
  if (RECAP_KINDS.has(d.kind)) {
    if (!opts.recap) return failDraft(d, 'Circle recaps need the server to send them.');
    const r = await opts.recap({ callKey: (d.data && d.data.callKey) || null, date: d.key.split(':')[1] || null, post: d.body, by: d.approvedBy });
    if (r.error) return failDraft(d, r.error);
    d.recipients = r.sent;
    d.postedToDiscord = !!r.posted;
  } else if (GROUP_KINDS.has(d.kind)) {
    // Each listed member who is still one of the five: their first line, then the shared body.
    const ff = deps.foundingFive();
    const sent = [];
    for (const m of d.perMember || []) {
      const u = deps.db.get('users', m.userId);
      if (!u || !ff.isFive(ff.mine(u.id))) continue;
      const text = ffFill([m.firstLine, d.body].filter(Boolean).join('\n\n'), u);
      mail({ to: u.email, subject: ffFill(d.subject, u), text: `${text}\n\n--\n${RELATIONSHIP_FOOTER}`, replyTo: replyTo(), fromName: 'Eli from 127' });
      sent.push(u.id);
    }
    if (!sent.length) return failDraft(d, 'None of the listed members is in the Founding Five now.');
    d.recipients = sent;
  } else {
    const user = d.userId ? deps.db.get('users', d.userId) : null;
    const to = user ? user.email : d.email;
    if (!to) return failDraft(d, 'No email address for this member.');
    let footer = RELATIONSHIP_FOOTER;
    if (d.commercial) {
      const c = canSendCommercial(user);
      if (!c.ok) return failDraft(d, c.error);
      footer = commercialFooter(user);
    }
    // A file the draft carries. The Founding Five's calendar holds the Zoom link, so it goes only to the five.
    const name = d.data && d.data.attach;
    const file = name ? deps.attachment(name) : null;
    if (name && !file) return failDraft(d, 'The file this draft carries is missing.');
    if (name === 'ff_sessions') {
      const ff = deps.foundingFive();
      if (!user || !ff.isFive(ff.mine(user.id))) return failDraft(d, 'The calendar file goes only to members of the Founding Five.');
    }
    mail({ to, subject: d.subject, text: `${d.body}\n\n--\n${footer}`, replyTo: replyTo(), fromName: 'Eli from 127', ...(file ? { attachments: [file] } : {}) });
    if (d.key.startsWith('ticket:')) {
      const t = deps.db.get('tickets', d.key.slice('ticket:'.length));
      if (t) {
        t.thread = [...(t.thread || []), { from: 'eli', body: d.body, at: iso(now) }];
        t.status = 'answered';
        t.answeredAt = iso(now);
        await save('tickets', t);
      }
    }
    // Members R09: Klaviyo's Flow G Day 3 skips anyone Eli already wrote to (eli_note_day3_at).
    if (user && (d.kind === 'builder_day3' || d.key.startsWith('builder_day3'))) {
      user.eliNoteDay3At = iso(now);
      await save('users', user);
      emit('profile.updated', { userId: user.id });
    }
  }
  d.status = 'sent';
  d.sentAt = iso(now);
  d.sendAfter = null;
  await save('drafts', d);
  emit('ops.draft_sent', { draft_id: d.id, kind: d.kind, key: d.key, userId: d.userId || undefined, edited: !!d.edited });
  return { ok: true, status: 'sent' };
}
async function failDraft(d, error) {
  d.status = 'pending';
  d.approvedAt = null;
  d.error = error;
  await save('drafts', d);
  return { error };
}

// "Approve all" for one kind (the Founding Five's picks day can stage dozens of "not picked" notes): each
// draft as staged, highest priority first. Drafts that need something (a placeholder, a Stripe step) stay.
async function approveKind(kind, by, opts = {}) {
  const out = { sent: 0, queued: 0, left: 0, errors: [] };
  if (RECAP_KINDS.has(kind)) return { ...out, errors: ['Approve Circle recaps one at a time.'] };
  for (const d of pendingDrafts().filter((x) => x.kind === kind)) {
    const r = await approveDraft(d.id, { by }, opts);
    if (r.error) {
      out.left += 1;
      if (!out.errors.includes(r.error)) out.errors.push(r.error);
    } else out[r.status === 'queued' ? 'queued' : 'sent'] += 1;
  }
  return out;
}

// Founding Five recaps (Legal L63): 127's copies are deleted Tue Apr 6, 2027 (midnight ET), 90 days after
// the last session, sent or not. Every ff_group draft goes the same way.
const FF_RECAPS_GONE = Date.parse('2027-04-06T04:00:00Z');
async function forgetFfRecaps(now = deps.now()) {
  if (now < FF_RECAPS_GONE) return 0;
  let n = 0;
  for (const d of deps.db.filter('drafts', (x) => !x.bodyDeletedAt && (GROUP_KINDS.has(x.kind) || x.kind === 'ff_recap' || String(x.key || '').startsWith('ff_recap:')))) {
    d.body = '';
    d.originalBody = '';
    if (d.perMember) d.perMember = d.perMember.map((m) => ({ userId: m.userId, firstLine: '' }));
    if (['pending', 'queued'].includes(d.status)) {
      d.status = 'discarded';
      d.discardedAt = iso(now);
      d.discardedBy = 'retention';
    }
    d.bodyDeletedAt = iso(now);
    await save('drafts', d);
    n += 1;
  }
  return n;
}

async function discardDraft(id, by) {
  const d = deps.db.get('drafts', id);
  if (!d || !['pending', 'queued'].includes(d.status)) return { error: 'Nothing to discard.' };
  d.status = 'discarded';
  d.discardedAt = iso(deps.now());
  d.discardedBy = by || null;
  await save('drafts', d);
  emit('ops.draft_discarded', { draft_id: d.id, kind: d.kind, key: d.key });
  return { ok: true };
}

// Sends approved drafts that waited out quiet hours. Runs every few minutes from server.js.
async function flushQueued(opts = {}) {
  const now = deps.now();
  if (isQuiet(now)) return [];
  const due = deps.db.filter('drafts', (d) => d.status === 'queued' && (ms(d.sendAfter) || 0) <= now);
  const out = [];
  for (const d of due) {
    try {
      out.push({ id: d.id, ...(await sendDraft(d, opts)) });
    } catch (err) {
      console.error('[member-ops] queued send failed', d.id, err.message);
    }
  }
  return out;
}

// ---------- notes (POST /ops/notes) ----------

const NOTE_TARGETS = ['application', 'ticket', 'win', 'member'];
const NOTE_KINDS = ['summary', 'triage', 'moderation', 'risk'];
async function stageNote(body) {
  body = body || {};
  const targetType = str(body.targetType, 20);
  const targetId = str(body.targetId, 80);
  const kind = str(body.kind, 20);
  const text = str(body.text, 4000);
  if (!NOTE_TARGETS.includes(targetType)) return { status: 400, error: `targetType must be one of ${NOTE_TARGETS.join(', ')}.` };
  if (!NOTE_KINDS.includes(kind)) return { status: 400, error: `kind must be one of ${NOTE_KINDS.join(', ')}.` };
  if (!targetId || !text) return { status: 400, error: 'targetId and text are required.' };
  const collection = { application: 'applications', ticket: 'tickets', win: 'wins', member: 'users' }[targetType];
  if (!deps.db.get(collection, targetId)) return { status: 404, error: 'No such item.' };
  const data = body.data && typeof body.data === 'object' && JSON.stringify(body.data).length <= 8000 ? body.data : null;
  const note = await save('notes', { targetType, targetId, kind, text, data, at: iso(deps.now()) });
  return { status: 201, note };
}
function notesFor(targetType, targetId) {
  return deps.db.filter('notes', (n) => n.targetType === targetType && n.targetId === targetId).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// ---------- the feed (GET /ops/feed) ----------

const ANSWER_MAX = 280;
function cleanAnswers(a) {
  const out = {};
  for (const [k, v] of Object.entries(a || {})) out[k] = Array.isArray(v) ? v.slice(0, 10).map((x) => String(x).slice(0, 60)) : String(v).slice(0, ANSWER_MAX);
  return out;
}
function roadmapSummary(user) {
  const rm = user.roadmap;
  if (!rm || !Array.isArray(rm.weeks)) return null;
  const done = (t) => !!(user.completed && user.completed[t.id]);
  let next = null;
  for (const w of rm.weeks) {
    for (const t of w.tasks) if (!next && !done(t)) next = { title: t.title, week: w.week };
  }
  const weeks = rm.weeks.map((w) => ({ week: w.week, total: w.tasks.length, done: w.tasks.filter(done).length }));
  return { total: weeks.reduce((s, w) => s + w.total, 0), done: weeks.reduce((s, w) => s + w.done, 0), nextTask: next, weeks, generatedAt: rm.generatedAt || null };
}
function pauseForFeed(user) {
  const p = user.pause;
  if (!p) return null;
  const ended = ms(p.endedAt);
  // A pause dropped before it began never happened.
  if (ended && ended < ms(p.scheduledFor)) return null;
  return { scheduledFor: p.scheduledFor, startedAt: p.startedAt || p.scheduledFor, resumesAt: ended && ended < ms(p.resumesAt) ? p.endedAt : p.resumesAt };
}
function aiSummary(user) {
  const last = [...(user.aiHistory || []).map((h) => h.at), ...(user.chat || []).filter((c) => c.role === 'user').map((c) => c.at)].map(ms).filter(Boolean).sort((a, b) => b - a)[0];
  if (!user.aiUsage && !last) return null;
  return { month: (user.aiUsage && user.aiUsage.month) || null, count: (user.aiUsage && user.aiUsage.count) || 0, limitHitMonth: user.limitHitMonth || null, lastAt: iso(last) };
}

function feedMember(user, ctx = {}) {
  const now = ctx.now || deps.now();
  const paused = !!user.pausedTier;
  const lastCancel = (user.cancellations || []).slice(-1)[0] || null;
  const application = ctx.applicationsByUser ? ctx.applicationsByUser[user.id] : deps.db.find('applications', (a) => a.userId === user.id);
  const launch = require('./launch');
  const gamify = require('./gamify');
  const ch = ctx.challengeByEmail ? ctx.challengeByEmail[user.email] || null : deps.db.find('challenge', (e) => e.email === user.email);
  return {
    id: user.id,
    email: user.email,
    firstName: firstName(user, '') || null,
    // A paused member is reported on their paid plan with subscriptionStatus "paused" (the app treats them as Free).
    tier: user.pausedTier || user.tier || 'free',
    access: user.tier || 'free',
    createdAt: user.createdAt || null,
    onboardedAt: user.onboardedAt || null,
    activatedAt: user.activatedAt || null,
    lastSeenAt: user.lastSeenAt || null,
    emailVerified: !!user.emailVerified,
    marketingOptIn: !!user.marketingOptIn,
    unsubscribed: !!user.unsubscribed,
    foundingMember: launch.isFoundingMember(user),
    foundingPrice: !!user.foundingPrice,
    signupSource: user.signupSource || null,
    track: user.roadmap ? user.roadmap.track : null,
    trackName: user.roadmap ? user.roadmap.trackName : null,
    level: gamify.level(user.xp || 0).name,
    xp: user.xp || 0,
    answers: cleanAnswers(user.answers),
    roadmap: roadmapSummary(user),
    completedAt: Object.values(user.completed || {}).filter(Boolean),
    resourcesDoneAt: Object.values(user.resourcesDone || {}).filter(Boolean),
    milestones: user.milestones || {},
    badges: user.badges || [],
    ai: aiSummary(user),
    wins: (ctx.winsByUser ? ctx.winsByUser[user.id] || [] : deps.db.filter('wins', (w) => w.userId === user.id)).map((w) => ({ id: w.id, at: w.createdAt, status: w.status || 'live' })),
    billing: {
      subscriptionStatus: paused ? 'paused' : user.subscriptionStatus || null,
      paymentIssue: user.paymentIssue ? { at: user.paymentIssue.at, firstAt: user.paymentIssue.firstAt || user.paymentIssue.at, attempt: user.paymentIssue.attempt || 1 } : null,
      cancelAtPeriodEnd: !!(user.cancelAtPeriodEnd || user.cancelAt),
      currentPeriodEnd: user.periodEnd || null,
      canceledAt: user.canceledAt || null,
      firstPaidAt: user.firstPaidAt || null,
      paidSince: user.paidSince || null,
      tierSince: user.tierSince || null,
      planHistory: user.planHistory || [],
      refundedAt: user.refundedAt || null,
      refundKind: user.refundKind || null,
      pause: pauseForFeed(user),
      cancelReason: lastCancel ? lastCancel.reason || null : null,
      cancelPageViewedAt: user.cancelPageViewedAt || null,
      openDispute: user.openDispute ? { at: user.openDispute.at, reason: user.openDispute.reason, amount: user.openDispute.amount } : null,
    },
    challenge: ch ? {
      joinedAt: ch.createdAt || null, daysCheckedIn: daysCheckedIn(ch), finisher: !!(ch.finishedAt || user.challengeFinisher),
      feature_ok: !!ch.featureOk, show_idea: !!ch.featureIdea, show_offer: !!ch.featureOffer, show_walkthrough: !!ch.featureWalk, guest_ok: !!ch.guestOk,
      friend_name_ok: !!ch.friendNameOk, featureLog: ch.featureLog || [], friendNameLog: ch.friendNameLog || [],
    } : null,
    // Age review (Legal L42): source, dates and decision only, never the conversation text.
    under18Flag: under18Flag(user),
    circle: {
      application: application ? { id: application.id, status: application.status, createdAt: application.createdAt } : null,
      questions: (ctx.questionsByUser ? ctx.questionsByUser[user.id] || [] : deps.db.filter('circleQuestions', (q) => q.userId === user.id)).map((q) => ({ at: q.at, text: q.text })),
      attendance: ctx.attendance ? ctx.attendance(user) : [],
    },
    tickets: (ctx.ticketsByUser ? ctx.ticketsByUser[user.id] || [] : deps.db.filter('tickets', (t) => t.userId === user.id)).map((t) => ({ id: t.id, at: t.createdAt, category: t.category, status: t.status, sentiment: t.sentiment || null })),
    touches: (ctx.draftsByUser ? ctx.draftsByUser[user.id] || [] : deps.db.filter('drafts', (d) => d.userId === user.id)).map((d) => ({ kind: d.kind, key: d.key, at: d.sentAt || d.createdAt, status: d.status === 'approved' || d.status === 'queued' ? 'pending' : d.status })),
    postingPausedUntil: user.postingPausedUntil || null,
  };
}

function under18Flag(user) {
  const r = user.ageReview;
  if (r) return { source: r.source || null, at: r.flaggedAt || null, decision: r.status === 'asked' ? 'asked_to_confirm' : null, decidedAt: r.askedAt || null };
  const last = (user.ageReviewLog || []).slice(-1)[0];
  return last ? { source: last.source || null, at: last.flaggedAt || null, decision: last.decision, decidedAt: last.decidedAt || null } : null;
}

// Day One Challenge entries (lib/challenge.js): days[n].at is set when day n was checked in.
function chSlot(name) {
  return require('./challenge').slot(name);
}
function daysCheckedIn(entry) {
  return [1, 2, 3, 4, 5].filter((n) => entry && entry.days && entry.days[n] && entry.days[n].at);
}

function groupBy(list, key) {
  const out = {};
  for (const x of list) (out[x[key]] = out[x[key]] || []).push(x);
  return out;
}

// opts: { since, app, circle (the circle section object), attendance(user) }
function buildFeed(opts = {}) {
  const now = deps.now();
  const since = ms(opts.since);
  const newer = (x) => !since || (ms(x.updatedAt || x.createdAt || x.at) || 0) > since;
  const users = deps.db.all('users');
  const wins = deps.db.all('wins');
  const tickets = deps.db.all('tickets');
  const questions = deps.db.all('circleQuestions');
  const drafts = deps.db.all('drafts');
  const ctx = {
    now,
    winsByUser: groupBy(wins, 'userId'),
    ticketsByUser: groupBy(tickets, 'userId'),
    questionsByUser: groupBy(questions, 'userId'),
    draftsByUser: groupBy(drafts.filter((d) => d.userId), 'userId'),
    applicationsByUser: Object.fromEntries(deps.db.all('applications').map((a) => [a.userId, a])),
    attendance: opts.attendance,
  };
  const entries = deps.db.all('challenge');
  ctx.challengeByEmail = Object.fromEntries(entries.map((e) => [e.email, e]));
  const memberIdByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
  const featured = entries.filter((e) => e.featureOk);
  return {
    generatedAt: iso(now),
    app: opts.app || { baseUrl: base() },
    members: users.map((u) => feedMember(u, ctx)),
    wins: wins.filter(newer).map((w) => ({
      id: w.id, userId: w.userId, firstName: w.name, text: w.text, createdAt: w.createdAt, status: w.status || 'live',
      flags: w.flags || [], urgent: !!w.urgent, heldAt: w.heldAt || null, decidedAt: w.decidedAt || null, decision: w.decision || null,
      reports: (w.reports || []).map((r) => ({ by: r.by, reason: r.reason, at: r.at })),
      replies: (w.replies || []).map((r) => ({ id: r.id, userId: r.userId, byEli: !!r.byEli, text: r.text, at: r.at, status: r.status || 'live' })),
      cheers: (w.cheers || []).length,
    })),
    tickets: tickets.filter(newer).map((t) => ({
      id: t.id, userId: t.userId || null, email: t.email, firstName: t.firstName, tier: t.tier, category: t.category, subject: t.subject, body: t.body,
      status: t.status, urgent: !!t.urgent, createdAt: t.createdAt, thread: t.thread || [],
    })),
    applications: deps.db.all('applications').map((a) => ({
      id: a.id, userId: a.userId, name: a.name, email: a.email, business: a.business, revenue: a.revenue, challenge: a.challenge,
      result13: a.result13 || null, time: a.time || null, timeNote: a.timeNote || null, commitment: a.commitment || null, link: a.link || null,
      status: a.status, createdAt: a.createdAt, approvedAt: a.approvedAt || null,
    })),
    circleQuestions: questions.filter(newer).map((q) => ({ id: q.id, userId: q.userId, firstName: q.firstName, text: q.text, at: q.at, callKey: q.callKey || null })),
    drafts: drafts.map((d) => ({ id: d.id, kind: d.kind, key: d.key, userId: d.userId, job: d.job || null, status: d.status, createdAt: d.createdAt, approvedAt: d.approvedAt || null, sentAt: d.sentAt || null, edited: !!d.edited, commercial: !!d.commercial })),
    challenge: {
      joined: entries.length,
      day1: entries.filter((e) => daysCheckedIn(e).includes(1)).length,
      finished: entries.filter((e) => e.finishedAt).length,
      optedIn: featured.length,
      // Check-in text only for people who ticked "Eli can feature my check-in" (and idea or offer only with their own boxes).
      featured: featured.map((e) => ({
        memberId: memberIdByEmail[e.email] || null, firstName: e.firstName || '', finisher: !!e.finishedAt, daysCheckedIn: daysCheckedIn(e),
        checkIns: daysCheckedIn(e).map((n) => {
          const a = { ...((e.days[n] && e.days[n].answers) || {}) };
          // The idea (v2: site) and the offer only with their own boxes; v2's walkthrough link only with its box.
          const idea = chSlot('idea');
          const offer = chSlot('offer');
          if (n === idea.day && !e.featureIdea) delete a[idea.field];
          if (n === offer.day && !e.featureOffer) delete a[offer.field];
          if (!e.featureWalk) delete a.walkthrough_url;
          return { day: n, at: e.days[n].at, answers: a };
        }),
      })),
    },
    circle: opts.circle || null,
    // Members' site spec part 1: applications, the five and the alternates. No emails, ages, video files or links.
    foundingFive: (() => {
      try {
        return deps.foundingFive().feed();
      } catch (err) {
        console.warn('[member-ops] founding five feed', err.message);
        return null;
      }
    })(),
  };
}

// ---------- the dashboard nudge ----------

function nudgeFor(user, now = deps.now()) {
  try {
    return signals.analyzeMember(feedMember(user, { now }), { now }).nudge || null;
  } catch (err) {
    console.warn('[member-ops] nudge', err.message);
    return null;
  }
}

// ---------- token check for /ops ----------

function opsToken() {
  const t = env().OPS_FEED_TOKEN || '';
  return t.length >= 32 ? t : null;
}
function tokenOk(req) {
  const token = opsToken();
  if (!token) return false;
  const auth = String(req.get('authorization') || '');
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return !!m && security.sameHash(security.hash(m[1].trim()), security.hash(token));
}

// ---------- routers ----------

// The JSON API. Mounted at /ops before the session middleware: no cookies, no CORS.
// h: { feedApp(), circleFeed(), attendance(user), recap(opts) }
function api(h = {}) {
  const r = express.Router();
  r.use((req, res, next) => {
    res.set('cache-control', 'no-store');
    if (!opsToken()) return res.status(404).json({ error: 'Not found' });
    if (!security.allow(`ops:${security.ip(req)}`, 60, 60 * 1000)) return res.status(429).json({ error: 'Too many requests' });
    if (!tokenOk(req)) return res.status(404).json({ error: 'Not found' });
    next();
  });
  r.use(express.json({ limit: '64kb' }));
  r.get('/feed', async (req, res, next) => {
    try {
      const circleSection = h.circleFeed ? await h.circleFeed() : null;
      res.json(buildFeed({ since: req.query.since, app: h.feedApp ? h.feedApp() : undefined, circle: circleSection, attendance: h.attendance }));
    } catch (err) {
      next(err);
    }
  });
  r.post('/drafts', async (req, res, next) => {
    try {
      const out = await stageDraft(req.body);
      if (out.error) return res.status(out.status).json({ error: out.error, id: out.id, status: out.draftStatus });
      res.status(201).json({ ok: true, id: out.draft.id, status: out.draft.status });
    } catch (err) {
      next(err);
    }
  });
  r.post('/notes', async (req, res, next) => {
    try {
      const out = await stageNote(req.body);
      if (out.error) return res.status(out.status).json({ error: out.error });
      res.status(201).json({ ok: true, id: out.note.id });
    } catch (err) {
      next(err);
    }
  });
  r.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  r.use((err, req, res, next) => {
    console.error('[ops api]', err.message);
    res.status(err.type === 'entity.parse.failed' ? 400 : 500).json({ error: err.type === 'entity.parse.failed' ? 'Invalid JSON' : 'error' });
  });
  return r;
}

const GUIDELINES_HTML = markdown.render(fs.readFileSync(path.join(__dirname, '..', 'content', 'community-guidelines.md'), 'utf8'));

// Member pages and /admin/ops. h: { requireAuth, requireAdmin, flash, limit, TOO_FAST, circle,
// circleCtx(), adminData(req), recap(opts) }
function routes(h) {
  const r = express.Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const { requireAuth, requireAdmin, flash } = h;

  // Help form
  r.get('/app/help', requireAuth, (req, res) => {
    res.render('app/help', { title: 'Help', HELP_CATEGORIES, values: { category: req.query.category || '' }, errors: null, done: null });
  });
  r.post('/app/help', requireAuth, wrap(async (req, res) => {
    if (!h.limit(req, res, `help:${req.user.id}`, 5, 60 * 60 * 1000, h.TOO_FAST)) return;
    const out = await createTicket(req.user, req.body);
    if (out.errors) return res.status(400).render('app/help', { title: 'Help', HELP_CATEGORIES, values: out.values, errors: out.errors, done: null });
    res.render('app/help', { title: 'Help', HELP_CATEGORIES, values: {}, errors: null, done: { receipt: out.receipt, crisis: out.crisis ? moderation.CRISIS_MESSAGE : null } });
  }));

  // Community guidelines (public)
  r.get('/guidelines', (req, res) => res.render('guidelines', { title: 'Community guidelines', description: '127 community guidelines: build each other up, keep it real, keep it safe, no selling.', html: GUIDELINES_HTML }));

  // Unsubscribe (commercial notes from Eli). GET shows a button so link scanners can't unsubscribe anyone.
  r.get('/unsubscribe', (req, res) => {
    const ok = verifyUnsubscribe(req.query.u, req.query.t) && !!deps.db.get('users', String(req.query.u));
    res.render('unsubscribe', { title: 'Unsubscribe', ok, u: req.query.u, t: req.query.t, done: false, layout: 'bare' });
  });
  r.post('/unsubscribe', wrap(async (req, res) => {
    const user = verifyUnsubscribe(req.body.u, req.body.t) ? deps.db.get('users', String(req.body.u)) : null;
    if (user) {
      user.marketingOptIn = false;
      user.unsubscribed = true;
      user.unsubscribedAt = iso(deps.now());
      await save('users', user);
      deps.syncConsent(user.email, false);
      emit('profile.updated', { userId: user.id });
    }
    res.render('unsubscribe', { title: 'Unsubscribe', ok: !!user, u: '', t: '', done: !!user, layout: 'bare' });
  }));

  // Wins: report, reply, cheer
  r.post('/app/wins/:id/report', requireAuth, wrap(async (req, res) => {
    if (!h.limit(req, res, `report:${req.user.id}`, 20, 60 * 60 * 1000, h.TOO_FAST)) return;
    const out = await reportWin(req.user, req.params.id, String(req.body.reason || ''));
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'info', 'Thanks for telling us. A person will look at it.');
    res.redirect('/app/wins');
  }));
  r.post('/app/wins/:id/reply', requireAuth, wrap(async (req, res) => {
    if (!winRepliesOn()) return res.redirect('/app/wins');
    if (!h.limit(req, res, `reply:${req.user.id}`, 30, 60 * 60 * 1000, h.TOO_FAST)) return;
    const out = await replyToWin(req.user, req.params.id, req.body.text);
    if (out.error) flash(req, 'error', out.error);
    else if (out.underAge) flash(req, 'info', ageCheck.PAUSE_MESSAGE);
    else if (out.crisis) flash(req, 'info', `${HOLD_MESSAGE} ${moderation.CRISIS_MESSAGE}`);
    else if (out.held) flash(req, 'info', HOLD_MESSAGE);
    res.redirect(`/app/wins#win-${req.params.id}`);
  }));
  r.post('/app/wins/:id/cheer', requireAuth, wrap(async (req, res) => {
    if (winRepliesOn()) await cheerWin(req.user, req.params.id);
    res.redirect(`/app/wins#win-${req.params.id}`);
  }));

  // Circle: question for this week's call, and the call calendar
  r.post('/app/circle/question', requireAuth, wrap(async (req, res) => {
    if (req.user.tier !== 'circle') return res.redirect('/app/circle');
    if (!h.limit(req, res, `cq:${req.user.id}`, 10, 60 * 60 * 1000, h.TOO_FAST)) return;
    const out = await saveCircleQuestion(req.user, req.body.question, h.circle);
    flash(req, out.error ? 'error' : 'win', out.error || "Got it. It's on Eli's list for the next call.");
    res.redirect('/app/circle#question');
  }));
  r.get('/app/circle/call.ics', requireAuth, (req, res) => {
    if (req.user.tier !== 'circle') return res.redirect('/app/circle');
    const now = deps.now();
    const kickoff = h.circle.callConfig().kickoff;
    const from = Math.max(now - DAY, kickoff ? kickoff - 1 : 0);
    const { text } = callsIcs(h.circle, { from, to: now + 366 * DAY, now });
    res.type('text/calendar').set('content-disposition', 'attachment; filename="127-founders-circle-calls.ics"').send(text);
  });

  // Dashboard nudge: hide for the rest of the day.
  r.post('/app/nudge/dismiss', requireAuth, (req, res) => {
    res.cookie('nudgehide', new Date().toISOString().slice(0, 10), { maxAge: DAY, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.redirect('/app');
  });

  // ---------- /admin/ops ----------
  r.get('/admin/ops', requireAuth, requireAdmin, wrap(async (req, res) => {
    res.render('admin/ops', { title: 'Ops', ...(await adminLocals(h)) });
  }));
  const back = (res, hash) => res.redirect(`/admin/ops${hash ? '#' + hash : ''}`);
  r.post('/admin/ops/drafts/:id/approve', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await approveDraft(req.params.id, { subject: req.body.subject, body: req.body.body, doneInStripe: req.body.done_in_stripe === 'on', by: req.user.email }, { recap: h.recap });
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'win', out.status === 'queued' ? `Approved. It goes out at ${fmtCentral(ms(out.sendAfter))} Central (quiet hours).` : 'Sent.');
    back(res, out.error ? `draft-${req.params.id}` : 'drafts');
  }));
  r.post('/admin/ops/kinds/:kind/approve-all', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await approveKind(String(req.params.kind), req.user.email, { recap: h.recap });
    const done = [out.sent ? `${out.sent} sent` : '', out.queued ? `${out.queued} go out at 8am Central (quiet hours)` : ''].filter(Boolean).join(', ');
    if (out.left) flash(req, 'error', `${done ? `${done}. ` : ''}${out.left} still need a look: ${out.errors.join(' ')}`);
    else flash(req, 'win', done ? `Approved. ${done[0].toUpperCase()}${done.slice(1)}.` : 'Nothing was waiting.');
    back(res, 'drafts');
  }));
  r.post('/admin/ops/drafts/:id/discard', requireAuth, requireAdmin, wrap(async (req, res) => {
    const out = await discardDraft(req.params.id, req.user.email);
    if (out.error) flash(req, 'error', out.error);
    back(res, 'drafts');
  }));
  r.post('/admin/ops/wins/:id/:decision', requireAuth, requireAdmin, wrap(async (req, res) => {
    const d = req.params.decision;
    if (d === 'reply') {
      const out = await replyToWin(req.user, req.params.id, req.body.text, { asEli: true });
      flash(req, out.error ? 'error' : 'win', out.error || 'Reply posted as Eli.');
      return back(res, 'first-wins');
    }
    if (!['approve', 'hide'].includes(d)) return back(res, 'held');
    const out = await decideWin(req.params.id, d, req.user.email, req.body.reply || null);
    if (out.error) flash(req, 'error', out.error);
    back(res, 'held');
  }));
  r.post('/admin/ops/tickets/:id/close', requireAuth, requireAdmin, wrap(async (req, res) => {
    const t = deps.db.get('tickets', req.params.id);
    if (t) {
      t.status = 'closed';
      t.closedAt = iso(deps.now());
      await save('tickets', t);
      emit('ops.ticket_closed', { ticket_id: t.id });
    }
    back(res, 'tickets');
  }));
  // An email or a parent says a member may be under 18: Eli starts the review by hand.
  r.post('/admin/ops/age-flag', requireAuth, requireAdmin, wrap(async (req, res) => {
    const email = str(req.body.email, 200).toLowerCase();
    const source = ['email', 'parent'].includes(req.body.source) ? req.body.source : 'email';
    const u = deps.db.find('users', (x) => x.email === email);
    if (!u) flash(req, 'error', 'No account with that email.');
    else if (ageCheck.underReview(u)) flash(req, 'info', 'That account is already paused for an age check.');
    else {
      await ageCheck.flag(u, { source, excerpt: [], statedAge: null });
      flash(req, 'info', `AI chats and posting are paused for ${u.email}.`);
    }
    back(res, 'age');
  }));

  // Under-18 review (Legal L42): No action, Ask to confirm, They confirmed 18+, Close for age.
  r.post('/admin/ops/age/:id/:action', requireAuth, requireAdmin, wrap(async (req, res) => {
    const u = deps.db.get('users', req.params.id);
    const a = req.params.action;
    let out = { error: 'Unknown action.' };
    if (!u) out = { error: 'That account no longer exists.' };
    else if (a === 'no_action') out = await ageCheck.noAction(u, req.user.email);
    else if (a === 'ask') out = await ageCheck.askConfirm(u, req.user.email);
    else if (a === 'confirmed') out = await ageCheck.confirmed(u, req.user.email);
    else if (a === 'close') {
      if (req.body.confirm !== 'on') out = { error: 'Tick the box to confirm: this cancels, refunds every payment and deletes the account.' };
      else if (u.id === req.user.id) out = { error: "You can't close your own account here." };
      else {
        try {
          out = await ageCheck.close(u, req.user.email, h.ageClose);
        } catch (err) {
          console.error('[age-check] close failed', err.type || '', err.message);
          out = { error: "Couldn't finish in Stripe, so nothing was deleted. Try again, or refund in the Stripe Dashboard first." };
        }
      }
    }
    if (out.error) flash(req, 'error', out.error);
    else flash(req, 'win', { no_action: 'Unpaused and logged.', ask: 'Email sent asking them to confirm.', confirmed: 'Unpaused.', close: `Closed for age. ${out.refunds ? out.refunds.length : 0} refund(s)${out.total ? `, $${out.total}` : ''}.` }[a]);
    back(res, 'age');
  }));

  // Moderation ladder, step 2: posting paused for 7 days (toggle).
  r.post('/admin/ops/members/:id/posting-pause', requireAuth, requireAdmin, wrap(async (req, res) => {
    const u = deps.db.get('users', req.params.id);
    if (u) {
      const on = !postingPaused(u);
      u.postingPausedUntil = on ? iso(deps.now() + 7 * DAY) : null;
      await save('users', u);
      emit(on ? 'ops.posting_paused' : 'ops.posting_resumed', { userId: u.id });
      flash(req, 'info', on ? `Posting paused for ${firstName(u, u.email)} for 7 days.` : `Posting back on for ${firstName(u, u.email)}.`);
    }
    back(res, 'held');
  }));
  return r;
}

function fmtCentral(t) {
  return new Date(t).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: CENTRAL });
}

async function adminLocals(h) {
  const now = deps.now();
  const users = Object.fromEntries(deps.db.all('users').map((u) => [u.id, u]));
  const wins = deps.db.all('wins').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const tickets = deps.db.all('tickets').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const held = [];
  for (const w of wins) {
    if (w.status === 'held' || w.status === 'reported') held.push({ win: w, reply: null });
    for (const rep of w.replies || []) if (rep.status === 'held') held.push({ win: w, reply: rep });
  }
  const urgent = [
    ...held.filter((x) => (x.reply ? (x.reply.flags || []).some((f) => ['crisis', 'crisis_mention', 'threat', 'minor_sexual'].includes(f)) : x.win.urgent || (x.win.reports || []).some((r) => r.reason === 'safety'))).map((x) => ({ type: 'post', ...x })),
    ...tickets.filter((t) => t.urgent && ['new', 'open'].includes(t.status)).map((t) => ({ type: 'ticket', ticket: t })),
  ];
  const drafts = pendingDrafts();
  const groups = {};
  for (const d of drafts) (groups[d.kind] = groups[d.kind] || []).push(d);
  const queued = deps.db.filter('drafts', (d) => d.status === 'queued');
  const openTickets = tickets.filter((t) => ['new', 'open'].includes(t.status));
  const draftForTicket = Object.fromEntries(deps.db.filter('drafts', (d) => d.key.startsWith('ticket:') && ['pending', 'queued'].includes(d.status)).map((d) => [d.key.slice(7), d]));
  let atRisk = [];
  try {
    atRisk = signals.buildQueues({ members: Object.values(users).map((u) => feedMember(u, { now })), app: {} }, { now }).atRisk;
  } catch (err) {
    console.warn('[member-ops] risk queue', err.message);
  }
  const last = h.circle.lastCall(now);
  const questions = deps.db.filter('circleQuestions', (q) => !last || ms(q.at) > last.at).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  // R19: the first live post per member in the last 7 days.
  const firstWins = [];
  if (winRepliesOn()) {
    const firstBy = {};
    for (const w of [...wins].reverse()) if (liveStatus(w) && !firstBy[w.userId]) firstBy[w.userId] = w;
    for (const w of Object.values(firstBy)) if (now - (ms(w.createdAt) || 0) <= 7 * DAY) firstWins.push(w);
  }
  const ageReviews = ageCheck.pending().map((u) => ({ u, r: u.ageReview, expired: ageCheck.confirmExpired(u, now), canAsk: ageCheck.askAllowed(u.ageReview) }));
  return {
    users, urgent, groups, drafts, queued, held, openTickets, draftForTicket, atRisk, questions, firstWins, ageReviews,
    notesFor, postingPaused, fmtCentral, lastCall: last, now, opsOn: !!opsToken(), winReplies: winRepliesOn(),
  };
}

module.exports = {
  api, routes, deps, _setDeps,
  // pure-ish pieces (tests and server.js)
  HELP_CATEGORIES, REPORT_REASONS, RELATIONSHIP_FOOTER, DEFAULT_RECEIPT, HOLD_MESSAGE,
  receiptFor, createTicket, screenPost, statusFor, blockMessage, afterScreen, visibleWins, visibleReplies, reportWin, replyToWin, cheerWin,
  decideWin, postingPaused, pausedMessage, saveCircleQuestion, callsIcs, stageDraft, approveDraft, approveKind, discardDraft, sendDraft, flushQueued, forgetFfRecaps,
  stageNote, notesFor, buildFeed, feedMember, nudgeFor, isQuiet, nextSendTime, unsubscribeUrl, verifyUnsubscribe, winRepliesOn, tokenOk,
};
