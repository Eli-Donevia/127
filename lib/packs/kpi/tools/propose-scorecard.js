// The numbers worth watching for this kind of business, from what the member's own files can show.
// The member picks 5 to 8 in the next step and sets every target themselves.

const { views } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const M = require('../lib/metrics');
const T = require('../lib/table');

module.exports = {
  name: 'kpi.propose_scorecard',
  title: 'Suggest scorecard numbers',
  description: "Lists the numbers worth watching for the member's kind of business that their own exports can show, with their last 7 days of each, best picks first. Nothing is set until the member picks.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, type: C.TYPE } },
  output: {
    type: 'object',
    properties: { type: { type: 'string' }, typeLabel: { type: 'string' }, options: { type: 'array' }, missing: { type: 'array' }, ...C.OUT_COMMON },
    required: ['options', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const tid = input.type && input.type !== 'Not sure' ? R.typeByLabel(input.type, ctx.brain) : R.guessType(ctx.brain);
    const type = R.typeOf(tid) || R.typeOf('other');
    const avail = M.available(d.led);
    const to = d.led.to;
    const from = T.addDays(to, -6);
    const why = (m) => R.CARDS.why[m.custom ? 'custom' : m.id] || '';
    const last7 = (m) => {
      const total = M.value(m, d.led, from, to);
      if (total == null) return 'none yet';
      if (m.kind !== 'sum') return M.fmt(m, total);
      const perDay = M.value(m, d.led, from, to, { per: 'day' });
      return `${M.fmt(m, total)} (${M.fmt(m, perDay, { avg: true })} a day)`;
    };
    const rec = type.metrics.filter((id) => avail.some((m) => m.id === id));
    const order = [...rec, ...avail.map((m) => m.id).filter((id) => !rec.includes(id) && id !== 'ad_spend')];
    const options = order.slice(0, 16).map((id) => {
      const m = avail.find((x) => x.id === id);
      return { id, label: m.label, why: why(m), last7: last7(m), suggested: rec.includes(id), from: m.from };
    });
    const missing = type.metrics.filter((id) => !rec.includes(id)).map((id) => ({ id, label: M.METRICS[id].label, how: `Add your ${M.METRICS[id].from}.` }));
    ctx.log(`${options.length} numbers your files can show; ${rec.length} suggested for ${type.label.toLowerCase()}.`);
    return { type: type.id, typeLabel: type.label, options, missing, sources: C.sources(d), notes: d.notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(`For ${out.typeLabel.toLowerCase()}, these are the numbers your files can show, best picks first. Pick 5 to 8 in the next step.`),
      views.table([{ key: 'label', label: 'Number' }, { key: 'last7', label: 'Last 7 days' }, { key: 'why', label: 'Why watch it' }], out.options.map((o) => ({ ...o, label: o.suggested ? `${o.label} (suggested)` : o.label })), 16),
      out.missing.length ? views.text(`Also worth watching, once you add the export: ${out.missing.map((m) => m.label).join(', ')}.`) : null
    );
  },
};
