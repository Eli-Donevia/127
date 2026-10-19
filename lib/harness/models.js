// The AI models the harness can use: who serves them, what they cost and what they support.
// Providers are plugins: lib/harness/providers/<name>.js exports { name, ready(), call(request) }.
// Anthropic is the only provider wired today; adding one is a new file plus rows here.
//
// Prices are USD per million tokens (Anthropic's price list, checked 2026-10-19). Fable 5.1's cache
// writes use the standard 1.25x (5 minutes) and 2x (1 hour) of its input price.

const MODELS = {
  'claude-haiku-5-5': {
    provider: 'anthropic',
    label: 'Haiku 5.5',
    rank: 1,
    price: { in: 0.1, out: 0.5, cacheRead: 0.01, write5m: 0.125, write1h: 0.2 },
    // Prompts over 100K tokens are billed at the long-context rate.
    long: { above: 100000, in: 0.5, out: 2.5, cacheRead: 0.05, write5m: 0.625, write1h: 1 },
    effort: true,
    fallbacks: false,
    vision: true,
    structured: true,
  },
  'claude-sonnet-5-5': {
    provider: 'anthropic',
    label: 'Sonnet 5.5',
    rank: 2,
    price: { in: 2, out: 10, cacheRead: 0.2, write5m: 2.5, write1h: 4 },
    effort: true,
    fallbacks: true,
    vision: true,
    structured: true,
  },
  'claude-opus-5-5': {
    provider: 'anthropic',
    label: 'Opus 5.5',
    rank: 3,
    price: { in: 4, out: 20, cacheRead: 0.2, write5m: 5, write1h: 8 },
    effort: true,
    fallbacks: true,
    vision: true,
    structured: true,
  },
  'claude-fable-5-1': {
    provider: 'anthropic',
    label: 'Fable 5.1',
    rank: 4,
    price: { in: 10, out: 50, cacheRead: 0.25, write5m: 12.5, write1h: 20 },
    effort: true,
    fallbacks: true,
    vision: true,
    structured: true,
  },
};

// The Batch API bills half of the normal input and output price.
const BATCH_DISCOUNT = 0.5;

function get(id) {
  return MODELS[id] || null;
}

function known(id) {
  return Object.prototype.hasOwnProperty.call(MODELS, id);
}

function label(id) {
  return (MODELS[id] && MODELS[id].label) || id;
}

// One step up in capability, or null at the top of what this tier may use.
function above(id, maxRank = 3) {
  const m = MODELS[id];
  if (!m) return null;
  const next = Object.entries(MODELS)
    .filter(([, x]) => x.provider === m.provider && x.rank > m.rank && x.rank <= maxRank)
    .sort((a, b) => a[1].rank - b[1].rank)[0];
  return next ? next[0] : null;
}

// usage: the API's usage object. Returns USD, or null for a model we have no price for.
function costOf(id, usage, { batch = false } = {}) {
  const m = MODELS[id];
  if (!m || !usage) return null;
  const c = usage.cache_creation || {};
  const w1h = c.ephemeral_1h_input_tokens || 0;
  const w5m = c.ephemeral_5m_input_tokens != null ? c.ephemeral_5m_input_tokens : Math.max(0, (usage.cache_creation_input_tokens || 0) - w1h);
  const prompt = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  const p = m.long && prompt > m.long.above ? m.long : m.price;
  const k = batch ? BATCH_DISCOUNT : 1;
  return ((usage.input_tokens || 0) * p.in * k + (usage.output_tokens || 0) * p.out * k + (usage.cache_read_input_tokens || 0) * p.cacheRead + w5m * p.write5m + w1h * p.write1h) / 1e6;
}

// A rough price for planning: tokens in and out at list price, no caching.
function estimate(id, inTokens, outTokens) {
  return costOf(id, { input_tokens: inTokens, output_tokens: outTokens });
}

module.exports = { MODELS, BATCH_DISCOUNT, get, known, label, above, costOf, estimate };
