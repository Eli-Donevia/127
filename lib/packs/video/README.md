# Video studio (`video`)

Real MP4s rendered with ffmpeg and libass: H.264 (yuv420p, faststart), AAC 48 kHz, 1080x1920 vertical by default.
Captions are ASS, word by word: the spoken word lights up in the member's pop color, set in Inter. SRT and VTT files come too.
All the heavy lifting is in the kit's `packs/_kit/media.js`. Other packs (ugc, faceless) render through the tools below; they don't call ffmpeg themselves.
A tool pack (`business: false`): HQ lists it under tools, not as a business to start.

## Workflows

| id | tier | min | credits (max) | what the member gets |
|---|---|---|---|---|
| `video.caption` | free | 3 | 14 (up to 3 min of video) | their video with captions burned in, a cover JPG, a captions zip, a transcript |
| `video.long_to_clips` | builder | 10 | 224 (90 min video, 5 clips) | 5 vertical clips with captions and hook titles, covers, a zip of SRT and VTT for each clip |
| `video.promo` | builder | 5 | 16 | a 10 to 45 s promo for their offer (kinetic text, music) plus a cover |
| `video.faceless_short` | builder | 5 | 16 | a 15 to 60 s faceless short from their points plus a cover |
| `video.thumbnail` | builder | 3 | 4 | three thumbnail designs on their photo or a video frame: the top pick (1920x1080 or 1080x1920 JPG under 2 MB), a sheet of all three at phone size, a zip of every size |
| `video.shoot_plan` | builder | 4 | 12 | a printable shoot plan (shot list, filming order, lines, gear, sound, light, permission text, storyboard), the shot list CSV and the storyboard PNG |

Every workflow has `job: 'content'` and `next` with a reason. Promo and faceless short also take the member's own clips or photos (`footage`, Library files, up to 6).

Each workflow's steps:

- **caption**: load (max 3 min), then transcribe each 1 minute block, then render_clip on the whole video, then captions.
- **long_to_clips**: load (max 90 min), then transcribe each block, then find_clips (5), then the member picks (approve, choose, max 5), then render_clip for each pick (concurrency 2), then captions with clips.
- **promo** and **faceless_short**: write_promo, then the member reads and edits the script (approve, edit `text`), then promo for each approved script.
- **thumbnail**: one step, thumbnail. **shoot_plan**: one step, plan_shoot.

## Tools: exact inputs and outputs

A `*` marks a required field. A "file" is the object `save.saveFile` returns.

### video.load_video
- Kind: code. Credits: 1. Wants: render. Timeout: 600 s.
- **In**: `file` (a Library file id from the `format: 'asset'` field, read with `ctx.asset`; an `{id}` object works too); `url: string` (https; Dropbox and Drive share links are rewritten to file links; local paths are never used); `maxMinutes: 1-90` (default 90).
- **Out**: `source*: object`; `blocks*: [{index, start, end}]` (60 s blocks, in seconds); `minutes`; `seconds`; `note`; `sample`.
- With no file and no url, `source` is the built-in sample talk (140 s).

### video.transcribe
- Kind: api. Credits: 2 per block. Needs: transcribe. Wants: render. Timeout: 300 s.
- **In**: `source*`; `block*` (one item of `blocks`); `language` (default `en`).
- **Out**: `index`; `start`; `end`; `words*: [[word, start, end]]` (seconds in the whole video); `language`; `missing`; `sample`.
- Live: ffmpeg cuts the block (plus or minus 1.5 s) to 16 kHz mono MP3. That goes to Deepgram nova-3: `POST https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true`, `Authorization: Token <key>`. Words are shifted to whole-video time and the cost is charged with `ctx.spend(minutes * 0.0043)`.
- Sample: the sample talk's real word timings. A real source in sample mode returns `words: []`, `missing: true`.

### video.find_clips
- Kind: ai (task `plan`). Credits: 12.
- **In**: `words*` (the list of transcribe outputs, which is what `$words` gives, or one flat list of `[word, start, end]`); `count: 1-10` (default 5); `length: short|medium|long` (10-30, 15-45, 30-75 s; under 6 minutes of talk, 10-35 s); `topic`.
- **Out**: `clips*: [{id, n, start, end, seconds, range, title, why, score, firstLine, text, words}]`; `minutes`; `ai`; `sample`.
- Code finds candidates: sentence-bounded, hook-scored, no weak openers, no overlaps, no crossing a topic change. AI reranks the top 12 and writes titles. Without AI it falls back to the code ranking.

### video.render_clip
- Kind: code. Credits: 6. Needs: render. Timeout: 600 s.
- **In**:
  - `source*`
  - `clip` (one item of `clips`, or any `{start, end, title?, words?}`; leave it out to render the whole video)
  - `words`
  - `title`
  - `style: bold|box|clean` (default bold)
  - `layout: auto|vertical|fit|keep` (default auto)
  - `handle`
  - `color` (hex)
  - `focus: 0-1` (crop centre, default 0.5)
  - `maxSeconds: 5-180`
- **Out**: `video` (file, `.mp4`); `poster` (file, `-cover.jpg`); `title*`; `seconds`; `width`; `height`; `mb`; `n`; `range`; `style`; `sample`.
- Footage is cropped (vertical) or fitted, and ffmpeg burns in the captions and the title box. Landscape crops get gentle punch-ins.
- Audio is loudnorm -14 LUFS. A sample or audio-only source becomes an audiogram card with a SAMPLE pill.

### video.captions
- Kind: code. Credits: 1.
- **In**: `words*`; `clips` (picked clips; each also gets its own SRT and VTT); `title`.
- **Out**: `zip` (file `<brand>-captions.zip`, holding `<brand>-captions.srt`, `<brand>-captions.vtt`, `clip-N.srt` and `clip-N.vtt` for each clip, and `<brand>-captions-transcript.txt`); `transcript` (file, `<brand>-captions-transcript.txt`); `cues*`; `words`; `minutes`; `preview`; `sample`.
- Cues follow the 42 characters × 2 lines rule, last at most 6 s and never overlap.

### video.write_promo
- Kind: ai (task `write`). Credits: 6.
- **In**: `kind: promo|faceless` (default promo); `offer`; `audience`; `topic`; `points` (one per line); `seconds: 10-60` (default 20); `variants: 1-3` (default 1).
- **Out**: `scripts*: [{id, title, kind, seconds, text}]`; `ai`; `sample`.
- Only facts from the input or the member's brain go in. The copy passes `ai.cleanCopy`, and a template is the fallback.

### video.voice
- Kind: api. Credits: 6. Wants: voice, render. Timeout: 300 s.
- **In**: `script` (`{title, text}` with labelled lines, or a string) or `text` (one line each, up to 3000 characters); `gender: female|male`; `robot` (default true: use the free computer voice when the natural voice is off); `name`.
- **Out**: `audio` (file `<name>-voiceover.mp3`, or null); `seconds*`; `lines*: [{type, text, sub, say, start, end}]`; `words: [{w, s, e}]`; `engine*: elevenlabs|flite|none`; `voice`; `note`; `sample` (true unless the natural voice made it, so the computer voice costs nothing).
- Natural voice: ElevenLabs with timestamps (key `voice`). Without it: ffmpeg's flite voice line by line (slt or rms), cleaned up and loudness-matched, with a note that it sounds robotic. With `robot: false` or no ffmpeg: no file, lines timed at reading pace. Links, @handles and #tags are never read out.

### video.stock
- Kind: api. Credits: 1. Wants: pexels. Timeout: 90 s.
- **In**: `query` (commas make several searches) or `queries` (up to 6); `shape: vertical|square|wide`; `count: 1-12` (default 6).
- **Out**: `clips*: [{id, link, page, by, seconds, width, height, query}]`; `searches*`; `links: [{query, url}]` (Pexels search pages in the right orientation); `live*`; `note`.
- Without the key it says stock footage is not switched on and gives the search links, so the member can pick clips by hand. Nothing is downloaded here: `video.promo` downloads the clips it uses.

### video.promo
- Kind: code. Credits: 10. Needs: render. Wants: voice, pexels. Timeout: 600 s.
- **In**: `script*` (`{title, kind, text}`); `format: vertical|square|wide`; `seconds: 8-60` (without a voice); `color`; `voice: off|female|male`; `robot` (default false); `voiceover` (a Library file id: the member's recording, or `audio` from video.voice); `lines` and `words` (from video.voice, so scenes cut on the words); `voiceName` (shown with the video, like `voice` from video.voice); `recording` (a Library id of the member reading the script: it wins over any other voice, and scenes are spread over it by words); `captions: scenes|words`; `label`; `footage` (Pexels clips from video.stock, or Library ids of the member's clips and photos, up to 12, 6 used); `stock` (a Pexels search when there is no footage); `watermark`.
- **Out**: `video` (file, `.mp4`); `poster` (file, `-cover.jpg`); `seconds`; `title*`; `format`; `voice`; `engine`; `background: footage|stock footage|your footage|gradient`; `credits: [{by, page}]` (Pexels attribution); `notes`; `sample`.
- With a voice, scene times come from the voice's lines (0.4 s lead, 1.3 s tail) and the music sits under it; `captions: 'words'` shows spoken LINE scenes as word-by-word captions. In the bold look the spoken word grows to 110%, so the kit's caption pages (`media.captionPages`) leave each gap 5% of its wider word and keep a line's end words inside the safe width. A recording without line times is spread over its length by words.
- Script grammar is one scene per line. You need at least 2 lines, and unknown lines are ignored.

  ```
  HOOK: Homework fights every night?
  OFFER: Bright Path Tutoring | Math and reading tutoring
  POINT: Start with a free 20 minute reading check    (up to 3 POINTs in a row share one scene)
  PRICE: From $45 a session
  LINE: One big line (faceless shorts use one LINE per point)
  CTA: Book your free reading check | brightpathtutoring.example
  ```

### video.thumbnail
- Kind: code. Credits: 4. Needs: render. Timeout: 240 s.
- **In**: `text` (the words, 2 to 5 is best; up to 60 characters); `title`; `sub` (small label); `image` (Library id: a photo, or a video it takes a frame from at a third of the way in); `color`; `shape: wide|tall|both`; `name`; `items` (a set: up to 12, each `{text, title}` or just the words); `design: split|block|photo` (the one design for a set).
- **Out**: `pick` (file `<name>-thumbnail-1920x1080.jpg` or `-1080x1920.jpg`, under 2 MB); `sheet` (file `<name>-thumbnails-sheet.png`: every design big and at phone size); `zip` (file `<name>-thumbnails.zip`: every design and size, plus read-me.txt); `designs*` (labels, top pick first); `words*`; `shape`; `photo`; `notes`; `count` (covers in a set); `sample`.
- A set (`items`): one cover per video in one design, tall unless `shape: 'wide'`. Files: `<name>-cover-1-1080x1920.jpg`, `<name>-covers-sheet.png` (all of them in a profile grid, headed by `title`) and `<name>-covers.zip` (`01-<title>-1080x1920.jpg` and on, plus read-me.txt). Covers over 6 words get a note. The faceless pack's Titles and covers workflow uses it.
- Designs: Full photo, Split and Color block. Without a photo the order is Split, Color block, Dark. Big Inter Black words with one key word (a number first, else the longest word) in the pop color. The bottom right stays clear for YouTube's time stamp.
- Thumbnail rules are from YouTube Help "Add video thumbnails" (support.google.com/youtube/answer/72431), read 2026-10-19: 16:9 for videos and 9:16 for Shorts, recommended 3840 x 2160 (Shorts 2160 x 3840), minimum width 640 (Shorts: minimum height 640), JPG or PNG, up to 2 MB from a phone and 50 MB from a computer; custom thumbnails need a verified account; custom Shorts thumbnails only in YouTube Studio on a computer. We make 1920 x 1080 and 1080 x 1920 JPGs under 2 MB (`data/platforms.json`).

### video.plan_shoot
- Kind: ai (task `plan`). Credits: 12. Wants: render. Timeout: 180 s.
- **In**: `about` (what the video is about); `kind` (Promo for my offer, How-to or tip, Behind the scenes, Customer story, Product close-ups); `seconds: 15-180` (default 45); `shape: vertical|wide|square`; `where`; `people`; `date` (shoot day); `color`.
- **Out**: `plan*` (`{title, kind, seconds, shots: [{n, name, framing, seconds, setup, action, line}], order: [{step, setup, shots, minutes}], shootMinutes, gear, sound, light, beforePost, questions, consent}`); `page` (file `<title>-shoot-plan.html`, printable, no scripts, storyboard embedded as a JPEG); `csv` (file `<title>-shot-list.csv` with a Done column); `board` (file `<title>-storyboard.png`, null without render); `ai`; `sample`.
- AI plans 5 to 9 shots from only the facts given (never lines for a customer); a template per kind is the fallback. Seconds are fitted to the length exactly; shots that share a setup are filmed together. Filming time is a rule of thumb, said as one: 5 minutes per setup and 3 per shot.

## Using these tools from another pack (ugc, faceless)

```js
// A faceless short from points the member typed (or a script your own tool wrote):
{ id: 'script', tool: 'video.write_promo', input: { kind: 'faceless', topic: '$inputs.topic', points: '$inputs.points', seconds: 25 } },
{ id: 'check', approve: { title: 'Read and edit your lines', items: '$script.scripts', edit: 'text', label: 'title' } },
{ id: 'render', tool: 'video.promo', each: '$check.items', input: { script: '$item', format: 'vertical', seconds: 25 } },
// Or skip write_promo and pass your own script: { script: { title: 'Short', kind: 'faceless', text: 'HOOK: ...\nLINE: ...\nCTA: Follow for more | @handle' } }

// Voice first, so the scenes cut on the words, with word-by-word captions and stock footage:
{ id: 'voice', tool: 'video.voice', input: { script: '$script', gender: 'female' } },
{ id: 'stock', tool: 'video.stock', input: { query: 'night sky, telescope', shape: 'vertical' } },
{ id: 'render', tool: 'video.promo', input: { script: '$script', voiceover: '$voice.audio', lines: '$voice.lines', words: '$voice.words', captions: 'words', footage: '$stock.clips', format: 'vertical' } },

// UGC: caption the member's own filmed video, or cut one moment of it:
{ id: 'load', tool: 'video.load_video', input: { file: '$inputs.file', url: '$inputs.url', maxMinutes: 3 } },
{ id: 'words', tool: 'video.transcribe', each: '$load.blocks', concurrency: 3, input: { source: '$load.source', block: '$item' } },
{ id: 'render', tool: 'video.render_clip', input: { source: '$load.source', words: '$words', style: 'box', layout: 'keep', title: 'Hook line here' } },
// One moment only: add clip: { start: 12.4, end: 31.0, title: '...' }
```

## Real vs sample

- **Promo and faceless short.** These are always real renders: a moving gradient in the member's colors and a music bed made in code. They need no keys.
  - `voice` adds an ElevenLabs voiceover, and its timing sets the video's length. Without the key, the workflows say the natural voice is off; video.voice can use the free computer voice instead, labelled as robotic.
  - `stock` plus the Pexels key puts stock footage behind the text. Without it, the background is a gradient and video.stock gives search links.
  - `footage` puts the member's own clips and photos behind the text, no key needed.
- **Thumbnails and shoot plans.** Always real: they need ffmpeg (librsvg) for the pictures and nothing else. Without AI, the shoot plan uses its template for the kind.
- **Caption and clips with a real upload or link.** These are real renders of the member's footage. Transcription needs the `transcribe` key.
- **Sample mode.** This applies when a `needs` key is missing or in a CLI run.
  - The business is Bright Path Tutoring (`sample/brain.json`) when the member has no brain.
  - The video is a 140 s talk spoken by flite, with its real word timings, rendered as an audiogram card marked SAMPLE.
  - Promo and faceless renders also carry a small "Sample" label.
- **Keys and costs** (checked 2026-10-19; sources in `data/providers.json`):

  | Key | Service and price | How it's paid |
  |---|---|---|
  | `transcribe` | Deepgram nova-3, $0.0043 a minute | through `ctx.spend` |
  | `voice` | ElevenLabs `eleven_flash_v2_5` with-timestamps, $0.04 per 1K characters | through `ctx.spend` |
  | `pexels` | Pexels, free with attribution | |
  | `render` | the server's ffmpeg lane | `MEDIA_RENDER=off` turns rendering off |

- **Platform limits** are in `data/platforms.json`, covering YouTube titles, descriptions, tags, chapters and thumbnails, plus our own safe-margin rule for vertical video. Instagram and TikTok limits are listed as not verified.

## What the site needs

1. **File inputs** are contract 4b fields: `{type: 'string', format: 'asset', accept}`; the value is a Library id, read with `ctx.asset(id)`. `lib/source.js` copies it once into a shared cache for the run's steps.
2. **Big videos.** `ctx.asset` copies the whole file; for long talks (up to 1.5 GB) a `ctx.file(asset)` that hands back a local path would save a copy. `lib/source.js` still uses it when it exists.
3. **`.srt` and `.vtt` allowed by `saveFile`.** Until then they ship inside the captions zip.
4. **A render lane with ffmpeg** (libass, librsvg, freetype). Rendering takes about 12 to 50 s per clip on 2 vCPUs, and output is capped at about 22 MB a clip.

## Verify

- `node dev/lint.js video`
- `node --test packs/video/test/video.test.js` (renders a real MP4)
- `node lib/harness/cli.js run video.long_to_clips --packs <LIB>/packs --out /tmp/x`, run from `v2/harness/module`
- `node dev/run.js video.thumbnail --example` and `node dev/run.js video.shoot_plan --example`
