// Tape (flag HQ_TAPE, lib/harness/flags.js): a watchlist for traders in HQ. A chart per symbol, the member's own flags
// (price levels, a big opening gap, a volume spike, earnings soon, a trading pause) and a plain read of what already
// happened, all worked out in code from the numbers. Legal L88, TK1 to TK8 (legal/handoffs/ticker.md).
//
// Facts only (TK1). Every line here describes what already happened. Nothing says where a price is going: no
// predictions, targets, buy, sell or hold, no "bullish", "overbought", ratings or rankings. guard() drops any line with
// a word from TK1's list, and every line this module writes passes through it. No market data goes to AI.
//
// The member's own key (TK3). The member is the data provider's customer. The key is encrypted with HQ_SECRET (HQ v1's
// enc/dec, K1), calls go only to the provider's host (ALLOW, K2), and a member's data is cached only for that member,
// for a minute, in memory. The server keeps the watchlist, the price levels and which flags are on (the `tape`
// collection, doc id = user id) and nothing else. Without a key the page runs on invented sample tickers, labeled.

const crypto = require('crypto');

// ---------- TK1: the words no line may carry ----------
const BANNED = ['will', 'likely', 'expect', 'expects', 'expected', 'target', 'targets', 'should', 'buy', 'buying', 'sell', 'selling', 'hold', 'holding', 'bull', 'bullish', 'bear', 'bearish', 'rally', 'crash', 'breakout', 'upside', 'downside', 'outperform', 'undervalued', 'overvalued', 'overbought', 'oversold'];
const BANNED_RE = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i');
const clean = (line) => typeof line === 'string' && line.trim() !== '' && !BANNED_RE.test(line);
function guard(lines) { return (lines || []).filter(clean); }

// TK5, word for word.
const NOTICE = "For information only, not investment advice. 127 isn't an investment adviser or broker-dealer, and nothing here recommends buying, selling or holding any security. Data comes from your provider, may be delayed or wrong, and past moves don't predict future ones. Trading can lose money.";
const ALERT_NOTE = "Alerts can arrive late or not at all. Don't rely on them alone to trade.";

// ---------- providers (TK3, K2) ----------
// One for now. A provider joins only with a plan that allows use in other apps, and its host goes in ALLOW.
const PROVIDERS = {
  polygon: {
    id: 'polygon', name: 'Polygon.io', host: 'api.polygon.io', signup: 'https://polygon.io/pricing',
    attribution: 'Market data from Polygon.io',
    plan: 'Use a Polygon.io plan that allows use in other apps. Free plans allow about 5 calls a minute, so the list refreshes slowly on them.',
    key: /^[A-Za-z0-9_-]{16,64}$/,
  },
};
const ALLOW = new Set(Object.values(PROVIDERS).map((p) => p.host));

const SYMBOL = /^[A-Z][A-Z0-9.-]{0,9}$/;
const MAX_LIST = 30;
const MAX_LEVELS = 10;
const RULES = [
  ['gap', 'Big opening gap', 'Opens 4% or more from yesterday\'s close'],
  ['vol', 'Volume spike', '1.8x normal for the time of day'],
  ['earn', 'Earnings coming', 'Within 5 trading days, when your provider has dates'],
  ['halt', 'Trading paused', 'A halt or volatility pause, when your provider reports it'],
  ['cross', 'My price levels', 'When price reaches a level you set'],
];
const DEFAULT_RULES = Object.fromEntries(RULES.map((r) => [r[0], true]));

// ---------- the member's record ----------
let deps = null;
const db = () => (deps && deps.db) || require('../db');
const hq = () => (deps && deps.hq) || require('../hq');
function setDeps(d) { deps = d; }

function record(userId) {
  const r = db().get('tape', userId) || {};
  return { id: userId, list: Array.isArray(r.list) ? r.list : [], levels: r.levels && typeof r.levels === 'object' ? r.levels : {}, rules: { ...DEFAULT_RULES, ...(r.rules || {}) }, key: r.key || null };
}
// What the page sees: never the key, only which provider and its last four characters.
function view(rec) {
  return { list: rec.list, levels: rec.levels, rules: rec.rules, key: rec.key ? { provider: rec.key.provider, tail: rec.key.tail, at: rec.key.at } : null };
}

// Cleans what the page sends. Returns null when nothing usable came.
function tidy(body) {
  if (!body || typeof body !== 'object') return null;
  const list = [];
  for (const s of Array.isArray(body.list) ? body.list : []) {
    const sym = String(s || '').trim().toUpperCase();
    if (SYMBOL.test(sym) && !list.includes(sym)) list.push(sym);
    if (list.length >= MAX_LIST) break;
  }
  const levels = {};
  const inLv = body.levels && typeof body.levels === 'object' ? body.levels : {};
  for (const sym of Object.keys(inLv)) {
    const S = sym.toUpperCase();
    if (!SYMBOL.test(S) || !Array.isArray(inLv[sym])) continue;
    const vals = inLv[sym].map(Number).filter((n) => Number.isFinite(n) && n > 0 && n < 1e7).map((n) => Math.round(n * 10000) / 10000);
    if (vals.length) levels[S] = [...new Set(vals)].slice(0, MAX_LEVELS);
  }
  const rules = {};
  const inR = body.rules && typeof body.rules === 'object' ? body.rules : {};
  for (const [k] of RULES) rules[k] = inR[k] === undefined ? true : !!inR[k];
  return { list, levels, rules };
}

async function save(userId, body) {
  const t = tidy(body);
  if (!t) return null;
  const rec = record(userId);
  const doc = { ...(db().get('tape', userId) || {}), id: userId, ...t, key: rec.key, updatedAt: new Date().toISOString() };
  await db().save('tape', doc);
  return view(record(userId));
}

async function connect(userId, providerId, key) {
  const p = PROVIDERS[providerId];
  if (!p) return { error: 'Pick a data provider.' };
  if (!hq().secretReady()) return { error: "Keys can't be saved yet. This opens once 127's key vault is set up." };
  const k = String(key || '').trim();
  if (!p.key.test(k)) return { error: `That doesn't look like a ${p.name} key. Copy it again from your ${p.name} dashboard.` };
  const doc = { ...(db().get('tape', userId) || {}), id: userId };
  doc.key = { provider: p.id, enc: hq().enc(k), tail: k.slice(-4), at: new Date().toISOString() };
  await db().save('tape', doc);
  forget(userId);
  return { ok: true };
}

async function disconnect(userId) {
  const doc = db().get('tape', userId);
  if (doc && doc.key) { delete doc.key; await db().save('tape', doc); }
  forget(userId);
}

// ---------- fetching, per member only ----------
const cache = new Map(); // `${userId}|${sym}|${tf}` -> { at, data }. Never read across members (TK3).
const TTL = 60 * 1000;
function forget(userId) { for (const k of cache.keys()) if (k.startsWith(`${userId}|`)) cache.delete(k); }

const fetcher = () => (deps && deps.fetch) || fetch;
async function getJson(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !ALLOW.has(u.host)) throw Object.assign(new Error('host not allowed'), { code: 'host' });
  let res;
  try {
    res = await fetcher()(u.toString(), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch (e) {
    throw Object.assign(new Error('provider unreachable'), { code: 'down' });
  }
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('key refused'), { code: 'key' });
  if (res.status === 429) throw Object.assign(new Error('rate limited'), { code: 'limit' });
  if (!res.ok) throw Object.assign(new Error(`provider ${res.status}`), { code: 'down' });
  return res.json();
}

// Market dates in New York.
function nyDate(d = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
function daysAgo(n, d = new Date()) { return nyDate(new Date(d.getTime() - n * 86400000)); }

const polygon = {
  async bars(key, sym, mult, span, from, to) {
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${mult}/${span}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${encodeURIComponent(key)}`;
    const j = await getJson(url);
    return (j.results || []).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0 }));
  },
};

// tf: '1D' (5-minute bars today), '5D' (30-minute bars), '1M' or '3M' (daily), 'list' (daily, for the watchlist row).
async function live(userId, sym, tf) {
  const rec = record(userId);
  if (!rec.key) return null;
  const key = hq().dec(rec.key.enc);
  if (!key) throw Object.assign(new Error('key unreadable'), { code: 'key' });
  const ck = `${userId}|${sym}|${tf}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const today = nyDate();
  const daily = await polygon.bars(key, sym, 1, 'day', daysAgo(140), today);
  let bars;
  if (tf === '1D') bars = await polygon.bars(key, sym, 5, 'minute', today, today);
  else if (tf === '5D') bars = await polygon.bars(key, sym, 30, 'minute', daysAgo(9), today);
  else bars = null;
  const data = shape(sym, tf, daily, bars, today);
  data.provider = { name: PROVIDERS[rec.key.provider].name, attribution: PROVIDERS[rec.key.provider].attribution };
  cache.set(ck, { at: Date.now(), data });
  return data;
}

// Minutes since midnight in New York, to keep intraday bars to the regular session (9:30 to 16:00).
const nyClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function nyMinutes(t) { const [h, m] = nyClock.format(new Date(t)).split(':').map(Number); return h * 60 + m; }
const regular = (b) => { const m = nyMinutes(b.t); return m >= 570 && m < 960; };

// Splits daily bars into history and today's bar (when today's session has one), then builds the view.
function shape(sym, tf, dailyAll, intraday, today) {
  const isToday = (b) => nyDate(new Date(b.t)) === today;
  const hist = dailyAll.filter((b) => !isToday(b));
  const todayBar = dailyAll.find(isToday) || null;
  if (intraday) intraday = intraday.filter(regular);
  let day = intraday && tf === '1D' ? intraday.filter(isToday) : null;
  if (tf === '1D' && (!day || !day.length)) day = null;
  const f = facts({ hist, today: todayBar, day });
  let bars;
  let fallback = null;
  if (tf === '1D') { bars = day || hist.slice(-21).concat(todayBar ? [todayBar] : []); if (!day) fallback = 'daily'; }
  else if (tf === '5D') bars = (intraday || []).filter((b) => b.t >= (hist[hist.length - 4] || hist[0] || { t: 0 }).t);
  else if (tf === 'list') bars = [];
  else bars = hist.slice(tf === '1M' ? -21 : -63).concat(todayBar ? [todayBar] : []);
  return { sym, tf, bars, prev: f.prev, facts: f, sample: false, fallback };
}

// ---------- facts (TK1): what already happened, in numbers ----------
function sum(a) { return a.reduce((n, x) => n + x, 0); }
function mean(a) { return a.length ? sum(a) / a.length : 0; }
function stdev(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); }
function rsi(closes, n = 14) {
  if (closes.length <= n) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
// How much of a normal day's volume has traded by bar i of 78 (heavier at the open and the close).
const USHAPE = (() => { const w = []; for (let i = 0; i < 78; i++) { const x = i / 77; w.push(0.6 + 2.2 * (1 - x) ** 6 + 0.9 * x ** 5); } const s = sum(w); return w.map((x) => x / s); })();

// hist: daily bars before today. today: today's daily bar or null. day: today's 5-minute bars or null.
function facts({ hist, today, day }) {
  const prevBar = hist[hist.length - 1] || null;
  const prev = prevBar ? prevBar.c : null;
  const lastBar = day && day.length ? day[day.length - 1] : today || prevBar;
  const last = lastBar ? lastBar.c : null;
  const open = day && day.length ? day[0].o : today ? today.o : null;
  const hi = day && day.length ? Math.max(...day.map((b) => b.h)) : today ? today.h : null;
  const lo = day && day.length ? Math.min(...day.map((b) => b.l)) : today ? today.l : null;
  const vol = day && day.length ? sum(day.map((b) => b.v)) : today ? today.v : null;
  const closes = hist.map((b) => b.c).concat(today || (day && day.length) ? [last] : []);
  const last20 = hist.slice(-20);
  const avgVol = last20.length ? mean(last20.map((b) => b.v)) : null;
  const sma20 = last20.length >= 20 ? mean(last20.map((b) => b.c)) : null;
  const rets = []; for (let i = Math.max(1, hist.length - 20); i < hist.length; i++) rets.push(hist[i].c / hist[i - 1].c - 1);
  const sigma = rets.length >= 10 ? stdev(rets) : null;
  let vw = null;
  if (day && day.length) { let pv = 0, vv = 0; for (const b of day) { pv += ((b.h + b.l + b.c) / 3) * b.v; vv += b.v; } vw = vv ? pv / vv : null; }
  const elapsed = day && day.length ? sum(USHAPE.slice(0, Math.min(78, day.length))) : 1;
  const relVol = vol != null && avgVol ? vol / (avgVol * elapsed) : null;
  // Closes in a row in one direction, counting today's last price when there is one.
  let streak = 0;
  for (let i = closes.length - 1; i > 0; i--) {
    const d = Math.sign(closes[i] - closes[i - 1]);
    if (!d) break;
    if (!streak) streak = d; else if (Math.sign(streak) === d) streak += d; else break;
  }
  return {
    prev, last, open, hi, lo, vol, avgVol, sma20, vwap: vw, relVol, sigma, streak,
    rsi: rsi(closes.slice(-60)),
    chg: last != null && prev ? last - prev : null,
    chgPct: last != null && prev ? last / prev - 1 : null,
    gapPct: open != null && prev ? open / prev - 1 : null,
    hasDay: !!(day && day.length),
  };
}

const money = (x) => (x == null ? 'n/a' : `$${x >= 1000 ? x.toFixed(0) : x.toFixed(2)}`);
const pc = (x, d = 1) => `${Math.abs(x * 100).toFixed(d)}%`;

// The plain read: one sentence per fact, each passed through guard().
function read(sym, f) {
  if (f.last == null) return guard([`No prices came back for ${sym}.`]);
  const L = [];
  if (f.chgPct != null) L.push(`${sym} is ${f.chgPct >= 0 ? 'up' : 'down'} ${pc(f.chgPct)} at ${money(f.last)}, against yesterday's close of ${money(f.prev)}.`);
  if (f.gapPct != null && f.hasDay) L.push(Math.abs(f.gapPct) < 0.005 ? 'It opened flat.' : `It opened ${f.gapPct > 0 ? 'up' : 'down'} ${pc(f.gapPct)}, at ${money(f.open)}.`);
  if (f.hi != null) L.push(`Today's range so far is ${money(f.lo)} to ${money(f.hi)}.`);
  if (f.relVol != null) L.push(`Volume is ${f.relVol.toFixed(1)}x normal for this time of day.`);
  if (f.vwap != null) L.push(`Price is ${f.last >= f.vwap ? 'above' : 'below'} today's VWAP of ${money(f.vwap)}.`);
  if (f.sma20 != null) L.push(`It is ${pc(f.last / f.sma20 - 1)} ${f.last >= f.sma20 ? 'above' : 'below'} its 20-day average of ${money(f.sma20)}.`);
  if (Math.abs(f.streak) >= 2) L.push(`That's ${Math.abs(f.streak)} ${f.streak > 0 ? 'higher' : 'lower'} closes in a row.`);
  if (f.rsi != null) L.push(`RSI (14 days) reads ${f.rsi.toFixed(0)}.`);
  if (f.sigma != null) L.push(`Over the last 20 sessions it moved about ${pc(f.sigma)} on a typical day.`);
  return guard(L);
}

// The member's flags, as facts. extra: { earn: { days, when }, halt: { at } } when the data has them.
function notices(sym, f, rules, levels, extra = {}) {
  const N = [];
  const add = (sev, title, line, at = '') => { if (clean(title) && clean(line)) N.push({ sev, title, line, at }); };
  if (rules.halt && extra.halt) add('high', 'Trading was paused', `${sym} had a trading pause at ${extra.halt.at}. Spreads can be wide right after a pause.`, extra.halt.at);
  if (rules.cross && f.last != null) for (const L of levels || []) {
    const crossed = f.hi != null && f.lo != null && f.lo <= L && f.hi >= L;
    if (crossed) add('high', `Your level ${money(L)} was reached`, 'Price traded through it today.');
    else add('info', `Your level ${money(L)} is ${pc(L / f.last - 1)} away`, `It shows here when price gets there.`);
  }
  if (rules.earn && extra.earn && extra.earn.days <= 5) add('caution', `Earnings ${extra.earn.when}`, `Reports in ${extra.earn.days} trading day${extra.earn.days === 1 ? '' : 's'}. Prices often move more than usual around earnings.`);
  if (rules.gap && f.hasDay && f.gapPct != null && Math.abs(f.gapPct) >= 0.04) add(f.gapPct > 0 ? 'up' : 'caution', `Opened ${f.gapPct > 0 ? 'up' : 'down'} ${pc(f.gapPct)} from yesterday`, `Yesterday closed at ${money(f.prev)}. Today opened at ${money(f.open)}.`);
  if (rules.vol && f.relVol != null && f.relVol >= 1.8) add('caution', `Volume is ${f.relVol.toFixed(1)}x normal for this time of day`, `The 20-day average is ${fmtVol(f.avgVol)} shares for a full day.`);
  if (!N.length) add('info', 'Nothing unusual right now', 'No big gap, no volume spike, and none of your levels nearby.');
  return N;
}
function fmtVol(v) { if (v == null) return 'n/a'; return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(Math.round(v)); }

// ---------- sample data: invented tickers, labeled on the page ----------
const SAMPLE = [
  { sym: 'KSTR', name: 'Kestrel Robotics', px: 184.2, dv: 0.028, gap: 0.062, rv: 3.1, earn: { days: 2, when: 'Thu after close' } },
  { sym: 'ORBT', name: 'Orbit Payments', px: 42.75, dv: 0.022, gap: -0.011, rv: 1.1 },
  { sym: 'MRDN', name: 'Meridian Bio', px: 12.38, dv: 0.05, gap: -0.071, rv: 2.6, halt: 24 },
  { sym: 'QZAR', name: 'Quasar Semis', px: 311.9, dv: 0.03, gap: 0.018, rv: 1.4, earn: { days: 3, when: 'Fri before open' } },
  { sym: 'HLCN', name: 'Halcyon Energy', px: 67.1, dv: 0.018, gap: 0.004, rv: 0.9 },
  { sym: 'TLLY', name: 'Tally Foods', px: 28.4, dv: 0.012, gap: -0.003, rv: 0.8 },
];
const SAMPLE_NOW = 27; // 5-minute bars done at the sample clock, 10:42 CT
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const DAY = 86400000;
const SAMPLE_OPEN = Date.UTC(2026, 9, 21, 13, 30); // a fixed session, so the sample never looks like today's market

function sampleSeries(s) {
  const r = rng(parseInt(crypto.createHash('md5').update(s.sym).digest('hex').slice(0, 8), 16));
  const n = 90, rets = [], closes = []; let c = 1;
  for (let i = 0; i < n; i++) { const x = gauss(r) * s.dv + 0.0006; rets.push(x); c *= Math.exp(x); closes.push(c); }
  const k = s.px / closes[n - 1]; let prev = closes[0] * k / Math.exp(rets[0]);
  const hist = [];
  for (let i = 0; i < n; i++) {
    const cl = closes[i] * k, o = prev * (1 + gauss(r) * s.dv * 0.25);
    hist.push({ t: SAMPLE_OPEN - (n - i) * DAY, o, h: Math.max(o, cl) * (1 + Math.abs(gauss(r)) * s.dv * 0.35), l: Math.min(o, cl) * (1 - Math.abs(gauss(r)) * s.dv * 0.35), c: cl, v: 8e6 * (0.6 + r() * 0.8) * (1 + Math.abs(rets[i]) / s.dv * 0.3) });
    prev = cl;
  }
  const avgVol = mean(hist.slice(-20).map((b) => b.v));
  const day = []; let p = s.px * (1 + s.gap);
  const bias = s.sym === 'MRDN' ? 0.5 : s.gap > 0.03 ? -0.15 : 0.05;
  for (let i = 0; i < SAMPLE_NOW; i++) {
    const paused = s.halt && i === s.halt + 1, sd = s.dv / Math.sqrt(78) * (i < 3 ? 2.2 : 1.2), bo = p;
    let bc = paused ? bo : bo * (1 + gauss(r) * sd + bias * sd * 0.4);
    if (s.halt && i === s.halt) bc = bo * (1 - s.dv * 0.9);
    let bh = Math.max(bo, bc) * (1 + Math.abs(gauss(r)) * sd * 0.5), bl = Math.min(bo, bc) * (1 - Math.abs(gauss(r)) * sd * 0.5);
    if (paused) { bh = bo; bl = bo; }
    day.push({ t: SAMPLE_OPEN + i * 300000, o: bo, h: bh, l: bl, c: bc, v: paused ? 0 : avgVol * USHAPE[i] * s.rv * (0.6 + r() * 0.8) });
    p = bc;
  }
  // Four earlier sessions at 30 minutes, for 5D.
  const five = [];
  for (let d = 4; d >= 1; d--) {
    const db = hist[n - d]; let q = db.o;
    for (let j = 0; j < 13; j++) {
      let nc = j === 12 ? db.c : db.o + (db.c - db.o) * (j + 1) / 13 + gauss(r) * (db.h - db.l) * 0.18;
      nc = Math.min(db.h, Math.max(db.l, nc));
      five.push({ t: SAMPLE_OPEN - d * DAY + j * 1800000, o: q, h: Math.max(q, nc), l: Math.min(q, nc), c: nc, v: db.v / 13 * (0.6 + r() * 0.8) });
      q = nc;
    }
  }
  return { hist, day, five };
}

function sample(sym, tf) {
  const s = SAMPLE.find((x) => x.sym === sym);
  if (!s) return null;
  const { hist, day, five } = sampleSeries(s);
  const f = facts({ hist, today: null, day });
  const todayBar = { t: SAMPLE_OPEN, o: day[0].o, h: f.hi, l: f.lo, c: f.last, v: f.vol };
  let bars;
  if (tf === '1D') bars = day;
  else if (tf === '5D') {
    const t30 = []; for (let i = 0; i < day.length; i += 6) { const g = day.slice(i, i + 6); t30.push({ t: g[0].t, o: g[0].o, c: g[g.length - 1].c, h: Math.max(...g.map((b) => b.h)), l: Math.min(...g.map((b) => b.l)), v: sum(g.map((b) => b.v)) }); }
    bars = five.concat(t30);
  } else if (tf === 'list') bars = day;
  else bars = hist.slice(tf === '1M' ? -21 : -63).concat([todayBar]);
  const extra = { earn: s.earn, halt: s.halt ? { at: clock(s.halt + 1) } : null };
  return { sym, name: s.name, tf, bars, prev: f.prev, facts: f, extra, sample: true, provider: null };
}
// Sample clock label for 5-minute bar i (the session opens at 8:30 CT).
function clock(i) { const m = 8 * 60 + 30 + i * 5, h = Math.floor(m / 60); return `${h > 12 ? h - 12 : h}:${String(m % 60).padStart(2, '0')} CT`; }

// Adds the read and the notices, then trims what the page doesn't need.
function finish(data, rec) {
  const sym = data.sym;
  const lv = rec.levels[sym] || [];
  return {
    sym, name: data.name || null, tf: data.tf, sample: !!data.sample, provider: data.provider || null,
    prev: data.prev, bars: data.bars.map((b) => ({ t: b.t, o: +b.o.toFixed(4), h: +b.h.toFixed(4), l: +b.l.toFixed(4), c: +b.c.toFixed(4), v: Math.round(b.v) })),
    facts: data.facts, read: read(sym, data.facts), notices: notices(sym, data.facts, rec.rules, lv, data.extra || {}),
    halt: data.extra && data.extra.halt ? data.extra.halt : null, fallback: data.fallback || null,
  };
}

module.exports = {
  NOTICE, ALERT_NOTE, PROVIDERS, ALLOW, RULES, DEFAULT_RULES, SAMPLE, BANNED, SYMBOL,
  guard, clean, record, view, tidy, save, connect, disconnect, live, sample, finish, facts, read, notices, shape, setDeps, forget,
  _cache: cache,
};
