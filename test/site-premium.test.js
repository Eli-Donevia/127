// The premium pass (batch 1): six animated designs declare their motion as data (choreo) and the shared runtime plays
// it with the vendored Motion bundle. Each page carries the bundle only when its design uses choreo, keeps to the
// member's colors, loads nothing from outside, and is complete with JavaScript off and with reduced motion.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SITE = path.join(__dirname, '../lib/packs/site/lib');
const VENDOR = path.join(__dirname, '../lib/packs/site/vendor');
const fresh = () => { for (const k of Object.keys(require.cache)) if (k.startsWith(SITE)) delete require.cache[k]; };
function load() {
  const old = process.env.SITE_MOTION;
  process.env.SITE_MOTION = 'on';
  fresh();
  try { return { T: require(path.join(SITE, 'templates')), facts: require(path.join(SITE, 'facts')), site: require(path.join(SITE, 'site')), motion: require(path.join(SITE, 'motion')), roadmap: require(path.join(SITE, 'templates/roadmap')) }; }
  finally { if (old === undefined) delete process.env.SITE_MOTION; else process.env.SITE_MOTION = old; fresh(); }
}

const BATCH = ['beacon', 'atelier', 'supper', 'northstar', 'launch', 'lumen'];
const SAMPLES = {
  beacon: require('../lib/packs/site/sample/examples.json')['site.quick_site'],
  atelier: require('../lib/packs/site/sample/examples.json')['site.build_tonight'],
  supper: { business: 'Casa Lumbre', what: 'Wood-fired Mexican kitchen', city: 'Austin, TX', menu: 'Tacos:\nCarne asada taco, $5, grilled skirt steak\nBaja fish taco, $6\nPlates:\nPollo a la brasa, $22\nSides:\nElote, $5', order: 'https://order.example/casa', address: '1401 E 6th St, Austin, TX 78702', email: 'hola@casalumbre.example' },
  northstar: { business: 'Clear Path Coaching', what: 'Leadership coaching', owner: 'Dana', services: 'Intro call, free, 20 min\nSingle session, $150, 60 min\nThe new manager program, $1,800, six sessions', included: 'Six one to one sessions on Zoom\nA written plan after our first session', booking: 'https://cal.example/dana', email: 'dana@clearpath.example' },
  launch: { business: 'Halden Goods', what: 'Insulated steel water bottle', product: 'Halden One', services: 'Halden One 600 ml, $38\nHalden One 900 ml, $44', included: 'Double wall steel\nLeakproof cap\nFits car cup holders', buy: 'https://buy.stripe.com/test_halden', shipping: 'Ships in 2 business days', email: 'hello@halden.example', color: '#1f6f5c' },
  lumen: { business: 'Glowbird', product: 'Glowbird', what: 'AI meeting notes app', tagline: 'Meeting notes that write themselves', services: 'Free, $0, 5 meetings a month\nPro, $12 a month, unlimited meetings', included: 'Notes after every call\nWorks with Zoom\nYour recordings stay yours', buy: 'https://glowbird.example/start', email: 'hi@glowbird.example', color: '#7c5cff and #2dd4bf' },
};

async function build(L, id, input, opts = {}) {
  const r = await L.site.buildSite(null, { facts: L.facts.factsFrom(null, input, { own: false }), template: id, render: false, ...opts });
  return { r, index: r.files.find((f) => f.name === 'index.html').data, file: (n) => r.files.find((f) => f.name === n) };
}
const css = (html) => (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
const inlineScripts = (html) => (html.match(/<script>[\s\S]*?<\/script>/g) || []).join('');

test('each upgraded design declares a valid choreo block', () => {
  const L = load();
  const P = L.motion.CHOREO_PRESETS;
  for (const id of BATCH) {
    const t = L.T.TEMPLATES.find((x) => x.id === id);
    assert.ok(t && t.choreo, `${id}: choreo`);
    const ch = t.choreo;
    assert.ok(Object.keys(P.intro).includes(ch.intro) && ch.intro !== 'none', `${id}: intro ${ch.intro}`);
    assert.ok(Array.isArray(ch.alive) && ch.alive.length && ch.alive.every((a) => a !== 'still' && P.alive[a]), `${id}: alive`);
    assert.ok(P.scroll[ch.scroll] && ch.scroll !== 'none', `${id}: scroll`);
    assert.ok(P.pace[ch.pace], `${id}: pace`);
    assert.deepEqual(L.motion.resolveChoreo(ch), ch, `${id}: the block is already clean`);
    assert.doesNotThrow(() => JSON.stringify(ch));
  }
  // Each kind of business gets its own intro idea in this batch's restaurant, salon, coach and software designs.
  const intro = (id) => L.T.TEMPLATES.find((x) => x.id === id).choreo.intro;
  assert.equal(intro('supper'), 'pour');
  assert.equal(intro('atelier'), 'unfold');
  assert.equal(intro('northstar'), 'develop');
  assert.equal(intro('lumen'), 'type');
});

test('resolveChoreo falls back per field and never throws', () => {
  const { motion: M } = load();
  const base = { intro: 'pour', alive: ['drift', 'tap'], scroll: 'scene', pace: 'medium', look: 'warm' };
  assert.deepEqual(M.resolveChoreo(base, { intro: 'develop', pace: 'calm' }), { ...base, intro: 'develop', pace: 'calm' });
  assert.deepEqual(M.resolveChoreo(base, { intro: 'explode', scroll: 7, pace: null }), base);
  assert.deepEqual(M.resolveChoreo(base, { alive: ['still'] }).alive, ['still']);
  assert.deepEqual(M.resolveChoreo(base, { alive: ['still', 'pointer', 'pointer', 'wobble'] }).alive, ['pointer']);
  assert.deepEqual(M.resolveChoreo(base, { alive: 'scroll' }).alive, ['scroll']);
  assert.deepEqual(M.resolveChoreo(base, { alive: ['wobble'] }).alive, ['drift', 'tap']);
  assert.equal(M.resolveChoreo(base, { look: `  dark   and ${'x'.repeat(400)}` }).look.length, 200);
  assert.equal(M.resolveChoreo(base, { look: 3 }).look, 'warm');
  for (const junk of [null, undefined, 4, 'pour', [], { intro: {} }, { alive: [1, null] }]) {
    assert.doesNotThrow(() => M.resolveChoreo(junk, junk));
    assert.deepEqual(Object.keys(M.resolveChoreo(junk, junk)).sort(), ['alive', 'intro', 'look', 'pace', 'scroll']);
  }
  assert.deepEqual(M.resolveChoreo({ intro: 'bad' }), M.CHOREO_DEFAULTS);
  for (const k of ['intro', 'alive', 'scroll', 'pace']) assert.ok(Object.keys(M.CHOREO_PRESETS[k]).length >= 3, k);
  assert.ok(M.CHOREO_PRESETS.scroll.roadmap, 'the roadmap preset');
});

test('the six pages: bundle beside the page, runtime inline, member colors, nothing from outside', async () => {
  const L = load();
  const bundle = fs.readFileSync(path.join(VENDOR, 'motion-sites.js'), 'utf8').trim();
  assert.match(bundle.split('\n')[0], /^\/\*! Motion 13\.5\.1 .*MIT License/);
  for (const id of BATCH) {
    const { r, index, file } = await build(L, id, SAMPLES[id]);
    assert.equal((index.match(/<script defer src="motion\.js"><\/script>/g) || []).length, 1, `${id}: one deferred bundle`);
    assert.equal(file('motion.js').data, bundle, `${id}: the vendored bundle`);
    assert.ok(file('motion-LICENSE.txt'), `${id}: its license travels with it`);
    assert.match(file('_headers').data, /\/motion\.js\n {2}Cache-Control/);
    assert.ok(!r.preview.includes('src="motion.js"') && r.preview.includes(bundle), `${id}: the preview inlines it`);
    assert.match(index, /data-ci="head"/, `${id}: an intro`);
    assert.match(index, /data-alive=/, `${id}: something alive at rest`);
    assert.match(index, /data-sc[ >]|data-rm/, `${id}: a scroll moment`);
    // The roadmap stepper is the scroll moment only where the member's own steps are the story (round 2 of the pass).
    if (['beacon', 'northstar'].includes(id)) assert.match(index, /data-rm>/, `${id}: a roadmap from the member's facts`);
    assert.deepEqual(r.choreo, L.T.TEMPLATES.find((x) => x.id === id).choreo);
    assert.ok(!/#d8b46e/i.test(r.preview), `${id}: 127's gold`);
    for (const html of [index, r.preview]) {
      assert.ok(!/<script[^>]+src="(https?:)?\/\//.test(html), `${id}: an outside script`);
      assert.ok(!/<link[^>]+rel="(stylesheet|preload|preconnect)"[^>]+href="(https?:)?\/\//.test(html), `${id}: an outside stylesheet or font`);
      assert.ok(!/url\((["']?)(https?:)?\/\//.test(css(html)), `${id}: an outside url() in the CSS`);
      assert.ok(!/fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr/.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')), `${id}: a CDN`);
    }
    const gz = zlib.gzipSync(inlineScripts(index)).length + zlib.gzipSync(bundle).length;
    assert.ok(gz < 30000, `${id}: ${gz} bytes of script, gzip`);
  }
});

test('nothing staged: no glow, aurora, halo, seal, blurred blob or looping marquee in the six', async () => {
  const L = load();
  for (const id of BATCH) {
    const { index } = await build(L, id, SAMPLES[id]);
    const style = css(index);
    const markup = index.replace(/<style>[\s\S]*?<\/style>/, '');
    for (const cls of ['hero-glow', 'quote-glow', 'aurora', 'lm-halo', 'lm-beam', 'dawn', 'class="seal"', 'visit-mono', 'mq-track']) assert.ok(!markup.includes(cls), `${id}: ${cls}`);
    for (const cls of ['hero-glow', 'quote-glow', '.aurora', 'lm-halo', 'lm-beam', '.dawn', '.seal', 'visit-mono']) assert.ok(!style.includes(cls), `${id}: ${cls} CSS`);
    assert.ok(!/(^|[;{])filter:blur\(/.test(style), `${id}: a blurred blob`);
    assert.ok(!/animation:[^;}]*infinite/.test(style.replace(/\.ci-typing[^}]*\}/g, '').replace(/\.mq-track\{[^}]*\}/g, '')), `${id}: a looping animation`);
  }
});

test('JS off and reduced motion: every first frame is hidden only behind the motion classes, the words are in the page', async () => {
  const L = load();
  for (const id of BATCH) {
    const { r, index } = await build(L, id, SAMPLES[id]);
    const style = css(index);
    // Every rule that hides an intro piece or a roadmap node sits behind html.m or html.rm-go.
    for (const rule of style.match(/[^{}]+\{[^}]*opacity:0[;}][^}]*\}?/g) || []) {
      const sel = rule.split('{')[0];
      if (/data-ci|rm-node|rm-dot|lm-beat|\.hs\b|ci-/.test(sel)) assert.match(sel, /html\.(m|rm-go)\b|@keyframes|ciBlink/, `${id}: ${sel.trim()}`);
    }
    assert.ok(!/<[^>]+style="[^"]*opacity:\s*0/.test(index), `${id}: something hidden inline`);
    assert.ok(!/<(section|div|h1|p)[^>]+\shidden[\s>]/.test(index), `${id}: a hidden element`);
    // The headline's own words are in the HTML, not written in by script.
    const h1 = (index.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || ['', ''])[1].replace(/<[^>]+>/g, '');
    assert.ok(h1.replace(/\s+/g, '').length > 3, `${id}: the headline text`);
    // The motion class is only added when reduced motion is off, before paint.
    assert.match(index, /prefers-reduced-motion: reduce\)'\)\.matches\|\|document\.documentElement\.classList\.add\('m'\)/);
    assert.match(r.preview, /if \(!h\.classList\.contains\('m'\)\) return;/, `${id}: the runtime stands down without the motion class`);
  }
});

test('a brief\'s motion overrides the design field by field, and designs without choreo carry no bundle', async () => {
  const L = load();
  const { r, index } = await build(L, 'supper', SAMPLES.supper, { motion: { intro: 'develop', pace: 'calm', alive: ['nope'], look: 'candlelit' } });
  assert.deepEqual(r.choreo, { intro: 'develop', alive: ['drift', 'tap'], scroll: 'scene', pace: 'calm', look: 'candlelit' });
  assert.ok(index.includes('"intro":"develop"') && index.includes('"k":1.3') && index.includes('"look":"candlelit"'));
  const still = await build(L, 'beacon', SAMPLES.beacon, { motion: { intro: 'none', alive: ['still'], scroll: 'none' } });
  assert.ok(!/ciSafe|data-alive\]\{will-change/.test(css(still.index)), 'no hidden first frames and no alive rule');
  for (const id of ['coach', 'restaurant', 'studio']) {
    const { index: other, file } = await build(L, id, SAMPLES.atelier, { motion: { intro: 'pour' } });
    assert.ok(!other.includes('motion.js') && !file('motion.js'), `${id}: no bundle`);
  }
});

test('the roadmap draws only facts it is given, at least two, at most six', () => {
  const { roadmap: R } = load();
  assert.equal(R.roadmap({ nodes: [{ title: 'One' }] }), '');
  const html = R.roadmap({ title: 'Steps', nodes: Array.from({ length: 9 }, (_, i) => ({ title: `Step ${i}` })), end: '<a class="btn" href="#x">Book</a>' });
  assert.equal((html.match(/class="rm-node"/g) || []).length, 6);
  assert.equal((html.match(/rm-node rm-end/g) || []).length, 1);
  assert.match(html, /data-rm/);
  assert.match(R.wave(3), /^M166\.7 50 Q333\.3 8 500\.0 50 Q666\.7 92 833\.3 50$/);
  const g = R.groupNodes([{ title: 'Tacos', items: [{ name: 'Fish', price: 6, priceText: '$6' }, { name: 'Steak', price: 5, priceText: '$5' }] }, { title: 'Sides', items: [{ name: 'Elote' }] }]);
  assert.deepEqual(g, [{ title: 'Tacos', meta: 'From $5', sub: 'Fish, Steak' }, { title: 'Sides', meta: '', sub: 'Elote' }]);
});

test('the docs list every preset the runtime accepts', () => {
  const { motion: M } = load();
  const md = fs.readFileSync(path.join(SITE, 'choreo.md'), 'utf8');
  for (const k of ['intro', 'alive', 'scroll', 'pace']) for (const v of Object.keys(M.CHOREO_PRESETS[k])) assert.ok(md.includes(`'${v}'`), `${k}: ${v}`);
  assert.ok(fs.readFileSync(path.join(VENDOR, 'README.md'), 'utf8').includes('motion@13.5.1'));
});
