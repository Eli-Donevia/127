# Ad desk (`ads`)

Drafts your ads, checks the claims, and suggests changes for your OK. Files only (Legal row 12, D1 to D12): no ad account connection, no `act` tools, every campaign file paused, and nothing is imported, posted or spent for the member.

Ads come after the offer sells. Step one is always the 30-day math from the member's own price and costs, and the verdict says "not yet" until 3 customers came from outreach, when a job loses money, in the slow season (cold-winter states, `data/seasons.json`) or when the budget buys fewer than 10 leads at the max cost per lead.

## Workflows

| id | tier | steps (credits) | per run |
|---|---|---|---|
| `ads.ready_check` Are ads worth it yet? | free | check_numbers (1), find_angles (6) | 7 |
| `ads.launch_kit` Your first ad test | builder | check_numbers, find_angles, pick up to 3 angles, write_ads x3 (6 each), plan_test (2) | 27 |
| `ads.read_results` Read your ad results | builder | read_results (2) | 2 |
| `ads.ad_images` Make your ad images (5 min) | builder | find_angles (6), pick up to 3 angles, ad_images (4) | 10 |
| `ads.google_search` Your Google search campaign (15 min) | builder | special_category (1), check_numbers (1), google_campaign (3) | 5 |
| `ads.landing_check` Check your ad landing page (3 min) | builder | check_page (2) | 2 |
| `ads.creator_brief` Brief a creator for your ads (10 min) | builder | find_angles (6), pick up to 3 angles, creator_brief (2) | 8 |
| `ads.build_campaign` Build your ad campaign (25 min) | builder | special_category (1), check_numbers (1), find_angles (6), pick up to 3, write_ads x3 (6 each), plan_audience (1), check_page (2, optional), ad_images (4, optional), `video.promo` (10, only with "video" on, optional), campaign_files (4) | 37, or 47 with video |
| `ads.optimize` Your daily ad check (5 min, suggested every morning at 8am) | builder | suggest_changes (2). No required inputs. | 2 |
| `ads.optimizer_skill` Get your daily ad check for Claude | builder | optimizer_skill (1) | 1 |
| `ads.competitor_ideas` Ideas from other ads (10 min) | builder | study_ads (2) | 2 |

Every step after `special_category` in `build_campaign` and `google_search` has `when: '$category.go'`, so "Politics or social issue" ends the run at Legal's line. The video step runs only when `write_ads` echoes `makeVideo` (the member's "video" box), so it never runs without copy.

**Role.** `roles: [{ id: 'ads_manager' }]` overrides the built-in Ads helper: skill `wf:ads.optimize`, the 9 workflows a member starts from the card, `connectors: { read: [], write: [] }`, `needsOk: ['Every ad before it goes live', 'Any change to a budget']`, budget 300. It never writes to an account.

`ready_check`, `launch_kit`, `ad_images`, `google_search` and `creator_brief` take an optional `service` (What you sell). It wins over the brain, and an onboarding category such as "Local service" never counts as what the member sells. Without either, `find_angles` writes hooks that leave the service out (so `ready_check` still works), and the makers (`launch_kit`, `ad_images`, `google_search`, `creator_brief`) stop at their first ad step with one clear line asking what they sell, instead of ads about "your service".

## Tools (input, output, files)

- `ads.check_numbers` (code, 1). In: `{ price?, cost = 0, jobs30 = 1, closeRate = 25, outreachCustomers = 0, budget = 300, service? }` (price defaults to the brain). Out: `{ numbers: { status: ready|not_yet|no|missing, ready, title, why, price, cost, fee, gp, gp30, breakEven, target, maxCpl, leadsForBudget, learnWeek, breakEvenRoas, lines }, notYet: [3], facts, files }`. Math: card fee 2.9% plus $0.30; profit per job; profit per customer in 30 days = break-even cost per customer; target = half; max cost per lead = target x close rate. File: `<name>-ad-math.html`.
- `ads.find_angles` (ai write, 6). In: `{ price?, service?, needService? }` (`needService: true` stops with the ask above when nothing says what they sell). Out: `{ angles: [{ key, name, hook, why, rank, testFirst }], ai }`: price up front, local call-out, before and after, your time back, what is included, who it is for. Each says to post it free first.
- `ads.write_ads` (ai write, 6, `viewMany`). In: `{ angle (required), price?, service? }`. Out: `{ angle, meta: { primary <=125, headline <=27, description <=27, reels <=44 }, google: { headlines: 15 x <=30, descriptions: 4 x <=90, path1, path2 <=15 }, tiktok: { text <=100, no links, @ or # }, video: { first3: [3 timed shots], rest, rules }, checks: [{ where, text, length, max, ok }] }`. Every line is counted in code; the tool fails rather than return a line over its limit.
- `ads.plan_test` (code, 2). In: `{ numbers (required), ads (required), url?, campaign?, service? }`. Out: `{ split, rules, links, files }`. Half the budget tests the angles for 14 days, half runs the winner. Stop rules from the max cost per lead. UTM links per angle for Meta (facebook / paid_social), Google (google / cpc, `{keyword}`) and TikTok (tiktok / paid_social). Files: `-ad-test-plan.html` (all ads, every line counted, first 3 seconds, links, special ad category note), `-ad-tracker.csv`, `-ad-links.csv`, `-ad-check-ins.ics` (days 3, 7, 14, 21, 30).
- `ads.read_results` (code, 2). In: `{ csv? (Ads Manager export, loose headers like "Amount spent (USD)", "Link clicks", "Results"), spend?, impressions?, clicks?, results?, revenue?, price?, cost?, closeRate?, jobs30? }`. Out: `{ rows: [{ name, spend, cpm, ctr, cpc, cpr, roas, stage, call, fix }], totals, numbers, files, sample }`. Each ad is placed at the stage it is stuck (too early, the ad, the page, the cost, working) against the member's own max cost per lead. Nothing pasted: `sample/meta-export.csv` (fictional), marked sample. Files: `-ad-results.html`, `-ad-results.csv`.

- `ads.ad_images` (code, 4, wants `render`, lane `render`). In: `{ angles?, photo? (asset, image/*), color? (hex), price?, service? }`. Out: `{ ads: [{ n, key, name, kicker, headline, sub, button, primary, metaHeadline, description, files }], zip, preview, rendered, notes, colors }`. Up to 3 angles in 3 sizes (1080x1080, 1080x1350, 1080x1920). The words come only from the member's facts and pass `lib/claims.js`; text is measured with Inter's real widths and fitted; on Stories every word sits inside Meta's safe zone (14% top, 35% bottom, 6% sides). With a photo of their own work the photo leads (and the price ad gets a price sticker); "before and after" is left out without a photo. Background darkened until white text is 4.5:1. Files: `-ad-images.zip` (9 PNGs) and `-ad-images-preview.png`; with no renderer, `-ad-images-svg.zip` and an HTML preview.
- `ads.google_campaign` (code, 3). In: `{ url (required, https), numbers?, keywords? (one per line), budget?, price?, service? }`. Out: `{ campaign, daily, cpc: { value, how }, groups: [{ name, keywords, headlines, descriptions, path, url }], negatives, csv, guide, problems, url, sample }`. One Google Ads Editor CSV (`data/google-editor.json`, columns and values from Google's help): the campaign Paused, Search, Google Search only, Manual CPC, English, a daily budget of the 30-day budget / 30.4; ad groups for the service, its prices and the member's own keywords, with phrase and exact keywords and a starting Max CPC of 10% of the max cost per lead ($0.50 to $20); 16 campaign negatives (jobs, courses, DIY); one responsive search ad per ad group that leads with the group's keywords (15 headlines <=30, 4 descriptions <=90 in "we" voice, paths <=15, UTM-tagged https final URL). `validate()` refuses anything Editor would reject. Locations are left to the member (each needs its own row and ID). Files: `-google-ads-editor.csv`, `-google-campaign-guide.html`.
- `ads.check_page` (api read, 2, 60 s). In: `{ url (required), ad?, price? }`. Out: `{ ok, reason, url, score, checks: [{ id, title, status pass|warn|fail, impact, evidence, fix }], fixes, report, read: live|sample|none, sample }`. One polite read (kit `web.fetchPage`, robots respected) of the page an ad points to: https, phone viewport, size and answer time, ad words in the headline, price, area, a way to act, tap to call, form length, proof, privacy link, exits, tracking tags, claims (a banned word on the page is pointed at, never repeated) and noindex. Score weighted by impact; fixes ordered fail first. A `.example` address reads `sample/landing.html` (fictional) and says so. File: `-landing-page-check.html`.
- `ads.creator_brief` (code, 2). In: `{ angles?, creator?, videos (1 to 6), length, usage ("Posts on my accounts only", "30 days of ads", "60 days of ads", "12 months of ads"), pay?, due?, musts?, avoid?, price?, service? }`. Out: `{ brief: { facts, never, shots, deliver, rights, disclose, spark, pay, timeline, ... }, message: { dm, subject, email }, page, doc }`. What to make (vertical, raw clips, safe zone), each angle's first 3 seconds in the creator's voice ("they", never "I"), facts to get right, never say or show, the FTC's disclosure rules (`data/creators.json`), usage rights, TikTok Spark Ads code steps with the matching duration (7, 30, 60 or 365 days) and Meta partnership ad permission, dates and pay. The email ends with name, business, `outreach.ADDRESS_HOLD` and the opt-out line (D28). Files: `-creator-brief-<name>.html` and `.txt`.

### Wave 5 tools (Legal row 12)

- `ads.special_category` (code, 1). In: `{ special (required, no default: Housing, Jobs, Credit or financial, Politics or social issue, None of these) }`. Out: `{ go, answer, key, special, line, meta: { special_ad_categories, special_ad_category_country }, rules }`. Politics: `go: false` and Legal's line; the desk doesn't draft.
- `ads.plan_audience` (code, 1). In: `{ special, ageMin >= 18, ageMax, gender, radius, zips?, interests? }`. Out: `{ audiences: [meta, google, tiktok], removed: [{ network, what, why, source }] }`. D7 clamps every age to 18+. For housing, jobs and credit (`data/special-categories.json`, sources per network): ages fixed 18 to 65+, all genders, no ZIP codes, no excluded places, a radius of 15 miles or more, no interests, no lookalikes. Lookalikes are never offered (D10).
- `ads.campaign_files` (code draft, 4). In: `{ special, ads, audiences, numbers?, page?, images?, video?, url (https), budget?, price?, keywords?, ai?, service? }`. Every line is checked again (`C.review`); a blocked line stops the run with Legal's line, and a line that needs proof is taken out and listed with "Can you back this up?". Files: `-meta-bulk-import.csv` (Campaign, Ad Set and Ad all PAUSED, Special Ad Categories and Special Ad Category Country), `-google-ads-editor.csv` (campaign Paused, via `googlePlan`), `-tiktok-upload.csv` (worksheet in our own columns), `-tiktok-checklist.txt` (Special Ad Category toggle, the AI-generated content toggle and its reset on duplicate), `-ad-campaign-guide.html`, and all of them plus the tracking links in `-ad-campaign-files.zip`.
- `ads.suggest_changes` (code read, 2). In: `{ file? (CSV asset), csv?, resultIs, price?, cost?, jobs30?, closeRate? }`, all optional. Reads a Meta, Google or TikTok export (`lib/optimize.js`, header detection); with none it reads the last saved results from pack memory (`results`, per ad per day totals, under 4 KB); with neither, `sample/results-daily.csv` (fictional) and `sample: true`. Out: suggestions of kind stop, shift, scale, refresh (fatigue: frequency up and click rate down), watch, keep; each carries the rule, the numbers and the spend effect against the member's own target cost per customer, and ends "Nothing changes until you make the change yourself in {network}." No approve step, no "OK all", no automatic rules, and a suggestion that would narrow targeting is dropped (`T.narrows`). Files: `-ad-check.html`, `-ad-check.csv`.
- `ads.optimizer_skill` (code draft, 1). The same check as a Claude skill, the shape of `packs/kpi`: `<business>-daily-ad-check.zip` with `SKILL.md` (name <= 64, description <= 200), `reference/rules.md`, `reference/exports.md`.
- `ads.study_ads` (code draft, 2). D11: pasted ads give angle, hook type, length, ask and notes only. The member's version of each angle is built from their own facts, and any idea that shares 4 words in a row or a name with the pasted text is replaced. Links are never opened. No AI call sees the pasted text.
- Changes to older tools: `find_angles` holds AI hooks that fail the claims check (`held`); `write_ads` re-checks every line (`claims`), adds a `script` for `video.promo` and `restricted` lines (D8); `ad_images` takes `ai` and burns Legal's AI person or voice label onto the picture (D5); `google_campaign` requires `special`.

## Legal row 12

| D | How |
|---|---|
| D1 | Files only: every campaign, ad set and ad is paused; no account connection; no `act` tool. |
| D2 | The question is a required step with no default before any draft; politics stops; `data/special-categories.json` per network with sources; Meta files carry `special_ad_categories` and country; Google too. |
| D3, D4 | `lib/claims.js` on every line the desk writes: income, sure or timed results, body before-and-after, pressure, personal traits, and made-up reviews, ratings, counts and personas are blocked; "best" or numbers the member didn't type ask "Can you back this up?". |
| D5 | `lib/labels.js`: each network's AI label in the files and guide, and the burned-in line for an AI person or voice. |
| D6 | No real-person likeness beyond the member's own photo. |
| D7 | Every audience is 18+. |
| D8 | `data/restricted.json`: Legal's line per network. |
| D9 | `ads.optimize` suggests only. |
| D10 | Totals only, under 4 KB in pack memory; no lookalikes or customer lists. |
| D11 | `ads.study_ads`: angles and structure, never their words, pictures or names. |
| D12 | The landing check uses the same claims filter. |

## Data

- `data/platforms.json`: Meta, Google, TikTok and GA4 limits and the Stories safe zone.
- `data/google-editor.json`: Google Ads Editor CSV columns, values (campaign type, statuses, networks, bid strategy, match types, "Campaign negative"), RSA and keyword limits, import steps and how average daily budgets work (up to 2x on a day, at most 30.4x a month). Each from Google's help pages, read Oct 19, 2026, sources inside.
- `data/creators.json`: the FTC's Disclosures 101 rules, TikTok Spark Ads authorization steps and code durations, and a hedged Meta partnership ad note, each with its source.
- `data/special-categories.json`: the question, answers, Meta's values and each network's rules for housing, jobs and credit ads, with sources (Meta's Marketing API special ad category page, Google's personalized advertising policy, TikTok's choosing-special-ad-category help article).
- `data/bulk-files.json`: Meta bulk import columns and values (column names from a vendor guide, since Meta's help pages render only in a browser; marked in `verified`), the TikTok worksheet columns (TikTok doesn't publish its template headers) and the AI label notes per network.
- `data/optimizer.json`: the daily check's rules and thresholds, the suggestion line and how to export from each network.
- `data/restricted.json`: restricted product keywords and Legal's line.
- `data/screen-lines.json`: Legal's part 5 lines, word for word.
- `lib/claims.js`: income claims, promised results, pressure, personal-trait call-outs and "best in" claims, plus the house copy rules. Every line the new tools write passes it.

## Real vs sample

All math uses the member's numbers. Limits in `data/platforms.json` were checked on Oct 19, 2026 on Meta, Google Ads, TikTok and GA4 help pages (sources inside). No keys needed, nothing is posted or spent: the Google campaign imports paused, and the member posts and turns on everything themselves. The landing page check reads a real page only when the member gives its address; `.example` addresses read the fictional sample page. Ad images use only the member's own photo and facts. Fictional samples: `sample/landing.html`, `sample/meta-export.csv`, `sample/results-daily.csv`.

## Asks (kit, Legal, other packs)

- Kit: `text.copyProblems` bans one word of Legal's blocked line outright (the "no promises" word). It lives only in `data/screen-lines.json` and shows only when a line is blocked, which never happens in a sample run.
- Legal: the optimizer card says "Nothing changes until you make the change yourself in {network}" in place of "until you tap OK", since nothing is applied here. The 15-mile radius floor for special categories is used on all three networks.
- Media studio: `studio.ad_sizes` isn't in the library yet (no `packs/studio`), and lint stops on an unknown tool, so `build_campaign` uses `ads.ad_images` for creatives. When studio lands, swap the `images` step's tool (same `angles: '$pick.chosen'`) and add `studio` to `uses`.
