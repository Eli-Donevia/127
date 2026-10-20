// How far each target the member set is: this day, week or month so far, what is left and how
// often they hit it lately. Only their own numbers and their own targets; no forecasts.

const { views, save, files } = require('../../_kit');
const C = require('../lib/common');
const R = require('../lib/report');
const M = require('../lib/metrics');
const T = require('../lib/table');
const L = require('../lib/ledger');
const P = require('../lib/page');

const SAMPLE_TARGETS = 'Sales 800 a day\nOrders 90 a week\nRefund rate under 3%\nCost per result 15\nEmail signups 40 a week\nSales 22000 a month';

function monthStart(date) {
  return `${date.slice(0, 8)}01`;
}
function monthEnd(date) {
  const [y, m] = date.split('-').map(Number);
  return T.addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1);
}

module.exports = {
  name: 'kpi.goal_progress',
  title: 'Track your targets',
  description: "For each target the member set (on their scorecard or typed here), shows the day, week or month so far from their own exports, what is left, the daily amount that would close the gap, and how often they hit it lately. No forecasts.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, targets: C.TARGETS } },
  output: {
    type: 'object',
    properties: { asOf: { type: 'string' }, goals: { type: 'array' }, headline: { type: 'string' }, html: { type: ['object', 'null'] }, csv: { type: ['object', 'null'] }, ...C.OUT_COMMON },
    required: ['asOf', 'goals', 'headline', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const { day } = R.reportDay(d.led, d.today);
    const avail = M.available(d.led);
    const saved = (ctx.brain && ctx.brain.packs && ctx.brain.packs.kpi && ctx.brain.packs.kpi.scorecard) || {};
    const targets = { ...(saved.targets || {}) };
    // One metric can have a target per period (sales a day and a month): typed lines are kept per period.
    const lines = [];
    for (const [id, t] of Object.entries(targets)) lines.push({ id, ...t });
    for (const line of String(input.targets || '').split(/\r?\n|;/)) {
      const one = M.parseTargets(line, avail);
      for (const [id, t] of Object.entries(one)) {
        const i = lines.findIndex((x) => x.id === id && x.per === t.per);
        if (i >= 0) lines.splice(i, 1);
        lines.push({ id, ...t });
      }
    }
    let example = false;
    if (!lines.length && d.sample) {
      for (const line of SAMPLE_TARGETS.split('\n')) for (const [id, t] of Object.entries(M.parseTargets(line, avail))) lines.push({ id, ...t });
      example = true;
    }
    const goals = [];
    for (const g of lines) {
      const m = M.get(g.id, d.led);
      if (!m || !avail.some((x) => x.id === g.id)) continue;
      let from;
      let end;
      if (g.per === 'day') [from, end] = [day, day];
      else if (g.per === 'week') [from, end] = [L.weekStart(day), T.addDays(L.weekStart(day), 6)];
      else [from, end] = [monthStart(day), monthEnd(day)];
      const total = C.dayCount(from, end);
      const elapsed = C.dayCount(from, day);
      const left = total - elapsed;
      const actual = M.value(m, d.led, from, day);
      const sum = m.kind === 'sum';
      const up = m.better !== 'down';
      let status;
      let gap = '';
      let pct = null;
      if (actual == null) status = 'No data yet';
      else if (sum && up) {
        pct = g.value ? actual / g.value : null;
        if (actual >= g.value) status = 'Hit';
        else {
          status = actual >= g.value * (elapsed / total) ? 'On pace' : 'Behind';
          gap = left > 0 ? `${M.fmt(m, g.value - actual)} to go, about ${M.fmt(m, (g.value - actual) / left, { avg: true })} a day for the ${left} day${left === 1 ? '' : 's'} left` : `Missed by ${M.fmt(m, g.value - actual)}`;
        }
      } else if (sum) {
        pct = g.value ? actual / g.value : null;
        status = actual <= g.value ? (left ? 'Under so far' : 'Hit') : 'Over';
      } else {
        status = up ? (actual >= g.value ? 'Hit' : 'Below') : actual <= g.value ? 'Hit' : 'Above';
      }
      // How often the last 4 full periods hit it.
      const past = [];
      for (let i = 1; i <= 4; i++) {
        let a;
        let b;
        if (g.per === 'day') [a, b] = [T.addDays(day, -i), T.addDays(day, -i)];
        else if (g.per === 'week') [a, b] = [T.addDays(from, -7 * i), T.addDays(from, -7 * i + 6)];
        else {
          b = T.addDays(monthStart(i === 1 ? day : past[past.length - 1].from), -1);
          a = monthStart(b);
        }
        if (a < d.led.from) break;
        const v = M.value(m, d.led, a, b);
        past.push({ from: a, hit: v != null && (up ? v >= g.value : v <= g.value) });
      }
      const label = g.per === 'day' ? `${R.shortDay(day)}` : g.per === 'week' ? `Week so far (${C.shortRange(from, day)})` : `Month so far (${C.shortRange(from, day)})`;
      goals.push({ metric: m.label, period: label, per: g.per, actual: M.fmt(m, actual), target: M.targetText(m, g), status, pct: pct == null ? null : Math.round(pct * 100), gap, history: past.length ? `Hit ${past.filter((p) => p.hit).length} of the last ${past.length > 1 ? `${past.length} ${g.per}s` : g.per}` : '', line: sum ? `${M.fmt(m, actual)} of ${M.targetText(m, g)}` : `${M.fmt(m, actual)}, target ${M.targetText(m, g)}` });
    }
    const name = d.sample ? C.SAMPLE_NAME : (ctx.brain && ctx.brain.business && ctx.brain.business.name) || 'Your business';
    if (!goals.length) {
      return { asOf: day, goals: [], headline: 'No targets yet. Type one per line, like "Sales 400 a day" or "Orders 50 a week", or set them with "Set up my scorecard".', html: null, csv: null, sources: C.sources(d), notes: d.notes, sample: d.sample };
    }
    const hit = goals.filter((g) => g.status === 'Hit' || g.status === 'On pace' || g.status === 'Under so far').length;
    const headline = `${hit} of ${goals.length} target${goals.length === 1 ? '' : 's'} hit or on pace as of ${R.shortDay(day)}.${example ? ' These are example targets for the sample business.' : ''}`;
    const bar = (g) => (g.pct == null ? '' : `<div style="height:10px;background:var(--tint);border-radius:99px;overflow:hidden;margin-top:8px"><i style="display:block;height:100%;width:${Math.max(2, Math.min(100, g.pct))}%;background:var(--p)"></i></div>`);
    const body = `${d.sample ? `<section><div class="card"><p class="big">${P.esc(C.sampleLine)}</p></div></section>` : ''}
<section><h2>Your targets</h2><p class="lead">Every target is one you set. "On pace" means you are at least as far along as the days gone by.</p>
${goals.map((g) => `<div class="card"><span class="tag ${g.status === 'Hit' || g.status === 'On pace' ? 'p' : ''}">${P.esc(g.status)}</span><h3>${P.esc(g.metric)}: ${P.esc(g.line)}</h3><p class="muted">${P.esc(g.period)}${g.gap ? `. ${P.esc(g.gap)}` : ''}${g.history ? `. ${P.esc(g.history)}` : ''}.</p>${bar(g)}</div>`).join('')}</section>
<section><div class="card small muted"><p>${P.esc(C.sourcesLine(d))} ${P.esc(C.privacyLine)}</p></div></section>`;
    const html = P.page(ctx, { title: 'Your targets', kicker: 'Goal tracker', sub: headline, stats: goals.slice(0, 4).map((g) => ({ value: g.pct != null ? `${g.pct}%` : g.actual, label: g.metric })), body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'targets', day, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'targets', day, '.csv'), files.csv(goals, [{ key: 'metric', label: 'Number' }, { key: 'period', label: 'Period' }, { key: 'actual', label: 'So far' }, { key: 'target', label: 'Your target' }, { key: 'status', label: 'Status' }, { key: 'gap', label: 'Left' }, { key: 'history', label: 'Lately' }], { bom: true }));
    ctx.log(headline);
    return { asOf: day, goals, headline, html: htmlFile, csv: csvFile, sources: C.sources(d), notes: d.notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      out.goals.length ? views.cards(out.goals.map((g) => ({ title: `${g.metric}: ${g.line}`, subtitle: g.period, body: [g.gap, g.history].filter(Boolean).join('. '), badge: g.status }))) : null,
      views.file(out.html, 'Your targets (printable)'),
      views.file(out.csv, 'Your targets (CSV)')
    );
  },
};
