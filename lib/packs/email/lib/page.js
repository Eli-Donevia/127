// The email kit page: every email as copy blocks (subject, preview, body), the send schedule, how
// to paste it into the member's email tool, and the rules that keep emails out of spam. One
// self-contained HTML file in the member's colors. No scripts, prints on Letter paper.

const { files, time } = require('../../_kit');
const rules = require('../data/rules.json');
const platforms = require('../data/platforms.json');
const { platformOf, greeting } = require('./html');

const esc = files.esc;

function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function css(p) {
  return `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root{--primary:${p.primary};--on:${p.onPrimary};--ink:${p.ink};--paper:${p.paper};--surface:${p.surface};--muted:${p.muted};--line:${p.line};--deep:${p.deep}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:0 32px}
.hero{background:radial-gradient(900px 400px at 85% -10%,${rgba(p.primary, 0.55)},transparent 60%),radial-gradient(700px 380px at 0% 120%,${rgba(p.accent || p.primary, 0.35)},transparent 60%),var(--deep);color:#fff;padding:72px 0 60px}
.kicker{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.8}
h1{font-size:56px;line-height:1.02;letter-spacing:-.03em;margin:14px 0 16px;font-weight:800;max-width:760px}
.lede{font-size:20px;max-width:640px;opacity:.88;margin:0}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.chip{border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600}
section{padding:56px 0 8px}
.sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:20px}
.sec-num{font-size:14px;font-weight:800;color:var(--primary)}
h2{font-size:34px;letter-spacing:-.02em;margin:0;line-height:1.1}
h3{font-size:21px;margin:0 0 4px;letter-spacing:-.01em}
.muted{color:var(--muted)}
.mail{background:#fff;border:1px solid var(--line);border-radius:24px;padding:28px;margin-bottom:18px;break-inside:avoid}
.mail-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}
.n{flex:none;width:44px;height:44px;border-radius:14px;background:var(--primary);color:var(--on);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
.when{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--primary)}
.label{display:flex;justify-content:space-between;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
.label span:last-child{letter-spacing:0;text-transform:none;font-weight:600}
.over{color:#b42318}
.box{background:var(--surface);border-radius:14px;padding:12px 16px;white-space:pre-wrap;user-select:all;-webkit-user-select:all;cursor:copy}
.box.subject{font-weight:700;font-size:18px}
.box.body{font-size:16px;line-height:1.65;padding:18px 20px}
.btn{display:inline-block;margin-top:12px;background:var(--primary);color:var(--on);border-radius:999px;padding:10px 20px;font-weight:700;font-size:15px}
.url{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all;color:var(--muted);margin-top:8px}
.tw{width:100%;overflow-x:auto;border-radius:18px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;font-size:15px}
th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--surface);font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.steps{counter-reset:s;list-style:none;padding:0;margin:0}
.steps li{position:relative;padding:0 0 14px 46px}
.steps li:before{counter-increment:s;content:counter(s);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:10px;background:var(--surface);color:var(--primary);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;margin-bottom:14px;break-inside:avoid}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.tip{border-left:4px solid var(--primary);padding:4px 0 4px 16px;margin:16px 0}
code,.tag{font:14px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--surface);border-radius:8px;padding:2px 8px;word-break:break-all}
details{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 20px;margin-bottom:10px}
summary{font-weight:700;cursor:pointer}
.sources{font-size:13px;color:var(--muted);word-break:break-word}
footer{padding:48px 0 64px}
@media (max-width:820px){.wrap{padding:0 16px}h1{font-size:38px}.hero{padding:48px 0 40px}.mail{padding:20px}.grid2{grid-template-columns:1fr}h2{font-size:28px}th,td{padding:10px 8px;font-size:14px}}
@media print{@page{size:Letter;margin:14mm}body{background:#fff;font-size:12pt}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:28px 0}section{padding:22px 0 0}.wrap{max-width:none;padding:0}details{display:block}}
`;
}

function scheduleRows(emails, kind) {
  return emails
    .map((e) => `<tr><td><b>${e.n}</b></td><td>${esc(e.date ? `${time.longDate(e.date)}, ${e.time}` : e.when)}</td><td>${esc(e.subject)}</td><td class="muted">${esc(e.button || 'No button')}</td></tr>`)
    .join('');
}

// d: { kind, label, emails, p, facts, platform, today, headline, lede, span, minutes,
//      mode?: 'sequence' | 'broadcast' | 'cart', who?: [lines], files?: { csv, html: 'each' | 'one' | false, txt, ics, template } }
function buildPage(d) {
  const { emails, p, facts, platform } = d;
  const plat = platformOf(platform);
  const mode = d.mode || (d.kind === 'launch' ? 'broadcast' : d.kind === 'cart' && plat && plat.steps.cart ? 'cart' : 'sequence');
  const made = d.files || { csv: true, html: 'each', txt: true, ics: d.kind === 'launch' };
  const dated = emails.some((e) => e.date);
  let num = 0;
  const sec = (title, inner) => `<section><div class="wrap"><div class="sec-head"><span class="sec-num">${String(++num).padStart(2, '0')}</span><h2>${title}</h2></div>${inner}</div></section>`;
  const hero = `<header class="hero"><div class="wrap"><div class="kicker">${esc(d.label)} for ${esc(facts.business)}</div><h1>${esc(d.headline)}</h1><p class="lede">${esc(d.lede)}</p><div class="chips"><span class="chip">${emails.length} ${emails.length === 1 ? 'email' : 'emails'}</span><span class="chip">${esc(d.span)}</span><span class="chip">${esc(plat ? plat.name : 'Any email tool')}</span><span class="chip">Setup about ${d.minutes} minutes</span></div></div></header>`;
  const schedNote = dated ? `Times are ${facts.timezone.replace(/_/g, ' ')} time.${made.csv ? ' The CSV has the same schedule' : ''}${made.ics ? ', and the calendar file puts each send on your calendar' : ''}${made.csv || made.ics ? '.' : ''}` : made.csv ? 'The CSV in your Library has the same schedule, one row per email.' : '';
  const sched = sec(
    'When each one goes out',
    `<div class="tw"><table><thead><tr><th>#</th><th>Send</th><th>Subject</th><th>Button</th></tr></thead><tbody>${scheduleRows(emails, d.kind)}</tbody></table></div>${schedNote ? `<p class="muted">${esc(schedNote)}</p>` : ''}`
  );
  const mails = emails
    .map((e) => {
      const body = greeting(e.body, platform);
      const prevMax = plat && plat.previewMax ? plat.previewMax : 150;
      return `<div class="mail"><div class="mail-top"><div><div class="when">${esc(e.date ? `${time.longDate(e.date)}, ${e.time}` : e.when)}</div><h3>${esc(e.subject)}</h3></div><div class="n">${e.n}</div></div>
<div class="label"><span>Subject</span><span class="${e.subject.length > 60 ? 'over' : ''}">${e.subject.length} characters</span></div><div class="box subject">${esc(e.subject)}</div>
<div class="label"><span>Preview text</span><span class="${e.preview.length > prevMax ? 'over' : ''}">${e.preview.length} / ${prevMax}</span></div><div class="box">${esc(e.preview)}</div>
<div class="label"><span>Body</span><span>${body.split(/\s+/).length} words</span></div><div class="box body">${esc(body)}</div>
${e.button ? `<div class="label"><span>Button</span><span></span></div><span class="btn">${esc(e.button)}</span>${e.link ? `<div class="url">${esc(e.link)}</div>` : ''}` : ''}</div>`;
    })
    .join('\n');
  const mailsSec = sec(emails.length === 1 ? 'The email' : 'The emails', `<p class="muted">Click a box once to select it all, then copy. Fill anything in [brackets] with your real details before you send.</p>${mails}`);
  const whoSec = d.who && d.who.length ? sec('Who gets these', `<div class="card"><ol class="steps">${d.who.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`) : '';
  // Steps only name files this run made: no HTML file to paste, no CSV to schedule from.
  const fit = (s) => {
    let t = s;
    if (!made.html) t = t.replace(/,? or use Code your own and paste the HTML file/i, '');
    if (!made.csv) t = t.replace(/ for the date and time in the CSV/i, ' for the day and time you want').replace(/ from the Send day column/i, '');
    return t;
  };
  const steps = (plat ? plat.steps[mode] || plat.steps.sequence : ['Make one email per row in the CSV, paste the subject, preview text and body.', 'Set each send from the Send column.', 'Add your unsubscribe link and mailing address to the footer. Most email tools add them for you.', 'Send yourself a test of every email.']).map(fit);
  const others = platforms.list
    .filter((x) => x.id !== platform)
    .map((x) => `<details><summary>${esc(x.name)}</summary><p>${esc(x.free)}</p><ol class="steps">${(x.steps[mode] || x.steps.sequence).map((s) => `<li>${esc(fit(s))}</li>`).join('')}</ol></details>`)
    .join('');
  const setup = sec(
    `Put it in ${esc(plat ? plat.name : 'your email tool')}`,
    `<div class="card"><ol class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
${made.template && plat && plat.steps.template && plat.steps.template.length ? `<p class="tip">${esc(plat.steps.template[0])}</p>` : ''}
${plat ? `<p class="muted">${esc(plat.free)} ${esc(plat.tagNotes || '')}</p>` : ''}
${d.kind === 'cart' ? `<p class="tip">${esc(platforms.shopify.cart)} Use one or the other, not both, so nobody gets two reminders.</p>` : ''}</div>
<h3 style="margin:26px 0 12px">Using a different tool?</h3>${others}`
  );
  const r = rules.canSpam;
  const law = sec(
    'Rules every email follows',
    `<div class="grid2">${r.rules.map((x) => `<div class="card"><h3>${esc(x.rule)}</h3><p class="muted" style="margin:6px 0 0">${esc(x.detail)}</p></div>`).join('')}
<div class="card"><h3>Gmail inboxes</h3><p class="muted" style="margin:6px 0 0">${esc(rules.gmail.allSenders.join(' '))} If you ever send ${esc(rules.gmail.bulkSenders.threshold)}: ${esc(rules.gmail.bulkSenders.rules.join('; '))}.</p></div></div>
<p class="muted">${esc(r.penalty)}</p>`
  );
  const list = [
    made.csv ? `<li><b>CSV</b>: every email with its send ${dated ? 'date and time' : 'delay'}, subject, preview text, body and button. Opens in Sheets or Excel.</li>` : '',
    made.html === 'each' ? `<li><b>HTML emails</b>: one designed email per send, in your colors, with ${esc(plat ? plat.name : 'placeholder')} unsubscribe and address tags already in the footer.</li>` : '',
    made.html === 'one' ? `<li><b>HTML email</b>: the email designed in your colors, with ${esc(plat ? plat.name : 'placeholder')} unsubscribe and address tags already in the footer.</li>` : '',
    made.template ? `<li><b>Kit template</b>: the same design around Kit's ${esc('{{ message_content }}')} tag, with the unsubscribe link and address tag. Paste it once, and every email you write in Kit comes out in your colors.</li>` : '',
    made.txt ? '<li><b>Plain text</b>: all of them, for tools where you paste text.</li>' : '',
    made.ics ? '<li><b>Calendar</b>: each send on your calendar (inside the zip file).</li>' : '',
  ].join('\n');
  const filesList = list.trim() ? sec('Your files', `<div class="card"><ul>\n<li><b>This page</b>: every email to copy, the schedule and the setup steps.</li>\n${list}</ul></div>`) : '';
  const foot = `<footer><div class="wrap"><p class="muted">Made ${esc(time.longDate(d.today))}. Facts checked ${esc(time.longDate(rules.checked))}. Email tools change their menus often: if a name differs, look for the closest match.</p><ul class="sources"><li>${esc(r.source)}</li><li>${esc(rules.gmail.source)}</li>${platforms.list.map((x) => `<li>${esc(x.freeSource)}</li>`).join('')}${d.kind === 'cart' ? `<li>${esc(platforms.shopify.source)}</li>` : ''}</ul></div></footer>`;
  const body = `${hero}${sched}${mailsSec}${whoSec}${setup}${law}${filesList}${foot}`;
  return files.htmlDoc({ title: `${facts.business} ${d.label}`, css: css(p), body });
}

module.exports = { buildPage, css };
