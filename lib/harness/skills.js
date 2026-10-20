// Skills (HQ_SKILLS): jobs 127 does on a schedule, each a workflow plus a time. Turning one on saves
// a repeat (lib/harness/schedules.js) marked with the skill's id, so the same sweep starts it, it
// costs its usual credits, never the free run, and anything it drafts waits for the member's OK.
// Packs add more: any workflow with suggestSchedule and no required inputs shows under "From your
// packs". "Get this skill for Claude" gives a SKILL.md that runs it through the AI link.

const deps = { db: require('../db'), now: () => Date.now() };
const packs = require('./packs');
const ledger = require('./ledger');
const cron = require('./cron');
const { makeZip } = require('./zipfile');

// workflows: the first one that's loaded runs (packs from the Workflow library replace HQ's own).
const CATALOG = [
  { id: 'daily_numbers', name: 'Daily numbers', what: "Yesterday in your Pipeline, today's follow-ups and the numbers you log, every morning.", cron: '0 7 * * *', label: 'Every day at 7am', workflows: ['kpi.daily', 'hq.daily_numbers'] },
  { id: 'weekly_working', name: "Weekly what's working", what: 'What moved this week, what stalled, and three moves for next week.', cron: '0 16 * * 5', label: 'Every Friday at 4pm', workflows: ['cmo.weekly', 'hq.weekly_review'] },
  { id: 'monday_card', name: 'Monday card', what: "Your week's sends, written and waiting for your OK on Monday morning.", builtIn: true, label: 'Every Monday by 9am', workflows: ['hq.week'] },
  { id: 'follow_up_sweep', name: 'Follow-up sweep', what: 'Who to nudge today, with the message written for each.', cron: '0 9 * * 1-5', label: 'Every weekday at 9am', workflows: ['warm.follow_up'] },
  { id: 'content_week', name: 'Content week', what: "Next week's posts planned, with hooks and captions to check.", cron: '0 18 * * 0', label: 'Every Sunday at 6pm', workflows: ['content.plan_week'] },
];
const BY_ID = new Map(CATALOG.map((s) => [s.id, s]));

class SkillError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const requiredOf = (wf) => ((wf && wf.inputs && wf.inputs.required) || []).length;

function workflowOf(skill) {
  for (const id of skill.workflows) {
    const wf = packs.workflow(id);
    if (wf) return wf;
  }
  return null;
}

// Skills from packs: workflows that suggest a schedule and need no answers.
function fromPacks() {
  return packs
    .workflows()
    .filter((wf) => wf.suggestSchedule && !wf.hidden && !requiredOf(wf) && cron.parse(wf.suggestSchedule.cron) && !CATALOG.some((s) => s.workflows.includes(wf.id)))
    .map((wf) => ({ id: `wf:${wf.id}`, name: wf.title, what: wf.promise, cron: wf.suggestSchedule.cron, label: wf.suggestSchedule.label, workflows: [wf.id], pack: wf.pack }));
}

function get(id) {
  if (BY_ID.has(id)) return BY_ID.get(id);
  return fromPacks().find((s) => s.id === id) || null;
}

function scheduleOf(userId, skillId) {
  return deps.db.find('schedules', (s) => s.memberId === userId && s.skill === skillId) || null;
}

// Every skill for this member: { id, name, what, label, workflowId, status: on|off|locked|coming|builtIn, schedule }
function list(user, { team } = {}) {
  const tier = ledger.tierOf(user);
  return CATALOG.concat(fromPacks()).map((s) => {
    const wf = workflowOf(s);
    const sch = scheduleOf(user.id, s.id);
    let status = 'off';
    if (!wf) status = 'coming';
    else if (s.builtIn) status = 'builtIn';
    else if (!packs.allowed(wf, tier)) status = 'locked';
    else if (sch) status = 'on';
    return { id: s.id, name: s.name, what: s.what, label: sch ? sch.label : s.label, cron: sch ? sch.cron : s.cron, workflowId: wf ? wf.id : null, tier: wf ? wf.tier : null, status, schedule: sch, team: sch && sch.team ? sch.team : null, fromPack: !!s.pack, credits: wf ? require('./engine').estimate(wf, {}) : 0 };
  }).filter((s) => !team || s.team === team);
}

// team: the AI team role that runs it (lib/harness/team.js), or none.
async function turnOn(user, id, { team = null } = {}) {
  const s = get(id);
  if (!s) throw new SkillError("That skill doesn't exist.", 404);
  if (s.builtIn) throw new SkillError(`${s.name} is always on.`);
  const wf = workflowOf(s);
  if (!wf) throw new SkillError(`${s.name} isn't ready yet.`);
  if (!packs.allowed(wf, ledger.tierOf(user))) throw new SkillError(`${s.name} is part of ${wf.tier === 'circle' ? "the Founder's Circle" : 'Builder'}.`, 403);
  const have = scheduleOf(user.id, s.id);
  if (have) {
    if (team !== undefined && have.team !== team) {
      have.team = team;
      await deps.db.save('schedules', have);
    }
    return have;
  }
  const tz = (deps.db.get('brains', user.id) || { business: {} }).business.timezone || cron.DEFAULT_TZ;
  const now = deps.now();
  const sch = {
    id: deps.db.id(),
    memberId: user.id,
    skill: s.id,
    workflowId: wf.id,
    title: s.name,
    inputs: {},
    cron: s.cron,
    label: s.label,
    createdAt: new Date(now).toISOString(),
    lastDate: cron.local(now, tz).date,
    lastRunId: null,
    runs: 0,
    lastError: '',
    ...(team ? { team } : {}),
  };
  await deps.db.save('schedules', sch);
  return sch;
}

async function turnOff(user, id) {
  const sch = scheduleOf(user.id, id);
  if (!sch) return false;
  await deps.db.remove('schedules', sch.id);
  return true;
}

// Runs a skill now (the shelf's "Run now", the AI link's run_skill, Ask 127, the AI team).
async function runNow(user, id, { source = 'skill' } = {}) {
  const s = get(id);
  if (!s) throw new SkillError("That skill doesn't exist.", 404);
  const wf = workflowOf(s);
  if (!wf) throw new SkillError(`${s.name} isn't ready yet.`);
  return require('./engine').start(user, wf.id, {}, { source, spendFreeRun: false });
}

// "Get this skill for Claude": a SKILL.md for the member's own Claude, which runs the skill through
// 127's AI link (the member adds the link once, on Make Claude your admin).
function skillMd(skill, base = '') {
  const slug = `127-${skill.id.replace(/^wf:/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const body = `---
name: ${slug}
description: ${skill.name} from 127 HQ. ${skill.what} Use when the member asks for their ${skill.name.toLowerCase()} or says "run ${skill.name.toLowerCase()}".
---

127 content for your own business, under 127's Terms (Section 11). Don't share or sell it.

# ${skill.name}

${skill.what}

This skill uses the member's 127 AI link (the "127" connector). If the 127 tools aren't available, tell the member to add the AI link from 127 HQ: ${base}/app/hq/admin-setup

## Steps

1. Call \`run_skill\` with \`{ "skill": "${skill.id}" }\`. It starts the run in 127 HQ and returns a run id.
2. Call \`get_run\` with that run id until it is done or waiting on the member.
3. Give the member the result in plain words, short. Link the run in HQ.
4. If the run is waiting on the member (an approval), show what it asks and wait for the member's own answer. Only call \`answer_inbox\` after the member says yes in this chat. Never approve on your own.

## Rules

- Nothing is sent, posted or bought from this skill. Anything that would go out waits for the member's OK in 127.
- Use \`brain_search\` for facts about the business before guessing.
- When the member decides something, offer to log it with \`log_decision\`.
`;
  return { slug, body };
}

function bundle(skill, base) {
  const { slug, body } = skillMd(skill, base);
  return { name: `${slug}.zip`, zip: makeZip([{ name: `${slug}/SKILL.md`, data: body }]) };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { CATALOG, list, get, turnOn, turnOff, runNow, skillMd, bundle, workflowOf, scheduleOf, SkillError, _setDeps };
