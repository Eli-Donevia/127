// gym.write_outreach: the DM, the email, what to say at the front desk, a voicemail, three
// follow-ups and answers to the usual replies, for one gym. Drafts the member sends themselves.

const { drafts, outreachPrompt, mergeAi } = require('../lib/outreach');
const { atRung } = require('../lib/offer');
const P = require('../lib/pipeline');

module.exports = {
  name: 'gym.write_outreach',
  title: 'Write the messages',
  description:
    "Writes the first Instagram DM, an email, a walk-in script, a voicemail, three follow-ups and replies to common answers for one gym, built on that gym's own gaps and your sample Reel. Drafts only: you send them yourself.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  credits: 4,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One ranked gym from gym.find_gaps' },
      video: { type: 'object', title: 'Its sample Reel', description: 'Output of gym.spec_video (optional)' },
    },
    required: ['gym'],
  },
  output: { type: 'object', properties: { dm: { type: 'string' }, email: { type: 'object' }, walkIn: { type: 'string' }, followUps: { type: 'array' } }, required: ['dm', 'email'] },

  async run(input, ctx) {
    const row = input.gym || {};
    if (!row.gym || !row.gym.name) throw new Error('Pick a gym first.');
    const brain = ctx.brain || {};
    const saved = brain.packs && brain.packs.gym && brain.packs.gym.offer;
    let memberOffer = null;
    if (saved && saved.price) {
      const p = await P.load(ctx);
      memberOffer = atRung(saved, Object.values(p.leads).filter((l) => l.stage === 'won').length);
    }
    const v = input.video && !input.video.error ? input.video : null;
    const facts = {
      gym: row.gym,
      score: { contact: row.contact || {} },
      report: { gaps: row.gaps || [], ideas: row.ideas || [], opener: row.opener },
      member: ctx.member || {},
      business: brain.business || {},
      city: (brain.business && brain.business.city) || (ctx.inputs && ctx.inputs.city && !/^\s*\d/.test(ctx.inputs.city) ? String(ctx.inputs.city).split(',')[0].trim() : ''),
      offer: row.site && row.site.offer,
      memberOffer,
      video: v ? { template: v.template, used: v.used, realOffer: v.realOffer } : null,
      videoTitle: v && v.script ? `${v.template === 'offer' ? 'an ad for their intro offer: ' : ''}"${v.script.hook}", ending on "${v.script.offer}"` : null,
    };
    let out = drafts(facts);
    // The AI rewrite is written around a sample that's attached, so it only runs when there is one.
    if (typeof ctx.ai === 'function' && !ctx.sample && v) {
      try {
        const p = outreachPrompt(facts);
        const { data } = await ctx.ai({ task: 'write', system: p.system, prompt: p.prompt, schema: p.schema, maxTokens: 1400 });
        out = mergeAi(out, data);
      } catch {
        if (ctx.log) ctx.log('AI was busy, so these are the built-in drafts.');
      }
    }
    return { gym: row.gym.name, key: row.key || row.gym.key, ...out, ai: !!out.ai, attach: v && v.video ? v.video : null, sample: !!(ctx.sample || row.sample) };
  },

  view(out) {
    return [
      { type: 'copy', label: `Instagram DM to ${out.gym} (attach the sample)`, text: out.dm },
      { type: 'copy', label: 'Email', text: `Subject: ${out.email.subject}\n\n${out.email.body}`, email: out.email.to ? { to: out.email.to, subject: out.email.subject } : undefined },
      { type: 'text', text: `At the front desk:\n${out.walkIn}` },
      { type: 'text', text: out.followUps.map((f) => `Day ${f.day} (${f.channel}): ${f.text}`).join('\n\n') },
      { type: 'text', text: out.rules.join('\n') },
    ];
  },
};
