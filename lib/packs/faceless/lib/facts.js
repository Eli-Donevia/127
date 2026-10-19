// Facts and interest numbers from Wikipedia, live when it answers and from the dated snapshot in
// data/topics.json when it doesn't. Three public Wikimedia endpoints, all cached in the shared cache:
//   page views (last month, user views): wikimedia.org/api/rest_v1/metrics/pageviews/per-article
//   the page's lead section as plain text: en.wikipedia.org/w/api.php?action=query&prop=extracts
//   search (for a topic the member types): en.wikipedia.org/w/api.php?action=query&list=search
// Wikipedia asks API callers to say who they are, so every call carries 127's Api-User-Agent.

const { web, text } = require('../../_kit');
const TOPICS = require('../data/topics.json');

const UA = '127-workflows/0.1 (https://127group.io)';
const API = 'https://en.wikipedia.org/w/api.php';
const HEADERS = { 'Api-User-Agent': UA };

// The month before today, as "2026-09".
function lastMonth(ctx) {
  const now = new Date(ctx && ctx.now ? ctx.now() : Date.now());
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
}

// "2026-09" -> "September 2026"
function monthName(month) {
  const [y, m] = String(month || TOPICS.month).split('-').map(Number);
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][(m || 1) - 1]} ${y}`;
}

const urlOf = (article) => `https://en.wikipedia.org/wiki/${encodeURIComponent(String(article).replace(/ /g, '_'))}`;

// Wikipedia's text, made safe for our copy rules: no dashes, no pronunciation or date asides.
// Asides in brackets go when they hold dates, pronunciations, other scripts or more than a few
// words; short plain ones stay. Innermost first, so "(IPA: [o.dy(s).seus])" goes whole.
const ASIDE_OUT = /\d{3,4}|;|listen|pronounced|IPA|romanized|\/|[^\u0000-\u024F\u2018-\u201D\s]/;
function dropAsides(s) {
  let t = String(s || '');
  for (let k = 0; k < 5; k++) {
    const next = t.replace(/\s*\(([^()]*)\)/g, (m, inner) => (ASIDE_OUT.test(inner) || m.length > 60 || !/[A-Za-z0-9]/.test(inner) || /^\s*,/.test(inner) ? '' : m.replace('(', '\u27E8').replace(/\)$/, '\u27E9')));
    if (next === t) break;
    t = next;
  }
  return t.replace(/\u27E8/g, '(').replace(/\u27E9/g, ')');
}

function clean(s) {
  return dropAsides(
    String(s || '')
      .replace(/[\u2060\u200B\u00AD]/g, '')
      .replace(/[\u2010\u2011]/g, '-')
      .replace(/\uA78C/g, "'")
      .replace(/\u2212(?=\d)/g, 'minus ')
      .replace(/\s?°C\b/g, ' degrees Celsius')
      .replace(/\s?°F\b/g, ' degrees Fahrenheit')
      .replace(/(\d)\s?°/g, '$1 degrees')
      .replace(/(\d)\s?km\/s\b/g, '$1 kilometers per second')
      .replace(/(\d)\s?km\/h\b/g, '$1 kilometers per hour')
      .replace(/(\d)\s?(?:km²|km2|sq km)(?![\w/])/g, '$1 square kilometers')
      .replace(/(\d)\s?(?:mi²|sq mi)(?![\w/])/g, '$1 square miles')
      .replace(/(\d)\s?km(?![\w/²])/g, '$1 kilometers')
      .replace(/(\d)\s?kg(?![\w/])/g, '$1 kilograms')
      .replace(/(\d)\s?mph\b/g, '$1 miles per hour')
      .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
      .replace(/\s+[–—]\s+/g, ', ')
      .replace(/[–—]/g, '-'),
  )
    .replace(/\s*\[\d+\]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

// Sentences: split after . ! or ? when a capital letter starts the next one, so "2.5 million" and
// "c. 1995" stay whole.
// A piece that ends in an initial or a short form ("James E.", "St.", "U.S.") joins the next one.
const ABBR = /(?:^|[\s(])(?:[A-Z]|St|Mt|Ft|Dr|Mr|Mrs|Ms|Jr|Sr|No|vs|c|ca|approx|U\.S|U\.K|e\.g|i\.e)\.$/;
function splitSentences(s) {
  const parts = String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?]["')\]]?)\s+(?=["'(]?[A-Z])/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out;
}

// A sentence a voice can read and our copy rules allow: whole, plain Latin letters (no Greek words,
// formulas or symbols a voice can't say), no banned words. A bad one drops itself, not the topic.
const ODD = /[^\u0000-\u024F\u1E00-\u1EFF\u2018-\u201D\u2026]|\\[a-z]|[{}]/;
function usable(x) {
  return /[.!?]["')\]]?$/.test(x) && x.split(/\s+/).length >= 4 && !ODD.test(x) && text.copyProblems(x).length === 0;
}

function safeSentences(s) {
  return splitSentences(clean(s))
    .map((x) => text.oneLine(x))
    .filter(usable);
}

async function liveViews(ctx, article, month) {
  const [y, m] = month.split('-');
  const last = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(String(article).replace(/ /g, '_'))}/monthly/${y}${m}01/${y}${m}${last}`;
  return web.cached(ctx, `faceless:views:${article}:${month}`, 24, async () => {
    const r = await web.getJson(ctx, url, { timeoutMs: 8000, headers: HEADERS });
    const v = r && r.data && r.data.items && r.data.items[0] ? r.data.items[0].views : null;
    return Number.isFinite(v) && v > 0 ? v : null;
  });
}

// Last month's views for a list of topics (null where Wikimedia didn't answer). After 3 misses in a
// row it stops asking, so an offline run doesn't wait on every topic.
async function liveViewsAll(ctx, topics, month) {
  let misses = 0;
  return web.mapLimit(
    topics,
    4,
    async (t) => {
      if (misses >= 3) return null;
      const v = await liveViews(ctx, t.article, month).catch(() => null);
      misses = v ? 0 : misses + 1;
      return v;
    },
    ctx,
  );
}

// The lead section of a page (plain text, a few paragraphs), its title and short description.
async function liveLead(ctx, title) {
  const url = `${API}?action=query&prop=extracts|description|info&inprop=url&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  return web.cached(ctx, `faceless:lead:${title}`, 24 * 7, async () => {
    const r = await web.getJson(ctx, url, { timeoutMs: 9000, headers: HEADERS });
    const p = r && r.data && r.data.query && r.data.query.pages && r.data.query.pages[0];
    if (!p || p.missing || !p.extract) return null;
    return { title: p.title, description: p.description || '', extract: p.extract, url: p.fullurl || urlOf(p.title) };
  });
}

async function liveSearch(ctx, query) {
  const url = `${API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&srnamespace=0&format=json&formatversion=2`;
  return web.cached(ctx, `faceless:search:${query.toLowerCase()}`, 24 * 7, async () => {
    const r = await web.getJson(ctx, url, { timeoutMs: 9000, headers: HEADERS });
    const hits = r && r.data && r.data.query && r.data.query.search;
    return Array.isArray(hits) ? hits.map((h) => h.title) : null;
  });
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'for', 'to', 'is', 'how', 'why', 'what', 'who', 'facts', 'fact', 'about']);
const keyWords = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));

// A topic from the pack's list by name: "saturn", "The Titanic", "black holes".
function inSnapshot(query, niche) {
  const q = keyWords(query).join(' ');
  if (!q) return null;
  const lists = niche && TOPICS.niches[niche] ? [TOPICS.niches[niche], ...Object.values(TOPICS.niches)] : Object.values(TOPICS.niches);
  for (const list of lists) {
    const hit = list.find((t) => keyWords(t.topic).join(' ') === q || keyWords(t.wiki).join(' ') === q);
    if (hit) return hit;
  }
  return null;
}

// The topic a script of the member's own is about: one from the pack's list named in its first line
// (the earliest named wins, so "Saturn ... the Sun" is about Saturn), or a name of two or more words
// anywhere in it. Null when it names none.
function mentioned(script, niche) {
  const body = String(script || '');
  const first = body.split(/\r?\n/).find((l) => l.trim()) || '';
  const lists = niche && TOPICS.niches[niche] ? [TOPICS.niches[niche], ...Object.values(TOPICS.niches)] : Object.values(TOPICS.niches);
  const seen = new Set();
  const all = lists.flat().filter((t) => !seen.has(t.article) && seen.add(t.article));
  const at = (hay, t) => {
    const name = String(t.topic).replace(/^The\s+/, '');
    if (name.length < 3) return -1;
    const m = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').exec(hay);
    return m ? m.index : -1;
  };
  const inFirst = all.map((t) => ({ t, i: at(first, t) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i || b.t.topic.length - a.t.topic.length);
  if (inFirst.length) return inFirst[0].t;
  const long = all.filter((t) => t.topic.replace(/^The\s+/, '').split(/\s+/).length >= 2).map((t) => ({ t, i: at(body, t) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
  return long.length ? long[0].t : null;
}

// Facts for one topic: the live lead section when Wikipedia answers, else the snapshot summary.
// Returns { sentences, text, live }.
async function factsFor(ctx, topic) {
  let lead = null;
  try {
    lead = await liveLead(ctx, topic.wiki || topic.article || topic.topic);
  } catch {
    lead = null;
  }
  const src = lead && lead.extract && lead.extract.length > (topic.extract || '').length ? lead.extract : topic.extract || '';
  const sentences = safeSentences(src).slice(0, 24);
  return { sentences, text: sentences.join(' '), live: !!(lead && src === lead.extract) };
}

// What kind of topic it is, from Wikipedia's short description: it picks the angles that fit.
const PERSON = /\b(pharaoh|emperor|empress|king|queen|khan|general|polymath|heroine|hero|saint|ruler|cosmonaut|astronaut|god|goddess|deity|figure|scientist|physicist|chemist|inventor|explorer|painter|composer|writer|poet|philosopher|president|politician|monster|creature)\b/i;
const EVENT = /\b(disaster|accident|landing|pandemic|crash|bubble|mania|crisis|depression|experiment|study|sank|battle|war|revolution|eruption|earthquake of|fire)\b/i;
const PLACE = /\b(city|town|island|islands|archipelago|lake|continent|trench|mountain|range|river|rainforest|falls|waterfall|desert|valley|reef|national park|monument|citadel|temple|country|region|sea|ocean|bay|canyon|cave)\b/i;
function kindOf(name, description) {
  const d = String(description || '');
  if (PERSON.test(d)) return 'person';
  if (EVENT.test(`${name} ${d}`) && !/eclipse/i.test(name)) return 'event';
  if (PLACE.test(d)) return 'place';
  return 'thing';
}

// A topic the member typed: { topic, wiki, article, url, description, extract, views, month, kind,
// live } or null when nothing fits. The pack's own list first (its numbers are dated), then a
// Wikipedia search, keeping only a page whose title shares a word with what was typed.
async function lookUp(ctx, query, niche) {
  const q = text.oneLine(query || '');
  if (!q) return null;
  const local = inSnapshot(q, niche);
  if (local) return { ...local, month: TOPICS.month, live: false };
  let titles = null;
  try {
    titles = await liveSearch(ctx, q);
  } catch {
    titles = null;
  }
  const want = keyWords(q);
  const title = (titles || []).find((t) => {
    const have = keyWords(t);
    return want.some((w) => have.includes(w));
  });
  if (title) {
    try {
      const lead = await liveLead(ctx, title);
      if (lead && lead.extract && safeSentences(lead.extract).length >= 2) {
        const article = lead.title.replace(/ /g, '_');
        const month = lastMonth(ctx);
        const views = await liveViews(ctx, article, month).catch(() => null);
        const name = lead.title.replace(/\s+\([^)]*\)$/, '');
        return { topic: name, wiki: lead.title, article, url: lead.url, description: clean(lead.description), extract: safeSentences(lead.extract).join(' '), views, month: views ? month : null, kind: kindOf(name, lead.description), live: true };
      }
    } catch {
      /* nothing found */
    }
  }
  return null;
}

async function lookUpAll(ctx, queries, niche) {
  return web.mapLimit(queries, 3, (q) => lookUp(ctx, q, niche).catch(() => null), ctx);
}

async function factsForAll(ctx, topics) {
  return web.mapLimit(topics, 4, (t) => factsFor(ctx, t), ctx);
}

module.exports = { splitSentences, usable, mentioned, lookUpAll, factsForAll, UA, TOPICS, lastMonth, monthName, urlOf, clean, safeSentences, liveViews, liveViewsAll, liveLead, liveSearch, inSnapshot, factsFor, lookUp, keyWords, kindOf };
