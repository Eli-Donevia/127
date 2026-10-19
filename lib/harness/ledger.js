// Credits: what members see instead of dollars. Each tool call costs its `credits` (per item in an
// `each` step); the monthly allowance resets on the 1st (UTC). We also keep what each member's runs
// cost us in dollars (AI, paid data, rendering), so pricing and the router's soft caps can be checked.
// Proposed allowances, Eli's call (v2/harness/DECISIONS.md): Free 50, Builder 1,000, Circle 3,000.
// HARNESS_CREDITS_FREE / _BUILDER / _CIRCLE change them. Free members also get one full workflow run
// on us (HARNESS_FREE_RUN=off turns that off).

const deps = { db: require('../db'), now: () => Date.now() };
const env = (key, fallback) => (process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key]);

const tierOf = (user) => (user && (user.tier === 'builder' || user.tier === 'circle') ? user.tier : 'free');

function allowances() {
  return {
    free: Number(env('HARNESS_CREDITS_FREE', '50')),
    builder: Number(env('HARNESS_CREDITS_BUILDER', '1000')),
    circle: Number(env('HARNESS_CREDITS_CIRCLE', '3000')),
  };
}

function month(ms = deps.now()) {
  return new Date(ms).toISOString().slice(0, 7);
}

function docFor(userId, m = month()) {
  return deps.db.get('credits', `${userId}:${m}`) || { id: `${userId}:${m}`, memberId: userId, month: m, used: 0, usd: 0, calls: 0, byTool: {} };
}

function allowance(user) {
  return allowances()[tierOf(user)] || 0;
}

function usage(user) {
  const d = docFor(user.id);
  const left = Math.max(0, allowance(user) - d.used);
  return { month: d.month, used: d.used, allowance: allowance(user), left, usd: Math.round(d.usd * 1e4) / 1e4, calls: d.calls };
}

function left(user) {
  return usage(user).left;
}

// The free run: one full workflow run on us, once per member, while it's on.
function freeRunAvailable(user) {
  if (env('HARNESS_FREE_RUN', 'on') === 'off') return false;
  if (tierOf(user) !== 'free') return false;
  return !deps.db.get('credits', `${user.id}:free-run`);
}

async function useFreeRun(user, runId) {
  await deps.db.save('credits', { id: `${user.id}:free-run`, memberId: user.id, runId, usedAt: new Date(deps.now()).toISOString() });
}

// credits: whole number. Runs on the free run record use but don't take from the allowance.
async function charge(user, credits, { tool = 'other', free = false } = {}) {
  const d = docFor(user.id);
  const n = Math.max(0, Math.round(credits || 0));
  if (!free) d.used += n;
  d.calls += 1;
  const t = (d.byTool[tool] = d.byTool[tool] || { calls: 0, credits: 0, usd: 0 });
  t.calls += 1;
  t.credits += n;
  await deps.db.save('credits', d);
  return d;
}

// Our cost in dollars (AI, paid data, rendering). Never shown to members.
async function cost(user, usd, { tool = 'other' } = {}) {
  if (!usd || !Number.isFinite(usd)) return;
  const d = docFor(user.id);
  d.usd = Math.round((d.usd + usd) * 1e6) / 1e6;
  const t = (d.byTool[tool] = d.byTool[tool] || { calls: 0, credits: 0, usd: 0 });
  t.usd = Math.round((t.usd + usd) * 1e6) / 1e6;
  await deps.db.save('credits', d);
}

function spentUsd(user) {
  return docFor(user.id).usd;
}

// Admin view: this month across everyone.
function totals(m = month()) {
  const docs = deps.db.filter('credits', (d) => d.month === m);
  const byTool = {};
  for (const d of docs) {
    for (const [k, v] of Object.entries(d.byTool || {})) {
      const t = (byTool[k] = byTool[k] || { calls: 0, credits: 0, usd: 0 });
      t.calls += v.calls;
      t.credits += v.credits;
      t.usd += v.usd;
    }
  }
  return { month: m, members: docs.length, credits: docs.reduce((a, d) => a + d.used, 0), usd: docs.reduce((a, d) => a + d.usd, 0), byTool };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { allowances, allowance, usage, left, charge, cost, spentUsd, freeRunAvailable, useFreeRun, totals, month, tierOf, _setDeps };
