// Money desk: what it costs to open, what each job leaves, how many jobs cover the bills, and a
// 12-month cash plan, all from the member's own numbers. Card fees are verified US rates
// (data/fees.json, checked 2026-10-19); startup ranges come from research/niches with sources.

const { METHOD_LABELS, FEES } = require('./lib/numbers');

const METHOD = { type: 'string', title: 'How most customers pay you', enum: METHOD_LABELS, default: FEES.methods[FEES.default].label };
const WHAT = { type: 'string', title: 'What do you sell?', description: 'For example "house cleaning" or "mobile car detailing"', maxLength: 200 };
const BUSINESS = { type: 'string', title: 'Business name (optional)', maxLength: 120 };
const PRICE = { type: 'number', title: 'Your price per job', description: 'What one customer pays for one job or visit', minimum: 1 };
const COST = { type: 'number', title: 'Cost per job (optional)', description: 'Supplies, parking, anything you spend on each job', minimum: 0 };
const CASH = { type: 'number', title: 'Cash you can put in (optional)', minimum: 0 };
const ITEMS = { type: 'string', title: 'Costs you already know (optional)', description: 'One per line, like "Vacuum, have it" or "Insurance 55 a month"', maxLength: 4000 };

module.exports = {
  id: 'finance',
  title: 'Money desk',
  version: '0.1.0',
  summary: 'What it costs to open, what each job leaves after fees, how many jobs cover your bills, a 12-month cash plan from your own numbers, and what to set aside for taxes.',
  niches: [],
  tools: [require('./tools/break-even'), require('./tools/startup-costs'), require('./tools/cash-plan'), require('./tools/tax-setaside')],
  workflows: [
    {
      id: 'finance.know_your_numbers',
      title: 'Know your numbers',
      promise: 'What each job leaves after card fees and costs, and how many jobs a month cover your bills. Two minutes, your numbers.',
      minutes: 2,
      tier: 'free',
      inputs: {
        type: 'object',
        required: ['price'],
        properties: {
          price: PRICE,
          cost: COST,
          method: METHOD,
          fixed: { type: 'string', title: 'Your monthly bills (optional)', description: 'A total like 150, or one per line: Insurance 55 a month', maxLength: 2000 },
          startup: { type: 'number', title: 'Startup costs (optional)', minimum: 0 },
          cash: CASH,
          what: WHAT,
          business: BUSINESS,
        },
      },
      steps: [
        {
          id: 'numbers',
          tool: 'finance.break_even',
          input: { price: '$inputs.price', cost: '$inputs.cost', method: '$inputs.method', fixed: '$inputs.fixed', startup: '$inputs.startup', cash: '$inputs.cash', what: '$inputs.what', business: '$inputs.business' },
        },
      ],
      result: ['numbers'],
      next: ['finance.startup_budget', 'finance.twelve_month_plan'],
    },
    {
      id: 'finance.startup_budget',
      title: 'Price your startup',
      promise: 'Everything it costs to open, cheapest way that works first, from checked sources and your own items. A budget sheet with live totals.',
      minutes: 10,
      tier: 'builder',
      inputs: {
        type: 'object',
        required: ['what'],
        properties: { what: WHAT, items: ITEMS, price: { ...PRICE, title: 'Your price per job (optional)' }, cost: COST, cash: CASH, method: METHOD, business: BUSINESS },
      },
      steps: [
        { id: 'costs', tool: 'finance.startup_costs', input: { what: '$inputs.what', items: '$inputs.items', price: '$inputs.price', cash: '$inputs.cash', method: '$inputs.method', business: '$inputs.business' } },
        {
          id: 'numbers',
          tool: 'finance.break_even',
          when: '$costs.price',
          input: { price: '$costs.price', cost: '$inputs.cost', method: '$inputs.method', fixed: '$costs.fixedMonthly', startup: '$costs.startupCosts', cash: '$costs.cash', what: '$inputs.what', business: '$inputs.business' },
        },
      ],
      result: ['costs', 'numbers'],
      next: ['finance.twelve_month_plan'],
    },
    {
      id: 'finance.twelve_month_plan',
      title: 'Plan your first 12 months of cash',
      promise: 'A 12-month cash plan from your numbers, with a slow, expected and best case you set. A spreadsheet that updates when you change a number.',
      minutes: 15,
      tier: 'builder',
      inputs: {
        type: 'object',
        required: ['what', 'price', 'jobsPerWeek'],
        properties: {
          what: WHAT,
          price: PRICE,
          jobsPerWeek: { type: 'number', title: 'Jobs a week you expect', description: 'Your own number. You can change it any time in the spreadsheet.', minimum: 0, maximum: 200 },
          slow: { type: 'number', title: 'Jobs a week in a slow stretch (optional)', minimum: 0, maximum: 200 },
          best: { type: 'number', title: 'Jobs a week in a busy stretch (optional)', minimum: 0, maximum: 200 },
          cost: COST,
          cash: CASH,
          items: ITEMS,
          method: METHOD,
          start: { type: 'string', title: 'First month of the plan (optional)', description: 'Like 2026-11. Leave empty for next month.', maxLength: 20 },
          business: BUSINESS,
        },
      },
      steps: [
        { id: 'costs', tool: 'finance.startup_costs', input: { what: '$inputs.what', items: '$inputs.items', price: '$inputs.price', cash: '$inputs.cash', method: '$inputs.method', business: '$inputs.business' } },
        {
          id: 'numbers',
          tool: 'finance.break_even',
          input: { price: '$inputs.price', cost: '$inputs.cost', method: '$inputs.method', fixed: '$costs.fixedMonthly', startup: '$costs.startupCosts', cash: '$inputs.cash', what: '$inputs.what', business: '$inputs.business' },
        },
        {
          id: 'plan',
          tool: 'finance.cash_plan',
          input: {
            jobsPerWeek: '$inputs.jobsPerWeek',
            slow: '$inputs.slow',
            best: '$inputs.best',
            price: '$inputs.price',
            cost: '$inputs.cost',
            method: '$inputs.method',
            cash: '$inputs.cash',
            startup: '$costs.startupCosts',
            fixedItems: '$costs.fixedItems',
            start: '$inputs.start',
            what: '$inputs.what',
            business: '$inputs.business',
          },
        },
      ],
      result: ['plan', 'numbers', 'costs'],
      next: ['finance.tax_ready'],
    },
    {
      id: 'finance.tax_ready',
      title: 'Get tax ready',
      promise: 'What to set aside from each payment, your next estimated tax dates on your calendar, and a payments log and mileage log. Not tax advice.',
      minutes: 10,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          bracket: { type: 'string', title: 'Your federal tax bracket', description: 'Pick Not sure and we use 12% until you know', enum: ['10%', '12%', '22%', '24%', '32%', '35%', '37%', 'Not sure'], default: 'Not sure' },
          stateRate: { type: 'number', title: 'Your state income tax rate in percent (optional)', minimum: 0, maximum: 15 },
          price: { ...PRICE, title: 'Your price per job (optional)' },
          cost: COST,
          method: METHOD,
          what: WHAT,
          business: BUSINESS,
        },
      },
      steps: [
        { id: 'taxes', tool: 'finance.tax_setaside', input: { bracket: '$inputs.bracket', stateRate: '$inputs.stateRate', price: '$inputs.price', cost: '$inputs.cost', method: '$inputs.method', what: '$inputs.what', business: '$inputs.business' } },
      ],
      result: ['taxes'],
      next: ['finance.know_your_numbers'],
    },
  ],
};
