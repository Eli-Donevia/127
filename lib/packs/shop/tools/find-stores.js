// Finds stores to audit: shops near the member that list a website on OpenStreetMap (through the kit's
// one map server, D27), plus any store addresses the member pastes. Non-Shopify sites drop out at the
// audit step. Every list from OpenStreetMap shows its credit (and LocationIQ's link when it looked up
// the city); no server URL or server error text is shown or kept.

const { text, views, places } = require('../../_kit');
const osm = require('../lib/osm');
const sample = require('../lib/sample');
const { parseStoreInput, offline } = require('../lib/store');
const ST = require('../data/stockists.json');

function pasted(list) {
  return String(list || '')
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseStoreInput(l))
    .filter(Boolean)
    .map((p) => ({ key: `url:${p.host}`, name: p.domain, url: `${p.origin}/`, kind: null, kindLabel: 'Store you added', miles: null, address: null, phone: null, email: null, instagram: null, source: 'you', sample: false }));
}

// Why there are no real shops near the city, in the member's words.
function noteFor(why, city, haveMine) {
  const where = places.cityShort ? places.cityShort(city) : city;
  if (why === 'held') return haveMine ? "Real store search isn't switched on yet, so we checked only the stores you added." : places.HELD_NOTE;
  if (why === 'busy') return haveMine ? 'OpenStreetMap was busy, so we checked only the stores you added. Try again in a few minutes for shops near you.' : 'OpenStreetMap was busy, so these are sample shops. Try again in a few minutes for real ones.';
  if (why === 'nocity') return haveMine ? `We couldn't look up ${where} on the map, so we checked only the stores you added. Check the spelling to add shops near you.` : `We couldn't look up ${where} on the map, so these are sample shops to show how it works. Check the spelling and run it again, or paste store addresses.`;
  return '';
}

module.exports = {
  name: 'shop.find_stores',
  title: 'Find stores near you',
  description: 'Lists independent shops near a city that have their own website (gift, clothing, home, beauty, food and more) from OpenStreetMap, plus any store addresses you paste. Chains are left out.',
  kind: 'api',
  risk: 'read',
  needs: [],
  // 127's own OpenStreetMap servers (D27): without them live runs hold the search and show sample shops.
  wants: ['osm'],
  credits: 2,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      city: { type: 'string', title: 'City', maxLength: 120 },
      stores: { type: 'string', title: 'Store addresses (optional)', maxLength: 4000, description: 'One per line, like yourstore.com' },
      limit: { type: 'integer', minimum: 1, maximum: 40, default: 30 },
      radiusKm: { type: 'number', minimum: 1, maximum: 25, default: 10 },
    },
  },
  output: {
    type: 'object',
    properties: { stores: { type: 'array' }, found: { type: 'integer' }, center: { type: ['object', 'null'] }, credit: { type: 'string' }, sample: { type: 'boolean' }, held: { type: 'boolean' }, note: { type: 'string' } },
    required: ['stores'],
  },

  async run(input, ctx) {
    const limit = Math.min(40, input.limit || 30);
    const mine = pasted(input.stores);
    let list = [];
    let sampleUsed = false;
    let note = '';
    let center = null;
    let held = false;
    if (input.city && mine.length < limit) {
      let res = null;
      let why = ctx.sample ? 'sample' : '';
      if (!ctx.sample) {
        try {
          res = await osm.findShops(ctx, { city: input.city, kinds: ST.discovery.kinds, radiusKm: input.radiusKm || 10, withWebsite: true });
          if (res && res.held) {
            held = true;
            why = 'held';
            res = null;
          } else if (!res) why = 'nocity';
        } catch (e) {
          if (/^Stopped\.?$/.test(String(e && e.message))) throw e;
          why = offline(e) ? 'offline' : 'busy';
        }
      }
      note = noteFor(why, input.city, mine.length > 0);
      // Sample shops only when nothing real came back and the member pasted nothing to check instead.
      if (!res && !(mine.length && why !== 'sample' && why !== 'offline')) {
        res = { center: null, places: sample.samplePlaces({ city: input.city, kinds: ST.discovery.kinds, withWebsite: true }) };
        sampleUsed = true;
      }
      if (res) {
        center = res.center;
        list = res.places
          .filter((p) => p.website && !p.chain)
          .map((p) => ({ key: p.key, name: p.name, url: p.website, kind: p.kind, kindLabel: p.kindLabel, miles: p.miles, address: p.address, phone: p.phone, email: p.email, instagram: p.instagram, source: p.source, ...(p.searchBy ? { searchBy: p.searchBy } : {}), sample: !!p.sample }));
      }
    }
    const seen = new Set();
    const stores = [...mine, ...list].filter((s) => {
      const host = (parseStoreInput(s.url) || {}).host;
      if (!host || seen.has(host)) return false;
      seen.add(host);
      return true;
    }).slice(0, limit);
    ctx.log(`Found ${text.plural(stores.length, 'store')} to check${sampleUsed ? ' (sample shops)' : ''}.`);
    return { stores, found: stores.length, center, credit: places.creditLine(stores), sample: sampleUsed, held, note };
  },

  view(out) {
    return views.blocks(
      out.sample && !out.note ? views.text('Sample shops, so you can see how this works. Run it with network on to read real shops near you.') : null,
      out.note ? views.text(out.note) : null,
      views.metric('Stores to check', out.found, 'Next we read each one and keep the Shopify stores'),
      views.table(
        [
          { key: 'name', label: 'Store' },
          { key: 'kindLabel', label: 'Type' },
          { key: 'miles', label: 'Miles', format: 'number' },
          { key: 'url', label: 'Website', format: 'link' },
        ],
        out.stores,
        10
      ),
      places.creditBlocks(out.stores)
    );
  },
};
