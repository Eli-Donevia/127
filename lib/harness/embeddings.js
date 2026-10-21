// Meaning-based Brain search: each chunk of a member's Brain docs gets a vector from Voyage AI (through
// MongoDB Atlas), and a search mixes meaning with the keyword ranking docs.js already does, so "what do I
// charge for a big yard" finds the "Pricing: lots over half an acre" passage.
//
// Legal L85 (legal/handoffs/ai-stack.md, V1 to V7). Held in needs.HELD ('embed') until Eli turns off
// "Help Improve Voyage AI Models" in Atlas and opens the account in 127 Group LLC's name; until then, and
// with no VOYAGE_API_KEY, search is keywords only, as before.
// - V3 The US endpoint by default (us.ai.mongodb.com); VOYAGE_BASE_URL overrides it.
// - V4 Voyage gets only text to embed: chunks of Brain docs, and the member's own search text. Nothing
//   from the Pipeline or connections.
// - V5 Not for site chat: a visitor's message is never sent (publicOnly searches stay keywords only).
// - V6 Vectors sit next to their doc (brainVectors, one row per doc): replaced when the doc changes,
//   deleted with the doc and with the account (docs.forget). Never exported, never searched across
//   members, never used to train anything.
// - V7 Docs are masked (card and Social Security numbers cut to their last 4) before they are saved,
//   so chunks are masked before they're sent (docs.save).
//
// Vectors are stored as 8-bit numbers (512 dimensions, about 700 bytes a chunk); cosine similarity
// doesn't mind the scale.

const crypto = require('crypto');
const needs = require('./needs');
const { scrubKeys } = require('./text');

const deps = { db: require('../db'), fetch: (...a) => fetch(...a), docs: () => require('./docs'), flags: () => require('./flags'), ledger: () => require('./ledger') };
const MODEL = 'voyage-3.5-lite';
const DIMS = 512;
const PRICE_PER_M = 0.02; // USD per million tokens
const BATCH = 64;
const base = () => String(process.env.VOYAGE_BASE_URL || 'https://us.ai.mongodb.com/v1').replace(/\/$/, '');

function on(user) {
  return !!user && deps.flags().on('BRAIN_DOCS', user) && needs.available('embed');
}

// texts -> [Float32Array]; inputType 'document' or 'query'.
async function embed(texts, inputType) {
  const key = needs.read('embed');
  if (!key) throw new Error('Meaning-based search is not set up.');
  const res = await deps.fetch(`${base()}/embeddings`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType, output_dimension: DIMS }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Voyage answered ${res.status}`);
  const j = await res.json();
  const out = new Array(texts.length);
  for (const d of j.data || []) out[d.index] = Float32Array.from(d.embedding || []);
  if (out.some((v) => !v || !v.length)) throw new Error('Voyage left some texts out.');
  return { vectors: out, tokens: (j.usage && j.usage.total_tokens) || 0 };
}

function pack(v) {
  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  const q = Int8Array.from(v, (x) => Math.round((x / (max || 1)) * 127));
  return Buffer.from(q.buffer).toString('base64');
}

function unpack(s) {
  const b = Buffer.from(s, 'base64');
  return new Int8Array(b.buffer, b.byteOffset, b.length);
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const hashOf = (d) => crypto.createHash('sha256').update(`${MODEL}:${DIMS}:${d.title}\n${d.body}`).digest('hex').slice(0, 32);

async function charge(memberId, tokens) {
  const user = deps.db.get('users', memberId);
  if (user && tokens) await deps.ledger().cost(user, (tokens / 1e6) * PRICE_PER_M, { tool: 'brain_search' });
}

// Brings one doc's vectors up to date. Called after a doc is saved; a doc that's gone loses its row.
async function index(memberId, docId) {
  const docs = deps.docs();
  const d = docs.get(memberId, docId);
  const row = deps.db.get('brainVectors', docId);
  if (!d) {
    if (row) await deps.db.remove('brainVectors', docId);
    return null;
  }
  const user = deps.db.get('users', memberId);
  if (!on(user)) return null;
  const hash = hashOf(d);
  if (row && row.hash === hash && row.memberId === memberId) return row;
  const chunks = docs.chunk(d.body).map((c) => `${d.title}${c.heading ? ` > ${c.heading}` : ''}\n${c.text}`);
  const vecs = [];
  let tokens = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const r = await embed(chunks.slice(i, i + BATCH), 'document');
    vecs.push(...r.vectors.map(pack));
    tokens += r.tokens;
  }
  await charge(memberId, tokens);
  // The doc may have changed or gone while Voyage worked: only the latest version is kept.
  const now = docs.get(memberId, docId);
  if (!now || hashOf(now) !== hash) return null;
  return deps.db.save('brainVectors', { id: docId, memberId, hash, model: MODEL, dims: DIMS, v: vecs });
}

// Fire and forget after a save: a failure leaves keyword search as it is.
function queue(memberId, docId) {
  index(memberId, docId).catch((err) => console.warn('[harness] Brain vectors failed:', scrubKeys(String((err && err.message) || err)).slice(0, 160)));
}

async function removeDoc(docId) {
  if (deps.db.get('brainVectors', docId)) await deps.db.remove('brainVectors', docId);
}

async function forget(memberId) {
  for (const r of deps.db.filter('brainVectors', (x) => x.memberId === memberId)) await deps.db.remove('brainVectors', r.id);
}

// Docs saved before the switch went on, or while Voyage was down: indexed a few at a time.
async function backfill(user, max = 20) {
  if (!on(user)) return 0;
  let n = 0;
  for (const d of deps.docs().list(user.id)) {
    if (n >= max) break;
    const row = deps.db.get('brainVectors', d.id);
    if (row && row.hash === hashOf(d)) continue;
    await index(user.id, d.id);
    n += 1;
  }
  return n;
}

// Keyword hits merged with meaning hits by reciprocal rank (k = 60), so a passage both find ranks first.
// Same shape as docs.search. Site chat (publicOnly) and anything without the switch stay keywords only.
async function search(user, query, opts = {}) {
  const docs = deps.docs();
  const limit = Math.max(1, Math.min(20, opts.limit || 5));
  const keyword = docs.search(user.id, query, { ...opts, limit: Math.max(limit, 10) });
  if (opts.publicOnly || !on(user) || (opts.kinds && !opts.kinds.includes('doc')) || !String(query || '').trim()) return keyword.slice(0, limit);
  let q;
  try {
    const r = await embed([String(query).slice(0, 2000)], 'query');
    q = r.vectors[0];
    await charge(user.id, r.tokens);
  } catch (err) {
    console.warn('[harness] meaning search fell back to keywords:', scrubKeys(String((err && err.message) || err)).slice(0, 160));
    return keyword.slice(0, limit);
  }
  const meaning = [];
  for (const d of docs.list(user.id)) {
    const row = deps.db.get('brainVectors', d.id);
    if (!row || row.memberId !== user.id || row.hash !== hashOf(d)) continue;
    const chunks = docs.chunk(d.body);
    row.v.forEach((s, i) => {
      if (!chunks[i]) return;
      meaning.push({ id: `${d.id}:${i}`, docId: d.id, kind: 'doc', title: d.title, heading: chunks[i].heading, text: chunks[i].text, link: `/app/hq/brain/docs/${d.id}`, source: d.source, score: cosine(q, unpack(s)) });
    });
  }
  meaning.sort((a, b) => b.score - a.score);
  const fused = new Map();
  const add = (list, w) =>
    list.forEach((h, i) => {
      const cur = fused.get(h.id) || { h, s: 0 };
      cur.s += w / (60 + i + 1);
      fused.set(h.id, cur);
    });
  add(keyword, 1);
  add(meaning.filter((h) => h.score > 0.2).slice(0, 20), 1);
  return [...fused.values()]
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ h, s }) => ({ ...h, text: h.text.length > 700 ? `${h.text.slice(0, 700).trim()}...` : h.text, score: Math.round(s * 10000) / 10000 }));
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { on, embed, index, queue, removeDoc, forget, backfill, search, cosine, pack, unpack, MODEL, DIMS, _setDeps };
