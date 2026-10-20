// Repeats (contract v1.4, `suggestSchedule` on a workflow). When a run of such a workflow finishes,
// its page offers the suggestion ("Every Monday at 7am"); one tap keeps that run's answers, and the
// sweep starts the workflow again at that time in the member's time zone, at most once a day. Each
// run costs its usual credits (never the free run) and stops for the member's OK like any other,
// and a repeat whose last run is still going skips its turn, so runs never pile up. Stopping one is
// a tap on Runs.
//
// HARNESS_REPEATS=off pauses every repeat (they stay saved).

const deps = { db: require('../db'), now: () => Date.now() };
const packs = require('./packs');
const ledger = require('./ledger');
const cron = require('./cron');
const { clip, scrubKeys } = require('./text');

const MAX = 10;
const LIVE = new Set(['queued', 'running', 'waiting', 'sleeping']);

class RepeatError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function tzOf(userId) {
  const b = deps.db.get('brains', userId);
  return (b && b.business && b.business.timezone) || cron.DEFAULT_TZ;
}

function list(userId) {
  return deps.db.filter('schedules', (s) => s.memberId === userId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function forWorkflow(userId, workflowId) {
  return deps.db.find('schedules', (s) => s.memberId === userId && s.workflowId === workflowId) || null;
}

// What a finished run can offer: its workflow's suggestion, unless the member repeats it already.
// Sample runs (an admin's look) offer nothing, and neither does a workflow above the member's plan
// (they ran it on their free run): a repeat never spends that.
function offer(user, run) {
  const wf = run && packs.workflow(run.workflowId);
  if (!wf || !wf.suggestSchedule || !cron.parse(wf.suggestSchedule.cron) || run.status !== 'done' || run.sample || run.memberId !== user.id) return null;
  if (!packs.allowed(wf, ledger.tierOf(user))) return null;
  return forWorkflow(user.id, wf.id) ? null : { cron: wf.suggestSchedule.cron, label: wf.suggestSchedule.label };
}

// Starts repeating a finished run with its answers. The first repeat is the next time the schedule
// comes round after today, never a second run straight away.
async function create(user, run) {
  const o = offer(user, run);
  if (!o) throw new RepeatError("This one can't repeat.");
  if (list(user.id).length >= MAX) throw new RepeatError(`You have ${MAX} repeats already. Stop one on Runs first.`);
  const now = deps.now();
  const s = {
    id: deps.db.id(),
    memberId: user.id,
    workflowId: run.workflowId,
    title: run.title,
    inputs: JSON.parse(JSON.stringify(run.inputs || {})),
    cron: o.cron,
    label: o.label,
    createdAt: new Date(now).toISOString(),
    lastDate: cron.local(now, tzOf(user.id)).date,
    lastRunId: run.id,
    runs: 0,
    lastError: '',
  };
  await deps.db.save('schedules', s);
  return s;
}

async function remove(user, id) {
  const s = deps.db.get('schedules', id);
  if (!s || s.memberId !== user.id) return false;
  await deps.db.remove('schedules', id);
  return true;
}

// Repeats whose time has come: { user, s, date } for each.
function due(enabledFor, now = deps.now()) {
  if (String(process.env.HARNESS_REPEATS || '').toLowerCase() === 'off') return [];
  const out = [];
  for (const s of deps.db.all('schedules')) {
    const user = deps.db.get('users', s.memberId);
    const c = cron.parse(s.cron);
    if (!user || !c || !enabledFor(user) || !packs.workflow(s.workflowId)) continue;
    const t = cron.local(now, tzOf(user.id));
    if (s.lastDate !== t.date && cron.dueToday(c, t)) out.push({ user, s, date: t.date });
  }
  return out;
}

// start: engine.start. Returns the run ids it started.
async function sweep({ enabledFor, start }) {
  const ids = [];
  for (const { user, s, date } of due(enabledFor)) {
    const before = s.lastDate;
    s.lastDate = date;
    const last = s.lastRunId && deps.db.get('runs', s.lastRunId);
    // An AI team role's skill (lib/harness/team.js) skips while the role is paused or over its budget.
    const held = s.team ? require('./team').holds(s.team, user) : '';
    if (held) s.lastError = held;
    else if (last && LIVE.has(last.status)) {
      s.lastError = last.status === 'waiting' ? 'Skipped a turn: the last one is waiting on you.' : 'Skipped a turn: the last one was still going.';
    } else {
      try {
        // One that searches real businesses goes on only once its member has agreed in HQ to the line it
        // shows now (engine.start reads their OK, Legal L67).
        const run = await start(user, s.workflowId, s.inputs, { source: s.team ? `team:${s.team}` : s.skill ? 'skill' : 'repeat', spendFreeRun: false });
        Object.assign(s, { lastRunId: run.id, lastRunAt: new Date(deps.now()).toISOString(), runs: (s.runs || 0) + 1, lastError: '' });
        ids.push(run.id);
      } catch (err) {
        // Busy with other runs: try again on the next sweep. Anything else (out of credits, no longer on the plan): next time.
        if (err.status === 429) s.lastDate = before;
        else s.lastError = clip(scrubKeys(err.message), 200);
      }
    }
    await deps.db.save('schedules', s);
  }
  return ids;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { list, forWorkflow, offer, create, remove, due, sweep, MAX, _setDeps };
