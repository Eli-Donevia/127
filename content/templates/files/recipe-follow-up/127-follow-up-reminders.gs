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
