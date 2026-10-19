// The first-helper packet without AI: a job post in the member's words, a paid trial built on
// their own checklist, a scorecard, interview questions and where to check the rules. Points to
// official pages (data/hiring.json); it never says whether someone is a contractor or employee.

const { text } = require('../../_kit');
const RULES = require('../data/hiring.json');

const CARE = [
  [/\b(clean|maid|home|house|organiz)/i, "people's homes and their things"],
  [/\b(car|detail|auto|vehicle)/i, "people's cars"],
  [/\b(lawn|yard|landscap|mow)/i, "people's yards, gates and pets"],
  [/\b(dog|pet|cat|groom)/i, "people's pets and homes"],
  [/\b(ship|order|candle|shop|product|pack)/i, 'every order like it is going to a friend'],
];

function careFor(s) {
  const hit = CARE.find(([re]) => re.test(String(s || '')));
  return hit ? hit[1] : "customers and the details of the work";
}

function payLine(pay, payType) {
  const n = Number(pay);
  if (!(n > 0)) return null;
  const v = Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
  return `${v} ${payType === 'per job' ? 'per job' : 'an hour'}`;
}

// f: { business, role, what, city, pay, payType, hours, tasks, sop, firstName }
function templatePacket(f) {
  const role = text.oneLine(f.role || 'helper').toLowerCase();
  const where = f.city ? ` in ${String(f.city).split(',')[0].trim()}` : '';
  const pay = payLine(f.pay, f.payType);
  const care = careFor(`${f.role} ${f.what} ${f.sop ? f.sop.title : ''}`);
  const steps = f.sop && Array.isArray(f.sop.steps) ? f.sop.steps : [];
  const duties = f.tasks ? text.oneLine(f.tasks) : f.sop && f.sop.duties ? `${f.sop.duties}, following a written checklist` : f.sop ? `${String(f.sop.title).toLowerCase()} jobs, following a written checklist` : `help with ${f.what || 'the work'}`;
  const me = f.firstName || 'the owner';
  const post = {
    title: `Part-time ${role}${where}`,
    body: [
      `${f.business ? `${f.business} is` : "I'm"} looking for a part-time ${role}${where}.`,
      `What you'll do: ${duties}.`,
      f.hours ? `When: ${text.oneLine(f.hours)}.` : 'When: a few set shifts a week, agreed in advance.',
      pay ? `Pay: ${pay}.` : 'Pay: shared on the first call.',
      `What matters most: you show up on time, you follow a checklist, and you take care of ${care}.`,
      `First step: one paid trial job with ${me}, paid at the same rate whether or not it's a fit.`,
      'To apply: reply with a few lines about you, the days you can work, and how you get around. No resume needed.',
    ].join('\n'),
  };
  const trial = [
    `Send them the checklist${f.sop ? ` (${f.sop.title})` : ''} the day before and ask them to read it.`,
    'Do the first half of the job together, then let them lead the second half while you watch.',
    'Do the final check together and let them fix anything they missed.',
    'Score them with the scorecard the same day, while it is fresh.',
    pay ? `Pay them for the trial the same day: ${pay}, even if it is a no.` : 'Pay them for the trial the same day, even if it is a no.',
  ];
  const scorecard = [
    { area: 'On time and ready', good: 'Arrived on time with what the checklist says to bring' },
    { area: 'Follows the checklist', good: 'Did every step, in order, without being reminded' },
    { area: 'Quality of the work', good: 'Passed your final check with few or no fixes' },
    { area: 'Care', good: `Took care of ${care}` },
    { area: 'Talks well with customers', good: 'Friendly, clear and calm, even with a question they could not answer' },
    { area: 'Asks when unsure', good: 'Asked instead of guessing' },
    ...steps.slice(0, 4).map((s) => ({ area: `Step ${s.n}: ${s.title}`, good: 'Done right the first time' })),
  ].map((r) => ({ ...r, score: '', notes: '' }));
  const questions = [
    'Tell me about a job where you followed someone else\'s checklist. What was hard about it?',
    'What would you do if you were going to be 20 minutes late to a customer?',
    'A customer says something was missed after you left. What do you say?',
    `What part of ${f.what || 'this work'} are you picky about?`,
    `Have you worked with ${care} before? Tell me about it.`,
    'Which days and hours can you work, and how do you get to jobs?',
    'What would make this a good part-time job for you?',
    'What questions do you have for me?',
  ];
  const share = [
    'Ask people you trust first: friends, past coworkers and happy customers who know someone.',
    'Post it on your own business pages.',
    'Post in local groups that allow job posts. Read each group\'s rules first.',
    'A job site like Indeed or a local job board. Check what it charges before you pay to boost a post.',
  ];
  const rules = {
    lines: [
      "Check your state's rules on contractors and employees before the paid trial.",
      'Whether a helper is a contractor or an employee depends on how the work is controlled and paid, not on the title you use. The IRS page below explains the three things it looks at.',
      "If the helper is an employee, pay must meet your state's minimum wage, and you will need payroll. Your state labor office lists both.",
      'This is not legal or tax advice. If you are unsure, ask a tax professional or your state labor office before the first paid shift.',
    ],
    sources: RULES.sources,
  };
  return { role, post, trial, scorecard, questions, share, rules, pay };
}

module.exports = { templatePacket, careFor, payLine, RULES };
