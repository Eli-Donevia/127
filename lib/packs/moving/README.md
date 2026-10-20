# Moving help

Start a labor-only moving help business: your first 25 people and partner businesses, a price menu by home size from real ranges, quotes, a crew and hours estimate with a printable move-day plan, and a same-street route.

Built on the shared household spine (`packs/_kit/home/`, the same code as cleaning, lawn, detailing, washing, windows, pool and lights). Everything about the niche is data: `data/niche.json` (crowd card, partners, offers by month, first-clients ladder, money model, texts, quote fields, job checklist, objections, free samples, won and proof words, specials, licenses, starter kit, plays, all from `research/niches/moving.json` with sources) and `data/prices.json` (home sizes priced per mover hour, add-ons, plans, every range with its sources and checked date). The special for this niche: `moving.same_street`.

On top of the spine (`index.js`):

- `moving.crew_estimate`, Crew and hours estimate, the signature workflow (`tools/crew-plan.js`; the math in `lib/crew.js`, the printable move-day plan in `lib/plan-page.js`, the chart and rules in `data/crew.json`). It is offered as a next step after a quote, a reply, the offer and a booking.
- `lib/street.js` keeps the home-size line off the neighbor door hangers (a neighbor's job is a small one), and `lib/ready.js` gives the Google profile kit a general, mobile profile instead of a handyman's.

## Workflows

| Id | Title | Tier | Minutes | Credits per full run | Ends with |
|---|---|---|---|---|---|
| `moving.first_25` | Your first 25 | free | 20 | 6 | 15 people you know and 10 agents, apartment offices, storage sites, senior communities and truck rental counters, each with a message and an offer that fits. |
| `moving.offer` | Your offer | builder | 10 | 4 | Your price menu by home size, the first-clients ladder, add-ons for stairs, long carries and heavy items, and job math, on a one-page offer sheet. |
| `moving.sample_one` | Make a free sample | builder | 5 | 2 | A free demo for one street or one partner business: door hangers or a sample letter, a card to send and every message, saved to your Pipeline. |
| `moving.reply` | Answer a reply | builder | 2 | 6 | Paste what someone wrote back: what they meant, a short answer with one next step, and your Pipeline updated. A draft you send yourself. |
| `moving.quote` | Quote a job | builder | 3 | 3 | Home size, stairs, carry and heavy items in; a quote, a text and an invoice out. |
| `moving.crew_estimate` | Crew and hours estimate | builder | 5 | 3 | Home size, stairs, carry and heavy items in: crew size, hours and a price at your hourly rate, a printable move-day plan and the items movers won't carry. |
| `moving.won` | A customer said yes | builder | 5 | 3 | Log the yes, then everything for the move: the booking text, a prep text, a printable job sheet, the after-job text and the invoice. |
| `moving.keep` | Keep your customers | builder | 5 | 1 | A thank-you, an honest review ask, a referral ask and a later check-in, each dated, plus review cards with your QR code. |
| `moving.proof` | Show your work | builder | 5 | 5 | One move turned into proof: a result card, a before-and-after collage from your photos, a caption, an honest review ask and a case study once they say yes. |
| `moving.next_25` | Your next 25 | builder | 15 | 5 | The next 25 agents, apartment offices, storage sites, senior communities and truck rental counters near you that are not in your Pipeline yet, with messages. |
| `moving.ready` | Look ready | builder | 15 | 9 | Look ready before you reach out: a one-page website, a Google profile kit and a flyer, all from your real prices. |
| `moving.same_street` | Same street first | builder | 10 | 2 | One move's street turned into a route: door hangers with a neighbor price for a small job, a sheet for the 20 nearest homes and an intro ask for your customer. |

A full run of every workflow comes to 49.

Credits are the step tools' credits from the registry (kit `testing.catalog`).

## Tools

- `moving.first_25` Your first 25 list (code, 4)
- `moving.offer_card` Offer card and door hangers (code, 2)
- `moving.price_menu` Price menu and offer (code, 2)
- `moving.quote_job` Quote this job (code, 1)
- `moving.keep_customer` Keep this customer (code, 1)
- `moving.free_sample` Make a free sample (code, 2)
- `moving.answer_reply` Answer this reply (ai, 6)
- `moving.book_job` Book this job (code, 2)
- `moving.result_card` Result card and collage (code, 3)
- `moving.case_study` Write the case study (code, 2)
- `moving.next_batch` Find your next batch (code, 5)
- `moving.ready_kit` Gather your facts (code, 1)
- `moving.street_route` Same street route (code, 2)
- `moving.crew_plan` Crew and hours estimate (code, 2)

Composed from other packs by name: `sales.quote` and `sales.invoice` (quote, crew estimate, won), `site.build`, `local.gbp_kit` and `local.flyer` (ready).

## The crew and hours estimate

- Input: the customer, the home size, load and unload or one of them, stairs at each end, the carry at each end, heavy items, the crew the member picks, their rate per mover hour, the date and start time, and who brings the truck.
- Hours: HireAHelper's estimating chart by home size (`data/crew.json`), plus the time stairs, a long carry and heavy items add, at the crew the member picks. Judgment calls (scaling to a different crew, the carry share, rounding to the half hour) are marked in `data/crew.json` and said on screen.
- Price: hours times movers times the member's rate, plus the heavy-item fee; the line items go to `sales.quote` and, on a yes, `sales.invoice`.
- Items: pieces that need a third mover, a specialist (pianos, safes, pool tables) or an appliance dolly are named; things movers can't carry (hazardous items, perishables, valuables to keep with you) get their own list for the customer.
- Labor only: the customer drives their own goods. The member loads and unloads, and never transports a customer's things for pay unless they hold the carrier authority and the state license that work needs (sourced in `data/crew.json`).
- The move-day plan is for the customer: the crew, the start time, the hours and the price, what to do before the crew arrives, and what stays with them.

## Real, sample, keys and cost

- Real: prices come from the sourced ranges in `data/prices.json`; the member's position picks a price inside each range and their own prices win. The season check uses the member's city (OpenStreetMap geocode when online, a state and city latitude table offline).
- Businesses: OpenStreetMap only, through kit `places` on 127's own map servers (Legal L55), with "Search by LocationIQ.com" when LocationIQ found the town (L57). Every list of OpenStreetMap businesses carries the credit on screen, in each CSV and on each page (D27). Sample runs and failed lookups use made-up businesses (`sample/partners.json` or kit samples, .example sites, 555-01xx phones), marked as samples and never saved to the Pipeline.
- Do my day (D29): every business saved gets `msg` (dm, subject, email, walkin, follow1, follow2), `facts`, `score` and `channel`; people the member knows are saved warm with their own texts. Outreach is a draft the member sends, with their address and a "no thanks" opt-out.
- AI: only "Answer a reply" may call it, to fit the written answer to their words. The estimate and the quote are code: no AI, no network.
- Photos: `sample/before.jpg` and `sample/after.jpg` are drawn illustrations, labeled "Sample illustration" on the image, for the example run only. Members add their own.
- The founding price is for permission to share before and after photos and honest feedback, never for a Google review. Review asks go to every customer with nothing in return. A case study from a founding-price or free job says so (FTC 16 CFR 255.5).

## Tests

`node --test packs/moving/test/*.test.js`: the contract lint, every workflow on its example (kit `packSuite`), the household behavior tests (kit `home/suite.js`), every price range with its dated sources, the crew math (chart hours, stairs, carry, heavy items, crew scaling, rounding), the items movers won't carry, the labor-only line and the move-day plan.
