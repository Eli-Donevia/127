# Media studio (`studio`)

W4 of the turnkey build (v2/turnkey/BUILD-PLAN.md), plus the ad creatives for W11. A tool pack (`business: false`), held (`held: true`, contract v1.10): it loads only when `PACKS_ON` names `studio` (or `PACKS_ON=all`).

Three parts, one owner file each (`lib/area-*.js`, joined in `index.js`):

- **Generation** (`lib/area-gen.js`): AI clips, images, talking clips and sound through six provider plugins (`lib/providers/`), and the workflows that turn them into finished ads and videos.
- **Editing** (`lib/area-edit.js`): ffmpeg on the render lane. Works today wherever `ffmpeg` is installed (Replit needs `ffmpeg-full`).
- **Prompts** (`lib/area-prompts.js`): 206 prompt templates in 8 packs, written per model (`lib/prompts.js`, `data/prompts/`).

## Accounts and keys (Legal L76 row 8)

Each provider runs on one of two accounts, tried in this order by `lib/gen.js`:

1. **The member's own account.** They paste their key in HQ Connections (Media group, Hub's `CONNECTOR_<ID>` switch). `ctx.secret(name)` gives Hub's client, never the key; there's no `ctx.spend` and no price cap, since it's their bill, and the tool returns `ownAccount: true` (credits at `OWN_ACCOUNT_CREDIT_PCT`, contract v1.12). Cleared for all six.
2. **127's own key**, only where Legal cleared it: Gemini (paid tier only) and Luma. fal, Higgsfield, Runway and ElevenLabs never run on 127's key.

| Provider | Member's connector | 127's key (env) | 127's account |
|---|---|---|---|
| fal (Kling 3.0, Wan 3.0, FLUX.2/3, lipsync, music, sfx) | `fal` | none | never |
| Higgsfield (Kling 3.0, Soul 2) | `higgsfield` | none | never |
| Runway (Gen-4 Turbo, Gen-4.5, Gen-4 Image) | `runway` | none | never |
| Luma (Ray3.2, Uni-1) | `luma` | `luma_ai` (`LUMAAI_API_KEY`), HELD until the Privacy Policy line | cleared |
| ElevenLabs (voice, sound effects, music) | `elevenlabs` | `voice` (`ELEVENLABS_API_KEY`), HELD | never |
| Google (Gemini Omni video, Nano Banana images) | `google_gemini` | `gemini` (`GEMINI_API_KEY`), HELD; must be a paid-tier project | cleared |
| ffmpeg | | `render` | editing and every sample |

Names differ where both exist because a name in `needs.js` is 127's account and wins over a member connector. `providers.keysFor(ids)` gives the names a tool declares in `wants`. Veo 3.1 Preview shuts down on the Gemini API on 2026-10-22, so Veo isn't used.

**Voice or look clones** aren't built: Studio keeps none. If they're added (members' own accounts only), the consent box must use Legal's words in `legal/handoffs/turnkey.md` part 5, and the 30-day deletion registers with `require('lib/lapse').onLapse('studio', ...)`.

With no account on (today: no member connections switched on, and 127's keys held), every generation step makes a labeled sample (the member's photo, or a card in their colors with the shot written on it, with a SAMPLE tag) and costs nothing. Prices, endpoints, checked dates and sources: `data/providers.json` (checked 2026-10-20; unverified facts are marked).

**Price rule.** A tool worth `credits` spends at most `credits / 200` dollars on one call (contract 8: about 2x our cost), and `lib/gen.js` only picks models under that. `ctx.spend` records every paid call before it starts, so the $3 run cap and the $100 day cap hold.

## Workflows (credits are the Run button's estimate)

| id | tier | credits | what the member gets |
|---|---|---|---|
| `studio.product_ad` | builder | 282 | 3 AI shots from one product photo, cut into a short ad with hook, music, end card |
| `studio.ugc_ad` | builder | 294 | script (picked and edited), voiceover, 3 AI shots, word-by-word captions |
| `studio.talking_ad` | builder | 278 | their photo speaking their script (lipsync), captions, end card |
| `studio.faceless_video` | builder | 84 | script, voiceover, an AI picture per line, captions |
| `studio.image_ads` | builder | 46 | ads desk angles (picked), an AI scene each, every ad in 5 placement sizes, zipped |
| `studio.video_ads` | builder | 300 | ads desk angles (picked), one short video ad per angle opening on its hook |
| `studio.ai_broll` | builder | 299 | up to 3 b-roll moments found in their talking video, AI clips made and cut in |
| `studio.ai_clips` | builder | 276 | up to 3 AI clips from a description, planned shot by shot |
| `studio.edit_video` | builder | 37 | pauses and fillers cut, reframed, hook title, captions, music with ducking, end card |
| `studio.hook_variants` | builder | 31 | hook lines written, up to 5 versions of the video each opening on one |
| `studio.reframe_all` | builder | 6 | 9:16, 1:1, 4:5 and 16:9 at once, crop or blur fill |
| `studio.brand_outro` | builder | 4 | an end card in their colors with name, line, handle, logo |
| `studio.video_prompts` | free | 6 | 10 to 20 prompts written for the model they pick, printable sheet, CSV |
| `studio.plan_shots` | builder | 1 | a shot list with camera moves and prompts per shot |

Every approval step comes before money is spent: shots and scripts are read and edited before a model makes anything. Nothing is posted or sent. Captions need transcription (`video.transcribe`, Deepgram, held): until then caption steps say so and cost nothing; voiceover videos caption from the voice's own timings.

## Hand-offs

- **Ads desk (W11):** `studio.image_ads` and `studio.video_ads` start from `ads.find_angles` and the member's pick (`{ key, name, hook }`); `studio.ad_sizes` takes those angles directly, so the ads pack can call it after its own picks.
- **Store (W7):** `/mnt/project-files/v2/turnkey/media/store-feed.json` (9 prompt packs, `{{tokens}}` for Make it mine), files in `media/prompt-packs/`. Rebuild with `dev/studio-store-export.js`.
- **Ask 127 (W3):** `/mnt/project-files/v2/turnkey/media/slash-commands.json` (6 commands).

## Checks

From a library checkout with this pack in `packs/studio`: `node dev/lint.js studio` (0 errors), and each test file on its own: `node --test packs/studio/test/studio.test.js` (every workflow end to end), `edit.test.js`, `providers.test.js` (offline, fake fetch), `prompts.test.js`.

## Not verified yet

No real model call has run (no keys; services held). Hub's client is matched in tests by a stand-in, not the real module. Higgsfield's API host (`api.higgsfield.ai` here, `platform.higgsfield.ai` in Hub's base) and header names need checking at sign-up. Hub's client doesn't follow redirects, so Gemini file downloads that redirect will fail until it does. Higgsfield prices and a few fal and ElevenLabs details are marked unverified in `data/providers.json`. Editing is tested on generated clips and the computer voice, not real phone footage (HEVC, 4K, rotated) or a 2-vCPU server.
