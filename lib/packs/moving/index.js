// Moving help: a labor-only household pack on the shared household spine (packs/_kit/home). Everything
// niche-specific lives in data/niche.json (crowd card, partners, offers by month, texts, checklist,
// objections, specials) and data/prices.json, from research/niches/moving.json with sources.
// On top of the spine: the signature workflow "Crew and hours estimate" (tools/crew-plan.js), crew size
// and hours from HireAHelper's estimating chart in data/crew.json, priced at the member's rate per
// mover, with a printable move-day plan; offered as a next step after a quote, a reply, the offer and
// a booking. lib/street.js keeps the size line off the neighbor door hangers for the small job, and
// lib/ready.js gives the Google profile kit a general, mobile profile instead of a handyman's.

const pack = require('../_kit/home').pack(__dirname);
const config = require('../_kit/home/config');
const { crewPlanTool } = require('./tools/crew-plan');
const { streetTool } = require('./lib/street');
const { movingProfile } = require('./lib/ready');

const cfg = config.load(__dirname);
const N = cfg.niche;
const plan = crewPlanTool(cfg);
const street = streetTool(cfg);
pack.tools = pack.tools.map((t) => (t.name === street.name ? street : t.name === 'moving.ready_kit' ? movingProfile(t) : t));
pack.tools.push(plan);

const wf = (id) => pack.workflows.find((w) => w.id === id);

// Job math on the offer: the package hours are a 2-mover crew's, so "per hour" is the crew's pay.
const PAY = { title: "What your 2-mover crew costs per hour (optional)", description: 'Both movers together, like 50 for 2 movers at $25 each' };
Object.assign(wf('moving.offer').inputs.properties.hourly, PAY);
const menuTool = pack.tools.find((t) => t.name === 'moving.price_menu');
Object.assign(menuTool.input.properties.hourly, PAY);
const menuView = menuTool.view;
menuTool.view = (out) =>
  menuView(out).map((b) => (b && b.type === 'table' ? { ...b, columns: b.columns.map((c) => (c.key === 'left' ? { ...c, label: 'Left after supplies and crew pay' } : c)) } : b));

const contact = wf('moving.won').inputs.properties;
const P = plan.input.properties;

const crewEstimate = {
  id: 'moving.crew_estimate',
  title: 'Crew and hours estimate',
  promise: N.promises.crew_estimate,
  minutes: 5,
  tier: 'builder',
  job: 'sales',
  inputs: {
    type: 'object',
    required: ['home'],
    properties: {
      customer: { type: 'string', maxLength: 80, title: 'Customer (optional)', description: 'Pick from your Pipeline or type their name. With a name, you also get a quote to send.', options: 'pipeline' },
      customerContact: { type: 'string', maxLength: 160, title: 'Their email or phone (optional)' },
      home: { ...P.home, title: 'Home size' },
      job: { ...P.job, title: 'The job' },
      stairsFrom: { ...P.stairsFrom, title: 'Flights of stairs at the pickup (optional)', description: 'Count an elevator as one flight' },
      stairsTo: { ...P.stairsTo, title: 'Flights of stairs at the drop-off (optional)', description: 'Count an elevator as one flight' },
      carryFrom: { ...P.carryFrom, title: 'Feet from the truck to the door, pickup (optional)', description: 'Past 150 feet adds time' },
      carryTo: { ...P.carryTo, title: 'Feet from the truck to the door, drop-off (optional)' },
      items: { ...P.items, title: 'Heavy or special items (optional)', description: 'Like "upright piano, gun safe, fridge, propane tank". Pianos, safes and pool tables add time and a fee; we flag what movers can\'t carry.' },
      crew: { ...P.crew, title: 'Crew (optional)', description: "Pick for me uses the chart's crew for the home size" },
      rate: { ...P.rate, title: 'Your rate per mover per hour (optional)', description: 'Your price menu rate when you leave it empty' },
      date: { ...P.date, title: 'Moving day (optional)', description: 'Like "Saturday, Nov 7"' },
      start: { ...P.start, title: 'Start time (optional)', description: 'Like "8am"' },
      from: { ...P.from, title: 'Pickup address (optional)', description: 'Only on the crew text and the plan' },
      to: { ...P.to, title: 'Drop-off address (optional)' },
      truck: { ...P.truck, title: 'Their truck or container (optional)', description: 'Like "15 ft rental truck". The customer rents and drives it.' },
      notes: { ...P.notes, title: 'Notes for the crew (optional)', description: 'Parking, elevator booking, pets' },
      deposit: { type: 'string', maxLength: 20, title: 'Deposit to book (optional)', description: '"25%" or "$50"' },
      payLink: { type: 'string', maxLength: 300, title: 'Your payment link (optional)', description: 'Stripe, Square or PayPal.Me. Buyers pay you directly.' },
      business: contact.business,
      phone: contact.phone,
      link: contact.link,
      color: contact.color,
    },
  },
  steps: [
    { id: 'crew', tool: plan.name, input: Object.fromEntries(Object.keys(P).map((k) => [k, `$inputs.${k}`])) },
    // A quote to send only when there is someone to send it to.
    { id: 'quote', tool: 'sales.quote', when: '$inputs.customer', input: { items: '$crew.items', customer: { name: '$inputs.customer', contact: '$inputs.customerContact' }, title: '$crew.title', notes: '$crew.notes', deposit: '$inputs.deposit', payLink: '$inputs.payLink' } },
  ],
  result: ['crew', 'quote'],
  next: [
    { id: 'moving.won', why: 'They booked: the booking text, the prep text, the job sheet and the invoice.' },
    { id: 'moving.reply', why: 'They wrote back with a question: answer with one next step.' },
  ],
};

// After "Quote a job", where a member prices a move: estimate it, then book it.
const at = pack.workflows.findIndex((w) => w.id === 'moving.quote');
pack.workflows.splice(at + 1, 0, crewEstimate);

// The signature as a next step where it fits.
const offer = (id, why, first = true) => {
  const w = wf(id);
  const step = { id: crewEstimate.id, why };
  w.next = first ? [step, ...(w.next || [])] : [...(w.next || []), step];
};
offer('moving.quote', 'A bigger home, stairs or a piano: the crew, the hours and a move-day plan.');
offer('moving.reply', 'They asked how long it takes or how many movers: estimate it.', false);
offer('moving.offer', 'Price one move by the hour with your new rate.', false);
offer('moving.won', 'Before the day: the crew, the hours and a printable move-day plan.');

module.exports = pack;
