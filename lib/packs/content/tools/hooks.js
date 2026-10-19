// Real questions people search, then hooks in proven formats built from the member's own facts.

const { text, ai, views, save, files } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const { liveQuestions, starterQuestions } = require('../lib/questions');
const { rankHooks, ownHooks, specificEnough, PILLARS } = require('../lib/hooks');
const { page, esc } = require('../lib/page');

const FACT_INPUTS = {
  keyword: { type: 'string', title: 'Comment keyword (optional)', description: 'The word people comment to get your offer, like QUOTE', maxLength: 20 },
  magnet: { type: 'string', title: 'What they get (optional)', description: 'For example "my price list" or "a free quote"', maxLength: 120 },
  area: { type: 'string', title: 'Neighborhood or area (optional)', maxLength: 80 },
};

const searchQuestions = {
  name: 'content.search_questions',
  title: 'Find real questions',
  description: 'Finds the questions people type into Google and YouTube about your service and city (public search suggestions), cleaned and sorted. Without the network it uses common questions for your kind of business.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { area: FACT_INPUTS.area } },
  output: { type: 'object', properties: { questions: { type: 'array' }, live: { type: 'boolean' } }, required: ['questions'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    let questions = [];
    if (f.vague) ctx.log('Nothing says what you sell yet, so these are common questions. Add what you sell to your business details for real searches.');
    else {
      try {
        questions = await liveQuestions(ctx, f, { limit: 30 });
      } catch (e) {
        ctx.log(`Live search suggestions were not reachable (${text.clip(String(e && e.message), 80)}), so these are common questions for ${f.service}.`);
      }
    }
    const live = questions.length > 0;
    if (!live) questions = starterQuestions(f);
    ctx.log(`${questions.length} questions about ${f.service}${live ? ' from live search' : ''}`);
    return { questions, live, service: f.service, where: f.where };
  },
  view(out) {
    return [
      views.metric('Questions people ask', out.questions.length, out.live ? 'From Google and YouTube search suggestions today' : 'Common questions for your kind of business'),
      views.table([{ key: 'q', label: 'Question' }, { key: 'kind', label: 'Kind' }, { key: 'source', label: 'Source' }], out.questions, 12),
    ];
  },
};

const HOOKS_SCHEMA = { type: 'object', properties: { hooks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, hook: { type: 'string', maxLength: 150 }, onScreen: { type: 'string', maxLength: 56 } }, required: ['id', 'hook'] } } }, required: ['hooks'] };

const writeHooks = {
  name: 'content.write_hooks',
  title: 'Write hooks',
  description: 'Writes up to 40 hooks for short videos and posts in 17 proven formats (real question, mistake, myth, before and after, price talk, local call-out and more), built from your service, city, buyers, price and keyword, ranked and saved as a CSV and a printable hook bank.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      questions: { type: 'array', title: 'Questions', description: 'From content.search_questions' },
      count: { type: 'integer', minimum: 10, maximum: 40, default: 30 },
      own: { type: 'string', title: 'Your own ideas (optional)', description: 'One per line; they go on top', maxLength: 2000 },
      ...FACT_INPUTS,
    },
  },
  output: { type: 'object', properties: { hooks: { type: 'array' }, keyword: { type: 'string' }, ctaLine: { type: 'string' }, files: { type: 'array' }, ai: { type: 'boolean' } }, required: ['hooks'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const count = input.count || 30;
    const own = ownHooks(input.own);
    let hooks = [...own, ...rankHooks(f, input.questions || [], { count })].slice(0, count);
    const top = hooks.filter((h) => h.format !== 'yours').slice(0, 10);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write hooks for short videos for a small local business. Plain words, no hype, no emoji, no claims the owner cannot back up. Keep every fact (prices, places, names) exactly as given.',
      prompt: [
        `Business: ${f.name || f.service}, ${f.service} in ${f.where || f.city || 'their area'}. Buyers: ${f.buyers}. Price: ${f.priceText || 'not given'}. Keyword: ${f.keyword}.`,
        'Make each hook sharper and more specific to this business. Same meaning, same format, under 120 characters. onScreen is the short text for the first frame (under 50 characters).',
        JSON.stringify(top.map((h) => ({ id: h.id, format: h.formatLabel, hook: h.hook }))),
      ].join('\n'),
      schema: HOOKS_SCHEMA,
      fallback: () => ({ hooks: [] }),
      accept: (d) => ai.cleanCopy(d) && (!d.hooks.length || specificEnough(d.hooks, f)),
    });
    const better = new Map((data.hooks || []).map((h) => [h.id, h]));
    hooks = hooks.map((h, i) => {
      const b = better.get(h.id);
      const hook = b ? text.oneLine(b.hook) : h.hook;
      return { ...h, rank: i + 1, hook, onScreen: b && b.onScreen ? text.clip(b.onScreen, 56) : h.onScreen, source: h.live ? 'Real search' : h.format === 'yours' ? 'Yours' : 'Template' };
    });
    const rows = hooks.map((h) => ({ rank: h.rank, hook: h.hook, onScreen: h.onScreen, format: h.formatLabel, pillar: (PILLARS.find((p) => p.key === h.pillar) || {}).name || h.pillar, why: h.why, score: h.score, source: h.source }));
    const csv = files.csv(rows, [
      { key: 'rank', label: 'Rank' }, { key: 'hook', label: 'Hook (say it)' }, { key: 'onScreen', label: 'On-screen text' }, { key: 'format', label: 'Format' },
      { key: 'pillar', label: 'Pillar' }, { key: 'why', label: 'Why it works' }, { key: 'score', label: 'Score' }, { key: 'source', label: 'Source' },
    ], { bom: true });
    const body = PILLARS.map((p) => {
      const list = hooks.filter((h) => h.pillar === p.key);
      if (!list.length) return '';
      return `<section><h2>${esc(p.name)}</h2><p class="lead">${esc(p.what)}</p>${list.map((h) => `<div class="card"><div class="meta"><span class="tag">${esc(h.formatLabel)}</span>${h.live ? '<span class="tag">Real search</span>' : ''}${p.key === 'offer' ? '<span class="tag ask">The ask</span>' : ''}</div><h3>${esc(h.hook)}</h3><p class="muted">On screen: ${esc(h.onScreen)}. ${esc(h.why)}</p></div>`).join('')}</section>`;
    }).join('') + (own.length ? `<section><h2>Your ideas</h2>${own.map((h) => `<div class="card"><h3>${esc(h.hook)}</h3></div>`).join('')}</section>` : '');
    const html = page(f, {
      title: `${hooks.length} hooks for ${f.name || (f.vague ? 'your business' : f.service)}`,
      kicker: 'Hook bank',
      sub: `${f.vague ? '' : `${text.sentenceCase(f.service)}${f.where ? ` in ${f.where}` : ''}. `}Say the hook in the first second, put the on-screen text in the middle of the frame, and end every post with: ${f.ctaLine}`,
      stats: [{ value: hooks.length, label: 'hooks' }, { value: hooks.filter((h) => h.live).length, label: 'from real searches' }, { value: f.keyword, label: 'your comment keyword' }],
      body,
    });
    const saved = [await save.saveFile(ctx, save.fileName(f.fileBase, 'hooks', '.csv'), csv), await save.saveFile(ctx, save.fileName(f.fileBase, 'hook bank', '.html'), html)];
    ctx.log(`Wrote ${hooks.length} hooks${usedAi ? ', sharpened with AI' : ''}`);
    return { hooks, keyword: f.keyword, ctaLine: f.ctaLine, files: saved, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.metric('Hooks written', out.hooks.length, `Every post ends with: ${out.ctaLine}`),
      views.table([{ key: 'rank', label: '#' }, { key: 'hook', label: 'Hook' }, { key: 'formatLabel', label: 'Format' }, { key: 'source', label: 'Source' }], out.hooks, 12),
      (out.files || []).map((a) => views.file(a, /\.csv$/.test(a.name) ? 'All hooks (CSV for Sheets or Notion)' : 'Printable hook bank')),
    );
  },
};

module.exports = { searchQuestions, writeHooks, FACT_INPUTS };
