// Ranks audited stores for pitching: real Shopify stores with fixable gaps first (low score, a real
// catalog, a way to reach them, close by), with the reason each one is on the list.

const { text, views, places } = require('../../_kit');

function opportunity(a, place) {
  let s = 100 - (a.score || 0);
  const n = (a.numbers && a.numbers.products) || 0;
  if (n < 3) s -= 40;
  else if (n >= 10) s += 8;
  if (a.pitch && a.pitch.store && a.pitch.store.emails && a.pitch.store.emails.length) s += 6;
  if (place && place.miles != null) s += Math.max(0, 6 - place.miles);
  return Math.round(s);
}

module.exports = {
  name: 'shop.rank_stores',
  title: 'Rank stores to pitch',
  description: 'Takes store audits and ranks the Shopify stores with the biggest fixable gaps first, with the reason for each. Skips stores that are not on Shopify, closed or empty.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: { audits: { type: 'array' }, places: { type: 'array' }, limit: { type: 'integer', minimum: 1, maximum: 25, default: 25 } },
    required: ['audits'],
  },
  output: { type: 'object', properties: { stores: { type: 'array' }, checked: { type: 'integer' }, skipped: { type: 'object' }, sample: { type: 'boolean' } }, required: ['stores'] },

  async run(input) {
    // Audits come in the same order as the places they were run on; a failed audit keeps its slot.
    const all = input.audits || [];
    const audits = all.filter((a) => a && !a.error);
    const found = input.places || [];
    const skipped = {};
    const stores = [];
    all.forEach((a, i) => {
      if (!a || a.error) return;
      if (!a.ok) {
        skipped[a.status || 'other'] = (skipped[a.status || 'other'] || 0) + 1;
        return;
      }
      const place = found[i] || found.find((p) => a.store && p.url && a.store.domain && p.url.includes(a.store.domain)) || null;
      const top = (a.fixes || []).slice(0, 3);
      stores.push({
        // The place's own key (OpenStreetMap, sample) so the Pipeline row matches other lists; else the domain.
        key: (place && place.key) || `url:${a.store.domain}`,
        name: (place && place.source !== 'you' && place.name) || a.store.name,
        url: a.store.url,
        domain: a.store.domain,
        score: a.score,
        grade: a.grade,
        products: (a.numbers && a.numbers.products) || 0,
        top: top.map((f) => f.title),
        why: top.length ? `Score ${a.score}. ${top[0].evidence || top[0].title}` : `Score ${a.score}. Few gaps; a lighter pitch.`,
        fixes: top.map((f) => ({ id: f.id, title: f.title, evidence: f.evidence })),
        email: (a.pitch && a.pitch.store && a.pitch.store.emails && a.pitch.store.emails[0]) || (place && place.email) || null,
        phone: (place && place.phone) || null,
        instagram: (a.pitch && a.pitch.store && a.pitch.store.instagram) || (place && place.instagram) || null,
        address: (place && place.address) || null,
        miles: place ? place.miles : null,
        kind: (place && place.kindLabel) || null,
        report: a.report || null,
        pitch: a.pitch || null,
        opportunity: opportunity(a, place),
        // Where the store came from, so the list and sheet carry OpenStreetMap's credit (D27).
        source: (place && place.source) || 'you',
        ...(place && place.searchBy ? { searchBy: place.searchBy } : {}),
        sample: !!a.sample,
      });
    });
    stores.sort((x, y) => y.opportunity - x.opportunity);
    const out = stores.slice(0, input.limit || 25).map((s, i) => ({ rank: i + 1, ...s }));
    return { stores: out, checked: audits.length, skipped, sample: out.some((s) => s.sample) };
  },

  view(out) {
    const sk = Object.entries(out.skipped || {}).map(([k, v]) => `${v} ${{ not_shopify: 'not on Shopify', password: 'behind a password', unreachable: 'unreachable', bad_url: 'bad address', feed_off: 'with the feed off' }[k] || k}`);
    return views.blocks(
      views.sampleNote(out, 'This list'),
      views.metric('Stores worth a pitch', out.stores.length, `From ${text.plural(out.checked, 'site')} checked${sk.length ? `; skipped ${text.list(sk)}` : ''}`),
      views.table(
        [
          { key: 'rank', label: '#', format: 'number' },
          { key: 'name', label: 'Store' },
          { key: 'score', label: 'Score', format: 'number' },
          { key: 'gap', label: 'Biggest gap' },
          { key: 'url', label: 'Site', format: 'link' },
        ],
        out.stores.map((s) => ({ rank: s.rank, name: s.name, score: s.score, gap: s.top[0] || 'Small fixes', url: s.url })),
        10
      ),
      places.creditBlocks(out.stores)
    );
  },
};
