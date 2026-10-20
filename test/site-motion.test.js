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
const IDS = ['beacon', 'atelier', 'supper', 'northstar', 'gather', 'launch', 'orbit', 'soon', 'foundry', 'frame', 'spotlight', 'linkstack'];

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
