// Feature flags for the turnkey workspace pieces, each off unless its env var says otherwise:
// "on" (or "true") for every HQ v2 member, "admins" for ADMIN_EMAILS only (to try a piece on the
// live site before Legal clears it for members). Anything else, or unset, is off.
//
// BRAIN_DOCS      Brain docs, search, house rules, decisions, Obsidian and Notion import/export
// HQ_ACTIVITY     the Activity log (/app/hq/activity)
// HQ_AGENT        Ask 127, the chat in HQ
// HQ_SKILLS       the Skills shelf
// HQ_MCP_BRAIN    the AI link's Brain, skills and activity tools, and "Make Claude your admin"
// HQ_TEAM         the AI team (role cards: hire, pause, budget, weekly report)
// HQ_SITE_AGENT   the customer chat on a member's site, answering from public Brain docs
// HQ_PROMPTS      the prompt library in HQ, each prompt a form (content/prompts)

const NAMES = ['BRAIN_DOCS', 'HQ_ACTIVITY', 'HQ_AGENT', 'HQ_SKILLS', 'HQ_MCP_BRAIN', 'HQ_TEAM', 'HQ_SITE_AGENT', 'HQ_PROMPTS'];

function admin(user) {
  const list = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return !!(user && user.email && list.includes(String(user.email).toLowerCase()));
}

function value(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}

function on(name, user) {
  const v = value(name);
  return v === 'on' || (v === 'admins' && admin(user));
}

function forUser(user) {
  return Object.fromEntries(NAMES.map((n) => [n, on(n, user)]));
}

module.exports = { on, value, forUser, NAMES };
