// Puts the chosen parts and name together: the offer, a printable one-page offer, and the offer in
// lengths for a bio, a DM and a website.

const { text, ai, views, save } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const { assemble, lengths, onePager } = require('../lib/stack');

module.exports = {
  name: 'offer.build_offer',
  title: 'Build the offer',
  description: 'Builds the offer from the chosen parts and name: a printable one-page offer and the offer for a bio, a DM and a website.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      parts: { type: 'array', title: 'Parts to include' },
      name: { title: 'Offer name' },
      keyword: { type: 'string', title: 'DM keyword (optional)', maxLength: 20 },
      what: { type: 'string', maxLength: 200 },
      who: { type: 'string', maxLength: 200 },
      outcome: { type: 'string', maxLength: 200 },
      price: { type: 'number', minimum: 0 },
      capacity: { type: 'number', minimum: 0, title: 'Jobs you can take (optional)' },
      startDate: { type: 'string', title: 'Price goes up on (optional)' },
    },
  },
  output: { type: 'object', properties: { offer: { type: 'object' }, lengths: { type: 'array' }, file: { type: 'object' }, ai: { type: 'boolean' } }, required: ['offer', 'lengths'] },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const nm = Array.isArray(input.name) ? input.name[0] : input.name;
    const name = text.oneLine(nm && typeof nm === 'object' ? nm.name || nm.label : nm || '');
    const parts = (input.parts || []).filter((p) => p && typeof p === 'object').slice(0, 7);
    const o = assemble(f, { parts, name, keyword: input.keyword || '' });
    const base = lengths(o, f);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You tighten small business offer copy. Keep every fact, the price and the promise. The seller is the sender. No hype.',
      prompt: `Tighten these, same ids, same facts. The bio must be 150 characters or fewer.\n${base.map((l) => `${l.id}: ${l.text}`).join('\n')}`,
      schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string', maxLength: 1200 } }, required: ['id', 'text'] } } }, required: ['items'] },
      fallback: () => ({ items: base }),
      accept: ai.cleanCopy,
    });
    const got = Object.fromEntries((data.items || []).map((x) => [x.id, x.text]));
    const out = base.map((l) => {
      const t = got[l.id] && !(l.id === 'bio' && got[l.id].length > 150) ? text.plain(got[l.id]) : l.text;
      return { ...l, text: t };
    });
    const file = await save.saveFile(ctx, save.fileName(o.name || f.whatShort, 'one page offer', '.html'), onePager(o, f));
    ctx.log(`Built "${o.name}" with ${parts.length} parts`);
    return { offer: o, lengths: out, file, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.metric('Your offer', out.offer.name, out.offer.priceLine || ''),
      out.lengths.slice(0, 6).map((l) => views.copy(l.label, l.text)),
      views.file(out.file, 'One-page offer (print or share)'),
    );
  },
};
