// Refunds and chargebacks, week by week, from the member's own exports: how many, how much, as a
// share of sales, which products come back most, which chargebacks still need an answer, and what to
// do about each. The one outside figure (0.75%) is Stripe's, sourced in data/actions.json.

const { views, save, files } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const M = require('../lib/metrics');
const T = require('../lib/table');
const L = require('../lib/ledger');
const P = require('../lib/page');

const LINE = 0.0075; // Stripe, Measuring disputes (checked 2026-10-20)
const OPEN = /needs_response|warning_needs_response|under_review|needs response|warning_under_review/;

module.exports = {
  name: 'kpi.refund_watch',
  title: 'Watch refunds and chargebacks',
  description: "Refunds and chargebacks week by week from the member's own payment exports: counts, amounts, share of sales, products refunded most, chargebacks still open with their due dates, and what to do about each.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, weeks: { type: 'integer', title: 'Weeks to show', minimum: 2, maximum: 26, default: 8 } } },
  output: {
    type: 'object',
    properties: { weeks: { type: 'array' }, open: { type: 'array' }, products: { type: 'array' }, steps: { type: 'array' }, headline: { type: 'string' }, html: { type: 'object' }, csv: { type: 'object' }, ...C.OUT_COMMON },
    required: ['weeks', 'open', 'steps', 'headline', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    if (!d.led.cover.money) throw new Error('Refunds and chargebacks come from payment exports. Add a Stripe, Shopify, Square or PayPal export.');
    const n = Math.max(2, Math.min(26, input.weeks || 8));
    const last = L.weekStart(d.led.to);
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) {
      const from = T.addDays(last, -7 * i);
      const to = T.addDays(from, 6) > d.led.to ? d.led.to : T.addDays(from, 6);
      if (to < d.led.cover.money.from) continue;
      const s = L.sum(d.led, from, to);
      weeks.push({ week: `${C.shortRange(from, to)}${to < T.addDays(from, 6) ? ' (so far)' : ''}`, from, sales: s.sales, orders: s.orders, refunds: s.refundCount, refunded: Math.round(s.refunds * 100) / 100, rate: s.sales ? s.refunds / s.sales : 0, chargebacks: s.disputes, disputed: Math.round(Math.max(0, s.disputeAmt) * 100) / 100, cbRate: s.orders ? s.disputes / s.orders : 0 });
    }
    const all = (k) => weeks.reduce((a, w) => a + w[k], 0);
    const rate = all('sales') ? all('refunded') / all('sales') : 0;
    const cbRate = all('orders') ? all('chargebacks') / all('orders') : 0;
    // Products in refunded orders (Shopify), most refunded first.
    const from0 = weeks.length ? weeks[0].from : d.led.from;
    const sold = new Map();
    for (const r of d.records) if (r.t === 'item' && r.date >= from0) {
      const p = sold.get(r.name) || { name: r.name, units: 0, refundedUnits: 0 };
      p.units += r.qty;
      if (r.refunded) p.refundedUnits += r.qty;
      sold.set(r.name, p);
    }
    const products = [...sold.values()].filter((p) => p.refundedUnits).map((p) => ({ name: p.name, refunded: p.refundedUnits, sold: p.units, share: `${Math.round((p.refundedUnits / p.units) * 100)}%` })).sort((a, b) => b.refunded / b.sold - a.refunded / a.sold).slice(0, 5);
    const open = d.records.filter((r) => r.t === 'dispute' && r.amount > 0 && OPEN.test(r.status || '')).map((r) => ({ amount: M.usd(r.amount), where: R.SRC[r.src] || r.src, opened: R.shortDay(r.date), due: r.due ? R.longDay(r.due) : 'check your payment account', reason: r.reason || 'not given' }));
    const recent = d.records.filter((r) => r.t === 'refund' && r.date >= from0).sort((a, b) => b.amount - a.amount).slice(0, 5).map((r) => ({ amount: M.usd(r.amount), where: R.SRC[r.src] || r.src, day: R.shortDay(r.date), what: r.label || '' }));
    const steps = [];
    for (const o of open) steps.push(`Answer the ${o.amount} chargeback on ${o.where} before ${o.due}. Send the receipt, what was bought, and any shipping, delivery or attendance proof. Reason given: ${o.reason}.`);
    if (cbRate >= LINE) steps.push(`Chargebacks are ${(cbRate * 100).toFixed(2)}% of your payments over these weeks. Stripe says the card industry treats more than 0.75% as excessive. Put your business name as customers know it on their card statement, and refund quickly when someone asks.`);
    if (products[0] && products[0].refunded >= 2) steps.push(`${products[0].name} comes back most (${products[0].refunded} of ${products[0].sold} sold). Read why on those orders and fix the listing: photos, size, what is included.`);
    const lastFull = weeks.filter((w) => !/so far/.test(w.week));
    const lw = lastFull[lastFull.length - 1];
    const before = lastFull.slice(-5, -1);
    const avgRate = before.length ? before.reduce((a, w) => a + w.rate, 0) / before.length : 0;
    if (lw && avgRate && lw.rate > avgRate * 1.5 && lw.refunded >= 30) steps.push(`Refunds were ${(lw.rate * 100).toFixed(1)}% of sales last week against ${(avgRate * 100).toFixed(1)}% before. Look at last week's refunds for one shared reason.`);
    if (!steps.length) steps.push('Nothing needs you here this week. Keep answering refund requests within a day: a fast refund is cheaper than a chargeback.');
    const headline = `Over ${weeks.length} weeks: ${M.usd(Math.round(all('refunded')))} refunded (${(rate * 100).toFixed(1)}% of sales) and ${all('chargebacks')} chargeback${all('chargebacks') === 1 ? '' : 's'}${open.length ? `, ${open.length} still open` : ''}.`;
    const pct = (v, dg = 1) => `${(v * 100).toFixed(dg)}%`;
    const rows = weeks.map((w) => ({ week: w.week, refunds: w.refunds, refunded: M.usd(Math.round(w.refunded)), rate: pct(w.rate), chargebacks: w.chargebacks, disputed: M.usd(Math.round(w.disputed)), cbRate: pct(w.cbRate, 2) }));
    const notes = [...d.notes];
    if (d.files.some((f) => f.kind === 'shopify_orders')) notes.push("Shopify's orders export has no refund date, so a Shopify refund counts in the week of its order.");
    if (!d.files.some((f) => ['stripe_payments', 'stripe_balance', 'paypal'].includes(f.kind))) notes.push('Chargebacks show from Stripe or PayPal exports. Shopify and Square chargebacks live in their own dashboards.');
    const body = `${d.sample ? `<section><div class="card"><p class="big">${P.esc(C.sampleLine)}</p></div></section>` : ''}
<section><h2>What to do</h2>${steps.map((s) => `<div class="card"><p class="big">${P.esc(s)}</p></div>`).join('')}</section>
${open.length ? `<section><h2>Open chargebacks</h2>${P.table([{ key: 'amount', label: 'Amount', n: true }, { key: 'where', label: 'Where' }, { key: 'opened', label: 'Opened' }, { key: 'due', label: 'Answer by' }, { key: 'reason', label: 'Reason' }], open)}<p class="muted small">Cardholders can dispute a payment up to 120 days after it was made (Stripe). An unanswered chargeback is lost.</p></section>` : ''}
<section><h2>Week by week</h2>${P.table([{ key: 'week', label: 'Week' }, { key: 'refunds', label: 'Refunds', n: true }, { key: 'refunded', label: 'Refunded', n: true }, { key: 'rate', label: 'Of sales', n: true }, { key: 'chargebacks', label: 'Charge-backs', n: true }, { key: 'disputed', label: 'Disputed', n: true }, { key: 'cbRate', label: 'Of payments', n: true, cls: (r) => (parseFloat(r.cbRate) >= LINE * 100 ? 'bad' : '') }], rows)}</section>
${products.length ? `<section><h2>Products refunded most</h2>${P.table([{ key: 'name', label: 'Product' }, { key: 'refunded', label: 'Refunded', n: true }, { key: 'sold', label: 'Sold', n: true }, { key: 'share', label: 'Share', n: true }], products)}</section>` : ''}
${recent.length ? `<section><h2>Biggest refunds</h2>${P.table([{ key: 'amount', label: 'Amount', n: true }, { key: 'where', label: 'Where' }, { key: 'day', label: 'Day' }, { key: 'what', label: 'What' }], recent)}</section>` : ''}
${notes.length ? `<section><h2>Notes</h2><div class="card">${P.list(notes)}</div></section>` : ''}
<section><div class="card small muted"><p>${P.esc(C.sourcesLine(d))} ${P.esc(C.privacyLine)} The 0.75% line is from Stripe's page "Measuring disputes" (docs.stripe.com/disputes/measuring, checked October 20, 2026).</p></div></section>`;
    const name = d.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business';
    const html = P.page(ctx, { title: 'Refunds and chargebacks', kicker: 'Your numbers', sub: headline, stats: [{ value: pct(rate), label: 'refunded, of sales' }, { value: String(all('chargebacks')), label: 'chargebacks' }, { value: String(open.length), label: 'still open' }], body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'refunds', d.led.to, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'refunds', d.led.to, '.csv'), files.csv(weeks.map((w) => ({ week: w.from, sales: Math.round(w.sales * 100) / 100, refunds: w.refunds, refunded: w.refunded, rate: `${(w.rate * 100).toFixed(1)}%`, chargebacks: w.chargebacks, disputed: w.disputed, payments: w.orders })), [{ key: 'week', label: 'Week starting' }, { key: 'sales', label: 'Sales' }, { key: 'refunds', label: 'Refunds' }, { key: 'refunded', label: 'Refunded' }, { key: 'rate', label: 'Refunded, of sales' }, { key: 'chargebacks', label: 'Chargebacks' }, { key: 'disputed', label: 'Disputed' }, { key: 'payments', label: 'Payments' }], { bom: true }));
    ctx.log(headline);
    return { weeks: rows, open, products, steps, headline, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards(out.steps.map((s, i) => ({ title: `Step ${i + 1}`, body: s }))),
      out.open.length ? views.table([{ key: 'amount', label: 'Amount' }, { key: 'where', label: 'Where' }, { key: 'due', label: 'Answer by' }, { key: 'reason', label: 'Reason' }], out.open) : null,
      views.table([{ key: 'week', label: 'Week' }, { key: 'refunded', label: 'Refunded' }, { key: 'rate', label: 'Of sales' }, { key: 'chargebacks', label: 'Chargebacks', format: 'number' }], out.weeks, 8),
      views.file(out.html, 'Refunds and chargebacks (printable)'),
      views.file(out.csv, 'Week by week (CSV)')
    );
  },
};
