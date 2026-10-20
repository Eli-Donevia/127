// Fills one ready-made app with the member's business name, services, prices, contact lines and
// color, checks it and saves it. No AI: the same input always makes the same app.

const { text } = require('../../_kit');
const S = require('../lib/starters');
const { factsOf } = require('../lib/facts');
const { starterOptions } = require('../lib/options');
const { deliver, appView, FACT_FIELDS, APP_OUTPUT } = require('../lib/deliver');

// The starter can come as an id or as the item picked in an approval ([{ id }] or { id }).
function starterId(v) {
  const x = Array.isArray(v) ? v[0] : v;
  const id = x && typeof x === 'object' ? x.id : x;
  return S.byId(String(id || '')) ? String(id) : 'job-price';
}

module.exports = {
  name: 'tools.fill_starter',
  title: 'Fill a ready-made app',
  description: 'Fills a ready-made app with your business name, services, prices, contact details and color, runs the safety check, and saves it as one HTML file that works offline (zipped, ready for Netlify Drop) plus a preview.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      starter: { title: 'Which app', description: 'An app id like "quote", or the app picked in the gallery' },
      ...FACT_FIELDS,
      title: { type: 'string', title: 'App title (optional)', maxLength: 60 },
      questions: { type: 'string', title: 'Questions, items or names (optional)', format: 'textarea', maxLength: 6000 },
      tax: { type: 'number', title: 'Sales tax % (optional)', minimum: 0, maximum: 30 },
      deposit: { type: 'number', title: 'Deposit % (optional)', minimum: 0, maximum: 100 },
      hours: { type: 'string', title: 'Hours (optional)', maxLength: 120 },
      staff: { type: 'string', title: 'Team names (optional)', maxLength: 1000 },
      client: { type: 'string', title: 'Client name (optional)', maxLength: 60 },
      steps: { type: 'string', title: 'Project steps (optional)', maxLength: 1000 },
      stage: { type: 'integer', title: 'Step they are on now (optional)', minimum: 0, maximum: 10 },
      next: { type: 'string', title: 'Next visit (optional)', maxLength: 80 },
      todos: { type: 'string', title: 'Their to-dos (optional)', maxLength: 1500 },
      links: { type: 'string', title: 'Links (optional)', maxLength: 2000 },
    },
    required: ['starter'],
  },
  output: APP_OUTPUT,
  async run(input, ctx) {
    const id = starterId(input.starter);
    const facts = factsOf(ctx, input);
    const opts = starterOptions(id, { ...input, payLink: facts.booking && /pay|invoice|checkout|stripe|square/i.test(facts.booking) ? facts.booking : '' });
    const r = S.render(id, facts, opts);
    const notes = [r.note];
    if (id === 'form' && opts.fields) notes.push(`${opts.fields.length} questions: ${text.clip(opts.fields.map((x) => x.label).join(', '), 200)}.`);
    if (!facts.hasName) notes.push('Add your business name next time so it shows at the top of the app.');
    const sample = facts.sampleItems && ['job-price', 'quote', 'booking', 'lookup'].includes(id);
    return deliver(ctx, r.html, { business: facts.business, title: r.title, starter: id, notes, sample });
  },
  view: (out) => appView(out),
};
