// Plain-text rules for anything a member reads (harness contract 3; voice guide 5, 7 and 15):
// no em or en dashes, no markdown emphasis, single spaces, no emoji. Plus the small string helpers
// every pack uses. No dependencies.

const DASHES = /\s*[—–]\s*/g;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{FE0F}]/gu;

// What a member reads. Dashes become commas, markdown emphasis and headings go, spaces collapse.
function plain(s) {
  return String(s == null ? '' : s)
    .replace(DASHES, ', ')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(EMOJI, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ ,/g, ',')
    .replace(/,\s*,/g, ',')
    .trim();
}

// plain() on every string inside an object or array (AI output, sample data).
function deepPlain(v) {
  if (typeof v === 'string') return plain(v);
  if (Array.isArray(v)) return v.map(deepPlain);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = deepPlain(x);
    return out;
  }
  return v;
}

// One line, at most n characters, cut on a word boundary.
function clip(s, n) {
  const t = oneLine(s);
  if (t.length <= n) return t;
  const cut = t.slice(0, Math.max(0, n - 3));
  const sp = cut.lastIndexOf(' ');
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:]+$/, '')}...`;
}

function oneLine(s) {
  return plain(s).replace(/\s*\n+\s*/g, ' ').trim();
}

// "a", "a and b", "a, b and c"
function list(items, conj = 'and') {
  const a = (items || []).map((x) => String(x).trim()).filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} ${conj} ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} ${conj} ${a[a.length - 1]}`;
}

function slug(s, max = 60) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

function titleCase(s) {
  const small = new Set(['a', 'an', 'and', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  return String(s || '')
    .toLowerCase()
    .split(/(\s+)/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

// "make today day one" -> "Make today day one"
function sentenceCase(s) {
  const t = String(s || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function initials(name, n = 2) {
  const words = String(name || '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|and|of|co|llc|inc)$/i.test(w));
  return (words.length ? words : [String(name || '?')])
    .slice(0, n)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || '';
}

// "Hi {first}" with {first} from vars; unknown keys become empty strings, then spaces are tidied.
function fill(template, vars = {}) {
  return plain(
    String(template || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])))
  );
}

// Deterministic pick from a list, so the same input always gives the same draft (tests stay stable)
// while different businesses get different wording.
function pickBy(seed, items) {
  if (!items || !items.length) return undefined;
  let h = 2166136261;
  for (const ch of String(seed || '')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return items[Math.abs(h) % items.length];
}

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s || '')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Copy checks from the voice guide (section 5 "Words", section 15) and contract section 3.
// Returns a list of problems; empty means it passes. Used by dev/lint.js on every pack and every
// sample output, and by tools that want to double-check AI text before returning it.
const BANNED = [
  [/\bhustl(e|ing|er)\b/i, 'hustle'],
  [/\bgrind(ing)?\b/i, 'grind'],
  [/\bcrush(ing)? it\b/i, 'crush it'],
  [/\bpassive income\b/i, 'passive income'],
  [/\bfinancial freedom\b/i, 'financial freedom'],
  [/\bget rich\b/i, 'get rich'],
  [/\bsix[- ]figure/i, 'six figures'],
  [/\bseven[- ]figure/i, 'seven figures'],
  [/\bguru\b/i, 'guru'],
  [/\bboss ?(babe|up)\b/i, 'boss babe'],
  [/\balpha\b/i, 'alpha'],
  [/\bhigh[- ]value (man|woman)\b/i, 'high-value'],
  [/\breal men\b/i, 'real men'],
  [/\bguaranteed\b/i, 'guaranteed'],
  [/\b(growth )?hacks?\b/i, 'hack'],
  [/\bovernight (success|results)\b/i, 'overnight'],
  [/\bunlock your potential\b/i, 'unlock your potential'],
  [/\blevel up your life\b/i, 'level up your life'],
  [/\bfast-paced world\b/i, 'fast-paced world'],
  [/\bquit your job\b/i, 'quit your job'],
  // Playbook 2.2 and 2.5 (Oct 19 review): pack copy never sells outcomes the member doesn't control.
  [/\bdone[- ]for[- ]you\b/i, 'done-for-you'],
  [/\bland(ing|ed|s)? (a |an |more |your (first )?|new |\d+ )?(paying )?clients?\b/i, 'land clients'],
  [/\bready to sell\b/i, 'ready to sell'],
  [/\$\s?\d[\d,.]*\s?k?\s+value\b/i, '$X value'],
  [/\blast chance\b/i, 'last chance'],
  // Nothing in exchange for a review: Google bans any incentive for one, and the FTC (16 CFR 465)
  // bans paying for positive ones. A founding price may ask for feedback or a case study, never a review.
  [/(?<!\b(?:nothing|never|not|no|without|prohibits?|bans?|forbids?|don't|doesn't|won't|can't|cannot)\b[^.!?\n]{0,80})\b(?:in exchange for|in return for)\b[^.!?\n]{0,50}\breviews?\b/i, 'review incentive'],
  [/(?<!\b(?:nothing|never|not|no|without|prohibits?|bans?|forbids?|don't|doesn't|won't|can't|cannot)\b[^.!?\n]{0,80})(?:\b(?:discount\w*|half[- ]price|free|off|founding (?:price|rate))\b|\$\s?\d[\d,.]*)[^.!?\n]{0,60}\bfor (?:an? |your |their )?(?:honest |written |good |great |positive |google |yelp |5[- ]star |five[- ]star )*reviews?\b/i, 'review incentive'],
  [/\breviews?\b[^.!?\n]{0,40}\b(?:and|to) (?:get|receive|earn|win)\b[^.!?\n]{0,30}(?:\b(?:free|discount\w*|off|gift|entry|draw|raffle)\b|\$\s?\d)/i, 'review incentive'],
  // An earnings promise ("make $3,000 a month", "earn $500 per week"). Prices ("$600 a month for
  // 12 posts") are fine: they are what the member charges, not what anyone will earn.
  [/\b(make|making|earn|earning|bring in|bringing in|take home|clear|pull in|income of)\b[^.\n]{0,30}\$\s?\d[\d,.]*\s?k?\b[^.\n]{0,20}\b(a|per|\/|every)\s*(day|week|month|mo|year)\b/i, 'income claim'],
];

// Legal L62 (Oct 19): the FTC Business Opportunity Rule (16 CFR 437) may cover packs that find
// businesses for a member who pays, so catalog copy (titles, promises, summaries, descriptions, next
// steps) says what a tool does and never that it gets the member clients, customers or leads.
const PROMISES = [
  /\b(get|gets|getting|bring|brings|bringing|win|wins|winning|attract|attracts|attracting|generate|generates)\s+(you\s+|in\s+)?((more|new|paying|your|first|the first|\d+)\s+){0,4}(clients?|customers?|leads?|buyers?)\b/i,
  /\blead (finder|list|gen|generation)\b/i,
  /\b(calendar|schedule) (is |gets )?full\b|\bfill(s|ing)? (up )?your (calendar|schedule|books)\b|\bfully booked\b/i,
];
const promiseProblems = (s) => (PROMISES.some((re) => re.test(String(s == null ? '' : s))) ? ['a promise of clients or leads (L62)'] : []);

function copyProblems(s) {
  const t = String(s == null ? '' : s);
  const out = [];
  if (/[—–]/.test(t)) out.push('em or en dash');
  if (/\*\*[^*]+\*\*|__[^_]+__/.test(t)) out.push('markdown emphasis');
  if (EMOJI.test(t)) out.push('emoji');
  EMOJI.lastIndex = 0;
  for (const [re, label] of BANNED) if (re.test(t) && !out.includes(`"${label}"`)) out.push(`"${label}"`);
  return out;
}

// "a detail", "an order", "an hour", "a UGC video", "an SEO audit", "an 8 week plan", "a unit"
function aOrAn(word) {
  const w = String(word || '').trim();
  if (/^(uni|use|usu|uti|ur[aeiou]|eu|one\b|once\b)/i.test(w)) return 'a';
  if (/^(hour|honest|honor|heir)/i.test(w)) return 'an';
  if (/^[A-Z]{2,}\b/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a';
  if (/^\$?(8|11|18)(\b|\d{2}(?!\d)|[.,%])/.test(w) || /^\$?8\d/.test(w)) return 'an';
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}
const withA = (word) => `${aOrAn(word)} ${String(word || '').trim()}`;

module.exports = {
  plain,
  deepPlain,
  aOrAn,
  withA,
  clip,
  oneLine,
  list,
  slug,
  titleCase,
  sentenceCase,
  initials,
  plural,
  firstName,
  fill,
  pickBy,
  hash,
  copyProblems,
  promiseProblems,
  BANNED,
};
