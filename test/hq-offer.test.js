// The workspace offer (lib/hq-offer.js, conversion/offer.md section 1A): /pricing sells 127 HQ only once it's on for
// members, every number is something members can use that day, and nothing says a paid plan gets members clients,
// customers or leads (Legal L62), so the copy check finds nothing in any of it.

const path = require('path');
const fs = require('fs');

for (const k of Object.keys(process.env)) if (/^(HQ_|HARNESS_|CONNECTOR_|CONNECTORS$|BRAIN_DOCS$|STORE_V2$|SITE_MOTION$|TERMS_LIVE$|PRIVACY_LIVE$|ANTHROPIC_API_KEY$)/.test(k)) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');
const ejs = require('ejs');

const harness = require('../lib/harness');
const connectors = require('../lib/harness/connectors');
const skills = require('../lib/harness/skills');
const prompts = require('../lib/harness/prompts');
const offer = require('../lib/hq-offer');
const templates = require('../lib/templates');
const store = require('../lib/store');
const { PLANS } = require('../lib/plans');
const { check } = require('../lib/copy-check');

harness.init();

const VIEWS = path.join(__dirname, '..', 'views');
const membersOn = () => Object.assign(process.env, { HQ_OFFER: 'on', HARNESS_V2: 'on', TERMS_LIVE: 'true', PRIVACY_LIVE: 'true', ANTHROPIC_API_KEY: 'sk-test' });
const reset = () => {
  for (const k of Object.keys(process.env)) if (/^(HQ_|HARNESS_|CONNECTOR_|CONNECTORS$|BRAIN_DOCS$|STORE_V2$|SITE_MOTION$|TERMS_LIVE$|PRIVACY_LIVE$|ANTHROPIC_API_KEY$)/.test(k)) delete process.env[k];
  connectors.CLEARED.delete('notion');
};
const launch = { prelaunch: false, foundingOpen: false, foundingPrice: null, cap: 100 };
const renderCards = (hqOffer) => ejs.render(fs.readFileSync(path.join(VIEWS, 'partials', 'plans.ejs'), 'utf8'), { launch, PLANS, user: null, circleCapacity: 4, hqOffer }, { filename: path.join(VIEWS, 'partials', 'plans.ejs') });
const renderStack = (hqOffer) => ejs.render(fs.readFileSync(path.join(VIEWS, 'partials', 'hq-stack.ejs'), 'utf8'), { hqOffer });
// Every line a reader can see.
const words = (p) => [p.line, p.count, p.keep, ...p.stack.flatMap((r) => [r.name, r.says, r.does, typeof r.free === 'string' ? r.free : '']), p.cards.free.line, p.cards.builder.line, p.cards.builder.flag, ...p.cards.free.items, ...p.cards.builder.items, ...p.cards.circle.items, ...p.compare.flat()];

test('off by default, and on for members only with HQ v2 on for everyone, the Terms and Privacy pages live and real AI', () => {
  reset();
  assert.deepEqual(offer.forPage(), { show: false, live: false });
  process.env.HQ_OFFER = 'on';
  assert.equal(offer.forPage().show, false, 'HQ v2 is off');
  Object.assign(process.env, { HARNESS_V2: 'on', ANTHROPIC_API_KEY: 'sk-test' });
  assert.equal(offer.forPage().show, false, 'the Terms and Privacy pages are not live, so HQ v2 is admins only');
  Object.assign(process.env, { TERMS_LIVE: 'true', PRIVACY_LIVE: 'true' });
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(offer.forPage().show, false, 'no real AI answers');
  membersOn();
  const p = offer.forPage();
  assert.equal(p.show, true);
  assert.equal(p.live, true);
  assert.equal(p.preview, false);
  process.env.HQ_OFFER = 'off';
  assert.equal(offer.forPage().show, false, 'Eli turns it off with one flag');
  reset();
});

test('an admin can preview it before it is on, marked as a preview', () => {
  reset();
  const p = offer.forPage({ preview: true });
  assert.equal(p.show, true);
  assert.equal(p.live, false);
  assert.equal(p.preview, true);
});

test('it counts only workflows that run for real today, and the count line uses only those numbers', () => {
  reset();
  membersOn();
  const p = offer.forPage();
  const all = [...harness.packs.registry.workflows.values()].filter((wf) => !wf.hidden);
  const real = all.filter((wf) => wf.steps.every((s) => {
    const t = s.tool && harness.packs.tool(s.tool);
    return !t || [...(t.needs || []), ...(t.wants || [])].every((n) => harness.needs.available(n));
  }));
  assert.equal(p.n.workflows, real.length);
  assert.ok(p.n.workflows > 0 && p.n.workflows <= all.length);
  assert.equal(p.n.free, real.filter((wf) => wf.tier === 'free').length);
  // A workflow that needs a service Legal hasn't cleared (Deepgram, needs.js HELD) never counts.
  assert.ok(!offer.runsForReal(harness.packs.workflow('video.caption')));
  assert.equal(p.n.templates, templates.list.length);
  assert.equal(p.count, `${p.n.workflows.toLocaleString('en-US')} workflows. ${p.n.templates} templates. ${p.n.playbooks} playbooks. ${p.n.credits.builder.toLocaleString('en-US')} credits a month. All 4 weeks of your roadmap.`);
  for (const [id] of offer.EXAMPLES) if (p.n.examples.length === offer.EXAMPLES.length) assert.ok(offer.runsForReal(harness.packs.workflow(id)), id);
  reset();
});

test('credits come from the ledger, so the page and HQ never disagree', () => {
  reset();
  membersOn();
  process.env.HARNESS_CREDITS_BUILDER = '1200';
  const p = offer.forPage();
  assert.equal(p.n.credits.builder, 1200);
  assert.ok(p.cards.builder.items[0].includes('1,200 credits a month'));
  assert.ok(p.stack.some((r) => r.name === '1,200 credits a month'));
  process.env.HARNESS_FREE_RUN = 'off';
  assert.ok(!words(offer.forPage()).some((w) => /free, once/.test(w)), 'no free run once it is off');
  reset();
});

test('"your accounts connected" and each row show only while what they name is on for members', () => {
  reset();
  membersOn();
  let p = offer.forPage();
  assert.equal(p.line, 'Your business HQ: real tools, every template, and AI that does the work with your OK.');
  const ids = (x) => x.stack.map((r) => r.id);
  for (const id of ['ask', 'connections', 'ailink', 'studio']) assert.ok(!ids(p).includes(id), `${id} is off`);
  Object.assign(process.env, { CONNECTORS: 'on', CONNECTOR_STRIPE: 'on' });
  assert.ok(!ids(offer.forPage()).includes('connections'), "a switch alone isn't enough: HQ isn't on for members and Legal hasn't cleared Stripe");
  Object.assign(process.env, { HQ_LIVE: 'true', HQ_SECRET: 'x'.repeat(32) });
  p = offer.forPage();
  assert.equal(p.line, 'Your business HQ: real tools, your accounts connected, every template, and AI that does the work with your OK.');
  assert.match(p.stack.find((r) => r.id === 'connections').does, /^Connect Stripe or Shopify/, "HQ's own Stripe and Shopify sales");
  connectors.CLEARED.add('notion');
  process.env.CONNECTOR_NOTION = 'admins';
  assert.match(offer.forPage().stack.find((r) => r.id === 'connections').does, /^Connect Stripe or Shopify/, 'a connector for admins only is not for members');
  process.env.CONNECTOR_NOTION = 'on';
  assert.match(offer.forPage().stack.find((r) => r.id === 'connections').does, /^Connect the apps you already use, 1 so far\./, 'cleared and switched on for members');
  connectors.CLEARED.delete('notion');
  delete process.env.CONNECTOR_NOTION;
  p = offer.forPage();
  assert.ok(!ids(p).includes('ailink'), 'the AI link also needs HQ_HARNESS');
  process.env.HQ_HARNESS = 'true';
  p = offer.forPage();
  assert.equal(p.stack.find((r) => r.id === 'ailink').name, 'Your AI link');
  assert.ok(p.cards.builder.items.includes('Your AI link: HQ inside Claude or ChatGPT'));
  process.env.HQ_MCP_BRAIN = 'on';
  assert.equal(offer.forPage().stack.find((r) => r.id === 'ailink').name, 'Make Claude your admin');
  process.env.HQ_LIVE = 'admins';
  assert.ok(!ids(offer.forPage()).includes('ailink'), 'HQ for admins only sells nothing');
  process.env.HQ_AGENT = 'on';
  process.env.BRAIN_DOCS = 'on';
  p = offer.forPage();
  assert.ok(ids(p).includes('ask'));
  assert.match(p.stack.find((r) => r.id === 'brain').does, /your own docs and house rules/);
  process.env.HQ_ACTIVITY = 'admins';
  assert.doesNotMatch(offer.forPage().stack.find((r) => r.id === 'ok').does, /Activity log/, 'a switch for admins only sells nothing');
  process.env.HQ_ACTIVITY = 'on';
  assert.match(offer.forPage().stack.find((r) => r.id === 'ok').does, /Your Activity log shows what you approved and what HQ did\.$/);
  assert.equal(offer.forPage().compare[3][0], 'Your Brain, Ask 127, the approvals inbox and the Activity log');
  process.env.HQ_SITE_AGENT = 'on';
  assert.ok(!words(offer.forPage()).some((w) => /site chat|chat on your site/i.test(w)), "site chat isn't built, so nothing sells it");
  process.env.HARNESS_REPEATS = 'off';
  assert.ok(!ids(offer.forPage()).includes('repeats'));
  reset();
});

test('Skills replace repeats once they are on for members, and name only jobs that reach no one (L62)', () => {
  reset();
  membersOn();
  const ids = (x) => x.stack.map((r) => r.id);
  assert.ok(ids(offer.forPage()).includes('repeats') && !ids(offer.forPage()).includes('skills'));
  process.env.HQ_SKILLS = 'admins';
  assert.ok(!ids(offer.forPage()).includes('skills'), 'a switch for admins only sells nothing');
  process.env.HQ_SKILLS = 'on';
  let p = offer.forPage();
  assert.ok(ids(p).includes('skills') && !ids(p).includes('repeats'));
  const row = p.stack.find((r) => r.id === 'skills');
  assert.equal(row.does, "Jobs HQ does on a schedule, like your numbers every morning, what's working every Friday and next week's posts every Sunday. Turn on the ones you want, and anything one drafts waits for your OK.");
  assert.ok(!/monday|nudge|follow|send|25|list|lead|client|customer/i.test(row.does));
  const free = offer.SKILLS.map(([id]) => skills.get(id)).filter((s) => skills.workflowOf(s).tier === 'free').map((s) => s.name);
  assert.ok(free.length > 0);
  assert.equal(row.free, free.join(' and '));
  assert.deepEqual(p.compare.find((r) => r[0] === 'Skills on a schedule'), ['Skills on a schedule', free.join(' and '), '✓', '✓']);
  assert.ok(!p.compare.some((r) => /^Repeats/.test(r[0])));
  Object.assign(process.env, { HQ_LIVE: 'true', HQ_SECRET: 'x'.repeat(32), HQ_HARNESS: 'true', HQ_MCP_BRAIN: 'on' });
  assert.match(offer.forPage().stack.find((r) => r.id === 'skills').does, /Add any skill to your own Claude too\.$/);
  reset();
});

test('once the Store is on for every member, templates count from its ready items, each only while its own flag is on', () => {
  reset();
  membersOn();
  assert.equal(offer.forPage().n.templates, templates.list.length, 'the v1 Library until the Store is on');
  process.env.STORE_V2 = 'admins';
  assert.equal(offer.forPage().n.templates, templates.list.length, 'a Store for admins only sells nothing');
  process.env.STORE_V2 = 'on';
  const ready = () => store.list().filter((i) => i.status === 'ready');
  let p = offer.forPage();
  assert.ok(ready().length > templates.list.length);
  assert.equal(p.n.templates, ready().length);
  assert.ok(!ready().some((i) => i.flag), 'website templates wait for SITE_MOTION');
  assert.ok(p.count.includes(` ${ready().length.toLocaleString('en-US')} templates.`), p.count);
  const row = p.stack.find((r) => r.id === 'templates');
  assert.equal(row.name, 'The Store');
  assert.match(row.does, new RegExp(`^${ready().length} templates so far, like Notion systems, sheets, docs, email templates and automation recipes\\. Make it mine fills ${ready().filter((i) => i.makeItMine).length} of them in`));
  assert.equal(row.free, `${ready().filter((i) => i.tier === 'free').length} of them`);
  assert.deepEqual(p.compare.find((r) => r[0] === 'Templates'), ['Templates', `${ready().filter((i) => i.tier === 'free').length}`, `All ${ready().length}`, `All ${ready().length}`]);
  assert.ok(p.cards.builder.items.includes(`Every template, ${ready().length} so far`));
  assert.ok(!ready().some((i) => i.tier !== 'free' && i.tier !== 'builder'), '"every template" on Builder stays true');
  process.env.SITE_MOTION = 'on';
  p = offer.forPage();
  assert.equal(p.n.templates, ready().length);
  assert.ok(ready().some((i) => i.kind === 'site'));
  assert.match(p.stack.find((r) => r.id === 'templates').does, /like website templates, Notion systems, sheets, docs and email templates\./);
  reset();
});

test('the prompt library shows and counts only while HQ_PROMPTS is on for members', () => {
  reset();
  membersOn();
  let p = offer.forPage();
  assert.ok(!p.stack.some((r) => r.id === 'prompts') && !/prompts/.test(p.count));
  process.env.HQ_PROMPTS = 'admins';
  assert.ok(!offer.forPage().stack.some((r) => r.id === 'prompts'));
  process.env.HQ_PROMPTS = 'on';
  p = offer.forPage();
  const lib = prompts.load().prompts;
  assert.ok(lib.length > 0);
  assert.equal(p.n.prompts, lib.length);
  assert.ok(p.count.includes(` templates. ${lib.length} prompts. `), p.count);
  const row = p.stack.find((r) => r.id === 'prompts');
  assert.equal(row.free, `${lib.filter((x) => x.tier === 'free').length} of them`);
  assert.ok(!/send it to Ask 127/.test(row.does), 'Ask 127 is off');
  assert.ok(p.cards.builder.items.includes(`Every template, ${p.n.templates} so far, and all ${lib.length} prompts`));
  process.env.HQ_AGENT = 'on';
  assert.match(offer.forPage().stack.find((r) => r.id === 'prompts').does, /or send it to Ask 127\.$/);
  reset();
});

test("Legal's keep-it line (L76) shows only with HQ_OFFER_KEEP and Brain docs on, under the Builder button and the stack", () => {
  reset();
  membersOn();
  let p = offer.forPage();
  assert.equal(p.keep, '');
  assert.ok(!renderCards(p).includes('yours to keep') && !renderStack(p).includes('yours to keep'));
  process.env.HQ_OFFER_KEEP = 'on';
  assert.equal(offer.forPage().keep, '', 'the Brain export that keeps it true is behind BRAIN_DOCS');
  process.env.BRAIN_DOCS = 'admins';
  assert.equal(offer.forPage().keep, '', 'Brain docs for admins only is not for members');
  process.env.BRAIN_DOCS = 'on';
  p = offer.forPage();
  assert.equal(p.keep, 'Anything you make is yours to keep, even if you cancel.');
  assert.ok(renderCards(p).includes('14 days to change your mind. Anything you make is yours to keep, even if you cancel.'));
  assert.ok(renderStack(p).includes('<p class="hqs-keep">Anything you make is yours to keep, even if you cancel.</p>'));
  assert.ok(!renderCards({ show: false, live: false }).includes('yours to keep'), 'never on the roadmap cards');
  reset();
});

test('nothing in it blocks or is held by the copy check as paid-plan copy (Legal L62), and it names no price', () => {
  reset();
  membersOn();
  Object.assign(process.env, { CONNECTORS: 'on', CONNECTOR_NOTION: 'on', HQ_LIVE: 'true', HQ_SECRET: 'x'.repeat(32), HQ_HARNESS: 'true', HQ_AGENT: 'on', BRAIN_DOCS: 'on', HQ_ACTIVITY: 'on', HQ_SKILLS: 'on', HQ_PROMPTS: 'on', HQ_OFFER_KEEP: 'on', STORE_V2: 'on', SITE_MOTION: 'on' });
  connectors.CLEARED.add('notion');
  for (const mcp of ['off', 'on']) {
    process.env.HQ_MCP_BRAIN = mcp;
    const p = offer.forPage();
    for (const w of words(p)) {
      assert.deepEqual(check(String(w), { file: 'offer.txt', paid: true }), [], w);
      assert.ok(!/\$\d/.test(w), `no price in "${w}": prices stay in lib/plans.js and the plan cards`);
      assert.ok(!/\b(?:hormozi|turnkey|10x|done[- ]for[- ]you|unlimited|replace your)\b/i.test(w), w);
    }
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'hq-offer.js'), 'utf8');
  assert.deepEqual(check(src, { file: 'lib/hq-offer.js', paid: true }).filter((f) => f.severity === 'block'), []);
  reset();
});

test('the pricing partials render the stack and the HQ plan cards, and keep the v1 cards while it is off', () => {
  reset();
  membersOn();
  const p = offer.forPage();
  const stack = renderStack(p);
  assert.ok(stack.includes(p.count));
  for (const r of p.stack) assert.ok(stack.includes(`data-row="${r.id}"`), r.id);
  assert.ok(stack.includes('The busywork, done. The decisions stay yours.'));
  assert.deepEqual(check(stack, { file: 'hq-stack.html', paid: true }), []);
  const on = renderCards(p);
  assert.ok(on.includes(`All ${p.n.workflows.toLocaleString('en-US')} workflows`));
  assert.ok(on.includes('Try HQ on your own business first.'));
  assert.ok(on.includes(`$${PLANS.builder.price}`) && on.includes(`$${PLANS.circle.price}`), 'prices unchanged');
  assert.ok(!on.includes('New resources every month'));
  const off = renderCards({ show: false, live: false });
  assert.ok(off.includes('New resources every month'));
  assert.ok(!off.includes('Try HQ on your own business'));
  ejs.compile(fs.readFileSync(path.join(VIEWS, 'pricing.ejs'), 'utf8'), { filename: path.join(VIEWS, 'pricing.ejs') });
  reset();
});
