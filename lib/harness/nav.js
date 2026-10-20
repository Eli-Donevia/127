// HQ as a workspace (W9, flag HQ_WORKSPACE=on): one place to move around the member's business. A rail on wide
// screens, a bar of five on phones with the rest one tap away, and a jump-to box (Cmd/Ctrl K, or "/") over every page
// and workflow. Off, HQ keeps its tabs (views/partials/hq2-nav.ejs).
//
// An item shows only once its page is on main and the member can open it: `ready` is true, or a function of the member
// and their flags. Studio (W4) turns its own line on when its pages land; the Store (W7) follows STORE_V2.

const on = () => process.env.HQ_WORKSPACE === 'on';

// [id, label, href, icon, group, ready]. The order is the order on screen. href and ready may be functions of
// ({ user, flags }), flags being lib/harness/flags.js forUser(user).
const F = (name) => ({ flags }) => !!(flags && flags[name]);
const connectorsOn = ({ user }) => { try { return require('./connectors').on(user); } catch (e) { return false; } };
const boardsOn = ({ user }) => { try { return require('./connectors/dashboards').on(user); } catch (e) { return false; } };
const ITEMS = [
  ['today', 'Today', '/app/hq', 'sun', 'work', true],
  ['ask', 'Ask 127', ({ flags }) => (flags && flags.HQ_AGENT ? '/app/hq/ask' : '/app/hq#talk'), 'spark', 'work', true],
  ['inbox', 'Inbox', '/app/hq/inbox', 'inbox', 'work', true],
  ['pipeline', 'Pipeline', '/app/hq/pipeline', 'columns', 'work', true],
  ['workflows', 'Workflows', '/app/hq/start', 'bolt', 'make', true],
  ['studio', 'Studio', '/app/hq/studio', 'film', 'make', false],
  ['prompts', 'Prompts', '/app/hq/prompts', 'quote', 'make', F('HQ_PROMPTS')],
  ['store', 'Store', '/app/hq/store', 'bag', 'make', F('STORE_V2')],
  ['team', 'AI team', '/app/hq/team', 'users', 'run', F('HQ_TEAM')],
  ['skills', 'Skills', '/app/hq/skills', 'repeat', 'run', F('HQ_SKILLS')],
  ['site-chat', 'Site chat', '/app/hq/site-chat', 'chat', 'run', F('HQ_SITE_AGENT')],
  ['runs', 'Runs', '/app/hq/runs', 'play', 'run', true],
  ['numbers', 'Numbers', '/app/hq?v1=1', 'chart', 'run', true],
  ['boards', 'Dashboards', '/app/hq/boards', 'grid', 'run', boardsOn],
  ['activity', 'Activity', '/app/hq/activity', 'list', 'run', F('HQ_ACTIVITY')],
  ['brain', 'Brain', '/app/hq/brain', 'brain', 'know', true],
  ['roadmap', 'Your 30 days', '/app?roadmap=1', 'map', 'know', F('HQ_PREMIUM')],
  ['library', 'Library', '/app/hq/library', 'folder', 'know', true],
  ['connections', 'Connections', '/app/hq/connect', 'plug', 'know', connectorsOn],
  ['setup', 'AI link', '/app/hq/setup', 'link', 'know', true],
];
const GROUPS = [
  ['work', 'Work'],
  ['make', 'Make'],
  ['run', 'Runs on its own'],
  ['know', 'Your business'],
];
const GROUPS_PREMIUM = [
  ['work', 'Today'],
  ['build', 'Build with'],
  ['run', 'Runs on its own'],
  ['know', 'Your business'],
];
// The phone bar: four places and More (Ask 127 sits in the middle as the orb).
const PHONE = ['today', 'workflows', 'ask', 'inbox'];
// Which item a page belongs to, when its view isn't an item's id.
const VIEW_OF = { start: 'workflows', workflow: 'workflows', run: 'runs', import: 'today', win: 'today', 'brain-doc': 'brain', 'team-role': 'team', prompt: 'prompts', 'admin-setup': 'setup', connect: 'connections', apps: 'connections' };

const val = (v, c) => (typeof v === 'function' ? v(c) : v);

// The premium pass (HQ_PREMIUM): the libraries and connections move up into one "Build with" group, each with how
// many things it holds, so a member sees how much 127 can run before opening anything. Counted once a minute.
const BUILD = ['workflows', 'studio', 'prompts', 'store', 'connections'];
let shelf = null;
function shelfCounts(now = Date.now()) {
  if (shelf && now - shelf.at < 60000) return shelf.n;
  const n = {};
  const count = (k, fn) => { try { n[k] = fn(); } catch (e) { n[k] = 0; } };
  count('workflows', () => require('./index').packs.workflows().filter((w) => !w.hidden).length);
  count('prompts', () => require('./prompts').load().prompts.length);
  count('store', () => require('../store').list().length);
  count('connections', () => require('./connectors/catalog').APPS.length);
  shelf = { at: now, n };
  return n;
}

// { groups: [{ id, label, items: [{ id, label, href, icon, here, count }] }], phone: [...items], more: [...items], here }
function workspace(user, { tab = '', inboxCount = 0, flags = {} } = {}) {
  const here = VIEW_OF[tab] || tab, c = { user, flags };
  const premium = !!(flags && flags.HQ_PREMIUM), n = premium ? shelfCounts() : {};
  const items = ITEMS.filter((it) => !!val(it[5], c)).map(([id, label, href, icon, group]) => ({
    id, label, href: val(href, c), icon, group: premium && BUILD.includes(id) ? 'build' : group, here: id === here, count: id === 'inbox' ? inboxCount : 0, holds: n[id] || 0,
  }));
  const groups = (premium ? GROUPS_PREMIUM : GROUPS).map(([id, label]) => ({ id, label, items: items.filter((i) => i.group === id) })).filter((g) => g.items.length);
  const phone = PHONE.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const more = items.filter((i) => !PHONE.includes(i.id));
  return { groups, phone, more, here, premium, shelf: n };
}

// Everything 127 can run, as one list for the Map of everything (HQ_PREMIUM): [shelf, title, link] per item, only for
// the shelves this member's rail shows. Cached with the counts.
let map = null;
function mapItems(ws, now = Date.now()) {
  if (!map || now - map.at > 60000) {
    const all = { workflows: [], prompts: [], store: [], connections: [] };
    const take = (k, fn) => { try { all[k] = fn(); } catch (e) { all[k] = []; } };
    take('workflows', () => require('./index').packs.workflows().filter((w) => !w.hidden).map((w) => ['workflows', w.title, `/app/hq/w/${w.id}`]));
    take('prompts', () => require('./prompts').load().prompts.map((p) => ['prompts', p.title, `/app/hq/prompts/${p.id}`]));
    take('store', () => require('../store').list().map((i) => ['store', i.title, `/app/hq/store/${i.id}`]));
    take('connections', () => require('./connectors/catalog').APPS.map((a) => ['connections', a.name, '/app/hq/connect#apps']));
    map = { at: now, all };
  }
  const shown = new Set(((ws && ws.groups) || []).flatMap((g) => g.items.map((i) => i.id)));
  return Object.keys(map.all).filter((k) => shown.has(k)).flatMap((k) => map.all[k]);
}

module.exports = { on, workspace, shelfCounts, mapItems, ITEMS, GROUPS, PHONE };
