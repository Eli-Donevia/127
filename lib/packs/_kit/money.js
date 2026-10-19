// Money and number formatting for member-facing text and tables. Members see dollars in their own
// prices and costs only: never projected income (voice guide 15.3, Legal L12).

function num(v, fallback = null) {
  if (v == null || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

// 1234.5 -> "$1,234.50", 1200 -> "$1,200", 0.5 -> "$0.50"
function usd(v, { cents } = {}) {
  const n = num(v);
  if (n == null) return '';
  const showCents = cents != null ? cents : Math.round(n * 100) % 100 !== 0;
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: showCents ? 2 : 0 });
  return `${n < 0 ? '-' : ''}$${s}`;
}

function int(v) {
  const n = num(v);
  return n == null ? '' : Math.round(n).toLocaleString('en-US');
}

function pct(v, digits = 0) {
  const n = num(v);
  return n == null ? '' : `${(n * 100).toFixed(digits)}%`;
}

function round(n, d = 2) {
  return Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null;
}

// A price people are used to seeing: 43 -> 45, 97 -> 95, 112 -> 115, 1290 -> 1300.
function nicePrice(n) {
  const v = num(n);
  if (v == null || v <= 0) return 0;
  if (v < 20) return Math.max(1, Math.round(v));
  if (v < 200) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 25) * 25;
  if (v < 5000) return Math.round(v / 50) * 50;
  return Math.round(v / 100) * 100;
}

// Price that leaves `margin` (0..1) after cost: cost 12, margin 0.6 -> 30.
function priceForMargin(cost, margin) {
  const c = num(cost, 0);
  const m = Math.min(0.95, Math.max(0, num(margin, 0.5)));
  return c / (1 - m);
}

// Card processing on a sale. Default 2.9% + 30c (Stripe's and Shopify Payments' common US
// online rate as of 2026; members should check their own plan).
function cardFee(price, { rate = 0.029, fixed = 0.3 } = {}) {
  const p = num(price, 0);
  return p > 0 ? p * rate + fixed : 0;
}

module.exports = { num, usd, int, pct, round, nicePrice, priceForMargin, cardFee };
