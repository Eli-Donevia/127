// Weekly newsletter draft: three subject lines, preview text and a short email in the member's voice:
// a hello, the main thing this week, one tip, what they're using or reading (only links they typed),
// and a question to reply to. Ends with the address line and the unsubscribe line. Their facts only.

const { views, save, time, text, ai } = require('../../_kit');
const { ADDRESS_HOLD } = require('../../_kit/outreach');
const U = require('../lib/util');
const K = require('../lib/creator');

const { plain } = text;
const UNSUB = 'You get this because you signed up. Unsubscribe at the bottom of any email.';

const SCHEMA = {
  type: 'object',
  required: ['subjects', 'preview', 'body'],
  properties: { subjects: { type: 'array', items: { type: 'string' } }, preview: { type: 'string' }, body: { type: 'string' } },
};

// With no topic typed (a scheduled run), this week's idea from their pillars, one pillar a week.
function weekIdea(ctx, input, niche) {
  const { pillars } = K.pillarsOf(ctx, {}, niche);
  const week = Math.floor(time.nowMs(ctx) / (7 * 864e5));
  const p = pillars[week % pillars.length];
  const ideas = Array.isArray(p.ideas) && p.ideas.length ? p.ideas : [p.what];
  return ideas[Math.floor(week / pillars.length) % ideas.length];
}

function template(f) {
  const subjects = [U.fit(f.main, 50), U.fit(`This week: ${f.main}`, 50), U.fit(`A ${f.niche} note: ${f.main}`, 50)];
  const body = [
    `Hi${f.reader ? ` ${f.reader}` : ''},`,
    f.hello || `Here's this week's note on ${f.niche}.`,
    `This week: ${f.main}${f.story ? `\n\n${f.story}` : ''}`,
    f.tip ? `One tip: ${f.tip}` : '',
    f.links.length ? `What I'm using or reading:\n${f.links.map((l) => `- ${l}`).join('\n')}` : '',
    f.ask || `Reply and tell me: what are you working on with ${f.niche} this week? I read every reply.`,
    f.first || '[Your name]',
  ].filter(Boolean).join('\n\n');
  return { subjects, preview: U.fit(f.story || f.main, 90), body };
}

module.exports = {
  name: 'creator.newsletter',
  title: 'Draft this week\'s newsletter',
  description: 'Three subject lines, preview text and a short weekly email: the main thing this week, one tip, what you are using, and a question to reply to. From your notes only.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 4,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      main: { type: 'string', maxLength: 160, title: 'The main thing this week', description: 'Like "why my pothos finally stopped yellowing". Leave empty to use an idea from your pillars.' },
      story: { type: 'string', format: 'textarea', maxLength: 1500, title: 'What happened, in your words (optional)' },
      tip: { type: 'string', maxLength: 300, title: 'One tip (optional)' },
      links: { type: 'string', format: 'textarea', maxLength: 800, title: 'Things you are using or reading (optional)', description: 'One per line, with the link if you have one' },
      ask: { type: 'string', maxLength: 200, title: 'Your question to readers (optional)' },
      niche: { type: 'string', maxLength: 80, title: 'What you post about (optional)' },
    },
  },
  output: { type: 'object', required: ['subjects', 'email'], properties: { subjects: { type: 'array' }, preview: { type: 'string' }, email: { type: 'string' }, file: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const f = {
      niche: m.niche,
      main: plain(input.main || weekIdea(ctx, input, m.niche)).replace(/[.]$/, ''),
      story: plain(input.story || ''),
      tip: input.tip ? K.C.sentence(plain(input.tip)) : '',
      links: K.C.linesOf(input.links, 6).map(plain),
      ask: plain(input.ask || ''),
      first: m.first,
      hello: '',
      reader: '',
    };
    const typed = U.typedOf(input, ctx);
    const r = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You draft a short weekly email newsletter for a small creator, in their voice: warm, plain, like a note to a friend. Use only what they wrote. Include only the links given, word for word. No numbers, results, ratings, "best", "#1", sales or testimonials they did not give. No unsubscribe or address line: those are added.',
      prompt: `Topic area: ${f.niche}\nMain thing: ${f.main}\nWhat happened: ${f.story || '(not given)'}\nTip: ${f.tip || '(none)'}\nUsing or reading:\n${f.links.join('\n') || '(none: leave the section out)'}\nQuestion for readers: ${f.ask || '(write one simple question)'}\nSigned: ${f.first || '[Your name]'}\n\nWrite 3 subject lines (under 50 characters), preview text (under 90) and the email body (under 250 words).`,
      schema: SCHEMA,
      maxTokens: 1200,
      accept: (d) => U.acceptOf(typed)(d) && Array.isArray(d.subjects) && d.subjects.length >= 2 && f.links.every((l) => !/https?:\/\//.test(l) || d.body.includes(l.match(/https?:\/\/\S+/)[0])),
      fallback: () => template(f),
    });
    const tpl = template(f);
    const sc = (s) => U.scrub(s, typed);
    const subjects = r.data.subjects.map((s) => U.fit(sc(s), 60)).filter(Boolean).slice(0, 3);
    const core = (sc(r.data.body) || tpl.body).replace(/\[Your business address[^\]]*\]/gi, '').trim();
    const email = `${core}\n\n${ADDRESS_HOLD}\n\n${UNSUB}`;
    const preview = U.fit(sc(r.data.preview) || tpl.preview, 110);
    const all = [`Subject ideas:\n${(subjects.length ? subjects : tpl.subjects).map((s) => `- ${s}`).join('\n')}`, `Preview: ${preview}`, '', email].join('\n');
    const file = await save.saveFile(ctx, save.fileName(f.niche, 'newsletter', time.today(ctx), '.txt'), all);
    return { subjects: subjects.length ? subjects : tpl.subjects, preview, email, file, ai: r.ai, ...(r.ai ? {} : { sample: true }) };
  },
  view(out) {
    return views.blocks(
      views.metric('This week\'s newsletter', out.subjects[0], out.preview),
      views.text(`Subject ideas: ${out.subjects.join(' / ')}`),
      views.copy('Email', out.email),
      views.text('Paste it into your email tool (it adds the unsubscribe link and your address). Send it the same day each week, only to people who signed up.'),
      views.file(out.file, 'Newsletter (text)'),
    );
  },
};
