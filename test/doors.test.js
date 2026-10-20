// Front doors (lib/doors.js, public/funnels/doors-data.js, door.js, views/partials/doors.ejs): the "What are you
// building?" picker and the four free tools behind it. Each door runs end to end offline (the Store audit on the shop
// pack's sample store, brands from the UGC pack's dated snapshot, the site and offer packs' own templates), then the
// saved result, its files, the email, the account step and the import into 127 HQ. No network: the one live store
// read goes to a stubbed fetch.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-doors-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-doors-${process.pid}`);
process.env.BASE_URL = 'https://127.test';
process.env.SESSION_SECRET = 'test-secret';
for (const k of ['ANTHROPIC_API_KEY', 'FRONT_DOORS', 'FRONT_DOORS_AI', 'DOORS_PER_IP', 'DOORS_LIVE_CAP', 'DOORS_AI_CAP', 'DOORS_KEEP_DAYS', 'ADMIN_EMAILS', 'HARNESS_PAUSE', 'PRELAUNCH', 'JOIN_IS_LAUNCH_CONSENT']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const ejs = require('ejs');

const db = require('../lib/db');
const doors = require('../lib/doors');
const D = require('../public/funnels/doors-data.js');
const funnels = require('../lib/funnels');
const imports = require('../lib/harness/imports');
const harness = require('../lib/harness');
const ctxLib = require('../lib/harness/ctx');
const { check } = require('../lib/copy-check');

const INPUT = {
  store: { store: 'birchandbloom.example' },
  creator: { category: 'skincare', name: 'Maya' },
  site: D.doors.site.sample.values,
  offer: D.doors.offer.sample.values,
};
const ON = () => {
  process.env.FRONT_DOORS = 'true';
  process.env.HARNESS_V2 = 'on';
  process.env.TERMS_LIVE = 'true';
  process.env.PRIVACY_LIVE = 'true';
};

// The doors' routes on their own, with the static page server and the limiter they get from lib/funnels.js.
function app({ limited = () => false, createMember, user, prelaunchGate } = {}) {
  const a = express();
  a.set('view engine', 'ejs');
  a.set('views', path.join(__dirname, '..', 'views'));
  Object.assign(a.locals, { canonical: 'https://127.test/', baseUrl: 'https://127.test', plausible: null, trackEvents: [] });
  a.use((req, res, next) => {
    req.user = user || null;
    next();
  });
  const page = (file, og, { inject } = {}) => (req, res) => res.type('html').send(`<!--${file}-->${inject ? inject(req) : ''}<title>${og(req).title}</title>`);
  a.use(doors.router({ json: express.json({ limit: '24kb' }), limited, page, createMember, prelaunchGate }));
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
const run = (base, door, body) => fetch(`${base}/api/door/${door}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const lines = async (res) => (await res.text()).trim().split('\n').map((l) => JSON.parse(l));

test.before(async () => {
  await db.init();
  harness.init();
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

test('off by default: no picker, the pages fall through to the 404 and runs are refused', async () => {
  delete process.env.FRONT_DOORS;
  assert.equal(doors.picker(null), null);
  await serve(app(), async (base) => {
    for (const id of doors.IDS) assert.equal(await (await fetch(base + D.doors[id].path)).text(), 'site 404');
    assert.equal((await run(base, 'store', INPUT.store)).status, 404);
  });
  // On, but 127 HQ isn't on for members yet: still off for visitors.
  process.env.FRONT_DOORS = 'true';
  process.env.HARNESS_V2 = 'admins';
  assert.equal(doors.picker(null), null);
  ON();
  assert.equal(doors.picker(null).doors.length, 5);
});

test('the picker has five doors, First 25 first, and each free tool has its page', async () => {
  ON();
  const p = doors.picker(null);
  assert.deepEqual(p.doors.map((d) => d.href), ['/first-25', '/store-audit', '/brand-list', '/site-tonight', '/offer-score']);
  assert.equal(p.heading, 'What are you building?');
  await serve(app(), async (base) => {
    for (const id of doors.IDS) {
      const html = await (await fetch(base + D.doors[id].path)).text();
      assert.match(html, /^<!--door\.html-->/);
      const cfg = JSON.parse(html.match(/window\.DOOR=(.*?);<\/script>/)[1]);
      assert.equal(cfg.id, id);
      assert.equal(cfg.hq, true);
      assert.ok(cfg.builderList.length >= 3, `${id} lists Builder's HQ workflows`);
      assert.ok(cfg.builderList.every((w) => harness.packs.workflow(w.id).tier === 'builder'));
    }
  });
  // The Brand list's categories come from the UGC pack.
  const cats = doors.pageConfig('creator').fields[0].options;
  assert.ok(cats.length >= 5 && cats.some(([id, label]) => id === 'skincare' && label === 'Skincare'));
});

const saved = {};
test('each door runs end to end offline: streamed steps, then the result with its files and Builder side', async () => {
  ON();
  await serve(app(), async (base) => {
    for (const id of doors.IDS) {
      const res = await run(base, id, INPUT[id]);
      assert.equal(res.status, 200, id);
      assert.match(res.headers.get('content-type'), /application\/x-ndjson/);
      const ls = await lines(res);
      assert.deepEqual(ls.filter((l) => l.type === 'progress').map((l) => l.step), [0, 1, 2, 3], id);
      const out = ls[ls.length - 1];
      assert.equal(out.type, 'result', `${id}: ${JSON.stringify(out).slice(0, 200)}`);
      const v = out.run;
      assert.equal(v.door, id);
      assert.equal(v.k, doors.sign(v.id));
      assert.equal(v.hq, true);
      assert.ok(v.builder.length >= 3);
      assert.ok(v.files.length >= 1 && v.files.every((f) => f.url.startsWith(`/door/r/${v.id}/file/`) && f.url.includes(`k=${v.k}`)));
      const doc = db.get('doorRuns', v.id);
      assert.ok(doc && doc.summary && doc.email === null);
      for (const f of doc.files) assert.ok(await db.getBlob(`door_${doc.id}_${f.n}`), `${id} file ${f.n} kept`);
      saved[id] = v;
    }
  });
  const s = saved.store.result;
  assert.equal(saved.store.sample, true, 'the sample store is labeled a sample');
  assert.ok(s.score >= 0 && s.score <= 100 && s.fixes.length > 3 && s.mock && s.mock.product.title);
  assert.deepEqual(saved.store.files.map((f) => f.key).sort(), ['issues', 'mock', 'report']);
  const c = saved.creator.result;
  assert.equal(c.brands.length, 25);
  assert.match(c.brands[0].msg.dm, /^Hi .+ team!/);
  assert.match(c.brands[0].msg.follow1Email, /\[your mailing address\]|Reply "no thanks"|unsubscribe/i, 'email follow-ups carry the address and the opt-out');
  assert.ok(c.brief && c.brief.lines.length >= 3);
  assert.equal(saved.creator.sample, false);
  const site = saved.site.result;
  assert.equal(site.business, 'Fern Hill Pottery');
  assert.ok(saved.site.files.some((f) => f.key === 'zip' && f.type === 'application/zip') && saved.site.files.some((f) => f.key === 'preview' && f.open));
  const o = saved.offer.result;
  assert.ok(o.score >= 0 && o.after >= o.score);
  assert.equal(o.fixes.length, 3, 'the 3 fixes the "after" score counts');
  assert.ok(o.magnet && o.magnet.title && o.magnet.post);
});

test("Legal's front door conditions show up in what each door makes (G3 to G6)", async () => {
  const blob = async (door, key) => {
    const v = saved[door];
    const f = v.files.find((x) => x.key === key);
    return String(await db.getBlob(`door_${v.id}_${f.url.match(/\/file\/(\d+)/)[1]}`));
  };
  // G3: the rebuilt page is marked a mock-up, in the file itself.
  assert.match(await blob('store', 'mock'), /Mock-up/);
  // G4: public facts with their sources, and the brief ends with the line on paid posts.
  const c = saved.creator.result;
  assert.ok(c.brands.every((b) => /^https:\/\/[^/]+/.test(b.url) && (!b.product || /^https:\/\/.+\/products\//.test(b.product.url))));
  assert.ok((await blob('creator', 'brief')).endsWith(`\n\n${D.doors.creator.result.disclose}\n`));
  assert.ok(c.brands.every((b) => !/\b(pays?|paid|looking for)\b/i.test(`${b.gap || ''} ${b.gaps.join(' ')} ${b.msg.dm}`)), 'no brand is said to pay or to look for creators');
  // G6: the freebie makes no income or results claims.
  const texts = [];
  const walk = (x) => (typeof x === 'string' ? texts.push(x) : x && typeof x === 'object' ? Object.values(x).forEach(walk) : null);
  walk(saved.offer.result.magnet);
  walk(saved.offer.result.rewrite);
  assert.deepEqual(texts.flatMap((t) => check(t).filter((f) => f.severity === 'block').map((f) => `${f.rule}: ${t}`)), []);
  // The part 5 lines, word for word.
  assert.equal(D.doors.store.fields.find((f) => f.name === 'owner').label, 'I own or run this store.');
  assert.match(D.doors.store.note, /We read your store's public pages once\. The mock-up is just for you\.$/);
  assert.equal(D.doors.offer.result.reads, "How clear and strong your offer reads today. It isn't a prediction of sales.");
  assert.equal(D.doors.creator.result.disclose, 'If a brand pays you or sends free product, say so in the post (like #ad).');
  // G1: the keep line says when it goes.
  assert.match(D.copy.saved, /then deleted, unless you bring it into 127 HQ/);
  // The page never ticks the owner box for the visitor, from a link or from last time.
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'funnels', 'door.js'), 'utf8');
  assert.match(js, /if \(!el \|\| f\.type === 'checkbox' \|\| val == null/);
});

test('a live store audit reads public pages only: no cart, checkout or account page, 50 requests at most (Legal G3)', async () => {
  // The guard on its own.
  const calls = [];
  const inner = async (url) => {
    calls.push(url);
    return new URL(url).pathname === '/go' ? new Response(null, { status: 302, headers: { location: '/account/login' } }) : new Response('ok');
  };
  const meter = {};
  const f = doors.storeFetch(inner, meter);
  await assert.rejects(f('https://shop.test/cart.js'), /cart, checkout or account/);
  await assert.rejects(f('https://shop.test/en-us/checkouts/abc'), /cart, checkout or account/);
  await assert.rejects(f('https://shop.test/go'), /cart, checkout or account/);
  assert.deepEqual(calls, ['https://shop.test/go'], 'nothing private was requested, not even after the redirect');
  assert.equal((await f('https://shop.test/collections/cart-accessories')).status, 200);
  meter.storeFetches = 49;
  assert.equal((await f('https://shop.test/products.json')).status, 200);
  await assert.rejects(f('https://shop.test/products.json'), /stops at 50 requests/);

  // A whole audit of a live Shopify store, through the stubbed network.
  ON();
  const seen = [];
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
  const product = (i, alt) => ({ id: i, title: `Speckled Mug ${i}`, handle: `mug-${i}`, body_html: '<p>Hand-thrown stoneware mug that holds 12 ounces of coffee. Dishwasher safe and made in Iowa.</p>', vendor: 'Fern Hill', product_type: 'Mugs', created_at: '2026-09-01T00:00:00Z', tags: 'mug', options: [{ name: 'Title' }], variants: [{ price: '32.00', available: true }], images: [{ src: `https://cdn.shopify.com/s/files/mug-${i}.jpg`, width: 1200, height: 1200, ...(alt ? { alt: '' } : {}) }] });
  ctxLib._setDeps({
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetch: async (url, o = {}) => {
      seen.push({ url, ua: (o.headers || {})['User-Agent'] || '' });
      const u = new URL(url);
      if (u.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\n', { status: 200, headers: { 'content-type': 'text/plain' } });
      if (u.pathname === '/') return new Response('<html><head><title>Fern Hill Pottery</title><link rel="stylesheet" href="https://cdn.shopify.com/s/theme.css"></head><body><a href="/cart">Cart</a><a href="/account/login">Log in</a><a href="/products/mug-1">Mug</a></body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (u.pathname === '/products.json') return json({ products: [1, 2, 3].map((i) => product(i)) });
      if (u.pathname === '/meta.json') return json({ name: 'Fern Hill Pottery', country: 'US', published_products_count: 3 });
      if (u.pathname === '/collections.json') return json({ collections: [] });
      const m = u.pathname.match(/^\/products\/mug-(\d)(\.json)?$/);
      if (m && m[2]) return json({ product: product(Number(m[1]), true) });
      if (m) return new Response(`<html><head><title>Speckled Mug ${m[1]}</title><link href="https://cdn.shopify.com/s/theme.css"></head><body><h1>Speckled Mug ${m[1]}</h1></body></html>`, { status: 200, headers: { 'content-type': 'text/html' } });
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    },
  });
  let out;
  try {
    await serve(app(), async (base) => {
      const ls = await lines(await run(base, 'store', { store: 'fernhillpottery.com', owner: true }));
      out = ls[ls.length - 1];
    });
  } finally {
    ctxLib._setDeps({ fetch: (...a) => fetch(...a), lookup: (host) => require('dns').promises.lookup(host, { all: true }) });
  }
  assert.equal(out.type, 'result', JSON.stringify(out).slice(0, 300));
  assert.equal(out.run.sample, false);
  assert.equal(out.run.result.store.domain, 'fernhillpottery.com');
  assert.ok(seen.length > 3 && seen.length <= 50, `${seen.length} requests`);
  assert.deepEqual(seen.filter((x) => /\/(cart|checkouts?|account)/.test(new URL(x.url).pathname)), []);
  assert.ok(seen.every((x) => new URL(x.url).hostname === 'fernhillpottery.com'), 'only the store itself');
  assert.ok(seen.every((x) => /127-workflows/.test(x.ua)), "under 127's own user agent");
});

test('bad entries come back before a run starts, and the honeypot and the daily limit hold', async () => {
  ON();
  await serve(app(), async (base) => {
    const bad = async (door, body, re) => {
      const r = await run(base, door, body);
      assert.equal(r.status, 400, `${door} ${JSON.stringify(body)}`);
      assert.match(r.headers.get('content-type'), /json/);
      assert.match((await r.json()).error, re);
    };
    await bad('store', { store: 'x' }, /Paste your store address/);
    // Legal G3: a real store runs only once the visitor ticks the owner box (the sample store needs none).
    await bad('store', { store: 'realstore.com' }, /Tick the box to confirm you own or run this store/);
    await bad('store', { store: 'realstore.com', owner: false }, /Tick the box/);
    await bad('creator', { category: 'nope' }, /Pick what you want to film/);
    await bad('site', { business: 'Fern Hill Pottery' }, /Say what it does/);
    await bad('site', { business: 'A shop', what: 'Candles', email: 'not-an-email' }, /email for your page looks off/);
    await bad('offer', { what: 'Coaching', price: 'lots' }, /price as a number/);
    await bad('store', { ...INPUT.store, website: 'spam.com' }, /Something went wrong/);
    assert.equal((await run(base, 'nope', {})).status, 404);
  });
  await serve(app({ limited: (key) => key.startsWith('door:') && !key.startsWith('door:live') && !key.startsWith('door:ai') }), async (base) => {
    const r = await run(base, 'offer', INPUT.offer);
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, D.copy.limit);
  });
});

test("past the day's live cap a store audit still answers, on the labeled sample store", async () => {
  ON();
  await serve(app({ limited: (key) => key === 'door:live' }), async (base) => {
    const ls = await lines(await run(base, 'store', { store: 'realstore.com', owner: true }));
    const v = ls[ls.length - 1].run;
    assert.equal(v.capped, true);
    assert.equal(v.sample, true);
    assert.equal(v.input.store, 'realstore.com');
  });
});

test("a live store the audit can't read says why, and nothing is saved", async () => {
  ON();
  const before = db.all('doorRuns').length;
  ctxLib._setDeps({
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetch: async () => new Response('<html><head><title>Not a shop</title></head><body>Hello</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  });
  try {
    await serve(app(), async (base) => {
      const ls = await lines(await run(base, 'store', { store: 'not-a-shop.com', owner: 'on' }));
      const out = ls[ls.length - 1];
      assert.equal(out.type, 'failed', JSON.stringify(out).slice(0, 300));
      assert.equal(out.result.ok, false);
      assert.ok(D.doors.store.fail[out.result.status], `the page has a title for ${out.result.status}`);
    });
  } finally {
    ctxLib._setDeps({ fetch: (...a) => fetch(...a), lookup: (host) => require('dns').promises.lookup(host, { all: true }) });
  }
  assert.equal(db.all('doorRuns').length, before);
});

test('a saved result opens with its signature only, unlocked, and its config can never close the script', async () => {
  ON();
  const v = saved.site;
  await serve(app(), async (base) => {
    const html = await (await fetch(`${base}/door/r/${v.id}?k=${v.k}`)).text();
    const back = JSON.parse(html.match(/window\.DOOR_RUN=(.*?);<\/script>/)[1]);
    assert.equal(back.id, v.id);
    assert.equal(back.result.business, 'Fern Hill Pottery');
    assert.equal(await (await fetch(`${base}/door/r/${v.id}?k=${'0'.repeat(32)}`)).text(), 'site 404');
    assert.equal(await (await fetch(`${base}/door/r/nope?k=x`)).text(), 'site 404');
  });
  const ls = await (async () => {
    let out;
    await serve(app(), async (base) => {
      out = await lines(await run(base, 'site', { business: '</script><script>alert(1)</script>', what: 'Candles <b>hot</b>' }));
    });
    return out;
  })();
  const evil = ls[ls.length - 1].run;
  await serve(app(), async (base) => {
    const html = await (await fetch(`${base}/door/r/${evil.id}?k=${evil.k}`)).text();
    assert.equal(html.match(/<\/script>/g).length, 1);
    assert.match(html, /\\u003c\/script>\\u003cscript>alert\(1\)/);
  });
});

test('files: HTML shows as text unless previewed in a sandbox, and only its own result page may frame it', async () => {
  ON();
  const v = saved.store;
  const report = v.files.find((f) => f.key === 'report');
  const issues = v.files.find((f) => f.key === 'issues');
  await serve(app(), async (base) => {
    let r = await fetch(base + report.url);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/plain/);
    assert.match(r.headers.get('content-disposition'), /^attachment; filename=".+\.html"$/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'.*sandbox/);
    r = await fetch(base + report.open);
    assert.match(r.headers.get('content-type'), /^text\/html/);
    assert.match(r.headers.get('content-disposition'), /^inline/);
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'self'; sandbox/);
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    r = await fetch(base + issues.url);
    assert.match(r.headers.get('content-type'), /^text\/csv/);
    assert.match(r.headers.get('content-disposition'), /^attachment/);
    assert.equal(r.headers.get('x-frame-options'), null);
    assert.equal((await fetch(`${base}/door/r/${v.id}/file/1?k=bad`)).status, 404);
    assert.equal((await fetch(`${base}/door/r/${v.id}/file/99?k=${v.k}`)).status, 404);
  });
});

test('the email gate claims the result, and the email is rebuilt from the saved result', async () => {
  ON();
  const v = saved.creator;
  assert.equal(await doors.claim(v.id, 'bad', 'maya@example.com'), null);
  const doc = await doors.claim(v.id, v.k, ' Maya@Example.com ');
  assert.equal(doc.email, 'maya@example.com');
  const lead = { name: 'Maya', email: 'maya@example.com', source: 'brand-list', data: { run_id: v.id, k: v.k } };
  const m = funnels.deliveryEmail(lead, null);
  assert.equal(m.subject, 'Your 25 brands: skincare');
  assert.match(m.text, /^Hi Maya,/);
  assert.match(m.text, new RegExp(`https://127\\.test/door/r/${v.id}\\?k=${v.k}`));
  assert.match(m.text, /\n1\. .+: .+ https:\/\//);
  assert.match(m.text, /Store facts from each brand's own public product feed, as read on [A-Z][a-z]+ \d+, 20\d\d\./);
  assert.match(m.text, /Keep going in 127 HQ\. Start free\./);
  assert.doesNotMatch(m.text, /roadmap is ready/);
  assert.match(m.text, /Builder adds, in 127 HQ: /);
  assert.match(m.text, /127 is education and tools, not a promise of income/);
  assert.match(m.text, new RegExp(`/start/door/${v.id}\\?k=${v.k}`), "Start free goes to the result's own signup");
  assert.doesNotMatch(m.text, /undefined|\{\w+\}/);
  // A link that doesn't match its result never carries someone else's.
  const forged = funnels.deliveryEmail({ ...lead, data: { run_id: v.id, k: 'x' } }, null);
  assert.match(forged.text, /didn't save on our side/);
  for (const id of ['store', 'site', 'offer']) {
    const e = funnels.deliveryEmail({ name: '', email: 'a@b.co', source: D.doors[id].source, data: { run_id: saved[id].id, k: saved[id].k } }, null);
    assert.doesNotMatch(e.text, /undefined|\{\w+\}/, id);
    assert.match(e.text, new RegExp(`/door/r/${saved[id].id}\\?k=`), id);
  }
  assert.match(funnels.deliveryEmail({ name: '', source: 'store-audit', data: { run_id: saved.store.id, k: saved.store.k } }, null).text, /Sample data, made up to show how it works/);
  assert.match(funnels.deliveryEmail({ name: '', source: 'offer-score', data: { run_id: saved.offer.id, k: saved.offer.k } }, null).text, /out of 100\. How clear and strong your offer reads today\. It isn't a prediction of sales\./);
});

test('the lead form knows the four doors, each with its own consent wording', () => {
  const consent = require('../lib/consent');
  for (const id of doors.IDS) {
    const src = D.doors[id].source;
    assert.equal(doors.doorOfSource(src), id);
    const c = consent.copy(src);
    assert.equal(c.version, `${src}-off-v1`);
    assert.match(c.line, /^We'll email your (audit|list|site|results)\. Unsubscribe anytime\.$/);
  }
  assert.ok(require('../lib/waitlist').SOURCES.includes('offer-score'));
});

test('the account step makes a free account and goes to the import, or sends them to sign in', async () => {
  ON();
  const v = saved.creator;
  const made = [];
  const createMember = async (req, o) => {
    made.push(o);
    return db.save('users', { email: o.email, name: o.name, tier: 'free' });
  };
  await serve(app({ createMember }), async (base) => {
    let r = await fetch(`${base}/start/door/${v.id}?k=${v.k}`);
    assert.equal(r.status, 200);
    const page = await r.text();
    assert.match(page, /Bring your brand list into 127 HQ/);
    assert.match(page, /value="maya@example\.com"/, 'the email from the gate is filled in');
    assert.match(page, new RegExp(`/login\\?next=${encodeURIComponent(`/app/hq/import/door/${v.id}?k=${v.k}`)}`));
    r = await fetch(`${base}/start/door/${v.id}?k=bad`, { redirect: 'manual' });
    assert.equal(r.headers.get('location'), '/start');
    const form = (o) => fetch(`${base}/start/door/${v.id}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ k: v.k, ...o }).toString() });
    r = await form({ email: 'new@example.com', password: 'short' });
    assert.equal(r.status, 400);
    assert.match(await r.text(), /at least 8 characters/);
    r = await form({ email: 'new@example.com', password: 'longenough', name: 'New' });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), `/app/hq/import/door/${v.id}?k=${v.k}`);
    assert.equal(made[0].fallbackSource, 'door:creator');
    r = await form({ email: 'new@example.com', password: 'longenough' });
    assert.match(await r.text(), /already has an account/);
  });
  // Signed in: straight to the import. Before launch: the founding list.
  await serve(app({ user: { id: 'u1', email: 'x@y.co' } }), async (base) => {
    const r = await fetch(`${base}/start/door/${v.id}?k=${v.k}`, { redirect: 'manual' });
    assert.equal(r.headers.get('location'), `/app/hq/import/door/${v.id}?k=${v.k}`);
  });
  await serve(app({ prelaunchGate: () => true }), async (base) => {
    const r = await fetch(`${base}/start/door/${v.id}?k=${v.k}`, { redirect: 'manual' });
    assert.equal(r.headers.get('location'), '/founding');
  });
});

test('into 127 HQ: files to the Library, brands to the Pipeline, only empty facts, nothing twice', async () => {
  ON();
  harness.init();
  const v = saved.creator;
  const user = await db.save('users', { email: 'brands@example.com', name: 'Maya Lee', tier: 'free' });
  assert.equal(imports.doorPreview(user, v.id, 'bad'), null);
  const p = imports.doorPreview(user, v.id, v.k);
  assert.equal(p.leads, 25);
  assert.equal(p.again, false);
  await harness.brain.update(user, { business: { city: 'Austin' } });
  const out = await imports.importDoor(user, v.id, v.k);
  assert.deepEqual({ title: out.title, added: out.added, files: out.files, again: out.again }, { title: 'Brand list', added: 25, files: 2, again: false });
  const leads = harness.pipeline.list(user.id, { pack: 'ugc', limit: 100 });
  assert.equal(leads.length, 25);
  assert.ok(leads[0].msg && leads[0].msg.dm, 'each brand comes with its first message');
  const b = harness.brain.snapshot(user).business;
  assert.match(b.what, /UGC videos for skincare brands/);
  assert.equal(b.city, 'Austin', "what the member wrote isn't touched");
  assert.equal(b.niche, harness.packs.pack('ugc').title, 'the business type is picked for them');
  assert.equal(require('../lib/harness/library').list(user.id).length, 2);
  const again = await imports.importDoor(user, v.id, v.k);
  assert.deepEqual({ added: again.added, updated: again.updated, files: again.files, again: again.again }, { added: 0, updated: 25, files: 0, again: true });
  assert.equal(require('../lib/harness/library').list(user.id).length, 2);
  assert.equal(imports.doorPreview(user, v.id, v.k).again, true);

  // A sample store brings its files only: none of it is their business.
  const u2 = await db.save('users', { email: 'store@example.com', name: 'Sam', tier: 'free' });
  const s = await imports.importDoor(u2, saved.store.id, saved.store.k);
  assert.equal(s.sample, true);
  assert.equal(s.files, 3);
  assert.equal(harness.brain.snapshot(u2).business.name, undefined);
  // The offer fills what they sell and remembers the score.
  const u3 = await db.save('users', { email: 'coach@example.com', name: 'Cam', tier: 'free' });
  await imports.importDoor(u3, saved.offer.id, saved.offer.k);
  const snap = harness.brain.snapshot(u3);
  assert.equal(snap.business.what, INPUT.offer.what);
  assert.equal(snap.business.audience, INPUT.offer.who);
  assert.equal(snap.packs.offer.score.score, saved.offer.result.score);
  assert.equal(snap.business.niche, harness.packs.pack('coaching').title);
});

test("HQ's Today can offer the newest result an email unlocked, until it's brought in", async () => {
  ON();
  const user = { id: 'later', email: 'maya@example.com' };
  const l = doors.latestFor(user.email, user.id);
  assert.equal(l.id, saved.creator.id);
  await doors.markImported(db.get('doorRuns', saved.creator.id), user.id);
  assert.equal(doors.latestFor(user.email, user.id), null);
});

test('deleting an account removes its results and their files; old results go after 30 days', async () => {
  ON();
  const v = saved.creator;
  const doc = db.get('doorRuns', v.id);
  assert.equal(await doors.forget('MAYA@example.com'), 1);
  assert.equal(db.get('doorRuns', v.id), null);
  for (const f of doc.files) assert.equal(await db.getBlob(`door_${v.id}_${f.n}`), null);
  const old = db.get('doorRuns', saved.offer.id);
  old.createdAt = new Date(Date.now() - 31 * 864e5).toISOString();
  await db.save('doorRuns', old);
  assert.ok((await doors.prune()) >= 1);
  assert.equal(db.get('doorRuns', saved.offer.id), null);
  assert.ok(db.get('doorRuns', saved.site.id), 'a fresh one stays');
});

test('no door, picker line or email says a paid plan gets anyone clients, leads or brands (Legal L62)', () => {
  const texts = [];
  const walk = (o) => (typeof o === 'string' ? texts.push(o) : o && typeof o === 'object' ? Object.values(o).forEach(walk) : null);
  walk(D);
  const bad = texts.flatMap((t) => check(t, { paid: true }).filter((f) => f.severity === 'block').map((f) => `${f.rule}: ${t}`));
  assert.deepEqual(bad, []);
  // Builder's side names HQ workflows by their own titles, never the weekly brand list (L62).
  assert.ok(!D.doors.creator.builder.includes('ugc.next_25'));
  for (const id of doors.IDS) assert.ok(doors.builderList(id).every((w) => w.title && !/\bclients?\b|\bleads?\b/i.test(w.title)), id);
});

test('the picker renders on / and /start with each door, and /start keeps every link that carries something', async () => {
  ON();
  const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'partials', 'doors.ejs'), { doors: doors.picker(null), doorEvent: 'home_door' });
  for (const d of D.picker.doors) assert.ok(html.includes(`href="${d.href}"`), d.href);
  assert.match(html, /href="\/start\?roadmap=1"/);
  assert.match(html, /data-track="home_door" data-props='\{"door":"store"\}'/);
  const start = await ejs.renderFile(path.join(__dirname, '..', 'views', 'doors-start.ejs'), { picker: doors.picker(null), title: 'What are you building?', canonical: '', baseUrl: '', plausible: null, trackEvents: [] });
  assert.match(start, /What are you building\?/);
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /const picker = !req\.user && !Object\.keys\(req\.query\)\.length && doors\.picker\(req\.user\);/);
  assert.match(src, /first25: first25Live\(\), doors: doors\.picker\(req\.user\)/);
  assert.match(src, /await doors\.forget\(user\.email\);/);
  // HQ's confirm screen compiles and says what comes in.
  const src2 = fs.readFileSync(path.join(__dirname, '..', 'views', 'app', 'hq2', 'import-door.ejs'), 'utf8').replace(/<%- include\([^)]*\) %>/g, '');
  const view = ejs.render(src2, { p: { id: 'x', k: 'y', door: 'creator', title: 'Brand list', summary: { category: 'Skincare' }, files: 2, leads: 25, sample: false, again: false } });
  assert.match(view, /25 skincare brands go into your Pipeline/);
  assert.match(view, /action="\/app\/hq\/import\/door\/x"/);
});
