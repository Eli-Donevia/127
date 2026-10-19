// Fills the niche's message templates (data/niche.json "texts") with the member's real facts.
// Templates use {name} slots; a slot with no value disappears and the sentence is tidied, so a
// missing phone number never leaves "Call me at ." behind. Shared household spine.

const { text, money } = require('..');

function tidy(s) {
  return text
    .plain(String(s || ''))
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.!?:;])/g, '$1')
    .replace(/([,:;])\s*([.!?])/g, '$2')
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/ {2,}/g, ' ')
    .replace(/^\s*[,.]\s*/, '')
    .trim();
}

// fill('Hi {greet}, {lead} for {founding}.', vars)
function fill(template, vars = {}) {
  const t = Array.isArray(template) ? template.join('\n') : String(template || '');
  return tidy(t.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null || vars[k] === false ? '' : String(vars[k]))));
}

// Pick one of several templates, stable for the same seed.
function pick(templates, seed) {
  if (!Array.isArray(templates)) return templates;
  return text.pickBy(seed, templates);
}

const usd = (n) => (n == null || n === '' ? '' : money.usd(n));

// "$165 instead of $255"
function foundingText(founding, price) {
  if (founding && price && founding < price) return `${usd(founding)} instead of ${usd(price)}`;
  return usd(founding || price);
}

// The member's own name for the business, or a plain stand-in from their first name.
function businessName(b, cfg) {
  if (b.name) return b.name;
  const first = b.firstName ? `${b.firstName}'s ` : '';
  return text.titleCase(`${first}${cfg.niche.business_word || cfg.niche.name}`).replace(/'S\b/, "'s");
}

// The words every template can use, from the brain, the offer and the input.
function baseVars(cfg, b, extra = {}) {
  return {
    first: b.firstName || '',
    business: businessName(b, cfg),
    what: cfg.niche.what,
    area: b.city || 'town',
    worker: cfg.niche.worker || '',
    job: cfg.niche.job || 'job',
    ...extra,
  };
}

// Phone numbers as people type them, kept readable: "5155550142" -> "515-555-0142".
function phoneText(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  return String(p || '').trim();
}

// A list of strings checked against the copy rules; returns the problems (empty when clean).
function problems(strings) {
  const out = [];
  for (const s of strings) for (const p of text.copyProblems(s)) out.push(`${p}: ${String(s).slice(0, 60)}`);
  return out;
}

module.exports = { fill, pick, tidy, usd, foundingText, businessName, baseVars, phoneText, problems };
