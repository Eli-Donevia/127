// The liquid 127 hero (public/js/liquid-127.js, poster and distance field in public/img/liquid, behind
// HERO_LIVE + HERO_WATER on views/home.ejs). The shader can only run in a browser, so this checks what can go wrong
// without one: the poster at both sizes and the distance field, small enough for the hero; the shader's constants all
// filled in; and the page asking for the liquid hero only when both flags are on.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'public/img/liquid');

test('the poster at both sizes and the distance field, light enough for the hero', () => {
  for (const n of ['rest.jpg', 'rest-s.jpg']) {
    const b = fs.readFileSync(path.join(DIR, n));
    assert.equal(b[0], 0xff); assert.equal(b[1], 0xd8);
    assert.ok(b.length < 120 * 1024, `${n} is ${b.length} bytes`);
  }
  const p = fs.readFileSync(path.join(DIR, 'mark-sdf.png'));
  assert.equal(p.toString('ascii', 1, 4), 'PNG');
  // 1024 x 576, as the shader reads it (its extent is set in scene units to match)
  assert.equal(p.readUInt32BE(16), 1024); assert.equal(p.readUInt32BE(20), 576);
  assert.ok(p.length < 256 * 1024, `mark-sdf.png is ${p.length} bytes`);
});

test('the shader has its scene constants filled in, and keeps the field away from colour conversion', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/liquid-127.js'), 'utf8');
  for (const k of ['BGC', 'SWV', 'SHV', 'SRV', 'DEPTHV', 'BEVELV', 'WBV', 'CAMV', 'AIMV']) assert.ok(src.includes(`.replace('${k}'`), k);
  assert.ok(src.includes(".replaceAll('TANV_'"));
  assert.match(src, /colorSpaceConversion: 'none', premultiplyAlpha: 'none'/);
  assert.match(src, /UNPACK_COLORSPACE_CONVERSION_WEBGL, gl\.NONE/);
  // software WebGL keeps the poster, and a phone gets the lighter shader
  assert.match(src, /SOFT\.test\(/);
  assert.match(src, /opts\.small \? FS\.replace\('#define STEPS 90', '#define STEPS 64'\)/);
  assert.match(src, /export async function liquid127\(stage, opts = \{\}\)/);
});

test('the homepage asks for the liquid hero only with both flags on', () => {
  const v = fs.readFileSync(path.join(ROOT, 'views/home.ejs'), 'utf8');
  assert.match(v, /var heroWater = heroLive && process\.env\.HERO_WATER === 'true';/);
  assert.match(v, /var flDir = heroWater \? '\/img\/liquid\/' : '\/img\/fl\/';/);
  assert.match(v, /data-fl<% if \(heroWater\) \{ %> data-fl-water<% \} %>/);
  assert.match(v, /srcset="<%= flDir %>rest-s\.jpg"/);
  assert.match(v, /import\('\/js\/liquid-127\.js'\)\.then\(\(\{ liquid127 \}\) => liquid127\(fl\.querySelector\('\.fl-stage'\), opts\)\)/);
  assert.match(v, /import\('\/js\/first-light\.js'\)\.then\(\(\{ firstLight \}\) => firstLight\(fl\.querySelector\('\.fl-stage'\), \{ \.\.\.opts, base: '\/img\/fl\/' \}\)\)/);
});

test('the 127 rises out of the pond only where the live hero can play it, and the poster backs it up', () => {
  const v = fs.readFileSync(path.join(ROOT, 'views/home.ejs'), 'utf8');
  // the still pond replaces the poster only on a real GPU with motion welcome, with a 5 s fallback to the poster
  assert.match(v, /failIfMajorPerformanceCaveat: true/);
  assert.match(v, /s\.classList\.add\('is-pond'\); s\.flPond = setTimeout\(function \(\) \{ s\.classList\.remove\('is-pond'\); \}, 5000\);/);
  assert.match(v, /get reveal\(\) \{ clearTimeout\(fl\.flPond\); return pond\(\); \}/);
  assert.match(v, /\.catch\(\(\) => \{ clearTimeout\(fl\.flPond\); fl\.classList\.remove\('is-pond'\); \}\)/);
  const css = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8');
  assert.match(css, /\.fl\.is-pond \.fl-stage picture\{opacity:0\}/);
});
