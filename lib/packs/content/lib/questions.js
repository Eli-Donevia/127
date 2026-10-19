// Real questions people type into Google and YouTube about the member's service, from Google's
// public autocomplete (no key, no login). Autocomplete shows what people type, not how often, so
// nothing here claims a search volume. Results are cleaned (no jobs, gear or "start a business"
// searches, no other cities) and sorted into kinds the hooks use: cost, worth, how, how often,
// compare, local and problem.

const { web, text } = require('../../_kit');

const ENDPOINT = 'https://suggestqueries.google.com/complete/search';

// Searches by people who want to DO the job or sell it, not buy it.
const SELLER = /\b(salary|salaries|jobs?|hiring|career|pay(s|ing)? (well|per hour)|how much (do|does|can)\b.{0,30}\b(make|earn)|\b(make|earn)s? (a year|an hour|per hour|per year|a month|money)|side hustle|good money|profitable|profit margin|make money|business (plan|name|cards?|license|insurance)|start(ing)? (a|an|my|your) |for beginners|as a business|business idea|course|certification|school|training|equipment|supplies|kit\b|kits\b|software|reddit|license|insurance for|franchise|wholesale|logo|flyer|template for|names? for|llc|near me jobs|meaning|definition|synonym|in spanish|tiktok trend)\b/i;

// Other countries and big chains: a hook never names a real business, and the member's buyers are local.
const ELSEWHERE = /\b(uk|u\.k\.|nz|new zealand|australia|aus|canada|ontario|india|south africa|philippines|pakistan|nigeria|ireland|dubai|uae|singapore|malaysia|kenya|ghana|london|toronto|sydney|melbourne|vancouver|manila|lagos|in hindi|in tamil|in urdu)\b/i;
const BRANDS = /\b(shell|bp|exxon|chevron|costco|walmart|target|home depot|lowe'?s|amazon|mister car wash|quick quack|jiffy lube|valvoline|meineke|rover|wag|petsmart|petco|molly maid|merry maids|trugreen|kumon|sylvan|angi|angie'?s list|thumbtack|taskrabbit|yelp|groupon|nextdoor)\b/i;
// Kinds of business that sell to other businesses: "business" in their search is still a buyer.
const B2B = new Set(['webdesign', 'social', 'automation', 'video', 'ugc', 'coaching']);

// "how often car detailing" is a search, not a question a person would say out loud.
const BROKEN = /^(how (often|long|much) (?!(do|does|did|should|to|is|are|can|will|until|after|before|would|could|a|an|the|i|you|your|my)\b)|why is \w+( \w+)?\??$)/i;

const KINDS = [
  ['cost', /\b(cost|costs|price|prices|pricing|how much|charge|charges|rates?|cheap|afford)\b/i],
  ['worth', /\b(worth it|worth the|is it worth|should i|do i need|is it bad|is it safe|good idea)\b/i],
  ['often', /\b(how often|how long|how many times|every \w+ (weeks|months))\b/i],
  ['compare', /\b(vs\.?|versus|or|better than|difference between|compared)\b/i],
  ['how', /\b(how to|how do|how can|what to|what is|what are|what does|why|when to|when should|can you|does|do you)\b/i],
  ['local', /\bnear me\b/i],
  ['problem', /\b(remove|removal|get rid|fix|smell|stain|stains|damage|broken|stuck|won't|wont|not working|mold|mildew|scratch|scratches|hair|odor|leak)\b/i],
];

function kindOf(q) {
  for (const [k, re] of KINDS) if (re.test(q)) return k;
  return 'topic';
}

// The searches we run for a service and city: the base phrase plus question starters. At most 10.
function queriesFor(f) {
  const seeds = (f.niche.seeds && f.niche.seeds.length ? f.niche.seeds : [f.service]).slice(0, 2);
  const s = seeds[0];
  const out = [
    `how much does ${s} cost`,
    `is ${s} worth it`,
    `how often ${s}`,
    `${s} vs`,
    `why is ${s}`,
    `how long does ${s} take`,
    `${s} near me`,
    seeds[1] || `${s} tips`,
    seeds[1] ? `is ${seeds[1]} worth it` : `${s} mistakes`,
  ];
  if (f.city) out.push(`${s} ${f.city}`);
  return [...new Set(out.map((q) => q.toLowerCase().replace(/\s+/g, ' ').trim()))].slice(0, 10);
}

const STATES = new Set('al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc'.split(' '));

// Other places that show up in suggestions ("austin mn", "austintown") are not the member's city.
function otherPlace(q, f) {
  const city = String(f.city || '').toLowerCase().trim();
  if (!city) return false;
  const c = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${c}[a-z]+`, 'i').test(q)) return true; // "austintown"
  const m = q.toLowerCase().match(new RegExp(`\\b${c}\\s+([a-z]{2})\\b`));
  const state = String(f.region || '').toLowerCase().trim();
  return !!(m && STATES.has(m[1]) && state.length === 2 && m[1] !== state);
}

// "how much does car detailing cost near me" -> "... cost in Austin" (near me means the searcher's town).
function localize(q, f) {
  const where = f.city || '';
  return where ? String(q).replace(/\bnear me\b/i, `in ${where}`) : String(q).replace(/\s*\bnear me\b/i, '');
}

function tidy(q) {
  let s = text.oneLine(q).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (/^(how|what|why|when|is|are|do|does|can|should|which|who|where|will)\b/i.test(s) && !/\?$/.test(s)) s += '?';
  return s;
}

// One autocomplete call: ["query", ["suggestion", ...], ...]. Cached for a week for every member.
async function suggest(ctx, q, { youtube = false } = {}) {
  const url = `${ENDPOINT}?client=firefox&hl=en&gl=us${youtube ? '&ds=yt' : ''}&q=${encodeURIComponent(q)}`;
  return web.cached(ctx, `content:suggest:${youtube ? 'yt' : 'web'}:${q}`, 24 * 7, async () => {
    const r = await web.getJson(ctx, url, { timeoutMs: 8000, maxBytes: 200000 });
    if (!r.ok || !Array.isArray(r.data) || !Array.isArray(r.data[1])) throw new Error(`Google suggestions answered ${r.status}`);
    return r.data[1].map(String).slice(0, 10);
  });
}

// Live questions for a member: [{ q, kind, source: 'google' | 'youtube', from }]. Throws when the
// network gives nothing at all, so the caller can fall back honestly.
async function liveQuestions(ctx, f, { youtube = true, limit = 40 } = {}) {
  const queries = queriesFor(f);
  const jobs = queries.map((q) => ({ q, youtube: false }));
  if (youtube) jobs.push(...queries.slice(0, 3).map((q) => ({ q, youtube: true })));
  let ok = 0;
  const results = await web.mapLimit(
    jobs,
    2,
    async (job) => {
      try {
        const list = await suggest(ctx, job.q, { youtube: job.youtube });
        ok++;
        return list.map((s) => ({ s, from: job.q, source: job.youtube ? 'youtube' : 'google' }));
      } catch {
        return [];
      }
    },
    ctx
  );
  if (!ok) throw new Error('No answer from Google suggestions.');
  const seen = new Set();
  const out = [];
  for (const r of results.flat()) {
    const raw = String(r.s || '').toLowerCase().trim();
    if (!raw || raw.split(' ').length < 3) continue;
    if (SELLER.test(raw) || ELSEWHERE.test(raw) || BRANDS.test(raw) || otherPlace(raw, f)) continue;
    if (!B2B.has(f.niche.key) && /\bbusiness\b/.test(raw)) continue;
    if (raw === String(r.from || '').toLowerCase().trim() || BROKEN.test(raw)) continue;
    const key = raw.replace(/[^a-z0-9 ]/g, '').replace(/\b(a|an|the|my|your)\b/g, '').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ q: tidy(localize(r.s, f)), kind: kindOf(raw), source: r.source, from: r.from });
  }
  // Questions first (they make the best hooks), then the rest.
  const thing = String(f.niche.thing || '').toLowerCase();
  const rel = (x) => Number(/\?$/.test(x.q)) * 2 + Number(!!thing && x.q.toLowerCase().includes(thing)) + Number(x.kind !== 'topic');
  out.sort((a, b) => rel(b) - rel(a));
  return out.slice(0, limit);
}

// Without the network: the questions buyers of this kind of business ask, from our niche notes.
function starterQuestions(f) {
  return f.niche.questions.map((x) => ({ q: x.q, a: x.a, kind: kindOf(x.q.toLowerCase()), source: 'starter', from: '' }));
}

// The niche's own answer for a question, when we have one (matched on shared words).
function answerFor(f, q) {
  const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
  const qw = words(q);
  let best = null;
  let bestN = 0;
  for (const x of f.niche.questions) {
    let n = 0;
    for (const w of words(x.q)) if (qw.has(w)) n++;
    if (n > bestN) {
      best = x;
      bestN = n;
    }
  }
  return bestN >= 2 ? best.a : '';
}

module.exports = { localize, ELSEWHERE, BRANDS, BROKEN, queriesFor, liveQuestions, starterQuestions, answerFor, kindOf, tidy, otherPlace, SELLER, ENDPOINT };
