// Writes an email sequence (welcome, launch week, abandoned cart, nurture, win-back or a monthly
// newsletter) from the member's facts. Template copy is built from the brain; AI rewrites it in
// their voice when it's on, keeping every fact, link and [bracket]. Each email comes back as one
// editable item for the approve step. A newsletter that repeats with the same answers leaves last
// issue's news, tip and dates as [brackets] (email.build_emails remembers what each issue used).

const { ai, views, brain, text, time } = require('../../_kit');
const { factsFor } = require('../lib/facts');
const { KINDS, sequenceFor, toText } = require('../lib/sequences');

function schemaFor(n) {
  return {
    type: 'object',
    properties: {
      emails: {
        type: 'array',
        minItems: n,
        maxItems: n,
        items: { type: 'object', properties: { subject: { type: 'string', maxLength: 70 }, preview: { type: 'string', maxLength: 140 }, body: { type: 'string', maxLength: 1800 } }, required: ['subject', 'preview', 'body'] },
      },
    },
    required: ['emails'],
  };
}

const TOKENS = /\[[^\]]+\]|https?:\/\/\S+|\$\d[\d,.]*/g;

// What the last newsletter used, saved by email.build_emails: { month: 'YYYY-MM', news, tip, coming }.
const LAST = 'newsletter_last';
const sig = (s) => text.clip(text.oneLine(s || ''), 60);
function lastIssue(ctx) {
  const p = ctx && ctx.brain && ctx.brain.packs && ctx.brain.packs.email;
  return (p && p[LAST]) || null;
}
const FIELD = { news: "what's new", tip: 'the tip', coming: 'the dates coming up' };

module.exports = {
  name: 'email.write_sequence',
  title: 'Write your emails',
  description: 'Writes a welcome series, a launch week or abandoned cart emails from your own facts: subject, preview text, body, button and send time for each.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      kind: { type: 'string', title: 'Which emails', enum: ['welcome', 'launch', 'cart', 'nurture', 'winback', 'newsletter'] },
      offer: { type: 'string', title: 'What they signed up for', maxLength: 160 },
      link: { type: 'string', title: 'Main link', maxLength: 500 },
      launch: { type: 'string', title: 'What is launching', maxLength: 120 },
      date: { type: 'string', title: 'Launch date (YYYY-MM-DD)', maxLength: 10 },
      closeDate: { type: 'string', title: 'Orders close (YYYY-MM-DD, optional)', maxLength: 10 },
      shipping: { type: 'string', title: 'Shipping', maxLength: 200 },
      returns: { type: 'string', title: 'Returns or replacements', maxLength: 200 },
      discount: { type: 'string', title: 'Discount or welcome-back offer (optional)', maxLength: 160 },
      topic: { type: 'string', title: 'What customers want help with (nurture)', maxLength: 80 },
      tips: { type: 'string', format: 'textarea', title: 'What you tell customers (nurture)', maxLength: 2000 },
      news: { type: 'string', format: 'textarea', title: "What's new (win-back, newsletter)", maxLength: 1000 },
      tip: { type: 'string', title: 'A tip (newsletter)', maxLength: 300 },
      coming: { type: 'string', title: 'Coming up (newsletter)', maxLength: 300 },
      start: { type: 'string', title: 'First send date (YYYY-MM-DD, win-back)', maxLength: 10 },
    },
    required: ['kind'],
  },
  output: {
    type: 'object',
    properties: { kind: { type: 'string' }, emails: { type: 'array' }, items: { type: 'array' }, brackets: { type: 'integer' }, notes: { type: 'array' } },
    required: ['kind', 'emails', 'items'],
  },
  async run(input, ctx) {
    const kind = KINDS[input.kind] ? input.kind : 'welcome';
    if (kind === 'launch' && !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) throw new Error('Add your launch date as YYYY-MM-DD, like 2026-11-12.');
    if (input.start && !/^\d{4}-\d{2}-\d{2}$/.test(input.start)) throw new Error('Add the first send date as YYYY-MM-DD, like 2026-11-03, or leave it empty to start on the next weekday.');
    const notes = [];
    let use = input;
    if (kind === 'newsletter') {
      // A repeat runs with the same answers: last issue's news, tip and dates aren't sent again.
      const last = lastIssue(ctx);
      const month = time.today(ctx).slice(0, 7);
      const stale = last && last.month && last.month !== month ? Object.keys(FIELD).filter((k) => input[k] && sig(input[k]) === last[k]) : [];
      if (stale.length) {
        use = { ...input, ...Object.fromEntries(stale.map((k) => [k, ''])) };
        notes.push(`Last issue already had ${text.list(stale.map((k) => FIELD[k]))}, so ${stale.length === 1 ? "it's" : "they're"} left as [brackets] this time. Fill them in before you send.`);
      }
    }
    const f = factsFor(ctx, use);
    const base = sequenceFor(kind, f);
    ctx.log(`Writing ${base.length} ${KINDS[kind].label.toLowerCase()} emails for ${f.business}`);
    const b = brain.brainOf(ctx, {});
    const prompt = [
      `Rewrite these ${base.length} emails so they sound like this business owner wrote them. Keep every fact, price, link and [bracket] exactly as written. Do not add facts, results, reviews or deadlines. Short paragraphs, first person, warm, plain words. Subject under 50 characters, no first-name tags, no ALL CAPS, no exclamation marks in subjects.`,
      brain.describe(b),
      '',
      ...base.map((e, i) => `Email ${i + 1} (${e.when}):\nSubject: ${e.subject}\nPreview: ${e.preview}\n${e.body}`),
    ].join('\n');
    const keeps = (d) => d.emails.every((e, i) => (base[i].body.match(TOKENS) || []).every((tok) => e.body.includes(tok)) && /^Hi there,/.test(e.body));
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      prompt,
      schema: schemaFor(base.length),
      fallback: () => ({ emails: base.map((e) => ({ subject: e.subject, preview: e.preview, body: e.body })) }),
      accept: (d) => ai.cleanCopy(d) && keeps(d),
      maxTokens: 3500,
    });
    const emails = base.map((e, i) => ({ ...e, subject: text.oneLine(data.emails[i].subject), preview: text.oneLine(data.emails[i].preview), body: String(data.emails[i].body).trim() }));
    const items = emails.map((e) => ({ key: e.key, n: e.n, label: `Email ${e.n}, ${e.when.toLowerCase()}`, text: toText(e), when: e.when, day: e.day, hours: e.hours, date: e.date || '', time: e.time, button: e.button, link: e.link }));
    const brackets = emails.filter((e) => /\[[^\]]+\]/.test(e.body)).length;
    return { kind, label: KINDS[kind].label, emails, items, brackets, notes, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.metric('Emails written', out.emails.length, out.brackets ? `${out.brackets} have a [bracket] to fill with your details` : 'All filled from your facts'),
      views.table(
        [
          { key: 'n', label: '#' },
          { key: 'when', label: 'Sends' },
          { key: 'subject', label: 'Subject' },
        ],
        out.emails.map((e) => ({ n: e.n, when: e.date || e.when, subject: e.subject })),
        10
      ),
      ...out.emails.slice(0, 2).map((e) => views.copy(`Email ${e.n}: ${e.subject}`, e.body)),
      (out.notes || []).map((n) => views.text(n))
    );
  },
};
