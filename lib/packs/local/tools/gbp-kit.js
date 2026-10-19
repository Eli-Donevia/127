// local.gbp_kit: a Google Business Profile, filled in before the member opens Google. Description
// (750 characters max, counted), primary and additional categories, services, service areas, 10 FAQs
// for the website and posts (Google retired profile Q&A), the first 4 posts, a photo shot list, and
// the setup and verification steps. One printable page in their colors plus copy blocks.

const kit = require('../../_kit');
const { text, ai, files, save, views } = kit;
const F = require('../lib/facts');
const { BIZ, ASSET } = require('../lib/common');
const GBP = require('../data/gbp.json');

const MAX = GBP.description.max_chars;

function areasOf(raw, f) {
  const list = String(raw || '')
    .split(/[\n,;]+/)
    .map((s) => text.clip(s.trim(), 60))
    .filter(Boolean);
  if (!list.length && f.city) list.push(f.place || f.city);
  return [...new Set(list)].slice(0, GBP.service_areas.max);
}

function serviceNames(f) {
  const typed = (f.services || []).map((s) => s.name).filter(Boolean);
  return [...new Set(typed.length ? typed : f.group.services || [])].slice(0, 12);
}

function describe(f, areas, services) {
  const where = areas.length ? areas.slice(0, 3).join(', ') : f.city || 'your area';
  const what = f.what || f.group.label.toLowerCase();
  const seed = f.name + where;
  const open = text.pickBy(seed, [
    `${f.name} is a local ${what} business serving ${where}.`,
    `${f.name} offers ${what} in ${where}.`,
    `At ${f.name}, we provide ${what} for homes and businesses in ${where}.`,
  ]);
  const mobile = f.mobile ? text.pickBy(seed + 'm', [`We come to you: ${String(f.group.mobile_line || 'at your home or office').toLowerCase()}.`, 'We bring everything we need and work at your place, on your schedule.']) : '';
  const list = services.length ? `Services include ${services.slice(0, 6).join(', ').toLowerCase()}.` : '';
  const care = text.pickBy(seed + 'c', [
    'Ask for a price before you book; there is no charge for asking.',
    'Tell us what you need and you get a price before any work starts.',
    'Questions are welcome before you book.',
  ]);
  const how = f.booking || f.website ? 'Book online or call to set a time.' : f.phone ? 'Call or text to set a time.' : 'Message us to set a time.';
  let d = [open, mobile, list, care, how].filter(Boolean).join(' ');
  if (d.length > MAX) d = text.clip(d, MAX);
  return d;
}

function postsOf(f, areas, services) {
  const where = areas[0] || f.city || 'the area';
  const s1 = services[0] || f.what || 'our services';
  const button = f.booking ? 'Book' : f.website ? 'Learn more' : 'Call';
  return [
    { type: 'Update', title: 'We are open', text: `${f.name} is now taking bookings in ${where}. ${f.mobile ? 'We come to you. ' : ''}${services.length ? `Ask about ${services.slice(0, 3).join(', ').toLowerCase()}.` : ''}`.trim(), button },
    { type: 'Update', title: `How ${s1.toLowerCase()} works`, text: `What happens when you book ${s1.toLowerCase()}: we confirm a time, ${f.mobile ? 'arrive with everything we need' : 'get you set up when you arrive'}, walk you through the work, and check it with you at the end.`, button },
    { type: 'Update', title: 'A tip from us', text: text.pickBy(f.name, f.group.tips || ['Ask us anything before you book. We are happy to help.']), button },
    { type: 'Update', title: 'Booking this week', text: `We have a few openings this week in ${where}. ${button === 'Call' ? 'Call or text' : 'Tap the button'} to pick a time.`, button },
  ];
}

const UNHAPPY = /not happy/i;

function faqsOf(f, areas) {
  // The member's promise answers "what if I'm not happy", whichever list the question comes from.
  const promise = f.promise ? text.clip(text.plain(f.promise), 240) : '';
  const own = (f.group.faq || []).map((x) => {
    const a = x.a || (UNHAPPY.test(x.q) ? promise : '');
    return { q: x.q, a, fill: !a, hint: x.hint || '' };
  });
  const book = f.booking || f.website ? `Book online at ${f.booking || f.website}, or call${f.phone ? ` ${f.phone.display}` : ''}.` : f.phone ? `Call or text ${f.phone.display} and we will find a time.` : '';
  const common = [
    { q: 'What areas do you serve?', a: areas.length ? `We serve ${areas.join(', ')}.` : '', hint: 'One line: the towns or neighborhoods you cover.' },
    { q: 'How do I book?', a: book, hint: 'One line: how to book (link, call or text).' },
    { q: 'How do I pay?', a: '', hint: 'One line: the payment methods you take and when (for example, card or cash after the job).' },
    { q: 'What if I am not happy with the job?', a: promise, hint: 'One line: what you do to make it right, like coming back to fix it at no charge.' },
    { q: 'How far ahead should I book?', a: '', hint: 'One line: your usual wait and whether you take same-week jobs.' },
    { q: 'Are you insured?', a: '', hint: 'Only if you are: say what your insurance covers. Otherwise leave this question out.' },
  ].map((x) => ({ ...x, fill: !x.a }));
  const seen = new Set(own.map((x) => x.q.toLowerCase()));
  const ownUnhappy = own.some((x) => UNHAPPY.test(x.q));
  return own.concat(common.filter((x) => !seen.has(x.q.toLowerCase()) && !(ownUnhappy && UNHAPPY.test(x.q)))).slice(0, 10);
}

const SCHEMA = {
  type: 'object',
  required: ['description', 'posts', 'answers'],
  properties: {
    description: { type: 'string', maxLength: MAX },
    posts: { type: 'array', items: { type: 'object', required: ['title', 'text'], properties: { title: { type: 'string', maxLength: 60 }, text: { type: 'string', maxLength: 600 } } } },
    answers: { type: 'array', items: { type: 'string', maxLength: 300 } },
  },
};

function steps(f) {
  const v = GBP.verification;
  return [
    'Go to business.google.com and sign in with the Google account you will keep for the business.',
    `Type your business name exactly as customers see it: ${f.name}. Don't add cities or keywords to the name.`,
    'Pick the primary category below, then add the others.',
    f.mobile ? 'Choose that you serve customers at their place and hide your home address. Add your service areas below.' : 'Add the address customers visit. No P.O. boxes or virtual offices.',
    'Add your phone and website, then your hours.',
    `Verify. ${v.who_chooses} Methods you may see: ${v.methods.join('; ')}.`,
    'After verification: paste the description, add services, upload the photos on the list, and publish the first post.',
  ];
}

function kitHtml(f, out) {
  const p = f.palette;
  const esc = (s) => files.esc(text.plain(s));
  const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');
  const css = `:root{--p:${p.primary};--on:${p.onPrimary};--a:${p.accent};--ink:${p.ink};--s:${p.surface};--m:${p.muted};--l:${p.line}}
*{box-sizing:border-box}body{margin:0;background:var(--s);color:var(--ink);font:16px/1.55 Inter,'Helvetica Neue',Arial,sans-serif}
header{background:var(--p);color:var(--on);padding:48px 32px 40px}header .in,main{max-width:860px;margin:0 auto}
h1{font-size:44px;line-height:1.05;letter-spacing:-0.02em;margin:8px 0 10px}header p{margin:0;opacity:.9;font-size:18px}
.eyebrow{font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
main{padding:28px 20px 60px}section{background:#fff;border:1px solid var(--l);border-radius:18px;padding:24px 26px;margin:0 0 18px}
h2{font-size:22px;margin:0 0 12px;letter-spacing:-0.01em}.count{color:var(--m);font-size:14px}
.box{background:var(--s);border-radius:12px;padding:14px 16px;white-space:pre-wrap}.tag{display:inline-block;background:var(--s);border:1px solid var(--l);border-radius:999px;padding:4px 12px;margin:0 6px 6px 0;font-size:14px}
.tag.main{background:var(--p);color:var(--on);border-color:var(--p);font-weight:700}ol,ul{padding-left:22px;margin:0}li{margin:0 0 6px}
.faq dt{font-weight:700;margin-top:10px}.faq dd{margin:2px 0 0}.fill{color:var(--m);font-style:italic}
.post{border-top:1px solid var(--l);padding-top:12px;margin-top:12px}.post b{display:block}
@media print{body{background:#fff}section{break-inside:avoid}}`;
  const faq = out.faqs.map((x) => `<dt>${esc(x.q)}</dt><dd${x.fill ? ' class="fill"' : ''}>${esc(x.a || `Your answer: ${x.hint}`)}</dd>`).join('');
  const posts = out.posts.map((x, i) => `<div class="post"><b>${i + 1}. ${esc(x.title)}</b>${esc(x.text)}<div class="count">Button: ${esc(x.button)}</div></div>`).join('');
  const body = `<header><div class="in"><div class="eyebrow">Google Business Profile kit</div><h1>${esc(f.name)}</h1><p>Everything to paste in, in order. Google's own screens are the final word.</p></div></header><main>
<section><h2>Description</h2><div class="count">${out.descriptionChars} of ${MAX} characters</div><div class="box">${esc(out.description)}</div></section>
<section><h2>Categories</h2><span class="tag main">${esc(out.categories.primary)}</span>${out.categories.additional.map((c) => `<span class="tag">${esc(c)}</span>`).join('')}<p class="count">${esc(GBP.categories.rule)}</p></section>
<section><h2>Services</h2><ul>${li(out.services)}</ul></section>
<section><h2>Service areas</h2>${out.areas.length ? `<ul>${li(out.areas)}</ul>` : '<p>Add the towns or ZIP codes you serve (up to 20).</p>'}</section>
<section><h2>10 questions customers ask</h2><p class="count">Google removed Q and A from profiles, so put these on your website and in posts.</p><dl class="faq">${faq}</dl></section>
<section><h2>Your first 4 posts</h2>${posts}</section>
<section><h2>Photos to take</h2><ol>${li(out.photos)}</ol><p class="count">${esc(`${GBP.photos.format}, ${GBP.photos.size}, ${GBP.photos.recommended} recommended.`)}</p></section>
<section><h2>Setup and verification</h2><ol>${li(out.steps)}</ol></section></main>`;
  return files.htmlDoc({ title: `${f.name}: Google profile kit`, css, body, head: '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">' });
}

module.exports = {
  name: 'local.gbp_kit',
  title: 'Write your Google profile',
  description: 'Writes your Google Business Profile before you open Google: a description under 750 characters, primary and extra categories, services, service areas, 10 FAQs, the first 4 posts, a photo list, and the setup and verification steps.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 3,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      ...BIZ,
      areas: { type: 'string', title: 'Towns or ZIP codes you serve (optional)', maxLength: 1200, description: 'One per line or comma separated, up to 20' },
      promise: { type: 'string', title: 'Your promise (optional)', maxLength: 300, description: 'What you do when a customer is not happy, like "I come back and make it right at no charge"' },
    },
  },
  output: {
    type: 'object',
    required: ['description', 'categories', 'faqs', 'posts', 'files'],
    properties: {
      business: { type: 'string' },
      description: { type: 'string', maxLength: MAX },
      descriptionChars: { type: 'integer' },
      categories: { type: 'object' },
      services: { type: 'array', items: { type: 'string' } },
      areas: { type: 'array', items: { type: 'string' } },
      faqs: { type: 'array', items: { type: 'object' } },
      posts: { type: 'array', items: { type: 'object' } },
      photos: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: { type: 'string' } },
      eligibility: { type: 'array', items: { type: 'string' } },
      files: { type: 'object', properties: { kit: ASSET } },
      sample: { type: 'boolean' },
      ai: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, input);
    const areas = areasOf(input.areas, f);
    const services = serviceNames(f);
    const faqs = faqsOf(f, areas);
    const fallback = { description: describe(f, areas, services), posts: postsOf(f, areas, services).map(({ title, text: t }) => ({ title, text: t })), answers: faqs.map((x) => x.a) };
    const res = await ai.aiJson(ctx, {
      task: 'write',
      system: `You write Google Business Profile copy for a small local business, from the facts given only. Description: under ${MAX} characters, no links, no prices or promotions, no claims you cannot check (no "best", no years in business, no ratings). Posts: under 600 characters each. Answers: one or two plain sentences; where the facts don't say, write a neutral answer the owner can edit.`,
      prompt: `Business: ${f.name}. What: ${f.what || f.group.label}. Where: ${areas.join(', ') || f.city || 'not given'}. Mobile: ${f.mobile ? 'yes, goes to customers' : 'no'}. Services: ${services.join(', ')}. Booking: ${f.booking || f.website || (f.phone && f.phone.display) || 'not given'}.\nWrite description, 4 posts (title, text) and one answer for each question in order:\n${faqs.map((x, i) => `${i + 1}. ${x.q}${x.hint ? ` (${x.hint})` : ''}`).join('\n')}`,
      schema: SCHEMA,
      fallback: () => fallback,
      accept: (d) => ai.cleanCopy(d) && d.description.length <= MAX && d.posts.length >= 4 && d.answers.length >= faqs.length && !/https?:|www\./i.test(d.description),
    });
    const data = res.data || fallback;
    const basePosts = postsOf(f, areas, services);
    const posts = basePosts.map((p, i) => ({ ...p, title: (data.posts[i] && data.posts[i].title) || p.title, text: (data.posts[i] && data.posts[i].text) || p.text }));
    const filled = faqs.map((x, i) => (res.ai && data.answers[i] ? { q: x.q, a: data.answers[i], fill: false } : x));
    const description = text.clip(data.description, MAX);
    const additional = (f.group.secondary || []).filter((c) => c !== f.category).slice(0, 3);
    const photos = ['Your logo, square', 'A cover photo: you or your vehicle or storefront at work', ...(f.group.photos || [])].slice(0, 10);
    const out = {
      business: f.name,
      description,
      descriptionChars: description.length,
      categories: { primary: f.category, additional, note: GBP.categories.names_note },
      services,
      areas,
      faqs: filled,
      posts,
      photos,
      steps: steps(f),
      eligibility: [GBP.eligibility.rule, GBP.eligibility.service_area, GBP.eligibility.name, GBP.eligibility.po_box].filter(Boolean),
      sample: !f.hasName,
      ai: !!res.ai,
    };
    const kitFile = await save.saveFile(ctx, save.fileName(f.name, 'google-profile-kit', '.html'), kitHtml(f, out), 'text/html');
    return { ...out, files: { kit: kitFile } };
  },
  view(out) {
    return views.blocks(
      views.file(out.files && out.files.kit, 'Your Google profile kit, in order'),
      views.copy(`Description (${out.descriptionChars} of ${MAX} characters)`, out.description),
      views.metric('Primary category', out.categories.primary, out.categories.additional.length ? `Also add: ${out.categories.additional.join(', ')}` : ''),
      views.copy('Services', out.services.join('\n')),
      out.areas.length ? views.copy('Service areas', out.areas.join('\n')) : null,
      out.posts.map((p, i) => views.copy(`Post ${i + 1}: ${p.title}`, p.text)),
      views.table([{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer' }], out.faqs.map((x) => ({ q: x.q, a: x.a || `Your answer: ${x.hint}` }))),
      views.text(`Photos to take: ${out.photos.join('; ')}.`),
      views.text(`Setup: ${out.steps.map((s, i) => `${i + 1}. ${s}`).join(' ')}`)
    );
  },
};
