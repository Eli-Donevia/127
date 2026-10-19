// Which apps and pixels a Shopify store runs, read from its public HTML. We match app patterns only
// against the technical parts of a page (URLs, script and link sources, class and id names, inline
// scripts, the web pixel list), never its sales copy, so a product called "Corso" doesn't count as an app.
// Detection can miss an app that loads late, so reports say "we didn't see", never "they don't have".

const DATA = require('../data/apps.json');

const COMPILED = Object.fromEntries(
  Object.entries(DATA.categories).map(([k, v]) => [k, { label: v.label, apps: v.apps.map(([name, re]) => [name, new RegExp(re, 'i')]) }])
);
const PIXELS = Object.fromEntries(Object.entries(DATA.pixels).map(([k, re]) => [k, new RegExp(re, 'i')]));

// The technical text of a page: URLs, src/href values, class and id names, inline scripts (minus
// JSON-LD, which carries product copy).
function haystack(html) {
  const s = String(html || '');
  const parts = [];
  for (const m of s.match(/https?:\\?\/\\?\/[^\s"'<>)]+/gi) || []) parts.push(m.replace(/\\\//g, '/'));
  for (const m of s.match(/\b(?:src|href|data-src)\s*=\s*["'][^"']+["']/gi) || []) parts.push(m);
  for (const m of s.match(/\b(?:class|id)\s*=\s*["'][^"']{1,300}["']/gi) || []) parts.push(m);
  for (const m of s.match(/<script\b(?![^>]*ld\+json)[^>]*>[\s\S]*?<\/script>/gi) || []) parts.push(m.slice(0, 20000));
  for (const m of s.match(/<svg\b[^>]*aria-labelledby=["']pi-[a-z_]+["']/gi) || []) parts.push(m);
  return parts.join('\n');
}

// { reviews: ['Judge.me'], email: ['Klaviyo'], ... } plus pixels { meta, tiktok, google, pinterest }.
function detectApps(htmls) {
  const hay = (Array.isArray(htmls) ? htmls : [htmls]).map(haystack).join('\n');
  const apps = {};
  for (const [k, v] of Object.entries(COMPILED)) apps[k] = v.apps.filter(([, re]) => re.test(hay)).map(([n]) => n);
  const pixels = Object.fromEntries(Object.entries(PIXELS).map(([k, re]) => [k, re.test(hay)]));
  return { apps, pixels };
}

// A footer or popup email form that isn't an app: Shopify's own newsletter form posts to /contact
// with contact[tags]=newsletter, or any email input.
function hasEmailForm(html) {
  const s = String(html || '');
  return /contact\[tags\][^>]*newsletter|name=["']contact\[email\]["']|<input[^>]+type=["']email["']/i.test(s);
}

// Shopify.theme = {"name":"Dawn","schema_name":"Dawn","schema_version":"15.0.0","theme_store_id":887,...}
function themeOf(html) {
  const m = String(html || '').match(/Shopify\.theme\s*=\s*(\{[^;]*?\})\s*;/);
  if (!m) return null;
  try {
    const t = JSON.parse(m[1]);
    return { name: t.schema_name || t.name || null, version: t.schema_version || null, storeId: t.theme_store_id || null, custom: !t.theme_store_id };
  } catch {
    const name = (m[1].match(/"schema_name"\s*:\s*"([^"]+)"/) || [])[1];
    const version = (m[1].match(/"schema_version"\s*:\s*"([^"]+)"/) || [])[1];
    return name ? { name, version: version || null, storeId: null, custom: null } : null;
  }
}

function labelOf(cat) {
  return (DATA.categories[cat] && DATA.categories[cat].label) || cat;
}

module.exports = { detectApps, hasEmailForm, themeOf, haystack, labelOf, CATEGORIES: Object.keys(DATA.categories) };
