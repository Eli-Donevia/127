// Claude through the official SDK. Structured answers use output_config.format; effort is the only
// thinking control (no `thinking` parameter). Opus, Sonnet and Fable ask for server-side fallbacks
// so an overloaded model is served by its fallback instead of failing; if the API rejects that
// beta (an older account), it's switched off for this process and the call is retried once.

const models = require('../models');
const { scrubKeys } = require('../text');

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const state = { fallbacksOff: process.env.AI_FALLBACKS === 'off' };
let client = null;
let injected = false;

function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ maxRetries: 2 });
  }
  return client;
}

function ready() {
  return injected || !!process.env.ANTHROPIC_API_KEY;
}

function content(prompt, images) {
  const out = [];
  for (const img of images || []) {
    if (img && img.url) out.push({ type: 'image', source: { type: 'url', url: img.url } });
    else if (img && img.data) out.push({ type: 'image', source: { type: 'base64', media_type: img.type || 'image/jpeg', data: img.data } });
  }
  out.push({ type: 'text', text: String(prompt || '') });
  return out;
}

// The system prompt as text blocks: a string, or parts [{ text, cache }] where a part marked cache
// ends the prefix that is cached.
function systemBlocks(system, cache) {
  const parts = typeof system === 'string' ? [{ text: system, cache }] : system || [];
  return parts.filter((p) => p && p.text).map((p) => ({ type: 'text', text: p.text, ...(p.cache ? { cache_control: { type: 'ephemeral' } } : {}) }));
}

// request: { model, effort, maxTokens, system (string or [{ text, cache }]), prompt, images, schema (already in API form), cache, timeoutMs, signal }
async function call(req) {
  const meta = models.get(req.model) || {};
  const params = { model: req.model, max_tokens: req.maxTokens, messages: [{ role: 'user', content: content(req.prompt, req.images) }] };
  const sys = systemBlocks(req.system, req.cache);
  if (sys.length) params.system = sys;
  const oc = {};
  if (req.effort && meta.effort) oc.effort = req.effort;
  if (req.schema) oc.format = { type: 'json_schema', schema: req.schema };
  if (Object.keys(oc).length) params.output_config = oc;
  const opts = { timeout: req.timeoutMs || 120000, signal: req.signal };
  const useFallbacks = !state.fallbacksOff && meta.fallbacks;
  let res;
  try {
    res = useFallbacks
      ? await getClient().beta.messages.create({ ...params, betas: [FALLBACK_BETA], fallbacks: 'default' }, opts)
      : await getClient().messages.create(params, opts);
  } catch (err) {
    if (err && err.status === 400 && useFallbacks && /fallback/i.test(String(err.message || ''))) {
      console.warn('[harness] server-side fallbacks rejected, turning them off:', scrubKeys(String(err.message).slice(0, 200)));
      state.fallbacksOff = true;
      return call(req);
    }
    throw err;
  }
  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, stop: res.stop_reason, model: res.model || req.model, usage: res.usage || {} };
}

module.exports = {
  name: 'anthropic',
  ready,
  call,
  state,
  FALLBACK_BETA,
  // Tests pass a stand-in with messages.create and beta.messages.create.
  _setClient(c) {
    client = c;
    injected = !!c;
  },
};
