// finance.cash_plan: a 12-month cash plan built only from the member's own numbers (price, cost per
// job, fixed costs, starting cash, and the jobs a week they set for a slow, expected and best case).
// The spreadsheet's formulas drive every month from the inputs at the top, so the member changes a
// number and the whole year updates. It is their plan, from their numbers: never a forecast of ours.

const { views, save, money } = require('../../_kit');
const numbers = require('../lib/numbers');
const parse = require('../lib/parse');
const memory = require('../lib/memory');
const html = require('../lib/html');
const tax = require('../lib/tax');
const { Sheet } = require('../lib/sheet');

const usd = (v) => money.usd(v);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CASES = [
  ['slow', 'Slow case'],
  ['expected', 'Expected case'],
  ['best', 'Best case'],
];

function startMonth(input, today) {
  const s = String(input || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return { y: Number(m[1]), m: Math.min(12, Math.max(1, Number(m[2]))) };
  const name = MONTHS.findIndex((x) => s.toLowerCase().startsWith(x.toLowerCase()));
  const [ty, tm] = today.split('-').map(Number);
  if (name >= 0) {
    m = s.match(/(\d{4})/);
    const y = m ? Number(m[1]) : name + 1 > tm ? ty : ty + 1;
    return { y, m: name + 1 };
  }
  return tm === 12 ? { y: ty + 1, m: 1 } : { y: ty, m: tm + 1 };
}

// Fixed costs as [{ name, amount, freq: 'month' | 'year', due }]: from the startup step's list, typed
// lines ("Insurance 55 a month", "Bond 150 a year") or one number a month.
function fixedList(input) {
  const v = input.fixedItems;
  // A list from the startup step is used as it is, even when empty: it is this run's numbers.
  if (Array.isArray(v)) {
    return v.filter((i) => i && Number(i.amount) > 0).slice(0, 20).map((i) => ({ name: parse.cleanName(i.name, 'Fixed cost'), amount: numbers.round2(Number(i.amount)), freq: i.freq === 'year' ? 'year' : 'month', due: 1 }));
  }
  const f = input.fixed;
  if (f == null || f === '') return [];
  if (typeof f === 'number' || /^\s*\$?\s?[\d,]+(\.\d+)?\s*$/.test(String(f))) {
    const n = parse.positive(f);
    return n ? [{ name: 'Fixed costs a month', amount: n, freq: 'month', due: 1 }] : [];
  }
  return parse
    .costs(String(f))
    .items.filter((i) => i.amount > 0)
    .slice(0, 20)
    .map((i) => ({ name: i.name, amount: i.amount, freq: i.freq === 'year' ? 'year' : 'month', due: 1 }));
}

// The same math the spreadsheet's formulas do, month by month.
function model(p) {
  const months = [];
  let y = p.start.y;
  let m = p.start.m;
  for (let i = 0; i < 12; i++) {
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    months.push({ n: i + 1, y, m, label: `${MONTHS[m - 1]} ${y}`, days });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const monthly = p.fixed.filter((x) => x.freq === 'month').reduce((n, x) => n + x.amount, 0);
  const fixedFor = (n) => numbers.round2(monthly + p.fixed.filter((x) => x.freq === 'year' && x.due === n).reduce((s, x) => s + x.amount, 0));
  const cases = {};
  for (const [key] of CASES) {
    let cashEnd = numbers.round2(p.cash - p.startup);
    const rows = months.map((mo) => {
      const jobs = Math.round((p.perWeek[key] * mo.days) / 7 + 1e-9);
      const moneyIn = numbers.round2(jobs * p.price);
      const fees = numbers.round2(jobs * p.share * (p.price * p.m.rate + p.m.fixed));
      const jobCosts = numbers.round2(jobs * p.cost);
      const fixed = fixedFor(mo.n);
      const left = numbers.round2(moneyIn - fees - jobCosts - fixed);
      const taxes = numbers.round2(Math.max(0, left) * p.taxRate);
      cashEnd = numbers.round2(cashEnd + left - taxes);
      return { ...mo, jobs, moneyIn, fees, jobCosts, fixed, left, taxes, cashEnd };
    });
    const low = rows.reduce((a, r) => (r.cashEnd < a.cashEnd ? r : a), rows[0]);
    const firstBelow = rows.find((r) => r.cashEnd < 0) || null;
    cases[key] = { rows, low, firstBelow, below: rows.filter((r) => r.cashEnd < 0).length };
  }
  const perJob = numbers.round2(p.price - numbers.feeOn(p.price, p.m, p.share) - p.cost);
  const avgFixed = numbers.round2(monthly + p.fixed.filter((x) => x.freq === 'year').reduce((s, x) => s + x.amount, 0) / 12);
  return { months, cases, perJob, avgFixed, toCover: numbers.jobsToCover(avgFixed, perJob) };
}

function planSheet(p, mdl, f) {
  const s = new Sheet();
  const U = f.unit;
  s.row([`12-month cash plan for ${f.display}`]);
  s.row(['Your plan, from your numbers. Change any number in column B (or any month in the jobs a week rows) and every month updates.']);
  s.row(['Not a forecast and not tax advice. Rows marked Example are starting points for you to change.']);
  s.blank();
  s.row(['Your numbers', 'Value', 'Note']);
  const r = {};
  r.price = s.row([`Price per ${U.one}`, p.price]);
  r.cost = s.row([`Cost per ${U.one} (supplies, parking)`, p.cost, p.costExample ? 'Example: type your own' : '']);
  r.rate = s.row(['Card fee percent', `${numbers.round2(p.m.rate * 100)}%`, `${p.m.label}, checked ${numbers.FEES.checked}`]);
  r.fixedFee = s.row(['Card fee per payment', p.m.fixed, (p.m.sources || [])[0] || '']);
  r.share = s.row([`Share of ${U.many} paid by card`, `${Math.round(p.share * 100)}%`]);
  r.cash = s.row(['Cash you start with', p.cash, p.cashExample ? 'Example: type your own' : '']);
  r.startup = s.row(['Startup costs, paid before month 1', p.startup]);
  r.tax = s.row(['Set aside for taxes, share of profit', `${Math.round(p.taxRate * 100)}%`, 'Self-employment tax plus an income tax guess. Check with a tax pro.']);
  r.slow = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} a week, slow case`, p.perWeek.slow, p.examples.slow ? 'Example: half your expected case. Change it.' : '']);
  r.expected = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} a week, expected case`, p.perWeek.expected]);
  r.best = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} a week, best case`, p.perWeek.best, p.examples.best ? 'Example: one and a half times your expected case. Change it.' : '']);
  const B = (k) => `$B$${r[k]}`;
  s.blank();
  s.row(['Fixed costs', 'Amount', 'How often (Monthly or Yearly)', 'Month paid, 1 to 12 (yearly only)']);
  const f1 = s.next;
  for (const x of p.fixed) s.row([x.name, x.amount, x.freq === 'year' ? 'Yearly' : 'Monthly', x.freq === 'year' ? x.due : '']);
  for (let k = 0; k < 4; k++) s.row(['', '', 'Monthly', '']);
  const f2 = s.next - 1;
  const FA = `$B$${f1}:$B$${f2}`;
  const FC = `$C$${f1}:$C$${f2}`;
  const FD = `$D$${f1}:$D$${f2}`;
  s.blank();
  const cols = mdl.months.map((_, i) => i + 2);
  const L = (c, row) => s.ref(row, c);
  const head = s.row(['Month', ...mdl.months.map((x) => x.label)]);
  const num = s.row(['Month number', ...mdl.months.map((x) => x.n)]);
  const days = s.row(['Days in the month', ...mdl.months.map((x) => x.days)]);
  const out = { head };
  for (const [key, label] of CASES) {
    s.blank();
    s.row([`${label} (your plan, from your numbers)`]);
    const jpw = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} a week`, ...cols.map(() => `=${B(key)}`)]);
    const jobs = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)}`, ...cols.map((c) => `=ROUND(${L(c, jpw)}*${L(c, days)}/7,0)`)]);
    const inRow = s.row(['Money in', ...cols.map((c) => `=${L(c, jobs)}*${B('price')}`)]);
    const fees = s.row(['Card fees', ...cols.map((c) => `=ROUND(${L(c, jobs)}*${B('share')}*(${B('price')}*${B('rate')}+${B('fixedFee')}),2)`)]);
    const jc = s.row([`Costs per ${U.one}`, ...cols.map((c) => `=${L(c, jobs)}*${B('cost')}`)]);
    const fx = s.row(['Fixed costs', ...cols.map((c) => `=SUMIFS(${FA},${FC},"Monthly")+SUMIFS(${FA},${FC},"Yearly",${FD},${L(c, num)})`)]);
    const left = s.row(['Left after costs', ...cols.map((c) => `=ROUND(${L(c, inRow)}-${L(c, fees)}-${L(c, jc)}-${L(c, fx)},2)`)]);
    const tx = s.row(['Set aside for taxes', ...cols.map((c) => `=ROUND(MAX(0,${L(c, left)})*${B('tax')},2)`)]);
    const end = s.row(['Cash at month end', ...cols.map((c, i) => (i === 0 ? `=ROUND(${B('cash')}-${B('startup')}+${L(c, left)}-${L(c, tx)},2)` : `=ROUND(${L(c - 1, s.next - 0)}+${L(c, left)}-${L(c, tx)},2)`))]);
    // fix the running total to point at its own row (the row number is known only after adding it)
    s.rows[end - 1] = ['Cash at month end', ...cols.map((c, i) => (i === 0 ? `=ROUND(${B('cash')}-${B('startup')}+${L(c, left)}-${L(c, tx)},2)` : `=ROUND(${L(c - 1, end)}+${L(c, left)}-${L(c, tx)},2)`))];
    out[key] = { jpw, jobs, end };
  }
  s.blank();
  s.row(['What this plan shows', 'Slow case', 'Expected case', 'Best case']);
  const lastCol = cols[cols.length - 1];
  s.row(['Lowest cash at a month end', ...CASES.map(([k]) => `=MIN(${s.ref(out[k].end, 2)}:${s.ref(out[k].end, lastCol)})`)]);
  s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} a month to cover fixed costs (on average)`, `=IF(ROUND(${B('price')}-ROUND((${B('price')}*${B('rate')}+${B('fixedFee')})*${B('share')},2)-${B('cost')},2)<=0,"Raise the price first",ROUNDUP((SUMIFS(${FA},${FC},"Monthly")+SUMIFS(${FA},${FC},"Yearly")/12)/ROUND(${B('price')}-ROUND((${B('price')}*${B('rate')}+${B('fixedFee')})*${B('share')},2)-${B('cost')},2),0))`]);
  s.blank();
  s.row([`Card fees checked ${numbers.FEES.checked}. Taxes: the set-aside is a cushion, not a tax bill. Estimated tax payments are due four times a year; check with a tax pro.`]);
  return { csv: s.toCsv(), rows: { ...r, ...out } };
}

function planPage(p, mdl, f) {
  const U = f.unit;
  const t = f.t;
  const ex = mdl.cases.expected;
  const slow = mdl.cases.slow;
  const heading = ex.firstBelow ? `Your cash goes below zero in ${ex.firstBelow.label}` : `Your cash stays above zero all 12 months`;
  const lowNote = (c) => `${c.low.label}${c.below ? `. Below zero in ${c.below} ${c.below === 1 ? 'month' : 'months'}` : ''}`;
  const chart = html.barChart({ labels: mdl.months.map((x) => MONTHS[x.m - 1]), values: ex.rows.map((r) => r.cashEnd), t, title: 'Cash at month end, expected case', mark: [ex.rows.indexOf(ex.low), 11] });
  const table = html.table({
    cols: [{ label: 'Month' }, { label: `${html.cap(U.many)} (expected)`, num: true }, { label: 'Fixed costs', num: true }, { label: 'Cash at month end: slow', num: true }, { label: 'Expected', num: true }, { label: 'Best', num: true }],
    rows: mdl.months.map((mo, i) => [mo.label, String(ex.rows[i].jobs), usd(ex.rows[i].fixed), { html: html.esc(usd(slow.rows[i].cashEnd)), cls: slow.rows[i].cashEnd < 0 ? 'neg-c' : '' }, { html: html.esc(usd(ex.rows[i].cashEnd)), cls: ex.rows[i].cashEnd < 0 ? 'neg-c' : '' }, { html: html.esc(usd(mdl.cases.best.rows[i].cashEnd)), cls: mdl.cases.best.rows[i].cashEnd < 0 ? 'neg-c' : '' }]),
  });
  const body = [
    html.stats([
      { value: usd(ex.low.cashEnd), label: 'Lowest cash, expected case', note: lowNote(ex), tone: ex.low.cashEnd < 0 ? 'bad' : 'good' },
      { value: usd(slow.low.cashEnd), label: 'Lowest cash, slow case', note: lowNote(slow), tone: slow.low.cashEnd < 0 ? 'bad' : '' },
      mdl.toCover != null ? { value: String(mdl.toCover), label: `${html.cap(U.many)} a month to cover fixed costs`, note: `${usd(mdl.avgFixed)} of fixed costs a month on average` } : { value: 'None', label: `${html.cap(U.many)} that cover fixed costs`, note: `Each ${U.one} loses money at this price`, tone: 'bad' },
    ]),
    ex.firstBelow || slow.firstBelow ? html.note(`<b>Plan for the dip.</b> ${ex.firstBelow ? `In the expected case your cash runs out in ${html.esc(ex.firstBelow.label)}.` : `In the slow case your cash runs out in ${html.esc(slow.firstBelow.label)}.`} Start with less, keep your costs to the Now list, or raise your price before then.`, 'warn') : html.note('<b>Even the slow case stays above zero.</b> Keep the set-aside for taxes in a separate account so it stays there.', 'good'),
    html.section({ kicker: 'Expected case', title: 'Cash at month end', sub: `${p.perWeek.expected} ${U.many} a week at ${usd(p.price)}, after card fees, costs, fixed costs and ${Math.round(p.taxRate * 100)}% set aside for taxes. Starts from ${usd(p.cash)} minus ${usd(p.startup)} of startup costs.`, body: chart }),
    html.section({ kicker: 'Three cases', title: 'Your plan, month by month', sub: `Slow: ${p.perWeek.slow} a week${p.examples.slow ? ' (example)' : ''}. Expected: ${p.perWeek.expected} a week. Best: ${p.perWeek.best} a week${p.examples.best ? ' (example)' : ''}. Change them in the spreadsheet.`, body: table }),
    html.section({
      kicker: 'Next',
      title: 'Make the plan yours',
      body: html.steps([
        { title: 'Open the spreadsheet', text: `Change any number in column B. Type over a month in a ${U.many} a week row for a slow season or a vacation.` },
        { title: 'Watch the lowest month', text: 'That month needs the most cash. Keep that much in the bank before you spend on extras.' },
        { title: 'Check it every month', text: `Type what really happened next to your plan. Your real ${U.many} a week beat any guess.` },
      ]),
    }),
  ].join('');
  return html.page({
    t,
    title: `12-month cash plan for ${f.display}`,
    business: f.display,
    kicker: 'Your plan, from your numbers',
    heading,
    lead: `A 12-month cash plan from ${mdl.months[0].label} to ${mdl.months[11].label}, built only from the numbers you typed. Change them and the spreadsheet updates every month.`,
    chips: [`${p.perWeek.expected} ${U.many} a week expected`, `Price ${usd(p.price)}`, `Card fees checked ${html.dateText(numbers.FEES.checked)}`],
    body,
    made: f.made,
    foot: ['Your plan, from your numbers. Not a forecast, not a promise and not tax advice: check with a tax pro.', `Fee sources: ${html.sourceLinks(p.m.sources || [])}`],
  });
}

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const NUM = { type: ['number', 'string'] };

module.exports = {
  name: 'finance.cash_plan',
  title: 'Plan 12 months of cash',
  description: 'Builds a 12-month cash plan from your own numbers: price, cost per job, fixed costs, starting cash, and the jobs a week you set for a slow, expected and best case. A spreadsheet with working formulas plus a printable summary.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['jobsPerWeek'],
    properties: {
      jobsPerWeek: { ...NUM, title: 'Jobs a week you expect' },
      slow: { ...NUM, title: 'Jobs a week in a slow case (optional)' },
      best: { ...NUM, title: 'Jobs a week in a best case (optional)' },
      price: { ...NUM, title: 'Price per job' },
      cost: { ...NUM, title: 'Cost per job (optional)' },
      method: { type: 'string', title: 'How you get paid (optional)' },
      share: { ...NUM, title: 'Share paid by card (optional)' },
      cash: { ...NUM, title: 'Cash you start with (optional)' },
      startup: { ...NUM, title: 'Startup costs (optional)' },
      fixed: { ...NUM, title: 'Fixed costs (optional)', description: 'A total a month like 250, or one per line: Insurance 55 a month' },
      fixedItems: { type: 'array', title: 'Fixed costs list', items: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' }, freq: { type: 'string' } } } },
      taxRate: { ...NUM, title: 'Share to set aside for taxes (optional)' },
      start: { type: 'string', title: 'First month (optional)', description: 'Like 2026-11. Leave empty for next month.' },
      what: { type: 'string', title: 'What you sell (optional)', maxLength: 200 },
      business: { type: 'string', title: 'Business name (optional)', maxLength: 120 },
      color: { type: 'string', title: 'Brand color (optional)' },
    },
  },
  output: {
    type: 'object',
    required: ['months', 'files'],
    properties: {
      business: { type: 'string' },
      units: { type: 'string' },
      months: { type: 'array', items: { type: 'object' } },
      lowest: { type: 'object' },
      firstBelowZero: { type: 'object' },
      jobsToCover: { type: 'number' },
      perWeek: { type: 'object' },
      examples: { type: 'array', items: { type: 'string' } },
      files: { type: 'object', properties: { csv: ASSET, html: ASSET } },
    },
  },

  async run(input, ctx) {
    const f = memory.factsOf(ctx, input);
    const price = parse.positive(memory.pick(input.price, f.n.price, f.off.price, f.b.price));
    if (!(price > 0)) throw new Error('Add your price per job to build the plan.');
    const expected = parse.positive(input.jobsPerWeek);
    if (expected == null) throw new Error('Add how many jobs a week you expect. It is your number: the plan is built from it.');
    const slowIn = parse.positive(input.slow);
    const bestIn = parse.positive(input.best);
    const costIn = parse.positive(memory.pick(input.cost, f.n.cost));
    const cashIn = parse.positive(memory.pick(input.cash, f.n.cash));
    const p = {
      price,
      cost: costIn || 0,
      costExample: costIn == null,
      m: numbers.method(memory.pick(input.method, f.n.method)),
      share: Math.min(1, parse.percent(memory.pick(input.share, f.n.share), 1)),
      cash: cashIn || 0,
      cashExample: cashIn == null,
      startup: parse.positive(memory.pick(input.startup, f.n.startup)) || 0,
      taxRate: Math.min(0.6, parse.percent(input.taxRate, tax.setAside({}).rate)),
      perWeek: { slow: slowIn != null ? slowIn : Math.round(expected * 0.5 * 10) / 10, expected, best: bestIn != null ? bestIn : Math.round(expected * 1.5 * 10) / 10 },
      examples: { slow: slowIn == null, best: bestIn == null },
      fixed: fixedList({ fixedItems: input.fixedItems, fixed: memory.pick(input.fixed, f.n.fixed) }),
      start: startMonth(input.start, f.today),
    };
    const mdl = model(p);
    const sheet = planSheet(p, mdl, f);
    const base = save.fileName(f.name || 'your', 'cash plan');
    const csv = await save.saveFile(ctx, `${base}.csv`, sheet.csv);
    const page = await save.saveFile(ctx, `${base}.html`, planPage(p, mdl, f));
    await memory.saveNumbers(ctx, { price, jobsPerWeek: expected, slow: slowIn == null ? undefined : slowIn, best: bestIn == null ? undefined : bestIn });
    const out = {
      business: f.display,
      units: f.unit.many,
      months: mdl.months.map((mo, i) => ({ label: mo.label, slow: mdl.cases.slow.rows[i].cashEnd, expected: mdl.cases.expected.rows[i].cashEnd, best: mdl.cases.best.rows[i].cashEnd, jobs: mdl.cases.expected.rows[i].jobs })),
      lowest: Object.fromEntries(CASES.map(([k]) => [k, { label: mdl.cases[k].low.label, cash: mdl.cases[k].low.cashEnd }])),
      firstBelowZero: Object.fromEntries(CASES.filter(([k]) => mdl.cases[k].firstBelow).map(([k]) => [k, mdl.cases[k].firstBelow.label])),
      perWeek: p.perWeek,
      examples: [...(p.examples.slow ? ['slow case'] : []), ...(p.examples.best ? ['best case'] : []), ...(p.costExample ? ['cost per job'] : []), ...(p.cashExample ? ['starting cash'] : [])],
      files: { csv, html: page },
    };
    if (mdl.toCover != null) out.jobsToCover = mdl.toCover;
    return out;
  },

  view(out) {
    const U = out.units || 'jobs';
    const low = (k) => out.lowest[k];
    return views.blocks(
      views.metric('Lowest cash, expected case', usd(low('expected').cash), out.firstBelowZero.expected ? `Below zero from ${out.firstBelowZero.expected}.` : `In ${low('expected').label}. Stays above zero.`),
      views.metric('Lowest cash, slow case', usd(low('slow').cash), out.firstBelowZero.slow ? `Below zero from ${out.firstBelowZero.slow}.` : `In ${low('slow').label}. Stays above zero.`),
      out.jobsToCover != null ? views.metric(`${U[0].toUpperCase()}${U.slice(1)} a month to cover fixed costs`, String(out.jobsToCover), 'On average, from your numbers.') : null,
      views.text(`Your plan, from your numbers: ${out.perWeek.slow}, ${out.perWeek.expected} and ${out.perWeek.best} ${U} a week for the slow, expected and best case.${out.examples.length ? ` Example values to change in the spreadsheet: ${out.examples.join(', ')}.` : ''} Not a forecast.`),
      {
        ...views.table(
          [
            { key: 'label', label: 'Month' },
            { key: 'slow', label: 'Cash at month end: slow', format: 'money' },
            { key: 'expected', label: 'Expected', format: 'money' },
            { key: 'best', label: 'Best', format: 'money' },
          ],
          out.months,
          12
        ),
        title: 'Your 12-month cash plan',
      },
      views.file(out.files.html, 'Cash plan summary (printable)'),
      views.file(out.files.csv, '12-month cash plan spreadsheet (Google Sheets or Excel)')
    );
  },
};
