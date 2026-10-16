# Lead Form Autopilot

*Every Google Form answer lands in your Pipeline Tracker with a next step for today, you get it by email, and they get an honest "got it".*

**Workflow recipe** · Build track · Builder · 30 minutes

**You walk away with:** A live form that logs each lead in your Pipeline Tracker within a minute, emails you their answers and promises them a real reply you keep.

**Use it:** Before your launch, once you have a landing page or bio link and leads arrive in more than one place.

**Pairs with:** Automation Starter Pack (playbook), The Simple Operations Stack (playbook)

**When this happens:** Someone submits your Google Form

**This happens:** They land in your Pipeline Tracker due today, you get their answers by email, and they get a two-line "got it" from your Gmail

**Tools:** Google Forms, Google Sheets, Apps Script, Gmail · **Cost:** $0 with a free Google account. · **Setup:** about 25 minutes · **Tool details checked:** 2026-10

---

A form answer that sits unread for two days is a customer you lost. This recipe puts every answer in your Pipeline Tracker and your inbox within a minute, with a next step due today.

The script does the copying. You write the reply.

## What this does

1. Someone fills in your Google Form: a quote request, a booking request or a waitlist.
2. Within a minute they appear in the Pipeline tab: Type Inbound, Stage To contact, next step "Reply personally to their form", due today.
3. You get an email with their answers and a link straight to their row.
4. If they gave an email, they get a two-line "got it" from your Gmail, signed with your name.

> The "got it" email promises a real reply. Only keep it on if you'll reply in the time it promises. If you won't, set sendConfirmation to false.

## Before you start

- [ ] A free Google account. The emails send from its Gmail.
- [ ] Your Pipeline Tracker uploaded to Google Drive and opened in Google Sheets. Then File, Save as Google Sheets. Scripts don't run on .xlsx files.
- [ ] A Google Form with five questions or fewer. Questions below.
- [ ] 25 minutes on a computer. Apps Script setup is painful on a phone.

## Write your form

Short forms get finished. Ask only what you need for your first reply. The script sorts answers by the words in each question, so keep these words in yours.

| Question | Must include | Goes to |
| --- | --- | --- |
| Your name | name | Name |
| Email | email | Contact, and the "got it" email |
| Phone or Instagram (optional) | phone, Instagram or handle | Contact |
| What do you need help with? | help, need or looking | Their problem, in their words |
| Anything else? (optional) | any other words | Notes |

- Make the email question required if you want the "got it" email to go out.
- Ask what they need in their own words. Those answers become your headline later.
- Put the form link where people already are: your bio link, your landing page button, a pinned post and your Saved Replies.

## Set it up

1. Open your Google Form. Go to Responses, then Link to Sheets. Choose Select existing spreadsheet and pick your Pipeline Tracker. A form responses tab appears. Leave it as it is.
2. In your Pipeline Tracker, open Extensions, then Apps Script. A new tab opens.
3. Delete the sample code. Paste the whole script from 127-lead-form.gs, or from the end of this recipe.
4. At the top, edit LEAD_FORM: your first name and a reply promise you'll keep. Click Save.
5. In the menu next to Run, pick setupLeadForm. Click Run.
6. Google asks for permission. Click Review permissions and pick your account. If you see "Google hasn't verified this app", click Advanced, then Go to the project. Every personal script shows that warning. Click Allow.
7. Pick testLead in the menu and click Run. Check your inbox and the Pipeline tab.
8. Delete the test row. Then submit your real form once from your phone and watch it arrive.

> What you're allowing: the script edits this one spreadsheet, sends email as you and runs when you're not there. It can't read your inbox. Read it before you paste it. Every part is labeled.

## The settings

| Setting | What it does |
| --- | --- |
| yourName | Signs the "got it" email. |
| sendConfirmation | true sends the "got it" email. false never emails them. |
| replyPromise | The promise in that email, like "within one day" or "by tomorrow night". |
| notifyMe | true emails you every new lead. |
| pipelineTab | The tab it writes to. Change it only if you renamed the tab. |
| howYouKnow | What goes in How you know them, like "Website form". |

## The emails

**What they get, from your Gmail** (copy and fill the [brackets])

```
Subject: Got it, [first name]

Hi [first name],

Thanks for reaching out about "[what they need]". I read every message myself, and I will reply within one day.

[Your name]
```

**What you get** (copy and fill the [brackets])

```
Subject: New lead: [name]

Name, contact, what they need and any other answers,
plus a link straight to their row in your Pipeline Tracker.
```

## Reply like a person

The automation stops at your inbox. The reply is you. Answer what they asked, use their words and give one next step.

**Your first reply (you send this yourself)** (copy and fill the [brackets])

```
Hey [name], thanks for filling in the form. You said [their words]. [One or two lines that answer it.] Want me to [send a quote / hold Saturday at 10 / book a 10-minute call]?
```

Then update their row: Stage Messaged, First message today and a next step date. Follow-Up Reminders picks it up from there.

## Test it

- [ ] testLead added a row with Stage To contact and today as the next step date.
- [ ] The New lead email arrived and its link opens the right row.
- [ ] The test "got it" email arrived in your own inbox.
- [ ] A real submission from your phone shows up within a minute or two.
- [ ] You deleted the test rows.

## Keep it human

> Automate the repeat, never the relationship. The script copies answers and sends one honest receipt. Every real answer comes from you.

## If it breaks

- Nothing happens when someone submits: in Apps Script, open Triggers (the clock icon) and check there's one onLead trigger. No trigger? Run setupLeadForm again.
- You got an email saying it hit a problem: the tab isn't named Pipeline, or the Name or Stage header changed. Fix the tab name in LEAD_FORM, or change the header back.
- Answers land in the wrong columns: reword the question so it includes the words in the table above.
- The "got it" email never arrived: the email answer was blank, or it went to spam. Test with a friend's address.
- Something else: open Executions (the list icon) in Apps Script. Every run and every error is listed there.
- Free Google accounts can email about 100 people a day from scripts. That's plenty for leads.

## Next step

Turn on Follow-Up Reminders in the same Pipeline Tracker, so nobody who reached out falls through the cracks.

## Appendix: the script

Copy everything below, from the first line to the last, into Extensions > Apps Script. The same code is in the .gs file that comes with this recipe.

**Lead Form Autopilot script (127-lead-form.gs)**

```javascript
/**
 * @OnlyCurrentDoc
 * 127 Lead Form Autopilot
 *
 * When someone fills in your Google Form, this script:
 *   1. adds them to the Pipeline tab of your Pipeline Tracker, with "Reply personally" due today,
 *   2. emails you their answers and a link to the sheet,
 *   3. sends them a short "got it" email (optional), so they know a real person will reply.
 * You still write the real reply yourself. Automate the repeat, never the relationship.
 *
 * Setup (full steps in the Lead Form Autopilot recipe):
 *   1. Your Pipeline Tracker must be a Google Sheet (File > Save as Google Sheets).
 *   2. Link your Google Form to it (Form > Responses > Link to Sheets > Select existing spreadsheet).
 *   3. Extensions > Apps Script, delete what's there, paste this file, edit LEAD_FORM, Save.
 *   4. Pick "setupLeadForm" in the function menu and press Run. Allow the permissions.
 *   5. Pick "testLead" and press Run. Check your inbox and the Pipeline tab, then delete the test row.
 */

const LEAD_FORM = {
  yourName: 'Your first name',     // signs the "got it" email
  sendConfirmation: true,          // false = never email the person automatically
  replyPromise: 'within one day',  // only promise what you will actually do
  notifyMe: true,                  // email you every new lead
  pipelineTab: 'Pipeline',         // the tab name in your Pipeline Tracker
  howYouKnow: 'Lead form',         // written in "How you know them"
};

/** Run once. Installs the form trigger and checks your Pipeline tab. */
function setupLeadForm() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'onLead')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onLead').forSpreadsheet(ss).onFormSubmit().create();
  const sh = lfPipelineSheet_(ss);
  lfHeaders_(sh);
  lfSay_(ss, 'Lead Form Autopilot is on. New form answers go to the "' + LEAD_FORM.pipelineTab + '" tab.');
}

/** Runs on every form submission. */
function onLead(e) {
  const ss = SpreadsheetApp.getActive();
  try {
    const answers = (e && e.namedValues) || {};
    const lead = lfReadAnswers_(answers);
    const sh = lfPipelineSheet_(ss);
    const row = lfAddToPipeline_(sh, lead);
    const link = ss.getUrl() + '#gid=' + sh.getSheetId() + '&range=A' + row;
    if (LEAD_FORM.notifyMe) lfNotifyMe_(lead, link);
    if (LEAD_FORM.sendConfirmation && lead.email) lfConfirm_(lead);
  } catch (err) {
    MailApp.sendEmail(lfMe_(), 'Lead Form Autopilot hit a problem', 'A form answer came in but could not be added.\n\n' + err +
      '\n\nThe answer is still in your form responses tab. Check that the Pipeline tab name and headers match the script.');
    throw err;
  }
}

/** Run this from the editor to test without filling in the form. */
function testLead() {
  onLead({ namedValues: {
    'Timestamp': [new Date().toString()],
    'Your name': ['Test Lead'],
    'Email': [lfMe_()],
    'What do you need help with?': ['Testing my lead form. Delete this row.'],
  } });
  lfSay_(SpreadsheetApp.getActive(), 'Test lead added. Check your inbox, then delete the test row.');
}

// ---------------------------------------------------------------- helpers

function lfPipelineSheet_(ss) {
  const sh = ss.getSheetByName(LEAD_FORM.pipelineTab);
  if (!sh) throw new Error('No tab named "' + LEAD_FORM.pipelineTab + '". Change pipelineTab in LEAD_FORM to match your tab name.');
  return sh;
}

/** Finds the header row (the one with Name and Stage) and maps header text to column numbers. */
function lfHeaders_(sh) {
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
function lfCol_(h, text) {
  if (h.cols[text]) return h.cols[text];
  const key = Object.keys(h.cols).find((k) => k.indexOf(text) === 0);
  return key ? h.cols[key] : null;
}

/** Sorts form answers into name, contact, problem and notes by the question wording. */
function lfReadAnswers_(nv) {
  const lead = { name: '', email: '', contact: [], problem: '', notes: [] };
  Object.keys(nv).forEach((q) => {
    const a = String((nv[q] || []).join(', ')).trim();
    const k = q.toLowerCase();
    if (!a || k === 'timestamp') return;
    if (/e-?mail/.test(k)) { lead.email = a; lead.contact.push(a); }
    else if (!lead.name && /\bname\b/.test(k) && !/business|company|brand/.test(k)) lead.name = a;
    else if (/phone|cell|text me|number|instagram|tiktok|handle|whatsapp/.test(k)) lead.contact.push(a);
    else if (!lead.problem && /help|problem|need|looking|struggl|goal|project|question|want/.test(k)) lead.problem = a;
    else lead.notes.push(q + ': ' + a);
  });
  if (!lead.name) lead.name = lead.email || 'New lead';
  return lead;
}

function lfFirstEmptyRow_(sh, h) {
  const nameCol = h.cols['Name'];
  const last = Math.max(sh.getLastRow(), h.row + 1);
  const names = sh.getRange(h.row + 1, nameCol, last - h.row, 1).getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === '') return h.row + 1 + i;
  }
  return last + 1;
}

function lfAddToPipeline_(sh, lead) {
  const h = lfHeaders_(sh);
  const row = lfFirstEmptyRow_(sh, h);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const put = (header, value) => {
    const c = lfCol_(h, header);
    if (c && value !== undefined && value !== '') sh.getRange(row, c).setValue(value);
  };
  put('Name', lead.name);
  put('How you know them', LEAD_FORM.howYouKnow);
  put('Contact', lead.contact.join(', '));
  put('Type', 'Inbound');
  put('Their problem', lead.problem);
  put('Stage', 'To contact');
  put('Script used', 'Inbound reply');
  put('Next step', 'Reply personally to their form');
  put('Next step date', today);
  put('Notes', lead.notes.join(' | '));
  return row;
}

function lfNotifyMe_(lead, link) {
  const lines = [
    'New lead from your form:',
    '',
    'Name: ' + lead.name,
    'Contact: ' + (lead.contact.join(', ') || 'none given'),
    'What they need: ' + (lead.problem || 'not answered'),
  ].concat(lead.notes.length ? ['', lead.notes.join('\n')] : []).concat([
    '',
    'Reply personally today. They are in your Pipeline Tracker with a next step for today:',
    link,
  ]);
  MailApp.sendEmail(lfMe_(), 'New lead: ' + lead.name, lines.join('\n'));
}

function lfConfirm_(lead) {
  const first = lead.name.split(/\s+/)[0];
  const about = lead.problem ? ' about "' + (lead.problem.length > 80 ? lead.problem.slice(0, 77) + '...' : lead.problem) + '"' : '';
  const body = 'Hi ' + first + ',\n\n' +
    'Thanks for reaching out' + about + '. I read every message myself, and I will reply ' + LEAD_FORM.replyPromise + '.\n\n' +
    LEAD_FORM.yourName;
  MailApp.sendEmail(lead.email, 'Got it, ' + first, body, { name: LEAD_FORM.yourName, replyTo: lfMe_() });
}

function lfMe_() {
  return Session.getEffectiveUser().getEmail();
}

function lfSay_(ss, msg) {
  console.log(msg);
  try { ss.toast(msg, '127', 8); } catch (err) { /* no open sheet to show it in */ }
}
```

---

Make today day one. **127** · 127group.io

*© 2026 127 Group LLC. For your own use as a 127 member.*
