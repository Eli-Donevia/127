// shop.launch_emails: the emails for a product launch or a drop, from the first look to the thank-you,
// dated back from launch day, as a page to copy from and a calendar file of send times. Code
// templates from the member's own facts; nothing about stock, deadlines or results they didn't type.

const { text, files, save, views, brain, time, money } = require('../../_kit');
const H = require('../lib/html');
const L = require('../lib/launch');
const { brandColors } = require('../lib/brand');

function emailBox(e) {
  return `<article class="mail"><header><span class="n">${e.n}</span><div><p class="kicker">${H.esc(`${L.when(e.sendOn, e.time)}`)}</p><h3>${H.esc(e.title)}</h3><p class="to">To: ${H.esc(e.audience)}</p></div></header>
<div class="copy"><div class="subject">Subject: ${H.esc(e.subject)}</div><div class="pv">Preview text: ${H.esc(e.preview)}</div>${H.esc(e.body)}</div></article>`;
}

function pageHtml({ f, list, checklist, colors, today }) {
  const t = H.theme(colors.primary);
  const extra = `
.mail{margin:0 0 34px}
.mail header{display:grid;grid-template-columns:52px 1fr;gap:16px;align-items:start;margin-bottom:12px}
.mail .n{width:52px;height:52px;border-radius:16px;background:var(--p);color:var(--on-p);display:grid;place-items:center;font-weight:800;font-size:22px}
.mail .kicker{margin:2px 0 4px}
.mail h3{margin:0}
.mail .to{margin:2px 0 0;color:var(--muted);font-size:15px}
.copy .pv{color:var(--muted);font-size:14px;margin:-4px 0 16px;white-space:normal}
.notes{margin-top:18px}`;
  const drop = f.mode === 'drop';
  const body = [
    H.hero({
      eyebrow: drop ? 'Drop emails' : 'Launch emails',
      heading: `${list.length} emails for ${f.short}`,
      lead: 'From the first look to the thank-you. Copy each one into your email tool and schedule it for the day shown.',
      meta: [{ value: L.when(f.date, f.time), label: 'goes live' }, f.price ? { value: money.usd(f.price), label: 'price' } : '', `Made ${time.longDate(today)}`],
    }),
    H.block({
      kicker: 'Before the first send',
      title: 'Five minutes of setup',
      body: `${H.checklist(checklist)}${f.notes.length ? `<div class="note notes">${H.esc(f.notes.join(' '))}</div>` : ''}`,
    }),
    H.block({
      kicker: 'The schedule',
      title: 'When each one goes out',
      body: H.table(
        [
          { key: 'n', label: '#', num: true },
          { key: 'day', label: 'Send on' },
          { key: 'title', label: 'Email' },
          { key: 'audience', label: 'Who gets it' },
          { key: 'subject', label: 'Subject' },
        ],
        list.map((e) => ({ n: e.n, day: `${time.shortDate(e.sendOn)}, ${L.clock(e.time)}`, title: e.title, audience: e.audience, subject: e.subject }))
      ),
    }),
    H.block({ kicker: 'The emails', title: 'Ready to copy', sub: 'Read each one out loud once and change any word that does not sound like you.', body: list.map(emailBox).join('\n') }),
  ].join('\n');
  return files.htmlDoc({
    title: `${drop ? 'Drop' : 'Launch'} emails for ${f.short}`,
    description: `${list.length} dated emails for ${f.product}.`,
    css: H.baseCss(t) + extra,
    body: `${body}\n<footer class="foot"><div class="wrap">Written from what you typed: no stock, deadlines or results you didn't give us. Subject lines say what each email is about, as US law (CAN-SPAM) asks. The thank-you asks for an honest review with nothing offered for it.</div></footer>`,
  });
}

module.exports = {
  name: 'shop.launch_emails',
  title: 'Write launch emails',
  description: "Writes the emails for a product launch or drop, from a first look to the buyers' thank-you, each dated back from launch day, as a page to copy from plus a calendar file of send times. Uses only the facts you type.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  timeoutSec: 60,
  input: {
    type: 'object',
    properties: {
      product: { type: 'string', title: 'What you are launching', maxLength: 120 },
      date: { type: 'string', format: 'date', title: 'Launch day' },
      time: { type: 'string', title: 'Time it goes live (optional)', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$', maxLength: 5 },
      price: { type: 'number', minimum: 0, maximum: 100000 },
      link: { type: 'string', maxLength: 300 },
      why: { type: 'string', format: 'textarea', maxLength: 900 },
      details: { type: 'string', format: 'textarea', maxLength: 900 },
      offer: { type: 'string', maxLength: 90 },
      ends: { type: 'string', format: 'date' },
      quantity: { type: 'integer', minimum: 1, maximum: 100000 },
      mode: { type: 'string', enum: ['launch', 'drop'], default: 'launch' },
      calendar: { type: 'boolean', default: true },
    },
    required: ['product'],
  },
  output: {
    type: 'object',
    properties: {
      date: { type: 'string' },
      time: { type: 'string' },
      mode: { type: 'string' },
      emails: { type: 'array' },
      checklist: { type: 'array' },
      notes: { type: 'array' },
      page: { type: 'object' },
      calendar: { type: ['object', 'null'] },
    },
    required: ['date', 'emails', 'page'],
  },

  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const f = L.factsOf(input, br, ctx, { defaultDays: input.mode === 'drop' ? 14 : 7 });
    const list = L.emails(f);
    const checklist = L.sendChecklist(f, list);
    const colors = brandColors(ctx, input);
    const base = text.slug(`${f.short}-${f.mode === 'drop' ? 'drop' : 'launch'}-emails`, 60) || 'launch-emails';
    const page = await save.saveFile(ctx, `${base}.html`, pageHtml({ f, list, checklist, colors, today: f.today }), 'text/html');
    let calendar = null;
    if (input.calendar !== false) {
      const tz = time.tzOf(ctx);
      const events = list.map((e) => ({
        uid: `${text.hash(`${f.name}:${f.product}:${e.key}`)}-${e.sendOn}@127group.io`,
        title: `Send email ${e.n}: ${e.title} (${f.short})`,
        description: `Subject: ${e.subject}\nTo: ${e.audience}\nCopy it from ${page.name}.`,
        date: e.sendOn,
        time: e.time,
        minutes: 15,
        tz,
      }));
      calendar = await save.saveFile(ctx, `${base}.ics`, files.ics(events, { name: `${f.short} emails`, now: time.nowMs(ctx) }), 'text/calendar');
    }
    ctx.log(`Wrote ${text.plural(list.length, 'email')} from ${time.shortDate(list[0].sendOn)} to ${time.shortDate(list[list.length - 1].sendOn)}.`);
    return {
      date: f.date,
      time: f.time,
      mode: f.mode,
      emails: list.map((e) => ({ n: e.n, key: e.key, title: e.title, send_on: e.sendOn, time: e.time, audience: e.audience, subject: e.subject, preview: e.preview, body: e.body })),
      checklist,
      notes: f.notes,
      page,
      calendar,
    };
  },

  view(out) {
    const first = out.emails[0];
    const last = out.emails[out.emails.length - 1];
    return views.blocks(
      views.metric(out.mode === 'drop' ? 'Drop emails' : 'Launch emails', out.emails.length, `${time.shortDate(first.send_on)} to ${time.shortDate(last.send_on)}`),
      (out.notes || []).map((n) => views.text(n)),
      views.file(out.page, 'All the emails with the send schedule'),
      views.file(out.calendar, 'Send dates for your calendar'),
      views.table(
        [
          { key: 'n', label: '#', format: 'number' },
          { key: 'send_on', label: 'Send on' },
          { key: 'title', label: 'Email' },
          { key: 'subject', label: 'Subject' },
        ],
        out.emails
      ),
      out.emails.map((e) => views.copy(`Email ${e.n}: ${e.title}`, e.body, { subject: e.subject })),
      views.text('Your email tool adds your mailing address and the unsubscribe link from its settings. Check both are filled in before the first send.')
    );
  },
};
