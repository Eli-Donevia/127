// Tutoring: your first 25 parents and places, an offer with a first-clients ladder, answers to
// replies, quotes and invoices, the new family's booking and first session checklist, the progress
// note parents read after every session, proof, the next 25 and a website. Safety with minors comes
// first: parents book, sessions happen where a parent can see, and no messages go to students.
// Niche facts live in data/niche.json (sources: research/niches/tutoring.json).

const C = require('../_kit/common');
const { progressNoteTool } = require('./tools/progress-note');

const N = C.load(__dirname);
const t = {
  first: C.first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  note: progressNoteTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  card: C.storyCardTool(N),
  next: C.next25Tool(N),
  ready: C.readyTool(N),
};
const W = t.win.input.properties;
const P = t.note.input.properties;

module.exports = {
  id: 'tutoring',
  title: 'Tutoring',
  version: '1.1.0',
  business: true,
  summary: 'Start tutoring: your first 25 parents and places with safety rules first, a priced offer, answers to replies, quotes, a first session checklist, notes for parents and the next 25 when you want more.',
  niches: ['tutoring', 'test prep'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'tutoring.first_25',
      title: 'Your first 25',
      promise: '15 parents you know with a personal text each, plus 10 local places to ask, each ask within their rules. Safety first.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'tutoring.offer', why: 'Set your price per session before the first parent asks.' },
        { id: 'tutoring.reply', why: 'A parent or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'tutoring.offer',
      title: 'Offer builder',
      promise: 'Your price per session from real local ranges, a first-clients ladder, a money model and a one-page offer sheet parents can read.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'tutoring.quote', why: 'A family asked how much: quote a block of sessions.' },
        { id: 'tutoring.ready', why: 'Put these prices on a website, a Google profile and a flyer.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what a parent or a place wrote back: what it means, a short answer with one next step, and your Pipeline updated for Do my day.',
      next: [
        { id: 'tutoring.quote', why: 'They asked about price or a block: send the quote.' },
        { id: 'tutoring.progress_note', why: 'They said yes: log the family and send the booking texts.' },
      ],
    }),
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for one session or a block at your founding, intro or full price, and the invoice from the same lines when the parent says yes.',
      next: [
        { id: 'tutoring.progress_note', why: 'They booked: the booking, prep and reminder texts and the checklist.' },
        { id: 'tutoring.reply', why: 'They wrote back with a question first: answer it.' },
      ],
    }),
    {
      id: 'tutoring.progress_note',
      title: 'New family and session notes',
      promise: 'A family said yes: the win logged, booking, prep and reminder texts and a first session checklist. After each session: a short note to the parent.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['student'],
        properties: {
          parent: C.pipelinePick("Parent's name", 'Pick from your Pipeline or type their name'),
          student: P.student,
          new_family: { type: 'boolean', default: false, title: 'A new family said yes', description: 'Logs the win and writes the booking, prep and reminder texts and the first session checklist' },
          package: { ...W.package, title: 'New family: what they booked' },
          when: { ...W.when, title: 'New family: first session day and time' },
          where: W.where,
          rate: { ...W.rate, title: 'New family: price' },
          invoice: W.invoice,
          subject: P.subject,
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
          flag: '$inputs.new_family',
          input: { who: '$inputs.parent', for: '$inputs.student', package: '$inputs.package', when: '$inputs.when', where: '$inputs.where', rate: '$inputs.rate', price: '$inputs.price', invoice: '$inputs.invoice', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
        }),
        { id: 'note', tool: t.note.name, input: C.passInputs(['student', 'parent', 'subject', 'worked_on', 'went_well', 'practice', 'next', 'next_date', 'new_family']) },
      ],
      result: ['log', 'invoice', 'note'],
      next: [
        { id: 'tutoring.keep', why: 'After a block of sessions: thank-you, honest review ask and referral ask.' },
        { id: 'tutoring.proof', why: 'A parent is happy: ask to share their words, in writing.' },
      ],
    },
    {
      id: 'tutoring.keep',
      title: 'Reviews and referrals',
      promise: 'After a block of sessions: a thank-you to the parent, an honest review ask with no reward attached, a referral ask and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'tutoring.proof', why: "Turn a happy parent's own words into a story, with their written yes." },
        { id: 'tutoring.next_25', why: 'Keep Do my day stocked with the next parents and places.' },
      ],
    },
    C.proofWorkflow(N, t, {
      promise: "A short story from a parent's own words, the exact permission ask and an honest review ask, then a story card and caption once they say yes in writing.",
      next: [
        { id: 'tutoring.next_25', why: 'Story in hand: reach the next 25 parents and places.' },
        { id: 'tutoring.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 parents and places, skipping everyone already in your Pipeline, each with a message ready in Do my day. Safe to repeat every Monday.',
      next: [
        { id: 'tutoring.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'tutoring.ready', why: 'Look ready before the new parents look you up.' },
      ],
    }),
    C.readyWorkflow(N, t, {
      promise: 'A one-page website, a Google profile kit and a flyer, all with the same prices, promise and contact details, ready to put up today.',
      next: [
        { id: 'tutoring.next_25', why: 'Looking ready: reach the next 25 parents and places.' },
        { id: 'tutoring.first_25', why: "Haven't started your list yet? Start with the parents you know." },
      ],
    }),
  ],
};
