// Name helpers shared by the brand tools (and their tests). Plain functions, no I/O.
//
// templateIdeas() is the no-AI name writer. It uses the naming patterns small businesses actually
// pick (place plus craft, the founder's name, two words fused into one, a coined word, a picture of
// the result) filled from the member's own facts and a word list per kind of business (lexicon.js).
// Every name is short (3 words, 22 characters at most), sayable, free of filler like "Solutions"
// or "Pros", and never contains a famous brand.

const { text } = require('../../_kit');
const { nicheFor, FILLER, BIG_BRANDS } = require('./lexicon');

const STYLES = {
  place: 'says what you do and where, so locals find you on Google and Maps',
  founder: 'puts your name on it, and people hire a person before a company',
  compound: 'two real words made into one: short, easy to spell, and the .com is more often open',
  coined: 'an invented word you can own online',
  metaphor: 'names the feeling your customer wants, not the chore',
  plain: 'paints the picture and says the service plainly',
  // Earlier style names, still accepted from AI answers.
  brandable: 'short and ownable, easier to grow past one service',
  promise: 'names the result your customer wants',
};

const STOP = new Set(['the', 'and', 'for', 'your', 'with', 'from', 'that', 'this', 'into', 'home', 'local', 'online', 'business', 'businesses', 'service', 'services', 'company', 'small', 'my', 'our', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'or', 'i', 'we', 'you', 'do', 'sell', 'selling', 'make', 'making', 'new', 'best', 'good', 'help', 'helping', 'people', 'clients', 'customers', 'owners', 'something', 'unusual', 'like', 'etc', 'stuff', 'things', 'handmade', 'custom']);

// Words that can end a craft phrase taken from what the member typed ("bike repair", "soy candles").
const CRAFT_END = /(ing|ography|ery|ry)$|^(care|repair|design|candles|soap|cakes|cookies|bread|treats|templates|jewelry|prints|apparel|shirts|tees|flowers|florals|plants|lessons|coaching|photos|portraits|meals|coffee|tea|art|pottery|ceramics|decor|rentals|events|studio|massage|nails|lashes|brows|hair|makeup|skincare|fitness|yoga|pilates|music|drums|piano|guitar|tutor|tutors)$/;
// One word alone says too little for these; keep two ("Dog Walking", not "Walking").
const VAGUE_END = /^(walking|repair|design|training|care|sitting|cleaning|washing|coaching|editing|management|lessons|planning|making|building|writing|photos|music|art)$/;

// Endings for fused names ("Gloss" + "line" = "Glossline"). Chosen to read well after most roots.
const JOINS = ['line', 'well', 'field', 'light', 'stone', 'craft', 'path', 'ridge', 'way', 'works'];

const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : '');
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const uniq = (list) => [...new Set(list.filter(Boolean))];

function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.replace(/'s$/, '').replace(/'/g, ''))
    .filter(Boolean);
}

// Problems with a name (empty list = fine). exempt: words that are the founder's own name.
function nameProblems(name, { exempt = [] } = {}) {
  const out = [];
  const n = String(name || '').trim();
  if (!n) return ['empty'];
  if (n.length > 24) out.push('long');
  if (words(n).length > 3) out.push('more than 3 words');
  const toks = tokens(n);
  const mine = new Set(exempt.map((e) => String(e).toLowerCase()));
  if (toks.some((t) => FILLER.includes(t))) out.push('filler word');
  const kept = toks.filter((t) => !mine.has(t));
  const spaced = ` ${kept.join(' ')} `;
  const joined = kept.join('');
  for (const b of BIG_BRANDS) {
    const hit = b.includes(' ') ? spaced.includes(` ${b} `) : b.length >= 5 ? joined.includes(b) : kept.includes(b);
    if (hit) {
      out.push(`famous brand (${b})`);
      break;
    }
  }
  if (text.copyProblems(n).length) out.push('copy rules');
  return out;
}

// Fused word: root + ending, skipping doubled letters at the seam and awkward pairs.
function fuse(root, join) {
  const r = String(root || '').toLowerCase();
  if (!r || r.length > 7) return null;
  if (r.slice(-1) === join.charAt(0)) return null;
  if (r.endsWith(join) || join.endsWith(r)) return null;
  if (/[aeiou]$/.test(r) && /^[aeiou]/.test(join)) return null;
  return cap(r + join);
}

// Coined words from a root: Gloss -> Glossly; Tidy -> Tidify. (Hand-picked coins live in the lexicon.)
function coins(root) {
  const r = String(root || '').toLowerCase();
  if (!r || r.length < 3 || r.length > 6) return [];
  if (r.endsWith('y')) return [cap(`${r.slice(0, -1)}ify`)];
  if (/[bcdfgkmnpst]$/.test(r) && !/(ck|ch|sh)$/.test(r)) return [cap(`${r}ly`)];
  return [];
}

function possessive(first) {
  return /s$/i.test(first) ? `${first}'` : `${first}'s`;
}

// Craft phrases from what the member typed: "mobile car detailing at your home" -> ["Car Detailing",
// "Detailing"]; "dog walking" -> ["Dog Walking"]; "I help small businesses with SEO" -> [].
function craftsFrom(what) {
  const head = String(what || '').toLowerCase().split(/\b(?:for|at|in|to|with|on|near|from|by|of|who|that)\b/)[0];
  const ws = tokens(head).filter((w) => w.length > 1 && !STOP.has(w) && !FILLER.includes(w) && !nameProblems(w).length);
  const last = ws[ws.length - 1];
  if (!last || !CRAFT_END.test(last)) return [];
  const out = [];
  if (ws.length >= 2) out.push(text.titleCase(ws.slice(-2).join(' ')));
  if (!VAGUE_END.test(last)) out.push(cap(last));
  return out;
}

// Template ideas from the member's own words. Deterministic: same input, same list.
// Returns [{ name, why, style }].
function templateIdeas({ what, city, founder, keywords, count = 12 } = {}) {
  const niche = nicheFor(`${what || ''} ${keywords || ''}`);
  const seed = `${what}|${city}|${founder}|${keywords}`;
  const pick = (key, list) => text.pickBy(`${seed}|${key}`, list);
  const rotate = (key, list) => {
    if (!list || !list.length) return [];
    const start = text.hash(`${seed}|${key}`) % list.length;
    return list.slice(start).concat(list.slice(0, start));
  };

  const place = text.titleCase(String(city || '').split(',')[0].trim());
  const nameParts = words(String(founder || '').replace(/[^A-Za-z' -]/g, ' '));
  const first = nameParts.length ? text.titleCase(nameParts[0]) : '';
  const last = nameParts.length > 1 ? text.titleCase(nameParts[nameParts.length - 1]) : '';
  const exempt = [first, last].filter(Boolean);
  const mine = tokens(keywords).filter((w) => w.length > 2 && !STOP.has(w) && !FILLER.includes(w)).slice(0, 2);
  const label = niche.label;
  const signWord = niche.id === 'generic' ? 'what you do' : `"${label}"`;

  const fromWhat = craftsFrom(what);
  const crafts = uniq([...fromWhat, ...niche.craft]);
  const personal = crafts.filter((c) => !/\b(Co|Goods|Supply|Works)$/.test(c));
  // First variant that fits the length rule.
  const fits = (list) => list.find((n) => n && n.length <= 22 && words(n).length <= 3);

  const out = [];
  const seen = new Set();
  const add = (name, style, why) => {
    if (!name) return false;
    const clean = text.oneLine(name).replace(/\s+/g, ' ');
    const key = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key) || nameProblems(clean, { exempt }).length) return false;
    seen.add(key);
    out.push({ name: clean, why: text.clip(text.sentenceCase(why), 140), style });
    return true;
  };

  const pools = { yours: [], place: [], founder: [], compound: [], coined: [], metaphor: [], plain: [] };

  // The member's own words go first: they said they like them.
  for (const w of mine) {
    const W = cap(w);
    pools.yours.push([fits(crafts.slice().reverse().map((c) => `${W} ${c}`)), 'plain', `Built on your word "${w}", plus what you do so nobody has to guess.`]);
    const j = rotate(`kw${w}`, JOINS).map((x) => fuse(w, x)).find(Boolean);
    if (j) pools.yours.push([j, 'compound', `Your word "${w}" made into one name. Short, and easy to say over the phone.`]);
  }

  if (place) {
    pools.place.push([fits(crafts.map((c) => `${place} ${c}`)), 'place', pick('wp1', [
      `Says what you do and where. People searching "${label} in ${place}" see a match before they click.`,
      `Clear on a yard sign, a truck door and Google Maps. You can add a second city later with its own name.`,
    ])]);
    const second = niche.id === 'generic' ? fromWhat.filter((c) => c.includes(' ')).map((c) => `${place} ${c.split(' ')[0]} Co`) : rotate('short', niche.short).map((w) => `${place} ${w} Co`);
    pools.place.push([fits(second), 'place', pick('wp2', [
      `Local and friendly. "Co" keeps it short and still sounds like a real company.`,
      `${place} first, so neighbors know you are one of them.`,
    ])]);
  }

  if (first) {
    pools.founder.push([fits([...fromWhat, ...rotate('pers', personal.filter((c) => !fromWhat.includes(c)))].map((c) => `${possessive(first)} ${c}`)), 'founder', pick('wf1', [
      `Your name on the door. People hire a person they can text before they hire a company.`,
      `Warm and personal. Every review then says your name too.`,
    ])]);
    if (niche.by) pools.founder.push([`${niche.by} by ${first}`, 'founder', `Reads like a signature on your work. Great for photos, posts and a handwritten card.`]);
    if (last) {
      pools.founder.push([fits(personal.map((c) => `${last} ${c}`)), 'founder', pick('wf3', [
        `Family name plus the craft: the classic name for a trusted local business.`,
        `Sounds established from day one, and it is yours by birth.`,
      ])]);
    }
  }

  const compoundWhy = (n) => pick(`wc${n}`, [
    `Two real words in one. Easy to spell when you say it on the phone.`,
    `One short word you can own. Add ${signWord} under it on signs if you want it plainer.`,
  ]);
  for (const c of rotate('cmp', niche.compounds || [])) pools.compound.push([c, 'compound', compoundWhy(c)]);
  const roots = uniq([...(niche.roots || []), ...(niche.id === 'generic' ? tokens(what).filter((w) => w.length > 2 && !STOP.has(w) && !FILLER.includes(w)) : [])]);
  for (const root of rotate('roots', roots)) {
    const f = rotate(`join${root}`, JOINS).map((j) => fuse(root, j)).find(Boolean);
    if (f) pools.compound.push([f, 'compound', compoundWhy(f)]);
  }

  const coinWhy = (n) => pick(`wk${n}`, [
    `An invented word, so the handle and domain are more often open. Say it out loud to three people before you pick it.`,
    `Coined, short and ownable. Check it sounds right said aloud and spelled back to you.`,
  ]);
  for (const c of rotate('coin', niche.coins || [])) pools.coined.push([c, 'coined', coinWhy(c)]);
  for (const root of rotate('croots', roots)) for (const c of coins(root)) pools.coined.push([c, 'coined', coinWhy(c)]);

  for (const m of rotate('meta', niche.metaphors)) {
    pools.metaphor.push([m, 'metaphor', pick(`wm${m}`, [
      `Names the feeling (${niche.result}), not the chore.`,
      niche.id === 'generic' ? `A picture people remember after one hearing.` : `A picture people remember after one hearing, and it fits ${label} without saying it.`,
    ])]);
  }

  for (const o of rotate('obj', niche.objects)) {
    pools.plain.push([fits((niche.id === 'generic' ? crafts : niche.craft).map((c) => `${o} ${c}`)), 'plain', pick(`wo${o}`, [
      `Paints a picture, then says the service plainly.`,
      `"${o}" gives it a picture; the rest tells people what you do.`,
    ])]);
  }

  // Interleave the styles so the first six already show the range.
  const order = ['yours', 'place', 'founder', 'compound', 'metaphor', 'coined', 'plain', 'yours', 'founder', 'compound', 'place', 'metaphor', 'coined', 'plain', 'founder'];
  const want = Math.max(6, Math.min(20, count || 12));
  for (let pass = 0; pass < 4 && out.length < want; pass++) {
    for (const style of order) {
      if (out.length >= want) break;
      const pool = pools[style];
      while (pool.length) {
        const [name, st, why] = pool.shift();
        if (add(name, st, why)) break;
      }
    }
  }
  return out.slice(0, want);
}

function domainFor(name, tld = 'com') {
  const base = String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/'s\b/g, 's')
    .replace(/[^a-z0-9]+/g, '');
  return base ? `${base}.${tld}` : null;
}

// Handles to try on Instagram and TikTok for a name: the plain one, then common variants.
function handlesFor(name, { city } = {}) {
  const base = String(name || '').toLowerCase().replace(/&/g, 'and').replace(/'s\b/g, 's').replace(/[^a-z0-9]+/g, '');
  if (!base) return [];
  const place = String(city || '').split(',')[0].toLowerCase().replace(/[^a-z]/g, '');
  const out = [base, `${base}co`, `the${base}`, place && !base.includes(place) ? `${base}${place}` : `${base}hq`, `${base}.co`];
  return [...new Set(out)].filter((h) => h.length <= 30);
}

module.exports = { templateIdeas, domainFor, handlesFor, nameProblems, craftsFrom, STYLES, JOINS, coins, fuse };
