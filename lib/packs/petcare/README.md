# Dog walking and pet sitting pack

Start dog walking and pet sitting on the 127 spine. Trust first: a free meet and greet before any booking, an intake form on file before the first visit, and a visit card after every visit.

| Workflow | Title | Tier | Minutes | Credits | Ends at |
|---|---|---|---|---|---|
| `petcare.first_25` | Your first 25 | free | 20 | 2 | 15 people you know with a personal text and follow-up each, up to 10 vets, groomers, pet stores and apartment buildings with a partner ask and an in-person line, trust rules, a meet and greet script, a dated plan and a CSV; everyone saved to the Pipeline |
| `petcare.offer` | Offer builder | builder | 10 | 1 | Price per walk from sourced ranges, first-clients ladder (first 3, next 7, full), money model (meet and greet, walk, pack of 5, second dog, potty break, overnight), printable offer sheet |
| `petcare.reply` | Answer a reply | builder | 3 | 2 | What an owner's or a place's reply means, a short answer with one next step (insurance, apps, keys, care needs and backup worries with sources; "come by Saturday" gets the meet and greet), the Pipeline row updated for Do my day |
| `petcare.quote` | Send a quote | builder | 5 | 3 | Walks, a pack of 5, potty breaks or overnights at the founding, intro or full price (second dog as an extra), a printable quote through `sales.quote`, then `sales.invoice` when they say yes |
| `petcare.visit_kit` | New client and visit cards | builder | 5 | 4 | New client: the win logged (stage won, warm), booking, prep and reminder texts, a first visit checklist, the intake form and the invoice through `sales.invoice`. After each visit: the visit card text and printable card |
| `petcare.keep` | Reviews and referrals | builder | 3 | 1 | A thank-you, the same honest review ask for every client (no reward), a referral ask for neighbors and a referral card |
| `petcare.proof` | Show your work | builder | 5 | 3 | The owner's words as a short story with the exact permission ask (photo included in the ask), then after a written yes a 1080 x 1350 card with the pet's photo and a caption; founding or free said plainly |
| `petcare.next_25` | Your next 25 | builder | 15 | 2 | The next 10 to 100 people and places (vets, groomers, pet stores, buildings), skipping everyone in the Pipeline, saved with messages for Do my day, a dated CSV; offered as a Monday 7am repeat |
| `petcare.ready` | Look ready | builder | 15 | 9 | One set of facts for `site.build`, `local.gbp_kit` and door hangers through `local.flyer`, so prices and contact details match; the founding offer goes on the door hangers only |

Tools: `petcare.list_first25` (code, 2), `petcare.build_offer` (1), `petcare.answer_reply` (ai write, 2), `petcare.plan_quote` (1), `petcare.log_client` (1), `petcare.make_intake_form` (1), `petcare.write_visit_card` (1), `petcare.ask_reviews` (1), `petcare.draft_story` (1), `petcare.make_story_card` (2, render), `petcare.list_next25` (2), `petcare.ready_facts` (1). Composes `sales.quote`, `sales.invoice`, `site.build`, `local.gbp_kit`, `local.flyer`.

- Data: `data/niche.json`; sources in `research/niches/petcare.json`, checked 2026-10-19. `sample/dog.jpg` is a labeled sample illustration for the example run.
- Shared code lives in `packs/_kit/common.js` (with tutoring, coaching and resale).
- One Pipeline row per client: the quote and the win are saved on their row in this pack, so `sales.quote` and `sales.invoice` run with `pipeline: false`. A stop or a "no thanks" gets no answer and goes to Lost.
- Vets, groomers, pet stores and apartment buildings come from OpenStreetMap through the kit places finder when a city is set, with the OpenStreetMap credit in views and as the last CSV row. Offline, places are marked "(sample)" and never saved.
- The founding price is for honest feedback, never for a review. The member's promise covers what they control (a late or missed walk makes the next one free; a same-day refund of a visit), never how a pet behaves.
