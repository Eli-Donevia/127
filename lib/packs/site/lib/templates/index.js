// The designs in this version. Each module: { id, name, bestFor, theme, slots(c), nav(c), render(c, kit) }.
// render returns { body, css }; lib/page.js wraps them in a full HTML document.

const IDS = ['local-service', 'studio', 'restaurant', 'coach', 'portfolio'];
// The animated designs (W6, lib/motion.js) join only with SITE_MOTION=on. Each also names its kind: one of the 8 ids
// lib/pick.js knows, which picks its words, buttons and sections.
const MOTION = require('./motion');
const MODULES = IDS.map((n) => require(`./${n}`)).concat(process.env.SITE_MOTION === 'on' ? MOTION : []);

const TEMPLATES = MODULES.map((m) => ({ id: m.id, name: m.name, bestFor: m.bestFor, kind: m.kind || m.id, ...(m.kind ? { animated: true, why: m.why } : {}) }));
const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

function getTemplate(id) {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`There's no design called ${id}.`);
  return t;
}

module.exports = { TEMPLATES, getTemplate, MODULES };
