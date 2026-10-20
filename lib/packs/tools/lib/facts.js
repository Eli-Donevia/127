// The member's facts every app is filled with: business name, what they do, prices, contact lines
// and color. A tool's own input wins over the brain. When no prices are known, example prices for
// their kind of business stand in, and the app says so.

const { brain, text } = require('../../_kit');
const { parsePrices } = require('./prices');
const { accentOf } = require('./shell');
const SAMPLE = require('../data/sample-items.json');

function sampleItems(what) {
  const w = String(what || '').toLowerCase();
  const set = SAMPLE.sets.find((s) => s.match && new RegExp(s.match).test(w)) || SAMPLE.sets[SAMPLE.sets.length - 1];
  return set.items.map((x) => ({ ...x }));
}

const httpsOrEmpty = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '');
const phoneOf = (s) => (String(s || '').replace(/[^\d+]/g, '').length >= 7 ? text.clip(String(s), 30) : '');
const emailOf = (s) => (/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(String(s || '').trim()) ? String(s).trim() : '');

function factsOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const links = (ctx && ctx.brain && ctx.brain.links) || {};
  let items = parsePrices(input.prices || '');
  let sample = false;
  if (!items.length && b.price != null && b.offer) items = [{ name: text.clip(b.offer, 60), price: b.price, unit: '', detail: '' }];
  if (!items.length) {
    items = sampleItems(`${b.what} ${b.niche} ${input.description || ''}`);
    sample = true;
  }
  return {
    business: b.name || 'Your business',
    hasName: !!b.name,
    what: b.what || b.niche || '',
    city: b.place || '',
    phone: phoneOf(input.phone),
    email: emailOf(input.email),
    booking: httpsOrEmpty(input.link || links.booking),
    website: httpsOrEmpty(links.website),
    accent: accentOf(input.color),
    items,
    sampleItems: sample,
    firstName: b.firstName || '',
    timezone: b.timezone,
  };
}

module.exports = { factsOf, sampleItems, httpsOrEmpty, phoneOf, emailOf };
