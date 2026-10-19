// Template drafts for every message in a DM funnel, built from the member's own facts. These are
// what members get when AI is off or answers badly, so each one reads like a person wrote it:
// short, warm, one ask per message, the keyword and the thing named plainly. Varied per business
// with text.pickBy so two members never get the same words.

const { text } = require('../../_kit');
const { fitButton, LIMITS } = require('./limits');
const { FOLLOW_UP_HOURS } = require('./goals');

const pick = (seed, list) => text.pickBy(seed, list);

// n distinct items from a list, in a stable order for this seed.
function pickN(seed, list, n) {
  return list
    .map((x, i) => ({ x, k: text.hash(`${seed}|${i}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((o) => o.x);
}

const cap = (s) => text.sentenceCase(String(s || ''));
const article = text.aOrAn;

// A button label that fits ManyChat's limit, trying the nicest first.
function button(seed, options) {
  const fits = options.map((o) => fitButton(o)).filter((o) => o && o.length <= LIMITS.button);
  return pick(seed, fits.length ? fits : ['Send it']);
}

function shortKind(f) {
  return String(f.kind || 'link').replace(/^cheat sheet$/, 'cheat sheet');
}

// ---------- public replies (5, rotated; no links) ----------

const PUBLIC = {
  freebie: [
    'Sent! Check your DMs.',
    'Just sent it to you. Check your DMs.',
    'On its way to your inbox now.',
    'Done! Look for my message.',
    'Sent. If you don\'t see it, check your message requests.',
    'It\'s in your DMs!',
    'Sending it over now.',
    'Check your DMs, it\'s there.',
    'Got you. Check your messages.',
    'Sent! Tell me what you think.',
  ],
  booking: [
    'Sent you a DM!',
    'Check your DMs, I sent you my calendar.',
    'Just messaged you.',
    'Sent! Look for my message.',
    'Messaged you. If you don\'t see it, check your message requests.',
    'In your DMs now.',
    'Check your messages!',
    'Sent you the details.',
    'Just sent it. Talk soon!',
    'Done! It\'s in your inbox.',
  ],
  product: [
    'Sent you the link!',
    'Link is in your DMs.',
    'Just sent it to you.',
    'Check your DMs!',
    'Sent! If you don\'t see it, check your message requests.',
    'On its way to your inbox.',
    'Messaged you the details.',
    'Done, check your messages.',
    'Sent you everything.',
    'It\'s in your DMs now.',
  ],
  story: ['Sent!', 'Check your DMs.', 'Just sent it.', 'In your inbox now.', 'Sent you the link.', 'Messaged you!'],
  waitlist: [
    'Check your DMs to get on the list!',
    'Sent you the waitlist.',
    'Just messaged you the details.',
    'In your DMs now.',
    'Sent! If you don\'t see it, check your message requests.',
    'Check your messages to join.',
    'Done! Look for my DM.',
    'Sent you everything.',
    'Messaged you. Talk soon!',
    'It\'s in your inbox.',
  ],
};

function publicReplies(goal, f) {
  return pickN(`${f.seed}|public`, PUBLIC[goal] || PUBLIC.freebie, 5);
}

// ---------- the flows ----------

function freebie(f, { keyword, emailCapture }) {
  const s = `${f.seed}|freebie`;
  const k = shortKind(f);
  const opening = pick(`${s}|open`, [
    `Hey, thanks for the comment! Your ${f.thing} is ready. Tap the button below and I'll send it right over.`,
    `Hi! So glad you want the ${f.thing}. Tap below and it's yours.`,
    `Thanks for commenting! I made this ${k} ${f.audienceShort ? `for ${f.audienceShort}` : 'to make things easier'}. Tap the button and I'll send the link.`,
    `Hey! You asked for the ${f.thing}, so here it comes. Tap below and I'll send it.`,
  ]);
  const link = pick(`${s}|link`, [
    `Here you go: your ${f.thing}. Save this chat so you can find it later.`,
    `Here it is! Your ${f.thing} is behind the button below. Questions while you use it? Just reply here.`,
    `All yours. Open the ${k} below, and if anything's unclear, send me a message.`,
    `Here's your ${f.thing}. Enjoy it, and tell me how it goes.`,
  ]);
  const follow = pick(`${s}|follow`, [
    `Quick nudge in case this got buried: your ${f.thing} is still here. Tap below to open it.`,
    `Did you get a chance to open the ${f.thing}? Here's the link again.`,
    `Just making sure this reached you. Your ${f.thing} is one tap away.`,
  ]);
  return {
    opening: { text: opening, button: button(`${s}|b1`, ['Send it', 'Yes, send it', `Send the ${k}`, 'Send it over', 'I want it']) },
    emailAsk: emailCapture
      ? {
          text: pick(`${s}|email`, [
            `Want a copy in your email too? Type your email below and I'll send it there, along with the occasional tip from ${f.business}. Unsubscribe anytime.`,
            `Before I send it: what's your email? I'll send the ${k} there too so it doesn't get lost, plus the occasional note from ${f.business}. You can unsubscribe anytime.`,
          ]),
        }
      : null,
    linkMessage: { text: link, button: button(`${s}|b2`, [`Open the ${k}`, `Get the ${k}`, 'Open it', 'Get it here']) },
    followUp: { text: follow, button: button(`${s}|b3`, ['Open it now', 'Open the link', `Get the ${k}`]) },
    keyword,
  };
}

const QUALIFY = [
  ['Ready to start', 'Need a quote', 'Just questions'],
  ['Ready to book', 'Comparing options', 'Just curious'],
  ['Getting started', 'Need a price', 'Have a question'],
];

function booking(f, { keyword, emailCapture }) {
  const s = `${f.seed}|booking`;
  const call = /call|chat|consult|session/i.test(f.thing) ? f.thing : `${f.thing} call`;
  const opening = pick(`${s}|open`, [
    `Hey, thanks for the comment! Want to grab a time for a ${call}? Tap below and I'll send my calendar.`,
    `Hi! Happy to help. Tap the button and I'll send you a link to book a ${call} at a time that works for you.`,
    `Thanks for reaching out! Booking a ${call} takes one minute. Tap below and I'll send the link.`,
  ]);
  const qualifier = pick(`${s}|q`, [
    'Quick question first so I can make the call useful: where are you at?',
    'So I can come prepared, which one sounds most like you?',
    'Before I send times, which of these fits you best?',
  ]);
  const link = pick(`${s}|link`, [
    `Perfect. Here's my calendar: pick any open time that works for you. If none fit, reply here with a day that does.`,
    `Great, thanks! Grab any open time below. I'll come ready with ideas for you.`,
    `Got it. Here's the link to book your ${call}. Pick whatever time suits you.`,
  ]);
  const follow = pick(`${s}|follow`, [
    `Still want to chat? My calendar is below. If none of the times work, reply with a day that does and I'll make it work.`,
    `Just checking in: did you find a time that works? Here's the link again.`,
    `In case this got buried, here's my calendar again. Happy to answer questions here first, too.`,
  ]);
  return {
    opening: { text: opening, button: button(`${s}|b1`, ['Send times', 'Yes, send times', 'Send my options', "Let's talk"]) },
    qualifier: { text: qualifier, options: pick(`${s}|qo`, QUALIFY) },
    emailAsk: emailCapture
      ? { text: `What's the best email for your booking details? ${f.business} will only use it for your call and the occasional update. Unsubscribe anytime.` }
      : null,
    linkMessage: { text: link, button: button(`${s}|b2`, ['Pick a time', 'See open times', 'Book my call']) },
    followUp: { text: follow, button: button(`${s}|b3`, ['Pick a time', 'See open times', 'Book a time']) },
    keyword,
  };
}

function product(f, { keyword, emailCapture }) {
  const s = `${f.seed}|product`;
  const name = f.productName || f.thing;
  const priceLine = f.price ? ` is ${f.price}` : '';
  const detail = f.productDetail ? ` ${f.productDetail}` : '';
  const opening = pick(`${s}|open`, [
    `Hey! Thanks for asking about the ${name}. Tap below and I'll send you the link.`,
    `Hi! You wanted the ${name}? Tap the button and the link is yours.`,
    `Thanks for the comment! Tap below and I'll send everything you need to know about the ${name}.`,
  ]);
  const link = pick(`${s}|link`, [
    `Here it is: the ${name}${priceLine}.${detail} Any questions, just reply here.`,
    `Here's the link to the ${name}${priceLine}.${detail} Questions about sizes, timing or shipping? Ask me here.`,
    `All yours: the ${name}${priceLine}.${detail} Reply if you want help choosing.`,
  ]);
  const follow = pick(`${s}|follow`, [
    `Still thinking about the ${name}? Here's the link again in case you lost it. Happy to answer questions.`,
    `Quick nudge: the ${name} is one tap away. Reply here if you have a question first.`,
    `Just making sure the link reached you. Here's the ${name} again.`,
  ]);
  return {
    opening: { text: opening, button: button(`${s}|b1`, ['Send the link', 'Yes please', 'Show me', 'Send it']) },
    emailAsk: emailCapture ? { text: `Want first word on new ${f.topic || 'drops'} and restocks? Type your email below. Unsubscribe anytime.` } : null,
    linkMessage: { text: link, button: button(`${s}|b2`, ['Shop now', `See the ${text.oneLine(name).split(' ').slice(-1)[0]}`, 'View it']) },
    followUp: { text: follow, button: button(`${s}|b3`, ['See it again', 'View it', 'Shop now']) },
    keyword,
  };
}

function story(f, { keyword, emailCapture }) {
  const s = `${f.seed}|story`;
  const k = shortKind(f);
  const link = pick(`${s}|link`, [
    `Thanks for replying! Here's the ${f.thing}: tap below to open it.`,
    `You got it! Your ${f.thing} is right below.`,
    `Love that you replied. Here's the ${f.thing}, enjoy!`,
  ]);
  const follow = pick(`${s}|follow`, [
    `Did you get a chance to open the ${f.thing}? Here it is again.`,
    `Quick nudge: your ${f.thing} is still here. Tap below to open it.`,
  ]);
  return {
    emailAsk: emailCapture ? { text: `Want it in your email too? Type your email below and I'll send it, plus the occasional note from ${f.business}. Unsubscribe anytime.` } : null,
    linkMessage: { text: link, button: button(`${s}|b2`, [`Open the ${k}`, 'Open it', 'Get it here']) },
    followUp: { text: follow, button: button(`${s}|b3`, ['Open it now', 'Open the link']) },
    keyword,
  };
}

function waitlist(f, { keyword, emailCapture }) {
  const s = `${f.seed}|waitlist`;
  const launch = f.launch || f.thing;
  const when = f.dateText ? `opens ${f.dateText}` : 'is almost here';
  const opening = pick(`${s}|open`, [
    `Hey! ${cap(launch)} ${when}. Want to hear first when it does? Tap below.`,
    `Hi! Thanks for the comment. ${cap(launch)} ${when}, and the waitlist hears about it first. Tap below to join.`,
    `So glad you're excited about ${launch}! Tap the button and I'll add you to the list.`,
  ]);
  const confirm = emailCapture
    ? pick(`${s}|confirm`, [
        `You're on the list! I'll email you${f.dateText ? ` on ${f.dateText}` : ' the day it opens'}. Keep an eye on my stories for sneak peeks.`,
        `Done, you're in! Watch your inbox${f.dateText ? ` on ${f.dateText}` : ' on launch day'}.`,
      ])
    : pick(`${s}|link`, [
        `Here's the waitlist: add your email and you'll hear first when ${launch} opens.`,
        `Tap below to join the waitlist. One email address and you're on it.`,
      ]);
  const follow = pick(`${s}|follow`, [
    `Still want to hear first about ${launch}? The waitlist is below.`,
    `Quick nudge in case this got buried: here's the waitlist link again.`,
  ]);
  return {
    opening: { text: opening, button: button(`${s}|b1`, ['Add me', 'Count me in', "I'm in"]) },
    emailAsk: emailCapture
      ? { text: `Great! What's the best email for launch day? I'll only email you about ${launch} and news from ${f.business}. Unsubscribe anytime.` }
      : null,
    linkMessage: { text: confirm, button: emailCapture ? null : button(`${s}|b2`, ['Join the waitlist', 'Join the list']) },
    followUp: emailCapture ? null : { text: follow, button: button(`${s}|b3`, ['Join the waitlist', 'Join the list']) },
    keyword,
  };
}

const BUILDERS = { freebie, booking, product, story, waitlist };

// The whole funnel's copy as one object (the shape dm.write_flow returns).
function flowFallback(goal, f, opts) {
  const flow = (BUILDERS[goal] || freebie)(f, opts);
  return { publicReplies: goal === 'story' ? [] : publicReplies(goal, f), ...flow };
}

// One line for DM keyword triggers ("Send me GUIDE" works too): same flow, different door.
function dmKeywordNote(keyword) {
  return `People who send you ${keyword} in a DM get the same messages.`;
}

module.exports = { flowFallback, publicReplies, pickN, button, dmKeywordNote, article, FOLLOW_UP_HOURS };
