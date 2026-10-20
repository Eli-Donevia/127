// Launch kit: one launch email and three posts (a first look 3 days before, launch day, and a
// how-it's-made post 3 days after), dated from the member's launch day, with a calendar file.
// Only their facts and their own offer: no "best", ratings, buyer counts, made-up scarcity or promised
// results (Legal L76 D3, D4). AI writes when it can; the template uses their words.

const { views, save, files, time, text, ai } = require('../../_kit');
const U = require('../lib/util');
const S = require('../lib/store');

const { plain } = text;

const SCHEMA = {
  type: 'object',
  required: ['subject', 'preview', 'email', 'posts'],
  properties: {
    subject: { type: 'string' },
    preview: { type: 'string' },
    email: { type: 'string' },
    posts: { type: 'array', items: { type: 'string' } },
  },
};

function template(f) {
  const facts = f.details.slice(0, 3);
  const offer = f.offer ? `\n\n${f.offer}` : '';
  const link = f.link ? `\n\n${f.link}` : '\n\n[link to your shop]';
  const subject = U.fit(`${f.product} is here`, 50);
  const preview = U.fit(f.what, 90);
  const email = [
    `Hi there,`,
    `${f.product} is live in ${f.shop || 'my shop'} today.`,
    f.what,
    facts.length ? `A few things to know:\n${facts.map((x) => `- ${x}`).join('\n')}` : '',
    `If you have a question before you order, just reply to this email. I read every one.${offer}${link}`,
    `${f.first || 'Thanks'}${f.first ? '' : ','}`,
  ].filter(Boolean).join('\n\n');
  const posts = [
    `Something new is coming on ${f.dayName}: ${f.product}. ${f.what} Want a first look? Follow along this week.`,
    `${f.product} is live today. ${facts[0] ? `${facts[0]}. ` : ''}${f.offer ? `${f.offer} ` : ''}Link in my bio${f.link ? `, or ${f.link}` : ''}.`,
    `How ${f.product} gets made: ${facts.length ? facts.join('. ') : f.what}. Questions? Ask in the comments and I'll answer every one.`,
  ].map((p) => p.replace(/\.\./g, '.'));
  return { subject, preview, email, posts };
}

module.exports = {
  name: 'ecom.launch_kit',
  title: 'Write your launch kit',
  description: 'A launch email and three posts (a first look, launch day and how it is made), dated from your launch day with a calendar file, from your facts and your own offer only.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 120,
  input: {
    type: 'object',
    required: ['product'],
    properties: {
      product: { type: 'string', maxLength: 80, title: 'What you are launching', description: 'A product, a collection or the shop itself' },
      what: { type: 'string', maxLength: 240, title: 'What it is, in one sentence' },
      details: { type: 'string', format: 'textarea', maxLength: 1200, title: 'Facts, one per line (optional)', description: 'How it is made, sizes, colors, what is in the box' },
      launch: { type: 'string', format: 'date', title: 'Launch day (optional)', description: 'Leave it empty for next Thursday' },
      offer: { type: 'string', maxLength: 160, title: 'Your launch offer (optional)', description: 'Only one you will really run, in your words, like "Free shipping through Sunday"' },
      link: { type: 'string', maxLength: 200, title: 'Link to the product or shop (optional)' },
      shop: { type: 'string', maxLength: 80, title: 'Shop name (optional)' },
    },
  },
  output: { type: 'object', required: ['email', 'posts', 'dates'], properties: { product: { type: 'string' }, subject: { type: 'string' }, preview: { type: 'string' }, email: { type: 'string' }, posts: { type: 'array' }, dates: { type: 'array' }, calendar: { type: 'object' }, file: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = S.me(ctx, input);
    const today = time.today(ctx);
    const launch = /^\d{4}-\d{2}-\d{2}$/.test(String(input.launch || '')) && input.launch > today ? input.launch : time.nextWeekday(today, 4, { after: true });
    const f = {
      product: plain(input.product),
      what: U.fit(plain(input.what || `${input.product}, made by hand in small batches.`), 240),
      details: String(input.details || '').split(/\r?\n/).map((x) => plain(x).replace(/^[-*\s]+/, '').replace(/\.$/, '')).filter(Boolean).slice(0, 6),
      offer: input.offer ? plain(input.offer).replace(/([^.!?])$/, '$1.') : '',
      link: m.link,
      shop: m.shop,
      first: m.first,
      dayName: time.shortDate(launch),
    };
    const typed = U.typedOf(input, ctx);
    const r = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write launch copy for a small online shop owner, in their voice: warm, plain, short. Use only the facts given. No ratings, reviews, testimonials, buyer counts, "best", "#1", percentages, countdowns or scarcity, and no offer except the one given.',
      prompt: `Launching: ${f.product}\nWhat it is: ${f.what}\nFacts:\n${f.details.join('\n') || '(none)'}\nLaunch day: ${f.dayName}\nTheir offer: ${f.offer || '(none: do not add one)'}\nLink: ${f.link || '(none: write "link in bio")'}\nShop: ${f.shop || '(not given)'}\nSigned: ${f.first || '(no name)'}\n\nWrite a subject (at most 50 characters), preview text (at most 90), the launch email (under 150 words, ends inviting replies), and 3 posts: a first look 3 days before, launch day, and how it is made 3 days after (each under 60 words).`,
      schema: SCHEMA,
      maxTokens: 1200,
      accept: (d) => U.acceptOf(typed)(d) && Array.isArray(d.posts) && d.posts.length >= 3,
      fallback: () => template(f),
    });
    const sc = (s) => U.scrub(s, typed);
    const base = template(f);
    const email = sc(r.data.email) || base.email;
    const posts = r.data.posts.slice(0, 3).map((p, i) => sc(p) || base.posts[i]);
    const subject = U.fit(sc(r.data.subject) || base.subject, 60);
    const preview = U.fit(sc(r.data.preview) || base.preview, 110);
    const dates = [
      { date: time.addDays(launch, -3), what: 'Post: first look', text: posts[0] },
      { date: launch, what: 'Send the launch email', text: `${subject}\n\n${email}` },
      { date: launch, what: 'Post: launch day', text: posts[1] },
      { date: time.addDays(launch, 3), what: 'Post: how it is made', text: posts[2] },
    ].map((d) => ({ ...d, day: time.shortDate(d.date) }));
    const tz = time.tzOf(ctx);
    const calendar = await save.saveFile(ctx, save.fileName(f.product, 'launch', launch, '.ics'), files.ics(dates.map((d, i) => ({ uid: `ecom-launch-${launch}-${i}@127group.io`, title: d.what, description: d.text, date: d.date, time: '10:00', minutes: 20, tz })), { name: `${f.product} launch`, now: time.nowMs(ctx) }));
    const all = [`Launch email (${dates[1].day})`, `Subject: ${subject}`, `Preview: ${preview}`, '', email, '', ...dates.filter((d) => d.what.startsWith('Post')).flatMap((d) => [`${d.what} (${d.day})`, d.text, ''])].join('\n');
    const file = await save.saveFile(ctx, save.fileName(f.product, 'launch kit', launch, '.txt'), all);
    return { product: f.product, subject, preview, email, posts, dates: dates.map(({ date, day, what }) => ({ date, day, what })), calendar, file, ai: r.ai, ...(r.ai ? {} : { sample: true }) };
  },
  view(out) {
    return views.blocks(
      views.metric('Launch kit', out.product, out.dates.map((d) => `${d.day}: ${d.what}`).join('. ')),
      views.copy('Launch email', `Subject: ${out.subject}\nPreview: ${out.preview}\n\n${out.email}`),
      ...out.posts.map((p, i) => views.copy(`Post ${i + 1}: ${['first look', 'launch day', 'how it is made'][i]}`, p)),
      views.text('Your email tool adds the unsubscribe link and your address at the bottom. Send it only to people who signed up for your emails.'),
      views.file(out.calendar, 'Launch dates (calendar file)'),
      views.file(out.file, 'Everything in one text file'),
    );
  },
};
