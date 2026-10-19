// Answer one reply from a contractor. Kit outreach.answer reads the intent; kit talk adds auto-replies,
// the wrong person, "send me info" and "let me think"; lib/close matches the trade's own worries
// (data/niche.json objections) and the questions owners ask, with the member's real price said once.
// For a worry or a question the templates can't answer, AI rewrites the answer around their exact
// words (the template is the fallback). Saved on the lead: Do my day hands out msg.answer.

const kit = require('../../_kit');
const { text, views, ai, files, save, brain, outreach, money } = kit;
const NICHE = require('../data/niche.json');
const talk = require('../../_kit/talk');
const close = require('../lib/close');
const prices = require('../lib/prices');
const { shortName } = require('../lib/plan');

const REMIND = {
  yes: (s) => `Send ${s} the missed-call plan`,
  away: (s) => `Send ${s} your answer (they're back)`,
  later: (s) => `Check back with ${s}`,
  covered: (s) => `Check back with ${s}`,
  think: (s) => `Check back with ${s}`,
};

// What AI may write for this pack: no brackets, no AI talk, no promises, the price kept when asked.
const okAnswer = (n, kind) => (t) =>
  ai.cleanCopy(t) && !/[[\]]/.test(t) && t.length >= 40 && t.length <= 800 && !/\b(AI|A\.I\.|artificial intelligence|chat ?bot|guarantee[ds]?)\b/i.test(t) && (kind !== 'price' || t.includes(money.usd(n.setup)));

module.exports = {
  name: 'frontdesk.answer_reply',
  title: 'Answer a reply',
  description: 'Reads what a contractor wrote back, says what they meant and writes a short answer with one next step, using your real price and the answers to the worries owners have. Saves it on the business in your Pipeline; a stop marks them lost.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  credits: 3,
  input: {
    type: 'object',
    required: ['business', 'reply'],
    properties: {
      business: { type: 'string', maxLength: 120 },
      website: { type: 'string', maxLength: 300 },
      reply: { type: 'string', maxLength: 4000 },
      planSent: { type: 'boolean' },
      city: { type: 'string', maxLength: 120 },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
    },
  },
  output: {
    type: 'object',
    required: ['kind', 'label', 'answer', 'next', 'line'],
    properties: { kind: { type: 'string' }, label: { type: 'string' }, answer: { type: 'string' }, next: { type: 'string' }, line: { type: 'string' }, saved: { type: 'boolean' }, lost: { type: 'boolean' }, ai: { type: 'boolean' } },
  },
  timeoutSec: 90,
  async run(input, ctx) {
    const reply = String(input.reply || '').trim();
    if (!reply) throw new Error('Paste what they wrote back.');
    const typed = { name: input.business, website: input.website };
    const found = await talk.findLead(ctx, typed);
    const rows = found.rows;
    const blank = !found.lead.name || /^\[.*\]$/.test(found.lead.name);
    const lead = { ...found.lead, name: blank ? text.oneLine(String(input.business || '')).slice(0, 120) || 'This business' : found.lead.name };
    const s = shortName(lead.name);
    const br = brain.brainOf(ctx, {});
    const member = { first: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), city: text.plain(input.city || lead.city || br.city || '') };

    // Kit first, then what it can't tell apart, then the trade's worries.
    const kitAnswer = outreach.answer({ lead: { name: lead.name, city: member.city }, service: NICHE.service, sender: { first: member.first, business: member.business }, reply });
    const extra = talk.extraIntent(reply);
    const worry = close.worryOf(reply);
    const kind = close.kindOf({ intent: kitAnswer.intent, extra, worry, reply });
    const n = prices.offerNumbers({}, ctx);
    const clients = talk.wonCount(rows, 'frontdesk');
    const founding = clients < NICHE.first_clients.founding_count;
    const planSent = !!input.planSent || !!(lead.data && lead.data.planMade);
    const base = close.answerFor({ kind, reply, lead, member, n, founding, ctx, worry, intent: kitAnswer.intent, planSent });

    // AI for the answers templates can't fit to their words: a worry, an open question, the unclear.
    let answer = base.answer;
    let usedAi = false;
    if (kind === 'worry' || kind === 'question' || kind === 'other' || (kind === 'price' && base.topic)) {
      const signer = talk.signerOf(reply);
      const [d1, d2] = talk.callDays(ctx);
      const P = prices.priceSay(n, { founding });
      const o = worry >= 0 ? NICHE.objections[worry] : null;
      const tail = member.first ? `\n\n${member.first}` : '';
      const draft = tail && base.answer.endsWith(tail) ? base.answer.slice(0, -tail.length) : base.answer;
      const res = await ai.aiText(ctx, {
        task: 'write',
        system: 'You write short answers for someone who sets up missed-call text back and online booking for owner-run contractors (plumbers, HVAC, roofers, electricians), on the contractor\'s own phone number and accounts. Plain and warm, like a neighbor who knows phones. Never say AI, robot or automation unless they used the word; never promise results; never state a fact about their business that isn\'t given; no brackets or placeholders. End with exactly one next step, as a question.',
        prompt: [
          `They wrote:\n"""${text.clip(reply, 1500)}"""`,
          `Their business: ${lead.name}.${lead.facts.length ? ` What I noticed on their website: ${lead.facts.slice(0, 3).join('; ')}.` : ''}`,
          `What I offer: setup on their own accounts, then monthly care. ${kind === 'price' || worry === 2 ? `The price, said once: ${P.base} ${P.founding || P.tools}` : 'Don\'t bring up the price.'}`,
          o ? `Their worry ("${o.objection}") and how I answer it: ${o.reply}` : '',
          `Answers owners often need: ${close.QA.map((q) => q.a({ s, soon: talk.onDay(ctx, 2).label })).join(' ')}`,
          planSent ? 'They already have my one-page missed-call plan.' : `The free next step: a one-page missed-call plan written from their website, ready by ${talk.onDay(ctx, 2).label}.`,
          `Days I can talk for 15 minutes: ${d1} or ${d2}.`,
          `My draft (keep its facts and its next step; make it answer exactly what they said):\n"""${draft.replace(/\[[^\]]*\]\s*/g, '')}"""`,
          `Write the answer in 2 to 4 short sentences, under 90 words${signer ? `, starting "Hi ${signer},"` : ''}. If they asked something these facts don't answer, say you'll find out and tell them on the call. Don't sign it.`,
        ].filter(Boolean).join('\n\n'),
        maxTokens: 400,
        accept: okAnswer(n, kind),
        fallback: () => null,
      }).catch(() => ({ text: '', ai: false }));
      if (res && res.ai && res.text) {
        answer = member.first ? `${res.text}\n\n${member.first}` : res.text;
        usedAi = true;
      }
    }
    const placeholder = /\[[^\]\n]{2,60}\]/.test(answer);

    const away = kind === 'away';
    const stop = kind === 'stop';
    const pipe = await talk.saveReply(ctx, lead, { pack: 'frontdesk', reply, answer: stop ? '' : answer, stop, away });

    let followUp = null;
    let calendar = null;
    const remind = kind === 'yes' && planSent ? null : REMIND[kind];
    if (!stop && base.days != null && remind) {
      followUp = talk.onDay(ctx, base.days);
      try {
        const ics = files.ics([{ uid: `frontdesk-${text.slug(lead.key || s, 40)}-${followUp.date}@127group.io`, title: remind(s), date: followUp.date, description: `${base.next}\n\n${answer}` }], { name: 'Front desk follow-ups', now: kit.time.nowMs(ctx) });
        calendar = await save.saveFile(ctx, save.fileName(s, 'check back', '.ics'), ics, 'text/calendar');
      } catch {
        calendar = null;
      }
    }
    return {
      business: lead.name,
      inPipeline: lead.inPipeline,
      stage: lead.stage || '',
      kind,
      label: base.label,
      topic: base.topic || '',
      quote: text.clip(text.oneLine(reply), 220),
      answer: stop ? '' : answer,
      next: base.next,
      followUp,
      calendar,
      email: lead.email || '',
      saved: pipe.saved,
      lost: pipe.lost,
      line: pipe.line,
      hint: lead.inPipeline ? '' : talk.missHint(rows, typed),
      ai: usedAi,
      placeholder,
      priceFrom: n.saved ? 'offer' : 'band',
      founding,
      clients,
    };
  },
  view(out) {
    const meant = `What they meant: ${out.label}${out.topic ? ` (a worry about ${out.topic})` : ''}.`;
    return views.blocks(
      views.text(`They wrote: "${out.quote}"`),
      views.text(meant),
      out.kind === 'stop'
        ? views.text('No answer: they asked you to stop. Not on email, not by phone, not in person.')
        : views.copy(out.kind === 'away' && out.followUp ? `Your answer (send it on ${out.followUp.label})` : 'Your answer', out.answer, out.email && out.kind !== 'away' ? { to: out.email } : undefined),
      out.placeholder ? views.text('Fill in the part in brackets before you send. Do my day keeps Send off until it\'s gone.') : null,
      views.text(`Next: ${out.next}`),
      out.kind === 'price' && out.priceFrom === 'band' ? views.text('That price is the middle of the usual range. Run "Your offer" to set your own, and every answer uses it.') : null,
      out.followUp && out.kind !== 'away' ? views.text(`Check back on ${out.followUp.label}.`) : null,
      views.file(out.calendar, 'Reminder for your calendar'),
      views.text(out.line),
      out.hint ? views.text(out.hint) : null,
    );
  },
};
