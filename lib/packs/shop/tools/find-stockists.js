// shop.find_stockists: local shops that might stock what the member makes. Shop types come from
// data/stockists.json for the member's category (gift and home shops for candles, say), found on
// OpenStreetMap through the kit's one map server (D27). Each shop with a website gets one polite
// homepage read (and a look at its product feed when it's on Shopify) for public fit signals: local
// makers, the category already on its shelves, an email. Scored by fit, nearest first on ties.
// Chains and shops already in the Pipeline are left out. Nothing is sent.

const { text, views, places, brain, web, leads } = require('../../_kit');
const osm = require('../lib/osm');
const sample = require('../lib/sample');
const { probeSite, offline } = require('../lib/store');
const S = require('../lib/stockists');

const PROBES = 30;

function noteFor(why, city) {
  const where = places.cityShort(city);
  if (why === 'held') return places.HELD_NOTE;
  if (why === 'busy') return "OpenStreetMap's server was busy, so these are sample shops. Try again in a few minutes for real ones.";
  if (why === 'nocity') return `We couldn't look up ${where} on the map just now, so these are sample shops to show how it works. Check the spelling, or try again in a few minutes.`;
  return '';
}

module.exports = {
  name: 'shop.find_stockists',
  title: 'Find shops to stock you',
  description: 'Finds independent shops near a city that might stock what you make (gift, home, book and other shop types for your category) from OpenStreetMap, reads each shop website once for public fit signals (local makers, your category already on the shelves, an email), and ranks them by fit.',
  kind: 'api',
  risk: 'read',
  needs: [],
  // 127's own OpenStreetMap servers (D27): without them live runs hold the search and show sample shops.
  wants: ['osm'],
  credits: 3,
  timeoutSec: 240,
  input: {
    type: 'object',
    properties: {
      city: { type: 'string', title: 'City', maxLength: 120 },
      what: { type: 'string', maxLength: 4000, description: 'What you make (your product lines work), to pick the shop types.' },
      price: { type: 'number', minimum: 0, description: 'A typical retail price of yours, to compare with what shops carry.' },
      radiusKm: { type: 'number', minimum: 1, maximum: 25, default: 12 },
      limit: { type: 'integer', minimum: 5, maximum: 60, default: 40 },
    },
    required: ['city'],
  },
  output: {
    type: 'object',
    properties: {
      category: { type: 'object' },
      shops: { type: 'array' },
      found: { type: 'integer' },
      skipped: { type: 'integer' },
      center: { type: ['object', 'null'] },
      credit: { type: 'string' },
      note: { type: 'string' },
      held: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['shops'],
  },

  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const cat = S.categoryOf(input.what, br.what, br.niche, br.offer);
    const kinds = [...cat.primary, ...cat.secondary];
    let res = null;
    let why = ctx.sample ? 'sample' : '';
    let held = false;
    if (!ctx.sample) {
      try {
        res = await osm.findShops(ctx, { city: input.city, kinds, radiusKm: input.radiusKm || 12, withWebsite: false });
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
    let sampleUsed = false;
    if (!res) {
      res = { center: null, places: sample.samplePlaces({ city: input.city, kinds }) };
      sampleUsed = true;
    }
    const seen = await leads.known(ctx);
    let skipped = 0;
    const pool = res.places.filter((p) => {
      if (p.chain || !p.name) return false;
      const site = p.website ? web.domainOf(p.website) : '';
      if (seen.keys.has(p.key) || seen.names.has(p.name.toLowerCase().trim()) || (site && seen.sites.has(site))) {
        skipped++;
        return false;
      }
      return true;
    });
    // Nearest primary shops get the homepage reads first.
    const order = pool.slice().sort((a, b) => Number(cat.primary.includes(b.kind)) - Number(cat.primary.includes(a.kind)) || (a.miles == null ? 99 : a.miles) - (b.miles == null ? 99 : b.miles));
    const toProbe = order.filter((p) => p.website).slice(0, PROBES);
    const rx = S.fitRx(cat);
    ctx.log(`Found ${text.plural(pool.length, 'shop')} near ${places.cityShort(input.city)}${sampleUsed ? ' (sample shops)' : ''}. Reading ${text.plural(toProbe.length, 'website')}.`);
    const probes = new Map();
    await web.mapLimit(
      toProbe,
      4,
      async (p) => {
        try {
          const r = await probeSite(ctx, p.website, { catalog: true, fitRx: rx });
          if (r && r.ok) probes.set(p.key, r);
        } catch (e) {
          if (/^Stopped\.?$/.test(String(e && e.message))) throw e;
        }
      },
      ctx
    );
    const price = input.price != null ? Number(input.price) : br.price;
    const shops = order
      .map((p) => {
        const probe = probes.get(p.key) || null;
        const sc = S.scoreShop(p, probe, cat, { price });
        const row = {
          key: p.key,
          name: p.name,
          kind: p.kind,
          kindLabel: p.kindLabel,
          miles: p.miles,
          address: p.address || '',
          website: p.website || null,
          email: sc.email,
          instagram: sc.instagram,
          phone: p.phone || (probe && probe.phones && probe.phones[0]) || null,
          local: (probe && probe.local) || [],
          sells: !!((probe && probe.catalog && probe.catalog.matches) || (probe && probe.fitHits)),
          score: sc.score,
          why: sc.why,
          facts: sc.facts,
          source: p.source,
          ...(p.searchBy ? { searchBy: p.searchBy } : {}),
          ...(p.osmUrl ? { osmUrl: p.osmUrl } : {}),
          lat: p.lat,
          lng: p.lng,
          sample: !!p.sample,
        };
        row.channel = S.channelOf(row);
        return row;
      })
      .sort((a, b) => b.score - a.score || (a.miles == null ? 99 : a.miles) - (b.miles == null ? 99 : b.miles))
      .slice(0, Math.min(60, input.limit || 40));
    const note = [noteFor(why, input.city), skipped ? `Left out ${text.plural(skipped, 'shop')} already in your Pipeline.` : ''].filter(Boolean).join(' ');
    ctx.log(`Ranked ${text.plural(shops.length, 'shop')} for ${cat.label}.`);
    return { category: { id: cat.id, label: cat.label, many: cat.many }, shops, found: shops.length, skipped, center: res.center || null, credit: places.creditLine(shops), note, held, sample: sampleUsed };
  },

  view(out) {
    return views.blocks(
      out.sample && !out.note ? views.text('Sample shops, made up for practice, so you can see how this works.') : null,
      out.note ? views.text(out.note) : null,
      views.metric('Shops that might stock you', out.found, `Shop types for ${out.category.label}, best fit first`),
      views.table(
        [
          { key: 'name', label: 'Shop' },
          { key: 'why', label: 'Why it fits' },
          { key: 'score', label: 'Fit', format: 'number' },
          { key: 'website', label: 'Website', format: 'link' },
        ],
        out.shops,
        12
      ),
      views.text('Fit is a guess from what each shop shows in public. It is never a promise that a shop will buy.'),
      places.creditBlocks(out.shops)
    );
  },
};
