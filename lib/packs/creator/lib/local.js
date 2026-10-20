// Local places through the kit's OpenStreetMap search only (never Google, never any other source):
// the partner types in data/niche.json, spread over types, chains dropped, made-up samples named
// "(sample)" when 127's map servers are off or nothing is found. The idea pack keeps the same file.

const { text } = require('../../_kit');

const { plain } = text;
const places = () => require('../../_kit/places');

function categoryFor(t) {
  const P = places();
  const base = P.categoryOf(t.kit || 'boutiques');
  const custom = !t.kit;
  return {
    ...base,
    id: custom ? `custom:${t.id}` : base.id,
    label: t.label,
    many: t.label.toLowerCase(),
    q: t.label.toLowerCase(),
    one: t.sample_noun || base.one,
    osm: t.osm && t.osm.length ? t.osm : base.osm,
    family: t.family || base.family,
    type: null,
    custom,
    ...(custom ? { chains: t.chains || [] } : {}),
  };
}

async function findType(ctx, t, { city, limit = 3 }) {
  const P = places();
  const cat = categoryFor(t);
  const r = await P.findPlaces(ctx, { category: cat, city, limit: limit * 2 + 4, google: false });
  const { kept } = P.filterPlaces(r.places, { category: cat });
  return {
    list: kept.slice(0, limit).map((p) => ({
      name: plain(p.name),
      address: p.address || '',
      phone: p.phone || '',
      website: p.website || '',
      source: p.source,
      sample: !!p.sample || p.source === 'sample',
      type: t.id,
      ...(p.searchBy ? { searchBy: p.searchBy } : {}),
    })),
    note: r.note || '',
    held: !!r.held,
  };
}

async function findLocal(ctx, types, { city, limit = 10, skip = new Set() } = {}) {
  if (!city || !types.length || limit <= 0) return { places: [], held: false, notes: [] };
  const per = Math.max(2, Math.ceil(limit / types.length) + 1);
  const lists = [];
  const notes = [];
  let held = false;
  for (const t of types) {
    try {
      const r = await findType(ctx, t, { city, limit: per });
      lists.push(r.list.filter((b) => !skip.has(b.name.toLowerCase())));
      held = held || r.held;
    } catch (e) {
      if (ctx && ctx.signal && ctx.signal.aborted) throw e;
      lists.push([]);
      notes.push(`Couldn't list ${t.label.toLowerCase()} near ${city} right now.`);
    }
  }
  const out = [];
  const seen = new Set();
  for (let r = 0; out.length < limit && lists.some((l) => l[r]); r++) {
    for (const l of lists) {
      const b = l[r];
      if (!b || seen.has(b.name.toLowerCase())) continue;
      seen.add(b.name.toLowerCase());
      out.push(b);
      if (out.length >= limit) break;
    }
  }
  return { places: out, held, notes };
}

module.exports = { findLocal, findType, categoryFor, places };
