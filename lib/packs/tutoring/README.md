# Tutoring pack

Start a tutoring business on the 127 spine. Safety with minors comes first everywhere: parents book and pay, sessions happen where a parent can see, and nothing goes to students directly. Stories never name the student.

| Workflow | Title | Tier | Minutes | Credits | Ends at |
|---|---|---|---|---|---|
| `tutoring.first_25` | Your first 25 | free | 20 | 2 | 15 parents you know with a personal text and follow-up each, up to 10 local places (libraries, community centers, homeschool groups, parent groups) with an ask that respects their rules, the safety rules, a parent call script, a dated plan and a CSV; everyone saved to the Pipeline |
| `tutoring.offer` | Offer builder | builder | 10 | 1 | Price per session from sourced ranges, first-clients ladder (first 3, next 7, full), money model, printable offer sheet (HTML, no scripts) |
| `tutoring.reply` | Answer a reply | builder | 3 | 2 | What a parent's or a place's reply means, a short answer with one next step (price said once, the niche's worries with sources, "can we talk Thursday" gets a time ask), the Pipeline row updated for Do my day; stop or no means lost |
| `tutoring.quote` | Send a quote | builder | 5 | 3 | Line items at the founding, intro or full price (block discount as its own line), a printable quote through `sales.quote`, then `sales.invoice` from the same lines when the parent says yes |
| `tutoring.progress_note` | New family and session notes | builder | 5 | 3 | New family: the win logged (stage won, warm), booking, prep and reminder texts to the parent, a printable first session checklist with the safety rules, the invoice through `sales.invoice`. After each session: the note to the parent |
| `tutoring.keep` | Reviews and referrals | builder | 3 | 1 | A thank-you to the parent, the same honest review ask for every family (no reward), a referral ask and a referral card |
| `tutoring.proof` | Show your work | builder | 5 | 3 | A short story from the parent's words with the exact permission ask (the student's name becomes "my student", a quote that names them is left out), then after a written yes a 1080 x 1350 card and caption; founding or free said plainly |
| `tutoring.next_25` | Your next 25 | builder | 15 | 2 | The next 10 to 100 parents and places, skipping everyone in the Pipeline (kit `leads.known`), saved with messages for Do my day, a dated CSV; offered as a Monday 7am repeat |
| `tutoring.ready` | Look ready | builder | 15 | 9 | One set of facts for `site.build` (one-page site), `local.gbp_kit` and `local.flyer`, so prices and contact details match; the founding offer goes on the flyer only |

Tools: `tutoring.list_first25` (code, 2), `tutoring.build_offer` (1), `tutoring.answer_reply` (ai write, 2), `tutoring.plan_quote` (1), `tutoring.log_family` (1), `tutoring.write_progress_note` (1), `tutoring.ask_reviews` (1), `tutoring.draft_story` (1), `tutoring.make_story_card` (2, render), `tutoring.list_next25` (2), `tutoring.ready_facts` (1). Composes `sales.quote`, `sales.invoice`, `site.build`, `local.gbp_kit`, `local.flyer`.

- Data: `data/niche.json` (crowd card, safety rules, partner types, texts, offer, ladder, money model, replies and objections, quote packages, the win checklist, story rules, ready). Sources: `research/niches/tutoring.json`, checked 2026-10-19.
- Shared code lives in `packs/_kit/common.js` (with petcare, coaching and resale).
- One Pipeline row per family: the quote and the win are saved on their row in this pack, so `sales.quote` and `sales.invoice` run with `pipeline: false`. A stop or a "no thanks" gets no answer and goes to Lost.
- Libraries and community centers come from OpenStreetMap through the kit places finder, with the OpenStreetMap credit in views and as the last CSV row. Homeschool groups and parent groups aren't on the map, so they show as places marked "(sample)" with a tip to add them by hand; samples are never saved to the Pipeline.
- The founding price is for honest feedback, never for a review. No grade or score promises anywhere; the member's promise is about the work (a missed or late session makes the next one free, a refund if the first isn't a fit).
