// What the warm pack needs to know about the member's business, from the brain and the offer
// pack's saved offer. Never invents a price or a result.

const { brain, color, text, money } = require('../../_kit');

function offerFacts(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const saved = brain.packMemory(ctx, 'offer').offer || {};
  const what = text.oneLine(input.what || saved.what || b.what || b.niche || b.offer || 'my new business');
  const price = input.price != null ? Number(input.price) : saved.price != null ? Number(saved.price) : b.price;
  const outcome = text.oneLine(saved.outcome || '');
  return {
    business: b.name,
    firstName: b.firstName,
    what,
    city: b.city,
    place: b.place,
    timezone: b.timezone || 'America/Chicago',
    price: Number.isFinite(price) && price > 0 ? price : null,
    priceText: Number.isFinite(price) && price > 0 ? money.usd(price) : '',
    need: outcome ? `wants ${outcome.replace(/^(a|an|the) /i, (m) => m.toLowerCase())}` : `could use ${what}`,
    offerName: saved.name || '',
    words: `${what} ${input.who || saved.who || b.audience || ''}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !/^(with|your|that|this|from|they|their|mobile|service|services)$/.test(w)),
    palette: color.palette(b.name || what, 0),
  };
}

module.exports = { offerFacts };
