// Today's top 3 from the member's task list, with the reason for each pick, and what could wait.
// Rules only (lib/top3.js): late or due soon, marked important, someone waiting, money, quick wins.

const fs = require('fs');
const path = require('path');
const { views, save, time, brain } = require('../../_kit');
const { parseTasks } = require('../lib/tasks');
const T3 = require('../lib/top3');
const { page, esc } = require('../lib/page');
const { fmt } = require('../lib/meeting');

module.exports = {
  name: 'admin.top_three',
  title: 'Pick today\'s top 3',
  description: 'Reads your task list and picks the three to do first today, with the reason for each: late or due soon, marked important, someone waiting on you, money, or quick to finish.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    properties: {
      tasks: { type: 'string', title: 'Your tasks', format: 'textarea', maxLength: 8000 },
      hours: { type: 'number', title: 'Hours free today (optional)', minimum: 0.5, maximum: 16 },
    },
  },
  output: {
    type: 'object',
    properties: { top: { type: 'array', items: { type: 'object' } }, later: { type: 'array', items: { type: 'object' } }, notes: { type: 'array', items: { type: 'string' } }, text: { type: 'string' }, card: { type: 'object' }, sample: { type: 'boolean' } },
    required: ['top', 'later', 'notes', 'text'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const today = time.today(ctx);
    let raw = String(input.tasks || '').trim();
    let sample = false;
    if (!raw) {
      raw = fs.readFileSync(path.join(__dirname, '..', 'sample', 'tasks.txt'), 'utf8');
      sample = true;
    }
    const tasks = parseTasks(raw, today);
    if (!tasks.length) throw new Error('No tasks found. Put one task per line.');
    const r = T3.pickTop(tasks, today, { minutes: input.hours ? Math.round(input.hours * 60) : 0 });
    const top = r.top.map((t, i) => ({ n: i + 1, title: t.title, minutes: t.minutes, due: t.due ? fmt(t.due) : '', why: T3.reason(t) }));
    const later = r.rest.map((t) => ({ title: t.title, due: t.due ? fmt(t.due) : '', minutes: t.minutes }));
    const textOut = [`Top 3 for ${time.shortDate(today)}`, ...top.map((t) => `${t.n}. ${t.title} (about ${t.minutes} min): ${t.why}`), ...(r.notes.length ? ['', ...r.notes] : [])].join('\n');
    const card = await save.saveFile(ctx, save.fileName('top-3', today, '.html'), page({ title: `Top 3 for ${time.shortDate(today)}`, kicker: b.name || 'Today', body: `<ol>${top.map((t) => `<li><span class="box"></span><b>${esc(t.title)}</b> <span class="muted">about ${t.minutes} min</span><br><span class="muted">${esc(t.why)}</span></li>`).join('')}</ol>${r.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join('')}<h2>Later</h2><ul>${later.map((t) => `<li>${esc(t.title)}${t.due ? ` <span class="muted">(${esc(t.due)})</span>` : ''}</li>`).join('')}</ul>` }));
    ctx.log(`Picked 3 of ${tasks.length} tasks`);
    return { top, later, notes: r.notes, text: textOut, card, ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'These tasks'),
      views.table([{ key: 'n', label: '#' }, { key: 'title', label: 'Do first' }, { key: 'minutes', label: 'Minutes', format: 'number' }, { key: 'why', label: 'Why' }], out.top),
      ...out.notes.map((n) => views.text(n)),
      views.copy('Copy your top 3', out.text),
      views.file(out.card, 'Top 3 to print or keep on your phone')
    );
  },
};
