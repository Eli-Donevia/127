// The first run (HQ_FIRST_RUN): a new member's first session, payoff first and setup after. Ava, an
// AI employee, says hello in a short chat, learns the business (Brain auto-fill when it's on, three
// questions when it isn't), offers the first two connections, and hands the member their first win:
//   - signed up through the free site builder (their site result came into HQ, or they unlocked
//     /site-tonight first): their site, then First 25 as the next card;
//   - anyone else: First 25, filled from the Brain, then the site builder as the next card.
// Day one (setup) shows on Today only once this is done or hidden. Every step is ticked off from
// what's really there, never from a tap alone.
// Legal L83: Ava says she's AI, the card says "AI employee", and nothing here sends or posts.

const deps = { db: require('../db') };
const flags = require('./flags');
const brain = require('./brain');
const wins = require('./wins');

const HOST = { first: 'Ava', title: 'AI sales lead' };
const F25 = 'leads.first_25';

function on(user) {
  return !!user && flags.on('HQ_FIRST_RUN', user);
}

// Came in through the site builder: the door import marks it (routes.js), or First 25's lead says so.
function siteFirst(user) {
  return wins.offerSeen(user.id, 'source-site') || user.leadSource === 'site-tonight';
}

function done(user) {
  return wins.offerSeen(user.id, 'firstrun-done') || wins.offerSeen(user.id, 'firstrun-hide');
}

// New enough to be sent here once from Today: never ran anything and hasn't seen this page.
function fresh(user) {
  return on(user) && !done(user) && !wins.offerSeen(user.id, 'firstrun-seen') && !deps.db.find('runs', (r) => r.memberId === user.id && !r.sample);
}

function hasF25(user) {
  return !!deps.db.find('runs', (r) => r.memberId === user.id && r.workflowId === F25 && !r.sample);
}

// Their site result is in HQ (marked when the door import brings it in).
function siteIn(user) {
  return wins.offerSeen(user.id, 'source-site');
}

// The steps, from what's really there: [{ id, done }], and the one to show now.
function state(user) {
  const b = brain.snapshot(user);
  const c = require('../hq').connections(user, '');
  const ai = require('../hq-harness').on();
  const site = siteFirst(user);
  const steps = [
    { id: 'business', done: !!(b.business.what || b.business.offer) },
    { id: 'tools', done: (!!c.link && (!ai || !!c.ai)) || wins.offerSeen(user.id, 'firstrun-tools-later') },
    { id: 'win', done: site ? siteIn(user) || hasF25(user) : hasF25(user) },
  ];
  const now = steps.find((s) => !s.done);
  // First 25's form, filled from the Brain (the member checks it before it runs).
  const q = new URLSearchParams();
  if (b.business.what || b.business.offer) q.set('in_service', String(b.business.what || b.business.offer).slice(0, 120));
  if (b.business.city) q.set('in_city', [b.business.city, b.business.region].filter(Boolean).join(', '));
  return {
    host: HOST,
    site,
    steps,
    now: now ? now.id : 'finished',
    ai,
    link: !!c.link,
    claude: !!c.ai,
    autofill: flags.on('BRAIN_AUTOFILL', user),
    business: b.business,
    first25: `/app/hq/w/${F25}${q.toString() ? `?${q}` : ''}`,
  };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { on, fresh, done, siteFirst, state, HOST, F25, _setDeps };
