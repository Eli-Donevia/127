// Writes the DM reply bank: 20 answers to the questions people send most, in the member's voice,
// plus 4 keyword auto-replies for ManyChat. Facts come only from the member; unknowns stay in
// [brackets] so nothing is invented. AI polishes the wording when it's on.

const { ai, views, brain, text } = require('../../_kit');
const { parseFacts, replyBank, autoReplies } = require('../lib/replies');
const { LIMITS, checkMessage } = require('../lib/limits');

const SCHEMA = {
  type: 'object',
  properties: { replies: { type: 'array', minItems: 20, maxItems: 20, items: { type: 'object', properties: { text: { type: 'string', maxLength: 500 } }, required: ['text'] } } },
  required: ['replies'],
};

module.exports = {
  name: 'dm.write_replies',
  title: 'Write your DM replies',
  description: 'Writes 20 replies for the questions people DM a small business (price, dates, area, custom orders, availability, discounts, reviews) and 4 ManyChat keyword auto-replies, from your own facts.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      facts: { type: 'string', title: 'Your facts', maxLength: 1500 },
      link: { type: 'string', title: 'Main link', maxLength: 500 },
    },
  },
  output: {
    type: 'object',
    properties: { items: { type: 'array' }, missing: { type: 'integer' } },
    required: ['items'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, {});
    const facts = parseFacts(input.facts);
    const link = String(input.link || '').trim();
    const bank = replyBank(b, facts, link);
    const autos = autoReplies(b, facts, link);
    ctx.log(`Writing ${bank.length} replies for ${b.name || 'your business'}`);
    const prompt = [
      'Rewrite these Instagram DM replies so they sound like this business owner. Keep every fact, price, link and [bracket] exactly as written. Do not add facts. Same order, same meaning, under 300 characters each, warm and short, first person.',
      brain.describe(b),
      '',
      ...bank.map((r, i) => `${i + 1}. (${r.situation}) ${r.text}`),
    ].join('\n');
    const keepsFacts = (d) => d.replies.every((r, i) => (bank[i].text.match(/\[[^\]]+\]|https?:\/\/\S+|\$\d[\d,.]*/g) || []).every((tok) => r.text.includes(tok)));
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      prompt,
      schema: SCHEMA,
      fallback: () => ({ replies: bank.map((r) => ({ text: r.text })) }),
      accept: (d) => ai.cleanCopy(d) && keepsFacts(d),
      maxTokens: 2500,
    });
    const items = bank.map((r, i) => ({ ...r, text: data.replies[i].text })).concat(autos);
    for (const a of autos) a.check = checkMessage({ text: a.text, buttons: a.button ? [a.button] : [] });
    const missing = items.filter((x) => /\[[^\]]+\]/.test(x.text)).length;
    return { items, missing, ai: usedAi, limit: LIMITS.withButtons };
  },
  view(out) {
    return views.blocks(
      views.metric('Replies written', out.items.length, out.missing ? `${out.missing} have a [bracket] to fill with your details` : 'All filled from your facts'),
      ...out.items.slice(0, 8).map((r) => views.copy(r.label, r.text)),
      views.text(`Plus ${Math.max(0, out.items.length - 8)} more in the sheet.`)
    );
  },
};
