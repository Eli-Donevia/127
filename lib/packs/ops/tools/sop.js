// Turns how the member does a job into a checklist anyone can follow: numbered steps with tick
// boxes, supplies, a quality check and common mistakes. Paste a voice-note transcript or rough
// notes and the steps come from your own words; leave notes empty and it starts from a preset
// for common jobs. Saves a printable checklist (HTML) and a Notion or Google Docs file (.md).

const { views, save, ai, text, brain } = require('../../_kit');
const S = require('../lib/sops');
const { page, esc, accentFor } = require('../lib/page');

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 80 },
    supplies: { type: 'array', items: { type: 'string', maxLength: 80 } },
    steps: { type: 'array', items: { type: 'object', properties: { title: { type: 'string', maxLength: 60 }, detail: { type: 'string', maxLength: 240 } }, required: ['title', 'detail'] } },
    quality: { type: 'array', items: { type: 'string', maxLength: 100 } },
    mistakes: { type: 'array', items: { type: 'string', maxLength: 120 } },
    done: { type: 'string', maxLength: 200 },
  },
  required: ['title', 'supplies', 'steps', 'quality', 'mistakes', 'done'],
};

function checklistHtml(sop, { business, accent }) {
  const steps = sop.steps.map((s) => `<li class="step"><div class="box"></div><div class="n">${s.n}</div><div><b>${esc(s.title)}</b>${s.detail ? `<p>${esc(s.detail)}</p>` : ''}</div></li>`).join('');
  const ticks = (a) => `<ul class="ticks">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const body = `<div class="meta"><span>About ${sop.minutes} minutes</span><span>${sop.steps.length} steps</span><span>Who: ${esc(sop.who)}</span>${business ? `<span>${esc(business)}</span>` : ''}</div>
<h2>Bring</h2><div class="card">${ticks(sop.supplies)}</div>
<h2>Steps</h2><ol class="steps">${steps}</ol>
<div class="two" style="margin-top:22px"><div><h2 style="margin-top:0">Quality check</h2><div class="card">${ticks(sop.quality)}</div></div><div><h2 style="margin-top:0">Common mistakes</h2><div class="card"><ul class="plain">${sop.mistakes.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div></div></div>
<h2>Done when</h2><div class="card">${esc(sop.done)}</div>
<div class="sign"><div>Done by</div><div>Date</div><div>Time taken</div></div>
<footer>Print one per job, or keep it on your phone. When a step changes, change it here first.</footer>`;
  return page({ title: `${sop.title} checklist`, kicker: 'Checklist', h1: sop.title, lede: sop.purpose, body, accent, description: `Step by step checklist: ${sop.title}` });
}

function md(sop) {
  return `# ${sop.title}\n\n${sop.purpose}\n\nAbout ${sop.minutes} minutes. Who: ${sop.who}.\n\n## Bring\n${sop.supplies.map((x) => `- [ ] ${x}`).join('\n')}\n\n## Steps\n${sop.steps.map((s) => `- [ ] ${s.n}. ${s.title}${s.detail ? `: ${s.detail}` : ''}`).join('\n')}\n\n## Quality check\n${sop.quality.map((x) => `- [ ] ${x}`).join('\n')}\n\n## Common mistakes\n${sop.mistakes.map((x) => `- ${x}`).join('\n')}\n\n## Done when\n${sop.done}\n`;
}

module.exports = {
  name: 'ops.sop',
  title: 'Job checklist (SOP)',
  description: 'Turns how you do a job into a step by step checklist with tick boxes, supplies, a quality check and common mistakes. Paste a voice-note transcript or rough notes, or start from a preset for cleaning, detailing, lawn care, dog walking, shipping orders, bookings and review follow ups.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 4,
  input: {
    type: 'object',
    properties: {
      task: { type: 'string', title: 'Which job?', description: 'For example "Standard home clean" or "Pack and ship an order"', maxLength: 120 },
      notes: { type: 'string', title: 'How you do it (optional)', description: 'Paste a voice-note transcript or rough notes. Any order, any length.', maxLength: 6000 },
      who: { type: 'string', title: 'Who will use it', enum: ['me', 'helper'], default: 'me' },
      minutes: { type: 'number', title: 'About how many minutes (optional)', minimum: 1, maximum: 600 },
    },
    required: ['task'],
  },
  output: { type: 'object', properties: { sop: { type: 'object' }, checklist: { type: 'object' }, doc: { type: 'object' }, ai: { type: 'boolean' } }, required: ['sop'] },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const base = S.templateSop({ task: input.task, notes: input.notes, who: input.who, minutes: input.minutes, what: b.what || b.niche, business: b.name });
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You turn how a small business owner does a job into a checklist a new helper can follow on day one. Each step starts with a verb. Keep the owner\'s own order and details; do not add steps they did not mention unless something unsafe is missing.',
      prompt: [
        `Job: ${input.task}`, b.what ? `Business: ${b.name || ''} (${b.what})` : '',
        input.notes ? `Owner's notes (may be a voice transcript):\n${String(input.notes).slice(0, 5000)}` : 'No notes given: write the standard steps for this job.',
        'Return: title, supplies (3 to 8), steps (5 to 14, each with a short title and a one sentence detail), quality (3 to 6 checks), mistakes (2 to 4), done (one sentence).',
      ].filter(Boolean).join('\n\n'),
      schema: SCHEMA,
      fallback: () => ({ title: base.title, supplies: base.supplies, steps: base.steps.map(({ title, detail }) => ({ title, detail })), quality: base.quality, mistakes: base.mistakes, done: base.done }),
      accept: ai.cleanCopy,
    });
    const sop = { ...base, ...data, steps: data.steps.slice(0, 14).map((s, i) => ({ n: i + 1, title: text.oneLine(s.title), detail: text.oneLine(s.detail || '') })) };
    const name = text.slug(sop.title).slice(0, 40) || 'job';
    const checklist = await save.saveFile(ctx, save.fileName(name, 'checklist', '.html'), checklistHtml(sop, { business: b.name, accent: accentFor(ctx) }));
    const doc = await save.saveFile(ctx, save.fileName(name, 'checklist', '.md'), md(sop));
    ctx.log(`Wrote a ${sop.steps.length} step checklist for ${sop.title}${base.source === 'notes' ? ' from your notes' : ''}`);
    return { sop, checklist, doc, ai: usedAi };
  },
  view(out) {
    const s = out.sop;
    return views.blocks(
      views.metric('Steps', s.steps.length, `About ${s.minutes} minutes`),
      views.table([{ key: 'n', label: '#' }, { key: 'title', label: 'Step' }, { key: 'detail', label: 'How' }], s.steps),
      views.text(`Done when: ${s.done}`),
      views.file(out.checklist, 'Printable checklist (print or save as PDF)'),
      views.file(out.doc, 'Checklist for Notion or Google Docs (.md, imports as to-dos)')
    );
  },
};
