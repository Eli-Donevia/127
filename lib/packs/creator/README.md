# Creator business (`creator`)

Someone growing an audience around a topic, who may later earn from sponsors, a small product or a paid community. A business pack (`business: true`) and `held: true` (contract v1.10: off until `PACKS_ON` names it). Drafts only: the member posts and sends. Nothing is sent from 127.

## Workflows

| id | title | tier | min | credits | the member gets |
|---|---|---|---|---|---|
| `creator.first_25` | Your first 25 | no-cost tier | 15 | 2 | crowd card; up to 15 people they know with a personal DM and follow-up; a post for each group they already belong to (with the read-the-rules notes); local libraries, community centers, independent bookshops and coworking spaces (OpenStreetMap through the kit) with a talk or workshop ask; their own "I'm starting" post; a dated plan; a CSV; people and real places saved to the Pipeline |
| `creator.pillars` | Find your niche and pillars | builder | 6 | 6 | a niche sentence, 5 pillars with 4 post ideas each, an Instagram bio (150) and TikTok bio (80) counted in code; remembers niche, audience and pillars |
| `creator.plan_month` | Your 30-day posting plan | builder | 4 | 1 | post days at their pace with pillar, idea and format, a weekly email and 4 check-ins; CSV and calendar file |
| `creator.hooks` | Hooks and scripts | builder | 5 | 6 | 20 hooks and 3 scripts (hook, beats, close, on-screen text) for 30 or 60 seconds |
| `creator.media_kit` | Media kit | builder | 8 | 2 | a printable page in their color: only numbers they type, exactly as typed and dated; a blank line for every number left out; brands and a brand quote only as typed or pasted |
| `creator.sponsor_pitches` | Sponsor pitches | builder | 8 | 6 | a pitch per brand they name (a "[Brand name]" template if none), each ending with the address line and "no thanks" opt-out; FTC, YouTube and TikTok disclosure steps |
| `creator.rate_card` | Rate card | builder | 5 | 1 | prices = their hours x their hourly + their costs, rounded up to $5; add-ons at their percentages; printable card and a CSV of the math |
| `creator.lead_magnet` | Lead magnet | builder | 8 | 6 | title ideas, outline, sign-up blurb, delivery email (address and unsubscribe lines), a post; a Markdown file |
| `creator.newsletter` | Weekly newsletter | builder | 6 | 4 | 3 subjects, preview and a weekly email from their notes, only links they typed; suggested every Wednesday (with no topic typed it takes this week's idea from their pillars) |
| `creator.insights` | Read your insights | builder | 4 | 1 | top and lowest posts by a score from their own numbers, best type and weekday, more-of and less-of, 3 ideas; a ranked CSV |

## Real or sample

- **Places**: kit `places.findPlaces` with `amenity=library` and `amenity=community_centre` (kit categories) and custom categories for `shop=books` and `amenity=coworking_space`/`office=coworking` from `data/niche.json`. `wants: ['osm']`. Without 127's map servers the places are made-up samples named "(sample)", never saved.
- **Insights**: the member's Instagram (Meta Business Suite content export) or TikTok (TikTok Studio content export) CSV, `format: 'asset'`. Columns found by name, so either export works. No AI sees it. Without a file: `sample/insights.csv` (a made-up account, labeled).
- **AI**: pillars, hooks, sponsor pitches, lead magnet and newsletter write with `task: 'write'` and fall back to templates from the member's facts (`sample: true`).

## Claims (Legal L76, D3 and D4)

`lib/util.js` `claims()` (same file as ecom and idea) checks every AI draft: earnings, promised results, results in a set time ("10k followers in 30 days") and body before-and-after are blocked; numbers, follower or view counts, rankings, superlatives, stars and "as seen in" lines are dropped unless the member typed them. The media kit is code only: a number shows only when typed, a blank line otherwise (tests check both). No tool writes a testimonial, review, rating or persona; a brand quote shows only when pasted, word for word. Sponsor pitches go only to brands the member names. The rate card says no one can say what a brand will pay.

## Sources (`data/rules.json`, checked 2026-10-20)

- FTC Disclosures 101 for social media influencers (disclose in the post, free products count), YouTube paid promotion setting, TikTok commercial content disclosure.
- Instagram 150 and TikTok 80 bio limits: third-party guides only (Instagram's and TikTok's help pages didn't open for us); the view says to check the counter in the app.

## Pick a niche entry

See the report: label "Creator business", kind online, count partners (libraries, community centers).

## Checks run

`node dev/lint.js creator`, `node dev/null-scan.js creator` (0 hits), the copy check with `--paid` (0 blocking, 0 held), `node --test packs/creator/test/*.test.js`, and the engine sweep (10 of 10 done, `PACKS_ON=all`).

## Kit asks

- Move `claims()`/`scrub()` into the kit (same ask as ecom).
- A kit `insights` reader for Instagram and TikTok exports, so other packs can read the same files.
