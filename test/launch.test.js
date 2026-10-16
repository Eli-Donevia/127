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
  withEnv({ CHALLENGE_START_AT: undefined, CHALLENGE_REG_CLOSES_AT: FUTURE }, () => {
    assert.strictEqual(launch.view().challenge.open, false);
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
