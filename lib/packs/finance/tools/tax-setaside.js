// finance.tax_setaside: how much of each payment to move to tax savings (self-employment tax from
// IRS pages, the member's federal bracket and state rate), the next estimated tax due dates, a
// payments log and a mileage log with the IRS rate, and the records to keep. General information
// from IRS pages, checked 2026-10-19. Not tax advice: every output says to check with a tax pro.

const { views, save, money, files } = require('../../_kit');
const numbers = require('../lib/numbers');
const parse = require('../lib/parse');
const memory = require('../lib/memory');
const html = require('../lib/html');
const tax = require('../lib/tax');
const { Sheet } = require('../lib/sheet');

const usd = (v, c) => money.usd(v, c ? { cents: true } : undefined);
const pct = (v) => `${Math.round(v * 10000) / 100}%`;
const BRACKETS = ['10%', '12%', '22%', '24%', '32%', '35%', '37%', 'Not sure'];

function paymentsSheet(c, f) {
  const s = new Sheet();
  s.row([`Payments log and tax set-aside for ${f.display}`]);
  s.row(['Add each payment on its own row. The set-aside and the IRS payment it counts toward fill in on their own. Not tax advice: check with a tax pro.']);
  s.blank();
  const rate = s.row(['Set aside, share of profit', `${Math.round(c.rate * 100)}%`, 'Self-employment tax plus your income tax guesses']);
  const fr = s.row(['Card fee percent', `${numbers.round2(c.m.rate * 100)}%`, `${c.m.label}, checked ${html.dateText(numbers.FEES.checked)}. Type 0 in a row's card fee for cash.`]);
  const ff = s.row(['Card fee per payment', c.m.fixed]);
  s.blank();
  s.row(['Set aside for each IRS payment', 'Amount', 'Due']);
  const sumRows = c.due.map((d) => s.row([`${d.taxYear} payment ${d.payment} (${d.covers})`, '', `${html.dateText(d.date)}${d.published ? '' : ' (check irs.gov)'}`]));
  s.blank();
  s.row(['Date', 'Customer or job', 'Amount paid', 'Card fee', 'Cost for the job', 'Profit', 'Set aside', 'Counts toward']);
  const first = s.next;
  for (let k = 0; k < 40; k++) {
    const r = s.next;
    const ex = k === 0 && c.price;
    s.row([
      ex ? `=DATE(${f.today.slice(0, 4)},${Number(f.today.slice(5, 7))},${Number(f.today.slice(8, 10))})` : '',
      ex ? 'Example: replace with your own' : '',
      ex ? c.price : '',
      `=IF(C${r}="","",ROUND(C${r}*$B$${fr}+$B$${ff},2))`,
      ex ? c.cost : '',
      `=IF(C${r}="","",ROUND(C${r}-D${r}-E${r},2))`,
      `=IF(C${r}="","",ROUND(MAX(0,F${r})*$B$${rate},2))`,
      `=IF(A${r}="","",YEAR(A${r})&" payment "&IF(MONTH(A${r})<=3,1,IF(MONTH(A${r})<=5,2,IF(MONTH(A${r})<=8,3,4))))`,
    ]);
  }
  const last = s.next - 1;
  c.due.forEach((d, i) => {
    s.rows[sumRows[i] - 1][1] = `=SUMIFS($G$${first}:$G$${last},$H$${first}:$H$${last},"${d.taxYear} payment ${d.payment}")`;
  });
  return { csv: s.toCsv(), first, sumRows };
}

function mileageSheet(f) {
  const s = new Sheet();
  const rates = tax.TAX.mileage.rates.filter((r) => r.from >= '2026-01-01');
  s.row([`Mileage log for ${f.display}`]);
  s.row(['One row per business trip: date, where you went, why, and the miles. Write it at the time or weekly. The deduction fills in with the IRS rate for that date.']);
  s.blank();
  s.row(['IRS business rate', 'From', 'To', 'Dollars a mile', 'Source']);
  const rr = rates.map((r) => {
    const [y1, m1, d1] = r.from.split('-').map(Number);
    const [y2, m2, d2] = r.to.split('-').map(Number);
    return s.row([`${html.dateText(r.from)} to ${html.dateText(r.to)}`, `=DATE(${y1},${m1},${d1})`, `=DATE(${y2},${m2},${d2})`, r.rate, r.source || '']);
  });
  const next = s.row(['2027 (type it when the IRS posts it)', '', '', '', 'https://www.irs.gov/tax-professionals/standard-mileage-rates']);
  s.blank();
  s.row(['Date', 'From', 'To', 'Business purpose', 'Miles', 'Rate', 'Deduction']);
  const first = s.next;
  for (let k = 0; k < 60; k++) {
    const r = s.next;
    const ex = k === 0;
    const rateF = rr.reduceRight((acc, row) => `IF(A${r}<=$C$${row},$D$${row},${acc})`, `$D$${next}`);
    s.row([
      ex ? `=DATE(${f.today.slice(0, 4)},${Number(f.today.slice(5, 7))},${Number(f.today.slice(8, 10))})` : '',
      ex ? 'Home' : '',
      ex ? 'Example: a customer across town' : '',
      ex ? 'Example: replace with your own' : '',
      ex ? 12 : '',
      `=IF(A${r}="","",${rateF})`,
      `=IF(OR(A${r}="",E${r}=""),"",ROUND(E${r}*F${r},2))`,
    ]);
  }
  const last = s.next - 1;
  s.blank();
  s.row(['Total miles', `=SUM(E${first}:E${last})`]);
  s.row(['Total deduction at the IRS rate', `=SUM(G${first}:G${last})`]);
  return { csv: s.toCsv(), first };
}

function kitPage(c, f) {
  const t = f.t;
  const T = tax.TAX;
  const next = c.due[0];
  const body = [
    html.stats([
      { value: `${Math.round(c.rate * 100)}%`, label: 'Of profit to set aside', note: c.federalAssumed ? 'Uses a 12% federal bracket until you pick yours' : 'From your bracket and state rate' },
      c.per ? { value: usd(c.per.setAside, true), label: `From each ${usd(c.per.price)} ${f.unit.one}`, note: `Profit ${usd(c.per.profit, true)} after the card fee and costs` } : null,
      { value: html.dateText(next.date), label: 'Next estimated tax due', note: `${next.taxYear} payment ${next.payment}${next.published ? '' : ', check irs.gov'}`, tone: 'warn' },
    ]),
    html.section({
      kicker: 'The set-aside',
      title: `Where ${Math.round(c.rate * 100)}% comes from`,
      sub: 'Rounded up so the cushion errs high. Move it to a separate savings account each time you get paid.',
      body: html.table({
        cols: [{ label: 'Part' }, { label: 'Share of profit', num: true }, { label: 'Where it comes from' }],
        rows: [
          ['Self-employment tax', pct(c.se), '15.3% on 92.35% of profit (IRS)'],
          ['Federal income tax', pct(c.federal), c.federalAssumed ? 'A guess at the 12% bracket. Pick yours when you know it.' : 'Your bracket'],
          ['State income tax', pct(c.state), c.state ? 'Your state rate' : 'Not counted. Add your state rate if your state has one.'],
        ],
        foot: ['Set aside', `${Math.round(c.rate * 100)}%`, 'Rounded up'],
      }),
    }),
    html.section({
      kicker: 'Due dates',
      title: 'Estimated tax payments',
      sub: `You pay as you go, four times a year, when you expect to owe $1,000 or more for the year. ${T.estimated.firstYear || ''}`.trim(),
      body: `<div class="dates">${c.due.map((d, i) => `<div class="date${i === 0 ? ' next' : ''}"><div class="d">${html.esc(html.dateText(d.date))}</div><div class="w">${html.esc(`${d.taxYear} payment ${d.payment}: ${d.covers}`)}${d.published ? '' : '<br>Computed from the IRS rule. Check irs.gov when the new form is out.'}</div></div>`).join('')}</div>`,
    }),
    html.section({ kicker: 'Paying', title: 'How to pay', body: html.checklist(T.estimated.pay) }),
    html.section({ kicker: 'Records', title: 'Keep these', sub: T.records.howLong[0], body: html.checklist(T.records.keep.map((k) => ({ text: k.what, small: k.examples }))) }),
    html.section({ kicker: 'Driving', title: 'Mileage', body: html.note(html.esc(T.mileage.says.join(' '))) }),
    html.section({ kicker: 'Payment apps', title: 'Form 1099-K', body: html.note(html.esc(T.form1099k.says.join(' '))) }),
  ].join('');
  const sources = [...T.selfEmployment.sources, ...T.estimated.sources, ...T.records.sources, T.form1099k.source, ...T.mileage.rates.map((r) => r.source)].filter(Boolean);
  return html.page({
    t,
    title: `Tax kit for ${f.display}`,
    business: f.display,
    kicker: 'Tax kit',
    heading: `Set aside ${Math.round(c.rate * 100)}% of each payment's profit`,
    lead: 'Self-employment tax plus income tax, moved to savings every time you get paid, so the quarterly payment is already there. General information from IRS pages, not tax advice.',
    chips: [`IRS pages checked ${html.dateText(T.checked)}`, 'Check with a tax pro'],
    body,
    made: f.made,
    foot: ['General information from IRS pages, not tax advice. Your situation can differ: check with a tax pro.', `Sources: ${html.sourceLinks(sources)}`],
  });
}

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const NUM = { type: ['number', 'string'] };

module.exports = {
  name: 'finance.tax_setaside',
  title: 'Set aside for taxes',
  description: 'How much of each payment to set aside for taxes (self-employment tax from IRS pages plus your bracket), the next estimated tax due dates, a payments log, a mileage log with the IRS rate, and the records to keep. Not tax advice.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      bracket: { type: 'string', title: 'Your federal tax bracket (optional)', enum: BRACKETS, default: 'Not sure' },
      stateRate: { ...NUM, title: 'Your state income tax rate (optional)', description: 'Like 3.5%. Leave empty if you are not sure.' },
      price: { ...NUM, title: 'Price per job (optional)' },
      cost: { ...NUM, title: 'Cost per job (optional)' },
      method: { type: 'string', title: 'How you get paid (optional)' },
      what: { type: 'string', title: 'What you sell (optional)', maxLength: 200 },
      business: { type: 'string', title: 'Business name (optional)', maxLength: 120 },
      color: { type: 'string', title: 'Brand color (optional)' },
    },
  },
  output: {
    type: 'object',
    required: ['rate', 'due', 'files'],
    properties: {
      business: { type: 'string' },
      rate: { type: 'number' },
      se: { type: 'number' },
      federal: { type: 'number' },
      federalAssumed: { type: 'boolean' },
      state: { type: 'number' },
      perPayment: { type: 'object' },
      due: { type: 'array', items: { type: 'object' } },
      files: { type: 'object', properties: { html: ASSET, payments: ASSET, mileage: ASSET, calendar: ASSET } },
    },
  },

  async run(input, ctx) {
    const f = memory.factsOf(ctx, input);
    const a = tax.setAside({ bracket: memory.pick(input.bracket !== 'Not sure' ? input.bracket : undefined, f.n.bracket), stateRate: parse.percent(memory.pick(input.stateRate, f.n.stateRate), 0) });
    const price = parse.positive(memory.pick(input.price, f.n.price, f.off.price, f.b.price));
    const cost = parse.positive(memory.pick(input.cost, f.n.cost)) || 0;
    const m = numbers.method(memory.pick(input.method, f.n.method));
    const c = { ...a, price, cost, m, due: tax.upcoming(f.today, 4) };
    if (price > 0) {
      const fee = numbers.feeOn(price, m);
      const profit = numbers.round2(price - fee - cost);
      c.per = { price, fee, cost, profit, setAside: numbers.round2(Math.max(0, profit) * a.rate) };
    }
    const base = save.fileName(f.name || 'your', 'tax kit');
    const page = await save.saveFile(ctx, `${base}.html`, kitPage(c, f));
    const payments = await save.saveFile(ctx, `${save.fileName(f.name || 'your', 'payments log')}.csv`, paymentsSheet(c, f).csv);
    const mileage = await save.saveFile(ctx, `${save.fileName(f.name || 'your', 'mileage log')}.csv`, mileageSheet(f).csv);
    const events = c.due.flatMap((d) => [
      { uid: `finance-tax-${d.date}@127group.io`, date: d.date, title: `Estimated tax due: ${d.taxYear} payment ${d.payment}`, description: `Pay from your tax savings with IRS Direct Pay (irs.gov/directpay). Covers ${d.covers}.${d.published ? '' : ' Date computed from the IRS rule: check irs.gov.'} Not tax advice.` },
      { uid: `finance-tax-${d.date}-week@127group.io`, date: tax.addDays(d.date, -7), title: `Tax payment in a week: check your set-aside`, description: `Estimated tax ${d.taxYear} payment ${d.payment} is due ${html.dateText(d.date)}.` },
    ]);
    const calendar = await save.saveFile(ctx, `${save.fileName(f.name || 'your', 'tax dates')}.ics`, files.ics(events, { name: 'Tax dates', now: ctx.now ? ctx.now() : Date.now() }));
    await memory.saveNumbers(ctx, { bracket: a.federalAssumed ? undefined : `${Math.round(a.federal * 100)}%`, stateRate: a.state || undefined });
    const out = {
      business: f.display,
      rate: a.rate,
      se: Math.round(a.se * 10000) / 10000,
      federal: a.federal,
      federalAssumed: a.federalAssumed,
      state: a.state,
      due: c.due.map((d) => ({ date: d.date, label: html.dateText(d.date), payment: `${d.taxYear} payment ${d.payment}`, covers: d.covers, published: d.published })),
      files: { html: page, payments, mileage, calendar },
    };
    if (c.per) out.perPayment = c.per;
    return out;
  },

  view(out) {
    return views.blocks(
      views.metric('Set aside for taxes', `${Math.round(out.rate * 100)}% of profit`, out.federalAssumed ? 'Uses a 12% federal bracket until you pick yours.' : 'From your bracket and state rate.'),
      out.perPayment ? views.metric(`From each ${usd(out.perPayment.price)} payment`, usd(out.perPayment.setAside, true), `Profit ${usd(out.perPayment.profit, true)} after the card fee and costs.`) : null,
      views.metric('Next estimated tax due', out.due[0].label, `${out.due[0].payment}, covers ${out.due[0].covers}.`),
      views.text('General information from IRS pages, checked Oct 19, 2026. Not tax advice: check with a tax pro.'),
      { ...views.table([{ key: 'label', label: 'Due' }, { key: 'payment', label: 'Payment' }, { key: 'covers', label: 'Covers' }, { key: 'check', label: '' }], out.due.map((d) => ({ ...d, check: d.published ? 'IRS date' : 'Check irs.gov' })), 4), title: 'Estimated tax due dates' },
      views.file(out.files.html, 'Tax kit (printable)'),
      views.file(out.files.payments, 'Payments log with set-aside (spreadsheet)'),
      views.file(out.files.mileage, 'Mileage log with the IRS rate (spreadsheet)'),
      views.file(out.files.calendar, 'Tax due dates for your calendar')
    );
  },
};
