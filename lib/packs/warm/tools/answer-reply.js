// Answer a reply from someone the member knows: what they meant, a short answer with one next step,
// and the Pipeline updated (their reply and the answer, ctx.leads.update / upsert). Built-in rules
// read the reply; for the top cases (a yes, a price question, a question, a catch-up) AI rewrites the
// answer to fit what they said, using only facts the member gave, with the built-in answer as the
// fallback. A request to stop never goes to AI and gets no answer: the person is marked lost.

const { text, ai, views } = require('../../_kit');
const { offerFacts } = require('../lib/facts');
const M = require('../lib/messages');
const A = require('../lib/asks');
const P = require('../lib/pipeline');

const AI_CASES = new Set(['yes', 'price', 'question', 'catchup', 'other', 'referral']);
const STAGE_FOR = { stop: 'lost', no: 'lost' };

module.exports = {
  name: 'warm.answer_reply',
  title: 'Answer their reply',
  description: 'Paste what someone you know wrote back. Says what they meant (yes, the price, a question, a referral, not now, no, or stop), drafts a short answer with one next step, and updates your Pipeline. A stop gets no answer.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 3,
  input: {
    type: 'object',
    properties: {
      who: { type: 'string', title: 'Which person', maxLength: 120 },
      reply: { type: 'string', title: 'What they wrote back', maxLength: 4000 },
      what: { type: 'string', title: 'What you sell (optional)', maxLength: 200 },
      price: { type: 'number', title: 'Your price (optional)', minimum: 0 },
    },
    required: ['who', 'reply'],
  },
  output: {
    type: 'object',
    properties: { name: { type: 'string' }, intent: { type: 'string' }, meaning: { type: 'string' }, answer: { type: 'string' }, next: { type: 'string' }, stop: { type: 'boolean' }, pipeline: { type: 'string' }, found: { type: 'boolean' }, ai: { type: 'boolean' } },
    required: ['intent', 'meaning', 'answer', 'next', 'stop'],
  },
  async run(input, ctx) {
    const reply = String(input.reply || '').trim();
    if (!reply) throw new Error('Paste what they wrote back first.');
    const name = text.clip(text.oneLine(input.who || ''), 120);
    if (!name) throw new Error('Say who wrote back.');
    const o = offerFacts(ctx, input);
    const leads = await P.allLeads(ctx);
    const lead = P.findByName(leads, name);
    const person = { name: lead ? lead.name : name, note: lead ? lead.note || '' : '' };
    const intent = A.intentOf(reply, lead);
    const fallback = A.answerText(intent, { person, o, lead, seed: name });
    let answer = fallback;
    let usedAi = false;
    // Stops never reach AI. AI answers only the top cases, from the facts given; a price it wasn't
    // given, a review ask or a broken copy rule sends it back to the built-in answer.
    if (AI_CASES.has(intent)) {
      const facts = [`I sell: ${o.what}${o.city ? ` in ${o.city}` : ''}.`, o.priceText ? `My price: ${o.priceText}.` : 'No price given: if they ask, write [your price].', o.firstName ? `My name: ${o.firstName}.` : ''].filter(Boolean).join(' ');
      const r = await ai.aiText(ctx, {
        task: 'write',
        system: 'You help someone answer a text from a friend, family member or past customer. Answer what they said first, then one easy next step. Friendly, plain, 280 characters or fewer, straight apostrophes, no sign-off, no hype. Never invent a price, a time, a result or a fact. Never ask for a review.',
        prompt: `They wrote: "${text.clip(reply, 800)}"\nWhat it looks like: ${A.MEANS[intent]}\n${facts}\nWhat I know about them: ${person.note || 'nothing noted'}.\nStarting draft: ${fallback}\nWrite my text back.`,
        maxTokens: 300,
        fallback: () => fallback,
        accept: (t) => ai.cleanCopy(t) && t.length <= 320 && !/\breview/i.test(t) && (o.priceText || !/\$\s?\d/.test(t)),
      });
      answer = M.straight(r.text);
      usedAi = r.ai;
    }
    // The Pipeline: their reply and the answer; this pack's own leads move to replied (or lost).
    let pipeline = '';
    const stage = STAGE_FOR[intent] || 'replied';
    const can = ctx.leads && typeof ctx.leads.upsert === 'function';
    try {
      if (lead && P.isOwn(lead) && can) {
        await ctx.leads.upsert({ key: lead.key, reply, ...(answer ? { msg: { answer } } : {}), stage });
        pipeline = stage === 'lost' ? `Marked ${person.name} lost in your Pipeline.` : `${person.name} is at Replied in your Pipeline, with this answer ready in Do my day.`;
      } else if (lead && lead.id && ctx.leads && typeof ctx.leads.update === 'function') {
        await ctx.leads.update(lead.id, { reply, ...(answer ? { msg: { answer } } : {}) });
        pipeline = stage === 'lost' ? `Saved their reply. Open ${person.name} in your Pipeline and tap Lost.` : `Saved their reply and your answer. Open ${person.name} in your Pipeline and move them to Replied.`;
      } else if (can) {
        await ctx.leads.upsert({ key: P.personKey({ name }), name, warm: true, source: 'Answer a reply', stage, reply, ...(answer ? { msg: { answer } } : {}), data: { kind: 'reply' } });
        pipeline = stage === 'lost' ? `${name} wasn't in your Pipeline, so they're saved as lost to keep them off your lists.` : `${name} wasn't in your Pipeline, so they're added at Replied.`;
      }
    } catch {
      pipeline = 'Your Pipeline could not be updated right now. Mark it by hand.';
    }
    ctx.log(`${person.name}: ${A.MEANS[intent].toLowerCase()}`);
    return { name: person.name, intent, meaning: A.MEANS[intent], answer, next: A.NEXT[intent], stop: intent === 'stop', pipeline, found: !!lead, ai: usedAi, segments: answer ? M.segments(answer).segments : 0 };
  },
  view(out) {
    return views.blocks(
      views.metric('What they meant', out.meaning, out.ai ? 'Answer fitted by AI to what they said' : 'From the words they used'),
      out.stop ? views.text("Don't answer. They asked you to stop, so leave it there and never text them again.") : views.copy(`Your answer to ${out.name}`, out.answer),
      /\[[^\]]+\]/.test(out.answer || '') ? views.text('Fill in the part in brackets before you send.') : null,
      views.text(`Next: ${out.next}`),
      out.pipeline ? views.text(out.pipeline) : null
    );
  },
};
