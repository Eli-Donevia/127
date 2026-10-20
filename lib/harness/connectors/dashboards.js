// Custom dashboards (BUILD-PLAN W14): boards of tiles a member builds from their own data, arranged by
// dragging. A tile is one number, a line, bars or a table from a source: HQ's weekly numbers, the
// Pipeline, or a connected account (Stripe, Shopify, email, ads, Calendly). Goals and alerts per tile.
// snapshot() turns a board into lines a Skill's daily report can send.
//
// DASHBOARDS=admins|on, default off ("on" means members only while the Terms and Privacy pages are
// live). Connected sources need their connector (index.js); without one a tile says what to connect.
// Boards are in the `boards` collection, one doc per board; they hold settings, never the data.

const hq = require('../../hq');
const needsLib = require('../needs');
const connectors = require('./index');

const deps = { db: require('../../db'), now: () => Date.now(), pipeline: () => require('../pipeline') };
function _setDeps(over) {
  Object.assign(deps, over);
}

const MAX_BOARDS = 6;
const MAX_TILES = 24;
const CACHE_MS = 10 * 60 * 1000;
const VIEWS = ['number', 'line', 'bars', 'table'];
const SIZES = [1, 2, 4];
const RANGES = [7, 30, 90];
const DAY = 864e5;

function flag() {
  const v = String(process.env.DASHBOARDS || '').toLowerCase();
  if (v === 'on' || v === 'true') return needsLib.pagesLive() ? 'on' : 'admins';
  return v === 'admins' ? 'admins' : 'off';
}
function on(user) {
  const m = flag();
  return !!user && hq.canUse(user) && (m === 'on' || (m === 'admins' && connectors.isAdmin(user)));
}

// ---------- sources ----------
// Each metric: { id, label, money?, views (what it can show), get(user, tile) -> { value, series?, rows?, columns? } }.
// series: [{ label, v }] oldest first; rows: table rows.

const bucketDays = (items, days, at, val) => {
  const out = [];
  const start = deps.now() - days * DAY;
  for (let i = 0; i < days; i++) out.push({ label: new Date(start + (i + 1) * DAY).toISOString().slice(5, 10), v: 0 });
  for (const x of items) {
    const t = Date.parse(at(x));
    const i = Math.floor((t - start) / DAY);
    if (i >= 0 && i < days) out[i].v = Math.round((out[i].v + val(x)) * 100) / 100;
  }
  return out;
};
const sum = (list) => Math.round(list.reduce((s, x) => s + (Number(x.v) || 0), 0) * 100) / 100;

function hqMetric(m) {
  return {
    id: `hq:${m.id}`, label: m.label, money: !!m.money, views: ['number', 'line', 'bars'], weekly: true,
    get(user) {
      const s = hq.series(user, m.id, hq.weekKey(deps.now()), 12).map((x) => ({ label: hq.shortDate(x.key), v: x.v }));
      // With nothing logged this week yet, the number is the latest of the last 4 weeks, and the tile says which.
      let i = s.length - 1;
      while (i > s.length - 4 && s[i].v == null) i -= 1;
      if (s[i].v == null) i = s.length - 1;
      const when = i === s.length - 1 ? 'This week' : i === s.length - 2 ? 'Last week' : `Week of ${s[i].label}`;
      return { value: s[i].v, previous: i > 0 ? s[i - 1].v : null, series: s, when };
    },
  };
}

// Dashboards send nothing to AI, so they may read connectors whose data goes to no AI (Legal K10).
const client = (user, id) => (connectors.ready(user, id, { noAi: true }) ? connectors.clientFor(user, id, { who: 'Dashboard', noAi: true }) : null);
const noAi = (id) => !!id && (connectors.catalog.byId[id] || {}).ai === false;

const SOURCES = {
  hq: { name: 'HQ numbers', metrics: (user) => hq.metrics(user).map(hqMetric) },
  pipeline: {
    name: 'Pipeline',
    metrics: () => [
      { id: 'pipeline:stages', label: 'Pipeline by stage', views: ['bars', 'table'], get: (user) => {
        const c = deps.pipeline().counts(user.id);
        const s = Object.entries(c).map(([k, v]) => ({ label: k, v }));
        return { value: sum(s), series: s, columns: ['Stage', 'Leads'], rows: s.map((x) => [x.label, x.v]) };
      } },
      { id: 'pipeline:won', label: 'Won', views: ['number'], get: (user) => ({ value: deps.pipeline().counts(user.id).won || 0 }) },
    ],
  },
  stripe: {
    name: 'Stripe', app: 'stripe',
    metrics: () => [
      { id: 'stripe:revenue', label: 'Revenue', money: true, views: ['number', 'line', 'bars'], live: true, get: async (user, t) => {
        const c = client(user, 'stripe');
        const ch = (await c.charges({ sinceDays: t.days })).filter((x) => x.status === 'succeeded');
        const s = bucketDays(ch, t.days, (x) => x.at, (x) => x.amount - x.refunded);
        return { value: sum(s), series: s };
      } },
      { id: 'stripe:sales', label: 'Paid charges', views: ['number', 'bars'], live: true, get: async (user, t) => {
        const ch = (await client(user, 'stripe').charges({ sinceDays: t.days })).filter((x) => x.status === 'succeeded');
        const s = bucketDays(ch, t.days, (x) => x.at, () => 1);
        return { value: sum(s), series: s };
      } },
      { id: 'stripe:overdue', label: 'Overdue invoices', money: true, views: ['number', 'table'], live: true, get: async (user) => {
        const list = await client(user, 'stripe').invoices({ status: 'open', overdue: true });
        return { value: Math.round(list.reduce((a, i) => a + i.due, 0) * 100) / 100, columns: ['Invoice', 'Due'], rows: list.slice(0, 10).map((i) => [i.number || i.id.slice(-6), i.due]) };
      } },
    ],
  },
  shopify: {
    name: 'Shopify', app: 'shopify',
    metrics: () => [
      { id: 'shopify:revenue', label: 'Store revenue', money: true, views: ['number', 'line', 'bars'], live: true, get: async (user, t) => {
        const o = (await client(user, 'shopify').orders({ sinceDays: t.days })).filter((x) => !x.cancelled);
        const s = bucketDays(o, t.days, (x) => x.at, (x) => x.total);
        return { value: sum(s), series: s };
      } },
      { id: 'shopify:orders', label: 'Orders', views: ['number', 'bars'], live: true, get: async (user, t) => {
        const o = (await client(user, 'shopify').orders({ sinceDays: t.days })).filter((x) => !x.cancelled);
        const s = bucketDays(o, t.days, (x) => x.at, () => 1);
        return { value: sum(s), series: s };
      } },
      { id: 'shopify:top', label: 'Top products', views: ['table'], live: true, get: async (user, t) => {
        const o = (await client(user, 'shopify').orders({ sinceDays: t.days })).filter((x) => !x.cancelled);
        const by = {};
        for (const x of o) for (const l of x.items) by[l.title] = (by[l.title] || 0) + l.price * l.quantity;
        const rows = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, Math.round(v * 100) / 100]);
        return { value: rows.length, columns: ['Product', 'Sales'], rows, money: true };
      } },
      { id: 'shopify:low', label: 'Low stock', views: ['table'], live: true, get: async (user) => {
        const rows = [];
        for (const p of await client(user, 'shopify').products({ limit: 250 })) for (const v of p.variants) if (v.inventory != null && v.inventory <= 5) rows.push([`${p.title}${v.title && v.title !== 'Default Title' ? ` · ${v.title}` : ''}`, v.inventory]);
        return { value: rows.length, columns: ['Product', 'Left'], rows: rows.sort((a, b) => a[1] - b[1]).slice(0, 10) };
      } },
    ],
  },
  email: {
    name: 'Email list',
    metrics: () => [
      ['klaviyo', 'Klaviyo', async (c) => (await c.lists()).reduce((a, l) => a + (l.size || 0), 0)],
      ['mailchimp', 'Mailchimp', async (c) => (await c.lists()).reduce((a, l) => a + (l.size || 0), 0)],
      ['kit', 'Kit', async (c) => (await c.stats()).subscribers],
      ['beehiiv', 'beehiiv', async (c) => (await c.publications()).reduce((a, p) => a + (p.subscribers || 0), 0)],
    ].map(([app, name, read]) => ({ id: `${app}:list`, app, label: `${name} subscribers`, views: ['number'], live: true, get: async (user) => ({ value: await read(client(user, app)) }) })),
  },
  ads: {
    name: 'Ads',
    metrics: () => [['meta_ads', 'Meta'], ['google_ads', 'Google'], ['tiktok_ads', 'TikTok']].flatMap(([app, name]) => {
      const rows = async (user, t) => {
        const c = client(user, app);
        const acct = t.account || ((await c.accounts())[0] || {}).id;
        if (!acct) return [];
        return c.insights(acct, { days: t.days });
      };
      return [
        { id: `${app}:spend`, app, label: `${name} ad spend`, money: true, views: ['number'], live: true, get: async (user, t) => ({ value: Math.round((await rows(user, t)).reduce((a, r) => a + r.spend, 0) * 100) / 100 }) },
        { id: `${app}:cpr`, app, label: `${name} cost per result`, money: true, views: ['number'], live: true, get: async (user, t) => {
          const r = await rows(user, t);
          const res = r.reduce((a, x) => a + x.results, 0);
          return { value: res ? Math.round((r.reduce((a, x) => a + x.spend, 0) / res) * 100) / 100 : null };
        } },
        { id: `${app}:ads`, app, label: `${name} ads`, views: ['table'], live: true, get: async (user, t) => {
          const r = (await rows(user, t)).sort((a, b) => b.spend - a.spend).slice(0, 10);
          return { value: r.length, columns: ['Ad', 'Spend', 'CTR %', 'Per result'], rows: r.map((x) => [x.name, x.spend, x.ctr, x.costPerResult == null ? '–' : x.costPerResult]) };
        } },
      ];
    }),
  },
  calendly: {
    name: 'Calendly', app: 'calendly',
    metrics: () => [{ id: 'calendly:upcoming', label: 'Upcoming bookings', views: ['number', 'table'], live: true, get: async (user) => {
      const b = await client(user, 'calendly').bookings({ daysAhead: 14 });
      return { value: b.length, columns: ['When', 'Event'], rows: b.slice(0, 10).map((x) => [String(x.start).slice(0, 16).replace('T', ' '), x.name]) };
    } }],
  },
};

function allMetrics(user) {
  const out = [];
  for (const [sid, s] of Object.entries(SOURCES)) for (const m of s.metrics(user)) out.push({ ...m, source: sid, sourceName: s.name, app: m.app || s.app || null });
  return out;
}
function metricOf(user, id) {
  return allMetrics(user).find((m) => m.id === id) || null;
}
// What the Add a tile form offers: every metric, and whether its source is connected.
function choices(user) {
  return allMetrics(user).map((m) => ({ id: m.id, label: m.label, source: m.sourceName, views: m.views, ready: !m.app || connectors.ready(user, m.app, { noAi: true }) }));
}

// ---------- templates ----------

const T = (metric, view = 'number', size = 1, more = {}) => ({ metric, view, size, days: 30, ...more });
const TEMPLATES = {
  service: { name: 'Local service', tiles: [T('hq:leads', 'line', 2), T('hq:sales'), T('hq:revenue'), T('pipeline:stages', 'bars', 2), T('pipeline:won'), T('calendly:upcoming'), T('stripe:overdue', 'table', 2)] },
  store: { name: 'Online store', tiles: [T('shopify:revenue', 'line', 2), T('shopify:orders'), T('meta_ads:spend'), T('shopify:top', 'table', 2), T('shopify:low', 'table', 2), T('meta_ads:ads', 'table', 4, { days: 7 })] },
  creator: { name: 'Creator', tiles: [T('hq:reach', 'line', 2), T('hq:posts'), T('kit:list'), T('hq:leads', 'bars', 2), T('stripe:revenue', 'line', 2)] },
  coach: { name: 'Coaching or digital product', tiles: [T('stripe:revenue', 'line', 2), T('stripe:sales'), T('calendly:upcoming'), T('hq:leads', 'line', 2), T('stripe:overdue', 'table', 2)] },
  blank: { name: 'Blank', tiles: [] },
};

// ---------- boards ----------

const tid = () => deps.db.id().slice(0, 8);
function boards(user) {
  return deps.db.filter('boards', (b) => b.memberId === user.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
function board(user, id) {
  const b = deps.db.get('boards', String(id || ''));
  return b && b.memberId === user.id ? b : null;
}
function cleanTile(user, raw) {
  const m = metricOf(user, String(raw.metric || ''));
  if (!m) return null;
  const view = m.views.includes(raw.view) ? raw.view : m.views[0];
  const size = SIZES.includes(Number(raw.size)) ? Number(raw.size) : view === 'table' ? 2 : 1;
  const days = RANGES.includes(Number(raw.days)) ? Number(raw.days) : 30;
  const n = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const t = { id: raw.id || tid(), metric: m.id, view, size, days, goal: n(raw.goal), below: n(raw.below), above: n(raw.above) };
  if (raw.account) t.account = String(raw.account).slice(0, 60);
  return t;
}
async function create(user, { name, template } = {}) {
  if (boards(user).length >= MAX_BOARDS) return { error: `You can keep up to ${MAX_BOARDS} dashboards. Delete one first.` };
  const tp = TEMPLATES[template] || TEMPLATES.blank;
  const b = { id: deps.db.id(), memberId: user.id, name: String(name || tp.name).trim().slice(0, 60) || 'My dashboard', tiles: tp.tiles.map((t) => cleanTile(user, t)).filter(Boolean) };
  await deps.db.save('boards', b);
  return { board: b };
}
async function addTile(user, b, raw) {
  if (b.tiles.length >= MAX_TILES) return { error: `A dashboard holds up to ${MAX_TILES} tiles.` };
  const t = cleanTile(user, raw);
  if (!t) return { error: 'Pick a number to show.' };
  b.tiles.push(t);
  await deps.db.save('boards', b);
  return { tile: t };
}
async function removeTile(b, tileId) {
  const n = b.tiles.length;
  b.tiles = b.tiles.filter((t) => t.id !== tileId);
  if (b.tiles.length !== n) await deps.db.save('boards', b);
  return b.tiles.length !== n;
}
// The order from a drag: tile ids, first to last. Unknown ids are ignored; missing ones keep their place at the end.
async function reorder(b, ids) {
  if (!Array.isArray(ids)) return false;
  const by = Object.fromEntries(b.tiles.map((t) => [t.id, t]));
  const seen = new Set();
  const next = [];
  for (const id of ids.slice(0, MAX_TILES)) if (by[id] && !seen.has(id)) { next.push(by[id]); seen.add(id); }
  for (const t of b.tiles) if (!seen.has(t.id)) next.push(t);
  b.tiles = next;
  await deps.db.save('boards', b);
  return true;
}
async function resize(b, tileId, size) {
  const t = b.tiles.find((x) => x.id === tileId);
  if (!t || !SIZES.includes(Number(size))) return false;
  t.size = Number(size);
  await deps.db.save('boards', b);
  return true;
}
async function rename(b, name) {
  b.name = String(name || '').trim().slice(0, 60) || b.name;
  await deps.db.save('boards', b);
}
async function remove(user, b) {
  await deps.db.remove('boards', b.id);
}

// ---------- rendering data ----------

const cache = new Map();
async function valueOf(user, t, m) {
  const key = `${user.id}:${t.metric}:${t.days}:${t.account || ''}`;
  const hit = cache.get(key);
  if (m.live && hit && deps.now() - hit.at < CACHE_MS) return hit.data;
  const data = await m.get(user, t);
  if (m.live) {
    cache.set(key, { at: deps.now(), data });
    if (cache.size > 2000) cache.clear();
  }
  return data;
}
const fmt = (v, money) => (v == null ? '–' : `${money ? '$' : ''}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

// A board's tiles with their data. A tile whose source isn't connected says what to connect; one whose
// source fails says so, and the rest still show.
async function view(user, b) {
  const tiles = await Promise.all(b.tiles.map(async (t) => {
    const m = metricOf(user, t.metric);
    const base = { ...t, label: m ? m.label : 'Removed number', source: m ? m.sourceName : '', noAi: m ? noAi(m.app) : false };
    if (!m) return { ...base, empty: 'This number is gone. Remove the tile.' };
    if (m.app && !connectors.ready(user, m.app, { noAi: true })) return { ...base, empty: `Connect ${m.sourceName === 'Email list' || m.sourceName === 'Ads' ? m.label.split(' ')[0] : m.sourceName} to fill this in.`, connect: `/app/hq/apps/${m.app}` };
    try {
      const d = await valueOf(user, t, m);
      const money = !!(m.money || d.money);
      const out = { ...base, money, value: d.value, display: fmt(d.value, money), series: d.series || null, columns: d.columns || null, rows: d.rows || null, weekly: !!m.weekly, when: d.when || (m.weekly ? 'This week' : `Last ${t.days} days`) };
      if (d.previous != null && d.value != null) {
        const ch = d.previous ? Math.round(((d.value - d.previous) / Math.abs(d.previous)) * 100) : null;
        out.change = ch == null ? null : { pct: ch, up: d.value >= d.previous };
      }
      if (t.goal) out.goal = { target: t.goal, pct: Math.max(0, Math.min(100, Math.round(((d.value || 0) / t.goal) * 100))), display: fmt(t.goal, money) };
      if (d.value != null && t.below != null && d.value < t.below) out.alert = `Below ${fmt(t.below, money)}`;
      if (d.value != null && t.above != null && d.value > t.above) out.alert = `Above ${fmt(t.above, money)}`;
      return out;
    } catch (err) {
      return { ...base, empty: (err && err.message) || "Couldn't load this right now." };
    }
  }));
  return { id: b.id, name: b.name, tiles };
}

// For a Skill's daily report: one line per tile, alerts first. A Skill's report goes through AI, so tiles
// from a connector whose data goes to no AI (Calendly) are left out.
async function snapshot(user, boardId) {
  const b = board(user, boardId) || boards(user)[0];
  if (!b) return null;
  const v = await view(user, b);
  const lines = v.tiles.filter((t) => !t.noAi && !t.empty && t.display !== undefined && t.view !== 'table').map((t) => ({ text: `${t.label} (${t.when.toLowerCase()}): ${t.display}${t.alert ? ` · ${t.alert}` : ''}${t.goal ? ` · ${t.goal.pct}% of ${t.goal.display}` : ''}`, alert: !!t.alert }));
  return { name: v.name, lines: lines.sort((a, b2) => Number(b2.alert) - Number(a.alert)).map((l) => l.text) };
}

// A disconnect drops that member's cached values at once.
function dropCache(userId) {
  for (const k of [...cache.keys()]) if (k.startsWith(`${userId}:`)) cache.delete(k);
}

module.exports = { dropCache, on, flag, SOURCES, TEMPLATES, VIEWS, SIZES, RANGES, MAX_BOARDS, MAX_TILES, choices, metricOf, boards, board, create, addTile, removeTile, reorder, resize, rename, remove, view, snapshot, _setDeps, _clearCache: () => cache.clear() };
