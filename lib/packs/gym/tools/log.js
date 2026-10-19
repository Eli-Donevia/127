// gym.log: what happened with a gym (sent, replied, call booked, won, lost). One tap in HQ.
// Moves the gym through the member's Pipeline and keeps the follow-up drafts, so gym.today knows
// exactly what is due and what to say.

const P = require('../lib/pipeline');
const { atRung } = require('../lib/offer');
const { money } = require('../lib/util');

const LABEL = P.TOUCH_LABEL;
const WHAT = Object.keys(LABEL);

module.exports = {
  name: 'gym.log',
  title: 'Log what happened',
  description: 'Records a touch with one gym (sent, walked in, followed up, replied, call booked, won or lost) and moves it through your Pipeline.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    properties: {
      gym: { title: 'Gym', description: 'A ranked gym, a message pack from gym.write_outreach, or just its name' },
      what: { type: 'string', title: 'What happened', enum: [...WHAT, ...Object.values(LABEL)] },
      channel: { type: 'string', title: 'How', description: 'Instagram DM, Email, Phone, Walk-in' },
      day: { type: 'integer', title: 'Follow-up day', enum: [3, 7, 14] },
      callAt: { type: 'string', title: 'Call time', description: 'When the call is (for call_booked)' },
      note: { type: 'string', title: 'Note' },
      followUps: { type: 'array', title: 'Follow-up drafts', description: 'From gym.write_outreach, kept for later' },
      answered: { type: 'boolean', title: 'Already answered', description: 'For replied: you answered them, so check in later instead of answering first' },
      nextDays: { type: 'integer', title: 'Check in after (days)', minimum: 1, maximum: 60 },
      reply: { type: 'string', title: 'What they wrote back', description: 'For replied: kept with the gym so HQ can show it', maxLength: 6000 },
      answer: { type: 'string', title: 'Your answer', description: 'For replied: the answer drafted for them, handed out in Do my day', maxLength: 4000 },
    },
    required: ['gym', 'what'],
  },
  output: { type: 'object', properties: { lead: { type: 'object' } }, required: ['lead'] },

  async run(input, ctx) {
    const at = ctx.now ? ctx.now() : Date.now();
    const what = P.touchKind(input.what);
    const gym = typeof input.gym === 'string' ? { name: input.gym } : input.gym || {};
    const p = await P.load(ctx);
    // A name typed in HQ finds the gym already on the list, with everything the pack knows about it.
    const known = typeof input.gym === 'string' ? P.find(p, input.gym) : null;
    const saved = ctx.brain && ctx.brain.packs && ctx.brain.packs.gym && ctx.brain.packs.gym.offer;
    const wonCount = () => Object.values(p.leads).filter((l) => l.stage === 'won').length;
    // A win is on the ladder step of the wins before it: that's this gym's deal.
    let deal = null;
    if (what === 'won' && saved && saved.price) {
      const mine = atRung(saved, wonCount());
      deal = { step: mine.price.rung ? mine.price.rung.label : null, monthly: mine.price.current, firstMonthFree: !!mine.price.firstMonthFree, setup: mine.price.setup || 0 };
    }
    const lead = P.touch(p, known || gym, { what, channel: input.channel || (gym.dm ? 'Instagram DM' : null), note: input.note, at, day: input.day, callAt: input.callAt, followUps: input.followUps || gym.followUps || null, deal, answered: !!input.answered, nextDays: input.nextDays, reply: input.reply, answer: input.answer });
    await P.save(ctx, p);
    // A win moves the ladder: say what the next gym pays.
    let next = null;
    if (what === 'won' && saved && saved.price) {
      const o = atRung(saved, wonCount());
      next = { step: o.price.rung ? o.price.rung.label : null, label: o.price.label, monthly: o.price.current, firstMonthFree: !!o.price.firstMonthFree };
    }
    return { lead: { key: lead.key, name: lead.name, stage: lead.stage, touches: lead.touches.length, deal: lead.deal || null }, what, next };
  },

  view(out) {
    const blocks = [{ type: 'text', text: `${out.lead.name}: ${LABEL[out.what]}. Now "${out.lead.stage}" in your Pipeline.` }];
    if (out.next) blocks.push({ type: 'metric', label: `Your next gym (${String(out.next.step || '').toLowerCase()} step)`, value: out.next.firstMonthFree ? 'Free month' : `${money(out.next.monthly)}/mo`, note: out.next.label });
    return blocks;
  },
};
