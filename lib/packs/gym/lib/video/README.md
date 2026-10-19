# Spec reel renderer (`lib/video`)

Renders the 15-second vertical SAMPLE Reel that a member sends privately to a gym owner. Plain Node
(CommonJS, no npm packages) plus the system `ffmpeg`. Text, shapes and motion are written as an ASS
subtitle file and drawn by libass inside one ffmpeg filter graph; backgrounds, footage, grading,
transitions and the beat track are ffmpeg filters. Fonts ship in `../../assets/fonts`, with their SIL Open Font License texts in `../../assets/fonts/licenses` (kept out of the font folder so libass only loads fonts).

```
render.js   renderSpecReel(), buildPlan(), TEMPLATES: timeline, scenes, filter graph, ffmpeg runs
ass.js      ASS writer: styles, escaping, word wrap and auto-size with per-font glyph widths, easing,
            colour helpers (luminance, contrast, text colour on a background), shape paths
cli.js      command line wrapper
```

## Use

```js
const { renderSpecReel } = require('./lib/video/render');
const res = await renderSpecReel(props, { outPath: '/tmp/x/reel.mp4', tmpDir: '/tmp/x', signal });
// res = { video, poster, durationSec: 15, template, fallback, warnings: [], renderMs }
```

Options: `outPath` (required), `tmpDir` (a `specreel-*` work folder is made inside it and removed
after), `posterPath` (default: outPath with `.png`), `ffmpeg` (default `ffmpeg` on PATH), `signal`
(AbortSignal: kills the ffmpeg it started), `onProgress({ phase, progress, elapsedMs })`, `preset`
(x264, default `veryfast`), `crf` (default 18), `keepTemp`, `fontsDir`.

`buildPlan(props, opts)` is pure (no ffmpeg): it returns `{ template, fallback, warnings, shots,
ass, filter, args, posterTime }`, which is what the tests use.

```sh
node lib/video/cli.js --props reel.json --out reel.mp4 [--poster reel.png] [--plan]
```
The CLI resolves relative media paths against the props file's folder and prints the result JSON.
`--plan` prints the plan (shots, warnings, ffmpeg args) without rendering.

## Templates

| id | needs | what it is |
|---|---|---|
| `offer` | clips or photos | hook over footage, 2 to 4 lines (one push transition, cuts on the beat), brand offer card, end card |
| `class` | clips or photos | "What a class at GYM looks like": a label per block (with a time chip only when `schedule` gives times) and a progress bar over one shot per block |
| `hype` | none | kinetic type on brand panels and a dark animated gradient: city, hook, lines, offer, end card |

`offer` and `class` without usable clips or photos render the hype-style version of the same script
(brand panels and the dark gradient) and add a warning. That is the normal path for gyms with no
photos (OSM-only).

## Props

Everything is validated and defaulted; bad input never throws, it adds a warning.

| field | default / limit |
|---|---|
| `template` | `offer`, `class` or `hype` (unknown: `offer`) |
| `gym.name` | required in practice, 60 chars (else "Your Gym") |
| `gym.city`, `gym.site` | optional, 40 / 48 chars; site is shortened to the bare domain |
| `gym.category` | gym, crossfit, yoga, pilates, boxing, martial_arts, climbing, cycling, dance, other |
| `gym.colors.primary` / `.accent` | hex; accent is used as the dark color if it is dark enough, else a deep shade of the brand |
| `gym.logo` | png, jpg, webp or svg path (svg needs librsvg in ffmpeg; skipped with a warning otherwise) |
| `hook` | 70 chars (default: the gym name) |
| `lines` | 2 to 4 strings, 70 chars each (default: per category) |
| `offer.headline`, `offer.sub` | 56 / 80 chars; headline default "Come try a class". The sub is hidden when it repeats the CTA |
| `cta` | 56 chars (default "Book at SITE" or "Send us a DM") |
| `schedule` | class template: up to 5 `{ time, label }`; time is optional (default: labels per category, no times) |
| `clips`, `photos` | file paths; unreadable files are skipped with a warning |
| `beat` | true: a synthesized 120 BPM beat with hits on the cuts; false: silent AAC track |
| `music` | audio file path; trimmed from its start, faded out at 15 s (no beat matching) |
| `watermark` | default "SAMPLE · made for GYM", top left, about 55% opacity |

Mark a key word with `*asterisks*` in the hook, a line or the headline to box it; otherwise the last
word that isn't filler is boxed.

## Output

1080x1920, 30 fps, exactly 15.0 s (450 frames), H.264 High yuv420p CRF 18 (maxrate 20M), AAC 48 kHz
stereo, `+faststart`, BT.709 tagged. About 9 to 11 MB. Poster PNG at 1.2 s (2.4 s for hype).

## Look rules the code enforces

- All text and the logo stay inside the safe zone x 90 to 930, y 250 to 1450. Long names wrap and
  shrink with per-font glyph-width ratios; a single 40-character word stays on one line, smaller.
- Hooks in Anton, small lines in Inter, chips and CTA in Archivo Black. Fonts are isolated with a
  private fontconfig file, so system fonts never leak in.
- Text color is picked by contrast against what it sits on (dark ink on light brands, white on dark);
  key-word boxes and brand text on dark use a lightened brand so contrast stays at 4.5:1 or more.
  Brand-colored text never sits directly on footage (only white text with a soft halo and a scrim).
- Footage cuts every 1 to 2 s on the beat grid, slow punch-ins, a light grade and vignette. Hard cuts
  except one push (offer) or one short fade (class). Pops ease out in 0.2 to 0.25 s; the first word
  of a line lands on the cut.
- No 127 branding. The renderer never adds stats, prices or claims; it only shows the words it is given.

## Requirements

`ffmpeg` built with libass (with fontconfig and freetype), libx264, the lavfi `gradients` source and
`xfade`. Tested on FFmpeg 6.1 only (4.4 is the oldest release that has every filter used, untested).
librsvg only for SVG logos. FFmpeg 5.0+ is detected at run time
and its threaded scaler is used (about 25% faster). No ffprobe needed: media are probed with ffmpeg.

## Render time

Measured one at a time on a shared 4-core box (ffmpeg 6.1): offer with 6 clips 28.6 s, class with
6 clips 38.6 s, offer with 4 website photos 19.8 s, class with 4 photos 23.5 s, hype 12.0 s, offer
without footage 9.9 s. Each render uses all cores; run at most two
at once. Not yet measured on Replit.

## Limits

- Footage is center-cropped to 9:16; there is no subject tracking, so a subject at the edge of a
  landscape clip can be cut off. Use vertical or centered clips.
- Low-resolution clips are upscaled with a light sharpen; 720p landscape sources look soft.
- Photos are stills with a slow push-in. With fewer photos than shots (about 8), photos repeat.
- HDR or log footage is not tone-mapped. Clip audio is never used.
- Characters the bundled fonts can't draw (emoji, most non-Latin scripts) are removed with a warning.
- The beat is synthesized; `music` is used as given (no beat detection).
- Grain is static (it does not move between frames) to keep files small.
