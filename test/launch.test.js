const test = require('node:test');
const assert = require('node:assert');
const launch = require('../lib/launch');

const withEnv = (env, fn) => {
  const old = {};
  for (const k of Object.keys(env)) { old[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { fn(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
};

test('view labels launch and close dates in Eastern time', () => {
  withEnv({ LAUNCH_AT: '2026-11-17T15:00:00Z', FOUNDING_CLOSES_AT: '2026-11-25T05:00:00Z', FOUNDING_CAP: '100' }, () => {
    const v = launch.view();
    assert.strictEqual(v.launchDay, 'Tuesday, November 17');
    assert.strictEqual(v.launchShort, 'NOV 17');
    assert.strictEqual(v.launchTime, '10am ET');
    // A midnight close reads as 11:59pm the day before.
    assert.strictEqual(v.closesDate, 'November 24');
    assert.strictEqual(v.closesDay, 'Tuesday, November 24');
    assert.strictEqual(v.closesTime, '11:59pm ET');
    assert.strictEqual(v.cap, 100);
  });
});

test('challenge card follows the challenge env and its kill switch', () => {
  const FUTURE = new Date(Date.now() + 864e5).toISOString();
  const PAST = new Date(Date.now() - 864e5).toISOString();
  withEnv({ CHALLENGE_START_AT: 'off', CHALLENGE_REG_CLOSES_AT: FUTURE }, () => {
    assert.strictEqual(launch.view().challenge.open, false);
  });
  // Unset uses the code defaults (Nov 9 to 13), so Replit needs no challenge Secrets.
  withEnv({ CHALLENGE_START_AT: undefined, CHALLENGE_REG_CLOSES_AT: FUTURE }, () => {
    assert.strictEqual(launch.date('CHALLENGE_START_AT'), Date.parse('2026-11-09T13:00:00Z'));
  });
  withEnv({ CHALLENGE_START_AT: '2026-11-09T13:00:00Z', CHALLENGE_REG_CLOSES_AT: FUTURE, EARLY_ACCESS_AT: '2026-11-17T14:00:00Z' }, () => {
    const c = launch.view().challenge;
    assert.strictEqual(c.open, true);
    assert.strictEqual(c.datesShort, 'NOV 9 TO 13');
    assert.strictEqual(c.dates, 'November 9 to 13');
    assert.strictEqual(c.earlyTime, '9');
  });
  withEnv({ CHALLENGE_START_AT: '2026-11-09T13:00:00Z', CHALLENGE_REG_CLOSES_AT: PAST }, () => {
    assert.strictEqual(launch.view().challenge.open, false);
  });
});

test('homepage labels and state follow launch env (homepage.md sections 1 and 3)', () => {
  const PAST = new Date(Date.now() - 864e5).toISOString();
  const FUTURE = new Date(Date.now() + 864e5).toISOString();
  const LATER = new Date(Date.now() + 10 * 864e5).toISOString();
  const base = { FOUNDING_CAP: '100', CHALLENGE_START_AT: '2026-11-09T14:00:00Z' };
  withEnv({ ...base, LAUNCH_AT: '2026-11-17T15:00:00Z', FOUNDING_CLOSES_AT: '2026-11-25T05:00:00Z', CHALLENGE_REG_CLOSES_AT: '2026-11-13T17:00:00Z' }, () => {
    const v = launch.view();
    assert.strictEqual(v.launchAbbr, 'Tue, Nov 17');
    assert.strictEqual(v.closesAbbr, 'Tue, Nov 24');
    assert.strictEqual(v.challenge.startAbbr, 'Mon Nov 9');
    assert.strictEqual(v.challenge.endAbbr, 'Fri Nov 13');
    assert.strictEqual(v.challenge.regClosesLabel, 'Fri Nov 13, 12pm ET');
  });
  withEnv({ ...base, PRELAUNCH: 'true', LAUNCH_AT: LATER, FOUNDING_CLOSES_AT: LATER, CHALLENGE_REG_CLOSES_AT: FUTURE }, () => {
    assert.strictEqual(launch.homeState(), 'A1');
  });
  withEnv({ ...base, PRELAUNCH: 'true', LAUNCH_AT: LATER, FOUNDING_CLOSES_AT: LATER, CHALLENGE_REG_CLOSES_AT: PAST }, () => {
    assert.strictEqual(launch.homeState(), 'A2');
  });
  withEnv({ ...base, PRELAUNCH: 'true', LAUNCH_AT: PAST, FOUNDING_CLOSES_AT: LATER, CHALLENGE_REG_CLOSES_AT: PAST }, () => {
    assert.strictEqual(launch.homeState(), 'B');
  });
  withEnv({ ...base, PRELAUNCH: 'true', LAUNCH_AT: PAST, FOUNDING_CLOSES_AT: PAST }, () => {
    assert.strictEqual(launch.homeState(), 'C');
  });
});

test('before doors open with no PRELAUNCH: founding is upcoming (waitlist on /founding), not open, sign-ups not gated', () => {
  const FUTURE = new Date(Date.now() + 864e5).toISOString();
  const PAST = new Date(Date.now() - 864e5).toISOString();
  const LATER = new Date(Date.now() + 7 * 864e5).toISOString();
  withEnv({ PRELAUNCH: undefined, LAUNCH_AT: FUTURE, FOUNDING_CLOSES_AT: LATER, FOUNDING_PRICE: undefined }, () => {
    const v = launch.view();
    assert.strictEqual(v.prelaunch, false);
    assert.strictEqual(v.upcoming, true);
    assert.strictEqual(v.foundingOpen, false);
    assert.strictEqual(v.foundingPrice, 19);
  });
  // Doors open: the founding window is open and the waitlist state ends.
  withEnv({ PRELAUNCH: undefined, LAUNCH_AT: PAST, FOUNDING_CLOSES_AT: LATER }, () => {
    const v = launch.view();
    assert.strictEqual(v.upcoming, false);
    assert.strictEqual(v.foundingOpen, true);
  });
  // PRELAUNCH=true keeps its own gate; upcoming is only for open sign-ups.
  withEnv({ PRELAUNCH: 'true', LAUNCH_AT: FUTURE }, () => {
    assert.strictEqual(launch.view().prelaunch, true);
    assert.strictEqual(launch.view().upcoming, false);
  });
});

test('the code defaults are doors Nov 17 10am ET and a founding close at the end of Nov 24 ET', () => {
  withEnv({ LAUNCH_AT: undefined, FOUNDING_CLOSES_AT: undefined }, () => {
    const v = launch.view();
    assert.strictEqual(v.launchDay, 'Tuesday, November 17');
    assert.strictEqual(v.launchTime, '10am ET');
    assert.strictEqual(v.closesDate, 'November 24');
  });
});
