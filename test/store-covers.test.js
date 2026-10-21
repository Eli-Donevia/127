// Store covers (lib/store-covers.js, views/partials/store-cover.ejs): every item in the real store.json shows
// something real on its card, every website template has its desktop and phone screenshots
// (scripts/store-thumbs.js), and a thumbnail name never reaches outside its folder.

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const ejs = require('ejs');

const store = require('../lib/store');
const covers = require('../lib/store-covers');

const lib = store.load();
const PARTIAL = path.join(__dirname, '..', 'views', 'partials', 'store-cover.ejs');

test('every Store item has a cover, and none is just its kind label', () => {
  assert.ok(lib.items.length > 0);
  for (const item of lib.items) {
    const cv = covers.coverOf(item, lib);
    assert.ok(['site', 'paper', 'prompts', 'video', 'doc'].includes(cv.type), `${item.id}: ${cv.type}`);
    const html = ejs.render(require('fs').readFileSync(PARTIAL, 'utf8'), { cv }, { filename: PARTIAL });
    assert.match(html, /aria-hidden="true"/, item.id);
    if (cv.type === 'prompts') assert.ok(cv.lines.length > 0, item.id);
    if (cv.type === 'video') assert.ok(cv.shots.length > 0 && cv.models.length > 0, item.id);
  }
});

test('every website template has its desktop and phone screenshots', () => {
  const sites = lib.items.filter((i) => i.kind === 'site');
  assert.ok(sites.length >= 18);
  for (const s of sites) {
    assert.ok(covers.thumbFile(s.id, 'desk.jpg'), `${s.id}: run node scripts/store-thumbs.js ${s.id}`);
    assert.ok(covers.thumbFile(s.id, 'phone.jpg'), `${s.id}: run node scripts/store-thumbs.js ${s.id}`);
    const cv = covers.coverOf(s, lib);
    assert.equal(cv.desk, `/app/hq/store/${s.id}/thumb/desk.jpg`);
    assert.equal(cv.phone, `/app/hq/store/${s.id}/thumb/phone.jpg`);
  }
});

test('a video pack lists each shot once with its camera move, and leaves out its how-to and sources', () => {
  const v = lib.items.find((i) => i.id === 'video-prompts-cinematic');
  const cv = covers.coverOf(v, lib);
  assert.equal(cv.type, 'video');
  assert.deepEqual(cv.shots[0], { title: 'Golden hour', camera: 'Side track' });
  assert.equal(new Set(cv.shots.map((s) => s.title)).size, cv.shots.length);
  assert.ok(!cv.models.some((m) => /how to use|sources/i.test(m)));
  const img = covers.coverOf(lib.items.find((i) => i.id === 'video-prompts-image-ads'), lib);
  assert.equal(img.still, true);
  assert.ok(!img.models.includes('Sources'));
});

test('thumbnail names are fixed: no other file, no path out of the folder', () => {
  assert.equal(covers.thumbFile('site-agency', '../../templates/store.json'), null);
  assert.equal(covers.thumbFile('../templates', 'desk.jpg'), null);
  assert.equal(covers.thumbFile('site-agency', 'preview.html'), null);
  assert.equal(covers.thumbFile('no-such-item', 'desk.jpg'), null);
});
