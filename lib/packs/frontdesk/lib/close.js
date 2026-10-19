// What a contractor's reply means and the answer to send, in front desk words: kit outreach.answer
// gives the intent, kit talk adds auto-replies, the wrong person, "send info" and "let me think", and
// this file matches the trade's own worries (data/niche.json objections) and the questions owners
// ask. Every answer ends in one next step, says the member's real price once when price comes up,
// and keeps [placeholders] out unless only the member can fill them in. Also the call card content.

const kit = require('../../_kit');
const { text, money } = kit;
const NICHE = require('../data/niche.json');
const prices = require('./prices');
const talk = require('../../_kit/talk');
const { shortName } = require('./plan');

// data/niche.json objections, same order, with the words that signal each one.
const WORRY_RE = [
  /\b(i|we) (always )?(answer|pick up|get) (my|our|all|every|the|most)?\s*(own )?(phones?|calls?)\b|\bnever miss (a|any) calls?\b|\bphone is (always )?(on me|with me)\b/i,
  /\b(robots?|bots?|chat ?bots?|automated|automation|ai|artificial|machines?|recordings?|canned|impersonal)\b/i,
  /\b(too )?(expensive|pricey|costly)\b|\bcan'?t afford\b|\bno budget\b|\btoo much (money)?\b|\bnot worth (it|the money)\b/i,
  /\b(jobber|housecall|house call pro|servicetitan|service titan|we (have|use) (an? )?(app|system|software|tool) for (that|this|calls|booking))\b/i,
  /\b(legal|illegal|lawsuits?|sued|tcpa|compliance|consent|allowed to text|spam(my)?)\b/i,
  /\b(chang(e|ing)|switch(ing)?|port(ing)?|los(e|ing)|keep(ing)?) (my|our|the|their|a) (own )?(phone |business |main )?number\b|\bnew (phone )?number\b/i,
];
const WORRY_TOPIC = ['answering their own phone', 'customers getting a robot', 'the price', 'the software they already use', 'texting rules', 'keeping their number'];

function worryOf(reply) {
  const t = String(reply || '');
  return WORRY_RE.findIndex((re) => re.test(t));
}

// Someone already answers their phones (a person, not software): the "covered" answer.
const COVERED_RE = /\b(receptionist|answering service|call cent(er|re)|office (manager|staff|girl|lady)|(my|our) (wife|husband|daughter|son|mom|dad|office|secretary|dispatcher) (answers|picks up|handles|takes)|someone (always )?(answers|picks up))\b/i;

// Which answer fits, from kit outreach.answer's intent, kit talk's extra intent and the worry index.
// A stop always wins; an auto-reply or the wrong person comes next; a price question is answered
// even when it carries a worry (the worry gets a line first).
function kindOf({ intent, extra, worry, reply }) {
  if (intent === 'stop') return 'stop';
  if (extra === 'away' || extra === 'wrong') return extra;
  if (intent === 'price') return 'price';
  if (worry >= 0) return 'worry';
  if (COVERED_RE.test(String(reply || ''))) return 'covered';
  if (intent === 'later' || intent === 'who') return intent;
  if (extra === 'info' || extra === 'think') return extra;
  return LABEL[intent] ? intent : 'other';
}

const LABEL = {
  yes: 'Yes, they want the plan',
  price: 'They asked the price',
  covered: 'They have someone for calls',
  later: 'Not right now',
  who: 'They asked who you are',
  info: 'They want more information',
  think: 'They want to think it over',
  away: 'An auto-reply',
  wrong: 'Not the right person',
  worry: 'A worry about it',
  question: 'They asked a question',
  other: 'Not sure what they meant',
  stop: 'They asked you to stop',
};

// Questions owners ask, answered from the offer. v: { s, soon, d }.
const QA = [
  { re: /\bhow long\b|\bhow (fast|quick(ly)?|soon)\b|\bwhen (could|can|would) (it|you|we|this)\b|\bset ?up take/i, a: () => 'Setup takes about a week once you add me as a user on your phone and booking accounts. We test it together from two phones before it goes live.' },
  { re: /\bcontract\b|\bcancel\b|\blocked in\b|\bcommit(ment)?\b/i, a: () => 'There is no contract on the monthly care. Cancel any month, and every account stays in your name.' },
  { re: /\bwhat do (you|i|we) need\b|\bwhat('s| is| would be) needed\b|\bwhat would (i|we) have to do\b|\bfrom (me|us)\b/i, a: () => 'Two things: add me as a user on your phone account and your booking tool, and 15 minutes to test it with me. Nothing gets bought on my card, and you own every account.' },
  { re: /\bhow (does|would|do) (it|this|that) work\b|\bwhat (exactly )?(is|does) (it|this|that)\b|\bexplain\b/i, a: () => 'When you miss a call, your number texts the caller back right away, asks what they need and offers a way to book. After hours they get a reply too. You keep your number and your phone works the same as now.' },
  { re: /\bdo you (also )?(do|offer|build|make|handle|run)\b|\bwhat else do you\b/i, a: () => 'Right now I stick to the phones and booking: missed-call text back, after-hours replies and online booking, so I can do that part really well.', tail: 'Happy to show you how that part would work for you.' },
  { re: /\b(see|look at|show me) (it|one|an example|what)|\bexample\b|\bsample\b/i, a: (v) => `Yes. I'll make the one-page plan for ${v.s} from your website: the exact text your number would send, an after-hours reply and a booking flow. You'll have it by ${v.soon}.` },
];

// The booking software they named, if any.
const toolIn = (reply) => {
  const t = String(reply || '');
  return /jobber/i.test(t) ? 'Jobber' : /housecall/i.test(t) ? 'Housecall Pro' : /service ?titan/i.test(t) ? 'ServiceTitan' : '';
};

// One line for a worry that comes with a price question (the price is the answer; the worry gets a line).
const BRIDGE = [
  () => "You'd still answer your own phone: this only covers the calls you can't pick up.",
  () => 'Callers get a text from your business, signed with your name, never a robot voice.',
  null,
  (tool) => (tool ? `Since you use ${tool}, I'd set it up inside ${tool}, so there's nothing new to learn.` : "I'd set it up inside the booking tool you already pay for, so there's nothing new to learn."),
  () => 'Texting is set up the legal way: your number gets registered, and STOP works right away.',
  () => 'You keep your number. Only the calls you miss get forwarded.',
];

const lowerFirst = (s) => (/^I\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const join = (...parts) => text.plain(parts.filter(Boolean).join(' '));

// One answer. ctx for dates; lead from kit talk; member { first, business, city }; n from lib/prices.
// intent: kit outreach.answer's intent (a "yes" that also carries a worry gets the plan offer after
// the worry's answer). planSent: they already have the missed-call plan, so the next step is a call.
// Returns { kind, label, answer, next, days, placeholder, topic }.
function answerFor({ kind, reply, lead, member, n, founding, ctx, worry = -1, intent = '', planSent = false }) {
  const s = shortName(lead.name);
  const me = member.first || '';
  const signer = talk.signerOf(reply);
  const hi = signer ? `Hi ${signer},` : '';
  const [d1, d2] = talk.callDays(ctx);
  const soon = talk.onDay(ctx, 2).label;
  const P = prices.priceSay(n, { founding });
  const callAsk = `Would ${d1} or ${d2} work for 15 minutes?`;
  const planOffer = planSent ? `Want to walk through the plan I sent? ${callAsk}` : `Want me to send the one-page plan so you can see exactly what a caller would get? You'd have it by ${soon}.`;
  const sign = (body) => (me ? `${body}\n\n${me}` : body);
  let days = 3;
  let answer = '';
  let next = '';
  let topic = '';
  switch (kind) {
    case 'yes':
      if (planSent) {
        answer = join(`Great, thank you! The next step is a quick call to set it up on your number: what the text should say, your hours and where bookings go.`, callAsk);
        next = 'Book the call, then prep it with "Prep for a call".';
      } else {
        days = 2;
        answer = join(`Great, thank you. I'll have the missed-call plan for ${s} to you by ${soon}: the text your number would send when you miss a call, an after-hours reply and a booking flow, all written from your website.`, 'Is there anything you want me to look at in particular?');
        next = `Make the plan now ("Make a free sample") and send it by ${soon}. Then ask for 15 minutes to walk through it.`;
      }
      break;
    case 'price': {
      const bridge = worry >= 0 && BRIDGE[worry] ? BRIDGE[worry](toolIn(reply)) : '';
      if (bridge) topic = WORRY_TOPIC[worry];
      answer = join('Good question.', bridge, P.base, P.founding || P.tools, `Easiest is a quick call where I show you what it would look like for ${s}.`, callAsk);
      next = `You said the price once${bridge ? ` and answered the worry about ${topic}` : ''}. Now get the call on the calendar, then prep it with "Prep for a call".`;
      break;
    }
    case 'covered':
      days = 60;
      answer = join('Good to hear the phones are covered.', 'This only kicks in on the calls nobody gets to: after hours, at lunch, or when everyone is on a job.', "If you ever want to see how many of those there are, I'm happy to show you. Mind if I check back in a couple of months?");
      next = 'Never knock whoever answers their phones. Check back once, in 2 months, then let it go.';
      break;
    case 'worry': {
      const o = { ...(NICHE.objections[worry] || NICHE.objections[0]) };
      topic = WORRY_TOPIC[worry] || '';
      const tool = toolIn(reply);
      if (worry === 3 && tool) o.reply = o.reply.replace('in the tool you already pay for', `in ${tool}, the tool you already pay for`);
      const tails = [
        planOffer,
        planSent ? `Want to go through exactly what the first text says for ${s}? ${callAsk}` : `Want to see exactly what the first text would say for ${s}? I can send the plan by ${soon}.`,
        `${P.base} ${callAsk}`,
        `I can show you how it would look in ${toolIn(reply) || 'yours'}. ${callAsk}`,
        `Happy to walk you through the registration. ${callAsk}`,
        planOffer,
      ];
      const yes = intent === 'yes' && !planSent && worry !== 2 ? `Either way, I'll have the plan for ${s} to you by ${soon}.` : '';
      answer = join(o.reply, yes || tails[worry] || tails[0]);
      if (yes) days = 2;
      next = yes ? `They said yes with a worry about ${topic}. Answer it once, then make the plan ("Make a free sample") and send it by ${soon}.` : `It's a worry about ${topic}. Answer it once, calmly, and end on one question. Don't argue.`;
      break;
    }
    case 'later':
      days = talk.laterDays(reply, ctx);
      answer = join(`No problem at all. I'll check back around ${talk.onDay(ctx, days).label}.`, planSent ? `The plan I sent for ${s} is yours to keep either way.` : `The free missed-call plan for ${s} is yours whenever you want it.`);
      next = `Put ${talk.onDay(ctx, days).label} in your calendar. If they said don't check back, stop.`;
      break;
    case 'who':
      answer = join(`Sorry, I should have said! I'm ${me || 'the person who wrote you'}${member.business ? ` from ${member.business}` : ''}, and I set up missed-call text back and online booking for contractors${member.city ? ` around ${String(member.city).split(',')[0].trim()}` : ''}.`, `I wrote because a caller who reaches voicemail often calls the next number on the list, and I'd like to help ${s} keep those calls.`, planSent ? `The plan I sent shows what it would look like for you. ${callAsk}` : `Want me to send the free one-page plan? You'd have it by ${soon}.`);
      next = "They don't know you yet. Keep it short and offer one next step.";
      break;
    case 'info':
      answer = join("Here's the short version.", QA[3].a(), "It runs on your own phone account and there's no contract.", planSent ? `The plan I sent shows the exact texts for ${s}. ${callAsk}` : `The easiest way to see it is the free one-page plan I'd make from your website. Want it by ${soon}?`);
      next = '"Send me info" often means "not sure yet". Give the short version and one next step, so it doesn\'t get buried.';
      break;
    case 'think':
      days = 3;
      answer = join('Of course, take your time.', 'If it helps, is it the price, the setup, or how customers will take the texts? Happy to answer whichever it is.', `I'll check back on ${talk.onDay(ctx, days).label} unless you'd rather I didn't.`);
      next = "Ask once what's behind it, then leave it with them.";
      break;
    case 'away':
      days = talk.backDays(reply, ctx);
      answer = join('Hope your time away went well.', planSent ? `Floating my note back up: did the missed-call plan for ${s} come through? Happy to walk you through it.` : `Floating my note back up: I'd like to send you a free one-page missed-call plan for ${s}, written from your website. Want it?`);
      next = `That's an auto-reply, so don't answer it now. Send this on ${talk.onDay(ctx, days).label}, after they're back.`;
      break;
    case 'wrong': {
      const name = talk.pointedName(reply);
      const passing = /\b(pass|forward|send)(ed|ing)? (this|it|that|your)/i.test(String(reply || ''));
      answer = name ? join(`Thank you, that's really helpful. Would you mind sharing the best email for ${name}? I'll keep it short.`) : passing ? join("Thank you, I appreciate it! Could you tell me the owner's first name, so I know who to follow up with?") : join("Thanks for letting me know. Who's the best person to talk to about the phones and booking, and how can I reach them?");
      next = `They pointed you to ${name || 'someone else'}. Get the best way to reach them, then write to them directly and say who sent you.`;
      break;
    }
    case 'question': {
      const q = QA.find((x) => x.re.test(String(reply || '')));
      answer = q ? join(q.a({ s, soon }), q.tail || 'Happy to show you the rest.', callAsk) : join('Good question. [Answer it in a line or two.]', `Happy to go through the rest on a quick call. ${callAsk}`);
      next = q ? 'Answered from your offer. Read it once before you send.' : `They asked "${talk.questionIn(reply) || 'something specific'}". Answer it where the brackets are, then send.`;
      break;
    }
    case 'stop':
      days = null;
      answer = '';
      next = "Don't send anything else, on any channel. They stay off your lists for good.";
      break;
    default:
      answer = join(planSent ? `Thanks for getting back to me! Quick question so I don't guess: would a 15-minute call to go through the plan for ${s} be useful? A yes or no is perfect.` : `Thanks for getting back to me! Quick question so I don't guess: would a free one-page plan for the calls ${s} misses be useful? A yes or no is perfect.`);
      next = "It's hard to tell what they meant, so this asks a simple yes or no.";
  }
  // "Hi Dana," on its own line, like a real reply; the member's first name under it.
  const out = kind === 'stop' ? '' : sign(hi ? `${hi}\n\n${answer}` : answer);
  return { kind, label: LABEL[kind] || LABEL.other, answer: out, next, days, placeholder: /\[[^\]\n]{2,60}\]/.test(out), topic };
}

// ---------- the call card ----------

const QUESTIONS = [
  'When you are on a job and the phone rings, what happens to that call?',
  'Roughly how many calls a week go to voicemail? A guess is fine.',
  'What happens to calls after hours and on weekends?',
  'When someone leaves a voicemail, who calls them back, and how soon?',
  'What do you use for jobs and booking now: Jobber, Housecall Pro, a calendar or paper?',
  'If this worked the way I described, is there anything that would stop you from starting this week?',
];

// What to check before the call, from the lead's facts and what sales.read_prospect read.
function checkFirst({ lead, prospect = {}, checked }) {
  const out = [];
  const phone = lead.phone || prospect.phone || '';
  out.push({ item: phone ? `Call ${phone} from your own phone and let it ring out` : 'Call their number from your own phone and let it ring out', why: 'Write down what happens: voicemail, a full mailbox, or a text back. That is the whole pitch, in their own words.' });
  for (const f of (lead.facts || []).slice(0, 3)) out.push({ item: text.clip(f, 140), why: `From their website${checked ? ` (checked ${checked})` : ''}. Ask how callers handle it today.` });
  const hours = prospect.hours && (prospect.hours.text || prospect.hours);
  if (typeof hours === 'string' && hours) out.push({ item: `Their hours: ${text.clip(hours, 100)}`, why: 'Calls outside these hours are where the text back helps most.' });
  else out.push({ item: 'Find their hours on their website and their map listing', why: 'Calls outside their hours are where the text back helps most.' });
  const services = Array.isArray(prospect.services) ? prospect.services.map((x) => (typeof x === 'string' ? x : x && (x.name || x.text))).filter(Boolean) : [];
  if (services.length) out.push({ item: `They list ${text.list(services.slice(0, 3))}`, why: 'Use one of these in your example text, so it sounds like their business.' });
  out.push({ item: 'Open their website on your phone', why: 'Is the number tap-to-call? Is there a way to book or ask a question after hours?' });
  return out.slice(0, 6);
}

// The six worries, the ones their notes or reply mention first.
function worriesFor(notes) {
  const t = String(notes || '');
  const order = NICHE.objections.map((o, i) => ({ ...o, i, hit: WORRY_RE[i] && WORRY_RE[i].test(t) ? 1 : 0 }));
  order.sort((a, b) => b.hit - a.hit || a.i - b.i);
  return order.map((o) => ({ says: `"${o.objection}"`, answer: o.reply, topic: WORRY_TOPIC[o.i], mentioned: !!o.hit }));
}

module.exports = { answerFor, kindOf, worryOf, worriesFor, COVERED_RE, WORRY_TOPIC, checkFirst, QUESTIONS, LABEL, WORRY_RE, QA, lowerFirst };
