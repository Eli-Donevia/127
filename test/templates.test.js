// Templates library: manifest loading and the gated file route (GET /app/templates/:slug/:file).
// Run with: npm test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');

const templates = require('../lib/templates');
const roadmap = require('../lib/roadmap');

const DIR = path.join(__dirname, '..', 'content', 'templates');
const raw = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

test('manifest loads every template with its files, previews and checklists', () => {
  assert.strictEqual(raw.version, 1);
  assert.strictEqual(templates.version, 1);
  assert.strictEqual(templates.list.length, raw.templates.length);
  assert.strictEqual(templates.list.length, raw.count);
  for (const t of templates.list) {
    assert.ok(templates.KINDS[t.kind], `${t.slug} kind`);
    assert.ok(templates.TRACKS[t.track], `${t.slug} track`);
    assert.ok(['free', 'builder'].includes(t.tier), `${t.slug} tier`);
    assert.ok(t.formats.length > 0, `${t.slug} has formats`);
    for (const f of t.formats) {
      const abs = path.join(DIR, f.file);
      assert.ok(fs.existsSync(abs), `missing ${f.file}`);
      const buf = fs.readFileSync(abs);
      assert.strictEqual(buf.length, f.bytes, `${f.file} size`);
      assert.strictEqual(crypto.createHash('sha256').update(buf).digest('hex'), f.sha256, `${f.file} sha256`);
    }
    if (t.preview) assert.ok(fs.existsSync(path.join(DIR, t.preview)), `missing ${t.preview}`);
    for (const g of t.checklist || []) for (const it of g.items) assert.ok(it.id.startsWith(`${t.slug}.${g.key}.`), `${it.id} is slug.group.n`);
  }
  const ids = templates.list.flatMap((t) => [...t.checklistIds]);
  assert.strictEqual(new Set(ids).size, ids.length, 'checklist item ids are unique');
  assert.deepStrictEqual(templates.list.filter((t) => t.checklistIds.size).map((t) => t.slug).sort(), ['batch-day', 'launch-countdown', 'money-setup-checklist', 'page-leak-audit']);
});

test('nothing from the templates library sits in public/', () => {
  const pub = path.join(__dirname, '..', 'public');
  const names = new Set(templates.list.flatMap((t) => t.formats.map((f) => path.basename(f.file))));
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [e.name]));
  assert.deepStrictEqual(walk(pub).filter((n) => names.has(n)), []);
});

test('roadmapIndex covers every roadmap step and points at real templates', () => {
  const stepIds = [];
  for (const [key, track] of Object.entries(roadmap.TRACKS)) track.weeks.forEach((w, wi) => w.tasks.forEach((_, ti) => stepIds.push(`${key}-w${wi + 1}-t${ti + 1}`)));
  assert.strictEqual(stepIds.length, 48);
  for (const id of stepIds) assert.ok(templates.forTask(id).length > 0, `no template for ${id}`);
  for (const slugs of Object.values(templates.roadmapIndex)) for (const s of slugs) assert.ok(templates.get(s), `roadmapIndex points at unknown ${s}`);
  assert.deepStrictEqual(templates.forTask('start-w1-t1').map((t) => t.slug), ['idea-scorecard']);
  assert.deepStrictEqual(templates.forTask('start-w1-commit'), []);
  assert.ok(templates.forPlaybook('idea-filter').some((t) => t.slug === 'idea-scorecard'));
});

test('resolveFile only returns files the manifest lists for that slug', () => {
  assert.ok(templates.resolveFile('idea-scorecard', '127-idea-scorecard.xlsx'));
  assert.ok(templates.resolveFile('idea-scorecard', 'preview.png').isPreview);
  assert.strictEqual(templates.resolveFile('founder-os-notion', 'preview.png'), null);
  assert.strictEqual(templates.resolveFile('idea-scorecard', '127-one-page-offer.pdf'), null);
  assert.strictEqual(templates.resolveFile('nope', 'preview.png'), null);
  assert.strictEqual(templates.resolveFile('idea-scorecard', '../manifest.json'), null);
  assert.strictEqual(templates.resolveFile('idea-scorecard', '..'), null);
  assert.strictEqual(templates.resolveFile('../templates', 'manifest.json'), null);
  assert.strictEqual(templates.resolveFile('constructor', 'preview.png'), null);
  assert.strictEqual(templates.resolveFile('idea-scorecard', 'hasOwnProperty'), null);
  assert.strictEqual(templates.dueLabel(-14), '14 days before launch');
  assert.strictEqual(templates.dueLabel(0), 'Launch day');
  assert.strictEqual(templates.dueLabel(1), '1 day after launch');
  assert.strictEqual(templates.dueLabel(null), null);
});

// A small app with the real handler; the test picks the member with an x-tier header.
function server() {
  const app = express();
  app.use((req, res, next) => {
    const tier = req.get('x-tier');
    req.user = tier ? { id: 'u1', tier } : null;
    next();
  });
  app.get('/app/templates/:slug/:file', templates.serveFile());
  app.use((req, res) => res.status(404).send('not found'));
  return new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
}
function get(s, urlPath, tier) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: s.address().port, path: urlPath, headers: tier ? { 'x-tier': tier } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}

test('gated file route', async (t) => {
  const s = await server();
  t.after(() => s.close());
  const offer = templates.get('one-page-offer');
  assert.strictEqual(offer.tier, 'builder');
  const pdf = offer.formats.find((f) => f.file.endsWith('.pdf'));
  const pdfUrl = `/app/templates/one-page-offer/${path.basename(pdf.file)}`;

  await t.test('free member is blocked from a Builder file', async () => {
    const r = await get(s, pdfUrl, 'free');
    assert.strictEqual(r.status, 302);
    assert.match(r.headers.location, /^\/app\/templates\/one-page-offer\?locked=1#unlock$/);
    assert.strictEqual(r.headers['content-disposition'], undefined);
    assert.ok(!r.body.includes(Buffer.from('%PDF')));
  });

  await t.test('signed-out visitor goes to sign in', async () => {
    const r = await get(s, pdfUrl, null);
    assert.strictEqual(r.status, 302);
    assert.match(r.headers.location, /^\/login\?next=/);
  });

  await t.test('Builder and Circle members get the file as a download', async () => {
    for (const tier of ['builder', 'circle']) {
      const r = await get(s, pdfUrl, tier);
      assert.strictEqual(r.status, 200, tier);
      assert.strictEqual(r.headers['content-type'], 'application/pdf');
      assert.strictEqual(r.headers['content-disposition'], `attachment; filename="${path.basename(pdf.file)}"`);
      assert.match(r.headers['cache-control'], /private/);
      assert.strictEqual(r.body.length, pdf.bytes);
    }
  });

  await t.test('free member opens a Free template', async () => {
    const r = await get(s, '/app/templates/idea-scorecard/127-idea-scorecard.xlsx', 'free');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.match(r.headers['content-disposition'], /^attachment;/);
    const csv = await get(s, '/app/templates/idea-scorecard/127-idea-scorecard.csv', 'free');
    assert.strictEqual(csv.headers['content-type'], 'text/csv; charset=utf-8');
  });

  await t.test('previews are open to every member, inline', async () => {
    const r = await get(s, '/app/templates/one-page-offer/preview.png', 'free');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['content-type'], 'image/png');
    assert.match(r.headers['content-disposition'], /^inline;/);
  });

  await t.test('unknown slug or file is a 404', async () => {
    assert.strictEqual((await get(s, '/app/templates/no-such-template/preview.png', 'builder')).status, 404);
    assert.strictEqual((await get(s, '/app/templates/one-page-offer/nope.pdf', 'builder')).status, 404);
    assert.strictEqual((await get(s, '/app/templates/idea-scorecard/127-one-page-offer.pdf', 'free')).status, 404);
    assert.strictEqual((await get(s, '/app/templates/founder-os-notion/preview.png', 'builder')).status, 404);
  });

  await t.test('path traversal is blocked', async () => {
    for (const p of [
      '/app/templates/one-page-offer/..%2F..%2Fmanifest.json',
      '/app/templates/one-page-offer/..%2f..%2f..%2f..%2fpackage.json',
      '/app/templates/one-page-offer/%2e%2e%2f%2e%2e%2fmanifest.json',
      '/app/templates/..%2Ffiles/manifest.json',
      '/app/templates/one-page-offer/..',
      '/app/templates/one-page-offer/%2e%2e',
      '/app/templates/one-page-offer/127-one-page-offer.pdf%00.png',
      '/app/templates/one-page-offer/..%5C..%5Cmanifest.json',
    ]) {
      const r = await get(s, p, 'circle');
      assert.strictEqual(r.status, 404, p);
      assert.ok(!r.body.toString().includes('"templates"'), p);
    }
  });
});

test('O24: free members open templates linked from their own weeks 1 and 2, nothing else', () => {
  for (const [key, track] of Object.entries(roadmap.TRACKS)) {
    const weeks = track.weeks.map((w, wi) => ({ week: wi + 1, freeVisible: wi < 2, tasks: w.tasks.map((_, ti) => ({ id: `${key}-w${wi + 1}-t${ti + 1}` })) }));
    const user = { tier: 'free', roadmap: { weeks } };
    const free = new Set(weeks.slice(0, 2).flatMap((w) => w.tasks.flatMap((t) => templates.forTask(t.id).map((x) => x.slug))));
    for (const t of templates.list) {
      const expected = t.tier === 'free' || free.has(t.slug);
      assert.strictEqual(templates.canOpen(user, t), expected, `${key}: ${t.slug}`);
    }
    // Step 1 never hits a paywall.
    for (const t of templates.forTask(`${key}-w1-t1`)) assert.ok(templates.canOpen(user, t), `${key} step 1: ${t.slug}`);
  }
  assert.strictEqual(templates.canOpen({ tier: 'free' }, templates.list.find((t) => t.tier === 'builder')), false);
});
