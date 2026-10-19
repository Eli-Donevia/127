// The offer for photography: price menu at the member's position (kit quote over data/prices.json),
// the monthly photo session, the first-clients ladder (a lower price on the business shoot and the
// half day for the first clients), the money model and job math from the member's own numbers.
// Prices are for one client: per shoot, per person, per property or per month. Never a total of what
// anyone will earn.

const { quote, money, text } = require('../../_kit');
const prices = require('../data/prices.json');
const niche = require('../data/niche.json');

function careMenu(position) {
  return (prices.care_plans || []).map((c) => ({ id: c.id, label: c.label, price: quote.priceAt(c.range, position), unit: c.unit || 'month', minutes: c.minutes || null, includes: c.includes || [], summary: c.summary || '', range: c.range }));
}

// "a shoot", "a person", "a property", "a month"
function per(unit) {
  return unit === 'person' ? 'a person' : unit === 'property' ? 'a property' : unit === 'month' ? 'a month' : 'one time';
}

function build({ position = 'standard', hourly = 25, monthlyCosts = 0, spots = 3, town = '' } = {}) {
  const menu = quote.menu(prices, { position });
  const care = careMenu(position);
  const L = niche.ladder;
  const pk = Object.fromEntries(menu.packages.map((p) => [p.id, p]));
  const ladder = {
    spots,
    off: L.off,
    ask: L.ask,
    step_up: L.step_up,
    reviews_rule: L.reviews_rule,
    prices: menu.packages.filter((p) => (L.applies_to || []).includes(p.id)).map((p) => ({ id: p.id, label: p.label, full: p.price, founding: money.nicePrice(p.price * (1 - L.off)), unit: 'project' })),
  };
  const costs = { hourly, monthlyFixed: monthlyCosts };
  const math = [
    ...menu.packages.map((p) => ({ id: p.id, label: p.unit === 'shoot' ? p.label : `${p.label} (${per(p.unit)})`, ...pick(quote.jobMath(p.price, p.minutes, costs)), hours: hours(p.minutes) })),
    ...care.map((c) => ({ id: c.id, label: `${c.label} (a month)`, ...pick(quote.jobMath(c.price, c.minutes, costs)), hours: hours(c.minutes) })),
  ];
  const [monthly] = care;
  const model = [
    { step: 'Setup', what: pk.business_shoot.label, price: `${money.usd(pk.business_shoot.price)} one time` },
    { step: 'Monthly plan', what: monthly.label, price: `${money.usd(monthly.price)} a month` },
    { step: 'Upsell', what: `${pk.half_day.label}, or ${pk.headshots.label.toLowerCase()}`, price: `${money.usd(pk.half_day.price)} one time, or ${money.usd(pk.headshots.price)} a person` },
    { step: 'Downsell', what: `${pk.hour_shoot.label}: 10 edited photos`, price: `${money.usd(pk.hour_shoot.price)} one time` },
  ];
  const name = text.plain(town ? `${town} business photos in 3 days` : 'Business photos in 3 days');
  return {
    position,
    menu,
    care,
    ladder,
    math,
    model,
    name,
    promise: niche.promise,
    who: 'Owner-run local businesses whose website and Google profile show few or old photos',
    outcome: 'Fresh photos of your own place, work and team, ready for your website, Google profile, posts and menus',
  };
}

function pick(m) {
  return { price: m.price, labor: m.labor, left: m.left, jobsToCoverFixed: m.jobsToCoverFixed };
}
function hours(minutes) {
  return Math.round((minutes || 0) / 6) / 10;
}

module.exports = { build, careMenu, per };
