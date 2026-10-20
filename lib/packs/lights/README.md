# Holiday lights

Start a holiday light installation business: your first 25 neighbors and partners, a price menu by home size and by the foot from real ranges, a roofline plan with feet of lights, clips, cords and circuits, and the right offer for each month of the year.

Built on the shared household spine (`packs/_kit/home/`, the same code for cleaning, lawn, detailing and washing). Everything about the niche is data: `data/niche.json` (crowd card, partners, offers by month, first-clients ladder, money model, texts, quote fields, job checklist, objections, free samples, won and proof words, specials, licenses, starter kit, plays, all from `research/niches/lights.json` with sources) and `data/prices.json` (price ranges for kit `quote`, every range with its sources and checked date). The specials for this niche: `lights.same_street` and `lights.season_plan`. One workflow of its own: `lights.roofline_plan` (`tools/roofline-plan.js`, math in `lib/roofline.js`, facts and sources in `data/roofline.json`).

The business has three parts, and the Roofline plan prices each: lights (leased for the season, the customer's own, or bought to keep), the install, and the takedown in January with storage until next season.

## Workflows

| Id | Title | Tier | Minutes | Credits per full run | Ends with |
|---|---|---|---|---|---|
| `lights.first_25` | Your first 25 | free | 20 | 6 | 15 people you know with a text each, 10 HOAs, real estate offices, shops, churches and restaurants near you with a partner ask, the offer for this month, door hangers and an offer card |
| `lights.offer` | Your offer | builder | 10 | 4 | One-page offer sheet, price menu by home size and by the foot, ladder, money model, job math |
| `lights.sample_one` | Make a free sample | builder | 5 | 2 | A free lighting plan for one street (door hangers and a card to text) or a free demo for one partner business (a card for their customers, a one-page sample offer, every message saved on the lead) |
| `lights.reply` | Answer a reply | builder | 2 | 6 | What the reply means, an answer with one next step to send, the lead moved to Replied with the answer for Do my day. A "stop" gets no answer and is marked lost |
| `lights.quote` | Quote a job | builder | 3 | 3 | Quote by home size and stories (sales.quote), text to send, invoice when they say yes (sales.invoice) |
| `lights.roofline_plan` | Roofline plan | builder | 10 | 3 | Feet of lights, bulbs, clips, stakes, cords and timers, runs packed onto circuits under the 80% rule, material cost, the price and price per foot, a design sheet for the homeowner, an install sheet for you, a calendar file with the install, check, takedown and next season, and the quote (sales.quote) |
| `lights.won` | A customer said yes | builder | 5 | 3 | Booking, founding-client, prep and after-job texts, a printable job sheet with the checklist, the invoice (sales.invoice) at the right step of the first-clients ladder, the lead marked won |
| `lights.keep` | Keep your customers | builder | 5 | 1 | Thank-you, honest review ask (nothing offered for it), next season's plan, referral ask and a mid-season check-in, each dated, plus review cards with a QR code |
| `lights.proof` | Show your work | builder | 5 | 5 | Result card and before-and-after collage (PNG), the permission ask, a post and the review ask; after a written yes, a case study page that says so when the job was founding-price or free |
| `lights.next_25` | Your next 25 | builder | 15 | 5 | The next 10 to 100 businesses (plus people you add) not already in your Pipeline, each with a message, walk-in line and follow-ups, saved for Do my day, and a dated CSV. Suggested every Monday at 7am |
| `lights.ready` | Look ready | builder | 15 | 9 | A one-page website to preview and publish (site.build), a Google Business Profile kit (local.gbp_kit) and a flyer with this month's offer (local.flyer), all with the same prices and color |
| `lights.same_street` | Same street first | builder | 10 | 2 | Neighbor door hangers with a neighbor price, a route sheet of the homes around your customer, the intro ask for your customer and a line for neighbors you meet. The customer is never named to neighbors |
| `lights.season_plan` | Your season plan | builder | 5 | 1 | Twelve months: installs in the fall, takedowns in January, next season booked in the slow months, who to reach and what to do first, as a page and a calendar file with a reminder on the 1st of each month |

A full run of every workflow is 50 credits; the free workflow is 6.

Roofline plan is offered as a next step from Your offer, Make a free sample, Answer a reply and Quote a job.

## Roofline plan

Type one run per line: where it goes, then its feet ("Front gutter 48", "Garage peaks 2 x 18", "2nd story gutter 52 steep", "Front walkway 30 both sides", "Maple tree 60"). Each line is read as roofline and trim, a walkway or drive (stakes), or a tree wrap (small, medium or large); "2nd story", "steep" and "both sides" are read too, and a story number or a tree's height is never taken as feet.

- Bulbs: one per socket at 12 or 6 inch spacing, plus 5% spares. LED C9 at 0.8 W (the higher of the two ratings read), incandescent C9 at 7 W, or the watts from the member's own box.
- Circuits: a run of spool wire carries up to 840 W (7 A, the lowest rating read), so a longer run is split into plug-ins; plug-ins are packed onto circuits, biggest first, under the 80% rule for a continuous load: 1,440 W on a 15 amp breaker, 1,920 W on 20 amp (NEC 210.20(A), lights on 3 hours or more). When the house has fewer outdoor circuits than the plan needs, it says to take out a run, use LED, or have a licensed electrician add a circuit; the member never adds one.
- Materials: wire, bulbs, zip plugs, clips (one per bulb on roofline runs), stakes (one per bulb on walkways), 50 ft 16-gauge cords (13 A label, one per plug-in) and timers (one per circuit), each with what to buy and the cost for this job's share of each pack, from sourced product prices. Unpriced items say check current rates.
- Price: from the member's own per-foot rates on their menu (lights leased, hanging their lights, takedown, lights to keep), plus the hanging rate again for upper-story feet (Thumbtack), 20% for hard-to-reach runs (four sources), tree wraps per tree, timers and the trip minimum. Large trees are priced on site. The price per foot is set against the sourced range for that kind of job.
- Dates: install (the next install window from October 1, or the date typed), a check 21 days later, takedown from January 2 through January, storage, and next season from September 1.
- Files: a design sheet for the homeowner (the runs drawn as bulbs colored by circuit, the price, the dates, what's included, no costs), an install sheet for the member (runs, circuits, the power math, materials and cost, safety, measuring, how every number is reached, sources) and a calendar file.

## Tools

The household spine's tools (`lights.first_25`, `lights.offer_card`, `lights.price_menu`, `lights.quote_job`, `lights.keep_customer`, `lights.free_sample`, `lights.answer_reply`, `lights.book_job`, `lights.result_card`, `lights.case_study`, `lights.next_batch`, `lights.ready_kit`, `lights.street_route`, `lights.season_plan`) work as in `packs/lawn/README.md`. Its own:

- `lights.plan_roofline` Plan the roofline: input `runs` (one per line), `model` (my lights leased for the season, their own lights, lights they buy and keep), `bulbs`, `watts`, `spacing`, `breaker`, `circuits` (outdoor circuits at the house), `install`, `takedown`, `customer`, `address`, `city`, `business`, `phone`, `link`, `color`. Output `runs[]`, `skipped[]`, `circuits[]`, `power`, `materials[]`, `cost`, `items[]` `{label, detail, qty, unit, price}` (what `sales.quote` takes), `subtotal`, `perFoot`, `feet`, `range`, `plan`, `minutes`, `dates`, `text` (to the homeowner), `warnings[]`, `files.html` (design sheet), `files.sheet` (install sheet), `files.ics`.

Composed from other packs by name: `sales.quote` and `sales.invoice` (quote, roofline plan, won), `site.build`, `local.gbp_kit` and `local.flyer` (ready).

## Real, sample, keys and cost

- Real: prices come from the sourced ranges (Fixr, HomeAdvisor, Thumbtack, Bob Vila; product pages for spools, bulbs, clips, stakes and cords; checked 2026-10-19); the member's position picks a price inside each range and their own prices win. Electrical and ladder lines cite the NEC (NFPA's public drafts), OSHA and the CPSC, with "check your city and state" where rules vary. Season check uses the member's city.
- Businesses: OpenStreetMap only, through kit `places` on 127's own map servers, with the credit on screen, in each CSV and on each page. Sample runs use made-up businesses (`sample/partners.json`, .example sites, 555-01xx phones), never saved to the Pipeline.
- AI: only "Answer a reply" may call it, to fit the written answer to their words. Roofline plan is code only.
- Photos: `sample/before.jpg` and `sample/after.jpg` are drawn illustrations, labeled "Sample illustration" on the image, for the example run only. Members add their own.
- The founding price is for permission to share before and after photos and honest feedback, never for a review. Review asks go to every customer with nothing in return. A case study from a founding-price or free job says so.
- What members promise their customers stays on what they control: a fix within 2 days when a bulb or strand goes out during the season, the takedown dates, and storage of the lights they lease.

## Tests

`node --test packs/lights/test/*.test.js`: the contract lint, every workflow on its example (kit `packSuite`), the household behavior tests (kit `home/suite.js`), the sources on every price, and the Roofline plan: typed lines to runs, the 80% rule at 15 and 20 amps, runs split by their wire and packed onto circuits, materials by who owns the lights, price lines, the trip minimum and the plan, dates in and out of season, and one full run (design sheet without costs, install sheet, calendar at 9am Chicago time, the quote at the plan's price).
