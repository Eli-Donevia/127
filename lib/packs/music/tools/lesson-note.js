// The note a parent reads after every lesson: what we worked on, what went well, what to practice this
// week and what's next. A short text and a fuller email, to the parent (never to a student under 18),
// or to an adult student when the name on the booking is the student's own. It describes the work
// done, never a promised exam, audition or pace. In the "new student" run, before any lesson has
// happened, it waits: the note comes after the first lesson.

const { views, time, text } = require('../../_kit');
const C = require('../../_kit/common');

const { plain, clip } = text;

function lessonNoteTool(N) {
  return {
    name: `${N.id}.write_lesson_note`,
    title: 'Lesson note',
    description: 'A short text and an email after a lesson: what you worked on, what went well, what to practice this week and what is next. Written to the parent, never a student under 18, with no exam or audition promises.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 20,
    input: {
      type: 'object',
      required: ['student'],
      properties: {
        student: { type: 'string', maxLength: 40, title: "Student's first name" },
        parent: { type: 'string', maxLength: 60, title: "Parent's name (or the adult student's)" },
        instrument: { type: 'string', maxLength: 40, title: 'Instrument (optional)', description: 'Like "piano" or "voice"' },
        worked_on: { type: 'string', maxLength: 300, title: 'What you worked on today', description: 'Leave it empty for a new student before the first lesson' },
        went_well: { type: 'string', maxLength: 300, title: 'What went well (optional)' },
        practice: { type: 'string', maxLength: 300, title: 'Practice this week (optional)' },
        next: { type: 'string', maxLength: 300, title: 'Plan for next lesson (optional)' },
        next_date: { type: 'string', maxLength: 40, title: 'Next lesson day and time (optional)' },
        new_student: { type: 'boolean', default: false, title: 'A new student (no lesson yet)' },
      },
    },
    output: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, email: { type: 'object' }, skipped: { type: 'boolean' }, to: { type: 'string' }, student: { type: 'string' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const student = C.firstWord(input.student) || 'your student';
      if (!plain(input.worked_on || '').trim()) {
        if (input.new_student === true || input.new_student === 'true') return { text: '', skipped: true, student };
        throw new Error('Add what you worked on today, and the parent gets a short note.');
      }
      const parent = C.firstWord(input.parent);
      // The booking is in the student's own name: an adult student, so the note goes to them.
      const adult = !!parent && parent.toLowerCase() === student.toLowerCase();
      // Left empty: the instrument from the plan saved on their Pipeline row (Lesson plan and practice log).
      let instrument = plain(input.instrument || '').toLowerCase();
      if (!instrument && input.parent) {
        const lead = await C.findLead(ctx, N.id, input.parent);
        const exact = lead && [lead.name, lead.company].some((n) => !!C.norm(n) && C.norm(n) === C.norm(input.parent));
        const plan = exact && C.isOwn(lead, N.id) && lead.data && lead.data.plan;
        if (plan && plan.instrument) instrument = plain(plan.instrument).toLowerCase();
      }
      const lesson = instrument ? `${instrument} lesson` : 'lesson';
      const date = time.shortDate(time.today(ctx));
      const worked = C.sentence(input.worked_on);
      const well = C.sentence(input.went_well);
      const practice = C.sentence(input.practice);
      const next = C.sentence(input.next);
      const when = plain(input.next_date || '');
      const sign = me.first || me.business || 'Your music teacher';
      const hi = parent ? `Hi ${parent}` : 'Hi there';
      const from = adult ? `today's ${lesson}` : `today's ${lesson} with ${student}`;
      const sms = clip(
        [`${hi}, quick note from ${from}.`, `We worked on: ${worked}`, well ? `Went well: ${well}` : '', practice ? `Practice this week: ${practice}` : '', next ? `Next: ${next}` : '', when ? `See you ${when}.` : '', sign].filter(Boolean).join(' '),
        640,
      );
      // Lines left out are null; '' is a paragraph break.
      const body = [
        `${hi},`,
        '',
        adult ? `Here's a short note from your ${lesson} on ${date}.` : `Here's a short note from ${student}'s ${lesson} on ${date}.`,
        '',
        `What we worked on: ${worked}`,
        well ? `What went well: ${well}` : null,
        practice ? `Practice this week (a few minutes most days, noted in the practice log): ${practice}` : null,
        next ? `Plan for next lesson: ${next}` : null,
        when ? `Next lesson: ${when}.` : null,
        '',
        adult ? 'If there is a song you would love to learn, just reply and I will plan for it.' : 'If anything comes up, like a school concert or new music from band or choir, just reply and I will plan for it.',
        '',
        'Thanks,',
        sign,
      ]
        .filter((l) => l !== null)
        .join('\n');
      const subject = adult ? `Your ${lesson}, ${date}` : `${student}'s ${lesson}, ${date}`;
      return { text: sms, email: { subject, body }, to: adult ? student : parent || 'the parent', student };
    },
    view(out) {
      if (out.skipped) return views.blocks(views.text(`After ${out.student}'s first lesson, run this again with what you worked on (leave New student off), and the parent gets a short note.`));
      return views.blocks(
        views.text(`For ${out.to}. Notes for students under 18 go to the parent, never the student.`),
        views.copy('Text', out.text),
        views.copy(`Email: ${out.email.subject}`, out.email.body),
      );
    },
  };
}

module.exports = { lessonNoteTool };
