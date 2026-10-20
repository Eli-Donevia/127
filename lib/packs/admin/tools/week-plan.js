// The week ahead from a calendar file (.ics) and a task list: free blocks inside the member's work
// hours, tasks placed into them by due date and priority, and days that are overbooked. Reads the
// .ics with lib/ics.js (no packages), in the time zones the file gives. Saves a printable plan and
// an .ics of the task blocks to import, if the member wants them on their calendar. No AI.

const fs = require('fs');
const path = require('path');
const { views, save, files, time, brain } = require('../../_kit');
const { zonedToUtc, wallParts } = require('../../_kit/time-zone');
const I = require('../lib/ics');
const P = require('../lib/planner');
const { parseTasks } = require('../lib/tasks');
const { findDate } = require('../lib/dates');
const { assetText } = require('../lib/doc-text');
const { page, esc } = require('../lib/page');

const DAY = 86400000;
const SAMPLE_WEEK = '2026-10-19';

module.exports = {
  name: 'admin.week_plan',
  title: 'Plan the week',
  description: 'Reads your calendar file (.ics) and your task list, finds the free time inside your work hours, places tasks by due date and priority, and flags overbooked days. Nothing is added to your calendar unless you import the file.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      calendar: { type: 'string', format: 'asset', title: 'Your calendar (.ics)', accept: '.ics,text/calendar' },
      tasks: { type: 'string', title: 'Your tasks', format: 'textarea', maxLength: 8000 },
      start: { type: 'string', title: 'Start day (optional)', maxLength: 20 },
      dayStart: { type: 'string', title: 'Work starts', default: '9:00', maxLength: 8 },
      dayEnd: { type: 'string', title: 'Work ends', default: '17:00', maxLength: 8 },
      workDays: { type: 'string', title: 'Work days', default: 'Mon to Fri', maxLength: 60 },
    },
  },
  output: {
    type: 'object',
    properties: {
      days: { type: 'array', items: { type: 'object' } },
      unplaced: { type: 'array', items: { type: 'object' } },
      overbooked: { type: 'array', items: { type: 'string' } },
      events: { type: 'integer' },
      placed: { type: 'integer' },
      warnings: { type: 'array', items: { type: 'string' } },
      plan: { type: 'object' },
      ics: { type: 'object' },
      sample: { type: 'boolean' },
    },
    required: ['days', 'unplaced', 'overbooked', 'events', 'placed'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const tz = time.tzOf(ctx) || b.timezone;
    const today = time.today(ctx);
    const now = time.nowMs(ctx);
    const start = (findDate(input.start || '', today) || {}).date || today;
    let icsText;
    let sample = false;
    if (input.calendar) {
      const f = await assetText(ctx, input.calendar, { what: 'calendar file' });
      icsText = f.text || '';
      if (!/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(icsText)) throw new Error("This doesn't look like a calendar file. In Google Calendar: Settings, Import and export, Export. In Outlook: save the calendar as .ics.");
    } else {
      icsText = fs.readFileSync(path.join(__dirname, '..', 'sample', 'calendar.ics'), 'utf8');
      sample = true;
    }
    const taskText = String(input.tasks || '').trim() || (sample ? fs.readFileSync(path.join(__dirname, '..', 'sample', 'tasks.txt'), 'utf8') : '');
    const parsed = I.parseIcs(icsText, { tz });
    // The sample calendar is the week of Oct 19, 2026: move it to the week being planned.
    const shift = sample ? Math.round((zonedToUtc(time.nextWeekday(time.addDays(start, -6), 1), '12:00', tz) - zonedToUtc(SAMPLE_WEEK, '12:00', tz)) / (7 * DAY)) * 7 * DAY : 0;
    const from = zonedToUtc(start, '00:00', tz);
    const to = zonedToUtc(time.addDays(start, 7), '00:00', tz);
    let events = I.expand(parsed, { from: from - shift, to: to - shift, tz });
    if (shift) events = events.map((e) => ({ ...e, start: e.start + shift, end: e.end + shift }));
    const tasks = parseTasks(taskText, today);
    const plan = P.planWeek({ events, tasks, start, now, tz, hours: { start: input.dayStart || '9:00', end: input.dayEnd || '17:00' }, workDays: P.workDaysOf(input.workDays) });
    const overbooked = plan.days.filter((d) => d.overbooked).map((d) => `${d.label}: ${d.flags.join(' ')}`);
    const placed = plan.days.reduce((a, d) => a + d.placed.length, 0);
    const dayRows = plan.days.map((d) => ({ date: d.date, day: d.label, work: d.work, meetings: d.events.length, booked: `${Math.round(d.bookedMinutes / 6) / 10}h`, free: `${Math.round(d.freeMinutes / 6) / 10}h`, tasks: d.placed.map((p) => `${p.when} ${p.title}${p.part ? ` (part ${p.part})` : ''}`).join('; '), flags: d.flags.join(' '), events: d.events.map((e) => ({ when: e.when, title: e.title })), placed: d.placed.map((p) => ({ when: p.when, title: p.title, part: p.part })), free_blocks: d.free.map((f) => f.when) }));
    const html = page({
      title: `Week of ${time.shortDate(start)}`,
      kicker: `Week plan${b.name ? `, ${b.name}` : ''}`,
      lede: `${events.length} calendar items, ${placed} task blocks placed${plan.unplaced.length ? `, ${plan.unplaced.length} not placed` : ''}. Work hours ${P.clock(zonedToUtc(start, plan.hours.start, tz), tz)} to ${P.clock(zonedToUtc(start, plan.hours.end, tz), tz)}.`,
      body: `${plan.days.map((d) => `<div class="card${d.overbooked ? ' warn' : ''}"><h3>${esc(d.label)}${d.work ? '' : ' <span class="tag">Off</span>'}</h3>${d.flags.length ? `<p class="miss">${esc(d.flags.join(' '))}</p>` : ''}<table><tr><th>When</th><th>What</th></tr>${[...d.events.map((e) => ({ s: e.allDay ? 0 : e.start, when: e.when, what: e.title, task: false })), ...d.placed.map((p) => ({ s: p.start, when: p.when, what: `${p.title}${p.part ? ` (part ${p.part})` : ''}`, task: true }))].sort((x, y) => x.s - y.s).map((r) => `<tr><td>${esc(r.when)}</td><td>${r.task ? '<span class="box"></span>' : ''}${esc(r.what)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Nothing on the calendar</td></tr>'}</table>${d.free.length ? `<p class="muted">Free: ${esc(d.free.map((f) => f.when).join(', '))}</p>` : ''}</div>`).join('')}
${plan.unplaced.length ? `<h2>Not placed</h2><ul>${plan.unplaced.map((t) => `<li>${esc(t.title)}: ${esc(t.reason)}</li>`).join('')}</ul>` : ''}`,
      footer: 'Task blocks are a plan, not calendar events. Import the .ics file only if you want them on your calendar.',
    });
    const name = `week-${start}`;
    const planFile = await save.saveFile(ctx, save.fileName(name, 'plan', '.html'), html);
    const blocks = plan.days.flatMap((d) => d.placed.map((p) => {
      const w = wallParts(p.start, tz);
      return { uid: `${p.id}-${d.date}-${w.h}${w.mi}@admin.127`, title: `${p.title}${p.part ? ` (part ${p.part})` : ''}`, date: d.date, time: `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`, minutes: p.minutes, tz };
    }));
    const icsFile = blocks.length ? await save.saveFile(ctx, save.fileName(name, 'task-blocks', '.ics'), files.ics(blocks, { name: 'Task blocks', now })) : null;
    ctx.log(`Read ${events.length} calendar items and ${tasks.length} tasks; placed ${placed} blocks${overbooked.length ? `; ${overbooked.length} overbooked days` : ''}`);
    return { days: dayRows, unplaced: plan.unplaced.map((t) => ({ title: t.title, due: t.due, minutes: t.minutes, reason: t.reason })), overbooked, events: events.length, placed, warnings: parsed.warnings.slice(0, 5), plan: planFile, ...(icsFile ? { ics: icsFile } : {}), ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This calendar'),
      views.metric('Task blocks placed', out.placed, `${out.events} calendar items read${out.unplaced.length ? `, ${out.unplaced.length} tasks not placed` : ''}`),
      ...out.overbooked.map((o) => views.text(`Overbooked: ${o}`)),
      views.table([{ key: 'day', label: 'Day' }, { key: 'booked', label: 'Booked' }, { key: 'free', label: 'Free' }, { key: 'tasks', label: 'Tasks placed' }], out.days),
      out.unplaced.length ? views.table([{ key: 'title', label: 'Not placed' }, { key: 'reason', label: 'Why' }], out.unplaced) : null,
      ...(out.warnings || []).map((w) => views.text(w)),
      views.file(out.plan, 'Week plan to print'),
      views.file(out.ics, 'Task blocks (.ics) to import, if you want them on your calendar')
    );
  },
};
