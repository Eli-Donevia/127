// Yesterday's numbers against the 7 days before, what moved and why, and one next step. Pure code:
// the member's numbers never go to an AI.

const { views, save, files } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const M = require('../lib/metrics');
const T = require('../lib/table');
const P = require('../lib/page');

module.exports = {
  name: 'kpi.daily_report',
  title: 'Daily numbers report',
  description: "Reads the member's own exports (Stripe, Shopify, Square, PayPal, Meta Ads, Google Ads, Instagram, TikTok or a sheet) and compares yesterday with the 7 days before for every number on their scorecard: what moved, the reason in their own numbers, and one next step.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: { files: C.FILES, type: C.TYPE, targets: C.TARGETS },
  },
  output: {
    type: 'object',
    properties: {
      day: { type: 'string' },
      base: { type: 'string' },
      rows: { type: 'array' },
      moved: { type: 'array' },
      next: { type: 'object' },
      headline: { type: 'string' },
      stale: { type: 'integer' },
      html: { type: 'object' },
      csv: { type: 'object' },
      ...C.OUT_COMMON,
    },
    required: ['day', 'rows', 'moved', 'next', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const { day, stale } = R.reportDay(d.led, d.today);
    const sc = R.scorecard(ctx, d.led, input);
    const notes = [...d.notes];
    let metrics = sc.metrics;
    if (!d.led.cover.ads && metrics.some((m) => m.group === 'ads')) {
      metrics = metrics.filter((m) => m.group !== 'ads');
      notes.push('Your ads export has no day-by-day rows, so ads are left out of the daily report. In Ads Manager pick Breakdown, By time, Day (in Google Ads, Segment, Time, Day) before you export.');
    }
    const baseFrom = T.addDays(day, -7);
    const baseTo = T.addDays(day, -1);
    const span = { from: day, to: day, baseFrom, baseTo, per: 'day' };
    const rows = R.compare(d.led, metrics, { ...span, targets: sc.targets, targetPer: 'day' });
    const mv = R.moved(rows, metrics).slice(0, 3);
    for (const r of mv) r.why = R.reason(r, metrics.find((m) => m.id === r.id), d.led, d.records, span);
    const next = R.nextStep(rows, metrics, d.records, span);
    if (stale) notes.unshift(`Your newest numbers are from ${R.longDay(day)}, ${stale} day${stale === 1 ? '' : 's'} before yesterday. Export again to see yesterday.`);
    if (sc.missing.length) notes.push(`Not in these files: ${sc.missing.map((id) => (M.get(id) || { label: id }).label).join(', ')}. Add the export it comes from to see it.`);
    const lead = rows[0];
    const headline = lead ? `${lead.label} ${R.shortDay(day)}: ${lead.nowText}${lead.changeText ? `, ${lead.changeText} on the 7-day average (${lead.baseText})` : ` (7-day average ${lead.baseText})`}.` : `Numbers for ${R.shortDay(day)}.`;

    const table = rows.map((r) => ({ metric: r.label, day: r.nowText, avg: r.baseText, change: r.changeText || 'no change to compare', target: r.targetText || '', verdict: r.verdict, hit: r.hit == null ? '' : r.hit ? 'Hit' : 'Missed' }));
    const csvText = files.csv(rows.map((r) => ({ date: day, metric: r.label, value: r.now == null ? '' : Math.round(r.now * 100) / 100, avg7: r.base == null ? '' : Math.round(r.base * 100) / 100, change: r.change == null ? '' : `${Math.round(r.change * 100)}%`, target: r.target == null ? '' : Math.round(r.target * 100) / 100 })), [{ key: 'date', label: 'Date' }, { key: 'metric', label: 'Number' }, { key: 'value', label: 'Value' }, { key: 'avg7', label: '7-day average' }, { key: 'change', label: 'Change' }, { key: 'target', label: 'Your target' }], { bom: true });
    const cls = (r) => (r.verdict === 'good' ? 'good' : r.verdict === 'bad' ? 'bad' : '');
    const body = `${d.sample ? `<section><div class="card"><p class="big">${P.esc(C.sampleLine)}</p></div></section>` : ''}
<section><h2>Next step</h2><div class="card"><p class="big">${P.esc(next.text)}</p><p class="muted">${P.esc(next.why)}</p></div></section>
<section><h2>What moved</h2>${mv.length ? mv.map((r) => `<div class="card"><span class="tag ${r.verdict === 'good' ? 'p' : ''}">${P.esc(r.label)}</span><p>${P.esc(r.why)}</p></div>`).join('') : '<div class="card"><p>Nothing moved much. Every number is close to its 7-day average.</p></div>'}</section>
<section><h2>Your scorecard</h2><p class="lead">${P.esc(R.longDay(day))} against the 7 days before (${P.esc(C.shortRange(baseFrom, baseTo))}).${sc.saved ? '' : ' Pick your own numbers and targets with "Set up my scorecard".'}</p>
${P.table([{ key: 'metric', label: 'Number' }, { key: 'day', label: 'Yesterday', n: true }, { key: 'avg', label: '7-day average', n: true }, { key: 'change', label: 'Change', n: true, cls }, { key: 'target', label: 'Your target', n: true }], table)}</section>
${notes.length ? `<section><h2>Notes</h2><div class="card">${P.list(notes)}</div></section>` : ''}
<section><div class="card small muted"><p>${P.esc(C.sourcesLine(d))} ${P.esc(C.privacyLine)}</p></div></section>`;
    const name = d.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business';
    const html = P.page(ctx, { title: `Your numbers for ${R.shortDay(day)}`, kicker: 'Daily numbers', sub: headline, stats: rows.slice(0, 4).map((r) => ({ value: r.nowText, label: r.label })), body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'numbers', day, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'numbers', day, '.csv'), csvText);
    ctx.log(`Compared ${rows.length} numbers for ${day}.`);
    return { day, base: `${baseFrom} to ${baseTo}`, rows: table, moved: mv.map((r) => ({ metric: r.label, verdict: r.verdict, text: r.why })), next, headline, stale, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards([{ title: 'Next step', body: `${out.next.text} ${out.next.why}` }, ...out.moved.map((m) => ({ title: m.metric, body: m.text, badge: m.verdict === 'good' ? 'Up' : m.verdict === 'bad' ? 'Watch' : '' }))]),
      views.table([{ key: 'metric', label: 'Number' }, { key: 'day', label: 'Yesterday' }, { key: 'avg', label: '7-day avg' }, { key: 'change', label: 'Change' }, { key: 'target', label: 'Target' }], out.rows, 10),
      out.notes.length ? views.text(out.notes.join(' ')) : null,
      views.file(out.html, 'Your daily numbers (printable)'),
      views.file(out.csv, 'The same numbers as a CSV')
    );
  },
};
