// A 15-second script and shot list for one real product, to film once the member has it. Facts come
// from the store page only; the reaction line stays a blank for the member's honest words.

const { views, save, ai, text } = require('../../_kit');
const U = require('../lib/ugc');

const CLAIMS = /\b(i|we)('ve| have)? (love|loved|use|used|tried|swear|switched)\b|\bmy (favorite|holy grail)\b|\b(changed my|life[- ]changing|clinically|cures?|heals?|results)\b/i;

module.exports = {
  name: 'ugc.write_script',
  title: 'Write the video script',
  description: 'Writes a 15-second hook, lines, on-screen captions and four shots for one real product, using only what its store page says. The reaction line stays yours to fill on first use.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: { brand: { type: 'object', title: 'Brand' }, category: { type: 'string', enum: U.CAT_IDS } },
    required: ['brand'],
  },
  output: { type: 'object', properties: { script: { type: 'object' }, doc: { type: 'object' }, ai: { type: 'boolean' } }, required: ['script'] },
  async run(input, ctx) {
    const brand = input.brand || {};
    if (!brand.name) throw new Error('Pick a brand first.');
    const cat = U.catOf(input.category || brand.category);
    const base = U.scriptFor(brand, cat);
    const p = brand.product || {};
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write 15-second UGC video scripts for a creator pitching a small brand. Use only the facts given. The creator has not used the product yet: never say I love, I use, I tried, my favorite, or any result. Plain words, no hashtags, no emoji.',
      prompt: `Brand: ${brand.name} (${brand.domain})\nProduct: ${p.title}, ${p.price ? `$${p.price}` : 'price on site'}\nCategory: ${cat.label}. Angle: ${cat.angle}.\nWhat their content is missing: ${(brand.gaps || []).map((g) => g.text).join('; ')}\nWrite a hook (under 12 words) and a caption for the hook (under 8 words). Keep the product name exactly as given.`,
      schema: { type: 'object', properties: { hook: { type: 'string', maxLength: 90 }, caption: { type: 'string', maxLength: 60 } }, required: ['hook', 'caption'] },
      maxTokens: 300,
      accept: (d) => ai.cleanCopy(d) && !CLAIMS.test(`${d.hook} ${d.caption}`) && d.hook.split(/\s+/).length <= 14,
      fallback: () => ({ hook: base.lines[0].say, caption: base.lines[0].caption }),
    });
    const script = { ...base, lines: base.lines.map((l, i) => (i === 0 ? { ...l, say: text.oneLine(data.hook), caption: text.oneLine(data.caption) } : l)) };
    const doc = await save.saveFile(ctx, save.fileName(brand.name, 'concept-script', '.md'), U.scriptMd(brand, script));
    ctx.log(`Wrote the ${script.length}-second script for ${p.title || brand.name}`);
    return { script, doc, ai: usedAi, brand: brand.name };
  },
  view(out) {
    return views.blocks(
      views.table(
        [
          { key: 'time', label: 'Time' },
          { key: 'say', label: 'Say' },
          { key: 'shot', label: 'Shot' },
        ],
        out.script.lines.map((l) => ({ time: `${l.at}-${l.end}s`, say: l.say, shot: l.shot })),
      ),
      views.text(out.script.notes.join(' ')),
      views.file(out.doc, 'Script and shot list (.md)'),
    );
  },
};
