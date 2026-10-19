// Small helpers shared by the gym pack's tools. No dependencies.

// Bot convention (like Googlebot's): says who we are, and servers that reject UAs without "Mozilla" still answer.
const UA = 'Mozilla/5.0 (compatible; 127-gym-pack/0.1; +https://127group.io)';

function kmBetween(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const kmToMiles = (km) => km * 0.621371;
const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

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
// What a member reads: "accel-fitness.com" (no scheme, no trailing slash, path only when it matters).
function shortSite(u) {
  try {
    const url = new URL(normalizeUrl(u));
    const path = url.pathname.replace(/\/+$/, '');
    return url.hostname.replace(/^www\./, '') + (path && path.length < 30 ? path : '');
  } catch {
    return '';
  }
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Plain text for anything a member reads: no em or en dashes, no markdown emphasis, single spaces.
function plain(s) {
  return String(s == null ? '' : s)
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\*\*|__/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
}

function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function median(nums) {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
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
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new Error('Stopped.'));
      }, { once: true });
    }
  });

// fetch through ctx with a timeout of our own on top of the harness's, returning { status, text, url, headers }.
async function getText(ctx, url, { timeoutMs = 15000, maxBytes = 1.5e6, headers = {}, method = 'GET', body } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onAbort = () => ac.abort();
  if (ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await ctx.fetch(url, {
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
    if (ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
  }
}

async function cached(ctx, key, hours, fn) {
  if (ctx.cache) {
    try {
      const hit = await ctx.cache.get(key);
      if (hit != null) return hit;
    } catch {
      /* cache is best effort */
    }
  }
  const val = await fn();
  if (ctx.cache && val != null) {
    try {
      await ctx.cache.set(key, val, hours);
    } catch {
      /* best effort */
    }
  }
  return val;
}

function now(ctx) {
  return ctx && typeof ctx.now === 'function' ? ctx.now() : Date.now();
}

function log(ctx, text) {
  if (ctx && typeof ctx.log === 'function') ctx.log(plain(text));
}

// $1,080 style, for anything a person reads.
// A CSV a spreadsheet opens cleanly. Cells that start like a formula get a leading quote, so a gym's
// name or a scraped line can never run as one.
function toCsv(columns, rows) {
  const cell = (v) => {
    let t = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))].join('\r\n') + '\r\n';
}

const money = (n) => (Number.isFinite(Number(n)) ? `$${Math.round(Number(n)).toLocaleString('en-US')}` : '');

module.exports = {
  money,
  UA,
  kmBetween,
  kmToMiles,
  round,
  normalizeUrl,
  domainOf,
  shortSite,
  slug,
  toCsv,
  plain,
  titleCase,
  clamp,
  median,
  sleep,
  getText,
  cached,
  now,
  log,
};
