// What's new and what's working (HQ_NUDGES, Eli Oct 21): each week HQ notices what landed on the shelves since last
// week (workflows, prompts, Store items and site designs) and shows it as "New in 127 this week", with no one having
// to write a post. "Most run this week" is the workflows members finished most in the last 7 days: a count of runs
// across everyone, shown only once at least MIN_MEMBERS different members ran it, so it never points at one member.
//
// The shelves have no "added on" dates, so HQ keeps a snapshot of every item id (harnessCache `drops:seen`) and, the
// first time anyone opens HQ in a new week, keeps what's new against it as that week's drop (`drops:<Monday>`). The
// first snapshot ever is a baseline and makes no drop. Both carry an expiresAt like lib/harness/cache.js entries, so its
// sweep and size cap treat them like any other entry (a week's drop goes after 60 days). content/drops.json may pin picks with a line each for a week:
// { "weeks": { "2026-10-26": [{ "kind": "workflows", "id": "content.plan_week", "line": "..." }] } }.

const fs = require('fs');
const path = require('path');
const deps = { db: require('../db'), now: () => Date.now() };
const today = require('./today');

const MAX_NEW = 12;
const MIN_MEMBERS = 3;
const SEEN = 'drops:seen';
const PICKS = path.join(__dirname, '..', '..', 'content', 'drops.json');
const KIND_NAMES = { workflows: 'Workflow', prompts: 'Prompt', store: 'Store', designs: 'Site design' };

function shelves() {
  const out = [];
  const take = (fn) => { try { out.push(...fn()); } catch (e) { /* a shelf that won't load just isn't in this week's drop */ } };
  take(() => require('./index').packs.workflows().filter((w) => !w.hidden).map((w) => ({ kind: 'workflows', id: w.id, title: w.title, href: `/app/hq/w/${w.id}` })));
  take(() => require('./prompts').load().prompts.map((p) => ({ kind: 'prompts', id: p.id, title: p.title, href: `/app/hq/prompts/${p.id}` })));
  take(() => require('../store').list().map((i) => ({ kind: /design|template/i.test(String(i.kind)) && /site/i.test(`${i.kind} ${i.title}`) ? 'designs' : 'store', id: i.id, title: i.title, href: `/app/hq/store/${i.id}` })));
  return out.map((x) => ({ ...x, key: `${x.kind}:${x.id}`, kindName: KIND_NAMES[x.kind] }));
}

function picksFor(week) {
  try {
    const raw = JSON.parse(fs.readFileSync(PICKS, 'utf8'));
    return (raw.weeks && raw.weeks[week]) || [];
  } catch (e) {
    return [];
  }
}

// The most-finished workflows of the last 7 days, each run by at least MIN_MEMBERS members.
function mostRun(all = shelves()) {
  const since = new Date(deps.now() - 7 * 864e5).toISOString();
  const by = new Map();
  for (const r of deps.db.filter('runs', (x) => x.status === 'done' && String(x.endedAt) >= since && !x.sample)) {
    const e = by.get(r.workflowId) || { runs: 0, members: new Set() };
    e.runs += 1;
    e.members.add(r.memberId);
    by.set(r.workflowId, e);
  }
  const titles = new Map(all.filter((x) => x.kind === 'workflows').map((x) => [x.id, x]));
  return [...by.entries()].filter(([id, e]) => e.members.size >= MIN_MEMBERS && titles.has(id)).sort((a, b) => b[1].runs - a[1].runs).slice(0, 3).map(([id, e]) => ({ ...titles.get(id), runs: e.runs }));
}

// This week's drop: { week, items, picks, mostRun, counts }. Writes at most twice a week (the snapshot and the drop).
async function thisWeek() {
  const week = today.weekStart(today.dayKey(deps.now()));
  const all = shelves();
  let drop = deps.db.get('harnessCache', `drops:${week}`);
  if (!drop) {
    const seen = deps.db.get('harnessCache', SEEN);
    const known = new Set((seen && seen.ids) || []);
    const fresh = seen ? all.filter((x) => !known.has(x.key)) : [];
    drop = { id: `drops:${week}`, key: `drops:${week}`, week, items: fresh.slice(0, MAX_NEW).map(({ key, kind, id, title, href }) => ({ key, kind, id, title, href })), total: fresh.length, at: new Date(deps.now()).toISOString(), expiresAt: deps.now() + 60 * 864e5 };
    await deps.db.save('harnessCache', drop);
    await deps.db.save('harnessCache', { id: SEEN, key: SEEN, ids: all.map((x) => x.key), at: drop.at, expiresAt: deps.now() + 400 * 864e5 });
  }
  const byKey = new Map(all.map((x) => [x.key, x]));
  const items = drop.items.filter((x) => byKey.has(x.key)).map((x) => byKey.get(x.key));
  const picks = picksFor(week).map((p) => ({ ...byKey.get(`${p.kind}:${p.id}`), line: String(p.line || '').slice(0, 160) })).filter((p) => p.href);
  const counts = {};
  for (const x of items) counts[x.kindName] = (counts[x.kindName] || 0) + 1;
  return { week, items, total: drop.total, picks, mostRun: mostRun(all), counts };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { thisWeek, shelves, mostRun, MIN_MEMBERS, _setDeps };
