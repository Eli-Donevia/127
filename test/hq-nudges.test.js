// HQ that notices (HQ_NUDGES, lib/harness/nudges.js): the run with rest days, levels, marks, the one daily line,
// Monday's read, rival counts and Progress. Lines never talk about money or promise results (L62).
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../lib/db');
const flags = require('../lib/harness/flags');
const nudges = require('../lib/harness/nudges');
const today = require('../lib/harness/today');
const { check } = require('../lib/copy-check');

// Wednesday Oct 21 2026, 6pm Chicago.
const NOW = Date.parse('2026-10-21T23:00:00Z');
const user = { id: 'nudge-test', email: 'n@example.com', name: 'Maya Lee' };
const key = today.dayKey(NOW);

function seed(days) {
  for (const [offset, total, content = 0] of days) {
    const day = today.addDays(key, offset);
    db.save('actions', { id: `${user.id}:${day}`, memberId: user.id, day, counts: { warm: total, cold: 0, content, ads: 0 }, total: total + content });
  }
}
function clear() {
  for (const col of ['actions', 'pipeline', 'runs', 'proof', 'nudges']) for (const d of db.filter(col, (x) => x.memberId === user.id || x.id === user.id)) db.remove(col, d.id);
  db.remove('brains', user.id);
}

test.beforeEach(() => {
  clear();
  nudges._setDeps({ now: () => NOW });
  today._setDeps({ now: () => NOW });
});
test.after(() => {
  clear();
  nudges._setDeps({ now: () => Date.now() });
  today._setDeps({ now: () => Date.now() });
});

test('HQ_NUDGES is a known switch and off by default', () => {
  assert.ok(flags.NAMES.includes('HQ_NUDGES'));
  const old = process.env.HQ_NUDGES;
  delete process.env.HQ_NUDGES;
  try {
    assert.equal(flags.on('HQ_NUDGES', { email: 'x@example.com', emailVerified: true }), false);
  } finally {
    if (old !== undefined) process.env.HQ_NUDGES = old;
  }
});

test('the run: every 7 days earns a rest day that covers a miss on its own', () => {
  const byDay = {};
  const put = (o, t) => { const d = today.addDays(key, o); byDay[d] = { day: d, total: t, counts: { warm: t } }; };
  for (let o = -10; o <= -4; o++) put(o, 25); // 7 at the number: one rest day earned
  put(-3, 0); // covered
  put(-2, 25);
  put(-1, 25);
  const r = nudges.runOf(byDay, 25, key);
  assert.equal(r.status[today.addDays(key, -3)], 'rest');
  assert.equal(r.days, 9);
  assert.equal(r.rest, 0);
  assert.equal(r.todayHit, false);
  assert.equal(r.status[key], 'now');
  // A second miss with no rest day held ends it.
  put(-1, 0);
  const r2 = nudges.runOf(byDay, 25, key);
  assert.equal(r2.days, 0);
  assert.equal(r2.longest, 8);
});

test('rest days cap at 2 and the run counts today once it is hit', () => {
  const byDay = {};
  for (let o = -30; o <= 0; o++) { const d = today.addDays(key, o); byDay[d] = { day: d, total: 30, counts: { warm: 30 } }; }
  const r = nudges.runOf(byDay, 25, key);
  assert.equal(r.rest, 2);
  assert.equal(r.days, 31);
  assert.equal(r.todayHit, true);
});

test('levels climb in order from the firsts and the run', () => {
  db.save('brains', { id: user.id, business: {}, act: { a1: 'x', a3: 'x' } });
  seed([[-7, 25], [-6, 25], [-5, 25], [-4, 25], [-3, 25], [-2, 25], [-1, 25]]);
  const lv = nudges.level(nudges.summary(user));
  // Seven days running is reached, but level 3 (first reply) isn't, so the member is at 2 with "First reply" next.
  assert.equal(lv.n, 2);
  assert.equal(lv.next.name, 'First reply');
});

test('a run about to end is the line after 4pm, in the member\'s voice, and muting or quiet hours hide it', async () => {
  seed([[-3, 25], [-2, 25], [-1, 25], [0, 10]]);
  let line = nudges.daily(user);
  assert.equal(line.id, 'run_risk');
  assert.match(line.say, /^Your 3-day run ends at midnight\. 15 sends to go\.$/);
  await nudges.setPrefs(user, { tone: 'easy' });
  assert.match(nudges.daily(user).say, /3 days in/);
  await nudges.setPrefs(user, { mute: { run: true } });
  line = nudges.daily(user);
  assert.ok(!line || line.kind !== 'run');
  await nudges.setPrefs(user, { mute: {}, quietFrom: 17, quietTo: 8 });
  line = nudges.daily(user);
  assert.ok(!line || line.kind !== 'run', 'pushing lines wait in quiet hours');
});

test('replies waiting come first and stay in quiet hours', async () => {
  seed([[-2, 25], [-1, 25], [0, 3]]);
  db.save('pipeline', { id: 'nudge-lead', memberId: user.id, stage: 'replied', repliedAt: new Date(NOW - 5 * 36e5).toISOString(), history: [] });
  await nudges.setPrefs(user, { quietFrom: 17, quietTo: 8 });
  const line = nudges.daily(user);
  assert.equal(line.id, 'replies_waiting');
  assert.equal(line.say, 'Someone wrote back and is waiting on you.');
});

test('rivals keep a handle and weekly counts only, and the pace line compares like weeks', async () => {
  seed([[-2, 25, 1]]);
  await nudges.addRival(user, { handle: 'https://www.instagram.com/NorthSide.Fit/', platform: 'instagram' });
  const p = nudges.prefs(user);
  assert.equal(p.rivals[0].handle, 'northside.fit');
  const week = today.weekStart(key);
  await nudges.countRival(user, p.rivals[0].id, { week, n: 4 });
  const line = nudges.daily(user);
  assert.equal(line.id, 'rival_ahead');
  assert.equal(line.say, '@northside.fit posted 4 times this week. You posted once.');
  assert.deepEqual(Object.keys(nudges.prefs(user).rivals[0]).sort(), ['addedAt', 'counts', 'handle', 'id', 'platform']);
  await assert.rejects(nudges.addRival(user, { handle: 'bad handle!!' }), /handle/);
  await nudges.addRival(user, { handle: 'a' });
  await nudges.addRival(user, { handle: 'b' });
  await assert.rejects(nudges.addRival(user, { handle: 'c' }), /3 accounts/);
  await nudges.removeRival(user, p.rivals[0].id);
  assert.ok(!JSON.stringify(nudges.prefs(user)).includes('northside'));
});

test('marks are dated once and glow until seen', async () => {
  await nudges.sync(user); // switched on before anything was earned
  db.save('brains', { id: user.id, business: {}, act: { a3: 'x' } });
  seed([[-1, 120]]);
  await nudges.sync(user);
  let m = nudges.progress(user).marks;
  const hundred = m.find((x) => x.id === 'hundred_day');
  assert.ok(hundred.earned && hundred.fresh);
  assert.ok(m.find((x) => x.id === 'first_send').earned);
  assert.equal(m.find((x) => x.id === 'run30').earned, null);
  await nudges.markSeen(user);
  m = nudges.progress(user).marks;
  assert.ok(!m.some((x) => x.fresh));
});

test('marks earned before the switch went on count, with no date and no glow', async () => {
  db.save('brains', { id: user.id, business: {}, act: { a3: 'x' } });
  await nudges.sync(user);
  const m = nudges.progress(user).marks.find((x) => x.id === 'first_send');
  assert.ok(m.earned && m.early && !m.fresh);
  assert.ok(!nudges.progress(user).log.some((x) => /Your first message/.test(x.what)));
});

test('Monday\'s challenge picks the thinnest number and fills from real data', async () => {
  await nudges.setPrefs(user, { postGoal: 3 });
  seed([[-9, 25, 1], [0, 25, 2]]);
  const w = nudges.weekly(user);
  assert.equal(w.challenge.id, 'post');
  assert.equal(w.challenge.title, 'Post 3 times by Sunday.');
  await nudges.takeChallenge(user);
  const c = nudges.weekly(user).challenge;
  assert.ok(c.taken);
  assert.equal(c.progress, 2);
  assert.equal(c.pct, 67);
});

test('Progress has the month as a calendar and a ship log of firsts and jobs', () => {
  db.save('brains', { id: user.id, business: {}, act: { a1: '2026-10-02T15:00:00Z', a3: '2026-10-05T15:00:00Z' } });
  db.save('runs', { id: 'nudge-run', memberId: user.id, workflowId: 'site.build', title: 'Your website', status: 'done', endedAt: '2026-10-10T15:00:00Z' });
  seed([[-1, 25]]);
  const pr = nudges.progress(user);
  assert.equal(pr.month.key, '2026-10');
  assert.equal(pr.month.cal.filter(Boolean).length, 31);
  assert.equal(pr.month.cal.indexOf(pr.month.cal.find(Boolean)), 3, 'Oct 1 2026 is a Thursday, Monday first');
  assert.deepEqual(pr.log.map((x) => x.what).slice(-3), ['Your website finished.', 'First send.', 'Business set.']);
  db.remove('runs', 'nudge-run');
});

test('every line HQ can say passes the copy check, as copy about a paid plan', async () => {
  // Build a member who triggers every kind of line, then sweep both voices.
  db.save('brains', { id: user.id, business: {}, act: {} });
  seed([[-8, 25, 1], [-7, 30], [-6, 30], [-5, 30], [-4, 30], [-3, 25], [-2, 25], [-1, 25], [0, 5]]);
  db.save('pipeline', { id: 'nudge-lead', memberId: user.id, stage: 'replied', repliedAt: new Date(NOW - 30 * 36e5).toISOString(), history: [] });
  await nudges.addRival(user, { handle: 'rival' });
  await nudges.countRival(user, nudges.prefs(user).rivals[0].id, { week: today.weekStart(key), n: 7 });
  const s = nudges.summary(user);
  const lines = nudges.candidates(user, s, {}, 18);
  assert.ok(lines.length >= 4);
  const all = lines.flatMap((l) => [l.say.straight, l.say.easy, l.sub]).concat(nudges.LEVELS.map((l) => l.next), nudges.MARKS.map((m) => m.says), [nudges.weekly(user).head]);
  for (const t of all) {
    assert.ok(!/\$|revenue|income|earn|clients?\b|leads?\b|guarantee|will get/i.test(t), t);
    const found = check(t, { paid: true }).filter((f) => f.level === 'block');
    assert.deepEqual(found, [], t);
  }
  db.remove('pipeline', 'nudge-lead');
});

test('the morning pulse: yesterday in lines, money only from the caller, plus the one move', async () => {
  seed([[-2, 25], [-1, 30, 1], [0, 2]]);
  const p = await nudges.pulse(user, { money: async (u, day) => ({ sales: 412.4, salesFrom: 'Stripe', adSpend: 38, adsFrom: 'Meta' }) });
  assert.equal(p.day, today.addDays(key, -1));
  const ids = p.lines.map((l) => l.id);
  assert.deepEqual(ids, ['sent', 'posts', 'sales', 'adSpend', 'run']);
  assert.equal(p.lines.find((l) => l.id === 'sales').text, '$412 in sales (Stripe).');
  assert.equal(p.lines[0].text, '30 messages sent, your number hit.');
  assert.ok(p.nextStep && p.nextStep.href);
  // A connection that throws leaves its lines out; nothing at all yesterday and no move gives null.
  const q = await nudges.pulse(user, { money: async () => { throw new Error('down'); } });
  assert.ok(!q.lines.some((l) => l.id === 'sales'));
  clear();
  db.save('brains', { id: user.id, business: {}, act: { a1: 'x', a3: 'x', a4: 'x' } });
  assert.equal(await nudges.pulse(user), null);
});

test('account deletion forgets everything HQ kept here', async () => {
  await nudges.addRival(user, { handle: 'gone' });
  assert.ok(db.get('nudges', user.id));
  await nudges.forget(user.id);
  assert.ok(!db.get('nudges', user.id));
});

test('New in 127 this week: a baseline first, then whatever landed since, and most run only past 3 members', async () => {
  const drops = require('../lib/harness/drops');
  drops._setDeps({ now: () => NOW });
  const week = today.weekStart(key);
  for (const id of ['drops:seen', `drops:${week}`]) db.remove('harnessCache', id);
  try {
    let d = await drops.thisWeek();
    assert.equal(d.items.length, 0, 'the first snapshot is a baseline');
    const all = drops.shelves();
    assert.ok(all.length > 0);
    db.remove('harnessCache', `drops:${week}`);
    db.save('harnessCache', { id: 'drops:seen', key: 'drops:seen', ids: all.slice(1).map((x) => x.key), expiresAt: NOW + 864e5 });
    d = await drops.thisWeek();
    assert.deepEqual(d.items.map((x) => x.key), [all[0].key]);
    // Most run: a workflow two members finished doesn't show; a third member makes it show.
    const wf = all.find((x) => x.kind === 'workflows');
    if (wf) {
      const at = new Date(NOW - 36e5).toISOString();
      for (const m of ['m1', 'm2']) db.save('runs', { id: `drop-${m}`, memberId: m, workflowId: wf.id, status: 'done', endedAt: at });
      assert.equal(drops.mostRun().length, 0);
      db.save('runs', { id: 'drop-m3', memberId: 'm3', workflowId: wf.id, status: 'done', endedAt: at });
      assert.equal(drops.mostRun()[0].id, wf.id);
      for (const m of ['m1', 'm2', 'm3']) db.remove('runs', `drop-${m}`);
    }
  } finally {
    for (const id of ['drops:seen', `drops:${week}`]) db.remove('harnessCache', id);
    drops._setDeps({ now: () => Date.now() });
  }
});
