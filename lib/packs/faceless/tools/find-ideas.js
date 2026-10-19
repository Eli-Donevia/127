// Video ideas in one niche, each tied to a topic people already look up: its Wikipedia page views
// last month (Wikimedia's public API, live when it answers, otherwise the dated snapshot), an angle
// that fits it, a working title, cover words and a link to see what is already posted. Ideas the
// member already made a video of are left out, so a repeat hands back new ones.

const { views, save, files, time, crowd } = require('../../_kit');
const C = require('../lib/channel');
const W = require('../lib/facts');

module.exports = {
  name: 'faceless.find_ideas',
  title: 'Find video ideas',
  description: "Lists short-video ideas in your niche, each tied to a topic people look up, with last month's Wikipedia page views as the proof of interest, a working title, cover words and a link to what's already posted.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 2,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      niche: { type: 'string', title: 'Niche', enum: C.NICHE_IDS, default: 'space' },
      count: { type: 'integer', title: 'How many ideas', minimum: 5, maximum: 40, default: 25 },
    },
    required: ['niche'],
  },
  output: {
    type: 'object',
    properties: {
      niche: { type: 'string' },
      label: { type: 'string' },
      ideas: { type: 'array' },
      first: { type: 'object' },
      topic: { type: 'object' },
      csv: { type: ['object', 'null'] },
      live: { type: 'integer' },
      skipped: { type: 'integer' },
      month: { type: 'string' },
      asked: { type: 'integer' },
      crowd: { type: 'object' },
    },
    required: ['ideas'],
  },
  async run(input, ctx) {
    const n = C.nicheOf(input.niche);
    const count = Math.max(5, Math.min(40, Number(input.count) || 25));
    const month = W.lastMonth(ctx);
    const read = await W.liveViewsAll(ctx, n.topics, month);
    const topics = n.topics.map((t, i) => (read[i] ? { ...t, views: read[i], month, read: 'live' } : { ...t, month: C.TOPICS.month }));
    const live = read.filter(Boolean).length;
    const made = C.madeIn(ctx, n.id);
    const ideas = C.ideas(n, topics, { count, made });
    if (!ideas.length) throw new Error('No ideas came back for that niche. Try another niche.');
    const skipped = topics.filter((t) => !ideas.some((x) => x.article === t.article) && made.some((m) => m.startsWith(`${t.article}|`))).length;
    const first = ideas[0];
    const topic = topics.find((t) => t.article === first.article);
    const rows = ideas.map((x) => ({ rank: x.rank, title: x.title, topic: x.topic, angle: x.angle, views: x.views, month: W.monthName(x.month), cover: x.cover, search: x.search, url: x.url, made: '' }));
    const csv = await save.saveFile(
      ctx,
      save.fileName(n.label, 'video ideas', time.today(ctx), '.csv'),
      files.csv(rows, [
        { key: 'rank', label: '#' },
        { key: 'title', label: 'Video idea' },
        { key: 'topic', label: 'Topic' },
        { key: 'views', label: 'Wikipedia views' },
        { key: 'month', label: 'In' },
        { key: 'cover', label: 'Cover words' },
        { key: 'search', label: "See what's already posted" },
        { key: 'url', label: 'Facts from' },
        { key: 'made', label: 'Made (date)' },
      ], { bom: true }),
    );
    ctx.log(`${ideas.length} ideas for ${n.label}, ${live} of ${n.topics.length} topics read live from Wikimedia${skipped ? `, ${skipped} you already made left out` : ''}`);
    return { niche: n.id, label: n.label, ideas, first, topic, csv, live, skipped, month: live ? month : C.TOPICS.month, asked: count, crowd: crowd.card(C.NICHE.crowd, { month: Number(time.today(ctx).slice(5, 7)), title: 'Is a faceless channel a starving crowd?' }) };
  },
  view(out) {
    const when = W.monthName(out.month);
    return views.blocks(
      crowd.blocks(out.crowd),
      views.metric('Video ideas', out.ideas.length, `Ranked by how many people looked the topic up on Wikipedia in ${when}`),
      out.live ? null : views.text(`Page views as read on ${C.TOPICS.checked}: Wikipedia didn't answer just now.`),
      out.skipped ? views.text(`${out.skipped} topic${out.skipped === 1 ? '' : 's'} you already made a video of ${out.skipped === 1 ? 'is' : 'are'} left out.`) : null,
      out.ideas.some((x) => x.repeat)
        ? views.text(`You have made every idea in ${out.label}, so these are the ones you made longest ago. Tell each one a new way, or pick another niche.`)
        : out.asked && out.ideas.length < out.asked
          ? views.text(`Only ${out.ideas.length} new ideas are left in ${out.label}. Topics you made before come back with a new angle until every angle is made.`)
          : null,
      views.table(
        [
          { key: 'rank', label: '#', format: 'number' },
          { key: 'title', label: 'Video idea' },
          { key: 'views', label: `Wikipedia views, ${when}`, format: 'number' },
          { key: 'search', label: "What's posted", format: 'link' },
        ],
        out.ideas.map((x) => ({ rank: x.rank, title: x.title, views: x.views, search: x.search })),
      ),
      views.text('Page views show what people want to know, not what a video will get. Open "What\'s posted" to see how others told it, then tell it better in your own words.'),
      views.file(out.csv, 'All the ideas with links (.csv)'),
    );
  },
};
