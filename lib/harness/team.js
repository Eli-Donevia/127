// The AI team (HQ_TEAM, BUILD-PLAN W12): AI employees a member hires in one tap. A role is a card: the job,
// the skills it runs on a schedule, the workflows it may start, the connections it may read or
// write, what always waits for the member's OK, and a monthly credit budget. Its runs carry the
// source team:<id>, so the Activity log names it, its budget counts them, and a paused role or one
// over budget skips its turn. It follows the member's house rules like every AI call does.
//
// Everything a role drafts that would go out (a message, a post, a campaign) waits in the Inbox for
// the member, who sends it themselves. Customer-facing chat says it's automated.
//
// Legal L76 and L83 (legal/handoffs/turnkey.md row 13, R1 to R7): each card says "AI employee", next to
// a first name and a title with "AI" in it ("Mia, AI social media lead"), never a person's photo. The
// job says only what it does in HQ today, for the member's OK, and which plan has it; titles describe
// the work, never a licensed one; copy never claims it replaces staff, saves hours or runs on its own.
// The hiring role never ranks, scores or screens real applicants (R6), and review replies follow R7.
//
// Packs can add roles: a pack may export roles: [{ id, title, first, job, skills, workflows, connectors,
// needsOk, budget }] (contract v1.10; first is optional). Roles name skills by their Skills id (lib/harness/skills.js)
// or 'wf:<workflow id>'.

const deps = { db: require('../db'), now: () => Date.now() };
const packs = require('./packs');
const ledger = require('./ledger');
const skills = require('./skills');

const ROLES = [
  {
    id: 'sales_rep',
    first: 'Ava',
    title: 'AI sales lead',
    job: 'Finds people to talk to, drafts the first message and the follow-ups for your OK, and keeps your Pipeline up to date.',
    skills: ['follow_up_sweep', 'daily_numbers'],
    workflows: ['leads.daily_25', 'warm.daily_25', 'warm.follow_up', 'leads.research_one', 'sales.call_prep', 'sales.send_proposal'],
    connectors: { read: ['gmail', 'calendly'], write: [] },
    needsOk: ['Every message before you send it', 'Anything with a price'],
    budget: 400,
  },
  {
    id: 'social_manager',
    first: 'Mia',
    title: 'AI social media lead',
    job: 'Drafts your week of posts, hooks, scripts and captions, and a bank of replies for comments and DMs, all for your OK.',
    skills: ['content_week'],
    workflows: ['content.plan_week', 'content.hooks', 'content.scripts', 'content.carousel', 'content.repurpose', 'dm.reply_bank'],
    connectors: { read: ['instagram', 'tiktok'], write: [] },
    needsOk: ['Every post and reply before it goes up'],
    budget: 300,
  },
  {
    id: 'ads_manager',
    first: 'Theo',
    title: 'AI ads lead',
    job: "Checks if ads are worth it yet, builds the test, and reads the results each week. Nothing spends until you turn it on.",
    skills: ['wf:ads.optimize', 'weekly_working'],
    workflows: ['ads.ready_check', 'ads.launch_kit', 'ads.read_results', 'ads.ad_images', 'ads.landing_check'],
    connectors: { read: ['meta_ads', 'google_ads', 'tiktok_ads'], write: [] },
    needsOk: ['Any change to a live ad or budget', 'Every new campaign (made paused)'],
    budget: 300,
  },
  {
    id: 'bookkeeper',
    first: 'Nora',
    title: 'AI bookkeeping helper',
    job: 'Lays out your numbers: what came in, what went out, who owes you, and drafts invoices and reminders for your OK. Not tax or accounting advice.',
    skills: ['daily_numbers'],
    workflows: ['finance.know_your_numbers', 'finance.tax_ready', 'sales.get_paid', 'sales.send_invoice'],
    connectors: { read: ['stripe', 'shopify', 'quickbooks'], write: [] },
    needsOk: ['Every invoice and reminder before it goes out'],
    budget: 200,
  },
  {
    id: 'support_rep',
    first: 'Sam',
    title: 'AI support lead',
    job: 'Drafts answers to your customers and review replies from your Brain, and builds your FAQ and saved replies. Review replies add nothing about the reviewer they didn\'t post, and never offer anything to change a review.',
    skills: [],
    workflows: ['dm.reply_bank', 'warm.reply'],
    connectors: { read: ['gmail'], write: [] },
    needsOk: ['Every answer before you send it'],
    budget: 200,
  },
  {
    id: 'assistant',
    first: 'Leo',
    title: 'AI admin assistant',
    job: 'Your morning numbers, who to follow up with, your week planned. Pairs with your own Claude for email and calendar.',
    skills: ['daily_numbers', 'follow_up_sweep', 'weekly_working'],
    workflows: ['warm.follow_up', 'sales.call_prep'],
    connectors: { read: ['gmail', 'google_calendar'], write: [] },
    needsOk: ['Every email and invite before it goes out'],
    budget: 300,
  },
  {
    id: 'ops_manager',
    first: 'Iris',
    title: 'AI operations lead',
    job: 'Turns how you work into checklists and SOPs, drafts your new-client kit, and helps you pick simple tools.',
    skills: [],
    workflows: ['ops.write_sop', 'ops.pick_stack', 'brand.ops_manual', 'brand.onboarding_kit'],
    connectors: { read: ['notion'], write: [] },
    needsOk: ['Anything shared with a client'],
    budget: 150,
  },
  {
    id: 'recruiter',
    first: 'Jules',
    title: 'AI hiring helper',
    job: 'Writes the job post with a pay range, a paid test task, a scorecard and questions about the job, for you to use when you hire. It never ranks, scores or screens real applicants.',
    skills: [],
    workflows: ['ops.hire_first_helper'],
    connectors: { read: [], write: [] },
    needsOk: ['Every post and message to a candidate'],
    budget: 100,
  },
  {
    id: 'content_producer',
    first: 'Kai',
    title: 'AI video editor',
    job: 'Cuts your long videos into clips, adds captions and makes thumbnails, for your OK before anything goes up.',
    skills: [],
    workflows: ['video.long_to_clips', 'video.caption', 'video.thumbnail', 'video.faceless_short', 'faceless.make_one'],
    connectors: { read: ['youtube'], write: [] },
    needsOk: ['Every video before it goes up'],
    budget: 400,
  },
];

class TeamError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function roles() {
  const fromPacks = [];
  for (const p of packs.registry.packs.values()) for (const r of Array.isArray(p.roles) ? p.roles : []) if (r && r.id && r.title) fromPacks.push({ ...r, pack: p.id });
  const ids = new Set(fromPacks.map((r) => r.id));
  return ROLES.filter((r) => !ids.has(r.id)).concat(fromPacks);
}

// The connections a helper's card lists (L76 R1): read only in v2.0.
function uses(r) {
  const byId = require('./connectors/catalog').byId;
  return ((r && r.connectors && r.connectors.read) || []).map((id) => (byId[id] || { name: id }).name);
}

function role(id) {
  return roles().find((r) => r.id === id) || null;
}

// "Mia, AI social media lead": the card's name (L83 R3). A hired role takes its role's current name.
function nameOf(r) {
  return r ? (r.first ? `${r.first}, ${r.title}` : r.title) : '';
}

function display(t) {
  return nameOf(role(t.role)) || t.name;
}

// Which plan has it (L83 R4): Builder includes every role; a role with a workflow on Free is on every plan.
function plan(r) {
  return (r.workflows || []).some((id) => {
    const wf = packs.workflow(id);
    return wf && packs.allowed(wf, 'free');
  })
    ? 'On every plan'
    : 'In Builder';
}

// What a role can do for this member now.
function ready(r, user) {
  const tier = ledger.tierOf(user);
  const wfs = (r.workflows || []).map((id) => packs.workflow(id)).filter((wf) => wf && packs.allowed(wf, tier));
  const sk = (r.skills || []).map((id) => skills.list(user).find((s) => s.id === id || s.workflowId === String(id).replace(/^wf:/, ''))).filter((s) => s && (s.status === 'off' || s.status === 'on'));
  return { workflows: wfs, skills: sk };
}

function list(user) {
  return deps.db.filter('team', (t) => t.memberId === user.id).sort((a, b) => String(a.hiredAt).localeCompare(String(b.hiredAt)));
}

function get(user, id) {
  const t = deps.db.get('team', String(id || ''));
  return t && t.memberId === user.id ? t : null;
}

const monthStart = () => {
  const d = new Date(deps.now());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

function runsOf(t, since) {
  return deps.db.filter('runs', (r) => r.memberId === t.memberId && r.source === `team:${t.id}` && (!since || String(r.createdAt) >= since));
}

function spent(t) {
  return runsOf(t, monthStart()).reduce((n, r) => n + ((r.credits && (r.credits.used || r.credits.estimate)) || 0), 0);
}

// Why a role can't run now ('' when it can). user: its member.
function holds(teamId, user) {
  const t = deps.db.get('team', String(teamId || ''));
  if (!t || (user && t.memberId !== user.id)) return 'Skipped: that AI employee is gone.';
  if (!require('./flags').on('HQ_TEAM', user || deps.db.get('users', t.memberId))) return 'Skipped: the AI team is switched off.';
  if (t.status === 'paused') return `Skipped: ${display(t)} is paused.`;
  if (spent(t) >= t.budget) return `Skipped: ${display(t)} used its ${t.budget} credits this month.`;
  return '';
}

// Can this role use a connection? write: true for anything that changes the member's account.
function allows(teamId, connector, write = false) {
  const t = deps.db.get('team', String(teamId || ''));
  if (!t) return false;
  const c = t.connectors || { read: [], write: [] };
  return write ? (c.write || []).includes(connector) : (c.read || []).includes(connector) || (c.write || []).includes(connector);
}

async function hire(user, roleId, { budget } = {}) {
  const r = role(roleId);
  if (!r) throw new TeamError("That role doesn't exist.", 404);
  if (list(user).some((t) => t.role === r.id)) throw new TeamError(`${nameOf(r)} is already on your team.`);
  if (list(user).length >= 12) throw new TeamError('Your team has 12 AI employees. Remove one first.');
  const ok = ready(r, user);
  if (!ok.workflows.length && !ok.skills.length) throw new TeamError(`${nameOf(r)} isn't on your plan yet.`);
  const b = Math.max(10, Math.min(5000, Math.round(Number(budget) || r.budget || 200)));
  const t = { id: deps.db.id(), memberId: user.id, role: r.id, name: nameOf(r), status: 'active', budget: b, connectors: { read: [...((r.connectors || {}).read || [])], write: [] }, hiredAt: new Date(deps.now()).toISOString() };
  await deps.db.save('team', t);
  for (const s of ok.skills) await skills.turnOn(user, s.id, { team: t.id });
  return t;
}

async function setStatus(user, id, status) {
  const t = get(user, id);
  if (!t) throw new TeamError("That role isn't on your team.", 404);
  t.status = status === 'paused' ? 'paused' : 'active';
  await deps.db.save('team', t);
  return t;
}

async function setBudget(user, id, budget) {
  const t = get(user, id);
  if (!t) throw new TeamError("That role isn't on your team.", 404);
  const n = Math.round(Number(budget));
  if (!Number.isFinite(n) || n < 10 || n > 5000) throw new TeamError('Set a budget between 10 and 5,000 credits a month.');
  t.budget = n;
  await deps.db.save('team', t);
  return t;
}

// Letting a role go turns off the skills it ran. Its runs and their results stay on Runs.
async function letGo(user, id) {
  const t = get(user, id);
  if (!t) return null;
  for (const s of deps.db.filter('schedules', (x) => x.memberId === user.id && x.team === t.id)) await deps.db.remove('schedules', s.id);
  await deps.db.remove('team', t.id);
  return t;
}

async function start(user, id, workflowId, inputs = {}) {
  const t = get(user, id);
  if (!t) throw new TeamError("That role isn't on your team.", 404);
  const r = role(t.role) || { workflows: [] };
  if (!(r.workflows || []).includes(workflowId)) throw new TeamError(`${display(t)} doesn't do that one.`);
  const why = holds(t.id, user);
  if (why) throw new TeamError(why.replace(/^Skipped: /, ''));
  return require('./engine').start(user, workflowId, inputs, { source: `team:${t.id}`, spendFreeRun: false });
}

// The role's week: what it ran, what's waiting on the member, and what it spent.
function report(user, t, days = 7) {
  const since = new Date(deps.now() - days * 864e5).toISOString();
  const runs = runsOf(t, since).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    runs: runs.slice(0, 20).map((r) => ({ id: r.id, title: r.title, status: r.status, at: r.createdAt })),
    done: runs.filter((r) => r.status === 'done').length,
    waiting: runs.filter((r) => r.status === 'waiting').length,
    failed: runs.filter((r) => r.status === 'failed').length,
    spentMonth: spent(t),
    budget: t.budget,
    skills: skills.list(user, { team: t.id }),
  };
}

function view(user, t) {
  const r = role(t.role) || { title: t.name, job: '', needsOk: [], workflows: [] };
  return { ...t, name: display(t), title: r.title, first: r.first || '', plan: plan(r), job: r.job, uses: uses(t), needsOk: r.needsOk || [], workflows: ready(r, user).workflows.filter((wf) => (r.workflows || []).includes(wf.id)).map((wf) => ({ id: wf.id, title: wf.title, promise: wf.promise, required: ((wf.inputs && wf.inputs.required) || []).length })), report: report(user, t) };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { ROLES, roles, role, nameOf, display, plan, uses, ready, list, get, hire, setStatus, setBudget, letGo, start, holds, allows, spent, report, view, TeamError, _setDeps };
