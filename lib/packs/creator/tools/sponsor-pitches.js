// Sponsor pitch drafts: one short email per brand the member names (we never pick or invent brands),
// built on why they really use it, what they'd make, and their numbers only if they typed them. With
// no brand named, one template with "[Brand name]" to fill in. Every email ends with the address
// line and a "no thanks" opt-out, and the view lists the FTC, YouTube and TikTok disclosure rules.
// Nothing is sent: the member sends from their own email.

const { views, save, time, text, ai } = require('../../_kit');
const { ADDRESS_HOLD, optOut } = require('../../_kit/outreach');
const U = require('../lib/util');
const K = require('../lib/creator');

const { plain } = text;
const ABOUT = 'a paid partnership with me';

const SCHEMA = {
  type: 'object',
  required: ['pitches'],
  properties: { pitches: { type: 'array', items: { type: 'object', required: ['subject', 'body'], properties: { subject: { type: 'string' }, body: { type: 'string' } } } } },
};

function brandsOf(v) {
  return K.C.linesOf(v, 10).map((l) => {
    const [brand, why, contact] = l.split(/\s*\|\s*/);
    return { brand: plain(brand), why: plain(why || ''), contact: plain(contact || '') };
  }).filter((b) => b.brand);
}

function template(f, b) {
  const hi = b.contact ? `Hi ${b.contact.split(' ')[0]},` : `Hi ${b.brand === '[Brand name]' ? '[name]' : `${b.brand} team`},`;
  const w = b.why.replace(/[.!]$/, '');
  const why = !w ? `I'd like to work with ${b.brand}, and I only pitch brands I'd use myself.` : /^(I|I'm|I've|we|my)\b/i.test(w) ? `${w[0].toUpperCase()}${w.slice(1)}.` : /^(use|love|buy|wear|own|have|drink|eat|read)\b/i.test(w) ? `I already ${w}.` : `I already use ${b.brand}: ${w}.`;
  const nums = f.numbers ? ` Right now: ${f.numbers.replace(/[.]$/, '')}.` : '';
  const idea = f.idea ? `My idea: ${f.idea.replace(/[.]$/, '')}.` : `My idea: ${f.deliverable} showing how I use ${b.brand} in my ${f.niche} routine, made in my usual style.`;
  const body = [
    hi,
    `I'm ${f.name}${f.handle ? ` (${f.handle})` : ''}, and I post about ${f.niche}${f.audience ? ` for ${f.audience}` : ''}.${nums}`,
    why,
    idea,
    `${f.kit ? `My media kit with my numbers and rates: ${f.kit}\n\n` : ''}Would you be open to a short call or a reply with who handles partnerships?`,
    `${f.first || f.name}`,
    ADDRESS_HOLD,
    optOut(ABOUT),
  ].join('\n\n');
  return { subject: U.fit(`${b.brand} x ${f.handle || f.name}: ${f.deliverable}`, 70), body };
}

// The AI writes the middle; the address line and opt-out are always added by code, last.
function finish(body) {
  const core = String(body || '').replace(/\[Your business address[^\]]*\]/gi, '').replace(/P\.S\. This is a note about[\s\S]*$/i, '').trim();
  return `${core}\n\n${ADDRESS_HOLD}\n\n${optOut(ABOUT)}`;
}

module.exports = {
  name: 'creator.sponsor_pitches',
  title: 'Write sponsor pitches',
  description: 'A short pitch email to each brand you name, built on why you use it and what you would make, with your numbers only if you type them. Each ends with your address line and an opt-out.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 150,
  input: {
    type: 'object',
    properties: {
      brands: { type: 'string', format: 'textarea', maxLength: 1500, title: 'Brands you would pitch', description: 'One per line: brand | why you use it | contact name (optional). Only brands you really use. Leave empty for a template.' },
      deliverable: { type: 'string', maxLength: 120, default: 'one Instagram Reel', title: 'What you would make', description: 'Like "one Reel and 3 Stories"' },
      idea: { type: 'string', maxLength: 300, title: 'Your content idea (optional)' },
      numbers: { type: 'string', maxLength: 200, title: 'Your numbers, as you want them said (optional)', description: 'Like "4,200 followers on Instagram, most in Ohio". Only what your insights show. Leave empty to leave numbers out.' },
      kit: { type: 'string', maxLength: 200, title: 'Link to your media kit (optional)' },
      niche: { type: 'string', maxLength: 80, title: 'What you post about (optional)' },
      audience: { type: 'string', maxLength: 120, title: 'Who follows you (optional)' },
      handle: { type: 'string', maxLength: 60, title: 'Your handle (optional)' },
      name: { type: 'string', maxLength: 80, title: 'Your name (optional)' },
    },
  },
  output: { type: 'object', required: ['pitches', 'disclosure'], properties: { pitches: { type: 'array' }, disclosure: { type: 'array' }, template: { type: 'boolean' }, file: { type: 'object' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const named = brandsOf(input.brands);
    const brands = named.length ? named : [{ brand: '[Brand name]', why: '', contact: '' }];
    const f = {
      name: m.name || m.first || '[Your name]',
      first: m.first,
      handle: m.handle,
      niche: m.niche,
      audience: m.audience,
      deliverable: plain(input.deliverable || 'one Instagram Reel'),
      idea: plain(input.idea || ''),
      numbers: plain(input.numbers || ''),
      kit: /^https:\/\//.test(String(input.kit || '')) ? String(input.kit) : '',
    };
    const typed = U.typedOf(input, ctx);
    let r = { data: { pitches: brands.map((b) => template(f, b)) }, ai: false };
    if (named.length) {
      r = await ai.aiJson(ctx, {
        task: 'write',
        system: 'You write short, honest sponsor pitch emails for a small creator, in their voice. Use only the facts given. Never add numbers, results, past brands, ratings, "best", "#1", promised sales or reach. Do not say anything about the brand except what the creator said. Under 130 words each. Do not write a sign-off address or unsubscribe line: those are added.',
        prompt: `Creator: ${f.name}${f.handle ? ` (${f.handle})` : ''}\nPosts about: ${f.niche}\nFor: ${f.audience || '(not given)'}\nTheir numbers: ${f.numbers || '(none: do not mention numbers)'}\nWould make: ${f.deliverable}\nIdea: ${f.idea || '(none given: suggest one natural way they would use the product)'}\nMedia kit link: ${f.kit || '(none)'}\n\nBrands, in order:\n${brands.map((b, i) => `${i + 1}. ${b.brand}. Why they use it: ${b.why || '(not given)'}. Contact: ${b.contact || '(unknown)'}`).join('\n')}\n\nWrite one pitch per brand, in the same order: a subject under 70 characters and a body that ends asking for a short call or who handles partnerships, signed ${f.first || f.name}.`,
        schema: SCHEMA,
        maxTokens: 400 * brands.length + 300,
        accept: (d) => U.acceptOf(typed)(d) && Array.isArray(d.pitches) && d.pitches.length === brands.length,
        fallback: () => ({ pitches: brands.map((b) => template(f, b)) }),
      });
    }
    const pitches = brands.map((b, i) => {
      const t = template(f, b);
      const p = r.data.pitches[i] || t;
      const body = r.ai ? finish(U.scrub(p.body, typed) || t.body) : t.body;
      return { brand: b.brand, to: b.contact, subject: U.fit(U.scrub(p.subject, typed) || t.subject, 80), email: body };
    });
    const disclosure = K.RULES.disclosure.map(({ title, text: t, url }) => ({ title, text: t, url }));
    const all = [...pitches.flatMap((p) => [`To: ${p.brand}${p.to ? ` (${p.to})` : ''}`, `Subject: ${p.subject}`, '', p.email, '', '---', '']), 'If they say yes: mark it as an ad.', ...disclosure.map((d) => `- ${d.title}: ${d.text} ${d.url}`)];
    const file = await save.saveFile(ctx, save.fileName(f.handle || f.name, 'sponsor pitches', time.today(ctx), '.txt'), all.join('\n'));
    return { pitches, disclosure, template: !named.length, file, ai: r.ai, ...(r.ai ? {} : { sample: true }) };
  },
  view(out) {
    return views.blocks(
      views.metric('Sponsor pitches', `${out.template ? 'A template' : `${out.pitches.length} drafts`}`, out.template ? 'Name the brands you already use to get one for each.' : out.pitches.map((p) => p.brand).join(', ')),
      ...out.pitches.map((p) => views.copy(`To ${p.brand}${p.to ? ` (${p.to})` : ''}`, `Subject: ${p.subject}\n\n${p.email}`)),
      views.text('Find the partnerships email on the brand\'s own site (often under Contact, Press or Affiliates). Send one at a time from your own email, and follow up once after a week. Stop at a no.'),
      views.table([{ key: 'title', label: 'If they say yes' }, { key: 'text', label: 'What to do' }, { key: 'url', label: 'Source' }], out.disclosure),
      views.file(out.file, 'All pitches (text)'),
    );
  },
};
