// Ask 127's job picker. Before the answer, Haiku reads the member's message and says what kind of
// job it is, so the answer runs on the right model and effort:
//   write  most questions and drafts (Opus 5.5, low effort)
//   plan   offers, pricing, cash, forecasts and strategy (Opus 5.5, more thinking)
//   deep   the hardest reasoning with many moving parts (Fable 5.1 for the Circle; Opus 5.5 otherwise)
// The pick costs about a hundredth of a cent and goes to AI cost, never to the member's credits.
// No key, any error, or HARNESS_JOB_PICKER=off falls back to router.guessTask's keywords.

const llm = require('./llm');
const router = require('./router');
const { clip, scrubKeys } = require('./text');

const JOBS = ['write', 'plan', 'deep'];

const SCHEMA = {
  type: 'object',
  properties: {
    job: { type: 'string', enum: JOBS, description: 'The kind of job.' },
    why: { type: 'string', description: 'A few words: why.' },
  },
  required: ['job', 'why'],
};

const SYSTEM = `You sort a founder's message to their business assistant into one kind of job, so it goes to the right model.
- write: questions, explanations, drafts, messages, posts, edits, quick help. Most messages are this.
- plan: offers, pricing, margins, cash flow, budgets, forecasts, break-even, strategy, choosing between options with trade-offs, a plan for the week or month.
- deep: a hard problem with many moving parts that needs careful step-by-step reasoning, such as restructuring a whole business model or untangling numbers that don't add up. Rare.
Pick the cheapest kind that will do the job well.`;

// The keyword guess, folded onto the jobs Ask 127 can run.
function fallback(text) {
  return router.guessTask(text) === 'plan' ? 'plan' : 'write';
}

function off() {
  return process.env.HARNESS_JOB_PICKER === 'off';
}

// pick(text, { tier, onCost }) -> { task, by: 'ai' | 'keywords', why }
async function pick(text, { tier = 'free', onCost } = {}) {
  const q = clip(String(text || ''), 2000);
  if (off() || !llm.live() || !q.trim()) return { task: fallback(q), by: 'keywords', why: '' };
  try {
    const r = await llm.call({ task: 'classify', tier, system: SYSTEM, prompt: `The message:\n${q}`, schema: SCHEMA, maxTokens: 300, timeoutMs: 15000, onCost });
    const job = r.data && JOBS.includes(r.data.job) ? r.data.job : null;
    if (!job) return { task: fallback(q), by: 'keywords', why: '' };
    // Fable is the Circle's; the router steps others down to Opus at medium effort anyway, which is `plan`.
    return { task: job === 'deep' && router.tierOf(tier) !== 'circle' ? 'plan' : job, by: 'ai', why: clip(r.data.why || '', 120) };
  } catch (err) {
    console.warn('[harness] job picker fell back to keywords:', scrubKeys(String((err && err.message) || err)).slice(0, 200));
    return { task: fallback(q), by: 'keywords', why: '' };
  }
}

// Room for the answer: more thinking needs more tokens.
const ROOM = { write: 4000, plan: 8000, deep: 12000 };

module.exports = { pick, fallback, JOBS, SCHEMA, SYSTEM, ROOM };
