// Monthly marketing review: the last full month against the one before, from the member's own
// exports: sales, ads and posts side by side, the posts, ads and products that did the work and the
// ones that didn't (with reasons), what to keep and what to change. Pure code.

const { views, save, files } = require('../../_kit');
const { C, R, M, P, T, X, nameOf, wrap } = require('../lib/base');
const { analyse } = require('./whats-working');

const IDS = ['sales', 'orders', 'aov', 'ad_spend', 'ad_results', 'cost_per_result', 'click_rate', 'ad_return', 'posts', 'post_views', 'engagement', 'follows'];

module.exports = {
  name: 'cmo.monthly_review',
  title: 'Monthly marketing review',
  description: "The member's last full month against the month before, from their own exports: sales, ads and posts side by side, the posts, ads and products that did the most and least with plain reasons, and what to keep and change next month. Advice only.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 2,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, target: require('./whats-working').TARGET } },
  output: {
    type: 'object',
    properties: { month: { type: 'string' }, rows: { type: 'array' }, keep: { type: 'array' }, change: { type: 'array' }, findings: { type: 'array' }, mix: { type: 'array' }, headline: { type: 'string' }, html: { type: 'object' }, csv: { type: 'object' }, ...C.OUT_COMMON },
    required: ['month', 'rows', 'keep', 'change', 'findings', 'mix', 'headline', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const span = X.monthSpan(d.led);
    if (d.led.from > span.to) throw new Error(`Your files start on ${R.longDay(d.led.from)}, after the last full month ended. Export at least one full month to review it.`);
    const daysIn = T.daysBetween(span.from, span.to) + 1;
    const metrics = IDS.map((id) => M.get(id, d.led)).filter((m) => m && M.available(d.led).some((x) => x.id === m.id));
    const hasBase = d.led.from <= span.baseTo;
    const rows = R.compare(d.led, metrics, { ...span, per: 'total', scale: daysIn });
    const a = analyse(ctx, d, input, { ...span, weeks: 4 });
    const notes = [...a.notes];
    if (!hasBase) notes.unshift(`Your files start in ${span.monthName}, so there is no ${span.baseName} to compare with. Add older exports to see the change.`);
    else if (d.led.from > span.baseFrom) notes.unshift(`Your files start on ${R.longDay(d.led.from)}, partway through ${span.baseName}, so ${span.baseName} is scaled to a full month for the comparison.`);
    const table = rows.map((r) => ({ metric: r.label, month: r.nowText, before: hasBase ? r.baseText : '', change: hasBase ? r.changeText || 'no change' : '', verdict: hasBase ? r.verdict : '' }));
    // Mix of what was posted.
    const ps = X.posts(d.records, span).now;
    const mixMap = new Map();
    for (const p of ps) mixMap.set(p.kind, (mixMap.get(p.kind) || 0) + 1);
    const mix = [...mixMap.entries()].map(([k, n]) => ({ kind: X.kindLabel(k), posts: n, share: `${Math.round((n / ps.length) * 100)}%` })).sort((x, y) => y.posts - x.posts);
    // Keep and change: what worked, what slipped, and the numbers that moved most.
    const keep = a.findings.filter((f) => f.side === 'top').slice(0, 4).map((f) => `${f.area}, ${f.name}: ${f.number}. ${f.why}`);
    const change = a.findings.filter((f) => f.side === 'bottom').slice(0, 4).map((f) => `${f.area}, ${f.name}: ${f.number}. ${f.why}`);
    if (hasBase) {
      const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
      const big = rows.filter((r) => r.change != null && Math.abs(r.change) >= 0.15 && r.verdict && r.verdict !== 'flat').sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
      for (const r of big.slice(0, 3)) {
        const line = `${r.label}: ${r.nowText} in ${span.monthName.split(' ')[0]}, ${r.changeText} on ${span.baseName} (${r.baseText}${byId[r.id].kind === 'sum' ? ' for the same number of days' : ''}).`;
        (r.verdict === 'good' ? keep : change).push(line);
      }
    }
    if (!keep.length) keep.push('Nothing stood well above your usual this month. Keep your steadiest posts and ads going.');
    if (!change.length) change.push('Nothing fell well below your usual this month.');
    const lead = rows[0];
    const headline = lead ? `${span.monthName}: ${lead.label.toLowerCase()} ${lead.nowText}${hasBase && lead.changeText ? `, ${lead.changeText} on ${span.baseName}` : ''}. ${a.findings.filter((f) => f.side === 'top').length} things worked, ${a.findings.filter((f) => f.side === 'bottom').length} to change.` : `${span.monthName} in review.`;
    const name = nameOf(ctx, d);
    const cls = (r) => (r.verdict === 'good' ? 'good' : r.verdict === 'bad' ? 'bad' : '');
    const body = wrap(d, `<section><h2>Keep doing</h2>${keep.map((k) => `<div class="card"><p>${P.esc(k)}</p></div>`).join('')}</section>
<section><h2>Change next month</h2>${change.map((k) => `<div class="card"><p>${P.esc(k)}</p></div>`).join('')}</section>
<section><h2>The month in numbers</h2>${P.table([{ key: 'metric', label: 'Number' }, { key: 'month', label: span.monthName.split(' ')[0], n: true }, { key: 'before', label: span.baseName, n: true }, { key: 'change', label: 'Change', n: true, cls }], table)}<p class="muted small">${P.esc(span.baseName)} totals are scaled to the same number of days.</p></section>
${mix.length ? `<section><h2>What you posted</h2>${P.table([{ key: 'kind', label: 'Kind' }, { key: 'posts', label: 'Posts', n: true }, { key: 'share', label: 'Share', n: true }], mix)}</section>` : ''}
${a.posts.top.length ? `<section><h2>Best posts</h2>${P.table([{ key: 'post', label: 'Post' }, { key: 'where', label: 'Where' }, { key: 'day', label: 'Posted' }, { key: 'views', label: 'Views', n: true }, { key: 'vsUsual', label: '', n: true }], a.posts.top)}</section>` : ''}
${a.products.top.length ? `<section><h2>Best sellers</h2>${P.table([{ key: 'name', label: 'Product' }, { key: 'units', label: 'Sold', n: true }, { key: 'sales', label: 'Sales', n: true }, { key: 'usual', label: 'Usual', n: true }], a.products.top)}</section>` : ''}`, notes);
    const html = P.page(ctx, { title: `${span.monthName} marketing review`, kicker: 'Monthly review', sub: headline, stats: rows.slice(0, 4).map((r) => ({ value: r.nowText, label: r.label })), body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'marketing review', span.from, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'marketing review', span.from, '.csv'), files.csv(rows.map((r) => ({ metric: r.label, month: r.now == null ? '' : Math.round(r.now * 100) / 100, before: !hasBase || r.base == null ? '' : Math.round(r.base * 100) / 100, change: hasBase && r.change != null ? `${Math.round(r.change * 1000) / 10}%` : '' })), [{ key: 'metric', label: 'Number' }, { key: 'month', label: span.monthName }, { key: 'before', label: `${span.baseName} (same days)` }, { key: 'change', label: 'Change' }], { bom: true }));
    ctx.log(headline);
    return { month: `${span.from} to ${span.to}`, rows: table, keep, change, findings: a.findings, mix, headline, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards([...out.keep.map((k) => ({ title: 'Keep doing', body: k })), ...out.change.map((k) => ({ title: 'Change', body: k }))]),
      views.table([{ key: 'metric', label: 'Number' }, { key: 'month', label: 'This month' }, { key: 'before', label: 'Month before' }, { key: 'change', label: 'Change' }], out.rows),
      views.file(out.html, 'Monthly review (printable)'),
      views.file(out.csv, 'The month in numbers (CSV)')
    );
  },
};
