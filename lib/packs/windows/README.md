# Window cleaning

Start a window cleaning business: your first 25 people and partners, prices per window, per pane and per house from real ranges, a window count estimate with a printable sheet, quotes priced per window and a storefront route.

Built on the shared household spine (`packs/_kit/home/`, the same code for cleaning, lawn, detailing and washing). Everything about the niche is data: `data/niche.json` (crowd card, partners, offers by month, first-clients ladder, money model, texts, quote fields, estimate words and checks, job checklist with ladder rules, objections, free samples, won and proof words, specials, licenses, starter kit, plays, all from `research/niches/windows.json` with sources) and `data/prices.json` (per-window, per-pane and per-house ranges for kit `quote`, every range with 2 or more sources and its checked date, plus the estimate's window types and floors). The specials for this niche: `windows.same_street` and `windows.storefronts`.

On top of the spine (`index.js`):

- `windows.estimate`, Window count estimate, the signature workflow (`tools/count-estimate.js`, math and sheet in `lib/estimate.js`). It is offered as a next step from Answer a reply, Quote a job, Your offer, Same street first and Make a free sample.
- `windows.quote_job` priced per window (`lib/quote-plan.js`, the kit tool with the same name, input and output): window counts win over a flat house price, a plan takes its discount off counted windows, storefront visits carry no trip minimum, minutes follow inside or outside, and inside only carries no floor charge.

## Workflows

| Id | Title | Tier | Minutes | Credits per full run | Ends with |
|---|---|---|---|---|---|
| `windows.first_25` | Your first 25 | free | 20 | 6 | 15 people you know and 10 local agents, managers, shops and apartment buildings, each with a message, a CSV, the offer card and door hangers |
| `windows.offer` | Your offer | builder | 10 | 4 | One-page offer sheet, prices per window, per pane and per house, floors, ladder, money model, job math |
| `windows.sample_one` | Make a free sample | builder | 5 | 2 | One front window free for one street (door hangers and a card to text) or for one partner business (a card for their customers, a one-page sample offer, every message saved on the lead) |
| `windows.reply` | Answer a reply | builder | 2 | 6 | What the reply means, an answer with one next step to send, the lead moved to Replied with the answer for Do my day. A "stop" gets no answer and is marked lost |
| `windows.quote` | Quote a job | builder | 3 | 3 | Per-window quote (sales.quote), text to send, invoice when they say yes (sales.invoice) |
| `windows.estimate` | Window count estimate | builder | 5 | 4 | Counts by window type and floor: minutes per pane, time on site, the price, gear for each floor, checks with sources, a printable estimate sheet, the text, the quote (sales.quote) and the invoice on a yes (sales.invoice) |
| `windows.won` | A customer said yes | builder | 5 | 3 | Booking, founding-client, prep and after-job texts, a printable job sheet with the ladder checks, the invoice (sales.invoice) at the right step of the first-clients ladder, the lead marked won |
| `windows.keep` | Keep your customers | builder | 5 | 1 | Thank-you, honest review ask (nothing offered for it), the spring and fall plan, referral ask and a later check-in, each dated, plus review cards with a QR code |
| `windows.proof` | Show your work | builder | 5 | 5 | Result card and before-and-after collage (PNG), the permission ask, a post and the review ask; after a written yes, a case study page that says so when the job was founding-price or free |
| `windows.next_25` | Your next 25 | builder | 15 | 5 | The next 10 to 100 businesses (plus people you add) not already in your Pipeline, each with a message, walk-in line and follow-ups, saved for Do my day, and a dated CSV. Suggested every Monday at 7am |
| `windows.ready` | Look ready | builder | 15 | 9 | A one-page website to preview and publish (site.build), a Google Business Profile kit (local.gbp_kit) and a flyer with this month's offer (local.flyer), all with the same prices and color |
| `windows.same_street` | Same street first | builder | 10 | 2 | Neighbor door hangers with a lower price, a route sheet to tick off and the intro ask for your customer, who is never named to neighbors |
| `windows.storefronts` | Storefront window route | builder | 15 | 4 | Shops, cafes, salons and offices in walking order with directions for each leg, a counter script with a free demo, a rate sheet to leave behind, saved to your Pipeline |

Credits are the step tools' credits from the registry (kit `testing.catalog`). A full run of every workflow comes to 54.

## Tools

- `windows.count_estimate` Window count estimate: input `customer`, `address`, counts `standard_1` to `standard_3`, `picture_1`, `picture_2`, `french_1`, `french_2` (type and floor), `skylights`, `screens`, `tracks`, `hard_water`, `sides` (Inside and out, Outside only, Inside only), `frequency` (One time, Every 6 months, Every 3 months), `city`, `business`, `phone`, `link`, `color`. Output `rows[]` `{item, count, panes, perPane, minutes, each, total}`, `items[]` for `sales.quote`, `subtotal`, `windows`, `panes`, `minutes`, `hours`, `perHour`, `gear[]` (per floor), `flags[]` (each with its sources), `plan`, `text`, `notes`, `valid`, `sources`, `files.sheet` (one page, phone friendly, no scripts), `next[]`.
- `windows.quote_job` Quote this job: the niche's quote fields in (how to price it, standard, picture and small French pane counts, floors, sides, screens, tracks, hard water, skylights, how often), `items[]` `{label, detail, qty, unit, price}` out (what `sales.quote` and `sales.invoice` take), plus `subtotal`, `title`, `minutes`, `hours`, `plan`, `advice[]`, `changes[]` (what it changed and why), `text`, `next[]`.
- `windows.first_25` Your first 25 list: input `people` (pasted, one per line), `city`, `business`, `phone`, `link`, `price`, `exclude`, `batch`. Output `people[]`, `partners[]`, `lead` (this month's offer, priced), `first` (the text to send now), `replies[]`, `plan[]`, `files.csv`.
- `windows.offer_card` Offer card and door hangers: input `lead` (from first_25 or price_menu), `business`, `phone`, `link`, `color`. Output `files.png` (1080x1350), `files.html` (two door hangers per Letter sheet).
- `windows.price_menu` Price menu and offer: input `position` (budget, standard, premium), `prices` ("Standard windows 12"), `supplies`, `hourly`, `fixed`. Output `packages[]`, `sizes[]`, `addons[]`, `ladder[]`, `model[]`, `jobs[]`, `lead`, `files.html`. Remembers the position and prices, which the quote and the estimate use.
- `windows.keep_customer`, `windows.free_sample`, `windows.answer_reply`, `windows.book_job`, `windows.result_card`, `windows.case_study`, `windows.next_batch`, `windows.ready_kit`, `windows.street_route` and `windows.storefront_route`: the kit's household tools with this pack's data (see `packs/washing/README.md` for their inputs and outputs).

Composed from other packs by name: `sales.quote` and `sales.invoice` (quote, estimate, won), `site.build`, `local.gbp_kit` and `local.flyer` (ready).

## The window count estimate

- Price: each count times the member's rate (per standard window, per picture window, per small French or divided pane, per skylight, per screen, per window for tracks and hard water), times the floor (first 1, second 1.2, third 1.4, only when the outside is cleaned: inside only, every floor is cleaned from inside at the first-floor price) and the side (inside and out 1, outside only 0.6, inside only 0.4). A plan takes 10% (every 6 months) or 15% (every 3 months) off each visit. Jobs under the trip minimum ($100) are raised to it.
- Time: minutes per pane (standard 4 a pane, 2 panes a window; picture 10; French 2; skylight 20) times the floor (1, 1.5, 2) and the side (1, 0.6, 0.4), plus screens, tracks, hard water and 15 minutes of setup. Time on site and the price per hour; under the sourced $40 to $75 an hour, it says so.
- The ranges are sourced (Housecall Pro, Fixr, HomeAdvisor, Jobber, StartCosts, Thumbtack; checked 2026-10-19). The floor and side multipliers, the minutes per pane and the trip minimum are judgment calls inside those sources, marked as such in `data/prices.json` with their basis.
- Checks: second floor (power lines, levelers, the 4 to 1 ladder angle, from OSHA), third floor (water-fed pole from the ground or clean from inside, from HSE), skylights (from inside or from the ground, stay off the roof), hard water (test one window first), inside only (does the trip minimum cover the drive).
- The sheet is for the customer: what was counted on each floor, each price, the total, the time on site, what's included, the redo promise, the price's last day and the member's contact with a QR code. Minutes per pane, gear and checks stay in the member's view.

## Real, sample, keys and cost

- Real: prices come from the sourced ranges; the member's position picks a price inside each range and their own prices win. Season check uses the member's city (OpenStreetMap geocode when online, a state and city latitude table offline).
- Businesses: OpenStreetMap only, through kit `places` on 127's own map servers (free, Legal L55), with "Search by LocationIQ.com" when LocationIQ found the town (L57). Every list of OpenStreetMap businesses carries the credit: on screen, as the last row of each CSV and on each page (D27). Sample runs and failed lookups use made-up businesses (`sample/partners.json` or kit samples, .example sites, 555-01xx phones), marked as samples and never saved to the Pipeline.
- Do my day (D29): every business saved gets `msg` (dm, subject, email, walkin, follow1, follow2), `facts`, `score` and `channel`; people the member knows are saved warm with their own texts.
- AI: only "Answer a reply" may call it, to fit the written answer to their words. The estimate and the quote are code: no AI, no network.
- Photos: `sample/before.jpg` and `sample/after.jpg` are drawn illustrations, labeled "Sample illustration" on the image, for the example run only. Members add their own.
- The founding price is for permission to share before and after photos and honest feedback, never for a Google review. Review asks go to every customer with nothing in return. A case study from a founding-price or free job says so (FTC 16 CFR 255.5).
- Safety and rules are cited from OSHA, HSE, 18 U.S.C. 1725 (nothing in or on a mailbox), SBA and IRS, with "check your city and state" where they vary.

## Kit changes this pack would like

1. `home/quote.js`: plans on measured lines (a per-window plan discount), so `lib/quote-plan.js` can go.
2. `home/quote.js`: a per-package trip minimum (none for a storefront route stop).
3. `home/quote.js`: counts and a flat package together should not both charge; the counts should win.
4. `home/quote.js`: measured-line minutes that follow factors like sides, with a factor's added minutes once per job, not once per line.
5. `home/index.js`: a hook to add a pack's own tools and workflows (this pack edits `pack.tools` and `pack.workflows` after the fact).
6. `home/pages.js`: export `foot` (the contact and QR footer), so `lib/estimate.js` need not copy it.
7. `home/ready.js`: list per-unit rates too (it shows flat packages only, so the site and profile show house prices, not the per-window and per-pane rates).

## Tests

`node --test packs/windows/test/*.test.js`: the contract lint, every workflow on its example (kit `packSuite`), the household behavior tests (kit `home/suite.js`), every price range with 2 or more dated sources, the estimate math (prices per floor, panes, minutes per pane, outside only, trip minimum, the plan, the per-hour check), the estimate workflow (sheet, text and quote agree, no scripts) and the per-window quote (counts win, the plan on counted windows, no storefront minimum).
