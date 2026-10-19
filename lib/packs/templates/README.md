# Digital templates (`templates`)

Crowded and slow (crowd card: first dollar Slow), so the pack starts from proof. Workflow 1 ranks 25 buyer searches by public demand on Gumroad, the member picks one of the five this pack can build, and gets it made three ways with its listing and fees. The online spine after that: the offer (the product line), the launch (listing, pins, email, review ask, 14 days), the bundle (the upsell) and the next product (step 10, ranked the same way, monthly).

## Workflows

| id | title | tier | min | job | steps | credits per run | files |
|---|---|---|---|---|---|---|---|
| templates.first_25 | Your first 25 | free | 8 | offer | find_demand, approve (pick 1 of 5), make_template, write_listing | 10 | searches .csv, template .zip, mockup .png, listing .txt |
| templates.offer | Your offer | builder | 6 | offer | plan_offer | 6 | product line .html (one printed page), fee calculator .csv |
| templates.make | Make a template | builder | 4 | offer | make_template, write_listing | 8 | .zip, mockup .png, listing .txt |
| templates.launch | Launch a template | builder | 12 | sales | write_listing (no file), make_pins, launch_kit | 15 | pins .zip, pins preview .png, launch kit .txt |
| templates.bundle | Make a bundle | builder | 6 | offer | make_bundle | 8 | bundle .zip, mockup .png, listing .txt |
| templates.next_product | Your next product | builder | 8 | offer | rank_ideas, approve (pick 1 of 5), make_template, write_listing | 10 | ideas .csv, .zip, mockup .png, listing .txt |

Workflows are listed in the order a member runs them (HQ's Start shows them as one numbered path): first 25, offer, make, launch (the review ask is part of it), bundle, next product. `next_product` suggests a schedule: on the 1st of every month at 8am. It is safe to repeat: the ideas and templates it offered last time go to the back of the list (they return once the new ones run out), made templates never come back, and every file it saves carries the date (`next-25-template-ideas-2026-10-19.csv`, `habit-tracker-2026-10-19-files.zip`). Every workflow has `next` with reasons.

## Tools

| tool | kind, credits | input | output |
|---|---|---|---|
| templates.find_demand | code, 2 | idea?, live? | card (crowd), searches[{rank,search,label,kind,makeable,listings,top_ratings,price,score,evidence,url,checked}], makeable (5 different templates), best, idea, csv, live, total |
| templates.make_template | code, 2 (wants render) | pick[] or best, or kind (name or id), title?, color?, dated? | product{kind,title,search,price,formulas,columns,rows}, zip (spreadsheet .csv with formulas, Notion .md, printable .html, how-to-open .txt), mockup (.png 2000x1600); remembers `made` and `last` |
| templates.write_listing | ai write, 6 | product, or kind + title (else the last one made), price?, save?, dated? | product, listing{title (140 max),tags (13, 20 chars max),description,gumroad,price}, fees, note (to 5 people they know: feedback, never a review), file |
| templates.plan_offer | ai write, 6 | kind?, title?, price?, theme? | rungs (free page on Gumroad $0+, template, printable only, bundle of 3), fees per rung, how, sheet (.html), calc (.csv with formulas); remembers `offer` |
| templates.make_pins | code, 3 (wants render) | product, link? | pins[{title (100 max, keyword first),description (800 max),alt,board,link}], zip (3 pins 1000x1500 + text), preview (.png) |
| templates.launch_kit | ai write, 6 | product, listing, note?, pins?, start?, link? | email (name, business, address hold, unsubscribe line), review{etsy,gumroad}, rules, plan (8 dated tasks over 14 days), days, file |
| templates.make_bundle | ai write, 8 (wants render) | theme?, kinds?, title?, price?, color? | bundle{kinds,title,price,singles}, listing{title,tags,description,singleLine,gumroad}, fees, zip (a folder per template + start-here), mockup, file |
| templates.rank_ideas | code, 2 | count?, live? | ideas (25, made kinds left out, last run's ideas moved to the back, "fits your shop" from what was made or the brain), makeable (5 different, new ones first), best, dated csv with Gumroad, Etsy, Pinterest and Google Trends links; remembers `shown` |

Forms show template names ("Debt Payoff Tracker") and theme labels ("Money"); tools take a name or an id (`T.kindOf`, `T.themeIdOf`).

## Real or sample

- Demand: `data/demand.json` (30 searches) and `data/ideas.json` (55 more) are Gumroad Discover pages sorted by most reviewed, read on 2026-10-19: the listing count, the rating counts on the three most-rated results whose names match the search (ratings come from buyers), and their prices. At run time the searches are re-read live (2 at a time, cached 24 hours, robots respected); offline the snapshot is used and dated. No sales numbers anywhere (Gumroad and Etsy don't publish them), and third-party product names are never shown.
- Fees and limits (`data/platforms.json`, checked 2026-10-19 on Etsy, Gumroad and Pinterest help pages): Etsy $0.20 listing, 6.5% transaction, 3% + $0.25 US processing, Offsite Ads 15% (12% over $10,000 a year), title 140 characters, 13 tags of 20, 5 files of 20MB, Message to Buyers for digital items; Gumroad 10% + $0.50 on your own link plus card processing 2.9% + $0.30, 30% on Discover, free or up to $5,000, `$0+` pay what you want, Bundle product type, checkout Upsells (replace the cart with a bundle), Emails after $100 earned and a payout; Pinterest title 100 (first 40 may show), description 800, 2:3 at 1000 x 1500.
- Reviews: nothing in exchange for one, the same ask to every buyer (Etsy Anti-Shilling policy; 16 CFR 465.4). The note to 5 people asks what was confusing, never for a review.
- Prices come from the matching products' prices on Gumroad (middle of the paid prices, kept between $4 and $15), or the member's own. The bundle is about 65% of the singles, rounded; it is shown as "3 templates for $20 ($33 if bought one by one)", never "save" or "value".
- Templates are built from one spec per kind (`lib/tpl.js`, 27 kinds): the CSV formulas are tested to point at real cells; the printable page has print styles and no scripts. Mockups and pins are drawn from the spec; templates whose rows start blank show example rows in the pictures only (the files stay blank).
- The launch email is to people who asked to hear from the member: it ends with name, business, `outreach.ADDRESS_HOLD` and an unsubscribe line written for a product list (the kit's `OPT_OUT` talks about services).

## Keys

None. `render` (ffmpeg) draws the mockups and pins.

## Sample brain

`sample/brain.json`: Tallyleaf Templates (made up), budget and money templates for Google Sheets, Notion and print, first sales. `rank_ideas` reads "money" from it to mark ideas that fit the shop.

## Not done

Payhip fees (page not verified), Etsy creativity and trademark policy pages (bot wall; search excerpts only), seasonal timing for planners beyond the crowd note. The CSV formulas are checked by reference, not opened in a spreadsheet app here.

## Verified (2026-10-19)

- `node dev/lint.js templates`: 0 errors. `node --test packs/templates/test/templates.test.js`: all pass offline (all 6 workflows end to end, formula references for all 27 kinds, Etsy limits, fee math, names to ids, listing note, offer rungs and calculator formulas, pins limits, launch email ending and review ask, bundle zip and wording, next ideas without made kinds, a monthly repeat with new ideas and dated files).
- Harness `check`: no problems. Harness `run` of all 6 workflows (`/tmp/online-video/templates.*`), files opened: mockups, pins and bundle mockup by eye; the offer sheet in Chromium (prints on one letter page); CSVs, listings and the launch kit read through.
