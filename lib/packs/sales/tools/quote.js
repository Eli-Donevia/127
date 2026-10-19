// sales.quote: a quote the member can send in two minutes. Printable HTML in their colors (Letter or
// A4), a line-item CSV, the email and text to send with it, and follow-up reminders for the calendar.
// Line items come typed ("Full detail, 180"), from a price menu (kit quote), or from another step.

const { views } = require('../../_kit');
const money = require('../lib/money-run');

module.exports = {
  name: 'sales.quote',
  title: 'Make a quote',
  description: 'Turns line items into a printable quote in your colors with your number, date, tax, deposit and payment link, plus a CSV of the lines, the email and text to send, and follow-up reminders.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      ...money.COMMON,
      validDays: { type: 'integer', minimum: 1, maximum: 120, default: 14, title: 'Days the price holds' },
    },
  },
  output: money.OUTPUT,
  run: (input, ctx) => money.run('quote', input, ctx),
  view(out) {
    const who = (out.customer && out.customer.name) || 'your customer';
    const usd = out.currency === 'USD';
    return views.blocks(
      { type: 'metric', label: `Quote for ${who}`, value: usd ? out.total : out.totalText, format: usd ? 'money' : undefined, note: `${out.number}, good until ${out.validUntil}${out.depositText ? `. ${out.depositText} deposit to book` : ''}` },
      (out.warnings || []).map((w) => views.text(w)),
      views.file(out.files && out.files.html, 'Your quote: open it, then Print or Save as PDF'),
      views.copy(`Email to ${who}`, out.message.email, { to: (out.customer && out.customer.email) || '', subject: out.message.subject }),
      views.copy(`Text to ${who}`, out.message.text),
      views.file(out.files && out.files.reminders, 'Follow-up reminders for your calendar'),
      views.file(out.files && out.files.csv, 'Line items as a spreadsheet (CSV)')
    );
  },
};
