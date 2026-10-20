// Runs workflows in the background, step by step (contract section 4). A run is saved after every
// step and every `each` item, so the member can close the page, the server can restart, and the
// run picks up where it was. Approvals put a card in the Inbox and wait; `wait` steps sleep until
// the engine's tick wakes them.
//
// Switches: HARNESS_RUNS_AT_ONCE (runs advancing at once, default 4), HARNESS_TOOLS_AT_ONCE (tool
// calls at once, default 8), HARNESS_RENDERS_AT_ONCE (video renders, default 1), HARNESS_PAUSE=on (nothing advances:
// the kill switch), HARNESS_MAX_ACTIVE_RUNS (per member, default 3), HARNESS_STRICT=on (a tool
// output that breaks its schema fails the step; on by default under tests).

// guard(user): a reason the member can't run anything right now (an age review), or null.
// flag(user, run, stepId, output): a tool output carried flags (an AI answer's under-18 marker).
const deps = { db: require('../db'), now: () => Date.now(), notify: async () => {}, guard: () => null, flag: async () => {} };
const packs = require('./packs');
const schema = require('./schema');
const refs = require('./refs');
const ledger = require('./ledger');
const inbox = require('./inbox');
const brainLib = require('./brain');
const activity = require('./activity');
const blocks = require('./blocks');
const ctxLib = require('./ctx');
const library = require('./library');
const models = require('./models');
const needs = require('./needs');
const { legalDate } = require('../legal-date');
const crypto = require('crypto');
const { clip, scrubKeys, scrubError } = require('./text');

const env = (key, fallback) => (process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key]);
const TERMINAL = new Set(['done', 'failed', 'stopped']);
const MAX_OUTPUT_BYTES = 256 * 1024;
const TIMELINE_MAX = 300;
const KEEP_DAYS = 180;
// A deleted account's OKs to a Terms line are kept this long, with its email only (Legal L71).
const KEEP_OK_YEARS = 5;

class HarnessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const iso = () => new Date(deps.now()).toISOString();
const paused = () => env('HARNESS_PAUSE', '') === 'on';
const strict = () => env('HARNESS_STRICT', process.env.NODE_ENV === 'test' ? 'on' : '') === 'on';
// A step's error as the member sees it, with any key a server echoed hidden.
const message = (err) => clip(scrubKeys((err && err.message) || String(err || 'Something went wrong.')), 400);

function semaphore(n) {
  let active = 0;
  const waiting = [];
  return {
    async take() {
      if (active < n) {
        active += 1;
        return;
      }
      await new Promise((resolve) => waiting.push(resolve));
      active += 1;
    },
    give() {
      active -= 1;
      const next = waiting.shift();
      if (next) next();
    },
  };
}
const lanes = { default: semaphore(Number(env('HARNESS_TOOLS_AT_ONCE', '8'))), render: semaphore(Math.max(1, Number(env('HARNESS_RENDERS_AT_ONCE', '1')) || 1)) };

async function pool(indices, n, fn) {
  let next = 0;
  const worker = async () => {
    while (next < indices.length) {
      const i = indices[next];
      next += 1;
      await fn(i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, indices.length) }, worker));
}

// ---------- the queue ----------

const q = { pending: [], active: new Map(), idle: [] };

function schedule(id) {
  if (q.active.has(id) || q.pending.includes(id)) return;
  q.pending.push(id);
  pump();
}

function pump() {
  const limit = Number(env('HARNESS_RUNS_AT_ONCE', '4'));
  while (q.active.size < limit && q.pending.length) {
    const id = q.pending.shift();
    const ac = new AbortController();
    const p = advance(id, ac.signal)
      .catch(async (err) => {
        console.error(`[harness] run ${id} crashed: ${scrubError(err)}`);
        const run = deps.db.get('runs', id);
        if (run && !TERMINAL.has(run.status)) await finish(run, 'failed', 'Something went wrong on our side. Try again.').catch(() => {});
      })
      .finally(() => {
        q.active.delete(id);
        const run = deps.db.get('runs', id);
        if (run && run.status === 'queued' && !paused()) q.pending.push(id);
        pump();
        if (!q.active.size && !q.pending.length) q.idle.splice(0).forEach((f) => f());
      });
    q.active.set(id, { ac, p });
  }
}

// Resolves when nothing is running or queued (tests and the CLI).
function idle() {
  if (!q.active.size && !q.pending.length) return Promise.resolve();
  return new Promise((resolve) => q.idle.push(resolve));
}

// ---------- helpers ----------

function note(run, step, text) {
  run.timeline = run.timeline || [];
  run.timeline.push({ at: iso(), step: step || null, text: clip(text, 300) });
  if (run.timeline.length > TIMELINE_MAX) run.timeline.splice(0, run.timeline.length - TIMELINE_MAX);
}

const save = (run) => deps.db.save('runs', run);
const stopped = (run, signal) => (signal && signal.aborted) || run.status === 'stopped';

async function finish(run, status, error) {
  if (run.status === 'stopped' && status !== 'stopped') return run;
  run.status = status;
  run.endedAt = iso();
  run.wakeAt = null;
  if (error) run.error = error;
  note(run, null, status === 'done' ? 'Done.' : status === 'failed' ? `Stopped on an error: ${error}` : 'Stopped.');
  await save(run);
  activity.note(run.memberId, { who: activity.whoOf(run.source), kind: 'run', action: status === 'done' ? 'finished' : status === 'failed' ? 'stopped on an error' : 'stopped', what: run.title, ref: run.id });
  try {
    await deps.notify(run, status);
  } catch (err) {
    console.warn('[harness] notify failed:', scrubKeys(err.message));
  }
  return run;
}

function scopeOf(run, user, brain) {
  const steps = {};
  for (const [id, st] of Object.entries(run.steps || {})) if (st.status === 'done' || st.status === 'skipped') steps[id] = st.output;
  return { inputs: run.inputs, steps, brain, member: { id: user.id, firstName: brainLib.firstName(user), tier: ledger.tierOf(user), timezone: (brain.business && brain.business.timezone) || 'America/Chicago' } };
}

const isError = (x) => !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.error === 'string' && Object.keys(x).length === 1;

// A tool's own { error } items are saved and shown like a failed item, so their text is scrubbed the
// same way (a pack may put a server's error, URL and all, in one). Edits a fresh copy in place.
function scrubErrorItems(v, depth = 0) {
  if (!v || typeof v !== 'object' || depth > 6) return v;
  if (isError(v)) v.error = scrubKeys(v.error);
  else for (const k of Object.keys(v)) scrubErrorItems(v[k], depth + 1);
  return v;
}

function labelOf(item, field, i) {
  if (typeof item === 'string') return clip(item, 80);
  if (item && typeof item === 'object') {
    if (field && item[field] !== undefined && item[field] !== null) return clip(String(item[field]), 80);
    for (const k of ['label', 'title', 'name', 'subject', 'company']) if (typeof item[k] === 'string' && item[k]) return clip(item[k], 80);
  }
  return `Item ${i + 1}`;
}
function textField(item, field) {
  if (field) return field;
  for (const k of ['text', 'body', 'message', 'draft']) if (item && typeof item[k] === 'string') return k;
  return 'text';
}
function textOf(item, field) {
  if (typeof item === 'string') return item;
  return item && typeof item === 'object' ? String(item[textField(item, field)] || '') : '';
}
function withText(item, text, field) {
  if (typeof item === 'string') return text;
  return { ...item, [textField(item, field)]: text };
}

function buildSpec(step, scope) {
  const a = step.approve;
  const spec = { title: clip(a.title, 160), note: a.note ? clip(a.note, 400) : '', max: a.max || null, edit: a.edit || null, field: a.field || null };
  if (a.choose !== undefined) {
    const list = refs.resolve(a.choose, scope);
    spec.options = (Array.isArray(list) ? list : [])
      .map((item, i) => ({ key: String(i), label: labelOf(item, a.label, i), detail: a.detail && item && item[a.detail] !== undefined ? clip(String(item[a.detail]), 160) : '', item }))
      .filter((o) => !isError(o.item))
      .slice(0, 200);
  }
  if (a.items !== undefined) {
    const list = refs.resolve(a.items, scope);
    spec.items = (Array.isArray(list) ? list : [])
      .map((item, i) => ({ key: String(i), label: labelOf(item, a.label, i), text: textOf(item, a.field), item }))
      .filter((o) => !isError(o.item))
      .slice(0, 50);
  }
  return spec;
}

function waitLabel(w) {
  const d = Number(w.days) || 0;
  const h = Number(w.hours) || 0;
  if (d && !h) return d === 1 ? '1 day' : `${d} days`;
  const total = d * 24 + h;
  return total === 1 ? '1 hour' : `${total} hours`;
}

// ---------- estimate ----------

function estimate(wf, inputs = {}) {
  const byId = Object.fromEntries(wf.steps.map((s) => [s.id, s]));
  const memo = {};
  const countOfRef = (ref) => {
    const { root, path } = refs.parse(ref);
    if (root === 'inputs') {
      const v = refs.lookup(ref, { inputs });
      return Array.isArray(v) ? v.length : 10;
    }
    const src = byId[root];
    if (!src) return 10;
    if (src.approve) return countOf(src.id);
    if (src.each && !path.length) return countOf(src.id);
    return 10;
  };
  const countOf = (id) => {
    if (memo[id] !== undefined) return memo[id];
    memo[id] = 10;
    const s = byId[id];
    let n = 10;
    if (s.approve && s.approve.choose !== undefined) n = Math.min(s.approve.max || Infinity, countOfRef(s.approve.choose));
    else if (s.approve && s.approve.items !== undefined) n = countOfRef(s.approve.items);
    else if (s.each !== undefined) n = Number.isInteger(s.estimate) ? s.estimate : countOfRef(s.each);
    memo[id] = n;
    return n;
  };
  let credits = 0;
  for (const s of wf.steps) {
    if (!s.tool) continue;
    const t = packs.tool(s.tool);
    if (!t) continue;
    credits += t.credits * (s.each !== undefined ? countOf(s.id) : 1);
  }
  return credits;
}

// ---------- start, answer, stop ----------

// The lines a member agrees to by running a workflow for real (Legal L53, L66, L67): the Terms line of
// the business sources its tool steps need or want while those sources are on (one line for Google and
// OpenStreetMap together, needs.agreeFor), then any line of a tool's own while its `when` source is on.
// Each is keyed by its words as the member reads them, so HQ's Run form can say which lines the member
// saw, and a reworded line is a new version that needs a new OK.
function agreeLines(wf) {
  const sources = new Set();
  const own = new Map();
  for (const s of (wf && wf.steps) || []) {
    const t = s.tool && packs.tool(s.tool);
    if (!t) continue;
    const x = termsOf(t);
    for (const n of x.sources) sources.add(n);
    for (const l of x.own) own.set(l.key, l);
  }
  const out = needs.agreeFor([...sources]).map(keyed);
  for (const l of own.values()) if (!out.some((o) => o.key === l.key)) out.push(l);
  return out;
}

// A line as the member reads it under Run it: {terms} is the word Terms, linked to href.
const seen = (a) => String(a.text).split('{terms}').join('Terms');
// Its key is its version (Legal L71): those words and the link, never the {terms} placeholder. A change to
// the page it links to alone needs no new OK; the OK keeps that page's date beside the key (recordAgreement).
const keyed = (a) => ({ key: crypto.createHash('sha256').update(`${seen(a)}\n${a.href || ''}`).digest('hex').slice(0, 16), text: a.text, href: a.href || '', ...(a.sources ? { sources: a.sources } : {}) });

// What one tool's search brings while its sources are on: the sources it may use, and a line of its own.
// Its own line in a source's words counts as that source (gym.find_gyms carries OpenStreetMap's), so it
// joins the combined line instead of showing twice.
function termsOf(t) {
  const sources = new Set((t.needs || []).concat(t.wants || []).filter((n) => needs.agreeOf(n) && needs.available(n)));
  const own = [];
  const a = t.agree;
  if (a && (!a.when || needs.available(a.when))) {
    const same = Object.keys(needs.NEEDS).find((n) => needs.agreeOf(n) && needs.agreeOf(n).text === a.text && (needs.agreeOf(n).href || '') === (a.href || ''));
    if (same && needs.available(same)) sources.add(same);
    else own.push(keyed(a));
  }
  return { sources: [...sources], own };
}

// Did the run start with the OK this tool's search needs: every source it may use named in a line the
// member agreed to, and its own line among them?
function covers(agreed, t) {
  const named = new Set((agreed || []).flatMap((l) => l.sources || []));
  const keys = new Set((agreed || []).map((l) => l.key));
  const x = termsOf(t);
  return x.sources.every((n) => named.has(n)) && x.own.every((l) => keys.has(l.key));
}

// The business sources a run may have searched for real: the ones named in the lines it started with.
// The AI link reads it to keep Google's details out and give OpenStreetMap its credit (Legal L67).
function searched(run) {
  return run && !run.sample ? [...new Set((run.agreed || []).flatMap((l) => l.sources || []))] : [];
}

const AGREE_FIRST = 'This workflow now searches real businesses. Run it from its page in HQ, and read the line under Run it first.';

// Legal L67 and L71: the member's OK to a line, taken on the workflow's page in HQ the first time they run
// a search under it, and kept: the line word for word as they read it (its key is its version), its link,
// the sources it names, the date of the Terms that day (the /terms page's "Last updated"), when, and that
// run. Never taken anywhere else. Kept 5 years after the account is deleted, with its email only (forget).
async function recordAgreement(user, lines, run) {
  for (const l of lines) {
    const id = `${user.id}:${l.key}`;
    if (deps.db.get('agreements', id)) continue;
    await deps.db.save('agreements', { id, memberId: user.id, key: l.key, text: seen(l), href: l.href, sources: l.sources || [], termsVersion: legalDate(), at: iso(), workflowId: run.workflowId, runId: run.id, via: 'hq' });
  }
}

// The keys of the lines the member has agreed to in HQ. A deleted account's kept OKs have no member.
function agreedKeys(user) {
  return deps.db.filter('agreements', (a) => !!a.memberId && a.memberId === user.id).map((a) => a.key);
}

// Can this workflow start off its page (the AI link, a repeat, Do my day)? Only once the member has
// agreed in HQ to every line it shows now.
function agreedTo(user, wf) {
  const keys = new Set(agreedKeys(user));
  return agreeLines(wf).every((l) => keys.has(l.key));
}

// agreed: the keys of the lines under Run it when the member tapped it on the workflow's page, which
// records their OK. Anywhere else (no `agreed`), their OK from HQ counts if it's to the lines shown now.
// A run that would search real businesses without either doesn't start; a sample run searches nothing,
// so it needs none.
// spendFreeRun: false for a run the member didn't start just now (a repeat), so their one free run
// is only ever spent by their own tap.
async function start(user, workflowId, rawInputs = {}, { sample = false, source = 'hq', spendFreeRun = true, agreed = null } = {}) {
  const wf = packs.workflow(workflowId);
  if (!wf) throw new HarnessError(404, "That workflow doesn't exist.");
  const blocked = deps.guard(user);
  if (blocked) throw new HarnessError(403, blocked);
  // Sample data can stand in for a missing key, but nothing stands in for a video render: without
  // ffmpeg on the server, a workflow that makes video would stop at that step (and spend a free run).
  if (!needs.available('render') && wf.steps.some((s) => s.tool && ((packs.tool(s.tool) || {}).needs || []).includes('render'))) {
    throw new HarnessError(503, "Making videos isn't switched on yet. Pick another workflow for now.");
  }
  const tier = ledger.tierOf(user);
  let freeRun = false;
  if (!packs.allowed(wf, tier)) {
    if (wf.tier === 'builder' && spendFreeRun && ledger.freeRunAvailable(user)) freeRun = true;
    else throw new HarnessError(403, wf.tier === 'circle' ? "This workflow is part of the Founder's Circle." : 'This workflow is part of Builder.');
  }
  const v = schema.validate(wf.inputs, rawInputs || {}, { coerce: true, clip: true });
  if (!v.ok) throw new HarnessError(400, v.text);
  // A file input (format 'asset') must be one of the member's own Library files.
  for (const [k, p] of Object.entries((wf.inputs && wf.inputs.properties) || {})) {
    const many = p.type === 'array' && p.items && p.items.format === 'asset';
    if (p.format !== 'asset' && !many) continue;
    for (const id of [].concat(v.value[k] === undefined ? [] : v.value[k])) {
      if (id !== '' && !library.get(user.id, String(id))) throw new HarnessError(400, `${p.title || k}: that file isn't in your Library.`);
    }
  }
  const lines = sample ? [] : agreeLines(wf);
  const seen = new Set(agreed != null ? [].concat(agreed).map(String) : agreedKeys(user));
  if (lines.some((l) => !seen.has(l.key))) throw new HarnessError(428, AGREE_FIRST);
  const busy = deps.db.filter('runs', (r) => r.memberId === user.id && (r.status === 'queued' || r.status === 'running')).length;
  const maxActive = Number(env('HARNESS_MAX_ACTIVE_RUNS', '3'));
  if (busy >= maxActive) throw new HarnessError(429, `You have ${busy} runs going. Let one finish first.`);
  const credits = estimate(wf, v.value);
  if (!freeRun && credits > ledger.left(user)) {
    // The free run is for a whole workflow, never spent on a small hidden one (a message, an answer).
    if (!wf.hidden && spendFreeRun && ledger.freeRunAvailable(user)) freeRun = true;
    else throw new HarnessError(402, `This run needs about ${credits} credits and you have ${ledger.left(user)} left this month.`);
  }
  const run = {
    memberId: user.id,
    workflowId: wf.id,
    pack: wf.pack,
    title: wf.title,
    status: 'queued',
    inputs: v.value,
    sample: !!sample,
    freeRun,
    source,
    // The lines this run searches under, with the sources each names (Legal L66, L67).
    ...(lines.length ? { agreed: lines } : {}),
    steps: {},
    timeline: [],
    cursor: 0,
    credits: { estimate: credits, used: 0 },
    usd: 0,
  };
  await save(run);
  if (agreed != null && source === 'hq' && lines.length) await recordAgreement(user, lines, run);
  if (freeRun) await ledger.useFreeRun(user, run.id);
  note(run, null, freeRun ? 'Started. This run is on us.' : 'Started.');
  await save(run);
  activity.note(user, { who: activity.whoOf(source), kind: 'run', action: 'started', what: `${wf.title}${sample ? ' (sample data)' : ''}, about ${credits} credits`, ref: run.id });
  if (!paused()) schedule(run.id);
  return run;
}

function get(user, runId) {
  const run = deps.db.get('runs', runId);
  return run && run.memberId === user.id ? run : null;
}

function list(user, { status, limit = 50 } = {}) {
  return deps.db
    .filter('runs', (r) => r.memberId === user.id && (!status || (Array.isArray(status) ? status.includes(r.status) : r.status === status)))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

// answer: { approved: true|false, chosen: [keys], items: { key: editedText } }; who: for the Activity log
async function answer(user, runId, stepId, ans = {}, { who = 'you' } = {}) {
  const run = get(user, runId);
  if (!run) throw new HarnessError(404, "That run doesn't exist.");
  const wf = packs.workflow(run.workflowId);
  const step = wf && wf.steps.find((s) => s.id === stepId);
  const st = run.steps[stepId];
  if (!step || !step.approve || !st || st.status !== 'waiting') throw new HarnessError(409, 'This was already answered.');
  const spec = st.spec || {};
  const skip = ans.approved === false || ans.approved === 'false';
  let output;
  if (skip) output = { approved: false, chosen: [], items: [] };
  else {
    let chosen = [];
    if (spec.options) {
      const raw = Array.isArray(ans.chosen) ? ans.chosen : ans.chosen !== undefined && ans.chosen !== null ? [ans.chosen] : [];
      const keys = new Set(raw.map(String));
      const picked = spec.options.filter((o) => keys.has(o.key));
      if (!picked.length) throw new HarnessError(400, 'Pick at least one.');
      if (spec.max && picked.length > spec.max) throw new HarnessError(400, `Pick up to ${spec.max}.`);
      chosen = picked.map((o) => o.item);
    }
    let items = [];
    if (spec.items) {
      const edits = ans.items && typeof ans.items === 'object' ? ans.items : {};
      items = spec.items.map((it) => (spec.edit === 'text' && typeof edits[it.key] === 'string' ? withText(it.item, String(edits[it.key]).replace(/\r\n/g, '\n').slice(0, 10000), spec.field) : it.item));
    }
    output = { approved: true, chosen, items };
  }
  Object.assign(st, { status: 'done', output, endedAt: iso(), spec: { title: spec.title } });
  await inbox.close(run.id, stepId, 'answered');
  activity.note(user, { who, kind: 'approval', action: skip ? 'skipped' : 'approved', what: `${spec.title || step.title || 'A step'} in ${run.title}${output.chosen.length ? ` (${output.chosen.length} picked)` : ''}`, ref: run.id });
  if (skip && !step.optional) {
    note(run, stepId, `You skipped "${spec.title}", so the run stopped here.`);
    return finish(run, 'stopped');
  }
  note(run, stepId, skip ? `Skipped "${spec.title}".` : output.chosen.length ? `You picked ${output.chosen.length}.` : 'You said yes.');
  run.status = 'queued';
  await save(run);
  if (!paused()) schedule(run.id);
  return run;
}

async function cancel(user, runId) {
  const run = get(user, runId);
  if (!run) throw new HarnessError(404, "That run doesn't exist.");
  if (TERMINAL.has(run.status)) return run;
  run.status = 'stopped';
  run.endedAt = iso();
  const a = q.active.get(run.id);
  if (a) a.ac.abort(new Error('Stopped.'));
  const i = q.pending.indexOf(run.id);
  if (i >= 0) q.pending.splice(i, 1);
  await inbox.close(run.id, null, 'closed');
  note(run, null, 'You stopped this run.');
  await save(run);
  return run;
}

// Try a failed run again from the step that failed. Items that worked aren't redone.
async function retry(user, runId) {
  const run = get(user, runId);
  if (!run) throw new HarnessError(404, "That run doesn't exist.");
  if (run.status !== 'failed') throw new HarnessError(409, 'Only a run that stopped on an error can be tried again.');
  for (const st of Object.values(run.steps)) {
    if (st.status !== 'failed') continue;
    st.status = 'pending';
    delete st.error;
    delete st.demo;
    if (Array.isArray(st.items)) st.items = st.items.map((it) => (it.status === 'failed' ? { status: 'pending' } : it));
  }
  run.status = 'queued';
  run.error = null;
  run.endedAt = null;
  note(run, null, 'Trying again.');
  await save(run);
  if (!paused()) schedule(run.id);
  return run;
}

// Skip the rest of a `wait` step.
async function wake(user, runId) {
  const run = get(user, runId);
  if (!run) throw new HarnessError(404, "That run doesn't exist.");
  if (run.status !== 'sleeping') return run;
  for (const st of Object.values(run.steps)) if (st.status === 'sleeping') st.wakeAt = deps.now();
  run.status = 'queued';
  run.wakeAt = null;
  note(run, null, 'Picked up early.');
  await save(run);
  if (!paused()) schedule(run.id);
  return run;
}

// ---------- advancing a run ----------

async function advance(runId, signal) {
  const run = deps.db.get('runs', runId);
  if (!run || TERMINAL.has(run.status) || run.status === 'waiting') return;
  if (paused()) return;
  const wf = packs.workflow(run.workflowId);
  if (!wf) return finish(run, 'failed', 'This workflow is no longer available.');
  const user = deps.db.get('users', run.memberId);
  if (!user) return finish(run, 'stopped');
  if (run.status === 'sleeping' && run.wakeAt && run.wakeAt > deps.now()) return;
  run.status = 'running';
  run.startedAt = run.startedAt || iso();
  await save(run);
  const brain = brainLib.snapshot(user);

  for (let i = run.cursor || 0; i < wf.steps.length; i++) {
    if (stopped(run, signal)) return;
    const blocked = deps.guard(user);
    if (blocked) {
      note(run, null, blocked);
      return finish(run, 'stopped');
    }
    const step = wf.steps[i];
    const st = (run.steps[step.id] = run.steps[step.id] || { status: 'pending' });
    if (st.status === 'done' || st.status === 'skipped') {
      run.cursor = i + 1;
      continue;
    }
    const scope = scopeOf(run, user, brain);

    if (step.when !== undefined && st.status === 'pending' && !refs.resolve(step.when, scope)) {
      Object.assign(st, { status: 'skipped', output: null, endedAt: iso() });
      run.cursor = i + 1;
      await save(run);
      continue;
    }

    if (step.approve) {
      if (st.status !== 'waiting') {
        const spec = buildSpec(step, scope);
        const empty = (spec.options && !spec.options.length) || (spec.items !== undefined && !spec.items.length && !spec.options);
        if (empty) {
          if (step.optional) {
            Object.assign(st, { status: 'skipped', output: null, endedAt: iso() });
            run.cursor = i + 1;
            await save(run);
            continue;
          }
          Object.assign(st, { status: 'failed', error: 'There was nothing to choose from. The steps before this one came back empty.' });
          return finish(run, 'failed', st.error);
        }
        Object.assign(st, { status: 'waiting', spec, startedAt: iso() });
        const item = await inbox.open({ memberId: run.memberId, runId: run.id, stepId: step.id, title: spec.title, note: spec.note, workflow: wf.title, count: (spec.options || spec.items || []).length });
        st.inboxId = item.id;
        note(run, step.id, `Waiting on you: ${spec.title}`);
      }
      run.status = 'waiting';
      await save(run);
      try {
        await deps.notify(run, 'waiting', { step: step.id, title: st.spec && st.spec.title });
      } catch (err) {
        console.warn('[harness] notify failed:', scrubKeys(err.message));
      }
      return;
    }

    if (step.wait) {
      if (!st.wakeAt) {
        const ms = ((Number(step.wait.days) || 0) * 24 + (Number(step.wait.hours) || 0)) * 3600 * 1000;
        Object.assign(st, { status: 'sleeping', startedAt: iso(), wakeAt: deps.now() + ms });
        note(run, step.id, `Waiting ${waitLabel(step.wait)}. This picks up on its own.`);
      }
      if (deps.now() < st.wakeAt) {
        run.status = 'sleeping';
        run.wakeAt = st.wakeAt;
        await save(run);
        return;
      }
      Object.assign(st, { status: 'done', output: { waited: true }, endedAt: iso() });
      run.wakeAt = null;
      run.cursor = i + 1;
      await save(run);
      continue;
    }

    await runTool(run, step, st, user, brain, scope, signal);
    if (stopped(run, signal)) return;
    if (st.status === 'failed') {
      if (!step.optional) return finish(run, 'failed', st.error);
      note(run, step.id, 'That step had an error, so it was skipped and the rest goes on.');
      st.output = null;
    }
    run.cursor = i + 1;
    await save(run);
  }
  return finish(run, 'done');
}

async function runTool(run, step, st, user, brain, scope, signal) {
  const tool = packs.tool(step.tool);
  st.status = 'running';
  st.startedAt = st.startedAt || iso();
  delete st.error;
  if (tool.risk === 'act') {
    const ap = run.steps[step.approvedBy];
    if (!ap || !ap.output || ap.output.approved !== true) {
      st.status = 'failed';
      st.error = 'This step needs your OK first.';
      return;
    }
  }
  await save(run);

  if (step.each === undefined) {
    try {
      st.output = await callTool(run, step, tool, refs.resolve(step.input || {}, scope), user, brain, signal);
      st.status = 'done';
      st.sample = !!(st.output && st.output.sample) || !!st.demo;
      await flagged(user, run, step, st.output);
    } catch (err) {
      st.status = 'failed';
      st.error = message(err);
    }
    st.endedAt = iso();
    return;
  }

  const list = refs.resolve(step.each, scope);
  const maxEach = Number(env('HARNESS_MAX_EACH', '100'));
  if (!Array.isArray(list)) {
    st.status = 'failed';
    st.error = "The step before this one didn't return a list.";
    return;
  }
  if (list.length > maxEach) {
    st.status = 'failed';
    st.error = `That's ${list.length} items. One step can take ${maxEach} at most.`;
    return;
  }
  if (!Array.isArray(st.items) || st.items.length !== list.length) st.items = list.map(() => ({ status: 'pending' }));
  const todo = st.items.map((it, i) => (it.status === 'done' || it.status === 'failed' ? -1 : i)).filter((i) => i >= 0);
  const finished = () => st.items.filter((x) => x.status === 'done' || x.status === 'failed').length;
  st.progress = { done: finished(), total: list.length };
  await pool(todo, Math.min(step.concurrency || 3, 8), async (i) => {
    if (stopped(run, signal)) return;
    const item = list[i];
    if (isError(item)) st.items[i] = { status: 'failed', error: scrubKeys(item.error) };
    else {
      st.items[i] = { status: 'running' };
      try {
        const out = await callTool(run, step, tool, refs.resolve(step.input || {}, { ...scope, item, index: i }), user, brain, signal, i);
        st.items[i] = { status: 'done', output: out };
        await flagged(user, run, step, out);
      } catch (err) {
        st.items[i] = { status: 'failed', error: message(err) };
      }
    }
    st.progress = { done: finished(), total: list.length };
    await save(run);
  });
  if (stopped(run, signal)) return;
  const ok = st.items.filter((it) => it.status === 'done').length;
  st.output = st.items.map((it) => (it.status === 'done' ? it.output : { error: it.error || "Didn't run." }));
  st.sample = st.items.some((it) => it.output && it.output.sample) || !!st.demo;
  st.items = st.items.map((it) => (it.status === 'failed' ? { status: 'failed', error: it.error } : { status: it.status }));
  if (!ok && list.length) {
    st.status = 'failed';
    st.error = (st.items.find((it) => it.error) || {}).error || 'Every item failed.';
  } else st.status = 'done';
  if (list.length) note(run, step.id, `${tool.title}: ${ok} of ${list.length} done.`);
  st.endedAt = iso();
}

async function flagged(user, run, step, out) {
  if (!out || !Array.isArray(out.flags) || !out.flags.length) return;
  try {
    await deps.flag(user, run, step.id, out);
  } catch (err) {
    console.warn('[harness] flag hook failed:', scrubKeys(err.message));
  }
}

function aborted(signal) {
  return new Promise((_, reject) => {
    if (signal.aborted) return reject(signal.reason || new Error('Stopped.'));
    signal.addEventListener('abort', () => reject(signal.reason || new Error('Stopped.')), { once: true });
  });
}

async function callTool(run, step, tool, rawInput, user, brain, signal, index) {
  const v = schema.validate(tool.input, rawInput, { coerce: true, clip: true });
  if (!v.ok) throw new Error(`${tool.title} got input it can't use. ${v.text}`);
  if (!run.freeRun && tool.credits > 0 && ledger.left(user) < tool.credits) throw new Error("You're out of credits for this month.");
  // Never a real search without its line read: a run started before the source went on stops here.
  const live = !run.sample && !(tool.needs || []).some((n) => !needs.available(n, user));
  if (live && !covers(run.agreed, tool)) throw new Error(AGREE_FIRST);
  const lane = lanes[tool.lane === 'render' || (tool.needs || []).includes('render') ? 'render' : 'default'];
  await lane.take();
  const ac = new AbortController();
  const limitMs = Math.min(tool.timeoutSec || 120, 900) * 1000;
  const timer = setTimeout(() => ac.abort(new Error(`${tool.title} took too long and was stopped.`)), limitMs);
  const onAbort = () => ac.abort(new Error('Stopped.'));
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  const st = run.steps[step.id];
  let demo = false;
  const ctx = ctxLib.make({
    user,
    run,
    step,
    tool,
    pack: tool.pack,
    index,
    signal: ac.signal,
    brain,
    hooks: {
      log: (text) => note(run, step.id, text),
      progress: (done, total) => {
        if (step.each === undefined) st.progress = { done, total };
      },
      cost: async (usd, what, meta) => {
        if (meta && meta.sample) {
          st.demo = true; // an AI answer was a stand-in (no key): the step's output is a sample
          demo = true;
          return;
        }
        run.usd = Math.round(((run.usd || 0) + (usd || 0)) * 1e6) / 1e6;
        st.usd = Math.round(((st.usd || 0) + (usd || 0)) * 1e6) / 1e6;
        if (meta && meta.model) {
          st.models = st.models || {};
          const label = models.label(meta.model);
          st.models[label] = (st.models[label] || 0) + 1;
        }
        await ledger.cost(user, usd, { tool: tool.name });
      },
    },
  });
  try {
    const out = await Promise.race([Promise.resolve().then(() => tool.run(v.value, ctx)), aborted(ac.signal)]);
    const json = JSON.stringify(out === undefined ? null : out);
    if (json.length > MAX_OUTPUT_BYTES) throw new Error(`${tool.title} returned too much data. Big results belong in a file (ctx.save).`);
    const value = scrubErrorItems(JSON.parse(json));
    const check = schema.validate(tool.output, value);
    if (!check.ok) {
      if (strict()) throw new Error(`${tool.title} returned something unexpected. ${check.text}`);
      console.warn(`[harness] ${tool.name} output doesn't match its schema: ${scrubKeys(check.text)}`);
    }
    // Sample output (no key, AI off, or an admin's sample run) costs no credits, like a failed step.
    if (!ctx.sample && !demo && !(value && value.sample === true)) {
      await ledger.charge(user, tool.credits, { tool: tool.name, free: !!run.freeRun });
      run.credits.used += tool.credits;
    }
    return value;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
    lane.give();
    ctx._cleanup();
  }
}

// ---------- the tick ----------

// Wakes sleeping runs and picks up runs a restart interrupted. Reads memory only; writes only when
// there's work, so it never keeps the database awake on its own.
async function tick() {
  if (paused()) return;
  const now = deps.now();
  for (const r of deps.db.filter('runs', (x) => x.status === 'sleeping' && x.wakeAt && x.wakeAt <= now)) {
    r.status = 'queued';
    await save(r);
    schedule(r.id);
  }
  for (const r of deps.db.filter('runs', (x) => (x.status === 'queued' || x.status === 'running') && !q.active.has(x.id) && !q.pending.includes(x.id))) schedule(r.id);
}

// Daily, whether or not HQ v2 is on: a deleted account's OKs go 5 years after the deletion (Legal L71).
async function purgeAgreements() {
  const now = iso();
  let n = 0;
  for (const a of deps.db.filter('agreements', (x) => !x.memberId && !!x.retainUntil && String(x.retainUntil) <= now)) {
    await deps.db.remove('agreements', a.id);
    n += 1;
  }
  return n;
}

// Daily: finished runs older than 180 days go (their files stay in the Library).
async function sweep() {
  const cutoff = new Date(deps.now() - KEEP_DAYS * 864e5).toISOString();
  for (const r of deps.db.filter('runs', (x) => TERMINAL.has(x.status) && !x.keep && String(x.endedAt || x.updatedAt) < cutoff)) {
    for (const i of deps.db.filter('inbox', (x) => x.runId === r.id)) await deps.db.remove('inbox', i.id);
    await deps.db.remove('runs', r.id);
  }
}

// "Delete this run" (Legal L73): the run, its answers, results and log, the files it made and its Inbox
// cards go now. A run still going stops first, and its step is let finish so nothing saves after.
// Files the member added to their Library, leads it saved to the Pipeline, a repeat made from it and the
// credits it used stay. Returns how many of its files went.
async function remove(user, runId) {
  const run = get(user, runId);
  if (!run) throw new HarnessError(404, "That run doesn't exist.");
  const a = q.active.get(run.id);
  if (a) {
    a.ac.abort(new Error('Stopped.'));
    await Promise.race([a.p, new Promise((r) => setTimeout(r, 15000))]);
  }
  const i = q.pending.indexOf(run.id);
  if (i >= 0) q.pending.splice(i, 1);
  for (const item of deps.db.filter('inbox', (x) => x.runId === run.id)) await deps.db.remove('inbox', item.id);
  let files = 0;
  for (const f of deps.db.filter('assets', (x) => x.runId === run.id && x.memberId === run.memberId)) {
    await deps.db.removeBlob(f.id);
    await deps.db.remove('assets', f.id);
    files += 1;
  }
  const ex = deps.db.get('harnessCache', `showcase:${run.workflowId}`);
  if (ex && ex.value && ex.value.runId === run.id) await deps.db.remove('harnessCache', ex.id);
  await deps.db.remove('runs', run.id);
  activity.note(user, { kind: 'run', action: 'deleted', what: `${run.title}, with its results and ${files} file${files === 1 ? '' : 's'}` });
  return { files };
}

// ---------- what screens and the AI link see ----------

function stepTitle(s) {
  if (s.title) return s.title;
  if (s.tool) {
    const t = packs.tool(s.tool);
    return t ? t.title : s.tool;
  }
  if (s.approve) return s.approve.title;
  return `Wait ${waitLabel(s.wait)}`;
}

function stepBlocks(s, st) {
  if (st.status !== 'done' || !s.tool) return [];
  const tool = packs.tool(s.tool);
  if (!tool) return [];
  if (s.each === undefined) return blocks.view(tool, st.output);
  const outs = Array.isArray(st.output) ? st.output : [];
  if (typeof tool.viewMany === 'function') {
    try {
      return blocks.clean(tool.viewMany(outs.filter((o) => !isError(o))));
    } catch (err) {
      console.warn(`[harness] viewMany of ${tool.name} failed: ${scrubKeys(err.message)}`);
    }
  }
  const out = [];
  outs.slice(0, 12).forEach((o) => out.push(...blocks.view(tool, o)));
  const failed = outs.filter(isError).length;
  if (outs.length > 12) out.push({ type: 'text', text: `And ${outs.length - 12} more.` });
  if (failed) out.push({ type: 'text', text: `${failed} of ${outs.length} didn't work.` });
  return out;
}

function publicSpec(spec) {
  if (!spec) return null;
  return {
    title: spec.title,
    note: spec.note || '',
    max: spec.max || null,
    edit: spec.edit || null,
    options: spec.options ? spec.options.map((o) => ({ key: o.key, label: o.label, detail: o.detail || '' })) : null,
    items: spec.items ? spec.items.map((o) => ({ key: o.key, label: o.label, text: o.text })) : null,
  };
}

function view(run) {
  const wf = packs.workflow(run.workflowId);
  const steps = (wf ? wf.steps : []).map((s) => {
    const st = run.steps[s.id] || { status: 'pending' };
    return {
      id: s.id,
      kind: s.tool ? 'tool' : s.approve ? 'approve' : 'wait',
      title: stepTitle(s),
      status: st.status,
      error: st.error || null,
      progress: st.progress || null,
      sample: !!st.sample,
      wakeAt: st.wakeAt ? new Date(st.wakeAt).toISOString() : null,
      models: st.models || null,
      blocks: stepBlocks(s, st),
      ask: st.status === 'waiting' ? publicSpec(st.spec) : null,
    };
  });
  const result = wf && run.status === 'done' ? (wf.result || []).flatMap((id) => (steps.find((s) => s.id === id) || {}).blocks || []) : [];
  return {
    id: run.id,
    workflowId: run.workflowId,
    title: run.title,
    promise: wf ? wf.promise : '',
    status: run.status,
    error: run.error || null,
    sample: !!run.sample || steps.some((s) => s.sample),
    freeRun: !!run.freeRun,
    credits: run.credits,
    createdAt: run.createdAt,
    endedAt: run.endedAt || null,
    wakeAt: run.wakeAt ? new Date(run.wakeAt).toISOString() : null,
    steps,
    waitingOn: steps.find((s) => s.status === 'waiting') || null,
    result,
    next: wf ? (wf.next || []).filter((id) => packs.workflow(id)) : [],
    timeline: (run.timeline || []).slice(-60),
  };
}

// What our own cost was, per step and model: the "Under the hood" sheet.
function costs(run) {
  return Object.entries(run.steps || {}).map(([id, st]) => ({ step: id, usd: st.usd || 0, models: st.models || {} }));
}

// Account deletion: the member's runs go. Their OKs to Terms lines stay 5 years (Legal L71), each with only
// the OK (the line as they read it, its link and sources, the Terms date, when) and the account's email: no
// member id, workflow or run. purgeAgreements deletes them after that. keepAgreements: false (a close for
// age, which keeps only its own record, lib/age-check.js) deletes them now.
async function forget(userId, { email = '', keepAgreements = true } = {}) {
  for (const r of deps.db.filter('runs', (x) => x.memberId === userId)) {
    // Stop a step that's going and let it finish, so nothing saves the run again after (Legal L74).
    const a = q.active.get(r.id);
    if (a) {
      a.ac.abort(new Error('Stopped.'));
      await Promise.race([a.p, new Promise((res) => setTimeout(res, 15000))]);
    }
    const i = q.pending.indexOf(r.id);
    if (i >= 0) q.pending.splice(i, 1);
    for (const item of deps.db.filter('inbox', (x) => x.runId === r.id)) await deps.db.remove('inbox', item.id);
    await deps.db.remove('runs', r.id);
  }
  const deletedAt = iso();
  const until = new Date(deps.now());
  until.setUTCFullYear(until.getUTCFullYear() + KEEP_OK_YEARS);
  for (const a of deps.db.filter('agreements', (x) => !!x.memberId && x.memberId === userId)) {
    if (keepAgreements) {
      // Saved before the member's row goes, under an id that's the same if deletion runs again.
      const id = `kept-${crypto.createHash('sha256').update(`${email}\n${a.key}\n${a.at}`).digest('hex').slice(0, 24)}`;
      await deps.db.save('agreements', { id, email: String(email || ''), key: a.key, text: a.text, href: a.href, sources: a.sources || [], termsVersion: a.termsVersion || null, at: a.at, via: a.via, deletedAt, retainUntil: until.toISOString() });
    }
    await deps.db.remove('agreements', a.id);
  }
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { agreeLines, agreedTo, searched, start, answer, cancel, retry, wake, remove, get, list, view, costs, estimate, tick, sweep, purgeAgreements, idle, forget, HarnessError, _setDeps, _queue: q };
