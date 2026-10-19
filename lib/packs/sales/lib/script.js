// The sales call script: six plain steps in a fixed order (data/closer.json, internal names never
// shown), each with what to say, what to ask, what to listen for and what to do if they answer
// one way or another. Filled with the member's own offer, price and options (most complete first),
// plus the ten objections buyers raise most (data/objections.json) with answers in the member's words.

const { text, time } = require('../../_kit');
const docs = require('./docs');
const { mixed } = require('./options');
const OBJ = require('../data/objections.json');
const STEPS = require('../data/closer.json').steps;

const esc = docs.esc;

// A sentence whose value is missing (no promise of theirs yet, nothing listed as included) is left out.
function fill(s, vars) {
  const empty = (k) => Object.prototype.hasOwnProperty.call(vars, k) && (vars[k] == null || vars[k] === '');
  return String(s || '')
    .split(/(?<=[.!?])\s+/)
    .filter((line) => !(line.match(/\{(\w+)\}/g) || []).some((t) => empty(t.slice(1, -1))))
    .map((line) => line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? vars[k] : m)))
    .join(' ');
}

function varsFor(f, opts) {
  const p = f.profile;
  let day = time.addDays(f.today, 2);
  while ([0, 6].includes(time.weekdayOf(day))) day = time.addDays(day, 1);
  return {
    difference: p.difference || 'I do it carefully, start to finish',
    smaller: (opts && opts.length > 1 && !mixed(opts) ? `${opts[opts.length - 1].name} at ${opts[opts.length - 1].priceText}` : '') || p.smaller || 'a smaller first step',
    laterDate: time.shortDate(time.addDays(f.today, 14)),
    effort: p.effort || 'say yes',
    timeSaved: p.timeSaved || 'You get the time back.',
    promise: f.promise ? `${text.sentenceCase(f.promise).replace(/[.!]+$/, '')}.` : '',
    included: (p.included || []).slice(0, 3).join(', ').toLowerCase(),
    proof: p.proof || 'photos of work you have done',
    day: time.WEEKDAYS[time.weekdayOf(day)],
    job: p.job || 'job',
  };
}

// The ten objections: the seven every buyer raises plus the three most common for this kind of work.
function objections(f, opts, notes = '') {
  const vars = varsFor(f, opts);
  const extras = (OBJ.extrasByArchetype[f.arch] || OBJ.extrasByArchetype.general).filter((k) => !OBJ.always.includes(k));
  const heard = String(notes || '').toLowerCase();
  const ranked = [...extras].sort((a, b) => Number((OBJ.library[b].match || []).some((m) => heard.includes(m))) - Number((OBJ.library[a].match || []).some((m) => heard.includes(m))));
  const keys = [...OBJ.always, ...ranked.slice(0, 3)];
  return keys.map((k) => {
    const o = OBJ.library[k];
    const says = (f.b2b && o.saysBusiness) || o.says;
    return { key: k, label: o.label, says: says[0], means: o.means, answer: text.oneLine(fill(o.answer, vars)), ask: fill(o.ask, vars), avoid: fill(o.avoid, vars) };
  });
}

function build({ f, opts, prospect = {}, notes = '' }) {
  const p = f.profile;
  const who = text.firstName(prospect.name || '') || '';
  const pains = p.pains || [];
  const tried = p.tried || [];
  const want = p.want || [];
  const objs = objections(f, opts, notes);
  const top = opts[0];
  const last = opts[opts.length - 1];
  const mid = opts.length === 3 ? opts.find((o) => o.recommended) || opts[1] : null;
  const ranked = opts.length > 1 && !mixed(opts);
  const ways = !top
    ? ''
    : ranked
      ? `There are ${opts.length} ways to do it. The most complete is ${top.name} at ${top.priceText} ${top.per}.${mid && mid !== top ? ` The one I'd suggest is ${mid.name} at ${mid.priceText}.` : ''} The smallest is ${last.name} at ${last.priceText}.`
      : opts.length === 1
        ? `It's ${top.name}, at ${top.priceText} ${top.per}.`
        : `There are ${opts.length} ways to do it: ${opts.map((o) => `${o.name} at ${o.priceText} ${o.per}`).join(opts.length === 2 ? ' or ' : ', ')}.`;
  const dep = f.deposit ? `${Math.round(f.deposit * 100)}% deposit` : f.depositCents ? 'deposit' : '';
  const lines = {
    why: {
      say: [`Thanks for making the time${who ? `, ${who}` : ''}. Before I tell you how I work, can I ask a few quick questions so I only talk about what matters to you?`],
      ask: ['What made you reach out now?', 'What were you hoping I could help with?'],
      listen: 'The real reason and why it is now. Write their exact words down; you will use them at the end.',
      branches: [
        { if: 'They say they are just getting prices', then: 'Fair enough. So the number I give you is real, what would you want it to include?' },
        { if: 'Someone sent them to you', then: 'Ask what that person told them, and what made them actually reach out.' },
      ],
      avoid: 'Pitching before you know why they are here.',
    },
    problem: {
      say: ['So what is the main thing you want fixed?'],
      ask: ['How long has that been going on?', 'What is it costing you right now, in time, money or hassle?', 'What happens if nothing changes for the next few months?'],
      listen: `The problem in their own words, and how much it bothers them.${pains[0] ? ` For this kind of work it might sound like "${pains[0]}". Let them say it first.` : ''}`,
      branches: [
        { if: 'They play it down', then: 'Ask: from 1 to 10, how much does it bother you? Then: why not lower? Let them tell you why it matters.' },
        { if: 'They list several problems', then: 'Ask which one they would fix first if they could only fix one.' },
      ],
      avoid: 'Naming the problem for them. Let them say it.',
    },
    tried: {
      say: ['What have you tried so far?'],
      ask: [tried[0] ? `Have you tried ${tried[0]}? How did that go?` : 'What did you try before, and how did it go?', 'What did you like about it, and what did not work?'],
      listen: 'Why the past tries failed. That is the part your offer has to do differently.',
      branches: [
        { if: 'They used someone like you before', then: 'Ask what they would change about how it went. Never bad-mouth the other person.' },
        { if: 'They never tried anything', then: 'Ask what stopped them until now. That is often the real worry.' },
      ],
      avoid: 'Saying "that never works". Ask what happened instead.',
    },
    want: {
      say: [`Picture ${p.horizon || 'a month from now'}, with this sorted. What does it look like?`],
      ask: ['What would be different for you?', 'Why does that matter to you?'],
      listen: want[0] ? `Goals like "${want[0]}". Repeat their goal back in their words.` : 'Their goal, in their words. Repeat it back.',
      branches: [
        { if: 'The goal is bigger than what you do', then: 'Say which part you handle and which part you do not. Being clear here builds trust.' },
        { if: 'They are not sure', then: 'Offer two pictures: is it more about saving time, or about it being done right?' },
      ],
      avoid: 'Promising results you do not control. Promise what you do: the work, on time, and your fix-it promise.',
    },
    worries: {
      say: [
        `Here is how I would do it. ${(p.points || []).slice(0, 3).map((x) => `${x.title}: ${x.say}`).join(' ')}`,
        ways,
      ].filter(Boolean),
      ask: ['What would you want changed?', 'Is there anything that would stop you from going ahead?'],
      listen: 'The worry behind the question. Answer that one, then ask if it is cleared up.',
      branches: objs.slice(0, 3).map((o) => ({ if: `They say "${o.says}"`, then: o.answer })),
      avoid: 'Arguing or talking fast. Ask a question back, then answer.',
    },
    yes: {
      say: [`Which one feels right for you?`, dep ? `Great. A ${dep} holds your spot. I will text you the link right now while we are on the phone.` : 'Great. I will text you the confirmation right now while we are on the phone.'],
      ask: ['Which day works best?', 'Where should I send the confirmation?'],
      listen: 'A clear yes, a date, and where to send things.',
      branches: [
        { if: 'They say yes', then: `Book it before you hang up: date, address and ${dep ? 'the deposit link' : 'the confirmation'} by text.${f.promise ? ` Then: "${text.sentenceCase(f.promise)}"` : ''}` },
        { if: 'They want to wait', then: 'Ask what is left to decide. If it is real, agree on a day to talk again and put it in both calendars.' },
      ],
      avoid: 'Ending the call without a next step and a date.',
    },
  };
  const steps = STEPS.map((s, i) => ({ n: i + 1, name: s.name, goal: s.goal, ...lines[s.id] }));
  return { steps, objections: objs };
}

const CSS = `
.step{border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:0 0 10px;break-inside:avoid}
.step h3{display:flex;gap:10px;align-items:center;margin:0 0 4px;font:600 16px/1.3 ${docs.SANS}}
.step h3 span{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--brand);color:var(--on-brand);font-size:12px}
.step .goal{color:var(--muted);margin:0 0 8px;font-size:13px}
.say{background:var(--brand-softer);border-radius:8px;padding:8px 12px;margin:0 0 8px}
.lbl{font:700 10.5px/1.4 ${docs.SANS};letter-spacing:.1em;text-transform:uppercase;color:var(--brand-ink);margin:6px 0 2px}
.ifs{width:100%;border-collapse:collapse;font-size:13px}
.ifs td{border-top:1px solid var(--line);padding:5px 6px;vertical-align:top}
.ifs td:first-child{width:34%;font-weight:600}
.obj{width:100%;border-collapse:collapse;font-size:13px}
.obj th{text-align:left;font:700 10.5px/1.4 ${docs.SANS};letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px}
.obj td{border-top:1px solid var(--line);padding:7px 6px;vertical-align:top}
.obj td:first-child{width:28%;font-weight:600}
.obj .q{display:block;color:var(--muted);font-weight:400;margin-top:2px}
@media (max-width:680px){.ifs td,.obj td{display:block;width:auto!important}.ifs tr,.obj tr{display:block;border-top:1px solid var(--line)}.ifs td,.obj td{border:0}}
@media print{.step{padding:7px 10px;margin-bottom:6px}.say{padding:5px 8px}.ifs,.obj{font-size:8.5pt}}
`;

function optLine(o) {
  const inc = o.plus && o.plus.extra.length ? `everything in ${o.plus.of}, plus ${o.plus.extra.join(', ').toLowerCase()}` : o.includes.join(', ').toLowerCase();
  return `${o.name}: ${o.priceText} ${o.per}${inc ? `. ${text.sentenceCase(inc)}` : ''}`;
}

function html({ f, s, opts, prospect = {} }) {
  const who = [prospect.name, prospect.company].filter(Boolean).join(', ');
  const stepHtml = s.steps
    .map(
      (st) => `<div class="step"><h3><span>${st.n}</span>${esc(st.name)}</h3><p class="goal">${esc(st.goal)}</p>
<div class="lbl">Say</div>${st.say.map((x) => `<p class="say">${esc(x)}</p>`).join('')}
<div class="lbl">Ask</div>${docs.list(st.ask)}
<div class="lbl">Listen for</div><p>${esc(st.listen)}</p>
<div class="lbl">If they...</div><table class="ifs">${st.branches.map((b) => `<tr><td>${esc(b.if)}</td><td>${esc(b.then)}</td></tr>`).join('')}</table>
<p class="note"><b>Avoid:</b> ${esc(st.avoid)}</p></div>`
    )
    .join('');
  const optHtml = opts.length ? `<section class="section"><h2>Your options, most complete first</h2>${docs.list(opts.map(optLine))}</section>` : '';
  const objHtml = `<section class="section"><h2>The ten things buyers say, and your answer</h2><table class="obj"><tr><th>They say</th><th>You say</th></tr>${s.objections.map((o) => `<tr><td>${esc(o.says)}<span class="q">${esc(o.label)}</span></td><td>${esc(o.answer)}<span class="q">Then ask: ${esc(o.ask)}</span></td></tr>`).join('')}</table></section>`;
  const body = `<main class="sheet">
${docs.header(f)}
<section class="cover"><span class="kicker">Sales call script</span><h1 class="title">${esc(who ? `Call with ${who}` : 'Your sales call')}</h1><p class="lead">Six steps in order. Ask more than you talk. Every step ends with a question.</p></section>
${stepHtml}
${optHtml}
${objHtml}
<footer class="foot"><div>${esc(f.displayName)}</div><div>${esc(time.longDate(f.today))}</div></footer>
</main>`;
  return docs.doc({ title: `Sales call script, ${f.displayName}`, description: 'A six-step sales call script with answers to common objections', css: CSS, body, pal: f.palette, paper: f.paper });
}

function plainText({ f, s, opts, prospect = {} }) {
  const out = [`SALES CALL SCRIPT${prospect.name ? `: ${prospect.name}` : ''}`, f.displayName, ''];
  for (const st of s.steps) {
    out.push(`${st.n}. ${st.name.toUpperCase()}`, `Goal: ${st.goal}`, ...st.say.map((x) => `Say: ${x}`), ...st.ask.map((x) => `Ask: ${x}`), `Listen for: ${st.listen}`, ...st.branches.map((b) => `If ${b.if.replace(/^They /, 'they ')}: ${b.then}`), `Avoid: ${st.avoid}`, '');
  }
  if (opts.length) out.push('YOUR OPTIONS', ...opts.map(optLine), '');
  out.push('THE TEN THINGS BUYERS SAY');
  for (const o of s.objections) out.push(`"${o.says}"`, `You: ${o.answer}`, `Then ask: ${o.ask}`, '');
  return out.join('\n');
}

module.exports = { build, objections, html, plainText, varsFor, fill };
