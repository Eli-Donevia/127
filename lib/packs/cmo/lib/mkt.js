// What the marketing tools share: the member's posts, ads and products for a stretch of days, scored
// against their own usual, with plain reasons drawn from the same files. The export readers are the
// kpi pack's (required by path, see README): one way to read a Shopify or Meta export for both packs.

const T = require('../../kpi/lib/table');
const L = require('../../kpi/lib/ledger');
const M = require('../../kpi/lib/metrics');
const R = require('../../kpi/lib/report');
const KINDS = require('../data/kinds.json');

const r0 = (n) => Math.round(n);
const r2 = (n) => Math.round(n * 100) / 100;

function median(xs) {
  const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const times = (x) => `${x >= 10 ? Math.round(x) : x.toFixed(1)}x`;
const pct = (x, dg = 1) => `${(x * 100).toFixed(dg)}%`;
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const slotOf = (hour) => (hour == null ? null : hour < 11 ? 'morning' : hour < 16 ? 'afternoon' : 'evening');

// The last full week and the 4 before it, or the last full month and the one before it.
function weekSpan(led) {
  const wk = L.lastFullWeek(led.to);
  return { from: wk.from, to: wk.to, baseFrom: T.addDays(wk.from, -28), baseTo: T.addDays(wk.from, -1), weeks: 4, label: 'this week' };
}

function monthSpan(led) {
  const [y, m] = led.to.split('-').map(Number);
  const lastOfMonth = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  const isLast = Number(led.to.slice(8)) === lastOfMonth(y, m);
  const [fy, fm] = isLast ? [y, m] : m === 1 ? [y - 1, 12] : [y, m - 1];
  const [by, bm] = fm === 1 ? [fy - 1, 12] : [fy, fm - 1];
  return {
    from: `${fy}-${pad(fm)}-01`,
    to: `${fy}-${pad(fm)}-${pad(lastOfMonth(fy, fm))}`,
    baseFrom: `${by}-${pad(bm)}-01`,
    baseTo: `${by}-${pad(bm)}-${pad(lastOfMonth(by, bm))}`,
    monthName: new Date(Date.UTC(fy, fm - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }),
    baseName: new Date(Date.UTC(by, bm - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' }),
  };
}

// ---------- posts ----------

function kindOf(caption) {
  const c = String(caption || '').toLowerCase();
  for (const k of KINDS.kinds) if (k.words.some((w) => new RegExp(`(^|[^a-z])${w}`, 'i').test(c))) return k.id;
  return 'other';
}
const kindLabel = (id) => (KINDS.kinds.find((k) => k.id === id) || { label: 'Other' }).label;

const engaged = (p) => p.likes + p.comments + p.shares + p.saves;
const engRate = (p) => (p.views ? engaged(p) / p.views : 0);

// Every post in [from, to] with its views and engagement against the same platform's median over
// the base stretch, its kind (from caption words), format, weekday and time of day.
function posts(records, span) {
  const all = records.filter((r) => r.t === 'post' && r.date);
  const base = all.filter((p) => p.date >= span.baseFrom && p.date <= span.baseTo);
  const ref = all.filter((p) => p.date >= span.baseFrom && p.date <= span.to);
  const usual = {};
  for (const src of new Set(all.map((p) => p.src))) {
    const pool = base.filter((p) => p.src === src).length >= 4 ? base.filter((p) => p.src === src) : ref.filter((p) => p.src === src);
    usual[src] = { views: median(pool.map((p) => p.views)), eng: median(pool.map(engRate)), saves: median(pool.map((p) => (p.views ? p.saves / p.views : 0))), n: pool.length };
  }
  const scored = (p) => {
    const u = usual[p.src] || { views: 0, eng: 0, saves: 0 };
    const vx = u.views ? p.views / u.views : 1;
    const ex = u.eng ? engRate(p) / u.eng : 1;
    return { ...p, kind: kindOf(p.caption), vx, ex, sx: u.saves && p.views ? p.saves / p.views / u.saves : 1, score: 0.65 * Math.min(vx, 6) + 0.35 * Math.min(ex, 4), wd: weekday(p.date), slot: slotOf(p.hour) };
  };
  return { now: all.filter((p) => p.date >= span.from && p.date <= span.to).map(scored), ref: ref.map(scored), usual };
}

// How each format, kind, weekday and time of day did over the reference posts (views against usual).
function patterns(ref) {
  const group = (key) => {
    const g = new Map();
    for (const p of ref) {
      const k = p[key];
      if (k == null) continue;
      const x = g.get(k) || { key: k, n: 0, vx: [], ex: [] };
      x.n += 1;
      x.vx.push(p.vx);
      x.ex.push(p.ex);
      g.set(k, x);
    }
    return [...g.values()].map((x) => ({ key: x.key, n: x.n, vx: median(x.vx), ex: median(x.ex) })).sort((a, b) => b.vx - a.vx);
  };
  return { format: group('format'), kind: group('kind'), wd: group('wd'), slot: group('slot') };
}

const FORMAT = { video: 'Video', photo: 'Photo', carousel: 'Carousel', story: 'Story', text: 'Text', other: 'Post' };

function postReasons(p, pat, top) {
  const out = [];
  const find = (list, k) => list.find((x) => x.key === k && x.n >= 3);
  const f = find(pat.format, p.format);
  if (f && top && f.vx >= 1.2) out.push(`${FORMAT[p.format] || 'This format'} posts get ${times(f.vx)} your usual views lately`);
  if (f && !top && f.vx <= 0.85) out.push(`${FORMAT[p.format] || 'This format'} posts get ${times(f.vx)} your usual views lately`);
  const k = find(pat.kind, p.kind);
  if (k && p.kind !== 'other' && ((top && k.vx >= 1.2) || (!top && k.vx <= 0.85))) out.push(`${kindLabel(p.kind)} posts get ${times(k.vx)} your usual views lately`);
  if (top && p.sx >= 1.5 && p.saves >= 10) out.push(`${times(p.sx)} your usual saves: people kept it to come back to`);
  if (top && p.follows >= 5) out.push(`${r0(p.follows)} follows from this one post`);
  if (top && p.ex >= 1.4) out.push(`likes, comments, shares and saves ${times(p.ex)} your usual for its views`);
  if (!top && p.ex <= 0.7) out.push(`fewer likes, comments and saves than usual for its views (${times(p.ex)})`);
  const s = find(pat.slot, p.slot);
  if (s && p.slot && ((top && s.vx >= 1.2) || (!top && s.vx <= 0.8))) out.push(`posted in the ${p.slot}, when your posts get ${times(s.vx)} your usual views`);
  if (!out.length) out.push(top ? `its format and kind are your usual, so the topic or the opening is what to repeat` : `its format and kind usually do fine for you, so try a stronger first line or first second next time`);
  return out.slice(0, 3);
}

// ---------- ads ----------

// Ads (Meta by ad, Google by campaign or ad group) in [from, to]. Day rows count when their day is
// inside; range rows count by the share of their days inside.
function ads(records, from, to) {
  const map = new Map();
  for (const r of records) {
    if (r.t !== 'ad' || !r.from || !r.to) continue;
    const a0 = r.from > from ? r.from : from;
    const b0 = r.to < to ? r.to : to;
    if (a0 > b0) continue;
    const share = (T.daysBetween(a0, b0) + 1) / (T.daysBetween(r.from, r.to) + 1);
    const k = `${r.src}|${r.campaign}|${r.ad || ''}`;
    const a = map.get(k) || { key: k, src: r.src, campaign: r.campaign, ad: r.ad || '', name: r.ad || r.campaign, where: R.SRC[r.src] || r.src, spend: 0, results: 0, clicks: 0, impressions: 0, value: 0, days: new Set(), resultType: r.resultType || '' };
    a.spend += r.spend * share;
    a.results += r.results * share;
    a.clicks += r.clicks * share;
    a.impressions += r.impressions * share;
    a.value += r.value * share;
    for (let d = a0; d <= b0; d = T.addDays(d, 1)) a.days.add(d);
    map.set(k, a);
  }
  return [...map.values()].map((a) => ({ ...a, days: a.days.size, spend: r2(a.spend), results: r2(a.results), clicks: r0(a.clicks), impressions: r0(a.impressions), value: r2(a.value), cpr: a.results >= 0.5 ? a.spend / a.results : null, ctr: a.impressions ? a.clicks / a.impressions : null, cvr: a.clicks ? a.results / a.clicks : null, roas: a.spend && a.value ? a.value / a.spend : null })).filter((a) => a.spend > 0).sort((a, b) => b.spend - a.spend);
}

// The target cost per result: what the member typed, else their kpi scorecard target, else the
// middle of their own ads over the reference stretch. Says which, so the rule shown is honest.
function cprTarget(ctx, typed, ref) {
  const n = T.num(typed);
  if (n && n > 0) return { value: n, from: 'your max cost per customer', own: true };
  const kpi = ctx.brain && ctx.brain.packs && ctx.brain.packs.kpi && ctx.brain.packs.kpi.scorecard;
  const t = kpi && kpi.targets && kpi.targets.cost_per_result;
  if (t && t.value > 0) return { value: t.value, from: 'your max cost per customer, from your scorecard', own: true };
  const spend = ref.reduce((a, x) => a + x.spend, 0);
  const results = ref.reduce((a, x) => a + x.results, 0);
  if (results >= 3) return { value: r2(spend / results), from: 'your own average cost per result over these weeks (type your max cost per customer to judge against that instead)', own: false };
  return null;
}

const usd = (n) => M.usd(n);

// ---------- products ----------

function products(records, span, weeks = 4) {
  const now = R.detail(records, span.from, span.to).products;
  const base = R.detail(records, span.baseFrom, span.baseTo).products;
  const days = T.daysBetween(span.from, span.to) + 1;
  const baseDays = T.daysBetween(span.baseFrom, span.baseTo) + 1;
  const names = new Set([...now.map((p) => p.name), ...base.map((p) => p.name)]);
  return [...names].map((name) => {
    const a = now.find((p) => p.name === name) || { units: 0, sales: 0 };
    const b = base.find((p) => p.name === name) || { units: 0, sales: 0 };
    const usual = (b.units / baseDays) * days;
    return { name, units: a.units, sales: r2(a.sales), usual: usual >= 10 ? Math.round(usual) : Math.round(usual * 10) / 10, ux: usual ? a.units / usual : a.units ? null : 1 };
  }).sort((x, y) => y.sales - x.sales);
}

// Words of a product name that would show up in a caption or ad name ("Cedar and Smoke Candle 8oz" -> cedar, smoke).
function nameWords(name) {
  const stop = new Set(['and', 'the', 'for', 'with', 'candle', 'candles', 'set', 'kit', 'oz', '8oz', '12oz', 'small', 'large', 'medium']);
  return String(name).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w) && !/^\d/.test(w));
}
const mentions = (text, name) => {
  const t = String(text || '').toLowerCase();
  const ws = nameWords(name);
  return ws.length > 0 && ws.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t));
};

function productReasons(p, postsNow, adsNow, top) {
  const out = [];
  const post = postsNow.filter((x) => mentions(x.caption, p.name)).sort((a, b) => b.vx - a.vx)[0];
  if (post && top && post.vx >= 1.3) out.push(`your ${R.SRC[post.src] || post.src} post on ${R.shortDay(post.date)} about it got ${times(post.vx)} your usual views`);
  const ad = adsNow.filter((x) => mentions(`${x.campaign} ${x.ad}`, p.name))[0];
  if (ad) out.push(`your ad "${ad.name}" names it (${usd(r0(ad.spend))} spent)`);
  if (!top && !post) out.push('no post about it in these days');
  if (!out.length) out.push(top ? 'selling above its usual with no post or ad naming it, so a post about it is worth a try' : 'below its usual even with a post about it, so check its photos, price and stock');
  return out.slice(0, 3);
}

module.exports = { median, times, pct, weekday, WEEKDAY, slotOf, weekSpan, monthSpan, kindOf, kindLabel, engRate, posts, patterns, postReasons, ads, cprTarget, products, productReasons, mentions, nameWords, FORMAT, r0, r2, usd };
