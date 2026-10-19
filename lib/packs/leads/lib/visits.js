// Businesses to call or walk into: the member's Pipeline first (what earlier lists saved: phone,
// address, map position, hours, facts and the call script), then fresh OpenStreetMap businesses when
// the Pipeline runs short (each checked on its own website, ranked for what the member sells, and
// saved to the Pipeline with what Do my day reads). Google listings keep only a place ID (Places
// terms), so they never appear on a call sheet or a route.

const { text, places, leads, outreach, web } = require('../../_kit');

const DAY = 864e5;
const OPEN = new Set(['found', 'contacted']);

// What the call sheet and walk-in route need on a saved business (export and both tools use it).
// Never for Google listings.
function visitData(l, m) {
  if (!l || l.source === 'google') return {};
  const out = {};
  if (l.address) out.address = text.clip(l.address, 160);
  if (Number.isFinite(l.lat) && Number.isFinite(l.lng)) Object.assign(out, { lat: Math.round(l.lat * 1e5) / 1e5, lng: Math.round(l.lng * 1e5) / 1e5 });
  const osm = osmIdOf(l.key);
  if (osm) out.osmId = osm;
  const hours = l.hours || (l.site && l.site.hours) || '';
  if (hours) out.hours = text.clip(text.oneLine(hours), 120);
  if (m && m.call) out.call = text.clip(m.call, 700);
  if (m && m.voicemail) out.voicemail = text.clip(m.voicemail, 600);
  return out;
}

function osmIdOf(key) {
  const m = /^osm:((node|way|relation)\/\d+)$/.exec(String(key || ''));
  return m ? m[1] : null;
}

const isGoogleRow = (row) => String(row.key || '').startsWith('gplaces:') || !!row.placeId || !!(row.data && (row.data.place_id || row.data.from === 'google'));

// A Pipeline row that's a business from a list (not a person the member knows, not a Google listing).
function isBusinessRow(row) {
  if (!row || !row.key || row.warm) return false;
  if (/^person:/.test(String(row.key))) return false;
  return !isGoogleRow(row);
}

// Rebuilds a lead from a Pipeline row, enough for kit outreach.draft (facts become website gaps again).
function leadOf(row) {
  const d = row.data || {};
  const links = row.links || {};
  const c = d.category ? places.categoryOf(d.category) : null;
  const gaps = (d.facts || [])
    .map((f) => (f && f.id && leads.GAPS[f.id] ? { id: f.id, ...leads.GAPS[f.id] } : null))
    .filter(Boolean);
  const key = String(row.key);
  return {
    key,
    source: d.from || (key.startsWith('osm:') ? 'osm' : key.startsWith('sample:') ? 'sample' : 'web'),
    sample: !!d.sample || key.startsWith('sample:'),
    name: row.name || row.company || 'Business',
    siteName: row.name || row.company || '',
    website: links.website || null,
    phone: links.phone || null,
    address: d.address || '',
    lat: Number.isFinite(d.lat) ? d.lat : null,
    lng: Number.isFinite(d.lng) ? d.lng : null,
    mapsUrl: links.maps || null,
    hours: d.hours || null,
    city: d.city || '',
    category: c ? { id: c.id, one: c.one, many: c.many, what: c.what, thing: c.thing, film: c.film } : null,
    gaps,
    site: null,
    score: Number.isFinite(row.score) ? row.score : Number.isFinite(d.score) ? d.score : null,
    searchBy: d.searchBy || null,
    siteStatus: links.website ? 'ok' : 'none',
  };
}

// When a contacted business is due for a follow-up: 3 days after the first message, 4 after the
// second, none after the third (the harness Pipeline's own rule), never while snoozed.
function followUpDue(row, now) {
  if (row.stage !== 'contacted') return false;
  if ((row.touches || 1) > 2) return false;
  const snooze = Date.parse(row.snoozeUntil || '');
  if (Number.isFinite(snooze) && snooze > now) return false;
  const next = Date.parse(row.nextAt || '');
  if (Number.isFinite(next)) return next <= now;
  const last = Date.parse(row.lastTouchAt || row.sentAt || '');
  return Number.isFinite(last) ? now - last >= 3 * DAY : false;
}

async function allRows(ctx) {
  if (!ctx.leads || typeof ctx.leads.list !== 'function') return [];
  try {
    return (await ctx.leads.list({ all: true, limit: 2000 })) || [];
  } catch {
    return [];
  }
}

// Businesses from the Pipeline still in play (found, or contacted and due), in one category if given.
// Each: { row, lead, due } with due true for a follow-up.
async function pipelineBusinesses(ctx, { category, now } = {}) {
  const rows = await allRows(ctx);
  const want = category ? places.categoryOf(category) : null;
  const out = [];
  for (const row of rows) {
    if (!isBusinessRow(row) || !OPEN.has(row.stage || 'found')) continue;
    const lead = leadOf(row);
    if (want && (!lead.category || lead.category.id !== want.id)) continue;
    const due = followUpDue(row, now);
    if (row.stage === 'contacted' && !due) continue;
    out.push({ row, lead, due });
  }
  return { list: out, rows };
}

// Everyone already in the Pipeline, for skipping them in a fresh search: keys, domains and names.
function knownFrom(rows) {
  const keys = [];
  const names = new Set();
  for (const r of rows || []) {
    if (!r) continue;
    if (r.key) keys.push(String(r.key));
    const site = r.links && r.links.website;
    if (site) keys.push(web.domainOf(site));
    if (r.name) names.add(places.baseName(r.name));
  }
  return { keys, names };
}

// Runs fn over items, `limit` at a time, and stops starting new ones after the deadline.
async function pool(items, limit, fn, { deadline = Infinity } = {}) {
  const out = new Array(items.length).fill(null);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      if (Date.now() > deadline) continue;
      out[k] = await fn(items[k], k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Fresh businesses near a city (OpenStreetMap, never Google Places: these lists keep names, phones
// and addresses), minus the Pipeline, each read on its own website. want: 'phone' keeps only
// businesses with a number (from the map or their site); 'place' keeps those with a map position.
async function freshLeads(ctx, { category, city, near, need, rows, service, want = 'phone', radiusKm = 15, seconds = 70 }) {
  const cat = places.categoryOf(category);
  const where = ctx.sample || !near ? city : near;
  const r = await places.findPlaces(ctx, { category: cat, city: where, limit: Math.min(60, need * 3 + 10), radiusKm, google: false });
  const known = knownFrom(rows);
  const { kept } = places.filterPlaces(r.places, { category: cat, known: known.keys });
  let pool0 = kept.filter((p) => !known.names.has(places.baseName(p.name)));
  if (want === 'place') pool0 = pool0.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  // Numbers on the map first; a website can still show one, so those come next.
  if (want === 'phone') pool0 = pool0.filter((p) => p.phone || p.website).sort((a, b) => (b.phone ? 1 : 0) - (a.phone ? 1 : 0));
  const picked = pool0.slice(0, Math.min(40, need * 2));
  const deadline = Date.now() + seconds * 1000;
  const scanned = await pool(
    picked,
    6,
    async (p) => {
      const scan = p.website ? await leads.scanFor(ctx, p.website) : null;
      const lead = leads.makeLead(p, scan, { now: ctx.now(), category: cat, city });
      if (p.searchBy) lead.searchBy = p.searchBy;
      if (p.hours) lead.hours = text.clip(text.oneLine(p.hours), 120);
      return lead;
    },
    { deadline }
  );
  let list = scanned.map((l, i) => l || leads.makeLead(picked[i], null, { now: ctx.now(), category: cat, city }));
  if (want === 'phone') list = list.filter((l) => phoneOf(l));
  const ranked = leads.rankLeads(list, service, { top: need }).leads;
  return { leads: ranked, source: r.source, sample: !!r.sample, note: text.plain(r.note || ''), category: cat, searched: true };
}

function phoneOf(lead) {
  return (lead.site && lead.site.contacts && lead.site.contacts.phones[0]) || (lead.source !== 'google' && lead.phone) || null;
}

// Saves fresh businesses to the Pipeline the way leads.export does (D29: msg, facts, score, channel).
async function saveFresh(ctx, items, { service, channel } = {}) {
  let saved = 0;
  if (!ctx.leads || typeof ctx.leads.upsert !== 'function') return saved;
  for (const { lead, draft } of items) {
    try {
      const row = leads.pipelineLead(lead, { service, message: draft.dm, draft });
      row.data = { ...row.data, from: lead.source || null, ...(lead.searchBy ? { searchBy: lead.searchBy } : {}), ...visitData(lead, draft) };
      if (channel) row.channel = channel;
      await ctx.leads.upsert(row);
      saved++;
    } catch {
      /* one bad row doesn't stop the rest */
    }
  }
  return saved;
}

// A map link for one stop: its OpenStreetMap page, else an OpenStreetMap search for its address.
// Sample businesses get none (their addresses are made up).
function mapLinkOf(lead) {
  if (!lead || lead.sample) return null;
  const osm = osmIdOf(lead.key);
  if (osm) return `https://www.openstreetmap.org/${osm}`;
  const q = [lead.address, lead.city].filter(Boolean).join(', ');
  return q ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}` : null;
}

// OpenStreetMap opening hours in plain words: "Mo-Fr 09:00-17:00; Sa 10:00-14:00" ->
// "Mon to Fri 9:00 to 17:00; Sat 10:00 to 14:00". Anything unusual stays as written.
const DAYS = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun', PH: 'holidays' };
function hoursText(h) {
  const s = text.oneLine(h || '');
  if (!s) return '';
  if (s === '24/7') return 'Open 24 hours';
  return text.clip(
    s
      .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAYS[d])
      .replace(/\b0(\d):(\d\d)\b/g, '$1:$2')
      .replace(/(\d):(\d\d)\s*-\s*(\d)/g, '$1:$2 to $3')
      .replace(/([A-Za-z]{3})\s*-\s*([A-Za-z]{3})/g, '$1 to $2')
      .replace(/\boff\b/g, 'closed'),
    90
  );
}

// The member's own voice for the scripts: their first name, and their number for voicemails.
function personal(t, { first, phone } = {}) {
  let s = String(t || '');
  if (first) s = s.split('[your name]').join(first);
  if (phone) s = s.split('[your number]').join(phone);
  return s;
}

// One sentence to say about them, from their own website (second person), or null.
function sayFirst(lead, service) {
  const d = outreach.draft({ lead, service, sender: {} });
  return d.cites && d.cites[0] ? d.cites[0] : null;
}

module.exports = { visitData, osmIdOf, isBusinessRow, leadOf, followUpDue, pipelineBusinesses, knownFrom, freshLeads, saveFresh, phoneOf, mapLinkOf, hoursText, personal, sayFirst, pool, DAY };
