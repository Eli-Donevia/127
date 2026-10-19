// The one-page monthly report for a front desk client, from numbers the member types in from the
// client's own phone and booking tools. Plain counts only: no estimates of money made. Ends with the
// email to send and, after a good month, the review and referral ask.

const kit = require('../../_kit');
const { text, views, save, brain, time } = kit;
const { reportHtml } = require('../lib/pages');

const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));

module.exports = {
  name: 'frontdesk.monthly_report',
  title: 'Monthly front desk report',
  description: 'Turns the month\'s numbers from your client\'s phone and booking tools into a one-page report, the email to send it with, and a review and referral ask after a good month.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    required: ['client'],
    properties: {
      client: { type: 'string', maxLength: 100 },
      month: { type: 'string', maxLength: 40 },
      missedCalls: { type: 'number', minimum: 0 },
      textsSent: { type: 'number', minimum: 0 },
      replies: { type: 'number', minimum: 0 },
      booked: { type: 'number', minimum: 0 },
      afterHoursCalls: { type: 'number', minimum: 0 },
      afterHoursAnswered: { type: 'number', minimum: 0 },
      optOuts: { type: 'number', minimum: 0 },
      fixes: { type: 'string', maxLength: 1200 },
      next: { type: 'string', maxLength: 1200 },
      ownerFirst: { type: 'string', maxLength: 40 },
      myName: { type: 'string', maxLength: 60 },
      myContact: { type: 'string', maxLength: 160 },
    },
  },
  output: { type: 'object', required: ['report', 'email'], properties: { report: { type: 'object' }, email: { type: 'object' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const today = time.today(ctx);
    const month = text.plain(input.month || new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
    const client = { name: text.plain(input.client) };
    const v = { missed: n(input.missedCalls), sent: n(input.textsSent), replies: n(input.replies), booked: n(input.booked), ahCalls: n(input.afterHoursCalls), ahAnswered: n(input.afterHoursAnswered), stops: n(input.optOuts) };
    const pct = (a, b) => (a != null && b ? `${Math.round((a / b) * 100)}%` : '');
    const metrics = [];
    if (v.missed != null) metrics.push({ label: 'Calls you missed', value: String(v.missed), note: 'From your phone log' });
    if (v.sent != null) metrics.push({ label: 'Got a text back', value: String(v.sent), note: v.missed ? `${pct(v.sent, v.missed)} of missed calls` : '' });
    if (v.replies != null) metrics.push({ label: 'Texted back', value: String(v.replies), note: v.sent ? `${pct(v.replies, v.sent)} of texts sent` : '' });
    if (v.booked != null) metrics.push({ label: 'Booked from a text', value: String(v.booked), note: 'Jobs on your calendar that started with a missed call' });
    if (v.ahCalls != null) metrics.push({ label: 'After-hours calls', value: String(v.ahCalls), note: v.ahAnswered != null ? `${v.ahAnswered} answered` : '' });
    if (v.stops != null) metrics.push({ label: 'Opted out (STOP)', value: String(v.stops), note: 'Honored right away' });
    const wins = [];
    if (v.missed && v.sent != null && v.sent >= v.missed) wins.push('Every missed call got a text back.');
    if (v.booked) wins.push(`${v.booked} ${v.booked === 1 ? 'job' : 'jobs'} booked from a missed call.`);
    if (v.ahAnswered) wins.push(`${v.ahAnswered} after-hours ${v.ahAnswered === 1 ? 'call was' : 'calls were'} answered instead of going to voicemail.`);
    const lines = (s) => String(s || '').split(/\n|;/).map((x) => text.plain(x.trim())).filter(Boolean);
    const fixes = lines(input.fixes);
    const next = lines(input.next);
    if (!next.length) next.push('Keep hours, prices and the booking link current.', 'Ask every customer for a review the day the job is done, not only the happy ones.');
    const member = { name: text.plain(input.myName || br.firstName || ''), contact: text.plain(input.myContact || '') };
    const html = reportHtml({ client, month, metrics, wins, fixes, next, member, checked: today });
    const report = await save.saveFile(ctx, save.fileName(client.name, 'front-desk-report', month, '.html'), html);
    const hi = text.plain(input.ownerFirst || `${client.name} team`);
    const email = {
      subject: `Your front desk report for ${month}`,
      body: [
        `Hi ${hi},`,
        '',
        `Here's your one-page report for ${month}.${metrics.length ? ` ${metrics.filter((m) => /missed|text back|Booked/.test(m.label)).slice(0, 3).map((m) => `${m.label}: ${m.value}`).join('. ')}.` : ''}`,
        fixes.length ? `This month I also ${fixes[0].charAt(0).toLowerCase()}${fixes[0].slice(1).replace(/\.$/, '')}.` : '',
        '',
        'Anything you want changed in the texts or answers? Just reply.',
        '',
        member.name || '[your name]',
      ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n'),
    };
    const ask = text.plain(`Quick favor, ${hi}: would you write two or three honest sentences about how the missed-call texts have worked for you so far? I'd like to share it, with your name only if you say yes. And if you know another contractor who misses calls on the job, I'd be grateful for an introduction.`);
    return { client: client.name, month, metrics, wins, fixes, next, report, email, ask };
  },
  view(out) {
    return views.blocks(
      ...out.metrics.slice(0, 4).map((m) => views.metric(m.label, m.value, m.note)),
      views.file(out.report, `Report for ${out.client}, ${out.month}`),
      views.copy('Email to send with the report', `Subject: ${out.email.subject}\n\n${out.email.body}`),
      views.copy('Review and referral ask (send it whatever the month looked like)', out.ask),
    );
  },
};
