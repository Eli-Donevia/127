// local.citations: where to list the business for free, in order, with one consistency sheet (the
// exact name, phone, web address and descriptions to paste everywhere) and a tracker spreadsheet.

const { text, files, save, views } = require('../../_kit');
const F = require('../lib/facts');
const { BIZ, ASSET } = require('../lib/common');
const L = require('../data/listings.json');

function descriptions(f) {
  const where = f.area || f.city || '';
  const what = f.what || f.group.label;
  const short = text.clip(`${what}${where ? ` in ${where}` : ''}${f.mobile ? '. We come to you.' : '.'}`, 160);
  const svc = (f.services || []).map((s) => s.name).filter(Boolean).slice(0, 5);
  const long = text.clip(`${f.name} offers ${String(what).toLowerCase()}${where ? ` in ${where}` : ''}.${svc.length ? ` Services include ${svc.join(', ').toLowerCase()}.` : ''}${f.mobile ? ' We come to you.' : ''} ${f.booking || f.website ? 'Book online or call to set a time.' : 'Call or text to set a time.'}`, 600);
  return { short, long };
}

module.exports = {
  name: 'local.citations',
  title: 'Plan your free listings',
  description: 'Lists where to put your business for free (Google, Apple, Bing, Facebook, Nextdoor, Yelp and more) in order, with one sheet of the exact name, phone, link and descriptions to paste everywhere, and a tracker spreadsheet.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: { type: 'object', properties: { ...BIZ, area: { type: 'string', title: 'Area you serve (optional)', maxLength: 80 } } },
  output: {
    type: 'object',
    required: ['nap', 'sites', 'files'],
    properties: {
      nap: { type: 'object' },
      descriptions: { type: 'object' },
      sites: { type: 'array', items: { type: 'object' } },
      files: { type: 'object', properties: { tracker: ASSET } },
      sample: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, input);
    const nap = {
      name: f.name,
      phone: f.phone ? f.phone.display : 'Add your phone',
      website: f.website || f.booking || 'No website yet: leave it empty everywhere',
      address: f.mobile ? `Service area business: hide your home address, list ${f.area || f.city || 'your towns'} as the area` : 'Your street address, written the same way everywhere',
      category: f.category,
    };
    const d = descriptions(f);
    const online = !f.mobile && /online|ecommerce|etsy|shopify/i.test(f.blob);
    const sites = L.sites
      .filter((s) => !(online && s.id === 'google'))
      .map((s, i) => ({ order: i + 1, id: s.id, name: s.name, url: s.url, cost: s.cost, why: s.why, tip: s.tip, minutes: s.minutes || 15, status: 'To do' }));
    const csv = files.csv(sites, [
      { key: 'order', label: 'Order' },
      { key: 'name', label: 'Site' },
      { key: 'url', label: 'Sign up at' },
      { key: 'cost', label: 'Cost' },
      { key: 'minutes', label: 'Minutes' },
      { key: 'tip', label: 'Tip' },
      { key: 'status', label: 'Status' },
    ]);
    const tracker = await save.saveFile(ctx, save.fileName(f.name, 'listings', '.csv'), csv, 'text/csv');
    return { nap, descriptions: d, sites, files: { tracker }, sample: !f.hasName };
  },
  view(out) {
    return views.blocks(
      views.text('Use exactly these details on every site. Matching details help Google trust your business.'),
      views.copy('Name', out.nap.name),
      views.copy('Phone', out.nap.phone),
      views.copy('Website', out.nap.website),
      views.text(out.nap.address),
      views.copy('Short description', out.descriptions.short),
      views.copy('Long description', out.descriptions.long),
      views.table([{ key: 'order', label: '#', format: 'number' }, { key: 'name', label: 'Site' }, { key: 'cost', label: 'Cost' }, { key: 'url', label: 'Sign up', format: 'link' }, { key: 'tip', label: 'Tip' }], out.sites),
      views.file(out.files && out.files.tracker, 'Listings tracker (CSV)')
    );
  },
};
