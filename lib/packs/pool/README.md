# Pool cleaning

Start a pool cleaning business: your first 25 neighbors and partners, a price menu by pool size from real ranges, quotes in a few taps, the right offer for the season where you live, and a visit log card that checks each visit's readings against CDC's ranges for home pools and hot tubs.

Built on the shared household spine (`packs/_kit/home/`, the same code for cleaning, lawn, detailing and washing). Everything about the niche is data: `data/niche.json` (crowd card, partners, offers by month, first-clients ladder, money model, texts, quote fields, job checklist, objections, free samples, won and proof words, specials, licenses, starter kit, plays, all from `research/niches/pool.json` with sources), `data/prices.json` (price ranges for kit `quote`, every range with two or more sources and the checked date) and `data/chemistry.json` (the CDC ranges and chemical safety lines the visit log uses, with sources). The specials for this niche: `pool.same_street` and `pool.season_plan`. The signature workflow is `pool.visit_log` (`tools/visit-log.js`, `lib/visit.js`, `lib/page.js`).

## Workflows

| Id | Title | Tier | Minutes | Credits per full run | Ends with |
|---|---|---|---|---|---|
| `pool.first_25` | Your first 25 | free | 20 | 6 | 15 people you know and 10 local pool supply stores, agents, HOAs, rental hosts and apartments, each with a message, door hangers and a card with this month's offer, a CSV |
| `pool.offer` | Your offer | builder | 10 | 4 | One-page offer sheet, price menu by pool size, ladder, money model, job math |
| `pool.sample_one` | Make a free sample | builder | 5 | 2 | A free water test for one street (door hangers and a card to text) or a sample for one partner business (a card for the people they serve, a one-page sample offer, every message saved on the lead) |
| `pool.reply` | Answer a reply | builder | 2 | 6 | What the reply means, an answer with one next step to send, the lead moved to Replied with the answer for Do my day. A "stop" gets no answer and is marked lost |
| `pool.quote` | Quote a job | builder | 3 | 3 | Quote (sales.quote), text to send, invoice when they say yes (sales.invoice) |
| `pool.won` | A customer said yes | builder | 5 | 3 | Booking, prep and after-visit texts, a printable job sheet with the checklist, the invoice (sales.invoice) at the right step of the first-clients ladder, the lead marked won |
| `pool.visit_log` | **Visit log card** (signature) | builder | 3 | 1 | A printable visit log and a CSV, the text to the owner with what was done, a flag on any free chlorine or pH reading outside CDC's ranges, and this pool's last 6 visits |
| `pool.keep` | Keep your customers | builder | 5 | 1 | Thank-you, honest review ask (nothing offered for it), weekly plan, referral ask and a later check-in, each dated, plus review cards with a QR code |
| `pool.proof` | Show your work | builder | 5 | 5 | Result card and before-and-after collage (PNG), the permission ask, a post and the review ask; after a written yes, a case study page that says so when the job was founding-price or free |
| `pool.next_25` | Your next 25 | builder | 15 | 5 | The next 10 to 100 local businesses (plus people you add) not already in your Pipeline, each with a message, walk-in line and follow-ups, saved for Do my day, and a dated CSV. Suggested every Monday at 7am |
| `pool.ready` | Look ready | builder | 15 | 9 | A one-page website to preview and publish (site.build), a Google Business Profile kit (local.gbp_kit) and a flyer with this month's offer (local.flyer), all with the same prices and color |
| `pool.same_street` | Same street first | builder | 10 | 2 | Neighbor door hangers with a neighbor price on the weekly visit, a route sheet of the homes around your customer, the intro ask for your customer and a line for neighbors you meet. The customer is never named to neighbors |
| `pool.season_plan` | Your season plan | builder | 5 | 1 | Twelve months of offers for where you live (closings and spring openings where pools close, the weekly route where they don't), who to reach and what to do first, as a page and a calendar file |

The visit log card is offered as a next step after "A customer said yes" (first), "Make a free sample" (after a free water test) and "Keep your customers". A full run of every workflow is 48 credits; the free run is 6.

## Tools

- `pool.first_25`, `pool.offer_card`, `pool.price_menu`, `pool.quote_job`, `pool.keep_customer`, `pool.free_sample`, `pool.answer_reply`, `pool.book_job`, `pool.result_card`, `pool.case_study`, `pool.next_batch`, `pool.ready_kit`, `pool.street_route`, `pool.season_plan`: the household spine's tools with this niche's data, the same inputs and outputs as lawn's (see `packs/lawn/README.md`). The quote fields here are `service` (weekly service visit, chemical check visit, one-time cleaning, opening, closing), `size` (or `length` in feet), `water` (clear or green, for a one-time cleaning or an opening), `frequency` and `addons` (filter cleaning, hot tub with an opening or closing).
- `pool.log_visit` Log a pool visit (signature): input `customer`, `kind` (Pool, Hot tub or spa), `fc`, `ph`, `cya`, `stabilizer` (Yes, No, Not sure), `test` (DPD kit, Test strips, Other test), `alk`, `hardness`, `salt`, `temp`, `other`, `done` (comma separated), `added` (product and amount, as the label directed), `notes`, `next`, `date`, `business`, `phone`, `link`, `color`. Output `rows[]` `{reading, value, range, status, flag}`, `flags[]`, `notes[]`, `done[]`, `text` (to send the owner), `fill` (true when the text has "[What you did about it.]" to fill in), `inRange`, `history[]` (last 6 visits: date, free chlorine, pH, readings outside a range), `safety[]`, `source`, `files.html` (one Letter page, no scripts, readable at phone width), `files.csv`. Remembers the visits under the pack key `visits`.

Composed from other packs by name: `sales.quote` and `sales.invoice` (quote, won), `site.build`, `local.gbp_kit` and `local.flyer` (ready).

## The visit log card

- **What it checks, and only this.** Free chlorine at least 1 ppm in pools, at least 2 ppm in pools that use stabilizer (cyanuric acid), at least 3 ppm in hot tubs; pH 7.0 to 7.8; no stabilizer in hot tubs. From CDC, "Home Pool and Hot Tub Water Treatment and Testing" (page dated 2024-05-10, checked 2026-10-19). When the member isn't sure about stabilizer, a reading from 1 to 2 ppm gets a note, not a flag.
- **Logged without a flag.** Total alkalinity, calcium hardness, salt, temperature and anything typed under other readings: CDC gives no range for them on that page. A 0 on a DPD test gets CDC's bleach-out note; test strips get CDC's line that they are less accurate than a DPD kit.
- **Never a dose.** A flag says what CDC says and points to the product label. When a reading is off and nothing is typed under "What you added", the text to the owner keeps "[What you did about it.]" for the member to fill in. Every log carries CDC's and EPA's chemical safety lines and CDC's line that owners test chlorine and pH at least twice a day.
- **The trend.** The last 6 visits for each pool are kept in one remembered key (under 4 KB). A second log on the same day replaces the first; when the book gets too big, the pools visited longest ago drop off first.
- **Pools that may need more.** Pools at apartments, condos, HOAs and hotels can be public pools under state rules, with permits and certified operators (Florida chapter 514 as the example). The log says to check your city and state.

## Real, sample, keys and cost

- Real: prices come from the sourced ranges (Fixr, HomeAdvisor, Home Gnome, Thumbtack; checked 2026-10-19); the member's position picks a price inside each range and their own prices win. Pool size scales every package; a green pool scales a one-time cleaning or an opening (a judgment call, said so in the data). Routine chemicals are included in the weekly visit, as in Thumbtack's examples; extras like shock are quoted first. Visit times are a judgment call, except the one-time cleaning (Thumbtack).
- Seasons: where pools close for winter (latitude 37 and up), the offer in October and November is the closing and its spring opening, from December to April a spring opening booked now, and from May to September the first cleaning. Where pools stay open all year, the first cleaning and the weekly route come first every month. A city that can't be placed gets the closing offer, worded for colder cities.
- Licenses and rules: read from the statute or agency page, with Florida as the example state (contractor license for equipment repairs, public pools, carrying chemicals as materials of trade). Rules differ by state, county and city: check your city and state.
- Businesses: OpenStreetMap only, through kit `places` on 127's own map servers (free, Legal L55), with "Search by LocationIQ.com" when LocationIQ found the town (L57). Pool supply stores (`shop=swimming_pool`), HOA offices (`office=association`) and vacation rentals (`office=property_management`, `tourism=apartment`, `tourism=chalet`) depend on how well the area is mapped. Every list of OpenStreetMap businesses carries the credit (D27). Sample runs use made-up businesses (`sample/partners.json`, .example sites, 555-01xx phones), never saved to the Pipeline.
- Look ready: `lib/ready.js` tells the profile kit that pool cleaning is done at the customer's home ("mobile pool cleaning"), so it is set up as a service-area business, and says how to pick the primary category, which the kit can't suggest for pools yet. The website gets "pool service", because the site pack reads "cleaning" as house cleaning. Both stay local until the shared packs know pools (see Kit change wanted).
- AI: only "Answer a reply" may call it, to fit the written answer to their words. The visit log never calls AI.
- Photos: `sample/before.jpg` and `sample/after.jpg` are drawn illustrations, labeled "Sample illustration" on the image, for the example run only. Members add their own.
- The founding price is for permission to share before and after photos and honest feedback, never for a Google review. Review asks go to every customer with nothing in return. A case study from a founding-price or free job says so on the page and in the post (FTC 16 CFR 255.5).

## Kit change wanted

- A `pool` group in `packs/local/data/niches.json` (primary category "Pool cleaning service", mobile true), `GROUP.pool` in `packs/_kit/home/ready.js` and a pool niche in `packs/site/lib/niches.js` (pool photos and words). Then `lib/ready.js` can go.
- Kit `sizeRows` (`packs/_kit/home/tools.js`) shows size rows for every package even when a factor lists `packages`. This pack applies its size factor to every package so the card and the quote agree.

## Tests

`node --test packs/pool/test/*.test.js`: the contract lint, every workflow on its example (kit `packSuite`), the household behavior tests (kit `home/suite.js`), two or more sources on every price range, the offer by season (warm and cold places), and the visit log: each CDC range at its edges, hot tubs and stabilizer, no amounts or dose words anywhere it writes, the "[What you did about it.]" fill, one visit a day per pool and the 4 KB limit, and a two-visit run of the tool with its memory, page and CSV.
