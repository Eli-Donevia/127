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
  const e = await wall.submit(user, { kind: 'site', url: 'maya-tutoring.com', title: 'Maya Tutoring', consent: 'first', agree: true });
  assert.equal(e.status, 'pending');
  assert.equal(e.url, 'https://maya-tutoring.com/');
  assert.equal(e.consentText, wall.releaseText('first'));
  assert.match(e.consentText, /\(x\) my first name only, and link to the address I gave/);
  assert.equal(e.consentVersion, 'wall-v1-2026-10-21');
  process.env.WALL = 'on';
  assert.equal(wall.publicList().length, 0);
  await wall.setStatus(e.id, 'shown', 'admin@example.com');
  const shown = wall.publicList();
  assert.equal(shown[0].by, 'Maya');
  assert.ok(!('memberId' in shown[0]) && !('email' in shown[0]));
  assert.match(shown[0].report, /^mailto:hello@127group\.io\?subject=/);
  assert.equal(shown[0].connection, '');
  process.env.WALL = 'off';
  assert.equal(wall.publicList().length, 0);
  assert.ok(await wall.remove(user, e.id));
  assert.equal(db.get('wall', e.id) ? 1 : 0, 0);
});

test('a private preview link can be sent but never shown; amounts are refused', async () => {
  const e = await wall.submit(user, { kind: 'site', url: 'https://deploy-preview-12--maya.netlify.app', title: 'Maya', consent: 'public', agree: true });
  assert.ok(e.private);
  await assert.rejects(wall.setStatus(e.id, 'shown', 'a'), /private preview/);
  assert.ok(!wall.looksPrivate('https://maya.netlify.app'));
  await assert.rejects(wall.submit(user, { kind: 'win', title: 'Made $4,000 in a week', consent: 'first', agree: true }), /amounts/);
  await assert.rejects(wall.submit(user, { kind: 'site', url: 'javascript:alert(1)', title: 'x', consent: 'first', agree: true }), /address/);
});

test('a Challenge entry needs no account, is kept by email and joins the account later', async () => {
  const e = await wall.submit({ email: 'Jo@Example.com', firstName: 'Jo Park', business: 'Jo Bakes' }, { kind: 'site', url: 'jobakes.com', title: 'Jo Bakes', consent: 'public', source: 'challenge', agree: true });
  assert.equal(e.memberId, null);
  assert.equal(e.email, 'jo@example.com');
  process.env.WALL = 'on';
  await wall.setStatus(e.id, 'shown', 'a');
  assert.equal(wall.publicList({ kind: 'site', source: 'challenge' })[0].by, 'Jo, Jo Bakes');
  assert.equal(wall.publicList({ source: 'hq' }).length, 0);
  // Only a verified email joins the account (NU25).
  assert.equal(await wall.link({ id: 'jo-member', email: 'jo@example.com', emailVerified: false }), 0);
  assert.equal(await wall.link({ id: 'jo-member', email: 'jo@example.com', emailVerified: true }), 1);
  assert.equal(wall.mine('jo-member').length, 1);
  await wall.forget('jo-member');
  assert.equal(wall.mine('jo-member').length, 0);
});

test('the release box must be ticked, and a win is only something the member did or made', async () => {
  await assert.rejects(wall.submit(user, { kind: 'site', url: 'maya.com', title: 'Maya', consent: 'first' }), /Tick the box/);
  await assert.rejects(wall.submit(user, { kind: 'win', title: 'Got my first client', consent: 'first', agree: true }), /did or made/);
  await assert.rejects(wall.submit(user, { kind: 'win', title: 'Week one', note: '12 replies came in', consent: 'first', agree: true }), /did or made/);
  const ok = await wall.submit(user, { kind: 'win', title: 'Posted every day this week', consent: 'first', agree: '1' });
  assert.equal(ok.status, 'pending');
  // An outcome win slipped in some other way still can't be shown.
  db.save('wall', { ...ok, title: 'Landed 2 clients' });
  await assert.rejects(wall.setStatus(ok.id, 'shown', 'a'), /Outcome wins wait/);
});

test('a connection with 127 goes on the entry, staff are spotted on their own, and the line is on every surface', async () => {
  const old = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'eli@example.com';
  const staff = await wall.submit({ id: 'wall-staff', name: 'Eli C', email: 'Eli@example.com' }, { kind: 'site', url: 'eli.com', title: 'Eli', consent: 'first', agree: true });
  assert.equal(staff.connection, 'staff');
  const e = await wall.submit(user, { kind: 'site', url: 'maya-tutoring.com', title: 'Maya Tutoring', consent: 'first', agree: true });
  await wall.setConnection(e.id, 'free');
  process.env.WALL = 'on';
  await wall.setStatus(e.id, 'shown', 'a');
  assert.equal(wall.publicList().find((x) => x.id === e.id).connection, '127 gave me free access to try it.');
  assert.match(wall.LINE, /^Shared by members who chose to\. They aren't a sample of everyone's results/);
  assert.equal(wall.RULES.length, 6);
  process.env.ADMIN_EMAILS = old || '';
  if (!old) delete process.env.ADMIN_EMAILS;
});

test('a Challenge entry never tied to an account goes after 12 months; one with an account stays', async () => {
  const e = await wall.submit({ email: 'old@example.com', firstName: 'Old' }, { kind: 'site', url: 'old.com', title: 'Old', consent: 'first', agree: true, source: 'challenge' });
  const m = await wall.submit(user, { kind: 'site', url: 'maya.com', title: 'Maya', consent: 'first', agree: true });
  const later = Date.parse(e.createdAt) + 366 * 864e5;
  db.save('wall', { ...m, createdAt: e.createdAt });
  assert.equal(await wall.sweep(Date.parse(e.createdAt) + 300 * 864e5), 0);
  assert.equal(await wall.sweep(later), 1);
  assert.ok(!db.get('wall', e.id));
  assert.ok(db.get('wall', m.id));
});
