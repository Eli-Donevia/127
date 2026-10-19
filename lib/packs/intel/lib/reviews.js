// Reviews for the review miner: the ones a member pastes, and the testimonials a business shows on
// its own website. Never a review site: Google, Yelp, Facebook and the rest are refused by host (their
// terms forbid scraping, and Google's forbid storing review content), so the member copies by hand
// what they want read. Splitting drops reviewer names, dates, star lines, buttons and owner replies;
// phone numbers, emails and links inside a review become [phone], [email], [link]. Quotes stay exact
// and short. Each sentence is sorted by the words in it (praise, complaint, ask) and by theme.
// Pure helpers: no network (intel.read_testimonials does the fetching).

const { text } = require('../../_kit');

// ---------- hosts we never read ----------

const REVIEW_HOSTS = /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page|g\.co|yelp\.[a-z.]+|facebook\.com|fb\.com|fb\.me|instagram\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com|nextdoor\.com|tripadvisor\.[a-z.]+|trustpilot\.com|angi\.com|angieslist\.com|homeadvisor\.com|thumbtack\.com|houzz\.com|porch\.com|bbb\.org|yellowpages\.com|yp\.com|manta\.com|foursquare\.com|opentable\.com|resy\.com|zocdoc\.com|healthgrades\.com|vitals\.com|ratemds\.com|webmd\.com|avvo\.com|martindale\.com|lawyers\.com|justia\.com|glassdoor\.com|indeed\.com|birdeye\.com|podium\.com|reviewtrackers\.com|sitejabber\.com|consumeraffairs\.com|amazon\.[a-z.]+|etsy\.com|booksy\.com|vagaro\.com|styleseat\.com|classpass\.com|mindbodyonline\.com|groupon\.com|care\.com|rover\.com|wagwalking\.com|expedia\.[a-z.]+|booking\.com|airbnb\.[a-z.]+|hotels\.com|weddingwire\.com|theknot\.com|zillow\.com|realtor\.com|cars\.com|dealerrater\.com|carfax\.com|edmunds\.com|cargurus\.com|maps\.apple\.com|bing\.com|yahoo\.com|reddit\.com|youtube\.com|pinterest\.com|threads\.net|linktr\.ee)$/i;

// The host when a link points at a review site or social profile (we never read those), else null.
function refusedHost(url) {
  let host;
  try {
    host = new URL(/^https?:\/\//i.test(String(url)) ? String(url) : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  return REVIEW_HOSTS.test(host) ? host : null;
}

// ---------- splitting a paste into reviews ----------

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const STAR_CHARS = /[\u2605\u2606\u2729\u272a\u272b\u272c\u272d\u272e\u272f\u2b50]/;
const FILLED_STARS = /[\u2605\u272a\u272b\u272c\u272d\u272e\u272f\u2b50]/g;
// Lines that are never part of what a customer wrote: profile lines, dates, buttons, attributes.
const META = [
  /^(local guide|level \d+ local guide)\b/i,
  /^((\d[\d,]*|one|a)\s+(reviews?|photos?|ratings?|friends?|check-?ins?|helpful votes?|contributions?)\s*([\u00b7\u2022|,]\s*)?)+$/i,
  /^[\u00b7\u2022|]/,
  /^(edited|updated|posted|written|reviewed|visited|dined|stayed)?\s*(on|in)?\s*(a|an|one|\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/i,
  new RegExp(`^(edited|updated|posted|written|reviewed|visited|dined|stayed|date of (visit|stay|experience))?\\s*(on|in|:)?\\s*(${MONTHS})\\.?\\s+(\\d{1,2}(st|nd|rd|th)?,?\\s+)?\\d{4}\\s*$`, 'i'),
  new RegExp(`^(visited|dined|stayed|went) (on|in) (${MONTHS}|\\w+day)\\b.{0,20}$`, 'i'),
  /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/,
  /^\d{4}-\d{2}-\d{2}$/,
  /^[0-5]\.\d$/,
  /^(new|verified|verified (purchase|customer|buyer|patient|client|owner)|recommended|recommends|does ?n[o']t recommend|top contributor|elite( '?\d+)?|first to review|updated review|previous review|owner|response)$/i,
  /^(like|likes|share|helpful|not helpful|report|reply|more|read more|see more|show more|show less|less|translate|translated by google|see original|see translation|original|useful|funny|cool|thanks|love this|oh no|flag|follow|message|send message|compliment|was this (review )?helpful\??|helpful\??\s*(yes|no)?|\+?\d+)$/i,
  /^(useful|funny|cool|helpful|like|likes|love|thanks)\s*\d+$/i,
  /^(photo|photos|video|picture) (of|from|by)\b/i,
  /^\+?\d+\s+(more )?photos?$/i,
  /^(food|service|atmosphere|price|meal type|recommended dishes|parking|parking space|parking options|wait time|kid-?friendliness|vegetarian options|noise level|group size|reservation|dietary restrictions|price per person|rooms|location|sleep quality|value|cleanliness|check-in|amenities)\s*:\s*.{0,40}$/i,
  /^[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2}$/,
  /\brecommends\s+[A-Z]/,
];
const OWNER = /^((response|reply|comment) from\b.{0,80}$|business owner\b|(owner|business|management)'?s? (response|reply)\b)/i;
// A short line of capitalized words with no sentence in it: a reviewer's name ("Jane D.", "Mark T").
const SENTIMENTISH = /\b(great|good|best|love|loved|loves|amazing|awesome|excellent|nice|friendly|service|staff|place|recommend|recommended|highly|terrible|bad|worst|rude|clean|fast|slow|price|food|thank|thanks|thankful|wonderful|perfect|happy|experience|wow|okay|ok|stars?|again|soon|back)\b/i;
function nameLike(line) {
  const l = String(line || '').trim();
  if (!l || l.length > 40 || /[!?,:;"\u201c\u201d]/.test(l) || SENTIMENTISH.test(l) || /\d/.test(l)) return false;
  return /^([A-Z][\p{L}'\u2019-]*\.?|[A-Z]\.)(\s+([A-Z][\p{L}'\u2019-]*\.?|[A-Z]\.|de|da|van|von|la|le|del|di|st\.?)){0,3}$/u.test(l);
}

function starsOf(line) {
  const l = String(line || '').trim();
  if (STAR_CHARS.test(l) && l.replace(/[\s\u2605\u2606\u2729-\u272f\u2b50.]/g, '').length <= 2) return (l.match(FILLED_STARS) || []).length || null;
  const m = l.match(/^(?:rated|rating:?|overall:?)?\s*([0-5](?:\.\d)?)\s*(?:\/\s*5|out of 5(?: stars?)?|stars?)\s*$/i) || l.match(/^(?:rated|rating:?)\s*([0-5](?:\.\d)?)\s*$/i);
  return m ? Math.round(Number(m[1])) : null;
}

const isMeta = (l) => META.some((re) => re.test(l));

// Privacy and tidy-up inside a review: no contact details, no "More" buttons, the translated text only.
function cleanReview(t) {
  let s = String(t || '')
    .replace(/\(translated by google\)/gi, ' ')
    .replace(/\(original\)[\s\S]*$/i, ' ')
    .replace(/\s*(\u2026|\.\.\.)\s*(more|read more|see more)\s*$/i, '')
    .replace(/\s+(read more|see more)\s*$/i, '')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone]');
  // "Loved it! - Sarah K., Des Moines" -> "Loved it!" (the name is dropped, the words kept).
  s = s.replace(/\s*(?:[-~\u2013\u2014\u2015]+)\s*((?:[A-Z][\p{L}'\u2019]*\.?\s*){1,3})(?:,\s*[A-Z][\p{L} ]{1,30})?\s*$/u, (m, who) => (SENTIMENTISH.test(who) || /\b(the|and|of)\b/i.test(who) ? m : ''));
  // "Great service. Lee W." -> "Great service." (a signature after the last sentence).
  s = s.replace(/([.!?]["'\u201d\u2019]?)\s+((?:[A-Z][\p{L}'\u2019]*\.?\s*){1,3})$/u, (m, end, who) => (SENTIMENTISH.test(who) || /\b(the|and|of|i|we|it|you)\b/i.test(who) ? m : end));
  s = text.plain(s).replace(/\s+/g, ' ').trim();
  s = s.replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, '').trim();
  return s;
}

const wordCount = (s) => String(s || '').split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

// Pasted text -> [{ text, stars }]. Works on a plain list (one review per paragraph, or per line) and
// on what people copy off a review page (names, stars and dates between reviews). Owner replies are
// dropped. Same review twice counts once.
function splitReviews(raw, { max = 200 } = {}) {
  const src = String(raw || '').replace(/\r\n?/g, '\n').replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/\u00a0/g, ' ');
  const lines = src.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  const headers = lines.filter((l) => l && (isMeta(l) || starsOf(l) != null)).length;
  const blankSplit = headers < 2 && /\n[ \t]*\n/.test(src.trim());
  const lineSplit = headers < 2 && !blankSplit;
  const out = [];
  let cur = null;
  let owner = false;
  let blank = false;
  const flush = () => {
    if (cur && cur.parts.length) out.push(cur);
    cur = null;
  };
  for (const line of lines) {
    if (!line) {
      blank = true;
      continue;
    }
    if (OWNER.test(line)) {
      flush();
      owner = true;
      blank = false;
      continue;
    }
    const stars = starsOf(line);
    if (stars != null) {
      if (cur && cur.parts.length) flush();
      cur = cur || { parts: [], stars: null };
      cur.stars = stars;
      owner = false;
      blank = false;
      continue;
    }
    if (isMeta(line)) {
      // A date or profile line: the review before it is over (an owner reply's date keeps it skipped).
      if (cur && cur.parts.length) flush();
      blank = false;
      continue;
    }
    if (nameLike(line)) {
      // A name starts the next review on a copied page, or signs off the one before in a plain list.
      flush();
      owner = false;
      blank = false;
      continue;
    }
    if (owner) continue;
    if (cur && cur.parts.length && (lineSplit || (blankSplit && blank))) flush();
    cur = cur || { parts: [], stars: null };
    cur.parts.push(line);
    blank = false;
  }
  flush();
  const seen = new Set();
  const reviews = [];
  for (const r of out) {
    const t = text.clip(cleanReview(r.parts.join(' ')), 1500);
    const n = wordCount(t);
    if (n < 2 || (n < 3 && !POS_RE.test(t) && !NEG_RE.test(t))) continue;
    const k = t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 140);
    if (seen.has(k)) continue;
    seen.add(k);
    reviews.push({ text: t, stars: r.stars });
    if (reviews.length >= max) break;
  }
  return reviews;
}

// ---------- testimonials on a business's own website ----------

const SECTION_HEAD = /\b(testimonials?|reviews?|what (our |my )?(clients|customers|members|patients|students|families|guests|parents|people|neighbors|homeowners|owners) (are )?(say|saying|think)|kind words|love notes|happy (clients|customers|members|patients|families)|client stories|customer stories|success stories|hear from|in their words|word on the street)\b/i;
const TESTIMONIAL_CLASS = /(testimonial|review|feedback|kind-?words|client-?quote|customer-?quote|blockquote)/i;
const NOT_TESTIMONIAL_CLASS = /(quote-?(form|request|btn|button|cta)|get-?a-?quote|request-?a?-?quote|free-?quote|instant-?quote|review-?(form|us|link|button)|write-?a-?review|leave-?a-?review)/i;
const BOILER = /(cookie|privacy|copyright|all rights reserved|subscribe|newsletter|sign up|log ?in|terms of (use|service)|powered by|\bmenu\b|skip to content|add to cart|checkout|leave a review|write a review|review us on|rate us|see all reviews|read (all|more) reviews|reviews? on (google|yelp|facebook))/i;
const PERSONAL = /\b(i|i'm|i've|i'd|my|me|we|our|us|you|your|they|their|she|he|her|his)\b/i;

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|hellip|ndash|mdash);/gi, (m, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: '...', ndash: '-', mdash: '-' })[n.toLowerCase()]);
}
function safeChar(c) {
  try {
    return String.fromCodePoint(c);
  } catch {
    return ' ';
  }
}
// Names, dates and stars inside a testimonial block are left out (cite, footer, name or author classes).
const SIGNATURE = /<([a-z0-9]+)\b[^>]*class\s*=\s*["'][^"']*\b(name|author|cite|reviewer|client-?name|customer-?name|meta|date|rating|stars?)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
const stripTags = (h) => decodeEntities(String(h || '').replace(/<(script|style|noscript|svg|template|iframe|cite|footer|figcaption)\b[\s\S]*?<\/\1>/gi, ' ').replace(SIGNATURE, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').trim();

// The element that opens at `start` (its tag name read there), up to its matching close tag.
function elementAt(html, start) {
  const open = html.slice(start).match(/^<([a-z0-9]+)\b[^>]*>/i);
  if (!open) return '';
  const tag = open[1].toLowerCase();
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].endsWith('/>')) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
    if (re.lastIndex - start > 20000) break;
  }
  return html.slice(start, Math.min(html.length, start + 4000));
}

// Text pieces inside a block: paragraphs, quotes and list items, or the block's text when it has none.
function piecesOf(block) {
  const parts = (block.match(/<(p|blockquote|q|li|figcaption|span|div)\b[^>]*>[\s\S]*?<\/\1>/gi) || []).map(stripTags);
  const whole = stripTags(block);
  const usable = parts.filter((p) => wordCount(p) >= 8);
  return usable.length ? usable : [whole];
}

function testimonialText(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^["'\u201c\u2018]+/, '').replace(/["'\u201d\u2019]+(\s*[-~\u2013\u2014].*)?$/, '').trim();
  s = cleanReview(s);
  const n = wordCount(s);
  if (n < 8 || n > 160 || BOILER.test(s) || !PERSONAL.test(s)) return null;
  if (!POS_RE.test(s) && !NEG_RE.test(s) && !/["\u201c]/.test(t)) return null;
  return s;
}

// Testimonials a business shows on one of its own pages: schema.org reviews, quotes, blocks marked as
// testimonials or reviews, and paragraphs under a "What our customers say" heading. Names dropped.
function testimonialsFrom(html, { max = 20 } = {}) {
  const h = String(html || '');
  const found = [];
  const add = (t) => {
    const s = testimonialText(t);
    if (s && !found.some((x) => x.slice(0, 80) === s.slice(0, 80))) found.push(s);
  };
  for (const m of h.matchAll(/"reviewBody"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    try {
      add(JSON.parse(`"${m[1]}"`));
    } catch {
      /* not JSON text */
    }
  }
  for (const m of h.matchAll(/<(blockquote|q)\b[^>]*>([\s\S]*?)<\/\1>/gi)) add(stripTags(m[2]));
  for (const m of h.matchAll(/<([a-z0-9]+)\b[^>]*\b(class|id)\s*=\s*["']([^"']*)["'][^>]*>/gi)) {
    const cls = m[3];
    if (!TESTIMONIAL_CLASS.test(cls) || NOT_TESTIMONIAL_CLASS.test(cls)) continue;
    if (/^(script|style|form|input|button|a|img|svg)$/i.test(m[1])) continue;
    for (const p of piecesOf(elementAt(h, m.index))) add(p);
    if (found.length >= max) break;
  }
  // Paragraphs under a testimonial heading, up to the next heading.
  const heads = [...h.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  heads.forEach((m, i) => {
    if (!SECTION_HEAD.test(stripTags(m[2]))) return;
    const end = i + 1 < heads.length ? heads[i + 1].index : Math.min(h.length, m.index + 20000);
    const body = h.slice(m.index + m[0].length, end);
    for (const p of (body.match(/<(p|blockquote|q|li)\b[^>]*>[\s\S]*?<\/\1>/gi) || []).map(stripTags)) add(p);
  });
  return found.slice(0, max);
}

// The page on the same site that holds its testimonials or reviews, from the homepage's links.
function testimonialPage(html, base) {
  let site;
  try {
    site = new URL(base).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  for (const m of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try {
      u = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== site) continue;
    const label = `${stripTags(m[2])} ${u.pathname}`.toLowerCase();
    if (/\b(testimonials?|reviews?|kind words|client stories|success stories|what (our )?(clients|customers) say)\b/.test(label) && !/(write|leave|submit)[- ]a?[- ]?review/.test(label)) return u.toString();
  }
  return null;
}

// ---------- reading what people wrote ----------

// Praise and complaint words. Negated praise ("not friendly") counts as a complaint, negated
// complaints ("never late", "no problems") as praise.
const POS = ['great', 'good', 'amazing', 'awesome', 'excellent', 'fantastic', 'wonderful', 'perfect', 'perfectly', 'love', 'loved', 'loves', 'lovely', 'best', 'friendly', 'kind', 'nice', 'helpful', 'professional', 'recommend', 'recommended', 'highly', 'clean', 'spotless', 'fast', 'quick', 'quickly', 'prompt', 'promptly', 'efficient', 'on time', 'punctual', 'reliable', 'thorough', 'careful', 'attentive', 'knowledgeable', 'patient', 'welcoming', 'warm', 'gentle', 'fair', 'reasonable', 'affordable', 'worth it', 'worth every', 'honest', 'trustworthy', 'beautiful', 'delicious', 'fresh', 'tasty', 'comfortable', 'cozy', 'relaxing', 'happy', 'pleased', 'impressed', 'glad', 'outstanding', 'incredible', 'superb', 'top notch', 'five stars', '5 stars', 'exceeded', 'above and beyond', 'easy', 'smooth', 'seamless', 'responsive', 'flexible', 'accommodating', 'gorgeous', 'stunning', 'fun', 'enjoyed', 'favorite', 'favourite', 'gem', 'skilled', 'talented', 'caring', 'calm', 'sweet', 'courteous', 'polite', 'respectful', 'organized', 'detailed', 'quality', 'consistent', 'convenient', 'transparent', 'upfront', 'responsive', 'goes the extra mile', 'went the extra mile', 'took the time', 'takes the time', 'excited', 'will be back', 'be back', 'coming back', 'come back', 'will return', 'go back'];
const NEG = ['rude', 'unprofessional', 'slow', 'late', 'dirty', 'filthy', 'messy', 'expensive', 'overpriced', 'pricey', 'bland', 'stale', 'burnt', 'broken', 'damaged', 'missed', 'forgot', 'forgotten', 'ignored', 'disappointed', 'disappointing', 'terrible', 'awful', 'horrible', 'worst', 'bad', 'poor', 'poorly', 'mediocre', 'meh', 'sloppy', 'careless', 'wrong', 'mistake', 'mistakes', 'issue', 'issues', 'problem', 'problems', 'waited', 'long wait', 'wait time', 'waiting', 'took forever', 'too long', 'forever', 'no show', 'no-show', 'didn\'t show', 'cancelled', 'canceled', 'hidden fee', 'hidden fees', 'upcharge', 'upsell', 'upsold', 'pushy', 'scam', 'rip off', 'ripoff', 'refund', 'complain', 'complaint', 'unfortunately', 'sadly', 'frustrating', 'frustrated', 'annoying', 'annoyed', 'confusing', 'confused', 'hard to', 'difficult', 'crowded', 'loud', 'noisy', 'smelly', 'smelled', 'uncomfortable', 'rushed', 'unresponsive', 'never called', 'never heard', 'no response', 'never answered', 'won\'t be back', 'will not be back', 'never again', 'avoid', 'waste', 'lacking', 'cramped', 'cold food', 'nobody', 'no one', 'ghosted', 'condescending', 'dismissive', 'inconsistent', 'overbooked', 'double booked', 'short staffed', 'understaffed', 'not worth', 'could have been better', 'could be better', 'nothing special', 'just ok', 'just okay', 'so-so', 'average at best', 'steep', 'too high', 'bit high', 'little high', 'on the high side', 'pricy'];
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2019]").replace(/ /g, '\\s+');
const POS_RE = new RegExp(`\\b(${POS.map(esc).join('|')})\\b`, 'i');
const NEG_RE = new RegExp(`\\b(${NEG.map(esc).join('|')})\\b`, 'i');
const POS_G = new RegExp(POS_RE.source, 'gi');
const NEG_G = new RegExp(NEG_RE.source, 'gi');
const NEGATOR = /\b(not|never|no|hardly|barely|without|wasn'?t|isn'?t|weren'?t|aren'?t|didn'?t|don'?t|doesn'?t|won'?t|wouldn'?t|couldn'?t|can'?t|cannot|nothing|none|nobody|no one|less than)\b[^.!?,;]{0,22}$/i;
// Wishes and requests: what customers ask for that the business doesn't do (yet).
const ASK = /\b(i|we) (really )?wish\b|\bwish (they|you|there|it|the)\b|\bwould (love|like) (it )?(if|to see|more|a|an|some|them to)\b|\bwould (be|have been) (so |even |really )?(nice|great|better|good|awesome|helpful|perfect|amazing)( if| to| with)?\b|\b(i'?d|we'?d|i would|we would) love (to see|if|more|a|an|some|it if|them to)\b|\bhope (they|you) (add|offer|bring|open|start|get|have|expand|extend|consider)\b|\bif only\b|\bonly (wish|suggestion|request)\b|\b(should|could) (add|offer|open|start|consider|bring|extend)\b|\bplease (add|offer|bring|open|consider|start|extend|make|have)\b|\bmy (one |only )?suggestion\b|\bwould be (even )?better (if|with)\b|\bdo you (offer|have|do|sell)\b|\bwhy (don'?t|doesn'?t|can'?t) (they|you)\b|\b(any|no) (plans|chance) (to|of|for)\b|\bwould (definitely |totally |happily )?(come|go|be) back( more)?( often)? if\b|\bonly thing (missing|i'?d change|i would change)\b|\bneeds? (more|a|an|better|to add|to offer)\b|\bwould pay (more |extra )?for\b|\bnext time (i'?d|i would) love\b/i;
const MILD_COMPLAINT = /\bonly (thing|downside|complaint|issue|problem|con|negative|drawback)\b/i;

// Themes customers write about. Each sentence can touch more than one.
const THEMES = [
  { id: 'people', label: 'The people', about: 'the people', re: /\b(friendly|welcoming|caring|rude|attitude|staff|team|owners?|employees?|receptionist|front desk|manager|personable|patient|courteous|polite|respectful|condescending|dismissive|unprofessional|professional|people|teachers?|instructors?|trainers?|coach(es)?|stylists?|baristas?|groomers?|techs?|technicians?|doctors?|dentists?|hygienists?|nurses?|therapists?|crew|servers?|waiters?|waitress(es)?|bartenders?|cleaners?|walkers?|sitters?|tutors?|photographers?|mechanics?)\b/i },
  { id: 'speed', label: 'Speed and waiting', about: 'waiting and lateness', re: /\b(wait|waited|waiting|late|on time|punctual|quick|quickly|fast|prompt|promptly|slow|delay|delayed|forever|minutes|rushed|right away|same day|next day|showed up|no[- ]show|early|took (so )?long|too long)\b/i },
  { id: 'price', label: 'Price and value', about: 'the price', re: /\b(price|prices|priced|pricing|expensive|overpriced|pricey|cheap|affordable|reasonable|worth|value|cost|costs|fee|fees|charge|charged|deal|bill|quote|quoted|money|budget|upcharge|rip ?off)\b|\$\d/i },
  { id: 'quality', label: 'Quality of the work', about: 'the quality of the work', re: /\b(quality|job|work|results?|perfect|perfectly|thorough|detail|details|detailed|sloppy|missed|careful|careless|craftsmanship|precise|flawless|finish|finished|outcome|mistakes?|redo|re-?do|fixed|done right|cut|haircut|trim|fade|colou?r|groom|grooming|nails|massage|repairs?|install|installation|food|meals?|dish|dishes|coffee|pastr(y|ies)|cakes?|photos|pictures|sessions?|lessons?|workouts?|treatment)\b/i },
  { id: 'clean', label: 'A clean place', about: 'cleanliness', re: /\b(clean|cleanliness|dirty|filthy|spotless|tidy|messy|smell|smelled|smells|smelly|hygien\w*|sanitary|sanitized|gross)\b/i },
  { id: 'talk', label: 'Calls and replies', about: 'calls and replies', re: /\b(call(ed)? (me )?back|communicat\w*|responsive|unresponsive|response|responded|reply|replied|answer(ed|s)?|text(ed|s)?|email(ed|s)?|informed|kept (me|us) (posted|updated|informed)|updates?|voicemail|follow(ed)?[- ]up|heard back|ghosted|reach(ed)?)\b/i },
  { id: 'booking', label: 'Booking and scheduling', about: 'booking', re: /\b(book|booked|booking|appointments?|schedul\w*|reschedul\w*|availability|slots?|cancel\w*|waitlist|reservations?|reserve|overbooked|double booked)\b/i },
  { id: 'place', label: 'Getting there and parking', about: 'parking and getting there', re: /\b(parking|park|location|located|drive|convenient|close to|nearby|access|accessible|entrance|street|find (the|it|this) place|hard to find)\b/i },
  { id: 'hours', label: 'Opening hours', about: 'the opening hours', re: /\b(hours|opening times|open (late|early|on|until|till)|opens|closed (on|early|at)|closes|closing time|not open)\b/i },
  { id: 'skill', label: 'Know-how', about: 'know-how', re: /\b(knowledgeable|knows|knew|expert|expertise|skilled|skill|talented|experienced|explained|explains|explain|educated|trained|certified|advice|taught|teaches|know (their|what they)|knew (their|what they))\b/i },
  { id: 'crowd', label: 'Crowding', about: 'crowding', re: /\b(crowded|overcrowded|packed|cramped|too (busy|full)|so busy|class sizes?|capacity|too many people|elbow to elbow|almost touching|no room)\b/i },
  { id: 'feel', label: 'How the place feels', about: 'how the place feels', re: /\b(atmosphere|vibe|vibes|cozy|comfortable|uncomfortable|relaxing|calm|music|decor|loud|noisy|ambiance|ambience|environment|space|welcoming)\b/i },
  { id: 'choice', label: 'Choices on offer', about: 'the choices on offer', re: /\b(options|selection|variety|menu|choices?|flavors?|range|in stock|out of stock|vegan|vegetarian|gluten[- ]free)\b/i },
  { id: 'trust', label: 'Honesty and trust', about: 'honesty', re: /\b(honest|honesty|trust|trusted|trustworthy|upfront|up front|transparent|scam|hidden|upsell\w*|upsold|pushy|pressure|integrity)\b/i },
  { id: 'kids', label: 'Kids and families', about: 'kids and families', re: /\b(kids?|children|child|son|daughter|family|families|toddler|baby|teens?|my boys?|my girls?)\b/i },
  { id: 'pets', label: 'Pets', about: 'pets', re: /\b(dogs?|cats?|pets?|puppy|puppies|pup|pups|kitten|fur baby)\b/i },
];
const THEME = Object.fromEntries(THEMES.map((t) => [t.id, t]));
const GENERAL = { id: 'general', label: 'Overall', about: 'the visit overall' };

// Words customers use when they praise: specific ones a member can put in a headline.
const WORDS = ['friendly', 'kind', 'on time', 'fast', 'quick', 'thorough', 'clean', 'spotless', 'professional', 'patient', 'gentle', 'knowledgeable', 'honest', 'fair price', 'affordable', 'reasonable', 'reliable', 'responsive', 'easy', 'careful', 'attentive', 'welcoming', 'caring', 'calm', 'relaxing', 'cozy', 'fresh', 'delicious', 'beautiful', 'detailed', 'organized', 'flexible', 'consistent', 'convenient', 'fun', 'skilled', 'talented', 'trustworthy', 'transparent', 'upfront', 'polite', 'respectful', 'went above and beyond', 'took the time', 'explained everything'];
const WORD_RES = WORDS.map((w) => [w, new RegExp(`\\b${esc(w)}(?:s|es)?\\b`, 'i')]);

function sentencesOf(t) {
  return String(t || '')
    .split(/(?<=[.!?])\s+(?=["'\u201c(]?[A-Z0-9])|\n+/)
    .map((s) => s.trim())
    .filter((s) => wordCount(s) >= 2);
}
function clausesOf(sentence) {
  return String(sentence)
    .split(/\s*(?:;|,?\s+\b(?:but|however|although|though|except|yet|other than that|apart from that)\b,?)\s+/i)
    .map((c) => c.trim())
    .filter((c) => wordCount(c) >= 2);
}

function hits(re, s) {
  const out = [];
  for (const m of String(s).matchAll(re)) out.push({ word: m[0], at: m.index });
  return out;
}

// One clause -> 'praise' | 'complaint' | null, and whether it asks for something.
// "Can't wait to come back" is about coming back, not about waiting; "my bad knee" isn't a complaint.
const tidyClause = (c) =>
  String(c)
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\b(can'?t|cannot|couldn'?t) wait\b/gi, 'excited')
    .replace(/\bbad (knees?|backs?|hips?|shoulders?|ankles?|wrists?|necks?|feet|foot|legs?|hair day)\b/gi, 'sore $1');

function polarity(clause) {
  const s = tidyClause(clause);
  let score = 0;
  for (const h of hits(POS_G, s)) score += NEGATOR.test(s.slice(Math.max(0, h.at - 30), h.at)) ? -1 : 1;
  for (const h of hits(NEG_G, s)) {
    const before = s.slice(Math.max(0, h.at - 30), h.at);
    // "never late", "no problems", "not expensive": a complaint word turned around.
    score += NEGATOR.test(before) && !/\b(complaint|issue|problem)s?\b/i.test(h.word) ? 1 : NEGATOR.test(before) ? 0.5 : -1.2;
  }
  if (/\bno (problems?|issues?|complaints?)\b|\bnever (late|disappoint\w*)\b|\bnot (too )?(expensive|pricey)\b/i.test(s)) score += 1.5;
  if (/\b(fixed|solved|resolved|took care of|sorted out)\b[^.!?]{0,30}\b(problem|issue)s?\b/i.test(s)) score += 2;
  if (MILD_COMPLAINT.test(s)) score = Math.min(score, -1);
  const ask = ASK.test(s);
  const kind = score > 0.1 ? 'praise' : score < -0.1 ? 'complaint' : null;
  return { kind, ask };
}

const themesOf = (s) => THEMES.filter((t) => t.re.test(tidyClause(s))).map((t) => t.id);

// Quote a sentence (or the clause, when the sentence runs long): exact words, clipped at a word.
function quoteOf(sentence, clause) {
  const s = String(sentence || '').trim();
  const c = String(clause || s).trim();
  let q = s;
  if (c && c !== s && wordCount(c) >= 4) q = s.startsWith(c) ? c : `...${c}`;
  if (q.length > 190) q = `${q.slice(0, 180).replace(/\s+\S*$/, '')}...`;
  return q.replace(/^[,;\s]+/, '');
}

// Reviews [{ text, stars, from }] -> what customers praise, complain about and ask for, by theme, with
// exact short quotes, the words they use, and one row per review for the spreadsheet.
function mine(reviews) {
  const rows = [];
  const tally = {};
  const bump = (theme, kind, quote, i) => {
    const k = `${theme}|${kind}`;
    const t = (tally[k] = tally[k] || { theme, kind, reviews: new Set(), quotes: [] });
    if (!t.reviews.has(i)) {
      t.reviews.add(i);
      if (quote && t.quotes.length < 6 && !t.quotes.includes(quote)) t.quotes.push(quote);
    }
  };
  const asks = [];
  const words = {};
  reviews.forEach((r, i) => {
    const row = { n: i + 1, from: r.from || 'pasted', stars: r.stars == null ? null : r.stars, praise: new Set(), complaints: new Set(), asks: [], text: r.text };
    const seenWord = new Set();
    for (const sentence of sentencesOf(r.text)) {
      for (const clause of clausesOf(sentence)) {
        const p = polarity(clause);
        const ask = p.ask;
        // "It would be nice if..." is a wish, not praise.
        const kind = ask && p.kind === 'praise' ? null : p.kind;
        let themes = themesOf(clause);
        if (!themes.length && kind) themes = ['general'];
        const quote = quoteOf(sentence, clause);
        if (ask) {
          const q = quoteOf(sentence, clause);
          if (!asks.some((a) => a.text === q)) asks.push({ text: q, themes: themesOf(clause), review: i });
          row.asks.push(q);
        }
        if (kind === 'praise') {
          themes.forEach((t) => {
            row.praise.add(t);
            bump(t, 'praise', quote, i);
          });
          for (const [w, re] of WORD_RES) {
            const c = tidyClause(clause);
            if (!seenWord.has(w) && re.test(c) && !NEGATOR.test(c.slice(0, Math.max(0, c.search(re))).slice(-30))) {
              seenWord.add(w);
              words[w] = (words[w] || 0) + 1;
            }
          }
        } else if (kind === 'complaint') {
          themes.forEach((t) => {
            row.complaints.add(t);
            bump(t, 'complaint', quote, i);
          });
        }
      }
    }
    // A low star rating with no complaint words still says something was off.
    if (r.stars != null && r.stars <= 2 && !row.complaints.size) {
      row.complaints.add('general');
      bump('general', 'complaint', quoteOf(sentencesOf(r.text)[0] || r.text), i);
    }
    rows.push(row);
  });
  const list = (kind) =>
    Object.values(tally)
      .filter((t) => t.kind === kind)
      .map((t) => {
        const th = THEME[t.theme] || GENERAL;
        return { id: t.theme, label: th.label, about: th.about, n: t.reviews.size, quotes: t.quotes.slice(0, 3) };
      })
      .sort((a, b) => b.n - a.n || (a.id === 'general') - (b.id === 'general') || a.label.localeCompare(b.label));
  const starred = reviews.filter((r) => r.stars != null);
  const stars = starred.length ? { rated: starred.length, average: Math.round((starred.reduce((s, r) => s + r.stars, 0) / starred.length) * 10) / 10, counts: [5, 4, 3, 2, 1].map((s) => ({ stars: s, n: starred.filter((r) => r.stars === s).length })) } : null;
  return {
    total: reviews.length,
    praise: list('praise'),
    complaints: list('complaint'),
    asks: asks.slice(0, 12).map((a) => ({ text: a.text, themes: a.themes })),
    words: Object.entries(words)
      .map(([word, n]) => ({ word, n }))
      .sort((a, b) => b.n - a.n || a.word.localeCompare(b.word))
      .slice(0, 10),
    stars,
    counts: { praise: rows.filter((r) => r.praise.size).length, complaints: rows.filter((r) => r.complaints.size).length, asks: rows.filter((r) => r.asks.length).length },
    rows: rows.map((r) => ({ ...r, praise: [...r.praise], complaints: [...r.complaints] })),
  };
}

module.exports = { REVIEW_HOSTS, refusedHost, splitReviews, cleanReview, starsOf, nameLike, testimonialsFrom, testimonialPage, polarity, themesOf, mine, THEMES, THEME, GENERAL, WORDS };
