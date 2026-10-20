// The homepage's inline CSS (lib/critical-css.js, views/partials/doc-start.ejs): cut from style.css at first use, so
// the homepage paints without waiting on style.css, which then loads without blocking. In a browser with style.css
// blocked, every element on the homepage (all three heroes, desktop and phone) came out with the same box and
// styles as with it; these keep the cut sound without one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const zlib = require('zlib');
const C = require('../lib/critical-css');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/css/style.css'), 'utf8');

test('style.css parses and prints back with every rule', () => {
  const rules = (SRC.replace(/\/\*[\s\S]*?\*\//g, '').match(/{/g) || []).length;
  assert.equal((C.print(C.parse(SRC)).match(/{/g) || []).length, rules);
});

test('the homepage cut keeps its own rules, drops other pages, and stays small', () => {
  const css = C.homeCritical();
  assert.ok(css.length > 10000);
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length);
  for (const s of ['.fl-stage', '.fl-canvas', '.fl[data-fl-water]', '.lit', '.ticker', ':root', '@font-face']) assert.ok(css.includes(s), s);
  // a class the homepage never uses is left for style.css
  const words = C.homeWords();
  const other = [...SRC.matchAll(/\.([a-z][\w-]{4,})\b/g)].map((m) => m[1]).find((w) => !words.has(w));
  assert.ok(other, 'style.css has rules for other pages');
  assert.ok(!new RegExp(`\\.${other}(?![\\w-])`).test(css), other);
  assert.ok(zlib.gzipSync(css).length < 20 * 1024, `${zlib.gzipSync(css).length} bytes gzipped`);
  // a keyframes block stays only when a kept rule animates with it
  for (const m of css.matchAll(/@keyframes ([\w-]+)/g)) assert.match(css, new RegExp(`animation(-name)?:[^;}]*\\b${m[1]}\\b`), m[1]);
});

test('selectors split at top-level commas only', () => {
  assert.deepEqual(C.split('.a,.b :is(.c,.d),[x="1,2"]'), ['.a', '.b :is(.c,.d)', '[x="1,2"]']);
});

test('the head inlines it and loads style.css without blocking, with a noscript fallback; other pages link it', () => {
  const file = path.join(ROOT, 'views/partials/doc-start.ejs');
  const base = { canonical: 'https://127.test/', baseUrl: 'https://127.test', plausible: '', trackEvents: [] };
  const home = ejs.render(fs.readFileSync(file, 'utf8'), { ...base, criticalCss: '.x{color:red}' }, { filename: file });
  assert.match(home, /<style>\.x\{color:red\}<\/style>/);
  assert.match(home, /<link rel="preload" href="\/css\/style.css" as="style" onload="this.onload=null;this.rel='stylesheet'">/);
  assert.match(home, /<noscript><link rel="stylesheet" href="\/css\/style.css"><\/noscript>/);
  const other = ejs.render(fs.readFileSync(file, 'utf8'), base, { filename: file });
  assert.match(other, /<link rel="stylesheet" href="\/css\/style.css">/);
  assert.doesNotMatch(other, /rel="preload" href="\/css\/style.css"/);
  assert.match(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), /criticalCss: criticalCss\.homeCritical\(\)/);
});
