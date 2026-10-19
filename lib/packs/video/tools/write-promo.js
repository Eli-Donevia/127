// Writes the script for a promo (your offer in 15 to 30 seconds) or a faceless short (your points,
// one big line at a time), as plain labelled lines you can edit before it's rendered. Only facts you
// gave (or your brain has) go in: no reviews, numbers or results you didn't give us.

const { ai, text, views } = require('../../_kit');
const { bizOf, TALK } = require('../lib/sample');
const { parse } = require('../lib/scenes');

const SCHEMA = {
  type: 'object',
  properties: { scripts: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['title', 'text'] } } },
  required: ['scripts'],
};

// The sample faceless points come from the sample talk, so even the demo says something useful.
const SAMPLE_POINTS = ['Start homework with one easy win', 'Check the first two answers, not the whole page', 'Twenty minutes of reading out loud, and they pick the book'];

// "a free 20 minute reading check, then weekly sessions" -> "free 20 minute reading check"
function shortOffer(b) {
  const first = String(b.offer || '').split(/,|\bthen\b|;|\.\s/)[0].replace(/^(a|an|the|our|my)\s+/i, '').trim();
  return first.length <= 44 ? first : first.split(' ').slice(0, 6).join(' ');
}

function promoTemplate(b, input, v) {
  const what = text.clip(b.what || b.niche || 'what you do', 70);
  const city = b.city;
  const offer = shortOffer(b);
  const seed = `${b.name}|${v}`;
  const aud = String(b.audience || '').split(/,| who | with /)[0].trim();
  const hook = text.pickBy(seed, [
    offer ? `Have you tried a ${offer}?` : `Looking for ${what.split(',')[0]}?`,
    aud ? `${text.sentenceCase(aud)}, this is for you` : `Looking for ${what.split(',')[0]}${city ? ` in ${city}` : ''}?`,
    `Looking for ${what.split(',')[0].split(' for ')[0]}${city ? ` in ${city}` : ''}?`,
  ]);
  const points = [];
  if (offer) points.push(`Start with a ${offer}`);
  else if (b.what) points.push(text.sentenceCase(text.clip(b.what.split(',')[0], 46)));
  if (/online/i.test(b.what || '') && /person/i.test(b.what || '')) points.push('In person or online');
  else if (city) points.push(`Right here in ${city}`);
  if (b.priceText) points.push(`From ${b.priceText}${/session|lesson|visit|class/i.test(b.offer || '') ? ' a session' : ''}`);
  const cta = offer ? `Book your ${offer.replace(/^(free|a|an)\s+/i, (m) => (/free/i.test(m) ? 'free ' : ''))}` : 'Book your first visit';
  const where = b.website ? b.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : b.instagram ? `@${b.instagram}` : '';
  return [
    `HOOK: ${hook}`,
    `OFFER: ${b.name || 'Your business'} | ${text.sentenceCase(String(b.what || offer).split(',')[0].trim())}`,
    ...points.slice(0, 3).map((p) => `POINT: ${p}`),
    `CTA: ${text.sentenceCase(text.clip(cta, 48))}${where ? ` | ${where}` : ''}`,
  ].join('\n');
}

function facelessTemplate(b, input, v, points) {
  const topic = input.topic || (b.what ? `${b.what.split(',')[0]}` : 'this');
  const n = points.length;
  const hook = text.pickBy(`${topic}|${v}`, [`${n} things that change ${text.clip(topic, 40)}`, `Try ${n === 1 ? 'this' : `these ${n}`} tonight`, `What I tell every family first`]);
  const where = b.instagram ? `@${b.instagram}` : b.website ? b.website.replace(/^https?:\/\//, '') : '';
  return [`HOOK: ${hook}`, ...points.map((p) => `LINE: ${text.clip(p, 90)}`), `CTA: Follow for more${where ? ` | ${where}` : ''}`].join('\n');
}

module.exports = {
  name: 'video.write_promo',
  title: 'Write the video script',
  description: 'Writes a short video script as plain lines you can edit: a hook, your offer, up to three points and a call to action (promo), or a hook and your points one line at a time (faceless short).',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      kind: { type: 'string', title: 'Kind', enum: ['promo', 'faceless'], default: 'promo' },
      offer: { type: 'string', title: 'Your offer', maxLength: 200 },
      audience: { type: 'string', title: 'Who it is for', maxLength: 160 },
      topic: { type: 'string', title: 'Topic (faceless short)', maxLength: 160 },
      points: { type: 'string', title: 'Your points, one per line (faceless short)', maxLength: 1500 },
      seconds: { type: 'integer', title: 'Length in seconds', minimum: 10, maximum: 60, default: 20 },
      variants: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
    },
  },
  output: {
    type: 'object',
    properties: { scripts: { type: 'array' }, ai: { type: 'boolean' }, sample: { type: 'boolean' } },
    required: ['scripts'],
  },
  async run(input, ctx) {
    const b = bizOf(ctx, input);
    const kind = input.kind || 'promo';
    const n = input.variants || 1;
    let points = String(input.points || '').split(/\r?\n/).map((x) => text.oneLine(x.replace(/^[-*\d.)\s]+/, ''))).filter(Boolean).slice(0, 5);
    if (kind === 'faceless' && !points.length) {
      if (b.sampleBiz || ctx.sample) points = SAMPLE_POINTS;
      else throw new Error('Add the points you want to make, one per line.');
    }
    const fallback = () => ({
      scripts: Array.from({ length: n }, (_, v) => ({ title: kind === 'faceless' ? `Faceless short ${v + 1}` : `Promo ${v + 1}`, text: kind === 'faceless' ? facelessTemplate(b, input, v, points) : promoTemplate(b, input, v) })),
    });
    const format = kind === 'faceless'
      ? 'Lines: HOOK: (max 8 words), then LINE: one per point (max 14 words each, in the member\'s words), then CTA: action | handle or site.'
      : 'Lines: HOOK: (max 9 words), OFFER: business name | what it is, POINT: up to 3 (max 7 words each, only facts given), PRICE: (only if a price was given), CTA: action | website or handle.';
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short vertical video scripts as labelled plain-text lines. Use only the facts given. No reviews, ratings, client counts, results or promises of views, leads or sales.',
      prompt: [`Write ${n} ${kind === 'faceless' ? 'faceless short' : 'promo'} script(s), about ${input.seconds || 20} seconds each.`, format, `Business:\n${require('../../_kit').brain.describe(b)}`, input.offer ? `Offer: ${input.offer}` : '', input.audience ? `Audience: ${input.audience}` : '', points.length ? `Points:\n${points.join('\n')}` : '', 'Return scripts: [{ title, text }] where text is the lines joined by newlines.'].filter(Boolean).join('\n\n'),
      schema: SCHEMA,
      fallback,
      accept: (d) => ai.cleanCopy(d) && d.scripts.every((s) => parse(s.text).length >= 3),
    });
    const scripts = data.scripts.slice(0, n).map((s, i) => ({ id: `script-${i + 1}`, title: text.clip(s.title, 60), kind, seconds: input.seconds || 20, text: String(s.text).trim() }));
    ctx.log(`Wrote ${scripts.length} ${kind} script${scripts.length > 1 ? 's' : ''}`);
    return { scripts, ai: usedAi, sample: !!b.sampleBiz };
  },
  view(out) {
    return out.scripts.map((s) => views.copy(s.title, s.text));
  },
};
