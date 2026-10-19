// Turns the approved emails into files the member uses today: the email kit page (copy blocks,
// schedule, paste steps), a designed HTML email per send with their tool's unsubscribe and address
// tags, a plain-text file, a CSV with the send schedule and, for launches, a calendar file.
// Nurture and win-back make two dated files (the kit page and the CSV), a newsletter makes two (the
// kit page and the designed email), and a newsletter remembers what its issue used so a repeat
// with the same answers doesn't send the same news twice. For Kit, the designed emails come with
// a Kit template: the same design around Kit's content tag, to paste once.

const { views, save, files, text, time, brain } = require('../../_kit');
const { factsFor, nextWorkday } = require('../lib/facts');
const { KINDS, fromText } = require('../lib/sequences');
const { emailHtml, kitTemplate, emailText, platformOf, TEXT_NOTE } = require('../lib/html');
const { buildPage } = require('../lib/page');
const { paletteFor } = require('../lib/palette');

const HEAD = {
  welcome: (f) => [`Welcome emails for ${f.business}`, 'Five emails that greet new subscribers, tell your story, answer the big questions and invite them to buy. Set them up once and they run on their own.', 'Over 7 days', 25],
  launch: (f) => [`${f.launchTitle ? text.titleCase(f.launchTitle) : 'Your launch'}, week by week`, `Six emails from a first look to launch day and after${f.dateText ? `, built around ${f.dateText}` : ''}.`, f.dateText ? `Launch ${f.dateText}` : 'Launch week', 30],
  cart: (f) => [`Win back unfinished orders`, 'Three short reminders for people who started checkout and stopped. Friendly, honest and done after the third.', 'Over 3 days', 20],
  nurture: (f) => [`Stay useful until they're ready`, "Six weekly emails for people on your list who haven't bought yet: a tip, a common mistake, a real story, a straight answer, what to ask and a plain invite.", 'Over 5 weeks', 25],
  winback: (f) => ['Emails for past customers', "Three emails for customers who haven't been back in a while: a hello with what's new, an easy way back, and a check that lets them choose to stay on your list.", `From ${time.longDate(f.start)}, over 10 days`, 20],
  newsletter: (f) => [`Your ${f.month} newsletter`, "One email to your whole list: a short note, what's new, one useful tip, what's coming up and one clear next step.", `${f.month} issue`, 15],
};

// Who gets each of the new kinds: steps on the kit page.
const WHO = {
  nurture: () => ["People who finished your welcome emails and haven't bought yet. No welcome emails yet? Start everyone on your list here.", "When someone buys or books, take them out of this sequence so they don't get the invite."],
  winback: (since) => [
    `Customers who bought or booked before, but not in the last ${since}. Find them in your booking tool, your shop or your invoices.`,
    'Import them into your email tool with a tag like "Win back", or use a segment if your shop is connected to it. Only people who bought from you or agreed to hear from you.',
    'Send email 1 to that tag or segment, then emails 2 and 3 on their dates to the people who haven\'t booked or bought since.',
    'Two weeks after email 3, keep everyone who opened or clicked any of the three. Remove the rest, or tag them "Not now" and stop emailing them. A list that opens your emails gets to the inbox more.',
  ],
  newsletter: () => ['Everyone on your list who agreed to hear from you.', 'Send it around the same day each month, so people know when to expect it.', 'Fill every [bracket] and send yourself a test before it goes to everyone.'],
};
const SINCE = ['2 months', '3 months', '6 months', 'a year'];
const LAST = 'newsletter_last';
const sig = (s) => text.clip(text.oneLine(s || ''), 60);

module.exports = {
  name: 'email.build_emails',
  title: 'Make your email files',
  description: "Makes the email kit page, a designed HTML email for each send with your tool's unsubscribe and address tags, a plain-text file, a CSV with the send schedule, a calendar for launches and, for Kit, a template in your colors.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      kind: { type: 'string', title: 'Which emails', enum: ['welcome', 'launch', 'cart', 'nurture', 'winback', 'newsletter'] },
      items: { type: 'array', title: 'Approved emails', items: { type: 'object' } },
      since: { type: 'string', title: 'Not back in (win-back)', enum: SINCE },
      start: { type: 'string', title: 'First send date (win-back)', maxLength: 10 },
      news: { type: 'string', title: "What's new, as typed (newsletter)", maxLength: 1000 },
      tip: { type: 'string', title: 'The tip, as typed (newsletter)', maxLength: 300 },
      coming: { type: 'string', title: 'Coming up, as typed (newsletter)', maxLength: 300 },
      platform: { type: 'string', title: 'Email tool', enum: ['kit', 'mailchimp', 'klaviyo', 'beehiiv', 'other'], default: 'kit' },
      offer: { type: 'string', maxLength: 160 },
      launch: { type: 'string', maxLength: 120 },
      date: { type: 'string', maxLength: 10 },
      color: { type: 'string', title: 'Brand color (optional)', maxLength: 9 },
    },
    required: ['kind', 'items'],
  },
  output: {
    type: 'object',
    properties: { page: { type: 'object' }, csv: { type: 'object' }, txt: { type: 'object' }, html: { type: 'array' }, ics: { type: 'object' }, template: { type: 'object' }, count: { type: 'integer' } },
    required: ['page', 'html', 'count'],
  },
  async run(input, ctx) {
    const kind = KINDS[input.kind] ? input.kind : 'welcome';
    const platform = platformOf(input.platform) ? input.platform : input.platform === 'other' ? 'other' : 'kit';
    const f = factsFor(ctx, input);
    const p = paletteFor(ctx, { color: input.color });
    const today = time.today(ctx);
    const emails = (input.items || [])
      .filter((x) => x && typeof x === 'object' && String(x.text || '').trim())
      .map((x, i) => ({ ...fromText(x.text, x), n: x.n || i + 1, when: x.when || '', date: x.date || '', time: x.time || '09:00', button: x.button || '', link: x.link || '', hours: x.hours }));
    if (!emails.length) throw new Error('No emails to build. Go back one step and keep at least one.');
    const [headline, lede, span, minutes] = HEAD[kind](f);
    if (WHO[kind]) return compact(ctx, { kind, emails, f, p, platform, today, headline, lede, span, minutes, input });
    const base = save.fileName(f.business, kind === 'cart' ? 'cart-emails' : `${kind}-emails`);
    const template = platform === 'kit' ? await save.saveFile(ctx, `${base}-kit-template.html`, kitTemplate(p, f), 'text/html') : null;
    const made = { csv: true, html: 'each', txt: true, ics: kind === 'launch', template: !!template };
    const page = await save.saveFile(ctx, `${base}.html`, buildPage({ kind, label: KINDS[kind].label, emails, p, facts: f, platform, today, headline, lede, span, minutes, files: made }), 'text/html');
    const html = [];
    for (const e of emails) html.push(await save.saveFile(ctx, `${base}-${e.n}.html`, emailHtml(e, p, f, platform), 'text/html'));
    const txt = await save.saveFile(ctx, `${base}.txt`, `${TEXT_NOTE}\n\n\n` + emails.map((e) => `EMAIL ${e.n}, ${e.date ? `${time.longDate(e.date)} ${e.time}` : e.when}\nSubject: ${e.subject}\nPreview: ${e.preview}\n\n${emailText(e, f, platform)}`).join('\n\n\n'), 'text/plain');
    let prev = 0;
    const rows = emails.map((e) => {
      const hours = e.hours != null ? e.hours : 0;
      const row = { n: e.n, send: e.date ? `${time.longDate(e.date)} ${e.time}` : e.when, date: e.date || '', time: e.date ? e.time : '', after: kind === 'launch' ? '' : String(Math.max(0, hours - prev)), subject: e.subject, preview: e.preview, body: e.body, button: e.button, link: e.link };
      prev = hours;
      return row;
    });
    const csv = await save.saveFile(
      ctx,
      `${base}.csv`,
      files.csv(rows, [
        { key: 'n', label: 'Email' },
        { key: 'send', label: 'Send' },
        { key: 'date', label: 'Send date' },
        { key: 'time', label: `Send time (${f.timezone})` },
        { key: 'after', label: 'Hours after the previous email' },
        { key: 'subject', label: 'Subject' },
        { key: 'preview', label: 'Preview text' },
        { key: 'body', label: 'Body' },
        { key: 'button', label: 'Button' },
        { key: 'link', label: 'Button link' },
      ], { bom: true }),
      'text/csv'
    );
    let ics = null;
    if (kind === 'launch' && emails.some((e) => e.date)) {
      const events = emails.filter((e) => e.date).map((e) => ({ uid: `${base}-${e.n}@127group.io`, title: `Send email ${e.n}: ${e.subject}`, description: `Preview: ${e.preview}`, date: e.date, time: e.time, minutes: 15, tz: f.timezone }));
      ics = await save.saveFile(ctx, `${base}-schedule.ics`, files.ics(events, { name: `${f.business} launch emails`, now: Date.parse(`${today}T12:00:00Z`) }), 'text/calendar');
    }
    const plat = platformOf(platform);
    return { kind, platform: plat ? plat.name : 'Any email tool', page, csv, txt, html, ...(ics ? { ics } : {}), ...(template ? { template } : {}), count: emails.length, subjects: emails.map((e) => ({ n: e.n, when: e.date ? `${time.longDate(e.date)} ${e.time}` : e.when, subject: e.subject })) };
  },
  view(out) {
    return views.blocks(
      views.metric(out.count === 1 ? 'Email ready' : 'Emails ready', out.count, `Set up for ${out.platform}`),
      views.file(out.page, out.count === 1 ? 'Email kit (the email to copy and the setup steps)' : 'Email kit (every email, the schedule and setup steps)'),
      out.csv ? views.file(out.csv, 'Emails and send schedule (CSV)') : null,
      ...(out.ics ? [views.file(out.ics, 'Send dates for your calendar')] : []),
      out.txt ? views.file(out.txt, 'Plain-text versions') : null,
      out.template ? views.file(out.template, 'Kit template in your colors (paste it once in Kit)') : null,
      ...out.html.slice(0, 6).map((h, i) => views.file(h, out.html.length === 1 ? 'The email as HTML, in your colors' : `Email ${i + 1} as HTML`)),
      views.table([{ key: 'n', label: '#' }, { key: 'when', label: 'Sends' }, { key: 'subject', label: 'Subject' }], out.subjects, 10)
    );
  },
};

function csvOf(rows, f) {
  return files.csv(
    rows,
    [
      { key: 'n', label: 'Email' },
      { key: 'send', label: 'Send' },
      { key: 'date', label: 'Send date' },
      { key: 'time', label: `Send time (${f.timezone})` },
      { key: 'after', label: 'Days after the previous email' },
      { key: 'subject', label: 'Subject' },
      { key: 'preview', label: 'Preview text' },
      { key: 'body', label: 'Body' },
      { key: 'button', label: 'Button' },
      { key: 'link', label: 'Button link' },
    ],
    { bom: true }
  );
}

// Nurture, win-back and the newsletter: dated files, at most two per run.
async function compact(ctx, { kind, emails, f, p, platform, today, headline, lede, span, minutes, input }) {
  // Win-back dates were set when the emails were written; if the OK came after the first date,
  // the series moves to start on the next weekday instead of in the past.
  if (kind === 'winback' && emails[0].date && emails[0].date <= today) {
    const shift = Math.round((Date.parse(nextWorkday(today)) - Date.parse(emails[0].date)) / 86400000);
    emails = emails.map((e) => ({ ...e, date: e.date ? time.addDays(e.date, shift) : e.date }));
    span = `From ${time.longDate(emails[0].date)}, over 10 days`;
  }
  const name = { nurture: 'nurture emails', winback: 'win-back emails', newsletter: `newsletter ${f.month}` }[kind];
  const base = save.fileName(f.business, name, today);
  const since = SINCE.includes(input.since) ? input.since : '3 months';
  const mode = kind === 'nurture' ? 'sequence' : 'broadcast';
  // The Kit template comes with the first issue only: it's pasted once, and a monthly repeat keeps to two files.
  const first = !brain.packMemory(ctx, 'email')[LAST];
  const template = kind === 'newsletter' && platform === 'kit' && first ? await save.saveFile(ctx, `${base}-kit-template.html`, kitTemplate(p, f), 'text/html') : null;
  const made = kind === 'newsletter' ? { csv: false, html: 'one', txt: false, ics: false, template: !!template } : { csv: true, html: false, txt: false, ics: false };
  const page = await save.saveFile(ctx, `${base}.html`, buildPage({ kind, label: KINDS[kind].label, emails, p, facts: f, platform, today, headline, lede, span, minutes, mode, who: WHO[kind](since), files: made }), 'text/html');
  const html = [];
  let csv = null;
  if (kind === 'newsletter') {
    html.push(await save.saveFile(ctx, `${base}-email.html`, emailHtml(emails[0], p, f, platform), 'text/html'));
    // What this issue used, so next month's repeat with the same answers brackets it.
    if (typeof ctx.remember === 'function') await ctx.remember(LAST, { month: today.slice(0, 7), news: sig(input.news), tip: sig(input.tip), coming: sig(input.coming) });
  } else {
    let prev = 0;
    const rows = emails.map((e) => {
      const day = e.day || 0;
      const row = { n: e.n, send: e.date ? `${time.longDate(e.date)} ${e.time}` : e.when, date: e.date || '', time: e.date ? e.time : '', after: String(Math.max(0, day - prev)), subject: e.subject, preview: e.preview, body: e.body, button: e.button, link: e.link };
      prev = day;
      return row;
    });
    csv = await save.saveFile(ctx, `${base}.csv`, csvOf(rows, f), 'text/csv');
  }
  const plat = platformOf(platform);
  ctx.log(`Made ${emails.length} ${KINDS[kind].label.toLowerCase()} for ${plat ? plat.name : 'any email tool'}`);
  return { kind, platform: plat ? plat.name : 'Any email tool', page, ...(csv ? { csv } : {}), html, ...(template ? { template } : {}), count: emails.length, subjects: emails.map((e) => ({ n: e.n, when: e.date ? `${time.longDate(e.date)} ${e.time}` : e.when, subject: e.subject })) };
}
