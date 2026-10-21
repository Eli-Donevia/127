// Fix my website (FIX_MY_SITE, lib/doors.js and packs/site/lib/from-site.js): the free website builder for someone who
// already has a website. They paste it and tick that it's theirs; 127 reads its public pages under Legal G8 (L104) and
// rebuilds it in the designs with their own words and photos, with what it fixed. Admins only until the DMCA agent is
// filed.

const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-fix-site-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-fix-site-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
process.env.SESSION_SECRET = 'test-secret';
process.env.SITE_MOTION = 'on';
for (const k of ['ANTHROPIC_API_KEY', 'FRONT_DOORS_AI', 'DOORS_PER_IP', 'DOORS_REDESIGN_PER_IP', 'DOORS_KEEP_DAYS', 'FIX_MY_SITE', 'DMCA_AGENT_FILED', 'HARNESS_PAUSE', 'PRELAUNCH']) delete process.env[k];
Object.assign(process.env, { FRONT_DOORS: 'true', HARNESS_V2: 'on', TERMS_LIVE: 'true', PRIVACY_LIVE: 'true', FREE_SITE_BUILDER: 'on', ADMIN_EMAILS: 'eli@127.test' });

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const doors = require('../lib/doors');
const funnels = require('../lib/funnels');
const D = require('../public/funnels/doors-data.js');
const harness = require('../lib/harness');
const ctxLib = require('../lib/harness/ctx');
const { media } = require('../lib/packs/_kit');
const { unzip } = require('../lib/packs/_kit/files');
const FS = require('../lib/packs/site/lib/from-site');

const F = D.doors.site.fix;
const ADMIN = { id: 'u_admin', email: 'eli@127.test', emailVerified: true };
const GUEST = { id: 'u_guest', email: 'sam@example.com', emailVerified: true };

// A photo of about 900 by 600 (noise, so it isn't tiny), or JPEG-shaped bytes where there's no ffmpeg.
const jpegs = {};
function jpeg(color) {
  if (jpegs[color]) return jpegs[color];
  if (!media.hasFfmpeg()) return (jpegs[color] = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(9000, color.length)]));
  const out = path.join(os.tmpdir(), `fix-${process.pid}-${color}.jpg`);
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=900x600,noise=alls=60:allf=t`, '-frames:v', '1', '-q:v', '3', '-y', out]);
  jpegs[color] = fs.readFileSync(out);
  fs.rmSync(out, { force: true });
  return jpegs[color];
}

// A bakery's own website, made up: its words and photos, plus what Legal G8 leaves alone (review widgets, an Instagram
// feed, a stock photo, a logo, the cart, login and admin pages, and a page robots.txt keeps bots out of).
const QUOTE = 'Best sourdough in Des Moines.  We drive across town every Saturday for it, and the CROISSANTS sell out by ten!';
const QUOTE2 = '“Our wedding cake was perfect, and it tasted even better than it looked. Thank you, Maria!”';
const HOME = `<!doctype html><html><head><title>Crumb &amp; Co. Bakery | Des Moines Bakery &amp; Custom Cakes</title>
<meta name="description" content="Crumb &amp; Co. is a neighborhood bakery in Des Moines baking sourdough, pastries and custom cakes every morning.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Bakery","name":"Crumb & Co. Bakery","telephone":"+1 515-283-0142","email":"hello@crumbandco.com","address":{"@type":"PostalAddress","streetAddress":"412 Ingersoll Ave","addressLocality":"Des Moines","addressRegion":"IA","postalCode":"50309"},"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Tuesday","Wednesday","Thursday","Friday"],"opens":"07:00","closes":"15:00"},{"@type":"OpeningHoursSpecification","dayOfWeek":"Saturday","opens":"08:00","closes":"14:00"}]}</script>
<script src="https://static.elfsight.com/platform/platform.js"></script><script src="https://www.googletagmanager.com/gtag/js"></script>
</head><body>
<header><a href="/"><img src="/assets/logo.png" class="logo" alt="Crumb &amp; Co. logo"></a>
<nav><a href="/about">About</a><a href="/menu">Menu</a><a href="/contact">Contact</a><a href="/cart">Cart (0)</a><a href="/account/login">Log in</a><a href="/wp-admin/">Admin</a><a href="https://www.instagram.com/crumbandco">Instagram</a></nav></header>
<main>
<section><h1>Bread worth getting up for.</h1><p>Sourdough, pastries and custom cakes, baked every morning on Ingersoll Avenue since 2016.</p>
<img src="https://images.squarespace-cdn.com/content/v1/5f1/hero.jpg?format=1500w" alt="">
<img src="/assets/sourdough.jpg" alt="Sourdough loaves cooling on a rack">
<img src="/assets/pixel.jpg" width="1" height="1" alt=""></section>
<section><h2>What we bake</h2><ul><li>Sourdough loaf, $9</li><li>Croissant box of six, $21</li><li>Custom cakes, from $65</li></ul>
<img src="/assets/cake.jpg"><img src="https://image.shutterstock.com/image-photo/bread-600w-1.jpg" alt="Bread"></section>
<section><h2>Kind words</h2>
<blockquote><p>${QUOTE}</p><cite>&mdash; Dana R.</cite></blockquote>
<div class="testimonial"><p>${QUOTE2}</p><p class="author">Jordan &amp; Sam</p></div>
<div class="ti-widget" data-layout="slider"><div class="ti-reviews"><div class="ti-review-item"><div class="ti-review-text">Five stars from a Google review, the croissants are flaky and the staff is lovely</div><div class="ti-name">Pat Q.</div></div></div></div>
<div class="elfsight-app-9f2"><blockquote>A Facebook recommendation that should never be copied over to the new website</blockquote></div>
<div class="sqs-block instagram-block"><img src="https://scontent.cdninstagram.com/v/t51.2885/123.jpg" alt=""></div></section>
</main>
<footer><p>&copy; 2019 Crumb &amp; Co. Bakery. 412 Ingersoll Ave, Des Moines, IA 50309</p></footer>
</body></html>`;
const PAGES = {
  '/robots.txt': ['text/plain', 'User-agent: *\nDisallow: /menu\n'],
  '/': ['text/html', HOME],
  '/about': ['text/html', `<html><head><title>About | Crumb &amp; Co. Bakery</title></head><body><nav><a href="/">Home</a></nav><main><h1>About us</h1><p>Maria Lopez opened Crumb &amp; Co. in 2016 with one oven and a sourdough starter named Gus. Everything is still shaped by hand, every morning, by a team of six.</p><img src="/assets/team.jpg" alt="Maria shaping loaves"></main></body></html>`],
  '/contact': ['text/html', `<html><head><title>Contact | Crumb &amp; Co. Bakery</title></head><body><main><h1>Visit us</h1><p>412 Ingersoll Ave, Des Moines, IA 50309</p><p>Call (515) 283-0142 or email hello@crumbandco.com</p><iframe src="https://www.google.com/maps/embed?pb=1"></iframe></main></body></html>`],
  '/menu': ['text/html', '<html><body><h1>Menu</h1><p>This page is off limits to bots and must never be read by the reader at all.</p></body></html>'],
  '/assets/sourdough.jpg': ['image/jpeg', () => jpeg('peru')],
  '/assets/cake.jpg': ['image/jpeg', () => jpeg('pink')],
  '/assets/team.jpg': ['image/jpeg', () => jpeg('tan')],
  '/assets/pixel.jpg': ['image/jpeg', () => jpeg('white')],
  '/assets/logo.png': ['image/png', () => Buffer.alloc(8000, 1)],
  '/content/v1/5f1/hero.jpg': ['image/jpeg', () => jpeg('sienna')],
};
let seen = [];
function stubWeb() {
  ctxLib._setDeps({
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetch: async (url) => {
      const u = new URL(url);
      seen.push(u.hostname + u.pathname);
      const page = /^(www\.)?crumbandco\.com$|^images\.squarespace-cdn\.com$/.test(u.hostname) && PAGES[u.pathname];
      if (!page) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      const body = typeof page[1] === 'function' ? page[1]() : page[1];
      return new Response(body, { status: 200, headers: { 'content-type': page[0] } });
    },
  });
}
const realWeb = () => ctxLib._setDeps({ fetch: (...a) => fetch(...a), lookup: (host) => require('dns').promises.lookup(host, { all: true }) });

let user = null;
function app({ limited = () => false } = {}) {
  const a = express();
  a.use(express.urlencoded({ extended: true }));
  a.use((req, res, next) => {
    req.user = user;
    next();
  });
  const page = (file, og, { inject } = {}) => (req, res) => res.type('html').send(`<!--${file}-->${inject ? inject(req) : ''}<title>${og(req).title}</title>`);
  a.use(doors.router({ json: express.json({ limit: '24kb' }), limited, page }));
  a.use((req, res) => res.status(404).send('site 404'));
  return a;
}
async function serve(a, fn) {
  const s = await new Promise((resolve) => {
    const srv = a.listen(0, '127.0.0.1', () => resolve(srv));
  });
  try {
    return await fn(`http://127.0.0.1:${s.address().port}`);
  } finally {
    s.close();
  }
}
const post = (base, url, body) => fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const lines = async (res) => (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
const config = (html) => JSON.parse(html.match(/window\.DOOR=(.*?);<\/script>/)[1]);
const fixOn = (mode = 'admins') => {
  process.env.FIX_MY_SITE = mode;
  user = ADMIN;
};

test.before(async () => {
  await db.init();
  harness.init();
});
test.after(realWeb);
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

test('off, or for anyone but an admin, there is no Fix my website; "on" waits for the DMCA agent', async () => {
  stubWeb();
  seen = [];
  const body = { from: 'crumbandco.com', owner: true };
  await serve(app(), async (base) => {
    delete process.env.FIX_MY_SITE;
    user = ADMIN;
    assert.equal((await fetch(base + F.path)).status, 404);
    assert.equal((await post(base, '/api/door/site/run', body)).status, 400, 'with the switch off a pasted website is a bad entry');
    process.env.FIX_MY_SITE = 'admins';
    user = GUEST;
    assert.equal((await fetch(base + F.path)).status, 404);
    assert.equal((await post(base, '/api/door/site/run', body)).status, 404);
    user = { ...ADMIN, emailVerified: false };
    assert.equal((await fetch(base + F.path)).status, 404, 'an admin address that was never confirmed is not an admin');
    process.env.FIX_MY_SITE = 'on';
    user = GUEST;
    assert.equal(doors.fixMode(), 'admins');
    assert.equal((await fetch(base + F.path)).status, 404);
    process.env.DMCA_AGENT_FILED = 'true';
    assert.equal(doors.fixMode(), 'on');
    assert.equal((await fetch(base + F.path)).status, 200);
    delete process.env.DMCA_AGENT_FILED;
    delete process.env.FREE_SITE_BUILDER;
    assert.equal(doors.fixMode(), 'off', 'it rides on the free website builder');
    process.env.FREE_SITE_BUILDER = 'on';
  });
  assert.deepEqual(seen, [], 'nothing was read');
});

test("the page carries Legal G8's tick, the Terms line under the button and the line under the form", async () => {
  fixOn();
  await serve(app(), async (base) => {
    const html = await (await fetch(base + F.path)).text();
    assert.match(html, /<title>Fix my website · 127<\/title>/);
    const C = config(html);
    assert.deepEqual(C.fields.map((f) => f.name), ['from', 'owner']);
    assert.equal(C.fields[1].label, 'I own or run this website, and I have the right to use its words and photos.');
    assert.equal(C.terms, 'By continuing, you agree to our Terms and Privacy Policy.');
    assert.equal(C.note, "We read your site's public pages once and never log in. Your words and photos go into a preview that only people with its link can see. The link works for 30 days, and nothing on your current site changes.");
    assert.equal(C.sample, null);
    assert.equal(C.freeBuilder.example, null);
    assert.equal(C.fix.buildPath, '/site-tonight');
    // The builder's own page is unchanged.
    const B = config(await (await fetch(base + '/site-tonight')).text());
    assert.deepEqual(B.fields.map((f) => f.name), ['business', 'what', 'services', 'city', 'email']);
    assert.equal(B.fix, undefined);
  });
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'funnels', 'door.js'), 'utf8');
  assert.match(js, /href="\/terms"[^>]*>Terms<\/a>/);
  assert.match(js, /href="\/privacy"[^>]*>Privacy Policy<\/a>/);
});

test('the owner tick and a real address come first, before anything is read', async () => {
  fixOn();
  stubWeb();
  seen = [];
  await serve(app(), async (base) => {
    let r = await post(base, '/api/door/site/run', { from: 'crumbandco.com' });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, F.ownerError);
    r = await post(base, '/api/door/site/run', { from: 'my bakery', owner: true });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, F.badUrl);
  });
  assert.deepEqual(seen, []);
});

let saved = null;
test("it reads the site's public pages under G3's rules and rebuilds it with their words and photos", async () => {
  fixOn();
  stubWeb();
  seen = [];
  const before = db.all('doorRuns').length;
  let out;
  await serve(app(), async (base) => {
    const ls = await lines(await post(base, '/api/door/site/run', { from: 'https://www.crumbandco.com/', owner: 'on' }));
    out = ls[ls.length - 1];
    assert.equal(out.type, 'result', JSON.stringify(out).slice(0, 400));
    assert.deepEqual(ls.filter((l) => l.type === 'progress').map((l) => l.step), [0, 1, 1, 2, 3]);
  });
  saved = out.run;
  const x = saved.result;
  assert.equal(db.all('doorRuns').length, before + 1);
  assert.equal(x.business, 'Crumb & Co. Bakery');
  assert.deepEqual(x.from, { domain: 'crumbandco.com', url: 'https://www.crumbandco.com/' });
  assert.ok(x.designs.length >= 3);

  // Legal G3 and G8: public pages of that site (and its builder's image host) only, within 50 requests, robots.txt
  // kept, and never the cart, an account, a login or an admin page.
  assert.ok(seen.length <= 50, `${seen.length} requests`);
  assert.ok(seen.every((s) => /^(www\.)?crumbandco\.com\/|^images\.squarespace-cdn\.com\//.test(s)), seen.join(' '));
  assert.ok(seen.some((s) => /\/robots\.txt$/.test(s)));
  assert.deepEqual(seen.filter((s) => /\/(menu|cart|account|wp-admin|login)/.test(s)), []);
  assert.deepEqual(seen.filter((s) => /cdninstagram|shutterstock|logo|pixel/.test(s)), [], 'no feed, stock photo, logo or pixel');

  // What it fixed and what it kept.
  const titles = x.fixed.map((f) => f.title);
  assert.ok(titles.includes('Built for phones'), titles.join(', '));
  assert.ok(titles.includes('Up to date'), titles.join(', '));
  assert.ok(x.fixed.length <= 6 && x.fixed.every((f) => f.title && f.line));
  assert.match(x.kept, /your words, \d photos, 3 services, 2 reviews/);

  // The rebuilt site: their words, their photos and their testimonials, word for word with the names as the site
  // shows them (only the spaces between words are tidied), and nothing from the widgets.
  const prev = (saved.files || []).find((f) => f.key === 'preview');
  const site = await serve(app(), async (base) => (await fetch(base + prev.open)).text());
  assert.match(site, /Bread worth getting up for/);
  assert.match(site, /Sourdough loaf/);
  assert.ok(site.includes('Best sourdough in Des Moines. We drive across town every Saturday for it, and the CROISSANTS sell out by ten!'), 'the quote as the site shows it');
  assert.ok(site.includes('Dana R.'));
  assert.ok(site.includes('Our wedding cake was perfect, and it tasted even better than it looked. Thank you, Maria!'));
  assert.ok(site.includes('Jordan &amp; Sam'));
  assert.doesNotMatch(site, /Five stars from a Google review|Facebook recommendation|Pat Q\./);
  assert.match(site, /data:image\/jpeg;base64,/);
  // The Report link names the result, so a report can take it down (G8).
  assert.ok(site.includes(`subject=Report%20a%20site%20${saved.id}`), 'the Report subject names the result');

  // The ZIP: their photos as files, and Legal G8's line in the readme.
  const zipFile = (saved.files || []).find((f) => f.key === 'zip');
  const zip = await serve(app(), async (base) => Buffer.from(await (await fetch(base + zipFile.url)).arrayBuffer()));
  const files = Object.fromEntries(unzip(zip).map((e) => [e.name, e.data]));
  const names = Object.keys(files);
  assert.ok(names.some((n) => /images\/[^/]+\.jpg$/.test(n)), names.join(' '));
  const readme = files[names.find((n) => /README\.txt$/.test(n))].toString('utf8');
  assert.match(readme, /YOUR PHOTOS/);
  assert.ok(readme.includes('Photos that came with your old site builder or a stock site may be licensed only for that site. Check before you reuse them.'));
});

test('another design reuses the read, so their site is never read twice', async () => {
  fixOn();
  stubWeb();
  seen = [];
  const other = saved.result.designs.find((d) => d.id !== saved.result.design).id;
  await serve(app(), async (base) => {
    const r = await post(base, '/api/door/site/redesign', { id: saved.id, k: saved.k, design: other });
    assert.equal(r.status, 200);
    const run = (await r.json()).run;
    assert.equal(run.result.design, other);
    assert.deepEqual(run.result.from, saved.result.from);
    assert.deepEqual(run.result.fixed, saved.result.fixed);
    // Each try is a new result (the one before it goes unless it was claimed), and the read moves with it.
    saved = run;
    user = GUEST;
    assert.equal((await post(base, '/api/door/site/redesign', { id: saved.id, k: saved.k, design: other })).status, 404);
  });
  assert.deepEqual(seen, []);
});

test("past the day's cap it says to come back tomorrow, and a site it can't read says why", async () => {
  fixOn();
  stubWeb();
  await serve(app({ limited: (k) => k === 'door:live' }), async (base) => {
    const r = await post(base, '/api/door/site/run', { from: 'crumbandco.com', owner: true });
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, F.capped);
  });
  ctxLib._setDeps({
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetch: async (url) => (new URL(url).pathname === '/robots.txt' ? new Response('User-agent: *\nDisallow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } }) : new Response('<html><body><h1>Hi</h1></body></html>', { status: 200, headers: { 'content-type': 'text/html' } })),
  });
  await serve(app(), async (base) => {
    const ls = await lines(await post(base, '/api/door/site/run', { from: 'no-bots.example.org', owner: true }));
    const out = ls[ls.length - 1];
    assert.equal(out.type, 'failed', JSON.stringify(out).slice(0, 300));
    assert.equal(out.result.status, 'blocked');
    assert.ok(F.fail[out.result.status]);
  });
});

test("the email says what it fixed and carries Legal's line under the site", async () => {
  fixOn();
  const doc = await doors.claim(saved.id, saved.k, 'maria@crumbandco.com');
  assert.equal(doc.email, 'maria@crumbandco.com');
  const m = funnels.deliveryEmail({ name: 'Maria', email: 'maria@crumbandco.com', source: D.doors.site.source, data: { run_id: saved.id, k: saved.k } }, null);
  assert.equal(m.subject, 'Your website, rebuilt: Crumb & Co. Bakery');
  assert.match(m.text, /Rebuilt from crumbandco\.com with your own words and photos\. Check every line, and that you can use every photo, before you put it online\. This preview link works until [A-Z][a-z]+ \d+, 20\d\d\./);
  assert.match(m.text, /What it fixed:\n1\. /);
  assert.match(m.text, /Open your rebuilt website and download the ZIP: https:\/\/127\.test\/door\/r\//);
  assert.doesNotMatch(m.text, /undefined|\{\w+\}/);
});

test('an admin takes a reported preview down at once; nobody else can', async () => {
  fixOn();
  await serve(app(), async (base) => {
    user = GUEST;
    assert.equal((await fetch(`${base}/door/takedown/${saved.id}`)).status, 404);
    assert.equal((await fetch(`${base}/door/takedown/${saved.id}`, { method: 'POST' })).status, 404);
    assert.ok(db.get('doorRuns', saved.id));
    user = ADMIN;
    const page = await (await fetch(`${base}/door/takedown/${saved.id}`)).text();
    assert.match(page, /crumbandco\.com/);
    assert.match(page, /<form method="post">/);
    const r = await fetch(`${base}/door/takedown/${saved.id}`, { method: 'POST' });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Taken down/);
    assert.equal(db.get('doorRuns', saved.id), null);
    const prev = (saved.files || []).find((f) => f.key === 'preview');
    assert.equal((await fetch(base + prev.open)).status, 404);
  });
});

test('the reader keeps testimonials word for word and leaves widgets, embeds and other services alone', () => {
  const html = `<div class="reviews-embed"><blockquote>Embedded from somewhere else, so this one never comes over at all</blockquote></div>
<blockquote class="x">Plain words on their own page that are long enough to count as a review</blockquote><p>Lee</p>
<div class="grw-review"><div class="testimonial">A Google review widget row that must be skipped by the reader every time</div></div>
<div class="testimonial-card"><p>“Honest work, fair prices and they showed up early on a snowy morning.”</p><span>— Chris</span></div>`;
  const got = FS.reviewsOf([html]);
  assert.deepEqual(got, [
    { name: 'Lee', quote: 'Plain words on their own page that are long enough to count as a review' },
    { name: 'Chris', quote: 'Honest work, fair prices and they showed up early on a snowy morning.' },
  ]);
  const cands = FS.photoCandidates([{ url: 'https://shop.example/', html: '<img src="https://scontent.cdninstagram.com/a.jpg"><img src="https://www.gstatic.com/b.jpg"><img src="https://media.istockphoto.com/c.jpg"><img src="/our-van.jpg" alt="Our van"><img src="/badge-bbb.png"><img src="/img/press-logo.jpg">' }]);
  assert.deepEqual(cands.map((c) => c.url), ['https://shop.example/our-van.jpg']);
});
