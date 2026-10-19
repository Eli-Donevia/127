// An operations manual from the member's own notes: each job turned into numbered steps, how the
// business sounds (the brand voice), a normal week, the rules (or the decisions still to make), the
// tools, who to call and what to do when something goes wrong. Only the jobs, rules, tools and
// contacts the member typed are presented as theirs; everything else is labeled a starting point.

const { text, files } = require('../../_kit');
const L = require('./logos');

const esc = files.esc;

// ---------- reading the notes ----------

// "Name: notes" starts a job; lines after it without a name of their own add to its notes.
function jobsFrom(raw, max = 8) {
  const jobs = [];
  for (const line of String(raw || '').replace(/\r/g, '').split('\n')) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(/^(?:[-*\u2022]\s*|\d+[.)]\s*)?([A-Za-z0-9][^:.!?]{1,48}):\s*(.*)$/);
    if (m && m[1].split(/\s+/).length <= 6) jobs.push({ name: text.sentenceCase(text.oneLine(m[1])), notes: m[2] });
    else if (jobs.length) jobs[jobs.length - 1].notes += ` ${l}`;
    else jobs.push({ name: 'Main job', notes: l });
  }
  return jobs.slice(0, max).map((j) => ({ ...j, notes: text.oneLine(j.notes) }));
}

// Voice-note filler, dropped before the notes are split.
const FILLER = /\b(?:um+|uh+|erm|you know|basically|kind of|sort of|i guess|i mean|okay so|ok so|so yeah|yeah|alright so|right so)\b[,]?\s*/gi;
const TIME = /\b(?:(?:it\s+)?(?:usually\s+|normally\s+)?takes?\s+(?:me\s+|us\s+)?(?:about\s+|around\s+|roughly\s+)?|(?:usually\s+|normally\s+)?(?:about|around|roughly)\s+)(\d+(?:\.\d+)?(?:\s*(?:to|or)\s*\d+(?:\.\d+)?)?|an?|one|two|three|four|five|six|half an?)\s*(hours?|hrs?|minutes?|mins?)\b/i;

// "It takes about 3 hours." -> { time: 'About 3 hours', notes without that sentence }
function timeOf(notes) {
  const raw = String(notes || '');
  // Only a sentence that just gives the time counts ("takes 3 hours if it's dirty" stays a note).
  const parts = raw.split(/(?<=[.!?])\s+/);
  const timeOnly = (p) => TIME.test(p) && p.replace(TIME, '').trim().split(/\s+/).filter((w) => w.length > 2 && !/^(about|around|roughly|usually|normally|or so|so)$/i.test(w)).length <= 2;
  const hit = parts.find(timeOnly);
  const m = hit && hit.match(TIME);
  if (!m) return { time: '', notes: raw };
  const unit = /^h/i.test(m[2]) ? 'hour' : 'minute';
  const n = m[1].toLowerCase();
  const one = /^(an?|one|1)$/.test(n);
  const time = /^half/.test(n) ? 'About half an hour' : `About ${one ? (unit === 'hour' ? 'an' : 'a') : n.replace(/\s+/g, ' ')} ${unit}${one ? '' : 's'}`;
  return { time, notes: parts.filter((p) => p !== hit).join(' ') };
}

const JOIN = /\s*(?:[.;!?]+\s+|[.;!?]+$|\n|,?\s+and then\s+|,?\s+then\s+|,?\s+after that,?\s+|,?\s+afterwards,?\s+|,?\s+once that'?s done,?\s+|,?\s+finally,?\s+|,?\s+last(?:ly)?,?\s+|,?\s+next,?\s+)/i;
const LEAD = /^(?:and|so|but|also|first|then|next|after that|afterwards|finally|lastly|last|once that'?s done)\b[,]?\s*/i;
const WHO = /^(?:i|we|you)(?:'ll|'d)?\s+(?:always\s+|usually\s+|normally\s+|just\s+|also\s+|then\s+)*(?:(?:need to|have to|want to|try to|make sure to|make sure you|should|will|can)\s+)?/i;

// Verbs that start a step in job notes, so "pull the mats, vacuum the seats and wipe the dash" becomes
// three steps while "wipe the dash, doors and cup holders" stays one.
const VERBS = new Set(('pull vacuum wipe wash dry clean shampoo apply buff rinse spray check load unload text call send take walk park set pack unpack move cover mow trim edge blow sweep mop dust scrub empty fold make bake pour label ship print post reply confirm book invoice charge collect sign measure cut sand paint prime fill tape remove replace install test inspect note log restock order greet ask show explain start finish open close lock unlock turn put place hang wrap deliver drop pick return review edit export upload schedule polish detail steam treat condition seal coat protect brush blot spot soak scrape lay mix stir cool frost box bag water feed prune plant weed rake haul bring leave lift carry stack sort count weigh tag price list photograph film share write read update plan prep prepare heat chill serve tidy reset refill hose dispose throw finish').split(' '));

function baseVerb(word) {
  const w = String(word || '').toLowerCase();
  if (VERBS.has(w)) return w;
  if (w.endsWith('ing') && w.length > 5) {
    const stemmed = w.slice(0, -3);
    for (const c of [stemmed, `${stemmed}e`, stemmed.slice(0, -1)]) if (VERBS.has(c)) return c;
  }
  return null;
}
const startsWithVerb = (piece) => !!baseVerb(String(piece).trim().split(/\s+/)[0]);

function tidyStep(p) {
  let s = text.oneLine(p);
  for (let i = 0; i < 3; i++) s = s.replace(LEAD, '').replace(WHO, '');
  s = s.replace(/^(?:start|begin)\s+(?:by|with)\s+/i, '');
  if (/^like\s+/i.test(s) && startsWithVerb(s.replace(/^like\s+/i, ''))) s = s.replace(/^like\s+/i, '');
  // "pulling the mats" -> "pull the mats"
  const first = s.split(/\s+/)[0];
  const base = /ing$/i.test(first) && baseVerb(first);
  if (base) s = `${base}${s.slice(first.length)}`;
  s = s.replace(/\bmy\b/gi, 'the').replace(/\bI'm\b/g, "you're").replace(/\bI\b/g, 'you').replace(/^[,:\s]+|[,:\s]+$/g, '');
  return s;
}

// One sentence -> its actions: split at commas and "and" only where the next part starts with a verb.
function actionsOf(sentence) {
  const parts = sentence.split(/,\s*(?:and\s+)?|\s+and\s+/);
  if (parts.length < 2) return [sentence];
  const out = [];
  let cur = parts[0];
  let rest = sentence.slice(parts[0].length);
  for (let i = 1; i < parts.length; i++) {
    const m = rest.match(/^(,\s*(?:and\s+)?|\s+and\s+)/);
    const sep = m ? m[1] : ' ';
    rest = rest.slice(sep.length + parts[i].length);
    if (startsWithVerb(parts[i]) && parts[i].trim().split(/\s+/).length >= 2 && cur.trim().split(/\s+/).length >= 2) {
      out.push(cur);
      cur = parts[i];
    } else cur += `${sep}${parts[i]}`;
  }
  out.push(cur);
  return out;
}

// Notes -> [{ title, detail }]: split at sentences and "then", one action per step.
function stepsFrom(notes, max = 14) {
  const pieces = String(notes || '').replace(FILLER, ' ').replace(/\blike (?=\d|a |an )/gi, 'about ').split(JOIN).map(tidyStep).filter(Boolean).flatMap(actionsOf).map(tidyStep).filter((p) => p && p.split(/\s+/).length >= 2);
  const seen = new Set();
  const out = [];
  for (const p of pieces) {
    const key = p.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 5).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    // A long step keeps its first clause as the title and the rest as the detail.
    const cut = p.length > 70 ? p.search(/,\s|\s(?:so|because|until|before|while|unless)\s/i) : -1;
    const title = text.sentenceCase((cut > 12 ? p.slice(0, cut) : p).replace(/[.]+$/, ''));
    const rest = cut > 12 ? p.slice(cut).replace(/^[,\s]+/, '') : '';
    out.push({ title: text.clip(title, 90), detail: rest ? `${text.sentenceCase(rest).replace(/[.]+$/, '')}.` : '' });
    if (out.length >= max) break;
  }
  return out;
}

// "Square: payments", "Square for payments" or "Square" -> { name, use }
function toolsFrom(raw) {
  return String(raw || '').split(/\n|,(?![^(]*\))/).map((t) => text.oneLine(t.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, ''))).filter((t) => t.length > 1).slice(0, 12).map((t) => {
    const m = t.match(/^(.{2,40}?)\s*(?::|\s-\s|\sfor\s|\sto\s)\s*(.+)$/i);
    return m ? { name: m[1].trim(), use: text.sentenceCase(m[2].trim()).replace(/[.]+$/, '') } : { name: t, use: '' };
  });
}

// "Supplies: Lone Star Auto Supply, (512) 555-0177" -> { role, who }
function contactsFrom(raw) {
  return String(raw || '').split('\n').map((t) => text.oneLine(t.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, ''))).filter((t) => t.length > 2).slice(0, 12).map((t) => {
    const m = t.match(/^([^:]{2,40}):\s*(.+)$/);
    return m ? { role: text.sentenceCase(m[1].trim()), who: m[2].trim() } : { role: 'Contact', who: t };
  });
}

function rulesFrom(raw) {
  return String(raw || '').replace(/\r/g, '').split(/\n+/).map((l) => text.oneLine(l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, ''))).filter((l) => l.length > 3).slice(0, 14)
    .map((l) => `${text.sentenceCase(l).replace(/[.]+$/, '')}.`);
}

// ---------- starting points (labeled as such in the manual) ----------

const START_JOB = {
  onsite: [
    ['Check the day before', 'Confirm the address, the time window and anything special about the job.'],
    ['Load the supplies', 'Use the checklist for this job, and top up anything running low.'],
    ['Text when you are on the way', 'With a time you can keep.'],
    ['Walk the job with the customer', 'Agree on what gets done, and take before photos.'],
    ['Do the work in the same order every time', 'So nothing gets skipped.'],
    ['Walk it again with the customer', 'Fix anything missed before you leave, and take after photos.'],
    ['Take payment and log the job', 'Note anything to remember for next time.'],
  ],
  visit: [
    ['Get the space ready before they arrive', 'Clean, stocked and set up for this appointment.'],
    ['Greet them and agree on the plan', 'Look at their photos or ideas and confirm the price.'],
    ['Do the work', 'Check in with them as you go.'],
    ['Show them the result', 'Fix anything they want changed before they leave.'],
    ['Take payment and offer the next booking', 'Note anything to remember for next time.'],
    ['Reset the space', 'Ready for the next person.'],
  ],
  online: [
    ['Confirm what is due and when', 'Write it at the top of the project notes.'],
    ['Collect everything you need', 'Logins, files and examples in one folder.'],
    ['Make the first version', 'Check it against the brief before sending.'],
    ['Send it with a date for feedback', 'Ask for all changes in one message.'],
    ['Make the changes and deliver', 'With a short note on how to use it.'],
    ['Log the hours and send the invoice', 'The same day you deliver.'],
  ],
  lessons: [
    ['Look at the notes from last time', 'And bring what you need for today.'],
    ['Start with a quick check-in', 'What went well, what felt hard.'],
    ['Work through the plan for today', 'One main thing, practiced until it sticks.'],
    ['End with what to practice', 'Written down, so it is clear.'],
    ['Send a short note to the family or client', 'What you covered and what is next.'],
  ],
  orders: [
    ['Confirm the order in writing', 'What, how many, the date and the price.'],
    ['Check you have the supplies', 'Order anything missing the same day.'],
    ['Make it the same way every time', 'Follow your recipe or pattern exactly.'],
    ['Check it before it goes out', 'Look, label and pack it with care.'],
    ['Hand it over or ship it', 'Message the customer with the details.'],
    ['Log the order', 'What sold, what it cost to make, what to reorder.'],
  ],
  events: [
    ['Confirm the details the week before', 'Timeline, place, head count and the contact on the day.'],
    ['Pack from the checklist', 'And check everything works before you leave.'],
    ['Arrive early and set up', 'Find the contact person and confirm the timeline.'],
    ['Run your part of the day', 'Keep to the timeline, and tell the contact about any change.'],
    ['Pack down and leave the space clean', 'Check nothing is left behind.'],
    ['Follow up after', 'Thank them and send anything you promised.'],
  ],
};

const WEEK = {
  daily: ['Check messages at the start and end of the day.', "Confirm tomorrow's bookings by text.", 'Restock what you used today.'],
  weekly: ['Send any unpaid invoices.', 'Clean and check your tools or space.', 'Post at least twice where your customers look.'],
  monthly: ['Look at what came in and what went out.', 'Reorder supplies before you run out.', 'Read this manual and change anything that is out of date.'],
};

const DECIDE = [
  ['cancel', /cancel|resched|move (a|the|your) booking|no.?show/i, 'What happens when a customer cancels or moves late?'],
  ['pay', /pay|deposit|invoice|cash|card|venmo|zelle/i, 'How customers pay, and when.'],
  ['late', /late|running behind/i, 'What to do when you or the customer is running late.'],
  ['weather', /rain|weather|storm|snow|heat/i, 'What happens in bad weather.', ['onsite', 'events']],
  ['reply', /repl|message|text back|respond|answer/i, 'Who answers messages, and how fast.'],
  ['damage', /damage|broke|scratch|insur/i, 'What to do if something gets damaged.'],
  ['photos', /photo|picture/i, 'When to take photos of the work, and where they go.'],
];

function stillToDecide(rules, group) {
  const all = rules.join(' ');
  return DECIDE.filter(([, re, , groups]) => (!groups || groups.includes(group)) && !re.test(all)).map(([key, , q]) => ({ key, q }));
}

// What to do when something goes wrong: plain steps, using the business's own ready lines.
function playbook(voice, group) {
  const line = (use) => ((voice && voice.lines) || []).find((l) => l.use === use);
  const late = line('Running late');
  const list = [
    { title: 'You are running late', steps: ['Text the customer before the start time, not after.', 'Give a new time you can keep, and offer to move the booking.'], say: late ? late.text : '' },
    { title: 'A customer is unhappy', steps: ['Listen to the whole thing before you answer.', 'Fix it on the spot if you can. If not, book a time to come back and fix it.', 'Tell the owner the same day.'] },
    { title: 'Something gets damaged', steps: ['Stop and take photos.', 'Tell the customer right away, and tell the owner the same day.', 'Do not promise money or a fix until the owner says so.'] },
    { title: "You are sick or can't make it", steps: ['Tell the owner first.', 'Text the customer as early as you can with two new times.'] },
    { title: 'A payment does not come through', steps: ['Send a friendly reminder with the invoice after 3 days.', 'Call after 7 days. Keep it kind and short.'] },
  ];
  if (group === 'online') list.splice(2, 1, { title: 'A file or login goes missing', steps: ['Check the shared folder and your notes first.', 'Ask the customer once, with exactly what you need.', 'Tell the owner if it holds up the date.'] });
  return list;
}

// ---------- the manual ----------

function manualMd(m) {
  const list = (a) => a.map((x) => `- ${x}`).join('\n');
  const parts = [`# ${m.name ? `${m.name} operations manual` : 'Operations manual'}`, '', `${m.purpose} Updated ${m.updated}.`, ''];
  parts.push('## At a glance', '', list(m.glance.map(([k, v]) => `${k}: ${v}`)), '');
  parts.push('## How we sound', '', list(m.voice.words), '', 'Do:', list(m.voice.do), '', "Don't:", list(m.voice.dont), '');
  parts.push('Example lines. Change any promise in them to match what you actually do.', '');
  for (const l of m.voice.lines) parts.push(`${l.use}: "${l.text}"`, '');
  parts.push('## The jobs', '');
  for (const j of m.jobs) {
    parts.push(`### ${j.name}`, '');
    if (j.time) parts.push(`${j.time}.`, '');
    if (j.from === 'starting') parts.push('A starting checklist. Replace it with how you do it.', '');
    j.steps.forEach((s, i) => parts.push(`${i + 1}. ${s.title}${s.detail ? `. ${s.detail}` : ''}`));
    parts.push('');
  }
  parts.push('## A normal week', '', m.hours ? `Hours: ${m.hours}` : 'Hours: add yours.', '', `Every day:\n${list(m.week.daily)}`, '', `Every week:\n${list(m.week.weekly)}`, '', `Every month:\n${list(m.week.monthly)}`, '');
  parts.push('## Rules', '', m.rules.length ? list(m.rules) : 'None written yet.', '');
  if (m.decide.length) parts.push('Still to decide:', list(m.decide.map((d) => d.q)), '');
  parts.push('## Tools', '', m.tools.length ? list(m.tools.map((t) => (t.use ? `${t.name}: ${t.use}` : t.name))) : 'Add the apps you use for bookings, payments and messages.', '');
  parts.push('## Who to call', '', m.contacts.length ? list(m.contacts.map((c) => `${c.role}: ${c.who}`)) : 'Add who to call: supplies, a backup helper, your insurance.', '');
  parts.push('## When something goes wrong', '');
  for (const p of m.playbook) parts.push(`### ${p.title}`, '', list(p.steps), p.say ? `\nSay: "${p.say}"` : '', '');
  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function manualHtml(m, spec) {
  const c = spec.colors;
  const d = L.draw('wordmark', spec, 'color');
  const logo = L.logoSvg(d, { pad: 0.02 }).replace(/<\?xml[^>]*>/, '');
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join('');
  const css = `@page{size:letter;margin:.5in}*{box-sizing:border-box}
body{margin:0;background:${c.paper};color:${c.ink};font:15px/1.55 Inter,"Helvetica Neue",Arial,sans-serif}
main{max-width:880px;margin:0 auto;padding:40px 32px 60px}
header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:3px solid ${c.primary};padding-bottom:16px}
header .logo svg{height:56px;width:auto;max-width:340px;display:block}
.kicker{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${c.muted};font-weight:700}
h1{font-size:40px;line-height:1.08;margin:24px 0 6px;letter-spacing:-.02em}
.lede{color:${c.muted};font-size:17px;margin:0}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:${c.primary};margin:36px 0 12px}
nav{margin:18px 0 0;font-size:13px;color:${c.muted};display:flex;flex-wrap:wrap;gap:4px 14px}nav span{white-space:nowrap}
.glance{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.g{background:#fff;border:1px solid ${c.line};border-radius:14px;padding:12px 14px}.g small{display:block;color:${c.muted};font-size:12px}.g b{font-size:15px}
.card{background:#fff;border:1px solid ${c.line};border-radius:16px;padding:16px 20px;margin-bottom:12px;break-inside:avoid}
.job h3{margin:0 0 4px;font-size:20px}.job .note{color:#9a5a00;font-size:13px;margin:0 0 8px}
ol.steps{margin:8px 0 0;padding-left:0;list-style:none;counter-reset:s}ol.steps li{counter-increment:s;position:relative;padding:6px 0 6px 40px;border-top:1px solid ${c.line}}
ol.steps li:first-child{border-top:0}ol.steps li:before{content:counter(s);position:absolute;left:0;top:6px;width:26px;height:26px;border-radius:50%;background:${c.primary};color:${c.onPrimary};font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
ol.steps span{display:block;color:${c.muted};font-size:14px}
.words{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.words span{background:${c.primary};color:${c.onPrimary};border-radius:999px;padding:6px 14px;font-weight:700;font-size:14px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.say{background:${c.surface};border-radius:12px;padding:10px 14px;margin:8px 0 0;font-size:14px}.say b{display:block;font-size:12px;color:${c.muted}}
ul{margin:0;padding-left:20px}li{margin:3px 0}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}td,th{text-align:left;padding:8px;border-bottom:1px solid ${c.line};vertical-align:top}th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${c.muted}}
.decide{border-left:4px solid #c27a00}
footer{margin-top:36px;color:${c.muted};font-size:12px;border-top:1px solid ${c.line};padding-top:12px}
@media (max-width:700px){main{padding:24px 18px 40px}h1{font-size:32px}.glance,.two,.three{grid-template-columns:1fr}header{flex-direction:column;align-items:flex-start}}
@media print{main{padding:0}h2{break-after:avoid}}`;
  const jobs = m.jobs.map((j) => `<div class="card job"><h3>${esc(j.name)}${j.time ? ` <small style="font-size:13px;font-weight:600;color:${c.muted}">${esc(j.time)}</small>` : ''}</h3>${j.from === 'starting' ? '<p class="note">A starting checklist for this kind of job. Replace it with how you do it.</p>' : j.steps.length < 3 ? '<p class="note">Only a few steps in your notes. Add more detail when you can.</p>' : ''}<ol class="steps">${j.steps.map((s) => `<li><b>${esc(s.title)}</b>${s.detail ? `<span>${esc(s.detail)}</span>` : ''}</li>`).join('')}</ol></div>`).join('');
  const body = `<main>
<header><div class="logo">${m.name ? logo : ''}</div><div class="kicker">Operations manual</div></header>
<h1>How ${esc(m.name || 'the business')} runs</h1>
<p class="lede">${esc(m.purpose)} Updated ${esc(m.updated)}.</p>
<nav><span>1 At a glance</span><span>2 How we sound</span><span>3 The jobs</span><span>4 A normal week</span><span>5 Rules</span><span>6 Tools</span><span>7 Who to call</span><span>8 When something goes wrong</span></nav>
<h2>1 At a glance</h2>
<div class="glance">${m.glance.map(([k, v]) => `<div class="g"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
<h2>2 How we sound</h2>
<div class="words">${m.voice.words.map((w) => `<span>${esc(w)}</span>`).join('')}</div>
<div class="two"><div class="card"><b>Do</b><ul>${li(m.voice.do)}</ul></div><div class="card"><b>Don't</b><ul>${li(m.voice.dont)}</ul></div></div>
<p style="margin:14px 0 0;color:${c.muted};font-size:13px">Example lines. Change any promise in them to match what you actually do.</p>
${m.voice.lines.map((l) => `<div class="say"><b>${esc(l.use)}</b>${esc(l.text)}</div>`).join('')}
<h2>3 The jobs</h2>
${jobs}
<h2>4 A normal week</h2>
<p style="margin:0 0 12px">${m.hours ? `Hours: <b>${esc(m.hours)}</b>.` : 'Hours: add yours.'} Below is a starting routine; change it to fit.</p>
<div class="three"><div class="card"><b>Every day</b><ul>${li(m.week.daily)}</ul></div><div class="card"><b>Every week</b><ul>${li(m.week.weekly)}</ul></div><div class="card"><b>Every month</b><ul>${li(m.week.monthly)}</ul></div></div>
<h2>5 Rules</h2>
${m.rules.length ? `<div class="card"><ul>${li(m.rules)}</ul></div>` : ''}
${m.decide.length ? `<div class="card decide"><b>${m.rules.length ? 'Still to decide' : 'Decide these and write them down'}</b><ul>${li(m.decide.map((x) => x.q))}</ul></div>` : ''}
<h2>6 Tools</h2>
${m.tools.length ? `<table><tr><th>Tool</th><th>What it is for</th></tr>${m.tools.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.use || 'Add what you use it for')}</td></tr>`).join('')}</table>` : '<div class="card">Add the apps you use for bookings, payments and messages.</div>'}
<h2>7 Who to call</h2>
${m.contacts.length ? `<table><tr><th>For</th><th>Who</th></tr>${m.contacts.map((x) => `<tr><td>${esc(x.role)}</td><td><b>${esc(x.who)}</b></td></tr>`).join('')}</table>` : '<div class="card">Add who to call: supplies, a backup helper, your insurance.</div>'}
<h2>8 When something goes wrong</h2>
<div class="two">${m.playbook.map((p) => `<div class="card"><b>${esc(p.title)}</b><ul>${li(p.steps)}</ul>${p.say ? `<div class="say"><b>Say</b>${esc(p.say)}</div>` : ''}</div>`).join('')}</div>
<footer>${m.name ? `${esc(m.name)} operations manual` : 'Operations manual'}, updated ${esc(m.updated)}. ${esc(m.from)}</footer>
</main>`;
  return files.htmlDoc({ title: m.name ? `${m.name} operations manual` : 'Operations manual', css, body, description: `How ${m.name || 'the business'} runs: the jobs step by step, the rules, the tools and who to call` });
}

module.exports = { jobsFrom, timeOf, stepsFrom, tidyStep, actionsOf, baseVerb, toolsFrom, contactsFrom, rulesFrom, stillToDecide, playbook, START_JOB, WEEK, DECIDE, manualMd, manualHtml };
