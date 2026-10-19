// What makes the shared B2B tools (_kit/b2b.js) speak social media for restaurants and cafes: the
// service words for messages, the usual worries with an answer to send, the call, the kickoff, the
// monthly plan and the month-end numbers. Every price comes from the member's offer (lib/offer.js
// over data/prices.json).

const { money } = require('../../_kit');
const niche = require('../data/niche.json');
const offer = require('./offer');

const usd = money.usd;
const pkg = (o, id) => o.menu.packages.find((p) => p.id === id) || o.menu.packages[0];
const plan = (o, id) => o.care.find((c) => c.id === id) || o.care[0];
const obj = (start) => (niche.objections.find((x) => x.says.startsWith(start)) || {}).answer || '';
const monthly = (v) => v.pkg.id === 'month' || v.pkg.id === 'month_shoot';
const TERMS = 'The deposit is the first month, paid before we start; after that each month is paid at its start. Month to month: stop any time before the next month. Nothing is posted without your yes. You own the posts and photos for your own accounts, website and menus; I may show them in my portfolio.';
const ACCESS = 'Add me as a partner in Meta Business Suite (Settings, then Partners), so you choose what I can touch. Please never send a password.';

// The fact to name on a call: their Instagram or Facebook first (what the plan posts to), then their
// photos, video or other social links, else the best fact we have.
const socialFactOf = (v) => {
  const all = [v.fact, ...(v.facts || [])].filter(Boolean);
  for (const re of [/\b(instagram|facebook)\b/i, /\b(posts?|photos?|video|social)\b/i]) {
    const hit = all.find((x) => re.test(x));
    if (hit) return hit;
  }
  return v.fact || '';
};

module.exports = {
  pack: 'social',
  label: 'social media',
  sampleNoun: 'sample week of posts',
  serviceName: 'social media',
  // The outreach service (same words as the leads pack's "social media", so messages match first_25).
  service: {
    id: 'social',
    label: 'Social media',
    sell: 'social media',
    verb: 'run social media',
    offer: "I'd like to write and design your next 3 posts for free, so you can see the style first.",
    walkin: 'Could I take a few photos this week and turn them into 3 free posts for you?',
    follow1: 'I made the 3 posts. Here they are: [paste your link]. Use them either way. If you want more like this every week, let me know.',
    subject: '3 free posts for {biz}?',
    gaps: { no_instagram: 24, no_social: 16, no_tiktok: 14, no_facebook: 8, no_pixel: 8, no_video: 10, no_site: 12, site_down: 6, few_reviews: 8, stale_footer: 6, few_images: 6 },
    fit: { ads: 8, busy: 8, booking: 4, independent: 4 },
  },
  offer,
  checklist: niche.job_checklist,

  priceLine(o) {
    return `Monthly posts are ${usd(plan(o, 'month').price)} a month: 3 posts a week of your own food on Instagram and Facebook, and nothing goes out without your yes. It's month to month, so you can stop any time. Or start with a trial week of 3 posts for ${usd(pkg(o, 'trial_week').price)}.`;
  },
  priceFollow: 'Either way, the sample week I made is yours to use.',
  offerFacts(o) {
    const lines = o.care.map((c) => `${c.label}: ${usd(c.price)} a month (${c.includes.join('; ')})`);
    lines.push(...o.menu.packages.map((p) => `${p.label}: ${usd(p.price)} one time (${p.includes.slice(0, 3).join('; ')})`));
    lines.push('Every post goes to the owner for a yes before it goes out. Month to month, stop any time.');
    lines.push('Access through partner access in Meta Business Suite, never a password.');
    lines.push(`Promise: ${niche.promise}`);
    return lines.join('\n');
  },
  yesLine: () => "Great! I'll send the sample week by [day]. Is there a dish, a special or a night you'd love it to show, or anything to keep out?",

  // Send-ready answers to the usual worries (niche.json objections), each ending on one next step.
  objections: [
    {
      id: 'tried',
      match: /\b(tried (it|social|instagram|posting|that)|didn'?t (work|bring|help)|waste of (time|money)|nobody (saw|sees|came)|no one (saw|sees|came))\b/i,
      says: "We tried social media and it didn't bring anyone in.",
      means: "They posted before and didn't see a difference.",
      ack: () => 'Fair question after trying it before.',
      say: () => "That's fair, and I won't promise crowds. What I can promise: 3 posts a week of your own food, on the days we agree, each one approved by you. Want to pick one slow night and plan a month of posts around it, so we both can count what happens?",
      tip: obj('We tried'),
    },
    {
      id: 'someone',
      match: /\b(nephew|niece|my (son|daughter|kid)|cousin|a friend|(our|a|one of our) servers?|(we|i) (do|post|handle) (it|that|our|my)|someone (does|handles|posts))\b/i,
      says: 'My nephew or a server does our Instagram.',
      means: 'Someone they trust posts for them.',
      ack: () => "Great that someone already posts for you, and I'm not here to replace them.",
      say: () => "That's great to have someone, and the sample week is theirs to use too. If they ever get busy, I can take planned weeks off their plate, or do one shoot a month they can post from.",
      tip: obj('My nephew'),
    },
    {
      id: 'cost',
      match: /\b(too (much|expensive|pricey)|can'?t afford|no budget|out of (our|my) budget|cheaper|expensive|tight right now|margins)\b/i,
      says: "We can't afford it.",
      means: 'The monthly price feels big right now.',
      say: (v) => `Understood, margins are thin. Two smaller ways to start: a trial week of 3 posts for ${usd(pkg(v.o, 'trial_week').price)}, or one menu photo shoot for ${usd(pkg(v.o, 'shoot_day').price)} with photos you post yourselves. Want the details on either?`,
      next: 'Offer the smaller start once. If it is still no, ask to check back before their next busy season.',
      tip: obj('We can'),
    },
    {
      id: 'regulars',
      match: /\b(regulars|word of mouth|people (already )?know (us|where)|don'?t need (social|instagram|it|that)|busy enough|always (busy|full))\b/i,
      says: "Our regulars know us. We don't need it.",
      means: 'They are busy enough and see posts as optional.',
      ack: () => 'Your regulars are the heart of it.',
      say: () => "Makes sense, regulars are the heart of it. Posts give them something to share, and new people look you up before a first visit. The sample week shows what they'd see. Want me to send it?",
      tip: obj('Our regulars'),
    },
    {
      id: 'password',
      match: /\b(password|log ?in|access to (our|my) (account|page|instagram)|hack(ed)?)\b/i,
      says: "I don't want to give anyone my password.",
      means: 'They worry about losing control of their accounts.',
      ack: () => 'And you never need to share a password.',
      say: () => "You never need to. In Meta Business Suite you add me as a partner, choose exactly what I can touch, and remove me any time. Same for your Google profile.",
      tip: obj('I don'),
    },
    {
      id: 'results',
      match: /\b(more (customers|followers|sales|people)|followers|go viral|guarantee|will it (work|help|bring))\b/i,
      says: 'Will it actually bring people in?',
      means: 'They want to know what they get for the money.',
      say: () => "I can't promise customers or followers, and nobody honest can. What I promise: 3 posts a week of your own food, on time, each one approved by you, and one page each month with what we can both count. Want to pick one goal for the first month?",
    },
    {
      id: 'info',
      match: /\b(send (me )?(some |more )?(info|information|details)|email me|more info)\b/i,
      onCall: false,
      says: 'Send me some info.',
      means: 'They want something to read first.',
      say: (v) => `Sure. The short version: ${v.priceLine.replace(/^Monthly/, 'monthly')} The sample week I made for you is here: [paste your link]. Would 10 minutes at your place this week be easier than email?`,
    },
    {
      id: 'when',
      match: /\b(how (soon|long)|when (could|can|would) (you|we|it) (start|begin)|start (when|date)|turnaround)\b/i,
      onCall: false,
      says: 'When could you start?',
      means: 'They want to know how fast the first posts go out.',
      say: () => 'The week after you say yes: I take photos at your place before service, and the first 3 posts come to you for a yes before anything goes out. Want me to hold a day for the photos?',
    },
  ],

  call: {
    checks: (v) => [
      'Open their Instagram and Facebook on your phone: when was the last post?',
      'Have the sample week open on your phone.',
      socialFactOf(v) ? `Know the one thing you will name: ${socialFactOf(v)}` : 'Pick the one dish from their menu you would post first.',
      'Look at their Google profile photos: are they recent?',
    ],
    questions: () => [
      'Who posts for you now, and how often?',
      'Which night or time of day do you want busier?',
      'What on the menu are you proudest of right now?',
      'Is there anything you never want shown: the kitchen, staff, prices?',
      'Who else decides on this with you?',
      'If we started next week, what should the first post be?',
    ],
    close: () => "Want to try it? I'll send the proposal tonight with three options. Once you pick one and pay the first month, I take photos at your place the next week, and your first 3 posts come to you for a yes before anything goes out.",
    after: () => 'Send the proposal within 24 hours with the sample week link, and log the call in your Pipeline. If you hear nothing in 3 days, send one short follow-up.',
  },

  start: {
    packages: [
      { id: 'month', label: 'Monthly posts' },
      { id: 'month_shoot', label: 'Monthly posts with a shoot' },
      { id: 'trial_week', label: 'Trial week of 3 posts' },
      { id: 'reels_pack', label: '4 Reels' },
      { id: 'shoot_day', label: 'Menu photo shoot' },
    ],
    // Read as "Thank you for choosing me for monthly posts for Blue Door Bakery" on the invoice email.
    title: (v) => ({ month: `Monthly posts for ${v.biz}`, month_shoot: `Monthly posts with a shoot for ${v.biz}`, trial_week: `A trial week of posts for ${v.biz}`, reels_pack: `4 Reels for ${v.biz}`, shoot_day: `A menu photo shoot for ${v.biz}` })[v.pkg.id],
    // A month or the trial week is paid in full before it starts (no deposit); a shoot or Reels is half up front.
    deposit: (v) => (v.pkg.id === 'reels_pack' || v.pkg.id === 'shoot_day' ? '50%' : null),
    jobWord: (v) => ({ month: 'month of posts', month_shoot: 'month of posts', trial_week: 'week of posts', reels_pack: 'set of Reels', shoot_day: 'shoot' })[v.pkg.id] || 'job',
    showWhat: 'the posts and photos we made',
    terms: (v) =>
      monthly(v)
        ? TERMS
        : v.pkg.id === 'trial_week'
          ? 'Paid before we start. Nothing is posted without your yes. You own the posts and photos for your own accounts; I may show them in my portfolio.'
          : `Half to book the date, half when you get the ${v.pkg.id === 'reels_pack' ? 'Reels' : 'photos'}. A new date is free if the weather or a closure moves it. You own them for your own accounts, website and menus; I may show them in my portfolio.`,
    prepIntro: 'to get started, could you send me:',
    needs: (v) =>
      v.pkg.id === 'shoot_day'
        ? ['A good day and time before service, when the room is quiet.', 'The 5 to 10 dishes and drinks you want shot.', "Anyone on staff who is happy to be in photos (and anyone who isn't).", 'Where the photos will go: posts, website, Google profile or delivery apps.']
        : v.pkg.id === 'reels_pack'
          ? ['A good day and time before service for filming.', 'The 4 ideas you like best from the shot list I send.', "Anyone on staff who is happy to be on camera (and anyone who isn't).", ACCESS]
          : [
              ACCESS,
              ...(monthly(v) ? ['Add me as a manager on your Google Business Profile.'] : []),
              'Your menu with prices as printed, and any specials coming up.',
              'Your hours, and the night or time you want busier.',
              'Anything you never want shown (kitchen, staff, prices) and any allergy notes.',
              'A good day and time for photos, before service.',
            ],
    plan: (v) =>
      v.pkg.id === 'trial_week'
        ? [
            { day: 0, what: 'Kickoff: menu, hours and the 3 dishes' },
            { day: 2, what: 'Photos at your place before service' },
            { day: 3, what: 'The 3 posts sent to you for a yes' },
            { day: 4, what: 'Post 1 goes out' },
            { day: 6, what: 'Post 2 goes out' },
            { day: 8, what: 'Post 3 goes out, then a short note on what we saw' },
          ]
        : v.pkg.id === 'shoot_day'
          ? [
              { day: 0, what: 'Shot list agreed' },
              { day: 3, what: 'Shoot at your place before service' },
              { day: 6, what: 'Edited photos in your online gallery' },
            ]
          : v.pkg.id === 'reels_pack'
            ? [
                { day: 0, what: 'Shot list for the 4 Reels agreed' },
                { day: 4, what: 'Filming at your place before service' },
                { day: 9, what: 'The 4 Reels sent to you for a yes' },
                { day: 11, what: 'Reel 1 goes out; one a week after that' },
              ]
            : [
                { day: 0, what: 'Kickoff: access, menu and one goal for the month' },
                { day: 3, what: v.pkg.id === 'month_shoot' ? 'Shoot at your place before service, plus 2 Reels filmed' : 'Photos at your place before service' },
                { day: 5, what: 'First week of posts sent to you for a yes' },
                { day: 7, what: 'First posts go out on the days we agreed' },
                { day: 11, what: 'Weeks 2 to 4 sent to you for a yes, then scheduled' },
                { day: 30, what: 'Month-end report and next month plan' },
              ],
    kickoff: (v, plan) =>
      [
        `Hi ${v.hi}, thank you for saying yes! Here's the plan for ${v.biz}:`,
        '',
        ...plan.map((x) => `${x.date}: ${x.what}`),
        '',
        `I'll send the invoice for ${monthly(v) ? 'the first month' : v.pkg.id === 'trial_week' ? 'the trial week' : 'the first half'} today. Once it's paid, we start on ${v.startText}. Nothing goes out without your yes.`,
        '',
        v.me,
      ].join('\n'),
    after: (v) =>
      v.pkg.id === 'trial_week'
        ? `Hi ${v.hi}, all 3 posts from your trial week are out: [paste the links]. If you'd like me to keep going, monthly posts are ${usd(plan(v.o, 'month').price)} a month, 3 posts a week, month to month.`
        : v.pkg.id === 'shoot_day'
          ? `Hi ${v.hi}, your edited photos are in your gallery: [your link]. Use them on your posts, website, Google profile and delivery apps. If one needs another edit, tell me this week.`
          : v.pkg.id === 'reels_pack'
            ? `Hi ${v.hi}, your 4 Reels are ready: [your link]. Each one is the version you said yes to, and the first goes out [day]. If one needs a change, tell me this week.`
            : `Hi ${v.hi}, your first posts are scheduled: [list the days]. Each one is the version you said yes to. I'll answer comments on the days we agreed, and you get the month-end numbers on the last day.`,
    rules: [
      'Access only through partner access in Meta Business Suite and manager access on their Google profile. Never ask for a password.',
      "Nothing is posted without the owner's yes.",
      'Prices in captions exactly as printed on their menu.',
      'Only show staff and guests who agreed to be in photos.',
      'Music only from the Meta Sound Collection for business accounts.',
    ],
  },

  keep: {
    planIds: ['month', 'month_shoot'],
    plans: (o) => o.care.map((c) => ({ id: c.id, label: c.label, price: c.price, unit: 'month', includes: c.includes, summary: c.summary })),
    introWhat: 'fresh posts of their own food every week',
    measure: 'At month end: posts made, reach and saves from Meta Insights, and the goal count you kept.',
    weeks: (v) => [
      `Plan ${v.monthName}: specials, dates and one goal`,
      v.notes ? `Photos and posts for: ${v.notes}` : v.plan.id === 'month_shoot' ? 'Shoot day at your place, plus 2 Reels' : 'New photos before service',
      '3 posts a week, each one approved first',
      'Month-end report with the numbers',
    ],
    checkin: (v) => `Hi ${v.hi}, quick check-in for ${v.monthName}: any specials, events or new dishes coming up? Send them over and I'll plan the posts around them.`,
    offer: (v) => `Hi ${v.hi}, for ${v.monthName} I'd keep ${v.biz} on ${v.plan.label.toLowerCase()} at ${usd(v.plan.price)} a month: ${v.plan.summary}. Month to month, stop any time. Want me to keep it going?`,
    upsell: (v) =>
      v.plan.id === 'month'
        ? `One idea for ${v.monthName}: move to monthly posts with a shoot at ${usd(plan(v.o, 'month_shoot').price)} a month, for a shoot at your place every month and 2 Reels. Or 4 Reels on their own for ${usd(pkg(v.o, 'reels_pack').price)}. Want either?`
        : `One idea for ${v.monthName}: 4 more Reels for ${usd(pkg(v.o, 'reels_pack').price)}, for a dish or a night you want busier. Want me to plan them?`,
  },

  month: {
    metrics: [
      { key: 'messages', label: 'Messages, calls and booking taps from the posts', kind: 'result' },
      { key: 'reach', label: 'Accounts reached (Meta Insights)', kind: 'reach' },
      { key: 'saves', label: 'Saves and shares', kind: 'reach' },
      { key: 'followers', label: 'New followers', kind: 'reach' },
      { key: 'posts', label: 'Posts made', kind: 'work' },
      { key: 'reels', label: 'Reels made', kind: 'work' },
    ],
    goalHint: 'Something the owner counted, like "Tuesday covers" or "specials sold"',
    source: 'Reach, saves, followers and messages from Meta Insights; the goal is the count the owner kept. Only numbers we counted.',
    nextDefault: 'Keep 3 posts a week going, plan around the next special, and keep counting the goal.',
    anonymous: 'A local food business',
    storyLead: (who) => `${who} wanted regular posts of their own food.`,
  },
};
