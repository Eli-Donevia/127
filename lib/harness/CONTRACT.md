# How a workflow plugs into the 127 harness (contract v1.2)

Owner: Harness v2 thread. Version 1.2, 2026-10-19 (v1 and v1.1 were earlier the same day; section 0
lists what changed). Applies to every pack. The copy pack authors read is `/mnt/project-files/v2/harness/WORKFLOW-CONTRACT.md`;
the site keeps the same file at `lib/harness/CONTRACT.md`.

The idea in one line: a **pack** is one folder of plain Node code that gives the harness some **tools** and some **workflows**. The harness does everything else: the form, running steps in the background, picking the AI model, the member's approvals, the Pipeline, files, credits, the HQ screens, and the same workflows inside Claude and ChatGPT (the member's AI link).

Code: CommonJS, Node 20, no new npm packages without telling the Harness thread (system tools like `ffmpeg` are declared, see 7).

## 0. What changed since v1

**In v1.2:**

- **Emails** (Legal L55): Do my day ends every email it hands out, first messages, follow-ups and answers alike, with the member's name, business, mailing address and a "no thanks" line, and takes those lines off the Instagram, Facebook and call versions. Write each message once (section 13).
- **Leads:** `repliedAt`, and `answered: true` or `answeredAt` when your workflow logs the member's answer (section 13). Messages keep their line breaks.
- **Keys:** `osm`, the OpenStreetMap servers First 25 also reads (section 6). The brain has `business.address` (section 6b).
- **Google Places:** the engine drops Google's fields at any depth of a lead's `data`, not only the top (section 6).
- **Keys in errors:** step errors, `ctx.log` lines and the server log keep only a URL's scheme and host and hide key-like values (section 6).

**In v1.1:**

- **Loader.** Folders starting with `_` or `.` are skipped (put shared helpers in `_kit`), and so is any folder whose `index.js` doesn't export a pack with an `id`. Every pack's tools load before any workflow is checked, so a workflow can use another pack's tools; no `uses` list is needed (an extra `uses` key is ignored). A workflow whose tools come from a refused pack is dropped, with the reason logged.
- **Tools:** `wants`, `tasks`, `viewMany`, `lane`, output `flags`, the 256 KB output cap, and `sample: true` on an output (section 3).
- **Workflows:** `job`, `starter`, `proof`, `hidden`, `next` with reasons, and on steps `title`, `estimate` and `optional` (section 4). File inputs (`format: 'asset'`) and Pipeline inputs (`options: 'pipeline'`) (section 4b).
- **ctx:** `ctx.asset(id)` and `ctx.leads.list / get / update`; leads carry messages and facts for Do my day (sections 7 and 13).
- **Keys:** `hunter`, `transcribe` and `gemini` added; `places` reads `GOOGLE_PLACES_API_KEY`, `PLACES_API_KEY` or `GOOGLE_PLACES_KEY` (section 6).
- **Credits:** proposed allowances are now Free 50, Builder 1,000, Circle 3,000; sample output and failed steps cost nothing (section 8).
- **Files:** more types (svg, ics, vcf, vtt, srt, mov, Shopify `.liquid`), 25 MB a file, members add their own (section 12).
- **Testing:** `lib/harness/testing.js` and the CLI are real (section 9).
- **Router:** there is no batch lane yet; `deep` is Circle only (section 11).
- **Google Places (Legal L53):** a Google business is saved by its place ID only; the engine drops Google's fields and HQ fetches the name when it's shown (sections 6 and 13).
- **Files a run makes** are kept even past the member's Library space, so a run never stops halfway; files a member adds must fit (section 12).

## 1. Folder

```
<your folder>/pack/
  index.js          the pack (section 2)
  tools/*.js        one tool per file is easiest to review
  sample/*.json     sample data used when a key or connection is missing (section 6)
  test/<pack>.test.js   node:test, runs with no keys and no network
```

In the site it becomes `lib/packs/<pack-id>/`, and shared helpers go in `lib/packs/_kit/`. The harness loads every `lib/packs/*/index.js` at boot and refuses a pack that breaks this contract (it logs why); the rest still load.

## 2. The pack

```js
module.exports = {
  id: 'gym',                                  // 2 to 30 of a-z, 0-9 and -, unique; prefixes every tool and workflow name
  title: 'Video editing for local gyms',
  version: '0.1.0',
  summary: 'Find gyms, show them what better video looks like, and write the messages to send them.',
  niches: ['video editing', 'gyms', 'fitness', 'local business'],  // matched against the member's business on Start
  system: ['ffmpeg'],                         // optional, informational: what the server must have installed
  tools: [require('./tools/find-gyms'), /* ... */],
  workflows: [/* section 4 */],
};
```

## 3. A tool

```js
module.exports = {
  name: 'gym.find_gyms',            // '<pack>.<verb_noun>', 2 to 40 of a-z, 0-9 and _ after the dot
  title: 'Find gyms near you',      // what the member reads, 2 to 5 words
  description: 'Lists gyms and studios in a city with their website and Instagram.', // also read by AI (Claude, ChatGPT)
  kind: 'api',                      // 'code' (pure code), 'ai' (calls ctx.ai), 'api' (calls an outside service)
  risk: 'read',                     // 'read' | 'draft' | 'act' (section 5)
  needs: ['places'],                // keys it can't work without; a missing one means sample mode (section 6)
  wants: ['hunter'],                // optional: keys it uses when they're set and works without
  tasks: ['score', 'write'],        // optional: the kinds of AI call it makes, so HQ can show which model does what
  credits: 2,                       // what one call costs the member, 0 to 500 (section 8)
  lane: 'render',                   // optional: heavy work (video) runs in the render lane, one at a time server-wide unless HARNESS_RENDERS_AT_ONCE says more. Tools that need 'render' go there anyway.
  input: {                          // JSON Schema (subset, section 4b)
    type: 'object',
    properties: { city: { type: 'string', title: 'City' }, limit: { type: 'integer', minimum: 1, maximum: 60, default: 40 } },
    required: ['city'],
  },
  output: { type: 'object', properties: { gyms: { type: 'array' } }, required: ['gyms'] },
  timeoutSec: 120,                  // optional, default 120, up to 900 for rendering
  async run(input, ctx) {
    ctx.log(`Looking for gyms in ${input.city}`);
    return { gyms: [/* ... */], sample: ctx.sample };
  },
  view(output) { return [{ type: 'table', columns: [{ key: 'name', label: 'Gym' }], rows: output.gyms }]; }, // optional (section 10)
  viewMany(outputs) { /* optional: one view for every item of an each step, like one ranked table instead of 40 cards */ },
};
```

Rules:
- `run` gets input that already passed `input` validation, with defaults filled. Return plain JSON (no class instances, no Buffers; save files with `ctx.save`). **At most 256 KB**: big results belong in a file.
- The output must match `output`. Under `NODE_ENV=test` (and `HARNESS_STRICT=on`) a mismatch fails the step; in production it's logged. A field that is sometimes missing should be left out, or typed `['object', 'null']`.
- **`sample: true` on an output means the result is sample data: it costs the member no credits** and HQ marks it "Sample data". Set it whenever you fall back to sample data, a template instead of AI, or a stand-in answer. The harness's own stand-in AI answers (no key, `HARNESS_AI=off`) carry `sample: true` too; keep passing it through.
- `flags: ['under18']` on an output (an AI answer's under-18 marker) pauses the member's account for review (Legal L42). Only the model's marker, never keyword guesses.
- Re-running a tool with the same input must be safe. The engine re-runs an unfinished step after a restart.
- Throw an `Error` with a member-readable message when something fails ("Google didn't answer, try again in a minute"). The engine records it on the step; in an `each` step one failed item doesn't fail the others.
- Plain text in anything a member reads: no markdown, no em dashes, no income claims, never Eli's figures, no time-saved claims (voice guide 7 and 15, Legal L12, playbook 1.4). The member is the sender of anything they send, never Eli.

## 4. A workflow

```js
{
  id: 'gym.first_clients',
  title: 'Find gyms and write your first messages',
  promise: 'A ranked list of gyms near you, 3 sample videos and the messages to send them.', // the card's one line
  proof: 'A ranked list of 25 gyms, 3 spec videos and every message written', // optional: "You get" on the workflow page
  minutes: 20,                      // honest member time, not machine time
  tier: 'builder',                  // 'free' | 'builder' | 'circle'
  job: 'leads',                     // optional: offer, leads, content, sales, ads, site, money or ops (guessed from the words if left out). Start groups by job and puts the member's bottleneck first.
  starter: true,                    // optional: a good first workflow for a new member of this niche
  hidden: false,                    // optional: true for workflows HQ starts itself (section 4c)
  inputs: { type: 'object', properties: { city: { type: 'string', title: 'Your city' } }, required: ['city'] },
  steps: [
    { id: 'gyms',   tool: 'gym.find_gyms', input: { city: '$inputs.city', limit: 40 } },
    { id: 'scores', tool: 'gym.score_content', each: '$gyms.gyms', input: { gym: '$item' }, concurrency: 4, estimate: 40 },
    { id: 'gaps',   tool: 'gym.find_gaps', input: { gyms: '$gyms.gyms', scores: '$scores' }, title: 'Find what each gym is missing' },
    { id: 'pick',   approve: { title: 'Pick up to 3 gyms to pitch', choose: '$gaps.ranked', label: 'name', max: 3 } },
    { id: 'videos', tool: 'gym.spec_video', each: '$pick.chosen', input: { gym: '$item' }, estimate: 3 },
    { id: 'msgs',   tool: 'gym.write_outreach', each: '$pick.chosen', input: { gym: '$item', video: '$videos.$index' } },
    { id: 'check',  approve: { title: 'Read your messages before you send them', items: '$msgs', edit: 'text' } },
    { id: 'wait',   wait: { days: 3 } },
    { id: 'nudge',  tool: 'gym.follow_up', input: { leads: '$pick.chosen' }, when: '$check.approved', optional: true },
  ],
  result: ['gaps', 'videos', 'msgs'], // steps whose views make the finished summary
  next: [{ id: 'gym.weekly_content', why: 'Clients signed: keep them posting.' }], // or plain ids
}
```

**References.** A string that is exactly a reference is replaced by the value: `$inputs.<path>`, `$<stepId>` (that step's output) or `$<stepId>.<path>`, `$item` and `$index` inside `each`, `$brain.<path>` (section 6b), `$member.firstName`. Paths use dots, and numbers index arrays (`$gyms.gyms.0`, `$videos.$index`). `$$` is a literal `$`. Anything else is a plain value. Build sentences inside tools, not in references.

**Step kinds.** Up to 30 steps.
- `tool`: runs one tool. With `each: '<ref to an array>'` it runs once per item (`concurrency` default 3, max 8) and its output is an array in item order; a failed item is `{ error: '...' }`. `estimate`: how many items you expect, for the credit estimate on the Run button when the list doesn't exist yet.
- `approve`: pauses the run and puts a card in the member's Inbox (HQ, the Monday email, and Claude or ChatGPT through their AI link, which can answer choose and draft cards but never approve an `act` step). `choose` + `max` lets them pick items, `items` + `edit: 'text'` lets them read and edit drafts. Output: `{ approved: true, chosen: [...], items: [...edited] }`, or `{ approved: false }` if they skip, which stops the run unless the step has `optional: true`. An approve with nothing to show fails the run, or is skipped when `optional`.
- `wait`: `{ days | hours }`, 1 hour to 30 days. The run sleeps and resumes on its own, even after restarts.
- `when: '<ref>'` on any step: skipped (output `null`) unless the value is truthy.
- `optional: true` on a tool step: if it fails, the run notes it and goes on (output `null`).
- `title` on any step: what the plan shows instead of the tool's title.

Runs persist step by step, so the member can close the page and come back. Statuses: `queued`, `running`, `waiting` (on them), `sleeping` (a `wait`), `done`, `failed`, `stopped`. A member runs up to 3 at once (`HARNESS_MAX_ACTIVE_RUNS`).

### 4b. Inputs

JSON Schema subset: `type` (or a list of types), `properties`, `required`, `items`, `enum`, `const`, `anyOf`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` (`uri`, `email`, `date`, `textarea`, `asset`), `title`, `description`, `default`. No `$ref`. HQ builds the form from it: `enum` is a select, booleans a checkbox, numbers a number field, arrays a comma list, `format: 'textarea'` (or `maxLength` over 400) a text box.

- **A file the member adds:** `{ type: 'string', format: 'asset', title: 'Your video', accept: 'video/*' }`, or a list: `{ type: 'array', items: { type: 'string', format: 'asset' }, accept: '.csv,.vcf' }`. `accept` works like `<input accept>`. HQ shows the member's Library files that fit, with "Add a file" right there; the value is a Library file id, checked to be theirs before the run starts. Read it with `await ctx.asset(id)`. Don't take files as `type: 'object'`, data URLs or base64: they can't be uploaded and they bloat the run. A public `https` link is fine as a second option (`format: 'uri'`, fetched with `ctx.fetch`).
- **A business from the member's Pipeline:** `{ type: 'string', title: 'Which gym', options: 'pipeline' }`. HQ suggests the names in their Pipeline (lost ones left out) and still takes a typed name; the value is the name. Find it with `ctx.leads.list({ all: true })`.

### 4c. Hidden workflows

`hidden: true` workflows are started by HQ itself (Do my day's "Write it for me", call prep, Monday's card). They have no page, aren't on Start or the AI link's list, and never use a Free member's free run.

## 5. Risk, and the one hard rule

- `read`: looks things up. `draft`: writes something for the member to check. Both run without asking.
- `act`: anything that reaches a customer, posts, spends money or makes a promise (send an email or DM, publish a post, book, charge). **An `act` step must come after an `approve` step and run on what it approved: `{ tool: 'x.send', each: '$check.items', approvedBy: 'check' }` (or `'$check.chosen'`).** The engine refuses the workflow at load time otherwise, and refuses the call at run time if that approval isn't `approved: true`. A member's AI can't give that approval. This is Eli's rule: a human approves anything that reaches a customer, moves money or makes a promise.
- v2.0 ships no `act` tools: messages are drafts the member copies, or opens in their own Gmail or Instagram with one tap. Sending from 127 comes later, with Legal.

## 6. Keys, sample data and the business brain

**Keys.** `needs` and `wants` name a key or connection. Known now (ask the Harness thread for more):

| name | what | read from |
|---|---|---|
| `places` | Google Places (127's account) | `GOOGLE_PLACES_API_KEY`, `PLACES_API_KEY` or `GOOGLE_PLACES_KEY` |
| `osm` | OpenStreetMap: an Overpass and a Nominatim server, 127's own or paid (the public ones are for testing only) | `OSM_OVERPASS_URL` + `OSM_NOMINATIM_URL`, read as `{ overpass, nominatim }` |
| `instagram` | Instagram Business Discovery (127's account) | `IG_ACCESS_TOKEN` + `IG_USER_ID` |
| `youtube` | YouTube Data API | `YOUTUBE_API_KEY` |
| `pexels` | Pexels stock video | `PEXELS_API_KEY` |
| `voice` | Text to speech | `ELEVENLABS_API_KEY` |
| `hunter` | Hunter email finder | `HUNTER_API_KEY` |
| `transcribe` | Speech to text (Deepgram) | `DEEPGRAM_API_KEY` |
| `gemini` | Google AI images, music and short video | `GEMINI_API_KEY` |
| `render` | `ffmpeg` on the server | `FFMPEG_PATH` or `ffmpeg` on the path |
| `stripe`, `shopify` | the member's own HQ connections | not wired into packs yet: always sample |

Read one with `ctx.secret('places')` (only names you declared). Never log it, put it in output, or send it anywhere but its own service. A server's error can echo the request, key and all (Tracestrack puts it in the path, LocationIQ in `?key=`, the Graph API in `access_token`), so the engine keeps only the scheme and host of any URL in your step errors, `ctx.log` lines and the server log, and hides key-like values. Scrub what you save in outputs yourself. Keys are 127's accounts, set by Eli in the server's secrets; packs never ask members for keys.

**Sample mode.** If any `needs` entry is missing, `ctx.sample === true` (and on an admin's sample run). The tool must still work: return realistic data from `sample/` and set `sample: true` on the output. A missing `wants` key doesn't turn sample mode on; work without it.

**Google Places terms** (Legal L53; `legal/handoffs/first-25.md` part 1 and `gym-video.md` part 3). 127 may keep a place ID for as long as it likes, and nothing else from Google: not the name, address, phone, website, rating, review count or Maps link, in the Pipeline, `ctx.remember`, `ctx.cache`, a saved file or an export.

- Save a Google business with `key: 'gplaces:<place id>'` (or `placeId`), plus your own work: scores, gap ids, what you found on the business's own website (its Instagram, Facebook, email), and your messages. The engine enforces it on every `ctx.leads.upsert` and `update`: it drops Google's fields (name, address, phone, website, rating, `lat`, `lon` and the like) at any depth of `data`, swaps any Google name in your messages, facts, note and data for `[business name]`, and drops facts and data lines that quote Google's numbers. Under `site`, `contact`, `owner`, `people`, `insta`, `touches` and `followUps`, people's names you found on the business's own site stay.
- When a tool reads a Google lead (`ctx.leads.get / list`), its name is `[business name]`. Write messages with that placeholder; HQ fills it in with the name it fetches when the member opens the lead, and the placeholder keeps Copy off until then.
- Keep Google's ratings and review counts out of messages. Use a Google name in this run's own output only (what the member sees right now), never in what you save.
- Spreadsheets and other files you save leave out every Google field; a Maps link built from the place ID (`https://www.google.com/maps/search/?api=1&query=<words>&query_place_id=<id>`) is fine.
- Show "Google Maps" (or Google's logo) wherever Google results show, plus any provider names Google returns.
- OpenStreetMap results can be stored for the list's life, with the OSM credit.

**6b. The business brain.** `ctx.brain` is a read-only snapshot of what 127 knows about the member's business:

```js
ctx.brain = {
  business: { name, what, niche, offer, price, audience, city, region, country, timezone, stage, address },
  voice: { tone, avoid },
  links: { website, instagram, tiktok, youtube, booking },
  goal: { northNumber, buildTarget },
  numbers: [{ week, label, value }],       // last 4 weeks from HQ, if any
  packs: { gym: { /* what this pack saved, see ctx.remember */ } },
}
```

Every field can be missing; check before use. `address` is the member's mailing address for email footers; Do my day adds it for you (section 13). A pack saves its own facts with `await ctx.remember('offer_price', 450)` (stored under `brain.packs.<pack id>`, visible to the member).

## 7. The ctx a tool gets

| | |
|---|---|
| `ctx.member` | `{ id, firstName, tier, timezone }`. Never the email. |
| `ctx.inputs` | The workflow's form values. |
| `ctx.brain` | Section 6b. |
| `ctx.sample` | Section 6. |
| `ctx.index` | The item's position inside an `each` step. |
| `await ctx.ai({ task, system, prompt, images, schema, maxTokens })` | One AI call. The harness picks the model from `task` (section 11), adds caching, counts the cost and retries once on a stronger model if a `schema` answer doesn't validate. Returns `{ text }`, or `{ data }` with a `schema` (JSON Schema, object at the top). `images`: `[{ type: 'image/jpeg', data: <base64> }]`. A stand-in answer (no key, AI off) has `sample: true`. |
| `await ctx.fetch(url, options)` | `fetch` for public web addresses only (private and local addresses refused on every redirect), with a timeout (`timeoutMs`, default 20 s, max 60), 8 at once per member and 2,000 per run. |
| `ctx.secret(name)` | Section 6. |
| `await ctx.spend(usd, what)` | Record a paid outside call so per-member cost is known. Spending stops at $3 a run and $100 a day across everyone (Eli's budget), with alarms at 50% and 80%. |
| `await ctx.save(name, data, { type })` | Saves a file to the member's Library (section 12). Returns `{ id, url, name, type, bytes }`; put that object in your output. |
| `await ctx.asset(id)` | A Library file (a file input's value, or one you saved): `{ id, name, type, bytes, path }`, copied to a temp path deleted after the call. |
| `ctx.tmpdir()` | A private scratch folder for this call, deleted after it. |
| `await ctx.leads.upsert(lead)` | Adds or updates a lead in the member's Pipeline (section 13). `key` is yours; the same key updates the same lead, and an upsert never moves a lead backwards. |
| `await ctx.leads.list({ stage, limit, all })` | This pack's leads, newest first (`limit` default 500, max 2,000); `all: true` for the whole Pipeline (follow-ups across packs). |
| `await ctx.leads.get(id)` / `update(id, patch)` | Any of the member's leads by id; `update` fills in `msg`, `facts`, `score`, `channel`, `reply`, `week` and `note`, never the stage. |
| `await ctx.remember(key, value)` | Section 6b. |
| `ctx.cache` | `await get(key)`, `await set(key, value, hours)`: shared by all members, for public data only (a gym's public stats), so 20 members in one city don't pay twice. Never member data. |
| `ctx.log(text)` | One line in the run's timeline the member sees ("Found 41 gyms within 10 miles"). |
| `ctx.progress(done, total)` | For long steps. |
| `ctx.signal` | An `AbortSignal`: stop work when it fires (member stopped the run, or timeout). |
| `ctx.now()` | Use instead of `Date.now()` so tests can set the time. |

## 8. Credits

Members see credits, not dollars. Each tool's `credits` is per call (per item in an `each`). The Run button shows the estimate ("About 24 credits"); a run starts only with enough left. Credits are charged **after** a call succeeds with real output: failed calls and sample output (section 3) cost nothing. Proposed monthly allowances (Eli's call): Free 50, Builder 1,000, Circle 3,000. A Free member also gets one Builder workflow free, once (never a hidden one). As a guide, 1 credit is about $0.01 of our cost: price a tool at about 2 times what it costs us, rounded up.

## 9. Testing

```js
const { makeCtx, runTool } = require('<site>/lib/harness/testing');
const ctx = makeCtx({
  sample: true,                       // default
  ai: 'demo',                         // or async ({ task, schema, prompt }) => ({ data }) / ({ text })
  leads: [{ key: 'g1', name: 'Iron Temple', pack: 'gym' }],   // a Pipeline ctx.leads can read
  assets: { a1: { name: 'clip.mp4', type: 'video/mp4', data: Buffer.alloc(10) } }, // files for ctx.asset
  pack: 'gym', fetch, secrets: { places: 'test' }, now: Date.parse('2026-11-02T15:00:00Z'),
});
const out = await runTool(require('../tools/find-gyms'), { city: 'Des Moines' }, ctx); // checks input, output and the 256 KB cap
// ctx.logs, ctx.saved, ctx.leadsAdded, ctx.spent and ctx.remembered show what the tool did; ctx.setNow(ms) moves time.
```

The CLI runs whole workflows with no server (a throwaway database, approvals answered for you, waits skipped, sample mode unless `--live`):

```sh
npm run harness -- check <folder of packs>
npm run harness -- list --packs <folder>
npm run harness -- run gym.first_clients --packs <folder> --input city="Des Moines, IA" [--input clip=@path/to/clip.mp4] [--tier builder] [--pick 0,2] [--out <folder>] [--json]
```

`--input key=@file` (or `@a.mp4,@b.mp4`) puts the file in the test member's Library and passes its id, as when a member picks it. Outside the site, the same engine is mirrored at `/mnt/project-files/v2/harness/module` (`node lib/harness/cli.js ...`).

## 10. Views: how HQ shows an output

`view(output)` returns blocks (`viewMany(outputs)` does it once for an `each` step). HQ draws them on the run page, in the finished summary and in the Library; Claude and ChatGPT get a text version.

| Block | Fields |
|---|---|
| `metric` | `label`, `value`, `note`, `format` |
| `text` | `text` (plain, short paragraphs) |
| `table` | `title`, `columns: [{ key, label, format: 'number' \| 'money' \| 'percent' \| 'link' \| 'text' }]`, `rows` (up to 500), `limit` (default 10, "Show all" past it) |
| `cards` | `items: [{ title, subtitle, body, image (asset), badge, href }]` |
| `video` / `image` | `asset` (from `ctx.save`), `caption` |
| `file` | `asset`, `label` or `caption` |
| `copy` | `label`, `text`: a draft with a Copy button (and Open in Gmail when `email` is set, `{ to, subject }`). The buttons stay off while the text holds a `[placeholder]`. |
| `link` | `label`, `href` (https, or an `/app/hq/` page) |

## 11. Picking the model (`task` in ctx.ai)

Say what the call is, not which model. One map, which Eli can change without touching packs (`HARNESS_MODEL_<TASK>`, `HARNESS_EFFORT_<TASK>`):

| task | For | Today's pick |
|---|---|---|
| `classify` | labels, yes/no, routing | Haiku 5.5, low effort |
| `extract` | pull fields out of text, pages or screenshots | Haiku 5.5, low effort |
| `score` | rate or rank many items against a rubric | Haiku 5.5, low effort |
| `write` | anything a person reads or sends | Opus 5.5, low effort |
| `vision` | read images or video frames | Opus 5.5, low effort |
| `plan` | offers, pricing, strategy, forecasts explained | Opus 5.5, medium effort |
| `deep` | the hardest reasoning, few calls | Fable 5.1, medium effort (Circle only; others get Opus 5.5) |

A member past their tier's monthly soft cap gets Sonnet 5.5 for write, plan and vision. If a `schema` answer doesn't validate, the call is retried once a model up. Keep prompts self-contained; the router adds the brain and voice context for `write` and `plan`.

## 12. Files (the Library)

`ctx.save` and member uploads take: mp4, webm, mov, png, jpg, webp, gif, svg, mp3, wav, csv, txt, md, html, json, pdf, zip, ics, vcf, vtt, srt; a `.liquid` file is saved as plain text and keeps its name. Up to 25 MB a file (`HARNESS_MAX_FILE_MB`); files a member adds must fit in 25 MB in all for Free, 500 MB Builder, 2 GB Circle, while files a run makes are always kept, so a run never stops halfway. Keep videos lean anyway: a member pays for space they can see filling up. Files are private to the member. HTML opens in a sandbox with no scripts (don't put scripts in generated pages), and SVG always downloads, with a sandboxed preview, since SVG can carry script.

## 13. Leads and Do my day

A lead is `{ key, name, company, source, stage, links, note, data, warm, score, channel, facts, msg, reply, sentAt, repliedAt, answered, answeredAt, week }`:

- `stage`: `found`, `contacted`, `replied`, `call`, `won`, `lost`. `links`: `website`, `instagram`, `tiktok`, `youtube`, `facebook`, `linkedin`, `maps` (https), `email`, `phone`. `data`: anything of yours, up to 8 KB.
- `score` (0 to 100): best first in Do my day. `channel`: `ig`, `email`, `fb`, `site` or `call`, where the first message goes. `facts`: up to 5 one-line reasons the message cites ("They post every day but have no Reels"). `warm`: someone the member knows.
- `msg`: the messages, already written: `dm`, `subject`, `email`, `walkin`, `follow1`, `follow2`, and `answer` (a reply to their reply). Do my day hands these out ready to send, with one tap opening Instagram, Gmail or the phone. Keep `[placeholders]` out, or the member has to fill them before the buttons work (the address placeholder below and `[business name]` are the exceptions). Line breaks are kept.
- **Emails** (US CAN-SPAM, Legal L55): every email Do my day hands out, first messages, follow-ups and answers alike, ends with the member's first name, their business, a mailing address and a "no thanks" line (`Not interested? Reply "no thanks" and I won't email again.`). HQ adds whatever's missing on the Email and website versions and takes those lines off the Instagram, Facebook and call versions, so write `follow1`, `follow2` and `answer` once, signed with the first name or not signed. If you write the footer yourself, put `[Your business address, required in marketing email]` where the address goes: HQ swaps in the address the member saved in Your business, and until there is one the placeholder keeps Copy off and links to where to save it.
- `sentAt`: a lead that arrives already contacted gets its first follow-up 3 days after this (then 4 days after the second message; none after the third).
- `repliedAt`: a lead that arrives at `replied` (or moves there) is dated now, or at `repliedAt` if you give it, so Do my day can say how long it has waited.
- `answered: true` or `answeredAt`: your workflow logged that the member sent their answer to the reply (an "I sent it" step, say), so Do my day stops asking for one. On `upsert` or `ctx.leads.update`, for a lead at `replied`.
- `placeId`: a business found through Google Places (or `key: 'gplaces:<place id>'`). It's stored without its name and Google's fields; see section 6.

Do my day picks each morning's 25 (up to 100, the member's choice) from every pack's leads: answers to replies first, then calls to prep, follow-ups due, then the best new ones. So a pack that finds businesses should upsert them with `msg`, `facts`, `score` and `channel`, and everything else is HQ's job.

## 14. Hand-off

Tell the Harness thread (through the coordinator) when a pack is ready to load: its folder, its test command, its `needs` and `wants`, and any `system` tools. Run `npm run harness -- check <folder>` first; it should say "No problems." The Harness thread loads it into the site patch; the Website thread ships it.
