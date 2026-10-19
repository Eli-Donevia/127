// The offer for social media: price menu at the member's position (kit quote over data/prices.json),
// the monthly plans, the first-clients ladder (a lower monthly price for the first 3 months), the
// money model and job math from the member's own numbers. Prices are for one client: per month for
// the plans, one time for the rest. Never a total of what anyone will earn.

const { quote, money, text } = require('../../_kit');
const prices = require('../data/prices.json');
const niche = require('../data/niche.json');

function careMenu(position) {
  return (prices.care_plans || []).map((c) => ({ id: c.id, label: c.label, price: quote.priceAt(c.range, position), unit: c.unit || 'month', minutes: c.minutes || null, includes: c.includes || [], summary: c.summary || '', range: c.range }));
}

function build({ position = 'standard', hourly = 25, monthlyCosts = 0, spots = 3, town = '' } = {}) {
  const menu = quote.menu(prices, { position });
  const care = careMenu(position);
  const L = niche.ladder;
  const ladder = {
    spots,
    off: L.off,
    months: L.months,
    ask: L.ask,
    step_up: L.step_up,
    reviews_rule: L.reviews_rule,
    // The founding price is on the monthly plans, for the first months only.
    prices: care.filter((c) => (L.applies_to || []).includes(c.id)).map((c) => ({ id: c.id, label: c.label, full: c.price, founding: money.nicePrice(c.price * (1 - L.off)), unit: 'month' })),
  };
  const costs = { hourly, monthlyFixed: monthlyCosts };
  const math = [
    ...care.map((c) => ({ id: c.id, label: `${c.label} (a month)`, ...pick(quote.jobMath(c.price, c.minutes, costs)), hours: hours(c.minutes) })),
    ...menu.packages.map((p) => ({ id: p.id, label: p.label, ...pick(quote.jobMath(p.price, p.minutes, costs)), hours: hours(p.minutes) })),
  ];
  const trial = menu.packages.find((p) => p.id === 'trial_week');
  const reels = menu.packages.find((p) => p.id === 'reels_pack');
  const shoot = menu.packages.find((p) => p.id === 'shoot_day');
  const [month, plus] = care;
  const model = [
    { step: 'Setup', what: trial.label, price: `${money.usd(trial.price)} one time` },
    { step: 'Monthly plan', what: month.label, price: `${money.usd(month.price)} a month` },
    { step: 'Upsell', what: `${plus.label}, or ${reels.label}`, price: `${money.usd(plus.price)} a month, or ${money.usd(reels.price)} one time` },
    { step: 'Downsell', what: `${shoot.label}: photos they post themselves`, price: `${money.usd(shoot.price)} one time` },
  ];
  const name = text.plain(town ? `${town} restaurant posts, 3 a week` : 'Restaurant posts, 3 a week');
  return {
    position,
    menu,
    care,
    ladder,
    math,
    model,
    name,
    promise: niche.promise,
    who: 'Owner-run restaurants, cafes, bakeries and bars whose social media is missing or quiet',
    outcome: 'Posts of your own food every week, in your colors, and nothing goes out without your yes',
  };
}

function pick(m) {
  return { price: m.price, labor: m.labor, left: m.left, jobsToCoverFixed: m.jobsToCoverFixed };
}
function hours(minutes) {
  return Math.round((minutes || 0) / 6) / 10;
}

module.exports = { build, careMenu };
