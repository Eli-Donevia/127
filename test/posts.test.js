// HQ Post (lib/harness/posts.js, connectors/social.js): drafts, photos checked as JPEGs, the OK and what
// takes it back, Legal's hold per place, going out at its time through Meta's Graph API with the Page's
// own token, the private photo link, the pulse counts, and clean-up. No network: Meta is a fake fetch.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-posts-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-posts-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
for (const k of ['ANTHROPIC_API_KEY', 'ADMIN_EMAILS', 'CONNECTORS', 'HQ_POSTS']) delete process.env[k];
for (const k of Object.keys(process.env)) if (/^(CONNECTOR_|OAUTH_)/.test(k)) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const hq = require('../lib/hq');
const connectors = require('../lib/harness/connectors');
const engine = require('../lib/harness/engine');
const posts = require('../lib/harness/posts');
const postRoutes = require('../lib/harness/posts-routes');
const social = require('../lib/harness/connectors/social');
const { plan } = require('../lib/plans');

// ---------- a fake Meta ----------
let calls = [];
let routes = [];
function on(method, re, reply) {
  routes.unshift({ method, re, reply });
}
async function fakeFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  calls.push({ url, method, headers: opts.headers || {}, body: opts.body });
  const r = routes.find((x) => x.method === method && x.re.test(url));
  if (!r) return new Response('{}', { status: 404 });
  const out = typeof r.reply === 'function' ? r.reply(url, opts) : r.reply;
  const status = out && out.$status ? out.$status : 200;
  return new Response(JSON.stringify(out && out.$status ? {} : out), { status, headers: { 'content-type': 'application/json' } });
}
function meta() {
  on('GET', /\/me\/accounts/, { data: [{ id: '111', name: 'North Loop Coffee', access_token: 'PAGE-TOKEN', instagram_business_account: { id: '222', username: 'northloop.coffee' } }] });
  on('POST', /\/222\/media$/, { id: '333' });
  on('GET', /\/333\?fields=status_code/, { status_code: 'FINISHED' });
  on('POST', /\/222\/media_publish/, { id: '444' });
  on('GET', /\/444\?fields=permalink/, { permalink: 'https://www.instagram.com/p/abc/' });
  on('POST', /\/111\/photos/, { id: '555', post_id: '111_555' });
  on('POST', /\/111\/feed/, { id: '111_666' });
}

// A JPEG header with a frame of w x h (enough for the size check; Meta never sees it here).
function jpeg(w, h) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]), sof, Buffer.alloc(64, 1), Buffer.from([0xff, 0xd9])]);
}

let seq = 0;
async function member(tier = 'builder', extra = {}) {
  seq += 1;
  return db.save('users', { id: `pu${seq}`, email: `p${seq}@127.test`, name: `Jo Rivera${seq}`, tier, emailVerified: true, ...extra });
}
async function connect(user, id) {
  const go = connectors.startOauth(user, id, 'https://127.test');
  on('POST', /graph\.facebook\.com\/v[\d.]+\/oauth\/access_token/, { access_token: `USER-${id}`, expires_in: 5184000 });
  const out = await connectors.finishOauth(user, go.pending, 'meta', { code: 'c', state: go.pending.state }, 'https://127.test');
  assert.equal(out.ok, true, JSON.stringify(out));
}

let now = Date.parse('2026-10-21T15:00:00Z');
const later = (ms) => {
  now += ms;
};

async function server() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    req.user = req.get('x-user') ? db.get('users', req.get('x-user')) : null;
    Object.assign(res.locals, {
      user: req.user, userPlan: req.user ? plan(req.user.tier) : null, isAdmin: false, path: req.path, flash: null,
      builderOffer: { founding: false, price: 29, regular: 29, messages: 300, freeMonth: false, firstCharge: null },
      launch: {}, pauseInfo: null, ageReview: false, agePauseMessage: '', stripeLive: false, demoBilling: false, checkoutCancelled: false,
      fmtDate: (x) => (x ? new Date(x).toISOString().slice(0, 10) : null), plausible: null, trackEvents: [], canonical: 'https://127.test' + req.path,
      baseUrl: 'https://127.test', adConsentScript: '', description: null, hqLive: true,
    });
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.redirect('/login'));
  app.use(postRoutes({ requireAuth, flash: () => {} }));
  app.use((req, res) => res.status(404).send('app 404'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).send(String(err && err.stack)));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${srv.address().port}`;
  const go = (p, { as, form, body, method, type } = {}) => {
    const h = {};
    if (as) h['x-user'] = as.id;
    let b;
    if (form) { b = new URLSearchParams(form).toString(); h['content-type'] = 'application/x-www-form-urlencoded'; }
    if (body) { b = body; h['content-type'] = type || 'image/jpeg'; h.accept = 'application/json'; }
    return fetch(url + p, { method: method || (b !== undefined ? 'POST' : 'GET'), headers: h, body: b, redirect: 'manual' });
  };
  return { go, close: () => new Promise((r) => srv.close(r)) };
}

let s;
test.before(async () => {
  await db.init();
  connectors._setDeps({ fetch: fakeFetch });
  social._setDeps({ wait: async () => {} });
  posts._setDeps({ now: () => now, base: () => 'https://127.test' });
  s = await server();
});
test.after(async () => {
  await s.close();
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});
test.beforeEach(() => {
  calls = [];
  routes = [];
  connectors.log._reset();
  process.env.HQ_LIVE = 'true';
  process.env.HQ_SECRET = 'posts-test-secret-'.padEnd(48, 'x');
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
  process.env.ADMIN_EMAILS = 'boss@127.test';
  process.env.CONNECTORS = 'on';
  process.env.CONNECTOR_INSTAGRAM = 'on';
  process.env.CONNECTOR_FACEBOOK = 'on';
  process.env.OAUTH_META_ID = 'm-id';
  process.env.OAUTH_META_SECRET = 'm-secret';
  process.env.CONNECTOR_X = 'on';
  process.env.OAUTH_X_ID = 'x-id';
  process.env.OAUTH_X_SECRET = 'x-secret';
  delete process.env.X_DAILY_USD;
  process.env.HQ_POSTS = 'admins';
});

const boss = () => db.find('users', (u) => u.email === 'boss@127.test') || member('builder', { email: 'boss@127.test' });

test('switch: off by default, admins first, and the photo link is gone with it', async () => {
  const b = await boss();
  const jo = await member();
  delete process.env.HQ_POSTS;
  assert.equal(posts.on(b), false);
  assert.equal((await s.go('/app/hq/post', { as: b })).status, 404);
  process.env.HQ_POSTS = 'admins';
  assert.equal(posts.on(b), true);
  assert.equal(posts.on(jo), false);
  process.env.HQ_POSTS = 'on';
  assert.equal(posts.on(jo), true);
  assert.equal(posts.on(await member('free')), false, 'part of HQ');
});

test('Meta scopes are Facebook Login ones, with publishing', () => {
  const ig = connectors.catalog.byId.instagram;
  assert.ok(ig.scopes.includes('instagram_content_publish'));
  assert.ok(!ig.scopes.some((x) => /^instagram_business_/.test(x)), 'Instagram Login scopes need Instagram Login, not the Facebook dialog');
  assert.ok(connectors.catalog.byId.facebook.scopes.includes('pages_manage_posts'));
});

test('photos: JPEG only, sized, and Instagram only between 4:5 and 1.91:1', async () => {
  const b = await boss();
  assert.deepEqual(posts.jpegSize(jpeg(1080, 1350)), { w: 1080, h: 1350 });
  assert.equal(posts.jpegSize(Buffer.from('GIF89a')), null);
  const p = await posts.save(b, null, { text: 'Hi' });
  await assert.rejects(posts.setPhoto(b, p, 'instagram', Buffer.from('not a photo')), /JPEG/);
  await assert.rejects(posts.setPhoto(b, p, 'instagram', jpeg(1080, 1920)), /4:5 to 1.91:1/);
  await assert.rejects(posts.setPhoto(b, p, 'instagram', jpeg(200, 250)), /320/);
  await assert.rejects(posts.setPhoto(b, p, 'tiktok', jpeg(1080, 1350)), /Pick where it goes/);
  assert.deepEqual(await posts.setPhoto(b, p, 'facebook', jpeg(1080, 1920)), { w: 1080, h: 1920, bytes: jpeg(1080, 1920).length }, 'Facebook takes a tall one');
});

test('the OK: problems first, any change takes it back, it goes at its time to both places', async () => {
  const b = await boss();
  meta();
  await connect(b, 'instagram');
  await connect(b, 'facebook');
  const pl = await posts.places(b);
  assert.deepEqual(pl.instagram.accounts, [{ id: '222', name: '@northloop.coffee' }]);
  assert.deepEqual(pl.facebook.accounts, [{ id: '111', name: 'North Loop Coffee' }]);
  assert.doesNotMatch(JSON.stringify(pl), /PAGE-TOKEN/, "the Page's token never leaves social.js");

  let p = await posts.save(b, null, { text: 'The Oaxaca natural is back on bar.' });
  assert.deepEqual(posts.problems(b, p), ['Pick where it goes.']);
  p = await posts.save(b, p, { when: new Date(now + 2 * 36e5).toISOString(), places: { instagram: { on: true, target: { id: '222', name: '@northloop.coffee' } }, facebook: { on: true, target: { id: '111', name: 'North Loop Coffee' } } } });
  assert.deepEqual(posts.problems(b, p), ['Instagram needs a photo.']);
  await posts.setPhoto(b, p, 'instagram', jpeg(1080, 1350));
  await posts.save(b, p, { ai: true });
  assert.match(posts.problems(b, p).join(' '), /Post this one from the app/);
  await posts.save(b, p, { ai: false });
  assert.deepEqual(posts.problems(b, p), []);

  await posts.approve(b, p);
  assert.equal(p.status, 'ok');
  await assert.rejects(posts.approve(b, p), /already/);
  // An edit takes the OK back.
  await posts.save(b, p, { places: { facebook: { on: true, caption: 'Back on bar. Open 7 to 2.' } } });
  assert.equal(p.status, 'draft');
  assert.equal(p.ok, null);
  await posts.approve(b, p);

  // Not yet.
  assert.equal(await posts.tick(), 0);
  // The photo link works with the token only.
  // The photo link is dead while the post waits; it opens only while it's going out (Legal L93 c).
  assert.equal(await posts.media(p.id, 'instagram', p.token), null);
  assert.ok(Buffer.from(p.token, 'base64url').length * 8 >= 128, 'a token of 128 bits or more');
  let seen = null;
  on('POST', /\/222\/media$/, (url, o) => {
    const link = new URL(new URLSearchParams(o.body).get('image_url'));
    const [, , , id, place, token] = link.pathname.split('/');
    seen = Promise.all([posts.media(id, place, token), posts.media(id, place, 'x'.repeat(token.length)), posts.media(id, 'facebook', token)]);
    return { id: '333' };
  });

  later(2 * 36e5 + 1000);
  calls = [];
  assert.equal(await posts.tick(), 1);
  p = posts.get(b, p.id);
  assert.equal(p.status, 'done', JSON.stringify(p.results));
  assert.equal(p.results.instagram.url, 'https://www.instagram.com/p/abc/');
  assert.equal(p.results.facebook.state, 'out');
  const made = calls.find((c) => /\/222\/media$/.test(c.url));
  const form = new URLSearchParams(made.body);
  assert.equal(form.get('image_url'), `https://127.test/p/m/${p.id}/instagram/${p.token}`);
  assert.equal(form.get('caption'), 'The Oaxaca natural is back on bar.');
  assert.equal(made.headers.authorization, 'Bearer USER-instagram');
  const fb = calls.find((c) => /\/111\/feed/.test(c.url));
  assert.equal(fb.headers.authorization, 'Bearer PAGE-TOKEN', "Facebook posts with the Page's token");
  assert.equal(new URLSearchParams(fb.body).get('message'), 'Back on bar. Open 7 to 2.');
  const logged = connectors.log.list(b.id).filter((e) => e.action === 'write');
  assert.equal(logged.length, 2);
  assert.ok(logged.every((e) => /approved by you/.test(e.what)));

  assert.deepEqual(posts.counts(b, { since: now - 864e5 }), { out: 2, waiting: 0 });
  assert.deepEqual(posts.counts(b, { since: now - 864e5, until: now - 1000 }), { out: 0, waiting: 0 }, 'until bounds what went out');
  const [ok, wrong, fbPhoto] = await seen;
  assert.ok(ok, 'Meta can fetch it while it goes out');
  assert.equal(wrong, null, 'only with the token');
  assert.equal(fbPhoto, null, 'no Facebook photo');
  assert.equal(await posts.media(p.id, 'instagram', p.token), null, 'dead once it is out');
  await assert.rejects(posts.save(b, p, { text: 'changed' }), /already went out/);

  // Seven days on, the photo goes.
  later(8 * 864e5);
  assert.equal(await posts.sweep(), 1);
  assert.equal(await db.getBlob(`post_${p.id}_instagram`), null);
  assert.equal(posts.get(b, p.id).photosGone, true);
});

test("Legal's hold: a member can't OK a place until its act step is cleared", async () => {
  process.env.HQ_POSTS = 'on';
  const jo = await member();
  const p = await posts.save(jo, null, { text: 'Hello', places: { facebook: { on: true, target: { id: '111', name: 'Page' } } } });
  assert.match(posts.problems(jo, p).join(' '), /Facebook posting is waiting on Legal/);
  await assert.rejects(posts.approve(jo, p), /waiting on Legal/);
  engine.ACT_CLEARED.add('posts.facebook');
  try {
    assert.doesNotMatch(posts.problems(jo, p).join(' '), /waiting on Legal/);
    assert.match(posts.problems(jo, p).join(' '), /Connect Facebook first/, 'the connector is still held for members');
  } finally {
    engine.ACT_CLEARED.delete('posts.facebook');
  }
});

test('an OK covers what was shown: a post changed behind it goes back to draft, unsent', async () => {
  const b = await boss();
  meta();
  await connect(b, 'facebook');
  const p = await posts.save(b, null, { text: 'Hours', places: { facebook: { on: true, target: { id: '111', name: 'Page' } } } });
  await posts.approve(b, p);
  const doc = db.get('hqPosts', p.id);
  doc.text = 'Something else';
  calls = [];
  later(60 * 1000);
  await posts.tick();
  assert.equal(posts.get(b, p.id).status, 'draft');
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});

test('a busy Instagram is tried again; a refusal is a failed post that says why', async () => {
  const b = await boss();
  meta();
  await connect(b, 'instagram');
  const p = await posts.save(b, null, { text: 'Retry', places: { instagram: { on: true, target: { id: '222', name: '@x' } } } });
  await posts.setPhoto(b, p, 'instagram', jpeg(1080, 1080));
  await posts.approve(b, p);
  on('GET', /\/333\?fields=status_code/, { status_code: 'IN_PROGRESS' });
  later(60 * 1000);
  await posts.tick();
  assert.equal(posts.get(b, p.id).status, 'ok', 'tries again next minute');
  assert.equal(posts.get(b, p.id).results.instagram.state, 'retry');
  on('GET', /\/333\?fields=status_code/, { status_code: 'ERROR' });
  await posts.tick();
  const done = posts.get(b, p.id);
  assert.equal(done.status, 'failed');
  assert.match(done.results.instagram.error, /couldn't use that photo/);
  // A failed post can be fixed and OK'd again.
  assert.deepEqual(posts.problems(b, done), []);
});

test('captions per place from the content helper (sample answers without an AI key)', async () => {
  const b = await boss();
  const p = await posts.save(b, null, { text: 'New roast on Friday.' });
  const out = await posts.captions(b, p);
  assert.equal(out.sample, true);
  assert.equal(typeof out.post.places.instagram.caption, 'string');
  await assert.rejects(posts.captions(b, await posts.save(b, null, { text: '' })), /Write the post first/);
});

test('pages: the week, a draft, a photo upload, the OK, and the public photo link', async () => {
  const b = await boss();
  meta();
  await connect(b, 'instagram');
  let r = await s.go('/app/hq/post', { as: b });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /New post/);
  r = await s.go('/app/hq/post', { as: b, form: { text: 'From the page' } });
  assert.equal(r.status, 302);
  const at = r.headers.get('location');
  const id = at.split('/').pop();
  r = await s.go(at, { as: b });
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.match(html, /@northloop\.coffee/);
  assert.doesNotMatch(html, /—/, 'no em dashes');
  r = await s.go(`${at}/photo/instagram`, { as: b, body: jpeg(1080, 1350) });
  assert.equal(r.status, 200, await r.clone().text());
  r = await s.go(at, { as: b, form: { text: 'From the page', instagram_set: '1', instagram_on: 'on', instagram_target: '222|@northloop.coffee', instagram_caption: '', facebook_set: '1', when_iso: '', ai_set: '1', next: 'review' } });
  assert.equal(r.headers.get('location'), `${at}#review`);
  r = await s.go(`${at}/ok`, { as: b, form: {} });
  assert.equal(r.headers.get('location'), '/app/hq/post');
  const p = db.get('hqPosts', id);
  assert.equal(p.status, 'ok');
  assert.equal((await s.go(`/p/m/${id}/instagram/${p.token}`)).status, 404, 'not while it waits');
  p.status = 'posting';
  r = await s.go(`/p/m/${id}/instagram/${p.token}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  p.status = 'ok';
  await posts.cancel(b, p);
  assert.equal((await s.go(`/p/m/${id}/instagram/${p.token}`)).status, 404, 'dead once cancelled');
  assert.equal((await s.go(`/p/m/${id}/instagram/nope`)).status, 404);
  // Someone else's post is a 404.
  assert.equal((await s.go(at, { as: await member() })).status, 404);
});

test('X: the photo goes up as bytes, then the post; each one counts against a daily cap under $100', async () => {
  const b = await boss();
  const go = connectors.startOauth(b, 'x', 'https://127.test');
  const u = new URL(go.url);
  assert.equal(u.origin + u.pathname, 'https://x.com/i/oauth2/authorize');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.match(u.searchParams.get('scope'), /tweet\.write/);
  on('POST', /api\.x\.com\/2\/oauth2\/token/, { access_token: 'X-TOKEN', refresh_token: 'X-R', expires_in: 7200 });
  assert.equal((await connectors.finishOauth(b, go.pending, 'x', { code: 'c', state: go.pending.state }, 'https://127.test')).ok, true);
  on('GET', /api\.x\.com\/2\/users\/me/, { data: { id: '42', username: 'northloop' } });
  on('POST', /api\.x\.com\/2\/media\/upload/, { data: { id: '7777' } });
  on('POST', /api\.x\.com\/2\/tweets/, { data: { id: '9001' } });
  const xp = (await posts.places(b)).x;
  assert.deepEqual(xp.accounts, [{ id: '42', name: '@northloop' }], JSON.stringify(xp));

  assert.equal(posts.xCap(), 20);
  process.env.X_DAILY_USD = '5000';
  assert.equal(posts.xCap(), 100, 'never above $100 a day');
  process.env.X_DAILY_USD = '0.3';
  assert.equal(posts.xCost('Open 7 to 2.'), 0.015);
  assert.equal(posts.xCost('Menu at northloop.coffee/menu or https://x.co'), 0.2);

  const p = await posts.save(b, null, { text: 'Back on bar.', places: { x: { on: true, target: { id: '42', name: '@northloop' } } } });
  await posts.setPhoto(b, p, 'x', jpeg(1600, 900));
  await posts.approve(b, p);
  later(60 * 1000);
  calls = [];
  await posts.tick();
  const done = posts.get(b, p.id);
  assert.equal(done.status, 'done', JSON.stringify(done.results));
  assert.equal(done.results.x.url, 'https://x.com/i/web/status/9001');
  const up = calls.find((c) => /media\/upload/.test(c.url));
  assert.ok(up.body instanceof FormData, 'the bytes, not a link');
  assert.equal(up.headers.authorization, 'Bearer X-TOKEN');
  const tw = calls.find((c) => /2\/tweets/.test(c.url));
  assert.deepEqual(JSON.parse(tw.body), { text: 'Back on bar.', media: { media_ids: ['7777'] } });
  assert.equal(posts.xSpent(now), 0.015);

  // A link post would pass the $0.30 cap: it can't be OK'd for today, and one already OK'd doesn't go.
  const q = await posts.save(b, null, { text: 'See https://northloop.coffee', places: { x: { on: true, target: { id: '42', name: '@northloop' } } } });
  assert.deepEqual(posts.problems(b, q), []);
  await posts.approve(b, q);
  process.env.X_DAILY_USD = '0.2';
  later(60 * 1000);
  calls = [];
  await posts.tick();
  assert.equal(posts.get(b, q.id).status, 'failed');
  assert.match(posts.get(b, q.id).results.x.error, /today's limit/);
  assert.equal(calls.filter((c) => /2\/tweets/.test(c.url)).length, 0, 'nothing spent');
  assert.match(posts.problems(b, posts.get(b, q.id)).join(' '), /today's limit/);

  // A post X refuses is given back to the day's total.
  process.env.X_DAILY_USD = '20';
  on('POST', /api\.x\.com\/2\/tweets/, { $status: 403 });
  const r2 = await posts.save(b, null, { text: 'Nope', places: { x: { on: true, target: { id: '42', name: '@northloop' } } } });
  await posts.approve(b, r2);
  const before = posts.xSpent(now);
  later(60 * 1000);
  await posts.tick();
  assert.equal(posts.get(b, r2.id).status, 'failed');
  assert.equal(posts.xSpent(now), before);
});

test('Legal L93: AI-made people, brand deals, X card text', async () => {
  const b = await boss();
  const p = await posts.save(b, null, { text: 'Meet Ava', ai: true, places: { instagram: { on: true, target: { id: '222', name: '@x' } }, facebook: { on: true, target: { id: '111', name: 'P' } }, x: { on: true, target: { id: '42', name: '@x' } } } });
  const bad = posts.problems(b, p);
  assert.equal(bad.filter((x) => /Meta's AI label/.test(x)).length, 1, 'said once for both Meta places');
  assert.ok(bad.some((x) => /On X, start the caption with "AI-generated person"/.test(x)));
  await posts.save(b, p, { places: { x: { on: true, caption: 'AI-generated person: meet Ava' } } });
  assert.ok(!posts.problems(b, p).some((x) => /On X/.test(x)));
  await posts.save(b, p, { ai: false, paid: true });
  assert.ok(posts.problems(b, p).some((x) => /Start the Instagram caption with #ad, and use the platform's paid partnership label/.test(x)));
  await posts.save(b, p, { places: { instagram: { on: true, caption: '#ad Our new mug' } } });
  assert.ok(!posts.problems(b, p).some((x) => /Instagram caption with #ad/.test(x)));
  assert.equal(connectors.catalog.byId.x.writes, "Posts only what you OK in HQ's composer, at the time you pick");
});

test('account deletion takes posts and photos', async () => {
  const b = await member('builder');
  const p = await posts.save(b, null, { text: 'Bye' });
  await posts.setPhoto(b, p, 'facebook', jpeg(800, 800));
  await posts.forget(b.id);
  assert.equal(db.get('hqPosts', p.id), null);
  assert.equal(await db.getBlob(`post_${p.id}_facebook`), null);
});
