// Keep a reviews client: the care plan page the client keeps (what the member does every week and
// month, the report day, the promises, what the member needs from them, the one rule, the next 90
// days), the member's calendar for the same 90 days, the messages for each moment, and one upsell at
// the right time: the review text after every visit (only to customers who agreed to texts, STOP
// honored, nothing in exchange), or a reviews section on their website for a shop that already
// texts. Logs the client as won in the Pipeline. Prices come from "Your offer" or the band.

const kit = require('../../_kit');
const { text, views, files, save, brain, time, money } = kit;
const NICHE = require('../data/niche.json');
const talk = require('../../_kit/talk');
const prices = require('../lib/prices');
const { carePlanHtml } = require('../lib/care');
const { shortName } = require('../lib/close');

const DAY = 864e5;
const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const msOf = (ymd) => Date.parse(`${ymd}T12:00:00Z`);
const labelOf = (ymd) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(msOf(ymd)));
const weekday = (ymd) => new Date(msOf(ymd)).getUTCDay();
// New Year's Day and Labor Day can be a month's first weekday; nothing is due on either.
const holiday = (t) => {
  const d = new Date(t);
  return (d.getUTCMonth() === 0 && d.getUTCDate() === 1) || (d.getUTCMonth() === 8 && d.getUTCDay() === 1 && d.getUTCDate() <= 7);
};
const nextWeekday = (ymd) => {
  let t = msOf(ymd);
  while ([0, 6].includes(new Date(t).getUTCDay()) || holiday(t)) t += DAY;
  return ymdOf(t);
};
// The first weekday of the month n months after ymd.
const firstWeekdayAfter = (ymd, n) => {
  const d = new Date(msOf(ymd));
  return nextWeekday(ymdOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)));
};

const RULE = 'Every customer gets asked the same way, and nothing is offered in exchange for a review: no discount, no gift, no entry into a draw.';

module.exports = {
  name: 'reviews.care_plan',
  title: 'Reviews care plan',
  description: 'The care plan page your client keeps (every week, every month, the report day, your promises, the one rule, the next 90 days), the same 90 days on your calendar, the message for each moment, and one upsell to offer after the first report.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    required: ['client'],
    properties: {
      client: { type: 'string', maxLength: 120 },
      website: { type: 'string', maxLength: 300 },
      monthly: { type: 'number', minimum: 0, maximum: 2000 },
      terms: { type: 'string', enum: ['founding', 'regular'] },
      start: { type: 'string', maxLength: 10 },
      hasTexts: { type: 'boolean' },
      ownerFirst: { type: 'string', maxLength: 40 },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
      myContact: { type: 'string', maxLength: 160 },
    },
  },
  output: { type: 'object', required: ['client', 'page', 'upsell'], properties: { client: { type: 'string' }, page: { type: 'object' }, calendar: { type: ['object', 'null'] }, upsell: { type: 'object' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const typed = { name: input.client, website: input.website };
    const { lead, rows } = await talk.findLead(ctx, typed);
    const blank = !lead.name || /^\[.*\]$/.test(lead.name);
    const name = blank ? text.oneLine(String(input.client || '')).slice(0, 120) || 'Your client' : lead.name;
    const s = shortName(name);
    const br = brain.brainOf(ctx, {});
    const member = { name: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), contact: text.plain(input.myContact || '') };
    const owner = text.oneLine(String(input.ownerFirst || '')).split(' ')[0] || '';
    const hi = owner ? `Hi ${owner},` : `Hi ${s} team,`;
    const sign = (body) => (member.name ? `${body}\n\n${member.name}` : body);

    const n = prices.offerNumbers({}, ctx);
    const listPrice = n.care;
    const monthly = Number(input.monthly) > 0 ? Number(input.monthly) : listPrice;
    // The first few clients are founding clients unless the member says otherwise.
    const others = talk.wonCount(rows.filter((r) => r && r.id !== lead.id), 'reviews');
    const founding = input.terms === 'founding' ? true : input.terms === 'regular' ? false : others < NICHE.first_clients.founding_count;
    const today = time.today(ctx);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) ? input.start : today;
    const half = founding && !(Number(input.monthly) > 0) ? n.halfCare : null;
    const plan = {
      id: 'care',
      label: 'Monthly review care',
      priceText: half ? `${money.usd(half)} a month for the first 3 months, then ${money.usd(listPrice)}. No contract.` : `${money.usd(monthly)} a month. No contract.`,
      note: founding ? 'Founding client: thank you for helping me get started.' : '',
    };

    const weekly = ['A reply draft for every new review within 1 business day, ready for you to post', 'Check the review link and the card\'s code still open your review form', 'Flag any review that may break Google\'s rules, and show you how to report it'];
    const monthly_ = ['Your one-page report: new reviews, replies, stars and cards handed out', 'Fresh handout cards when you run low (printing billed at cost)', 'Read your newest reviews for anything to fix, and anything to thank your team for'];
    const needs = ['Keep the counter card by the register and hand a card to every customer', 'Ask every customer the same way, every time', 'Tell me when a review needs a reply from you personally', 'Post the replies I send you, or add me as a manager on your Business Profile'];
    const promises = NICHE.promises.slice(1);

    // The next 90 days: weekly reply checks, three reports, the founding moments and the upsell.
    const firstWeek = nextWeekday(ymdOf(msOf(start) + ((8 - weekday(start)) % 7 || 7) * DAY));
    const reports = [1, 2, 3].map((k) => firstWeekdayAfter(start, k));
    const upsellDay = nextWeekday(ymdOf(msOf(reports[0]) + 2 * DAY));
    const checkIn = nextWeekday(ymdOf(msOf(start) + 30 * DAY));
    const priceEnds = nextWeekday(ymdOf(msOf(start) + 91 * DAY));
    const dates = [
      { date: start, what: 'Cards on the counter and the review link live. I start drafting replies.' },
      { date: reports[0], what: 'First monthly report', report: true },
      ...(founding ? [{ date: checkIn, what: 'A quick check-in: what is working and what you would change' }] : []),
      { date: reports[1], what: 'Second monthly report', report: true },
      { date: reports[2], what: 'Third monthly report', report: true },
      ...(half ? [{ date: priceEnds, what: `Founding price ends; care is ${money.usd(listPrice)} a month from here` }] : []),
    ].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, label: labelOf(d.date) }));

    // One upsell: the review text after every visit, or a reviews section on their website when they already text.
    const addon = (id, fallback) => (n.addons || []).find((a) => a.id === id) || { price: fallback };
    const textsAddon = addon('texts', 100);
    const siteAddon = addon('website', 140);
    const upsell = !input.hasTexts
      ? {
          id: 'texts',
          label: 'A review text after every visit',
          priceText: `${money.usd(textsAddon.price)} one time`,
          pitch: 'After every visit, each customer who agreed to get texts from you gets one short thank-you text with your review link, from the booking or texting tool you already use. Everyone gets the same text, STOP always works, and nothing is offered in exchange.',
          when: labelOf(upsellDay),
          why: 'Offer it right after the first report, when you can both see how many reviews came from the card. Texts go only to customers who agreed to get them (CTIA), and every one gets the same text (Google policy).',
          message: sign(`${hi} a thought after this month's report: the card is doing its job at the counter, and the customers who leave in a hurry still forget. For ${money.usd(textsAddon.price)} one time, I can set up one short thank-you text after every visit, with your review link, from the tool you already use. It only goes to customers who agreed to get texts from you, everyone gets the same text, and nothing is offered in exchange. Want me to set it up?`),
        }
      : {
          id: 'website',
          label: 'A reviews section on your website',
          priceText: `${money.usd(siteAddon.price)} one time`,
          pitch: 'A short section on your website with a few of your newest Google reviews and a button that opens your review form, so people who look you up online see what customers say and can add theirs.',
          when: labelOf(upsellDay),
          why: 'Offer it right after the first report. It shows recent reviews as they are and links to all of them on Google, so nothing is hidden.',
          message: sign(`${hi} a thought after this month's report: your newest reviews are great proof, and your website doesn't show them yet. For ${money.usd(siteAddon.price)} one time, I can add a short reviews section with a few recent Google reviews and a button to leave one, linked to all of them on Google. Want me to add it?`),
        };

    const checked = talk.longDate(today);
    const html = carePlanHtml({
      client: { name },
      plan,
      weekly,
      monthly: monthly_,
      needs,
      promises,
      rule: RULE,
      dates,
      addon: { label: upsell.label, pitch: upsell.pitch, priceText: upsell.priceText },
      member,
      start: labelOf(start),
      checked,
    });
    const page = await save.saveFile(ctx, save.fileName(name, 'care plan', '.html'), html);

    // The member's calendar: 12 weekly reply checks, 3 reports, the founding moments and the upsell.
    const tz = time.tzOf(ctx);
    const uid = (what, d) => `reviews-care-${text.slug(lead.key || s, 30)}-${what}-${d}@127group.io`;
    const events = [];
    for (let w = 0; w < 12; w++) {
      const d = ymdOf(msOf(firstWeek) + w * 7 * DAY);
      events.push({ uid: uid('week', d), title: `${s}: reply drafts and a link check`, date: d, time: '09:00', minutes: 30, tz, description: weekly.join('\n') });
    }
    reports.forEach((d, i) => events.push({ uid: uid('report', d), title: `${s}: send the monthly report`, date: d, time: '10:00', minutes: 30, tz, description: `Open their Business Profile, write down the review count, the stars and replies, then run "Monthly client report".${i === 0 ? ' Offer the add-on two days later.' : ''}` }));
    events.push({ uid: uid('upsell', upsellDay), title: `${s}: offer ${upsell.label.toLowerCase()}`, date: upsellDay, time: '10:00', minutes: 15, tz, description: upsell.message });
    if (founding) {
      events.push({ uid: uid('feedback', checkIn), title: `${s}: ask for feedback and a quote you can use`, date: checkIn, time: '10:00', minutes: 15, tz, description: 'Founding client: ask what works and what they would change, and whether you may quote them as a founding client on your website. This is a testimonial about your service, never a Google review of their shop.' });
    }
    if (half) {
      const d = nextWeekday(ymdOf(msOf(start) + 84 * DAY));
      events.push({ uid: uid('price', d), title: `${s}: founding price ends next week`, date: d, time: '10:00', minutes: 15, tz, description: `Send the reminder: care is ${money.usd(listPrice)} a month from ${labelOf(priceEnds)}.` });
    }
    let calendar = null;
    try {
      calendar = await save.saveFile(ctx, save.fileName(name, 'care calendar', '.ics'), files.ics(events, { name: `${s} care`, now: time.nowMs(ctx) }), 'text/calendar');
    } catch {
      calendar = null;
    }

    const messages = [
      { when: 'Today, with the care plan', text: sign(`${hi} you're all set. Here's your care plan: what I do every week and every month, and your first report on ${labelOf(reports[0])}. The one rule for your team: ask every customer the same way, and never offer anything for a review. I'll send a reply draft for every new review within a day.`) },
      ...(founding ? [{ when: labelOf(checkIn), text: sign(`${hi} it's been a month. Two quick questions: what's working, and what would you change? And if you're happy with it, could I quote a sentence or two from you on my website, saying you were one of my first clients?`) }] : []),
      ...(half ? [{ when: labelOf(nextWeekday(ymdOf(msOf(start) + 84 * DAY))), text: sign(`${hi} a heads up: your founding price ends on ${labelOf(priceEnds)}, and care is ${money.usd(listPrice)} a month from there. Same as now, no contract. Thank you for being one of my first clients.`) }] : []),
    ];

    // Logged as won: this pack's lead or a client typed in; another pack's lead is the member's to move.
    let line = '';
    const leads = (ctx && ctx.leads) || {};
    const own = !lead.pack || lead.pack === 'reviews';
    try {
      if (lead.inPipeline && own && lead.key && typeof leads.upsert === 'function') {
        if (lead.stage !== 'won') {
          await leads.upsert({ key: lead.key, stage: 'won' });
          line = `Marked ${name} won in your Pipeline.`;
        }
      } else if (lead.inPipeline) {
        if (lead.stage !== 'won') line = `Mark ${name} won in your Pipeline.`;
      } else if (typeof leads.upsert === 'function') {
        const dom = talk.domainOf(input.website);
        await leads.upsert({ key: dom ? `site:${dom}` : `lead:${text.slug(name, 40)}`, name, company: name, source: 'Reviews client', stage: 'won', links: dom ? { website: talk.siteUrl(input.website) } : {}, data: { plan: 'care', monthly, founding, start } });
        line = `Added ${name} to your Pipeline as won.`;
      }
    } catch {
      line = '';
    }

    return { client: name, plan, founding, start, dates, page, calendar, upsell, messages, line, rule: RULE, events: events.length };
  },
  view(out) {
    return views.blocks(
      views.metric(`${out.client}: ${out.plan.label}`, out.plan.priceText, out.founding ? 'Founding client' : undefined),
      views.file(out.page, 'Care plan for your client (send it with the welcome message)'),
      views.file(out.calendar, `Your next 90 days with ${out.client} (${out.events} calendar events)`),
      views.table([{ key: 'label', label: 'When' }, { key: 'what', label: 'What happens' }], out.dates),
      out.messages.map((m) => views.copy(`Send: ${m.when}`, m.text)),
      views.cards([{ title: `One upsell: ${out.upsell.label}`, subtitle: `${out.upsell.priceText}, offer it on ${out.upsell.when}`, body: out.upsell.why }]),
      views.copy(`The upsell message (${out.upsell.when})`, out.upsell.message),
      out.line ? views.text(out.line) : null,
    );
  },
};
