// The member's front desk prices in one place: setup, monthly care, care with after-hours answering
// and the do-it-yourself kit, at their position in data/prices.json (or their own numbers), plus the
// founding-client terms and the lines that say the price once. Used by the offer, the reply answers,
// call prep and the care plan, so every tool quotes the same numbers. Prices are per client, never a
// total of what anyone will earn.

const kit = require('../../_kit');
const { money, quote, brain } = kit;
const PRICES = require('../data/prices.json');
const NICHE = require('../data/niche.json');
const TOOLS = require('../data/tools.json');

const pkg = (id) => PRICES.packages.find((p) => p.id === id) || {};

// What the member saved from "Your offer" (brain.packs.frontdesk.offer), when there is one.
function remembered(ctx) {
  const m = brain.packMemory(ctx, 'frontdesk');
  return m && m.offer && typeof m.offer === 'object' ? m.offer : {};
}

// input: { position, setup, care, carePlus }. Typed numbers win, then the saved offer (unless
// useSaved is false, as in "Your offer" itself), then the band at the member's position.
function offerNumbers(input = {}, ctx, { useSaved = true } = {}) {
  const saved = useSaved ? remembered(ctx) : {};
  const pick = (k) => (input[k] != null && Number(input[k]) >= 0 ? Number(input[k]) : saved[k] != null && Number(saved[k]) >= 0 ? Number(saved[k]) : null);
  const position = ['budget', 'standard', 'premium'].includes(input.position) ? input.position : ['budget', 'standard', 'premium'].includes(saved.position) ? saved.position : 'standard';
  const overrides = {};
  if (pick('setup') != null) overrides.setup = pick('setup');
  if (pick('care') != null) overrides.care = pick('care');
  if (pick('carePlus') != null) overrides.care_plus = pick('carePlus');
  const m = quote.menu(PRICES, { position, overrides });
  const price = (id) => (m.packages.find((p) => p.id === id) || {}).price || 0;
  const setup = price('setup');
  const care = price('care');
  const carePlus = Math.max(price('care_plus'), care);
  const kitPrice = quote.menu({ packages: [PRICES.downsell] }, { position }).packages[0].price;
  const halfSetup = money.nicePrice(setup / 2);
  const halfCare = money.nicePrice(care / 2);
  return { position, setup, care, carePlus, kit: kitPrice, halfSetup, halfCare, addons: m.addons, saved: !!Object.keys(saved).length };
}

const toolsLine = () => `The tools run on their own accounts, about ${money.usd(TOOLS.tools.quo.monthly)} to ${money.usd(TOOLS.tools.jobber_ai.monthly)} a month.`;

// The price, said once. founding: true while the member has fewer than 3 clients.
function priceSay(n, { founding = false } = {}) {
  const base = `Setup is ${money.usd(n.setup)} one time, then ${money.usd(n.care)} a month to look after it. No contract.`;
  const found = `You'd be one of my first ${NICHE.first_clients.founding_count} clients, so setup is free and the first 3 months are ${money.usd(n.halfCare)} a month. All I ask is honest feedback and a short testimonial I can quote, saying you were a founding client.`;
  return { base, founding: founding ? found : '', tools: `${toolsLine().replace(/^The tools run on their own accounts/, 'The phone and booking tools sit on your own accounts')}` };
}

// For sales.proposal (most complete first) and sales.quote (line items).
function proposalOptions(n) {
  return [
    { name: 'Full front desk', price: n.carePlus, unit: 'month', summary: `Setup ${money.usd(n.setup)} one time, then ${money.usd(n.carePlus)} a month. Callers get a text back during the day and an answer after hours.`, includes: [...pkg('setup').includes.slice(0, 3), ...pkg('care_plus').includes] },
    { name: 'Never miss a call', price: n.care, unit: 'month', summary: `Setup ${money.usd(n.setup)} one time, then ${money.usd(n.care)} a month. Every missed call gets a text back with a way to book.`, includes: [...pkg('setup').includes.slice(0, 4), ...pkg('care').includes.slice(0, 3)] },
    { name: 'Do-it-yourself kit', price: n.kit, unit: 'one time', summary: 'Everything written for you; you set it up yourself.', includes: PRICES.downsell.includes },
  ];
}

// For sales.call_script (it reads typed lines: "Name | price/month | include; include").
function optionsText(n) {
  return [
    `Full front desk | $${n.carePlus}/month | setup $${n.setup} one time; text back on every missed call; after-hours answering`,
    `Never miss a call | $${n.care}/month | setup $${n.setup} one time; text back on every missed call; booking link; monthly report`,
    `Do-it-yourself kit | $${n.kit} | your texts, answers and booking flow; a setup sheet`,
  ].join('\n');
}

function quoteItems(n) {
  return [
    { label: pkg('setup').label, detail: pkg('setup').includes.slice(0, 3).join(', '), qty: 1, unit: 'setup', price: n.setup, taxable: false },
    { label: pkg('care').label, detail: 'First month, no contract', qty: 1, unit: 'month', price: n.care, taxable: false },
  ];
}

module.exports = { PRICES, pkg, offerNumbers, priceSay, proposalOptions, optionsText, quoteItems, toolsLine, remembered };
