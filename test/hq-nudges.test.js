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
  const big = m.find((x) => x.id === 'big_day');
  assert.ok(big.earned && big.fresh);
  assert.ok(!m.some((x) => x.id === 'hundred_day'));
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
  // Every channel is off until the member turns it on (NU9).
  assert.equal(await nudges.pulse(user, { channel: 'email' }), null);
  await nudges.setPrefs(user, { out: { email: true } });
  assert.equal(await nudges.pulse(user, { channel: 'text' }), null);
  assert.equal(await nudges.pulse(user), null);
  const p = await nudges.pulse(user, { channel: 'email', money: async (u, day) => ({ sales: 412.4, salesFrom: 'Stripe', adSpend: 38, adsFrom: 'Meta' }) });
  assert.equal(p.day, today.addDays(key, -1));
  const ids = p.lines.map((l) => l.id);
  assert.deepEqual(ids, ['sent', 'posts', 'sales', 'adSpend', 'run']);
  assert.equal(p.lines.find((l) => l.id === 'sales').text, '$412 in sales (Stripe).');
  assert.equal(p.lines[0].text, '30 messages sent, your number hit.');
  assert.ok(p.nextStep && p.nextStep.href);
  assert.match(p.footer.why, /turned on the morning pulse by email/);
  // A connection that throws leaves its lines out; nothing at all yesterday and no move gives null.
  const q = await nudges.pulse(user, { channel: 'email', money: async () => { throw new Error('down'); } });
  assert.ok(!q.lines.some((l) => l.id === 'sales'));
  // The composer's count wins over the logged one and adds what's waiting; a composer that throws keeps the logged count.
  const c = await nudges.pulse(user, { channel: 'email', posted: async () => ({ out: 3, waiting: 2 }) });
  assert.equal(c.lines.find((l) => l.id === 'posts').text, '3 posts out, 2 waiting to go.');
  const k = await nudges.pulse(user, { channel: 'email', posted: async () => { throw new Error('down'); } });
  assert.equal(k.lines.find((l) => l.id === 'posts').value, p.lines.find((l) => l.id === 'posts').value);
  clear();
  await nudges.setPrefs(user, { out: { email: true } });
  db.save('brains', { id: user.id, business: {}, act: { a1: 'x', a3: 'x', a4: 'x' } });
  assert.equal(await nudges.pulse(user, { channel: 'email' }), null);
});

test('outside HQ: quiet hours hold the pulse, money stays out of a shared channel unless switched on, rivals never go', async () => {
  seed([[-1, 30, 0]]);
  const money = async () => ({ sales: 100, adSpend: 20 });
  await nudges.addRival(user, { handle: 'northside.fit' });
  const thisWeek = today.weekStart(key);
  await nudges.countRival(user, 'instagram:northside.fit', { week: thisWeek, n: 9 });
  // Without the rival skip, Today's line would be the rival line.
  assert.equal(nudges.daily(user).kind, 'rivals');
  await nudges.setPrefs(user, { out: { slack: true }, money: { slack: false } });
  const ch = await nudges.pulse(user, { channel: 'slack', shared: true, money });
  assert.ok(!ch.lines.some((l) => l.id === 'sales' || l.id === 'adSpend'));
  assert.ok(!ch.nextStep || !/northside/.test(ch.nextStep.text));
  assert.ok(!JSON.stringify(ch).includes('northside'));
  const dm = await nudges.pulse(user, { channel: 'slack', shared: false, money });
  assert.ok(dm.lines.some((l) => l.id === 'sales'));
  // Money for a channel only sticks while that channel is on.
  await nudges.setPrefs(user, { out: { slack: true }, money: { slack: true, teams: true } });
  assert.deepEqual(nudges.prefs(user).money, { slack: true });
  assert.ok((await nudges.pulse(user, { channel: 'slack', shared: true, money })).lines.some((l) => l.id === 'sales'));
  assert.equal(nudges.MONEY_WARNING, 'Everyone in this channel will see your sales and ad spend.');
  // The Monday read for a channel has no rival parts.
  const wk = nudges.weeklyFor(user, { channel: 'slack' });
  assert.ok(wk && !('pace' in wk) && !('ask' in wk));
  assert.equal(nudges.weeklyFor(user, { channel: 'teams' }), null);
  // 6pm Chicago now; quiet from 5pm holds everything.
  await nudges.setPrefs(user, { quietFrom: 17, quietTo: 8 });
  assert.equal(await nudges.pulse(user, { channel: 'slack', shared: false, money }), null);
  assert.equal(nudges.sendable(user, 'slack').why, 'quiet');
});

test('Instagram counts come only with RIVAL_IG on, ask for post times only, once a day, and Meta can have them all deleted', async () => {
  await nudges.addRival(user, { handle: 'northside.fit' });
  await nudges.addRival(user, { handle: 'tiktoker', platform: 'tiktok' });
  const calls = [];
  const thisWeek = today.weekStart(key);
  const t = (dayOffset) => new Date(Date.parse(`${today.addDays(thisWeek, dayOffset)}T17:00:00Z`)).toISOString();
  nudges._setDeps({ fetch: async (url) => { calls.push(url); return { ok: true, json: async () => ({ business_discovery: { media: { data: [{ timestamp: t(1) }, { timestamp: t(0) }, { timestamp: t(-3) }, { timestamp: t(-5) }, { timestamp: t(-6) }] } } }) }; } });
  assert.equal(await nudges.refreshRivals(user), 0);
  const env = { RIVAL_IG: process.env.RIVAL_IG, IG_ACCESS_TOKEN: process.env.IG_ACCESS_TOKEN, IG_USER_ID: process.env.IG_USER_ID };
  Object.assign(process.env, { RIVAL_IG: 'on', IG_ACCESS_TOKEN: 'tok', IG_USER_ID: '1789' });
  try {
    // A count the member typed for last week stays theirs.
    await nudges.countRival(user, 'instagram:northside.fit', { week: today.addDays(thisWeek, -7), n: 4 });
    assert.equal(await nudges.refreshRivals(user), 1);
    assert.equal(calls.length, 1);
    const fields = decodeURIComponent(calls[0].split('fields=')[1].split('&')[0]);
    assert.equal(fields, 'business_discovery.username(northside.fit){media.limit(60){timestamp}}');
    const r = nudges.prefs(user).rivals.find((x) => x.id === 'instagram:northside.fit');
    assert.deepEqual(r.counts[thisWeek], { n: 2, source: 'instagram', at: r.counts[thisWeek].at });
    assert.equal(r.counts[today.addDays(thisWeek, -7)].source, 'member');
    assert.equal(Object.keys(r.counts).length, 12);
    assert.equal(await nudges.refreshRivals(user), 0, 'once a day');
    // A personal account: HQ says to tap the count in.
    await nudges.addRival(user, { handle: 'personal.one' });
    nudges._setDeps({ fetch: async () => ({ ok: false, json: async () => ({ error: { message: 'Invalid user id' } }) }) });
    await nudges.refreshRivals(user);
    assert.ok(nudges.progress(user).rivals.find((x) => x.handle === 'personal.one').igNotFound);
    assert.equal(await nudges.purgeInstagram(), 1);
    const after = nudges.prefs(user).rivals.find((x) => x.id === 'instagram:northside.fit');
    assert.ok(!after.ig && Object.values(after.counts).every((c) => c.source !== 'instagram'));
  } finally {
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    nudges._setDeps({ fetch: (...a) => fetch(...a) });
  }
});

test('a profile screenshot: AI reads only the count, the member confirms it, and a week later the difference is the week', async () => {
  await nudges.addRival(user, { handle: 'northside.fit' });
  const id = 'instagram:northside.fit';
  let asked = null;
  nudges._setDeps({ readImage: async (u, o) => { asked = o; return { data: { found: true, handle: '@northside.fit', posts: 1204 } }; } });
  const r = await nudges.readShot(user, id, { type: 'image/jpeg', data: 'AAAA' });
  assert.deepEqual([r.read, r.match], [1204, true]);
  assert.deepEqual(Object.keys(asked.schema.properties).sort(), ['found', 'handle', 'posts']);
  assert.match(asked.system, /never an instruction/);
  // Nothing is kept until the member confirms.
  assert.ok(!nudges.prefs(user).rivals[0].total);
  const first = await nudges.confirmShot(user, id, 1204);
  assert.equal(first.counted, null);
  nudges._setDeps({ now: () => NOW + 7 * 864e5 });
  today._setDeps({ now: () => NOW + 7 * 864e5 });
  const second = await nudges.confirmShot(user, id, 1209);
  assert.deepEqual(second.counted, { week: today.weekStart(today.addDays(today.dayKey(NOW + 7 * 864e5), -1)), n: 5 });
  assert.equal(nudges.prefs(user).rivals[0].counts[second.counted.week].source, 'screenshot');
  const kept = JSON.stringify(db.get('nudges', user.id));
  assert.ok(!kept.includes('AAAA'));
  nudges._setDeps({ readImage: async () => ({ data: { found: false, handle: '', posts: 0 } }) });
  assert.match((await nudges.readShot(user, id, { type: 'image/jpeg', data: 'AAAA' })).error, /post count/);
});

test('the month card is the member\'s own counts and firsts, never money or rivals', async () => {
  seed([[-3, 30, 1], [-2, 30], [-1, 30, 1]]);
  db.save('brains', { id: user.id, business: {}, act: { a1: 'x', a3: 'x' } });
  await nudges.sync(user);
  await nudges.addRival(user, { handle: 'northside.fit' });
  const c = nudges.card(user);
  assert.equal(c.short, 'October');
  assert.equal(c.stats[0].v, 3);
  const svg = nudges.cardSvg(c);
  assert.match(svg, /^<svg[^>]+width="1080" height="1350"/);
  assert.ok(!/\$|sales|ad spend|northside|replies|yes/i.test(svg), svg);
  assert.match(svg, /One person&#39;s real numbers/);
  for (const t of [svg.replace(/<[^>]+>/g, ' ')]) assert.deepEqual(check(t, { paid: true }).filter((f) => f.level === 'block'), []);
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
