# Front desk for contractors (`frontdesk`)

Flagship. The member sets up and looks after a front desk for owner-run plumbing, HVAC, roofing and electrical businesses, sold as "never miss a call", not as AI: a text back after every missed call, an after-hours reply, a booking link and answers to the questions callers ask, on the client's own accounts and number.

## Workflows

| Id | Title | Tier | Minutes | Credits | Makes |
|---|---|---|---|---|---|
| `frontdesk.first_25` | Your first 25 | free | 15 | 38 | crowd card; 25 contractors ranked by what callers can't find on their sites (booking, chat, form, tap-to-call, hours); email, DM, call opener, voicemail, walk-in line and 2 follow-ups for each (AI first lines for the top 5 only, templates otherwise; the view shows #2 to #5); the missed-call plan for #1 (printable HTML plus a 1080x1350 PNG) with its email and DM; CSV of all 25 with messages and send dates; all 25 saved to the Pipeline so Do my day can hand them out, #1 with the plan email as its first message (`frontdesk.track_sample`) |
| `frontdesk.offer` | Your offer | builder | 5 | 2 | price menu at the member's position (setup, monthly care, care with after-hours answering, a do-it-yourself kit), first-clients ladder, promises the member controls, time per client, how to say the price, printable offer sheet |
| `frontdesk.sample_one` | Make a free sample | builder | 10 | 7 | the missed-call plan (HTML and PNG) for any contractor in the Pipeline or a typed name and website, saved on the lead in the slot Do my day sends next: the first email and a DM when not contacted yet, the next follow-up when contacted (none after 3 messages), the answer when they replied; a typed business is added with facts, score and channel |
| `frontdesk.reply` | Answer a reply | builder | 3 | 3 | what they meant (kit `outreach.answer` plus auto-replies, the wrong person, "send info", "let me think", someone who answers the phones, and the six front desk worries), a short answer with one next step and real call days, the price said once from "Your offer" (founding terms while under 3 clients), AI wording for worries and open questions only when it passes the copy rules; saved on the lead (this pack's lead moves to Replied, another pack's is updated by id), a stop marks it lost; a calendar reminder for check-backs |
| `frontdesk.call_prep` | Prep for a call | builder | 8 | 10 | `sales.read_prospect`, the front desk call card (check first: ring their number; their facts; six questions; the price said once; the six worries, the ones they mentioned first; the close; what to do after yes, think or no), `sales.call_script` with the member's three options, the call on the calendar; the lead moves to Call booked |
| `frontdesk.proposal` | Proposal | builder | 8 | 11 | three options from the offer, `sales.read_prospect` facts, `sales.proposal` (HTML and cover email), `sales.quote` for setup plus the first month; the business moves to Call booked here, and both sales steps run with `pipeline: false` so HQ shows one row |
| `frontdesk.setup` | Set up a new client | builder | 10 | 4 | setup sheet (tools picked from what the client already uses, prices from each vendor's page, carrier forwarding codes, texting registration, recording notice by state, texts and answers to paste, test plan), Notion-ready checklist (.md), the yes message and the go-live message |
| `frontdesk.keep` | Keep your customers | builder | 5 | 2 | a care plan page for the client (every week, every month, the report day, promises, what the member needs, the next 90 days, one add-on), 90 days on the member's calendar (weekly checks, reports, founding check-in and price change), the message for each moment, one upsell (after-hours answering on care, the review request text on care with answering, nothing offered for reviews); logs the client won |
| `frontdesk.report` | Monthly client report | builder | 5 | 2 | one-page report from numbers the member types in, the email to send it with, a review and referral ask |
| `frontdesk.next_25` | Your next 25 | builder | 5 | 30 | 10 to 100 more contractors (wider searches as the list grows), skipping everyone in the Pipeline (kit `leads.known`) and the skip list, each saved with `msg`, `facts`, `score` and `channel` (kit `leads.pipelineLead` with the draft; email follow-ups end like the first email); suggested every Monday at 7am |

## Tools

- `frontdesk.crowd_card` (code, 1): the starving-crowd card from `data/niche.json` `crowd`.
- `frontdesk.find_25` (api, wants `places` and `osm`, 30): kit places (Google Places with a key, else OpenStreetMap, else sample), kit leads scan and ranking with the front desk weights in `data/niche.json` `service`, kit outreach drafts. Input: `city`, `trade` (plumbers, hvac, electricians, roofers, contractors), `myName`, `myBusiness`, `myAddress`, `exclude`, `batch`. Output: `leads [{rank, name, score, missing, website, phone, email, mapsUrl, placeId, sendOn}]`, `messages` (top 5), `replies`, `rules`, `plan`, `top` (for the plan step), `hasTop`, `csv` (asset), `source`, `attribution`, `sample`.
- `frontdesk.audit` (code, 6, wants `render`): reads one contractor's own pages (home, services, contact, about) for phone, hours, services, service area, emergency lines, booking, chat, forms, prices, offers and FAQ, then writes the plan. Input: `lead` (from `find_25.top`) or `website`, `business`, `trade`, `city`, `myName`, `myBusiness`, `myContact`. Output: `rows`, `texts` (5), `faq`, `flow`, `convo`, `stats`, `page` (HTML asset), `picture` (PNG, or SVG when ffmpeg can't render), `sendEmail`, `sendText`.
- `frontdesk.build_offer` (code, 2): kit `quote.menu` over `data/prices.json`. Output adds `options` (for `sales.proposal`) and `items` (for `sales.quote`); given `client` (the proposal), it moves that business to Call booked (`talk.moveLead`).
- `frontdesk.setup_sheet` (code, 4) and `frontdesk.monthly_report` (code, 2).
- `frontdesk.pick` (code, 0): one business from the Pipeline by name, website or key (any pack's lead), or the typed name and website. Google Maps leads reach tools without a name, so a typed website matches them.
- `frontdesk.track_sample` (code, 1): puts the plan on the lead by stage, or adds the business.
- `frontdesk.answer_reply` (ai, 3): the reply answer above. Templates in `lib/close.js`, saving in kit `talk.js`.
- `frontdesk.call_card` (code, 2): the call card; hands `sales.call_script` its `notes`, `optionsText` and `price`.
- `frontdesk.care_plan` (code, 2): the care plan, calendar, messages and upsell.
- `lib/prices.js`: one place for setup, care, care with answering and the kit at the member's position, or what they saved in "Your offer" (`frontdesk.build_offer` remembers it). Pipeline reads and reply saving are kit `_kit/talk.js`, shared with the other flagship packs.
- `frontdesk.find_25` also takes `count` (10 to 100), `skipKnown` and `save`; leads keep `placeSource` and `searchBy` so pages made later still credit OpenStreetMap and LocationIQ.

## Data and sources

- `data/niche.json`: crowd (from research/crowd.json), trades and their service words, the leads service weights and message lines, labeled missed-call facts, texting rules, recording consent states, carrier forwarding codes, the job checklist, objections, founding-client terms, promises, where buyers look, licenses.
- `data/prices.json`: setup and monthly bands inside what providers and freelancers charge (sources listed in the file).
- `data/tools.json`: client tool prices from each vendor's own page, checked 2026-10-19 (Quo, Jobber AI Receptionist, Housecall Pro, Rosie, Goodcall, Smith.ai, Ruby, Calendly, Google Calendar, Twilio 10DLC).
- Full research with every quote: `research/niches/frontdesk.json`.

## Real, sample and rules

- Real: every fact in a plan, message and CSV comes from the business's own website, quoted and dated. Google listing facts (name, phone, rating, review count) stay in the run: the CSV carries the place ID and the map link, and the view shows "Google Maps". Messages never cite a rating or a review count.
- Sample: without a city, a Places key or a reachable OpenStreetMap, the businesses are made up, on `.example` sites, and marked sample.
- No message says AI. Texts say who they're from and how to stop, and stay about the call (CTIA, 47 CFR 64.1200). Promises stay on what the member controls: live in 7 days or the setup fee back, a same-day fix, cancel any month.
- OpenStreetMap credit (D27): the find view (`places.creditBlocks`), the last CSV row (`places.creditLine`) and the plan page footer (`places.creditHtml`) whenever a business came from OpenStreetMap.
- Credits per full run, in the order members see them: first 25 38, offer 2, sample 7, reply 3, call prep 10, proposal 11, setup 4, keep 2, report 2, next 25 30.
