// The Activity log (/app/hq/activity): every run, approval, AI link call, Ask 127 action, AI team
// action, Brain change and connector read or write, with who did it, when and what data it touched.
// Collection `activity`, one doc per entry, the shape Hub's connector log writes too
// (lib/harness/connectors/log.js):
//
//   { id, memberId, at (ISO), who: 'you' | 'Ask 127' | 'Your Claude' | 'Schedule' | a role,
//     kind: 'run' | 'approval' | 'ai_link' | 'agent' | 'team' | 'brain' | 'connector',
//     action, what, ref (a run id, an HQ link, or null), connector?, write? }
//
// `what` is plain words, never a key, a token or a customer's details. Recorded only while
// HQ_ACTIVITY is on for the member. Kept 400 days, deleted with the account.

const deps = { db: require('../db'), now: () => Date.now() };
const flags = require('./flags');

const KEEP_DAYS = 400;
const KINDS = {
  run: 'Runs',
  approval: 'Approvals',
  ai_link: 'Your Claude',
  agent: 'Ask 127',
  team: 'AI team',
  brain: 'Brain',
  connector: 'Connections',
};

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

function userOf(u) {
  if (u && typeof u === 'object') return u;
  return u ? deps.db.get('users', String(u)) : null;
}

// Who started a run, from its source.
function whoOf(source) {
  const s = String(source || 'hq');
  if (s === 'mcp' || s === 'ai_link') return 'Your Claude';
  if (s === 'agent') return 'Ask 127';
  if (s === 'monday' || s === 'schedule' || s === 'skill') return 'Schedule';
  if (s.startsWith('team:')) {
    const t = deps.db.get('team', s.slice(5));
    return t ? t.name : 'AI team';
  }
  return 'you';
}

function on(user) {
  return flags.on('HQ_ACTIVITY', user);
}

// user: the member (object or id). entry: { who, kind, action, what, ref, connector, write }
async function add(user, entry = {}) {
  const u = userOf(user);
  if (!u || !on(u) || !KINDS[entry.kind]) return null;
  const doc = {
    id: deps.db.id(),
    memberId: u.id,
    at: new Date(deps.now()).toISOString(),
    who: clip(entry.who || 'you', 60),
    kind: entry.kind,
    action: clip(entry.action, 40),
    what: clip(entry.what, 300),
    ref: entry.ref ? clip(entry.ref, 200) : null,
    ...(entry.connector ? { connector: clip(entry.connector, 40) } : {}),
    write: !!entry.write,
  };
  try {
    return await deps.db.save('activity', doc);
  } catch (err) {
    console.warn('[harness] activity not saved:', clip(err && err.message, 120));
    return null;
  }
}

// Never lets a log failure stop the thing being logged.
function note(user, entry) {
  add(user, entry).catch(() => {});
}

function list(memberId, { kind, who, limit = 200, before } = {}) {
  return deps.db
    .filter('activity', (a) => a.memberId === memberId && (!kind || a.kind === kind) && (!who || a.who === who) && (!before || a.at < before))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, Math.max(1, Math.min(5000, limit)));
}

function linkOf(a) {
  if (!a.ref) return null;
  if (a.ref.startsWith('/app/')) return a.ref;
  return deps.db.get('runs', a.ref) ? `/app/hq/runs/${a.ref}` : null;
}

function view(a) {
  return { ...a, kindLabel: KINDS[a.kind] || a.kind, link: linkOf(a) };
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  // A cell starting with = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csv(memberId) {
  const rows = list(memberId, { limit: 5000 });
  const head = ['When (UTC)', 'Who', 'Kind', 'Action', 'What', 'Connection', 'Write', 'Link'];
  return [head, ...rows.map((a) => [a.at, a.who, KINDS[a.kind] || a.kind, a.action, a.what, a.connector || '', a.write ? 'yes' : '', linkOf(a) || ''])].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

async function purge() {
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

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { add, note, list, view, csv, purge, forget, whoOf, on, KINDS, KEEP_DAYS, _setDeps };
