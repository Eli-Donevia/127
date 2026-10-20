// Handyman: a household pack on the shared household spine (packs/_kit/home). Everything
// niche-specific lives in data/niche.json (crowd card, partners, offers by month, texts, checklist,
// objections, specials) and data/prices.json, from research/niches/handyman.json with sources.
// On top of the spine: the signature workflow "Punch list quote" (tools/punch-list.js). A typed or
// pasted list of small jobs is matched to the sourced times and prices in data/punch.json, put in
// the order that saves time, priced at the member's hourly rate, with the jobs that go to a licensed
// trade and the state's rule linked, then goes to a quote and an invoice. It is offered as a next
// step after a reply, a quote, the offer, a free sample and a same-street day.

const pack = require('../_kit/home').pack(__dirname);
const config = require('../_kit/home/config');
const { punchListTool } = require('./tools/punch-list');

const cfg = config.load(__dirname);
const N = cfg.niche;
const tool = punchListTool(cfg);
pack.tools.push(tool);

const wf = (id) => pack.workflows.find((w) => w.id === id);
const contact = wf('handyman.won').inputs.properties;
const quoteIn = wf('handyman.quote').inputs.properties;
const I = tool.input.properties;
const passed = Object.keys(I);
const optional = (s, title, description) => ({ ...s, title, ...(description ? { description } : {}) });

const punchList = {
  id: 'handyman.punch_list',
  title: 'Punch list quote',
  promise: N.promises.punch_list,
  minutes: 5,
  tier: 'builder',
  job: 'sales',
  inputs: {
    type: 'object',
    required: ['customer', 'items'],
    properties: {
      customer: optional(I.customer, 'Customer name'),
      customerContact: quoteIn.customerContact,
      items: optional(I.items, 'The list of jobs', 'One job per line, as they sent it: "fix sticky bedroom door", "mount 2 TVs", "patch 3 holes in the hallway", "replace kitchen faucet"'),
      built: optional(I.built, 'Year the home was built (optional)', 'Like 1962. Paint and window work in a home built before 1978 is checked against EPA\'s lead-safe rule'),
      rate: optional(I.rate, 'Your hourly rate (optional)', 'Like 75. Kept for next time. Empty: your price menu\'s hourly rate'),
      city: optional(I.city, 'City and state (optional)', 'For your state\'s licensing rule, like "Mesa, AZ"'),
      deposit: quoteIn.deposit,
      payLink: quoteIn.payLink,
      business: contact.business,
      phone: contact.phone,
      link: contact.link,
      color: contact.color,
    },
  },
  steps: [
    { id: 'estimate', tool: tool.name, input: Object.fromEntries(passed.map((k) => [k, `$inputs.${k}`])) },
    { id: 'quote', tool: 'sales.quote', input: { items: '$estimate.items', customer: { name: '$inputs.customer', contact: '$inputs.customerContact' }, title: '$estimate.title', notes: '$estimate.notes', deposit: '$inputs.deposit', payLink: '$inputs.payLink' } },
    { id: 'won', approve: { title: 'Did they say yes?', note: 'Pick yes when they book, and the invoice is made from this quote.', choose: '$estimate.next', label: 'label', max: 1 } },
    { id: 'invoice', tool: 'sales.invoice', when: '$won.chosen.0.invoice', input: { quote: '$quote', payLink: '$inputs.payLink' } },
  ],
  result: ['estimate', 'quote', 'invoice'],
  next: [
    { id: 'handyman.won', why: 'They booked: the booking text, prep text and job sheet.' },
    { id: 'handyman.same_street', why: 'On their street that day: a note for the neighbors.' },
    { id: 'handyman.keep', why: 'After the job: thank-you, an honest review ask and a check-in later.' },
  ],
};

// After "Quote a job": the same desk, priced from a list of jobs instead of one.
const at = pack.workflows.findIndex((w) => w.id === 'handyman.quote');
pack.workflows.splice(at + 1, 0, punchList);

// The signature as a next step where it fits.
const offerNext = (id, why, first = true) => {
  const w = wf(id);
  const step = { id: punchList.id, why };
  w.next = first ? [step, ...(w.next || [])] : [...(w.next || []), step];
};
offerNext('handyman.reply', 'They sent a list of jobs: price it with hours and the order.');
offerNext('handyman.quote', 'They sent a list instead: price it from the list.');
offerNext('handyman.offer', 'Try your rate on a real list of jobs.', false);
offerNext('handyman.sample_one', 'After the free fix: price the rest of their list.', false);
offerNext('handyman.same_street', 'A neighbor sends their list: price it with hours and the order.', false);

module.exports = pack;
