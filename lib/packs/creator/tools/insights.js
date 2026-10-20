// Read your insights: the member's Instagram (Meta Business Suite content export) or TikTok (TikTok
// Studio content export) CSV. Each post gets a score from its own numbers (likes, comments x2,
// shares x3, saves x3, per 100 views, or per post when there are no views), then: top and bottom
// posts, which post type and weekday did best, more-of and less-of, and three ideas for next week.
// Code only: no AI reads the file. Without a file, the labeled sample account (made up).

const fs = require('fs');
const path = require('path');
const { views, save, files, time, text } = require('../../_kit');
const U = require('../lib/util');

const { plain } = text;
const SAMPLE = path.join(__dirname, '..', 'sample', 'insights.csv');

// Column names each export uses (lowercased), in the order we look for them.
const COLS = {
  caption: ['description', 'caption', 'video title', 'title', 'post caption', 'text'],
  link: ['permalink', 'video link', 'link', 'post link', 'url'],
  type: ['post type', 'type', 'media type', 'content type'],
  when: ['publish time', 'post time', 'date posted', 'created time', 'posted', 'date', 'time'],
  views: ['views', 'video views', 'total views', 'plays', 'impressions', 'reach'],
  likes: ['likes', 'total likes', 'reactions', 'likes and reactions'],
  comments: ['comments', 'total comments'],
  shares: ['shares', 'total shares'],
  saves: ['saves', 'saved', 'total saves', 'add to favorites', 'favorites'],
  follows: ['follows', 'new followers', 'followers gained'],
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pick = (head, names) => names.find((n) => head.includes(n)) || null;
const n = (v) => {
  const s = String(v == null ? '' : v).replace(/[,\s]/g, '');
  const k = /^([\d.]+)k$/i.exec(s);
  const x = k ? Number(k[1]) * 1000 : Number(s);
  return Number.isFinite(x) ? x : 0;
};

function dateOf(v) {
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function postsFrom(src) {
  const { head, rows } = U.csvObjects(src);
  const c = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, pick(head, names)]));
  const hasAny = c.likes || c.views || c.comments;
  if (!hasAny || !(c.caption || c.link)) throw new Error("That doesn't look like an insights export. Instagram: Meta Business Suite, Insights, Content, Export. TikTok: TikTok Studio, Analytics, Content, Download. Add the CSV.");
  const isTikTok = head.some((h) => /video title|video link|post time/.test(h));
  const posts = rows.map((r) => {
    const views = c.views ? n(r[c.views]) : 0;
    const likes = n(r[c.likes]);
    const comments = n(r[c.comments]);
    const shares = n(r[c.shares]);
    const saves = n(r[c.saves]);
    const acts = likes + comments * 2 + shares * 3 + saves * 3;
    const date = dateOf(r[c.when]);
    return {
      caption: U.fit(plain(r[c.caption] || '') || '(no caption)', 90),
      link: /^https:\/\//.test(r[c.link] || '') ? r[c.link] : '',
      type: plain(r[c.type] || (isTikTok ? 'Video' : 'Post')) || 'Post',
      date,
      weekday: date ? WEEKDAYS[time.weekdayOf(date)] : '',
      views,
      likes,
      comments,
      shares,
      saves,
      follows: c.follows ? n(r[c.follows]) : null,
      score: views > 0 ? Math.round((acts / views) * 1000) / 10 : acts,
    };
  }).filter((p) => p.views || p.likes || p.comments);
  return { posts, platform: isTikTok ? 'TikTok' : 'Instagram', perView: Boolean(c.views) };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function groupBy(posts, key) {
  const g = new Map();
  for (const p of posts) if (p[key]) g.set(p[key], [...(g.get(p[key]) || []), p]);
  return [...g.entries()].map(([k, ps]) => ({ name: k, posts: ps.length, median: Math.round(median(ps.map((p) => p.score)) * 10) / 10 })).sort((a, b) => b.median - a.median);
}

function analyze(posts) {
  const ranked = [...posts].sort((a, b) => b.score - a.score);
  const types = groupBy(posts, 'type');
  const days = groupBy(posts, 'weekday').filter((d) => d.posts >= 2);
  const top = ranked.slice(0, 5);
  const bottom = ranked.length > 8 ? ranked.slice(-3).reverse() : [];
  const more = [];
  const less = [];
  if (types.length > 1) {
    more.push(`${types[0].name}: your best type (middle score ${types[0].median} across ${types[0].posts} posts).`);
    const last = types[types.length - 1];
    if (last.median < types[0].median) less.push(`${last.name}: middle score ${last.median} across ${last.posts} posts. Try fewer, or change how you open them.`);
  }
  if (days.length > 1) more.push(`Post on ${days[0].name}: your best day so far (${days[0].posts} posts).`);
  const saved = ranked.filter((p) => p.saves > 0).sort((a, b) => b.saves - a.saves)[0];
  if (saved) more.push(`Posts people save, like "${U.fit(saved.caption, 50)}". Saves mean "useful": make more how-tos like it.`);
  const quiet = ranked.filter((p) => p.comments === 0).length;
  if (quiet > posts.length / 3) less.push(`${quiet} posts got no comments. End each post with one simple question.`);
  const ideas = top.slice(0, 3).map((p) => `A follow-up to "${U.fit(p.caption, 50)}": go one step deeper, or answer a comment it got.`);
  return { ranked, top, bottom, types, days, more, less, ideas };
}

module.exports = {
  name: 'creator.read_insights',
  title: 'Read your insights',
  description: 'Add your Instagram or TikTok content export: your top and lowest posts by your own numbers, which post type and day did best, what to do more and less of, and three ideas for next week.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'asset', accept: '.csv,text/csv', title: 'Your insights export (CSV)', description: 'Instagram: Meta Business Suite, Insights, Content, Export. TikTok: TikTok Studio, Analytics, Content, Download. Leave empty to see how it works on a sample account.' },
    },
  },
  output: { type: 'object', required: ['posts', 'top', 'more', 'less', 'ideas'], properties: { source: { type: 'string' }, platform: { type: 'string' }, posts: { type: 'integer' }, from: { type: 'string' }, to: { type: 'string' }, score_note: { type: 'string' }, top: { type: 'array' }, bottom: { type: 'array' }, types: { type: 'array' }, days: { type: 'array' }, more: { type: 'array' }, less: { type: 'array' }, ideas: { type: 'array' }, file: { type: 'object' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    let src;
    let source;
    let sample = false;
    if (input.file) {
      const up = await U.readUpload(ctx, input.file);
      src = up.text;
      source = `From your file, ${up.name}.`;
    } else {
      src = fs.readFileSync(SAMPLE, 'utf8');
      source = 'From a sample account (made up), not yours. Add your insights export to read your own posts.';
      sample = true;
    }
    const { posts, platform, perView } = postsFrom(src);
    if (!posts.length) throw new Error('No posts with numbers in that file. Export a longer date range and add it again.');
    const a = analyze(posts);
    const dates = posts.map((p) => p.date).filter(Boolean).sort();
    const cols = [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'caption', label: 'Caption' },
      { key: 'views', label: 'Views' },
      { key: 'likes', label: 'Likes' },
      { key: 'comments', label: 'Comments' },
      { key: 'shares', label: 'Shares' },
      { key: 'saves', label: 'Saves' },
      { key: 'score', label: perView ? 'Score per 100 views' : 'Score' },
      { key: 'link', label: 'Link' },
    ];
    const file = await save.saveFile(ctx, save.fileName(platform, 'posts ranked', time.today(ctx), '.csv'), files.csv(a.ranked, cols));
    const slim = (p) => ({ date: p.date, type: p.type, caption: p.caption, views: p.views, score: p.score, link: p.link });
    return {
      source,
      platform,
      posts: posts.length,
      from: dates[0] || '',
      to: dates[dates.length - 1] || '',
      score_note: perView ? 'Score: likes + comments x2 + shares x3 + saves x3, per 100 views. Comments, shares and saves count more because people only do them when a post really helps.' : 'Score: likes + comments x2 + shares x3 + saves x3 (no views column in this file).',
      top: a.top.map(slim),
      bottom: a.bottom.map(slim),
      types: a.types,
      days: a.days,
      more: a.more,
      less: a.less,
      ideas: a.ideas,
      file,
      ...(sample ? { sample: true } : {}),
    };
  },
  view(out) {
    return views.blocks(
      views.metric(`${out.platform} insights`, `${out.posts} posts`, `${out.from && out.to ? `${out.from} to ${out.to}. ` : ''}${out.source}`),
      views.table([{ key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'caption', label: 'Top posts' }, { key: 'views', label: 'Views' }, { key: 'score', label: 'Score' }], out.top),
      out.types.length > 1 ? views.table([{ key: 'name', label: 'Type' }, { key: 'posts', label: 'Posts' }, { key: 'median', label: 'Middle score' }], out.types) : null,
      out.more.length ? views.text(`More of: ${out.more.join(' ')}`) : null,
      out.less.length ? views.text(`Less of: ${out.less.join(' ')}`) : null,
      views.copy('Ideas for next week', out.ideas.join('\n')),
      out.bottom.length ? views.table([{ key: 'date', label: 'Date' }, { key: 'caption', label: 'Lowest posts' }, { key: 'score', label: 'Score' }], out.bottom) : null,
      views.text(out.score_note),
      views.file(out.file, 'Every post, ranked (CSV)'),
    );
  },
};
