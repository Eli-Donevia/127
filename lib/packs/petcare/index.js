// Dog walking and pet sitting: your first 25 people and partners, an offer with a first-clients
// ladder, answers to replies, quotes and invoices, the new client's booking, first visit checklist
// and intake form, the visit card after every visit, proof, the next 25 and a website. Trust first:
// a free meet and greet before any booking.
// Niche facts live in data/niche.json (sources: research/niches/petcare.json).

const C = require('../_kit/common');
const { intakeTool, visitCardTool } = require('./tools/visit-kit');

const N = C.load(__dirname);
const t = {
  first: C.first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  intake: intakeTool(N),
  card: visitCardTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  storyCard: C.storyCardTool(N),
  next: C.next25Tool(N),
  ready: C.readyTool(N),
};
const W = t.win.input.properties;
const V = t.card.input.properties;

module.exports = {
  id: 'petcare',
  title: 'Dog walking and pet sitting',
  version: '1.1.0',
  business: true,
  summary: 'Start dog walking and pet sitting: your first 25 people and partners, a priced offer, answers to replies, quotes, the intake form, visit cards, proof and the next 25 when you want more.',
  niches: ['dog walking', 'pet sitting'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'petcare.first_25',
      title: 'Your first 25',
      promise: '15 people you know with a personal text each, plus 10 vets, groomers, pet stores and buildings with a partner ask, and a meet and greet script.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'petcare.offer', why: 'Set your price per walk before the first owner asks.' },
        { id: 'petcare.reply', why: 'An owner or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'petcare.offer',
      title: 'Offer builder',
      promise: 'Your price per walk from real local ranges, a first-clients ladder, a money model and a one-page offer sheet pet owners can read.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'petcare.quote', why: 'An owner asked how much: quote walks or a pack.' },
        { id: 'petcare.ready', why: 'Put these prices on a website, a Google profile and door hangers.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what an owner or a place wrote back: what it means, a short answer with one next step, and your Pipeline updated for Do my day.',
      next: [
        { id: 'petcare.quote', why: 'They asked about price or a pack: send the quote.' },
        { id: 'petcare.visit_kit', why: 'They said yes after the meet and greet: log the client and send the booking texts.' },
      ],
    }),
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for walks, potty breaks or overnights at your founding, intro or full price, and the invoice from the same lines when they say yes.',
      next: [
        { id: 'petcare.visit_kit', why: 'They booked: booking texts, the intake form and the first visit checklist.' },
        { id: 'petcare.reply', why: 'They wrote back with a question first: answer it.' },
      ],
    }),
    {
      id: 'petcare.visit_kit',
      title: 'New client and visit cards',
      promise: 'A client said yes: the win logged, booking and prep texts, a first visit checklist and the intake form. After each visit: the visit card for the owner.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['pet'],
        properties: {
          owner: C.pipelinePick("Owner's name", 'Pick from your Pipeline or type their name'),
          pet: V.pet,
          new_client: { type: 'boolean', default: false, title: 'A new client said yes', description: 'Logs the win and writes the booking texts, the first visit checklist and the intake form' },
          package: { ...W.package, title: 'New client: what they booked' },
          when: { ...W.when, title: 'New client: first visit day and time' },
          rate: { ...W.rate, title: 'New client: price' },
          invoice: W.invoice,
          time_in: V.time_in,
          time_out: V.time_out,
          walk: V.walk,
          potty: V.potty,
          food: V.food,
          meds: V.meds,
          notes: V.notes,
          price: W.price,
          link: W.link,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: [
        ...C.winSteps(t, {
          flag: '$inputs.new_client',
          input: { who: '$inputs.owner', for: '$inputs.pet', package: '$inputs.package', when: '$inputs.when', rate: '$inputs.rate', price: '$inputs.price', invoice: '$inputs.invoice', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
        }),
        { id: 'intake', tool: t.intake.name, when: '$inputs.new_client', input: C.passInputs(['pet', 'business', 'phone']) },
        { id: 'card', tool: t.card.name, input: C.passInputs(['pet', 'owner', 'time_in', 'time_out', 'walk', 'potty', 'food', 'meds', 'notes', 'new_client']) },
      ],
      result: ['log', 'invoice', 'intake', 'card'],
      next: [
        { id: 'petcare.keep', why: 'After the first weeks: thank-you, honest review ask and referral ask.' },
        { id: 'petcare.proof', why: 'An owner is happy: ask to share their words and photo, in writing.' },
      ],
    },
    {
      id: 'petcare.keep',
      title: 'Reviews and referrals',
      promise: 'After the first weeks: a thank-you, an honest review ask with no reward attached, a referral ask for neighbors and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'petcare.proof', why: "Turn a happy owner's own words into a story, with their written yes." },
        { id: 'petcare.next_25', why: 'Keep Do my day stocked with the next people and places.' },
      ],
    },
    C.proofWorkflow(N, { story: t.story, card: t.storyCard }, {
      promise: "An owner's own words as a short story, the exact permission ask and an honest review ask, then a card with their pet's photo once they say yes in writing.",
      next: [
        { id: 'petcare.next_25', why: 'Story in hand: reach the next 25 people and places.' },
        { id: 'petcare.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 people and places (vets, groomers, pet stores, buildings), skipping everyone already in your Pipeline, with messages ready in Do my day.',
      next: [
        { id: 'petcare.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'petcare.ready', why: 'Look ready before new owners look you up.' },
      ],
    }),
    C.readyWorkflow(N, t, {
      promise: 'A one-page website, a Google profile kit and door hangers, all with the same prices, promise and contact details, ready to put up today.',
      next: [
        { id: 'petcare.next_25', why: 'Looking ready: reach the next 25 people and places.' },
        { id: 'petcare.first_25', why: "Haven't started your list yet? Start with the people you know." },
      ],
    }),
  ],
};
