# Business finder (`leads`)

The cold outreach engine. **Your first 25** searches the map for real local businesses, reads each one's own website for what it's missing, ranks them for what the member sells, writes the message to send each one, and makes a website check to show #1. Every business pack builds its own first 25 on these tools.

## Workflows

| id | Title | Tier | Credits per run | Member time | Files |
|---|---|---|---|---|---|
| `leads.first_25` | Your first 25 | free | 48 | 15 min | website check for #1 (HTML), quick-fixes image (PNG + SVG), workbook (HTML: 7-day plan, every message), CSV, calendar (.ics) |
| `leads.research_one` | Research one business before you reach out | builder | 10 | 5 min | website check (HTML), quick-fixes image (PNG + SVG) |
| `leads.daily_25` | 25 a day | builder | 46 | 10 min | workbook, CSV, calendar; skips everyone already in the Pipeline |
| `leads.list` | Build a business list | builder | up to 60 | 5 min | workbook, CSV, calendar |
| `leads.call_sheet` | Call sheet for today | builder | 5 | 5 min | call sheet (HTML: opener, voicemail and tick boxes per business, answers to what they say), CSV with outcome columns |
| `leads.walk_route` | Walk-in route | builder | 5 | 5 min | route (HTML: stops in order, OpenStreetMap link, hours, best time, the counter line, tick boxes; Google Maps legs of 4 stops), CSV |
| `leads.pick_niche` | Pick a niche | builder | 3 | 5 min | comparison page (HTML): 3 to 5 business types, scores, first $1, season, OpenStreetMap counts within 10 km |

Credits = each step's credits times its items (Places search 8, each website 1, ranking 1, messages 6 with AI only for the top 5, website check 2, save 1). Every run is under 300.

## Tools (inputs and outputs other packs can rely on)

Call them from a workflow step and list `leads` in your pack's `uses`. `service` is free text ("websites", "short videos", "AI booking", "bookkeeping", anything): it maps to one of 17 services in `data/services.json` (ids: web, social, video, photo, email, ai, frontdesk, reviews, google, seo, ads, copy, brand, booking, bookkeeping, cleaning, other); unknown words become `other` with the member's own words. `category` is free text ("dentists", "dog groomers"): 36 known kinds in kit `places.CATEGORIES`, anything else searches by the words.

**`leads.find_businesses`** (api, 8 credits, wants `places`)
- in: `{ category: string (required), city?: string (default: member's city), limit?: 1-60 = 30, radius_km?: 1-40 = 15, skip_known?: boolean = true }`
- out: `{ places: [place], category: { id, label, one, many, what, thing, film }, city, source: 'google'|'osm'|'sample', sample, attribution, note, dropped: { closed, chains, dupes, known } }`
- place: `{ key ('gplaces:<id>' | 'osm:node/1' | 'sample:<slug>'), source, name, address, website, phone, rating, reviews, lat, lng, placeId, mapsUrl, km, sample, attribution }`. Google's name, address, phone and rating are for the run view only (Places terms): never save them; save `key`/`placeId` and website facts.

**`leads.scan_business`** (code, 1 credit; use in `each`; `viewMany` draws one table)
- in: `{ business?: place or { website, name }, website?: string, category?: object|string, city?: string }` (one of business or website)
- out: a lead: `{ key, name, siteName, website, placeId, mapsUrl, source, sample, category, city, siteStatus: 'ok'|'none'|'down'|'parked'|'blocked'|'unchecked', siteNote, gaps: [{ id, chip, why, say, source }], fits: [{ id, why }], site: { platform, colors, logo, socials, booking, contacts { emails, phones }, prices, offer, hours, people, ... } | null, checked }`

**`leads.score_fit`** (code, 1)
- in: `{ leads: [lead] (required), service: string (required), top?: 1-60 = 25 }`
- out: `{ service: { id, label, sell }, leads: [lead + { rank, score 1-99, gaps with points, reasons }], stats: { found, ranked, checked, noSite, unchecked, gaps: { id: count } }, headline: ['15 of 22 show no video on their homepage', ...], sample, attribution }`

**`leads.write_outreach`** (ai `write`, 6; AI rewrites the first lines of the top 5 only)
- in: `{ leads: [ranked lead] (required), service (required), top?: 25, your_name?, address? }`
- out: `{ messages: [{ key, rank, name, hi, opener, cites, facts, freeThing, dm, email: { to, subject, body }, call, voicemail, walkIn, followUp1, followUp2, channels: [{ label, to, href, use }], ai }], review: [{ key, name, channel, text }] (top 5, for an approve step with edit: 'text'), replies: [7 replies], rules: [send rules], ai }`

**`leads.make_audit`** (code, 2, wants `render`)
- in: `{ lead (required), service (required), your_name? }`
- out: `{ key, name, page (HTML asset: one-page website check in their colors), image (PNG asset or null), svg (asset), fixes: [{ check, saw, fix }], spec: { title, steps } (the free sample to make), offer, sample }`

**`leads.export`** (code, 1)
- in: `{ leads (required), service (required), messages?, edits? (approve items), pipeline?: true }`
- out: `{ csv, workbook, calendar (assets), saved (Pipeline rows), days: [{ day, date, label, todo }], plan, sample }`. Pipeline rows: kit `leads.pipelineLead` (place ID, website facts, stage `found`).

**`leads.call_sheet`** (code, 5, wants `osm`)
- in: `{ service (required), category?, city?, calls?: 5-30 = 15, your_name?, your_phone? }`
- Pipeline first (every pack's businesses, never people the member knows or Google listings): follow-ups that are due (3 days after the first message, 4 after the second, none after the third), then found businesses with a phone by score. Short and given `category` + `city`: OpenStreetMap businesses with a number (on the map or their own site), each read on its own website, ranked, and saved to the Pipeline with `channel: 'call'` and D29 fields.
- out: `{ calls, callbacks, fromPipeline, fresh, saved, sheet, csv, date, entries: [{ name, phone, kind: callback|first|new, fact, say, voicemail, source }], notes, sample }`. CSV ends with the OpenStreetMap credit row when any business came from OSM.

**`leads.walk_route`** (code, 5, wants `osm`)
- in: `{ service (required), category?, city?, start?, stops?: 4-20 = 10, travel?: driving|walking = driving, your_name? }`
- Pipeline businesses with a saved map position near the start, then OpenStreetMap businesses near it. Order: nearest next from the start, then 2-opt; no start found: a sweep from the farthest stop. Legs of up to 4 stops as Google Maps directions from coordinates (3 waypoints open on a mobile browser, `data/rules.json` maps_urls), leg 1 from the start or from where the member is. Each stop links to its OpenStreetMap page (or an OpenStreetMap search for its address); sample stops get no links.
- out: `{ stops, km (straight lines), travel, start, legs: [{ from, to, url, label }], entries: [{ order, name, address, hours, map, walkIn, mention, kind }], route, csv, saved, fromPipeline, fresh, notes, sample }`.

**`leads.pick_niche`** (code, 3, wants `osm`)
- in: `{ city (required), niches?: free text, up to 5 ("web design, lawn care or pet sitting"), fast?: boolean }`. Empty: the 5 best for this month.
- Points: the 4 crowd scores (of 20), first $1 (fast +2, medium 0, slow -2; doubled with `fast`), season (-3 slow where the member is, -2 when it starts next month, -1 when the climate is unknown), and one Overpass request with a count per niche within 10 km (buyers up to +2 or down to -2, partners and sources by 1). Offline, held or sample: "Not counted" and the scores alone (D5).
- out: `{ city, month, best: { id, label, points, why }, picks: [{ id, label, kind, buyer, scores, total, first_dollar, season, slow, ending, count, countWhat, countRole, points, parts, note, not_yet, next, rank }], counted, radiusKm, notes, credit, page, sample }`.

Saved Pipeline rows (export, call sheet, walk-in route) also carry, for OpenStreetMap and sample businesses only, `data.address`, `data.lat`, `data.lng`, `data.osmId`, `data.hours`, `data.call` and `data.voicemail`, so later sheets and routes start from the Pipeline.

Typical B2B first 25 in a business pack: `leads.find_businesses` then `leads.scan_business` (each, concurrency 6) then `leads.score_fit` then `leads.write_outreach` then your own spec asset (or `leads.make_audit`) then `leads.export`. Copy `index.js` `leads.first_25`.

## Real vs sample

- **Businesses:** Google Places Text Search when the server has the `places` key (not in this container); else OpenStreetMap (Nominatim + Overpass); else sample businesses (`.example` sites, 555-01xx phones) marked `sample: true` with the reason in `note`. **Google Places and Overpass are untested live here:** places.googleapis.com is blocked by this container's proxy (403) and every public Overpass server reset or timed out. Nominatim answered.
- **Websites:** always real when the business has a real site (kit scan: up to 3 public pages, robots.txt respected, cached 7 days). Sample sites are generated HTML read by the same parser.
- **AI:** first lines for the top 5 when AI is on; templates otherwise (every draft is complete without AI).
- **Call sheet, walk-in route, pick a niche:** no AI. Their OpenStreetMap paths (Nominatim, Overpass search and `out count`) are tested offline against a faked server (`test/visits.test.js`), including LocationIQ's link and that no server URL or key reaches an output; Overpass itself couldn't be reached from this container (connection reset, Oct 19), so the counts are untested live. Offline runs say "not counted" and rank on the scores alone.
- **Live runs (Oct 19):** `leads.research_one` on franklinbbq.com and tartinebakery.com (read only): both scanned, ranked, drafted and checked; this found and fixed two real-data bugs (greeting a web agency's name from a credits line; a typed site with no clean title). Greetings now use a name only when the site names exactly one owner or founder.

## Keys and costs

- `places` (Google Places, 127's key): about $0.035 per request at Enterprise fields, 1 to 3 requests per search, 1,000 free a month (checked 2026-10-19, see `data/rules.json`). Without it, OpenStreetMap is free.
- `render` (ffmpeg): turns the quick-fixes SVG into a PNG; without it only the SVG is saved.

## Rules built in (sources in `data/rules.json`)

Emails carry the member's mailing address (or a placeholder) and an opt-out line (CAN-SPAM, no B2B exception). No cold texts (FCC). DMs are sent by hand (Instagram terms). Google listing data stays in the run; CSVs and the Pipeline keep the place ID plus facts from the business's own website. Ratings and review counts rank a list but never appear in messages. Yelp and Foursquare are not sources.

## Data

`data/niches.json`: pick a niche's 17 business types: 127's crowd scores copied from `research/crowd.json` (a test fails if the copy drifts), plus a plain label (the pack's title), the words members use, the kind (b2b, home, online) and what to count on OpenStreetMap (buyers, partners who could refer people, schools, or places to source from). `data/services.json`: 17 services (label, offer, walk-in and follow-up lines, subject, buyers, partners, gap weights, fit points, aliases), the spec steps, hooks, the 7-day plan and the 3-question picker. The 7 original services, specs, hooks, plan and picker come from the Funnels v2 First 25 engine (copied Oct 19, see its `source` note). `data/fixes.json`: what each website check means and its fix. `data/rules.json`: verified rules with sources.
