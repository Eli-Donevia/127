// Before a coaching call: what to check first, the questions to ask, the price said once, answers to
// the worries this person raised (from their reply or your notes) and the usual ones, and the close.
// The sales pack then writes the call script and, after the call, the proposal, from the same
// options at your step on the first-clients ladder. Nothing here promises a result.

const { views, text, time, money } = require('../../_kit');
const C = require('../../_kit/common');

const { plain, clip } = text;
const { usd } = money;
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');

// "Three-month coaching program | $612 | 12 weekly sessions with a recap after each" (sales options).
function optionLines(N, offer, rung) {
  return N.quote.packages
    .map((p) => ({ p, pp: C.packagePrice(N, offer, rung, p) }))
    .sort((a, b) => b.pp.total - a.pp.total)
    .slice(0, 3)
    .map(({ p, pp }) => {
      const name = p.label.length <= 40 ? p.label : p.label.split(',')[0];
      const price = pp.qty > 1 ? usd(pp.total) : `${usd(pp.each)} per ${pp.unit}`;
      return `${name} | ${price} | ${p.detail.split(/,\s*/).join('; ')}`;
    });
}

function callPrepTool(N) {
  const K = N.call;
  return {
    name: 'coaching.prep_call',
    title: 'Prep the call',
    description: 'What to check before a call, the questions to ask, your price said once, answers to the worries they raised and the close, from what your Pipeline knows about them.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['who'],
      properties: {
        who: { type: 'string', maxLength: 120, title: 'Who the call is with', description: 'Pick from your Pipeline or type a name' },
        when: { type: 'string', maxLength: 60, title: 'Call day and time (optional)', description: 'Like "Thursday at 6pm"' },
        result: { type: 'string', maxLength: 160, title: 'What they want, in their words (optional)' },
        notes: { type: 'string', format: 'textarea', maxLength: 2000, title: 'What you know about them (optional)', description: 'One point per line, like "Manages 4 people since June"' },
        email: { type: 'string', maxLength: 120, title: 'Their email (optional)' },
        price: { type: 'string', maxLength: 10, title: 'Your full price per session (optional)', description: 'Left empty, the price from your Offer builder' },
      },
    },
    output: {
      type: 'object',
      required: ['name', 'questions', 'close', 'after', 'options'],
      properties: { name: { type: 'string' }, notes: { type: 'string' }, options: { type: 'string' }, price: { type: 'number' }, questions: { type: 'array' }, worries: { type: 'array' }, close: { type: 'string' }, after: { type: 'array' } },
    },
    async run(input, ctx) {
      const name = clip(plain(input.who || ''), 80);
      if (!name) throw new Error('Add who the call is with (pick them from your Pipeline).');
      const me = C.who(ctx, input);
      const lead = await C.findLead(ctx, N.id, name);
      const offer = C.offerOf(N, { price: C.priceOf(ctx, N, input) });
      const rung = await C.rungOf(ctx, N);
      const v = C.replyVars(ctx, N, me, offer, rung);
      const want = plain(input.result || '');
      const heard = [
        lead && lead.reply ? `They wrote: "${clip(plain(lead.reply), 300)}"` : '',
        ...(lead && Array.isArray(lead.facts) ? lead.facts.map(plain) : []),
        want ? `Wants: ${want}` : '',
        ...C.linesOf(input.notes, 12),
      ].filter(Boolean);
      const words = `${(lead && lead.reply) || ''} ${input.notes || ''} ${want}`;
      const all = N.replies.objections || [];
      const raised = all.filter((o) => new RegExp(o.match, 'i').test(words));
      const worries = [...raised, ...all.filter((o) => !raised.includes(o))].slice(0, 5).map((o) => ({ worry: o.label, answer: C.fill(o.answer, v), raised: raised.includes(o), next: C.fill(o.next, v) }));
      const pkg = C.packageOf(N, N.quote.default);
      const close = C.fill(K.close, { package: `a ${lowerFirst(pkg.pick)}` });
      const price = C.rungPrice(offer, rung);
      const options = optionLines(N, offer, rung);
      const first = C.firstWord(name);
      const when = plain(input.when || '');
      const notes = clip([...heard, `Price said once: ${C.rateText(N, offer, rung)}.`].join('\n'), 3000);
      let saved = { saved: false };
      const patch = { stage: 'call', note: clip(`Call${when ? ` ${when}` : ''} booked ${time.shortDate(time.today(ctx))}.`, 1000), ...(input.email ? { links: { ...((lead && lead.links) || {}), email: String(input.email).trim() } } : {}) };
      saved = await C.saveLead(ctx, N.id, lead, patch, { name, source: 'Coaching: call' });
      return {
        name,
        first,
        when,
        email: String(input.email || (lead && lead.links && lead.links.email) || '').trim(),
        heard,
        check: K.check_first,
        questions: K.questions,
        price,
        price_text: C.rateText(N, offer, rung),
        worries,
        close,
        options: options.join('\n'),
        option_list: options.map((o) => o.split(' | ').slice(0, 2).join(': ')),
        notes,
        goals: want,
        title: `Coaching plan for ${first}`,
        refer: N.rules.find((r) => /refer/i.test(r)) || '',
        after: [
          { label: 'Send a proposal after the call', proposal: true },
          { label: 'No proposal yet', proposal: false },
        ],
        saved,
      };
    },
    view(out) {
      const s = out.saved || {};
      return views.blocks(
        views.metric(`Call with ${out.first}`, out.when || 'Prep sheet', s.saved ? (s.other ? 'In your Pipeline from another workflow: move them to Call on that row.' : `In your Pipeline at ${s.stage === 'call' ? 'Call' : s.stage}.`) : ''),
        out.heard.length ? views.text(`What you know: ${out.heard.join(' ')}`) : views.text('Nothing in your Pipeline about them yet: the first two questions do the work.'),
        views.text(`Check first: ${out.check.join(' ')}`),
        views.copy('Questions to ask, in order', out.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')),
        views.copy('Your price, said once', out.price_text),
        views.table(
          [
            { key: 'worry', label: 'If they say' },
            { key: 'answer', label: 'You say' },
          ],
          out.worries,
        ),
        views.copy('The close', out.close),
        views.text(`Options at your price: ${out.option_list.join('. ')}.`),
        out.refer ? views.text(out.refer) : null,
      );
    },
  };
}

module.exports = { callPrepTool, optionLines };
