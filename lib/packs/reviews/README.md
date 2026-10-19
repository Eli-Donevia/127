# More Google reviews for local shops (`reviews`)

Flagship. The member helps owner-run salons, barbershops, auto shops, dental and chiro offices, cafes, restaurants, boutiques and groomers get more Google reviews the honest way: a counter card and handout cards with a QR code, a line on every receipt, the words for the team, a reply to every review and a one-page monthly report. Every customer is asked the same way. Nothing is offered for a review, no one is gated, no staff quotas, no bought or written reviews, and no one promises a number.

## Workflows

| Id | Title | Tier | Minutes | Credits | Makes |
|---|---|---|---|---|---|
| `reviews.first_25` | Your first 25 | free | 15 | 37 | crowd card; 25 shops ranked by thin or stale reviews (few reviews or a low rating on the map listing, none shown on their website); email, DM, call opener, voicemail, walk-in line and 2 follow-ups for each (the view shows #2 to #5); the review card kit for #1 (print-ready HTML plus a 1080x1350 PNG of the counter card) with its email, DM and walk-in line; CSV of all 25 with messages and send dates; all 25 saved to the Pipeline, #1 with the card email as its first message |
| `reviews.offer` | Your offer | builder | 5 | 2 | price menu at the member's position (setup, monthly care, a card kit they print), first-clients ladder, promises the member controls, time per client, how to say the price, printable offer sheet; remembers the offer so every answer, call card and care plan quotes it |
| `reviews.sample_one` | Make a free sample | builder | 10 | 6 | the review card kit (HTML and PNG) for any shop in the Pipeline or a typed name and website, saved on the lead in the slot Do my day sends next: the first email, a DM and a walk-in line when not contacted yet, the next follow-up when contacted (none after 3 messages), the answer when they replied; a typed shop is added with facts, score and channel |
| `reviews.reply` | Answer a reply | builder | 3 | 3 | what they meant (kit `outreach.answer` plus auto-replies, the wrong person, "send info", "let me think", a service that already handles their reviews, and the shop's seven worries), a short honest answer with one next step and real visit days, the price said once from "Your offer" (founding terms while under 3 clients), honest answers to "can you guarantee reviews" and "can you remove a review"; AI wording only for worries and open questions, and only when it keeps the review rules; saved on the lead (this pack's lead moves to Replied, another pack's is updated by id), a stop marks it lost; a calendar reminder for check-backs |
| `reviews.call_prep` | Prep for a call | builder | 8 | 10 | `sales.read_prospect`, the reviews call card (write down their Google numbers by hand, bring the printed card, read their newest reviews; their facts; six questions; the price said once; the seven worries with honest answers, the ones they mentioned first; the close; the rules if it comes up; what to do after yes, think or no), `sales.call_script` with the member's three options, the visit or call on the calendar; the shop moves to Call booked |
| `reviews.proposal` | Proposal | builder | 8 | 11 | three options from the offer, `sales.read_prospect`, `sales.proposal`, `sales.quote` for setup plus the first month; the shop moves to Call booked here, and both sales steps run with `pipeline: false` so HQ shows one row |
| `reviews.setup` | Set up a new client | builder | 5 | 5 | the real kit with the shop's own review link, the handover email and the go-live message |
| `reviews.keep` | Keep your customers | builder | 5 | 2 | a care plan page for the client (every week, every month, the report day, promises, what the member needs, the one rule, the next 90 days, one add-on), 90 days on the member's calendar (weekly reply checks, reports, founding check-in and price change), the message for each moment, one upsell after the first report (a review text after every visit, only to customers who agreed to texts, or a reviews section on their website for a shop that already texts); logs the client won |
| `reviews.report` | Monthly client report | builder | 5 | 2 | one-page report from counts the member reads off the client's Business Profile, the email, a testimonial and referral ask |
| `reviews.next_25` | Your next 25 | builder | 5 | 30 | 10 to 100 more shops (wider searches as the list grows), skipping everyone in the Pipeline (kit `leads.known`) and the skip list, each saved with `msg`, `facts`, `score` and `channel` (kit `leads.pipelineLead` with the draft; email follow-ups end like the first email); a dated CSV; suggested every Monday at 7am |

## Tools

- `reviews.crowd_card` (code, 1): the starving-crowd card from `data/niche.json` `crowd`.
- `reviews.find_25` (api, wants `places` and `osm`, 30): kit places (Google Places with a key, else OpenStreetMap, else sample), kit leads scan and ranking with the review weights in `data/niche.json` `service`, kit outreach drafts. Input: `city`, `shop`, `myName`, `myBusiness`, `myAddress`, `exclude`, `batch`, `count` (10 to 100), `skipKnown`, `save`. Output: `leads [{rank, name, score, missing, listing, website, phone, email, mapsUrl, placeId, channel, sendOn, source}]`, `messages` (top 5), `replies`, `rules`, `plan`, `top` (with its Pipeline row when saved), `hasTop`, `csv`, `saved`, `source`, `attribution`, `sample`. Leads keep `placeSource` and `searchBy` so pages made later still credit OpenStreetMap and LocationIQ.
- `reviews.card_kit` (code, 5, wants `render`): input `lead` (from `find_25.top` or `reviews.pick`) or `business`, `website`, `reviewLink`, `placeId`, `shop`, `city`, member fields, `sendCopy`. Output: `link {url, kind: own|place|search}`, `page` (HTML: counter card, 8 handout cards, the ask, reply templates, a fill-in starting point, rules with sources, how to get their own link, the map credit for OpenStreetMap shops), `picture` (PNG, SVG when ffmpeg can't render), `sendEmail`, `walkIn`, `ask`, `replies`, `owner`, `email`, `snapshot` (in-run only).
- `reviews.build_offer` (code, 2): kit `quote.menu` over `data/prices.json` through `lib/prices.js`; adds `options` for `sales.proposal` and `items` for `sales.quote`, and remembers the offer; given `client` (the proposal), it moves that shop to Call booked (`talk.moveLead`).
- `reviews.monthly_report` (code, 2).
- `reviews.pick` (code, 0): one shop from the Pipeline by name, website or key (any pack's lead), or the typed name and website; keeps its kind of shop, place ID and map link for the card's code.
- `reviews.track_sample` (code, 1): puts the card on the lead by stage, or adds the shop.
- `reviews.answer_reply` (ai, 3): the reply answer above. Templates, worries and the rules check (`breaksRules`) in `lib/close.js`, saving in kit `talk.js`.
- `reviews.call_card` (code, 2): the call card; hands `sales.call_script` its `notes`, `optionsText` and `price`.
- `reviews.care_plan` (code, 2): the care plan (`lib/care.js`), calendar, messages and upsell.
- `lib/prices.js`: setup, care and the card kit at the member's position, or what they saved in "Your offer". Pipeline reads and reply saving are kit `_kit/talk.js`, shared with the other flagship packs.

## Data and sources

- `data/niche.json`: crowd (research/crowd.json), shop types with the line staff say, the leads service weights and message lines, labeled buyer facts (BrightLocal 2026), the rules with their Google, FTC and CTIA pages, own-link steps, QR print rules, print prices, promises, seven objections with honest answers, founding-client terms.
- `data/prices.json`: setup and monthly bands below managed review services and near review software (sources in the file).
- Full research with every quote: `research/niches/reviews.json`.

## Real, sample and rules

- The QR code opens the shop's map listing by place ID before they sign, and their own review link from the Business Profile after (`reviews.setup`). A search link is the last resort and the kit says to check it.
- Google listing facts (name, phone, rating, review count) stay in the run: the table shows them with "Google Maps", the card kit view shows the rating snapshot, and the files carry a fill-in starting-point box instead. Messages never cite a rating or count.
- Sample: without a city, a Places key or a reachable OpenStreetMap, the list is made-up shops on `.example` sites, marked sample.
- The review rules are checked in code: every answer, message and upsell passes `lib/close.js` `breaksRules` (no incentive for a review, no asking only happy customers, no buying or writing reviews, no promised counts, no removing reviews), and AI wording that fails it is dropped for the template. Founding clients give feedback and a testimonial the member may quote as a founding client, never a review.
- OpenStreetMap credit (D27): the find view (`places.creditBlocks`), the last CSV row (`places.creditLine`) and the card kit page footer (`places.creditHtml`) whenever a shop came from OpenStreetMap.
- Credits per full run, in the order members see them: first 25 37, offer 2, sample 6, reply 3, call prep 10, proposal 11, setup 5, keep 2, report 2, next 25 30.
