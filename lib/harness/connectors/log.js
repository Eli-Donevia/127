// The Activity log's connector rows (BUILD-PLAN W1 rule 4; the Harness thread owns the page and the
// other kinds): every connect, disconnect, read and write a member's connections do, with who did it
// and when. Collection `activity`, one doc per entry, in the shape every writer shares:
//
//   { id, memberId, at (ISO), who: 'you' | 'Ask 127' | 'Your Claude' | 'Schedule' | a role,
//     kind: 'connector', action: 'connect' | 'disconnect' | 'read' | 'write' | 'error',
//     what, ref (a run id, or null), connector (the app id), write (true for a write) }
//
// `what` is a short line in plain words, never a key, token or a customer's details. Reads are
// written at most once an hour per member, app and method, so a busy pack doesn't flood the log.

const deps = { db: require('../../db'), now: () => Date.now() };
function _setDeps(over) {
  Object.assign(deps, over);
}

const KEEP_DAYS = 400;
const READ_EVERY_MS = 60 * 60 * 1000;
const lastRead = new Map();

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

async function add(memberId, entry) {
  if (!memberId || !entry) return null;
  const at = deps.now();
  if (entry.kind === 'read') {
    const k = `${memberId}:${entry.app}:${entry.what}`;
    if (at - (lastRead.get(k) || 0) < READ_EVERY_MS) return null;
    lastRead.set(k, at);
    if (lastRead.size > 5000) lastRead.clear();
  }
  const doc = {
    id: deps.db.id(),
    memberId,
    at: new Date(at).toISOString(),
    who: clip(entry.who || 'you', 60),
    kind: 'connector',
    action: clip(entry.kind, 20),
    what: clip(entry.what, 300),
    ref: entry.runId ? clip(entry.runId, 120) : null,
    connector: clip(entry.app, 40),
    write: entry.kind === 'write',
  };
  return deps.db.save('activity', doc);
}

function list(memberId, { app, limit = 200 } = {}) {
  return deps.db
    .filter('activity', (a) => a.memberId === memberId && (!app || a.connector === app))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, Math.max(1, Math.min(2000, limit)));
}

let lastPurge = 0;
// Runs from server.js's 5-minute interval; does the work at most every 6 hours.
async function purge({ force = false } = {}) {
  if (!force && deps.now() - lastPurge < 6 * 60 * 60 * 1000) return 0;
  lastPurge = deps.now();
  const cut = new Date(deps.now() - KEEP_DAYS * 864e5).toISOString();
  const old = deps.db.filter('activity', (a) => a.at < cut);
  for (const a of old) await deps.db.remove('activity', a.id);
  return old.length;
}

async function forget(memberId) {
  const mine = deps.db.filter('activity', (a) => a.memberId === memberId);
  for (const a of mine) await deps.db.remove('activity', a.id);
  return mine.length;
}

module.exports = { add, list, purge, forget, KEEP_DAYS, _setDeps, _reset: () => { lastRead.clear(); lastPurge = 0; } };
