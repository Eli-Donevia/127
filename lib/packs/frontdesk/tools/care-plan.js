// Keep a front desk client: the care plan page the client keeps (what the member does every week and
// month, the report day, the fix promise, what the member needs from them, the next 90 days), the
// member's calendar for the same 90 days, the messages for each moment, and one upsell at the right
// time: after-hours answering for a client on monthly care, the review request text for a client who
// has it. Logs the client as won in the Pipeline. Prices come from "Your offer" or the band.

const kit = require('../../_kit');
const { text, views, files, save, brain, time, money } = kit;
const NICHE = require('../data/niche.json');
const talk = require('../../_kit/talk');
const prices = require('../lib/prices');
const { carePlanHtml } = require('../lib/pages');
const { shortName } = require('../lib/plan');

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
const { longDate } = talk;
// The first weekday of the month n months after ymd.
const firstWeekdayAfter = (ymd, n) => {
  const d = new Date(msOf(ymd));
  return nextWeekday(ymdOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)));
};

module.exports = {
  name: 'frontdesk.care_plan',
  title: 'Front desk care plan',
  description: 'The care plan page your client keeps (every week, every month, the report day, your promises, the next 90 days), the same 90 days on your calendar, the message for each moment, and one upsell to offer after the first report.',
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
      plan: { type: 'string', enum: ['care', 'care_plus'] },
      monthly: { type: 'number', minimum: 0, maximum: 5000 },
      terms: { type: 'string', enum: ['founding', 'regular'] },
      start: { type: 'string', maxLength: 10 },
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
    const planId = input.plan === 'care_plus' ? 'care_plus' : 'care';
    const listPrice = planId === 'care_plus' ? n.carePlus : n.care;
    const monthly = Number(input.monthly) > 0 ? Number(input.monthly) : listPrice;
    // The first few clients are founding clients unless the member says otherwise.
    const others = talk.wonCount(rows.filter((r) => r && r.id !== lead.id), 'frontdesk');
    const founding = input.terms === 'founding' ? true : input.terms === 'regular' ? false : others < NICHE.first_clients.founding_count;
    const pkg = prices.pkg(planId);
    const today = time.today(ctx);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) ? input.start : today;
    const half = founding && !(Number(input.monthly) > 0) ? money.nicePrice(listPrice / 2) : null;
    const plan = {
      id: planId,
      label: planId === 'care_plus' ? 'Care with after-hours answering' : 'Monthly care',
      priceText: half ? `${money.usd(half)} a month for the first 3 months, then ${money.usd(listPrice)}. No contract.` : `${money.usd(monthly)} a month. No contract.`,
      note: founding ? 'Founding client: thank you for helping me get started.' : '',
    };

    const weekly = ['Read every text your number sent and got back, and fix any wrong answer', 'Check the booking link still opens and books', planId === 'care_plus' ? 'Listen to after-hours calls and tighten the answers' : 'Check the after-hours reply still matches your hours'];
    const monthly_ = ['Send your one-page report: calls missed, texts sent, replies and jobs booked', 'Update hours, prices, services and holiday closures in every answer', 'One test call and one test text from a phone that isn\'t yours'];
    const needs = ['Text me when your hours, prices or services change, and I\'ll update the answers the same day', 'Forward me any text that got a wrong answer', 'Keep me added as a user on your phone and booking accounts'];
    const promises = NICHE.promises.slice(1);

    // The next 90 days: weekly checks, three reports, the founding moments and the upsell.
    const firstWeek = nextWeekday(ymdOf(msOf(start) + ((8 - weekday(start)) % 7 || 7) * DAY));
    const reports = [1, 2, 3].map((k) => firstWeekdayAfter(start, k));
    const upsellDay = nextWeekday(ymdOf(msOf(reports[0]) + 2 * DAY));
    const dates = [
      { date: start, what: 'Your front desk is live. I start the weekly checks.' },
      { date: reports[0], what: 'First monthly report', report: true },
      ...(founding ? [{ date: nextWeekday(ymdOf(msOf(start) + 30 * DAY)), what: 'A quick check-in: what is working and what you would change' }] : []),
      { date: reports[1], what: 'Second monthly report', report: true },
      { date: reports[2], what: 'Third monthly report', report: true },
      ...(half ? [{ date: nextWeekday(ymdOf(msOf(start) + 91 * DAY)), what: `Founding price ends; care is ${money.usd(listPrice)} a month from here` }] : []),
    ].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, label: labelOf(d.date) }));

    // One upsell: after-hours answering on monthly care, else the review request text.
    const reviewAddon = (n.addons || []).find((a) => a.id === 'review_text') || { price: 100 };
    const upsell =
      planId === 'care'
        ? {
            id: 'care_plus',
            label: 'After-hours answering',
            priceText: `${money.usd(Math.max(0, n.carePlus - n.care))} more a month`,
            pitch: 'Callers after hours get an answer, not only a text: what they need, the address and a time, waiting for you in the morning.',
            when: labelOf(upsellDay),
            why: 'Offer it right after the first report, when you can both see how many calls came in after hours.',
            message: sign(`${hi} a thought after this month's report: the text back is catching the daytime calls you miss, and callers after hours still only get a text. For ${money.usd(Math.max(0, n.carePlus - n.care))} more a month I can add after-hours answering on your account, so they get an answer right away. Same as now, no contract. Want me to set it up?`),
          }
        : {
            id: 'review_text',
            label: 'Review request text after every job',
            priceText: `${money.usd(reviewAddon.price)} one time`,
            pitch: 'After every finished job, the customer gets one short text from your number with your Google review link. Everyone gets the same text, with nothing offered in exchange.',
            when: labelOf(upsellDay),
            why: 'Every customer is asked the same way and nothing is offered for a review, so it follows Google\'s rules and the FTC\'s.',
            message: sign(`${hi} one more thing I can add: after every finished job, the customer gets one short text from your number thanking them, with your Google review link. Everyone gets the same text and nothing is offered in exchange, so it follows Google's rules. It's ${money.usd(reviewAddon.price)} one time to set up. Want it?`),
          };

    const checked = longDate(today);
    const html = carePlanHtml({
      client: { name },
      plan,
      weekly,
      monthly: monthly_,
      needs,
      promises,
      dates,
      addon: { label: upsell.label, pitch: upsell.pitch, priceText: upsell.priceText },
      member,
      start: labelOf(start),
      checked,
    });
    const page = await save.saveFile(ctx, save.fileName(name, 'care plan', '.html'), html);

    // The member's calendar: 12 weekly checks, 3 reports, the founding moments and the upsell.
    const tz = time.tzOf(ctx);
    const uid = (what, d) => `frontdesk-care-${text.slug(lead.key || s, 30)}-${what}-${d}@127group.io`;
    const events = [];
    for (let w = 0; w < 12; w++) {
      const d = ymdOf(msOf(firstWeek) + w * 7 * DAY);
      events.push({ uid: uid('week', d), title: `${s}: read the texts, check the booking link`, date: d, time: '09:00', minutes: 30, tz, description: weekly.join('\n') });
    }
    reports.forEach((d, i) => events.push({ uid: uid('report', d), title: `${s}: send the monthly report`, date: d, time: '10:00', minutes: 30, tz, description: `Run "Monthly client report" with the numbers from their phone and booking tools.${i === 0 ? ' Then offer the add-on two days later.' : ''}` }));
    events.push({ uid: uid('upsell', upsellDay), title: `${s}: offer ${upsell.label.toLowerCase()}`, date: upsellDay, time: '10:00', minutes: 15, tz, description: upsell.message });
    if (founding) {
      const d = nextWeekday(ymdOf(msOf(start) + 30 * DAY));
      events.push({ uid: uid('feedback', d), title: `${s}: ask for feedback and a quote you can use`, date: d, time: '10:00', minutes: 15, tz, description: 'Founding client: ask what works and what they would change, and whether you may quote them as a founding client. Never ask for a review in exchange for anything.' });
    }
    if (half) {
      const d = nextWeekday(ymdOf(msOf(start) + 84 * DAY));
      events.push({ uid: uid('price', d), title: `${s}: founding price ends next week`, date: d, time: '10:00', minutes: 15, tz, description: `Send the reminder: care is ${money.usd(listPrice)} a month from ${labelOf(nextWeekday(ymdOf(msOf(start) + 91 * DAY)))}.` });
    }
    let calendar = null;
    try {
      calendar = await save.saveFile(ctx, save.fileName(name, 'care calendar', '.ics'), files.ics(events, { name: `${s} care`, now: time.nowMs(ctx) }), 'text/calendar');
    } catch {
      calendar = null;
    }

    const messages = [
      { when: 'Today, with the care plan', text: sign(`${hi} you're all set. Here's your care plan: what I do every week and every month, and your first report on ${labelOf(reports[0])}. If your hours, prices or services change, text me and I'll update the answers the same day.`) },
      ...(founding ? [{ when: dates.find((d) => /check-in/.test(d.what)) ? dates.find((d) => /check-in/.test(d.what)).label : 'After a month', text: sign(`${hi} it's been a month. Two quick questions: what's working, and what would you change? And if you're happy with it, could I quote a sentence or two from you on my website, saying you were one of my first clients?`) }] : []),
      ...(half ? [{ when: labelOf(nextWeekday(ymdOf(msOf(start) + 84 * DAY))), text: sign(`${hi} a heads up: your founding price ends on ${labelOf(nextWeekday(ymdOf(msOf(start) + 91 * DAY)))}, and care is ${money.usd(listPrice)} a month from there. Same as now, no contract. Thank you for being one of my first clients.`) }] : []),
    ];

    // Logged as won: this pack's lead or a client typed in; another pack's lead is the member's to move.
    let line = '';
    const leads = (ctx && ctx.leads) || {};
    const own = !lead.pack || lead.pack === 'frontdesk';
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
        await leads.upsert({ key: dom ? `site:${dom}` : `lead:${text.slug(name, 40)}`, name, company: name, source: 'Front desk client', stage: 'won', links: dom ? { website: talk.siteUrl(input.website) } : {}, data: { plan: planId, monthly, founding, start } });
        line = `Added ${name} to your Pipeline as won.`;
      }
    } catch {
      line = '';
    }

    return { client: name, plan, founding, start, dates, page, calendar, upsell, messages, line, events: events.length };
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
