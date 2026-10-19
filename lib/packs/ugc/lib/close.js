// What a brand's reply means and the answer to send, in UGC words: kit outreach.answer gives the
// intent, kit talk adds auto-replies, the wrong person, "send info" and "let me think", and this file
// matches the brand's own worries (data/niche.json objections) and the questions brands ask, with the
// member's real price said once (lib/offer). Every answer ends in one next step. Nothing here promises
// views or sales, says the member used a product before they have, or hides that a post is an ad
// (16 CFR 255.1 and 255.5, FTC Disclosures 101). Also the call card content.

const kit = require('../../_kit');
const { text, money } = kit;
const NICHE = require('../data/niche.json');
const offer = require('./offer');
const talk = require('../../_kit/talk');
const U = require('./ugc');

const usd = (n) => money.usd(n);
const shortName = (name) => text.plain(String(name || 'your brand').replace(/\s*(,?\s*(llc|inc\.?|co\.?|company|corp\.?))+$/i, '').trim()) || 'your brand';

// data/niche.json objections, same order, with the words that signal each one.
const WORRY_RE = [
  /\b(no|not much|low|little|don'?t have( a| the| any| much| a lot of| a big| a huge| a large| the)?|tight|limited|small|zero) budget\b|\bbudget('s| is) (tight|limited|gone|spent|set|small|low)\b|\bcan'?t afford\b|\b(too )?(expensive|pricey)\b|\bnot (in|within) (our|the) budget\b|\bout of (our|the) budget\b/i,
  /\bportfolio\b|\bpast (work|clients|videos|projects)\b|\bprevious (work|clients|videos)\b|\b(examples?|samples?) of your (work|videos)\b|\bwork you'?ve done\b|\bshow (me|us) (some|your) (work|videos)\b|\bwho (else )?have you worked with\b/i,
  /\bfollowers?\b|\bhow (big|large) is your (audience|following|account)\b|\byour (audience|following)\b/i,
  /\bgift(ed)?\b|\bfree product\b|\bfor (the )?product\b|\bproduct (only|in exchange)\b|\bin exchange for (the )?products?\b|\bbarter\b|\bunpaid\b|\bwithout pay(ment)?\b|\b(do|make) it for free\b/i,
  /\b(guarantee|promise)\b|\bhow many (views|sales|orders)\b|\b(roas|conversions?|go viral|viral)\b|\bwill it (sell|work|convert)\b|\bwhat results\b/i,
  /\brun (it|them|this|the videos?) as (an? )?(paid )?ads?\b|\bpaid (ads?|usage|use)\b|\bad (usage|rights|use)\b|\busage( rights)?\b|\blicens(e|ing)\b|\bhow long can we use\b/i,
  /\bsay (that )?(you|you'?ve) (used|use|love|loved|tried)\b|\bfor (weeks|months)\b|\bbefore and after\b|\b(cured?|healed|fixed) (my|your|her|his|the)\b|\bclaims?\b/i,
  /\bpost (it |them |this )?on your (own )?(account|page|profile|channel|feed|instagram|tiktok|ig)\b|\bon your (instagram|tiktok|ig|channel|feed)\b|\bcollab post\b/i,
];
const WORRY_TOPIC = NICHE.objections.map((o) => o.topic);

function worryOf(reply) {
  const t = String(reply || '');
  return WORRY_RE.findIndex((re) => re.test(t));
}

// They already have creators (an agency, a platform or their own team): the "covered" answer.
const COVERED_RE = /\b(we (already )?(have|use|work with|pay|hire) (an? |our own |a few |some )?(agency|creators?|ugc creators?|in-?house (team|creators?)|content (team|creators?)|billo|insense|collabstr|minisocial|trend(\.io)?|joinbrands|aspire|grin|upfluence)|(billo|insense|collabstr|minisocial|trend\.io|joinbrands|aspire|grin) (handles|does|makes))\b/i;

const LABEL = {
  yes: 'Yes, they want to see it',
  price: 'They asked the price',
  covered: 'They already have creators',
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

// Questions brands ask, answered from the offer and the rules. v: { n, s, product, brand }.
const QA = [
  { first: true, re: /\bwhitelist\w*|\bspark ads?\b|\b(run|use) (it|ads?|them) (from|through|on) your (account|handle|profile)\b/i, a: (v) => `Yes: ads run from my account only with my written yes, for the days you buy, at ${usd(v.n.whitelist)} per platform for 30 days, and I can see and end the access.` },
  { first: true, re: /\bdisclos\w*|\bftc\b|(^|[\s(])#ad\b|\blabel(ed|led)? as (an )?ad\b|\bpaid partnership\b/i, a: (v) => `On your own accounts it goes out as your brand's own post or ad. If it runs from my account, as a post or a Spark Ad, it's labeled: "This is an ad for ${v.brand}" said in the video, "#ad Paid partnership with ${v.brand}" in the caption, and the platform's branded content setting on.` },
  { re: /\bhow long (is|are|should) (the|each|a|your) videos?\b|\b(format|aspect ratio|vertical|9:16|captions?|subtitles?)\b/i, a: () => 'Vertical 9:16, 15 to 60 seconds, delivered with captions and a clean version without text, named so your team can find each one.' },
  { re: /\bhow long (does|would|will) (it|this|that|filming) take\b|\bhow (fast|quick(ly)?|soon)\b|\bturn ?around\b|\bwhen (could|can|would) (you|it|we|this)\b|\bdeadline\b|\bby (next )?(monday|tuesday|wednesday|thursday|friday|week|month)\b/i, a: (v) => `${v.n.turnaround} days from the day the product arrives, with one round of edits after. A 48-hour rush is ${usd(v.n.rush)} more per video.` },
  { re: /\bcontract\b|\bagreement\b|\bterms\b|\bcancel\b|\bcommit(ment)?\b/i, a: () => "A one-page agreement: what you get, the use in plain words, the due date and payment, half up front to book the date and half on delivery. The monthly plan stops whenever you say, before the next month's bill." },
  { re: /\b(need|send|ship|mail)\b[^.?!\n]{0,20}\bproducts?\b|\bproducts? (to|for) you\b|\bdo you need (one|it|a sample)\b/i, a: () => "Yes, I film with the real product in hand. Once we agree on the brief, I'll send my shipping address, and filming starts the day it arrives." },
  { re: /\braw (footage|files|clips)\b|\bunedited\b|\ball (the )?takes\b/i, a: (v) => `Raw footage is every unedited take, for your own edits, at ${usd(v.n.raw)} per video. It comes with the same use as the video.` },
  { re: /\bhooks?\b|\b(different|more|extra) (openings?|intros?|versions?)\b|\bvariations?\b/i, a: (v) => `An extra hook is a new first 3 seconds on the same video, at ${usd(v.n.hook)} each. Brands use them to test which opening works best in ads.` },
  { re: /\bexclusiv\w*|\bcompetitors?\b|\bonly (work|film) (with|for) us\b/i, a: () => "I can agree not to make videos for a direct competitor for a set time, in writing. Tell me the category and how long, and I'll price it." },
];

// One line for a worry that comes with a price question. v: { n, product, concept }.
const BRIDGE = [
  null,
  (v) => (v.concept ? `The concept I made for ${v.product} is the best example of how I'd film it.` : ''),
  () => "My follower count doesn't change what you get: the files and the right to use them.",
  () => "I only make paid videos, but I keep the first one small so it's easy to try.",
  () => "I can't promise views or sales, but I can promise the video on time and a redo if it misses the brief.",
  (v) => `Ad use is ${usd(v.n.ads30)} a video for 30 days or ${usd(v.n.ads90)} for 90, on top of the video.`,
  () => 'I only say what I saw and felt after using it, once I have.',
  () => "If it goes on my account too, it's labeled as an ad.",
];

// What breaks the honesty rules, one sentence at a time: promising views, sales or results; saying
// you used their product; fake reviews; or an earnings claim. Sentences that say no to it ("No one
// honest can promise views or sales") are fine. Hiding that a post is an ad is never fine.
const PROMISE = /\b(guarantee[ds]?|promise[ds]?)\b[^.?!\n]{0,40}\b(views?|sales|followers|results?|roas|conversions?|clicks|revenue|orders|viral)\b/i;
const WILL = /\b(will|'ll|going to)\s+(go viral|(get|bring|drive|boost|increase|double|triple)\b[^.?!\n]{0,25}\b(views?|sales|followers|revenue|orders|conversions?|clicks|roas)\b)/i;
const USED = /\b(i|we)\s*('ve|'m| have| am)?\s*(been\s+)?(love|loved|loving|use|used|using|tried|swear by|switched to)\s+(it|this|your|their)\b/i;
const FAKE = /\b(write|post|leave)\s+(a |some )?(fake |5[- ]star |five[- ]star )?reviews?\b/i;
const INCOME = /\byou('ll| will)\s+(make|earn)\b/i;
const HIDE = /\b(no need to|don'?t (need|have) to|skip|without|leave off|leave out|hide)\b[^.?!\n]{0,20}(#ad\b|\b(disclos\w*|label\w*))/i;
const NEGATED = /\b(no|not|never|nothing|nobody|no one|can'?t|cannot|won'?t|don'?t|doesn'?t|isn'?t|aren'?t|without|only)\b/i;
const off = (x) => PROMISE.test(x) || WILL.test(x) || USED.test(x) || FAKE.test(x) || INCOME.test(x);
const breaksRules = (t) => {
  const s = String(t || '');
  if (HIDE.test(s)) return true;
  return s.split(/(?<=[.!?])\s+|\n+/).some((x) => !NEGATED.test(x) && off(x));
};

const join = (...parts) => text.plain(parts.filter(Boolean).join(' '));

// Why the member wrote, from the store fact their pitch opened on ("I saw you listed X on Sep 25.").
function whyLine(fact, prod) {
  const f = text.oneLine(String(fact || '')).replace(/\s*\((read|checked)[^)]*\)\s*$/i, '');
  if (!f) return `I wrote because ${prod} looks like a good fit for a short video.`;
  const end = /[.!?]$/.test(f) ? '' : '.';
  if (/^I saw /.test(f)) return `${f.replace(/^I saw /, 'I wrote after I saw ')}${end}`;
  if (/^I /.test(f)) return `I wrote because ${f}${end}`;
  return `I wrote because ${prod} looks like a good fit for a short video.`;
}

// The product to talk about: the one saved on the lead, else what the member typed, else theirs.
function productOf(lead = {}, brand = {}) {
  const d = (lead && lead.data) || {};
  const t = (d.product && d.product.title) || (brand.product && brand.product.title) || '';
  return t ? text.clip(String(t).split(/ [-|] /)[0], 50) : '';
}

// One answer. ctx for dates; lead from kit talk; member { first, business, site }; n from lib/offer.
// concept: they already have the concept preview. fact: the store fact the pitch opened on.
// Returns { kind, label, answer, next, days, placeholder, topic }.
function answerFor({ kind, reply, lead, member, n, founding, ctx, worry = -1, intent = '', concept = false, product = '', fact = '', emailFrom = '' }) {
  const s = shortName(lead.name);
  const prod = product || 'your best seller';
  const me = member.first || '';
  const signer = talk.signerOf(reply);
  const hi = signer ? `Hi ${signer},` : '';
  const [d1, d2] = talk.callDays(ctx);
  const soon = talk.onDay(ctx, 2).label;
  const P = offer.priceSay(n, { founding });
  const v = { n, s, brand: s, product: prod, concept };
  const callAsk = `Could we do a quick 15-minute call on ${d1} or ${d2}?`;
  const conceptAsk = `Want me to make a free 15-second concept for ${prod}? You'd have it by ${soon}.`;
  const nextAsk = concept ? callAsk : conceptAsk;
  const test = founding ? `A test video is ${usd(n.founding)} as one of my first ${NICHE.first_clients.founding_count} brands (normally ${usd(n.video)}).` : `A test video is ${usd(n.video)}.`;
  const sign = (body) => (me ? `${body}\n\n${me}` : body);
  const r = String(reply || '');
  let days = 3;
  let answer = '';
  let next = '';
  let topic = '';
  switch (kind) {
    case 'yes': {
      const q = QA.find((x) => x.re.test(r));
      if (concept) {
        answer = join('Great, thank you!', q ? q.a(v) : '', "The next step is a short brief: which product, where the video will run and when you need it.", `${callAsk} Or reply with those three things and I'll send a one-page brief back.`);
        next = 'Book the call and prep it with "Prep for a call", or send the brief with "Write a brief".';
      } else {
        days = 2;
        answer = join('Great, thank you.', q ? q.a(v) : '', `I'll send the 15-second concept for ${prod} by ${soon}, made from your product page and only for you.`, 'Is there a product you would rather I use?');
        next = `Make it now with "Pitch one brand" and send it by ${soon}.`;
      }
      break;
    }
    case 'price': {
      const bridge = worry > 0 && BRIDGE[worry] ? BRIDGE[worry](v) : '';
      if (bridge) topic = WORRY_TOPIC[worry];
      answer = join('Good question.', bridge, P.base, P.founding || P.addons, concept ? 'Easiest is a quick call to pick the product and where it will run.' : '', concept ? callAsk : conceptAsk);
      next = `You said the price once${bridge ? ` and answered the worry about ${topic}` : ''}. Now ${concept ? 'get the call on the calendar, then prep it with "Prep for a call"' : 'make the concept so they can see it'}.`;
      break;
    }
    case 'covered':
      days = 90;
      answer = join('Good to hear you have creators for this.', `If you ever want another voice for ${prod}, made directly with the use in writing, I'm here.`, 'Mind if I check back in a few months?');
      next = 'Never knock the creators or the platform they use. Check back once, in 3 months, then let it go.';
      break;
    case 'worry': {
      const o = NICHE.objections[worry] || NICHE.objections[0];
      topic = WORRY_TOPIC[worry] || '';
      const a = text.fill(o.a, { brand: s });
      const portfolio = member.site || '';
      const tails = [
        `${test} Would that fit, or should I check back in a month?`,
        null,
        nextAsk,
        `${test} ${concept ? callAsk : `Want me to make the free concept for ${prod} first?`}`,
        concept ? `Happy to walk you through how I'd film ${prod}. ${callAsk}` : `Want to see the concept I'd make for ${prod}? You'd have it by ${soon}.`,
        `Ad use is ${usd(n.ads30)} a video for 30 days or ${usd(n.ads90)} for 90. ${nextAsk}`,
        `Happy to go through what the video will say. ${callAsk}`,
        callAsk,
      ];
      if (worry === 1) {
        if (portfolio) answer = join(`Yes, here it is: ${portfolio}`, concept ? `The concept for ${prod} shows how I'd film yours. ${callAsk}` : `Want me to make a free 15-second concept for ${prod} too, so you can see it on your own product? You'd have it by ${soon}.`);
        else if (concept) answer = join(a, `If you'd like a second example, I can film a short test of ${prod} once I have it. ${test}`);
        else answer = join(`I'm building my portfolio now, so I'd rather show you than tell you: I'll make a free 15-second concept for ${prod} from your product page, in the style I'd film it.`, `You'd have it by ${soon}. Want it?`);
      } else answer = join(a, tails[worry] || nextAsk);
      if (worry === 0) days = 30;
      next = worry === 0 ? 'A budget no is often a "not yet". Offer the smallest step once, then check back in a month.' : `It's a worry about ${topic}. Answer it once, calmly, and end on one question. Don't argue.`;
      break;
    }
    case 'later':
      days = talk.laterDays(reply, ctx);
      answer = join(`No problem at all. I'll check back around ${talk.onDay(ctx, days).label}.`, concept ? `The concept for ${prod} is yours to keep either way.` : `Happy to make the free concept for ${prod} whenever it's useful.`);
      next = `Put ${talk.onDay(ctx, days).label} in your calendar. If they said don't check back, stop.`;
      break;
    case 'who':
      answer = join(`Sorry, I should have said! I'm ${me || 'the creator who wrote to you'}${member.business && member.business !== me ? `, ${member.business}` : ''}, a UGC creator: I make short vertical videos that brands post and run as ads.`, whyLine(fact, prod), emailFrom && /\bhow did you (get|find)\b/i.test(r) ? `Your email is listed on ${emailFrom}, which is where I found it.` : '', member.site ? `My work: ${member.site}` : '', concept ? `The concept I sent shows how I'd film ${prod}. ${callAsk}` : conceptAsk);
      next = "They don't know you yet. Keep it short and offer one next step.";
      break;
    case 'info':
      answer = join("Here's the short version: I make 15 to 60 second vertical videos of your product, with captions and a clean version, for your product page, your posts and your ads.", P.short, concept ? `The concept for ${prod} shows the style. ${callAsk}` : `The easiest way to see it is a free 15-second concept for ${prod}. Want it by ${soon}?`);
      next = '"Send me info" often means "not sure yet". Give the short version and one next step, so it doesn\'t get buried.';
      break;
    case 'think':
      days = 3;
      answer = join('Of course, take your time.', 'If it helps, is it the price, the use, or which product to start with? Happy to answer whichever it is.', `I'll check back on ${talk.onDay(ctx, days).label} unless you'd rather I didn't.`);
      next = "Ask once what's behind it, then leave it with them.";
      break;
    case 'away':
      days = talk.backDays(reply, ctx);
      answer = join('Hope your time away went well.', concept ? `Floating my note back up: did the 15-second concept for ${prod} come through? Happy to change the angle.` : `Floating my note back up: I'd like to make you a free 15-second concept for ${prod}, from your product page and only for you. Want it?`);
      next = `That's an auto-reply, so don't answer it now. Send this on ${talk.onDay(ctx, days).label}, after they're back.`;
      break;
    case 'wrong': {
      const name = talk.pointedName(reply);
      const passing = /\b(pass|forward|send)(ed|ing)? (this|it|that|your)/i.test(r);
      answer = name ? join(`Thank you, that's really helpful. Would you mind sharing the best email for ${name}? I'll keep it short.`) : passing ? join('Thank you, I appreciate it! Could you tell me who looks after content or ads, so I know who to follow up with?') : join(`Thanks for letting me know. Who looks after content or ads at ${s}, and how can I reach them?`);
      next = `They pointed you to ${name || 'someone else'}. Get the best way to reach them, then write to them directly and say who sent you.`;
      break;
    }
    case 'question': {
      const q = QA.find((x) => x.first && x.re.test(r)) || QA.find((x) => x.re.test(r));
      answer = q ? join(q.a(v), concept ? `Happy to go through the rest on a quick call. ${callAsk}` : conceptAsk) : join('Good question. [Answer it in a line or two.]', `Happy to go through the rest on a quick call. ${callAsk}`);
      next = q ? 'Answered from your offer. Read it once before you send.' : `They asked "${talk.questionIn(reply) || 'something specific'}". Answer it where the brackets are, then send.`;
      break;
    }
    case 'stop':
      days = null;
      answer = '';
      next = "Don't send anything else, on any channel. They stay off your lists for good.";
      break;
    default:
      answer = join(concept ? `Thanks for getting back to me! Quick question so I don't guess: would a 15-minute call about videos for ${prod} be useful?` : `Thanks for getting back to me! Quick question so I don't guess: would a free 15-second concept for ${prod} be useful?`, 'A yes or no is perfect.');
      next = "It's hard to tell what they meant, so this asks a simple yes or no.";
  }
  const out = kind === 'stop' ? '' : sign(hi ? `${hi}\n\n${answer}` : answer);
  return { kind, label: LABEL[kind] || LABEL.other, answer: out, next, days, placeholder: /\[[^\]\n]{2,60}\]/.test(out), topic };
}

// Which answer fits: a stop always wins; an auto-reply or the wrong person next; "no budget" reads
// as a price question to the kit, but the budget answer fits it better; a price question is answered
// even with a worry in it.
function kindOf({ intent, extra, worry, reply }) {
  const r = String(reply || '');
  if (intent === 'stop') return 'stop';
  if (extra === 'away' || extra === 'wrong') return extra;
  if (worry === 0) return 'worry';
  if (intent === 'price') return 'price';
  if (QA.some((q) => q.first && q.re.test(r))) return 'question';
  if (worry >= 0) return 'worry';
  if (COVERED_RE.test(r) || intent === 'covered') return 'covered';
  if (intent === 'later' || intent === 'who') return intent;
  if (extra === 'info' || extra === 'think') return extra;
  return LABEL[intent] ? intent : 'other';
}

// ---------- the call card ----------

const QUESTIONS = NICHE.call_questions;

// What to check before the call, from the brand's store. brand: a lib/ugc brand row.
function checkFirst({ brand = {}, concept = false, conceptName = '' }) {
  const out = [];
  const p = brand.product;
  const day = brand.checked ? talk.longDate(brand.checked) : '';
  if (p && p.url) out.push({ item: `Open ${U.the(text.clip(p.title, 50))} page`, why: `${p.price ? `${money.usd(p.price)}. ` : ''}${p.video === false ? `It had no video when your list read it${day ? ` on ${day}` : ''}: that's the opening for the call. ` : ''}Check what has changed since, and look at it on your phone the way their customers do.` });
  out.push({ item: 'Look up their ads in the Meta Ad Library', why: `Search "${brand.name || 'their brand'}" at facebook.com/ads/library. If ads are running, ad use and extra hooks are the add-ons that fit. If none, start with organic use.` });
  out.push({ item: 'Watch their last few posts', why: 'On their Instagram or TikTok: what they film, how long, and whether real people are in it. Your concept should feel like it belongs there.' });
  out.push(concept ? { item: 'Have the concept ready to share', why: `${conceptName ? `${conceptName}, from your Library. ` : ''}Play it near the start: it does most of the talking.` } : { item: 'Make the concept first', why: `Run "Pitch one brand" for ${brand.name || 'them'} before the call. Showing their own product on screen is the easiest thing to say yes to.` });
  for (const g of (brand.gaps || []).slice(0, 2)) if (!/^No video on/.test(g.text) || !(p && p.video === false)) out.push({ item: text.clip(g.text, 120), why: `From their store${day ? `, read ${day}` : ''}.` });
  out.push({ item: 'Have your offer open', why: 'Your three packages and the use in plain words, so you say the price once and answer usage questions without guessing.' });
  return out.slice(0, 6);
}

// The worries, the ones their notes or reply mention first.
function worriesFor(notes, brand = 'Brand name') {
  const t = String(notes || '');
  const order = NICHE.objections.map((o, i) => ({ ...o, i, hit: WORRY_RE[i] && WORRY_RE[i].test(t) ? 1 : 0 }));
  order.sort((a, b) => b.hit - a.hit || a.i - b.i);
  return order.map((o) => ({ says: `"${o.q}"`, answer: text.fill(o.a, { brand }), topic: o.topic, mentioned: !!o.hit }));
}

module.exports = { answerFor, kindOf, worryOf, worriesFor, checkFirst, productOf, QUESTIONS, LABEL, WORRY_RE, WORRY_TOPIC, COVERED_RE, QA, breaksRules, shortName };
