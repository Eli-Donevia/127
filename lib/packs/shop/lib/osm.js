// Local shops near a city from OpenStreetMap, with their shop type, website, email and Instagram.
// A local helper (named in the pack README): the kit's places.findPlaces keeps no shop type, can't ask
// for "has a website" and stops at 60 places, and finding the few Shopify stores among a city's shops
// needs all three. The servers are the kit's (D27, Legal L55 and L57): the city lookup is
// places.geocode and the shop query is places.overpass, one server, never a rotation of public
// mirrors, held in live runs until 127's own servers are set. One query at a time, cached for a day.
// No server URL or server error text is kept here (they can carry a key).
// Data (c) OpenStreetMap contributors, ODbL: every place carries source 'osm' so lists, sheets and
// pages show the credit (places.creditBlocks, creditLine, creditHtml), and searchBy when LocationIQ
// did the city lookup (its link rides along in views and pages).

const { web, text, places } = require('../../_kit');
const ST = require('../data/stockists.json');

const SOCIAL_HOST = /(^|\.)(facebook|fb|instagram|linktr|linktree|etsy|yelp|google|goo|tiktok|twitter|x|pinterest|youtube|tripadvisor|nextdoor|mapquest|foursquare|amazon)\.(com|ee|gl|me)$/i;

function kmBetween(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const labelOf = (kind) => ST.labels[kind] || text.sentenceCase(String(kind || 'shop').replace(/_/g, ' '));

const CHAINS = ST.chains.map((c) => c.toLowerCase());
function isChain(name, tags = {}) {
  if (tags.brand || tags['brand:wikidata']) return true;
  const n = ` ${String(name || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9&'. ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  return CHAINS.some((c) => n.includes(` ${c} `) || n.trim() === c);
}

function overpassQuery({ kinds, center, radiusKm, withWebsite }) {
  const r = Math.round(Math.min(25, Math.max(1, radiusKm || 8)) * 1000);
  const around = `(around:${r},${center.lat.toFixed(5)},${center.lng.toFixed(5)})`;
  const rx = kinds.map((k) => String(k).replace(/[^a-z0-9_]/gi, '')).filter(Boolean).join('|');
  const shop = `["shop"~"^(${rx})$"]["name"]`;
  const parts = withWebsite ? [`nwr${shop}["website"]${around};`, `nwr${shop}["contact:website"]${around};`] : [`nwr${shop}${around};`];
  return `[out:json][timeout:25];(${parts.join('')});out center tags 1500;`;
}

function handleFrom(v, host) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (!/[/.]/.test(s)) return s.replace(/^@/, '').toLowerCase();
  const m = s.match(new RegExp(`${host.replace('.', '\\.')}\\/(?:@)?([A-Za-z0-9._]+)`, 'i'));
  return m ? m[1].toLowerCase() : null;
}

function fromElement(el, center) {
  const t = el.tags || {};
  const lat = Number.isFinite(el.lat) ? el.lat : el.center ? el.center.lat : null;
  const lng = Number.isFinite(el.lon) ? el.lon : el.center ? el.center.lon : null;
  if (!t.name || !Number.isFinite(lat)) return null;
  const rawSite = web.normalizeUrl(t.website || t['contact:website'] || t.url || '');
  let site = rawSite;
  let host = '';
  try {
    host = site ? new URL(site).hostname.replace(/^www\./, '') : '';
  } catch {
    site = null;
  }
  const etsy = /(^|\.)etsy\.com$/i.test(host) ? site : null;
  if (host && SOCIAL_HOST.test(host)) site = null;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const km = kmBetween(center, { lat, lng });
  return {
    key: `osm:${el.type}/${el.id}`,
    osmId: `${el.type}/${el.id}`,
    source: 'osm',
    ...(center && center.searchBy ? { searchBy: center.searchBy } : {}),
    sample: false,
    name: text.oneLine(t.name),
    kind: t.shop,
    kindLabel: labelOf(t.shop),
    address: [street, t['addr:city']].filter(Boolean).join(', '),
    lat,
    lng,
    km: km == null ? null : Math.round(km * 10) / 10,
    miles: km == null ? null : Math.round(km * 0.6214 * 10) / 10,
    website: site,
    etsy,
    email: String(t['contact:email'] || t.email || '').trim().toLowerCase() || null,
    phone: t['contact:phone'] || t.phone || null,
    instagram: handleFrom(t['contact:instagram'] || t.instagram, 'instagram.com'),
    facebook: t['contact:facebook'] || t.facebook || null,
    hours: t.opening_hours || null,
    chain: isChain(t.name, t),
    closed: !!(t['disused:shop'] || t['was:shop'] || t['abandoned:shop']),
    osmUrl: places.osmLink(el.type, el.id),
  };
}

// { city, kinds, radiusKm, withWebsite } -> { center, places (nearest first), held: false }, null when
// the city can't be looked up, or { held: true, places: [] } when real search isn't switched on yet
// (places.HELD_NOTE). Throws the kit's "OpenStreetMap's server is busy" after one retry.
async function findShops(ctx, { city, kinds, radiusKm = 8, withWebsite = false } = {}) {
  if (places.osmServer(ctx).held) return { held: true, center: null, places: [] };
  const center = await places.geocode(ctx, city);
  if (!center) return null;
  const query = overpassQuery({ kinds, center, radiusKm, withWebsite });
  const key = `shop:osm:v2:${center.lat.toFixed(3)},${center.lng.toFixed(3)}:${Math.round(radiusKm)}:${withWebsite ? 'w' : 'a'}:${text.hash(kinds.slice().sort().join(','))}`;
  const elements = await web.cached(ctx, key, 24, () => places.overpass(ctx, query, { timeoutMs: 45000 }));
  const seen = new Set();
  const out = [];
  for (const el of elements || []) {
    const p = fromElement(el, center);
    if (!p || p.closed || seen.has(p.key)) continue;
    seen.add(p.key);
    out.push(p);
  }
  out.sort((a, b) => (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km));
  return { center: { lat: center.lat, lng: center.lng, label: center.label, ...(center.searchBy ? { searchBy: center.searchBy } : {}) }, places: out, held: false };
}

module.exports = { findShops, overpassQuery, fromElement, isChain, kmBetween, labelOf, SOCIAL_HOST };
