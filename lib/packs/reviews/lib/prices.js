// The member's review prices in one place: setup, monthly care and the card kit they print, at their
// position in data/prices.json (or their own numbers), plus the founding-client terms and the lines
// that say the price once. Used by the reply answers, call prep and the care plan, so every tool
// quotes the same numbers. Prices are per client, never a total of what anyone will earn.

const kit = require('../../_kit');
const { money, quote, brain } = kit;
const PRICES = require('../data/prices.json');
const NICHE = require('../data/niche.json');

const pkg = (id) => PRICES.packages.find((p) => p.id === id) || {};
const POSITIONS = ['budget', 'standard', 'premium'];

// What the member saved from "Your offer" (brain.packs.reviews.offer), when there is one.
function remembered(ctx) {
  const m = brain.packMemory(ctx, 'reviews');
  return m && m.offer && typeof m.offer === 'object' ? m.offer : {};
}

// input: { position, setup, care }. Typed numbers win, then the saved offer (unless useSaved is
// false, as in "Your offer" itself), then the band at the member's position.
function offerNumbers(input = {}, ctx, { useSaved = true } = {}) {
  const saved = useSaved ? remembered(ctx) : {};
  const pick = (k) => (input[k] != null && Number(input[k]) >= 0 ? Number(input[k]) : saved[k] != null && Number(saved[k]) >= 0 ? Number(saved[k]) : null);
  const position = POSITIONS.includes(input.position) ? input.position : POSITIONS.includes(saved.position) ? saved.position : 'standard';
  const overrides = {};
  if (pick('setup') != null) overrides.setup = pick('setup');
  if (pick('care') != null) overrides.care = pick('care');
  const m = quote.menu(PRICES, { position, overrides });
  const price = (id) => (m.packages.find((p) => p.id === id) || {}).price || 0;
  const setup = price('setup');
  const care = price('care');
  const kitPrice = quote.menu({ packages: [PRICES.downsell] }, { position }).packages[0].price;
  return { position, setup, care, kit: kitPrice, halfSetup: money.nicePrice(setup / 2), halfCare: money.nicePrice(care / 2), addons: m.addons, saved: !!Object.keys(saved).length };
}

// The price, said once. founding: true while the member has fewer than 3 clients.
function priceSay(n, { founding = false } = {}) {
  const base = `Setup is ${money.usd(n.setup)} one time, then ${money.usd(n.care)} a month for a reply draft to every new review, fresh cards and a monthly report. No contract.`;
  const found = `You'd be one of my first ${NICHE.first_clients.founding_count} clients, so setup is free and the first 3 months are ${money.usd(n.halfCare)} a month. All I ask is honest feedback and a short testimonial I can quote, saying you were a founding client.`;
  return { base, founding: founding ? found : '', tools: `Printing is billed at cost: 500 handout cards were ${NICHE.print[1].price} at ${NICHE.print[1].vendor} when I checked.` };
}

// For sales.proposal (most complete first) and sales.quote (line items).
function proposalOptions(n) {
  return [
    { name: 'Reviews with care', price: n.care, unit: 'month', summary: `Setup ${money.usd(n.setup)} one time, then ${money.usd(n.care)} a month.`, includes: [...pkg('setup').includes.slice(0, 3), ...pkg('care').includes.slice(0, 3)] },
    { name: 'Setup only', price: n.setup, unit: 'one time', summary: 'Cards, links and the words for your team, set up once.', includes: pkg('setup').includes },
    { name: 'Card kit', price: n.kit, unit: 'one time', summary: 'Everything made for you; you print it.', includes: PRICES.downsell.includes },
  ];
}

// For sales.call_script (it reads typed lines: "Name | price/month | include; include").
function optionsText(n) {
  return [
    `Reviews with care | $${n.care}/month | setup $${n.setup} one time; review link and cards; a reply draft for every new review; monthly report`,
    `Setup only | $${n.setup} | review link, counter and handout cards, the words for your team, reply templates`,
    `Card kit | $${n.kit} | counter and handout cards with their code; you print them`,
  ].join('\n');
}

function quoteItems(n) {
  return [
    { label: pkg('setup').label, detail: pkg('setup').includes.slice(0, 3).join(', '), qty: 1, unit: 'setup', price: n.setup, taxable: false },
    { label: pkg('care').label, detail: 'First month, no contract', qty: 1, unit: 'month', price: n.care, taxable: false },
  ];
}

module.exports = { PRICES, pkg, offerNumbers, priceSay, proposalOptions, optionsText, quoteItems, remembered };
