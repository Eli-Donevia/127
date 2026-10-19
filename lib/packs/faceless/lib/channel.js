// The channel: niches, the ideas list (one per topic, each with its interest number), what the pack
// remembers so a repeat never hands back a video already made, upload days, descriptions and the
// program rules stated as YouTube and TikTok publish them.

const { text, time, brain, color } = require('../../_kit');
const NICHE = require('../data/niche.json');
const TOPICS = require('../data/topics.json');
const RULES = require('../data/rules.json');
const S = require('./script');
const W = require('./facts');

const NICHE_IDS = Object.keys(NICHE.niches);
const NICHE_LABELS = NICHE_IDS.map((id) => NICHE.niches[id].label);

// A niche by id or label ("Space", "space"), with its topics.
function nicheOf(id) {
  const key = NICHE.niches[id] ? id : NICHE_IDS.find((k) => NICHE.niches[k].label.toLowerCase() === String(id || '').toLowerCase()) || 'space';
  return { id: key, ...NICHE.niches[key], topics: TOPICS.niches[key] || [] };
}

// The member's niche: what they picked, else what this pack last used, else what their business
// says ("space facts" -> space), else space.
function nicheFor(ctx, picked) {
  if (picked && (NICHE.niches[picked] || NICHE_LABELS.some((l) => l.toLowerCase() === String(picked).toLowerCase()))) return nicheOf(picked);
  const mem = brain.packMemory(ctx, 'faceless');
  if (mem.niche && NICHE.niches[mem.niche]) return nicheOf(mem.niche);
  const b = brain.brainOf(ctx);
  const hay = `${b.what} ${b.niche} ${b.name} ${b.offer}`.toLowerCase();
  const hit = NICHE_IDS.find((k) => hay.includes(k) || hay.includes(NICHE.niches[k].label.toLowerCase()) || (NICHE.niches[k].tags || []).some((t) => hay.includes(t)));
  return nicheOf(hit || 'space');
}

// ---------- memory (ctx.remember keeps 4 KB a key, so it stays small) ----------

// Videos made per niche, as "Black_hole|sixty" strings, newest last, at most 150.
function madeIn(ctx, nicheId) {
  const list = brain.packMemory(ctx, 'faceless')[`made_${nicheId}`];
  return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
}

function madeAngles(made, article) {
  return made.filter((x) => x.split('|')[0] === article).map((x) => x.split('|')[1]);
}

// ctx.remember keeps 4 KB a key: the oldest entries go first until the list fits.
function fitList(list, max = 3800) {
  const out = [...list];
  while (out.length && Buffer.byteLength(JSON.stringify(out)) > max) out.shift();
  return out;
}

async function rememberMade(ctx, nicheId, items) {
  const list = [...madeIn(ctx, nicheId), ...items.map((x) => `${x.article}|${x.angle}`)];
  const unique = fitList([...new Set(list.reverse())].reverse().slice(-150));
  await brain.remember(ctx, `made_${nicheId}`, unique);
  await brain.remember(ctx, 'niche', nicheId);
}

// ---------- ideas ----------

const bare = (q) => String(q || '').replace(/^the\s+/i, '');
const youTubeSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${bare(q)} shorts`).replace(/%20/g, '+')}`;
const pexelsSearch = (q, shape = 'portrait') => `https://www.pexels.com/search/videos/${encodeURIComponent(String(q).toLowerCase())}/?orientation=${shape}`;

// One idea per topic: topics not made yet first, most looked-up first; then topics made before, the
// oldest first, each with an angle not made yet (again: true). Only when every angle of every topic
// is made do the ones made longest ago come back as they were (repeat: true).
function ideas(n, topics, { count = 25, made = [], month = TOPICS.month } = {}) {
  const ranked = [...topics].sort((a, b) => (b.views || 0) - (a.views || 0));
  const order = [...new Set(made.map((x) => x.split('|')[0]))];
  const before = new Set(order);
  const again = order.map((a) => ranked.find((t) => t.article === a)).filter(Boolean);
  const out = [];
  let i = 0;
  for (const t of [...ranked.filter((x) => !before.has(x.article)), ...again]) {
    const angle = S.pickAngle(t, t.extract, i, madeAngles(made, t.article));
    if (!angle) continue;
    out.push(before.has(t.article) ? { ...ideaOf(t, angle, { month }), again: true } : ideaOf(t, angle, { month }));
    i++;
    if (out.length >= count) break;
  }
  if (!out.length) {
    for (const t of again.slice(0, count)) {
      out.push({ ...ideaOf(t, S.pickAngle(t, t.extract, i) || 'sixty', { month }), again: true, repeat: true });
      i++;
    }
  }
  return out.map((x, k) => ({ ...x, rank: k + 1 }));
}

function ideaOf(t, angle, { month = TOPICS.month } = {}) {
  const m = t.month || month;
  return {
    topic: t.topic,
    wiki: t.wiki || t.topic,
    article: t.article,
    kind: t.kind || 'thing',
    angle,
    title: S.titleFor(t.topic, angle),
    hook: S.hookFor(t.topic, angle),
    cover: S.coverFor(t.topic, angle),
    views: t.views || 0,
    month: m,
    evidence: t.views ? `${Number(t.views).toLocaleString('en-US')} Wikipedia views in ${W.monthName(m)}` : 'New topic',
    url: t.url || W.urlOf(t.article),
    search: youTubeSearch(t.topic),
    read: t.read || 'snapshot',
  };
}

// What to search for stock footage: the topic itself when it can be filmed, else the niche's words.
function stockFor(topic, n) {
  if (['money', 'psychology'].includes(n.id) || ['person', 'event'].includes(topic.kind)) return n.stock;
  return text.clip(bare(topic.topic).replace(/\s+\([^)]*\)$/, ''), 60);
}

// ---------- the member's channel ----------

function handleOf(ctx) {
  const b = brain.brainOf(ctx);
  return b.tiktok || b.instagram || (b.youtube && /^@?[\w.]+$/.test(b.youtube) ? b.youtube.replace(/^@/, '') : '');
}

// The video color: the brand kit's when the member has one (so every video matches), else the niche's.
function videoColor(ctx, n) {
  const mem = brain.packMemory(ctx, 'brand');
  const pal = mem.palette || mem.colors || {};
  const saved = [pal.primary, mem.primary, mem.color].find((c) => typeof c === 'string' && color.isHex(c));
  return saved || n.color;
}

// The YouTube description or TikTok caption: what it is, where the facts come from, tags.
// A script that still uses Wikipedia's sentences names their license too (CC BY-SA asks for credit,
// a link and the license); one in the member's own words credits the facts' page.
function descriptionFor(s, topic, n, { credits = [] } = {}) {
  const tags = ['shorts', ...(n.tags || [])].slice(0, 4).map((t) => `#${t}`).join(' ');
  const copied = !!(s.copied || (s.copiedLines && s.copiedLines.length));
  return [
    s.title,
    '',
    s.summary || s.lines[0] || '',
    '',
    topic && topic.url ? `Facts: Wikipedia, "${topic.wiki || topic.topic}" ${topic.url}${copied ? ' (text CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/)' : ''}` : '',
    n.note || '',
    credits.length ? `Footage: ${credits.join(', ')}` : '',
    '',
    tags,
  ]
    .filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0))
    .join('\n')
    .trim();
}

// ---------- upload days ----------

const PER_WEEK = { 3: [1, 3, 5], 5: [1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

// `count` upload days from `start` (default next Monday), on the weekdays for `perWeek`.
function uploadDays(ctx, { start, perWeek = 3, count = 30, after } = {}) {
  const days = PER_WEEK[perWeek] || PER_WEEK[3];
  let d = /^\d{4}-\d{2}-\d{2}$/.test(String(start || '')) ? start : after ? time.addDays(after, 1) : time.nextWeekday(time.today(ctx), 1, { after: true });
  const out = [];
  for (let guard = 0; out.length < count && guard < 800; guard++) {
    if (days.includes(time.weekdayOf(d))) out.push(d);
    d = time.addDays(d, 1);
  }
  return out;
}

// ---------- program rules ----------

function requirementsText() {
  const p = (x) => [x.name, ...x.lines.map((l) => `- ${l}`), `Source: ${x.url}`, ''].join('\n');
  return [
    `What YouTube and TikTok ask before they pay (checked ${time.longDate(RULES.checked)})`,
    '',
    ...RULES.programs.map(p),
    'Rules for every upload',
    ...RULES.policies.map((x) => `- ${x.title}: ${x.text} (${x.url})`),
    '',
    'When a brand pays you',
    ...RULES.sponsors.map((x) => `- ${x.title}: ${x.text} (${x.url})`),
    '',
    `Programs change. Open each link before you count on a number here. Checked ${time.longDate(RULES.checked)} on YouTube Help, TikTok's Creator Academy and the FTC's site.`,
  ].join('\n');
}

module.exports = { NICHE, TOPICS, RULES, NICHE_IDS, NICHE_LABELS, nicheOf, nicheFor, madeIn, madeAngles, fitList, rememberMade, ideas, ideaOf, youTubeSearch, pexelsSearch, stockFor, handleOf, videoColor, descriptionFor, uploadDays, PER_WEEK, requirementsText };
