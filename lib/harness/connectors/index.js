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

const hq = require('../../hq');
const needsLib = require('../needs');
const catalog = require('./catalog');
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
const CLEARED = new Set([]);

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
      if (held(app.id) && !isAdmin(user)) return 'legal';
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
    return { id: app.id, name: app.name, category: app.category, auth: app.auth, status, label: LABELS[status], href: hrefOf(app, status), reads: app.reads, writes: app.writes, account: s ? s.label : null };
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

async function disconnect(user, id) {
  const c = deps.db.get('hqConnections', user.id);
  if (!c || !c.apps || !c.apps[id]) return false;
  delete c.apps[id];
  await hq.saveConn(c);
  const app = catalog.byId[id];
  await log.add(user.id, { kind: 'disconnect', app: id, what: `Disconnected ${app ? app.name : id}. 127 deleted its copy of the key.` });
  return true;
}

// ---------- clients for packs ----------

// The member connectors packs can declare in needs or wants.
const PACKABLE = ['stripe', 'shopify', 'notion', 'airtable', 'klaviyo', 'mailchimp', 'kit', 'beehiiv', 'calendly', 'meta_ads', 'google_ads', 'tiktok_ads', 'gmail', 'gcal', 'gdrive', 'youtube', 'instagram', 'facebook', 'tiktok', 'quickbooks', 'xero', 'square', 'hubspot', 'slack'];

function ready(user, id) {
  if (!user || !PACKABLE.includes(id) || !allowed(user, id)) return false;
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
  const guard = async (fn, kind, method) => {
    try {
      const out = await fn();
      if (kind === 'read') {
        await mark(user.id, id, { usedAt: new Date().toISOString() });
        await log.add(user.id, { who, kind, app: id, what: `Read ${name}: ${method}.`, runId, tool });
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
  if (!ready(user, id)) return null;
  const o = { who: opts.who || 'you', runId: opts.runId, tool: opts.tool, approvedBy: opts.write ? opts.approvedBy || 'member' : null };
  const s = stored(user.id, id);
  if (id === 'stripe' && !s) {
    const key = hq.dec(deps.db.get('hqConnections', user.id).stripe.key);
    return wrap(user, id, apps.APPS.stripe.client({ key }, http, { stripe: deps.stripe }), o);
  }
  if (apps.APPS[id]) return wrap(user, id, apps.APPS[id].client(credsOf(user.id, id), http, { stripe: deps.stripe }), o);
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
  if (c && c.apps) {
    delete c.apps;
    await hq.saveConn(c);
  }
  await log.forget(userId);
  for (const b of deps.db.filter('boards', (x) => x.memberId === userId)) await deps.db.remove('boards', b.id);
}

module.exports = {
  CLEARED, PACKABLE, LABELS, catalog, apps, oauth, ads, log,
  mode, on, held, allowed, isAdmin, envName, gallery, detail, statusOf,
  connectKey, startOauth, finishOauth, disconnect, ready, clientFor, credsOf, stats, forget,
  _setDeps,
};
