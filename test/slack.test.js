// HQ in Slack (lib/harness/slack.js, slack-routes.js) to Legal L93 SL1 to SL7: signed requests only, the
// one-time link code, cards only in the member's DM, one tap per card, void when the step changed, held and
// HQ-only steps without an OK button, the Activity log's "in Slack", uninstall deletes, and the pulse with its
// footer once a day. No network: Slack is a fake fetch; the engine, packs and nudges are stand-ins.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-slack-${process.pid}.json`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ADMIN_EMAILS', 'HQ_SLACK', 'OAUTH_SLACK_ID', 'OAUTH_SLACK_SECRET', 'SLACK_SIGNING_SECRET']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const hq = require('../lib/hq');
const slack = require('../lib/harness/slack');
const slackRoutes = require('../lib/harness/slack-routes');

const SECRET = 'signing-secret-for-tests';
let now = Date.parse('2026-10-21T14:00:00Z');

// ---------- a fake Slack ----------
let calls = [];
async function fakeFetch(url, opts = {}) {
  calls.push({ url, body: opts.body, headers: opts.headers || {} });
  const m = String(url).replace('https://slack.com/api/', '');
  const out = { 'oauth.v2.access': { ok: true, access_token: 'xoxb-BOT', bot_user_id: 'UBOT', team: { id: 'T1', name: 'North Loop' } }, 'conversations.open': { ok: true, channel: { id: 'D1' } }, 'chat.postMessage': { ok: true, ts: '1.2' }, 'auth.revoke': { ok: true } }[m] || { ok: true };
  return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
}
const posted = () => calls.filter((c) => /chat\.postMessage/.test(c.url)).map((c) => JSON.parse(c.body));

// ---------- stand-ins for the engine, packs and nudges ----------
const runs = new Map();
const answered = [];
const TOOLS = { 'crm.note': { risk: 'act', needs: ['hubspot'] }, 'pay.refund': { risk: 'act', needs: ['stripe'] }, 'crm.held': { risk: 'act', needs: ['close'] } };
const CLEARED = new Set(['crm.note', 'pay.refund']);
const engine = {
  get: (user, id) => { const r = runs.get(id); return r && r.memberId === user.id ? r : null; },
  actCleared: (n) => CLEARED.has(n),
  answer: async (user, runId, stepId, ans, opts) => { answered.push({ runId, stepId, ans, opts }); runs.get(runId).steps[stepId].status = 'done'; },
};
const WF = { note: { steps: [{ id: 'ok', approve: {} }, { id: 'w', tool: 'crm.note', approvedBy: 'ok' }] }, refund: { steps: [{ id: 'ok', approve: {} }, { id: 'w', tool: 'pay.refund', approvedBy: 'ok' }] }, held: { steps: [{ id: 'ok', approve: {} }, { id: 'w', tool: 'crm.held', approvedBy: 'ok' }] } };
const packs = { tool: (n) => TOOLS[n] || null, workflow: (id) => WF[id] || null };
let pulseOut = null;
let can = { ok: true };
const nudges = { sendable: () => can, pulse: async (user, o) => (pulseOut ? { ...pulseOut, args: o } : null) };

let seq = 0;
async function member(extra = {}) {
  seq += 1;
  return db.save('users', { id: `su${seq}`, email: `s${seq}@127.test`, name: `Jo Rivera${seq}`, tier: 'builder', emailVerified: true, ...extra });
}
async function waiting(user, wf, spec) {
  const id = `run${runs.size + 1}`;
  runs.set(id, { id, memberId: user.id, title: 'Follow up with leads', workflowId: wf, steps: { ok: { status: 'waiting', spec } } });
  return db.save('inbox', { memberId: user.id, runId: id, stepId: 'ok', kind: 'approve', title: spec.title, status: 'open' });
}
function sign(body, ts = Math.floor(now / 1000)) {
  return { 'x-slack-request-timestamp': String(ts), 'x-slack-signature': `v0=${crypto.createHmac('sha256', SECRET).update(`v0:${ts}:${body}`).digest('hex')}` };
}
async function linked(user) {
  const go = slack.installUrl(user, 'https://127.test');
  assert.equal((await slack.finishInstall(user, go.pending, { code: 'c', state: go.pending.state }, 'https://127.test')).ok, true);
  const code = await slack.newCode(user);
  const who = `U${user.id}`;
  assert.match(await slack.command({ team_id: 'T1', user_id: who, text: `link ${code}` }), /Linked/);
  return who;
}

test.before(async () => {
  await db.init();
  slack._setDeps({ fetch: fakeFetch, now: () => now, engine: () => engine, packs: () => packs, nudges: () => nudges, posts: () => null });
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
});
test.beforeEach(() => {
  calls = [];
  answered.length = 0;
  pulseOut = null;
  can = { ok: true };
  Object.assign(process.env, { HQ_LIVE: 'true', HQ_SECRET: 'slack-test-secret-'.padEnd(48, 'x'), TERMS_LIVE: 'true', PRIVACY_LIVE: 'true', ADMIN_EMAILS: 'boss@127.test', HQ_SLACK: 'on', OAUTH_SLACK_ID: 'sid', OAUTH_SLACK_SECRET: 'ssecret', SLACK_SIGNING_SECRET: SECRET });
});

test('switch: off by default; needs 127\'s Slack app', async () => {
  const jo = await member();
  delete process.env.HQ_SLACK;
  assert.equal(slack.on(jo), false);
  process.env.HQ_SLACK = 'admins';
  assert.equal(slack.on(jo), false);
  assert.equal(slack.on(await member({ email: 'boss@127.test' })), true);
  process.env.HQ_SLACK = 'on';
  assert.equal(slack.on(jo), true);
  delete process.env.SLACK_SIGNING_SECRET;
  assert.equal(slack.installUrl(jo, 'https://127.test'), null);
});

test('SL1: signatures checked with a fresh timestamp', () => {
  const body = 'command=%2F127&text=help';
  assert.equal(slack.verify(Buffer.from(body), sign(body)), true);
  assert.equal(slack.verify(Buffer.from(body + 'x'), sign(body)), false, 'body changed');
  assert.equal(slack.verify(Buffer.from(body), sign(body, Math.floor(now / 1000) - 301)), false, 'over 5 minutes old');
  assert.equal(slack.verify(Buffer.from(body), { 'x-slack-request-timestamp': String(Math.floor(now / 1000)), 'x-slack-signature': 'v0=00' }), false);
});

test('SL1: install keeps the bot token encrypted; the link code works once, in that workspace, for 10 minutes', async () => {
  const jo = await member();
  const go = slack.installUrl(jo, 'https://127.test');
  assert.match(go.url, /scope=chat%3Awrite%2Ccommands%2Cim%3Awrite/);
  assert.match((await slack.finishInstall(jo, go.pending, { code: 'c', state: 'nope' }, 'https://127.test')).error, /didn't match/);
  assert.equal((await slack.finishInstall(jo, go.pending, { code: 'c', state: go.pending.state }, 'https://127.test')).ok, true);
  assert.doesNotMatch(JSON.stringify(db.get('hqSlack', jo.id)), /xoxb-BOT/);
  assert.deepEqual(slack.status(jo), { added: true, ready: true, team: 'North Loop', linked: false, cards: true, at: db.get('hqSlack', jo.id).at });

  assert.match(await slack.command({ team_id: 'T1', user_id: 'UJO', text: 'oks' }), /isn't linked/);
  const code = await slack.newCode(jo);
  assert.match(await slack.command({ team_id: 'T2', user_id: 'UJO', text: `link ${code}` }), /didn't work/, 'another workspace');
  now += 11 * 60 * 1000;
  assert.match(await slack.command({ team_id: 'T1', user_id: 'UJO', text: `link ${code}` }), /didn't work/, 'expired');
  const code2 = await slack.newCode(jo);
  assert.match(await slack.command({ team_id: 'T1', user_id: 'UJO', text: `link ${code2}` }), /Linked/);
  assert.match(await slack.command({ team_id: 'T1', user_id: 'UJO', text: `link ${code2}` }), /didn't work/, 'once');
  assert.equal(slack.status(jo).linked, true);
});

test('cards: DMs only; an OK button only for a cleared step that isn\'t money and fits', async () => {
  const jo = await member();
  await linked(jo);
  calls = [];
  await waiting(jo, 'note', { title: 'Add these notes to HubSpot', act: true, note: 'Your CRM may run its own automations when this changes, like sending an email or text. Check them before you OK.', items: [{ key: '0', label: 'Ana at Bloom', text: 'Called, wants a quote Friday.' }] });
  await waiting(jo, 'refund', { title: 'Refund this order', act: true, items: [{ key: '0', label: 'Order 41', text: '$40' }] });
  await waiting(jo, 'held', { title: 'Add a note in Close', act: true, items: [{ key: '0', label: 'Lead', text: 'Hi' }] });
  await waiting(jo, 'note', { title: 'Pick the leads', options: [{ key: '0', label: 'Ana' }] });
  const d = db.get('hqSlack', jo.id);
  assert.equal(await slack.sendCards(jo, d), 4);
  const msgs = posted();
  assert.ok(msgs.every((m) => m.channel === 'D1'), 'the DM with HQ, never a channel');
  const buttons = (m) => m.blocks.filter((b) => b.type === 'actions').flatMap((b) => b.elements.map((e) => e.action_id));
  assert.deepEqual(buttons(msgs[0]), ['ok', 'skip', 'open']);
  assert.match(JSON.stringify(msgs[0].blocks), /Called, wants a quote Friday/, 'the exact text');
  assert.match(JSON.stringify(msgs[0].blocks), /automations/);
  assert.deepEqual(buttons(msgs[1]), ['open'], 'money stays in HQ');
  assert.match(JSON.stringify(msgs[1].blocks), /OK'd in HQ only/);
  assert.deepEqual(buttons(msgs[2]), ['open'], 'held: no OK button anywhere');
  assert.deepEqual(buttons(msgs[3]), ['open'], 'a choice is made in HQ');
  assert.equal(await slack.sendCards(jo, d), 0, 'one card per item');
});

test('SL1, SL2, SL7: only the linked member, once, and void if the step changed', async () => {
  const jo = await member();
  const who = await linked(jo);
  const item = await waiting(jo, 'note', { title: 'Add these notes', act: true, items: [{ key: '0', label: 'A', text: 'one' }, { key: '1', label: 'B', text: 'two' }] });
  await slack.sendCards(jo, db.get('hqSlack', jo.id));
  const card = db.find('hqSlackCards', (c) => c.itemId === item.id);
  const tap = (user, id = 'ok') => slack.action({ team: { id: 'T1' }, user: { id: user }, actions: [{ action_id: id, value: card.id }] });

  assert.match((await tap('UADMIN')).ephemeral, /Only Jo can OK this/);
  const out = await tap(who);
  assert.match(JSON.stringify(out.replace), /OK'd/);
  assert.deepEqual(answered[0].ans, { chosen: ['0', '1'] }, 'every item the card showed');
  assert.deepEqual(answered[0].opts, { who: 'you', via: 'Slack' });
  assert.match((await tap(who)).ephemeral, /already used/);

  const item2 = await waiting(jo, 'note', { title: 'Add a note', act: true, items: [{ key: '0', label: 'A', text: 'one' }] });
  await slack.sendCards(jo, db.get('hqSlack', jo.id));
  const card2 = db.find('hqSlackCards', (c) => c.itemId === item2.id);
  runs.get(item2.runId).steps.ok.spec.items[0].text = 'changed';
  const out2 = await slack.action({ team: { id: 'T1' }, user: { id: who }, actions: [{ action_id: 'ok', value: card2.id }] });
  assert.match(JSON.stringify(out2.replace), /Something changed/);
  assert.equal(answered.length, 1);
});

test('the pulse: only when the member turned Slack on, once a day, with its footer', async () => {
  const jo = await member();
  await linked(jo);
  const d = db.get('hqSlack', jo.id);
  can = { ok: false, why: 'off' };
  assert.equal(await slack.sendPulse(jo, d), 'off');
  can = { ok: true };
  pulseOut = { day: '2026-10-20', label: 'Tuesday', lines: [{ id: 'sent', text: '12 messages sent.' }], nextStep: null, footer: { why: 'You get this because you turned on the morning pulse in Slack in HQ.', settings: '/app/hq/you#out', stop: '/app/hq/you#out' } };
  calls = [];
  assert.equal(await slack.sendPulse(jo, d), true);
  const m = posted()[0];
  assert.equal(m.channel, 'D1');
  assert.match(JSON.stringify(m.blocks), /turned on the morning pulse in Slack/);
  assert.match(JSON.stringify(m.blocks), /Stop these/);
  assert.equal(await slack.sendPulse(jo, d), 'sent', 'once a day');
});

test('uninstall deletes what HQ keeps for that workspace; remove revokes the token', async () => {
  const jo = await member();
  await linked(jo);
  assert.deepEqual(await slack.events({ type: 'url_verification', challenge: 'abc' }), { challenge: 'abc' });
  await slack.events({ type: 'event_callback', team_id: 'T1', event: { type: 'app_uninstalled' } });
  assert.equal(db.get('hqSlack', jo.id), null);
  const bo = await member();
  await linked(bo);
  calls = [];
  assert.equal(await slack.disconnect(bo), true);
  assert.ok(calls.some((c) => /auth\.revoke/.test(c.url) && c.headers.authorization === 'Bearer xoxb-BOT'));
  assert.equal(db.get('hqSlack', bo.id), null);
});

test('the webhook: signed slash commands answer only the person who typed them', async () => {
  const app = express();
  app.use(slackRoutes.hooks());
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  try {
    const body = new URLSearchParams({ team_id: 'T9', user_id: 'U9', text: 'help' }).toString();
    let r = await fetch(`${url}/slack/commands`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(r.status, 401);
    // The real clock: the route checks against Date.now through slack's deps.
    slack._setDeps({ now: () => Date.now() });
    r = await fetch(`${url}/slack/commands`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', ...sign(body, Math.floor(Date.now() / 1000)) } });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.response_type, 'ephemeral');
    assert.match(j.text, /isn't linked/);
  } finally {
    slack._setDeps({ now: () => now });
    await new Promise((r) => srv.close(r));
  }
});
