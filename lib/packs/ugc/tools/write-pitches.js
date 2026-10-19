// Pitches for the top brands (5 at most): a DM, an email and two follow-ups each, opening on a fact
// read from the brand's own store. Only the brand the concept preview was made for is told about it;
// the others are offered one. Drafts only: the member reads, edits and sends from their own accounts.

const { views, save, ai, text, brain } = require('../../_kit');
const U = require('../lib/ugc');
const { breaksRules } = require('../lib/close');

module.exports = {
  name: 'ugc.write_pitches',
  title: 'Write the pitches',
  description: 'Writes a DM, an email and two follow-ups for each of the top 5 brands. Each opens on a fact from their own store; the brand you made a concept for gets it, the rest are offered one. No prices, no promises about views or sales.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      brands: { type: 'array', title: 'Brands', items: { type: 'object' } },
      name: { type: 'string', title: 'Your name' },
      site: { type: 'string', title: 'Portfolio link (optional)' },
      business: { type: 'string', title: 'Your creator or business name (optional)', maxLength: 80 },
      myAddress: { type: 'string', title: 'Your mailing address (for emails)', maxLength: 160 },
      concept: { type: ['object', 'boolean'], title: 'The concept preview for brand #1 (from the render step)' },
    },
    required: ['brands'],
  },
  output: { type: 'object', properties: { pitches: { type: 'array' }, items: { type: 'array' }, file: { type: 'object' }, ai: { type: 'boolean' } }, required: ['items'] },
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const sender = { name: text.plain(input.name || br.firstName || (ctx.member && ctx.member.firstName) || ''), site: text.plain(input.site || br.website || ''), business: text.plain(input.business || br.name || ''), address: text.plain(input.myAddress || br.address || '') };
    const top = (input.brands || []).filter((b) => b && b.name).slice(0, 5);
    if (!top.length) throw new Error('Find brands first.');
    const c = input.concept;
    const hasConcept = c === true || !!(c && typeof c === 'object' && c.video);
    const facts = top.map((b, i) => `${i + 1}. ${b.name} (${b.domain}): product "${b.product ? b.product.title : ''}"; facts: ${(b.gaps || []).map((g) => g.text).join('; ')}`).join('\n');
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write the first sentence of a short pitch from a new UGC creator to a small brand. Use only the facts given, in plain friendly words, under 30 words. The creator has not used the product: never say they love, use or tried it. No prices, no claims about views, sales or results, no flattery words like amazing.',
      prompt: `For each brand, one opening sentence that mentions its product by its exact name and one fact from the list.\n${facts}`,
      schema: { type: 'object', properties: { openers: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, line: { type: 'string', maxLength: 220 } }, required: ['n', 'line'] } } }, required: ['openers'] },
      maxTokens: 700,
      accept: (d) => ai.cleanCopy(d) && d.openers.length === top.length && d.openers.every((o) => top[o.n - 1] && top[o.n - 1].product && o.line.includes(top[o.n - 1].product.title) && !/\$|\bviews?\b|\bsales\b|\bguarantee/i.test(o.line) && !breaksRules(o.line)),
      fallback: () => ({ openers: [] }),
    });
    const pitches = top.map((b, i) => {
      const o = usedAi ? (data.openers || []).find((x) => x.n === i + 1) : null;
      return { ...U.pitchFor(b, sender, { concept: i === 0 && hasConcept, opener: o ? text.oneLine(o.line) : '' }), channel: b.channel || '', to: (b.contact && b.contact.email) || '', instagram: (b.contact && b.contact.instagram) || '' };
    });
    const items = [];
    for (const p of pitches) {
      const byEmail = p.channel !== 'ig';
      items.push({ label: `${p.brand}: DM`, text: p.dm });
      items.push({ label: `${p.brand}: email`, text: `Subject: ${p.subject}\n\n${p.email}` });
      items.push({ label: `${p.brand}: follow-up day 4`, text: byEmail ? p.follow1Email : p.follow1 });
      items.push({ label: `${p.brand}: follow-up day 10`, text: byEmail ? p.follow2Email : p.follow2 });
    }
    const where = (p) => (p.channel === 'email' && p.to ? `Send to ${p.to}` : p.channel === 'ig' && p.instagram ? `Send as a DM to @${p.instagram}` : 'Send through the contact page on their store, or a DM');
    const body = [
      `Pitches for your top ${pitches.length} brand${pitches.length === 1 ? '' : 's'}. Send from your own accounts, 5 a day at most. Stop at no.`,
      hasConcept ? `Attach the concept preview only to ${pitches[0].brand}: it was made for them.` : 'No concept is attached to these yet: each one offers to make it.',
      '',
      ...pitches.flatMap((p, i) => [`${p.brand} (${where(p)})`, ...items.slice(i * 4, i * 4 + 4).map((x) => `${x.label}\n${x.text}\n`)]),
      U.RULES.pitch_rules.map((r) => `Rule: ${r}`).join('\n'),
    ].join('\n');
    const file = await save.saveFile(ctx, save.fileName('ugc-pitches', `top-${pitches.length}`, '.txt'), body);
    ctx.log(`Wrote ${pitches.length} pitches with follow-ups${hasConcept ? `, the concept for ${pitches[0].brand}` : ''}`);
    return { pitches, items, file, ai: usedAi, concept: hasConcept };
  },
  view(out) {
    const blocks = [];
    for (const p of out.pitches || []) {
      if (p.channel === 'ig') blocks.push(views.copy(`${p.brand}: Instagram DM${p.instagram ? ` to @${p.instagram}` : ''}`, p.dm));
      else blocks.push(views.copy(`${p.brand}: email${p.to ? ` to ${p.to}` : ''}`, p.email, p.to ? { to: p.to, subject: p.subject } : undefined));
    }
    return views.blocks(
      out.concept && out.pitches && out.pitches[0] ? views.text(`The concept preview goes with ${out.pitches[0].brand} only. The others are offered one.`) : null,
      ...blocks,
      views.file(out.file, 'All pitches, DMs and follow-ups (.txt)'),
    );
  },
};
