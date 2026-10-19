// One short personal text for each chosen person, in the member's voice. AI writes the top 5 (they
// matter most); the rest come from templates built from the member's own notes, varied per person.

const { text, ai, views } = require('../../_kit');
const { offerFacts } = require('../lib/facts');
const M = require('../lib/messages');

module.exports = {
  name: 'warm.write_messages',
  title: 'Write my messages',
  description: 'Writes one short personal text per person (ask to buy, ask who they know, or ask for advice), using only what the member wrote about them. Aims for 2 text segments or fewer.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 5,
  input: { type: 'object', properties: { people: { type: 'array' }, what: { type: 'string', maxLength: 200 }, price: { type: 'number', minimum: 0 } }, required: ['people'] },
  output: { type: 'object', properties: { items: { type: 'array' }, ai: { type: 'boolean' } }, required: ['items'] },
  async run(input, ctx) {
    const o = offerFacts(ctx, input);
    const people = (input.people || []).filter((p) => p && p.name).slice(0, 25);
    const base = people.map((p, i) => ({ p, d: M.draft(p, o, `${p.name}${i}`) }));
    const top = base.slice(0, 5);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short, warm texts a small business owner sends to people they already know. The owner is the sender. Plain words, no hype, no pressure, 300 characters or fewer, straight apostrophes. Use only the facts given about each person.',
      prompt: [`I just started: ${o.what}${o.city ? ` in ${o.city}` : ''}.${o.priceText ? ` Price: ${o.priceText}.` : ''}`,
        'For each person write one text. could buy: offer to save them a spot. could refer: ask "do you know anyone who" needs it. could advise: ask for 15 minutes of advice.',
        ...top.map(({ p }, i) => `${i + 1}. ${p.name} (${p.group}). My note: ${p.note || 'none'}`)].join('\n'),
      schema: { type: 'object', properties: { texts: { type: 'array', items: { type: 'string', maxLength: 320 } } }, required: ['texts'] },
      fallback: () => ({ texts: top.map(({ d }) => d.text) }),
      accept: (d) => ai.cleanCopy(d) && Array.isArray(d.texts) && d.texts.length === top.length,
    });
    const items = base.map(({ p, d }, i) => {
      const t = i < 5 && data.texts && data.texts[i] ? M.straight(text.plain(data.texts[i])) : d.text;
      const seg = M.segments(t);
      return { id: `p${i + 1}`, name: p.name, label: `${p.name}, ${p.groupLabel || p.group}`, text: t, phone: p.phone || '', email: p.email || '', group: p.group, why: p.why || '', segments: seg.segments };
    });
    ctx.log(`Wrote ${items.length} messages`);
    return { items, ai: usedAi };
  },
  view(out) {
    return views.blocks(out.items.slice(0, 25).map((x) => views.copy(x.label, x.text)));
  },
};
