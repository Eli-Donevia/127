// What makes the shared B2B tools (_kit/b2b.js) speak web design: the service words for messages,
// the usual worries with an answer to send, the call, the kickoff, the care plan and the month-end
// numbers. Every price comes from the member's offer (lib/offer.js over data/prices.json).

const { money } = require('../../_kit');
const niche = require('../data/niche.json');
const offer = require('./offer');

const usd = money.usd;
const pkg = (o, id) => o.menu.packages.find((p) => p.id === id) || o.menu.packages[0];
const care = (o) => o.care[0];
const TERMS = 'Half to start, half when the site is live. You own your domain, hosting account and the finished site once it is paid in full; I keep the right to show it in my portfolio. Care plans are month to month: cancel any time before the next month.';

module.exports = {
  pack: 'webdesign',
  label: 'web design',
  sampleNoun: 'mock homepage',
  serviceName: 'websites',
  // The outreach service (same words as the leads pack's "websites", so messages match first_25).
  service: {
    id: 'web',
    label: 'Websites',
    sell: 'a new website',
    verb: 'build websites',
    offer: "I'd like to make you a free mockup of a new homepage, and you keep it either way.",
    walkin: 'Could I send you a free mockup of a new homepage for {biz}? Takes me a day.',
    follow1: "I made the homepage mockup. Here it is: [paste your link]. If you'd like it live, I can have it up within two weeks.",
    subject: 'A free homepage mockup for {biz}',
    gaps: { no_site: 44, site_down: 38, parked: 34, broken_link: 24, no_https: 20, no_mobile: 20, stale_footer: 14, no_booking: 8, no_form: 8, no_description: 5 },
    fit: { busy: 10, rated: 4, independent: 4 },
  },
  offer,
  checklist: niche.job_checklist,

  priceLine(o) {
    return `A one-page website is ${usd(pkg(o, 'one_page').price)}, live on your own domain within 14 days of getting your photos and words. After that, the care plan is ${usd(care(o).price)} a month to keep it updated, and you can stop any time.`;
  },
  priceFollow: "If you'd like to see it first, the free mock homepage is still yours.",
  offerFacts(o) {
    const lines = o.menu.packages.map((p) => `${p.label}: ${usd(p.price)} (${p.includes.slice(0, 3).join('; ')})`);
    lines.push(...o.care.map((c) => `${c.label}: ${usd(c.price)} a month (${c.includes.join('; ')})`));
    lines.push('Timeline: first draft on their phone at day 7, live within 14 days of getting photos and words.');
    lines.push('They own the domain, hosting and site once paid.');
    lines.push(`Promise: ${niche.promise}`);
    return lines.join('\n');
  },
  yesLine: (v) => `Great! I'll have the mock homepage to you by [day]. Is there anything you'd love it to show, or anything to avoid?`,

  // Send-ready answers to the usual worries (niche.json objections), each ending on one next step.
  objections: [
    {
      id: 'have_site',
      match: /\b(already (have|got) (a |our )?(web ?)?site|we have a (web ?)?site|(our|my) (web ?)?site is fine|happy with (our|my) (web ?)?site)\b/i,
      says: 'I already have a website.',
      means: 'They have a site and don\'t see the problem yet.',
      ack: () => "Good to hear you have a site, and I'm not saying start over.",
      say: (v) => `Totally fair, and I'm not saying start over. ${v.fact ? `I noticed one thing on your current site: ${String(v.factYou || v.fact).replace(/\.$/, '')}.` : 'I looked at your site on my phone and found a few quick fixes.'} Want me to send the mock homepage next to your current site so you can compare them on your phone?`,
      tip: niche.objections[0].answer,
    },
    {
      id: 'someone',
      match: /\b(nephew|niece|my son|my daughter|cousin|friend|brother|sister|(our|my) (guy|kid)|family member|someone (does|handles|built)|a guy (does|did))\b/i,
      says: 'My nephew or a friend does our website.',
      means: 'Someone they trust looks after it.',
      say: () => "That's great to have someone. The mock homepage is yours to keep either way: hand it to them as ideas. If they ever get busy, I also do a care plan for small edits each month.",
      tip: niche.objections[1].answer,
    },
    {
      id: 'tried',
      match: /\b(wix|squarespace|godaddy|site builder|tried (to )?(make|build|do) (it|one)|never finished|didn'?t have (the )?time)\b/i,
      says: 'I tried a website builder and never finished.',
      means: 'They started alone and ran out of time.',
      say: () => "That's really common: the builders are easy until the last part. I can finish it in about two weeks at one clear price, on your own account so you keep it. Want me to take a look at what you have?",
      tip: niche.objections[2].answer,
    },
    {
      id: 'cost',
      match: /\b(too (much|expensive|pricey)|can'?t afford|no budget|out of (our|my) budget|cheaper|expensive|tight right now)\b/i,
      says: 'It costs too much.',
      means: 'The price feels big right now.',
      say: (v) => `Understood. Two smaller ways to start: the top 5 fixes on your current site for ${usd(pkg(v.o, 'fix_list').price)}, or the one-page site at ${usd(pkg(v.o, 'one_page').price)} with the care plan. Want the details on either one?`,
      next: 'Offer the smaller start once. If it is still no, ask to check back in a couple of months.',
      tip: niche.objections[3].answer,
    },
    {
      id: 'word_of_mouth',
      match: /\b(word of mouth|referrals|don'?t need (a )?(web ?)?site|people (already )?know (us|me)|all (our|my) (business|work) comes from)\b/i,
      says: 'All my business comes from word of mouth.',
      means: 'Referrals work for them, so a site feels optional.',
      say: () => "Makes sense, referrals are the best customers. When someone gets your name from a friend, most look you up before they call. The mock shows what they'd see on a phone: your number, hours and services in one tap. Want me to send it?",
      tip: niche.objections[4] ? niche.objections[4].answer : '',
    },
    {
      id: 'info',
      match: /\b(send (me )?(some |more )?(info|information|details)|email me|more info)\b/i,
      onCall: false,
      says: 'Send me some info.',
      means: 'They want something to read first.',
      say: (v) => `Sure. The short version: ${v.priceLine.replace(/^A /, 'a ')} The mock homepage I made for you is here: [paste your link]. Would a 10 minute call this week be easier than email?`,
    },
    {
      id: 'how_long',
      match: /\b(how long|how soon|when (could|can|would) (it|you)|turnaround|timeline)\b/i,
      onCall: false,
      says: 'How long does it take?',
      means: 'They want to know when it would be live.',
      say: () => "About 14 days from when I get your photos and words. You see a first draft on your phone at day 7 and tell me what to change. Want me to send the mock so you can see where we'd start?",
    },
    {
      id: 'own_it',
      match: /\b(hosting|domain|who owns|own (it|the site)|locked in|my account)\b/i,
      says: 'Who owns the site and the domain?',
      means: 'They worry about being locked in.',
      say: () => "You do. The domain and hosting are in your name and on your account, and I'm added as a user. Once it's paid, the site is yours, even if you stop working with me.",
    },
    {
      id: 'google',
      match: /\b(seo|rank(ing)?|first page|show up on google|google search)\b/i,
      says: 'Will it get us to the top of Google?',
      means: 'They hope a site means more calls from Google.',
      say: () => "I can't promise rankings, and nobody honest can. What I do: your site works on a phone, loads fast, and has your name, services, area and hours set up the way Google reads them, and your Google profile links to it.",
    },
  ],

  call: {
    checks: (v) => [
      'Open their website on your phone and screenshot the first screen.',
      'Have the mock homepage open on your phone, next to their current site.',
      v.fact ? `Know the one fix you will name: ${v.fact}` : 'Pick the one fix you will name first (a broken page, no tap-to-call, no hours).',
      'Look up their Google profile: does it link to their website?',
    ],
    questions: (v) => [
      'Who looks after the website now, and when did it last change?',
      'When someone finds you on Google, what do you want them to do first: call, book or ask for a quote?',
      'What kind of jobs or customers do you want more of this year?',
      'Do you have a logo and photos you like, or should we start from what is on your site?',
      'Who else decides on this with you?',
      'If it was live in two weeks, what would you want it to say first?',
    ],
    close: (v) => `Want me to start? I'll send the proposal tonight with three options. Once you pick one and pay the first half, I start, and you see a first draft on your phone within 7 days.`,
    after: () => 'Send the proposal within 24 hours, with the mock homepage link, and log the call in your Pipeline. If you hear nothing in 3 days, send one short follow-up.',
  },

  start: {
    packages: [
      { id: 'one_page', label: 'One-page website' },
      { id: 'small_site', label: 'Small business website (up to 5 pages)' },
      { id: 'fix_list', label: 'Fix list on their current site' },
      { id: 'care', label: 'Care plan only' },
    ],
    title: (v) => (v.pkg.id === 'care' ? `The ${v.biz} care plan` : `The new ${v.biz} website`),
    deposit: (v) => (v.pkg.id === 'care' ? null : '50%'),
    jobWord: 'website',
    showWhat: 'the before and after of your site',
    terms: TERMS,
    prepIntro: 'to get started, could you send me:',
    needs: (v) =>
      v.pkg.id === 'fix_list'
        ? ['Add me as a user on your website builder (Wix, Squarespace, WordPress or your host). Please never send a password.', 'The one page that matters most to you.', 'Anything on the site that is out of date (hours, prices, staff).']
        : v.pkg.id === 'care'
          ? ['Add me as a user on your website and hosting accounts. Please never send a password.', 'The first change you want this month.']
          : [
              'Your logo (any file you have).',
              '5 to 10 photos you like, or tell me which ones on your current site to use.',
              'Your services and prices, the way you say them.',
              'Your hours and the area you serve.',
              'Who has the login to your domain (GoDaddy, Namecheap or similar). Add me as a user; never send a password.',
              'Add me as a manager on your Google Business Profile, so the website link matches.',
            ],
    plan: (v) =>
      v.pkg.id === 'fix_list'
        ? [
            { day: 0, what: 'Access in and the fix list agreed' },
            { day: 3, what: 'Top 5 fixes done on the current site' },
            { day: 4, what: 'Phone check on a real phone, before and after note sent' },
          ]
        : v.pkg.id === 'care'
          ? [
              { day: 0, what: 'Added as a user; first backup and uptime check' },
              { day: 7, what: 'First small edit' },
              { day: 30, what: 'Month-end report' },
            ]
          : v.pkg.id === 'small_site'
            ? [
                { day: 0, what: 'Kickoff: facts, photos and logins in' },
                { day: 7, what: 'Homepage draft on your phone' },
                { day: 14, what: 'All pages drafted; your changes in one list' },
                { day: 19, what: 'Booking or quote form tested on a phone' },
                { day: 21, what: 'Live on your domain; Google profile link updated' },
                { day: 51, what: 'First care plan check-in and report' },
              ]
            : [
                { day: 0, what: 'Kickoff: facts, photos and logins in' },
                { day: 4, what: 'Draft built, phone first' },
                { day: 7, what: 'You see the first draft on your phone' },
                { day: 10, what: 'Your changes are in' },
                { day: 14, what: 'Live on your domain; Google profile link updated' },
                { day: 44, what: 'First care plan check-in and report' },
              ],
    kickoff: (v, plan) =>
      [
        `Hi ${v.hi}, thank you for saying yes! Here's the plan for ${v.biz}:`,
        '',
        ...plan.map((x) => `${x.date}: ${x.what}`),
        '',
        `I'll send the invoice for the first ${v.pkg.id === 'care' ? 'month' : 'half'} today. Once it's paid, I start on ${v.startText}. The list of what I need from you comes next.`,
        '',
        v.me,
      ].join('\n'),
    after: (v) =>
      v.pkg.id === 'fix_list'
        ? `Hi ${v.hi}, the fixes on ${v.biz}'s website are done. Check it on your phone: [list the 5 fixes]. If anything looks off, tell me this week and I'll sort it. If you'd like me to keep it updated each month, the care plan is ${usd(care(v.o).price)} a month.`
        : `Hi ${v.hi}, ${v.biz}'s new website is live: [your link]. Check it on your phone: the call button, your hours and the form, and your Google profile now links to it. If anything looks off, tell me this week and I'll fix it.`,
    rules: [
      "The domain, hosting and Google profile stay in the client's name; you are added as a user.",
      'Never ask for a password. Ask to be added as a user.',
      'Use only the facts they send in writing (services, prices, hours).',
      'The second half is due when the site is live, as the proposal says.',
    ],
  },

  keep: {
    planIds: ['care', 'care_plus'],
    plans: (o) => o.care.map((c) => ({ id: c.id, label: c.label, price: c.price, unit: 'month', includes: c.includes })),
    introWhat: 'a website that works on a phone',
    measure: 'At month end: calls and form messages from the site (from your analytics or form inbox), the page speed score on a phone, uptime, and every change made.',
    weeks: (v) => [
      'Updates, backups and an uptime check',
      v.notes ? `Small edit: ${v.notes}` : 'One small edit: hours, a price or a new photo',
      v.plan.id === 'care_plus' ? 'Google profile post and a page speed check' : 'Page speed check on a phone',
      'Month-end report with the numbers',
    ],
    checkin: (v) => `Hi ${v.hi}, quick check-in for ${v.monthName}: anything to change on the site? Hours, prices, a new photo or a seasonal note. Send it over and I'll have it up within 2 days.`,
    offer: (v) => `Hi ${v.hi}, for ${v.monthName} I'd keep ${v.biz}'s site on the ${v.plan.label.toLowerCase()} at ${usd(v.plan.price)} a month: ${v.plan.includes.join(', ').toLowerCase()}. Month to month, stop any time. Want me to keep it going?`,
    upsell: (v) => {
      const add = v.o.menu.addons.find((a) => a.id === 'booking');
      const gbp = v.o.menu.addons.find((a) => a.id === 'gbp');
      return `One idea for ${v.monthName}: online booking or quote requests set up on the site for ${usd(add.price)} one time, so people can book without calling. Or a Google profile tune-up for ${usd(gbp.price)}. Want either?`;
    },
  },

  month: {
    metrics: [
      { key: 'calls', label: 'Taps on the call button', kind: 'result' },
      { key: 'forms', label: 'Form messages or quote requests', kind: 'result' },
      { key: 'bookings', label: 'Online bookings', kind: 'result' },
      { key: 'visitors', label: 'Visitors to the site', kind: 'reach' },
      { key: 'speed', label: 'Page speed score on a phone (0 to 100)', kind: 'work' },
      { key: 'uptime', label: 'Uptime', kind: 'work', unit: '%' },
      { key: 'edits', label: 'Changes made', kind: 'work' },
    ],
    goalHint: 'Something the owner counted, like "calls that mentioned the website"',
    source: 'Calls, forms and visitors from the site analytics or form inbox; speed from PageSpeed Insights on a phone; uptime from the monitor. Only numbers we counted.',
    nextDefault: 'Keep the site current (hours, prices, a new photo) and make one small improvement.',
    anonymous: 'A local business',
    storyLead: (who) => `${who} needed a website that works on a phone.`,
  },
};
