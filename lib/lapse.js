// The 30-day timer after a paid plan ends (Legal K5, V2; live Privacy 7A). A member who moves from a paid
// plan to Free (not a pause) keeps their saved keys, sign-ins, and Studio voices and likenesses for 30
// days in case they come back; after that each owner deletes them. Owners register a handler with
// onLapse(); sweep() runs from server.js's 5-minute interval, at most every 6 hours, and calls every
// handler for every member past the 30 days. Handlers must be safe to call again (deleting nothing is
// fine), since a member stays lapsed until they pay again.
//
//   lapse.onLapse('studio', async (user) => { ...delete voices and likenesses... });
//   lapse.ended(user)   when the paid plan ended (ms), or null if they're paid, paused or never paid
//   lapse.due(user)     past the 30 days
//   lapse.deleteOn(user) the date things go (ISO), for a screen that says so

const { plan } = require('./plans');

const deps = { db: require('./db'), now: () => Date.now() };
function _setDeps(over) {
  Object.assign(deps, over);
}

const DAYS = 30;
const DAY = 864e5;
const handlers = new Map();

const paidTier = (t) => !!t && plan(t).rank >= plan('builder').rank;

function ended(user) {
  if (!user || paidTier(user.tier) || paidTier(user.pausedTier)) return null;
  const at = Date.parse(user.canceledAt || '');
  return Number.isFinite(at) ? at : null;
}
function due(user, now = deps.now()) {
  const at = ended(user);
  return at != null && now - at > DAYS * DAY;
}
function deleteOn(user) {
  const at = ended(user);
  return at == null ? null : new Date(at + DAYS * DAY).toISOString();
}

function onLapse(name, fn) {
  if (typeof fn !== 'function') throw new Error('onLapse needs a function');
  handlers.set(String(name), fn);
}

let last = 0;
// Returns how many members it ran handlers for.
async function sweep({ force = false, now = deps.now() } = {}) {
  if (!handlers.size || (!force && now - last < 6 * 60 * 60 * 1000)) return 0;
  last = now;
  let n = 0;
  for (const u of deps.db.filter('users', (x) => !!x.canceledAt)) {
    if (!due(u, now)) continue;
    n += 1;
    for (const [name, fn] of handlers) {
      try {
        await fn(u);
      } catch (err) {
        console.error(`[lapse] ${name}`, err && err.message);
      }
    }
  }
  return n;
}

module.exports = { DAYS, ended, due, deleteOn, onLapse, sweep, _setDeps, _reset: () => { last = 0; } };
