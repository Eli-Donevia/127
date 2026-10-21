# Ops and SOPs: run it without you in every step

A business is only worth what it is when you are not there. These prompts plan your day, write your processes down, find what to automate, and turn repeat work into a reusable skill your AI runs for you.

## Do my day

**Use it when:** Every morning. Paste your list, pipeline and calendar and get the exact order to do things in.

**Fill in first:**

- `{{hours}}`: Hours available (for example: 3)
- `{{goal}}`: This week's goal (for example: Book 3 sales calls)
- `{{pipeline}}`: Your pipeline (for example: 2 replied and waiting on me, 5 follow-ups due, 1 call tomorrow)
- `{{todos}}`: Your to-do list (for example: Edit sample video, redo logo, post Reel, invoice Dana, research email tools)
- `{{calendar}}`: Fixed commitments (for example: Work 9 to 5, gym 6pm)

```text
Plan my day. I have {{hours}} hours for the business today.

My goal this week: {{goal}}
My pipeline (who's where): {{pipeline}}
My to-do list: {{todos}}
Fixed commitments today: {{calendar}}

Give me:
1. The three things that move the goal most. Do these first.
2. A time-blocked schedule for my available hours, with 10-minute buffers.
3. Who to message today and the first line for each (follow-ups due, warm replies, new outreach count).
4. What to drop, delegate or push to tomorrow, and why.
5. One thing to automate or template so I never do it by hand again.

Be ruthless. If my list is too long for my hours, cut it and say what you cut.
```

**What you get back:** Top three (answer the 2 replies, send the 5 follow-ups, finish the sample), an evening schedule, message openers, a cut list (logo and tool research) and one thing to template.

**Works in:** Google Calendar, Notion, Todoist

## Write the SOP

**Use it when:** You do something more than twice. Write it down once so you, a helper or your AI can do it the same way every time.

**Fill in first:**

- `{{task}}`: The task (for example: Onboarding a new monthly video client)
- `{{steps}}`: How you do it now (for example: Send contract, get deposit, make Drive folder, ask for logo and brand colors, book first shoot, add to content calendar...)
- `{{who}}`: Who follows it (for example: Me now, a part-time editor later)

```text
Turn how I do this task into a standard operating procedure.

The task: {{task}}
How I do it now (brain dump, voice note transcript, or rough steps): {{steps}}
Who will follow it: {{who}}

Write the SOP with:
1. Purpose and when to run it.
2. What you need before starting (accounts, files, info).
3. Numbered steps, each one action, with the tool and where to click or what to type.
4. Done means: an acceptance checklist the result must pass.
5. Common mistakes and how to avoid them.
6. Time it should take.
7. What to escalate to me and when.

Then mark which steps an AI could do, which a template could replace, and which need a human.
```

**What you get back:** A numbered SOP with prerequisites, a done checklist, mistakes to avoid, timing, escalation rules and AI, template and human tags on each step.

## What should I automate?

**Use it when:** You feel busy but not productive. You want to know which jobs to automate, template, delegate or drop.

**Fill in first:**

- `{{business}}`: Your business (for example: Residential cleaning, 2 cleaners plus me)
- `{{tasks}}`: Recurring tasks with frequency and minutes (for example: Reply to quote requests daily 30m; schedule cleaners weekly 60m; send invoices weekly 45m; post on Facebook 3x a week 20m; review requests after each job 5m)
- `{{tools}}`: Tools you use (for example: Google Workspace, Square, Facebook, Jobber trial)
- `{{budget}}`: Monthly tool budget (for example: $50)

```text
Audit my week and build an automation plan.

What my business does: {{business}}
Every recurring task, how often, and minutes each time: {{tasks}}
Tools I use: {{tools}}
Budget for new tools per month: {{budget}}

For each task decide: automate, template, delegate, batch, or drop. Then:
1. Rank by hours saved per month for the effort to set up.
2. For the top 5, give the exact setup: trigger, steps, tools, and what a human still checks. Prefer tools I already have.
3. Which tasks an AI assistant could run on a schedule (a daily or weekly report, a draft queue) with my approval before anything sends.
4. What must never be automated (anything that sends money, signs agreements, or speaks for me without review).
5. Total hours saved per month and total new cost.

Keep the setup steps beginner-friendly.
```

**What you get back:** Each task tagged, a ranked list, setup steps for the top 5 (for example an auto-sent Square invoice and a templated quote reply), scheduled AI jobs, a never-automate list and the hours saved.

**Works in:** Zapier, Make, n8n, Claude, ManyChat, Google Apps Script

## Turn a repeat job into an AI skill

**Use it when:** You keep giving your AI the same instructions. Package them once as a reusable skill, project, or custom GPT.

**Fill in first:**

- `{{job}}`: The repeat job (for example: Writing captions for client Reels)
- `{{history}}`: Your past prompts and tweaks (for example: "shorter", "no emojis", "start with the hook not the gym name", "always end with the booking link", "less salesy")
- `{{good_example}}`: A great past result (for example: Your 6am crew is waiting. First class free this week. Link in bio.)

```text
I keep asking AI to do this job and re-explaining it every time. Package it as a reusable skill.

The job: {{job}}
The instructions and corrections I usually give (paste past prompts and tweaks): {{history}}
What a great result looks like (paste one if you have it): {{good_example}}

Write the skill with:
1. Name and a one-line description of when to use it.
2. Inputs it needs from me (as a short list).
3. Step-by-step instructions the AI follows.
4. Rules, including every correction from my history turned into a rule ("Always...", "Never...").
5. Output format.
6. A self-check the AI runs before showing me the result.
7. One worked example.

Keep it under 600 words so it loads fast. Then tell me where to save it in my AI tool.
```

**What you get back:** A named skill with inputs, steps, rules built from your five corrections, an output format, a self-check and an example, ready to save.

**Works in:** Claude Skills, Claude Projects, Custom GPTs

## Client onboarding kit

**Use it when:** You just closed a customer and want them to feel taken care of from minute one.

**Fill in first:**

- `{{offer}}`: What you sell (for example: Monthly bookkeeping for food trucks)
- `{{needs}}`: What you need from them (for example: Bank read access, Square login, last 3 months of receipts)
- `{{cadence}}`: How you work together (for example: Monthly report by the 5th, text for quick questions)

```text
Build my onboarding kit for new customers.

What I sell: {{offer}}
What I need from them to start: {{needs}}
How we'll work together: {{cadence}}

Write:
1. Welcome message (same day): thanks, what happens next, and when.
2. Intake form questions (no more than 10, plain language).
3. A kickoff call agenda (20 minutes).
4. A first-week timeline they can see.
5. The "first win" I deliver in the first 7 days, and how I tell them about it.
6. A check-in message for day 30 asking what's working and what to change.
7. A simple handover folder structure.

Warm, organized and short. Nothing that promises results I don't control.
```

**What you get back:** A welcome message, a 10-question intake, a kickoff agenda, a week-one timeline, a first-win plan, a day-30 check-in and a folder layout.

## Weekly CEO review

**Use it when:** Once a week, 20 minutes. Step out of the work and steer the business.

**Fill in first:**

- `{{business}}`: Your business (for example: Dog grooming van)
- `{{goal}}`: Your current goal (for example: 40 repeat customers on a 6-week schedule)

```text
Run my weekly CEO review. Ask me these one at a time and wait for each answer:
1. What were this week's numbers? (I'll paste them.)
2. What was the best thing that happened, and why did it work?
3. What was the worst, and what would I do differently?
4. What did customers say this week, word for word?
5. What am I avoiding?

Then write my review:
- Scorecard vs last week.
- Keep, stop, start.
- The one priority for next week and the first step, scheduled.
- One thing to systemize so it happens without me.
- One person to thank or reconnect with.

My business: {{business}}
My current goal: {{goal}}
```

**What you get back:** Five questions one at a time, then a scorecard, keep-stop-start, next week's priority with a first step, a system to build and a thank-you.

## First helper brief

**Use it when:** You're ready to pay someone for a few hours a week and want the job clear before you post it.

**Fill in first:**

- `{{work}}`: What to hand off (for example: Editing 12 short videos a week from my raw clips)
- `{{budget}}`: Hours and budget (for example: 10 hours a week, $20 to $25 an hour)
- `{{skills}}`: Must-have skills (for example: CapCut or Premiere, captions, fast turnaround)

```text
Help me hire my first helper.

What I want off my plate: {{work}}
Hours a week and budget: {{budget}}
Must-have skills: {{skills}}

Write:
1. A job post (under 200 words) that's honest about the work, hours, pay and how to apply.
2. A paid test task (under 2 hours) that shows if they can do the job.
3. A scoring sheet for the test.
4. Five interview questions about the job only: their past work, how they'd handle real tasks from this role, and their availability.
5. Their first-week plan and the SOPs they'll need.
6. Red flags to watch for in their work samples and the test.

Keep it fair: clear pay, no unpaid trial work. Ask only about the job: no questions about salary history, criminal history, age, family, health or anything personal. Whether they should be a contractor (1099) or an employee (W-2) depends on how the work is done: tell me to ask a pro (an accountant or employment lawyer) before I decide, and don't decide it for me.
```

**What you get back:** A job post, a paid 90-minute edit test with a scoring sheet, interview questions, a first-week plan and red flags.

## 90-day plan

**Use it when:** At the start of a quarter, or when you are busy every day but not sure the business is moving.

**Fill in first:**

- `{{today}}`: Where the business is today (for example: Mobile dog grooming van, about 30 regular clients, booked 4 days a week)
- `{{outcome}}`: What you want true in 90 days (for example: Booked 5 days a week with a waitlist)
- `{{capacity}}`: Weekly hours and budget (for example: 45 hours a week, $1,500 for the quarter)
- `{{list}}`: Everything on your plate or idea list (for example: Second van, Instagram reels, a dog treat line, referral program, new website, hire a bather, apartment complex partnerships)

```text
Help me build a one-page plan for the next 90 days. If anything below is unclear, ask me up to three questions first, then write it.

Where the business is today (numbers if I have them): {{today}}
What I want to be true in 90 days: {{outcome}}
Hours a week I can put in, and budget: {{capacity}}
Everything on my plate or my idea list right now: {{list}}

Give me:
1. One outcome for the quarter, rewritten so it's specific and I can check it on day 90. If it depends on things I don't control, add the actions I do control that drive it.
2. Three priorities that get me there, no more. For each: why it matters, the first step this week, and how I'll know it's working by day 30.
3. The stop list: everything from my list that isn't one of the three, with a one-line reason. These wait until next quarter.
4. What each priority looks like by week 4, week 8 and week 13.
5. The one number to check every Monday, and the level that tells me to change course.
6. The biggest risk to the plan and what I'll do if it shows up.

Fit it to my hours. If the plan needs more time than I have, cut, don't cram.
```

**What you get back:** A day-90 outcome tied to booked days and waitlist names, three priorities (referrals, apartment partnerships, a bather to free your hands), a stop list with the second van and treat line on it, week 4, 8 and 13 checkpoints and the Monday number.

**Works in:** Google Docs, Notion

## Monthly retro

**Use it when:** At the end of a month, or 30 days into a new plan. See what moved, why, and plan the next 30 days around what worked.

**Fill in first:**

- `{{plan}}`: What you planned this month (for example: Post 3 reels a week, send 20 DMs a week to local cafes, launch a $15 latte art workshop)
- `{{happened}}`: What actually happened, with numbers (for example: Posted 5 reels total, sent 60 DMs, 4 replies, 1 cafe booked a staff training for $200. Workshop not launched. Followers 410 to 455.)
- `{{felt}}`: What drained you, what you enjoyed, where time went (for example: DMs felt awkward but worked. Editing each reel took 3 hours.)

```text
Run a 30-day retro with me. Be honest, not a cheerleader.

What I planned to do this month: {{plan}}
What actually happened (what I did, and my numbers at the start and end): {{happened}}
How it felt (what drained me, what I enjoyed, where my time went): {{felt}}

1. Scorecard: each thing I planned, marked done, partly done or not done, in a table.
2. What moved my numbers and what didn't, based only on what I told you. Keep what I can show apart from what's a guess.
3. Why: for each thing that didn't happen, the likely real reason (time, skill, fear, wrong priority, outside events). Ask me one question if the reason isn't clear.
4. Keep, stop, start: three short lists.
5. The next 30 days: one focus, at most three actions with dates, and the one number to watch.
6. One sentence for me to read on day 1 of next month.

Keep it under 400 words.
```

**What you get back:** A scorecard, cafe DMs flagged as what moved (one $200 booking from 60 messages), reels flagged as slow for the time they take, the workshop gap traced to time, keep, stop and start lists and a next-30 plan built on DMs.

## Saved replies for the questions you get every day

**Use it when:** You have typed the same answer to a DM or email three times. Write it once, save it where you reply.

**Fill in first:**

- `{{business}}`: Your business and how you talk (for example: Rivera Sneaker Care, sneaker cleaning and restoration, ships nationwide, friendly and casual)
- `{{questions}}`: Questions you get, in their words (for example: "How much for a deep clean?" "How long does it take?" "Can you fix yellow soles?" "Do you ship?" "Can you do suede?")
- `{{facts}}`: Prices, hours, turnaround, how to book or pay, links (for example: Deep clean $35 a pair, sole unyellowing $25, suede $45, back in 5 days plus shipping, prepaid label at riverasneaker.co/ship)
- `{{apps}}`: Where you reply (for example: Instagram DMs, TikTok, Gmail)

```text
Help me write saved replies for the questions customers ask me over and over.

My business and how I talk: {{business}}
Questions I get, in their words (paste real messages if you can): {{questions}}
My facts (prices, hours, turnaround, how to book or pay, links): {{facts}}
Where I reply: {{apps}}

1. Group the questions and pick the five that come up most. If I gave fewer, suggest the likely missing ones and mark them as guesses.
2. For each, write a saved reply under 60 words: the answer in the first two lines, then one question or next step. Start each with a [personal line] slot so it reads as written for that person.
3. Give each reply a short shortcut name (like /price) to type in the app.
4. For anything custom (a quote, a special request), write a reply that asks one or two questions before giving a price.
5. Write one reply for when I can't help, pointing them somewhere useful.
6. Tell me where to save these in each app I listed, step by step, and note anything that needs a business or professional account. Tell me to check the app's help page if a menu has moved.

Rules: sound like me, not a bot. I read and personalize each reply before sending. If I ever set replies to send automatically, they must say they're automated.
```

**What you get back:** Five replies under 60 words with shortcuts like /price and /ship, a two-question reply for custom restorations, a polite "can't help" reply and save steps for Instagram, TikTok and Gmail.

**Works in:** Instagram, TikTok, WhatsApp Business, Gmail, Facebook Messenger

## Booking link setup

**Use it when:** A short call or appointment is the next step with buyers, and agreeing on a time takes too many messages.

**Fill in first:**

- `{{booking}}`: What people book (for example: A free 15-minute fit call by video for my online Spanish tutoring)
- `{{availability}}`: When you want to be bookable (for example: Tuesday and Thursday 4 to 6pm, Saturday 9 to 11am, Central time)
- `{{tool}}`: Booking tool (for example: Calendly free plan)
- `{{need_to_know}}`: What you need to know before you meet (for example: Their level, their goal (travel, work, family) and when they could take lessons)

```text
Help me set up one booking link so people can book with me without the back-and-forth.

What people book (call or appointment, length, in person or online): {{booking}}
When I want to be bookable (2 or 3 blocks a week is plenty for calls): {{availability}}
The tool I use or want to use: {{tool}}
What I need to know before we meet: {{need_to_know}}

Give me:
1. The booking page settings: event name, length, location or video link, my time blocks, buffers before and after, minimum notice, how far ahead people can book, and a daily limit.
2. Two intake questions, no more, that tell me what I need, and why each one helps.
3. Step-by-step setup in my tool. Note which features need a paid plan, and tell me to check current pricing since plans change.
4. Copy for: the confirmation, a reminder for the day before (to send myself if my plan doesn't send reminders), a no-show follow-up and a reschedule note.
5. Where to put the link: my bio, email signature, website, saved replies and quote follow-ups.
6. A test checklist: book a slot from my phone, check the time zone, check the calendar event and the confirmation.
```

**What you get back:** Calendly settings for a 15-minute call inside your three blocks with 10-minute buffers and 12 hours notice, two intake questions (level and goal), setup steps with paid features noted, four ready messages, link placements and a test checklist.

**Works in:** Calendly, Cal.com, Google Calendar, Square Appointments
