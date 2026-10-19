// Fetching public web pages politely: our own timeout and size cap on top of the harness's,
// robots.txt respected, results cached for every member (public data only, contract 7 ctx.cache).
// Adapted from the gym pack's util.js and site-scan.js (v2/workflows/gym-video), generalized.

const UA = 'Mozilla/5.0 (compatible; 127-workflows/0.1; +https://127group.io)';
const AGENT = '127-workflows';

// "accel-fitness.com/" or "http://www.x.com" -> "https://www.x.com/". Null if it isn't a web address.
function normalizeUrl(u) {
  let s = String(u || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  try {
    const url = new URL(s);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function domainOf(u) {
  try {
    return new URL(normalizeUrl(u)).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// What a member reads: "accel-fitness.com" (no scheme, no trailing slash, short paths only).
function shortSite(u) {
  try {
    const url = new URL(normalizeUrl(u));
    const p = url.pathname.replace(/\/+$/, '');
    return url.hostname.replace(/^www\./, '') + (p && p.length < 30 ? p : '');
  } catch {
    return '';
  }
}

// fetch through ctx with a timeout of our own, returning { status, ok, text, url, headers }.
async function getText(ctx, url, { timeoutMs = 15000, maxBytes = 1.5e6, headers = {}, method = 'GET', body } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onAbort = () => ac.abort();
  if (ctx && ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });
  try {
    const doFetch = ctx && typeof ctx.fetch === 'function' ? ctx.fetch : fetch;
    const res = await doFetch(url, {
      method,
      body,
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8', ...headers },
    });
    let text = '';
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        chunks.push(value);
        if (size > maxBytes) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          break;
        }
      }
      text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    } else {
      text = String(await res.text()).slice(0, maxBytes);
    }
    return { status: res.status, ok: res.ok, url: res.url || url, text, headers: res.headers };
  } finally {
    clearTimeout(timer);
    if (ctx && ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
  }
}

async function getJson(ctx, url, opts = {}) {
  const r = await getText(ctx, url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  let data = null;
  try {
    data = JSON.parse(r.text);
  } catch {
    data = null;
  }
  return { ...r, data };
}

// Shared public cache (contract 7): the same public page is fetched once for every member.
// Never put member data in it. hours can be a function of the answer (a failure kept shorter).
async function cached(ctx, key, hours, fn) {
  if (ctx && ctx.cache) {
    try {
      const hit = await ctx.cache.get(key);
      if (hit != null) return hit;
    } catch {
      /* cache is best effort */
    }
  }
  const val = await fn();
  const keep = typeof hours === 'function' ? hours(val) : hours;
  if (ctx && ctx.cache && val != null && keep > 0) {
    try {
      await ctx.cache.set(key, val, keep);
    } catch {
      /* best effort */
    }
  }
  return val;
}

function robotsAllows(robotsTxt, path, agent = AGENT) {
  const lines = String(robotsTxt || '').split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  const groups = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === 'user-agent') {
      if (!cur || cur.rules.length) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
    } else if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ allow: k === 'allow', path: v });
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.toLowerCase().includes(a)));
  const use = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const g of use) {
    for (const r of g.rules) {
      if (!r.path) continue;
      const rx = new RegExp(`^${r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
      if (rx.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
    }
  }
  return !best || best.allow;
}

async function allowed(ctx, url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const robots = await cached(ctx, `web:robots:${u.host}`, 24 * 7, async () => {
    try {
      const r = await getText(ctx, `${u.protocol}//${u.host}/robots.txt`, { timeoutMs: 6000, maxBytes: 200000, headers: { Accept: 'text/plain' } });
      return r.ok && !/<html/i.test(r.text.slice(0, 200)) ? r.text : '';
    } catch {
      return '';
    }
  });
  return robotsAllows(robots, u.pathname || '/');
}

// One public HTML page, robots respected. { url, status, html } or { url, blocked | error | notHtml }.
async function fetchPage(ctx, url, { timeoutMs = 12000, maxBytes = 1.5e6 } = {}) {
  if (!(await allowed(ctx, url))) return { url, blocked: 'robots' };
  try {
    const r = await getText(ctx, url, { timeoutMs, maxBytes });
    const type = r.headers && typeof r.headers.get === 'function' ? r.headers.get('content-type') || '' : '';
    if (!r.ok) return { url, status: r.status };
    if (type && !/html/i.test(type)) return { url, status: r.status, notHtml: true };
    return { url: r.url || url, status: r.status, html: r.text, bytes: Buffer.byteLength(r.text, 'utf8') };
  } catch (e) {
    return { url, error: /abort/i.test(String(e && e.message)) ? 'timeout' : 'unreachable' };
  }
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(t);
        reject(new Error('Stopped.'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new Error('Stopped.'));
        },
        { once: true }
      );
    }
  });

// Runs fn over items with at most `limit` at once, keeping order. Stops early if ctx.signal fires.
async function mapLimit(items, limit, fn, ctx) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      if (ctx && ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
      const i = next++;
      out[i] = await fn(items[i], i);
      done++;
      if (ctx && typeof ctx.progress === 'function') ctx.progress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// A server's error text can echo the request, and 127's own map servers carry a key in the URL: in
// the path (Tracestrack's Overpass) or the query (LocationIQ's ?key=). Anything from such a server
// goes through this before it's logged, saved or shown: a URL keeps only its scheme and host, and
// key-like values are hidden (Legal L57; the gym pack's util.scrubKeys does the same, G55).
function scrubKeys(text) {
  return String(text == null ? '' : text)
    .replace(/\b(https?:\/\/[^\s/?#"'<>]+)[^\s"'<>]*/gi, '$1/[hidden]')
    .replace(/\/overpass\/[^\s/"'<>]+/gi, '/overpass/[hidden]')
    .replace(/([?&](?:key|api_?key|access_token|token)=)[^&\s"'<>]+/gi, '$1[hidden]')
    .replace(/\b(?=[A-Za-z0-9._-]*\d)(?=[A-Za-z0-9._-]*[A-Za-z])[A-Za-z0-9._-]{24,}/g, '[hidden]');
}

module.exports = { UA, AGENT, normalizeUrl, domainOf, shortSite, getText, getJson, cached, robotsAllows, allowed, fetchPage, sleep, mapLimit, scrubKeys };
