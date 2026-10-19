// local.first_25: the First 25 for a local launch. Up to 15 people the member knows, each with a
// personal text, plus up to 10 nearby businesses that serve the same customers (OpenStreetMap through
// the kit, sample businesses when it can't answer), each with a message and a walk-in line.
// The personal texts ask for business, never trade a price for a review (Google bans review incentives).

const kit = require('../../_kit');
const { text, first25, save, views, time, places, files } = kit;
const F = require('../lib/facts');
const { BIZ, ASSET } = require('../lib/common');

const PEOPLE = [
  'Hey {greet}! Random question: I just started {what} around {area}. {price}Would you want a spot this week, or know someone who might?',
  'Hi {greet}, hope you are doing well! I am starting {what} here in {area} and looking for my first few customers. {price}Any chance you would want one?',
  'Hey {greet}! I am launching {what} in {area}. {price}Would you like to be one of my first customers, or know someone who would?',
];

module.exports = {
  name: 'local.first_25',
  title: 'List your First 25',
  description: 'Builds your First 25: a personal text for each person you know and a message and walk-in line for nearby businesses that serve the same customers, with a 3-day plan and one spreadsheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  // 127's own OpenStreetMap servers for the nearby businesses (D27); without them live runs show samples.
  wants: ['osm'],
  credits: 2,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      ...BIZ,
      people: { type: 'string', title: 'People you know, one per line (optional)', maxLength: 4000, description: 'Like "Dana, neighbor" or "Chris Wong, 512 555 0199". Up to 15.' },
      area: { type: 'string', title: 'Your neighborhood (optional)', maxLength: 80 },
      price: { type: 'string', title: 'Your first-customer price (optional)', maxLength: 60, description: 'Per job or per visit, like "$120 instead of $160 for my first 5 customers"' },
    },
  },
  output: {
    type: 'object',
    required: ['people', 'partners', 'plan'],
    properties: {
      people: { type: 'array', items: { type: 'object' } },
      partners: { type: 'array', items: { type: 'object' } },
      total: { type: 'integer' },
      plan: { type: 'array', items: { type: 'string' } },
      notes: { type: 'array', items: { type: 'string' } },
      attribution: { type: 'string' },
      files: { type: 'object', properties: { list: ASSET } },
      sample: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, input);
    const types = (f.group.partners || []).slice(0, 4).map((p) => ({ id: p.id, label: p.label, search: { words: (p.phrases || [p.label])[0] }, their_customers: p.their_customers, why: p.why, ask: p.ask, give: p.give }));
    const what = String(f.what || f.group.label).toLowerCase();
    const area = input.area || f.area || f.city || 'town';
    const start = time.today(ctx);
    const r = await first25.household(ctx, { people: input.people, types, city: f.place || f.city, offer: { what, area, me: f.firstName || '' }, start });
    const priceLine = input.price ? `${text.clip(text.plain(input.price), 60)}. ` : '';
    const people = r.people.map((p, i) => ({ ...p, message: text.fill(text.pickBy(`${p.name}${i}`, PEOPLE), { greet: p.greet || p.name, what, area, price: priceLine }) }));
    // The kit's partner rows drop searchBy, so mark them here when the city lookup went through
    // LocationIQ: its free plan needs "Search by LocationIQ.com" wherever its search shows (Legal L57).
    const viaLiq = r.partners.some((b) => b.source === 'osm') && places.isLocationIq(places.osmServer(ctx).nominatim);
    const partners = viaLiq ? r.partners.map((b) => ({ ...b, searchBy: 'locationiq' })) : r.partners;
    const result = { ...r, people, partners };
    // OpenStreetMap's credit is the spreadsheet's last row when any business came from it (D27, ODbL).
    const credit = places.creditLine(partners);
    const csv = first25.toCsv(result, { start }) + (credit ? `${[files.csvCell(credit), '', '', '', '', '', '', ''].join(',')}\r\n` : '');
    const list = await save.saveFile(ctx, save.fileName(f.name, 'first-25', '.csv'), csv, 'text/csv');
    return { people, partners, total: r.total, plan: r.plan, notes: r.notes, attribution: r.attribution || '', files: { list }, sample: !!r.sample };
  },
  view(out) {
    return views.blocks(
      views.metric('Your First 25', out.total, `${out.people.length} people you know, ${out.partners.length} nearby businesses`),
      views.text(out.plan.join(' ')),
      out.people.slice(0, 15).map((p) => views.copy(`Text to ${p.name}`, p.message)),
      views.table([{ key: 'name', label: 'Business' }, { key: 'type', label: 'Type' }, { key: 'address', label: 'Address' }, { key: 'message', label: 'Message' }], out.partners),
      out.notes.map((n) => views.text(n)),
      places.creditBlocks(out.partners).length ? places.creditBlocks(out.partners) : out.attribution ? views.text(`Business data: ${out.attribution}`) : null,
      views.file(out.files && out.files.list, 'Everyone in one spreadsheet (CSV)')
    );
  },
};
