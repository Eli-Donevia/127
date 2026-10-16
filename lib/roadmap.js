// Turns onboarding answers into a 30-day roadmap: 4 weeks, 2-3 steps each,
// every step tied to a resource where possible. Deterministic on purpose, so
// entitlements and progress are predictable; the AI layer only adds a personal note.

const { resources } = require('../content/resources.json');
const bySlug = Object.fromEntries(resources.map((r) => [r.slug, r]));

const STAGE_LABEL = {
  exploring: 'exploring ideas',
  validating: 'validating an idea',
  launched: 'recently launched',
  growing: 'growing',
  scaling: 'scaling',
};

const GOAL_LABEL = {
  pick_idea: 'pick an idea you are confident in',
  validate: 'prove people will pay',
  launch: 'launch and make your first sale',
  first_customers: 'get consistent customers',
  audience: 'build an audience that buys',
  revenue: 'grow revenue meaningfully',
  systems: 'get your time back with systems',
};

const TRACKS = {
  start: {
    name: 'Start',
    focus: 'Choose the right idea, prove demand and make a first offer.',
    weeks: [
      { theme: 'Choose on purpose', tasks: [
        { t: 'Score your ideas with the Idea Test', r: 'idea-filter' },
        { t: 'Write the problem you solve in one sentence', d: 'Use words a customer would say, not industry jargon.' },
        { t: 'List 10 people who have this problem', d: 'Names, not personas. These are your first conversations.' },
      ] },
      { theme: 'Talk to customers', tasks: [
        { t: 'Book five discovery conversations', r: 'validation-interviews' },
        { t: 'Run the interviews and take notes in their words', d: 'Ask about the past, never pitch.' },
        { t: 'Highlight the phrases that came up more than once', d: 'These become your headline and your offer.' },
      ] },
      { theme: 'Shape the offer', tasks: [
        { t: 'Draft your one-page offer', r: 'offer-builder' },
        { t: 'Check that the numbers can work', r: 'business-model-worksheet' },
        { t: 'Read the offer to three people in your audience', d: 'If they ask what you actually do, rewrite it.' },
      ] },
      { theme: 'Ask for the sale', tasks: [
        { t: 'Outline a simple landing page', r: 'landing-page-brief' },
        { t: 'Personally offer it to your warm list', r: 'dm-outreach-scripts' },
        { t: 'Write down what you learned and what you will change', d: 'A "no" with a reason is progress.' },
      ] },
    ],
  },
  build: {
    name: 'Build',
    focus: 'Tighten the offer, look credible and run a real launch.',
    weeks: [
      { theme: 'Sharpen the offer', tasks: [
        { t: 'Rewrite your offer on one page', r: 'offer-builder' },
        { t: 'Check your pricing and margins', r: 'business-model-worksheet' },
        { t: 'Interview three recent customers or prospects', r: 'validation-interviews' },
      ] },
      { theme: 'Look the part', tasks: [
        { t: 'Create your one-page brand sheet', r: 'brand-basics' },
        { t: 'Rebuild your landing page from the brief', r: 'landing-page-brief' },
        { t: 'Trim your tools to the simple stack', r: 'simple-ops-stack' },
      ] },
      { theme: 'Prepare the launch', tasks: [
        { t: 'Work through the launch checklist', r: 'launch-checklist' },
        { t: 'Plan 30 days of content', r: 'content-calendar' },
        { t: 'Warm up 20 people personally', r: 'dm-outreach-scripts' },
      ] },
      { theme: 'Launch', tasks: [
        { t: 'Launch and message your warm list', d: 'Personal messages beat broadcast posts on day one.' },
        { t: 'Log every objection you hear', d: 'They become your FAQ and your next round of content.' },
        { t: 'Set up your weekly scorecard', r: 'kpi-dashboard' },
      ] },
    ],
  },
  grow: {
    name: 'Grow',
    focus: 'Build a content engine and turn attention into customers.',
    weeks: [
      { theme: 'Know your numbers', tasks: [
        { t: 'Fill in your first weekly scorecard', r: 'kpi-dashboard' },
        { t: 'Talk to your three best customers', r: 'validation-interviews' },
        { t: 'Rewrite your headline in their words', r: 'offer-builder' },
      ] },
      { theme: 'Build the content engine', tasks: [
        { t: 'Map your 30-day content calendar', r: 'content-calendar' },
        { t: 'Write ten hooks for your niche', r: 'hooks-library' },
        { t: 'Batch-create one full week of posts', d: 'Two focused hours beat seven scattered days.' },
      ] },
      { theme: 'Turn conversations into customers', tasks: [
        { t: 'Send 20 warm outreach messages', r: 'dm-outreach-scripts' },
        { t: 'Fix the biggest leak on your sales page', r: 'landing-page-brief' },
        { t: 'Set a capped test budget for paid reach', r: 'launch-budget-calculator' },
      ] },
      { theme: 'Double down', tasks: [
        { t: 'Compare this week to week one', r: 'kpi-dashboard' },
        { t: 'Cut the one activity that produced nothing', d: 'Growth is mostly subtraction.' },
        { t: 'Plan your next 30 days around what worked', d: 'Retake the assessment if your stage has changed.' },
      ] },
    ],
  },
  systems: {
    name: 'Build',
    focus: 'Systemize, automate and delegate so the business grows without you.',
    weeks: [
      { theme: 'See the business clearly', tasks: [
        { t: 'Set up your weekly founder scorecard', r: 'kpi-dashboard' },
        { t: 'Audit where your hours went last week', r: 'delegation-playbook' },
        { t: 'Name the single biggest bottleneck', d: 'If it disappeared, what would grow fastest?' },
      ] },
      { theme: 'Systemize', tasks: [
        { t: 'Document one repeated process', r: 'delegation-playbook' },
        { t: 'Consolidate your tools', r: 'simple-ops-stack' },
        { t: 'Pick your first two automations', r: 'automation-starter' },
      ] },
      { theme: 'Automate and delegate', tasks: [
        { t: 'Get two automations running', r: 'automation-starter' },
        { t: 'Hand off your first documented task', d: 'Review the first three runs, then let go.' },
        { t: 'Model a capped paid-growth test', r: 'launch-budget-calculator' },
      ] },
      { theme: 'Lead', tasks: [
        { t: 'Make the Monday scorecard a ritual', r: 'kpi-dashboard' },
        { t: 'Write next quarter’s three priorities', d: 'Three, not ten.' },
        { t: 'Plan founder-led content for the month', r: 'content-calendar' },
      ] },
    ],
  },
};

function pickTrack(a) {
  if (a.goal === 'systems' || a.stage === 'scaling') return 'systems';
  if (a.goal === 'pick_idea' || a.goal === 'validate') return 'start';
  if (a.stage === 'exploring' || a.stage === 'validating') return 'start';
  if (a.goal === 'launch') return 'build';
  if (a.stage === 'launched' && a.goal !== 'audience' && a.goal !== 'revenue') return 'build';
  return 'grow';
}

const OBSTACLE_NOTES = {
  where_to_start: 'You said you are not sure where to start. You do not need to see the whole staircase: just do this week’s steps in order.',
  time: 'Time is tight, so each week is trimmed to the steps that matter most.',
  offer: 'Your offer is the lever. Spend extra care on the offer steps; everything downstream gets easier.',
  attention: 'Attention is the bottleneck, so content and outreach show up early.',
  sales: 'People look but do not buy: that is usually a clarity or trust problem, not a traffic problem.',
  tools: 'Fewer tools, more progress. Ignore anything not on this page for the next 30 days.',
  money: 'Every step here can be done for $0.',
  accountability: 'Consistency beats intensity. Post your weekly commitment on the wins board.',
};

function generate(answers) {
  const a = answers || {};
  const trackKey = pickTrack(a);
  const track = TRACKS[trackKey];
  const trimmed = a.time === 'lt3';
  const obstacles = Array.isArray(a.obstacles) ? a.obstacles : a.obstacles ? [a.obstacles] : [];

  const weeks = track.weeks.map((w, wi) => {
    let tasks = w.tasks.map((task, ti) => {
      const res = task.r ? bySlug[task.r] : null;
      return {
        id: `${trackKey}-w${wi + 1}-t${ti + 1}`,
        title: task.t,
        detail: task.d || (res ? res.summary : ''),
        resource: res ? res.slug : null,
        resourceTier: res ? res.tier : 'free',
        xp: res ? 40 : 25,
      };
    });
    if (trimmed) tasks = tasks.filter((t, i) => i < 2 || t.resource).slice(0, 2);
    if (obstacles.includes('accountability') && wi === 0) {
      tasks.push({ id: `${trackKey}-w1-commit`, title: 'Post your commitment for this week on the wins board', detail: 'Saying it out loud makes it real.', resource: null, resourceTier: 'free', xp: 20, action: '/app/wins' });
    }
    return { week: wi + 1, theme: w.theme, tasks, freeVisible: wi < 2 };
  });

  return {
    track: trackKey,
    trackName: track.name,
    focus: track.focus,
    headline: `You're ${STAGE_LABEL[a.stage] || 'getting started'}, aiming to ${GOAL_LABEL[a.goal] || 'make real progress'}.`,
    notes: obstacles.map((o) => OBSTACLE_NOTES[o]).filter(Boolean),
    outcome: (a.outcome || '').slice(0, 400),
    weeks,
    generatedAt: new Date().toISOString(),
  };
}

function allTasks(roadmap) {
  return roadmap ? roadmap.weeks.flatMap((w) => w.tasks) : [];
}

module.exports = { generate, allTasks, TRACKS, STAGE_LABEL, GOAL_LABEL };
