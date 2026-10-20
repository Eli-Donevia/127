// The member's own Stripe and Shopify, read through the HQ connection when they have made one.
//
// Shape (contract v1.10 section 6 and v2/turnkey/hub/README.md, Hub patch w1-connections, Oct 20):
// `ctx.secret('stripe')` and `ctx.secret('shopify')` give a client for the member's account, never
// the key, or null until they connect (or while CONNECTOR_STRIPE / CONNECTOR_SHOPIFY is off). Methods
// used here, all reads:
//   stripe.balanceTransactions({ sinceDays, limit }) -> [{ id, at (ISO), type, amount, fee, net, currency, description }]
//   shopify.orders({ sinceDays, limit })            -> [{ id, at, total, paid (financial status), cancelled, items: [{ title, quantity, price }] }]
// Amounts come back in units (dollars), with no customer fields. Nothing here writes. Records come
// out in the same shape as the CSV readers (lib/readers.js), so every report works the same either
// way. When neither is connected the packs read the CSV files members add, else the sample.
// fromStripeTxn and fromShopifyOrder also take the raw API objects (cents, created, line_items), so
// the mapping is tested on both.

const DAYS_BACK = 120;
const STRIPE_LIMIT = 3000;
const SHOPIFY_LIMIT = 250; // the client reads one page

const T = require('./table');

function dayIn(ms, tz) {
  const p = T.fromUtc({ date: new Date(ms).toISOString().slice(0, 10), hour: new Date(ms).getUTCHours(), minute: new Date(ms).getUTCMinutes() }, tz);
  return p;
}

// One Stripe balance transaction (API object, amounts in cents) -> records.
function fromStripeTxn(b, tz) {
  const client = b.at != null && b.created == null; // the HQ client: ISO time, amounts in units
  const ms = client ? Date.parse(b.at) : Number(b.created) * 1000;
  if (!Number.isFinite(ms)) return [];
  const d = dayIn(ms, tz);
  const cents = (n) => (client ? Math.round(Number(n || 0) * 100) / 100 : Math.round(Number(n || 0)) / 100);
  const byType = { payment: 'charge', charge: 'charge', payment_refund: 'refund', refund: 'refund', stripe_fee: 'fee', payout: 'payout' };
  let cat = b.reporting_category || byType[b.type] || b.type;
  if (!b.reporting_category && b.type === 'adjustment' && /dispute|chargeback/i.test(b.description || '')) cat = Number(b.amount) < 0 ? 'dispute' : 'dispute_reversal';
  const gross = cents(b.amount);
  const fee = Math.abs(cents(b.fee));
  const base = { src: 'stripe', date: d.date };
  if (cat === 'charge') return [{ t: 'sale', ...base, hour: d.hour, amount: Math.abs(gross), fee, id: b.id, label: String(b.description || '').slice(0, 60) }];
  if (cat === 'refund') return [{ t: 'refund', ...base, amount: Math.abs(gross), id: b.id, label: '' }, ...(fee ? [{ t: 'fee', ...base, amount: fee }] : [])];
  if (cat === 'dispute') return [{ t: 'dispute', ...base, amount: Math.abs(gross), status: '', reason: '', due: '', id: b.id }, ...(fee ? [{ t: 'fee', ...base, amount: fee }] : [])];
  if (cat === 'dispute_reversal') return [{ t: 'dispute', ...base, amount: -Math.abs(gross), status: 'won', reason: '', due: '', id: b.id }];
  if (cat === 'fee') return [{ t: 'fee', ...base, amount: -cents(b.net) }];
  if (cat === 'payout') return [{ t: 'payout', ...base, amount: Math.abs(gross) }];
  return [];
}

// One Shopify order (REST Admin API) -> records. Customer fields are never read.
function fromShopifyOrder(o, tz) {
  const ms = Date.parse(o.at || o.created_at);
  if (!Number.isFinite(ms) || o.cancelled === true) return [];
  const d = dayIn(ms, tz);
  const status = String(o.financial_status || o.paid || '').toLowerCase();
  if (!/paid|refund/.test(status)) return [];
  const name = String(o.name || o.id || '');
  const total = Number(o.total != null ? o.total : o.total_price) || 0;
  const out = [{ t: 'sale', src: 'shopify', date: d.date, hour: d.hour, amount: total, fee: 0, id: name, label: `Order ${name}` }];
  let refunded = 0;
  for (const r of o.refunds || []) for (const tr of r.transactions || []) if (tr.kind === 'refund' && tr.status === 'success') refunded += Number(tr.amount) || 0;
  // The HQ client has no refund lines: a fully refunded order counts its total; a partial one can't be known.
  if (!o.refunds && status === 'refunded') refunded = total;
  if (refunded) out.push({ t: 'refund', src: 'shopify', date: d.date, amount: Math.round(refunded * 100) / 100, id: name, label: `Order ${name}` });
  for (const li of o.items || o.line_items || []) {
    const qty = Number(li.quantity) || 0;
    if (!qty) continue;
    out.push({ t: 'item', src: 'shopify', date: d.date, order: name, name: String(li.title || li.name || '').slice(0, 80), qty, amount: Math.round((qty * (Number(li.price) || 0) - (Number(li.total_discount) || 0)) * 100) / 100, refunded: refunded > 0 });
  }
  return out;
}

async function client(ctx, id, method) {
  let c = null;
  try {
    c = await ctx.secret(id);
  } catch (e) {
    return null; // not declared in this context, or not connected
  }
  return c && typeof c === 'object' && typeof c[method] === 'function' ? c : null;
}

async function readStripe(ctx, { tz }) {
  const c = await client(ctx, 'stripe', 'balanceTransactions');
  if (!c) return null;
  let rows;
  try {
    rows = await c.balanceTransactions({ sinceDays: DAYS_BACK, limit: STRIPE_LIMIT });
  } catch (e) {
    throw new Error("Stripe didn't answer. Check your Stripe connection in HQ, or add a Stripe export instead.");
  }
  const records = [];
  for (const b of rows || []) records.push(...fromStripeTxn(b, tz));
  return { kind: 'stripe_balance', name: 'Your Stripe (connected)', label: 'Stripe balance activity', group: 'money', records };
}

async function readShopify(ctx, { tz }) {
  const c = await client(ctx, 'shopify', 'orders');
  if (!c) return null;
  let rows;
  try {
    rows = await c.orders({ sinceDays: DAYS_BACK, limit: SHOPIFY_LIMIT });
  } catch (e) {
    throw new Error("Shopify didn't answer. Check your Shopify connection in HQ, or add an orders export instead.");
  }
  const records = [];
  for (const o of rows || []) records.push(...fromShopifyOrder(o, tz));
  return { kind: 'shopify_orders', name: 'Your Shopify (connected)', label: 'Shopify orders', group: 'money', records };
}

// Both connections, when the member has made them. Null when neither is connected.
async function readConnected(ctx, { today, tz }) {
  if (!ctx || typeof ctx.secret !== 'function' || !today) return null;
  const files = [];
  const notes = [];
  for (const read of [readStripe, readShopify]) {
    let f = null;
    try {
      f = await read(ctx, { today, tz });
    } catch (e) {
      notes.push(e.message);
    }
    if (f && f.records.length) {
      const dates = f.records.map((r) => r.date).filter(Boolean).sort();
      files.push({ ...f, rows: f.records.length, from: dates[0] || '', to: dates[dates.length - 1] || '', columns: [] });
    }
  }
  return files.length ? { files, notes } : null;
}

module.exports = { readConnected, readStripe, readShopify, fromStripeTxn, fromShopifyOrder };
