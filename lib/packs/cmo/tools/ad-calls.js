// Kill, keep or scale: one call per ad from the member's own ad exports, with the rule that made the
// call written next to it. Nothing changes in their ads account: each call is a step they take in
// Meta Ads Manager or Google Ads. Pure code; the rules live in data/rules.json.
// Legal L76 D9: each call is a suggestion with the change, the numbers behind it and its spend
// effect; no automatic rules and no "approve all"; the yardstick is the member's own max cost per
// customer (typed, or saved on their kpi scorecard), never a promised result. D10: only this
// member's numbers, never a benchmark.

const { views, save, files } = require('../../_kit');
const { C, R, P, T, X, nameOf, wrap } = require('../lib/base');
const RULES = require('../data/rules.json').ads;
const { TARGET } = require('./whats-working');

const CALLS = {
  early: { label: 'Too early', order: 4 },
  kill: { label: 'Pause', order: 0 },
  fix: { label: 'Fix', order: 1 },
  scale: { label: 'Scale', order: 2 },
  keep: { label: 'Keep', order: 3 },
};

function ruleLines(t) {
  const u = (k) => X.usd(t * k);
  return [
    `Too early: fewer than ${RULES.early_results} results and under ${u(RULES.early_spend_times)} spent (${RULES.early_spend_times} times your target). Leave it alone.`,
    `Pause: ${u(RULES.kill_spend_times)} or more spent (${RULES.kill_spend_times} times your target) with no results, or over ${u(RULES.kill_cpr_times)} per result (${RULES.kill_cpr_times} times your target) over ${RULES.window} days and the last ${RULES.recent}.`,
    `Fix: over your target per result, and a click rate under ${Math.round(RULES.fix_ctr_times * 100)}% of your ads' middle (change the picture or first line), or clicks that turn into results at under ${Math.round(RULES.fix_cvr_times * 100)}% of your middle (check the page after the click).`,
    `Scale: ${RULES.scale_results} or more results at ${u(RULES.scale_cpr_times)} or less (${Math.round(RULES.scale_cpr_times * 100)}% of your target), and the last ${RULES.recent} days at or under target. Raise its budget by up to ${Math.round(RULES.scale_raise * 100)}%, then wait 3 days.`,
    'Keep: everything else. Leave it running and look again next week.',
  ];
}

// One call for one ad, with the rule it met. a = the window, r = the recent days (null without a day breakdown).
function call(a, r, t, mid) {
  if (a.results < RULES.early_results && a.spend < t * RULES.early_spend_times) return { call: 'early', rule: `${X.r0(a.results)} results and ${X.usd(a.spend)} spent: under ${RULES.early_results} results and ${X.usd(t * RULES.early_spend_times)}.` };
  if (a.results < 0.5 && a.spend >= t * RULES.kill_spend_times) return { call: 'kill', rule: `${X.usd(a.spend)} spent with no results: ${RULES.kill_spend_times} times your target is ${X.usd(t * RULES.kill_spend_times)}.` };
  const recent = r && r.cpr != null ? r.cpr : r && r.spend >= t ? Infinity : null;
  if (a.cpr != null && a.cpr >= t * RULES.kill_cpr_times && (recent == null || recent >= t * RULES.kill_cpr_times)) return { call: 'kill', rule: `${X.usd(a.cpr)} per result over ${RULES.window} days${recent != null && Number.isFinite(recent) ? ` and ${X.usd(recent)} over the last ${RULES.recent}` : ''}: over ${X.usd(t * RULES.kill_cpr_times)}.` };
  const over = a.cpr == null || a.cpr > t;
  if (over && mid.ctr && a.ctr != null && a.impressions >= RULES.min_impressions && a.ctr < mid.ctr * RULES.fix_ctr_times) return { call: 'fix', rule: `Click rate ${X.pct(a.ctr)} against your middle of ${X.pct(mid.ctr)}, and over target per result. Change the picture or the first line.` };
  if (over && mid.cvr && a.cvr != null && a.clicks >= 30 && a.cvr < mid.cvr * RULES.fix_cvr_times) return { call: 'fix', rule: `${X.pct(a.cvr)} of clicks become results against your middle of ${X.pct(mid.cvr)}. Check the page people land on: price, photos, how fast it loads.` };
  if (a.cpr != null && a.results >= RULES.scale_results && a.cpr <= t * RULES.scale_cpr_times && (recent == null || recent <= t)) return { call: 'scale', rule: `${X.r0(a.results)} results at ${X.usd(a.cpr)}${recent != null && Number.isFinite(recent) ? `, ${X.usd(recent)} over the last ${RULES.recent} days` : ''}: at or under ${X.usd(t * RULES.scale_cpr_times)}.` };
  return { call: 'keep', rule: a.cpr != null ? `${X.usd(a.cpr)} per result: between the pause and scale lines.` : 'Not enough to call either way.' };
}

const SAMPLE_TARGET = 15;

// What the change does to spend, from the ad's own recent spend a day. Never a forecast of results.
function spendEffect(id, perDay) {
  const day = (n) => X.usd(n >= 10 ? Math.round(n) : Math.round(n * 100) / 100);
  if (id === 'kill') return perDay ? `About ${day(perDay)} less spent each day (its spend lately), unless you move it to another ad.` : 'Its daily spend stops, unless you move it to another ad.';
  if (id === 'scale') return perDay ? `Up to ${day(perDay * RULES.scale_raise)} more spent each day (${Math.round(RULES.scale_raise * 100)}% of its ${day(perDay)} a day lately).` : `Up to ${Math.round(RULES.scale_raise * 100)}% more spent each day.`;
  if (id === 'fix') return 'No change to spend while the new version runs on the same budget.';
  return 'No change to spend.';
}

const STEP = {
  early: 'Leave it. Look again when it has spent twice your target.',
  kill: 'Pause it in your ads account. Move its budget to a Scale ad or keep it.',
  fix: 'Make a copy with a new picture or first line (or fix the page), and pause the old one when the copy has spent twice your target.',
  scale: 'Raise its daily budget by up to 20% in your ads account, then leave it 3 days before the next change.',
  keep: 'Leave it running.',
};

module.exports = {
  name: 'cmo.ad_calls',
  title: 'Kill, keep or scale ads',
  description: "One call per ad (pause, fix, keep, scale or too early) from the member's own Meta Ads or Google Ads exports over the last 14 days, with the rule that made each call shown next to it. 127 never changes an ad; the member makes each change in their ads account.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: { type: 'object', properties: { files: C.FILES, target: TARGET } },
  output: {
    type: 'object',
    properties: { calls: { type: 'array' }, counts: { type: 'object' }, target: { type: 'object' }, rules: { type: 'array' }, headline: { type: 'string' }, html: { type: 'object' }, csv: { type: 'object' }, ...C.OUT_COMMON },
    required: ['calls', 'counts', 'target', 'rules', 'headline', 'html', 'csv', 'sample'],
  },
  call,
  spendEffect,
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const cover = d.led.cover.ads || d.led.cover.adsSpread;
    if (!cover) throw new Error('Ad calls need an ad report. Add a Meta Ads or Google Ads export (CSV), with a Day breakdown if you can.');
    const to = cover.to;
    const from = T.addDays(to, -(RULES.window - 1));
    const recentFrom = T.addDays(to, -(RULES.recent - 1));
    const all = X.ads(d.records, from, to);
    if (!all.length) throw new Error(`No ad spend between ${R.shortDay(from)} and ${R.shortDay(to)} in your files.`);
    const recent = d.led.cover.ads ? X.ads(d.records.filter((r) => r.t !== 'ad' || r.from === r.to), recentFrom, to) : [];
    // The member's own max cost per customer: typed, or saved on their scorecard. Sample runs use a
    // labeled sample one. Never an average of other businesses, and never a promise.
    let target = X.cprTarget(ctx, input.target, []);
    if (!target && d.sample) target = { value: SAMPLE_TARGET, from: 'a sample max cost per customer', own: false };
    if (!target) throw new Error('Type your max cost per customer: the most you would pay in ads for one result (a sale, booking or sign-up). Each call is judged against your own number.');
    const mid = { ctr: X.median(all.filter((a) => a.impressions >= RULES.min_impressions && a.ctr != null).map((a) => a.ctr)), cvr: X.median(all.filter((a) => a.clicks >= 30 && a.cvr != null).map((a) => a.cvr)) };
    const calls = all.map((a) => {
      const r = recent.find((x) => x.key === a.key) || null;
      const c = call(a, d.led.cover.ads ? r : null, target.value, mid);
      const perDay = r && r.days ? r.spend / r.days : a.days ? a.spend / a.days : 0;
      return { ad: a.name, campaign: a.campaign, where: a.where, call: CALLS[c.call].label, id: c.call, spend: X.usd(X.r0(a.spend)), results: X.r0(a.results), cpr: a.cpr == null ? 'no results' : X.usd(a.cpr), recent: r && r.cpr != null ? X.usd(r.cpr) : r ? 'no results' : '', ctr: a.ctr == null ? '' : X.pct(a.ctr), rule: c.rule, step: STEP[c.call], spendEffect: spendEffect(c.call, perDay) };
    }).sort((a, b) => CALLS[a.id].order - CALLS[b.id].order);
    const counts = Object.fromEntries(Object.keys(CALLS).map((k) => [CALLS[k].label, calls.filter((c) => c.id === k).length]));
    const headline = `${calls.length} ad${calls.length === 1 ? '' : 's'} over ${C.shortRange(from, to)}: ${Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ')}. Target ${X.usd(target.value)} per result, ${target.from}.`;
    const rules = ruleLines(target.value);
    const notes = [...d.notes];
    if (!d.led.cover.ads) notes.push(`Your ad export has no Day breakdown, so the last ${RULES.recent} days can't be checked on their own. Export with Breakdown, By time, Day for sharper calls.`);
    if (new Set(all.map((a) => a.src)).size > 1) notes.push('Meta and Google count results their own way (Meta its chosen result, Google conversions), so compare each ad with your target, not with ads on the other platform.');
    const name = nameOf(ctx, d);
    const cls = (r) => (r.id === 'scale' ? 'good' : r.id === 'kill' ? 'bad' : '');
    const body = wrap(d, `<section><h2>The calls</h2><p class="lead">Each ad over the last ${RULES.window} days of your export, against ${P.esc(X.usd(target.value))} per result (${P.esc(target.from)}).</p>
${calls.map((c) => `<div class="card"><span class="tag ${c.id === 'scale' ? 'p' : ''}">${P.esc(c.call)}: a suggestion</span><h3>${P.esc(c.ad)}</h3><p class="muted small">${P.esc(c.where)}${c.campaign !== c.ad ? `, ${P.esc(c.campaign)}` : ''}. ${P.esc(c.spend)} spent, ${c.results} results${c.results ? `, ${P.esc(c.cpr)} per result` : ''}.</p><p><b>Rule:</b> ${P.esc(c.rule)}</p><p><b>Your step, if you agree:</b> ${P.esc(c.step)}</p><p><b>Spend effect:</b> ${P.esc(c.spendEffect)}</p></div>`).join('')}</section>
<section><h2>Every ad</h2>${P.table([{ key: 'ad', label: 'Ad' }, { key: 'where', label: 'Where' }, { key: 'call', label: 'Call', cls }, { key: 'spend', label: 'Spent', n: true }, { key: 'results', label: 'Results', n: true }, { key: 'cpr', label: 'Per result', n: true }, { key: 'recent', label: `Last ${RULES.recent} days`, n: true }, { key: 'ctr', label: 'Click rate', n: true }], calls)}</section>
<section><h2>The rules</h2><div class="card">${P.list(rules)}</div></section>`, notes);
    const html = P.page(ctx, { title: 'Kill, keep or scale', kicker: 'Your ads', sub: headline, stats: Object.entries(counts).filter(([, n]) => n).slice(0, 4).map(([k, n]) => ({ value: String(n), label: k.toLowerCase() })), body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'ad calls', to, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'ad calls', to, '.csv'), files.csv(calls, [{ key: 'ad', label: 'Ad' }, { key: 'campaign', label: 'Campaign' }, { key: 'where', label: 'Where' }, { key: 'call', label: 'Call' }, { key: 'spend', label: 'Spent' }, { key: 'results', label: 'Results' }, { key: 'cpr', label: 'Per result' }, { key: 'recent', label: `Last ${RULES.recent} days per result` }, { key: 'ctr', label: 'Click rate' }, { key: 'rule', label: 'Rule' }, { key: 'step', label: 'Your step, if you agree' }, { key: 'spendEffect', label: 'Spend effect' }], { bom: true }));
    ctx.log(headline);
    return { calls: calls.map(({ id, ...c }) => c), counts, target, rules, headline, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards(out.calls.map((c) => ({ title: c.ad, subtitle: `${c.where}, ${c.spend} spent, ${c.results ? `${c.cpr} per result` : 'no results'}`, badge: c.call, body: `${c.rule} If you agree: ${c.step} Spend effect: ${c.spendEffect}` }))),
      views.text('127 never changes your ads. Make each change in Meta Ads Manager or Google Ads.'),
      views.file(out.html, 'Ad calls (printable)'),
      views.file(out.csv, 'Ad calls (CSV)')
    );
  },
};
