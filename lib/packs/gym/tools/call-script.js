// gym.call_script: the sales call for one gym, in six steps (why they're here, the problem in their
// words, what they've tried, life after, their concerns, after the yes), built on that gym's own gaps and the member's offer. What to check
// before the call, the price said once, answers to the usual objections, a close on a shoot date, and
// what to do after a yes, a "let me think" or a no. The member makes the call; nothing here is sent.

const { callScript } = require('../lib/close');
const { atRung } = require('../lib/offer');
const P = require('../lib/pipeline');
const { now, log } = require('../lib/util');

// Lines in brackets or parentheses are directions for the member, not words to say.
const bullet = (l) => `- ${l}`;

// The member's offer at today's ladder step (a logged win moves the next gym's price), read the same
// way the other gym tools read it. An offer with no ladder is used as written.
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

function stepText(s, i) {
  return [`${i + 1}. ${s.step}`, `Goal: ${s.goal}`, 'Say:', ...s.say.map(bullet), `Listen for: ${s.listenFor}`].join('\n');
}

module.exports = {
  name: 'gym.call_script',
  title: 'Your sales call script',
  description:
    "A sales call script for one gym in six steps: why they took the call, the problem in their own words, what they've tried, the outcome they want, their concerns, and the yes. Built on the gym's real gaps and your offer. Says the price once, answers 16 common gym-owner objections, closes on a shoot date, and drafts the confirmation to send after a yes. You make the call yourself.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One ranked gym from gym.find_gaps' },
      offer: { type: 'object', title: 'Your offer', description: 'From gym.offer. Leave it out to use the offer you saved.' },
      priced: { type: 'object', title: 'Its prices', description: 'Output of gym.price_offer for this gym (optional): adds what one member pays them.' },
    },
    required: ['gym'],
  },
  output: {
    type: 'object',
    properties: {
      gym: { type: 'string' },
      prep: { type: 'array' },
      script: { type: 'array' },
      price: { type: 'object' },
      objections: { type: 'array' },
      close: { type: 'array' },
      after: { type: 'object' },
      notes: { type: 'array' },
    },
    required: ['gym', 'prep', 'script', 'price', 'objections', 'close', 'after'],
  },

  async run(input, ctx) {
    const row = input.gym || {};
    if (!(row.gym && row.gym.name) && !row.name) throw new Error('Pick a gym first.');
    const brain = ctx.brain || {};
    const member = ctx.member || {};
    const out = callScript({
      row,
      offer: await offerNow(input, ctx),
      member,
      business: brain.business || {},
      priced: input.priced || null,
      now: now(ctx),
      tz: member.timezone || (brain.business && brain.business.timezone),
    });
    log(ctx, `Wrote the call script for ${out.gym}`);
    return {
      ...out,
      offerFrom: out.offerUsed ? (input.offer ? 'input' : 'saved') : null,
      sample: !!(ctx.sample || row.sample),
    };
  },

  view(out) {
    const blocks = [];
    if (out.math) blocks.push({ type: 'metric', label: 'What one new member pays them', value: out.math.value, note: out.math.note });
    blocks.push({ type: 'text', text: ['Before the call', ...out.prep.map(bullet)].join('\n') });
    out.script.forEach((s, i) => {
      blocks.push({ type: 'text', text: stepText(s, i) });
      if (s.id === 'vacation') blocks.push({ type: 'text', text: ['The price, said once', out.price.line, out.price.then].join('\n') });
      if (s.id === 'explain') {
        blocks.push({
          type: 'cards',
          items: out.objections.map((o) => ({ title: `"${o.theySay}"`, subtitle: o.rootLabel, body: `Ask first: ${o.ask}\nThen: ${o.say}` })),
        });
        blocks.push({ type: 'text', text: ['The close', ...out.close.map(bullet)].join('\n') });
      }
    });
    // After the call: the yes steps, the confirmation they start with, then the other two outcomes.
    const c = out.after.confirm;
    blocks.push({ type: 'text', text: ['If they say yes', ...out.after.yes.map(bullet)].join('\n') });
    blocks.push({ type: 'copy', label: 'After the yes: send this confirmation', text: c.text, email: c.to ? { to: c.to, subject: c.subject } : undefined });
    blocks.push({ type: 'text', text: ['If they want to think', ...out.after.think.map(bullet), '', "If it's a no", ...out.after.no.map(bullet)].join('\n') });
    if (out.notes.length) blocks.push({ type: 'text', text: out.notes.join('\n') });
    return blocks;
  },
};
