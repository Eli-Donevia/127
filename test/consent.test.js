const test = require('node:test');
const assert = require('node:assert');
const consent = require('../lib/consent');

const withEnv = (env, fn) => {
  const old = {};
  for (const k of Object.keys(env)) { old[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { fn(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
};
const FUTURE = new Date(Date.now() + 864e5).toISOString();
const PAST = new Date(Date.now() - 864e5).toISOString();

test('flag off (default): only the box gives launch and ongoing consent', () => {
  withEnv({ JOIN_IS_LAUNCH_CONSENT: undefined, FOUNDING_CLOSES_AT: FUTURE, KLAVIYO_PRIVATE_KEY: undefined }, () => {
    assert.deepStrictEqual(consent.optins(false), { launch_optin: false, ongoing_optin: false });
    assert.deepStrictEqual(consent.optins(true), { launch_optin: true, ongoing_optin: true });
    assert.strictEqual(consent.copy('founding').version, 'founding-off-v1');
    assert.match(consent.copy('day-one-stack').line, /your guide/);
  });
});

test('flag on: joining is launch consent until the close; the box is ongoing only', () => {
  withEnv({ JOIN_IS_LAUNCH_CONSENT: 'true', FOUNDING_CLOSES_AT: FUTURE }, () => {
    assert.deepStrictEqual(consent.optins(false), { launch_optin: true, ongoing_optin: false });
    assert.strictEqual(consent.copy('founding').version, 'founding-on-v1');
    assert.match(consent.copy('founder-score').line, /founding list/);
  });
  withEnv({ JOIN_IS_LAUNCH_CONSENT: 'true', FOUNDING_CLOSES_AT: PAST }, () => {
    assert.deepStrictEqual(consent.optins(false), { launch_optin: false, ongoing_optin: false });
    assert.strictEqual(consent.copy('idea-test').version, 'idea-test-after-v1');
  });
});

test('consent record keeps what was shown and ticked', () => {
  withEnv({ JOIN_IS_LAUNCH_CONSENT: undefined, FOUNDING_CLOSES_AT: FUTURE, KLAVIYO_PRIVATE_KEY: undefined }, () => {
    const r = consent.record('founding', true, 'abc');
    assert.strictEqual(r.version, 'founding-off-v1');
    assert.strictEqual(r.box, true);
    assert.strictEqual(r.ipHash, 'abc');
    assert.ok(Date.parse(r.at));
  });
});

test('flag off with Klaviyo on: unticked joiners get no confirm email, so the founding line does not promise one', () => {
  withEnv({ JOIN_IS_LAUNCH_CONSENT: undefined, FOUNDING_CLOSES_AT: FUTURE, KLAVIYO_PRIVATE_KEY: 'x' }, () => {
    const c = consent.copy('founding');
    assert.strictEqual(c.version, 'founding-off-noconfirm-v1');
    assert.match(c.line, /we won't email you/);
    assert.doesNotMatch(c.line, /only email your confirm link/);
  });
});
