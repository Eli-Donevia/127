// Result screens for the funnels (conversion/pages/quiz-results.md): launch state, signed links,
// the server-side Founder Score and the result emails.
const test = require('node:test');
const assert = require('node:assert');

const ENV = {
  PRELAUNCH: 'true', LAUNCH_AT: '2026-11-17T15:00:00Z', FOUNDING_CLOSES_AT: '2026-11-25T05:00:00Z', FOUNDING_PRICE: '19', FOUNDING_CAP: '100',
  CHALLENGE_START_AT: '2026-11-09T14:00:00Z', CHALLENGE_REG_CLOSES_AT: '2026-11-13T17:00:00Z',
  CHALLENGE_LIVE_1_AT: '2026-11-10T01:00:00Z', CHALLENGE_LIVE_2_AT: '2026-11-17T01:00:00Z', SESSION_SECRET: 'test-secret',
};
Object.assign(process.env, ENV);
const funnels = require('../lib/funnels');
const { launchInfo, sign, scoreSummary } = funnels._test;

function at(iso, fn) {
  const real = Date.now;
  Date.now = () => Date.parse(iso);
  try { return fn(); } finally { Date.now = real; }
}

test('state follows the server clock: A1, A2, B, C', () => {
  assert.equal(at('2026-10-27T12:00:00Z', launchInfo).state, 'A1');
  assert.equal(at('2026-11-13T18:00:00Z', launchInfo).state, 'A2');
  process.env.PRELAUNCH = 'false';
  assert.equal(at('2026-11-18T12:00:00Z', launchInfo).state, 'B');
  assert.equal(at('2026-11-26T12:00:00Z', launchInfo).state, 'C');
  process.env.PRELAUNCH = 'true';
});

test('dates and prices come from the launch config', () => {
  const L = at('2026-10-27T12:00:00Z', launchInfo);
  assert.equal(L.doors, 'Tue, Nov 17');
  assert.equal(L.doorsTime, '10am ET');
  assert.equal(L.closes, 'Tuesday, November 24');
  assert.equal(L.closesTime, '11:59pm ET');
  assert.equal(L.price, 19);
  assert.equal(L.builderPrice, 29);
  assert.deepEqual(L.challenge.days, ['Mon Nov 9', 'Tue Nov 10', 'Wed Nov 11', 'Thu Nov 12', 'Fri Nov 13']);
  assert.deepEqual(L.challenge.lives, ['Mon Nov 9', 'Mon Nov 16']);
  assert.equal(L.challenge.liveTime, '8pm ET');
  assert.equal(L.challenge.regCloses, 'Fri Nov 13 at 12pm ET');
  assert.equal(L.challenge.range, 'Nov 9 to 13');
});

test('spots left only shows at 25 or fewer, last day only on Nov 24 ET', () => {
  process.env.PRELAUNCH = 'false';
  assert.equal(at('2026-11-18T12:00:00Z', launchInfo).spotsLeft, null);
  assert.equal(at('2026-11-18T12:00:00Z', launchInfo).lastDay, false);
  assert.equal(at('2026-11-24T20:00:00Z', launchInfo).lastDay, true);
  process.env.FOUNDING_CAP = '20';
  assert.equal(at('2026-11-18T12:00:00Z', launchInfo).spotsLeft, 20);
  process.env.FOUNDING_CAP = '100';
  process.env.PRELAUNCH = 'true';
});

test('the opt-in signature is per email and per purpose', () => {
  assert.equal(sign('A@B.co', 'optin'), sign('a@b.co', 'optin'));
  assert.notEqual(sign('a@b.co', 'optin'), sign('c@d.co', 'optin'));
  // Never the bare-email HMAC the challenge's own links once used.
  const bare = require('crypto').createHmac('sha256', 'test-secret').update('a@b.co').digest('hex');
  assert.notEqual(sign('a@b.co', 'optin'), bare);
});

test('the email rebuilds the score from the answers, with the reasons', () => {
  const answers = { stage: 'validating', focus: 'one', talks: '0', paid: 'no', reach: 'network', hours: 'lt3', blocker: 'offer' };
  const sc = scoreSummary(answers);
  assert.equal(sc.arch.name, 'Validator');
  assert.equal(sc.total, 20 + 2 + 2 + 10 + 10);
  assert.equal(sc.reasons[0], 'Because you said "Validating", you\'re a Validator.');
  assert.match(sc.reasons[2], /^Because you said "None": Validation 2\/20\. No buyer has told you/);
  assert.equal(sc.reasons.length, 7);
  assert.equal(scoreSummary({ ...answers, talks: 'lots' }), null);
});

test('result emails follow the state and never carry the old wording', () => {
  const lead = { source: 'founder-score', name: 'Maya', consent: { box: false }, data: { answers: { stage: 'exploring', focus: 'few', talks: '1-4', paid: 'no', reach: 'unknown', hours: '3to10', blocker: 'time' } } };
  const founding = { referral_link: 'https://127group.io/f/abc123', status_url: 'https://127group.io/founding/status?code=abc123' };
  const a1 = at('2026-10-27T12:00:00Z', () => funnels.deliveryEmail(lead, founding));
  assert.match(a1.text, /You're on the founding list\. Doors open Tue, Nov 17 at 10am ET\. You asked for your results only/);
  assert.match(a1.text, /Builder is \$19 a month for founding members/);
  assert.match(a1.text, /Bring 3, get a month\./);
  assert.match(a1.text, /Day 1, Mon Nov 9: Pick one\./);
  assert.match(a1.text, /Why you got this score\./);
  process.env.PRELAUNCH = 'false';
  const b = at('2026-11-18T12:00:00Z', () => funnels.deliveryEmail(lead, null));
  assert.match(b.text, /Doors are open\. Your gap is picking one/);
  assert.match(b.text, /Lock \$19 a month: .*\/founding\/lock\?from=score/);
  const c = at('2026-11-26T12:00:00Z', () => funnels.deliveryEmail(lead, null));
  assert.match(c.text, /Your roadmap is ready\./);
  assert.doesNotMatch(c.text, /\$19|founding/i);
  process.env.PRELAUNCH = 'true';
  for (const m of [a1, b, c]) assert.doesNotMatch(m.text, /six-figure|two taps|guarantee|AI coach|—|\{\w+\}/);
});
