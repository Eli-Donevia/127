// Same street route for moving help: the kit's tool (packs/_kit/home/specials.js streetTool), with one
// change. The kit prints "for a studio or 1 bedroom" (the quote reference) on the door hangers whatever
// the package, but the neighbor offer here is a small job (2 movers, 2 hours), which has no home size.
// So the reference is left off unless the street package is one the home size factor prices.
// Kit change wanted: the same check inside streetTool, like the one sample.js makes for street samples.

const specials = require('../../_kit/home/specials');

function sizedStreet(cfg) {
  const N = cfg.niche;
  const S = N.same_street || {};
  const pkg = (cfg.prices.packages || []).find((p) => p.id === S.package) || (cfg.prices.packages || [])[0] || {};
  const size = (cfg.prices.factors || []).find((f) => f.id === (N.quote || {}).size_factor);
  return !!size && (!size.packages || size.packages.includes(pkg.id));
}

function streetTool(cfg) {
  const N = cfg.niche;
  if (sizedStreet(cfg)) return specials.streetTool(cfg);
  return specials.streetTool({ ...cfg, niche: { ...N, quote: { ...N.quote, reference: '' } } });
}

module.exports = { streetTool, sizedStreet };
