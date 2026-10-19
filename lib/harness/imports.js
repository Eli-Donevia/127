// Bring outside lists into the member's Pipeline. First: First 25 (Funnels v2, lib/first25.js), so
// "Work your 25 in HQ" lands every business with its messages already written, the facts they cite,
// and the stage from the list's tracker. Importing the same list twice updates the same leads and
// never moves one backwards.
//
// A Google-sourced list brings in place IDs and 127's own work only (Legal L53): no names, websites,
// phones or addresses. HQ fetches the name again when the lead is on screen (lib/harness/places.js).

const crypto = require('crypto');
// first25Data: the First 25 copy file (what each pack sells, who each buyer is), when it's installed.
const deps = { db: require('../db'), first25: () => require('../first25'), first25Data: () => require('../../public/funnels/first25-data.js') };
const pipeline = require('./pipeline');
const places = require('./places');
const brain = require('./brain');
const activation = require('./activation');

const STAGES = new Set(pipeline.STAGES);
const VISUAL = new Set(['video', 'social', 'photo']);
const MAX = 50;

const keyOf = (v, b) => `${v.buyer}:${crypto.createHash('sha256').update(`${String(b.name).toLowerCase()}|${String(v.city).toLowerCase()}`).digest('base64url').slice(0, 16)}`;
const realSite = (u) => (u && /^https?:\/\//i.test(u) && !/\.example(\/|$)/i.test(u) ? u : null);

// One First 25 list (as first25.view() returns it) as Pipeline leads.
function first25Leads(v) {
  const google = v.source === 'google';
  return (v.prospects || []).slice(0, MAX).map((b) => {
    const so = (b.site && b.site.socials) || {};
    const ig = b.instagram || so.instagram;
    const fb = so.facebook && so.facebook !== 'page' ? so.facebook : null;
    const placeId = google ? places.idOf({ placeId: b.id }) : '';
    const links = {
      website: google ? null : realSite(b.website),
      instagram: ig ? `https://www.instagram.com/${String(ig).replace(/^@/, '')}` : null,
      facebook: fb ? `https://www.facebook.com/${fb}` : null,
      maps: google ? null : b.mapsUrl || null,
      email: b.email || null,
      phone: google || v.sample ? null : b.phone || null,
    };
    const st = (v.status || {})[b.rank];
    const m = b.msg || {};
    return {
      key: placeId ? `gplaces:${placeId}` : keyOf(v, b),
      name: placeId ? '' : b.name,
      ...(placeId ? { placeId } : {}),
      source: 'First 25',
      stage: st && STAGES.has(st.s) ? st.s : 'found',
      sentAt: st && st.s !== 'found' ? st.at : null,
      score: b.score,
      facts: (b.gaps || []).map((g) => g.why).filter(Boolean),
      channel: ig && (VISUAL.has(v.pack) || !links.email) ? 'ig' : links.email ? 'email' : fb ? 'fb' : links.website ? 'site' : links.phone ? 'call' : undefined,
      links,
      msg: { dm: m.dm, subject: m.subject, email: m.email, walkin: m.walkin, follow1: m.follow1, follow2: m.follow2 },
      data: { list: v.id, rank: b.rank, sample: !!v.sample, city: v.city, buyer: v.buyer, pack: v.pack },
    };
  });
}

// What the member sells and to whom, in First 25's own words ("Short videos", "gyms").
function soldBy(v) {
  try {
    const D = deps.first25Data();
    const p = D && D.packs && D.packs[v.pack];
    const b = D && D.buyers && D.buyers[v.buyer];
    const sell = p && v.pack !== 'other' && p.label ? p.label : '';
    return { sell, buyers: b && b.many ? b.many : '' };
  } catch {
    return { sell: '', buyers: '' };
  }
}

// The saved list behind a First 25 link, or null (expired, bad key, or First 25 isn't installed).
function first25List(id, k, firstName) {
  let f25;
  try {
    f25 = deps.first25();
  } catch {
    return null;
  }
  if (!f25 || typeof f25.signed !== 'function' || !f25.signed(String(id), String(k || ''))) return null;
  const doc = deps.db.get('prospectRuns', String(id));
  return doc ? f25.view(doc, firstName) : null;
}

// What the confirm screen shows before anything is saved.
function first25Preview(user, id, k) {
  const v = first25List(id, k, brain.firstName(user));
  if (!v) return null;
  const google = v.source === 'google';
  return { id: v.id, k, city: v.city, place: v.place, buyer: v.buyer, pack: v.pack, sample: !!v.sample, google, count: Math.min(MAX, (v.prospects || []).length), top: google ? [] : (v.prospects || []).slice(0, 3).map((b) => b.name) };
}

const haveKeys = (user) => new Set(pipeline.list(user.id, { pack: 'first25', limit: 5000 }).map((l) => l.key));

// Upsert the leads, then fill Your business from the list: what they sell, to whom and where (never
// over what the member wrote). Returns how many leads are new.
async function bringIn(user, leads, v) {
  const had = haveKeys(user);
  let added = 0;
  for (const lead of leads) {
    await pipeline.upsert(user.id, 'first25', lead);
    if (!had.has(lead.key)) added += 1;
  }
  const b = brain.snapshot(user).business;
  const fill = {};
  if (v.city && !b.city) fill.city = v.city;
  const what = soldBy(v);
  if (what.sell && !b.what) fill.what = what.sell;
  if (what.buyers && !b.audience) fill.audience = what.buyers;
  const snap = Object.keys(fill).length ? await brain.update(user, { business: fill }) : brain.snapshot(user);
  await activation.business(user.id, snap);
  await activation.mark(user.id, 'a2');
  return added;
}

async function importFirst25(user, id, k) {
  const v = first25List(id, k, brain.firstName(user));
  if (!v) return null;
  const leads = first25Leads(v);
  const added = await bringIn(user, leads, v);
  return { added, updated: leads.length - added, city: v.city, sample: !!v.sample };
}

// ---------- the member's own list, found by their email ----------
// Funnels' first25.leadsFor(email) returns the newest list a member ran with their email as Pipeline
// rows: { key, company, stage, links { website, instagram, map, phone }, note, data { list, rank,
// score, city, pack, buyer, sample, gaps (ids), messages { dm, subject, email, walkin, day3, day7 } } }.
// When the list behind them is still saved, it's read instead (richer). Lists are deleted 30 days
// after the search, so Today offers it in one tap. Sample lists are left out. Leads get the same keys
// as the link import, so nothing doubles up.

function igUrl(v) {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://www.instagram.com/${String(v).replace(/^@/, '')}`;
}

function fromRow(r) {
  const d = r.data || {};
  const m = d.messages || {};
  const L = r.links || {};
  // A Google row (Legal L53) has an empty company and its place ID in data.place_id.
  const placeId = places.idOf({ placeId: d.place_id });
  const name = placeId ? '' : String(r.company || r.name || '').slice(0, 120);
  const links = placeId
    ? { instagram: igUrl(L.instagram), email: L.email || null }
    : { website: realSite(L.website), instagram: igUrl(L.instagram), maps: L.map || L.maps || null, email: L.email || null, phone: L.phone || null };
  // Gaps arrive as reasons ({ why }) or as bare ids ("no-reels"); only sentences become facts.
  const facts = (d.gaps || []).map((g) => (g && typeof g === 'object' ? g.why : g)).filter((x) => typeof x === 'string' && /\s/.test(x.trim()));
  return {
    key: placeId ? `gplaces:${placeId}` : d.buyer && d.city && name ? keyOf({ buyer: d.buyer, city: d.city }, { name }) : String(r.key || '').slice(0, 200),
    name,
    ...(placeId ? { placeId } : {}),
    source: 'First 25',
    stage: STAGES.has(r.stage) ? r.stage : 'found',
    sentAt: r.sentAt || null,
    score: d.score,
    facts: facts.length ? facts : r.note ? [String(r.note)] : [],
    channel: links.instagram && (VISUAL.has(d.pack) || !links.email) ? 'ig' : links.email ? 'email' : links.website ? 'site' : links.phone ? 'call' : undefined,
    links,
    msg: { dm: m.dm, subject: m.subject, email: m.email, walkin: m.walkin, follow1: m.day3 || m.follow1, follow2: m.day7 || m.follow2 },
    data: { list: d.list || null, rank: d.rank, sample: false, city: d.city, buyer: d.buyer, pack: d.pack },
  };
}

// The saved list behind the rows, when it's still there: it has every gap's reason, the Facebook and
// email links, and when each tracker stage was set (the rows carry gap ids and stages only).
function listBehind(f25, rows, firstName) {
  const id = rows[0] && rows[0].data && rows[0].data.list;
  if (!id || typeof f25.view !== 'function') return null;
  const doc = deps.db.get('prospectRuns', String(id));
  if (!doc || doc.sample) return null;
  try {
    return f25.view(doc, firstName);
  } catch (err) {
    console.warn('[harness] First 25 list view failed:', err.message);
    return null;
  }
}

// { count, fresh, city, leads } for the member's own list, or null (none, sample only, or Funnels'
// leadsFor isn't installed).
async function first25Mine(user) {
  let f25;
  try {
    f25 = deps.first25();
  } catch {
    return null;
  }
  if (!f25 || typeof f25.leadsFor !== 'function' || !user || !user.email) return null;
  let rows;
  try {
    rows = await f25.leadsFor(user.email);
  } catch (err) {
    console.warn('[harness] First 25 lookup failed:', err.message);
    return null;
  }
  rows = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object' && !(r.data && r.data.sample)).slice(0, MAX);
  if (!rows.length) return null;
  const v = listBehind(f25, rows, brain.firstName(user));
  const leads = (v ? first25Leads(v) : rows.map(fromRow)).filter((l) => l.key && (l.name || l.placeId));
  if (!leads.length) return null;
  const had = haveKeys(user);
  const d = v || rows[0].data || {};
  return { count: leads.length, fresh: leads.filter((l) => !had.has(l.key)).length, city: d.city || '', pack: d.pack, buyer: d.buyer, leads };
}

async function importFirst25Mine(user) {
  const mine = await first25Mine(user);
  if (!mine) return null;
  const added = await bringIn(user, mine.leads, mine);
  return { added, updated: mine.leads.length - added, city: mine.city };
}

function _setDeps(over) {
  Object.assign(deps, over);
}

module.exports = { first25Leads, first25Preview, importFirst25, first25Mine, importFirst25Mine, _setDeps };
