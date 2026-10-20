// Lesson plan and practice log, the music pack's own tool. Instrument, level and age give the first 4
// weeks of lessons (each lesson in timed parts), a printable practice log for home and a studio policy
// page the parent signs: missed lessons and makeups, payment, stopping, recitals, and the safety rules
// for students under 18. Three printable pages and the text that sends them, to the parent for a
// student under 18, never to the student.
//
// What is sourced and what is judgment (data/niche.json lesson_plan, sources in
// research/niches/music.json): the auto lesson length follows Ensemble Schools and ArtMaster; the
// policy wording follows common studio policies (The Piano Education Page, The Playful Piano,
// Ensemble Schools) and the CDC's guidance for youth programs; the recital notes follow the U.S.
// Copyright Office (Circular 21) and 17 U.S.C. 110(4), and the fee split teachbassoon.com. The weekly
// plans, the lesson parts and the practice minutes are teaching judgment and say so. No promise of an
// exam result, an audition or a pace.

const { views, time, text, files, money } = require('../../_kit');
const C = require('../../_kit/common');
const save = require('../../_kit/save');

const { plain, clip } = text;
const { num, usd } = money;
const esc = files.esc;

const LENGTHS = ['Auto', '30 minutes', '45 minutes', '60 minutes'];
const BILLING = ['Monthly, in advance', 'Per lesson', 'By term, in advance'];

const CSS = `${C.SHEET_CSS}
.facts td:first-child{color:#5b6475;width:34%}
.week{border:1px solid #e3e6eb;border-radius:12px;padding:12px 16px;margin:12px 0;break-inside:avoid}
.week h3{margin:0 0 6px;font-size:16px}.week p{margin:6px 0;line-height:1.5}
.k{display:block;color:#5b6475;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
table.log{margin-top:6px}table.log td{height:30px}table.log th:nth-child(2),table.log td:nth-child(2){width:64px}
table.log th:last-child,table.log td:last-child{width:46px;text-align:center}
.tick{display:inline-block;width:16px;height:16px;border:2px solid #5b6475;border-radius:4px}
.logweek{break-inside:avoid;margin-bottom:18px}.after{font-size:14px;line-height:2.2;margin:8px 0 0}
.blank{display:inline-block;min-width:96px;height:1.2em;border-bottom:1px solid #1d2433;vertical-align:bottom}.blank.wide{min-width:200px}
.sign td{height:34px}.sign td:first-child{color:#5b6475;width:34%}
@media (max-width:600px){main{margin:0;border-radius:0;padding:20px 16px}h1{font-size:24px}}
@media print{.pagebreak{break-before:page}}`;

// Lesson length when the member leaves it on Auto (Ensemble Schools, ArtMaster): 30 minutes for anyone
// new and for younger students with the basics, longer as students grow older and more experienced.
function autoLength(level, age) {
  if (level === 'new') return 30;
  if (level === 'basics') return age < 13 ? 30 : 45;
  return age < 13 ? 45 : 60;
}

const sentence = (s) => C.sentence(s);
const rows = (pairs) => pairs.filter(Boolean).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
const ul = (items) => C.li(items.filter(Boolean));
const shortDay = (d) => time.shortDate(d).replace(/^\w+, /, '');
const sameName = (lead, name) => [lead.name, lead.company].some((n) => !!C.norm(n) && C.norm(n) === C.norm(name));

function planHtml(o) {
  const head = [
    ['Lessons', `${o.minutes} minutes, one to one${o.when ? `, ${o.when}` : ''}`],
    o.where ? ['Where', o.where] : null,
    o.start ? ['First lesson', time.shortDate(o.start)] : null,
    ['Practice at home', `${o.practice} minutes a day, ${o.days} days a week, noted in the practice log`],
    o.goal ? ['Goal', o.goal] : null,
    o.minor ? ['Parents', o.parentRole] : null,
  ];
  const weeks = o.weeks
    .map((w) => `<div class="week"><h3>${esc(w.week)}: ${esc(w.focus)}</h3><p><span class="k">In the lesson</span>${esc(sentence(w.lesson))}</p><p><span class="k">At home</span>${esc(sentence(w.home))}</p></div>`)
    .join('\n');
  const body = `<main>
<p class="muted">${esc(o.business)}</p>
<h1>${esc(o.title)}</h1>
<p class="muted">${esc(`${o.level}, age ${o.age}`)}</p>
<table class="facts">${rows(head)}</table>
<h2>Every lesson</h2>
<table><tr><th>Part</th><th>Minutes</th></tr>${o.parts.map((p) => `<tr><td>${esc(p.part)}</td><td>${p.minutes}</td></tr>`).join('')}</table>
<h2>Week by week</h2>
${weeks}
<h2>Have ready</h2>
${ul(o.setup)}
<footer>${esc(o.minor ? `We go at ${o.student}'s pace: the plan changes to fit what ${o.student} needs.` : 'We go at your pace: the plan changes to fit what you need.')} ${esc(o.sign)}</footer>
</main>`;
  return files.htmlDoc({ title: o.title, css: CSS, body, description: o.title });
}

function logHtml(o) {
  const weeks = o.weeks
    .map((w, i) => {
      const days = Array.from({ length: 7 }, (_, d) => {
        if (!w.from) return d === 0 ? 'Day 1 (lesson day)' : `Day ${d + 1}`;
        const day = time.shortDate(time.addDays(w.from, d));
        return d === 0 ? `${day} (lesson day)` : day;
      });
      const range = w.from ? ` (${shortDay(w.from)} to ${shortDay(time.addDays(w.from, 6))})` : '';
      return `<section class="logweek${i === 2 ? ' pagebreak' : ''}">
<h2>Week ${i + 1}${esc(range)}</h2>
<p class="muted">${esc(`This week at home: ${sentence(w.home)}`)}</p>
<table class="log"><tr><th>Day</th><th>Minutes</th><th>What I practiced</th><th>Done</th></tr>
${days.map((d) => `<tr><td>${esc(d)}</td><td></td><td></td><td><span class="tick"></span></td></tr>`).join('\n')}
</table>
<p class="after">Total minutes: <span class="blank"></span>${o.minor ? '<br>Parent initials: <span class="blank"></span>' : ''}<br>A question for my next lesson: <span class="blank wide"></span></p>
</section>`;
    })
    .join('\n');
  const title = `${o.possessive} practice log: ${o.word}`;
  const body = `<main>
<p class="muted">${esc(o.business)}</p>
<h1>${esc(title)}</h1>
<p>${esc(`Goal: ${o.practice} minutes a day, ${o.days} days a week. Fill in a line each day you practice, and bring this log to every lesson.`)}</p>
${weeks}
<footer>${esc(o.minor ? 'A parent initials each week. ' : '')}${esc(o.sign)}</footer>
</main>`;
  return files.htmlDoc({ title, css: CSS, body, description: title });
}

function policyHtml(o) {
  const sections = o.policy.map((s) => `<h2>${esc(s.title)}</h2>\n${ul(s.lines)}`).join('\n');
  const body = `<main>
<p class="muted">${esc(o.business)}</p>
<h1>${esc(o.policyTitle)}</h1>
<p class="muted">${esc(`${o.forLine}. Updated ${time.longDate(o.today)}.`)}</p>
${sections}
<h2>Signed</h2>
<p>${esc(o.signLine)}</p>
<table class="sign">${rows([[o.minor ? 'Parent or guardian' : 'Student', ''], ['Signature', ''], ['Date', ''], ['Teacher', o.teacher]])}</table>
<footer>${esc(`Questions about this policy? ${o.phone ? `Call or text ${o.phone} before you sign.` : 'Ask me before you sign.'}`)}</footer>
</main>`;
  return files.htmlDoc({ title: o.policyTitle, css: CSS, body, description: `${o.policyTitle}: ${o.forLine}` });
}

function lessonPlanTool(N) {
  const P = N.lesson_plan;
  const pol = P.policy;
  const instruments = P.instruments.map((x) => x.label);
  const levels = P.levels.map((x) => x.label);
  return {
    name: `${N.id}.plan_lessons`,
    title: 'Lesson plan and practice log',
    description: 'Instrument, level and age give the first 4 weeks of lessons in timed parts, a printable practice log for home and a studio policy page for missed lessons, payment and recitals, with the text that sends them to the parent.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['student', 'age'],
      properties: {
        student: { type: 'string', maxLength: 40, title: "Student's first name" },
        parent: { type: 'string', maxLength: 120, title: "Parent's name (or the adult student's)", description: 'For students under 18, the text goes to the parent, never the student' },
        age: { type: 'integer', minimum: 3, maximum: 100, title: "Student's age" },
        instrument: { type: 'string', enum: instruments, default: instruments[0], title: 'Instrument' },
        other: { type: 'string', maxLength: 40, title: 'Other instrument (when you picked Other)', description: 'Like "cello" or "flute"' },
        level: { type: 'string', enum: levels, default: levels[0], title: 'Level' },
        length: { type: 'string', enum: LENGTHS, default: 'Auto', title: 'Lesson length', description: 'Auto: 30 minutes for anyone new, longer for older and more experienced students' },
        when: { type: 'string', maxLength: 60, title: 'Lesson day and time (optional)', description: 'Like "Tuesdays at 4pm"' },
        start: { type: 'string', format: 'date', title: 'First lesson date (optional)', description: 'Dates the 4 weeks and the practice log' },
        where: { type: 'string', enum: N.win.where, default: N.win.where[0], title: 'Where lessons happen' },
        goal: { type: 'string', maxLength: 200, title: "Something they'd love to play (optional)", description: 'Like "the theme from their favorite movie"' },
        practice: { type: 'integer', minimum: 5, maximum: 60, title: 'Practice minutes a day (optional)', description: 'Left empty: 10 under age 8, 15 for ages 8 to 12, 20 from 13' },
        days: { type: 'integer', minimum: 1, maximum: 7, default: P.days, title: 'Practice days a week' },
        rate: { type: 'string', maxLength: 10, title: 'Their price per lesson (optional)', description: 'Left empty: the price logged for them in your Pipeline' },
        billing: { type: 'string', enum: BILLING, default: BILLING[0], title: 'Studio policy: tuition is paid' },
        late_fee: { type: 'string', maxLength: 10, title: 'Studio policy: late fee (optional)', description: 'Like "$10". Left empty, no late fee' },
        notice: { type: 'string', enum: ['24 hours', '48 hours'], default: '24 hours', title: 'Studio policy: notice to cancel' },
        makeups: { type: 'integer', minimum: 0, maximum: 4, default: 2, title: 'Studio policy: makeup lessons a term', description: '0 means missed lessons are not made up' },
        stop: { type: 'string', enum: ['2 weeks', '1 month'], default: '1 month', title: 'Studio policy: notice to stop lessons' },
        background: { type: 'boolean', default: false, title: 'I have a background check report to share' },
        recital: { type: 'boolean', default: false, title: 'Add a recital section' },
        recital_when: { type: 'string', maxLength: 60, title: 'Recital date (optional)', description: 'Like "Saturday, May 16"' },
        recital_fee: { type: 'string', maxLength: 10, title: 'Recital fee per student (optional)', description: 'Left empty: the costs below divided by the students performing' },
        venue_cost: { type: 'string', maxLength: 10, title: 'Recital venue cost (optional)' },
        other_costs: { type: 'string', maxLength: 10, title: 'Other recital costs (optional)', description: 'Programs, an accompanist, a sound tech' },
        performers: { type: 'integer', minimum: 1, maximum: 300, title: 'Students performing (optional)' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
      },
    },
    output: {
      type: 'object',
      required: ['weeks', 'plan', 'log', 'policy', 'text'],
      properties: {
        student: { type: 'string' },
        to: { type: 'string' },
        instrument: { type: 'string' },
        level: { type: 'string' },
        age: { type: 'integer' },
        minutes: { type: 'integer' },
        practice: { type: 'integer' },
        days: { type: 'integer' },
        weeks: { type: 'array' },
        parts: { type: 'array' },
        plan: { type: 'object' },
        log: { type: 'object' },
        policy: { type: 'object' },
        text: { type: 'string' },
        recital: { type: 'object' },
        notes: { type: 'array' },
        sources: { type: 'array' },
        saved: { type: 'object' },
      },
    },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const student = C.firstWord(input.student);
      if (!student) throw new Error("Add the student's first name to make the plan.");
      const age = Math.round(num(input.age, 0));
      if (!(age >= 3 && age <= 100)) throw new Error("Add the student's age (3 to 100): it sets the lesson length, the practice time and the parent's part.");
      const minor = age < 18;
      const ins = P.instruments.find((x) => x.label === input.instrument || x.id === input.instrument) || P.instruments[0];
      const other = clip(plain(input.other || ''), 40).toLowerCase();
      const insWord = ins.id === 'other' ? other || 'instrument' : ins.word;
      const word = ins.id === 'other' ? other || 'music' : ins.word;
      const level = P.levels.find((x) => x.label === input.level || x.id === input.level) || P.levels[0];
      const band = P.ages.find((a) => age < a.below) || P.ages[P.ages.length - 1];
      const typed = parseInt(String(input.length || ''), 10);
      const auto = ![30, 45, 60].includes(typed);
      const minutes = auto ? autoLength(level.id, age) : typed;
      const practice = C.clamp(Math.round(num(input.practice, 0)) || band.practice, 5, 60);
      const days = C.clamp(Math.round(num(input.days, 0)) || P.days, 1, 7);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) ? String(input.start) : '';
      const where = N.win.where.includes(input.where) ? input.where : N.win.where[0];
      const when = clip(plain(input.when || ''), 60);
      const goal = text.sentenceCase(clip(plain(input.goal || ''), 200));
      const today = time.today(ctx);
      const v = { instrument: insWord };
      const weeks = ins.weeks[level.id].map((w, i) => {
        const from = start ? time.addDays(start, 7 * i) : '';
        return { week: from ? `Week ${i + 1} (${time.shortDate(from)})` : `Week ${i + 1}`, from, focus: C.fill(w.focus, v), lesson: C.fill(w.lesson, v), home: C.fill(w.home, v) };
      });
      const parts = (P.parts[String(minutes)] || P.parts['30']).map(([part, m]) => ({ part, minutes: m }));
      const setup = ins.setup.map((s) => C.fill(s, v));

      // Who the text goes to: the parent for a student under 18, the student from 18.
      const parentName = clip(plain(input.parent || ''), 120);
      const parent = C.firstWord(parentName);
      const adult = !minor;
      const to = adult ? student : parent || 'the parent';
      // Their own Pipeline row, only on an exact name: its logged price goes on the policy.
      const rowName = adult ? parentName || student : parentName;
      const found = rowName ? await C.findLead(ctx, N.id, rowName) : null;
      const lead = found && C.isOwn(found, N.id) && sameName(found, rowName) ? found : null;
      const own = !!lead;
      const deal = own && lead.data && lead.data.deal ? lead.data.deal : null;

      // The studio policy, section by section, from the member's choices.
      const billing = BILLING.includes(input.billing) ? input.billing : BILLING[0];
      const rate = num(input.rate, null) || (deal && num(deal.each, null)) || null;
      const lateFee = num(input.late_fee, null);
      const notice = input.notice === '48 hours' ? '48 hours' : '24 hours';
      const makeups = C.clamp(Math.round(num(input.makeups, 2)), 0, 4);
      const stop = input.stop === '2 weeks' ? '2 weeks' : 'a month';
      const policy = [
        { title: 'Lessons', lines: [pol.lessons, `Length: ${minutes} minutes${when ? `, ${when}` : ''}.`, `Where: ${where}.`] },
        {
          title: 'Tuition and payment',
          lines: [rate ? `Tuition: ${usd(rate)} per lesson, as booked.` : 'Tuition: the price per lesson we agreed in writing.', pol.pay[billing], lateFee && lateFee > 0 ? C.fill(pol.late[billing], { late_fee: usd(lateFee) }) : ''],
        },
        { title: 'Missed lessons and makeups', lines: [C.fill(pol.notice, { notice }), makeups ? C.fill(pol.makeups, { makeups }) : pol.no_makeups, pol.late_cancel, pol.sick] },
        { title: 'If I cancel', lines: [pol.teacher, N.offer.promise] },
        { title: 'Stopping lessons', lines: [C.fill(pol.stop, { stop })] },
      ];

      // Recitals: the fee per student is typed, or the costs divided by the students performing,
      // rounded up (teachbassoon.com). Performers play from purchased music (Circular 21).
      let recital = null;
      if (input.recital === true || input.recital === 'true') {
        const venue = num(input.venue_cost, 0) || 0;
        const extras = num(input.other_costs, 0) || 0;
        const performers = Math.round(num(input.performers, 0)) || 0;
        const typedFee = num(input.recital_fee, null);
        const costs = venue + extras;
        let fee = typedFee && typedFee > 0 ? Math.round(typedFee * 100) / 100 : null;
        let split = '';
        if (!fee && costs > 0 && performers > 0) {
          fee = Math.ceil(costs / performers);
          split = `Recital fee: ${usd(costs)} in costs divided by ${performers} students is ${usd(Math.round((costs / performers) * 100) / 100)}, rounded up to ${usd(fee)} per student.`;
        }
        const rwhen = clip(plain(input.recital_when || ''), 60);
        recital = { fee: fee || 0, fee_text: fee ? usd(fee) : '', costs, performers, split, when: rwhen };
        policy.push({
          title: 'Recitals',
          lines: [rwhen ? C.fill(pol.recital_next, { when: rwhen }) : pol.recital_usual, pol.recital_choice, fee ? C.fill(pol.recital_fee, { fee: usd(fee) }) : '', pol.recital_music, pol.recital_guests],
        });
      }
      const background = input.background === true || input.background === 'true';
      if (minor) policy.push({ title: pol.safety_title, lines: [...pol.safety, background ? pol.background : ''] });
      else policy.push({ title: 'Photos and messages', lines: [...pol.photos_adult, background ? pol.background : ''] });

      const sign = [me.first, me.business && me.business !== me.first ? me.business : '', me.phone].filter(Boolean).join(', ') || 'Your music teacher';
      const possessive = C.possessive(student);
      const o = {
        business: me.business || me.first || N.name,
        sign,
        student,
        possessive,
        word,
        title: `${possessive} plan: the first 4 weeks of ${word} lessons`,
        level: level.label,
        age,
        minutes,
        when,
        where,
        start,
        practice,
        days,
        goal,
        minor,
        parentRole: band.parent,
        weeks,
        parts,
        setup,
        policy: policy.map((s) => ({ title: s.title, lines: s.lines.filter(Boolean) })),
        policyTitle: pol.title,
        forLine: `For ${possessive} ${word} lessons`,
        signLine: pol.sign,
        teacher: me.first || me.business || '',
        phone: me.phone,
        today,
      };
      const slug = (s) => save.fileName(student, word, s, '.html');
      const plan = await save.saveFile(ctx, slug('4 week plan'), planHtml(o));
      const log = await save.saveFile(ctx, slug('practice log'), logHtml(o));
      const policyFile = await save.saveFile(ctx, slug('studio policy'), policyHtml(o));

      const what = `my studio policy for missed lessons, payment${recital ? ' and recitals' : ''}`;
      const signOff = me.first || me.business || '';
      const message = adult
        ? `Hi ${student}, here's your plan for the first 4 weeks of ${word} lessons, a practice log (${practice} minutes, ${days} days a week) and ${what}. Bring the log to every lesson. Questions? Just reply. ${signOff}`
        : `Hi ${parent || 'there'}, here's ${possessive} plan for the first 4 weeks of ${word} lessons, a practice log for home (${practice} minutes, ${days} days a week) and ${what}. Please print the log, initial it each week and send it to every lesson. Questions? Just reply. ${signOff}`;

      const notes = [];
      if (minor && !parent) notes.push("Add the parent's name: for students under 18, the plan and every message go to the parent, never to the student.");
      if (auto) notes.push(P.length_note);
      notes.push(P.judgment_note);
      if (recital) {
        if (recital.split) notes.push(recital.split);
        else if (!recital.fee) notes.push('Add the venue cost and the number of students performing to work out a recital fee per student, or type the fee. Check current rates for venues near you.');
        notes.push(P.notes.recital_range, P.notes.music_copies, P.notes.performance);
      }
      notes.push(P.notes.check);
      const sources = P.sources.filter((s) => s.for !== 'recital' || recital).map((s) => ({ publisher: s.publisher, url: s.url, says: s.says }));
      if (ins.id === 'drums') sources.push({ publisher: P.drums_source.publisher, url: P.drums_source.url, says: P.drums_source.says });

      // Saved on their own Pipeline row, so the lesson note knows the instrument.
      let saved = { saved: false };
      if (own) saved = await C.saveLead(ctx, N.id, lead, { data: { plan: { instrument: insWord, level: level.id, minutes, practice, days, start, on: today } } }, { name: lead.name });

      return {
        student,
        to,
        instrument: ins.id === 'other' ? text.sentenceCase(other || 'other') : ins.label,
        level: level.label,
        age,
        minutes,
        practice,
        days,
        weeks: weeks.map((w) => ({ week: w.week, focus: w.focus, lesson: w.lesson, home: w.home })),
        parts,
        plan,
        log,
        policy: policyFile,
        text: C.fill(message, {}),
        ...(recital ? { recital } : {}),
        notes,
        sources,
        saved,
      };
    },
    view(out) {
      const s = out.saved || {};
      return views.blocks(
        views.metric('First 4 weeks', `${out.minutes}-minute lessons`, `${out.instrument}, ${out.level.toLowerCase()}, age ${out.age}. Practice: ${out.practice} minutes, ${out.days} days a week`),
        views.table(
          [
            { key: 'week', label: 'Week' },
            { key: 'focus', label: 'Focus' },
            { key: 'lesson', label: 'In the lesson' },
            { key: 'home', label: 'At home' },
          ],
          out.weeks,
        ),
        views.file(out.plan, 'The 4-week plan (print it)'),
        views.file(out.log, 'Practice log (print it for home)'),
        views.file(out.policy, 'Studio policy (print it to sign)'),
        views.copy(`Text to ${out.to}`, out.text),
        s.saved ? views.text(`Saved the plan on ${out.to}'s row in your Pipeline, so lesson notes know the instrument.`) : null,
        out.notes.map((x) => views.text(x)),
        out.sources.map((x) => views.link(`${x.publisher}: ${x.says}`, x.url)),
      );
    },
  };
}

module.exports = { lessonPlanTool, autoLength, sameName };
