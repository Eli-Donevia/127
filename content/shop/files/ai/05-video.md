# Video: script, shoot, generate and edit

Video sells. These prompts write scripts, plan shoots, write prompts for AI video and voice tools, build an edit plan, and make a spec video to pitch a business before they pay you.

## Short video script

**Use it when:** You have a topic and need a 15 to 60 second script that hooks, keeps people watching and ends with one action.

**Fill in first:**

- `{{topic}}`: Topic (for example: 3 signs your gym's Instagram is costing you trial signups)
- `{{audience}}`: Who is watching (for example: Gym owners)
- `{{length}}`: Length (for example: 35 seconds)
- `{{cta}}`: Call to action (for example: Comment AUDIT and I'll check yours free)
- `{{format}}`: On camera or voiceover (for example: On camera, filmed on my phone)

```text
Write a short video script.

Topic: {{topic}}
Who's watching: {{audience}}
Length: {{length}}
Call to action: {{cta}}
On camera or voiceover: {{format}}

Structure:
1. Hook (first 2 seconds): what I say and what's on screen.
2. Setup (why this matters to them), one line.
3. Three beats: each one line of speech plus the shot or on-screen text.
4. Payoff: the thing they came for.
5. Call to action, one line.

Also give: on-screen captions (short, punchy), the B-roll shot list, and two alternate hooks. Keep sentences short enough to say in one breath. No claims I can't back up.
```

**What you get back:** A timed script with hook, three beats and CTA, captions, a B-roll list and two alternate hooks.

## Spec promo video for a prospect

**Use it when:** You want to pitch a local business by showing them a video made for them before they've paid you.

**Fill in first:**

- `{{business}}`: The business (for example: Northside Boxing Club)
- `{{assets}}`: Footage and photos you can use (for example: 6 clips I filmed outside, their logo from their site, 3 tagged member photos they reposted)
- `{{goal}}`: What they want more of (for example: January trial class signups)
- `{{style}}`: Style (for example: Gritty, fast cuts, black and white with red text)

```text
Plan a 15 to 30 second spec promo video for this business. I'll make it before they pay me and use it in my first message.

Business: {{business}}
What I can use: {{assets}}
What they want more of: {{goal}}
Style: {{style}}

Give me:
1. The concept in one line.
2. A shot-by-shot plan (5 to 8 shots): what's on screen, length, on-screen text, transition.
3. Voiceover or caption script, if any.
4. Music direction (mood and tempo, royalty-free).
5. For any shot I don't have footage for, a text-to-video prompt I can paste into an AI video tool. Describe subject, action, camera move, lighting, lens and mood. Keep people generic, no real people's faces or logos I don't have rights to.
6. The end card: their name, one line, and a call to action for their customers.
7. Export settings for Reels, TikTok and Stories.

Rules: use only their public photos or clips that I'm allowed to use, or my own footage. Label it "Sample made for [business]" when I send it.
```

**What you get back:** A one-line concept, a 7-shot plan with text and timings, a caption script, music direction, AI video prompts for the two missing shots, an end card and export settings.

**Works in:** CapCut, Higgsfield, Runway, ElevenLabs

## AI video shot prompts

**Use it when:** You want B-roll, product shots or scenes from an AI video tool and need prompts that come out right the first time.

**Fill in first:**

- `{{tool}}`: The AI video tool (for example: Higgsfield)
- `{{purpose}}`: What the video is for (for example: A 20-second ad for a mobile coffee cart at office parks)
- `{{shots}}`: Shots you need (for example: Espresso pour close-up, cart at sunrise, hands passing a cup, steam over a latte)
- `{{look}}`: Look and feel (for example: Warm morning light, film grain, calm)
- `{{format}}`: Aspect ratio and clip length (for example: 9:16, 5 seconds each)

```text
Write text-to-video prompts for these shots. I'll paste them into {{tool}}.

What the video is for: {{purpose}}
Shots I need: {{shots}}
Look and feel: {{look}}
Aspect ratio and length per clip: {{format}}

For each shot write one prompt with, in this order: subject, action, setting, camera (angle, lens in mm, movement such as slow push-in or handheld), lighting, color and mood, and what to avoid (text, extra fingers, logos, warped faces).
Then write:
- An image prompt for a first frame, if the tool supports image-to-video.
- A short negative prompt.
- Two variations to try if the first result misses.

Keep each prompt under 80 words. Make the shots match each other so they cut together (same light, same palette, same lens family). No real people's likeness, no brand logos I don't own.
```

**What you get back:** Four matched shot prompts with camera, lens and lighting, first-frame image prompts, a negative prompt and two fallbacks per shot.

**Works in:** Higgsfield, Runway, Kling, Veo, fal

## Voiceover script and voice direction

**Use it when:** You want a voiceover for a video, read by you or an AI voice tool.

**Fill in first:**

- `{{video}}`: What the video shows (for example: A 30-second tour of a home bakery's holiday menu)
- `{{length}}`: Length (for example: 30 seconds)
- `{{voice}}`: The voice you want (for example: Warm, friendly, a little playful, female)

```text
Write a voiceover for this video and direct the read.

Video: {{video}}
Length: {{length}}
Voice: {{voice}}

Give me:
1. The script, timed to the length, with line breaks where the voice should pause. Mark emphasis with CAPS on one word per line at most.
2. Words per second check: say if it fits the length at a natural pace.
3. Direction for the read: pace, energy, tone, where to smile.
4. Settings to try in an AI voice tool (stability and style as low, medium or high) and why.
5. Pronunciation notes for names or brand words, spelled out.

Only use an AI voice that I own or have rights to. Never clone a real person's voice without their written permission.
```

**What you get back:** A paced script with pauses and emphasis, a timing check, read direction, AI voice settings and pronunciation notes.

**Works in:** ElevenLabs, CapCut

## Edit plan from raw footage

**Use it when:** You have raw clips and need a fast plan to cut them into a short video in CapCut or any editor.

**Fill in first:**

- `{{clips}}`: Your clips (for example: Clip 1: wide shot of the gym 12s; Clip 2: coach yelling count 8s; Clip 3: deadlift slow-mo 6s...)
- `{{goal}}`: What the video is for (for example: Instagram Reel announcing a 6am class)
- `{{length}}`: Target length (for example: 20 seconds)

```text
I have raw footage and need an edit plan.

What I filmed (list clips with a few words each and their length): {{clips}}
What the final video is for: {{goal}}
Target length: {{length}}

Give me:
1. The story order: which clips, in what order, trimmed to what length.
2. The hook: which moment to open on and why.
3. Cuts: where to cut on action, where to use a jump cut, where to hold.
4. Text on screen, line by line with timings.
5. Sound: music mood, where the beat drops, sound effects worth adding.
6. Captions style and color.
7. A step-by-step for CapCut on a phone, numbered, so I can follow it without thinking.
8. A checklist before export: first frame, safe zones for captions, audio levels, length.
```

**What you get back:** A trimmed clip order, the opening moment, cut points, timed on-screen text, sound plan, caption style, CapCut steps and an export checklist.

**Works in:** CapCut, Premiere Rush, Descript

## Long video outline

**Use it when:** You want to make a 5 to 15 minute YouTube or podcast-style video that builds trust and sends people to your offer.

**Fill in first:**

- `{{topic}}`: Topic (for example: How I found my first 10 lawn care customers with $0 in ads)
- `{{audience}}`: Audience (for example: People starting a lawn or landscaping side business)
- `{{length}}`: Length (for example: 12 minutes)
- `{{cta}}`: What viewers do after (for example: Download my free pricing sheet)

```text
Outline a long video.

Topic: {{topic}}
Audience: {{audience}}
Length: {{length}}
What I want viewers to do after: {{cta}}

Give me:
1. Five title options and three thumbnail ideas (text under 4 words each).
2. The first 30 seconds word for word: proof (why listen to me, only true things), promise (what they'll get), plan (what's coming).
3. Chapters with timestamps, each with the point, an example or demo, and a re-hook line to keep people watching.
4. Where to mention my offer (once in the middle, once at the end) and the exact wording.
5. Ten clips I can cut from it for shorts, with timestamps.
```

**What you get back:** Titles, thumbnails, a scripted first 30 seconds, timestamped chapters with re-hooks, offer mentions and ten clip timestamps.
