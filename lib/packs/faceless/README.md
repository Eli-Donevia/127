# Faceless channel (`faceless`)

Short videos without your face (YouTube Shorts, TikTok, Reels). The crowd card is honest: months to a first $1, because YouTube and TikTok pay only after a channel passes their program bars and sponsors want numbers first. So the pack builds the habit: ideas people already look up, scripts from sourced facts, voiced videos with word-by-word captions (rendered by the `video` pack), covers in one look, an upload plan with the exact program rules, and a sponsor pitch from the numbers the member types. A business pack (`business: true`), `uses: ['video']`. Nothing is posted and no one is contacted.

## Workflows

Credits per full run as the catalog counts them.

| id | title | tier | min | credits | job | the member gets |
|---|---|---|---|---|---|---|
| `faceless.first_25` | Your first 25 | free | 8 | 18 | content | crowd check, 25 ideas with last month's Wikipedia views (CSV), then their first video: vertical MP4 with voice, word captions and music, plus its cover |
| `faceless.scripts_30` | Your next 30 scripts | builder | 10 | 30 | content | 30 scripts on topics not made yet: a printable page to record from (HTML) and a spreadsheet with titles, cover words and descriptions. Suggested monthly (1st, 8am) |
| `faceless.make_one` | Make one video | builder | 6 | 22 | content | one short from a typed topic or a pasted script, voiced (or their own recording), with their clips if they add them: MP4, cover JPG, voiceover MP3 |
| `faceless.titles` | Titles and covers | builder | 5 | 10 | content | 5 titles and cover words for each of the next 12 videos (CSV), 12 tall covers in one design, a profile sheet PNG and a zip |
| `faceless.posting_plan` | Your upload plan | builder | 3 | 1 | ops | the next 30 upload days (3, 5 or 7 a week) as a calendar file, a tracker CSV and the program rules TXT with links |
| `faceless.sponsor_pitch` | Pitch a sponsor | builder | 8 | 6 | sales | a media kit page and PNG from typed numbers, a pitch email and follow-up (in the Pipeline when a brand is named), and the labelling rules |

Steps:

- **first_25**: find_ideas (25) > pick one (approve, max 1) > write_script > read and edit (approve, edit `text`) > `video.promo` (vertical, computer voice when the natural voice is off, `captions: 'words'`, niche color and stock search).
- **scripts_30**: write_scripts (30).
- **make_one**: write_script (topic, or the member's script) > read and edit > `video.voice` (skipped when they add a recording) > `video.promo` (the voice's line and word times, or their recording, their footage).
- **titles**: write_titles (12) > `video.thumbnail` in set mode (`items`, tall, `design`, their photo or video if given).
- **posting_plan**: plan_posts. **sponsor_pitch**: sponsor_kit.

## Tools

| tool | kind, credits | in | out |
|---|---|---|---|
| `faceless.find_ideas` | code, 2 | niche*, count 5 to 40 (25) | ideas[{rank, topic, article, kind, angle, title, hook, cover, views, month, evidence, url, search, again?}], first, topic, csv, live, skipped, month, asked, crowd |
| `faceless.write_script` | ai, 6 | idea, or topic, or own; niche, length short/minute, recording | scripts[{title, text (HOOK/LINE/CTA), kind, topic, seconds}], title, titles[5], cover, description, stock, stockLinks, label, color, source, seconds, needVoice, notes |
| `faceless.write_scripts` | ai, 30 | niche, count 5 to 30, length, topics (one per line) | scripts[{n, title, topic, angle, hook, lines, cta, cover, description, text, seconds, url, views, copied, ai}], page (.html), csv, notes |
| `faceless.write_titles` | ai, 6 | topics, niche, count 1 to 12 | rows[{n, topic, titles[5], cover, url, found}], covers[{text, title}], csv, color, name, sheetTitle |
| `faceless.plan_posts` | code, 1 | titles, perWeek 3/5/7, time, start, count 5 to 60 | plan[{n, date, day, time, title}], calendar (.ics), sheet (.csv), rules (.txt), continued |
| `faceless.sponsor_kit` | ai, 6, wants render | brand, contact, contactEmail, product, fit, numbers (views28, avgViews, youtubeSubs, tiktokFollowers, videos28), audience, countries, rate, email | kit, page (.html), picture (.png), subject, email, followUp, checklist, lead |

Niches: space, history, animals, science (Everyday science), money (Money basics), mythology, geography (Places), psychology. 30 to 40 topics each.

## Repeats

The pack remembers (under `brain.packs.faceless`, each key kept under 4 KB): `made_<niche>` (topic and angle of every script, newest 150 that fit), `niche`, `batch` (the last 30 titles, topics and covers, used by titles and posting_plan) and `planned` (where the last plan ends). Topics not made yet come first; made topics come back only with a new angle (who, what happened, in 60 seconds, 3 facts, by the numbers, explained), 90 to 150 videos a niche; only when every angle is made do the oldest come back, said so. A repeat plan starts the day after the last one ends. Lists, scripts, plans, covers and the media kit carry the date in their file names; videos are named by their title.

## Real or sample

- Interest: `data/topics.json` has September 2026 Wikipedia page views (Wikimedia pageviews API, user views) and each page's intro, read 2026-10-19. At run time last month's views and the page intro are read live (cached 24 hours and 7 days); offline the snapshot is used and the view says so. Typed topics outside the snapshot are found with Wikipedia search.
- Scripts: AI writes from the facts given only. A script the member pastes is kept as written; when it names a topic on the list, its numbers are checked against that page and its titles use it. A guard drops lines with numbers the facts don't have and flags lines that copy 8 or more words of Wikipedia. With AI off the script is Wikipedia's own sentences, marked as a starting point to rewrite: YouTube does not pay for reused or inauthentic content. Every description credits Wikipedia (CC BY-SA).
- Voice: the `video` pack's natural voice with its `voice` key, else the free computer voice (labelled robotic, with a note to record your own). Footage: Pexels with the `video` pack's `pexels` key, else search links.
- Sponsor kit: only the numbers the member types, dated; no suggested prices; packages only from their own rate.

## Keys

None needed. Through `video`: `render` (ffmpeg) for videos and covers, `voice` (natural voice) and `pexels` (stock clips) optional.

## Rules checked 2026-10-19 (`data/rules.json`)

- YouTube Partner Program: 1,000 subscribers with 4,000 qualified watch hours on public long videos in 12 months, or 10 million qualified Shorts views in 90 days; from February 1, 2027 new creators need 8,000 hours in 365 days or 20 million Shorts views in 90 days (fan funding at 500 subscribers). support.google.com/youtube/answer/72851.
- TikTok Creator Rewards: 18 or older, 10,000 followers, 100,000 video views in the last 30 days, videos longer than 1 minute, in eight listed countries. Reused content, inauthentic content, AI disclosure, music licences, paid promotion and FTC disclosure rules are quoted with links.

## Verified (2026-10-19)

- `node dev/lint.js templates faceless video`: 0 errors, 0 warnings.
- `node --test packs/faceless/test/*.test.js`: 21 pass offline, under the kit's HQ input and output checks, including every workflow with image tools off. 1 skipped: the live Wikipedia lookup, run with `FACELESS_LIVE=1`.
- Harness `check`: no problems. Harness `run` of all six workflows: done, with sample data (demo AI answers, the computer voice, no Pexels key). `node dev/run.js <id> --example`: all six done.
- Opened every file: video frames, captions and loudness; the idea CSV; the 30-script page on desktop and phone; covers, sheet and zip; the calendar across the end of daylight saving time; tracker and rules; the media kit page and PNG.
- Not run live yet: AI scripts and titles (the harness has no AI key; fake AI answers test the number guard), the natural voice and Pexels clips.
