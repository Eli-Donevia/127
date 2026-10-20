// A task list as people type it, one task per line, into { title, minutes, priority, due, ... }.
//   "[ ] Send quote to Marcus, 30m, due Fri !"   "Call tile supplier (15 min)"   "- Write blog post 2h low"
// Ticked tasks ("[x]", "done:") are skipped. Minutes default to 30. Priority is 1 (high), 2 or 3 (low).

const { findDate } = require('./dates');

const DURATION = /\(?\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b\)?/i;
const HIGH = /(^|\s)(!{1,3})(\s|$)|\b(urgent|asap|important|high|must|critical)\b|\(a\)|\bp1\b/i;
const LOW = /\b(low|someday|maybe|if time|nice to have|whenever)\b|\(c\)|\bp3\b/i;
const MONEY = /\$\s?\d|\b(invoice|invoices|quote|quotes|estimate|deposit|payment|pay|paid|bill|billing|refund|price|proposal)\b/i;
const OTHERS = /\b(waiting on me|blocking|blocked|client waiting|they need|asked for|promised|follow up|follow-up|reply|call back|callback|get back to)\b/i;

function minutesOf(s) {
  const m = String(s).match(DURATION);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(/^h/i.test(m[2]) ? n * 60 : n);
}

function cleanTitle(line, cut) {
  let t = String(line);
  for (const c of cut) if (c) t = t.replace(c, ' ');
  return t
    .replace(/^\s*(?:[-*+>]|\d+[.)]|\[\s?\]|\(\s?\))\s*/, '')
    .replace(/(^|\s)!{1,3}(?=\s|$)/g, ' ')
    .replace(/\b(urgent|asap|high|low|p[123]|priority)\b/gi, ' ')
    .replace(/\((a|b|c)\)/gi, ' ')
    .replace(/\b(due|by)\s*$/i, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s*[,;:]\s*(?=[,;:]|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
    .trim();
}

function parseTasks(input, today, { max = 60 } = {}) {
  const out = [];
  const lines = String(input || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^#/.test(line)) continue;
    if (/^\s*(?:[-*]\s*)?\[(x|X)\]/.test(line) || /^(done|finished)\s*:/i.test(line)) continue;
    const dur = line.match(DURATION);
    const due = findDate(line.replace(DURATION, ' '), today);
    const title = cleanTitle(line, [dur && dur[0], due && due.match]);
    if (!title || title.length < 2) continue;
    const priority = HIGH.test(line) ? 1 : LOW.test(line) ? 3 : 2;
    out.push({
      id: `t${out.length + 1}`,
      title: title.slice(0, 140),
      minutes: Math.min(8 * 60, Math.max(5, minutesOf(line) || 30)),
      priority,
      due: due ? due.date : '',
      money: MONEY.test(line),
      others: OTHERS.test(line),
      line: line.slice(0, 200),
    });
    if (out.length >= max) break;
  }
  return out;
}

module.exports = { parseTasks, minutesOf, cleanTitle, MONEY, OTHERS };
