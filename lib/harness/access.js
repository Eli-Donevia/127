// Early access to HQ v2 while it's admins-only (HARNESS_V2=admins), for the public build's founder
// (v2/proof/public-build.md; DECISIONS H54). An admin gives one member HQ v2 from /admin, and with it a
// plan inside HQ (Builder by default, or Circle: its workflows, never the Circle's calls) and a monthly
// credit allowance until a date they pick, without touching billing. The plan sets what's on screen, so
// the build shows what Builder has; the credits are separate so checking gyms by hand can't stall it.
// It counts once the member's email is confirmed, so an account made with someone else's address gets
// nothing. Removing it takes HQ v2 away again; their work stays.

const deps = { db: require('../db'), now: () => Date.now() };
const PLANS = ['builder', 'circle'];
const DAY = 864e5;
const DEFAULT_DAYS = 45;
const DEFAULT_CREDITS = 5000;
const MAX_CREDITS = 20000;

const norm = (email) => String(email || '').trim().toLowerCase();
const iso = (ms) => new Date(ms).toISOString();

// The grant counts for this member (HQ v2 shows while it's admins-only).
function active(user) {
  return !!(user && user.hqV2 && user.emailVerified);
}

// The plan the grant adds inside HQ while it lasts, or ''.
function plan(user, now = deps.now()) {
  if (!active(user) || !PLANS.includes(user.hqV2.plan)) return '';
  return !user.hqV2.planUntil || Date.parse(user.hqV2.planUntil) > now ? user.hqV2.plan : '';
}

// The monthly credits the grant gives while its plan lasts, or 0 (the plan's own allowance counts).
function credits(user, now = deps.now()) {
  return plan(user, now) ? Math.max(0, Math.floor(Number(user.hqV2.credits) || 0)) : 0;
}

// The date box's default: about six weeks, past the build and its live.
function defaultUntil(now = deps.now()) {
  return iso(now + DEFAULT_DAYS * DAY).slice(0, 10);
}

// until: YYYY-MM-DD, the last day of the plan (it ends at midnight Eastern after it).
async function give(email, { by = '', until, plan: p = 'builder', credits: c } = {}) {
  const want = norm(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(want)) return { error: 'Type the email they signed up with.' };
  const user = deps.db.find('users', (u) => norm(u.email) === want);
  if (!user) return { error: `No 127 account uses ${want} yet. Ask them to sign up first, then give access.` };
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(until || '')) ? String(until) : defaultUntil();
  const end = Date.parse(`${day}T00:00:00Z`) + DAY + 5 * 3600e3;
  if (!Number.isFinite(end) || end <= deps.now()) return { error: 'Pick a date after today.' };
  const n = c === undefined || String(c).trim() === '' ? DEFAULT_CREDITS : Number(String(c).replace(/[,\s]/g, ''));
  if (!Number.isInteger(n) || n < 0 || n > MAX_CREDITS) return { error: `Credits a month: a whole number from 0 to ${MAX_CREDITS.toLocaleString('en-US')}.` };
  user.hqV2 = { at: (user.hqV2 && user.hqV2.at) || iso(deps.now()), by: norm(by), plan: PLANS.includes(p) ? p : 'builder', credits: n, planUntil: iso(end), until: day };
  await deps.db.save('users', user);
  return { user };
}

async function remove(id) {
  const user = deps.db.get('users', String(id || ''));
  if (!user || !user.hqV2) return null;
  delete user.hqV2;
  await deps.db.save('users', user);
  return user;
}

// For /admin: everyone with a grant, newest first.
function list(now = deps.now()) {
  return deps.db
    .filter('users', (u) => !!u.hqV2)
    .map((u) => ({ id: u.id, email: u.email, name: u.name || '', at: u.hqV2.at, by: u.hqV2.by, plan: u.hqV2.plan, credits: u.hqV2.credits || 0, until: u.hqV2.until, confirmed: !!u.emailVerified, planOn: !!plan(u, now), paid: u.tier === 'builder' || u.tier === 'circle' }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { PLANS, DEFAULT_DAYS, DEFAULT_CREDITS, active, plan, credits, defaultUntil, give, remove, list, _setDeps };
