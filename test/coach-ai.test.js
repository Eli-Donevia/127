// AI rewrite of a coach kit (lib/coach-ai.js): a clean rewrite is used, a section with a claim, a new number or the
// wrong shape keeps its template, and the route stays shut while COACH_AI is off.
const path = require('path');
const os = require('os');
process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-coachai-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-coachai-${process.pid}`);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../lib/db');
const coachKit = require('../lib/coach-kit');
const coachAi = require('../lib/coach-ai');

const INPUT = { coach: 'Sam Ortiz', business: 'Ortiz Fit', story: 'I coach from my living room, before the kids wake up.' };
let reply = null, sent = null;
coachAi._test.setClient({ messages: { create: async (p) => { sent = p; return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply()) }], usage: {} }; } } });

function rewritten() {
  const k = coachKit.build(INPUT);
  const out = {};
  for (const s of coachAi.SECTIONS) out[s] = JSON.parse(JSON.stringify(k[s]));
  out.site.heroTitle = 'Strong at home, before the house wakes up.';
  return out;
}

test('a clean rewrite is used; claims, new numbers and broken shapes keep the template', async () => {
  reply = () => {
    const o = rewritten();
    o.ads[0].body = 'Clients lose 10 lbs in three weeks.'; // claim
    o.emails[0].subject = 'Only 6 spots left'; // a number the kit never had
    o.dms = o.dms.slice(1); // wrong shape
    o.vsl[0].beat = 'Opener'; // fixed label changed
    return o;
  };
  const r = await coachAi.rewrite(INPUT);
  const tpl = coachKit.build(INPUT);
  assert.equal(r.sections.site.heroTitle, 'Strong at home, before the house wakes up.');
  assert.deepEqual(r.kept, { ads: 'claim', emails: 'number', dms: 'shape', vsl: 'shape' });
  assert.deepEqual(r.sections.ads, tpl.ads);
  assert.deepEqual(r.used.sort(), ['consult', 'site']);
  assert.match(sent.messages[0].content, /living room/);
  assert.doesNotMatch(sent.messages[0].content, /@/); // no emails or client data in the prompt
});

test('unreadable replies keep the whole template; a claim in the answers is refused before any call', async () => {
  reply = () => 'nope';
  coachAi._test.setClient({ messages: { create: async () => ({ content: [{ type: 'text', text: 'Sorry, here you go: not json' }], usage: {} }) } });
  const r = await coachAi.rewrite(INPUT);
  assert.equal(r.used.length, 0);
  assert.equal((await coachAi.rewrite({ story: 'Guaranteed results.' })).error, 'claim');
});

test('the rewrite route is shut while COACH_AI is off, admins-only on admins', async () => {
  await db.init();
  const app = express();
  let me = null;
  app.use((req, res, next) => { req.user = me; next(); });
  app.response.render = function (view) { this.status(this.statusCode || 404).send(view); };
  require('../lib/coach-routes')(app, { requireAuth: (q, s, n) => (q.user ? n() : s.status(302).end()), isAdmin: (u) => !!u && u.id === 'admin1' });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = () => fetch(`${base}/coaches/kit/rewrite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(INPUT) });
  coachAi._test.setClient({ messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify(rewritten()) }], usage: {} }) } });
  try {
    delete process.env.COACH_AI;
    assert.equal((await post()).status, 401);
    me = { id: 'coach1' };
    assert.equal((await post()).status, 404);
    assert.equal((await (await fetch(`${base}/coaches/kit/ai`)).json()).on, false);
    process.env.COACH_AI = 'admins';
    assert.equal((await post()).status, 404);
    me = { id: 'admin1' };
    const r = await post();
    assert.equal(r.status, 200);
    assert.equal((await r.json()).sections.site.heroTitle, 'Strong at home, before the house wakes up.');
  } finally {
    delete process.env.COACH_AI;
    server.close();
  }
});
