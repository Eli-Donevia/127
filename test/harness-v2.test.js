// The 127 harness v2 (lib/harness, plan: v2/harness): the pack contract, the workflow engine
// (each, approvals with picks and edits, waits, retries, stops), credits and the free run, the model
// router and the AI layer, fetch guard rails, the stores, and the playbooks pack. No network: the AI
// is a fake client and fetch is a fake.

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.DB_FILE = path.join(__dirname, '..', 'data', `test-db-harness-v2-${process.pid}.json`);
process.env.BLOB_DIR = path.join(os.tmpdir(), `127-blobs-${process.pid}`);
process.env.HARNESS_STRICT = 'on';
for (const k of ['ANTHROPIC_API_KEY', 'HARNESS_V2', 'HARNESS_PAUSE', 'HARNESS_AI', 'HARNESS_CREDITS_FREE', 'HARNESS_MAX_DAY_USD', 'HARNESS_MAX_RUN_USD', 'HARNESS_FREE_RUN']) delete process.env[k];

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../lib/db');
const harness = require('../lib/harness');
const { engine, packs, router, ledger, inbox, pipeline, library, models } = harness;
const schema = require('../lib/harness/schema');
const refs = require('../lib/harness/refs');
const llm = require('../lib/harness/llm');
const ctxLib = require('../lib/harness/ctx');
const anthropic = require('../lib/harness/providers/anthropic');
const { makeCtx, runTool } = require('../lib/harness/testing');
const ai = require('../lib/ai');

const T0 = Date.parse('2026-11-02T15:00:00Z');
let now = T0;
const sent = [];
const flags = { failSecond: false, failAll: false };
let slowStarted = null;

const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const THING = obj({ name: { type: 'string' }, n: { type: 'integer' } });

const TP = {
  id: 'tp',
  title: 'Test pack',
  version: '1.0.0',
  summary: 'Things for tests.',
  niches: ['testing', 'things'],
  tools: [
    {
      name: 'tp.list_things',
      title: 'List things',
      description: 'Lists n things.',
      kind: 'code',
      risk: 'read',
      credits: 1,
      input: obj({ n: { type: 'integer' } }),
      output: obj({ things: { type: 'array', items: THING } }),
      run: async ({ n }) => ({ things: Array.from({ length: n }, (_, i) => ({ name: `Thing ${i + 1}`, n: i })) }),
      view: (o) => [{ type: 'table', columns: [{ key: 'name', label: 'Name' }], rows: o.things }],
    },
    {
      name: 'tp.score',
      title: 'Score a thing',
      description: 'Scores one thing.',
      kind: 'code',
      risk: 'read',
      credits: 1,
      input: obj({ thing: THING }),
      output: obj({ name: { type: 'string' }, score: { type: 'number' } }),
      run: async ({ thing }) => {
        if (flags.failAll || (flags.failSecond && thing.n === 1)) throw new Error(`Couldn't score ${thing.name}.`);
        return { name: thing.name, score: 10 - thing.n };
      },
      view: (o) => [{ type: 'metric', label: o.name, value: o.score }],
    },
    {
      name: 'tp.write',
      title: 'Write a note',
      description: 'Writes a note to a thing.',
      kind: 'ai',
      risk: 'draft',
      credits: 2,
      tasks: ['write'],
      input: obj({ thing: THING }),
      output: obj({ name: { type: 'string' }, text: { type: 'string' } }),
      run: async ({ thing }, ctx) => {
        const r = await ctx.ai({ task: 'write', prompt: `Write a short note to ${thing.name}.`, schema: obj({ text: { type: 'string' } }) });
        return { name: thing.name, text: r.data.text };
      },
      view: (o) => [{ type: 'copy', label: o.name, text: o.text }],
    },
    {
      name: 'tp.send',
      title: 'Send a note',
      description: 'Sends one approved note.',
      kind: 'code',
      risk: 'act',
      credits: 0,
      input: obj({ draft: obj({ name: { type: 'string' }, text: { type: 'string' } }) }),
      output: obj({ sent: { type: 'boolean' } }),
      run: async ({ draft }) => {
        sent.push(draft);
        return { sent: true };
      },
    },
    {
      name: 'tp.follow',
      title: 'Plan follow-ups',
      description: 'Counts what to follow up on.',
      kind: 'code',
      risk: 'draft',
      credits: 1,
      input: obj({ drafts: { type: 'array', items: { type: 'object' } } }),
      output: obj({ count: { type: 'integer' } }),
      run: async ({ drafts }) => ({ count: drafts.length }),
    },
    {
      name: 'tp.slow',
      title: 'Slow step',
      description: 'Waits until stopped.',
      kind: 'code',
      risk: 'read',
      credits: 0,
      input: obj({}),
      output: obj({ ok: { type: 'boolean' } }),
      run: (_, ctx) =>
        new Promise((resolve, reject) => {
          if (slowStarted) slowStarted();
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    },
    {
      name: 'tp.keep',
      title: 'Keep a report',
      description: 'Saves a CSV and adds a lead.',
      kind: 'code',
      risk: 'draft',
      credits: 1,
      input: obj({}),
      output: obj({ file: { type: 'object' }, lead: { type: 'object' } }),
      run: async (_, ctx) => {
        const file = await ctx.save('report.csv', 'name,score\nAcme,9\n', { type: 'text/csv' });
        const lead = await ctx.leads.upsert({ key: 'acme', name: 'Acme Gym', stage: 'found', links: { website: 'https://acme.test', maps: 'javascript:alert(1)' } });
        ctx.log('Saved the **report**.');
        return { file, lead };
      },
      view: (o) => [{ type: 'file', asset: o.file, caption: 'Your report' }],
    },
    {
      name: 'tp.flagged',
      title: 'Flagged answer',
      description: 'Returns an answer with a flag.',
      kind: 'code',
      risk: 'draft',
      credits: 0,
      input: obj({}),
      output: obj({ text: { type: 'string' }, flags: { type: 'array', items: { type: 'string' } } }),
      run: async () => ({ text: 'flagged', flags: ['under18'] }),
    },
  ],
  workflows: [
    {
      id: 'tp.full',
      title: 'Do everything with things',
      promise: 'Lists, scores and writes to things, then follows up.',
      minutes: 5,
      tier: 'free',
      inputs: { type: 'object', properties: { n: { type: 'integer', title: 'How many', default: 3, minimum: 1, maximum: 20 } } },
      steps: [
        { id: 'list', tool: 'tp.list_things', input: { n: '$inputs.n' } },
        { id: 'scores', tool: 'tp.score', each: '$list.things', input: { thing: '$item' }, concurrency: 2 },
        { id: 'pick', approve: { title: 'Pick up to 2 things', choose: '$list.things', label: 'name', max: 2 } },
        { id: 'drafts', tool: 'tp.write', each: '$pick.chosen', input: { thing: '$item' } },
        { id: 'check', approve: { title: 'Read your notes', items: '$drafts', edit: 'text' } },
        { id: 'send', tool: 'tp.send', each: '$check.items', input: { draft: '$item' }, approvedBy: 'check' },
        { id: 'later', wait: { days: 1 } },
        { id: 'follow', tool: 'tp.follow', input: { drafts: '$check.items' } },
      ],
      result: ['scores', 'follow'],
      next: ['tp.keep', 'tp.missing'],
    },
    { id: 'tp.keep', title: 'Keep a report about things', promise: 'A CSV in your Library.', minutes: 1, tier: 'free', inputs: obj({}, []), steps: [{ id: 'keep', tool: 'tp.keep' }], result: ['keep'] },
    { id: 'tp.paid', title: 'Builder things', promise: 'Builder only.', minutes: 1, tier: 'builder', inputs: obj({}, []), steps: [{ id: 'list', tool: 'tp.list_things', input: { n: 2 } }] },
    { id: 'tp.circle', title: 'Circle things', promise: 'Circle only.', minutes: 1, tier: 'circle', inputs: obj({}, []), steps: [{ id: 'list', tool: 'tp.list_things', input: { n: 2 } }] },
    { id: 'tp.slow', title: 'Slow things', promise: 'Takes forever.', minutes: 1, tier: 'free', inputs: obj({}, []), steps: [{ id: 'slow', tool: 'tp.slow' }] },
    {
      id: 'tp.maybe',
      title: 'Maybe pick things',
      promise: 'An optional pick.',
      minutes: 1,
      tier: 'free',
      inputs: obj({}, []),
      steps: [
        { id: 'list', tool: 'tp.list_things', input: { n: 2 } },
        { id: 'pick', approve: { title: 'Pick if you like', choose: '$list.things' }, optional: true },
        { id: 'follow', tool: 'tp.follow', input: { drafts: '$pick.chosen' }, when: '$pick.approved' },
        { id: 'count', tool: 'tp.follow', input: { drafts: '$list.things' } },
      ],
      result: ['count'],
    },
    { id: 'tp.flag', title: 'Flag things', promise: 'Raises a flag.', minutes: 1, tier: 'free', inputs: obj({}, []), steps: [{ id: 'answer', tool: 'tp.flagged' }, { id: 'list', tool: 'tp.list_things', input: { n: 1 } }] },
  ],
};

let seq = 0;
async function member(tier = 'free', extra = {}) {
  seq += 1;
  return db.save('users', { id: `u${seq}-${tier}`, email: `m${seq}@127.test`, name: `Sam Rivera${seq}`, tier, emailVerified: true, answers: { model: 'service' }, ...extra });
}

function reply(p, text, extra = {}) {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn', model: p.model, usage: { input_tokens: 1200, output_tokens: 300 }, ...extra };
}
// A stand-in for the Anthropic client. handler(params) returns the API response.
function fakeClient(handler) {
  const calls = [];
  const create = async (p) => {
    calls.push(p);
    return handler(p, calls.length);
  };
  return { calls, messages: { create }, beta: { messages: { create } } };
}
const jsonReply = (p) => reply(p, JSON.stringify(schema.example(p.output_config.format.schema)));

test.before(async () => {
  await db.init();
  engine._setDeps({ now: () => now });
  packs.reset();
  const r = packs.register(TP);
  assert.deepEqual(r.refused, [], JSON.stringify(r.refused));
  packs.loadDir(path.join(__dirname, '..', 'lib', 'packs'));
});
test.beforeEach(() => {
  now = T0;
  sent.length = 0;
  flags.failSecond = false;
  flags.failAll = false;
  anthropic._setClient(null);
  delete process.env.HARNESS_PAUSE;
  ctxLib._day.usd = 0;
});
process.on('exit', () => {
  fs.rmSync(process.env.DB_FILE, { force: true });
  fs.rmSync(process.env.DB_FILE + '.tmp', { force: true });
  fs.rmSync(process.env.BLOB_DIR, { recursive: true, force: true });
});

// ---------- the contract ----------

test('the contract refuses a broken pack and says why', () => {
  const bad = {
    id: 'bad',
    title: 'Bad',
    version: '1',
    tools: [
      { ...TP.tools[0], name: 'bad.list' },
      { ...TP.tools[3], name: 'bad.send' },
      { name: 'Bad.Thing', title: 'x', description: 'x', kind: 'magic', risk: 'read', credits: 1.5, needs: ['telepathy'], input: obj({}), output: obj({}), run: () => ({}) },
    ],
    workflows: [
      {
        id: 'bad.flow',
        title: 'Bad flow',
        promise: 'Breaks rules.',
        minutes: 1,
        tier: 'free',
        inputs: obj({}, []),
        steps: [
          { id: 'one', tool: 'bad.list', input: { n: '$two.count' } },
          { id: 'two', tool: 'bad.list', input: { n: '$item' } },
          { id: 'send', tool: 'bad.send', each: '$one.things', input: { draft: '$item' } },
          { id: 'inputs', wait: { days: 90 } },
        ],
        result: ['nope'],
      },
    ],
  };
  const problems = packs.checkPack(bad, (n) => bad.tools.find((t) => t.name === n));
  const all = problems.join('\n');
  for (const want of [/verb_noun/, /kind must be/, /unknown need "telepathy"/, /credits must be a whole number/, /\$two\.count points at a step that doesn't come before it/, /\$item only works inside an each step/, /act tool must name an earlier approve step/, /reserved word/, /result names unknown step nope/]) {
    assert.match(all, want);
  }
  const r = packs.register(bad);
  assert.deepEqual(r.loaded, []);
  assert.equal(packs.pack('bad'), null);
});

test('the playbooks pack loads every AI tool as a workflow', () => {
  const list = ai.TOOLS.filter((t) => !t.chat);
  assert.equal(packs.pack('playbooks').tools.length, list.length);
  const wf = packs.workflow('playbooks.offer_validator');
  assert.equal(wf.tier, 'free');
  assert.deepEqual(wf.inputs.required, ['offer', 'audience']);
  assert.equal(packs.workflow('playbooks.outreach_writer').inputs.properties.relationship.enum.length, 4);
  assert.equal(packs.workflow('playbooks.hook_writer').tier, 'builder');
});

// ---------- the engine ----------

test('a run lists, scores, waits for a pick, writes, waits for edits, acts, sleeps and finishes', async () => {
  const user = await member('builder');
  let run = await engine.start(user, 'tp.full', { n: '3' });
  assert.equal(run.inputs.n, 3);
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'waiting');
  assert.equal(run.steps.scores.output.length, 3);
  assert.equal(run.steps.scores.output[2].score, 8);
  const v = engine.view(run);
  assert.equal(v.waitingOn.id, 'pick');
  assert.deepEqual(v.waitingOn.ask.options.map((o) => o.label), ['Thing 1', 'Thing 2', 'Thing 3']);
  assert.equal(v.waitingOn.ask.max, 2);
  assert.equal(inbox.count(user.id), 1);

  await assert.rejects(engine.answer(user, run.id, 'pick', { chosen: ['0', '1', '2'] }), /Pick up to 2/);
  await assert.rejects(engine.answer(user, run.id, 'pick', { chosen: [] }), /Pick at least one/);
  await assert.rejects(engine.answer(user, run.id, 'check', { approved: true }), /already answered/);
  await engine.answer(user, run.id, 'pick', { chosen: ['0', '2'] });
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'waiting');
  assert.deepEqual(run.steps.drafts.output.map((d) => d.name), ['Thing 1', 'Thing 3']);
  assert.ok(run.steps.drafts.sample, 'no AI key: drafts are marked sample');
  const ask = engine.view(run).waitingOn.ask;
  assert.equal(ask.items.length, 2);
  assert.equal(ask.edit, 'text');

  await engine.answer(user, run.id, 'check', { approved: true, items: { 1: 'Hi Thing 3, I fixed this myself.' } });
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'sleeping');
  assert.deepEqual(sent.map((d) => d.text), [run.steps.drafts.output[0].text, 'Hi Thing 3, I fixed this myself.']);
  assert.equal(inbox.count(user.id), 0);

  await engine.tick();
  await engine.idle();
  assert.equal(engine.get(user, run.id).status, 'sleeping', 'too early to wake');
  now = T0 + 864e5 + 1000;
  await engine.tick();
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'done');
  assert.equal(run.steps.follow.output.count, 2);
  // 1 list + 3 scores + 0 for the 2 drafts (sample answers cost nothing) + 0 sends + 1 follow-up
  assert.equal(run.credits.used, 5);
  assert.equal(ledger.usage(user).used, 5);
  const done = engine.view(run);
  assert.ok(done.result.some((b) => b.type === 'metric' && b.label === 'Thing 1'));
  assert.deepEqual(done.next, ['tp.keep'], 'next drops workflows that do not exist');
  assert.match(done.timeline.map((t) => t.text).join('\n'), /You picked 2\./);
});

test('one failed item keeps the step; every item failing stops the run, and retry redoes only what failed', async () => {
  const user = await member('builder');
  flags.failSecond = true;
  let run = await engine.start(user, 'tp.full', { n: 3 });
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'waiting');
  assert.match(run.steps.scores.output[1].error, /Couldn't score Thing 2/);
  assert.ok(engine.view(run).steps.find((s) => s.id === 'scores').blocks.some((b) => b.type === 'text' && /1 of 3 didn't work/.test(b.text)));
  await engine.cancel(user, run.id);

  flags.failSecond = false;
  flags.failAll = true;
  run = await engine.start(user, 'tp.full', { n: 2 });
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'failed');
  assert.match(run.error, /Couldn't score/);
  await assert.rejects(engine.retry(user, 'nope'), /doesn't exist/);
  flags.failAll = false;
  await engine.retry(user, run.id);
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'waiting');
  assert.equal(run.steps.scores.output.length, 2);
});

test('skipping an approval stops the run; an optional one goes on and skips what depends on it', async () => {
  const user = await member('builder');
  let run = await engine.start(user, 'tp.full', { n: 2 });
  await engine.idle();
  await engine.answer(user, run.id, 'pick', { approved: false });
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'stopped');
  assert.equal(inbox.count(user.id), 0);

  run = await engine.start(user, 'tp.maybe', {});
  await engine.idle();
  await engine.answer(user, run.id, 'pick', { approved: false });
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'done');
  assert.equal(run.steps.follow.status, 'skipped');
  assert.equal(run.steps.count.output.count, 2);
});

test('stop ends a running tool', async () => {
  const user = await member('builder');
  const started = new Promise((resolve) => (slowStarted = resolve));
  const run = await engine.start(user, 'tp.slow', {});
  await started;
  await engine.cancel(user, run.id);
  await engine.idle();
  assert.equal(engine.get(user, run.id).status, 'stopped');
  slowStarted = null;
});

test('tiers, the free run, credits and the active-run limit', async () => {
  const free = await member('free');
  await assert.rejects(engine.start(free, 'tp.circle', {}), /Founder's Circle/);
  assert.equal(ledger.freeRunAvailable(free), true);
  const run = await engine.start(free, 'tp.paid', {});
  assert.equal(run.freeRun, true);
  await engine.idle();
  assert.equal(engine.get(free, run.id).status, 'done');
  assert.equal(ledger.usage(free).used, 0, 'the free run takes no credits');
  await assert.rejects(engine.start(free, 'tp.paid', {}), /part of Builder/);

  process.env.HARNESS_CREDITS_FREE = '5';
  await assert.rejects(engine.start(free, 'tp.full', { n: 3 }), (err) => err.status === 402 && /about 16 credits/.test(err.message));
  delete process.env.HARNESS_CREDITS_FREE;

  const busy = await member('builder');
  process.env.HARNESS_PAUSE = 'on';
  for (let i = 0; i < 3; i++) await engine.start(busy, 'tp.keep', {});
  await assert.rejects(engine.start(busy, 'tp.keep', {}), (err) => err.status === 429);
  delete process.env.HARNESS_PAUSE;
  await engine.tick();
  await engine.idle();
  assert.equal(engine.list(busy).filter((r) => r.status === 'done').length, 3);
});

test('bad form input is refused with a readable message', async () => {
  const user = await member('builder');
  await assert.rejects(engine.start(user, 'tp.full', { n: 'lots' }), (err) => err.status === 400);
  await assert.rejects(engine.start(user, 'tp.nope', {}), (err) => err.status === 404);
});

test('a tool saves to the Library, adds to the Pipeline and logs in plain text', async () => {
  const user = await member('builder');
  let run = await engine.start(user, 'tp.keep', {});
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.status, 'done');
  const file = run.steps.keep.output.file;
  assert.match(file.url, /^\/app\/hq\/files\/[\w-]+$/);
  const got = await library.read(user.id, file.id);
  assert.equal(got.buf.toString(), 'name,score\nAcme,9\n');
  assert.equal(await library.read('someone-else', file.id), null);
  assert.equal(engine.view(run).result[0].type, 'file');
  const leads = pipeline.list(user.id);
  assert.equal(leads.length, 1);
  assert.deepEqual(leads[0].links, { website: 'https://acme.test' });
  assert.match(run.timeline.map((t) => t.text).join('\n'), /Saved the report\./);
});

test('the guard blocks runs and a flagged answer reaches the flag hook', async () => {
  const user = await member('builder');
  const flagged = [];
  let blocked = null;
  engine._setDeps({ guard: (u) => (u.id === blocked ? 'Your account is paused.' : null), flag: async (u, run, stepId, out) => flagged.push({ u: u.id, stepId, flags: out.flags }) });
  try {
    const run = await engine.start(user, 'tp.flag', {});
    await engine.idle();
    assert.deepEqual(flagged, [{ u: user.id, stepId: 'answer', flags: ['under18'] }]);
    assert.equal(engine.get(user, run.id).status, 'done');
    blocked = user.id;
    await assert.rejects(engine.start(user, 'tp.flag', {}), (err) => err.status === 403 && /paused/.test(err.message));
  } finally {
    engine._setDeps({ guard: () => null, flag: async () => {} });
  }
});

test('estimate counts each steps from the inputs and approvals', () => {
  assert.equal(engine.estimate(packs.workflow('tp.full'), {}), 16);
  assert.equal(engine.estimate(packs.workflow('tp.keep'), {}), 1);
});

// ---------- the AI layer and the router ----------

test('the router picks by task, tier and spend, and env overrides it', () => {
  assert.equal(router.route({ task: 'classify', tier: 'free' }).model, 'claude-haiku-5-5');
  assert.equal(router.route({ task: 'write', tier: 'builder' }).model, 'claude-opus-5-5');
  const deep = router.route({ task: 'deep', tier: 'builder' });
  assert.equal(deep.model, 'claude-opus-5-5');
  assert.equal(deep.effort, 'medium');
  assert.equal(router.route({ task: 'deep', tier: 'circle' }).model, 'claude-fable-5-1');
  assert.equal(router.route({ task: 'write', tier: 'builder', spentUsd: 50 }).model, 'claude-sonnet-5-5');
  process.env.HARNESS_MODEL_CLASSIFY = 'claude-sonnet-5-5';
  try {
    assert.equal(router.route({ task: 'classify' }).model, 'claude-sonnet-5-5');
  } finally {
    delete process.env.HARNESS_MODEL_CLASSIFY;
  }
  assert.equal(router.escalate(router.route({ task: 'extract' }), 'builder').model, 'claude-sonnet-5-5');
  assert.equal(models.costOf('claude-haiku-5-5', { input_tokens: 1e5, output_tokens: 1e5 }), 0.06);
  assert.ok(models.costOf('claude-haiku-5-5', { input_tokens: 2e5, output_tokens: 1e5 }) > 0.3, 'long prompts cost more on Haiku');
});

test('with no AI key, ctx.ai answers with sample data that fits the schema', async () => {
  const s = obj({ names: { type: 'array', items: { type: 'string' } }, count: { type: 'integer' } });
  const r = await llm.call({ task: 'extract', prompt: 'Find names.', schema: s });
  assert.equal(r.sample, true);
  assert.ok(schema.validate(s, r.data).ok);
  const t = await llm.call({ task: 'write', prompt: 'Write a hello.' });
  assert.equal(t.sample, true);
});

test('a schema answer that does not fit is retried once on the next model up, and costs are reported', async () => {
  const fake = fakeClient((p, n) => (n === 1 ? reply(p, JSON.stringify({ names: 'not a list' })) : jsonReply(p)));
  anthropic._setClient(fake);
  const costs = [];
  const s = obj({ names: { type: 'array', items: { type: 'string' } } });
  const r = await llm.call({ task: 'extract', tier: 'builder', prompt: 'Find names.', schema: s, onCost: async (m) => costs.push(m) });
  assert.ok(Array.isArray(r.data.names));
  assert.deepEqual(fake.calls.map((c) => c.model), ['claude-haiku-5-5', 'claude-sonnet-5-5']);
  assert.equal(fake.calls[0].betas, undefined, 'Haiku has no server-side fallbacks');
  assert.deepEqual(fake.calls[1].betas, [anthropic.FALLBACK_BETA]);
  assert.equal(fake.calls[0].output_config.format.schema.additionalProperties, false);
  assert.equal(fake.calls[0].thinking, undefined);
  assert.equal(costs.length, 2);
  assert.ok(costs[0].usd > 0 && costs[1].usd > costs[0].usd);
});

test('write calls get the house rules first (cached) and the member business after', async () => {
  const fake = fakeClient((p) => reply(p, '## Hi there\n**Bold** move — really.'));
  anthropic._setClient(fake);
  const r = await llm.call({ task: 'write', tier: 'builder', system: 'Tool rules. '.repeat(400), prompt: 'Write.', brain: { business: { name: 'Sam Edits', city: 'Des Moines' } } });
  assert.equal(r.text, 'Hi there\nBold move, really.');
  const sys = fake.calls[0].system;
  assert.equal(sys.length, 2);
  assert.match(sys[0].text, /^You're working inside 127/);
  assert.deepEqual(sys[0].cache_control, { type: 'ephemeral' });
  assert.match(sys[1].text, /Sam Edits/);
  assert.equal(sys[1].cache_control, undefined);
});

test('a refusal and an API error read as plain messages', async () => {
  anthropic._setClient(fakeClient((p) => reply(p, '', { stop_reason: 'refusal' })));
  await assert.rejects(llm.call({ task: 'write', prompt: 'x' }), /wouldn't do this one/);
  anthropic._setClient(
    fakeClient(() => {
      const e = new Error('overloaded');
      e.status = 529;
      throw e;
    })
  );
  await assert.rejects(llm.call({ task: 'write', prompt: 'x' }), /busy right now/);
});

test('an AI step in a run records the model and the cost', async () => {
  anthropic._setClient(fakeClient(jsonReply));
  const user = await member('builder');
  let run = await engine.start(user, 'tp.full', { n: 1 });
  await engine.idle();
  await engine.answer(user, run.id, 'pick', { chosen: ['0'] });
  await engine.idle();
  run = engine.get(user, run.id);
  assert.equal(run.steps.drafts.sample, false);
  assert.equal(run.credits.used, 4, '1 list + 1 score + a real draft at 2');
  assert.deepEqual(run.steps.drafts.models, { 'Opus 5.5': 1 });
  assert.ok(run.usd > 0);
  assert.ok(ledger.usage(user).usd > 0);
  await engine.cancel(user, run.id);
});

// ---------- guard rails ----------

test('fetch only reaches the public web, on every redirect', async () => {
  assert.equal(ctxLib.privateIp('10.1.2.3'), true);
  assert.equal(ctxLib.privateIp('172.20.0.1'), true);
  assert.equal(ctxLib.privateIp('100.64.0.1'), true);
  assert.equal(ctxLib.privateIp('169.254.169.254'), true);
  assert.equal(ctxLib.privateIp('::ffff:127.0.0.1'), true);
  assert.equal(ctxLib.privateIp('fd00::1'), true);
  assert.equal(ctxLib.privateIp('93.184.216.34'), false);
  const hits = [];
  ctxLib._setDeps({
    lookup: async (host) => [{ address: host === 'inside.test' ? '10.0.0.5' : '93.184.216.34' }],
    fetch: async (url) => {
      hits.push(url);
      if (url.includes('/hop')) return new Response(null, { status: 302, headers: { location: 'http://inside.test/admin' } });
      return new Response('ok', { status: 200 });
    },
  });
  try {
    const f = ctxLib.makeFetch({ memberId: 'm1', run: { fetches: 0 } });
    assert.equal(await (await f('https://outside.test/page')).text(), 'ok');
    await assert.rejects(f('http://inside.test/'), /public web/);
    await assert.rejects(f('http://localhost:3000/'), /public web/);
    await assert.rejects(f('http://127.0.0.1/'), /public web/);
    await assert.rejects(f('file:///etc/passwd'), /Only http and https/);
    await assert.rejects(f('https://outside.test/hop'), /public web/);
    assert.ok(!hits.some((u) => u.includes('inside.test')));
  } finally {
    ctxLib._setDeps({ lookup: (host) => require('dns').promises.lookup(host, { all: true }), fetch: (...a) => fetch(...a) });
  }
});

test('spending stops at the daily limit', () => {
  process.env.HARNESS_MAX_DAY_USD = '1';
  try {
    ctxLib.addDay(0.5);
    ctxLib.checkBudget({ usd: 0 });
    ctxLib.addDay(0.6);
    assert.throws(() => ctxLib.checkBudget({ usd: 0 }), /today's limit/);
    process.env.HARNESS_MAX_DAY_USD = '100';
    assert.throws(() => ctxLib.checkBudget({ usd: 3.5 }), /cost limit/);
  } finally {
    delete process.env.HARNESS_MAX_DAY_USD;
    ctxLib._day.usd = 0;
  }
});

// ---------- schema, refs and stores ----------

test('schema: form strings are coerced, defaults filled, and the API copy is strict', () => {
  const s = obj({ n: { type: 'integer', minimum: 1, maximum: 5, default: 2 }, ok: { type: 'boolean' }, tags: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, ['ok']);
  const v = schema.validate(s, { ok: 'yes', tags: 'a, b' }, { coerce: true });
  assert.equal(v.ok, true, v.text);
  assert.deepEqual(v.value, { n: 2, ok: true, tags: ['a', 'b'] });
  assert.equal(schema.validate(s, { ok: true, n: 9 }).ok, false);
  const api = schema.forApi(s);
  assert.equal(api.additionalProperties, false);
  assert.equal(api.properties.n.minimum, undefined);
  assert.equal(api.properties.tags.maxItems, undefined);
});

test('refs resolve inputs, steps, items and indexes', () => {
  const scope = { inputs: { city: 'Ames' }, steps: { gyms: { list: [{ name: 'A' }, { name: 'B' }] }, vids: ['v0', 'v1'] }, item: { name: 'B' }, index: 1 };
  assert.deepEqual(refs.resolve({ c: '$inputs.city', first: '$gyms.list.0.name', me: '$item.name', v: '$vids.$index', cash: '$$5' }, scope), { c: 'Ames', first: 'A', me: 'B', v: 'v1', cash: '$5' });
});

test('the pipeline never moves a lead backwards', async () => {
  const user = await member('builder');
  await pipeline.upsert(user.id, 'tp', { key: 'k1', name: 'Gym One', stage: 'contacted' });
  const back = await pipeline.upsert(user.id, 'tp', { key: 'k1', stage: 'found', note: 'Again.' });
  assert.equal(back.stage, 'contacted');
  assert.equal(back.note, 'Again.');
  assert.equal(back.memberId, undefined);
  assert.equal(pipeline.counts(user.id).contacted, 1);
});

test('Google names (Legal L53): fetched only with the key, a few a page, counted against the day cap, and stopped by it', async () => {
  const places = require('../lib/harness/places');
  const calls = [];
  places._setDeps({ fetch: async (url) => (calls.push(url), { ok: true, json: async () => ({ displayName: { text: 'Gym ' + url.match(/place0+(\d)/)[1] }, attributions: [{ provider: 'Yelp' }] }) }) });
  const ids = Array.from({ length: 8 }, (_, i) => `ChIJplace0000000${i}`);
  try {
    assert.equal((await places.names(ids)).size, 0, 'no key, no calls');
    assert.equal(calls.length, 0);
    process.env.GOOGLE_PLACES_KEY = 'k';
    const got = await places.names(ids, { limit: 3 });
    assert.equal(got.size, 3);
    assert.deepEqual(got.get(ids[1]), { name: 'Gym 1', credits: ['Yelp'] });
    assert.ok(Math.abs(ctxLib.daySpent() - 0.06) < 1e-9, 'each call counts about $0.02 toward the day');
    process.env.HARNESS_MAX_DAY_USD = '0.1';
    assert.equal((await places.names(ids, { limit: 8 })).size, 0, 'the next 5 would pass the cap');
    // Everything else (OpenStreetMap, the member's own) is stored as it came.
    const osm = places.scrub({ key: 'osm:node/1', name: 'Iron Temple', links: { website: 'https://iron.test' } });
    assert.equal(osm.name, 'Iron Temple');
    assert.equal(osm.placeId, undefined);
  } finally {
    delete process.env.GOOGLE_PLACES_KEY;
    delete process.env.HARNESS_MAX_DAY_USD;
    places._setDeps({ fetch: (...a) => fetch(...a) });
  }
});

test('the Library refuses unknown types and enforces the quota', async () => {
  const user = await member('free');
  await assert.rejects(library.save(user, 'run.exe', 'MZ'), /can't keep that kind of file/);
  process.env.HARNESS_QUOTA_FREE_MB = '0.00001';
  try {
    await assert.rejects(library.save(user, 'big.txt', 'x'.repeat(100)), /Library is full/);
    // A run's own files are kept past the space, so a run never stops halfway.
    const kept = await library.save(user, 'reel.txt', 'x'.repeat(100), { runId: 'r1', stepId: 's1' });
    assert.ok(library.used(user.id) > library.quota('free'));
    assert.equal(await library.remove(user.id, kept.id), true);
  } finally {
    delete process.env.HARNESS_QUOTA_FREE_MB;
  }
  const a = await library.save(user, 'notes', 'hello', { type: 'text/plain' });
  assert.equal(a.name, 'notes.txt');
  assert.equal(library.disposition('text/html'), 'attachment');
  assert.equal(await library.remove(user.id, a.id), true);
  assert.equal(await library.read(user.id, a.id), null);
});

// ---------- the playbooks pack ----------

test('playbooks tools give the sample answer with no AI key and pass the under-18 marker on as a flag', async () => {
  const tool = packs.tool('playbooks.offer_validator');
  const out = await runTool(tool, { offer: 'Reels for gyms', audience: 'gym owners' }, makeCtx({ ai: 'demo' }));
  assert.equal(out.sample, true);
  assert.match(out.text, /The Idea Test/);
  let seen = null;
  const ctx = makeCtx({
    ai: async (req) => {
      seen = req;
      return { text: '[[under18]]' };
    },
  });
  const flagged = await runTool(tool, { offer: 'x', audience: 'y' }, ctx);
  assert.deepEqual(flagged.flags, ['under18']);
  assert.equal(flagged.text, ai.UNDER18_REPLY);
  assert.equal(seen.task, 'plan');
  assert.match(seen.system, /Eli's Playbook/);
  assert.match(seen.prompt, /Idea & Offer Validator/);
});

// ---------- HQ v2 views of it ----------

test('the Start screen ranks by the member business, locks by tier, and Ask picks a workflow', async () => {
  const user = await member('free', { answers: { model: 'service', what: 'testing things' } });
  const cat = harness.catalog(user);
  assert.ok(cat.length > 5);
  const firstLocked = cat.findIndex((c) => c.locked);
  assert.ok(firstLocked > 0 && cat.slice(firstLocked).every((c) => c.locked), 'unlocked first');
  const page = harness.workflowPage(user, 'tp.full');
  assert.deepEqual(page.plan.map((p) => p.kind), ['tool', 'tool', 'approve', 'tool', 'approve', 'tool', 'wait', 'tool']);
  assert.equal(page.plan[3].who, 'Opus 5.5');
  const asked = await harness.ask(user, 'score my things please');
  assert.ok(asked.pick);
  assert.equal(asked.routedBy, 'keywords');
  const t = harness.today(user);
  assert.ok(Array.isArray(t.start) && t.usage.allowance === 50);
});

test('forgetting a member removes their runs, inbox, pipeline, files and credits', async () => {
  const user = await member('builder');
  const run = await engine.start(user, 'tp.keep', {});
  await engine.idle();
  const r2 = await engine.start(user, 'tp.full', { n: 1 });
  await engine.idle();
  assert.equal(inbox.count(user.id), 1);
  const file = engine.get(user, run.id).steps.keep.output.file;
  await harness.forget(user.id);
  assert.equal(engine.get(user, run.id), null);
  assert.equal(engine.get(user, r2.id), null);
  assert.equal(inbox.count(user.id), 0);
  assert.equal(pipeline.list(user.id).length, 0);
  assert.equal(library.list(user.id).length, 0);
  assert.equal(await db.getBlob(file.id), null);
  assert.equal(db.filter('credits', (c) => c.memberId === user.id).length, 0);
});

test("harness check flags 127's own copy in a pack (titles, promises, inputs), never members' work", () => {
  const fake = { check: (t) => (/guarantee|land \d+ clients/i.test(t) ? [{ severity: 'block', match: t.match(/guarantee|land \d+ clients/i)[0], why: 'no' }] : /in a minute/.test(t) ? [{ severity: 'hold', match: 'in a minute', why: 'held' }] : []) };
  const pack = {
    id: 'cc',
    title: 'Copy pack',
    summary: 'Find gyms and land 3 clients.',
    tools: [{ name: 'cc.write', title: 'Write it' }],
    workflows: [
      { id: 'cc.flow', title: 'Get it done in a minute', promise: 'Money back guarantee.', steps: [{ id: 'ok', approve: { title: 'Pick 3' } }], inputs: obj({ city: { type: 'string', title: 'City', description: 'Where you land 2 clients' } }) },
    ],
  };
  const found = packs.copyFindings(pack, fake);
  assert.deepEqual(found.map((f) => f.split(':')[0]), ['pack summary', 'workflow cc.flow promise', 'workflow cc.flow input city']);
  assert.deepEqual(packs.copyFindings(pack, null), [], 'no copy check installed: nothing to report');
});
