# Follow-Up Reminders

*A short email every morning, read from your Pipeline Tracker, listing who to follow up with today and why, without ever messaging anyone for you.*

**Workflow recipe** · Grow track · Builder · 20 minutes

**You walk away with:** A daily reminder that covers due and overdue next steps plus day 3, 7 and 14 follow-ups, so every open conversation gets its next message.

**Use it:** Grow track week 3, when you send 20 outreach messages, or any time you have more than ten open conversations.

**Pairs with:** Outreach Scripts (playbook), Automation Starter Pack (playbook)

**When this happens:** Every morning at the hour you choose

**This happens:** One email listing who's overdue, who's due today and who's on day 3, 7 or 14. Nothing goes to them unless you send it

**Tools:** Google Sheets, Apps Script, Gmail · **Cost:** $0 with a free Google account. · **Setup:** about 15 minutes · **Tool details checked:** 2026-10

---

Most replies come after a follow-up, because people are busy, not because they said no. Most founders never send it, because they forget.

This recipe reads your Pipeline Tracker every morning and emails you a short list. You still write every message yourself.

## What this does

- Overdue: the next step date has passed.
- Due today: the next step date is today.
- Follow-ups: people in Messaged with no next step date, on day 3, day 7 and day 14 after your first message.
- Still open after 14 days: listed on Mondays only, so you can mark them Not now or set a next step.
- Won, Lost and Not now are skipped. No email on days when nobody is due.

Day 3, day 7 and day 14 match the follow-up columns in your Pipeline Tracker and the follow-up scripts in Outreach Scripts.

## Before you start

- [ ] Your Pipeline Tracker uploaded to Google Drive and saved as a Google Sheet (File, Save as Google Sheets).
- [ ] Every open row has a Stage.
- [ ] Everyone you've messaged has a First message date.
- [ ] 15 minutes on a computer.

## Set it up

1. In your Pipeline Tracker, open Extensions, then Apps Script.
2. Already running Lead Form Autopilot here? Click the plus next to Files, choose Script and name it follow-up-reminders. If not, delete the sample code.
3. Paste the whole script from 127-follow-up-reminders.gs, or from the end of this recipe. Click Save.
4. At the top, edit FOLLOW_UPS: the hour you want the email (8 means between 8 and 9 am) and whether to skip weekends.
5. In the menu next to Run, pick setupFollowUps. Click Run and allow the permissions. If you see "Google hasn't verified this app", click Advanced, then Go to the project. Every personal script shows that.
6. Pick sendFollowUps and click Run to get today's email right now.

> The email follows the script's time zone. In Apps Script, open Project Settings (the gear) and check the time zone matches where you live.

## The email

**What lands in your inbox** (copy and fill the [brackets])

```
Subject: Follow up today: 3 people

OVERDUE
- Coach Rivera (Instagram DM), Call booked
  Overdue since Tue Nov 10: 15-min call about team tutoring

DUE TODAY
- Ms. Chen (ms.chen@example.org), Replied
  Today: Send her my one-page offer to forward

FOLLOW-UPS
- Priya (referral), Messaged
  Follow-up 1 (day 3)
  Their words: Daughter struggling with geometry

Write each message yourself. Start with their problem, not your offer.
[link to your Pipeline Tracker]
```

## Write the follow-up yourself

Each follow-up should add something, not just bump the thread. Follow up after three days, once more after a week, then close the loop. Copy the scripts from Outreach Scripts and make the first line personal.

| Day | What to send | Then in the tracker |
| --- | --- | --- |
| Day 3 | A short, no-pressure nudge | Last contact today |
| Day 7 | Something useful: a tip, a link, a before and after | Last contact today |
| Day 14 | Close the loop kindly. You'll stop messaging. | Stage Not now, unless they replied |

## Keep the list right

- When you message someone, set Stage to Messaged and fill in First message.
- When you agree on a next step, write it down and give it a date.
- When it's decided, mark Won, Lost or Not now. They drop off the list.

## Test it

- [ ] Set one row's Next step date to today, run sendFollowUps and find it under Due today.
- [ ] Set it to yesterday and find it under Overdue.
- [ ] Mark it Won and watch it drop off.
- [ ] Triggers (the clock icon) shows one daily sendFollowUps trigger.

## Keep it human

> Automate the repeat, never the relationship. The script remembers for you. It never messages a lead. You do.

## If it breaks

- No email: maybe nobody was due. Set emptyDayEmail to true for a few days to check it runs.
- Someone you expected is missing: check their Stage. Only Messaged rows get day 3, 7 and 14 reminders, and only when the next step date is blank.
- Dates look a day off: fix the time zone in Project Settings.
- An error about the header row: the tab isn't named Pipeline, or the Name or Stage header changed.
- Something else: open Executions (the list icon) in Apps Script to see every run and error.

## Next step

Mondays are for numbers. Set up the Monday Scorecard Email next, so your weekly review starts in your inbox.

## Appendix: the script

Copy everything below, from the first line to the last, into Extensions > Apps Script. The same code is in the .gs file that comes with this recipe.

**Follow-Up Reminders script (127-follow-up-reminders.gs)**

```javascript
/**
 * @OnlyCurrentDoc
 * 127 Follow-Up Reminders
 *
 * Every morning, this script reads the Pipeline tab of your Pipeline Tracker and emails you
 * the people to follow up with today: next steps that are due or overdue, and day 3, day 7
 * and day 14 follow-ups for people who haven't replied. No email on days when nobody is due.
 * It never messages anyone for you. You write each follow-up yourself.
 *
 * Setup (full steps in the Follow-Up Reminders recipe):
 *   1. Your Pipeline Tracker must be a Google Sheet (File > Save as Google Sheets).
 *   2. Extensions > Apps Script, delete what's there, paste this file, edit FOLLOW_UPS, Save.
 *   3. Pick "setupFollowUps" in the function menu and press Run. Allow the permissions.
 *   4. Pick "sendFollowUps" and press Run once to see today's email.
 */

const FOLLOW_UPS = {
  hour: 8,                  // the email arrives between this hour and the next (24-hour clock)
  skipWeekends: false,      // true = no reminders on Saturday and Sunday
  emptyDayEmail: false,     // true = also email you on days when nobody is due
  pipelineTab: 'Pipeline',  // the tab name in your Pipeline Tracker
};

const FU_CLOSED = ['Won', 'Lost', 'Not now'];
const FU_DAY_MS = 24 * 60 * 60 * 1000;

/** Run once. Installs the daily trigger. */
function setupFollowUps() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sendFollowUps')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendFollowUps').timeBased().everyDays(1).atHour(FOLLOW_UPS.hour).create();
  const ss = SpreadsheetApp.getActive();
  fuHeaders_(fuSheet_(ss));
  fuSay_(ss, 'Follow-Up Reminders are on. Check your inbox each morning around ' + FOLLOW_UPS.hour + ':00.');
}

/** Builds and sends today's follow-up email. */
function sendFollowUps() {
  const ss = SpreadsheetApp.getActive();
  const today = fuStartOfDay_(new Date());
  const dow = today.getDay();
  if (FOLLOW_UPS.skipWeekends && (dow === 0 || dow === 6)) return;
  const list = fuDueToday_(ss, today);
  const total = list.overdue.length + list.today.length + list.followUps.length + list.stale.length;
  if (!total && !FOLLOW_UPS.emptyDayEmail) return;
  const sh = fuSheet_(ss);
  const link = ss.getUrl() + '#gid=' + sh.getSheetId();
  const subject = total ? 'Follow up today: ' + total + (total === 1 ? ' person' : ' people') : 'No follow-ups due today';
  MailApp.sendEmail(fuMe_(), subject, fuEmailText_(list, link, total));
}

/** Reads the Pipeline tab and sorts open rows into what needs you today. */
function fuDueToday_(ss, today) {
  const sh = fuSheet_(ss);
  const h = fuHeaders_(sh);
  const lastRow = sh.getLastRow();
  const out = { overdue: [], today: [], followUps: [], stale: [] };
  if (lastRow <= h.row) return out;
  const rows = sh.getRange(h.row + 1, 1, lastRow - h.row, sh.getLastColumn()).getValues();
  const get = (r, text) => { const c = fuCol_(h, text); return c ? r[c - 1] : ''; };
  rows.forEach((r) => {
    const name = String(get(r, 'Name')).trim();
    const stage = String(get(r, 'Stage')).trim();
    if (!name || FU_CLOSED.indexOf(stage) > -1) return;
    const person = {
      name: name,
      contact: String(get(r, 'Contact')).trim(),
      stage: stage || 'No stage',
      next: String(get(r, 'Next step')).trim(),
      problem: String(get(r, 'Their problem')).trim(),
    };
    const nextDate = get(r, 'Next step date');
    const first = get(r, 'First message');
    if (fuIsDate_(nextDate)) {
      const d = fuStartOfDay_(nextDate);
      if (d < today) out.overdue.push(Object.assign(person, { why: 'Overdue since ' + fuFmt_(d) + ': ' + (person.next || 'your next step') }));
      else if (d.getTime() === today.getTime()) out.today.push(Object.assign(person, { why: 'Today: ' + (person.next || 'your next step') }));
      return;
    }
    if (stage === 'Messaged' && fuIsDate_(first)) {
      const days = Math.round((today - fuStartOfDay_(first)) / FU_DAY_MS);
      const label = { 3: 'Follow-up 1 (day 3)', 7: 'Follow-up 2 (day 7)', 14: 'Close the loop (day 14)' }[days];
      if (label) out.followUps.push(Object.assign(person, { why: label }));
      else if (days > 14 && today.getDay() === 1) out.stale.push(Object.assign(person, { why: 'Day ' + days + ' with no reply. Mark Not now or set a next step.' }));
    }
  });
  return out;
}

function fuEmailText_(list, link, total) {
  const lines = [];
  const section = (title, people) => {
    if (!people.length) return;
    lines.push(title.toUpperCase());
    people.forEach((p) => {
      lines.push('- ' + p.name + (p.contact ? ' (' + p.contact + ')' : '') + ', ' + p.stage);
      lines.push('  ' + p.why);
      if (p.problem) lines.push('  Their words: ' + p.problem);
    });
    lines.push('');
  };
  if (!total) lines.push('Nobody is due today. Add new names, or check in with a past customer.', '');
  section('Overdue', list.overdue);
  section('Due today', list.today);
  section('Follow-ups', list.followUps);
  section('Still open after 14 days (Mondays only)', list.stale);
  lines.push('Write each message yourself. Start with their problem, not your offer.');
  lines.push('Then update Last contact and set the next step date, so tomorrow\'s list stays right.');
  lines.push('', 'Your Pipeline Tracker: ' + link);
  return lines.join('\n');
}

// ---------------------------------------------------------------- helpers

function fuSheet_(ss) {
  const sh = ss.getSheetByName(FOLLOW_UPS.pipelineTab);
  if (!sh) throw new Error('No tab named "' + FOLLOW_UPS.pipelineTab + '". Change pipelineTab in FOLLOW_UPS to match your tab name.');
  return sh;
}

/** Finds the header row (the one with Name and Stage) and maps header text to column numbers. */
function fuHeaders_(sh) {
  const top = sh.getRange(1, 1, Math.min(10, sh.getMaxRows()), sh.getLastColumn()).getValues();
  for (let r = 0; r < top.length; r++) {
    const row = top[r].map((v) => String(v).trim());
    if (row.indexOf('Name') > -1 && row.indexOf('Stage') > -1) {
      const cols = {};
      row.forEach((h, i) => { if (h) cols[h] = i + 1; });
      return { row: r + 1, cols: cols };
    }
  }
  throw new Error('Could not find the header row (a row with "Name" and "Stage") in the "' + sh.getName() + '" tab.');
}

/** Column number for a header, by exact text first, then by how the header starts. */
function fuCol_(h, text) {
  if (h.cols[text]) return h.cols[text];
  const key = Object.keys(h.cols).find((k) => k.indexOf(text) === 0);
  return key ? h.cols[key] : null;
}

function fuIsDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function fuStartOfDay_(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function fuFmt_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEE MMM d');
}

function fuMe_() {
  return Session.getEffectiveUser().getEmail();
}

function fuSay_(ss, msg) {
  console.log(msg);
  try { ss.toast(msg, '127', 8); } catch (err) { /* no open sheet to show it in */ }
}
```

---

Make today day one. **127** · 127group.io

*© 2026 127 Group LLC. For your own use as a 127 member.*
