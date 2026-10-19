# Local presence (`local`)

Get found on Google, get the first honest reviews, and reach the neighborhood with QR flyers, door hangers and posts. Every printable is static HTML with the QR code inline as SVG (no scripts), sized in inches with `@page`, plus PNG previews at 2x when the run can render (ffmpeg with librsvg). QR codes come from the kit encoder `packs/_kit/qr.js`.

## Workflows

| id | title | tier | steps | credits per run |
|---|---|---|---|---|
| `local.first_10_reviews` | Get your first 10 reviews | free | review_link, review_kit | 5 |
| `local.get_found` | Get found on Google | builder | gbp_kit, citations | 4 |
| `local.flyer_drop` | Print a flyer drop | builder | flyer_copy, approve (edit text), flyer | 4 |
| `local.neighborhood_launch` | Launch in your neighborhood | builder | first_25, neighborhood_posts | 4 |

No step runs per item, so every run is a fixed 4 or 5 credits. AI runs once per tool (never per person). Without an AI key every AI tool uses its template fallback, built from the member's facts and varied with `text.pickBy`.

## Shared business inputs (every tool)

All optional. Empty fields come from the brain, then from what the member typed in an earlier local run (pack memory `settings`, at most 3.8 KB), then from the sales pack's settings.

`business`, `what`, `city`, `region`, `phone`, `email`, `website`, `booking`, `color` (hex; else the brand color, else a palette for the kind of business), `services` (one per line, like `Full detail, 180` or `Weekly mow, from 45`), `firstName`, `group` (auto, cleaning, yard, washing, home, pets, beauty, fitness, food, lessons, events, pro, retail, general; else matched from what they typed).

Saved files are kit assets (whatever `ctx.save` returns).

## Tools

### `local.review_link` (api, read, 1 credit, wants `places`)
Input: business inputs plus `link` (a Google review link such as `https://g.page/r/.../review`, or a Place ID).
Output: `{ url, kind: 'pasted' | 'place_id' | 'places_lookup' | 'maps_search', placeId, how, note, sample }`.
Order: pasted link (Google hosts only) or Place ID, then the Place ID saved last time, then a Places Text Search for IDs only (`X-Goog-FieldMask: places.id`) when a `places` key exists and the run is live, then a Maps search link that opens the listing. Only the place ID is stored.

### `local.review_kit` (ai, write, draft, 4 credits, wants `render`)
For the reviews and household packs: pass the business inputs plus `link` (any form above) and `customers` (one per line, `Name, phone or email`, up to 50).
Output:
```
{ business, link, linkKind, placeId, linkNote,
  asks: { text, subject, email, reminder, inPerson },   // "{first name}" where the name goes
  customers: [{ name, phone, email, text, reminder }],  // filled in code
  rules: [string], plan: [string],
  qr: { version, modules, cardModuleMm, minCardInches },
  files: { cards, sign, previews: [cardsPng, signPng], customers (CSV or null), calendar (ICS, zipped by save) },
  sample, ai }
```
Cards: 10 per Letter sheet (3.5 x 2 in, crop marks). Sign: Letter. AI answers are rejected if they offer anything, ask for positive or 5-star reviews, or drop the link.

### `local.gbp_kit` (ai, write, draft, 3 credits)
Input: business inputs plus `areas` (towns or ZIP codes, comma or line separated, max 20).
Output:
```
{ business, description (<= 750 chars), descriptionChars,
  categories: { primary, additional: [up to 3], note },
  services: [string], areas: [string],
  faqs: [{ q, a, fill, hint }] (10; fill = the member writes the answer, hint says what to write),
  posts: [{ type, title, text, button }] (4),
  photos: [string], steps: [string], eligibility: [string],
  files: { kit (HTML page in their colors) }, sample, ai }
```
Google retired Q and A on profiles, so the 10 questions are FAQs for the website and posts.

### `local.citations` (code, draft, 1 credit)
Input: business inputs plus `area`. Output: `{ nap: { name, phone, website, address, category }, descriptions: { short, long }, sites: [{ order, id, name, url, cost, why, tip, minutes, status }], files: { tracker (CSV) }, sample }`. Sites: Google, Apple Business, Bing Places, Facebook, Nextdoor, Yelp, BBB, Thumbtack (data/listings.json, checked 2026-10-19).

### `local.flyer_copy` (ai, write, draft, 2 credits)
Input: business inputs plus `offer` (a real offer, like `First visit $20 off`) and `area`. Output: `{ draft: [option], options: [{ label, headline, text }] (3), sample, ai }`. `text` is editable plain text: `Headline:`, `Line:`, `- bullet` lines, `Offer:`, `Button:`.

### `local.flyer` (code, draft, 2 credits, wants `render`)
Input: business inputs plus `copy` (the approve output, one option, or `{ headline, sub, bullets, offerText, cta }`), `offer`, `area`, `formats` (`all`, `flyer`, `door_hanger`, `postcard`), `campaign` (adds UTM tags to the member's own link).
Output: `{ copy, action: { kind: booking | website | text, url, label, short }, files: { flyer, doorHangers, postcard, previews }, qr, print: [string], eddm: { size, price, volume, address, checked, url }, sample }`.
Flyer: Letter. Door hangers: two 4.25 x 11 in per Letter sheet with cut lines. Postcard: 9 x 6.25 in front and back with the EDDM Retail indicia and "Postal Customer".

### `local.neighborhood_posts` (ai, write, draft, 2 credits)
Input: business inputs plus `area`. Output: `{ posts: [{ id: nextdoor | facebook | board | reply, label, where, text, rules }], boards: [{ label, tip }], sample, ai }`. The member posts them; nothing is posted for them.

### `local.first_25` (code, draft, 2 credits)
Input: business inputs plus `people` (one per line, up to 15), `area`, `price` (per job or per visit). Uses kit `first25.household` with partner types from data/niches.json; nearby businesses come from the kit places finder, or samples when it can't answer. The personal texts are this pack's own: they never trade a price for a review. Output: `{ people, partners, total, plan, notes, attribution, files: { list (CSV) }, sample }`.

## Data (data/*.json, checked 2026-10-19, sources inside)

gbp.json (description 750, 1 + 9 categories, 20 service areas, posts, photos, verification, Q and A retired), reviews.json (Google review rules, FTC 16 CFR 465, Yelp asks), listings.json, print.json (EDDM Retail $0.26 per piece at time of check, 200 to 5,000 per ZIP per day, indicia, 18 U.S.C. 1725 mailbox rule, sizes), niches.json (14 kinds of business: categories, headlines, FAQs, photos, partners), osm.json (Nominatim policy and attribution).

## Real or sample

- Real without keys: QR codes, every printable, review links from a pasted link or Place ID, the Maps listing link, all data tables.
- `places` key (optional): finds the Place ID for the review link (IDs only, free tier).
- Partner businesses: the kit places finder. In this container a `--live` run of `local.neighborhood_launch` (Portland, OR) got no answer from the map service and fell back to sample businesses, labeled as samples.
- AI: template fallbacks here (no key).

## Tests

`node --test packs/local/test/local.test.js`: the pack suite (every workflow on sample data), the QR encoder against the published thonky.com 1-Q symbol and 89 ReportLab reference symbols module for module (versions 1 to 40, all ECC levels and masks), an independent decoder (`test/qr-decode.js`) on all ECC levels, mask penalty, a PNG decoded from pixels, the review cards decoded from the rendered sheet, review link parsing, the flyer copy round trip, and no review incentives in any ask.
