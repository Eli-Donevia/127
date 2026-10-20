// Who owes the member and how late, from a CSV export of unpaid invoices (QuickBooks, Wave,
// FreshBooks, Square, Stripe or a sheet) or lines they paste. Lists `wants: ['stripe']` so a
// Stripe connection can fill the list later; the Stripe reader lives apart in lib/stripe-reader.js
// and stays off (held) for now. Customer names and emails stay in this run; nothing is kept.

const fs = require('fs');
const path = require('path');
const { views, time } = require('../../_kit');
const I = require('../lib/invoices');
const { readStripe } = require('../lib/stripe-reader');
const { assetText } = require('../lib/doc-text');

module.exports = {
  name: 'admin.read_invoices',
  title: 'Read unpaid invoices',
  description: 'Reads a CSV export of your unpaid invoices, or lines you paste, and lists who owes what and how many days late, oldest first. Paid and void invoices are skipped.',
  kind: 'code',
  risk: 'read',
  needs: [],
  wants: ['stripe'],
  credits: 0,
  input: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'asset', title: 'Unpaid invoices (CSV)', accept: '.csv,.txt,text/csv' },
      pasted: { type: 'string', title: 'Or type them, one per line', format: 'textarea', maxLength: 6000, description: 'Like "Marcus Lee, INV-1040, $480, due Sep 29, marcus@mail.example"' },
      termsDays: { type: 'integer', title: 'Days to pay, when the file has no due date', default: 30, minimum: 0, maximum: 120 },
    },
  },
  output: {
    type: 'object',
    properties: { invoices: { type: 'array', items: { type: 'object' } }, count: { type: 'integer' }, owed: { type: 'number' }, late: { type: 'integer' }, skipped: { type: 'integer' }, source: { type: 'string' }, sample: { type: 'boolean' } },
    required: ['invoices', 'count', 'owed', 'source'],
  },
  async run(input, ctx) {
    const today = time.today(ctx);
    let invoices = [];
    let skipped = 0;
    let source = '';
    let sample = false;
    const stripe = await readStripe(ctx, I.row, today);
    if (stripe) {
      invoices.push(...stripe);
      source = 'stripe';
    }
    if (input.file) {
      const f = await assetText(ctx, input.file, { what: 'invoice file' });
      const r = I.fromCsv(f.text || '', today, { termsDays: input.termsDays == null ? 30 : input.termsDays });
      invoices.push(...r.invoices);
      skipped += r.skipped;
      source = source ? `${source}+csv` : 'csv';
    }
    if (input.pasted && String(input.pasted).trim()) {
      const rows = I.fromLines(input.pasted, today);
      if (!rows.length) throw new Error('Couldn\'t read those lines. Write each as: name, invoice number, amount, due date, email.');
      invoices.push(...rows);
      source = source ? `${source}+typed` : 'typed';
    }
    if (!source) {
      invoices = I.fromCsv(fs.readFileSync(path.join(__dirname, '..', 'sample', 'invoices.csv'), 'utf8'), '2026-10-19').invoices.map((r) => I.row({ ...r, due: time.addDays(r.due, Math.round((Date.parse(today) - Date.parse('2026-10-19')) / 864e5)), guessed: r.dueGuessed }, today));
      source = 'sample';
      sample = true;
    }
    invoices.sort((a, b) => b.daysLate - a.daysLate || b.owed - a.owed);
    const owed = I.r2(invoices.reduce((a, r) => a + r.owed, 0));
    const late = invoices.filter((r) => r.daysLate > 0).length;
    ctx.log(`Read ${invoices.length} unpaid invoices (${late} late)${skipped ? `; skipped ${skipped} paid, void or blank rows` : ''}`);
    return { invoices, count: invoices.length, owed, late, skipped, source, ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'These invoices'),
      views.metric('Owed to you', I.usd(out.owed), `${out.count} unpaid, ${out.late} late`),
      views.table([{ key: 'customer', label: 'Customer' }, { key: 'number', label: 'Invoice' }, { key: 'owed', label: 'Owed', format: 'money' }, { key: 'daysLate', label: 'Days late', format: 'number' }, { key: 'stage', label: 'Reminder' }], out.invoices, 15)
    );
  },
};
