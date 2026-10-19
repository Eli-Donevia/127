# Brand kit (`brand`)

Name the business, check domains, then colors, six logo concepts, a voice guide, a social profile kit and one printable brand sheet. Or refresh the look of the website the member already has, make a welcome kit for new customers, and write the operations manual a helper can follow. Every output is a file the member owns. No API keys needed: AI tools fall back to templates built from the member's facts; drawing tools render PNGs with ffmpeg (librsvg) when the run allows `render` and always ship the SVGs in a zip.

## Workflows

| id | title | tier | minutes | steps | credits per run |
|---|---|---|---|---|---|
| brand.name_my_business | Name your business | free | 5 | ideas (brand.name_ideas) > domains (brand.check_names) > pick (approve, max 3) | 7 |
| brand.make_my_kit | Make my brand kit | builder | 10 | colors > logos > pick (approve, 1 concept) > voice > social > sheet | 17 |
| brand.logo | Six logo concepts | builder | 3 | colors > logos | 6 |
| brand.social_profiles | Set up your social profiles | builder | 5 | colors > voice > social | 11 |
| brand.refresh | Refresh your brand from your website | builder (job site) | 10 | scan (brand.read_site) > pick (approve, 1 direction) > make (brand.refresh) | 6 |
| brand.onboarding_kit | Make a welcome kit for new customers | builder (job ops) | 8 | draft (brand.welcome_steps) > pick (approve, keep up to 8 steps) > make (brand.welcome_kit) | 3 |
| brand.ops_manual | Write your operations manual | builder (job ops) | 10 | manual (brand.ops_manual) | 4 |

Workflow inputs (required marked *): name_my_business `what, city, keywords, founder`; make_my_kit `name*, what, city, color`; logo `name*, what, city, color`; social_profiles `name*, what, city, color, concept` (monogram, mark, wordmark, icon, seal, stacked). refresh `url, name, what, city, color` (an empty or `.example` url reads `sample/site.html`, a made-up detailing site, and every output says sample); onboarding_kit `name, what, service, steps, prepare, policies, phone, email, hours, customer, when, city` (all optional); ops_manual `jobs, hours, tools, contacts, rules, who (helper, me), name, what, city` (jobs one per line as "Name: how you do it"; voice-note transcripts work). `color` is a hex (`#c2410c`) or a mood: bold, calm, warm, fresh, premium, playful, earthy, clean.

## Tools

| tool | kind | credits | input (* required) | output |
|---|---|---|---|---|
| brand.name_ideas | ai, tasks write | 6 | what, city, keywords, founder, count (default 12) | `names` [{name, why, style}], `ai` |
| brand.check_names | api (RDAP) | 1 | names* [{name} or string], tlds (default com, co) | `names` [{name, why, style, domains {com, co: {domain, status}}, best}], `open`, `checked` (false offline, with `sample: true`) |
| brand.palette | code, wants render | 2 | name, what, color | `palettes` (3, each colors{primary,onPrimary,accent,onAccent,ink,paper,surface,muted,line} + WCAG checks + css), `seed`, `mood`, `board` (PNG or null), `zip` (colors.svg, .css, .json, .png) |
| brand.logo_concepts | code, wants render, timeout 180 s | 4 | name*, what, city, color, palette (a palette step output) | `concepts` [{id, n, title, note}], `overview` (PNG), `preview` (HTML when no render), `zip` (per concept: color, white and one-color SVG, 512 mark SVG, 1080 PNG, 64 favicon PNG, plus how-to-use.txt) |
| brand.voice | ai, tasks write | 6 | name, what, city, tone (friendly, premium, playful, straight, calm), palette | `voice` {tone, words, do, dont, lines, captions, about, taglines, pitch, signoff, bios}, `guide` (HTML), `doc` (.md), `ai` |
| brand.social_kit | code, wants render | 3 | name*, what, city, color, concept, palette, voice | `bios`, `concept`, `profile` (1080 PNG), `zip` (profile SVG and PNG, 5 highlight covers SVG and PNG, bios.txt), `covers` |
| brand.sheet | code | 2 | name*, what, city, color, concept, palette, voice | `sheet` (printable HTML, no scripts), `concept`, `name`, `notYet` |
| brand.read_site | code | 2 | url, name, what, color | `site` {url, domain, title, description, h1, platform, mobileReady, favicon, stylesheets, words}, `current` {primary, accent, ink, paper, found}, `fonts`, `checks` (text pairs from the page's CSS with WCAG ratio, floored for show and compared unrounded), `issues`, `issueKeys`, `options` (3: your colors fixed, your main color with a new accent, a fresh start; each with colors, checks, css), `sample` |
| brand.refresh | ai, tasks write, wants render | 4 | site* (a read_site output), palette (the chosen option), name, what, city | `chosen`, `taglines`, `updates` (where to update, in order, with cost and time), `board` (1080x1350 before and after PNG or null), `page` (printable HTML), `zip` (colors.css, colors.json, the board SVG and PNG, logo, white logo and square mark SVGs, taglines.txt), `ai` |
| brand.welcome_steps | code | 1 | name, what, steps, prepare | `steps` [{id, n, title, detail}] (the member's lines, or starting points for their kind of business), `prep`, `group` (onsite, visit, online, lessons, orders, events), `stepsFrom`, `prepFrom` |
| brand.welcome_kit | code | 2 | steps (the kept ones), prep, group, name, what, city, service, customer, when, policies, phone, email, hours, palette | `guide` (printable HTML), `messages` (.txt: welcome email, booking text, reminder the day before, after the visit), `email` {subject, body}, `texts`, `policies` (only what the member typed), `missing` (what to add: name, policies, contact) |
| brand.ops_manual | ai, tasks write | 4 | jobs, hours, tools, contacts, rules, who, name, what, city, palette | `jobs` [{name, time, steps}], `rules`, `decide` (decisions still to make), `tools`, `contacts`, `page` (printable HTML), `doc` (.md), `starting` (true when there were no job notes), `ai` |

## Real vs sample

- brand.read_site reads one public page of the member's own site plus up to 3 of its stylesheets, through the kit's web helpers (robots.txt respected). Colors and fonts are only what the page's code sets; a site builder may set more, and the page says so. A real refresh remembers the new colors (`colors`, `primary`) for brand.palette (which then offers them first), the email, DM and ads pages. A sample run remembers nothing. Text with no background of its own is only checked on the page color when it sits on the page and is not light, and share-button rules are left out, so a header link is never reported as white on white.
- brand.welcome_kit uses only the policies, phone, email and hours the member typed; without them the guide leaves the section out and the view says what to add. The suggested steps and get-ready tips are starting points by kind of business, and the member keeps the ones that fit in the approve step. The email is a transactional welcome to someone who booked, so it ends with the member's name and business, with no opt-out line.
- brand.ops_manual: jobs, rules, tools and contacts are the member's own words, split into one action per step (filler like "um" and "you know" dropped; "It takes about 3 hours" becomes the job's time). AI may tidy the steps, and its answer is used only when every step's words come from the notes. The weekly routine, the "decide these" list and what to do when something goes wrong are labeled starting points.
- What the business sells comes from the tool input, then the brain's `what`, `niche` and `offer`. An onboarding category ("Local service", "Online business") names no business: it never feeds name ideas (they ask what you sell instead), the line under a logo, the welcome messages or the manual's job names, which read "Thanks for booking with us" and "A typical job" rather than leave a blank. The voice and the brand sheet may still say "local service" or "small business" as the label.
- Domain checks are live RDAP lookups (24 for 12 names) when the run has network; offline they say "unchecked", never "open". Checked live in the harness engine on 2026-10-19.
- Bio limits come from `data/platforms.json`: Instagram 150 characters (published), TikTok and Facebook have no published limit we could find, so bios are kept under our own targets (80 and 100). Each entry has its source URL and `checked: 2026-10-19`.
- Names are screened for length, filler words, big brand names and copy rules; the trademark search is linked (tmsearch.uspto.gov), not run.
- Logos are drawn as real vector paths (stroke alphabet in `_kit/svg.js`), so SVGs work without fonts.

## Not yet (pack `notYet`)

1. Don't spend days on a logo before your first yes. Pick one of these, use it, and change it later if customers ask.
2. Don't pay for a trademark filing, a logo designer or printed merch until people are paying you.
3. Don't buy ten domains or build a full website yet. One domain and a simple page are enough to start.

## Run it

```
node dev/run.js brand.make_my_kit --out /tmp/brand-work/out
node --test packs/brand/test/brand.test.js
```
