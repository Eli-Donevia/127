// Side-by-side check for the free tier and the public Idea Test (launch research item R02).
// It sends 10 typical Free-member questions through Eli's Playbook and 5 ideas through the
// Idea Test on two models, and writes both sets of answers to side-by-side.md in the app
// folder (next to package.json), wherever it is run from.
//
// It spends real money: under $1 in API calls on Opus 5.5 plus Haiku 5.5.
// Run it only on Eli's say-so. Nothing runs it automatically.
//
// Usage, in the Replit Shell:
//   npm run ai:side-by-side                           (claude-opus-5-5 vs claude-haiku-5-5)
//   npm run ai:side-by-side -- claude-opus-5-5 claude-sonnet-5-5
// Needs ANTHROPIC_API_KEY (already in Replit Secrets).

const fs = require('fs');
const path = require('path');

const [A = 'claude-opus-5-5', B = 'claude-haiku-5-5'] = process.argv.slice(2);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY first. Without it the Playbook only gives demo answers.');
  process.exit(1);
}

const QUESTIONS = [
  "I'm 17 and want to start something this month. I have about 5 hours a week and $50. Where do I start?",
  'Give me 3 business ideas I could test in my town.',
  'How do I know if anyone will actually pay for my idea?',
  'What should I charge for tutoring math to high schoolers?',
  "I sent 20 DMs and nobody replied. What am I doing wrong?",
  'Write me a first message to a gym owner about editing their Instagram videos.',
  'Should I run ads before I have a customer?',
  "My parents think this is a waste of time. How do I keep going?",
  'Can you tell me how to set up an LLC and file my taxes?',
  "What's the one thing I should do today?",
];

const IDEAS = [
  { idea: 'Pressure washing driveways and patios in my neighborhood', customer: 'Homeowners nearby', money: '$80 to $150 per job', edge: 'I already own a pressure washer' },
  { idea: 'Editing short videos for local gyms', customer: 'Gym owners who post on Instagram', money: 'Monthly package', edge: 'I edit my own TikToks' },
  { idea: 'A faceless YouTube channel about personal finance for teens', customer: 'Teens', money: 'Ads and affiliates', edge: '' },
  { idea: 'Notion templates for college students', customer: 'Freshmen', money: '$9 per template', edge: 'I use Notion every day' },
  { idea: 'Math tutoring for middle schoolers', customer: 'Parents in my town', money: '$30 an hour', edge: 'Straight As in math, and I tutor my cousin' },
];

function member() {
  return {
    id: 'side-by-side',
    name: 'Sam Lee',
    tier: 'free',
    emailVerified: true,
    answers: { stage: 'exploring', model: 'service', goal: 'validate', obstacles: ['where_to_start', 'time'], time: '3to7', budget: 'lt100', channels: ['instagram', 'tiktok'], ai_comfort: 'dabble', learning: ['templates'], outcome: 'Have my first paying customers', why: 'I want to build something of my own', circle_interest: 'later' },
    completed: {},
    milestones: {},
    worksheets: {},
  };
}

function loadIdeaTest(model) {
  process.env.IDEA_TEST_MODEL = model;
  const file = require.resolve('../lib/idea-test.js');
  delete require.cache[file];
  return require(file);
}

function load(model) {
  process.env.ANTHROPIC_MODEL_FREE = model;
  const file = require.resolve('../lib/ai.js');
  delete require.cache[file];
  return require(file);
}

(async () => {
  const answers = {};
  const cost = {};
  for (const model of [A, B]) {
    const ai = load(model);
    answers[model] = [];
    for (const q of QUESTIONS) {
      const r = await ai.chat([{ role: 'user', content: q }], member());
      answers[model].push(r.text);
      console.log(`${model}: ${q.slice(0, 50)}... done`);
    }
    cost[model] = ai.stats().usd;
  }
  const reports = {};
  for (const model of [A, B]) {
    const ideaTest = loadIdeaTest(model);
    reports[model] = [];
    for (const input of IDEAS) {
      const r = await ideaTest.run(input);
      reports[model].push(r.error ? `Error: ${r.error}` : JSON.stringify(r.report, null, 2));
      console.log(`${model} Idea Test: ${input.idea.slice(0, 40)}... done`);
    }
  }
  const out = [`# Free-tier model check: ${A} vs ${B}`, '', `Run on ${new Date().toISOString().slice(0, 10)}. Estimated chat cost: ${A} $${cost[A].toFixed(3)}, ${B} $${cost[B].toFixed(3)} for ${QUESTIONS.length} questions.`, '', 'For each question, decide whether the second answer is good enough for a Free member. Look for: specific next steps, the right playbook named, plain words, no income promises, and a clear "Next:" line.', ''];
  QUESTIONS.forEach((q, i) => {
    out.push(`## ${i + 1}. ${q}`, '', `### ${A}`, '', answers[A][i], '', `### ${B}`, '', answers[B][i], '');
  });
  out.push('# The Idea Test', '', 'Check that the scores are sensible, the reasons are specific to the idea, and the next step is one a founder could do this week. The Idea Test cost is not tracked here (about $0.03 a run on Opus 5.5).', '');
  IDEAS.forEach((input, i) => {
    out.push(`## Idea ${i + 1}. ${input.idea}`, '', `### ${A}`, '', '```json', reports[A][i], '```', '', `### ${B}`, '', '```json', reports[B][i], '```', '');
  });
  const outFile = path.join(__dirname, '..', 'side-by-side.md');
  fs.writeFileSync(outFile, out.join('\n'));
  console.log(`Wrote ${outFile}. Cost: ${A} $${cost[A].toFixed(3)}, ${B} $${cost[B].toFixed(3)}.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
