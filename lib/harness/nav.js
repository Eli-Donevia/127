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
  ['runs', 'Runs', '/app/hq/runs', 'play', 'run', true],
  ['numbers', 'Numbers', '/app/hq?v1=1', 'chart', 'run', true],
  ['activity', 'Activity', '/app/hq/activity', 'list', 'run', F('HQ_ACTIVITY')],
  ['brain', 'Brain', '/app/hq/brain', 'brain', 'know', true],
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
// The phone bar: four places and More (Ask 127 sits in the middle as the orb).
const PHONE = ['today', 'workflows', 'ask', 'inbox'];
// Which item a page belongs to, when its view isn't an item's id.
const VIEW_OF = { start: 'workflows', workflow: 'workflows', run: 'runs', import: 'today', win: 'today', 'brain-doc': 'brain', 'team-role': 'team', prompt: 'prompts', 'admin-setup': 'setup', connect: 'connections', apps: 'connections' };

const val = (v, c) => (typeof v === 'function' ? v(c) : v);

// { groups: [{ id, label, items: [{ id, label, href, icon, here, count }] }], phone: [...items], more: [...items], here }
function workspace(user, { tab = '', inboxCount = 0, flags = {} } = {}) {
  const here = VIEW_OF[tab] || tab, c = { user, flags };
  const items = ITEMS.filter((it) => !!val(it[5], c)).map(([id, label, href, icon, group]) => ({
    id, label, href: val(href, c), icon, group, here: id === here, count: id === 'inbox' ? inboxCount : 0,
  }));
  const groups = GROUPS.map(([id, label]) => ({ id, label, items: items.filter((i) => i.group === id) })).filter((g) => g.items.length);
  const phone = PHONE.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const more = items.filter((i) => !PHONE.includes(i.id));
  return { groups, phone, more, here };
}

module.exports = { on, workspace, ITEMS, GROUPS, PHONE };
