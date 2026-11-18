// Hosted coach sites (lib/coach-hosting.js): the switch, who can publish, the published pages (SEO, cache, CSP),
// images, re-publishing, and that an unpublished slug still falls through to the kit's challenge page.
const path = require('path');
const os = require('os');
process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-hosting-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-hosting-${process.pid}`);

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../lib/db');
const coachKit = require('../lib/coach-kit');
const coachSite = require('../lib/coach-site');
const hosting = require('../lib/coach-hosting');

let server, base, me = null;
const ADMIN = { id: 'admin1', email: 'admin@example.com' };
const COACH = { id: 'coach-host-1', email: 'jo@example.com', coachPlan: 'active' };
const NOPLAN = { id: 'coach-host-2', email: 'sam@example.com' };
const isAdmin = (u) => !!u && u.id === ADMIN.id;
const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('logo-bytes')]).toString('base64');
const JPG = (s) => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(s)]).toString('base64');

test.before(async () => {
  await db.init();
  await db.save('users', COACH);
  await db.save('users', NOPLAN);
  const app = express();
  app.use((req, res, next) => { req.user = me; next(); });
  app.response.render = function (view) { this.status(this.statusCode || 404).send(view); };
  const requireAuth = (req, res, next) => (req.user ? next() : res.status(302).end());
  const clientsOpen = () => process.env.COACH_CLIENTS === 'on';
  require('../lib/coach-hosting')(app, { requireAuth, isAdmin, clientsOpen, baseUrl: () => 'https://127group.io' });
  require('../lib/coach-routes')(app, { requireAuth, isAdmin });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server && server.close(); delete process.env.COACH_HOSTING; delete process.env.COACH_CLIENTS; });

const post = (p, body) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (p, h) => fetch(base + p, { redirect: 'manual', headers: h || {} });
const kit = { business: 'Forge Strength', coach: 'Jo Park', who: 'new parents', start: '2027-01-04', days: 21, price: 49, handle: 'forgejo', color: '#E4572E', look: 'editorial' };

test('off: nothing publishes, and /c/<slug> stays the kit route', async () => {
  delete process.env.COACH_HOSTING;
  me = COACH;
  const saved = await (await post('/coaches/kit', kit)).json();
  assert.equal(saved.host, false);
  assert.equal((await post('/coaches/site/publish', {})).status, 404);
  me = null;
  assert.equal((await get('/c/forge-strength')).status, 404); // COACH_CLIENTS off too
});

test('admins: only admins publish and see it; noindex, no-store', async () => {
  process.env.COACH_HOSTING = 'admins';
  me = COACH;
  assert.equal((await (await post('/coaches/kit', kit)).json()).host, false);
  assert.equal((await post('/coaches/site/publish', {})).status, 403);
  me = ADMIN;
  await post('/coaches/kit', { ...kit, business: 'Admin Gym' });
  const r = await post('/coaches/site/publish', { logo: PNG });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.url, '/c/admin-gym');
  assert.equal(j.public, false);
  const page = await get('/c/admin-gym');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('cache-control'), /no-store/);
  assert.match(await page.text(), /<meta name="robots" content="noindex">/);
  me = null;
  assert.equal((await get('/c/admin-gym')).status, 404);
});

test('on: a coach-plan coach publishes; the page is fast, indexable and safe', async () => {
  process.env.COACH_HOSTING = 'on';
  me = COACH;
  assert.equal((await (await post('/coaches/kit', kit)).json()).host, true);
  const r = await post('/coaches/site/publish', { logo: PNG, photo: JPG('photo-1') });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual([j.url, j.challengeUrl, j.version, j.public], ['/c/forge-strength', '/c/forge-strength/challenge', 1, true]);

  me = null;
  const page = await get('/c/forge-strength');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(page.headers.get('cache-control'), /public, max-age=60/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'sha256-/);
  assert.doesNotMatch(page.headers.get('content-security-policy'), /unsafe-eval|script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(html, /noindex/);
  assert.match(html, /<title>Forge Strength: online coaching for new parents<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/127group\.io\/c\/forge-strength">/);
  assert.match(html, /application\/ld\+json[\s\S]*"@type":"Event"[\s\S]*"startDate":"2027-01-04"/);
  assert.match(html, /og:image" content="https:\/\/127group\.io\/c\/forge-strength\/i\/[a-f0-9]{24}\.jpg"/);
  assert.match(html, /data-look="editorial"/);
  assert.match(html, /<h1 class="dsp/);
  assert.doesNotMatch(html, /contenteditable|data-e=/);
  assert.match(html, /href="\/c\/forge-strength\/challenge#cs-join"/);
  assert.match(html, /rel="preload" href="\/fonts\/coach\/instrument-serif-normal-400\.woff2"/);
  assert.match(html, /Report this site/);
  // Every inline script is one the CSP allows by hash.
  const csp = page.headers.get('content-security-policy');
  const crypto = require('crypto');
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.ok(csp.includes(crypto.createHash('sha256').update(m[1]).digest('base64')), 'inline script allowed');

  const etag = page.headers.get('etag');
  assert.equal((await get('/c/forge-strength', { 'If-None-Match': etag })).status, 304);

  // Images: owned files only, cached a year.
  const src = html.match(/\/c\/forge-strength\/i\/[a-f0-9]{24}\.jpg/)[0];
  const img = await get(src);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.match(img.headers.get('cache-control'), /immutable/);
  assert.equal((await get('/c/forge-strength/i/' + 'a'.repeat(24) + '.jpg')).status, 404);
  assert.equal((await get('/c/forge-strength/i/..%2f..%2fetc.jpg')).status, 404);
});

test('the challenge page: a link while client sign-ups are off, the join form once on', async () => {
  me = null;
  delete process.env.COACH_CLIENTS;
  let html = await (await get('/c/forge-strength/challenge')).text();
  assert.match(html, /Message Jo to join/);
  assert.doesNotMatch(html, /<form/);
  process.env.COACH_CLIENTS = 'on';
  html = await (await get('/c/forge-strength/challenge')).text();
  assert.match(html, /<form class="cs-join[^"]*" method="post" action="\/c\/forge-strength\/join">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/127group\.io\/c\/forge-strength\/challenge">/);
  delete process.env.COACH_CLIENTS;
});

test('re-publish: kit edits wait for "Put it live", then show with a new version', async () => {
  me = COACH;
  await post('/coaches/kit', { ...kit, edits: { 'site.heroTitle': 'Train at nap time.' } });
  me = null;
  const before = await get('/c/forge-strength');
  const tag1 = before.headers.get('etag');
  assert.doesNotMatch(await before.text(), /Train at nap time/);
  me = COACH;
  const r = await (await post('/coaches/site/publish', { photo: JPG('photo-2') })).json();
  assert.equal(r.version, 2);
  me = null;
  const after = await get('/c/forge-strength');
  const html = await after.text();
  assert.match(html, /Train at nap time\./);
  assert.notEqual(after.headers.get('etag'), tag1);
  // Logo kept (not re-sent), the old photo still served for one version, so a cached page never breaks.
  assert.match(html, /\/i\/[a-f0-9]{24}\.png/);
  const site = db.get('coachSites', COACH.id);
  assert.equal(site.keep.length, 1);
  assert.equal((await get(`/c/forge-strength/i/${site.keep[0]}.jpg`)).status, 200);
});

test('refusals: bad images, result claims, no kit, no plan; a lapsed plan hides the site', async () => {
  me = COACH;
  let r = await post('/coaches/site/publish', { photo: 'data:image/jpeg;base64,' + Buffer.from('not a jpeg').toString('base64') });
  assert.equal(r.status, 400);
  r = await post('/coaches/site/publish', { logo: 'data:image/svg+xml;base64,PHN2Zz4=' });
  assert.equal(r.status, 400);
  // The kit save refuses a result claim; publishing checks again (a kit saved before a rule was added).
  assert.equal((await post('/coaches/kit', { ...kit, edits: { 'site.heroTitle': 'Lose 20 lbs in 21 days' } })).status, 422);
  const good = db.get('coachKits', COACH.id);
  await db.save('coachKits', { ...good, edits: { 'site.heroTitle': 'Lose 20 lbs in 21 days' } });
  assert.equal((await post('/coaches/site/publish', {})).status, 422);
  await db.save('coachKits', good);
  me = NOPLAN;
  assert.equal((await post('/coaches/site/publish', {})).status, 403);
  me = { id: 'no-kit', email: 'x@example.com', coachPlan: 'active' };
  assert.equal((await post('/coaches/site/publish', {})).status, 409);

  assert.deepEqual(hosting.sitemapPaths(isAdmin).filter((p) => p.includes('forge')), ['/c/forge-strength', '/c/forge-strength/challenge']);
  await db.save('users', { ...COACH, coachPlan: 'canceled' });
  me = null;
  assert.equal((await get('/c/forge-strength')).status, 404);
  assert.deepEqual(hosting.sitemapPaths(isAdmin).filter((p) => p.includes('forge')), []);
  await db.save('users', COACH);
});

test('unpublish: the site goes, the kit stays', async () => {
  me = COACH;
  assert.equal((await post('/coaches/site/unpublish', {})).status, 200);
  assert.ok(!db.get('coachSites', COACH.id));
  assert.ok(db.get('coachKits', COACH.id));
  me = null;
  assert.equal((await get('/c/forge-strength')).status, 404);
});

test('one markup: the kit preview is editable, the hosted page is not, the file keeps in-page links', () => {
  const k = coachKit.build(kit);
  const live = coachSite.site(k, { look: 'bold' }, { live: true });
  assert.match(live, /contenteditable="plaintext-only"/);
  assert.match(live, /data-look="bold"/);
  const file = coachSite.site(k, {}, {});
  assert.doesNotMatch(file, /contenteditable/);
  assert.match(file, /href="#cs-apply"/);
  assert.match(coachSite.challenge(k, {}, {}), /cs-count cs-count-l/);
  // The CSS the server inlines is the kit page's own block.
  assert.match(hosting.page({ id: 'x', slug: 'x', version: 1, input: kit, edits: {}, look: 'athletic', assets: {} }, 'site', { base: '/c/x', origin: 'https://127group.io', index: true }), /\.cs\[data-look=editorial\]/);
});
