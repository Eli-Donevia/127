// sales.invoice: an invoice in the member's colors with their own payment link and a QR code to pay
// (127 never takes payment), a line-item CSV and the message to send. Can start from a quote: pass a
// sales.quote output as `quote`, or `fromQuote: "last"` or a quote number the desk remembers.

const { views } = require('../../_kit');
const money = require('../lib/money-run');
const items = require('../lib/items');

module.exports = {
  name: 'sales.invoice',
  title: 'Make an invoice',
  description: 'Turns line items or an earlier quote into a printable invoice with your number, due date, tax, deposit and your own payment link and QR code, plus a CSV of the lines and the email and text to send.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      ...money.COMMON,
      dueDays: { type: 'integer', minimum: 0, maximum: 120, default: 14, title: 'Days to pay', description: '0 means due on receipt' },
      paid: { type: 'number', minimum: 0, title: 'Already paid (optional)', description: 'A deposit they already paid, in dollars' },
      quote: { type: 'object', title: 'A quote from an earlier step', description: 'A sales.quote output: its items, customer and title are used' },
      fromQuote: { type: 'string', maxLength: 30, title: 'Invoice a saved quote', description: '"last" or a quote number like Q-2026-004' },
    },
  },
  output: money.OUTPUT,
  run: (input, ctx) => money.run('invoice', input, ctx),
  view(out) {
    const who = (out.customer && out.customer.name) || 'your customer';
    const usd = out.currency === 'USD';
    return views.blocks(
      { type: 'metric', label: `Invoice for ${who}`, value: usd ? out.dueNow : out.dueNowText, format: usd ? 'money' : undefined, note: `${out.number}, ${out.due ? `due ${out.due}` : 'due on receipt'}${out.paid ? `. ${items.money(Math.round(out.paid * 100), out.currency)} already paid` : ''}` },
      (out.warnings || []).map((w) => views.text(w)),
      views.file(out.files && out.files.html, 'Your invoice: open it, then Print or Save as PDF'),
      views.copy(`Email to ${who}`, out.message.email, { to: (out.customer && out.customer.email) || '', subject: out.message.subject }),
      views.copy(`Text to ${who}`, out.message.text),
      views.file(out.files && out.files.csv, 'Line items as a spreadsheet (CSV)')
    );
  },
};
