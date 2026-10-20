# Daily numbers (`kpi`)

The member's daily and weekly numbers in one place, from the exports they already have. Code tools only: no AI,
no network today, no keys needed. Every page is static HTML and CSS (no scripts, `@page` Letter, member colors);
every sheet is a CSV. Revenue only ever appears as the member's own past numbers: no forecasts, no "you'll make".

`held: true` is set on the pack object (contract v1.10 registers it only when env `PACKS_ON` names it). `dev/lint.js`
and the engine sweep accept the field.

## Workflows

| id | title | tier | steps (tool) | credits |
|---|---|---|---|---|
| `kpi.daily_report` | Daily numbers report | free (starter) | report (`daily_report`) | 1 |
| `kpi.set_scorecard` | Set up my scorecard | builder | propose (`propose_scorecard`), pick (approve, max 8), save (`save_scorecard`) | 2 |
| `kpi.weekly_report` | Weekly numbers report | builder | week (`weekly_report`) | 2 |
| `kpi.numbers_skill` | Get your numbers skill for Claude | builder | skill (`numbers_skill`) | 1 |
| `kpi.goal_tracker` | Goal tracker | builder | goals (`goal_progress`) | 1 |
| `kpi.cash_by_week` | Cash in and out by week | builder | cash (`cash_weeks`) | 1 |
| `kpi.refund_watch` | Refunds and chargebacks watch | builder | watch (`refund_watch`) | 1 |

## Tools

All take `files` (asset ids of CSV/TSV exports, up to 12). With no files they read the connected accounts (dormant,
see below), else the sample business. Every output carries `sources` [{name, kind, label, from, to, rows}], `notes` [] and `sample`.

- **`kpi.daily_report`**: in `files`, `type`, `targets`. Report day = yesterday in the member's time zone (or the newest
  day in the files, with `stale` days). Each scorecard number against the 7 days before. out `day`, `base`, `rows`
  [{metric, now, base, change, verdict, target}], `moved` (up to 3, with the reason from the same files), `next` {text, why},
  `headline`, `stale`, `html`, `csv`. Ads without a day breakdown are left out of the day, with a note.
- **`kpi.propose_scorecard`**: in `files`, `type`. Up to 16 options for the business type (`data/scorecards.json`), only
  numbers the files can show, each with last 7 days and why. out `type`, `typeLabel`, `options`, `missing`.
- **`kpi.save_scorecard`**: in `picks`, `type`, `targets` (plain lines: "Sales 400 a day", "Refund rate under 3%"), `sample`.
  Remembers `scorecard` {type, metrics, targets, on} unless the run used sample data. out `metrics`, `noTarget`, `html`, `csv`.
- **`kpi.weekly_report`**: last full week (Monday to Sunday) against the 4 weeks before; up to 3 next steps; products,
  posts and ads by campaign. out `week`, `rows`, `moved`, `next` [], `products`, `posts`, `ads`, `headline`, `html`, `csv`.
- **`kpi.numbers_skill`**: a ZIP with one folder `<business>-daily-numbers/` holding `SKILL.md` (name at most 64 characters,
  description at most 200), `reference/exports.md`, `reference/next-steps.md`, `reference/scorecard.csv`; also the SKILL.md
  alone. When the 127 connector is on in Claude, the skill calls `kpi.daily_report` through it. out `name`, `description`,
  `skill`, `zip`, `md`, `metrics`, `steps`.
- **`kpi.goal_progress`**: each target this day, week or month so far: Hit, On pace, Behind, Under so far, Over; what is left
  and per day; how often it was hit lately. out `asOf`, `goals`, `headline`, `html`, `csv` (null when no targets).
- **`kpi.cash_weeks`**: in, refunds, chargebacks, fees, ads, logged costs, left, moved to bank, by week. CSV Out and Left are
  formulas. Says on the page it is not a profit and loss.
- **`kpi.refund_watch`**: refunds and chargebacks by week, products refunded most, open chargebacks with due dates, steps.
  The one outside figure is Stripe's 0.75% dispute line (`docs.stripe.com/disputes/measuring`, checked 2026-10-20).

## What reads real data, and how

The member uploads exports; `lib/readers.js` tells them apart by the header row (it finds the header in the first 6
rows, so Google Ads title lines are fine), reads UTF-8 or UTF-16, comma, tab or semicolon, and refuses Excel files with
a plain message. Duplicate files (same bytes) count once. Customer names, emails, phones and addresses are never read.

| export | how it is told apart | column names checked |
|---|---|---|
| Stripe payments | id, Created date (UTC), Amount, Amount Refunded, Fee, Status | memory (Stripe's help does not list them) |
| Stripe balance activity | balance_transaction_id, created, gross, fee, net, reporting_category (or older Type, Amount, Net) | docs: docs.stripe.com/reports/balance, reporting-categories |
| Shopify orders | Name, Financial Status, Total, Created at, Lineitem name | docs: help.shopify.com, exporting orders |
| Square transactions | Date, Time, Gross Sales, Net Sales, Total Collected, Fees, Event Type, Transaction ID | community posts (Square's help does not list them) |
| PayPal activity | Date, Time, TimeZone, Name, Type, Status, Gross, Fee, Net, Transaction ID | community, PayPal developer page describes fields |
| Meta ads | Campaign name or Ad name, Amount spent (USD), Impressions, Results | memory |
| Google Ads | title line, date range, Campaign, Impr., Clicks, Cost, Conversions; Total rows skipped | memory |
| Instagram posts (Business Suite) | Post ID, Account username, Description, Publish time, Permalink, Post type | memory (Views or Impressions both read) |
| TikTok posts | Video title, Video link, Post time, Total views | memory |
| Posts sheet, numbers sheet (date, metric, value), daily sheet (Date first) | own formats | 127 |

Details and the "how to export" lines members see are in `data/exports.json` (checked 2026-10-20). Readers match loosely
so close variants work. Both Stripe files: sales from payments, only payouts from balance. Shopify plus Stripe or PayPal:
a note that store sales may count twice.

## Connected accounts

Tools declare `wants: ['stripe', 'shopify']`. Per contract v1.10 section 6 and the Hub patch
(`v2/turnkey/hub/`, Oct 20), `ctx.secret('stripe')` and `ctx.secret('shopify')` return a client for the
member's own account, never the key, or null until they connect. `lib/connected.js` reads, when a client is there:

- Stripe: `balanceTransactions({ sinceDays: 120, limit: 3000 })` -> sales, refunds, chargebacks (adjustments
  described as disputes), fees, payouts.
- Shopify: `orders({ sinceDays: 120, limit: 250 })` -> sales and line items. The client has no refund lines, so a
  fully refunded order counts its total and a partly refunded one shows no refund (the CSV export has the amount).

Connected data is used only when the member added no files. Today the harness's `connectors` module isn't in
`v2/harness` yet, so every run reads files or the sample. Both mappers are tested on the client shape and on raw
API objects.

## Shared readers (the cmo pack)

`cmo` requires `../../kpi/lib/readers`, `ledger`, `metrics`, `report` and `page` by path, so both packs read exports the
same way. BUILDING.md says not to require another pack's files; this was the brief's choice. Holding or removing `kpi`
(`release.js --hold kpi`) breaks `cmo`. Kit ask: move `lib/table.js`, `readers.js`, `ledger.js`, `metrics.js` to
`_kit/exports/`.

## Sample data

`sample/*.csv` is a made-up candle shop, Juniper Lane Candles (juniperlane.example), Aug 3 to Oct 18, 2026, with every
export above in its real column names. Dates shift so the last day is yesterday. Made by a deterministic script, no
real people; emails are `@example.com` and never read. Sample runs are labeled and never save a scorecard.

## What is kept, and AI

- Kept: `brain.packs.kpi.scorecard` {type, metrics, targets, on}. Uploaded files stay where HQ keeps assets; reports and
  CSVs are saved to the member's files.
- No tool in this pack calls an AI.

## Asks

- Harness: Shopify `orders()` could return refund amounts (`refunds[].transactions`), and more than one page.
- Harness: `suggestSchedule` is left off on purpose: a repeat would reuse the same uploaded file. Add it to
  `kpi.daily_report` (daily, morning) and `kpi.weekly_report` (Mondays) once the accounts are wired.
- Kit: shared export readers (above).
