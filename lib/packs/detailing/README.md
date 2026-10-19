# Mobile car detailing

Start a mobile car detailing business: your first 25 people and partners, a price menu by vehicle size from real ranges, quotes from the driveway and a maintenance plan that brings cars back.

Built on the shared household spine (`packs/_kit/home/`, the same code for cleaning, lawn, detailing and washing). Everything about the niche is data: `data/niche.json` (crowd card, partners, offers by month, first-clients ladder, money model, texts, quote fields, job checklist, objections, free samples, won and proof words, specials, licenses, starter kit, plays, all from `research/niches/detailing.json` with sources) and `data/prices.json` (price ranges for kit `quote`, every range with its sources and checked date). The specials for this niche: `detailing.fleets`.

## Workflows

| Id | Title | Tier | Minutes | Credits per full run | Ends with |
|---|---|---|---|---|---|
| `detailing.first_25` | Your first 25 | free | 20 | 6 | 6 |
| `detailing.offer` | Your offer | builder | 10 | 4 | One-page offer sheet, price menu by size, ladder, money model, job math |
| `detailing.sample_one` | Make a free sample | builder | 5 | 2 | A free demo for one street (door hangers and a card to text) or for one partner business (a card for their customers, a one-page sample offer, every message saved on the lead) |
| `detailing.reply` | Answer a reply | builder | 2 | 6 | What the reply means, an answer with one next step to send, the lead moved to Replied with the answer for Do my day. A "stop" gets no answer and is marked lost |
| `detailing.quote` | Quote a job | builder | 3 | 3 | Quote (sales.quote), text to send, invoice when they say yes (sales.invoice) |
| `detailing.won` | A customer said yes | builder | 5 | 3 | Booking, founding-client, prep and after-job texts, a printable job sheet with the checklist, the invoice (sales.invoice) at the right step of the first-clients ladder, the lead marked won |
| `detailing.keep` | Keep your customers | builder | 5 | 1 | Thank-you, honest review ask (nothing offered for it), regular plan, referral ask and a later check-in, each dated, plus review cards with a QR code |
| `detailing.proof` | Show your work | builder | 5 | 5 | Result card and before-and-after collage (PNG), the permission ask, a post and the review ask; after a written yes, a case study page that says so when the job was founding-price or free |
| `detailing.next_25` | Your next 25 | builder | 15 | 5 | The next 10 to 100 businesses (plus people you add) not already in your Pipeline, each with a message, walk-in line and follow-ups, saved for Do my day, and a dated CSV. Suggested every Monday at 7am |
| `detailing.ready` | Look ready | builder | 15 | 9 | A one-page website to preview and publish (site.build), a Google Business Profile kit (local.gbp_kit) and a flyer with this month's offer (local.flyer), all with the same prices and color |
| `detailing.fleets` | Fleets and dealerships | builder | 15 | 4 | Car dealers, rental offices, trades with vans and movers not in your Pipeline, each with a message and walk-in line, a per-vehicle rate sheet for a monthly wash day, and a CSV |

## Tools

- `detailing.first_25` Your first 25 list: input `people` (pasted, one per line), `city`, `business`, `phone`, `link`, `price`, `exclude`, `batch`. Output `people[]`, `partners[]`, `lead` (this month's offer, priced), `first` (the text to send now), `replies[]`, `plan[]`, `files.csv`.
- `detailing.offer_card` Offer card and door hangers: input `lead` (from first_25 or price_menu), `business`, `phone`, `link`, `color`. Output `files.png` (1080x1350), `files.html` (two door hangers per Letter sheet).
- `detailing.price_menu` Price menu and offer: input `position` (budget, standard, premium), `prices` ("Standard clean 140"), `supplies`, `hourly`, `fixed`. Output `packages[]`, `sizes[]`, `addons[]`, `ladder[]`, `model[]`, `jobs[]`, `lead`, `files.html`. Remembers the position and prices.
- `detailing.quote_job` Quote this job: the niche's quote fields in, `items[]` `{label, detail, qty, unit, price}` out (what `sales.quote` and `sales.invoice` take), plus `subtotal`, `title`, `text`, `next[]`.
- `detailing.keep_customer` Keep this customer: input `customer`, `job`, `review` (the member's Google review link), `business`, `phone`, `color`. Output `messages[]` `{key, label, date, text}`, `rules`, `files.cards` (4 review cards per Letter sheet with a QR code, only when a review link is given).
- `detailing.free_sample` Make a free sample: input `who` (a business from the Pipeline or typed) or `street`, `kind`, `day`, `city`, `business`, `phone`, `link`, `color`. Output `mode` (street or business), `demo`, `messages[]`, `steps[]`, `files.png` (the card), `files.html` (door hangers, or the one-page sample offer). A business gets `msg` and `facts` saved on its lead (D29); its stage never moves.
- `detailing.answer_reply` Answer this reply: input `who`, `reply`, `city`, `business`, `phone`. Output `intent` (stop, objection, price, later, who, covered, yes, question, other), `meaning`, `answer`, `next`, `then[]`, `fill` (when a [bracket] needs the member's own true answer). The niche's objection answers and the offer are the written answer; AI may fit it to their words, with every number and placeholder checked. Saves `reply` and `msg.answer` (Replied), or marks a stop lost with no answer.
- `detailing.book_job` Book this job: input `customer`, `job`, `when`, `price`, `contact`, `address`, `notes`, `deposit`, `city`, `business`, `phone`, `link`, `color`. Output `customer`, `job`, `step` (founding for the first 3 customers, early for the next 7, then full; agreed when a price is typed), `items[]` and `title` for `sales.invoice`, `contactLine`, `notes`, `messages[]`, `sizeNote`, `files.html` (job sheet). Marks the lead won; customers are counted by name, so the invoice's own Pipeline row never counts twice.
- `detailing.result_card` Result card: input `what`, `customer`, `result`, `took`, `area`, `quote`, `deal`, `before` and `after` (Library photos), `review`, `city`, `business`, `phone`, `link`, `color`. Output `files.card` (PNG 1080x1350), `files.collage` (PNG, with both photos), `messages[]` (permission ask, post, review ask), `share[]` (the approval's choices).
- `detailing.case_study` Case study: input `card` (the result card's output), `share` (named or anonymous), the same job facts and photos. Output `files.html` (one page, no scripts), `post`, `disclosure` (founding price or free job, said plainly).
- `detailing.next_batch` Find your next batch: input `city`, `count` (10 to 100), `kind`, `people`, `business`, `phone`, `link`. Output `partners[]`, `people[]`, `saved`, `credit`, `notes[]`, `files.csv` (dated, the OpenStreetMap credit as its last row). Skips every key, name and website already in the Pipeline (kit `leads.known`), so a weekly repeat never brings anyone back.
- `detailing.ready_kit` Gather your facts: input `city`, `areas`, `business`, `phone`, `email`, `link`, `about`, `color`. Output `site` (facts for `site.build`), `gbp` and `flyer` (for `local.gbp_kit` and `local.flyer`), `services`, `offer`, `steps[]`. The founding offer goes on the flyer only, so the site and profile stay true after the first 3 clients.
- `detailing.fleet_list` Fleets and dealers list: input `city`, `count` (5 to 40), `business`, `phone`, `link`, `color`. Output `buyers[]`, `rates[]`, `volume[]`, `saved`, `files.sheet` (rate sheet), `files.csv` (dated, the credit as its last row).

Composed from other packs by name: `sales.quote` and `sales.invoice` (quote, won), `site.build`, `local.gbp_kit` and `local.flyer` (ready).

## Real, sample, keys and cost

- Real: prices come from the sourced ranges (Autodetailer.com, Housecall Pro, StartCosts; checked 2026-10-19); the member's position picks a price inside each range and their own prices win. Season check uses the member's city (OpenStreetMap geocode when online, a state and city latitude table offline).
- Businesses: OpenStreetMap only, through kit `places` on 127's own map servers (free, Legal L55), with "Search by LocationIQ.com" when LocationIQ found the town (L57). These lists save names and phones to files and the Pipeline, so they never use Google Places. Every list of OpenStreetMap businesses carries the credit: on screen, as the last row of each CSV and on each page (D27). Live runs without 127's map servers, sample runs and failed lookups use made-up businesses (`sample/partners.json` or kit samples, .example sites, 555-01xx phones), marked as samples and never saved to the Pipeline.
- Do my day (D29): every business saved gets `msg` (dm, subject, email, walkin, follow1, follow2; emails end with the address line and opt-out), `facts`, `score` and `channel`; people the member knows are saved warm with their own texts. A Pipeline lead from another pack keeps its card: only its messages and notes are filled in.
- AI: only "Answer a reply" may call it, to fit the written answer to their words; the template answer is used when AI is off or the draft adds a number. Everything else is a template filled with the member's facts.
- Photos: `sample/before.jpg` and `sample/after.jpg` are drawn illustrations, labeled "Sample illustration" on the image, for the example run only. Members add their own.
- The founding price is for permission to share before and after photos and honest feedback, never for a Google review (Google removes reviews bought with discounts; the FTC asks for disclosure of any incentive). Review asks go to every customer with nothing in return.
- A case study from a founding-price or free job says so on the page and in the post (FTC 16 CFR 255.5). Customer first names and quotes appear only after a written yes, chosen in the run.

## Tests

`node --test packs/detailing/test/*.test.js`: the contract lint, every workflow on its example (kit `packSuite`), and the household behavior tests (kit `home/suite.js`): a stop marks the lead lost with no answer, the founding ladder (3 founding, then early) with the invoice at that price, the sample saved on its lead, proof with and without photos, and the OpenStreetMap lists with the map search stubbed (no known lead comes back, the credit on screen and in files, Do my day's fields on every row, dated files).
