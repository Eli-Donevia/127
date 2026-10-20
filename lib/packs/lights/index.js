// Holiday lights: a household pack on the shared household spine (packs/_kit/home). Everything
// niche-specific lives in data/niche.json (crowd card, partners, offers, texts, checklist, objections,
// specials) and data/prices.json. One workflow of its own: Roofline plan (tools/roofline-plan.js),
// offered as a next step where a price per foot fits.

const home = require('../_kit/home');
const config = require('../_kit/home/config');
const { rooflineTool } = require('./tools/roofline-plan');

const base = home.pack(__dirname);
const cfg = config.load(__dirname);
const N = cfg.niche;
const roofline = rooflineTool(cfg);
const P = roofline.input.properties;
const W = (name) => `${cfg.id}.${name}`;
const pass = (keys) => Object.fromEntries(keys.map((k) => [k, `$inputs.${k}`]));

const plan = {
  id: W('roofline_plan'),
  title: 'Roofline plan',
  promise: N.promises.roofline_plan,
  minutes: 10,
  tier: 'builder',
  job: 'sales',
  inputs: {
    type: 'object',
    required: ['customer', 'runs'],
    properties: {
      customer: { type: 'string', maxLength: 80, title: 'Customer', description: 'Pick from your Pipeline or type their name', options: 'pipeline' },
      contact: { type: 'string', maxLength: 160, title: 'Their email or phone (optional)' },
      address: { type: 'string', maxLength: 200, title: 'Address (optional)', description: 'Printed on the design sheet and in the calendar file' },
      runs: P.runs,
      model: P.model,
      bulbs: P.bulbs,
      spacing: P.spacing,
      breaker: P.breaker,
      circuits: { type: 'integer', minimum: 1, maximum: 20, title: P.circuits.title, description: P.circuits.description },
      watts: { type: 'number', minimum: 0.1, maximum: 25, title: P.watts.title, description: P.watts.description },
      install: P.install,
      takedown: P.takedown,
      deposit: { type: 'string', maxLength: 20, title: 'Deposit to book (optional)', description: '"25%" or "$50"' },
      payLink: { type: 'string', maxLength: 300, title: 'Your payment link (optional)', description: 'Stripe, Square or PayPal.Me. Buyers pay you directly.' },
      city: { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' },
      business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
      phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)', description: 'Printed on the design sheet' },
      link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
      color: { type: 'string', maxLength: 7, title: 'Brand color hex (optional)', description: 'Like #1F7A5C. We pick one if you leave it empty.' },
    },
  },
  steps: [
    { id: 'plan', tool: roofline.name, input: pass(['runs', 'model', 'bulbs', 'watts', 'spacing', 'breaker', 'circuits', 'install', 'takedown', 'customer', 'address', 'city', 'business', 'phone', 'link', 'color']) },
    { id: 'quote', tool: 'sales.quote', input: { items: '$plan.items', customer: { name: '$inputs.customer', contact: '$inputs.contact', address: '$inputs.address' }, title: '$plan.title', notes: '$plan.notes', deposit: '$inputs.deposit', payLink: '$inputs.payLink', color: '$inputs.color' } },
  ],
  result: ['plan', 'quote'],
  next: [
    { id: W('won'), why: 'They said yes: the booking text, prep text, job sheet and invoice.' },
    { id: W('season_plan'), why: 'Plan the year: installs in the fall, takedowns in January.' },
  ],
};

// Where a price per foot fits, Roofline plan is offered as a next step.
const offerIt = {
  offer: 'Measure one home and price it by the foot, with the clips, cords and circuits it needs.',
  sample_one: 'Make the free lighting plan: their roofline measured, drawn and priced.',
  reply: 'They asked how much: measure the roofline and price it by the foot.',
  quote: 'Price it by the measured foot instead, with a design sheet they can see.',
};

const workflows = [];
for (const w of base.workflows) {
  const why = offerIt[w.id.slice(cfg.id.length + 1)];
  workflows.push(why ? { ...w, next: [...(w.next || []), { id: plan.id, why }] } : w);
  if (w.id === W('quote')) workflows.push(plan);
}

module.exports = { ...base, tools: [...base.tools, roofline], workflows };
