// Still picking: someone who wants to start but hasn't chosen what. Your first 25 conversations to
// test one idea with people who might buy it (questions about what they did, never "would you buy
// it?"), an idea finder that matches them to the business packs in this library, a 7-day test plan,
// a one-page offer, a test landing page with no form, a scorecard and a "pick one" decision page.
// Never says an idea will work or what it could earn. Niche facts: data/niche.json.

const first = require('./tools/first25');
const finder = require('./tools/finder');
const plan = require('./tools/test-plan');
const offer = require('./tools/offer');
const landing = require('./tools/landing');
const score = require('./tools/scorecard');
const pick = require('./tools/pick-one');
const NICHE = require('./data/niche.json');

const pass = (tool) => Object.fromEntries(Object.keys(tool.input.properties).map((k) => [k, `$inputs.${k}`]));
const inputsOf = (tool) => ({ type: 'object', properties: tool.input.properties, ...(tool.input.required ? { required: tool.input.required } : {}) });
const one = (id, tool, w) => ({ id, inputs: inputsOf(tool), steps: [{ id: 'run', tool: tool.name, input: pass(tool) }], result: ['run'], ...w });

module.exports = {
  id: 'idea',
  title: 'Still picking',
  version: '0.1.0',
  business: true,
  held: true,
  summary: 'Not sure what to start? Test one idea in 25 conversations, find ideas that fit your skills, plan a 7-day test, draft an offer and a landing page, score what you heard and pick one.',
  niches: ['not sure yet', 'no idea yet', 'business idea', 'validate my idea', 'still picking', 'test an idea'],
  notYet: NICHE.crowd.not_yet,
  uses: [],
  tools: [first, finder, plan, offer, landing, score, pick],
  workflows: [
    one('idea.first_25', first, {
      title: 'Your first 25',
      promise: '25 conversations to test one idea: people you know and local businesses, a note for each, the questions to ask and a log to fill in.',
      proof: 'An honest crowd check, 25 names with a note each, questions about what people did, and a conversation log, saved to your Pipeline',
      minutes: 15,
      tier: 'free',
      job: 'leads',
      starter: true,
      next: [
        { id: 'idea.scorecard', why: 'Talked to people? Score what you heard.' },
        { id: 'idea.test_plan', why: 'Plan the whole week of the test.' },
      ],
    }),
    one('idea.finder', finder, {
      title: 'Find ideas that fit you',
      promise: 'Your skills, hours, budget and area matched to the business types in 127, and which one to open next. A match, not a forecast.',
      minutes: 3,
      tier: 'free',
      job: 'plan',
      next: [
        { id: 'idea.first_25', why: 'Test the idea with 25 conversations.' },
        { id: 'idea.pick_one', why: 'Torn between a few? Put them side by side.' },
      ],
    }),
    one('idea.test_plan', plan, {
      title: '7-day idea test',
      promise: 'Seven days from writing the problem down to a decision, against a bar you set first, with a calendar file.',
      minutes: 4,
      tier: 'builder',
      job: 'plan',
      next: [{ id: 'idea.first_25', why: 'Day 2: list your 25 and send the first notes.' }],
    }),
    one('idea.offer_draft', offer, {
      title: 'One-page offer',
      promise: 'Who it is for, the problem in their words, what you do, how it works and your price per job, as a printable page and text.',
      minutes: 6,
      tier: 'builder',
      job: 'sales',
      next: [
        { id: 'idea.landing_page', why: 'Put the offer on a simple page to share.' },
        { id: 'idea.scorecard', why: 'Showed it around? Score the answers.' },
      ],
    }),
    one('idea.landing_page', landing, {
      title: 'Test landing page',
      promise: 'One simple page for your idea with an email button and your address shown as text. No form and nothing collected.',
      minutes: 6,
      tier: 'builder',
      job: 'site',
      next: [{ id: 'idea.scorecard', why: 'Count the emails as commitments in your log.' }],
    }),
    one('idea.scorecard', score, {
      title: 'Score your conversations',
      promise: 'Who had the problem, who already spends on it, who committed and who made an intro, against your bar, and what to do next.',
      minutes: 4,
      tier: 'builder',
      job: 'plan',
      next: [
        { id: 'idea.pick_one', why: 'Tested more than one idea? Pick one.' },
        { id: 'idea.offer_draft', why: 'People have the problem? Draft the offer in their words.' },
      ],
    }),
    one('idea.pick_one', pick, {
      title: 'Pick one',
      promise: 'Two to four ideas side by side on your counts and ratings, weighted toward what people did, with the one to go with.',
      minutes: 5,
      tier: 'builder',
      job: 'plan',
      next: [{ id: 'idea.test_plan', why: 'Plan the 7-day test for the one you picked.' }],
    }),
  ],
};
