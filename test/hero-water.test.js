// The floating, liquid First Light hero (public/js/first-light.js with water, passes in public/img/flw, behind
// HERO_LIVE + HERO_WATER on views/home.ejs). The shader can only run in a browser, so this checks what can go wrong
// without one: every pass at both sizes, files small enough for the hero, the shader's constants all filled in, and
// the page asking for the water only when both flags are on.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FLW = path.join(ROOT, 'public/img/flw');
const PASSES = ['halo', 'rig', 'line', 'shine', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 'rest'];

test('every water pass and the poster, at both sizes, light enough for the hero', () => {
  let total = 0;
  for (const n of PASSES) for (const suf of ['', '-s']) {
    const f = path.join(FLW, `${n}${suf}.jpg`);
    assert.ok(fs.existsSync(f), `${n}${suf}.jpg`);
    const b = fs.readFileSync(f);
    assert.equal(b[0], 0xff); assert.equal(b[1], 0xd8);
    assert.ok(b.length < 160 * 1024, `${n}${suf}.jpg is ${b.length} bytes`);
    if (!suf) total += b.length;
  }
  assert.ok(total < 1100 * 1024, `desktop set is ${Math.round(total / 1024)} KB`);
});

test('the shader has its scene constants filled in, and turns the water on by its define', () => {
  const src = fs.readFileSync(path.join(ROOT, 'public/js/first-light.js'), 'utf8');
  assert.match(src, /#define WATER 0/);
  assert.match(src, /replace\('#define WATER 0', '#define WATER 1'\)/);
  for (const k of ['WBOX', 'PITCH', 'TH', 'TV', 'CY', 'CZ', 'LIFT']) assert.ok(src.includes(k), k);
  // the water field and the glass field sample from units the passes don't use
  assert.match(src, /uniform1i\(U\.uW, 11\); gl\.uniform1i\(U\.uM, 12\)/);
});

test('the homepage asks for the water only with both flags on', () => {
  const v = fs.readFileSync(path.join(ROOT, 'views/home.ejs'), 'utf8');
  assert.match(v, /var heroWater = heroLive && process\.env\.HERO_WATER === 'true';/);
  assert.match(v, /data-fl<% if \(heroWater\) \{ %> data-fl-water<% \} %>/);
  assert.match(v, /srcset="<%= flDir %>rest-s\.jpg"/);
  assert.match(v, /water, base: water \? '\/img\/flw\/' : '\/img\/fl\/'/);
});
