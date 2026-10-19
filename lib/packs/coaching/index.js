// Coaching and consulting: your first 25 from your own network for one kind of person and one
// result, an offer with a first-clients ladder, answers to replies, call prep with a proposal after,
// quotes and invoices, the new client's booking and welcome kit, proof, the next 25 and a website.
// Strict: nothing drafts an earnings or results claim, and stories need written consent first.
// Niche facts live in data/niche.json (sources: research/niches/coaching.json).

const C = require('../_kit/common');
const { first25Tool } = require('./tools/first25');
const { next25Tool } = require('./tools/next25');
const { callPrepTool } = require('./tools/call-prep');
const { kitTool } = require('./tools/onboarding');

const N = C.load(__dirname);
const t = {
  first: first25Tool(N),
  offer: C.offerTool(N),
  reply: C.replyTool(N),
  prep: callPrepTool(N),
  quote: C.quoteTool(N),
  win: C.winTool(N),
  kit: kitTool(N),
  keep: C.keepTool(N),
  story: C.storyTool(N),
  card: C.storyCardTool(N),
  next: next25Tool(N),
  ready: C.readyTool(N),
};
const W = t.win.input.properties;
const K = t.kit.input.properties;
const R = t.prep.input.properties;

module.exports = {
  id: 'coaching',
  title: 'Coaching and consulting',
  version: '1.1.0',
  business: true,
  summary: 'Start coaching: your first 25 people for one person and one result, a priced offer, answers to replies, call prep and proposals, a welcome kit, consent-first stories and the next 25 when you want more.',
  niches: ['coaching', 'consulting'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'coaching.first_25',
      title: 'Your first 25',
      promise: '25 people from your own network who match the one person and one result you coach, each with a personal message and a free first session.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'coaching.offer', why: 'Set your price per session before the first call.' },
        { id: 'coaching.reply', why: 'Someone wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'coaching.offer',
      title: 'Offer builder',
      promise: 'Your price per session from real ranges, a first-clients ladder, a money model and a one-page offer sheet. No results promised.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'coaching.call_prep', why: 'A call is booked: prep it with your price said once.' },
        { id: 'coaching.ready', why: 'Put these prices on a one-page website.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what someone wrote back: what it means, a short answer with one next step, and your Pipeline updated for Do my day. No results promised.',
      next: [
        { id: 'coaching.call_prep', why: 'They want to talk: prep the call.' },
        { id: 'coaching.quote', why: 'They asked for the price in writing: send the quote.' },
      ],
    }),
    {
      id: 'coaching.call_prep',
      title: 'Prep a call',
      promise: 'Before the call: what to check, the questions to ask, your price said once and answers to their worries, with a script. After it: a proposal if they want one.',
      minutes: 10,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['who'],
        properties: {
          ...R,
          who: C.pipelinePick('Who the call is with', 'Pick from your Pipeline or type their name'),
          website: { type: 'string', maxLength: 300, title: 'Their website or LinkedIn page (optional)', description: 'Read for public facts before the call. Nothing is sent to them.' },
          deposit: { type: 'string', maxLength: 20, title: 'Deposit to start (optional)', description: '"50%" or "$100"' },
        },
      },
      steps: [
        { id: 'prep', tool: t.prep.name, input: C.passInputs(Object.keys(R)) },
        { id: 'read', tool: 'sales.read_prospect', input: { name: '$prep.name', website: '$inputs.website', notes: '$prep.notes' } },
        { id: 'script', tool: 'sales.call_script', input: { name: '$prep.name', notes: '$prep.notes', optionsText: '$prep.options', price: '$prep.price', deposit: '$inputs.deposit', prospect: '$read' } },
        { id: 'send', approve: { title: 'After the call: send a proposal?', note: 'Pick yes if they asked for the options in writing. The proposal uses the same options and prices as the call.', choose: '$prep.after', label: 'label', max: 1 } },
        { id: 'proposal', tool: 'sales.proposal', when: '$send.chosen.0.proposal', input: { name: '$prep.name', email: '$prep.email', notes: '$prep.notes', goals: '$prep.goals', title: '$prep.title', optionsText: '$prep.options', price: '$prep.price', deposit: '$inputs.deposit', prospect: '$read', pipeline: false } },
      ],
      result: ['prep', 'script', 'proposal'],
      next: [
        { id: 'coaching.onboarding', why: 'They said yes: log the client and send the welcome kit.' },
        { id: 'coaching.quote', why: 'They want one price in writing: send the quote.' },
      ],
    },
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for a session, a block or a program at your founding, intro or full price, and the invoice from the same lines when they say yes.',
      next: [
        { id: 'coaching.onboarding', why: 'They booked: the booking message, the checklist and the welcome kit.' },
        { id: 'coaching.call_prep', why: 'They want to talk first: prep the call.' },
      ],
    }),
    {
      id: 'coaching.onboarding',
      title: 'New client and welcome kit',
      promise: 'A client said yes: the win logged, booking, prep and reminder messages, a coaching checklist and the welcome kit with the agreement and intake questions.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name'),
          result: K.result,
          package: W.package,
          sessions: W.sessions,
          when: W.when,
          where: W.where,
          rate: W.rate,
          free: W.free,
          invoice: W.invoice,
          price: W.price,
          link: W.link,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: [
        ...C.winSteps(t, {
          input: { who: '$inputs.client', package: '$inputs.package', sessions: '$inputs.sessions', when: '$inputs.when', where: '$inputs.where', rate: '$inputs.rate', free: '$inputs.free', invoice: '$inputs.invoice', price: '$inputs.price', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
        }),
        { id: 'kit', tool: t.kit.name, input: { client: '$inputs.client', result: '$inputs.result', price: '$log.price_text', price_note: '$log.price_note', sessions: '$log.sessions_text', free: '$inputs.free', business: '$inputs.business', link: '$inputs.link' } },
      ],
      result: ['log', 'kit', 'invoice'],
      next: [
        { id: 'coaching.keep', why: 'After a block of sessions: thank-you, honest review ask and referral ask.' },
        { id: 'coaching.proof', why: 'At the end: ask to share their words, with their written yes.' },
      ],
    },
    {
      id: 'coaching.keep',
      title: 'Reviews, referrals and stories',
      promise: 'After a block of sessions: a thank-you, an honest review ask, a referral ask, the consent-first story ask and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'coaching.proof', why: 'They said yes to a story: draft it from their own words.' },
        { id: 'coaching.next_25', why: 'Keep Do my day stocked with the next people.' },
      ],
    },
    C.proofWorkflow(N, t, {
      promise: "A case study from a client's own words that waits for their written yes, says plainly if they paid a founding price or nothing, and a card to post.",
      next: [
        { id: 'coaching.next_25', why: 'Story in hand: reach the next 25 people.' },
        { id: 'coaching.ready', why: 'Put your offer and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      minutes: 10,
      promise: 'Your next 25 people for one person and one result, skipping everyone already in your Pipeline, with where to look and group asks. Safe to repeat.',
      next: [
        { id: 'coaching.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'coaching.call_prep', why: 'A call is booked: prep it.' },
      ],
    }),
    C.readyWorkflow(N, t, {
      promise: 'A one-page website with your prices, promise and contact details, plus a Google profile kit if you meet clients in person.',
      next: [
        { id: 'coaching.next_25', why: 'Looking ready: reach the next 25 people.' },
        { id: 'coaching.first_25', why: "Haven't started your list yet? Start with the people you know." },
      ],
    }),
  ],
};
