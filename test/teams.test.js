// HQ in Teams (lib/harness/teams.js, teams-routes.js) to Legal L93 SL1 to SL7 and the Teams row: Teams' token
// check (Microsoft's keys, issuer, audience, dates, serviceUrl), the one-time link code, the personal chat only,
// one tap per card, void when the step changed, held and HQ-only steps without an OK button, the Activity log's
// "in Teams", uninstall deletes, the pulse with its footer once a day, and only Microsoft's hosts. No network:
// Microsoft is a fake fetch signing with a test RSA key; the engine, packs and nudges are stand-ins.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-teams-${process.pid}.json`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ADMIN_EMAILS', 'HQ_TEAMS', 'TEAMS_APP_ID', 'TEAMS_APP_SECRET']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const teams = require('../lib/harness/teams');
const teamsRoutes = require('../lib/harness/teams-routes');

const APP = '00000000-0000-4000-8000-000000000127';
const SU = 'https://smba.trafficmanager.net/amer/';
const TEN = 'tenant-1';
let now = Date.parse('2026-10-21T14:00:00Z');

// ---------- a fake Microsoft ----------
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', endorsements: ['msteams'] };
let calls = [];
let seqAct = 0;
async function fakeFetch(url, opts = {}) {
  calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body, headers: opts.headers || {} });
  const u = String(url);
  let out = {};
  if (u === 'https://login.botframework.com/v1/.well-known/openidconfiguration') out = { issuer: 'https://api.botframework.com', jwks_uri: 'https://login.botframework.com/v1/.well-known/keys' };
  else if (u === 'https://login.botframework.com/v1/.well-known/keys') out = { keys: [JWK] };
  else if (u.startsWith('https://login.microsoftonline.com/')) out = { token_type: 'Bearer', access_token: 'BOT-TOKEN', expires_in: 3600 };
  else if (/\/v3\/conversations\//.test(u)) out = { id: `act${++seqAct}` };
  return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
}
const sent = () => calls.filter((c) => /\/v3\/conversations\//.test(c.url)).map((c) => ({ ...c, json: JSON.parse(c.body) }));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(claims = {}, { key = privateKey, kid = 'k1', alg = 'RS256' } = {}) {
  const t = Math.floor(now / 1000);
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64({ iss: 'https://api.botframework.com', aud: APP, exp: t + 3600, nbf: t - 10, serviceurl: SU, ...claims });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `Bearer ${head}.${body}.${sig}`;
}

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
let pulseArgs = null;
const nudges = { sendable: (u, ch) => (ch === 'teams' ? can : { ok: false, why: 'off' }), pulse: async (user, o) => { pulseArgs = o; return pulseOut; } };

let seq = 0;
async function member(extra = {}) {
  seq += 1;
  return db.save('users', { id: `tu${seq}`, email: `t${seq}@127.test`, name: `Jo Rivera${seq}`, tier: 'builder', emailVerified: true, ...extra });
}
async function waiting(user, wf, spec) {
  const id = `run${runs.size + 1}`;
  runs.set(id, { id, memberId: user.id, title: 'Follow up with leads', workflowId: wf, steps: { ok: { status: 'waiting', spec } } });
  return db.save('inbox', { memberId: user.id, runId: id, stepId: 'ok', kind: 'approve', title: spec.title, status: 'open' });
}
// An activity from Teams. who: the Entra object id; personal chats by default.
function act(who, more = {}, { tenant = TEN, type = 'personal', conv = `a:chat-${who}` } = {}) {
  return { type: 'message', id: `m${Math.random()}`, channelId: 'msteams', serviceUrl: SU, from: { id: `29:${who}`, aadObjectId: who }, recipient: { id: `28:${APP}` }, conversation: { id: conv, conversationType: type, tenantId: tenant }, channelData: { tenant: { id: tenant } }, ...more };
}
const lastText = () => { const s = sent(); return s.length ? s[s.length - 1].json.text : null; };
async function linked(user, who = `aad-${user.id}`) {
  const code = await teams.newCode(user);
  await teams.handle(act(who, { text: `link ${code}` }));
  assert.match(lastText(), /Linked/);
  return who;
}
const actions = (a) => a.json.attachments[0].content.actions.map((x) => (x.type === 'Action.Submit' ? x.data.a : 'open'));

test.before(async () => {
  await db.init();
  teams._setDeps({ fetch: fakeFetch, now: () => now, engine: () => engine, packs: () => packs, nudges: () => nudges, posts: () => null });
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
  teams._reset();
  Object.assign(process.env, { HQ_LIVE: 'true', HQ_SECRET: 'teams-test-secret-'.padEnd(48, 'x'), TERMS_LIVE: 'true', PRIVACY_LIVE: 'true', ADMIN_EMAILS: 'boss@127.test', HQ_TEAMS: 'on', TEAMS_APP_ID: APP, TEAMS_APP_SECRET: 'tsecret' });
});

test('switch: off by default; needs 127\'s Azure Bot', async () => {
  const jo = await member();
  delete process.env.HQ_TEAMS;
  assert.equal(teams.on(jo), false);
  assert.equal(await teams.tick(), 0);
  process.env.HQ_TEAMS = 'admins';
  assert.equal(teams.on(jo), false);
  assert.equal(teams.on(await member({ email: 'boss@127.test' })), true);
  process.env.HQ_TEAMS = 'on';
  assert.equal(teams.on(jo), true);
  assert.equal(teams.status(jo).app, `https://teams.microsoft.com/l/app/${APP}`);
  delete process.env.TEAMS_APP_SECRET;
  assert.equal(teams.ready(), false);
  assert.equal(teams.status(jo).app, null);
});

test('SL1: Teams\' token check: Microsoft\'s key, issuer, audience, dates and serviceUrl', async () => {
  const a = act('x');
  assert.equal(await teams.verify(jwt(), a), true);
  assert.equal(calls.filter((c) => /openidconfiguration/.test(c.url)).length, 1);
  assert.equal(await teams.verify(jwt(), a), true);
  assert.equal(calls.filter((c) => /openidconfiguration/.test(c.url)).length, 1, 'keys cached');
  assert.equal(await teams.verify(jwt({ aud: 'someone-else' }), a), false, 'wrong audience');
  assert.equal(await teams.verify(jwt({ iss: 'https://sts.windows.net/x/' }), a), false, 'wrong issuer');
  assert.equal(await teams.verify(jwt({ exp: Math.floor(now / 1000) - 301 }), a), false, 'expired past the skew');
  assert.equal(await teams.verify(jwt({ exp: Math.floor(now / 1000) - 200 }), a), true, 'inside the 5 minute skew');
  assert.equal(await teams.verify(jwt({ nbf: Math.floor(now / 1000) + 400 }), a), false, 'not yet valid');
  assert.equal(await teams.verify(jwt({ serviceurl: 'https://smba.trafficmanager.net/emea/' }), a), false, 'serviceUrl mismatch');
  assert.equal(await teams.verify(jwt({}, { key: other.privateKey }), a), false, 'signed by another key');
  assert.equal(await teams.verify(jwt({}, { alg: 'HS256' }), a), false, 'only RS256');
  assert.equal(await teams.verify(jwt(), { ...a, channelId: 'webchat' }), false, 'key not endorsed for that channel');
  assert.equal(await teams.verify(jwt().replace('Bearer ', ''), a), false);
  calls = [];
  assert.equal(await teams.verify(jwt({}, { kid: 'k9' }), a), false, 'unknown key');
  now += 6 * 60 * 1000;
  assert.equal(await teams.verify(jwt({}, { kid: 'k9' }), a), false);
  assert.equal(calls.filter((c) => /openidconfiguration/.test(c.url)).length, 1, 'an unknown kid refetches, at most every 5 minutes');
});

test('the endpoint: 401 without a valid token, 200 with one', async () => {
  const app = express();
  app.use(teamsRoutes.hooks());
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}/teams/messages`;
  const post = (body, auth) => fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) } });
  try {
    const a = act('nobody', { text: 'help' });
    assert.equal((await post(a)).status, 401, 'no token');
    assert.equal((await post(a, jwt({ aud: 'x' }))).status, 401, 'wrong audience');
    assert.equal((await post(a, jwt({ iss: 'https://evil.example' }))).status, 401, 'wrong issuer');
    assert.equal((await post(a, jwt({ exp: Math.floor(now / 1000) - 600 }))).status, 401, 'expired');
    assert.equal((await post(a, jwt({ serviceurl: 'https://smba.trafficmanager.net/apac/' }))).status, 401, 'serviceUrl mismatch');
    assert.equal(sent().length, 0);
    assert.equal((await post(a, jwt())).status, 200);
    assert.match(lastText(), /isn't linked/);
    const inv = await post(act('nobody', { type: 'invoke', name: 'adaptiveCard/action', value: { action: { data: { hq: 'nope', a: 'ok' } } } }), jwt());
    assert.equal(inv.status, 200);
    assert.match((await inv.json()).value, /no longer active/);
    process.env.HQ_TEAMS = 'off';
    assert.equal((await post(a, jwt())).status, 401, 'off');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('SL1: the link code works once, for 10 minutes, and ties HQ to that tenant and person', async () => {
  const jo = await member();
  assert.deepEqual(teams.status(jo), { ready: true, app: `https://teams.microsoft.com/l/app/${APP}`, linked: false, cards: true, at: null });
  const code = await teams.newCode(jo);
  assert.doesNotMatch(JSON.stringify(db.get('hqTeams', jo.id)), new RegExp(code), 'only a hash of the code is kept');
  await teams.handle(act('JO', { text: `link ${code}` }, { tenant: '' }));
  assert.match(lastText(), /work or school/);
  now += 11 * 60 * 1000;
  await teams.handle(act('JO', { text: `link ${code}` }));
  assert.match(lastText(), /didn't work/, 'expired');
  const code2 = await teams.newCode(jo);
  await teams.handle(act('JO', { text: `<p>link ${code2}</p>` }));
  assert.match(lastText(), /Linked/);
  await teams.handle(act('JO2', { text: `link ${code2}` }));
  assert.match(lastText(), /didn't work/, 'once');
  const d = db.get('hqTeams', jo.id);
  assert.deepEqual([d.tenant, d.aadObjectId, d.teamsUser, d.serviceUrl, d.conversation], [TEN, 'JO', '29:JO', SU, 'a:chat-JO']);
  assert.equal(teams.status(jo).linked, true);

  const bo = await member();
  const c3 = await teams.newCode(bo);
  await teams.handle(act('JO', { text: `link ${c3}` }));
  assert.match(lastText(), /already linked to another HQ/);
  calls = [];
  await teams.handle(act('JO', { text: 'oks' }, { tenant: 'tenant-2' }));
  assert.match(lastText(), /isn't linked/, 'the same person id in another tenant is someone else');
});

test('SL5 and the Teams row: channels and group chats get one line when @mentioned, and nothing is kept', async () => {
  const jo = await member();
  const who = await linked(jo);
  calls = [];
  const before = JSON.stringify(db.get('hqTeams', jo.id));
  await teams.handle(act(who, { text: 'quarterly numbers are secret-words-123' }, { type: 'channel', conv: '19:chan@thread.tacv2' }));
  assert.equal(sent().length, 0, 'not @mentioned: no answer');
  const code = await teams.newCode(await member());
  await teams.handle(act(who, { id: 'root1', text: `<at>HQ</at> link ${code} secret-words-123`, entities: [{ type: 'mention', mentioned: { id: `28:${APP}` } }] }, { type: 'groupChat', conv: '19:group@thread.v2' }));
  const s = sent();
  assert.equal(s.length, 1);
  assert.match(s[0].url, /19%3Agroup%40thread\.v2\/activities\/root1$/, 'a reply in that thread');
  assert.match(s[0].json.text, /only works in your personal chat/);
  assert.ok(!db.filter('hqTeams', (x) => x.linked && x.conversation === '19:group@thread.v2').length, 'no link from a group chat');
  assert.equal(JSON.stringify(db.get('hqTeams', jo.id)), before);
  assert.doesNotMatch(fs.existsSync(process.env.DB_FILE) ? fs.readFileSync(process.env.DB_FILE, 'utf8') : '', /secret-words-123/);
  assert.doesNotMatch(JSON.stringify(db.filter('hqTeams', () => true)), /secret-words-123/);
});

test('cards: the personal chat only; an OK button only for a cleared step that isn\'t money and fits', async () => {
  const jo = await member();
  await linked(jo);
  calls = [];
  await waiting(jo, 'note', { title: 'Add these notes to HubSpot', act: true, note: 'Your CRM may run its own automations when this changes, like sending an email or text. Check them before you OK.', items: [{ key: '0', label: 'Ana at Bloom', text: 'Called, wants a **quote** Friday.' }] });
  await waiting(jo, 'refund', { title: 'Refund this order', act: true, items: [{ key: '0', label: 'Order 41', text: '$40' }] });
  await waiting(jo, 'held', { title: 'Add a note in Close', act: true, items: [{ key: '0', label: 'Lead', text: 'Hi' }] });
  await waiting(jo, 'note', { title: 'Pick the leads', options: [{ key: '0', label: 'Ana' }] });
  await waiting(jo, 'note', { title: 'Too many', act: true, items: Array.from({ length: 6 }, (_, i) => ({ key: String(i), label: `L${i}`, text: 'x' })) });
  const d = db.get('hqTeams', jo.id);
  assert.equal(await teams.sendCards(jo, d), 5);
  const msgs = sent();
  assert.ok(msgs.every((m) => m.method === 'POST' && m.url === `${SU}v3/conversations/a%3Achat-${d.aadObjectId}/activities`), 'the personal chat, never a channel');
  assert.ok(msgs.every((m) => m.headers.authorization === 'Bearer BOT-TOKEN'));
  assert.equal(calls.filter((c) => /microsoftonline/.test(c.url)).length, 0, 'the bot token from the link reply is reused');
  const card = msgs[0].json.attachments[0];
  assert.equal(card.contentType, 'application/vnd.microsoft.card.adaptive');
  assert.equal(card.content.version, '1.5');
  assert.deepEqual(actions(msgs[0]), ['ok', 'skip', 'open']);
  assert.equal(card.content.actions[0].title, 'OK');
  assert.match(JSON.stringify(card.content.body), /"type":"TextRun","text":"Called, wants a \*\*quote\*\* Friday\."/, 'the exact text, not markdown');
  assert.match(JSON.stringify(card.content.body), /automations/);
  assert.deepEqual(actions(msgs[1]), ['open'], 'money stays in HQ');
  assert.equal(msgs[1].json.attachments[0].content.actions[0].title, 'Open in HQ to OK');
  assert.match(JSON.stringify(msgs[1].json), /OK'd in HQ only/);
  assert.deepEqual(actions(msgs[2]), ['open'], 'held: no OK button anywhere');
  assert.match(JSON.stringify(msgs[2].json), /waiting on 127/);
  assert.deepEqual(actions(msgs[3]), ['open'], 'a choice is made in HQ');
  assert.deepEqual(actions(msgs[4]), ['open'], 'too many items to show');
  const rec = db.find('hqTeamsCards', (c) => c.memberId === jo.id && c.okable);
  assert.equal(rec.activityId, 'act' + (seqAct - 4));
  assert.equal(rec.until, now + 7 * 864e5);
  assert.equal(await teams.sendCards(jo, d), 0, 'one card per item');
  await teams.setCards(jo, false);
  await waiting(jo, 'note', { title: 'Another', act: true, items: [{ key: '0', label: 'A', text: 'a' }] });
  assert.equal(await teams.sendCards(jo, db.get('hqTeams', jo.id)), 0, 'cards off');
});

test('SL1, SL2, SL7: only the linked member, once, void if the step changed, and the card changes in place', async () => {
  const jo = await member();
  const who = await linked(jo);
  const item = await waiting(jo, 'note', { title: 'Add these notes', act: true, items: [{ key: '0', label: 'A', text: 'one' }, { key: '1', label: 'B', text: 'two' }] });
  await teams.sendCards(jo, db.get('hqTeams', jo.id));
  const card = db.find('hqTeamsCards', (c) => c.itemId === item.id);
  const tap = (from, a = 'ok', o) => teams.handle(act(from, { value: { hq: card.id, a } }, o));

  calls = [];
  await tap('SOMEONE');
  assert.match(lastText(), /Only Jo can OK this/);
  await tap(who, 'ok', { tenant: 'tenant-2' });
  assert.match(lastText(), /Only Jo can OK this/, 'same id, another tenant');
  assert.equal(answered.length, 0);
  calls = [];
  await tap(who);
  const put = sent()[0];
  assert.equal(put.method, 'PUT');
  assert.ok(put.url.endsWith(`/activities/${card.activityId}`), 'the card itself is replaced');
  assert.match(JSON.stringify(put.json), /OK'd:.*Add these notes/);
  assert.match(JSON.stringify(put.json), /In Teams, /);
  assert.deepEqual(answered[0].ans, { chosen: ['0', '1'] }, 'every item the card showed');
  assert.deepEqual(answered[0].opts, { who: 'you', via: 'Teams' });
  calls = [];
  await tap(who);
  assert.match(lastText(), /already used/);
  assert.equal(answered.length, 1);

  const item2 = await waiting(jo, 'note', { title: 'Add a note', act: true, items: [{ key: '0', label: 'A', text: 'one' }] });
  await teams.sendCards(jo, db.get('hqTeams', jo.id));
  const card2 = db.find('hqTeamsCards', (c) => c.itemId === item2.id);
  runs.get(item2.runId).steps.ok.spec.items[0].text = 'changed';
  calls = [];
  const out = await teams.handle(act(who, { type: 'invoke', name: 'adaptiveCard/action', value: { action: { type: 'Action.Submit', data: { hq: card2.id, a: 'ok' } } } }));
  assert.equal(out.status, 200);
  assert.match(JSON.stringify(sent()[0].json), /Something changed/);
  assert.equal(answered.length, 1);
  assert.equal(db.get('hqTeamsCards', card2.id).used, 'void');

  const item3 = await waiting(jo, 'note', { title: 'Skip me', act: true, items: [{ key: '0', label: 'A', text: 'one' }] });
  await teams.sendCards(jo, db.get('hqTeams', jo.id));
  const card3 = db.find('hqTeamsCards', (c) => c.itemId === item3.id);
  await teams.handle(act(who, { value: { hq: card3.id, a: 'skip' } }));
  assert.deepEqual(answered[1].ans, { approved: false });
  assert.deepEqual(answered[1].opts, { who: 'you', via: 'Teams' });
});

test('uninstall deletes what HQ keeps for that member; Remove in HQ deletes it too', async () => {
  const jo = await member();
  const who = await linked(jo);
  await waiting(jo, 'note', { title: 'A note', act: true, items: [{ key: '0', label: 'A', text: 'one' }] });
  await teams.sendCards(jo, db.get('hqTeams', jo.id));
  assert.ok(db.find('hqTeamsCards', (c) => c.memberId === jo.id));
  await teams.handle(act(who, { type: 'installationUpdate', action: 'remove' }));
  assert.equal(db.get('hqTeams', jo.id), null);
  assert.equal(db.find('hqTeamsCards', (c) => c.memberId === jo.id), null);

  const bo = await member();
  const bwho = await linked(bo);
  await teams.handle(act(bwho, { type: 'conversationUpdate', membersRemoved: [{ id: `28:${APP}` }] }));
  assert.equal(db.get('hqTeams', bo.id), null);

  const al = await member();
  await linked(al);
  calls = [];
  assert.equal(await teams.disconnect(al), true);
  assert.equal(db.get('hqTeams', al.id), null);
  assert.equal(calls.length, 0, 'a bot has no token to revoke');
  const ty = await member();
  await linked(ty);
  await require('../lib/harness/teams').forget(ty.id);
  assert.equal(db.get('hqTeams', ty.id), null);
});

test('install in a personal chat says how to link', async () => {
  await teams.handle(act('NEW', { type: 'conversationUpdate', membersAdded: [{ id: `28:${APP}` }] }));
  assert.match(lastText(), /get a link code/);
  calls = [];
  await teams.handle(act('NEW', { type: 'conversationUpdate', membersAdded: [{ id: `28:${APP}` }] }, { type: 'channel', conv: '19:c@thread' }));
  assert.equal(sent().length, 0, 'nothing posted in a team on install');
});

test('the pulse: only when the member turned Teams on, once a day, with its footer', async () => {
  const jo = await member();
  const who = await linked(jo);
  const d = db.get('hqTeams', jo.id);
  can = { ok: false, why: 'off' };
  assert.equal(await teams.sendPulse(jo, d), 'off');
  calls = [];
  await teams.handle(act(who, { text: 'pulse' }));
  assert.match(lastText(), /pulse in Teams is off/);
  can = { ok: true };
  pulseOut = { day: '2026-10-20', label: 'Tuesday', lines: [{ id: 'sent', text: '12 messages sent.' }], nextStep: { text: 'Follow up with 3 leads', href: '/app/hq/today' }, footer: { why: 'You get this because you turned on the morning pulse in Teams in HQ.', settings: '/app/hq/you#out', stop: '/app/hq/you#out' } };
  calls = [];
  assert.equal(await teams.sendPulse(jo, d), true);
  const m = sent()[0];
  assert.equal(m.url, `${SU}v3/conversations/a%3Achat-${who}/activities`);
  const s = JSON.stringify(m.json);
  assert.match(s, /turned on the morning pulse in Teams/);
  assert.match(s, /\[Stop these\]\(https:\/\/127\.test\/app\/hq\/you#out\)/);
  assert.match(s, /\[Settings\]/);
  assert.match(s, /12 messages sent\./);
  assert.equal(pulseArgs.channel, 'teams');
  assert.equal(pulseArgs.shared, false, 'never the shared version');
  assert.equal(await teams.sendPulse(jo, db.get('hqTeams', jo.id)), 'sent', 'once a day');
  calls = [];
  assert.ok((await teams.tick()) >= 0);
  assert.ok(!sent().some((x) => x.url.includes(`chat-${who}`) && /Tuesday/.test(x.body)), 'tick does not send it twice');
});

test('only Microsoft\'s hosts: a bad serviceUrl is refused before anything is sent', async () => {
  assert.equal(teams.serviceBase('https://smba.trafficmanager.net/amer'), 'https://smba.trafficmanager.net/amer/');
  assert.equal(teams.serviceBase('https://smba.infra.gcc.teams.microsoft.com/'), 'https://smba.infra.gcc.teams.microsoft.com/');
  assert.equal(teams.serviceBase('https://webchat.botframework.com/'), 'https://webchat.botframework.com/');
  for (const bad of ['https://evil.trafficmanager.net/', 'http://smba.trafficmanager.net/amer/', 'https://smba.trafficmanager.net.evil.com/', 'https://u:p@smba.trafficmanager.net/', 'https://smba.trafficmanager.net:8443/', 'https://botframework.com.evil.io/', 'https://127.0.0.1/', 'not a url']) {
    assert.throws(() => teams.serviceBase(bad), /isn't a Teams address/, bad);
  }
  const jo = await member();
  const code = await teams.newCode(jo);
  calls = [];
  await assert.rejects(teams.handle({ ...act('BAD', { text: `link ${code}` }), serviceUrl: 'https://evil.trafficmanager.net/' }), /isn't a Teams address/);
  assert.equal(calls.length, 0, 'nothing sent');
  assert.equal(teams.status(jo).linked, false);
});
