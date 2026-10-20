// Saves the numbers the member picked and the targets they set, so the daily and weekly reports,
// the goal tracker and the numbers skill all read the same scorecard. Makes a one-page scorecard
// and a sheet with a column to fill in each day.

const { views, save, files, brain } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const M = require('../lib/metrics');
const P = require('../lib/page');

module.exports = {
  name: 'kpi.save_scorecard',
  title: 'Save your scorecard',
  description: 'Keeps the 5 to 8 numbers the member picked and the targets they typed, in their own words, for the daily report, weekly report, goal tracker and numbers skill. Makes a printable scorecard and a tracking sheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['picks'],
    properties: {
      picks: { type: 'array', items: { type: 'object' }, title: 'The numbers you picked' },
      type: { type: 'string', title: 'Kind of business' },
      targets: C.TARGETS,
      sample: { type: ['boolean', 'null'] },
    },
  },
  output: {
    type: 'object',
    properties: { metrics: { type: 'array' }, noTarget: { type: 'array' }, html: { type: 'object' }, csv: { type: 'object' }, sample: { type: 'boolean' } },
    required: ['metrics', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const picks = (input.picks || []).filter((p) => p && p.id && p.label).slice(0, 8);
    if (!picks.length) throw new Error('Pick at least one number for your scorecard.');
    const ms = picks.map((p) => M.get(p.id) || { id: p.id, ...M.custom(p.id, p.label) });
    const targets = M.parseTargets(input.targets, ms);
    const metrics = picks.map((p, i) => {
      const t = targets[p.id];
      return { id: p.id, label: p.label, last7: p.last7 || '', target: t ? M.targetText(ms[i], t) : '', why: p.why || '' };
    });
    const noTarget = metrics.filter((m) => !m.target).map((m) => m.label);
    const keep = { type: input.type || 'other', metrics: picks.map((p) => p.id), targets, on: R.todayIn(ctx) };
    // Sample runs never overwrite a real scorecard.
    if (!input.sample) await brain.remember(ctx, 'scorecard', keep);
    const name = input.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business';
    const body = `<section><h2>The numbers</h2><p class="lead">Read them each morning in this order. Every target is yours.</p>
${P.table([{ key: 'label', label: 'Number' }, { key: 'target', label: 'Your target' }, { key: 'last7', label: 'Last 7 days' }, { key: 'why', label: 'Why it is here' }], metrics.map((m) => ({ ...m, target: m.target || 'Set one' })))}</section>
${noTarget.length ? `<section><div class="card"><p class="big">No target yet for ${P.esc(noTarget.join(', '))}.</p><p class="muted">Run this again with a line for each, like "${P.esc(noTarget[0])} ${P.esc(example(ms.find((m) => m.label === noTarget[0])))}". Pick a number you can reach with what you control: posts, offers, follow-ups.</p></div></section>` : ''}
<section><h2>How to use it</h2><div class="card">${P.list(['Each morning, run "Daily numbers report" with yesterday\'s exports. It compares every number here with the 7 days before.', 'Each Monday, run "Weekly numbers report" for last week against the 4 weeks before.', 'Run "Goal tracker" any time to see how far each target is.', 'Change a target? Run "Set up my scorecard" again. The newest one is used.'])}</div></section>`;
    const html = P.page(ctx, { title: 'Your scorecard', kicker: 'Daily numbers', sub: `${metrics.length} numbers you picked, with the targets you set.`, stats: metrics.slice(0, 4).map((m) => ({ value: m.target || 'Set one', label: m.label })), body, foot: `${name}. Saved ${R.longDay(keep.on)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'scorecard', '.html'), html);
    const cols = [{ key: 'date', label: 'Date' }, ...metrics.map((m) => ({ key: m.id, label: m.label }))];
    const csvText = files.csv([{ date: 'Your target', ...Object.fromEntries(metrics.map((m) => [m.id, m.target])) }, { date: keep.on }], cols, { bom: true });
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'scorecard', '.csv'), csvText);
    ctx.log(`Saved ${metrics.length} numbers, ${metrics.length - noTarget.length} with a target.`);
    return { metrics, noTarget, html: htmlFile, csv: csvFile, sample: !!input.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('Sample run: this scorecard was not saved. Run it with your own exports to keep yours.') : views.text('Saved. Your daily and weekly reports, goal tracker and numbers skill use this scorecard now.'),
      views.table([{ key: 'label', label: 'Number' }, { key: 'target', label: 'Your target' }, { key: 'last7', label: 'Last 7 days' }], out.metrics.map((m) => ({ ...m, target: m.target || 'Set one' })), 8),
      out.noTarget.length ? views.text(`No target yet for ${out.noTarget.join(', ')}. Run it again with a line for each, like "Orders 8 a day".`) : null,
      views.file(out.html, 'Your scorecard (printable)'),
      views.file(out.csv, 'A tracking sheet with your targets on top')
    );
  },
};

function example(m) {
  if (!m) return '10 a week';
  if (m.unit === 'percent') return 'under 3%';
  if (m.unit === 'money' && m.kind !== 'sum') return m.better === 'down' ? 'at most 12' : '45';
  if (m.unit === 'money') return '300 a day';
  return '10 a week';
}
