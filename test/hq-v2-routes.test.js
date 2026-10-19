// HQ v2 pages (lib/harness/routes.js, views/app/hq2): Today with Do my day, the scoreboard and the one
// move, Talk to 127, Start and a workflow page, a run from form to finished result, the Inbox, the
// Pipeline, files (owner only, HTML never runs), Your business and Set up, then the queue end to end
// (written sends, Sent and Undo, follow-ups, replies, call prep, wins), First 25 imports, Monday's card
// and the admin numbers. No network: no AI key, so AI steps give sample answers.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-hq2-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-hq2-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
process.env.HARNESS_STRICT = 'on';
for (const k of ['ANTHROPIC_API_KEY', 'HARNESS_PAUSE', 'HARNESS_AI', 'HARNESS_FREE_RUN', 'HARNESS_MAX_DAY_USD', 'HARNESS_MAX_RUN_USD', 'ADMIN_EMAILS']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const hq = require('../lib/hq');
const harness = require('../lib/harness');
const harnessRoutes = require('../lib/harness/routes');
const hqRoutes = require('../lib/hq-routes');
const { plan } = require('../lib/plans');

const { engine, packs, todayLib } = harness;
const imports = require('../lib/harness/imports');
const hqPack = require('../lib/packs/hq');
const T0 = Date.parse('2026-11-04T15:00:00Z'); // Wednesday
let now = T0;
let flashes = [];

const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const LEAD = obj({ key: { type: 'string' }, name: { type: 'string' } });
const PAGE = '<!doctype html><html><body><h1>Hi</h1><script>window.pwned = 1</script></body></html>';

const RT = {
  id: 'rt',
  title: 'Route tests',
  version: '1.0.0',
  summary: 'Gyms for route tests.',
  niches: ['gyms'],
  tools: [
    {
      name: 'rt.find',
      title: 'Find gyms',
      description: 'Finds three gyms and adds them to the Pipeline.',
      kind: 'code',
      risk: 'read',
      credits: 1,
      input: obj({ city: { type: 'string' } }),
      output: obj({ leads: { type: 'array', items: LEAD } }),
      run: async ({ city }, ctx) => {
        const leads = [];
        for (const name of ['Iron Temple', 'Peak Fitness', 'Core Club']) {
          const key = name.toLowerCase().replace(/\s+/g, '-');
          await ctx.leads.upsert({ key, name: `${name} ${city}`, links: { website: `https://${key}.test` } });
          leads.push({ key, name: `${name} ${city}` });
        }
        return { leads };
      },
      view: (o) => [{ type: 'table', columns: [{ key: 'name', label: 'Gym' }], rows: o.leads }],
    },
    {
      name: 'rt.draft',
      title: 'Write a DM',
      description: 'Writes a first DM to one gym.',
      kind: 'ai',
      risk: 'draft',
      credits: 2,
      tasks: ['write'],
      input: obj({ lead: LEAD }),
      output: obj({ name: { type: 'string' }, text: { type: 'string' } }),
      run: async ({ lead }, ctx) => {
        const r = await ctx.ai({ task: 'write', prompt: `Write a DM to ${lead.name}.`, schema: obj({ text: { type: 'string' } }) });
        return { name: lead.name, text: r.data.text };
      },
      view: (o) => [{ type: 'copy', label: o.name, text: o.text }],
    },
    {
      name: 'rt.page',
      title: 'Make a page',
      description: 'Saves a page and a sheet to the Library.',
      kind: 'code',
      risk: 'draft',
      credits: 1,
      input: obj({}),
      output: obj({ page: { type: 'object' }, sheet: { type: 'object' } }),
      run: async (_, ctx) => ({
        page: await ctx.save('landing.html', PAGE, { type: 'text/html' }),
        sheet: await ctx.save('gyms.csv', 'name\nIron Temple\n', { type: 'text/csv' }),
      }),
      view: (o) => [{ type: 'file', asset: o.page, caption: 'Your page' }, { type: 'file', asset: o.sheet, caption: 'The list' }],
    },
  ],
  workflows: [
    {
      id: 'rt.flow',
      title: 'First gym clients',
      promise: 'Finds gyms near you and writes the first DM to each.',
      minutes: 4,
      tier: 'free',
      job: 'leads',
      savesMinutes: 120,
      inputs: obj({ city: { type: 'string', title: 'Your city', description: 'Where to look.' } }),
      steps: [
        { id: 'find', tool: 'rt.find', input: { city: '$inputs.city' } },
        { id: 'pick', approve: { title: 'Pick up to 2 gyms', choose: '$find.leads', label: 'name', max: 2 } },
        { id: 'dms', tool: 'rt.draft', each: '$pick.chosen', input: { lead: '$item' } },
        { id: 'page', tool: 'rt.page' },
      ],
      result: ['dms', 'page'],
    },
    { id: 'rt.paid', title: 'Builder gym report', promise: 'Builder only.', minutes: 2, tier: 'builder', job: 'money', inputs: obj({}, []), steps: [{ id: 'page', tool: 'rt.page' }], result: ['page'] },
  ],
};

// A workflow that reads one of the member's own Library files (an input with format 'asset').
const RF = {
  id: 'rf',
  title: 'Route file tests',
  version: '1.0.0',
  summary: 'Reads a file the member added.',
  niches: ['any'],
  tools: [
    {
      name: 'rf.read_clip',
      title: 'Read the clip',
      description: 'Opens the file and reports its size.',
      kind: 'code',
      risk: 'read',
      credits: 1,
      input: obj({ clip: { type: 'string', format: 'asset' } }),
      output: obj({ name: { type: 'string' }, bytes: { type: 'integer' }, head: { type: 'string' } }),
      run: async ({ clip }, ctx) => {
        const f = await ctx.asset(clip);
        return { name: f.name, bytes: f.bytes, head: fs.readFileSync(f.path, 'utf8').slice(0, 12) };
      },
      view: (o) => [{ type: 'text', text: `${o.name}: ${o.bytes} bytes` }],
    },
    {
      name: 'rf.find_lead',
      title: 'Find the business',
      description: 'Finds one business in the Pipeline by name.',
      kind: 'code',
      risk: 'read',
      credits: 0,
      input: obj({ gym: { type: 'string' } }),
      output: obj({ found: { type: 'boolean' }, name: { type: 'string' } }),
      run: async ({ gym }, ctx) => {
        const l = (await ctx.leads.list({ all: true })).find((x) => x.name === gym);
        return { found: !!l, name: gym };
      },
    },
  ],
  workflows: [
    {
      id: 'rf.clip',
      title: 'Check a clip',
      promise: 'Opens a clip you added.',
      minutes: 1,
      tier: 'free',
      job: 'content',
      inputs: obj({ clip: { type: 'string', format: 'asset', title: 'Your clip', accept: 'video/*,.txt' } }),
      steps: [{ id: 'read', tool: 'rf.read_clip', input: { clip: '$inputs.clip' } }],
      result: ['read'],
    },
    {
      id: 'rf.pick',
      title: 'Prep one client',
      promise: 'Starts from a business in your Pipeline.',
      minutes: 1,
      tier: 'free',
      job: 'sales',
      inputs: obj({ gym: { type: 'string', title: 'Which gym', options: 'pipeline' } }),
      steps: [{ id: 'find', tool: 'rf.find_lead', input: { gym: '$inputs.gym' } }],
      result: ['find'],
    },
  ],
};

let seq = 0;
async function member(tier = 'builder', extra = {}) {
  seq += 1;
  return db.save('users', { id: `h2u${seq}`, email: `h2m${seq}@127.test`, name: `Rae Okafor${seq}`, tier, emailVerified: true, answers: { model: 'service', channels: ['instagram'] }, ...extra });
}

function locals(user, req) {
  return {
    user, userPlan: user ? plan(user.tier) : null, isAdmin: harness.enabledFor(user) && process.env.ADMIN_EMAILS === (user && user.email), path: req.path, flash: null,
    builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
    launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
    fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null),
    plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path, baseUrl: 'https://127.test', adConsentScript: '', description: null,
    hqLive: hq.liveFor(user) || harness.enabledFor(user),
  };
}

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  const sessions = new Map();
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    const sid = req.get('x-user') || 'anon';
    if (!sessions.has(sid)) sessions.set(sid, {});
    req.session = sessions.get(sid);
    Object.assign(res.locals, locals(req.user, req));
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  const flash = (req, type, text) => flashes.push({ type, text });
  const isAdmin = (u) => !!u && process.env.ADMIN_EMAILS === u.email;
  app.use(harnessRoutes({ requireAuth, flash, track: () => {}, isAdmin }));
  app.use(hqRoutes({ requireAuth, flash, track: () => {}, reserveAi: () => true, refundAi: () => {}, ageFromAi: async () => false, aiRunsLeft: () => 10 }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
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
  engine._setDeps({ now: () => now });
  todayLib._setDeps({ now: () => now });
  packs.reset();
  const r = packs.registerAll([{ pack: RT, source: 'test' }, { pack: RF, source: 'test' }, { pack: hqPack, source: 'hq' }]);
  assert.deepEqual(r.refused, [], JSON.stringify(r.refused));
  for (const lib of [harness.pipeline, harness.activation, harness.wins, harness.monday]) lib._setDeps({ now: () => now });
  s = await server();
});
test.after(async () => {
  await s.close();
});
test.beforeEach(() => {
  now = T0;
  flashes = [];
  process.env.HARNESS_V2 = 'on';
  process.env.HQ_LIVE = 'true';
  delete process.env.ADMIN_EMAILS;
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

const html = async (res) => {
  const t = await res.text();
  assert.equal(res.status, 200, t.slice(0, 600));
  return t;
};
const where = (res) => res.headers.get('location');

test('HQ v2 off, or on for admins only: /app/hq stays v1', async () => {
  const u = await member();
  process.env.HARNESS_V2 = 'off';
  assert.match(await html(await s.go('/app/hq', { as: u })), /Save week/);
  assert.equal(await (await s.go('/app/hq/start', { as: u })).text(), 'app 404');
  process.env.HARNESS_V2 = 'admins';
  assert.match(await html(await s.go('/app/hq', { as: u })), /Save week/);
  process.env.ADMIN_EMAILS = u.email;
  assert.match(await html(await s.go('/app/hq', { as: u })), /Your move/);
});

test('Today: the one move, this week against last, the next price, and v1 numbers one tap away', async () => {
  const u = await member();
  const page = await html(await s.go('/app/hq', { as: u }));
  for (const bit of [/Your move/, /This week/, /Messages sent/, /Your next price/, /Picked for you/, /First gym clients/, /Tell 127 what you want done/, /127 did this for you/, /messages written/]) assert.match(page, bit);
  for (const banned of [/Rule of 100/i, /core four/i, /Hormozi/i, /hours saved/i, /Saves ~/]) assert.doesNotMatch(page, banned);
  assert.match(page, /href="\/app\/hq\?v1=1"/);
  assert.match(await html(await s.go('/app/hq?v1=1', { as: u })), /Save week/);
  assert.equal(where(await s.go('/app/hq')), '/login');
});

test('logging work done outside 127 counts taps, undoes, and refuses nonsense', async () => {
  const u = await member();
  let r = await s.go('/app/hq/actions', { as: u, json: { kind: 'cold', n: 10 } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).hundred.today, 10);
  r = await s.go('/app/hq/actions', { as: u, json: { kind: 'warm', n: 95 } });
  const h = (await r.json()).hundred;
  assert.equal(h.today, 105);
  assert.equal(h.done, true);
  r = await s.go('/app/hq/actions', { as: u, json: { kind: 'warm', n: -95 } });
  assert.equal((await r.json()).hundred.today, 10);
  assert.equal((await s.go('/app/hq/actions', { as: u, json: { kind: 'sleep', n: 1 } })).status, 400);
  assert.equal((await s.go('/app/hq/actions', { as: u, json: { kind: 'cold', n: 0 } })).status, 400);
  const page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, /data-count="cold">10</);
});

test('Talk to 127: go somewhere, log what you did, ask how it is going, or get a workflow', async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  let j = await (await s.go('/app/hq/talk', { as: u, json: { text: 'show me my pipeline' } })).json();
  assert.equal(j.kind, 'nav');
  assert.equal(j.nav, '/app/hq/pipeline');
  j = await (await s.go('/app/hq/talk', { as: u, json: { text: 'I sent 20 DMs today' } })).json();
  assert.equal(j.kind, 'log');
  assert.deepEqual(j.logged, { kind: 'cold', n: 20 });
  assert.equal(j.hundred.today, 20);
  j = await (await s.go('/app/hq/talk', { as: u, json: { text: 'how am I doing' } })).json();
  assert.equal(j.kind, 'status');
  assert.ok(j.move && j.move.href);
  j = await (await s.go('/app/hq/talk', { as: u, json: { text: 'find gym clients in Des Moines' } })).json();
  assert.equal(j.kind, 'workflow');
  assert.equal(j.pick.id, 'rt.flow');
  assert.equal(j.pick.inputs.city, 'Des Moines');
  assert.equal((await s.go('/app/hq/talk', { as: u, json: { text: '  ' } })).status, 400);
  // No JavaScript: the form posts and redirects.
  const r = await s.go('/app/hq/talk', { as: u, form: { text: 'find gym clients in Des Moines' } });
  assert.equal(r.status, 302);
  assert.equal(where(r), '/app/hq/w/rt.flow?in_city=Des+Moines');
});

test('Start groups workflows by job, bottleneck first; a workflow page shows the plan and prefills the form', async () => {
  const free = await member('free');
  const start = await html(await s.go('/app/hq/start', { as: free }));
  assert.match(start, /Find leads|leads/i);
  assert.match(start, /First gym clients/);
  assert.match(start, /Builder gym report/);
  const page = await html(await s.go('/app/hq/w/rt.flow?in_city=Ames', { as: free }));
  assert.match(page, /What happens/);
  assert.match(page, /Pick up to 2 gyms/);
  assert.match(page, /name="in_city" value="Ames"/);
  assert.match(page, /<span>Credits<\/span><b>About \d+<\/b>/);
  assert.doesNotMatch(page, /Saves you/);
  const locked = await html(await s.go('/app/hq/w/rt.paid', { as: free }));
  assert.match(locked, /Run it free|Part of Builder/);
  assert.equal(await (await s.go('/app/hq/w/rt.nope', { as: free })).text(), 'app 404');
});

test('a run: form to approval to a finished result with files, and nobody else can see it', async () => {
  const u = await member();
  const other = await member();
  let r = await s.go('/app/hq/w/rt.flow/run', { as: u, form: { in_city: 'Ames', sample: '1' } });
  assert.equal(r.status, 302);
  const runPath = where(r);
  assert.match(runPath, /^\/app\/hq\/runs\/[\w-]+$/);
  const id = runPath.split('/').pop();
  assert.equal(engine.get(u, id).sample, false, 'only admins start sample runs');
  await engine.idle();

  let page = await html(await s.go(runPath, { as: u }));
  assert.match(page, /Waiting on you/);
  assert.match(page, /Pick up to 2 gyms/);
  assert.match(page, /Iron Temple Ames/);
  assert.equal(await (await s.go(runPath, { as: other })).text(), 'app 404');
  assert.equal(await (await s.go(`/app/hq/runs/${id}/answer/pick`, { as: other, form: { chosen: '0' } })).text(), 'app 404');

  const v = await (await s.go(`${runPath}/view.json`, { as: u })).json();
  assert.equal(v.status, 'waiting');
  assert.equal(v.waiting, true);

  // The Inbox shows it and answering from there comes back to the Inbox.
  const inboxPage = await html(await s.go('/app/hq/inbox', { as: u }));
  assert.match(inboxPage, /Pick up to 2 gyms/);
  r = await s.go(`/app/hq/runs/${id}/answer/pick`, { as: u, form: [['chosen', '0'], ['chosen', '1'], ['chosen', '2'], ['back', '/app/hq/inbox']] });
  assert.equal(where(r), '/app/hq/inbox');
  assert.match(flashes.pop().text, /Pick up to 2/);
  r = await s.go(`/app/hq/runs/${id}/answer/pick`, { as: u, form: [['chosen', '0'], ['chosen', '2'], ['back', 'https://evil.test/']] });
  assert.equal(where(r), runPath, 'back only goes to HQ pages');
  await engine.idle();

  const run = engine.get(u, id);
  assert.equal(run.status, 'done', JSON.stringify(run.steps));
  page = await html(await s.go(runPath, { as: u }));
  assert.match(page, /What 127 made/);
  assert.match(page, /Iron Temple Ames/);
  assert.match(page, /Core Club Ames/);
  assert.match(page, /Sample data/, 'no AI key: the drafts are marked sample');
  assert.match(page, /Run it again/);

  // Files: owner only; HTML shows as text unless previewed, and a preview can't run scripts.
  const files = harness.library.list(u.id);
  const htmlFile = files.find((f) => f.type === 'text/html');
  const csv = files.find((f) => f.type === 'text/csv');
  assert.ok(htmlFile && csv);
  r = await s.go(htmlFile.url, { as: u });
  assert.equal(r.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(await r.text(), PAGE);
  r = await s.go(`${htmlFile.url}?preview=1`, { as: u });
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(r.headers.get('content-security-policy'), /sandbox/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.doesNotMatch(r.headers.get('content-security-policy'), /script-src/);
  r = await s.go(`${csv.url}?download=1`, { as: u });
  assert.match(r.headers.get('content-disposition'), /^attachment; filename="gyms.csv"/);
  assert.equal(await (await s.go(csv.url, { as: other })).text(), 'app 404');
  const lib = await html(await s.go('/app/hq/library', { as: u }));
  assert.match(lib, /landing.html/);
  assert.match(lib, /Preview/);

  // Runs list and stop/retry guards.
  assert.match(await html(await s.go('/app/hq/runs', { as: u })), /First gym clients/);
  r = await s.go(`/app/hq/runs/${id}/retry`, { as: u, form: {} });
  assert.equal(where(r), runPath);
  assert.match(flashes.pop().text, /Only a run that stopped on an error/);
});

test('admins can run with sample data and make the run the example on the workflow page', async () => {
  const admin = await member('builder');
  process.env.ADMIN_EMAILS = admin.email;
  let r = await s.go('/app/hq/w/rt.flow/run', { as: admin, form: { in_city: 'Ames', sample: '1' } });
  const id = where(r).split('/').pop();
  assert.equal(engine.get(admin, id).sample, true);
  await engine.idle();
  await engine.answer(admin, id, 'pick', { chosen: ['0'] });
  await engine.idle();
  assert.equal(engine.get(admin, id).status, 'done');
  r = await s.go(`/app/hq/runs/${id}/showcase`, { as: admin, form: {} });
  assert.equal(flashes.pop().type, 'win');
  delete process.env.ADMIN_EMAILS;
  const someone = await member('free');
  const page = await html(await s.go('/app/hq/w/rt.flow', { as: someone }));
  assert.match(page, /An example run/);
  // The example's files are public; everything else of the admin's stays private.
  const f = harness.library.list(admin.id, { runId: id }).find((x) => x.type === 'text/csv');
  assert.equal((await s.go(f.url, { as: someone })).status, 200);
});

test('the Pipeline moves leads forward and a first message counts toward today', async () => {
  const u = await member();
  const other = await member();
  const run = await engine.start(u, 'rt.flow', { city: 'Ames' });
  await engine.idle();
  let page = await html(await s.go('/app/hq/pipeline', { as: u }));
  assert.match(page, /Peak Fitness Ames/);
  const lead = harness.pipeline.list(u.id)[0];
  let r = await s.go(`/app/hq/pipeline/${lead.id}/move`, { as: u, json: { stage: 'contacted' } });
  const j = await r.json();
  assert.equal(j.lead.stage, 'contacted');
  assert.equal(j.counts.contacted, 1);
  assert.equal(j.hundred.today, 1);
  assert.equal(j.hundred.counts.cold, 1);
  assert.equal((await s.go(`/app/hq/pipeline/${lead.id}/move`, { as: other, json: { stage: 'won' } })).status, 404);
  assert.equal((await s.go(`/app/hq/pipeline/${lead.id}/move`, { as: u, json: { stage: 'married' } })).status, 400);
  r = await s.go(`/app/hq/pipeline/${lead.id}/move`, { as: u, form: { stage: 'replied', from: 'contacted' } });
  assert.equal(where(r), `/app/hq/pipeline?stage=contacted#${lead.id}`);
  page = await html(await s.go('/app/hq/pipeline?stage=replied', { as: u }));
  assert.match(page, new RegExp(lead.name));
  await engine.cancel(u, run.id);
  // Do my day puts the reply first: paste what they said and 127 drafts the answer.
  const today = await html(await s.go('/app/hq', { as: u }));
  assert.match(today, /Do my day/);
  assert.ok(today.indexOf('What did they say?') > 0 && today.indexOf('What did they say?') < today.indexOf('Write it for me'), 'the reply comes before new leads');
  assert.equal(todayLib.nextMove(u).kind, 'replied');
  assert.match(todayLib.nextMove(u).title, /1 person replied\. Answer first\./);
});

test('Your business saves what every workflow reads, and Set up follows it', async () => {
  const u = await member();
  let r = await s.go('/app/hq/brain', { as: u, form: { business_what: 'Strength coaching for busy dads', business_audience: 'Dads 30 to 45', business_city: 'Ames', links_website: 'javascript:alert(1)', links_booking: 'https://cal.com/rae', goal_daily: '50' } });
  assert.equal(where(r), '/app/hq/brain');
  const b = harness.brain.snapshot(u);
  assert.equal(b.business.what, 'Strength coaching for busy dads');
  assert.equal(b.links.website, undefined, 'only http(s) links or handles are kept');
  assert.equal(todayLib.target(u), 50);
  await s.go('/app/hq/brain', { as: u, form: { goal_daily: '5000' } });
  assert.equal(todayLib.target(u), 25, 'out of range goes back to the default, 25');
  assert.ok(harness.activation.state(u.id).a1, 'what they sell plus a city is the first activation step');
  const page = await html(await s.go('/app/hq/brain', { as: u }));
  assert.match(page, /Strength coaching for busy dads/);
  let setup = await html(await s.go('/app/hq/setup', { as: u }));
  assert.match(setup, /ManyChat on your Instagram/);
  assert.match(setup, /Connect Stripe/);
  assert.doesNotMatch(setup, /A booking link<\/b><span>[^<]*<\/span><\/div>\s*<a/, 'booking is done');
  process.env.HQ_LIVE = 'off';
  setup = await html(await s.go('/app/hq/setup', { as: u }));
  assert.doesNotMatch(setup, /Connect Stripe/, 'no connections page to send them to');
});

test('admin status is admins only', async () => {
  const u = await member();
  assert.equal(await (await s.go('/admin/harness', { as: u })).text(), 'app 404');
  process.env.ADMIN_EMAILS = u.email;
  const j = await (await s.go('/admin/harness', { as: u })).json();
  assert.equal(j.mode, 'on');
  assert.ok(j.packs.some((p) => p.id === 'rt'));
});

// ---------- Do my day, end to end ----------

const P = harness.pipeline;
const DAY = 864e5;
const IG = (h) => `https://www.instagram.com/${h}/`;
const json = async (res) => {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`Not JSON (${res.status}): ${t.slice(0, 300)}`);
  }
};

test('Do my day: the best sends first, already written, each opening the right app; a [placeholder] locks the button', async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  const other = await member();
  const iron = await P.upsert(u.id, 'test', {
    key: 'iron',
    name: 'Iron Temple',
    score: 90,
    channel: 'ig',
    facts: ['They post every day but have no Reels.'],
    links: { instagram: IG('irontemple'), email: 'hi@iron.test' },
    msg: { dm: 'Hi Iron Temple team, Rae here. Want a free Reel?', subject: 'A Reel for Iron Temple', email: 'Hi Iron Temple team,\n\nWant a free Reel?\n\nRae', follow1: 'Checking you saw my note.', follow2: 'Last note from me.' },
  });
  await P.upsert(u.id, 'test', { key: 'core', name: 'Core Club', score: 70, links: { instagram: IG('coreclub') }, msg: { dm: 'Hi Core Club, I am [your name] and I make videos.' } });
  await P.upsert(u.id, 'test', { key: 'peak', name: 'Peak Fitness', score: 50, links: { email: 'hi@peak.test' } });
  const page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, /Do my day, Rae/);
  assert.match(page, /Your 25 for today/);
  assert.match(page, /2 already written/);
  const at = (x) => page.indexOf(`<h3><span data-gname-to>${x}`);
  assert.ok(at('Iron Temple') > 0 && at('Iron Temple') < at('Core Club') && at('Core Club') < at('Peak Fitness'), 'best score first');
  assert.match(page, /href="https:\/\/ig\.me\/m\/irontemple"/);
  assert.match(page, /Copy and open Instagram/);
  assert.match(page, /data-way="email"[^>]*data-subject="A Reel for Iron Temple"/);
  assert.match(page, /class="btn off" data-go/, 'a [placeholder] locks the button');
  assert.match(page, /Fill in <b data-hole-text>\[your name\]<\/b>/);
  assert.match(page, /Write it for me<\/button><span class="h2-q-cost">About 6 credits/);
  assert.equal(await (await s.go(`/app/hq/queue/${iron.id}/sent`, { as: other, form: {} })).text(), 'app 404');
  const t = await json(await s.go('/app/hq/today.json', { as: u }));
  assert.deepEqual(t.queue.counts, { reply: 0, call: 0, follow: 0, new: 3 });
});

test('Sent counts toward today and dates the follow-ups (3 days, then 4, then none); Undo puts it back', async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  const iron = await P.upsert(u.id, 'test', { key: 'iron', name: 'Iron Temple', channel: 'ig', links: { instagram: IG('irontemple') }, msg: { dm: 'Hi Iron Temple team, want a free Reel?', follow1: 'Checking you saw my note.', follow2: 'Last note from me.' } });
  const sent = async () => json(await s.go(`/app/hq/queue/${iron.id}/sent`, { as: u, json: {} }));
  let j = await sent();
  assert.equal(j.lead.stage, 'contacted');
  assert.equal(j.lead.touches, 1);
  assert.equal(j.lead.nextAt, new Date(T0 + 3 * DAY).toISOString());
  assert.equal(j.hundred.today, 1);
  assert.equal(j.hundred.counts.cold, 1);
  assert.equal(j.undo, true);
  assert.ok(harness.activation.state(u.id).a3, 'the first send');

  j = await json(await s.go(`/app/hq/queue/${iron.id}/undo`, { as: u, json: {} }));
  assert.equal(j.lead.stage, 'found');
  assert.equal(j.lead.touches, 0);
  assert.equal(j.lead.nextAt, null);
  assert.equal(j.hundred.today, 0);
  assert.equal(P.get(u.id, iron.id).history.length, 1, 'contacted is gone from its history');
  assert.equal((await s.go(`/app/hq/queue/${iron.id}/undo`, { as: u, json: {} })).status, 409, 'one undo per send');

  // No JavaScript: the form posts and comes back to Do my day.
  const r = await s.go(`/app/hq/queue/${iron.id}/sent`, { as: u, form: {} });
  assert.equal(where(r), '/app/hq#day');
  assert.equal(todayLib.queue(u).items.length, 0, 'nothing due until the follow-up');

  now = T0 + 3 * DAY;
  let q = todayLib.queue(u);
  assert.equal(q.items[0].kind, 'follow');
  assert.equal(q.items[0].text, 'Checking you saw my note.');
  assert.match(q.items[0].why, /^Follow-up 1 of 2\./);
  j = await sent();
  assert.equal(j.lead.touches, 2);
  assert.equal(j.lead.nextAt, new Date(now + 4 * DAY).toISOString());
  assert.equal(j.hundred.today, 1, 'a follow-up counts too');

  now += 4 * DAY;
  q = todayLib.queue(u);
  assert.equal(q.items[0].text, 'Last note from me.');
  assert.match(q.items[0].why, /^Follow-up 2 of 2\./);
  j = await sent();
  assert.equal(j.lead.touches, 3);
  assert.equal(j.lead.nextAt, null);
  now += 30 * DAY;
  assert.equal(todayLib.queue(u).items.length, 0, 'no third follow-up');
});

test('Not today brings a lead back tomorrow; Not interested takes it out', async () => {
  const u = await member();
  const a = await P.upsert(u.id, 'test', { key: 'a', name: 'Alpha Gym', links: { email: 'a@a.test' }, msg: { email: 'Hi Alpha.' } });
  const b = await P.upsert(u.id, 'test', { key: 'b', name: 'Bravo Gym', links: { email: 'b@b.test' }, msg: { email: 'Hi Bravo.' } });
  let j = await json(await s.go(`/app/hq/queue/${a.id}/skip`, { as: u, json: {} }));
  assert.ok(j.lead.snoozeUntil);
  assert.deepEqual(todayLib.queue(u).items.map((i) => i.name), ['Bravo Gym']);
  j = await json(await s.go(`/app/hq/queue/${b.id}/lost`, { as: u, json: {} }));
  assert.equal(j.lead.stage, 'lost');
  assert.equal(j.counts.lost, 1);
  now = T0 + DAY;
  assert.deepEqual(todayLib.queue(u).items.map((i) => i.name), ['Alpha Gym']);
});

test('Write it for me, an answer to a reply, call prep and a yes, each from the lead in the queue', async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  await harness.brain.update(u, { business: { what: 'Short videos for gyms', city: 'Ames', price: '$500/mo', audience: 'gyms' }, links: { booking: 'https://cal.com/rae' } });
  const l = await P.upsert(u.id, 'test', { key: 'iron', name: 'Iron Temple', facts: ['They post every day but have no Reels.'], links: { instagram: IG('irontemple'), email: 'hi@iron.test' } });

  // Write it for me: with no AI key it's an honest template, free, and marked sample.
  let j = await json(await s.go(`/app/hq/queue/${l.id}/write`, { as: u, json: {} }));
  assert.ok(j.run, JSON.stringify(j));
  assert.equal(j.credits, 6);
  await engine.idle();
  assert.equal(engine.get(u, j.run).status, 'done');
  assert.equal(engine.get(u, j.run).workflowId, 'hq.message');
  let lead = P.get(u.id, l.id);
  assert.match(lead.msg.dm, /^Hi Iron Temple team\. I'm Rae, and I do short videos for gyms\. I noticed you post every day but have no Reels\./);
  // The email ends with who it's from, the mailing address (a placeholder until it's saved) and a way to say no.
  assert.match(lead.msg.email, /Want me to send it\?\n\nRae\n\[Your business address, required in marketing email\]\n\nNot interested\? Reply "no thanks" and I won't email again\.$/);
  assert.equal(harness.ledger.usage(u).used, 0, 'a sample answer costs no credits');
  let page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, /I noticed you post every day but have no Reels\./);
  assert.match(page, /href="https:\/\/ig\.me\/m\/irontemple"/);
  await s.go(`/app/hq/queue/${l.id}/sent`, { as: u, form: {} });

  // They replied: paste it, 127 drafts the answer with the booking link.
  j = await json(await s.go(`/app/hq/queue/${l.id}/replied`, { as: u, json: { text: 'How much is it?' } }));
  assert.equal(j.lead.stage, 'replied');
  assert.ok(j.run);
  await engine.idle();
  lead = P.get(u.id, l.id);
  assert.equal(lead.reply, 'How much is it?');
  assert.match(lead.msg.answer, /10-minute call/);
  assert.match(lead.msg.answer, /https:\/\/cal\.com\/rae/);
  assert.ok(harness.activation.state(u.id).a4, 'the first reply');
  page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, /Sent my answer/);
  assert.match(page, /Replied just now\. Answer while it&#39;s warm\./);

  // Answered two hours later: that's the answer time on the scoreboard.
  now += 2 * 36e5;
  j = await json(await s.go(`/app/hq/queue/${l.id}/sent`, { as: u, json: {} }));
  assert.equal(j.lead.stage, 'replied');
  assert.equal(j.lead.answeredAt, new Date(now).toISOString());
  const sc = todayLib.scoreboard(u);
  assert.equal(sc.this.answerHours, 2);
  assert.equal(sc.this.replies, 1);
  assert.equal(todayLib.queue(u).items.length, 0, 'answered: off the queue');

  // A call: prep it (a one-page file in the Library), then the yes.
  j = await json(await s.go(`/app/hq/queue/${l.id}/booked`, { as: u, json: {} }));
  assert.equal(j.lead.stage, 'call');
  page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, /Prep the call<\/button><span class="h2-q-cost">About 12 credits/);
  j = await json(await s.go(`/app/hq/queue/${l.id}/write`, { as: u, json: {} }));
  await engine.idle();
  const prep = engine.get(u, j.run);
  assert.equal(prep.workflowId, 'hq.call_prep');
  assert.equal(prep.status, 'done');
  const file = harness.library.list(u.id).find((f) => f.name === 'Call prep - Iron Temple.md');
  assert.ok(file, 'the call prep page is in the Library');
  const md = (await harness.library.read(u.id, file.id)).buf.toString('utf8');
  assert.match(md, /## Ask/);
  assert.match(md, /Every month, handled \(\$500\/mo\)/);
  page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, new RegExp(`href="/app/hq/runs/${prep.id}">Open your call prep`));

  j = await json(await s.go(`/app/hq/queue/${l.id}/won`, { as: u, json: {} }));
  assert.equal(j.lead.stage, 'won');
  assert.equal(j.win, `/app/hq/win?lead=${l.id}`);
  page = await html(await s.go(j.win, { as: u }));
  assert.match(page, /Iron Temple/);
  assert.match(page, /No amounts\. 127 never asks for or shows money\./);
  assert.ok(harness.activation.state(u.id).a5, 'the first win');

  // The page reached through a run for a hidden workflow goes back to Do my day.
  assert.match(await html(await s.go(`/app/hq/runs/${prep.id}`, { as: u })), /Back to Do my day/);
});

test('every email Do my day hands out says who it is from, a mailing address and how to say no; DMs and calls carry none of it', async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  await harness.brain.update(u, { business: { name: 'Lift Studio' } });
  const ADDR = todayLib.ADDRESS_LINE;
  const BOX = 'PO Box 9, Des Moines, IA 50309';
  const NO = 'Not interested? Reply "no thanks" and I won\'t email again.';
  const way = (it, id) => it.ways.find((w) => w.id === id);
  const item = (name) => todayLib.queue(u).items.find((i) => i.name === name);
  // A pack that writes its emails and follow-ups with no footer.
  const a = await P.upsert(u.id, 'test', { key: 'a', name: 'Alpha Gym', score: 90, links: { email: 'hi@alpha.test' }, msg: { subject: 'A Reel for Alpha Gym', email: 'Hi Alpha Gym team,\n\nWant a free Reel?\n\nRae', follow1: 'Checking you saw my note.', follow2: 'Last note from me.' } });
  // The gym pack: Instagram first, and its emails already end with the footer.
  const foot = `\n\nRae\nLift Studio\n${ADDR}\n\n${NO}`;
  const b = await P.upsert(u.id, 'test', { key: 'b', name: 'Bravo Gym', score: 80, channel: 'ig', links: { instagram: IG('bravogym'), email: 'hi@bravo.test', phone: '+1 515 555 0100' }, msg: { dm: 'Hi Bravo Gym team, want a free Reel?', subject: 'A Reel for Bravo Gym', email: `Hi Bravo Gym team,\n\nWant a free Reel?${foot}`, walkin: 'Hi, I am Rae.', follow1: `Checking in.${foot}`, follow2: `Last note.${foot}` } });
  // A First 25 list: its own placeholder and opt-out.
  const c = await P.upsert(u.id, 'test', { key: 'c', name: 'Charlie Gym', score: 70, links: { email: 'hi@charlie.test' }, msg: { email: 'Hi Charlie Gym team,\n\nAn idea.\n\nRae\n[your mailing address]\n\nP.S. Not for you? Reply "no thanks" and I won\'t follow up.' } });

  let A = item('Alpha Gym');
  assert.equal(way(A, 'email').text, `Hi Alpha Gym team,\n\nWant a free Reel?${foot}`);
  assert.equal(A.hole, ADDR, 'the address placeholder keeps the button off');
  assert.equal(A.holeHelp, ADDR);
  let B = item('Bravo Gym');
  assert.equal(way(B, 'ig').text, 'Hi Bravo Gym team, want a free Reel?');
  assert.equal(way(B, 'email').text, `Hi Bravo Gym team,\n\nWant a free Reel?${foot}`, "the pack's own footer stays as it is");
  assert.equal(B.hole, '', 'Instagram first: nothing to fill in');
  assert.equal(B.holeHelp, ADDR, 'switching to Email shows where to save the address');
  assert.equal(way(item('Charlie Gym'), 'email').text, `Hi Charlie Gym team,\n\nAn idea.\n\nRae\n${ADDR}\n\nP.S. Not for you? Reply "no thanks" and I won't follow up.`, "First 25's placeholder reads as HQ's");
  let page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, /<a href="\/app\/hq\/brain#business_address">Save your mailing address once<\/a> and every email gets it\./);
  assert.match(await html(await s.go('/app/hq/brain', { as: u })), /id="business_address" name="business_address"/);

  // Saved once in Your business, it's in every email and the button works.
  assert.equal(where(await s.go('/app/hq/brain', { as: u, form: { business_address: BOX } })), '/app/hq/brain');
  assert.equal(harness.brain.snapshot(u).business.name, 'Lift Studio', 'the other fields stay');
  const sent = `\n\nRae\nLift Studio\n${BOX}\n\n${NO}`;
  A = item('Alpha Gym');
  assert.equal(way(A, 'email').text, `Hi Alpha Gym team,\n\nWant a free Reel?${sent}`);
  assert.equal(A.hole, '');
  assert.match(way(A, 'email').href, /&body=Hi%20Alpha%20Gym%20team.*PO%20Box%209/);
  B = item('Bravo Gym');
  assert.equal(way(B, 'email').text, `Hi Bravo Gym team,\n\nWant a free Reel?${sent}`);
  assert.equal(way(B, 'call').text, 'Hi, I am Rae.');
  const C = item('Charlie Gym');
  assert.match(way(C, 'email').text, new RegExp(`\\nRae\\n${BOX}\\n\\nP\\.S\\. Not for you`));
  page = await html(await s.go('/app/hq', { as: u }));
  assert.doesNotMatch(page, /Save your mailing address once/);

  // Follow-ups: by email with the footer, as a DM or a call without it.
  for (const l of [a, b]) await s.go(`/app/hq/queue/${l.id}/sent`, { as: u, json: {} });
  now += 3 * 864e5;
  B = item('Bravo Gym');
  assert.equal(B.kind, 'follow');
  assert.equal(way(B, 'ig').text, 'Checking in.');
  assert.equal(way(B, 'call').text, 'Checking in.');
  assert.equal(way(B, 'email').subject, 'Re: A Reel for Bravo Gym');
  assert.equal(way(B, 'email').text, `Checking in.${sent}`);
  assert.equal(way(item('Alpha Gym'), 'email').text, `Checking you saw my note.${sent}`);

  // An answer to a reply, by email, too.
  await P.update(u.id, a.id, { msg: { answer: 'Happy to. A 10-minute call is easiest.\n\nRae' } });
  await P.move(u.id, a.id, 'replied');
  A = item('Alpha Gym');
  assert.equal(A.kind, 'reply');
  assert.equal(way(A, 'email').text, `Happy to. A 10-minute call is easiest.${sent}`);

  // Monday's card keeps the placeholder on the lead, so a changed address reaches every unsent email.
  const save = hqPack.tools.find((t) => t.name === 'hq.save_week');
  const ctx = { member: { id: u.id, firstName: 'Rae' }, brain: harness.brain.snapshot(u), leads: { update: async (id, patch) => P.update(u.id, id, patch) } };
  await save.run({ id: c.id, key: 'email', text: way(C, 'email').text, week: '2026-11-02' }, ctx);
  assert.match(P.get(u.id, c.id).msg.email, /\nRae\n\[Your business address, required in marketing email\]\n\nP\.S\./);
  assert.doesNotMatch(P.get(u.id, c.id).msg.email, /PO Box/);
});

test('a win: the card, its consent record, the Circle once ever, and only shared wins reach the proof library', async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  const other = await member();
  const l = await P.upsert(u.id, 'test', { key: 'iron', name: 'Iron Temple', links: { email: 'hi@iron.test' } });
  await P.move(u.id, l.id, 'won');
  assert.equal(where(await s.go('/app/hq/win', { as: u, form: { lead: l.id, kind: 'money', consent: 'first' } })), `/app/hq/win?lead=${l.id}`);
  assert.match(flashes.pop().text, /Pick what happened/);
  let r = await s.go('/app/hq/win', { as: u, form: { lead: l.id, kind: 'yes', note: 'Iron Temple wants 4 Reels a month.', consent: 'first' } });
  const winPath = where(r);
  assert.match(winPath, /^\/app\/hq\/win\/[\w-]+$/);
  const id = winPath.split('/').pop();
  let page = await html(await s.go(winPath, { as: u }));
  assert.match(page, /First yes\./);
  assert.match(page, /data-wincard/);
  assert.match(page, /Want Eli in your corner/);
  assert.match(page, /Apply for a seat/);
  assert.match(page, /You agreed to: "127 may share this win with my first name only\." on /);
  page = await html(await s.go(winPath, { as: u }));
  assert.doesNotMatch(page, /Want Eli in your corner/, 'the Circle shows once, ever');
  assert.equal(await (await s.go(winPath, { as: other })).text(), 'app 404');

  // A private win stays out of the proof library; changing consent keeps the record of both.
  await s.go('/app/hq/win', { as: u, form: { kind: 'talk', consent: 'private' } });
  r = await s.go(`/app/hq/win/${id}/consent`, { as: u, form: { consent: 'public' } });
  assert.equal(where(r), winPath);
  const w = harness.wins.get(u.id, id);
  assert.deepEqual(w.consentLog.map((x) => x.consent), ['first', 'public']);
  assert.equal(await (await s.go('/admin/harness/proof', { as: u })).text(), 'app 404');
  process.env.ADMIN_EMAILS = u.email;
  const proof = (await json(await s.go('/admin/harness/proof', { as: u }))).proof.filter((x) => x.id === id || x.kind === 'talk');
  assert.equal(proof.length, 1, 'only the shared win');
  assert.equal(proof[0].name, 'Rae');
  assert.equal(proof[0].consentText, '127 may share this win with my name and my business name.');
  delete process.env.ADMIN_EMAILS;

  r = await s.go(`/app/hq/win/${id}/delete`, { as: u, form: {} });
  assert.equal(where(r), '/app/hq/win');
  assert.equal(harness.wins.get(u.id, id), null);
});

test('a Free member out of credits sees the founding offer, and a small hidden workflow never spends the free run', async () => {
  const free = await member('free');
  const l = await P.upsert(free.id, 'test', { key: 'x', name: 'Xeno Gym', links: { email: 'x@x.test' } });
  process.env.HARNESS_CREDITS_FREE = '5';
  try {
    const r = await s.go(`/app/hq/queue/${l.id}/write`, { as: free, json: {} });
    assert.equal(r.status, 402);
    const j = await r.json();
    assert.equal(j.upgrade, true);
    assert.match(j.error, /about 6 credits/);
    assert.equal(harness.ledger.freeRunAvailable(free), true, 'the free run waits for a whole workflow');
    const page = await html(await s.go('/app/hq', { as: free }));
    assert.match(page, /data-upgrade="credits"/);
    assert.match(page, /You've used this month's free credits\./);
  } finally {
    delete process.env.HARNESS_CREDITS_FREE;
  }
});

// Two business types (contract v1.4 `business: true`) next to the tool packs above.
const bizPack = (id, title, niches) => ({
  id,
  title,
  version: '1.0.0',
  business: true,
  summary: `Start ${title.toLowerCase()} with your first 25.`,
  niches,
  tools: [{ name: `${id}.note`, title: 'Write a note', description: 'Writes one line.', kind: 'code', risk: 'read', credits: 0, input: obj({}, []), output: obj({ text: { type: 'string' } }), run: async () => ({ text: 'ok' }) }],
  workflows: [
    { id: `${id}.first_25`, title: 'Your first 25', promise: `Twenty-five people who might want ${title.toLowerCase()}.`, minutes: 3, tier: 'free', job: 'leads', inputs: obj({}, []), steps: [{ id: 'n', tool: `${id}.note` }], result: ['n'] },
    { id: `${id}.offer`, title: `Your ${title.toLowerCase()} offer`, promise: 'The offer and its price.', minutes: 1, tier: 'free', job: 'offer', inputs: obj({}, []), steps: [{ id: 'n', tool: `${id}.note` }], result: ['n'] },
  ],
});
function unregister(ids) {
  for (const id of ids) {
    packs.registry.packs.delete(id);
    for (const [name, t] of packs.registry.tools) if (t.pack === id) packs.registry.tools.delete(name);
    for (const [wid, wf] of packs.registry.workflows) if (wf.pack === id) packs.registry.workflows.delete(wid);
  }
}

test('Start with business types: pick one first, then your business leads and the others fold; search still finds them', async () => {
  const r = packs.registerAll([{ pack: bizPack('tclean', 'House cleaning', ['cleaning', 'house cleaning']), source: 'test' }, { pack: bizPack('twalk', 'Dog walking', ['dog walking', 'pet sitting']), source: 'test' }]);
  assert.deepEqual(r.refused, [], JSON.stringify(r.refused));
  try {
    // No business yet (their onboarding category names none): picking one comes before the tools.
    const fresh = await member();
    let page = await html(await s.go('/app/hq/start', { as: fresh }));
    assert.doesNotMatch(page, /id="mine"/);
    assert.ok(page.indexOf('Pick a business') > 0 && page.indexOf('Pick a business') < page.indexOf('id="leads"'), 'Pick a business comes before the job groups');
    assert.match(page, /<details class="h2-type" id="type-tclean">/);
    assert.match(page, /<details class="h2-type" id="type-twalk">[\s\S]*?href="\/app\/hq\/w\/twalk\.first_25"[\s\S]*?<\/details>/, 'its workflows sit inside, for the search');
    const groups = page.slice(page.indexOf('id="leads"'));
    assert.match(groups, /First gym clients/);
    assert.doesNotMatch(groups.slice(0, groups.indexOf('</section>')), /Your first 25/, 'no business type in the job groups');
    assert.equal(harness.businessTypes(fresh).filter((t) => t.mine).length, 0);
    let move = harness.today(fresh).move;
    assert.equal(move.kind, 'pick');
    assert.equal(move.href, '/app/hq/start#types');
    assert.match(harness.todayLib.say(fresh, harness.moveDeps), /Next: Pick your business\./);

    // Their own words fit one: it leads, in its own order, and the other folds at the end.
    const cleaner = await member();
    await harness.brain.update(cleaner, { business: { what: 'I clean houses in Ames' } });
    page = await html(await s.go('/app/hq/start', { as: cleaner }));
    assert.match(page, /<span class="eyebrow">Your business<\/span><h2 class="h2-h" id="g-mine">House cleaning<\/h2>/);
    assert.match(page, /Your business comes first/);
    const mine = page.slice(page.indexOf('id="mine"'), page.indexOf('</section>', page.indexOf('id="mine"')));
    assert.ok(mine.indexOf('tclean.first_25') > 0 && mine.indexOf('tclean.first_25') < mine.indexOf('tclean.offer'), 'the pack order');
    assert.doesNotMatch(mine, /twalk/);
    assert.match(mine, /<span class="h2-tag">2 steps<\/span>/);
    assert.match(mine, /<ol class="h2-path">[\s\S]*?<span class="h2-num next" aria-hidden="true">1<\/span>[\s\S]*?Your first 25[\s\S]*?<span class="h2-num" aria-hidden="true">2<\/span>/, 'one numbered path, step 1 next');
    // A finished run checks its step off and the next one left is marked; an admin's sample run counts for nothing.
    await db.save('runs', { id: db.id(), memberId: cleaner.id, workflowId: 'tclean.first_25', title: 'Your first 25', status: 'done', createdAt: new Date().toISOString() });
    await db.save('runs', { id: db.id(), memberId: cleaner.id, workflowId: 'tclean.offer', title: 'Your offer', status: 'done', sample: true, createdAt: new Date().toISOString() });
    page = await html(await s.go('/app/hq/start', { as: cleaner }));
    const done = page.slice(page.indexOf('id="mine"'), page.indexOf('</section>', page.indexOf('id="mine"')));
    assert.match(done, /<span class="h2-tag win">1 of 2 done<\/span>/);
    assert.match(done, /<span class="h2-num done" aria-hidden="true"><\/span>[\s\S]*?<span class="win">Done<\/span>[\s\S]*?<span class="h2-num next" aria-hidden="true">2<\/span>[\s\S]*?Next: <\/span>Your house cleaning offer/);
    assert.match(await html(await s.go('/app/hq/w/tclean.offer', { as: cleaner })), /<span class="eyebrow">House cleaning &middot; Step 2 of 2<\/span>/, "a business's workflow page says which step it is");
    assert.match(await html(await s.go('/app/hq/w/rt.flow', { as: cleaner })), /<span class="eyebrow">[^<&]*<\/span>/, 'a tool says no step');
    assert.ok(page.indexOf('Start a different business') > page.indexOf('id="leads"'), 'the others fold at the end');
    assert.doesNotMatch(page, /id="type-tclean"/);
    assert.doesNotMatch(page, /Pick a business</);
    const list = harness.catalog(cleaner);
    assert.ok(list.findIndex((w) => w.id === 'tclean.first_25') < list.findIndex((w) => w.id === 'rt.flow'), 'their business before the tools');
    assert.ok(list.findIndex((w) => w.id === 'twalk.first_25') > list.findIndex((w) => w.id === 'rf.pick'), "another business's workflows last");
    assert.equal((await harness.ask(cleaner, 'dog walking first 25')).pick.id, 'twalk.first_25', 'the Ask bar still finds them');
    const listed = (await require('../lib/harness/mcp').call(cleaner, 'list_workflows', {})).content[0].text;
    assert.ok(listed.indexOf('tclean.first_25') < listed.indexOf('rt.flow') && listed.indexOf('rt.flow') < listed.indexOf('twalk.first_25'), "the AI link's list goes in Start's order");
    move = harness.today(cleaner).move;
    assert.equal(move.kind, 'leads');
    assert.equal(move.href, '/app/hq/w/tclean.first_25', "Today's first 25 is their business's");

    // Picking one makes it theirs, over their words; a tool pack or nonsense changes nothing.
    let res = await s.go('/app/hq/start/business', { as: cleaner, form: { pack: 'twalk' } });
    assert.equal(where(res), '/app/hq/start#mine');
    assert.equal(harness.brain.snapshot(cleaner).business.niche, 'Dog walking');
    assert.ok(flashes.some((f) => f.text === 'Dog walking is your business now. Its workflows come first.'));
    page = await html(await s.go('/app/hq/start', { as: cleaner }));
    assert.match(page, /id="g-mine">Dog walking</);
    assert.match(page, /id="type-tclean"/);
    for (const pack of ['rt', 'nope', '']) {
      res = await s.go('/app/hq/start/business', { as: cleaner, form: { pack } });
      assert.equal(where(res), '/app/hq/start');
    }
    assert.equal(harness.brain.snapshot(cleaner).business.niche, 'Dog walking');
    assert.equal((await s.go('/app/hq/start/business', { form: { pack: 'tclean' } })).status, 404, 'signed out: HQ v2 is off');
  } finally {
    unregister(['tclean', 'twalk']);
  }
});

test("the queue's own workflows stay off Start, their pages and the AI link's list", async () => {
  const u = await member();
  const start = await html(await s.go('/app/hq/start', { as: u }));
  assert.doesNotMatch(start, /Write the messages|Prep the call|Answer a reply/);
  for (const id of ['hq.message', 'hq.reply', 'hq.call_prep', 'hq.week']) assert.equal(await (await s.go(`/app/hq/w/${id}`, { as: u })).text(), 'app 404', id);
  const list = (await require('../lib/harness/mcp').call(u, 'list_workflows', {})).content[0].text;
  assert.match(list, /rt\.flow/);
  assert.doesNotMatch(list, /hq\.(message|reply|call_prep|week)/);
});

// ---------- First 25 lists ----------

const F25_VIEW = {
  id: 'f25run1',
  pack: 'video',
  buyer: 'gyms',
  place: 'Ames, IA',
  city: 'Ames',
  source: 'osm',
  sample: false,
  status: { 2: { s: 'contacted', at: '2026-11-03T15:00:00.000Z' } },
  prospects: [
    {
      rank: 1,
      name: 'Iron Temple',
      score: 88,
      website: 'https://irontemple.test',
      instagram: 'irontemple',
      phone: '+1 515 555 0101',
      email: null,
      site: { socials: { instagram: 'irontemple' } },
      gaps: [{ why: 'They post every day but have no Reels.' }],
      msg: { dm: 'Hi Iron Temple team, Rae here. Want a free Reel?', subject: 'A Reel for Iron Temple', email: 'Hi Iron Temple team.\n\nNot for you? Reply "no thanks" and I won\'t follow up.', walkin: 'Hi, I am Rae.', follow1: 'Checking in.', follow2: 'Last note.' },
    },
    { rank: 2, name: 'Peak Fitness', score: 70, website: null, instagram: null, email: 'hi@peak.test', site: { socials: {} }, gaps: [], msg: { dm: 'Hi Peak.', subject: 'Hi', email: 'Hi Peak team.', follow1: 'Again.', follow2: 'Last.' } },
  ],
};
const F25_DATA = { packs: { video: { label: 'Short videos' } }, buyers: { gyms: { many: 'gyms' } } };

test('a First 25 link brings the list into the Pipeline with its messages written, once', async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  imports._setDeps({
    first25: () => ({ signed: (id, k) => id === 'f25run1' && k === 'good', view: () => JSON.parse(JSON.stringify(F25_VIEW)) }),
    first25Data: () => F25_DATA,
    db: { get: (col, id) => (col === 'prospectRuns' && id === 'f25run1' ? { id } : null) },
  });
  try {
    let r = await s.go('/app/hq/import/first25/f25run1?k=bad', { as: u });
    assert.equal(where(r), '/app/hq');
    assert.match(flashes.pop().text, /expired/);
    const page = await html(await s.go('/app/hq/import/first25/f25run1?k=good', { as: u }));
    assert.match(page, /Work your 2 in HQ/);
    assert.match(page, /in Ames, IA/);
    r = await s.go('/app/hq/import/first25/f25run1', { as: u, form: { k: 'good' } });
    assert.equal(where(r), '/app/hq#day');
    assert.match(flashes.pop().text, /^2 businesses are in your Pipeline/);
    const leads = P.list(u.id);
    const iron = leads.find((x) => x.name === 'Iron Temple');
    const peak = leads.find((x) => x.name === 'Peak Fitness');
    assert.equal(iron.stage, 'found');
    assert.equal(iron.channel, 'ig', 'a video seller starts on Instagram');
    assert.equal(iron.links.phone, '+1 515 555 0101');
    assert.deepEqual(iron.facts, ['They post every day but have no Reels.']);
    assert.match(iron.msg.dm, /Want a free Reel/);
    assert.equal(peak.stage, 'contacted', 'the tracker said sent');
    assert.equal(peak.touches, 1);
    assert.equal(peak.nextAt, '2026-11-06T15:00:00.000Z', 'its follow-up is dated from when they sent it');
    assert.equal(todayLib.hundred(u).today, 0, 'sends from before today do not count today');
    const b = harness.brain.snapshot(u).business;
    assert.deepEqual([b.city, b.what, b.audience], ['Ames', 'Short videos', 'gyms']);
    const act = harness.activation.state(u.id);
    assert.ok(act.a1 && act.a2);
    assert.equal(imports.first25Leads({ ...F25_VIEW, source: 'google' })[0].links.phone, null, "Google lists leave out Google's phone");

    await s.go('/app/hq/import/first25/f25run1', { as: u, form: { k: 'good' } });
    assert.match(flashes.pop().text, /already in your Pipeline/);
    assert.equal(P.list(u.id).length, 2);
  } finally {
    imports._setDeps({ db, first25: () => require('../lib/first25'), first25Data: () => require('../public/funnels/first25-data.js') });
  }
});

test("the member's own First 25 list, found by their email, comes in with one tap from Today", async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  const rows = [
    { key: 'first25:p1', name: '', company: 'Iron Temple', source: 'first-25', stage: 'found', links: { website: 'https://irontemple.test', instagram: 'irontemple' }, note: 'No Reels', data: { list: 'L1', rank: 1, score: 88, city: 'Ames', pack: 'video', buyer: 'gyms', sample: false, gaps: [{ why: 'They post every day but have no Reels.' }], messages: { dm: 'Hi Iron Temple.', subject: 'Hi', email: 'Hi.', walkin: 'Hi.', day3: 'Checking in.', day7: 'Last note.' } } },
    { key: 'first25:p2', name: '', company: 'Peak Fitness', source: 'first-25', stage: 'found', links: { website: 'https://peak.test' }, data: { list: 'L1', rank: 2, score: 60, city: 'Ames', pack: 'video', buyer: 'gyms', gaps: ['Their site has no booking button.'], messages: { email: 'Hi Peak.', day3: 'Again.' } } },
  ];
  imports._setDeps({ first25: () => ({ leadsFor: async (email) => (email === u.email ? JSON.parse(JSON.stringify(rows)) : []) }), first25Data: () => F25_DATA });
  try {
    let page = await html(await s.go('/app/hq', { as: u }));
    assert.match(page, /Bring in your 2 businesses in Ames/);
    let r = await s.go('/app/hq/import/first25-mine', { as: u, form: {} });
    assert.equal(where(r), '/app/hq#day');
    assert.match(flashes.pop().text, /^2 businesses are in your Pipeline/);
    const iron = P.list(u.id).find((x) => x.name === 'Iron Temple');
    assert.equal(iron.msg.follow1, 'Checking in.');
    assert.equal(iron.msg.follow2, 'Last note.');
    assert.equal(iron.links.instagram, 'https://www.instagram.com/irontemple');
    assert.deepEqual(P.list(u.id).find((x) => x.name === 'Peak Fitness').facts, ['Their site has no booking button.']);
    // The same business from the emailed link is the same lead.
    assert.equal(iron.key, imports.first25Leads(F25_VIEW)[0].key);
    page = await html(await s.go('/app/hq', { as: u }));
    assert.doesNotMatch(page, /Bring in your/, 'nothing new to bring in');

    // Sample lists are never offered, and Not now hides the card.
    const v = await member('builder');
    rows.forEach((x) => (x.data.sample = true));
    imports._setDeps({ first25: () => ({ leadsFor: async () => JSON.parse(JSON.stringify(rows)) }) });
    assert.doesNotMatch(await html(await s.go('/app/hq', { as: v })), /Bring in your/);
    rows.forEach((x) => (x.data.sample = false));
    assert.match(await html(await s.go('/app/hq', { as: v })), /Bring in your 2 businesses/);
    r = await s.go('/app/hq/import/first25-mine/hide', { as: v, form: {} });
    assert.equal(where(r), '/app/hq');
    assert.doesNotMatch(await html(await s.go('/app/hq', { as: v })), /Bring in your/);
  } finally {
    imports._setDeps({ first25: () => require('../lib/first25'), first25Data: () => require('../public/funnels/first25-data.js') });
  }
});

test('Google businesses (Legal L53): the Pipeline keeps the place ID and 127\'s own work; names come from Google Maps when shown', async () => {
  const places = require('../lib/harness/places');
  const u = await member('builder', { name: 'Rae Okafor' });
  await harness.brain.update(u, { business: { what: 'Short videos for gyms', city: 'Ames', audience: 'gyms' } });
  const PID = 'ChIJirontempleAmes01';
  // A row from a First 25 Google list: no company, the place ID in data, messages with the placeholder.
  const rows = [{ key: 'first25:g1', name: '', company: '', source: 'first-25', stage: 'found', links: { website: 'https://google-gave-this.test', instagram: 'irontemple', map: 'https://maps.google.com/?cid=1', phone: '515-555-0100' }, data: { list: 'L9', rank: 1, score: 90, city: 'Ames', pack: 'video', buyer: 'gyms', sample: false, place_id: PID, gaps: ['no-reels'], messages: { dm: 'Hi [business name], I make short videos for gyms.', email: 'Hi [business name] team.', day3: 'Checking in.' } } }];
  imports._setDeps({ first25: () => ({ leadsFor: async () => JSON.parse(JSON.stringify(rows)) }), first25Data: () => F25_DATA });
  const calls = [];
  const names = { [PID]: 'Iron Temple', ChIJpeakfitnessAmes2: 'Peak Fitness' };
  places._setDeps({ fetch: async (url, opts) => {
    const id = decodeURIComponent(url.split('/v1/places/')[1].split('?')[0]);
    calls.push({ id, mask: opts.headers['x-goog-fieldmask'] });
    return { ok: true, json: async () => ({ id, displayName: { text: names[id] }, attributions: [] }) };
  } });
  process.env.PLACES_API_KEY = 'test-key';
  const stored = (id) => JSON.stringify(db.get('pipeline', id));
  try {
    let r = await s.go('/app/hq/import/first25-mine', { as: u, form: {} });
    assert.equal(where(r), '/app/hq#day');
    const [lead] = P.list(u.id);
    assert.equal(lead.key, `gplaces:${PID}`);
    assert.equal(lead.placeId, PID);
    assert.equal(lead.name, '');
    assert.deepEqual(Object.keys(lead.links), ['instagram']);
    assert.equal(lead.data.place_id, PID);
    assert.doesNotMatch(stored(lead.id), /google-gave-this|555-0100|maps\.google/);
    assert.equal(calls.length, 0, 'nothing fetched to import');

    // Today: the name is fetched for the page and put into the message, with the Google Maps credit.
    let page = await html(await s.go('/app/hq', { as: u }));
    assert.match(page, /<span data-gname-to>Iron Temple<\/span>/);
    assert.match(page, /Hi Iron Temple, I make short videos for gyms\./);
    assert.match(page, /query_place_id=ChIJirontempleAmes01" target="_blank" rel="noopener noreferrer">Google Maps<\/a>/);
    assert.deepEqual(calls, [{ id: PID, mask: 'id,displayName,attributions' }]);
    assert.doesNotMatch(stored(lead.id), /Iron Temple/, 'shown, never kept');

    // A pack that saves a Google result: the name it brings becomes the placeholder, and Google's fields
    // and any fact quoting Google's numbers are dropped.
    await P.upsert(u.id, 'gym', { key: 'gplaces:ChIJpeakfitnessAmes2', name: 'Peak Fitness', links: { website: 'https://peak.test', instagram: IG('peak') }, msg: { dm: 'Hi Peak Fitness team. Your classes look great.' }, facts: ['Only 23 Google reviews.', 'No Reels in 3 months.'], data: { rating: 4.8, reviews: 23, address: '1 Main St', score: 70 } });
    const peak = P.list(u.id).find((x) => x.key === 'gplaces:ChIJpeakfitnessAmes2');
    assert.equal(peak.name, '');
    assert.equal(peak.msg.dm, 'Hi [business name] team. Your classes look great.');
    assert.deepEqual(peak.facts, ['No Reels in 3 months.']);
    assert.deepEqual(peak.data, { score: 70, place_id: 'ChIJpeakfitnessAmes2' });
    assert.deepEqual(Object.keys(peak.links), ['instagram']);

    // Write it for me: the tool gets "[business name]", so the draft it saves keeps the placeholder.
    const j = await json(await s.go(`/app/hq/queue/${peak.id}/write`, { as: u, json: {} }));
    await engine.idle();
    assert.equal(engine.get(u, j.run).status, 'done');
    assert.match(P.get(u.id, peak.id).msg.dm, /\[business name\]/);
    assert.doesNotMatch(stored(peak.id), /Peak Fitness/);

    // One card's name on request (past the first three on Today), only for the member's own Google lead.
    calls.length = 0;
    r = await s.go(`/app/hq/leads/${peak.id}/name.json`, { as: u, headers: { accept: 'application/json' } });
    assert.deepEqual(await json(r), { name: 'Peak Fitness', credits: [] });
    assert.equal(calls.length, 1);
    const other = await member('builder');
    assert.equal((await s.go(`/app/hq/leads/${peak.id}/name.json`, { as: other, headers: { accept: 'application/json' } })).status, 404);

    // The Pipeline page shows names too; the AI link lists a Google business by its Maps link.
    page = await html(await s.go('/app/hq/pipeline', { as: u }));
    assert.match(page, /<h4 data-gname-to>Peak Fitness<\/h4>/);
    const mcpText = (await require('../lib/harness/mcp').call(u, 'get_pipeline', {})).content[0].text;
    assert.match(mcpText, /a business on Google Maps \(https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=business&query_place_id=ChIJpeakfitnessAmes2\)/);

    // Without the key nothing is fetched: the card says so and the placeholder keeps Copy off.
    delete process.env.PLACES_API_KEY;
    calls.length = 0;
    page = await html(await s.go('/app/hq', { as: u }));
    assert.equal(calls.length, 0);
    assert.match(page, /<span data-gname-to>A business on Google Maps<\/span>/);
    assert.match(page, /Fill in <b data-hole-text>\[business name\]<\/b> before you send it\./);
    assert.match(page, /data-gname="/);
  } finally {
    delete process.env.PLACES_API_KEY;
    places._setDeps({ fetch: (...a) => fetch(...a) });
    imports._setDeps({ first25: () => require('../lib/first25'), first25Data: () => require('../public/funnels/first25-data.js') });
  }
});

test("the real First 25 module: a member's own list comes in with every reason, link and tracker date", async () => {
  const first25 = require('../lib/first25');
  const u = await member('builder', { name: 'Rae Okafor' });
  const doc = await first25.run({ pack: 'video', buyer: 'gyms', place: 'Ames, IA', me: 'Maya' }, () => {});
  try {
    // The sample source makes labeled sample lists, which HQ never offers; this one stands in for a real one.
    assert.equal(doc.sample, true);
    await db.save('leads', { email: u.email, name: 'Maya', source: 'first-25', data: { run_id: doc.id, k: first25.sign(doc.id) } });
    assert.equal(await imports.first25Mine(u), null, 'a sample list is never offered');
    doc.sample = false;
    doc.status = { 2: { s: 'contacted', at: '2026-11-03T15:00:00.000Z' } };
    await db.save('prospectRuns', doc);
    const rows = first25.leadsFor(u.email);
    assert.equal(rows.length, 25);
    const mine = await imports.first25Mine(u);
    assert.equal(mine.count, 25);
    assert.equal(mine.fresh, 25);
    assert.equal(mine.city, 'Ames');
    const r = await s.go('/app/hq/import/first25-mine', { as: u, form: {} });
    assert.equal(where(r), '/app/hq#day');
    const leads = P.list(u.id);
    assert.equal(leads.length, 25);
    const byRank = (n) => leads.find((l) => l.data.rank === n);
    assert.match(byRank(1).msg.dm, /I'm Rae/, "written for the member's HQ name");
    assert.ok(byRank(1).facts.length && byRank(1).facts.every((f) => /\s/.test(f)), `reasons, not ids: ${JSON.stringify(byRank(1).facts)}`);
    assert.equal(byRank(2).stage, 'contacted');
    assert.equal(byRank(2).nextAt, '2026-11-06T15:00:00.000Z', 'the follow-up is dated from when they sent it');
    // The emailed link to the same list: its confirm page, and nothing new to add.
    const link = `/app/hq/import/first25/${doc.id}?k=${first25.sign(doc.id)}`;
    assert.match(await html(await s.go(link, { as: u })), /Work your 25 in HQ/);
    await s.go(`/app/hq/import/first25/${doc.id}`, { as: u, form: { k: first25.sign(doc.id) } });
    assert.match(flashes.pop().text, /already in your Pipeline/);
    assert.equal(P.list(u.id).length, 25);
    // The rows alone (list already gone) still give sentences, never gap ids.
    await db.remove('prospectRuns', doc.id);
    imports._setDeps({ first25: () => ({ leadsFor: () => JSON.parse(JSON.stringify(rows)) }) });
    const fallback = await imports.first25Mine(u);
    assert.equal(fallback.fresh, 0, 'the same businesses, the same leads');
    for (const l of fallback.leads) assert.ok(l.facts.every((f) => /\s/.test(f)), JSON.stringify(l.facts));
  } finally {
    imports._setDeps({ first25: () => require('../lib/first25') });
    await db.remove('prospectRuns', doc.id).catch(() => {});
  }
});

// ---------- Monday's card ----------

test("Monday's card: from 8am local the week's sends are written and waiting; approving puts them first in Do my day", async () => {
  const u = await member('builder', { name: 'Rae Okafor' });
  const free = await member('free');
  const monday = harness.monday;
  const a = await P.upsert(u.id, 'test', { key: 'a', name: 'Alpha Gym', score: 40, links: { instagram: IG('alphagym') }, msg: { dm: 'Hi Alpha Gym, Rae here.' } });
  const b = await P.upsert(u.id, 'test', { key: 'b', name: 'Bravo Gym', score: 30, links: { email: 'hi@bravo.test' } });
  await P.upsert(u.id, 'test', { key: 'c', name: 'Charlie Gym', score: 90 });
  await P.upsert(free.id, 'test', { key: 'f', name: 'Free Gym', links: { instagram: IG('freegym') } });
  const only = (x) => x.id === u.id || x.id === free.id;
  const events = [];
  harness.hooks({ emit: (type, p) => events.push({ type, ...p }) });
  monday._reset();
  try {
    now = Date.parse('2026-11-09T13:00:00Z'); // Monday, 7am in Chicago
    await todayLib.log(u.id, 'cold', 1);
    assert.deepEqual(monday.due(only), [], 'not before 8am');
    now = Date.parse('2026-11-09T14:00:00Z'); // 8am
    assert.deepEqual(monday.due(only).map((x) => x.user.id), [u.id], 'Builders only');
    process.env.HARNESS_MONDAY = 'off';
    assert.deepEqual(monday.due(only), []);
    delete process.env.HARNESS_MONDAY;

    const ids = await monday.sweep({ enabledFor: only, start: engine.start });
    assert.equal(ids.length, 1);
    await engine.idle();
    let run = engine.get(u, ids[0]);
    assert.equal(run.status, 'waiting', JSON.stringify(run.steps));
    assert.equal(run.inputs.week, '2026-11-09');
    assert.equal(run.source, 'monday');
    assert.ok(events.some((e) => e.type === 'hq.monday_card' && e.userId === u.id && e.runId === run.id), 'the Monday email can link to it');
    assert.match(P.get(u.id, b.id).msg.email, /no thanks/, 'the lead with no message got one written');
    const ask = engine.view(run).waitingOn.ask;
    assert.deepEqual(ask.items.map((i) => i.label), ['Alpha Gym', 'Bravo Gym'], 'leads with no way to reach them are left out');
    assert.match(await html(await s.go('/app/hq/inbox', { as: u })), /This week&#39;s sends are written\. Check them\./);

    // Approve with one edit: the edit lands on the lead and both go first this week.
    const r = await s.go(`/app/hq/runs/${run.id}/answer/check`, { as: u, form: { item_0: 'Hi Alpha Gym, it is Rae. Edited.', back: '/app/hq/inbox' } });
    assert.equal(where(r), '/app/hq/inbox');
    await engine.idle();
    run = engine.get(u, run.id);
    assert.equal(run.status, 'done', JSON.stringify(run.steps));
    assert.equal(P.get(u.id, a.id).msg.dm, 'Hi Alpha Gym, it is Rae. Edited.');
    assert.equal(P.get(u.id, a.id).week, '2026-11-09');
    await P.upsert(u.id, 'test', { key: 'd', name: 'Delta Gym', score: 99, links: { email: 'd@d.test' }, msg: { email: 'Hi Delta.' } });
    const names = todayLib.queue(u).items.map((i) => i.name);
    assert.deepEqual(names.slice(0, 3), ['Alpha Gym', 'Bravo Gym', 'Delta Gym'], 'approved sends first, then the best new ones');

    monday._reset();
    assert.deepEqual(monday.due(only), [], 'one card a week');
  } finally {
    harness.hooks({ emit: () => {} });
  }
});

// ---------- repeats ----------

const REP = {
  id: 'trep',
  title: 'Repeat tests',
  version: '1.0.0',
  summary: 'A weekly list.',
  tools: [{ name: 'trep.note', title: 'Write a note', description: 'Writes one line.', kind: 'code', risk: 'read', credits: 1, input: obj({ city: { type: 'string' } }), output: obj({ text: { type: 'string' } }), run: async ({ city }) => ({ text: `25 more in ${city}` }) }],
  workflows: [
    {
      id: 'trep.next',
      title: 'Your next 25',
      promise: 'Twenty-five more to reach out to.',
      minutes: 2,
      tier: 'free',
      suggestSchedule: { cron: '0 7 * * 1', label: 'Every Monday at 7am' },
      inputs: obj({ city: { type: 'string', title: 'Your city' } }),
      steps: [{ id: 'list', tool: 'trep.note', input: { city: '$inputs.city' } }, { id: 'ok', approve: { title: 'Check them' } }],
      result: ['list'],
    },
    {
      id: 'trep.pro',
      title: 'Your next 50',
      promise: 'Fifty more to reach out to.',
      minutes: 2,
      tier: 'builder',
      suggestSchedule: { cron: '0 7 * * 1', label: 'Every Monday at 7am' },
      inputs: obj({ city: { type: 'string', title: 'Your city' } }),
      steps: [{ id: 'list', tool: 'trep.note', input: { city: '$inputs.city' } }],
      result: ['list'],
    },
  ],
};

test('repeats: a finished run offers its schedule, one tap keeps it, and it runs at that local time without piling up', async () => {
  const r0 = packs.registerAll([{ pack: REP, source: 'test' }]);
  assert.deepEqual(r0.refused, [], JSON.stringify(r0.refused));
  const reps = harness.schedules;
  reps._setDeps({ now: () => now });
  const u = await member();
  const other = await member();
  const only = (x) => x.id === u.id;
  try {
    let run = await engine.start(u, 'trep.next', { city: 'Ames' });
    await engine.idle();
    let page = await html(await s.go(`/app/hq/runs/${run.id}`, { as: u }));
    assert.doesNotMatch(page, /Keep it going/, 'not while it waits on them');
    await s.go(`/app/hq/runs/${run.id}/answer/ok`, { as: u, form: {} });
    await engine.idle();
    page = await html(await s.go(`/app/hq/runs/${run.id}`, { as: u }));
    assert.match(page, /Keep it going/);
    assert.match(page, /Repeat it every Monday at 7am/);
    assert.match(page, /about \d+ credits and stops for your OK/);

    let res = await s.go(`/app/hq/runs/${run.id}/repeat`, { as: u, form: {} });
    assert.equal(where(res), `/app/hq/runs/${run.id}`);
    assert.ok(flashes.some((f) => f.text === 'Your next 25 repeats every Monday at 7am. Stop it any time on Runs.'));
    const [rep] = reps.list(u.id);
    assert.deepEqual(rep.inputs, { city: 'Ames' });
    assert.equal(rep.lastDate, '2026-11-04', 'never a second run the same day');
    page = await html(await s.go(`/app/hq/runs/${run.id}`, { as: u }));
    assert.doesNotMatch(page, /Keep it going/);
    assert.match(page, /This repeats every Monday at 7am\./);
    flashes = [];
    await s.go(`/app/hq/runs/${run.id}/repeat`, { as: u, form: {} });
    assert.ok(flashes.some((f) => f.type === 'error'), 'once per workflow');
    assert.equal(reps.list(u.id).length, 1);
    assert.equal((await s.go(`/app/hq/runs/${run.id}/repeat`, { as: other, form: {} })).status, 404, "someone else's run");

    // Monday 6am in Chicago: not yet. 7:30: it starts once, with the same answers.
    now = Date.parse('2026-11-09T12:00:00Z');
    assert.deepEqual(reps.due(only), []);
    now = Date.parse('2026-11-09T13:30:00Z');
    assert.equal(reps.due(only).length, 1);
    process.env.HARNESS_REPEATS = 'off';
    assert.deepEqual(reps.due(only), []);
    delete process.env.HARNESS_REPEATS;
    const ids = await reps.sweep({ enabledFor: only, start: engine.start });
    assert.equal(ids.length, 1);
    await engine.idle();
    run = engine.get(u, ids[0]);
    assert.equal(run.source, 'repeat');
    assert.deepEqual(run.inputs, { city: 'Ames' });
    assert.equal(run.status, 'waiting');
    assert.deepEqual(reps.due(only), [], 'once a day');

    // The next Monday it still waits on them: that turn is skipped, and Runs says why.
    now = Date.parse('2026-11-16T14:00:00Z');
    assert.deepEqual(await reps.sweep({ enabledFor: only, start: engine.start }), []);
    assert.equal(reps.list(u.id)[0].runs, 1);
    page = await html(await s.go('/app/hq/runs', { as: u }));
    assert.match(page, /Repeats/);
    assert.match(page, /Every Monday at 7am · ran 1 time · Skipped a turn: the last one is waiting on you\./);

    // Stop: only theirs, and it's gone.
    assert.equal((await s.go(`/app/hq/repeats/${rep.id}/stop`, { as: other, form: {} })).status, 404);
    res = await s.go(`/app/hq/repeats/${rep.id}/stop`, { as: u, form: {} });
    assert.equal(where(res), '/app/hq/runs');
    assert.deepEqual(reps.list(u.id), []);
    assert.doesNotMatch(await html(await s.go('/app/hq/runs', { as: u })), /id="repeats"/);

    // A repeat never spends a member's one free run: a workflow above their plan (run on the free
    // run) offers no repeat, and a repeat out of credits waits for next time instead.
    const f = await member('free');
    run = await engine.start(f, 'trep.pro', { city: 'Ames' });
    assert.equal(run.freeRun, true);
    await engine.idle();
    assert.equal(engine.get(f, run.id).status, 'done');
    assert.equal(reps.offer(f, engine.get(f, run.id)), null);
    assert.doesNotMatch(await html(await s.go(`/app/hq/runs/${run.id}`, { as: f })), /Keep it going/);
    await db.remove('runs', run.id); // the admin numbers' free-run median is checked later
    const g = await member('free');
    run = await engine.start(g, 'trep.next', { city: 'Ames' });
    await engine.idle();
    await s.go(`/app/hq/runs/${run.id}/answer/ok`, { as: g, form: {} });
    await engine.idle();
    await reps.create(g, engine.get(g, run.id));
    now = Date.parse('2026-11-23T14:00:00Z');
    process.env.HARNESS_CREDITS_FREE = '0';
    try {
      assert.deepEqual(await reps.sweep({ enabledFor: (x) => x.id === g.id, start: engine.start }), []);
    } finally {
      delete process.env.HARNESS_CREDITS_FREE;
    }
    assert.match(reps.list(g.id)[0].lastError, /credits/);
    assert.equal(harness.ledger.freeRunAvailable(g), true, 'the free run is still theirs');
  } finally {
    reps._setDeps({ now: () => Date.now() });
    unregister(['trep']);
  }
});

// ---------- the next price ----------

test('the next price: free case studies, then half, three quarters and full, per client only', async () => {
  assert.deepEqual(todayLib.parsePrice('$1,500 per site'), { cur: '$', n: 1500, unit: 'per site' });
  assert.deepEqual(todayLib.parsePrice('€2k a month'), { cur: '€', n: 2000, unit: 'a month' });
  assert.equal(todayLib.parsePrice('free'), null);
  const u = await member('builder');
  await harness.brain.update(u, { business: { price: '$500/mo', audience: 'gyms' } });
  let L = todayLib.ladder(u);
  assert.equal(L.price, 'Free');
  assert.equal(L.left, 3);
  assert.match(L.script, /I'm taking on 3 gyms this month for free, as case studies/);
  assert.doesNotMatch(L.script, /review/i, 'never a review in return for free work');
  for (const k of ['a', 'b', 'c', 'd']) {
    const l = await P.upsert(u.id, 'test', { key: k, name: k });
    await P.move(u.id, l.id, 'won');
  }
  L = todayLib.ladder(u);
  assert.equal(L.pct, 50);
  assert.equal(L.price, '$250/mo');
  assert.equal(L.left, 2);
  assert.equal(L.then.price, '$375/mo');
  assert.equal(L.script, "My first case studies are done, so I have 2 spots left at $250/mo before my price goes to $375/mo.");
  assert.doesNotMatch(L.script, /usual|instead of/i, 'never a price nobody has paid yet');
  assert.deepEqual(L.steps.map((x) => x.price), ['Free', '$250/mo', '$375/mo', '$500/mo']);
  assert.doesNotMatch(JSON.stringify(L), /\$1,?000|\$2,?000/, 'never a total across clients');
});

test('the scoreboard: this week against last, from sends and stage changes', async () => {
  const u = await member();
  now = T0 - 7 * DAY;
  const a = await P.upsert(u.id, 'test', { key: 'a', name: 'A', links: { email: 'a@a.test' }, msg: { email: 'Hi A.' } });
  await s.go(`/app/hq/queue/${a.id}/sent`, { as: u, json: {} });
  await P.move(u.id, a.id, 'replied');
  now = T0;
  const b = await P.upsert(u.id, 'test', { key: 'b', name: 'B', links: { email: 'b@b.test' }, msg: { email: 'Hi B.' } });
  const c = await P.upsert(u.id, 'test', { key: 'c', name: 'C', links: { email: 'c@c.test' }, msg: { email: 'Hi C.' } });
  for (const l of [b, c]) await s.go(`/app/hq/queue/${l.id}/sent`, { as: u, json: {} });
  await P.move(u.id, b.id, 'call');
  await P.move(u.id, a.id, 'won');
  const sc = todayLib.scoreboard(u);
  assert.deepEqual([sc.last.touches, sc.last.replies], [1, 1]);
  assert.deepEqual([sc.this.touches, sc.this.calls, sc.this.yeses], [2, 1, 1]);
  const page = await html(await s.go('/app/hq', { as: u }));
  assert.match(page, /Last week 1/);
});

// ---------- files ----------

test('files: add your own to the Library, pick one in a workflow, and the new kinds (SVG never runs inline)', async () => {
  const u = await member('builder');
  const other = await member('builder');
  const up = (who, name, type, body) => s.go('/app/hq/library/upload', { as: who, raw: body, headers: { 'content-type': type, 'x-file-name': encodeURIComponent(name), accept: 'application/json' } });
  let r = await up(u, 'gym clip.txt', 'text/plain', 'hello from a clip');
  assert.equal(r.status, 200);
  const clip = (await r.json()).file;
  assert.equal(clip.name, 'gym clip.txt');
  assert.equal((await up(u, 'virus.exe', 'application/x-msdownload', 'MZ')).status, 415);
  assert.equal((await up(u, 'empty.txt', 'text/plain', '')).status, 400);
  process.env.HARNESS_MAX_FILE_MB = '1';
  try {
    r = await up(u, 'big.mp4', 'video/mp4', Buffer.alloc(1024 * 1024 + 10));
    assert.equal(r.status, 413);
    assert.match((await r.json()).error, /over 1 MB/);
  } finally {
    delete process.env.HARNESS_MAX_FILE_MB;
  }
  r = await up(u, 'header.liquid', 'application/octet-stream', '{% section %}');
  assert.equal((await r.json()).file.name, 'header.liquid', 'Shopify sections keep their name');
  r = await up(u, 'logo.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const svg = (await r.json()).file;
  r = await s.go(svg.url, { as: u });
  assert.match(r.headers.get('content-disposition'), /^attachment/);
  assert.match(r.headers.get('content-security-policy'), /sandbox/);
  r = await s.go(`${svg.url}?preview=1`, { as: u });
  assert.match(r.headers.get('content-disposition'), /^inline/);
  assert.match(r.headers.get('content-security-policy'), /; sandbox allow-top-navigation-to-custom-protocols$/, 'sms:, tel: and mailto: links open; scripts, forms and pop-ups stay off');
  for (const [name, type] of [['team.vcf', 'text/vcard'], ['launch.ics', 'text/calendar'], ['clip.srt', 'application/x-subrip'], ['clip.vtt', 'text/vtt'], ['raw.mov', 'video/quicktime']]) {
    r = await up(u, name, '', 'x');
    assert.equal(r.status, 200, name);
    assert.equal((await r.json()).file.type, type, name);
  }

  // A workflow's file input lists only the member's own files that fit, and can add one in place.
  const page = await html(await s.go('/app/hq/w/rf.clip', { as: u }));
  assert.match(page, new RegExp(`<option value="${clip.id}">gym clip\\.txt</option>`));
  assert.doesNotMatch(page, /logo\.svg/, "an SVG isn't a clip");
  assert.match(page, /data-upload-input hidden accept="video\/\*,\.txt"/);
  r = await s.go('/app/hq/w/rf.clip/run', { as: other, form: { in_clip: clip.id } });
  assert.equal(where(r), '/app/hq/w/rf.clip');
  assert.match(flashes.pop().text, /that file isn't in your Library/);
  r = await s.go('/app/hq/w/rf.clip/run', { as: u, form: { in_clip: clip.id } });
  await engine.idle();
  const run = engine.get(u, where(r).split('/').pop());
  assert.equal(run.status, 'done', JSON.stringify(run.steps));
  assert.deepEqual(run.steps.read.output, { name: 'gym clip.txt', bytes: 17, head: 'hello from a' });
  const lib = await html(await s.go('/app/hq/library', { as: u }));
  assert.match(lib, /Add your own files/);
  assert.match(lib, /Contacts/);
});

test("an input with options: 'pipeline' suggests the member's own businesses, and still takes a typed name", async () => {
  const u = await member();
  const other = await member();
  await P.upsert(u.id, 'test', { key: 'a', name: 'Iron Temple' });
  const gone = await P.upsert(u.id, 'test', { key: 'b', name: 'Gone Gym' });
  await P.move(u.id, gone.id, 'lost');
  await P.upsert(other.id, 'test', { key: 'c', name: 'Not Yours Gym' });
  const page = await html(await s.go('/app/hq/w/rf.pick', { as: u }));
  assert.match(page, /<input class="input" id="in-gym" name="in_gym" value="" list="in-gym-names" autocomplete="off" required><datalist id="in-gym-names"><option value="Iron Temple"><\/datalist>/);
  assert.match(page, /Pick one from your Pipeline, or type a name\./);
  assert.doesNotMatch(page, /Gone Gym|Not Yours Gym/);
  const r = await s.go('/app/hq/w/rf.pick/run', { as: u, form: { in_gym: 'Iron Temple' } });
  await engine.idle();
  const run = engine.get(u, where(r).split('/').pop());
  assert.deepEqual(run.steps.find.output, { found: true, name: 'Iron Temple' });
  const list = (await require('../lib/harness/mcp').call(u, 'list_workflows', {})).content[0].text;
  assert.match(list, /gym \(a business in the member's Pipeline, by name\)/);
});

// ---------- admin numbers ----------

test('admin numbers: spend against the cap with alarms, cost per free run, and first send within 7 days by signup week', async () => {
  const u = await member('builder');
  const free = await member('free');
  const ctxLib = require('../lib/harness/ctx');
  const events = [];
  harness.hooks({ emit: (type, p) => events.push({ type, ...p }) });
  const was = ctxLib._day.usd;
  try {
    process.env.HARNESS_MAX_DAY_USD = '100';
    ctxLib.addDay(55);
    let m = harness.margins();
    assert.equal(m.today.pct, Math.round(((was + 55) / 100) * 100));
    assert.ok(m.alarms.some((a) => /half the \$100 cap/.test(a)) || was + 55 >= 80);
    assert.ok(events.some((e) => e.type === 'harness.budget' && e.pct === 50) || was >= 50);

    // A free run's cost, with an alarm over $0.50 at the median.
    const run = await engine.start(free, 'rt.paid', {});
    assert.equal(run.freeRun, true);
    await engine.idle();
    const doc = db.get('runs', run.id);
    doc.usd = 0.9;
    await db.save('runs', doc);
    m = harness.margins();
    assert.ok(m.freeRuns.last30Days >= 1);
    assert.ok(m.alarms.some((a) => /over the \$0\.50 alarm/.test(a)), JSON.stringify(m));

    // First send within 7 days of signing up, counted by signup week.
    harness.activation._setDeps({ now: () => Date.parse(u.createdAt) + DAY });
    await harness.activation.mark(u.id, 'a3');
    harness.activation._setDeps({ now: () => now });
    const week = todayLib.weekStart(todayLib.dayKey(Date.parse(u.createdAt)));
    const row = harness.activationByWeek().find((x) => x.week === week);
    assert.ok(row && row.firstSend7 >= 1 && row.builderFirstSend7 >= 1, JSON.stringify(row));
    process.env.ADMIN_EMAILS = u.email;
    const st = await json(await s.go('/admin/harness', { as: u }));
    assert.ok(st.margins && st.margins.freeRuns && Array.isArray(st.activation));
  } finally {
    ctxLib._day.usd = was;
    delete process.env.HARNESS_MAX_DAY_USD;
    harness.hooks({ emit: () => {} });
  }
});
