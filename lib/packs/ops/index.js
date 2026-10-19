// Ops desk: the tools to run the business (picked and priced), checklists that turn how you do a
// job into steps anyone can follow, and a packet for hiring a first helper with a paid trial.
// Every output is a file the member owns. notYet: the three things not to do yet.

const NOT_YET = [
  "Don't hire before you have done the job yourself at least ten times and written down how.",
  "Don't pay for software you won't open this week. Start on free plans and upgrade one tool when a limit actually stops you.",
  "Don't buy an all-in-one business suite or set up payroll yet. A booking link, a payment link and one checklist run the first customers.",
];

module.exports = {
  id: 'ops',
  title: 'Ops desk',
  version: '0.1.0',
  summary: 'Pick your starter tools with real prices, turn how you work into checklists, and hire your first helper with a paid trial.',
  niches: [],
  notYet: NOT_YET,
  tools: [require('./tools/tool-stack'), require('./tools/sop'), require('./tools/hire-helper')],
  workflows: [
    {
      id: 'ops.pick_stack',
      title: 'Pick my starter tools',
      promise: 'One tool for each job, with the free plan, the first paid plan and the date we checked the price.',
      minutes: 3,
      tier: 'free',
      inputs: {
        type: 'object',
        properties: {
          what: { type: 'string', title: 'What do you sell?', description: 'For example "house cleaning" or "digital planners"' },
          model: { type: 'string', title: 'How you sell', enum: ['auto', 'local', 'service', 'products', 'digital'], default: 'auto' },
          budget: { type: 'string', title: 'Budget for tools', enum: ['free', 'some'], default: 'free' },
        },
      },
      steps: [{ id: 'stack', tool: 'ops.tool_stack', input: { what: '$inputs.what', model: '$inputs.model', budget: '$inputs.budget' } }],
      result: ['stack'],
      next: ['ops.write_sop'],
    },
    {
      id: 'ops.write_sop',
      title: 'Turn how I work into a checklist',
      promise: 'Paste a voice note or rough notes and get a printable step by step checklist, plus a copy for Notion.',
      minutes: 5,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          task: { type: 'string', title: 'Which job?', description: 'For example "Standard home clean"' },
          notes: { type: 'string', title: 'How you do it (optional)', description: 'Paste a voice-note transcript or rough notes' },
          who: { type: 'string', title: 'Who will use it', enum: ['me', 'helper'], default: 'me' },
        },
        required: ['task'],
      },
      steps: [{ id: 'sop', tool: 'ops.sop', input: { task: '$inputs.task', notes: '$inputs.notes', who: '$inputs.who' } }],
      result: ['sop'],
      next: ['ops.hire_first_helper'],
    },
    {
      id: 'ops.hire_first_helper',
      title: 'Hire my first helper',
      promise: 'A checklist for the job, a job post, a paid trial, a scorecard and interview questions, with where to check the rules.',
      minutes: 10,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          role: { type: 'string', title: 'Who do you need?', description: 'For example "cleaning helper"' },
          task: { type: 'string', title: 'The main job they will do', description: 'For example "Standard home clean"' },
          notes: { type: 'string', title: 'How you do that job (optional)', description: 'Paste a voice-note transcript or rough notes' },
          pay: { type: 'number', title: 'Pay (optional)' },
          payType: { type: 'string', title: 'Pay is', enum: ['per hour', 'per job'], default: 'per hour' },
          hours: { type: 'string', title: 'When (optional)' },
          city: { type: 'string', title: 'City (optional)' },
        },
        required: ['role', 'task'],
      },
      steps: [
        { id: 'sop', tool: 'ops.sop', input: { task: '$inputs.task', notes: '$inputs.notes', who: 'helper' } },
        { id: 'packet', tool: 'ops.hire_helper', input: { role: '$inputs.role', city: '$inputs.city', pay: '$inputs.pay', payType: '$inputs.payType', hours: '$inputs.hours', sop: '$sop.sop' } },
      ],
      result: ['packet', 'sop'],
      next: ['ops.pick_stack'],
    },
  ],
};
