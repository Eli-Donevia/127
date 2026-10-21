// The free website builder (FREE_SITE_BUILDER, lib/doors.js and public/funnels/door.js): the Site door with its own
// words, the site's motion playing in the result (its scripts on, sandboxed without same-origin), three designs to try
// on the same words, a "Made with 127" link in the site's footer (Legal W7), and nothing of it while the switch is off.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-free-sites-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-free-sites-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
process.env.SESSION_SECRET = 'test-secret';
// The 24 designs with motion join the site pack when it loads.
process.env.SITE_MOTION = 'on';
for (const k of ['ANTHROPIC_API_KEY', 'FRONT_DOORS_AI', 'DOORS_PER_IP', 'DOORS_REDESIGN_PER_IP', 'FREE_SITE_BUILDER', 'HARNESS_PAUSE', 'PRELAUNCH']) delete process.env[k];
Object.assign(process.env, { FRONT_DOORS: 'true', HARNESS_V2: 'on', TERMS_LIVE: 'true', PRIVACY_LIVE: 'true' });

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const db = require('../lib/db');
const doors = require('../lib/doors');
const D = require('../public/funnels/doors-data.js');
const harness = require('../lib/harness');
const { buildSite } = require('../lib/packs/site/lib/site');
const { factsFrom } = require('../lib/packs/site/lib/facts');
const { draftCopy } = require('../lib/packs/site/lib/copy');
const { TEMPLATES } = require('../lib/packs/site/lib/templates');
const { unzip } = require('../lib/packs/_kit/files');

const SITE = D.doors.site.sample.values;
const MOVING = TEMPLATES.filter((t) => t.animated).map((t) => t.id);

function app({ limited = () => false } = {}) {
  const a = express();
  a.use((req, res, next) => {
    req.user = null;
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
const result = async (res) => {
  const ls = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  return ls[ls.length - 1].run;
};
const config = (html) => JSON.parse(html.match(/window\.DOOR=(.*?);<\/script>/)[1]);

test.before(async () => {
  await db.init();
  harness.init();
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

test('switched off, the Site door is as it was: its own words, a still preview, one design and no link', async () => {
  delete process.env.FREE_SITE_BUILDER;
  await serve(app(), async (base) => {
    const html = await (await fetch(base + '/site-tonight')).text();
    assert.match(html, /<title>Site in a night · 127<\/title>/);
    assert.equal(config(html).freeBuilder, undefined);
    assert.doesNotMatch(html, /classList\.add\('fb'\)/);
    const v = await result(await post(base, '/api/door/site/run', { ...SITE, design: MOVING[1] }));
    assert.equal(v.result.designs, undefined);
    assert.notEqual(v.result.design, MOVING[1], "a design from the request is ignored while it's off");
    const p = v.files.find((f) => f.key === 'preview');
    const r = await fetch(base + p.open);
    const csp = r.headers.get('content-security-policy');
    assert.doesNotMatch(csp, /script-src|allow-scripts/);
    assert.doesNotMatch(await r.text(), /Made with 127/);
    assert.equal((await post(base, '/api/door/site/redesign', { id: v.id, k: v.k, design: MOVING[0] })).status, 404);
  });
});

test("switched on, the page is the free website builder, with every design that moves to try", async () => {
  process.env.FREE_SITE_BUILDER = 'on';
  await serve(app(), async (base) => {
    const html = await (await fetch(base + '/site-tonight')).text();
    const F = D.doors.site.freeBuilder;
    assert.match(html, /<title>Free website builder · 127<\/title>/);
    assert.match(html, /<script>document\.documentElement\.classList\.add\('fb'\);window\.DOOR=/, 'marked as the builder before the first paint');
    const c = config(html);
    assert.equal(c.h1, F.page.h1);
    assert.equal(c.button, F.page.button);
    const n = String(require('../lib/packs/site/lib/templates').TEMPLATES.filter((t) => t.animated).length);
    assert.deepEqual(c.free, F.page.free.map((t) => t.replace('{n}', n)));
    assert.match(c.free[1], new RegExp(`^All ${n} designs`));
    assert.equal(c.result.heading, F.page.heading);
    assert.equal(c.result.design, F.page.design, 'the result names the design without its long description');
    assert.equal(c.design, undefined);
    assert.equal(c.result.deploy, D.doors.site.result.deploy, "the rest of the result's words stay");
    assert.deepEqual(c.freeBuilder.all.map((d) => d.id), MOVING);
    assert.equal(MOVING.length, 24);
    assert.deepEqual(c.freeBuilder.keep, F.keep);
    assert.equal(c.freeBuilder.lasts, F.lasts);
    assert.match(F.lasts, /lasts \{days\} days from when you made it\.$/);
    assert.match(c.result.netlify, /^This is your own Netlify account, not 127's\. Netlify is a separate company\./);
    // "Build it with these words" runs the made-up example's own words, and the example plays in three designs.
    assert.deepEqual(c.sample, { label: F.example.try, values: F.example.values });
    assert.equal(c.freeBuilder.example.src, '/door/site/example/');
    assert.equal(c.freeBuilder.example.designs.length, 3);
    assert.ok(c.freeBuilder.example.designs.every((d) => MOVING.includes(d.id) && d.name));
    assert.match(c.freeBuilder.example.caption, /is made up/);
  });
});

test('the example is the made-up business in its three designs, playing under the same rules, and only while on', async () => {
  delete process.env.FREE_SITE_BUILDER;
  await serve(app(), async (base) => {
    assert.equal((await fetch(base + '/door/site/example/' + MOVING[0])).status, 404);
  });
  process.env.FREE_SITE_BUILDER = 'on';
  await serve(app(), async (base) => {
    const c = config(await (await fetch(base + '/site-tonight')).text());
    const [first] = c.freeBuilder.example.designs;
    const r = await fetch(base + c.freeBuilder.example.src + first.id);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/html/);
    const csp = r.headers.get('content-security-policy');
    assert.match(csp, /script-src 'unsafe-inline'/);
    assert.match(csp, /sandbox allow-scripts allow-top-navigation-to-custom-protocols$/);
    assert.doesNotMatch(csp, /allow-same-origin|connect-src|https:/);
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(r.headers.get('x-robots-tag'), 'noindex');
    assert.equal(r.headers.get('cache-control'), 'public, max-age=600');
    const page = await r.text();
    assert.match(page, new RegExp(D.doors.site.freeBuilder.example.values.business));
    assert.doesNotMatch(page, /<script[^>]+src=|<link[^>]+href="https?:/);
    // Only the three designs picked for it.
    const other = MOVING.find((id) => !c.freeBuilder.example.designs.some((d) => d.id === id));
    assert.equal((await fetch(base + '/door/site/example/' + other)).status, 404);
    assert.equal((await fetch(base + '/door/site/example/nope')).status, 404);
  });
});

test('a run builds the best fit with the "Made with 127" link, offers three designs, and its preview plays sandboxed', async () => {
  process.env.FREE_SITE_BUILDER = 'on';
  await serve(app(), async (base) => {
    const v = await result(await post(base, '/api/door/site/run', SITE));
    const x = v.result;
    assert.equal(x.designs.length, 3);
    assert.equal(new Set(x.designs.map((d) => d.id)).size, 3);
    assert.ok(x.designs.every((d) => MOVING.includes(d.id) && d.name && d.why));
    assert.equal(x.design, x.designs[0].id, 'the best fit is built first');
    const p = v.files.find((f) => f.key === 'preview');
    const r = await fetch(base + p.open);
    const csp = r.headers.get('content-security-policy');
    // Its own inline scripts run, in an opaque origin: no same-origin, nothing fetched, posted or loaded from outside.
    assert.match(csp, /script-src 'unsafe-inline'/);
    assert.match(csp, /sandbox allow-scripts allow-top-navigation-to-custom-protocols$/);
    assert.doesNotMatch(csp, /allow-same-origin|connect-src|https:/);
    assert.match(csp, /default-src 'none'.*form-action 'none'.*frame-ancestors 'self'/);
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    const page = await r.text();
    // Legal L97 CH17: on 127's preview the mark has a Report link to 127's email (the sandbox lets it open the email app).
    const made = '<p class="legal-links"><a href="privacy\\.html">Privacy<\\/a> · <a href="https:\\/\\/127\\.test\\/site-tonight\\?utm_source=made-with-127">Made with 127<\\/a>';
    assert.match(page, new RegExp(`${made} · <a href="mailto:hello@127group\\.io\\?subject=Report%20a%20site">Report<\\/a><\\/p>`));
    // The ZIP and the share image download as before, and the site itself has no outside requests to allow.
    const zip = v.files.find((f) => f.key === 'zip');
    const z = await fetch(base + zip.url);
    assert.match(z.headers.get('content-disposition'), /^attachment/);
    assert.doesNotMatch(z.headers.get('content-security-policy'), /allow-scripts/);
    assert.doesNotMatch(page, /<script[^>]+src=|<link[^>]+href="https?:/);
    // The member's own files have the mark and no Report link: the ZIP's page, and the preview file downloaded.
    const inZip = Object.fromEntries(unzip(Buffer.from(await z.arrayBuffer())).map((e) => [e.name, e.data.toString('utf8')]));
    assert.match(inZip['index.html'], new RegExp(`${made}<\\/p>`));
    assert.doesNotMatch(inZip['index.html'], /Report/);
    assert.doesNotMatch(await (await fetch(base + p.url)).text(), /Report a site|Report%20a%20site/);
    // Legal L97 CH12 to CH15: README.txt names Netlify in Legal's words, says the privacy page names it, and leaves the
    // credit to them.
    const readme = inZip['README.txt'];
    assert.ok(readme.includes(D.doors.site.result.netlify), 'the same words as the result page');
    assert.match(readme, /It names Netlify as your website host, the one the steps below use\. If you put the site somewhere else, open privacy\.html in a plain text editor and change Netlify to that host's name\./);
    assert.match(readme, /The "Made with 127" link at the bottom of the page is yours to keep or remove\./);
    assert.doesNotMatch(readme, /keep (the|this|that) (link|credit)|leave (the|this) (link|credit)|must keep/i);
  });
});

test('trying another design makes a new result on the same words; one nobody kept is deleted', async () => {
  process.env.FREE_SITE_BUILDER = 'on';
  await serve(app(), async (base) => {
    const v = await result(await post(base, '/api/door/site/run', SITE));
    const other = v.result.designs[2].id;
    let r = await post(base, '/api/door/site/redesign', { id: v.id, k: v.k, design: other });
    assert.equal(r.status, 200);
    const w = (await r.json()).run;
    assert.notEqual(w.id, v.id);
    assert.equal(w.k, doors.sign(w.id));
    assert.equal(w.result.design, other);
    assert.equal(w.result.business, v.result.business);
    assert.deepEqual(w.result.designs, v.result.designs, 'the three to try stay put');
    assert.equal(w.input.business, SITE.business);
    assert.equal(db.get('doorRuns', v.id), null, 'the result it replaced is gone');
    assert.equal(await db.getBlob(`door_${v.id}_1`), null);
    // Any of the designs that move, not just the three; nothing else.
    const fourth = MOVING.find((id) => !v.result.designs.some((d) => d.id === id));
    r = await post(base, '/api/door/site/redesign', { id: w.id, k: w.k, design: fourth });
    assert.equal((await r.json()).run.result.design, fourth);
    assert.equal((await post(base, '/api/door/site/redesign', { id: w.id, k: 'bad', design: other })).status, 404);
    assert.equal((await post(base, '/api/door/site/redesign', { id: 'nope', k: doors.sign('nope'), design: other })).status, 404);
  });
});

test('a result unlocked by email keeps its email in the new design, and the old one stays for its emailed link', async () => {
  process.env.FREE_SITE_BUILDER = 'on';
  await serve(app(), async (base) => {
    const v = await result(await post(base, '/api/door/site/run', SITE));
    await doors.claim(v.id, v.k, 'maya@example.com');
    const r = await post(base, '/api/door/site/redesign', { id: v.id, k: v.k, design: v.result.designs[1].id });
    const w = (await r.json()).run;
    assert.equal(db.get('doorRuns', w.id).email, 'maya@example.com');
    assert.ok(db.get('doorRuns', v.id), 'the emailed result is kept');
    // HQ's Today offers the newest one.
    assert.equal(doors.latestFor('maya@example.com', 'u-1').id, w.id);
  });
});

test('designs that are not in the list, other doors and too many tries are refused', async () => {
  process.env.FREE_SITE_BUILDER = 'on';
  let calls = 0;
  const limited = (key) => key.startsWith('doorsw:') && ++calls > 1;
  await serve(app({ limited }), async (base) => {
    const v = await result(await post(base, '/api/door/site/run', SITE));
    let r = await post(base, '/api/door/site/redesign', { id: v.id, k: v.k, design: 'local-service' });
    assert.equal(r.status, 400, 'a design without motion is not one of the builder\'s');
    assert.equal((await r.json()).error, D.doors.site.freeBuilder.designs.failed);
    assert.equal((await post(base, '/api/door/site/redesign', { id: v.id, k: v.k, design: '../../x' })).status, 400);
    const offer = await result(await post(base, '/api/door/offer/run', D.doors.offer.sample.values));
    assert.equal((await post(base, '/api/door/site/redesign', { id: offer.id, k: offer.k, design: MOVING[0] })).status, 404);
    r = await post(base, '/api/door/site/redesign', { id: v.id, k: v.k, design: MOVING[3] });
    assert.equal(r.status, 200);
    const w = (await r.json()).run;
    assert.equal((await post(base, '/api/door/site/redesign', { id: w.id, k: w.k, design: MOVING[4] })).status, 429);
  });
});

test('the link takes other words and a page on 127\'s own site only, and never goes on a sample for a prospect', async () => {
  const tool = require('../lib/packs/site/tools/build-site.js');
  const ctx = { log() {}, member: {}, today: '2026-10-21' };
  const f = factsFrom(ctx, SITE);
  const links = async (madeWith, mode = 'me') => {
    const r = await buildSite(ctx, { facts: f, template: 'gather', copy: draftCopy(f, 'gather'), mode, madeWith });
    return r.files.find((x) => x.name === 'index.html').text.match(/<p class="legal-links">(.*?)<\/p>/)[1];
  };
  assert.equal(await links(null), '<a href="privacy.html">Privacy</a>');
  assert.match(await links({ href: 'https://127.test/challenge?ref=AB12', text: 'Built in the Day One Challenge' }), /· <a href="https:\/\/127\.test\/challenge\?ref=AB12">Built in the Day One Challenge<\/a>$/);
  assert.doesNotMatch(await links({ href: 'https://127.test/', text: 'Made with 127' }, 'prospect'), /127\.test/);
  // The tool's input: true, or { text, path } with a path on 127's site.
  assert.ok(tool.input.properties.madeWith.description);
  const { madeWithOf } = require('../lib/packs/site/lib/privacy');
  const at = (m) => madeWithOf(m, 'https://127.test');
  assert.deepEqual(at(true), { href: 'https://127.test/site-tonight?utm_source=made-with-127', text: 'Made with 127' });
  assert.deepEqual(at({ text: 'Built in the Day One Challenge', path: '/challenge?ref=AB12' }), { href: 'https://127.test/challenge?ref=AB12', text: 'Built in the Day One Challenge' });
  // A member's referral link (Marketplace and referrals: /f/CODE?via=site) is a path on 127's site too.
  assert.equal(at({ path: '/f/AB12?via=site' }).href, 'https://127.test/f/AB12?via=site');
  for (const path of ['//evil.example', 'https://evil.example', '/\\evil.example', '/x"><script>', 'challenge']) assert.equal(at({ path }), null, path);
  assert.equal(at(false), null);
  assert.equal(at({ text: 'x'.repeat(90), path: '/' }).text.length, 60);
});

test("README.txt's privacy step matches what privacy.html says about the host, with Netlify's form or an email form", async () => {
  // Legal L97 CH15: the notice names the host, and the README says how to name Netlify there.
  const ctx = { log() {}, member: {}, today: '2026-10-21' };
  const files = async (input) => {
    const f = factsFrom(ctx, input);
    const r = await buildSite(ctx, { facts: f, template: 'gather', copy: draftCopy(f, 'gather'), madeWith: { href: 'https://127.test/site-tonight?utm_source=made-with-127', text: 'Made with 127' } });
    return Object.fromEntries(r.files.map((x) => [x.name, String(x.data)]));
  };
  const net = await files({ ...SITE, email: 'hello@fernhill.example' });
  assert.match(net['privacy.html'], /a hosting service, Netlify,[\s\S]*our website host, Netlify;/);
  assert.match(net['README.txt'], /It names Netlify as your website host/);
  const mail = await files({ ...SITE, email: 'hello@fernhill.example', form: 'email' });
  const readme = mail['README.txt'];
  assert.match(readme, /It says "our website host" where your host's name goes\./);
  // Each phrase the README says to find is in privacy.html as written.
  const swaps = [...readme.matchAll(/"([^"]+)" to "[^"]+"/g)].map((m) => m[1]);
  assert.deepEqual(swaps, ['a hosting service, our website host,', 'our website host, our website host']);
  for (const s of swaps) assert.ok(mail['privacy.html'].includes(s), s);
  assert.ok(readme.includes(D.doors.site.result.netlify));
});
