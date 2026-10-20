// Shared pieces for the provider plugins: the price data, one JSON call through ctx.fetch with errors a
// member can read, data URIs and a model builder. Not a plugin (lib/providers/index.js loads only the
// six named files).
//
// Errors: "<service> answered <status>: <plain reason>". The reason comes from the status code; for a
// request the service turned down (400, 404, 409, 422) a short cleaned line of its answer is added so a
// member can fix the input. Never more than about 120 characters of it, never a key, never a dash.

const DATA = require('../../data/providers.json');

const PLAIN = {
  400: 'it did not accept the request',
  401: 'the key was refused',
  402: 'the account is out of credit',
  403: 'the key is not allowed to do this',
  404: 'it could not find that',
  409: 'it is already working on that request',
  413: 'the file is too big for it',
  422: 'it did not accept the request',
  429: 'too many requests right now, try again in a minute',
};

function reasonFor(status) {
  if (PLAIN[status]) return PLAIN[status];
  if (status >= 500) return 'it had a problem on its side, try again in a few minutes';
  return 'it could not do this one';
}

// The secret strings to keep out of any message: a string key, or every string inside { key, secret }.
function secretsOf(key) {
  if (!key) return [];
  if (typeof key === 'string') return [key];
  if (typeof key === 'object') return Object.values(key).filter((v) => typeof v === 'string' && v);
  return [];
}

// A short plain line: no keys, no dashes, no markup, one line, at most `max` characters.
function clean(text, key, max = 100) {
  let s = String(text == null ? '' : text);
  for (const k of secretsOf(key)) if (k.length >= 4) s = s.split(k).join('[key]');
  s = s
    .replace(/(Key|Bearer|Token)\s+[A-Za-z0-9._:\-]{8,}/gi, '$1 [key]')
    .replace(/[\u2012-\u2015]/g, ',')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > max) s = `${s.slice(0, max - 3).trim()}...`;
  return s;
}

// The service's own short reason from a JSON error answer, if it gave one.
function detailOf(body) {
  if (!body) return '';
  let j = null;
  try {
    j = JSON.parse(body);
  } catch {
    return '';
  }
  if (!j || typeof j !== 'object') return '';
  const pick = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return pick(v[0]);
    if (typeof v === 'object') return pick(v.msg || v.message || v.detail || v.error || v.reason);
    return '';
  };
  return pick(j.detail) || pick(j.error) || pick(j.message) || pick(j.failure) || pick(j.errors);
}

function httpError(service, status, body, key) {
  let msg = `${service} answered ${status}: ${reasonFor(status)}`;
  if ([400, 404, 409, 422].includes(status)) {
    const d = clean(detailOf(body), key, 90);
    if (d) msg += ` (${d})`;
  }
  const e = new Error(`${clean(msg, key, 160)}.`);
  e.status = status;
  return e;
}

// The member's own account: Hub's client (lib/harness/connectors), which adds their key itself and
// reaches only the provider's hosts.
const isClient = (key) => !!key && typeof key === 'object' && typeof key.request === 'function';

// Headers the client sets itself (their key, fal's store-nothing, Runway's version) or sets from the
// body; two copies of one would reach the service.
const CLIENT_SETS = /^(authorization|content-type|cookie|x-api-key|xi-api-key|x-goog-api-key|x-runway-version|x-fal-store-io|hf-.*)$/i;

async function viaClient(ctx, service, client, url, { method, headers, body, timeoutMs, raw }) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) if (!CLIENT_SETS.test(k) && v != null) h[k.toLowerCase()] = String(v); // lower case, so ours replace the client's defaults
  let b = body;
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b); // the client serializes JSON itself
    } catch {
      b = Buffer.from(b);
    }
  }
  let r;
  try {
    r = await client.request(url, { method, headers: h, body: b, raw, timeout: Math.min(60000, timeoutMs) });
  } catch (e) {
    if (ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
    const status = Number(e && (e.status || e.statusCode)) || 0;
    if (status >= 400) throw httpError(service, status, '', null);
    const said = clean(e && e.message, null, 140);
    throw new Error(said || `${service} could not be reached. Try again in a few minutes.`);
  }
  if (raw) {
    const data = r && r.body != null ? Buffer.from(r.body) : Buffer.alloc(0);
    return { data, type: String((r && r.type) || '').split(';')[0].trim() };
  }
  return r && typeof r === 'object' ? r : {};
}

// One web call with 127's key (string or { key, secret }) or the member's client. Returns parsed
// JSON (or { data: Buffer, type } with raw: true). Throws a plain error. plain: true sends it
// through ctx.fetch with no account at all (a presigned upload link).
async function call(ctx, service, key, url, { method = 'GET', headers = {}, body, timeoutMs = 60000, raw = false, plain = false } = {}) {
  if (isClient(key) && !plain) return viaClient(ctx, service, key, url, { method, headers, body, timeoutMs, raw });
  if (isClient(key)) key = null;
  let res;
  try {
    res = await ctx.fetch(url, { method, headers, body, timeoutMs: Math.min(60000, timeoutMs) });
  } catch (e) {
    if (ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
    const slow = /time|abort/i.test(String((e && (e.name || e.message)) || ''));
    throw new Error(slow ? `${service} did not answer in time. Try again in a few minutes.` : `${service} could not be reached. Try again in a few minutes.`);
  }
  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch {
      text = '';
    }
    throw httpError(service, res.status, text, key);
  }
  if (raw) {
    const type = String((res.headers && res.headers.get && res.headers.get('content-type')) || '').split(';')[0].trim();
    return { data: Buffer.from(await res.arrayBuffer()), type };
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${service} sent an answer we could not read.`);
  }
}

// A failed job's reason in plain words: the content filter, or a short cleaned line.
function jobError(service, reason, key) {
  const r = String(reason || '');
  if (/nsfw|safety|moderat|policy|filter|prohibit/i.test(r)) return `${service} turned this one down: its content filter stopped it. Try a different prompt or image.`;
  const c = clean(r, key, 90);
  return c ? `${service} could not make this one (${c}).` : `${service} could not make this one. Try again in a minute.`;
}

const MAX_INLINE = 20e6;

function dataUri(file, service, max = MAX_INLINE) {
  if (!file || !file.data || !file.data.length) throw new Error(`${service} needs a file here and none came.`);
  if (file.data.length > max) throw new Error(`That file is too big to send to ${service} (the most is ${Math.round(max / 1e6)} MB).`);
  return `data:${file.type || 'application/octet-stream'};base64,${Buffer.from(file.data).toString('base64')}`;
}

// About how long an audio file runs, for a price before we have it: the request's seconds, else the
// size at 128 kbps MP3 (16,000 bytes a second), else a minute.
function audioSeconds(req) {
  if (Number(req.seconds) > 0) return Number(req.seconds);
  if (req.audio && req.audio.data && req.audio.data.length) return Math.max(1, Math.ceil(req.audio.data.length / 16000));
  return 60;
}

function count(req, max = 1) {
  const n = Math.max(1, Math.floor(Number(req.count) || 1));
  return Math.min(n, max);
}

const round = (x) => Math.round(x * 1e6) / 1e6;

// A model entry for a plugin from data/providers.json plus its usd(req).
function model(provider, id, usd, extra = {}) {
  const d = DATA[provider].models[id];
  if (!d) throw new Error(`No price data for ${provider} ${id}.`);
  const from = d.from || (d.endpoints ? Object.keys(d.endpoints) : ['text']);
  const m = { id, kind: d.kind, label: d.label, from, audio: !!d.audio, data: d, ...extra };
  if (d.seconds) m.seconds = d.seconds.slice();
  if (d.aspects) m.aspects = d.aspects.slice();
  if (d.maxCount) m.maxCount = d.maxCount;
  m.usd = (req = {}) => {
    const v = usd(req || {}, d);
    if (!Number.isFinite(v) || v < 0) throw new Error('No price for this request.');
    return round(v);
  };
  return m;
}

function find(models, id) {
  const m = models.find((x) => x.id === id);
  if (!m) throw new Error('That model is not one we offer.');
  return m;
}

// Only https links on the service's own host get the key.
function sameHost(url, host) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' && u.hostname === host;
  } catch {
    return false;
  }
}

// What Legal's row 8 says about a provider (data/providers.json): its usage policy link, any
// attribution it requires, whether 127's own key may be used ('cleared') or only the member's own
// account ('waits'), and that a member may connect their own account.
function legalOf(d) {
  return {
    policy: d.policy,
    attribution: d.attribution || null,
    account127: d.account127 === 'cleared' ? 'cleared' : 'waits',
    ownAccount: d.ownAccount === true,
  };
}

module.exports = { DATA, legalOf, call, isClient, clean, httpError, jobError, dataUri, audioSeconds, count, model, find, sameHost, reasonFor, MAX_INLINE };
