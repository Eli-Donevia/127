// The HQ premium pass (HQ_PREMIUM, public/css/hq-premium.css): off unless set, and when on the rail shows how much
// each shelf holds and the 30-day roadmap sits under Your business.
const test = require('node:test');
const assert = require('node:assert/strict');
const nav = require('../lib/harness/nav');
const flags = require('../lib/harness/flags');

const user = { email: 'member@example.com', emailVerified: true, tier: 'builder' };

test('HQ_PREMIUM is a known switch and off by default', () => {
  assert.ok(flags.NAMES.includes('HQ_PREMIUM'));
  const old = process.env.HQ_PREMIUM;
  try {
    delete process.env.HQ_PREMIUM;
    const ws = nav.workspace(user);
    assert.equal(ws.premium, false);
    assert.ok(!ws.groups.flatMap((g) => g.items).some((i) => i.id === 'roadmap'));
  } finally { if (old === undefined) delete process.env.HQ_PREMIUM; else process.env.HQ_PREMIUM = old; }
});

test('shelf counts are whole numbers for every shelf (workflows load with the server, so they may be 0 here)', () => {
  const n = nav.shelfCounts();
  for (const k of ['workflows', 'prompts', 'store', 'connections']) assert.ok(Number.isInteger(n[k]) && n[k] >= 0, k);
  for (const k of ['prompts', 'store', 'connections']) assert.ok(n[k] > 0, k);
});
