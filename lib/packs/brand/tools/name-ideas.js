// Business name ideas that fit what the member sells, each with the reason it works and a .com to
// check. AI writes them; without AI, a template mixes the member's words with proven name patterns.

const { text, ai, brain, views } = require('../../_kit');
const { templateIdeas, nameProblems } = require('../lib/names');
const { own } = require('../lib/kit');

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    names: {
      type: 'array',
      minItems: 6,
      items: {
        type: 'object',
        properties: { name: { type: 'string', maxLength: 32 }, why: { type: 'string', maxLength: 140 }, style: { type: 'string' } },
        required: ['name', 'why'],
      },
    },
  },
  required: ['names'],
};

module.exports = {
  name: 'brand.name_ideas',
  title: 'Name ideas',
  description: 'Writes 12 business name ideas that fit what the member sells, each with why it works: place plus craft, your own name, two words fused, a coined word and a picture of the result. No filler words, no famous brands.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      what: { type: 'string', title: 'What you sell', description: 'For example "mobile car detailing"', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      keywords: { type: 'string', title: 'Words you like (optional)', maxLength: 120 },
      founder: { type: 'string', title: 'Your name (optional)', maxLength: 80 },
      count: { type: 'integer', minimum: 6, maximum: 20, default: 12 },
    },
  },
  output: {
    type: 'object',
    properties: { names: { type: 'array' }, ai: { type: 'boolean' } },
    required: ['names'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const what = input.what || own(b.what) || own(b.niche) || own(b.offer);
    if (!what) throw new Error('Tell us what you sell, like "mobile car detailing".');
    const founder = input.founder || b.firstName;
    const count = input.count || 12;
    const template = () => templateIdeas({ what, city: input.city || b.city, founder, keywords: input.keywords, count });
    const fallback = () => ({ names: template() });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You name small businesses. Names must be easy to say, spell and remember, and must not copy a famous brand.',
      prompt: [
        `Write ${count} name ideas for this business.`,
        `What it sells: ${what}`,
        input.city || b.city ? `Where: ${input.city || b.city}` : '',
        input.keywords ? `Words the founder likes: ${input.keywords}` : '',
        founder ? `Founder: ${founder}` : '',
        'Mix five styles: place (city plus craft), founder (their name), compound (two real words fused into one), coined (an invented, sayable word), metaphor (a picture of the result).',
        'Max 3 words and 22 characters each. No filler like Solutions, Pros, Lab, Hub, Elite, Mobile. Never use or echo a famous brand.',
        'For each: name, why (one short sentence), style.',
      ].filter(Boolean).join('\n'),
      schema: IDEAS_SCHEMA,
      fallback,
      accept: ai.cleanCopy,
    });
    // Keep the AI names that pass the same rules as the template, then top up from the template.
    let names = data.names.map((n) => ({ name: text.oneLine(n.name), why: text.oneLine(n.why), style: n.style || '' })).filter((n) => !nameProblems(n.name, { exempt: String(founder || '').split(/\s+/) }).length);
    if (names.length < count) for (const t of template()) if (names.length < count && !names.some((n) => n.name.toLowerCase() === t.name.toLowerCase())) names.push(t);
    names = names.slice(0, count);
    ctx.log(`Wrote ${names.length} name ideas`);
    return { names, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.table([{ key: 'name', label: 'Name' }, { key: 'style', label: 'Style' }, { key: 'why', label: 'Why it works' }], out.names, 20),
      views.text('Say your favorite out loud to three people. If they can spell it back, it works. Search the trademark office before you print anything.'),
      views.link('Search US trademarks (USPTO)', 'https://tmsearch.uspto.gov/')
    );
  },
};
