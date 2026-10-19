// Content pillars: five themes named for the member's business, how often each comes up at their
// pace, and ready ideas for each one, saved as a printable page and an idea bank CSV.

const { views, save, files, text, brain, time } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const { buildPillars } = require('../lib/pillars');
const { page, table, esc } = require('../lib/page');
const { FACT_INPUTS } = require('./hooks');

module.exports = {
  name: 'content.pillars',
  title: 'Set your content pillars',
  description: 'Names five content pillars for your business (questions answered, mistakes and myths, real jobs, behind the scenes, the offer), says how often each comes up at your posting pace, and lists ready ideas for each from real searches and your own topics. Saves a printable page and an idea bank CSV.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      questions: { type: 'array', title: 'Questions', description: 'From content.search_questions' },
      perWeek: { type: 'integer', title: 'Posts a week', minimum: 1, maximum: 7, default: 5 },
      topics: { type: 'string', format: 'textarea', title: 'Your own topics (optional)', description: 'One per line, like "ceramic coating" or "pet hair"', maxLength: 600 },
      ...FACT_INPUTS,
    },
  },
  output: {
    type: 'object',
    properties: {
      pillars: { type: 'array' },
      rhythm: { type: 'object' },
      topics: { type: 'array' },
      ideas: { type: 'integer' },
      live: { type: 'integer' },
      vague: { type: 'boolean' },
      ctaLine: { type: 'string' },
      page: { type: 'object' },
      csv: { type: 'object' },
    },
    required: ['pillars', 'page', 'csv'],
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const out = buildPillars(f, input.questions || [], { perWeek: input.perWeek || 5, topics: input.topics });
    const today = time.today(ctx);
    const base = f.fileBase;
    const rows = out.pillars.flatMap((p) => p.ideas.map((x) => ({ pillar: p.name, theme: p.theme, idea: x.idea, onScreen: x.onScreen, format: x.format, source: x.source, status: 'Not started' })));
    const csv = await save.saveFile(ctx, save.fileName(base, 'content ideas', '.csv'), files.csv(rows, [
      { key: 'pillar', label: 'Pillar' }, { key: 'theme', label: 'Kind of post' }, { key: 'idea', label: 'Idea (say it)' }, { key: 'onScreen', label: 'On-screen text' },
      { key: 'format', label: 'Format' }, { key: 'source', label: 'Where it came from' }, { key: 'status', label: 'Status' },
    ], { bom: true }));
    const nameOf = Object.fromEntries(out.pillars.map((p) => [p.key, p.name]));
    const weekTable = table(
      [{ key: 'day', label: 'Day' }, { key: 'w1', label: 'Week 1' }, { key: 'w2', label: 'Week 2' }],
      out.rhythm.days.map((d, i) => ({ day: d, w1: out.rhythm.weeks[0][i].name, w2: out.rhythm.weeks[1][i].name }))
    );
    const vagueNote = f.vague ? 'Your business details do not say what you sell yet, so these ideas fit any business. Add what you sell, like "mobile dog grooming", and run it again for ideas about your own work and real searches.' : '';
    const body = `${vagueNote ? `<section><div class="card"><p>${esc(vagueNote)}</p></div></section>` : ''}<section><h2>Your five pillars</h2><p class="lead">Every post fits one of these. Three posts that help for free, then one clear ask: ${esc(f.ctaLine)}</p>${out.pillars
      .map((p) => `<div class="card"><div class="meta"><span class="tag${p.key === 'offer' ? ' ask' : ''}">${esc(p.theme)}</span><span class="tag">${esc(p.often)}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.what)}</p><p class="muted">${esc(p.why)}</p><ul class="checks">${p.ideas.filter((x) => !x.topic || !out.topics.length).map((x) => `<li>${esc(x.idea)} <span class="muted">(${esc(x.format)}${/^Real search/.test(x.source) ? ', real search' : ''})</span></li>`).join('')}</ul></div>`)
      .join('')}</section>
<section><h2>Your rhythm at ${esc(text.plural(out.rhythm.perWeek, 'post'))} a week</h2><p class="lead">The order "Plan your week of posts" follows: three posts that help, then one that asks, again and again.</p>${weekTable}</section>
${out.topics.length ? `<section><h2>Your topics in every pillar</h2><p class="lead">One idea per pillar for each topic you gave. They are in the CSV too.</p>${table([{ key: 'topic', label: 'Topic' }, ...out.pillars.map((p) => ({ key: p.key, label: p.theme }))], out.topics.map((t) => Object.fromEntries([['topic', t], ...out.pillars.map((p) => [p.key, (p.ideas.find((x) => x.topic === t) || {}).idea || ''])])))}</section>` : ''}
<section><h2>Use it this week</h2><div class="card"><ol><li>Open the CSV in Google Sheets or Notion. It is your idea bank: mark what you post.</li><li>Pick one idea from the pillar due next and film it today. Say the idea in the first second.</li><li>End every post with your keyword: ${esc(f.ctaLine)}</li><li>Want the week planned for you, with captions and reminders? Run "Plan your week of posts".</li></ol></div></section>`;
    const html = page(f, {
      title: `Your content pillars`,
      kicker: f.name || 'Content pillars',
      sub: `${f.vague ? (f.where ? `In ${f.where}: w` : 'W') : `${text.sentenceCase(f.service)}${f.where ? ` in ${f.where}` : ''}: w`}hat to post about, how often, and ${out.ideas} ideas to start with.`,
      stats: [{ value: 5, label: 'pillars' }, { value: out.ideas, label: 'ideas' }, out.live ? { value: out.live, label: 'from real searches' } : { value: out.rhythm.perWeek, label: 'posts a week' }, { value: f.keyword, label: 'your comment keyword' }],
      body,
      foot: `${[f.name, f.where].filter(Boolean).join(', ')}. Made ${time.longDate(today)}.`,
    });
    const pageFile = await save.saveFile(ctx, save.fileName(base, 'content pillars', '.html'), html);
    await brain.remember(ctx, 'pillars', { names: nameOf, topics: out.topics, perWeek: out.rhythm.perWeek, on: today });
    ctx.log(`5 pillars, ${out.ideas} ideas${out.topics.length ? `, ${text.plural(out.topics.length, 'topic')} of yours` : ''}.`);
    return { ...out, vague: !!f.vague, ctaLine: f.ctaLine, page: pageFile, csv };
  },
  view(out) {
    return views.blocks(
      out.vague ? views.text('Your business details do not say what you sell yet, so these ideas fit any business. Add what you sell, like "mobile dog grooming", and run it again for ideas about your own work.') : null,
      views.metric('Content pillars', 5, `${out.ideas} ideas to start with, ${text.plural(out.rhythm.perWeek, 'post')} a week`),
      views.cards(out.pillars.map((p) => ({ title: p.name, subtitle: `${p.theme}, ${p.often}`, body: p.ideas.slice(0, 2).map((x) => x.idea).join(' / '), badge: p.key === 'offer' ? 'The ask' : '' }))),
      views.file(out.page, 'Your pillars, rhythm and ideas (printable)'),
      views.file(out.csv, 'Idea bank (CSV for Sheets or Notion)'),
      views.text(`End every post with: ${out.ctaLine}`)
    );
  },
};
