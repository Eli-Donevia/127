// gym.price_offer: the proposal for one gym after a good call. Three packages, biggest first, at the
// member's current step on the first-clients ladder (it reads the wins in the Pipeline every time, so a
// logged win moves the price by itself), framed by what one new member is worth to this gym.

const { price } = require('../lib/pricing');
const { buildOffer, atRung, packagesAt, proposalFromOffer } = require('../lib/offer');
const P = require('../lib/pipeline');
const { proofFor } = require('../lib/proof');
const { money } = require('../lib/util');

module.exports = {
  name: 'gym.price_offer',
  title: 'Price it and write the proposal',
  description:
    "Writes a one-page proposal for one gym: what you noticed, what you'd make first, and three packages with the biggest first, at your current step on the ladder. Shows what one new member is worth to that gym, from its own prices.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One ranked gym from gym.find_gaps' },
      hourlyRate: { type: 'number', title: 'The least you want per hour ($)', minimum: 10, maximum: 500 },
      stayMonths: { type: 'number', title: 'How long a member usually stays (months)', minimum: 1, maximum: 60, default: 8 },
      offer: { type: 'object', title: 'Your offer', description: 'From gym.offer (else your saved offer)' },
    },
    required: ['gym'],
  },
  output: { type: 'object', properties: { packages: { type: 'array' }, proposal: { type: 'string' } }, required: ['packages', 'proposal'] },

  async run(input, ctx) {
    const row = input.gym || {};
    if (!row.gym || !row.gym.name) throw new Error('Pick a gym first.');
    const brain = ctx.brain || {};
    const saved = (brain.packs && brain.packs.gym) || {};
    const hourlyRate = input.hourlyRate || saved.hourly_rate || 35;
    const priced = price({ gym: row.gym, monthlyPrice: row.site && row.site.monthlyPrice, hourlyRate, stayMonths: input.stayMonths || 8 });
    if (input.hourlyRate && typeof ctx.remember === 'function') await ctx.remember('hourly_rate', input.hourlyRate);
    const p = await P.load(ctx);
    const won = Object.values(p.leads).filter((l) => l.stage === 'won').length;
    // The saved offer at today's ladder step; with none saved yet, the default offer for this gym.
    const base = input.offer || saved.offer || null;
    const offer = base && base.price ? atRung(base, won) : buildOffer({ rows: [row], hourlyRate, won, city: (brain.business && brain.business.city) || row.gym.city }).offer;
    const pk = packagesAt(offer);
    // Suggest the biggest package to gyms that already sell an intro offer and charge enough to fund ads.
    const hasOffer = !!(row.site && row.site.offer && row.site.offer.kind && row.site.offer.kind !== 'none');
    const suggest = hasOffer && priced.memberPrice >= 120 ? 'premium' : 'core';
    const args = { gym: { ...row.gym, name: row.gym.name }, member: ctx.member || {}, business: brain.business || {}, priced, report: { gaps: row.gaps, ideas: row.ideas }, offer, suggest, proof: proofFor(saved.proof_bank) };
    const packages = pk.map((x) => {
      const perMember = priced.memberValue > 0 ? x.monthly / priced.memberValue : null;
      return {
        id: x.id,
        name: x.name,
        monthly: x.monthly,
        full: x.full,
        hours: x.hours,
        firstMonthFree: !!(offer.price.firstMonthFree && x.id === 'core'),
        includes: x.includes,
        payback: perMember == null ? null : perMember <= 1 ? `covered by 1 new member ${Math.floor(1 / perMember) > 1 ? `every ${Math.floor(1 / perMember)} months` : 'a month'}` : `covered by ${Math.ceil(perMember)} new members a month`,
      };
    });
    return {
      gym: row.gym.name,
      memberPrice: priced.memberPrice,
      memberPriceSource: priced.memberPriceSource,
      stayMonths: priced.stayMonths,
      memberValue: priced.memberValue,
      hourlyRate,
      assumptions: priced.assumptions,
      packages,
      suggest,
      step: offer.price.rung || null,
      offer: { name: offer.name, price: { current: offer.price.current, monthly: offer.price.monthly, label: offer.price.label, firstMonthFree: !!offer.price.firstMonthFree } },
      proposal: proposalFromOffer(args),
    };
  },

  view(out) {
    const step = out.step ? ` (${out.step.label.toLowerCase()} step)` : '';
    return [
      {
        type: 'metric',
        label: `${out.offer.name}${step}`,
        value: out.offer.price.firstMonthFree ? 'Free month' : `${money(out.offer.price.current)}/mo`,
        note: `one new member is worth about ${money(out.memberValue)} to ${out.gym}`,
      },
      {
        type: 'table',
        columns: [
          { key: 'name', label: 'Package' },
          { key: 'price', label: 'Per month' },
          { key: 'hours', label: 'Your hours', format: 'number' },
          { key: 'payback', label: 'For the gym' },
        ],
        rows: out.packages.map((p) => ({ ...p, price: p.firstMonthFree ? `free, then ${money(p.monthly)}` : money(p.monthly), name: `${p.name}${p.id === out.suggest ? ' (suggest)' : ''}` })),
      },
      { type: 'text', text: out.assumptions.join('\n') },
      { type: 'copy', label: `Proposal for ${out.gym}`, text: out.proposal },
    ];
  },
};
