/**
 * @OnlyCurrentDoc
 * 127 Monday Scorecard Email
 *
 * Every Monday morning, this script reads the Scorecard tab of your Weekly Founder Scorecard
 * and emails you a one-screen summary: your latest five numbers, the change from the week
 * before, your conversion rates, the biggest drop, and the call you wrote down.
 * If last week isn't filled in yet, the email says so first, with the link.
 *
 * Setup (full steps in the Monday Scorecard Email recipe):
 *   1. Your Weekly Founder Scorecard must be a Google Sheet (File > Save as Google Sheets).
 *   2. Extensions > Apps Script, delete what's there, paste this file, edit SCORECARD_EMAIL, Save.
 *   3. Pick "setupMondayEmail" in the function menu and press Run. Allow the permissions.
 *   4. Pick "sendMondayScorecard" and press Run once to see the email.
 */

const SCORECARD_EMAIL = {
  day: 'MONDAY',            // MONDAY, TUESDAY ... SUNDAY
  hour: 8,                  // the email arrives between this hour and the next (24-hour clock)
  scorecardTab: 'Scorecard' // the tab name in your Weekly Founder Scorecard
};

const MS_NUMBERS = [
  ['Reach', 'Reach'], ['Visits', 'Visits'], ['Leads', 'Leads'], ['Sales', 'Sales'], ['Revenue', 'Revenue ($)'],
];
const MS_RATES = [
  ['Reach to visits', 'Reach to visits', 'pct1'], ['Visits to leads', 'Visits to leads', 'pct1'],
  ['Leads to sales', 'Leads to sales', 'pct0'], ['Revenue per sale', 'Revenue per sale', 'usd'],
];

/** Run once. Installs the weekly trigger. */
function setupMondayEmail() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sendMondayScorecard')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendMondayScorecard').timeBased()
    .onWeekDay(ScriptApp.WeekDay[SCORECARD_EMAIL.day]).atHour(SCORECARD_EMAIL.hour).create();
  const ss = SpreadsheetApp.getActive();
  msHeaders_(msSheet_(ss));
  msSay_(ss, 'Monday Scorecard Email is on. It arrives every ' + SCORECARD_EMAIL.day.toLowerCase() + ' around ' + SCORECARD_EMAIL.hour + ':00.');
}

/** Builds and sends the weekly summary. */
function sendMondayScorecard() {
  const ss = SpreadsheetApp.getActive();
  const report = msReport_(msSheet_(ss), msStartOfDay_(new Date()));
  MailApp.sendEmail({ to: msMe_(), subject: report.subject, body: report.text, htmlBody: report.html });
  return report;
}

/** Reads the Scorecard tab and builds the email. */
function msReport_(sh, today) {
  const h = msHeaders_(sh);
  const lastRow = sh.getLastRow();
  const rows = lastRow > h.row ? sh.getRange(h.row + 1, 1, lastRow - h.row, sh.getLastColumn()).getValues() : [];
  const get = (r, text) => { const c = msCol_(h, text); return c ? r[c - 1] : ''; };
  const filled = rows.filter((r) => typeof get(r, 'Reach') === 'number');
  const link = sh.getParent().getUrl() + '#gid=' + sh.getSheetId();
  if (!filled.length) {
    const text = 'Your scorecard is empty. Ten minutes: pull last week\'s five numbers from the same places every time ' +
      '(platform analytics, site dashboard, DMs, payment app) and type them into week 1. Guesses are fine for week one. ' +
      'Zero is a number.\n\n' + link;
    return { subject: 'Monday scorecard: start with week 1', text: text, html: msHtml_([text]) };
  }
  const latest = filled[filled.length - 1];
  const prev = filled.length > 1 ? filled[filled.length - 2] : null;
  const first = filled[0];
  const week = get(latest, 'Week') || filled.length;
  const weekOf = get(latest, 'Week of');
  // last week's Monday: if the latest filled week started before it, last week is missing
  const lastMonday = new Date(today.getTime());
  lastMonday.setDate(lastMonday.getDate() - ((today.getDay() + 6) % 7) - 7);
  const missing = msIsDate_(weekOf) && msStartOfDay_(weekOf) < lastMonday;

  const lines = [];
  const html = [];
  if (missing) {
    const msg = 'Last week isn\'t in yet. Ten minutes, same sources, same order. Zero is a number.';
    lines.push(msg, '');
    html.push('<p style="margin:0 0 14px;padding:10px 12px;background:#FFF3D6;border-radius:6px"><b>' + msg + '</b></p>');
  }
  lines.push('Week ' + week + (msIsDate_(weekOf) ? ' (week of ' + msFmtDate_(weekOf) + ')' : ''), '');
  const rowsHtml = [];
  MS_NUMBERS.forEach(([label, header]) => {
    const v = get(latest, header);
    const p = prev ? get(prev, header) : '';
    const change = typeof v === 'number' && typeof p === 'number' && p !== 0 ? v / p - 1 : null;
    const val = header === 'Revenue ($)' ? msFmt_(v, 'usd') : msFmt_(v, 'int');
    lines.push(label + ': ' + val + (change === null ? '' : ' (' + msSigned_(change) + ' vs last week)'));
    rowsHtml.push([label, val, change === null ? '' : msSigned_(change), change]);
  });
  lines.push('');
  MS_RATES.forEach(([label, header, f]) => {
    lines.push(label + ': ' + msFmt_(get(latest, header), f));
    rowsHtml.push([label, msFmt_(get(latest, header), f), '', null]);
  });
  const leak = String(get(latest, 'Biggest drop') || '').trim();
  const calls = [['Biggest drop', leak], ['Double down on', get(latest, 'Double down')], ['Pause', get(latest, 'Pause')],
    ['Kill', get(latest, 'Kill')], ['One test this week', get(latest, 'One test')]]
    .filter(([, v]) => String(v || '').trim());
  lines.push('');
  calls.forEach(([k, v]) => lines.push(k + ': ' + v));
  if (prev && first !== latest) {
    const r0 = get(first, 'Revenue ($)');
    const r1 = get(latest, 'Revenue ($)');
    if (typeof r0 === 'number' && typeof r1 === 'number' && r0 > 0) lines.push('', 'Since week 1, weekly revenue went from ' + msFmt_(r0, 'usd') + ' to ' + msFmt_(r1, 'usd') + '.');
  }
  lines.push('', 'Fix the leak before you pour more people in the top. Put your one test on the calendar.', '', link);

  html.push('<p style="margin:0 0 10px;font-size:16px"><b>Week ' + week + '</b>' + (msIsDate_(weekOf) ? ' <span style="color:#6E6E79">week of ' + msFmtDate_(weekOf) + '</span>' : '') + '</p>');
  html.push('<table cellpadding="6" style="border-collapse:collapse;font-size:14px;margin:0 0 14px">' + rowsHtml.map(([k, v, c, n]) =>
    '<tr><td style="border-bottom:1px solid #E5E5EA;color:#3A3A44">' + k + '</td><td style="border-bottom:1px solid #E5E5EA;text-align:right"><b>' + v + '</b></td>' +
    '<td style="border-bottom:1px solid #E5E5EA;text-align:right;color:' + (n === null ? '#6E6E79' : n < 0 ? '#B4483A' : '#2F7D57') + '">' + c + '</td></tr>').join('') + '</table>');
  if (calls.length) html.push('<p style="margin:0 0 14px">' + calls.map(([k, v]) => '<b>' + k + ':</b> ' + msEsc_(v)).join('<br>') + '</p>');
  html.push('<p style="margin:0 0 14px">Fix the leak before you pour more people in the top. Put your one test on the calendar.</p>');
  html.push('<p style="margin:0"><a href="' + link + '">Open your scorecard</a></p>');
  return {
    subject: 'Monday scorecard: week ' + week + (missing ? ' (add last week)' : ''),
    text: lines.join('\n'),
    html: msHtml_(html, true),
  };
}

// ---------------------------------------------------------------- helpers

function msSheet_(ss) {
  const sh = ss.getSheetByName(SCORECARD_EMAIL.scorecardTab);
  if (!sh) throw new Error('No tab named "' + SCORECARD_EMAIL.scorecardTab + '". Change scorecardTab in SCORECARD_EMAIL to match your tab name.');
  return sh;
}

/** Finds the header row (the one with Week and a Reach column) and maps header text to column numbers. */
function msHeaders_(sh) {
  const top = sh.getRange(1, 1, Math.min(10, sh.getMaxRows()), sh.getLastColumn()).getValues();
  for (let r = 0; r < top.length; r++) {
    const row = top[r].map((v) => String(v).trim());
    if (row.indexOf('Week') > -1 && row.some((v) => v.indexOf('Reach') === 0)) {
      const cols = {};
      row.forEach((hd, i) => { if (hd) cols[hd] = i + 1; });
      return { row: r + 1, cols: cols };
    }
  }
  throw new Error('Could not find the header row (a row with "Week" and "Reach") in the "' + sh.getName() + '" tab.');
}

/** Column number for a header, by exact text first, then by how the header starts. */
function msCol_(h, text) {
  if (h.cols[text]) return h.cols[text];
  const key = Object.keys(h.cols).find((k) => k.indexOf(text) === 0);
  return key ? h.cols[key] : null;
}

function msFmt_(v, f) {
  if (typeof v !== 'number') return '-';
  if (f === 'usd') return '$' + Math.round(v).toLocaleString('en-US');
  if (f === 'pct1') return (v * 100).toFixed(1) + '%';
  if (f === 'pct0') return Math.round(v * 100) + '%';
  return Math.round(v).toLocaleString('en-US');
}

function msSigned_(x) {
  const p = Math.round(x * 100);
  return (p > 0 ? '+' : '') + p + '%';
}

function msIsDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function msStartOfDay_(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function msFmtDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM d');
}

function msEsc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function msHtml_(parts, raw) {
  const body = raw ? parts.join('') : parts.map((p) => '<p>' + msEsc_(p).replace(/\n/g, '<br>') + '</p>').join('');
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#1B1B20;max-width:520px">' + body +
    '<p style="margin:18px 0 0;color:#6E6E79;font-size:12px">Make today day one. 127</p></div>';
}

function msMe_() {
  return Session.getEffectiveUser().getEmail();
}

function msSay_(ss, msg) {
  console.log(msg);
  try { ss.toast(msg, '127', 8); } catch (err) { /* no open sheet to show it in */ }
}
