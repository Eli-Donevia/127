// The numbers a scorecard can hold: how each one is worked out from a stretch of days, which way is
// better, and which kind of export it comes from. Ratios are worked out from the stretch's totals,
// never by averaging daily ratios.

const L = require('./ledger');

const div = (a, b) => (b ? a / b : null);

const METRICS = {
  sales: { label: 'Sales', unit: 'money', better: 'up', group: 'money', kind: 'sum', of: (s) => s.sales, aliases: ['sales', 'revenue', 'gross sales', 'takings'], from: 'Stripe, Shopify, Square or PayPal export' },
  orders: { label: 'Orders', unit: 'count', better: 'up', group: 'money', kind: 'sum', of: (s) => s.orders, aliases: ['orders', 'sales count', 'transactions', 'payments', 'jobs', 'paid jobs', 'bookings paid'], from: 'Stripe, Shopify, Square or PayPal export' },
  aov: { label: 'Average order', unit: 'money', better: 'up', group: 'money', kind: 'ratio', of: (s) => div(s.sales, s.orders), aliases: ['average order', 'aov', 'average order value', 'average sale', 'average job', 'average ticket'], from: 'Stripe, Shopify, Square or PayPal export' },
  refunds: { label: 'Refunds', unit: 'money', better: 'down', group: 'money', kind: 'sum', of: (s) => s.refunds, aliases: ['refunds', 'refunded'], from: 'Stripe, Shopify, Square or PayPal export' },
  refund_rate: { label: 'Refund rate', unit: 'percent', better: 'down', group: 'money', kind: 'ratio', of: (s) => div(s.refunds, s.sales), aliases: ['refund rate', 'refund percent', 'refunds percent'], from: 'Stripe, Shopify, Square or PayPal export' },
  chargebacks: { label: 'Chargebacks', unit: 'count', better: 'down', group: 'money', kind: 'sum', of: (s) => s.disputes, aliases: ['chargebacks', 'disputes', 'chargeback'], from: 'Stripe payments or PayPal export' },
  fees: { label: 'Payment fees', unit: 'money', better: 'down', group: 'money', kind: 'sum', of: (s) => s.fees, aliases: ['fees', 'payment fees', 'card fees', 'processing fees'], from: 'Stripe, Square or PayPal export (Shopify orders have no fees)' },
  cash_in: { label: 'Cash in after fees and refunds', unit: 'money', better: 'up', group: 'money', kind: 'sum', of: (s) => s.sales - s.fees - s.refunds - Math.max(0, s.disputeAmt), aliases: ['cash in', 'net', 'net sales', 'take home', 'cash'], from: 'Stripe, Shopify, Square or PayPal export' },
  ad_spend: { label: 'Ad spend', unit: 'money', better: null, group: 'ads', kind: 'sum', of: (s) => s.adSpend, aliases: ['ad spend', 'ads spend', 'spend', 'ad budget', 'ads'], from: 'Meta Ads or Google Ads export' },
  ad_results: { label: 'Ad results', unit: 'count', better: 'up', group: 'ads', kind: 'sum', of: (s) => s.adResults, aliases: ['ad results', 'results', 'conversions', 'ad conversions', 'ad purchases'], from: 'Meta Ads or Google Ads export' },
  cost_per_result: { label: 'Cost per ad result', unit: 'money', better: 'down', group: 'ads', kind: 'ratio', of: (s) => div(s.adSpend, s.adResults), aliases: ['cost per result', 'cpr', 'cost per conversion', 'cpa', 'cost per purchase', 'cost per sign up', 'cost per signup'], from: 'Meta Ads or Google Ads export' },
  click_rate: { label: 'Ad click rate', unit: 'percent', better: 'up', group: 'ads', kind: 'ratio', of: (s) => div(s.adClicks, s.adImpr), aliases: ['click rate', 'ctr', 'click through rate', 'ad click rate'], from: 'Meta Ads or Google Ads export' },
  ad_return: { label: 'Sales per ad dollar', unit: 'times', better: 'up', group: 'ads', kind: 'ratio', of: (s) => div(s.adValue, s.adSpend), aliases: ['roas', 'return on ad spend', 'sales per ad dollar', 'ad return'], from: 'Meta Ads or Google Ads export with a purchase value column' },
  posts: { label: 'Posts', unit: 'count', better: 'up', group: 'posts', kind: 'sum', of: (s) => s.posts, aliases: ['posts', 'posts published', 'videos posted'], from: 'Instagram or TikTok export' },
  post_views: { label: 'Post views', unit: 'count', better: 'up', group: 'posts', kind: 'sum', of: (s) => s.views, aliases: ['views', 'post views', 'video views', 'reach', 'impressions'], from: 'Instagram or TikTok export' },
  engagement: { label: 'Likes, comments, shares and saves per 100 views', unit: 'rate', better: 'up', group: 'posts', kind: 'ratio', of: (s) => (s.views ? ((s.likes + s.comments + s.shares + s.saves) / s.views) * 100 : null), aliases: ['engagement', 'engagement rate', 'interactions'], from: 'Instagram or TikTok export' },
  follows: { label: 'New follows from posts', unit: 'count', better: 'up', group: 'posts', kind: 'sum', of: (s) => s.follows, aliases: ['follows', 'new follows', 'followers gained', 'new followers'], from: 'Instagram export' },
};

const IDS = Object.keys(METRICS);

// A sheet number as a metric: "m_calls_booked".
function custom(key, name, { level = false, cost = false } = {}) {
  return { label: name, unit: /\$|sales|revenue|expense|cost|spent|rent|fee|payroll|supplies/i.test(name) ? 'money' : 'count', better: cost ? 'down' : 'up', group: `m:${key}`, kind: level ? 'level' : 'sum', of: (s) => (s.custom[key] == null ? null : s.custom[key]), aliases: [name.toLowerCase()], from: 'your own sheet', custom: true };
}

function get(id, led) {
  if (METRICS[id]) return { id, ...METRICS[id] };
  if (/^m_/.test(id) && led && led.names[id]) return { id, ...custom(id, led.names[id], { level: led.levels.includes(id), cost: led.costs.includes(id) }) };
  return null;
}

// Every metric this data can show, sheet numbers included.
function available(led) {
  const out = [];
  for (const id of IDS) {
    const m = METRICS[id];
    if (!led.cover[m.group] && !(m.group === 'ads' && led.cover.adsSpread)) continue;
    if (id === 'fees' && !hasFees(led)) continue;
    if (id === 'ad_return' && !hasAdValue(led)) continue;
    if (id === 'follows' && !hasField(led, 'follows')) continue;
    out.push(get(id, led));
  }
  for (const key of Object.keys(led.names)) out.push(get(key, led));
  return out;
}

const hasField = (led, k) => [...led.days.values()].some((d) => d[k] > 0);
const hasFees = (led) => hasField(led, 'fees');
const hasAdValue = (led) => [...led.days.values()].some((d) => d.adValue > 0 || d.spread.adValue > 0);

// Value of a metric over [from, to]. per: 'total' (the stretch) or 'day' (sums divided by days covered).
function value(m, led, from, to, { per = 'total', spread = false } = {}) {
  const s = L.sum(led, from, to, { spread: spread || (m.group === 'ads' && !led.cover.ads) });
  const v = m.of(s);
  if (v == null || !Number.isFinite(v)) return null;
  if (per === 'day' && m.kind === 'sum') {
    const group = m.group === 'ads' && !led.cover.ads ? 'adsSpread' : m.group;
    const n = L.covered(led, group, from, to);
    return n ? v / n : null;
  }
  return v;
}

const int = (n) => Math.round(n).toLocaleString('en-US');
function usd(n) {
  if (n == null || !Number.isFinite(n)) return '';
  const cents = Math.abs(n) < 100 && Math.round(n * 100) % 100 !== 0;
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return `${n < 0 ? '-' : ''}$${s}`;
}

// A value the way a member reads it.
function fmt(m, v, { avg = false } = {}) {
  if (v == null || !Number.isFinite(v)) return 'none yet';
  if (m.unit === 'money') return usd(Math.round(v * 100) / 100);
  if (m.unit === 'percent') return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
  if (m.unit === 'times') return `$${v.toFixed(2)} per $1`;
  if (m.unit === 'rate') return v.toFixed(1);
  if (avg && Math.abs(v) < 20 && Math.round(v) !== v) return v.toFixed(1);
  return int(v);
}

// Change of v against a base, as a fraction (0.25 = 25% higher). Null when the base is 0.
const change = (v, base) => (v == null || base == null || !base ? null : (v - base) / Math.abs(base));
const pctText = (c) => `${Math.round(Math.abs(c) * 100)}%`;

// Good, bad or flat for a change, by which way is better.
function verdict(m, c, { flat = 0.1 } = {}) {
  if (c == null || Math.abs(c) < flat || !m.better) return 'flat';
  return (c > 0) === (m.better === 'up') ? 'good' : 'bad';
}

// ---------- targets the member sets ----------

const PER = [
  [/\b(a|per|each|every)\s+day\b|\bdaily\b|\/\s*day\b/i, 'day'],
  [/\b(a|per|each|every)\s+week\b|\bweekly\b|\/\s*w(ee)?k\b/i, 'week'],
  [/\b(a|per|each|every)\s+month\b|\bmonthly\b|\/\s*mo(nth)?\b/i, 'month'],
];

// "Sales 400 a day", "Refund rate under 3%", "Cost per result: $12", "orders - 50 a week"
// -> { sales: { value: 400, per: 'day' }, refund_rate: { value: 0.03, per: 'week' } }
function parseTargets(textIn, metrics) {
  const out = {};
  const lines = String(textIn || '').split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean);
  const list = (metrics || []).slice().sort((a, b) => Math.max(...b.aliases.map((x) => x.length)) - Math.max(...a.aliases.map((x) => x.length)));
  for (const line of lines.slice(0, 30)) {
    const low = line.toLowerCase();
    let best = null;
    let bestLen = 0;
    for (const m of list) {
      for (const a of [m.label.toLowerCase(), ...m.aliases]) {
        if (a.length > bestLen && new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(low)) {
          best = m;
          bestLen = a.length;
        }
      }
    }
    if (!best) continue;
    const numbers = low.replace(/(\d),(\d{3})/g, '$1$2').match(/-?\d+(\.\d+)?\s*(k\b|%)?/g);
    if (!numbers) continue;
    let n = parseFloat(numbers[0]);
    if (/k$/.test(numbers[0].trim())) n *= 1000;
    const isPct = /%/.test(numbers[0]) || best.unit === 'percent';
    if (best.unit === 'percent') n = isPct || n > 1 ? n / 100 : n;
    const per = (PER.find(([re]) => re.test(low)) || [])[1] || 'week';
    out[best.id] = { value: Math.round(n * 10000) / 10000, per };
  }
  return out;
}

// A target in another period's terms: 400 a day is 2,800 a week. Ratios stay as they are.
function scaleTarget(m, t, per) {
  if (!t) return null;
  if (m.kind !== 'sum' || t.per === per) return t.value;
  const days = { day: 1, week: 7, month: 365 / 12 };
  return (t.value / days[t.per]) * days[per];
}

function targetText(m, t) {
  if (!t) return '';
  const v = fmt(m, t.value);
  if (m.kind !== 'sum') return `${m.better === 'down' ? 'at most' : 'at least'} ${v}`;
  return `${v} a ${t.per}`;
}

module.exports = { METRICS, IDS, get, available, value, fmt, usd, int, change, pctText, verdict, parseTargets, scaleTarget, targetText, custom };
