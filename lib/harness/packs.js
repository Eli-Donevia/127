// Loads packs and checks them against the contract (v2/harness/WORKFLOW-CONTRACT.md). A pack that
// breaks a rule is refused and the reasons are logged; the rest still load. Tools from every pack
// are registered first, so a workflow may use another pack's tools.

const fs = require('fs');
const path = require('path');
const schema = require('./schema');
const cron = require('./cron');
const refs = require('./refs');
const needs = require('./needs');
const router = require('./router');
const { scrubKeys } = require('./text');

const TIERS = ['free', 'builder', 'circle'];
const KINDS = ['code', 'ai', 'api'];
const RISKS = ['read', 'draft', 'act'];
const LANES = ['default', 'render'];
const PACK_ID = /^[a-z0-9-]{2,30}$/;
const STEP_ID = /^[a-z][a-z0-9_]{0,30}$/;
const MAX_STEPS = 30;
const MAX_WAIT_DAYS = 30;

const registry = { packs: new Map(), tools: new Map(), workflows: new Map(), refused: [] };

function checkTool(pack, t, problems) {
  const where = `tool ${t && t.name ? t.name : '(no name)'}`;
  if (!t || typeof t !== 'object') return problems.push('a tool is not an object');
  if (typeof t.name !== 'string' || !new RegExp(`^${pack.id}\\.[a-z0-9_]{2,40}$`).test(t.name)) problems.push(`${where}: name must look like ${pack.id}.verb_noun`);
  if (!t.title || typeof t.title !== 'string') problems.push(`${where}: needs a title`);
  if (!t.description || typeof t.description !== 'string') problems.push(`${where}: needs a description`);
  if (!KINDS.includes(t.kind)) problems.push(`${where}: kind must be ${KINDS.join(', ')}`);
  if (!RISKS.includes(t.risk)) problems.push(`${where}: risk must be ${RISKS.join(', ')}`);
  for (const n of (t.needs || []).concat(t.wants || [])) if (!needs.known(n)) problems.push(`${where}: unknown need "${n}" (ask the Harness thread to add it)`);
  if (t.wants !== undefined && !Array.isArray(t.wants)) problems.push(`${where}: wants must be a list`);
  if (!Number.isInteger(t.credits) || t.credits < 0 || t.credits > 500) problems.push(`${where}: credits must be a whole number from 0 to 500`);
  if (typeof t.run !== 'function') problems.push(`${where}: needs run(input, ctx)`);
  if (t.view !== undefined && typeof t.view !== 'function') problems.push(`${where}: view must be a function`);
  if (t.timeoutSec !== undefined && !(t.timeoutSec > 0 && t.timeoutSec <= 900)) problems.push(`${where}: timeoutSec must be 1 to 900`);
  if (t.lane !== undefined && !LANES.includes(t.lane)) problems.push(`${where}: lane must be ${LANES.join(' or ')}`);
  for (const k of ['input', 'output']) {
    if (!t[k] || t[k].type !== 'object') problems.push(`${where}: ${k} must be an object schema`);
    else for (const p of schema.lint(t[k], `${where} ${k}`)) problems.push(p);
  }
}

function checkRefs(where, tpl, earlier, { inEach }, problems) {
  for (const r of refs.list(tpl)) {
    if (r.root === 'item' || r.root === 'index' || r.path.includes('$index')) {
      if (!inEach) problems.push(`${where}: ${r.ref} only works inside an each step`);
      continue;
    }
    if (refs.RESERVED.has(r.root)) continue;
    if (!earlier.has(r.root)) problems.push(`${where}: ${r.ref} points at a step that doesn't come before it`);
  }
  for (const s of refs.suspicious(tpl)) problems.push(`${where}: "${s}" looks like a reference but isn't one (use $$ for a literal $)`);
}

function checkWorkflow(pack, wf, toolOf, problems) {
  const where = `workflow ${wf && wf.id ? wf.id : '(no id)'}`;
  if (!wf || typeof wf !== 'object') return problems.push('a workflow is not an object');
  if (typeof wf.id !== 'string' || !new RegExp(`^${pack.id}\\.[a-z0-9_]{2,40}$`).test(wf.id)) problems.push(`${where}: id must look like ${pack.id}.name`);
  if (!wf.title) problems.push(`${where}: needs a title`);
  if (!wf.promise) problems.push(`${where}: needs a promise (the card's one line)`);
  if (!(wf.minutes > 0)) problems.push(`${where}: minutes must be the member's honest time`);
  if (!TIERS.includes(wf.tier)) problems.push(`${where}: tier must be ${TIERS.join(', ')}`);
  if (!wf.inputs || wf.inputs.type !== 'object') problems.push(`${where}: inputs must be an object schema`);
  else for (const p of schema.lint(wf.inputs, `${where} inputs`)) problems.push(p);
  if (wf.suggestSchedule !== undefined) {
    const sc = wf.suggestSchedule || {};
    if (!cron.parse(sc.cron)) problems.push(`${where}: suggestSchedule.cron must be minute, hour, day, month and weekday with a set minute and hour, like "0 7 * * 1"`);
    if (typeof sc.label !== 'string' || !sc.label.trim() || sc.label.length > 60) problems.push(`${where}: suggestSchedule needs a label of up to 60 characters, like "Every Monday at 7am"`);
  }
  const steps = Array.isArray(wf.steps) ? wf.steps : [];
  if (!steps.length || steps.length > MAX_STEPS) problems.push(`${where}: needs 1 to ${MAX_STEPS} steps`);
  const earlier = new Set();
  const approvals = new Set();
  for (const s of steps) {
    const sw = `${where} step ${s && s.id}`;
    if (!s || typeof s.id !== 'string' || !STEP_ID.test(s.id) || refs.RESERVED.has(s.id)) {
      problems.push(`${sw}: id must be lowercase letters, digits and _ and not a reserved word`);
      continue;
    }
    if (earlier.has(s.id)) problems.push(`${sw}: duplicate step id`);
    const kinds = ['tool', 'approve', 'wait'].filter((k) => s[k] !== undefined);
    if (kinds.length !== 1) problems.push(`${sw}: needs exactly one of tool, approve or wait`);
    if (s.when !== undefined) checkRefs(`${sw} when`, s.when, earlier, { inEach: false }, problems);
    if (s.tool !== undefined) {
      const t = toolOf(s.tool);
      if (!t) problems.push(`${sw}: unknown tool ${s.tool}`);
      if (s.each !== undefined) {
        if (!refs.isRef(s.each)) problems.push(`${sw}: each must be a reference to a list`);
        else checkRefs(`${sw} each`, s.each, earlier, { inEach: false }, problems);
        if (s.concurrency !== undefined && !(Number.isInteger(s.concurrency) && s.concurrency >= 1 && s.concurrency <= 8)) problems.push(`${sw}: concurrency must be 1 to 8`);
      }
      checkRefs(`${sw} input`, s.input || {}, earlier, { inEach: s.each !== undefined }, problems);
      if (t && t.risk === 'act') {
        if (!s.approvedBy || !approvals.has(s.approvedBy)) problems.push(`${sw}: an act tool must name an earlier approve step in approvedBy`);
        else if (s.each !== undefined && refs.isRef(s.each) && refs.parse(s.each).root !== s.approvedBy) problems.push(`${sw}: an act step's each must come from its approve step (${s.approvedBy})`);
        else if (s.each === undefined) problems.push(`${sw}: an act step must run on the approved items with each: '$${s.approvedBy}.items' or '$${s.approvedBy}.chosen'`);
      }
    }
    if (s.approve !== undefined) {
      const a = s.approve;
      if (!a || !a.title) problems.push(`${sw}: approve needs a title`);
      if (a && a.choose !== undefined) {
        if (!refs.isRef(a.choose)) problems.push(`${sw}: approve.choose must be a reference to a list`);
        checkRefs(`${sw} approve`, a.choose, earlier, { inEach: false }, problems);
        if (a.max !== undefined && !(Number.isInteger(a.max) && a.max >= 1)) problems.push(`${sw}: approve.max must be a whole number`);
      }
      if (a && a.items !== undefined) {
        if (!refs.isRef(a.items)) problems.push(`${sw}: approve.items must be a reference to a list`);
        checkRefs(`${sw} approve`, a.items, earlier, { inEach: false }, problems);
        if (a.edit !== undefined && a.edit !== 'text') problems.push(`${sw}: approve.edit can only be 'text'`);
      }
      if (a && a.choose !== undefined && a.items !== undefined) problems.push(`${sw}: approve takes choose or items, not both`);
      approvals.add(s.id);
    }
    if (s.wait !== undefined) {
      const days = (Number(s.wait.days) || 0) + (Number(s.wait.hours) || 0) / 24;
      if (!(days > 0 && days <= MAX_WAIT_DAYS)) problems.push(`${sw}: wait must be between 1 hour and ${MAX_WAIT_DAYS} days`);
    }
    earlier.add(s.id);
  }
  for (const r of wf.result || []) if (!earlier.has(r)) problems.push(`${where}: result names unknown step ${r}`);
  if (wf.hidden !== undefined && typeof wf.hidden !== 'boolean') problems.push(`${where}: hidden must be true or false`);
  for (const n of wf.next || []) {
    if (typeof n === 'string') continue;
    if (!n || typeof n.id !== 'string' || (n.why !== undefined && typeof n.why !== 'string')) problems.push(`${where}: each next is a workflow id, or { id, why }`);
  }
}

// next may list ids or { id, why }; the registry keeps ids in next and the reasons in nextWhy.
function normalized(wf, packId) {
  const next = [];
  const nextWhy = {};
  for (const n of wf.next || []) {
    const id = typeof n === 'string' ? n : n.id;
    next.push(id);
    if (typeof n === 'object' && n.why) nextWhy[id] = String(n.why).slice(0, 200);
  }
  return { ...wf, next, nextWhy, pack: packId };
}

function checkPack(pack, toolOf) {
  const problems = [];
  if (!pack || typeof pack !== 'object') return ['index.js must export the pack object'];
  if (!PACK_ID.test(String(pack.id || ''))) problems.push('id must be 2 to 30 of a-z, 0-9 and -');
  if (!pack.title) problems.push('needs a title');
  if (!pack.version) problems.push('needs a version');
  if (!Array.isArray(pack.tools)) problems.push('tools must be a list');
  if (pack.workflows !== undefined && !Array.isArray(pack.workflows)) problems.push('workflows must be a list');
  if (pack.business !== undefined && typeof pack.business !== 'boolean') problems.push('business must be true or false');
  if (problems.length) return problems;
  const names = new Set();
  for (const t of pack.tools) {
    checkTool(pack, t, problems);
    if (t && t.name) {
      if (names.has(t.name)) problems.push(`tool ${t.name}: listed twice`);
      names.add(t.name);
    }
  }
  const ids = new Set();
  for (const wf of pack.workflows || []) {
    checkWorkflow(pack, wf, toolOf, problems);
    if (wf && wf.id) {
      if (ids.has(wf.id)) problems.push(`workflow ${wf.id}: listed twice`);
      ids.add(wf.id);
    }
  }
  return problems;
}

// Registers several packs at once: every tool first, then the workflows. Returns { loaded, refused }.
function registerAll(list) {
  const loaded = [];
  const refused = [];
  const candidates = [];
  for (const { pack, source } of list) {
    if (registry.packs.has(pack && pack.id)) {
      refused.push({ source, id: pack.id, problems: [`a pack with id ${pack.id} is already loaded`] });
      continue;
    }
    candidates.push({ pack, source });
  }
  const pendingTools = new Map();
  for (const { pack } of candidates) for (const t of (pack && pack.tools) || []) if (t && t.name) pendingTools.set(t.name, t);
  const toolOf = (name) => registry.tools.get(name) || pendingTools.get(name) || null;
  for (const { pack, source } of candidates) {
    const problems = checkPack(pack, toolOf);
    if (problems.length) {
      refused.push({ source, id: pack && pack.id, problems });
      for (const t of (pack && pack.tools) || []) if (t && t.name) pendingTools.delete(t.name);
      continue;
    }
    registry.packs.set(pack.id, { ...pack, source });
    for (const t of pack.tools) registry.tools.set(t.name, { ...t, pack: pack.id });
    for (const wf of pack.workflows || []) registry.workflows.set(wf.id, normalized(wf, pack.id));
    loaded.push(pack.id);
  }
  // A refused pack's tools were offered to workflows checked in the same batch: drop those workflows.
  for (const [id, wf] of registry.workflows) {
    const missing = wf.steps.filter((s) => s.tool && !registry.tools.has(s.tool)).map((s) => s.tool);
    if (missing.length) {
      registry.workflows.delete(id);
      refused.push({ source: registry.packs.get(wf.pack).source, id: wf.id, problems: [`uses tools from a refused pack: ${missing.join(', ')}`] });
    }
  }
  registry.refused.push(...refused);
  for (const r of refused) console.warn(`[harness] refused ${r.id || r.source}: ${r.problems.slice(0, 8).join('; ')}${r.problems.length > 8 ? ` (+${r.problems.length - 8} more)` : ''}`);
  return { loaded, refused };
}

// 127's own copy in a pack (what Start, the workflow page and the plan show) against the site's copy
// check (lib/copy-check.js: income, guarantees, outcome promises, em dashes...), when it's installed.
// Members' generated work isn't checked: their offers are theirs. For `harness check`.
const copyCheck = () => {
  try {
    return require('../copy-check');
  } catch {
    return null;
  }
};
function copyFindings(pack, cc = copyCheck()) {
  if (!cc || typeof cc.check !== 'function' || !pack) return [];
  const out = [];
  const look = (where, text) => {
    if (!text || typeof text !== 'string') return;
    for (const f of cc.check(text)) if (f.severity === 'block') out.push(`${where}: "${f.match}" (${f.why})`);
  };
  look('pack title', pack.title);
  look('pack summary', pack.summary);
  for (const t of pack.tools || []) if (t) look(`tool ${t.name} title`, t.title);
  for (const wf of pack.workflows || []) {
    if (!wf) continue;
    for (const k of ['title', 'promise', 'proof']) look(`workflow ${wf.id} ${k}`, wf[k]);
    look(`workflow ${wf.id} suggestSchedule`, wf.suggestSchedule && wf.suggestSchedule.label);
    for (const st of wf.steps || []) {
      if (st && st.title) look(`workflow ${wf.id} step ${st.id}`, st.title);
      if (st && st.approve) look(`workflow ${wf.id} step ${st.id}`, st.approve.title);
    }
    for (const [k, p] of Object.entries((wf.inputs && wf.inputs.properties) || {})) {
      look(`workflow ${wf.id} input ${k}`, p && p.title);
      look(`workflow ${wf.id} input ${k}`, p && p.description);
    }
  }
  return out;
}

function register(pack) {
  return registerAll([{ pack, source: 'code' }]);
}

// Every lib/packs/<name>/index.js that exports a pack. Folders starting with _ or without an
// index.js are helpers, not packs.
function loadDir(dir) {
  if (!fs.existsSync(dir)) return { loaded: [], refused: [] };
  const list = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const file = path.join(dir, name, 'index.js');
    if (!fs.existsSync(file)) continue;
    let pack;
    try {
      pack = require(file);
    } catch (err) {
      registry.refused.push({ source: file, problems: [`didn't load: ${scrubKeys(err.message)}`] });
      console.warn(`[harness] pack ${name} didn't load: ${scrubKeys(err.message)}`);
      continue;
    }
    if (!pack || typeof pack !== 'object' || !pack.id) continue; // a helper folder
    list.push({ pack, source: file });
  }
  return registerAll(list);
}

function reset() {
  registry.packs.clear();
  registry.tools.clear();
  registry.workflows.clear();
  registry.refused.length = 0;
}

const tool = (name) => registry.tools.get(name) || null;
const workflow = (id) => registry.workflows.get(id) || null;
const pack = (id) => registry.packs.get(id) || null;

const TIER_RANK = { free: 0, builder: 1, circle: 2 };
function allowed(wf, tier) {
  return (TIER_RANK[router.tierOf(tier)] || 0) >= (TIER_RANK[wf.tier] || 0);
}

function workflows({ tier } = {}) {
  return [...registry.workflows.values()].map((wf) => ({ ...wf, locked: tier ? !allowed(wf, tier) : false }));
}

function tools() {
  return [...registry.tools.values()];
}

module.exports = { register, registerAll, loadDir, reset, tool, workflow, pack, workflows, tools, allowed, checkPack, copyFindings, registry, TIERS };
