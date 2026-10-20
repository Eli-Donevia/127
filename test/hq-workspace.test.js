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
