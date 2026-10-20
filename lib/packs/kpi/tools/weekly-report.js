// Last full week (Monday to Sunday) against the 4 weeks before: the scorecard, what moved and why,
// best sellers, best posts, ads by campaign, and up to 3 next steps. Pure code.

const { views, save, files } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const M = require('../lib/metrics');
const T = require('../lib/table');
const L = require('../lib/ledger');
const P = require('../lib/page');

const r0 = (n) => Math.round(n);
const per = (n, weeks) => (weeks ? n / weeks : 0);

module.exports = {
  name: 'kpi.weekly_report',
  title: 'Weekly numbers report',
  description: "Compares the member's last full week with the 4 weeks before, from their own exports: every scorecard number against its target, what moved and why, best sellers, best posts, ads by campaign, and up to 3 next steps.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 2,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, type: C.TYPE, targets: C.TARGETS } },
  output: {
    type: 'object',
    properties: {
      week: { type: 'string' },
      rows: { type: 'array' },
      moved: { type: 'array' },
      next: { type: 'array' },
      products: { type: 'array' },
      posts: { type: 'array' },
      ads: { type: 'array' },
      headline: { type: 'string' },
      html: { type: 'object' },
      csv: { type: 'object' },
      ...C.OUT_COMMON,
    },
    required: ['week', 'rows', 'moved', 'next', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const wk = L.lastFullWeek(d.led.to);
    const baseFrom = T.addDays(wk.from, -28);
    const baseTo = T.addDays(wk.from, -1);
    const weeks = Math.max(1, Math.min(4, Math.round(C.dayCount(d.led.from > baseFrom ? d.led.from : baseFrom, baseTo) / 7)));
    const sc = R.scorecard(ctx, d.led, input);
    const metrics = sc.metrics;
    const span = { from: wk.from, to: wk.to, baseFrom, baseTo, per: 'week' };
    const rows = R.compare(d.led, metrics, { ...span, scale: 7, targets: sc.targets, targetPer: 'week' });
    const mv = R.moved(rows, metrics).slice(0, 3);
    for (const r of mv) r.why = R.reason(r, metrics.find((m) => m.id === r.id), d.led, d.records, span);
    const next = [];
    let pool = rows;
    for (let i = 0; i < 3; i++) {
      const s = R.nextStep(pool, metrics, i ? d.records.filter((x) => x.t !== 'dispute') : d.records, span);
      if (next.some((n) => n.text === s.text)) break;
      next.push(s);
      pool = pool.filter((r) => r.id !== s.metric);
      if (!s.metric) break;
    }
    const notes = [...d.notes];
    if (sc.missing.length) notes.push(`Not in these files: ${sc.missing.map((id) => (M.get(id) || { label: id }).label).join(', ')}.`);
    if (d.led.to < T.addDays(d.today, -8)) notes.unshift(`Your newest numbers are from ${R.longDay(d.led.to)}. Export again to see this week.`);

    // Products, posts and ads for the week, against a typical week before it.
    const now = R.detail(d.records, wk.from, wk.to);
    const base = R.detail(d.records, baseFrom, baseTo);
    const products = now.products.slice(0, 5).map((p) => {
      const b = base.products.find((x) => x.name === p.name);
      const usual = per(b ? b.units : 0, weeks);
      return { name: p.name, units: p.units, sales: M.usd(r0(p.sales)), usual: usual ? usual.toFixed(1) : 'new', trend: !usual ? 'New' : p.units >= usual * 1.3 ? 'Up' : p.units <= usual * 0.7 ? 'Down' : 'Steady' };
    });
    const medianViews = median(base.posts.map((p) => p.views));
    const posts = now.posts.slice(0, 3).map((p) => ({ post: R.quote(p.caption, 70), where: R.SRC[p.src] || p.src, day: R.shortDay(p.date), views: r0(p.views), vsUsual: medianViews ? `${(p.views / medianViews).toFixed(1)}x your usual` : '' }));
    const adMap = new Map();
    for (const r of d.records) if (r.t === 'ad' && r.from >= wk.from && r.to <= wk.to) {
      const k = `${r.src}|${r.campaign}`;
      const a = adMap.get(k) || { campaign: `${R.SRC[r.src]}: ${r.campaign}`, spend: 0, results: 0 };
      a.spend += r.spend;
      a.results += r.results;
      adMap.set(k, a);
    }
    const ads = [...adMap.values()].sort((a, b) => b.spend - a.spend).map((a) => ({ campaign: a.campaign, spend: M.usd(r0(a.spend)), results: r0(a.results), cpr: a.results ? M.usd(a.spend / a.results) : 'no results' }));
    const lead = rows[0];
    const range = C.shortRange(wk.from, wk.to);
    const headline = lead ? `${lead.label} for ${range}: ${lead.nowText}${lead.changeText ? `, ${lead.changeText} on your 4-week average (${lead.baseText} a week)` : ''}.` : `Your week, ${range}.`;
    const hq = Array.isArray(ctx.brain && ctx.brain.numbers) && !d.sample ? ctx.brain.numbers.slice(0, 12) : [];

    const table = rows.map((r) => ({ metric: r.label, week: r.nowText, avg: r.baseText, change: r.changeText || 'nothing to compare', target: r.targetText, verdict: r.verdict, hit: r.hit == null ? '' : r.hit ? 'Hit' : 'Missed' }));
    const cls = (r) => (r.verdict === 'good' ? 'good' : r.verdict === 'bad' ? 'bad' : '');
    const body = `${d.sample ? `<section><div class="card"><p class="big">${P.esc(C.sampleLine)}</p></div></section>` : ''}
<section><h2>Next steps</h2>${next.map((n, i) => `<div class="card"><span class="tag p">${i + 1}</span><p class="big">${P.esc(n.text)}</p><p class="muted">${P.esc(n.why)}</p></div>`).join('')}</section>
<section><h2>What moved</h2>${mv.length ? mv.map((r) => `<div class="card"><span class="tag ${r.verdict === 'good' ? 'p' : ''}">${P.esc(r.label)}</span><p>${P.esc(r.why)}</p></div>`).join('') : '<div class="card"><p>Nothing moved much: every number is close to its 4-week average.</p></div>'}</section>
<section><h2>Your scorecard</h2><p class="lead">${P.esc(range)} against the ${weeks} week${weeks === 1 ? '' : 's'} before.</p>${P.table([{ key: 'metric', label: 'Number' }, { key: 'week', label: 'This week', n: true }, { key: 'avg', label: 'Typical week', n: true }, { key: 'change', label: 'Change', n: true, cls }, { key: 'target', label: 'Your target', n: true }, { key: 'hit', label: '', n: true }], table)}</section>
${products.length ? `<section><h2>Best sellers</h2>${P.table([{ key: 'name', label: 'Product' }, { key: 'units', label: 'Sold', n: true }, { key: 'sales', label: 'Sales', n: true }, { key: 'usual', label: 'Typical week', n: true }, { key: 'trend', label: '' }], products)}</section>` : ''}
${posts.length ? `<section><h2>Best posts</h2>${P.table([{ key: 'post', label: 'Post' }, { key: 'where', label: 'Where' }, { key: 'day', label: 'Posted' }, { key: 'views', label: 'Views', n: true }, { key: 'vsUsual', label: '', n: true }], posts)}</section>` : ''}
${ads.length ? `<section><h2>Ads by campaign</h2>${P.table([{ key: 'campaign', label: 'Campaign' }, { key: 'spend', label: 'Spent', n: true }, { key: 'results', label: 'Results', n: true }, { key: 'cpr', label: 'Per result', n: true }], ads)}<p class="muted small">Results are what each ad platform counted. Nothing here changes your ads.</p></section>` : ''}
${hq.length ? `<section><h2>Numbers you logged in HQ</h2>${P.table([{ key: 'week', label: 'Week' }, { key: 'label', label: 'Number' }, { key: 'value', label: 'Value', n: true }], hq)}</section>` : ''}
${notes.length ? `<section><h2>Notes</h2><div class="card">${P.list(notes)}</div></section>` : ''}
<section><div class="card small muted"><p>${P.esc(C.sourcesLine(d))} ${P.esc(C.privacyLine)}</p></div></section>`;
    const name = d.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business';
    const html = P.page(ctx, { title: `Your week, ${range}`, kicker: 'Weekly numbers', sub: headline, stats: rows.slice(0, 4).map((r) => ({ value: r.nowText, label: r.label })), body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'week', wk.from, '.html'), html);
    // The CSV: each day of the week, one column per scorecard number.
    const daysRows = [];
    for (let day = wk.from; day <= wk.to; day = T.addDays(day, 1)) {
      const row = { date: day };
      for (const m of metrics) {
        const v = M.value(m, d.led, day, day);
        row[m.id] = v == null ? '' : Math.round(v * (m.unit === 'percent' ? 10000 : 100)) / (m.unit === 'percent' ? 100 : 100);
      }
      daysRows.push(row);
    }
    const csvText = files.csv(daysRows, [{ key: 'date', label: 'Date' }, ...metrics.map((m) => ({ key: m.id, label: m.unit === 'percent' ? `${m.label} (%)` : m.label }))], { bom: true });
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'week', wk.from, '.csv'), csvText);
    ctx.log(`Week of ${wk.from}: ${rows.length} numbers against ${weeks} week${weeks === 1 ? '' : 's'} before.`);
    return { week: `${wk.from} to ${wk.to}`, rows: table, moved: mv.map((r) => ({ metric: r.label, verdict: r.verdict, text: r.why })), next, products, posts, ads, headline, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards([...out.next.map((n, i) => ({ title: `Next step ${i + 1}`, body: `${n.text} ${n.why}` })), ...out.moved.map((m) => ({ title: m.metric, body: m.text, badge: m.verdict === 'good' ? 'Up' : m.verdict === 'bad' ? 'Watch' : '' }))]),
      views.table([{ key: 'metric', label: 'Number' }, { key: 'week', label: 'This week' }, { key: 'avg', label: 'Typical week' }, { key: 'change', label: 'Change' }, { key: 'target', label: 'Target' }], out.rows, 10),
      out.products.length ? views.table([{ key: 'name', label: 'Best seller' }, { key: 'units', label: 'Sold', format: 'number' }, { key: 'trend', label: 'Trend' }], out.products, 5) : null,
      views.file(out.html, 'Your week (printable)'),
      views.file(out.csv, 'The week day by day (CSV)')
    );
  },
};

function median(xs) {
  const s = xs.filter((x) => x > 0).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}
