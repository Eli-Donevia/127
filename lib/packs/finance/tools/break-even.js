// finance.break_even: unit math from the member's own numbers. What one job leaves after the card
// fee (verified rates, data/fees.json) and the cost per job, how many jobs a month cover fixed
// costs, how many jobs earn back startup costs, and how long starting cash lasts with no sales.
// Never a forecast: every number is per job or a count of jobs.

const { views, save, money } = require('../../_kit');
const numbers = require('../lib/numbers');
const parse = require('../lib/parse');
const memory = require('../lib/memory');
const html = require('../lib/html');
const tax = require('../lib/tax');
const { Sheet } = require('../lib/sheet');

const usd = (v) => money.usd(v);
const cents = (v) => money.usd(v, { cents: true });
const pct = (v) => `${(Math.round(v * 1000) / 10).toString()}%`;
const STEPS = [
  ['10% lower', 0.9],
  ['As it is', 1],
  ['10% higher', 1.1],
  ['20% higher', 1.2],
];

// "250", 250, or lines like "Insurance 55 a month / Bond 150 a year" -> fixed costs a month.
function fixedOf(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v >= 0 ? v : null;
  const s = String(v).trim();
  if (/^\$?\s?[\d,]+(\.\d+)?\s*k?$/i.test(s)) return parse.positive(s);
  const { items } = parse.costs(s);
  if (!items.length) return null;
  return numbers.round2(items.reduce((n, i) => n + (i.amount || 0) / (i.freq === 'year' ? 12 : 1), 0));
}

function calc(input, f) {
  const price = parse.positive(memory.pick(input.price, f.n.price, f.off.price, f.b.price));
  if (!(price > 0)) throw new Error('Add your price per job to see your numbers.');
  const cost = parse.positive(memory.pick(input.cost, f.n.cost)) || 0;
  const m = numbers.method(memory.pick(input.method, f.n.method));
  const share = Math.min(1, parse.percent(memory.pick(input.share, f.n.share), 1));
  const miles = parse.positive(input.miles) || 0;
  const mileRate = miles > 0 ? tax.mileRateOn(f.today) || tax.latestMileRate().rate : 0;
  const minutes = parse.positive(memory.pick(input.minutes, f.n.minutes)) || 0;
  const fixed = fixedOf(memory.pick(input.fixed, f.n.fixed));
  const startup = parse.positive(memory.pick(input.startup, f.n.startup));
  const cash = parse.positive(memory.pick(input.cash, f.n.cash));
  const job = numbers.jobMath({ price, cost, minutes, miles, mileRate, m, share });
  const toCover = fixed != null ? numbers.jobsToCover(fixed, job.left) : null;
  const run = numbers.runway({ cash, startup: startup || 0, fixed: fixed || 0 });
  const steps = STEPS.map(([label, k]) => {
    const p = numbers.round2(price * k);
    const j = numbers.jobMath({ price: p, cost, miles, mileRate, m, share });
    return { label, price: p, left: j.left, cover: fixed != null ? numbers.jobsToCover(fixed, j.left) : null };
  });
  return { price, cost, m, share, miles, mileRate, minutes, fixed, startup, cash, job, toCover, run, steps, payback: startup ? numbers.paybackJobs(startup, job.left) : null, fees: numbers.compare(price) };
}

function calcSheet(c, f) {
  const s = new Sheet();
  const U = f.unit;
  s.row([`Break-even calculator for ${f.display}`]);
  s.row(['Your numbers, from what you typed. Change any number in column B and every result updates.']);
  s.blank();
  s.row(['Your numbers', 'Value', 'Note']);
  const r = {};
  r.price = s.row([`Price per ${U.one}`, c.price]);
  r.cost = s.row([`Cost per ${U.one} (supplies, parking)`, c.cost, c.cost ? '' : 'Example: type your own']);
  r.rate = s.row(['Card fee percent', `${numbers.round2(c.m.rate * 100)}%`, `${c.m.label}, checked ${numbers.FEES.checked}`]);
  r.fixedFee = s.row(['Card fee per payment', c.m.fixed, c.m.sources ? c.m.sources[0] : '']);
  r.share = s.row([`Share of ${U.many} paid by card`, `${Math.round(c.share * 100)}%`, c.share === 1 ? 'Example: type your own' : '']);
  r.miles = s.row([`Miles per ${U.one}, round trip`, c.miles, 'Driving counts at the IRS rate below']);
  r.mileRate = s.row(['IRS business mileage rate', c.mileRate || tax.latestMileRate().rate, tax.latestMileRate().source || 'https://www.irs.gov/tax-professionals/standard-mileage-rates']);
  r.fixed = s.row(['Fixed costs a month', c.fixed != null ? c.fixed : 0, c.fixed != null ? '' : 'Example: type your own']);
  r.startup = s.row(['Startup costs', c.startup || 0, c.startup ? '' : 'Example: type your own']);
  r.cash = s.row(['Cash you can put in', c.cash != null ? c.cash : 0, c.cash != null ? '' : 'Example: type your own']);
  const B = (k) => `$B$${r[k]}`;
  s.blank();
  s.row(['Results', 'Value', 'How it works']);
  r.fee = s.row([`Card fee per ${U.one}`, `=ROUND((${B('price')}*${B('rate')}+${B('fixedFee')})*${B('share')},2)`, 'Price times the percent, plus the per-payment fee']);
  r.drive = s.row([`Driving per ${U.one}`, `=ROUND(${B('miles')}*${B('mileRate')},2)`, 'Miles times the IRS rate']);
  r.left = s.row([`Left per ${U.one}`, `=ROUND(${B('price')}-${B('fee')}-${B('cost')}-${B('drive')},2)`, 'Before taxes and before paying yourself']);
  r.margin = s.row(['Left as a share of the price (percent)', `=IF(${B('price')}>0,ROUND(${B('left')}/${B('price')}*100,1),0)`]);
  r.cover = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} a month to cover fixed costs`, `=IF(${B('fixed')}<=0,0,IF(${B('left')}<=0,"Raise the price first",ROUNDUP(${B('fixed')}/${B('left')},0)))`]);
  r.week = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} a week (about)`, `=IF(OR(${B('fixed')}<=0,${B('left')}<=0),"",ROUNDUP(${B('cover')}*12/52,0))`]);
  r.payback = s.row([`${U.many[0].toUpperCase()}${U.many.slice(1)} to earn back startup costs`, `=IF(${B('startup')}<=0,0,IF(${B('left')}<=0,"Raise the price first",ROUNDUP(${B('startup')}/${B('left')},0)))`]);
  r.after = s.row(['Cash left after startup costs', `=${B('cash')}-${B('startup')}`]);
  r.months = s.row(['Months of fixed costs that covers with no sales', `=IF(${B('fixed')}<=0,"",IF(${B('after')}<=0,0,ROUNDDOWN(${B('after')}/${B('fixed')},0)))`]);
  s.blank();
  s.row(['What a price change does', 'Price', `Left per ${U.one}`, `${U.many[0].toUpperCase()}${U.many.slice(1)} a month to cover fixed costs`]);
  for (const [label, k] of STEPS) {
    const n = s.next;
    s.row([
      label,
      `=ROUND(${B('price')}*${k},2)`,
      `=ROUND(B${n}-ROUND((B${n}*${B('rate')}+${B('fixedFee')})*${B('share')},2)-${B('cost')}-${B('drive')},2)`,
      `=IF(${B('fixed')}<=0,0,IF(C${n}<=0,"Loses money",ROUNDUP(${B('fixed')}/C${n},0)))`,
    ]);
  }
  s.blank();
  s.row(['Card fee on one payment', 'Percent', 'Per payment', 'Fee', 'You keep', 'Source']);
  for (const key of numbers.FEES.compare) {
    const m = numbers.FEES.methods[key];
    const n = s.next;
    s.row([m.short, `${numbers.round2(m.rate * 100)}%`, m.fixed, `=ROUND(${B('price')}*B${n}+C${n},2)`, `=${B('price')}-D${n}`, (m.sources || [])[0] || '']);
  }
  s.blank();
  s.row([`Fees checked ${numbers.FEES.checked} on each company's US pricing page. Plans and rates change, so check yours.`]);
  return { csv: s.toCsv(), rows: r };
}

function numbersPage(c, f) {
  const U = f.unit;
  const t = f.t;
  const j = c.job;
  const losing = j.left <= 0;
  const heading = losing
    ? `Each ${cents(c.price)} ${U.one} loses ${cents(-j.left)} right now`
    : c.toCover != null
      ? `${c.toCover} ${c.toCover === 1 ? U.one : U.many} a month cover your fixed costs`
      : `Each ${usd(c.price)} ${U.one} leaves ${cents(j.left)} after costs`;
  const perWeek = c.toCover ? Math.ceil((c.toCover * 12) / 52 - 1e-9) : null;
  const bar = html.moneyBar([
    { label: 'Card fee', value: j.fee, tone: 1 },
    { label: `Cost per ${U.one}`, value: j.cost, tone: 0 },
    { label: 'Driving', value: j.driveCost, tone: 4 },
    { label: 'Left', value: Math.max(0, j.left), tone: 3 },
  ]);
  const sens = html.table({
    cols: [{ label: 'If your price is' }, { label: 'Price', num: true }, { label: `Left per ${U.one}`, num: true }, { label: `${html.cap(U.many)} a month to cover fixed costs`, num: true }],
    rows: c.steps.map((x) => [x.label, cents(x.price), cents(x.left), x.left <= 0 ? 'Loses money' : x.cover == null ? '' : String(x.cover)]),
    rowCls: (row, i) => (c.steps[i].label === 'As it is' ? 'here' : ''),
  });
  const fees = html.table({
    cols: [{ label: 'Way to get paid' }, { label: 'Fee on one payment', num: true }, { label: 'You keep', num: true }],
    rows: c.fees.map((x) => [x.label, cents(x.fee), cents(x.keep)]),
  });
  const cushion = !c.run.known
    ? html.note('Add the cash you can put in to see how long it lasts with no sales.')
    : c.run.short > 0
      ? html.note(`<b>You are ${usd(c.run.short)} short of your startup costs.</b> Start with the Now list only, use what you have, or wait until you have saved the difference.`, 'bad')
      : c.run.months == null
        ? html.note(`${usd(c.run.afterStartup)} is left after startup costs. Add your fixed costs a month to see how long it lasts.`)
        : html.note(`<b>${usd(c.run.afterStartup)} is left after startup costs.</b> With no sales at all, that covers ${c.run.months} ${c.run.months === 1 ? 'month' : 'months'} of fixed costs.`, c.run.months >= 3 ? 'good' : 'warn');

  const body = [
    html.stats([
      { value: cents(j.left), label: `Left per ${U.one}`, note: `${pct(j.margin)} of the price, after the card fee and costs`, tone: losing ? 'bad' : 'good' },
      c.toCover != null ? { value: losing ? 'None' : String(c.toCover), label: `${html.cap(U.many)} a month to cover fixed costs`, note: losing ? 'Every one loses money at this price' : `About ${perWeek} a week. Fixed costs: ${usd(c.fixed)} a month.` } : null,
      c.payback != null ? { value: losing ? 'None' : String(c.payback), label: `${html.cap(U.many)} to earn back startup costs`, note: `Startup costs: ${usd(c.startup)}` } : null,
      c.run.known && c.run.months != null && !c.run.short ? { value: `${c.run.months} mo`, label: 'Cash cushion', note: 'Months of fixed costs your cash covers with no sales', tone: c.run.months >= 3 ? '' : 'warn' } : null,
    ]),
    losing ? html.note(`<b>This price loses money.</b> The card fee and costs come to ${cents(j.fee + j.cost + j.driveCost)} on a ${cents(c.price)} ${U.one}. Raise the price or cut the cost per ${U.one}.`, 'bad') : '',
    html.section({ kicker: 'One payment', title: `Where each ${usd(c.price)} goes`, sub: `${c.m.label}: ${pct(c.m.rate)} plus ${cents(c.m.fixed)} a payment${c.share < 1 ? `, on the ${Math.round(c.share * 100)}% of ${U.many} paid by card` : ''}.${c.miles ? ` Driving counts at the IRS rate, ${c.mileRate * 100} cents a mile.` : ''}`, body: bar }),
    html.section({ kicker: 'Break-even', title: 'What a price change does', sub: c.fixed != null ? `Fixed costs of ${usd(c.fixed)} a month, divided by what each ${U.one} leaves, rounded up.` : 'Add your fixed costs a month to see how many cover them.', body: sens }),
    html.section({ kicker: 'Cushion', title: 'How long your cash lasts', body: cushion }),
    html.section({ kicker: 'Getting paid', title: `Fees on one ${usd(c.price)} payment`, sub: `Standard US rates, checked ${html.dateText(numbers.FEES.checked)}. Your plan can differ: check yours.`, body: fees }),
    html.section({
      kicker: 'Next',
      title: 'Use these numbers',
      body: html.steps([
        { title: 'Keep the spreadsheet', text: 'Change any number in column B and every result updates, including the price table.' },
        { title: 'Put one number where you see it', text: c.toCover && !losing ? `${c.toCover} ${c.toCover === 1 ? U.one : U.many} a month cover your fixed costs. Track it each month.` : `Fix the price first: each ${U.one} has to leave money after costs.` },
        { title: 'Set money aside for taxes', text: 'What is left per job is before taxes. Move a share of each payment to a separate savings account, and check with a tax pro.' },
      ]),
    }),
  ].join('');
  return html.page({
    t,
    title: `Your numbers for ${f.display}`,
    business: f.display,
    kicker: 'Your numbers',
    heading,
    lead: `From the numbers you typed: a ${usd(c.price)} price, ${cents(c.cost)} cost per ${U.one}${c.fixed != null ? ` and ${usd(c.fixed)} of fixed costs a month` : ''}. Before taxes and before paying yourself.`,
    chips: ['Your plan, from your numbers', `Card fees checked ${html.dateText(numbers.FEES.checked)}`],
    body,
    made: f.made,
    foot: [
      'Unit math from your own numbers, not a forecast. Not tax advice: check with a tax pro.',
      `Fee sources: ${html.sourceLinks(Object.values(numbers.FEES.methods).flatMap((m) => m.sources || []))}`,
    ],
  });
}

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const NUM = { type: ['number', 'string'] };

module.exports = {
  name: 'finance.break_even',
  title: 'Find your break-even',
  description: 'From your price, cost per job, how you get paid and your fixed costs: what each job leaves after the card fee, how many jobs a month cover your fixed costs, how many earn back startup costs, and how long your cash lasts.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['price'],
    properties: {
      price: { ...NUM, title: 'Price per job' },
      cost: { ...NUM, title: 'Cost per job (optional)', description: 'Supplies, parking, anything you spend on each job' },
      method: { type: 'string', title: 'How you get paid (optional)' },
      share: { ...NUM, title: 'Share paid by card (optional)', description: 'Like 80%. Leave empty for all of them.' },
      fixed: { ...NUM, title: 'Fixed costs a month (optional)', description: 'A total like 250, or one per line: Insurance 55 a month' },
      startup: { ...NUM, title: 'Startup costs (optional)' },
      cash: { ...NUM, title: 'Cash you can put in (optional)' },
      miles: { ...NUM, title: 'Miles per job, round trip (optional)' },
      minutes: { ...NUM, title: 'Minutes per job (optional)' },
      what: { type: 'string', title: 'What you sell (optional)', maxLength: 200 },
      business: { type: 'string', title: 'Business name (optional)', maxLength: 120 },
      color: { type: 'string', title: 'Brand color (optional)' },
    },
  },
  output: {
    type: 'object',
    required: ['price', 'left', 'files'],
    properties: {
      business: { type: 'string' },
      unit: { type: 'string' },
      units: { type: 'string' },
      price: { type: 'number' },
      fee: { type: 'number' },
      cost: { type: 'number' },
      driveCost: { type: 'number' },
      left: { type: 'number' },
      margin: { type: 'number' },
      method: { type: 'string' },
      losing: { type: 'boolean' },
      fixed: { type: 'number' },
      jobsToCover: { type: 'number' },
      perWeek: { type: 'number' },
      startup: { type: 'number' },
      paybackJobs: { type: 'number' },
      cash: { type: 'number' },
      cashAfterStartup: { type: 'number' },
      runwayMonths: { type: 'number' },
      prices: { type: 'array', items: { type: 'object' } },
      fees: { type: 'array', items: { type: 'object' } },
      files: { type: 'object', properties: { csv: ASSET, html: ASSET } },
    },
  },

  async run(input, ctx) {
    const f = memory.factsOf(ctx, input);
    const c = calc(input, f);
    const sheet = calcSheet(c, f);
    const base = save.fileName(f.name || 'your', 'numbers');
    const csv = await save.saveFile(ctx, `${base.replace(/numbers$/, 'break-even-calculator')}.csv`, sheet.csv);
    const page = await save.saveFile(ctx, `${base}.html`, numbersPage(c, f));
    await memory.saveNumbers(ctx, { price: c.price, cost: c.cost, method: c.m.label, share: c.share, fixed: c.fixed, startup: c.startup, cash: c.cash, minutes: c.minutes || undefined });
    const out = {
      business: f.display,
      unit: f.unit.one,
      units: f.unit.many,
      price: c.price,
      fee: c.job.fee,
      cost: c.job.cost,
      driveCost: c.job.driveCost,
      left: c.job.left,
      margin: Math.round(c.job.margin * 10000) / 10000,
      method: c.m.label,
      losing: c.job.left <= 0,
      prices: c.steps.map((x) => ({ label: x.label, price: x.price, left: x.left, ...(x.cover != null ? { cover: x.cover } : {}) })),
      fees: c.fees.map((x) => ({ label: x.label, fee: x.fee, keep: x.keep })),
      files: { csv, html: page },
    };
    if (c.fixed != null) out.fixed = c.fixed;
    if (c.toCover != null) {
      out.jobsToCover = c.toCover;
      out.perWeek = Math.ceil((c.toCover * 12) / 52 - 1e-9);
    }
    if (c.startup != null) out.startup = c.startup;
    if (c.payback != null) out.paybackJobs = c.payback;
    if (c.run.known) {
      out.cash = c.run.cash;
      out.cashAfterStartup = c.run.afterStartup;
      if (c.run.months != null) out.runwayMonths = c.run.months;
    }
    return out;
  },

  view(out) {
    const U = out.units || 'jobs';
    const Uc = `${U[0].toUpperCase()}${U.slice(1)}`;
    return views.blocks(
      views.metric(`Left per ${out.unit || 'job'}`, cents(out.left), `After the ${cents(out.fee)} card fee and ${cents(out.cost)} cost. Before taxes.`),
      out.jobsToCover != null ? views.metric(`${Uc} a month to cover fixed costs`, out.losing ? 'None at this price' : String(out.jobsToCover), out.losing ? 'Each one loses money now.' : `About ${out.perWeek} a week, for ${usd(out.fixed)} of fixed costs a month.`) : null,
      out.paybackJobs != null && !out.losing ? views.metric(`${Uc} to earn back startup costs`, String(out.paybackJobs), `Startup costs: ${usd(out.startup)}`) : null,
      out.runwayMonths != null ? views.metric('Cash cushion', `${out.runwayMonths} months`, `${usd(out.cashAfterStartup)} after startup costs, with no sales at all.`) : out.cashAfterStartup != null && out.cashAfterStartup < 0 ? views.metric('Short of startup costs', usd(-out.cashAfterStartup), 'Start with the Now list only.') : null,
      out.losing ? views.text(`This price loses money on each ${out.unit || 'job'}. Raise it or cut the cost per ${out.unit || 'job'}.`) : null,
      views.text('Your numbers, from what you typed. Unit math, not a forecast.'),
      {
        ...views.table(
          [
            { key: 'label', label: 'If your price is' },
            { key: 'price', label: 'Price', format: 'money' },
            { key: 'left', label: `Left per ${out.unit || 'job'}`, format: 'money' },
            { key: 'cover', label: `${Uc} a month to cover costs` },
          ],
          out.prices.map((x) => ({ label: x.label, price: x.price, left: x.left, cover: x.left <= 0 ? 'Loses money' : x.cover != null ? String(x.cover) : '' }))
        ),
        title: 'What a price change does',
      },
      { ...views.table([{ key: 'label', label: 'Way to get paid' }, { key: 'fee', label: 'Fee', format: 'money' }, { key: 'keep', label: 'You keep', format: 'money' }], out.fees, 4), title: `Fees on one ${usd(out.price)} payment` },
      views.file(out.files.html, 'Your numbers (printable)'),
      views.file(out.files.csv, 'Break-even calculator (Google Sheets or Excel)')
    );
  },
};
