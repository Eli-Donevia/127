// Local presence (local): get found on Google, collect the first honest reviews, and reach the
// neighborhood with print and posts. QR codes come from the kit encoder (packs/_kit/qr.js).

const BIZ_IN = {
  business: { type: 'string', title: 'Business name', maxLength: 80 },
  what: { type: 'string', title: 'What you do', maxLength: 160, description: 'Like "mobile car detailing"' },
  city: { type: 'string', title: 'City', maxLength: 80 },
  phone: { type: 'string', title: 'Phone (optional)', maxLength: 40 },
  website: { type: 'string', title: 'Website or booking link (optional)', maxLength: 300 },
};
const BIZ_REF = { business: '$inputs.business', what: '$inputs.what', city: '$inputs.city', phone: '$inputs.phone', website: '$inputs.website' };

module.exports = {
  id: 'local',
  title: 'Local presence',
  version: '0.1.0',
  summary: 'Get found on Google, get your first honest reviews, and reach your neighborhood with QR flyers, door hangers and posts.',
  niches: [],
  tools: [
    require('./tools/review-link'),
    require('./tools/review-kit'),
    require('./tools/gbp-kit'),
    require('./tools/citations'),
    require('./tools/flyer-copy'),
    require('./tools/flyer'),
    require('./tools/neighborhood-posts'),
    require('./tools/first-25'),
  ],
  workflows: [
    {
      id: 'local.first_10_reviews',
      title: 'Get your first 10 reviews',
      promise: 'QR review cards and a counter sign in your colors, the review ask for each customer, and a 7-day plan. Nothing offered for reviews.',
      minutes: 5,
      tier: 'free',
      inputs: {
        type: 'object',
        properties: {
          ...BIZ_IN,
          link: { type: 'string', title: 'Your Google review link or Place ID (optional)', maxLength: 400, description: 'Business Profile, Ask for reviews, copy the link. Without it the cards open your Google Maps listing.' },
          customers: { type: 'string', title: 'Recent customers, one per line (optional)', maxLength: 6000, description: 'Like "Maria Lopez, 512 555 0142". Nothing is sent for you.' },
        },
      },
      steps: [
        { id: 'link', tool: 'local.review_link', input: { business: '$inputs.business', city: '$inputs.city', link: '$inputs.link' } },
        { id: 'kit', tool: 'local.review_kit', input: { ...BIZ_REF, link: '$link.url', customers: '$inputs.customers' } },
      ],
      result: ['kit'],
      next: ['local.get_found', 'local.flyer_drop'],
    },
    {
      id: 'local.get_found',
      title: 'Get found on Google',
      promise: 'Your Google Business Profile written before you open Google, plus every free listing site in order with one sheet to paste from.',
      minutes: 10,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          ...BIZ_IN,
          services: { type: 'string', title: 'Services and prices, one per line (optional)', maxLength: 2000 },
          areas: { type: 'string', title: 'Towns or ZIP codes you serve (optional)', maxLength: 1200 },
        },
      },
      steps: [
        { id: 'profile', tool: 'local.gbp_kit', input: { ...BIZ_REF, services: '$inputs.services', areas: '$inputs.areas' } },
        { id: 'listings', tool: 'local.citations', input: { ...BIZ_REF, services: '$inputs.services' } },
      ],
      result: ['profile', 'listings'],
      next: ['local.first_10_reviews'],
    },
    {
      id: 'local.flyer_drop',
      title: 'Print a flyer drop',
      promise: 'Edit your flyer copy, then get a Letter flyer, door hangers and an EDDM-size postcard with a QR code and your real offer.',
      minutes: 10,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          ...BIZ_IN,
          services: { type: 'string', title: 'Services and prices, one per line (optional)', maxLength: 2000 },
          offer: { type: 'string', title: 'Your offer (optional)', maxLength: 60, description: 'A real offer you will honor, like "First visit $20 off"' },
          area: { type: 'string', title: 'Streets or neighborhood (optional)', maxLength: 80 },
        },
      },
      steps: [
        { id: 'copy', tool: 'local.flyer_copy', input: { ...BIZ_REF, services: '$inputs.services', offer: '$inputs.offer', area: '$inputs.area' } },
        { id: 'pick', approve: { title: 'Edit your flyer copy (the other headlines are in the step above)', items: '$copy.draft', edit: 'text' } },
        { id: 'flyer', tool: 'local.flyer', input: { ...BIZ_REF, services: '$inputs.services', copy: '$pick', area: '$inputs.area' } },
      ],
      result: ['flyer'],
      next: ['local.neighborhood_launch', 'local.first_10_reviews'],
    },
    {
      id: 'local.neighborhood_launch',
      title: 'Launch in your neighborhood',
      promise: 'Your First 25: a text for each person you know, nearby businesses to partner with, and posts for Nextdoor, Facebook groups and boards.',
      minutes: 10,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          ...BIZ_IN,
          people: { type: 'string', title: 'People you know, one per line (optional)', maxLength: 4000 },
          area: { type: 'string', title: 'Your neighborhood (optional)', maxLength: 80 },
          price: { type: 'string', title: 'Your first-customer price (optional)', maxLength: 60, description: 'Per job or per visit' },
        },
      },
      steps: [
        { id: 'first25', tool: 'local.first_25', input: { ...BIZ_REF, people: '$inputs.people', area: '$inputs.area', price: '$inputs.price' } },
        { id: 'posts', tool: 'local.neighborhood_posts', input: { ...BIZ_REF, area: '$inputs.area' } },
      ],
      result: ['first25', 'posts'],
      next: ['local.flyer_drop', 'local.first_10_reviews'],
    },
  ],
};
