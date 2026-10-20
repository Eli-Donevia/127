# Build a tool (`tools`)

Small internal apps for running the business: a member describes one (or picks a ready-made one) and gets a single HTML file with its CSS and JavaScript inside. It works offline on any phone, saves only in that browser (localStorage), loads nothing from outside and sends nothing anywhere. `held: true`: the harness registers the pack only when `PACKS_ON` names it.

## Workflows

| id | title | tier | minutes | steps | credits per run |
|---|---|---|---|---|---|
| tools.pick_starter | Pick a ready-made app | free | 3 | list (tools.list_starters) > choose (approve, max 1) > app (tools.fill_starter) | 2 |
| tools.build_from_description | Build a tool from a description | builder | 5 | plan (tools.plan_app) > app (tools.build_app) | 51 |
| tools.change_app | Change an app you built | builder | 3 | app (tools.change_app) | 50 |
| tools.csv_lookup | Turn a spreadsheet into a search app | builder | 3 | app (tools.csv_lookup) | 1 |
| tools.quote_calculator | Quote calculator from your price list | builder | 3 | app (tools.fill_starter, starter quote) | 1 |
| tools.simple_form | Make a simple form | builder | 3 | app (tools.fill_starter, starter form) | 1 |
| tools.booking_page | Make a booking request page | builder | 3 | app (tools.fill_starter, starter booking) | 1 |
| tools.client_portal | Make a client portal page | builder | 5 | app (tools.fill_starter, starter portal) | 1 |
| tools.check_app | Check an app for safety | builder | 2 | check (tools.check_app) | 1 |
| tools.put_online | Put your app online | builder | 5 | kit (tools.publish_kit) | 1 |

`put_online` ends with `next: site.quick_site`. The site pack exposes no generic "deploy a ZIP" tool, so this pack packs its own ZIP (index.html plus a `_headers` file that keeps the same lock-down online) and writes the Netlify Drop, Cloudflare Pages and GitHub Pages steps from `data/hosting.json` (the same facts and sources as the site pack's, checked 2026-10-19). The member does the upload.

## Tools

| tool | kind | credits | what it does |
|---|---|---|---|
| tools.list_starters | code | 1 | The 9 gallery apps with a one-line blurb, for the approve step. |
| tools.fill_starter | code | 1 | Builds one starter with the member's business name, services, prices, phone, email, link and color. |
| tools.plan_app | ai, extract | 1 | Reads the description into { starter, title, summary, questions }. Falls back to keyword matching. |
| tools.build_app | ai, write | 50 | Writes the app (up to 16,000 output tokens, 200 KB). The HTML must pass `lib/validate.js`; anything that fails, or no AI, returns the nearest starter with `sample: true` and the reason. |
| tools.change_app | ai, write | 50 | Applies a change to an uploaded app (.html or our ZIP). Our own apps can also change by rules (title, name, color, tax, deposit, prices, add or remove an item) when AI is off. Saved data keeps loading because the storage key stays. |
| tools.csv_lookup | code | 1 | A search app with the CSV's rows inside (5,000 rows, 12 columns, 1.5 MB). |
| tools.check_app | code | 1 | The validator on any uploaded app, with the problems in plain words. |
| tools.publish_kit | code | 1 | The ZIP, a printable how-to and what to keep off a public link. |

Credits: an app build or change sends up to about 30,000 input and 16,000 output tokens to the write model ($4 and $20 per million tokens): about $0.44 at most, so 50 credits. Planning is one small extract call.

## Starters (all tested in Chromium at 390 px: no console errors, no outside requests, no sideways scroll)

Job price calculator, quote calculator (tax, discount, deposit, saved quotes), booking request (writes a text or email the visitor sends from their own phone), client intake checklist, stock counter with a reorder list, tip splitter (by hours or even, cents split fairly), client portal page, mileage log (IRS business rate in `data/mileage.json`: 72.5 cents a mile before July 1, 2026 and 76 cents from July 1, 2026, checked 2026-10-20 on irs.gov), simple form (answers saved on the device; copy them or download a CSV; nothing is sent) and the CSV lookup.

## The safety check (`lib/validate.js`)

Refuses: outside scripts, stylesheets, fonts or images; `<link>`, `@import`, frames, `<base>`, meta refresh, forms that post anywhere, `javascript:` links, module scripts; in any script or inline handler: fetch, XMLHttpRequest, WebSocket, sendBeacon, workers, dynamic import, eval, `new Function`, string timers, document.write, cookies, redirects, outside URLs, image pings and reaching the parent window. Scripts must compile (checked, never run). Size cap 300 KB. Every app gets a Content-Security-Policy meta tag that blocks all outside requests (`connect-src 'none'`, `form-action 'none'`).

## Files a member gets

Apps ship as a ZIP (index.html, `_headers`, README.txt) because the Library previews HTML with scripts off, plus a `-preview.html` with scripts removed so the member can see it in the Library. Unzip and open index.html, or drag the ZIP onto Netlify Drop.

## Real vs sample

- Reads only what the member adds: the description, a price list, a CSV (`format: 'asset'`), an app file (.html or .zip). No outside services, no keys.
- With no AI the build returns the nearest starter, labeled `sample: true`, with the reason. `csv_lookup` without a file uses `sample/parts.csv` (fictional cleaning supplies) and says so. `put_online` without an app packs a sample booking page.
- Sample business (`sample/brain.json`): Lopez Home Repair, Tucson AZ, lopezhomerepair.example (fictional).

## Kit asks

1. `ai.aiJson` runs `deepPlain` on every string, which changes code (dashes, backticks, markdown-like text). The pack captures the raw HTML inside `accept`. A kit `aiRaw` (or `{ raw: true }`) for code and HTML would make that clean.
2. The Library previews HTML with scripts off, so apps ship zipped. A Library "open this app" view with the app's own CSP would let members tap and use them.

## Run it

```
node dev/run.js tools.pick_starter --out /tmp/tools-work/out
node --test packs/tools/test/tools.test.js
```
