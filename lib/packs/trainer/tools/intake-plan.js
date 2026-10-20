// The personal training signature tool (Legal L72). The client fills in the official PAR-Q+ (from the
// PAR-Q+ Collaboration) on paper. This tool keeps one word of it, Go, Hold or Not done yet, with the
// date it was filled in and the redo-by date the trainer types (12 months after the form, or 6 after a
// doctor's clearance: 127 never learns which kind of go it was, so it never works the date out). Every
// run makes a printable intake sheet and a next steps page:
// - Go: the message to send, the common notes (start slowly, low to moderate effort, any precautions
//   from a clearance) and a dated 4-week session plan with a session log, ready to print.
// - Hold: all three hold messages (a short illness, check with your doctor, the ePARmed-X+ next step)
//   for the trainer to pick from. No plan.
// - Not done yet: a line asking them to fill in the PAR-Q+ first. No plan.
// A Go past its redo-by date asks for the PAR-Q+ again. No medical advice and no result promises.
//
// Data minimization: no reason to wait is asked. Nothing about the result goes to the Pipeline, brain
// memory or any AI tool, and because the member's AI link reads a run's view, the view is the same
// whatever the result: the result, its messages and the plan live only in the two private files. The
// PAR-Q+ is named, never copied, retyped or linked (eparmedx.com is plain text only). Texts and rules
// live in data/niche.json `plan` (sources: research/niches/trainer.json).

const { views, files, save, time, text } = require('../../_kit');
const C = require('../../_kit/common');
const S = require('../lib/schedule');

const { plain, clip } = text;
const esc = files.esc;

const CSS = `${C.SHEET_CSS}
.row{display:flex;flex-wrap:wrap;gap:4px 16px;margin:6px 0}.f{flex:1 1 200px;font-size:13px;color:#5b6475}.f span{display:block;border-bottom:1px solid #9aa3b2;height:26px}
.blank{display:block;border-bottom:1px solid #9aa3b2;height:28px}.parq{border:2px solid #2a5bd7;border-radius:10px;padding:12px 16px;margin:16px 0}
.parq.hold{border-color:#b8460b;background:#fff8f3}.parq p{margin:6px 0}.note{background:#fff8e6;border-radius:10px;padding:10px 16px;margin:12px 0}
.trainer{border:2px dashed #9aa3b2;border-radius:10px;padding:12px 16px;margin:16px 0}.msg{background:#f5f7fb;border-radius:10px;padding:10px 14px;margin:10px 0}.msg p{margin:6px 0}
.scroll{overflow-x:auto}td,th{vertical-align:top}th{font-size:13px;color:#5b6475}table.log td{height:34px}.facts td:first-child{color:#5b6475;width:32%}
@media print{.trainer{display:none}}
@media (max-width:560px){main{margin:0;border-radius:0;padding:20px 16px}h1{font-size:23px}td,th{padding:7px 4px;font-size:14px}}`;

const GOAL_NUMBERS = /\b(lose|losing|lost|drop|shed)\b[^.!?]{0,30}\b(weight|pounds|lbs?|kilos?|kg|inches|sizes?|fat)\b|\b\d+\s?(pounds|lbs?|kilos?|kg|inches)\b|\bweight ?loss\b|\bdress size\b/i;

// "Tuesdays at 7am", "Friday mornings", "Mondays"
function dayPhrase(x) {
  const day = time.WEEKDAYS[x.day];
  if (!x.time) return `${day}s`;
  if (/\d|noon/.test(x.time)) return `${day}s at ${x.time}`;
  return `${day} ${x.time}s`;
}

// The redo-by date as the trainer typed it. Without a year, the first one after the form date: "Oct 19"
// for a form filled in on Oct 19, 2026 is Oct 19, 2027.
function redoDate(typed, formDate) {
  return S.parseDate(typed, time.addDays(formDate, 1));
}

function field(label, value = '') {
  return `<div class="f">${esc(label)}<span>${value ? esc(value) : ''}</span></div>`;
}

function rows(pairs) {
  const out = [];
  for (let i = 0; i < pairs.length; i += 2) out.push(`<div class="row">${field(...pairs[i])}${pairs[i + 1] ? field(...pairs[i + 1]) : ''}</div>`);
  return out.join('');
}

function table(columns, list, cls = '') {
  const head = columns.map(([, label]) => `<th>${esc(label)}</th>`).join('');
  const body = list.map((r) => `<tr>${columns.map(([key]) => `<td>${esc(r[key] == null ? '' : r[key])}</td>`).join('')}</tr>`).join('');
  return `<div class="scroll"><table${cls ? ` class="${cls}"` : ''}><tr>${head}</tr>${body}</table></div>`;
}

const list = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

// The client's sheet: printed and filled in by hand together. Only the result word and the dates.
function intakeHtml(N, o) {
  const P = N.plan;
  const parqRows = [
    ['Result', o.state === 'not_done' ? '' : o.result],
    ['Date filled in', o.parq.date_label],
    o.state === 'hold' ? null : ['Redo by', o.parq.redo_label],
  ].filter(Boolean);
  const wait = o.state === 'hold' || o.state === 'expired';
  // A first session date only when one can go ahead: on a Go, or with the PAR-Q+ still to do.
  const first = o.state === 'go' || o.state === 'not_done' ? o.first : '';
  const line = o.intake_line ? `<p>${wait ? `<strong>${esc(o.intake_line)}</strong>` : esc(o.intake_line)}</p>` : '';
  const body = `<main>
<p class="muted">${esc(o.me.business || N.name)}${o.me.phone ? `. Questions: ${esc(o.me.phone)}` : ''}</p>
<h1>Intake sheet: ${esc(o.client)}</h1>
<p>We fill this in together at the free consultation or before the first session. It stays private between us and is used only to plan and run your sessions.</p>
<div class="parq${wait ? ' hold' : ''}">
<strong>Health form</strong>
<p>${esc(P.parq_client)}</p>
<table class="facts">${parqRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v ? esc(v) : '<span class="blank"></span>'}</td></tr>`).join('')}</table>
${line}
</div>
<h2>Your details</h2>
${rows([['Name', o.client], ['Phone'], ['Email'], ['Address for sessions at home']])}
<h2>Emergency contact</h2>
${rows([['Name'], ['Phone'], ['Relationship'], ['Anything else I should know in an emergency']])}
<h2>Your goals, in your words</h2>
${o.goals ? `<p>${esc(o.goals)}</p>` : '<span class="blank"></span><span class="blank"></span>'}
<h2>When and where</h2>
<table class="facts">
<tr><td>Days and times</td><td>${o.days_text ? esc(o.days_text) : '<span class="blank"></span>'}</td></tr>
<tr><td>First session</td><td>${first ? esc(first) : '<span class="blank"></span>'}</td></tr>
<tr><td>Where</td><td>${esc(o.where)}</td></tr>
<tr><td>Session length</td><td>${esc(o.length)}</td></tr>
<tr><td>What to bring</td><td>${esc(C.sentence(text.sentenceCase(P.bring)))}</td></tr>
</table>
<h2>What I do and don't do</h2><p>${esc(P.scope)}</p>
<h2>If something hurts</h2><p>${esc(P.stop_client)}</p>
<h2>My promise</h2><div class="box">${esc(N.offer.promise)}</div>
<p class="muted">${esc(P.no_promise)}</p>
<h2>Signatures</h2>
${rows([['Client signature'], ['Date'], ['Trainer signature'], ['Date']])}
<footer>${esc(P.privacy)}</footer>
</main>`;
  return files.htmlDoc({ title: `Intake sheet for ${o.client}`, css: CSS, body, description: 'Personal training intake sheet' });
}

// The 4-week plan, for the client: what prints from the next steps page on a Go.
function planSection(N, o) {
  const P = N.plan;
  const log = o.sessions.length ? o.sessions.map((x, i) => ({ n: String(i + 1), date: S.dateLabel(x), a: '', b: '', c: '' })) : Array.from({ length: o.count }, (_, i) => ({ n: String(i + 1), date: '', a: '', b: '', c: '' }));
  return `<p>${esc(o.summary)}</p>
<div class="parq"><strong>PAR-Q+ (from the PAR-Q+ Collaboration)</strong><p>${esc(o.parq_line)}</p>${list(P.go_notes)}</div>
${o.goals ? `<h2>Your goals, in your words</h2><p>${esc(o.goals)}</p><p class="muted">${esc(P.no_promise)}</p>` : ''}
<h2>The 4 weeks</h2>
${table([['week', 'Week'], ['dates', 'Sessions'], ['sets', 'Sets'], ['focus', 'Focus']], o.weeks)}
<h2>Every session (${esc(o.length)})</h2>
${table([['part', 'Part'], ['minutes', 'Minutes'], ['what', 'What']], o.parts)}
<h2>The moves</h2>
${o.moves_line ? `<p>${esc(o.moves_line)}</p>` : ''}
${table([['move', 'Move'], ['start', 'Start here'], ['easier', 'Easier'], ['next', 'Next step']], o.moves)}
<p>${esc(o.equipment)}</p>
<div class="note"><strong>Pace.</strong> ${esc(P.pace)}</div>
<div class="note"><strong>Stop rule.</strong> ${esc(P.stop)}</div>
<h2>Session log</h2>
${table([['n', '#'], ['date', 'Date'], ['a', 'Check-in'], ['b', 'What we did'], ['c', 'How it felt']], log, 'log')}`;
}

// The trainer's page: the result, the message or messages to send, the next step and the notes, on
// screen only; on a Go the plan below them is what prints.
function nextStepsHtml(N, o) {
  const P = N.plan;
  const msgs = o.messages.map((m) => `<div class="msg"><strong>${esc(m.label)}</strong><p>${esc(m.text)}</p></div>`).join('');
  const trainer = `<div class="trainer">
<p class="muted">${esc(o.plan ? P.print_note : P.screen_note)}</p>
<p><strong>PAR-Q+ (from the PAR-Q+ Collaboration):</strong> ${esc(o.result_line)}</p>
${o.messages.length > 1 ? '<h2>Pick one message to send</h2>' : ''}${msgs}
<p><strong>Next:</strong> ${esc(o.next)}</p>
${o.notes.length ? `<h2>Notes</h2>${list(o.notes)}` : ''}
</div>`;
  const body = `<main>
<p class="muted">${esc(o.me.business || N.name)}</p>
<h1>${esc(o.plan ? `4-week plan: ${o.client}` : `Next steps: ${o.client}`)}</h1>
${trainer}
${o.plan ? planSection(N, o) : ''}
<footer>${esc(o.plan ? `${P.built_from} ${P.template_note}` : P.trainer_privacy)}</footer>
</main>`;
  return files.htmlDoc({ title: `Next steps for ${o.client}`, css: CSS, body, description: 'Personal training next steps' });
}

function planTool(N) {
  const P = N.plan;
  const RESULTS = P.results.map((x) => x.label);
  const WHERE = P.places.map((x) => x.id);
  const LENGTHS = Object.keys(P.lengths);
  const NOT_DONE = P.results.find((x) => x.id === 'not_done');
  return {
    name: `${N.id}.build_intake_plan`,
    title: 'Intake and 4-week plan',
    description: 'From one word of the PAR-Q+ (Go, Hold or Not done yet), its dates, their goals and your session days: a printable intake sheet, and next steps with a dated 4-week plan on a Go or the message to send. What the PAR-Q+ says stays in those two files.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['client'],
      properties: {
        client: { type: 'string', maxLength: 60, title: "Client's name" },
        parq: { type: 'string', enum: RESULTS, default: NOT_DONE.label, title: 'PAR-Q+ result', description: P.result_help },
        parq_date: { type: 'string', maxLength: 20, title: 'Date they filled it in (optional)', description: 'Like "Oct 19". Left empty, today.' },
        redo_by: { type: 'string', maxLength: 20, title: 'Redo by (needed for a Go)', description: `${P.redo_help} Like "Oct 19, 2027".` },
        goals: { type: 'string', format: 'textarea', maxLength: 600, title: 'Their goals, in their words (optional)', description: 'Goals only, nothing about their health. Like "carry the groceries up the stairs" or "keep up with my kids on hikes".' },
        days: { type: 'string', maxLength: 80, title: 'Session days and times', description: 'Like "Tue 7am, Fri 7am". Up to 3 days a week.' },
        start: { type: 'string', maxLength: 20, title: 'First session date (optional)', description: 'Like "Oct 27". Left empty, the next session day after today.' },
        where: { type: 'string', enum: WHERE, default: WHERE[0], title: 'Where you train' },
        level: { type: 'string', enum: P.levels, default: P.levels[0], title: 'How active they are now' },
        length: { type: 'string', enum: LENGTHS, default: LENGTHS.includes(N.offer.length) ? N.offer.length : LENGTHS[LENGTHS.length - 1], title: 'Session length' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
      },
    },
    output: {
      type: 'object',
      required: ['go', 'result', 'status', 'messages', 'next', 'intake', 'next_steps'],
      properties: {
        go: { type: 'boolean' },
        result: { type: 'string' },
        status: { type: 'string' },
        messages: { type: 'array' },
        next: { type: 'string' },
        client: { type: 'string' },
        parq: { type: 'object' },
        weeks: { type: 'array' },
        parts: { type: 'array' },
        moves: { type: 'array' },
        sessions: { type: 'array' },
        count: { type: 'integer' },
        first: { type: 'string' },
        notes: { type: 'array' },
        intake: { type: 'object' },
        next_steps: { type: 'object' },
      },
    },
    async run(input, ctx) {
      const client = clip(plain(input.client || ''), 60);
      if (!client) throw new Error("Add the client's name for the intake sheet.");
      const me = C.who(ctx, input);
      const today = time.today(ctx);
      const greet = C.firstWord(client);
      const notes = [];
      const result = P.results.find((x) => x.label === input.parq || x.id === input.parq) || NOT_DONE;

      // The date they filled it in: typed (last Oct 19, not next), or today, and never after today.
      let parqDate = '';
      if (result.id !== 'not_done') {
        const typed = plain(input.parq_date || '');
        parqDate = S.parseDate(typed, today, { past: true });
        if (typed && !parqDate) notes.push(`Couldn't read the date "${clip(typed, 20)}" they filled in the PAR-Q+, so today is used.`);
        if (parqDate > today) {
          notes.push('The date they filled in the PAR-Q+ was after today, so today is used.');
          parqDate = today;
        }
        parqDate = parqDate || today;
      }

      // The redo-by date, only as the trainer typed it: after the form date, and never more than the
      // 12 months any PAR-Q+ result lasts.
      let redo = '';
      const typedRedo = plain(input.redo_by || '');
      if (result.id === 'go' && typedRedo) {
        redo = redoDate(typedRedo, parqDate);
        if (!redo) notes.push(`Couldn't read the redo-by date "${clip(typedRedo, 20)}". Write it like "Oct 19, 2027".`);
        if (redo && redo <= parqDate) {
          notes.push(`The redo-by date has to come after ${time.longDate(parqDate)}, when they filled in the PAR-Q+.`);
          redo = '';
        }
        const cap = S.addMonths(parqDate, 12);
        if (redo && redo > cap) {
          notes.push(`A PAR-Q+ result lasts 12 months at most, so the redo-by date is ${time.longDate(cap)}.`);
          redo = cap;
        }
      }

      // Go with a current redo-by date makes the plan; everything else gets its message and no plan.
      let state = result.id;
      if (state === 'go' && !redo) state = 'need_redo';
      else if (state === 'go' && redo <= today) state = 'expired';
      const go = state === 'go';
      const v = { greet, redo: redo ? time.longDate(redo) : '' };

      // The schedule: up to 3 days a week, 4 weeks, from the typed start or the next session day.
      const typedDays = S.parseDays(input.days);
      const days = typedDays.slice(0, 3);
      if (typedDays.length > 3) notes.push(`This plan keeps to 3 sessions a week, so it uses ${text.list(days.map(S.dayLabel))}.`);
      if (String(input.days || '').trim() && !typedDays.length) notes.push(`Couldn't read the days "${clip(plain(input.days), 40)}". Write them like "Tue 7am, Fri 7am".`);
      const typedStart = plain(input.start || '');
      let start = S.parseDate(typedStart, today);
      if (typedStart && !start) notes.push(`Couldn't read the start date "${clip(typedStart, 20)}", so the plan starts on the next session day.`);
      if (start && start < today) {
        notes.push('The start date has passed, so the plan starts on the next session day.');
        start = '';
      }
      const perWeek = days.length || 2;
      const count = perWeek * P.weeks.length;
      const sessions = S.sessionDates({ days, start, today, count });
      if (go && perWeek === 1) notes.push(P.one_day);
      const firstAt = sessions[0] ? S.dateLabel(sessions[0]) : start ? time.shortDate(start) : '';
      const daysText = days.length ? text.list(days.map(dayPhrase)) : '';

      const lengthKey = P.lengths[input.length] ? input.length : N.offer.length;
      const mins = P.lengths[lengthKey] || P.lengths[LENGTHS[LENGTHS.length - 1]];
      const parts = P.parts.map((p, i) => ({ part: p.part, minutes: mins[i], what: p.what }));
      const level = Math.max(0, P.levels.indexOf(input.level));
      const at = level === 0 ? 0 : 1;
      const moves = P.moves.map((m) => ({
        move: m.move,
        start: m.versions[at],
        easier: at > 0 ? m.versions[at - 1] : m.easier || P.easier_than_first,
        next: at < m.versions.length - 1 ? m.versions[at + 1] : P.next_after_last,
      }));
      const perSession = (P.moves_per_length || {})[lengthKey] || moves.length;
      const movesLine = perSession < moves.length ? C.fill(P.moves_line, { n: perSession, length: lengthKey }) : '';
      const place = P.places.find((x) => x.id === input.where) || P.places[0];
      const weeks = P.weeks.map((w, i) => {
        const slice = sessions.slice(i * perWeek, (i + 1) * perWeek);
        return { week: `Week ${i + 1}`, dates: slice.length ? text.list(slice.map((x) => time.shortDate(x.date))) : `${perWeek} sessions, days to set`, sets: w.sets, focus: w.focus };
      });
      const last = sessions.length ? sessions[sessions.length - 1].date : '';
      if (go && last && redo <= last) notes.push(`Redo the PAR-Q+ by ${time.shortDate(redo)}, before the last sessions in this plan.`);
      const goals = clip(plain(input.goals || ''), 600);
      if (GOAL_NUMBERS.test(goals)) notes.push(P.goal_note);

      // What to send and do next, by state. A Hold gives all three messages: the trainer picks one,
      // so 127 never learns why.
      const S_ = P.states[state];
      let messages = [];
      if (state === 'go') messages = [{ label: 'Message to send with the plan', text: C.fill(P.go_message, { greet, count, days: daysText || `${perWeek} a week`, first: firstAt ? `, starting ${firstAt}` : '', bring: P.bring }) }];
      else if (state === 'hold') messages = P.hold_messages.map((m) => ({ label: m.label, text: C.fill(m.message, v) }));
      else if (S_.message) messages = [{ label: 'Message to send', text: C.fill(S_.message, v) }];

      const dateLabel = parqDate ? time.longDate(parqDate) : '';
      const parq = { result: result.label, date: parqDate, date_label: dateLabel, redo, redo_label: redo ? time.longDate(redo) : '' };
      const resultLine = state === 'not_done' ? result.label : `${result.label}, filled in ${dateLabel}.${redo ? ` Redo by ${parq.redo_label}.` : ''}`;
      const o = {
        me,
        client,
        state,
        plan: go,
        result: result.label,
        result_line: `${resultLine}${S_.line ? ` ${S_.line}` : ''}`,
        intake_line: S_.intake_line ? C.fill(S_.intake_line, v) : '',
        parq,
        messages,
        next: C.fill(S_.next, v),
        notes,
        goals,
        days_text: daysText,
        first: firstAt,
        where: place.id,
        equipment: `Equipment: ${place.kit}`,
        length: lengthKey,
        count,
        sessions,
        weeks,
        parts,
        moves,
        moves_line: movesLine,
        summary: `${count} sessions over 4 weeks${daysText ? `, ${daysText}` : ''}${firstAt ? `, starting ${firstAt}` : ''}. ${lengthKey} each, ${place.id === 'Other' ? 'at the place you agreed' : `at ${place.where || place.id.toLowerCase()}`}.`,
        parq_line: go ? `${result.label}, filled in ${dateLabel}. Fill it in again by ${parq.redo_label}, or sooner after any change in health.` : '',
      };
      const intake = await save.saveFile(ctx, save.fileName(greet, 'intake sheet', '.html'), intakeHtml(N, o));
      const nextSteps = await save.saveFile(ctx, save.fileName(greet, 'next steps', '.html'), nextStepsHtml(N, o));
      return {
        go,
        result: result.label,
        status: C.fill(S_.status, { count }),
        messages,
        next: o.next,
        client,
        parq,
        weeks: go ? weeks : [],
        parts: go ? parts : [],
        moves: go ? moves : [],
        sessions: go ? sessions.map((x) => ({ date: x.date, time: x.time, label: S.dateLabel(x) })) : [],
        count: go ? count : 0,
        first: go ? firstAt : '',
        notes,
        intake,
        next_steps: nextSteps,
      };
    },
    // The same blocks whatever the PAR-Q+ says: the member's AI link reads this view, so the result,
    // its messages and the plan stay in the two private files.
    view(out) {
      return views.blocks(
        views.metric(out.client, 'Intake ready', P.view_note),
        views.text(P.parq_note),
        views.text(P.private_note),
        views.file(out.next_steps, 'Next steps (open it: the message to send, and the plan to print when there is one)'),
        views.file(out.intake, 'Intake sheet (print it and fill it in together)'),
        views.text(`What you say you do: ${P.scope}`),
        views.text(P.stop),
        (P.sources || []).map((s) => views.link(`${s.publisher}: ${s.says}`, s.url)),
      );
    },
  };
}

module.exports = { planTool, dayPhrase, redoDate };
