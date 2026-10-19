// Picking the comment keyword: one short word that says what people get, easy to spell on a phone,
// and rare in everyday comments (ManyChat matches comments that contain the word, so "LOVE" would
// fire on "love this"). Pure functions, no I/O.

const { text } = require('../../_kit');

// Words people type in ordinary comments and replies. A keyword from this list fires by accident.
const COMMON = new Set(
  `love loved lovely yes yess yesss no nope wow nice great cool cute beautiful amazing awesome perfect need needed want
  me please pls plz info price prices how what when where why who thanks thank thx ty omg lol lmao yum yummy good best
  this that same so link interested dm send sent details cost costs gorgeous stunning obsessed fire hi hello hey hiya
  congrats goals mine here done again wait check look wish hope like really much more sure okay ok agree true facts story
  post video reel today tomorrow now new old yes please idea ideas help free cheap easy fun happy sad hot cold big small
  shop buy order book call text email phone open closed hours time date day week month year love it so good want one
  amazing omg same here me too it is my your our you they them we us his her he she and the for with from about just
  one two three four five ten first last next all any some every each order sale deal tip tips list guide plan plans
  booked booking`
    .split(/\s+/)
    .filter(Boolean)
);

// Words that say nothing about the offer on their own.
const FILLER = new Set(
  `my a an the free our your to of for and or in on with by at from this that these those how what get got make made
  simple quick easy best ultimate complete full mini little big new first 1 one page one-page printable pdf download
  downloadable digital instant step steps day days week minute minutes 5 7 10 15 30 template templates sheet`.split(/\s+/)
);

// Default words per goal when the offer gives us nothing better.
const GOAL_WORDS = {
  freebie: ['GUIDE', 'SEND', 'FREEBIE'],
  booking: ['CHAT', 'TALK', 'SPOT'],
  product: ['LINK', 'SHOP', 'WANT'],
  story: ['SEND', 'DETAILS', 'INFO'],
  waitlist: ['EARLY', 'WAITLIST', 'FIRST'],
};

// Goal words that are common but carry the right intent (someone typing "link" wants the link).
const INTENT_OK = { product: new Set(['LINK', 'SHOP']), booking: new Set([]), freebie: new Set([]), story: new Set(['SEND', 'DETAILS', 'INFO']), waitlist: new Set([]) };

function clean(word) {
  return String(word || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function wordsOf(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.replace(/'s$/, '').replace(/'/g, ''))
    .filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));
}

// Plural to singular for the obvious cases ("recipes" -> "recipe"), so keywords read naturally.
function singular(w) {
  if (/ies$/.test(w) && w.length > 4) return w.replace(/ies$/, 'y');
  if (/(x|ch|sh|ss|zz)es$/.test(w)) return w.replace(/es$/, '');
  if (/(ss|us|is)$/.test(w)) return w;
  if (/s$/.test(w) && w.length > 4) return w.replace(/s$/, '');
  return w;
}

function check(keyword, goal) {
  const k = clean(keyword);
  const notes = [];
  let score = 0;
  if (!k) return { keyword: k, score: -99, notes: ['Empty'] };
  if (k.length >= 4 && k.length <= 8) score += 3;
  else if (k.length <= 10 && k.length >= 3) score += 1;
  else notes.push(k.length < 3 ? 'Very short, so it can show up inside other words' : 'Long words get misspelled on phones');
  if (/\d/.test(k)) {
    score -= 1;
    notes.push('Numbers are easy to mistype');
  }
  const lower = k.toLowerCase();
  const intentOk = INTENT_OK[goal] && INTENT_OK[goal].has(k);
  if (COMMON.has(lower) && !intentOk) {
    score -= 4;
    notes.push('Common word: everyday comments will trigger it too');
  } else if (intentOk) {
    notes.push('Common, but people who type it want exactly this');
  }
  if (/(.)\1\1/.test(k)) score -= 1;
  return { keyword: k, score, notes };
}

function why(k, source, goal) {
  if (source === 'yours') return 'Your pick.';
  if (source === 'offer') return `Says what they get. ${k.length} letters, easy to type.`;
  if (source === 'product') return 'Names the product, so the comment reads naturally.';
  return {
    freebie: 'Short and clear about what happens next.',
    booking: 'Sounds like a person, not a sales pitch.',
    product: 'People already type this when they want the link.',
    story: 'Easy to type in a story reply.',
    waitlist: 'Makes joining feel like getting in first.',
  }[goal] || 'Short and easy to type.';
}

// Three keyword options, best first. The member's own keyword (if any) is always first.
function keywordOptions({ goal = 'freebie', offer = '', product = '', keyword = '' } = {}) {
  const seen = new Set();
  const out = [];
  const add = (word, source, bonus = 0) => {
    const k = clean(word);
    if (!k || seen.has(k) || k.length > 15) return;
    seen.add(k);
    const c = check(k, goal);
    out.push({ keyword: k, why: why(k, source, goal), note: c.notes.join('. '), score: source === 'yours' ? 100 : c.score + (source === 'offer' || source === 'product' ? 1 : 0) + bonus, source });
  };
  if (keyword) add(keyword, 'yours');
  const offerWords = wordsOf(offer).map(singular);
  const productWords = wordsOf(product).map(singular);
  // The last word of an offer is usually the thing ("party board planner" -> planner).
  // The thing itself wins ties: "planner" over "board".
  if (offerWords.length) add(offerWords[offerWords.length - 1], 'offer', 0.5);
  if (productWords.length) add(productWords[productWords.length - 1], 'product', 0.5);
  for (const w of offerWords.slice(0, -1).reverse()) add(w, 'offer');
  for (const w of productWords.slice(0, -1)) add(w, 'product');
  for (const w of GOAL_WORDS[goal] || GOAL_WORDS.freebie) add(w, 'goal');
  const mine = out.filter((o) => o.source === 'yours');
  const rest = out
    .filter((o) => o.source !== 'yours' && o.score > -1)
    .sort((a, b) => b.score - a.score || a.keyword.length - b.keyword.length);
  const picked = [...mine, ...rest].slice(0, 3);
  // Always three choices: fall back to goal words even if they scored low.
  for (const o of out) if (picked.length < 3 && !picked.includes(o)) picked.push(o);
  return picked.map(({ keyword: k, why: w, note }) => ({ keyword: k, why: w, note: note || 'Rarely typed by accident.', label: k }));
}

// Lowercase tag-safe version: "PARTY BOARD" -> "party_board".
function tagBase(keyword) {
  return text.slug(keyword, 24).replace(/-/g, '_') || 'keyword';
}

module.exports = { keywordOptions, check, clean, tagBase, COMMON, wordsOf, singular };
