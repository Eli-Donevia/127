// 7-day test plan for one idea: what to do each day, from writing the problem down to deciding, with
// the bar the member sets before they start (how many conversations should show the problem, and how
// many people should commit) so the result can't be argued with later. A calendar file. Code only.

const { views, save, files, time, text } = require('../../_kit');
const K = require('../lib/idea');

const { plain } = text;

module.exports = {
  name: 'idea.test_plan',
  title: 'Plan a 7-day idea test',
  description: 'Seven days from writing the problem down to a decision: who to talk to, what to ask, when to show an offer and how to score it, against a bar you set first. With a calendar file.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['idea'],
    properties: {
      idea: { type: 'string', maxLength: 140, title: 'Your idea, in one line' },
      who: { type: 'string', maxLength: 120, title: 'Who has the problem (optional)' },
      problem: { type: 'string', maxLength: 160, title: 'The problem, in their words (optional)' },
      start: { type: 'string', format: 'date', title: 'Day 1 (optional)', description: 'Leave empty for tomorrow' },
      hours: { type: 'number', minimum: 0.5, maximum: 8, default: 1, title: 'Hours a day you can give it' },
      bar_problem: { type: 'integer', minimum: 1, maximum: 25, default: 8, title: 'Your bar: how many of 25 should have had the problem lately', description: 'Set it now, before you talk to anyone' },
      bar_commit: { type: 'integer', minimum: 1, maximum: 25, default: 3, title: 'Your bar: how many should commit', description: 'A pre-order, a deposit, a booked first job, or a sign-up to be first' },
      time: { type: 'string', pattern: '^\\d{2}:\\d{2}$', default: '18:00', title: 'Time of day (24-hour)' },
    },
  },
  output: { type: 'object', required: ['days', 'bar'], properties: { idea: { type: 'string' }, bar: { type: 'object' }, days: { type: 'array' }, calendar: { type: 'object' }, note: { type: 'string' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const today = time.today(ctx);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) && input.start >= today ? input.start : time.addDays(today, 1);
    const bar = { problem: Math.min(25, Math.max(1, Number(input.bar_problem) || 8)), commit: Math.min(25, Math.max(1, Number(input.bar_commit) || 3)) };
    const hours = Math.max(0.5, Number(input.hours) || 1);
    const who = m.who;
    const problem = m.problem || `the problem ${m.idea} solves`;
    const plan = [
      { title: 'Write it down', what: `Write one line each: who (${who}), the problem (${problem}), and how they deal with it today. Then write your bar: ${bar.problem} of 25 had the problem lately, ${bar.commit} commit.`, run: 'idea.first_25' },
      { title: 'List 25 and send 10', what: 'Run Your first 25 conversations. Send the first 10 notes today. Ask for a story, not an opinion.', run: 'idea.first_25' },
      { title: 'First conversations', what: 'Talk to everyone who said yes. Ask about the last time it happened, what they did, and what it cost them. Write their words in the log the same day.', run: null },
      { title: 'Send the rest, keep talking', what: 'Send the other 15 notes. Ask everyone you talk to who else has the problem.', run: null },
      { title: 'Draft your offer', what: 'Using their words, draft a one-page offer: who it is for, what you do, the price per job, and a first-customer offer you can keep.', run: 'idea.offer_draft' },
      { title: 'Ask for a commitment', what: 'Show the offer at the end of your next conversations, and to the people who had the problem. Ask for something real: a pre-order, a small deposit, a first booked job, or their email to be first. A "sounds great" is not a commitment.', run: 'idea.landing_page' },
      { title: 'Score it and decide', what: `Fill in the log and run the scorecard. Compare it with your bar (${bar.problem} had the problem, ${bar.commit} committed). Then keep going, change the who or the problem, or test your next idea.`, run: 'idea.scorecard' },
    ].map((d, i) => ({ day: i + 1, date: time.addDays(start, i), on: time.shortDate(time.addDays(start, i)), ...d, minutes: Math.round(hours * 60) }));
    const at = /^\d{2}:\d{2}$/.test(String(input.time || '')) ? input.time : '18:00';
    const tz = time.tzOf(ctx);
    const calendar = await save.saveFile(ctx, save.fileName(m.idea, '7 day test', start, '.ics'), files.ics(plan.map((d) => ({ uid: `idea-test-${start}-${d.day}@127group.io`, title: `Idea test day ${d.day}: ${d.title}`, description: d.what, date: d.date, time: at, minutes: d.minutes, tz })), { name: `Test: ${plain(m.idea)}`, now: time.nowMs(ctx) }));
    return {
      idea: m.idea,
      bar,
      days: plan.map(({ day, on, title, what, run }) => ({ day, on, title, what, run })),
      calendar,
      note: 'The bar is yours, set before you start, so the test answers your question honestly. Hitting it says people have the problem and will commit; it is not a promise of how a business does.',
    };
  },
  view(out) {
    return views.blocks(
      views.metric('7-day test', out.idea, `Your bar: ${out.bar.problem} of 25 had the problem lately, ${out.bar.commit} commit`),
      views.table([{ key: 'on', label: 'Day' }, { key: 'title', label: 'Do' }, { key: 'what', label: 'How' }], out.days),
      views.text(out.note),
      views.file(out.calendar, '7-day test (calendar file)'),
    );
  },
};
