// HQ_LIVE=admins: the demo mode. HQ is on, but only verified ADMIN_EMAILS see it, with the full Builder view.
const test = require('node:test');
const assert = require('node:assert/strict');
const hq = require('../lib/hq');

const admin = { email: 'eli@127group.io', emailVerified: true, tier: 'free' };
const unverified = { email: 'eli@127group.io', emailVerified: false, tier: 'free' };
const builder = { email: 'member@example.com', emailVerified: true, tier: 'builder' };

function withEnv(env, fn) {
  const old = { HQ_LIVE: process.env.HQ_LIVE, ADMIN_EMAILS: process.env.ADMIN_EMAILS };
  Object.assign(process.env, env);
  try { fn(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
}

test('HQ_LIVE=admins shows HQ only to verified admins, who get the full view', () => {
  withEnv({ HQ_LIVE: 'admins', ADMIN_EMAILS: 'Eli@127group.io, other@x.com' }, () => {
    assert.equal(hq.live(), true);
    assert.equal(hq.liveFor(admin), true);
    assert.equal(hq.canUse(admin), true);
    assert.equal(hq.liveFor(unverified), false);
    assert.equal(hq.liveFor(builder), false);
    assert.equal(hq.canUse(builder), false);
    assert.equal(hq.liveFor(null), false);
  });
});

test('HQ_LIVE=true is everyone (Builder and up); unset is off', () => {
  withEnv({ HQ_LIVE: 'true', ADMIN_EMAILS: 'eli@127group.io' }, () => {
    assert.equal(hq.liveFor(builder), true);
    assert.equal(hq.canUse(builder), true);
    assert.equal(hq.canUse(admin), false); // a free admin gets the Free preview once HQ is live for all
  });
  withEnv({ HQ_LIVE: 'no', ADMIN_EMAILS: 'eli@127group.io' }, () => {
    assert.equal(hq.live(), false);
    assert.equal(hq.liveFor(admin), false);
  });
});
