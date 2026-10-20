// Niche and content pillars: one plain sentence on who the member posts for and what about, five
// pillars (kinds of post) with four post ideas each, and an Instagram bio (150) and TikTok bio (80)
// counted in code. Remembers the niche, audience and pillars so the 30-day plan and hooks use them.
// Only the member's facts: no follower counts, rankings or results they didn't type (Legal L76).

const { views, save, time, text, ai, brain } = require('../../_kit');
const U = require('../lib/util');
const K = require('../lib/creator');

const { plain } = text;
const { RULES } = K;

const SCHEMA = {
  type: 'object',
  required: ['statement', 'pillars', 'ig_bio', 'tiktok_bio'],
  properties: {
    statement: { type: 'string' },
    pillars: { type: 'array', items: { type: 'object', required: ['name', 'what', 'ideas'], properties: { name: { type: 'string' }, what: { type: 'string' }, ideas: { type: 'array', items: { type: 'string' } } } } },
    ig_bio: { type: 'string' },
    tiktok_bio: { type: 'string' },
  },
};

const IDEAS = {
  Teach: ['The 3 steps I use for {niche}, start to finish', 'One mistake beginners make with {niche}, and the fix', 'A 30-second how-to: the smallest useful thing about {niche}', 'What I wish I knew in my first month of {niche}'],
  Show: ['My setup for {niche}, and what each thing is for', 'A day of {niche} in 30 seconds', 'Start to finish: one project, no cuts', 'What my space looks like before I start'],
  Story: ['How I got into {niche}', 'The time {niche} went wrong, and what I learned', 'Why I keep going with {niche}', 'One small win this week'],
  Answer: ['A question I get a lot about {niche}', 'Reply to a comment: answered on camera', '"Is it worth it?" My honest answer about {niche}', 'Myths about {niche} I hear all the time'],
  Share: ['Three things I use for {niche} and why', 'A book, account or tool that changed how I do {niche}', 'What I would buy first for {niche}, and what I would skip', 'Something free that helps with {niche}'],
};

function template(f) {
  const pillars = f.pillars.map((p) => ({
    name: p.name,
    what: p.what,
    ideas: (IDEAS[p.name] || [`${p.name}: one post about ${f.niche}`, `${p.name}: a question about it`, `${p.name}: a story about it`, `${p.name}: a how-to about it`]).map((x) => x.replace(/\{niche\}/g, f.niche)),
  }));
  const forWho = f.audience ? ` for ${f.audience}` : '';
  const Niche = `${f.niche[0].toUpperCase()}${f.niche.slice(1)}`;
  const about = f.about ? ` ${f.about[0].toUpperCase()}${f.about.slice(1).replace(/[.!?]$/, '')}.` : '';
  const statement = `I post about ${f.niche}${forWho}.${about}`;
  const gift = f.gift ? ` Free ${f.gift} below.` : '';
  // The longest bio that fits whole: never cut mid-sentence.
  const firstFit = (max, options) => options.find((o) => o.length <= max) || U.fit(options[options.length - 1], max);
  const ig = firstFit(RULES.bios.instagram, [`${Niche}${forWho}.${about} New posts each week.${gift}`, `${Niche}${forWho}.${about}${gift}`, `${Niche}${forWho}. New posts each week.${gift}`, `${Niche}${forWho}. New posts each week.`, `${Niche}.`]);
  const tt = firstFit(RULES.bios.tiktok, [`${Niche}${forWho}.`, `${Niche}. New posts each week.`, `${Niche}.`]);
  return { statement, pillars, ig_bio: ig, tiktok_bio: tt };
}

module.exports = {
  name: 'creator.pillars',
  title: 'Find your content pillars',
  description: 'One sentence on who you post for and what about, five content pillars with four post ideas each, and an Instagram bio and TikTok bio counted to their limits.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 120,
  input: {
    type: 'object',
    required: ['niche'],
    properties: {
      niche: { type: 'string', maxLength: 80, title: 'What you post about', description: 'As narrow as you can, like "houseplants for small apartments"' },
      audience: { type: 'string', maxLength: 120, title: 'Who it is for (optional)', description: 'Like "renters who kill every plant"' },
      about: { type: 'string', maxLength: 300, title: 'What you know or do (optional)', description: 'Your experience in your words' },
      pillars: { type: 'string', format: 'textarea', maxLength: 800, title: 'Your own pillars (optional)', description: 'One per line, like "Rescue: saving a dying plant". Leave empty and we suggest five.' },
      gift: { type: 'string', maxLength: 80, title: 'A free thing you give (optional)' },
    },
  },
  output: { type: 'object', required: ['statement', 'pillars', 'bios'], properties: { niche: { type: 'string' }, statement: { type: 'string' }, pillars: { type: 'array' }, bios: { type: 'array' }, file: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const niche = plain(input.niche || m.niche);
    const base = K.pillarsOf(ctx, input, niche);
    const f = { niche, audience: m.audience, about: plain(input.about || ''), gift: plain(input.gift || ''), pillars: base.pillars.slice(0, 6) };
    const typed = U.typedOf(input, ctx);
    const r = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You help a new creator choose content pillars: kinds of post they can make every week. Plain words. No follower counts, no promises of growth or money, no "best", "#1", ratings or percentages, nothing they did not say about themselves.',
      prompt: `Topic: ${f.niche}\nFor: ${f.audience || '(not given)'}\nWhat they know or do: ${f.about || '(not given)'}\nTheir pillars:\n${f.pillars.map((p) => `${p.name}: ${p.what}`).join('\n')}\n\nWrite a one-sentence niche statement (under 30 words), keep the pillar names and give each 4 specific post ideas (under 14 words each), an Instagram bio of at most ${RULES.bios.instagram} characters and a TikTok bio of at most ${RULES.bios.tiktok} characters.`,
      schema: SCHEMA,
      maxTokens: 1400,
      accept: (d) => U.acceptOf(typed)(d) && Array.isArray(d.pillars) && d.pillars.length >= Math.min(3, f.pillars.length),
      fallback: () => template(f),
    });
    const tpl = template(f);
    const sc = (s) => U.scrub(s, typed);
    const pillars = r.data.pillars.slice(0, 6).map((p, i) => ({
      name: U.fit(p.name || (tpl.pillars[i] || {}).name || 'Pillar', 40),
      what: sc(p.what) || (tpl.pillars[i] || {}).what || '',
      ideas: (p.ideas || []).map(sc).filter(Boolean).slice(0, 4),
    })).map((p, i) => (p.ideas.length ? p : { ...p, ideas: (tpl.pillars[i] || { ideas: [] }).ideas }));
    const statement = sc(r.data.statement) || tpl.statement;
    const bios = [
      { where: 'Instagram', text: U.fit(sc(r.data.ig_bio) || tpl.ig_bio, RULES.bios.instagram), max: RULES.bios.instagram, source: RULES.bios.source },
      { where: 'TikTok', text: U.fit(sc(r.data.tiktok_bio) || tpl.tiktok_bio, RULES.bios.tiktok), max: RULES.bios.tiktok, source: RULES.bios.source },
    ].map((b) => ({ ...b, count: b.text.length }));
    await brain.remember(ctx, 'niche', niche);
    if (f.audience) await brain.remember(ctx, 'audience', f.audience);
    await brain.remember(ctx, 'pillars', pillars.map(({ name, what, ideas }) => ({ name, what, ideas })));
    const lines = [`Niche: ${statement}`, '', ...pillars.flatMap((p) => [`${p.name}: ${p.what}`, ...p.ideas.map((x) => `- ${x}`), '']), ...bios.map((b) => `${b.where} bio (${b.count}/${b.max}): ${b.text}`)];
    const file = await save.saveFile(ctx, save.fileName(niche, 'pillars', time.today(ctx), '.txt'), lines.join('\n'));
    return { niche, statement, pillars, bios, file, ai: r.ai, ...(r.ai ? {} : { sample: true }) };
  },
  view(out) {
    return views.blocks(
      views.metric('Your niche', out.niche, out.statement),
      views.table([{ key: 'name', label: 'Pillar' }, { key: 'what', label: 'What it is' }, { key: 'list', label: 'Post ideas' }], out.pillars.map((p) => ({ ...p, list: p.ideas.join(' / ') }))),
      ...out.bios.map((b) => views.copy(`${b.where} bio (${b.count} of ${b.max} characters)`, b.text)),
      views.text('Saved: the 30-day plan and the hooks use these pillars from now on. Run this again to change them.'),
      views.file(out.file, 'Pillars and bios (text)'),
    );
  },
};
