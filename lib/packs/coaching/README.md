# Coaching and consulting pack

Start coaching on the 127 spine: one kind of person, one result. Strict copy rules: nothing this pack drafts claims earnings or results, the free first session is free either way, and a story is shared only with written consent and a disclosure line (FTC Endorsement Guides and the Consumer Reviews and Testimonials Rule; see `research/niches/coaching.json`).

| Workflow | Title | Tier | Minutes | Credits | Ends at |
|---|---|---|---|---|---|
| `coaching.first_25` | Your first 25 | free | 20 | 1 | Up to 25 people from your own network who match the one person and one result, a personal message and follow-up each, the free first session offer, the consent-first story ask, group asks for the organizer, a dated plan and a CSV; everyone saved to the Pipeline |
| `coaching.offer` | Offer builder | builder | 10 | 1 | Price per session from sourced ranges, first-clients ladder (first 3, next 7, full), money model (free first session, weekly session, block of 4, 3-month program, small group), printable offer sheet |
| `coaching.reply` | Answer a reply | builder | 3 | 2 | What a reply means, a short answer with one next step (cost, do it myself, time, results, certified, therapy; "can we talk Thursday" gets a time ask), the Pipeline row updated for Do my day |
| `coaching.call_prep` | Prep a call | builder | 10 | 15 | Before: what to check, the questions in order, the price said once, answers to the worries they raised first, the close; `sales.read_prospect` and `sales.call_script` from the same options. After: `sales.proposal` if they want it in writing. The lead moves to Call |
| `coaching.quote` | Send a quote | builder | 5 | 3 | A session, a block of 4, the 3-month program or a group seat at the founding, intro or full price, a printable quote through `sales.quote`, then `sales.invoice` when they say yes |
| `coaching.onboarding` | New client and welcome kit | builder | 5 | 3 | The win logged (stage won, warm), booking, prep and reminder messages, a coaching checklist with when to refer out, the invoice through `sales.invoice`, and the welcome kit (intake questions, one-page agreement with the price and its founding or free note, session 1 plan, recap, optional story consent) |
| `coaching.keep` | Reviews, referrals and stories | builder | 3 | 1 | A thank-you, an honest review ask (no reward), a referral ask, the consent-first story ask and a referral card |
| `coaching.proof` | Show your work | builder | 5 | 3 | A case study from the client's own words that waits for their written yes, says plainly when the price was founding or free, then a 1080 x 1350 card and caption |
| `coaching.next_25` | Your next 25 | builder | 10 | 1 | The next 10 to 100 people you know who match, skipping everyone in the Pipeline, saved with messages for Do my day, where to look for more and group asks, a dated CSV; offered as a Monday 7am repeat |
| `coaching.ready` | Look ready | builder | 15 | 7 | One set of facts for `site.build` (one-page site), plus `local.gbp_kit` only when they meet clients in person |

Tools: `coaching.list_first25` (code, 1), `coaching.build_offer` (1), `coaching.answer_reply` (ai write, 2), `coaching.prep_call` (1), `coaching.plan_quote` (1), `coaching.log_client` (1), `coaching.build_onboarding_kit` (1), `coaching.ask_reviews` (1), `coaching.draft_story` (1), `coaching.make_story_card` (2, render), `coaching.list_next25` (1), `coaching.ready_facts` (1). Composes `sales.read_prospect`, `sales.call_script`, `sales.proposal`, `sales.quote`, `sales.invoice`, `site.build`, `local.gbp_kit`.

- Data: `data/niche.json` (crowd, rules, texts, offer, ladder, money model, replies and objections, call prep, quote packages, the win checklist, story, ready). Sources: `research/niches/coaching.json`, checked 2026-10-19.
- Shared code lives in `packs/_kit/common.js` (with tutoring, petcare and resale).
- One Pipeline row per client: the call, the quote and the win are saved on their row in this pack, so `sales.proposal`, `sales.quote` and `sales.invoice` run with `pipeline: false`. A stop or a "no thanks" gets no answer and goes to Lost.
- Tests check every drafted message and offer for earnings and results claims.
