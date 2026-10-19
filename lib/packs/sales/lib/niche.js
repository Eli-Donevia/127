// Which kind of business the member runs, and the curated sales copy for it (data/niches.json):
// what buyers want, what they tried, what's included, when to ask for referrals. The niche's own
// fields win over its archetype's. Pure: no ctx.

const data = require('../data/niches.json');
const { fill } = require('../../_kit').text;

const FIELDS = [
  ['niche', 3],
  ['what', 2],
  ['offer', 1],
];

// Best niche for the member's words. Each field that mentions a niche's match term adds its weight;
// ties go to the term that shows up first in the text, then to the niche listed first.
function matchNiche({ niche, what, offer } = {}) {
  const fields = { niche, what, offer };
  let best = null;
  data.niches.forEach((n, order) => {
    let score = 0;
    let pos = Infinity;
    for (const [key, weight] of FIELDS) {
      const t = String(fields[key] || '').toLowerCase();
      if (!t) continue;
      let hit = Infinity;
      for (const m of n.match) {
        const i = t.indexOf(m);
        if (i >= 0 && i < hit) hit = i;
      }
      if (hit < Infinity) {
        score += weight;
        pos = Math.min(pos, (3 - weight) * 10000 + hit);
      }
    }
    if (!score) return;
    if (!best || score > best.score || (score === best.score && (pos < best.pos || (pos === best.pos && order < best.order)))) best = { n, score, pos, order };
  });
  return best ? best.n : null;
}

function profileFor(words = {}) {
  const n = matchNiche(words);
  const arch = (n && n.archetype) || 'general';
  const base = data.archetypes[arch] || data.archetypes.general;
  const own = {};
  if (n) for (const [k, v] of Object.entries(n)) if (!['id', 'archetype', 'match'].includes(k)) own[k] = v;
  const p = JSON.parse(JSON.stringify({ ...base, ...own }));
  p.id = n ? n.id : 'general';
  p.arch = arch;
  p.b2b = arch === 'b2b' || p.buyer === 'brand';
  return p;
}

// Fills {effort}, {job} and friends in every string of a profile (or any value).
function fillDeep(v, vars) {
  if (typeof v === 'string') return /\{\w+\}/.test(v) ? fill(v, vars) : v;
  if (Array.isArray(v)) return v.map((x) => fillDeep(x, vars));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x, vars)]));
  return v;
}

module.exports = { matchNiche, profileFor, fillDeep, NICHES: data.niches, ARCHETYPES: data.archetypes };
