// HQ as a workspace (lib/harness/nav.js, HQ_WORKSPACE=on): the rail, the phone bar and More.
const test = require('node:test');
const assert = require('node:assert/strict');
const nav = require('../lib/harness/nav');

const user = { email: 'member@example.com', emailVerified: true, tier: 'builder' };

test('HQ_WORKSPACE is off unless set to on', () => {
  const old = process.env.HQ_WORKSPACE;
  try {
    delete process.env.HQ_WORKSPACE; assert.equal(nav.on(), false);
    process.env.HQ_WORKSPACE = 'true'; assert.equal(nav.on(), false);
    process.env.HQ_WORKSPACE = 'on'; assert.equal(nav.on(), true);
  } finally { if (old === undefined) delete process.env.HQ_WORKSPACE; else process.env.HQ_WORKSPACE = old; }
});

test('only pages on main show; every item sits in one group', () => {
  const ws = nav.workspace(user);
  const ids = ws.groups.flatMap((g) => g.items.map((i) => i.id));
  for (const off of ['studio', 'store', 'skills', 'activity', 'team', 'prompts', 'connections']) assert.ok(!ids.includes(off), off);
  for (const on of ['today', 'ask', 'inbox', 'pipeline', 'workflows', 'runs', 'brain', 'library']) assert.ok(ids.includes(on), on);
  assert.equal(new Set(ids).size, ids.length);
  for (const g of ws.groups) assert.ok(g.items.length > 0);
});

test('the phone bar is four places with Ask 127 in it, and More holds the rest', () => {
  const ws = nav.workspace(user, { tab: 'start', inboxCount: 3 });
  assert.deepEqual(ws.phone.map((i) => i.id), ['today', 'workflows', 'ask', 'inbox']);
  const all = ws.groups.flatMap((g) => g.items).length;
  assert.equal(ws.phone.length + ws.more.length, all);
  assert.equal(ws.here, 'workflows');
  assert.equal(ws.phone.find((i) => i.id === 'workflows').here, true);
  assert.equal(ws.phone.find((i) => i.id === 'inbox').count, 3);
});

test('a workspace page joins the rail when its flag is on for the member', () => {
  const ws = nav.workspace(user, { tab: 'team-role', flags: { HQ_SKILLS: true, HQ_TEAM: true, HQ_AGENT: true } });
  const items = ws.groups.flatMap((g) => g.items);
  assert.ok(items.some((i) => i.id === 'skills') && items.some((i) => i.id === 'team'));
  assert.equal(items.find((i) => i.id === 'ask').href, '/app/hq/ask');
  assert.equal(ws.here, 'team');
  assert.equal(nav.workspace(user).groups.flatMap((g) => g.items).find((i) => i.id === 'ask').href, '/app/hq#talk');
});
