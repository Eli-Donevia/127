// 30 subject lines with preview text for one email, in six styles, each checked for length, ALL
// CAPS, fake RE: or FWD: and spammy phrases. Saved as a CSV to keep testing from.

const { ai, views, save, files, text } = require('../../_kit');
const { factsFor } = require('../lib/facts');
const { subjectLines, checkSubject, STYLES } = require('../lib/subjects');

const SCHEMA = {
  type: 'object',
  properties: { lines: { type: 'array', minItems: 30, maxItems: 30, items: { type: 'object', properties: { style: { type: 'string', enum: STYLES }, subject: { type: 'string', maxLength: 70 }, preview: { type: 'string', maxLength: 120 } }, required: ['style', 'subject', 'preview'] } } },
  required: ['lines'],
};

module.exports = {
  name: 'email.subject_lines',
  title: 'Write subject lines',
  description: 'Writes 30 subject lines with preview text for your next email in six styles, and flags anything that looks like spam or gets cut off on a phone.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 3,
  input: {
    type: 'object',
    properties: {
      topic: { type: 'string', title: 'What the email is about', maxLength: 160 },
      check: { type: 'string', title: 'A subject line to check (optional)', maxLength: 120 },
    },
    required: ['topic'],
  },
  output: {
    type: 'object',
    properties: { lines: { type: 'array' }, csv: { type: 'object' }, checked: { type: 'object' } },
    required: ['lines', 'csv'],
  },
  async run(input, ctx) {
    const f = factsFor(ctx, {});
    const base = subjectLines(input.topic, f);
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      prompt: `Write 30 email subject lines with preview text for this email from ${f.business}: "${text.oneLine(input.topic)}". Five in each style: ${STYLES.join(', ')}. Honest: the subject must match the email. Under 50 characters, no ALL CAPS, no exclamation marks, no RE: or FWD:, no first-name tags, no deadlines or results unless the topic says so. Preview text adds something the subject did not say.`,
      schema: SCHEMA,
      fallback: () => ({ lines: base.map(({ style, subject, preview }) => ({ style, subject, preview })) }),
      accept: (d) => ai.cleanCopy(d) && d.lines.every((l) => checkSubject(l.subject).ok),
      maxTokens: 2500,
    });
    const lines = data.lines.map((l, i) => ({ key: `s${i + 1}`, style: l.style, subject: text.oneLine(l.subject), preview: text.oneLine(l.preview), ...checkSubject(l.subject) }));
    const csv = await save.saveFile(ctx, save.fileName(f.business, 'subject-lines', '.csv'), files.csv(lines.map((l) => ({ ...l, flags: l.flags.join('; ') })), [{ key: 'style', label: 'Style' }, { key: 'subject', label: 'Subject' }, { key: 'preview', label: 'Preview text' }, { key: 'chars', label: 'Characters' }, { key: 'flags', label: 'Check' }], { bom: true }), 'text/csv');
    const out = { lines, csv, ai: usedAi };
    if (input.check) out.checked = { subject: text.oneLine(input.check), ...checkSubject(input.check) };
    return out;
  },
  view(out) {
    return views.blocks(
      ...(out.checked ? [views.metric('Your subject line', out.checked.ok ? 'Good' : `${out.checked.flags.length} to fix`, out.checked.ok ? `${out.checked.chars} characters, nothing flagged` : out.checked.flags.join('. '))] : []),
      views.table([{ key: 'style', label: 'Style' }, { key: 'subject', label: 'Subject' }, { key: 'preview', label: 'Preview text' }, { key: 'chars', label: 'Chars' }], out.lines, 30),
      views.file(out.csv, 'All 30 as a CSV'),
      views.text('Test two at a time: send each to half your list, keep the one with more opens, and write the winner down.')
    );
  },
};
