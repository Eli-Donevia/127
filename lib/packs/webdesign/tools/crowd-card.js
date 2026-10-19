// Step 1 of the spine: is this a starving crowd? The pack's scores, best months, the slow season
// where the member lives, 3 things not to do yet, and what this run hands back.

const { crowd, views, time, brain, text } = require('../../_kit');
const niche = require('../data/niche.json');

module.exports = {
  name: 'webdesign.crowd_card',
  title: 'Is this a starving crowd',
  description: 'Shows the crowd card for web design for local businesses: scores, best months, 3 things not to do yet, and what you get in this run.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  timeoutSec: 10,
  input: { type: 'object', properties: { city: { type: 'string', title: 'Your city' }, buyer: { type: 'string', title: 'Who you sell to' } } },
  output: { type: 'object', properties: { card: { type: 'object' }, plan: { type: 'array' } }, required: ['card', 'plan'] },
  async run(input, ctx) {
    const br = brain.brainOf(ctx, input);
    const month = Number(time.today(ctx).slice(5, 7));
    const card = crowd.card(niche.crowd, { month, title: 'Is this a starving crowd? Web design for local businesses' });
    const who = text.oneLine(input.buyer || niche.buyers[0]);
    const plan = [
      `25 ${who} near ${text.oneLine(input.city || br.place || 'you')}, ranked by what their website is missing.`,
      'A mock homepage of the best one, built from their own site, as a page they can open and a phone picture.',
      'First messages for your top 5 with 2 follow-ups each, ready to send from your own accounts.',
      'A spreadsheet of all 25 with the dates to follow up.',
    ];
    return { card, plan };
  },
  view(out) {
    return views.blocks(crowd.blocks(out.card), views.text(`In this run: ${out.plan.join(' ')}`));
  },
};
