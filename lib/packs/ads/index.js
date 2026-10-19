// Ad desk: the 30-day math first (ads only after outreach has proven the offer), then angles, ads
// checked to the character for Meta, Google and TikTok, a test plan with stop rules, and a reader
// for the results. Plus the makers: ad images in three sizes, a Google search campaign for Google
// Ads Editor, a landing page check and a creator brief. No ad copy promises a result or an income.

const { checkNumbers, findAngles, writeAds, planTest, readResults, NUM_INPUTS, SERVICE } = require('./tools/desk');
const { adImages, googleCampaign, checkPage, creatorBrief, USAGE } = require('./tools/make');

const numRefs = { price: '$inputs.price', cost: '$inputs.cost', jobs30: '$inputs.jobs30', closeRate: '$inputs.closeRate', outreachCustomers: '$inputs.outreachCustomers', budget: '$inputs.budget' };
const mathRefs = { ...numRefs, service: '$inputs.service' };

module.exports = {
  id: 'ads',
  title: 'Ad desk',
  version: '0.2.0',
  summary: 'Know if ads are worth it yet, then get ad images, ads checked to the character for Meta, Google and TikTok, a Google campaign ready to import, a landing page check, a creator brief, a test plan with stop rules, and a plain read of your results.',
  niches: [],
  tools: [checkNumbers, findAngles, writeAds, planTest, readResults, adImages, googleCampaign, checkPage, creatorBrief],
  workflows: [
    {
      id: 'ads.ready_check',
      title: 'Are ads worth it yet?',
      promise: 'The 30-day math from your price and costs: what a customer is worth, your max cost per lead, a plain yes or not yet, and 6 angles to test free first.',
      minutes: 5,
      tier: 'free',
      inputs: { type: 'object', properties: { ...NUM_INPUTS, service: SERVICE } },
      steps: [
        { id: 'math', tool: 'ads.check_numbers', input: mathRefs },
        { id: 'angles', tool: 'ads.find_angles', input: { price: '$inputs.price', service: '$inputs.service' } },
      ],
      result: ['math', 'angles'],
      next: ['ads.launch_kit'],
    },
    {
      id: 'ads.launch_kit',
      title: 'Your first ad test',
      promise: 'Ads for 3 angles, every line counted for Meta, Google and TikTok, the first 3 seconds of each video, tracking links, a budget split and stop rules.',
      minutes: 20,
      tier: 'builder',
      inputs: { type: 'object', properties: { ...NUM_INPUTS, url: { type: 'string', title: 'Page the ads send people to', description: 'Starts with https://', maxLength: 300 }, service: SERVICE } },
      steps: [
        { id: 'math', tool: 'ads.check_numbers', input: mathRefs },
        { id: 'angles', tool: 'ads.find_angles', input: { price: '$inputs.price', service: '$inputs.service', needService: true } },
        { id: 'pick', approve: { title: 'Pick up to 3 angles to test', choose: '$angles.angles', label: 'hook', detail: 'why', max: 3 } },
        { id: 'ads', tool: 'ads.write_ads', each: '$pick.chosen', concurrency: 3, input: { angle: '$item', price: '$inputs.price', service: '$inputs.service' } },
        { id: 'plan', tool: 'ads.plan_test', input: { numbers: '$math.numbers', ads: '$ads', url: '$inputs.url', service: '$inputs.service' } },
      ],
      result: ['math', 'ads', 'plan'],
      next: ['ads.read_results'],
    },
    {
      id: 'ads.read_results',
      title: 'Read your ad results',
      promise: 'Paste your Ads Manager export and see, for each ad, what a lead costs, where it is stuck, and whether to stop, fix or raise it.',
      minutes: 10,
      tier: 'builder',
      inputs: { type: 'object', properties: { csv: { type: 'string', title: 'Paste your export (CSV)', maxLength: 200000 }, ...NUM_INPUTS } },
      steps: [{ id: 'read', tool: 'ads.read_results', input: { csv: '$inputs.csv', ...numRefs } }],
      result: ['read'],
      next: ['ads.launch_kit'],
    },
    {
      id: 'ads.ad_images',
      title: 'Make your ad images',
      promise: 'Ad images in your colors for up to 3 angles, each in feed square, feed portrait and Stories sizes with the words in the safe zone, plus the text for each ad.',
      proof: 'Up to 9 PNG ads in one ZIP, a preview of them all and the ad text, every line checked for claims',
      minutes: 5,
      tier: 'builder',
      job: 'ads',
      inputs: {
        type: 'object',
        properties: {
          price: NUM_INPUTS.price,
          photo: { type: 'string', format: 'asset', accept: 'image/*', title: 'A photo of your own work (optional)', description: 'A real job of yours, with your customer\'s OK. It leads the ad, and adds the before and after angle.' },
          color: { type: 'string', title: 'Brand color (optional)', description: 'A hex color like #0f766e. We use your brand kit color if you have one.', maxLength: 7 },
          service: SERVICE,
        },
      },
      steps: [
        { id: 'angles', tool: 'ads.find_angles', input: { price: '$inputs.price', service: '$inputs.service', needService: true } },
        { id: 'pick', approve: { title: 'Pick up to 3 angles for your ad images', choose: '$angles.angles', label: 'hook', detail: 'why', max: 3 } },
        { id: 'images', tool: 'ads.ad_images', input: { angles: '$pick.chosen', photo: '$inputs.photo', color: '$inputs.color', price: '$inputs.price', service: '$inputs.service' } },
      ],
      result: ['images'],
      next: [
        { id: 'ads.landing_check', why: 'Check the page these ads send people to before you spend a dollar.' },
        { id: 'ads.launch_kit', why: 'Get the ad text for every platform, tracking links and stop rules for a first test.' },
      ],
    },
    {
      id: 'ads.google_search',
      title: 'Your Google search campaign',
      promise: 'A paused Google search campaign in one file for Google Ads Editor: keywords for your service and city, negatives, counted ads and a budget from your numbers.',
      proof: 'A Google Ads Editor CSV and a guide to import it, add your area and check every line',
      minutes: 15,
      tier: 'builder',
      job: 'ads',
      inputs: {
        type: 'object',
        properties: {
          ...NUM_INPUTS,
          url: { type: 'string', title: 'Page the ads send people to', description: 'Starts with https://', maxLength: 300 },
          keywords: { type: 'string', format: 'textarea', title: 'Your own keywords (optional)', description: 'One per line, like "ceramic coating austin"', maxLength: 2000 },
          service: SERVICE,
        },
        required: ['url'],
      },
      steps: [
        { id: 'math', tool: 'ads.check_numbers', input: mathRefs },
        { id: 'campaign', tool: 'ads.google_campaign', input: { numbers: '$math.numbers', url: '$inputs.url', keywords: '$inputs.keywords', budget: '$inputs.budget', price: '$inputs.price', service: '$inputs.service' } },
      ],
      result: ['campaign', 'math'],
      next: [
        { id: 'ads.landing_check', why: 'Make sure the page says what the ads say before the campaign goes live.' },
        { id: 'ads.read_results', why: 'After a week, see what each lead costs and what to change.' },
      ],
    },
    {
      id: 'ads.landing_check',
      title: 'Check your ad landing page',
      promise: 'Your landing page checked the way a phone visitor sees it: speed, price, area, one clear action, a short form, proof and tracking, with the fixes in order.',
      proof: 'A score out of 100 and a printable report with what we saw and the fix for each check',
      minutes: 3,
      tier: 'builder',
      job: 'ads',
      inputs: {
        type: 'object',
        properties: {
          url: { type: 'string', title: 'Page the ads send people to', description: 'Starts with https://', maxLength: 300 },
          ad: { type: 'string', title: 'Your ad headline or hook (optional)', description: 'To check the page says the same thing', maxLength: 300 },
          price: NUM_INPUTS.price,
        },
        required: ['url'],
      },
      steps: [{ id: 'check', tool: 'ads.check_page', input: { url: '$inputs.url', ad: '$inputs.ad', price: '$inputs.price' } }],
      result: ['check'],
      next: [
        { id: 'ads.ad_images', why: 'With the page ready, make the ad images that send people to it.' },
        { id: 'ads.google_search', why: 'Build a Google search campaign that points at this page.' },
      ],
    },
    {
      id: 'ads.creator_brief',
      title: 'Brief a creator for your ads',
      promise: 'A brief for a creator who films your ads: angles and first 3 seconds, what to say and never say, how to mark it as an ad, usage rights, dates and pay.',
      proof: 'A printable brief, the same brief as text, and a DM and email to send it with',
      minutes: 10,
      tier: 'builder',
      job: 'ads',
      inputs: {
        type: 'object',
        properties: {
          price: NUM_INPUTS.price,
          creator: { type: 'string', title: "Creator's name (optional)", maxLength: 80 },
          videos: { type: 'integer', title: 'How many videos', minimum: 1, maximum: 6, default: 2 },
          length: { type: 'string', title: 'Video length', enum: ['15 seconds', '30 seconds', '15 to 30 seconds'], default: '15 to 30 seconds' },
          usage: { type: 'string', title: 'How you may use the videos', enum: USAGE, default: '30 days of ads' },
          pay: { type: 'number', title: 'Pay per video (optional)', minimum: 0 },
          due: { type: 'string', format: 'date', title: 'Final videos due (optional)' },
          musts: { type: 'string', format: 'textarea', title: 'Facts they must get right (optional)', description: 'One per line', maxLength: 1500 },
          avoid: { type: 'string', format: 'textarea', title: 'Anything to avoid (optional)', maxLength: 1500 },
          service: SERVICE,
        },
      },
      steps: [
        { id: 'angles', tool: 'ads.find_angles', input: { price: '$inputs.price', service: '$inputs.service', needService: true } },
        { id: 'pick', approve: { title: 'Pick up to 3 angles for the creator to film', choose: '$angles.angles', label: 'hook', detail: 'why', max: 3 } },
        { id: 'brief', tool: 'ads.creator_brief', input: { angles: '$pick.chosen', creator: '$inputs.creator', videos: '$inputs.videos', length: '$inputs.length', usage: '$inputs.usage', pay: '$inputs.pay', due: '$inputs.due', musts: '$inputs.musts', avoid: '$inputs.avoid', price: '$inputs.price', service: '$inputs.service' } },
      ],
      result: ['brief'],
      next: [
        { id: 'ads.ad_images', why: 'Make still image ads in the same angles while the videos are filmed.' },
        { id: 'ads.read_results', why: 'Once the videos run as ads, see what each lead costs.' },
      ],
    },
  ],
};
