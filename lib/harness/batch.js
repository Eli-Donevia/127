// Batch pricing for AI calls nobody is waiting on. Repeats run on a schedule while the member is
// away, so their AI calls go through Anthropic's Message Batches at half the price. The step sleeps
// while the batch works and picks up on its own; the tool then runs again from the top, and every AI
// call it already made comes back from here instead of being paid for twice.
// Only the AI calls a tool makes before it spends, saves or writes anything are batched (ctx.js
// stops batching at the first of those), so running a tool again never repeats a side effect.
// A batch that fails, or hasn't answered in 24 hours, is replaced by a normal call.
// HARNESS_BATCH=off sends everything at the normal price.

const crypto = require('crypto');
const { scrubKeys } = require('./text');

const deps = { db: require('../db'), now: () => Date.now() };
const KEEP_MS = 3 * 864e5;
const GIVE_UP_MS = 24 * 3600 * 1000;
const pollMs = () => Math.max(5000, Number(process.env.HARNESS_BATCH_POLL_MS) || 60000);

class Pending extends Error {
  constructor(wakeAt) {
    super('Waiting on the AI at batch price. This picks up on its own.');
    this.batchPending = true;
    this.wakeAt = wakeAt;
  }
}

function on() {
  return process.env.HARNESS_BATCH !== 'off';
}

// The same call in the same step of the same run gets the same key.
function keyOf(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40);
}

const iso = () => new Date(deps.now()).toISOString();

// take(key, provider, request, { runId }) -> the answer ({ text, stop, model, usage, batch: true,
// paid }) where paid is false when it was already counted; null to make a normal call instead; or
// throws Pending while the batch works.
async function take(key, provider, request, { runId } = {}) {
  const row = deps.db.get('aiBatches', key);
  if (row && row.res) return { ...row.res, batch: true, paid: false };
  if (row && row.failed) return null;
  if (!row) {
    let batchId;
    try {
      batchId = await provider.submitBatch(request);
    } catch (err) {
      console.warn('[harness] batch submit failed, calling normally:', scrubKeys(String((err && err.message) || err)).slice(0, 200));
      return null;
    }
    await deps.db.save('aiBatches', { id: key, runId: runId || null, batchId, sentAt: iso() });
    throw new Pending(deps.now() + pollMs());
  }
  let got;
  try {
    got = await provider.checkBatch(row.batchId);
  } catch (err) {
    console.warn('[harness] batch check failed:', scrubKeys(String((err && err.message) || err)).slice(0, 200));
    got = { state: 'pending' };
  }
  if (got.state === 'pending') {
    if (deps.now() - Date.parse(row.sentAt) < GIVE_UP_MS) throw new Pending(deps.now() + pollMs());
    got = { state: 'failed', why: 'took over 24 hours' };
    try {
      await provider.cancelBatch(row.batchId);
    } catch {
      // it may have ended meanwhile; either way the normal call goes ahead
    }
  }
  if (got.state !== 'done') {
    console.warn(`[harness] batch ${row.batchId} ${got.why || 'failed'}, calling normally`);
    row.failed = true;
    await deps.db.save('aiBatches', row);
    return null;
  }
  row.res = got.res;
  row.doneAt = iso();
  await deps.db.save('aiBatches', row);
  return { ...got.res, batch: true, paid: true };
}

// Daily: answers go 3 days after they were sent; a run that needed them has long moved on.
async function sweep() {
  const cutoff = new Date(deps.now() - KEEP_MS).toISOString();
  let n = 0;
  for (const r of deps.db.filter('aiBatches', (x) => String(x.sentAt) < cutoff)) {
    await deps.db.remove('aiBatches', r.id);
    n += 1;
  }
  return n;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { on, keyOf, take, sweep, Pending, KEEP_MS, GIVE_UP_MS, _setDeps };
