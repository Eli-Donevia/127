// Launch and drop emails, and the drop timeline. Code templates in the member's plain voice, built
// only from what they typed (product, date, price, why, what's in it, an offer and its end date, how
// many they made): no made-up scarcity, no countdown pressure, no results promised. The emails go to
// the member's own list through their email tool, which adds the mailing address and unsubscribe
// link from its settings (US CAN-SPAM, data/launch.json rules.canSpam).

const { text, money, time } = require('../../_kit');
const LAUNCH = require('../data/launch.json');
const { sentence } = require('./brand');

// "10:00" -> "10am", "14:30" -> "2:30pm"
function clock(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}${m[2] === '00' ? '' : `:${m[2]}`}${h >= 12 ? 'pm' : 'am'}`;
}
const dayName = (d) => time.WEEKDAYS[time.weekdayOf(d)];
const monthDay = (d) => time.longDate(d).replace(/, \d{4}$/, '');
const when = (d, t) => `${dayName(d)}, ${monthDay(d)}${t ? ` at ${clock(t)}` : ''}`;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = (v) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

function daysBetween(a, b) {
  const [y1, m1, d1] = String(a).split('-').map(Number);
  const [y2, m2, d2] = String(b).split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// A short name for subject lines, cut at a word: "Fig and Black Tea Soy Candle, 8 oz" -> "Fig and Black Tea Soy Candle".
function shortName(p) {
  const s = String(p || '').split(/\s*[,|(]\s*/)[0].trim();
  return s.length <= 40 ? s : s.slice(0, 40).replace(/\s+\S*$/, '');
}

// One fact per line, as sentences ("8 oz amber jar" -> "8 oz amber jar.").
function factLines(s, max = 5) {
  return String(s || '')
    .split(/\r?\n|;\s*/)
    .map((l) => text.oneLine(l).replace(/^[-*•]\s*/, ''))
    .filter(Boolean)
    .slice(0, max)
    .map((l) => sentence(l.replace(/^([a-z])/, (c) => c.toUpperCase())));
}

function httpsLink(v) {
  const s = text.oneLine(v || '');
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
}

// The facts every email and task draws on. Notes say what was adjusted.
function factsOf(input, br, ctx, { defaultDays = 7 } = {}) {
  const today = time.today(ctx);
  const notes = [];
  let date = isDate(input.date) && input.date > today ? input.date : '';
  if (!date) {
    date = time.addDays(today, defaultDays);
    if (input.date) notes.push(`${input.date} has passed or is today, so this plans for ${when(date)}. Change the date and run it again if you need another day.`);
  }
  let ends = isDate(input.ends) && input.ends >= date ? input.ends : '';
  if (input.ends && !ends) notes.push(`The offer end date (${input.ends}) is before the launch, so the emails leave the end date out.`);
  const offer = text.clip(text.oneLine(input.offer || ''), 90).replace(/\.$/, '');
  if (!offer) ends = '';
  const product = text.clip(text.oneLine(input.product || br.offer || 'our new product'), 90).replace(/\.$/, '');
  const qty = Number(input.quantity);
  return {
    today,
    date,
    time: isTime(input.time) ? input.time : '',
    product,
    short: shortName(product),
    price: input.price != null && Number(input.price) > 0 ? Number(input.price) : null,
    link: httpsLink(input.link),
    why: String(input.why || '')
      .split(/\r?\n+/)
      .map((p) => sentence(text.oneLine(p)))
      .filter(Boolean)
      .slice(0, 3),
    details: factLines(input.details),
    offer,
    ends,
    quantity: Number.isInteger(qty) && qty > 0 ? qty : null,
    name: br.name || 'our shop',
    first: br.firstName || '',
    mode: input.mode === 'drop' ? 'drop' : 'launch',
    notes,
  };
}

const LINK_HOLD = '[link to the product]';
const linkOf = (f) => f.link || LINK_HOLD;
const signOff = (f) => [f.first || '[your name]', f.name].filter(Boolean).join('\n');
const priceOf = (f) => (f.price ? money.usd(f.price) : '');

// The emails in send order: { n, key, title, sendOn, time, audience, subject, preview, body }.
function emails(f) {
  const seed = `${f.name}:${f.product}`;
  const days = daysBetween(f.today, f.date);
  const drop = f.mode === 'drop';
  const out = [];
  const qty = f.quantity ? (drop ? `There are ${f.quantity} in this batch.` : `I made ${f.quantity} in this first batch.`) : '';
  const price = priceOf(f);
  const inside = f.details.length ? ['', drop ? "What's in it:" : 'What goes into it:', ...f.details] : [];

  // 1. A first look
  const teaserOn = time.addDays(f.date, -Math.min(drop ? 7 : 5, Math.max(1, days - 1)));
  out.push({
    key: 'teaser',
    title: drop ? 'Save the date' : 'A first look',
    sendOn: teaserOn,
    time: '09:00',
    audience: 'Everyone on your list',
    subject: text.pickBy(`${seed}:s1`, [`Coming ${monthDay(f.date)}: ${f.short}`, `${f.short} is almost here`, `A first look at ${f.short}`]),
    preview: `It goes live ${when(f.date, f.time)}.`,
    body: [
      'Hi,',
      '',
      `I've been working on something new: ${f.product}.`,
      ...(f.why.length ? ['', f.why[0]] : []),
      '',
      `It goes live ${when(f.date, f.time)}.${qty ? ` ${qty}` : ''}`,
      ...inside.slice(0, 5),
      '',
      drop ? "I'll send the link the moment it's up." : "You're on this list, so you'll get the link the day it goes live.",
      '',
      signOff(f),
    ].join('\n'),
  });

  // 2. The day before (drops: a time to remember)
  if (drop && daysBetween(teaserOn, f.date) >= 2) {
    out.push({
      key: 'tomorrow',
      title: 'Tomorrow',
      sendOn: time.addDays(f.date, -1),
      time: '17:00',
      audience: 'Everyone on your list',
      subject: `Tomorrow${f.time ? ` at ${clock(f.time)}` : ''}: ${f.short}`,
      preview: qty || 'A quick reminder before it goes live.',
      body: ['Hi,', '', `A quick reminder: ${f.short} goes live tomorrow, ${when(f.date, f.time)}.`, '', `${qty ? `${qty} ` : ''}I'll send the link the moment it's up.`, '', signOff(f)].join('\n'),
    });
  }

  // 3. It's live
  const offerLine = f.offer ? `${sentence(f.offer)}${f.ends ? ` That runs until ${when(f.ends)}.` : ''}` : '';
  const buyLine = [price ? `${price}.` : '', offerLine, qty].filter(Boolean).join(' ');
  out.push({
    key: 'live',
    title: drop ? "It's live" : 'Launch day',
    sendOn: f.date,
    time: f.time || '09:00',
    audience: 'Everyone on your list',
    subject: text.pickBy(`${seed}:s3`, [`${f.short} is here`, `It's live: ${f.short}`, `${f.short} is in the shop`]),
    preview: sentence([price, f.offer].filter(Boolean).join('. ')) || 'In the shop now.',
    body: ['Hi,', '', `It's here: ${f.short} is in the shop now.`, ...inside, '', ...(buyLine ? [buyLine, ''] : []), `Shop it here: ${linkOf(f)}`, '', signOff(f)].join('\n'),
  });

  // 4. The story (launches with something true to tell)
  const offerEnds = f.offer && f.ends && daysBetween(f.date, f.ends) >= 2 ? f.ends : '';
  if (!drop && f.why.length && (f.why.length > 1 || f.details.length)) {
    let storyOn = time.addDays(f.date, 2);
    if (offerEnds === storyOn) storyOn = time.addDays(f.date, 1);
    out.push({
      key: 'story',
      title: 'The story',
      sendOn: storyOn,
      time: '09:00',
      audience: "Everyone who hasn't bought it yet",
      subject: text.pickBy(`${seed}:s4`, [`How ${f.short} came together`, `The story behind ${f.short}`, `Why I made ${f.short}`]),
      preview: text.clip(f.why[0], 90),
      body: ['Hi,', '', ...f.why.flatMap((p) => [p, '']), `${f.short} is in the shop${price ? ` at ${price}` : ''}: ${linkOf(f)}`, '', 'Questions about it? Just hit reply.', '', signOff(f)].join('\n'),
    });
  }

  // 5. The offer ends (only an offer and end date the member set)
  if (offerEnds) {
    out.push({
      key: 'offer_ends',
      title: 'Offer ends today',
      sendOn: offerEnds,
      time: '09:00',
      audience: "Everyone who hasn't bought it yet",
      subject: text.clip(`Ends today: ${f.offer.replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase())}`, 60),
      preview: `After today ${f.short} is still in the shop${price ? ` at ${price}` : ''}.`,
      body: [
        'Hi,',
        '',
        `A quick note: the launch offer ends today, ${when(offerEnds)}. ${sentence(f.offer)}`,
        '',
        `After today ${f.short} is still in the shop${price ? ` at ${price}` : ''}, just without the offer.`,
        '',
        `Here's the link: ${linkOf(f)}`,
        '',
        signOff(f),
      ].join('\n'),
    });
  }

  // 6. Thank you to buyers: an honest review ask with nothing attached to it (D24)
  out.push({
    key: 'thanks',
    title: 'Thank you',
    sendOn: time.addDays(f.date, 7),
    time: '09:00',
    audience: `People who bought ${f.short}`,
    subject: text.pickBy(`${seed}:s6`, ['Thank you for being one of the first', `Thanks for ordering ${f.short}`, 'A quick thank you']),
    preview: 'And one small ask, only if you have a minute.',
    body: [
      'Hi,',
      '',
      `Thank you for ordering ${f.short}. It means a lot that you were one of the first.`,
      '',
      "If anything isn't right with your order, reply to this email and I'll sort it out.",
      '',
      'And if you have a minute, an honest review on the product page helps other people decide. Good or bad, I read every one.',
      ...(drop ? ['', "I'm planning the next batch now. If there's something you'd like to see in it, hit reply."] : []),
      '',
      signOff(f),
    ].join('\n'),
  });
  return out.sort((a, b) => (a.sendOn + a.time).localeCompare(b.sendOn + b.time)).map((e, i) => ({ n: i + 1, ...e }));
}

// What the member should know before the first send.
function sendChecklist(f, list) {
  const out = [
    { title: 'Check your email footer', how: 'Your email tool adds your mailing address and an unsubscribe link to every send, from its settings. US law (CAN-SPAM) needs both, so fill them in before the first send.' },
    { title: 'Send to your own list', how: 'People who bought from you or signed up for your emails. Never addresses you found or bought.' },
    { title: 'Send yourself a test first', how: 'Check the link opens the product and the subject reads well on a phone.' },
  ];
  if (!f.link) out.splice(1, 0, { title: 'Add your product link', how: `Where an email says ${LINK_HOLD}, paste the product's address once the page is set up.` });
  if (list.some((e) => e.key === 'thanks')) out.push({ title: 'Make a list of buyers for the thank-you', how: 'Most email tools can send to customers who bought one product, through a segment or a customer tag. Set it up the day before that email goes out.' });
  if (list.some((e) => e.key === 'story' || e.key === 'offer_ends')) out.push({ title: 'Leave out people who already bought', how: 'The story and offer emails are for people who have not ordered yet. Exclude buyers if your tool lets you.' });
  return out;
}

// ---------- the drop timeline ----------
// Tasks counted back from the drop date. Anything that would fall before today starts today. The
// email sends come from emails(f), so the plan and the emails always agree.
function dropTasks(f, list = []) {
  const t = (offset, title, how, tag, at) => ({ offset, title, how, tag, ...(at ? { time: at } : {}) });
  const tasks = [
    t(-14, 'Shoot the photos and a short video', `The product on a plain background, one in use, one close-up, and a 10 to 20 second clip. Shopify shows square photos best at ${LAUNCH.imageGuide.bestSquarePx} x ${LAUNCH.imageGuide.bestSquarePx} px.`, 'make'),
    t(-12, 'Write the product page', `Title, a description that says what it is, who it's for and what's in it, the price${f.price ? ` (${money.usd(f.price)})` : ''}, and alt text on every photo.`, 'store'),
    t(-10, 'Set it to go live on its own', `Set the product to Active and schedule it for ${when(f.date, f.time)}. The steps are on this page.`, 'store'),
    t(-7, 'Post a first teaser', 'A close-up or a detail, not the whole product, with the date and time. Caption 1 below.', 'post'),
    t(-5, 'Post behind the scenes', 'Making it, packing it or testing it. Caption 2 below.', 'post'),
    t(-3, 'Check checkout and shipping', 'Turn on test mode (Settings > Payments > Shopify Payments > Manage), buy any product with the test card, check the order email and the shipping rate, then turn test mode off so real payments go through.', 'store'),
    t(-2, 'Post the full reveal', 'The whole product, the price and the time it goes live. Caption 3 below.', 'post'),
    t(-1, 'Post a countdown story', 'The time it goes live and where the link will be. Caption 4 below.', 'post'),
    t(0, 'Check it went live', `At ${f.time ? clock(f.time) : 'the time you set'}, open the product in a private window. If it isn't up, check it's Active and publish it by hand.`, 'live', f.time || ''),
    t(0, 'Post the link', 'Caption 5 below. Put the link in your bio or stories.', 'post', f.time || ''),
    t(0, 'Answer messages for the first hour', 'Reply to every question while people are deciding.', 'live'),
    t(1, 'Post a thank you', 'Thank the people who ordered. If you share how it went, use your real numbers. Caption 6 below.', 'post'),
    t(2, 'Pack and ship the first orders', 'Within the time your shipping policy says. A handwritten note goes a long way.', 'make'),
    t(8, 'Write down what you learned', 'Orders, how many are left, and where visits came from (Analytics in your Shopify admin). Pick the next drop date.', 'make'),
  ];
  for (const e of list) {
    tasks.push(t(daysBetween(f.date, e.sendOn), `Send email ${e.n}: ${e.title}`, `To ${e.audience.charAt(0).toLowerCase()}${e.audience.slice(1)}. Subject: ${e.subject}`, 'email', e.time));
  }
  const order = { make: 0, store: 1, live: 2, email: 3, post: 4 };
  return tasks
    .map((x) => {
      const d = time.addDays(f.date, x.offset);
      const moved = d < f.today;
      return { ...x, date: moved ? f.today : d, moved, when: x.offset === 0 ? 'Drop day' : x.offset < 0 ? `${-x.offset} ${x.offset === -1 ? 'day' : 'days'} before` : `${x.offset} ${x.offset === 1 ? 'day' : 'days'} after` };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.offset - b.offset || (a.time || '99').localeCompare(b.time || '99') || order[a.tag] - order[b.tag]);
}

// Captions for the drop posts (the member's facts only), dated like the tasks they go with.
function dropPosts(f) {
  const qty = f.quantity ? ` ${f.quantity} in this batch.` : '';
  const at = when(f.date, f.time);
  const price = priceOf(f);
  return [
    { n: 1, offset: -7, type: 'First teaser', caption: `Something new from ${f.name}, ${at}.${qty} Turn on post notifications to see it first.` },
    { n: 2, offset: -5, type: 'Behind the scenes', caption: `Making ${f.short}.${f.why[0] ? ` ${f.why[0]}` : ''} Live ${at}.` },
    { n: 3, offset: -2, type: 'Full reveal', caption: `Meet ${f.product}.${f.details[0] ? ` ${f.details[0]}` : ''}${price ? ` ${price}.` : ''} Live ${at}.${qty}` },
    { n: 4, offset: -1, type: 'Countdown story', caption: `Tomorrow${f.time ? ` at ${clock(f.time)}` : ''}. The link goes in my bio the moment it's live.` },
    { n: 5, offset: 0, type: "It's live", caption: `${f.short} is live. Link in bio.${f.offer ? ` ${sentence(f.offer)}` : ''}` },
    { n: 6, offset: 1, type: 'Thank you', caption: `Thank you for the orders on ${f.short}. Packing them now.` },
  ].map((p) => {
    const d = time.addDays(f.date, p.offset);
    return { ...p, date: d < f.today ? f.today : d };
  });
}

// Scheduling a product to go live, verified on Shopify's "Future publishing" page (data/launch.json).
const SCHEDULE_STEPS = LAUNCH.schedule;
const SCHEDULE_SOURCE = LAUNCH.sources.futurePublishing;

module.exports = { factsOf, emails, sendChecklist, dropTasks, dropPosts, clock, when, dayName, monthDay, daysBetween, shortName, isTime, SCHEDULE_STEPS, SCHEDULE_SOURCE, LINK_HOLD, LAUNCH };
