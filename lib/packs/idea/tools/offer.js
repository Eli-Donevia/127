// One-page offer draft: who it's for, the problem in their words, what the member does, how it works,
// what's included, the price per job and the first-customer offer, all from what the member typed.
// A printable page and plain text to paste. No results promised, no numbers, ratings or testimonials
// the member didn't type (Legal L76): code only, so nothing is added.

const { views, save, time } = require('../../_kit');
const U = require('../lib/util');
const K = require('../lib/idea');

const { esc } = U;

const { OFFER_PROPS, offerText } = require('../lib/offer');

module.exports = {
  name: 'idea.offer_draft',
  title: 'Draft a one-page offer',
  description: 'A one-page offer from your words: who it is for, the problem, what you do, how it works, the price per job and a first-customer offer, as a printable page and text.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: { type: 'object', required: ['who', 'what'], properties: OFFER_PROPS },
  output: { type: 'object', required: ['text', 'file'], properties: { offer: { type: 'object' }, text: { type: 'string' }, missing: { type: 'array' }, problems: { type: 'array' }, file: { type: 'object' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const o = K.offerOf(input, m);
    // Their own words are kept, but a claim we'd never write (a promised result, an earnings line)
    // is pointed out so they can change it.
    const problems = U.everyString(o).flatMap((s) => U.claims(s, '').blocked.map((b) => `"${U.fit(s, 60)}" reads as ${b}. Promise only what you control.`));
    const missing = [!o.price && 'a price per job', !o.contact && 'your email', !o.stepsTyped && 'how it works (we used three plain steps)', !o.problem && 'the problem in their words'].filter(Boolean);
    const body = [
      `<div class="band"><h1>${esc(o.name || o.what)}</h1><p>For ${esc(o.who)}</p></div>`,
      o.problem ? `<h2>The problem</h2><p>${esc(o.problem)}</p>` : '',
      `<h2>What I do</h2><p>${esc(o.what)}</p>`,
      `<h2>How it works</h2><ol>${o.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`,
      o.included.length ? `<h2>What's included</h2><ul class="checks">${U.li(o.included)}</ul>` : '',
      `<h2>Price</h2><p class="card"><b>${esc(o.price || '[your price per job]')}</b>${o.first_offer ? `<br>For my first customers: ${esc(o.first_offer)}` : ''}</p>`,
      `<h2>Start</h2><p>${esc(o.contact || '[your email]')}</p>`,
    ].filter(Boolean).join('\n');
    const html = U.page({ title: o.name || o.what, seed: input.color, body, description: `Offer for ${o.who}` });
    const file = await save.saveFile(ctx, save.fileName(o.name || m.idea, 'offer', time.today(ctx), '.html'), html);
    return { offer: o, text: offerText(o), missing, problems, file };
  },
  view(out) {
    return views.blocks(
      views.metric('Your offer', out.offer.name || out.offer.what, `For ${out.offer.who}${out.offer.price ? `, ${out.offer.price}` : ''}`),
      views.copy('Offer (text)', out.text),
      out.problems.length ? views.text(`Check these lines: ${out.problems.join(' ')}`) : null,
      out.missing.length ? views.text(`Still to add: ${out.missing.join(', ')}.`) : null,
      views.text('Show it at the end of a conversation, after they have told you about the problem. Then ask for a commitment: a first booking, a deposit or their email to be first.'),
      views.file(out.file, 'Offer (printable page)'),
    );
  },
};
