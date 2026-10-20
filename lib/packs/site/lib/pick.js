// Which of the 8 designs fits a business best, with a plain reason. Pure: facts in, ranked list out.

const { TEMPLATES } = require('./templates');

const ALL_IDS = ['local-service', 'studio', 'restaurant', 'coach', 'product', 'creator', 'agency', 'portfolio'];
const ALIAS = { agency: 'coach', portfolio: 'coach', creator: 'coach', product: 'studio' };

const WHY = {
  'local-service': 'Built for service businesses people call or book: prices up front, your service area, hours, a quote form and a tap to call bar on phones.',
  studio: 'Built for appointment businesses: an elegant service menu with prices and times, a photo gallery and a big Book button.',
  restaurant: 'Built for food and drink: your menu with prices, hours, order and reservation buttons and directions.',
  coach: 'Built for one person people want to work with: the problem you solve, your offer, how it works, your story and a Book a call button.',
  product: 'Built to sell one product: a big product hero, price and Buy button, features and answers to buying questions.',
  creator: 'A link in bio page: your name, a short bio and big buttons to everything you want people to click.',
  agency: 'Built for business to business services: what you do, how you work, packages and a project inquiry form.',
  portfolio: 'Built to show your work: a gallery grid first, then services, about and a way to hire you.',
};

// facts: from facts.js. Returns [{ id, name, score, why }] best first.
function rankTemplates(facts, { prefer, only } = {}) {
  const scores = Object.fromEntries(ALL_IDS.map((id) => [id, 0]));
  const p = facts.profile || {};
  if (p.template) scores[p.template] += 10;
  const hay = `${facts.what} ${facts.offer} ${facts.niche || ''}`.toLowerCase();
  if (facts.menu && facts.menu.length && facts.menu.some((s) => s.items.length > 2)) scores.restaurant += 4;
  if (facts.orderLinks && facts.orderLinks.length) scores.restaurant += 3;
  if (facts.buy) scores.product += 4;
  if (facts.links && facts.links.length >= 3) scores.creator += 4;
  if (facts.booking && /book/i.test(facts.booking.label)) {
    scores.studio += 1;
    scores.coach += 1;
  }
  if (facts.mobile || facts.area) scores['local-service'] += 2;
  if (facts.online) {
    scores.agency += 1;
    scores.coach += 1;
    scores.product += 1;
  }
  if (/\b(for (businesses|brands|companies|startups|agencies|founders)|b2b|clients)\b/.test(hay)) scores.agency += 3;
  if (/\bportfolio|my work|reel\b/.test(hay)) scores.portfolio += 3;
  if (facts.included && facts.included.length >= 3) {
    scores.coach += 1;
    scores.product += 1;
  }
  // Second choices that fit most businesses of each kind.
  const near = {
    'local-service': ['studio', 'agency'],
    studio: ['local-service', 'portfolio'],
    restaurant: ['studio', 'local-service'],
    coach: ['agency', 'studio'],
    product: ['creator', 'agency'],
    creator: ['portfolio', 'coach'],
    agency: ['coach', 'portfolio'],
    portfolio: ['agency', 'creator'],
  }[p.template || 'local-service'];
  if (near) {
    scores[near[0]] += 3;
    scores[near[1]] += 2;
  }
  // Designs not in this version fold into the closest one we have.
  for (const [cut, to] of Object.entries(ALIAS)) if (!TEMPLATES.some((t) => t.kind === cut) && scores[to] != null) scores[to] += scores[cut];
  // A design scores as its kind (an animated design names one, lib/templates/motion); a preferred design id gets the bonus
  // itself, a preferred kind gives it to every design of that kind. Animated designs lead their kind.
  const bonus = {};
  if (prefer) for (const raw of [].concat(prefer)) {
    if (TEMPLATES.some((t) => t.id === raw && t.animated)) bonus[raw] = (bonus[raw] || 0) + 5;
    else {
      const id = TEMPLATES.some((t) => t.kind === raw) ? raw : ALIAS[raw];
      if (scores[id] != null) scores[id] += 5;
    }
  }
  let ranked = TEMPLATES.map((t) => ({ id: t.id, name: t.name, score: scores[t.kind] + (bonus[t.id] || 0) + (t.animated ? 1 : 0), why: t.why || WHY[t.kind], bestFor: t.bestFor, ...(t.animated ? { animated: true } : {}) }));
  if (only) ranked = ranked.filter((r) => [].concat(only).includes(r.id));
  ranked.sort((a, b) => b.score - a.score || TEMPLATES.findIndex((t) => t.id === a.id) - TEMPLATES.findIndex((t) => t.id === b.id));
  return ranked;
}

module.exports = { rankTemplates, WHY };
