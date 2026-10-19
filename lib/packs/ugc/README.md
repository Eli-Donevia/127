# UGC creator (`ugc`)

The online flagship. A first-time creator makes short vertical product videos that small online brands post and run as ads. One numbered path: 25 real small Shopify brands with a concept video for the best one, the offer, one brand at a time, replies, calls, a brief with a proposal and a quote, delivery with an invoice, a month-end report, a portfolio page and 25 more brands. Facts about real brands come only from their own public store files, dated. Nothing is sent or posted: the member sends every message from their own accounts.

## Workflows

| Id | Title | Tier | Minutes | Credits | Makes |
|---|---|---|---|---|---|
| `ugc.first_25` | Your first 25 brands | free | 10 | 23 | 25 real brands in the member's category ranked by what their store shows (no product video, a new launch, few photos, a small catalog), saved to the Pipeline with `msg`, `facts`, `score` and `channel`; the script and a 15-second concept preview (MP4 and cover PNG) for #1; pitches for the top 5 to read and edit (approve step), saved in the slot Do my day sends next; CSV of all 25 |
| `ugc.offer` | Your offer | builder | 4 | 2 | three packages at the member's level (test video, ad starter, monthly), add-ons, founding terms for the first 3 brands, usage rights in plain words, the FTC disclosure line for their own posts, what they promise and never promise, an offer sheet (HTML) and a picture for DMs (PNG); remembered for every later answer |
| `ugc.pitch_one` | Pitch one brand | builder | 6 | 23 | the same concept, script and pitch for one brand from the Pipeline or a typed store link |
| `ugc.reply` | Answer a reply | builder | 3 | 3 | what they meant (kit `outreach.answer`, where any decline is a stop, plus auto-replies, the wrong person, "send info", "let me think" and the eight worries brands have), a short answer with one next step at the real price, saved on the brand; a stop marks it lost and gets no answer; a check-back on the calendar |
| `ugc.call_prep` | Prep for a call | builder | 8 | 9 | `shop.read_store` for the brand's live products, the call card (what to check first, products to film, seven questions, the price said once, the worries, the close, what to do after yes, think or no), `sales.call_script` with the three options, the call on the calendar; the brand moves to Call booked |
| `ugc.brief` | Write a brief | builder | 8 | 10 | `shop.read_store`, a one-page creative brief (a concept for every video on their real products, hooks, shots, dates, deliverables, what the member needs, the use in plain words, the honesty rules), `sales.proposal` with the picked package recommended between a bigger and a smaller option, `sales.quote` for the picked package with half up front; the brand moves to Call booked |
| `ugc.deliver` | Deliver a paid job | builder | 4 | 2 | the delivery checklist, file names, the usage letter for what they bought, the disclosure lines, due date and edit window on the calendar, and `sales.invoice` for the balance with the member's payment link; the brand is marked won and the job is logged for the month-end report |
| `ugc.month_end` | Month-end report | builder | 5 | 2 | a one-page retainer report from numbers the member types (videos, hooks, edits, the numbers the brand shared, labeled as theirs), what they noticed, next month's plan and dates, one idea at the member's price, the email to send; suggested on the 28th at 9am, named by month, and numbers repeated from an earlier month are left out |
| `ugc.portfolio` | Your portfolio page | builder | 12 | 10 | the portfolio facts (packages and prices from the offer, the work listed, brands they may name, quotes), then `site.write_copy` and `site.build` with the site pack's portfolio template: a ZIP for Netlify Drop, a preview and a share image. Concepts made to pitch a brand that hasn't hired the member are left off |
| `ugc.next_25` | Your next 25 brands | builder | 4 | 2 | up to 25 more brands, skipping everyone in the Pipeline (kit `leads.known`) and the skip list, each saved with its first message and two follow-ups; a dated CSV; suggested every Monday at 7am |
| `ugc.rates` | Your rate card | builder | 3 | 1 | the per-video rate card (PNG, HTML, text) with add-ons and what each platform keeps |

AI writes the hook for brand #1, the top 5 pitch openers and the reply answers that templates can't fit; every AI line has a template fallback and passes the copy rules.

## Tools

- `ugc.find_brands` (code, 2): the store snapshot plus live reads of each store's `/meta.json`, `/products.json` and the top product pages; `stores`, `count`, `check`, `only`, `skipKnown`, `save`, `exclude`. Short categories fill from a neighbor category, marked in the table.
- `ugc.write_script` (ai, 6), `ugc.render_sample` (code, 8, needs `render`, wants `pexels`), `ugc.write_pitches` (ai, 6), `ugc.save_pitches` (code, 1): the concept, the clip and the pitches.
- `ugc.pick` (code, 0): one brand from the Pipeline by name, store or key (any pack's lead), or a typed store link.
- `ugc.build_offer` (code, 2, wants `render`) and `ugc.rate_card` (code, 1, wants `render`): prices from `lib/offer.js`, the one place every tool reads a price.
- `ugc.answer_reply` (ai, 3), `ugc.call_card` (code, 2), `ugc.brief` (code, 2), `ugc.delivery_kit` (code, 1), `ugc.month_report` (code, 2), `ugc.portfolio_facts` (code, 1).
- Composed by name: `shop.read_store` in call prep and the brief (one brand, live); `sales.call_script`, `sales.proposal`, `sales.quote` and `sales.invoice` with `pipeline: false`, because this pack logs the brand itself (HQ shows one row); `site.write_copy` and `site.build` with `design: 'portfolio'`. Bulk finding keeps this pack's own reader, which ranks many stores at once from the dated snapshot.
- Pipeline reads, reply saving and `moveLead` are kit `_kit/talk.js`, shared with frontdesk and reviews.

## Data and sources

- `data/brands.json`: 362 stores in 12 categories, read on 2026-10-19 from each store's own `/meta.json` and `/products.json` after a robots.txt check. Product facts only.
- `data/rates.json`: per-video rates by level ($100 new, $150 after 3 paid clips, $250 after 10), add-ons, the monthly bundle and platform fees, with sources in `research/niches/ugc.json`.
- `data/rules.json`: the FTC disclosure lines (16 CFR 255.5, 255.1, FTC Disclosures 101, TikTok branded content policy), honesty rules, usage terms in plain words and pitch rules.
- `data/niche.json`: the crowd, categories, founding terms, the eight worries with honest answers, and call questions.

## Real, sample and rules

- Real: every store fact is quoted from the brand's own files and dated. Gaps are only what was read, never a guess about sales or results.
- Sample: `sample/examples.json` (fictional creator Maya Brooks, `mayabrooks.example`) and `sample/brain.json`. Example paid jobs use fictional brands on `.example` addresses.
- The script never says the creator used the product (16 CFR 255.1): the reaction line is a blank filled on first use. The concept preview is labeled, never posted, and the pitch says it was made from the product page.
- Pitches carry no price and no claim about views or sales. Emails end with the member's name, business, mailing address and an opt-out line (CAN-SPAM, D28).
- Prices are what one brand pays for one job. Nothing shows what anyone will earn.
- Credits per full run, in the order members see them: first 25 23, offer 2, pitch one 23, reply 3, call prep 9, brief 10, deliver 2, month end 2, portfolio 10, next 25 2, rates 1.
