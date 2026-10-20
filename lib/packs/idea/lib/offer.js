// The offer fields and text the offer draft and the landing page share.

const OFFER_PROPS = {
  idea: { type: 'string', maxLength: 140, title: 'Your idea, in one line' },
  who: { type: 'string', maxLength: 120, title: 'Who it is for' },
  problem: { type: 'string', maxLength: 200, title: 'The problem, in their words', description: 'Use the words people said in your conversations' },
  what: { type: 'string', maxLength: 300, title: 'What you do about it', description: 'Like "I cook and drop off 5 dinners every Sunday"' },
  steps: { type: 'string', format: 'textarea', maxLength: 600, title: 'How it works (optional)', description: 'Up to 5 steps, one per line' },
  included: { type: 'string', format: 'textarea', maxLength: 800, title: 'What is included (optional)', description: 'One per line' },
  price: { type: 'string', maxLength: 60, title: 'Your price per job (optional)', description: 'Like "$85 a week" or "$40 per lesson"' },
  first_offer: { type: 'string', maxLength: 160, title: 'Your first-customer offer (optional)', description: 'Only one you will keep, like "First week half price for the first 5 people"' },
  offer_name: { type: 'string', maxLength: 80, title: 'A name for it (optional)' },
  email: { type: 'string', maxLength: 120, title: 'Your email' },
  color: { type: 'string', maxLength: 7, title: 'Your color (optional)' },
};

function offerText(o) {
  return [
    o.name ? `${o.name}` : '',
    `For ${o.who}${o.problem ? ` who ${/^(are|have|need|want|can|struggle|hate|spend|don)/i.test(o.problem) ? o.problem.replace(/[.]$/, '') : `deal with ${o.problem.replace(/[.]$/, '')}`}` : ''}.`,
    o.what ? `${o.what.replace(/[.]$/, '')}.` : '',
    `How it works:\n${o.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    o.included.length ? `What's included:\n${o.included.map((x) => `- ${x}`).join('\n')}` : '',
    o.price ? `Price: ${o.price}` : 'Price: [your price per job]',
    o.first_offer ? `For my first customers: ${o.first_offer.replace(/[.]$/, '')}.` : '',
    `Questions or ready to start? ${o.contact || '[your email]'}`,
  ].filter(Boolean).join('\n\n');
}

module.exports = { OFFER_PROPS, offerText };
