# Web design for local businesses (`webdesign`)

25 local businesses whose website is missing, broken or not set up for phones, a mock homepage of the best one's own business, the first message, then the price and the proposal. Built on the playbook spine (WAVE2.md).

## Workflows

In the order a member runs them (HQ's Start shows this path).

| id | title | tier | minutes | credits (sample run) |
|---|---|---|---|---|
| `webdesign.first_25` | Your first 25 | free | 15 | 49 (fits the free 50) |
| `webdesign.offer` | Your offer | builder | 10 | 1 |
| `webdesign.mock_one` | Mock homepage for one business | builder | 5 | 4 |
| `webdesign.reply` | Answer a reply | builder | 2 | 3 |
| `webdesign.call_prep` | Prep for a call | builder | 10 | 10 |
| `webdesign.proposal` | Proposal | builder | 5 | 10 |
| `webdesign.won` | A customer said yes | builder | 10 | 2 |
| `webdesign.keep` | Keep your customers | builder | 5 | 1 |
| `webdesign.month_end` | Month-end report | builder | 10 | 1 |
| `webdesign.next_25` | Your next 25 | builder | 10 | 40 |

- **first_25**: crowd card (`data/niche.json` crowd) → `leads.find_businesses` → `leads.scan_business` (each, 30) → `leads.score_fit` (service `websites`) → pick one → `webdesign.mock_homepage` (HTML page + phone PNG + 5 fixes, from their own site, dated) → `leads.write_outreach` (AI first lines for the top 5 only) → approve the 5 → `leads.export` (CSV, workbook, follow-up calendar). Step 10 (25 a day): run it again; `leads.find_businesses` skips businesses already in the Pipeline.
- **offer**: price menu at the member's position from `data/prices.json` (kit quote), care plans, first-clients ladder (3 founding spots at 40% off for an honest testimonial they may quote; Google reviews asked separately, never tied to the discount), money model (setup, care plan, upsell, downsell), job math from the member's own hourly and monthly costs, printable offer sheet (every founding price, dated, with how to reach you).
- **proposal**: `sales.read_prospect` → `webdesign.proposal_options` (3 options + line items + terms: client owns domain, hosting and site once paid) → `sales.proposal` (your own promise from Your offer) → `sales.quote` (items).
- **mock_one**: a business from your Pipeline (or a typed name and website) → `webdesign.pick_lead` → `webdesign.mock_homepage` → `webdesign.log_sample` (the line to send it goes on their Pipeline row; a typed business is added with its first message and follow-ups).
- **reply**: paste what they wrote → `webdesign.answer_reply` (kit `outreach.answer` + the niche's worries: "I already have a website", "my nephew does it", "word of mouth", "who owns the domain"...; the price said once from your saved offer; AI may only reword, never add a number) → `webdesign.log_lead` (stage and `msg.answer` for Do my day). A stop gets no answer and the business is marked lost.
- **call_prep**: `pick_lead` → `sales.read_prospect` → `webdesign.call_sheet` (printable page: what to check first, what you know from their site, questions, price said once, founding prices, answers to worries with their own site fact said as "your site", the close, after the call) → `log_lead` (Call booked) → `proposal_options` → `sales.proposal` (`pipeline: false`: the call is already logged here; greets the person you typed, never the business name).
- **won**: `pick_lead` → `log_lead` (won) → `webdesign.start_client` (kickoff message, what they get ready, first weeks with dates, printable plan and job checklist from `niche.job_checklist`, after-delivery message, honest feedback ask that says "as a founding client" when it is one) → `sales.invoice` for the deposit (founding price as its own line; due on the start day; `pipeline: false`, since the win is already logged here).
- **keep**: `pick_lead` → `webdesign.keep_plan` (next month week by week, check-in, keep-going offer at your care plan price, one upsell from your add-ons, intro ask, a page to send).
- **month_end**: `pick_lead` → `webdesign.month_report` (only the numbers you typed, change against last month's report, the email, feedback and intro asks, a case-study line that says when they are a founding client). No repeat schedule: a repeat would reuse last month's typed numbers.
- **next_25**: `leads.find_businesses` (60, plus an optional second kind) → `webdesign.fresh_leads` (drops everyone in your Pipeline from any workflow, kit `leads.known`) → scan each → `leads.score_fit` → `leads.write_outreach` → approve → `webdesign.save_leads` (rows carry msg, facts, score and channel via kit `leads.pipelineLead`, plus a CSV with the map credit, dated so a weekly repeat never overwrites last week's). 10 to 100, default 25. Suggested every Monday at 7am.
- Pipeline rows: this pack saves its own rows (first_25 exports with `pipeline: false` and saves through `webdesign.save_leads`), so reply, call_prep and won can move their stage. A business another workflow saved gets the note and answer, and the member moves its stage. `sales.proposal` and `sales.invoice` also log the person on the sales desk's own row.

## Tools (`tools/pipeline.js`, built from the kit's `_kit/b2b.js` with `lib/config.js`)

`webdesign.pick_lead`, `log_lead`, `log_sample`, `answer_reply`, `call_sheet`, `start_client`, `keep_plan`, `month_report`, `fresh_leads`, `save_leads`. `_kit/b2b.js` is shared by webdesign, social and photo; each pack's `lib/config.js` holds its words, worries, prices and plans.

## Data

- `data/niche.json`: crowd (research/crowd.json, our judgment), starter kit, job checklist, objections, licenses and insurance, where buyers look, first-client plays, platform rules, the member promise (redo and on-time, never results). Every number keeps its source (research/niches/webdesign.json, checked 2026-10-19).
- `data/prices.json`: packages (one-page $500 to $1,500, small site $1,000 to $3,000, fix list $250 to $750), add-ons, care plans ($39 to $99, $89 to $179 a month). Ranges are our judgment inside sourced market ranges (GoDaddy, Wix, Squarespace, GoWP, WP Buffs).

## Real vs sample

- Real: every fact in a mock comes from the business's own site (kit scan, robots respected) and is dated; where the site says nothing the mock says "Sample text". Names and phones from a Google listing are never saved in files (Places terms). Without a Places key, businesses come from OpenStreetMap; offline, sample businesses use `.example` sites and 555-01xx numbers and are marked sample.
- The phone PNG is drawn as SVG from the same facts and rendered with ffmpeg (`wants: ['render']`); without ffmpeg the SVG is saved.
- No keys needed. A Google Places key (server) unlocks Google Maps listings.
- Live check (Oct 19): `cli.js run webdesign.mock_one --input website=<a real local business site> --live` reads the public site only.
