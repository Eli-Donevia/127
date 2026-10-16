// Member operations (lib/member-ops.js, ops/members/site-changes/SPEC.md): the token-protected ops API,
// drafts and Eli's approvals, quiet hours, Help tickets, the wins pre-screen and reports, the posting
// pause, the Circle call calendar and the billing facts the feed reads. No network: email and
// events are captured in memory.

const path = require('path');
const fs = require('fs');

// Own database file, so parallel test files never share one.
process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-member-ops-${process.pid}.json`);
process.env.BASE_URL = 'https://127.test';
process.env.ADMIN_EMAILS = 'eli@127.test';
process.env.SESSION_SECRET = 'test-secret-'.padEnd(40, 'x');
delete process.env.OPS_FEED_TOKEN;
delete process.env.POSTAL_ADDRESS;
delete process.env.STRIPE_SECRET_KEY;

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const ops = require('../lib/member-ops');
const circle = require('../lib/circle');
const integrations = require('../lib/integrations');
const billing = require('../lib/billing');
const moderation = require('../lib/moderation');

const NOON_CT = Date.parse('2026-11-02T18:00:00Z'); // Monday noon, Central (CST)
const NIGHT_CT = Date.parse('2026-11-03T05:00:00Z'); // 11pm Central
const EIGHT_CT = Date.parse('2026-11-03T14:00:00Z'); // 8am Central

let sent, events, now;
const TOKEN = 'a'.repeat(48);

test.before(async () => {
  await db.init();
});
// The store writes the file 100ms after the last save, so clean up when the process exits.
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
});
test.beforeEach(() => {
  sent = [];
  events = [];
  now = NOON_CT;
  ops._setDeps({ now: () => now, send: (m) => sent.push(m), emit: (type, payload) => events.push({ type, payload }), syncConsent: () => {} });
  delete process.env.POSTAL_ADDRESS;
  delete process.env.WIN_REPLIES;
});

let n = 0;
async function member(extra = {}) {
  n += 1;
  return db.save('users', { email: `m${n}-${Date.now()}@x.test`, name: `Sam${n} Lee`, tier: 'free', createdAt: new Date(NOON_CT - 30 * 864e5).toISOString(), ...extra });
}

async function server(h = {}) {
  const app = express();
  app.use('/ops', ops.api(h));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  return { url, close: () => new Promise((r) => srv.close(r)) };
}

test('ops API: 404 without OPS_FEED_TOKEN, or with a wrong or missing bearer token', async () => {
  const s = await server();
  try {
    assert.equal((await fetch(`${s.url}/ops/feed`)).status, 404);
    process.env.OPS_FEED_TOKEN = 'short';
    assert.equal((await fetch(`${s.url}/ops/feed`, { headers: { authorization: 'Bearer short' } })).status, 404, 'tokens under 32 characters leave the API off');
    process.env.OPS_FEED_TOKEN = TOKEN;
    assert.equal((await fetch(`${s.url}/ops/feed`)).status, 404);
    assert.equal((await fetch(`${s.url}/ops/feed`, { headers: { authorization: `Bearer ${'b'.repeat(48)}` } })).status, 404);
    const ok = await fetch(`${s.url}/ops/feed`, { headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('set-cookie'), null);
    assert.equal(ok.headers.get('access-control-allow-origin'), null);
  } finally {
    delete process.env.OPS_FEED_TOKEN;
    await s.close();
  }
});

test('ops feed leaks no secrets: no password hashes, reset tokens, chat, worksheets or Stripe ids', async () => {
  const u = await member({
    passwordHash: '$2a$10$SECRETHASH', resetHash: 'RESETHASH', verifyHash: 'VERIFYHASH', stripeCustomerId: 'cus_SECRET', stripeSubscriptionId: 'sub_SECRET',
    chat: [{ role: 'user', content: 'CHAT-CONTENT', at: new Date().toISOString() }], worksheets: { x: { a: 'WORKSHEET-CONTENT' } },
    aiHistory: [{ id: '1', tool: 't', input: { q: 'PROMPT-CONTENT' }, text: 'AI-OUTPUT', at: new Date().toISOString() }],
    ageReview: { status: 'open', source: 'playbook', flaggedAt: new Date().toISOString(), excerpt: [{ from: 'member', text: 'AGE-EXCERPT' }] },
    answers: { why: 'x'.repeat(400) },
  });
  process.env.OPS_FEED_TOKEN = TOKEN;
  const s = await server({ feedApp: () => ({ baseUrl: 'https://127.test' }) });
  try {
    const r = await fetch(`${s.url}/ops/feed`, { headers: { authorization: `Bearer ${TOKEN}` } });
    const text = await r.text();
    for (const secret of ['SECRETHASH', 'RESETHASH', 'VERIFYHASH', 'cus_SECRET', 'sub_SECRET', 'CHAT-CONTENT', 'WORKSHEET-CONTENT', 'PROMPT-CONTENT', 'AI-OUTPUT', 'AGE-EXCERPT']) {
      assert.ok(!text.includes(secret), `feed must not include ${secret}`);
    }
    const feed = JSON.parse(text);
    const m = feed.members.find((x) => x.id === u.id);
    assert.equal(m.answers.why.length, 280, 'member-written answers are clipped to 280 characters');
    assert.deepEqual(Object.keys(m.under18Flag).sort(), ['at', 'decidedAt', 'decision', 'source']);
    assert.equal(m.under18Flag.source, 'playbook');
  } finally {
    delete process.env.OPS_FEED_TOKEN;
    await s.close();
  }
});

test('POST /ops/drafts: stages a draft, never sends on create, and refuses a duplicate key', async () => {
  const u = await member();
  process.env.OPS_FEED_TOKEN = TOKEN;
  const s = await server();
  const post = (body) => fetch(`${s.url}/ops/drafts`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const body = { kind: 'checkin', key: 'checkin:week1', userId: u.id, subject: 'Quick check-in', body: 'How is week 1 going?', reason: 'Quiet for 5 days' };
    const r1 = await post(body);
    assert.equal(r1.status, 201);
    const j1 = await r1.json();
    assert.equal(j1.status, 'pending');
    const r2 = await post(body);
    assert.equal(r2.status, 409);
    assert.equal((await r2.json()).id, j1.id);
    assert.equal((await post({ kind: 'checkin', key: 'k2', userId: u.id, subject: '', body: 'x' })).status, 400);
    assert.equal(sent.length, 0, 'nothing sends until Eli approves');
    const d = db.get('drafts', j1.id);
    assert.equal(d.status, 'pending');
    assert.equal(d.edited, false);
  } finally {
    delete process.env.OPS_FEED_TOKEN;
    await s.close();
  }
});

test('approve sends once, from "Eli from 127" with the relationship footer, and writes the ticket thread', async () => {
  const u = await member();
  const t = await ops.createTicket(u, { category: 'roadmap', subject: 'Week 2', message: 'Where do I start on week 2?' });
  sent = [];
  const { draft } = await ops.stageDraft({ kind: 'support', key: `ticket:${t.ticket.id}`, userId: u.id, subject: 'Re: Week 2', body: 'Start with the first task.' });
  const out = await ops.approveDraft(draft.id, { subject: 'Re: Week 2', body: 'Start with the first task, then post a win.', by: 'eli@127.test' });
  assert.equal(out.status, 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, u.email);
  assert.equal(sent[0].fromName, 'Eli from 127');
  assert.equal(sent[0].replyTo, 'hello@127group.io');
  assert.ok(sent[0].text.endsWith(ops.RELATIONSHIP_FOOTER));
  const d = db.get('drafts', draft.id);
  assert.equal(d.status, 'sent');
  assert.equal(d.edited, true);
  const ticket = db.get('tickets', t.ticket.id);
  assert.equal(ticket.status, 'answered');
  assert.equal(ticket.thread.at(-1).from, 'eli');
  assert.ok(events.some((e) => e.type === 'ops.draft_sent'));
  const again = await ops.approveDraft(draft.id, {});
  assert.ok(again.error);
  assert.equal(sent.length, 1, 'a second approve sends nothing');
});

test('approve refuses an unfilled [[placeholder]], and needsAction needs "Done in Stripe"', async () => {
  const u = await member();
  const { draft } = await ops.stageDraft({ kind: 'refund', key: 'refund:1', userId: u.id, subject: 'Your refund', body: 'Hi [[first name]], done.', needsAction: 'Refund the first $19 payment in Stripe and end the plan' });
  assert.match((await ops.approveDraft(draft.id, {})).error, /placeholder/);
  const r = await ops.approveDraft(draft.id, { body: 'Hi Sam, done.' });
  assert.match(r.error, /Done in Stripe/);
  assert.equal(sent.length, 0);
  assert.equal((await ops.approveDraft(draft.id, { body: 'Hi Sam, done.', doneInStripe: true })).status, 'sent');
});

test('commercial notes never send without opt-in, an unsubscribe-free member and a postal address', async () => {
  const noOptIn = await member({ marketingOptIn: false });
  const a = await ops.stageDraft({ kind: 'founder_note', key: 'fn:1', userId: noOptIn.id, subject: 'A note', body: 'Hello', commercial: true });
  assert.ok((await ops.approveDraft(a.draft.id, {})).error);
  const optIn = await member({ marketingOptIn: true });
  const b = await ops.stageDraft({ kind: 'founder_note', key: 'fn:1', userId: optIn.id, subject: 'A note', body: 'Hello', commercial: true });
  assert.match((await ops.approveDraft(b.draft.id, {})).error, /POSTAL_ADDRESS/);
  const gone = await member({ marketingOptIn: true, unsubscribed: true });
  const c = await ops.stageDraft({ kind: 'founder_note', key: 'fn:1', userId: gone.id, subject: 'A note', body: 'Hello', commercial: true });
  process.env.POSTAL_ADDRESS = '1 Main St, Des Moines, IA 50309';
  assert.ok((await ops.approveDraft(c.draft.id, {})).error);
  assert.equal(sent.length, 0);
  assert.equal((await ops.approveDraft(b.draft.id, {})).status, 'sent');
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Unsubscribe: https:\/\/127\.test\/unsubscribe\?u=/);
  assert.match(sent[0].text, /1 Main St, Des Moines, IA 50309/);
  // The unsubscribe link is signed.
  const link = new URL(sent[0].text.match(/Unsubscribe: (\S+)/)[1]);
  assert.ok(ops.verifyUnsubscribe(link.searchParams.get('u'), link.searchParams.get('t')));
  assert.ok(!ops.verifyUnsubscribe(link.searchParams.get('u'), 'forged'));
});

test('quiet hours: an approval at 11pm Central waits until 8am', async () => {
  const u = await member();
  const { draft } = await ops.stageDraft({ kind: 'checkin', key: 'quiet:1', userId: u.id, subject: 'Hi', body: 'Checking in.' });
  now = NIGHT_CT;
  const out = await ops.approveDraft(draft.id, {});
  assert.equal(out.status, 'queued');
  assert.equal(Date.parse(out.sendAfter), EIGHT_CT);
  assert.equal(sent.length, 0);
  now = EIGHT_CT - 60000;
  assert.deepEqual(await ops.flushQueued(), []);
  now = EIGHT_CT + 60000;
  const flushed = await ops.flushQueued();
  assert.equal(flushed.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(db.get('drafts', draft.id).status, 'sent');
});

test("R09: an approved builder_day3 note sets eli_note_day3_at for Klaviyo's Flow G", async () => {
  const u = await member({ tier: 'builder' });
  const { draft } = await ops.stageDraft({ kind: 'builder_day3', key: 'builder_day3', userId: u.id, subject: 'Day 3', body: 'How is it going?' });
  assert.equal(integrations.memberProfile(u).eli_note_day3_at, undefined);
  await ops.approveDraft(draft.id, {});
  const saved = db.get('users', u.id);
  assert.equal(saved.eliNoteDay3At, new Date(NOON_CT).toISOString());
  assert.equal(integrations.memberProfile(saved).eli_note_day3_at, saved.eliNoteDay3At);
  assert.ok(events.some((e) => e.type === 'profile.updated' && e.payload.userId === u.id));
});

test('Help: a crisis ticket shows the 988 message, becomes safety and emails the admin at once', async () => {
  const u = await member();
  const out = await ops.createTicket(u, { category: 'other', subject: 'hard week', message: 'honestly I want to die, nothing is working' });
  assert.ok(out.crisis);
  assert.equal(out.ticket.category, 'safety');
  assert.match(moderation.CRISIS_MESSAGE, /988/);
  const receipt = sent.find((m) => m.to === u.email);
  assert.ok(receipt.text.includes(moderation.CRISIS_MESSAGE));
  assert.ok(sent.some((m) => m.to === 'eli@127.test' && /Urgent/.test(m.subject)));
  assert.ok(events.some((e) => e.type === 'safety.flagged'));
  assert.ok(events.some((e) => e.type === 'ticket.created'));
});

test('Help: receipts fit the category, and bad input is refused', async () => {
  const u = await member();
  assert.equal((await ops.createTicket(u, { category: 'refund', subject: 'Refund', message: 'Please refund' })).receipt, "Got it. Eli reads every refund request himself, and you'll hear back within one business day.");
  assert.equal((await ops.createTicket(u, { category: 'privacy', subject: 'Data', message: 'Delete my data' })).receipt, "We've received your privacy request. We'll confirm it within 10 business days and complete it within 45 days.");
  assert.match((await ops.createTicket(u, { category: 'cancel', subject: 'Cancel', message: 'Cancel me' })).receipt, /^You can cancel any time in Billing with one tap: https:\/\/127\.test\/app\/billing\./);
  assert.equal((await ops.createTicket(u, { category: 'ai', subject: 'AI', message: 'It broke' })).receipt, ops.DEFAULT_RECEIPT);
  assert.ok((await ops.createTicket(u, { category: 'nope', subject: '', message: '' })).errors.length >= 2);
});

test('wins pre-screen: allow goes live, hold waits, block is refused', () => {
  const u = { id: 'pre-screen', createdAt: new Date(NOON_CT - 60 * 864e5).toISOString(), tier: 'builder' };
  const allow = ops.screenPost(u, 'First sale! $40 for a logo package.');
  assert.equal(allow.action, 'allow');
  assert.equal(ops.statusFor(allow), 'live');
  const hold = ops.screenPost(u, 'email me at sam@example.com for the template');
  assert.equal(ops.statusFor(hold), 'held');
  const block = ops.screenPost(u, 'send nudes');
  assert.equal(block.action, 'block');
  assert.ok(ops.blockMessage(block).length > 0);
});

test('wins: two reports hide a post, the author still sees it, and Eli decides (heldAt, decidedAt, decision in the feed)', async () => {
  const author = await member();
  const a = await member();
  const b = await member();
  const win = await db.save('wins', { userId: author.id, name: 'Sam', text: 'Launched my page', tier: 'free', status: 'live' });
  assert.equal((await ops.reportWin(author, win.id, 'spam')).error, 'Nothing to report.');
  assert.equal((await ops.reportWin(a, win.id, 'spam')).hidden, false);
  await ops.reportWin(a, win.id, 'spam');
  assert.equal(db.get('wins', win.id).reports.length, 1, 'one report per member');
  assert.equal((await ops.reportWin(b, win.id, 'harmful')).hidden, true);
  const w = db.get('wins', win.id);
  assert.equal(w.status, 'reported');
  assert.ok(w.heldAt);
  assert.ok(!ops.visibleWins(a, [w]).length);
  assert.equal(ops.visibleWins(author, [w]).length, 1);
  await ops.decideWin(win.id, 'approve', 'eli@127.test');
  const feed = ops.buildFeed({});
  const f = feed.wins.find((x) => x.id === win.id);
  assert.equal(f.status, 'live');
  assert.equal(f.decision, 'approved');
  assert.ok(f.heldAt && f.decidedAt);
});

test('posting pause: 7 days with no replies, and its message names the date', async () => {
  process.env.WIN_REPLIES = '1';
  const author = await member();
  const u = await member({ postingPausedUntil: new Date(NOON_CT + 7 * 864e5).toISOString() });
  const win = await db.save('wins', { userId: author.id, name: 'Sam', text: 'A win', tier: 'free', status: 'live' });
  const r = await ops.replyToWin(u, win.id, 'Nice one');
  assert.match(r.error, /Posting is paused on your account until November 9/);
  now = NOON_CT + 8 * 864e5;
  assert.ok((await ops.replyToWin(u, win.id, 'Nice one')).ok);
});

test('call.ics: one event per call in circle-calls.json, at the right UTC times', () => {
  const env = {
    CIRCLE_CALL_TIME: 'Thursdays, 8pm ET (holiday weeks move to Tuesday)',
    CIRCLE_KICKOFF_AT: '2026-11-25T01:00:00Z',
    CIRCLE_CALL_MOVES: '2026-12-24>2026-12-22,2026-12-31>2026-12-29,2027-11-25>2027-11-23',
    CIRCLE_CALL_SKIPS: '2027-04-22,2027-10-21',
  };
  const { calls } = require('./fixtures/circle-calls.json');
  const from = Date.parse(calls[0].start) - 1;
  const to = Date.parse(calls.at(-1).start) + 1;
  const { text, count } = ops.callsIcs(circle, { from, to, env, url: 'https://discord.test/room', now: NOON_CT });
  assert.equal(count, calls.length);
  const fmt = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const starts = [...text.matchAll(/^DTSTART:(\S+)\r$/gm)].map((m) => m[1]);
  const ends = [...text.matchAll(/^DTEND:(\S+)\r$/gm)].map((m) => m[1]);
  assert.deepEqual(starts, calls.map((c) => fmt(c.start)));
  assert.deepEqual(ends, calls.map((c) => fmt(c.end)));
  assert.equal(starts[0], '20261125T010000Z');
  assert.ok(text.includes('SUMMARY:127 Founder\'s Circle kickoff'));
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n') && text.endsWith('END:VCALENDAR\r\n'));
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line}`);
});

test('Circle questions are saved for the next call', async () => {
  const u = await member({ tier: 'circle' });
  const out = await ops.saveCircleQuestion(u, 'How do I price my first package?', circle, { CIRCLE_KICKOFF_AT: '2026-11-25T01:00:00Z' });
  assert.equal(out.question.callKey, '2026-11-25T01:00:00.000Z');
  assert.ok(events.some((e) => e.type === 'circle.question'));
});

test('billing facts on tier changes: planHistory, tierSince, paidSince, canceledAt', async () => {
  const u = await member();
  await billing.setTier(u, 'builder');
  assert.equal(u.planHistory.length, 1);
  assert.deepEqual({ from: u.planHistory[0].from, to: u.planHistory[0].to }, { from: 'free', to: 'builder' });
  assert.ok(u.paidSince && u.tierSince);
  assert.equal(u.canceledAt, undefined);
  await billing.setTier(u, 'free');
  assert.equal(u.planHistory.length, 2);
  assert.ok(u.canceledAt);
  const fm = ops.feedMember(u);
  assert.equal(fm.billing.planHistory.length, 2);
  assert.equal(fm.billing.canceledAt, u.canceledAt);
});
