// Rank the member's own posts from numbers they export or paste from their own accounts. Nothing
// here fetches or scrapes anything: the only input is their file or their paste.
//
// The score: 100 is their typical post. Half of it is how many people saw the post, against their
// usual views. Half is what those people did per view (saves, shares and follows count more than a
// like), pulled toward their usual rate when few people saw it, so a post seen by 40 people can't
// top the list by luck. Then posts are grouped by format, kind of post, hook style, day and time,
// and only groups with 2 or more posts are compared. Asks (offer posts) are judged by comments,
// since that is where keyword replies land, and are never on the do-less list.

const { text, time } = require('../../_kit');
const { PILLARS } = require('./hooks');
const { lowerFirst } = require('./niches');

const lc = lowerFirst;

// Header words from common exports and hand-made sheets, after lowercasing and dropping anything
// in brackets ("Views (excluding off-site video views)" -> "views").
const FIELDS = {
  date: ['posted', 'date posted', 'post date', 'posted on', 'publish time', 'published', 'publish date', 'published date', 'date published', 'video publish time', 'created', 'created date', 'created time', 'date created', 'post time', 'time posted', 'date', 'date and time', 'time', 'day'],
  caption: ['caption', 'description', 'title', 'post', 'text', 'message', 'content', 'video title', 'update title', 'post title', 'hook', 'first line', 'post text', 'video description', 'post caption'],
  link: ['permalink', 'link', 'url', 'post link', 'video link', 'update link', 'post url'],
  type: ['type', 'post type', 'format', 'media type', 'content type', 'update type', 'media product type', 'kind', 'kind of post'],
  views: ['views', 'plays', 'video views', 'total views', 'reel plays', 'video plays', 'views count'],
  reach: ['reach', 'accounts reached', 'post reach', 'unique viewers'],
  impressions: ['impressions', 'post impressions', 'total impressions'],
  likes: ['likes', 'reactions', 'total likes', 'like count', 'likes and reactions', 'hearts'],
  comments: ['comments', 'total comments', 'replies', 'comment count'],
  shares: ['shares', 'total shares', 'reposts', 'sends', 'share count', 'retweets', 'reshares'],
  saves: ['saves', 'saved', 'total saves', 'bookmarks', 'favorites', 'total favorites', 'save count'],
  follows: ['follows', 'new followers', 'followers gained', 'follows from post', 'subscribers', 'subscribers gained', 'new subscribers'],
  clicks: ['clicks', 'link clicks', 'website clicks', 'total clicks', 'link taps'],
};
const METRICS = ['likes', 'comments', 'shares', 'saves', 'follows', 'clicks'];
const WEIGHT = { likes: 1, comments: 2, shares: 3, saves: 3, follows: 5, clicks: 2 };
const LABEL = { views: 'Views', reach: 'Reach', impressions: 'Impressions', likes: 'Likes', comments: 'Comments', shares: 'Shares', saves: 'Saves', follows: 'Follows', clicks: 'Clicks' };
const MAX_POSTS = 500;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normHead = (h) => String(h || '').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[_\-:]+/g, ' ').replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();

// Comma, tab or semicolon, from the header line. A paste from a sheet has tabs.
function delimiterOf(s) {
  const line = String(s || '').split(/\r?\n/).find((l) => l.trim()) || '';
  const count = (c) => line.split(c).length - 1;
  if (count('\t')) return '\t';
  return count(';') > count(',') ? ';' : ',';
}

function parseTable(s) {
  const d = delimiterOf(s);
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const t = String(s || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"' && !cell.trim()) q = true;
    else if (ch === d) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

// Which column is which. Exact header words first, in the order of the word lists, then a header
// that contains one (but never a rate, an average or a combined column like "Comments and shares").
// With rows to look at, the date is the column whose cells read as dates, and the caption is the
// one with the most words (a video ID column called "Content" loses to "Video title").
function mapColumns(head, body = []) {
  const norm = head.map(normHead);
  const idx = {};
  const used = new Set();
  const sample = body.slice(0, 40);
  const filled = (j) => sample.filter((r) => String(r[j] || '').trim()).length;
  const order = dateOrder(sample.map((r) => r.find((c) => /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/.test(String(c || '').trim())) || ''));
  const dateLike = (j) => !sample.length || sample.filter((r) => parseDate(r[j], order)).length >= Math.max(1, filled(j) * 0.5);
  const words = (j) => sample.reduce((n, r) => n + Math.min(12, String(r[j] || '').split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length), 0);
  for (const [k, list] of Object.entries(FIELDS)) {
    const cands = [];
    for (const w of list) norm.forEach((h, j) => { if (h === w && !used.has(j) && !cands.includes(j)) cands.push(j); });
    let i = cands[0];
    if (k === 'date') i = cands.find(dateLike);
    if (k === 'caption' && sample.length && cands.length > 1) i = [...cands].sort((a, b) => words(b) - words(a))[0];
    if (i != null && i >= 0) { idx[k] = i; used.add(i); }
  }
  const skip = /\b(rate|average|avg|per|percent|duration|watch|time watched|and|or|ratio|cost|spend|paid|organic share)\b/;
  for (const k of ['views', 'reach', 'impressions', ...METRICS, 'caption']) {
    if (idx[k] != null) continue;
    const i = norm.findIndex((h, j) => !used.has(j) && !skip.test(h) && FIELDS[k].some((w) => new RegExp(`\\b${w}\\b`).test(h)));
    if (i >= 0) { idx[k] = i; used.add(i); }
  }
  return idx;
}

// "1,234" "1.2K" "3.4M" "12%" "1 234" "1.234" (thousands) "12,5" (decimal comma). Blank or "-" is null.
function num(v) {
  const s = String(v == null ? '' : v).trim().replace(/[\s\u00a0\u202f']/g, '');
  if (!s || /^[-\u2013\u2014]+$/.test(s) || /^(n\/?a|none|null)$/i.test(s)) return null;
  const m = s.match(/^([+-]?[\d.,]+)([kmb])?%?$/i);
  if (!m) return null;
  let n = m[1];
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  if (mult > 1) n = n.replace(',', '.');
  else if (/^\d{1,3}([.,]\d{3})+$/.test(n)) n = n.replace(/[.,]/g, '');
  else if (/^\d+,\d{1,2}$/.test(n)) n = n.replace(',', '.');
  else n = n.replace(/,/g, '');
  const x = parseFloat(n);
  return Number.isFinite(x) ? Math.round(x * mult * 100) / 100 : null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');

function hour24(h, ap) {
  let x = Number(h);
  const a = String(ap || '').toLowerCase().replace(/\./g, '');
  if (a === 'pm' && x < 12) x += 12;
  if (a === 'am' && x === 12) x = 0;
  return x;
}

// One date cell -> { date: 'YYYY-MM-DD', hour, minute } or null. order is 'mdy' or 'dmy' for
// 09/01/2026-style dates (worked out across the whole file).
function parseDate(v, order = 'mdy') {
  const s = String(v || '').trim().replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, '');
  if (!s) return null;
  let y; let mo; let d; let h = null; let mi = null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]];
  if (!m) {
    m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?)?/i);
    if (m) {
      [mo, d] = order === 'dmy' ? [m[2], m[1]] : [m[1], m[2]];
      y = m[3].length === 2 ? `20${m[3]}` : m[3];
      if (m[4] != null) { h = hour24(m[4], m[6]); mi = m[5]; }
    }
  }
  if (!m) {
    m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i);
    if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) {
      [mo, d, y] = [MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, m[2], m[3]];
      if (m[4] != null) { h = hour24(m[4], m[6]); mi = m[5]; }
    } else m = null;
  }
  if (!m) {
    m = s.match(/^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i);
    if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) {
      [d, mo, y] = [m[1], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, m[3]];
      if (m[4] != null) { h = hour24(m[4], m[6]); mi = m[5]; }
    } else m = null;
  }
  if (!m) return null;
  [y, mo, d] = [Number(y), Number(mo), Number(d)];
  if (!(y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  if (time.addDays(date, 0) !== date) return null;
  const hour = h != null && Number(h) <= 23 ? Number(h) : null;
  return { date, hour, minute: hour != null ? Number(mi) || 0 : null };
}

function dateOrder(cells) {
  for (const c of cells) {
    const m = String(c || '').trim().match(/^(\d{1,2})[/.](\d{1,2})[/.]\d{2,4}/);
    if (m && Number(m[1]) > 12) return 'dmy';
  }
  return 'mdy';
}

// Reel, video, carousel, photo... in a few plain groups, keeping the member's own word when they
// always use the same one.
function formatKey(type) {
  const t = String(type || '').toLowerCase();
  if (!t) return '';
  if (/\blive\b/.test(t)) return 'live';
  if (/reel|video|short|clip|igtv|tiktok/.test(t)) return 'video';
  if (/carousel|album|multi|document|slide|swipe/.test(t)) return 'carousel';
  if (/stor(y|ies)/.test(t)) return 'story';
  if (/photo|image|picture|pic|still/.test(t)) return 'photo';
  if (/link|article|share/.test(t)) return 'link';
  if (/text|status|thread|post|tweet/.test(t)) return 'text';
  return 'other';
}
const FORMAT_LABEL = { video: 'Video', carousel: 'Carousel', photo: 'Photo', story: 'Story', link: 'Link post', text: 'Text post', live: 'Live', other: 'Other' };
const FORMAT_PLURAL = { video: 'videos', carousel: 'carousels', photo: 'photos', story: 'stories', link: 'link posts', text: 'text posts', live: 'lives', other: 'other posts' };

const PILLAR_NAME = Object.fromEntries(PILLARS.map((p) => [p.key, p.name]));

// The kind of post, read from the first sentence (the hook) first, so a myth post that ends with
// "Comment QUOTE" still counts as a myth post.
const KIND_RULES = [
  ['proof', /before (and|&) after|before\/after|transformation|the result|results?\b|finished|customer|client said|review|real job|this week'?s job/i],
  ['myths', /\bmyths?\b|mistakes?|^(stop|don'?t|never|avoid|quit)\b|\bwrong\b|people (still )?believe|truth about|\bruin(s|ing)?\b|\bwast(e|ing)\b/i],
  ['bts', /behind the scenes|day in (the|my) life|full day|\bmy (\w+ )?(kit|setup|tools|van|truck|studio|day|morning|routine|gear)\b|what happens|step by step|how i (do|clean|prep|pack|make)|come with me|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i],
  ['teach', /\bhow\b|\bwhy\b|\bwhat\b|\bwhen\b|\bwhich\b|\btips?\b|\bsigns?\b|\bsteps?\b|\bguide\b|\bshould\b|\bneeds?\b|\?/i],
];
const ASK = /comment [A-Z0-9]{2,}\b|\bdm me\b|\bbook (now|today|a|your)\b|\bnow booking\b|\bspots? (left|open)\b|\bprice list\b|\$\s?\d|link in bio|\bcall (me|us|now)\b/;
const ASK_START = /^(comment|dm|book|call|text me|message me|grab|now booking|booking|spots?)\b|^(want|need|ready)\b.*\b(comment|dm|book|call|text|message|link)\b|^if you (live|are|work) (in|near|around)\b/i;

function firstSentence(s) {
  return String(s || '').trim().split(/(?<=[.!?])\s+|\n+/)[0] || '';
}

function kindOf(caption) {
  const c = String(caption || '').trim();
  if (!c) return '';
  const hook = firstSentence(c);
  if (ASK_START.test(hook) || /^.{0,40}\$\s?\d/.test(hook)) return 'offer';
  for (const [k, re] of KIND_RULES) if (re.test(hook)) return k;
  for (const [k, re] of KIND_RULES) if (re.test(c)) return k;
  return ASK.test(c) ? 'offer' : '';
}

// Hook styles a post can have (more than one), from its first sentence.
const HOOKS = [
  { key: 'number', label: 'Starts with a number', verb: 'start with a number', test: (h) => /^\d+\s+[a-z]/i.test(h) },
  { key: 'question', label: 'Asks a question', verb: 'ask a question', test: (h) => /\?\s*$/.test(h) || /^(how|why|what|when|which|is|are|do|does|should|can)\b[^.!]*$/i.test(h) },
  { key: 'before', label: 'Before and after', verb: 'promise a before and after', test: (h) => /before (and|&) after|before\/after/i.test(h) },
  { key: 'warning', label: 'A warning or mistake', verb: 'warn about a mistake', test: (h) => /^(stop|don'?t|never|avoid|quit)\b|mistakes?\b|\bmyths?\b/i.test(h) },
  { key: 'local', label: 'Names your area', verb: 'name your area', test: (h, f) => [f.where, f.city, f.area].filter(Boolean).some((w) => h.toLowerCase().includes(String(w).toLowerCase())) },
  { key: 'price', label: 'Says the price', verb: 'say the price', test: (h) => /\$\s?\d|\bprice\b|\bcosts?\b/i.test(h) },
  { key: 'tease', label: 'Teases the ending', verb: 'tease the ending', test: (h) => /watch this|wait for|wait till|until the end|last (shot|one|clip)/i.test(h) },
  { key: 'here', label: 'Plain "here is"', verb: 'start with a plain "here is"', test: (h) => /^(here is|here's|this is|just|another)\b/i.test(h) },
];

function timeBucket(h) {
  if (h == null) return '';
  if (h >= 4 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'midday';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'late';
}
const TIME_LABEL = { morning: 'Morning (before 11 am)', midday: 'Midday (11 am to 3 pm)', afternoon: 'Afternoon (3 to 6 pm)', evening: 'Evening (6 to 10 pm)', late: 'Late night' };
const TIME_SHORT = { morning: 'in the morning', midday: 'around midday', afternoon: 'in the afternoon', evening: 'in the evening', late: 'late at night' };

function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Text in -> posts out, or { error } in plain words.
function readPosts(raw, f = {}) {
  const rows = parseTable(raw);
  if (!rows.length) return { error: 'There are no rows to read. Add your export, or paste your posts with a header row on top.' };
  let h = -1;
  let idx = null;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const m = mapColumns(rows[i], rows.slice(i + 1));
    const metrics = ['views', 'reach', 'impressions', ...METRICS].filter((k) => m[k] != null);
    if (metrics.length >= 1 && Object.keys(m).length >= 2) { h = i; idx = m; break; }
  }
  if (h < 0) return { error: 'I couldn\'t find a views, likes or comments column. Put a header row on top, like: Date, Caption, Type, Views, Likes, Comments, Shares, Saves.' };
  const body = rows.slice(h + 1);
  const order = idx.date != null ? dateOrder(body.map((r) => r[idx.date])) : 'mdy';
  const cell = (r, k) => (idx[k] != null ? r[idx[k]] : '');
  const posts = [];
  for (const r of body) {
    const first = String(r[0] || '').trim().toLowerCase();
    if (first === 'total' || first === 'totals' || /^(lifetime|daily)\b/.test(first)) continue;
    const vals = {};
    for (const k of ['views', 'reach', 'impressions', ...METRICS]) vals[k] = idx[k] != null ? num(cell(r, k)) : null;
    if (!Object.values(vals).some((x) => x != null)) continue;
    const when = idx.date != null ? parseDate(cell(r, 'date'), order) : null;
    const caption = text.oneLine(cell(r, 'caption'));
    const link = /^https?:\/\/[^\s"<>]+$/i.test(cell(r, 'link')) ? cell(r, 'link') : '';
    const type = text.oneLine(cell(r, 'type'));
    posts.push({ row: posts.length + 1, date: when ? when.date : '', hour: when ? when.hour : null, minute: when ? when.minute : null, caption, link, type, ...vals });
  }
  if (!posts.length) return { error: 'The header is there, but no row has numbers under it. Check that each post is one row.' };
  // Newest first if there are too many.
  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const dropped = Math.max(0, posts.length - MAX_POSTS);
  const kept = posts.slice(0, MAX_POSTS);
  const has = Object.fromEntries(['date', 'caption', 'link', 'type', 'views', 'reach', 'impressions', ...METRICS].map((k) => [k, idx[k] != null && kept.some((p) => (k === 'date' ? p.date : k === 'caption' || k === 'link' || k === 'type' ? p[k] : p[k] != null))]));
  has.hour = kept.some((p) => p.hour != null);
  return { posts: kept, has, dropped, columns: Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, rows[h][i]])) };
}

// Score every post. See the note at the top of this file.
function scorePosts(read, f = {}) {
  const { posts, has } = read;
  const metrics = METRICS.filter((k) => has[k]);
  const base = has.views ? 'views' : has.reach ? 'reach' : has.impressions ? 'impressions' : '';
  const seen = (p) => (p[base] != null ? p[base] : base === 'views' ? p.reach ?? p.impressions ?? null : null);
  const fmtWords = {};
  for (const p of posts) {
    p.actions = metrics.reduce((n, k) => n + WEIGHT[k] * (p[k] || 0), 0);
    p.seen = base ? seen(p) : null;
    p.format = formatKey(p.type);
    const word = text.sentenceCase(String(p.type || '').replace(/^(ig|fb|instagram|facebook|tiktok|yt|youtube|linkedin|li)\s+/i, '').toLowerCase());
    if (p.format && word) (fmtWords[p.format] = fmtWords[p.format] || new Set()).add(word);
    p.kind = kindOf(p.caption);
    const hook = firstSentence(p.caption);
    p.hooks = p.caption ? HOOKS.filter((x) => x.test(hook, f)).map((x) => x.key) : [];
    p.weekday = p.date ? time.weekdayOf(p.date) : null;
    p.when = timeBucket(p.hour);
  }
  const medSeen = base ? median(posts.map((p) => p.seen).filter((x) => x > 0)) || 1 : 0;
  if (base) {
    const withSeen = posts.filter((p) => p.seen > 0);
    const pooled = withSeen.reduce((n, p) => n + p.actions, 0) / Math.max(1, withSeen.reduce((n, p) => n + p.seen, 0));
    for (const p of posts) {
      const v = p.seen > 0 ? p.seen : medSeen;
      p.rate = metrics.length ? ((p.actions + medSeen * pooled) / (v + medSeen)) * 1000 : 0;
      p.reachIdx = Math.min(v / medSeen, 5);
    }
    const medRate = median(posts.map((p) => p.rate)) || 1;
    for (const p of posts) {
      p.rateIdx = metrics.length ? Math.min(p.rate / medRate, 5) : null;
      p.raw = p.rateIdx == null ? p.reachIdx : 0.5 * p.reachIdx + 0.5 * p.rateIdx;
    }
  } else {
    const medA = median(posts.map((p) => p.actions)) || posts.reduce((n, p) => n + p.actions, 0) / posts.length || 1;
    for (const p of posts) {
      p.rate = null;
      p.reachIdx = null;
      p.rateIdx = Math.min(p.actions / medA, 5);
      p.raw = p.rateIdx;
    }
  }
  const medRaw = median(posts.map((p) => p.raw)) || 1;
  for (const p of posts) p.score = Math.round((100 * p.raw) / medRaw);
  const ranked = [...posts].sort((a, b) => b.score - a.score || (b.seen || 0) - (a.seen || 0) || (b.date || '').localeCompare(a.date || ''));
  ranked.forEach((p, i) => { p.rank = i + 1; });
  const formatLabel = (k) => (fmtWords[k] && fmtWords[k].size === 1 ? [...fmtWords[k]][0] : FORMAT_LABEL[k] || 'Other');
  for (const p of ranked) p.formatLabel = p.format ? formatLabel(p.format) : '';
  return { ranked, base, metrics, medSeen: Math.round(medSeen), formatLabel };
}

// Plain reasons for one post's place.
function reasonFor(p, base) {
  const out = [];
  const seenWord = base === 'reach' ? 'reached' : 'seen by';
  if (p.reachIdx != null) {
    if (p.reachIdx >= 1.4) out.push(`${seenWord} ${p.reachIdx >= 4.95 ? 'over 5' : p.reachIdx.toFixed(1)} times your usual number of people`);
    else if (p.reachIdx <= 0.6) out.push(`${seenWord} fewer people than usual`);
  }
  if (p.rateIdx != null) {
    if (p.rateIdx >= 1.25) out.push(base ? 'more saves, shares and comments per view than usual' : 'more saves, shares and comments than usual');
    else if (p.rateIdx <= 0.75) out.push(base ? 'fewer saves, shares and comments per view than usual' : 'fewer saves, shares and comments than usual');
  }
  if (!out.length) out.push('close to your usual post');
  return text.sentenceCase(out.join(', and '));
}

// Groups of 2 or more posts, by format, kind of post, hook style, weekday and time of day.
function groupsOf(ranked, f, formatLabel) {
  const dims = [
    { by: 'format', title: 'Format', key: (p) => (p.format ? [p.format] : []), label: (k) => formatLabel(k) },
    { by: 'kind', title: 'Kind of post', key: (p) => (p.kind ? [p.kind] : []), label: (k) => PILLAR_NAME[k] },
    { by: 'hook', title: 'Hook style', key: (p) => p.hooks, label: (k) => HOOKS.find((x) => x.key === k).label },
    { by: 'day', title: 'Day', key: (p) => (p.weekday != null ? [String(p.weekday)] : []), label: (k) => WEEKDAY_NAMES[Number(k)] },
    { by: 'time', title: 'Time of day', key: (p) => (p.when ? [p.when] : []), label: (k) => TIME_LABEL[k] },
  ];
  const out = [];
  for (const d of dims) {
    const m = new Map();
    for (const p of ranked) for (const k of d.key(p)) (m.get(k) || m.set(k, []).get(k)).push(p);
    // A comparison needs at least two groups that each have 2 or more posts (a hook style is
    // compared with the typical post, 100).
    const big = [...m.keys()].filter((k) => m.get(k).length >= 2);
    if (big.length < (d.by === 'hook' ? 1 : 2)) continue;
    for (const k of big) {
      const ps = m.get(k);
      out.push({ by: d.by, title: d.title, key: k, label: d.label(k), n: ps.length, score: Math.round(median(ps.map((p) => p.score))), comments: Math.round(median(ps.map((p) => p.comments || 0))), best: ps[0].rank, ids: ps.map((p) => p.row) });
    }
  }
  return out;
}

// "North Austin car, before and after" or "the one from Tue, Sep 8".
const quoteOf = (p) => (p.caption ? `"${text.clip(firstSentence(p.caption).replace(/[.!]+$/, ''), 70)}"` : p.date ? `the one from ${time.shortDate(p.date)}` : `row ${p.row} of your file`);

// "reels" when the member calls them reels, "videos" otherwise.
function fmtPlural(g) {
  if (g.label === FORMAT_LABEL[g.key]) return FORMAT_PLURAL[g.key] || 'posts like these';
  const w = g.label.toLowerCase();
  return /s$/.test(w) ? w : `${w}s`;
}

const KIND_MORE = {
  teach: 'More posts that answer a question or teach one thing.',
  myths: 'More posts about mistakes and myths.',
  proof: 'More posts that show a real job, like a before and after.',
  bts: 'More behind-the-scenes posts.',
  offer: 'More clear asks.',
};
const KIND_LESS = {
  teach: 'Fewer general tips, or open them with the exact question people ask.',
  myths: 'Fewer mistakes and myths posts, or open them with the mistake itself.',
  proof: 'Fewer plain result posts, or show the before first so people wait for the after.',
  bts: 'Fewer plain behind-the-scenes posts, or give each one a reason to watch in the first line.',
};
const KIND_LIKE = { teach: 'teaching', myths: 'mistakes and myths', proof: 'real-job', bts: 'behind-the-scenes', offer: 'ask' };

// "Thursday evenings" when a day's posts all went up at the same time of day.
function whenWords(g, ranked) {
  const ps = ranked.filter((p) => g.ids.includes(p.row));
  const days = new Set(ps.map((p) => p.weekday));
  const times = new Set(ps.map((p) => p.when));
  const dayName = (d) => WEEKDAY_NAMES[Number(d)];
  const timeWord = { morning: 'mornings', midday: 'middays', afternoon: 'afternoons', evening: 'evenings', late: 'late nights' };
  if (g.by === 'day') return times.size === 1 && [...times][0] ? `${dayName(g.key)} ${timeWord[[...times][0]]}` : `${dayName(g.key)}s`;
  return days.size === 1 && [...days][0] != null ? `${dayName([...days][0])} ${timeWord[g.key]}` : TIME_SHORT[g.key];
}

function moreText(g, ranked) {
  const n = g.n;
  const typical = `typical score of ${g.score}`;
  if (g.by === 'format') return `More ${fmtPlural(g)}. Your ${n} had a ${typical}.`;
  if (g.by === 'kind') return `${KIND_MORE[g.key]} Your ${n} had a ${typical}.`;
  if (g.by === 'hook') return `More hooks that ${HOOKS.find((x) => x.key === g.key).verb}. Your ${n} posts with one had a ${typical}.`;
  const w = whenWords(g, ranked);
  return `Post ${/^(in|around|late) /.test(w) ? w : `on ${w}`}. Your ${n} posts then had a ${typical}.`;
}

function lessText(g, ranked) {
  const n = g.n;
  const typical = `typical score of ${g.score}`;
  if (g.by === 'format') return `Fewer ${fmtPlural(g)}, or put the same idea in your best format. Your ${n} had a ${typical}.`;
  if (g.by === 'kind') return `${KIND_LESS[g.key]} Your ${n} had a ${typical}.`;
  if (g.by === 'hook') return `Fewer hooks that ${HOOKS.find((x) => x.key === g.key).verb}. Your ${n} posts with one had a ${typical}.`;
  const w = whenWords(g, ranked);
  return `Move posts away from ${/^(in|around|late) /.test(w) ? w.replace(/^(in|around) the /, '').replace(/^late at night$/, 'late nights') : w}. Your ${n} posts then had a ${typical}.`;
}

// "All 4 went up on Wednesday mornings, so the time may be part of it." When a group of posts
// shares one slot, the post and the time can't be told apart, so we say so.
function sameTime(g, ranked, better) {
  const ps = ranked.filter((p) => g.ids.includes(p.row));
  if (ps.length < 2 || ps.some((p) => p.weekday == null)) return '';
  const days = new Set(ps.map((p) => p.weekday));
  const times = new Set(ps.map((p) => p.when));
  const timeWord = { morning: 'mornings', midday: 'middays', afternoon: 'afternoons', evening: 'evenings', late: 'late nights' };
  const t = [...times][0];
  let slot = '';
  if (days.size === 1 && times.size === 1 && t) slot = `on ${WEEKDAY_NAMES[[...days][0]]} ${timeWord[t]}`;
  else if (times.size === 1 && t) slot = TIME_SHORT[t];
  else if (days.size === 1) slot = `on a ${WEEKDAY_NAMES[[...days][0]]}`;
  if (!slot) return '';
  // Only when (almost) nothing else went up in that slot: then the post and the time can't be told apart.
  const inSlot = ranked.filter((p) => (days.size === 1 ? p.weekday === [...days][0] : true) && (times.size === 1 ? p.when === t : true));
  if (inSlot.length > ps.length * 1.25) return '';
  const all = ps.length === 2 ? 'Both' : `All ${ps.length}`;
  const tryIt = better && !better.includes(slot.replace(/^(on|in) (a |the )?/, '')) ? ` Post the next one ${/^(in|around|late) /.test(better) ? better : `on ${better}`} to find out.` : '';
  return ` ${all} went up ${slot}, so the time may be part of it.${tryIt}`;
}

// How much two groups are the same posts: shared posts over the bigger group.
function overlap(a, b) {
  const A = new Set(a.ids);
  return b.ids.filter((x) => A.has(x)).length / Math.max(1, a.ids.length, b.ids.length);
}

// One group per kind of comparison, and never two that are mostly the same posts.
function pick(cands, max, taken = []) {
  const out = [];
  const usedBy = new Set();
  for (const g of cands) {
    if (usedBy.has(g.by) || [...taken, ...out].some((x) => overlap(x, g) >= 0.8)) continue;
    out.push(g);
    usedBy.add(g.by);
    if (out.length >= max) break;
  }
  return out;
}

// Everything the page, the CSV and the view need.
function rankPosts(read, f = {}) {
  const s = scorePosts(read, f);
  const { ranked, base } = s;
  for (const p of ranked) p.why = reasonFor(p, base);
  const groups = groupsOf(ranked, f, s.formatLabel);
  const n = ranked.length;
  const CONTENT = new Set(['kind', 'format', 'hook']);
  // Bigger groups count for more: a score of 130 from 8 posts beats 140 from 2.
  const lift = (g) => (g.score - 100) * Math.sqrt(g.n);
  const desc = (a, b) => lift(b) - lift(a);
  const asc = (a, b) => lift(a) - lift(b);
  // Do more: up to 3 things about the posts themselves and 1 about timing. Do less: up to 2 and 1.
  // Asks are never on the do-less list: they get fewer likes by nature and are judged by comments.
  const upC = pick(groups.filter((g) => CONTENT.has(g.by) && g.score >= 115).sort(desc), 3);
  const upT = pick(groups.filter((g) => !CONTENT.has(g.by) && g.n >= 3 && g.score >= 125).sort(desc), 1, upC);
  const notAsk = (g) => !(g.by === 'kind' && g.key === 'offer') && !(g.by === 'hook' && g.key === 'price');
  const downC = pick(groups.filter((g) => CONTENT.has(g.by) && g.score <= 80 && notAsk(g)).sort(asc), 2, upC);
  const downT = pick(groups.filter((g) => !CONTENT.has(g.by) && g.n >= 3 && g.score <= 75).sort(asc), 1, [...upT, ...downC]);
  const strip = ({ ids, ...g }) => g;
  const better = upT[0] ? whenWords(upT[0], ranked) : '';
  const doMore = [...upC, ...upT].map((g) => ({ ...strip(g), text: `${moreText(g, ranked)}${CONTENT.has(g.by) ? sameTime(g, ranked, '') : ''}` }));
  const doLess = [...downC, ...downT].map((g) => ({ ...strip(g), text: `${lessText(g, ranked)}${CONTENT.has(g.by) ? sameTime(g, ranked, better) : ''}` }));

  // Try next: concrete moves from the top posts and the gaps.
  const next = [];
  const top = ranked[0];
  if (top) next.push(`Make a part 2 of your top post, ${quoteOf(top)}: same kind of hook, a new ${f.short || 'example'}. It scored ${top.score}.`);
  const second = ranked.find((p) => p !== top && p.kind && p.kind !== top.kind && p.kind !== 'offer');
  if (second && second.score >= 115) next.push(`Do another ${KIND_LIKE[second.kind]} post. Your best one, ${quoteOf(second)}, scored ${second.score}.`);
  const asks = ranked.filter((p) => p.kind === 'offer');
  if (asks.length && read.has.comments) {
    const bestAsk = [...asks].sort((a, b) => (b.comments || 0) - (a.comments || 0))[0];
    next.push(`Judge your asks by comments, since that is where keyword replies land. Your best ask, ${quoteOf(bestAsk)}, got ${text.plural(bestAsk.comments || 0, 'comment')}: reuse its wording${f.keyword ? ` and your keyword ${f.keyword}` : ''}.`);
  } else if (!asks.length && ranked.some((p) => p.caption)) next.push(`None of these captions has a clear ask. Make every fourth post one${f.ctaLine ? `: ${f.ctaLine}` : '.'}`);
  const kinds = new Set(ranked.map((p) => p.kind).filter(Boolean));
  const missing = PILLARS.filter((p) => p.key !== 'offer' && !kinds.has(p.key));
  const formats = new Set(ranked.map((p) => p.format).filter(Boolean));
  if (missing.length && missing.length < 4 && ranked.some((p) => p.caption)) next.push(`Try a ${KIND_LIKE[missing[0].key]} post. None of these ${n} posts reads like one.`);
  else if (formats.size && !formats.has('carousel') && ranked.some((p) => p.kind === 'teach' || p.kind === 'myths')) next.push('Turn your best teaching post into a carousel with "Make a carousel". There isn\'t one in this set.');

  const caution = n < 10 ? `With ${text.plural(n, 'post')}, read this as a hint, not a rule. Run it again when you have 10 or more.` : n < 30 ? `${n} posts is enough for a first read. Groups of 2 or 3 posts can still change, so run it again in a month.` : null;
  const dates = ranked.map((p) => p.date).filter(Boolean).sort();
  const totals = Object.fromEntries(['views', 'reach', 'impressions', ...METRICS].filter((k) => read.has[k]).map((k) => [k, ranked.reduce((t, p) => t + (p[k] || 0), 0)]));
  return {
    posts: ranked,
    groups: groups.map(strip),
    more: doMore,
    less: doLess,
    next: next.slice(0, 4),
    caution,
    base,
    metrics: s.metrics,
    typicalViews: s.medSeen,
    from: dates[0] || '',
    to: dates[dates.length - 1] || '',
    totals,
    count: n,
  };
}

module.exports = { FIELDS, WEIGHT, LABEL, FORMAT_LABEL, PILLAR_NAME, HOOKS, TIME_LABEL, parseTable, mapColumns, num, parseDate, dateOrder, formatKey, kindOf, firstSentence, readPosts, scorePosts, rankPosts, reasonFor, median };
