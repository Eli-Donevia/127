const test = require('node:test');
const assert = require('node:assert');
const kit = require('../lib/coach-kit');

test('the default kit has every piece and no result claims', () => {
  const k = kit.build({});
  for (const part of ['site', 'challenge', 'vsl', 'ads', 'emails', 'dms', 'posts', 'consult', 'app']) assert.ok(k[part], part);
  assert.strictEqual(k.posts.length, 30);
  assert.deepStrictEqual(k.problems, []);
});

test('a coach story with a body result is flagged', () => {
  const k = kit.build({ story: 'My clients lose 20 lbs in a month, guaranteed.' });
  assert.ok(k.problems.length >= 1);
});

test('inputs are cleaned and bounded', () => {
  const k = kit.build({ days: '500', price: '-3', color: 'red', keyword: 'go now!', handle: '@me<script>' });
  assert.strictEqual(k.facts.days, 90);
  assert.strictEqual(k.facts.price, 0);
  assert.strictEqual(k.facts.priceText, 'Free');
  assert.strictEqual(k.facts.color, kit.DEFAULTS.color);
  assert.strictEqual(k.facts.keyword, 'GONOW');
  assert.strictEqual(k.facts.handle, 'mescript');
});

test('a coach edit replaces kit text, bad paths are ignored, and an edited claim is flagged', () => {
  const kit = require('../lib/coach-kit').build({});
  const K = require('../lib/coach-kit');
  const kept = K.applyEdits(kit, { 'site.heroTitle': 'Train at home with me.', 'challenge.rules.0': 'Move for 30 minutes.', 'facts.price': '1', 'site.program.0.price': 'x', 'site.__proto__.x': 'y', 'site.nope': 'z' });
  assert.equal(kit.site.heroTitle, 'Train at home with me.');
  assert.equal(kit.challenge.rules[0], 'Move for 30 minutes.');
  assert.deepEqual(Object.keys(kept).sort(), ['challenge.rules.0', 'site.heroTitle']);
  assert.equal(kit.problems.length, 0);
  K.applyEdits(kit, { 'site.heroSub': 'Lose 10 lbs in 21 days.' });
  assert.ok(kit.problems.length > 0);
});
