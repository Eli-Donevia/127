// Pasted competitor websites -> a clean list (one per line or comma; "Name - site.com" works).
const { views } = require('../../_kit');
const { parseSites } = require('../lib/compete');

module.exports = {
  name: 'intel.read_sites',
  title: 'Read your list',
  description: 'Turns pasted competitor websites (one per line) into a clean list of up to 5.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { sites: { type: 'string', title: 'Competitor websites', description: 'One per line, up to 5' }, max: { type: 'integer', minimum: 1, maximum: 10, default: 5 } }, required: ['sites'] },
  output: { type: 'object', properties: { sites: { type: 'array' } }, required: ['sites'] },
  async run(input) {
    const sites = parseSites(input.sites, input.max);
    if (!sites.length) throw new Error('Paste at least one website, like "rivalgym.com".');
    return { sites };
  },
  view(out) {
    return [views.text(`Checking ${out.sites.length} competitor ${out.sites.length === 1 ? 'site' : 'sites'}.`)];
  },
};
