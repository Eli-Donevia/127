// Template reel scripts and story frames that send people to the keyword. Three formats per goal
// that work for any business: show the thing, a question or mistake people relate to, and a look
// behind the scenes. Lines in [brackets] are the one personal detail only the member knows; every
// other line is ready to read out. Varied per business with text.pickBy.

const { text, time } = require('../../_kit');

const cap = (s) => text.sentenceCase(String(s || ''));
const pick = (seed, list) => text.pickBy(seed, list);

function forWhom(f) {
  return f.audienceShort ? ` for ${f.audienceShort}` : '';
}

function daysUntil(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(f.today || '')) return null;
  const n = Math.round((Date.parse(`${f.date}T00:00:00Z`) - Date.parse(`${f.today}T00:00:00Z`)) / 86400000);
  return n > 0 ? n : null;
}

function insideLine(f, fallback) {
  return f.inside && f.inside.length ? `Inside: ${text.list(f.inside.map((x) => x.toLowerCase()))}.` : fallback;
}

// The call to action, said and shown, for each goal.
function cta(goal, K, f) {
  if (goal === 'story') return { say: `Send me ${K} in a DM and I'll send it over.`, text: `DM me ${K}` };
  if (goal === 'booking') return { say: `Comment ${K} and I'll send you my calendar.`, text: `Comment ${K}` };
  if (goal === 'product') return { say: `Comment ${K} and I'll send you the link.`, text: `Comment ${K} for the link` };
  if (goal === 'waitlist') return { say: `Comment ${K} and I'll add you to the waitlist.`, text: `Comment ${K} to join` };
  return { say: `Comment ${K} and I'll send it to your DMs.`, text: `Comment ${K}` };
}

function caption(goal, K, f, lead) {
  const where = !f.hasName ? (f.city ? ` ${f.city}.` : '') : f.city ? ` ${f.business}, ${f.city}.` : ` ${f.business}.`;
  const ask = goal === 'story' ? `Send me ${K} in a DM and I'll send it to you.` : goal === 'booking' ? `Comment ${K} and I'll DM you my calendar.` : goal === 'product' ? `Comment ${K} and I'll DM you the link.` : goal === 'waitlist' ? `Comment ${K} to join the waitlist.` : `Comment ${K} and I'll DM it to you.`;
  return `${lead} ${ask}${where}`.replace(/\s+/g, ' ').trim();
}

function reelsFor(goal, K, f) {
  const s = `${f.seed}|reels`;
  const c = cta(goal, K, f);
  const thing = f.thing;
  const topic = f.topic || (f.what ? f.what.toLowerCase() : 'this');
  const name = f.productName || thing;
  const launch = f.launch || thing;
  const days = daysUntil(f);
  if (goal === 'booking') {
    return [
      {
        title: 'What happens on the call',
        length: '20 to 30 seconds',
        hook: { say: pick(`${s}|1`, [`Here's exactly what happens on a ${thing}.`, `Wondering what a ${thing} with me is like? Here it is.`]), text: `What a ${thing} looks like` },
        beats: [
          { shot: 'Talking to camera, close and friendly', say: `It's for ${f.audienceShort || 'anyone thinking about it'}.`, text: 'Who it is for' },
          { shot: 'Show your notebook or screen', say: 'We go through [the 2 things you always cover].', text: 'What we cover' },
          { shot: 'Point down to the caption', say: 'You leave knowing your next step, whatever you decide.', text: 'No pressure' },
        ],
        cta: c,
        caption: caption(goal, K, f, `What a ${thing} with me looks like.`),
      },
      {
        title: 'Before and after',
        length: '15 to 20 seconds',
        hook: { say: pick(`${s}|2`, ['Before and after. Watch the end.', 'This took [how long it took]. Here is the before.']), text: 'Before / after' },
        beats: [
          { shot: 'The before, 2 seconds, wide', say: '', text: 'Before' },
          { shot: 'Two or three quick clips of you working', say: '[One line on what you did]', text: '' },
          { shot: 'The after, slow pan, hold for 3 seconds', say: '', text: 'After' },
        ],
        cta: { say: `Want this for yours? ${c.say}`, text: c.text },
        caption: caption(goal, K, f, 'Before and after, from a real job.'),
      },
      {
        title: 'The question everyone asks',
        length: '20 to 30 seconds',
        hook: { say: `The question I get most about ${topic}: [the question].`, text: 'Most asked question' },
        beats: [
          { shot: 'Talking to camera', say: '[Your honest answer in two sentences]', text: '' },
          { shot: 'Show an example on screen or in your hands', say: 'Here is what that looks like.', text: '' },
        ],
        cta: { say: `Got your own question? ${c.say}`, text: c.text },
        caption: caption(goal, K, f, `The question I get most about ${topic}.`),
      },
    ];
  }
  if (goal === 'product') {
    return [
      {
        title: 'Show the product',
        length: '15 to 20 seconds',
        hook: { say: `This is the ${name}${f.price ? `, and it's ${f.price}` : ''}.`, text: cap(name) },
        beats: [
          { shot: 'Close-up in natural light, slow turn', say: f.productDetail ? text.clip(f.productDetail, 110) : '[What it is made of or what it is for]', text: '' },
          { shot: 'It in use, in a real setting', say: '[One way people use it]', text: '' },
          { shot: 'Hold it up to camera', say: '', text: f.price ? f.price : '' },
        ],
        cta: c,
        caption: caption(goal, K, f, `The ${name}${f.price ? `, ${f.price}` : ''}.`),
      },
      {
        title: 'Pack an order with me',
        length: '15 to 25 seconds',
        hook: { say: pick(`${s}|p2`, [`Pack an order of the ${name} with me.`, `Someone just ordered the ${name}. Let's pack it.`]), text: 'Packing an order' },
        beats: [
          { shot: 'Top-down: box, tissue, the product', say: '', text: '' },
          { shot: 'Your hands adding the finishing touch', say: '[The small thing you add to every order]', text: '' },
          { shot: 'Box closed, label on', say: 'Off it goes.', text: '' },
        ],
        cta: { say: `Want one? ${c.say}`, text: c.text },
        caption: caption(goal, K, f, `Packing an order of the ${name}.`),
      },
      {
        title: 'Three ways to use it',
        length: '20 to 30 seconds',
        hook: { say: `3 ways to use the ${name}.`, text: `3 ways to use it` },
        beats: [
          { shot: 'Way 1 in action', say: '[Way 1]', text: '1' },
          { shot: 'Way 2 in action', say: '[Way 2]', text: '2' },
          { shot: 'Way 3 in action', say: '[Way 3, your favorite]', text: '3' },
        ],
        cta: c,
        caption: caption(goal, K, f, `3 ways to use the ${name}.`),
      },
    ];
  }
  if (goal === 'waitlist') {
    return [
      {
        title: 'Sneak peek',
        length: '10 to 15 seconds',
        hook: { say: `Something new is coming${f.dateText ? ` on ${f.dateText}` : ''}.`, text: `${cap(launch)}${f.dateText ? `: ${f.dateText}` : ': coming soon'}` },
        beats: [
          { shot: 'Quick glimpses, nothing fully shown', say: '', text: '' },
          { shot: 'Your face, a little smile', say: `It's ${launch}.`, text: '' },
        ],
        cta: c,
        caption: caption(goal, K, f, `${cap(launch)} is coming${f.dateText ? ` ${f.dateText}` : ''}.`),
      },
      {
        title: 'Why I made it',
        length: '20 to 30 seconds',
        hook: { say: `Why I'm making ${launch}.`, text: `Why ${launch}` },
        beats: [
          { shot: 'Talking to camera', say: '[The reason, in one honest sentence]', text: '' },
          { shot: 'Show the work in progress', say: 'Here is where it is right now.', text: 'In progress' },
        ],
        cta: { say: `Want to hear first when it opens? ${c.say}`, text: c.text },
        caption: caption(goal, K, f, `Why I'm making ${launch}.`),
      },
      {
        title: days ? 'Countdown' : 'Progress update',
        length: '10 to 15 seconds',
        hook: { say: days ? `${days} days until ${launch}.` : `${cap(launch)}: progress update.`, text: days ? `${days} days to go` : 'Progress update' },
        beats: [
          { shot: 'What you did today on it, 3 quick clips', say: '[What you finished today]', text: '' },
          { shot: 'What is left', say: '[What is left to do]', text: '' },
        ],
        cta: c,
        caption: caption(goal, K, f, days ? `${days} days until ${launch}.` : `${cap(launch)} progress update.`),
      },
    ];
  }
  // freebie and story: the thing is a resource
  return [
    {
      title: 'Show it',
      length: '15 to 20 seconds',
      hook: { say: pick(`${s}|f1`, [`I made a free ${thing}${forWhom(f)}, and it's yours.`, `I made this ${thing}${forWhom(f)}, and it's free.`, `Free ${thing}${forWhom(f)}. Here's how to get it.`]), text: `Free ${thing}` },
      beats: [
        { shot: 'Flip through it on your phone or a printout, one page a second', say: insideLine(f, "Here's a quick look inside."), text: '' },
        { shot: 'Close-up of the part people ask about most', say: '[The page you would start with, and why]', text: '' },
      ],
      cta: c,
      caption: caption(goal, K, f, `Free ${thing}${forWhom(f)}.`),
    },
    {
      title: 'The common mistake',
      length: '20 to 30 seconds',
      hook: { say: `The mistake I see most with ${topic}: [the mistake].`, text: `${cap(topic)}: the common mistake` },
      beats: [
        { shot: 'Show the mistake, or describe it to camera', say: '[What it looks like]', text: 'The mistake' },
        { shot: 'Show the fix', say: '[The fix, in one line]', text: 'The fix' },
      ],
      cta: { say: `My free ${thing} covers the rest. ${c.say}`, text: c.text },
      caption: caption(goal, K, f, `The mistake I see most with ${topic}, and the fix.`),
    },
    {
      title: 'Behind the scenes',
      length: '15 to 25 seconds',
      hook: { say: pick(`${s}|f3`, f.hasName ? [`A look behind the scenes at ${f.business}.`, `What goes into ${topic} at ${f.business}.`] : ['A look behind the scenes.', `What goes into ${topic}.`]), text: 'Behind the scenes' },
      beats: [
        { shot: 'Your hands working, 3 quick clips', say: '[One thing you always do that most people skip]', text: '' },
        { shot: 'The finished result, slow pan', say: '', text: '' },
      ],
      cta: { say: `Want my free ${thing}? ${c.say}`, text: c.text },
      caption: caption(goal, K, f, f.hasName ? `Behind the scenes at ${f.business}.` : 'Behind the scenes.'),
    },
  ];
}

// Three story frames: a hook, what it is, and the ask. Text only: the frames tool designs them.
// A product description as up to 3 short lines for a story card, whole sentences where they fit.
function detailLines(detail) {
  const parts = String(detail || '')
    .split(/(?<=[.!?])\s+|\s*[\n\u2022|]\s*/)
    .map((x) => x.trim().replace(/[.]+$/, ''))
    .filter((x) => x.length >= 8 && x.length <= 70);
  return parts.length ? parts.slice(0, 3) : [require('./facts').shortDetail(detail, 70).replace(/[.]$/, '')];
}

function storiesFor(goal, K, f) {
  const thing = f.thing;
  const name = f.productName || thing;
  const launch = f.launch || thing;
  const askSub = { freebie: "and I'll send it to you", story: "and I'll send it to you", booking: "and I'll send my calendar", product: 'and I\'ll send the link', waitlist: 'to join the waitlist' }[goal] || "and I'll send it to you";
  if (goal === 'booking') {
    return [
      { kicker: f.hasName ? f.business : 'Quick question', title: 'Not sure what you need?', lines: ["Let's work it out on a quick call"], sticker: 'Add a poll sticker: "Yes" / "Not yet"' },
      { kicker: 'How it works', title: `Book a ${thing}`, lines: ['Pick a time that suits you', 'We talk it through', 'You leave with a next step'], sticker: '' },
      { kicker: 'Want one?', title: `Reply ${K}`, lines: [askSub], sticker: 'Leave the reply box clear at the bottom', cta: true },
    ];
  }
  if (goal === 'product') {
    return [
      { kicker: f.hasName ? f.business : 'Just in', title: cap(name), lines: f.price ? [f.price] : [], sticker: 'Add a slider or emoji poll if you like' },
      { kicker: 'The details', title: cap(name), lines: f.productDetail ? detailLines(f.productDetail) : f.inside && f.inside.length ? f.inside.slice(0, 3) : [f.price, f.hasName ? `From ${f.business}${f.city ? ` in ${f.city}` : ''}` : '', 'Link sent straight to your DMs'].filter(Boolean), sticker: '' },
      { kicker: 'Want the link?', title: `Reply ${K}`, lines: [askSub], sticker: 'Leave the reply box clear at the bottom', cta: true },
    ];
  }
  if (goal === 'waitlist') {
    return [
      { kicker: 'Coming soon', title: cap(launch), lines: f.dateText ? [f.dateText] : [], sticker: 'Add a countdown sticker set to launch day' },
      { kicker: 'Join the waitlist', title: 'Hear first', lines: ['The waitlist hears first when it opens', 'Unsubscribe anytime'], sticker: '' },
      { kicker: 'Want in?', title: `Reply ${K}`, lines: [askSub], sticker: 'Leave the reply box clear at the bottom', cta: true },
    ];
  }
  const inside = f.inside && f.inside.length ? f.inside.slice(0, 3) : [f.hasName ? `Made by ${f.business}` : 'Made by me', 'Free', 'Sent straight to your DMs'];
  return [
    { kicker: f.hasName ? f.business : 'Free for you', title: `Want my free ${text.clip(thing, 40)}?`, lines: [], sticker: 'Add a poll sticker: "Yes please" / "Maybe later"' },
    { kicker: "What's inside", title: cap(thing), lines: inside, sticker: '' },
    { kicker: 'Want it?', title: `Reply ${K}`, lines: [askSub], sticker: 'Leave the reply box clear at the bottom', cta: true },
  ];
}

function promoFallback(goal, K, f) {
  return { reels: reelsFor(goal, K, f), stories: storiesFor(goal, K, f), pinned: cta(goal, K, f).say };
}

module.exports = { promoFallback, reelsFor, storiesFor, cta, daysUntil };
