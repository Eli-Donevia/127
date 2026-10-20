// Junk removal: a household pack on the shared household spine (packs/_kit/home). Everything
// niche-specific lives in data/niche.json (crowd card, partners, offers by month, texts, checklist,
// objections, specials) and data/prices.json, from research/niches/junk.json with sources.
// On top of the spine: the signature workflow "Load estimate" (tools/load-estimate.js). A typed or
// pasted list of items is priced from the volume table in data/items.json, with the special disposal
// lines in data/disposal.json and the dump fee from the rate the member types, then goes to a quote
// and an invoice. It is offered as a next step after a reply, a quote, the offer, a free sample and
// a same-street day.

const pack = require('../_kit/home').pack(__dirname);
const config = require('../_kit/home/config');
const { loadEstimateTool } = require('./tools/load-estimate');

const cfg = config.load(__dirname);
const N = cfg.niche;
const est = loadEstimateTool(cfg);
pack.tools.push(est);

const wf = (id) => pack.workflows.find((w) => w.id === id);
const contact = wf('junk.won').inputs.properties;
const quoteIn = wf('junk.quote').inputs.properties;
const E = est.input.properties;
const passed = Object.keys(E);
const optional = (s, title, description) => ({ ...s, title, ...(description ? { description } : {}) });

const loadEstimate = {
  id: 'junk.load_estimate',
  title: 'Load estimate',
  promise: N.promises.load_estimate,
  minutes: 5,
  tier: 'builder',
  job: 'sales',
  inputs: {
    type: 'object',
    required: ['customer', 'items'],
    properties: {
      customer: optional(E.customer, 'Customer name'),
      customerContact: quoteIn.customerContact,
      items: optional(E.items, 'What goes', 'One item per line, as they sent it: "sofa", "2 recliners", "10 bags of trash", "1 cubic yard of drywall"'),
      access: optional(E.access, 'Where the items are'),
      material: optional(E.material, 'What it is', 'Left on "Work it out from the list", the load is priced as heavy debris when debris, dirt, concrete or shingles fill half of it or more'),
      city: optional(E.city, 'City and state (optional)', 'For the disposal rules where you work, like "Everett, WA"'),
      dump_rate: optional(E.dump_rate, 'Dump fee per ton (optional)', "Your transfer station's rate, like 160. Kept for next time"),
      dump_min: optional(E.dump_min, 'Dump minimum per trip (optional)', 'Like 30'),
      appliance_fee: optional(E.appliance_fee, 'Dump fee per fridge, freezer or AC unit (optional)'),
      tire_fee: optional(E.tire_fee, 'Dump fee per tire (optional)'),
      truck: optional(E.truck, 'Your truck or trailer, cubic yards (optional)', 'Empty: a 400 cubic foot junk truck. A pickup bed holds about 3.5'),
      payload: optional(E.payload, 'Your payload, pounds (optional)', 'From the door sticker or the trailer plate'),
      deposit: quoteIn.deposit,
      payLink: quoteIn.payLink,
      business: contact.business,
      phone: contact.phone,
      link: contact.link,
      color: contact.color,
    },
  },
  steps: [
    { id: 'estimate', tool: est.name, input: Object.fromEntries(passed.map((k) => [k, `$inputs.${k}`])) },
    { id: 'quote', tool: 'sales.quote', input: { items: '$estimate.items', customer: { name: '$inputs.customer', contact: '$inputs.customerContact' }, title: '$estimate.title', notes: '$estimate.notes', deposit: '$inputs.deposit', payLink: '$inputs.payLink' } },
    { id: 'won', approve: { title: 'Did they say yes?', note: 'Pick yes when they book, and the invoice is made from this quote.', choose: '$estimate.next', label: 'label', max: 1 } },
    { id: 'invoice', tool: 'sales.invoice', when: '$won.chosen.0.invoice', input: { quote: '$quote', payLink: '$inputs.payLink' } },
  ],
  result: ['estimate', 'quote', 'invoice'],
  next: [
    { id: 'junk.won', why: 'They booked: the booking text, prep text and job sheet.' },
    { id: 'junk.same_street', why: 'On their street that day: a note for the neighbors.' },
    { id: 'junk.keep', why: 'After the job: thank-you, an honest review ask and a check-in later.' },
  ],
};

// After "Quote a job": the same desk, priced from a list instead of by eye.
const at = pack.workflows.findIndex((w) => w.id === 'junk.quote');
pack.workflows.splice(at + 1, 0, loadEstimate);

// The signature as a next step where it fits.
const offer = (id, why, first = true) => {
  const w = wf(id);
  const step = { id: loadEstimate.id, why };
  w.next = first ? [step, ...(w.next || [])] : [...(w.next || []), step];
};
offer('junk.reply', 'They sent a list of what goes: price it item by item.');
offer('junk.quote', 'They sent a list instead: price it from the list, with the dump fee.');
offer('junk.offer', 'Price a list of items at these prices.', false);
offer('junk.sample_one', 'After the free small load: price the rest from their list.', false);
offer('junk.same_street', 'A neighbor sends a list of what goes: price it item by item.', false);

module.exports = pack;
