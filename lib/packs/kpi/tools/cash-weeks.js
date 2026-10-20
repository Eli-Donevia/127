// Cash in against cash out, week by week, from the member's own exports and sheet. What came in is
// what customers paid; what went out is refunds, chargebacks, payment fees, ad spend and the costs
// they logged (PayPal payments they sent, cost lines in their sheet). Not a profit and loss: costs
// they didn't add aren't in it, and the page says so.

const { views, save, files } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const M = require('../lib/metrics');
const T = require('../lib/table');
const L = require('../lib/ledger');
const P = require('../lib/page');

const r2 = (n) => Math.round(n * 100) / 100;

module.exports = {
  name: 'kpi.cash_weeks',
  title: 'Weekly cash in and out',
  description: "Week by week from the member's own exports: what customers paid, what went back out (refunds, chargebacks, payment fees, ad spend, costs they logged) and what was left, plus what moved to their bank. Not a profit and loss and no forecast.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, weeks: { type: 'integer', title: 'Weeks to show', minimum: 2, maximum: 26, default: 8 } } },
  output: {
    type: 'object',
    properties: { weeks: { type: 'array' }, totals: { type: 'object' }, headline: { type: 'string' }, html: { type: 'object' }, csv: { type: 'object' }, ...C.OUT_COMMON },
    required: ['weeks', 'totals', 'headline', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const n = Math.max(2, Math.min(26, input.weeks || 8));
    const last = L.weekStart(d.led.to);
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) {
      const from = T.addDays(last, -7 * i);
      if (T.addDays(from, 6) < d.led.from) continue;
      const to = T.addDays(from, 6) > d.led.to ? d.led.to : T.addDays(from, 6);
      const s = L.sum(d.led, from, to, { spread: true });
      const out = { refunds: s.refunds, chargebacks: Math.max(0, s.disputeAmt), fees: s.fees, ads: s.adSpend, costs: s.costs };
      const outTotal = Object.values(out).reduce((a, b) => a + b, 0);
      weeks.push({ week: C.shortRange(from, to), from, partial: to < T.addDays(from, 6), in: r2(s.sales), refunds: r2(out.refunds), chargebacks: r2(out.chargebacks), fees: r2(out.fees), ads: r2(out.ads), costs: r2(out.costs), out: r2(outTotal), left: r2(s.sales - outTotal), bank: r2(s.payouts) });
    }
    const sumOf = (k) => r2(weeks.reduce((a, w) => a + w[k], 0));
    const totals = { in: sumOf('in'), out: sumOf('out'), left: sumOf('left'), bank: sumOf('bank') };
    const full = weeks.filter((w) => !w.partial);
    const lw = full[full.length - 1] || weeks[weeks.length - 1];
    const headline = `Week of ${lw.week}: ${M.usd(Math.round(lw.in))} came in, ${M.usd(Math.round(lw.out))} went back out, ${M.usd(Math.round(lw.left))} left.`;
    const biggest = ['refunds', 'chargebacks', 'fees', 'ads', 'costs'].map((k) => [k, sumOf(k)]).sort((a, b) => b[1] - a[1])[0];
    const LABEL = { refunds: 'Refunds', chargebacks: 'Chargebacks', fees: 'Payment fees', ads: 'Ad spend', costs: 'Costs you logged' };
    const notes = [...d.notes];
    if (!d.led.costs.length && !d.records.some((r) => r.t === 'cost')) notes.push('No costs logged yet. Add a sheet with date, metric, value rows like "2026-10-12, Supplies, 220" and they show here.');
    if (!d.records.some((r) => r.t === 'payout')) notes.push('Moved to your bank shows once you add a Stripe balance export or PayPal activity.');
    const fmt = (v) => M.usd(Math.round(v));
    const rows = weeks.map((w) => ({ ...w, weekLabel: w.partial ? `${w.week} (so far)` : w.week, inT: fmt(w.in), refundsT: fmt(w.refunds), chargebacksT: fmt(w.chargebacks), feesT: fmt(w.fees), adsT: fmt(w.ads), costsT: fmt(w.costs), outT: fmt(w.out), leftT: fmt(w.left), bankT: fmt(w.bank) }));
    const body = `${d.sample ? `<section><div class="card"><p class="big">${P.esc(C.sampleLine)}</p></div></section>` : ''}
<section><h2>Week by week</h2><p class="lead">Cash in is what customers paid. Cash out is what went back out that we can see in your files. ${P.esc(LABEL[biggest[0]])} took the most: ${P.esc(fmt(biggest[1]))} over these weeks.</p>
${P.table([{ key: 'weekLabel', label: 'Week' }, { key: 'inT', label: 'Cash in', n: true }, { key: 'refundsT', label: 'Refunds', n: true }, { key: 'chargebacksT', label: 'Charge-backs', n: true }, { key: 'feesT', label: 'Fees', n: true }, { key: 'adsT', label: 'Ads', n: true }, { key: 'costsT', label: 'Costs', n: true }, { key: 'leftT', label: 'Left', n: true, cls: (r) => (r.left < 0 ? 'bad' : '') }, { key: 'bankT', label: 'To bank', n: true }], rows)}</section>
<section><h2>What this is and isn't</h2><div class="card">${P.list(['It is the money your files show moving, week by week.', 'It is not a profit and loss: product costs, rent, pay and anything else you did not add are not in it. Add them to a sheet (date, metric, value) to see them here.', 'Ads count when they ran. Ads exported without a day breakdown are spread evenly over their dates.', 'To bank is what Stripe or PayPal sent to your bank account: money moving, not money made or spent.', ...notes])}</div></section>
<section><div class="card small muted"><p>${P.esc(C.sourcesLine(d))} ${P.esc(C.privacyLine)}</p></div></section>`;
    const name = d.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business';
    const html = P.page(ctx, { title: 'Cash in and out by week', kicker: 'Your numbers', sub: headline, stats: [{ value: fmt(totals.in), label: `in over ${weeks.length} weeks` }, { value: fmt(totals.out), label: 'back out' }, { value: fmt(totals.left), label: 'left' }, { value: fmt(totals.bank), label: 'to your bank' }], body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'cash by week', d.led.to, '.html'), html);
    // Each row's Out and Left are formulas, so a cost typed into the sheet updates them.
    const csvRows = weeks.map((w, i) => {
      const r = i + 2;
      return { week: w.from, in: w.in, refunds: w.refunds, chargebacks: w.chargebacks, fees: w.fees, ads: w.ads, costs: w.costs, out: `=SUM(C${r}:G${r})`, left: `=B${r}-H${r}`, bank: w.bank };
    });
    const csvText = files.csv(csvRows, [{ key: 'week', label: 'Week starting' }, { key: 'in', label: 'Cash in' }, { key: 'refunds', label: 'Refunds' }, { key: 'chargebacks', label: 'Chargebacks' }, { key: 'fees', label: 'Payment fees' }, { key: 'ads', label: 'Ad spend' }, { key: 'costs', label: 'Costs you logged' }, { key: 'out', label: 'Cash out' }, { key: 'left', label: 'Left' }, { key: 'bank', label: 'Moved to bank' }], { bom: true });
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'cash by week', d.led.to, '.csv'), csvText);
    ctx.log(headline);
    return { weeks: rows.map((w) => ({ week: w.weekLabel, in: w.in, out: w.out, left: w.left, bank: w.bank, refunds: w.refunds, chargebacks: w.chargebacks, fees: w.fees, ads: w.ads, costs: w.costs })), totals, headline, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.table([{ key: 'week', label: 'Week' }, { key: 'in', label: 'Cash in', format: 'money' }, { key: 'out', label: 'Cash out', format: 'money' }, { key: 'left', label: 'Left', format: 'money' }, { key: 'bank', label: 'To bank', format: 'money' }], out.weeks, 13),
      views.text('Not a profit and loss: only the costs in your files are counted.'),
      views.file(out.html, 'Cash by week (printable)'),
      views.file(out.csv, 'Cash by week (CSV with formulas)')
    );
  },
};
