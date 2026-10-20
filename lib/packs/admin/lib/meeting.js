// Meeting notes into decisions, tasks (who, what, by when) and open questions, by rules a person
// can follow. Used when AI is off and to check what AI found: every item has to come from the notes.
// Also the follow-up email drafts (a recap for everyone, and one note per person with tasks).

const { findDate } = require('./dates');

const DECISION = /\b(decided|decision|agreed|agree(d)? (to|on|that)|we('ll| will) go with|going with|approved|settled on|final(ized)? (price|date|plan)|signed off|chose|picked|confirmed)\b/i;
const TASK = /\b(action( item)?s?|todo|to-do|to do|next steps?|follow[- ]?up|ai)\s*[:-]|^\s*\[\s?\]|\b(will|to|needs to|should|is going to|'ll)\s+(send|call|email|write|draft|book|order|buy|update|fix|check|ask|finish|share|set up|schedule|review|prepare|post|pay|invoice|quote|text|confirm|get|make|find|look into|reach out|follow up|create|plan|move|clean|bring|print|sign)\b/i;
const VERBS = 'send|call|email|write|draft|book|order|buy|update|fix|check|ask|finish|share|set up|schedule|review|prepare|post|pay|invoice|quote|text|confirm|get|make|find|look into|reach out|follow up|create|plan|move|clean|bring|print|sign|pick up|drop off|price|test|train|hire|cancel|renew|file';
const NAMED_TASK = new RegExp(`^\\s*(?:[-*+]\\s*)?@?[A-Z][a-z]+\\s*[:-]\\s*(${VERBS})\\b`, 'i');
const QUESTION = /\?\s*$|^\s*(open question|question|tbd|unclear|not sure|need to decide|parking lot)\b/i;
const SECTION = {
  decisions: /^\s*(decisions?|decided|agreed|outcomes?)\s*:?\s*$/i,
  tasks: /^\s*(action items?|actions|to-?dos?|tasks|next steps|follow[- ]?ups?|owners?)\s*:?\s*$/i,
  questions: /^\s*(open questions?|questions|parking lot|still open|tbd|unresolved)\s*:?\s*$/i,
  other: /^\s*(notes?|discussion|agenda|attendees|present|updates?|recap|summary)\s*:?\s*$/i,
};
const STOP = new Set(['We', 'I', 'The', 'This', 'That', 'Next', 'Action', 'Todo', 'Decision', 'Agreed', 'Everyone', 'Team', 'All', 'Someone', 'They', 'He', 'She', 'It', 'Note', 'Notes', 'Question', 'Follow', 'Then', 'Also', 'And', 'But', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Today', 'Tomorrow']);

const strip = (l) => String(l).replace(/^\s*(?:[-*+>]|\d+[.)]|\[\s?\]|\[x\])\s*/i, '').replace(/^(action( item)?|todo|to-do|ai|decision|decided|agreed|question|follow[- ]?up)\s*[:-]\s*/i, '').trim();

// Who a task belongs to: "Maya will...", "Maya to ...", "Maya: ...", "@Maya", "(Maya)", "owner: Maya", "I'll".
function ownerOf(line, people = []) {
  const s = strip(line);
  const names = people.map((p) => p.trim()).filter(Boolean);
  const known = (n) => names.find((p) => p.toLowerCase() === n.toLowerCase() || p.split(/\s+/)[0].toLowerCase() === n.toLowerCase());
  let m = s.match(/(?:owner|who|assigned to)\s*[:=]\s*@?([A-Z][a-z]+)/i) || s.match(/@([A-Za-z][a-z]+)/) || s.match(/\(([A-Z][a-z]+)\)\s*\.?\s*$/);
  if (m && !STOP.has(m[1])) return known(m[1]) || m[1];
  if (/^(i|i'll|i will|me)\b/i.test(s) || /\bI('ll| will)\b/.test(s)) return 'Me';
  m = s.match(/^([A-Z][a-z]+)(?:\s+(?:and|&)\s+([A-Z][a-z]+))?\s*(?::|-|will\b|to\b|needs to\b|should\b|is going to\b|'ll\b)/);
  if (m && !STOP.has(m[1])) return m[2] && !STOP.has(m[2]) ? `${known(m[1]) || m[1]} and ${known(m[2]) || m[2]}` : known(m[1]) || m[1];
  for (const p of names) if (new RegExp(`\\b${p.split(/\s+/)[0].replace(/[^A-Za-z'-]/g, '')}\\b`).test(s)) return p;
  return '';
}

function taskText(line, owner, due) {
  let s = strip(line);
  if (due) s = s.replace(due.match, ' ');
  s = s.replace(/(?:owner|who|assigned to)\s*[:=]\s*@?\w+/i, ' ').replace(/@\w+/g, ' ').replace(/\(([A-Z][a-z]+)\)\s*\.?\s*$/, ' ');
  if (owner && owner !== 'Me') s = s.replace(new RegExp(`^${owner.split(' and ')[0]}(\\s+and\\s+\\w+)?\\s*(:|-|will|to|needs to|should|is going to|'ll)\\s*`, 'i'), '');
  s = s.replace(/^(i'll|i will|i)\s+/i, '');
  s = s.replace(/\s+(by|due|before|on)\s*$/i, '').replace(/\s{2,}/g, ' ').replace(/[\s,;:.-]+$/, '').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function parseNotes(notes, { today, people = [] } = {}) {
  const decisions = [];
  const tasks = [];
  const questions = [];
  let section = '';
  let nextMeeting = null;
  for (const raw of String(notes || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head = Object.entries(SECTION).find(([, re]) => re.test(line));
    if (head) {
      section = head[0];
      continue;
    }
    if (/\b(next (meeting|call|check-?in|sync)|meet again|regroup)\b/i.test(line)) {
      const d = findDate(line, today);
      if (d) nextMeeting = { date: d.date, text: strip(line) };
    }
    const isQ = section === 'questions' || (QUESTION.test(line) && !TASK.test(line));
    const isD = section === 'decisions' || (!isQ && DECISION.test(line) && !(section === 'tasks'));
    const isT = section === 'tasks' || (!isD && !isQ && (TASK.test(line) || NAMED_TASK.test(line)));
    if (isQ) questions.push(strip(line).slice(0, 200));
    else if (isD) {
      const d = strip(line).slice(0, 240);
      if (d) decisions.push(d[0].toUpperCase() + d.slice(1));
    }
    else if (isT) {
      const due = findDate(line, today);
      const owner = ownerOf(line, people);
      const task = taskText(line, owner, due);
      if (task) tasks.push({ task: task.slice(0, 200), owner: owner || 'Unassigned', due: due ? due.date : '' });
    }
  }
  return { decisions, tasks, questions, nextMeeting };
}

// True when most of an AI item's words are in the notes (so it did not make the item up).
function fromNotes(item, notes) {
  const words = String(item || '').toLowerCase().match(/[a-z0-9$]{4,}/g) || [];
  if (!words.length) return true;
  const n = String(notes || '').toLowerCase();
  return words.filter((w) => n.includes(w)).length / words.length >= 0.6;
}

const fmt = (date) => {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
};

function taskLine(t, withOwner = true, me = '') {
  const who = t.owner === 'Me' ? me || 'me' : t.owner;
  return `${t.task}${withOwner && who && t.owner !== 'Unassigned' ? ` (${who})` : ''}${t.due ? `, by ${fmt(t.due)}` : ''}`;
}

function recapEmail({ title, date, decisions, tasks, questions, nextMeeting, me, business }) {
  const parts = [`Hi all,`, `Thanks for the time today. Here is what we covered in ${title}${date ? ` on ${fmt(date)}` : ''}, so we are all working from the same list.`];
  if (decisions.length) parts.push(`What we decided:\n${decisions.map((d) => `- ${d}`).join('\n')}`);
  if (tasks.length) parts.push(`Who is doing what:\n${tasks.map((t) => `- ${taskLine(t, true, me)}`).join('\n')}`);
  if (questions.length) parts.push(`Still open:\n${questions.map((q) => `- ${q}`).join('\n')}`);
  if (nextMeeting) parts.push(`Next time: ${fmt(nextMeeting.date)}.`);
  parts.push('If I missed or got anything wrong, reply and I will fix the list.');
  parts.push([me || '[Your name]', business].filter(Boolean).join('\n'));
  return { to: 'Everyone who was there', subject: `Notes from ${title}${date ? ` (${fmt(date)})` : ''}`, body: parts.join('\n\n') };
}

function ownerEmails({ title, tasks, me, business, max = 5 }) {
  const by = new Map();
  for (const t of tasks) {
    if (!t.owner || t.owner === 'Me' || t.owner === 'Unassigned') continue;
    for (const o of t.owner.split(' and ')) {
      if (!by.has(o)) by.set(o, []);
      by.get(o).push(t);
    }
  }
  return [...by.entries()].slice(0, max).map(([owner, list]) => ({
    to: owner,
    subject: `Your next steps from ${title}`,
    body: [`Hi ${owner},`, `Thanks again for today. Here is what you are taking on, so it is in one place:`, list.map((t) => `- ${taskLine(t, false)}`).join('\n'), list.some((t) => !t.due) ? 'Some of these do not have a date yet. When do you think you can have them done?' : 'If any of these dates will not work, tell me and we can move them.', [me || '[Your name]', business].filter(Boolean).join('\n')].join('\n\n'),
  }));
}

module.exports = { parseNotes, ownerOf, taskText, fromNotes, recapEmail, ownerEmails, taskLine, fmt };
