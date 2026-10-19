// Makes the chosen freebie as a real file, plus the post, 3 stories and the DM keyword to share it.

const { text, ai, views, save, brain } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const magnets = require('../lib/magnets');

module.exports = {
  name: 'offer.build_magnet',
  title: 'Make the freebie',
  description: 'Makes the chosen freebie as a real file (checklist page, calculator sheet with formulas, template or claim cards) and writes the post and DM keyword to share it.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: { type: 'object', properties: { idea: { title: 'Chosen freebie' }, keyword: { type: 'string', maxLength: 20 }, what: { type: 'string', maxLength: 200 } } },
  output: { type: 'object', properties: { title: { type: 'string' }, files: { type: 'array' }, promo: { type: 'object' }, ai: { type: 'boolean' } }, required: ['files', 'promo'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const ideas = magnets.ideas(f);
    const pick = Array.isArray(input.idea) ? input.idea[0] : input.idea;
    const idea = ideas.find((x) => pick && (x.id === pick.id || x.kind === pick.kind)) || ideas[0];
    const offer = brain.packMemory(ctx, 'offer').offer || null;
    const name = f.business || f.whatShort;
    const files = [];
    if (idea.kind === 'checklist') files.push(await save.saveFile(ctx, save.fileName(idea.title, '.html'), magnets.checklistHtml(f, offer)));
    else if (idea.kind === 'calculator') files.push(await save.saveFile(ctx, save.fileName(idea.title, '.csv'), magnets.calcCsv(magnets.calcIdOf(f), f)));
    else if (idea.kind === 'template') {
      const t = magnets.templateHtml(magnets.templateIdOf(f), f, offer);
      files.push(await save.saveFile(ctx, save.fileName(t.title || idea.title, '.html'), t.html));
      if (t.csv) files.push(await save.saveFile(ctx, save.fileName(t.title || idea.title, '.csv'), t.csv));
    } else files.push(await save.saveFile(ctx, save.fileName(name, 'claim cards', '.html'), magnets.claimHtml(f, {})));
    const base = magnets.promo(f, idea, { keyword: input.keyword || idea.keyword });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write one short social post for a small business sharing a free resource. Plain words, the seller is the sender, no hype, keep the keyword exactly.',
      prompt: `Rewrite this post in the same length, same keyword ${base.keyword}:\n${base.post}`,
      schema: { type: 'object', properties: { post: { type: 'string', maxLength: 900 } }, required: ['post'] },
      fallback: () => ({ post: base.post }),
      accept: (d) => ai.cleanCopy(d) && String(d.post || '').includes(base.keyword),
    });
    const promo = { ...base, post: text.plain(data.post || base.post) };
    ctx.log(`Made ${idea.title}`);
    return { title: idea.title, kind: idea.kind, files, promo, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.metric('Your freebie', out.title, `Keyword: ${out.promo.keyword}`),
      out.files.map((x) => views.file(x)),
      views.copy('Post to share it', out.promo.post),
      (out.promo.story || []).slice(0, 3).map((s, i) => views.copy(`Story ${i + 1}`, s)),
      views.copy('DM that delivers it', out.promo.deliver),
      views.copy('Follow-up 2 days later', out.promo.follow),
    );
  },
};
