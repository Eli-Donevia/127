// The offer for web design: price menu at the member's position (kit quote over data/prices.json),
// care plans, the first-clients ladder, the money model and job math from the member's own numbers.
// Prices are per project or per month for one client. Never a total of what anyone will earn.

const { quote, money, text } = require('../../_kit');
const prices = require('../data/prices.json');
const niche = require('../data/niche.json');

function careMenu(position) {
  return (prices.care_plans || []).map((c) => ({ id: c.id, label: c.label, price: quote.priceAt(c.range, position), unit: c.unit || 'month', includes: c.includes || [], range: c.range }));
}

function build({ position = 'standard', hourly = 25, monthlyCosts = 0, spots = 3, town = '' } = {}) {
  const menu = quote.menu(prices, { position });
  const care = careMenu(position);
  const off = niche.ladder.off;
  const ladder = {
    spots,
    off,
    ask: niche.ladder.ask,
    step_up: niche.ladder.step_up,
    reviews_rule: niche.ladder.reviews_rule,
    prices: menu.packages.map((p) => ({ id: p.id, label: p.label, full: p.price, founding: money.nicePrice(p.price * (1 - off)) })),
  };
  const math = menu.packages.map((p) => {
    const m = quote.jobMath(p.price, p.minutes, { hourly, monthlyFixed: monthlyCosts });
    return { id: p.id, label: p.label, price: p.price, hours: Math.round((p.minutes || 0) / 6) / 10, labor: m.labor, left: m.left, jobsToCoverFixed: m.jobsToCoverFixed };
  });
  const one = menu.packages.find((p) => p.id === 'one_page');
  const small = menu.packages.find((p) => p.id === 'small_site');
  const fix = menu.packages.find((p) => p.id === 'fix_list');
  const model = [
    { step: 'Setup', what: one.label, price: `${money.usd(one.price)} one time` },
    { step: 'Monthly plan', what: care[0].label, price: `${money.usd(care[0].price)} a month` },
    { step: 'Upsell', what: `${small.label} or online booking set up`, price: `${money.usd(small.price)} one time, or ${money.usd(menu.addons[0].price)} for booking` },
    { step: 'Downsell', what: fix.label, price: `${money.usd(fix.price)} one time` },
  ];
  const name = text.plain(town ? `${town} phone-ready website in 14 days` : 'Phone-ready website in 14 days');
  return { position, menu, care, ladder, math, model, name, promise: niche.promise, who: 'Owner-run local businesses whose website is missing, broken or not set up for phones', outcome: 'A website that works on a phone, with a tap-to-call button, your hours and a way to book or ask for a quote' };
}

module.exports = { build, careMenu };
