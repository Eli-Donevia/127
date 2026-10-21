// The recipe engine: turns each connector recipe (./recipes/*.js) into a catalog entry, a "Sign in with"
// provider when the recipe brings its own, and a client with one method per declared read and write.
//
// A recipe:
//   { id, name, category, auth: 'key' | 'oauth', insider?,
//     provider?            an oauth.js provider to reuse, or
//     oauth?               { name, authUrl, tokenUrl, clientAuth, pkce?, extra?, keep?: [token fields to keep],
//                            account?: token field to label the account, revoke?: { url, auth, form } }
//     scopes?, headers?,
//     key?                 { fields, steps, pattern?, auth: { header, value } | { basic }, test }
//     base                 'https://...' | { from: field, pattern? } | { from: 'server', selfHosted: true }
//     reads  { name: { method?, path, query?, body?, list?, pii? } }
//     writes { name: { method, path, body } }
//     card   { reads, writes }, data? { ai, keepHours }, omit?: [keys reads never pass on] }
//
// Templates: '{name}' in a path, query or body takes the caller's value of that name, else a value the
// sign-in kept (api_domain, locationId), else {now}. A body key whose value is missing is left out, so a
// write sends only the fields its recipe lists and the caller gave. Paths are always encoded.
//
// Legal K2 (allowlist): a client can only call what its recipe declares. K4: reads drop email and phone fields
// unless the recipe marks the read pii: true (none does yet), so packs never pass them to AI by accident.
//
// Legal L93 (CR1 to CR5): reads are live, only when a task needs them; writes are act steps; sign-in where the
// platform offers it. A card says what Privacy 7A's CRM row says, and reads no more than that row.

const net = require('net');
const dns = require('dns').promises;
const RECIPES = require('./recipes/index');

const deps = { lookup: (host) => dns.lookup(host, { all: true }), now: () => Date.now() };
function _setDeps(over) {
  Object.assign(deps, over);
}

const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const providerOf = (r) => (r.auth === 'oauth' ? r.provider || r.id : null);

// ---------- catalog and providers ----------

function catalogEntries() {
  return RECIPES.map((r) => ({
    id: r.id, name: r.name, category: r.category, auth: r.auth, recipe: true,
    ...(r.auth === 'oauth' ? { provider: providerOf(r), scopes: r.scopes || [] } : {}),
    reads: r.card.reads, writes: r.card.writes || null,
    ...(r.insider ? { insider: true } : {}),
    ...(r.data || {}),
  }));
}

// oauth.js providers for recipes that bring their own sign-in.
function providers() {
  const out = {};
  for (const r of RECIPES) if (r.auth === 'oauth' && r.oauth) out[r.id] = { ...r.oauth };
  return out;
}

// oauth.js revoke builders for recipes that declare one: (tokens, client) -> request.
function revokes() {
  const out = {};
  for (const r of RECIPES) {
    const v = r.oauth && r.oauth.revoke;
    if (!v) continue;
    out[r.id] = (t, c) => {
      const form = {};
      for (const [k, x] of Object.entries(v.form || {})) form[k] = String(x).replace('{refresh}', t.refresh || t.access).replace('{access}', t.access);
      const r2 = { url: v.url, method: 'POST', 'content-type': 'application/x-www-form-urlencoded', body: new URLSearchParams(v.auth === 'basic' ? form : { ...form, client_id: c.id, client_secret: c.secret }).toString() };
      if (v.auth === 'basic') r2.authorization = `Basic ${Buffer.from(`${c.id}:${c.secret}`).toString('base64')}`;
      return r2;
    };
  }
  return out;
}

// ---------- self-hosted servers ----------

function privateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::1' || s === '::') return true;
    if (s.startsWith('::ffff:')) return privateIp(s.slice(7));
    return /^f[cd]/.test(s) || /^fe[89ab]/.test(s);
  }
  return true;
}

// A member's own server address: https, a public name, no user or password. Returns the clean origin and
// path (no trailing slash), or null.
function serverOf(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return null;
  }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443') return null;
  if (!h.includes('.') || /(^|\.)(localhost|local|internal|lan|home|intranet|corp)$/.test(h)) return null;
  if (net.isIP(h.replace(/^\[|\]$/g, ''))) return null;
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

// Checked before every call: the name must not point inside a private network (DNS can change).
async function publicHost(host) {
  let addrs;
  try {
    addrs = await deps.lookup(host);
  } catch {
    return false;
  }
  return Array.isArray(addrs) && addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
}

// ---------- templates ----------

const TPL = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
const SOME = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const MISSING = Symbol('missing');

function valueOf(name, params, vars) {
  if (name === 'now') return new Date(deps.now()).toISOString();
  if (params && params[name] !== undefined && params[name] !== null) return params[name];
  if (vars && vars[name] !== undefined && vars[name] !== null) return vars[name];
  return MISSING;
}
function fill(tpl, params, vars) {
  if (typeof tpl === 'string') {
    const m = tpl.match(TPL);
    if (m) return valueOf(m[1], params, vars);
    let gone = false;
    const s = tpl.replace(SOME, (x, n) => {
      const v = valueOf(n, params, vars);
      if (v === MISSING) gone = true;
      return v === MISSING ? '' : String(v);
    });
    return gone ? MISSING : s;
  }
  if (Array.isArray(tpl)) return tpl.map((x) => fill(x, params, vars)).filter((x) => x !== MISSING);
  if (tpl && typeof tpl === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(tpl)) {
      const f = fill(v, params, vars);
      if (f !== MISSING) out[k] = f;
    }
    return out;
  }
  return tpl;
}

const PII = /(^|_)(e-?mail|emails|phone|phones|phone_?numbers?|mobile)$/i;
// omit: more keys a recipe never passes on, at any depth (Attio's enrichment fields, Legal L93).
function scrub(x, depth = 0, omit = null) {
  if (depth > 8) return x;
  if (Array.isArray(x)) return x.map((y) => scrub(y, depth + 1, omit));
  if (x && typeof x === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(x)) if (!PII.test(k) && !/email|phone/i.test(k) && !(omit && omit.has(k))) out[k] = scrub(v, depth + 1, omit);
    return out;
  }
  return x;
}
const at = (obj, dotted) => String(dotted).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// ---------- clients ----------

function make(AppError) {
  function baseFor(r, creds) {
    if (typeof r.base === 'string') return r.base;
    const raw = creds[r.base.from];
    if (r.base.selfHosted) {
      const s = serverOf(raw);
      if (!s) throw new AppError(`Reconnect ${r.name}: its server address isn't one 127 can use.`, 400);
      return s;
    }
    const s = String(raw || '').replace(/\/+$/, '');
    if (!s || (r.base.pattern && !new RegExp(r.base.pattern).test(s))) throw new AppError(`Reconnect ${r.name}: it didn't say where its account lives.`, 401);
    return s;
  }
  function authHeaders(r, creds) {
    if (r.auth === 'oauth') return { authorization: `Bearer ${creds.token}` };
    const a = (r.key && r.key.auth) || { header: 'authorization', value: 'Bearer {key}' };
    if (a.basic) return { authorization: `Basic ${Buffer.from(fill(a.basic, creds, {})).toString('base64')}` };
    return { [a.header]: fill(a.value, creds, {}) };
  }
  // Values the sign-in kept that templates may use (never the token or key).
  function varsOf(r, creds) {
    const keep = (r.oauth && r.oauth.keep) || [];
    return Object.fromEntries(keep.filter((k) => creds[k] != null).map((k) => [k, String(creds[k])]));
  }

  function call(r, creds, http, spec, params, isWrite) {
    return (async () => {
      const base = baseFor(r, creds);
      const vars = varsOf(r, creds);
      const path = String(spec.path).replace(SOME, (x, n) => {
        const v = valueOf(n, params, vars);
        if (v === MISSING || typeof v === 'object') throw new AppError(`${r.name} needs ${n} for that.`, 400);
        return encodeURIComponent(String(v));
      });
      const u = new URL(base + path);
      if (r.base && r.base.selfHosted && !(await publicHost(u.hostname))) throw new AppError(`127 can't reach ${u.hostname}. It has to be a public address.`, 400);
      const q = {};
      for (const [k, v] of Object.entries(spec.query || {})) q[k] = params && params[k] != null && !isWrite ? params[k] : v;
      for (const [k, v] of Object.entries(fill(q, params, vars))) if (typeof v !== 'object') u.searchParams.set(k, String(v));
      const method = spec.method || 'GET';
      const body = spec.body ? fill(spec.body, params, vars) : undefined;
      const out = await http(r.name, { url: u.toString(), method, headers: { ...(r.headers || {}), ...authHeaders(r, creds) }, body: method === 'GET' ? undefined : body });
      if (isWrite) return { ok: true, id: out && (out.id || (out.data && (out.data.id || (out.data.id && out.data.id.record_id))) || null) };
      const got = spec.list ? at(out, spec.list) : out;
      return spec.pii ? got : scrub(got === undefined ? [] : got, 0, r.omit ? new Set(r.omit) : null);
    })();
  }

  function client(r, creds, http) {
    const c = {};
    for (const [name, spec] of Object.entries(r.reads || {})) c[name] = (params = {}) => call(r, creds, http, spec, params, false);
    c.writes = {};
    for (const [name, spec] of Object.entries(r.writes || {})) c.writes[name] = (params = {}) => call(r, creds, http, spec, params, true);
    return c;
  }

  // Key recipes as apps.js connectors: { id, name, fields, steps, parse, test, client }.
  function keyApp(r) {
    return {
      id: r.id, name: r.name, fields: r.key.fields, steps: r.key.steps, recipe: true,
      parse(body) {
        const creds = {};
        for (const f of r.key.fields) {
          const v = String((body || {})[f.name] || '').trim();
          if (!v && !f.optional) return { error: `Paste your ${r.name} ${f.label.toLowerCase()}.` };
          creds[f.name] = v;
        }
        if (r.key.pattern && !new RegExp(r.key.pattern).test(creds.key || '')) return { error: `That doesn't look like a ${r.name} key.` };
        if (creds.key && !/^[\x21-\x7e]{8,400}$/.test(creds.key)) return { error: `That doesn't look like a ${r.name} key.` };
        if (r.base && r.base.selfHosted) {
          const s = serverOf(creds[r.base.from]);
          if (!s) return { error: `Use your ${r.name} address, starting with https://.` };
          creds[r.base.from] = s;
        }
        return { creds };
      },
      async test(creds, http) {
        if (r.key.test) await call(r, creds, http, { path: r.key.test }, {}, false);
        return { label: r.base && r.base.selfHosted ? new URL(creds[r.base.from]).hostname : `${r.name} account` };
      },
      client: (creds, http) => client(r, creds, http),
    };
  }

  const key = {};
  const signin = {};
  for (const r of RECIPES) {
    if (r.auth === 'key') key[r.id] = keyApp(r);
    else signin[r.id] = { id: r.id, name: r.name, recipe: true, client: (creds, http) => client(r, creds, http) };
  }
  return { key, signin };
}

module.exports = { RECIPES, byId, catalogEntries, providers, revokes, make, serverOf, privateIp, publicHost, fill, scrub, _setDeps };
