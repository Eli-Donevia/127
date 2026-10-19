// Email desk: welcome series, launch week and abandoned cart emails written from the member's own
// facts, as a designed HTML email per send (their tool's unsubscribe and address tags in the
// footer), a CSV with the send schedule, plain text and paste steps for Kit, Mailchimp, Klaviyo
// and beehiiv. Nurture, win-back and a monthly newsletter make two dated files each. Plus 30
// subject lines with spam checks.

const platformInput = { type: 'string', title: 'Your email tool', enum: ['kit', 'mailchimp', 'klaviyo', 'beehiiv', 'other'], default: 'kit', description: 'We put its unsubscribe and address tags in the footer' };
const check = { id: 'check', approve: { title: 'Read your emails', note: 'Edit anything that does not sound like you. Fill every [bracket] with your real details before you send.', items: '$write.items', label: 'label', field: 'text', edit: 'text' } };

module.exports = {
  id: 'email',
  title: 'Email desk',
  version: '0.1.0',
  summary: 'Emails that go out on their own: welcome series, launch week, abandoned cart, nurture, win-back and a monthly newsletter, written from your facts, designed in your colors and ready to paste into Kit, Mailchimp, Klaviyo or beehiiv.',
  niches: [],
  system: [],
  tools: [require('./tools/write-sequence'), require('./tools/build-emails'), require('./tools/subject-lines')],
  workflows: [
    {
      id: 'email.welcome',
      title: 'Welcome emails',
      promise: 'Five welcome emails that deliver your freebie, tell your story, answer the big questions and invite people to buy, with a schedule and paste steps.',
      minutes: 25,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        properties: {
          offer: { type: 'string', title: 'What they signed up for (optional)', description: 'Your freebie, like "scent guide for every room". Leave empty for a plain welcome.', maxLength: 160 },
          link: { type: 'string', title: 'Link (optional)', description: 'Where the freebie or your shop lives', maxLength: 500 },
          platform: platformInput,
        },
      },
      steps: [
        { id: 'write', tool: 'email.write_sequence', input: { kind: 'welcome', offer: '$inputs.offer', link: '$inputs.link' } },
        check,
        { id: 'files', tool: 'email.build_emails', input: { kind: 'welcome', items: '$check.items', platform: '$inputs.platform', offer: '$inputs.offer' } },
      ],
      result: ['files'],
      next: [
        { id: 'email.subject_lines', why: 'Test more subject lines before the first email goes out.' },
        { id: 'dm.comment_to_dm', why: 'Hand out the same freebie by DM when people comment a word on your posts.' },
      ],
    },
    {
      id: 'email.launch_week',
      title: 'Launch week emails',
      promise: 'Six emails from a first look to launch day and after, dated around your launch, with a calendar file, a CSV schedule and designed HTML.',
      minutes: 30,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        properties: {
          launch: { type: 'string', title: 'What is launching', description: 'For example "Winter Cabin collection"', maxLength: 120 },
          date: { type: 'string', title: 'Launch date', description: 'YYYY-MM-DD', maxLength: 10 },
          link: { type: 'string', title: 'Link to it (optional)', maxLength: 500 },
          closeDate: { type: 'string', title: 'Orders close (optional)', description: 'YYYY-MM-DD, only if it is real', maxLength: 10 },
          platform: platformInput,
        },
        required: ['launch', 'date'],
      },
      steps: [
        { id: 'write', tool: 'email.write_sequence', input: { kind: 'launch', launch: '$inputs.launch', date: '$inputs.date', link: '$inputs.link', closeDate: '$inputs.closeDate' } },
        check,
        { id: 'files', tool: 'email.build_emails', input: { kind: 'launch', items: '$check.items', platform: '$inputs.platform', launch: '$inputs.launch', date: '$inputs.date' } },
      ],
      result: ['files'],
      next: [
        { id: 'dm.waitlist', why: 'People comment a word on your posts and join the launch waitlist by DM.' },
        { id: 'email.subject_lines', why: 'Try more subject lines for launch day.' },
      ],
    },
    {
      id: 'email.abandoned_cart',
      title: 'Abandoned cart emails',
      promise: 'Three friendly reminders for people who start checkout and stop, with your shipping and returns answers, timing and setup steps.',
      minutes: 20,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        properties: {
          link: { type: 'string', title: 'Your shop link', description: 'Your email tool swaps in each person\'s own checkout link', maxLength: 500 },
          shipping: { type: 'string', title: 'Shipping', description: 'For example "Free shipping on orders over $50"', maxLength: 200 },
          returns: { type: 'string', title: 'If something is not right', description: 'For example "If a candle arrives damaged, I replace it"', maxLength: 200 },
          discount: { type: 'string', title: 'A discount for email 3 (optional)', description: 'Only if you want one, like "10% off with code COZY10"', maxLength: 120 },
          platform: { ...platformInput, enum: ['klaviyo', 'mailchimp', 'kit', 'other'], default: 'klaviyo' },
        },
      },
      steps: [
        { id: 'write', tool: 'email.write_sequence', input: { kind: 'cart', link: '$inputs.link', shipping: '$inputs.shipping', returns: '$inputs.returns', discount: '$inputs.discount' } },
        check,
        { id: 'files', tool: 'email.build_emails', input: { kind: 'cart', items: '$check.items', platform: '$inputs.platform' } },
      ],
      result: ['files'],
      next: [
        { id: 'dm.product_link', why: 'People who comment a word get the product, its price and the link in their DMs.' },
        { id: 'email.welcome', why: 'New subscribers get five welcome emails that end with an invite to buy.' },
      ],
    },
    {
      id: 'email.nurture',
      title: 'Nurture emails',
      promise: "Six weekly emails for people on your list who haven't bought yet: a tip, a common mistake, a real story, a straight answer, what to ask and a plain invite.",
      minutes: 20,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        properties: {
          topic: { type: 'string', title: 'What your customers want help with (optional)', description: 'Like "a greener lawn" or "a home that smells good"', maxLength: 80 },
          tips: { type: 'string', format: 'textarea', title: 'What you tell customers (optional)', description: 'A tip, a mistake you see a lot, the question people ask most. One per line: each one goes in an email.', maxLength: 2000 },
          link: { type: 'string', title: 'Where people book or buy (optional)', description: 'For the last email', maxLength: 500 },
          platform: platformInput,
        },
      },
      steps: [
        { id: 'write', tool: 'email.write_sequence', input: { kind: 'nurture', topic: '$inputs.topic', tips: '$inputs.tips', link: '$inputs.link' } },
        check,
        { id: 'files', tool: 'email.build_emails', input: { kind: 'nurture', items: '$check.items', platform: '$inputs.platform', topic: '$inputs.topic' } },
      ],
      result: ['files'],
      next: [
        { id: 'email.subject_lines', why: 'Test more subject lines before the first email goes out.' },
        { id: 'email.win_back', why: 'Past customers who went quiet get three emails of their own.' },
      ],
    },
    {
      id: 'email.win_back',
      title: 'Win-back emails',
      promise: "Three emails for past customers who haven't been back in a while: a hello with what's new, an easy way back, and a check-in that lets them stay or go.",
      minutes: 15,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        properties: {
          since: { type: 'string', title: "Customers who haven't been back in", enum: ['2 months', '3 months', '6 months', 'a year'], default: '3 months' },
          news: { type: 'string', title: "What's new since they last came (optional)", description: 'Like "We now do fall aeration" or "Six new winter scents"', maxLength: 300 },
          discount: { type: 'string', title: 'A welcome-back offer (optional)', description: 'Only if it is real, with its end date, like "15% off your next order until November 30"', maxLength: 160 },
          start: { type: 'string', format: 'date', title: 'First send date (optional)', description: 'Empty starts on the next weekday', maxLength: 10 },
          link: { type: 'string', title: 'Where they book or buy (optional)', maxLength: 500 },
          platform: platformInput,
        },
      },
      steps: [
        { id: 'write', tool: 'email.write_sequence', input: { kind: 'winback', news: '$inputs.news', discount: '$inputs.discount', start: '$inputs.start', link: '$inputs.link' } },
        check,
        { id: 'files', tool: 'email.build_emails', input: { kind: 'winback', items: '$check.items', platform: '$inputs.platform', since: '$inputs.since', start: '$inputs.start' } },
      ],
      result: ['files'],
      next: [
        { id: 'warm.reconnect', why: 'Text the past customers you know well instead of emailing them.' },
        { id: 'email.newsletter', why: 'Keep the ones who stay hearing from you once a month.' },
      ],
    },
    {
      id: 'email.newsletter',
      title: 'Monthly newsletter',
      promise: "This month's email to your list: a short note, what's new, one tip, what's coming up and one clear next step, designed in your colors and ready to paste.",
      minutes: 15,
      tier: 'builder',
      job: 'content',
      suggestSchedule: { cron: '0 9 1 * *', label: 'On the 1st of each month at 9am' },
      inputs: {
        type: 'object',
        properties: {
          news: { type: 'string', format: 'textarea', title: "What's new (optional)", description: 'A new service, product, hours or team member. One per line.', maxLength: 1000 },
          tip: { type: 'string', title: 'A tip for your customers (optional)', maxLength: 300 },
          coming: { type: 'string', title: 'Coming up (optional)', description: 'A date, an event or your holiday hours', maxLength: 300 },
          link: { type: 'string', title: 'Where they book or buy (optional)', maxLength: 500 },
          platform: platformInput,
        },
      },
      steps: [
        { id: 'write', tool: 'email.write_sequence', input: { kind: 'newsletter', news: '$inputs.news', tip: '$inputs.tip', coming: '$inputs.coming', link: '$inputs.link' } },
        { id: 'check', approve: { title: 'Read your newsletter', note: "Fill every [bracket] with this month's real news before you send. On a repeat, last month's news, tip and dates are left out for you.", items: '$write.items', label: 'label', field: 'text', edit: 'text' } },
        { id: 'files', tool: 'email.build_emails', input: { kind: 'newsletter', items: '$check.items', platform: '$inputs.platform', news: '$inputs.news', tip: '$inputs.tip', coming: '$inputs.coming' } },
      ],
      result: ['files'],
      next: [
        { id: 'email.subject_lines', why: 'Try a few subject lines for this issue before you send it.' },
        { id: 'email.nurture', why: 'New subscribers get six useful emails before your next issue.' },
      ],
    },
    {
      id: 'email.subject_lines',
      title: 'Subject lines that get opened',
      promise: '30 subject lines with preview text for your next email, in six styles, each checked for spam words, ALL CAPS and length on a phone.',
      minutes: 5,
      tier: 'free',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          topic: { type: 'string', title: 'What the email is about', description: 'For example "New winter candles are here"', maxLength: 160 },
          check: { type: 'string', title: 'A subject line to check (optional)', maxLength: 120 },
        },
        required: ['topic'],
      },
      steps: [{ id: 'lines', tool: 'email.subject_lines', input: { topic: '$inputs.topic', check: '$inputs.check' } }],
      result: ['lines'],
      next: [
        { id: 'email.welcome', why: 'Put your best lines to work in five welcome emails.' },
        { id: 'email.newsletter', why: "Use one on this month's newsletter." },
      ],
    },
  ],
};
