// Day One Challenge (lib/challenge.js): dates and phases, joining, check-ins, finishers,
// early access, roadmap carry-over, consent, signed links and the admin helpers.
// Run with: npm test   (no network: Klaviyo, Resend and Anthropic keys are unset)

for (const k of ['KLAVIYO_PRIVATE_KEY', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY', 'DATABASE_URL', 'JOIN_IS_LAUNCH_CONSENT', 'CHALLENGE_START_AT', 'CHALLENGE_FAKE_NOW', 'LAUNCH_AT', 'EARLY_ACCESS_AT']) delete process.env[k];
process.env.CHALLENGE_START_AT = '2026-11-09T13:00:00Z'; // blank turns the challenge off
process.env.SESSION_SECRET = 'test-secret';
process.env.BASE_URL = 'https://127.test';
process.env.FOUNDING_CLOSES_AT = '2026-11-25T04:59:59Z';

// Keep the developer's data/db.json untouched: this file's documents live in memory only.
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data', 'db.json');
const realWrite = fs.writeFileSync;
const realRename = fs.renameSync;
fs.writeFileSync = function (file, ...rest) { if (String(file).startsWith(DATA)) return; return realWrite.call(this, file, ...rest); };
fs.renameSync = function (from, to, ...rest) { if (String(from).startsWith(DATA)) return; return realRename.call(this, from, to, ...rest); };

const test = require('node:test');
const assert = require('node:assert');
const db = require('../lib/db');
const ch = require('../lib/challenge');
const roadmap = require('../lib/roadmap');
const launch = require('../lib/launch');

const T = (iso) => Date.parse(iso);
let clock = T('2026-10-28T15:00:00Z');
ch._setNow(() => clock);
const at = (iso) => { clock = T(iso); };
let n = 0;
const email = () => `p${++n}.${Date.now()}@example.test`;

const ANSWERS = {
  1: { idea: 'Algebra tutoring for 8th graders', problem: "Parents can't find a tutor who explains it", score: '20', show_idea: 'on' },
  2: { people: '10', messages: '3', where: 'people-i-know' },
  3: { conversation: 'yes', quote: 'The night before the test is the worst', feature_ok: 'on', feature_idea: 'on', guest_ok: 'on' },
  4: { offer: 'I help parents of 8th graders get through algebra in 4 weeks', read_to: 'A neighbor' },
  5: { asks: '3', yeses: '1', lesson: 'Asking was easier than I thought' },
};
async function finisher(e = email()) {
  at('2026-11-08T12:00:00Z');
  const { entry } = await ch.join({ email: e, firstName: 'Ann', optIn: false, ip: '1.2.3.4' });
  at('2026-11-13T14:00:00Z');
  for (let d = 1; d <= 5; d++) await ch.checkIn(entry, d, { ...ANSWERS[d], ...(d >= 3 ? { feature_ok: 'on', feature_idea: 'on', guest_ok: 'on' } : {}) });
  return entry;
}

// (Left in place until the process exits: lib/db.js writes on a short timer after the last save.)

test('dates: Day n unlocks 8am ET each day; phases and the promo window follow the defaults', () => {
  const t = ch.times();
  assert.strictEqual(new Date(t.startAt).toISOString(), '2026-11-09T13:00:00.000Z');
  assert.strictEqual(new Date(ch.unlockAt(5)).toISOString(), '2026-11-13T13:00:00.000Z');
  assert.strictEqual(new Date(t.live2At).toISOString(), '2026-11-17T01:00:00.000Z'); // Mon Nov 16, 8pm ET
  assert.strictEqual(ch.etDay(t.live2At), 'Mon Nov 16');
  assert.strictEqual(ch.etClock(t.startAt), '8am');
  assert.strictEqual(ch.phase(T('2026-11-09T12:59:59Z')), 'open');
  assert.strictEqual(ch.phase(T('2026-11-09T13:00:00Z')), 'live');
  assert.strictEqual(ch.phase(T('2026-11-13T17:00:00Z')), 'closed');
  assert.strictEqual(ch.phase(T('2026-11-17T15:00:00Z')), 'after');
  assert.strictEqual(ch.liveDay(T('2026-11-11T12:59:00Z')), 2);
  assert.strictEqual(ch.liveDay(T('2026-11-20T12:00:00Z')), 5);
  assert.strictEqual(ch.promoVisible(T('2026-10-26T03:59:59Z')), false);
  assert.strictEqual(ch.promoVisible(T('2026-10-26T04:00:00Z')), true);
  assert.strictEqual(ch.promoVisible(T('2026-11-13T17:00:00Z')), false);
  // Check-ins: inclusive of the last second on Sunday night.
  assert.strictEqual(ch.canCheckIn(1, T('2026-11-16T04:59:59Z')), true);
  assert.strictEqual(ch.canCheckIn(1, T('2026-11-16T05:00:00Z')), false);
  assert.strictEqual(ch.canCheckIn(3, T('2026-11-11T12:59:59Z')), false);
});

test('dates: env overrides and the off switch (blank or "off" CHALLENGE_START_AT, as in lib/launch.js)', () => {
  delete process.env.CHALLENGE_START_AT;
  assert.strictEqual(ch.enabled(), true); // unset: the code defaults apply
  for (const v of ['', 'off']) {
    process.env.CHALLENGE_START_AT = v;
    assert.strictEqual(ch.enabled(), false);
    assert.strictEqual(ch.promoVisible(T('2026-11-01T12:00:00Z')), false);
    assert.strictEqual(ch.joinUrl('a@b.test'), undefined);
  }
  process.env.CHALLENGE_START_AT = '2026-11-09T13:00:00Z';
  process.env.CHALLENGE_LIVE_2_AT = '2026-11-14T01:00:00Z';
  try { assert.strictEqual(ch.etDay(ch.times().live2At), 'Fri Nov 13'); } finally { delete process.env.CHALLENGE_LIVE_2_AT; }
  assert.strictEqual(ch.enabled(), true);
  assert.strictEqual(launch.view().challenge.on, true, 'lib/launch.js agrees the challenge is on');
});

test('join: new sign-up joins the founding waitlist with source "challenge" and gets a private token', async () => {
  at('2026-10-28T15:00:00Z');
  const e = email();
  const r = await ch.join({ email: ` ${e.toUpperCase()} `, firstName: 'Maya<script>', optIn: true, ip: '1.2.3.4', utm: { utm_source: 'ig' }, from: 'founder-score' });
  assert.ok(!r.error && !r.existing);
  assert.strictEqual(r.entry.email, e);
  assert.strictEqual(r.entry.firstName, 'Mayascript');
  assert.match(r.entry.token, /^[a-f0-9]{32}$/);
  assert.strictEqual(r.entry.source, 'founder-score');
  assert.strictEqual(r.entry.late, false);
  assert.strictEqual(r.entry.ongoingOptIn, true);
  assert.ok(r.entry.termsAcceptedAt);
  assert.ok(!JSON.stringify(r.entry).includes('1.2.3.4'), 'raw IP is never stored');
  const w = launch.onWaitlist(e);
  assert.ok(w, 'on the founding waitlist');
  assert.strictEqual(w.source, 'challenge');
  assert.strictEqual(ch.byToken(r.entry.token).id, r.entry.id);
  assert.strictEqual(ch.byToken('not-a-token'), null);
});

test('join: arriving with your own referral code (founding status page) counts as waitlist, not referral', async () => {
  at('2026-10-28T15:00:00Z');
  const waitlist = require('../lib/waitlist');
  const e = email();
  const w = await waitlist.join({ email: e, firstName: 'Wes', optIn: false, source: 'founding' });
  const r = await ch.join({ email: e, firstName: 'Wes', ref: w.entry.referralCode });
  assert.strictEqual(r.entry.source, 'waitlist');
  assert.strictEqual(r.entry.ref, null);
  assert.strictEqual(r.entry.fromWaitlist, true);
});

test('waitlist: the confirm link already sent still works after a challenge join rotates it', async () => {
  at('2026-10-28T15:00:00Z');
  const waitlist = require('../lib/waitlist');
  const e = email();
  const w = await waitlist.join({ email: e, firstName: 'Ola', optIn: false, source: 'founder-score', confirmEmail: false });
  const first = new URL(w.confirmUrl).searchParams.get('token');
  const r = await ch.join({ email: e, firstName: 'Ola' });
  assert.ok(r.confirmUrl && new URL(r.confirmUrl).searchParams.get('token') !== first, 'CH0 gets a fresh link');
  const c = await waitlist.confirm(first);
  assert.ok(c && c.firstTime && c.entry.email === e, 'the first email\'s link confirms');
  assert.strictEqual(await waitlist.confirm('not-a-token'), null);
});

test('join: the same email again returns the existing entry, never a second one', async () => {
  at('2026-10-28T15:00:00Z');
  const e = email();
  const a = await ch.join({ email: e, firstName: 'Sam', optIn: false });
  const b = await ch.join({ email: e, firstName: 'Sammy', optIn: false });
  assert.strictEqual(b.existing, true);
  assert.strictEqual(b.entry.id, a.entry.id);
  assert.strictEqual(b.entry.token, a.entry.token);
  assert.strictEqual(db.filter('challenge', (x) => x.email === e).length, 1);
});

test('join: bad email is refused; late joiners are marked; sign-ups close Friday noon ET', async () => {
  at('2026-10-28T15:00:00Z');
  assert.ok((await ch.join({ email: 'not-an-email', firstName: 'X' })).error);
  at('2026-11-11T15:00:00Z');
  const late = await ch.join({ email: email(), firstName: 'Lee' });
  assert.strictEqual(late.entry.late, true);
  at('2026-11-13T17:00:00Z');
  const closed = await ch.join({ email: email(), firstName: 'Zed' });
  assert.strictEqual(closed.closed, true);
});

test('consent: box unticked under the default setting means no marketing opt-ins, and false is never sent', async () => {
  at('2026-10-28T15:00:00Z');
  const r = await ch.join({ email: email(), firstName: 'Kim', optIn: false });
  assert.strictEqual(r.entry.launchOptIn, false);
  assert.strictEqual(r.entry.ongoingOptIn, false);
  const p = JSON.parse(JSON.stringify(ch.profile(r.entry)));
  assert.ok(!('launch_optin' in p) && !('ongoing_optin' in p), 'false opt-ins are left off the Klaviyo profile');
  assert.match(p.challenge_url, /\/challenge\/me\?t=[a-f0-9]{32}$/);
  assert.match(r.entry.consents[0].version, /^challenge-off-/);
});

test('consent: with JOIN_IS_LAUNCH_CONSENT on, every joiner gets launch emails; the box is ongoing only', async () => {
  process.env.JOIN_IS_LAUNCH_CONSENT = 'true';
  try {
    at('2026-10-28T15:00:00Z');
    const r = await ch.join({ email: email(), firstName: 'Ola', optIn: false });
    assert.strictEqual(r.entry.launchOptIn, true);
    assert.strictEqual(r.entry.ongoingOptIn, false);
    assert.strictEqual(ch.profile(r.entry).launch_optin, true);
    assert.match(r.entry.consents[0].version, /^challenge-on-/);
  } finally { delete process.env.JOIN_IS_LAUNCH_CONSENT; }
});

test('check-in: locked before its day, validated, first save counts once, edits keep the first time', async () => {
  at('2026-11-08T12:00:00Z');
  const { entry } = await ch.join({ email: email(), firstName: 'Bo' });
  assert.deepStrictEqual(await ch.checkIn(entry, 1, ANSWERS[1]), { locked: true });
  at('2026-11-11T14:00:00Z');
  const bad = await ch.checkIn(entry, 3, { conversation: 'yes' });
  assert.ok(bad.errors && bad.errors.quote, 'the quote is required after a conversation');
  const big = await ch.checkIn(entry, 2, { people: '5000', messages: '1', where: 'people-i-know' });
  assert.ok(big.errors && big.errors.people, 'numbers are range-checked');
  const first = await ch.checkIn(entry, 1, ANSWERS[1]);
  assert.strictEqual(first.first, true);
  const firstAt = entry.days[1].at;
  at('2026-11-11T16:00:00Z');
  const edit = await ch.checkIn(entry, 1, { ...ANSWERS[1], idea: 'Chemistry tutoring' });
  assert.strictEqual(edit.first, false);
  assert.strictEqual(entry.days[1].at, firstAt);
  assert.strictEqual(ch.answer(entry, 1, 'idea'), 'Chemistry tutoring');
  assert.strictEqual(ch.daysDone(entry), 1);
  assert.strictEqual(ch.status(entry), 'active');
  const long = await ch.checkIn(entry, 1, { ...ANSWERS[1], idea: 'x'.repeat(900) });
  assert.ok(long.errors || ch.answer(entry, 1, 'idea').length <= 500, 'text is capped at 500 characters');
});

test('check-in: the fifth day makes a finisher, even at the last second; after the close nothing saves', async () => {
  at('2026-11-08T12:00:00Z');
  const { entry } = await ch.join({ email: email(), firstName: 'Cy' });
  at('2026-11-13T14:00:00Z');
  for (let d = 1; d <= 4; d++) await ch.checkIn(entry, d, ANSWERS[d]);
  assert.strictEqual(entry.finishedAt, null);
  at('2026-11-16T04:59:59Z');
  const last = await ch.checkIn(entry, 5, ANSWERS[5]);
  assert.strictEqual(last.finishedNow, true);
  assert.ok(entry.finishedAt);
  assert.strictEqual(ch.status(entry), 'finished');
  at('2026-11-16T05:00:00Z');
  assert.deepStrictEqual(await ch.checkIn(entry, 5, ANSWERS[5]), { closed: true });
});

test('feature opt-ins: idea and offer only with "feature my check-in"; hot seats use opted-in check-ins only', async () => {
  at('2026-11-08T12:00:00Z');
  const { entry } = await ch.join({ email: email(), firstName: 'Di' });
  at('2026-11-13T14:00:00Z');
  await ch.checkIn(entry, 1, ANSWERS[1]);
  await ch.checkIn(entry, 3, { conversation: 'not-yet', feature_idea: 'on', guest_ok: 'on' });
  assert.strictEqual(entry.featureOk, false);
  assert.strictEqual(entry.featureIdea, false, 'show my idea needs the main box');
  assert.strictEqual(entry.guestOk, true);
  assert.ok(!ch.hotSeatCandidates().some((c) => c.id === entry.id), 'guest box alone is not a feature opt-in');
  await ch.checkIn(entry, 3, { conversation: 'yes', quote: 'Too pricey', feature_ok: 'on' });
  const c = ch.hotSeatCandidates().find((x) => x.id === entry.id);
  assert.ok(c);
  assert.strictEqual(c.idea, null, 'idea stays private without "show my idea"');
  const prompt = ch.hotSeatPrompt([c]);
  assert.ok(!prompt.includes(entry.email) && !prompt.includes('Algebra'));
  await ch.unfeature(entry.id);
  assert.ok(!ch.hotSeatCandidates().some((x) => x.id === entry.id));
});

test('hot-seat shortlist without an API key is a plain list and is saved for the admin page', async () => {
  await finisher();
  const doc = await ch.hotSeatSummary();
  assert.strictEqual(doc.ai, false);
  assert.match(doc.text, /Hot seat: Ann/);
  assert.strictEqual(ch.lastHotSeatSummary().text, doc.text);
});

test('early access: finishers only, from an hour before doors until doors open', async () => {
  const entry = await finisher();
  const t = ch.times();
  assert.strictEqual(new Date(t.earlyAt).toISOString(), '2026-11-17T14:00:00.000Z');
  assert.strictEqual(ch.earlyState(entry, T('2026-11-17T13:59:59Z')), 'wait-early');
  assert.strictEqual(ch.earlyState(entry, T('2026-11-17T14:00:00Z')), 'early');
  assert.strictEqual(ch.earlyState({ finishedAt: null }, T('2026-11-17T14:30:00Z')), 'wait-launch');
  assert.strictEqual(ch.earlyState(entry, T('2026-11-17T15:00:00Z')), 'open');
  const req = { session: {} };
  at('2026-11-17T14:10:00Z');
  assert.strictEqual(ch.earlyAccess(req), false);
  ch.grantEarly(req);
  assert.strictEqual(ch.earlyAccess(req), true);
  at('2026-11-17T15:00:00Z');
  assert.strictEqual(ch.earlyAccess(req), false, 'the pass ends when doors open for everyone');
});

test('carry-over: a Start-track member gets the steps, milestones and Day One badge once', async () => {
  const entry = await finisher();
  const user = await db.save('users', { email: entry.email, name: 'Ann', tier: 'free', xp: 0, badges: [], completed: {}, answers: { stage: 'exploring', goal: 'pick_idea' } });
  user.roadmap = roadmap.generate(user.answers);
  assert.strictEqual(user.roadmap.track, 'start');
  const r1 = await ch.syncUser(user);
  assert.ok(r1.changed && r1.linkedNow);
  assert.ok(user.badges.includes('day_one'));
  assert.ok(user.completed['start-w1-t1'] && user.completed['start-w1-t2'] && user.completed['start-w1-t3']);
  assert.ok(user.milestones.idea_test && user.milestones.offer);
  const xp = user.xp;
  assert.ok(xp > 0);
  const r2 = await ch.syncUser(user);
  assert.strictEqual(r2.changed, false, 'nothing new: no second pass');
  delete user.completed['start-w1-t1']; // member un-ticks a step, then the entry changes
  entry.days[5].answers.lesson = 'Edited';
  await db.save('challenge', entry);
  await ch.syncUser(user);
  assert.strictEqual(user.xp, xp, 'XP is paid once per step');
  assert.strictEqual(entry.linkedUserId, user.id);
  assert.ok(user.challenge.finished_at, 'the founding bar and welcome card read user.challenge.finished_at');
  assert.strictEqual(user.challenge.idea, 'Algebra tutoring for 8th graders');
});

test('carry-over: other tracks keep their roadmap; non-finishers get no badge', async () => {
  at('2026-11-08T12:00:00Z');
  const { entry } = await ch.join({ email: email(), firstName: 'Gus' });
  at('2026-11-13T14:00:00Z');
  for (let d = 1; d <= 3; d++) await ch.checkIn(entry, d, ANSWERS[d]);
  const user = await db.save('users', { email: entry.email, tier: 'free', xp: 0, badges: [], completed: {}, answers: { stage: 'launched', goal: 'revenue' } });
  user.roadmap = roadmap.generate(user.answers);
  assert.notStrictEqual(user.roadmap.track, 'start');
  await ch.syncUser(user);
  assert.ok(!user.badges.includes('day_one'));
  assert.deepStrictEqual(Object.keys(user.completed), []);
  assert.strictEqual(user.challenge.days_done, 3);
});

test('signed join links: HMAC of the lowercased email; tampering fails', () => {
  const url = ch.joinUrl('Ann@Example.test');
  const u = new URL(url);
  assert.strictEqual(u.pathname, '/challenge/join');
  assert.strictEqual(u.searchParams.get('e'), 'ann@example.test');
  assert.ok(ch.verify('ann@example.test', u.searchParams.get('s')));
  assert.ok(ch.verify('ANN@example.test', u.searchParams.get('s')));
  assert.ok(!ch.verify('bob@example.test', u.searchParams.get('s')));
  assert.ok(!ch.verify('ann@example.test', ''));
});

test('ideaTestCap: raised for the first three challenge days only', () => {
  assert.strictEqual(ch.ideaTestCap(150, T('2026-11-09T12:59:59Z')), 150);
  assert.strictEqual(ch.ideaTestCap(150, T('2026-11-09T13:00:00Z')), 600);
  assert.strictEqual(ch.ideaTestCap(900, T('2026-11-10T13:00:00Z')), 900);
  assert.strictEqual(ch.ideaTestCap(150, T('2026-11-12T13:00:00Z')), 150);
});

test('calendar files: CRLF lines, UTC start, 15-minute alarm', () => {
  const k = ch.ics('kickoff');
  assert.ok(k.includes('\r\nDTSTART:20261110T010000Z\r\n'));
  assert.ok(k.includes('DTEND:20261110T013000Z'));
  assert.ok(k.includes('TRIGGER:-PT15M'));
  assert.ok(ch.ics('debrief').includes('DTSTART:20261117T010000Z'));
});

test('CSV: cells that start like a formula are neutralized', async () => {
  at('2026-11-08T12:00:00Z');
  const { entry } = await ch.join({ email: email(), firstName: 'Eve' });
  at('2026-11-09T14:00:00Z');
  await ch.checkIn(entry, 1, { ...ANSWERS[1], idea: '=HYPERLINK("http://x")' });
  const csv = ch.csv();
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(!csv.includes(entry.token), 'tokens never leave in the export');
});

test('account deletion removes the challenge entry', async () => {
  at('2026-10-28T15:00:00Z');
  const e = email();
  await ch.join({ email: e, firstName: 'Del' });
  assert.ok(ch.byEmail(e));
  await ch.forget(e);
  assert.strictEqual(ch.byEmail(e), null);
});

test('content: five days, each with a check-in, matching the five moves', () => {
  assert.strictEqual(ch.content().days.length, 5);
  ch.content().days.forEach((d, i) => {
    assert.strictEqual(d.n, i + 1);
    assert.strictEqual(d.move, ch.MOVES[i]);
    assert.ok(d.checkin && d.checkin.fields.length);
  });
});

// ---------- v2: "Five days. Five things live." (CHALLENGE_DAYS=v2, content/challenge-v2.json) ----------
async function withV2(fn) {
  // v2 runs on its own default dates (lib/launch.js CHALLENGE_V2_DEFAULTS), so the v1 start set above steps aside.
  const start = process.env.CHALLENGE_START_AT;
  process.env.CHALLENGE_DAYS = 'v2';
  delete process.env.CHALLENGE_START_AT;
  try { return await fn(); } finally { delete process.env.CHALLENGE_DAYS; process.env.CHALLENGE_START_AT = start; }
}
const V2_ANSWERS = {
  1: { business: 'Northside Detail', line: 'I clean cars in your driveway, for busy parents' },
  2: { site_url: 'northside-detail.preview.test', show_idea: 'on' },
  3: { offer: 'Your car, cleaned in your driveway while you work, $89', grade: '72', show_offer: 'on' },
  4: { proof: 'before_after' },
  5: { site_public: 'preview' },
  6: { time_block: 'morning' },
  7: { package: 'Full detail, about 2 hours, $89' },
  8: { list_count: '25', list_where: 'know' },
  9: { posted: 'story', post_url: '' },
  10: { asks: '5', replies: '2' },
  11: { asks_more: '5', followups: '2' },
  12: { posts: '3' },
  13: { walkthrough: 'posted', feature_ok: 'on', feature_idea: 'on' },
  14: { lesson: 'People answer faster than I thought', asks_total: '10', replies_all: '4', feature_ok: 'on', feature_idea: 'on' },
};

test('v2 content: 14 days, any 12 finish, moves match, slots, summary and card lines point at real fields, no clients or leads', () => withV2(() => {
  const C = ch.content();
  assert.ok(ch.contentFile().endsWith('challenge-v2.json'));
  assert.strictEqual(C.days.length, 14);
  assert.strictEqual(ch.totalDays(), 14);
  assert.strictEqual(ch.finishMin(), 12);
  assert.strictEqual(C.landing.days.length, 14);
  C.days.forEach((d, i) => {
    assert.strictEqual(d.n, i + 1);
    assert.strictEqual(d.move, ch.moves()[i]);
    assert.ok(d.label.startsWith(`DAY ${i + 1} OF 14`), d.label);
    assert.ok(d.checkin.fields.length && d.tool && d.example && d.stuck && d.after && d.card && d.card.label, `day ${i + 1}`);
  });
  const has = (n, f) => ch.day(n).checkin.fields.some((x) => x.id === f);
  for (const s of ['idea', 'offer']) assert.ok(has(ch.slot(s).day, ch.slot(s).field), s);
  for (const [k, [n, f]] of Object.entries(C.summary)) assert.ok(has(n, f), k);
  for (const d of C.days) if (d.card.line) assert.ok(has(d.card.line[0], d.card.line[1]) && d.card.toggle, `card line day ${d.n}`);
  assert.ok(has(2, 'show_idea') && has(3, 'show_offer'));
  const text = JSON.stringify(C);
  assert.ok(!/\bclients?\b|\bleads?\b/i.test(text), 'L62: nothing says the challenge or a plan gets people clients or leads');
  assert.ok(text.includes("Don't use tools that mass-text or auto-DM people") && text.includes('Mail Order Rule'), 'Legal 3.7 lines stay');
  assert.ok(!text.includes('\u2014'), 'no em dashes in site copy');
  assert.ok(!/127group\.io\b(?!\/challenge)/.test(JSON.stringify(C.days)), 'no site address on a 127 domain: 127 hosts nothing');
  // v1 is untouched without the switch.
  delete process.env.CHALLENGE_DAYS;
  assert.strictEqual(ch.moves()[0], 'Pick one');
  assert.strictEqual(ch.slot('offer').day, 4);
  assert.strictEqual(ch.totalDays(), 5);
  process.env.CHALLENGE_DAYS = 'v2';
}));

test('v2 dates: Tue Nov 3 to Mon Nov 16, sign-ups close Mon Nov 9 noon ET, demo night Mon Nov 16 8pm ET; env still wins', () => withV2(() => {
  const T = ch.times();
  assert.strictEqual(T.startAt, Date.parse('2026-11-03T13:00:00Z'));
  assert.strictEqual(T.regClosesAt, Date.parse('2026-11-09T17:00:00Z'));
  assert.strictEqual(T.closesAt, Date.parse('2026-11-17T04:59:59Z'));
  assert.strictEqual(T.live1At, Date.parse('2026-11-04T01:00:00Z'));
  assert.strictEqual(T.live2At, Date.parse('2026-11-17T01:00:00Z'));
  assert.strictEqual(launch.date('CHALLENGE_START_AT'), T.startAt);
  assert.strictEqual(ch.etDay(ch.unlockAt(1)), 'Tue Nov 3');
  assert.strictEqual(ch.etDay(ch.unlockAt(14)), 'Mon Nov 16');
  assert.strictEqual(ch.liveDay(T.startAt + 13 * ch.DAY + 60e3), 14);
  assert.strictEqual(ch.liveDay(T.startAt + 40 * ch.DAY), 14);
  assert.deepStrictEqual(ch.lives().map((l) => l.title), ['Kickoff', 'Demo night']);
  assert.ok(ch.ics('debrief').includes('SUMMARY:Day One Challenge: Demo night live with Eli'));
  const c = require('../lib/consent').copy('challenge');
  assert.ok(c.version.endsWith('-v2') && c.line.includes('November 3 to 16'));
  process.env.CHALLENGE_START_AT = '2026-11-04T13:00:00Z';
  assert.strictEqual(ch.times().startAt, Date.parse('2026-11-04T13:00:00Z'));
  delete process.env.CHALLENGE_START_AT;
}));

test('v2 join: the path is kept when it is one of the four, ignored otherwise, and filled in on a later join', () => withV2(async () => {
  at('2026-11-02T12:00:00Z');
  const a = await ch.join({ email: email(), firstName: 'Jo', path: 'service' });
  assert.strictEqual(a.entry.path, 'service');
  assert.strictEqual(ch.profile(a.entry).challenge_path, 'service');
  const e = email();
  const b = await ch.join({ email: e, firstName: 'Bo', path: 'astronaut' });
  assert.strictEqual(b.entry.path, null);
  const again = await ch.join({ email: e, path: 'creator' });
  assert.strictEqual(again.entry.path, 'creator');
  const w = ch.welcomeParts(a.entry, null);
  const txt = JSON.stringify(w);
  assert.ok(w.subject.includes('Tuesday is day one'));
  assert.ok(txt.includes('Tuesday, November 3 to Monday, November 16') && txt.includes('Any 12 of the 14 days count') && txt.includes('for the demo night'), txt);
  at('2026-11-10T12:00:00Z');
  assert.ok((await ch.join({ email: email() })).closed, 'sign-ups closed Mon Nov 9 noon ET');
}));

test('v2 check-ins: 12 of 14 makes a finisher, card toggles, summary, hot seats show the site only when ticked, CSV columns', () => withV2(async () => {
  at('2026-11-02T12:00:00Z');
  const { entry } = await ch.join({ email: email(), firstName: 'Jordan', path: 'service' });
  at('2026-11-16T14:00:00Z');
  for (const d of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]) {
    const r = await ch.checkIn(entry, d, V2_ANSWERS[d]);
    assert.ok(!r.errors, `day ${d}: ${JSON.stringify(r.errors)}`);
    assert.ok(!entry.finishedAt, `not a finisher at ${ch.daysDone(entry)} days`);
  }
  const r13 = await ch.checkIn(entry, 13, V2_ANSWERS[13]);
  assert.ok(r13.finishedNow && entry.finishedAt && entry.finishedDay === 13, 'the 12th day done makes a finisher');
  await ch.checkIn(entry, 14, V2_ANSWERS[14]);
  assert.strictEqual(ch.daysDone(entry), 13);
  assert.strictEqual(entry.finishedDay, 13, 'a later check-in keeps the finish day');
  assert.strictEqual(entry.showIdea, true);
  assert.strictEqual(entry.showOffer, true);
  const s = ch.summary(entry);
  assert.strictEqual(s.site, 'northside-detail.preview.test');
  assert.strictEqual(s.offer_grade, 72);
  assert.strictEqual(s.list_count, 25);
  assert.strictEqual(s.post_url, null);
  assert.strictEqual(s.package, 'Full detail, about 2 hours, $89');
  assert.strictEqual(s.asks_total, 10);
  assert.strictEqual(s.path, 'service');
  const c = ch.hotSeatCandidates().find((x) => x.id === entry.id);
  assert.strictEqual(c.idea, 'northside-detail.preview.test');
  assert.strictEqual(c.offer, null, 'offer stays private without "show my offer"');
  assert.strictEqual(c.asks, 10);
  assert.strictEqual(c.replies, 4);
  const prompt = ch.hotSeatPrompt([c]);
  assert.ok(prompt.includes('Site (may be shown)') && prompt.includes('Asks: sent 10, 4 replies so far') && prompt.includes('finisher (13 of 14 days)') && prompt.includes('free 14-day') && prompt.includes("Monday's Instagram Live demo night"), prompt);
  assert.ok(!prompt.includes(entry.email));
  const head = ch.csv().split('\n')[0];
  assert.ok(head.includes('"path"') && head.includes('"site"') && head.includes('"day14_at"') && head.includes('"package"') && !head.includes('"yeses"'));
  // A required field is still required.
  const bad = await ch.checkIn(entry, 8, { list_count: '' });
  assert.ok(bad.errors && bad.errors.list_count);
  // Day 15 doesn't exist.
  assert.ok((await ch.checkIn(entry, 15, {})).notFound);
}));

test('v2 public counts stay hidden below 50, so a small number is never shown as proof', () => withV2(() => {
  const n = db.all('challenge').length;
  const c = ch.publicCounts();
  if (n < 50) assert.strictEqual(c.joined, null);
  else assert.strictEqual(c.joined, n);
  assert.ok(c.sitesLive === null || c.sitesLive >= 50);
}));

test('v2 Legal L97: three feature ticks logged with the content version, walkthrough only when ticked, friend names opt-in, copy fixes', () => withV2(async () => {
  at('2026-11-02T12:00:00Z');
  const { entry } = await ch.join({ email: email(), firstName: 'Maya', path: 'service' });
  assert.strictEqual(entry.friendNameOk, false, 'CH21: off until ticked');
  at('2026-11-15T14:00:00Z');
  await ch.checkIn(entry, 13, { walkthrough: 'posted', walkthrough_url: 'https://instagram.com/p/abc', feature_ok: 'on', feature_idea: 'on' });
  assert.strictEqual(entry.featureWalk, false);
  let c = ch.hotSeatCandidates().find((x) => x.id === entry.id);
  assert.strictEqual(c.walkthrough, null, 'CH1: no walkthrough without its box');
  assert.ok(ch.hotSeatPrompt([c]).includes('Walkthrough: not cleared to play'));
  assert.strictEqual(entry.featureLog.length, 1);
  assert.strictEqual(entry.featureLog[0].version, ch.content().version, 'CH5: the words each tick saw');
  // Same ticks again: no new row. A new tick: one more row.
  await ch.checkIn(entry, 13, { walkthrough: 'posted', walkthrough_url: 'https://instagram.com/p/abc', feature_ok: 'on', feature_idea: 'on' });
  assert.strictEqual(entry.featureLog.length, 1);
  await ch.checkIn(entry, 13, { walkthrough: 'posted', walkthrough_url: 'https://instagram.com/p/abc', feature_ok: 'on', feature_idea: 'on', feature_walk: 'on' });
  assert.strictEqual(entry.featureLog.length, 2);
  assert.deepStrictEqual(entry.featureLog[1].ticks, { featureOk: true, featureIdea: true, featureOffer: false, featureWalk: true, guestOk: false });
  c = ch.hotSeatCandidates().find((x) => x.id === entry.id);
  assert.strictEqual(c.walkthrough, 'https://instagram.com/p/abc');
  // The walkthrough box needs the main box.
  await ch.checkIn(entry, 13, { walkthrough: 'posted', feature_walk: 'on' });
  assert.strictEqual(entry.featureWalk, false);
  await ch.unfeature(entry.id);
  assert.strictEqual(entry.featureLog[entry.featureLog.length - 1].version, 'withdrawn');
  await ch.setFriendName(entry, true);
  assert.strictEqual(entry.friendNameOk, true);
  assert.strictEqual(entry.friendNameLog[0].label, "Show my first name on my friend's card");
  const head = ch.csv().split('\n')[0];
  assert.ok(head.includes('"feature_walk"') && head.includes('"feature_version"') && head.includes('"friend_name_ok"'));
  // Copy (CH1, CH2, CH3, CH6, CH10, CH11, CH16, CH21, CH22, CH27).
  const C = ch.content();
  const text = JSON.stringify(C);
  assert.ok(C.feature.feature_walk && C.feature.feature_ok.includes('If I tick "Show my site"') && C.feature.small.includes("It isn't a contest"));
  assert.ok(C.landing.finisher_terms.includes('checks in for at least 12 of the 14 days'));
  assert.ok(C.invite.share.includes('I get a free month of 127 if friends join with my link'));
  for (const gone of ['One tap a day', 'Twelve minutes later', 'Most yeses', 'entered', "You'll see each other's days", 'entry for demo night']) assert.ok(!text.includes(gone), gone);
  assert.ok(text.includes('It lasts 30 days from when you made it.') && text.includes('Netlify is a separate company.'));
  // CH23: "sites built" counts Day 2 check-ins with a site link, and there's no "sites live" in v2.
  const counts = ch.publicCounts();
  assert.strictEqual(counts.sitesLive, null);
  assert.ok(counts.sitesBuilt === null || counts.sitesBuilt >= 50);
}));

test('v2 Legal CH8: no "about N minutes" time claim until the timing is done; "block 15 minutes" advice stays', () => withV2(() => {
  const text = JSON.stringify(ch.content());
  assert.ok(!/about \d+ min|\b(five|ten|fifteen) minutes\b/i.test(text), 'no untimed time claims');
  assert.ok(ch.content().days.every((d) => d.move_time === null || !/\d/.test(d.move_time)));
  assert.ok(text.includes('block 15 minutes a day'), 'planning advice stays');
}));
