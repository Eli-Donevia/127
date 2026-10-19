// Proposals: three options with the most complete first, what the prospect told the member, what the
// member noticed on their site (dated), where they want to be, how it works, what's not included,
// the member's promise (only one they made), and a block to accept. Printable HTML, no scripts.

const { text, time } = require('../../_kit');
const docs = require('./docs');
const items = require('./items');
const { mixed } = require('./options');
const { noteLines } = require('./prospect');

const esc = docs.esc;

function firstOf(name) {
  return text.firstName(name).replace(/[^A-Za-z'-]/g, '');
}

// "You want online booking." from "They want online booking" or "Ana wants online booking".
// Only lines that start with the prospect as the subject are turned around; the rest stay as typed.
const BASE = { wants: 'want', needs: 'need', says: 'say', likes: 'like', has: 'have', is: 'are', was: 'were', does: 'do', runs: 'run', hates: 'hate', thinks: 'think', feels: 'feel', uses: 'use', sells: 'sell', gets: 'get', loves: 'love', worries: 'worry', plans: 'plan', tried: 'tried', said: 'said', asked: 'asked', mentioned: 'mentioned', wanted: 'wanted', needed: 'needed', told: 'told' };
function toYou(line, first = '') {
  const t = text.oneLine(line).replace(/[.!]+$/, '');
  const subj = first ? `(?:they|she|he|${first.replace(/[^A-Za-z'-]/g, '')})` : '(?:they|she|he)';
  const m = t.match(new RegExp(`^${subj}\\s+([A-Za-z']+)\\b(.*)$`, 'i'));
  if (m) {
    const verb = m[1].toLowerCase();
    const base = BASE[verb] || (/^(are|have|want|need|like|do|run|use|sell|get|love|plan|think|feel|hate|worry)$/.test(verb) ? verb : null);
    if (base) {
      const rest = m[2].replace(/\b(themselves|herself|himself)\b/gi, 'yourself');
      return `${text.sentenceCase(`you ${base}${rest}`)}.`;
    }
  }
  const lead = t.match(/^(wants?|needs?|would like|asked for|is looking for|looking for)\b(.*)$/i);
  if (lead) {
    const v = lead[1].toLowerCase().replace(/^wants$/, 'want').replace(/^needs$/, 'need').replace(/^is looking for$/, 'are looking for').replace(/^looking for$/, 'are looking for');
    return `${text.sentenceCase(`you ${v}${lead[2]}`)}.`;
  }
  return `${text.sentenceCase(t)}.`;
}

// The draft content when AI is off (and the facts AI must stay inside when it's on).
function draft({ f, prospect, input, opts }) {
  const p = f.profile;
  const name = text.clip(input.name || (prospect && prospect.name) || '', 80);
  const company = text.clip(input.company || '', 80);
  const who = company || name || 'you';
  const notes = prospect && prospect.notes && prospect.notes.length ? prospect.notes : noteLines(input.notes);
  const heard = notes.slice(0, 5).map((l) => toYou(l, firstOf(name)));
  const noticed = (prospect && prospect.relevant ? prospect.relevant : []).slice(0, 4).map((g) => g.label);
  const goals = String(input.goals || '')
    .split(/\n+|;\s*/)
    .map((x) => text.oneLine(x))
    .filter(Boolean)
    .slice(0, 4);
  const want = goals.length ? goals.map((g) => text.sentenceCase(g.replace(/\.$/, ''))) : (p.want || []).slice(0, 3).map((w) => text.sentenceCase(w));
  // The niche's picture of the finished job, only when the member gave no goals of their own.
  const vision = goals.length ? '' : (p.vacation || [])[0] || '';
  const summaries = {
    best: `Everything, so it keeps running after the first ${f.job || 'job'}.`,
    better: 'The most for the money. What most people need to get it done right.',
    good: `The essentials, done right. A good first step.`,
  };
  if (f.b2b) {
    summaries.best = 'The full setup plus ongoing support, so it keeps working.';
    summaries.better = 'Everything you need to get it done right the first time.';
    summaries.good = 'A focused first step you can build on.';
  }
  return {
    title: text.clip(input.title || `A plan for ${who}`, 100),
    heard,
    noticed,
    want,
    vision,
    summaries: opts.map((o) => o.summary || summaries[o.key] || ''),
    who,
    name,
    company,
  };
}

function optionCard(o, f, idx) {
  const rec = o.recommended;
  const top = idx === 0;
  const plus = o.plus && o.plus.extra.length ? `<div class="plus">Everything in ${esc(o.plus.of)}, plus:</div>${docs.list(o.plus.extra)}` : docs.list(o.includes);
  return `<div class="opt${rec ? ' rec' : ''}${top ? ' first' : ''}">
  <div class="opt-head">${rec ? '<span class="chip">Recommended</span>' : top ? '<span class="chip soft">Most complete</span>' : '<span class="chip ghost">&nbsp;</span>'}<div class="opt-name">${esc(o.name)}</div></div>
  <div class="opt-price">${esc(o.priceText)}<span>${esc(o.per)}</span></div>
  ${o.summary ? `<p class="opt-sum">${esc(o.summary)}</p>` : ''}
  ${plus}
</div>`;
}

const CSS = `
.cover{margin:30px 0 8px}
.cover h1{font:600 34px/1.15 ${docs.SERIF};margin:12px 0 10px;letter-spacing:-.01em}
.cover .lead{margin:0 0 16px;color:var(--muted)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.two > div{border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.two h2,.section > h2{font:700 11px/1 ${docs.SANS};letter-spacing:.12em;text-transform:uppercase;color:var(--brand-ink);margin:0 0 12px}
.vision{border-left:4px solid var(--brand);padding:4px 0 4px 18px;margin:0 0 12px}
.opts{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:stretch}
.opts.n2{grid-template-columns:repeat(2,1fr)}
.opts.n1{grid-template-columns:1fr}
.opt{position:relative;border:1px solid var(--line);border-radius:14px;padding:16px 16px 14px;background:#fff;break-inside:avoid}
.opt.first{background:var(--brand-softer)}
.opt.rec{border:2px solid var(--brand);box-shadow:0 10px 28px rgba(0,0,0,.08)}
.opt-head{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.chip.ghost{visibility:hidden}
.opt-name{font:600 19px/1.2 ${docs.SERIF};color:var(--ink)}
.opt-price{font:700 28px/1.1 ${docs.SANS};margin:10px 0 2px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.opt-price span{display:block;font:500 12px/1.4 ${docs.SANS};color:var(--muted);letter-spacing:0;margin-top:3px}
.opt-sum{font-size:13px;color:var(--muted);margin:8px 0 12px;min-height:38px}
.plus{font-size:12.5px;font-weight:600;margin:0 0 6px}
.opt ul.ticks li{font-size:13px}
.pick{display:grid;grid-template-columns:repeat(3,auto);justify-content:start;gap:10px 28px;margin:6px 0 4px}
.pick label{font-weight:600}
@media (max-width:680px){
  .cover h1{font-size:27px}
  .two,.opts,.opts.n2{grid-template-columns:1fr}
  .pick{grid-template-columns:1fr}
}
@media print{
  .cover{margin:14px 0 4px}
  .cover h1{font-size:21pt;margin:6px 0 6px}
  .two{gap:10px}
  .two > div{padding:10px 12px}
  .opts{gap:8px}
  .opt{padding:10px 10px 8px}
  .opt.rec{box-shadow:none}
  .opt-name{font-size:12.5pt}
  .opt-price{font-size:17pt;margin-top:6px}
  .opt-sum{font-size:8.5pt;min-height:0;margin:4px 0 6px}
  .opt ul.ticks li{font-size:8.5pt;padding-bottom:2px}
  .vision{margin-bottom:6px}
}
`;

function html({ f, d, c, opts, prospect }) {
  const m = (cents) => items.money(cents, f.currency, { short: true });
  const depositRate = d.depositRate;
  const metas = [
    ['Proposal no.', d.number],
    ['Date', time.shortDate(d.date)],
    ['Good until', time.shortDate(d.validUntil)],
    ['Prepared by', f.firstName && f.hasName ? `${f.firstName}, ${f.displayName}` : f.displayName],
  ];
  const forLine = [c.name, c.company].filter(Boolean).join(', ');
  const noticedNote = prospect && prospect.reachable && c.noticed.length ? `<p class="note">From ${esc(prospect.domain)}, read on ${esc(time.longDate(prospect.readOn))}.</p>` : '';
  const blocksTwo = [];
  if (c.heard.length) blocksTwo.push(`<div><h2>What you told me</h2>${docs.list(c.heard)}</div>`);
  if (c.noticed.length) blocksTwo.push(`<div><h2>What I noticed</h2>${docs.list(c.noticed, 'crosses')}${noticedNote}</div>`);
  const optsHtml = `<div class="opts n${opts.length}">${opts.map((o, i) => optionCard({ ...o, summary: c.summaries[i] || o.summary }, f, i)).join('')}</div>`;
  const firstPrice = opts[0] ? `${opts[0].name} at ${opts[0].priceText}` : '';
  const timeline = (f.profile.timeline || []).slice(0, 5);
  const next = [
    `Pick the option that fits${c.name ? `, ${firstOf(c.name) || c.name}` : ''}. Tick it below, or just reply with its name.`,
    depositRate >= 1 ? 'Pay when you book to lock in your start date.' : depositRate ? `Pay the ${items.pctText(depositRate)} deposit to lock in your start date.` : { booking: 'Pay when you book to lock in your start date.', monthly: 'Pay the first month to lock in your start date.' }[f.payWhen] || 'Pick a start date that works for you.',
    `I confirm everything in writing and we get started.`,
  ];
  const terms = [
    `This proposal is good until ${time.longDate(d.validUntil)}.`,
    depositRate >= 1 ? (f.payWhen === 'monthly' ? 'Each month is paid in full before it starts.' : 'Payment in full starts the work.') : depositRate ? `A ${items.pctText(depositRate)} deposit starts the work. The rest is due when it's done.` : { booking: 'Payment is due when you book.', monthly: 'Payment is due at the start of each month, before that month’s work.' }[f.payWhen] || 'Payment is due when the work is done.',
    'Anything not listed in your option is quoted before I start.',
    ...String(f.terms || '')
      .split(/\n+|(?<=\.)\s+(?=[A-Z])/)
      .map((x) => text.oneLine(x))
      .filter(Boolean)
      .slice(0, 6),
  ];
  const pay = f.payLink || f.payNote ? `<div class="box tinted"><div class="pay"><div><h3>${depositRate && depositRate < 1 ? 'Pay the deposit' : 'How to pay'}</h3>${f.payLink ? `<a class="btn" href="${esc(f.payLink)}">Pay online</a><div class="link">${esc(f.payLink.replace(/^https:\/\//, ''))}</div>` : ''}${f.payNote ? `<p class="paynote">${f.payLink ? '<b>Other ways to pay:</b> ' : ''}${esc(docs.text1(f.payNote))}</p>` : ''}</div>${f.payLink ? `<div class="qr">${docs.qrFor(f.payLink, f.palette)}<div class="cap">Scan to pay</div></div>` : ''}</div></div>` : '';
  const body = `<main class="sheet">
${docs.header(f)}
<section class="cover">
  <span class="kicker">Proposal</span>
  <h1>${esc(c.title)}</h1>
  ${forLine ? `<p class="lead">Prepared for ${esc(forLine)}</p>` : ''}
  <dl class="meta">${metas.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
</section>
${blocksTwo.length ? `<section class="section${blocksTwo.length === 2 ? ' two' : ''}">${blocksTwo.length === 2 ? blocksTwo.join('') : blocksTwo[0].replace(/^<div>/, '<div class="box">')}</section>` : ''}
${c.vision || c.want.length ? `<section class="section"><h2>Where you want to be</h2>${c.vision ? `<p class="lead vision">${esc(c.vision)}</p>` : ''}${docs.list(c.want)}</section>` : ''}
<section class="section"><h2>Your options</h2>${optsHtml}<p class="note" style="margin-top:10px">${esc(`${mixed(opts) ? 'Each option says how it is paid' : `Prices are ${opts[0] ? opts[0].per : 'per job'}`}${f.taxRate ? `, plus ${items.pctText(f.taxRate)} sales tax` : ''}.`)}</p></section>
${timeline.length ? `<section class="section"><h2>How it works</h2>${docs.steps(timeline)}</section>` : ''}
${(() => {
  const not = `<div><h2>Not included</h2>${docs.list((f.profile.notIncluded || []).slice(0, 4), 'crosses')}</div>`;
  const how = f.profile.difference ? text.sentenceCase(`${f.profile.difference}.`) : '';
  const side = f.promise
    ? `<div><h2>My promise</h2><p>${esc(text.sentenceCase(f.promise))}</p>${how ? `<p class="muted">${esc(`${f.b2b ? 'How I work: ' : 'What makes this different: '}${how}`)}</p>` : ''}</div>`
    : how
      ? `<div><h2>${f.b2b ? 'How I work' : 'What makes this different'}</h2><p>${esc(how)}</p></div>`
      : '';
  return side ? `<section class="section two">\n  ${not}\n  ${side}\n</section>` : `<section class="section">${not.replace(/^<div>|<\/div>$/g, '')}</section>`;
})()}
<section class="section"><h2>Ready to start?</h2>
  <div class="boxes" style="margin-top:0">
    <div class="box"><h3>Next steps</h3>${docs.steps(next)}</div>
    ${pay || `<div class="box"><h3>Questions</h3><p>${esc(f.phone ? `Call or text me at ${f.phone}.` : f.email ? `Email me at ${f.email}.` : 'Reply to the message this came with.')}</p></div>`}
    <div class="box full"><h3>I choose</h3><div class="pick">${opts.map((o) => `<label><span class="check"></span>${esc(o.name)}, ${esc(o.priceText)}</label>`).join('')}</div><div class="sign"><div>Signature</div><div>Date</div></div></div>
  </div>
</section>
<section class="section"><h2>Terms</h2><ul class="terms">${terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
<footer class="foot"><div>${esc(firstPrice ? `Thank you${c.name ? `, ${firstOf(c.name) || c.name}` : ''}. I'd love to work on this with you.` : 'Thank you.')}</div><div>${esc(f.phone ? `Call or text ${f.phone}` : f.email || '')}</div></footer>
</main>`;
  return docs.doc({ title: `Proposal ${d.number} for ${c.who}, ${f.displayName}`, description: `Proposal from ${f.displayName}`, css: CSS, body, pal: f.palette, paper: f.paper });
}

// The cover email and a short text.
function messages({ f, d, c, opts }) {
  const first = firstOf(c.name);
  const hi = first ? `Hi ${first},` : 'Hi,';
  const sign = f.signOff || f.displayName;
  const list = opts.map((o) => `${o.name}: ${o.priceText} ${o.per}`.trim()).join('\n');
  const subject = `Proposal: ${c.title}`;
  const n = opts.length;
  const ranked = n > 1 && !mixed(opts);
  const rec = n === 3 ? opts.find((o) => o.recommended) || opts[1] : null;
  const email = [
    hi,
    '',
    n > 1 ? `Thanks for your time. Here's the proposal we talked about, with ${n === 2 ? 'two' : 'three'} ways to do it:` : "Thanks for your time. Here's the proposal we talked about:",
    '',
    list,
    '',
    rec ? `I'd suggest ${rec.name}${ranked && rec !== opts[0] ? `, and ${opts[0].name} is there if you want the most complete one` : ''}.` : '',
    `It's good until ${time.longDate(d.validUntil)}. Reply with the option you want and I'll send the next step.`,
    '',
    f.phone ? `Happy to walk through it on a quick call: ${f.phone}.` : 'Happy to walk through it on a quick call.',
    '',
    sign,
  ]
    .filter((x, i, a) => !(x === '' && a[i - 1] === ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  const sms = `${hi.replace(/,$/, '')}, it's ${f.firstName || f.displayName}. I just emailed your proposal${n > 1 ? ` with ${n === 2 ? 'two' : 'three'} options${ranked ? `, starting at ${opts[n - 1].priceText}` : ''}` : ''}. Want to go over it for 10 minutes this week?`;
  return { subject, email, text: sms };
}

module.exports = { draft, html, messages, toYou, CSS };
