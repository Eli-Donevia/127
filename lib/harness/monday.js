// Monday approval cards (v2/hormozi-playbook.md 1.8 and 2.3 item 14). From 8am local time on Monday,
// each active Builder (or Circle member) with leads to work gets this week's sends written by the
// hq.week workflow, so by 9am a card is waiting in their Inbox to check and approve. Nothing is sent:
// approving pins those leads to the top of Do my day. The engine's notice for the waiting card goes
// out as the hq.monday_card event, which the Monday email can link to (/app/hq/inbox).
//
// HARNESS_MONDAY=off turns it off. Active: a run, a lead change or a logged action in the last 30 days.

const deps = { db: require('../db'), now: () => Date.now() };
const today = require('./today');
const ledger = require('./ledger');
const { scrubKeys } = require('./text');

const START_HOUR = 8;
const ACTIVE_DAYS = 30;
const DEFAULT_TZ = 'America/Chicago';
const tried = new Set();

function localTime(ms, tz) {
  let f;
  try {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
  } catch {
    f = new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, hour: Number(p.hour) };
}

function active(userId, now) {
  const since = new Date(now - ACTIVE_DAYS * 864e5).toISOString();
  const sinceDay = since.slice(0, 10);
  return !!(
    deps.db.find('runs', (r) => r.memberId === userId && String(r.createdAt) >= since) ||
    deps.db.find('pipeline', (l) => l.memberId === userId && String(l.updatedAt) >= since) ||
    deps.db.find('actions', (a) => a.memberId === userId && String(a.day) >= sinceDay)
  );
}

// Who gets a card now: { user, week } for each member whose Monday 8am has come and who has no
// card for this week yet.
function due(enabledFor, now = deps.now()) {
  if (String(process.env.HARNESS_MONDAY || '').toLowerCase() === 'off') return [];
  const week = today.weekStart(today.dayKey(now));
  const out = [];
  for (const user of deps.db.filter('users', (u) => ledger.tierOf(u) !== 'free')) {
    if (!enabledFor(user) || tried.has(`${user.id}:${week}`)) continue;
    const brain = deps.db.get('brains', user.id);
    const t = localTime(now, (brain && brain.business && brain.business.timezone) || DEFAULT_TZ);
    if (t.weekday !== 'Mon' || t.hour < START_HOUR) continue;
    if (deps.db.find('runs', (r) => r.memberId === user.id && r.workflowId === 'hq.week' && r.inputs && r.inputs.week === week)) continue;
    if (!deps.db.find('pipeline', (l) => l.memberId === user.id && (l.stage === 'found' || l.stage === 'contacted'))) continue;
    if (!active(user.id, now)) continue;
    out.push({ user, week });
  }
  return out;
}

// start: engine.start. Returns the run ids it started.
async function sweep({ enabledFor, start }) {
  const ids = [];
  for (const { user, week } of due(enabledFor)) {
    const key = `${user.id}:${week}`;
    tried.add(key);
    try {
      const run = await start(user, 'hq.week', { week }, { source: 'monday' });
      ids.push(run.id);
    } catch (err) {
      // Busy with other runs: try again on the next sweep. Anything else (out of credits): not this week.
      if (err.status === 429) tried.delete(key);
      else console.warn(`[harness] Monday card for ${user.id} didn't start: ${scrubKeys(err.message)}`);
    }
  }
  return ids;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

function _reset() {
  tried.clear();
}

module.exports = { due, sweep, localTime, START_HOUR, _setDeps, _reset };
