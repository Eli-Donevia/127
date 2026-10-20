# Online store (`ecom`)

Someone selling physical products online (Shopify, Etsy or their own site). A business pack (`business: true`) and `held: true` (contract v1.10: checked at load, off until `PACKS_ON` names it). Drafts only: the member sends, posts, uploads and publishes. Nothing is sent from 127.

## Workflows

| id | title | tier | min | credits | the member gets |
|---|---|---|---|---|---|
| `ecom.first_25` | Your first 25 | no-cost tier | 15 | 2 | crowd card; up to 15 people they know with a personal note and follow-up; up to 10 local gift shops and boutiques, markets, craft, art, stationery and book shops and independent cafes (OpenStreetMap through the kit) with a wholesale, consignment or vendor-table message, an email version and an in-person line; a dated plan; a CSV; people and real places saved to the Pipeline |
| `ecom.product_page` | Product page writer | builder | 8 | 6 | Shopify title (70), search description (160), 5 bullets, description, alt text per photo; Etsy title (140), 13 tags (20 characters each), description; a counts table and an HTML copy sheet |
| `ecom.pricing` | Check your price | builder | 4 | 1 | landed cost; fee, what you keep, profit, margin, break-even and the price for the target margin on Shopify Payments (their plan), Etsy and PayPal; a wholesale check at half of retail; CSV with sources |
| `ecom.launch` | Launch email and posts | builder | 8 | 6 | a launch email and 3 posts dated around launch day, a calendar file and a text file |
| `ecom.store_emails` | Cart and after-purchase emails | builder | 8 | 6 | 3 abandoned-cart emails and 3 after-purchase emails (the last asks for an honest review with nothing offered), where to paste them |
| `ecom.policies` | Returns and shipping policy | builder | 6 | 1 | returns and refunds policy and shipping policy from their choices, the checks to make against Shopify, Etsy and state law, sources; says it is not legal advice |
| `ecom.wholesale` | Wholesale pitch kit | builder | 10 | 2 | a printable line sheet (wholesale at 50% of retail by default), an order form CSV, a pitch email per shop they name or found with Your first 25, each ending with the address line and a "no thanks" opt-out |
| `ecom.shot_list` | Product photo shot list | builder | 4 | 1 | photos in upload order with why and how, file names, a one-window setup, printable HTML and a CSV checklist |
| `ecom.orders` | Read your orders | builder | 5 | 1 | best sellers by units and sales, products bought together, repeat buyers with a thank-you note each; two CSVs. `hqOnly: true` (buyers' names) |

Every full run is far under 300 credits.

## Real or sample

- **Places**: kit `places.findPlaces` with OpenStreetMap tags from `data/niche.json` (`shop=gift`, `shop=boutique`, `shop=interior_decoration`, `amenity=marketplace`, `shop=craft`, `shop=art`, `shop=stationery`, `shop=books`, `amenity=cafe`), chains dropped by the kit filter. `wants: ['osm']`. Without 127's map servers, or with nothing found, the places are made-up samples named "(sample)", never saved. Google Places is never used.
- **Orders**: the member's Shopify orders export (CSV upload, `format: 'asset'`). `wants: ['shopify']` with a separate reader (`fromShopify` in `tools/orders.js`, the client shape the `ecomops` pack reads: `orders({ sinceDays })`) for when HQ wires the connection; today HQ returns null, so it reads the upload, else the labeled sample store (`sample/orders.csv`, Juniper Candle Co., made up). No AI call sees the file. The view shows first names only; the repeat-buyers CSV (names, emails, notes) stays in the member's Library.
- **AI**: product page, launch kit and store emails write with `task: 'write'` and fall back to templates built from the member's facts (marked `sample: true`, as the contract asks).

## Claims (Legal L76, D3 and D4)

`lib/util.js` `claims()` checks every AI draft: earnings claims, promised results, exact results in a set time and before-and-after for the body are blocked; numbers, rankings, superlatives, star ratings, buyer counts, percentages and "as seen in" lines are dropped unless the member typed them (their inputs and Brain business facts). A draft with a problem goes back to the template, and `scrub()` cuts any sentence that still has one. Nothing writes a testimonial, review, rating or buyer count. Tests cover both rulings.

## Facts and sources (`data/`)

- `fees.json` (checked 2026-10-20): Shopify Payments US online rates by plan (shopify.com/pricing, read 2026-10-20), PayPal Checkout 3.49% + $0.49 and cards 2.99% + $0.49 (paypal.com business fees, updated Oct 1, 2026), Etsy $0.20 listing, 6.5% transaction, 3% + $0.25 processing (Etsy help pages as checked for the templates pack on 2026-10-19; Etsy refused our reader on 2026-10-20, so the view says to open the source).
- `limits.json`: Shopify search title 70 and description 160 (help.shopify.com, read 2026-10-20); Etsy title 140, 13 tags of 20 characters (Etsy help, via the templates pack's 2026-10-19 check). Alt text 125 and bullets 110 are our own rules, labeled as such: neither platform states an alt text limit we could check.
- `policy.json`: FTC Mail Order Rule (ship time, delay notice, refunds), Shopify store policies (its templates aren't legal advice), Etsy seller policy.
- `shots.json`: our own shot list.

## Pick a niche entry (for research/crowd.json and packs/leads/data/niches.json)

See the report: label "Online store", kind online, count partners (gift shops, markets).

## Checks run

`node dev/lint.js ecom`, `node dev/null-scan.js ecom` (2 hits read: both replaced before the return), the copy check with `--paid` (0 blocking), `node --test packs/ecom/test/*.test.js`, and the engine sweep (all 9 done, with `PACKS_ON=all` since the pack is held; see the report about the harness mirror's missing `connectors` module).

## Kit asks

- Move `claims()`/`scrub()` (Legal L76 D3, D4) into the kit so every pack that writes ad, product or post copy uses one list.
- `places.finder` could take a category object with OSM tags, so packs needn't build custom categories for `amenity=marketplace` and the like.
