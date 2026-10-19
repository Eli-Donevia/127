# Warm outreach (`warm`)

Your first 25 customers start with people who already know you. Import contacts, sort them into
could buy, could refer or could advise from your own notes, get one personal text each with
one-tap Text links, then reach 25 people a day for 30 days. Reconnect with people you haven't talked
to in a while, ask happy customers and friends for referrals, see who to nudge today and answer
every reply. Everyone with a number or email lands in the Pipeline (`warm: true`, the text and two
nudges written), so Do my day can hand them out.

## Workflows

| id | title | tier | steps | credits per run |
|---|---|---|---|---|
| warm.first_25 | Your first 25: people you know | free | import_contacts, sort_contacts, approve (choose up to 25), write_messages, approve (edit each message), send_sheet | 8 |
| warm.daily_25 | Start 25 a day | builder | plan_days | 1 |
| warm.reconnect | Reconnect with people (10 min, job leads) | builder | write_reconnects, approve (edit each text), send_sheet (mode reconnect) | 6 |
| warm.referrals | Ask for referrals (10 min, job leads) | builder | write_referrals, approve (edit each ask), send_sheet (mode referrals) | 6 |
| warm.follow_up | Who to nudge today (5 min, job leads, suggested every morning) | builder | nudge_list | 1 |
| warm.reply | Answer a reply (2 min, job sales) | builder | answer_reply | 3 |

AI writes only the top 5 messages (one call, 5 credits); templates write the rest.

## Tools (inputs and outputs)

| tool | kind, credits, tasks | input | output |
|---|---|---|---|
| warm.import_contacts | code, 1 | contacts (required): vCard text (2.1, 3.0, 4.0), a Google (new or old) or Outlook contacts CSV, or pasted lines "name, phone, note" | format (vcard, csv, lines), read, merged, businesses, people (up to 800, under the step size limit)[{name,first,phones[],emails[],notes[],org,title,labels[]}] |
| warm.sort_contacts | code, 1 | people (required), what? | people[{rank,name,first,phone,email,group (buy, refer, advise),groupLabel,why,note,label,detail}] (top 200), counts{buy,refer,advise}, total |
| warm.write_messages | ai, 5, write | people (chosen, up to 25), what?, price? | items[{id,name,label,text,phone,email,group,why,segments}], ai |
| warm.send_sheet | code, 1 | items (required, the checked messages), mode (first_25, reconnect, referrals), forward?, thankYou?, what?, pipeline (default true) | files: send sheet .html (Text, Call, Email links, Sent and Replied boxes with a live count; reconnect adds "When they write back", referrals add the forward note and the thank-you), tracker .csv (follow-up date and reply rate formulas), nudges .ics (with alarms); count; saved (Pipeline rows) |
| warm.write_reconnects | ai, 5, write | people (required, pasted: name, phone or email, note; up to 25), what? | items[{id,name,label,text (catch-up, no pitch),after (what to say once they write back),nudge,nudge2,phone,email,note,group: reconnect,why,segments}], extra, businesses, unreachable, ai |
| warm.write_referrals | ai, 5, write | people (required), what?, thanks? (refused if it mentions a review), who?, phone? | items[{...,text (the ask),after (the note to forward),nudge,nudge2,group: customer or friend}], forward, thankYou, thanks, notes, ai |
| warm.nudge_list | code, 1 | messaged? (pasted: name, phone or email, when), what?, max (default 25) | due[{name,warm,n (1 or 2),days,text,fact,links,subject}], waiting (replies not answered), upcoming[{name,n,date}], written (nudges saved back with ctx.leads.update), added (pasted people saved as contacted, with or without a phone or email, so a repeat run skips them), total, file (who-to-nudge-YYYY-MM-DD.html, dated so daily repeats never overwrite each other) |
| warm.answer_reply | ai, 3, write | who (required), reply (required), what?, price? | name, intent (stop, no, referral, price, covered, later, who, yes, question, catchup, other), meaning, answer ('' for a stop), next, stop, pipeline (what changed), found, ai |
| warm.plan_days | code, 1 | perDay (5 to 100, default 25), goal? (up to 100), start? (YYYY-MM-DD, default tomorrow), time? (HH:MM, default 09:00), adsPerDay? | days[30]{day,date,phase,total,warm,cold,content,ads}, perDay, goal, files: tracker .html (tick boxes, live count), tracker .csv (formulas for totals, days hit, replies per 100), reminders .ics (30 daily events with alarms) |

## How it works

- Phones become +1 numbers; duplicates merge by phone or email (union-find); entries that look
  like businesses are set aside. Google "* myContacts" labels are dropped. An empty paste stops on
  the first step with "Paste at least one name"; names typed without a number or email still work
  (the member reaches them their own way) when nobody in the paste has one.
- Sorting uses only the member's notes, job title, company and labels. No notes means "could
  refer" with the reason "No notes yet". Ranking favors people you can text, close relations and
  people your notes say could buy.
- Messages: the member is the sender, straight apostrophes only (GSM-7, so one cheap SMS
  encoding), 2 text segments or fewer, a personal opener from the member's note, varied with
  `text.pickBy`. Asks are "want me to save you a spot", "do you know anyone who", or 15 minutes
  of advice. Nothing is ever sent for the member.
- 25 a day: days 1 to 10 mostly people you know, 11 to 20 half and half, 21 to 30 mostly new
  people; one post counts as 5. If a goal is set, the daily number steps up on day 11 and 21.
  Ads only appear when the member gives a budget, and only from day 11.

- Pipeline rows (contract 13, D29): key `person:<phone>` (else email, else name), `warm: true`,
  `msg.dm` (the text), `msg.follow1` and `msg.follow2` (gentle nudges), `msg.answer` for reconnects
  (the line that mentions the business once they reply), one fact (why they're on the list), a
  score (could buy 82, customer 78, could refer 66, friend 62, reconnect 60, could advise 55),
  channel `call` with a phone or `email` with only an email. People with no number or email stay on
  the sheet only. Texts to people the member knows carry no address or opt-out line (D28).
- Reconnect: the first text never mentions the business (a test checks); the hook comes from the
  note (moved to a city, new baby, married, new job, college, old team). AI may rewrite the top 5;
  any rewrite that sounds like a pitch goes back to the template.
- Referrals: a thank-you is for an intro that books, never for a review (D24); a thank-you that
  mentions a review, rating, stars or a testimonial is dropped with a note.
- Follow-ups: due 3 days after the first message and 4 after the second, none after the third (the
  harness rule); people you know first, most overdue first. Business nudges written here are
  saved back to the lead; their email version ends with name, business, the address placeholder
  and the opt-out (D28). Texts only go to people the member knows (no cold texts, FCC).
- Replies: a stop gets no answer and the person is marked lost (this pack's leads move with
  `upsert`; another pack's lead gets the reply and answer through `update`, and the member taps
  Lost or Replied). A typed name that isn't in the Pipeline is added as warm. AI fits the answer to
  what they said for the top cases, never with a price it wasn't given or a review ask.

## Real or sample

- Real: everything comes from what the member pastes. `lib/cal.js` writes .ics with VALARM
  reminders in the member's time zone.
- Sample: `sample/contacts.vcf` (also inside `sample/examples.json`) is fictional: 555-01xx
  numbers, .example emails, one duplicate and two businesses.

## Keys

None. With an AI key, one call rewrites the top 5 messages; each is checked and falls back to the
template.

## Verified

- `node dev/lint.js warm`: 0 errors. `node --test packs/warm/test/warm.test.js`: passes offline
  (vCard 2.1, 3 and 4, Google CSV, pasted lines, dedupe, sorting, message length and encoding,
  sheet formulas, 30 alarms).
- `node dev/run.js warm.first_25` and `warm.daily_25`; files opened and rendered at desktop and
  phone width.
- Harness engine `check` and `run` for both workflows (vCard input and pasted lines). This pack
  reads no public data, so it has no live run.

## Needs from the harness

- A file upload input for contacts (today the member pastes the export text).
- The Library keeps .ics only zipped today (`saveFile` wraps it); allowing text/calendar would hand
  it over directly.
- `sms:`, `tel:` and `mailto:` links must open from the sandboxed preview.
