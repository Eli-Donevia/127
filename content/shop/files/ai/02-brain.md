# Business brain: give your AI the context once

The fastest way to skip prompting is to stop re-explaining your business. These prompts build a "business brain" (a Notion page, an Obsidian vault, or a project in Claude or ChatGPT) that every other prompt can read.

## Interview me into a business brain

**Use it when:** Day one with any AI tool. Twenty minutes of answering questions saves you hours of re-explaining later.

**Fill in first:**

- `{{starting_point}}`: One line to start the interview (for example: I edit short videos for gyms and I'm trying to land my first 5 monthly clients.)

```text
Interview me so you can write a "business brain" document that any AI can read before helping me.

Ask me one question at a time. Wait for my answer. Ask a sharper follow-up when my answer is vague. Cover, in this order:
1. What I sell, to whom, and the price.
2. Why customers buy, in their words. Who I'm not for.
3. My goal for the next 90 days, as a number I control (messages sent, calls booked, sales made).
4. My channels: where customers come from today.
5. My voice: three words for how I sound, words I never use, an example of something I wrote that sounds like me.
6. My tools and accounts.
7. My constraints: hours, budget, anything off-limits.
8. My principles: how I make decisions and how I treat customers.
9. What's already decided, so nobody re-asks it.

Start with: {{starting_point}}

When I say "done", write the business brain as one document with these headings: Business, Customer, Offer and pricing, Goal and the number I track, Channels, Voice, Tools, Constraints, Principles, Decisions log, Open questions. Keep it under two pages. Use my words where you can. Then tell me where to paste it so you and other AI tools read it every time.
```

**What you get back:** About 15 questions, one at a time, then a two-page business brain you paste into your Claude or ChatGPT project instructions, Notion or Obsidian.

**Works in:** Claude Projects, ChatGPT Projects, Notion, Obsidian

## Write my AI workspace instructions

**Use it when:** You have a business brain and want your AI to follow your rules automatically in every chat (project instructions, custom instructions or a CLAUDE.md file).

**Fill in first:**

- `{{brain}}`: Paste your business brain (for example: (the document from "Interview me into a business brain"))
- `{{where}}`: Where the instructions will live (for example: Claude project instructions)

```text
Turn my business brain into standing instructions for my AI workspace. These instructions will load before every conversation, so they must be short, specific and testable.

My business brain:
{{brain}}

Where they'll live: {{where}}

Write, in this order:
1. Role: one sentence on who you are for my business.
2. Context: the five facts you must always remember.
3. Principles: up to eight rules for how to work (for example: lead with the answer, finish the work instead of describing it, state assumptions, ask at most one question when blocked).
4. Operating procedures: for my three most common jobs, the steps you follow.
5. Acceptance criteria: the checklist every output must pass before you show it to me (voice, accuracy, no made-up facts or results, a clear next action).
6. Never: things you must never do (promise results, invent numbers or reviews, send anything without my OK).
7. Output defaults: length, format, and how to end each answer.

Keep it under 500 words. Then give me three test prompts I can run to check the instructions work.
```

**What you get back:** A sub-500-word instruction set with role, context, principles, procedures, acceptance criteria and never-do rules, plus three test prompts.

**Works in:** Claude Projects, ChatGPT custom instructions, Claude Code (CLAUDE.md)

## Set up my second brain (Notion or Obsidian)

**Use it when:** You want one place where decisions, files, numbers and lessons live, laid out so an AI can find the right context fast.

**Fill in first:**

- `{{app}}`: Notion or Obsidian (for example: Obsidian)
- `{{business}}`: Your business in one line (for example: Digital planner templates sold on Etsy and my own Shopify store)
- `{{existing}}`: What you have now and where (for example: Notes app ideas, a Google Sheet of sales, Canva folders, DMs with customers)

```text
Design a second brain for my business in {{app}}. It should be simple enough that I actually keep it up, and organized so an AI can pull the right context with the source.

My business: {{business}}
What I already have scattered around: {{existing}}

Give me:
1. The folder or page structure, as a tree. Include: Business brain (the one-page summary), Customers, Offers, Content, Sales pipeline, Numbers (weekly scorecard), Decisions (one note per decision), Meetings and calls, Lessons, SOPs, Templates, Archive.
2. A naming rule for files and notes, with dates, so they sort and search well.
3. Templates for: a decision note, a meeting note, a weekly review, an SOP, a customer note. Each template has the fields an AI would need (date, who, what was decided, why, what changes, link to source).
4. Where to move each thing I already have.
5. A 10-minute weekly routine to keep it current.
6. How to give my AI access: what to export or connect, and what to keep private.

Keep it to what one person can maintain. No more than 12 top-level folders.
```

**What you get back:** A vault tree, naming rules, five note templates, a move-in plan for your scattered files, a weekly routine and an AI access plan.

**Works in:** Obsidian, Notion, Google Drive

## Turn a call, voice note or meeting into actions

**Use it when:** Right after a sales call, client meeting, or a voice memo of ideas. Paste the transcript or notes.

**Fill in first:**

- `{{source}}`: What it was (for example: a discovery call with a gym owner)
- `{{transcript}}`: Paste the transcript or notes (for example: (paste from Granola, Otter or your voice memo app))
- `{{voice}}`: Three words for how you sound (for example: direct, friendly, short)

```text
Here is a transcript or rough notes from {{source}}:

{{transcript}}

Turn it into:
1. Summary: five lines max.
2. Decisions made, each with who decided and why.
3. Action items as a checklist: owner, task, due date. If no date was said, suggest one and mark it "suggested".
4. Follow-up message to send the other person, ready to paste, under 120 words, in my voice: {{voice}}
5. Anything said that should update my business brain (new pricing, new objection, a customer quote worth keeping). Quote it word for word.
6. Open questions nobody answered.

Don't add anything that wasn't said. If something is unclear, list it under open questions instead of guessing.
```

**What you get back:** A five-line summary, decisions, a dated checklist, a ready follow-up message promising the sample, brain updates (the January goal, the budget objection) and open questions.

**Works in:** Granola, Wispr Flow, Voice memos, Otter

## Weekly lessons and decisions log

**Use it when:** Every Friday or Sunday. Ten minutes to record what you learned so you stop relearning it.

**Fill in first:**

- `{{week}}`: What happened this week, rough notes are fine (for example: Sent 80 DMs, 6 replies, all from gyms that post less than once a week. Two calls, one yes at $350. Email got 0 replies.)

```text
Help me close out my week. Here's what happened:

{{week}}

Write three short sections for my business brain:
1. Lessons: what worked, what didn't, and why. Each lesson is one line starting with a verb ("Send the sample first", "Stop cold-calling after 6pm").
2. Decisions: anything I decided or should decide now, as a decision note (date, decision, why, what changes, how I'd undo it).
3. Do more of: the one thing that worked best this week and how to do twice as much of it next week.

Then ask me the one question that would make next week better, and stop.
```

**What you get back:** Verb-first lessons (target gyms that rarely post, drop cold email for now), a decision note, a "do twice as much" plan and one sharp question.
