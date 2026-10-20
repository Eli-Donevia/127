// HQ v2's workspace pieces, each behind its own flag (lib/harness/flags.js): Brain docs, search,
// house rules, decisions, numbers, Obsidian and Notion import and export (BRAIN_DOCS); the Activity
// log (HQ_ACTIVITY); held packs (PACKS_ON). No network: no AI key, so AI calls give sample answers.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-ws-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-ws-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
process.env.HARNESS_STRICT = 'on';
for (const k of ['ANTHROPIC_API_KEY', 'HARNESS_PAUSE', 'HARNESS_AI', 'HARNESS_FREE_RUN', 'ADMIN_EMAILS', 'PACKS_ON', 'BRAIN_DOCS', 'HQ_ACTIVITY', 'HQ_AGENT', 'HQ_SKILLS', 'HQ_MCP_BRAIN', 'HQ_TEAM', 'HQ_PROMPTS', 'HQ_SITE_AGENT']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const harness = require('../lib/harness');
const harnessRoutes = require('../lib/harness/routes');
const { plan } = require('../lib/plans');
const { makeZip, readZip } = require('../lib/harness/zipfile');
const extract = require('../lib/harness/extract');
const llm = require('../lib/harness/llm');
const anthropic = require('../lib/harness/providers/anthropic');
const { engine, packs, docs, activity, brain } = harness;
const hqPack = require('../lib/packs/hq');

let flashes = [];
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });

const WS = {
  id: 'ws',
  title: 'Workspace tests',
  version: '1.0.0',
  summary: 'Things for workspace tests.',
  niches: ['any'],
  tools: [
    {
      name: 'ws.look',
      title: 'Look it up',
      description: 'Searches the Brain.',
      kind: 'code',
      risk: 'read',
      credits: 1,
      input: obj({ q: { type: 'string' } }),
      output: obj({ hits: { type: 'array', items: { type: 'object' } } }),
      run: async ({ q }, ctx) => ({ hits: ctx.brain.search(q) }),
    },
  ],
  workflows: [
    {
      id: 'ws.look',
      title: 'Look in my Brain',
      promise: 'Finds what your Brain says.',
      minutes: 1,
      tier: 'free',
      job: 'ops',
      inputs: obj({ q: { type: 'string', title: 'What to look for' } }),
      steps: [{ id: 'look', tool: 'ws.look', input: { q: '$inputs.q' } }],
      result: ['look'],
    },
  ],
};

let seq = 0;
async function member(tier = 'builder', extra = {}) {
  seq += 1;
  return db.save('users', { id: `wsu${seq}`, email: `ws${seq}@127.test`, name: `Ana Ruiz${seq}`, tier, emailVerified: true, answers: {}, ...extra });
}

function locals(user, req) {
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: false, path: req.path, flash: null,
    builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
    launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
    fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null,
    hqLive: harness.enabledFor(user),
  };
}

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    req.session = {};
    Object.assign(res.locals, locals(req.user, req));
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
  const go = (p, { as, form, json, raw, headers = {}, method } = {}) => {
    const h = { ...headers };
    if (as) h['x-user'] = as.id;
    let body = raw;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    if (json !== undefined) { body = JSON.stringify(json); h['content-type'] = 'application/json'; h.accept = 'application/json'; }
    return fetch(url + p, { method: method || (body !== undefined ? 'POST' : 'GET'), headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

let s;
test.before(async () => {
  await db.init();
  packs.reset();
  const r = packs.registerAll([{ pack: WS, source: 'test' }, { pack: hqPack, source: 'hq' }]);
  assert.deepEqual(r.refused, [], JSON.stringify(r.refused));
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
  for (const k of ['ADMIN_EMAILS', 'PACKS_ON', 'BRAIN_DOCS', 'HQ_ACTIVITY', 'HQ_AGENT', 'HQ_SKILLS', 'HQ_MCP_BRAIN', 'HQ_TEAM', 'HQ_PROMPTS', 'HQ_SITE_AGENT']) delete process.env[k];
});
process.on('exit', () => {
  try {
    fs.unlinkSync(process.env.DB_FILE);
  } catch {
    /* gone */
  }
});

// ---------- flags ----------
test('every workspace page is off by default, admins-only when set to admins', async () => {
  const u = await member();
  for (const p of ['/app/hq/activity', '/app/hq/brain/export', '/app/hq/brain/docs/nope']) assert.equal((await s.go(p, { as: u })).status, 404, p);
  const page = await (await s.go('/app/hq/brain', { as: u })).text();
  assert.doesNotMatch(page, /House rules/);
  assert.doesNotMatch(page, /href="\/app\/hq\/activity"/);
  process.env.HQ_ACTIVITY = 'admins';
  assert.equal((await s.go('/app/hq/activity', { as: u })).status, 404);
  process.env.ADMIN_EMAILS = u.email;
  assert.equal((await s.go('/app/hq/activity', { as: u })).status, 200);
  assert.match(await (await s.go('/app/hq/brain', { as: u })).text(), /href="\/app\/hq\/activity"/);
  // "on" reaches members only while the Terms and Privacy pages are live; until then it's admins only.
  process.env.HQ_ACTIVITY = 'on';
  process.env.ADMIN_EMAILS = '';
  process.env.PRIVACY_LIVE = 'false';
  assert.equal(harness.flags.on('HQ_ACTIVITY', u), false);
  process.env.ADMIN_EMAILS = u.email;
  assert.equal(harness.flags.on('HQ_ACTIVITY', u), true);
  process.env.PRIVACY_LIVE = 'true';
  process.env.ADMIN_EMAILS = '';
  assert.equal(harness.flags.on('HQ_ACTIVITY', u), true);
});

// ---------- held packs ----------
test('a held pack is checked but loads only when PACKS_ON names it', () => {
  const held = { ...WS, id: 'wsheld', held: true, tools: [{ ...WS.tools[0], name: 'wsheld.look' }], workflows: [{ ...WS.workflows[0], id: 'wsheld.look', steps: [{ id: 'look', tool: 'wsheld.look', input: { q: '$inputs.q' } }] }] };
  const r1 = packs.register(held);
  assert.deepEqual(r1, { loaded: [], refused: [] });
  assert.equal(packs.workflow('wsheld.look'), null);
  assert.ok(packs.registry.held.some((h) => h.id === 'wsheld'));
  process.env.PACKS_ON = 'other, wsheld';
  assert.deepEqual(packs.register(held).loaded, ['wsheld']);
  assert.ok(packs.workflow('wsheld.look'));
  assert.match(packs.register({ ...held, id: 'wsbad', held: 'yes', tools: [{ ...WS.tools[0], name: 'wsbad.look' }], workflows: [] }).refused[0].problems.join(), /held must be true or false/);
});

// ---------- zips and text ----------
test('zip files round-trip, and Word and PDF give their text', () => {
  const z = makeZip([{ name: 'a/b.md', data: 'hello' }, { name: 'c.txt', data: Buffer.from('x'.repeat(5000)) }]);
  const back = readZip(z);
  assert.deepEqual(back.map((f) => f.name), ['a/b.md', 'c.txt']);
  assert.equal(back[1].data.length, 5000);
  assert.throws(() => readZip(Buffer.from('nope, not a zip at all')), /isn't a zip/);
  assert.throws(() => readZip(z, { maxFiles: 1 }), /more than 1 files/);
  const docx = makeZip([{ name: 'word/document.xml', data: '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Onboarding</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Call the client </w:t></w:r><w:r><w:t>&amp; confirm.</w:t></w:r></w:p></w:body></w:document>' }]);
  assert.equal(extract.extract('x.docx', docx).text, '# Onboarding\n\nCall the client & confirm.');
  const stream = require('zlib').deflateSync(Buffer.from('BT /F1 12 Tf 72 712 Td (Refunds within 30 days of purchase.) Tj 0 -14 Td [(Call us any) -300 (time.)] TJ ET'));
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + stream.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'), stream, Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')]);
  assert.equal(extract.extract('policy.pdf', pdf).text, 'Refunds within 30 days of purchase.\nCall us any time.');
  assert.throws(() => extract.extract('scan.pdf', Buffer.from('%PDF-1.4\n%%EOF')), /Couldn't read the text/);
  assert.throws(() => extract.extract('photo.png', Buffer.from('x')), /Markdown, text, CSV/);
});

// ---------- Brain docs ----------
test('Brain: docs, house rules, decisions, numbers, search and the doc page', async () => {
  process.env.BRAIN_DOCS = 'on';
  process.env.HQ_ACTIVITY = 'on';
  const u = await member();
  let r = await s.go('/app/hq/brain/docs', { as: u, form: { title: 'Refund policy', body: '# Refunds\n\nWe redo any missed patch free within 48 hours. See [[Pricing]]. #policy', tags: 'clients', public: 'on' } });
  assert.equal(r.status, 302);
  const id = r.headers.get('location').split('/').pop();
  const d = docs.get(u.id, id);
  assert.deepEqual(d.tags, ['clients', 'policy']);
  assert.deepEqual(d.links, ['Pricing']);
  assert.equal(d.public, true);
  await s.go('/app/hq/brain/docs', { as: u, form: { title: 'Pricing', body: 'Lawn mowing is $45 a visit. Weekly plans save 10%.' } });
  await s.go('/app/hq/brain/rules', { as: u, form: { principles: 'Answer the same day.', sops: '', checks: 'Never say: cheap, best in town' } });
  await s.go('/app/hq/brain/decisions', { as: u, form: { text: 'Weekly price goes to $50', why: 'Fuel costs' } });
  await s.go('/app/hq/brain/numbers', { as: u, form: { name: 'Calls booked', value: '4' } });
  await s.go('/app/hq/brain/numbers', { as: u, form: { name: 'Calls booked', value: '7' } });
  assert.deepEqual(docs.numbers(u.id).map((n) => [n.name, n.value, n.before]), [['Calls booked', 7, 4]]);
  const page = await (await s.go('/app/hq/brain?q=missed+patch', { as: u })).text();
  assert.match(page, /House rules/);
  assert.match(page, /Answer the same day\./);
  assert.match(page, /\[1\] Refund policy · Refunds/);
  assert.match(page, /Weekly price goes to \$50/);
  assert.match(page, /Calls booked/);
  const hits = docs.search(u.id, 'price decision');
  assert.ok(hits.some((h) => h.kind === 'decision'));
  assert.ok(hits.some((h) => h.title === 'Pricing'));
  assert.deepEqual(docs.search(u.id, 'mowing', { publicOnly: true }), []);
  const docPage = await (await s.go(`/app/hq/brain/docs/${id}`, { as: u })).text();
  assert.match(docPage, /Links to: <a class="link" href="\/app\/hq\/brain\/docs\/[^"]+">Pricing<\/a>/);
  // Another member can't see it.
  const other = await member();
  assert.equal((await s.go(`/app/hq/brain/docs/${id}`, { as: other })).status, 404);
  assert.deepEqual(docs.search(other.id, 'missed patch'), []);
  // The Activity log has each change, by the member.
  const acts = activity.list(u.id).map((a) => `${a.who}|${a.kind}|${a.action}`);
  assert.ok(acts.includes('you|brain|added a doc'));
  assert.ok(acts.includes('you|brain|changed house rules'));
  assert.ok(acts.includes('you|brain|logged a decision'));
  // Delete one doc, then everything.
  r = await s.go(`/app/hq/brain/docs/${id}/delete`, { as: u, form: {} });
  assert.equal(docs.get(u.id, id), null);
  assert.deepEqual(docs.search(u.id, 'missed patch'), []);
  await s.go('/app/hq/brain/forget', { as: u, form: {} });
  assert.deepEqual(docs.counts(u.id), { docs: 0, chars: 0, decisions: 0, numbers: 0, limit: docs.LIMITS.totalChars });
  assert.equal(docs.hasRules(docs.rules(u.id)), false);
});

test('Brain: files and Obsidian and Notion zips import, and export as a vault and as Notion Markdown', async () => {
  process.env.BRAIN_DOCS = 'on';
  const u = await member();
  const up = (name, buf, kind) => s.go('/app/hq/brain/docs/upload', { as: u, raw: buf, headers: { 'x-file-name': encodeURIComponent(name), accept: 'application/json', ...(kind ? { 'x-import': kind } : {}) } });
  let r = await up('FAQ.md', Buffer.from('---\ntitle: Common questions\ntags: [faq]\n---\nDo you mow in the rain? No, we move you to the next dry day.'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).doc.title, 'Common questions');
  r = await up('notes.png', Buffer.from('x'));
  assert.equal(r.status, 400);
  const vault = makeZip([
    { name: 'My Vault/Clients/Acme.md', data: '---\ntags:\n  - client\n  - vip\nstatus: active\n---\nAcme wants Tuesday mowing. See [[Common questions|the FAQ]]. #lawn' },
    { name: 'My Vault/.obsidian/workspace.json', data: '{}' },
    { name: 'My Vault/Ideas.md', data: 'Snow removal in winter.' },
  ]);
  r = await up('vault.zip', vault, 'obsidian');
  assert.deepEqual((await r.json()).imported, { added: 2, updated: 0, skipped: [] });
  r = await up('vault.zip', vault, 'obsidian');
  assert.deepEqual((await r.json()).imported, { added: 0, updated: 2, skipped: [] });
  const acme = docs.list(u.id).find((d) => d.title === 'Acme');
  assert.equal(acme.path, 'Clients');
  assert.deepEqual(acme.tags, ['client', 'vip', 'lawn']);
  assert.equal(acme.frontmatter.status, 'active');
  r = await up('Export.zip', makeZip([{ name: 'Export-abc/Team handbook 0123456789abcdef0123456789abcdef.md', data: '# Team handbook\n\nShow up 10 minutes early.' }]), 'notion');
  assert.deepEqual((await r.json()).imported.added, 1);
  assert.ok(docs.list(u.id).some((d) => d.title === 'Team handbook' && d.source === 'notion'));

  r = await s.go('/app/hq/brain/export?format=obsidian', { as: u });
  assert.equal(r.headers.get('content-type'), 'application/zip');
  const files = readZip(Buffer.from(await r.arrayBuffer()));
  const names = files.map((f) => f.name);
  assert.ok(names.includes('127 Brain/Docs/Clients/Acme.md'));
  assert.ok(names.includes('127 Brain/House rules.md'));
  assert.ok(names.includes('127 Brain/127 Brain.md'));
  const acmeMd = files.find((f) => f.name.endsWith('Acme.md')).data.toString();
  assert.match(acmeMd, /^---\ntags: \[client, vip, lawn\]\nstatus: active\n/);
  assert.match(acmeMd, /\[\[Common questions\|the FAQ\]\]/);
  const notion = readZip(docs.exportZip(u.id, brain.snapshot(u), 'notion'));
  const acmeN = notion.find((f) => f.name.endsWith('Acme.md')).data.toString();
  assert.match(acmeN, /\[the FAQ\]\(Common%20questions\.md\)/);
  assert.doesNotMatch(acmeN, /^---/);
});

test('Brain: house rules reach AI calls, banned words get one retry, and ctx.brain.search finds docs', async () => {
  const u = await member();
  await docs.setRules(u.id, { principles: 'Answer the same day.', checks: 'Never say: cheap' });
  await docs.save(u.id, { title: 'Hours', body: 'We open at 7am on weekdays.' });
  assert.equal(brain.snapshot(u).rules, undefined); // BRAIN_DOCS off
  process.env.BRAIN_DOCS = 'on';
  const snap = brain.snapshot(u);
  assert.equal(snap.rules.principles, 'Answer the same day.');
  const seen = [];
  const answers = ['A cheap deal for you.', 'A fair deal for you.'];
  anthropic._setClient({ messages: { create: async (p) => { seen.push(p); return { content: [{ type: 'text', text: answers.shift() }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, model: p.model }; } }, beta: { messages: { create: async (p) => { seen.push(p); return { content: [{ type: 'text', text: answers.shift() }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, model: p.model }; } } } });
  try {
    const out = await llm.call({ task: 'write', prompt: 'Write an offer.', brain: snap });
    assert.equal(out.text, 'A fair deal for you.');
    assert.equal(seen.length, 2);
    assert.match(seen[0].system.map((b) => b.text).join('\n'), /house rules[\s\S]*Answer the same day\./);
    assert.match(seen[1].messages[0].content.at(-1).text, /broke the member's house rules: it uses "cheap"/);
  } finally {
    anthropic._setClient(null);
  }
  const run = await engine.start(u, 'ws.look', { q: 'when do you open' });
  await engine.idle();
  const done = engine.get(u, run.id);
  assert.equal(done.status, 'done', JSON.stringify(done.timeline));
  assert.equal(done.steps.look.output.hits[0].title, 'Hours');
});

// ---------- Activity log ----------
test('Activity: runs, approvals and Brain changes, filtered, as CSV, and gone with the account', async () => {
  process.env.HQ_ACTIVITY = 'on';
  const u = await member();
  const run = await engine.start(u, 'ws.look', { q: 'x' }, { source: 'mcp' });
  await engine.idle();
  const rows = activity.list(u.id);
  assert.deepEqual(rows.map((a) => `${a.who}|${a.action}`).sort(), ['Your Claude|finished', 'Your Claude|started']);
  assert.equal(rows[0].ref, run.id);
  const page = await (await s.go('/app/hq/activity?kind=run', { as: u })).text();
  assert.match(page, /Your Claude · Runs/);
  assert.match(page, new RegExp(`href="/app/hq/runs/${run.id}"`));
  await activity.add(u, { kind: 'brain', action: 'added a doc', what: '=HYPERLINK("x")' });
  const csv = await (await s.go('/app/hq/activity.csv', { as: u })).text();
  assert.match(csv, /^When \(UTC\),Who,Kind,Action,What/);
  assert.match(csv, /'=HYPERLINK/);
  await harness.forget(u.id);
  assert.equal(activity.list(u.id).length, 0);
  // Off: nothing is kept.
  delete process.env.HQ_ACTIVITY;
  const v = await member();
  await activity.add(v, { kind: 'brain', action: 'x' });
  assert.equal(activity.list(v.id).length, 0);
});

// ---------- Skills ----------
const skills = require('../lib/harness/skills');
const team = require('../lib/harness/team');
const schedules = require('../lib/harness/schedules');
const mcp = require('../lib/harness/mcp');
const agent = require('../lib/harness/agent');
const prompts = require('../lib/harness/prompts');
const ledger = require('../lib/harness/ledger');
const tick = () => new Promise((r) => setImmediate(r));

test('Skills: on, off, run now, locked on Free, and a SKILL.md for Claude', async () => {
  const u = await member();
  assert.equal((await s.go('/app/hq/skills', { as: u })).status, 404);
  process.env.HQ_SKILLS = 'on';
  const page = await (await s.go('/app/hq/skills', { as: u })).text();
  assert.match(page, /Daily numbers/);
  assert.match(page, /Monday card/);
  assert.equal((await s.go('/app/hq/skills/daily_numbers/on', { as: u, form: {} })).status, 302);
  const sch = skills.scheduleOf(u.id, 'daily_numbers');
  assert.equal(sch.workflowId, 'hq.daily_numbers');
  assert.equal(skills.list(u).find((x) => x.id === 'daily_numbers').status, 'on');
  assert.match(flashes.at(-1).text, /Daily numbers is on: every day at 7am/);
  const r = await s.go('/app/hq/skills/daily_numbers/run', { as: u, form: {} });
  assert.match(r.headers.get('location'), /^\/app\/hq\/runs\//);
  await engine.idle();
  const run = db.get('runs', r.headers.get('location').split('/').pop());
  assert.equal(run.source, 'hq');
  assert.equal(run.status, 'done', JSON.stringify(run.timeline));
  const zip = readZip(Buffer.from(await (await s.go('/app/hq/skills/daily_numbers/skill.zip', { as: u })).arrayBuffer()));
  const md = zip.find((f) => f.name === '127-daily-numbers/SKILL.md').data.toString();
  assert.match(md, /^---\nname: 127-daily-numbers\n/);
  assert.match(md, /run_skill` with `\{ "skill": "daily_numbers" \}/);
  assert.match(md, /Only call `answer_inbox` after the member says yes/);
  await s.go('/app/hq/skills/daily_numbers/off', { as: u, form: {} });
  assert.equal(skills.scheduleOf(u.id, 'daily_numbers'), null);
  const free = await member('free');
  assert.equal(skills.list(free).find((x) => x.id === 'weekly_working').status, 'locked');
  await s.go('/app/hq/skills/weekly_working/on', { as: free, form: {} });
  assert.match(flashes.at(-1).text, /part of Builder/);
  assert.equal(skills.scheduleOf(free.id, 'weekly_working'), null);
  await assert.rejects(skills.turnOn(u, 'monday_card'), /always on/);
});

// ---------- AI team ----------
test('AI team: hire turns on its skills, pause and budget hold its turns, connections are scoped, let go turns them off', async () => {
  const u = await member();
  assert.equal((await s.go('/app/hq/team', { as: u })).status, 404);
  process.env.HQ_TEAM = 'on';
  const gallery = await (await s.go('/app/hq/team', { as: u })).text();
  assert.match(gallery, /Sales helper/);
  assert.match(gallery, /AI helper · Finds people to talk to[^<]* · Uses: Gmail, Calendly \(reads only\) · Budget: 400 credits a month/);
  assert.doesNotMatch(gallery, /\bHire\b/);
  const r = await s.go('/app/hq/team/hire/sales_rep', { as: u, form: { budget: '50' } });
  const t = team.list(u)[0];
  assert.equal(r.headers.get('location'), `/app/hq/team/${t.id}`);
  assert.equal(t.budget, 50);
  const sch = skills.scheduleOf(u.id, 'daily_numbers');
  assert.equal(sch.team, t.id);
  await assert.rejects(team.hire(u, 'sales_rep'), /already have a Sales helper/);
  assert.equal(team.allows(t.id, 'gmail'), true);
  assert.equal(team.allows(t.id, 'gmail', true), false);
  assert.equal(team.allows(t.id, 'stripe'), false);
  assert.match(await (await s.go(`/app/hq/team/${t.id}`, { as: u })).text(), /Sales helper/);

  // Paused: the sweep skips its skill and says why.
  await s.go(`/app/hq/team/${t.id}/pause`, { as: u, form: {} });
  assert.equal(team.get(u, t.id).status, 'paused');
  const due = async () => {
    const x = db.get('schedules', sch.id);
    x.lastDate = '2000-01-01';
    x.cron = '0 0 * * *';
    await db.save('schedules', x);
    const ids = await schedules.sweep({ enabledFor: () => true, start: (...a) => engine.start(...a) });
    await engine.idle();
    return { ids, after: db.get('schedules', sch.id) };
  };
  let out = await due();
  assert.deepEqual(out.ids, []);
  assert.match(out.after.lastError, /Sales helper is paused/);
  // Back to work: the run is the role's, and the Activity log says so.
  process.env.HQ_ACTIVITY = 'on';
  await s.go(`/app/hq/team/${t.id}/pause`, { as: u, form: { resume: '1' } });
  out = await due();
  assert.equal(out.ids.length, 1);
  assert.equal(db.get('runs', out.ids[0]).source, `team:${t.id}`);
  assert.ok(activity.list(u.id, { who: 'Sales helper' }).some((a) => a.action === 'started'));
  assert.equal(team.report(u, t).done, 1);
  // Off for the member: its turns skip too.
  delete process.env.HQ_TEAM;
  assert.match(team.holds(t.id, u), /switched off/);
  process.env.HQ_TEAM = 'on';
  await assert.rejects(team.setBudget(u, t.id, 5), /between 10 and 5,000/);
  await assert.rejects(team.start(u, t.id, 'ws.look'), /doesn't do that one/);
  await s.go(`/app/hq/team/${t.id}/let-go`, { as: u, form: {} });
  assert.equal(team.list(u).length, 0);
  assert.equal(skills.scheduleOf(u.id, 'daily_numbers'), null);
  assert.match(team.holds(t.id, u), /gone/);
});

// ---------- the AI link's Brain tools ----------
test('AI link: Brain tools only with their flags; notes, decisions, numbers and search; Make Claude your admin', async () => {
  const u = await member();
  const names = () => mcp.toolsFor(u).map((t) => t.name);
  assert.ok(!names().includes('brain_search'));
  assert.equal((await s.go('/app/hq/admin-setup', { as: u })).status, 404);
  process.env.HQ_MCP_BRAIN = 'on';
  assert.ok(!names().includes('brain_search')); // needs BRAIN_DOCS too
  process.env.BRAIN_DOCS = 'on';
  process.env.HQ_ACTIVITY = 'on';
  assert.ok(['brain_search', 'add_note', 'log_decision', 'log_number'].every((n) => names().includes(n)));
  assert.ok(!names().includes('list_skills'));
  assert.equal(await mcp.call(u, 'list_skills', {}), null);
  assert.match(mcp.instructionsFor(u), /search it with brain_search/);
  const call = async (name, args) => (await mcp.call(u, name, args, { base: 'https://127.test' })).content[0].text;
  assert.match(await call('add_note', { title: 'Refunds', text: 'Full refund within 14 days, no questions.', tags: ['policy'] }), /Saved "Refunds" to the member's Brain: https:\/\/127\.test\/app\/hq\/brain\/docs\//);
  assert.match(await call('brain_search', { query: 'refund policy' }), /\[1\] Refunds/);
  assert.match(await call('log_decision', { decision: 'Raise the price to $40', why: 'Booked out' }), /Logged: Raise the price/);
  assert.match(await call('log_number', { name: 'Calls booked', value: 4 }), /Logged Calls booked: 4/);
  assert.equal(docs.decisions(u.id)[0].by, 'Your Claude');
  assert.equal(docs.numbers(u.id)[0].value, 4);
  process.env.HQ_SKILLS = 'on';
  assert.match(await call('list_skills', {}), /daily_numbers: Daily numbers/);
  assert.match(await call('run_skill', { skill: 'daily_numbers' }), /Started Daily numbers/);
  await engine.idle();
  assert.match(await call('activity', {}), /Your Claude: added a note: Refunds/);
  assert.equal((await mcp.call(u, 'run_skill', { skill: 'nope' })).isError, true);
  await tick();
  assert.ok(activity.list(u.id, { who: 'Your Claude' }).some((a) => a.action === 'logged a decision'));
  const page = await (await s.go('/app/hq/admin-setup', { as: u })).text();
  assert.match(page, /Make Claude your admin/);
  const zip = readZip(Buffer.from(await (await s.go('/app/hq/admin-setup/skill.zip', { as: u })).arrayBuffer()));
  assert.match(zip[0].data.toString(), /^---\nname: 127-admin/);
});

// ---------- Ask 127 ----------
test('Ask 127: sample answers without a key, slash commands, and every action waits for an OK', async () => {
  const u = await member();
  assert.equal((await s.go('/app/hq/ask', { as: u })).status, 404);
  process.env.HQ_AGENT = 'on';
  process.env.BRAIN_DOCS = 'on';
  await docs.save(u.id, { title: 'Hours', body: 'We open at 7am on weekdays.' });
  const left = ledger.left(u);
  await s.go('/app/hq/ask', { as: u, form: { text: 'Look in my Brain for when we open' } });
  let msgs = agent.messages(u);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[1].sample, true);
  assert.match(msgs[1].text, /Your Brain says: We open at 7am/);
  assert.deepEqual(msgs[1].sources.map((x) => x.title), ['Hours']);
  const a = msgs[1].actions[0];
  assert.equal(a.workflow, 'ws.look');
  assert.equal(a.status, 'proposed');
  assert.equal(ledger.left(u), left); // samples are free
  assert.equal(db.filter('runs', (r) => r.memberId === u.id).length, 0);
  const page = await (await s.go('/app/hq/ask', { as: u })).text();
  assert.match(page, new RegExp(`action="/app/hq/ask/act/${a.id}"`));
  // It needs an answer, so OK opens its form; nothing runs until the member starts it there.
  const r = await s.go(`/app/hq/ask/act/${a.id}`, { as: u, form: { ok: '1' } });
  assert.equal(r.headers.get('location'), '/app/hq/w/ws.look?');
  assert.equal(db.filter('runs', (x) => x.memberId === u.id).length, 0);
  assert.equal((await agent.act(u, a.id, true)).status, 'open'); // a second tap does nothing new

  // Slash commands: no AI, no credits.
  for (const text of ['/number Calls booked 4', '/decide Open Saturdays, because demand', '/note Parking: Free lot behind the shop', '/search parking', '/help', '/nope']) await agent.send(u, text);
  msgs = agent.messages(u);
  assert.equal(docs.numbers(u.id)[0].value, 4);
  assert.equal(docs.decisions(u.id)[0].text, 'Open Saturdays');
  assert.equal(docs.decisions(u.id)[0].why, 'demand');
  assert.match(msgs.at(-5).text, /\[1\] Parking/);
  assert.match(msgs.at(-3).text, /\/run what you want done/);
  assert.match(msgs.at(-1).text, /I don't know \/nope/);
  assert.equal(ledger.left(u), left);
  // /<prompt id> with one answer runs that prompt.
  const one = prompts.load().prompts.find((p) => (p.variables || []).filter((v) => !v.optional).length === 1);
  const sl = await agent.slash(u, `/${one.id} my answer here`);
  assert.match(sl.prompt, /my answer here/);
  await s.go('/app/hq/ask/clear', { as: u, form: {} });
  assert.equal(agent.messages(u).length, 0);
});

test('Ask 127 live: harness prompt with the Brain in its slot, cited passages, credits, and each kind of action', async () => {
  process.env.HQ_AGENT = 'on';
  process.env.BRAIN_DOCS = 'on';
  process.env.HQ_SKILLS = 'on';
  process.env.HQ_ACTIVITY = 'on';
  const u = await member();
  await docs.save(u.id, { title: 'Business brain', body: 'Mobile dog grooming in Austin. Owner: Ana.' });
  await docs.save(u.id, { title: 'Prices', body: 'A full groom is $85 and a bath is $45.' });
  const blank = { workflow: '', skill: '', inputs: [], text: '', why: '', name: '', value: '' };
  const reply = {
    under18: false,
    answer: 'A full groom is $85 [1].',
    cite: [1, 9],
    actions: [
      { ...blank, type: 'start_workflow', label: 'Look it up', workflow: 'ws.look', inputs: [{ key: 'q', value: 'prices' }, { key: 'bad', value: 'x' }] },
      { ...blank, type: 'log_number', label: 'Log it', name: 'Grooms this week', value: '12' },
      { ...blank, type: 'add_note', label: 'Save it', text: 'Ask about the dog\'s age first.', why: 'Intake' },
      { ...blank, type: 'run_skill', label: 'Run it', skill: 'daily_numbers' },
    ],
  };
  const seen = [];
  const fake = async (p) => { seen.push(p); return { content: [{ type: 'text', text: JSON.stringify(reply) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, model: p.model }; };
  anthropic._setClient({ messages: { create: fake }, beta: { messages: { create: fake } } });
  const left = ledger.left(u);
  try {
    await agent.send(u, 'How much is a full groom?');
  } finally {
    anthropic._setClient(null);
  }
  const sys = seen[0].system.map((b) => b.text).join('\n');
  assert.match(sys, /Mobile dog grooming in Austin/);
  assert.doesNotMatch(sys, /Paste the founder's business brain here/);
  assert.match(sys, /You are Ask 127/);
  const user = seen[0].messages[0].content.at(-1).text;
  assert.match(user, /ws\.look: Look in my Brain/);
  assert.match(user, /A full groom is \$85/);
  assert.equal(ledger.left(u), left - agent.cost());
  const m = agent.messages(u).at(-1);
  assert.deepEqual(m.sources.map((x) => x.title), ['Prices']);
  assert.deepEqual(m.actions.map((x) => x.type), ['start_workflow', 'log_number', 'add_note']); // three at most
  assert.deepEqual(m.actions[0].inputs, { q: 'prices' });
  for (const x of m.actions) assert.equal((await agent.act(u, x.id, true)).status, 'done', x.type);
  await engine.idle();
  assert.equal(docs.numbers(u.id)[0].value, 12);
  assert.ok(docs.list(u.id).some((d) => d.title === 'Intake' && d.source === 'agent'));
  await tick();
  const acts = activity.list(u.id, { who: 'Ask 127' }).map((a) => a.action);
  assert.ok(['answered', 'logged a number', 'added a note', 'started'].every((x) => acts.includes(x)), acts.join());
  // Out of credits: it says so and spends nothing.
  process.env.HQ_AGENT_CREDITS = String(ledger.left(u) + 1);
  await assert.rejects(agent.send(u, 'Hi'), /uses \d+ credits and you have/);
  delete process.env.HQ_AGENT_CREDITS;
});

// ---------- Prompts ----------
test('Prompts: forms from variables, filled in, locked by plan, never showing where they came from', async () => {
  const u = await member();
  assert.equal((await s.go('/app/hq/prompts', { as: u })).status, 404);
  process.env.HQ_PROMPTS = 'on';
  const L = prompts.load();
  assert.equal(L.prompts.length, 61);
  assert.ok(L.prompts.every((p) => !('origin' in p)));
  assert.ok(!/"origin"/.test(fs.readFileSync(path.join(__dirname, '..', 'content', 'prompts', 'manifest.json'), 'utf8')));
  const list = await (await s.go('/app/hq/prompts', { as: u })).text();
  assert.match(list, /The Idea Test/);
  const p = prompts.get('start.idea_test');
  const page = await (await s.go('/app/hq/prompts/start.idea_test', { as: u })).text();
  for (const v of p.variables) assert.match(page, new RegExp(`name="v_${v.key}"`));
  const form = Object.fromEntries(p.variables.map((v) => [`v_${v.key}`, v.optional ? '' : `ans-${v.key}`]));
  const filled = await (await s.go('/app/hq/prompts/start.idea_test', { as: u, form: { ...form, fill: '1' } })).text();
  assert.match(filled, /Your prompt/);
  assert.match(filled, /ans-ideas/);
  assert.doesNotMatch(filled, /\{\{ideas\}\}/);
  // Missing answers stay as a bracketed label; optional ones drop out.
  assert.match(prompts.fill(p, {}), /\[[^\]]+\]/);
  const paid = L.prompts.find((x) => x.tier === 'builder');
  const free = await member('free');
  assert.match(await (await s.go(`/app/hq/prompts/${paid.id}`, { as: free })).text(), /This prompt is part of Builder/);
  assert.match(await (await s.go('/app/hq/prompts', { as: free })).text(), /h2-tag">Builder/);
  assert.equal((await s.go(`/app/hq/prompts/${paid.id}`, { as: free, form: { fill: '1' } })).headers.get('location'), `/app/hq/prompts/${paid.id}`);
  assert.equal((await s.go('/app/hq/prompts/nope', { as: u })).status, 404);
  // Send to Ask 127: one message showing the prompt's title.
  process.env.HQ_AGENT = 'on';
  const r = await s.go('/app/hq/prompts/start.idea_test', { as: u, form: { ...form, ask: '1' } });
  assert.equal(r.headers.get('location'), '/app/hq/ask#end');
  assert.equal(agent.messages(u)[0].text, 'Prompt: The Idea Test');
  assert.match(prompts.system('My brain text'), /My brain text/);
});

// ---------- Legal L76 ----------
test('L76: card numbers and SSNs are masked in Brain docs, and the Public toggle says who can see a doc', async () => {
  process.env.BRAIN_DOCS = 'on';
  const u = await member();
  const d = await docs.save(u.id, { title: 'Card 4242 4242 4242 4242', body: 'Pay with 4111-1111-1111-1111. SSN 123-45-6789. Call 555-123-4567. Order 1234 5678 9012 3456.', frontmatter: { ssn: 'SSN: 123456789' } });
  assert.equal(d.title, 'Card [card ending 4242]');
  assert.equal(d.body, 'Pay with [card ending 1111]. SSN [SSN ending 6789]. Call 555-123-4567. Order 1234 5678 9012 3456.');
  assert.equal(d.frontmatter.ssn, 'SSN: [SSN ending 6789]');
  assert.equal(docs.search(u.id, '4242424242424242').length, 0);
  const page = await (await s.go('/app/hq/brain', { as: u })).text();
  assert.match(page, /Anyone who uses your site chat can get answers from this doc\. Keep other people's details out\./);
  assert.match(page, /Add only what you have the right to use\. Keep card and bank numbers, passwords and health details out\./);
  assert.match(page, /These go with every AI request HQ makes for you\. Keep other people's details and secrets out\./);
  assert.match(await (await s.go(`/app/hq/brain/docs/${d.id}`, { as: u })).text(), /Anyone who uses your site chat can get answers from this doc/);
});

test('L76: a fresh chat deletes the old one, chats go 180 days after their last message, and the under-18 marker pauses Ask 127 with only the member\'s words', async () => {
  process.env.HQ_AGENT = 'on';
  process.env.BRAIN_DOCS = 'on';
  const u = await member();
  await agent.send(u, '/help');
  assert.ok(db.get('agentChats', u.id));
  await agent.clear(u);
  assert.equal(db.get('agentChats', u.id), null);
  // 180 days
  const old = await member();
  await agent.send(old, '/help');
  const c = db.get('agentChats', old.id);
  c.messages.forEach((m) => { m.at = new Date(Date.now() - 181 * 864e5).toISOString(); });
  c.updatedAt = c.messages[0].at;
  db.get('agentChats', old.id).updatedAt = c.updatedAt; // updatedAt is stamped on save; set it after
  await agent.send(u, '/help');
  assert.equal(await agent.purge(Date.now()), 1);
  assert.equal(db.get('agentChats', old.id), null);
  assert.ok(db.get('agentChats', u.id));
  // Under 18
  await docs.save(u.id, { title: 'Secret plan', body: 'Our margin is 62 percent.' });
  const blank = { workflow: '', skill: '', inputs: [], text: '', why: '', name: '', value: '' };
  const fake = async (p) => ({ content: [{ type: 'text', text: JSON.stringify({ under18: true, answer: 'Thanks for telling me.', cite: [], actions: [blank].slice(0, 0) }) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, model: p.model });
  anthropic._setClient({ messages: { create: fake }, beta: { messages: { create: fake } } });
  try {
    await agent.send(u, "I'm 15 and want to sell my margin plan");
  } finally {
    anthropic._setClient(null);
  }
  const who = db.get('users', u.id);
  assert.equal(who.ageReview.status, 'open');
  assert.equal(who.ageReview.source, 'ask');
  assert.ok(who.ageReview.excerpt.every((m) => m.from === 'member'));
  assert.ok(!JSON.stringify(who.ageReview.excerpt).includes('62 percent'));
  await assert.rejects(agent.send(who, 'Hi'), /18 and older/);
});

test('L76: neither the AI link nor the run route starts a hidden workflow, and skills say whose content they are', async () => {
  process.env.HQ_SKILLS = 'on';
  const u = await member();
  assert.equal((await s.go('/app/hq/w/hq.daily_numbers/run', { as: u, form: {} })).status, 404);
  const out = await mcp.call(u, 'start_workflow', { workflow: 'hq.daily_numbers', inputs: {} });
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /isn't one you can start here/);
  assert.equal(db.filter('runs', (r) => r.memberId === u.id).length, 0);
  const md = skills.skillMd(skills.get('daily_numbers')).body;
  assert.match(md, /^---\n[\s\S]*?\n---\n\n127 content for your own business, under 127's Terms \(Section 11\)\. Don't share or sell it\.\n\n# Daily numbers/);
  assert.match(prompts.get('finance.forecast').note, /not tax, legal or investment advice/);
});

test('L76 B7: after a paid plan ends, Brain exports and Library downloads still work', async () => {
  process.env.BRAIN_DOCS = 'on';
  const u = await member('builder');
  await docs.save(u.id, { title: 'Offer', body: 'Weekly mowing, $45.' });
  const f = await require('../lib/harness/library').save(u, 'plan.md', '# My plan', { runId: 'r1' });
  u.tier = 'free';
  await db.save('users', u);
  const zip = await s.go('/app/hq/brain/export?format=obsidian', { as: u });
  assert.equal(zip.status, 200);
  assert.ok(readZip(Buffer.from(await zip.arrayBuffer())).some((x) => /Offer\.md$/.test(x.name)));
  const file = await s.go(`/app/hq/files/${f.id}?download=1`, { as: u });
  assert.equal(file.status, 200);
  assert.equal(await file.text(), '# My plan');
});
