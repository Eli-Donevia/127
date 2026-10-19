# site: Site in a night

A member with no website gets a fast, good-looking one-page site built from their real services,
prices, hours and contact details, zipped for Netlify Drop with plain deploy steps, live tonight on
free hosting. Static HTML and CSS only (no scripts except JSON-LD), mobile first, about 30 to 40 KB
per page before images, CSS-only mobile menu, Netlify Forms with a mailto fallback.

## Workflows

| id | title | tier | credits | steps |
| --- | --- | --- | --- | --- |
| site.quick_site | Your website in 5 minutes | free | 4 | pick_template, build (best design, written words) |
| site.build_tonight | Build your website tonight | builder | 10 | pick_template, choose design, write_copy, review words (edit), build |

Both take the same inputs (all optional except a name and what they do; the brain fills gaps):
business, what, city, services, menu, phone, email, hours, address, area, booking, order, included,
promise (the member's own words, shown as written), tagline, about, owner, reviews (real quotes only), work (portfolio pieces), clients (names the member
may show), instagram, color, domain, form (netlify | email), design (local-service | studio |
restaurant | coach | portfolio).

## Tools (inputs and outputs)

- `site.pick_template` (code, 1 credit). In: `{ facts: object, prefer?: string }`. Out:
  `{ business, best: { id, name, why, bestFor }, designs: [same, best first] }`.
- `site.write_copy` (ai, tasks ['write'], 6 credits). In: `{ facts, design: id | design object | [design] }`.
  Out: `{ design, copy: { heroTitle, heroSub, about, services: [{ name, blurb }], steps: [{ title, body }],
  faq: [{ q, a }], ctaTitle, ctaSub, seoTitle, seoDescription }, items: [{ key, label, text }], ai }`.
  `items` is what the review step edits (keys heroTitle, heroSub, about, services as "Name: line",
  steps as "Title: body", faq as "Q:/A:" lines, ctaTitle, ctaSub, seoTitle, seoDescription).
  AI drafts must pass `lib/copy.guardProblems` (no numbers, reviews, ratings, awards, years,
  guarantees or results the member did not give) or the written template is used.
- `site.build` (code, 3 credits, wants ['render'] for JPG/PNG via ffmpeg). In: `{ facts, design, copy?:
  items | copy object, for?: 'me' | 'prospect' | 'client', maker?: string, note?: string }`. Out: `{ mode,
  business, design, designName, siteUrl, zip, preview, shareImage, files: [names], stats: { htmlBytes,
  cssBytes, zipBytes, files, images }, rendered, share: [{ label, text }], photos: [{ file, size, alt }] }`.
  Saves `<slug>-website.zip`, `<slug>-preview.html` and `<slug>-share.png`. Remembers `site: { url,
  design, built }` (own sites only).

### Who the site is for (`for`)

- `me` (default): the member's own site. Gaps are filled from their brain (name, what, city, price,
  links, owner's first name) and a brand color another pack saved.
- `prospect`: a free sample for a business the member pitches (webdesign's mock homepage, any spec
  site). Only the facts passed in: nothing from the member's brain or brand memory fills a gap. A
  plain note sits at the top of the page ("Sample homepage for X, made by Y on Oct 19, 2026. It is
  not their live website."; `note` replaces it, `maker` names who made it, default the member's first
  name and business). The page carries `noindex`, robots.txt disallows everything, JSON-LD stays (it
  shows the business details Google would read). README.txt says to check every line, show it
  rather than publish it, and rebuild it as a client site after a yes. Files are
  `<slug>-sample-website.zip` and `<slug>-sample-preview.html`; no share image; nothing remembered.
  The view shows the sample page, the ZIP, the photos to ask for and one short note to send with it.
- `client`: a paying client's site (webdesign's first draft after a yes). Only the facts passed in, no
  sample note, indexable. README.txt says to set it up on the client's own Netlify account, domain
  and email so they own it. Nothing remembered.

Never pass Google Places fields (name, phone, rating) as facts for a prospect: names and facts come
from the business's own website, an OpenStreetMap listing, or what the member typed.

ZIP contents (at the root, ready for Netlify Drop): index.html, thanks.html (form success page),
404.html, images/*.jpg (abstract placeholders in the member's colors, never stock people),
og-image.png and .svg (1200 x 630), favicon.svg, favicon.ico, apple-touch-icon.png, robots.txt,
sitemap.xml, _headers, README.txt (Netlify Drop steps, form switch-on, photo list with sizes and alt
text, free limits with sources, Cloudflare Pages and GitHub Pages notes, own domain).

## For other packs (compose the designs)

In a workflow, compose the tool: `{ tool: 'site.build', input: { facts: {...}, design: 'portfolio',
for: 'me' } }` (or `for: 'prospect'` with the prospect's facts). In code, from a tool file in another
pack (paths relative to `packs/<pack>/tools/`):

```js
const { factsFrom } = require('../../site/lib/facts');     // (ctx, input, { own = true }) -> plain facts
                                                          // own: false = only the input, never the brain
const { draftCopy } = require('../../site/lib/copy');       // (facts, designId) -> copy
const { buildSite } = require('../../site/lib/site');       // (ctx, { facts, template, copy, render,
// mode: 'me' | 'prospect' | 'client', maker, sampleNote }) ->
// { c, files: [{ name, data, text }], zip, preview, ogPng, ogSvg, rendered, stats }
const { TEMPLATES } = require('../../site/lib/templates');  // [{ id, name, bestFor }]
const { rankTemplates } = require('../../site/lib/pick');   // (facts, { prefer, only }) -> ranked
```

Designs in this version: local-service (trades and mobile services: prices with "What's included"
from `included`, the member's `promise` beside the quote form, area, hours),
studio (salons, barbers, spas: menu with durations, gallery, visit), restaurant (food and drink:
menu with diet tags, order and reserve links, catering form), coach (coaches and tutors: offer,
what's included, how it works, book a call), portfolio (photographers, UGC creators, video editors,
designers: the work first). Planned and cut for time: product, creator (link in bio), agency;
pick.js folds those niches into the closest design. Audit and redesign workflows were not built in
this version.

### The portfolio design

Order: a short statement (headline from `what`, the owner's first name, city, "From $X" from the
lowest price), then Selected work, Made for (only when `clients` is given), What I offer (services
with prices and "Every project includes" from `included`), About (a portrait spot and the member's
words), How it works (4 steps: details, plan and price in writing, the shoot or first version, files
with usage in writing), real quotes (only when given), FAQ, and a project form (with the member's
`promise` beside it when given; name, email,
business or brand, what they need, date or deadline, the project).

- `work`: one piece per line, `Title | what it was | https link` (detail and link optional, up to 9).
  Each piece gets a photo spot (`images/work-1.jpg`...) with its title and detail as the caption and
  the alt text; a TikTok, Instagram, YouTube or Vimeo link shows "Watch on TikTok" and so on. With no
  work given, 6 placeholder spots show with no captions, their alt text from the niche's gallery list.
- `clients`: names the member may show, one per line (only those who said yes to being named).
- The grid is 3 columns wide and 2 on phones, and always ends on a full row (the first piece spans
  two columns when needed). README.txt lists every photo file with its size and what it should show.
- Photographers, video editors, designers and UGC creators get it first from `rankTemplates`
  (lib/niches.js). Pass `design: 'portfolio'` to force it. UGC: put each video's link in `work`.
- Business photographers ("business", "commercial", "food", "brand" or "headshot photography") get
  their own placeholder list (a dish for the menu, the storefront, a team headshot...); `photo.ready`
  builds this page from the photographer's real prices.
- Service lines: a time counts as the duration only on its own ("Dog walk, 30 min", "Cut (45 min)",
  "2 hours on site"); inside a phrase ("up to 2 hours at your place") it stays in the text. Units
  include "a person", "a month" and "a property".

## What's real and what's sample

- Real: everything on the page comes from the member's inputs and brain. Hosting facts in
  data/hosting.json (Netlify Drop and Forms, free plan credits, Cloudflare Pages, GitHub Pages) were
  checked 2026-10-19 with source URLs. Schema.org types in data/schema-types.json.
- Never invented: reviews (only quotes the member pastes), ratings, years, client counts, results.
  No reviews given means no reviews section.
- Sample: sample/examples.json (fictional businesses, .example domains). Placeholder photos are
  abstract art the member replaces.
- No keys needed. With no AI key, write_copy uses the written templates (varied per business).
  Without ffmpeg the images and share image stay SVG and the README says how to swap them.
- No network calls, so there is no --live run for these two workflows.

## Checks

`node dev/lint.js site`, `node --test packs/site/test/site.test.js` (offline: every design, the
portfolio grid and captions, prospect and client modes), `node dev/run.js site.quick_site --example
--out /tmp/site-work/out`, and the harness engine (`cli.js run`) for both workflows. Every design was
rendered with Playwright at 390 and 1280 px and reviewed (portfolio and the prospect sample on Oct 19).
