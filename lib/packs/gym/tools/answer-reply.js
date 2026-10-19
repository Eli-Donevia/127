// gym.answer_reply: reads what a gym wrote back, says what they meant, and drafts a short answer with
// one clear next step, plus when to follow up and where the gym goes in the Pipeline.
// Keyword rules first. When ctx.ai is there, one cheap classify call confirms or corrects the label;
// it is never required, and any AI error falls back to the rules. The answer itself is always the
// built-in draft, so it only says what the inputs say. Drafts only: the member sends it.

const { classifyReply, answerReply, mergeAi, classifyPrompt, CLASSIFY_SCHEMA, CLASSIFY_SYSTEM, KINDS } = require('../lib/close');
const { atRung } = require('../lib/offer');
const P = require('../lib/pipeline');
const { now, log } = require('../lib/util');

// The member's offer at today's ladder step, read the same way the other gym tools read it.
async function offerNow(input, ctx) {
  const brain = ctx.brain || {};
  let o = input.offer || (brain.packs && brain.packs.gym && brain.packs.gym.offer) || null;
  if (o && !o.price && o.offer && typeof o.offer === 'object') o = o.offer;
  if (!o || !o.price || !Array.isArray(o.ladder) || !o.ladder.length) return o;
  try {
    const p = await P.load(ctx);
    return atRung(o, Object.values(p.leads).filter((l) => l.stage === 'won').length);
  } catch {
    return o;
  }
}

const STAGE_NOTE = { contacted: 'Pipeline: leave them at contacted.', replied: 'Pipeline: move them to replied.', call: 'Pipeline: move them to call.', lost: 'Pipeline: mark them lost.' };

// The router returns { data } for a schema call; a plain { text } with JSON in it works too.
function aiData(res) {
  if (!res) return null;
  if (res.data && typeof res.data === 'object') return res.data;
  if (typeof res.text === 'string') {
    try {
      const m = res.text.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = {
  name: 'gym.answer_reply',
  title: 'Answer their reply',
  description:
    "Paste what a gym wrote back. Says what they meant (interested, wants the price, wants info, has someone already, not now, no, a question, out of office, or not the right person), drafts a short answer with one clear next step, and says when to follow up and where they go in your Pipeline. A draft: you send it yourself.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  credits: 3,
  tasks: ['classify'],
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One ranked gym from gym.find_gaps (or give just its name)' },
      name: { type: 'string', title: 'Gym name', description: 'If you have no ranked gym' },
      reply: { type: 'string', title: 'What they wrote back', maxLength: 6000 },
      offer: { type: 'object', title: 'Your offer', description: 'From gym.offer. Leave it out to use the offer you saved.' },
    },
    required: ['reply'],
  },
  output: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: KINDS },
      confidence: { type: 'number' },
      reply: { type: 'string' },
      nextStage: { type: 'string', enum: ['contacted', 'replied', 'call', 'lost'] },
      note: { type: 'string' },
    },
    required: ['kind', 'confidence', 'reply', 'nextStage', 'note'],
  },

  async run(input, ctx) {
    const text = typeof input.reply === 'string' ? input.reply.trim() : '';
    if (!text) throw new Error('Paste what they wrote back first.');
    const brain = ctx.brain || {};
    const member = ctx.member || {};
    const row = input.gym && typeof input.gym === 'object' ? input.gym : typeof input.name === 'string' && input.name.trim() ? { name: input.name.trim() } : null;

    let classified = classifyReply(text);
    // A request to stop can't be overridden, so it isn't sent to the AI at all.
    if (typeof ctx.ai === 'function' && !ctx.sample && !classified.hard) {
      try {
        const res = await ctx.ai({ task: 'classify', system: CLASSIFY_SYSTEM, prompt: classifyPrompt(text), schema: CLASSIFY_SCHEMA, maxTokens: 200 });
        classified = mergeAi(classified, aiData(res), text);
      } catch {
        log(ctx, 'AI was busy, so this uses the built-in rules.');
      }
    }

    const out = answerReply({
      reply: text,
      row,
      offer: await offerNow(input, ctx),
      member,
      business: brain.business || {},
      now: now(ctx),
      tz: member.timezone || (brain.business && brain.business.timezone),
      classified,
    });
    log(ctx, `${out.gym || 'Their reply'}: ${out.label.toLowerCase()}`);
    // What to log in the Pipeline: they replied (a call is logged once it's booked), or they said no.
    const logAs = { replied: 'replied', call: 'replied', lost: 'lost' }[out.nextStage] || null;
    return { ...out, logAs, sample: !!(ctx.sample || (row && row.sample)) };
  },

  view(out) {
    return [
      { type: 'metric', label: 'What they meant', value: out.label, note: `${Math.round(out.confidence * 100)}% sure${out.ai ? ', checked by AI' : ''}` },
      { type: 'copy', label: out.kind === 'out_of_office' ? `Send this on ${out.followUpOn}` : `Your answer${out.gym ? ` to ${out.gym}` : ''}`, text: out.reply },
      { type: 'text', text: `${out.note}\n${STAGE_NOTE[out.nextStage]}` },
    ];
  },
};
