// Pool cleaning: a household pack on the shared household spine (packs/_kit/home). Everything
// niche-specific lives in data/niche.json (crowd card, partners, offers by month, texts, checklist,
// objections, specials) and data/prices.json, from research/niches/pool.json with sources.
// On top of the spine: the signature workflow "Visit log card" (tools/visit-log.js), the readings
// after each visit checked against CDC's ranges in data/chemistry.json, offered as a next step after
// a booking, a free sample and the keep messages; and lib/ready.js, so the Google profile kit treats
// pool cleaning as a business that works at the customer's home and the website never reads as
// house cleaning.

const pack = require('../_kit/home').pack(__dirname);
const config = require('../_kit/home/config');
const { visitLogTool } = require('./tools/visit-log');
const { serviceArea } = require('./lib/ready');

const cfg = config.load(__dirname);
const N = cfg.niche;
const log = visitLogTool(cfg);
pack.tools = pack.tools.map((t) => (t.name === 'pool.ready_kit' ? serviceArea(t) : t));
pack.tools.push(log);

const wf = (id) => pack.workflows.find((w) => w.id === id);
const contact = wf('pool.won').inputs.properties;
const L = log.input.properties;
const passed = Object.keys(L);

const visitLog = {
  id: 'pool.visit_log',
  title: 'Visit log card',
  promise: N.promises.visit_log,
  minutes: 3,
  tier: 'builder',
  job: 'ops',
  inputs: {
    type: 'object',
    required: ['customer'],
    properties: {
      customer: { type: 'string', maxLength: 120, title: 'Whose pool', description: 'Pick from your Pipeline or type their name', options: 'pipeline' },
      kind: L.kind,
      fc: { ...L.fc, title: 'Free chlorine, ppm (optional)', description: 'From your test kit, like 2.5' },
      ph: { ...L.ph, title: 'pH (optional)', description: 'Like 7.4' },
      cya: { ...L.cya, title: 'Stabilizer (cyanuric acid), ppm (optional)', description: 'If you tested it' },
      stabilizer: { ...L.stabilizer, title: 'Does this pool use stabilizer? (optional)', description: 'Yes if it uses cyanuric acid or chlorine products with it: the product label says so' },
      test: { ...L.test, title: 'Test you used (optional)' },
      alk: { ...L.alk, title: 'Total alkalinity, ppm (optional)' },
      hardness: { ...L.hardness, title: 'Calcium hardness, ppm (optional)' },
      salt: { ...L.salt, title: 'Salt, ppm (optional)' },
      temp: { ...L.temp, title: 'Water temperature, F (optional)' },
      other: { ...L.other, title: 'Other readings (optional)', description: 'Logged as you type them' },
      done: { ...L.done, title: 'What you did (optional)', description: 'Comma separated. Left empty: skimmed, brushed walls and steps, emptied the baskets' },
      added: { ...L.added, title: 'What you added (optional)', description: 'Product and amount, as the label directed. Left empty when a reading is off, the text asks you to fill it in.' },
      notes: { ...L.notes, title: 'Notes for the owner (optional)', description: 'Leaves, a noisy pump, anything they should know' },
      next: { ...L.next, title: 'Next visit (optional)', description: 'Like "Tuesday"' },
      date: { type: 'string', format: 'date', title: 'Visit date (optional)', description: 'Today when left empty' },
      business: contact.business,
      phone: contact.phone,
      link: contact.link,
      color: contact.color,
    },
  },
  steps: [{ id: 'log', tool: log.name, input: Object.fromEntries(passed.map((k) => [k, `$inputs.${k}`])) }],
  result: ['log'],
  next: [
    { id: 'pool.keep', why: 'After the first few visits: a thank-you, an honest review ask and the regular plan.' },
    { id: 'pool.proof', why: 'A green pool brought back: turn the before and after into proof.' },
    { id: 'pool.quote', why: 'The log shows extra work, like a filter cleaning: quote it before you do it.' },
  ],
};

// After "A customer said yes", in the order a member works: book, visit, keep.
const at = pack.workflows.findIndex((w) => w.id === 'pool.won');
pack.workflows.splice(at + 1, 0, visitLog);

// The signature as a next step where it fits: after a booking, after a free water test, and in the keep messages.
const offer = (id, why, first = true) => {
  const w = wf(id);
  const step = { id: visitLog.id, why };
  w.next = first ? [step, ...(w.next || [])] : [...(w.next || []), step];
};
offer('pool.won', 'After each visit: log the readings and text the owner what you did.');
offer('pool.sample_one', 'After a free water test: log the readings and text them to the owner.', false);
offer('pool.keep', 'Every visit after this: the readings and what you did, in writing.', false);

module.exports = pack;
