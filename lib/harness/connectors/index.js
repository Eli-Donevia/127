// Connections (v2/turnkey/BUILD-PLAN.md W1 and W11): every app a member can connect, one honest status
// each, and the clients packs use to read their accounts and, on an OK, write drafts to them.
//
// Switches, all off by default:
//   CONNECTORS=admins|on        the gallery on /app/hq/connect
//   CONNECTOR_<ID>=admins|on    one connector (CONNECTOR_NOTION, CONNECTOR_META_ADS, ...)
// "on" means members only while the Terms and Privacy pages are live; until then it acts as "admins".
// A connector Legal hasn't cleared (not in CLEARED) works for admins only, whatever its switch says, so
// Eli can try it on his own accounts while Legal writes its line (v2/turnkey/LEGAL-ASKS.md rows 5, 6).
//
// Statuses: connected · broken (reconnect) · connect (works now) · coming (needs 127's app or its switch)
// · legal (waiting on Legal).
//
// Keys and tokens are encrypted with HQ_SECRET (HQ v1's enc/dec) in hqConnections.apps, never on the
// user doc and never shown again. Every connect, disconnect, read and write goes in the Activity log.
//
// Legal L76 (legal/handoffs/turnkey.md): a connector marked `waits` in the catalog is held for everyone;
// one marked `ai: false` reaches only views with no AI; disconnect revokes the token at the platform and
// strips that platform's data from runs, and a platform's `keepHours` limit strips it sooner (sweep()).

const hq = require('../../hq');
const needsLib = require('../needs');
const catalog = require('./catalog');
const brandIcons = require('./brand-icons');
const apps = require('./apps');
const oauth = require('./oauth');
const ads = require('./ads');
const log = require('./log');

const deps = {
  db: require('../../db'),
  fetch: (...a) => fetch(...a),
  stripe: (key) => new (require('stripe'))(key, { maxNetworkRetries: 1, timeout: 20000, appInfo: { name: '127 HQ', url: 'https://127group.io' } }),
};
function _setDeps(over) {
  Object.assign(deps, over);
}

// Connectors Legal has cleared for members. Add an id here when its Privacy line is live.
// Studio providers through the member's own account are cleared now (Legal L76 row 8, way 2).
// CRMs cleared by Legal L93 (CR1 to CR5 built). Pipedrive and GoHighLevel wait for their platforms.
const CLEARED = new Set(['fal', 'higgsfield', 'runway', 'luma', 'elevenlabs', 'google_gemini', 'hubspot', 'close', 'folk', 'keap', 'attio', 'twenty']);

const http = (name, opts) => apps.makeHttp(deps.fetch)(name, opts);

function isAdmin(user) {
  const list = String(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return !!user && !!user.emailVerified && list.includes(String(user.email || '').toLowerCase());
}
function flag(name) {
  const v = String(process.env[name] || '').toLowerCase();
  if (v === 'on' || v === 'true') return needsLib.pagesLive() ? 'on' : 'admins';
  return v === 'admins' ? 'admins' : 'off';
}
const envName = (id) => `CONNECTOR_${String(id).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

function mode() {
  return flag('CONNECTORS');
}
// The gallery: HQ's connections page is the member's (Builder and up), and CONNECTORS lets them see it.
function on(user) {
  const m = mode();
  return !!user && hq.canUse(user) && (m === 'on' || (m === 'admins' && isAdmin(user)));
}
function held(id) {
  return !CLEARED.has(id);
}
// Whether this member may connect and use one connector.
function allowed(user, id) {
  const app = catalog.byId[id];
  if (app && app.waits) return false;
  const s = flag(envName(id));
  if (s === 'off' || !user) return false;
  if (s === 'admins' || held(id)) return isAdmin(user);
  return true;
}

// ---------- storage ----------

function stored(userId, id) {
  const c = deps.db.get('hqConnections', userId);
  return (c && c.apps && c.apps[id]) || null;
}
function credsOf(userId, id) {
  const s = stored(userId, id);
  if (!s) return null;
  const raw = hq.dec(s.secret);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function put(userId, id, creds, meta) {
  const c = hq.connOf(userId);
  c.apps = c.apps || {};
  c.apps[id] = { secret: hq.enc(JSON.stringify(creds)), label: meta.label || null, kind: meta.kind, at: new Date().toISOString(), status: 'ok', error: null, usedAt: null, ...(meta.accounts ? { accounts: meta.accounts } : {}) };
  await hq.saveConn(c);
}
async function mark(userId, id, patch) {
  const c = deps.db.get('hqConnections', userId);
  if (!c || !c.apps || !c.apps[id]) return;
  Object.assign(c.apps[id], patch);
  await hq.saveConn(c);
}

// ---------- the gallery ----------

function statusOf(user, app, c) {
  const v1 = hq.connections(user, '');
  const harnessOn = (() => {
    try {
      return require('../../hq-harness').on();
    } catch {
      return false;
    }
  })();
  switch (app.auth) {
    case 'builtin':
      return 'coming';
    case 'link':
      return v1.link ? 'connected' : 'connect';
    case 'ai':
      return !harnessOn ? 'coming' : v1.ai ? 'connected' : 'connect';
    case 'file':
      return ['on', 'true', 'admins'].includes(String(process.env.BRAIN_DOCS || '').toLowerCase()) ? 'connect' : 'coming';
    case 'studio':
      return 'legal';
    default: {
      const s = c.apps && c.apps[app.id];
      // HQ v1's own Stripe key and Shopify webhook count as connected; the workflows key adds to them.
      if (app.id === 'shopify' && !s && v1.shopify) return 'connected';
      if (app.id === 'stripe' && !s && v1.stripe) return v1.stripe.status === 'ok' ? 'connected' : 'broken';
      if (s) return s.status === 'ok' ? 'connected' : 'broken';
      if (app.waits || (held(app.id) && !isAdmin(user))) return 'legal';
      if (!allowed(user, app.id)) return held(app.id) ? 'legal' : 'coming';
      if (app.auth === 'oauth' && !oauth.ready(app.provider)) return 'coming';
      if (!hq.secretReady()) return 'coming';
      return 'connect';
    }
  }
}

const LABELS = { connected: 'Connected', broken: 'Reconnect', connect: 'Connect', coming: 'Coming', legal: 'Waiting on Legal' };

function hrefOf(app, status) {
  if (app.anchor && app.auth === 'builtin') return `/app/hq/connect#${app.anchor}`;
  if (app.auth === 'link') return '/app/hq/connect#link';
  if (app.auth === 'ai') return '/app/hq/connect#ai';
  if (app.href) return status === 'connect' ? app.href : null;
  if (app.auth === 'key' || app.auth === 'oauth') return `/app/hq/apps/${app.id}`;
  return null;
}

// What the gallery shows: categories, each with its apps and one status.
function gallery(user) {
  const c = deps.db.get('hqConnections', user.id) || {};
  const list = catalog.APPS.map((app) => {
    const status = statusOf(user, app, c);
    const s = c.apps && c.apps[app.id];
    return { id: app.id, name: app.name, category: app.category, auth: app.auth, status, label: LABELS[status], href: hrefOf(app, status), reads: app.reads, writes: app.writes, account: s ? s.label : null, icon: brandIcons[app.id] || null };
  });
  const counts = { connected: list.filter((a) => a.status === 'connected').length, ready: list.filter((a) => a.status === 'connect').length, total: list.length };
  return { counts, categories: catalog.CATEGORIES.map((cat) => ({ ...cat, apps: list.filter((a) => a.category === cat.id) })).filter((cat) => cat.apps.length) };
}

// One connector's page.
function detail(user, id) {
  const app = catalog.byId[id];
  if (!app || (app.auth !== 'key' && app.auth !== 'oauth')) return null;
  const c = deps.db.get('hqConnections', user.id) || {};
  const status = statusOf(user, app, c);
  const s = c.apps && c.apps[id];
  const def = apps.APPS[id];
  return {
    id, name: app.name, auth: app.auth, status, label: LABELS[status], reads: app.reads, writes: app.writes,
    waits: app.waits || null, claude: app.claude || null, ai: app.ai !== false, media: !!app.media, attribution: app.attribution || null, revokes: app.auth === 'oauth' && !!oauth.REVOKE[app.provider],
    fields: def ? def.fields : [], steps: def ? def.steps : [], provider: app.provider ? oauth.PROVIDERS[app.provider].name : null,
    conn: s ? { label: s.label, since: String(s.at || '').slice(0, 10), used: s.usedAt ? hq.ago(s.usedAt) : null, error: s.error } : null,
    v1: id === 'shopify' || id === 'stripe' ? !!hq.connections(user, '')[id] : false,
    activity: log.list(user.id, { app: id, limit: 20 }).map((a) => ({ at: a.at, what: a.what, action: a.action, who: a.who })),
  };
}

// ---------- connect and disconnect ----------

async function connectKey(user, id, body) {
  const def = apps.APPS[id];
  if (!def || !allowed(user, id)) return { error: "That connection isn't open yet." };
  if (!hq.secretReady()) return { error: "Connections can't be saved yet." };
  const p = def.parse(body || {});
  if (p.error) return { error: p.error };
  let t;
  try {
    t = await def.test(p.creds, http, { stripe: deps.stripe });
  } catch (err) {
    return { error: err instanceof apps.AppError ? err.message : `${def.name} didn't answer. Try again in a minute.` };
  }
  await put(user.id, id, { ...p.creds, ...((t && t.extra) || {}) }, { label: t && t.label, kind: 'key' });
  await log.add(user.id, { kind: 'connect', app: id, what: `Connected ${def.name}${t && t.label ? ` (${t.label})` : ''}.` });
  return { ok: true, label: t && t.label };
}

// Starting "Sign in with": the URL to send the member to and what their session keeps.
function startOauth(user, id, base) {
  const app = catalog.byId[id];
  if (!app || app.auth !== 'oauth' || !allowed(user, id) || !oauth.ready(app.provider) || !hq.secretReady()) return null;
  return oauth.start(app.provider, { base, scopes: app.scopes || [], app: id });
}

async function finishOauth(user, pending, provider, query, base) {
  if (!oauth.matches(pending, provider, query.state)) return { error: "That sign-in didn't match. Start again from Connections." };
  const app = catalog.byId[pending.app];
  if (!app || !allowed(user, app.id)) return { error: "That connection isn't open yet." };
  if (query.error || !query.code) return { error: `${oauth.PROVIDERS[provider].name} didn't connect. Nothing was saved.` };
  let tokens;
  try {
    tokens = await oauth.exchange(deps.fetch, pending, query.code, base);
  } catch (err) {
    return { error: err.message };
  }
  await put(user.id, app.id, tokens, { label: tokens.account || null, kind: 'oauth', accounts: tokens.accounts });
  await log.add(user.id, { kind: 'connect', app: app.id, what: `Connected ${app.name} with ${oauth.PROVIDERS[provider].name} sign-in.` });
  return { ok: true, app: app.id, name: app.name };
}

// Revokes a sign-in at the platform, deletes the saved key or token at once, and strips what HQ got from
// the platform out of the member's runs (Legal O2, O5, K12: within 30 days; HQ does it now). What the
// member made from it, like a draft, stays.
async function disconnect(user, id, { why = null } = {}) {
  const c = deps.db.get('hqConnections', user.id);
  if (!c || !c.apps || !c.apps[id]) return false;
  const app = catalog.byId[id];
  const name = app ? app.name : id;
  const revoked = app && c.apps[id].kind === 'oauth' ? await oauth.revoke(deps.fetch, app.provider, credsOf(user.id, id)) : null;
  delete c.apps[id];
  await hq.saveConn(c);
  const stripped = await scrub(user.id, id);
  dropCache(user.id);
  const how = revoked === true ? ` and removed 127's access at ${name}` : '';
  await log.add(user.id, { who: why ? '127' : 'you', kind: 'disconnect', app: id, what: `${why ? `${why} ` : ''}Disconnected ${name}. 127 deleted its copy of the ${app && app.auth === 'oauth' ? 'sign-in' : 'key'}${how}${stripped ? `, and removed ${name} data from ${stripped} run${stripped === 1 ? '' : 's'}` : ''}.` });
  return { ok: true, revoked };
}

// Legal K5: 30 days after a paid plan ends (not a pause), every saved key and sign-in goes, as if the
// member disconnected each one (revoked, deleted, its data out of runs). lib/lapse.js runs the timer.
async function forgetLapsed(user) {
  const c = deps.db.get('hqConnections', user.id);
  const ids = Object.keys((c && c.apps) || {});
  for (const id of ids) await disconnect(user, id, { why: 'Your paid plan ended over 30 days ago.' });
  return ids.length;
}
require('../../lapse').onLapse('connectors', forgetLapsed);

// ---------- platform data in runs (Legal O5) ----------

// Which runs read which connector, kept on the member's hqConnections doc (not on apps[id], so it
// outlives a disconnect): touched[id] = [{ run, tool, at }]. Only ids and tool names, never data.
const TOUCH_MAX = 1000;
const TERMINAL = new Set(['done', 'failed', 'stopped']);
function touch(c, id, runId, tool, at) {
  if (!runId || !tool) return false;
  c.touched = c.touched || {};
  const list = (c.touched[id] = c.touched[id] || []);
  if (list.some((e) => e.run === runId && e.tool === tool)) return false;
  list.push({ run: String(runId), tool: String(tool), at });
  if (list.length > TOUCH_MAX) list.splice(0, list.length - TOUCH_MAX);
  return true;
}

// Replaces the output of every step that read this connector, in the member's runs, with a note. With
// before, only reads older than it, and only finished runs (a running one waits for the next sweep).
// Returns how many runs changed.
async function scrub(userId, id, { before = null } = {}) {
  const c = deps.db.get('hqConnections', userId);
  const list = (c && c.touched && c.touched[id]) || [];
  if (!list.length) return 0;
  const packs = require('../packs');
  const name = (catalog.byId[id] || { name: id }).name;
  const note = { removed: true, note: `${name} data removed under ${name}'s rules for apps.` };
  const keep = [];
  const changed = new Set();
  for (const e of list) {
    if (before && e.at >= before) {
      keep.push(e);
      continue;
    }
    const run = deps.db.get('runs', e.run);
    if (!run) continue;
    if (!TERMINAL.has(run.status)) {
      keep.push(e);
      continue;
    }
    const wf = packs.workflow(run.workflowId);
    for (const step of (wf && wf.steps) || []) {
      const st = run.steps && run.steps[step.id];
      if (step.tool !== e.tool || !st) continue;
      st.output = note;
      if (Array.isArray(st.items)) st.items = st.items.map((it) => ({ ...it, output: it.output === undefined ? undefined : note }));
      changed.add(run);
    }
  }
  for (const run of changed) await deps.db.save('runs', run);
  c.touched[id] = keep;
  if (!keep.length) delete c.touched[id];
  await hq.saveConn(c);
  return changed.size;
}

// From server.js's 5-minute interval, at most hourly: strips platform data from runs once it's older
// than that platform's keepHours, and forgets index entries older than HQ's 180 days (the runs are gone).
let lastSweep = 0;
async function sweep({ force = false, now = Date.now() } = {}) {
  if (!force && now - lastSweep < 60 * 60 * 1000) return 0;
  lastSweep = now;
  let n = 0;
  const old = new Date(now - 181 * 864e5).toISOString();
  for (const c of deps.db.filter('hqConnections', (x) => x.touched && Object.keys(x.touched).length)) {
    for (const id of Object.keys(c.touched)) {
      const app = catalog.byId[id];
      if (app && app.keepHours != null) n += await scrub(c.id, id, { before: new Date(now - app.keepHours * 36e5).toISOString() });
      if (c.touched[id]) c.touched[id] = c.touched[id].filter((e) => e.at >= old);
    }
  }
  return n;
}

function dropCache(userId) {
  try {
    require('./dashboards').dropCache(userId);
  } catch {
    /* dashboards not loaded */
  }
}

// ---------- clients for packs ----------

// The member connectors packs can declare in needs or wants.
// Calendly and TikTok Ads stay out (Legal K10: Calendly's data goes to no AI; TikTok ads are upload files
// for now), and a catalog app with ai: false is refused here too.
const PACKABLE = ['stripe', 'shopify', 'notion', 'airtable', 'klaviyo', 'mailchimp', 'kit', 'beehiiv', 'meta_ads', 'google_ads', 'gmail', 'gcal', 'gdrive', 'youtube', 'instagram', 'facebook', 'tiktok', 'quickbooks', 'xero', 'square', 'hubspot', 'slack',
  // Studio providers on the member's own account (apps.MEDIA): a client with one method, request().
  'fal', 'higgsfield', 'runway', 'luma', 'elevenlabs', 'google_gemini',
  // Recipe connectors (recipes.js): every one, as packs declare them.
  ...require('./recipes').RECIPES.map((r) => r.id).filter((id) => id !== 'hubspot')];

// opts.noAi: the caller sends nothing to AI (dashboards), so ai: false connectors are allowed too.
function ready(user, id, { noAi = false } = {}) {
  const app = catalog.byId[id];
  if (!user || !app || !allowed(user, id)) return false;
  if (noAi ? !(PACKABLE.includes(id) || app.ai === false) : !PACKABLE.includes(id) || app.ai === false) return false;
  const s = stored(user.id, id);
  if (s) return s.status === 'ok';
  // Without a workflows key, Stripe falls back to HQ v1's Charges-read key.
  if (id === 'stripe') {
    const c = deps.db.get('hqConnections', user.id);
    return !!(c && c.stripe && c.stripe.status === 'ok' && hq.dec(c.stripe.key));
  }
  return false;
}

// Wraps every read to note when the account was last used (and log it), and every write to need the
// approval, log it, and only then call the provider. A 401 or 403 marks the connection broken.
function wrap(user, id, raw, { who = 'you', runId, tool, approvedBy } = {}) {
  const name = (catalog.byId[id] || { name: id }).name;
  // What a Studio provider makes is the member's, so its jobs aren't stripped from runs on disconnect.
  const studio = !!(catalog.byId[id] || {}).media;
  const guard = async (fn, kind, method) => {
    try {
      const out = await fn();
      if (kind === 'read') {
        const c = deps.db.get('hqConnections', user.id);
        if (c && !studio && touch(c, id, runId, tool, new Date().toISOString())) await hq.saveConn(c);
        await mark(user.id, id, { usedAt: new Date().toISOString() });
        await log.add(user.id, { who, kind, app: id, what: studio ? `Studio used your ${name} account.` : `Read ${name}: ${method}.`, runId, tool });
      }
      return out;
    } catch (err) {
      if (err && err.auth) {
        await mark(user.id, id, { status: 'broken', error: `Reconnect ${name}.` });
        await log.add(user.id, { who, kind: 'error', app: id, what: `${name} refused the saved key, so 127 marked it to reconnect.`, runId, tool });
      }
      throw err;
    }
  };
  const client = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'writes' || typeof v !== 'function') continue;
    client[k] = (...args) => guard(() => v(...args), 'read', k);
  }
  client.writes = {};
  for (const [k, v] of Object.entries(raw.writes || {})) {
    client.writes[k] = async (...args) => {
      if (!approvedBy) throw new Error(`${name} changes need your OK first.`);
      await log.add(user.id, { who, kind: 'write', app: id, what: `${name}: ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}, approved by you.`, runId, tool, approvedBy });
      return guard(() => v(...args), 'write', k);
    };
  }
  return client;
}

async function oauthToken(user, id) {
  const app = catalog.byId[id];
  const tokens = credsOf(user.id, id);
  let f;
  try {
    f = await oauth.fresh(deps.fetch, app.provider, tokens);
  } catch {
    f = null;
  }
  if (!f) {
    await mark(user.id, id, { status: 'broken', error: `Reconnect ${app.name}.` });
    throw new apps.AppError(`Reconnect ${app.name} in Connections.`, 401);
  }
  if (f.changed) {
    const c = hq.connOf(user.id);
    c.apps[id].secret = hq.enc(JSON.stringify(f.tokens));
    await hq.saveConn(c);
  }
  return f.tokens.access;
}

// The client a tool gets from ctx.secret(id), or null when this member hasn't connected it.
// opts: { write: true when the tool is an `act` step, approvedBy, runId, tool }.
function clientFor(user, id, opts = {}) {
  if (!ready(user, id, { noAi: !!opts.noAi })) return null;
  const o = { who: opts.who || 'you', runId: opts.runId, tool: opts.tool, approvedBy: opts.write ? opts.approvedBy || null : null };
  const s = stored(user.id, id);
  if (id === 'stripe' && !s) {
    const key = hq.dec(deps.db.get('hqConnections', user.id).stripe.key);
    return wrap(user, id, apps.APPS.stripe.client({ key }, http, { stripe: deps.stripe }), o);
  }
  if (apps.APPS[id]) return wrap(user, id, apps.APPS[id].client(credsOf(user.id, id), http, { stripe: deps.stripe }), o);
  if (apps.SIGNIN[id]) {
    // Sign-in connectors with their own client get a fresh token for each call.
    // Recipe clients also read what the sign-in kept (api_domain, locationId); never the refresh token.
    const make = async () => {
      const token = await oauthToken(user, id);
      const { refresh, access, ...kept } = credsOf(user.id, id) || {};
      return apps.SIGNIN[id].client({ ...kept, token }, http);
    };
    const shape = apps.SIGNIN[id].client({ token: '' }, http);
    const lazy = { writes: {} };
    for (const m of Object.keys(shape)) if (m !== 'writes') lazy[m] = async (...a) => (await make())[m](...a);
    for (const m of Object.keys(shape.writes || {})) lazy.writes[m] = async (...a) => (await make()).writes[m](...a);
    return wrap(user, id, lazy, o);
  }
  if (ads.ADS[id]) {
    // Ad clients take a token; it's fetched fresh for each call.
    const lazy = {};
    const make = async () => ads.ADS[id](await oauthToken(user, id), http, { accounts: s.accounts || [] });
    for (const m of ['accounts', 'insights']) lazy[m] = async (...a) => (await make())[m](...a);
    lazy.writes = { draftCampaign: async (...a) => (await make()).writes.draftCampaign(...a) };
    return wrap(user, id, lazy, o);
  }
  // Other sign-in connectors hand the tool a fresh token for that provider's API.
  return wrap(user, id, { token: () => oauthToken(user, id), account: async () => s.label }, o);
}

// For /admin: how many members connected each app (never who, never keys).
function stats() {
  const out = {};
  for (const c of deps.db.all('hqConnections')) for (const id of Object.keys(c.apps || {})) out[id] = (out[id] || 0) + 1;
  return out;
}

// Account deletion: the saved keys go with hqConnections; this clears the log.
async function forget(userId) {
  const c = deps.db.get('hqConnections', userId);
  if (c && (c.apps || c.touched)) {
    delete c.apps;
    delete c.touched;
    await hq.saveConn(c);
  }
  await log.forget(userId);
  for (const b of deps.db.filter('boards', (x) => x.memberId === userId)) await deps.db.remove('boards', b.id);
}

module.exports = {
  CLEARED, PACKABLE, LABELS, catalog, apps, oauth, ads, log,
  mode, on, held, allowed, isAdmin, envName, gallery, detail, statusOf,
  connectKey, startOauth, finishOauth, disconnect, forgetLapsed, scrub, sweep, ready, clientFor, credsOf, stats, forget,
  _setDeps,
};
