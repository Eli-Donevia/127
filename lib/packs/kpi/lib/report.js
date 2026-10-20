// What the reports share: loading the member's files into a ledger, their scorecard, what moved and
// why (in plain words, from their own numbers), and one next step.

const T = require('./table');
const R = require('./readers');
const L = require('./ledger');
const M = require('./metrics');
const CARDS = require('../data/scorecards.json');
const ACTIONS = require('../data/actions.json');

// ---------- data ----------

function todayIn(ctx) {
  const tz = (ctx.member && ctx.member.timezone) || 'America/Chicago';
  const ms = typeof ctx.now === 'function' ? ctx.now() : Date.now();
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

async function dataset(ctx, files) {
  const today = todayIn(ctx);
  const d = await R.load(ctx, files, { today });
  const led = L.build(d.records);
  if (!led.to) throw new Error("We found no dated rows in those files. Check that each export has its date column, then add it again.");
  return { ...d, led, today };
}

// Yesterday when the data has it, else the newest day in the data (with a note to export again).
function reportDay(led, today) {
  const y = T.addDays(today, -1);
  if (led.to >= y) return { day: y, stale: 0 };
  return { day: led.to, stale: T.daysBetween(led.to, y) };
}

// ---------- scorecard ----------

function typeOf(id) {
  return CARDS.types.find((t) => t.id === id) || null;
}

// A business type from the member's words (brain niche, what they sell).
function guessType(brain) {
  const b = (brain && brain.business) || {};
  const words = `${b.niche || ''} ${b.what || ''} ${b.offer || ''}`.toLowerCase();
  for (const t of CARDS.types) if (t.words.some((w) => new RegExp(`\\b${w}\\b`).test(words))) return t.id;
  return 'other';
}

function typeByLabel(label, brain) {
  const t = CARDS.types.find((x) => x.label === label || x.id === label);
  return t ? t.id : guessType(brain);
}

// The member's saved scorecard (kpi.set_scorecard), else their type's picks, kept to what the data shows.
function scorecard(ctx, led, { type, targets } = {}) {
  const saved = (ctx.brain && ctx.brain.packs && ctx.brain.packs.kpi && ctx.brain.packs.kpi.scorecard) || null;
  const avail = M.available(led);
  const okIds = new Set(avail.map((m) => m.id));
  const tid = type && type !== 'Not sure' ? typeByLabel(type, ctx.brain) : saved && saved.type ? saved.type : guessType(ctx.brain);
  let ids = saved && Array.isArray(saved.metrics) && saved.metrics.length ? saved.metrics : (typeOf(tid) || typeOf('other')).metrics;
  const missing = ids.filter((id) => !okIds.has(id));
  ids = ids.filter((id) => okIds.has(id));
  if (!ids.length) ids = avail.slice(0, 6).map((m) => m.id);
  const fromInput = targets ? M.parseTargets(targets, avail) : {};
  const t = { ...((saved && saved.targets) || {}), ...fromInput };
  return { type: tid, typeLabel: (typeOf(tid) || {}).label || 'Something else', ids, metrics: ids.map((id) => M.get(id, led)), targets: t, saved: !!saved, missing, avail };
}

// ---------- detail for reasons ----------

function detail(records, from, to) {
  const inside = (r) => r.date && r.date >= from && r.date <= to;
  const products = new Map();
  for (const r of records) if (r.t === 'item' && inside(r)) {
    const p = products.get(r.name) || { name: r.name, units: 0, sales: 0 };
    p.units += r.qty;
    p.sales += r.amount;
    products.set(r.name, p);
  }
  const posts = records.filter((r) => r.t === 'post' && inside(r)).sort((a, b) => b.views - a.views);
  const ads = new Map();
  for (const r of records) if (r.t === 'ad' && r.from && r.from === r.to && r.from >= from && r.from <= to) {
    const k = `${r.src}|${r.campaign}|${r.ad}`;
    const a = ads.get(k) || { src: r.src, campaign: r.campaign, ad: r.ad, name: r.ad || r.campaign, spend: 0, results: 0, clicks: 0, impressions: 0, value: 0 };
    a.spend += r.spend;
    a.results += r.results;
    a.clicks += r.clicks;
    a.impressions += r.impressions;
    a.value += r.value;
    ads.set(k, a);
  }
  const bySrc = {};
  for (const r of records) if (r.t === 'sale' && inside(r)) bySrc[r.src] = (bySrc[r.src] || 0) + r.amount;
  return { products: [...products.values()].sort((a, b) => b.sales - a.sales), posts, ads: [...ads.values()].sort((a, b) => b.spend - a.spend), bySrc, refunds: records.filter((r) => r.t === 'refund' && inside(r)), disputes: records.filter((r) => r.t === 'dispute' && inside(r) && r.amount > 0) };
}

const SRC = { shopify: 'Shopify', square: 'Square', stripe: 'Stripe', paypal: 'PayPal', meta: 'Meta', google: 'Google', instagram: 'Instagram', tiktok: 'TikTok', posts: 'your posts', sheet: 'your sheet' };
const quote = (s, n = 60) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t ? `"${t.length > n ? `${t.slice(0, n - 1).trimEnd()}...` : t}"` : 'your top post';
};

// ---------- compare ----------

// Every metric on the scorecard: the day (or stretch) against a base stretch, as per-day or totals.
function compare(led, metrics, { from, to, baseFrom, baseTo, per = 'day', scale = 1, targets = {}, targetPer = 'day' }) {
  return metrics.map((m) => {
    const now = M.value(m, led, from, to, { per: per === 'avg' ? 'day' : 'total' });
    const baseDay = M.value(m, led, baseFrom, baseTo, { per: m.kind === 'sum' ? 'day' : 'total' });
    const base = baseDay == null ? null : m.kind === 'sum' ? baseDay * scale : baseDay;
    const c = M.change(now, base);
    const t = targets[m.id] ? M.scaleTarget(m, targets[m.id], targetPer) : null;
    let hit = null;
    if (t != null && now != null) hit = m.better === 'down' ? now <= t : now >= t;
    return { id: m.id, label: m.label, unit: m.unit, now, base, change: c, verdict: M.verdict(m, c), nowText: M.fmt(m, now), baseText: M.fmt(m, base, { avg: true }), changeText: c == null ? '' : `${c >= 0 ? 'up' : 'down'} ${M.pctText(c)}`, target: t, targetText: t != null ? M.fmt(m, t) : '', hit };
  });
}

// Which rows moved enough to talk about, biggest first.
function moved(rows, metrics) {
  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  // Earlier scorecard numbers count more; a change over 50% counts as 50%.
  // Post numbers jump around day to day (a post's views land on the day it went up), so they count less.
  const weight = (r) => Math.min(0.5, Math.abs(r.change)) * (rows.indexOf(r) < 2 ? 1.6 : rows.indexOf(r) < 4 ? 1.25 : 1) * (byId[r.id].group === 'posts' ? 0.6 : 1);
  const sales = rows.find((r) => r.id === 'sales');
  return rows
    .filter((r) => {
      // No refunds or chargebacks on a day is the normal case, not news.
      if (byId[r.id].better === 'down' && r.now === 0) return false;
      // Sales already says how the orders moved.
      if (r.id === 'orders' && sales && sales.change != null && Math.abs(sales.change) >= 0.2 && Math.sign(sales.change) === Math.sign(r.change)) return false;
      if (r.change == null || r.now == null || r.base == null) return false;
      const m = byId[r.id];
      const gap = Math.abs(r.now - r.base);
      if (m.unit === 'count') return Math.abs(r.change) >= 0.25 && gap >= (m.id === 'chargebacks' ? 1 : 2);
      if (m.unit === 'money') return Math.abs(r.change) >= 0.2 && gap >= 5;
      return Math.abs(r.change) >= 0.2;
    })
    .sort((a, b) => weight(b) - weight(a));
}

// A plain reason for a move, from the same numbers.
function reason(row, m, led, records, span) {
  const { from, to, baseFrom, baseTo, per = 'day' } = span;
  const now = detail(records, from, to);
  const base = detail(records, baseFrom, baseTo);
  const baseDays = Math.max(1, T.daysBetween(baseFrom, baseTo) + 1);
  const unit = per === 'week' ? 7 : 1;
  const avg = (n) => (n * unit) / baseDays;
  const fmtN = (n) => (Math.abs(n) < 20 && Math.round(n) !== n ? n.toFixed(1) : Math.round(n).toLocaleString('en-US'));
  const sumOf = (k) => L.sum(led, from, to, { spread: per !== 'day' })[k];
  const baseOf = (k) => avg(L.sum(led, baseFrom, baseTo, { spread: per !== 'day' })[k]);
  const lead = `${m.label}: ${row.nowText}, ${row.changeText} on your ${per === 'day' ? '7-day average' : '4-week average'} of ${row.baseText}.`;
  const bits = [];
  if (['sales', 'orders', 'cash_in', 'aov'].includes(m.id)) {
    const o = sumOf('orders');
    const ob = baseOf('orders');
    const s = sumOf('sales');
    const aov = o ? s / o : 0;
    const sb = baseOf('sales');
    const aovb = ob ? sb / ob : 0;
    if (m.id !== 'orders' && ob && Math.abs(o - ob) / ob >= 0.15) bits.push(`${fmtN(o)} orders against ${fmtN(ob)} usually`);
    if (aovb && Math.abs(aov - aovb) / aovb >= 0.12) bits.push(`an average order of ${M.usd(Math.round(aov))} against ${M.usd(Math.round(aovb))}`);
    else if (m.id === 'orders' && aovb) bits.push(`at about the same average order (${M.usd(Math.round(aov))})`);
    const top = now.products[0];
    if (top) {
      const bp = base.products.find((p) => p.name === top.name);
      const usual = bp ? avg(bp.units) : 0;
      if (top.units >= 2 && top.units >= usual * 1.5) bits.push(`${top.name} sold ${fmtN(top.units)} against ${fmtN(usual)} usually`);
    }
    const srcs = Object.entries(now.bySrc).sort((a, b) => b[1] - a[1]);
    const srcBase = (k) => avg(base.bySrc[k] || 0);
    const jump = srcs.find(([k, v]) => v - srcBase(k) >= Math.max(30, srcBase(k) * 0.5));
    if (jump && row.change > 0) bits.push(`${SRC[jump[0]] || jump[0]} took ${M.usd(Math.round(jump[1]))} against ${M.usd(Math.round(srcBase(jump[0])))} usually`);
    const hit = postBefore(records, from, base);
    if (hit && row.change > 0) bits.push(`your ${SRC[hit.src] || 'post'} ${quote(hit.caption, 50)} from ${shortDay(hit.date)} had ${Math.round(hit.views).toLocaleString('en-US')} views`);
  } else if (['refunds', 'refund_rate'].includes(m.id)) {
    bits.push(`${now.refunds.length} refund${now.refunds.length === 1 ? '' : 's'}`);
    const big = now.refunds.sort((a, b) => b.amount - a.amount)[0];
    if (big) bits.push(`the biggest ${M.usd(big.amount)} on ${SRC[big.src] || big.src}${big.label ? ` (${big.label})` : ''}`);
  } else if (m.id === 'chargebacks') {
    for (const d of now.disputes.slice(0, 2)) bits.push(`${M.usd(d.amount)} on ${SRC[d.src] || d.src}${d.reason ? `, reason: ${d.reason}` : ''}${d.due ? `, answer due ${shortDay(d.due)}` : ''}`);
  } else if (['ad_results', 'cost_per_result', 'ad_spend', 'click_rate', 'ad_return'].includes(m.id)) {
    bits.push(`${M.usd(Math.round(sumOf('adSpend')))} spent for ${fmtN(sumOf('adResults'))} results, against ${M.usd(Math.round(baseOf('adSpend')))} for ${fmtN(baseOf('adResults'))} usually`);
    const best = now.ads.filter((a) => a.results > 0).sort((a, b) => a.spend / a.results - b.spend / b.results)[0];
    const worst = now.ads.filter((a) => a.spend > 0).sort((a, b) => (b.results ? b.spend / b.results : b.spend * 99) - (a.results ? a.spend / a.results : a.spend * 99))[0];
    if (row.verdict === 'good' && best) bits.push(`${best.name} did best at ${M.usd(best.spend / best.results)} a result`);
    if (row.verdict === 'bad' && worst) bits.push(`${worst.name} spent ${M.usd(Math.round(worst.spend))} for ${fmtN(worst.results)} result${worst.results === 1 ? '' : 's'}`);
  } else if (['post_views', 'posts', 'engagement', 'follows'].includes(m.id)) {
    bits.push(`${fmtN(sumOf('posts'))} post${sumOf('posts') === 1 ? '' : 's'} against ${fmtN(baseOf('posts'))} usually`);
    const top = now.posts[0];
    if (top && top.views) bits.push(`${quote(top.caption, 50)} on ${SRC[top.src] || top.src} had ${Math.round(top.views).toLocaleString('en-US')} views`);
  }
  return bits.length ? `${lead} ${cap(bits.join('; '))}.` : lead;
}

// The biggest recent post just before a stretch (a post's views land on the day it went up, while
// the sales it brings can come the next day).
function postBefore(records, from, base) {
  const usual = base.posts.length ? base.posts.map((p) => p.views).sort((a, b) => a - b)[Math.floor(base.posts.length / 2)] : 0;
  const near = records.filter((r) => r.t === 'post' && r.date && r.date >= T.addDays(from, -2) && r.date <= from).sort((a, b) => b.views - a.views)[0];
  return near && usual && near.views >= usual * 3 ? near : null;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function shortDay(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}
function longDay(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
}

// ---------- the next step ----------

function nextStep(rows, metrics, records, span) {
  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  const recent = detail(records, T.addDays(span.to, -13), span.to);
  const fill = (s, row) =>
    String(s)
      .replace('{product}', recent.products[0] ? recent.products[0].name : 'your best seller')
      .replace('{post}', recent.posts[0] ? quote(recent.posts[0].caption, 50) : 'your best post')
      .replace('{ad}', pickAd(recent.ads, row))
      .replace('{name}', row ? row.label : 'that number')
      .replace('{why}', row && row.why ? row.why : 'what you did then worked.');
  // 1. A chargeback that still needs an answer.
  const open = records.filter((r) => r.t === 'dispute' && r.amount > 0 && /needs_response|warning_needs_response|under_review|needs response/.test(r.status || '')).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))[0];
  if (open) return { text: `Answer the ${M.usd(open.amount)} chargeback on ${SRC[open.src] || open.src} ${open.due ? `before ${longDay(open.due)}` : 'this week'}: send the order details and any delivery or attendance proof from your payment account.`, why: `It is still open${open.reason ? ` (reason: ${open.reason})` : ''}. An unanswered chargeback is lost by default.`, metric: 'chargebacks' };
  // 2. A scorecard number that missed its target and moved the wrong way.
  const bad = rows.filter((r) => r.verdict === 'bad' && byId[r.id]).sort((a, b) => (b.hit === false) - (a.hit === false) || Math.abs(b.change) - Math.abs(a.change))[0];
  if (bad) {
    const m = byId[bad.id];
    const key = m.custom ? 'custom' : bad.id;
    const pool = m.better === 'down' ? ACTIONS.up_bad : ACTIONS.down;
    const s = pool[key] || pool.custom;
    if (s) return { text: fill(s, bad), why: `${m.label} ${bad.changeText} (${bad.nowText} against ${bad.baseText}).${bad.hit === false ? ` Your target is ${bad.targetText}.` : ''}`, metric: bad.id };
  }
  // 3. Something went well: do it again.
  const good = rows.filter((r) => r.verdict === 'good').sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  if (good) {
    const s = ACTIONS.up[good.id] || ACTIONS.up.sales;
    return { text: fill(s, good), why: `${good.label} ${good.changeText} (${good.nowText} against ${good.baseText}).`, metric: good.id };
  }
  // 4. A target still out of reach.
  const behind = rows.find((r) => r.hit === false);
  if (behind) {
    const m = byId[behind.id];
    const pool = m.better === 'down' ? ACTIONS.up_bad : ACTIONS.down;
    const s = pool[m.custom ? 'custom' : behind.id] || pool.custom;
    if (s) return { text: fill(s, behind), why: `${m.label} is ${behind.nowText}; your target is ${behind.targetText}.`, metric: behind.id };
  }
  return { text: ACTIONS.up.default, why: 'Every number on your scorecard is close to its usual level.', metric: '' };
}

function pickAd(ads, row) {
  if (!ads.length) return 'your ad that spent the most';
  const cpr = (a) => (a.results ? a.spend / a.results : Infinity);
  if (row && row.verdict === 'good') return [...ads].filter((a) => a.results).sort((a, b) => cpr(a) - cpr(b))[0]?.name || ads[0].name;
  return [...ads].sort((a, b) => cpr(b) - cpr(a) || b.spend - a.spend)[0].name;
}

module.exports = { dataset, reportDay, scorecard, guessType, typeOf, typeByLabel, detail, compare, moved, reason, nextStep, shortDay, longDay, quote, todayIn, SRC, CARDS };
