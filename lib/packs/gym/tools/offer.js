// gym.offer: builds the member's offer to gyms once (see lib/offer.js) and saves it, so every message,
// call script, proposal and report after it uses the same packages, promise and ladder price. Each
// time it's read again, the price moves to the member's current step on the ladder by itself.

const { buildOffer, atRung, forMemory, BONUSES, GUARANTEES } = require('../lib/offer');
const P = require('../lib/pipeline');
const { money } = require('../lib/util');

module.exports = {
  name: 'gym.offer',
  title: 'Build your offer',
  description:
    "Builds the offer you'll sell to gyms: three packages named by what they do for the gym, extras that answer their worries, your promise, and a first-clients ladder (a few free case studies, then a price that steps up as your business grows). Priced on what a new member is worth to a gym, never below your hourly floor.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      city: { type: 'string', title: 'Your city' },
      reels: { type: 'integer', title: 'Reels a month', minimum: 4, maximum: 30, default: 12 },
      shootMinutes: { type: 'integer', title: 'Minutes at the gym each month', minimum: 30, maximum: 180, default: 45 },
      hourlyRate: { type: 'number', title: 'The least you want per hour ($)', minimum: 10, maximum: 500 },
      guarantee: { type: 'string', title: 'Your promise to the gym', enum: Object.keys(GUARANTEES), default: 'love_it' },
      ladder: { type: 'string', title: 'How you start', description: 'case_study: your first gyms get a free month as case studies. founding: start at a lower founding price. none: full price from day one.', enum: ['case_study', 'founding', 'none'], default: 'case_study' },
      ladderSize: { type: 'integer', title: 'Gyms at each step', minimum: 1, maximum: 10, default: 3 },
      setupFee: { type: 'number', title: 'Setup fee for full-price clients ($)', description: 'Leave empty to work it out from your rate, 0 for none', minimum: 0, maximum: 5000 },
      foundingSlots: { type: 'integer', title: 'Founding price for your first (older setting)', minimum: 0, maximum: 10 },
      exclusivityMiles: { type: 'number', title: 'One gym of each kind within (miles)', description: '0 to skip. Only promise this if you will keep it: 127 will stop suggesting gyms it covers.', minimum: 0, maximum: 25, default: 3 },
      bonuses: { type: 'array', title: 'Extras', items: { type: 'string', enum: Object.keys(BONUSES) } },
      name: { type: 'string', title: 'Offer name (optional)' },
      gyms: { type: 'array', title: 'Ranked gyms', description: 'From gym.find_gaps, so the price math uses real gym prices' },
      keepExisting: { type: 'boolean', title: 'Keep my saved offer', description: 'Inside a workflow: use the saved offer if there is one', default: false },
    },
  },
  output: { type: 'object', properties: { offer: { type: 'object' } }, required: ['offer'] },

  async run(input, ctx) {
    const brain = ctx.brain || {};
    const saved = (brain.packs && brain.packs.gym) || {};
    const business = brain.business || {};
    const p = await P.load(ctx);
    const won = Object.values(p.leads).filter((l) => l.stage === 'won').length;
    if (input.keepExisting && saved.offer && saved.offer.name) {
      // Only the ladder step changes by itself: it follows the member's wins.
      const o = atRung(saved.offer, won);
      return { offer: o, kept: true, names: [o.name], math: null, why: [], pitch: null, page: null };
    }
    // The workflow's own ladder setting wins over the older foundingSlots one.
    const built = buildOffer({
      ...input,
      ladder: input.foundingSlots != null && input.ladder === 'case_study' && !(ctx.inputs && ctx.inputs.ladder) ? undefined : input.ladder,
      city: input.city || business.city || (ctx.inputs && ctx.inputs.city) || '',
      hourlyRate: input.hourlyRate || saved.hourly_rate || 35,
      firstName: ctx.member && ctx.member.firstName,
      business: business.name,
      rows: Array.isArray(input.gyms) ? input.gyms : [],
      won,
    });
    if (typeof ctx.remember === 'function') {
      await ctx.remember('offer', forMemory(built.offer));
      if (input.hourlyRate) await ctx.remember('hourly_rate', input.hourlyRate);
    }
    try {
      if (ctx.brain) {
        ctx.brain.packs = ctx.brain.packs || {};
        ctx.brain.packs.gym = { ...(ctx.brain.packs.gym || {}), offer: forMemory(built.offer) };
      }
    } catch {
      /* read-only brain: ctx.remember already saved it */
    }
    if (ctx.log) ctx.log(`Offer saved: ${built.offer.name}. Your next gym is on the ${built.offer.price.rung.label.toLowerCase()} step`);
    return built;
  },

  view(out) {
    const o = out.offer;
    const r = o.price.rung || { label: 'Full price' };
    if (out.kept) return [{ type: 'text', text: `Using your saved offer: ${o.name}. Your next gym: ${o.price.label}` }];
    const clips = out.moneyModel.packages.find((p) => p.id === 'clips');
    return [
      {
        type: 'metric',
        label: `Your next gym (${r.label.toLowerCase()} step)`,
        value: o.price.firstMonthFree ? 'Free month' : `${money(o.price.current)}/mo`,
        note: o.price.firstMonthFree ? `then ${money(o.price.current)} a month` : o.price.next ? `${money(o.price.next.monthly)} after ${r.left} more` : 'full price',
      },
      { type: 'text', text: o.oneLiner },
      {
        type: 'table',
        columns: [
          { key: 'name', label: 'Package (biggest first)' },
          { key: 'now', label: 'Now', format: 'money' },
          { key: 'full', label: 'Full price', format: 'money' },
          { key: 'hours', label: 'Your hours a month', format: 'number' },
        ],
        rows: out.moneyModel.packages.map((p) => ({ name: p.name, now: p.monthly, full: p.full, hours: p.hours })),
      },
      {
        type: 'table',
        columns: [
          { key: 'step', label: 'Your ladder' },
          { key: 'gyms', label: 'Gyms' },
          { key: 'price', label: `"${o.name}"` },
        ],
        rows: o.ladder.map((s) => ({
          step: `${s.label}${s.id === r.id ? ' (you are here)' : ''}`,
          gyms: s.slots == null ? 'every gym after' : String(s.slots),
          price: s.freeMonth ? `first month free, then ${money(s.prices.core)}` : `${money(s.prices.core)} a month`,
        })),
      },
      { type: 'cards', items: out.why.map((w) => ({ title: w.part, body: w.text })) },
      {
        type: 'table',
        columns: [
          { key: 'k', label: 'Your numbers' },
          { key: 'v', label: '' },
        ],
        rows: [
          { k: 'Your hours per gym a month', v: String(out.math.hours) },
          { k: 'Your floor at your hourly rate', v: money(out.math.floor) },
          { k: 'Per hour at the founding price', v: out.math.hourlyAtFounding ? money(out.math.hourlyAtFounding) : 'no founding price' },
          { k: 'Per hour at full price', v: money(out.math.hourlyAtStandard) },
          ...(out.math.caseStudyHours ? [{ k: 'Free work for your case studies', v: `about ${out.math.caseStudyHours} hours in all, the price of your first proof` }] : []),
          { k: 'Setup fee (full-price clients)', v: out.moneyModel.setup.price ? money(out.moneyModel.setup.price) : 'none' },
          { k: 'One new member is worth to a gym', v: `about ${money(out.math.memberValue)} (from ${out.math.priceSource})` },
        ],
      },
      {
        type: 'text',
        text: [
          `Your promise: ${o.guarantee.text || 'none'}`,
          out.promiseNote,
          '',
          'Add-ons when a gym wants more:',
          ...out.moneyModel.upsells.map((u) => `- ${u.name}: ${money(u.price)}. ${u.what}.`),
          '',
          clips ? `Before a gym says no, offer the smaller plan: "${clips.name}" at ${money(clips.monthly)} a month.` : '',
        ].join('\n'),
      },
      ...(o.caseStudy ? [{ type: 'copy', label: 'Say this to your first gyms', text: o.caseStudy.script }] : []),
      { type: 'copy', label: 'Your offer, ready to paste', text: out.page },
      { type: 'copy', label: 'Say it in one breath', text: out.pitch.elevator },
      { type: 'text', text: `Other names you could use: ${out.names.filter((n) => n !== o.name).join(', ')}.` },
    ];
  },
};
