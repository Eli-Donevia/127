// "Name your offer": names built from up to five parts: a real reason for now (the season, a
// founding run), who it's for, the result in a word or two, a time frame, and a container word
// (Detail, Plan, Program, Kit). Three to five parts reads best. A name says what's inside; it
// never promises a result, so no "guaranteed", no numbers of clients, no "more sales".

const { text } = require('../../_kit');

// Words that would make a name promise an outcome nobody controls.
const RESULT_WORDS = /\b(guarantee\w*|results?|profit\w*|rich|income|money[- ]making|more (clients|customers|sales|leads|followers|views)|straight[- ]a|viral|millionaire|six|seven|figure|booked[- ]up|sold[- ]out)\b/i;

// Real reasons for "now", by date. Holidays only when they're near.
function reasonsFor(today, f) {
  const m = Number(String(today).slice(5, 7));
  const d = Number(String(today).slice(8, 10));
  const out = [];
  const south = ['AU', 'NZ', 'ZA', 'AR', 'CL', 'UY', 'BR'].includes(String(f.country || '').toUpperCase());
  const season = f.season ? text.titleCase(f.season) : '';
  if (season) out.push(season);
  if (!south && ((m === 10 && d >= 15) || m === 11 || (m === 12 && d <= 20))) out.push('Holiday');
  if (!south && (m === 12 && d > 20 || m === 1)) out.push('New Year');
  if (!south && (m === 7 && d >= 15 || m === 8 || (m === 9 && d <= 10)) && ['teach', 'product', 'personal_service'].includes(f.arch)) out.push('Back-to-School');
  if (!south && m >= 3 && m <= 5 && ['home_service', 'b2b_service'].includes(f.arch)) out.push('Spring');
  out.push('Founding');
  return [...new Set(out)];
}

// "busy parents and commuters" -> { label: "Busy Parent", plural: "Busy Parents" }
const AVATARS = [
  [/\bparents?\b|\bmoms?\b|\bdads?\b|\bfamil/i, 'Parent', 'Parents'],
  [/\bhomeowners?\b/i, 'Homeowner', 'Homeowners'],
  [/\bcommuters?\b/i, 'Commuter', 'Commuters'],
  [/\bstudents?\b/i, 'Student', 'Students'],
  [/\bgyms?\b/i, 'Gym', 'Gyms'],
  [/\bcontractors?\b/i, 'Contractor', 'Contractors'],
  [/\brestaurants?\b/i, 'Restaurant', 'Restaurants'],
  [/\bbrands?\b/i, 'Brand', 'Brands'],
  [/\bdog|pet\b/i, 'Dog Owner', 'Dog Owners'],
  [/\bbeginners?\b/i, 'Beginner', 'Beginners'],
  [/\bcouples?\b/i, 'Couple', 'Couples'],
  [/\bbusiness(es)?\b|\bowners?\b|\bshops?\b/i, 'Local Business', 'Local Businesses'],
  [/\bgift\b/i, 'Gift-Giver', 'Gift Givers'],
];

function avatarOf(who) {
  const w = String(who || '');
  for (const [re, one, many] of AVATARS) {
    if (re.test(w)) {
      const busy = /\bbusy\b/i.test(w) && !/business/i.test(one) ? 'Busy ' : '';
      return { label: `${busy}${one}`, plural: `${busy}${many}` };
    }
  }
  return null;
}

function cityWord(city) {
  const c = String(city || '').split(',')[0].trim();
  return c && c.length <= 14 && !/\d/.test(c) ? text.titleCase(c) : '';
}

function partsOf(name) {
  return String(name).split(/\s+/).filter((w) => !/^(the|for|a|an|of)$/i.test(w)).length;
}

// Template names: every combination of the parts, scored for length and variety, best 12 first.
function templateNames(f, { today, count = 12, keywords = '' } = {}) {
  const p = f.profile;
  const goals = (p.goal || []).slice(0, 3);
  const intervals = (p.interval || []).slice(0, 2);
  const containers = (p.containers || ['Plan']).slice(0, 3);
  const reasons = reasonsFor(today || f.today, f).slice(0, 3);
  const av = avatarOf(f.who);
  const city = cityWord(f.city);
  const extra = String(keywords || '').split(/[,;]+/).map((k) => text.titleCase(k.trim())).filter((k) => k && k.length <= 16 && !RESULT_WORDS.test(k)).slice(0, 2);
  const seed = `${f.what}|${f.who}`;
  const out = [];
  const add = (name, uses, style) => {
    const n = text.plain(name).replace(/\s+/g, ' ').trim();
    if (!n || RESULT_WORDS.test(n) || n.length > 38) return;
    if (out.some((x) => x.name.toLowerCase() === n.toLowerCase())) return;
    out.push({ name: n, uses, style, parts: partsOf(n) });
  };
  containers.forEach((c, ci) => {
    goals.forEach((g, gi) => {
      add(`The ${g} ${c}`, ['result', 'container'], 'plain');
      intervals.forEach((i) => add(`${i} ${g} ${c}`, ['time', 'result', 'container'], 'time'));
      reasons.forEach((r) => {
        if (r !== 'Founding' || gi === 0) add(`${r} ${g} ${c}`, ['reason', 'result', 'container'], 'reason');
      });
      if (av && ci < 2) add(`${g} ${c} for ${av.plural}`, ['result', 'container', 'who'], 'who');
      if (av && gi === 0) add(`The ${av.label} ${g} ${c}`.replace(/Business /, 'Business '), ['who', 'result', 'container'], 'who');
      if (city && gi < 2 && ci === 0) add(`${city} ${g} ${c}`, ['place', 'result', 'container'], 'place');
    });
    intervals.forEach((i) => reasons.slice(0, 2).forEach((r) => add(`${r} ${i} ${c}`, ['reason', 'time', 'container'], 'reason')));
    extra.forEach((k) => add(`The ${k} ${c}`, ['your word', 'container'], 'yours'));
  });
  // Variety first: rotate through styles so the top 12 aren't all one pattern.
  const byStyle = {};
  for (const n of out) (byStyle[n.style] = byStyle[n.style] || []).push(n);
  const styles = Object.keys(byStyle).sort((a, b) => (text.hash(seed + a) % 7) - (text.hash(seed + b) % 7));
  const picked = [];
  for (let round = 0; picked.length < count && round < 20; round++) {
    for (const s of styles) {
      const n = byStyle[s][round];
      if (n && picked.length < count) picked.push(n);
    }
  }
  return picked.map((n) => ({ name: n.name, why: whyOf(n, { f, reasons }), style: n.style, parts: n.parts }));
}

const PART_WORDS = { reason: 'a real reason to act now', who: 'who it is for', result: 'the result', time: 'the time frame', container: 'what it is', place: 'where you are', 'your word': 'a word you picked' };

function whyOf(n, { reasons }) {
  const said = n.uses.map((u) => PART_WORDS[u]).filter(Boolean);
  let why = `Says ${text.list(said)}.`;
  if (n.uses.includes('reason') && /Founding/.test(n.name)) why += ' Use it only while you\'re taking your first customers.';
  else if (n.uses.includes('reason') && /Holiday|New Year|Back-to-School|Spring|Summer|Fall|Winter/.test(n.name)) why += ' Retire it when the season ends.';
  return why;
}

// A name the member can say out loud in a sentence: "It's called the Like-New Detail."
function sayIt(name) {
  const n = String(name || '').trim();
  return /^the\b/i.test(n) ? `It's called ${n.charAt(0).toLowerCase()}${n.slice(1)}.` : `It's called the ${n}.`;
}

function nameProblems(name) {
  const out = [];
  if (RESULT_WORDS.test(name)) out.push('promises a result');
  if (partsOf(name) > 6) out.push('too long to say');
  if (String(name).length > 38) out.push('too long for a post');
  return out;
}

module.exports = { templateNames, reasonsFor, avatarOf, sayIt, nameProblems, RESULT_WORDS, partsOf };
