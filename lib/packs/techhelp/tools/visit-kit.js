// Tech help's own tools, the "Visit plan and scam card" workflow:
//   plan_visit       the client's devices and what's not working -> a timed visit plan, each step from
//                    Apple, Google, Microsoft, the FTC or CISA (or marked as our judgment), with the
//                    password manager steps the client does themselves
//   make_scam_card   a printable scam warning card in large type, every line from the FTC, the FBI's
//                    IC3, the Justice Department, AARP or Microsoft; nothing about the member on it
//   write_visit_note the note after the visit (and a family copy with the client's okay), which never
//                    carries a password: lines that look like one are left out
// The member never sees, writes down or keeps a client's password. Data: data/visit.json (sources:
// research/niches/techhelp.json).

const fs = require('fs');
const path = require('path');
const { views, files, save, time, text } = require('../../_kit');
const C = require('../../_kit/common');

const { plain, clip } = text;
const esc = files.esc;
const V = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'visit.json'), 'utf8'));

const MAX_LINES = 12;
const VISIT_MIN = 30;
const VISIT_MAX = 240;
const VISIT_DEFAULT = 90;

const isOn = (v) => v === true || v === 'true';
const firstName = (s) => plain(String(s || '').replace(/[(,].*$/, '')).trim().split(/\s+/)[0] || '';
const sourcesOf = (ids) => (ids || []).map((id) => V.sources[id]).filter(Boolean);
const byOf = (step) => (step.judgment || !(step.src || []).length ? 'Our judgment' : text.list([...new Set(sourcesOf(step.src).map((s) => s.publisher))]));
const sentence = (s) => {
  const t = plain(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return /[.!?:]$/.test(t) ? t : `${t}.`;
};

const BASE_CSS = `body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#f6f7f9;line-height:1.5}
main{max-width:760px;margin:24px auto;background:#fff;border-radius:14px;padding:28px 32px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
h1{margin:0 0 4px}h2{color:#1d5c63;border-bottom:2px solid #dcebec;padding-bottom:4px}
ul{padding-left:22px;margin:6px 0}li{margin:5px 0}.muted{color:#5b6475}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #e3e6eb;padding:7px 6px;text-align:left;vertical-align:top}
td:first-child{color:#5b6475;width:32%}.box{background:#f1f7f7;border-radius:10px;padding:10px 16px;margin:12px 0}
.by{color:#5b6475;font-size:.85em}footer{margin-top:24px;font-size:13px;color:#5b6475}
@media (max-width:520px){main{margin:0;border-radius:0;padding:20px 16px}}
@media print{body{background:#fff}main{box-shadow:none;margin:0;max-width:none}}`;

// ---------- the visit plan ----------

// Device families named in the devices (or issues). A computer with no brand gets the Windows and the
// Mac steps, each labeled; no devices typed at all gets every family's steps.
function familiesOf(devices, issues) {
  if (!plain(devices || '').trim()) return { set: new Set(V.families.map((f) => f.id)), labels: [], all: true };
  const blob = `${devices}\n${issues || ''}`;
  const hits = V.families.filter((f) => new RegExp(f.match, 'i').test(blob));
  const set = new Set(hits.map((f) => f.id));
  if (set.has('computer') && !set.has('windows') && !set.has('mac')) {
    set.add('windows');
    set.add('mac');
  }
  return { set, labels: hits.filter((f) => f.id !== 'computer' || hits.length === 1).map((f) => f.label), all: false };
}

const stepsFor = (steps, fam) =>
  (steps || []).filter((s) => !s.family || fam.set.has(s.family)).map((s) => ({ text: plain(s.text), by: byOf(s), ...(s.judgment || !(s.src || []).length ? { judgment: true } : {}), src: s.src || [] }));

// One library entry per typed line (the first that matches, so "the printer stopped printing from the
// laptop" is the printer), merged when two lines land on the same entry; anything else is its own item.
function itemsOf(issueLines, fam) {
  const items = [];
  for (const line of issueLines) {
    const hit = V.issues.find((i) => new RegExp(i.match, 'i').test(line));
    const id = hit ? hit.id : `other:${items.length}`;
    const old = items.find((x) => x.id === id);
    if (old) {
      old.from.push(line);
      continue;
    }
    if (hit) items.push({ id, label: hit.label, minutes: hit.minutes, from: [line], steps: stepsFor(hit.steps, fam) });
    else items.push({ id, label: clip(sentence(line).replace(/\.$/, ''), 80), minutes: V.other.minutes, from: [line], steps: stepsFor(V.other.steps, fam) });
  }
  // Scam and money worries first; the rest in the order the client gave them.
  const rank = (x) => {
    const i = V.first.indexOf(x.id);
    return i < 0 ? V.first.length : i;
  };
  return items.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map(({ x }) => x);
}

// Today or next visit: in order, while the time lasts (the first item always fits today).
function schedule(items, length) {
  let used = V.start.minutes + V.end.minutes;
  let full = false;
  return items.map((x, i) => {
    const fits = !full && (i === 0 || used + x.minutes <= length);
    if (fits) used += x.minutes;
    else full = true;
    return { ...x, when: fits ? 'Today' : 'Next visit' };
  });
}

function planText(o) {
  const out = [`Visit plan for ${o.client}${o.when ? `, ${o.when}` : ''} (${o.length} minutes)`];
  if (o.devices.length) out.push(`Devices: ${o.devices.join(', ')}`);
  if (o.family) out.push(`Family or friend there: ${o.family}`);
  const block = (n, label, minutes, steps) => [``, `${n}. ${label} (${minutes} min)`, ...steps.map((s) => `- ${s.text} (${s.by})`)];
  let n = 1;
  out.push(...block(n++, V.start.label, V.start.minutes, o.start));
  for (const x of o.items.filter((i) => i.when === 'Today')) out.push(...block(n++, x.label, x.minutes, x.steps));
  out.push(...block(n++, V.end.label, V.end.minutes, o.end));
  const later = o.items.filter((i) => i.when !== 'Today');
  if (later.length) out.push('', `Next visit: ${later.map((x) => x.label).join('; ')}`);
  out.push('', V.passwords.title, `${V.passwords.rule}`, ...o.passwords.map((s) => `- ${s.text} (${s.by})`));
  return out.join('\n');
}

function planHtml(o) {
  const steps = (list) => `<ul>${list.map((s) => `<li>${esc(s.text)} <span class="by">(${esc(s.by)})</span></li>`).join('')}</ul>`;
  const today = o.items.filter((i) => i.when === 'Today');
  const later = o.items.filter((i) => i.when !== 'Today');
  const facts = [
    ['Client', o.client],
    o.when ? ['When', o.when] : null,
    ['Visit length', `${o.length} minutes (planned: ${o.total})`],
    o.devices.length ? ['Devices', o.devices.join(', ')] : null,
    o.family ? ['Family or friend there', o.family] : null,
  ].filter(Boolean);
  const body = `<main>
<p class="muted">${esc(o.business || 'Tech help at home')}</p>
<h1>Visit plan for ${esc(o.client)}</h1>
<table>${facts.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
<div class="box"><strong>Visit rules</strong>${C.li(o.rules)}</div>
<h2>${esc(V.start.label)} (${V.start.minutes} min)</h2>${steps(o.start)}
${today.map((x) => `<h2>${esc(x.label)} (${x.minutes} min)</h2><p class="muted">They said: ${esc(x.from.join('; '))}</p>${steps(x.steps)}`).join('\n')}
<h2>${esc(V.end.label)} (${V.end.minutes} min)</h2>${steps(o.end)}
${later.length ? `<h2>Next visit</h2><ul>${later.map((x) => `<li>${esc(x.label)} (about ${x.minutes} min)</li>`).join('')}</ul>` : ''}
<h2>${esc(V.passwords.title)}</h2>
<p><strong>${esc(V.passwords.rule)}</strong></p>${steps(o.passwords)}
<footer>Steps from ${esc(text.list(o.publishers))} pages, checked ${esc(V.checked)}. Menu names can change with new versions. Steps marked "Our judgment" and the minutes are ours, not a source's.</footer>
</main>`;
  return files.htmlDoc({ title: `Visit plan for ${o.client}`, css: `${BASE_CSS}\nh1{font-size:26px}h2{font-size:18px;margin:22px 0 6px}`, body, description: `Visit plan for ${o.client}` });
}

function planVisitTool(N) {
  return {
    name: `${N.id}.plan_visit`,
    title: 'Plan the visit',
    description: 'A timed visit plan from the client\'s devices and what\'s not working: steps from Apple, Google, Microsoft, the FTC and CISA (or marked as our judgment), what waits for next visit, and the password manager steps the client does themselves.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        client: { type: 'string', maxLength: 120, title: "Client's name" },
        devices: { type: 'string', format: 'textarea', maxLength: 1000, title: 'Their devices', description: 'One per line, like "iPhone 15" or "HP laptop with Windows 11"' },
        issues: { type: 'string', format: 'textarea', maxLength: 2000, title: "What's not working", description: 'One per line, in their words, most important first' },
        minutes: { type: 'integer', minimum: VISIT_MIN, maximum: VISIT_MAX, default: VISIT_DEFAULT, title: 'Visit length in minutes' },
        when: { type: 'string', maxLength: 60, title: 'Visit day and time (optional)' },
        family: { type: 'string', maxLength: 120, title: 'Family member or friend there (optional)' },
        after: { type: 'boolean', default: false, title: 'After the visit (skips the plan)' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
      },
    },
    output: {
      type: 'object',
      required: ['items', 'text', 'total'],
      properties: { items: { type: 'array' }, text: { type: 'string' }, total: { type: 'integer' }, later: { type: 'integer' }, file: { type: 'object' }, passwords: { type: 'array' }, rules: { type: 'array' }, sources: { type: 'array' }, skipped: { type: 'boolean' } },
    },
    async run(input, ctx) {
      const client = clip(plain(input.client || ''), 80) || 'your client';
      if (isOn(input.after)) return { skipped: true, items: [], text: '', total: 0, client };
      const issueLines = C.linesOf(input.issues, MAX_LINES);
      if (!issueLines.length) throw new Error("Add what's not working, one per line, and you get a visit plan.");
      const me = C.who(ctx, input);
      const n = parseInt(input.minutes, 10);
      const length = Number.isFinite(n) ? Math.min(VISIT_MAX, Math.max(VISIT_MIN, n)) : VISIT_DEFAULT;
      const fam = familiesOf(input.devices, input.issues);
      const items = schedule(itemsOf(issueLines, fam), length);
      const start = stepsFor(V.start.steps, fam);
      const end = stepsFor(V.end.steps, fam);
      const passwords = stepsFor(V.passwords.steps, fam);
      const today = items.filter((x) => x.when === 'Today');
      const total = V.start.minutes + V.end.minutes + today.reduce((s, x) => s + x.minutes, 0);
      const used = [...start, ...end, ...passwords, ...items.flatMap((x) => x.steps)].flatMap((s) => s.src);
      const sources = [...new Set(used)].map((id) => V.sources[id]).filter(Boolean).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says }));
      const devices = C.linesOf(input.devices, MAX_LINES);
      const o = {
        client,
        when: plain(input.when || ''),
        length,
        total,
        devices: devices.length ? devices : fam.labels,
        family: clip(plain(input.family || ''), 120),
        items,
        start,
        end,
        passwords,
        rules: N.safety || [],
        business: me.business,
        publishers: [...new Set(sources.map((s) => s.publisher))],
      };
      const date = time.today(ctx);
      const file = await save.saveFile(ctx, save.fileName(firstName(client) || 'client', 'visit plan', date, '.html'), planHtml(o));
      const notes = [];
      if (fam.all) notes.push('No devices typed, so the plan shows the steps for every kind of device. Add their devices to get only theirs.');
      if (items.some((x) => x.when !== 'Today')) notes.push(`More than fits in ${length} minutes: the items marked Next visit wait, so nothing is rushed.`);
      if (total > length) notes.push(`The first item alone runs past ${length} minutes: do what you can and finish it next time.`);
      if (items.some((x) => x.id.startsWith('other:'))) notes.push('Items we have no sourced steps for are marked "Our judgment": look at the device together first.');
      return {
        client,
        items: items.map((x) => ({ id: x.id, label: x.label, minutes: x.minutes, when: x.when, from: x.from, steps: x.steps.map((s) => ({ text: s.text, by: s.by })) })),
        total,
        later: items.filter((x) => x.when !== 'Today').length,
        text: planText(o),
        file,
        passwords: passwords.map((s) => ({ text: s.text, by: s.by })),
        rules: o.rules,
        notes,
        sources,
        skipped: false,
      };
    },
    view(out) {
      if (out.skipped) return views.blocks(views.text('After the visit: no plan this time. The visit note is below.'));
      const today = out.items.filter((x) => x.when === 'Today').length;
      return views.blocks(
        views.metric('Visit plan', `${out.total} minutes`, `${today} ${today === 1 ? 'thing' : 'things'} today${out.later ? `, ${out.later} for next visit` : ''}, plus hello, the scam card and the note`),
        views.text(`Visit rules: ${out.rules.join(' ')}`),
        views.table(
          [
            { key: 'label', label: 'What' },
            { key: 'minutes', label: 'Minutes', format: 'number' },
            { key: 'when', label: 'When' },
          ],
          out.items,
        ),
        views.copy('Visit plan, ready to print or keep on your phone', out.text),
        (out.notes || []).map((x) => views.text(x)),
        views.file(out.file, 'Visit plan (print it)'),
        out.sources.map((s) => views.link(`${s.publisher}: ${s.says}`, s.url)),
      );
    },
  };
}

// ---------- the scam warning card ----------

const CARD_CSS = `body{font-family:Inter,Arial,sans-serif;color:#1d2433;margin:0;background:#f6f7f9;font-size:19px;line-height:1.45}
main{max-width:820px;margin:20px auto;background:#fff;border-radius:14px;padding:28px 32px 20px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
h1{font-size:32px;margin:0 0 4px}.intro{font-size:20px;margin:0 0 10px;color:#3b4250}
h2{font-size:21px;margin:16px 0 6px;color:#1d5c63;border-bottom:2px solid #dcebec;padding-bottom:3px}
ul{margin:0;padding-left:24px}li{margin:5px 0}section{break-inside:avoid}
.trusted p{margin:6px 0;border-bottom:1px solid #9aa3b2;min-height:30px}
footer{margin-top:16px;font-size:14px;color:#5b6475}
@media (min-width:800px){.cols{column-count:2;column-gap:32px}}
@media (max-width:520px){main{margin:0;border-radius:0;padding:20px 16px}body{font-size:18px}h1{font-size:28px}}
@media print{body{background:#fff;font-size:14.5px}main{box-shadow:none;margin:0;padding:0;max-width:none}h1{font-size:24px}.intro{font-size:15px}h2{font-size:16px;margin:10px 0 4px}li{margin:3px 0}.cols{column-count:2;column-gap:24px}@page{margin:0.45in}}`;

function cardHtml(o) {
  const sections = V.card.sections
    .map((s) => `<section><h2>${esc(s.title)}</h2><ul>${s.lines.map((l) => `<li>${esc(l.text)}</li>`).join('')}</ul></section>`)
    .join('\n');
  const trusted = [...o.trusted, ...Array(Math.max(0, V.card.trusted_blank - o.trusted.length)).fill('')]
    .map((t) => `<p>${t ? esc(t) : '&nbsp;'}</p>`)
    .join('');
  const body = `<main>
<h1>${esc(V.card.title)}</h1>
<p class="intro">${esc(V.card.intro)}</p>
<div class="cols">
${sections}
<section class="trusted"><h2>${esc(V.card.trusted_title)}</h2>${trusted}</section>
</div>
<footer>${esc(C.fill(V.card.footer, { checked: V.checked }))}${o.client ? ` Printed for ${esc(o.client)}, ${esc(o.date)}.` : ''}</footer>
</main>`;
  return files.htmlDoc({ title: V.card.title, css: CARD_CSS, body, description: 'Scam warning card from the FTC\'s consumer advice' });
}

function scamCardTool(N) {
  return {
    name: `${N.id}.make_scam_card`,
    title: 'Scam warning card',
    description: 'A printable scam warning card in large type: what real companies never do, what only scammers say, what to do, what to do if it already happened, and where to report and get help, every line from the FTC, the FBI\'s IC3, the Justice Department, AARP or Microsoft.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      properties: {
        client: { type: 'string', maxLength: 120, title: "Client's name (optional)" },
        trusted: { type: 'string', format: 'textarea', maxLength: 300, title: 'People they trust (optional)', description: 'Only names and numbers the client gives you, one per line. Left empty, the card has blank lines to fill in by hand.' },
        after: { type: 'boolean', default: false, title: 'After the visit (skips the card)' },
      },
    },
    output: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, file: { type: 'object' }, sources: { type: 'array' }, lines: { type: 'integer' }, skipped: { type: 'boolean' } } },
    async run(input, ctx) {
      if (isOn(input.after)) return { skipped: true, text: '' };
      const client = firstName(input.client);
      const trusted = C.linesOf(input.trusted, V.card.trusted_blank).map((t) => clip(t, 60));
      const date = time.longDate(time.today(ctx));
      const file = await save.saveFile(ctx, save.fileName(client || 'client', 'scam card', '.html'), cardHtml({ client, trusted, date }));
      const lines = V.card.sections.flatMap((s) => s.lines);
      const ids = [...new Set(lines.flatMap((l) => l.src))];
      const textOut = [
        V.card.title,
        V.card.intro,
        ...V.card.sections.flatMap((s) => ['', s.title, ...s.lines.map((l) => `- ${l.text}`)]),
        '',
        V.card.trusted_title,
        ...(trusted.length ? trusted.map((t) => `- ${t}`) : ['- ', '- ']),
      ].join('\n');
      return {
        text: textOut,
        file,
        lines: lines.length,
        sources: ids.map((id) => V.sources[id]).filter(Boolean).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says })),
        skipped: false,
      };
    },
    view(out) {
      if (out.skipped) return views.blocks();
      return views.blocks(
        views.file(out.file, 'Scam warning card (print it in large type and leave it by the phone)'),
        views.text(`${out.lines} lines, each from the FTC, the FBI's IC3, the Justice Department, AARP or Microsoft. Nothing on it about you or your prices.`),
        views.copy('The card as text', out.text),
        out.sources.map((s) => views.link(`${s.publisher}: ${s.says}`, s.url)),
      );
    },
  };
}

// ---------- the after-visit note ----------

// A line that looks like a password, a code or an account number never goes in a note.
const SECRET = /\b(pass(?:word|code|phrase)?|pwd|pin|log ?in|sign-?in|user ?name|security code|verification code|wi-?fi key)\b\s*(?:is|was|:|=|-)\s*(?!(?:on|in|at|saved|stored|kept|written|now|the|your|their|set|changed|updated|reset|turned|still|a|an)\b)\S+/i;
const ACCOUNT = /\b(?:account|acct|card|routing)\s*(?:number|no\.?|#)?\s*(?:is|:|=|-)?\s*\d{4,}/i;
const LONG_NUMBER = /\d(?:[\s-]?\d){12,}/;
const looksSecret = (line) => SECRET.test(line) || ACCOUNT.test(line) || LONG_NUMBER.test(line);

function noteHtml(o) {
  const list = (title, items) => (items.length ? `<h2>${esc(title)}</h2><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const body = `<main>
<p class="muted">${esc(o.business || 'Tech help at home')}, ${esc(o.date)}</p>
<h1>Visit note for ${esc(o.greet)}</h1>
${list('What we did', o.done)}
${list('To practice before next time', o.practice)}
${list('Left for next time', o.left)}
${o.next ? `<p><strong>${esc(C.fill(V.note.next, { next: o.next }))}</strong></p>` : ''}
<div class="box">${esc(V.note.safety)}</div>
<footer>${esc(o.sign)}</footer>
</main>`;
  return files.htmlDoc({ title: `Visit note for ${o.greet}`, css: `${BASE_CSS}\nbody{font-size:19px}h1{font-size:28px}h2{font-size:20px;margin:20px 0 6px}`, body, description: `Visit note for ${o.greet}` });
}

function visitNoteTool(N) {
  return {
    name: `${N.id}.write_visit_note`,
    title: 'After-visit note',
    description: 'The note after a visit: what you did, what to practice and what is next, as a text and a printable page, with a family copy only when the client says okay. A line that looks like a password or an account number is left out.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      required: ['client'],
      properties: {
        client: { type: 'string', maxLength: 120, title: "Client's name" },
        done: { type: 'string', format: 'textarea', maxLength: 1500, title: 'What you did today', description: 'One per line, in plain words. Never a password.' },
        practice: { type: 'string', format: 'textarea', maxLength: 1000, title: 'What to practice (optional)' },
        left: { type: 'string', format: 'textarea', maxLength: 1000, title: 'Left for next time (optional)' },
        next_visit: { type: 'string', maxLength: 60, title: 'Next visit day and time (optional)' },
        family: { type: 'string', maxLength: 120, title: 'Family member to copy (optional, with the client\'s okay)' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
      },
    },
    output: { type: 'object', required: ['text', 'removed'], properties: { text: { type: 'string' }, family_text: { type: 'string' }, file: { type: 'object' }, removed: { type: 'integer' }, to: { type: 'string' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const greet = firstName(input.client) || 'there';
      let removed = 0;
      const clean = (v) =>
        C.linesOf(v, 20).filter((l) => {
          if (!looksSecret(l)) return true;
          removed += 1;
          return false;
        });
      const done = clean(input.done).map(sentence);
      if (!done.length) throw new Error(removed ? 'Every line looked like a password or an account number, so nothing was written. Describe the work in plain words, never the password itself.' : 'Add what you did today, one per line, and you get the note to send.');
      const practice = clean(input.practice).map(sentence);
      const left = clean(input.left).map(sentence);
      const next = plain(clean(input.next_visit).join(' '));
      const date = time.longDate(time.today(ctx));
      const sign = me.first || me.business || N.keep.business_fallback || 'Your tech helper';
      const bullets = (items) => items.map((x) => `- ${x}`);
      const bodyLines = [
        ...bullets(done),
        ...(practice.length ? ['', V.note.practice, ...bullets(practice)] : []),
        ...(left.length ? ['', V.note.left, ...bullets(left)] : []),
        ...(next ? ['', C.fill(V.note.next, { next })] : []),
        '',
        V.note.safety,
        '',
        sign,
      ];
      const textOut = [C.fill(V.note.hello, { greet, day: 'today' }), ...bodyLines].join('\n');
      const family = firstName(input.family);
      const familyText = family ? [C.fill(V.note.family_hello, { family, greet }), '', ...bodyLines].join('\n') : '';
      const file = await save.saveFile(ctx, save.fileName(greet, 'visit note', time.today(ctx), '.html'), noteHtml({ greet, date, done, practice, left, next, sign, business: me.business }));
      return { to: greet, text: textOut, ...(familyText ? { family_text: familyText, family } : {}), file, removed };
    },
    view(out) {
      return views.blocks(
        out.removed ? views.text(`${V.note.removed} (${out.removed} ${out.removed === 1 ? 'line' : 'lines'})`) : null,
        views.copy(`Note to ${out.to} (send it today)`, out.text),
        out.family_text ? views.copy(`Copy for ${out.family}, only with ${out.to}'s okay`, out.family_text) : null,
        views.file(out.file, 'Visit note (print it or send it)'),
      );
    },
  };
}

module.exports = { planVisitTool, scamCardTool, visitNoteTool, familiesOf, itemsOf, looksSecret };
