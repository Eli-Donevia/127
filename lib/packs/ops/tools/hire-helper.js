// Everything for a first helper: a job post, a paid trial built on the member's own checklist,
// a scorecard spreadsheet, interview questions, where to share the post, and where to check the
// rules (IRS, Department of Labor, state labor office, SBA). The member posts it and decides;
// nothing is sent from here.

const { views, save, ai, text, brain, files } = require('../../_kit');
const H = require('../lib/hire');
const { page, esc, accentFor } = require('../lib/page');

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 80 },
    body: { type: 'string', maxLength: 1200 },
    questions: { type: 'array', items: { type: 'string', maxLength: 200 } },
  },
  required: ['title', 'body', 'questions'],
};

function packetHtml(p, { business, accent }) {
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join('');
  const score = p.scorecard.map((r) => `<tr><td><b>${esc(r.area)}</b><div class="small">${esc(r.good)}</div></td><td><span class="blank"></span> / 5</td><td><span class="blank" style="min-width:160px"></span></td></tr>`).join('');
  const body = `<div class="meta"><span>${esc(p.post.title)}</span>${p.pay ? `<span>${esc(p.pay)}</span>` : ''}<span>Paid trial first</span></div>
<h2>Job post</h2><div class="card"><b>${esc(p.post.title)}</b><pre>${esc(p.post.body)}</pre></div>
<h2>Where to share it</h2><div class="card"><ul class="plain">${li(p.share)}</ul></div>
<h2>Paid trial</h2><div class="card"><ol class="plain">${li(p.trial)}</ol></div>
<h2>Scorecard</h2><table><tr><th>Area</th><th>Score</th><th>Notes</th></tr>${score}</table>
<p class="small">Hire at 4 or 5 on the first four areas. A 3 on talking with customers can grow; a 3 on care usually does not.</p>
<h2>Interview questions</h2><div class="card"><ol class="plain">${li(p.questions)}</ol></div>
<h2>Check the rules first</h2><div class="card"><ul class="plain">${li(p.rules.lines)}</ul>
<ul class="plain" style="margin-top:10px">${p.rules.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.label)}</a>: ${esc(s.about)} <span class="small">Checked ${esc(s.checked)}</span></li>`).join('')}</ul></div>
<footer>You post the job and make the call. Keep the scorecards for every person you try.</footer>`;
  return page({ title: `${business || 'First'} helper packet`, kicker: 'Hiring packet', h1: `Hire your first ${p.role}`, lede: 'A job post, a paid trial, a scorecard and the questions to ask. Do the trial before you promise anyone regular shifts.', body, accent, description: 'Job post, paid trial, scorecard and interview questions' });
}

module.exports = {
  name: 'ops.hire_helper',
  title: 'First helper packet',
  description: 'Writes a job post, a paid trial built on your checklist, a scorecard spreadsheet and interview questions for your first helper, and links the official pages for checking your state\'s rules on contractors and employees.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 5,
  input: {
    type: 'object',
    properties: {
      role: { type: 'string', title: 'Who do you need?', description: 'For example "cleaning helper" or "packing helper"', maxLength: 60 },
      what: { type: 'string', title: 'What do you sell? (optional)', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      pay: { type: 'number', title: 'Pay (optional)', minimum: 0, maximum: 10000 },
      payType: { type: 'string', title: 'Pay is', enum: ['per hour', 'per job'], default: 'per hour' },
      hours: { type: 'string', title: 'When (optional)', description: 'For example "Saturdays 9 to 1"', maxLength: 120 },
      tasks: { type: 'string', title: 'What they will do (optional)', maxLength: 400 },
      sop: { title: 'Checklist from the SOP step' },
    },
    required: ['role'],
  },
  output: { type: 'object', properties: { packet: { type: 'object' }, page: { type: 'object' }, scorecard: { type: 'object' }, doc: { type: 'object' }, ai: { type: 'boolean' } }, required: ['packet'] },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const sop = input.sop && input.sop.sop ? input.sop.sop : input.sop && Array.isArray(input.sop.steps) ? input.sop : null;
    const base = H.templatePacket({ business: b.name, role: input.role, what: input.what || b.what, city: input.city || b.city, pay: input.pay, payType: input.payType, hours: input.hours, tasks: input.tasks, sop, firstName: b.firstName });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write a short, honest job post for a first part-time helper at a small business, plus interview questions. No hype, no promises about hours, earnings or growth. Mention the paid trial. Do not give legal advice.',
      prompt: [
        `Business: ${b.name || 'a small business'}${b.what ? ` (${b.what})` : ''}`, `Role: ${base.role}`, input.city || b.city ? `Where: ${input.city || b.city}` : '',
        base.pay ? `Pay: ${base.pay}` : '', input.hours ? `When: ${input.hours}` : '', sop ? `Main job: ${sop.title}. Steps: ${sop.steps.map((s) => s.title).join('; ')}` : '',
        'Return: title (under 8 words), body (90 to 160 words, plain lines, ends with how to apply), questions (6 to 8 interview questions).',
      ].filter(Boolean).join('\n'),
      schema: SCHEMA,
      fallback: () => ({ title: base.post.title, body: base.post.body, questions: base.questions }),
      accept: ai.cleanCopy,
    });
    const packet = { ...base, post: { title: data.title, body: data.body }, questions: data.questions.slice(0, 8) };
    const name = b.name || 'first';
    const pageFile = await save.saveFile(ctx, save.fileName(name, 'helper-packet', '.html'), packetHtml(packet, { business: b.name, accent: accentFor(ctx) }));
    const scorecard = await save.saveFile(ctx, save.fileName(name, 'helper-scorecard', '.csv'), files.csv(packet.scorecard, [{ key: 'area', label: 'Area' }, { key: 'good', label: 'What good looks like' }, { key: 'score', label: 'Score (1 to 5)' }, { key: 'notes', label: 'Notes' }], { bom: true }));
    const doc = await save.saveFile(ctx, save.fileName(name, 'job-post', '.txt'), `${packet.post.title}\n\n${packet.post.body}\n\nInterview questions\n${packet.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`);
    ctx.log(`Wrote the job post, a ${packet.trial.length} step paid trial and a ${packet.scorecard.length} line scorecard`);
    return { packet, page: pageFile, scorecard, doc, ai: usedAi };
  },
  view(out) {
    const p = out.packet;
    return views.blocks(
      views.copy(p.post.title, p.post.body),
      views.table([{ key: 'area', label: 'Score this' }, { key: 'good', label: 'What good looks like' }], p.scorecard),
      views.text(`Paid trial: ${p.trial.join(' ')}`),
      views.text(p.rules.lines[0]),
      ...p.rules.sources.slice(0, 3).map((s) => views.link(s.label, s.url)),
      views.file(out.page, 'Hiring packet (print or save as PDF)'),
      views.file(out.scorecard, 'Scorecard spreadsheet (.csv)'),
      views.file(out.doc, 'Job post and questions (.txt)')
    );
  },
};
