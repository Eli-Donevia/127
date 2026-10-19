// Writes the words for the page from the member's real facts: headline, intro, about, service
// lines, how it works, FAQ, closing line and search text. The AI only rewords what the member gave;
// every draft is checked (no numbers, reviews, ratings or results the member didn't give) and falls
// back to the written template, which is built from the same facts and varied per business.

const { ai, views } = require('../../_kit');
const { factsFrom } = require('../lib/facts');
const { rankTemplates } = require('../lib/pick');
const { draftCopy, toItems, guardProblems } = require('../lib/copy');
const { getTemplate } = require('../lib/templates');

const designOf = (d) => (Array.isArray(d) ? d[0] : d) || null;
const designId = (d) => {
  const x = designOf(d);
  return typeof x === 'string' ? x : x && x.id;
};

const SCHEMA = {
  type: 'object',
  properties: {
    heroTitle: { type: 'string' },
    heroSub: { type: 'string' },
    about: { type: 'string' },
    services: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, blurb: { type: 'string' } }, required: ['name', 'blurb'] } },
    faq: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } }, required: ['q', 'a'] } },
    ctaTitle: { type: 'string' },
    ctaSub: { type: 'string' },
  },
  required: ['heroTitle', 'heroSub', 'about'],
};

module.exports = {
  name: 'site.write_copy',
  title: 'Write the words',
  description: 'Writes the headline, about, service lines, FAQ and search text for your page from the facts you gave. Nothing invented: no reviews, numbers or claims you did not give.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      facts: { type: 'object', title: 'Your business facts' },
      design: { title: 'Design', description: 'A design id, or the design you picked' },
    },
  },
  output: {
    type: 'object',
    properties: { design: { type: 'string' }, copy: { type: 'object' }, items: { type: 'array' }, ai: { type: 'boolean' } },
    required: ['design', 'copy', 'items'],
  },
  async run(input, ctx) {
    const f = factsFrom(ctx, input.facts || {});
    const id = designId(input.design) || rankTemplates(f)[0].id;
    getTemplate(id);
    const base = draftCopy(f, id);
    const facts = [
      `Business: ${f.name}`,
      f.what && `What it is: ${f.what}`,
      f.place && `Where: ${f.place}`,
      f.area && `Area served: ${f.area}`,
      f.audience && `For: ${f.audience}`,
      f.offer && `Main offer: ${f.offer}`,
      f.tagline && `Their own line: ${f.tagline}`,
      f.about && `About, in their words: ${f.about}`,
      f.hoursLine && `Hours: ${f.hoursLine}`,
      f.services.length && `Services and prices: ${f.services.map((s) => [s.name, s.priceText, s.duration, s.description].filter(Boolean).join(', ')).join('; ')}`,
      f.menu.length && `Menu: ${f.menu.map((g) => `${g.title}: ${g.items.map((i) => [i.name, i.priceText].filter(Boolean).join(' ')).join(', ')}`).join('; ')}`,
      f.included.length && `Included: ${f.included.join('; ')}`,
      f.owner && `Owner first name: ${f.owner}`,
    ].filter(Boolean);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system:
        'You write one-page websites for first-time small business owners. Short, warm, specific sentences. Use only the facts given. Never invent reviews, ratings, awards, years in business, client counts, guarantees, licenses or results. Keep every price exactly as given. No exclamation marks.',
      prompt: [
        `Write the words for a ${getTemplate(id).name.toLowerCase()} style one-page website.`,
        ...facts,
        'heroTitle: 3 to 8 words. heroSub: one or two sentences. about: 2 to 4 sentences in plain words.',
        `services: one short line (under 16 words) for each of: ${f.services.map((s) => s.name).join('; ') || 'none'}. Keep the names exactly.`,
        'faq: 3 to 5 questions a first-time customer asks, answered only from the facts above.',
        'ctaTitle: 2 to 6 words. ctaSub: one sentence that says how to book or get in touch.',
      ].join('\n'),
      schema: SCHEMA,
      maxTokens: 1400,
      accept: (d) => guardProblems({ ...base, ...d }, f).length === 0,
      fallback: () => ({}),
    });
    const merged = { ...base };
    if (usedAi) {
      for (const k of ['heroTitle', 'heroSub', 'about', 'ctaTitle', 'ctaSub']) if (data[k]) merged[k] = data[k];
      if (Array.isArray(data.services)) merged.services = base.services.map((s) => ({ ...s, blurb: (data.services.find((x) => x.name === s.name) || {}).blurb || s.blurb }));
      if (Array.isArray(data.faq) && data.faq.length) merged.faq = data.faq.slice(0, 6);
    }
    ctx.log(usedAi ? 'Wrote the words with AI from your facts' : 'Wrote the words from your facts with the house templates');
    return { design: id, copy: merged, items: toItems(merged), ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.metric('Headline', out.copy.heroTitle, out.copy.heroSub),
      views.text('Every line comes from the facts you gave. Change anything in the next step.'),
      views.table(
        [
          { key: 'label', label: 'Part' },
          { key: 'text', label: 'Words' },
        ],
        out.items,
        12
      )
    );
  },
};
