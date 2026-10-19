# Money desk (`finance`)

Unit math and plans from the member's own numbers. Code tools only (no AI, no keys, no network), 1 credit each.
Every page is static HTML and CSS (no scripts, `@page` Letter, member colors); every spreadsheet is a CSV whose
cells starting with `=` are live formulas in Google Sheets, Excel and LibreOffice (only SUM, SUMIFS, ROUND,
ROUNDUP, ROUNDDOWN, MAX, MIN, IF, AND, OR, DATE, MONTH, YEAR). No income claims: results are per job, counts of
jobs, or "your plan, from your numbers".

## Workflows

| id | title | tier | steps (tool) | credits |
|---|---|---|---|---|
| `finance.know_your_numbers` | Know your numbers | free | numbers (`break_even`) | 1 |
| `finance.startup_budget` | Price your startup | builder | costs (`startup_costs`), numbers (`break_even`, when a price is known) | 2 |
| `finance.twelve_month_plan` | Plan your first 12 months of cash | builder | costs, numbers, plan (`cash_plan`) | 3 |
| `finance.tax_ready` | Get tax ready | builder | taxes (`tax_setaside`) | 1 |

## Tools

Numbers may be numbers or strings ("$1,200", "1.2k", "80%"). Unknown values are left out of outputs, never `null`.
Order for every number: this run's input, then `brain.packs.finance.numbers`, then the offer pack's price, then the brain.

**`finance.startup_costs`** (Price your startup)
- in: `what`, `business`, `items` (lines: "Vacuum, have it", "Insurance 55 a month"), `price`, `cash`, `method`, `color`
- out: `startupCosts` (one-time, Now), `startupHigh`, `monthlyCosts`, `yearlyCosts`, `fixedMonthly` (monthly + yearly/12),
  `cashToOpen`, `cashToOpenHigh`, `laterOneTime`, `fixedItems` [{name, amount, freq month|year}], `fixedText`,
  `items` [{name, stage now|later|when, freq, low?, high?, plan?, owned, from you|research|basic|to price, why}],
  `missing` [], `notYet` [], `typeName`, `type`, `source` research|snapshot|none, `checked`, `price?`, `cash?`, `method`, `unit`,
  `files` {csv, html}
- Ranges: `research/niches/<type>.json` when present (else `data/niches.json` snapshot), plus `data/basics.json`. A member
  item replaces the closest listed item. "Later" and "only if" items are listed, never counted. No research for the type:
  a list of things to price. Card fees are left out (they are per payment).

**`finance.break_even`** (Find your break-even)
- in: `price` (required), `cost`, `method`, `share`, `fixed` (number or lines), `startup`, `cash`, `miles`, `minutes`, `what`, `business`, `color`
- out: `price`, `fee`, `cost`, `driveCost`, `left`, `margin`, `method`, `losing`, `fixed?`, `jobsToCover?`, `perWeek?`,
  `startup?`, `paybackJobs?`, `cash?`, `cashAfterStartup?`, `runwayMonths?`, `prices` [price -10%, as is, +10%, +20%],
  `fees` [every way to get paid, cheapest first], `unit`, `units`, `files` {csv, html}

**`finance.cash_plan`** (Plan 12 months of cash)
- in: `jobsPerWeek` (required, the member's number), `slow`, `best` (else examples: half and 1.5 times, marked Example),
  `price`, `cost`, `method`, `share`, `cash`, `startup`, `fixed` or `fixedItems`, `taxRate` (default 27%), `start` (YYYY-MM, default next month), `what`, `business`, `color`
- out: `months` [{label, slow, expected, best (cash at month end), jobs}], `lowest` {slow, expected, best: {label, cash}},
  `firstBelowZero` {case: month}, `jobsToCover?`, `perWeek`, `examples` [], `units`, `files` {csv, html}
- Yearly costs are paid in their "month paid" (month 1 by default). Taxes: the set-aside share of each month's profit.

**`finance.tax_setaside`** (Set aside for taxes)
- in: `bracket` (10%...37% or Not sure = 12% assumed), `stateRate`, `price`, `cost`, `method`, `what`, `business`, `color`
- out: `rate` (rounded up), `se` (0.1413), `federal`, `federalAssumed`, `state`, `perPayment?` {price, fee, cost, profit, setAside},
  `due` [next 4: {date, label, payment, covers, published}], `files` {html, payments csv, mileage csv, calendar ics (zipped by the Library)}

## Verified data (checked 2026-10-19, sources in each file)

- `data/fees.json`: Square 2.6% + 15c in person, 3.3% + 30c online/invoice, 3.5% + 15c keyed; Stripe 2.9% + 30c online, 2.7% + 5c in person;
  PayPal 3.49% + 49c; Venmo business 1.9% + 10c.
- `data/tax.json`: SE tax 15.3% on 92.35% (2026 wage base $184,500); 2026 due dates Apr 15, Jun 15, Sep 15, Jan 15 2027 (Form 1040-ES);
  2027 dates computed by the IRS rule (next business day, DC holidays) and labeled "check irs.gov"; mileage 72.5c (Jan to Jun 2026),
  76c (Jul to Dec 2026, IRB 2026-29); 2027 rate left blank. 1099-K and record-keeping lines from IRS pages.
- `data/basics.json`: EIN free, Google Business Profile free, license and bank "check your state and city / current rates".

## Dev

- `node packs/finance/lib/niches.js --sync` refreshes `data/niches.json` from research (run after research adds a type).
- Tests: `node --test packs/finance/test/finance.test.js` (packSuite plus formula checks: `lib/sheet.js evaluate` recomputes every CSV
  and must match the tool's numbers with no formula errors; LibreOffice agreed on all 404 formulas in the sample files).
- Local helpers that could move to the kit: `lib/sheet.js` (CSV with formulas + evaluator), `lib/tax.js` (IRS due-date rule).
