// Quotes and invoices: the printable HTML, the line-item CSV and the messages to send with them.
// Everything comes from the member's own facts (lib/facts.js) and the numbers in lib/items.js.
// The member is the sender; 127 never takes payment (their own link or instructions only).

const { text, time, files } = require('../../_kit');
const items = require('./items');
const docs = require('./docs');

const esc = docs.esc;

function customerOf(c = {}) {
  const typed = String(c.contact || '');
  const email = String(c.email || (typed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0]).trim();
  const phoneM = typed.replace(email, ' ').match(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  return {
    name: text.clip(c.name || '', 80),
    email: text.clip(email, 120),
    phone: text.clip(c.phone || (phoneM ? phoneM[0].trim() : ''), 40),
    address: text.clip(c.address || '', 200),
    company: text.clip(c.company || '', 80),
  };
}

const firstOf = (name) => text.firstName(name).replace(/[^A-Za-z'-]/g, '') || '';

// A "deposit" of the whole total is payment in full: no balance to show.
const inFull = (t) => t.depositCents > 0 && t.depositCents >= t.totalCents;

// "50% deposit to book: $135.86"
function depositLine(t, f, kind) {
  if (!t.depositCents) return '';
  if (inFull(t)) return `Paid in full ${kind === 'quote' ? 'to book' : 'now'}: ${items.money(t.depositCents, f.currency)}`;
  const pct = t.depositRate ? `${items.pctText(t.depositRate)} deposit` : 'Deposit';
  return `${pct} ${kind === 'quote' ? 'to book' : 'due now'}: ${items.money(t.depositCents, f.currency)}`;
}

function totalsHtml(t, f, kind) {
  const m = (c) => items.money(c, f.currency);
  const rows = [];
  rows.push(`<div class="row"><span>Subtotal</span><span>${m(t.subtotalCents)}</span></div>`);
  if (t.taxCents) rows.push(`<div class="row"><span>Sales tax (${esc(items.pctText(t.taxRate))})</span><span>${m(t.taxCents)}</span></div>`);
  rows.push(`<div class="row grand"><span>Total</span><span>${m(t.totalCents)}</span></div>`);
  if (t.paidCents) rows.push(`<div class="row soft"><span>Paid so far</span><span>-${m(t.paidCents)}</span></div>`);
  if (inFull(t)) {
    rows.push(`<div class="row due"><span>${kind === 'quote' ? 'Paid in full to book' : 'Amount due'}</span><span>${m(kind === 'quote' ? t.depositCents : t.dueNowCents)}</span></div>`);
  } else if (t.depositCents) {
    rows.push(`<div class="row due"><span>${esc(t.depositRate ? `Deposit${kind === 'quote' ? ' to book' : ' due now'} (${items.pctText(t.depositRate)})` : kind === 'quote' ? 'Deposit to book' : 'Deposit due now')}</span><span>${m(kind === 'quote' ? t.depositCents : t.dueNowCents)}</span></div>`);
    rows.push(`<div class="row soft"><span>${kind === 'quote' ? 'Balance when the work is done' : 'Balance after this payment'}</span><span>${m(Math.max(0, t.totalCents - t.depositCents))}</span></div>`);
  } else if (kind === 'invoice') {
    rows.push(`<div class="row due"><span>Amount due</span><span>${m(t.dueNowCents)}</span></div>`);
  }
  return `<div class="totals">${rows.join('')}</div>`;
}

function itemsHtml(t, f) {
  const m = (c) => items.money(c, f.currency);
  const rows = t.lines
    .map((l) => {
      const amount = l.amountCents === 0 ? 'Included' : m(l.amountCents);
      return `<tr><td><div class="item">${esc(l.label)}</div>${l.detail ? `<div class="detail">${esc(l.detail)}</div>` : ''}</td><td class="num">${esc(items.qtyText(l))}</td><td class="num">${esc(l.priceCents === 0 ? '' : items.unitPriceText(l, f.currency))}</td><td class="num amt${l.amountCents < 0 ? ' neg' : ''}">${esc(amount)}</td></tr>`;
    })
    .join('');
  return `<table class="items"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function partyHtml(heading, lines) {
  const a = lines.filter(Boolean);
  if (!a.length) return '';
  return `<div class="party"><h3>${esc(heading)}</h3><p><strong>${esc(a[0])}</strong>${a.slice(1).map((x) => `<br>${esc(x)}`).join('')}</p></div>`;
}

function payBox(f, amountCents, { heading = 'How to pay', full = true } = {}) {
  if (!f.payLink && !f.payNote) return '';
  const qr = docs.qrFor(f.payLink, f.palette);
  const btn = f.payLink ? `<a class="btn" href="${esc(f.payLink)}">Pay ${esc(items.money(amountCents, f.currency))} online</a><div class="link">${esc(f.payLink.replace(/^https:\/\//, ''))}</div>` : '';
  const note = f.payNote ? `<p class="paynote">${f.payLink ? '<b>Other ways to pay:</b> ' : ''}${esc(docs.text1(f.payNote))}</p>` : '';
  return `<div class="box tinted${full ? ' full' : ''} paybox"><div class="pay"><div><h3>${esc(heading)}</h3>${btn}${note}</div>${qr ? `<div class="qr">${qr}<div class="cap">Scan to pay</div></div>` : ''}</div></div>`;
}

function termsList(lines) {
  const a = lines.filter(Boolean);
  return a.length ? `<ul class="terms">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
}

function splitTerms(s) {
  return String(s || '')
    .split(/\n+|(?<=\.)\s+(?=[A-Z])/)
    .map((x) => text.oneLine(x))
    .filter(Boolean)
    .slice(0, 8);
}

// When they pay, with no deposit (facts payWhen).
const PAY_WHEN = { done: 'Payment is due when the work is done.', booking: 'Payment is due when you book.', monthly: 'Payment is due at the start of each month, before that month’s work.' };

function quoteTerms(d, f, t) {
  const out = [`This quote is good until ${time.longDate(d.validUntil)}.`];
  if (inFull(t)) out.push(`Payment in full (${items.money(t.depositCents, f.currency)}) books your date.`);
  else if (t.depositCents) out.push(`A ${t.depositRate ? `${items.pctText(t.depositRate)} ` : ''}deposit of ${items.money(t.depositCents, f.currency)} books your date. The rest is due when the work is done.`);
  else out.push(PAY_WHEN[f.payWhen] || PAY_WHEN.done);
  out.push('Anything not listed here is quoted before I start, so there are no surprises.');
  if (t.taxCents) out.push(`Sales tax of ${items.pctText(t.taxRate)} is added to the subtotal.`);
  return [...out, ...splitTerms(f.terms)];
}

function invoiceTerms(d, f, t) {
  const out = [d.due ? `Payment is due by ${time.longDate(d.due)}.` : 'Payment is due when you receive this invoice.'];
  out.push(`Please note invoice ${d.number} with your payment.`);
  if (t.taxCents) out.push(`Sales tax of ${items.pctText(t.taxRate)} is added to the subtotal.`);
  return [...out, ...splitTerms(f.terms)];
}

// The whole quote or invoice page.
function html(kind, d, f, t) {
  const isQuote = kind === 'quote';
  const m = (c) => items.money(c, f.currency);
  const cust = d.customer;
  const title = d.title || (cust.name ? `${isQuote ? 'Quote' : 'Invoice'} for ${cust.name}` : isQuote ? 'Your quote' : 'Your invoice');
  const meta = isQuote
    ? [['Quote no.', d.number], ['Date', time.shortDate(d.date)], ['Good until', time.shortDate(d.validUntil)]]
    : [['Invoice no.', d.number], ['Issued', time.shortDate(d.date)], ['Due', d.due ? time.shortDate(d.due) : 'On receipt'], d.quoteRef ? ['Quote', d.quoteRef] : null];
  const bigCents = isQuote ? t.totalCents : t.dueNowCents;
  const sub = isQuote ? depositLine(t, f, 'quote') || `Good until ${time.shortDate(d.validUntil)}` : t.depositCents && !inFull(t) ? `Total ${m(t.totalCents)}. Balance later ${m(Math.max(0, t.totalCents - t.depositCents))}` : d.due ? `Due ${time.longDate(d.due)}` : 'Due on receipt';
  const from = [f.firstName && f.hasName ? `${f.firstName}, ${f.displayName}` : f.displayName, f.email, f.phone];
  const toLines = [cust.name || 'Customer', cust.company, cust.email, cust.phone, cust.address];
  const next = isQuote
    ? [
        `Reply "yes" to the message this came with, or sign below.`,
        inFull(t) ? `Pay ${m(t.depositCents)} to hold your date.` : t.depositCents ? `Pay the ${m(t.depositCents)} deposit to hold your date.` : 'Pick a day and time that works for you.',
        `I confirm your ${f.job || 'appointment'} and send a reminder the day before.`,
      ]
    : [];
  const notes = d.notes ? `<div class="box full"><h3>Notes</h3><p>${esc(d.notes)}</p></div>` : '';
  const payHeading = isQuote ? (t.depositCents && !inFull(t) ? 'Pay the deposit' : 'How to pay') : 'How to pay';
  const pay = payBox(f, isQuote ? t.depositCents || t.totalCents : t.dueNowCents, { heading: payHeading });
  const body = `<main class="sheet">
${docs.header(f)}
<section class="title">
  <div>
    <span class="kicker">${isQuote ? 'Quote' : 'Invoice'}</span>
    <h1>${esc(title)}</h1>
    <dl class="meta">${meta.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  </div>
  <div class="total-card"><div class="label">${isQuote ? 'Total' : 'Amount due'}</div><div class="amount">${esc(m(bigCents))}</div><div class="sub">${esc(sub)}</div></div>
</section>
<section class="parties">${partyHtml(isQuote ? 'Prepared for' : 'Bill to', toLines)}${partyHtml(isQuote ? 'Prepared by' : 'From', from)}</section>
${itemsHtml(t, f)}
<section class="sum">
  <div class="sum-left">${pay || (isQuote ? `<div class="box"><h3>What happens next</h3>${docs.steps(next)}</div>` : notes)}</div>
  ${totalsHtml(t, f, kind)}
</section>
<section class="boxes">
${pay || isQuote ? notes : ''}
${isQuote && pay ? `<div class="box"><h3>What happens next</h3>${docs.steps(next)}</div>` : ''}
<div class="box${isQuote && pay ? '' : ' full'}"><h3>Terms</h3>${termsList(isQuote ? quoteTerms(d, f, t) : invoiceTerms(d, f, t))}</div>
${isQuote ? `<div class="box full accept"><div><h3>Accept this quote</h3><p class="note">Sign and date, or just reply "yes".</p></div><div class="sign"><div>Signature</div><div>Date</div></div></div>` : ''}
</section>
<footer class="foot"><div>${esc(isQuote ? `Thank you${cust.name ? `, ${firstOf(cust.name) || cust.name}` : ''}. I'd love to do this for you.` : `Thank you${cust.name ? `, ${firstOf(cust.name) || cust.name}` : ''}. It was a pleasure.`)}</div><div>${esc([f.phone ? `Questions? Call or text ${f.phone}` : f.email ? `Questions? ${f.email}` : '', ''].filter(Boolean).join(''))}</div></footer>
</main>`;
  return docs.doc({ title: `${isQuote ? 'Quote' : 'Invoice'} ${d.number}${cust.name ? ` for ${cust.name}` : ''}, ${f.displayName}`, description: `${isQuote ? 'Quote' : 'Invoice'} from ${f.displayName}`, body, pal: f.palette, paper: f.paper });
}

// CSV: the line items plus subtotal, tax, total and deposit rows, numbers without currency signs.
function csv(kind, d, f, t) {
  const n = (c) => (Math.round(c) / 100).toFixed(2);
  const base = { doc: kind === 'quote' ? 'Quote' : 'Invoice', number: d.number, date: d.date, customer: d.customer.name };
  const rows = t.lines.map((l) => ({ ...base, item: l.label, detail: l.detail, qty: l.qty, unit: l.unit || '', price: n(l.priceCents), amount: n(l.amountCents) }));
  const sum = (label, c) => ({ ...base, item: label, detail: '', qty: '', unit: '', price: '', amount: n(c) });
  rows.push(sum('Subtotal', t.subtotalCents));
  if (t.taxCents) rows.push(sum(`Sales tax ${items.pctText(t.taxRate)}`, t.taxCents));
  rows.push(sum('Total', t.totalCents));
  if (t.paidCents) rows.push(sum('Paid so far', -t.paidCents));
  if (t.depositCents) rows.push(sum(inFull(t) ? (kind === 'quote' ? 'Paid in full to book' : 'Amount due') : kind === 'quote' ? 'Deposit to book' : 'Deposit due now', t.depositCents));
  if (kind === 'invoice') rows.push(sum('Amount due', t.dueNowCents));
  const cols = [
    { key: 'doc', label: 'Document' },
    { key: 'number', label: 'Number' },
    { key: 'date', label: 'Date' },
    { key: 'customer', label: 'Customer' },
    { key: 'item', label: 'Item' },
    { key: 'detail', label: 'Detail' },
    { key: 'qty', label: 'Qty' },
    { key: 'unit', label: 'Unit' },
    { key: 'price', label: `Unit price (${f.currency})` },
    { key: 'amount', label: `Amount (${f.currency})` },
  ];
  return files.csv(rows, cols, { bom: true });
}

// The messages that go with the document: an email and a text, in the member's voice.
function messages(kind, d, f, t) {
  const m = (c) => items.money(c, f.currency, { short: true });
  const first = firstOf(d.customer.name);
  const hi = first ? `Hi ${first},` : 'Hi,';
  const what = d.title ? text.sentenceCase(d.title).replace(/\.$/, '') : '';
  const whatLower = what ? what.charAt(0).toLowerCase() + what.slice(1) : '';
  const me = f.firstName ? `${f.firstName}${f.hasName ? ` from ${f.displayName}` : ''}` : f.displayName;
  const sign = f.signOff || f.displayName;
  const payLine = f.payLink ? `You can pay here: ${f.payLink}` : f.payNote ? text.sentenceCase(f.payNote).replace(/([^.!?])$/, '$1.') : '';
  if (kind === 'quote') {
    const dep = inFull(t) ? ` Paying it books your date.` : t.depositCents ? ` A ${m(t.depositCents)} deposit books your date.` : '';
    const subject = `Your quote from ${f.displayName}${what ? `: ${what}` : ''}`;
    const email = [
      hi,
      '',
      `Thanks for asking. Your quote${whatLower ? ` for ${whatLower}` : ''} is attached: ${m(t.totalCents)} total, good until ${time.longDate(d.validUntil)}.${dep}`,
      '',
      t.depositCents && payLine ? `When you're ready, reply "yes" and pay ${inFull(t) ? 'it' : 'the deposit'} to hold your spot. ${payLine}` : `When you're ready, just reply "yes" and I'll get you on the calendar.`,
      '',
      f.phone ? `Any questions, call or text me at ${f.phone}.` : 'Any questions, just reply to this email.',
      '',
      sign,
    ].join('\n');
    const sms = `${hi.replace(/,$/, '')}, it's ${me}. Your quote${whatLower ? ` for ${whatLower}` : ''} comes to ${m(t.totalCents)}${t.depositCents && !inFull(t) ? ` (${m(t.depositCents)} deposit to book)` : inFull(t) ? ', paid when you book' : ''}. I just emailed the full quote. Want me to hold a day for you?`;
    return { subject, email, text: sms };
  }
  const due = d.due ? `due ${time.longDate(d.due)}` : 'due on receipt';
  const subject = `Invoice ${d.number} from ${f.displayName}`;
  const amount = t.dueNowCents;
  const email = [
    hi,
    '',
    `Thank you again${whatLower ? ` for choosing me for ${whatLower}` : ''}. Your invoice ${d.number} is attached: ${m(amount)} ${due}.${t.depositCents && t.depositCents < t.totalCents ? ` That's the deposit. The balance of ${m(t.totalCents - t.depositCents)} comes due when the work is done.` : ''}`,
    '',
    payLine,
    payLine ? '' : null,
    'If anything looks off, just reply and I will fix it.',
    '',
    sign,
  ]
    .filter((x) => x !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  const sms = `${hi.replace(/,$/, '')}, it's ${me}. Your invoice for ${m(amount)} is ${due}.${f.payLink ? ` Pay here: ${f.payLink}` : ''} Thank you!`;
  return { subject, email, text: sms };
}

// Follow-up reminders for a quote: two nudges and the day before it runs out (ICS events).
function quoteReminders(d, f) {
  const nudge = (days) => {
    let day = time.addDays(d.date, days);
    const wd = time.weekdayOf(day);
    if (wd === 0) day = time.addDays(day, 1);
    if (wd === 6) day = time.addDays(day, 2);
    return day;
  };
  const who = d.customer.name || 'your customer';
  const events = [
    { date: nudge(2), title: `Check in with ${who} about quote ${d.number}`, note: 'Ask if they have any questions about the quote.' },
    { date: nudge(5), title: `Offer ${who} a date for quote ${d.number}`, note: 'Offer two days you can do the work this week or next.' },
  ];
  const lastDay = time.addDays(d.validUntil, -1);
  if (lastDay > events[1].date) events.push({ date: lastDay, title: `Quote ${d.number} for ${who} runs out tomorrow`, note: 'Let them know the price is good until tomorrow, then follow up once more next week if you still want the job.' });
  return events.map((e, i) => ({ uid: `${d.number}-${i}@sales.127group.io`, title: e.title, description: `${e.note}${d.customer.phone ? ` Phone: ${d.customer.phone}.` : ''}${d.customer.email ? ` Email: ${d.customer.email}.` : ''}`, date: e.date, time: '09:30', minutes: 15, tz: f.timezone }));
}

module.exports = { customerOf, firstOf, html, csv, messages, quoteReminders, depositLine, totalsHtml, itemsHtml, payBox, quoteTerms, invoiceTerms };
