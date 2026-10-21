// The animated website designs (W6, SITE_MOTION=on): each builds from plain facts into one standalone page, with its
// motion gated by the head line (reduced motion keeps everything still) and nothing invented.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const SITE = path.join(__dirname, '../lib/packs/site/lib');
const fresh = () => { for (const k of Object.keys(require.cache)) if (k.startsWith(SITE)) delete require.cache[k]; };
function load(flag) {
  const old = process.env.SITE_MOTION;
  if (flag) process.env.SITE_MOTION = flag; else delete process.env.SITE_MOTION;
  fresh();
  try { return { T: require(path.join(SITE, 'templates')), facts: require(path.join(SITE, 'facts')), site: require(path.join(SITE, 'site')) }; }
  finally { if (old === undefined) delete process.env.SITE_MOTION; else process.env.SITE_MOTION = old; fresh(); }
}
const KINDS = ['local-service', 'studio', 'restaurant', 'coach', 'portfolio', 'product', 'agency', 'creator'];
const IDS = ['beacon', 'atelier', 'supper', 'northstar', 'gather', 'launch', 'market', 'orbit', 'soon', 'foundry', 'frame', 'spotlight', 'linkstack', 'nightfall', 'rotunda', 'assembly', 'lumen', 'bloom', 'optic', 'drop', 'roastery', 'freight', 'reel', 'feed'];

test('the animated designs show only with SITE_MOTION=on', () => {
  assert.equal(load().T.TEMPLATES.filter((t) => t.animated).length, 0);
  const on = load('on').T.TEMPLATES.filter((t) => t.animated);
  assert.deepEqual(on.map((t) => t.id).sort(), [...IDS].sort());
  for (const t of on) { assert.ok(KINDS.includes(t.kind), t.id); assert.ok(t.why && t.bestFor, t.id); }
});

test('each animated design builds a standalone page from a few facts', async () => {
  const { facts, site } = load('on');
  const thin = { business: 'Harbor Lane', what: 'Dog grooming', city: 'Tampa, FL', email: 'hi@harborlane.example' };
  for (const id of IDS) {
    const f = facts.factsFrom(null, thin, { own: false });
    const r = await site.buildSite(null, { facts: f, template: id, render: false });
    const html = r.preview;
    assert.match(html, /prefers-reduced-motion: reduce\)'\)\.matches\|\|document\.documentElement\.classList\.add\('m'\)/, id);
    assert.ok(html.includes('Harbor Lane'), id);
    assert.ok(html.includes("'Pause motion'"), `${id}: a pause control for looping motion (L76 W5)`);
    if (/id="f-signup"/.test(html)) assert.ok(html.includes('Unsubscribe anytime.'), `${id}: the signup says what people get (L76 W2)`);
    assert.ok(!/<input[^>]+type="checkbox"[^>]+checked/.test(html), `${id}: a pre-checked box`);
    assert.ok(!/—/.test(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')), `${id}: em dash`);
    assert.ok(!/<script[^>]+src=/.test(html), `${id}: outside script`);
    assert.ok(!/\$\d/.test(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')), `${id}: a price nobody gave`);
  }
});

test('a shop with several products gets Market, one product with a Buy link gets Launch, only with SITE_MOTION=on', () => {
  const pick = (flag, input) => {
    const old = process.env.SITE_MOTION;
    if (flag) process.env.SITE_MOTION = flag; else delete process.env.SITE_MOTION;
    fresh();
    try { return require(path.join(SITE, 'pick')).rankTemplates(require(path.join(SITE, 'facts')).factsFrom(null, input, { own: false }))[0].id; }
    finally { if (old === undefined) delete process.env.SITE_MOTION; else process.env.SITE_MOTION = old; fresh(); }
  };
  const candles = { business: 'Ember & Oak', what: 'Hand-poured soy candles', services: 'Cedar, $28\nFig, $28\nSalt Air, $32', email: 'a@b.example' };
  const bottle = { business: 'Halden', what: 'Insulated steel water bottle', services: 'Halden One, $38', buy: 'https://buy.stripe.com/test_x', shipping: 'Ships in 2 days', returns: '30 days', email: 'a@b.example' };
  assert.equal(pick('on', candles), 'market');
  assert.equal(pick('on', { ...candles, buy: 'https://emberandoak.etsy.com' }), 'market');
  assert.equal(pick('on', bottle), 'launch');
  assert.equal(pick('on', { business: 'Shine', what: 'Mobile car detailing', email: 'a@b.example' }), 'beacon');
  assert.equal(pick(null, candles), 'studio');
});

test('Market without a Buy link asks to order through a form', async () => {
  const { facts, site } = load('on');
  const f = facts.factsFrom(null, { business: 'Ember & Oak', what: 'Candles', services: 'Cedar, $28\nFig, $28', email: 'a@b.example' }, { own: false });
  const r = await site.buildSite(null, { facts: f, template: 'market', render: false });
  assert.match(r.preview, /id="f-order"/);
  assert.ok(!r.preview.includes('policies.html'));
});

test('a design the member names comes first, even when another fits better', () => {
  process.env.SITE_MOTION = 'on';
  fresh();
  try {
    const { rankTemplates } = require(path.join(SITE, 'pick'));
    const f = require(path.join(SITE, 'facts')).factsFrom(null, require('../lib/packs/site/sample/examples.json')['site.quick_site'], { own: false });
    for (const id of IDS) assert.equal(rankTemplates(f, { prefer: id })[0].id, id);
    assert.equal(rankTemplates(f, { prefer: 'studio' })[0].id, 'studio');
  } finally {
    delete process.env.SITE_MOTION;
    fresh();
  }
});

test('scroll-lit words wait in a readable color, never dimmed out (a reader and an audit see real contrast)', () => {
  const dir = path.join(SITE, 'templates/motion');
  for (const f of require('fs').readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const css = require('fs').readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/html\.m [^{]*(\.w\b|\.lw\b)[^{]*\{[^}]*opacity:\.[0-4]/.test(css), f);
  }
});

// The five reel designs (0028): each keeps to the budget and to the rules for its kind of motion.
test('the reel designs: light pages, WebGL only in Lumen and only the careful way, frames only when given', async () => {
  const { facts, site } = load('on');
  const build = async (id, input) => (await site.buildSite(null, { facts: facts.factsFrom(null, input, { own: false }), template: id, render: false })).files.find((f) => f.name === 'index.html').data;
  const base = { business: 'Tern Audio', product: 'Tern One', what: 'Wireless speaker', included: 'Aluminum shell\nTwo-way driver\nReplaceable battery', services: 'Tern One, $249', buy: 'https://buy.stripe.com/test_x', email: 'a@b.example' };
  for (const id of ['nightfall', 'rotunda', 'assembly', 'lumen', 'bloom']) {
    const html = await build(id, base);
    const bytes = Buffer.byteLength(html.replace(/@font-face\{[^}]*\}/g, ''));
    assert.ok(bytes < 70000, `${id}: ${bytes} bytes of HTML, CSS and script`);
    assert.ok(!/#d8b46e/i.test(html), `${id}: 127's Circle gold`);
    assert.ok(!/https?:\/\/(fonts\.|cdn|unpkg)/.test(html), `${id}: something from outside`);
    const webgl = /getContext\('webgl'/.test(html);
    assert.equal(webgl, id === 'lumen', `${id}: WebGL`);
    if (webgl) {
      assert.match(html, /Math\.min\(devicePixelRatio\|\|1,2\)\*\.5/, 'half resolution, device pixel ratio capped at 2');
      assert.match(html, /innerWidth<768\)return/, 'phones keep the CSS light');
      assert.match(html, /addEventListener\('load'/, 'starts after load');
      assert.match(html, /IntersectionObserver\(function\(es\)\{vis=/, 'stops off screen');
      assert.match(html, /classList\.contains\('mp'\)/, 'stops when motion is paused');
      assert.match(html, /class="lm-fb"/, 'a CSS fallback under the canvas');
    }
  }
  const plain = await build('assembly', base);
  assert.ok(!/data-frames=/.test(plain) && !/<canvas/.test(plain), 'no frames given: the CSS layers, no canvas');
  const seq = await build('assembly', { ...base, frames: 120 });
  assert.match(seq, /data-frames="120"/);
  assert.match(seq, /<canvas class="as-seq"/);
  for (const x of ['Aluminum shell', 'Two-way driver', 'Replaceable battery']) assert.ok(plain.includes(`</b>${x}</span>`), `a callout for ${x}`);
  const night = await build('nightfall', base);
  assert.equal((night.match(/class="nf-num"/g) || []).length, 4, 'four chapter numerals');
  const ring = await build('rotunda', { business: 'Arlo', what: 'Architecture photographer', work: 'One | a\nTwo | b\nThree | c', email: 'a@b.example' });
  assert.equal((ring.match(/class="rt-card dup"[^>]*aria-hidden="true"/g) || []).length, 7, 'the repeats around the ring are hidden from screen readers');
  assert.equal((ring.match(/class="rt-case"/g) || []).length, 3, 'a case study for each piece');
});
