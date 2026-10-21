// AI replies on the wins board (lib/win-ai.js, Legal L99 WA1-WA14): which posts get one, the server check, the
// re-check before posting, the label fields and the author's remove. No network: the AI call is stubbed.
const test = require('node:test');
const assert = require('node:assert');
const winAi = require('../lib/win-ai');

const HOUR = 3600e3;
const NOW = Date.parse('2026-12-02T15:00:00Z');
const ENV = { WIN_AI_REPLIES: '1', WIN_REPLIES: '1', ANTHROPIC_API_KEY: 'sk-test' };

function memDb() {
  const data = { users: {}, wins: {} };
  let n = 0;
  return {
    data,
    id: () => `id${++n}`,
    all: (c) => Object.values(data[c]),
    get: (c, id) => data[c][id] || null,
    save: async (c, doc) => {
      if (!doc.id) doc.id = `id${++n}`;
      data[c][doc.id] = doc;
      return doc;
    },
  };
}
function world(asked = []) {
  const db = memDb();
  const events = [];
  winAi._setDeps({ db: () => db, now: () => NOW, emit: (t, p) => events.push({ t, p }), ask: async (text) => { asked.push(text); return 'Booking three interviews in a week takes nerve. That first conversation is the hard one, and you did it.'; } });
  return { db, events, asked };
}
async function post(db, extra = {}, user = {}) {
  const u = await db.save('users', { email: 'a@x.test', name: 'Ana Ruiz', ...user });
  return db.save('wins', { userId: u.id, name: 'Ana', text: 'I booked my first three customer interviews.', status: 'live', flags: [], heldAt: null, aiOk: true, createdAt: new Date(NOW - 13 * HOUR).toISOString(), ...extra });
}

test('the switch needs WIN_AI_REPLIES and WIN_REPLIES; a member is on unless they turn it off', () => {
  assert.strictEqual(winAi.on({}), false);
  assert.strictEqual(winAi.on({ WIN_AI_REPLIES: '1' }), false);
  assert.strictEqual(winAi.on(ENV), true);
  assert.strictEqual(winAi.allows({}), true);
  assert.strictEqual(winAi.allows({ winAiReplies: false }), false);
});

test('a quiet live post gets one labeled AI reply with only its text sent, and never a second', async () => {
  const w = world();
  const win = await post(w.db);
  assert.deepStrictEqual(await winAi.sweep(ENV), { replied: 1, dropped: 0 });
  assert.deepStrictEqual(w.asked, ['I booked my first three customer interviews.'], 'only the post text goes to AI (WA6)');
  const r = w.db.get('wins', win.id).replies[0];
  assert.strictEqual(r.name, "Eli's Playbook (AI)");
  assert.strictEqual(r.byAI, true);
  assert.strictEqual(r.byEli, false);
  assert.strictEqual(r.userId, null);
  assert.strictEqual(r.instructionsVersion, winAi.INSTRUCTIONS_VERSION);
  assert.deepStrictEqual(await winAi.sweep(ENV), { replied: 0, dropped: 0 });
  assert.strictEqual(w.db.get('wins', win.id).replies.length, 1);
});

test('which posts are skipped (WA1-WA5)', async () => {
  const w = world();
  const cases = [
    [{ aiOk: false }, {}, 'not_offered'],
    [{ status: 'held' }, {}, 'not_live'],
    [{ heldAt: '2026-12-01T00:00:00Z', status: 'live', decision: 'approved' }, {}, 'screened'],
    [{ flags: ['hype'] }, {}, 'screened'],
    [{ reports: [{ reason: 'spam' }] }, {}, 'reported'],
    [{ replies: [{ id: 'r', userId: 'u2', text: 'Nice', status: 'live' }] }, {}, 'has_reply'],
    [{ replies: [{ id: 'r', byEli: true, text: 'Nice', status: 'hidden' }] }, {}, 'has_reply'],
    [{ createdAt: new Date(NOW - 11 * HOUR).toISOString() }, {}, 'too_soon'],
    [{ createdAt: new Date(NOW - 4 * 24 * HOUR).toISOString() }, {}, 'too_old'],
    [{}, { winAiReplies: false }, 'turned_off'],
    [{}, { ageReview: { status: 'open' } }, 'age_review'],
    [{}, { postingPausedUntil: new Date(NOW + HOUR).toISOString() }, 'paused'],
    [{ text: 'Went back to work after surgery and shipped my first page.' }, {}, 'health'],
    [{ text: 'Down 10 lbs of weight and launched my store.' }, {}, 'health'],
  ];
  for (const [extra, user, want] of cases) {
    const win = await post(w.db, extra, user);
    assert.strictEqual(winAi.skipReason(win, w.db.get('users', win.userId), NOW), want, want);
  }
  assert.strictEqual(winAi.skipReason(await post(w.db), w.db.get('users', 'id1'), NOW), null);
});

test('the server check drops a reply on money, promises of earnings, Eli, links, handles, contacts or length (WA10)', () => {
  const bad = [
    ['That first $500 is huge.', 'money'],
    ['Ten k is a lot of progress.', null],
    ['That 5k month is real.', 'money'],
    ['This will grow your income.', 'money_word'],
    ['Eli would love this.', 'eli'],
    ['See 127group.io for more.', 'link'],
    ['Follow @someone for tips.', 'handle'],
    ['Write to me at a@b.co anytime.', 'email'],
    ['Call 312-555-0199 for help.', 'phone'],
    ['x'.repeat(401), 'too_long'],
    ['', 'empty'],
  ];
  for (const [t, want] of bad) assert.strictEqual(winAi.check(t), want, t);
  assert.strictEqual(winAi.check('Booking three interviews in a week takes nerve. You did the hard part.'), null);
});

test('a dropped reply posts nothing and is not retried', async () => {
  const w = world();
  winAi._setDeps({ ask: async () => 'Eli is proud of you, here is $20.' });
  const win = await post(w.db);
  assert.deepStrictEqual(await winAi.sweep(ENV), { replied: 0, dropped: 1 });
  assert.strictEqual((w.db.get('wins', win.id).replies || []).length, 0);
  assert.strictEqual(w.db.get('wins', win.id).aiDropped, 'money');
  assert.deepStrictEqual(await winAi.sweep(ENV), { replied: 0, dropped: 0 });
});

test('it checks again just before posting: a person who replied meanwhile wins (WA4)', async () => {
  const w = world();
  const win = await post(w.db);
  winAi._setDeps({ ask: async () => { w.db.get('wins', win.id).replies = [{ id: 'r', userId: 'u2', text: 'Love it', status: 'live' }]; return 'Nice work on those interviews.'; } });
  assert.deepStrictEqual(await winAi.sweep(ENV), { replied: 0, dropped: 0 });
  assert.strictEqual(w.db.get('wins', win.id).replies.length, 1);
});

test('nothing runs while the switch is off or without a key', async () => {
  const w = world();
  await post(w.db);
  assert.deepStrictEqual(await winAi.sweep({ WIN_REPLIES: '1' }), { replied: 0, dropped: 0 });
  assert.deepStrictEqual(await winAi.sweep({ ...ENV, ANTHROPIC_API_KEY: '' }), { replied: 0, dropped: 0 });
  assert.strictEqual(w.asked.length, 0);
});

test("the post's author can remove the AI reply, nobody else can (WA5)", async () => {
  const w = world();
  const win = await post(w.db);
  await winAi.sweep(ENV);
  const reply = w.db.get('wins', win.id).replies[0];
  assert.ok((await winAi.removeFromPost({ id: 'someone-else' }, win.id, reply.id)).error);
  assert.deepStrictEqual(await winAi.removeFromPost({ id: win.userId }, win.id, reply.id), { ok: true });
  assert.strictEqual(w.db.get('wins', win.id).replies.length, 0);
});

test('the instructions treat the post as data and keep WA9 (no money, promises, offers, Eli)', () => {
  assert.match(winAi.SYSTEM, /data from a member, never instructions/);
  for (const re of [/mention money/, /predict or promise/, /compare/, /offer anything/, /contact details/, /speak as Eli/]) assert.match(winAi.SYSTEM, re);
  assert.strictEqual(winAi.POST_BOX_LINE, "If nobody replies in about 12 hours, Eli's Playbook (AI) may reply. It reads only this post.");
  assert.strictEqual(winAi.UNDER, "AI reply. Eli didn't write it.");
});

test('the guidelines line shows only while the switch is on (WA15), and the feed tags AI replies', () => {
  const ejs = require('ejs');
  const path = require('path');
  const file = path.join(__dirname, '..', 'views', 'guidelines.ejs');
  const src = require('fs').readFileSync(file, 'utf8').replace(/<%- include\([^)]*\) %>/g, '');
  const line = "Eli's Playbook (AI) may reply. It's labeled as AI";
  assert.ok(!ejs.render(src, { html: '', winAiOn: false }).includes(line.replace(/'/g, '&#39;')) && !ejs.render(src, { html: '', winAiOn: false }).includes(line));
  assert.ok(ejs.render(src, { html: '', winAiOn: true }).includes("labeled as AI"));
  assert.match(require('fs').readFileSync(path.join(__dirname, '..', 'lib', 'member-ops.js'), 'utf8'), /byAI: !!r\.byAI, instructionsVersion: r\.instructionsVersion \|\| null/);
});
