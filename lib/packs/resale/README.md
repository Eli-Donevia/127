# Resale and flipping pack

Start reselling on the 127 spine: buy small, check sold prices first, sell fast. Genuine items only, recalls checked, every flaw named.

| Workflow | Title | Tier | Minutes | Credits | Ends at |
|---|---|---|---|---|---|
| `resale.first_25` | Your first 25 | free | 15 | 1 | 25 items to look for this week (your category first), each with an eBay sold-listings link, where and when to find it, shipping weight, fee math on every platform at the price you check and the most to pay; rules first; a week plan; a CSV |
| `resale.offer` | Price and offers | builder | 5 | 1 | List price from sold prices you found, lowest price that keeps your profit, the offer message for watchers, a bundle rule, markdown dates (30, 45, move it at 60) and fees on every platform |
| `resale.listing` | Listing writer and profit tracker | builder | 10 | 2 | A listing per platform within its own title, description, hashtag and photo limits, plus a profit tracker CSV whose Fee, Profit, Days to sell and Next step columns are formulas. Look-alikes are refused, not reworded |
| `resale.batch` | List a batch | builder | 15 | 3 | Up to 40 listings for the one site you sell on (item, price, condition, flaws, what you paid per line), each within that site's checked limits and price range, with fee, what you keep and profit, checks (recalls, short titles, under your floor), a dated CSV and the profit tracker filled in |
| `resale.reply` | Answer a buyer | builder | 3 | 1 | The answer to send for is it available, offers and lowballs (accept within 10 percent, else one counter never under your lowest price), holds, late buyers, no-shows and is it real, and five scams to avoid (codes, paying outside the app, overpayment and checks, couriers, fake payment emails) with why and the FTC source |
| `resale.keep` | Thank-you and repeat buyers | builder | 3 | 1 | A thank-you note for the package, an honest rating ask after delivery (same for every buyer, nothing offered for it) and a bundle offer for the next order |
| `resale.proof` | Sold card | builder | 5 | 2 | A 1080 x 1350 "Sold" card with your listing photo, where it sold and how fast, and a caption pointing to your shop. Never the price, the profit or the buyer |
| `resale.route` | Plan a sourcing route | builder | 10 | 1 | The stores and sales you list in a sensible order (estate sales first, pickups last) with a time at each, what to bring, what to look for there from your category with sold-price links, Google Maps links in legs of up to 3 stops, and a printable route sheet. Nothing is looked up |

Tools: `resale.list_first25` (code, 1), `resale.price_item` (1), `resale.write_listing` (1), `resale.make_tracker` (1), `resale.write_batch` (2), `resale.answer_buyer` (1), `resale.ask_reviews` (1), `resale.make_sold_card` (2, render), `resale.plan_route` (1).

- Data: `data/niche.json`: platforms (fees, limits, source and date for each), USPS Ground Advantage zone 5 commercial prices (Notice 123, effective Oct 4, 2026), 52 item ideas in 4 categories, sourcing routes and stop kinds, buyer answers and scams (FTC and Mercari sources), sold card rules. Sources: `research/niches/resale.json`, checked 2026-10-19. `sample/jeans.jpg` is a labeled sample illustration for the example run.
- Shared code lives in `packs/_kit/common.js` (with tutoring, petcare and coaching).
- Fee math was checked against eBay's own worked example ($29.03 on $210.50) in the tests, and the tracker formulas were checked in LibreOffice (eBay, Poshmark, Mercari, Depop and an unsold Facebook row).
- Item ideas are things to check, not proof they sell: the sold-listings link is the proof. Tools never read marketplace pages; the member opens the links.
- Limits marked in data as search excerpts or third-party (Poshmark title and description, Mercari title, Depop, Facebook) show a "check the counter in the app" note.
