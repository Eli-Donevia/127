# Offer lab (`offer`)

Score an offer, build one buyers find easy to say yes to, price it from real costs, name it, write a
promise the member can keep, plan what each customer buys, and make a freebie that is a real file.
Members never see framework or author names; titles use plain words.

## Workflows

| id | title | tier | steps | credits per run |
|---|---|---|---|---|
| offer.value_score | Score your offer | free | score_offer | 4 |
| offer.grand_slam | Offer builder | builder | list_problems, stack_solutions, approve (choose up to 7 parts), name_ideas, approve (choose 1 name), build_offer, approve (edit each length), save_offer | 18 |
| offer.money_model | Plan what each customer buys | builder | plan_money | 6 |
| offer.lead_magnet | Make a freebie to give away | builder | pick_magnet, approve (choose 1), build_magnet | 7 |
| offer.price_it | Price your offer | builder | price_tiers | 1 |
| offer.name_it | Name your offer | builder | name_ideas, approve (star up to 3) | 6 |
| offer.promise | Write a promise you can keep | builder | write_promise | 4 |

Every run is far under the 300 credit cap. Each AI tool makes one call; code does the rest.

## Tools (inputs and outputs)

All tools read the business from the brain (`brain.brainOf`) and the saved offer
(`packMemory('offer').offer`) when an input is empty. A `what` typed for the run wins over the
saved business type.

| tool | kind, credits, tasks | input | output |
|---|---|---|---|
| offer.score_offer | ai, 4, write | offer?, website?, what?, who?, price? | score, after, rows[{key,label,score,why}], fixes[{title,line,why,points}], rewrite, source, file (score report .html), ai |
| offer.list_problems | ai, 4, plan | what?, who?, outcome?, price? | problems[{id,stage,stageLabel,driver,problem,fix,part,value,cost}], drivers{dream,likelihood,speed,ease}, ai |
| offer.stack_solutions | code, 1 | problems (required), drivers? | items[{rank,label,detail,keep,verdict,reason,...problem}], kept |
| offer.name_ideas | ai, 6, write | what?, who?, outcome?, keywords?, count (3 to 12, default 8) | names[{name,why,label,detail}], ai |
| offer.build_offer | ai, 6, write | parts[] (chosen items), name (chosen item or text), keyword?, what?, who?, outcome?, price?, capacity?, startDate? | offer{name,keyword,headline,parts,promise,price,priceLine,scarcity,urgency,cta,...}, lengths[{id,label,text}] for bio, one_liner, dm, site, spoken, file (one-page offer .html), ai |
| offer.save_offer | code, 1 | offer (required), items[] (edited lengths) | file (.txt with every length), remembered (saves `offer` to pack memory) |
| offer.plan_money | ai, 6, write | what?, price?, cost?, hours?, payWith? | steps[{key,step,title,priceText,when,script}] (5), thirty{cash,costs,kept,maxToGetOne}, files (.html, .csv with formulas), ai |
| offer.pick_magnet | code, 1 | what?, who? | ideas[{id,kind,title,type,what,why,files,keyword,rank,label,detail}] |
| offer.build_magnet | ai, 6, write | idea (chosen), keyword?, what? | title, kind, files (checklist .html, calculator .csv with formulas, template .html plus .csv, or claim cards .html), promo{keyword,post,story[3],deliver,follow}, ai |
| offer.price_tiers | code, 1 | what?, price?, cost?, hours?, perHour?, competitors?, payWith? | tiers[{key,name,price,kept,keptPerHour,includes}], floor, basis, ladder[{who,price,ask}], scripts[{label,text}], warnings, files (price menu .html, calculator .csv) |
| offer.write_promise | ai, 4, write | what?, type? (redo, refund, keep_working, first_free, on_time, remake), window?, price?, cost?, hours? | promise{type,name,long,short,bio,terms{covers,notCovered,claim,you},claimScript,cost{each,rows,known},sayIt}, file (promise card .html), ai |

## Files a member gets

Offer score report, one-page offer, offer in every length (.txt), money model page and math sheet,
price menu (buyer-facing, best first, "Best place to start" on the middle option, opening prices),
price calculator sheet, promise card, and one freebie file (checklist with a live score, calculator
sheet with formulas, a template, or claim cards). Every HTML page is self-contained, uses the
member's palette, has print styles and has no scripts.

## Real or sample

- Real: scoring reads the member's words or their public website (kit `scan.scanSite`). All prices
  and math come from the member's own price, costs and hours. Card fees in `data/fees.json` were
  checked 2026-10-19 with source URLs; the pages still say "check current rates".
  `data/limits.json` (Instagram bio 150 characters) was checked the same day.
- Templates: without an AI key every AI tool uses its fallback, built from the member's facts and a
  library of 39 business types (`lib/niches.js`, `lib/library.js`), varied with `text.pickBy`.
- Sample: `sample/examples.json` runs on the default test brain (fictional Reyes Mobile Detailing).
- Promises only cover what the member controls (redo, on time, refund of their own fee, replace,
  keep working). Scarcity only from the member's capacity; urgency only from a date they set.
  No "$X value" totals, no income totals: all math is per job or per customer.

## Keys

None needed. With an AI key, each AI tool makes one call (tightening copy); results are checked
with `ai.cleanCopy` and fall back to the template when they fail a check.

## Verified

- `node dev/lint.js offer`: 0 errors. `node --test packs/offer/test/offer.test.js`: passes offline
  (pack suite, score, promise terms, calculator formulas evaluated by `test/formula.js`).
- `node dev/run.js <id>` for all 7 workflows; files opened and rendered with Playwright.
- Harness engine `check` (no problems) and `run` for all 7 workflows.
- Live: `node dev/run.js offer.value_score --live --input website=https://127group.io --input
  "what=membership for people starting a business with AI" --input offer=` read 127group.io and
  scored it 62 of 100 (69 with the fixes), 4 credits.
