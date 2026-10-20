// The online store's facts and shared pieces: niche data, the member's facts, the fee math (code,
// from data/fees.json) and local shops from OpenStreetMap through the kit (never any other source).

const path = require('path');
const { text, money, brain } = require('../../_kit');
const C = require('../../_kit/common');

const { plain } = text;
const N = C.load(path.join(__dirname, '..'));
const FEES = require('../data/fees.json');
const LIMITS = require('../data/limits.json');

const places = () => require('../../_kit/places');

// The member's facts for drafts: first name, shop name, what they sell, city, link.
function me(ctx, input = {}) {
  const w = C.who(ctx, input);
  const br = brain.brainOf(ctx, input);
  const link = /^https:\/\//.test(String(input.link || '')) ? String(input.link) : /^https:\/\//.test(br.website) ? br.website : '';
  return {
    first: w.first,
    shop: plain(input.shop || input.business || br.name || ''),
    what: plain(input.what || br.what || N.what),
    city: w.city,
    area: w.area || 'town',
    link,
    email: plain(input.email || ''),
  };
}

// ---------- fees (code, from data/fees.json) ----------

const r2 = (n) => Math.round(n * 100) / 100;

// What one sale costs in fees on a channel. price and ship are what the buyer pays you.
function feeFor(ch, { price, ship = 0 }) {
  const total = Math.max(0, price) + Math.max(0, ship);
  if (!(total > 0)) return 0;
  let fee = total * ch.rate + ch.fixed;
  if (ch.transaction) fee += total * ch.transaction;
  if (ch.listing) fee += ch.listing;
  return r2(fee);
}

// The lowest price that keeps `margin` of the price after landed cost, shipping you pay and fees.
function priceForMargin(ch, { cost, ship = 0, shipCost = 0, margin }) {
  const m = Math.min(0.9, Math.max(0, margin));
  const pct = ch.rate + (ch.transaction || 0);
  const fixed = ch.fixed + (ch.listing || 0);
  // p + ship - fee(p) - cost - shipCost = m * p  ->  p (1 - pct - m) = cost + shipCost + fixed + ship * pct - ship
  const denom = 1 - pct - m;
  if (denom <= 0.05) return null;
  return r2((cost + shipCost + fixed + ship * pct - ship) / denom);
}

function channels(ids) {
  const want = (ids && ids.length ? ids : FEES.order).filter((id) => FEES.channels[id]);
  return want.map((id) => ({ id, ...FEES.channels[id] }));
}

// ---------- local shops (OpenStreetMap through the kit) ----------

function categoryFor(t) {
  const P = places();
  const base = t.kit ? P.categoryOf(t.kit) : P.categoryOf('boutiques');
  const custom = !t.kit && t.id !== 'gift';
  return {
    ...base,
    id: custom ? `custom:ecom-${t.id}` : base.id,
    label: t.label,
    many: t.label.toLowerCase(),
    q: t.label.toLowerCase(),
    one: t.sample_noun || base.one,
    osm: t.osm,
    family: t.family || base.family,
    type: null,
    custom,
  };
}

// Up to `limit` independent places of one partner type near a city: OpenStreetMap through the kit, or
// made-up samples marked "(sample)" when the map servers are off or find nothing.
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

// Spread over partner types so ten places aren't all one kind.
async function findPartners(ctx, { city, limit = 10, types = N.partners, skip = new Set() }) {
  const per = Math.max(2, Math.ceil(limit / types.length) + 1);
  const lists = [];
  const notes = new Set();
  let held = false;
  for (const t of types) {
    try {
      const r = await findType(ctx, t, { city, limit: per });
      lists.push(r.list.filter((b) => !skip.has(b.name.toLowerCase())));
      if (r.note) notes.add(r.note);
      held = held || r.held;
    } catch (e) {
      if (ctx && ctx.signal && ctx.signal.aborted) throw e;
      lists.push([]);
      notes.add(`Couldn't list ${t.label.toLowerCase()} near ${city} right now.`);
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
  return { partners: out, notes: [...notes], held };
}

const typeOf = (id) => N.partners.find((t) => t.id === id) || N.partners[0];

module.exports = { N, FEES, LIMITS, me, feeFor, priceForMargin, channels, findPartners, findType, categoryFor, typeOf, places, r2, usd: money.usd };
