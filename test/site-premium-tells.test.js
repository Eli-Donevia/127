// The premium pass on all 18 animated designs (v2/design/site-templates/30k-prompt.md): every design declares its
// motion as choreo, and none of the AI tells the pass removed come back: no pill badge with a status dot, no monogram
// square in the header, no overshoot or wobble easing, no hairline grid backgrounds, at most one gradient text, no
// glyph separators, and the placeholder photos are window light, not blurred blobs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '../lib/packs/site/lib');
const MOTION = path.join(SITE, 'templates/motion');
const fresh = () => { for (const k of Object.keys(require.cache)) if (k.startsWith(SITE)) delete require.cache[k]; };
function load() {
  const old = process.env.SITE_MOTION;
  process.env.SITE_MOTION = 'on';
  fresh();
  try { return { T: require(path.join(SITE, 'templates')), facts: require(path.join(SITE, 'facts')), site: require(path.join(SITE, 'site')), art: require(path.join(SITE, 'art')) }; }
  finally { if (old === undefined) delete process.env.SITE_MOTION; else process.env.SITE_MOTION = old; fresh(); }
}
const IDS = ['beacon', 'atelier', 'supper', 'northstar', 'gather', 'launch', 'market', 'orbit', 'soon', 'foundry', 'frame', 'spotlight', 'linkstack', 'nightfall', 'rotunda', 'assembly', 'lumen', 'bloom'];
const SAMPLE = { business: 'Harbor Lane', what: 'Dog grooming', city: 'Tampa, FL', owner: 'Rae', services: 'Bath and tidy, $45\nFull groom, $80', included: 'Nail trim\nEar clean', email: 'hi@harborlane.example', color: '#2f6f8f' };

test('every animated design declares choreo with a real intro, motion at rest and a scroll moment', () => {
  const { T } = load();
  for (const id of IDS) {
    const ch = T.TEMPLATES.find((t) => t.id === id).choreo;
    assert.ok(ch, `${id}: choreo`);
    assert.notEqual(ch.intro, 'none', `${id}: intro`);
    assert.ok(Array.isArray(ch.alive) && !ch.alive.includes('still'), `${id}: alive`);
    assert.notEqual(ch.scroll, 'none', `${id}: scroll`);
  }
});

test('the design modules carry none of the removed tells', () => {
  for (const id of IDS) {
    const src = fs.readFileSync(path.join(MOTION, `${id}.js`), 'utf8');
    assert.ok(!/class="[^"]*\b(pill|chip)-?dot\b/.test(src) && !/<span class="dot"/.test(src), `${id}: no status dot badge`);
    assert.ok(!/cubic-bezier\(\s*[\d.]+\s*,\s*(1\.[0-9]*[1-9]|[2-9])/.test(src), `${id}: no overshoot easing`);
    assert.ok(!/@keyframes\s+\w*[Ww]obble/.test(src), `${id}: no wobble`);
    assert.ok(!/✦|★|✦/.test(src), `${id}: no glyph separators`);
    assert.ok((src.match(/background-clip:\s*text/g) || []).length <= 1, `${id}: at most one gradient text`);
  }
});

test('the built pages have no monogram square in the header', async () => {
  const { facts, site } = load();
  for (const id of IDS) {
    const r = await site.buildSite(null, { facts: facts.factsFrom(null, SAMPLE, { own: false }), template: id, render: false });
    const index = r.files.find((f) => f.name === 'index.html').data;
    const hdr = (index.match(/<header[\s\S]*?<\/header>/) || [''])[0];
    assert.ok(!/class="mark"/.test(hdr), `${id}: wordmark only`);
  }
});

test('placeholder photos are window light: no blurred blobs, no text, the member colours only', () => {
  const { art } = load();
  const p = { primary: '#2f6f8f', accent: '#c8322b', paper: '#f4f3ef', ink: '#111111' };
  for (const style of ['sweep', 'arch', 'plates', 'portrait', 'object', 'grid', 'tile', 'mesh']) {
    for (let i = 0; i < 3; i++) {
      const svg = art.placeholder({ style, w: 1600, h: 1000, p, seed: 'Harbor Lane', index: i });
      assert.ok(!/<circle|<ellipse|<text/.test(svg), `${style}: no circles, blobs or text`);
      assert.ok(!/#d8b46e/i.test(svg), `${style}: never 127 gold`);
      assert.equal(svg, art.placeholder({ style, w: 1600, h: 1000, p, seed: 'Harbor Lane', index: i }), `${style}: same art every build`);
    }
  }
});

test('brain auto-fill brand fills blanks on the member\'s own site only, and the form wins', () => {
  const { factsFrom } = require('../lib/packs/site/lib/facts');
  const ctx = { brain: { business: { name: 'Bean Lane' }, brand: { color: '#1f3a5f', theme: 'dark', typeMood: 'serif', mood: 'calm' } } };
  const own = factsFrom(ctx, { what: 'coffee roaster' }, { own: true });
  assert.equal(own.color, '#1f3a5f');
  assert.equal(own.theme, 'dark');
  assert.equal(own.typeMood, 'serif');
  const form = factsFrom(ctx, { what: 'coffee roaster', color: 'forest green', theme: 'light' }, { own: true });
  assert.equal(form.color, 'forest green');
  assert.equal(form.theme, 'light');
  const client = factsFrom(ctx, { business: 'Other', what: 'coffee roaster' }, { own: false });
  assert.equal(client.theme, '');
  assert.equal(client.typeMood, '');
});
