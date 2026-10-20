// Unpaid invoices from a CSV export (QuickBooks, Wave, FreshBooks, Square, Stripe or a sheet) or
// typed lines, into a chase list: how late each one is, which kind of reminder fits, and a draft.
// Drafts stay polite and factual (Legal F5). After 30 days they get firmer: a clear amount, a date to pay
// by, never a threat, fee or legal claim. noThreat() checks every draft.

const { parseCsv } = require('./csv');
const { parseDateCell, daysBetween, findDate } = require('./dates');
const { time } = require('../../_kit');

const r2 = (n) => Math.round(n * 100) / 100;
const usd = (n) => `$${r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function amountOf(v) {
  const s = String(v == null ? '' : v).replace(/[^\d.,()-]/g, '');
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = Number(s.replace(/[(),-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

const COLS = {
  customer: /^(customer|client|customer name|client name|name|bill to|billed to|company|contact|payer)$/i,
  email: /e-?mail/i,
  number: /^(invoice|invoice ?(#|no\.?|number|id)|inv(oice)? ?#?|number|no\.?|#|doc(ument)? ?(no|number))$/i,
  balance: /^(balance|balance due|amount due|amount remaining|open balance|outstanding|amount outstanding|due amount|remaining)$/i,
  total: /^(amount|total|invoice total|invoice amount|amount \(usd\)|total \(usd\))$/i,
  paid: /^(paid|amount paid|payments)$/i,
  due: /^(due|due date|date due|payment due|due on)$/i,
  issued: /^(date|invoice date|issued|issue date|created|sent|date issued)$/i,
  status: /^(status|state)$/i,
};

function colIndex(columns) {
  const idx = {};
  for (const [k, re] of Object.entries(COLS)) {
    const i = columns.findIndex((c) => re.test(String(c).trim()));
    if (i >= 0) idx[k] = i;
  }
  if (idx.customer == null) {
    const i = columns.findIndex((c) => /customer|client|name/i.test(c) && !/e-?mail/i.test(c));
    if (i >= 0) idx.customer = i;
  }
  if (idx.balance == null && idx.total == null) {
    const i = columns.findIndex((c) => /amount|balance|due|total/i.test(c) && !/date/i.test(c));
    if (i >= 0) idx.total = i;
  }
  return idx;
}

function fromCsv(textIn, today, { termsDays = 30 } = {}) {
  const { columns, rows } = parseCsv(textIn, { maxRows: 2000 });
  const idx = colIndex(columns);
  const missing = [];
  if (idx.customer == null) missing.push('a customer or client name');
  if (idx.balance == null && idx.total == null) missing.push('an amount or balance');
  if (idx.due == null && idx.issued == null) missing.push('a due date or invoice date');
  if (missing.length) throw new Error(`This file needs a column for ${missing.join(', ')}. The columns found were: ${columns.slice(0, 12).join(', ') || 'none'}.`);
  const out = [];
  let skipped = 0;
  for (const r of rows) {
    const get = (k) => (idx[k] != null ? String(r[idx[k]] || '').trim() : '');
    if (/^(paid|void|voided|draft|deleted|cancel+ed|written off|uncollectible)$/i.test(get('status'))) {
      skipped++;
      continue;
    }
    let owed = amountOf(get('balance'));
    if (owed == null) {
      const total = amountOf(get('total'));
      const paid = amountOf(get('paid')) || 0;
      owed = total == null ? null : total - paid;
    }
    const customer = get('customer');
    if (!customer || owed == null || owed <= 0.005) {
      skipped++;
      continue;
    }
    let due = parseDateCell(get('due'), today);
    let guessed = false;
    if (!due) {
      const issued = parseDateCell(get('issued'), today);
      if (issued) {
        due = time.addDays(issued, termsDays);
        guessed = true;
      }
    }
    if (!due) {
      skipped++;
      continue;
    }
    out.push(row({ customer, email: get('email'), number: get('number'), owed, due, guessed }, today));
  }
  return { invoices: out, skipped, columns };
}

// "Marcus Lee, INV-1043, $480, due Sep 15, marcus@mail.example"
function fromLines(textIn, today) {
  const out = [];
  for (const raw of String(textIn || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const email = (line.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [''])[0];
    const money = line.match(/\$\s?([\d,]+(?:\.\d{1,2})?)|\b([\d,]+\.\d{2})\b/);
    const owed = money ? amountOf(money[1] || money[2]) : null;
    const number = (line.match(/(?:\binv(?:oice)?[\s#-]*\w*\d[\w-]*|#\s?\d{2,})/i) || [''])[0].replace(/^invoice\s*/i, '').trim();
    const rest = line.replace(email, ' ').replace(money ? money[0] : '', ' ');
    const due = findDate(rest, today);
    const customer = line.split(/[,;|\t]/)[0].replace(/\s+-\s+.*$/, '').trim();
    if (!customer || owed == null || !due) continue;
    out.push(row({ customer, email, number, owed, due: due.date, guessed: false }, today));
  }
  return out;
}

function tierOf(daysLate) {
  if (daysLate <= 0) return 'not_due';
  if (daysLate <= 14) return 'gentle';
  if (daysLate <= 30) return 'second';
  if (daysLate <= 60) return 'firm';
  return 'firmest';
}
const TIER_LABEL = { not_due: 'Not due yet', gentle: 'Friendly nudge', second: 'Second reminder', firm: 'Firmer: over 30 days', firmest: 'Firmer: over 60 days' };

function row({ customer, email, number, owed, due, guessed }, today) {
  const daysLate = daysBetween(due, today);
  return { customer: customer.slice(0, 80), email: email || '', number: number || '', owed: r2(owed), due, dueGuessed: !!guessed, daysLate, tier: tierOf(daysLate), stage: TIER_LABEL[tierOf(daysLate)] };
}

// Words a reminder never uses: no threats, fees, penalties, collections, credit or legal claims.
const THREATS = [
  /\blegal\b/i, /\blaw ?(yer|suit|firm)s?\b/i, /\battorneys?\b/i, /\bcourts?\b/i, /\bsu(e|ing)\b/i, /\bsmall claims\b/i,
  /\bcollections?\b/i, /\bdebt collect/i, /\bcredit (report|bureau|score|rating|agenc)/i, /\bliens?\b/i, /\bgarnish/i,
  /\bpenalt(y|ies)\b/i, /\blate (fee|charge)s?\b/i, /\binterest\b/i, /\bfinal (notice|warning|demand)\b/i, /\bdemand\b/i,
  /\bor else\b/i, /\bconsequences?\b/i, /\blast chance\b/i, /\bforced to\b/i, /\bfailure to pay\b/i, /\bbreach\b/i,
  /\bsuspend(ed)? (your )?(service|account)\b/i, /\bimmediately\b/i, /\bwe will (take|have to)\b/i, /\bescalat/i,
];
const noThreat = (s) => THREATS.filter((re) => re.test(String(s || ''))).map((re) => String(re).replace(/^\/\\b|\\b\/i$|\/i$/g, ''));

function payBy(today) {
  // Five business days from today.
  let d = today;
  let n = 0;
  while (n < 5) {
    d = time.addDays(d, 1);
    if (![0, 6].includes(time.weekdayOf(d))) n++;
  }
  return d;
}

// A first name when the customer looks like a person ("Marcus Lee"), else '' ("Oak Street Dental").
const BIZ = /\b(inc|llc|co|corp|ltd|company|group|family|properties|property|management|services|dental|clinic|hoa|association|church|school|street|st|ave|cafe|restaurant|salon|studio|shop|store|bakery|realty|homes|construction|partners|associates|and|&|the|of)\b/i;
function personName(name) {
  const words = String(name || '').trim().split(/\s+/);
  if (words.length < 1 || words.length > 3 || BIZ.test(name)) return '';
  if (!words.every((w) => /^[A-Z][a-z'-]+\.?$/.test(w))) return '';
  return words.length === 1 ? '' : words[0];
}

function draft(inv, { me = '', business = '', payLink = '', today }) {
  const hi = personName(inv.customer) ? `Hi ${personName(inv.customer)},` : 'Hello,';
  const ref = inv.number ? `invoice ${inv.number}` : 'my invoice';
  const amount = usd(inv.owed);
  const dueText = time.shortDate(inv.due);
  const pay = payLink ? `You can pay here: ${payLink}` : 'You can pay the same way as before, or reply and I will send a payment link.';
  const sign = [me || '[Your name]', business].filter(Boolean).join('\n');
  const byDate = time.shortDate(payBy(today));
  const bodies = {
    not_due: `Just a friendly heads-up that ${ref} for ${amount} is due ${dueText}. ${pay}\n\nThank you!`,
    gentle: `I hope all is well. A quick reminder that ${ref} for ${amount} was due ${dueText}. It may have slipped through, which happens.\n\n${pay}\n\nIf you have already sent it, thank you, and please ignore this note.`,
    second: `Following up on ${ref} for ${amount}, which was due ${dueText}. I have not seen a payment yet, so I wanted to check in.\n\n${pay}\n\nIf something about the invoice is not right, tell me and I will fix it.`,
    firm: `I'm writing about ${ref} for ${amount}. It was due ${dueText}, ${inv.daysLate} days ago, and it is still open.\n\nPlease pay it by ${byDate}. ${pay}\n\nIf paying it all at once is hard right now, or something about the work or the invoice is not right, reply and let's talk it through.`,
    firmest: `${ref[0].toUpperCase()}${ref.slice(1)} for ${amount} has been open since ${dueText}, ${inv.daysLate} days now.\n\nPlease pay it by ${byDate}, or reply by then so we can agree on a date that works. ${pay}\n\nIf something is holding this up, call or reply. I would much rather talk it through.`,
  };
  const subject = {
    not_due: `${ref[0].toUpperCase()}${ref.slice(1)} due ${dueText}`,
    gentle: `Friendly reminder: ${ref}`,
    second: `Following up: ${ref} for ${amount}`,
    firm: `${ref[0].toUpperCase()}${ref.slice(1)} for ${amount}, due ${dueText}`,
    firmest: `Settling ${ref} for ${amount}`,
  }[inv.tier];
  return { to: inv.email || '', subject, body: `${hi}\n\n${bodies[inv.tier]}\n\n${sign}` };
}

module.exports = { personName, fromCsv, fromLines, row, tierOf, draft, noThreat, amountOf, usd, r2, payBy, TIER_LABEL, THREATS, colIndex };
