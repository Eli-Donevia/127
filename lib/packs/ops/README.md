# Ops desk (`ops`)

Pick the starter tools with checked prices, turn how the member does a job into a checklist anyone can follow, and hire a first helper with a paid trial. Every output is a file the member owns; nothing is posted or sent. No keys needed: AI tools fall back to presets and to the member's own notes.

## Workflows

| id | title | tier | minutes | steps | credits per run |
|---|---|---|---|---|---|
| ops.pick_stack | Pick my starter tools | free | 3 | stack (ops.tool_stack) | 1 |
| ops.write_sop | Turn how I work into a checklist | builder | 5 | sop (ops.sop) | 4 |
| ops.hire_first_helper | Hire my first helper | builder | 10 | sop (ops.sop, who helper) > packet (ops.hire_helper, gets `$sop.sop`) | 9 |

Workflow inputs (required marked *): pick_stack `what, model (auto, local, service, products, digital), budget (free, some)`; write_sop `task*, notes, who (me, helper)`; hire_first_helper `role*, task*, notes, pay, payType (per hour, per job), hours, city`.

## Tools

| tool | kind | credits | input (* required) | output |
|---|---|---|---|---|
| ops.tool_stack | code | 1 | what, model (default auto: read from what), budget (default free) | `model`, `modelLabel`, `rows` [{job, tool, start, upgrade, freeStart, alt, url, source, checked}], `firstWeek` (5 lines), `freeCount`, `checked`, `page` (HTML), `csv` |
| ops.sop | ai, tasks write | 4 | task*, notes (voice-note transcript or rough notes, up to 6000 characters), who (me, helper), minutes | `sop` {title, purpose, who, minutes, supplies, steps [{n, title, detail}], quality, mistakes, done, duties, source (notes, preset, generic), preset}, `checklist` (printable HTML with tick boxes and a sign-off line), `doc` (.md that imports to Notion as to-dos), `ai` |
| ops.hire_helper | ai, tasks write | 5 | role*, what, city, pay, payType, hours, tasks, sop (an ops.sop output or its `sop`) | `packet` {role, post {title, body}, trial (5 steps), scorecard [{area, good, score, notes}], questions (8), share, rules {lines, sources}, pay}, `page` (HTML), `scorecard` (.csv), `doc` (.txt job post and questions), `ai` |

Presets in `lib/sops.js`: home clean, car detail, mow edge and blow, dog walk, pack and ship an order, inquiry to booked job, follow up and review ask; anything else gets a general checklist. With notes, the steps come from the member's own words: filler removed, split on "then", "after that", "finally", first person turned to "you", each step titled by its action.

## Real vs sample

- Prices in `data/tools.json` were read on each tool's own pricing page on 2026-10-19; every tool has `source` and `checked`. Where we could not read a number (Kit and Beehiiv paid plans) the page says "check current pricing". The page footer tells members prices change and to open the link before paying.
- `data/hiring.json` points to the IRS (contractor or employee), the US Department of Labor (misclassification, state labor offices) and the SBA; all checked 2026-10-19. The packet says to check the state's rules and that it is not legal or tax advice. It never says whether someone is a contractor or an employee.
- Sample business (`sample/brain.json`): Tidy Nest Cleaning, Columbus OH, tidynest.example (fictional).

## Not yet (pack `notYet`)

1. Don't hire before you have done the job yourself at least ten times and written down how.
2. Don't pay for software you won't open this week. Start on free plans and upgrade one tool when a limit actually stops you.
3. Don't buy an all-in-one business suite or set up payroll yet. A booking link, a payment link and one checklist run the first customers.

## Run it

```
node dev/run.js ops.hire_first_helper --out /tmp/ops-work/out
node --test packs/ops/test/ops.test.js
```
