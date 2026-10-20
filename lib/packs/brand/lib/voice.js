// How the business sounds: voice words, do and don't, ready lines and bios. templateVoice() builds
// all of it from the member's facts without AI; bios are fitted to each platform's limit from
// data/platforms.json (a published limit, or our shorter target where none is published).

const { text } = require('../../_kit');
const PLATFORMS = require('../data/platforms.json').platforms;

const TONES = {
  friendly: {
    words: ['Warm, not gushing', 'Clear, not clipped', 'Helpful, not pushy'],
    do: ['Use first names and say thanks', 'Answer the question first, then add one helpful detail', 'Say what happens next and when'],
    dont: ['Stack exclamation points', 'Use inside jokes or slang a new customer would not get'],
    hi: 'Hi',
  },
  premium: {
    words: ['Calm, not cold', 'Precise, not fussy', 'Confident, not boastful'],
    do: ['Keep sentences short and complete', 'Name the details you take care of', 'Confirm times, prices and next steps in writing'],
    dont: ['Discount in public posts', 'Use cute abbreviations or a wall of emojis'],
    hi: 'Hello',
  },
  playful: {
    words: ['Fun, not silly', 'Bright, not loud', 'Quick, not careless'],
    do: ['Show some personality in captions', 'Use short lines people can read in a scroll', 'Still put the price and the next step in plain words'],
    dont: ['Joke about a customer problem', 'Let the joke hide the price or the booking link'],
    hi: 'Hey',
  },
  straight: {
    words: ['Direct, not blunt', 'Plain, not boring', 'Sure, not cocky'],
    do: ['Lead with the price and the time it takes', 'Use numbers instead of adjectives', 'Say yes or no, then why'],
    dont: ['Pad messages with filler', 'Promise anything you do not control'],
    hi: 'Hi',
  },
  calm: {
    words: ['Steady, not stiff', 'Kind, not vague', 'Patient, not slow'],
    do: ['Acknowledge the worry before the answer', 'Give one clear next step', 'Write like you speak in person'],
    dont: ['Rush people to decide', 'Use pressure lines like "only today"'],
    hi: 'Hi',
  },
};

const TONE_FOR_MOOD = { bold: 'straight', clean: 'straight', premium: 'premium', playful: 'playful', fresh: 'friendly', warm: 'friendly', calm: 'calm', earthy: 'calm' };

const SHARED_DO = ['Put the price per job, per visit or per item where people can see it', 'Promise only what you control: on time, done right, a redo or a refund of your own price'];
const SHARED_DONT = ['Use hype words like "best in town" or promise results you do not control', 'Invent reviews, numbers or customer stories'];

function cap(s) {
  return text.sentenceCase(String(s || '').trim());
}

// First candidate that fits n characters, else the shortest, clipped.
function fitTo(cands, n) {
  const list = cands.map((c) => text.oneLine(c)).filter(Boolean);
  const ok = list.find((c) => c.length <= n);
  if (ok) return ok;
  const shortest = list.sort((a, b) => a.length - b.length)[0] || '';
  return text.clip(shortest, n);
}

function bios(f) {
  const label = f.label;
  const place = f.cityShort ? ` in ${f.cityShort}` : '';
  const book = f.online ? 'Shop at the link below.' : 'Text or DM to book.';
  const ig = fitTo([
    `${cap(label)}${place}. ${cap(f.promise)}. ${book}`,
    `${cap(label)}${place}. ${cap(f.result)}. ${book}`,
    `${cap(label)}${place}. ${book}`,
  ], PLATFORMS.instagram.limit);
  const tt = fitTo([`${cap(label)}${place}. Real jobs, tips and how I work.`, `${cap(label)}${place}. ${book}`, `${cap(label)}${place}.`], PLATFORMS.tiktok.target);
  const fb = fitTo([`${f.name}: ${label}${place}. ${cap(f.result)}. Message us to book.`, `${f.name}: ${label}${place}. Message us to book.`, `${cap(label)}${place}.`], PLATFORMS.facebook.target);
  return [
    { platform: 'instagram', ...meta('instagram'), text: ig },
    { platform: 'tiktok', ...meta('tiktok'), text: tt },
    { platform: 'facebook', ...meta('facebook'), text: fb },
  ].map((b) => ({ ...b, chars: b.text.length }));
}

function meta(key) {
  const p = PLATFORMS[key];
  return { label: p.label, field: p.field, limit: p.limit, target: p.target, rule: p.rule, source: p.source, checked: p.checked };
}

// Facts -> a full voice kit. f: { name, label, cityShort, firstName, price, promise, result, pain, trust, tone, online }
function templateVoice(f) {
  const t = TONES[f.tone] || TONES.friendly;
  const me = f.firstName || 'I';
  const sign = f.firstName ? `${f.firstName}, ${f.name}` : f.name;
  const price = f.price ? `$${f.price}` : null;
  const lines = f.online ? [
    { use: 'Reply to "how much?"', text: price ? `${t.hi}! Prices start at ${price}, and every price is on the shop page. Tell me who it's for and I'll point you to the right one.` : `${t.hi}! Every price is on the shop page. Tell me who it's for and I'll point you to the right one.` },
    { use: 'Order confirmed', text: `Thank you for your order! I'll send tracking as soon as it ships. Thanks for choosing ${f.name}.` },
    { use: 'Order running late', text: `${t.hi}, it's ${me === 'I' ? f.name : me}. Your order is taking a day or two longer than I said. I'll send tracking the moment it ships, and if you'd rather have a refund, just reply.` },
    { use: 'After delivery', text: 'Your order should be with you now. If anything arrived damaged or wrong, reply here within 7 days with a photo and I will replace it or refund it.' },
    { use: 'Asking for a review', text: "If you love it, a short review on the shop page helps a small business like mine more than anything. Either way, thank you." },
  ] : [
    { use: 'Reply to "how much?"', text: price ? `${t.hi}! ${cap(f.label)} starts at ${price} per job, and I'll confirm the exact price before I start. Want me to check this week's openings?` : `${t.hi}! It depends on the size of the job. Send me a photo or two and I'll give you an exact price today. Want me to check this week's openings?` },
    { use: 'Booking confirmed', text: `You're booked. I'll text you the day before with a time window, and you'll get a heads up when I'm on the way. Thanks for choosing ${f.name}.` },
    { use: 'Running late', text: `${t.hi}, it's ${me === 'I' ? f.name : me}. I'm running about 15 minutes behind my last job. Still good for today, or would you like to move it?` },
    { use: 'After the job', text: `Thanks again for having me. If anything looks off, reply here within 48 hours and I'll come back and fix it.` },
    { use: 'Asking for a review', text: `If you were happy with the work, a short Google review helps a small business like mine more than anything. Here's the link. Either way, thank you.` },
  ];
  const captions = [
    `What ${/\bbusiness$/i.test(f.label) ? 'it' : f.label} looks like when someone actually takes their time. ${cap(f.result)}.`,
    `Most people put this off because of ${f.pain}. Here's how I handle it, start to finish.`,
    `Looking for a time this week${f.cityShort ? ` in ${f.cityShort}` : ''}? Message me and I'll send prices and open times.`,
  ];
  const about = `${f.name} is ${f.firstName ? `${f.firstName}'s` : 'a'} ${/\bbusiness$/i.test(f.label) ? f.label : `${f.label} business`}${f.cityShort ? ` in ${f.cityShort}` : ''}. ${f.online ? `People come to us for ${f.promise}. Every price is on the shop page, orders ship with tracking, and if something arrives damaged, we replace it or refund it.` : `People hire us for ${f.promise}. You get a clear price before any work starts, on-time arrival, and if something was missed, we come back and make it right.`}`;
  const taglines = [cap(f.result), `${cap(f.label)}, done right.`, `${cap(f.label)}${f.cityShort ? ` for ${f.cityShort}` : ''}, without the hassle.`];
  return {
    tone: f.tone,
    words: t.words,
    do: [...t.do, ...SHARED_DO],
    dont: [...t.dont, ...SHARED_DONT],
    lines,
    captions,
    about,
    taglines,
    pitch: `For anyone dealing with ${f.pain}: ${f.result}, handled by ${f.name}.`,
    signoff: sign,
    bios: bios(f),
  };
}

module.exports = { templateVoice, bios, TONES, TONE_FOR_MOOD, fitTo, PLATFORMS };
