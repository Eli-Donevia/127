// First 25 (lib/first25.js, lib/site-audit.js, public/funnels/first25-engine.js): ranking, messages,
// the CSV, the website check and its address guard, and the routes. No network: website checks run
// against a local server, and the run uses the sample source. Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
process.env.FIRST25_SAMPLE_PACE = '0';
delete process.env.FIRST25_SOURCE;

const db = require('../lib/db');
const E = require('../public/funnels/first25-engine.js');
const D = require('../public/funnels/first25-data.js');
const audit = require('../lib/site-audit');
const first25 = require('../lib/first25');

const NOW = new Date('2026-10-19T12:00:00Z');
const okSite = (o = {}) => ({ checked: true, ok: true, https: true, ms: 400, video: true, socials: { instagram: 'x', tiktok: 'x', youtube: '@x', facebook: 'x' }, booking: 'Mindbody', chat: 'Intercom', pixel: true, gads: true, form: true, signup: true, viewport: true, description: true, footerYear: 2026, images: 20, ...o });

test('setup', async () => { await db.init(); });

// ---------- engine ----------
test('chains match whole names only', () => {
  assert.equal(E.isChain('Planet Fitness Des Moines', 'gyms'), true);
  assert.equal(E.isChain("Gold's Gym West", 'gyms'), true);
  assert.equal(E.isChain('Planetary Strength', 'gyms'), false);
  assert.equal(E.isChain('Ymca of Greater Des Moines', 'gyms'), true);
  assert.equal(E.isChain('Eos Strength', 'gyms'), false);
});

test('rank drops closed, chains, multi-location names and the same business listed twice', () => {
  const list = [
    { name: 'Grit Fitness', website: 'https://gritfit.com', phone: '(515) 555-0101' },
    { name: 'Grit Fitness LLC', website: 'https://gritfit.com/about' }, // same business
    { name: 'Northside Boxing', website: 'https://www.facebook.com/northsideboxing' },
    { name: 'Lantern Gym', website: 'https://www.facebook.com/lanterngym' }, // shared host: not a dupe
    { name: 'Torch Athletics', phone: '515-555-0101' }, // same phone as Grit
    { name: 'Planet Fitness', website: 'https://planetfitness.com' },
    { name: 'Iron Barbell', closed: true },
    { name: 'Spoke Cycle Studio' }, { name: 'Spoke Cycle Studio' }, { name: 'Spoke Cycle Studio' }, // 3 locations: a chain
  ];
  const r = E.rank(list, { pack: 'video', buyer: 'gyms', now: NOW });
  assert.deepEqual(r.prospects.map((b) => b.name).sort(), ['Grit Fitness', 'Lantern Gym', 'Northside Boxing']);
  assert.equal(r.stats.found, 10);
  assert.equal(r.stats.closed, 1);
  assert.equal(r.stats.chains, 4);
  assert.equal(r.stats.dupes, 2);
  assert.equal(r.stats.independent, 3);
  assert.deepEqual(r.prospects.map((b) => b.rank), [1, 2, 3]);
});

test('gaps only come from what the website check saw', () => {
  const none = E.score({ name: 'A', website: 'https://a.com', site: okSite() }, 'video', 'gyms', NOW);
  assert.deepEqual(none.gaps, []);
  const bare = E.score({ name: 'B', website: 'https://b.com', site: okSite({ video: false, socials: {}, footerYear: 2019, images: 2 }) }, 'video', 'gyms', NOW);
  assert.deepEqual(bare.gaps.map((g) => g.id), ['no_video', 'no_tiktok', 'no_instagram', 'few_images', 'no_youtube', 'stale_footer']);
  assert.equal(bare.gaps.find((g) => g.id === 'stale_footer').chip, '© 2019');
  // A site we couldn't read is never a gap, and the card says the score leans on the listing.
  const walled = E.score({ name: 'C', website: 'https://c.com', reviews: 12, site: { checked: false, why: 'http_403' } }, 'video', 'gyms', NOW);
  assert.deepEqual(walled.gaps.map((g) => g.id), ['few_reviews']);
  assert.equal(walled.unchecked, true);
  // A pixel behind Google Tag Manager is unknown, not missing.
  const gtm = E.score({ name: 'D', website: 'https://d.com', site: okSite({ pixel: null }) }, 'social', 'gyms', NOW);
  assert.equal(gtm.gaps.some((g) => g.id === 'no_pixel'), false);
  const down = E.score({ name: 'E', website: 'https://e.com', site: { checked: true, ok: false, error: 'ENOTFOUND' } }, 'web', 'gyms', NOW);
  assert.equal(down.gaps[0].id, 'site_down');
  const broken = E.score({ name: 'F', website: 'https://f.com/old-page', site: okSite({ brokenLink: true }) }, 'web', 'gyms', NOW);
  assert.equal(broken.gaps[0].id, 'broken_link');
  const noSite = E.score({ name: 'G', website: null }, 'web', 'gyms', NOW);
  assert.equal(noSite.gaps[0].id, 'no_site');
  assert.ok(noSite.score >= 40 && noSite.score <= 99);
});

test('the summary leads with gaps worth 8 points or more', () => {
  const stats = { independent: 40, checked: 30, gaps: { no_video: 20, no_tiktok: 25, no_youtube: 29, few_reviews: 30, no_site: 4 } };
  const h = E.headline(stats, 'video');
  assert.deepEqual(h.map((x) => x.id), ['no_video', 'no_tiktok', 'no_site']);
  assert.deepEqual(h[0], { id: 'no_video', n: 20, of: 30 });
  assert.equal(h[2].of, 40);
  assert.equal(E.headlineLine(h[0]), '20 of 30 show no video on their homepage');
});

test('messages name the business, the sender and the city, and stay honest', () => {
  const b = { name: 'Grit Fitness', reviews: 12, ...E.score({ name: 'Grit Fitness', website: 'https://gritfit.com', reviews: 12, site: okSite({ video: false, socials: { facebook: 'x' } }) }, 'video', 'gyms', NOW) };
  const m = E.messages(b, 'video', 'gyms', { me: 'Maya', city: 'Des Moines' });
  assert.match(m.dm, /^Hi Grit Fitness team\. I'm Maya, and I make short videos for gyms in Des Moines\. I was on your website and couldn't find any video of your classes\./);
  assert.match(m.dm, /No cost, no catch\. Want me to send it over\?$/);
  assert.match(m.email, /couldn't find any video of your classes\. Also, i couldn't find Grit Fitness on TikTok\.|couldn't find any video of your classes\. Also, /);
  assert.match(m.email, /\n\nMaya\n\[your mailing address\]\n\nP\.S\. Not for you\? Reply "no thanks"/);
  for (const [k, t] of Object.entries(m)) {
    assert.doesNotMatch(t, /\{\w+\}/, `${k} has an unfilled field`);
    assert.doesNotMatch(t, /—/, `${k} has an em dash`);
    assert.doesNotMatch(t, /\b(?:clients like|we've helped|our clients|guarantee)/i, `${k} claims past work`);
  }
  // No name yet: a placeholder the page highlights, never "undefined".
  assert.match(E.messages(b, 'video', 'gyms', { city: 'Des Moines' }).dm, /I'm \[your name\]/);
  // "Something else" uses the words they typed.
  assert.match(E.messages(b, 'other', 'gyms', { me: 'Jordan', city: 'Ames', service: 'pressure washing' }).dm, /I do pressure washing for gyms in Ames/);
});

test('the second observation reads as an add-on without breaking "I"', () => {
  const b = { name: 'Lantern Gym', gaps: [{ id: 'no_video' }, { id: 'no_signup' }] };
  const m = E.messages(b, 'video', 'gyms', { me: 'Maya', city: 'Ames' });
  assert.match(m.email, /Also, I couldn't find a way to join your email list on your website\./);
  const b2 = { name: 'Lantern Gym', gaps: [{ id: 'no_video' }, { id: 'no_instagram' }] };
  assert.match(E.messages(b2, 'video', 'gyms', { me: 'Maya', city: 'Ames' }).email, /Also, your website doesn't link to an Instagram\./);
});

test('every piece of copy follows the voice rules', () => {
  const strings = [];
  (function walk(o) { if (typeof o === 'string') strings.push(o); else if (o && typeof o === 'object') Object.values(o).forEach(walk); })(D);
  assert.ok(strings.length > 200);
  for (const s of strings) assert.doesNotMatch(s, /—/, `em dash in: ${s}`);
  for (const id of Object.keys(D.gaps)) assert.ok(E.gapTests[id], `gap ${id} has a test`);
  for (const [id, P] of Object.entries(D.packs)) for (const g of Object.keys(P.gaps)) assert.ok(D.gaps[g], `${id} weights unknown gap ${g}`);
});

test('the CSV never carries a formula, and Google runs leave out phone and address', () => {
  const list = [
    { name: '=HYPERLINK("http://x")', website: 'https://a.com', phone: '515-555-0100', address: '1 Main St', site: okSite({ video: false }) },
    { name: 'Lantern Gym', website: 'https://b.com', phone: '515-555-0101', address: '2 Main St', site: okSite({ video: false }) },
  ];
  const built = E.build(list, { pack: 'video', buyer: 'gyms', place: 'Ames, IA', me: 'Maya', now: NOW });
  const csvOsm = E.csv({ ...built, source: 'osm' });
  assert.match(csvOsm, /^"Rank","Business","Score"/);
  assert.match(csvOsm, /"'=HYPERLINK\(""http:\/\/x""\)"/);
  assert.match(csvOsm, /"515-555-0101","2 Main St"/);
  assert.match(csvOsm, /OpenStreetMap contributors/);
  const csvG = E.csv({ ...built, source: 'google' });
  assert.doesNotMatch(csvG, /515-555-01|Main St|https:\/\/[ab]\.com/);
  assert.match(csvG, /^"Rank","Score","Gaps","Why","Instagram","Map link","DM"/);
  assert.match(csvG, /Business names and details come from Google Maps/);
  assert.match(csvG, /Google Maps\. Website checks by 127\./);
  assert.equal(csvG.split('\r\n').filter((l) => /"Not contacted"$/.test(l)).length, 2);
});

test('sample businesses are made up, labeled, varied and the same every time', () => {
  const a = E.sample('gyms', 'Des Moines, IA', NOW);
  assert.deepEqual(a, E.sample('gyms', 'Des Moines, IA', NOW));
  // Same businesses however the city is typed.
  assert.deepEqual(a.map((x) => x.name), E.sample('gyms', 'des moines, ia ', NOW).map((x) => x.name));
  assert.notDeepEqual(a.map((x) => x.name), E.sample('gyms', 'Ames, IA', NOW).map((x) => x.name));
  const own = a.filter((x) => !/^sample-chain/.test(x.id));
  assert.ok(own.length >= 30);
  assert.equal(new Set(own.map((x) => x.name.split(' ')[0])).size, own.length, 'no first word twice');
  assert.equal(new Set(own.map((x) => x.phone)).size, own.length, 'no phone twice');
  for (const x of own) {
    assert.equal(x.sample, true);
    assert.match(x.phone, /^\(555\) 555-01\d\d$/);
    if (x.website) assert.match(x.website, /\.example$/);
  }
  for (const buyer of Object.keys(D.buyers)) {
    const r = E.rank(E.sample(buyer, 'Des Moines, IA', NOW), { pack: 'video', buyer, now: NOW });
    assert.equal(r.prospects.length, 25, `${buyer} fills 25`);
    assert.equal(r.stats.dupes, 0, `${buyer} has no duplicate samples`);
  }
});

test('send mode picks the best way to reach each business', () => {
  const b = { name: 'Lantern Gym', website: 'https://lanterngym.com', email: 'hi@lanterngym.com', phone: '(515) 555-0100', site: { socials: { instagram: 'lanterngym', facebook: 'lanterngym' } } };
  assert.deepEqual(E.channels(b, 'video').map((c) => c.id), ['ig', 'email', 'fb', 'call']);
  assert.deepEqual(E.channels(b, 'web').map((c) => c.id), ['email', 'ig', 'fb', 'call']);
  assert.equal(E.channels(b, 'video')[0].href, 'https://ig.me/m/lanterngym');
  assert.equal(E.channels(b, 'video')[0].text, 'dm');
  assert.equal(E.channels(b, 'web')[0].text, 'email');
  // No email on the site: their website's form, never a made-up address.
  assert.deepEqual(E.channels({ name: 'A', website: 'https://a.com/' }, 'web').map((c) => [c.id, c.to]), [['site', 'a.com']]);
  // Sample sites (.example) are never opened, and nothing to reach means walk in.
  assert.deepEqual(E.channels({ name: 'B', website: 'https://b.example', address: '1 Main St' }, 'web').map((c) => c.id), ['walk']);
});

test('reply scripts are filled for one business and keep the blanks to fill', () => {
  const rs = E.replies({ name: 'Lantern Gym' }, 'video', 'gyms', { me: 'Maya', city: 'Des Moines' });
  assert.deepEqual(rs.map((r) => r.id), ['yes', 'sent', 'price', 'who', 'covered', 'later', 'quiet']);
  const all = rs.map((r) => r.text).join('\n');
  assert.doesNotMatch(all, /\{\w+\}/);
  assert.match(all, /For Lantern Gym I'd start simple: \[what you'll do\] each month for \[your price\]/);
  assert.match(all, /I'm Maya\. I make short videos for gyms in Des Moines\. I'm starting with a few local businesses/);
  assert.doesNotMatch(all, /clients like|we've helped|guarantee/i);
});

test('the value line, the picker and the reel storyboard', () => {
  // A count of what we checked, never a time-saved claim (playbook R21: those need timing by hand).
  assert.equal(E.SITE_CHECKS, 18);
  assert.equal(E.saved(37), 'We read 37 websites and checked each one for 18 things.');
  assert.equal(E.saved(1), 'We read their website and checked it for 18 things.');
  assert.equal(E.saved(0), '');
  assert.equal(E.saved(37, true), 'With real businesses, we read each website and check it for 18 things.');
  assert.deepEqual(E.pick('film', true, 'lt5'), { pack: 'video', buyer: 'gyms', why: D.picker.why['video|gyms'], note: 'With under 5 hours a week, aim for 1 client first.' });
  for (const like of Object.keys(D.picker.map)) for (const walk of [true, false]) {
    const p = E.pick(like, walk, '15');
    assert.ok(D.packs[p.pack].buyers.includes(p.buyer), `${like} ${walk}: ${p.pack} sells to ${p.buyer}`);
    assert.ok(p.why, `${like} ${walk} has a reason`);
  }
  const s = E.spec({ name: 'Lantern Gym' }, 'video', 'gyms', { city: 'Des Moines' });
  assert.deepEqual(s.board[0], ['0 to 2s', 'On screen: "POV: your first class at Lantern Gym"']);
  assert.equal(E.spec({ name: 'A' }, 'web', 'contractors', {}).board, undefined);
});

// ---------- website check ----------
test('the address guard refuses private, local and odd URLs', () => {
  for (const u of ['ftp://a.com/', 'http://a.com:8080/', 'http://user:pw@a.com/', 'http://localhost/', 'http://printer.local/', 'http://db.internal/',
    'http://a.example/', 'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.16.0.1/', 'http://100.64.0.1/', 'http://[fd00::1]/', 'javascript:alert(1)']) {
    assert.equal(audit.checkUrl(u), null, u);
  }
  assert.ok(audit.checkUrl('https://gritfit.com/'));
  assert.ok(audit.checkUrl('http://8.8.8.8/'));
  assert.equal(audit.privateAddress('::ffff:10.0.0.1'), true);
  assert.equal(audit.privateAddress('8.8.8.8'), false);
  assert.equal(audit.privateAddress('2606:4700::1111'), false);
  assert.equal(audit.privateAddress('not an ip'), true);
});

test('the lookup refuses a name that resolves to a private address', async () => {
  const err = await new Promise((resolve) => audit.safeLookup('localhost', { all: true }, (e) => resolve(e)));
  assert.equal(err && err.code, 'EBLOCKED');
  const lit = await new Promise((resolve) => audit.safeLookup('127.0.0.1', {}, (e) => resolve(e)));
  assert.equal(lit && lit.code, 'EBLOCKED');
  assert.deepEqual(await audit.audit('http://127.0.0.1/'), { checked: false, why: 'bad_url' });
});

const HOME = `<!doctype html><html><head><title>Grit Fitness | Des Moines</title><meta name="viewport" content="width=device-width">
<meta name="description" content="Strength classes in Des Moines for every level.">
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABCD12"></script></head><body>
<a href="https://instagram.com/p/Cxyz/">post</a><a href="https://www.instagram.com/gritfitdsm/">IG</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a><a href="https://facebook.com/gritfitdsm">FB</a>
<iframe src="https://www.youtube.com/embed/abc"></iframe><a href="https://brandedweb.mindbodyonline.com/x">Book</a>
<form><input type="email" name="email"></form><img src="a.jpg"><img src="b.jpg"><img src="px.gif" width="1" height="1">
<p>${'We train real people. '.repeat(20)}</p><footer>© 2014 - 2019 Grit Fitness LLC</footer></body></html>`;

test('parse reads the signals off a homepage', () => {
  const s = audit.parse(HOME, 'https://gritfit.com/', NOW);
  assert.equal(s.title, 'Grit Fitness | Des Moines');
  assert.equal(s.https, true);
  assert.equal(s.video, true);
  assert.deepEqual(s.socials, { instagram: 'gritfitdsm', tiktok: null, youtube: null, facebook: 'gritfitdsm' });
  assert.equal(s.booking, 'Mindbody');
  assert.equal(s.chat, null);
  assert.equal(s.pixel, null, 'GTM present: unknown');
  assert.equal(s.form, true);
  assert.equal(s.signup, false);
  assert.equal(s.viewport, true);
  assert.equal(s.description, true);
  assert.equal(s.footerYear, 2019);
  assert.equal(s.images, 2);
  assert.equal(s.thin, false);
  const plain = audit.parse(`<html><body><p>${'Open daily. '.repeat(40)}</p><footer>&copy; 2031</footer></body></html>`, 'http://x.com/', NOW);
  assert.equal(plain.pixel, false);
  assert.equal(plain.https, false);
  assert.equal(plain.footerYear, null, 'a future year is a typo, not a footer');
  assert.equal(audit.parse('<html><body><div id="root"></div><script>app()</script></body></html>', 'https://x.com/', NOW).thin, true);
});

// Website checks against a local server: the guard is tested above, so these requests are sent to
// 127.0.0.1 by swapping http.request for the length of each test.
async function withSite(routes, fn) {
  const server = http.createServer((req, res) => {
    const h = routes[req.url];
    if (!h) { res.writeHead(404); return res.end('nope'); }
    h(req, res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const real = http.request;
  http.request = (u, opts) => real({ host: '127.0.0.1', port, path: u.pathname + u.search, method: 'GET', headers: { ...opts.headers, host: u.host } });
  try { return await fn(); } finally { http.request = real; server.close(); }
}

test('audit follows redirects, reports what loaded, and keeps bot walls unchecked', async () => {
  await withSite({
    '/': (q, s) => { s.writeHead(301, { location: '/home' }); s.end(); },
    '/home': (q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end(HOME); },
    '/walled': (q, s) => { s.writeHead(403); s.end('blocked'); },
    '/boom': (q, s) => { s.writeHead(500); s.end('err'); },
    '/away': (q, s) => { s.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' }); s.end(); },
    '/pdf': (q, s) => { s.writeHead(200, { 'content-type': 'application/pdf' }); s.end('%PDF'); },
  }, async () => {
    const ok = await audit.audit('gritfit.com', { now: NOW });
    assert.equal(ok.checked, true);
    assert.equal(ok.ok, true);
    assert.equal(ok.url, 'http://gritfit.com/home');
    assert.equal(ok.video, true);
    assert.equal(ok.brokenLink, undefined);
    assert.deepEqual(await audit.audit('http://gritfit.com/walled'), { checked: false, why: 'http_403' });
    const boom = await audit.audit('http://gritfit.com/boom');
    assert.equal(boom.ok, false);
    assert.equal(boom.error, 'http_500');
    assert.deepEqual(await audit.audit('http://gritfit.com/away'), { checked: false, why: 'bad_redirect' });
    assert.deepEqual(await audit.audit('http://gritfit.com/pdf'), { checked: false, why: 'not_html' });
  });
});

test('a listing link to a missing page checks the homepage once and flags the broken link', async () => {
  await withSite({ '/': (q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end(HOME); } }, async () => {
    const r = await audit.audit('http://gritfit.com/locations/old-page', { now: NOW });
    assert.equal(r.ok, true);
    assert.equal(r.brokenLink, true);
    assert.equal(r.url, 'http://gritfit.com/');
  });
  await withSite({}, async () => {
    const r = await audit.audit('http://gritfit.com/old');
    assert.equal(r.checked, true);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'http_404');
  });
});

test('auditAll stays inside its time budget and reuses the cache', async () => {
  let n = 0;
  await withSite({ '/': (q, s) => { n++; s.writeHead(200, { 'content-type': 'text/html' }); s.end(HOME); } }, async () => {
    const cache = new Map();
    const c = { get: (k) => cache.get(k) || null, set: (k, v) => cache.set(k, v) };
    const list = [{ name: 'A', website: 'http://a-gym.com' }, { name: 'B', website: 'http://b-gym.com' }, { name: 'C' }];
    const seen = [];
    await audit.auditAll(list, { now: NOW, cache: c, onProgress: (p) => seen.push(p) });
    assert.equal(list[0].site.ok, true);
    assert.equal(list[2].site, undefined);
    assert.deepEqual(seen[seen.length - 1], { checked: 2, of: 2 });
    await audit.auditAll([{ name: 'A', website: 'http://a-gym.com' }], { now: NOW, cache: c });
    assert.equal(n, 2, 'second run came from the cache');
    const late = [{ name: 'D', website: 'http://d-gym.com' }];
    await audit.auditAll(late, { budgetMs: 100 });
    assert.deepEqual(late[0].site, { checked: false, why: 'time' });
  });
});

// ---------- routes ----------
function app(limitedImpl = () => false) {
  const a = express();
  a.use(first25.router({ json: express.json(), limited: limitedImpl }));
  return a;
}
async function serve(a, fn) {
  const s = await new Promise((resolve) => { const srv = a.listen(0, '127.0.0.1', () => resolve(srv)); });
  try { return await fn(`http://127.0.0.1:${s.address().port}`); } finally { s.close(); }
}
const post = (base, body) => fetch(base + '/api/first-25/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

let saved = null;
test('a run streams each step, then the ranked list with its signed link', async () => {
  await serve(app(), async (base) => {
    const res = await post(base, { pack: 'video', buyer: 'gyms', place: 'Des Moines, IA', me: 'Maya' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/x-ndjson/);
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    const steps = lines.filter((l) => l.type === 'progress').map((l) => l.step);
    assert.deepEqual([...new Set(steps)], ['search', 'found', 'audit', 'rank', 'write']);
    const out = lines[lines.length - 1];
    assert.equal(out.type, 'result');
    const run = out.run;
    assert.equal(run.city, 'Des Moines');
    assert.equal(run.source, 'sample');
    assert.equal(run.sample, true);
    assert.equal(run.prospects.length, 25);
    assert.equal(run.k, first25.sign(run.id));
    assert.match(run.prospects[0].msg.dm, /I'm Maya, and I make short videos for gyms in Des Moines/);
    assert.ok(run.prospects[0].spec && run.prospects[2].spec && !run.prospects[3].spec);
    assert.equal(run.headline.length, 3);
    saved = db.get('prospectRuns', run.id);
    assert.ok(saved);
    assert.equal(saved.prospects[0].msg, undefined, 'messages are rebuilt, not stored');
  });
});

test('a run checks the place, the honeypot and the limits', async () => {
  await serve(app(), async (base) => {
    assert.equal((await post(base, { pack: 'video', buyer: 'gyms', place: 'x' })).status, 400);
    assert.equal((await post(base, { pack: 'video', buyer: 'gyms', place: 'Ames, IA', website: 'spam.com' })).status, 400);
  });
  await serve(app(() => true), async (base) => {
    const r = await post(base, { pack: 'video', buyer: 'gyms', place: 'Ames, IA' });
    assert.equal(r.status, 429);
    assert.match((await r.json()).error, /Come back tomorrow/);
  });
});

test('the saved list opens only with its signature, and the CSV downloads', async () => {
  assert.ok(saved, 'needs the run from the earlier test');
  const good = first25.injectRun({ params: { id: saved.id }, query: { k: first25.sign(saved.id) } });
  const j = JSON.parse(good.replace(/^<script>window\.F25_RUN=/, '').replace(/;<\/script>\n$/, ''));
  assert.equal(j.unlocked, true);
  assert.equal(j.prospects.length, 25);
  assert.equal(first25.injectRun({ params: { id: saved.id }, query: { k: 'nope' } }), '<script>window.F25_RUN=null;</script>\n');
  await serve(app(), async (base) => {
    const csv = await fetch(`${base}/first-25/r/${saved.id}.csv?k=${first25.sign(saved.id)}`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-disposition'), /attachment; filename="first-25-gyms-des-moines\.csv"/);
    const body = await csv.text();
    assert.equal(body.split('\r\n').filter((l) => /^"\d+",/.test(l)).length, 25);
    assert.match(body, /Sample data\. These businesses are made up\./);
    assert.equal((await fetch(`${base}/first-25/r/${saved.id}.csv?k=${'0'.repeat(32)}`)).status, 404);
  });
});

test('the tracker saves a stage per business, and the CSV shows it', async () => {
  const k = first25.sign(saved.id);
  await serve(app(), async (base) => {
    const set = (body) => fetch(`${base}/api/first-25/r/${saved.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await set({ k, rank: 2, stage: 'contacted' })).status, 200);
    assert.equal((await set({ k, rank: 3, stage: 'won' })).status, 200);
    assert.equal((await set({ k, rank: 3, stage: 'bogus' })).status, 400);
    assert.equal((await set({ k, rank: 99, stage: 'won' })).status, 400);
    assert.equal((await set({ k: 'x', rank: 2, stage: 'won' })).status, 404);
    const doc = db.get('prospectRuns', saved.id);
    assert.equal(doc.status[2].s, 'contacted');
    assert.equal(doc.status[3].s, 'won');
    const body = await (await fetch(`${base}/first-25/r/${saved.id}.csv?k=${k}`)).text();
    const rows = body.split('\r\n');
    assert.match(rows.find((l) => l.startsWith('"2",')), /"Sent"$/);
    assert.match(rows.find((l) => l.startsWith('"3",')), /"Won"$/);
    assert.match(rows.find((l) => l.startsWith('"1",')), /"Not contacted"$/);
  });
  const j = first25.injectRun({ params: { id: saved.id }, query: { k } });
  assert.match(j, /"status":\{"2":\{"s":"contacted"/);
});

test('a business name can never close the page script', async () => {
  const doc = await db.save('prospectRuns', { ...saved, id: undefined, createdAt: undefined, prospects: [{ ...saved.prospects[0], name: '</script><script>alert(1)</script>' }] });
  const out = first25.injectRun({ params: { id: doc.id }, query: { k: first25.sign(doc.id) } });
  assert.equal(out.match(/<\/script>/g).length, 1);
  assert.match(out, /\\u003c\/script>\\u003cscript>alert\(1\)/);
});

test('the email carries the top 10, the links and the 7 days, written for the name at the gate', () => {
  const lead = { name: 'Jordan', data: { run_id: saved.id, k: first25.sign(saved.id) } };
  const m = first25.emailText(lead, (state) => `[state ${state || 'now'}]`);
  assert.equal(m.subject, 'Your First 25: gyms in Des Moines');
  assert.match(m.text, /^Hi Jordan,/);
  assert.match(m.text, new RegExp(`/first-25/r/${saved.id}\\?k=${first25.sign(saved.id)}`));
  assert.match(m.text, new RegExp(`/first-25/r/${saved.id}\\.csv\\?k=`));
  assert.match(m.text, /\n10\. .+\(score \d+\)/);
  assert.doesNotMatch(m.text, /\n11\. /);
  assert.match(m.text, /I'm Jordan, and I make short videos/);
  assert.match(m.text, /Day 7: /);
  assert.match(m.text, /When they reply:\n\n"Sure, send it"\n/);
  assert.match(m.text, /0 to 2s: On screen: "POV: your first class at /);
  const until = new Date(Date.parse(saved.createdAt || saved.checkedAt) + 30 * 864e5).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  assert.match(m.text, new RegExp(`Your list and tracker stay here until ${until}\\.`));
  assert.match(m.text, /^Here are 25 gyms in Des Moines, ranked by the gaps you fix/m);
  // The sample made for #1, how to use it, then the steps for the real one.
  assert.match(m.text, /We made a mock-up for #1, [^:]+: their 15-second reel\. Open your list to see it\. Make the real one from their clips with the steps below\. It's only for them, so never post it\.\n\nBefore you message #1/);
  // The next problem, named, right before the launch block.
  assert.match(m.text, /You have 25 names and 25 drafts\. Next comes the part most people skip/);
  // Free next to Builder, with no totals.
  assert.match(m.text, /Free gives you the list, the messages, the follow-ups and the reply scripts\. Builder adds the Pricing Worksheet/);
  assert.doesNotMatch(m.text, /\$\d+ (?:value|worth)|worth \$|total value/i);
  assert.match(m.text, /Sample businesses\./);
  assert.match(m.text, /\[state now\]$/);
  const lost = first25.emailText({ name: 'Jordan', data: { run_id: saved.id, k: 'bad' } }, (state) => `[state ${state}]`);
  assert.equal(lost.subject, 'Your First 25');
  assert.match(lost.text, /didn't save on our side/);
  assert.match(lost.text, /\[state C\]$/);
});

// ---------- the sample made for #1 ----------
test('every service gets a sample for #1, built only from what we found', () => {
  global.window = { matchMedia: () => ({ matches: false }) };
  require('../public/funnels/first25-mock.js');
  const MK = global.window.F25MOCK;
  delete global.window;
  const kinds = { video: 'reel', social: 'grid', web: 'site', ai: 'chat', email: 'email', photo: 'shots' };
  const real = { name: 'Lantern & Co <b>', rating: 4.7, reviews: 112, address: '12 Main St, Ames', phone: '(515) 555-0100', instagram: 'lanternco' };
  let n = 0;
  for (const pack of Object.keys(D.packs)) {
    for (const buyer of Object.keys(D.buyers)) {
      const m = E.mock(real, pack, buyer, { me: 'Maya', city: 'Ames' });
      if (pack === 'other') { assert.equal(m, null, 'no sample for "something else"'); continue; }
      n++;
      assert.equal(m.kind, kinds[pack]);
      const strings = [];
      (function walk(o) { if (typeof o === 'string') strings.push(o); else if (o && typeof o === 'object') Object.values(o).forEach(walk); })(m);
      for (const t of strings) {
        assert.doesNotMatch(t, /\{\w+\}/, `${pack}/${buyer} has an unfilled field: ${t}`);
        assert.doesNotMatch(t, /—/, `${pack}/${buyer} has an em dash: ${t}`);
        // No offers, prices, awards or history we never saw.
        assert.doesNotMatch(t, /\$\d|\d+ ?%|percent|free trial|guarantee|award|best in|#1 in|since \d{4}|\d+ years/i, `${pack}/${buyer} invents something: ${t}`);
      }
      const html = MK.render(m);
      assert.match(html, /<div class="mk-wm">Sample by Maya · Not their real [A-Za-z ]+<\/div>/, `${pack}/${buyer} is watermarked`);
      assert.match(html, /Lantern &amp; Co &lt;b&gt;/);
      assert.doesNotMatch(html, /Co <b>/);
    }
  }
  assert.ok(n >= 60);
  // Their rating, reviews, phone and Instagram show only when we found them.
  assert.match(MK.render(E.mock(real, 'web', 'gyms', { me: 'Maya', city: 'Ames' })), /★ 4\.7<\/b> · 112 Google reviews/);
  const bare = MK.render(E.mock({ name: 'Lantern Gym' }, 'web', 'gyms', { city: 'Ames' }));
  assert.doesNotMatch(bare, /★|Google reviews|555/);
  assert.match(bare, /<div class="mk-wm">Sample · Not their real website<\/div>/);
  assert.match(MK.render(E.mock(real, 'social', 'gyms', { me: 'Maya', city: 'Ames' })), /@lanternco/);
  assert.doesNotMatch(MK.render(E.mock({ name: 'Lantern Gym' }, 'social', 'gyms', { city: 'Ames' })), /@/);
  // The reel ends on their name and the line for their kind of business.
  const reel = E.mock({ name: 'Lantern Gym' }, 'video', 'gyms', { me: 'Maya', city: 'Ames' });
  assert.equal(reel.end, 'Come try a class.');
  assert.equal(E.mock({ name: 'A' }, 'video', 'realtors', {}).end, 'Book a showing.');
  assert.match(MK.render(reel), /data-reel data-scene="0"[\s\S]+<span class="mk-logo">Lantern Gym<\/span><b>Come try a class\.<\/b>/);
});

test("a Google list's mock-up shows only the name and city, and says how to send it (Legal S24, L56)", () => {
  global.window = { matchMedia: () => ({ matches: false }) };
  delete require.cache[require.resolve('../public/funnels/first25-mock.js')];
  require('../public/funnels/first25-mock.js');
  const MK = global.window.F25MOCK;
  delete global.window;
  const real = { name: 'Lantern Gym', rating: 4.7, reviews: 112, address: '12 Main St, Ames', phone: '(515) 555-0100', instagram: 'lanternco' };
  for (const pack of ['video', 'social', 'web', 'ai', 'email', 'photo']) {
    const g = E.mock(real, pack, 'gyms', { me: 'Maya', city: 'Ames', source: 'google' });
    assert.deepEqual([g.rating, g.reviews, g.address, g.phone, g.instagram], [null, null, '', '', ''], pack);
    const html = MK.render(g);
    assert.doesNotMatch(html, /★|Google reviews|Main St|555-|@lanternco/, `${pack}: nothing of Google's on it`);
    assert.match(html, /Lantern Gym/);
    assert.match(html, /Not their real/);
    // OpenStreetMap and sample lists keep the facts we found.
    assert.equal(E.mock(real, pack, 'gyms', { city: 'Ames', source: 'osm' }).phone, '(515) 555-0100');
  }
  // The screenshot keeps its mark, and the line to send with it is Legal's, with no name in it.
  const site = E.mock(real, 'web', 'gyms', { me: 'Maya', city: 'Ames', source: 'google' });
  assert.match(site.note, /^Screenshot it with the "Not their real website" line in view and send it with your message\./);
  assert.equal(site.say, "I put together a quick mock-up of a new homepage for you, attached. It's just a mock-up, made only for you.");
  assert.equal(E.mock(real, 'social', 'gyms', {}).say, "I put together a quick mock-up of your next 9 posts for you, attached. It's just a mock-up, made only for you.");
  for (const pack of ['social', 'ai', 'email']) assert.match(E.mock(real, pack, 'gyms', {}).note, /line in view/);
  // A reel is made from their own clips and a shot list is a plan, so neither is screenshotted.
  assert.equal(E.mock(real, 'video', 'gyms', {}).say, '');
  assert.equal(E.mock(real, 'photo', 'gyms', {}).say, '');
});

// ---------- niche doors ----------
test('niche pages open on one service and buyer, and unknown ones go to the main page', async () => {
  for (const [id, n] of Object.entries(D.niches)) {
    assert.ok(D.packs[n.pack].buyers.includes(n.buyer), `${id}: ${n.pack} sells to ${n.buyer}`);
    assert.doesNotMatch(n.h1 + n.lede + n.og, /clients|customers|—/i, `${id} promises an outcome`);
  }
  const a = express();
  a.use(require('../lib/funnels')());
  await serve(a, async (base) => {
    const gyms = await fetch(base + '/first-25/gyms');
    assert.equal(gyms.status, 200);
    const html = await gyms.text();
    assert.match(html, /<script>window\.F25_NICHE="gyms";<\/script>/);
    assert.match(html, /<title>Find 25 gyms to make videos for · 127<\/title>/);
    assert.match(html, /<meta property="og:url" content="[^"]+\/first-25\/gyms">/);
    const nope = await fetch(base + '/first-25/nope?place=Ames&go=1', { redirect: 'manual' });
    assert.equal(nope.status, 302);
    assert.equal(nope.headers.get('location'), '/first-25?place=Ames&go=1');
    const main = await (await fetch(base + '/first-25')).text();
    assert.match(main, /<title>Your first 25\. We find them\. · 127<\/title>/);
    assert.doesNotMatch(main, /F25_NICHE/);
  });
});

// ---------- the cost guard ----------
test('Google mode needs saved lists that keep place IDs only, and a key (Legal L53)', () => {
  process.env.FIRST25_SOURCE = 'google';
  process.env.GOOGLE_PLACES_KEY = 'test-key';
  try {
    assert.equal(first25._test.L53.placeIdsOnly, true);
    assert.equal(first25.sourceName(), 'google');
    first25._test.L53.placeIdsOnly = false;
    assert.equal(first25.sourceName(), 'sample');
  } finally { first25._test.L53.placeIdsOnly = true; delete process.env.GOOGLE_PLACES_KEY; }
  try {
    assert.equal(first25.sourceName(), 'sample', 'no key, no Google');
    // The key works under the name HQ's setup notes gave Eli, too.
    for (const k of ['PLACES_API_KEY', 'GOOGLE_PLACES_API_KEY']) {
      process.env[k] = 'test-key';
      try { assert.equal(first25.sourceName(), 'google', k); } finally { delete process.env[k]; }
    }
  } finally { delete process.env.FIRST25_SOURCE; }
});

test('OpenStreetMap on the live site needs our own or a paid server (Legal L53 part 2.4)', () => {
  const was = process.env.NODE_ENV;
  process.env.FIRST25_SOURCE = 'osm';
  try {
    delete process.env.NODE_ENV;
    assert.equal(first25.sourceName(), 'osm', 'the public servers are fine for testing');
    process.env.NODE_ENV = 'production';
    assert.equal(first25.sourceName(), 'sample', 'never on the live site');
    process.env.OSM_OVERPASS_URL = 'https://overpass.example/api/interpreter';
    assert.equal(first25.sourceName(), 'sample', 'both servers, not one');
    // The URL can carry the server's key, so only https counts, and a bare host isn't a server.
    for (const bad of ['http://nominatim.example', 'nominatim.example']) {
      process.env.OSM_NOMINATIM_URL = bad;
      assert.equal(first25.sourceName(), 'sample', bad);
    }
    process.env.OSM_NOMINATIM_URL = 'https://nominatim.example';
    assert.equal(first25.sourceName(), 'osm');
  } finally {
    if (was === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = was;
    delete process.env.FIRST25_SOURCE; delete process.env.OSM_OVERPASS_URL; delete process.env.OSM_NOMINATIM_URL;
  }
});

test('past the daily cap, a live search still answers, on labeled sample businesses', async () => {
  process.env.FIRST25_SOURCE = 'google';
  process.env.GOOGLE_PLACES_KEY = 'test-key';
  try {
    await serve(app((key) => key === 'f25:all'), async (base) => {
      const res = await post(base, { pack: 'video', buyer: 'gyms', place: 'Ames, IA' });
      assert.equal(res.status, 200);
      const out = (await res.text()).trim().split('\n').map((l) => JSON.parse(l)).pop();
      assert.equal(out.type, 'result');
      assert.equal(out.run.source, 'sample');
      assert.equal(out.run.capped, true);
      assert.deepEqual(db.get('prospectRuns', out.run.id).cost, { requests: 0, usd: 0 });
    });
  } finally { delete process.env.FIRST25_SOURCE; delete process.env.GOOGLE_PLACES_KEY; }
});

// A fake Places API (New): Text Search in pages of 20 and Place Details, counting each kind of request.
// hide: place IDs the search no longer returns, so opening a list has to ask Place Details for them.
const W = ['Anchor', 'Birch', 'Cedar', 'Dune', 'Ember', 'Fable', 'Granite', 'Harbor', 'Ivy', 'Juniper', 'Kestrel', 'Linden', 'Maple', 'Nimbus', 'Onyx', 'Pine', 'Quarry', 'Ridge', 'Summit', 'Timber'];
const jsonRes = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
function fakePlaces({ websites = false } = {}) {
  const calls = { search: 0, details: 0 }, hide = new Set(), realFetch = global.fetch;
  const place = (page, i) => ({
    id: `p${page}-${i}`, displayName: { text: `${W[i]} ${page === 1 ? 'Athletics' : 'Boxing'}` }, shortFormattedAddress: `${i + 1} Main St, Ames`,
    nationalPhoneNumber: `(515) 555-${1000 + page * 100 + i}`, rating: 4.5, userRatingCount: 30 + i, businessStatus: 'OPERATIONAL',
    ...(websites ? { websiteUri: `http://${W[i].toLowerCase()}-${page}.com` } : {}),
  });
  global.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://places.googleapis.com/v1/places:searchText')) {
      calls.search++;
      const page = JSON.parse(init.body).pageToken ? 2 : 1;
      return jsonRes({ places: W.map((w, i) => place(page, i)).filter((p) => !hide.has(p.id)), ...(page === 1 ? { nextPageToken: 'next' } : {}) });
    }
    if (u.startsWith('https://places.googleapis.com/v1/places/')) {
      calls.details++;
      const [, page, i] = decodeURIComponent(u.split('/places/')[1].split('?')[0]).match(/^p(\d)-(\d+)$/);
      return jsonRes(place(Number(page), Number(i)));
    }
    return realFetch(url, init);
  };
  return { calls, hide, restore: () => { global.fetch = realFetch; } };
}
const GOOGLE_DETAILS = /Athletics|Boxing|Main St|555-|[a-z]+-[12]\.com|reviews so far|stars on Google/;

test('a Google list is saved as place IDs and our own work, never the listing (Legal L53)', async () => {
  process.env.FIRST25_SOURCE = 'google';
  process.env.GOOGLE_PLACES_KEY = 'test-key';
  const g = fakePlaces({ websites: true });
  let reads = 0;
  try {
    await withSite({ '/': (q, s) => { reads++; s.writeHead(200, { 'content-type': 'text/html' }); s.end(HOME); } }, async () => {
      const doc = await first25.run({ pack: 'video', buyer: 'gyms', place: 'Ames, IA', me: 'Maya' }, () => {});
      assert.equal(g.calls.search, 2);
      assert.deepEqual(doc.cost, { requests: 2, usd: 0.07 });
      // The result shown right after the search has the names.
      const now = first25.view(doc);
      assert.equal(now.source, 'google');
      assert.equal(now.details, undefined);
      assert.match(now.prospects[0].msg.dm, /^Hi \w+ (Athletics|Boxing) team\./);
      // The saved list has none of them: the place ID, our scores, gaps and website checks only.
      const stored = db.get('prospectRuns', doc.id);
      assert.equal(stored.live, undefined);
      assert.doesNotMatch(JSON.stringify(stored), GOOGLE_DETAILS);
      for (const p of stored.prospects) {
        assert.match(p.id, /^g-p[12]-\d+$/);
        for (const k of ['name', 'website', 'phone', 'address', 'rating', 'reviews', 'mapsUrl']) assert.equal(p[k], undefined, `${k} is not saved`);
        for (const x of p.gaps.concat(p.fits)) assert.deepEqual(Object.keys(x).sort(), ['id', 'points']);
        assert.equal(p.site.checked, true);
      }
      // Google results never go in the list cache. Website checks are kept by place ID, without the URL.
      assert.equal(first25._test.listCache.get('google|gyms|ames, ia'), null);
      const hit = first25._test.siteCache.get('g:' + stored.prospects[0].id);
      assert.ok(hit && hit.checked);
      assert.equal(hit.url, undefined);
      // The same search again asks Google again, but reads no website twice.
      const read = reads;
      const again = await first25.run({ pack: 'video', buyer: 'gyms', place: 'Ames, IA' }, () => {});
      assert.equal(g.calls.search, 4);
      assert.deepEqual(again.cost, { requests: 2, usd: 0.07 });
      assert.equal(reads, read, 'website checks came from the place ID cache');

      // Opened later, the list has a map link per business and tells the page to fetch the rest.
      const v = first25.view(stored);
      assert.equal(v.details, true);
      assert.equal(v.prospects[0].name, '[business name]');
      assert.match(v.prospects[0].mapsUrl, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=gyms%20in%20Ames%2C%20IA&query_place_id=p[12]-\d+$/);
      assert.match(v.prospects[0].msg.dm, /^Hi \[business name\] team\./);
      // The email, the CSV, the follow-up email fields and the HQ rows carry no Google details.
      const k = first25.sign(stored.id);
      const lead = { email: 'maya@example.com', name: 'Maya', source: 'first-25', data: { run_id: stored.id, k } };
      const mail = first25.emailText(lead, () => '[state]');
      const csv = E.csv(v);
      const props = first25.nurtureProps(lead);
      const rows = first25.pipeline(stored, 'Maya');
      for (const out of [mail.text, csv, JSON.stringify(props), JSON.stringify(rows)]) assert.doesNotMatch(out, GOOGLE_DETAILS);
      assert.match(mail.text, /What we found on their websites:\n\d+ of \d+ /);
      assert.match(mail.text, /Your #1: /);
      assert.match(mail.text, /Download your tracker for Sheets or Notion: /);
      assert.match(mail.text, /Website checks by 127\.\n\n\[state\]$/);
      assert.match(csv, /query_place_id=p[12]-\d+/);
      assert.equal(props.first25_source, 'google');
      assert.ok(rows.every((r) => r.company === '' && /^p[12]-\d+$/.test(r.data.place_id) && !r.links.website && !r.links.phone && /^https:\/\/www\.google\.com\/maps/.test(r.links.map)));
      assert.match(rows[0].data.messages.dm, /\[business name\]/);
    });
  } finally {
    g.restore();
    delete process.env.FIRST25_SOURCE; delete process.env.GOOGLE_PLACES_KEY;
  }
});

test('opening a saved Google list fetches its names again by place ID and keeps none of them', async () => {
  process.env.FIRST25_SOURCE = 'google';
  process.env.GOOGLE_PLACES_KEY = 'test-key';
  const g = fakePlaces();
  const ask = (base, id, k) => fetch(`${base}/api/first-25/r/${id}/details`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k }) });
  try {
    const doc = await first25.run({ pack: 'video', buyer: 'gyms', place: 'Ames, IA', me: 'Maya' }, () => {});
    const stored = db.get('prospectRuns', doc.id), k = first25.sign(stored.id);
    // The search no longer returns 2 of them, so those 2 come from Place Details.
    g.hide.add(stored.prospects[0].id.slice(2));
    g.hide.add(stored.prospects[1].id.slice(2));
    await serve(app(), async (base) => {
      const r = await ask(base, stored.id, k);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      const j = await r.json();
      assert.equal(j.prospects.length, stored.prospects.length);
      assert.equal(j.prospects[0].rank, 1);
      assert.match(j.prospects[0].name, /Athletics|Boxing/);
      assert.equal(j.prospects[0].reviews >= 30, true);
      assert.equal(g.calls.details, 2);
      // Nothing from Google was saved. What opening it cost us was.
      const after = db.get('prospectRuns', stored.id);
      assert.doesNotMatch(JSON.stringify(after), GOOGLE_DETAILS);
      assert.deepEqual(after.opens, { n: 1, requests: 4, usd: 0.11 });
      assert.equal((await ask(base, stored.id, 'bad')).status, 404);
      // Sample and OpenStreetMap lists have nothing to fetch.
      assert.deepEqual(await (await ask(base, saved.id, first25.sign(saved.id))).json(), { prospects: [] });
    });
    // Past the daily limits the list still opens, with a message instead of the names.
    await serve(app((key) => key.startsWith('f25d:')), async (base) => {
      const r = await ask(base, stored.id, k);
      assert.equal(r.status, 429);
      assert.match((await r.json()).error, /didn't load from Google Maps/);
    });
  } finally {
    g.restore();
    delete process.env.FIRST25_SOURCE; delete process.env.GOOGLE_PLACES_KEY;
  }
});

test('the search pages name a live source and link the terms (Legal L53)', () => {
  assert.equal(first25.injectPage({ params: {} }), '');
  process.env.FIRST25_SOURCE = 'osm';
  try {
    assert.equal(first25.injectPage({ params: { niche: 'gyms' } }), '<script>window.F25_SOURCE="osm";</script>\n<script>window.F25_NICHE="gyms";</script>\n');
  } finally { delete process.env.FIRST25_SOURCE; }
  assert.match(D.copy.srcLine.google, /^Business info from Google Maps\. By searching, you agree to our \{terms\}, including Google Maps' terms\.$/);
  assert.match(D.copy.srcLine.osm, /^Business info from OpenStreetMap\. By searching, you agree to our \{terms\}\.$/);
});

test('OpenStreetMap city lookups take turns, once a second, and once per place (Legal L53 part 2.3)', async () => {
  const realFetch = global.fetch, hits = [];
  global.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/search?')) { hits.push(Date.now()); return jsonRes([{ boundingbox: ['41.9', '42.1', '-93.8', '-93.5'], lat: '42.0', lon: '-93.6' }]); }
    if (u.includes('interpreter')) return jsonRes({ elements: [] });
    return realFetch(url, init);
  };
  try {
    const B = E.buyer('gyms');
    await Promise.all([first25._test.fromOsm(B, 'Ames, IA'), first25._test.fromOsm(B, 'Ames, IA'), first25._test.fromOsm(B, 'Boone, IA')]);
    assert.equal(hits.length, 2, 'Ames once, Boone once');
    assert.ok(hits[1] - hits[0] >= 1000, 'a second apart');
    await first25._test.fromOsm(B, ' ames,  IA ');
    assert.equal(hits.length, 2, 'a place looked up before comes from the cache');
  } finally { global.fetch = realFetch; }
});

test("a paid map server's key stays in its URL: LocationIQ's ?key= and Tracestrack's path (Legal L55)", () => {
  const url = (set) => {
    if (set) process.env.OSM_NOMINATIM_URL = set; else delete process.env.OSM_NOMINATIM_URL;
    const u = new URL(first25._test.nominatimUrl('Ames, IA'));
    return { at: u.origin + u.pathname, params: Object.fromEntries(u.searchParams) };
  };
  const ames = { format: 'json', limit: '1', q: 'Ames, IA' };
  try {
    assert.deepEqual(url(), { at: 'https://nominatim.openstreetmap.org/search', params: ames }, 'the public server, for testing');
    assert.deepEqual(url('https://nominatim.example/'), { at: 'https://nominatim.example/search', params: ames }, 'just the server');
    // LocationIQ's search URL (the form the gym pack reads), just its server, or its older .php path. Its key is kept and
    // our params join it; it has no jsonv2, so the format is json either way.
    for (const set of ['https://us1.locationiq.com/v1/search?key=test-key', 'https://us1.locationiq.com/v1?key=test-key', 'https://us1.locationiq.com/v1/search.php?key=test-key&format=jsonv2']) {
      assert.deepEqual(url(set), { at: set.includes('.php') ? 'https://us1.locationiq.com/v1/search.php' : 'https://us1.locationiq.com/v1/search', params: { key: 'test-key', ...ames } }, set);
    }
  } finally { delete process.env.OSM_NOMINATIM_URL; }
});

test("a search on paid map servers sends each key only to its server, and shows LocationIQ's link, never the key", async () => {
  const realFetch = global.fetch, calls = [];
  process.env.OSM_NOMINATIM_URL = 'https://us1.locationiq.com/v1/search?key=liq-test-key';
  process.env.OSM_OVERPASS_URL = 'https://api.tracestrack.com/overpass/tt-test-key/interpreter';
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ u, method: init.method || 'GET', body: String(init.body || '') });
    if (u.startsWith('https://us1.locationiq.com/')) return jsonRes([{ boundingbox: ['41.9', '42.1', '-93.6', '-93.3'], lat: '42.0', lon: '-93.45' }]);
    if (u.startsWith('https://api.tracestrack.com/')) return jsonRes({ elements: [{ type: 'node', id: 7, tags: { name: 'Lantern Gym', leisure: 'fitness_centre' } }] });
    throw new Error('no other server');
  };
  try {
    const doc = await first25.run({ pack: 'video', buyer: 'gyms', place: 'Nevada, IA', source: 'osm' });
    assert.deepEqual(calls.map((c) => [c.method, c.u.split('?')[0]]), [['GET', 'https://us1.locationiq.com/v1/search'], ['POST', 'https://api.tracestrack.com/overpass/tt-test-key/interpreter']]);
    assert.equal(new URL(calls[0].u).searchParams.get('key'), 'liq-test-key');
    assert.match(calls[1].body, /^data=/);
    assert.ok(!calls[1].body.includes('test-key'), "Overpass's query carries no key");
    assert.equal(doc.prospects[0].name, 'Lantern Gym');
    // LocationIQ's free plan asks for its link where its search is used: under the button and with the list's credits.
    process.env.FIRST25_SOURCE = 'osm';
    assert.equal(first25.injectPage({ params: {} }), '<script>window.F25_SOURCE="osm";</script>\n<script>window.F25_SEARCH_BY="locationiq";</script>\n');
    const v = first25.view(doc);
    assert.equal(v.searchBy, 'locationiq');
    assert.deepEqual(D.copy.searchBy[v.searchBy], { text: 'Search by LocationIQ.com', url: 'https://locationiq.com' });
    for (const out of [JSON.stringify(v), JSON.stringify(db.get('prospectRuns', doc.id)), first25.injectPage({ params: {} }), first25.emailText({ name: 'Sam', data: { run_id: doc.id, k: first25.sign(doc.id) } }, () => '[state]').text]) {
      assert.ok(!/test-key|locationiq\.com\/v1|tracestrack/.test(out), 'no server URL or key leaves the server');
    }
    // Other servers get no LocationIQ link.
    process.env.OSM_NOMINATIM_URL = 'https://nominatim.example';
    assert.equal(first25.view(doc).searchBy, undefined);
    assert.equal(first25.injectPage({ params: {} }), '<script>window.F25_SOURCE="osm";</script>\n');
  } finally {
    global.fetch = realFetch;
    delete process.env.FIRST25_SOURCE; delete process.env.OSM_NOMINATIM_URL; delete process.env.OSM_OVERPASS_URL;
  }
});

// ---------- the messages members send (Legal L53 part 3) ----------
test('every cold email ends with the mailing address and the opt-out, and DMs carry neither', () => {
  const b = { name: 'Lantern Gym', gaps: [{ id: 'no_video' }] };
  const blank = E.messages(b, 'video', 'gyms', { me: 'Maya', city: 'Ames' });
  assert.match(blank.email, /\n\nMaya\n\[your mailing address\]\n\nP\.S\. Not for you\? Reply "no thanks"/);
  const m = E.messages(b, 'video', 'gyms', { me: 'Maya', city: 'Ames', addr: 'PO Box 12, Ames, IA 50010' });
  for (const k of ['email', 'follow1Email', 'follow2Email']) assert.match(m[k], /\n\nMaya\nPO Box 12, Ames, IA 50010\n\nP\.S\. Not for you\? Reply "no thanks" and I won't follow up\.$/, k);
  for (const k of ['dm', 'walkin', 'follow1', 'follow2']) assert.doesNotMatch(m[k], /PO Box|P\.S\./, k);
  assert.match(D.copy.addr.help, /US law asks for a mailing address in sales emails\. A PO box or virtual mailbox works\./);
  // Honest subjects: an offer, never "Re:" or "Quick question".
  for (const P of Object.values(D.packs)) assert.doesNotMatch(P.subject, /^re:|quick question/i);
});

test('each fact in a message can be checked first, and Google numbers stay out of messages', () => {
  const b = { name: 'Lantern Gym', website: 'https://lanterngym.com', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=x&query_place_id=abc', reviews: 12,
    gaps: [{ id: 'few_reviews', points: 14 }, { id: 'no_video', points: 10 }, { id: 'no_tiktok', points: 8 }] };
  assert.deepEqual(E.facts(b, 'dm').map((g) => g.id), ['few_reviews']);
  assert.deepEqual(E.facts(b, 'email').map((g) => g.id), ['few_reviews', 'no_video']);
  assert.deepEqual(E.facts(b, 'walkin'), []);
  assert.equal(E.checkLink(b, 'few_reviews'), b.mapsUrl);
  assert.equal(E.checkLink(b, 'no_video'), 'https://lanterngym.com');
  assert.equal(E.checkLink({ website: 'https://lantern.example' }, 'no_video'), null);
  const m = E.messages(b, 'ai', 'gyms', { me: 'Maya', city: 'Ames' });
  assert.match(m.dm, /I noticed Lantern Gym doesn't have many Google reviews yet\./);
  for (const t of Object.values(m)) assert.doesNotMatch(t, /\b12\b/);
  assert.equal(D.gaps.no_description.say, "Your homepage doesn't have a description set for search results.");
  // Gap words come from the business as it is now; a line that needs a number we don't have drops out.
  assert.equal(E.words(b, 'gyms').gaps[0].chip, '12 reviews');
  assert.deepEqual(E.words({ ...b, reviews: null }, 'gyms').gaps.map((g) => g.id), ['no_video', 'no_tiktok']);
});

test('samples stay private, a no ends the follow-ups, and nothing is ever a text', () => {
  for (const k of ['video', 'social', 'web', 'ai', 'email']) assert.match(D.specs[k].steps.join(' '), /never post/, k);
  for (const k of ['reel', 'grid', 'site', 'chat', 'email']) assert.match(D.mock.notes[k], /only for them, so never post it/, k);
  assert.match(D.plan[1], /Skip any with a "No soliciting" sign\./);
  assert.match(D.plan[2], /except anyone who said no/);
  assert.match(D.copy.noFollow, /A no ends it\./);
  assert.match(D.copy.walkNote, /"No soliciting"/);
  const fs = require('fs'), path = require('path');
  for (const f of ['public/funnels/first-25.js', 'public/funnels/first25-engine.js', 'public/funnels/first25-data.js', 'public/funnels/first25-mock.js', 'lib/first25.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), /sms:/i, f);
  }
});

// ---------- the follow-up emails and HQ ----------
test('the follow-up email fields carry their list and what we found, never a business name, and page data can never overwrite source', () => {
  const funnels = require('../lib/funnels');
  const k = first25.sign(saved.id);
  const lead = { email: 'jordan@example.com', name: 'Jordan', source: 'first-25', data: { run_id: saved.id, k, source: 'sample', pack: 'video' }, utm: { source: 'instagram' } };
  const p = funnels._test.eventProps(lead);
  assert.equal(p.source, 'first-25');
  assert.equal(p.utm_source, 'instagram');
  assert.equal(p.first25_count, 25);
  assert.equal(p.first25_city, 'Des Moines');
  assert.match(p.first25_list_url, new RegExp(`/first-25/r/${saved.id}\\?k=${k}$`));
  assert.ok(p.first25_top1_why);
  assert.equal(p.first25_sample, 'Their 15-second reel');
  assert.equal(p.first25_is_sample, true);
  assert.equal(p.first25_source, 'sample');
  // Legal L53 part 1.3: no names, and no messages with names in them, from any source.
  for (const key of ['first25_top1', 'first25_top2', 'first25_top3', 'first25_top1_dm', 'first25_top1_day3']) assert.equal(p[key], undefined, key);
  for (const b of saved.prospects) for (const v of Object.values(p)) assert.ok(typeof v !== 'string' || !v.includes(b.name), `no business name in ${v}`);
  for (const [key, v] of Object.entries(p)) if (typeof v === 'string') assert.doesNotMatch(v, /\{\w+\}|undefined/, `${key} is filled`);
  // A bad signature adds nothing, and the other funnels never get these fields.
  assert.deepEqual(first25.nurtureProps({ ...lead, data: { run_id: saved.id, k: 'bad' } }), {});
  assert.equal(funnels._test.eventProps({ ...lead, source: 'founder-score' }).first25_list_url, undefined);
});

test('the HQ import gives one Pipeline row per business, with its tracker stage', async () => {
  const doc = db.get('prospectRuns', saved.id);
  const rows = first25.pipeline(doc, 'Jordan');
  const STAGES = D.stages.map((s) => s.id);
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows.map((r) => r.key)).size, 25, 'one key per business');
  for (const r of rows) {
    assert.equal(r.source, 'first-25');
    assert.match(r.key, /^first25:/);
    assert.ok(r.company);
    assert.ok(STAGES.includes(r.stage));
    assert.match(r.data.messages.dm, /I'm Jordan/);
  }
  assert.equal(rows.find((r) => r.data.rank === 2).stage, 'contacted');
  assert.equal(rows.find((r) => r.data.rank === 3).stage, 'won');
  assert.equal(rows.find((r) => r.data.rank === 1).stage, 'found');
  // Google lists leave out phone and address, like the CSV (Funnels F7).
  const g = first25.pipeline({ ...doc, source: 'google', sample: false });
  assert.ok(g.every((r) => !r.links.phone && r.data.address === null));
  // HQ asks by email: the newest list saved at the gate, written for the name they gave.
  await db.save('leads', { email: 'jordan@example.com', name: 'Jordan', source: 'first-25', data: { run_id: saved.id, k: first25.sign(saved.id) } });
  const mine = first25.leadsFor('Jordan@Example.com');
  assert.equal(mine.length, 25);
  assert.match(mine[0].data.messages.dm, /I'm Jordan/);
  assert.deepEqual(first25.leadsFor('nobody@example.com'), []);
});

test('lists older than 30 days are deleted', async () => {
  const old = await db.save('prospectRuns', { kind: 'first25', prospects: [], createdAt: new Date(Date.now() - 31 * 864e5).toISOString() });
  const fresh = await db.save('prospectRuns', { kind: 'first25', prospects: [] });
  const n = await first25.prune();
  assert.ok(n >= 1);
  assert.equal(db.get('prospectRuns', old.id), null);
  assert.ok(db.get('prospectRuns', fresh.id));
});
