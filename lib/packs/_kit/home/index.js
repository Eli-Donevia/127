// Builds a household pack (cleaning, lawn, detailing, washing) from its data/ folder: the same tools
// and workflows for every niche, with the niche's facts, prices, partners and words from data.
// A new household niche is data/niche.json, data/prices.json and sample/ files. The specials a niche
// gets are listed in niche.json "specials". Shared household spine.

const config = require('./config');
const tools = require('./tools');
const qt = require('./quote');
const sample = require('./sample');
const reply = require('./reply');
const won = require('./won');
const proof = require('./proof');
const next = require('./next');
const ready = require('./ready');
const specials = require('./specials');

function pack(dir) {
  const cfg = config.load(dir);
  const id = cfg.id;
  const N = cfg.niche;
  const P = N.promises || {};
  const has = (s) => (N.specials || []).includes(s);
  const t = {
    first: tools.first25Tool(cfg),
    card: tools.cardTool(cfg),
    menu: tools.priceMenuTool(cfg),
    quote: tools.quoteTool(cfg),
    keep: tools.keepTool(cfg),
    sample: sample.sampleTool(cfg),
    reply: reply.tool(cfg),
    book: won.bookTool(cfg),
    result: proof.cardTool(cfg),
    story: proof.caseTool(cfg),
    next: next.nextTool(cfg),
    ready: ready.readyTool(cfg),
    ...(has('same_street') ? { street: specials.streetTool(cfg) } : {}),
    ...(has('season_plan') ? { season: specials.seasonTool(cfg) } : {}),
    ...(has('fleets') ? { fleets: specials.fleetTool(cfg) } : {}),
    ...(has('storefronts') ? { storefronts: specials.storefrontTool(cfg) } : {}),
  };
  const W = (name) => `${id}.${name}`;
  const contact = {
    business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
    phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)', description: 'Printed on your door hangers and offer sheet' },
    link: { type: 'string', maxLength: 300, title: 'Booking link (optional)' },
    color: { type: 'string', maxLength: 7, title: 'Brand color hex (optional)', description: 'Like #1F7A5C. We pick one if you leave it empty.' },
  };
  const city = { type: 'string', maxLength: 80, title: 'Your city and state', description: 'Like "Columbus, OH"' };
  const pipeline = (title, description) => ({ type: 'string', maxLength: 120, title, ...(description ? { description } : {}), options: 'pipeline' });
  const pass = (keys) => Object.fromEntries(keys.map((k) => [k, `$inputs.${k}`]));
  const quoteFields = qt.inputSchema(cfg);
  const quoteInput = Object.fromEntries(Object.keys(quoteFields).map((k) => [k, `$inputs.${k}`]));
  const kinds = N.partners.map((p) => p.label);
  const workflows = [
    {
      id: W('first_25'),
      title: 'Your first 25',
      promise: P.first_25,
      minutes: 20,
      tier: 'free',
      job: 'leads',
      inputs: {
        type: 'object',
        properties: {
          people: t.first.input.properties.people,
          city,
          ...contact,
          price: { type: 'string', maxLength: 10, title: 'Your full price for this offer (optional)' },
          exclude: t.first.input.properties.exclude,
          batch: { type: 'string', maxLength: 3, title: 'Batch (optional)', description: '2 for the next 10 businesses' },
        },
      },
      steps: [
        { id: 'list', tool: t.first.name, input: { people: '$inputs.people', city: '$inputs.city', business: '$inputs.business', phone: '$inputs.phone', link: '$inputs.link', price: '$inputs.price', exclude: '$inputs.exclude', batch: '$inputs.batch' } },
        { id: 'card', tool: t.card.name, input: { lead: '$list.lead', business: '$list.business', phone: '$list.phone', link: '$list.link', city: '$list.city', color: '$inputs.color' } },
      ],
      result: ['list', 'card'],
      next: [
        { id: W('sample_one'), why: 'Show one partner or one street your work before you ask for anything.' },
        { id: W('reply'), why: 'Someone wrote back: answer with one next step.' },
        { id: W('offer'), why: 'Set your prices before the first quote.' },
      ],
    },
    {
      id: W('offer'),
      title: 'Your offer',
      promise: P.offer,
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: { position: t.menu.input.properties.position, prices: t.menu.input.properties.prices, supplies: { type: 'string', maxLength: 10, title: 'Supplies and gas per job (optional)' }, hourly: { type: 'string', maxLength: 10, title: 'What you pay yourself per hour (optional)' }, fixed: { type: 'string', maxLength: 10, title: 'Fixed costs per month (optional)' }, ...contact } },
      steps: [
        { id: 'menu', tool: t.menu.name, input: { position: '$inputs.position', prices: '$inputs.prices', supplies: '$inputs.supplies', hourly: '$inputs.hourly', fixed: '$inputs.fixed', business: '$inputs.business', phone: '$inputs.phone', link: '$inputs.link', color: '$inputs.color' } },
        { id: 'card', tool: t.card.name, input: { lead: '$menu.lead', business: '$inputs.business', phone: '$inputs.phone', link: '$inputs.link', color: '$inputs.color' } },
      ],
      result: ['menu', 'card'],
      next: [
        { id: W('ready'), why: 'Put these prices on a website, a Google profile and a flyer.' },
        { id: W('quote'), why: 'Someone asked for a price: quote their exact job.' },
      ],
    },
    {
      id: W('sample_one'),
      title: 'Make a free sample',
      promise: P.sample_one,
      minutes: 5,
      tier: 'builder',
      job: 'leads',
      inputs: {
        type: 'object',
        properties: {
          who: pipeline('Which business (optional)', 'Pick one from your Pipeline or type its name'),
          street: { type: 'string', maxLength: 80, title: 'Or one street', description: 'Like "Maple Ave", near a job you already have. Used when no business is picked.' },
          kind: { type: 'string', enum: kinds, title: 'What kind of business (optional)', description: 'We guess from its name when you leave this empty' },
          day: { type: 'string', maxLength: 40, title: 'When you can do it (optional)', description: 'Like "Saturday morning"' },
          city,
          ...contact,
        },
      },
      steps: [{ id: 'sample', tool: t.sample.name, input: pass(['who', 'street', 'kind', 'day', 'city', 'business', 'phone', 'link', 'color']) }],
      result: ['sample'],
      next: [
        { id: W('reply'), why: 'They wrote back: answer with one next step.' },
        { id: W('won'), why: 'They said yes: book it and print the job sheet.' },
      ],
    },
    {
      id: W('reply'),
      title: 'Answer a reply',
      promise: P.reply,
      minutes: 2,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['who', 'reply'],
        properties: {
          who: pipeline('Who wrote back', 'Pick from your Pipeline or type their name'),
          reply: { type: 'string', maxLength: 6000, format: 'textarea', title: 'What they wrote' },
          city,
          business: contact.business,
          phone: contact.phone,
        },
      },
      steps: [{ id: 'answer', tool: t.reply.name, input: pass(['who', 'reply', 'city', 'business', 'phone']) }],
      result: ['answer'],
      next: [
        { id: W('quote'), why: 'They asked how much: quote their exact job.' },
        { id: W('won'), why: 'They said yes: book it and print the job sheet.' },
      ],
    },
    {
      id: W('quote'),
      title: 'Quote a job',
      promise: P.quote,
      minutes: 3,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['customer'],
        properties: {
          customer: { type: 'string', maxLength: 80, title: 'Customer name' },
          customerContact: { type: 'string', maxLength: 160, title: 'Their email or phone (optional)' },
          ...quoteFields,
          deposit: { type: 'string', maxLength: 20, title: 'Deposit to book (optional)', description: '"25%" or "$50"' },
          payLink: { type: 'string', maxLength: 300, title: 'Your payment link (optional)', description: 'Stripe, Square or PayPal.Me. Buyers pay you directly.' },
        },
      },
      steps: [
        { id: 'job', tool: t.quote.name, input: { ...quoteInput, customer: '$inputs.customer' } },
        { id: 'quote', tool: 'sales.quote', input: { items: '$job.items', customer: { name: '$inputs.customer', contact: '$inputs.customerContact' }, title: '$job.title', notes: '$job.notes', deposit: '$inputs.deposit', payLink: '$inputs.payLink' } },
        { id: 'won', approve: { title: 'Did they say yes?', note: 'Pick yes when they book, and the invoice is made from this quote.', choose: '$job.next', label: 'label', max: 1 } },
        { id: 'invoice', tool: 'sales.invoice', when: '$won.chosen.0.invoice', input: { quote: '$quote', payLink: '$inputs.payLink' } },
      ],
      result: ['job', 'quote', 'invoice'],
      next: [
        { id: W('won'), why: 'They booked: the booking text, prep text and job sheet.' },
        { id: W('keep'), why: 'After the job: thank-you, review ask and the regular plan.' },
      ],
    },
    {
      id: W('won'),
      title: 'A customer said yes',
      promise: P.won,
      minutes: 5,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        required: ['customer'],
        properties: {
          customer: pipeline('Who said yes', 'Pick from your Pipeline or type their name'),
          job: { type: 'string', enum: cfg.prices.packages.filter((p) => !p.rate).map((p) => p.label), title: 'The job (optional)', description: "This month's offer when you leave it empty" },
          when: { type: 'string', maxLength: 60, title: 'Day and time (optional)', description: 'Like "Saturday, Nov 7 at 9am"' },
          price: { type: 'string', maxLength: 10, title: 'Price you agreed (optional)', description: 'Leave empty for your first-clients price' },
          contact: { type: 'string', maxLength: 160, title: 'Their phone or email (optional)' },
          address: { type: 'string', maxLength: 200, title: 'Address (optional)' },
          notes: { type: 'string', maxLength: 600, title: 'Notes for the job sheet (optional)', description: 'Gate code, pets, parking' },
          deposit: { type: 'string', maxLength: 20, title: 'Deposit to book (optional)', description: '"25%" or "$50". Leave empty to bill after the job.' },
          payLink: { type: 'string', maxLength: 300, title: 'Your payment link (optional)', description: 'Stripe, Square or PayPal.Me. Buyers pay you directly.' },
          city,
          ...contact,
        },
      },
      steps: [
        { id: 'book', tool: t.book.name, input: pass(['customer', 'job', 'when', 'price', 'contact', 'address', 'notes', 'deposit', 'city', 'business', 'phone', 'link', 'color']) },
        // The booking already logged the win in this pack, so the invoice adds no Pipeline row of its own.
        { id: 'invoice', tool: 'sales.invoice', input: { items: '$book.items', customer: { name: '$book.customer.name', contact: '$book.customer.contact', address: '$book.customer.address' }, title: '$book.title', notes: '$book.notes', deposit: '$inputs.deposit', payLink: '$inputs.payLink', contact: '$book.contactLine', from: { name: '$inputs.business' }, dueDays: 0, pipeline: false } },
      ],
      result: ['book', 'invoice'],
      next: [
        { id: W('proof'), why: 'After the job: turn the before and after into proof.' },
        { id: W('keep'), why: 'Thank-you, honest review ask and the regular plan, each dated.' },
      ],
    },
    {
      id: W('keep'),
      title: 'Keep your customers',
      promise: P.keep,
      minutes: 5,
      tier: 'builder',
      job: 'sales',
      inputs: { type: 'object', required: ['customer'], properties: { customer: { type: 'string', maxLength: 80, title: 'Customer name' }, job: t.keep.input.properties.job, review: t.keep.input.properties.review, business: contact.business, phone: contact.phone, color: contact.color } },
      steps: [{ id: 'keep', tool: t.keep.name, input: pass(['customer', 'job', 'review', 'business', 'phone', 'color']) }],
      result: ['keep'],
      next: [
        { id: W('proof'), why: 'Share the work once they say yes.' },
        { id: W('next_25'), why: 'Keep Do my day stocked with the next businesses.' },
      ],
    },
    {
      id: W('proof'),
      title: 'Show your work',
      promise: P.proof,
      minutes: 5,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        required: ['what'],
        properties: {
          what: { type: 'string', maxLength: 120, title: 'What you did', description: `Like "${(N.proof || {}).what || 'the job'}"` },
          customer: pipeline('Customer (optional)', 'Only their first name is ever shown, and only with their yes'),
          result: { type: 'string', maxLength: 240, title: 'What changed, in your words (optional)', description: `Like "${(N.proof || {}).result || 'what you finished'}". Only numbers you counted.` },
          took: { type: 'string', maxLength: 60, title: 'How long it took (optional)', description: 'Like "3 hours"' },
          area: { type: 'string', maxLength: 60, title: 'Neighborhood or town (optional)' },
          before: { type: 'string', format: 'asset', accept: 'image/*', title: 'Before photo (optional)', description: 'Add both photos for a before-and-after collage. JPG or PNG.' },
          after: { type: 'string', format: 'asset', accept: 'image/*', title: 'After photo (optional)', description: 'Same spot and angle as the before' },
          quote: { type: 'string', maxLength: 280, title: 'What they said, word for word (optional)', description: 'Only their own words from a text or email' },
          deal: { type: 'string', enum: proof.DEALS, title: 'What they paid (optional)', description: 'A founding or free job is said plainly on the case study' },
          review: { type: 'string', maxLength: 300, title: 'Your review link (optional)' },
          city,
          ...contact,
        },
      },
      steps: [
        { id: 'card', tool: t.result.name, input: pass(['what', 'customer', 'result', 'took', 'area', 'quote', 'deal', 'before', 'after', 'review', 'city', 'business', 'phone', 'link', 'color']) },
        { id: 'ok', approve: { title: 'Did they say yes to sharing, in writing?', note: 'Send them the permission ask first. Pick yes only when you have their yes in a text or email. Not yet keeps the card, collage and messages and skips the case study.', choose: '$card.share', label: 'label', max: 1 }, optional: true },
        { id: 'story', tool: t.story.name, when: '$ok.chosen.0.share', input: { card: '$card', share: '$ok.chosen.0.share', what: '$inputs.what', customer: '$inputs.customer', result: '$inputs.result', took: '$inputs.took', quote: '$inputs.quote', before: '$inputs.before', after: '$inputs.after', city: '$inputs.city', business: '$inputs.business', phone: '$inputs.phone', link: '$inputs.link', color: '$inputs.color' } },
      ],
      result: ['card', 'story'],
      next: [
        { id: W('next_25'), why: 'Proof in hand: reach the next 25 businesses.' },
        { id: W('ready'), why: 'Put the case study and prices on your own site.' },
      ],
    },
    {
      id: W('next_25'),
      title: 'Your next 25',
      promise: P.next_25,
      minutes: 15,
      tier: 'builder',
      job: 'leads',
      suggestSchedule: { cron: '0 7 * * 1', label: 'Every Monday at 7am' },
      inputs: {
        type: 'object',
        properties: {
          city,
          count: { type: 'integer', minimum: 10, maximum: 100, default: 25, title: 'How many', description: 'Do my day hands out up to 25 a morning' },
          kind: { type: 'string', enum: kinds, title: 'Only one kind of business (optional)' },
          people: { type: 'string', maxLength: 4000, format: 'textarea', title: 'New people you know (optional)', description: 'One per line: name, how you know them. Already in your Pipeline is skipped.' },
          business: contact.business,
          phone: contact.phone,
          link: contact.link,
        },
      },
      steps: [{ id: 'batch', tool: t.next.name, input: pass(['city', 'count', 'kind', 'people', 'business', 'phone', 'link']) }],
      result: ['batch'],
      next: [
        { id: W('sample_one'), why: 'Lead with a free sample for the best few.' },
        { id: W('reply'), why: 'Someone wrote back: answer with one next step.' },
      ],
    },
    {
      id: W('ready'),
      title: 'Look ready',
      promise: P.ready,
      minutes: 15,
      tier: 'builder',
      job: 'site',
      inputs: {
        type: 'object',
        properties: {
          city,
          areas: { type: 'string', maxLength: 600, title: 'Towns or neighborhoods you serve (optional)', description: 'Comma separated, up to 20' },
          business: contact.business,
          phone: contact.phone,
          email: { type: 'string', maxLength: 120, title: 'Your email (optional)' },
          link: contact.link,
          about: { type: 'string', maxLength: 600, format: 'textarea', title: 'About you, in your words (optional)', description: 'Two or three true sentences. Left empty, the site writes a plain one from your facts.' },
          color: contact.color,
        },
      },
      steps: [
        { id: 'facts', tool: t.ready.name, input: pass(['city', 'areas', 'business', 'phone', 'email', 'link', 'about', 'color']) },
        { id: 'site', tool: 'site.build', input: { facts: '$facts.site', design: 'local-service', for: 'me' } },
        { id: 'profile', tool: 'local.gbp_kit', input: { business: '$facts.gbp.business', what: '$facts.gbp.what', city: '$facts.gbp.city', region: '$facts.gbp.region', phone: '$facts.gbp.phone', email: '$facts.gbp.email', booking: '$facts.gbp.booking', color: '$facts.gbp.color', services: '$facts.gbp.services', firstName: '$facts.gbp.firstName', group: '$facts.gbp.group', areas: '$facts.gbp.areas', promise: '$facts.gbp.promise' } },
        { id: 'flyer', tool: 'local.flyer', input: { business: '$facts.flyer.business', what: '$facts.flyer.what', city: '$facts.flyer.city', region: '$facts.flyer.region', phone: '$facts.flyer.phone', email: '$facts.flyer.email', booking: '$facts.flyer.booking', color: '$facts.flyer.color', services: '$facts.flyer.services', firstName: '$facts.flyer.firstName', group: '$facts.flyer.group', copy: '$facts.flyer.copy', offer: '$facts.flyer.offer', area: '$facts.flyer.area', formats: 'flyer', campaign: 'ready' } },
      ],
      result: ['facts', 'site', 'profile', 'flyer'],
      next: [
        { id: W('next_25'), why: 'Looking ready: reach the next 25 businesses.' },
        { id: W('sample_one'), why: 'Show one partner your work before you ask.' },
      ],
    },
  ];

  if (t.street) {
    workflows.push({
      id: W('same_street'),
      title: 'Same street first',
      promise: P.same_street,
      minutes: 10,
      tier: 'builder',
      job: 'leads',
      inputs: {
        type: 'object',
        required: ['street'],
        properties: {
          street: { type: 'string', maxLength: 80, title: "Your customer's street", description: 'Like "Maple Ave"' },
          number: { type: 'string', maxLength: 10, title: 'Their house number (optional)', description: 'Fills in the homes around them on the route sheet' },
          customer: pipeline('Customer (optional)', 'For the intro ask'),
          day: { type: 'string', maxLength: 40, title: 'The day you are there (optional)', description: 'Like "Tuesdays"' },
          count: { type: 'integer', minimum: 6, maximum: 40, default: 20, title: 'Homes on the route' },
          city,
          ...contact,
        },
      },
      steps: [{ id: 'street', tool: t.street.name, input: pass(['street', 'number', 'customer', 'day', 'count', 'city', 'business', 'phone', 'link', 'color']) }],
      result: ['street'],
      next: [
        { id: W('won'), why: 'A neighbor said yes: book them on the same day.' },
        { id: W('proof'), why: 'Show the street your before and after.' },
      ],
    });
  }
  if (t.season) {
    workflows.push({
      id: W('season_plan'),
      title: 'Your season plan',
      promise: P.season_plan,
      minutes: 5,
      tier: 'builder',
      job: 'offer',
      inputs: { type: 'object', properties: { city, business: contact.business, phone: contact.phone, link: contact.link, color: contact.color } },
      steps: [{ id: 'plan', tool: t.season.name, input: pass(['city', 'business', 'phone', 'link', 'color']) }],
      result: ['plan'],
      next: [
        { id: W('offer'), why: "Price this month's offer on your menu." },
        { id: W('next_25'), why: 'Reach the people this month calls for.' },
      ],
    });
  }
  if (t.fleets) {
    workflows.push({
      id: W('fleets'),
      title: 'Fleets and dealerships',
      promise: P.fleets,
      minutes: 15,
      tier: 'builder',
      job: 'leads',
      inputs: { type: 'object', properties: { city, count: { type: 'integer', minimum: 5, maximum: 40, default: 15, title: 'How many businesses' }, ...contact } },
      steps: [{ id: 'list', tool: t.fleets.name, input: pass(['city', 'count', 'business', 'phone', 'link', 'color']) }],
      result: ['list'],
      next: [
        { id: W('sample_one'), why: 'Wash one vehicle free for the best one on your list.' },
        { id: W('reply'), why: 'A manager wrote back: answer with one next step.' },
      ],
    });
  }
  if (t.storefronts) {
    workflows.push({
      id: W('storefronts'),
      title: 'Storefront window route',
      promise: P.storefronts,
      minutes: 15,
      tier: 'builder',
      job: 'leads',
      inputs: { type: 'object', properties: { city, start: { type: 'string', maxLength: 120, title: 'Where you start (optional)', description: 'A street or corner, like "Main St and 5th"' }, count: { type: 'integer', minimum: 5, maximum: 30, default: 20, title: 'Stops' }, ...contact } },
      steps: [{ id: 'route', tool: t.storefronts.name, input: pass(['city', 'start', 'count', 'business', 'phone', 'link', 'color']) }],
      result: ['route'],
      next: [
        { id: W('won'), why: 'A shop said yes: book the first visit and invoice it.' },
        { id: W('reply'), why: 'A shop wrote back: answer with one next step.' },
      ],
    });
  }

  return {
    id,
    title: N.pack_title,
    version: '0.2.0',
    summary: N.summary,
    niches: N.niches || [id],
    // A business a member starts (contract v1.4): HQ's Start opens on it, workflows in this order.
    business: true,
    uses: ['sales', 'site', 'local'],
    tools: Object.values(t),
    workflows,
  };
}

module.exports = { pack };
