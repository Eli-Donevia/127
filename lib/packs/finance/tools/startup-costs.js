// finance.startup_costs: what it costs to open, the cheapest way that works first. Sourced ranges
// for the member's type of business (research/niches, checked and dated), the basics every US
// business has, and the member's own items, which always win. Hands over a spreadsheet whose
// totals are live formulas and a printable page in the member's colors.

const { views, save, money } = require('../../_kit');
const startup = require('../lib/startup');
const memory = require('../lib/memory');
const html = require('../lib/html');
const { Sheet } = require('../lib/sheet');

const usd = (v) => money.usd(v);
const WHEN = { now: 'Now', later: 'Later', when: 'If needed' };

function rangeText(i) {
  if (i.low == null && i.high == null) return '';
  if (i.high == null || i.high === i.low) return usd(i.low);
  return `${usd(i.low)} to ${usd(i.high)}`;
}

function planText(i) {
  const v = startup.planOf(i);
  if (i.owned) return 'You have it';
  return v == null ? 'Price this' : usd(v);
}

// The spreadsheet: summary on top (live SUMIFS), every item below with a "Your price" column.
function budgetSheet(r, f) {
  const s = new Sheet();
  s.row([`Startup budget for ${f.display}`]);
  s.row(['Your plan, from your numbers. Type what you will really pay in column F (Your price). Column G and the summary update on their own.']);
  s.row(['When: Now, Later or If needed. How often: One time, Monthly or Yearly. Only Now items count toward cash to open.']);
  s.blank();
  const head = s.row(['Summary', '', '', 'Cheapest that works', 'Top of the range', '', 'In your plan']);
  const rows = {};
  const labels = [
    ['oneTime', 'One-time costs before your first customer'],
    ['monthly', 'Monthly bills'],
    ['yearly', 'Yearly bills (first year paid up front)'],
    ['open', 'Cash to open (one-time costs, first month, first year)'],
    ['fixed', 'Fixed costs a month (monthly bills plus yearly ones divided by 12)'],
    ['later', 'Can wait until after your first customers (one time)'],
  ];
  for (const [k, label] of labels) rows[k] = s.row([label]);
  s.blank();
  const itemsHead = s.row(['Item', 'When', 'How often', 'Cheapest that works', 'Top of the range', 'Your price', 'In your plan', 'Note', 'Source']);
  const first = s.next;
  for (const i of r.items) {
    const n = s.next;
    const yours = i.mine != null ? i.mine : null;
    s.row([
      i.name,
      WHEN[i.stage],
      startup.FREQ_LABEL[i.freq],
      i.from === 'you' && !i.replaced ? null : i.low,
      i.from === 'you' && !i.replaced ? null : i.high != null ? i.high : i.low,
      yours,
      `=IF(F${n}="",D${n},F${n})`,
      i.owned ? 'You have it.' : i.why || i.note || (i.from === 'to price' ? 'Price this before you buy.' : ''),
      i.sources[0] || '',
    ]);
  }
  for (let k = 0; k < 6; k++) {
    const n = s.next;
    s.row(['', 'Now', 'One time', null, null, null, `=IF(F${n}="",D${n},F${n})`, 'Add your own item: type a name and a price.']);
  }
  const last = s.next - 1;
  const R = (col) => s.range(first, col, last, col);
  const sumifs = (col, when, often) => `SUMIFS(${R(col)},${R(2)},"${when}",${R(3)},"${often}")`;
  for (const [col, c] of [[4, 4], [5, 5], [7, 7]]) {
    s.rows[rows.oneTime - 1][col - 1] = `=${sumifs(c, 'Now', 'One time')}`;
    s.rows[rows.monthly - 1][col - 1] = `=${sumifs(c, 'Now', 'Monthly')}`;
    s.rows[rows.yearly - 1][col - 1] = `=${sumifs(c, 'Now', 'Yearly')}`;
    s.rows[rows.open - 1][col - 1] = `=${s.ref(rows.oneTime, col)}+${s.ref(rows.monthly, col)}+${s.ref(rows.yearly, col)}`;
    s.rows[rows.fixed - 1][col - 1] = `=ROUND(${s.ref(rows.monthly, col)}+${s.ref(rows.yearly, col)}/12,2)`;
    s.rows[rows.later - 1][col - 1] = `=${sumifs(c, 'Later', 'One time')}`;
  }
  s.blank();
  s.row(['Not in this budget: card fees. They come out of each payment, so Know your numbers shows them per job.']);
  for (const ref of r.reference) {
    if (ref.low != null) s.row([`For comparison, sources put "${ref.name}" at ${usd(ref.low)} to ${usd(ref.high)}.`, '', '', '', '', '', '', '', ref.sources[0] || '']);
  }
  s.row([`Ranges checked ${r.checked}. Prices change, so check before you buy.`]);
  return { csv: s.toCsv(), cells: { head, itemsHead, first, last, rows } };
}

function budgetPage(r, f, extra) {
  const T = r.totals;
  const t = f.t;
  const now = r.items.filter((i) => i.stage === 'now');
  const later = r.items.filter((i) => i.stage === 'later');
  const when = r.items.filter((i) => i.stage === 'when');
  const freqPill = (i) => html.pill(startup.FREQ_LABEL[i.freq], i.freq === 'once' ? 'muted' : 'warn');
  const nameCell = (i) => ({ html: `${html.esc(i.name)}${i.replaced ? `<br>${html.small(`Your number, in place of "${i.replaced}"`)}` : ''}${i.note && i.from !== 'you' ? `<br>${html.small(i.note)}` : ''}` });

  const nowTable = html.table({
    cols: [{ label: 'Item' }, { label: 'How often' }, { label: 'Cheapest', num: true }, { label: 'Top of range', num: true }, { label: 'In your plan', num: true }],
    rows: now.map((i) => [nameCell(i), { html: freqPill(i) }, i.from === 'you' && !i.replaced ? '' : rangeLow(i), i.from === 'you' && !i.replaced ? '' : rangeHigh(i), { html: i.owned ? html.pill('You have it', 'good') : startup.planOf(i) == null ? html.pill('Price this', 'warn') : html.esc(usd(startup.planOf(i))) }]),
    foot: ['Cash to open', '', usd(T.cashToOpen), usd(T.cashToOpenHigh), usd(T.cashToOpen)],
  });
  const laterTable = later.length
    ? html.table({
        cols: [{ label: 'Item' }, { label: 'How often' }, { label: 'Range', num: true }, { label: 'Why it can wait' }],
        rows: later.map((i) => [i.name, { html: freqPill(i) }, rangeText(i) || 'Price later', i.why]),
      })
    : '';
  const whenTable = when.length
    ? html.table({
        cols: [{ label: 'Item' }, { label: 'How often' }, { label: 'Range', num: true }, { label: 'When it applies' }],
        rows: when.map((i) => [i.name, { html: freqPill(i) }, rangeText(i) || 'Ask for a quote', i.why]),
      })
    : '';

  const body = [
    html.stats([
      { value: usd(T.oneTime), label: 'One-time costs', note: `Top of the range: ${usd(T.oneTimeHigh)}` },
      { value: usd(T.monthly), label: 'Monthly bills', note: T.monthlyHigh !== T.monthly ? `Top of the range: ${usd(T.monthlyHigh)}` : 'At the cheapest that works' },
      { value: usd(T.yearly), label: 'Yearly bills', note: T.yearly ? 'Paid up front, so they count in cash to open' : 'None counted yet' },
      { value: usd(T.fixedMonthly), label: 'Fixed costs a month', note: 'Monthly bills plus yearly ones split by 12. Know your numbers uses this.', tone: 'good' },
    ]),
    r.missing.length || r.skipped.length ? html.note(`<b>To do.</b> ${html.esc([...r.missing, r.skipped.length ? `We couldn't read: ${r.skipped.join('; ')}.` : ''].filter(Boolean).join(' '))}`, 'warn') : '',
    html.section({ kicker: 'Now', title: 'Before your first customer', sub: 'The plan uses the low end of each range: the cheapest way that works. Your own numbers replace it.', body: nowTable }),
    later.length ? html.section({ kicker: 'Later', title: 'After your first customers', sub: T.laterOneTime > 0 ? `Not counted in cash to open. One-time items here add up to ${usd(T.laterOneTime)} at the low end.` : 'Not counted in cash to open.', body: laterTable }) : '',
    when.length ? html.section({ kicker: 'Only if', title: 'Only if it applies to you', sub: 'Not counted. Ask your insurance agent or your state if you are not sure.', body: whenTable }) : '',
    r.notYet.length ? html.section({ kicker: 'Hold off', title: 'Not yet', body: html.checklist(r.notYet) }) : '',
    html.section({
      kicker: 'Not in this budget',
      title: 'Card fees',
      body: html.note(`Card fees come out of each payment, not your startup cash. ${html.esc(extra.feeLine)} Know your numbers shows them per ${html.esc(f.unit.one)}.`),
    }),
    r.reference.filter((x) => x.low != null).length
      ? html.note(`For comparison: ${r.reference.filter((x) => x.low != null).map((x) => `sources put "${html.esc(x.name)}" at ${usd(x.low)} to ${usd(x.high)}`).join('; ')}. Your list is item by item, so it can come in lower.`)
      : '',
    html.section({
      kicker: 'Next',
      title: 'What to do with this',
      body: html.steps([
        { title: 'Open the spreadsheet', text: 'Type what you will really pay in the Your price column. The totals update on their own.' },
        { title: 'Buy only the Now list', text: 'Use what you have, borrow, or buy the low end. Upgrade when your customers pay for it.' },
        { title: 'See your break-even', text: `Run Know your numbers to see how many ${f.unit.many} a month cover your fixed costs.` },
      ]),
    }),
  ].join('');

  const sources = [...new Set(r.items.flatMap((i) => i.sources))];
  return html.page({
    t,
    title: `Startup budget for ${f.display}`,
    business: f.display,
    kicker: 'Startup budget',
    heading: `${usd(T.cashToOpen)} to open, the cheapest way that works`,
    lead: `One-time costs, the first month of bills and the first year of yearly ones${r.typeName ? ` for ${r.typeName.toLowerCase()}` : ''}. The top of the range is ${usd(T.cashToOpenHigh)}.`,
    chips: [r.typeName, `Ranges checked ${html.dateText(r.checked)}`, 'Your plan, from your numbers'],
    body,
    made: f.made,
    foot: [
      `Ranges come from public price pages and guides, checked ${html.esc(r.checked)}. Prices change: check before you buy. Not legal or tax advice.`,
      sources.length ? `Sources: ${html.sourceLinks(sources)}` : '',
    ],
  });
}

function rangeLow(i) {
  return i.low == null ? '' : usd(i.low);
}

function rangeHigh(i) {
  const h = i.high != null ? i.high : i.low;
  return h == null ? '' : usd(h);
}

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };

module.exports = {
  name: 'finance.startup_costs',
  title: 'Price your startup',
  description: 'Lists what it costs to open your type of business, cheapest working option first, from checked sources plus the items you already know. Makes a budget spreadsheet with live totals and a printable page.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', title: 'What do you sell?', description: 'For example "house cleaning" or "mobile car detailing"', maxLength: 200 },
      business: { type: 'string', title: 'Business name (optional)', maxLength: 120 },
      items: { type: 'string', title: 'Costs you already know (optional)', description: 'One per line, like "Vacuum, have it" or "Insurance 55 a month"', maxLength: 4000 },
      price: { type: ['number', 'string'], title: 'Your price per job (optional)' },
      cash: { type: ['number', 'string'], title: 'Cash you can put in (optional)' },
      method: { type: 'string', title: 'How you get paid (optional)' },
      color: { type: 'string', title: 'Brand color (optional)', description: 'A hex color like #2F6FEB' },
    },
  },
  output: {
    type: 'object',
    required: ['startupCosts', 'fixedMonthly', 'items', 'files'],
    properties: {
      business: { type: 'string' },
      typeName: { type: 'string' },
      type: { type: 'string' },
      source: { type: 'string' },
      checked: { type: 'string' },
      startupCosts: { type: 'number' },
      startupHigh: { type: 'number' },
      monthlyCosts: { type: 'number' },
      yearlyCosts: { type: 'number' },
      fixedMonthly: { type: 'number' },
      cashToOpen: { type: 'number' },
      cashToOpenHigh: { type: 'number' },
      laterOneTime: { type: 'number' },
      fixedItems: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' }, freq: { type: 'string' } } } },
      fixedText: { type: 'string' },
      items: { type: 'array', items: { type: 'object' } },
      missing: { type: 'array', items: { type: 'string' } },
      notYet: { type: 'array', items: { type: 'string' } },
      price: { type: 'number' },
      cash: { type: 'number' },
      method: { type: 'string' },
      unit: { type: 'string' },
      files: { type: 'object', properties: { csv: ASSET, html: ASSET } },
    },
  },

  async run(input, ctx) {
    const f = memory.factsOf(ctx, input);
    const numbers = require('../lib/numbers');
    const parse = require('../lib/parse');
    const r = startup.build({ type: f.type, mine: input.items });
    const T = r.totals;
    const m = numbers.method(memory.pick(input.method, f.n.method));
    const feeLine = m.rate || m.fixed ? `${m.label}: ${(m.rate * 100).toFixed(2).replace(/\.?0+$/, '')}% plus ${money.usd(m.fixed, { cents: true })} on each payment.` : 'Cash and checks have no card fee.';

    const sheet = budgetSheet(r, f);
    const page = budgetPage(r, f, { feeLine });
    const base = save.fileName(f.name || 'your', 'startup budget');
    const csv = await save.saveFile(ctx, `${base}.csv`, sheet.csv);
    const page1 = await save.saveFile(ctx, `${base}.html`, page);

    const fixedItems = r.items
      .filter((i) => i.stage === 'now' && (i.freq === 'month' || i.freq === 'year') && startup.planOf(i) != null && startup.planOf(i) > 0)
      .map((i) => ({ name: i.name, amount: startup.planOf(i), freq: i.freq }));
    const price = parse.positive(memory.pick(input.price, f.n.price, f.off.price, f.b.price));
    const cash = parse.positive(memory.pick(input.cash, f.n.cash));

    await memory.saveNumbers(ctx, { startup: T.oneTime, fixed: T.fixedMonthly, bills: T.monthly, type: f.type ? f.type.id : undefined, cash: cash == null ? undefined : cash });
    ctx.log && ctx.log(`Startup budget: ${r.items.length} items, ${T.unknown} still to price.`);

    const out = {
      business: f.display,
      typeName: r.typeName,
      source: r.research ? r.research.from : 'none',
      checked: r.checked,
      startupCosts: T.oneTime,
      startupHigh: T.oneTimeHigh,
      monthlyCosts: T.monthly,
      yearlyCosts: T.yearly,
      fixedMonthly: T.fixedMonthly,
      cashToOpen: T.cashToOpen,
      cashToOpenHigh: T.cashToOpenHigh,
      laterOneTime: T.laterOneTime,
      fixedItems,
      fixedText: fixedItems.map((i) => `${i.name} ${i.amount} ${i.freq === 'year' ? 'a year' : 'a month'}`).join('\n'),
      items: r.items.map((i) => {
        const o = { name: i.name, stage: i.stage, freq: i.freq, owned: i.owned, from: i.from, why: i.why };
        if (i.low != null) o.low = i.low;
        if (i.high != null || i.low != null) o.high = i.high != null ? i.high : i.low;
        if (startup.planOf(i) != null) o.plan = startup.planOf(i);
        return o;
      }),
      missing: [...r.missing, ...(r.skipped.length ? [`We couldn't read: ${r.skipped.join('; ')}.`] : [])],
      notYet: r.notYet,
      method: m.label,
      unit: f.unit.one,
      files: { csv, html: page1 },
    };
    if (f.type) out.type = f.type.id;
    if (price != null && price > 0) out.price = price;
    if (cash != null) out.cash = cash;
    return out;
  },

  view(out) {
    const now = out.items.filter((i) => i.stage === 'now');
    const money2 = (v) => (v == null ? 'Price this' : money.usd(v));
    return views.blocks(
      views.metric('Cash to open', money.usd(out.cashToOpen), `The cheapest way that works. Top of the range: ${money.usd(out.cashToOpenHigh)}.`),
      views.metric('Fixed costs a month', money.usd(out.fixedMonthly), 'Monthly bills plus yearly ones split by 12.'),
      out.laterOneTime > 0 ? views.metric('Can wait', money.usd(out.laterOneTime), 'One-time items to buy after your first customers.') : null,
      views.text(`Your plan, from your numbers${out.typeName ? ` and checked ranges for ${out.typeName.toLowerCase()} (${out.checked})` : ''}. Type your real prices in the spreadsheet and the totals update.`),
      out.missing.length ? views.text(out.missing.join(' ')) : null,
      {
        ...views.table(
          [
            { key: 'name', label: 'Before your first customer' },
            { key: 'often', label: 'How often' },
            { key: 'plan', label: 'In your plan' },
            { key: 'top', label: 'Top of range' },
          ],
          now.map((i) => ({ name: i.name, often: { once: 'One time', month: 'Monthly', year: 'Yearly' }[i.freq], plan: i.owned ? 'You have it' : money2(i.plan), top: i.high == null ? '' : money.usd(i.high) })),
          8
        ),
        title: 'Your startup list',
      },
      views.file(out.files.html, 'Startup budget (printable)'),
      views.file(out.files.csv, 'Startup budget spreadsheet (Google Sheets or Excel)')
    );
  },
};
