// "Answer a reply" for a household pack: the member pastes what someone wrote back (a person they
// texted, a neighbor who saw a door hanger, or a partner business). What it means, a short answer
// with one next step, and the Pipeline updated so Do my day hands out the answer. A "stop" gets no
// answer and the lead is marked lost. The niche's objections (data/niche.json "objections", each
// with match words and a ready answer) answer the usual worries; kit outreach reads the intent.
// AI tailors the answer to their exact words when it can, and the written answer is the fallback.
// Shared household spine.

const { text, views, ai, outreach } = require('..');
const offer = require('./offer');
const words = require('./words');
const pipe = require('./pipeline');
const geo = require('./geo');
const T = require('./tools');

// "When can you come?", "Do you have Saturday?": they want to book.
const BOOKING = /\b(when (can|could|are) you|what days?|which days?|availab|any openings?|book (me|us|it)|schedule (me|us|it)|can you come|could you come|this (saturday|sunday|weekend)|next week\?)/i;

// The niche objection their words match best (most match phrases found), or null.
function objectionFor(cfg, reply) {
  const t = ` ${String(reply || '').toLowerCase().replace(/[’']/g, "'")} `;
  let best = null;
  let hits = 0;
  for (const o of cfg.niche.objections || []) {
    const n = (o.match || []).filter((m) => t.includes(String(m).toLowerCase())).length;
    if (n > hits) {
      best = o;
      hits = n;
    }
  }
  return best && best.say ? best : null;
}

// Words that mean stop, on top of the kit's (a bare "Not interested" or "wrong number").
const STOP = /\b(not interested|wrong number|stop (texting|messaging|calling|emailing)|unsubscribe|remove me|leave me alone|do not (text|call|contact))\b/i;

// What the reply means: stop first, then a niche worry, then the kit's reading of the words.
function readReply(cfg, reply) {
  const intent0 = STOP.test(String(reply || '')) ? 'stop' : outreach.intentOf(reply);
  if (intent0 === 'stop') return { intent: 'stop' };
  const obj = objectionFor(cfg, reply);
  if (obj) return { intent: 'objection', objection: obj };
  if (intent0 === 'question' || intent0 === 'other') {
    if (BOOKING.test(reply)) return { intent: 'yes' };
  }
  return { intent: intent0 };
}

const MEANS = {
  stop: ['They asked you to stop.', "Don't send anything else. They're marked lost, so they stay off your lists."],
  objection: ['They have a worry to settle first.', 'Answer it plainly, then make one clear offer.'],
  price: ['They want a price first.', 'Say the price once, then offer to quote their exact job.'],
  later: ['Not now, maybe later.', 'Check back in a month or two, then let it go.'],
  who: ['They want to know who you are first.', 'Answer plainly. Being new is fine to say.'],
  covered: ['They have someone already.', 'Be gracious, offer to be the backup, check back later once.'],
  yes: ['They want to book.', 'Get the details and a day, then run "A customer said yes".'],
  question: ['They asked a question.', 'Answer it in a line or two, then make one clear offer.'],
  other: ['Not sure what they meant.', 'Keep it short and end with one question.'],
};

function tool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  return {
    name: `${id}.answer_reply`,
    title: 'Answer this reply',
    description: `Reads a reply from someone you contacted (a person, a neighbor or a partner business), says what it means, writes a short answer with one next step from your real offer and the usual ${N.name.toLowerCase()} worries, and updates your Pipeline. "Stop" gets no answer and is marked lost.`,
    kind: 'ai',
    tasks: ['write'],
    risk: 'draft',
    needs: [],
    credits: 6,
    timeoutSec: 90,
    input: {
      type: 'object',
      required: ['who', 'reply'],
      properties: {
        who: { type: 'string', maxLength: 120, title: 'Who wrote back' },
        reply: { type: 'string', maxLength: 6000, title: 'What they wrote' },
        city: { type: 'string', maxLength: 80 },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
      },
    },
    output: {
      type: 'object',
      required: ['intent', 'meaning', 'answer', 'next'],
      properties: { who: { type: 'string' }, intent: { type: 'string' }, meaning: { type: 'string' }, answer: { type: 'string' }, next: { type: 'string' }, stop: { type: 'boolean' }, worry: { type: 'string' }, business: { type: 'boolean' }, inPipeline: { type: 'boolean' }, saved: { type: 'boolean' }, ai: { type: 'boolean' }, then: { type: 'array' } },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const who = text.clip(text.plain(input.who || ''), 120).trim();
      const said = text.clip(String(input.reply || '').trim(), 6000);
      if (!who) throw new Error('Pick who wrote back, or type their name.');
      if (!said) throw new Error('Paste what they wrote.');
      const lead = await pipe.findLead(ctx, id, who);
      const isBiz = pipe.isBusiness(lead, who);
      const name = (lead && (isBiz ? lead.company || lead.name : lead.name)) || who;
      const first = isBiz ? `${name} team` : String(name).split(/\s+/)[0];
      const menu = offer.menuFor(ctx, cfg, {});
      const { lead: lo } = T.leadFor(ctx, cfg, menu, { lat: geo.latOf(f.place).lat });
      const r = { ...readReply(cfg, said), said };
      const [meaning, next] = MEANS[r.intent] || MEANS.other;
      const out = { who: name, intent: r.intent, meaning, next, stop: r.intent === 'stop', business: isBiz, inPipeline: !!lead, answer: '', ai: false };

      if (r.intent === 'stop') {
        // No answer. Lost, so no list or Do my day offers them again.
        const s = await pipe.save(ctx, id, lead, { stage: 'lost', reply: text.clip(said, 2000), note: 'Asked not to be contacted again.' }, { name, business: isBiz, source: 'Typed in' });
        out.saved = !!s.saved;
        out.other = !!s.other;
        out.moved = !!s.moved;
        out.next = s.other && !s.moved ? `${next.replace(/ They're marked lost.*$/, '')} Mark them lost in your Pipeline so they stay off your lists.` : next;
        return out;
      }

      // The written answer: the niche's words for a person, partner words for a business.
      const type = isBiz ? partnerType(cfg, lead, name) : null;
      const template = isBiz ? partnerAnswer(cfg, r, { f, lo, menu, name, type }) : personAnswer(cfg, r, { f, lo, first });
      if (r.objection) out.worry = r.objection.objection;
      const allowed = new Set([...numbersIn(template), ...numbersIn(said), ...numbersIn(f.phone), ...[lo.price, lo.founding, lo.planPrice].filter(Boolean).map(String)]);
      const placeholders = template.match(/\[[^\]]+\]/g) || [];
      const res = await ai.aiText(ctx, {
        task: 'write',
        system: `You answer a reply for a new ${N.what} business owner, in their voice: warm, plain and short (under 70 words). One clear next step. Plain text, no markdown, no emoji, no dashes as punctuation. Never add a price, number, date, claim, credential or promise that is not in the facts. Keep any [bracketed] placeholder exactly as written. Never offer anything in return for a review.`,
        prompt: [
          `They are ${isBiz ? `a local business (${type ? type.one || type.label : 'a business'}) the owner asked to partner with` : 'a person the owner contacted about their service'}: ${name}.`,
          `What they wrote: """${text.clip(said, 1500)}"""`,
          `What it means: ${meaning}`,
          r.objection ? `Their worry, and how to answer it: ${r.objection.answer}` : '',
          `The owner: ${f.first || 'the owner'}, ${f.business}, ${N.what} in ${f.area}. This month's offer: ${lo.headline}, ${lo.foundingText} for the first 3 clients${lo.ref ? ` (${lo.ref})` : ''}. ${lo.plan || ''} Promise: ${N.offer.promise}`,
          `A good answer already written (keep its facts, fit it to their exact words): ${template}`,
          'Write only the answer they will receive.',
        ].filter(Boolean).join('\n'),
        maxTokens: 300,
        fallback: () => template,
        accept: (t) => ai.cleanCopy(t) && t.length <= 700 && numbersIn(t).every((n) => allowed.has(n)) && placeholders.every((p) => t.includes(p)) && (t.match(/\[[^\]]+\]/g) || []).every((p) => placeholders.includes(p)),
      });
      out.answer = res.text;
      out.ai = !!res.ai;
      if (/\[[^\]]+\]/.test(out.answer)) out.fill = 'Fill in the part in [brackets] with your own true answer before you send it, or delete it.';

      // The Pipeline: their reply and the answer, ready in Do my day.
      const s = await pipe.save(ctx, id, lead, { stage: 'replied', reply: text.clip(said, 2000), msg: { ...((lead && lead.msg) || {}), answer: out.answer } }, { name, business: isBiz, source: 'Typed in' });
      out.saved = !!s.saved;
      out.other = !!s.other;
      out.moved = !!s.moved;
      out.then = thenFor(cfg, r.intent);
      return out;
    },
    view(out) {
      if (out.stop) {
        return views.blocks(
          views.metric(`Reply from ${out.who}`, 'Stop', out.meaning),
          views.text(out.next),
          out.saved && (!out.other || out.moved) ? views.text('Marked lost in your Pipeline.') : null,
        );
      }
      return views.blocks(
        views.metric(`Reply from ${out.who}`, label(out.intent), out.meaning),
        out.worry ? views.text(`Their worry: ${out.worry}`) : null,
        views.copy(`Your answer to ${out.who}`, out.answer),
        out.fill ? views.text(out.fill) : null,
        views.text(`Next: ${out.next}`),
        (out.then || []).map((t) => views.text(t)),
        out.saved ? views.text(out.inPipeline ? (out.other && !out.moved ? 'Saved on their Pipeline card with the answer, so Do my day hands it to you.' : 'Moved to Replied in your Pipeline with the answer, so Do my day hands it to you.') : 'Added to your Pipeline as Replied, with the answer.') : null,
      );
    },
  };
}

const label = (intent) => ({ objection: 'A worry', price: 'Price', later: 'Not now', who: 'Who are you', covered: 'Has someone', yes: 'Wants to book', question: 'A question', other: 'Unclear' }[intent] || 'Reply');

// An answer that already ends on a question needs no extra ask.
const ASKS = /\?["')]*\s*$/;
// "How did you get my number?": say where, in the member's own words.
const FOUND = /how (did|do) you (get|find|have)|where did you (get|find)|who gave you/i;
const aOrAn = text.aOrAn;
const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

function numbersIn(s) {
  return (String(s || '').match(/\d+(?:\.\d+)?/g) || []).map((n) => String(Number(n)));
}

// What to run next, by what they said.
function thenFor(cfg, intent) {
  if (intent === 'yes') return ['When they confirm a day, run "A customer said yes": it logs the win and makes the booking text, job sheet and invoice.'];
  if (intent === 'price') return ['Want the exact number? Run "Quote a job" with what you know about their place.'];
  return [];
}

// The answer for a person (a homeowner, a neighbor, someone the member knows).
function personAnswer(cfg, r, { f, lo, first }) {
  const R = cfg.niche.texts.replies || {};
  const v = T.textVars(cfg, f, lo, { greet: first, customer: first, terms: cfg.niche.texts.plan_terms || '' });
  const name = first && !/^there$/i.test(first) ? first : '';
  const hi = name ? `Hi ${name}! ` : 'Hi! ';
  const fill = (t) => words.fill(t, v);
  // "Wonderful! To book you in..." becomes "Wonderful, Rita! To book you in...", never "Hi Rita! Wonderful!".
  const greet = (t) => {
    const m = /^([^.!?]{2,40})!\s+/.exec(t);
    if (!m) return `${hi}${t}`;
    return name ? `${m[1]}, ${name}! ${t.slice(m[0].length)}` : t;
  };
  switch (r.intent) {
    case 'objection': {
      // The niche's answer, then one next step unless the answer already ends on a question.
      const say = fill(r.objection.say);
      return `${hi}${say}${ASKS.test(say) ? '' : ` ${fill(R.close || 'Want me to pencil you in? Just send a day that works.')}`}`;
    }
    case 'price':
      return greet(fill(R.how_much));
    case 'later':
      return greet(fill(R.not_now));
    case 'who':
      return `${greet(fill(R.who_are_you))}${FOUND.test(r.said || '') ? ' I found your number [where you found it].' : ''}`;
    case 'covered':
      return greet(fill(R.covered || "Good to hear you're set! Mind if I check back in a few months?"));
    case 'yes':
      return greet(fill(R.yes || 'Wonderful! What day works for you this week or next?'));
    case 'question':
      return `${hi}Good question. [Answer it in a line or two.] Happy to give you an exact quote too. What day would suit you?`;
    default:
      return greet(`Thanks for getting back to me! [Answer what they said in one line.] Would ${aOrAn(lo.one)} ${lo.one} work for you this month?`);
  }
}

function partnerType(cfg, lead, name) {
  const types = cfg.niche.partners;
  const S = (cfg.niche.sample_one && cfg.niche.sample_one.partners) || {};
  if (lead && lead.data && types.find((t) => t.id === lead.data.type)) return types.find((t) => t.id === lead.data.type);
  const n = ` ${String(name || '').toLowerCase()} `;
  return types.find((t) => ((S[t.id] || {}).words || []).some((w) => n.includes(String(w).toLowerCase()))) || null;
}

// The answer for a partner business: the free sample stays the next step.
function partnerAnswer(cfg, r, { f, lo, menu, name, type }) {
  const N = cfg.niche;
  const S = (N.sample_one && N.sample_one.partners) || {};
  const t = type || {};
  const P = S[t.id] || {};
  const their = t.their_customers || 'customers';
  const demo = words.fill(P.demo || `one ${N.job || 'job'} free, so you can see the work`, { biz: name });
  const pkg = menu.packages.find((x) => x.id === P.package) || menu.packages.find((x) => x.id === lo.package) || menu.packages[0];
  const ladder = offer.ladderFor(cfg, pkg.price);
  const founding = ladder[0] ? ladder[0].price : pkg.price;
  const me = f.first ? `I'm ${f.first}, I run ${f.business}` : `I run ${f.business}`;
  const hi = `Hi ${name} team, `;
  switch (r.intent) {
    case 'objection': {
      const say = words.fill(r.objection.say, T.textVars(cfg, f, lo, {}));
      return `${hi}${lowerFirst(say)}${ASKS.test(say) ? '' : ` The free sample is still yours if it helps: ${demo}.`}`;
    }
    case 'price':
      return `${hi}for your ${their}, a ${pkg.label.toLowerCase()} is ${T.usd(pkg.price)}${N.quote.reference ? ` (${N.quote.reference})` : ''}, and the first 3 get ${T.usd(founding)}. For you, the sample is free: ${demo}. Would that help you decide?`;
    case 'later':
      return `${hi}no problem at all. Can I check back in a couple of months? The free sample stands whenever it helps: ${demo}.`;
    case 'who':
      return `${hi}${me}, ${N.what} here in ${f.area}. I'm reaching out to a few local businesses that serve the same customers, and I'd like to show you my work first: ${demo}. No catch.${FOUND.test(r.said || '') ? ' I found you through [where you found them].' : ''}`;
    case 'covered':
      return `${hi}good to hear you have someone. If they're ever booked up, I'm happy to be your backup. Mind if I check back in a couple of months?`;
    case 'yes':
      return `${hi}great, thank you! What day works this week or next? I'll do the sample (${demo}), send you before and after photos, and bring cards for your ${their}.`;
    case 'question':
      return `${hi}good question. [Answer it in a line or two.] The sample is still yours if it helps: ${demo}.`;
    default:
      return `${hi}thanks for getting back to me! [Answer what they said in one line.] Would a free sample help: ${demo}?`;
  }
}

module.exports = { tool, readReply, objectionFor, personAnswer, partnerAnswer, numbersIn, BOOKING };
