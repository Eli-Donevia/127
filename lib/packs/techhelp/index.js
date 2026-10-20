// Tech help at home: your first 25 people and places, an offer with a first-clients ladder, answers to
// replies, quotes and invoices, the new client's booking texts and first visit checklist, and the
// signature: a visit plan from the client's devices and issues, a printable scam warning card from
// the FTC's advice, password manager steps the client does themselves, and the note after the visit.
// Then reviews and referrals, proof, the next 25 and a website. Trust first, because many clients are
// older adults: the member never sees or keeps a password, never uses remote access, never touches
// the client's money, and nothing here rushes anyone.
// Niche facts live in data/niche.json and data/visit.json (sources: research/niches/techhelp.json).

const C = require('../_kit/common');
const { planVisitTool, scamCardTool, visitNoteTool } = require('./tools/visit-kit');

const N = C.load(__dirname);
const t = {
  first: C.first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  plan: planVisitTool(N),
  card: scamCardTool(N),
  note: visitNoteTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  storyCard: C.storyCardTool(N),
  next: C.next25Tool(N),
  ready: C.readyTool(N),
};
const W = t.win.input.properties;
const P = t.plan.input.properties;
const S = t.note.input.properties;

module.exports = {
  id: 'techhelp',
  title: 'Tech help at home',
  version: '1.0.0',
  business: true,
  summary: 'Start tech help at home: your first 25 people and places, a priced offer, answers to replies, quotes, a visit plan with a printable scam card, the note after each visit and the next 25 when you want more.',
  niches: ['tech help', 'tech help at home', 'computer help', 'senior tech help', 'tech support at home', 'phone help'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'techhelp.first_25',
      title: 'Your first 25',
      promise: '15 people you know with a personal text each, plus 10 senior centers, libraries, churches and buildings to ask, each within their rules. Visit rules first.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'techhelp.offer', why: 'Set your price per visit before the first person asks.' },
        { id: 'techhelp.reply', why: 'A person or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'techhelp.offer',
      title: 'Offer builder',
      promise: 'Your price per visit from real local ranges, a first-clients ladder, a money model and a one-page offer sheet that says how you keep it safe.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'techhelp.quote', why: 'Someone asked how much: quote one visit or a set of 3.' },
        { id: 'techhelp.ready', why: 'Put these prices on a website, a Google profile and a flyer.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what a person or a place wrote back: what it means, a calm answer with one next step, and your Pipeline updated for Do my day.',
      next: [
        { id: 'techhelp.quote', why: 'They asked about price: send the quote.' },
        { id: 'techhelp.new_client', why: 'They said yes: log the client and send the booking texts.' },
      ],
    }),
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for one visit, a set of 3 or a short visit at your founding, intro or full price, and the invoice from the same lines when they say yes.',
      next: [
        { id: 'techhelp.new_client', why: 'They booked: the booking, prep and reminder texts and the checklist.' },
        { id: 'techhelp.reply', why: 'They wrote back with a question first: answer it.' },
      ],
    }),
    {
      id: 'techhelp.new_client',
      title: 'Log a new client',
      promise: 'A client said yes: the win logged in your Pipeline, booking, prep and reminder texts, a first visit checklist with the visit rules, and the invoice.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['who'],
        properties: {
          who: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name'),
          package: W.package,
          when: W.when,
          where: W.where,
          rate: W.rate,
          price: W.price,
          invoice: W.invoice,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: C.winSteps(t, { input: C.passInputs(['who', 'package', 'when', 'where', 'rate', 'price', 'invoice', 'business', 'phone']) }),
      result: ['log', 'invoice'],
      next: [
        { id: 'techhelp.visit_kit', why: 'Before the first visit: the visit plan and the scam card to print.' },
        { id: 'techhelp.keep', why: 'After a few visits: thank-you, honest review ask and referral ask.' },
      ],
    },
    {
      id: 'techhelp.visit_kit',
      title: 'Visit plan and scam card',
      promise: 'Their devices and issues give a timed visit plan, a printable FTC scam card and password manager steps they do themselves. After the visit: the note.',
      minutes: 10,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name'),
          devices: P.devices,
          issues: { ...P.issues, description: 'One per line, in their words, most important first. Needed before the visit.' },
          minutes: P.minutes,
          when: P.when,
          family: { type: 'string', maxLength: 120, title: 'Family member or friend (optional)', description: "Before the visit: who'll be there. After: who gets a copy of the note, only with the client's okay." },
          trusted: t.card.input.properties.trusted,
          after: { type: 'boolean', default: false, title: 'After the visit: write the note', description: 'Skips the plan and the card, and writes the note from what you did' },
          done: { ...S.done, title: 'After the visit: what you did', description: 'One per line, in plain words. Never a password.' },
          practice: { ...S.practice, title: 'After the visit: what to practice (optional)' },
          left: { ...S.left, title: 'After the visit: left for next time (optional)' },
          next_visit: S.next_visit,
          business: P.business,
        },
      },
      steps: [
        { id: 'plan', tool: t.plan.name, input: C.passInputs(['client', 'devices', 'issues', 'minutes', 'when', 'family', 'after', 'business']) },
        { id: 'card', tool: t.card.name, input: C.passInputs(['client', 'trusted', 'after']) },
        { id: 'note', tool: t.note.name, when: '$inputs.after', input: C.passInputs(['client', 'done', 'practice', 'left', 'next_visit', 'family', 'business']) },
      ],
      result: ['plan', 'card', 'note'],
      next: [
        { id: 'techhelp.keep', why: 'After a few visits: thank-you, honest review ask and referral ask.' },
        { id: 'techhelp.proof', why: "A client is happy: ask to share their words, in writing." },
      ],
    },
    {
      id: 'techhelp.keep',
      title: 'Reviews and referrals',
      promise: 'After a few visits: a thank-you, an honest review ask with no reward attached, a referral ask and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'techhelp.proof', why: "Turn a happy client's own words into a story, with their written yes." },
        { id: 'techhelp.next_25', why: 'Keep Do my day stocked with the next people and places.' },
      ],
    },
    C.proofWorkflow(N, { story: t.story, card: t.storyCard }, {
      promise: "A short story from a client's own words, the exact permission ask and an honest review ask, then a story card and caption once they say yes in writing.",
      next: [
        { id: 'techhelp.next_25', why: 'Story in hand: reach the next 25 people and places.' },
        { id: 'techhelp.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 people and places (senior centers, libraries, churches, buildings), skipping everyone already in your Pipeline, with messages ready in Do my day.',
      next: [
        { id: 'techhelp.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'techhelp.ready', why: 'Look ready before new people look you up.' },
      ],
    }),
    C.readyWorkflow(N, t, {
      promise: 'A one-page website, a Google profile kit and a flyer, all with the same prices, promise and contact details, ready to put up today.',
      next: [
        { id: 'techhelp.next_25', why: 'Looking ready: reach the next 25 people and places.' },
        { id: 'techhelp.first_25', why: "Haven't started your list yet? Start with the people you know." },
      ],
    }),
  ],
};
