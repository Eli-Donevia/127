// Loads a household pack's facts from its data/ folder: niche.json (crowd card, partners, offers,
// texts, checklist, objections, rules, quote fields, specials) and prices.json (the kit quote price
// model, every range with its sources). A new household niche is these two files plus sample data;
// the code in packs/_kit/home is the same for every household pack.

const fs = require('fs');
const path = require('path');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${path.basename(file)}: ${e.message}`);
  }
}

// dir: the pack folder. Returns { id, dir, niche, prices, sample: { partners } }.
function load(dir) {
  const niche = readJson(path.join(dir, 'data', 'niche.json'));
  const prices = readJson(path.join(dir, 'data', 'prices.json'));
  const partners = readJson(path.join(dir, 'sample', 'partners.json'), null);
  const cfg = { id: niche.id, dir, niche, prices, sample: { partners } };
  const missing = ['crowd', 'what', 'partners', 'lead_offers', 'ladder', 'texts', 'quote', 'job_checklist'].filter((k) => niche[k] == null);
  if (missing.length) throw new Error(`data/niche.json is missing ${missing.join(', ')}`);
  return cfg;
}

// A package, add-on or plan from the price model by id.
const pkg = (cfg, id) => (cfg.prices.packages || []).find((p) => p.id === id) || null;
const addon = (cfg, id) => (cfg.prices.addons || []).find((a) => a.id === id) || null;
const plan = (cfg, id) => (cfg.prices.plans || []).find((p) => p.id === id) || null;

module.exports = { load, readJson, pkg, addon, plan };
