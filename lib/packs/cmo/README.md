# Marketing lead (`cmo`)

A weekly look at what's working across the member's posts, ads and store, from the same exports the Daily
numbers pack reads. Every output is advice or a draft: nothing posts, sends, or changes an ad or a budget.
Pages are static HTML (no scripts, `@page` Letter, member colors); sheets are CSV; the calendar is also `.ics`.

`held: true` is set on the pack object (contract v1.10 registers it only when env `PACKS_ON` names it). Lint and
the engine sweep accept the field.

## Shared readers: the way chosen

The readers, ledger, metrics, report helpers and page are the kpi pack's, required by path from `lib/base.js` and
`lib/mkt.js` (`../../kpi/lib/readers` and friends). One reader per export for both packs, no copy to drift.
BUILDING.md says not to require another pack's files; the brief asked for a shared lib, and the kit has none yet.
Consequence: `cmo` needs `kpi` on disk, and holding or removing `kpi` breaks `cmo`. Kit ask: move
`kpi/lib/table.js`, `readers.js`, `ledger.js`, `metrics.js` to `_kit/exports/` and both packs require them there.
Which exports are read and how (column names, verified status) is in `packs/kpi/README.md`.

## Workflows

| id | title | tier | steps (tool) | credits |
|---|---|---|---|---|
| `cmo.whats_working` | What's working this week | free (starter) | find (`whats_working`) | 1 |
| `cmo.next_week_plan` | Next week's plan | builder | find (`whats_working`), plan (`plan_week`, AI) | 3 |
| `cmo.ad_calls` | Kill, keep or scale my ads | builder | calls (`ad_calls`) | 1 |
| `cmo.content_mix` | Content mix check | builder | mix (`content_mix`) | 1 |
| `cmo.offer_test` | Plan an offer test | builder | test (`offer_test`) | 1 |
| `cmo.budget_split` | Split my ad budget | builder | split (`budget_split`) | 1 |
| `cmo.monthly_review` | Monthly marketing review | builder | review (`monthly_review`) | 2 |
| `cmo.campaign_calendar` | 30-day campaign calendar | builder | calendar (`campaign_calendar`, AI) | 3 |

## Tools

All read `files` (the member's CSV exports) like kpi; with none, the sample business. Outputs carry `sources`, `notes`, `sample`.

- **`cmo.whats_working`** (code): last full week against the 4 before. Posts scored by views and engagement against
  the same platform's median; ads by cost per result against the member's max cost per customer (typed, else their
  kpi scorecard target, else their own average, labeled); products by units against their usual for the same days.
  Reasons come from the same files (format, kind and time of day that do well for them, saves, follows, click rate,
  clicks that don't turn into results, a post or ad naming the product). out `findings` [{side, area, name, number, why}].
- **`cmo.plan_week`** (AI, task `plan`): 3 to 5 moves, each copying one finding's `number` exactly. Rejected and
  replaced by fixed rules when a move's number isn't a finding, or it fails the copy and claims checks.
- **`cmo.ad_calls`** (code): Pause, Fix, Keep, Scale or Too early per ad over the last 14 days, with the rule, the
  numbers, the step "if you agree" and the spend effect. Rules in `data/rules.json`.
- **`cmo.content_mix`** (code): 4 weeks by kind (caption words, `data/kinds.json`), format, weekday, time of day;
  next 2 weeks' mix (kinds at 0.75x usual or better keep a slot, none over half, one missing kind tried).
- **`cmo.offer_test`** (code): per-version sample size for two rates (95%, 80% power), days at the member's traffic
  (their ad clicks a day, or typed; else a table of traffic levels), the gap that counts, steps, tracking CSV.
- **`cmo.budget_split`** (code): campaigns over 28 days; shares move with cost per result against the yardstick,
  capped at 50% of the current share; nothing to campaigns that spent 3x with no results; 15% kept for tests.
  Spend effect per campaign; no results forecast.
- **`cmo.monthly_review`** (code): last full month against the one before (scaled to the same days), plus findings.
- **`cmo.campaign_calendar`** (AI, task `write`): 30 days in 5 phases on the member's best days, time and formats,
  weekly email idea on Tuesdays, an ad step on day 22 when they run ads. Template drafts with [brackets] stand when
  the AI is off or a draft fails a check.

## Legal L76 (handoffs/turnkey.md, Ads desk) as built

- **D3** `lib/claims.js` checks every AI draft and plan move on top of the kit copy rules: income claims,
  promised results, exact results in a set time, before-and-after for the body or health; "#1", "500+ customers",
  "5 stars", "best in town", "as seen on" only when the member typed them (their inputs, Brain business fields,
  or their own findings and captions). A promotion line or offer that breaks the hard rules is kept out of drafts
  or flagged with a note.
- **D7, D9** Calls and splits are suggestions with the change, the numbers and the spend effect; no automatic rules,
  no "approve all". The ad-calls yardstick is the member's own max cost per customer (typed or on their scorecard);
  without one, a real run asks for it. No advice touches targeting; the checks block under-18 and age, gender, ZIP,
  radius or lookalike narrowing.
- **D10** Only the member's own numbers, never pooled or compared with other businesses; no custom audiences,
  pixels, Conversions API, lookalikes or lead forms are suggested (blocked by the checks too).
- Tests in `test/cmo.test.js` cover each of these.

## AI and what is kept

- `plan_week` sends the AI: this week's findings (post captions up to 70 characters, ad, campaign and product
  names, aggregated counts and dollar totals) and one line about the business (name, what it sells, audience,
  city, voice). `campaign_calendar` sends: that business line, what is promoted, the website, the planned slots,
  and up to 3 of the member's own best captions (200 characters each). No customer names, emails or addresses.
- Kept: nothing. cmo writes no memory; it reads `brain.packs.kpi.scorecard` for the target.

## Sample data

The kpi sample (Juniper Lane Candles, made up, dates moved so the last day is yesterday). `sample/examples.json`
gives each workflow realistic inputs; `sample/brain.json` is the same business.

## Asks

- Kit: shared export readers (above).
- Harness: `suggestSchedule` weekly for `cmo.whats_working` once Shopify and the ad accounts are connected
  (left off now: a repeat would reuse the same uploaded files).
