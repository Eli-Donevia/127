// Orders reader: the member's own Shopify orders export (CSV) to best sellers by units and by sales,
// products bought together, and repeat buyers with a thank-you note to send them. All code: no AI call
// sees the file. Reading order: an uploaded export, else their Shopify connection once HQ wires it
// (fromShopify below, the same read-only client the ecomops pack reads), else the labeled sample store.
// Buyer names and emails stay in this run's view (first names only) and its CSV, never in memory.

const fs = require('fs');
const path = require('path');
const { views, save, files, money, text, time } = require('../../_kit');
const U = require('../lib/util');
const S = require('../lib/store');

const { usd, num } = money;
const { plain } = text;
const SAMPLE = path.join(__dirname, '..', 'sample', 'orders.csv');

const col = (row, ...names) => {
  for (const n of names) if (row[n] != null && row[n] !== '') return row[n];
  return '';
};
const dateOf = (s) => {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

// Shopify's orders export: one row per line item; order fields only on each order's first row.
function ordersFromCsv(src) {
  const { head, rows } = U.csvObjects(src);
  if (!head.includes('name') || !head.some((h) => h === 'lineitem name' || h === 'lineitem quantity')) {
    throw new Error('That file doesn\'t look like a Shopify orders export. In Shopify, open Orders, choose Export, pick "All orders" and "CSV for Excel, Numbers or other spreadsheet programs", then add that file.');
  }
  const byName = new Map();
  for (const r of rows) {
    const id = col(r, 'name');
    if (!id) continue;
    if (!byName.has(id)) byName.set(id, { id, email: '', buyer: '', date: '', total: 0, refunded: 0, cancelled: false, status: '', items: [] });
    const o = byName.get(id);
    if (!o.email && col(r, 'email')) o.email = col(r, 'email').toLowerCase();
    if (!o.buyer && col(r, 'billing name', 'shipping name')) o.buyer = plain(col(r, 'billing name', 'shipping name'));
    if (!o.date) o.date = dateOf(col(r, 'created at', 'paid at'));
    if (col(r, 'total')) o.total = num(col(r, 'total'), 0);
    if (col(r, 'refunded amount')) o.refunded = num(col(r, 'refunded amount'), 0);
    if (col(r, 'cancelled at')) o.cancelled = true;
    if (col(r, 'financial status')) o.status = col(r, 'financial status').toLowerCase();
    const name = plain(col(r, 'lineitem name'));
    const qty = num(col(r, 'lineitem quantity'), 0);
    if (name && qty > 0) o.items.push({ name, sku: col(r, 'lineitem sku'), qty, price: num(col(r, 'lineitem price'), 0) });
  }
  return [...byName.values()];
}

// For when HQ wires the member's Shopify (contract: needs.shopify is null, "always sample", today).
// The client from ctx.secret('shopify'): orders({ sinceDays }) with line_items, as Hub's connector reads.
async function fromShopify(client, { sinceDays = 365 } = {}) {
  const raw = await client.orders({ sinceDays });
  const list = Array.isArray(raw) ? raw : (raw && (raw.orders || raw.data)) || [];
  return list.map((o) => {
    const c = o.customer || {};
    const buyer = plain((o.billing_address && o.billing_address.name) || [c.first_name, c.last_name].filter(Boolean).join(' '));
    return {
      id: String(o.name || o.id || ''),
      email: String(o.email || c.email || '').toLowerCase(),
      buyer,
      date: dateOf(o.created_at || o.processed_at),
      total: num(o.total_price, 0),
      refunded: (o.refunds || []).reduce((n, r) => n + (r.transactions || []).reduce((m, t) => m + num(t.amount, 0), 0), 0),
      cancelled: !!o.cancelled_at,
      status: String(o.financial_status || '').toLowerCase(),
      items: (o.line_items || []).map((li) => ({ name: plain(li.name || li.title || ''), sku: li.sku || '', qty: num(li.quantity, 0), price: num(li.price, 0) })).filter((li) => li.name && li.qty > 0),
    };
  });
}

function analyze(orders) {
  const live = orders.filter((o) => !o.cancelled && !/^(voided|refunded)$/.test(o.status) && o.items.length);
  const products = new Map();
  const buyers = new Map();
  const pairs = new Map();
  for (const o of live) {
    for (const it of o.items) {
      const p = products.get(it.name) || { product: it.name, sku: it.sku, units: 0, sales: 0, orders: 0 };
      p.units += it.qty;
      p.sales += it.qty * it.price;
      p.orders += 1;
      products.set(it.name, p);
    }
    const names = [...new Set(o.items.map((i) => i.name))].sort();
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const k = `${names[i]} + ${names[j]}`;
      pairs.set(k, (pairs.get(k) || 0) + 1);
    }
    const key = o.email || o.buyer.toLowerCase();
    if (!key) continue;
    const b = buyers.get(key) || { name: o.buyer, email: o.email, orders: 0, spent: 0, first: o.date, last: o.date, bought: new Set() };
    b.orders += 1;
    b.spent += Math.max(0, o.total - o.refunded);
    if (o.date && (!b.first || o.date < b.first)) b.first = o.date;
    if (o.date && (!b.last || o.date > b.last)) b.last = o.date;
    if (!b.name && o.buyer) b.name = o.buyer;
    o.items.forEach((i) => b.bought.add(i.name));
    buyers.set(key, b);
  }
  const best = [...products.values()].map((p) => ({ ...p, sales: Math.round(p.sales * 100) / 100 })).sort((a, b) => b.units - a.units || b.sales - a.sales);
  const repeat = [...buyers.values()]
    .filter((b) => b.orders >= 2)
    .sort((a, b) => b.orders - a.orders || b.spent - a.spent)
    .map((b) => ({ name: b.name, first_name: (b.name || 'there').split(/\s+/)[0], email: b.email, orders: b.orders, spent: Math.round(b.spent * 100) / 100, first: b.first, last: b.last, bought: [...b.bought].slice(0, 4).join(', ') }));
  const dates = live.map((o) => o.date).filter(Boolean).sort();
  return {
    orders: live.length,
    skipped: orders.length - live.length,
    buyers: buyers.size,
    repeat,
    best,
    pairs: [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([pair, n]) => ({ pair, orders: n })).filter((x) => x.orders >= 2),
    from: dates[0] || '',
    to: dates[dates.length - 1] || '',
  };
}

module.exports = {
  name: 'ecom.read_orders',
  title: 'Read your orders',
  description: 'Reads your Shopify orders export: best sellers by units and by sales, products bought together, and repeat buyers with a thank-you note to send each one. Your file stays in this run.',
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['shopify'],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'asset', accept: '.csv,text/csv', title: 'Your Shopify orders export (CSV)', description: 'Shopify: Orders, Export, All orders, CSV. Leave empty to see how it works on a sample store.' },
      shop: { type: 'string', maxLength: 80, title: 'Shop name (optional)' },
    },
  },
  output: {
    type: 'object',
    required: ['orders', 'best', 'repeat'],
    properties: { source: { type: 'string' }, orders: { type: 'integer' }, buyers: { type: 'integer' }, skipped: { type: 'integer' }, best: { type: 'array' }, repeat: { type: 'array' }, pairs: { type: 'array' }, from: { type: 'string' }, to: { type: 'string' }, next: { type: 'array' }, note: { type: 'string' }, files: { type: 'array' }, sample: { type: 'boolean' } },
  },
  async run(input, ctx) {
    const m = S.me(ctx, input);
    let orders = null;
    let source = '';
    let sample = false;
    if (input.file) {
      const f = await U.readUpload(ctx, input.file);
      orders = ordersFromCsv(f.text);
      source = `From ${f.name}.`;
    } else {
      let client = null;
      try {
        client = typeof ctx.secret === 'function' ? ctx.secret('shopify') : null;
      } catch {
        client = null;
      }
      if (client && typeof client === 'object' && typeof client.orders === 'function') {
        try {
          orders = await fromShopify(client);
          source = 'From your connected Shopify, the last 365 days.';
        } catch (e) {
          ctx.log("Your Shopify didn't answer, so this run uses the sample store.");
        }
      }
      if (!orders) {
        orders = ordersFromCsv(fs.readFileSync(SAMPLE, 'utf8'));
        source = 'From the sample store (Juniper Candle Co., made up), not your orders. Add your Shopify orders export to read yours.';
        sample = true;
      }
    }
    const a = analyze(orders);
    if (!a.orders) throw new Error('No paid orders in that file. Export "All orders" for a longer date range and add it again.');
    const shop = m.shop || 'my shop';
    const top = a.best[0];
    const next = [
      top ? `${top.product} sold the most units (${top.units}). Lead your next post and email with it, and keep it in stock first.` : '',
      a.best[1] && a.best[1].sales > top.sales ? `${a.best[1].product} brought in more sales than any other product. Put it second on your home page.` : '',
      a.pairs[0] ? `${a.pairs[0].pair} were bought together ${a.pairs[0].orders} times. Try them as a set.` : '',
      a.repeat.length ? `${a.repeat.length} of ${a.buyers} buyers ordered more than once. Write to them first when something new is coming.` : `No repeat buyers yet in these ${a.orders} orders. The after-purchase emails can help people remember your shop.`,
    ].filter(Boolean);
    const repeat = a.repeat.slice(0, 50).map((b) => ({
      ...b,
      note: `Hi ${b.first_name}, I noticed you've ordered from ${shop} ${b.orders} times now. Thank you, truly. A small shop runs on people like you. If there's anything you'd love to see me make next, just reply and tell me.${m.first ? `\n\n${m.first}` : ''}`,
    }));
    const stamp = time.today(ctx);
    const bestFile = await save.saveFile(ctx, save.fileName(shop, 'best sellers', stamp, '.csv'), files.csv(a.best, [
      { key: 'product', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'units', label: 'Units' },
      { key: 'sales', label: 'Sales (before fees and refunds)' },
      { key: 'orders', label: 'Orders' },
    ]));
    const repeatFile = await save.saveFile(ctx, save.fileName(shop, 'repeat buyers', stamp, '.csv'), files.csv(repeat, [
      { key: 'name', label: 'Buyer' },
      { key: 'email', label: 'Email' },
      { key: 'orders', label: 'Orders' },
      { key: 'spent', label: 'Spent (after refunds)' },
      { key: 'first', label: 'First order' },
      { key: 'last', label: 'Last order' },
      { key: 'bought', label: 'Bought' },
      { key: 'note', label: 'Thank-you note' },
    ]));
    return {
      source,
      orders: a.orders,
      buyers: a.buyers,
      skipped: a.skipped,
      best: a.best.slice(0, 50),
      repeat: repeat.map(({ email, name, ...rest }) => rest),
      pairs: a.pairs,
      from: a.from,
      to: a.to,
      next,
      note: 'Only the buyers who ordered are in this file. Write to them only about their orders, or if they signed up for your emails.',
      files: [bestFile, repeatFile],
      ...(sample ? { sample: true } : {}),
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Orders read', out.orders, `${out.buyers} buyers${out.from ? `, ${time.shortDate(out.from)} to ${time.shortDate(out.to)}` : ''}${out.skipped ? `. ${out.skipped} cancelled or refunded left out` : ''}`),
      views.text(out.source),
      views.text(out.next.join(' ')),
      views.table([{ key: 'product', label: 'Product' }, { key: 'units', label: 'Units', format: 'number' }, { key: 'sales', label: 'Sales', format: 'money' }, { key: 'orders', label: 'Orders', format: 'number' }], out.best),
      out.pairs.length ? views.table([{ key: 'pair', label: 'Bought together' }, { key: 'orders', label: 'Orders', format: 'number' }], out.pairs) : null,
      out.repeat.length ? views.table([{ key: 'first_name', label: 'Repeat buyer' }, { key: 'orders', label: 'Orders', format: 'number' }, { key: 'last', label: 'Last order' }, { key: 'bought', label: 'Bought' }], out.repeat) : null,
      out.repeat[0] ? views.copy(`Thank-you note: ${out.repeat[0].first_name}`, out.repeat[0].note) : null,
      views.text(out.note),
      ...out.files.map((f, i) => views.file(f, i ? 'Repeat buyers with emails and notes (CSV)' : 'Best sellers (CSV)')),
    );
  },
};
