// Digital templates for Etsy and Gumroad. Crowded and slow, so the pack starts from proof: 25 buyer
// searches ranked by public demand, then one template made three ways (spreadsheet with formulas,
// Notion page, printable page), its listing inside Etsy's limits, a mockup and the fee math. Then
// the line around it (offer), the launch (pins, email, review ask, 14 days), the bundle (the
// upsell) and the next product, ranked the same way.

const NICHE = require('./data/niche.json');
const { KIND_TITLES, THEME_LABELS } = require('./lib/tpl');

const KIND = { type: 'string', title: 'Which template?', enum: KIND_TITLES };

module.exports = {
  id: 'templates',
  title: 'Digital templates',
  version: '0.2.0',
  summary: 'Find what buyers already pay for, make one template as a spreadsheet, a Notion page and a printable page, list it with the fees worked out, then launch it, bundle it and pick the next one.',
  niches: ['templates'],
  business: true,
  uses: [],
  system: ['ffmpeg'],
  notYet: NICHE.crowd.not_yet,
  tools: [
    require('./tools/find-demand'),
    require('./tools/make-template'),
    require('./tools/write-listing'),
    require('./tools/plan-offer'),
    require('./tools/make-pins'),
    require('./tools/launch-kit'),
    require('./tools/make-bundle'),
    require('./tools/rank-ideas'),
  ],
  workflows: [
    {
      id: 'templates.first_25',
      title: 'Your first 25',
      promise: '25 template searches ranked by what buyers already rate and pay for, then your first template made three ways with its Etsy listing and fees.',
      proof: 'An honest crowd check, 25 ranked searches with links to check each, your first template as a spreadsheet, Notion page and printable page, a mockup, the listing and the fees',
      minutes: 8,
      tier: 'free',
      job: 'offer',
      starter: true,
      inputs: { type: 'object', properties: { idea: { type: 'string', title: 'A template idea of your own (optional)', maxLength: 80 } } },
      steps: [
        { id: 'find', tool: 'templates.find_demand', input: { idea: '$inputs.idea' } },
        { id: 'pick', approve: { title: 'Pick the template to make first', note: 'These are the five this pack can build. The top one has the most buyer ratings for the fewest listings.', choose: '$find.makeable', label: 'label', detail: 'evidence', max: 1 } },
        { id: 'make', tool: 'templates.make_template', input: { pick: '$pick.chosen', best: '$find.best' } },
        { id: 'listing', tool: 'templates.write_listing', input: { product: '$make.product' } },
      ],
      result: ['find', 'make', 'listing'],
      next: [
        { id: 'templates.offer', why: 'Price the line around it: a free page, a printable version and a bundle.' },
        { id: 'templates.launch', why: 'Or list it first: the listing, 3 pins and an email over 14 days.' },
      ],
    },
    {
      id: 'templates.offer',
      title: 'Your offer',
      promise: 'Your product line around one template: a free page, the template, a printable version and a bundle, priced from what buyers pay, with what each sale leaves you.',
      proof: 'Four products with prices and a job each, what one sale leaves you on Etsy and Gumroad, a one-page offer sheet and a fee calculator with formulas',
      minutes: 6,
      tier: 'builder',
      job: 'offer',
      inputs: {
        type: 'object',
        properties: {
          kind: { ...KIND, title: 'Your main template (optional)', description: 'Left blank: the last one you made' },
          price: { type: 'number', title: 'Your price for it (optional)', minimum: 1, maximum: 200 },
          theme: { type: 'string', title: 'Bundle theme (optional)', enum: THEME_LABELS },
        },
      },
      steps: [{ id: 'plan', tool: 'templates.plan_offer', input: { kind: '$inputs.kind', price: '$inputs.price', theme: '$inputs.theme' } }],
      result: ['plan'],
      next: [
        { id: 'templates.make', why: 'Make the next template in your line: the bundle needs three.' },
        { id: 'templates.launch', why: 'Launch the template the line is built on.' },
      ],
    },
    {
      id: 'templates.make',
      title: 'Make a template',
      promise: 'Pick a template and get it three ways (spreadsheet with formulas, Notion page, printable page), a mockup, the Etsy zip, the listing and the fees.',
      proof: 'One zip with the spreadsheet, Notion page, printable page and how to open each, a 2000 x 1600 mockup, the listing and the fees',
      minutes: 4,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: { kind: { ...KIND, default: 'Monthly Budget' }, title: { type: 'string', title: 'Name on it (optional)', maxLength: 60 }, price: { type: 'number', title: 'Your price (optional)', minimum: 1, maximum: 200 }, color: { type: 'string', title: 'Color (optional)', description: 'A hex color like #2f6f4f', maxLength: 9 } }, required: ['kind'] },
      steps: [
        { id: 'make', tool: 'templates.make_template', input: { kind: '$inputs.kind', title: '$inputs.title', color: '$inputs.color' } },
        { id: 'listing', tool: 'templates.write_listing', input: { product: '$make.product', price: '$inputs.price' } },
      ],
      result: ['make', 'listing'],
      next: [
        { id: 'templates.launch', why: 'Made: now list it, pin it and email it.' },
        { id: 'templates.bundle', why: 'Two or three made: bundle them as the upsell.' },
      ],
    },
    {
      id: 'templates.launch',
      title: 'Launch a template',
      promise: 'Everything to launch one template over 14 days: the Etsy listing, 3 Pinterest pins, a launch email, a note to 5 people you know and an honest review ask.',
      proof: 'Listing inside Etsy limits, 3 pins at 1000 x 1500 with titles, descriptions and alt text, the launch email, the review ask for Etsy and Gumroad, and a dated 14-day plan',
      minutes: 12,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        properties: {
          kind: { ...KIND, title: 'Which template? (optional)', description: 'Left blank: the last one you made' },
          price: { type: 'number', title: 'Your price (optional)', minimum: 1, maximum: 200 },
          link: { type: 'string', format: 'uri', title: 'Your listing link (optional)', description: 'Paste it once the listing is live, so the pins and email link to it' },
          start: { type: 'string', format: 'date', title: 'Launch day (optional)', description: 'Left blank: today' },
        },
      },
      steps: [
        { id: 'listing', tool: 'templates.write_listing', input: { kind: '$inputs.kind', price: '$inputs.price', save: false } },
        { id: 'pins', tool: 'templates.make_pins', input: { product: '$listing.product', link: '$inputs.link' } },
        { id: 'kit', tool: 'templates.launch_kit', input: { product: '$listing.product', listing: '$listing.listing', note: '$listing.note', pins: '$pins.pins', start: '$inputs.start', link: '$inputs.link' } },
      ],
      result: ['listing', 'pins', 'kit'],
      next: [
        { id: 'templates.bundle', why: 'Listed: make the bundle to offer at checkout.' },
        { id: 'templates.next_product', why: 'Day 14: pick the next template from what buyers search for.' },
      ],
    },
    {
      id: 'templates.bundle',
      title: 'Make a bundle',
      promise: 'Three templates from one theme in one zip, a bundle mockup, and its listing with the Gumroad checkout upsell and the fees at the bundle price.',
      proof: 'A zip with three templates three ways each, a 2000 x 1600 mockup, the Etsy listing, the line for each single listing and the Gumroad upsell steps',
      minutes: 6,
      tier: 'builder',
      job: 'offer',
      inputs: {
        type: 'object',
        properties: {
          theme: { type: 'string', title: 'Theme (optional)', enum: THEME_LABELS, description: 'Left blank: the theme of your last template' },
          kinds: { type: 'array', title: 'Templates in it (optional)', items: { type: 'string', enum: KIND_TITLES }, maxItems: 4 },
          price: { type: 'number', title: 'Bundle price (optional)', minimum: 2, maximum: 300 },
        },
      },
      steps: [{ id: 'bundle', tool: 'templates.make_bundle', input: { theme: '$inputs.theme', kinds: '$inputs.kinds', price: '$inputs.price' } }],
      result: ['bundle'],
      next: [
        { id: 'templates.next_product', why: 'Find the next template to add to the line.' },
        { id: 'templates.offer', why: 'See the whole line and what each sale leaves you.' },
      ],
    },
    {
      id: 'templates.next_product',
      title: 'Your next product',
      promise: '25 template ideas ranked by demand you can check yourself, without the ones you made, then the one you pick made three ways with its listing.',
      proof: '25 ranked ideas with links to Gumroad, Etsy, Pinterest and Google Trends for each, your next template made three ways, its mockup and listing',
      minutes: 8,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: { count: { type: 'integer', title: 'How many ideas', minimum: 10, maximum: 50, default: 25 } } },
      steps: [
        { id: 'ideas', tool: 'templates.rank_ideas', input: { count: '$inputs.count' } },
        { id: 'pick', approve: { title: 'Pick your next template', note: 'The five this pack can build that you have not made yet. Check its Etsy and Google Trends links in the file first.', choose: '$ideas.makeable', label: 'label', detail: 'evidence', max: 1 } },
        { id: 'make', tool: 'templates.make_template', input: { pick: '$pick.chosen', best: '$ideas.best', dated: true } },
        { id: 'listing', tool: 'templates.write_listing', input: { product: '$make.product', dated: true } },
      ],
      result: ['ideas', 'make', 'listing'],
      next: [
        { id: 'templates.launch', why: 'Made: launch it the same way as the first one.' },
        { id: 'templates.bundle', why: 'Now a bundle: it fits with what you already sell.' },
      ],
      suggestSchedule: { cron: '0 8 1 * *', label: 'On the 1st of every month at 8am' },
    },
  ],
};
