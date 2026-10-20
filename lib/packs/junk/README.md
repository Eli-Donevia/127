# Junk removal

Start a junk removal business: your first 25 neighbors and partners, a price menu by truck load from real ranges, a load estimate from a list of items, and the dump rules to check where you live.

Built on the shared household spine (`packs/_kit/home/`, the same code as cleaning, lawn, detailing, washing, windows, pool and lights). Everything about the niche is data: `data/niche.json` (crowd card, partners, offers by month, first-clients ladder, money model, texts, quote fields, job checklist, objections, free samples, won and proof words, specials, licenses, starter kit, plays, all from `research/niches/junk.json` with sources) and `data/prices.json` (load sizes from a minimum to a full truck, add-ons, plans, every range with its sources and checked date). The special for this niche: `junk.same_street`.

On top of the spine (`index.js`):

- `junk.load_estimate`, Load estimate, the signature workflow (`tools/load-estimate.js`; the list reader in `lib/parse.js`, the math in `lib/estimate.js`, the printable sheet in `lib/sheet.js`). It is offered as a next step after a reply, a quote, the offer, a free sample and a same-street day.
- `data/items.json`: the volume table (cubic yards and pounds per item, EPA weights where a source gives them), `data/disposal.json`: the items that need special disposal (paint, tires, electronics, mattresses, appliances with refrigerant), with each state's note where a source has one.

## Workflows

| Id | Title | Tier | Minutes | Credits per full run | Ends with |
|---|---|---|---|---|---|
| `junk.first_25` | Your first 25 | free | 20 | 6 | 15 people you know and 10 local property managers, agents, estate sale shops, storage sites and contractors, each with a message, plus door hangers. |
| `junk.offer` | Your offer | builder | 10 | 4 | Your price menu by truck load, the first-clients ladder, add-ons for appliances and tires, and job math, on a one-page offer sheet. |
| `junk.sample_one` | Make a free sample | builder | 5 | 2 | A free demo for one street or one partner business: door hangers or a sample letter, a card to send and every message, saved to your Pipeline. |
| `junk.reply` | Answer a reply | builder | 2 | 6 | Paste what someone wrote back: what they meant, a short answer with one next step, and your Pipeline updated. A draft you send yourself. |
| `junk.quote` | Quote a job | builder | 3 | 3 | How much of the truck, stairs, debris and appliances in; a quote, a text and an invoice out. |
| `junk.load_estimate` | Load estimate | builder | 5 | 4 | A pasted list of items in; the share of the truck, the price, what needs special disposal where you live and the dump fee out, with a quote and invoice. |
| `junk.won` | A customer said yes | builder | 5 | 3 | Log the yes, then everything for the job: the booking text, a prep text, a printable job sheet, the after-job text and the invoice. |
| `junk.keep` | Keep your customers | builder | 5 | 1 | A thank-you, an honest review ask, a referral ask and a later check-in, each dated, plus review cards with your QR code. |
| `junk.proof` | Show your work | builder | 5 | 5 | One cleared garage turned into proof: a result card, a before-and-after collage, a caption, an honest review ask and a case study once they say yes. |
| `junk.next_25` | Your next 25 | builder | 15 | 5 | The next 25 property managers, agents, estate sale shops, storage sites and contractors near you, not yet in your Pipeline, with messages for Do my day. |
| `junk.ready` | Look ready | builder | 15 | 9 | Look ready before you reach out: a one-page website, a Google profile kit and a flyer, all from your real prices. |
| `junk.same_street` | Same street first | builder | 10 | 2 | One customer's street turned into a route: door hangers with a neighbor price, a sheet for the 20 nearest homes and an intro ask for your customer. |

A full run of every workflow comes to 50.

Credits are the step tools' credits from the registry (kit `testing.catalog`).

## Tools

- `junk.first_25` Your first 25 list (code, 4)
- `junk.offer_card` Offer card and door hangers (code, 2)
- `junk.price_menu` Price menu and offer (code, 2)
- `junk.quote_job` Quote this job (code, 1)
- `junk.keep_customer` Keep this customer (code, 1)
- `junk.free_sample` Make a free sample (code, 2)
- `junk.answer_reply` Answer this reply (ai, 6)
- `junk.book_job` Book this job (code, 2)
- `junk.result_card` Result card and collage (code, 3)
- `junk.case_study` Write the case study (code, 2)
- `junk.next_batch` Find your next batch (code, 5)
- `junk.ready_kit` Gather your facts (code, 1)
- `junk.street_route` Same street route (code, 2)
- `junk.estimate_load` Estimate this load (code, 2)

Composed from other packs by name: `sales.quote` and `sales.invoice` (quote, load estimate, won), `site.build`, `local.gbp_kit` and `local.flyer` (ready).

## The load estimate

- Input: the customer, the items (typed or pasted, one per line or in a sentence: "a couch, 2 mattresses, 10 bags"), access (curbside, garage or ground floor, or upstairs, basement or a long carry), loose material, the dump's rate per ton and minimum, the appliance and tire fees, and the truck size and payload.
- Space: each item against the volume table, counted in eighths of a truck the way the sources price loads; an item the table doesn't know is counted at a default size and flagged for the member to check. Weight: from the same table. Trips: whichever runs out first, the truck's space or its payload (the member's truck when typed).
- Price: the member's menu at their position over the sourced load ranges, plus add-ons (appliances, tires, stairs) and the dump fee from the rate per ton the member typed. Nothing is a fee we did not read.
- Disposal: items that need special handling get their line, with the state's note where a source has one and "check your county" where rules vary (paint, tires, electronics, mattresses, refrigerant). Things a junk hauler shouldn't take (hazardous waste) are kept out and say where they go.
- The member's dump numbers are kept in this pack's memory, so they type them once. The line items go to `sales.quote` and, on a yes, `sales.invoice`.

## Real, sample, keys and cost

- Real: prices come from the sourced ranges in `data/prices.json`; the member's position picks a price inside each range and their own prices win. The season check uses the member's city (OpenStreetMap geocode when online, a state and city latitude table offline).
- Businesses: OpenStreetMap only, through kit `places` on 127's own map servers (Legal L55), with "Search by LocationIQ.com" when LocationIQ found the town (L57). Every list of OpenStreetMap businesses carries the credit on screen, in each CSV and on each page (D27). Sample runs and failed lookups use made-up businesses (`sample/partners.json` or kit samples, .example sites, 555-01xx phones), marked as samples and never saved to the Pipeline.
- Do my day (D29): every business saved gets `msg` (dm, subject, email, walkin, follow1, follow2), `facts`, `score` and `channel`; people the member knows are saved warm with their own texts. Outreach is a draft the member sends, with their address and a "no thanks" opt-out.
- AI: only "Answer a reply" may call it, to fit the written answer to their words. The estimate and the quote are code: no AI, no network.
- Photos: `sample/before.jpg` and `sample/after.jpg` are drawn illustrations, labeled "Sample illustration" on the image, for the example run only. Members add their own.
- The founding price is for permission to share before and after photos and honest feedback, never for a Google review. Review asks go to every customer with nothing in return. A case study from a founding-price or free job says so (FTC 16 CFR 255.5).

## Tests

`node --test packs/junk/test/*.test.js`: the contract lint, every workflow on its example (kit `packSuite`), the household behavior tests (kit `home/suite.js`), every price range with its dated sources, the list reader, the load math (eighths, weight, payload, dump fee), the disposal lines and the load estimate workflow (sheet, text and quote agree).
