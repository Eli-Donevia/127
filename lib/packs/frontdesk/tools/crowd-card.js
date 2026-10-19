// Step 1 of the spine: is this a starving crowd? The front desk card, with the season and the
// 3 things not to do yet.

const { crowd, views } = require('../../_kit');
const NICHE = require('../data/niche.json');

module.exports = {
  name: 'frontdesk.crowd_card',
  title: 'Is this a good crowd',
  description: 'Shows how hungry home service contractors are for a front desk that never misses a call: our scores, the best months to pitch and 3 things not to do yet.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { city: { type: 'string', maxLength: 120 } } },
  output: { type: 'object', required: ['card'], properties: { card: { type: 'object' } } },
  timeoutSec: 10,
  async run(input, ctx) {
    const month = new Date(ctx && ctx.now ? ctx.now() : Date.now()).getUTCMonth() + 1;
    const card = crowd.card(NICHE.crowd, { month, title: 'Front desks for contractors: is this a good crowd?' });
    return { card };
  },
  view(out) {
    return views.blocks(crowd.blocks(out.card), views.text('Sell "never miss a call". The tools run on their account; you set them up and look after them.'));
  },
};
