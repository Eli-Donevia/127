// Ask 127 plans (HQ_PLANNER, with HQ_AGENT): a goal said or typed in HQ becomes one plan card. Ask 127
// gathers what fits from the workflow packs, the prompt library, AI scripts, Store templates and kits,
// Briefs, AI team roles, skills and the member's connections, and proposes 2 to 6 steps, each one of those by id.
// The card shows what each step uses, its credits and the member's minutes, the total and what's left,
// and the apps that would make a step better. One tap runs the ticked steps: workflows and skills
// start (their own approvals still stop in the Inbox, an act step one tick per item, H94), a prompt
// runs in the chat, and a script, template, brief or helper opens with what's known. Nothing here sends,
// posts or changes an account.
//
// Sent to Anthropic, on top of Ask 127's context: the titles of the library items that match the
// message (127's own content) and the names of the apps the member has connected or could connect.
// No data from those apps goes into the chat; a step reads it under that app's own rules.

const packs = require('./packs');
const engine = require('./engine');
const ledger = require('./ledger');
const docs = require('./docs');
const prompts = require('./prompts');
const briefs = require('./briefs');
const scripts = require('./scripts');
const skills = require('./skills');
const flags = require('./flags');
const { clip } = require('./text');

const KINDS = ['workflow', 'prompt', 'script', 'template', 'brief', 'helper', 'skill'];
const LABELS = { workflow: 'Workflow', prompt: 'Prompt', script: 'AI script', template: 'Template', brief: 'Brief', helper: 'AI helper', skill: 'Skill', app: 'Connected' };
const MAX_STEPS = 6;
// The member's minutes when an item doesn't say: a prompt answer to read, a template or brief to fill in
// (an AI script: about 3 a step, each one pasted into an AI).
const MINUTES = { script: 3, prompt: 2, template: 10, brief: 5, helper: 2, skill: 1, workflow: 5 };

function on(user) {
  return flags.on('HQ_PLANNER', user) && flags.on('HQ_AGENT', user);
}

const score = (want, text) => docs.tokens(text).reduce((k, w) => k + (want.has(w) ? 1 : 0), 0);
const top = (list, want, n, text) => list.map((x) => ({ x, s: score(want, text(x)) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((r) => r.x);

// What fits this message, by kind: [{ kind, id, title, what, credits, minutes, href }], plus the apps.
function gather(user, q, { promptCost = 2 } = {}) {
  const want = new Set(docs.tokens(q));
  const items = [];
  const agent = require('./agent');
  for (const { c, wf } of agent.candidates(user, q, 8)) {
    items.push({ kind: 'workflow', id: c.id, title: c.title, what: c.promise, credits: c.credits, minutes: Number(wf && wf.minutes) || MINUTES.workflow, form: agent.formOf(wf) });
  }
  const ps = prompts.load().prompts.filter((p) => prompts.allowed(p, user));
  for (const p of top(ps, want, 6, (p) => `${p.title} ${p.when || ''} ${p.group}`)) {
    const need = (p.variables || []).filter((v) => !v.optional).map((v) => v.key);
    items.push({ kind: 'prompt', id: p.id, title: p.title, what: clip(p.when || '', 160), credits: promptCost, minutes: MINUTES.prompt, form: need.join(', ') || 'none' });
  }
  const store = require('../store');
  if (store.enabledFor(user)) {
    for (const it of top(store.list({}).filter((i) => i.status === 'ready' && store.canOpen(user, i)), want, 6, (i) => `${i.title} ${i.summary} ${(i.tags || []).join(' ')}`)) {
      items.push({ kind: 'template', id: it.id, title: it.title, what: clip(it.summary, 160), credits: 0, minutes: Number(it.minutes) || MINUTES.template });
    }
  }
  // AI scripts and Briefs share HQ_SCRIPTS; a script or brief above the member's plan is left out (tier lock).
  if (flags.on('HQ_SCRIPTS', user)) {
    for (const sc of top(scripts.list(user).filter((x) => !x.locked), want, 4, (x) => `${x.title} ${x.when || ''}`)) {
      items.push({ kind: 'script', id: sc.id, title: sc.title, what: clip(`${sc.when || ''} ${sc.steps} steps.`, 160), credits: 0, minutes: MINUTES.script * (sc.steps || 1) });
    }
    for (const k of top(briefs.list(user).filter((k) => !k.locked), want, 3, (k) => `${k.title} ${k.when || ''}`)) {
      items.push({ kind: 'brief', id: k.id, title: k.title, what: clip(k.when || '', 160), credits: 0, minutes: MINUTES.brief });
    }
  }
  if (flags.on('HQ_TEAM', user)) {
    const team = require('./team');
    for (const r of top(team.ROLES, want, 2, (r) => `${r.title} ${r.job}`)) items.push({ kind: 'helper', id: r.id, title: r.title, what: clip(r.job, 160), credits: 0, minutes: MINUTES.helper });
  }
  if (flags.on('HQ_SKILLS', user)) {
    for (const s of top(skills.list(user).filter((s) => s.status === 'on' || s.status === 'off'), want, 3, (s) => `${s.name} ${s.what || ''}`)) {
      items.push({ kind: 'skill', id: s.id, title: s.name, what: clip(s.what || '', 160), credits: s.credits || 0, minutes: MINUTES.skill });
    }
  }
  return { items, apps: apps(user, want) };
}

// { connected: [{ id, name, reads, writes }], could: [...] }: what's connected, and up to 6 that match
// the message and could be connected now.
function apps(user, want) {
  const connectors = require('./connectors');
  if (!connectors.on(user)) return { connected: [], could: [] };
  const all = connectors.gallery(user).categories.flatMap((c) => c.apps.map((a) => ({ ...a, category: c.name })));
  const pick = (a) => ({ id: a.id, name: a.name, reads: a.reads || '', writes: a.writes || '' });
  const connected = all.filter((a) => a.status === 'connected').map(pick);
  const could = top(all.filter((a) => a.status === 'connect'), want, 6, (a) => `${a.name} ${a.category} ${a.reads || ''} ${a.writes || ''}`).map(pick);
  return { connected, could };
}

// The library part of the model's context.
function context(lib) {
  const by = (k) => lib.items.filter((i) => i.kind === k);
  const line = (i) => `- ${i.kind}:${i.id}: ${i.title}. ${i.what}${i.form ? ` Form: ${i.form}.` : ''} About ${i.credits} credits, ${i.minutes} min of the member's time.`;
  const parts = KINDS.map((k) => (by(k).length ? `${LABELS[k]}s:\n${by(k).map(line).join('\n')}` : '')).filter(Boolean);
  const a = lib.apps;
  return [
    parts.length ? `Things a plan can use (ref = kind:id):\n${parts.join('\n')}` : 'Nothing in the libraries matches this message.',
    a.connected.length ? `Apps the member connected (steps can read them): ${a.connected.map((x) => `${x.id} = ${x.name}${x.reads ? ` (reads ${x.reads})` : ''}`).join('; ')}.` : 'The member has no apps connected.',
    a.could.length ? `Apps they could connect now (for connect): ${a.could.map((x) => `${x.id} = ${x.name}`).join('; ')}.` : '',
  ].filter(Boolean).join('\n\n');
}

const RULES = `- Plans: when the member wants an outcome that takes more than one step, put a plan in plan: a short title and 2 to ${MAX_STEPS} steps in order. Each step uses one thing from "Things a plan can use", by its ref (kind:id), says in a few words what it makes, and gives form values the member stated or their Brain and numbers make plain. Lean on the libraries: a prompt to think it through, a template or brief to make the thing, a workflow to do the work. Use their connected apps where a step can. Put an app id in connect only from "Apps they could connect now", when it would make a step better. Otherwise leave plan.steps empty. The plan is a card the member runs with one tap; anything that sends, posts or changes an account still waits for their own OK.`;

const PLAN = {
  type: 'object',
  description: 'A plan of 2 to 6 steps, or empty steps when the member asked for one thing or a plan doesn\'t help.',
  properties: {
    title: { type: 'string', description: 'The goal in a few words, like "More gym clients this month".' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'kind:id from "Things a plan can use".' },
          does: { type: 'string', description: 'What this step makes, a few words.' },
          inputs: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
        },
        required: ['ref', 'does', 'inputs'],
      },
    },
    connect: { type: 'array', items: { type: 'string' }, description: 'App ids from "Apps they could connect now" that would make a step better.' },
  },
  required: ['title', 'steps', 'connect'],
};

// The model's plan, checked against what was gathered. Returns the plan action, or null.
function clean(raw, lib, user) {
  if (!raw || !Array.isArray(raw.steps)) return null;
  const byRef = new Map(lib.items.map((i) => [`${i.kind}:${i.id}`, i]));
  const steps = [];
  const seen = new Set();
  for (const s of raw.steps) {
    const it = s && byRef.get(String(s.ref || '').trim());
    if (!it || seen.has(`${it.kind}:${it.id}`) || steps.length >= MAX_STEPS) continue;
    seen.add(`${it.kind}:${it.id}`);
    const pairs = (Array.isArray(s.inputs) ? s.inputs : []).filter((f) => f && f.key && String(f.value || '').trim());
    let inputs = {};
    let credits = it.credits;
    if (it.kind === 'workflow') {
      const wf = packs.workflow(it.id);
      if (!wf || wf.hidden || !packs.allowed(wf, ledger.tierOf(user))) continue;
      const props = (wf.inputs && wf.inputs.properties) || {};
      inputs = Object.fromEntries(pairs.filter((f) => props[f.key]).map((f) => [f.key, clip(f.value, 500)]));
      credits = engine.estimate(wf, inputs);
    } else if (it.kind === 'prompt') {
      const p = prompts.get(it.id);
      const keys = new Set((p.variables || []).map((v) => v.key));
      inputs = Object.fromEntries(pairs.filter((f) => keys.has(f.key)).map((f) => [f.key, clip(f.value, 2000)]));
    }
    steps.push({ i: steps.length, kind: it.kind, ref: it.id, title: it.title, does: clip(s.does, 120) || it.title, inputs, credits, minutes: it.minutes, status: 'planned' });
  }
  if (!steps.length) return null;
  const could = new Map(lib.apps.could.map((a) => [a.id, a]));
  const connect = [...new Set((Array.isArray(raw.connect) ? raw.connect : []).map(String))].filter((x) => could.has(x)).slice(0, 3).map((x) => ({ id: x, name: could.get(x).name, link: `/app/hq/apps/${x}` }));
  const using = steps.map((s) => ({ kind: s.kind, label: `${LABELS[s.kind]}: ${s.title}` })).concat(lib.apps.connected.length ? [{ kind: 'app', label: `${LABELS.app}: ${lib.apps.connected.map((a) => a.name).join(', ')}` }] : []);
  return {
    type: 'plan',
    label: 'Run this plan',
    title: clip(raw.title, 80) || 'Your plan',
    steps,
    connect,
    using,
    credits: steps.reduce((n, s) => n + (s.credits || 0), 0),
    minutes: steps.reduce((n, s) => n + (s.minutes || 0), 0),
  };
}

// Runs the ticked steps of an OK'd plan, in order. start(user, wfId, inputs) is Ask 127's own start
// (opens the form when a field or a Terms OK is missing); runPrompt(user, text, title) sends a filled
// prompt to Ask 127. Each step gets its status, link and any error.
async function run(user, plan, ticked, { start, runPrompt }) {
  const keep = ticked ? new Set(ticked.map(Number)) : null;
  for (const s of plan.steps) {
    if (keep && !keep.has(s.i)) {
      s.status = 'skipped';
      continue;
    }
    try {
      if (s.kind === 'workflow') Object.assign(s, await start(user, s.ref, s.inputs || {}));
      else if (s.kind === 'skill') {
        const r = await skills.runNow(user, s.ref, { source: 'agent' });
        Object.assign(s, { status: 'done', runId: r.id, link: `/app/hq/runs/${r.id}` });
      } else if (s.kind === 'prompt') {
        const p = prompts.get(s.ref);
        const missing = (p.variables || []).filter((v) => !v.optional && !String((s.inputs || {})[v.key] || '').trim());
        // Answers still missing: the prompt waits in Ask 127's box for them.
        if (missing.length) Object.assign(s, { status: 'open', link: `/app/hq/ask?q=${encodeURIComponent(`/${p.id} `)}#end` });
        else {
          await runPrompt(user, prompts.fill(p, s.inputs || {}), p.title);
          Object.assign(s, { status: 'done', link: '/app/hq/ask#end' });
        }
      } else if (s.kind === 'script') Object.assign(s, { status: 'open', link: `/app/hq/scripts/${encodeURIComponent(s.ref)}` });
      else if (s.kind === 'template') Object.assign(s, { status: 'open', link: `/app/hq/store/${encodeURIComponent(s.ref)}` });
      else if (s.kind === 'brief') Object.assign(s, { status: 'open', link: `/app/hq/briefs/${encodeURIComponent(s.ref)}` });
      else if (s.kind === 'helper') Object.assign(s, { status: 'open', link: '/app/hq/team' });
    } catch (err) {
      if (!err || !err.status) throw err;
      Object.assign(s, { status: 'failed', error: clip(err.message, 200) });
    }
  }
  return plan;
}

module.exports = { on, gather, apps, context, clean, run, RULES, PLAN, KINDS, LABELS, MAX_STEPS };
