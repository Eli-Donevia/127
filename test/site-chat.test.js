// Site chat (HQ_SITE_AGENT, lib/harness/site-chat.js) under Legal L76 row 4 (S1 to S11): off by default, the
// member's details and two ticks before it's on, the opening and the line under the box word for word, framed
// only by the member's site, answers only from public docs and details (never house rules or the profile),
// contact details to the Pipeline as "site chat", the under-13 parent line, and chats kept 180 days.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-sitechat-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-sitechat-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'HARNESS_AI', 'ADMIN_EMAILS', 'BRAIN_DOCS', 'HQ_SITE_AGENT', 'HQ_SITE_AGENT_CREDITS']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const harness = require('../lib/harness');
const harnessRoutes = require('../lib/harness/routes');
const siteChat = require('../lib/harness/site-chat');
const anthropic = require('../lib/harness/providers/anthropic');
const { plan } = require('../lib/plans');
const { docs, ledger, pipeline } = harness;

let flashes = [];
let seq = 0;
async function member(tier = 'builder', extra = {}) {
  seq += 1;
  return db.save('users', { id: `scu${seq}`, email: `sc${seq}@127.test`, name: `Ana Ruiz${seq}`, tier, emailVerified: true, answers: {}, ...extra });
}

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(require('../lib/security').headers(false));
  app.use(express.urlencoded({ extended: true }));
  app.use(require('../lib/harness/routes-site-chat').publicRouter());
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    req.session = {};
    Object.assign(res.locals, {
      user: req.user, userPlan: req.user ? plan(req.user.tier) : null, isAdmin: false, path: req.path, flash: null,
      builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
      launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
      fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
      plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null, hqLive: false,
    });
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const flash = (req, type, text) => flashes.push({ type, text });
  app.use(harnessRoutes({ requireAuth, flash, track: () => {}, isAdmin: () => false }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const x = app.listen(0, '127.0.0.1', () => r(x)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, headers = {} } = {}) => {
    const h = { ...headers };
    if (as) h['x-user'] = as.id;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    return fetch(url + p, { method: body !== undefined ? 'POST' : 'GET', headers: h, body, redirect: 'manual' });
  };
  return { go, url, close: () => new Promise((r) => srv.close(r)) };
}

let s;
test.before(async () => {
  await db.init();
  s = await server();
});
test.after(async () => {
  await s.close();
});
test.beforeEach(() => {
  flashes = [];
  process.env.HARNESS_V2 = 'on';
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
  for (const k of ['ADMIN_EMAILS', 'BRAIN_DOCS', 'HQ_SITE_AGENT', 'HQ_SITE_AGENT_CREDITS']) delete process.env[k];
});
process.on('exit', () => {
  try {
    fs.unlinkSync(process.env.DB_FILE);
  } catch {
    /* gone */
  }
});

const DETAILS = { name: 'Glow Mobile Detailing', hours: 'Mon to Sat 8am to 6pm', area: 'Des Moines', services: 'Interior and exterior details', prices: 'Full detail $180', site: 'https://glowdetail.com', privacy: 'https://glowdetail.com/privacy' };

async function onFor(u) {
  await siteChat.saveDetails(u, DETAILS);
  return siteChat.turnOn(u, { covered: true, notForKids: true });
}

function fakeAi(reply) {
  const seen = [];
  const fake = async (p) => {
    seen.push(p);
    return { content: [{ type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, model: p.model };
  };
  anthropic._setClient({ messages: { create: fake }, beta: { messages: { create: fake } } });
  return seen;
}

test('off by default: no HQ page, no chat, no /site-chat page', async () => {
  const u = await member();
  await onFor(u);
  const k = siteChat.settingsOf(u.id).key;
  assert.equal((await s.go('/app/hq/site-chat', { as: u })).status, 404);
  assert.equal((await s.go(`/site-chat/c/${k}`)).status, 404);
  assert.equal((await s.go('/site-chat')).status, 404);
  assert.equal((await s.go(`/site-chat/c/${k}/say`, { form: { text: 'hi' } })).status, 404);
  // "on" reaches members only while Terms and Privacy are live (lib/harness/flags.js).
  process.env.HQ_SITE_AGENT = 'on';
  process.env.PRIVACY_LIVE = 'false';
  assert.equal((await s.go(`/site-chat/c/${k}`)).status, 404);
  process.env.PRIVACY_LIVE = 'true';
  assert.equal((await s.go(`/site-chat/c/${k}`)).status, 200);
});

test('S10, S7, S11: details and both ticks before it turns on; the page says who is responsible', async () => {
  process.env.HQ_SITE_AGENT = 'on';
  const u = await member();
  let page = await (await s.go('/app/hq/site-chat', { as: u })).text();
  assert.match(page, /You&#39;re responsible for what your chat says, like anything on your site\./);
  assert.match(page, /Add your business&#39;s name, your site&#39;s address, your privacy page above first\./);
  await assert.rejects(siteChat.turnOn(u, { covered: true, notForKids: true }), /Add your business's name/);
  await assert.rejects(siteChat.saveDetails(u, { ...DETAILS, site: 'not a site' }), /doesn't look like a web address/);
  await s.go('/app/hq/site-chat/details', { as: u, form: DETAILS });
  page = await (await s.go('/app/hq/site-chat', { as: u })).text();
  assert.match(page, /My site&#39;s privacy notice covers this chat\./);
  assert.match(page, /My site isn't meant for children\./);
  await s.go('/app/hq/site-chat/on', { as: u, form: { kids: 'on' } });
  assert.match(flashes.at(-1).text, /Tick "My site's privacy notice covers this chat\." to turn it on\./);
  await s.go('/app/hq/site-chat/on', { as: u, form: { covered: 'on' } });
  assert.match(flashes.at(-1).text, /isn't meant for children/);
  assert.equal(siteChat.settingsOf(u.id).on, false);
  await s.go('/app/hq/site-chat/on', { as: u, form: { covered: 'on', kids: 'on' } });
  const st = siteChat.settingsOf(u.id);
  assert.equal(st.on, true);
  assert.match(st.key, /^[a-f0-9]{32}$/);
  page = await (await s.go('/app/hq/site-chat', { as: u })).text();
  assert.ok(page.includes(`data-chat=&#34;${st.key}&#34;`), 'the snippet carries the code');
  // A new code: the old one stops working.
  const oldKey = st.key;
  await s.go('/app/hq/site-chat/key', { as: u, form: {} });
  assert.equal(siteChat.byKey(oldKey), null);
  assert.ok(siteChat.byKey(siteChat.settingsOf(u.id).key));
  await s.go('/app/hq/site-chat/off', { as: u, form: {} });
  assert.equal(siteChat.byKey(siteChat.settingsOf(u.id).key), null);
});

test("S2, S8: the opening before the visitor types, the line under the box, framed only by the member's site", async () => {
  process.env.HQ_SITE_AGENT = 'on';
  const u = await member();
  const st = await onFor(u);
  const res = await s.go(`/site-chat/c/${st.key}?page=${encodeURIComponent('https://glowdetail.com/prices?email=a@b.c#x')}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-frame-options'), null);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors https:\/\/glowdetail\.com https:\/\/www\.glowdetail\.com$/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const html = await res.text();
  assert.ok(html.includes("Hi! I&#39;m Glow Mobile Detailing&#39;s AI assistant. I answer from Glow Mobile Detailing&#39;s own info and can get things wrong, so check anything important with them. This chat is saved for Glow Mobile Detailing, and 127 runs it for them with Anthropic&#39;s AI. Please don&#39;t share card numbers or health details here."));
  assert.ok(html.indexOf('AI assistant') < html.indexOf('<textarea'), 'the opening comes before the box');
  assert.match(html, /AI assistant · Saved for Glow Mobile Detailing · <a href="\/site-chat"[^>]*>Run by 127<\/a> · <a href="https:\/\/glowdetail\.com\/privacy"[^>]*>Privacy<\/a>/);
  assert.match(html, /data-page="https:\/\/glowdetail\.com\/prices"/, 'only the page address, no query');
  assert.doesNotMatch(html, /plausible|googletagmanager|fonts\.googleapis/);
  const about = await (await s.go('/site-chat')).text();
  assert.match(about, /127 runs it for the business as their service provider/);
  assert.match(about, /href="\/privacy#7c-your-brain-ask-127-ai-team-site-chat-and-studio"/);
  // A post from another site is refused.
  assert.equal((await s.go(`/site-chat/c/${st.key}/say`, { form: { text: 'hi' }, headers: { origin: 'https://evil.test' } })).status, 404);
});

test('S3, S4: it answers only from public docs and details, never house rules, the profile or private docs', async () => {
  process.env.HQ_SITE_AGENT = 'on';
  process.env.BRAIN_DOCS = 'on';
  const u = await member();
  await harness.brain.update(u, { business: { name: 'Glow', what: 'SECRET-PROFILE detailing' } });
  await docs.save(u.id, { title: 'Prices', body: 'Ceramic coating is $600 and takes a full day.', public: true, source: 'paste' });
  await docs.save(u.id, { title: 'Margins', body: 'Ceramic coating costs us PRIVATE-COST 220.', public: false, source: 'paste' });
  await docs.setRules(u.id, { principles: 'HOUSE-RULE never discount.' });
  const st = await onFor(u);
  const seen = fakeAi({ answer: 'Ceramic coating is $600 and takes a full day.', passOn: false });
  const left = ledger.left(u);
  let out;
  try {
    out = await siteChat.say(st.key, { text: 'How much is ceramic coating? My card is 4242 4242 4242 4242', page: 'https://glowdetail.com/' });
  } finally {
    anthropic._setClient(null);
  }
  assert.equal(out.answer, 'Ceramic coating is $600 and takes a full day.');
  const sys = seen[0].system.map((b) => b.text).join('\n');
  const prompt = seen[0].messages[0].content.at(-1).text;
  assert.match(sys, /Answer only from the business's facts and the passages below/);
  assert.match(prompt, /Business: Glow Mobile Detailing/);
  assert.match(prompt, /Listed prices: Full detail \$180/);
  assert.match(prompt, /Ceramic coating is \$600/);
  for (const secret of [/PRIVATE-COST/, /HOUSE-RULE/, /SECRET-PROFILE/, /4242 4242 4242 4242/]) assert.doesNotMatch(sys + prompt, secret);
  assert.match(prompt, /\[card ending 4242\]/);
  assert.equal(ledger.left(u), left - siteChat.cost());
  const c = siteChat.get(u, out.chatId);
  assert.equal(c.messages[0].text, 'How much is ceramic coating? My card is [card ending 4242]');
  assert.equal(c.page, 'https://glowdetail.com/');
});

test('with no AI key or no credits it offers to pass the question on, at no charge', async () => {
  process.env.HQ_SITE_AGENT = 'on';
  const u = await member();
  const st = await onFor(u);
  const left = ledger.left(u);
  const out = await siteChat.say(st.key, { text: 'Do you do boats?' });
  assert.equal(out.answer, "I can't answer that from Glow Mobile Detailing's info. Leave your details and Glow Mobile Detailing can get back to you.");
  assert.equal(out.passOn, true);
  assert.equal(out.contactOk, true);
  assert.equal(ledger.left(u), left);
  process.env.HQ_SITE_AGENT_CREDITS = String(left + 1);
  const seen = fakeAi({ answer: 'x', passOn: false });
  try {
    assert.equal((await siteChat.say(st.key, { chatId: out.chatId, text: 'And trucks?' })).passOn, true);
  } finally {
    anthropic._setClient(null);
  }
  assert.equal(seen.length, 0, 'no AI call without the credits');
});

test('S5: contact details become a Pipeline lead marked site chat, with the line the visitor sees', async () => {
  process.env.HQ_SITE_AGENT = 'on';
  const u = await member();
  const st = await onFor(u);
  const { chatId } = await siteChat.say(st.key, { text: 'Can I book Friday?' });
  await assert.rejects(siteChat.leaveContact(st.key, { chatId, name: 'Jo' }), /Add an email or a phone number/);
  await assert.rejects(siteChat.leaveContact(st.key, { chatId, email: 'nope' }), /doesn't look right/);
  const res = await s.go(`/site-chat/c/${st.key}/contact`, { form: { chat: chatId, name: 'Jo Park', email: 'jo@example.com' } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).line, 'Glow Mobile Detailing gets your message and these details so they can reply.');
  const lead = pipeline.list(u.id).find((l) => l.source === 'site chat');
  assert.equal(lead.name, 'Jo Park');
  assert.match(lead.note, /Asked: Can I book Friday\?/);
  const page = await (await s.go('/app/hq/site-chat', { as: u })).text();
  assert.match(page, /Left details/);
  const one = await (await s.go(`/app/hq/site-chat/chats/${chatId}`, { as: u })).text();
  assert.match(one, /jo@example\.com/);
  assert.match(one, /That isn't a yes to marketing/);
  // Another member can't see it.
  assert.equal((await s.go(`/app/hq/site-chat/chats/${chatId}`, { as: await member() })).status, 404);
});

test('S7: a visitor under 13 gets the parent line, and the chat takes no details', async () => {
  process.env.HQ_SITE_AGENT = 'on';
  const u = await member();
  const st = await onFor(u);
  const first = await siteChat.say(st.key, { text: 'How much for a car wash?' });
  await siteChat.leaveContact(st.key, { chatId: first.chatId, email: 'kid@example.com' });
  assert.equal(pipeline.list(u.id).filter((l) => l.source === 'site chat').length, 1);
  const out = await siteChat.say(st.key, { chatId: first.chatId, text: "i'm 11 and want to surprise my dad" });
  assert.equal(out.answer, 'Thanks for asking! Please have a parent or guardian contact Glow Mobile Detailing directly.');
  assert.equal(out.contactOk, false);
  assert.equal(out.passOn, false);
  const c = siteChat.get(u, first.chatId);
  assert.equal(c.child, true);
  assert.equal(c.contact, null);
  assert.equal(pipeline.list(u.id).filter((l) => l.source === 'site chat').length, 0, 'details already left are dropped');
  await assert.rejects(siteChat.leaveContact(st.key, { chatId: first.chatId, email: 'kid@example.com' }), /parent or guardian/);
  assert.equal(siteChat.saysUnder13("I'm 15"), false);
  assert.equal(siteChat.saysUnder13('I am under 13'), true);
});

test('S6: chats go 180 days after the last message, the member deletes one sooner, and account deletion takes all', async () => {
  process.env.HQ_SITE_AGENT = 'on';
  const u = await member();
  const st = await onFor(u);
  const a = await siteChat.say(st.key, { text: 'Old question' });
  const b = await siteChat.say(st.key, { text: 'New question' });
  const old = db.get('siteChats', a.chatId);
  old.lastAt = new Date(Date.now() - 181 * 864e5).toISOString();
  await db.save('siteChats', old);
  assert.equal(await siteChat.purge(), 1);
  assert.equal(siteChat.get(u, a.chatId), null);
  assert.ok(siteChat.get(u, b.chatId));
  await s.go(`/app/hq/site-chat/chats/${b.chatId}/delete`, { as: u, form: {} });
  assert.equal(siteChat.get(u, b.chatId), null);
  const c = await siteChat.say(st.key, { text: 'Another' });
  await harness.forget(u.id);
  assert.equal(db.get('siteChats', c.chatId), null);
  assert.equal(db.get('siteChatSettings', u.id), null);
});

test('a long chat stops at 30 visitor messages and points to the business', async () => {
  process.env.HQ_SITE_AGENT = 'on';
  const u = await member();
  const st = await onFor(u);
  let chatId;
  for (let i = 0; i < siteChat.MAX_VISITOR_MESSAGES; i++) chatId = (await siteChat.say(st.key, { chatId, text: `Q${i}` })).chatId;
  const out = await siteChat.say(st.key, { chatId, text: 'one more' });
  assert.equal(out.done, true);
  assert.match(out.answer, /Please contact Glow Mobile Detailing directly/);
});
