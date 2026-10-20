// Personal training: your first 25 people and partners (apartment buildings, yoga studios, physical
// therapy clinics for referrals only, running stores), an offer with a first-clients ladder, answers to
// replies, quotes and invoices, the new client's booking texts and checklist, and the signature tool:
// the PAR-Q+ result (Go, Hold or Not done yet), goals and schedule give a printable intake sheet and,
// on a Go, a dated 4-week session plan, in two files private to the member (Legal L72). Then reviews
// and referrals, proof, the next 25 and a website. Safety first: the official PAR-Q+ from the PAR-Q+
// Collaboration before any session, a stop rule, no medical advice and no result promises.
// Niche facts live in data/niche.json (sources: research/niches/trainer.json).

const C = require('../_kit/common');
const { planTool } = require('./tools/intake-plan');

const N = C.load(__dirname);
const t = {
  first: C.first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  plan: planTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  card: C.storyCardTool(N),
  next: C.next25Tool(N),
  ready: C.readyTool(N),
};
const W = t.win.input.properties;
const P = t.plan.input.properties;

module.exports = {
  id: 'trainer',
  title: 'Personal training',
  version: '1.0.0',
  business: true,
  summary: 'Start personal training: your first 25 people and partners, a priced offer, answers to replies, quotes, the PAR-Q+ intake and a 4-week session plan, proof and the next 25 when you want more.',
  niches: ['personal training', 'personal trainer', 'fitness training', 'in-home personal training'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'trainer.first_25',
      title: 'Your first 25',
      promise: '15 people you know with a personal text each, 10 places (apartments, yoga studios, physical therapy clinics, running stores) with a partner ask, and scripts.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'trainer.offer', why: 'Set your price per session before the first person asks.' },
        { id: 'trainer.reply', why: 'Someone or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'trainer.offer',
      title: 'Offer builder',
      promise: 'Your price per session from real ranges, a first-clients ladder, a money model and a one-page offer sheet with a promise you control. No results promised.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'trainer.quote', why: 'Someone asked how much: quote a session, a pack or a 4-week plan.' },
        { id: 'trainer.ready', why: 'Put these prices on a website, a Google profile and a flyer.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what someone or a place wrote back: what it means, a short answer with one next step, and your Pipeline updated for Do my day. No results promised.',
      next: [
        { id: 'trainer.quote', why: 'They asked about price or a pack: send the quote.' },
        { id: 'trainer.intake_plan', why: 'They filled in the PAR-Q+: make the intake sheet and their 4-week plan.' },
      ],
    }),
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for one session, a pack of 4, a 4-week plan or a small group seat at your founding, intro or full price, and the invoice when they say yes.',
      next: [
        { id: 'trainer.won', why: 'They booked: log the client and send the booking and PAR-Q+ texts.' },
        { id: 'trainer.intake_plan', why: 'The PAR-Q+ is done: make the intake sheet and their 4-week plan.' },
      ],
    }),
    {
      id: 'trainer.won',
      title: 'A client said yes',
      promise: 'The win logged in your Pipeline, the booking, PAR-Q+ prep and reminder texts, a first session checklist and, if you like, the invoice.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name'),
          package: W.package,
          sessions: W.sessions,
          when: W.when,
          rate: W.rate,
          invoice: W.invoice,
          price: W.price,
          link: W.link,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: C.winSteps(t, {
        input: { who: '$inputs.client', package: '$inputs.package', sessions: '$inputs.sessions', when: '$inputs.when', rate: '$inputs.rate', invoice: '$inputs.invoice', price: '$inputs.price', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
      }),
      result: ['log', 'invoice'],
      next: [
        { id: 'trainer.intake_plan', why: 'They filled in the PAR-Q+: make the intake sheet and their 4-week plan.' },
        { id: 'trainer.keep', why: 'After the first four weeks: thank-you, honest review ask and referral ask.' },
      ],
    },
    {
      id: 'trainer.intake_plan',
      title: 'Intake and 4-week plan',
      promise: 'The result of the PAR-Q+ from the PAR-Q+ Collaboration, their goals and your days: an intake sheet, and a dated 4-week plan on a Go or the message to send.',
      minutes: 10,
      tier: 'builder',
      job: 'ops',
      inputs: { type: 'object', required: ['client'], properties: { ...P, client: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name') } },
      steps: [{ id: 'plan', tool: t.plan.name, input: C.passInputs(Object.keys(P)) }],
      result: ['plan'],
      next: [
        { id: 'trainer.keep', why: 'After the four weeks: thank-you, honest review ask and referral ask.' },
        { id: 'trainer.reply', why: 'They wrote back with a question: answer with one next step.' },
      ],
    },
    {
      id: 'trainer.keep',
      title: 'Reviews and referrals',
      promise: 'After the first four weeks: a thank-you, an honest review ask with no reward attached, a referral ask and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'trainer.intake_plan', why: 'Plan their next four weeks, with the PAR-Q+ still current.' },
        { id: 'trainer.proof', why: "Turn a happy client's own words into a story, with their written yes." },
      ],
    },
    C.proofWorkflow(N, t, {
      promise: "A client's own words as a short story, the exact permission ask and an honest review ask, then a card once they say yes in writing. No photos or numbers.",
      next: [
        { id: 'trainer.next_25', why: 'Story in hand: reach the next 25 people and places.' },
        { id: 'trainer.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 people and places (apartments, yoga studios, physical therapy clinics, running stores), skipping anyone in your Pipeline, with Do my day messages.',
      next: [
        { id: 'trainer.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'trainer.ready', why: 'Look ready before new people look you up.' },
      ],
    }),
    C.readyWorkflow(N, t, {
      promise: 'A one-page website, a Google profile kit and a flyer, all with the same prices, promise and contact details, ready to put up today.',
      next: [
        { id: 'trainer.next_25', why: 'Looking ready: reach the next 25 people and places.' },
        { id: 'trainer.first_25', why: "Haven't started your list yet? Start with the people you know." },
      ],
    }),
  ],
};
