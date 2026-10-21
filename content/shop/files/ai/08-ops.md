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
