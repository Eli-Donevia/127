// Founder's Circle logic (lib/circle.js) against an in-memory store: decisions, the 72-hour
// claim window, the waiting line, 6-month approvals, former members, seats, the call schedule,
// Scorecards, recaps and the Klaviyo properties. No db file, email or network.
// Run with: npm test

const test = require('node:test');
const assert = require('node:assert');
const circle = require('../lib/circle');
const emails = require('../lib/circle-emails');
const markdown = require('../lib/markdown');

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const ENV = {
  CIRCLE_CALL_TIME: 'Thursdays, 8pm ET (holiday weeks move to Tuesday)',
  CIRCLE_KICKOFF_AT: '2026-11-25T01:00:00Z',
  CIRCLE_KICKOFF_CLAIM_BY: '2026-11-24T23:00:00Z',
  CIRCLE_CALL_MOVES: '2026-12-24>2026-12-22,2026-12-31>2026-12-29',
  CIRCLE_CALL_SKIPS: '2027-04-22',
  CIRCLE_COMMUNITY_URL: 'https://discord.gg/test',
  CIRCLE_FIT_CALL_URL: 'https://cal.example/eli',
  BASE_URL: 'https://127.test',
};
const T0 = Date.parse('2026-11-18T15:00:00Z');

function memStore() {
  const data = {};
  let n = 0;
  const col = (c) => (data[c] = data[c] || {});
  return {
    data,
    all: (c) => Object.values(col(c)),
    get: (c, id) => col(c)[id] || null,
    find: (c, p) => Object.values(col(c)).find(p) || null,
    filter: (c, p) => Object.values(col(c)).filter(p),
    save: async (c, doc) => {
      if (!doc.id) doc.id = `${c}_${++n}`;
      if (!doc.createdAt) doc.createdAt = new Date(T0 + n).toISOString();
      col(c)[doc.id] = doc;
      return doc;
    },
    remove: async (c, id) => delete col(c)[id],
  };
}

function world(opts = {}) {
  const store = memStore();
  const sent = [];
  const events = [];
  const c = circle.ctx({ store, now: opts.now || T0, capacity: opts.capacity || 4, env: ENV, base: 'https://127.test', admin: 'eli@127.test', send: (m) => sent.push(m), emit: (t, p) => events.push({ t, p }), post: async () => true });
  return { store, sent, events, c, at: (t) => Object.assign(c, { now: t }) };
}
async function addUser(w, name, extra = {}) {
  return w.store.save('users', { email: `${name.toLowerCase()}@x.test`, name, tier: 'free', ...extra });
}
async function addApp(w, user, extra = {}) {
  return w.store.save('applications', { v: 2, userId: user.id, email: user.email, name: user.name, business: 'b', revenue: 'r', challenge: 'c', result13: '10 paying customers', time: 'yes', status: 'pending', ...extra });
}
async function fillTable(w, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(await addUser(w, `Member${i}`, { tier: 'circle' }));
  await circle.syncMembers(w.c);
  return out;
}
const subjects = (w) => w.sent.map((m) => m.subject);

test('old applications are migrated when read, without breaking', () => {
  const declined = circle.normalizeApplication({ status: 'declined', commitment: 'Mostly, I travel', createdAt: '2026-10-01T00:00:00Z' });
  assert.strictEqual(declined.status, 'not_yet');
  assert.strictEqual(declined.time, 'mostly');
  assert.strictEqual(declined.timeNote, 'Mostly, I travel');
  const approved = circle.normalizeApplication({ status: 'approved', commitment: 'yes', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' });
  assert.strictEqual(approved.approvedAt, '2026-10-02T00:00:00Z');
  assert.strictEqual(approved.time, 'yes');
  assert.strictEqual(circle.normalizeApplication(approved), approved);
  assert.strictEqual(circle.normalizeApplication({ status: 'pending' }).result13, '');
});

test('approve with a seat open: 72-hour offer, email 2, seat held', async () => {
  const w = world();
  const u = await addUser(w, 'Maya');
  const a = await addApp(w, u);
  const r = await circle.decide(w.c, a, 'approve');
  assert.deepStrictEqual([r.ok, r.offered, r.seat], [true, true, 1]);
  assert.strictEqual(Date.parse(a.offer.expiresAt) - T0, 72 * HOUR);
  assert.strictEqual(circle.appState(a, u, w.c.now), 'offered');
  assert.deepStrictEqual(subjects(w), ["You're in: your seat is ready"]);
  assert.match(w.sent[0].text, /Seat 01 is yours to claim for the next 72 hours/);
  assert.match(w.sent[0].text, /Tuesday, November 24 at 8pm ET \(the kickoff\)/);
  // The offer holds a seat for everyone else, but not against the person it's for.
  assert.strictEqual(circle.seatsLeft(w.c), 3);
  assert.strictEqual(circle.seatsLeft(w.c, u.id), 4);
});

test('an admin on the Circle plan holds no seat; an unconfirmed admin email does', async () => {
  const w = world();
  const old = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'eli@x.test';
  try {
    await addUser(w, 'Eli', { tier: 'circle', emailVerified: true });
    assert.strictEqual(circle.seatsLeft(w.c), 4);
    assert.deepStrictEqual(circle.members(w.c), [], 'and is not in the roster');
    w.store.all('users')[0].emailVerified = false;
    assert.strictEqual(circle.seatsLeft(w.c), 3);
  } finally {
    if (old === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = old;
  }
});

test('approve when the table is full: approved and waiting, in approval order (email 5)', async () => {
  const w = world();
  await fillTable(w, 4);
  const a1 = await addApp(w, await addUser(w, 'Ann'));
  const a2 = await addApp(w, await addUser(w, 'Ben'));
  w.at(T0 + HOUR);
  const r1 = await circle.decide(w.c, a1, 'approve');
  w.at(T0 + 2 * HOUR);
  const r2 = await circle.decide(w.c, a2, 'approve');
  assert.deepStrictEqual([r1.offered, r1.position, r2.offered, r2.position], [false, 1, false, 2]);
  assert.deepStrictEqual(circle.queue(w.c).map((a) => a.name), ['Ann', 'Ben']);
  assert.match(w.sent.find((m) => m.to === 'ben@x.test').text, /you're second in line/);
  assert.strictEqual(circle.seatsLeft(w.c), 0);
});

test('a seat opens: first in line gets 72 hours (email 6); reminder 24h before the end; then it passes on', async () => {
  const w = world();
  const members = await fillTable(w, 4);
  const ann = await addUser(w, 'Ann');
  const ben = await addUser(w, 'Ben');
  const a1 = await addApp(w, ann);
  const a2 = await addApp(w, ben);
  await circle.decide(w.c, a1, 'approve');
  w.at(T0 + HOUR);
  await circle.decide(w.c, a2, 'approve');
  w.sent.length = 0;

  // Member 2 (Seat 02) leaves.
  const t1 = T0 + DAY;
  w.at(t1);
  members[1].tier = 'free';
  await circle.tick(w.c);
  assert.strictEqual(circle.appState(a1, ann, t1), 'offered');
  assert.strictEqual(a1.offer.seat, 2);
  assert.strictEqual(circle.appState(a2, ben, t1), 'waiting');
  assert.ok(subjects(w).includes('A seat just opened'));
  assert.ok(w.sent.some((m) => m.to === 'eli@127.test' && /Remove Member1's Member role/.test(m.text)));

  // 47 hours in: no reminder yet. 48 hours in: one reminder.
  w.sent.length = 0;
  w.at(t1 + 47 * HOUR);
  await circle.tick(w.c);
  assert.strictEqual(w.sent.length, 0);
  w.at(t1 + 48 * HOUR);
  await circle.tick(w.c);
  await circle.tick(w.c);
  assert.deepStrictEqual(subjects(w), [`Your seat is held until ${circle.fmtDayTime(t1 + 72 * HOUR)}`]);

  // Mid-checkout at the end of the window: the 30-minute hold finishes first.
  ann.circleHoldUntil = t1 + 72 * HOUR + 20 * 60e3;
  w.at(t1 + 72 * HOUR);
  await circle.tick(w.c);
  assert.strictEqual(circle.appState(a1, ann, w.c.now), 'offered');

  // Window over, no payment: Ann is passed (email 4), Ben gets the seat (email 6).
  w.sent.length = 0;
  ann.circleHoldUntil = null;
  w.at(t1 + 73 * HOUR);
  await circle.tick(w.c);
  assert.strictEqual(circle.appState(a1, ann, w.c.now), 'passed');
  assert.strictEqual(circle.appState(a2, ben, w.c.now), 'offered');
  assert.deepStrictEqual(subjects(w).sort(), ['A seat just opened', 'Your seat went to the next founder']);
  assert.match(w.sent.find((m) => m.subject === 'A seat just opened').text, /Seat 02 is open/);

  // Ann says she's ready: back in line in approval order, ahead of anyone approved later.
  const late = await addApp(w, await addUser(w, 'Cat'));
  await circle.decide(w.c, late, 'approve');
  await circle.backInLine(w.c, a1);
  assert.deepStrictEqual(circle.queue(w.c).map((a) => a.name), ['Ann', 'Cat']);
});

test('claiming: seat number from the offer, Founding Seat for the first four ever, notice to Eli', async () => {
  const w = world({ capacity: 4 });
  const first = await fillTable(w, 3);
  assert.deepStrictEqual(first.map((u) => [u.circle.seat, u.circle.founding]), [[1, true], [2, true], [3, true]]);
  const u = await addUser(w, 'Dee');
  const a = await addApp(w, u);
  await circle.decide(w.c, a, 'approve');
  assert.strictEqual(a.offer.seat, 4);
  u.tier = 'circle'; // billing.setTier after checkout
  w.at(T0 + HOUR);
  await circle.tick(w.c);
  assert.strictEqual(u.circle.seat, 4);
  assert.strictEqual(u.circle.founding, true);
  assert.ok(a.claimedAt && a.offer.claimedAt);
  assert.strictEqual(circle.appState(a, u, w.c.now), 'member');
  assert.ok(w.sent.some((m) => m.to === 'eli@127.test' && m.text === 'Dee took Seat 04. Give them the Member role in Discord.'));
  assert.strictEqual(u.founderProfile.buildTarget, '10 paying customers');

  // The fifth member ever is not a Founding Seat, and takes the seat that is free.
  first[0].tier = 'free';
  await circle.tick(w.c);
  const e = await addUser(w, 'Eve', { tier: 'circle' });
  await circle.tick(w.c);
  assert.deepStrictEqual([e.circle.seat, e.circle.founding, e.circle.order], [1, false, 5]);
});

test('approvals stand for 6 months, then lapse', async () => {
  const w = world();
  await fillTable(w, 4);
  const u = await addUser(w, 'Ann');
  const a = await addApp(w, u);
  await circle.decide(w.c, a, 'approve');
  const exp = circle.approvalExpiresAt(a);
  assert.strictEqual(new Date(exp).toISOString(), '2027-05-18T15:00:00.000Z');
  assert.ok(circle.approvalValid(a, exp - 1));
  assert.ok(!circle.approvalValid(a, exp));
  w.at(exp + 1);
  await circle.tick(w.c);
  assert.strictEqual(a.status, 'lapsed');
  assert.ok(circle.canApply(a, u, w.c.now));
  // A lapsed approval no longer passes the checkout route's "approved" check.
  assert.notStrictEqual(a.status, 'approved');
});

test('former members in good standing skip the application for 6 months', async () => {
  const w = world();
  const [m] = await fillTable(w, 1);
  const app = await addApp(w, m, { status: 'approved', approvedAt: new Date(T0).toISOString() });
  m.tier = 'free';
  w.at(T0 + DAY);
  await circle.tick(w.c);
  assert.ok(circle.isFormer(m));
  assert.strictEqual(m.circle.goodStanding, true);
  assert.strictEqual(app.status, 'left');
  assert.ok(circle.returningEligible(m, w.c.now));
  assert.ok(!circle.canApply(app, m, w.c.now));
  assert.ok(!circle.returningEligible(m, circle.addMonths(T0 + DAY, 6) + 1));

  const r = await circle.rejoin(w.c, m);
  assert.deepStrictEqual([r.ok, r.offered], [true, true]);
  assert.strictEqual(app.offer.seat, 1);
  assert.strictEqual(app.status, 'approved');
});

test('a returning member waits behind approved applicants already in line', async () => {
  const w = world({ capacity: 2 });
  const [m1] = await fillTable(w, 2);
  const waiting = await addApp(w, await addUser(w, 'Ann'));
  await circle.decide(w.c, waiting, 'approve');
  m1.tier = 'free';
  w.at(T0 + HOUR);
  await circle.tick(w.c); // Ann is offered m1's seat
  const r = await circle.rejoin(w.c, m1);
  assert.deepStrictEqual([r.offered, r.position], [false, 1]);
});

test('leaving with a failing card, or marked by Eli, is not good standing', async () => {
  const w = world();
  const [m] = await fillTable(w, 1);
  m.paymentIssue = { at: 'x' };
  await circle.tick(w.c);
  m.tier = 'free';
  m.paymentIssue = null;
  await circle.tick(w.c);
  assert.strictEqual(m.circle.goodStanding, false);
  assert.ok(!circle.returningEligible(m, w.c.now));
  assert.ok(circle.canApply(circle.appFor(w.c, m.id), m, w.c.now));
});

test('decisions: not yet needs a reason; fit calls cap at 4 a week; decline email', async () => {
  const w = world();
  const apps = [];
  for (let i = 0; i < 6; i++) apps.push(await addApp(w, await addUser(w, `A${i}`)));
  assert.ok((await circle.decide(w.c, apps[0], 'not_yet', { reason: 'Still choosing' })).error);
  const ny = await circle.decide(w.c, apps[0], 'not_yet', { reason: 'You are still choosing between two ideas', change: '10 real conversations' });
  assert.ok(ny.ok);
  assert.match(w.sent.at(-1).text, /Not yet\. You are still choosing between two ideas\./);
  assert.match(w.sent.at(-1).text, /Until then, Builder is built for exactly this stage/);
  assert.ok(circle.canApply(apps[0], null, w.c.now));
  for (let i = 1; i <= 4; i++) assert.ok((await circle.decide(w.c, apps[i], 'fit_call')).ok);
  assert.match((await circle.decide(w.c, apps[5], 'fit_call')).error, /4 fit calls/);
  assert.match(w.sent.find((m) => m.subject === '10 minutes with Eli?').text, /https:\/\/cal\.example\/eli/);
  await circle.decide(w.c, apps[5], 'decline');
  assert.strictEqual(w.sent.at(-1).subject, 'About your application');
  assert.ok(!circle.canApply(apps[5], null, w.c.now));
});

test('apply: six questions, the 18+ and handbook box, received email, re-apply after not yet', async () => {
  const w = world();
  const u = await addUser(w, 'Sam');
  const bad = await circle.apply(w.c, u, { business: 'x' });
  assert.ok(bad.errors.length >= 5);
  const body = { business: 'Tutoring', revenue: '3 clients', challenge: 'Pricing', result13: '10 clients', time: 'mostly', timeNote: 'Travel in Dec', agree: 'on', link: 'https://x.test' };
  const { app } = await circle.apply(w.c, u, body);
  assert.deepStrictEqual([app.status, app.result13, app.time, app.link], ['pending', '10 clients', 'mostly', 'https://x.test']);
  assert.strictEqual(w.sent.at(-1).subject, 'Got your application');
  assert.ok((await circle.apply(w.c, u, body)).errors);
  await circle.decide(w.c, app, 'not_yet', { reason: 'r', change: 'c' });
  const again = await circle.apply(w.c, u, { ...body, revenue: '8 clients' });
  assert.strictEqual(again.app.id, app.id);
  assert.strictEqual(again.app.status, 'pending');
  assert.strictEqual(again.app.previous.at(-1).revenue, '3 clients');
  assert.strictEqual(again.app.notYet, undefined);
});

test('the call schedule: kickoff, Thanksgiving week, holiday moves, Founder Days skip, first call', () => {
  const kickoff = Date.parse(ENV.CIRCLE_KICKOFF_AT);
  assert.strictEqual(circle.nextCall(T0, ENV).at, kickoff);
  assert.ok(circle.nextCall(T0, ENV).kickoff);
  const after = circle.nextCall(kickoff, ENV);
  assert.strictEqual(circle.fmtLong(after.at), 'Thursday, December 3 at 8pm ET');
  const dec = circle.callsBetween(Date.parse('2026-12-15T00:00:00Z'), Date.parse('2027-01-10T00:00:00Z'), ENV).map((c) => circle.fmtShort(c.at));
  assert.deepStrictEqual(dec, ['Thu Dec 17', 'Tue Dec 22', 'Tue Dec 29', 'Thu Jan 7']);
  const apr = circle.callsBetween(Date.parse('2027-04-10T00:00:00Z'), Date.parse('2027-05-01T00:00:00Z'), ENV).map((c) => circle.fmtShort(c.at));
  assert.deepStrictEqual(apr, ['Thu Apr 15', 'Thu Apr 29']);
  // Summer time: still 8pm in New York.
  assert.strictEqual(circle.fmtClock(circle.nextCall(Date.parse('2027-06-01T00:00:00Z'), ENV).at), '8pm');
  assert.ok(circle.firstCallFor(Date.parse('2026-11-24T22:59:00Z'), ENV).kickoff);
  assert.strictEqual(circle.fmtShort(circle.firstCallFor(Date.parse('2026-11-24T23:30:00Z'), ENV).at), 'Thu Dec 3');
  assert.deepStrictEqual(circle.blockWeek(Date.parse('2027-02-19T01:00:00Z'), ENV), { week: 13, block: 1 });
  assert.deepStrictEqual(circle.blockWeek(Date.parse('2027-02-26T01:00:00Z'), ENV), { week: 1, block: 2 });
});

test('Scorecard window: opens 48h before, due midnight ET the night before, late after', () => {
  const call = circle.nextCall(Date.parse('2026-12-08T00:00:00Z'), ENV); // Thu Dec 10, 8pm ET
  const w = circle.scorecardWindow(call);
  assert.strictEqual(new Date(w.opensAt).toISOString(), '2026-12-09T01:00:00.000Z'); // Tue 8pm ET
  assert.strictEqual(new Date(w.remindAt).toISOString(), '2026-12-09T14:00:00.000Z'); // Wed 9am ET
  assert.strictEqual(new Date(w.dueAt).toISOString(), '2026-12-10T05:00:00.000Z'); // midnight ET Wed/Thu
});

test('Scorecard: commitments pre-fill from the last recap, validation, late flag, founderProfile', async () => {
  const w = world();
  const [m] = await fillTable(w, 1);
  m.circle.profile = { northLabel: 'Paying customers', northToday: '3', buildTarget: '10 by Feb 18', building: 'Cases' };
  const dec3 = Date.parse('2026-12-04T01:00:00Z');
  await w.store.save('circleRecaps', { callKey: new Date(dec3).toISOString(), callAt: new Date(dec3).toISOString(), post: 'x', members: { [m.id]: { commitments: ['Order 120 units', 'Email supplier'] } } });
  w.at(Date.parse('2026-12-10T12:00:00Z')); // Thursday morning: past due, before the call
  const st = circle.scorecardStatus(w.c, m.id);
  assert.strictEqual(st.state, 'late');
  assert.deepStrictEqual(circle.commitmentsFor(w.c, m.id, st.call), ['Order 120 units', 'Email supplier']);
  const bad = await circle.saveScorecard(w.c, m, { c0_status: 'done', hotSeat: 'need', attendance: 'yes', inTheWay: 'x', number: '' });
  assert.ok(bad.errors.some((e) => /commitment/.test(e)) && bad.errors.some((e) => /number/.test(e)) && bad.errors.some((e) => /situation/.test(e)));
  const ok = await circle.saveScorecard(w.c, m, { c0_status: 'done', c1_status: 'partly', number: '4', inTheWay: 'Cash', hotSeat: 'no', attendance: 'yes', numberShare: 'eli', privateNote: 'car' });
  assert.ok(ok.card.late);
  assert.strictEqual(ok.card.number, 4);
  assert.deepStrictEqual(m.founderProfile.commitments, [{ text: 'Order 120 units', done: true, status: 'done' }, { text: 'Email supplier', done: false, status: 'partly' }]);
  assert.deepStrictEqual(m.founderProfile.scorecard.map((s) => s.value), [4]);
  assert.strictEqual(m.founderProfile.northNumber, 'Paying customers: 3');
  assert.strictEqual(m.founderProfile.building, 'Cases');
});

test('recap: placeholders block sending; commitments go first in each email; history recorded', async () => {
  const w = world();
  const [m1, m2] = await fillTable(w, 2);
  const call = circle.nextCall(Date.parse('2026-12-08T00:00:00Z'), ENV);
  w.at(call.at + 12 * HOUR);
  const draft = circle.recapDraft(w.c, circle.lastCall(w.c.now, ENV));
  assert.match(draft, /\*\*Circle recap · Thu Dec 10 · Week 3 of Block 1\*\*/);
  assert.match(draft, /Scorecard opens Tue Dec 15 8pm ET, due midnight ET Wednesday night\./);
  const blocked = await circle.sendRecap(w.c, { post: draft, body: {} });
  assert.match(blocked.error, /placeholder/);
  const post = `**Circle recap · Thu Dec 10**\n2 of 2 at the table\n\n**Commitments for Thu Dec 17**\n${circle.COMMITMENTS_TOKEN}\n\nSee [the library](https://127.test/app/library).`;
  const body = { [`commit_${m1.id}`]: 'Order 120 units\nEmail supplier', [`attend_${m1.id}`]: 'attended', [`hot_${m1.id}`]: 'on', [`attend_${m2.id}`]: 'missed' };
  const r = await circle.sendRecap(w.c, { post, body });
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.sent, 2);
  const mail1 = w.sent.find((m) => m.to === m1.email);
  assert.strictEqual(mail1.subject, 'Circle recap: Thu Dec 10');
  assert.match(mail1.text, /^Your commitments: Order 120 units; Email supplier\.\n\nSeat 01/);
  assert.match(mail1.text, /Member0: Order 120 units; Email supplier/);
  assert.deepStrictEqual(circle.historyFor(w.c, m1.id).map((h) => [h.attendance, h.hotSeat]), [['attended', true]]);
  assert.deepStrictEqual(circle.historyFor(w.c, m2.id).map((h) => h.attendance), ['missed']);
  assert.match((await circle.sendRecap(w.c, { post, body })).error, /already sent/);
  // Next week's Scorecard pre-fills from it.
  assert.deepStrictEqual(m1.founderProfile.commitments.map((x) => x.text), ['Order 120 units', 'Email supplier']);
});

test('circleProfile: Klaviyo properties for members and approved applicants only', async () => {
  const w = world();
  const outsider = await addUser(w, 'Out');
  assert.deepStrictEqual(circle.circleProfile(outsider, { store: w.store, now: T0, env: ENV }), {});
  const early = await addUser(w, 'Early', { tier: 'circle', circle: { joinedAt: '2026-11-20T12:00:00Z' } });
  const late = await addUser(w, 'Late', { tier: 'circle', circle: { joinedAt: '2026-11-24T23:30:00Z' } });
  assert.deepStrictEqual(circle.circleProfile(early, { store: w.store, now: T0, env: ENV }), {
    circle_first_call: '2026-11-25T01:00:00.000Z',
    circle_first_call_text: 'Tuesday, November 24 at 8pm ET (the kickoff)',
    circle_discord_url: 'https://discord.gg/test',
    circle_profile_url: 'https://127.test/app/circle#profile',
    circle_handbook_url: 'https://127.test/app/circle/handbook',
    // Not joined yet (billing moved them, the tick hasn't run): the seat they are taking.
    circle_seat: '01',
    circle_founding_seat: true,
  });
  const fifth = await addUser(w, 'Fifth', { tier: 'circle', circle: { order: 5, seat: 3, joinedAt: '2026-11-20T12:00:00Z' } });
  assert.deepStrictEqual([circle.circleProfile(fifth, { store: w.store, now: T0, env: ENV })].map((p) => [p.circle_seat, p.circle_founding_seat]), [['03', false]]);
  assert.strictEqual(circle.circleProfile(late, { store: w.store, now: T0, env: ENV }).circle_first_call_text, 'Thursday, December 3 at 8pm ET');
  assert.strictEqual(circle.circleProfile(late, { store: w.store, now: T0, env: ENV }).circle_first_call, '2026-12-04T01:00:00.000Z');
});

test('emails: copy from applications.md, no em dashes', () => {
  const all = [
    emails.received({ name: 'Maya Lee' }),
    emails.approvedSeatOpen({ name: 'Maya', seatNo: 2, claimUrl: 'u', firstCall: 'f', handbookUrl: 'h', profileUrl: 'p' }),
    emails.claimReminder({ seatNo: 2, until: 'Fri 8pm ET', claimUrl: 'u' }),
    emails.claimEnded(),
    emails.approvedWaiting({ name: 'Maya', position: 1 }),
    emails.seatOpened({ seatNo: 3, claimUrl: 'u' }),
    emails.fitCall({ name: 'Maya', bookingUrl: 'b' }),
    emails.notYet({ name: 'Maya', reason: 'r', change: 'c', nextStep: 'Builder' }),
    emails.decline({ name: 'Maya' }),
    emails.recap({ callLabel: 'Thu Dec 10', commitments: ['a'], seatNo: 1, post: 'p', circleUrl: 'u' }),
  ];
  for (const e of all) assert.ok(!/[—–]/.test(e.subject + e.text), e.subject);
  assert.match(all[0].text, /^Thanks, Maya\. Eli reads every/);
  assert.match(all[4].text, /you're first in line/);
});

test('handbook markdown keeps the #the-charter anchor', () => {
  const html = markdown.render(require('fs').readFileSync(require('path').join(__dirname, '..', 'content', 'circle-handbook.md'), 'utf8'));
  assert.match(html, /<h2 id="the-charter">The Charter<\/h2>/);
  assert.match(html, /<table class="t">/);
  assert.ok(!/<script/i.test(markdown.render('<script>x</script>')));
});

test('a Founding Seat keeps the founding Circle price through Builder and back, and loses it on cancel (C33)', async () => {
  const w = world();
  const [a, , , , e] = await fillTable(w, 5);
  assert.strictEqual(circle.foundingCirclePrice(a), true);
  assert.strictEqual(circle.foundingCirclePrice(e), false, 'the fifth member ever is not a Founding Seat');
  a.tier = 'builder';
  await circle.syncMembers(w.c);
  assert.strictEqual(circle.foundingCirclePrice(a), true, 'a move to Builder keeps it');
  a.tier = 'circle';
  await circle.syncMembers(w.c);
  assert.strictEqual(circle.foundingCirclePrice(a), true, 'and back');
  a.tier = 'builder';
  await circle.syncMembers(w.c);
  a.tier = 'free';
  await circle.syncMembers(w.c);
  assert.strictEqual(circle.foundingCirclePrice(a), false, 'cancelling Builder ends it');
  a.tier = 'circle';
  await circle.syncMembers(w.c);
  assert.strictEqual(circle.foundingCirclePrice(a), false, 'coming back pays the price at that time');
  assert.strictEqual(a.circle.founding, true, 'the Founding Seat mark stays for good');
});

test('the founding Circle price ends when the membership lapses to Free, and survives a paused plan', async () => {
  const w = world();
  const [a, b] = await fillTable(w, 2);
  a.tier = 'free';
  a.paymentIssue = true;
  b.tier = 'free';
  b.pausedTier = 'builder';
  await circle.syncMembers(w.c);
  assert.strictEqual(circle.foundingCirclePrice(a), false);
  assert.strictEqual(circle.foundingCirclePrice(b), true);
});
