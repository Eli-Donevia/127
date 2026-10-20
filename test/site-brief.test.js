// A Website brief (HQ Briefs) opens "Build your website tonight" filled in, and its motion reaches site.build:
// with SITE_MOTION on the workflow asks for intro, alive, scroll, pace and look, each blank keeping the design's own.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const PACK = path.join(__dirname, '../lib/packs/site');
const fresh = () => { for (const k of Object.keys(require.cache)) if (k.startsWith(PACK)) delete require.cache[k]; };
function load(on) {
  const old = process.env.SITE_MOTION;
  if (on) process.env.SITE_MOTION = 'on';
  else delete process.env.SITE_MOTION;
  fresh();
  try { return { pack: require(PACK), build: require(path.join(PACK, 'tools/build-site')), motion: require(path.join(PACK, 'lib/motion')) }; }
  finally { if (old === undefined) delete process.env.SITE_MOTION; else process.env.SITE_MOTION = old; fresh(); }
}
const refs = require('../lib/harness/refs');
const briefs = require('../lib/harness/briefs');
const tonight = (pack) => pack.workflows.find((w) => w.id === 'site.build_tonight');

test('with SITE_MOTION off, build tonight is unchanged: no motion fields, no motion passed', () => {
  const { pack } = load(false);
  const wf = tonight(pack);
  assert.ok(!('intro' in wf.inputs.properties));
  assert.ok(!('motion' in wf.steps.find((s) => s.id === 'build').input));
});

test('with SITE_MOTION on, a brief\'s motion goes from the form to site.build and on to the design', () => {
  const { pack, build, motion } = load(true);
  const wf = tonight(pack);
  for (const k of ['intro', 'alive', 'scroll', 'pace', 'look']) assert.ok(wf.inputs.properties[k], k);
  assert.deepEqual(wf.inputs.properties.intro.enum, Object.keys(motion.CHOREO_PRESETS.intro));
  // The form sends strings; blanks are left out (routes inputsFrom), alive is a comma list.
  const step = wf.steps.find((s) => s.id === 'build');
  const m = refs.resolve(step.input.motion, { inputs: { business: 'Casa', intro: 'pour', alive: 'tap, scroll', pace: 'fast' }, steps: {} });
  const got = build.motionOf(m);
  assert.deepEqual(got, { intro: 'pour', alive: ['tap', 'scroll'], pace: 'fast' });
  assert.deepEqual(motion.resolveChoreo({ intro: 'develop', alive: ['drift'], scroll: 'pin', pace: 'medium' }, got), { intro: 'pour', alive: ['tap', 'scroll'], scroll: 'pin', pace: 'fast', look: '' });
  assert.equal(build.motionOf({ intro: '', alive: undefined }), undefined);
});

test('a Website brief becomes the prefill for build tonight', () => {
  const site = briefs.get('site');
  const out = briefs.compile(site, { business: 'Casa Lumbre', what: 'Wood-fired kitchen\nmore', palette: '#060607, #F4F3EF, accent #C8322B, #111111', intro_style: ['unfold'], alive: ['drift', 'tap'], scroll_style: ['roadmap'], look: ['editorial'] });
  const q = new URLSearchParams(briefs.buildQuery(out));
  assert.equal(q.get('in_business'), 'Casa Lumbre');
  assert.equal(q.get('in_what'), 'Wood-fired kitchen');
  assert.equal(q.get('in_color'), '#C8322B');
  assert.equal(q.get('in_intro'), 'unfold');
  assert.equal(q.get('in_alive'), 'drift, tap');
  assert.equal(q.get('in_scroll'), 'roadmap');
  assert.equal(q.get('in_look'), 'Editorial');
  assert.equal(q.get('in_pace'), null);
  assert.equal(new URLSearchParams(briefs.buildQuery(briefs.compile(site, { palette: '#111, #222' }))).get('in_color'), '#222');
});
