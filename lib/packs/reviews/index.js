// More Google reviews for local shops, the honest way (flagship). Find 25 owner-run shops near the
// member whose reviews are thin or stale, show up with a print-ready review card, answer their
// replies, prep the visit, price the offer, set up the real kit with the shop's own review link, look
// after it and report every month. Every ask goes to every customer: no gating, no incentives, no
// quotas, no bought or written reviews (Google policy, FTC rule).

const NICHE = require('./data/niche.json');

const SHOP = {
  type: 'string',
  title: 'Which shops',
  enum: Object.keys(NICHE.shops),
  description: 'salons, barbers, nails, spas, auto (repair shops), dentists, chiro (chiropractors and PT), cafes, restaurants, boutiques or groomers.',
  default: 'salons',
};
// For one shop: no default, so a shop in the Pipeline keeps its own kind.
const SHOP_ONE = { type: 'string', title: 'What kind of shop (optional)', enum: Object.keys(NICHE.shops), description: 'Only needed when it isn\'t in your Pipeline yet. It sets the words on the card.' };
const ME = {
  myName: { type: 'string', title: 'Your first name', maxLength: 60, description: 'You send every message yourself.' },
  myBusiness: { type: 'string', title: 'Your business name (optional)', maxLength: 80 },
};
const ADDRESS = { type: 'string', title: 'Your mailing address (for emails)', maxLength: 160, description: 'US law asks for it in business email. A PO box works.' };
const WHICH = { type: 'string', title: 'Which shop', options: 'pipeline', maxLength: 120, description: 'Pick one from your Pipeline, or type a name.' };
const SITE = { type: 'string', title: 'Their website (if they aren\'t in your Pipeline)', maxLength: 300 };

module.exports = {
  id: 'reviews',
  title: 'More Google reviews for local shops',
  version: '0.2.0',
  business: true,
  summary: 'Help local shops get more Google reviews the honest way: find 25 near you, show up with a print-ready QR review card, answer their replies, prep the visit, set it up with their own link, look after it and report monthly.',
  niches: ['reviews', 'reputation', 'local shops', 'salons', 'barbers', 'auto repair', 'dentists', 'cafes', 'restaurants'],
  uses: ['sales'],
  system: ['ffmpeg'],
  tools: [
    require('./tools/crowd-card'),
    require('./tools/find-shops'),
    require('./tools/review-card'),
    require('./tools/build-offer'),
    require('./tools/monthly-report'),
    require('./tools/pick-lead'),
    require('./tools/track-sample'),
    require('./tools/answer-reply'),
    require('./tools/call-card'),
    require('./tools/care-plan'),
  ],
  workflows: [
    {
      id: 'reviews.first_25',
      title: 'Your first 25',
      promise: '25 local shops near you that need reviews, a print-ready QR review card for the best one, and first messages ready to send.',
      minutes: 15,
      tier: 'free',
      job: 'leads',
      inputs: {
        type: 'object',
        required: ['city'],
        properties: {
          city: { type: 'string', title: 'Your city', maxLength: 120, description: 'Like "Des Moines, IA". We list shops near it.' },
          shop: SHOP,
          ...ME,
          myAddress: ADDRESS,
          exclude: { type: 'string', title: 'Skip these (optional)', maxLength: 6000, description: 'Names, websites or place IDs you already contacted, one per line. For 25 a day.' },
          batch: { type: 'integer', title: 'Batch (optional)', minimum: 1, maximum: 8, description: '2 gives the next 25 after the first 25, and so on.' },
        },
      },
      steps: [
        { id: 'crowd', tool: 'reviews.crowd_card', input: { city: '$inputs.city' } },
        {
          id: 'find',
          tool: 'reviews.find_25',
          input: { city: '$inputs.city', shop: '$inputs.shop', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myAddress: '$inputs.myAddress', exclude: '$inputs.exclude', batch: '$inputs.batch', save: true },
        },
        {
          id: 'card',
          tool: 'reviews.card_kit',
          when: '$find.hasTop',
          input: { lead: '$find.top', shop: '$inputs.shop', city: '$inputs.city', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myAddress: '$inputs.myAddress', sendCopy: false },
        },
        {
          id: 'save',
          tool: 'reviews.track_sample',
          when: '$find.hasTop',
          input: { lead: '$find.top', card: '$card', city: '$inputs.city', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myAddress: '$inputs.myAddress' },
        },
      ],
      result: ['crowd', 'find', 'card', 'save'],
      next: [
        { id: 'reviews.offer', why: 'Know your price before the first one says yes.' },
        { id: 'reviews.sample_one', why: 'Make the card for the next best one on your list.' },
      ],
    },
    {
      id: 'reviews.offer',
      title: 'Your offer',
      promise: 'Your reviews offer at your price: setup, monthly care, founding-client terms, promises you control, and a printable offer sheet.',
      minutes: 5,
      tier: 'builder',
      job: 'offer',
      inputs: {
        type: 'object',
        properties: {
          position: { type: 'string', title: 'Where you want to price', enum: ['budget', 'standard', 'premium'], default: 'standard' },
          setup: { type: 'number', title: 'Your setup price (optional)', minimum: 0, maximum: 5000 },
          care: { type: 'number', title: 'Your monthly price (optional)', minimum: 0, maximum: 2000 },
          shop: SHOP,
          city: { type: 'string', title: 'Your city', maxLength: 120 },
          ...ME,
          myContact: { type: 'string', title: 'Your email or phone (printed on the sheet)', maxLength: 160 },
        },
      },
      steps: [
        { id: 'offer', tool: 'reviews.build_offer', input: { position: '$inputs.position', setup: '$inputs.setup', care: '$inputs.care', shop: '$inputs.shop', city: '$inputs.city', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myContact: '$inputs.myContact' } },
      ],
      result: ['offer'],
      next: [
        { id: 'reviews.sample_one', why: 'Show up with the work done: a review card for one shop.' },
        { id: 'reviews.proposal', why: 'Someone wants it: a proposal and a quote at these prices.' },
      ],
    },
    {
      id: 'reviews.sample_one',
      title: 'Make a free sample',
      promise: 'A print-ready review card for one shop in your Pipeline or one you type: counter and handout cards with a code to their Google listing, and the message to send.',
      proof: 'A print-ready card kit, a picture to send with it, and the message saved in your Pipeline',
      minutes: 10,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['business'],
        properties: {
          business: WHICH,
          website: { ...SITE, description: 'We read it for their name, colors and whether it shows reviews.' },
          shop: SHOP_ONE,
          city: { type: 'string', title: 'Their city (optional)', maxLength: 120, description: 'Helps the code find the right listing.' },
          ...ME,
          myAddress: ADDRESS,
        },
      },
      steps: [
        { id: 'pick', tool: 'reviews.pick', input: { name: '$inputs.business', website: '$inputs.website', shop: '$inputs.shop', city: '$inputs.city' } },
        { id: 'card', tool: 'reviews.card_kit', input: { lead: '$pick.lead', shop: '$pick.lead.shop', city: '$pick.lead.city', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myAddress: '$inputs.myAddress', sendCopy: false } },
        { id: 'save', tool: 'reviews.track_sample', input: { lead: '$pick.lead', card: '$card', city: '$pick.lead.city', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myAddress: '$inputs.myAddress' } },
      ],
      result: ['card', 'save'],
      next: [
        { id: 'reviews.reply', why: 'They wrote back: answer in their words, with one next step.' },
        { id: 'reviews.call_prep', why: 'They want to meet: know what to check, ask and say.' },
      ],
    },
    {
      id: 'reviews.reply',
      title: 'Answer a reply',
      promise: 'Paste what a shop owner wrote back. Get what they meant, a short honest answer with one next step at your real price, and your Pipeline updated.',
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['business', 'reply'],
        properties: {
          business: WHICH,
          reply: { type: 'string', title: 'What they wrote', format: 'textarea', maxLength: 4000, description: 'Paste their whole reply, sign-off included.' },
          cardSent: { type: 'boolean', title: 'I already sent them the review card' },
          website: { ...SITE, description: 'Only needed when they aren\'t in your Pipeline yet.' },
          myName: ME.myName,
          myBusiness: ME.myBusiness,
        },
      },
      steps: [
        {
          id: 'answer',
          tool: 'reviews.answer_reply',
          input: { business: '$inputs.business', reply: '$inputs.reply', cardSent: '$inputs.cardSent', website: '$inputs.website', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness' },
        },
      ],
      result: ['answer'],
      next: [
        { id: 'reviews.sample_one', why: 'They said yes: make the card while they remember you.' },
        { id: 'reviews.call_prep', why: 'A visit is on the calendar: prep it in a few minutes.' },
      ],
    },
    {
      id: 'reviews.call_prep',
      title: 'Prep for a call',
      promise: 'Before a visit or call with a shop owner: what to check on their listing, questions to ask, your price said once, honest answers to their worries and a script.',
      proof: 'A call card, a call script with your real prices, and the meeting on your calendar',
      minutes: 8,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['business'],
        properties: {
          business: WHICH,
          owner: { type: 'string', title: 'Who you\'re meeting (optional)', maxLength: 80 },
          callDate: { type: 'string', title: 'Date (optional)', format: 'date' },
          callTime: { type: 'string', title: 'Time (optional)', maxLength: 20, description: 'Like 2:30pm.' },
          inPerson: { type: 'boolean', title: 'I\'m visiting in person', default: true },
          notes: { type: 'string', title: 'What you know so far (optional)', format: 'textarea', maxLength: 3000, description: 'What they said in their reply or at the counter.' },
          website: SITE,
          shop: SHOP_ONE,
          myName: ME.myName,
        },
      },
      steps: [
        { id: 'pick', tool: 'reviews.pick', input: { name: '$inputs.business', website: '$inputs.website', shop: '$inputs.shop' } },
        { id: 'read', tool: 'sales.read_prospect', input: { name: '$pick.name', website: '$pick.lead.website', notes: '$inputs.notes' } },
        { id: 'card', tool: 'reviews.call_card', input: { lead: '$pick.lead', prospect: '$read', notes: '$inputs.notes', owner: '$inputs.owner', callDate: '$inputs.callDate', callTime: '$inputs.callTime', inPerson: '$inputs.inPerson', myName: '$inputs.myName' } },
        { id: 'script', tool: 'sales.call_script', input: { name: '$inputs.owner', company: '$pick.name', notes: '$card.notes', optionsText: '$card.optionsText', price: '$card.price', prospect: '$read' } },
      ],
      result: ['card', 'script'],
      next: [
        { id: 'reviews.proposal', why: 'They said yes: send the proposal and the quote the same day.' },
        { id: 'reviews.setup', why: 'Signed: make their real kit with their own review link.' },
      ],
    },
    {
      id: 'reviews.proposal',
      title: 'Proposal',
      promise: 'A proposal for one shop with three options at your prices, what you noticed on their website, and the cover email. Then a quote they can sign.',
      minutes: 8,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: { type: 'string', title: 'Their business name', maxLength: 100 },
          owner: { type: 'string', title: 'Owner\'s name', maxLength: 80 },
          email: { type: 'string', title: 'Their email (optional)', maxLength: 160 },
          website: { type: 'string', title: 'Their website', maxLength: 300 },
          notes: { type: 'string', title: 'What they told you (optional)', maxLength: 1200, description: 'Like "newest review is from March, never replies to reviews".' },
          position: { type: 'string', title: 'Where you want to price', enum: ['budget', 'standard', 'premium'], default: 'standard' },
          setup: { type: 'number', title: 'Your setup price (optional)', minimum: 0, maximum: 5000 },
          care: { type: 'number', title: 'Your monthly price (optional)', minimum: 0, maximum: 2000 },
          shop: SHOP,
          payLink: { type: 'string', title: 'Your payment link (optional)', maxLength: 300 },
          myName: ME.myName,
          myContact: { type: 'string', title: 'Your email or phone', maxLength: 160 },
        },
      },
      steps: [
        { id: 'offer', tool: 'reviews.build_offer', input: { position: '$inputs.position', setup: '$inputs.setup', care: '$inputs.care', shop: '$inputs.shop', myName: '$inputs.myName', myContact: '$inputs.myContact', client: '$inputs.client', owner: '$inputs.owner', email: '$inputs.email', website: '$inputs.website' } },
        { id: 'read', tool: 'sales.read_prospect', input: { name: '$inputs.client', website: '$inputs.website', notes: '$inputs.notes' } },
        {
          id: 'proposal',
          tool: 'sales.proposal',
          input: { name: '$inputs.owner', company: '$inputs.client', email: '$inputs.email', notes: '$inputs.notes', goals: 'Every customer gets asked for a review, every time, with one tap\nA reply to every new review within a day\nCards, links and templates you own', title: 'More Google reviews', prospect: '$read', options: '$offer.options', payLink: '$inputs.payLink', contact: '$inputs.myContact', pipeline: false },
        },
        { id: 'quote', tool: 'sales.quote', input: { items: '$offer.items', customer: { name: '$inputs.owner', company: '$inputs.client', email: '$inputs.email' }, title: 'Review setup and first month', payLink: '$inputs.payLink', contact: '$inputs.myContact', validDays: 14, pipeline: false } },
      ],
      result: ['proposal', 'quote'],
      next: [{ id: 'reviews.setup', why: 'Signed: make their real kit with their own review link.' }],
    },
    {
      id: 'reviews.setup',
      title: 'Set up a new client',
      promise: 'The real kit for a shop that said yes: counter and handout cards with their own review link, the ask for every customer and reply templates.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['client', 'reviewLink'],
        properties: {
          client: { type: 'string', title: 'Client business name', maxLength: 100 },
          reviewLink: { type: 'string', title: 'Their review link', maxLength: 300, description: 'From their Business Profile on a computer: Read reviews, then Get more reviews, then copy the link.' },
          website: { type: 'string', title: 'Their website (optional)', maxLength: 300 },
          shop: SHOP,
          city: { type: 'string', title: 'Their city', maxLength: 120 },
          ...ME,
          myContact: { type: 'string', title: 'Your email or phone', maxLength: 160 },
        },
      },
      steps: [
        { id: 'kit', tool: 'reviews.card_kit', input: { business: '$inputs.client', reviewLink: '$inputs.reviewLink', website: '$inputs.website', shop: '$inputs.shop', city: '$inputs.city', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myContact: '$inputs.myContact' } },
      ],
      result: ['kit'],
      next: [{ id: 'reviews.keep', why: 'Live: give them a care plan and put the next 90 days on your calendar.' }],
    },
    {
      id: 'reviews.keep',
      title: 'Keep your customers',
      promise: 'A care plan your client keeps, the next 90 days on your calendar, the message for each moment, and one upsell to offer after the first report.',
      proof: 'A care plan page, a 90-day calendar and the messages to send',
      minutes: 5,
      tier: 'builder',
      job: 'money',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: { ...WHICH, title: 'Which client' },
          monthly: { type: 'number', title: 'What they pay a month (optional)', minimum: 0, maximum: 2000, description: 'Leave empty to use your offer.' },
          terms: { type: 'string', title: 'Their terms (optional)', enum: ['founding', 'regular'], description: 'Founding: one of your first 3 clients. Leave empty and we count your clients.' },
          start: { type: 'string', title: 'Start date (optional)', format: 'date', description: 'The day the cards went on the counter. Today if empty.' },
          hasTexts: { type: 'boolean', title: 'They already text customers after a visit', description: 'Then the upsell is a reviews section on their website instead.' },
          ownerFirst: { type: 'string', title: 'Owner\'s first name', maxLength: 40 },
          website: SITE,
          ...ME,
          myContact: { type: 'string', title: 'Your email or phone (printed on the plan)', maxLength: 160 },
        },
      },
      steps: [
        {
          id: 'care',
          tool: 'reviews.care_plan',
          input: { client: '$inputs.client', website: '$inputs.website', monthly: '$inputs.monthly', terms: '$inputs.terms', start: '$inputs.start', hasTexts: '$inputs.hasTexts', ownerFirst: '$inputs.ownerFirst', myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myContact: '$inputs.myContact' },
        },
      ],
      result: ['care'],
      next: [
        { id: 'reviews.report', why: 'Month end: the one-page report from their Business Profile.' },
        { id: 'reviews.next_25', why: 'Room for another client: line up the next 25.' },
      ],
    },
    {
      id: 'reviews.report',
      title: 'Monthly client report',
      promise: 'Type the month\'s counts from your client\'s Business Profile. Get a one-page report, the email to send it with, and a testimonial and referral ask.',
      minutes: 5,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        required: ['client'],
        properties: {
          client: { type: 'string', title: 'Client business name', maxLength: 100 },
          month: { type: 'string', title: 'Month', maxLength: 40, description: 'Like "November 2026".' },
          startCount: { type: 'number', title: 'Reviews at the start of the month', minimum: 0 },
          endCount: { type: 'number', title: 'Reviews today', minimum: 0 },
          replied: { type: 'number', title: 'New reviews replied to', minimum: 0 },
          stars: { type: 'number', title: 'Stars today', minimum: 1, maximum: 5 },
          cards: { type: 'number', title: 'Cards handed out (optional)', minimum: 0 },
          fixes: { type: 'string', title: 'What you did this month (one per line)', maxLength: 1200 },
          next: { type: 'string', title: 'Next month (one per line)', maxLength: 1200 },
          ownerFirst: { type: 'string', title: 'Owner\'s first name', maxLength: 40 },
          myName: ME.myName,
          myContact: { type: 'string', title: 'Your email or phone', maxLength: 160 },
        },
      },
      steps: [
        {
          id: 'report',
          tool: 'reviews.monthly_report',
          input: { client: '$inputs.client', month: '$inputs.month', startCount: '$inputs.startCount', endCount: '$inputs.endCount', replied: '$inputs.replied', stars: '$inputs.stars', cards: '$inputs.cards', fixes: '$inputs.fixes', next: '$inputs.next', ownerFirst: '$inputs.ownerFirst', myName: '$inputs.myName', myContact: '$inputs.myContact' },
        },
      ],
      result: ['report'],
      next: [
        { id: 'reviews.keep', why: 'After the first report is the time for the one upsell.' },
        { id: 'reviews.next_25', why: 'Room for another client: line up the next 25.' },
      ],
    },
    {
      id: 'reviews.next_25',
      title: 'Your next 25',
      promise: 'The next shops near you, skipping everyone in your Pipeline, each saved with its message, facts and follow-ups so Do my day can hand them out.',
      proof: 'Up to 100 new shops in your Pipeline with every message written, and a spreadsheet',
      minutes: 5,
      tier: 'builder',
      job: 'leads',
      suggestSchedule: { cron: '0 7 * * 1', label: 'Every Monday at 7am' },
      inputs: {
        type: 'object',
        required: ['city'],
        properties: {
          city: { type: 'string', title: 'Your city', maxLength: 120, description: 'Like "Des Moines, IA". We search further out as your list grows.' },
          shop: SHOP,
          count: { type: 'integer', title: 'How many', minimum: 10, maximum: 100, default: 25 },
          ...ME,
          myAddress: ADDRESS,
        },
      },
      steps: [
        {
          id: 'find',
          tool: 'reviews.find_25',
          title: 'Find the next shops',
          input: { city: '$inputs.city', shop: '$inputs.shop', count: '$inputs.count', skipKnown: true, save: true, myName: '$inputs.myName', myBusiness: '$inputs.myBusiness', myAddress: '$inputs.myAddress' },
        },
      ],
      result: ['find'],
      next: [
        { id: 'reviews.sample_one', why: 'Lead with the work: make the card for the best one.' },
        { id: 'reviews.reply', why: 'Someone wrote back: answer while it\'s warm.' },
      ],
    },
  ],
};
