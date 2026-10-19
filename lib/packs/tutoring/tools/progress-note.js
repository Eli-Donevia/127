// The note a parent reads after every session: what we covered, what went well, what to practice and
// what's next. A short text and a fuller email, both to the parent (never to the student). Describes
// the work done, never a promised grade or score. In the "new family" run, before any session has
// happened, it waits: the note comes after the first session.

const { views, time, text } = require('../../_kit');
const C = require('../../_kit/common');

const { plain, clip } = text;

function sentence(s) {
  const t = plain(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function progressNoteTool(N) {
  return {
    name: 'tutoring.write_progress_note',
    title: 'Parent progress note',
    description: 'A short text and an email to the parent after a session: what you covered, what went well, what to practice and what is next. Written to the parent, never the student, with no grade or score promises.',
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
        parent: { type: 'string', maxLength: 60, title: "Parent's name (optional)" },
        subject: { type: 'string', maxLength: 60, title: 'Subject', default: 'math' },
        worked_on: { type: 'string', maxLength: 300, title: 'What you worked on today', description: 'Leave it empty for a new family before the first session' },
        went_well: { type: 'string', maxLength: 300, title: 'What went well (optional)' },
        practice: { type: 'string', maxLength: 300, title: 'Practice before next time (optional)' },
        next: { type: 'string', maxLength: 300, title: 'Plan for next session (optional)' },
        next_date: { type: 'string', maxLength: 40, title: 'Next session day and time (optional)' },
        new_family: { type: 'boolean', default: false, title: 'A new family (no session yet)' },
      },
    },
    output: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, email: { type: 'object' }, skipped: { type: 'boolean' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const student = plain(input.student || 'your child').split(' ')[0];
      if (!plain(input.worked_on || '').trim()) {
        if (input.new_family === true || input.new_family === 'true') return { text: '', skipped: true, student };
        throw new Error('Add what you worked on today, and the parent gets a short note.');
      }
      const parent = plain(input.parent || '').split(' ')[0];
      const subject = plain(input.subject || 'math');
      const date = time.shortDate(time.today(ctx));
      const worked = sentence(input.worked_on);
      const well = sentence(input.went_well);
      const practice = sentence(input.practice);
      const next = sentence(input.next);
      const when = plain(input.next_date || '');
      const sign = me.first || me.business || 'Your tutor';
      const hi = parent ? `Hi ${parent}` : 'Hi there';
      const sms = clip(
        [`${hi}, quick note from today's ${subject} session with ${student}.`, `We worked on: ${worked}`, well ? `Went well: ${well}` : '', practice ? `Practice before next time: ${practice}` : '', next ? `Next: ${next}` : '', when ? `See you ${when}.` : '', `${sign}`].filter(Boolean).join(' '),
        640,
      );
      const body = [
        `${hi},`,
        '',
        `Here's a short note from ${student}'s ${subject} session on ${date}.`,
        '',
        `What we worked on: ${worked}`,
        well ? `What went well: ${well}` : '',
        practice ? `Practice before next time (about 15 minutes): ${practice}` : '',
        next ? `Plan for next session: ${next}` : '',
        when ? `Next session: ${when}.` : '',
        '',
        'If anything changes at school, like a new unit or a test date, just reply and I will plan for it.',
        '',
        `Thanks,`,
        sign,
      ]
        .filter((l, i, a) => l !== '' || a[i - 1] !== '')
        .join('\n');
      return { text: sms, email: { subject: `${student}'s ${subject} session, ${date}`, body }, to: parent || 'the parent' };
    },
    view(out) {
      if (out.skipped) return views.blocks(views.text(`After ${out.student}'s first session, run this again with what you worked on (leave New family off), and the parent gets a short note.`));
      return views.blocks(
        views.text(`For ${out.to}. Notes go to the parent, never the student.`),
        views.copy('Text to the parent', out.text),
        views.copy(`Email: ${out.email.subject}`, out.email.body),
      );
    },
  };
}

module.exports = { progressNoteTool };
