// local.flyer_copy: three versions of flyer copy built from the member's real facts and offer, as
// plain text they can edit before the flyer is drawn.

const { text, ai, views } = require('../../_kit');
const F = require('../lib/facts');

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const { BIZ } = require('../lib/common');
const C = require('../lib/copy');

const ANGLES = [
  { label: 'Convenience', lead: (f) => f.group.headlines[0] },
  { label: 'Result', lead: (f) => f.group.headlines[1] || f.group.headlines[0] },
  { label: 'Neighbor', lead: (f) => (f.city ? `Your neighbor in ${f.city} for ${String(f.what || f.group.label).toLowerCase()}.` : f.group.headlines[2] || f.group.headlines[0]) },
];

function subOf(f, i) {
  const where = f.area || f.city;
  const what = f.what || f.group.label;
  const opts = [
    cap(`${text.clip(what, 50)}${where ? ` around ${where}` : ''}${f.mobile ? `, ${String(f.group.mobile_line || 'at your place').toLowerCase()}` : ''}.`),
    `${f.firstName ? `I'm ${f.firstName}, and I` : 'We'} do ${String(what).toLowerCase()}${where ? ` in ${where}` : ''}. Ask for a price before you book.`,
    `Book a time that suits you${where ? ` anywhere in ${where}` : ''}. ${f.services.length && f.services[0].price != null ? `${F.serviceLine(f.services[0])}.` : ''}`.trim(),
  ];
  return opts[i % opts.length];
}

function bulletsOf(f) {
  const typed = (f.services || []).filter((s) => s.name).map(F.serviceLine);
  return (typed.length ? typed : f.group.bullets || []).slice(0, 3);
}

const SCHEMA = {
  type: 'object',
  required: ['options'],
  properties: { options: { type: 'array', items: { type: 'object', required: ['headline', 'sub'], properties: { headline: { type: 'string', maxLength: 70 }, sub: { type: 'string', maxLength: 130 } } } } },
};

module.exports = {
  name: 'local.flyer_copy',
  title: 'Write flyer copy',
  description: 'Writes three versions of flyer copy from your services, prices, area and offer: headline, one line, three points, the offer and the button. Edit the one you like before it is printed.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 2,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      ...BIZ,
      offer: { type: 'string', title: 'Your offer (optional)', maxLength: 60, description: 'A real offer you will honor, like "First visit $20 off" or "Free pet hair removal this month"' },
      area: { type: 'string', title: 'Streets or neighborhood (optional)', maxLength: 80 },
    },
  },
  output: {
    type: 'object',
    required: ['draft', 'options'],
    properties: {
      draft: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, text: { type: 'string' } } } },
      options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, text: { type: 'string' }, headline: { type: 'string' } } } },
      sample: { type: 'boolean' },
      ai: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, input);
    const bullets = bulletsOf(f);
    const cta = (F.actionLink(f) || {}).label || '';
    const offerText = text.clip(text.plain(input.offer || f.founding || ''), 60);
    const fallback = { options: ANGLES.map((a, i) => ({ headline: a.lead(f), sub: subOf(f, i) })) };
    const res = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write flyer headlines for a small local service business, from the facts given only. Headline under 60 characters, concrete and plain. One supporting line under 120 characters. No claims you cannot check (no "best", no ratings, no years), no prices that were not given, no urgency tricks.',
      prompt: `Business: ${f.name}. What: ${f.what || f.group.label}. Area: ${f.area || f.city || 'not given'}. Mobile: ${f.mobile ? 'yes' : 'no'}. Services: ${bullets.join('; ')}. Offer: ${offerText || 'none'}.\nWrite 3 options (headline, sub): one about convenience, one about the result, one about being a local neighbor.`,
      schema: SCHEMA,
      fallback: () => fallback,
      accept: (d) => ai.cleanCopy(d) && d.options.length >= 3,
    });
    const opts = (res.data || fallback).options.slice(0, 3);
    const options = opts.map((o, i) => {
      const c = { headline: o.headline, sub: o.sub, bullets, offerText, cta };
      return { label: `${ANGLES[i].label}: ${text.clip(o.headline, 50)}`, headline: o.headline, text: C.toText(c) };
    });
    return { draft: options.slice(0, 1), options, sample: !f.hasName, ai: !!res.ai };
  },
  view(out) {
    return views.blocks(views.text('The first version goes to the next step for you to edit. Copy a headline from the others if you like it better.'), out.options.map((o) => views.copy(o.label, o.text)));
  },
};
