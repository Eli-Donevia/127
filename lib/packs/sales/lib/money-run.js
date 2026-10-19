// The shared run behind sales.quote and sales.invoice: read the items (typed lines, a price menu,
// another step's items, or an earlier quote), do the math in cents, number the document, save the
// HTML, CSV and reminders, remember the member's settings, and log the customer in the Pipeline.

const { text, time, files, save } = require('../../_kit');
const items = require('./items');
const { factsOf, settingsPatch } = require('./facts');
const memory = require('./memory');
const doc = require('./money-doc');
const pipeline = require('./pipeline');

function validDate(v) {
  const t = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(t)) ? t : '';
}

const dollars = (c) => Math.round(c) / 100;

// An earlier quote to invoice: a sales.quote output passed by a step, or one the desk remembered.
function quoteSource(ctx, input) {
  const q = input.quote && typeof input.quote === 'object' ? input.quote : null;
  if (q && Array.isArray(q.items) && q.items.length) return { number: q.number || '', items: q.items, customer: q.customer || {}, title: q.title || '', taxRate: q.taxRate, deposit: q.depositRate };
  const want = String(input.fromQuote || '').trim();
  if (!want) return null;
  const docs = memory.recentDocs(ctx, 'quote');
  const hit = /^last$/i.test(want) ? docs[0] : docs.find((d) => String(d.number).toLowerCase() === want.toLowerCase());
  if (!hit) return { missing: want };
  return { number: hit.number, items: hit.items || [], customer: { name: hit.customer, email: hit.email, phone: hit.phone }, title: hit.title };
}

async function run(kind, input, ctx) {
  const isQuote = kind === 'quote';
  const warnings = [];
  const src = isQuote ? null : quoteSource(ctx, input);
  if (src && src.missing) warnings.push(`Couldn't find quote ${src.missing} in your recent quotes, so this invoice uses the lines you typed.`);
  const fromQuote = src && !src.missing ? src : null;
  const f = factsOf(ctx, { ...input, taxRate: input.taxRate != null && input.taxRate !== '' ? input.taxRate : fromQuote && fromQuote.taxRate != null ? fromQuote.taxRate : undefined });

  const parsed = items.parseLines(input.lines || '');
  let list = items.cleanItems([...(Array.isArray(input.items) ? input.items : []), ...parsed.items]);
  if (!list.length && fromQuote) list = items.cleanItems(fromQuote.items);
  if (parsed.skipped.length) warnings.push(`No price found in ${parsed.skipped.slice(0, 3).map((x) => `"${text.clip(x, 40)}"`).join(', ')}. Put the price at the end of the line, like "Full detail, 180", and run it again.`);
  if (!list.length && f.price != null && (f.offer || f.what)) {
    list = items.cleanItems([{ label: text.sentenceCase(text.clip(f.offer || f.what, 80)), qty: 1, price: f.price }]);
    warnings.push(`No lines were given, so this uses your main price from Settings (${f.priceText}). Add lines to quote anything else.`);
  }
  if (!list.length) throw new Error('Add at least one line with a price, like "Full detail, 180" or "2 x Window cleaning @ 45".');

  const customer = doc.customerOf({ ...((fromQuote && fromQuote.customer) || {}), ...(input.customer || {}) });
  const title = text.clip(input.title || (fromQuote && fromQuote.title) || '', 120);
  const date = validDate(input.date) || f.today;
  const validUntil = isQuote ? validDate(input.due) || time.addDays(date, Math.max(1, Math.min(120, Number(input.validDays) || 14))) : '';
  let due = '';
  if (!isQuote) {
    const days = input.dueDays != null && input.dueDays !== '' ? Number(input.dueDays) : 14;
    due = validDate(input.due) || (days > 0 ? time.addDays(date, Math.min(120, days)) : '');
  }
  // An invoice asks for a deposit only when one is typed on it. The saved deposit is how the member
  // books (quotes and proposals); most invoices are for the work done or the balance.
  const typedDeposit = (input.deposit != null && input.deposit !== '') || Number(input.depositAmount) > 0;
  const useDeposit = isQuote || typedDeposit;
  const t = items.totals(list, { taxRate: f.taxRate || 0, deposit: useDeposit ? f.deposit : null, depositCents: useDeposit ? f.depositCents : 0, paid: isQuote ? 0 : Number(input.paid) || 0 });
  if (t.totalCents <= 0) throw new Error('The total comes to zero or less. Check the prices and discounts.');

  const fp = memory.fingerprint(kind, customer.name, list, `${title}|${isQuote ? '' : due}`);
  const { number, reused } = await memory.numberFor(ctx, kind, fp, { year: f.year, override: input.number });
  const d = { kind, number, date, validUntil, due, customer, title, notes: text.clip(input.notes || '', 1000), quoteRef: fromQuote ? fromQuote.number : '' };

  const who = customer.name || 'customer';
  const htmlStr = doc.html(kind, d, f, t);
  const saved = {};
  saved.html = await save.saveFile(ctx, save.fileName(kind, number, who, '.html'), htmlStr, 'text/html');
  if (input.csv !== false) saved.csv = await save.saveFile(ctx, save.fileName(kind, number, 'line items', '.csv'), doc.csv(kind, d, f, t), 'text/csv');
  if (isQuote) {
    const events = doc.quoteReminders(d, f);
    saved.reminders = await save.saveFile(ctx, save.fileName('quote', number, 'follow ups', '.ics'), files.ics(events, { name: `Quote ${number} follow-ups`, now: ctx.now() }));
  }
  const msg = doc.messages(kind, d, f, t);

  if (input.remember !== false) {
    try {
      await memory.saveSettings(ctx, settingsPatch(isQuote ? input : { ...input, deposit: undefined }, f));
      const rec = { kind, number, fp, date, customer: customer.name, email: customer.email, phone: customer.phone, title, totalCents: t.totalCents, items: list };
      if (isQuote) await memory.recordDoc(ctx, rec);
      else await memory.recordInvoice(ctx, { ...rec, due, balanceCents: t.balanceCents, dueNowCents: t.dueNowCents, payLink: f.payLink });
    } catch {
      /* memory is best effort */
    }
  }
  const tot = items.money(t.totalCents, f.currency);
  // pipeline: false when the calling workflow logs the customer in its own pack (a win, a booking),
  // so HQ shows one row, not one per pack.
  if (input.pipeline !== false) await pipeline.log(ctx, customer, {
    stage: isQuote ? 'replied' : 'won',
    source: isQuote ? 'Quote' : 'Invoice',
    note: isQuote ? `Quote ${number} for ${tot} made ${time.shortDate(date)}, good until ${time.shortDate(validUntil)}.` : `Invoice ${number} for ${items.money(t.dueNowCents, f.currency)} made ${time.shortDate(date)}, ${due ? `due ${time.shortDate(due)}` : 'due on receipt'}.`,
    data: { [kind]: { number, date, total: dollars(t.totalCents), due: due || undefined, validUntil: validUntil || undefined, title: title || undefined } },
  });

  if (f.missing.includes('business name')) warnings.push('Your business name isn\'t set, so the document uses your first name. Add it in Settings and it prints on every quote and invoice.');
  if (f.missing.includes('contact line')) warnings.push('Add your email or phone (the "your contact line" field) so customers can reach you from the document. It\'s saved for next time.');
  if (!f.payLink && !f.payNote && !isQuote) warnings.push('Add your payment link (Stripe, Square or PayPal.Me) or how to pay, so customers can pay in one tap. 127 never takes payment; it goes straight to you.');
  if (reused) warnings.push(`Same customer and lines as ${number}, so it keeps that number.`);
  const kept = input.remember !== false ? [isQuote && typedDeposit && 'deposit', input.terms && 'terms', input.promise && 'promise'].filter(Boolean) : [];
  if (kept.length) warnings.push(`Saved your ${text.list(kept)} for your next quotes and proposals. Type new ones any time.`);

  return {
    kind,
    number,
    date,
    validUntil,
    due,
    reused,
    customer,
    title,
    currency: f.currency,
    items: t.lines.map((l) => ({ label: l.label, detail: l.detail, qty: l.qty, unit: l.unit, price: l.price, amount: dollars(l.amountCents), taxable: l.taxable })),
    subtotal: dollars(t.subtotalCents),
    taxRate: t.taxRate,
    tax: dollars(t.taxCents),
    total: dollars(t.totalCents),
    depositRate: t.depositRate || 0,
    deposit: dollars(t.depositCents),
    paid: dollars(t.paidCents),
    dueNow: dollars(t.dueNowCents),
    balance: dollars(t.balanceCents),
    totalText: tot,
    dueNowText: items.money(t.dueNowCents, f.currency),
    depositText: t.depositCents ? items.money(t.depositCents, f.currency) : '',
    payLink: f.payLink,
    business: f.displayName,
    quoteRef: d.quoteRef,
    message: msg,
    messages: [
      { label: `Email to ${customer.name || 'your customer'}`, channel: 'email', to: customer.email, subject: msg.subject, text: msg.email },
      { label: `Text to ${customer.name || 'your customer'}`, channel: 'text', to: customer.phone, subject: '', text: msg.text },
    ],
    files: saved,
    warnings,
  };
}

// The output schema both tools share (strict: the harness checks it in tests).
const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const OUTPUT = {
  type: 'object',
  required: ['number', 'total', 'items', 'files'],
  properties: {
    kind: { type: 'string', enum: ['quote', 'invoice'] },
    number: { type: 'string' },
    date: { type: 'string' },
    validUntil: { type: 'string' },
    due: { type: 'string' },
    reused: { type: 'boolean' },
    customer: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, company: { type: 'string' } } },
    title: { type: 'string' },
    currency: { type: 'string' },
    items: {
      type: 'array',
      items: { type: 'object', properties: { label: { type: 'string' }, detail: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' }, price: { type: 'number' }, amount: { type: 'number' }, taxable: { type: 'boolean' } } },
    },
    subtotal: { type: 'number' },
    taxRate: { type: 'number' },
    tax: { type: 'number' },
    total: { type: 'number' },
    depositRate: { type: 'number' },
    deposit: { type: 'number' },
    paid: { type: 'number' },
    dueNow: { type: 'number' },
    balance: { type: 'number' },
    totalText: { type: 'string' },
    dueNowText: { type: 'string' },
    depositText: { type: 'string' },
    payLink: { type: 'string' },
    business: { type: 'string' },
    quoteRef: { type: 'string' },
    message: { type: 'object', properties: { subject: { type: 'string' }, email: { type: 'string' }, text: { type: 'string' } } },
    messages: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, channel: { type: 'string' }, to: { type: 'string' }, subject: { type: 'string' }, text: { type: 'string' } } } },
    files: { type: 'object', properties: { html: ASSET, csv: ASSET, reminders: ASSET } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
};

const ITEM = {
  type: 'object',
  required: ['label', 'price'],
  properties: {
    label: { type: 'string', maxLength: 120, title: 'Item' },
    detail: { type: 'string', maxLength: 300, title: 'Detail (optional)' },
    qty: { type: 'number', default: 1, title: 'Quantity' },
    unit: { type: 'string', maxLength: 20, title: 'Unit', description: 'job, hour, visit, month or item' },
    price: { type: 'number', title: 'Unit price in dollars' },
    taxable: { type: 'boolean', title: 'Taxable', default: true },
  },
};

const CUSTOMER = {
  type: 'object',
  title: 'Customer',
  properties: {
    name: { type: 'string', maxLength: 80 },
    email: { type: 'string', maxLength: 120 },
    phone: { type: 'string', maxLength: 40 },
    address: { type: 'string', maxLength: 200 },
    company: { type: 'string', maxLength: 80 },
    contact: { type: 'string', maxLength: 160, description: 'Email and/or phone typed together; split for you' },
  },
};

// Inputs both tools take (the quote/invoice interface other packs call with).
const COMMON = {
  items: { type: 'array', title: 'Line items', description: 'From a price menu or another step: [{ label, detail, qty, unit, price }]', items: ITEM },
  lines: { type: 'string', title: 'Line items, one per line', maxLength: 4000, description: 'Like "Full detail, 180" or "2 x Window cleaning @ 45" or "3 hours design at $60/hour". Discounts: "First-time discount, -20".' },
  customer: CUSTOMER,
  title: { type: 'string', maxLength: 120, title: 'What it is for (optional)' },
  notes: { type: 'string', maxLength: 1000, title: 'Notes on the document (optional)' },
  taxRate: { type: ['number', 'string'], title: 'Sales tax rate', description: '0.0825 or "8.25%" mean 8.25%. Leave empty for none.' },
  deposit: { type: ['number', 'string'], title: 'Deposit', description: '0.5 or "50%" mean half; "$100" means a fixed amount' },
  depositAmount: { type: 'number', title: 'Deposit in dollars (optional)' },
  payWhen: { type: 'string', enum: ['When the work is done', 'When they book', 'Each month, in advance'], default: 'When the work is done', title: 'With no deposit, they pay', description: 'Packages and lessons are often paid when they book; a monthly service each month in advance' },
  due: { type: 'string', maxLength: 10, title: 'Date (YYYY-MM-DD)', description: 'Invoice: the due date. Quote: the last day the price holds.' },
  payLink: { type: 'string', maxLength: 300, title: 'Your payment link', description: 'Stripe, Square, PayPal.Me or similar. Buyers pay you directly.' },
  payNote: { type: 'string', maxLength: 300, title: 'Other ways to pay', description: 'Like "Zelle to (512) 555-0142 or cash on the day"' },
  contact: { type: 'string', maxLength: 200, title: 'Your contact line', description: 'Your email and phone as they should print. Saved for next time.' },
  from: { type: 'object', title: 'From', properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, website: { type: 'string' }, address: { type: 'string' } } },
  address: { type: 'string', maxLength: 200, title: 'Your business address (optional)' },
  color: { type: 'string', maxLength: 7, title: 'Brand color hex (optional)' },
  terms: { type: 'string', maxLength: 1200, title: 'Your terms (optional)' },
  currency: { type: 'string', maxLength: 3, title: 'Currency code', description: 'USD unless your country uses another' },
  number: { type: 'string', maxLength: 30, title: 'Number (optional)', description: 'Leave empty to number it for you: Q-2026-001, INV-2026-001' },
  date: { type: 'string', maxLength: 10, title: 'Issue date (YYYY-MM-DD, optional)' },
  remember: { type: 'boolean', default: true, title: 'Remember my payment link, tax rate and contact line' },
  pipeline: { type: 'boolean', default: true, title: 'Add the customer to my Pipeline', description: 'Off when the workflow that calls it already logs them' },
  csv: { type: 'boolean', default: true, title: 'Also save the line items as a spreadsheet (CSV)' },
};

module.exports = { run, OUTPUT, ITEM, CUSTOMER, COMMON, ASSET, validDate, dollars, quoteSource };
