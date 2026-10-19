// Competitor intel: read what competitors do on their own websites (offer, prices, booking, proof,
// channels, video, ads, what they say they offer, and a Shopify store's public product list) and turn
// it into the exact changes for the member's offer and site, a price range with sources, the gaps
// none of them fill, and what customers praise, complain about and ask for in reviews the member
// pastes (never read off a review site).

module.exports = {
  id: 'intel',
  title: 'Competitor intel',
  version: '0.1.0',
  summary: 'See how your competitors sell from their own websites, where their prices sit, what none of them offer, and what customers say in reviews, with the changes that set you apart.',
  niches: ['local business', 'competitors', 'pricing', 'shopify', 'marketing'],
  business: false,
  system: ['ffmpeg'],
  uses: ['leads'],
  tools: [
    require('./tools/read-sites'),
    require('./tools/scan-competitor'),
    require('./tools/playbook'),
    require('./tools/price-range'),
    require('./tools/pick-competitors'),
    require('./tools/find-gap'),
    require('./tools/read-testimonials'),
    require('./tools/mine-reviews'),
  ],
  workflows: [
    {
      id: 'intel.clone_a_winner',
      title: 'Clone a winner',
      promise: 'Paste up to 5 competitor sites: their offer, prices, booking and proof side by side, and the 5 changes that set you apart.',
      minutes: 10,
      tier: 'free',
      job: 'offer',
      inputs: {
        type: 'object',
        properties: {
          sites: { type: 'string', title: 'Competitor websites', description: 'One per line, up to 5' },
          mine: { type: 'string', title: 'Your website (optional)' },
        },
        required: ['sites'],
      },
      steps: [
        { id: 'list', tool: 'intel.read_sites', input: { sites: '$inputs.sites', max: 5 } },
        { id: 'read', tool: 'intel.scan_competitor', each: '$list.sites', input: { site: '$item' }, concurrency: 5, estimate: 5 },
        { id: 'plan', tool: 'intel.playbook', input: { competitors: '$read', mine: '$inputs.mine' } },
        { id: 'prices', tool: 'intel.price_range', input: { competitors: '$read' } },
      ],
      result: ['plan', 'prices', 'read'],
      next: [
        { id: 'intel.find_gap', why: 'See what none of the competitors near you say, so you can say it first.' },
        { id: 'intel.price_check', why: 'Check where your price sits against the ones near you.' },
      ],
    },
    {
      id: 'intel.price_check',
      title: 'Price check your market',
      promise: 'The prices local competitors show on their own sites, as a range with sources, a chart, and where you could sit.',
      minutes: 5,
      tier: 'builder',
      job: 'offer',
      inputs: {
        type: 'object',
        properties: {
          category: { type: 'string', title: 'Your kind of business', description: 'For example "car detailing", "yoga studios" or "dog groomers"' },
          city: { type: 'string', title: 'Your city' },
        },
        required: ['category', 'city'],
      },
      steps: [
        { id: 'find', tool: 'leads.find_businesses', input: { category: '$inputs.category', city: '$inputs.city', limit: 12, skip_known: false } },
        { id: 'read', tool: 'intel.scan_competitor', each: '$find.places', input: { site: '$item' }, concurrency: 6, estimate: 12 },
        { id: 'prices', tool: 'intel.price_range', input: { competitors: '$read' } },
      ],
      result: ['prices', 'read'],
      next: [
        { id: 'intel.find_gap', why: 'Read what the same competitors say they offer, and what none of them do.' },
        { id: 'intel.clone_a_winner', why: 'Pick the best of them and copy what works, side by side.' },
      ],
    },
    {
      id: 'intel.find_gap',
      title: 'Find the gap',
      promise: 'Read 5 to 10 competitors near you from their own websites: what they all say, what only one or two say, and what none of them offer, with lines you could use.',
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: {
        type: 'object',
        properties: {
          category: { type: 'string', title: 'Your kind of business', description: 'For example "dog groomers", "yoga studios" or "plumbers"' },
          city: { type: 'string', title: 'Your city', description: 'We find competitors near you. Leave it empty if you paste their websites below.' },
          sites: { type: 'string', format: 'textarea', title: 'Competitor websites (optional)', description: 'One per line. We top them up with ones near you, 5 to 10 in all.' },
          mine: { type: 'string', title: 'Your website (optional)', description: 'We mark what you already say.' },
          count: { type: 'integer', title: 'How many competitors', minimum: 5, maximum: 10, default: 8 },
        },
        required: ['category'],
      },
      steps: [
        { id: 'pick', tool: 'intel.pick_competitors', input: { category: '$inputs.category', city: '$inputs.city', sites: '$inputs.sites', mine: '$inputs.mine', count: '$inputs.count' } },
        { id: 'read', tool: 'intel.scan_competitor', each: '$pick.sites', input: { site: '$item', claims: true }, concurrency: 5, estimate: 8, title: 'Read each competitor\'s website' },
        { id: 'gap', tool: 'intel.find_gap', input: { competitors: '$read', category: '$pick.category', city: '$pick.city', mine: '$inputs.mine' } },
      ],
      result: ['gap'],
      next: [
        { id: 'intel.review_miner', why: 'Paste a competitor\'s reviews to see what their customers ask for.' },
        { id: 'intel.price_check', why: 'See where prices sit before you write your offer.' },
      ],
    },
    {
      id: 'intel.review_miner',
      title: 'What reviews say',
      promise: "Paste reviews, yours or a competitor's: what customers praise, complain about and ask for, in their own words, with what to do about each.",
      minutes: 10,
      tier: 'builder',
      job: 'offer',
      inputs: {
        type: 'object',
        properties: {
          reviews: { type: 'string', format: 'textarea', maxLength: 40000, title: 'Paste reviews', description: 'Copy them by hand from Google, Yelp, Facebook or emails and paste them as they are. Names, dates and stars are left out.' },
          whose: { type: 'string', enum: ['My business', 'A competitor'], default: 'My business', title: 'Whose reviews are these?' },
          business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
          website: { type: 'string', title: 'Their own website (optional)', description: 'We also read the testimonials on it. Not a Google, Yelp or Facebook page.' },
        },
      },
      steps: [
        { id: 'site', tool: 'intel.read_testimonials', input: { website: '$inputs.website' } },
        { id: 'mine', tool: 'intel.mine_reviews', input: { reviews: '$inputs.reviews', testimonials: '$site.testimonials', whose: '$inputs.whose', business: '$inputs.business', site: '$site.site', refused: '$site.refused', sample: '$site.sample' } },
      ],
      result: ['mine'],
      next: [
        { id: 'local.first_10_reviews', why: 'Few reviews of your own yet? Ask your first customers the honest way.' },
        { id: 'intel.find_gap', why: 'Check what none of your competitors say on their websites.' },
      ],
    },
  ],
};
