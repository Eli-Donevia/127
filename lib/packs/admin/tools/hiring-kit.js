// A hiring kit for one role: a job post with a pay range, five screening questions, a short paid
// test task and an interview scorecard the member fills in by hand. It follows Legal's R6: it
// writes materials for the member to use and never reads, ranks, scores or screens real applicants
// (it takes no applicant data at all). Every question is checked against lib/hiring.js (nothing
// about age, family, health, religion, national origin, race, sex, arrest record or pay history),
// and the post against age- and gender-coded words. AI drafts when it is on; anything that fails a
// check falls back to the templates.

const { views, save, ai, text, brain } = require('../../_kit');
const H = require('../lib/hiring');
const { page, esc } = require('../lib/page');

const SCHEMA = {
  type: 'object',
  properties: {
    about: { type: 'string', maxLength: 500 },
    duties: { type: 'array', items: { type: 'string', maxLength: 160 } },
    needs: { type: 'array', items: { type: 'string', maxLength: 160 } },
    questions: { type: 'array', items: { type: 'string', maxLength: 240 } },
    testTask: { type: 'string', maxLength: 600 },
    scorecard: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'string', maxLength: 80 }, good: { type: 'string', maxLength: 200 } }, required: ['criterion', 'good'] } },
  },
  required: ['about', 'duties', 'needs', 'questions', 'testTask', 'scorecard'],
};

const DUTIES = {
  field: ['Do the work on each job to our checklist', 'Load and unload the truck or trailer and keep tools clean', 'Take before and after photos for the office', 'Treat every home and yard like it is your own'],
  front: ['Answer calls, texts and email from customers', 'Book, confirm and reschedule appointments', 'Keep the calendar and customer notes up to date', 'Send quotes and invoices we have approved'],
  creative: ['Make the pieces we plan each week', 'Edit drafts from our notes and feedback', 'Keep files named and organized', 'Hit the weekly deadlines'],
  retail: ['Serve customers and take payments', 'Open or close the shop with the checklist', 'Restock and keep the space clean', 'Tell us when something runs low'],
  general: ['Do the core work of the job to our checklist', 'Keep customers updated', 'Keep tools, files or space organized', 'Tell us early when something goes wrong'],
};
const NEEDS = {
  field: ['Shows up on time for each shift', 'Can do the physical work of the job, with or without reasonable accommodation', 'A driver\'s license, if the job includes driving'],
  front: ['Clear, friendly writing and phone manner', 'Comfortable learning new apps', 'Organized and careful with details'],
  creative: ['Samples of similar work', 'Comfortable with feedback and changes', 'Meets deadlines'],
  retail: ['Friendly with customers', 'Can work the listed shifts', 'Careful with cash and orders'],
  general: ['Reliable and on time', 'Clear communication', 'Willing to learn our way of doing things'],
};
const TEST = {
  field: 'A paid trial shift of 2 to 4 hours on a real job with you there. Pay the posted hourly rate. Watch how they follow the checklist, ask questions and treat the property.',
  front: 'A paid 1 hour task: answer five sample customer messages you write ahead of time (a booking, a reschedule, a price question, a complaint and a thank-you). Pay the posted hourly rate.',
  creative: 'A small paid piece from a short brief you write, sized to about 2 hours of work. Pay the posted rate. You own it only if your agreement says so.',
  retail: 'A paid trial shift of 2 to 3 hours with you or a lead there. Pay the posted hourly rate.',
  general: 'A short paid task, about 1 to 2 hours, that matches a real part of the job. Pay the posted rate and explain how you will look at it.',
};

function payLine(pay) {
  const p = text.oneLine(pay || '');
  return p ? `Pay: ${p}` : 'Pay: [your range, like $18 to $22 an hour]';
}

module.exports = {
  name: 'admin.hiring_kit',
  title: 'Write a hiring kit',
  description: 'Writes a job post with a pay range, five screening questions about the job only, a short paid test task and a scorecard you fill in by hand. It never reads, ranks or screens applicants.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['write'],
  credits: 3,
  input: {
    type: 'object',
    properties: {
      role: { type: 'string', title: 'The role', maxLength: 80 },
      pay: { type: 'string', title: 'Pay range', maxLength: 80 },
      hours: { type: 'string', title: 'Hours and days', maxLength: 120 },
      duties: { type: 'string', title: 'What the job involves (optional)', format: 'textarea', maxLength: 2000 },
      where: { type: 'string', title: 'Where the work happens (optional)', maxLength: 120 },
      business: { type: 'string', title: 'Business name (optional)', maxLength: 80 },
    },
    required: ['role'],
  },
  output: {
    type: 'object',
    properties: {
      post: { type: 'string' },
      questions: { type: 'array', items: { type: 'string' } },
      testTask: { type: 'string' },
      scorecard: { type: 'array', items: { type: 'object' } },
      checks: { type: 'array', items: { type: 'string' } },
      notes: { type: 'array', items: { type: 'string' } },
      kit: { type: 'object' },
      ai: { type: 'boolean' },
    },
    required: ['post', 'questions', 'testTask', 'scorecard', 'notes'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const role = text.titleCase(text.oneLine(input.role || 'Helper')).slice(0, 80);
    const fam = H.roleOf(`${role} ${input.duties || ''} ${b.what || ''}`);
    const own = String(input.duties || '').split(/\r?\n|;/).map((x) => text.oneLine(x.replace(/^[-*\d.)\s]+/, ''))).filter((x) => x.length > 3).slice(0, 8);
    const fallback = () => ({
      about: `${b.name ? `${b.name} does ${b.what || 'local work'}${b.city ? ` in ${b.city}` : ''}.` : 'We are a small local business.'} We are hiring ${text.withA(role.toLowerCase())}. You will work with the owner directly and learn our way of doing the job from a written checklist.`,
      duties: own.length ? own : DUTIES[fam],
      needs: NEEDS[fam],
      questions: H.SCREEN[fam],
      testTask: TEST[fam],
      scorecard: H.SCORECARD[fam].map((c) => ({ criterion: c, good: '' })),
    });
    const passes = (d) => d.questions.length === 5
      && d.questions.every((q) => H.protectedProblems(q).length === 0)
      && H.protectedProblems([d.about, ...d.duties, ...d.needs, d.testTask].join('\n')).length === 0
      && H.postProblems([d.about, ...d.duties, ...d.needs].join('\n')).length === 0
      && !/\$\s?\d/.test([d.about, ...d.duties, ...d.needs].join(' '))
      && d.scorecard.length >= 4
      && ai.cleanCopy(d);
    const res = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write hiring materials for a small business owner to use themselves. Ask and describe only what the job needs: skills, experience, the hours, and the physical or technical parts of the work. Never ask or hint at age, family, pregnancy, health or disability, religion, national origin or language background, race, sex, sexual orientation, arrest or criminal history, or past pay. No words like young, energetic, recent grad, digital native or native speaker. Never mention pay amounts (the owner adds the pay range). Plain, warm and short.',
      prompt: [`Role: ${role}`, b.name ? `Business: ${b.name}${b.what ? ` (${b.what})` : ''}${b.city ? `, ${b.city}` : ''}` : '', input.hours ? `Hours: ${input.hours}` : '', input.where ? `Where: ${input.where}` : '', own.length ? `The owner says the job involves:\n${own.join('\n')}` : '', 'Return: about (2 or 3 sentences), duties (4 to 6), needs (3 to 5), questions (exactly 5 screening questions), testTask (a short paid trial task), scorecard (5 criteria, each with what good looks like).'].filter(Boolean).join('\n'),
      schema: SCHEMA,
      maxTokens: 1800,
      fallback,
      accept: passes,
    });
    const d = passes(res.data) ? res.data : fallback();
    const usedAi = res.ai && d === res.data;
    const post = [
      `${role}${b.name ? `, ${b.name}` : ''}`,
      [input.where || b.city || '', input.hours || ''].filter(Boolean).join('. '),
      payLine(input.pay),
      '',
      d.about,
      '',
      'What you will do:',
      ...d.duties.map((x) => `- ${x}`),
      '',
      'What you need:',
      ...d.needs.map((x) => `- ${x}`),
      '',
      'To apply, reply with a few lines about work like this you have done and the days you can work. We reply to everyone who applies.',
      'We welcome applicants of every background.',
    ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').replace(/^\n+/, '');
    const checks = [...new Set([...H.postProblems(post).map((p) => `"${p.word}" in the post: try ${p.swap}`), ...d.questions.flatMap((q) => H.protectedProblems(q).map((k) => `A question touches ${k}: remove it`))])];
    const notes = [
      input.pay ? '' : 'Add the pay range before you post it. Several states require one in every job post.',
      'This kit is for you to use. It does not read, rank or screen applicants: you decide, using the same questions and scorecard for everyone.',
      'Ask about criminal history only after an offer, if at all, and never about past pay. Many states and cities bar both. Check your state\'s rules.',
      'Employee or contractor? It depends on how the work is done, not on what you call it. The IRS and your state each have their own tests. Ask a pro.',
    ].filter(Boolean);
    const scorecard = d.scorecard.slice(0, 6).map((s) => ({ criterion: text.clip(s.criterion, 80), good: text.clip(s.good || '', 200) }));
    const html = page({
      title: `Hiring kit: ${role}`,
      kicker: b.name || 'Hiring',
      lede: 'A job post, screening questions, a paid test task and a scorecard. Use the same ones for everyone.',
      body: `<h2>Job post</h2><div class="card"><pre>${esc(post)}</pre></div>
<h2>Five screening questions</h2><ol>${d.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
<h2>Paid test task</h2><div class="card">${esc(d.testTask)}</div>
<h2>Interview scorecard</h2><p class="muted">Candidate: <span class="line"></span> Date: <span class="line short"></span> Interviewer: <span class="line"></span></p><table><tr><th>What we look for</th><th>What good looks like</th><th>1 to 5</th><th>Notes</th></tr>${scorecard.map((s) => `<tr><td>${esc(s.criterion)}</td><td>${esc(s.good)}</td><td>&#9633; &#9633; &#9633; &#9633; &#9633;</td><td></td></tr>`).join('')}</table>
<h2>Before you post</h2><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul><p class="muted">Rules: eeoc.gov/prohibited-employment-policiespractices. Worker status: irs.gov, independent contractor or employee.</p>`,
      footer: 'Fill the scorecard in by hand during each interview.',
    });
    const kit = await save.saveFile(ctx, save.fileName(role, 'hiring-kit', '.html'), html);
    ctx.log(`Wrote a hiring kit for ${role}${usedAi ? '' : ' from the templates'}`);
    return { post, questions: d.questions.slice(0, 5), testTask: d.testTask, scorecard, checks, notes, kit, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      views.copy('Job post', out.post),
      views.table([{ key: 'n', label: '#' }, { key: 'q', label: 'Screening question' }], out.questions.map((q, i) => ({ n: i + 1, q }))),
      views.text(`Paid test task: ${out.testTask}`),
      views.table([{ key: 'criterion', label: 'Scorecard' }, { key: 'good', label: 'What good looks like' }], out.scorecard),
      ...(out.checks || []).map((c) => views.text(c)),
      ...out.notes.map((n) => views.text(n)),
      views.file(out.kit, 'Hiring kit to print')
    );
  },
};
