// Titles and cover words for the next videos: 5 titles each and 2 to 5 cover words, true to the
// topic's facts. From topics the member types, else the last batch of scripts, else the next ideas
// in the niche. A spreadsheet, and the covers ready for the video pack's cover set.

const { ai, views, save, files, time, text, brain } = require('../../_kit');
const C = require('../lib/channel');
const S = require('../lib/script');
const W = require('../lib/facts');

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, titles: { type: 'array', items: { type: 'string' } }, cover: { type: 'string' } },
        required: ['id', 'titles', 'cover'],
      },
    },
  },
  required: ['items'],
};

module.exports = {
  name: 'faceless.write_titles',
  title: 'Write titles and cover words',
  description: 'Writes 5 titles and 2 to 5 cover words for each of your next videos (up to 12), true to each topic\'s facts: from topics you type, your last batch of scripts, or the next ideas in your niche. A spreadsheet, and the covers ready to render.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 240,
  input: {
    type: 'object',
    properties: {
      topics: { type: 'string', title: 'Video topics or titles, one per line (optional)', maxLength: 2000 },
      niche: { type: 'string', title: 'Niche', enum: C.NICHE_IDS },
      count: { type: 'integer', title: 'How many videos', minimum: 1, maximum: 12, default: 12 },
    },
  },
  output: {
    type: 'object',
    properties: {
      rows: { type: 'array' },
      covers: { type: 'array' },
      csv: { type: ['object', 'null'] },
      color: { type: 'string' },
      name: { type: 'string' },
      sheetTitle: { type: 'string' },
      from: { type: 'string' },
      niche: { type: 'string' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['rows', 'covers'],
  },
  async run(input, ctx) {
    const n = C.nicheFor(ctx, input.niche);
    const count = Math.max(1, Math.min(12, Number(input.count) || 12));
    const today = time.today(ctx);
    const typed = String(input.topics || '').split(/\r?\n|;/).map((t) => text.oneLine(t)).filter(Boolean).slice(0, count);
    const mem = brain.packMemory(ctx, 'faceless');
    let from;
    let items;
    if (typed.length) {
      from = 'your list';
      const found = await W.lookUpAll(ctx, typed, n.id);
      items = typed.map((t, i) => ({ asked: t, topic: found[i], angle: found[i] ? S.pickAngle(found[i], found[i].extract, i) || 'sixty' : 'sixty' }));
    } else if (mem.batch && Array.isArray(mem.batch.titles) && mem.batch.titles.length && (!mem.batch.niche || mem.batch.niche === n.id)) {
      from = `your scripts from ${time.longDate(mem.batch.date)}`;
      const all = Object.values(C.TOPICS.niches).flat();
      const arts = Array.isArray(mem.batch.articles) ? mem.batch.articles : [];
      items = mem.batch.titles.slice(0, count).map((t, i) => ({ asked: t, topic: all.find((x) => x.article === arts[i]) || null, angle: 'sixty', title: t, cover: (mem.batch.covers || [])[i] }));
    } else {
      from = `the next ideas in ${n.label}`;
      const list = C.ideas(n, n.topics, { count, made: C.madeIn(ctx, n.id) });
      items = list.map((x) => ({ asked: x.topic, topic: n.topics.find((t) => t.article === x.article), angle: x.angle }));
    }
    const facts = await W.factsForAll(ctx, items.map((x) => x.topic || { topic: x.asked, extract: '' }));
    const fallback = () => ({
      items: items.map((x, i) => {
        const name = x.topic ? x.topic.topic : x.asked;
        return { id: i + 1, titles: S.titleOptions(name, x.angle, 'short', x.title ? [x.title] : [], x.topic), cover: x.cover || (x.topic ? S.coverFor(name, x.angle) : S.trimCover(name)) };
      }),
    });
    const { data, ai: viaAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write titles and thumbnail words for faceless short videos. Plain words, curious but true: nothing the facts given cannot back, no "you won\'t believe", no all caps.',
      prompt: [
        `Channel: ${n.label}, ${n.angle}.`,
        ...items.map((x, i) => `Video id ${i + 1}: ${x.title || (x.topic ? x.topic.topic : x.asked)}.${facts[i].text ? `\nFacts: ${facts[i].text.slice(0, 700)}` : ''}`),
        'For each video return id, titles (5 options under 60 characters, different from each other) and cover (2 to 5 words for the thumbnail that add something to the title, not repeat it).',
      ].join('\n\n'),
      schema: SCHEMA,
      maxTokens: 220 * items.length + 200,
      fallback,
      accept: (d) => ai.cleanCopy(d) && d.items.length >= Math.ceil(items.length / 2),
    });
    const plain = fallback().items;
    let used = 0;
    const rows = items.map((x, i) => {
      const got = viaAi ? data.items.find((d) => Number(d.id) === i + 1) : null;
      const ok = (t) => !!text.oneLine(t) && S.unknownNumbers(t, `${facts[i].text} ${x.asked}`).length === 0;
      const titles = got ? [...new Set(got.titles.filter(ok).map((t) => S.cut(t, 70)))].slice(0, 5) : [];
      const cover = got && ok(got.cover) ? S.trimCover(got.cover) : '';
      if (titles.length >= 3 && cover) used++;
      return {
        n: i + 1,
        topic: x.topic ? x.topic.topic : x.asked,
        titles: titles.length >= 3 ? titles : plain[i].titles,
        cover: cover || plain[i].cover,
        url: x.topic ? x.topic.url || W.urlOf(x.topic.article) : '',
        found: !!x.topic,
      };
    });
    const csv = await save.saveFile(
      ctx,
      save.fileName(n.label, 'titles and covers', today, '.csv'),
      files.csv(
        rows.map((r) => ({ ...r, t1: r.titles[0], t2: r.titles[1], t3: r.titles[2], t4: r.titles[3], t5: r.titles[4] })),
        [
          { key: 'n', label: '#' },
          { key: 'topic', label: 'Topic' },
          { key: 'cover', label: 'Cover words' },
          { key: 't1', label: 'Title 1' },
          { key: 't2', label: 'Title 2' },
          { key: 't3', label: 'Title 3' },
          { key: 't4', label: 'Title 4' },
          { key: 't5', label: 'Title 5' },
          { key: 'url', label: 'Facts from' },
        ],
        { bom: true },
      ),
    );
    ctx.log(`Titles and cover words for ${rows.length} videos from ${from}${viaAi ? `, ${used} by AI` : ' (plain titles, AI is off)'}`);
    return {
      rows,
      covers: rows.map((r) => ({ text: r.cover, title: r.titles[0] })),
      csv,
      color: C.videoColor(ctx, n),
      name: save.fileName(n.label, today),
      sheetTitle: `${n.label}: your next ${rows.length} covers`,
      from,
      niche: n.id,
      ai: viaAi && used > 0,
      sample: !(viaAi && used > 0),
    };
  },
  view(out) {
    const missing = out.rows.filter((r) => !r.found).map((r) => r.topic);
    return views.blocks(
      views.metric('Videos', out.rows.length, `5 titles and cover words each, from ${out.from}`),
      views.table(
        [
          { key: 'n', label: '#', format: 'number' },
          { key: 'cover', label: 'Cover words' },
          { key: 'title', label: 'Best title' },
        ],
        out.rows.map((r) => ({ n: r.n, cover: r.cover, title: r.titles[0] })),
      ),
      views.copy('All titles', out.rows.map((r) => `${r.n}. ${r.topic}\n${r.titles.map((t) => `   ${t}`).join('\n')}`).join('\n\n')),
      missing.length ? views.text(`Not found on Wikipedia, so their titles use no facts: ${missing.join(', ')}.`) : null,
      views.file(out.csv, 'Titles and cover words (.csv)'),
    );
  },
};
