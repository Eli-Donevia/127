// Tests for lib/ai.js (Eli's Playbook). No network: the Anthropic client is replaced by a
// fake that records each request, and one test runs the real SDK against a fake fetch to
// check the exact HTTP request. Run with: node --test test/ai.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AI_PATH = path.join(__dirname, '..', 'lib', 'ai.js');

// Fresh module per test, so env settings and the per-process feature switches start clean.
function load(env = {}) {
  for (const k of Object.keys(process.env)) if (/^(ANTHROPIC_|AI_)/.test(k)) delete process.env[k];
  Object.assign(process.env, env);
  delete require.cache[require.resolve(AI_PATH)];
  return require(AI_PATH);
}

function reply(text, extra = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: extra.model || 'claude-opus-5-5',
    content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text }],
    stop_reason: extra.stop_reason || 'end_turn',
    usage: extra.usage || { input_tokens: 900, output_tokens: 400, cache_read_input_tokens: 6000, cache_creation_input_tokens: 0 },
  };
}

// A fake client: records every call and answers from a queue (default: a plain reply).
function fakeClient(answers = []) {
  const calls = [];
  const answer = async (kind, params, opts) => {
    calls.push({ kind, params, opts });
    const next = answers.length ? answers.shift() : reply('Pick the idea with the most proof.\n\nNext: score your ideas tonight.');
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(params) : next;
  };
  return {
    calls,
    messages: { create: (p, o) => answer('messages', p, o) },
    beta: { messages: { create: (p, o) => answer('beta', p, o) } },
  };
}

function apiError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const roadmap = {
  track: 'start',
  trackName: 'Start',
  focus: 'Pick one idea and prove people will pay.',
  weeks: [
    { week: 1, theme: 'Pick one idea', freeVisible: true, tasks: [{ id: 'start-w1-a', title: 'Score your ideas in The Idea Test', resource: 'idea-filter', resourceTier: 'free', xp: 20 }] },
    { week: 2, theme: 'Talk to customers', freeVisible: true, tasks: [{ id: 'start-w2-a', title: 'Run 5 interviews', resource: 'validation-interviews', resourceTier: 'free', xp: 30 }, { id: 'start-w2-b', title: 'Price your offer', resource: 'pricing-worksheet', resourceTier: 'builder', xp: 30 }] },
    { week: 3, theme: 'Shape the offer', freeVisible: false, tasks: [{ id: 'start-w3-a', title: 'Write your one-page offer', resource: 'offer-builder', resourceTier: 'builder', xp: 30 }] },
  ],
};

function member(extra = {}) {
  return {
    id: 'u_test',
    name: 'Dani Rivera',
    tier: 'free',
    emailVerified: true,
    answers: { stage: 'validating', model: 'service', goal: 'validate', obstacles: ['time', 'offer'], time: '3to7', budget: 'lt100', channels: ['instagram'], ai_comfort: 'dabble', learning: ['templates'], outcome: 'Run a tutoring business that pays my rent', why: 'I want to stop waiting for permission', circle_interest: 'later' },
    roadmap,
    completed: { 'start-w1-a': true },
    milestones: { roadmap: true },
    worksheets: { 'idea-filter': { chosen_idea: 'Math tutoring for high schoolers in my town', __updated: '2026-10-15T10:00:00Z' } },
    ...extra,
  };
}

const KEY = { ANTHROPIC_API_KEY: 'sk-test' };

test('demo mode answers every mode without a key', async () => {
  const ai = load();
  const user = member();
  const c = await ai.chat([{ role: 'user', content: 'How do I pick one of my ideas?' }], user);
  assert.equal(c.demo, true);
  assert.match(c.text, /Next:/);
  for (const tool of ai.TOOLS.filter((t) => !t.chat)) {
    const input = Object.fromEntries(tool.fields.map((f) => [f.name, f.type === 'select' ? f.options[0] : 'test input']));
    const r = await ai.run(tool, input, user);
    assert.equal(r.demo, true, tool.slug);
    assert.match(r.text, /\nNext: /, `${tool.slug} demo ends with Next:`);
    assert.doesNotMatch(r.text, /—/, `${tool.slug} demo has no em dash`);
    assert.doesNotMatch(r.text, /Here's where an answer/, `${tool.slug} has its own demo`);
  }
  const resource = require('../content/resources.json').resources[0];
  const rv = await ai.review(resource, {}, user);
  assert.equal(rv.demo, true);
  assert.equal(await ai.roadmapNote(user), null);
});

test('tool specs are valid for the tool page', () => {
  const ai = load();
  const slugs = new Set();
  for (const t of ai.TOOLS) {
    assert.ok(!slugs.has(t.slug), `duplicate ${t.slug}`);
    slugs.add(t.slug);
    assert.ok(['free', 'builder'].includes(t.tier));
    assert.ok(t.name && t.blurb);
    if (t.chat) { assert.equal(t.starters.length, 4); continue; }
    assert.ok(t.instruction.length > 100, t.slug);
    assert.ok(t.fields.length >= 2, t.slug);
    assert.ok(!t.fields[0].optional, `${t.slug}: first field is the history label, keep it required`);
    for (const f of t.fields) {
      assert.match(f.name, /^[a-z]+$/);
      assert.ok(['text', 'textarea', 'select'].includes(f.type));
      if (f.type === 'select') assert.ok(f.options.length >= 2);
    }
  }
  assert.equal(ai.TOOLS.filter((t) => t.tier === 'free').length, 2);
});

test('the system prompt is the same for every member and caches', () => {
  const ai = load(KEY);
  const p = ai.systemPrompt();
  assert.ok(p.length > 2048 * 4 * 0.25, 'well above the 512-token cache minimum');
  // (The library's own fictional examples use first names, so check the test member's unique details.)
  assert.doesNotMatch(p, /u_test|pays my rent|First name:|\d{4}-\d{2}-\d{2}/, 'no member data or dates in the cached prefix');
  assert.doesNotMatch(p, /—/, 'no em dashes');
  assert.match(p, /The Idea Test \[Start · Worksheet · Free · calculator\]/);
  assert.match(p, /Interview Synthesizer \(Builder\)/);
  assert.match(p, /Psalm 127:1/);
  assert.match(p, /988/);
  // 127 is 18+ (Legal L1): the prompt never coaches minors as members.
  assert.match(p, /every member must be 18 or older/);
  assert.doesNotMatch(p, /Members under 18 can build|late teens/);
  // Legal L42: the under-18 marker is for the member's own age only, and the Playbook asks nothing about age.
  assert.match(p, /If the member says they themselves are under 18 right now, reply with only \[\[under18\]\] and nothing else/);
  assert.match(p, /It doesn't count for anyone else's age/);
  assert.match(p, /a hypothetical \("what if I were 16\?"\)/);
  assert.match(p, /Decide from the member's latest message only/);
  assert.match(p, /Never ask anyone their age or school year/);
  assert.match(p, /Never tell a member to quit their job or school, borrow money/);
  // Eli's facts: "gross sales" (Legal C2), the earnings line, no "multiple six-figure" (Legal rule 2).
  assert.match(p, /- \$50K in gross sales from a part-time e-commerce brand/);
  assert.match(p, /add right after it: "Eli's results aren't typical or a promise of what you'll earn\."/);
  assert.doesNotMatch(p, /multiple six-figure/);
  // Legal L45: the #3 ranking always says what it was #3 of.
  assert.match(p, /always say what it was #3 of: use the whole line or "#3 of 6,000\+ sales agents"/);
  assert.match(p, /- #3 in the country on a national vendor sales list of 6,000\+ agents \(2025\)/);
  const again = load(KEY).systemPrompt();
  assert.equal(p, again, 'deterministic across loads');
});

test('chat request: cached system, effort, fallbacks, cached last turn, context as a system message', async () => {
  const ai = load(KEY);
  const fake = fakeClient();
  ai._test.setClient(fake);
  const user = member();
  const history = [
    { role: 'user', content: 'I have 3 ideas, which one?' },
    { role: 'assistant', content: 'Score them in The Idea Test.' },
    { role: 'user', content: 'What should I charge for tutoring?' },
  ];
  const res = await ai.chat(history, user);
  assert.equal(res.error, undefined);
  assert.match(res.text, /Next:/);
  assert.equal(fake.calls.length, 1);
  const { kind, params, opts } = fake.calls[0];
  assert.equal(kind, 'beta');
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(params.fallbacks, 'default');
  assert.equal(params.model, 'claude-opus-5-5');
  assert.deepEqual(params.output_config, { effort: 'low' });
  assert.equal(params.thinking, undefined, 'thinking is always on for Opus 5.5; never send it');
  assert.equal(params.temperature, undefined);
  assert.deepEqual(params.system[0].cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.equal(params.max_tokens, 4000);
  assert.equal(opts.timeout, 60000);
  const msgs = params.messages;
  assert.equal(msgs.length, 4);
  assert.equal(msgs[2].role, 'user');
  assert.deepEqual(msgs[2].content[0].cache_control, { type: 'ephemeral' });
  assert.equal(msgs[2].content[0].text, 'What should I charge for tutoring?');
  const ctx = msgs[3];
  assert.equal(ctx.role, 'system');
  assert.match(ctx.content, /^Context for this reply, from 127/);
  assert.match(ctx.content, /Today is \w+day, \w+ \d+, \d{4}\./);
  assert.match(ctx.content, /- First name: Dani/);
  assert.match(ctx.content, /- Plan: Free/);
  assert.match(ctx.content, /- Stage: Validating/);
  assert.match(ctx.content, /- Time per week: 3 to 7 hours/);
  assert.match(ctx.content, /Current week 2: Talk to customers/);
  assert.match(ctx.content, /<playbook slug="pricing-worksheet" title="Pricing Worksheet">/);
  assert.equal(params.system.length, 1, 'chat keeps playbooks after the cached conversation');
  assert.match(ctx.content, /Their 12-month win: "Run a tutoring business that pays my rent"/);
  // Pricing Worksheet is on this Free member's roadmap in week 2, so they can open it.
  assert.match(ctx.content, /Attached playbooks\n- The member can open: Pricing Worksheet/);
  assert.ok(user.aiSpend && user.aiSpend.calls === 1 && user.aiSpend.usd > 0, 'spend recorded on the member');
});

test('a short follow-up keeps the topic of the message before it', async () => {
  const ai = load(KEY);
  const picks = ai._test.retrieve('what about for a service?', 'How should I price my tutoring?', member());
  assert.ok(picks.includes('pricing-worksheet'), picks.join(','));
  assert.deepEqual(ai._test.retrieve('thanks!', '', member()), []);
  const stuck = ai._test.retrieve("I'm stuck, what now?", '', member());
  assert.deepEqual(stuck, ['validation-interviews'], 'falls back to the next roadmap step');
  assert.ok(ai._test.retrieve('How do I find my first 10 customers with no audience?', '', member()).length >= 1);
  assert.deepEqual(load({ ...KEY, AI_EXCERPTS: '0' })._test.retrieve('How should I price this?', '', member()), []);
});

test('Builder-only playbooks are flagged for Free members', async () => {
  const ai = load(KEY);
  const fake = fakeClient();
  ai._test.setClient(fake);
  await ai.chat([{ role: 'user', content: 'Help me plan my Meta ads budget' }], member());
  const ctx = fake.calls[0].params.messages.at(-1).content;
  assert.match(ctx, /Part of Builder, and this member is on Free: Launch Budget Calculator\./);
  const fake2 = fakeClient();
  ai._test.setClient(fake2);
  await ai.chat([{ role: 'user', content: 'Help me plan my Meta ads budget' }], member({ tier: 'builder' }));
  assert.match(fake2.calls[0].params.messages.at(-1).content, /The member can open: Launch Budget Calculator/);
  assert.doesNotMatch(fake2.calls[0].params.messages.at(-1).content, /Part of Builder/);
});

test('per-tier model switch, and no fallbacks or effort where a model lacks them', async () => {
  const ai = load({ ...KEY, ANTHROPIC_MODEL_FREE: 'claude-haiku-5-5' });
  const fake = fakeClient();
  ai._test.setClient(fake);
  await ai.chat([{ role: 'user', content: 'hi' }], member());
  await ai.chat([{ role: 'user', content: 'hi' }], member({ tier: 'builder' }));
  assert.equal(fake.calls[0].kind, 'messages', 'Haiku 5.5 has no server-side fallback');
  assert.equal(fake.calls[0].params.model, 'claude-haiku-5-5');
  assert.equal(fake.calls[0].params.messages.at(-1).role, 'system');
  assert.equal(fake.calls[1].kind, 'beta');
  assert.equal(fake.calls[1].params.model, 'claude-opus-5-5');

  const old = load({ ...KEY, ANTHROPIC_MODEL: 'claude-sonnet-5' });
  const f2 = fakeClient();
  old._test.setClient(f2);
  await old.chat([{ role: 'user', content: 'How do I price this?' }], member());
  const msgs = f2.calls[0].params.messages;
  assert.equal(msgs.length, 1, 'Sonnet 5 takes no mid-conversation system message');
  assert.match(msgs[0].content, /^<playbook_context>\nContext for this reply/);
  assert.match(msgs[0].content, /<\/playbook_context>\n\nHow do I price this\?$/);
  assert.equal(f2.calls[0].kind, 'messages');
});

test('a rejected feature is switched off and the request retried once', async () => {
  const ai = load(KEY);
  const fake = fakeClient([apiError(400, 'fallbacks: unknown parameter'), reply('ok\n\nNext: go')]);
  ai._test.setClient(fake);
  const r1 = await ai.chat([{ role: 'user', content: 'hi' }], member());
  assert.equal(r1.text, 'ok\n\nNext: go');
  assert.equal(fake.calls.length, 2);
  assert.equal(fake.calls[1].kind, 'messages');
  assert.equal(ai._test.state.fallbacksOff, true);

  const f2 = fakeClient([apiError(400, "messages: role 'system' is not supported on this model"), reply('ok')]);
  ai._test.setClient(f2);
  await ai.chat([{ role: 'user', content: 'hi' }], member());
  assert.equal(f2.calls.length, 2);
  assert.equal(f2.calls[1].params.messages.length, 1);
  assert.match(f2.calls[1].params.messages[0].content, /^<playbook_context>/);

  const f3 = fakeClient([apiError(500, 'overloaded')]);
  ai._test.setClient(f3);
  const r3 = await ai.chat([{ role: 'user', content: 'hi' }], member());
  assert.equal(r3.error, true, 'other errors fail the turn so the route refunds the message');
  assert.equal(f3.calls.length, 1);
});

test('refusals, cut-off answers and empty answers', async () => {
  const ai = load(KEY);
  ai._test.setClient(fakeClient([reply('', { stop_reason: 'refusal' })]));
  const r = await ai.chat([{ role: 'user', content: 'x' }], member());
  assert.equal(r.error, undefined);
  assert.match(r.text, /can't help with that one/);
  ai._test.setClient(fakeClient([reply('Partial answer', { stop_reason: 'max_tokens' })]));
  assert.match((await ai.chat([{ role: 'user', content: 'x' }], member())).text, /Answer cut short/);
  ai._test.setClient(fakeClient([reply('   ')]));
  assert.equal((await ai.chat([{ role: 'user', content: 'x' }], member())).error, true);
});

test('replies are cleaned to plain text in the house style', () => {
  const { sanitize } = load()._test;
  assert.equal(sanitize('## Price\n**Charge $40** — not $20.\n* one\n* two'), 'Price\nCharge $40, not $20.\n- one\n- two');
  assert.equal(sanitize('See [the guide](https://example.com) for 3–5 days'), 'See the guide (https://example.com) for 3-5 days');
  assert.equal(sanitize('a\n\n\n\nb'), 'a\n\nb');
});

test('history window: steps, starts with the member, merges repeats, char budget', () => {
  const { historyWindow } = load()._test;
  const h = [];
  for (let i = 0; i < 20; i++) h.push({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` });
  h.push({ role: 'user', content: 'latest' });
  const w = historyWindow(h, false);
  assert.ok(w.length <= 16 && w.length >= 9, String(w.length));
  assert.equal(w[0].role, 'user');
  assert.equal(w.at(-1).content, 'latest');
  // The start only moves every 8 messages, so the cached prefix survives most turns.
  const w2 = historyWindow(h.concat({ role: 'assistant', content: 'a' }, { role: 'user', content: 'next' }), false);
  assert.equal(w2[0].content, w[0].content);
  assert.equal(historyWindow(h, true).length <= 6, true);
  const merged = historyWindow([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }], false);
  assert.deepEqual(merged, [{ role: 'user', content: 'a\n\nb' }]);
  const big = historyWindow([{ role: 'user', content: 'x'.repeat(4000) }, { role: 'assistant', content: 'y'.repeat(4000) }, ...Array(6).fill(0).flatMap(() => [{ role: 'user', content: 'x'.repeat(4000) }, { role: 'assistant', content: 'y'.repeat(4000) }]), { role: 'user', content: 'last' }], false);
  assert.ok(big.reduce((n, m) => n + m.content.length, 0) <= 24000);
  assert.equal(big[0].role, 'user');
});

test('tool run: field labels in the turn, task and grounding playbooks in the context', async () => {
  const ai = load(KEY);
  const fake = fakeClient();
  ai._test.setClient(fake);
  const tool = ai.TOOLS.find((t) => t.slug === 'interview-synthesizer');
  const notes = 'Jess: '.concat('a'.repeat(7000));
  await ai.run(tool, { notes, idea: '' }, member({ tier: 'builder' }));
  const { params, opts } = fake.calls[0];
  assert.equal(params.max_tokens, 8000);
  assert.equal(opts.timeout, 90000);
  assert.equal(params.messages[0].role, 'user');
  assert.match(params.messages[0].content, /^Interview Synthesizer\n\nYour interview notes: Jess: a+/);
  assert.ok(params.messages[0].content.length > 7000, 'long notes are kept up to the field max');
  assert.match(params.messages[0].content, /The idea you are testing \(optional\): \(not given\)/);
  assert.equal(params.messages[0].content.constructor, String, 'no cache marker on single-shot tools');
  const ctx = params.messages[1].content;
  // Tool playbooks are the same for every member who runs the tool: a second, 5-minute cached system block.
  assert.equal(params.system.length, 2);
  assert.match(params.system[1].text, /<playbook slug="validation-interviews" title="Validation Interview Scripts">/);
  assert.deepEqual(params.system[1].cache_control, { type: 'ephemeral' });
  assert.doesNotMatch(params.system[1].text, /Dani/, 'no member data in the cached block');
  assert.match(ctx, /The member can open: Validation Interview Scripts/);
  assert.match(ctx, /Your task: the member just ran the Interview Synthesizer tool/);
  assert.match(ctx, /The Mom Test/);
  assert.ok(ctx.indexOf('Your task') > ctx.indexOf('Attached playbooks'), 'task comes last');
  // Tools whose playbooks don't exist yet (new resources) still run.
  const outreach = ai.TOOLS.find((t) => t.slug === 'outreach-writer');
  await ai.run(outreach, { person: 'A gym owner', relationship: outreach.fields[1].options[2], goal: outreach.fields[2].options[0], offer: '' }, member({ tier: 'builder' }));
  assert.equal(fake.calls.length, 2);
});

test('worksheet review: rubric, playbook text and the member\'s answers', async () => {
  const ai = load(KEY);
  const fake = fakeClient();
  ai._test.setClient(fake);
  const { resources } = require('../content/resources.json');
  const r = resources.find((x) => x.slug === 'pricing-worksheet');
  const values = { roi_story: 'For $40 an hour, a parent gets a B in math', price: '$40/hour', __calc: JSON.stringify({ inputs: { value: '400', price: '40' }, summary: 'ROI: 10x' }) };
  await ai.review(r, values, member({ tier: 'builder' }));
  const { params } = fake.calls[0];
  assert.equal(params.max_tokens, 3000);
  assert.match(params.messages[0].content, /^Please review my Pricing Worksheet\./);
  assert.match(params.messages[0].content, /Your ROI story in one sentence: For \$40 an hour/);
  assert.match(params.messages[0].content, /Chosen pricing model: \(blank\)/);
  assert.match(params.messages[0].content, /Calculator result: ROI: 10x/);
  const ctx = params.messages[1].content;
  assert.match(ctx, /What a strong answer looks like: Check that the ROI story/);
  assert.match(params.system[1].text, /<playbook slug="pricing-worksheet" title="Pricing Worksheet">/);
  // The upgraded calculators write 450 to 800 character summaries; the verdict lines at the end must survive.
  const long = 'Price $40. Margin 85%. '.repeat(30) + 'Verdict: raise the price to $45.';
  await ai.review(r, { ...values, __calc: JSON.stringify({ inputs: { value: '400', price: '40' }, summary: long }) }, member({ tier: 'builder' }));
  assert.ok(fake.calls[1].params.messages[0].content.includes(long), 'a long calculator summary is sent whole');
});

test('Circle context: Build Target, North Number trend and last commitments, Circle only', async () => {
  const ai = load(KEY);
  const fp = {
    building: 'Video editing for local gyms',
    buildTarget: '10 paying gyms by Jan 15',
    northNumber: 'Paying customers',
    scorecard: [{ value: 0 }, { value: 1 }, { value: 2 }, { value: 2 }, { value: 4 }],
    commitments: [{ text: 'Send 20 DMs to gym owners', done: true }, { text: 'Book 3 calls', done: false }],
  };
  const block = ai._test.circleContext(member({ tier: 'circle', founderProfile: fp }));
  assert.match(block, /^Founder's Circle\n/);
  assert.match(block, /- Build Target for this Build Block: 10 paying gyms by Jan 15/);
  assert.match(block, /- North Number: Paying customers\. Last 4 weeks, oldest first: 1, 2, 2, 4/);
  assert.match(block, /Send 20 DMs to gym owners \(done\); Book 3 calls \(not done yet\)/);
  assert.equal(ai._test.circleContext(member({ tier: 'builder', founderProfile: fp })), '');
  assert.equal(ai._test.circleContext(member({ tier: 'circle' })), '');
  const fake = fakeClient();
  ai._test.setClient(fake);
  await ai.chat([{ role: 'user', content: 'What should I do today?' }], member({ tier: 'circle', founderProfile: { buildTarget: '10 paying gyms', commitments: 'Send 20 DMs\nBook 3 calls' } }));
  const ctx = fake.calls[0].params.messages.at(-1).content;
  assert.match(ctx, /Commitments from their last call: Send 20 DMs; Book 3 calls/);
});

test('template review: the aiPrompt is the rubric and the paired playbooks ground it', async () => {
  const ai = load(KEY);
  const fake = fakeClient();
  ai._test.setClient(fake);
  const template = { slug: 'idea-scorecard', title: 'Idea Scorecard', aiPrompt: 'Check that the winning idea names a specific customer.', pairsWith: ['idea-filter', 'not-a-playbook'] };
  await ai.reviewTemplate(template, 'Idea 1: lawn care for my street. Score 22.', member({ tier: 'builder' }));
  const { params } = fake.calls[0];
  assert.equal(params.max_tokens, 3000);
  assert.match(params.messages[0].content, /^Please review my Idea Scorecard\.\n\nIdea 1: lawn care for my street/);
  assert.match(params.system[1].text, /<playbook slug="idea-filter" title="The Idea Test">/);
  assert.doesNotMatch(params.system[1].text, /not-a-playbook/);
  const ctx = params.messages[1].content;
  assert.match(ctx, /What a strong answer looks like: Check that the winning idea names a specific customer\./);
  assert.match(ctx, /The member can open: The Idea Test/);
  const empty = await ai.reviewTemplate(template, '   ', member());
  assert.equal(empty.error, true);
  assert.equal(fake.calls.length, 1, 'nothing is sent for an empty paste');
  // The templates manifest lists pairsWith as { slug, title } objects.
  await ai.reviewTemplate({ ...template, pairsWith: [{ slug: 'pricing-worksheet', title: 'Pricing Worksheet' }] }, 'Price: $40 an hour', member({ tier: 'builder' }));
  assert.match(fake.calls[1].params.system[1].text, /<playbook slug="pricing-worksheet" title="Pricing Worksheet">/);
  const demo = await load({})['reviewTemplate'](template, 'x', member());
  assert.equal(demo.demo, true);
  assert.match(demo.text, /^Feedback: Idea Scorecard/);
});

test('roadmap note: plain sentences, or null on any problem', async () => {
  const ai = load(KEY);
  ai._test.setClient(fakeClient([reply('Dani, your goal is proof. Score your ideas today.')]));
  assert.equal(await ai.roadmapNote(member()), 'Dani, your goal is proof. Score your ideas today.');
  ai._test.setClient(fakeClient([apiError(500, 'down')]));
  assert.equal(await ai.roadmapNote(member()), null);
  assert.equal(await ai.roadmapNote({ ...member(), roadmap: null }), null);
});

test('cost estimate and compact mode for heavy members', async () => {
  const ai = load(KEY);
  const usd = ai._test.costOf('claude-opus-5-5', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
  assert.equal(usd, 4);
  const cached = ai._test.costOf('claude-opus-5-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1000000, cache_creation_input_tokens: 1000000, cache_creation: { ephemeral_1h_input_tokens: 1000000, ephemeral_5m_input_tokens: 0 } });
  assert.ok(Math.abs(cached - 8.2) < 1e-9);
  const heavy = member({ tier: 'builder', aiSpend: { month: new Date().toISOString().slice(0, 7), usd: 10.5, calls: 250 } });
  assert.equal(ai._test.compactFor(heavy), true);
  assert.equal(ai._test.compactFor(member({ tier: 'builder' })), false);
  const fake = fakeClient();
  ai._test.setClient(fake);
  await ai.chat([{ role: 'user', content: 'How should I price this and what ads should I run?' }], heavy);
  assert.equal(fake.calls[0].params.max_tokens, 2500);
  assert.equal((fake.calls[0].params.messages.at(-1).content.match(/<playbook slug=/g) || []).length, 1);
  assert.equal(load({ ...KEY, AI_FAIR_USE_BUILDER: '0' })._test.compactFor(heavy), false);
});

test('real SDK request shape (fake fetch): beta header, body and cache markers', async () => {
  const ai = load(KEY);
  const Anthropic = require('@anthropic-ai/sdk');
  let seen;
  const fetch = async (url, init) => {
    seen = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
    return new Response(JSON.stringify(reply('Real shape.\n\nNext: ship it.')), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  };
  ai._test.setClient(new Anthropic({ apiKey: 'sk-test', fetch, maxRetries: 0 }));
  const res = await ai.chat([{ role: 'user', content: 'What should I charge?' }], member());
  assert.equal(res.text, 'Real shape.\n\nNext: ship it.');
  assert.match(seen.url, /\/v1\/messages\?beta=true$/);
  assert.match(seen.headers.get('anthropic-beta'), /server-side-fallback-2026-07-01/);
  assert.equal(seen.body.betas, undefined, 'betas travel as a header, not in the body');
  assert.equal(seen.body.fallbacks, 'default');
  assert.equal(seen.body.model, 'claude-opus-5-5');
  assert.deepEqual(seen.body.output_config, { effort: 'low' });
  assert.deepEqual(seen.body.system[0].cache_control, { type: 'ephemeral', ttl: '1h' });
  assert.equal(seen.body.messages.at(-1).role, 'system');
  assert.deepEqual(seen.body.messages[0].content[0].cache_control, { type: 'ephemeral' });
});

test('under 18 (Legal L42): the marker becomes the fixed reply and flags the result in every mode', async () => {
  const ai = load(KEY);
  const ask = (content) => ai.chat([{ role: 'user', content }], member());
  ai._test.setClient(fakeClient([reply('[[under18]]')]));
  assert.deepEqual(await ask("I'm 16 and want to start a lawn mowing business. Where do I start?"), { demo: false, text: ai.UNDER18_REPLY, flags: ['under18'] });
  assert.match(ai.UNDER18_REPLY, /^127 is for people 18 and older/);
  assert.match(ai.UNDER18_REPLY, /hello@127group\.io/);
  // Whatever else the model writes never reaches the member: no follow-up questions about age, no coaching.
  ai._test.setClient(fakeClient([reply('[[ under18 ]]\nHow old are you exactly? Meanwhile, price lawns at $30.\n\nNext: ask 5 neighbors.')]));
  const extra = await ask('im 15 lol');
  assert.equal(extra.text, ai.UNDER18_REPLY);
  assert.deepEqual(extra.flags, ['under18']);
  // The crisis rule comes first: the crisis reply is kept (marker removed), and the result still flags.
  ai._test.setClient(fakeClient([reply("[[under18]]\nI'm really glad you told me. Please call or text 988 right now, or tell someone you trust.")]));
  const crisis = await ask("I'm 15 and I don't want to be here anymore.");
  assert.match(crisis.text, /call or text 988/);
  assert.doesNotMatch(crisis.text, /under18|\[\[/);
  assert.deepEqual(crisis.flags, ['under18']);
  // Tools, worksheet reviews and template reviews carry the flag the same way.
  ai._test.setClient(fakeClient([reply('[[under18]]'), reply('[[under18]]'), reply('[[under18]]')]));
  const tool = ai.TOOLS.find((t) => t.slug === 'hook-writer');
  const input = Object.fromEntries(tool.fields.map((f) => [f.name, f.type === 'select' ? f.options[0] : "I'm 16 and I sell custom phone cases"]));
  assert.deepEqual(await ai.run(tool, input, member({ tier: 'builder' })), { demo: false, text: ai.UNDER18_REPLY, flags: ['under18'] });
  const resource = require('../content/resources.json').resources[0];
  assert.deepEqual((await ai.review(resource, {}, member())).flags, ['under18']);
  const template = { slug: 'dm-scripts', title: 'DM Scripts', aiPrompt: 'Specific and honest.', pairsWith: [] };
  assert.deepEqual((await ai.reviewTemplate(template, "Hi, I'm 16 and I mow lawns.", member())).flags, ['under18']);
  // The roadmap note: null for the site's current call, or { text: null, flags } when it asks for flags.
  ai._test.setClient(fakeClient([reply('[[under18]]'), reply('[[under18]]')]));
  assert.equal(await ai.roadmapNote(member()), null);
  assert.deepEqual(await ai.roadmapNote(member(), { withFlags: true }), { text: null, flags: ['under18'] });
});

test('under 18: nothing flags without the marker, whatever ages the member mentions', async () => {
  const ai = load(KEY);
  // The code never decides on its own: other people's ages, hypotheticals, past ages and scripts
  // are the model's call (and the prompt says they don't count). Even a stated age flags only
  // through the model's marker. scripts/under18-check.js tests the model's side, live.
  const said = [
    'My little brother is 16 and wants to help me with the business. Can he?',
    'What if I were 16, would your advice be different?',
    "I started selling candy at school when I was 15. Now I'm 22 and want to start again.",
    'Write me a hook that starts with "I\'m 17 and I just made my first sale".',
    'My customers are high schoolers, mostly 15 to 17. How do I reach them?',
    "I'm 10 years into my career and want a side business.",
    "I'm 16 and want to start mowing lawns.",
  ];
  for (const content of said) {
    ai._test.setClient(fakeClient([reply('Start with five conversations this week.\n\nNext: list five people to ask.')]));
    const r = await ai.chat([{ role: 'user', content }], member());
    assert.equal(r.flags, undefined, content);
    assert.equal(r.text, 'Start with five conversations this week.\n\nNext: list five people to ask.');
  }
  // Tools don't flag without it either.
  ai._test.setClient(fakeClient([reply('10 hooks.\n\nNext: film one.')]));
  const tool = ai.TOOLS.find((t) => t.slug === 'hook-writer');
  const input = Object.fromEntries(tool.fields.map((f) => [f.name, f.type === 'select' ? f.options[0] : "\"I'm 17 and I made my first sale\" for my students"]));
  assert.equal((await ai.run(tool, input, member({ tier: 'builder' }))).flags, undefined);
  // The roadmap note without the marker: the same string as before, or { text } when asked.
  ai._test.setClient(fakeClient([reply('Dani, score your ideas today.'), reply('Dani, score your ideas today.')]));
  assert.equal(await ai.roadmapNote(member()), 'Dani, score your ideas today.');
  assert.deepEqual(await ai.roadmapNote(member(), { withFlags: true }), { text: 'Dani, score your ideas today.' });
  // Demo answers (no key) never flag. (load() clears the key, so this goes last.)
  const demo = await load().chat([{ role: 'user', content: "I'm 16 and want to start mowing lawns." }], member());
  assert.equal(demo.demo, true);
  assert.equal(demo.flags, undefined);
});
