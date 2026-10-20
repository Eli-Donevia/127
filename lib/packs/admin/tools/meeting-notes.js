// Meeting notes or a transcript into what was decided, who does what by when, what is still open,
// and follow-up email drafts (a recap for everyone, one note per person with tasks). AI reads the
// notes when it is on; every item it returns has to come from the notes, else the rules below are
// used. The emails are written from templates, so they only repeat what is in the list. Nothing is sent.

const fs = require('fs');
const path = require('path');
const { views, save, ai, text, time, files, brain } = require('../../_kit');
const M = require('../lib/meeting');
const { findDate } = require('../lib/dates');
const { assetText } = require('../lib/doc-text');
const { page, esc, DRAFT_NOTE } = require('../lib/page');

const SCHEMA = {
  type: 'object',
  properties: {
    decisions: { type: 'array', items: { type: 'string', maxLength: 240 } },
    tasks: { type: 'array', items: { type: 'object', properties: { task: { type: 'string', maxLength: 200 }, owner: { type: 'string', maxLength: 60 }, due: { type: 'string', maxLength: 40 } }, required: ['task', 'owner', 'due'] } },
    questions: { type: 'array', items: { type: 'string', maxLength: 200 } },
  },
  required: ['decisions', 'tasks', 'questions'],
};

// Transcript files (.vtt, .srt, Zoom or Meet exports): drop cue numbers and timestamps.
function cleanTranscript(s) {
  return String(s || '')
    .replace(/^WEBVTT.*$/m, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/^\s*\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?\s*-->\s*\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?.*$/gm, '')
    .replace(/^\s*\[?\(?\d{1,2}:\d{2}(:\d{2})?\)?\]?\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const people = (s) => String(s || '').split(/[,;\n]| and /).map((x) => x.trim()).filter((x) => /^[A-Za-z][A-Za-z .'-]{0,40}$/.test(x)).slice(0, 20);

module.exports = {
  name: 'admin.meeting_notes',
  title: 'Meeting notes to tasks',
  description: 'Reads your meeting notes or a transcript and lists what was decided, who does what by when, and what is still open, with follow-up email drafts. Nothing is sent.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['extract'],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      notes: { type: 'string', title: 'Your notes', format: 'textarea', maxLength: 20000 },
      file: { type: 'string', format: 'asset', title: 'Or a notes or transcript file', accept: '.txt,.md,.vtt,.srt,.docx,.html' },
      title: { type: 'string', title: 'Meeting name', maxLength: 80 },
      people: { type: 'string', title: 'Who was there (optional)', maxLength: 400 },
      date: { type: 'string', title: 'Meeting date (optional)', maxLength: 20 },
    },
  },
  output: {
    type: 'object',
    properties: {
      decisions: { type: 'array', items: { type: 'string' } },
      tasks: { type: 'array', items: { type: 'object' } },
      questions: { type: 'array', items: { type: 'string' } },
      emails: { type: 'array', items: { type: 'object' } },
      recap: { type: 'object' },
      csv: { type: 'object' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['decisions', 'tasks', 'questions', 'emails'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    let notes = String(input.notes || '');
    let sample = false;
    if (input.file) notes = `${notes}\n\n${(await assetText(ctx, input.file, { what: 'notes file' })).text || ''}`;
    notes = cleanTranscript(notes);
    if (!notes.trim()) {
      notes = fs.readFileSync(path.join(__dirname, '..', 'sample', 'meeting-notes.txt'), 'utf8');
      sample = true;
    }
    if (notes.length > 20000) notes = notes.slice(0, 20000);
    const today = time.today(ctx);
    const date = (findDate(input.date || '', today) || {}).date || today;
    const who = people(input.people || (notes.match(/^\s*(?:present|attendees|who|people)\s*:\s*(.+)$/im) || [])[1] || '').filter((p) => !/^(me|i|myself)$/i.test(p));
    const title = text.oneLine(input.title || (sample ? 'Crew check-in' : '') || text.clip(notes.split('\n').find((l) => l.trim()) || 'our meeting', 60));
    const rules = M.parseNotes(notes, { today: date, people: who });
    const known = (o) => !o || /^(me|unassigned|everyone|all)$/i.test(o) || notes.toLowerCase().includes(String(o).split(' ')[0].toLowerCase());
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'extract',
      system: 'You read a small business owner\'s meeting notes and list only what is written there: decisions made, tasks with the person doing each and the due date as written, and questions left open. Do not add anything that is not in the notes. Use "Me" when the note taker took the task ("I will", "I\'ll") and "Unassigned" when no one is named. Leave due empty when no date is given.',
      prompt: `Meeting: ${title}\nDate: ${date}\nPeople: ${who.join(', ') || 'not listed'}\n\nNotes:\n${notes.slice(0, 12000)}`,
      schema: SCHEMA,
      maxTokens: 1500,
      fallback: () => ({ decisions: rules.decisions, tasks: rules.tasks, questions: rules.questions }),
      accept: (d) => [...d.decisions, ...d.questions, ...d.tasks.map((t) => t.task)].every((x) => M.fromNotes(x, notes)) && d.tasks.every((t) => known(t.owner)),
    });
    const tasks = data.tasks.slice(0, 40).map((t) => {
      const due = /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : (findDate(t.due || '', date) || {}).date || '';
      const owner = text.oneLine(t.owner || '') || 'Unassigned';
      return { task: text.clip(t.task, 200), owner: /^me$/i.test(owner) ? 'Me' : owner, due };
    });
    const decisions = data.decisions.slice(0, 20).map((d) => text.clip(d, 240));
    const questions = data.questions.slice(0, 15).map((q) => text.clip(q, 200));
    const me = b.firstName || '';
    const emails = [M.recapEmail({ title, date, decisions, tasks, questions, nextMeeting: rules.nextMeeting, me, business: b.name }), ...M.ownerEmails({ title, tasks, me, business: b.name })];
    const name = text.slug(title, 40) || 'meeting';
    const csv = await save.saveFile(ctx, save.fileName(name, 'tasks', '.csv'), files.csv(tasks.map((t) => ({ task: t.task, owner: t.owner === 'Me' ? me || 'Me' : t.owner, due: t.due })), ['task', 'owner', 'due']));
    const body = `<h2>Decided</h2>${decisions.length ? `<ul>${decisions.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '<p class="muted">No decisions found in the notes.</p>'}
<h2>Who does what</h2>${tasks.length ? `<table><tr><th>Task</th><th>Who</th><th>By</th></tr>${tasks.map((t) => `<tr><td><span class="box"></span>${esc(t.task)}</td><td>${esc(t.owner === 'Me' ? me || 'Me' : t.owner)}</td><td>${esc(M.fmt(t.due))}</td></tr>`).join('')}</table>` : '<p class="muted">No tasks found in the notes.</p>'}
${questions.length ? `<h2>Still open</h2><ul>${questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
<h2>Follow-up drafts</h2><p class="muted">${esc(DRAFT_NOTE)}</p>${emails.map((e) => `<div class="card"><p class="muted">To: ${esc(e.to)}<br>Subject: ${esc(e.subject)}</p><pre>${esc(e.body)}</pre></div>`).join('')}`;
    const recap = await save.saveFile(ctx, save.fileName(name, 'notes', '.html'), page({ title, kicker: `Meeting notes${b.name ? `, ${b.name}` : ''}`, lede: M.fmt(date), body }));
    ctx.log(`Found ${decisions.length} decisions, ${tasks.length} tasks and ${questions.length} open questions${usedAi ? '' : ' (by rules)'}`);
    return { decisions, tasks, questions, emails, recap, csv, ai: usedAi, ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'These notes'),
      views.metric('Tasks', out.tasks.length, `${out.decisions.length} decided, ${out.questions.length} still open`),
      out.decisions.length ? views.text(`Decided: ${out.decisions.join(' / ')}`) : null,
      out.tasks.length ? views.table([{ key: 'task', label: 'Task' }, { key: 'owner', label: 'Who' }, { key: 'due', label: 'By' }], out.tasks) : views.text('No tasks found. Try writing them as "Name will do X by Friday".'),
      out.questions.length ? views.text(`Still open: ${out.questions.join(' / ')}`) : null,
      ...out.emails.map((e) => views.copy(`Draft to ${e.to}: ${e.subject}`, e.body, { subject: e.subject })),
      views.text(DRAFT_NOTE),
      views.file(out.recap, 'Notes page to print or share'),
      views.file(out.csv, 'Tasks as CSV for a sheet or task app')
    );
  },
};
