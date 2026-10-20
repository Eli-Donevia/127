// Offer test planner: an A/B test of two offers, with how many people each version needs to see
// before the result means something, in plain words. The rate and daily traffic come from the
// member's own ad exports when they test in an ad, else from what they type; with neither, the page
// shows the days for a few traffic levels instead of guessing theirs. Pure code; nothing is changed.

const { views, save, files } = require('../../_kit');
const { C, R, P, T, X, nameOf, wrap } = require('../lib/base');
const RULES = require('../data/rules.json').test;
const K = require('../lib/claims');

const WHERE = ['An ad', 'Store or booking page', 'Email', 'Posts'];

// People each version needs, to tell rate p1 from p2 (two-sided 5%, 80% power).
function perVersion(p1, p2) {
  const za = RULES.z_alpha;
  const zb = RULES.z_power;
  const pbar = (p1 + p2) / 2;
  const n = (za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2;
  return Math.ceil(n);
}

// The gap between the two rates that counts as real at that size (5%, two-sided).
const gapNeeded = (p, n) => RULES.z_alpha * Math.sqrt((2 * p * (1 - p)) / n);

const pctIn = (v) => {
  const n = T.num(v);
  if (n == null || n <= 0) return null;
  return n >= 1 ? n / 100 : n;
};

module.exports = {
  name: 'cmo.offer_test',
  title: 'Plan an offer test',
  description: 'Plans an A/B test of two offers: how many people each version needs to see before the result means something, how many days that takes at the member\'s own traffic, how to split it, when to stop and how to read it, with a tracking sheet. Advice only: nothing is changed.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['stripe', 'shopify'],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      a: { type: 'string', title: 'Offer A (what you have now)', maxLength: 300, description: 'Like "Free shipping over $50".' },
      b: { type: 'string', title: 'Offer B (what you want to try)', maxLength: 300, description: 'Like "Free wick trimmer with any 2 candles".' },
      where: { type: 'string', title: 'Where you will test it', enum: WHERE, default: 'An ad' },
      rate: { type: 'string', title: 'How many buy now, as a % (optional)', maxLength: 12, description: 'Of the people who see it. Left empty for an ad: read from your ad export.' },
      visitors: { type: 'integer', title: 'People who see it a day (optional)', minimum: 1, maximum: 1000000, description: 'Left empty for an ad: your clicks a day from your ad export.' },
      lift: { type: 'integer', title: 'Smallest change worth knowing, %', minimum: 5, maximum: 200, default: 20 },
      files: C.FILES,
    },
  },
  output: {
    type: 'object',
    properties: { a: { type: 'string' }, b: { type: 'string' }, where: { type: 'string' }, rate: { type: ['number', 'null'] }, rateFrom: { type: 'string' }, perDay: { type: ['number', 'null'] }, perDayFrom: { type: 'string' }, lift: { type: 'number' }, perVersion: { type: ['integer', 'null'] }, days: { type: ['integer', 'null'] }, gap: { type: ['number', 'null'] }, levels: { type: 'array' }, note: { type: 'string' }, steps: { type: 'array' }, html: { type: 'object' }, csv: { type: 'object' }, ...C.OUT_COMMON },
    required: ['a', 'b', 'where', 'lift', 'levels', 'note', 'steps', 'html', 'csv', 'sample'],
  },
  perVersion,
  async run(input, ctx) {
    const where = WHERE.includes(input.where) ? input.where : 'An ad';
    const d = await R.dataset(ctx, input.files);
    const a = String(input.a || (d.sample ? 'Free shipping over $50' : '')).trim() || 'What you offer now';
    const b = String(input.b || (d.sample ? 'A free wick trimmer with any 2 candles' : '')).trim() || 'The new offer';
    const lift = Math.max(5, Math.min(200, input.lift || Math.round(RULES.default_lift * 100))) / 100;
    // Rate and traffic: typed first, then the member's ad export (clicks a day and results per click, last 28 days).
    let rate = pctIn(input.rate);
    let rateFrom = rate ? 'the rate you typed' : '';
    let perDay = input.visitors || null;
    let perDayFrom = perDay ? 'the number you typed' : '';
    const adCover = d.led.cover.ads || d.led.cover.adsSpread;
    if (where === 'An ad' && adCover) {
      const to = adCover.to;
      const from = T.addDays(to, -27);
      const ads = X.ads(d.records, from, to);
      const clicks = ads.reduce((s, x) => s + x.clicks, 0);
      const results = ads.reduce((s, x) => s + x.results, 0);
      const days = T.daysBetween(from < adCover.from ? adCover.from : from, to) + 1;
      if (!perDay && clicks) {
        perDay = Math.max(1, Math.round(clicks / days));
        perDayFrom = `your ad clicks a day, ${C.shortRange(from < adCover.from ? adCover.from : from, to)}`;
      }
      if (!rate && clicks >= 50 && results > 0) {
        rate = results / clicks;
        rateFrom = 'results per click across your ads, last 4 weeks';
      }
    }
    const notes = [...d.notes];
    // L76 D3: an offer that reads as a guarantee, an income claim or a timed result can't run in an ad or post.
    for (const [label, text] of [['A', a], ['B', b]]) {
      const issue = K.problems(text).find((p) => p.id !== 'needs_proof');
      if (issue) notes.unshift(`Offer ${label} reads as ${issue.why}. Ad networks and the FTC don't allow that in ads or posts: put it in plainer words before you test it.`);
    }
    if (!rate) {
      rate = where === 'Email' ? 0.02 : 0.03;
      rateFrom = `a starting rate of ${X.pct(rate, 0)} (type yours to make this exact)`;
      notes.push(`The plan uses ${X.pct(rate, 0)} as how many buy now, because none was typed${where === 'An ad' ? ' or found in an ad export' : ''}. Type yours for the real count.`);
    }
    rate = Math.min(0.9, rate);
    const p2 = Math.min(0.99, rate * (1 + lift));
    const n = perVersion(rate, p2);
    const days = perDay ? Math.ceil((2 * n) / perDay) : null;
    const gap = gapNeeded(rate, n);
    const levels = [25, 50, 100, 250, 500, 1000].map((v) => ({ perDay: v, days: Math.ceil((2 * n) / v) }));
    const bigger = lift < 0.5 ? perVersion(rate, Math.min(0.99, rate * 1.5)) : null;
    const fmtN = (v) => v.toLocaleString('en-US');
    let note = `To tell whether B is really ${Math.round(lift * 100)}% better than A (${X.pct(rate)} to ${X.pct(p2)} of people saying yes) and not luck, each version needs about ${fmtN(n)} people to see it, ${fmtN(2 * n)} in all.`;
    if (days) note += ` At about ${fmtN(perDay)} a day that is ${days} day${days === 1 ? '' : 's'}.`;
    if (days && days > RULES.max_days) note += ` That is longer than ${RULES.max_days / 7} weeks, and other things change in that time. Test a bigger difference${bigger ? ` (a 50% change needs about ${fmtN(bigger)} each)` : ''}, or test where more people see it.`;
    if (!days) note += ' The table shows how many days that takes at different numbers of people a day.';
    note += ' Fewer people than that, and a gap between A and B is mostly chance.';
    const steps = [
      `Set up both versions the same in every way except the offer: same photo, same price, same audience.${where === 'An ad' ? ' In Meta Ads Manager use A/B test, or run 2 ads in the same ad set; in Google Ads use an experiment.' : ''}`,
      where === 'Email' ? 'Split your list in half at random (most email tools have an A/B option) and send each half one version at the same time.' : where === 'Posts' ? 'Posts are hard to split fairly. Run each offer on the same weekday and time, alternating weeks, and count sales with a code for each (A and B).' : 'Show each version to half the people. If you cannot split, alternate days: A on odd days, B on even days.',
      `Give each version its own code or link so every sale is counted for the right one. Log people and sales each day in the sheet.`,
      `Do not stop early because one is ahead. Stop when both have about ${fmtN(n)} people.`,
      `Then: if B's rate is higher than A's by ${X.pct(gap, 2)} points or more (the gap that counts as real at that size), keep B. If not, keep A: the simpler offer wins a tie.`,
    ];
    const name = nameOf(ctx, d);
    const body = wrap(d, `<section><h2>In plain words</h2><div class="card"><p class="big">${P.esc(note)}</p></div></section>
<section><h2>The two offers</h2><div class="card"><span class="tag">A, now</span><h3>${P.esc(a)}</h3></div><div class="card"><span class="tag p">B, to try</span><h3>${P.esc(b)}</h3></div></section>
<section><h2>Steps</h2><div class="card">${P.list(steps.map((s, i) => `${i + 1}. ${s}`))}</div></section>
<section><h2>Days at different traffic</h2>${P.table([{ key: 'perDay', label: 'People a day (both versions)', n: true }, { key: 'days', label: 'Days', n: true }], levels)}</section>
<section><h2>The numbers used</h2><div class="card">${P.list([`How many buy now: ${X.pct(rate)}, from ${rateFrom}.`, `People a day: ${perDay ? `${fmtN(perDay)}, from ${perDayFrom}` : 'not known yet'}.`, `Smallest change worth knowing: ${Math.round(lift * 100)}%.`, `Math: the usual sample-size formula for two rates, 95% sure it's not chance, 80% chance of spotting a real change of that size.`])}</div></section>`, notes);
    const html = P.page(ctx, { title: 'Your offer test', kicker: 'Marketing', sub: note, stats: [{ value: fmtN(n), label: 'people each version' }, ...(days ? [{ value: String(days), label: 'days at your traffic' }] : []), { value: X.pct(gap, 2), label: 'gap that counts' }], body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'offer test', d.today, '.html'), html);
    // Tracking sheet: a row per day per version, rate as a formula; totals at the bottom.
    const rows = [];
    const plannedDays = Math.min(days || 28, 90);
    for (let i = 0; i < plannedDays; i++) for (const v of ['A', 'B']) rows.push({ date: T.addDays(d.today, i + 1), version: v, people: '', sales: '', rate: `=IF(C${rows.length + 2}>0,ROUND(D${rows.length + 2}/C${rows.length + 2},4),"")` });
    const last = rows.length + 1;
    rows.push({ date: 'Total A', version: 'A', people: `=SUMIFS(C2:C${last},B2:B${last},"A")`, sales: `=SUMIFS(D2:D${last},B2:B${last},"A")`, rate: `=IF(C${last + 1}>0,ROUND(D${last + 1}/C${last + 1},4),"")` });
    rows.push({ date: 'Total B', version: 'B', people: `=SUMIFS(C2:C${last},B2:B${last},"B")`, sales: `=SUMIFS(D2:D${last},B2:B${last},"B")`, rate: `=IF(C${last + 2}>0,ROUND(D${last + 2}/C${last + 2},4),"")` });
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'offer test', d.today, '.csv'), files.csv(rows, [{ key: 'date', label: 'Date' }, { key: 'version', label: 'Version' }, { key: 'people', label: 'People who saw it' }, { key: 'sales', label: 'Sales' }, { key: 'rate', label: 'Rate' }], { bom: true }));
    ctx.log(`${fmtN(n)} people each version${days ? `, about ${days} days` : ''}.`);
    return { a, b, where, rate: Math.round(rate * 10000) / 10000, rateFrom, perDay, perDayFrom: perDayFrom || 'not known yet', lift, perVersion: n, days, gap: Math.round(gap * 10000) / 10000, levels, note, steps, html: htmlFile, csv: csvFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.metric('People each version needs', out.perVersion == null ? 'not known' : out.perVersion),
      out.days ? views.metric('Days at your traffic', out.days, `${out.perDay} a day, from ${out.perDayFrom}`) : null,
      views.text(out.note),
      views.cards(out.notes.filter((n) => /reads as/.test(n)).map((n) => ({ title: 'Check this', body: n }))),
      views.cards(out.steps.map((s, i) => ({ title: `Step ${i + 1}`, body: s }))),
      views.table([{ key: 'perDay', label: 'People a day', format: 'number' }, { key: 'days', label: 'Days', format: 'number' }], out.levels),
      views.file(out.html, 'Offer test plan (printable)'),
      views.file(out.csv, 'Tracking sheet (CSV)')
    );
  },
};
