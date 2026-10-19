# Social media for restaurants and cafes (`social`)

Find 25 owner-run restaurants and cafes whose social media is missing or quiet, make the best one a sample week of posts from its own menu, send the first message, then price it, prep the call, start the client, keep them on a monthly plan and report each month. Built on the playbook spine (WAVE2.md, WAVE3.md); composes the `leads` and `sales` packs.

## Workflows

In the order a member runs them (HQ's Start shows this path).

| id | title | tier | minutes | credits (sample run) |
|---|---|---|---|---|
| `social.first_25` | Your first 25 | free | 15 | 48 (fits the free 50) |
| `social.offer` | Your offer | builder | 10 | 1 |
| `social.sample_one` | Sample week for one restaurant | builder | 5 | 5 |
| `social.reply` | Answer a reply | builder | 2 | 3 |
| `social.call_prep` | Prep for a call | builder | 10 | 10 |
| `social.proposal` | Proposal | builder | 5 | 10 |
| `social.won` | A customer said yes | builder | 10 | 2 |
| `social.keep` | Keep your customers | builder | 5 | 1 |
| `social.month_end` | Month-end report | builder | 10 | 1 |
| `social.next_25` | Your next 25 | builder | 10 | 40 (123 at most: 100 spots, two kinds) |

- **first_25**: crowd card (`data/niche.json` crowd) → `leads.find_businesses` (limit 28) → `leads.scan_business` (each) → `leads.score_fit` (service `social media`, top 25) → pick one → `social.sample_week` → `leads.write_outreach` (AI for the top 5 only) → read and edit the 5 messages → `leads.export` (`pipeline: false`) → `social.save_leads` (this pack's own Pipeline rows).
- **offer**: monthly posts and monthly posts with a shoot (per month), a trial week, 4 Reels and a menu photo shoot (one time), priced at the member's position from `data/prices.json` (kit quote); first-clients ladder (3 founding spots, 30% off the monthly plans for the first 3 months, for an honest testimonial quoted as a founding client; Google reviews asked separately, never tied to the price); money model (trial week, monthly plan, upsell, downsell); job math from the member's own hourly and monthly costs; printable offer sheet.
- **sample_one**: a spot from your Pipeline (or a typed website) → `social.pick_lead` → `social.sample_week` (3 posts in one PNG, captions, a Reel plan, one page) → `social.log_sample`.
- **reply**: `social.answer_reply` (the niche's worries: "we tried it", "my nephew posts", "we can't afford it", "our regulars know us", "I won't share a password", "will it bring customers"; the price said once from your saved offer; AI may only reword, never add a number) → `social.log_lead`. A stop gets no answer and the spot is marked lost.
- **call_prep**: `pick_lead` → `sales.read_prospect` → `social.call_sheet` (printable; names their Instagram or Facebook fact first) → `log_lead` (Call booked) → `social.proposal_options` → `sales.proposal` (`pipeline: false`: the call is already logged here).
- **proposal**: `sales.read_prospect` → `social.proposal_options` (monthly posts with a shoot, monthly posts, a trial week; founding prices say the full price after 3 months) → `sales.proposal` (your own promise from Your offer) → `sales.quote`.
- **won**: `log_lead` (won) → `social.start_client` (kickoff, access through Meta Business Suite partner access, never a password, first weeks with dates, printable checklist, after-delivery message, honest feedback ask) → `sales.invoice` (a month is paid in full at its start; a shoot or Reels is half up front; due on the start day; `pipeline: false`, since the win is already logged here).
- **keep**: `social.keep_plan` (next month week by week, check-in, keep-going offer, one upsell, intro ask, a page to send).
- **month_end**: `social.month_report` (only the numbers you typed, from Meta Insights and the owner's own count, change against last month, the email, feedback and intro asks). No repeat schedule: a repeat would reuse last month's typed numbers.
- **next_25**: `leads.find_businesses` (60, plus an optional second kind) → `social.fresh_leads` (drops everyone in your Pipeline, kit `leads.known`) → scan each → `leads.score_fit` → `leads.write_outreach` → approve → `social.save_leads` (rows carry msg, facts, score and channel; a dated CSV with the map credit). 10 to 100, default 25. Suggested every Monday at 7am.

## Tools

| name | what | credits |
|---|---|---|
| `social.crowd_card` | Is this a starving crowd: scores, best months, slow season, 3 things not to do yet | 0 |
| `social.sample_week` | 3 posts (Mon, Wed, Fri) with captions and hashtags, a 5-shot Reel plan, one page to share and one PNG of the week | 4 |
| `social.build_offer` | Prices, ladder, money model, job math and the offer sheet; remembers the offer for replies and call sheets | 1 |
| `social.proposal_options` | The 3 proposal options and the chosen package as line items, with terms | 1 |
| `social.pick_lead`, `log_lead`, `log_sample`, `answer_reply`, `call_sheet`, `start_client`, `keep_plan`, `month_report`, `fresh_leads`, `save_leads` | The Pipeline tools (`tools/pipeline.js`), built from the kit's `_kit/b2b.js` (shared with webdesign and photo) with `lib/config.js` | 0 to 3 |

## Data

- `data/niche.json`: crowd (research/crowd.json and research/niches/social.json; scores are our judgment), buyers, post plan, objections, job checklist, first-clients ladder, the member promise ("Every post goes to you for a yes before it goes out, and it goes out on the day we agreed. If a post isn't right, I redo it free.").
- `data/prices.json`: monthly posts $300 to $800 and with a shoot $500 to $1,500 a month (Boomp, eClincher), trial week $120 to $450, 4 Reels $800 to $1,500 (Apaya), menu shoot $299 to $645 (Thumbtack), ads management $500 to $2,000 a month. Ranges are our judgment inside the sourced ranges.

## Real vs sample

- Every fact in a sample week (dish names, prices, hours) is quoted from the restaurant's own site and dated; a missing fact is marked "Sample text". Prices are printed as the site shows them.
- Posts are drawn as SVG (1080 x 1350 each, each with a SAMPLE tag) and rendered side by side as one PNG with ffmpeg (`wants: ['render']`); without ffmpeg the SVGs stay in the page.
- Reel music: the plan points to the Meta Sound Collection (licensed for business accounts); no song names are suggested.
- No keys needed. A Google Places key (server) unlocks Google Maps listings; listing names and phones are never saved to files.

## Test

`node dev/lint.js social` and `node --test packs/social/test/*.test.js` (offline, sample places; `b2b.test.js` covers the offer, proposal and client workflows).
