// Referral asks for happy customers and friends, from names the member pastes: one short text each,
// a note they can forward to a friend (so an intro takes 10 seconds), and the thank-you to send when
// someone books. A referral thank-you is for an intro, never for a review (D24: nothing is ever given
// for a review). AI writes the top 5; templates write the rest. Drafts only: the member sends them.

const { text, ai, views } = require('../../_kit');
const { offerFacts } = require('../lib/facts');
const M = require('../lib/messages');
const A = require('../lib/asks');
const P = require('../lib/pipeline');

// A thank-you tied to a review breaks Google's rules and the FTC's (16 CFR 465): refuse it.
const REVIEWISH = /\b(reviews?|ratings?|stars?|testimonials?|yelp)\b/i;

module.exports = {
  name: 'warm.write_referrals',
  title: 'Write referral asks',
  description: 'Writes a referral ask for each happy customer or friend you paste, a note they can forward to a friend, and the thank-you for when someone books. The thank-you is for an intro, never for a review.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 5,
  input: {
    type: 'object',
    properties: {
      people: { type: 'string', title: 'Happy customers and friends', maxLength: 20000, description: 'One per line: name, phone or email, and a note ("Ana Ruiz, 512 555 0144, customer, loved the deep clean in May").' },
      what: { type: 'string', title: 'What you sell (optional)', maxLength: 200 },
      thanks: { type: 'string', title: 'Your thank-you for an intro that books (optional)', maxLength: 80, description: 'Like "$20 off your next clean" or "a free add-on". Never tied to a review.' },
      who: { type: 'string', title: 'Who you want to meet (optional)', maxLength: 80, description: 'Like "neighbors with dogs" or "anyone who just moved"' },
      phone: { type: 'string', title: 'Your number for the forward note (optional)', maxLength: 30 },
    },
    required: ['people'],
  },
  output: {
    type: 'object',
    properties: { items: { type: 'array' }, forward: { type: 'string' }, thankYou: { type: 'string' }, thanks: { type: 'string' }, ai: { type: 'boolean' }, extra: { type: 'integer' }, businesses: { type: 'integer' }, notes: { type: 'array' } },
    required: ['items', 'forward', 'thankYou'],
  },
  async run(input, ctx) {
    const notes = [];
    let thanks = text.clip(text.oneLine(input.thanks || ''), 80).replace(/[.!]+$/, '');
    if (thanks && REVIEWISH.test(thanks)) {
      notes.push('Your thank-you mentioned a review, so it was left out. A thank-you can only be for an intro: Google and the FTC ban anything given for a review.');
      thanks = '';
    }
    const o = { ...offerFacts(ctx, input), thanks, who: text.clip(text.oneLine(input.who || ''), 80), phone: text.clip(text.oneLine(input.phone || ''), 30) };
    const got = P.peopleFrom(input.people, 25);
    if (!got.people.length) throw new Error('No names found. Paste one person per line: name, phone or email, and a note about them.');
    const base = got.people.map((p, i) => ({ p, seed: `${p.name}${i}`, customer: A.isCustomer(p), text: A.referralText(p, o, `${p.name}${i}`) }));
    const top = base.slice(0, 5);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: `You write short texts a small business owner sends to happy customers and friends, asking for one referral. The owner is the sender. Thank them first when they were a customer. One clear ask, no pressure, 300 characters or fewer, straight apostrophes. ${thanks ? `Mention the thank-you exactly as given ("${thanks}") as being for an intro that books.` : 'Do not offer any reward.'} Never mention reviews, ratings or stars. Use only the facts given.`,
      prompt: [`I sell: ${o.what}${o.city ? ` in ${o.city}` : ''}.${o.who ? ` I want to meet: ${o.who}.` : ''}`, ...top.map(({ p, customer }, i) => `${i + 1}. ${p.name} (${customer ? 'customer' : 'friend'}). My note: ${p.note || 'none'}`)].join('\n'),
      schema: { type: 'object', properties: { texts: { type: 'array', items: { type: 'string', maxLength: 320 } } }, required: ['texts'] },
      fallback: () => ({ texts: top.map((x) => x.text) }),
      accept: (d) => ai.cleanCopy(d) && Array.isArray(d.texts) && d.texts.length === top.length && d.texts.every((t) => !REVIEWISH.test(t) && (!thanks || !/\$\d/.test(t) || t.includes(thanks))),
    });
    const forward = A.forwardText(o);
    const thankYou = A.thankYouText(o);
    const items = base.map(({ p, seed, customer, text: t0 }, i) => {
      const t = i < 5 && data.texts && data.texts[i] ? M.straight(text.plain(data.texts[i])) : t0;
      return {
        id: `f${i + 1}`,
        name: p.name,
        label: `${p.name}, ${customer ? 'customer' : 'friend'}`,
        text: t,
        after: forward,
        nudge: A.referralNudge(p, o, seed, 1),
        nudge2: A.referralNudge(p, o, seed, 2),
        phone: p.phone,
        email: p.email,
        note: p.note,
        group: customer ? 'customer' : 'friend',
        why: p.note ? `You wrote: ${text.clip(p.note, 80)}` : customer ? 'A customer.' : 'Everyone knows someone.',
        segments: M.segments(t).segments,
      };
    });
    if (!thanks) notes.push('No thank-you set. A small one for an intro that books (like money off their next visit) is fine; never one for a review.');
    if (!o.phone && /\[your number\]/.test(forward)) notes.push('Add your number to the forward note before you send it.');
    ctx.log(`Wrote ${items.length} referral asks${usedAi ? ' (AI for the top 5)' : ''}`);
    return { items, forward, thankYou, thanks, ai: usedAi, extra: got.extra, businesses: got.businesses, notes };
  },
  view(out) {
    return views.blocks(
      views.metric('Referral asks', out.items.length, `${out.items.filter((x) => x.group === 'customer').length} customers, ${out.items.filter((x) => x.group === 'friend').length} friends`),
      out.items.slice(0, 25).map((x) => views.copy(x.label, x.text)),
      views.copy('When they say yes: the note they forward', out.forward),
      views.copy('When someone books: your thank-you', out.thankYou),
      (out.notes || []).map((n) => views.text(n)),
      out.extra ? views.text(`${out.extra} more names didn't fit. Run this again with the next 25.`) : null
    );
  },
};
