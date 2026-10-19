# Shopify store kit (`shop`)

Reads any Shopify store's public data (the `/products.json` feed, `/collections.json`, `/meta.json`, the homepage and one product page), scores what a shopper sees, and turns the gaps into work a member can sell or fix. No keys. Public pages only: polite pacing (400 ms between calls to one store, one retry on 429), robots respected, nothing is posted or sent.

## Workflows

| id | tier | credits per run | what the member gets |
|---|---|---|---|
| `shop.first_25` | builder | 65 (2 + 30 audits x 2 + 1 + 2) | Your first 25: shops near their city with a website (OpenStreetMap), each audited, ranked by fixable gaps, an approve step to pick, then an email, DM and follow-up per store plus a pipeline CSV. Each store's audit report is the thing to show. |
| `shop.audit_store` | free | 2 | Scored audit report (HTML) with fixes in order, plus a product by product issues CSV. |
| `shop.spec_fix` | builder | 6 | Audit, a mock of one real product page with the fixes applied (store's own photos, words, prices), and the pitch with price. |
| `shop.launch_store` | builder | 1 | Shopify product CSV (imports as drafts) and a launch checklist page. |
| `shop.price_products` | builder | 2 | Per sale price sheet: landed cost, card fee for their plan, profit, margin, break-even ROAS, target price, wholesale price, similar public prices at up to 3 stores. |
| `shop.product_list` | builder | 1 | Any store's newest products with prices, photos, descriptions and links. |
| `shop.theme_sections` | builder | 2 | Up to seven Shopify theme sections (trust bar, what's inside, FAQ, shipping and returns, maker story, stockists, email signup) as `.liquid` files in one zip with a read-me, in the member's colors and words, each checked against Shopify's section rules (`data/theme-rules.json`); a guide page previews each one and shows where to paste it. A section with no facts behind it is left out and the guide says what would add it. |
| `shop.launch_emails` | builder | 1 | Launch emails dated to the launch day (save the date, it's live, the story, offer ends when there is one, a thank-you with an honest review ask and no incentive), each with subject and preview line, a send checklist (CAN-SPAM footer, test send, exclude buyers) and a calendar file. |
| `shop.product_drop` | builder | 2 (1 + 1) | A day by day drop plan from today to a week after (make, store, post and email tasks; early tasks move to today when the drop is close), Shopify's verified steps to schedule the product to go live, six dated captions, the drop emails (with a night-before email) and one calendar file. |
| `shop.compare_stores` | builder | 3 | The member's store next to up to three others from one public read each: scores, where they lead (with the fix and the tool that does it), where the member leads, middle price position and the numbers side by side, plus a CSV. |
| `shop.stockists` | builder | 5 (3 + 2) | Independent local shops that might stock the member's products (shop types for their category from `data/stockists.json`, OpenStreetMap through the kit, each website read once for fit), an approve step, then a one-page wholesale line sheet (keystone by default, `data/wholesale.json`) and an email, DM, walk-in line and two follow-ups per shop, saved to the Pipeline (msg, facts, score, channel) and in one CSV with the map credit. |

## Tools (inputs and outputs)

All tools are `needs: []` (free public data). In sample mode (`ctx.sample`, or `.example` hosts, or the network off) they return realistic made-up stores from `sample/` and set `sample: true`.

**`shop.audit`** (api, read, 2 credits). Input `{ store: string (required, "shop.com" or a product URL), depth?: "full"|"quick" (quick reads the first 250 products), files?: boolean (default true), name?: string }`.
Output `{ ok, status: "open"|"not_shopify"|"password"|"feed_off"|"unreachable"|"bad_url"|"blocked", reason, store: { name, url, domain, platform, products, productsRead, capped, theme, note }, score (0-100), grade, fixes: [{ id, area, impact: "high"|"medium"|"low", status, title, evidence, why, how, minutes, fixedBy }] (max 12), strengths: [string], numbers: { products, priceMin, priceMax, priceMedian, photosPerProduct, oneImage, wordsMedian, thin, soldOut, altMissing, altChecked, apps: { category: [names] }, pixels, pages: { shipping, returns, faq, contact, about, ... urls }, collections }, pitch: { store: { name, url, domain, origin, currency, colors, emails, instagram, theme, os2 }, target: { title, handle, url, price, compareAt, words, images, image, imageList, options, text }, related: [{ title, handle, url, price, image }], facts, score, grade, fixes (top 5) }, report: asset (HTML), issues: asset (CSV), sample }`. Not-ok statuses return `{ ok: false, status, reason, store }` only.

**`shop.read_products`** (api, read, 1 credit). Input `{ store (required), limit?: 1-50 (default 12) }`. Output `{ ok, status, reason, store: { name, url, domain, currency, products }, products: [{ title, handle, url, type, vendor, price, priceMax, compareAt, soldOut, images: [https urls], image, photos, options: [{ name, values }], tags, description (plain text, max 600 chars), words }], sample }`. A product URL as `store` puts that product first. Sample images are left out (empty arrays), so a caller never gets a fake URL.

**`shop.find_stores`** (api, read, 2). Input `{ city?, stores?: "one address per line", limit?: 1-40 (30), radiusKm?: 1-25 (10) }`. Output `{ stores: [{ key, name, url, kind, kindLabel, miles, address, phone, email, instagram, source: "osm"|"you"|"sample", sample }], found, center, credit, sample, note }`. Chains are dropped; pasted stores come first.

**`shop.rank_stores`** (code, 1). Input `{ audits: [shop.audit outputs], places?: [find_stores rows in the same order], limit? }`. Output `{ stores: [{ rank, name, url, domain, score, grade, products, top: [3 titles], why, fixes, email, phone, instagram, address, miles, kind, report, pitch, opportunity }], checked, skipped: { status: count }, sample }`.

**`shop.write_pitch`** (code, draft, 2). Input `{ stores: [rank rows or audit outputs] (required), price?: number (flat price per job), days?: 5, what?: "a Shopify designer in Asheville", address?: mailing address for the email footer, mock?: asset }`. Output `{ items: [{ rank, label, url, email, instagram, subject, text (email), dm, follow_up, follow_up_on (YYYY-MM-DD), show (report file name) }], sheet: asset (CSV), count, sample }`. Messages cite only audit evidence, offer one price per job and promise only on-time delivery, a redo or a refund of the member's fee.

**`shop.mock_page`** (code, draft, 2). Input `{ pitch: shop.audit pitch (required), product?: product URL }`. Re-reads one product JSON. Output `{ ok, page: asset (static HTML, no scripts), product: { title, url, price }, notes: [string], sample }`.

**`shop.build_csv`** (code, draft, 1). Input `{ products: "Name | price | description | Sizes: a / b" per line (required), vendor?, type?, collection? }`. Output `{ products: [{ title, handle, price, options, seoTitle, seoDescription, missing }], csv: asset, checklist: asset, problems: [string], rows }`.

**`shop.price_check`** (api, read, 2). Input `{ products: "name, cost, price?" per line (required), plan?: basic|grow|advanced|plus, packaging?, shipping?, charged?, ad?, margin?: 0.6, competitors?: up to 3 store addresses }`. Output `{ rows: [{ name, cost, landed, price, priceSource, fee, profit, margin, afterAds, roas, suggested, wholesale, wholesaleMargin, similar, similarMedian }], competitors: [{ store, url, ok, median, min, max }], plan: { id, name, rate, fixed, checked, source }, sheet, csv, sample }`.

**`shop.read_store`** (api, read, 1). For other packs (the ugc pack). Input `{ store (required), picks?: 1-12 (6) }`. Output `{ ok, status, reason, domain, name, url, country, currency, products, price_low, price_high, price_median, newest, avg_images, types, picks: [{ title, handle, url, price, compare_at, images, listed, image, sold_out }], read: "live"|"sample"|"none", checked, sample }`. Not-ok statuses as `shop.audit`; sample art never leaves as an image address.

**`shop.theme_sections`** (api, draft, 2). Input `{ store?, set?: "All seven sections"|"Product page sections"|"Home page sections", shipping?, returns?, made?, materials?: "name: note" lines, faq?: "question? answer" lines, story?, stockists?: "shop: place" lines, signup?, color? }`. Output `{ sections: [{ id, title, file, where, bytes, placeholders }], skipped: [{ title, add }], zip: asset (.liquid files and READ-ME.txt), guide: asset (HTML), colors, problems, sample }`. Liquid uses only theme settings and the member's text; no apps, no scripts.

**`shop.launch_emails`** (code, draft, 1). Input `{ product (required), date?: YYYY-MM-DD (default 10 days out; a past date moves forward with a note), time?: "HH:MM", price?, link?, why?, details?, offer?, ends?, quantity?, mode?: "launch"|"drop", calendar?: boolean (true) }`. Output `{ date, time, mode, emails: [{ n, key, title, send_on, time, audience, subject, preview, body }], checklist, notes, page: asset (HTML), calendar: asset (ICS) or null }`.

**`shop.drop_plan`** (code, draft, 1). Input `{ product (required), date?, time?: "10:00", price?, quantity?, why?, details?, link? }`. Output `{ date, time, tasks: [{ date, when, title, how, tag: make|store|post|live|email, time? }], posts: [{ n, date, type, caption }], notes, page: asset (HTML), calendar: asset (ICS) }`.

**`shop.compare_stores`** (api, read, 3). Input `{ store (required), others (required, one to three addresses, one per line), color? }`. Output `{ ok, reason, mine: { name, domain, score, price_median }, others: [same], skipped, ahead: [{ label, impact, mine, ahead_of, all }], behind: [{ label, impact, stores, theirs, fix, how }], price: { position, text }, page: asset (HTML), sheet: asset (CSV), sample }`. `ok: false` with a reason when there is no other store or none can be read.

**`shop.find_stockists`** (api, read, 3, wants `osm`). Input `{ city (required), what?, price?, radiusKm?: 1-25 (12), limit?: 5-60 (40) }`. Output `{ category: { id, label, many }, shops: [{ key, name, kind, kindLabel, miles, address, website, email, instagram, phone, local, sells, score (0-100), why, facts, channel, source, searchBy?, osmUrl?, lat, lng, sample }], found, skipped (already in the Pipeline), center (or null), credit, note, held, sample }`. Chains are left out.

**`shop.wholesale_kit`** (code, draft, 2). Input `{ shops (required, find_stockists rows), products (required, "Name | retail | note" lines), share?: 0.3-0.8 (0.5, keystone), terms?, contact?, address?, color? }`. Output `{ items: [{ name, wholesale, retail, note }], shops: [{ rank, name, why, channel, subject, email, dm, walkin, source, sample }], saved, lineSheet: asset (HTML, prints to one page), sheet: asset (CSV) or null, missing: [terms to decide], route: walk-in directions link (real shops only) or null, sample }`. Email follow-ups end with name, business, mailing address (or `outreach.ADDRESS_HOLD`) and the no-thanks line (D28).

## Real vs sample

- Real: every store read (Shopify public feed and pages), OpenStreetMap shop search through the kit's one geocoder and one Overpass server (`places.geocode`, `places.overpass`, D27; cached a day; tools that use it declare `wants: ['osm']`), all math and files. Map credit on every list, page and CSV (`places.creditBlocks`, `creditHtml`, `creditLine`), with LocationIQ's link when it did the city lookup. Live runs without 127's map servers are held and show sample shops.
- Sample: `sample/stores.json` (6 hand-made stores plus generated ones), `sample/places.json` (39 fictional Asheville shops on `.example` domains). Used when the network is off, in the engine's sample mode, or when OpenStreetMap is busy and nothing was pasted. Every view and file says so.
- No AI calls: every message and page is built from the audit facts with code templates, so a 25-store run stays at 65 credits.

## Verified facts (data/, checked 2026-10-19, sources in each file)

`shopify-csv.json` (template headers, values, limits, overwrite rules), `shopify-plans.json` (US card rates per plan), `launch.json` (admin paths, SEO and alt text limits, image size, CAN-SPAM, the steps to schedule a product to go live from Shopify's Future publishing page), `theme-rules.json`, `apps.json` (app fingerprints), `osm.json` (usage policies and attribution; servers only through the kit), `wholesale.json` (keystone, terms a shop asks about), `stockists.json` (shop kinds per product category, chains to skip).

## Live runs (Oct 19, 2026)

- `shop.audit_store` on allbirds.com: 692 products, score 58, Yotpo and Attentive seen, 14 s.
- `shop.spec_fix` on beardbrand.com: score 75, mock of Beard Oil Variety Pack with real photos and options.
- `shop.first_25` for Asheville, NC plus 3 pasted stores: 27 sites from OpenStreetMap, non-Shopify ones (Squarespace, Square Online, BigCommerce and others) dropped, 5 real Shopify stores ranked and pitched. Overpass was busy (504) on an earlier try: the tool fell back to marked sample shops as designed.
- `shop.product_list` on allbirds.com and `shop.price_products` against beardbrand.com.

## Local helpers (not in the kit)

`lib/osm.js` (OpenStreetMap shop search with shop types and a website filter, on the kit's servers), `lib/sections.js` (theme section builder and rule checks), `lib/launch.js` (launch dates, emails, drop tasks), `lib/compare.js`, `lib/stockists.js` (fit score, messages, line items), `lib/feed.js`, `lib/brand.js`, `lib/csv.js` (Shopify CSV writer and validator, LF line endings; the kit CSV writes CRLF), `lib/html.js` (report design system), `lib/store.js` (store reader), `lib/audit.js`, `lib/report.js`, `lib/art.js`, `lib/sample.js`, `lib/apps.js`.
