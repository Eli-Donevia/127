# Still picking (`idea`)

For someone who wants to start but hasn't chosen what. A business pack (`business: true`) and `held: true` (contract v1.10: off until `PACKS_ON` names it). It tests one idea with real people before anything is built. It never says an idea will work and never talks about income: a test result is "people have the problem and some committed", nothing more.

## Workflows

| id | title | tier | min | credits | the member gets |
|---|---|---|---|---|---|
| `idea.first_25` | Your first 25 | no-cost tier | 15 | 2 | crowd card; up to 15 people they know with a note asking for 15 minutes about the problem (not a pitch); when the buyers are a kind of local business, up to 10 from OpenStreetMap with an email (address line, opt-out) and an in-person line; the questions to ask and the ones to avoid; a conversation log CSV the scorecard reads |
| `idea.finder` | Find ideas that fit you | no-cost tier | 3 | 1 | top 5 business packs in this library for their skills, hours, budget, area and car, why each fits and what to watch for, and which pack's Your first 25 to open next |
| `idea.test_plan` | 7-day idea test | builder | 4 | 1 | seven dated days to a decision, against the bar they set first; a calendar file |
| `idea.offer_draft` | One-page offer | builder | 6 | 1 | who, problem, what they do, how it works, included, price per job, first-customer offer; printable page and text; a typed promise of results is pointed out |
| `idea.landing_page` | Test landing page | builder | 6 | 1 | one static HTML page: no form, no script, a mailto button and the address as text |
| `idea.scorecard` | Score your conversations | builder | 4 | 1 | had the problem, already spends, committed, intro, against their bar (scaled to how many they talked to), and the next step |
| `idea.pick_one` | Pick one | builder | 5 | 1 | 2 to 4 ideas on their counts and ratings, weighted toward what people did; a printable decision page |

## The questions

Asked about the last time the problem happened, what they did, what it cost them and who else has it: past behaviour, not opinions. The log has yes/no columns for had the problem, already spends, committed (a pre-order, deposit, booking or sign-up) and intro. Questions to avoid ("would you buy this?", "do you like my idea?", "how much would you pay?") are listed in the view.

## Finder data

`data/packs.json` is built by `node packs/idea/lib/build-packs.js` from every `packs/*/data/niche.json` (title, first workflow, held flag and crowd card read from each pack) joined to `data/fit.json` (our hand-written skills, rough start cost, car, online, hours per pack). The test fails when it's out of date, so rebuild it after adding or changing a business pack. Held packs show as "opening soon" and are never the one to open next. A pack with no fit row gets the neutral row.

## Real or sample

- **Places**: kit `places.findPlaces` for the kind of business the member types (kit categories only, e.g. `leisure=fitness_centre` for gyms). `wants: ['osm']`. Made-up samples named "(sample)" without 127's map servers, never saved. A kind the kit can't map gets a note, not a search.
- **Log**: the member's own CSV (`format: 'asset'`) or pasted lines. No AI sees it. With neither, a labeled made-up sample log.
- No AI calls in this pack.

## Claims (Legal L76)

Every page is the member's words. The offer and landing page point out a typed promise of results or earnings (`lib/util.js` `claims()`, shared with ecom and creator) and add nothing: no numbers, ratings, reviews or testimonials. Tests check that no tool says an idea will work.

## Pick a niche entry

See the report: label "Still picking", kind any, no count.

## Checks run

`node dev/lint.js idea`, `node dev/null-scan.js idea`, the copy check with `--paid`, `node --test packs/idea/test/*.test.js`, and the engine sweep (`PACKS_ON=all`).

## Kit asks

- Move `claims()`/`scrub()` into the kit (same ask as ecom and creator).
- A kit list of business packs with fit facts, so Pick a niche and this finder read one file.
