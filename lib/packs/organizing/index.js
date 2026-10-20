// Home organizing: your first 25 people and partners, an offer with a first-clients ladder, answers
// to replies, quotes and invoices, the room plan (time per zone, a priced supply list, a donation and
// recycling checklist and a before-and-after photo plan) with the new client's booking, proof, the
// next 25 and a website. Trust first: a free walk-through, the client's yes on every item, and
// photos only with a written okay.
// Niche facts live in data/niche.json and data/room-plan.json (sources: research/niches/organizing.json).

const C = require('../_kit/common');
const { roomPlanTool } = require('./tools/room-plan');

const N = C.load(__dirname);
const t = {
  first: C.first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  plan: roomPlanTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  storyCard: C.storyCardTool(N),
  next: C.next25Tool(N),
  ready: C.readyTool(N),
};
const W = t.win.input.properties;
const R = t.plan.input.properties;

module.exports = {
  id: 'organizing',
  title: 'Home organizing',
  version: '1.0.0',
  business: true,
  summary: 'Start home organizing: your first 25 people and partners, a priced offer, answers to replies, quotes, a room plan with time per zone and a supply list, proof and the next 25 when you want more.',
  niches: ['home organizing', 'professional organizer', 'decluttering'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'organizing.first_25',
      title: 'Your first 25',
      promise: '15 people you know with a personal text each, plus 10 realtors, movers, senior living, storage and design partners with an ask each, and a walk-through script.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'organizing.offer', why: 'Set your hourly price and packages before the first person asks.' },
        { id: 'organizing.reply', why: 'Someone or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'organizing.offer',
      title: 'Offer builder',
      promise: 'Your hourly price from real local ranges, a first-clients ladder, room and move packages and a one-page offer sheet a household can read.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'organizing.quote', why: 'Someone asked how much: quote a visit or a package.' },
        { id: 'organizing.room_plan', why: 'Plan a room: time per zone and a priced supply list to show at the walk-through.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what a person or a place wrote back: what it means, a short answer with one next step, and your Pipeline updated for Do my day.',
      next: [
        { id: 'organizing.quote', why: 'They asked about price or a package: send the quote.' },
        { id: 'organizing.room_plan', why: 'They said yes after the walk-through: log the client and plan the first room.' },
      ],
    }),
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for a 3-hour visit, a room or move package or a video check-in at your founding, intro or full price, and the invoice when they say yes.',
      next: [
        { id: 'organizing.room_plan', why: 'They booked: log the client, then the room plan with time per zone and the supply list.' },
        { id: 'organizing.reply', why: 'They wrote back with a question first: answer it.' },
      ],
    }),
    {
      id: 'organizing.room_plan',
      title: 'Room plan and supply list',
      promise: 'Room, problem items and hours give time per zone, a supply list with sourced prices, a donation and recycling checklist and a photo plan. Logs new clients.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['room'],
        properties: {
          client: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name'),
          room: R.room,
          problems: R.problems,
          hours: R.hours,
          people: R.people,
          when: { ...R.when, title: 'Visit day and time' },
          new_client: { type: 'boolean', default: false, title: 'A new client said yes', description: 'Logs the win and writes the booking texts and the first visit checklist' },
          package: { ...W.package, title: 'New client: what they booked' },
          where: { ...W.where, title: 'New client: in person or by video' },
          rate: { ...W.rate, title: 'New client: price' },
          invoice: W.invoice,
          price: W.price,
          link: W.link,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: [
        ...C.winSteps(t, {
          flag: '$inputs.new_client',
          input: { who: '$inputs.client', package: '$inputs.package', when: '$inputs.when', where: '$inputs.where', rate: '$inputs.rate', price: '$inputs.price', invoice: '$inputs.invoice', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
        }),
        { id: 'plan', tool: t.plan.name, input: C.passInputs(['client', 'room', 'problems', 'hours', 'people', 'when', 'business', 'phone']) },
      ],
      result: ['log', 'invoice', 'plan'],
      next: [
        { id: 'organizing.keep', why: 'After the first visits: thank-you, honest review ask and referral ask.' },
        { id: 'organizing.proof', why: 'A client is happy: ask to share their words and the after photo, in writing.' },
      ],
    },
    {
      id: 'organizing.keep',
      title: 'Reviews and referrals',
      promise: 'After the first visits: a thank-you, an honest review ask with no reward attached, a referral ask for friends and neighbors and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'organizing.proof', why: "Turn a happy client's own words into a story, with their written yes." },
        { id: 'organizing.next_25', why: 'Keep Do my day stocked with the next people and places.' },
      ],
    },
    C.proofWorkflow(N, { story: t.story, card: t.storyCard }, {
      promise: "A client's own words as a short story, the exact permission ask and an honest review ask, then a card with the after photo once they say yes in writing.",
      next: [
        { id: 'organizing.next_25', why: 'Story in hand: reach the next 25 people and places.' },
        { id: 'organizing.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 people and places (realtors, movers, senior living, storage, designers), skipping everyone in your Pipeline, with messages ready in Do my day.',
      next: [
        { id: 'organizing.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'organizing.ready', why: 'Look ready before people look you up.' },
      ],
    }),
    C.readyWorkflow(N, t, {
      promise: 'A one-page website, a Google profile kit and flyers, all with the same prices, promise and contact details, ready to put up today.',
      next: [
        { id: 'organizing.next_25', why: 'Looking ready: reach the next 25 people and places.' },
        { id: 'organizing.first_25', why: "Haven't started your list yet? Start with the people you know." },
      ],
    }),
  ],
};
