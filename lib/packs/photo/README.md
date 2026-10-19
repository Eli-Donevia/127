# Photography for local businesses (`photo`)

25 local businesses whose website shows few photos, a shot list for the best one from what their site shows and lacks, the first message, then the price, call prep, the kickoff, a monthly session plan and a report each month. Built on the playbook spine (WAVE2.md, WAVE3.md); composes the `leads`, `sales`, `site` and `local` packs.

## Workflows

In the order a member runs them (HQ's Start shows this path), then Look ready.

| id | title | tier | minutes | credits (sample run) |
|---|---|---|---|---|
| `photo.first_25` | Your first 25 | free | 15 | 49 (fits the free 50) |
| `photo.offer` | Your offer | builder | 10 | 1 |
| `photo.shot_one` | Shot list for one business | builder | 5 | 4 |
| `photo.reply` | Answer a reply | builder | 2 | 3 |
| `photo.call_prep` | Prep for a call | builder | 10 | 10 |
| `photo.proposal` | Proposal | builder | 5 | 10 |
| `photo.won` | A customer said yes | builder | 10 | 2 |
| `photo.keep` | Keep your customers | builder | 5 | 1 |
| `photo.month_end` | Month-end report | builder | 10 | 1 |
| `photo.next_25` | Your next 25 | builder | 10 | 40 (123 at most: 100 businesses, two kinds) |
| `photo.ready` | Look ready | builder | 15 | 6 |

- **first_25**: crowd card → `leads.find_businesses` (category, default restaurants; limit 30) → `leads.scan_business` (each) → `leads.score_fit` (service `photography`, top 25) → pick one → `photo.shot_list` → `leads.write_outreach` (AI for the top 5 only) → read and edit the 5 messages → `leads.export` (`pipeline: false`) → `photo.save_leads` (this pack's own Pipeline rows).
- **offer**: business shoot, half day, one-hour shoot, team headshots (a person), listing photos (a property) and the monthly photo session, priced at the member's position from `data/prices.json` (kit quote); first-clients ladder (3 founding spots, 40% off the business shoot and the half day, for an honest testimonial quoted as a founding client and permission to show the photos; Google reviews asked separately, never tied to the price); money model (business shoot, monthly session, half day or headshots, one-hour shoot); job math from the member's own hourly and monthly costs; printable offer sheet.
- **shot_one**: a business from your Pipeline (or a typed website) → `photo.pick_lead` → `photo.shot_list` → `photo.log_sample` (a typed business joins the Pipeline with its first message; the day 3 follow-up sends the shot list).
- **reply**: `photo.answer_reply` (the niche's worries: "we can use a phone", "why does it cost that much", "do we get all the photos", "can we use them for ads", "what if it rains", "I hate being photographed", "we already have photos"; the price said once from your saved offer; AI may only reword, never add a number) → `photo.log_lead`. A stop gets no answer.
- **call_prep**: `pick_lead` → `sales.read_prospect` → `photo.call_sheet` (printable; names a fact about their photos, said to the owner as "your homepage") → `log_lead` (Call booked) → `photo.proposal_options` → `sales.proposal` (`pipeline: false`: the call is already logged here).
- **proposal**: `sales.read_prospect` → `photo.proposal_options` (a half day, a business shoot and the monthly session; for an agent: listing photos, with aerials only when the member says they hold an FAA Part 107 certificate, and an agent headshot) → `sales.proposal` (half to hold the date, your own promise from Your offer) → `sales.quote`.
- **won**: `log_lead` (won) → `photo.start_client` (kickoff, what they get ready, the shoot plan with dates, printable checklist with releases, permits and Part 107 rules, after-delivery message, honest feedback ask) → `sales.invoice` (half to hold the date, due on the start day before the shoot; a monthly session is paid in full at its start; `pipeline: false`, since the win is already logged here).
- **keep**: `photo.keep_plan` (a monthly session or a seasonal refresh shoot, week by week, check-in, keep-going offer, one upsell, intro ask, a page to send).
- **month_end**: `photo.month_report` (only the numbers you typed: calls, website clicks and direction requests from their Google profile, photos delivered and put to use, posts; change against last month). No repeat schedule: a repeat would reuse last month's typed numbers.
- **next_25**: `leads.find_businesses` (60, plus an optional second kind) → `photo.fresh_leads` (drops everyone in your Pipeline, kit `leads.known`) → scan each → `leads.score_fit` → `leads.write_outreach` → approve → `photo.save_leads` (rows carry msg, facts, score and channel; a dated CSV with the map credit). 10 to 100, default 25. Suggested every Monday at 7am.
- **ready**: `photo.ready_kit` (your shoots and prices from Your offer, only the work and clients you list) → `site.build` (portfolio design, `for: 'me'`: ZIP for Netlify Drop, preview, share image) → `local.gbp_kit` (Google profile kit as a photographer who travels to the customer, home address hidden; the steps say to keep Photographer as the main category). 4 files.

## Tools

| name | what | credits |
|---|---|---|
| `photo.crowd_card` | Is this a starving crowd, with the January and February slow season and the play for it | 0 |
| `photo.shot_list` | What the homepage photos show and lack, 10 shots in order (how and where each is used), a mood board in words (PNG 1080 x 1350), one page to share | 3 |
| `photo.build_offer` | Prices, ladder, money model, job math and the offer sheet; remembers the offer for replies, call sheets and Look ready | 1 |
| `photo.proposal_options` | The proposal options and the chosen package as line items (people for headshots, aerials for listings), with terms and the deposit | 1 |
| `photo.ready_kit` | Your facts worded once for the website and the Google profile kit | 0 |
| `photo.pick_lead`, `log_lead`, `log_sample`, `answer_reply`, `call_sheet`, `start_client`, `keep_plan`, `month_report`, `fresh_leads`, `save_leads` | The Pipeline tools (`tools/pipeline.js`), built from the kit's `_kit/b2b.js` (shared with webdesign and social) with `lib/config.js` | 0 to 3 |

## Data

- `data/niche.json`: crowd (research/niches/photo.json; scores are our judgment), buyers, service menu with sources, first-clients ladder, the member promise ("Your edited photos are in your online gallery within 3 days of the shoot. If a photo isn't right, I edit it again free, and if weather or a closure moves the shoot, the new date costs nothing."), the job checklist for a business shoot (confirm, check the light, releases, back up every card, deliver, help put them up), objections, licenses (business license, sales tax, park permits, FAA Part 107, copyright and releases, insurance), plays, shot lists for food places (12) and other businesses (10).
- `data/prices.json`: business shoot $299 to $645 (Thumbtack commercial), half day $600 to $1,200, one-hour shoot $150 to $350 and the monthly session $122 to $300 a month (StartCosts and Thumbtack hourly), headshots $150 to $300 a person (Thumbtack, StartCosts), listing photos $100 to $400 a property (StartCosts, ZenBusiness, Thumbtack), extra hour $122 to $198, aerials $150 (Thumbtack example). Ranges are our judgment inside the sourced ranges.

## Real vs sample

- Photo subjects are read only from each image's alt text and file name. A photo whose name and alt text say nothing is counted as unknown, never guessed. "Missing" is only shown when at least 2 photos could be read.
- Logos and icons are skipped. Counts are dated ("as found on").
- Look ready puts only your regular prices on the site (no founding price that would go stale) and names a client only from the lines you type.
- No keys needed. Google listing names and phones are never saved to files.

## Test

`node dev/lint.js photo` and `node --test packs/photo/test/*.test.js` (offline, sample places; `b2b.test.js` covers the offer, proposal, Look ready and client workflows).
