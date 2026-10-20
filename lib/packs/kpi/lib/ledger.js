// Records -> one row of totals per day, and totals for any stretch of days. Ads with only a date
// range (no "Day" breakdown) are spread evenly over their days and kept apart, so a daily report never
// shows a spread number as if it happened that day.

const T = require('./table');

const BASE = ['sales', 'orders', 'fees', 'refunds', 'refundCount', 'disputes', 'disputeAmt', 'payouts', 'costs', 'adSpend', 'adImpr', 'adClicks', 'adResults', 'adValue', 'posts', 'views', 'likes', 'comments', 'shares', 'saves', 'follows', 'units'];
const AD = ['adSpend', 'adImpr', 'adClicks', 'adResults', 'adValue'];

function blank() {
  const d = {};
  for (const k of BASE) d[k] = 0;
  d.spread = { adSpend: 0, adImpr: 0, adClicks: 0, adResults: 0, adValue: 0 };
  d.custom = {};
  return d;
}

const r2 = (n) => Math.round(n * 100) / 100;

// { days: Map(date -> totals), from, to, cover: { money, ads, posts, sheet: {from, to} }, names: {key: name}, levels, costs }
function build(records) {
  const days = new Map();
  const cover = {};
  const names = {};
  const levelKeys = new Set();
  const costKeys = new Set();
  const day = (date) => {
    if (!days.has(date)) days.set(date, blank());
    return days.get(date);
  };
  const touch = (group, date) => {
    const c = cover[group] || (cover[group] = { from: date, to: date });
    if (date < c.from) c.from = date;
    if (date > c.to) c.to = date;
  };
  for (const r of records) {
    if (r.t === 'ad') {
      if (!r.from || !r.to) continue;
      const n = Math.max(1, T.daysBetween(r.from, r.to) + 1);
      const exact = n === 1;
      for (let i = 0; i < n && i < 400; i++) {
        const d = day(T.addDays(r.from, i));
        const tgt = exact ? d : d.spread;
        tgt.adSpend += r.spend / n;
        tgt.adImpr += r.impressions / n;
        tgt.adClicks += r.clicks / n;
        tgt.adResults += r.results / n;
        tgt.adValue += r.value / n;
        touch(exact ? 'ads' : 'adsSpread', T.addDays(r.from, i));
      }
      continue;
    }
    if (!r.date) continue;
    const d = day(r.date);
    if (r.t === 'sale') {
      d.sales += r.amount;
      d.orders += 1;
      d.fees += r.fee || 0;
      touch('money', r.date);
    } else if (r.t === 'refund') {
      d.refunds += r.amount;
      d.refundCount += 1;
      touch('money', r.date);
    } else if (r.t === 'dispute') {
      if (r.amount > 0) d.disputes += 1;
      d.disputeAmt += r.amount;
      touch('money', r.date);
    } else if (r.t === 'fee') {
      d.fees += r.amount;
      touch('money', r.date);
    } else if (r.t === 'payout') d.payouts += r.amount;
    else if (r.t === 'cost') {
      d.costs += r.amount;
      touch('money', r.date);
    } else if (r.t === 'item') d.units += r.qty;
    else if (r.t === 'post') {
      d.posts += 1;
      d.views += r.views;
      d.likes += r.likes;
      d.comments += r.comments;
      d.shares += r.shares;
      d.saves += r.saves;
      d.follows += r.follows;
      touch('posts', r.date);
    } else if (r.t === 'metric') {
      names[r.key] = r.name;
      if (r.level) {
        levelKeys.add(r.key);
        d.custom[r.key] = r.value;
      } else d.custom[r.key] = (d.custom[r.key] || 0) + r.value;
      if (r.cost) {
        costKeys.add(r.key);
        d.costs += r.value;
      }
      touch('sheet', r.date);
      touch(`m:${r.key}`, r.date);
    }
  }
  const all = [...days.keys()].filter((k) => Object.entries(cover).some(([g, c]) => g !== 'adsSpread' && k >= c.from && k <= c.to)).sort();
  return { days, from: all[0] || '', to: all[all.length - 1] || '', cover, names, levels: [...levelKeys], costs: [...costKeys] };
}

// Totals for [from, to] (inclusive). spread: true adds ads known only by date range.
// Running totals in the sheet (levels) take the last value in the stretch.
function sum(L, from, to, { spread = false } = {}) {
  const s = blank();
  s.custom = {};
  s.days = 0;
  if (!from || !to || from > to) return s;
  for (let d = from; d <= to; d = T.addDays(d, 1)) {
    s.days += 1;
    const x = L.days.get(d);
    if (!x) continue;
    for (const k of BASE) s[k] += x[k];
    if (spread) for (const k of AD) s[k] += x.spread[k];
    for (const [k, v] of Object.entries(x.custom)) s.custom[k] = L.levels.includes(k) ? v : (s.custom[k] || 0) + v;
  }
  for (const k of BASE) s[k] = r2(s[k]);
  return s;
}

// How many of the days in [from, to] the group's data covers (so an average isn't dragged down by
// days before an export starts).
function covered(L, group, from, to) {
  const c = L.cover[group];
  if (!c) return 0;
  const a = from > c.from ? from : c.from;
  const b = to < c.to ? to : c.to;
  return a > b ? 0 : T.daysBetween(a, b) + 1;
}

// Monday on or before a date.
function weekStart(date) {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return T.addDays(date, -((wd + 6) % 7));
}

// The last full Monday to Sunday week ending on or before `last`.
function lastFullWeek(last) {
  const start = weekStart(last);
  const sunday = T.addDays(start, 6);
  return sunday === last ? { from: start, to: last } : { from: T.addDays(start, -7), to: T.addDays(start, -1) };
}

module.exports = { build, sum, covered, weekStart, lastFullWeek, BASE, blank };
