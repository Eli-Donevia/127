// One AI call for a tool: ctx.ai({ task, system, prompt, images, schema, maxTokens }).
// The router picks the model; this file adds the house style and the member's business context for
// `write` and `plan`, asks for structured output when there's a schema, checks the answer against
// the schema (including the constraints the API doesn't take), retries once on a stronger model if
// it doesn't fit, and reports the cost.
//
// No ANTHROPIC_API_KEY (or HARNESS_AI=off): demo answers, marked sample, so every workflow still
// runs end to end on a laptop or in tests.

const router = require('./router');
const models = require('./models');
const schemaLib = require('./schema');
const { plain, deepPlain, scrubKeys } = require('./text');

const providers = { anthropic: require('./providers/anthropic') };
const MAX_PROMPT_CHARS = 300000; // about 75,000 words: keeps Haiku under its 100K-token price step

const HOUSE = `You're working inside 127, where founders run their business. Follow these rules in everything you write:
- Plain text only: no markdown, no headings, no bold, no em dashes. Short sentences.
- Never promise income, results or timelines, and never quote anyone's earnings.
- Drafts are sent by the member, in their own voice and first person. Never sign as 127 or mention 127 or Eli in a draft unless asked.
- Use only facts you were given. If something is missing, write around it or leave a clear [placeholder].`;

function brainNote(brain) {
  const b = (brain && brain.business) || {};
  const v = (brain && brain.voice) || {};
  const lines = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null && String(value).trim()) lines.push(`- ${label}: ${String(value).trim().slice(0, 300)}`);
  };
  add('Business', b.name);
  add('What they do', b.what);
  add('Niche', b.niche);
  add('Offer', b.offer);
  add('Price', b.price);
  add('Who it is for', b.audience);
  add('Where', [b.city, b.region, b.country].filter(Boolean).join(', '));
  add('Stage', b.stage);
  add('Tone', v.tone);
  add('Avoid', v.avoid);
  return lines.length ? `About the member's business (from their 127 profile):\n${lines.join('\n')}` : '';
}

function provider(name) {
  return providers[name] || null;
}

function live() {
  if (process.env.HARNESS_AI === 'off') return false;
  return Object.values(providers).some((p) => p.ready());
}

function demoAnswer(task, prompt, schema) {
  if (schema) return { data: schemaLib.example(schema), sample: true };
  const first = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return { text: `Sample answer (no AI key is set, so this is a stand-in). The real answer to "${first}" appears here once ANTHROPIC_API_KEY is set.`, sample: true };
}

function friendly(err) {
  const status = err && err.status;
  if (err && (err.name === 'AbortError' || /aborted|abort/i.test(String(err.message || '')))) return 'Stopped.';
  if (status === 429 || status === 529 || (status >= 500 && status < 600)) return 'The AI is busy right now. Try this step again in a minute.';
  if (status === 400) return "The AI couldn't take this request. Try shorter or simpler input.";
  if (status === 401 || status === 403) return "The AI isn't set up on this server yet.";
  if (/timed? ?out|timeout/i.test(String((err && err.message) || ''))) return 'The AI took too long. Try this step again.';
  return 'The AI call failed. Try this step again.';
}

// opts: { task, system, prompt, images, schema, maxTokens, tier, spentUsd, brain, signal, timeoutMs, onCost }
async function call(opts = {}) {
  const task = router.TASKS[opts.task] ? opts.task : 'write';
  const prompt = String(opts.prompt || '');
  // The house rules and the tool's own instructions are the same for every member, so they go first
  // and are cached; the member's business comes after them.
  const shared = [HOUSE, opts.system ? String(opts.system) : ''].filter(Boolean).join('\n\n');
  const mine = task === 'write' || task === 'plan' || task === 'deep' ? brainNote(opts.brain) : '';
  const system = [{ text: shared, cache: shared.length > 4000 }, ...(mine ? [{ text: mine }] : [])];
  if (prompt.length + shared.length + mine.length > MAX_PROMPT_CHARS) throw new Error('That is too much text for one AI call. Send less at a time.');
  if (opts.schema && (!opts.schema.type || opts.schema.type !== 'object')) throw new Error('ctx.ai schema must be an object schema.');

  if (!live()) {
    const out = demoAnswer(task, prompt, opts.schema);
    if (opts.onCost) await opts.onCost({ task, model: 'demo', usd: 0, usage: {}, ms: 0, sample: true });
    return out;
  }

  let r = router.route({ task, tier: opts.tier, spentUsd: opts.spentUsd || 0 });
  const apiSchema = opts.schema ? schemaLib.forApi(opts.schema) : null;
  let maxTokens = opts.maxTokens || r.maxTokens;
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = provider(r.provider);
    const started = Date.now();
    let res;
    try {
      res = await p.call({
        model: r.model,
        effort: r.effort,
        maxTokens,
        system,
        prompt,
        images: opts.images,
        schema: apiSchema,
        timeoutMs: opts.timeoutMs || 120000,
        signal: opts.signal,
      });
    } catch (err) {
      console.warn(`[harness] ai ${task} model=${r.model} failed: ${err && err.status ? err.status : ''} ${scrubKeys(String((err && err.message) || err)).slice(0, 200)}`);
      throw new Error(friendly(err));
    }
    const usd = models.costOf(res.model, res.usage);
    const meta = { task, model: res.model, usd: usd || 0, usage: res.usage, ms: Date.now() - started, attempt, notes: r.notes };
    if (opts.onCost) await opts.onCost(meta);
    if (res.stop === 'refusal') throw new Error("The AI wouldn't do this one. Try rewording it.");
    if (!opts.schema) {
      if (!res.text.trim()) throw new Error('The AI sent back an empty answer. Try again.');
      return { text: task === 'write' ? plain(res.text) : res.text.trim(), model: res.model, usd: meta.usd };
    }
    let data;
    try {
      data = JSON.parse(res.text);
    } catch {
      data = undefined;
    }
    if (data !== undefined) {
      const v = schemaLib.validate(opts.schema, data, { clip: true });
      if (v.ok) return { data: task === 'write' ? deepPlain(v.value) : v.value, model: res.model, usd: meta.usd };
      problem = v.text;
    } else problem = res.stop === 'max_tokens' ? 'the answer was cut off' : "the answer wasn't valid JSON";
    if (res.stop === 'max_tokens') maxTokens = Math.min(maxTokens * 2, 64000);
    const up = router.escalate(r, opts.tier);
    if (!up) {
      if (res.stop !== 'max_tokens') break;
      continue; // same model, more room
    }
    r = up;
  }
  throw new Error(`The AI's answer didn't come out right (${problem}). Try again.`);
}

module.exports = { call, live, brainNote, HOUSE, providers, _demoAnswer: demoAnswer };
