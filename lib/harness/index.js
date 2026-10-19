// The 127 harness (v2): one engine that runs packs of tools and workflows on each member's
// business brain, with a model router, approvals, a pipeline, a library and credits.
// Plan: https://claude.ai/code/artifact/9d048558-6495-41e7-942b-8d5d10a8ba0d
// Pack format: /mnt/project-files/v2/harness/WORKFLOW-CONTRACT.md (copied to lib/harness/CONTRACT.md).
//
// HARNESS_V2=on shows HQ v2 to everyone with HQ; HARNESS_V2=admins shows it to ADMIN_EMAILS and to
// members an admin gave early access (access.js); off or unset: no routes, no tick, and HQ stays v1.
// HARNESS_PAUSE=on stops every run where it is (the kill switch); HARNESS_AI=off answers with demo
// text instead of calling Claude.

const path = require('path');
const packs = require('./packs');
const engine = require('./engine');
const router = require('./router');
const llm = require('./llm');
const ledger = require('./ledger');
const inbox = require('./inbox');
const pipeline = require('./pipeline');
const library = require('./library');
const brain = require('./brain');
const cache = require('./cache');
const blocks = require('./blocks');
const needs = require('./needs');
const models = require('./models');
const todayLib = require('./today');
const access = require('./access');
const activation = require('./activation');
const wins = require('./wins');
const monday = require('./monday');
const schedules = require('./schedules');
const jobs = require('./jobs');
const ctxLib = require('./ctx');
const { clip, scrubKeys } = require('./text');

// A lead's stage change: a first message counts toward today's number, and the first send, reply
// and win are activation steps.
pipeline._setDeps({
  onStage: async (memberId, lead, from, to) => {
    await todayLib.onStage(memberId, lead, from, to);
    await activation.onStage(memberId, lead, from, to);
  },
});

// What server.js plugs in with hooks(): analytics events (integrations.emit), a notice when a run
// finishes or waits on the member, the age-review guard and the under-18 flag.
const hooked = { emit: () => {}, notify: async () => {} };
function emit(type, payload) {
  try {
    hooked.emit(type, payload);
  } catch (err) {
    console.warn('[harness] event failed:', scrubKeys(err.message));
  }
}
engine._setDeps({
  notify: async (run, status, extra) => {
    // A finished run is the member's first result (activation a2), unless it was an admin sample.
    if (status === 'done' && !run.sample) await activation.mark(run.memberId, 'a2');
    // Monday's card is waiting: the Monday email links to the Inbox.
    if (status === 'waiting' && run.workflowId === 'hq.week') emit('hq.monday_card', { userId: run.memberId, runId: run.id, week: run.inputs && run.inputs.week });
    await hooked.notify(run, status, extra);
  },
});
function hooks({ emit: onEmit, notify, guard, flag } = {}) {
  if (typeof onEmit === 'function') {
    hooked.emit = onEmit;
    activation._setDeps({ emit: onEmit });
    wins._setDeps({ emit: onEmit });
    ctxLib._setDeps({ emit: onEmit });
  }
  if (typeof notify === 'function') hooked.notify = notify;
  const over = {};
  if (typeof guard === 'function') over.guard = guard;
  if (typeof flag === 'function') over.flag = flag;
  if (Object.keys(over).length) engine._setDeps(over);
}

const deps = { db: require('../db') };
const PACKS_DIR = path.join(__dirname, '..', 'packs');
let loaded = null;

function mode() {
  const v = String(process.env.HARNESS_V2 || '').toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}

function isAdmin(user) {
  const list = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return !!user && !!user.emailVerified && list.includes(String(user.email || '').toLowerCase());
}

function enabled() {
  return mode() !== 'off';
}

function enabledFor(user) {
  if (!user) return false;
  const m = mode();
  return m === 'on' || (m === 'admins' && (isAdmin(user) || access.active(user)));
}

function init({ dir = PACKS_DIR } = {}) {
  if (loaded) return loaded;
  loaded = packs.loadDir(dir);
  console.log(`[harness] packs: ${loaded.loaded.join(', ') || 'none'}${loaded.refused.length ? `; refused ${loaded.refused.length}` : ''}. AI: ${llm.live() ? 'live' : 'demo answers'}.`);
  return loaded;
}

// ---------- the Start screen ----------

const STOP = new Set('a an and are as at be by for from get i in is it me my of on or so that the this to we with you your our their them who what how'.split(' '));
// Light stemming, so "hooks" finds "Hook Writer" and "editing" finds "edit".
const stem = (w) => (w.length > 4 ? w.replace(/(ings|ing|ers|er|ed|es|s)$/, '') : w);
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);

// The workflow's own words count most, then its pack's.
function matchScore(wf, pk, want) {
  if (!want.length) return 0;
  const title = new Set(words(wf.title));
  const promise = new Set(words(wf.promise));
  const pack = new Set(words(`${(pk && pk.title) || ''} ${((pk && pk.niches) || []).join(' ')} ${(pk && pk.summary) || ''}`));
  return want.reduce((n, w) => n + (title.has(w) ? 3 : 0) + (promise.has(w) ? 2 : 0) + (pack.has(w) ? 1 : 0), 0);
}

// Tasks a tool says it uses (optional `tasks` on a tool), mapped to models: the plan preview.
function stepPlan(wf, tier) {
  return wf.steps.map((s) => {
    if (s.approve) return { id: s.id, title: s.approve.title, kind: 'approve', who: 'You' };
    if (s.wait) return { id: s.id, title: `Wait ${s.wait.days ? `${s.wait.days} days` : `${s.wait.hours} hours`}`, kind: 'wait', who: '' };
    const t = packs.tool(s.tool);
    const tasks = (t && Array.isArray(t.tasks) && t.tasks) || [];
    const who = tasks.length ? [...new Set(tasks.map((task) => models.label(router.route({ task, tier }).model)))].join(' + ') : t && t.kind === 'ai' ? models.label(router.route({ task: 'write', tier }).model) : t && t.kind === 'api' ? 'Outside data' : 'Code';
    return { id: s.id, title: s.title || (t ? t.title : s.tool), kind: 'tool', who, each: s.each !== undefined };
  });
}

function card(wf, user) {
  const pk = packs.pack(wf.pack) || {};
  return {
    id: wf.id,
    title: wf.title,
    promise: wf.promise,
    minutes: wf.minutes,
    tier: wf.tier,
    job: jobs.jobOf(wf),
    locked: !packs.allowed(wf, ledger.tierOf(user)),
    pack: wf.pack,
    packTitle: pk.title || wf.pack,
    business: pk.business === true,
    credits: engine.estimate(wf, {}),
    savesMinutes: wf.savesMinutes || 0,
    proof: wf.proof || '',
    showcase: !!showcaseOf(wf.id),
  };
}

// The member's bottleneck (jobs.constraint) and the catalog ordered for them: unlocked first, then
// workflows for their bottleneck, then ones that fit their business, then the pack's starters.
function bottleneck(user, b = brain.snapshot(user)) {
  const c = jobs.constraint(user, b, pipeline.counts(user.id));
  const j = jobs.JOBS.find((x) => x.id === c.job);
  return { ...c, title: j ? j.title : c.job };
}

// Another business type's workflows go last, so a cleaner's Today never opens on a dog walker's
// first 25 (the Ask bar still finds them by name).
function catalog(user, b = brain.snapshot(user)) {
  const want = words(`${b.business.niche || ''} ${b.business.what || ''} ${b.business.offer || ''} ${b.business.audience || ''}`);
  const job = bottleneck(user, b).job;
  const mine = (businessTypes(user, b).find((t) => t.mine) || {}).id;
  return packs
    .workflows({ tier: ledger.tierOf(user) })
    .filter((wf) => !wf.hidden)
    .map((wf) => ({ ...card(wf, user), match: matchScore(wf, packs.pack(wf.pack), want), starter: !!wf.starter }))
    .map((c) => ({ ...c, mine: c.pack === mine, fit: c.match + (c.job === job ? 4 : 0) + (c.starter ? 1 : 0) + (!c.business ? 0 : c.pack === mine ? 6 : -100) }))
    .sort((a, b2) => Number(a.locked) - Number(b2.locked) || b2.fit - a.fit || a.minutes - b2.minutes || a.title.localeCompare(b2.title));
}

// ---------- business types ----------
// A pack marked `business: true` is a business a member can start (house cleaning, UGC); the rest are
// tools every business uses. The member's business is the type they picked on Start (their niche is
// its title) or the one their own words fit best: a word in its niches counts 2, in its title 1, and
// words a quarter or more of the types share ("local", "business") pick nothing. Their onboarding
// category ("Local business") never picks one.
function businessTypes(user, b = brain.snapshot(user)) {
  const list = [...packs.registry.packs.values()].filter((p) => p.business === true);
  if (!list.length) return [];
  const all = packs.workflows().filter((wf) => !wf.hidden);
  const sets = list.map((p) => ({ niches: new Set(words((p.niches || []).join(' '))), title: new Set(words(p.title)) }));
  const shared = new Map();
  for (const s of sets) for (const w of new Set([...s.niches, ...s.title])) shared.set(w, (shared.get(w) || 0) + 1);
  const common = (w) => list.length >= 4 && shared.get(w) >= Math.max(2, Math.ceil(list.length / 4));
  const niche = brain.ownNiche(user);
  const want = [...new Set(words(`${niche} ${b.business.what || ''} ${b.business.offer || ''} ${b.business.audience || ''}`))].filter((w) => !common(w));
  const types = list
    .map((p, i) => ({
      id: p.id,
      title: p.title,
      summary: p.summary || '',
      count: all.filter((wf) => wf.pack === p.id).length,
      picked: !!niche && niche.trim().toLowerCase() === String(p.title).toLowerCase(),
      fit: want.reduce((n, w) => n + (sets[i].niches.has(w) ? 2 : 0) + (sets[i].title.has(w) ? 1 : 0), 0),
    }))
    .filter((t) => t.count);
  const best = types.find((t) => t.picked) || types.reduce((a, t) => (t.fit > (a ? a.fit : 1) ? t : a), null);
  return types.map((t) => ({ ...t, mine: t === best }));
}

// Start: the member's business first, as one numbered path in the pack's own order (its first
// workflow is step 1) with the steps they've finished checked off and the first one left marked
// next, then every tool by the job it does with the bottleneck first, then the other business types
// folded, closest to their words first, then the fullest. With no business type loaded it's the job
// groups alone.
function start(user) {
  const b = brain.snapshot(user);
  const list = catalog(user, b);
  const types = businessTypes(user, b);
  const mine = types.find((t) => t.mine) || null;
  const order = new Map(packs.workflows().map((wf, i) => [wf.id, i]));
  const ran = new Map();
  for (const r of deps.db.filter('runs', (x) => x.memberId === user.id && x.status === 'done' && !x.sample)) ran.set(r.workflowId, (ran.get(r.workflowId) || 0) + 1);
  const repeats = new Map(schedules.list(user.id).map((s) => [s.workflowId, s.label]));
  const path = (id) =>
    list
      .filter((w) => w.pack === id)
      .sort((x, y) => order.get(x.id) - order.get(y.id))
      .map((w, i) => ({ ...w, n: i + 1, ran: ran.get(w.id) || 0, repeat: repeats.get(w.id) || '' }));
  const tools = list.filter((w) => !w.business);
  const groups = jobs.JOBS.map((j) => ({ ...j, items: tools.filter((w) => w.job === j.id) })).filter((g) => g.items.length);
  const others = types.filter((t) => t !== mine).sort((x, y) => y.fit - x.fit || y.count - x.count || x.title.localeCompare(y.title));
  const items = mine ? path(mine.id) : [];
  return {
    bottleneck: bottleneck(user, b),
    mine: mine && { ...mine, items, done: items.filter((w) => w.ran).length, next: (items.find((w) => !w.ran) || {}).id || null },
    groups,
    types: others.map((t) => ({ ...t, items: path(t.id) })),
    pickFirst: needsBusiness(user, b, types),
  };
}

// No business of theirs to go on (none picked or fitting, nothing written about it) while business
// types are loaded: Start and Today lead with picking one.
function needsBusiness(user, b = brain.snapshot(user), types = businessTypes(user, b)) {
  return !!types.length && !types.some((t) => t.mine) && !b.business.what && !b.business.offer && !brain.ownNiche(user);
}

// Picks a business type on Start: the member's niche becomes its title (they can edit it in Your business).
async function pickBusiness(user, id) {
  const p = packs.pack(id);
  if (!p || p.business !== true) return null;
  return brain.update(user, { business: { niche: p.title } });
}

// The example run shown on a workflow's page (an admin's sample run: no member data in it).
function showcaseOf(id) {
  const ref = deps.db.get('harnessCache', `showcase:${id}`);
  const run = ref && ref.value && deps.db.get('runs', ref.value.runId);
  return run && run.status === 'done' ? run : null;
}

async function setShowcase(runId) {
  const run = deps.db.get('runs', runId);
  if (!run || run.status !== 'done' || !run.sample) throw new Error('Only a finished sample run can be the example.');
  run.keep = true;
  await deps.db.save('runs', run);
  for (const a of deps.db.filter('assets', (x) => x.runId === run.id)) {
    a.public = true;
    await deps.db.save('assets', a);
  }
  await deps.db.save('harnessCache', { id: `showcase:${run.workflowId}`, key: `showcase:${run.workflowId}`, value: { runId: run.id }, expiresAt: '9999-12-31T00:00:00.000Z' });
}

function workflowPage(user, id) {
  const wf = packs.workflow(id);
  if (!wf || wf.hidden) return null;
  const free = !packs.allowed(wf, ledger.tierOf(user)) && wf.tier === 'builder' && ledger.freeRunAvailable(user);
  const ex = showcaseOf(id);
  // A business's workflow is a step on its path (Start): "Step 3 of 11".
  const path = (packs.pack(wf.pack) || {}).business === true ? packs.workflows().filter((w) => w.pack === wf.pack && !w.hidden) : [];
  return {
    ...card(wf, user),
    step: path.length > 1 ? { n: path.findIndex((w) => w.id === id) + 1, of: path.length } : null,
    inputs: wf.inputs,
    plan: stepPlan(wf, ledger.tierOf(user)),
    // Shown under Run it while a step searches real businesses (Legal L66); the form sends their keys back.
    agree: engine.agreeLines(wf),
    freeRun: free,
    usage: ledger.usage(user),
    example: ex ? { result: engine.view(ex).result, inputs: ex.inputs } : null,
    next: (wf.next || []).map((n) => packs.workflow(n)).filter(Boolean).map((w) => card(w, user)),
  };
}

// ---------- the Ask bar ----------
// One line from the member: pick the workflow that fits and fill what it can of the form. A cheap
// classify call (Haiku) when the AI is on; keyword match otherwise.

const PICK = {
  type: 'object',
  properties: {
    workflow: { type: 'string', description: 'The id of the best workflow, or "none".' },
    fields: {
      type: 'array',
      description: "Form values the request already states, as key and value. Keys must be the workflow's form keys.",
      items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
    },
    why: { type: 'string', description: 'One short sentence: why this workflow.' },
  },
  required: ['workflow', 'fields', 'why'],
};

async function ask(user, text) {
  const q = clip(text, 500);
  const list = catalog(user).filter((w) => !w.locked || w.tier === 'builder');
  const want = words(q);
  const ranked = list.map((w) => ({ w, s: matchScore(packs.workflow(w.id), packs.pack(w.pack), want) })).sort((a, b) => b.s - a.s);
  let pick = ranked.length && ranked[0].s > 0 ? ranked[0].w : null;
  let why = pick ? 'It matches what you asked for.' : '';
  let inputs = {};
  let model = null;
  if (llm.live() && list.length) {
    try {
      const menu = ranked.slice(0, 40).map(({ w }) => `- ${w.id}: ${w.title}. ${w.promise}. Form: ${JSON.stringify(Object.keys((packs.workflow(w.id).inputs || {}).properties || {}))}`).join('\n');
      const r = await llm.call({
        task: 'classify',
        tier: ledger.tierOf(user),
        system: 'You route a founder\'s request to one of 127\'s workflows. Answer with the workflow id that best does what they asked, or "none" if nothing fits. Fill form values only when the request states them.',
        prompt: `Workflows:\n${menu}\n\nRequest: ${q}`,
        schema: PICK,
        onCost: async (meta) => {
          model = meta.model;
          await ledger.cost(user, meta.usd, { tool: 'ask' });
        },
      });
      const hit = list.find((w) => w.id === r.data.workflow);
      if (hit) {
        pick = hit;
        why = r.data.why || why;
        const props = (packs.workflow(hit.id).inputs || {}).properties || {};
        for (const f of r.data.fields || []) if (props[f.key] && f.value) inputs[f.key] = f.value;
      } else if (r.data.workflow === 'none') pick = null;
    } catch (err) {
      console.warn('[harness] ask fell back to keywords:', scrubKeys(err.message));
    }
  }
  const guessed = pick ? guessInputs(packs.workflow(pick.id), q, brain.snapshot(user)) : {};
  inputs = { ...guessed, ...inputs };
  return {
    text: q,
    pick: pick ? { ...workflowPage(user, pick.id), why, inputs } : null,
    others: ranked.filter((r) => !pick || r.w.id !== pick.id).slice(0, 3).map((r) => r.w),
    task: router.guessTask(q),
    routedBy: model ? models.label(model) : 'keywords',
  };
}

// ---------- Talk to 127 ----------
// The Ask bar and the voice orb send every line here. In order: go somewhere ("show my pipeline"),
// log what they did ("sent 20 DMs"), how am I doing ("what's next?"), else find the workflow.

const PLACES = [
  [/\b(pipeline|leads?|prospects?|crm)\b/, '/app/hq/pipeline', 'Your pipeline.'],
  [/\b(inbox|approvals?|waiting)\b/, '/app/hq/inbox', "Here's what's waiting on you."],
  [/\b(library|files?|videos?|downloads?)\b/, '/app/hq/library', 'Your Library.'],
  [/\b(numbers|week|scorecard|kpis?|metrics)\b/, '/app/hq?v1=1', 'Your weekly numbers.'],
  [/\b(workflows?|start|catalog|everything)\b/, '/app/hq/start', 'Every workflow you can run.'],
  [/\b(setup|set up|plugins?|connect(ions)?|tools to)\b/, '/app/hq/setup', 'What to set up next.'],
  [/\b(my business|business brain|settings|profile)\b/, '/app/hq/brain', 'Your business, as 127 knows it.'],
  [/\b(today|home|dashboard)\b/, '/app/hq', 'Today.'],
];
const KIND_WORDS = [
  ['content', /\b(posts?|posted|reels?|videos?|tiktoks?|shorts|content|filmed|edited|minutes? of content)\b/],
  ['ads', /\b(ads?|ad spend|boosted|campaigns?)\b/],
  ['warm', /\b(friends?|family|warm|past (customers?|clients?)|referrals?|people i know)\b/],
  ['cold', /\b(dms?|messages?|messaged|emails?|emailed|calls?|called|cold|outreach|texts?|texted|door ?knocks?|pitches|pitched)\b/],
];

function intentOf(q) {
  const s = q.toLowerCase();
  const nav = /^(show|open|go to|take me to|pull up|see|view)\b|\b(show me|open my|take me)\b/.test(s);
  if (nav) for (const [re, href, say] of PLACES) if (re.test(s)) return { kind: 'nav', nav: href, say };
  const log = s.match(/\b(?:i\s+)?(?:sent|did|made|logged|log|posted|called|messaged|emailed|texted|dm'?d|reached out to|pitched|spent)\s+(\$?\d{1,4})\b/);
  if (log) {
    const n = Number(log[1].replace('$', ''));
    const kind = (KIND_WORDS.find(([, re]) => re.test(s)) || ['cold'])[0];
    return { kind: 'log', log: { kind, n } };
  }
  if (/\b(how am i doing|how'?s it going|what'?s next|what now|what should i do|where am i|status|my day)\b/.test(s)) return { kind: 'status' };
  return null;
}

async function talk(user, text) {
  const q = clip(text, 500);
  const intent = intentOf(q);
  if (intent && intent.kind === 'nav') return { text: q, kind: 'nav', nav: intent.nav, say: intent.say };
  if (intent && intent.kind === 'log') {
    await todayLib.log(user.id, intent.log.kind, intent.log.n);
    const h = todayLib.hundred(user);
    return { text: q, kind: 'log', logged: intent.log, hundred: h, say: `Logged ${intent.log.n} ${todayLib.LABELS[intent.log.kind].toLowerCase()}. ${h.done ? `That's ${h.today}. You hit ${h.target} today.` : `You're at ${h.today} of ${h.target}.`}` };
  }
  if (intent && intent.kind === 'status') return { text: q, kind: 'status', say: todayLib.say(user, moveDeps), move: todayLib.nextMove(user, moveDeps) };
  const r = await ask(user, q);
  if (r.pick) return { ...r, kind: 'workflow', say: `${r.pick.title}. ${r.pick.promise}` };
  return { ...r, kind: 'none', say: "I don't have a workflow for that yet. Try saying it another way, or look through Start." };
}

// Fills obvious form fields: a city from "in Des Moines", else the member's own city.
function guessInputs(wf, q, b) {
  const props = (wf && wf.inputs && wf.inputs.properties) || {};
  const out = {};
  for (const [k, p] of Object.entries(props)) {
    if (/city|location|where/i.test(k + (p.title || ''))) {
      const m = q.match(/\b(?:in|near|around)\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,3}(?:,\s*[A-Z]{2})?)/);
      if (m) out[k] = m[1];
      else if (b.business.city) out[k] = [b.business.city, b.business.region].filter(Boolean).join(', ');
    }
  }
  return out;
}

// A member types their city once: the first time a run's city field is filled and Your business has
// none, it's saved there ("Ames, IA" as city and state), so the next form, the Ask bar and Do my day
// already know it. A city they've saved is never changed this way.
async function learnCity(user, wf, inputs = {}) {
  if (brain.snapshot(user).business.city) return;
  const props = (wf && wf.inputs && wf.inputs.properties) || {};
  const key = Object.keys(props).find((k) => props[k] && props[k].type === 'string' && (/^(city|town)$/i.test(k) || /\b(city|town)\b/i.test(props[k].title || '')));
  const v = key ? String(inputs[key] || '').trim() : '';
  if (!v || v.length > 80) return;
  const m = v.match(/^([^,]{2,60}),\s*([A-Za-z. ]{2,30})$/);
  await brain.update(user, { business: m ? { city: m[1].trim(), region: m[2].trim() } : { city: v } });
}

// ---------- Today ----------

// What Today's one move reads besides the member's own queue.
const moveDeps = { catalog, needsBusiness };

function today(user) {
  const runs = engine.list(user, { limit: 30 });
  return {
    move: todayLib.nextMove(user, moveDeps),
    bottleneck: bottleneck(user),
    hundred: todayLib.hundred(user),
    queue: todayLib.queue(user),
    score: todayLib.scoreboard(user),
    ladder: todayLib.ladder(user),
    week: todayLib.week(user),
    receipts: todayLib.receipts(user),
    inbox: inbox.list(user.id, { status: 'open', limit: 10 }),
    running: runs.filter((r) => ['queued', 'running', 'waiting', 'sleeping'].includes(r.status)).slice(0, 5).map(engine.view),
    recent: runs.filter((r) => ['done', 'failed', 'stopped'].includes(r.status)).slice(0, 5).map((r) => ({ id: r.id, title: r.title, status: r.status, endedAt: r.endedAt })),
    pipeline: pipeline.counts(user.id),
    usage: ledger.usage(user),
    start: catalog(user).slice(0, 6),
    files: library.list(user.id, { limit: 6 }),
  };
}

// ---------- admin ----------

const pctl = (xs, p) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor((xs.length - 1) * p))] : null);
const usd = (n) => (n === null ? null : Math.round(n * 1000) / 1000);

// Margin as a feature (v2/hormozi-playbook.md 1.5 and 2.3 item 11): today's AI and data spend against
// the daily cap, what a free run costs us (target p50 at or under $0.30, alarm at $0.50), and what a
// member costs this month. Never shown to members.
function margins(now = Date.now()) {
  const cap = Number(process.env.HARNESS_MAX_DAY_USD || 100);
  const spent = ctxLib.daySpent();
  const since = new Date(now - 30 * 864e5).toISOString();
  const free = deps.db.filter('runs', (r) => r.freeRun && r.status === 'done' && String(r.endedAt) >= since).map((r) => r.usd || 0).sort((a, b) => a - b);
  const month = ledger.totals();
  const perMember = deps.db.filter('credits', (d) => d.month === month.month && d.usd > 0).map((d) => d.usd).sort((a, b) => a - b);
  const p50 = pctl(free, 0.5);
  const alarms = [];
  if (cap > 0 && spent >= cap * 0.8) alarms.push(`Today's AI and data spend is $${spent.toFixed(2)}, ${Math.round((spent / cap) * 100)}% of the $${cap} cap.`);
  else if (cap > 0 && spent >= cap * 0.5) alarms.push(`Today's AI and data spend passed half the $${cap} cap.`);
  if (p50 !== null && p50 > 0.5) alarms.push(`A free run costs $${p50.toFixed(2)} at the median, over the $0.50 alarm.`);
  return {
    today: { usd: usd(spent), cap, pct: cap > 0 ? Math.round((spent / cap) * 100) : null },
    freeRuns: { last30Days: free.length, p50: usd(p50), p90: usd(pctl(free, 0.9)), target: 0.3, alarm: 0.5 },
    perMember: { month: month.month, members: perMember.length, total: usd(month.usd), average: usd(perMember.length ? month.usd / perMember.length : null), p90: usd(pctl(perMember, 0.9)), max: usd(perMember.length ? perMember[perMember.length - 1] : null) },
    alarms,
  };
}

// Activation by signup week (Eastern), with the one number to watch: a first send within 7 days.
function activationByWeek(weeks = 8, now = Date.now()) {
  const from = todayLib.addDays(todayLib.weekStart(todayLib.dayKey(now)), -7 * (weeks - 1));
  const rows = new Map();
  for (const u of deps.db.all('users')) {
    if (!u.createdAt) continue;
    const week = todayLib.weekStart(todayLib.dayKey(Date.parse(u.createdAt)));
    if (week < from) continue;
    const act = (deps.db.get('brains', u.id) || {}).act || {};
    const row = rows.get(week) || { week, members: 0, builders: 0, a1: 0, a2: 0, a3: 0, a4: 0, a5: 0, firstSend7: 0, builderFirstSend7: 0 };
    const builder = u.tier === 'builder' || u.tier === 'circle';
    const in7 = act.a3 && Date.parse(act.a3) - Date.parse(u.createdAt) <= 7 * 864e5;
    row.members += 1;
    if (builder) row.builders += 1;
    for (const k of ['a1', 'a2', 'a3', 'a4', 'a5']) if (act[k]) row[k] += 1;
    if (in7) row.firstSend7 += 1;
    if (in7 && builder) row.builderFirstSend7 += 1;
    rows.set(week, row);
  }
  return [...rows.values()]
    .sort((a, b) => b.week.localeCompare(a.week))
    .map((r) => ({ ...r, firstSend7Rate: r.members ? Math.round((r.firstSend7 / r.members) * 100) : null, builderFirstSend7Rate: r.builders ? Math.round((r.builderFirstSend7 / r.builders) * 100) : null }));
}

function adminStatus() {
  return {
    mode: mode(),
    paused: process.env.HARNESS_PAUSE === 'on',
    ai: llm.live() ? 'live' : 'demo',
    packs: [...packs.registry.packs.values()].map((p) => ({ id: p.id, title: p.title, version: p.version, tools: p.tools.length, workflows: (p.workflows || []).length })),
    refused: packs.registry.refused.map((r) => ({ id: r.id || r.source, problems: r.problems.slice(0, 5) })),
    keys: needs.status(),
    router: router.explain('builder'),
    month: ledger.totals(),
    margins: margins(),
    activation: activationByWeek(),
    runs: {
      active: deps.db.filter('runs', (r) => ['queued', 'running'].includes(r.status)).length,
      waiting: deps.db.filter('runs', (r) => r.status === 'waiting').length,
      sleeping: deps.db.filter('runs', (r) => r.status === 'sleeping').length,
      failed24h: deps.db.filter('runs', (r) => r.status === 'failed' && String(r.endedAt) > new Date(Date.now() - 864e5).toISOString()).length,
    },
  };
}

// Account deletion: everything the harness keeps for a member.
async function forget(userId) {
  await engine.forget(userId);
  for (const col of ['inbox', 'pipeline', 'proof']) for (const d of deps.db.filter(col, (x) => x.memberId === userId)) await deps.db.remove(col, d.id);
  for (const a of deps.db.filter('assets', (x) => x.memberId === userId)) await library.remove(userId, a.id);
  for (const col of ['credits', 'actions', 'schedules']) for (const d of deps.db.filter(col, (x) => x.memberId === userId)) await deps.db.remove(col, d.id);
  if (deps.db.get('brains', userId)) await deps.db.remove('brains', userId);
}

// The interval in server.js: every minute while the harness is on. Monday's cards are checked
// every 10 minutes.
let lastTimed = 0;
async function tick(now = Date.now()) {
  if (!enabled()) return;
  await engine.tick();
  if (now - lastTimed >= 10 * 60 * 1000) {
    lastTimed = now;
    try {
      await monday.sweep({ enabledFor, start: engine.start });
    } catch (err) {
      console.warn('[harness] Monday sweep failed:', scrubKeys(err.message));
    }
    try {
      await schedules.sweep({ enabledFor, start: engine.start });
    } catch (err) {
      console.warn('[harness] Repeats sweep failed:', scrubKeys(err.message));
    }
  }
}

let lastSweep = 0;
async function daily(now = Date.now()) {
  if (!enabled() || now - lastSweep < 864e5) return;
  lastSweep = now;
  await engine.sweep();
  await cache.sweep();
}

module.exports = {
  mode,
  enabled,
  enabledFor,
  access,
  init,
  hooks,
  emit,
  catalog,
  moveDeps,
  businessTypes,
  start,
  pickBusiness,
  learnCity,
  card,
  workflowPage,
  ask,
  talk,
  today,
  bottleneck,
  showcaseOf,
  setShowcase,
  jobs,
  adminStatus,
  margins,
  activationByWeek,
  forget,
  tick,
  daily,
  engine,
  packs,
  router,
  ledger,
  inbox,
  pipeline,
  library,
  brain,
  blocks,
  models,
  needs,
  todayLib,
  activation,
  wins,
  monday,
  schedules,
  _guessInputs: guessInputs,
};
