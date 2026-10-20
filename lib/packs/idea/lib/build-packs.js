// Builds data/packs.json for the idea finder: every business pack in the library that has a
// data/niche.json (except this one), with its title, first workflow, held flag and crowd card, joined
// to the hand-written fit facts in data/fit.json. Run it after a business pack is added or changed:
//
//   node packs/idea/lib/build-packs.js
//
// The idea tests rebuild it in memory and fail when the saved file is out of date.

const fs = require('fs');
const path = require('path');

const PACKS = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'data', 'packs.json');
const FIT = require('../data/fit.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Title, first workflow and held flag from the pack itself, read only here (never at run time).
function packFacts(id) {
  try {
    const p = require(path.join(PACKS, id));
    return { title: p.title, first: p.workflows && p.workflows[0] ? p.workflows[0].id : `${id}.first_25`, held: p.held === true, business: p.business === true };
  } catch {
    return null;
  }
}

function build() {
  const ids = fs.readdirSync(PACKS).filter((d) => !d.startsWith('_') && d !== 'idea' && fs.existsSync(path.join(PACKS, d, 'data', 'niche.json'))).sort();
  const packs = [];
  for (const id of ids) {
    const n = readJson(path.join(PACKS, id, 'data', 'niche.json'));
    const facts = packFacts(id);
    if (!n || !n.crowd || !facts) continue;
    const c = n.crowd;
    const fit = FIT.packs[id];
    packs.push({
      id,
      title: facts.title || n.name || id,
      first: facts.first,
      held: facts.held,
      crowd: { buyer: c.buyer || null, scores: c.scores || {}, first_dollar: c.first_dollar || null, best_months: c.best_months || [], off_season: c.off_season ? { months: c.off_season.months || [] } : null },
      fit: fit || FIT.neutral,
      fit_from: fit ? 'fit.json' : 'neutral',
    });
  }
  return { built_from: 'packs/*/data/niche.json and idea/data/fit.json by idea/lib/build-packs.js', count: packs.length, packs };
}

const text = (data) => `${JSON.stringify(data, null, 2)}\n`;

if (require.main === module) {
  const data = build();
  fs.writeFileSync(OUT, text(data));
  const neutral = data.packs.filter((p) => p.fit_from === 'neutral').map((p) => p.id);
  console.log(`Wrote ${data.count} packs to ${path.relative(process.cwd(), OUT)}.${neutral.length ? ` No fit row yet (neutral): ${neutral.join(', ')}.` : ''}`);
}

module.exports = { build, text, OUT };
