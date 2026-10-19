// First 25: the free lead magnet that leads the ads and the bio link (Eli, 2026-10-19).
// Name what you sell and your city. It finds local businesses, drops chains and closed ones,
// checks every website for the gap you fix (lib/site-audit.js), ranks them and writes the
// message to send each one. Scoring and copy: public/funnels/first25-engine.js and first25-data.js,
// shared with the page so the screen, the CSV and the email match.
//
// Mounted by lib/funnels.js, which serves the page itself (/first-25) with the shared trackers,
// consent wording and launch state, and handles the email gate through /api/lead (source "first-25").
//
//   POST /api/first-25/run       { pack, buyer, place, me, service }  streams NDJSON progress, then the run
//   POST /api/first-25/r/:id/status  { k, rank, stage }  the tracker (Sent, Replied, Call booked, Won, Not now)
//   GET  /first-25/r/:id?k=      the saved list from the email (page, served by lib/funnels.js)
//   GET  /first-25/r/:id.csv?k=  the list for Sheets, Notion or Airtable
//
// Env (all optional):
//   FIRST25_SOURCE      sample (default) | google | osm. Sample is made-up businesses, labeled on the page.
//   GOOGLE_PLACES_KEY   needed for google. Places API (New) Text Search, up to FIRST25_GOOGLE_PAGES pages of 20 (default 2).
//   OSM_NOMINATIM_URL, OSM_OVERPASS_URL   free OpenStreetMap source (defaults: the public servers; fair use only)
//   FIRST25_DAILY_CAP (150), FIRST25_PER_IP (6)   live searches per day, overall and per visitor
//   FIRST25_KEEP_DAYS (30)   saved lists older than this are deleted
//   FIRST25_SAMPLE_PACE (1)  how slowly a sample scan plays out on the page; 0 skips the pauses

const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const audit = require('./site-audit');
const E = require('../public/funnels/first25-engine.js');

const D = E.D;
const BASE = () => (process.env.BASE_URL || 'https://127group.io').replace(/\/$/, '');
const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const UA = '127-First25/1.0 (hello@127group.io; https://127group.io/first-25)';

function sourceName() {
  const s = env('FIRST25_SOURCE', 'sample');
  if (s === 'google' && process.env.GOOGLE_PLACES_KEY) return 'google';
  if (s === 'osm') return 'osm';
  return 'sample';
}

// ---------- signing (links in the email) ----------
function sign(id) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(`first25:${id}`).digest('hex').slice(0, 32);
}
function signed(id, k) {
  const a = Buffer.from(String(k || '')), b = Buffer.from(sign(id));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const runUrl = (run) => `${BASE()}/first-25/r/${run.id}?k=${sign(run.id)}`;

// ---------- sources ----------
async function getJson(url, init = {}, ms = 9000) {
  const r = await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(ms) });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch {}
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${(j && j.error && j.error.message) || text.slice(0, 160)}`), { status: r.status });
  return j;
}

// Google Places API (New), Text Search. Enterprise fields (website, phone, rating) bill as Text Search Enterprise.
async function fromGoogle(B, place) {
  const fields = ['places.id', 'places.displayName', 'places.formattedAddress', 'places.shortFormattedAddress', 'places.websiteUri', 'places.nationalPhoneNumber',
    'places.rating', 'places.userRatingCount', 'places.businessStatus', 'places.googleMapsUri', 'nextPageToken'].join(',');
  const pages = Math.max(1, Math.min(3, parseInt(env('FIRST25_GOOGLE_PAGES', '2'), 10) || 2));
  const out = [];
  let token = null, type = B.type || undefined;
  for (let i = 0; i < pages; i++) {
    const body = { textQuery: `${B.q} in ${place}`, pageSize: 20, languageCode: 'en', ...(type ? { includedType: type } : {}), ...(token ? { pageToken: token } : {}) };
    let j;
    try {
      j = await getJson('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GOOGLE_PLACES_KEY, 'x-goog-fieldmask': fields }, body: JSON.stringify(body) });
    } catch (e) {
      // An includedType Google doesn't know is a 400: search again on the words alone.
      if (e.status === 400 && type && !token) { type = undefined; i--; continue; }
      throw e;
    }
    for (const p of (j && j.places) || []) {
      out.push({
        id: 'g-' + p.id,
        name: (p.displayName && p.displayName.text) || '',
        address: p.shortFormattedAddress || p.formattedAddress || '',
        phone: p.nationalPhoneNumber || null,
        website: p.websiteUri || null,
        rating: typeof p.rating === 'number' ? p.rating : null,
        reviews: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
        closed: !!p.businessStatus && p.businessStatus !== 'OPERATIONAL',
        mapsUrl: p.googleMapsUri || null,
      });
    }
    token = j && j.nextPageToken;
    if (!token) break;
  }
  return out.filter((b) => b.name);
}

// OpenStreetMap: Nominatim for the area, Overpass for the businesses. No ratings, so fit leans on the website.
function overpassFilter(tag) {
  return tag.split('][').map((kv) => { const [k, v] = kv.split('='); return `["${k}"="${v}"]`; }).join('');
}
async function fromOsm(B, place) {
  const nom = env('OSM_NOMINATIM_URL', 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  const geo = await getJson(`${nom}/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`, { headers: { 'accept-language': 'en' } }, 8000);
  if (!geo || !geo[0]) throw Object.assign(new Error('place not found'), { status: 404 });
  let [s, n, w, e] = geo[0].boundingbox.map(Number);
  // A state or a big county is too wide for a walkable list: keep about 15 km around the center.
  const lat = Number(geo[0].lat), lon = Number(geo[0].lon), dLat = 0.14, dLon = 0.14 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  if (n - s > 2 * dLat) { s = lat - dLat; n = lat + dLat; }
  if (e - w > 2 * dLon) { w = lon - dLon; e = lon + dLon; }
  const bbox = [s, w, n, e].map((x) => x.toFixed(5)).join(',');
  const q = `[out:json][timeout:20];(${B.osm.map((t) => `nwr${overpassFilter(t)}(${bbox});`).join('')});out center tags 160;`;
  const over = env('OSM_OVERPASS_URL', 'https://overpass-api.de/api/interpreter');
  const j = await getJson(over, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, 22000);
  return ((j && j.elements) || []).map((el) => {
    const t = el.tags || {};
    const web = t.website || t['contact:website'] || t.url || null;
    const addr = [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:city']].filter(Boolean).join(', ');
    const ig = t['contact:instagram'] || null;
    return {
      id: `osm-${el.type}-${el.id}`,
      name: t.name || '',
      address: addr,
      phone: t.phone || t['contact:phone'] || null,
      website: web && !/^https?:\/\//i.test(web) ? 'http://' + web : web,
      instagram: ig ? String(ig).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '').replace(/^@/, '') || null : null,
      rating: null, reviews: null,
      closed: !!(t['disused:shop'] || t['disused:amenity']),
      mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    };
  }).filter((b) => b.name);
}

// ---------- caches (in memory, one instance) ----------
// Listings + website checks for the same search, so a second search of "gyms in Des Moines" is instant and costs nothing.
function ttlCache(ms, max) {
  const m = new Map();
  return {
    get(k) { const v = m.get(k); if (!v) return null; if (Date.now() - v.at > ms) { m.delete(k); return null; } return v.value; },
    set(k, value) { m.set(k, { at: Date.now(), value }); if (m.size > max) m.delete(m.keys().next().value); },
  };
}
const listCache = ttlCache(6 * 3600e3, 300);
const siteCache = ttlCache(24 * 3600e3, 5000);

// ---------- one run ----------
// Calls progress({step, ...}) as it goes, so the page can show the real work.
async function run(input, progress = () => {}) {
  const pack = D.packs[input.pack] ? input.pack : 'video';
  const P = E.pack(pack);
  const buyer = D.buyers[input.buyer] ? input.buyer : P.buyers[0];
  const B = E.buyer(buyer);
  const place = String(input.place || '').trim().slice(0, 80);
  const city = E.cityOf(place);
  const source = input.source || sourceName();
  const now = new Date();
  const pace = Number(env('FIRST25_SAMPLE_PACE', '1')) || 0;
  const pause = (ms) => (source === 'sample' && pace > 0 ? new Promise((r) => setTimeout(r, ms * pace)) : Promise.resolve());

  progress({ step: 'search', text: `Searching ${city} for ${B.many}` });
  const key = `${source}|${buyer}|${place.toLowerCase()}`;
  let list = listCache.get(key);
  if (!list) {
    if (source === 'google') list = await fromGoogle(B, place);
    else if (source === 'osm') list = await fromOsm(B, place);
    else list = E.sample(buyer, place, now);
    await pause(700);
    // Website checks, inside the time budget. Sample businesses come with made-up checks already.
    if (source !== 'sample') {
      const withSite = list.filter((b) => b.website && !E.isChain(b.name, buyer) && !b.closed).length;
      progress({ step: 'found', n: list.length, sites: withSite });
      await audit.auditAll(list.filter((b) => !E.isChain(b.name, buyer) && !b.closed), {
        budgetMs: 14000, perMs: 6000, concurrency: 10, now, cache: siteCache,
        onProgress: (p) => { if (p.checked % 4 === 0 || p.checked === p.of) progress({ step: 'audit', ...p }); },
      });
    }
    listCache.set(key, list);
  }
  if (source === 'sample') {
    progress({ step: 'found', n: list.length, sites: list.filter((b) => b.website).length });
    await pause(500);
    const sites = list.filter((b) => b.website).length;
    for (const f of [0.35, 0.7, 1]) { progress({ step: 'audit', checked: Math.round(sites * f), of: sites }); await pause(380); }
  }
  progress({ step: 'rank', text: `Ranking by how much they need ${P.sell}` });
  const built = E.build(list, { pack, buyer, place, city, me: input.me, service: input.service, now });
  await pause(450);
  progress({ step: 'write', text: 'Writing your messages' });

  const doc = {
    kind: 'first25',
    pack, buyer, place, city, source, sample: source === 'sample',
    me: String(input.me || '').slice(0, 40), service: String(input.service || '').slice(0, 60),
    checkedAt: now.toISOString(),
    stats: built.stats,
    headline: built.headline.map((h) => ({ ...h, line: E.headlineLine(h) })),
    // Keep what the page shows; messages are rebuilt from these, so a name added at the gate fills in everywhere.
    prospects: built.prospects.map(slim),
    utm: input.utm || {},
  };
  const saved = await db.save('prospectRuns', doc);
  await pause(250);
  return saved;
}

function slim(b) {
  const s = b.site || {};
  return {
    rank: b.rank, name: b.name, score: b.score, gaps: b.gaps, fits: b.fits, unchecked: b.unchecked,
    website: b.website || null, instagram: b.instagram || (s.socials && s.socials.instagram) || null,
    phone: b.phone || null, address: b.address || null, mapsUrl: b.mapsUrl || null, rating: b.rating, reviews: b.reviews,
    email: s.email || null,
    site: { checked: !!s.checked, ok: !!s.ok, footerYear: s.footerYear || null, booking: s.booking || null, platform: s.platform || null, socials: s.socials || null },
  };
}

// The run as the page, CSV and email use it: messages and samples written for this sender.
function view(doc, me) {
  const ctx = { me: me || doc.me, city: doc.city, service: doc.service };
  const prospects = doc.prospects.map((b, i) => ({
    ...b,
    msg: E.messages(b, doc.pack, doc.buyer, ctx),
    spec: i < 3 ? E.spec(b, doc.pack, doc.buyer, ctx) : undefined,
  }));
  return {
    id: doc.id, k: sign(doc.id), pack: doc.pack, buyer: doc.buyer, place: doc.place, city: doc.city, source: doc.source, sample: doc.sample,
    service: doc.service, me: ctx.me || '', checkedAt: doc.checkedAt, stats: doc.stats, headline: doc.headline,
    attribution: D.copy.attribution[doc.source] || '', status: doc.status || {}, prospects,
  };
}

// ---------- the result email (source first-25 in lib/funnels.js deliveryEmail) ----------
function emailText(lead, stateBlock) {
  const d = lead.data || {};
  const doc = d.run_id && signed(d.run_id, d.k) ? db.get('prospectRuns', d.run_id) : null;
  const hi = `Hi ${lead.name || 'there'},`;
  if (!doc) {
    return {
      subject: 'Your First 25',
      text: `${hi}\n\nYour list didn't save on our side, sorry about that. Run it again here, it takes a minute: ${BASE()}/first-25\n\n${stateBlock('C')}`,
    };
  }
  const v = view(doc, lead.name);
  const P = E.pack(v.pack), B = E.buyer(v.buyer);
  const top = v.prospects.slice(0, 10).map((b) => {
    const where = b.website || b.mapsUrl || '';
    return `${b.rank}. ${b.name} (score ${b.score})${where ? ` ${where}` : ''}\n   Why: ${(b.gaps[0] || b.fits[0] || {}).why || ''}\n   Send: "${b.msg.dm}"`;
  }).join('\n\n');
  const sample = v.prospects[0] && v.prospects[0].spec;
  const board = sample && sample.board ? `\n${sample.board.map((r) => `${r[0]}: ${r[1]}`).join('\n')}` : '';
  const plan = D.plan.map((p, i) => `Day ${i + 1}: ${p}`).join('\n');
  const replies = E.replies(v.prospects[0] || { name: 'them' }, v.pack, v.buyer, { me: v.me, city: v.city, service: v.service })
    .filter((r) => ['yes', 'price', 'who'].includes(r.id)).map((r) => `${r.label}\n${r.text}`).join('\n\n');
  const sampleNote = v.sample ? `\n\n${D.copy.sampleNote}` : '';
  return {
    subject: `Your First 25: ${B.many} in ${v.city}`,
    text: `${hi}\n\nHere are the ${B.many} in ${v.city} that need ${P.sell} most, ranked, with the message to send each one.${sampleNote}\n\nOpen all ${v.prospects.length}, with every message and follow-up: ${runUrl(doc)}\nDownload the list for Sheets or Notion: ${BASE()}/first-25/r/${doc.id}.csv?k=${sign(doc.id)}\n\n${D.copy.problem}\n\nYour top 10:\n\n${top}\n\n${sample ? `Before you message #1, make this:\n${sample.title}\n${sample.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${board}\n\n` : ''}Your first 7 days:\n${plan}\n\nWhen they reply:\n\n${replies}\n\nThe rest of the replies, send mode and your tracker are on your list page. ${D.copy.keep}\n\n${E.fill(D.copy.checked, { date: new Date(doc.checkedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) })} ${v.attribution}\n\n${stateBlock()}`,
  };
}

// ---------- routes ----------
function router({ json, limited }) {
  const r = express.Router();

  r.post('/api/first-25/run', json, async (req, res) => {
    const b = req.body || {};
    const place = String(b.place || '').trim();
    if (place.length < 2 || place.length > 80) return res.status(400).json({ error: 'Enter a city and state, or a ZIP code.' });
    if (b.website) return res.status(400).json({ error: 'Something went wrong.' }); // honeypot
    const live = sourceName() !== 'sample';
    if (limited('f25:' + req.ip, parseInt(env('FIRST25_PER_IP', live ? '6' : '40'), 10))) {
      return res.status(429).json({ error: "You've run a few searches today. Come back tomorrow, or open the list we emailed you." });
    }
    if (live && limited('f25:all', parseInt(env('FIRST25_DAILY_CAP', '150'), 10))) {
      return res.status(503).json({ error: 'First 25 is at capacity for today. Try again tomorrow.' });
    }
    // Streamed so the page shows each step as it happens. no-transform keeps compression from buffering it.
    res.status(200).set({ 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
    if (res.flushHeaders) res.flushHeaders();
    const send = (o) => { res.write(JSON.stringify(o) + '\n'); if (res.flush) res.flush(); };
    try {
      const doc = await run({
        pack: String(b.pack || ''), buyer: String(b.buyer || ''), place,
        me: String(b.me || '').trim().slice(0, 40), service: String(b.service || '').trim().slice(0, 60),
        utm: b.utm && typeof b.utm === 'object' ? Object.fromEntries(Object.entries(b.utm).slice(0, 12).map(([k, v]) => [String(k).slice(0, 30), String(v).slice(0, 120)])) : {},
      }, (p) => send({ type: 'progress', ...p }));
      require('./integrations').emit('first25.run', { id: doc.id, pack: doc.pack, buyer: doc.buyer, source: doc.source, found: doc.stats.found, kept: doc.prospects.length });
      send({ type: 'result', run: view(doc) });
    } catch (e) {
      console.warn('[first25] run failed', e.status || '', e.message);
      send({ type: 'error', error: e.status === 404 ? "We couldn't find that place. Try a city and state, like Des Moines, IA." : 'The search is busy right now. Try again in a minute.' });
    }
    res.end();
  });

  // The tracker: one stage per business, saved with the list so it follows them to any device.
  const STAGES = D.stages.map((s) => s.id);
  r.post('/api/first-25/r/:id/status', json, async (req, res) => {
    const b = req.body || {};
    const doc = signed(req.params.id, b.k) ? db.get('prospectRuns', req.params.id) : null;
    if (!doc) return res.status(404).json({ error: 'This list has expired.' });
    const rank = parseInt(b.rank, 10);
    if (!STAGES.includes(b.stage) || !doc.prospects.some((p) => p.rank === rank)) return res.status(400).json({ error: 'Something went wrong.' });
    if (limited('f25s:' + req.ip, 500)) return res.status(429).json({ error: 'Too many changes today. Try again tomorrow.' });
    doc.status = { ...(doc.status || {}), [rank]: { s: b.stage, at: new Date().toISOString() } };
    await db.save('prospectRuns', doc);
    res.json({ ok: true });
  });

  r.get('/first-25/r/:id.csv', (req, res) => {
    const doc = signed(req.params.id, req.query.k) ? db.get('prospectRuns', req.params.id) : null;
    if (!doc) return res.status(404).type('text').send('This list has expired. Run a new one at 127group.io/first-25');
    const v = view(doc);
    const name = `first-25-${v.buyer}-${String(v.city).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    res.set('content-type', 'text/csv; charset=utf-8').set('content-disposition', `attachment; filename="${name}"`).send('﻿' + E.csv(v));
  });

  return r;
}

// GET /first-25/r/:id: the page script that opens the saved list unlocked (lib/funnels.js page()).
function injectRun(req) {
  const doc = signed(req.params.id, req.query.k) ? db.get('prospectRuns', req.params.id) : null;
  const j = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return `<script>window.F25_RUN=${doc ? j({ ...view(doc), unlocked: true }) : 'null'};</script>\n`;
}

// Lists are deleted after FIRST25_KEEP_DAYS (30): they hold business listings, not member data.
async function prune() {
  const keep = parseInt(env('FIRST25_KEEP_DAYS', '30'), 10) * 864e5;
  let all = [];
  try { all = db.all('prospectRuns'); } catch { return 0; }
  const old = all.filter((d) => Date.now() - new Date(d.createdAt).getTime() > keep);
  for (const d of old) await db.remove('prospectRuns', d.id);
  return old.length;
}
setTimeout(() => prune().catch(() => {}), 60e3).unref();
setInterval(() => prune().catch(() => {}), 12 * 3600e3).unref();

module.exports = { router, run, view, emailText, injectRun, sign, signed, prune, sourceName, _test: { fromGoogle, fromOsm, overpassFilter, listCache } };
