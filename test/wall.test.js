// The wall (lib/wall.js): opt-in, approved by an admin, shown only with WALL=on, named the way the member agreed,
// never a private preview link, no amounts, gone at once on Remove, and one store for HQ and the Challenge.
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const wall = require('../lib/wall');

const user = { id: 'wall-test', name: 'Maya Lee' };
const clear = () => { for (const e of db.filter('wall', () => true)) db.remove('wall', e.id); db.remove('brains', user.id); };
test.beforeEach(clear);
test.after(() => { clear(); delete process.env.WALL; });

test('nothing shows until an admin approves it and WALL is on, then only as agreed', async () => {
  db.save('brains', { id: user.id, business: { name: 'Maya Tutoring' } });
  const e = await wall.submit(user, { kind: 'site', url: 'maya-tutoring.com', title: 'Maya Tutoring', consent: 'first' });
  assert.equal(e.status, 'pending');
  assert.equal(e.url, 'https://maya-tutoring.com/');
  assert.equal(e.consentText, wall.CONSENT.first);
  process.env.WALL = 'on';
  assert.equal(wall.publicList().length, 0);
  await wall.setStatus(e.id, 'shown', 'admin@example.com');
  const shown = wall.publicList();
  assert.equal(shown[0].by, 'Maya');
  assert.ok(!('memberId' in shown[0]) && !('email' in shown[0]));
  process.env.WALL = 'off';
  assert.equal(wall.publicList().length, 0);
  assert.ok(await wall.remove(user, e.id));
  assert.equal(db.get('wall', e.id) ? 1 : 0, 0);
});

test('a private preview link can be sent but never shown; amounts are refused', async () => {
  const e = await wall.submit(user, { kind: 'site', url: 'https://deploy-preview-12--maya.netlify.app', title: 'Maya', consent: 'public' });
  assert.ok(e.private);
  await assert.rejects(wall.setStatus(e.id, 'shown', 'a'), /private preview/);
  assert.ok(!wall.looksPrivate('https://maya.netlify.app'));
  await assert.rejects(wall.submit(user, { kind: 'win', title: 'Made $4,000 in a week', consent: 'first' }), /amounts/);
  await assert.rejects(wall.submit(user, { kind: 'site', url: 'javascript:alert(1)', title: 'x', consent: 'first' }), /address/);
});

test('a Challenge entry needs no account, is kept by email and joins the account later', async () => {
  const e = await wall.submit({ email: 'Jo@Example.com', firstName: 'Jo Park', business: 'Jo Bakes' }, { kind: 'site', url: 'jobakes.com', title: 'Jo Bakes', consent: 'public', source: 'challenge' });
  assert.equal(e.memberId, null);
  assert.equal(e.email, 'jo@example.com');
  process.env.WALL = 'on';
  await wall.setStatus(e.id, 'shown', 'a');
  assert.equal(wall.publicList({ kind: 'site', source: 'challenge' })[0].by, 'Jo, Jo Bakes');
  assert.equal(wall.publicList({ source: 'hq' }).length, 0);
  assert.equal(await wall.link('jo@example.com', 'jo-member'), 1);
  assert.equal(wall.mine('jo-member').length, 1);
  await wall.forget('jo-member');
  assert.equal(wall.mine('jo-member').length, 0);
});
