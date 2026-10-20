// Budget split: the member's own ad budget across their campaigns, from their own last 4 weeks.
// Campaigns that got results for less get a bigger share, but no share moves more than half of where
// it is; campaigns spending with nothing back go to zero; a slice stays for testing. No forecast of
// results: only the split and the rule. 127 never changes a budget.

const { views, save, files } = require('../../_kit');
const { C, R, P, T, X, nameOf, wrap } = require('../lib/base');
const RULES = require('../data/rules.json').budget;
const { TARGET } = require('./whats-working');

// Spend against the pace of the last weeks, for one period. Never a forecast of results.
function effect(diff, per) {
  if (Math.abs(diff) < 1) return 'About the same spend as lately.';
  return `About ${X.usd(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} spent each ${per} than lately.`;
}

module.exports = {
  name: 'cmo.budget_split',
  title: 'Split your ad budget',
  description: "Splits the member's own ad budget across their campaigns from their last 4 weeks of Meta Ads and Google Ads exports: more to campaigns that got results for less, nothing to those that spent with nothing back, a slice kept for testing, and no share moved more than half. The rule is shown; nothing is changed and no results are forecast.",
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      budget: { type: 'string', title: 'Your ad budget', maxLength: 20, description: 'Like "1200". Left empty: what you spent over the same stretch.' },
      per: { type: 'string', title: 'Budget per', enum: ['month', 'week'], default: 'month' },
      target: TARGET,
      files: C.FILES,
    },
  },
  output: {
    type: 'object',
    properties: { budget: { type: 'number' }, per: { type: 'string' }, rows: { type: 'array' }, test: { type: 'object' }, rules: { type: 'array' }, headline: { type: 'string' }, html: { type: 'object' }, csv: { type: 'object' }, ...C.OUT_COMMON },
    required: ['budget', 'per', 'rows', 'test', 'rules', 'headline', 'html', 'csv', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const cover = d.led.cover.ads || d.led.cover.adsSpread;
    if (!cover) throw new Error('The budget split reads your ad reports. Add a Meta Ads or Google Ads export (CSV).');
    const per = input.per === 'week' ? 'week' : 'month';
    const to = cover.to;
    const from = T.addDays(to, -(RULES.window - 1));
    // By campaign (ads rolled up), over the window.
    const map = new Map();
    for (const a of X.ads(d.records, from, to)) {
      const k = `${a.src}|${a.campaign}`;
      const c = map.get(k) || { name: a.campaign, where: a.where, spend: 0, results: 0, value: 0 };
      c.spend += a.spend;
      c.results += a.results;
      c.value += a.value;
      map.set(k, c);
    }
    const camps = [...map.values()].filter((c) => c.spend > 0);
    if (!camps.length) throw new Error(`No ad spend between ${R.shortDay(from)} and ${R.shortDay(to)} in your files.`);
    const spent = camps.reduce((s, c) => s + c.spend, 0);
    const days = T.daysBetween(from < cover.from ? cover.from : from, to) + 1;
    const typed = T.num(input.budget);
    const budget = typed && typed > 0 ? typed : Math.round((spent / days) * (per === 'week' ? 7 : 30));
    const results = camps.reduce((s, c) => s + c.results, 0);
    // The yardstick: the member's own max cost per customer when they gave one (typed or on their
    // scorecard), else their own average over these weeks. Only this member's numbers (L76 D10).
    const own = X.cprTarget(ctx, input.target, []);
    const avgCpr = own ? own.value : results ? spent / results : null;
    const yard = own ? 'your max cost per customer' : 'your average';
    const notes = [...d.notes];
    if (!(typed > 0)) notes.push(`No budget typed, so this splits what you spent over these ${days} days at the same pace: ${X.usd(budget)} a ${per}.`);
    if (new Set(camps.map((c) => c.where)).size > 1) notes.push('Meta and Google count results their own way, so a Meta result and a Google result are not the same thing. Read the split as a starting point and check each platform\'s results are the ones you care about.');
    // The rule.
    const testShare = RULES.test_share;
    const rows = camps.map((c) => {
      const share = c.spend / spent;
      const cpr = c.results >= 0.5 ? c.spend / c.results : null;
      let call;
      let next;
      if (c.results < 0.5 && avgCpr && c.spend >= avgCpr * 3) {
        call = 'Stop';
        next = 0;
      } else if (c.results < RULES.min_results) {
        call = 'Test';
        next = null;
      } else {
        const ratio = avgCpr / cpr; // above 1: cheaper per result than your average
        next = Math.max(share * (1 - RULES.max_change), Math.min(share * (1 + RULES.max_change), share * ratio));
        call = ratio >= 1.15 ? 'More' : ratio <= 0.87 ? 'Less' : 'Same';
      }
      return { ...c, share, cpr, call, next };
    });
    const testers = rows.filter((r) => r.call === 'Test');
    const proven = rows.filter((r) => r.next != null && r.next > 0);
    const provenSum = proven.reduce((s, r) => s + r.next, 0);
    const testPool = testers.length || proven.length ? testShare : 0;
    const scale = provenSum ? (1 - (proven.length ? testPool : 0)) / provenSum : 0;
    for (const r of proven) r.next *= scale;
    for (const r of testers) r.next = proven.length ? testPool / Math.max(1, testers.length + (testers.length ? 0 : 1)) : 1 / testers.length;
    const freeTest = proven.length && !testers.length ? testPool : 0;
    const out = rows.sort((a, b) => b.next - a.next).map((r) => ({
      campaign: r.name,
      where: r.where,
      spent: X.usd(X.r0(r.spend)),
      results: X.r0(r.results),
      cpr: r.cpr == null ? 'no results' : X.usd(r.cpr),
      now: `${Math.round(r.share * 100)}%`,
      share: `${Math.round(r.next * 100)}%`,
      amount: X.usd(Math.round(budget * r.next)),
      call: r.call,
      why: r.call === 'Stop' ? `Spent ${X.usd(X.r0(r.spend))} with no results, over 3 times ${yard} per result.` : r.call === 'Test' ? `Fewer than ${RULES.min_results} results: too early to judge, so it shares the test slice.` : `${X.usd(r.cpr)} per result against ${yard} ${X.usd(avgCpr)}${r.call === 'Same' ? ': close to it' : ''}.`,
      amountN: Math.round(budget * r.next),
      spendEffect: effect(Math.round(budget * r.next) - Math.round((r.spend / days) * (per === 'week' ? 7 : 30)), per),
    }));
    const test = { share: `${Math.round(testPool * 100)}%`, amount: X.usd(Math.round(budget * testPool)), use: freeTest ? 'Nothing is in testing now, so this slice is for one new ad: a new picture or offer.' : 'Shared by the campaigns still in testing above.' };
    if (freeTest) out.push({ campaign: 'A new test', where: 'Either', spent: '', results: '', cpr: '', now: '0%', share: test.share, amount: test.amount, call: 'Test', why: test.use, amountN: Math.round(budget * testPool), spendEffect: effect(Math.round(budget * testPool), per) });
    const rules = [
      `Window: your last ${RULES.window} days of ad reports (${C.shortRange(from, to)}).`,
      `Each campaign's share moves with its cost per result against ${yard} (${avgCpr ? X.usd(avgCpr) : 'not known'}): cheaper gets more, dearer gets less.`,
      `No share moves more than ${Math.round(RULES.max_change * 100)}% of where it is now, so one good week can't take the whole budget.`,
      'A campaign that spent over 3 times your average cost per result with no results goes to zero.',
      `${Math.round(testShare * 100)}% stays for testing: campaigns with fewer than ${RULES.min_results} results, or a new ad.`,
      'No results are forecast: a bigger budget often costs more per result, so check after a week.',
    ];
    const more = out.filter((r) => r.call === 'More').map((r) => r.campaign).slice(0, 2);
    const stops = out.filter((r) => r.call === 'Stop').length;
    const headline = `${X.usd(budget)} a ${per} across ${rows.length} campaign${rows.length === 1 ? '' : 's'}: ${more.length ? `${more.join(' and ')} ${more.length === 1 ? 'gets' : 'get'} more` : 'no big moves'}${stops ? `, ${stops} to stop` : ''}.`;
    const name = nameOf(ctx, d);
    const cls = (r) => (r.call === 'More' ? 'good' : r.call === 'Stop' || r.call === 'Less' ? 'bad' : '');
    const body = wrap(d, `<section><h2>The split</h2><p class="lead">${P.esc(X.usd(budget))} a ${per}, from your own last ${RULES.window} days.</p>${P.table([{ key: 'campaign', label: 'Campaign' }, { key: 'where', label: 'Where' }, { key: 'now', label: 'Share now', n: true }, { key: 'share', label: 'Suggested', n: true, cls }, { key: 'amount', label: `A ${per}`, n: true }, { key: 'call', label: '', cls }], out)}</section>
<section><h2>Why each one</h2>${out.map((r) => `<div class="card"><span class="tag ${r.call === 'More' ? 'p' : ''}">${P.esc(r.call)}</span><h3>${P.esc(r.campaign)}</h3><p>${P.esc(r.why)}</p><p><b>Spend effect:</b> ${P.esc(r.spendEffect)}</p><p class="muted small">${r.spent ? `${P.esc(r.spent)} spent, ${r.results} results over ${RULES.window} days.` : ''}</p></div>`).join('')}</section>
<section><h2>The rule</h2><div class="card">${P.list(rules)}</div></section>
<section><h2>Your steps</h2><div class="card">${P.list(['Change each campaign\'s budget yourself in Meta Ads Manager or Google Ads. 127 never changes a budget.', 'Make the changes once, then leave them a week before you look again.', 'Run this again next week with fresh exports.'])}</div></section>`, notes);
    const html = P.page(ctx, { title: 'Your ad budget split', kicker: 'Your ads', sub: headline, stats: [{ value: X.usd(budget), label: `a ${per}` }, { value: String(rows.length), label: 'campaigns' }, { value: test.share, label: 'kept for testing' }], body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'budget split', to, '.html'), html);
    const csvRows = out.map((r) => ({ campaign: r.campaign, where: r.where, now: r.now, share: r.share, amount: r.amountN, call: r.call, why: r.why, spendEffect: r.spendEffect }));
    const n = csvRows.length + 1;
    csvRows.push({ campaign: 'Total', where: '', now: '', share: '', amount: `=SUM(E2:E${n})`, call: '', why: '' });
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'budget split', to, '.csv'), files.csv(csvRows, [{ key: 'campaign', label: 'Campaign' }, { key: 'where', label: 'Where' }, { key: 'now', label: 'Share now' }, { key: 'share', label: 'Suggested share' }, { key: 'amount', label: `Amount a ${per}` }, { key: 'call', label: 'Call' }, { key: 'why', label: 'Why' }, { key: 'spendEffect', label: 'Spend effect' }], { bom: true }));
    ctx.log(headline);
    return { budget, per, rows: out.map(({ amountN, ...r }) => r), test, rules, headline, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.table([{ key: 'campaign', label: 'Campaign' }, { key: 'now', label: 'Now' }, { key: 'share', label: 'Suggested' }, { key: 'amount', label: `A ${out.per}` }, { key: 'call', label: 'Call' }, { key: 'spendEffect', label: 'Spend effect' }], out.rows),
      views.cards(out.rules.map((r) => ({ body: r }))),
      views.text('127 never changes your budgets. Make each change in your ads account.'),
      views.file(out.html, 'Budget split (printable)'),
      views.file(out.csv, 'Budget split (CSV)')
    );
  },
};
