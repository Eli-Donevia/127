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
