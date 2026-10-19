// The member's Inbox: every approval a run is waiting on. HQ shows it on Today, the Monday email
// lists it, and Claude or ChatGPT read and answer it through the member's AI link. The answer itself
// goes through engine.answer(), which checks it against the step.

const deps = { db: require('../db'), now: () => Date.now() };

async function open(item) {
  const doc = {
    memberId: item.memberId,
    runId: item.runId,
    stepId: item.stepId,
    kind: item.kind || 'approve',
    title: String(item.title || 'Needs your OK').slice(0, 160),
    note: item.note ? String(item.note).slice(0, 400) : '',
    workflow: item.workflow || '',
    count: item.count || 0,
    status: 'open',
  };
  return deps.db.save('inbox', doc);
}

function list(memberId, { status = 'open', limit = 50 } = {}) {
  return deps.db
    .filter('inbox', (i) => i.memberId === memberId && (!status || i.status === status))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

function get(memberId, id) {
  const i = deps.db.get('inbox', id);
  return i && i.memberId === memberId ? i : null;
}

function forStep(runId, stepId) {
  return deps.db.find('inbox', (i) => i.runId === runId && i.stepId === stepId && i.status === 'open');
}

async function close(runId, stepId, status = 'answered') {
  for (const i of deps.db.filter('inbox', (x) => x.runId === runId && (!stepId || x.stepId === stepId) && x.status === 'open')) {
    i.status = status;
    i.closedAt = new Date(deps.now()).toISOString();
    await deps.db.save('inbox', i);
  }
}

function count(memberId) {
  return deps.db.filter('inbox', (i) => i.memberId === memberId && i.status === 'open').length;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { open, list, get, forStep, close, count, _setDeps };
