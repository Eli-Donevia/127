// Every export the numbers packs read, told apart by its header row, turned into one list of plain
// records. Shared by kpi and cmo (cmo requires this file by path: ../../kpi/lib/readers).
//
// Records (amounts in the export's currency, dates in the member's time zone where the export says UTC):
//   sale    { t, src, date, hour, amount, fee, id, label }          what a customer paid
//   refund  { t, src, date, amount, id, label }                      money given back (positive)
//   dispute { t, src, date, amount, status, reason, due, id }        a chargeback
//   fee     { t, src, date, amount }                                 a fee not tied to one sale
//   payout  { t, src, date, amount }                                 money moved to the bank
//   cost    { t, src, date, amount, label }                          money paid out (PayPal payments sent, sheet costs)
//   item    { t, src, date, order, name, qty, amount, refunded }     a product line (Shopify)
//   ad      { t, src, from, to, campaign, ad, spend, impressions, clicks, results, value, resultType }
//   post    { t, src, date, hour, caption, link, format, views, reach, likes, comments, shares, saves, follows }
//   metric  { t, src, date, name, key, value, level, cost }          a row of the member's own sheet
//
// Privacy: customer names, emails, phone numbers and addresses are never read. Only the columns
// named below are touched; the rest of each row is dropped here.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = require('./table');

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 60000;
const SAMPLE_DIR = path.join(__dirname, '..', 'sample');
// The sample business's last day of data. Sample runs move every date so this day is yesterday.
const SAMPLE_LAST_DAY = '2026-10-18';
const SAMPLE_FILES = ['shopify-orders.csv', 'square-transactions.csv', 'stripe-payments.csv', 'stripe-balance.csv', 'paypal-activity.csv', 'meta-ads.csv', 'google-ads.csv', 'instagram-posts.csv', 'tiktok-posts.csv', 'my-numbers.csv'];

// ---------- columns ----------

// Index of the first header equal to one of the names (normalized), then one that starts with it.
function finder(head) {
  const norm = head.map(T.normHead);
  return (...names) => {
    for (const n of names) {
      const i = norm.indexOf(n);
      if (i >= 0) return i;
    }
    for (const n of names) {
      const i = norm.findIndex((h) => h.startsWith(`${n} `));
      if (i >= 0) return i;
    }
    return -1;
  };
}
const has = (head, ...names) => {
  const f = finder(head);
  return names.every((n) => (Array.isArray(n) ? n.some((x) => f(x) >= 0) : f(n) >= 0));
};
const cell = (r, i) => (i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '');
const amt = (r, i) => (i >= 0 ? T.num(r[i]) : null);
const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}...` : t;
};
const isUtc = (h) => /utc/i.test(String(h || ''));

// Dates across a column: day or month first, and UTC moved to the member's zone.
function dateReader(rows, i, head, tz) {
  const order = T.dateOrder(rows.slice(0, 200).map((r) => r[i]));
  const utc = i >= 0 && isUtc(head[i]);
  return (r) => {
    if (i < 0) return null;
    const p = T.parseDate(r[i], order);
    return utc ? T.fromUtc(p, tz) : p;
  };
}

// ---------- the formats ----------

const SOURCES = [
  {
    kind: 'stripe_payments',
    label: 'Stripe payments',
    group: 'money',
    detect: (h) => has(h, 'id', ['created date', 'created'], 'amount') && has(h, ['amount refunded', 'captured', 'converted amount', 'seller message', 'status']) && !has(h, 'reporting category') && !has(h, 'type', 'net'),
    read(rows, head, tz) {
      const f = finder(head);
      const c = { id: f('id'), date: f('created date', 'created'), amount: f('amount'), conv: f('converted amount'), refunded: f('amount refunded'), convRef: f('converted amount refunded'), fee: f('fee'), status: f('status'), captured: f('captured'), desc: f('description'), refDate: f('refunded date'), disAmt: f('disputed amount'), disStatus: f('dispute status'), disReason: f('dispute reason'), disDate: f('dispute date'), disDue: f('dispute evidence due') };
      const when = dateReader(rows, c.date, head, tz);
      const refWhen = dateReader(rows, c.refDate, head, tz);
      const disWhen = dateReader(rows, c.disDate, head, tz);
      const dueWhen = dateReader(rows, c.disDue, head, tz);
      const out = [];
      for (const r of rows) {
        const d = when(r);
        if (!d) continue;
        const status = cell(r, c.status).toLowerCase();
        if (/fail|declin|cancel|incomplete|requires|blocked/.test(status)) continue;
        if (c.captured >= 0 && /^false$/i.test(cell(r, c.captured))) continue;
        const amount = amt(r, c.conv) != null ? amt(r, c.conv) : amt(r, c.amount);
        if (!amount) continue;
        const id = cell(r, c.id);
        const label = clip(cell(r, c.desc), 60);
        out.push({ t: 'sale', src: 'stripe', date: d.date, hour: d.hour, amount, fee: Math.abs(amt(r, c.fee) || 0), id, label });
        const refunded = amt(r, c.convRef) != null ? amt(r, c.convRef) : amt(r, c.refunded);
        if (refunded) {
          const rd = refWhen(r) || d;
          out.push({ t: 'refund', src: 'stripe', date: rd.date, amount: Math.abs(refunded), id, label });
        }
        const dis = amt(r, c.disAmt);
        if (dis) {
          const dd = disWhen(r) || d;
          const due = dueWhen(r);
          out.push({ t: 'dispute', src: 'stripe', date: dd.date, amount: Math.abs(dis), status: cell(r, c.disStatus).toLowerCase(), reason: cell(r, c.disReason).replace(/_/g, ' ').toLowerCase(), due: due ? due.date : '', id });
        }
      }
      return out;
    },
  },
  {
    kind: 'stripe_balance',
    label: 'Stripe balance activity',
    group: 'money',
    // The Balance report's itemized CSV (reporting_category, gross, fee, net) and the older balance
    // history export (Type, Amount, Fee, Net).
    detect: (h) => (has(h, 'reporting category', 'gross', 'net') || (has(h, 'type', 'amount', 'fee', 'net') && has(h, ['available on', 'source', 'created']))) && !has(h, 'timezone') && !has(h, 'time zone'),
    read(rows, head, tz) {
      const f = finder(head);
      const c = { cat: f('reporting category'), type: f('type'), gross: f('gross', 'amount'), fee: f('fee'), net: f('net'), date: f('created utc', 'created'), id: f('balance transaction id', 'id'), desc: f('description'), reason: f('dispute reason') };
      const when = dateReader(rows, c.date, head, tz);
      const out = [];
      for (const r of rows) {
        const d = when(r);
        if (!d) continue;
        const raw = cell(r, c.cat >= 0 ? c.cat : c.type).toLowerCase();
        const cat = { payment: 'charge', payment_refund: 'refund', stripe_fee: 'fee', adjustment: /dispute/i.test(cell(r, c.desc)) ? 'dispute' : 'other_adjustment' }[raw] || raw;
        const gross = amt(r, c.gross) || 0;
        const fee = Math.abs(amt(r, c.fee) || 0);
        const id = cell(r, c.id);
        const label = clip(cell(r, c.desc), 60);
        if (cat === 'charge' && gross) out.push({ t: 'sale', src: 'stripe', date: d.date, hour: d.hour, amount: Math.abs(gross), fee, id, label });
        else if (cat === 'refund' && gross) {
          out.push({ t: 'refund', src: 'stripe', date: d.date, amount: Math.abs(gross), id, label });
          if (fee) out.push({ t: 'fee', src: 'stripe', date: d.date, amount: fee });
        } else if (cat === 'dispute' && gross) {
          out.push({ t: 'dispute', src: 'stripe', date: d.date, amount: Math.abs(gross), status: '', reason: cell(r, c.reason).replace(/_/g, ' ').toLowerCase(), due: '', id });
          if (fee) out.push({ t: 'fee', src: 'stripe', date: d.date, amount: fee });
        } else if (cat === 'dispute_reversal' && gross) out.push({ t: 'dispute', src: 'stripe', date: d.date, amount: -Math.abs(gross), status: 'won', reason: '', due: '', id });
        else if (cat === 'fee') {
          const net = amt(r, c.net);
          if (net) out.push({ t: 'fee', src: 'stripe', date: d.date, amount: -net });
        } else if (cat === 'payout' && gross) out.push({ t: 'payout', src: 'stripe', date: d.date, amount: Math.abs(gross) });
      }
      return out;
    },
  },
  {
    kind: 'shopify_orders',
    label: 'Shopify orders',
    group: 'money',
    detect: (h) => has(h, 'name', 'financial status', 'total') && has(h, ['lineitem name', 'lineitem quantity', 'created at']),
    read(rows, head, tz) {
      const f = finder(head);
      const c = { name: f('name'), status: f('financial status'), paid: f('paid at'), created: f('created at'), total: f('total'), refunded: f('refunded amount'), qty: f('lineitem quantity'), item: f('lineitem name'), price: f('lineitem price'), disc: f('lineitem discount'), cancelled: f('cancelled at', 'canceled at') };
      const when = dateReader(rows, c.created >= 0 ? c.created : c.paid, head, tz);
      // One order spans several rows (one per product); its status and totals sit on one of them.
      const orders = new Map();
      for (const r of rows) {
        const order = cell(r, c.name);
        if (!order) continue;
        if (!orders.has(order)) orders.set(order, []);
        orders.get(order).push(r);
      }
      const out = [];
      for (const [order, lines] of orders) {
        const top = lines.find((r) => cell(r, c.status)) || lines[0];
        const d = when(top) || lines.map(when).find(Boolean);
        if (!d) continue;
        if (!/paid|refund/.test(cell(top, c.status).toLowerCase())) continue;
        const total = amt(top, c.total);
        if (total) out.push({ t: 'sale', src: 'shopify', date: d.date, hour: d.hour, amount: total, fee: 0, id: order, label: `Order ${order}` });
        const refunded = amt(top, c.refunded);
        if (refunded) out.push({ t: 'refund', src: 'shopify', date: d.date, amount: Math.abs(refunded), id: order, label: `Order ${order}` });
        for (const r of lines) {
          const name = clip(cell(r, c.item), 80);
          const qty = amt(r, c.qty) || 0;
          if (name && qty) out.push({ t: 'item', src: 'shopify', date: d.date, order, name, qty, amount: Math.round((qty * (amt(r, c.price) || 0) - Math.abs(amt(r, c.disc) || 0)) * 100) / 100, refunded: !!refunded });
        }
      }
      return out;
    },
  },
  {
    kind: 'square',
    label: 'Square transactions',
    group: 'money',
    detect: (h) => has(h, 'gross sales', 'total collected') || has(h, 'gross sales', 'net sales', 'transaction id'),
    read(rows, head, tz) {
      const f = finder(head);
      const c = { date: f('date'), time: f('time'), event: f('event type'), total: f('total collected'), gross: f('gross sales'), partial: f('partial refunds'), fees: f('fees'), id: f('transaction id', 'payment id'), desc: f('description') };
      const order = T.dateOrder(rows.slice(0, 200).map((r) => r[c.date]));
      const out = [];
      for (const r of rows) {
        const d = T.parseDate(`${cell(r, c.date)} ${cell(r, c.time)}`.trim(), order) || T.parseDate(cell(r, c.date), order);
        if (!d) continue;
        const total = amt(r, c.total) != null ? amt(r, c.total) : amt(r, c.gross);
        const event = cell(r, c.event).toLowerCase();
        const id = cell(r, c.id);
        const label = clip(cell(r, c.desc), 60);
        const fee = Math.abs(amt(r, c.fees) || 0);
        if (/refund/.test(event) || (total != null && total < 0)) {
          if (total) out.push({ t: 'refund', src: 'square', date: d.date, amount: Math.abs(total), id, label });
          if (fee && (amt(r, c.fees) || 0) > 0) out.push({ t: 'fee', src: 'square', date: d.date, amount: -fee });
          continue;
        }
        if (!total) continue;
        out.push({ t: 'sale', src: 'square', date: d.date, hour: d.hour, amount: total, fee, id, label });
        const partial = amt(r, c.partial);
        if (partial) out.push({ t: 'refund', src: 'square', date: d.date, amount: Math.abs(partial), id, label });
      }
      return out;
    },
  },
  {
    kind: 'paypal',
    label: 'PayPal activity',
    group: 'money',
    detect: (h) => has(h, ['gross', 'amount'], 'fee', 'net', 'type', 'status') && has(h, ['timezone', 'time zone', 'transaction id']) && !has(h, 'reporting category'),
    read(rows, head) {
      const f = finder(head);
      const c = { date: f('date'), time: f('time'), type: f('type'), status: f('status'), gross: f('gross', 'amount'), fee: f('fee'), id: f('transaction id'), item: f('item title', 'subject') };
      const order = T.dateOrder(rows.slice(0, 200).map((r) => r[c.date]));
      const out = [];
      for (const r of rows) {
        const d = T.parseDate(`${cell(r, c.date)} ${cell(r, c.time)}`.trim(), order) || T.parseDate(cell(r, c.date), order);
        if (!d) continue;
        const status = cell(r, c.status).toLowerCase();
        if (status && !/complet|clear|paid|success/.test(status)) continue;
        const type = cell(r, c.type).toLowerCase();
        const gross = amt(r, c.gross);
        if (!gross || /hold|authori[sz]ation|currency conversion|transfer from|bank deposit|reserve|void/.test(type)) continue;
        const fee = Math.abs(amt(r, c.fee) || 0);
        const id = cell(r, c.id);
        const label = clip(cell(r, c.item), 60);
        if (/chargeback|dispute/.test(type)) out.push({ t: 'dispute', src: 'paypal', date: d.date, amount: gross < 0 ? Math.abs(gross) : -Math.abs(gross), status: gross < 0 ? '' : 'won', reason: '', due: '', id });
        else if (/refund|reversal/.test(type)) {
          if (gross < 0) out.push({ t: 'refund', src: 'paypal', date: d.date, amount: Math.abs(gross), id, label });
        } else if (/withdraw|transfer to|to bank/.test(type)) out.push({ t: 'payout', src: 'paypal', date: d.date, amount: Math.abs(gross) });
        else if (gross > 0) out.push({ t: 'sale', src: 'paypal', date: d.date, hour: d.hour, amount: gross, fee, id, label });
        else out.push({ t: 'cost', src: 'paypal', date: d.date, amount: Math.abs(gross), label: label || clip(cell(r, c.type), 40) });
      }
      return out;
    },
  },
  {
    kind: 'meta_ads',
    label: 'Meta ads',
    group: 'ads',
    detect: (h) => has(h, 'amount spent') && has(h, ['campaign name', 'ad name', 'ad set name']),
    read(rows, head, tz, meta) {
      const f = finder(head);
      const c = { day: f('day', 'date'), from: f('reporting starts'), to: f('reporting ends'), campaign: f('campaign name'), adset: f('ad set name'), ad: f('ad name'), spend: f('amount spent'), impr: f('impressions'), clicks: f('link clicks', 'clicks'), results: f('results'), type: f('result indicator', 'result type'), value: f('purchases conversion value', 'purchase conversion value', 'website purchases conversion value', 'conversion value') };
      const order = T.dateOrder(rows.slice(0, 200).map((r) => r[c.day >= 0 ? c.day : c.from]));
      const out = [];
      for (const r of rows) {
        const spend = amt(r, c.spend) || 0;
        const impressions = amt(r, c.impr) || 0;
        if (!spend && !impressions) continue;
        const day = c.day >= 0 ? T.parseDate(r[c.day], order) : null;
        const from = day || (c.from >= 0 ? T.parseDate(r[c.from], order) : null) || meta.from;
        const to = day || (c.to >= 0 ? T.parseDate(r[c.to], order) : null) || meta.to;
        out.push({ t: 'ad', src: 'meta', from: from ? from.date : '', to: to ? to.date : '', campaign: clip(cell(r, c.campaign) || cell(r, c.adset) || 'Meta ads', 60), ad: clip(cell(r, c.ad), 60), spend, impressions, clicks: amt(r, c.clicks) || 0, results: amt(r, c.results) || 0, value: amt(r, c.value) || 0, resultType: resultType(cell(r, c.type)) });
      }
      return out;
    },
  },
  {
    kind: 'google_ads',
    label: 'Google Ads',
    group: 'ads',
    detect: (h) => has(h, ['campaign', 'ad group', 'campaign name']) && has(h, ['impr', 'impressions']) && has(h, 'cost') && !has(h, 'amount spent'),
    read(rows, head, tz, meta) {
      const f = finder(head);
      const c = { day: f('day', 'date'), campaign: f('campaign', 'campaign name'), group: f('ad group'), cost: f('cost'), impr: f('impr', 'impressions'), clicks: f('clicks', 'interactions'), conv: f('conversions', 'conv'), value: f('conv value', 'conversion value', 'all conv value') };
      const order = T.dateOrder(rows.slice(0, 200).map((r) => r[c.day]));
      const out = [];
      for (const r of rows) {
        const first = String(r[0] || '').trim();
        if (/^total/i.test(first) || /^total/i.test(cell(r, c.campaign))) continue;
        const spend = amt(r, c.cost) || 0;
        const impressions = amt(r, c.impr) || 0;
        if (!spend && !impressions) continue;
        const day = c.day >= 0 ? T.parseDate(r[c.day], order) : null;
        out.push({ t: 'ad', src: 'google', from: day ? day.date : meta.from ? meta.from.date : '', to: day ? day.date : meta.to ? meta.to.date : '', campaign: clip(cell(r, c.campaign) || 'Google Ads', 60), ad: clip(cell(r, c.group), 60), spend, impressions, clicks: amt(r, c.clicks) || 0, results: amt(r, c.conv) || 0, value: amt(r, c.value) || 0, resultType: 'conversions' });
      }
      return out;
    },
  },
  {
    kind: 'instagram',
    label: 'Instagram posts',
    group: 'posts',
    detect: (h) => has(h, 'publish time', 'post type') && has(h, ['permalink', 'account username', 'post id']),
    read: (rows, head, tz) => readPosts(rows, head, tz, 'instagram'),
  },
  {
    kind: 'tiktok',
    label: 'TikTok posts',
    group: 'posts',
    detect: (h) => has(h, ['video title', 'video link']) && has(h, ['total views', 'video views', 'views']),
    read: (rows, head, tz) => readPosts(rows, head, tz, 'tiktok'),
  },
  {
    kind: 'posts_sheet',
    label: 'Post stats',
    group: 'posts',
    detect: (h) => has(h, ['posted', 'date posted', 'post date', 'published', 'date']) && has(h, ['caption', 'post', 'title', 'description']) && has(h, ['views', 'reach', 'likes', 'plays']),
    read: (rows, head, tz) => readPosts(rows, head, tz, 'posts'),
  },
  {
    kind: 'sheet',
    label: 'Your numbers sheet',
    group: 'sheet',
    detect: (h) => h.length <= 5 && has(h, ['date', 'day', 'week']) && has(h, ['metric', 'name', 'number', 'what']) && has(h, ['value', 'amount', 'count', 'total']),
    read(rows, head) {
      const f = finder(head);
      const c = { date: f('date', 'day', 'week'), name: f('metric', 'name', 'number', 'what'), value: f('value', 'amount', 'count', 'total') };
      const order = T.dateOrder(rows.slice(0, 200).map((r) => r[c.date]));
      const out = [];
      for (const r of rows) {
        const d = T.parseDate(r[c.date], order);
        const name = clip(cell(r, c.name), 50);
        const value = amt(r, c.value);
        if (!d || !name || value == null) continue;
        out.push(metricRecord(d.date, name, value));
      }
      return out;
    },
  },
  {
    kind: 'daily_sheet',
    label: 'Your daily sheet',
    group: 'sheet',
    // A hand-made sheet with a date and a column per number: Date, Sales, Orders, Calls booked.
    detect: (h) => h.length >= 2 && h.length <= 30 && ['date', 'day'].includes(T.normHead(h[0])) && !has(h, 'caption') && !has(h, 'amount spent'),
    read(rows, head) {
      const order = T.dateOrder(rows.slice(0, 200).map((r) => r[0]));
      const out = [];
      for (const r of rows) {
        const d = T.parseDate(r[0], order);
        if (!d) continue;
        for (let j = 1; j < head.length; j++) {
          const v = T.num(r[j]);
          if (v == null || !String(head[j] || '').trim()) continue;
          out.push(metricRecord(d.date, clip(head[j], 50), v));
        }
      }
      return out;
    },
  },
];

function resultType(s) {
  const t = String(s || '').toLowerCase();
  if (/purchase/.test(t)) return 'purchases';
  if (/lead/.test(t)) return 'sign-ups';
  if (/messag|conversation/.test(t)) return 'messages';
  if (/link_click|link click/.test(t)) return 'link clicks';
  if (/reach/.test(t)) return 'people reached';
  if (/video|thruplay/.test(t)) return 'video views';
  return t ? 'results' : '';
}

// Names that are costs or running totals in a member's sheet.
const COST = /\b(expense|expenses|cost|costs|spent|spend|rent|payroll|wages|supplies|software|booth|fee|fees|materials|inventory bought|shipping paid|bill|bills)\b/i;
const LEVEL = /\b(balance|followers|subscribers total|list size|total subscribers|on hand|in the bank|bank|inventory left|stock)\b/i;
const keyOf = (name) => `m_${String(name).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'number'}`;
function metricRecord(date, name, value) {
  return { t: 'metric', src: 'sheet', date, name, key: keyOf(name), value, level: LEVEL.test(name) && !COST.test(name), cost: COST.test(name) };
}

function formatOf(type) {
  const t = String(type || '').toLowerCase();
  if (!t) return '';
  if (/\blive\b/.test(t)) return 'live';
  if (/reel|video|short|clip|igtv|tiktok/.test(t)) return 'video';
  if (/carousel|album|multi|slide/.test(t)) return 'carousel';
  if (/stor(y|ies)/.test(t)) return 'story';
  if (/photo|image|picture|pic|still/.test(t)) return 'photo';
  if (/text|status|thread|tweet/.test(t)) return 'text';
  return 'other';
}

function readPosts(rows, head, tz, src) {
  const f = finder(head);
  const c = { date: f('publish time', 'post time', 'posted', 'date posted', 'post date', 'published', 'date'), caption: f('description', 'video title', 'caption', 'title', 'post'), link: f('permalink', 'video link', 'link', 'url'), type: f('post type', 'type', 'format'), views: f('views', 'total views', 'video views', 'plays'), reach: f('reach'), impr: f('impressions'), likes: f('likes', 'total likes'), comments: f('comments', 'total comments'), shares: f('shares', 'total shares'), saves: f('saves', 'total saves', 'favorites', 'total favorites'), follows: f('follows', 'new followers') };
  const when = dateReader(rows, c.date, head, tz);
  const out = [];
  for (const r of rows) {
    const d = when(r);
    if (!d) continue;
    const views = amt(r, c.views) != null ? amt(r, c.views) : amt(r, c.impr) != null ? amt(r, c.impr) : amt(r, c.reach);
    out.push({ t: 'post', src, date: d.date, hour: d.hour, caption: clip(cell(r, c.caption), 300), link: /^https:\/\//.test(cell(r, c.link)) ? cell(r, c.link) : '', format: src === 'tiktok' ? 'video' : formatOf(cell(r, c.type)), views: views || 0, reach: amt(r, c.reach) || 0, likes: amt(r, c.likes) || 0, comments: amt(r, c.comments) || 0, shares: amt(r, c.shares) || 0, saves: amt(r, c.saves) || 0, follows: amt(r, c.follows) || 0 });
  }
  return out;
}

// Google Ads puts the report's name and its dates above the header: "September 14, 2026 - October 18, 2026".
function rangeAbove(rows, at) {
  for (const r of rows.slice(0, at)) {
    const s = r.join(' ');
    const m = s.match(/([A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})\s*[-\u2013to]+\s*([A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{4}-\d{2}-\d{2})/);
    if (m) return { from: T.parseDate(m[1]), to: T.parseDate(m[2]) };
  }
  return {};
}

// One export's text -> what it is and its records. Unknown files say which columns they had.
function readText(raw, { name = 'your file', tz = 'America/Chicago' } = {}) {
  const rows = T.parseTable(raw);
  if (rows.length < 2) return { kind: 'unknown', name, label: 'Unknown file', columns: (rows[0] || []).slice(0, 12), records: [], error: 'it has no rows under the header' };
  for (let at = 0; at < Math.min(6, rows.length - 1); at++) {
    const head = rows[at];
    const src = SOURCES.find((s) => s.detect(head));
    if (!src) continue;
    const body = rows.slice(at + 1, at + 1 + MAX_ROWS);
    const records = src.read(body, head, tz, rangeAbove(rows, at));
    const dates = records.flatMap((r) => (r.date ? [r.date] : [r.from, r.to].filter(Boolean))).sort();
    return { kind: src.kind, name, label: src.label, group: src.group, rows: body.length, records, from: dates[0] || '', to: dates[dates.length - 1] || '', columns: head.filter(Boolean).slice(0, 40), cut: rows.length - 1 - at > MAX_ROWS };
  }
  return { kind: 'unknown', name, label: 'Unknown file', columns: rows[0].filter(Boolean).slice(0, 12), records: [], error: "its columns don't match an export we read" };
}

// Moves every date by n days (sample data, so the sample's last day is yesterday).
function shift(records, n) {
  if (!n) return records;
  const mv = (d) => (d ? T.addDays(d, n) : d);
  return records.map((r) => ({ ...r, ...(r.date ? { date: mv(r.date) } : {}), ...(r.from ? { from: mv(r.from) } : {}), ...(r.to ? { to: mv(r.to) } : {}), ...(r.due ? { due: mv(r.due) } : {}) }));
}

// Both Stripe exports: the payments file has every sale, refund and chargeback, so the balance file
// adds only its payouts (otherwise each sale would count twice).
function combine(files) {
  const kinds = new Set(files.map((f) => f.kind));
  const notes = [];
  const records = [];
  for (const f of files) {
    if (f.kind === 'stripe_balance' && kinds.has('stripe_payments')) {
      records.push(...f.records.filter((r) => r.t === 'payout'));
      notes.push('You added both Stripe files: sales, refunds and chargebacks come from the payments file, and payouts from the balance file, so nothing counts twice.');
    } else records.push(...f.records);
  }
  const money = files.filter((f) => f.group === 'money').map((f) => f.kind);
  if (money.includes('shopify_orders') && money.some((k) => k === 'stripe_payments' || k === 'paypal')) notes.push('Shopify orders are counted beside your Stripe or PayPal sales. If your store takes payment through Stripe or PayPal, add one or the other, or those sales count twice.');
  return { records, notes };
}

// The workflow's files (Library ids) -> { files, records, notes, unknown, sample }. No files: the
// member's connected accounts when HQ wires them (lib/connected.js), else the labeled sample business.
async function load(ctx, ids, { today, tz } = {}) {
  const list = (Array.isArray(ids) ? ids : ids ? [ids] : []).filter(Boolean).slice(0, 12);
  const zone = tz || (ctx.member && ctx.member.timezone) || 'America/Chicago';
  const files = [];
  const unknown = [];
  const seen = new Set();
  for (const id of list) {
    const a = await ctx.asset(id);
    if (a.bytes > MAX_BYTES) throw new Error(`${a.name || 'That file'} is over 25 MB. Export a shorter date range and add it again.`);
    const buf = fs.readFileSync(a.path);
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    const r = readText(T.decode(buf), { name: a.name || 'your file', tz: zone });
    if (r.kind === 'unknown') unknown.push(r);
    else files.push(r);
  }
  if (list.length && !files.length) {
    const u = unknown[0] || {};
    throw new Error(`We couldn't read ${u.name || 'that file'}: ${u.error || 'unknown format'}. Its columns: ${(u.columns || []).join(', ') || 'none'}. Add a CSV exported from Stripe, Shopify, Square, PayPal, Meta Ads, Google Ads, Instagram or TikTok, or a sheet with the columns date, metric, value.`);
  }
  if (!list.length) {
    const connected = await require('./connected').readConnected(ctx, { today, tz: zone });
    if (connected && connected.files.length) {
      const c = combine(connected.files);
      return { files: connected.files.map(strip), records: c.records, notes: [...c.notes, ...connected.notes], unknown: [], sample: false, source: 'connected' };
    }
    const n = today ? T.daysBetween(SAMPLE_LAST_DAY, T.addDays(today, -1)) : 0;
    for (const name of SAMPLE_FILES) {
      const r = readText(fs.readFileSync(path.join(SAMPLE_DIR, name), 'utf8'), { name, tz: zone });
      r.records = shift(r.records, n);
      if (r.from) r.from = T.addDays(r.from, n);
      if (r.to) r.to = T.addDays(r.to, n);
      files.push(r);
    }
    const c = combine(files);
    return { files: files.map(strip), records: c.records, notes: [], unknown: [], sample: true, source: 'sample' };
  }
  const c = combine(files);
  const notes = [...c.notes, ...unknown.map((u) => `We skipped ${u.name}: ${u.error}. Its columns: ${u.columns.join(', ')}.`), ...files.filter((f) => f.cut).map((f) => `${f.name} has more than ${MAX_ROWS.toLocaleString('en-US')} rows; we read the first ${MAX_ROWS.toLocaleString('en-US')}. Export a shorter date range to see all of it.`)];
  return { files: files.map(strip), records: c.records, notes, unknown: unknown.map(strip), sample: false, source: 'files' };
}

const strip = (f) => ({ kind: f.kind, name: f.name, label: f.label, group: f.group || '', rows: f.rows || 0, from: f.from || '', to: f.to || '', columns: f.columns || [] });

module.exports = { SOURCES, readText, load, combine, shift, metricRecord, keyOf, formatOf, finder, SAMPLE_LAST_DAY, SAMPLE_FILES, SAMPLE_DIR };
