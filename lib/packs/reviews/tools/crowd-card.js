// Step 1 of the spine: is this a starving crowd? The reviews card, with the season and the
// 3 things not to do yet.

const { crowd, views } = require('../../_kit');
const NICHE = require('../data/niche.json');

module.exports = {
  name: 'reviews.crowd_card',
  title: 'Is this a good crowd',
  description: 'Shows how hungry local shops are for more Google reviews: our scores, the best months to pitch and 3 things not to do yet.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { city: { type: 'string', maxLength: 120 } } },
  output: { type: 'object', required: ['card'], properties: { card: { type: 'object' } } },
  timeoutSec: 10,
  async run(input, ctx) {
    const month = new Date(ctx && ctx.now ? ctx.now() : Date.now()).getUTCMonth() + 1;
    const card = crowd.card(NICHE.crowd, { month, title: 'More Google reviews for local shops: is this a good crowd?' });
    return { card };
  },
  view(out) {
    return views.blocks(crowd.blocks(out.card), views.text('Sell more reviews the honest way: a card and a link that make it easy for every customer to leave one.'));
  },
};
