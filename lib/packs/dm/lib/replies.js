// The DM reply bank: answers for the questions people send most, from the member's own facts.
// Facts the member gave fill the replies; anything unknown stays in [brackets] for them to fill,
// so nothing is made up. Plus four ManyChat keyword auto-replies.

const { text, money } = require('../../_kit');

// "Prices: board for 10, $145" -> { price: 'board for 10, $145' }
const FACT_KEYS = [
  ['price', /^(price|prices|pricing|cost|rates?|menu)\b/i],
  ['hours', /^(hours|open|opening|availability|schedule)\b/i],
  ['area', /^(area|areas|service area|where|location|based|serve|radius)\b/i],
  ['delivery', /^(delivery|deliver|ship|shipping|pickup|pick up)\b/i],
  ['book', /^(book|booking|order|ordering|how to order|how to book)\b/i],
  ['lead', /^(lead time|notice|turnaround|timeline|how long)\b/i],
  ['custom', /^(custom|special requests?)\b/i],
  ['review', /^(review|reviews|google review)\b/i],
];

function parseFacts(raw) {
  const out = {};
  for (const line of String(raw || '').split(/\n|;/)) {
    const m = line.match(/^\s*([^:]{2,30}):\s*(.+)$/);
    if (!m) continue;
    const hit = FACT_KEYS.find(([, re]) => re.test(m[1].trim()));
    if (hit && !out[hit[0]]) out[hit[0]] = text.oneLine(m[2]).replace(/[.]+$/, '');
  }
  return out;
}

const or = (v, ph) => (v ? v : ph);

// b: brainOf result; facts: parsed facts; link: main link
function replyBank(b, facts, link) {
  const seed = `${b.name}|replies`;
  const pick = (k, list) => text.pickBy(`${seed}|${k}`, list);
  const offer = b.offer ? b.offer.charAt(0).toLowerCase() + b.offer.slice(1) : '';
  const priceLine = facts.price ? `${text.sentenceCase(facts.price)}` : b.priceText && offer ? `My ${offer} is ${b.priceText}` : '[Your price, and what it includes]';
  const where = facts.area || (b.city ? `${b.city}${b.region ? `, ${b.region}` : ''}` : '');
  const linkLine = link ? ` Here's the link: ${link}` : '';
  const R = [
    { situation: 'How much is it?', shortcut: 'price', text: `${pick('price', ['Thanks for asking!', 'Great question!', 'Happy to help!'])} ${priceLine}.${link ? ` Everything is here: ${link}` : ' Want me to send you the details?'}` },
    { situation: 'Are you free on a certain date?', shortcut: 'date', text: `Let me check! What date and time are you thinking? ${facts.lead ? `I usually need ${facts.lead}.` : 'I\'ll confirm as soon as I can.'}` },
    { situation: 'Where are you, or do you come to me?', shortcut: 'area', text: where ? `I'm based in ${b.city || where}${facts.area ? ` and I cover ${facts.area}` : ''}. Where are you located?` : "I'm based in [your city] and I cover [your area]. Where are you located?" },
    { situation: 'How do I book or order?', shortcut: 'book', text: facts.book ? `${text.sentenceCase(facts.book)}.${linkLine}` : link ? `The easiest way is right here: ${link} Any questions, just ask.` : 'Just tell me [what you need and when], and I\'ll get you set up.' },
    { situation: 'Do you do custom orders?', shortcut: 'custom', text: facts.custom ? `${text.sentenceCase(facts.custom)}. Tell me what you have in mind and your date.` : 'Tell me what you have in mind and your date, and I\'ll let you know what I can do and what it costs.' },
    { situation: 'Is this still available?', shortcut: 'avail', text: 'It is right now! Want me to hold it for you? I can hold it until [how long you can hold it].' },
    { situation: 'It is sold out or booked up', shortcut: 'soldout', text: "That one's gone for now, sorry! Want me to message you as soon as it's back?" },
    { situation: 'Do you ship or deliver?', shortcut: 'ship', text: facts.delivery ? `${text.sentenceCase(facts.delivery)}. Where should it go?` : '[Yes, I deliver to your area / Local pickup only]. Where should it go?' },
    { situation: 'How long does it take?', shortcut: 'time', text: facts.lead ? `${text.sentenceCase(facts.lead)}. If you have a date in mind, tell me and I'll make sure it works.` : '[How long it takes]. If you have a date in mind, tell me and I\'ll make sure it works.' },
    { situation: 'Can I get a discount?', shortcut: 'discount', text: 'I keep my prices the same for everyone so it stays fair. If budget is tight, I can suggest [a smaller option] that still works well.' },
    { situation: 'Can I see more examples?', shortcut: 'examples', text: `Of course! My story highlights have more${b.website ? `, and there's more at ${b.website.replace(/^https?:\/\//, '')}` : ''}. What are you planning?` },
    { situation: 'It costs more than they expected', shortcut: 'value', text: 'Totally fair to ask. Here is what is included so you can compare: [what is included]. Happy to suggest a smaller option if that helps.' },
    { situation: 'They went quiet after your answer', shortcut: 'nudge', text: pick('nudge', ['Hi! Just checking in on this. No rush, happy to help whenever you are ready.', 'Hey! Did you still want to go ahead? Happy to answer anything first.']) },
    { situation: 'Booking or order confirmed', shortcut: 'confirm', text: "You're all set for [day and time]! I'll message you the day before. Reply here if anything changes." },
    { situation: 'They need to reschedule', shortcut: 'move', text: 'No problem at all! Which days work better for you?' },
    { situation: 'Thank you after a purchase', shortcut: 'thanks', text: "Thank you so much! If anything isn't right, message me here and I'll make it right." },
    { situation: 'Ask for a review', shortcut: 'review', text: `So glad you liked it! If you have a minute, a review would mean a lot: ${facts.review || '[your review link]'}` },
    { situation: 'Ask for a referral', shortcut: 'refer', text: 'If you know anyone who would like this too, feel free to send them my way. I really appreciate it.' },
    { situation: 'Something you do not offer', shortcut: 'notfit', text: "That's not something I do, but [someone you recommend] might be a great fit. Thanks for thinking of me!" },
    { situation: 'A brand or collab request', shortcut: 'collab', text: 'Thanks for thinking of me! Send over the details (dates, what you need and your budget) and I will get back to you.' },
  ];
  return R.map((r, i) => ({ key: `r${i + 1}`, label: r.situation, situation: r.situation, shortcut: r.shortcut, text: text.plain(r.text) }));
}

// Four keyword auto-replies for ManyChat (DM keyword trigger, "contains a whole word").
function autoReplies(b, facts, link) {
  const priceLine = facts.price ? text.sentenceCase(facts.price) : b.priceText && b.offer ? `My ${b.offer.charAt(0).toLowerCase() + b.offer.slice(1)} is ${b.priceText}` : '[Your prices]';
  const list = [
    { keyword: 'PRICE', text: `Thanks for asking! ${priceLine}.${link ? ' Tap below for everything else.' : ' Reply here with any questions.'}`, button: link ? 'See details' : '' },
    { keyword: 'BOOK', text: facts.book ? `${text.sentenceCase(facts.book)}.${link ? ' Tap below to get started.' : ''}` : link ? 'Booking is easy: tap below and pick what works for you.' : 'Tell me what you need and when, and I will get you set up.', button: link ? 'Book now' : '' },
    { keyword: 'HOURS', text: facts.hours ? `${text.sentenceCase(facts.hours)}. Message anytime and I will reply as soon as I can.` : '[Your hours]. Message anytime and I will reply as soon as I can.', button: '' },
    { keyword: facts.delivery ? 'DELIVERY' : 'AREA', text: facts.delivery ? `${text.sentenceCase(facts.delivery)}.` : facts.area ? `I cover ${facts.area}. Where are you located?` : b.city ? `I'm based in ${b.city}. Where are you located?` : "I'm based in [your city]. Where are you located?", button: '' },
  ];
  return list.map((a, i) => ({ key: `auto${i + 1}`, label: `Auto-reply when someone DMs ${a.keyword}`, keyword: a.keyword, button: a.button, text: text.plain(a.text) }));
}

module.exports = { parseFacts, replyBank, autoReplies };
