// Event planning (day-of coordination): your first 25 people and partners, an offer with a
// first-clients ladder, answers to replies, quotes and invoices, the booking with its planning
// checklist and deposit invoice, the Day-of timeline (timeline, vendor contact sheet and day-of
// checklist), reviews and referrals, proof, the next 25 and a website. The member promises only what
// they control: the final timeline a week before, and being on site from setup to teardown.
// Niche facts live in data/niche.json (sources: research/niches/events.json).

const C = require('../_kit/common');
const { timelineTool } = require('./tools/timeline');
const { bookingSteps, quoteWithDeposit } = require('./lib/steps');
const { eventsReadyTool } = require('./lib/ready');

const N = C.load(__dirname);
const t = {
  first: C.first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  timeline: timelineTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  storyCard: C.storyCardTool(N),
  next: C.next25Tool(N),
  ready: eventsReadyTool(N),
};
const W = t.win.input.properties;
const TL = t.timeline.input.properties;

// The website step also takes the event coordination words from the facts, and the Google profile
// kit the member's promise (lib/ready.js).
const ready = C.readyWorkflow(N, t, {
  promise: 'A one-page website, a Google profile kit and a flyer, all with the same prices, promise and contact details, ready to put up today.',
  next: [
    { id: 'events.next_25', why: 'Looking ready: reach the next 25 people and places.' },
    { id: 'events.first_25', why: "Haven't started your list yet? Start with the people you know." },
  ],
});
ready.steps = ready.steps.map((s) => {
  if (s.id === 'site') return { ...s, input: { ...s.input, copy: '$facts.copy' } };
  if (s.id === 'profile') return { ...s, input: { ...s.input, promise: '$facts.gbp.promise' } };
  return s;
});

const { client: _client, ...timelineRest } = TL; // eslint-disable-line no-unused-vars

module.exports = {
  id: 'events',
  title: 'Event planning',
  version: '1.0.0',
  business: true,
  summary: 'Start day-of event coordination: your first 25 people and partners, a priced offer, answers to replies, quotes, the booking checklist, a day-of timeline with the vendor contact sheet, proof and the next 25.',
  niches: ['event planning', 'event planner', 'event coordination', 'day-of coordination', 'day-of coordinator', 'wedding coordination', 'wedding coordinator', 'wedding planning', 'party planning', 'party planner'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'events.first_25',
      title: 'Your first 25',
      promise: '15 people you know with a personal text each, plus 10 venues, florists, bakeries, photographers and restaurants with a partner ask, and a planning call script.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'events.offer', why: 'Set your price per event before the first host asks.' },
        { id: 'events.reply', why: 'Someone or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'events.offer',
      title: 'Offer builder',
      promise: 'Your price per event from sourced ranges, a first-clients ladder, a money model and a one-page offer sheet couples and hosts can read.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'events.quote', why: 'A host asked how much: quote the day, a party or planning hours.' },
        { id: 'events.ready', why: 'Put these prices on a website, a Google profile and a flyer.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what a client or a place wrote back: what it means, a short answer with one next step, and your Pipeline updated for Do my day.',
      next: [
        { id: 'events.quote', why: 'They asked about price: send the quote.' },
        { id: 'events.booking', why: 'They said yes after the planning call: log the booking and the deposit.' },
        { id: 'events.timeline', why: 'A booked client sent their vendor list: build the day-of timeline.' },
      ],
    }),
    quoteWithDeposit(
      C.quoteWorkflow(N, t, {
        promise: 'A printable quote for the day, a party or planning hours at your founding, intro or full price, and the invoice from the same lines when they say yes.',
        next: [
          { id: 'events.booking', why: 'They signed: the booking messages and the planning checklist.' },
          { id: 'events.reply', why: 'They wrote back with a question first: answer it.' },
        ],
      }),
    ),
    {
      id: 'events.booking',
      title: 'New booking and planning checklist',
      promise: 'A client signed: the booking logged, the booking and prep messages, a day-before reminder, a planning checklist to event week and the deposit invoice.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name'),
          package: W.package,
          when: { ...W.when, description: 'Like "Saturday, May 15"' },
          rate: W.rate,
          price: W.price,
          invoice: { ...W.invoice, description: 'With the deposit below. Leave it off if you already sent the invoice from Send a quote.' },
          deposit: { type: 'string', maxLength: 20, title: 'Deposit to hold the date (optional)', description: '"50%" or "$400"' },
          link: W.link,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: bookingSteps(t, {
        input: { who: '$inputs.client', package: '$inputs.package', when: '$inputs.when', rate: '$inputs.rate', price: '$inputs.price', invoice: '$inputs.invoice', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
        deposit: '$inputs.deposit',
      }),
      result: ['log', 'invoice'],
      next: [
        { id: 'events.timeline', why: 'Vendors are booked: build the day-of timeline and the contact sheet.' },
        { id: 'events.keep', why: 'After the event: a thank-you, an honest review ask and a referral ask.' },
      ],
    },
    {
      id: 'events.timeline',
      title: 'Day-of timeline',
      promise: 'Event type, start time and vendors in: a printable timeline with one owner per row, a vendor contact sheet, a day-of checklist and the week-before messages.',
      minutes: 10,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['start', 'vendors'],
        properties: { client: C.pipelinePick("Client's name (optional)", 'Pick from your Pipeline or type their name'), ...timelineRest },
      },
      steps: [{ id: 'timeline', tool: t.timeline.name, input: C.passInputs(Object.keys(TL)) }],
      result: ['timeline'],
      next: [
        { id: 'events.keep', why: 'After the event: a thank-you, an honest review ask and a referral ask.' },
        { id: 'events.proof', why: "A happy client: ask to share their words and a photo from the day, in writing." },
      ],
    },
    {
      id: 'events.keep',
      title: 'Reviews and referrals',
      promise: 'After the event: a thank-you, an honest review ask with no reward attached, a referral ask for friends with an event coming up and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'events.proof', why: "Turn a happy client's own words into a story, with their written yes." },
        { id: 'events.next_25', why: 'Keep Do my day stocked with the next people and places.' },
      ],
    },
    C.proofWorkflow(N, { story: t.story, card: t.storyCard }, {
      promise: "A client's own words as a short story, the exact permission ask and an honest review ask, then a card with a photo from the day once they say yes in writing.",
      next: [
        { id: 'events.next_25', why: 'Story in hand: reach the next 25 people and places.' },
        { id: 'events.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 people and places (venues, florists, bakeries, photographers), skipping everyone already in your Pipeline, with messages ready in Do my day.',
      next: [
        { id: 'events.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'events.ready', why: 'Look ready before couples and hosts look you up.' },
      ],
    }),
    ready,
  ],
};
