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

test('the Map of everything only holds shelves the rail shows', () => {
  const only = nav.mapItems({ groups: [{ items: [{ id: 'prompts' }] }] });
  assert.ok(only.length > 0);
  assert.ok(only.every((i) => i[0] === 'prompts' && i[1] && i[2].startsWith('/app/hq/prompts/')));
  assert.deepEqual(nav.mapItems({ groups: [] }), []);
});

test('the Connections gallery carries a brand mark where Simple Icons has one', () => {
  const icons = require('../lib/harness/connectors/brand-icons');
  const catalog = require('../lib/harness/connectors/catalog');
  for (const id of Object.keys(icons)) assert.ok(catalog.byId[id], id);
  assert.ok(icons.stripe && /^M/.test(icons.stripe));
});

test('Read my week: the AI line is one sentence and never about money, promises or Eli (Legal L79 RW4)', () => {
  const week = require('../lib/harness/week');
  assert.equal(week.clean('Most replies came from gyms you wrote to in the morning. Keep going.'), 'Most replies came from gyms you wrote to in the morning.');
  for (const bad of ['You made $400 this week.', 'Your sales went up.', 'This will get you more calls.', 'Revenue is climbing.', 'We guarantee more replies.', 'Eli would send more in the morning.', 'You got paid twice.']) assert.equal(week.clean(bad), null, bad);
  assert.equal(week.clean(''), null);
});

test('Read my week: what the AI line may see is counts only (Legal L79 RW1)', () => {
  const week = require('../lib/harness/week');
  const db = require('../lib/db');
  const now = Date.now();
  const at = new Date(now - 60 * 60 * 1000).toISOString();
  const lead = { id: 'wk-test-lead', memberId: 'wk-test', pack: 'gym', key: 'k', name: 'Joe Smith', company: 'Joe Gym', note: 'secret note', links: { email: 'joe@example.com' }, stage: 'replied', history: [{ at, stage: 'contacted' }, { at, stage: 'replied' }] };
  db.save('pipeline', lead);
  try {
    const c = week.counts({ id: 'wk-test' });
    const text = JSON.stringify(c);
    for (const leak of ['Joe', 'joe@example.com', 'secret', 'Smith']) assert.ok(!text.includes(leak), leak);
    const rows = Object.values(c.thisWeek).concat(Object.values(c.lastWeek));
    assert.ok(rows.length > 0);
    for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['calls', 'replies', 'sent', 'yeses']);
  } finally {
    db.remove('pipeline', 'wk-test-lead');
  }
});
