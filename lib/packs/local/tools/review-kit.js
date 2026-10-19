// local.review_kit: everything to get the first 10 Google reviews the honest way. A sheet of 10 QR
// review cards and a counter sign in the member's colors (print-ready HTML with PNG previews), the
// text, email and in-person asks, a list of personal asks for past customers, and a 7-day plan.
// Same ask for every customer, nothing offered in return (Google and FTC rules in data/reviews.json).

const kit = require('../../_kit');
const { text, ai, files, save, views, time, qr } = kit;
const F = require('../lib/facts');
const art = require('../lib/art');
const page = require('../lib/page');
const { BIZ, ASSET, ASSETS, typed } = require('../lib/common');
const { reviewLink } = require('../lib/review-link');
const REV = require('../data/reviews.json');

const TEXTS = [
  'Hi {greet}, thanks again for choosing {name} today. If you have a minute, would you leave us a Google review? It helps neighbors find a small local business. {link}',
  'Hi {greet}! Thank you for having {name} out today. Could you share how it went in a quick Google review? Here is the link: {link}',
  'Thanks so much, {greet}. If you have a minute, a Google review about today would help {name} a lot: {link}',
];
const REMINDERS = [
  'Hi {greet}, just a friendly nudge in case the link got buried: {link} No worries at all if you are busy. Thanks again!',
  'Hi {greet}, one last note from {name}: if you get a minute, here is the review link again. {link} Thank you either way!',
];
const IN_PERSON = [
  'Before I go: if you have a minute later, a Google review really helps a small business like mine. Here is a card with the link.',
  'Thanks for having me. I leave this card with everyone: scan it if you want to tell other people how it went.',
];

function greetOf(name) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first || 'there';
}

function parseCustomers(raw, max = 50) {
  return String(raw || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => {
      const parts = l.split(/\s*[,;\t]\s*/);
      const name = text.clip(parts[0] || '', 60);
      const rest = parts.slice(1).join(' ');
      const email = (rest.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0];
      const phone = (rest.match(/\+?\d[\d\s().-]{6,}\d/) || [''])[0].trim();
      return { name, email, phone };
    })
    .filter((c) => c.name);
}

function fallbackAsks(f, link) {
  const seed = f.name + (f.what || '');
  const vars = { name: f.name, link, greet: '{first name}' };
  return {
    text: text.fill(text.pickBy(seed, TEXTS), vars),
    subject: text.pickBy(seed + 's', ['How did we do?', `A quick favor from ${f.name}`, 'Thanks for today']),
    email: text.fill(
      `Hi {greet},\n\nThank you for choosing {name}. If you have a minute, would you share how it went in a Google review? It takes about a minute and helps neighbors find a small local business.\n\n{link}\n\nThank you,\n${f.firstName || f.name}`,
      vars
    ).replace(/\n /g, '\n'),
    reminder: text.fill(text.pickBy(seed + 'r', REMINDERS), vars),
    inPerson: text.pickBy(seed + 'p', IN_PERSON),
  };
}

const ASK_SCHEMA = {
  type: 'object',
  required: ['text', 'subject', 'email', 'reminder', 'inPerson'],
  properties: {
    text: { type: 'string', maxLength: 320 },
    subject: { type: 'string', maxLength: 70 },
    email: { type: 'string', maxLength: 900 },
    reminder: { type: 'string', maxLength: 280 },
    inPerson: { type: 'string', maxLength: 240 },
  },
};

function okAsks(link) {
  return (d) => ai.cleanCopy(d) && d.text.includes(link) && d.reminder.includes(link) && d.email.includes(link) && !/discount|free|gift|coupon|% off|\$\d|raffle|entry|reward|5[- ]star|five[- ]star|positive review/i.test(JSON.stringify(d));
}

module.exports = {
  name: 'local.review_kit',
  title: 'Make a review kit',
  description: 'Makes 10 QR review cards and a counter sign in your colors that open your Google review box, the text, email and in-person asks, a personal ask for each past customer, and a 7-day plan. Nothing offered for reviews.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 4,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      ...BIZ,
      link: { type: 'string', title: 'Your Google review link or Place ID (optional)', maxLength: 400, description: 'From your Business Profile (Ask for reviews). Without it the cards open your listing on Google Maps.' },
      customers: { type: 'string', title: 'Recent customers, one per line (optional)', maxLength: 6000, description: 'Like "Maria Lopez, 512 555 0142". Each gets a personal ask. Nothing is sent for you.' },
    },
  },
  output: {
    type: 'object',
    required: ['link', 'asks', 'files'],
    properties: {
      business: { type: 'string' },
      link: { type: 'string' },
      linkKind: { type: 'string' },
      placeId: { type: 'string' },
      linkNote: { type: 'string' },
      asks: { type: 'object' },
      customers: { type: 'array', items: { type: 'object' } },
      rules: { type: 'array', items: { type: 'string' } },
      plan: { type: 'array', items: { type: 'string' } },
      qr: { type: 'object' },
      files: { type: 'object', properties: { cards: ASSET, sign: ASSET, previews: ASSETS, customers: ASSET, calendar: ASSET } },
      sample: { type: 'boolean' },
      ai: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, input);
    const saved = F.settingsOf(ctx, F.PACK);
    const link = await reviewLink(ctx, input, f, input.link ? {} : saved);
    await F.saveSettings(ctx, { ...typed(input), placeId: link.placeId, reviewLink: link.kind === 'maps_search' ? null : link.url });

    const fallback = fallbackAsks(f, link.url);
    const res = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short, warm review requests a small local business owner sends to their own customers. Plain text. Never offer anything in return, never ask for a positive or 5-star review, never mention discounts. Every message includes the link exactly as given.',
      prompt: `Business: ${f.name}. What they do: ${f.what || f.group.label}. Owner first name: ${f.firstName || 'unknown'}. Review link: ${link.url}\nWrite: text (one SMS, under 300 characters, starts with "Hi {first name}"), subject (email subject), email (short email body signed by the owner), reminder (one gentle reminder 3 days later), inPerson (one line to say at the end of the job). Use {first name} where the customer's name goes.`,
      schema: ASK_SCHEMA,
      fallback: () => fallback,
      accept: okAsks(link.url),
    });
    const asks = res.data || fallback;

    // A personal ask per customer, filled in code (no AI per person).
    const customers = parseCustomers(input.customers).map((c) => ({
      ...c,
      text: asks.text.replace(/\{first name\}/g, greetOf(c.name)),
      reminder: asks.reminder.replace(/\{first name\}/g, greetOf(c.name)),
    }));

    // Print: 10 cards and the counter sign.
    const cards = Array.from({ length: 10 }, (_, i) => (x, y) => art.reviewCard(f, link.url, { ox: x, oy: y, id: `rc${i}` }).svg);
    const sheet = { svg: art.cardSheet(cards), w: 816, h: 1056 };
    const one = art.reviewCard(f, link.url);
    const sign = art.counterSign(f, link.url);
    const base = save.fileName(f.name, 'review');
    const cardFiles = await page.savePrintable(ctx, {
      base: `${base}-cards`,
      title: `${f.name}: 10 review cards`,
      pages: [sheet],
      notes: ['Print on card stock at 100% scale (Actual size), then cut on the crop marks. Each card is 3.5 by 2 inches.', 'Scan one card with your phone before you print the rest.', 'Hand one to every customer at the end of the job, not only the happy ones.'],
    });
    const signFiles = await page.savePrintable(ctx, {
      base: `${base}-sign`,
      title: `${f.name}: counter sign`,
      pages: [sign],
      notes: ['Letter size. Print at 100% and put it where customers wait or pay.', 'Scan it from where a customer would stand to check that the code reads.'],
    });

    let customersFile = null;
    if (customers.length) {
      const csv = files.csv(customers, [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'text', label: 'Ask (send today)' },
        { key: 'reminder', label: 'Reminder (3 days later, once)' },
      ]);
      customersFile = await save.saveFile(ctx, `${base}-asks.csv`, csv, 'text/csv');
    }

    const today = time.today(ctx);
    const plan = [
      `Day 1: put the sign up, keep 10 cards with you, and send the ask to ${customers.length ? `your ${customers.length} recent customers` : 'your last 10 customers'}.`,
      'Every job: say the in-person line, hand over a card, and text the link the same day.',
      'Day 4: send one reminder to anyone who has not left a review. Then stop.',
      'Day 7: reply to every review, good or bad, and count where you are.',
    ];
    const events = [
      { uid: `${base}-d1@local`, title: 'Send review asks', description: plan[0], date: today, time: '17:00', minutes: 20 },
      { uid: `${base}-d4@local`, title: 'One review reminder', description: plan[2], date: time.addDays(today, 3), time: '17:00', minutes: 15 },
      { uid: `${base}-d7@local`, title: 'Reply to every review', description: plan[3], date: time.addDays(today, 6), time: '17:00', minutes: 15 },
    ];
    const calendar = await save.saveFile(ctx, `${base}-plan.ics`, files.ics(events, { name: `${f.name} reviews`, now: time.nowMs(ctx) }), 'text/calendar');

    const m = qr.qrMatrix(link.url, { ecc: 'M' });
    return {
      business: f.name,
      link: link.url,
      linkKind: link.kind,
      placeId: link.placeId || '',
      linkNote: link.note,
      asks,
      customers,
      rules: REV.google.rules.concat(['Yelp asks businesses not to request reviews at all, so only ask for Google reviews.']),
      plan,
      qr: { version: m.version, modules: m.size, cardModuleMm: Math.round(one.module * 25.4 / 96 * 100) / 100, minCardInches: qr.minPrintInches(link.url, { ecc: 'M' }) },
      files: { cards: cardFiles.html, sign: signFiles.html, previews: [...cardFiles.png, ...signFiles.png], customers: customersFile, calendar },
      sample: !f.hasName || link.kind === 'maps_search',
      ai: !!res.ai,
    };
  },
  view(out) {
    const p = (out.files && out.files.previews) || [];
    return views.blocks(
      views.metric('Review link', out.linkKind === 'maps_search' ? 'Your Maps listing' : 'Opens the review box', out.linkNote),
      views.image(p[0], 'Review cards, 10 to a page'),
      views.file(out.files && out.files.cards, 'Review cards: print at 100% and cut on the marks'),
      views.image(p[1], 'Counter sign'),
      views.file(out.files && out.files.sign, 'Counter sign (Letter)'),
      views.copy('Text to send the same day', out.asks.text),
      views.copy('Email', out.asks.email, { subject: out.asks.subject }),
      views.copy('Reminder, once, 3 days later', out.asks.reminder),
      views.copy('Say this at the end of the job', out.asks.inPerson),
      views.file(out.files && out.files.customers, `A personal ask for each of your ${(out.customers || []).length} customers (CSV)`),
      views.file(out.files && out.files.calendar, 'Your 7-day review plan for your calendar'),
      views.text(`The rules: ${out.rules.join(' ')}`),
      views.copy('Your review link', out.link)
    );
  },
};
