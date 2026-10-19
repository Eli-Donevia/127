// A batch of scripts at once (30 by default), each on a topic people looked up last month and not
// made before: written from the topic's Wikipedia facts in plain spoken words, checked against those
// facts, with titles, cover words and descriptions. A printable page to record from and a
// spreadsheet. What it wrote is remembered, so next month's batch starts where this one stopped.

const { ai, views, save, files, time, text, brain, web } = require('../../_kit');
const C = require('../lib/channel');
const S = require('../lib/script');
const W = require('../lib/facts');
const P = require('../lib/pages');

const PER_CALL = 6;
const BATCH = {
  type: 'object',
  properties: {
    scripts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, title: { type: 'string' }, hook: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } }, cta: { type: 'string' }, cover: { type: 'string' }, summary: { type: 'string' } },
        required: ['id', 'title', 'hook', 'lines', 'cta', 'cover', 'summary'],
      },
    },
  },
  required: ['scripts'],
};

module.exports = {
  name: 'faceless.write_scripts',
  title: 'Write a batch of scripts',
  description: 'Writes up to 30 faceless short scripts at once, each on a topic people looked up last month and not made before, from its Wikipedia facts in plain spoken words, with titles, cover words and descriptions. A printable page and a spreadsheet.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 30,
  timeoutSec: 600,
  input: {
    type: 'object',
    properties: {
      niche: { type: 'string', title: 'Niche', enum: C.NICHE_IDS },
      count: { type: 'integer', title: 'How many scripts', minimum: 5, maximum: 30, default: 30 },
      length: { type: 'string', title: 'Length', enum: Object.keys(S.LENGTHS), default: 'short' },
      topics: { type: 'string', title: 'Your own topics, one per line (optional)', maxLength: 3000 },
    },
  },
  output: {
    type: 'object',
    properties: {
      scripts: { type: 'array' },
      niche: { type: 'string' },
      label: { type: 'string' },
      page: { type: ['object', 'null'] },
      csv: { type: ['object', 'null'] },
      written: { type: 'integer' },
      viaAi: { type: 'integer' },
      notes: { type: 'array' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['scripts'],
  },
  async run(input, ctx) {
    const n = C.nicheFor(ctx, input.niche);
    const count = Math.max(5, Math.min(30, Number(input.count) || 30));
    const length = S.LENGTHS[input.length] ? input.length : 'short';
    const handle = C.handleOf(ctx);
    const today = time.today(ctx);
    const notes = [];

    // 1. Topics: the member's own, else the most looked-up ones not made yet.
    let picks = [];
    const typed = String(input.topics || '').split(/\r?\n|;/).map((t) => text.oneLine(t)).filter(Boolean).slice(0, 30);
    if (typed.length) {
      const found = await W.lookUpAll(ctx, typed, n.id);
      const missing = typed.filter((t, i) => !found[i]);
      if (missing.length) notes.push(`Not found on Wikipedia, so left out: ${missing.join(', ')}. Try the name Wikipedia uses.`);
      picks = found.filter(Boolean).map((t, i) => ({ topic: t, angle: S.pickAngle(t, t.extract, i) || 'sixty' }));
      if (!picks.length) throw new Error("None of those topics turned up on Wikipedia. Try the names Wikipedia uses, like \"Rings of Saturn\".");
    } else {
      const month = W.lastMonth(ctx);
      const read = await W.liveViewsAll(ctx, n.topics, month);
      const topics = n.topics.map((t, i) => (read[i] ? { ...t, views: read[i], month } : { ...t, month: C.TOPICS.month }));
      const list = C.ideas(n, topics, { count, made: C.madeIn(ctx, n.id) });
      picks = list.map((x) => ({ topic: topics.find((t) => t.article === x.article), angle: x.angle, again: x.again, repeat: x.repeat }));
      if (picks.some((p) => p.repeat)) notes.push(`You have made every idea in ${n.label}, so these are the ones you made longest ago. Tell each one a new way, or type your own topics in the box.`);
      else if (picks.some((p) => p.again)) notes.push('You have made every topic here once, so some come back with a new angle, the ones you made longest ago first.');
      if (picks.length < count && !picks.some((p) => p.repeat)) notes.push(`Only ${picks.length} new ideas are left in ${n.label}. Type your own topics in the box for more.`);
    }

    // 2. Facts for each, live when Wikipedia answers. A minute-long script gets an angle that fills it.
    const facts = await W.factsForAll(ctx, picks.map((p) => p.topic));
    const made = C.madeIn(ctx, n.id);
    picks = picks.map((p, i) => ({ ...p, angle: S.angleForLength(p.angle, length, p.topic, facts[i].text, C.madeAngles(made, p.topic.article)) }));

    // 3. Scripts, 6 to a call. A script the facts don't back falls back to its plain draft.
    const groups = [];
    for (let i = 0; i < picks.length; i += PER_CALL) groups.push(picks.slice(i, i + PER_CALL).map((p, k) => ({ ...p, i: i + k })));
    const L = S.LENGTHS[length];
    const results = await web.mapLimit(groups, 3, async (g) => {
      const plainOf = (p) => S.templateScript({ topic: p.topic, angle: p.angle, sentences: facts[p.i].sentences, niche: n, length });
      const { data, ai: viaAi } = await ai.aiJson(ctx, {
        task: 'write',
        system: S.SYSTEM,
        prompt: [
          `Write ${g.length} scripts for ${n.label} shorts (${n.angle}), each ${L.words[0]} to ${L.words[1]} spoken words. Make each one open differently: no two hooks with the same shape.`,
          ...g.map((p) => `Script id ${p.i + 1}. Topic: ${p.topic.topic}${p.topic.description ? ` (${p.topic.description})` : ''}. Angle: ${S.ANGLES[p.angle].label}.\nFacts (from Wikipedia): ${facts[p.i].text.slice(0, 1600)}`),
          `For each, return id, title (under 60 characters), hook (one sentence under 14 words, true to the facts), lines (4 to 9 sentences, each under 22 words, one idea each), cta (one short line asking people to follow, like "Follow for more ${n.more}."), cover (2 to 5 words for the thumbnail) and summary (one sentence for the description).`,
        ].join('\n\n'),
        schema: BATCH,
        maxTokens: 900 * g.length,
        fallback: () => ({ scripts: g.map((p) => ({ id: p.i + 1, ...plainOf(p) })) }),
        accept: (d) => ai.cleanCopy(d) && d.scripts.length >= Math.ceil(g.length / 2),
      });
      return g.map((p) => {
        const got = viaAi ? data.scripts.find((s) => Number(s.id) === p.i + 1) : null;
        if (got) {
          const checked = S.guard(got, facts[p.i].text);
          if (checked.ok) return { p, s: { ...checked, copied: checked.copiedLines.length > 0 }, ai: true };
        }
        return { p, s: plainOf(p), ai: false };
      });
    }, ctx);
    const done = results.flat();
    const viaAi = done.filter((x) => x.ai).length;

    const scripts = done.map(({ p, s, ai: byAi }, k) => {
      const title = S.titleOptions(p.topic.topic, p.angle, length, byAi ? [s.title].filter(Boolean) : [], p.topic)[0];
      const full = { ...s, title, cta: text.oneLine(s.cta) || `Follow for more ${n.more}.` };
      const cover = S.trimCover(full.cover || S.coverFor(p.topic.topic, p.angle, length));
      return {
        n: k + 1,
        title,
        topic: p.topic.topic,
        wiki: p.topic.wiki || p.topic.topic,
        article: p.topic.article,
        angle: p.angle,
        hook: full.hook,
        lines: full.lines,
        cta: full.cta,
        cover,
        description: C.descriptionFor(full, p.topic, n),
        text: S.toText(full, handle),
        seconds: S.secondsOf(full),
        url: p.topic.url || W.urlOf(p.topic.article),
        views: p.topic.views || null,
        evidence: p.topic.views ? `${Number(p.topic.views).toLocaleString('en-US')} Wikipedia views in ${W.monthName(p.topic.month)}` : '',
        copied: !!full.copied,
        ai: byAi,
      };
    });
    if (length === 'minute') {
      const under = scripts.filter((s) => s.seconds < 62).length;
      if (under) notes.push(`${under === scripts.length ? 'These read' : `${under} of these read`} in under a minute. TikTok's Creator Rewards counts only videos longer than 1 minute, so add a line or two before you record.`);
    }
    if (viaAi < scripts.length) notes.push(viaAi ? `${scripts.length - viaAi} of these are plain drafts in Wikipedia's own words: rewrite them before you record.` : "AI is off right now, so these are plain drafts in Wikipedia's own words. Rewrite each one before you record: YouTube doesn't pay for videos that only read out text someone else wrote.");

    const titleText = `${scripts.length} ${n.label.toLowerCase()} scripts`;
    const page = await save.saveFile(ctx, save.fileName(n.label, `${scripts.length} scripts`, today, '.html'), P.scriptsPage({ title: `Your next ${scripts.length}: ${n.label}`, niche: n, date: today, scripts, own: typed.length > 0 }));
    const csv = await save.saveFile(
      ctx,
      save.fileName(n.label, `${scripts.length} scripts`, today, '.csv'),
      files.csv(
        scripts.map((s) => ({ ...s, script: [s.hook, ...s.lines, s.cta].join('\n'), check: s.copied ? "Wikipedia's words: rewrite" : '' })),
        [
          { key: 'n', label: '#' },
          { key: 'title', label: 'Title' },
          { key: 'topic', label: 'Topic' },
          { key: 'script', label: 'Script' },
          { key: 'seconds', label: 'Seconds' },
          { key: 'cover', label: 'Cover words' },
          { key: 'description', label: 'Description' },
          { key: 'url', label: 'Facts from' },
          { key: 'check', label: 'Check' },
          { key: 'recorded', label: 'Recorded (date)' },
          { key: 'posted', label: 'Posted (date)' },
        ],
        { bom: true },
      ),
    );
    if (!typed.length) await C.rememberMade(ctx, n.id, scripts.map((s) => ({ article: s.article, angle: s.angle })));
    let batch = { date: today, niche: n.id, titles: scripts.map((s) => S.cut(s.title, 60)), articles: scripts.map((s) => s.article || ''), covers: scripts.slice(0, 12).map((s) => S.cut(s.cover, 40)) };
    if (Buffer.byteLength(JSON.stringify(batch)) > 3800) batch = { ...batch, titles: batch.titles.map((t) => S.cut(t, 40)), covers: batch.covers.map((c) => S.cut(c, 24)) };
    await brain.remember(ctx, 'batch', batch);
    ctx.log(`${titleText}: ${viaAi} written by AI, ${scripts.length - viaAi} plain drafts; ${done.length ? Math.round(scripts.reduce((a, s) => a + s.seconds, 0) / scripts.length) : 0} seconds on average`);
    return { scripts, niche: n.id, label: n.label, page, csv, written: scripts.length, viaAi, notes, ai: viaAi > 0, sample: viaAi === 0 };
  },
  view(out) {
    return views.blocks(
      views.metric('Scripts', out.written, `${out.label}, about ${Math.round(out.scripts.reduce((a, s) => a + s.seconds, 0) / Math.max(1, out.scripts.length))} seconds each`),
      (out.notes || []).map((x) => views.text(x)),
      views.file(out.page, 'All the scripts on one page, to print or read from your phone'),
      views.table(
        [
          { key: 'n', label: '#', format: 'number' },
          { key: 'title', label: 'Title' },
          { key: 'cover', label: 'Cover words' },
          { key: 'seconds', label: 'Seconds', format: 'number' },
        ],
        out.scripts.map((s) => ({ n: s.n, title: s.title, cover: s.cover, seconds: s.seconds })),
      ),
      out.scripts[0] ? views.copy(`Script 1: ${out.scripts[0].title}`, [out.scripts[0].hook, ...out.scripts[0].lines, out.scripts[0].cta].join('\n')) : null,
      views.file(out.csv, 'Scripts, titles and descriptions (.csv)'),
    );
  },
};
