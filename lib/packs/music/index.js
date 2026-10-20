// Music lessons: your first 25 people and places, an offer with a first-students ladder, answers to
// replies, quotes and invoices, the new student's booking and first lesson checklist, the note parents
// read after every lesson, the 4-week lesson plan with a practice log and a studio policy (this pack's
// own tool), reviews and referrals, proof, the next 25 and a website. Safety with minors comes first:
// parents book, lessons happen where a parent can see or hear, and no messages go to students under 18.
// Niche facts live in data/niche.json (sources: research/niches/music.json).

const C = require('../_kit/common');
const { lessonNoteTool } = require('./tools/lesson-note');
const { lessonPlanTool } = require('./tools/lesson-plan');
const { musicReadyTool } = require('./lib/ready');

const N = C.load(__dirname);
const t = {
  first: C.first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  note: lessonNoteTool(N),
  plan: lessonPlanTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  card: C.storyCardTool(N),
  next: C.next25Tool(N),
  ready: musicReadyTool(N),
};
const W = t.win.input.properties;
const P = t.note.input.properties;
const LP = t.plan.input.properties;

// The website step also takes the music lesson headline from the facts (lib/ready.js).
const ready = C.readyWorkflow(N, t, {
  promise: 'A one-page website, a Google profile kit and a flyer, all with the same prices, promise and contact details, ready to put up today.',
  next: [
    { id: 'music.next_25', why: 'Looking ready: reach the next 25 people and places.' },
    { id: 'music.first_25', why: "Haven't started your list yet? Start with the people you know." },
  ],
});
ready.steps = ready.steps.map((s) => (s.id === 'site' ? { ...s, input: { ...s.input, copy: '$facts.copy' } } : s));

module.exports = {
  id: 'music',
  title: 'Music lessons',
  version: '1.0.0',
  business: true,
  summary: 'Start teaching music lessons: your first 25 people and places with safety rules first, a priced offer, answers to replies, quotes, a first lesson checklist, a 4-week lesson plan with a practice log and studio policy, notes for parents and the next 25 when you want more.',
  niches: ['music lessons', 'music teacher', 'piano lessons', 'piano teacher', 'guitar lessons', 'guitar teacher', 'voice lessons', 'singing lessons', 'violin lessons', 'drum lessons', 'ukulele lessons'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'music.first_25',
      title: 'Your first 25',
      promise: '15 people you know with a personal text each, plus 10 local places to ask, like schools, churches and libraries, each ask within their rules. Safety first.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'music.offer', why: 'Set your price per lesson before the first family asks.' },
        { id: 'music.reply', why: 'A parent or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'music.offer',
      title: 'Offer builder',
      promise: 'Your price per lesson from real local ranges, a first-students ladder, a money model and a one-page offer sheet parents can read.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'music.quote', why: 'A family asked how much: quote one lesson or a block of 4.' },
        { id: 'music.lesson_plan', why: 'Write your studio policy for missed lessons, payment and recitals before the first lesson.' },
        { id: 'music.ready', why: 'Put these prices on a website, a Google profile and a flyer.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what a parent, a student or a place wrote back: what it means, a short answer with one next step, and your Pipeline updated for Do my day.',
      next: [
        { id: 'music.quote', why: 'They asked about price or a block: send the quote.' },
        { id: 'music.new_student', why: 'They said yes: log the student and send the booking texts.' },
        { id: 'music.lesson_plan', why: 'They asked about missed lessons or payment: send your studio policy.' },
      ],
    }),
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for one lesson or a block of 4 at your founding, intro or full price, and the invoice from the same lines when the family says yes.',
      next: [
        { id: 'music.new_student', why: 'They booked: the booking, prep and reminder texts and the first lesson checklist.' },
        { id: 'music.lesson_plan', why: 'Send the studio policy and the plan for the first 4 weeks with the booking.' },
      ],
    }),
    {
      id: 'music.new_student',
      title: 'New student and lesson notes',
      promise: 'A student said yes: the win logged, booking, prep and reminder texts and a first lesson checklist. After each lesson: a short note to the parent.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['student'],
        properties: {
          parent: C.pipelinePick("Parent's name (or the adult student's)", 'Pick from your Pipeline or type their name'),
          student: P.student,
          new_student: { type: 'boolean', default: false, title: 'A new student said yes', description: 'Logs the win and writes the booking, prep and reminder texts and the first lesson checklist' },
          package: { ...W.package, title: 'New student: what they booked' },
          sessions: { ...W.sessions, title: 'New student: lessons agreed (optional)' },
          when: { ...W.when, title: 'New student: first lesson day and time' },
          where: W.where,
          rate: { ...W.rate, title: 'New student: price' },
          invoice: W.invoice,
          instrument: P.instrument,
          worked_on: P.worked_on,
          went_well: P.went_well,
          practice: P.practice,
          next: P.next,
          next_date: P.next_date,
          price: W.price,
          link: W.link,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: [
        ...C.winSteps(t, {
          flag: '$inputs.new_student',
          input: { who: '$inputs.parent', for: '$inputs.student', package: '$inputs.package', sessions: '$inputs.sessions', when: '$inputs.when', where: '$inputs.where', rate: '$inputs.rate', price: '$inputs.price', invoice: '$inputs.invoice', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
        }),
        { id: 'note', tool: t.note.name, input: C.passInputs(['student', 'parent', 'instrument', 'worked_on', 'went_well', 'practice', 'next', 'next_date', 'new_student']) },
      ],
      result: ['log', 'invoice', 'note'],
      next: [
        { id: 'music.lesson_plan', why: 'The first 4 weeks of lessons, a practice log for home and your studio policy, printable.' },
        { id: 'music.keep', why: 'After a block of lessons: thank-you, honest review ask and referral ask.' },
      ],
    },
    {
      id: 'music.lesson_plan',
      title: 'Lesson plan and practice log',
      promise: 'Instrument, level and age give the first 4 weeks of lessons, a printable practice log and a studio policy page for missed lessons, payment and recitals.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['student', 'age'],
        properties: { ...LP, parent: C.pipelinePick("Parent's name (or the adult student's)", 'For students under 18, the text goes to the parent, never the student') },
      },
      steps: [{ id: 'plan', tool: t.plan.name, input: C.passInputs(Object.keys(LP)) }],
      result: ['plan'],
      next: [
        { id: 'music.new_student', why: 'After each lesson: a short note to the parent with what to practice.' },
        { id: 'music.keep', why: 'After a block of lessons: a thank-you, an honest review ask and a referral ask.' },
      ],
    },
    {
      id: 'music.keep',
      title: 'Reviews and referrals',
      promise: 'After a block of lessons: a thank-you to the parent, an honest review ask with no reward attached, a referral ask and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'music.proof', why: "Turn a happy parent's own words into a story, with their written yes." },
        { id: 'music.next_25', why: 'Keep Do my day stocked with the next people and places.' },
      ],
    },
    C.proofWorkflow(N, t, {
      promise: "A short story from a parent's own words, the exact permission ask and an honest review ask, then a story card and caption once they say yes in writing.",
      next: [
        { id: 'music.next_25', why: 'Story in hand: reach the next 25 people and places.' },
        { id: 'music.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 people and places, skipping everyone already in your Pipeline, each with a message ready in Do my day. Safe to repeat every Monday.',
      next: [
        { id: 'music.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'music.ready', why: 'Look ready before new families look you up.' },
      ],
    }),
    ready,
  ],
};
