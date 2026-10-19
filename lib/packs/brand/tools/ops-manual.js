// One operations manual from the member's own notes: every job as numbered steps, how the business
// sounds, a normal week, the rules and the decisions still to make, tools, who to call and what to
// do when something goes wrong. AI only tidies the job steps, and only steps grounded in the notes
// are kept; the splitter does the same job without AI.

const { views, save, ai, text, time } = require('../../_kit');
const { specFrom } = require('../lib/kit');
const V = require('../lib/voice');
const W = require('../lib/welcome');
const M = require('../lib/manual');

const SCHEMA = {
  type: 'object',
  properties: {
    jobs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 60 },
          steps: { type: 'array', minItems: 2, maxItems: 14, items: { type: 'object', properties: { title: { type: 'string', maxLength: 90 }, detail: { type: 'string', maxLength: 200 } }, required: ['title'] } },
        },
        required: ['name', 'steps'],
      },
    },
  },
  required: ['jobs'],
};

const STOP = new Set('the a an and or but to of for in on at by with from into onto your you our we us it its this that then than so as is are be been was were do does did done have has had will would can could should just also very really all any each every some more most less one two three four five'.split(' '));
const stem = (w) => w.replace(/(ings?|ed|es|s)$/, '');
function wordsOf(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);
}
// An AI step is kept only when most of its words are in the member's notes.
function grounded(step, notes) {
  const ws = wordsOf(`${step.title} ${step.detail || ''}`);
  if (!ws.length) return false;
  return ws.filter((w) => notes.has(w)).length / ws.length >= 0.6;
}

module.exports = {
  name: 'brand.ops_manual',
  title: 'Operations manual',
  description: 'Turns your notes on each job into numbered steps and builds one operations manual: at a glance, how you sound, the jobs, a normal week, your rules and what is still to decide, your tools, who to call and what to do when something goes wrong.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 4,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      jobs: { type: 'string', format: 'textarea', title: 'Your jobs and how you do them', maxLength: 6000 },
      hours: { type: 'string', title: 'When you work (optional)', maxLength: 80 },
      tools: { type: 'string', format: 'textarea', title: 'Apps and tools you use (optional)', maxLength: 1200 },
      contacts: { type: 'string', format: 'textarea', title: 'Who to call (optional)', maxLength: 1200 },
      rules: { type: 'string', format: 'textarea', title: 'Your rules (optional)', maxLength: 2000 },
      who: { type: 'string', title: 'Who reads it', enum: ['helper', 'me'], default: 'helper' },
      palette: { title: 'Colors (optional)' },
    },
  },
  output: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      jobs: { type: 'array' },
      rules: { type: 'array' },
      decide: { type: 'array' },
      tools: { type: 'array' },
      contacts: { type: 'array' },
      page: { type: 'object' },
      doc: { type: 'object' },
      starting: { type: 'boolean' },
      ai: { type: 'boolean' },
    },
    required: ['jobs', 'page', 'doc'],
  },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    const name = spec.name || '';
    const n = spec.niche;
    const group = W.GROUP[n.id] || 'onsite';
    const label = spec.known ? spec.descriptor.toLowerCase() : '';
    const parsed = M.jobsFrom(input.jobs).map((j) => {
      const t = M.timeOf(j.notes);
      return { ...j, time: t.time, notes: t.notes };
    });
    let jobs = parsed.map((j) => ({ name: j.name, time: j.time, from: 'yours', steps: M.stepsFrom(j.notes) }));
    let usedAi = false;
    if (parsed.length) {
      const notes = new Set(wordsOf(parsed.map((j) => `${j.name} ${j.notes}`).join(' ')));
      const { data, ai: ok } = await ai.aiJson(ctx, {
        task: 'write',
        system: 'You turn a small business owner\'s rough notes into clear job checklists. Use only what the notes say: split long sentences into steps, keep the order, keep their words. Never add a step, a tool, a time or a rule the notes do not mention. Each step title starts with a verb.',
        prompt: `Business: ${name || 'a small business'}${spec.what || label ? ` (${spec.what || label})` : ''}\nWho reads it: ${input.who === 'me' ? 'the owner' : 'a helper'}\n\n${parsed.map((j) => `Job: ${j.name}\nNotes: ${j.notes}`).join('\n\n')}\n\nReturn every job, in the same order, with the same names.`,
        schema: SCHEMA,
        maxTokens: 2500,
        fallback: () => ({ jobs: jobs.map((j) => ({ name: j.name, steps: j.steps })) }),
        accept: (d) => ai.cleanCopy(d) && d.jobs.length === parsed.length && d.jobs.every((j, i) => text.oneLine(j.name).toLowerCase() === parsed[i].name.toLowerCase() && j.steps.every((s) => grounded(s, notes))),
      });
      if (ok) {
        usedAi = true;
        jobs = data.jobs.map((j, i) => ({ name: parsed[i].name, time: parsed[i].time, from: 'yours', steps: j.steps.map((s) => ({ title: text.sentenceCase(text.oneLine(s.title)).replace(/[.]+$/, ''), detail: s.detail ? `${text.sentenceCase(text.oneLine(s.detail)).replace(/[.]+$/, '')}.` : '' })) }));
      }
    }
    const starting = !jobs.some((j) => j.steps.length);
    const startName = { orders: 'An order, start to finish', online: 'A client project', lessons: 'A lesson', events: 'An event', visit: 'An appointment' }[group] || (label ? text.sentenceCase(`${text.withA(label)} job`) : 'A typical job');
    if (starting) jobs = [{ name: startName, from: 'starting', steps: M.START_JOB[group].map(([title, detail]) => ({ title, detail })) }];
    jobs = jobs.filter((j) => j.steps.length);

    const tone = V.TONE_FOR_MOOD[spec.mood] || 'friendly';
    const online = ['templates', 'content', 'apparel', 'jewelry', 'candles', 'resale', 'art'].includes(n.id);
    const v = V.templateVoice({ name: name || 'us', label, cityShort: String(spec.city || '').split(',')[0].trim(), firstName: spec.firstName, price: spec.price, promise: n.promise, result: n.result, pain: n.pain, trust: n.trust, tone, online });
    const keep = online ? ['Order confirmed', 'Order running late', 'After delivery'] : ['Booking confirmed', 'Running late', 'After the job'];
    const voice = { words: v.words, do: v.do.slice(0, 4), dont: v.dont.slice(0, 3), lines: v.lines.filter((l) => keep.includes(l.use)) };
    const rules = M.rulesFrom(input.rules);
    const decide = M.stillToDecide(rules, group);
    const tools = M.toolsFrom(input.tools);
    const contacts = M.contactsFrom(input.contacts);
    const hours = text.oneLine(input.hours || '');
    const today = time.today(ctx);
    const helper = input.who !== 'me';
    const m = {
      name,
      purpose: helper ? `So anyone helping${name ? ` at ${name}` : ''} can run each job the same way, without having to ask.` : 'So nothing gets skipped on a busy day, and handing a job to a helper later is easy.',
      updated: time.longDate(today),
      glance: [
        ['What we do', text.clip(spec.what || label, 60) || 'Add yours'],
        ['Where', String(spec.city || '').split(',')[0].trim() || (group === 'online' ? 'Online' : 'Add your area')],
        ['Hours', hours || 'Add yours'],
        ['Jobs', text.clip(text.list(jobs.map((j) => j.name)), 70)],
        ['Main tools', tools.length ? text.clip(text.list(tools.slice(0, 4).map((t) => t.name)), 70) : 'Add yours'],
        ['Questions go to', spec.firstName ? `${spec.firstName}, the owner` : 'The owner'],
      ],
      voice,
      jobs,
      hours,
      week: M.WEEK,
      rules,
      decide,
      tools,
      contacts,
      playbook: M.playbook(v, group),
      from: starting ? 'The job checklist is a starting point; add your notes to make it yours.' : `The jobs come from your notes${usedAi ? ', tidied into steps (every step is from your notes)' : ''}. The routine and what to do when something goes wrong are starting points.`,
    };
    const base = [name, 'operations manual'].filter(Boolean);
    const page = await save.saveFile(ctx, save.fileName(...base, '.html'), M.manualHtml(m, spec));
    const doc = await save.saveFile(ctx, save.fileName(...base, '.md'), M.manualMd(m));
    ctx.log(`Manual: ${text.plural(jobs.length, 'job')} (${jobs.reduce((a, j) => a + j.steps.length, 0)} steps), ${text.plural(rules.length, 'rule')}, ${text.plural(decide.length, 'decision')} still to make.`);
    return { name, jobs, rules, decide: decide.map((d) => d.q), tools, contacts, page, doc, starting, ai: usedAi };
  },
  view(out) {
    return views.blocks(
      out.starting ? views.text('No job notes yet, so the manual starts with a checklist for a typical job. Add how you do each job, like "Full detail: vacuum seats, then wipe the dash", and run it again.') : null,
      views.metric('Jobs written up', out.jobs.length, `${out.jobs.reduce((a, j) => a + j.steps.length, 0)} steps in all`),
      views.cards(out.jobs.map((j) => ({ title: j.name, subtitle: j.time || undefined, body: j.steps.map((s, i) => `${i + 1}. ${s.title}.`).join(' ') }))),
      out.decide.length ? views.cards([{ title: out.rules.length ? 'Still to decide' : 'Decide these and write them down', body: out.decide.join(' ') }]) : null,
      views.file(out.page, 'Your operations manual (printable)'),
      views.file(out.doc, 'The same manual as a Markdown file for Google Docs or Notion')
    );
  },
};
