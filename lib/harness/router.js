// The model router. Tools say what kind of call they're making (`task`), never which model, and
// this file picks the model and effort. One map, so Eli can change it without touching packs:
//   HARNESS_MODEL_<TASK>=claude-sonnet-5-5   HARNESS_EFFORT_<TASK>=medium   (TASK in capitals)
//
// Rules, in order:
// 1. The task's default pick (TASKS below).
// 2. Tier: `deep` (Fable 5.1) is Circle only; Free and Builder get Opus 5.5 at medium effort.
// 3. Budget: a member whose AI cost this month is past their tier's soft cap gets the cheaper
//    rung for write, plan and vision (Sonnet 5.5), and Opus 5.5 for deep. Nothing is refused here:
//    credits are the hard limit, this only keeps cost in line.
// 4. Escalation: if an answer that must match a schema doesn't, the call is retried once on the
//    next model up (Haiku -> Sonnet -> Opus; Fable only for Circle).
// Route per job, not per message: a run keeps one model per task, so prompt caches stay warm.

const models = require('./models');

const env = (key, fallback) => (process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key]);
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

const TASKS = {
  classify: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 2000, why: 'Labels, yes or no, routing: the fastest model is as good here and costs a fortieth as much.' },
  extract: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 6000, why: 'Pulling fields out of text, pages or screenshots.' },
  score: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 3000, batchable: true, why: 'Rating many items against a rubric: cheap per item.' },
  write: { model: 'claude-opus-5-5', effort: 'low', maxTokens: 8000, why: 'Anything a person reads or sends. Quality matters more than cost.' },
  vision: { model: 'claude-opus-5-5', effort: 'low', maxTokens: 6000, why: 'Reading images and video frames.' },
  plan: { model: 'claude-opus-5-5', effort: 'medium', maxTokens: 12000, why: 'Offers, pricing, strategy and forecasts explained: more thinking pays off.' },
  deep: { model: 'claude-fable-5-1', effort: 'medium', maxTokens: 24000, tiers: ['circle'], why: 'The hardest reasoning, used rarely. Circle only.' },
};

// Monthly AI cost (USD) past which a member's write, plan and vision calls step down a rung.
const SOFT_CAP = {
  free: Number(env('HARNESS_SOFT_CAP_FREE', '0.5')),
  builder: Number(env('HARNESS_SOFT_CAP_BUILDER', '8')),
  circle: Number(env('HARNESS_SOFT_CAP_CIRCLE', '40')),
};
const DOWNSHIFT = { write: 'claude-sonnet-5-5', plan: 'claude-sonnet-5-5', vision: 'claude-sonnet-5-5', deep: 'claude-opus-5-5' };

const tierOf = (t) => (t === 'builder' || t === 'circle' ? t : 'free');
const maxRankFor = (tier) => (tierOf(tier) === 'circle' ? 4 : 3);

function override(task) {
  const key = task.toUpperCase();
  const model = env(`HARNESS_MODEL_${key}`, '');
  const effort = env(`HARNESS_EFFORT_${key}`, '');
  return {
    model: model && models.known(model) ? model : null,
    effort: effort && EFFORTS.includes(effort) ? effort : null,
  };
}

// route({ task, tier, spentUsd }) -> { task, model, effort, maxTokens, provider, why, notes: [] }
function route({ task = 'write', tier = 'free', spentUsd = 0 } = {}) {
  const t = TASKS[task] ? task : 'write';
  const base = TASKS[t];
  const notes = [];
  let model = base.model;
  let effort = base.effort;
  const o = override(t);
  if (o.model) {
    model = o.model;
    notes.push(`set by HARNESS_MODEL_${t.toUpperCase()}`);
  }
  if (o.effort) effort = o.effort;
  if (base.tiers && !base.tiers.includes(tierOf(tier)) && models.get(model).rank > 3) {
    model = 'claude-opus-5-5';
    effort = 'medium';
    notes.push('deep reasoning on Fable 5.1 is part of the Circle; Opus 5.5 instead');
  }
  if (models.get(model).rank > maxRankFor(tier)) model = 'claude-opus-5-5';
  const cap = SOFT_CAP[tierOf(tier)];
  if (cap > 0 && spentUsd >= cap && DOWNSHIFT[t] && models.get(DOWNSHIFT[t]).rank < models.get(model).rank) {
    model = DOWNSHIFT[t];
    notes.push(`past this month's soft cap ($${cap}), so a lighter model`);
  }
  return { task: t, model, effort, maxTokens: base.maxTokens, provider: models.get(model).provider, why: base.why, notes };
}

// The next model up for a retry, or null.
function escalate(r, tier = 'free') {
  const next = models.above(r.model, maxRankFor(tier));
  if (!next) return null;
  return { ...r, model: next, provider: models.get(next).provider, notes: [...(r.notes || []), `retried on ${models.label(next)} after an answer that didn't fit`] };
}

// Typical sizes per call, for estimates on the Run button and the cost table in the plan.
const TYPICAL = { classify: [800, 150], extract: [3000, 600], score: [2500, 400], write: [3000, 900], vision: [2500, 500], plan: [5000, 2500], deep: [12000, 6000] };

function estimate(task, tier = 'free', [inTokens, outTokens] = TYPICAL[task] || TYPICAL.write) {
  const r = route({ task, tier });
  return { model: r.model, usd: models.estimate(r.model, inTokens, outTokens) };
}

// The whole map, for the admin page and the "Under the hood" sheet.
function explain(tier = 'builder') {
  return Object.keys(TASKS).map((task) => {
    const r = route({ task, tier });
    const e = estimate(task, tier);
    return { task, model: r.model, label: models.label(r.model), effort: r.effort, usd: e.usd, why: r.why, notes: r.notes };
  });
}

// The Ask bar's first guess at what kind of request this is, before any AI call. Cheap and
// deterministic; the Ask bar can confirm with a `classify` call when it's unsure.
function guessTask(text, { images = 0 } = {}) {
  const s = String(text || '').toLowerCase();
  if (images > 0) return 'vision';
  if (/\b(forecast|cash ?flow|runway|break[- ]?even|pric(e|ing)|strategy|plan|budget|margin|profit)\b/.test(s)) return 'plan';
  if (/\b(rank|score|rate|compare|which is best|grade)\b/.test(s)) return 'score';
  if (/\b(extract|pull out|list (all|every)|summari[sz]e|from this (page|site|pdf))\b/.test(s)) return 'extract';
  if (/\b(is this|yes or no|should i (use|pick)|which (one|category))\b/.test(s) && s.length < 160) return 'classify';
  return 'write';
}

module.exports = { TASKS, SOFT_CAP, route, escalate, estimate, explain, guessTask, tierOf };
