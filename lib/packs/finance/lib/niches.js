// Business types and their sourced startup costs.
//
// Startup costs come from research/niches/<type>.json (sourced, dated) when the library folder has
// it, else from this pack's snapshot in data/niches.json (the site ships the pack folder, not the
// research folder). Refresh the snapshot after research adds a niche:
//   node packs/finance/lib/niches.js --sync
// When a type has neither, the budget uses the member's own items plus a list of things to price.

const fs = require('fs');
const path = require('path');
const TYPES = require('../data/types.json');

const RESEARCH_DIR = path.join(__dirname, '..', '..', '..', 'research', 'niches');
const SNAPSHOT = path.join(__dirname, '..', 'data', 'niches.json');

// "mobile car detailing" -> the detailing type. Longest keyword wins ("window cleaning" is washing).
function matchType(...texts) {
  const s = ` ${texts.filter(Boolean).join(' ').toLowerCase()} `;
  if (!s.trim()) return null;
  let best = null;
  for (const t of TYPES.types) {
    for (const k of [` ${t.id} `, ...t.match]) {
      if (s.includes(k) && (!best || k.trim().length > best.len)) best = { type: t, len: k.trim().length };
    }
  }
  return best ? best.type : null;
}

function typeById(id) {
  return TYPES.types.find((t) => t.id === id) || null;
}

function rangeOf(it) {
  const r = it.range_usd || it.range || {};
  const low = Number.isFinite(Number(r.low)) && r.low !== null ? Number(r.low) : null;
  const high = Number.isFinite(Number(r.high)) && r.high !== null ? Number(r.high) : low;
  return { low, high };
}

function freqOf(unit) {
  const u = String(unit || '').toLowerCase();
  if (/payment|per sale|percent|transaction/.test(u)) return 'payment';
  if (/month/.test(u)) return 'month';
  if (/year|annual/.test(u) && !/one time or yearly/.test(u)) return 'year';
  return 'once';
}

// A research file -> the small shape this pack uses.
function normalize(j) {
  if (!j || !j.starter_costs) return null;
  const items = [];
  for (const group of ['one_time', 'recurring']) {
    for (const it of j.starter_costs[group] || []) {
      if (!it || !it.item) continue;
      const { low, high } = rangeOf(it);
      items.push({
        item: String(it.item),
        unit: String(it.unit || ''),
        freq: freqOf(it.unit),
        low,
        high,
        note: it.note ? String(it.note) : '',
        sources: (it.sources || [])
          .filter((s) => s && /^https:\/\//.test(String(s.url || '')))
          .map((s) => ({ publisher: String(s.publisher || ''), url: String(s.url), checked: String(s.checked || j.checked || '') }))
          .slice(0, 4),
      });
    }
  }
  const crowd = j.crowd || {};
  return {
    id: String(j.id),
    name: String(j.name || j.id),
    checked: String(j.checked || ''),
    items,
    bestMonths: Array.isArray(crowd.best_months) ? crowd.best_months : [],
    offSeason: crowd.off_season && Array.isArray(crowd.off_season.months) ? { months: crowd.off_season.months, where: crowd.off_season.where || '' } : null,
    notYet: Array.isArray(crowd.not_yet) ? crowd.not_yet.map(String).slice(0, 3) : [],
  };
}

let snapshotCache = null;
function snapshot() {
  if (!snapshotCache) {
    try {
      snapshotCache = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    } catch {
      snapshotCache = { niches: {} };
    }
  }
  return snapshotCache;
}

// Sourced startup costs for a type id, or null. { id, name, checked, items, bestMonths, offSeason, notYet, from }
function load(id) {
  if (!id || !/^[a-z0-9-]+$/.test(id)) return null;
  const file = path.join(RESEARCH_DIR, `${id}.json`);
  try {
    if (fs.existsSync(file)) {
      const n = normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
      if (n && n.items.length) return { ...n, from: 'research' };
    }
  } catch {
    /* a file mid-write: fall back to the snapshot */
  }
  const s = snapshot().niches[id];
  return s ? { ...s, from: 'snapshot' } : null;
}

// Writes data/niches.json from every research file (dev only).
function sync() {
  const out = { about: 'Snapshot of research/niches starter costs for the money desk. Rebuild with: node packs/finance/lib/niches.js --sync', synced: new Date().toISOString().slice(0, 10), niches: {} };
  if (fs.existsSync(RESEARCH_DIR)) {
    for (const f of fs.readdirSync(RESEARCH_DIR).sort()) {
      if (!f.endsWith('.json')) continue;
      try {
        const n = normalize(JSON.parse(fs.readFileSync(path.join(RESEARCH_DIR, f), 'utf8')));
        if (n && n.items.length) out.niches[n.id] = n;
      } catch (e) {
        console.warn(`skipped ${f}: ${e.message}`);
      }
    }
  }
  fs.writeFileSync(SNAPSHOT, `${JSON.stringify(out, null, 1)}\n`);
  snapshotCache = null;
  return Object.keys(out.niches);
}

if (require.main === module && process.argv.includes('--sync')) {
  console.log(`Synced: ${sync().join(', ') || 'none'}`);
}

module.exports = { TYPES, matchType, typeById, load, normalize, sync, freqOf, RESEARCH_DIR };
