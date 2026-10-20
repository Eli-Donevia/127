// Online store: someone selling physical products online (Shopify, Etsy or their own site). Your first
// 25 (people they know plus local gift shops, markets and cafes from OpenStreetMap), product pages
// counted to Shopify's and Etsy's limits, a price check from their own landed cost, a launch kit, cart
// and after-purchase emails, store policies, a wholesale kit, a photo shot list and an orders reader.
// Drafts only: the member sends, posts and publishes. Niche facts: data/niche.json.

const first = require('./tools/first25');
const page = require('./tools/product-page');
const price = require('./tools/price-check');
const launch = require('./tools/launch-kit');
const emails = require('./tools/store-emails');
const policy = require('./tools/policy');
const wholesale = require('./tools/wholesale');
const shots = require('./tools/shot-list');
const orders = require('./tools/orders');
const NICHE = require('./data/niche.json');

const pass = (tool) => Object.fromEntries(Object.keys(tool.input.properties).map((k) => [k, `$inputs.${k}`]));
const inputsOf = (tool) => ({ type: 'object', properties: tool.input.properties, ...(tool.input.required ? { required: tool.input.required } : {}) });
const one = (id, tool, w) => ({ id, inputs: inputsOf(tool), steps: [{ id: 'run', tool: tool.name, input: pass(tool) }], result: ['run'], ...w });

module.exports = {
  id: 'ecom',
  title: 'Online store',
  version: '0.1.0',
  business: true,
  held: true,
  summary: 'Sell physical products online: your first 25 people and local shops, product pages counted to Shopify and Etsy limits, a price check from your own costs, launch and store emails, policies, a wholesale kit, a shot list and an orders reader.',
  niches: ['online store', 'ecommerce', 'shopify store', 'etsy shop', 'handmade products', 'physical products'],
  notYet: NICHE.crowd.not_yet,
  uses: [],
  tools: [first, page, price, launch, emails, policy, wholesale, shots, orders],
  workflows: [
    one('ecom.first_25', first, {
      title: 'Your first 25',
      promise: '15 people you know with a personal note each, plus 10 local gift shops, markets and cafes with a wholesale, consignment or vendor-table ask.',
      proof: 'An honest crowd check, 25 names with a message each, a dated plan and a CSV, saved to your Pipeline',
      minutes: 15,
      tier: 'free',
      job: 'leads',
      starter: true,
      next: [
        { id: 'ecom.product_page', why: 'Before you send the link, make the product page read well.' },
        { id: 'ecom.wholesale', why: 'Shops said maybe? Bring a line sheet and a pitch email.' },
      ],
    }),
    one('ecom.product_page', page, {
      title: 'Product page writer',
      promise: "Title, bullets, description and alt text for Shopify, plus an Etsy title and 13 tags, each counted to the platform's limit, from your facts only.",
      minutes: 8,
      tier: 'builder',
      job: 'site',
      next: [
        { id: 'ecom.pricing', why: 'Check the price on the page leaves you a margin.' },
        { id: 'ecom.shot_list', why: 'Plan the photos the page needs.' },
      ],
    }),
    one('ecom.pricing', price, {
      title: 'Check your price',
      promise: 'From your landed cost: the fee on Shopify Payments, Etsy and PayPal, profit and margin per sale, break-even and the price for your margin.',
      minutes: 4,
      tier: 'builder',
      job: 'money',
      next: [
        { id: 'ecom.wholesale', why: 'See if your price works at wholesale too.' },
        { id: 'ecom.launch', why: 'Price set? Plan the launch.' },
      ],
    }),
    one('ecom.launch', launch, {
      title: 'Launch email and posts',
      promise: 'A launch email and three posts (a first look, launch day, how it is made), dated from your launch day with a calendar file.',
      minutes: 8,
      tier: 'builder',
      job: 'content',
      next: [
        { id: 'ecom.store_emails', why: 'Set up the cart and after-purchase emails before launch day.' },
        { id: 'ecom.first_25', why: 'Tell 25 people first.' },
      ],
    }),
    one('ecom.store_emails', emails, {
      title: 'Cart and after-purchase emails',
      promise: 'Three abandoned-cart reminders and three after-purchase emails, with an honest review ask that offers nothing for it.',
      minutes: 8,
      tier: 'builder',
      job: 'sales',
      next: [
        { id: 'ecom.policies', why: 'The emails point to your returns and shipping: write them down.' },
        { id: 'ecom.orders', why: 'After a few weeks, see who comes back and what sells.' },
      ],
    }),
    one('ecom.policies', policy, {
      title: 'Returns and shipping policy',
      promise: 'A returns and refunds policy and a shipping policy from your choices, with what to check against Shopify or Etsy first. Not legal advice.',
      minutes: 6,
      tier: 'builder',
      job: 'ops',
      next: [{ id: 'ecom.store_emails', why: 'Put the same terms in your cart and order emails.' }],
    }),
    one('ecom.wholesale', wholesale, {
      title: 'Wholesale pitch kit',
      promise: 'A printable line sheet with your wholesale prices and terms, an order form, and a pitch email for each local shop you name or found.',
      minutes: 10,
      tier: 'builder',
      job: 'sales',
      next: [
        { id: 'ecom.pricing', why: 'Check wholesale still leaves you a profit.' },
        { id: 'ecom.first_25', why: 'Need more shops? List the next ones near you.' },
      ],
    }),
    one('ecom.shot_list', shots, {
      title: 'Product photo shot list',
      promise: 'The photos one product needs in upload order, how to take each with a phone, file names and a printable checklist.',
      minutes: 4,
      tier: 'builder',
      job: 'content',
      next: [{ id: 'ecom.product_page', why: 'Photos done: write the alt text and the page.' }],
    }),
    {
      ...one('ecom.orders', orders, {
        title: 'Read your orders',
        promise: 'Add your Shopify orders export: best sellers, products bought together, and repeat buyers with a thank-you note for each.',
        minutes: 5,
        tier: 'builder',
        job: 'money',
        hqOnly: true,
        next: [
          { id: 'ecom.launch', why: 'Lead your next launch with what sells most.' },
          { id: 'ecom.store_emails', why: 'Few repeat buyers? Set up the after-purchase emails.' },
        ],
      }),
    },
  ],
};
