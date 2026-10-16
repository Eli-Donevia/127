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
