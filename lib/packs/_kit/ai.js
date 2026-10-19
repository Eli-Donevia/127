// One way for every pack to call AI (harness contract 7 and 11). Say what the job is (`task`), never
// which model: the harness router picks it. Every call has a `fallback` that builds a decent answer
// from templates, so a tool still returns something useful when AI is off, slow, out of credits or
// answers in the wrong shape. Output always goes through plain() (no markdown, no em dashes).

const { check } = require('./schema');
const { deepPlain, plain, copyProblems } = require('./text');

// House rules added to every system prompt. The router adds the member's brain and voice for
// `write` and `plan`, so keep pack prompts about the job itself.
const HOUSE = [
  'You work inside 127, a platform that helps first-time founders start and run real businesses.',
  'Write in plain text: no markdown, no bullet symbols unless asked, no em dashes, no emoji.',
  'Short sentences. Second person. Concrete and practical, never motivational filler.',
  'Never promise or project income. Talk about first customers, prices and costs, not earnings.',
  'Never invent facts about a real business, person, review, testimonial or statistic. Use only facts given to you; if something is unknown, leave it out.',
  'Examples use mixed genders and put local or service businesses beside online ones.',
  'No luxury lifestyle, hype, guarantees, scarcity that is not real, or culture-war framing.',
].join(' ');

function aborted(ctx) {
  return ctx && ctx.signal && ctx.signal.aborted;
}

// Ask for JSON that matches `schema` (a JSON Schema with an object at the top).
// Returns { data, ai } where ai is true when the answer came from the model.
async function aiJson(ctx, { task = 'write', system, prompt, schema, images, maxTokens = 1500, fallback, accept } = {}) {
  if (ctx && typeof ctx.ai === 'function' && prompt) {
    try {
      const res = await ctx.ai({ task, system: system ? `${HOUSE}\n\n${system}` : HOUSE, prompt, schema, images, maxTokens });
      // The harness answers with schema examples marked sample when no AI key is set: use our template.
      const data = res && !res.sample ? res.data : null;
      if (data && typeof data === 'object' && check(schema, data).length === 0 && (!accept || accept(data))) {
        return { data: deepPlain(data), ai: true };
      }
    } catch (e) {
      if (aborted(ctx)) throw new Error('Stopped.');
    }
  }
  if (typeof fallback !== 'function') throw new Error("AI didn't answer. Try again in a minute.");
  return { data: deepPlain(await fallback()), ai: false };
}

// Ask for plain text. Returns { text, ai }.
async function aiText(ctx, { task = 'write', system, prompt, images, maxTokens = 1200, fallback, accept } = {}) {
  if (ctx && typeof ctx.ai === 'function' && prompt) {
    try {
      const res = await ctx.ai({ task, system: system ? `${HOUSE}\n\n${system}` : HOUSE, prompt, images, maxTokens });
      const text = res && !res.sample && typeof res.text === 'string' ? plain(res.text) : '';
      if (text && (!accept || accept(text))) return { text, ai: true };
    } catch (e) {
      if (aborted(ctx)) throw new Error('Stopped.');
    }
  }
  if (typeof fallback !== 'function') throw new Error("AI didn't answer. Try again in a minute.");
  return { text: plain(await fallback()), ai: false };
}

// True when every string in the value passes the copy rules (used as `accept` for AI drafts that a
// member will send: a draft with "guaranteed" or an income line goes back to the template instead).
function cleanCopy(value) {
  if (typeof value === 'string') return copyProblems(value).length === 0;
  if (Array.isArray(value)) return value.every(cleanCopy);
  if (value && typeof value === 'object') return Object.values(value).every(cleanCopy);
  return true;
}

module.exports = { aiJson, aiText, cleanCopy, HOUSE };
