// Saves the checked offer to the member's Library and remembers it, so the other offer, warm and
// content workflows use it without asking again.

const { text, views, save, brain } = require('../../_kit');

module.exports = {
  name: 'offer.save_offer',
  title: 'Save my offer',
  description: 'Saves the offer in every length as one text file and remembers it for the other workflows.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: { type: 'object', properties: { offer: { type: 'object' }, items: { type: 'array' } }, required: ['offer'] },
  output: { type: 'object', properties: { file: { type: 'object' }, remembered: { type: 'boolean' } }, required: ['file'] },
  async run(input, ctx) {
    const o = input.offer || {};
    const items = (input.items || []).filter((x) => x && x.text);
    const by = Object.fromEntries(items.map((x) => [x.id, text.plain(x.text)]));
    const body = [o.name, '', ...items.map((x) => `${x.label}\n${text.plain(x.text)}\n`)].join('\n');
    const file = await save.saveFile(ctx, save.fileName(o.name || 'offer', 'in every length', '.txt'), body);
    const promise = o.promise || {};
    await brain.remember(ctx, 'offer', { name: o.name, what: o.what, who: o.who, outcome: o.outcome, price: o.price, keyword: o.keyword, promise: promise.short || promise.text || '', bio: by.bio || '', dm: by.dm || '', site: by.site || '' });
    ctx.log(`Saved ${o.name}`);
    return { file, remembered: true };
  },
  view(out) {
    return views.blocks(views.text('Saved. Your other workflows will use this offer.'), views.file(out.file, 'Your offer in every length'));
  },
};
