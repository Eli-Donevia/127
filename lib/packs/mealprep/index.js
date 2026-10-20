// Meal prep and personal chef: your first 25 people and partners (gyms, yoga studios, churches and
// apartment buildings), a priced cook day with a first-clients ladder, answers to replies, quotes and
// invoices, the new client's booking texts and kitchen intake, the week menu (the signature: a menu,
// a shopping list by store section, a cook day schedule and labels with sourced storage times),
// reviews, proof, the next 25 and a website. The member cooks in the client's own kitchen.
// Niche facts live in data/niche.json (sources: research/niches/mealprep.json), food safety facts in
// data/storage.json and the recipes in data/recipes.json. Food restrictions and health details stay
// out of the Pipeline, memory and AI (lib/privacy.js; Legal L73 for the week menu).

const C = require('../_kit/common');
const P = require('./lib/privacy');
const { intakeTool } = require('./tools/kitchen-intake');
const { weekMenuTool } = require('./tools/week-menu');

const N = C.load(__dirname);
const t = {
  first: P.privateList(C.first25Tool(N)),
  offer: C.offerTool(N),
  reply: P.privateReply(C.replyTool(N)),
  quote: C.quoteTool(N),
  win: P.privateFields(C.winTool(N), ['when']),
  intake: intakeTool(N),
  menu: weekMenuTool(N),
  keep: P.noHealth(C.keepTool(N), ['done']),
  story: P.noHealth(C.storyTool(N), ['what', 'result', 'quote']),
  storyCard: C.storyCardTool(N),
  next: P.privateList(C.next25Tool(N)),
  ready: C.readyTool(N),
};
const W = t.win.input.properties;
const MENU = t.menu.input.properties;

const KEEP_NEXT = { id: 'mealprep.keep', why: 'After the first few cook days: a thank-you, an honest review ask and a referral ask.' };

module.exports = {
  id: 'mealprep',
  title: 'Meal prep and personal chef',
  version: '1.0.0',
  business: true,
  summary: 'Start meal prep and personal chef work: your first 25 people and partners, a priced cook day, answers to replies, quotes, the kitchen intake, a week menu with a shopping list and labels, proof and the next 25 when you want them.',
  niches: ['meal prep', 'personal chef', 'meal prep service', 'personal chef service', 'weekly meal prep', 'private chef', 'in-home chef'],
  uses: ['sales', 'site', 'local'],
  tools: Object.values(t),
  workflows: [
    {
      id: 'mealprep.first_25',
      title: 'Your first 25',
      promise: '15 people you know with a personal text each, plus 10 gyms, yoga studios, churches and apartment buildings with a partner ask, and a kitchen visit script.',
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: { type: 'object', properties: t.first.input.properties },
      steps: [{ id: 'list', tool: t.first.name, input: C.passInputs(Object.keys(t.first.input.properties)) }],
      result: ['list'],
      next: [
        { id: 'mealprep.offer', why: 'Set your price per cook day before the first family asks.' },
        { id: 'mealprep.reply', why: 'Someone or a place wrote back: answer with one next step.' },
      ],
    },
    {
      id: 'mealprep.offer',
      title: 'Offer builder',
      promise: 'Your price per cook day from sourced ranges, groceries billed at cost, a first-clients ladder, a money model and a one-page offer sheet families can read.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: t.offer.input.properties },
      steps: [{ id: 'offer', tool: t.offer.name, input: C.passInputs(Object.keys(t.offer.input.properties)) }],
      result: ['offer'],
      next: [
        { id: 'mealprep.quote', why: 'A family asked how much: quote one cook day or 4 booked ahead.' },
        { id: 'mealprep.week_menu', why: 'See a week menu, shopping list and labels before your first cook day.' },
        { id: 'mealprep.ready', why: 'Put these prices on a website, a Google profile and a flyer.' },
      ],
    },
    C.replyWorkflow(N, t, {
      promise: 'Paste what someone or a place wrote back: what it means, a short answer with one next step (allergies, groceries and diets included), and your Pipeline updated.',
      next: [
        { id: 'mealprep.quote', why: 'They asked about price: send the quote.' },
        { id: 'mealprep.new_client', why: 'They said yes after the kitchen visit: log the client and send the intake form.' },
      ],
    }),
    C.quoteWorkflow(N, t, {
      promise: 'A printable quote for one cook day, 4 booked ahead, a half day or a stock-up day at your founding, intro or full price, then the invoice when they say yes.',
      next: [
        { id: 'mealprep.new_client', why: 'They booked: booking texts, the first cook day checklist and the kitchen intake form.' },
        { id: 'mealprep.week_menu', why: 'Plan the first week: menu, shopping list, cook day schedule and labels.' },
        { id: 'mealprep.reply', why: 'They wrote back with a question first: answer it.' },
      ],
    }),
    {
      id: 'mealprep.new_client',
      title: 'New client and kitchen intake',
      promise: 'A client said yes: the win logged, booking, prep and reminder texts, a first cook day checklist, the invoice if you want it and the kitchen intake form.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: C.pipelinePick("Client's name", 'Pick from your Pipeline or type their name'),
          package: W.package,
          when: W.when,
          rate: W.rate,
          invoice: W.invoice,
          price: W.price,
          link: W.link,
          business: W.business,
          phone: W.phone,
        },
      },
      steps: [
        ...C.winSteps(t, {
          input: { who: '$inputs.client', package: '$inputs.package', when: '$inputs.when', rate: '$inputs.rate', price: '$inputs.price', invoice: '$inputs.invoice', link: '$inputs.link', business: '$inputs.business', phone: '$inputs.phone' },
        }),
        { id: 'intake', tool: t.intake.name, input: { client: '$inputs.client', business: '$inputs.business', phone: '$inputs.phone' } },
      ],
      result: ['log', 'invoice', 'intake'],
      next: [
        { id: 'mealprep.week_menu', why: 'Intake back: plan the week menu, shopping list, cook day schedule and labels.' },
        KEEP_NEXT,
      ],
    },
    {
      id: 'mealprep.week_menu',
      title: 'Week menu and shopping list',
      promise: 'Household size, the way they eat and the foods to leave out give a week of dinners, a shopping list by section, a cook day plan and labels with reheat steps.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      suggestSchedule: { cron: '0 9 * * 5', label: 'Every Friday at 9am' },
      inputs: {
        type: 'object',
        properties: { ...MENU, client: C.pipelinePick("Client's name (optional)", 'Pick from your Pipeline or type their name') },
      },
      steps: [{ id: 'menu', tool: t.menu.name, input: C.passInputs(Object.keys(MENU)) }],
      result: ['menu'],
      next: [
        KEEP_NEXT,
        { id: 'mealprep.proof', why: 'A client is happy: ask to share their words and a food photo, in writing.' },
      ],
    },
    {
      id: 'mealprep.keep',
      title: 'Reviews and referrals',
      promise: 'After the first few cook days: a thank-you, an honest review ask with no reward attached, a referral ask for friends and neighbors and a referral card.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['client'], properties: t.keep.input.properties },
      steps: [{ id: 'keep', tool: t.keep.name, input: C.passInputs(Object.keys(t.keep.input.properties)) }],
      result: ['keep'],
      next: [
        { id: 'mealprep.proof', why: "Turn a happy client's own words into a story, with their written yes." },
        { id: 'mealprep.next_25', why: 'Keep Do my day stocked with the next people and places.' },
      ],
    },
    C.proofWorkflow(N, { story: t.story, card: t.storyCard }, {
      promise: "A client's own words as a short story, the exact permission ask and an honest review ask, then a card with a photo of the food once they say yes in writing.",
      next: [
        { id: 'mealprep.next_25', why: 'Story in hand: reach the next 25 people and places.' },
        { id: 'mealprep.ready', why: 'Put your prices and promise on your own website.' },
      ],
    }),
    C.next25Workflow(N, t, {
      promise: 'The next 25 people and places (gyms, yoga studios, churches, apartment buildings), skipping everyone already in your Pipeline, with messages ready in Do my day.',
      next: [
        { id: 'mealprep.reply', why: 'Someone wrote back: answer with one next step.' },
        { id: 'mealprep.ready', why: 'Look ready before new families look you up.' },
      ],
    }),
    C.readyWorkflow(N, t, {
      promise: 'A one-page website, a Google profile kit and a flyer, all with the same prices, promise and contact details, ready to put up today.',
      next: [
        { id: 'mealprep.next_25', why: 'Looking ready: reach the next 25 people and places.' },
        { id: 'mealprep.first_25', why: "Haven't started your list yet? Start with the people you know." },
      ],
    }),
  ],
};
