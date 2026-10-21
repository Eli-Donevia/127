// Feature flags for the turnkey workspace pieces, each off unless its env var says otherwise:
// "on" (or "true") for every HQ v2 member, "admins" for ADMIN_EMAILS only (to try a piece on the
// live site before Legal clears it for members). Anything else, or unset, is off. Like Hub's
// connector switches, "on" reaches members only while TERMS_LIVE and PRIVACY_LIVE are both true;
// until then it acts as "admins".
//
// BRAIN_DOCS      Brain docs, search, house rules, decisions, Obsidian and Notion import/export
// HQ_ACTIVITY     the Activity log (/app/hq/activity)
// HQ_AGENT        Ask 127, the chat in HQ
// HQ_SKILLS       the Skills shelf
// HQ_MCP_BRAIN    the AI link's Brain, skills and activity tools, and "Make Claude your admin"
// HQ_TEAM         the AI team (role cards: hire, pause, budget, weekly report)
// HQ_SITE_AGENT   the customer chat on a member's site, answering from public Brain docs
// HQ_PROMPTS      the prompt library in HQ, each prompt a form (content/prompts)
// HQ_SCRIPTS      AI scripts (/app/hq/scripts): step-by-step asks for a whole job (lib/harness/scripts.js), and the
//                 Briefs they start from (/app/hq/briefs): a guided form that becomes one build-ready brief (lib/harness/briefs.js)
// HQ_PLANNER      Ask 127 plans: a goal becomes steps from the libraries and connections, priced, run on one OK (lib/harness/planner.js); needs HQ_AGENT
// HQ_PREMIUM     the premium pass on the HQ workspace (needs HQ_WORKSPACE): rail with shelf counts, the horizon light,
//                 Today's rings and shelves, the plan card's motion (public/css/hq-premium.css, public/js/hq-premium.js)
// HQ_LIFE         Life in HQ (/app/hq/life): budget, workout planner, food log, daily check-in, kept in the member's own browser (lib/life);
//                 the food log and check-in also wait for Legal by id in LIFE_CLEARED
// HQ_NUDGES       HQ that notices (lib/harness/nudges.js): Today's one line, the run with rest days, levels, marks, the
//                 weekly challenge and Monday card, and Progress (/app/hq/you) with the month and the ship log
// BRAIN_AUTOFILL  draft the Brain from the member's own website (one read) or a pasted Instagram bio, approved line by line (lib/harness/autofill.js, Legal L84)
// HQ_FIRST_RUN    a new member's first run, payoff first: Ava (AI employee) learns the business, offers the first
//                 connections, then the first win (their site, or First 25); Day one shows after (lib/harness/first-run.js)
// HQ_PERKS        Perks and grants (/app/hq/perks): startup credits, discounts, grants and free help from official pages,
//                 with a member's saved list kept in their own browser (lib/perks)
// HQ_TAPE         Tape (/app/hq/tape): a watchlist for traders with charts, the member's own flags and a facts-only read,
//                 on the member's own market data key (lib/tape, Legal L88 TK1-TK8)
// HQ_TOOLS        native tools (/app/hq/tools): the Store's spreadsheets rebuilt as live pages over the member's own saved numbers (lib/tools)
// STORE_V2        the HQ Store (/app/hq/store): templates, kits and prompt packs, and Make it mine (lib/store.js)

const NAMES = ['BRAIN_DOCS', 'HQ_ACTIVITY', 'HQ_AGENT', 'HQ_SKILLS', 'HQ_MCP_BRAIN', 'HQ_TEAM', 'HQ_SITE_AGENT', 'HQ_PROMPTS', 'HQ_SCRIPTS', 'HQ_PLANNER', 'HQ_PREMIUM', 'HQ_LIFE', 'HQ_NUDGES', 'BRAIN_AUTOFILL', 'HQ_FIRST_RUN', 'HQ_PERKS', 'HQ_TAPE', 'HQ_TOOLS', 'STORE_V2'];

function admin(user) {
  const list = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  // A confirmed email, as index.js's admin check asks: signing up with an admin's address isn't enough.
  return !!(user && user.email && user.emailVerified && list.includes(String(user.email).toLowerCase()));
}

function value(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  if (v === 'on' || v === 'true') return 'on';
  if (v === 'admins') return 'admins';
  return 'off';
}

const live = (k) => String(process.env[k] || '').trim().toLowerCase() === 'true';

function on(name, user) {
  const v = value(name);
  if (v === 'on' && live('TERMS_LIVE') && live('PRIVACY_LIVE')) return true;
  return v !== 'off' && admin(user);
}

function forUser(user) {
  return Object.fromEntries(NAMES.map((n) => [n, on(n, user)]));
}

module.exports = { on, value, forUser, admin, NAMES };
