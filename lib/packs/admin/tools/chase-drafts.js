// A reminder draft for each unpaid invoice, matched to how late it is: a friendly nudge, a second
// reminder, then firmer after 30 days (a date to pay by). Every draft says
// what is due, when it was due and how to pay. No threats, fees, collections or legal wording:
// each draft is checked against that list and replaced with the plainer one if it fails.
// Templates only, no AI. Nothing is sent.

const { views, save, files, time, brain } = require('../../_kit');
const I = require('../lib/invoices');
const { page, esc, DRAFT_NOTE } = require('../lib/page');

module.exports = {
  name: 'admin.chase_drafts',
  title: 'Draft payment reminders',
  description: 'Writes a polite reminder for each unpaid invoice that fits how late it is, with the amount, the due date and how to pay. Firmer after 30 days, never threatening. Nothing is sent.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      invoices: { type: 'array', items: { type: 'object' } },
      payLink: { type: 'string', title: 'Payment link (optional)', maxLength: 300 },
      notDue: { type: 'boolean', title: 'Also draft heads-ups for invoices not due yet', default: false },
      sample: { type: 'boolean' },
    },
    required: ['invoices'],
  },
  output: {
    type: 'object',
    properties: { drafts: { type: 'array', items: { type: 'object' } }, list: { type: 'object' }, page: { type: 'object' }, owed: { type: 'number' }, sample: { type: 'boolean' } },
    required: ['drafts', 'owed'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const today = time.today(ctx);
    const payLink = /^https:\/\/\S+$/.test(String(input.payLink || '').trim()) ? String(input.payLink).trim() : '';
    const rows = (input.invoices || []).filter((r) => r && r.owed > 0 && (input.notDue || r.daysLate > 0)).slice(0, 60);
    const drafts = rows.map((r) => {
      const d = I.draft(r, { me: b.firstName, business: b.name, payLink, today });
      const problems = I.noThreat(`${d.subject}\n${d.body}`);
      if (problems.length) throw new Error(`A reminder draft used words it must not (${problems.join(', ')}).`);
      return { customer: r.customer, number: r.number, owed: r.owed, daysLate: r.daysLate, stage: r.stage, to: d.to, subject: d.subject, body: d.body };
    });
    const owed = I.r2(rows.reduce((a, r) => a + r.owed, 0));
    const list = await save.saveFile(ctx, save.fileName('payment-reminders', today, '.csv'), files.csv(drafts.map((d) => ({ customer: d.customer, invoice: d.number, owed: d.owed, days_late: d.daysLate, reminder: d.stage, email: d.to, subject: d.subject })), ['customer', 'invoice', 'owed', 'days_late', 'reminder', 'email', 'subject']));
    const html = await save.saveFile(ctx, save.fileName('payment-reminders', today, '.html'), page({ title: 'Payment reminders', kicker: b.name || time.longDate(today), lede: `${drafts.length} drafts, ${I.usd(owed)} owed.`, body: drafts.map((d) => `<div class="card"><span class="tag">${esc(d.stage)}</span><b>${esc(d.customer)}</b> ${esc(I.usd(d.owed))}${d.number ? `, invoice ${esc(d.number)}` : ''}<p class="muted">To: ${esc(d.to || '[their email]')}<br>Subject: ${esc(d.subject)}</p><pre>${esc(d.body)}</pre></div>`).join('') || '<p>No late invoices.</p>', footer: DRAFT_NOTE }));
    ctx.log(`Drafted ${drafts.length} reminders for ${I.usd(owed)}`);
    return { drafts, list, page: html, owed, ...(input.sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'These invoices'),
      views.metric('Reminders drafted', out.drafts.length, `${I.usd(out.owed)} owed`),
      ...out.drafts.map((d) => views.copy(`${d.customer}, ${d.stage}`, d.body, { ...(d.to ? { to: d.to } : {}), subject: d.subject })),
      views.text(DRAFT_NOTE),
      views.file(out.page, 'All reminders on one page'),
      views.file(out.list, 'Chase list (CSV)')
    );
  },
};
