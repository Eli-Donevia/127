// sales.payment_reminders: who owes the member money and the message to send each one, on the right
// day: two days before it's due, on the day, then two polite nudges after. Calendar reminders and a
// CSV. Reads an invoice from an earlier step, a pasted list, or the open invoices the desk remembers.
// Never adds late fees or threats; payment goes straight to the member through their own link.

const { text, time, files, views, save } = require('../../_kit');
const { factsOf } = require('../lib/facts');
const memory = require('../lib/memory');
const items = require('../lib/items');
const dates = require('../lib/dates');
const { ASSET } = require('../lib/money-run');

const NUMBER_RE = /\b((?:INV|Q|P)-\d{4}-\d{2,4}|#\s?\d{2,6})\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

// "Marcus Lee, INV-2026-002, $129.90, due Oct 16, marcus@mail.example"
function parseOwed(raw, today) {
  const out = [];
  for (const line of String(raw || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    if (/^(customer|name)\s*,/i.test(line)) continue;
    let rest = line;
    const num = rest.match(NUMBER_RE);
    if (num) rest = rest.replace(num[0], ' ');
    const email = rest.match(EMAIL_RE);
    if (email) rest = rest.replace(email[0], ' ');
    const phone = rest.match(PHONE_RE);
    if (phone) rest = rest.replace(phone[0], ' ');
    const money = rest.match(/\$\s?([\d,]+(?:\.\d{1,2})?)|\b(\d[\d,]*\.\d{2})\b/);
    const amount = money ? Number((money[1] || money[2]).replace(/,/g, '')) : 0;
    if (money) rest = rest.replace(money[0], ' ');
    const due = dates.parseDate(rest, today, { mode: 'future' });
    const name = text.clip(
      rest
        .split(/[,;|\t]/)
        .map((x) => x.replace(/\b(due|on|by|owes?|invoice|paid?)\b.*$/i, '').trim())
        .find((x) => /[a-z]{2}/i.test(x) && !/\d/.test(x)) || '',
      60
    );
    if (!amount || !name) continue;
    out.push({ customer: name, number: num ? num[0].replace(/\s+/g, '') : '', amountCents: Math.round(amount * 100), due: due || today, email: email ? email[0] : '', phone: phone ? phone[0].trim() : '', payLink: '' });
  }
  return out;
}

function fromInvoice(inv) {
  if (!inv || typeof inv !== 'object' || !inv.number) return null;
  const c = inv.customer || {};
  return { customer: c.name || 'your customer', number: inv.number, amountCents: Math.round((Number(inv.dueNow) || Number(inv.balance) || Number(inv.total) || 0) * 100), due: inv.due || inv.date, email: c.email || '', phone: c.phone || '', payLink: inv.payLink || '' };
}

const STEPS = [
  { key: 'soon', offset: -2, label: 'Friendly reminder' },
  { key: 'today', offset: 0, label: 'Due today' },
  { key: 'late', offset: 3, label: 'First nudge' },
  { key: 'later', offset: 10, label: 'Second nudge' },
];

function message(step, o, f) {
  const first = text.firstName(o.customer) || 'there';
  const amt = items.money(o.amountCents, f.currency);
  const ref = o.number ? `invoice ${o.number}` : 'your invoice';
  const dueText = time.shortDate(o.due);
  const link = o.payLink || f.payLink;
  const how = link ? `You can pay here: ${link}` : f.payNote ? `You can pay by ${text.sentenceCase(f.payNote).replace(/\.$/, '')}.` : 'Reply and I\'ll send the ways to pay.';
  const sign = f.firstName || f.displayName;
  let body;
  let subject;
  if (step === 'soon') {
    subject = `Reminder: ${ref} is due ${dueText}`;
    body = `Hi ${first}, a quick reminder that ${ref} for ${amt} is due on ${dueText}. ${how} Thank you!`;
  } else if (step === 'today') {
    subject = `${text.sentenceCase(ref)} is due today`;
    body = `Hi ${first}, ${ref} for ${amt} is due today. ${how} Thanks again for having me do the work.`;
  } else if (step === 'late') {
    subject = `Checking in on ${ref}`;
    body = `Hi ${first}, just checking you got ${ref} for ${amt}, which was due ${dueText}. ${how} If anything looks off, tell me and I'll fix it.`;
  } else {
    subject = `${text.sentenceCase(ref)} is still open`;
    body = `Hi ${first}, ${ref} for ${amt} was due ${dueText} and is still open. Could you pay it this week? ${how} If splitting it into two payments would help, reply and we'll work it out.`;
  }
  return { subject, email: `${body}\n\n${sign}`, text: `${body} ${sign}` };
}

module.exports = {
  name: 'sales.payment_reminders',
  title: 'Plan payment reminders',
  description: 'Lists who owes you, how much and since when, and writes the reminder to send each one on the right day (before it is due, on the day, then two polite nudges), with calendar reminders and a CSV.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 30,
  input: {
    type: 'object',
    properties: {
      invoice: { type: 'object', title: 'An invoice from an earlier step', description: 'A sales.invoice output' },
      list: { type: 'string', maxLength: 6000, title: 'Who owes you, one per line', description: 'Like "Marcus Lee, INV-2026-002, $129.90, due Oct 16, marcus@mail.example"' },
      useSaved: { type: 'boolean', default: true, title: 'Include open invoices from the sales desk' },
      payLink: { type: 'string', maxLength: 300, title: 'Your payment link (optional)' },
      payNote: { type: 'string', maxLength: 300, title: 'Other ways to pay (optional)' },
    },
  },
  output: {
    type: 'object',
    required: ['owed', 'files'],
    properties: {
      count: { type: 'number' },
      late: { type: 'number' },
      owed: { type: 'number' },
      owedText: { type: 'string' },
      reminders: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            customer: { type: 'string' },
            number: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            amount: { type: 'number' },
            amountText: { type: 'string' },
            due: { type: 'string' },
            daysLate: { type: 'number' },
            status: { type: 'string' },
            sendOn: { type: 'string' },
            step: { type: 'string' },
            message: { type: 'object', properties: { subject: { type: 'string' }, email: { type: 'string' }, text: { type: 'string' } } },
            later: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, step: { type: 'string' } } } },
          },
        },
      },
      files: { type: 'object', properties: { calendar: ASSET, csv: ASSET } },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const today = f.today;
    const seen = new Set();
    const owed = [];
    const add = (o) => {
      if (!o || !(o.amountCents > 0)) return;
      const k = (o.number || `${o.customer}|${o.amountCents}`).toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      owed.push(o);
    };
    add(fromInvoice(input.invoice));
    parseOwed(input.list, today).forEach(add);
    if (input.useSaved !== false && !input.invoice) {
      for (const inv of memory.openInvoices(ctx)) add({ customer: inv.customer, number: inv.number, amountCents: inv.balanceCents != null ? inv.balanceCents : inv.totalCents, due: inv.due || inv.date, email: inv.email || '', phone: inv.phone || '', payLink: inv.payLink || '' });
    }
    if (!owed.length) throw new Error('Nobody owes you money right now. Paste who owes you, one per line, like "Marcus Lee, $129.90, due Oct 16".');

    const reminders = owed.map((o) => {
      const daysLate = Math.max(0, dates.diffDays(today, o.due));
      const plan = STEPS.map((s) => {
        let d = time.addDays(o.due, s.offset);
        // Before the due date, a weekend moves back to Friday; after it, forward to Monday.
        if (s.offset < 0) while ([0, 6].includes(time.weekdayOf(d))) d = time.addDays(d, -1);
        else d = dates.weekday(d);
        return { step: s.key, label: s.label, date: d };
      }).filter((s, i, a) => s.date >= today && !a.slice(i + 1).some((x) => x.date === s.date));
      // Already late with nothing sent yet: the first nudge goes today.
      if (daysLate > 0 && (!plan.length || plan[0].step === 'later')) plan.unshift({ step: daysLate > 7 ? 'later' : 'late', label: daysLate > 7 ? 'Second nudge' : 'First nudge', date: today });
      const next = plan[0] || { step: 'later', label: 'Second nudge', date: today };
      const status = daysLate > 0 ? 'late' : o.due === today ? 'due today' : dates.diffDays(o.due, today) <= 3 ? 'due soon' : 'not due yet';
      return {
        customer: o.customer,
        number: o.number,
        email: o.email,
        phone: o.phone,
        amount: o.amountCents / 100,
        amountText: items.money(o.amountCents, f.currency),
        due: o.due,
        daysLate,
        status,
        sendOn: next.date,
        step: next.label,
        message: message(next.step, o, f),
        later: plan.slice(1, 4).map((s) => ({ date: s.date, step: s.label })),
        _plan: plan,
        _o: o,
      };
    });
    reminders.sort((a, b) => b.daysLate - a.daysLate || a.sendOn.localeCompare(b.sendOn));

    const events = [];
    const rows = [];
    for (const r of reminders) {
      for (const s of r._plan) {
        const m = message(s.step, r._o, f);
        events.push({ uid: `pay-${text.slug(r.number || r.customer, 30)}-${s.step}@sales.127`, title: `Payment reminder: ${r.customer} (${r.amountText})`, description: `${s.label}. Send by ${r.email ? 'email' : r.phone ? 'text' : 'email or text'}:\n\n${m.text}`, date: s.date, time: '09:30', minutes: 15, tz: time.tzOf(ctx) });
        rows.push({ customer: r.customer, number: r.number, amount: r.amountText, due: r.due, status: r.status, sendOn: s.date, step: s.label, email: r.email, phone: r.phone, message: m.text });
      }
    }
    const who = f.name || f.firstName || 'sales';
    const saved = {};
    saved.calendar = await save.saveFile(ctx, save.fileName(who, 'payment reminders', '.ics'), files.ics(events, { name: 'Payment reminders', now: ctx.now() }));
    saved.csv = await save.saveFile(
      ctx,
      save.fileName(who, 'who owes me', '.csv'),
      files.csv(rows, [
        { key: 'customer', label: 'Customer' },
        { key: 'number', label: 'Invoice' },
        { key: 'amount', label: 'Amount' },
        { key: 'due', label: 'Due' },
        { key: 'status', label: 'Status' },
        { key: 'sendOn', label: 'Send on' },
        { key: 'step', label: 'Reminder' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'message', label: 'Message' },
      ], { bom: true }),
      'text/csv'
    );
    const total = owed.reduce((a, o) => a + o.amountCents, 0);
    const warnings = [];
    if (!f.payLink && !f.payNote && !owed.some((o) => o.payLink)) warnings.push('Add your payment link or how to pay, so every reminder lets them pay in one tap. 127 never takes payment; it goes straight to you.');
    return {
      count: reminders.length,
      late: reminders.filter((r) => r.daysLate > 0).length,
      owed: total / 100,
      owedText: items.money(total, f.currency),
      reminders: reminders.map(({ _plan, _o, ...r }) => r),
      files: saved,
      warnings,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Owed to you', out.owedText, `${out.count} invoice${out.count === 1 ? '' : 's'}${out.late ? `, ${out.late} late` : ''}`),
      (out.warnings || []).map((w) => views.text(w)),
      views.table(
        [
          { key: 'customer', label: 'Customer' },
          { key: 'amountText', label: 'Owed' },
          { key: 'due', label: 'Due' },
          { key: 'status', label: 'Status' },
          { key: 'sendOn', label: 'Send on' },
        ],
        out.reminders
      ),
      out.reminders.slice(0, 5).map((r) => views.copy(`${r.step} to ${r.customer}, send ${r.sendOn}`, r.email ? r.message.email : r.message.text, r.email ? { to: r.email, subject: r.message.subject } : undefined)),
      views.file(out.files.calendar, 'Every reminder on your calendar, with the message inside'),
      views.file(out.files.csv, 'Who owes you (CSV)')
    );
  },
};
