// Scripts for faceless shorts: the angle a topic gets, the AI prompt and schema, the guards that keep
// a script to the facts and in the member's own words, the template when AI is off, and the plain
// labelled lines the video pack renders:
//   HOOK: Nothing escapes a black hole. Not even light.
//   LINE: ...
//   CTA: Follow for more space facts | @sixtysecondsky

const { text } = require('../../_kit');
const { splitSentences } = require('./facts');

// Angles: how a topic is told. {T} is the topic's name.
const ANGLES = {
  who: { label: 'Who was', title: 'Who was {T}?', hook: 'Who was {T}? Here is the short version.', cover: 'Who was {T}?' },
  happened: { label: 'What happened', title: '{T}: what happened', hook: '{T}. Here is what happened, in under a minute.', cover: '{T}: what happened' },
  sixty: { label: 'In 60 seconds', title: '{T} in 60 seconds', minute: '{T}: the quick version', hook: '{T}, in under a minute.', hookMinute: '{T}, in about a minute.', cover: '{T} in 60 seconds', coverMinute: '{T}, quickly' },
  facts: { label: '3 facts', title: '{T}: 3 facts', hook: '{T}: three facts you can tell a friend.', cover: '{T}: 3 facts' },
  numbers: { label: 'By the numbers', title: '{T} by the numbers', hook: '{T}, by the numbers.', cover: '{T} by the numbers' },
  explained: { label: 'Explained', title: '{T}, explained in a minute', hook: '{T}, explained in under a minute.', hookMinute: '{T}, explained in about a minute.', cover: '{T} explained' },
};
const BY_KIND = { person: ['who', 'sixty', 'facts'], event: ['happened', 'sixty', 'numbers'], place: ['sixty', 'facts', 'numbers'], thing: ['sixty', 'facts', 'explained', 'numbers'] };

// Lengths: under a minute for Shorts and Reels, or just over one (TikTok's Creator Rewards counts
// only videos longer than 1 minute). Words at about 2.5 a second read aloud.
const LENGTHS = {
  short: { label: 'Under a minute', words: [85, 110], seconds: 40 },
  minute: { label: 'Just over a minute', words: [165, 190], seconds: 70 },
};

// Cut at a word, no dots: titles and cover words.
function cut(s, max) {
  const t = text.oneLine(s);
  if (t.length <= max) return t;
  const c = t.slice(0, max + 1);
  return c.slice(0, c.lastIndexOf(' ') > max * 0.5 ? c.lastIndexOf(' ') : max).replace(/[\s,.;:]+$/, '');
}

// Cover words: 2 to 6 words, never ending on "in", "a" or "the".
const TAIL_WORDS = /\s+(?:a|an|the|in|of|to|and|or|for|on|at|with|is|was|by|from|could|can|will)$/i;
function trimCover(s) {
  let t = cut(String(s || '').split(/\s+/).slice(0, 6).join(' '), 40);
  while (TAIL_WORDS.test(t) && t.split(/\s+/).length > 2) t = t.replace(TAIL_WORDS, '');
  return t;
}

// {T} at the start keeps "The Sun"; inside a sentence it reads "the Sun" ("Who was the Minotaur?").
const fillT = (s, t) => String(s || '').replace(/\{T\}/g, (m, at) => (at === 0 ? t : String(t).replace(/^The\s/, 'the ')));
const wordCount = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const isYear = (n) => /^(1[0-9]{3}|20[0-9]{2})$/.test(n);

// Every number in a text, without thousands commas: "1,000" -> "1000", "4.6" -> "4.6".
function numbersIn(s) {
  return (String(s || '').match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,(?=\d{3}\b)/g, '').replace(/,$/, ''));
}

// Numbers a line uses that the facts don't have. Counting words like "3 facts" (1 to 10) and 60 are fine.
function unknownNumbers(line, facts) {
  const have = new Set(numbersIn(facts));
  return numbersIn(line).filter((n) => !have.has(n) && !(Number(n) <= 10 && /^\d+$/.test(n)) && n !== '60');
}

function canDoNumbers(facts) {
  const ns = [...new Set(numbersIn(facts))];
  return ns.length >= 2 && ns.some((n) => !isYear(n));
}

// Angles that fit a topic, minus the ones already made for it; the index spreads them out so the
// list doesn't read "in 60 seconds" 25 times.
function anglesFor(topic, facts, { made = [] } = {}) {
  const list = BY_KIND[topic.kind] || BY_KIND.thing;
  const sentences = (String(facts || '').match(/[.!?](\s|$)/g) || []).length;
  return list.filter((a) => (a !== 'numbers' || canDoNumbers(facts)) && (a !== 'facts' || sentences >= 3) && !made.includes(a));
}

function pickAngle(topic, facts, i = 0, made = []) {
  const ok = anglesFor(topic, facts, { made });
  return ok.length ? ok[i % ok.length] : null;
}

// "3 facts" runs about 25 seconds: too short for a video over a minute, so a minute gets another angle.
function angleForLength(angle, length, topic, facts, made = []) {
  if (length !== 'minute' || angle !== 'facts') return angle;
  return anglesFor(topic, facts, { made }).find((a) => a !== 'facts') || 'sixty';
}

function titleFor(topicName, angle, length = 'short') {
  const a = ANGLES[angle] || ANGLES.sixty;
  return cut(fillT(length === 'minute' && a.minute ? a.minute : a.title, topicName), 70);
}

function coverFor(topicName, angle, length = 'short') {
  const a = ANGLES[angle] || ANGLES.sixty;
  const words = wordCount(topicName);
  if (words > 3) return topicName.split(/\s+/).slice(0, 5).join(' ');
  return fillT(length === 'minute' && a.coverMinute ? a.coverMinute : a.cover, topicName);
}

function hookFor(topicName, angle, length = 'short') {
  const a = ANGLES[angle] || ANGLES.sixty;
  return fillT(length === 'minute' && a.hookMinute ? a.hookMinute : a.hook, topicName);
}

// Wikipedia's short description, when it says something specific ("Sixth planet from the Sun",
// "Deepest oceanic trench on Earth", "1986 nuclear accident in the Soviet Union"), as a title line.
// Not as cover words: on a profile grid the cover has to name the topic.
const SPECIFIC = /\b(?:largest|smallest|first|second|third|fourth|fifth|sixth|seventh|eighth|highest|deepest|longest|oldest|tallest|nearest|closest|only|last|southernmost|northernmost|biggest|fastest|hottest|coldest|brightest|heaviest)\b|\b\d{3,4}\b/i;
const RANKED = /^(?:largest|smallest|first|second|third|fourth|fifth|sixth|seventh|eighth|highest|deepest|longest|oldest|tallest|nearest|closest|only|last|southernmost|northernmost|biggest|fastest|hottest|coldest|brightest|heaviest)\b/i;
function factLine(topic) {
  const d = text.oneLine((topic && topic.description) || '').replace(/[.]$/, '');
  if (!d || wordCount(d) > 8 || !SPECIFIC.test(d) || /[/;]|\d\s*-\s*\d|\bc\.\s|^\d{3,4}\s+to\s+\d/.test(d)) return '';
  if (RANKED.test(d)) return `the ${d.charAt(0).toLowerCase()}${d.slice(1)}`;
  if (/^\d{3,4}\b/.test(d)) return `the ${d}`;
  return PROPER.test(d) ? d : `${d.charAt(0).toLowerCase()}${d.slice(1)}`;
}
const PROPER = /^(?:[A-Z]{2,}|[A-Z][a-z]+'s|Earth|British|Roman|Greek|Italian|French|Soviet|Norwegian|African|American|Chinese|Japanese|Egyptian|Mongol|Persian|English|German|Spanish|Russian|Indian|Mexican|Martian|Inca|Aztec|Maya|Mayan|Norse|Celtic|Viking|Macedonian|Byzantine|Ottoman|Danish|Dutch|Swiss|Australian|Canadian|Brazilian|Peruvian|Icelandic)\b/;

// Five titles to choose from, short enough to read on a phone, no two the same.
// `lead`: titles to put first (the AI's), then the angle's own, the fact line and plain ones.
function titleOptions(topicName, angle, length = 'short', lead = [], topic = null) {
  const fact = factLine(topic);
  const base = [
    ...lead,
    titleFor(topicName, angle, length),
    fact ? `${topicName}: ${fact}` : '',
    topic && topic.kind === 'person' && angle !== 'who' ? fillT('Who was {T}?', topicName) : '',
    length === 'minute' ? `${topicName} in about a minute` : `${topicName} in under a minute`,
    `${topicName}, explained`,
    `${topicName}: what to know`,
    `${topicName}: the short version`,
  ];
  const seen = new Set();
  return base
    .map((t) => cut(t, 70))
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .slice(0, 5);
}

// A Wikipedia sentence made easier to say: asides between commas go ("X, which is Y, orbits"), but
// only when the main clause carries on right after them: a verb we know, or lower case running to
// the end with no other comma. So "slain by Theseus, who ..., Ariadne" and "nitrogen, which emit
// light, green, blue, red and purple" keep their ends.
const ASIDE = /,\s(?:which|who|whose|also known as|known as|also called|or simply)\b[^,.;]*,\s/g;
const MAIN_VERB = /^(?:is|was|are|were|has|have|had|can|could|will|would|may|might|became|becomes|remains|lies|sits|stands|consists|contains|covers|forms|makes|takes|holds|uses|appears|orbits|lived|ruled|died|grew|predicts|describes|shows|means|says|began|ended)\b/;
function simplify(s) {
  const t = String(s || '').replace(ASIDE, (m, at, all) => {
    const rest = all.slice(at + m.length);
    return MAIN_VERB.test(rest) || (/^[a-z]/.test(rest) && !/,\s/.test(rest)) ? ' ' : m;
  });
  return text.oneLine(t.replace(/\s+\([^()]*\)/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\s+/g, ' '));
}

// Who a page is about, as its first sentence names it: "The Moon", "Jupiter", "A black hole", "The
// Minotaur". People go by their short name ("Cleopatra", not "Cleopatra VII Thea Philopator").
const escapeRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function subjectOf(first, topic) {
  const name = String(topic.topic);
  const lead = String(first || '').replace(/^(?:In|According to|As|During|Since|From)\b[^,]{0,60},\s*/, '');
  // Wikipedia's own casing: "The axolotl" and "The giant panda", but "The Moon".
  const hit = /^the\b/i.test(name) ? null : lead.slice(0, 80).match(new RegExp(`\\bthe (${escapeRe(name)})\\b`, 'i'));
  if (hit) return `The ${hit[1]}`;
  if (topic.kind === 'person') return name;
  const m = lead.match(/^(.{2,40}?)\s+(?:is|was|are|were)\b/);
  const sub = m ? m[1].replace(/\s+or\s+.*$/i, '').replace(/,.*$/, '').trim() : '';
  return sub && sub.toLowerCase().includes(name.toLowerCase().replace(/^(?:the|a|an)\s+/, '').split(' ')[0]) ? text.sentenceCase(sub) : name;
}

// A long sentence in two at a natural break (a colon, a semicolon, or ", and" / ", but" / ", so" /
// ", while" when a new clause follows), when both halves stay long enough to say on their own.
const CLAUSE = /^(?:it|its|they|their|he|she|his|her|the|this|these|those|there|a|an|in|on|at|after|since|many|most|some|each|every|both)\b/i;
function splitLong(s, max = 30) {
  if (wordCount(s) <= max) return [s];
  for (const re of [/:\s+/, /;\s+/, /,\s+(?:and|but|while|so)\s+/]) {
    const m = s.match(re);
    if (!m) continue;
    const a = s.slice(0, m.index).trim();
    const b = s.slice(m.index + m[0].length).trim();
    if (re.source.startsWith(',') && !CLAUSE.test(b)) continue;
    if (wordCount(a) >= 6 && wordCount(b) >= 6) return [...splitLong(`${a}.`, max), ...splitLong(text.sentenceCase(b), max)];
  }
  return [s];
}

// "It is a gas giant" -> "Jupiter is a gas giant", but never "It is believed that".
const LEAD_PRONOUN = /^(?:It|He|She)\b(?=\s+(?:(?:is|was)\s+(?!(?:believed|thought|said|estimated|likely|possible|unclear|not\s+until|also\s+(?:believed|thought))\b)|(?:has|had|can|could|may|orbits|completes|lived|dwelt|became|ruled|reigned|served|fought|led|won|lost|founded|built|wrote|painted|invented|discovered|married|conquered|died|grew|reached|remains|lies|sits|makes|takes|holds|uses|appears|forms|moves|flows|covers|contains|consists|includes|measures|weighs|stretches|rises|feeds|eats|hunts|lays|lives|grows|spins|rotates|travels|carries|marks|stands)\b))/;

// The script when AI is off: Wikipedia's own sentences in order, which the member must rewrite
// before posting (YouTube doesn't pay for videos that only read out text someone else wrote).
function templateScript({ topic, angle, sentences, niche, length = 'short', handle = '' }) {
  const L = LENGTHS[length] || LENGTHS.short;
  const hook = hookFor(topic.topic, angle, length);
  const cta = `Follow for more ${niche.more || 'facts'}.`;
  let pool = (sentences || []).map(simplify).flatMap((s) => splitLong(s)).filter((s) => wordCount(s) >= 6 && wordCount(s) <= 48);
  // "It is a gas giant" -> "Jupiter is a gas giant": a line can't lean on one that was left out.
  const subject = subjectOf(pool[0] || '', topic);
  pool = pool.map((s, i) => (i > 0 ? s.replace(LEAD_PRONOUN, subject) : s));
  if (angle === 'numbers') pool = [pool[0], ...pool.slice(1).filter((s) => numbersIn(s).length), ...pool.slice(1).filter((s) => !numbersIn(s).length)].filter(Boolean);
  const pick = (list, strict) => {
    const lines = [];
    let words = wordCount(hook) + wordCount(cta);
    for (const [k, s] of list.entries()) {
      if (strict && /^(it|this|these|they|he|she|its|their|his|her)\b/i.test(s) && (!lines.length || lines[lines.length - 1] !== list[k - 1])) continue;
      if (words + wordCount(s) > L.words[1] && lines.length >= 3) break;
      lines.push(s);
      words += wordCount(s);
      if (angle === 'facts' && lines.length >= 3) break;
    }
    return lines;
  };
  let lines = pick(pool.filter((s) => wordCount(s) <= 34), true);
  // A short page: longer sentences and ones that lean on the last, rather than a thin script.
  if (lines.length < 3) {
    const more = pick(pool.filter((s) => wordCount(s) <= 48), false);
    if (more.length > lines.length) lines = more;
  }
  return { title: titleFor(topic.topic, angle, length), hook, lines, cta, cover: coverFor(topic.topic, angle, length), summary: lines[0] || '', handle, copied: true };
}

// The member's own script, typed or pasted: labelled lines are kept, plain lines become HOOK, LINE
// and CTA (a follow line is added when there isn't one).
function ownScript(raw, { topicName = '', niche = {}, length = 'short' } = {}) {
  const rows = String(raw || '').split(/\r?\n/).map((r) => text.oneLine(r)).filter(Boolean);
  const out = { hook: '', lines: [], cta: '' };
  const plain = [];
  for (const r of rows) {
    const m = r.match(/^(HOOK|LINE|POINT|CTA)\s*:\s*(.+)$/i);
    if (m) {
      const k = m[1].toUpperCase();
      if (k === 'HOOK' && !out.hook) out.hook = m[2];
      else if (k === 'CTA') out.cta = m[2].split('|')[0].trim();
      else out.lines.push(m[2]);
    } else plain.push(...(r.length > 160 ? splitSentences(r) : [r]).map((x) => text.oneLine(x)).filter(Boolean));
  }
  if (plain.length) {
    if (!out.hook) out.hook = plain.shift();
    const last = plain[plain.length - 1];
    if (!out.cta && last && /^(follow|subscribe|like|comment|share)\b/i.test(last)) out.cta = plain.pop();
    out.lines.push(...plain);
  }
  if (!out.cta) out.cta = `Follow for more ${niche.more || 'facts'}.`;
  // No topic typed: the hook's first sentence names the video.
  const first = (out.hook.match(/^[^.!?]+/) || [out.hook])[0].trim();
  const name = topicName || cut(first, 60);
  return { title: text.sentenceCase(cut(name, 70)), hook: out.hook, lines: out.lines, cta: out.cta, cover: name.split(/\s+/).slice(0, topicName ? 5 : 4).join(' '), summary: out.lines[0] || out.hook, copied: false, own: true, length };
}

// Eight words in a row that match the facts: the line copies Wikipedia.
function copies(line, facts) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const f = norm(facts);
  const grams = new Set();
  for (let i = 0; i + 8 <= f.length; i++) grams.add(f.slice(i, i + 8).join(' '));
  const w = norm(line);
  for (let i = 0; i + 8 <= w.length; i++) if (grams.has(w.slice(i, i + 8).join(' '))) return true;
  return false;
}

// Checks an AI script against the facts: lines with numbers the facts don't have are dropped, and
// lines that copy 8 or more words in a row are flagged for the member to say their own way.
function guard(s, facts) {
  const dropped = [];
  const lines = (s.lines || []).map((l) => text.oneLine(l)).filter(Boolean).filter((l) => {
    const bad = unknownNumbers(l, facts);
    if (bad.length) dropped.push(l);
    return !bad.length;
  });
  const hookBad = unknownNumbers(s.hook, facts).length > 0;
  const copied = [s.hook, ...lines].map((l, i) => (copies(l, facts) ? i : -1)).filter((i) => i >= 0);
  const fine = (t) => !!text.oneLine(t) && unknownNumbers(t, facts).length === 0;
  return {
    ...s,
    title: fine(s.title) ? s.title : '',
    titles: (s.titles || []).filter(fine),
    cover: fine(s.cover) ? s.cover : '',
    summary: fine(s.summary) ? s.summary : lines[0] || '',
    lines,
    hookBad,
    dropped,
    copiedLines: copied,
    ok: lines.length >= 3 && !hookBad && !!text.oneLine(s.hook),
  };
}

// The labelled lines the video pack renders. The handle shows under the call to action, unspoken.
function toText(s, handle = '') {
  const h = String(handle || '').replace(/^@/, '');
  return [`HOOK: ${s.hook}`, ...s.lines.map((l) => `LINE: ${l}`), `CTA: ${s.cta}${h ? ` | @${h}` : ''}`].join('\n');
}

function spokenWords(s) {
  return wordCount([s.hook, ...(s.lines || []), s.cta].join(' '));
}

// About how long it runs read aloud (2.5 words a second, plus the music lead and tail).
function secondsOf(s) {
  return Math.round(spokenWords(s) / 2.5 + 1.7);
}

const SCRIPT = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    hook: { type: 'string' },
    lines: { type: 'array', items: { type: 'string' } },
    cta: { type: 'string' },
    cover: { type: 'string' },
    summary: { type: 'string' },
    titles: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'hook', 'lines', 'cta', 'cover', 'summary'],
};

const SYSTEM = [
  'You write scripts for faceless short videos (YouTube Shorts, TikTok, Reels): a voice reads them over footage, with captions.',
  'Spoken, plain English, like telling a friend something you just learned. Short sentences.',
  'Use only the facts given. Never add a fact, number, date or name that is not in them; leave out anything you are unsure of.',
  'Write in your own words. Never copy more than six words in a row from the facts.',
  'Be respectful about deaths and disasters. Stay neutral: no politics, no opinions about current events, no medical or money advice.',
  'No clickbait the facts cannot back, and no "you won\'t believe".',
].join(' ');

function promptFor({ topic, angle, facts, niche, length = 'short', extra = '' }) {
  const L = LENGTHS[length] || LENGTHS.short;
  return [
    `Topic: ${topic.topic}${topic.description ? ` (${topic.description})` : ''}. Channel: ${niche.label}, ${niche.angle}.`,
    `Angle: ${ANGLES[angle] ? `${ANGLES[angle].label} (working title "${titleFor(topic.topic, angle, length)}")` : 'the most interesting facts'}.`,
    `Length: ${L.words[0]} to ${L.words[1]} spoken words in total, about ${L.seconds} seconds read aloud.`,
    extra,
    `Facts (from Wikipedia):\n${facts}`,
    'Return: title (under 60 characters), hook (one sentence under 14 words that makes someone stop scrolling, true to the facts), lines (4 to 9 sentences in a clear order, each under 22 words, one idea each, saving a surprising fact for near the end), cta (one short sentence asking people to follow, like "Follow for more ' + (niche.more || 'facts') + '."), cover (2 to 5 words for the thumbnail that add to the title), summary (one sentence for the video description), titles (4 more title options under 60 characters).',
  ].filter(Boolean).join('\n\n');
}

module.exports = { cut, trimCover, splitLong, ANGLES, BY_KIND, LENGTHS, numbersIn, unknownNumbers, canDoNumbers, anglesFor, pickAngle, angleForLength, titleFor, coverFor, hookFor, factLine, titleOptions, simplify, templateScript, ownScript, copies, guard, toText, spokenWords, secondsOf, wordCount, SCRIPT, SYSTEM, promptFor };
