// Eli's Playbook tools (lib/ai.js) as harness tools, each with a one-step workflow, so HQ v2 runs them
// next to every other pack. Same prompts and library playbooks as /app/tools; the call goes through
// the harness (model router, credits, spending limits). The /app/tools pages keep using lib/ai.js.

const ai = require('../../ai');
const db = require('../../db');

// Planning tools think longer (Opus at medium effort); the rest write (Opus at low effort).
const PLAN = new Set(['offer-validator', 'interview-synthesizer', 'offer-stack', 'launch-planner', 'sales-call-prep', 'campaign-planner']);
const MINUTES = { 'interview-synthesizer': 5, 'outreach-writer': 3, 'sales-call-prep': 3, 'workflow-recommender': 4 };
// Start's groups (lib/harness/jobs.js).
const JOB = {
  'offer-validator': 'offer',
  'interview-synthesizer': 'offer',
  'offer-stack': 'offer',
  'launch-planner': 'offer',
  'content-planner': 'content',
  'hook-writer': 'content',
  'outreach-writer': 'leads',
  'sales-call-prep': 'sales',
  'campaign-planner': 'ads',
  'workflow-recommender': 'ops',
};
// Start's name where another pack has the same one (the library's offer pack has an "Offer builder").
const TITLE = { 'offer-stack': 'Quick one-page offer' };
// Start's line where the tools page's own words would trip 127's copy check (on Start, 127 is talking).
const PROMISE = { 'offer-stack': "Turn what you sell into a one-page offer: the promise, what's included, what makes it safe to say yes, and the price framing." };
// Roughly what each saves against doing it by hand, for the receipts on Today.
const SAVES = { 'offer-validator': 45, 'interview-synthesizer': 60, 'offer-stack': 90, 'launch-planner': 60, 'content-planner': 90, 'hook-writer': 45, 'outreach-writer': 30, 'sales-call-prep': 45, 'campaign-planner': 60, 'workflow-recommender': 45 };

const nameOf = (slug) => `playbooks.${slug.replace(/-/g, '_')}`;

function inputSchema(tool) {
  const properties = {};
  const required = [];
  for (const f of tool.fields) {
    const p = { type: 'string', title: f.label.replace(/\s*\(optional\)\s*$/i, '') };
    if (f.placeholder) p.description = f.placeholder;
    if (Array.isArray(f.options) && f.options.length) p.enum = f.options.map((o) => (typeof o === 'string' ? o : o.value));
    else p.maxLength = f.max || (f.type === 'textarea' ? 4000 : 400);
    if (f.type === 'textarea') p.format = 'textarea';
    properties[f.name] = p;
    if (!f.optional) required.push(f.name);
  }
  return { type: 'object', properties, required };
}

const OUTPUT = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    tool: { type: 'string' },
    flags: { type: 'array', items: { type: 'string' } },
    sample: { type: 'boolean' },
  },
  required: ['text', 'tool'],
};

// The member's own record, for their profile and worksheets; a bare stand-in in pack tests.
function memberOf(ctx) {
  const user = db.get('users', ctx.member.id);
  return user || { id: ctx.member.id, tier: ctx.member.tier, name: ctx.member.firstName };
}

function toolFor(t) {
  return {
    name: nameOf(t.slug),
    title: TITLE[t.slug] || t.name,
    description: t.blurb,
    kind: 'ai',
    risk: 'draft',
    credits: PLAN.has(t.slug) ? 15 : 10,
    tasks: [PLAN.has(t.slug) ? 'plan' : 'write'],
    timeoutSec: 180,
    input: inputSchema(t),
    output: OUTPUT,
    async run(input, ctx) {
      const { system, prompt } = ai.toolPrompt(t, input, memberOf(ctx));
      const r = await ctx.ai({ task: PLAN.has(t.slug) ? 'plan' : 'write', system, prompt });
      if (r.sample) return { text: ai.demoTool(t, input), tool: t.slug, sample: true };
      const reply = ai.replyText(r.text);
      if (reply.error) throw new Error(reply.text);
      return { text: reply.text, tool: t.slug, ...(reply.flags ? { flags: reply.flags } : {}) };
    },
    view(out) {
      return [{ type: 'copy', label: t.framework || t.name, text: out.text }];
    },
  };
}

function workflowFor(t) {
  const schema = inputSchema(t);
  return {
    id: nameOf(t.slug),
    title: TITLE[t.slug] || t.name,
    promise: PROMISE[t.slug] || t.blurb,
    minutes: MINUTES[t.slug] || 2,
    tier: t.tier === 'free' ? 'free' : 'builder',
    job: JOB[t.slug],
    savesMinutes: SAVES[t.slug] || 30,
    starter: t.slug === 'offer-validator',
    inputs: schema,
    steps: [{ id: 'answer', tool: nameOf(t.slug), input: Object.fromEntries(Object.keys(schema.properties).map((k) => [k, `$inputs.${k}`])) }],
    result: ['answer'],
  };
}

const list = ai.TOOLS.filter((t) => !t.chat && Array.isArray(t.fields) && t.fields.length);

module.exports = {
  id: 'playbooks',
  title: "Eli's Playbook tools",
  version: '1.0.0',
  summary: 'Validate an idea, build the offer, plan the launch, write hooks and outreach, prep the sales call: the 127 AI tools, run from HQ.',
  niches: [],
  tools: list.map(toolFor),
  workflows: list.map(workflowFor),
};
