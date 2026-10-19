// The one-page monthly report for a reviews client, from numbers the member reads off the client's
// own Business Profile on the same day each month. Plain counts only: no money estimates. Ends with
// the email to send and a testimonial and referral ask, sent whatever the month looked like.

const kit = require('../../_kit');
const { text, views, save, brain, time, files } = kit;
const { colorsFor } = require('../lib/cardkit');

const esc = files.esc;
const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));

function reportHtml({ client, month, metrics, wins, fixes, next, member, checked }) {
  const p = colorsFor(client, null);
  const css = `@page{size:Letter;margin:0.5in}*{box-sizing:border-box}body{margin:0;background:${p.paper};color:${p.ink};font:15px/1.45 Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}main{max-width:780px;margin:0 auto;padding:24px 16px 40px}header{border-bottom:4px solid ${p.primary};padding-bottom:10px;margin-bottom:14px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:22px 0 8px;color:${p.primary}}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.m{background:${p.surface};border-radius:12px;padding:12px}.m b{display:block;font-size:30px;line-height:1.1}.m span{font-size:13px;color:${p.muted}}ul{padding-left:20px}.muted{color:${p.muted};font-size:12.5px}`;
  const body = `<main><header><p class="muted">Monthly reviews report</p><h1>${esc(client)}: ${esc(month)}</h1></header>
<div class="grid">${metrics.map((m) => `<div class="m"><span>${esc(m.label)}</span><b>${esc(m.value)}</b><span>${esc(m.note || '')}</span></div>`).join('')}</div>
${wins.length ? `<h2>Wins</h2><ul>${wins.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
${fixes.length ? `<h2>What I did this month</h2><ul>${fixes.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
<h2>Next month</h2><ul>${next.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
<p class="muted">Counts read from your Google Business Profile on ${esc(checked)}${member.name ? ` by ${esc(member.name)}` : ''}. Every customer is asked the same way; nothing is offered for a review.${member.contact ? ` ${esc(member.contact)}` : ''}</p></main>`;
  return files.htmlDoc({ title: `${client} reviews report, ${month}`, description: 'Monthly reviews report', css, body });
}

module.exports = {
  name: 'reviews.monthly_report',
  title: 'Monthly reviews report',
  description: 'Turns the month\'s counts from your client\'s Business Profile into a one-page report, the email to send it with, and a testimonial and referral ask.',
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
      startCount: { type: 'number', minimum: 0 },
      endCount: { type: 'number', minimum: 0 },
      replied: { type: 'number', minimum: 0 },
      stars: { type: 'number', minimum: 1, maximum: 5 },
      cards: { type: 'number', minimum: 0 },
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
    const client = text.plain(input.client);
    const start = n(input.startCount);
    const end = n(input.endCount);
    const fresh = start != null && end != null ? Math.max(0, end - start) : null;
    const replied = n(input.replied);
    const stars = Number.isFinite(Number(input.stars)) && input.stars !== '' && input.stars != null ? Math.round(Number(input.stars) * 10) / 10 : null;
    const cards = n(input.cards);
    const metrics = [];
    if (fresh != null) metrics.push({ label: 'New reviews this month', value: String(fresh), note: `${start} to ${end}` });
    if (replied != null) metrics.push({ label: 'Reviews replied to', value: String(replied), note: fresh ? `of ${fresh} new` : '' });
    if (end != null) metrics.push({ label: 'Reviews in total', value: String(end), note: 'On your Google listing' });
    if (stars != null) metrics.push({ label: 'Stars today', value: String(stars), note: 'On your Google listing' });
    if (cards != null) metrics.push({ label: 'Cards handed out', value: String(cards), note: 'Counter and handout cards' });
    const wins = [];
    if (fresh) wins.push(`${fresh} new ${fresh === 1 ? 'review' : 'reviews'} this month.`);
    if (fresh && replied != null && replied >= fresh) wins.push('Every new review got a reply.');
    const lines = (s) => String(s || '').split(/\n|;/).map((x) => text.plain(x.trim())).filter(Boolean);
    const fixes = lines(input.fixes);
    const next = lines(input.next);
    if (!next.length) next.push('Keep asking every customer the same way, at the counter and on the receipt.', 'Put fresh cards out before they run low.', 'Reply to every new review within a day.');
    const member = { name: text.plain(input.myName || br.firstName || ''), contact: text.plain(input.myContact || '') };
    const report = await save.saveFile(ctx, save.fileName(client, 'reviews-report', month, '.html'), reportHtml({ client, month, metrics, wins, fixes, next, member, checked: today }));
    const hi = text.plain(input.ownerFirst || `${client} team`);
    const email = {
      subject: `Your reviews report for ${month}`,
      body: [
        `Hi ${hi},`,
        '',
        `Here's your one-page report for ${month}.${metrics.length ? ` ${metrics.slice(0, 3).map((m) => `${m.label}: ${m.value}`).join('. ')}.` : ''}`,
        fixes.length ? `This month I also ${fixes[0].charAt(0).toLowerCase()}${fixes[0].slice(1).replace(/\.$/, '')}.` : '',
        '',
        'Anything you want changed on the cards or in the replies? Just reply.',
        '',
        member.name || '[your name]',
      ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n'),
    };
    const ask = text.plain(`Quick favor, ${hi}: would you write two or three honest sentences about working with me so far? I'd like to share it, with your name only if you say yes. And if you know another shop owner who'd like more reviews, I'd be grateful for an introduction.`);
    return { client, month, metrics, wins, fixes, next, report, email, ask };
  },
  view(out) {
    return views.blocks(
      ...out.metrics.slice(0, 4).map((m) => views.metric(m.label, m.value, m.note)),
      views.file(out.report, `Report for ${out.client}, ${out.month}`),
      views.copy('Email to send with the report', `Subject: ${out.email.subject}\n\n${out.email.body}`),
      views.copy('Testimonial and referral ask (send it whatever the month looked like)', out.ask),
    );
  },
};
