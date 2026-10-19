// Activation: the early actions that predict which members stay (v2/hormozi-playbook.md 1.8).
// Each fires once per member, is kept on their brain doc, and goes out as one event for analytics.
//
//   a1  Business set     what they sell, plus a city or who it's for (Your business, or an import)
//   a2  First result     a run finished, or a First 25 list came in
//   a3  First send       a message marked sent, a lead moved to contacted, or a touch logged
//   a4  First reply      a lead moved to replied
//   a5  First win        a lead moved to won, or a win logged

const deps = { db: require('../db'), now: () => Date.now(), emit: () => {} };
const { scrubKeys } = require('./text');

const STEPS = { a1: 'Business set', a2: 'First result', a3: 'First send', a4: 'First reply', a5: 'First win' };
const ON_STAGE = { contacted: 'a3', replied: 'a4', won: 'a5' };

function docOf(memberId) {
  return deps.db.get('brains', memberId) || { id: memberId, business: {}, voice: {}, links: {}, goal: {}, packs: {} };
}

function state(memberId) {
  const act = docOf(memberId).act || {};
  return Object.fromEntries(Object.keys(STEPS).map((k) => [k, act[k] || null]));
}

// True the first time; false after. Never throws: activation must not break the action it rides on.
async function mark(memberId, step) {
  if (!STEPS[step] || !memberId) return false;
  try {
    const d = docOf(memberId);
    d.act = d.act || {};
    if (d.act[step]) return false;
    d.act[step] = new Date(deps.now()).toISOString();
    await deps.db.save('brains', d);
    try {
      deps.emit('hq.activation', { userId: memberId, step, name: STEPS[step] });
    } catch {
      /* analytics is best-effort */
    }
    return true;
  } catch (err) {
    console.warn('[harness] activation failed:', scrubKeys(err.message));
    return false;
  }
}

// a1 once the brain has what they sell plus a city or who it's for (Your business, or an import).
async function business(memberId, snap) {
  const b = (snap && snap.business) || {};
  if (b.what && (b.city || b.audience)) return mark(memberId, 'a1');
  return false;
}

async function onStage(memberId, lead, from, to) {
  if (ON_STAGE[to]) await mark(memberId, ON_STAGE[to]);
  // A lead that jumps ahead (found straight to won) still counts the steps it skipped.
  if (to === 'won' || to === 'call' || to === 'replied') await mark(memberId, 'a3');
  if (to === 'won' || to === 'call') await mark(memberId, 'a4');
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { STEPS, state, mark, business, onStage, _setDeps };
