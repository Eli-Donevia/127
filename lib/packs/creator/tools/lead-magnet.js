// Lead magnet: a small free thing that gets people onto the member's email list. Three title ideas,
// an outline (sections with the points under each), a short sign-up blurb, the delivery email (which
// ends with the address line and an opt-out) and a post to share it. One Markdown file to write from.
// Their topic and facts only: no promised results, no results in a set time, no "proven" (L76 D3).

const { views, save, time, text, ai } = require('../../_kit');
const { ADDRESS_HOLD } = require('../../_kit/outreach');
const U = require('../lib/util');
const K = require('../lib/creator');

const { plain } = text;

const SCHEMA = {
  type: 'object',
  required: ['titles', 'sections', 'blurb', 'email', 'post'],
  properties: {
    titles: { type: 'array', items: { type: 'string' } },
    sections: { type: 'array', items: { type: 'object', required: ['heading', 'points'], properties: { heading: { type: 'string' }, points: { type: 'array', items: { type: 'string' } } } } },
    blurb: { type: 'string' },
    email: { type: 'string' },
    post: { type: 'string' },
  },
};

const FORMATS = {
  checklist: { noun: 'checklist', pages: '1 page', shape: ['Before you start', 'The steps, in order', 'What to check at the end', 'If something goes wrong'] },
  guide: { noun: 'mini guide', pages: '3 to 5 pages', shape: ['Who this is for', 'The basics in plain words', 'Step by step', 'Common mistakes and fixes', 'What to try next'] },
  template: { noun: 'template', pages: '1 or 2 pages', shape: ['How to use this', 'The template', 'A filled-in example', 'Tips'] },
  email_course: { noun: '5-day email course', pages: '5 short emails', shape: ['Day 1: the starting point', 'Day 2: the first step', 'Day 3: the part people get stuck on', 'Day 4: putting it together', 'Day 5: what to do next'] },
  resource_list: { noun: 'resource list', pages: '1 or 2 pages', shape: ['What I use every week', 'Free things worth knowing', 'What I would skip', 'Where to learn more'] },
};

function template(f) {
  const F = FORMATS[f.format];
  const titles = [`The ${f.topic} ${F.noun}`, `${f.topic[0].toUpperCase()}${f.topic.slice(1)}: a starter ${F.noun}`, `My ${f.topic} ${F.noun}${f.audience ? ` for ${f.audience}` : ''}`];
  const sections = F.shape.map((h, i) => ({ heading: h, points: f.facts.length ? [f.facts[i % f.facts.length]] : [`Write 2 or 3 short points from your own experience with ${f.topic}`] }));
  const blurb = `A free ${F.noun} on ${f.topic}${f.audience ? ` for ${f.audience}` : ''}. ${F.pages}, in plain words, from what I do myself. Add your email and it's in your inbox in a minute.`;
  const email = `Hi,\n\nThanks for signing up. Here's your ${F.noun}: [link to the file]\n\nOne tip to start: ${f.facts[0] ? `${f.facts[0]}.` : 'start with the first section and skip what you already know.'}\n\nHit reply and tell me what you're working on with ${f.topic}. I read every reply.\n\n${f.first || '[Your name]'}`;
  const post = `I made a free ${F.noun} on ${f.topic}${f.audience ? ` for ${f.audience}` : ''}. ${F.pages}, no fluff. Comment "${f.keyword}" or use the link in my bio and I'll send it.`;
  return { titles, sections, blurb, email, post };
}

module.exports = {
  name: 'creator.lead_magnet',
  title: 'Outline a free lead magnet',
  description: 'Title ideas and an outline for a small free thing (a checklist, mini guide, template, email course or resource list), the sign-up blurb, the delivery email and a post to share it.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 120,
  input: {
    type: 'object',
    required: ['topic'],
    properties: {
      topic: { type: 'string', maxLength: 100, title: 'What it helps with', description: 'One small problem, like "watering houseplants without killing them"' },
      format: { type: 'string', enum: Object.keys(FORMATS), default: 'checklist', title: 'Format', description: 'checklist, guide, template, email_course or resource_list. A one-page checklist is the quickest to finish.' },
      facts: { type: 'string', format: 'textarea', maxLength: 1500, title: 'What you know about it (optional)', description: 'One point per line, in your words' },
      audience: { type: 'string', maxLength: 120, title: 'Who it is for (optional)' },
      keyword: { type: 'string', maxLength: 20, title: 'Comment keyword (optional)', description: 'Like PLANTS' },
    },
  },
  output: { type: 'object', required: ['titles', 'sections', 'email'], properties: { topic: { type: 'string' }, format: { type: 'string' }, titles: { type: 'array' }, sections: { type: 'array' }, blurb: { type: 'string' }, email: { type: 'string' }, post: { type: 'string' }, file: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const format = FORMATS[input.format] ? input.format : 'checklist';
    const f = {
      topic: plain(input.topic || m.niche).replace(/[.!?]$/, ''),
      format,
      facts: K.C.linesOf(input.facts, 12).map((x) => plain(x).replace(/^[-*\s]+/, '').replace(/[.]$/, '')),
      audience: m.audience,
      keyword: plain(input.keyword || 'SEND').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'SEND',
      first: m.first,
    };
    const typed = U.typedOf(input, ctx);
    const F = FORMATS[format];
    const r = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You help a small creator outline a free lead magnet and write the copy around it, in their voice. Only the facts given. No promised results, no results in a set time, no "proven", "best", "#1", numbers or percentages they did not give, no testimonials.',
      prompt: `Topic: ${f.topic}\nFormat: ${F.noun} (${F.pages})\nFor: ${f.audience || '(not given)'}\nWhat they know:\n${f.facts.join('\n') || '(nothing given: keep points as prompts for them to fill)'}\nComment keyword: ${f.keyword}\nSigned: ${f.first || '[Your name]'}\n\nWrite 3 title ideas (under 60 characters), ${F.shape.length} outline sections with 2 to 4 points each, a sign-up blurb (under 45 words), the delivery email (under 110 words, with [link to the file], ending with an invitation to reply; no unsubscribe or address line, that is added) and a post to share it (under 50 words, ask people to comment the keyword).`,
      schema: SCHEMA,
      maxTokens: 1600,
      accept: (d) => U.acceptOf(typed)(d) && Array.isArray(d.sections) && d.sections.length >= 3 && Array.isArray(d.titles) && d.titles.length >= 2,
      fallback: () => template(f),
    });
    const sc = (s) => U.scrub(s, typed);
    const tpl = template(f);
    const titles = r.data.titles.map((t) => U.fit(sc(t), 70)).filter(Boolean).slice(0, 3);
    const sections = r.data.sections.map((s) => ({ heading: U.fit(sc(s.heading), 70) || 'Section', points: (s.points || []).map(sc).filter(Boolean).slice(0, 5) })).filter((s) => s.points.length);
    const core = (sc(r.data.email) || tpl.email).replace(/\[Your business address[^\]]*\]/gi, '').replace(/P\.S\. This is a note[\s\S]*$/i, '').trim();
    const email = `${core}\n\n${ADDRESS_HOLD}\n\nYou get this because you asked for the free ${F.noun}. Unsubscribe at the bottom of any email.`;
    const out = {
      topic: f.topic,
      format: F.noun,
      titles: titles.length ? titles : tpl.titles,
      sections: sections.length >= 3 ? sections : tpl.sections,
      blurb: sc(r.data.blurb) || tpl.blurb,
      email,
      post: sc(r.data.post) || tpl.post,
    };
    const md = [`# ${out.titles[0]}`, '', `Other titles: ${out.titles.slice(1).join(' / ')}`, '', ...out.sections.flatMap((s) => [`## ${s.heading}`, ...s.points.map((p) => `- ${p}`), '']), '## Sign-up blurb', out.blurb, '', '## Delivery email', out.email, '', '## Post', out.post, ''].join('\n');
    const file = await save.saveFile(ctx, save.fileName(f.topic, F.noun, time.today(ctx), '.md'), md);
    return { ...out, file, ai: r.ai, ...(r.ai ? {} : { sample: true }) };
  },
  view(out) {
    return views.blocks(
      views.metric('Lead magnet', out.titles[0], `A ${out.format} on ${out.topic}`),
      views.text(`Title ideas: ${out.titles.join(' / ')}`),
      views.table([{ key: 'heading', label: 'Section' }, { key: 'list', label: 'Points' }], out.sections.map((s) => ({ ...s, list: s.points.join(' / ') }))),
      views.copy('Sign-up blurb', out.blurb),
      views.copy('Delivery email (set it as the welcome email in your email tool)', out.email),
      views.copy('Post to share it', out.post),
      views.text('Write it in a doc, export a PDF, and put the link in the welcome email. Done is better than long: one page is enough.'),
      views.file(out.file, 'Outline and copy (Markdown)'),
    );
  },
};
