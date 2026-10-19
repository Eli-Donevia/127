# Sales desk (`sales`)

Quotes, invoices and proposals in the member's own colors, a sales call script with answers to what buyers say, and payment reminders. Everything is a draft: the member sends it from their own email or phone, and buyers pay the member directly through the member's own payment link. 127 never takes payment.

## Workflows

| Id | Title | Tier | Credits per run | Makes |
|---|---|---|---|---|
| `sales.send_quote` | Send a quote in 2 minutes | free | 1 | quote HTML (Letter or A4), line items CSV, follow-up reminders (.ics, zipped by the Library), email and text |
| `sales.send_invoice` | Send an invoice and get paid | builder | 2 | invoice HTML with pay button and QR code, line items CSV, reminder calendar (.ics), who-owes-me CSV, email and text |
| `sales.send_proposal` | Write a proposal from their facts | builder | 8 | proposal HTML (three options, most complete first, accept block), cover email and text |
| `sales.call_prep` | Prep a sales call in 5 minutes | builder | 8 | call sheet HTML, script .txt, the ten objections with answers |
| `sales.get_paid` | Chase every open invoice | builder | 1 | reminder for each open invoice on the right day, calendar (.ics), CSV |

All runs are far under the 300-credit cap. No keys are needed. AI (task `write`) only tailors wording in `sales.proposal` and `sales.call_script`; facts and prices never come from AI, and without AI the templates use the member's real facts.

## Tools (inputs and outputs other packs can rely on)

### `sales.quote` and `sales.invoice` (code, 1 credit each, needs nothing)

Every business pack can send its line items here (kit `quote.quote()` returns this exact item shape).

Input (all optional except that there must be at least one priced line from `items`, `lines`, a quote, or the member's saved price):

- `items`: `[{ label (string), detail (string), qty (number, default 1), unit (string: job, hour, visit, month, item...), price (number, unit price in dollars, negative for a discount), taxable (boolean, default true) }]`
- `lines`: string, one item per line, typed the way people type: `Full detail, 180`, `2 x Window cleaning @ 45`, `3 hours design at $60/hour`, `First-time discount, -20`, `Travel fee, included`. CSV with a header row also works.
- `customer`: `{ name, email, phone, address, company, contact }` (`contact` is email and/or phone typed together; it is split for you)
- `title`, `notes`
- `taxRate`: number or string. `0.0825`, `8.25` or `"8.25%"` all mean 8.25%. Empty means the saved rate, else none.
- `deposit`: number or string. `0.5` or `"50%"` is half; `"$100"` is a fixed amount. `depositAmount`: dollars.
- `due`: `YYYY-MM-DD`. Invoice: due date. Quote: last day the price holds.
- `payLink` (https only: Stripe Payment Links, Square, PayPal.Me...), `payNote` ("Zelle to ... or cash on the day")
- `contact` (the member's email and phone line), `from: { name, email, phone, website, address }`, `address`, `color` (hex), `terms`, `currency` (3 letters), `number` (override), `date` (`YYYY-MM-DD`), `remember` (default true: saves pay link, tax, deposit, contact for next time)
- quote only: `validDays` (1 to 120, default 14)
- invoice only: `dueDays` (0 to 120, default 14; 0 = due on receipt), `paid` (dollars already paid), `quote` (a `sales.quote` output from an earlier step), `fromQuote` (`"last"` or a quote number like `Q-2026-004` the desk remembers)

Business name, colors (brand pack palette, else a niche mood), contact and payment link come from the brain and the desk's memory when the input leaves them out.

Output: `kind`, `number` (Q-2026-001 / INV-2026-001; the same customer and lines keep their number), `date`, `validUntil`, `due`, `reused`, `customer {name,email,phone,address,company}`, `title`, `currency`, `items [{label,detail,qty,unit,price,amount,taxable}]`, `subtotal`, `taxRate`, `tax`, `total`, `depositRate`, `deposit`, `paid`, `dueNow`, `balance` (dollars), `totalText`, `dueNowText`, `depositText`, `payLink`, `business`, `quoteRef`, `message {subject,email,text}`, `messages [{label,channel,to,subject,text}]`, `files {html,csv,reminders}` (assets), `warnings [string]`.

Math is in cents; tax rounds half up on the taxable lines after discounts.

### `sales.payment_reminders` (code, 1 credit)

Input: `invoice` (a `sales.invoice` output), `list` (one per line: `Marcus Lee, INV-2026-002, $129.90, due Oct 16, marcus@mail.example`), `useSaved` (default true: open invoices the desk remembers), `payLink`, `payNote`.
Output: `count`, `late`, `owed`, `owedText`, `reminders [{customer, number, email, phone, amount, amountText, due, daysLate, status, sendOn, step, message {subject,email,text}, later [{date, step}]}]`, `files {calendar, csv}`, `warnings`.
Schedule: 2 days before due, due day, 3 and 10 days after; weekends move to a weekday; a late invoice gets its first nudge today. No late fees, threats or collections language.

### `sales.read_prospect` (api, 2 credits, needs nothing)

Input: `name`, `website`, `notes`. Reads the prospect's own public pages with the kit scan (robots respected, a few pages, cached a week).
Output: `name, website, domain, reachable, reason, readOn, about, services [string], prices [{amount, per, context}], people [{name, role}], phone, email, hours, socials {}, colors [hex], gaps [{key, label}], relevant [{key, label}] (top 4 for the member's kind of work), facts [string] (dated, sourced), notes [string]`. Offline, blocked or parked sites return `reachable: false` with the reason and nothing invented.

### `sales.proposal` (ai write, 6 credits)

Input: `name`, `company`, `email`, `phone`, `notes`, `goals` (one per line), `title`, `prospect` (a `sales.read_prospect` output), `options` (`[{name, price, unit, summary, includes [string]}]`) or `optionsText` (`Complete, 720 per visit, full detail; clay and sealant` per line), `price` (builds three options from it when none are given, flagged to check), `deposit`, `taxRate`, `payLink`, `payNote`, `contact`, `color`, `terms`, `validDays` (default 14), `number`.
Output: `number` (P-2026-001), `date`, `validUntil`, `title`, `prospect {name, company, email, phone, website}`, `options [{key, name, price, unit, per, priceText, summary, includes, recommended}]` (most complete first, the middle one recommended), `built`, `depositRate`, `heard`, `noticed`, `files {html}`, `message {subject, email, text}`, `warnings`, `ai`.

### `sales.call_script` (ai write, 6 credits)

Input: `name`, `company`, `notes`, `optionsText`, `price`, `deposit`, `prospect`.
Output: `steps [{n, name, goal, say [], ask [], listen, branches [{if, then}], avoid}]` (six steps: Why they're here, Name the problem, What they've tried, Where they want to be, Clear the worries, Lock in the yes), `objections [{key, label, says, means, answer, ask, avoid}]` (ten: price, think about it, timing, partner, decision maker, time, tried before, plus the three most common for the member's kind of work, ranked by the notes), `options`, `files {html, text}`, `warnings`, `ai`.

## What's real, what's sample

- Real: all math, numbering, dates, the documents, the reminders and calendar files, and every fact read from a prospect's own website (dated). The objection answers and script steps are curated templates (`data/objections.json`, `data/closer.json`), filled with the member's own offer, price, promise and options. Niche facts live in `data/niches.json` (20 kinds of work, 8 archetypes).
- Rules with sources, checked 2026-10-19, in `data/rules.json`: FTC 16 CFR 465 (no paying for reviews), Google's no-incentive review policy, referral-fee limits in licensed fields, CAN-SPAM, payment link providers.
- Sample: `sample/brain.json` (Reyes Mobile Detailing, Austin) and the example inputs. Sample people and businesses use `.example` domains.

## Live checks (Oct 19, 2026)

- `node dev/run.js sales.send_proposal --example --input website=https://www.mozartscoffee.com --live`: read the real public site in 2 s (read only), and the proposal's "What I noticed" section cited one dated fact from it.
- `sales.call_prep` with the same site: read from the week's scan cache.
- All five workflows ran on the real harness engine (`cli.js run`), and `cli.js check` reported no problems.

## Notes for the harness and kit owners

- `ctx.leads.list` only returns this pack's own leads, so every sales tool logs the people it touches (quote: replied, proposal: call, invoice: won).
- Kit scan caches failed reads for 7 days; a site that was down once stays "unreachable" for a week.
