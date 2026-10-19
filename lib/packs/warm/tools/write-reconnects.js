// Catch-up texts for people the member hasn't talked to in a while, from names they paste. The first
// text asks for nothing: it picks up the friendship from the member's own note. What to say when they
// write back (mention the new business once, lightly) and one nudge come with it. AI writes the top 5;
// templates write the rest. Drafts only: the member sends each one from their own phone.

const { text, ai, views } = require('../../_kit');
const { offerFacts } = require('../lib/facts');
const M = require('../lib/messages');
const A = require('../lib/asks');
const P = require('../lib/pipeline');

const PITCH = /\b(business|started|launch|customers?|clients?|price|\$\d|book|service|offer|discount|spot)\b/i;

module.exports = {
  name: 'warm.write_reconnects',
  title: 'Write catch-up texts',
  description: "Writes a catch-up text for each person you paste (no pitch, built from your note about them), what to say once they write back, and one friendly nudge. Uses only what you wrote about them.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 5,
  input: {
    type: 'object',
    properties: {
      people: { type: 'string', title: 'People to reconnect with', maxLength: 20000, description: 'One per line: name, phone or email, and a note ("Jess Park, 512 555 0101, college roommate, moved to Denver"). A contacts export works too.' },
      what: { type: 'string', title: 'What you do now (optional)', maxLength: 200 },
    },
    required: ['people'],
  },
  output: {
    type: 'object',
    properties: { items: { type: 'array' }, ai: { type: 'boolean' }, extra: { type: 'integer' }, businesses: { type: 'integer' }, unreachable: { type: 'integer' } },
    required: ['items'],
  },
  async run(input, ctx) {
    const o = offerFacts(ctx, input);
    const got = P.peopleFrom(input.people, 25);
    if (!got.people.length) throw new Error('No names found. Paste one person per line: name, phone or email, and a note about them.');
    const base = got.people.map((p, i) => {
      const seed = `${p.name}${i}`;
      return { p, seed, text: A.reconnectText(p, o, seed) };
    });
    // AI rewrites the top 5 openers from the member's notes; anything that sounds like a pitch or
    // breaks the copy rules goes back to the template.
    const top = base.slice(0, 5);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short catch-up texts a person sends to old friends, family and former coworkers they have not talked to in a while. The sender is reconnecting, not selling: never mention a business, a product, a price or an ask. Warm, specific to the note, 220 characters or fewer, straight apostrophes, one question at the end. Use only the facts in the note.',
      prompt: ['Write one text for each person. Start with "Hey" or "Hi" and their first name.', ...top.map(({ p }, i) => `${i + 1}. ${p.name}. My note: ${p.note || 'none'}`)].join('\n'),
      schema: { type: 'object', properties: { texts: { type: 'array', items: { type: 'string', maxLength: 260 } } }, required: ['texts'] },
      fallback: () => ({ texts: top.map((x) => x.text) }),
      accept: (d) => ai.cleanCopy(d) && Array.isArray(d.texts) && d.texts.length === top.length && d.texts.every((t) => !PITCH.test(t) && t.length <= 260),
    });
    const items = base.map(({ p, seed, text: t0 }, i) => {
      const t = i < 5 && data.texts && data.texts[i] ? M.straight(text.plain(data.texts[i])) : t0;
      return {
        id: `r${i + 1}`,
        name: p.name,
        label: p.note ? `${p.name}, ${text.clip(p.note, 40)}` : p.name,
        text: t,
        after: A.bringUp(p, o, seed),
        nudge: A.reconnectNudge(p, o, seed, 1),
        nudge2: A.reconnectNudge(p, o, seed, 2),
        phone: p.phone,
        email: p.email,
        note: p.note,
        group: 'reconnect',
        why: p.note ? `You wrote: ${text.clip(p.note, 80)}` : 'No note yet, so a simple hello.',
        segments: M.segments(t).segments,
      };
    });
    ctx.log(`Wrote ${items.length} catch-up texts${usedAi ? ' (AI for the top 5)' : ''}`);
    return { items, ai: usedAi, extra: got.extra, businesses: got.businesses, unreachable: items.filter((x) => !x.phone && !x.email).length };
  },
  view(out) {
    return views.blocks(
      views.metric('Catch-up texts', out.items.length, 'No pitch in the first text. Mention what you do once they write back.'),
      out.items.slice(0, 25).map((x) => views.copy(x.label, x.text)),
      out.items[0] ? views.copy(`When ${out.items[0].name.split(' ')[0]} writes back`, out.items[0].after) : null,
      out.extra ? views.text(`${out.extra} more names didn't fit. Run this again with the next 25.`) : null,
      out.businesses ? views.text(`${out.businesses} businesses set aside. This is for people you know.`) : null
    );
  },
};
