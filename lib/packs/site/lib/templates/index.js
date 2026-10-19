// The designs in this version. Each module: { id, name, bestFor, theme, slots(c), nav(c), render(c, kit) }.
// render returns { body, css }; lib/page.js wraps them in a full HTML document.

const IDS = ['local-service', 'studio', 'restaurant', 'coach', 'portfolio'];
const MODULES = IDS.map((n) => require(`./${n}`));

const TEMPLATES = MODULES.map((m) => ({ id: m.id, name: m.name, bestFor: m.bestFor }));
const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

function getTemplate(id) {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`There's no design called ${id}.`);
  return t;
}

module.exports = { TEMPLATES, getTemplate, MODULES };
