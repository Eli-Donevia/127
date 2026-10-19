# Email desk (`email`)

Emails that run on their own, written from the member's facts: a welcome series, a launch week and
abandoned cart reminders, each as an email kit page (copy blocks, schedule, paste steps for Kit,
Mailchimp, Klaviyo and beehiiv, CAN-SPAM and Gmail rules), one designed HTML email per send, a
plain-text file and a CSV with the send schedule. Plus 30 subject lines with spam checks.

## Workflows

| id | title | tier | credits per run |
|---|---|---|---|
| email.welcome | Welcome emails | builder | 8 |
| email.launch_week | Launch week emails | builder | 8 |
| email.abandoned_cart | Abandoned cart emails | builder | 8 |
| email.subject_lines | Subject lines that get opened | free | 3 |
| email.nurture | Nurture emails | builder | 8 (2 files: kit page, CSV) |
| email.win_back | Win-back emails | builder | 8 (2 files: kit page, CSV) |
| email.newsletter | Monthly newsletter | builder | 8 (2 files: kit page, designed email); repeats on the 1st at 9am |

- **Nurture** (20 min): six weekly emails for people who haven't bought yet. The member's own lines ("What you tell customers") go in word for word: a tip opens email 1, a line with don't, never or mistake opens email 2, a question becomes email 4's subject. The rest stays in [brackets]: a real story (first name, with their OK), the straight answer, three questions to ask any provider, and a plain invite with the brain's price.
- **Win-back** (15 min): three dated broadcasts to past customers (day 1, day 5 and day 11 from the first send date, the next weekday when none is given; if the OK comes after the first date, the series moves forward instead of landing in the past). Email 2 uses the member's welcome-back offer only when they typed a real one; email 3 asks "Should I keep emailing you?" with the unsubscribe link, and the page says how to pull up past customers, tag them and drop the ones who never open.
- **Newsletter** (15 min): one issue (a short note, what's new, a tip, coming up, one button), named for the month it's made in. Safe to repeat with the same answers: `build_emails` remembers what the issue used (`ctx.remember('newsletter_last', { month, news, tip, coming })`), and next month's run puts any line that matches back as a [bracket] with a note. Every file name carries the date.

Sequence steps: `write_sequence` > approve emails (each email editable as "Subject: / Preview: / body") > `build_emails`.

## Tools: inputs and outputs

- `email.write_sequence` (ai write, 6): in `kind` (welcome|launch|cart|nurture|winback|newsletter), `offer`, `link`, `launch`, `date` (YYYY-MM-DD, required for launch), `closeDate`, `shipping`, `returns`, `discount` (cart's code or win-back's offer), `topic`, `tips` (nurture, one per line), `news` (win-back, newsletter), `tip`, `coming` (newsletter), `start` (win-back's first send, YYYY-MM-DD). Out `emails` {n, when, day, hours, date, time, subject, preview, body, button, link}, `items` (for the approve step), `brackets` (emails with a [bracket] to fill), `notes`.
  - welcome: 5 emails, days 0, 1, 3, 5, 7. launch: 6 emails, 7, 3 and 1 days before, launch day, 2 and 5 days after (a closing email only when a real `closeDate` is given). cart: 3 emails at 1, 24 and 72 hours. nurture: 6 emails, weekly (days 0 to 35). winback: 3 emails on dates (start, +4, +10). newsletter: 1 email.
- `email.build_emails` (code, 2): in `kind`, `items`, `platform` (kit|mailchimp|klaviyo|beehiiv|other), `offer`, `launch`, `date`, `color`, `since` (win-back), `start`, and the newsletter's `news`, `tip`, `coming` as typed. Out `page` (HTML kit), `html[]` (one 600px table email per send, inline styles, hidden preheader, bulletproof button, dark mode, the platform's unsubscribe and address tags), `txt`, `csv` (Email, Send, Send date, Send time, Hours after the previous email, Subject, Preview text, Body, Button, Button link), `ics` (launch only; the harness zips it). Nurture and win-back make only `page` and `csv` (days after the previous email); the newsletter makes `page` and one `html`; all three are dated, and their kit page adds "Who gets these" and names only the files it made.
- `email.subject_lines` (ai write, 3): in `topic`, `check` (optional subject to test). Out `lines[30]` {style, subject, preview, chars, flags, ok}, `csv`, `checked`.

## Real vs sample

- Everything runs with no keys: copy is built from the brain and inputs, unknowns stay in [brackets]. AI only rewrites in the member's voice and must keep every fact, link and bracket.
- No live data is read: these workflows only use what the member types. Nothing is sent; the member pastes into their own tool.

## Facts

`data/rules.json` (FTC CAN-SPAM guide, Google's sender guidelines) and `data/platforms.json` (free plan limits, merge tags, menu paths, Shopify's abandoned checkout default), each with sources, checked 2026-10-19. The CAN-SPAM penalty is quoted with its adjustment year and a "check the FTC page" note.

## Checked

HTML emails rendered with Playwright at 1280px and 390px, light and dark: no horizontal scroll, readable contrast both ways. Kit page rendered at 1280px and 390px. Oct 19: the win-back kit page at 900px and the newsletter email at 390px, run through the harness engine and `dev/run.js --example` (2 files each, 8 credits estimated).
