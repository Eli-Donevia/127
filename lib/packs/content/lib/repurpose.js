// One long piece (a blog post, a newsletter, a talk or a video transcript) into many: the key points
// in the member's own words, a carousel, three short video scripts, posts sized for Instagram,
// Facebook, LinkedIn, Threads and X, a newsletter email and quote cards. Every line comes from the
// piece itself or the member's facts; nothing new is claimed. Limits come from data/platforms.json
// and are checked in code.

const { text, outreach } = require('../../_kit');
const LIM = require('../data/platforms.json');
const { lowerFirst } = require('./niches');

const lc = lowerFirst;
const sc = (s) => text.sentenceCase(String(s || '').trim());
const noEnd = (s) => String(s || '').trim().replace(/[.?!:;,]+$/, '');
const end = (s) => {
  const t = String(s || '').trim();
  return !t || /[.?!"]$/.test(t) ? t : `${t}.`;
};
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

const STOP = new Set(
  ('a an and the for to of in on at by with your you our we us is are was were be been being it its this that these those from or as get got my me i ' +
    'not no do does did can could will would should just so if then than there their they them he she his her what when where which who how why ' +
    'about into out up down over more most some any all one two also very really much many too here have has had after before once every each ' +
    "it's don't can't won't you're i'm that's there's let's").split(' ')
);

const LIMITS = {
  instagram: LIM.instagram.captionMax,
  linkedin: LIM.linkedin.postMax,
  threads: LIM.threads.postMax,
  x: LIM.x.postMax,
  xUrl: LIM.x.urlCounts,
};

// ---------- reading the piece ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: ', ', ndash: ', ', hellip: '...' };
function decode(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] != null ? ENTITIES[n.toLowerCase()] : m));
}

// The article text of a web page: the <article> or <main> when there is one, headings, paragraphs
// and list items in order; menus, headers, footers, forms and scripts left out.
function articleText(html) {
  let s = String(html || '');
  const pick = s.match(/<article\b[\s\S]*?<\/article>/i) || s.match(/<main\b[\s\S]*?<\/main>/i);
  if (pick) s = pick[0];
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|form|nav|header|footer|aside|figure|button)\b[\s\S]*?<\/\1>/gi, ' ');
  const out = [];
  const re = /<(h[1-4]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(s))) {
    const t = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const tag = m[1].toLowerCase();
    out.push(tag[0] === 'h' ? `## ${t}` : tag === 'li' ? `- ${t}` : t);
  }
  return out.join('\n\n');
}

// Clean one block of the member's text: no markdown, no dashes, straight quotes, one line.
function clean(s) {
  return text.oneLine(
    text.plain(
      String(s || '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
    )
  );
}

// Blocks in order: { kind: 'h' | 'p' | 'li', text }.
function blocksOf(raw) {
  const chunks = String(raw || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  const out = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => /^([-*\u2022]|\d+[.)])\s+/.test(l))) {
      for (const l of lines) out.push({ kind: 'li', text: clean(l.replace(/^([-*\u2022]|\d+[.)])\s+/, '')) });
      continue;
    }
    if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) {
      out.push({ kind: 'h', text: clean(lines[0].replace(/^#{1,4}\s+/, '')) });
      continue;
    }
    if (lines.length === 1 && lines[0].length <= 80 && !/[.!?:;,"]$/.test(lines[0]) && words(lines[0]) >= 2) {
      out.push({ kind: 'h', text: clean(lines[0]) });
      continue;
    }
    out.push({ kind: 'p', text: clean(lines.join(' ')) });
  }
  return out.filter((b) => b.text);
}

function sentences(p) {
  return String(p || '')
    .split(/(?<=[.!?])\s+(?=["'A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function contentWords(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function topWords(blocks, n = 14) {
  const count = new Map();
  for (const b of blocks) for (const w of contentWords(b.text)) count.set(w, (count.get(w) || 0) + 1);
  return new Set([...count.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w));
}

const okLine = (s) => !!s && text.copyProblems(s).length === 0;
const WEAK_START = /^(it|this|that|these|those|they|and|but|so|also|then|which|here|there)\b/i;

// The first sentences of a block, up to `max` characters.
function lead(p, max = 240) {
  let out = '';
  for (const s of sentences(p).filter(okLine)) {
    if (!out) out = s;
    else if (out.length + 1 + s.length <= max) out += ` ${s}`;
    else break;
  }
  return out.length > max ? text.clip(out, max) : out;
}

// Sentences that work on their own as a quote card: 40 to 140 characters, no pronoun start.
function quotesOf(blocks, avoid = [], top = new Set(), n = 3) {
  const seen = new Set(avoid.map((a) => a.toLowerCase()));
  const all = [];
  blocks.filter((b) => b.kind !== 'h').forEach((b, bi) => {
    sentences(b.text).forEach((s, si) => {
      if (s.length < 40 || s.length > 140 || WEAK_START.test(s) || !okLine(s) || /\?$/.test(s) || seen.has(s.toLowerCase())) return;
      // A quote card wants a line that makes a point on its own, short enough to read in a glance.
      const hits = contentWords(s).filter((w) => top.has(w)).length;
      const orders = /^(use|put|pull|wipe|keep|skip|try|make|take|check|ask|book|call|add|get)\b/i.test(s);
      const score = Math.min(hits, 3) + (s.length <= 90 ? 3 : s.length <= 120 ? 1 : 0) + (/\b(not|instead|than|never|always|most)\b/i.test(s) ? 1 : 0) - (orders ? 2 : 0) - si * 0.3;
      all.push({ s, score, bi });
    });
  });
  const out = [];
  const usedBlocks = new Set();
  for (const q of all.sort((a, b) => b.score - a.score)) {
    if (out.length >= n) break;
    if (usedBlocks.has(q.bi)) continue;
    usedBlocks.add(q.bi);
    out.push(q.s);
  }
  return out;
}

// Key points by code: headings with the words under them, else list items, else the strongest
// sentence of each paragraph. { title, summary, points: [{ title, body }], quotes, words }.
function keyPoints(raw, { title = '', max = 8 } = {}) {
  let blocks = blocksOf(raw);
  let head = clean(title);
  if (!head && blocks[0] && blocks[0].kind === 'h') head = blocks[0].text;
  if (blocks[0] && blocks[0].kind === 'h' && blocks[0].text === head) blocks = blocks.slice(1);
  const paras = blocks.filter((b) => b.kind === 'p');
  if (!head) head = text.clip(noEnd(sentences((paras[0] || {}).text)[0] || 'Your post'), 80).replace(/\.\.\.$/, '');
  const summary = lead((paras[0] || {}).text || '', 240);
  const top = topWords(blocks);
  let points = [];
  // 1. Headings, each with the first sentences of the text under it.
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].kind !== 'h') continue;
    const under = [];
    for (let j = i + 1; j < blocks.length && blocks[j].kind !== 'h'; j++) under.push(blocks[j].text);
    if (under.length && okLine(blocks[i].text)) points.push({ title: noEnd(blocks[i].text), body: lead(under.join(' '), 220) });
  }
  // 2. A list.
  if (points.length < 3) {
    const items = blocks.filter((b) => b.kind === 'li' && okLine(b.text));
    if (items.length >= 3) {
      points = items.map((b) => {
        const ss = sentences(b.text);
        return { title: noEnd(ss[0]), body: ss.slice(1).join(' ') };
      });
    }
  }
  // 3. The strongest sentence of each paragraph, in order.
  if (points.length < 3) {
    points = [];
    paras.forEach((p, pi) => {
      if (pi === 0 && paras.length > 3) return; // the opening becomes the summary
      const ss = sentences(p.text).filter(okLine);
      let best = null;
      ss.forEach((s, si) => {
        const hits = contentWords(s).filter((w) => top.has(w)).length;
        const score = hits * 2 + (si === 0 ? 3 : 0) + (s.length >= 40 && s.length <= 160 ? 2 : 0) + (/\d/.test(s) ? 1 : 0) - (WEAK_START.test(s) ? 3 : 0);
        if (!best || score > best.score) best = { s, si, score };
      });
      if (best) points.push({ title: noEnd(best.s), body: ss.filter((x, k) => k !== best.si).slice(0, 2).join(' '), score: best.score, at: pi });
    });
    if (points.length > max) points = points.slice().sort((a, b) => b.score - a.score).slice(0, max).sort((a, b) => a.at - b.at);
  }
  points = points
    .filter((p) => p.title)
    .slice(0, max)
    .map((p) => ({ title: p.title.length > 110 ? text.clip(p.title, 110) : p.title, body: p.body ? text.clip(p.body, 240) : '' }));
  const quotes = quotesOf(blocks, points.map((p) => p.title), top);
  return { title: head, summary, points, quotes, words: words(blocks.map((b) => b.text).join(' ')) };
}

// Does an AI point stay with what the piece says? Most of its words are in the piece.
function grounded(point, sourceWords) {
  const w = contentWords(`${point.title} ${point.body || ''}`);
  if (!w.length) return false;
  return w.filter((x) => sourceWords.has(x)).length / w.length >= 0.6;
}

// A quote has to be in the piece, word for word.
function verbatim(q, raw) {
  const norm = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return norm(raw).includes(norm(q));
}

// ---------- what gets made ----------

// X counts every link as 23 characters.
function xLength(s) {
  return String(s || '').replace(/https?:\/\/\S+/g, 'x'.repeat(LIMITS.xUrl)).length;
}

// Keep dropping the last optional line until the post fits.
function fitPost(required, optional, max, join = '\n\n', len = (s) => s.length) {
  const opt = optional.filter(Boolean);
  for (let n = opt.length; n >= 0; n--) {
    const s = [required[0], ...opt.slice(0, n), ...required.slice(1)].filter(Boolean).join(join);
    if (len(s) <= max) return s;
  }
  return text.clip(required.filter(Boolean).join(join), max);
}

const numbered = (points, n) => points.slice(0, n).map((p, i) => `${i + 1}. ${end(p.title)}`);

function posts(f, piece, points, { url = '' } = {}) {
  const hook = end(piece.title);
  const sig = [f.name, f.where].filter(Boolean).join(', ');
  const link = url ? `Read the whole post: ${url}` : '';
  const facebook = fitPost([hook, f.ctaLine], [piece.summary, numbered(points, 4).join('\n'), link], 63000);
  const linkedin = fitPost(
    [hook, [url ? `The whole post: ${url}` : '', sig].filter(Boolean).join('\n')],
    [piece.summary, points.slice(0, 5).map((p, i) => `${i + 1}. ${end(p.title)}${p.body ? ` ${sentences(p.body)[0] || ''}` : ''}`).join('\n\n'), 'Which one would you add to the list?'],
    LIMITS.linkedin
  );
  let list = numbered(points, 5);
  const listPost = () => [`${text.plural(list.length, 'thing')} worth knowing:`, ...list].join('\n');
  while (list.length > 1 && listPost().length > LIMITS.threads) list = list.slice(0, -1);
  const threads = [fitPost([hook], [piece.summary], LIMITS.threads), list.length ? listPost().slice(0, LIMITS.threads) : '', fitPost([f.ctaLine], [link], LIMITS.threads)].filter(Boolean);
  const first = points[0] ? end(points[0].title) : '';
  const x = [[hook, first, url], [hook, url], [hook, first], [hook]].map((parts) => parts.filter(Boolean).join('\n\n')).find((s) => xLength(s) <= LIMITS.x) || text.clip(hook, LIMITS.x);
  return { facebook, linkedin, threads, x };
}

const SHOT = {
  hook: 'Face to camera, start talking on frame one',
  intro: 'Face to camera, phone at eye level, window light on your face',
  close: 'Face to camera, point down to the comments',
};

// Text for the screen: the sentence if it is short, else its first clause, else its first words.
function shortLine(s, max = 48) {
  const t = noEnd(s);
  if (t.length <= max) return t;
  const clause = t.split(/[,:;]\s+/)[0];
  if (clause.length >= 12 && clause.length <= max) return clause;
  let out = '';
  for (const w of t.split(/\s+/)) {
    if ((out ? `${out} ${w}` : w).length > max) break;
    out = out ? `${out} ${w}` : w;
  }
  return out.replace(/\s+(a|an|the|and|or|of|to|in|on|with|for)$/i, '');
}

// A short video from one point: the point as the hook, its sentences as the beats, the keyword ask.
function scriptFor(f, point, { url = '', piece, tags = [] } = {}) {
  // Film what each line says, so the pictures match the words.
  const shot = (s) => `Close-up that shows it: ${lc(shortLine(s, 40))}`;
  const hook = { say: end(point.title), onScreen: text.clip(noEnd(point.title), 56), shot: SHOT.hook };
  const intro = f.intro ? { say: f.intro, onScreen: '', shot: SHOT.intro } : null;
  const beats = sentences(point.body)
    .slice(0, 3)
    .map((s) => ({ say: s, onScreen: shortLine(s), shot: shot(s) }));
  const close = { say: `${url ? 'The whole post is on my website. ' : 'Save this for later. '}${f.ctaLine}`, onScreen: `Comment ${f.keyword}`, shot: SHOT.close };
  const spoken = [hook.say, intro && intro.say, ...beats.map((b) => b.say), close.say].filter(Boolean).join('\n\n');
  const seconds = Math.max(15, Math.round(words(spoken) / 2.5) + beats.length);
  const caption = [end(point.title), '', point.body, '', `From my post: ${noEnd(piece.title)}.`, '', f.ctaLine, ...(tags.length ? ['', tags.join(' ')] : [])].filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n');
  return { title: text.clip(noEnd(point.title), 70), hook, intro, beats, close, spoken, seconds, caption: text.plain(caption).slice(0, LIMITS.instagram) };
}

// The three points that make the best videos: the ones with the most to say, in the piece's order.
function scriptPoints(points, n = 3) {
  const ranked = points.map((p, i) => ({ p, i, n: sentences(p.body).length })).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, n);
  return ranked.sort((a, b) => a.i - b.i).map((x) => x.p);
}

// The newsletter: subject lines, preview text and the email, ending with the sender, the address
// line and a way to stop (CAN-SPAM, data/platforms.json).
function newsletter(f, piece, points, { url = '' } = {}) {
  const subjects = [...new Set([text.clip(noEnd(piece.title), 60), points[0] ? `The short version: ${text.clip(lc(noEnd(points[0].title)), 44)}` : '', `${text.plural(Math.min(points.length, 7), 'thing')} from my latest post`].filter(Boolean))].filter(okLine);
  const preview = text.clip(piece.summary || (points[0] && points[0].body) || '', 90);
  const body = [
    'Hi,',
    '',
    piece.summary,
    '',
    ...points.flatMap((p, i) => [`${i + 1}. ${end(p.title)}`, ...(p.body ? [p.body] : []), '']),
    ...(url ? [`Read the whole post: ${url}`, ''] : []),
    f.replyLine,
    '',
    [f.first, f.name].filter(Boolean).join('\n') || '[your name]',
    outreach.ADDRESS_HOLD,
    '',
    `You're getting this because you signed up for emails from ${f.name || 'me'}. To stop them, use the unsubscribe link below or reply "unsubscribe".`,
  ]
    .filter((l, i, all) => !(l === '' && all[i - 1] === ''))
    .join('\n');
  return { subjects, preview, body: text.plain(body) };
}

// A week of posts from one piece, starting tomorrow.
function week(start, { scripts = 3, quotes = 0, addDays }) {
  const plan = [
    'Carousel on Instagram, and the LinkedIn post',
    scripts > 0 ? 'Video 1 on Reels, TikTok and Shorts' : '',
    'The Threads posts and the X post',
    scripts > 1 ? 'Video 2' : '',
    'The newsletter email',
    quotes > 0 ? 'Quote card 1, and the Facebook post' : 'The Facebook post',
    scripts > 2 ? 'Video 3' : '',
  ];
  return plan.map((what, i) => ({ date: addDays(start, i), what })).filter((x) => x.what);
}

module.exports = { LIMITS, shortLine, articleText, blocksOf, sentences, keyPoints, quotesOf, grounded, verbatim, contentWords, posts, scriptFor, scriptPoints, newsletter, week, xLength, clean };
