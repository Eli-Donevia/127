// The HQ Store pages (lib/store-routes.js, views/app/hq2/store*.ejs) behind STORE_V2 (lib/harness/flags.js):
// off means 404 and no tab, and on before TERMS_LIVE and PRIVACY_LIVE means admins only; the gallery's chips, search, Coming soon and Builder locks; gated downloads (never a
// .tpl); prompt text gated per prompt and never a prompt's origin; Legal's note; and Make it mine
// from the item page to a finished run with its files in the Library. No network, no AI.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-store-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-store-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
process.env.HARNESS_STRICT = 'on';
for (const k of ['ANTHROPIC_API_KEY', 'HARNESS_PAUSE', 'HARNESS_AI', 'ADMIN_EMAILS', 'STORE_V2', 'STORE_SITES', 'HQ_WORKSPACE']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const harness = require('../lib/harness');
const harnessRoutes = require('../lib/harness/routes');
const storeRoutes = require('../lib/store-routes');
const store = require('../lib/store');
const { plan } = require('../lib/plans');
const { unzip } = require('../lib/packs/_kit/files');
const fx = require('./fixtures/store-fixture');

const { engine, packs } = harness;

let seq = 0;
async function member(tier = 'free') {
  seq += 1;
  return db.save('users', { id: `stu${seq}`, email: `st${seq}@127.test`, name: `Maya Lane${seq}`, tier, emailVerified: true, answers: { model: 'service' } });
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
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    Object.assign(res.locals, locals(req.user, req));
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const flash = () => {};
  app.use(harnessRoutes({ requireAuth, flash, track: () => {}, isAdmin: () => false }));
  app.use(storeRoutes({ requireAuth, flash, track: () => {} }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form } = {}) => {
    const h = {};
    if (as) h['x-user'] = as.id;
    let body;
    if (form) { body = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    return fetch(url + p, { method: body !== undefined ? 'POST' : 'GET', headers: h, body, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

let s;
let fixtureDir;
test.before(async () => {
  await db.init();
  packs.reset();
  const r = packs.registerAll([{ pack: require('../lib/packs/store'), source: 'store' }, { pack: require('../lib/packs/hq'), source: 'hq' }]);
  assert.deepEqual(r.refused, [], JSON.stringify(r.refused));
  const { items, files } = fx.standard();
  const w = fx.writeStore({ items, files });
  fixtureDir = w.dir;
  store.use(store.load(w.dir, { promptsFile: w.promptsFile }));
  s = await server();
});
test.after(async () => {
  await s.close();
  store.use(null);
});
test.beforeEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.HQ_WORKSPACE;
  process.env.HARNESS_V2 = 'on';
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
  process.env.STORE_V2 = 'on';
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
  if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
});

const html = async (res) => {
  const t = await res.text();
  assert.equal(res.status, 200, t.slice(0, 600));
  return t;
};
const where = (res) => res.headers.get('location');

test('STORE_V2 off: every Store page 404s and the HQ tabs show no Store', async () => {
  const u = await member('builder');
  for (const v of ['', 'off', 'false']) {
    process.env.STORE_V2 = v;
    for (const p of ['/app/hq/store', '/app/hq/store/quote', '/app/hq/store/quote/files/127-quote.docx', '/app/hq/store/quote/files/preview.png']) {
      const r = await s.go(p, { as: u });
      assert.equal(r.status, 404, `${v} ${p}`);
      assert.equal(await r.text(), 'app 404');
    }
    assert.equal((await s.go('/app/hq/store/quote/make', { as: u, form: { email: 'a@b.co' } })).status, 404);
    assert.doesNotMatch(await html(await s.go('/app/hq/start', { as: u })), /href="\/app\/hq\/store"/);
  }
  // On, but HQ v2 is off for the member: still nothing.
  process.env.STORE_V2 = 'on';
  process.env.HARNESS_V2 = 'off';
  assert.equal((await s.go('/app/hq/store', { as: u })).status, 404);
  // Admins only: a member who isn't in ADMIN_EMAILS gets the 404 too.
  process.env.HARNESS_V2 = 'on';
  process.env.STORE_V2 = 'admins';
  assert.equal((await s.go('/app/hq/store', { as: u })).status, 404);
  // On: the tab shows, before Library, and signed-out visitors are sent to sign in.
  process.env.STORE_V2 = 'on';
  const start = await html(await s.go('/app/hq/start', { as: u }));
  assert.match(start, /href="\/app\/hq\/store"[^>]*>Store<\/a><a href="\/app\/hq\/library"/);
  assert.equal(where(await s.go('/app/hq/store')), '/login');
});

test('STORE_V2 on before Terms and Privacy are live: a member sees no Store, an admin can', async () => {
  const u = await member('builder');
  const boss = await member('builder');
  process.env.ADMIN_EMAILS = boss.email;
  // Before Legal is live HQ v2 is admins and early access only, so the member has early access: HQ shows, the Store doesn't.
  await harness.access.give(u.email, { by: boss.email });
  for (const [terms, privacy] of [[undefined, undefined], ['false', 'true'], ['true', 'false']]) {
    if (terms === undefined) delete process.env.TERMS_LIVE; else process.env.TERMS_LIVE = terms;
    if (privacy === undefined) delete process.env.PRIVACY_LIVE; else process.env.PRIVACY_LIVE = privacy;
    assert.equal(harness.flags.on('STORE_V2', u), false);
    assert.equal(store.enabledFor(u), false);
    for (const p of ['/app/hq/store', '/app/hq/store/quote', '/app/hq/store/quote/files/preview.png']) assert.equal((await s.go(p, { as: u })).status, 404, `${terms} ${privacy} ${p}`);
    assert.equal((await s.go('/app/hq/store/quote/make', { as: u, form: { email: 'a@b.co' } })).status, 404);
    assert.doesNotMatch(await html(await s.go('/app/hq/start', { as: u })), /href="\/app\/hq\/store"/);
    // The admin sees the tab and the pages.
    assert.equal(store.enabledFor(boss), true);
    assert.match(await html(await s.go('/app/hq/start', { as: boss })), /href="\/app\/hq\/store"[^>]*>Store<\/a>/);
    assert.match(await html(await s.go('/app/hq/store', { as: boss })), /<h3>Quote<\/h3>/);
    assert.match(await html(await s.go('/app/hq/store/quote', { as: boss })), /Make it mine/);
  }
  // HQ's run route refuses hidden workflows: Make it mine starts only from the Store.
  delete process.env.TERMS_LIVE;
  const res = await s.go('/app/hq/w/store.make_it_mine/run', { as: u, form: { in_item: 'quote' } });
  assert.equal(res.status, 404);
  await engine.idle();
  assert.equal(harness.library.list(u.id).length, 0);
  // With the HQ workspace on, its rail follows the same flag.
  process.env.HQ_WORKSPACE = 'on';
  assert.doesNotMatch(await html(await s.go('/app/hq/start', { as: u })), /href="\/app\/hq\/store"/);
  const ws = await html(await s.go('/app/hq/store', { as: boss }));
  assert.match(ws, /href="\/app\/hq\/store"/);
  assert.match(ws, /hq2-ws\.css/);
});

test('the gallery: chips, search, Coming soon, Builder locks for a free member, and Legal\'s note', async () => {
  const u = await member('free');
  const page = await html(await s.go('/app/hq/store', { as: u }));
  // Eli, Oct 20: every Store item comes with Builder, nothing sold one by one.
  assert.match(page, /Every template here comes with Builder, and the ones without a Builder tag work on any plan too\. Nothing is sold one by one\./);
  const gallery = page.slice(page.indexOf('class="hq-head"'));
  assert.doesNotMatch(gallery.slice(0, gallery.indexOf('<footer') > 0 ? gallery.indexOf('<footer') : undefined), /\$\d|[Cc]heckout|Buy /, 'no per-item prices or checkout in the Store');
  for (const t of ['Quote', 'First-Sale Math', 'Notion CRM', 'Business brain prompts', 'Pitch deck']) assert.match(page, new RegExp(`<h3>${t}</h3>`));
  assert.doesNotMatch(page, /Agency site/, 'its own flag is off');
  assert.match(page, /aria-current="page"[^>]*>Store<|class="on" aria-current="page">Store</);
  const card = (id) => page.slice(page.indexOf(`href="/app/hq/store/${id}"`)).split('</a>')[0];
  assert.match(card('first-sale-math'), /h2-tag lock"><svg[^]*<\/svg>Builder<\/span>/);
  assert.match(card('first-sale-math'), /<img src="\/app\/hq\/store\/first-sale-math\/files\/preview\.png"/);
  assert.match(card('deck-pitch'), /Coming soon/);
  assert.doesNotMatch(card('quote'), /Builder/);
  assert.match(card('quote'), /Make it mine/);
  assert.match(card('quote'), /class="st-note">Template, not legal advice\./);
  for (const banned of [/—/, /students/i, /Hormozi/i, /\$100M/]) assert.doesNotMatch(page, banned);
  // Filters are links and a GET form, and keep each other.
  const sheets = await html(await s.go('/app/hq/store?kind=sheet', { as: u }));
  assert.match(sheets, /<h3>First-Sale Math<\/h3>/);
  assert.doesNotMatch(sheets, /<h3>Quote<\/h3>/);
  assert.match(sheets, /href="\/app\/hq\/store\?kind=sheet&amp;type=local"/);
  const local = await html(await s.go('/app/hq/store?type=local', { as: u }));
  assert.match(local, /<h3>Quote<\/h3>/);
  assert.match(local, /<h3>First-Sale Math<\/h3>/, 'an item for any business fits every type');
  assert.doesNotMatch(local, /<h3>Pitch deck<\/h3>/);
  const found = await html(await s.go('/app/hq/store?q=notion', { as: u }));
  assert.match(found, /<h3>Notion CRM<\/h3>/);
  assert.doesNotMatch(found, /<h3>Quote<\/h3>/);
  assert.match(await html(await s.go('/app/hq/store?q=zebra', { as: u })), /Nothing matches/);
  assert.match(await html(await s.go('/app/hq/store?kind=%3Cscript%3E', { as: u })), /<h3>Quote<\/h3>/, 'an unknown kind is ignored');
});

test('downloads: a free member sees the lock on a Builder item and can\'t download it; a .tpl never downloads', async () => {
  const free = await member('free');
  const paid = await member('builder');
  const item = await html(await s.go('/app/hq/store/first-sale-math', { as: free }));
  assert.match(item, /id="unlock"/);
  assert.match(item, /is part of Builder/);
  assert.doesNotMatch(item, /files\/127-first-sale-math\.xlsx/);
  assert.doesNotMatch(item, /action="\/app\/hq\/store\/first-sale-math\/make"/);
  let r = await s.go('/app/hq/store/first-sale-math/files/127-first-sale-math.xlsx', { as: free });
  assert.equal(r.status, 302);
  assert.equal(where(r), '/app/hq/store/first-sale-math?locked=1#unlock');
  assert.equal((await s.go('/app/hq/store/first-sale-math/make', { as: free, form: {} })).status, 302);
  assert.equal(engine.list(free).length, 0, 'no run for a locked item');
  r = await s.go('/app/hq/store/first-sale-math/files/preview.png', { as: free });
  assert.equal(r.status, 200, 'previews open to every member');
  assert.equal(r.headers.get('content-disposition'), 'inline; filename="preview.png"');
  r = await s.go('/app/hq/store/first-sale-math/files/127-first-sale-math.xlsx', { as: paid });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-disposition'), 'attachment; filename="127-first-sale-math.xlsx"');
  assert.match(r.headers.get('content-type'), /spreadsheetml/);
  assert.match(await html(await s.go('/app/hq/store/first-sale-math', { as: paid })), /How to use it[^]*Type your price\./);
  // A free item downloads for a free member; its .tpl source never does, for anyone.
  r = await s.go('/app/hq/store/quote/files/127-quote.html', { as: free });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /sandbox/);
  assert.doesNotMatch(await r.text(), /\{\{/);
  for (const f of ['127-quote.docx.tpl', '127-quote.html.tpl', '..%2F..%2Fstore.json']) assert.equal((await s.go(`/app/hq/store/quote/files/${f}`, { as: paid })).status, 404, f);
  assert.equal((await s.go('/app/hq/store/crm/files/127-crm.zip.tpl', { as: paid })).status, 404);
  // A coming item: its page says so and offers nothing to download.
  const soon = await html(await s.go('/app/hq/store/deck-pitch', { as: paid }));
  assert.match(soon, /Coming soon/);
  assert.doesNotMatch(soon, /\/files\//);
  assert.equal((await s.go('/app/hq/store/site-agency', { as: paid })).status, 404);
});

test('prompt packs: each prompt\'s title and when, its text only where the plan covers it, never its origin', async () => {
  const free = await member('free');
  const paid = await member('builder');
  const a = await html(await s.go('/app/hq/store/prompts-brain', { as: free }));
  assert.match(a, /Interview me/);
  assert.match(a, /When: Day one\./);
  assert.match(a, /Set up my vault/);
  assert.match(a, /When: Once you have a brain\./);
  assert.match(a, /FREE-PROMPT-TEXT: ask me ten questions about \{\{business\}\}\./);
  assert.doesNotMatch(a, /BUILDER-PROMPT-TEXT/);
  const vault = a.slice(a.indexOf('<h3>Set up my vault'));
  assert.match(vault.slice(0, 600), /h2-tag lock"><svg[^]*Builder/);
  assert.match(a, /<button type="button" data-copy>Copy<\/button>/);
  const b = await html(await s.go('/app/hq/store/prompts-brain', { as: paid }));
  assert.match(b, /BUILDER-PROMPT-TEXT/);
  for (const p of [a, b, await html(await s.go('/app/hq/store', { as: paid })), await html(await s.go('/app/hq/store?q=prompts', { as: free }))]) {
    assert.doesNotMatch(p, /ORIGIN-MARKER/);
    assert.doesNotMatch(p, /["']?origin["']?\s*[:=]/i);
  }
});

test('an item with Legal\'s note shows it on its page, small and muted', async () => {
  const u = await member('free');
  const page = await html(await s.go('/app/hq/store/quote', { as: u }));
  assert.match(page, /<p class="st-note">Template, not legal advice\. Have a professional review any agreement before you sign\.<\/p>/);
  assert.doesNotMatch(await html(await s.go('/app/hq/store/crm', { as: u })), /not legal advice/);
});

test('Make it mine: from the item page to a finished run, with the files in the Library', async () => {
  const u = await member('free');
  await harness.brain.update(u, { business: { name: 'Glow & Co' } });
  const page = await html(await s.go('/app/hq/store/quote', { as: u }));
  assert.match(page, /action="\/app\/hq\/store\/quote\/make"/);
  assert.match(page, /name="email"/);
  assert.match(page, /<span>Your business name<\/span><b>From Your business<\/b>/);
  assert.match(page, /<span>Your offer<\/span><b>Not saved yet<\/b>/);
  const r = await s.go('/app/hq/store/quote/make', { as: u, form: { email: 'hi@glow.co', phone: '' } });
  assert.equal(r.status, 302);
  const runId = where(r).match(/^\/app\/hq\/runs\/([\w-]+)$/)[1];
  await engine.idle();
  const run = engine.get(u, runId);
  assert.equal(run.status, 'done', JSON.stringify(run.steps));
  assert.deepEqual(run.inputs, { item: 'quote', email: 'hi@glow.co' });
  assert.equal(run.credits.used, 1);
  const files = harness.library.list(u.id, { runId });
  assert.deepEqual(files.map((f) => f.name).sort(), ['quote-glow-and-co.docx', 'quote-glow-and-co.html', 'quote-glow-and-co.md']);
  const docx = files.find((f) => f.name.endsWith('.docx'));
  assert.match(docx.type, /wordprocessingml/);
  const got = await harness.library.read(u.id, docx.id);
  const doc = unzip(got.buf).find((e) => e.name === 'word/document.xml').data.toString();
  assert.match(doc, /Welcome to Glow &amp; Co/);
  assert.match(doc, /Reach hi@glow\.co/);
  assert.doesNotMatch(doc, /legal advice/);
  const view = await html(await s.go(`/app/hq/runs/${runId}`, { as: u }));
  assert.match(view, /quote-glow-and-co\.docx/);
  assert.match(view, /Filled in for you: Your business name, Email for customers/);
  assert.match(view, /Fill these in yourself: Brand color, Your offer\./);
  assert.match(view, /class="blk blk-text muted">Template, not legal advice\./);
  // A bad email is refused before anything runs.
  const bad = await s.go('/app/hq/store/quote/make', { as: u, form: { email: 'nope' } });
  assert.equal(where(bad), '/app/hq/store/quote');
});
