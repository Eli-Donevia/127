// gym.content_day: the delivery kit for after a gym says yes. One content day a month around a class
// (the gym gives about 45 minutes, the editor does the rest), a shot list where every shot feeds a
// named Reel, a 3-a-week posting calendar with captions, consent and a release form, a tracked link
// set up before the first post, and the hand-off steps. Plans and drafts only: nothing is posted.

const { contentDay, releaseForm, FORM_NAME } = require('../lib/delivery');
const { atRung } = require('../lib/offer');
const P = require('../lib/pipeline');
const { now, log } = require('../lib/util');

const listText = (title, lines) => `${title}\n${lines.map((l) => `- ${l}`).join('\n')}`;

module.exports = {
  name: 'gym.content_day',
  title: 'Plan the content day',
  description:
    "Plans a gym's first month after it says yes: a 45-minute content day around one of its classes, a shot list where every shot feeds a named Reel, a posting calendar (3 a week) with captions that use the gym's real offer, consent steps and a release form, a tracked link and QR code for counting trial sign-ups, and the delivery steps. Plans and drafts only: nothing is posted.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 3,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One ranked gym from gym.find_gaps: the one that said yes' },
      offer: { type: 'object', title: 'Your offer', description: 'From gym.offer. Leave it out to use the offer you saved.' },
      reels: { type: 'integer', title: 'Reels this month', minimum: 1, maximum: 30, description: "Leave blank to use your offer's number (12 if it doesn't say)." },
      shootMinutes: { type: 'integer', title: 'Minutes of filming', minimum: 20, maximum: 180, description: "Leave blank to use your offer's number (45 if it doesn't say)." },
      startDate: { type: 'string', title: 'First post (YYYY-MM-DD)', description: 'Leave blank for next Monday.' },
    },
    required: ['gym'],
  },
  output: {
    type: 'object',
    properties: {
      gym: { type: 'string' },
      shoot: { type: 'object' },
      shotList: { type: 'array' },
      gear: { type: 'array' },
      consent: { type: 'array' },
      calendar: { type: 'array' },
      tracking: { type: 'object' },
      handoff: { type: 'array' },
      asset: { type: 'object' },
    },
    required: ['gym', 'shoot', 'shotList', 'calendar', 'tracking', 'handoff'],
  },

  async run(input, ctx) {
    const row = input.gym || {};
    if (!row.gym || !row.gym.name) throw new Error('Pick a gym first.');
    const brain = (ctx && ctx.brain) || {};
    let offer = input.offer || (brain.packs && brain.packs.gym && brain.packs.gym.offer) || null;
    // This gym's own terms: the ladder step it was won on (saved when the win was logged), else the
    // step the next win lands on. A free case-study month changes the promise and the month-end ask.
    if (!input.offer && offer && offer.price) {
      const p = await P.load(ctx);
      const lead = P.find(p, row.key) || P.find(p, row.gym.name);
      if (lead && lead.deal) offer = { ...offer, price: { ...offer.price, current: lead.deal.monthly, firstMonthFree: !!lead.deal.firstMonthFree } };
      else offer = atRung(offer, Object.values(p.leads).filter((l) => l.stage === 'won').length);
    }
    const member = (ctx && ctx.member) || {};
    const business = (brain.business && brain.business.name) || (offer && offer.member && offer.member.business) || null;
    const plan = contentDay({
      row,
      offer,
      reels: input.reels,
      shootMinutes: input.shootMinutes,
      startDate: input.startDate,
      member: { firstName: member.firstName },
      business,
      now: now(ctx),
      timezone: member.timezone || (brain.business && brain.business.timezone),
    });
    // The release form goes to the member's Library, filled in with the gym's name, ready to print.
    let asset = null;
    const form = releaseForm({ row, business });
    if (form && ctx && typeof ctx.save === 'function') asset = await ctx.save(FORM_NAME, form, { type: 'text/markdown' });
    else log(ctx, "Couldn't find the release form template, so the plan comes without it.");
    log(ctx, `Planned ${plan.reels} Reels for ${plan.gym}: content day ${plan.dates.shoot}, first post ${plan.dates.firstPost}`);
    return { ...plan, asset, sample: !!((ctx && ctx.sample) || row.sample) };
  },

  view(out) {
    const blocks = [
      { type: 'text', text: out.summary },
      { type: 'copy', label: `Kickoff message to ${out.owner || out.gym}`, text: out.kickoff },
    ];
    if (out.fixes && out.fixes.length) blocks.push({ type: 'text', text: listText('How this month answers what you pitched:', out.fixes.map((f) => `${f.gap}: ${f.plan}`)) });
    blocks.push({
      type: 'text',
      text: [`Content day: ${out.shoot.book}`, ...out.shoot.plan.map((b) => [`${b.at}: ${b.what}`, ...b.shots.map((s) => `- ${s}`)].join('\n'))].join('\n\n'),
    });
    blocks.push({
      type: 'cards',
      items: out.shotList.map((s) => ({
        title: `Reel ${s.reel}: ${s.title}`,
        subtitle: s.hook,
        body: [...s.shots, `On screen: ${s.onScreenText.join(' / ')}`, s.notes].filter(Boolean).join('\n'),
        badge: s.reel <= 3 ? 'First 3' : undefined,
      })),
    });
    blocks.push({
      type: 'table',
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'weekday', label: 'Day' },
        { key: 'reel', label: 'Reel', format: 'number' },
        { key: 'title', label: 'What' },
        { key: 'where', label: 'Where' },
      ],
      rows: out.calendar,
      limit: out.calendar.length,
    });
    for (const c of out.calendar) blocks.push({ type: 'copy', label: `Reel ${c.reel} caption, ${c.weekday} ${c.date}`, text: c.caption });
    blocks.push({ type: 'text', text: listText('Bring:', out.gear) });
    blocks.push({ type: 'text', text: listText('Consent:', out.consent) });
    blocks.push({ type: 'text', text: [`Tracking: ${out.tracking.why}`, ...out.tracking.steps.map((s, i) => `${i + 1}. ${s}`)].join('\n') });
    if (out.tracking.link && /^https:\/\//.test(out.tracking.link)) blocks.push({ type: 'link', label: 'Open the tracked link', href: out.tracking.link });
    blocks.push({ type: 'copy', label: 'Month-end numbers to count', text: out.tracking.monthEnd });
    blocks.push({ type: 'text', text: listText('Delivery:', out.handoff) });
    if (out.extras && out.extras.length) blocks.push({ type: 'text', text: listText('Extra shoots to offer later:', out.extras.map((e) => `${e.title}. ${e.note}`)) });
    if (out.asset) blocks.push({ type: 'file', asset: out.asset, label: 'Video release form (print ten)' });
    return blocks;
  },
};
