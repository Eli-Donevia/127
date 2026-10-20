# Handyman

Start a handyman business: your first 25 people and partners, a price menu from real ranges, a punch list quote from a pasted list of jobs, and the licensed-trade rules to check in your state.

Built on the shared household spine (`packs/_kit/home/`, the same code for cleaning, lawn, junk, windows and washing). Everything about the niche is data: `data/niche.json` (crowd card, partners, offers by month, first-clients ladder, money model, texts, quote fields, job checklist with ladder and anchoring rules, objections, free samples, won and proof words, the same-street special, licenses, starter kit, plays, all from `research/niches/handyman.json` with sources), `data/prices.json` (visit, job, hourly and add-on ranges for kit `quote`, every range with 2 or more sources and its checked date) and `data/punch.json` (the punch list's 37 jobs with sourced times and prices, the work that goes to a licensed trade, the checks by state, the lead rule, the safety lines and the order to work in). The special for this niche: `handyman.same_street`.

On top of the spine (`index.js`):

- `handyman.punch_list`, Punch list quote, the signature workflow (`tools/punch-list.js`; list reader in `lib/parse.js`, math in `lib/punch.js`, printable estimate in `lib/sheet.js`). It is offered as a next step from Answer a reply, Quote a job, Your offer, Make a free sample and Same street first.

## Workflows

| Id | Title | Tier | Minutes | Credits per full run | Ends with |
|---|---|---|---|---|---|
| `handyman.first_25` | Your first 25 | free | 20 | 6 | 15 people you know and 10 local agents, property managers, apartment buildings and hardware stores, each with a message, a CSV, the offer card and door hangers |
| `handyman.offer` | Your offer | builder | 10 | 4 | One-page offer sheet: fix-it and half-day visits, common jobs, the hourly rate, add-ons, the ladder, money model and job math |
| `handyman.sample_one` | Make a free sample | builder | 5 | 2 | One 15-minute fix free for one street (door hangers and a card to text) or a small demo for one partner business (a card for their customers, a one-page sample offer, every message saved on the lead) |
| `handyman.reply` | Answer a reply | builder | 2 | 6 | What the reply means, an answer with one next step to send, the lead moved to Replied with the answer for Do my day. A "stop" gets no answer and is marked lost |
| `handyman.quote` | Quote a job | builder | 3 | 3 | One visit or job priced from your menu, extra hours, add-ons and a plan (sales.quote), text to send, invoice when they say yes (sales.invoice) |
| `handyman.punch_list` | Punch list quote | builder | 5 | 4 | Hours and visits for the whole list, the order to do it, a price from your hourly rate, the jobs for a licensed trade with your state's rule linked, the lead, ladder and anchoring checks, a printable estimate, the text, the quote (sales.quote) and the invoice on a yes (sales.invoice) |
| `handyman.won` | A customer said yes | builder | 5 | 3 | Booking, founding-client, prep and after-job texts, a printable job sheet, the invoice (sales.invoice) at the right step of the first-clients ladder, the lead marked won |
| `handyman.keep` | Keep your customers | builder | 5 | 1 | Thank-you, honest review ask (nothing offered for it), the quarterly plan, referral ask and a later check-in, each dated, plus review cards with a QR code |
| `handyman.proof` | Show your work | builder | 5 | 5 | Result card and before-and-after collage (PNG), the permission ask, a post and the review ask; after a written yes, a case study page that says so when the job was founding-price or free |
| `handyman.next_25` | Your next 25 | builder | 15 | 5 | The next 10 to 100 businesses (plus people you add) not already in your Pipeline, each with a message, walk-in line and follow-ups, saved for Do my day, and a dated CSV. Suggested every Monday at 7am |
| `handyman.ready` | Look ready | builder | 15 | 9 | A one-page website to preview and publish (site.build), a Google Business Profile kit (local.gbp_kit) and a flyer with this month's offer (local.flyer), all with the same prices and color |
| `handyman.same_street` | Same street first | builder | 10 | 2 | Neighbor door hangers with a lower price, a route sheet to tick off and the intro ask for your customer, who is never named to neighbors |

Credits are the step tools' credits from the registry (kit `testing.catalog`). A full run of every workflow comes to 50.

## Tools

- `handyman.punch_list` Price a punch list: input `customer`, `items` (the pasted list, one job per line, up to 60 jobs), `built` (year the home was built), `rate` (hourly, kept in this pack's memory), `city`, `business`, `phone`, `link`, `color`. Output `items[]` for `sales.quote` (`{label, detail, qty, unit, price}`, in work order, plus the trip minimum when the list is short), `subtotal`, `rate`, `hours` (low, high, mid, text), `visits`, `order[]` (each step with its jobs), `lines[]` (what was typed, what it was counted as, the time, the price, the typical price alone with its publishers, where the time came from), `refer[]` (the jobs for a licensed trade, who and why, with sources), `checks[]` (swaps some states license, with "check your state and city"), `unknown[]`, `state` (rule, link, limit, warning, banner), `lead`, `safety[]`, `compare`, `text`, `notes`, `sources`, `files.sheet` (one page, phone friendly, no scripts), `next[]`.
- `handyman.first_25`, `handyman.offer_card`, `handyman.price_menu`, `handyman.quote_job`, `handyman.keep_customer`, `handyman.free_sample`, `handyman.answer_reply`, `handyman.book_job`, `handyman.result_card`, `handyman.case_study`, `handyman.next_batch`, `handyman.ready_kit` and `handyman.street_route`: the kit's household tools with this pack's data (see `packs/washing/README.md` for their inputs and outputs).

Composed from other packs by name: `sales.quote` and `sales.invoice` (quote, punch list, won), `site.build`, `local.gbp_kit` and `local.flyer` (ready).

## The punch list quote

- Reading the list: each line (or each job in a line joined by commas or "and") is matched against `data/punch.json`. Work for a licensed trade is checked first: panels and service upgrades, new wiring, new circuits and moved outlets, gas lines and gas appliances, water heaters, moved or added pipes, drains and valves, heating and cooling systems, and structural work (load-bearing walls, beams, joists, new openings, decks). Then the jobs: the longest match on a job's own words wins ("leaky faucet" is a repair, "replace the faucet" is a swap); bare nouns ("doors", "lights") count only when nothing stronger matches, and generic words ("squeaky", "tighten") last. A count is read from the line ("hang 3 pictures", "two doors", "x3"), never a size ("65 inch TV", "100 amp panel"). Lines that match nothing are listed to price by eye.
- Time: each job has a low and high time for the first one and for each one after it. Times come from TaskRabbit, Thumbtack and HomeAdvisor where they give one; the rest are judgment calls, marked in `data/punch.json` (`time_note`) and listed in the research file.
- Price: the middle of each job's time at the member's hourly rate (typed, remembered, or the price menu's: $50 to $100 an hour from Fixr, Thumbtack, HomeAdvisor and Housecall Pro), rounded to $5, with the $125 trip minimum (Housecall Pro $125 to $200, Fixr's most common $130). This is how Housecall Pro prices a full punch list (total hours times the rate, parts extra). Each job's typical price alone from 2 or more guides is shown to the member only, with the total booked one at a time (Thumbtack: a 20-minute job is often billed as a full hour, so group them).
- Order: patches first so they dry (TaskRabbit: 24 hours before sanding and painting), then doors and repairs, plumbing with the water off once, fixtures with the breaker off once, mounting, assembly, caulk and weather stripping, outside jobs, paint, haul away, and a short return visit to finish the patches. Visits are up to 8 hours each (judgment call).
- Licensed trades by state: California (under $1,000 in labor and materials, no permit, no employees, ads say not licensed: CSLB), Arizona (under $1,000, no permit, no splitting, "not a licensed contractor" on ads: A.R.S. 32-1121), Nevada (under $1,000, and no work of a plumbing, electrical or HVAC contractor: NRS 624.031), Oregon (a CCB license once you advertise: ORS 701.010), Utah (under $7,000, but plumbing, electrical, gas and HVAC to licensed people: Utah Code 58-55-305), Florida (under $2,500, no exemption for electrical work for pay: F.S. 489.103 and 489.503) and Virginia (Class C over $1,000: Code of Virginia 54.1-1100). Where a state lists a swap as licensed work (Nevada and Utah for fixture and faucet swaps, Florida for electrical work, plumbing swaps, dishwasher hookups and roofing), the job moves to the licensed-trade list. The warning fires at 80 percent of a state's limit because the estimate is labor only. Every other state gets "This pack doesn't have your state's rule yet... check your state's contractor licensing board." No line says a job is legal everywhere.
- Checks: fixture, faucet, toilet, thermostat, door and window swaps and appliance hookups carry "needs no permit in some cities (Cotati lists them), but some states require a licensed pro even for a swap. Check your state and city."
- Lead: when a job disturbs paint or replaces a window and the home was built before 1978 (or the year isn't typed), the EPA RRP rule: more than 6 square feet a room inside or 20 outside, any window replacement, a certified firm and renovator even for a one-person business (EPA, 40 CFR 745.83), plus Oregon's CCB lead-based paint license.
- Safety: ladder jobs (fixtures, fans, gutters, roofs, blinds, smoke alarms) get OSHA 1926.1053 (3 feet above the landing, the foot a quarter of the length out, not the top step, nonconductive rails near live wires); TVs, shelves, furniture and childproofing get CPSC's "anchor TVs and furniture like bookcases and dressers securely to the wall".
- The sheet is for the customer: the jobs in work order with time and price, the total, hours and visits, what goes to a licensed pro (not in the price), what gets priced on site, how parts and extra work are handled (Housecall Pro's scope line), the redo promise and the member's contact with a QR code. The hourly rate, the guides' prices, the state rule and the checks stay in the member's view.

## Real, sample, keys and cost

- Real: every price range comes from Fixr, Thumbtack, TaskRabbit, HomeAdvisor and Housecall Pro; the member's position picks a price inside each range and their own prices win. The licensing rules are read from the state statutes and boards above, the lead rule from EPA and 40 CFR 745.83, safety from OSHA and CPSC. Checked 2026-10-19 and re-read 2026-10-20 (Fixr, Thumbtack, Housecall Pro, HomeAdvisor, TaskRabbit plumbing, CSLB, Arizona, Nevada, Oregon, Utah, Florida, Virginia, Cotati, OSHA, CPSC, BLS).
- Businesses: OpenStreetMap only, through kit `places` on 127's own map servers (free, Legal L55): real estate offices (`office=estate_agent`), property managers (`office=property_management`), apartment buildings for landlords (`building=apartments`) and hardware stores (`shop=hardware`, `shop=doityourself`). Every list of OpenStreetMap businesses carries the credit. Sample runs and failed lookups use made-up businesses (`sample/partners.json`, .example sites, 555-01xx phones), marked as samples and never saved to the Pipeline.
- Outreach is always a draft the member sends. Emails to businesses end with the member's name, business, address line and a "no thanks" opt-out (kit `home/pipeline.js`, D28); texts to people they know carry none. Nothing is offered for a review.
- AI: only "Answer a reply" may call it. The punch list quote is code: no AI, no network, no keys.
- Photos: `sample/before.jpg` and `sample/after.jpg` are drawn illustrations, labeled "Sample illustration" on the image, for the example run only.
- The founding price is for permission to share before and after photos and honest feedback, never for a review. A case study from a founding-price or free job says so (FTC 16 CFR 255.5).
- No income figures anywhere: prices are per job, per visit or per hour.

## Kit changes this pack would like

1. `home/index.js`: a hook to add a pack's own tools and workflows (this pack edits `pack.tools` and `pack.workflows` after the fact, like junk and windows).
2. `home/pages.js`: export `foot` (the contact and QR footer), so `lib/sheet.js` need not copy it.
3. `home/quote.js`: a measured line that is the hourly rate itself ("Extra hours") without a package line, for an hourly-only quote.
4. `home/ready.js`: list the hourly rate next to the flat visits, so the site and profile show it.
5. A shared state-licensing table in the kit (contractor limits, advertising rules, licensed trades by state), so lawn, washing, pool and this pack read the same sourced rules instead of each keeping its own.

## Tests

`node --test packs/handyman/test/*.test.js`: the contract lint, every workflow on its example (kit `packSuite`), the household behavior tests (kit `home/suite.js`), every price range with 2 or more dated sources and no single-source price, the list reader (jobs, counts, sizes, licensed trades, gas grills that aren't gas work), the sample list's time, price, visits and order, states that move swaps to a licensed trade (Nevada, Utah), the limit warnings (California, Arizona) and banners (Oregon), the lead rule by year and job, the OSHA and CPSC lines, the trip minimum, no copy saying a job is legal everywhere, and the tool's output against its schema with the rate remembered and kept off the customer sheet.
