# Admin assistant (`admin`)

The paperwork around running the business: meeting notes into tasks and follow-ups, an inbox sorted with reply drafts, a week planned from the calendar, today's top 3, payment reminders, checklists from a voice note, a hiring kit and a contract checklist. Drafts only: nothing is sent, booked, signed or changed in any account. No keys needed. `held: true`: the harness registers the pack only when `PACKS_ON` names it. `uses: ['ops']` for the checklist writer.

## Workflows

| id | title | tier | minutes | steps | credits per run |
|---|---|---|---|---|---|
| admin.meeting_notes | Meeting notes to tasks | free | 3 | notes (admin.meeting_notes) | 2 |
| admin.email_triage | Sort my inbox | builder | 4 | read (admin.read_inbox) > sort (admin.triage) | 3 |
| admin.weekly_plan | Plan my week | builder | 4 | plan (admin.week_plan) | 1 |
| admin.top_three | Today's top 3 | free | 2 | top (admin.top_three) | 0 |
| admin.invoice_chase | Chase unpaid invoices | builder | 4 | read (admin.read_invoices) > chase (admin.chase_drafts) | 1 |
| admin.sop | Voice note to checklist | builder | 4 | tidy (admin.clean_notes) > sop (ops.sop) | 4 |
| admin.hiring_kit | Write a hiring kit | builder | 4 | kit (admin.hiring_kit) | 3 |
| admin.contract_check | Check a contract | builder | 3 | check (admin.contract_check) | 0 |

## Tools

| tool | kind | credits | what it does |
|---|---|---|---|
| admin.meeting_notes | ai, extract | 2 | Decisions, tasks (owner, due date), open questions and the next meeting from notes or a transcript (.txt, .vtt, .srt, .docx). AI items must come from the notes (most of their words appear there, owners are named there) or the rules in `lib/meeting.js` are used. Recap and per-person emails are templates. Saves a notes page (HTML) and tasks (CSV). |
| admin.read_inbox | code | 0 | Pasted emails, a .txt, or a ZIP of .eml files or an .mbox export (the Library keeps .zip and .txt, not .eml or .mbox): headers, multipart, quoted-printable, base64, encoded subjects; keeps the newest part of each thread. 40 messages at a time. Never connects to a mailbox. |
| admin.triage | ai, classify + write | 3 | Reply today, this week, FYI or ignore, with a reason for each; a reply draft for each "today" one. Rules in `lib/triage.js` when AI is off. AI drafts that promise a refund, payment or fault, or fail the copy rules, go back to the template (with [brackets] for what only the member knows). |
| admin.week_plan | code | 1 | Reads the .ics (`lib/ics.js`), finds free blocks inside work hours, places tasks by due date, priority, who is waiting and money, and flags double-booked days, days 80% booked or more, events past work hours and days with no free hour. Saves a plan (HTML) and the task blocks as an .ics to import if the member wants. |
| admin.top_three | code | 0 | Scores tasks: late or due soon, marked "!", someone waiting, money, quick wins. Says why for each pick and what could wait. |
| admin.read_invoices | code, wants stripe | 0 | Unpaid invoices from a CSV export (column names from QuickBooks, Wave, FreshBooks, Square, Stripe or a sheet) or typed lines. Skips paid, void and draft rows; uses the open balance for part-paid ones; a missing due date is invoice date plus 30 days (changeable). |
| admin.chase_drafts | code | 1 | One reminder per late invoice by stage: nudge (1 to 14 days), second (15 to 30), firmer (31 to 60, a date to pay by), firmer (61+, pay or reply by a date). Templates only. |
| admin.clean_notes | code | 0 | Drops timestamps, speaker labels, filler and repeated words from a transcript, and names the job. |
| admin.hiring_kit | ai, write | 3 | Job post with the pay range, five screening questions, a paid test task and a scorecard filled in by hand. |
| admin.contract_check | code | 0 | Pasted text, .docx, .txt or .html. What to look for by kind (work for a client, a contractor, something you buy, an NDA, other), found or not found, wording to look at with the sentence quoted, and questions for a lawyer. |

## Reading real files without packages

- `.ics` (`lib/ics.js`): line unfolding, escapes, VALARM skipped, DTSTART with TZID (IANA names and Outlook's Windows names like "Pacific Standard Time"), UTC "Z" times, floating times in the member's zone, all-day and multi-day events, DTEND or DURATION, RRULE FREQ=DAILY and WEEKLY with INTERVAL, COUNT, UNTIL and BYDAY (MONTHLY on the same day too), EXDATE, RECURRENCE-ID moves, STATUS:CANCELLED, TRANSP:TRANSPARENT. Other repeats use their first date and say so. Times stay right across daylight saving changes (tested).
- Email (`lib/email.js`), Word (`lib/doc-text.js`, reads the ZIP's central directory), CSV (`lib/csv.js`). PDFs and Excel files get a plain message on how to save them as text or CSV.

## Legal rules built in (L76, with tests in `test/admin.test.js`)

- **F5, payment reminders**: every draft says what is due (amount and invoice), when it was due and how to pay. `noThreat()` blocks legal, lawyer, court, sue, collections, credit report, lien, garnish, penalty, late fee, interest, final notice, demand and similar words; a draft that trips it stops the run. No late fee is ever added, even when the CSV has a fee column.
- **R6, hiring**: the tool takes no applicant data and never reads, ranks, scores or screens anyone. Questions are checked against age, family, health, religion, national origin, race, sex, arrest or conviction record, pay history, discharge type and membership (`lib/hiring.js`); the post against stand-ins like young, energetic, recent grad, digital native and native English speaker. AI output that fails any check is replaced by the templates. The post always shows a pay range line (a placeholder and a note when none is given). The worker-status note ends with "Ask a pro."
- **Row 9 (C3, C4), contracts**: the checklist names facts (names, dates, price, scope, payment) and topics. For legal terms (ending it, changes, limits on what either side could owe, disputes, ownership, confidentiality, promises after the job) it only says "Ask a lawyer about this." It never writes, changes or recommends terms and never says whether something is legal or enforceable. Leases are not a kind it checks: a lease gets a note to have a lawyer read it. Every result carries the not-legal-advice line and the ABA lawyer referral directory link.
- **Stripe**: `read_invoices` lists `wants: ['stripe']`; the reader is in `lib/stripe-reader.js` on its own and stays off (`READ_STRIPE = false`) while held, so the pack reads the member's CSV. When turned on it only reads open invoices.

## What goes to an AI call

meeting_notes (the notes, the meeting name and first names), triage (up to 40 emails: sender name and address, subject, date and the newest 1,200 characters of each; then the "reply today" ones for drafts), hiring_kit (role, hours, place, duties and business name; never pay, never applicant data), and admin.sop through ops.sop (the tidied transcript). Week plan, top 3, invoices and contracts are code only: calendar events, invoices and contracts never go to AI. Nothing is kept beyond the run's own files.

## Real vs sample

Every tool runs with nothing added: it uses the sample files and sets `sample: true` (fictional Rivera Landscaping, Austin TX: `sample/meeting-notes.txt`, `inbox.mbox`, `message.eml`, `calendar.ics` (moved to the week being planned), `tasks.txt`, `invoices.csv` (days late kept the same), `voice-note.txt`, `contract.txt`).

## Kit and harness asks

1. Library upload types: add `message/rfc822` (.eml) and `application/mbox` (.mbox) so members can add saved email without zipping it first. Until then the inbox workflow takes a ZIP or a .txt.
2. A kit `ics` reader: `lib/ics.js` here (RRULE daily and weekly, all-day, TZID with Windows names, EXDATE, RECURRENCE-ID) could move to the kit next to the kit's `.ics` writer.
3. A kit `dates.findDate` ("by Friday", "next Tue", "Oct 22", "EOD"): `lib/dates.js` here.

## Run it

```
node dev/run.js admin.weekly_plan --out /tmp/admin-work/out
node --test packs/admin/test/admin.test.js
```
