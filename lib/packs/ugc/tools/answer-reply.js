// Answer one reply from a brand. Kit outreach.answer reads the intent; kit talk adds auto-replies,
// the wrong person, "send me info" and "let me think"; lib/close matches the brand's own worries
// (data/niche.json objections: budget, portfolio, followers, gifted, results, usage, claims, posting)
// and the questions brands ask, with the member's real price said once (lib/offer). For a worry or a
// question the templates can't answer, AI rewrites the answer around their exact words (the template
// is the fallback), and only when it keeps the honesty rules. Saved on the brand: Do my day hands out
// msg.answer next.

const kit = require('../../_kit');
const { text, views, ai, files, save, brain, outreach, money, time } = kit;
const NICHE = require('../data/niche.json');
const U = require('../lib/ugc');
const talk = require('../../_kit/talk');
const close = require('../lib/close');
const offer = require('../lib/offer');

const REMIND = {
  yes: (s) => `Send ${s} the concept`,
  away: (s) => `Send ${s} your answer (they're back)`,
  later: (s) => `Check back with ${s}`,
  covered: (s) => `Check back with ${s}`,
  think: (s) => `Check back with ${s}`,
  worry: (s) => `Check back with ${s}`,
  price: (s) => `Check back with ${s}`,
};

// What AI may write here: no brackets, no AI talk, the honesty rules kept, the price kept when asked.
const okAnswer = (n, kind) => (t) =>
  ai.cleanCopy(t) && !/[[\]]/.test(t) && t.length >= 40 && t.length <= 800 && !/\b(AI|A\.I\.|artificial intelligence|chat ?bot)\b/i.test(t) && !close.breaksRules(t) && (kind !== 'price' || t.includes(money.usd(n.video)));

// The fact the pitch opened on, without its "(read from their store on ...)" date.
const factOf = (lead) => text.oneLine(String((lead.facts || [])[0] || '')).replace(/\s*\((read|checked)[^)]*\)\s*$/i, '');

module.exports = {
  name: 'ugc.answer_reply',
  title: 'Answer a reply',
  description: 'Reads what a brand wrote back, says what they meant and writes a short answer with one next step, using your real prices and honest answers to the worries brands have. Saves it on the brand in your Pipeline; a stop marks them lost.',
  kind: 'ai',
  risk: 'draft',
  tasks: ['write'],
  needs: [],
  credits: 3,
  input: {
    type: 'object',
    required: ['brand', 'reply'],
    properties: {
      brand: { type: 'string', maxLength: 120 },
      reply: { type: 'string', maxLength: 4000 },
      store: { type: 'string', maxLength: 300 },
      conceptSent: { type: 'boolean' },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
      site: { type: 'string', maxLength: 300 },
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
    const typed = { name: input.brand, website: input.store };
    const found = await talk.findLead(ctx, typed);
    const rows = found.rows;
    const blank = !found.lead.name || /^\[.*\]$/.test(found.lead.name);
    const lead = { ...found.lead, name: blank ? text.oneLine(String(input.brand || '')).slice(0, 120) || 'This brand' : found.lead.name };
    const s = close.shortName(lead.name);
    const br = brain.brainOf(ctx, {});
    const member = { first: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), site: talk.siteUrl(input.site || br.website || '') };

    // The product to talk about: the one on their row, else the one their store snapshot shows.
    const domain = talk.domainOf(lead.website) || talk.domainOf(input.store);
    const brand = U.brandFor({ lead: { ...lead, website: domain ? `https://${domain}` : lead.website }, today: time.today(ctx) });
    const productTitle = close.productOf(lead, brand);
    const product = productTitle ? U.shortTitle(productTitle) : '';

    // Kit first, then what it can't tell apart, then the brand's worries.
    const kitAnswer = outreach.answer({ lead: { name: lead.name }, service: NICHE.service, sender: { first: member.first, business: member.business }, reply });
    const extra = talk.extraIntent(reply);
    const worry = close.worryOf(reply);
    const kind = close.kindOf({ intent: kitAnswer.intent, extra, worry, reply });
    const n = offer.offerNumbers({}, ctx);
    const clients = talk.wonCount(rows, 'ugc');
    const founding = clients < NICHE.first_clients.founding_count;
    const concept = !!input.conceptSent || !!(lead.data && lead.data.conceptMade);
    // The fact their pitch opened on, as a sentence ("I saw you listed X on Sep 25."), and where their
    // email came from when this pack found it on their store.
    const fact = (brand.gaps && brand.gaps[0] && brand.gaps[0].pitch) || factOf(lead);
    const emailFrom = lead.inPipeline && lead.email && (!lead.pack || lead.pack === 'ugc') ? 'your website' : '';
    const base = close.answerFor({ kind, reply, lead, member, n, founding, ctx, worry, intent: kitAnswer.intent, concept, product, fact, emailFrom });

    // AI for the answers templates can't fit to their words: a worry, an open question, the unclear.
    let answer = base.answer;
    let usedAi = false;
    if (kind === 'worry' || kind === 'question' || kind === 'other' || (kind === 'price' && base.topic)) {
      const signer = talk.signerOf(reply);
      const [d1, d2] = talk.callDays(ctx);
      const P = offer.priceSay(n, { founding });
      const o = worry >= 0 ? NICHE.objections[worry] : null;
      const tail = member.first ? `\n\n${member.first}` : '';
      const draft = tail && base.answer.endsWith(tail) ? base.answer.slice(0, -tail.length) : base.answer;
      const prod = product || 'their best seller';
      const res = await ai
        .aiText(ctx, {
          task: 'write',
          system:
            "You write short answers for a new UGC creator: someone who films short vertical videos of a brand's product for the brand to post and run as ads. Plain, warm and direct, like a person, not an agency. Hard rules: never promise views, sales, followers or any result; never say the creator has used, tried or loves the product before they have it; never suggest hiding that a post is an ad; never state a fact about the brand that isn't given; never say AI; no brackets or placeholders. End with exactly one next step, as a question.",
          prompt: [
            `They wrote:\n"""${text.clip(reply, 1500)}"""`,
            `Their brand: ${lead.name}.${fact ? ` What I noticed on their store: ${factOf({ facts: [fact] }).replace(/[.]$/, '')}.` : ''}${product ? ` The product I'd film: ${product}.` : ''}`,
            `What I offer: ${kind === 'price' || worry === 0 || worry === 3 || worry === 5 ? `${P.base} ${P.founding || P.addons}` : "short product videos with captions, a clean version and the use in writing. Don't bring up the price."}`,
            o ? `Their worry ("${o.q}") and how I answer it: ${text.fill(o.a, { brand: s })}` : '',
            `Answers brands often need: ${close.QA.map((q) => q.a({ n, s, brand: s, product: prod, concept })).join(' ')}`,
            concept ? `They already have the free 15-second concept I made for ${prod}.` : `The free next step: a 15-second concept video for ${prod}, made from their product page, ready by ${talk.onDay(ctx, 2).label}.`,
            `Days I can do a 15-minute call: ${d1} or ${d2}.`,
            member.site ? `My portfolio: ${member.site}` : 'I have no portfolio link yet.',
            `My draft (keep its facts and its next step; make it answer exactly what they said):\n"""${draft.replace(/\[[^\]]*\]\s*/g, '')}"""`,
            `Write the answer in 2 to 4 short sentences, under 90 words${signer ? `, starting "Hi ${signer},"` : ''}. If they asked something these facts don't answer, say you'll find out and come back to them. Don't sign it.`,
          ]
            .filter(Boolean)
            .join('\n\n'),
          maxTokens: 400,
          accept: okAnswer(n, kind),
          fallback: () => null,
        })
        .catch(() => ({ text: '', ai: false }));
      if (res && res.ai && res.text) {
        answer = member.first ? `${res.text}\n\n${member.first}` : res.text;
        usedAi = true;
      }
    }
    const placeholder = /\[[^\]\n]{2,60}\]/.test(answer);

    const away = kind === 'away';
    const stop = kind === 'stop';
    const pipe = await talk.saveReply(ctx, lead, { pack: 'ugc', reply, answer: stop ? '' : answer, stop, away });

    let followUp = null;
    let calendar = null;
    const remind = kind === 'yes' && concept ? null : REMIND[kind];
    if (!stop && base.days != null && remind) {
      followUp = talk.onDay(ctx, base.days);
      try {
        const ics = files.ics([{ uid: `ugc-${text.slug(lead.key || s, 40)}-${followUp.date}@127group.io`, title: remind(s), date: followUp.date, description: `${base.next}\n\n${answer}` }], { name: 'Brand follow-ups', now: time.nowMs(ctx) });
        calendar = await save.saveFile(ctx, save.fileName(s, kind === 'yes' ? 'send the concept' : 'check back', '.ics'), ics, 'text/calendar');
      } catch {
        calendar = null;
      }
    }
    const email = lead.email || '';
    return {
      brand: lead.name,
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
      email,
      instagram: lead.instagram || '',
      product,
      concept,
      saved: pipe.saved,
      lost: pipe.lost,
      line: pipe.line,
      hint: lead.inPipeline ? '' : talk.missHint(rows, typed),
      ai: usedAi,
      placeholder,
      priceFrom: n.saved ? 'offer' : 'level',
      founding,
      clients,
    };
  },
  view(out) {
    const meant = out.kind === 'worry' && out.topic ? `What they meant: a worry about ${out.topic}.` : `What they meant: ${out.label}${out.topic ? `, with a worry about ${out.topic}` : ''}.`;
    const subject = out.product ? `Re: a short video for ${out.product}` : undefined;
    return views.blocks(
      views.text(`They wrote: "${out.quote}"`),
      views.text(meant),
      out.kind === 'stop'
        ? views.text('No answer: they asked you to stop. Not by email, not by DM, not anywhere else.')
        : views.copy(out.kind === 'away' && out.followUp ? `Your answer (send it on ${out.followUp.label})` : 'Your answer', out.answer, out.email && out.kind !== 'away' ? { to: out.email, subject } : undefined),
      out.placeholder ? views.text("Fill in the part in brackets before you send. Do my day keeps Send off until it's gone.") : null,
      views.text(`Next: ${out.next}`),
      (out.kind === 'price' || /\$\d/.test(out.answer || '')) && out.priceFrom === 'level' ? views.text('Those prices are the usual ones for a new creator. Run "Your offer" to set your own, and every answer uses them.') : null,
      out.followUp && out.kind !== 'away' ? views.text(out.kind === 'yes' ? `Send the concept by ${out.followUp.label}.` : `Check back on ${out.followUp.label}.`) : null,
      views.file(out.calendar, 'Reminder for your calendar'),
      views.text(out.line),
      out.hint ? views.text(out.hint) : null,
    );
  },
};
