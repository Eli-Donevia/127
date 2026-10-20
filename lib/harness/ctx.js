// The ctx a tool gets on every call (contract section 7). Built by the engine for one tool call:
// it knows the member, the run, the step and the tool, so every cost, file, lead and log line lands
// in the right place, and a tool can only read the keys it declared in `needs`.

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const dns = require('dns').promises;

const llm = require('./llm');
const needs = require('./needs');
const ledger = require('./ledger');
const library = require('./library');
const pipeline = require('./pipeline');
const places = require('./places');
const brainLib = require('./brain');
const docs = require('./docs');
const flags = require('./flags');
const cache = require('./cache');
const { plain, clip, scrubKeys } = require('./text');

const env = (key, fallback) => (process.env[key] === undefined || process.env[key] === '' ? fallback : process.env[key]);
const forTool = (l) => (l && l.placeId ? { ...l, name: places.NAME } : l);
// emit(type, payload): analytics events (harness.hooks sets it); here, the budget alarms.
const deps = { fetch: (...a) => fetch(...a), lookup: (host) => dns.lookup(host, { all: true }), now: () => Date.now(), emit: () => {} };

// ---------- spending limits ----------
// Per run (HARNESS_MAX_RUN_USD, default $3) and per day across everyone (HARNESS_MAX_DAY_USD,
// default $100, Eli's v2 budget). Past either, AI calls and paid lookups stop with a clear message.

const day = { key: '', usd: 0 };
function dayKey() {
  return new Date(deps.now()).toISOString().slice(0, 10);
}
function daySpent() {
  if (day.key !== dayKey()) {
    day.key = dayKey();
    day.usd = 0;
  }
  return day.usd;
}
// Alarms at 50% and 80% of the daily cap, once each per day: a log line and a harness.budget event.
const warned = { key: '', at: 0 };
function addDay(usd) {
  daySpent();
  day.usd += usd || 0;
  const maxDay = Number(env('HARNESS_MAX_DAY_USD', '100'));
  if (!(maxDay > 0)) return;
  if (warned.key !== day.key) Object.assign(warned, { key: day.key, at: 0 });
  for (const pct of [50, 80]) {
    if (warned.at >= pct || day.usd < (maxDay * pct) / 100) continue;
    warned.at = pct;
    console.warn(`[harness] AI and data spending today is at ${pct}% of the $${maxDay} daily cap`);
    try {
      deps.emit('harness.budget', { pct, usd: Math.round(day.usd * 100) / 100, cap: maxDay });
    } catch {
      /* best-effort */
    }
  }
}
function checkBudget(run) {
  const maxRun = Number(env('HARNESS_MAX_RUN_USD', '3'));
  const maxDay = Number(env('HARNESS_MAX_DAY_USD', '100'));
  if (maxDay > 0 && daySpent() >= maxDay) {
    console.error(`[harness] daily spending limit reached ($${maxDay}); paid calls are paused until tomorrow (UTC)`);
    throw new Error("127 hit today's limit for AI and data. Your run will be able to continue tomorrow.");
  }
  if (run && maxRun > 0 && (run.usd || 0) >= maxRun) throw new Error('This run reached its cost limit. Start a smaller run, or ask us to raise it.');
}

// ---------- fetch with guard rails ----------
// Public web addresses only (no private, loopback or link-local addresses, checked on every
// redirect), a timeout, at most 8 at once per member, and at most 2,000 per run.

function privateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function privateIp(ip) {
  if (net.isIPv4(ip)) return privateV4(ip);
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return privateV4(mapped[1]);
    return /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s);
  }
  return true;
}
async function assertPublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (!host || /^localhost$/i.test(host) || /\.local(host)?$/i.test(host) || /\.internal$/i.test(host)) throw new Error("That address isn't on the public web.");
  if (net.isIP(host)) {
    if (privateIp(host)) throw new Error("That address isn't on the public web.");
    return;
  }
  let addrs;
  try {
    addrs = await deps.lookup(host);
  } catch {
    throw new Error(`Couldn't find ${host}.`);
  }
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error("That address isn't on the public web.");
}

function anySignal(signals) {
  const ac = new AbortController();
  for (const s of signals.filter(Boolean)) {
    if (s.aborted) {
      ac.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => ac.abort(s.reason), { once: true });
  }
  return ac.signal;
}

const perMember = new Map();
async function slot(memberId) {
  const s = perMember.get(memberId) || { active: 0, queue: [] };
  perMember.set(memberId, s);
  if (s.active >= 8) await new Promise((r) => s.queue.push(r));
  s.active += 1;
  return () => {
    s.active -= 1;
    const next = s.queue.shift();
    if (next) next();
    else if (!s.active) perMember.delete(memberId);
  };
}

function makeFetch({ memberId, run, signal }) {
  return async function guardedFetch(url, options = {}) {
    if (run) {
      run.fetches = (run.fetches || 0) + 1;
      if (run.fetches > Number(env('HARNESS_MAX_RUN_FETCHES', '2000'))) throw new Error('This run made too many web requests.');
    }
    const release = await slot(memberId);
    const timeout = AbortSignal.timeout(Math.min(Number(options.timeoutMs) || 20000, 60000));
    const sig = anySignal([signal, options.signal, timeout]);
    const mode = options.redirect || 'follow';
    let opts = { ...options, redirect: 'manual', signal: sig };
    delete opts.timeoutMs;
    let current = String(url);
    try {
      for (let hop = 0; hop <= 5; hop++) {
        let u;
        try {
          u = new URL(current);
        } catch {
          // Only the host, if one can be read: the rest of a bad address may hold a key.
          const host = /^[a-z][\w+.-]*:\/\/(?:[^/?#\s@]*@)?([^/?#\s:@]+)/i.exec(String(current));
          throw new Error(host ? `That isn't a web address (${clip(host[1], 80)}).` : "That isn't a web address.");
        }
        if (!/^https?:$/.test(u.protocol)) throw new Error('Only http and https addresses can be fetched.');
        await assertPublic(u.hostname);
        const res = await deps.fetch(u.toString(), opts);
        const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (!loc || mode !== 'follow') {
          if (loc && mode === 'error') throw new Error('The page redirected.');
          return res;
        }
        try {
          if (res.body && typeof res.body.cancel === 'function') await res.body.cancel();
        } catch {
          /* ignore */
        }
        current = new URL(loc, u).toString();
        const method = String(opts.method || 'GET').toUpperCase();
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== 'GET' && method !== 'HEAD')) {
          opts = { ...opts, method: 'GET', body: undefined };
        }
      }
      throw new Error('Too many redirects.');
    } finally {
      release();
    }
  };
}

// ---------- the ctx ----------

// hooks: { log(text), progress(done, total), cost(usd, what) }
// ctx.brain.search(q, { limit }): passages from the member's Brain docs, decisions and house rules,
// best first: [{ title, heading, text, link, source, kind }]. Empty while BRAIN_DOCS is off.
// Not enumerable, so the snapshot still copies and serializes as plain data.
function withSearch(snap, user) {
  const out = { ...snap };
  Object.defineProperty(out, 'search', {
    enumerable: false,
    value: (q, { limit = 5 } = {}) => (flags.on('BRAIN_DOCS', user) ? docs.search(user.id, String(q || ''), { limit }).map(({ title, heading, text, link, source, kind }) => ({ title, heading, text, link, source, kind })) : []),
  });
  return out;
}

function make({ user, run, step, tool, pack, index, signal, brain, hooks = {} }) {
  const member = { id: user.id, firstName: brainLib.firstName(user), tier: ledger.tierOf(user), timezone: (brain && brain.business && brain.business.timezone) || 'America/Chicago' };
  // needs: keys the tool can't work without (missing one means sample data); wants: keys it uses
  // when they're set and works without.
  const declared = new Set((tool.needs || []).concat(tool.wants || []));
  const sample = !!(run && run.sample) || (tool.needs || []).some((n) => !needs.available(n, user));
  const dirs = [];
  let logs = 0;

  const ctx = {
    member,
    inputs: JSON.parse(JSON.stringify((run && run.inputs) || {})),
    brain: withSearch(brain || brainLib.snapshot(user), user),
    sample,
    index,
    signal,
    now: () => deps.now(),

    async ai(opts = {}) {
      checkBudget(run);
      return llm.call({
        ...opts,
        tier: member.tier,
        spentUsd: ledger.spentUsd(user),
        brain: ctx.brain,
        signal,
        onCost: async (meta) => {
          addDay(meta.usd);
          if (hooks.cost) await hooks.cost(meta.usd, `AI ${meta.task} on ${meta.model}`, meta);
        },
      });
    },

    fetch: makeFetch({ memberId: user.id, run, signal }),

    secret(name) {
      if (!declared.has(name)) throw new Error(`${tool.name} didn't declare "${name}" in needs or wants.`);
      if (sample) return null;
      // The member's own accounts come back as a client; writes work only from an approved `act` step.
      // An AI team role (lib/harness/team.js) reaches only the member's accounts its card lists.
      if (needs.member(name) && run && String(run.source || '').startsWith('team:') && !require('./team').allows(String(run.source).slice(5), name, tool.risk === 'act')) {
        throw new Error(`This AI team role isn't set up to use ${name}.`);
      }
      if (needs.member(name)) return needs.read(name, user, { write: tool.risk === 'act', approvedBy: step && step.approvedBy, runId: run && run.id, tool: tool.name, who: require('./activity').whoOf(run && run.source) });
      return needs.read(name);
    },

    async spend(usd, what) {
      const n = Number(usd);
      if (!Number.isFinite(n) || n < 0) return;
      addDay(n);
      if (hooks.cost) await hooks.cost(n, clip(what || tool.name, 120));
      checkBudget(run);
    },

    async save(name, data, opts = {}) {
      return library.save({ id: user.id, tier: member.tier }, name, data, { ...opts, runId: run && run.id, stepId: step && step.id });
    },

    // A file from the member's Library (an input with format 'asset' holds its id), copied to a temp
    // folder that's removed after the call: { id, name, type, bytes, path }.
    async asset(id) {
      const got = await library.read(user.id, String(id || ''));
      if (!got) throw new Error("That file isn't in your Library anymore.");
      const file = path.join(ctx.tmpdir(), got.asset.name);
      fs.writeFileSync(file, got.buf);
      return { id: got.asset.id, name: got.asset.name, type: got.asset.type, bytes: got.asset.bytes, path: file };
    },

    tmpdir() {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), '127-harness-'));
      dirs.push(d);
      return d;
    },

    // upsert and list see this pack's leads (list({ all: true }) sees the whole Pipeline, for
    // follow-ups across packs); get and update reach any lead of the member's by id (Today's queue
    // hands a lead id to the hq pack). update fills in messages and notes, marks a reply answered and
    // moves the stage forward only, like upsert.
    // A Google business (placeId) has no stored name, so tools get "[business name]" and the
    // messages they write keep it until the member's screen fills it in (Legal L53).
    leads: {
      upsert: async (lead) => forTool(await pipeline.upsert(user.id, pack, lead, { runId: run && run.id })),
      list: ({ stage, limit, all } = {}) => pipeline.list(user.id, { stage, limit: Math.max(1, Math.min(2000, Number(limit) || 500)), pack: all ? undefined : pack }).map(forTool),
      get: async (id) => {
        const l = pipeline.get(user.id, String(id || ''));
        return l ? forTool(pipeline.view(l)) : null;
      },
      update: async (id, patch) => forTool(await pipeline.update(user.id, String(id || ''), patch)),
    },

    remember: (key, value) => brainLib.remember(user.id, pack, key, value),

    cache: cache.forPack(pack),

    log(text) {
      logs += 1;
      if (logs > 200) return;
      const line = clip(scrubKeys(plain(text)), 300);
      if (line && hooks.log) hooks.log(line);
    },

    progress(done, total) {
      if (hooks.progress) hooks.progress(Math.max(0, Number(done) || 0), Math.max(0, Number(total) || 0));
    },
  };

  Object.defineProperty(ctx, '_cleanup', {
    enumerable: false,
    value: () => {
      for (const d of dirs) {
        try {
          fs.rmSync(d, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    },
  });
  return ctx;
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { make, makeFetch, privateIp, assertPublic, checkBudget, daySpent, addDay, _setDeps, _day: day };
