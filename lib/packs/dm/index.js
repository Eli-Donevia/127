// DM funnel kit: turns comments and story replies into conversations, with ManyChat on the
// member's own Instagram. Every workflow ends in a printable setup guide with each message as a
// copy block, a JSON spec, story frames and reel scripts that drive the keyword.

const keywordStep = { id: 'pick', approve: { title: 'Pick your keyword', note: 'People comment this word to get your DM. Short, easy to spell, and rare in everyday comments.', choose: '$plan.keywords', label: 'keyword', detail: 'why', max: 1 } };
const checkStep = { id: 'check', approve: { title: 'Read your messages before you build', note: 'Edit anything that does not sound like you. Buttons can be 20 characters at most.', items: '$flow.items', label: 'label', field: 'text', edit: 'text' } };
const tail = [
  { id: 'posts', tool: 'dm.rank_posts', input: { keyword: '$pick.chosen.0.keyword' } },
  { id: 'flow', tool: 'dm.write_flow', input: { plan: '$plan', keyword: '$pick.chosen.0.keyword' } },
  checkStep,
  { id: 'promo', tool: 'dm.promo_scripts', input: { plan: '$plan', keyword: '$pick.chosen.0.keyword' } },
  { id: 'frames', tool: 'dm.story_frames', input: { plan: '$plan', keyword: '$pick.chosen.0.keyword', stories: '$promo.stories' } },
  { id: 'guide', tool: 'dm.setup_guide', input: { plan: '$plan', keyword: '$pick.chosen.0.keyword', url: '$flow.url', items: '$check.items', promo: '$promo', posts: '$posts' } },
];

const keywordInput = { type: 'string', title: 'Keyword (optional)', description: 'We suggest three if you leave this empty', maxLength: 20 };
const emailInput = { type: 'boolean', title: 'Ask for their email in the DM', description: "Needs ManyChat's Essential plan. Lets you reach people after Instagram's 24 hour window.", default: false };

module.exports = {
  id: 'dm',
  title: 'DM funnel kit',
  version: '0.1.0',
  summary: 'Turn comments and story replies into conversations: ManyChat funnels with every message written, checked against the limits, and a guide to build them in 20 minutes.',
  niches: [],
  system: ['ffmpeg'],
  tools: [
    require('./tools/plan-funnel'),
    require('./tools/rank-posts'),
    require('./tools/read-product'),
    require('./tools/write-flow'),
    require('./tools/promo-scripts'),
    require('./tools/story-frames'),
    require('./tools/setup-guide'),
    require('./tools/write-replies'),
    require('./tools/reply-sheet'),
    require('./tools/check-funnel'),
  ],
  workflows: [
    {
      id: 'dm.comment_to_dm',
      title: 'Send your freebie by DM',
      promise: 'People comment a word and get your freebie by DM. Keyword, replies, DMs with buttons, follow-up, 3 reels, 3 story frames and a ManyChat setup guide.',
      minutes: 20,
      tier: 'free',
      inputs: {
        type: 'object',
        properties: {
          offer: { type: 'string', title: 'Your freebie', description: 'For example "party board planner" or "first-time buyer checklist"', maxLength: 160 },
          link: { type: 'string', title: 'Link to the freebie', description: 'A PDF, Google Doc, Notion page or signup page', maxLength: 500 },
          inside: { type: 'string', title: "What's in it (optional)", description: 'A few things, separated by commas', maxLength: 400 },
          keyword: keywordInput,
          emailCapture: emailInput,
        },
        required: ['offer'],
      },
      steps: [{ id: 'plan', tool: 'dm.plan_funnel', input: { goal: 'freebie', offer: '$inputs.offer', link: '$inputs.link', inside: '$inputs.inside', keyword: '$inputs.keyword', emailCapture: '$inputs.emailCapture' } }, keywordStep, ...tail],
      result: ['guide', 'frames', 'promo'],
      next: ['dm.booking', 'email.welcome'],
    },
    {
      id: 'dm.booking',
      title: 'DM to booked call',
      promise: 'People comment a word, answer one question and get your calendar link. All the DMs, a follow-up, reels, story frames and a ManyChat guide.',
      minutes: 20,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          offer: { type: 'string', title: 'The call', description: 'For example "free 15 minute quote call" or "20 minute fit call"', maxLength: 160 },
          link: { type: 'string', title: 'Booking link', description: 'Your Calendly, Cal.com, Square or Acuity link', maxLength: 500 },
          keyword: keywordInput,
          emailCapture: emailInput,
        },
        required: ['offer'],
      },
      steps: [{ id: 'plan', tool: 'dm.plan_funnel', input: { goal: 'booking', offer: '$inputs.offer', link: '$inputs.link', keyword: '$inputs.keyword', emailCapture: '$inputs.emailCapture' } }, keywordStep, ...tail],
      result: ['guide', 'frames', 'promo'],
      next: ['dm.reply_bank'],
    },
    {
      id: 'dm.product_link',
      title: 'DM a product link',
      promise: 'People comment a word and get your product, its price and a tracked link in their DMs. We read the product page for the details.',
      minutes: 20,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          url: { type: 'string', title: 'Product link', description: 'The product page on your store', maxLength: 500 },
          price: { type: 'string', title: 'Price (optional)', description: 'We read it from the page if you leave this empty', maxLength: 40 },
          keyword: keywordInput,
          emailCapture: emailInput,
        },
        required: ['url'],
      },
      steps: [
        { id: 'product', tool: 'dm.read_product', input: { url: '$inputs.url', price: '$inputs.price' } },
        { id: 'plan', tool: 'dm.plan_funnel', input: { goal: 'product', offer: '$product.name', link: '$product.url', price: '$product.priceText', product: '$product', keyword: '$inputs.keyword', emailCapture: '$inputs.emailCapture' } },
        keywordStep,
        ...tail,
      ],
      result: ['guide', 'frames', 'promo'],
      next: ['email.abandoned_cart'],
    },
    {
      id: 'dm.story_reply',
      title: 'Story reply funnel',
      promise: 'People reply to your story with a word and get your link right away. Messages, follow-up, 3 story frames, 3 reels and the ManyChat guide.',
      minutes: 15,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          offer: { type: 'string', title: 'What they get', description: 'A freebie, a menu, a price list, a booking page', maxLength: 160 },
          link: { type: 'string', title: 'Link', maxLength: 500 },
          inside: { type: 'string', title: "What's in it (optional)", maxLength: 400 },
          keyword: keywordInput,
          emailCapture: emailInput,
        },
        required: ['offer'],
      },
      steps: [{ id: 'plan', tool: 'dm.plan_funnel', input: { goal: 'story', offer: '$inputs.offer', link: '$inputs.link', inside: '$inputs.inside', keyword: '$inputs.keyword', emailCapture: '$inputs.emailCapture' } }, keywordStep, ...tail],
      result: ['guide', 'frames', 'promo'],
      next: ['dm.comment_to_dm'],
    },
    {
      id: 'dm.waitlist',
      title: 'Fill a waitlist',
      promise: 'People comment a word and join your launch waitlist from the DM. The DMs, countdown reels, story frames and a ManyChat setup guide.',
      minutes: 20,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          launch: { type: 'string', title: 'What is launching', description: 'For example "holiday grazing boxes" or "my spring class"', maxLength: 120 },
          date: { type: 'string', title: 'Launch date (optional)', description: 'YYYY-MM-DD, only if it is set', maxLength: 40 },
          link: { type: 'string', title: 'Waitlist signup link', description: 'A Kit, Mailchimp, beehiiv or Google Form page. Not needed if you ask for emails in the DM.', maxLength: 500 },
          keyword: keywordInput,
          emailCapture: { ...emailInput, title: 'Collect emails inside the DM' },
        },
        required: ['launch'],
      },
      steps: [{ id: 'plan', tool: 'dm.plan_funnel', input: { goal: 'waitlist', offer: '$inputs.launch', launch: '$inputs.launch', date: '$inputs.date', link: '$inputs.link', keyword: '$inputs.keyword', emailCapture: '$inputs.emailCapture' } }, keywordStep, ...tail],
      result: ['guide', 'frames', 'promo'],
      next: ['email.launch_week'],
    },
    {
      id: 'dm.reply_bank',
      title: 'Answers for your DMs',
      promise: '20 ready replies for the questions people DM you, plus 4 ManyChat keyword auto-replies, as a printable sheet and a CSV.',
      minutes: 10,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          facts: { type: 'string', title: 'Your facts', description: 'Prices, hours, area you serve, shipping, how to book. One per line.', maxLength: 1500 },
          link: { type: 'string', title: 'Main link (optional)', description: 'Your booking page, shop or menu', maxLength: 500 },
        },
      },
      steps: [
        { id: 'replies', tool: 'dm.write_replies', input: { facts: '$inputs.facts', link: '$inputs.link' } },
        { id: 'check', approve: { title: 'Read your replies', note: 'Fill anything in [brackets] with your real details.', items: '$replies.items', label: 'label', field: 'text', edit: 'text' } },
        { id: 'sheet', tool: 'dm.reply_sheet', input: { items: '$check.items', link: '$inputs.link' } },
      ],
      result: ['sheet'],
      next: ['dm.booking'],
    },
    {
      id: 'dm.check_funnel',
      title: 'Check your DM funnel',
      promise: "Paste the messages you already use and see what breaks ManyChat's limits or Instagram's rules, with a fix for each.",
      minutes: 5,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          keyword: { type: 'string', title: 'Your keyword', maxLength: 30 },
          opening: { type: 'string', title: 'Opening DM', maxLength: 1200 },
          openingButton: { type: 'string', title: 'Opening DM button', maxLength: 60 },
          link: { type: 'string', title: 'Link message', maxLength: 1200 },
          linkButton: { type: 'string', title: 'Link button', maxLength: 60 },
          followUp: { type: 'string', title: 'Follow-up message', maxLength: 1200 },
          followUpHours: { type: 'number', title: 'Follow-up delay in hours', minimum: 0, maximum: 720 },
          publicReplies: { type: 'string', title: 'Public replies', description: 'One per line', maxLength: 1500 },
        },
        required: ['keyword'],
      },
      steps: [{ id: 'report', tool: 'dm.check_funnel', input: { keyword: '$inputs.keyword', opening: '$inputs.opening', openingButton: '$inputs.openingButton', link: '$inputs.link', linkButton: '$inputs.linkButton', followUp: '$inputs.followUp', followUpHours: '$inputs.followUpHours', publicReplies: '$inputs.publicReplies' } }],
      result: ['report'],
      next: ['dm.comment_to_dm'],
    },
  ],
};
