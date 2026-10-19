// Checks whether each name's .com (and a fallback like .co) is registered, using RDAP, the public
// registry lookup that replaced WHOIS (free, no key). We ask each ending's own registry (IANA's
// RDAP list, checked 2026-10-19; .co's registry isn't in that list but answers at rdap.registry.co).
// 404 from the registry means not registered. Endings we have no registry for stay "unknown".
// Registered or not is a fact from the registry; "available to buy" still needs a registrar check,
// since a name can be reserved or premium, so the view says "not registered" rather than "yours".

const { web, views } = require('../../_kit');
const { domainFor } = require('../lib/names');

const REGISTRY = {
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
  org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
  co: 'https://rdap.registry.co/co/domain/',
  app: 'https://pubapi.registry.google/rdap/domain/',
  shop: 'https://rdap.gmoregistry.net/rdap/domain/',
  store: 'https://rdap.radix.host/rdap/domain/',
  studio: 'https://rdap.identitydigital.services/rdap/domain/',
  info: 'https://rdap.identitydigital.services/rdap/domain/',
  xyz: 'https://rdap.centralnic.com/xyz/domain/',
};

async function lookup(ctx, domain) {
  const base = REGISTRY[domain.split('.').pop()];
  if (!base) return null;
  return web.cached(ctx, `rdap:v2:${domain}`, 12, async () => {
    try {
      const r = await web.getText(ctx, `${base}${domain}`, { timeoutMs: 10000, maxBytes: 300000, headers: { Accept: 'application/rdap+json, application/json' } });
      if (r.status === 404) return 'open';
      if (r.ok) return 'taken';
      return null;
    } catch {
      return null;
    }
  });
}

module.exports = {
  name: 'brand.check_names',
  title: 'Check domain names',
  description: 'Looks up each name\'s .com and .co in the public domain registry (RDAP) and says which are not registered yet.',
  kind: 'api',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      names: { type: 'array', title: 'Names', items: { type: 'object' } },
      tlds: { type: 'array', items: { type: 'string' }, default: ['com', 'co'] },
    },
    required: ['names'],
  },
  output: {
    type: 'object',
    properties: { names: { type: 'array' }, open: { type: 'integer' }, checked: { type: 'boolean' } },
    required: ['names'],
  },
  async run(input, ctx) {
    const list = (input.names || []).map((n) => (typeof n === 'string' ? { name: n } : n)).filter((n) => n && n.name).slice(0, 20);
    let reached = 0;
    const rows = await web.mapLimit(
      list,
      4,
      async (n) => {
        const domains = {};
        for (const tld of input.tlds) {
          const d = domainFor(n.name, tld);
          if (!d) continue;
          const status = await lookup(ctx, d);
          if (status) reached++;
          domains[tld] = { domain: d, status: status || 'unknown' };
        }
        const best = Object.values(domains).find((d) => d.status === 'open');
        return { ...n, domains, best: best ? best.domain : null };
      },
      ctx
    );
    const checked = reached > 0;
    const open = rows.filter((r) => r.best).length;
    ctx.log(checked ? `Checked ${rows.length} names: ${open} have an open domain` : "Couldn't reach the domain registry, so domains are unchecked");
    return { names: rows, open, checked, ...(checked ? {} : { sample: true }) };
  },
  view(out) {
    const label = (d) => (!d ? '' : d.status === 'open' ? `${d.domain} not registered` : d.status === 'taken' ? `${d.domain} taken` : `${d.domain} unchecked`);
    return views.blocks(
      views.metric('Names with an open domain', out.checked ? out.open : 'Unchecked', out.checked ? 'Registered or not, from the public registry. Buy it at any registrar.' : 'The registry lookup was offline. Run it again to check.'),
      views.table(
        [
          { key: 'name', label: 'Name' },
          { key: 'com', label: '.com' },
          { key: 'co', label: '.co' },
        ],
        out.names.map((n) => ({ name: n.name, com: label(n.domains.com), co: label(n.domains.co) })),
        12
      )
    );
  },
};

