// Landing page: one static HTML page for the idea, from the member's offer words, to share in a bio
// or a message while testing. No form posts anywhere and no scripts: the button is a mailto link and
// the email address is shown as text too, so the member gets replies in their own inbox and no
// visitor data is collected. Their words only: no numbers, ratings, reviews or results they didn't
// type (Legal L76). Code only.

const { views, save, time } = require('../../_kit');
const U = require('../lib/util');
const K = require('../lib/idea');
const { OFFER_PROPS } = require('../lib/offer');

const { esc } = U;

module.exports = {
  name: 'idea.landing_page',
  title: 'Make a test landing page',
  description: 'One simple page for your idea from your offer words, with an email button and your address shown as text. No form, no scripts, nothing collected: replies go to your inbox.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    required: ['who', 'what', 'email'],
    properties: {
      ...OFFER_PROPS,
      headline: { type: 'string', maxLength: 90, title: 'Headline (optional)', description: 'Leave empty to use what you do' },
      button: { type: 'string', maxLength: 40, default: 'Email me to be first', title: 'Button words' },
    },
  },
  output: { type: 'object', required: ['file', 'mailto'], properties: { headline: { type: 'string' }, mailto: { type: 'string' }, email: { type: 'string' }, problems: { type: 'array' }, file: { type: 'object' } } },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const o = K.offerOf(input, m);
    const email = String(input.email || '').trim();
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(email)) throw new Error('Add the email address people should write to.');
    const headline = U.fit(input.headline || o.what, 90);
    const subject = `About ${U.fit(o.name || m.idea, 60)}`;
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    const button = U.fit(input.button || 'Email me to be first', 40);
    const problems = U.everyString({ headline, ...o }).flatMap((s) => U.claims(s, '').blocked.map((b) => `"${U.fit(s, 60)}" reads as ${b}.`));
    const body = [
      `<section class="band hero"><h1>${esc(headline)}</h1><p>For ${esc(o.who)}</p><p><a class="btn" href="${esc(mailto)}">${esc(button)}</a></p></section>`,
      o.problem ? `<h2>Sound familiar?</h2><p>${esc(o.problem)}</p>` : '',
      `<h2>How it works</h2><ol class="steps">${o.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`,
      o.included.length ? `<h2>What you get</h2><ul class="checks">${U.li(o.included)}</ul>` : '',
      o.price ? `<h2>Price</h2><p class="card"><b>${esc(o.price)}</b>${o.first_offer ? `<br>${esc(o.first_offer)}` : ''}</p>` : o.first_offer ? `<p class="card">${esc(o.first_offer)}</p>` : '',
      `<h2>Interested?</h2><p><a class="btn" href="${esc(mailto)}">${esc(button)}</a></p><p>Or write to <b>${esc(email)}</b></p>`,
      `<p class="muted small">${esc(o.name || 'This is a new idea')} · ${esc(time.longDate(time.today(ctx)))}</p>`,
    ].filter(Boolean).join('\n');
    const css = '.hero{text-align:center;padding:40px 20px}.hero h1{font-size:32px}.btn{display:inline-block;background:var(--onp);color:var(--p);padding:12px 22px;border-radius:99px;font-weight:700;text-decoration:none;margin-top:10px}main>p .btn{background:var(--p);color:var(--onp)}.steps li{margin:6px 0}@media (max-width:600px){.hero h1{font-size:25px}}';
    const html = U.page({ title: headline, seed: input.color, body, css, description: `${headline}. For ${o.who}.` });
    const file = await save.saveFile(ctx, save.fileName(o.name || m.idea, 'landing page', time.today(ctx), '.html'), html);
    return { headline, mailto, email, problems, file };
  },
  view(out) {
    return views.blocks(
      views.metric('Test landing page', out.headline, `Replies go to ${out.email}. No form, nothing collected.`),
      out.problems.length ? views.text(`Check these lines: ${out.problems.join(' ')}`) : null,
      views.text('Put it online free with a site builder\'s "upload HTML" option, or share the file. Count the emails you get as commitments in your log.'),
      views.file(out.file, 'Landing page (HTML)'),
    );
  },
};
