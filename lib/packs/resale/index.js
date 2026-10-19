// Resale and flipping: your first 25 items to look for with fee math on every platform, price and
// offers for each item, the listing writer and a batch lister (within each platform's checked
// limits) with a profit tracker CSV that has working formulas, answers to buyers (offers, holds,
// no-shows and the scams to avoid), thank-yous, a sold card and a sourcing route from your own stops.
// Genuine items only, recalls checked, flaws named.
// Niche facts live in data/niche.json (sources: research/niches/resale.json).

const C = require('../_kit/common');
const { first25Tool } = require('./tools/first25');
const { priceTool } = require('./tools/price');
const { listingTool, trackerTool } = require('./tools/listing');
const { batchTool } = require('./tools/batch');
const { buyersTool } = require('./tools/buyers');
const { soldCardTool } = require('./tools/sold-card');
const { routeTool } = require('./tools/route');

const N = C.load(__dirname);
const first = first25Tool(N);
const price = priceTool(N);
const listing = listingTool(N);
const tracker = trackerTool(N);
const batch = batchTool(N);
const buyers = buyersTool(N);
const keep = C.keepTool(N);
const sold = soldCardTool(N);
const route = routeTool(N);

module.exports = {
  id: 'resale',
  title: 'Resale and flipping',
  version: '1.1.0',
  business: true,
  summary: "Start reselling: 25 items to look for with fee math on every platform, prices and offers, listings within each site's limits, answers to buyers, a profit tracker, sold cards and a sourcing route.",
  niches: ['resale', 'flipping', 'thrift reselling'],
  uses: [],
  tools: [first, price, listing, tracker, batch, buyers, keep, sold, route],
  workflows: [
    {
      id: 'resale.first_25',
      title: 'Your first 25',
      promise: '25 items to look for this week in your category, with a sold-price link, where to find each one, the fee on every platform and the most to pay.',
      minutes: 15,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: first.input.properties },
      steps: [{ id: 'items', tool: first.name, input: { category: '$inputs.category', platform: '$inputs.platform', price: '$inputs.price', profit: '$inputs.profit', exclude: '$inputs.exclude' } }],
      result: ['items'],
      next: [
        { id: 'resale.route', why: 'Put the stores and sales near you in order for one morning.' },
        { id: 'resale.offer', why: 'Found one? Price it from sold prices before you list.' },
      ],
    },
    {
      id: 'resale.offer',
      title: 'Price and offers',
      promise: 'For one item: a list price from sold prices, your lowest price after fees, the offer to send watchers, a bundle rule and markdown dates.',
      minutes: 5,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', required: ['item', 'sold'], properties: price.input.properties },
      steps: [{ id: 'price', tool: price.name, input: { item: '$inputs.item', sold: '$inputs.sold', cost: '$inputs.cost', weight: '$inputs.weight', platform: '$inputs.platform', profit: '$inputs.profit' } }],
      result: ['price'],
      next: [
        { id: 'resale.listing', why: 'Write the listing at this price.' },
        { id: 'resale.reply', why: 'A buyer made an offer: answer it with your lowest price in hand.' },
      ],
    },
    {
      id: 'resale.listing',
      title: 'Listing writer and profit tracker',
      promise: 'A listing for each platform within its own limits, with honest condition and flaws, plus a profit tracker CSV with working formulas.',
      minutes: 10,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['item'], properties: { ...listing.input.properties, items: tracker.input.properties.items } },
      steps: [
        { id: 'listing', tool: listing.name, input: { item: '$inputs.item', brand: '$inputs.brand', size: '$inputs.size', color: '$inputs.color', condition: '$inputs.condition', flaws: '$inputs.flaws', details: '$inputs.details', price: '$inputs.price', weight: '$inputs.weight', keywords: '$inputs.keywords' } },
        { id: 'tracker', tool: tracker.name, input: { items: '$inputs.items' } },
      ],
      result: ['listing', 'tracker'],
      next: [
        { id: 'resale.batch', why: 'More than a few items to list? Do them in one batch.' },
        { id: 'resale.reply', why: 'A buyer wrote: answer it, and skip the scams.' },
      ],
    },
    {
      id: 'resale.batch',
      title: 'List a batch',
      promise: "Up to 40 listings for the one site you sell on, each within that site's checked limits, with fee and profit, plus your profit tracker filled in.",
      minutes: 15,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['items'], properties: batch.input.properties },
      steps: [
        { id: 'batch', tool: batch.name, input: { items: '$inputs.items', platform: '$inputs.platform', weight: '$inputs.weight', profit: '$inputs.profit' } },
        { id: 'tracker', tool: tracker.name, when: '$batch.tracker_items', input: { items: '$batch.tracker_items' } },
      ],
      result: ['batch', 'tracker'],
      next: [
        { id: 'resale.reply', why: 'Buyers are writing: answer offers and skip the scams.' },
        { id: 'resale.route', why: 'Listed it all? Plan the next sourcing morning.' },
      ],
    },
    {
      id: 'resale.reply',
      title: 'Answer a buyer',
      promise: 'Paste what a buyer wrote: is it available, offers and lowballs, holds, late buyers and no-shows, and the scams to avoid, with the answer to send.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', properties: buyers.input.properties },
      steps: [{ id: 'answer', tool: buyers.name, input: C.passInputs(Object.keys(buyers.input.properties)) }],
      result: ['answer'],
      next: [
        { id: 'resale.keep', why: 'It sold: thank the buyer and ask for an honest rating.' },
        { id: 'resale.offer', why: 'Not sure of your lowest price? Work it out first.' },
      ],
    },
    {
      id: 'resale.keep',
      title: 'Thank-you and repeat buyers',
      promise: 'For every order: a thank-you note for the package, an honest rating ask after delivery and a bundle offer for their next order.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: keep.input.properties },
      steps: [{ id: 'keep', tool: keep.name, input: { client: '$inputs.client', done: '$inputs.done', review_link: '$inputs.review_link', reward: '$inputs.reward', business: '$inputs.business', phone: '$inputs.phone', link: '$inputs.link' } }],
      result: ['keep'],
      next: [
        { id: 'resale.proof', why: 'Show what sold, so buyers come back for the next find.' },
        { id: 'resale.first_25', why: 'Restock: the next 25 items to look for.' },
      ],
    },
    {
      id: 'resale.proof',
      title: 'Sold card',
      promise: 'A "Sold" card with the item photo, where it sold and how fast, and a caption pointing to your shop. Never what you made or who bought it.',
      minutes: 5,
      tier: 'builder',
      job: 'content',
      inputs: { type: 'object', required: ['item'], properties: sold.input.properties },
      steps: [{ id: 'card', tool: sold.name, input: C.passInputs(Object.keys(sold.input.properties)) }],
      result: ['card'],
      next: [
        { id: 'resale.batch', why: 'Keep the shop full: list the next batch.' },
        { id: 'resale.route', why: 'Plan the next sourcing morning.' },
      ],
    },
    {
      id: 'resale.route',
      title: 'Plan a sourcing route',
      promise: 'The stores and sales you list, in a sensible order with times, what to bring, what to look for at each, and map links your phone opens.',
      minutes: 10,
      tier: 'builder',
      job: 'ops',
      inputs: { type: 'object', required: ['stops'], properties: route.input.properties },
      steps: [{ id: 'route', tool: route.name, input: C.passInputs(Object.keys(route.input.properties)) }],
      result: ['route'],
      next: [
        { id: 'resale.offer', why: 'Back with finds: price each one from sold prices.' },
        { id: 'resale.batch', why: 'List everything you bought within 2 days.' },
      ],
    },
  ],
};
