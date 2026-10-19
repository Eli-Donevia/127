// What a shop owner's reply means and the answer to send, in review words: kit outreach.answer gives
// the intent, kit talk adds auto-replies, the wrong person, "send info" and "let me think", and this
// file matches the shop's own worries (data/niche.json objections) and the questions owners ask.
// Every answer ends in one next step and says the member's real price once when price comes up.
// Nothing here buys, gates or trades for a review: every customer is asked the same way, nothing is
// offered in exchange, and no one promises a number of reviews (Google policy, FTC rule). Also the
// call card content.

const kit = require('../../_kit');
const { text } = kit;
const NICHE = require('../data/niche.json');
const prices = require('./prices');
const talk = require('../../_kit/talk');

const shortName = (name) => text.plain(String(name || 'your shop').replace(/\s*(,?\s*(llc|inc\.?|co\.?|company|corp\.?))+$/i, '').trim()) || 'your shop';

// data/niche.json objections, same order, with the words that signal each one.
const WORRY_RE = [
  /\b(can|could|would|will) you (just )?(get|buy|write|post|add) (us |me )?(some |more |a few |a bunch of )?(5[- ]star |good |positive )?reviews\b|\b(buy|pay for|purchase|fake) (some |more )?(5[- ]star )?reviews\b|\bfake reviews?\b/i,
  /\b(only|just)\b[^.?!\n]{0,30}\b(happy|satisfied|good|loyal|regular|best|favorite)\b[^.?!\n]{0,20}\b(customers|clients|ones|people|guests|patients|regulars)\b|\b(happy|satisfied|loyal) (customers|clients|regulars|ones) only\b|\bfilter (out )?(the )?(bad|unhappy|angry)\b|\bkeep (the )?(bad|unhappy|angry) (ones|customers) (from|off)\b/i,
  /\b(we|i) (already|always) (ask|tell|remind)\b|\bwe ask (for reviews|already|them already)\b/i,
  /\b(won'?t|don'?t|never) (bother|do it|leave (one|them|reviews?)|take the time)\b|\b(no one|nobody) (leaves|writes|bothers|does)\b/i,
  /\b(bad|negative|1[- ]star|one[- ]star|mean|nasty|angry|unfair) reviews?\b|\bsomeone (complains|leaves a bad)\b/i,
  /\b(no|don'?t have (the |any )?) ?time\b|\btoo busy\b|\bswamped\b|\bstretched thin\b/i,
  /\b(too )?(expensive|pricey|costly)\b|\bcan'?t afford\b|\bno budget\b|\bnot worth (it|the money)\b/i,
];
const WORRY_TOPIC = ['buying reviews', 'asking only happy customers', 'already asking', 'customers not bothering', 'bad reviews', 'their time', 'the price'];

function worryOf(reply) {
  const t = String(reply || '');
  return WORRY_RE.findIndex((re) => re.test(t));
}

// Someone already handles their reviews (a service or software): the "covered" answer.
const COVERED_RE = /\b(we (have|use|pay for|work with) (an? )?(agency|company|service|marketing (company|person|agency|guy)|birdeye|podium|nicejob|gatherup|brightlocal|reputation)|(birdeye|podium|nicejob|gatherup|brightlocal) (handles|does|sends))\b/i;

const LABEL = {
  yes: 'Yes, they want the card',
  price: 'They asked the price',
  covered: 'Someone handles their reviews',
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

// Which answer fits (same order as the front desk pack): a stop always wins; an auto-reply or the
// wrong person next; a price question is answered even with a worry in it.
function kindOf({ intent, extra, worry, reply }) {
  if (intent === 'stop') return 'stop';
  if (extra === 'away' || extra === 'wrong') return extra;
  if (intent === 'price') return 'price';
  if (QA.some((q) => q.first && q.re.test(String(reply || '')))) return 'question';
  if (worry >= 0) return 'worry';
  if (COVERED_RE.test(String(reply || ''))) return 'covered';
  if (intent === 'later' || intent === 'who') return intent;
  if (extra === 'info' || extra === 'think') return extra;
  return LABEL[intent] ? intent : 'other';
}

// Questions owners ask, answered from the offer and the rules. v: { s, soon }.
const QA = [
  { re: /\bhow long\b|\bhow (fast|quick(ly)?|soon)\b|\bwhen (could|can|would) (it|you|we|this)\b|\bset ?up take/i, a: () => 'Cards and the link are live within 3 days of your yes: I bring the printed cards, add the line to your receipts and test the code on two phones.' },
  { re: /\bcontract\b|\bcancel\b|\blocked in\b|\bcommit(ment)?\b/i, a: () => 'There is no contract. Cancel any month, and the cards, the link and the templates stay yours.' },
  { re: /\bwhat do (you|i|we) need\b|\bwhat('s| is| would be) needed\b|\bwhat would (i|we) have to do\b|\bfrom (me|us)\b/i, a: () => 'Two things: your review link from your Business Profile (I show you where it is, it takes a minute) and 15 minutes with whoever is at the counter.' },
  { re: /\bhow (does|would|do) (it|this|that) work\b|\bwhat (exactly )?(is|does) (it|this|that)\b|\bexplain\b/i, a: () => 'Every customer gets asked the same way at checkout, with a card whose code opens your Google review form. The same link goes on your receipts and thank-you emails, and I draft a reply to every new review within a day.' },
  { first: true, re: /\bguarantee\b|\b(can|could|do|will|would) you promise\b|\bhow many (new |more )?reviews\b/i, a: () => 'No one honest can promise a number of reviews: your customers decide that. What I can promise is that every customer gets asked, with one tap, and every review gets a reply draft within a day.', tail: 'Happy to show you how the asking works at your counter.' },
  { first: true, re: /\b(remove|delete|take down|get rid of)\b[^.?!\n]{0,40}\breviews?\b/i, a: () => "I can't remove reviews, and no one honest can promise to. Google takes down only reviews that break its rules: I can show you how to flag one that does, and draft a calm reply for the rest.", tail: 'Happy to show you how flagging works, and the reply I would write.' },
  { re: /\bdo you (also )?(do|offer|build|make|handle|run)\b|\bwhat else do you\b/i, a: () => 'Right now I stick to reviews: the card, the same ask for every customer and a reply to every review, so I can do that part really well.', tail: 'Happy to show you how that part would work for you.' },
  { re: /\b(see|look at|show me) (it|one|an example|what)|\bexample\b|\bsample\b/i, a: (v) => `Yes. I'll make the counter card for ${v.s} with a code that opens your Google listing, ready to print. You'll have it by ${v.soon}.` },
];

// One line for a worry that comes with a price question.
const BRIDGE = [
  () => 'Just so you know, I never buy or write reviews: every one comes from a real customer you asked.',
  () => 'Every customer gets the same card and the same ask, which is what keeps it inside Google\'s rules.',
  () => 'Since you already ask, the card makes it one tap instead of a search.',
  () => 'A code at the counter makes it a 30-second job while they are still there.',
  () => 'I draft a calm reply to every review, the bad ones included.',
  () => 'It takes almost none of your time: your team says one sentence at checkout, and I do the rest.',
  null,
];

// Anything that trades for, gates, buys or promises reviews (Google policy, FTC rule), one sentence at
// a time. Sentences that say no to it ("nothing is offered in exchange", "I can't remove reviews",
// "asking only happy customers is against Google's policy") are fine.
const INCENTIVE = /\b(discounts?|coupons?|gift( cards?)?|gifts|raffles?|giveaways?|prizes?|rewards?|perks?|freebies?|\d+ ?% off|\$\d+ off|free (\w+ ){0,2}(coffee|drinks?|desserts?|items?|services?|cuts?|trims?|wash(es)?|sessions?|months?|visits?|treats?|upgrades?|oil changes?|manicures?|pedicures?|add-?ons?)|entr(y|ies)|in exchange|in return)\b/i;
const GATE = /\b(only|just)\b[^.?!\n]{0,40}\b(happy|satisfied|positive|loyal|5[- ]star|good|best)\b[^.?!\n]{0,20}\b(customers|clients|ones|people|guests|regulars|patients)\b|\b(happy|satisfied|loyal) (customers|clients|regulars|ones) only\b|\bfilter (out )?(the )?(bad|unhappy|negative|angry)\b/i;
const BUY = /\b(buy|purchase|pay for|write|post) (you |them )?(some |more |a few |\d+ )?(5[- ]star |positive |good |fake )?reviews\b/i;
const PROMISE = /\bguarantee[ds]?\b[^.?!\n]{0,30}\b(reviews?|stars?|rating)\b|\b(remove|delete|take down)\b[^.?!\n]{0,30}\breviews?\b/i;
const REVIEW = /\breviews?\b/i;
const NEGATED = /\b(no|not|never|nothing|nobody|no one|can'?t|cannot|won'?t|don'?t|doesn'?t|isn'?t|aren'?t|without|against|breaks?|illegal|banned|forbidden|prohibited)\b/i;
const offRules = (x) => (INCENTIVE.test(x) && REVIEW.test(x)) || GATE.test(x) || BUY.test(x) || PROMISE.test(x);
const breaksRules = (t) => String(t || '').split(/(?<=[.!?])\s+|\n+/).some((x) => !NEGATED.test(x) && offRules(x));

const join = (...parts) => text.plain(parts.filter(Boolean).join(' '));

// One answer. ctx for dates; lead from kit talk; member { first, business, city }; n from lib/prices.
// cardSent: they already have the free review card. Returns { kind, label, answer, next, days, placeholder, topic }.
function answerFor({ kind, reply, lead, member, n, founding, ctx, worry = -1, intent = '', cardSent = false }) {
  const s = shortName(lead.name);
  const me = member.first || '';
  const signer = talk.signerOf(reply);
  const hi = signer ? `Hi ${signer},` : '';
  const [d1, d2] = talk.callDays(ctx);
  const soon = talk.onDay(ctx, 2).label;
  const P = prices.priceSay(n, { founding });
  const callAsk = `Could I stop by for 15 minutes on ${d1} or ${d2}?`;
  const cardOffer = cardSent ? `Want me to walk you through the card I sent? ${callAsk}` : `Want to see the counter card I'd make for ${s}? You'd have it by ${soon}.`;
  const sign = (body) => (me ? `${body}\n\n${me}` : body);
  let days = 3;
  let answer = '';
  let next = '';
  let topic = '';
  switch (kind) {
    case 'yes':
      if (cardSent) {
        answer = join("Great, thank you! The next step is a quick visit to set it up with your own review link: I'll show you where it is in your Business Profile and bring the printed cards.", callAsk);
        next = 'Book the visit, then prep it with "Prep for a call".';
      } else {
        days = 2;
        answer = join(`Great, thank you. I'll have the review card for ${s} to you by ${soon}: a counter card and handout cards with a code that opens your Google listing, ready to print.`, 'Anything you want on it, like your colors or a line you like to use?');
        next = `Make the card now ("Make a free sample") and send it by ${soon}. Then offer to drop off printed ones.`;
      }
      break;
    case 'price': {
      const bridge = worry >= 0 && BRIDGE[worry] ? BRIDGE[worry]() : '';
      if (bridge) topic = WORRY_TOPIC[worry];
      answer = join('Good question.', bridge, P.base, P.founding || P.tools, `Easiest is a quick visit where I show you the card for ${s}.`, callAsk);
      next = `You said the price once${bridge ? ` and answered the worry about ${topic}` : ''}. Now get the visit on the calendar, then prep it with "Prep for a call".`;
      break;
    }
    case 'covered':
      days = 60;
      answer = join("Good to hear you've got reviews covered.", 'If you ever want a card at the counter that takes customers straight to your Google review form, I can make one that works alongside what you use.', 'Mind if I check back in a couple of months?');
      next = 'Never knock the service they use. Check back once, in 2 months, then let it go.';
      break;
    case 'worry': {
      const o = NICHE.objections[worry] || NICHE.objections[0];
      topic = WORRY_TOPIC[worry] || '';
      const tails = [
        cardOffer,
        cardSent ? `Happy to walk your team through asking everyone the same way. ${callAsk}` : `Want to see the card I'd make for ${s}? Everyone gets the same one, and it takes 30 seconds. You'd have it by ${soon}.`,
        cardOffer,
        cardOffer,
        `Happy to show you the replies I'd write. ${callAsk}`,
        cardSent ? `Want me to drop off printed cards so you can see how little it takes? ${callAsk}` : `Want me to make the card so you can see how little it takes? You'd have it by ${soon}.`,
        `${founding ? P.founding : P.base} ${callAsk}`,
      ];
      const yes = intent === 'yes' && !cardSent && worry !== 6 ? `Either way, I'll have the card for ${s} to you by ${soon}.` : '';
      answer = join(o.a, yes || tails[worry] || tails[0]);
      if (yes) days = 2;
      next = yes ? `They said yes with a worry about ${topic}. Answer it once, then make the card ("Make a free sample") and send it by ${soon}.` : `It's a worry about ${topic}. Answer it once, calmly, and end on one question. Don't argue.`;
      break;
    }
    case 'later':
      days = talk.laterDays(reply, ctx);
      answer = join(`No problem at all. I'll check back around ${talk.onDay(ctx, days).label}.`, cardSent ? `The card I sent for ${s} is yours to keep either way.` : `The free review card for ${s} is yours whenever you want it.`);
      next = `Put ${talk.onDay(ctx, days).label} in your calendar. If they said don't check back, stop.`;
      break;
    case 'who':
      answer = join(`Sorry, I should have said! I'm ${me || 'the person who wrote you'}${member.business ? ` from ${member.business}` : ''}, and I help local shops${member.city ? ` around ${String(member.city).split(',')[0].trim()}` : ''} get more Google reviews the honest way: a card at the counter, the same ask for every customer and a reply to every review.`, `I wrote because most customers only leave a review when they're asked, and I'd like to help ${s} ask every one of them.`, cardSent ? `The card I sent shows what it would look like. ${callAsk}` : `Want me to make you the free counter card? You'd have it by ${soon}.`);
      next = "They don't know you yet. Keep it short and offer one next step.";
      break;
    case 'info':
      answer = join("Here's the short version.", QA[3].a(), "There's no contract, and the cards and the link stay yours.", cardSent ? `The card I sent for ${s} is the easiest way to see it. ${callAsk}` : `The easiest way to see it is the free counter card I'd make for ${s}. Want it by ${soon}?`);
      next = '"Send me info" often means "not sure yet". Give the short version and one next step, so it doesn\'t get buried.';
      break;
    case 'think':
      days = 3;
      answer = join('Of course, take your time.', 'If it helps, is it the price, the time it takes, or how customers will feel about being asked? Happy to answer whichever it is.', `I'll check back on ${talk.onDay(ctx, days).label} unless you'd rather I didn't.`);
      next = "Ask once what's behind it, then leave it with them.";
      break;
    case 'away':
      days = talk.backDays(reply, ctx);
      answer = join('Hope your time away went well.', cardSent ? `Floating my note back up: did the review card for ${s} come through? Happy to drop off printed ones.` : `Floating my note back up: I'd like to make you a free review card for ${s}, with a code that opens your Google listing. Want it?`);
      next = `That's an auto-reply, so don't answer it now. Send this on ${talk.onDay(ctx, days).label}, after they're back.`;
      break;
    case 'wrong': {
      const name = talk.pointedName(reply);
      const passing = /\b(pass|forward|send)(ed|ing)? (this|it|that|your)/i.test(String(reply || ''));
      answer = name ? join(`Thank you, that's really helpful. Would you mind sharing the best email for ${name}? I'll keep it short.`) : passing ? join("Thank you, I appreciate it! Could you tell me the owner's first name, so I know who to follow up with?") : join("Thanks for letting me know. Who's the best person to talk to about your Google reviews, and how can I reach them?");
      next = `They pointed you to ${name || 'someone else'}. Get the best way to reach them, then write to them directly and say who sent you.`;
      break;
    }
    case 'question': {
      const q = QA.find((x) => x.first && x.re.test(String(reply || ''))) || QA.find((x) => x.re.test(String(reply || '')));
      answer = q ? join(q.a({ s, soon }), q.tail || 'Happy to show you the rest.', callAsk) : join('Good question. [Answer it in a line or two.]', `Happy to go through the rest in person. ${callAsk}`);
      next = q ? 'Answered from your offer. Read it once before you send.' : `They asked "${talk.questionIn(reply) || 'something specific'}". Answer it where the brackets are, then send.`;
      break;
    }
    case 'stop':
      days = null;
      answer = '';
      next = "Don't send anything else, on any channel. They stay off your lists for good.";
      break;
    default:
      answer = join(cardSent ? `Thanks for getting back to me! Quick question so I don't guess: would a 15-minute visit to set up the card for ${s} be useful? A yes or no is perfect.` : `Thanks for getting back to me! Quick question so I don't guess: would a free review card for ${s} be useful? A yes or no is perfect.`);
      next = "It's hard to tell what they meant, so this asks a simple yes or no.";
  }
  const out = kind === 'stop' ? '' : sign(hi ? `${hi}\n\n${answer}` : answer);
  return { kind, label: LABEL[kind] || LABEL.other, answer: out, next, days, placeholder: /\[[^\]\n]{2,60}\]/.test(out), topic };
}

// ---------- the call card ----------

const QUESTIONS = [
  'How do most new customers find you now: Google, walking by, or word of mouth?',
  'When did your team last ask a customer for a review, and how?',
  'Who is at the counter when customers pay?',
  'Who replies to reviews now, and how soon?',
  'Is there a review you wish you had answered differently?',
  'If the cards were on your counter this week, is there anything that would stop you?',
];

// What to check before the call or visit, from the lead's facts. Short titles; the why says how.
function checkFirst({ lead, checked }) {
  const out = [];
  out.push({ item: 'Write down their Google numbers', why: "Open their listing and note the review count, the stars and the date of the newest review, with today's date. For your notes only: it's the before number for their first report." });
  out.push({ item: 'Read their three newest reviews', why: 'Did anyone reply? A reply to every review is half of what you sell.' });
  for (const f of (lead.facts || []).slice(0, 2)) out.push({ item: text.clip(f, 140), why: `From their website${checked ? ` (checked ${checked})` : ''}.` });
  out.push({ item: lead.website ? 'Check their website on your phone' : 'Look for their website', why: lead.website ? `Open ${talk.domainOf(lead.website) || 'it'} and look for reviews or testimonials. If it shows none, a reviews section with a link to Google is an easy add-on later.` : 'If they have none, the card and the receipt line do all the work.' });
  return out.slice(0, 6);
}

// The worries, the ones their notes or reply mention first.
function worriesFor(notes) {
  const t = String(notes || '');
  const order = NICHE.objections.map((o, i) => ({ ...o, i, hit: WORRY_RE[i] && WORRY_RE[i].test(t) ? 1 : 0 }));
  order.sort((a, b) => b.hit - a.hit || a.i - b.i);
  return order.map((o) => ({ says: `"${o.q}"`, answer: o.a, topic: WORRY_TOPIC[o.i], mentioned: !!o.hit }));
}

module.exports = { answerFor, kindOf, worryOf, worriesFor, checkFirst, QUESTIONS, LABEL, WORRY_RE, WORRY_TOPIC, COVERED_RE, QA, breaksRules, shortName };
